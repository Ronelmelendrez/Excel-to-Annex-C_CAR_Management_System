export type AuditEntityType = string;

export type AuditEvent = {
  id: string;
  actorId: string | null;
  action: string;
  entityType: AuditEntityType;
  entityId: string | null;
  occurredAt: string;
};

export type AuditFilters = {
  search: string;
  actor: string;
  entityType: AuditEntityType | "all";
  dateFrom: string;
  dateTo: string;
};

export type AuditEntityFilter = AuditFilters["entityType"];

export type AuditEventPage = {
  events: AuditEvent[];
  total: number;
  limit: number;
  offset: number;
};
