import { verifyJwt } from '../_shared/auth.ts';
import { hasActiveRole } from '../_shared/rbac.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { json, error, preflight, handleError } from '../_shared/http.ts';

/** Roles that may read the household register (mirrors the page's canView). */
const VIEW_ROLES = ['admin', 'operator', 'case_worker', 'reviewer', 'auditor'];
const MAX_HOUSEHOLDS = 1000;

function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
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

function carReference(assessment: Record<string, unknown>): string {
  const content = assessment.content as Record<string, unknown> | null;
  const explicit = content && typeof content.reference === 'string' ? content.reference.trim() : '';
  if (explicit) return explicit;
  return `CAR-${text(assessment.case_group_id).slice(0, 8).toUpperCase()}`;
}

async function listHouseholds(supabase: any) {
  const { data, error: queryError, count } = await supabase
    .from('households')
    .select(
      `id, hh_id,
       imports:import_id ( file_name, version, validation_summary ),
       household_members (
         id, entry_id, is_grantee_flag_raw, raw,
         import_rows:import_row_id ( source_row_no, normalized )
       ),
       case_assessments ( id, status, revision, case_group_id, content, created_at )`,
      { count: 'exact' },
    )
    .order('hh_id', { ascending: true })
    .limit(MAX_HOUSEHOLDS);
  if (queryError) throw queryError;

  const households = (data ?? []).map((row: any) => {
    const rows = (row.household_members ?? []) as any[];

    // The import's header row, in file order: member.raw[i] is the value the
    // operator typed under headers[i] — the household record shows exactly
    // what the Excel row contained, column for column.
    const validationSummary = row.imports?.validation_summary as
      | { headers?: unknown }
      | null
      | undefined;
    const headers = Array.isArray(validationSummary?.headers)
      ? (validationSummary!.headers as unknown[]).map((header) => text(header))
      : [];

    const members = rows
      .map((member) => {
        const normalized = (member.import_rows?.normalized ?? null) as Record<string, unknown> | null;
        const raw = Array.isArray(member.raw)
          ? (member.raw as unknown[]).map((cell) => (cell == null ? null : text(cell)))
          : [];
        return {
          id: text(member.id),
          entryId: text(member.entry_id),
          name: composeName(normalized),
          relationship: text(normalized?.RELATION_TO_HH_HEAD),
          age: parseAge(normalized?.AGE),
          granteeFlag: text(member.is_grantee_flag_raw ?? normalized?.GRANTEE),
          sourceRow: Number(member.import_rows?.source_row_no ?? 0),
          raw,
        };
      })
      .filter((member) => member.id)
      .sort((a, b) => a.sourceRow - b.sourceRow);

    // Barangay/municipality live on the source row; take the first member that has them.
    const place = rows
      .map((member) => (member.import_rows?.normalized ?? null) as Record<string, unknown> | null)
      .find((normalized) => normalized && (text(normalized.BARANGAY).trim() || text(normalized.MUNICIPALITY).trim()));

    const assessments = [...((row.case_assessments ?? []) as any[])].sort((a, b) => {
      const byRevision = Number(b.revision ?? 0) - Number(a.revision ?? 0);
      return byRevision !== 0 ? byRevision : text(b.created_at).localeCompare(text(a.created_at));
    });
    const latest = assessments[0];

    return {
      id: text(row.id),
      hhId: text(row.hh_id),
      barangay: text(place?.BARANGAY),
      municipality: text(place?.MUNICIPALITY),
      importName: text(row.imports?.file_name) || 'workbook.xlsx',
      importVersion: Number(row.imports?.version ?? 1) || 1,
      headers,
      members,
      car: latest
        ? { reference: carReference(latest), status: text(latest.status) || 'draft' }
        : null,
    };
  });

  return json({ households, total: count ?? households.length });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();

  try {
    const user = await verifyJwt(req);
    const allowed = await hasActiveRole(user.id, VIEW_ROLES);
    if (!allowed) throw new Error('forbidden');

    if (req.method !== 'GET') return error(405, 'method_not_allowed');

    const url = new URL(req.url);
    const action = url.searchParams.get('action') ?? 'list';
    if (action === 'list') return await listHouseholds(getServiceClient());
    return error(404, 'not_found');
  } catch (e) {
    return handleError(e);
  }
});
