import { verifyJwt } from '../_shared/auth.ts';
import { hasActiveRole } from '../_shared/rbac.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { error, handleError, HttpError, json, preflight } from '../_shared/http.ts';

const AUDIT_ROLES = ['admin', 'auditor'];
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const MAX_OFFSET = 100_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ENTITY_TYPE_PATTERN = /^[a-z][a-z0-9_]{0,40}$/;
const SEARCH_PATTERN = /^[a-z0-9 _.-]{1,80}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function dateParameter(value: string | null, name: string): string | null {
  if (value === null || value === '') return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    !DATE_PATTERN.test(value) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new HttpError(400, `invalid_${name}`);
  }
  return value;
}

function nextDay(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

async function listAuditRecords(supabase: any, url: URL) {
  const rawLimit = url.searchParams.get('limit');
  const rawOffset = url.searchParams.get('offset');
  const limit = rawLimit === null ? DEFAULT_PAGE_SIZE : Number(rawLimit);
  const offset = rawOffset === null ? 0 : Number(rawOffset);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new HttpError(400, 'invalid_limit');
  }
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > MAX_OFFSET) {
    throw new HttpError(400, 'invalid_offset');
  }

  const search = (url.searchParams.get('search') ?? '').trim();
  if (search && !SEARCH_PATTERN.test(search)) throw new HttpError(400, 'invalid_search');

  const actorId = url.searchParams.get('actor_id')?.trim() ?? '';
  if (actorId && !UUID_PATTERN.test(actorId)) throw new HttpError(400, 'invalid_actor_id');

  const entityType = url.searchParams.get('entity_type') ?? '';
  if (entityType && !ENTITY_TYPE_PATTERN.test(entityType)) {
    throw new HttpError(400, 'invalid_entity_type');
  }

  const dateFrom = dateParameter(url.searchParams.get('date_from'), 'date_from');
  const dateTo = dateParameter(url.searchParams.get('date_to'), 'date_to');
  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new HttpError(400, 'invalid_date_range');
  }

  let query = supabase
    .from('audit_logs')
    .select('id, actor_id, action, entity_type, entity_id, at', { count: 'exact' })
    .order('at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1);

  if (actorId) query = query.eq('actor_id', actorId);
  if (entityType) query = query.eq('entity_type', entityType);
  if (dateFrom) query = query.gte('at', `${dateFrom}T00:00:00.000Z`);
  if (dateTo) query = query.lt('at', nextDay(dateTo));
  if (search) query = query.or(`action.ilike.%${search}%,entity_id.ilike.%${search}%`);

  const { data, error: queryError, count } = await query;
  if (queryError) throw queryError;

  return json({
    events: (data ?? []).map((row: any) => ({
      id: row.id,
      actorId: row.actor_id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      occurredAt: row.at,
    })),
    total: count ?? 0,
    limit,
    offset,
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();

  try {
    const user = await verifyJwt(req);
    if (!(await hasActiveRole(user.id, AUDIT_ROLES))) throw new Error('forbidden');
    if (req.method !== 'GET') return error(405, 'method_not_allowed');

    const url = new URL(req.url);
    if (url.searchParams.get('action') !== 'list') throw new Error('not_found');
    return await listAuditRecords(getServiceClient(), url);
  } catch (e) {
    return handleError(e);
  }
});
