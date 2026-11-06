import type { AuditEntityType } from "../types";

export const auditEntityLabels: Record<string, string> = {
  case_assessments: "Case assessments",
  export_jobs: "Export jobs",
  households: "Households",
  imports: "Imports",
  system_settings: "System settings",
  templates: "Templates",
  user_roles: "User roles",
};

export function formatAuditEntityType(value: AuditEntityType): string {
  return (
    auditEntityLabels[value] ??
    value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

export function formatAuditAction(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatAuditTimestamp(value: string): string {
  return `${new Date(value).toLocaleString(undefined, { timeZone: "UTC" })} UTC`;
}
