import { verifyJwt } from '../_shared/auth.ts';
import { enforceAdminOnly } from '../_shared/access.ts';
import { hasActiveRole } from '../_shared/rbac.ts';
import { auditLog } from '../_shared/audit.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { json, error, preflight, handleError, HttpError } from '../_shared/http.ts';
import { normalizeGrantee } from '../_shared/import-domain.ts';
import {
  CAR_MEMBER_FIELDS,
  DEFAULT_INTERVENTION_CATALOG,
  REPORT_TEMPLATE_VERSION,
  SLOT_BY_KEY,
  computeMissingKeys,
  mergeMemberReportData,
  resolveSlotValues,
  type FamilySnapshot,
  type HouseholdContext,
  type InterventionCatalogRow,
  type ReportDraftLike,
  type SlotSource,
  type SlotValues,
} from '../_shared/report-template.ts';

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

function asStringRecord(value: unknown): Record<string, string> {
  const row = asContent(value);
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(row)) {
    if (typeof entry === 'string') out[key] = entry;
  }
  return out;
}

function slotSource(value: unknown): SlotSource | undefined {
  return value === 'derived' || value === 'computed' || value === 'manual' || value === 'setting'
    ? value
    : undefined;
}

/**
 * Keeps only well-formed entries keyed by a known slot; an override without a
 * reason is demoted to a plain value (REQ-RPT-007 is enforced on the server,
 * not just in the editor). Raw import data is never accepted here.
 */
function sanitizeSlots(value: unknown): SlotValues {
  const incoming = asContent(value);
  const out: SlotValues = {};
  for (const [key, entry] of Object.entries(incoming)) {
    const def = SLOT_BY_KEY[key];
    if (!def) continue;
    const slot = asContent(entry);
    if (typeof slot.value !== 'string') continue;
    const reason = typeof slot.reason === 'string' ? slot.reason.trim() : '';
    const overridden = slot.overridden === true && reason !== '';
    out[key] = {
      value: slot.value,
      source: slotSource(slot.source) ?? def.source,
      overridden,
      original: overridden && typeof slot.original === 'string' ? slot.original : null,
      reason: overridden ? reason : undefined,
      at: typeof slot.at === 'string' ? slot.at : undefined,
    };
  }
  return out;
}

/**
 * Workbook columns snapshotted onto a family row: only these keys are stored,
 * so a client cannot write arbitrary data into the raw-import mirror.
 */
