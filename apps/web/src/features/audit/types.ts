export type AuditEntityType =
  | "import"
  | "household"
  | "car"
  | "template"
  | "export"
  | "role";

export type AuditOutcome = "success" | "failure" | "denied";

export type AuditEvent = {
  id: string;
  actorId: string;
  actorRole: string;
  action: string;
  entityType: AuditEntityType;
  entityId: string;
  occurredAt: string;
  outcome: AuditOutcome;
  summary: string;
  before: string | null;
  after: string | null;
};

export type AuditFilters = {
  search: string;
  actor: string;
  entityType: AuditEntityType | "all";
  dateFrom: string;
  dateTo: string;
};

export type AuditEntityFilter = AuditFilters["entityType"];
