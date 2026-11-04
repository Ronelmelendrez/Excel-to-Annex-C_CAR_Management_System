import { verifyJwt } from '../_shared/auth.ts';
import { enforceAdminOnly } from '../_shared/access.ts';
import { hasActiveRole } from '../_shared/rbac.ts';
import { auditLog } from '../_shared/audit.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { json, error, preflight, handleError, HttpError } from '../_shared/http.ts';
import { normalizeGrantee } from '../_shared/import-domain.ts';

/** Roles that may author CARs (mirrors the /cars page RoleGuard). */
const AUTHOR_ROLES = ['admin', 'case_worker'];
const MAX_CARS = 500;

const CAR_SELECT =
  'id, household_id, grantee_member_id, case_group_id, status, revision, content, missing_fields, created_at, updated_at';

/** Fields a case worker may edit. Everything else in `content` is server-owned. */
const EDITABLE_STRING_FIELDS = [
  'templateVersion',
  'datePrepared',
  'presentingProblem',
  'backgroundInformation',
  'assessment',
  'recommendation',
];
const EDITABLE_ARRAY_FIELDS = ['familyComposition', 'interventions', 'history'];

type Content = Record<string, unknown>;

function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
}

function asContent(value: unknown): Content {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Content) : {};
}

function str(content: Content, key: string): string {
  const value = content[key];
  return typeof value === 'string' ? value : '';
}