function pickMemberData(value: unknown): Record<string, string> {
  const row = asContent(value);
  const out: Record<string, string> = {};
  for (const field of CAR_MEMBER_FIELDS) {
    const entry = row[field];
    if (typeof entry === 'string' && entry.trim() !== '') out[field] = entry;
    else if (typeof entry === 'number' && Number.isFinite(entry)) out[field] = String(entry);
  }
  return out;
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

/** Legacy drafts (written before `content.slots` existed) keep the old checks. */
function legacyMissingFields(content: Content): string[] {
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

/** The derivation's view of `content` (mirrors the client's CarDraft shape). */
function draftLike(content: Content, granteeMemberId: string): ReportDraftLike {
  return {
    hhId: str(content, 'hhId'),
    datePrepared: str(content, 'datePrepared'),
    granteeMemberId,
    slots: sanitizeSlots(content.slots),
    familyComposition: asArray(content.familyComposition).map((value) => {
      const row = asContent(value);
      return {
        id: str(row, 'id'),
        name: str(row, 'name'),
        relationship: str(row, 'relationship'),
        age: row.age === null || row.age === undefined ? null : num(row.age, 0),
        sourceRow: num(row.sourceRow, 0),
        include: row.include === true,
        data: asStringRecord(row.data),
      } satisfies FamilySnapshot;
    }),
    interventions: asArray(content.interventions).map((value) => {
      const row = asContent(value);
      return {
        included: row.included === undefined ? true : row.included === true,
        need: str(row, 'need') || str(row, 'type'),
        type: str(row, 'type'),
      };
    }),
  };
}

/**
 * Completeness for `missing_fields`.
 *
 * Slot-aware drafts run the exact same `resolveSlotValues` + `computeMissingKeys`
 * the editor runs (shared module), so the saved gaps can never drift from the
 * checklist the case worker sees. Drafts without `content.slots` fall back to
 * the legacy narrative checks until first saved by the new editor.
 */
function missingFields(
  content: Content,
  granteeMemberId = '',
  household: HouseholdContext = null,
): string[] {
  const hasSlots =
    content.slots !== undefined &&
    content.slots !== null &&
    typeof content.slots === 'object' &&
    !Array.isArray(content.slots);
  if (!hasSlots) return legacyMissingFields(content);

  const draft = draftLike(content, granteeMemberId);
  const values = resolveSlotValues(draft, household, null);
  return computeMissingKeys({
    slots: values,
    familyIncluded: (draft.familyComposition ?? []).filter((member) => member.include).length,
    interventions: draft.interventions ?? [],
  });
}

/**
 * Barangay/municipality fallback, mirroring the households register: the first
 * member row that carries them (households/index.ts listHouseholds). New CARs
 * answer from the `data` snapshots; legacy rows fall back to the import rows.
 */
function scanPlace(content: Content): HouseholdContext {
  const rows = asArray(content.familyComposition).map((value) =>
    asStringRecord(asContent(value).data),
  );
  for (const data of rows) {
    const barangay = data.BARANGAY ?? '';
    const municipality = data.MUNICIPALITY ?? '';
    if (barangay.trim() || municipality.trim()) return { barangay, municipality };
  }
  return null;
}

/** Only queried for legacy content whose family rows predate the data snapshot. */
async function loadPlace(supabase: any, householdId: string, content: Content): Promise<HouseholdContext> {
  const scanned = scanPlace(content);
  if (scanned || !householdId) return scanned;
  const { data, error: queryError } = await supabase
    .from('household_members')
    .select('import_rows:import_row_id ( normalized )')
    .eq('household_id', householdId);
  if (queryError) throw queryError;
  for (const member of Array.isArray(data) ? data : []) {
    const normalized = (member?.import_rows?.normalized ?? null) as Record<string, unknown> | null;
    if (!normalized) continue;
    const barangay = text(normalized.BARANGAY);
    const municipality = text(normalized.MUNICIPALITY);
    if (barangay.trim() || municipality.trim()) return { barangay, municipality };
  }
  return null;
}

function mapIntervention(value: unknown): Content {
  const row = asContent(value);
  // Legacy rows store only {type, details}; new rows carry the full shape.
  const need = str(row, 'need') || str(row, 'type');
  const activities = str(row, 'activities') || str(row, 'details');
  return {
    id: str(row, 'id') || `intervention-${crypto.randomUUID()}`,
    type: need,
    details: activities,
    catalogId: str(row, 'catalogId'),
    custom: row.custom === true,
    included: row.included === undefined ? true : row.included === true,
    need,
    objective: str(row, 'objective'),
    activities,
    responsible: str(row, 'responsible'),
    timeline: str(row, 'timeline'),
    remarks: str(row, 'remarks'),
    values: asStringRecord(row.values),
  };
}

function mapFamilyMember(value: unknown): Content {
  const row = asContent(value);
  return {
    id: str(row, 'id'),
    entryId: str(row, 'entryId'),
    name: str(row, 'name'),
    relationship: str(row, 'relationship'),
    age: row.age === null || row.age === undefined ? null : num(row.age, 0),
    sourceRow: num(row.sourceRow, 0),
    include: row.include === true,
    granteeFlag: str(row, 'granteeFlag'),
    // Raw-import mirror: only known workbook columns, never client-invented keys.
    data: pickMemberData(row.data),
    overlay: asStringRecord(row.overlay),
  };
}

/** Standard catalog rows a new CAR starts with (mirrors the client's
 *  `defaultInterventions()`; admin-maintained catalog arrives in R4). */
function defaultInterventions(): Content[] {
  return DEFAULT_INTERVENTION_CATALOG.map((row: InterventionCatalogRow) => ({
    id: `intervention-${row.id}-${crypto.randomUUID().slice(0, 8)}`,
    catalogId: row.id,
    type: row.need,
    details: row.activities,
    custom: false,
    included: true,
    need: row.need,
    objective: row.objective,
    activities: row.activities,
    responsible: row.responsible,
    timeline: row.timeline,
    remarks: row.remarks,
    values: {},
  }));
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
    slots: sanitizeSlots(content.slots),
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

  const assessments = data ?? [];
  const memberIds = [
    ...new Set(
      assessments.flatMap((assessment: Record<string, unknown>) =>
        asArray(asContent(assessment.content).familyComposition)
          .map((member) => str(asContent(member), 'id'))
          .filter(Boolean),
      ),
    ),
  ];
  if (memberIds.length === 0) return json({ cars: assessments.map(mapCar) });

  const { data: sourceMembers, error: membersError } = await supabase
    .from('household_members')
    .select('id, import_rows:import_row_id ( normalized )')
    .in('id', memberIds);
  if (membersError) throw membersError;

  const currentDataByMember = new Map<string, Record<string, string>>();
  for (const source of sourceMembers ?? []) {
    const normalized = asContent(asContent(source.import_rows).normalized);
    currentDataByMember.set(text(source.id), pickMemberData(normalized));
  }

  const cars = assessments.map((assessment: Record<string, unknown>) => {
    const content = asContent(assessment.content);
    const familyComposition = asArray(content.familyComposition).map((value) => {
      const member = asContent(value);
      const currentData = currentDataByMember.get(str(member, 'id'));
      if (!currentData) return member;
      return {
        ...member,
        data: mergeMemberReportData(asContent(member.data), currentData),
      };
    });
    return mapCar({ ...assessment, content: { ...content, familyComposition } });
  });
  return json({ cars });
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
        // Snapshot of the workbook columns the report reads (CAR_MEMBER_FIELDS)
        // so the CAR renders without re-reading the import; the import row
        // itself is never written to (REQ-RPT-007).
        data: pickMemberData(normalized),
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
    // Built-in versioned template (the only template with a definition today).
    templateVersion: REPORT_TEMPLATE_VERSION,
    datePrepared: '',
    presentingProblem: '',
    backgroundInformation: '',
    assessment: '',
    recommendation: '',
    // Slot values: only user edits/overrides live here; derived, computed and
    // setting slots are re-resolved on every read by both client and server.
    slots: {},
    familyComposition: members.map((member) => ({ ...member, include: true })),
    interventions: defaultInterventions(),
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
      missing_fields: missingFields(content, grantee.id, scanPlace(content)),
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
    if (!Array.isArray(incoming[key])) continue;
    // Whitelisted mapping: only known fields survive the round-trip.
    content[key] =
      key === 'familyComposition'
        ? incoming[key].map(mapFamilyMember)
        : key === 'interventions'
          ? incoming[key].map(mapIntervention)
          : incoming[key].map(mapHistoryEntry);
  }
  // Slot values are sanitized against the template registry (unknown keys and
  // reason-less overrides are dropped server-side).
  if (incoming.slots !== undefined) content.slots = sanitizeSlots(incoming.slots);

  const household = await loadPlace(supabase, text(existing.household_id), content);
  const { data, error: updateError } = await supabase
    .from('case_assessments')
    .update({
      content,
      missing_fields: missingFields(content, text(existing.grantee_member_id), household),
    })
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
      missing_fields: missingFields(
        content,
        text(existing.grantee_member_id),
        await loadPlace(supabase, text(existing.household_id), content),
      ),
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
