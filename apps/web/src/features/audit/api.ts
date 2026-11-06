import { apiCall } from "../../shared/api";
import { isDemoMode } from "../../shared/supabase";
import type { AuditEvent, AuditEventPage, AuditFilters } from "./types";

export const AUDIT_PAGE_SIZE = 50;

function isAuditEvent(value: unknown): value is AuditEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event.id === "string" &&
    (typeof event.actorId === "string" || event.actorId === null) &&
    typeof event.action === "string" &&
    typeof event.entityType === "string" &&
    (typeof event.entityId === "string" || event.entityId === null) &&
    typeof event.occurredAt === "string" &&
    Number.isFinite(Date.parse(event.occurredAt))
  );
}

export async function fetchAuditEvents(
  filters: AuditFilters,
  offset: number,
  signal?: AbortSignal,
): Promise<AuditEventPage> {
  if (isDemoMode) {
    throw new Error("Connect Supabase to view persisted audit records. Sample audit data is disabled.");
  }

  const query = new URLSearchParams({
    action: "list",
    limit: String(AUDIT_PAGE_SIZE),
    offset: String(offset),
  });
  if (filters.search.trim()) query.set("search", filters.search.trim());
  if (filters.actor.trim()) query.set("actor_id", filters.actor.trim());
  if (filters.entityType !== "all") query.set("entity_type", filters.entityType);
  if (filters.dateFrom) query.set("date_from", filters.dateFrom);
  if (filters.dateTo) query.set("date_to", filters.dateTo);

  const data = (await apiCall(`/audit?${query.toString()}`, { signal })) as
    | Partial<AuditEventPage>
    | null;
  if (
    !data ||
    !Array.isArray(data.events) ||
    !data.events.every(isAuditEvent) ||
    !Number.isSafeInteger(data.total) ||
    (data.total ?? -1) < 0 ||
    data.limit !== AUDIT_PAGE_SIZE ||
    data.offset !== offset
  ) {
    throw new Error("Audit records response is invalid.");
  }

  return {
    events: data.events,
    total: data.total!,
    limit: data.limit,
    offset: data.offset,
  };
}