function num(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** FIRST_NAME + MIDDLE_NAME + LAST_NAME + EXT_NAME, blanks skipped. */
function composeName(normalized: Record<string, unknown> | null): string {
  if (!normalized) return '';
  return [normalized.FIRST_NAME, normalized.MIDDLE_NAME, normalized.LAST_NAME, normalized.EXT_NAME]
    .map((part) => text(part).trim())
    .filter(Boolean)
    .join(' ');
}

/** AGE is stored as the cell's formatted text; blank or non-numeric stays null. */
function parseAge(value: unknown): number | null {
  const raw = text(value).trim();
  if (!raw) return null;
  const age = Number(raw);
  return Number.isFinite(age) ? age : null;
}

/**
 * Mirrors apps/web/src/features/cars/lib/car-draft.ts getCarChecklist():
 * the ids are the checklist rows the editor jumps to, so both sides must stay
 * in lockstep or the saved completeness would flip after each save.
 */
function missingFields(content: Content): string[] {
  const missing: string[] = [];
  if (!str(content, 'templateVersion')) missing.push('templateVersion');
  if (!str(content, 'datePrepared')) missing.push('datePrepared');
  const family = asArray(content.familyComposition);
  const hasIncludedMember = family.some(
    (member) => member && typeof member === 'object' && (member as Content).include === true,
  );
  if (!hasIncludedMember) missing.push('familyComposition');
  if (!str(content, 'presentingProblem').trim()) missing.push('presentingProblem');
  if (!str(content, 'backgroundInformation').trim()) missing.push('backgroundInformation');
  if (!str(content, 'assessment').trim()) missing.push('assessment');
  const interventions = asArray(content.interventions);
  const hasCompleteIntervention = interventions.some((row) => {
    if (!row || typeof row !== 'object') return false;
    const intervention = row as Content;
    return Boolean(str(intervention, 'type')) && Boolean(str(intervention, 'details').trim());
  });
  if (!hasCompleteIntervention) missing.push('interventions');
  if (!str(content, 'recommendation').trim()) missing.push('recommendation');
  return missing;
}

function mapIntervention(value: unknown): Content {
  const row = value && typeof value === 'object' ? (value as Content) : {};
  return {
    id: str(row, 'id') || `intervention-${crypto.randomUUID()}`,
    type: str(row, 'type'),
    details: str(row, 'details'),
  };
}

function mapFamilyMember(value: unknown): Content {
  const row = value && typeof value === 'object' ? (value as Content) : {};
  return {
    id: str(row, 'id'),
    entryId: str(row, 'entryId'),
    name: str(row, 'name'),
    relationship: str(row, 'relationship'),
    age: row.age === null || row.age === undefined ? null : num(row.age, 0),
    sourceRow: num(row.sourceRow, 0),
    include: row.include === true,
  };
}

function mapHistoryEntry(value: unknown): Content {
  const row = value && typeof value === 'object' ? (value as Content) : {};
  return {
    id: str(row, 'id') || crypto.randomUUID(),
    label: str(row, 'label'),
    at: str(row, 'at') || new Date().toISOString(),
  };
}

function carReference(row: Record<string, unknown>): string {
  const content = asContent(row.content);
  const explicit = str(content, 'reference').trim();
  if (explicit) return explicit;
  return `CAR-${text(row.case_group_id).slice(0, 8).toUpperCase()}`;
}

function mapCar(row: Record<string, unknown>): Record<string, unknown> {
  const content = asContent(row.content);
  const missing = asArray(row.missing_fields).map((field) => text(field)).filter(Boolean);
  return {
    id: text(row.id),
    reference: carReference(row),
    householdId: text(row.household_id),
    granteeMemberId: text(row.grantee_member_id),
    revision: num(row.revision, 1),
    status: missing.length === 0 ? 'draft_ready_for_review' : 'draft_incomplete',
    workflowStatus: text(row.status) || 'draft',
    hhId: str(content, 'hhId'),
    granteeName: str(content, 'granteeName'),
    granteeSourceRow: num(content.granteeSourceRow, 0),
    importName: str(content, 'importName'),
    importVersion: num(content.importVersion, 1),
    templateVersion: str(content, 'templateVersion'),
    datePrepared: str(content, 'datePrepared'),
    presentingProblem: str(content, 'presentingProblem'),
    backgroundInformation: str(content, 'backgroundInformation'),
    assessment: str(content, 'assessment'),
    recommendation: str(content, 'recommendation'),
    interventions: asArray(content.interventions).map(mapIntervention),
    familyComposition: asArray(content.familyComposition).map(mapFamilyMember),
    history: asArray(content.history).map(mapHistoryEntry),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

/**
 * Same rules as getGranteeStatus() in the households feature: a CAR may only
 * start from a household with exactly one GRANTEE=Yes and no blank or
 * unparseable GRANTEE cell anywhere in the row set.
 */
function granteeStatus(members: Content[]): 'valid' | 'multiple' | 'invalid' | 'blank' | 'none' {
  const parsed = members.map((member) => ({
    raw: str(member, 'granteeFlag').trim(),
    value: normalizeGrantee(str(member, 'granteeFlag')),
  }));
  const yesCount = parsed.filter((member) => member.value === true).length;
  const invalidCount = parsed.filter((member) => member.raw !== '' && member.value === null).length;
  const blankCount = parsed.filter((member) => member.raw === '').length;

  if (yesCount > 1) return 'multiple';
  if (yesCount === 1 && invalidCount > 0) return 'invalid';
  if (yesCount === 1 && blankCount > 0) return 'blank';
  if (yesCount === 1) return 'valid';
  if (invalidCount > 0) return 'invalid';
  if (blankCount > 0) return 'blank';
  return 'none';
}

async function nextCarReference(supabase: any): Promise<string> {
  const { data, error: rpcError } = await supabase.rpc('next_car_reference');
  if (rpcError || typeof data !== 'string' || !data) {
    throw new HttpError(500, 'reference_failed');
  }
  return data;
}

async function listCars(supabase: any) {
  const { data, error: queryError } = await supabase
    .from('case_assessments')
    .select(CAR_SELECT)
    .order('created_at', { ascending: false })
    .limit(MAX_CARS);
  if (queryError) throw queryError;
  return json({ cars: (data ?? []).map(mapCar) });
}

async function listTemplates(supabase: any) {
  const { data, error: queryError } = await supabase
    .from('document_templates')
    .select('id, name, version, status')
    .order('version', { ascending: false });
  if (queryError) throw queryError;
  const templates = (data ?? []).map((row: any) => ({
    id: text(row.id),
    label: `${text(row.name) || 'Template'} · v${text(row.version)} (${text(row.status) || 'unknown'})`,
  }));
  return json({ templates });
}

async function createCar(supabase: any, userId: string, body: any) {
  const householdId = text(body?.household_id);
  if (!householdId) throw new HttpError(400, 'household_required');

  const { data: household, error: queryError } = await supabase
    .from('households')
    .select(
      `id, hh_id,
       imports:import_id ( file_name, version ),
       household_members (
         id, entry_id, is_grantee_flag_raw, raw,
         import_rows:import_row_id ( source_row_no, normalized )
       )`,
    )
    .eq('id', householdId)
    .maybeSingle();
  if (queryError) throw queryError;
  if (!household) throw new HttpError(404, 'not_found');

  const members: Content[] = ((household.household_members ?? []) as any[])
    .map((member) => {
      const normalized = (member.import_rows?.normalized ?? null) as Record<string, unknown> | null;
      return {
        id: text(member.id),
        entryId: text(member.entry_id),
        name: composeName(normalized),
        relationship: text(normalized?.RELATION_TO_HH_HEAD),
        age: parseAge(normalized?.AGE),
        granteeFlag: text(member.is_grantee_flag_raw ?? normalized?.GRANTEE),
        sourceRow: num(member.import_rows?.source_row_no, 0),
      };
    })
    .filter((member) => member.id)
    .sort((a, b) => num(a.sourceRow, 0) - num(b.sourceRow, 0));

  if (members.length === 0) throw new HttpError(400, 'invalid_household');
  const status = granteeStatus(members);
  if (status !== 'valid') throw new HttpError(400, 'invalid_household');
  const grantee = members.find((member) => normalizeGrantee(str(member, 'granteeFlag')) === true);
  if (!grantee) throw new HttpError(400, 'invalid_household');

  const now = new Date().toISOString();
  const reference = await nextCarReference(supabase);
  const content: Content = {
    reference,
    hhId: text(household.hh_id),
    granteeName: str(grantee, 'name'),
    granteeSourceRow: num(grantee.sourceRow, 0),
    importName: text(household.imports?.file_name) || 'workbook.xlsx',
    importVersion: num(household.imports?.version, 1),
    templateVersion: '',
    datePrepared: '',
    presentingProblem: '',
    backgroundInformation: '',
    assessment: '',
    recommendation: '',
    familyComposition: members.map((member) => ({ ...member, include: true })),
    interventions: [{ id: `intervention-${crypto.randomUUID()}`, type: '', details: '' }],
    history: [{ id: crypto.randomUUID(), label: 'Draft created', at: now }],
  };

  const { data, error: insertError } = await supabase
    .from('case_assessments')
    .insert({
      household_id: household.id,
      grantee_member_id: grantee.id,
      status: 'draft',
      revision: 1,
      owner_id: userId,
      content,
      missing_fields: missingFields(content),
    })
    .select(CAR_SELECT)
    .single();
  if (insertError) throw insertError;

  await auditLog({
    actorId: userId,
    action: 'car.created',
    entityType: 'case_assessments',
    entityId: data.id,
    afterState: { reference, revision: 1 },
  });

  return json({ car: mapCar(data) }, 201);
}

async function loadAssessment(supabase: any, id: string) {
  const { data, error: queryError } = await supabase
    .from('case_assessments')
    .select('id, household_id, grantee_member_id, case_group_id, status, revision, content, created_at')
    .eq('id', id)
    .maybeSingle();
  if (queryError) throw queryError;
  if (!data) throw new HttpError(404, 'not_found');
  return data;
}

async function updateCar(supabase: any, userId: string, body: any) {
  const id = text(body?.id);
  if (!id) throw new HttpError(400, 'id_required');

  const existing = await loadAssessment(supabase, id);
  // Approved and submitted CARs are immutable: edits create a new revision.
  if (existing.status !== 'draft') throw new HttpError(409, 'immutable');

  const incoming = asContent(body?.content);
  const content: Content = { ...asContent(existing.content) };
  for (const key of EDITABLE_STRING_FIELDS) {
    if (typeof incoming[key] === 'string') content[key] = incoming[key];
  }
  for (const key of EDITABLE_ARRAY_FIELDS) {
    if (Array.isArray(incoming[key])) content[key] = incoming[key];
  }

  const { data, error: updateError } = await supabase
    .from('case_assessments')
    .update({ content, missing_fields: missingFields(content) })
    .eq('id', id)
    .eq('status', 'draft')
    .select(CAR_SELECT)
    .maybeSingle();
  if (updateError) throw updateError;
  // The row left draft status between the check above and this write.
  if (!data) throw new HttpError(409, 'immutable');

  return json({ car: mapCar(data) });
}

async function deleteCar(supabase: any, userId: string, body: any) {
  const id = text(body?.id);
  if (!id) throw new HttpError(400, 'id_required');

  const existing = await loadAssessment(supabase, id);
  if (existing.status !== 'draft') throw new HttpError(409, 'immutable');

  const { count, error: countError } = await supabase
    .from('generated_reports')
    .select('id', { count: 'exact', head: true })
    .eq('assessment_id', id);
  if (countError) throw countError;
  if ((count ?? 0) > 0) throw new HttpError(409, 'has_reports');

  const { error: deleteError } = await supabase.from('case_assessments').delete().eq('id', id);
  if (deleteError) throw deleteError;

  await auditLog({
    actorId: userId,
    action: 'car.deleted',
    entityType: 'case_assessments',
    entityId: id,
    beforeState: {
      reference: carReference(existing),
      status: text(existing.status),
      revision: num(existing.revision, 1),
    },
  });

  return json({ ok: true });
}

async function reviseCar(supabase: any, userId: string, body: any) {
  const id = text(body?.id);
  if (!id) throw new HttpError(400, 'id_required');

  const existing = await loadAssessment(supabase, id);
  const revision = num(existing.revision, 1) + 1;
  const now = new Date().toISOString();
  const previousHistory = asArray(asContent(existing.content).history);
  const content: Content = {
    ...asContent(existing.content),
    history: [
      { id: crypto.randomUUID(), label: `Revision ${revision} created`, at: now },
      ...previousHistory.map(mapHistoryEntry),
    ].slice(0, 8),
  };

  const { data, error: insertError } = await supabase
    .from('case_assessments')
    .insert({
      household_id: existing.household_id,
      grantee_member_id: existing.grantee_member_id,
      case_group_id: existing.case_group_id,
      status: 'draft',
      revision,
      owner_id: userId,
      content,
      missing_fields: missingFields(content),
    })
    .select(CAR_SELECT)
    .single();
  if (insertError) {
    if (insertError.code === '23505') throw new HttpError(409, 'revision_exists');
    throw insertError;
  }

  await auditLog({
    actorId: userId,
    action: 'car.revision_created',
    entityType: 'case_assessments',
    entityId: data.id,
    afterState: { reference: carReference(data), revision },
  });

  return json({ car: mapCar(data) }, 201);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();

  try {
    const user = await verifyJwt(req);
    await enforceAdminOnly(user.id);
    const allowed = await hasActiveRole(user.id, AUTHOR_ROLES);
    if (!allowed) throw new Error('forbidden');

    const supabase = getServiceClient();
    const url = new URL(req.url);
    const action = url.searchParams.get('action') ?? '';

    if (req.method === 'GET') {
      if (action === 'list') return await listCars(supabase);
      if (action === 'templates') return await listTemplates(supabase);
      return error(404, 'not_found');
    }
    if (req.method !== 'POST') return error(405, 'method_not_allowed');

    const body = await req.json().catch(() => ({}));
    const operation = text(body?.action) || action;
    switch (operation) {
      case 'create':
        return await createCar(supabase, user.id, body);
      case 'update':
        return await updateCar(supabase, user.id, body);
      case 'delete':
        return await deleteCar(supabase, user.id, body);
      case 'revise':
        return await reviseCar(supabase, user.id, body);
      default:
        return error(404, 'not_found');
    }
  } catch (e) {
    return handleError(e);
  }
});
