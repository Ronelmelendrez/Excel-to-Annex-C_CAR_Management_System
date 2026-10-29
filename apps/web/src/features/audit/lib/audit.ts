import type { AuditEntityType, AuditEvent, AuditFilters } from "../types";

export const auditEntityLabels: Record<AuditEntityType, string> = {
  import: "Import",
  household: "Household",
  car: "CAR",
  template: "Template",
  export: "Export",
  role: "Role",
};

export function filterAuditEvents(events: AuditEvent[], filters: AuditFilters): AuditEvent[] {
  const search = filters.search.trim().toLocaleLowerCase();

  return events
    .filter((event) => {
      const matchesSearch =
        !search ||
        [event.action, event.summary, event.actorId, event.entityId]
          .some((value) => value.toLocaleLowerCase().includes(search));
      const matchesActor = filters.actor === "all" || event.actorId === filters.actor;
      const matchesEntity =
        filters.entityType === "all" || event.entityType === filters.entityType;
      const eventDate = event.occurredAt.slice(0, 10);
      const matchesStart = !filters.dateFrom || eventDate >= filters.dateFrom;
      const matchesEnd = !filters.dateTo || eventDate <= filters.dateTo;

      return matchesSearch && matchesActor && matchesEntity && matchesStart && matchesEnd;
    })
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
}

export function getAuditActors(events: AuditEvent[]): string[] {
  return [...new Set(events.map((event) => event.actorId))].sort();
}

export function formatAuditTimestamp(value: string): string {
  return `${new Date(value).toLocaleString(undefined, { timeZone: "UTC" })} UTC`;
}
