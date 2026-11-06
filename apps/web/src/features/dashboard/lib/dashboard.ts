import type { DashboardRole } from "../types";

const dashboardRoles = new Set<string>([
  "admin",
  "operator",
  "case_worker",
  "reviewer",
  "auditor",
]);

export function isDashboardRole(role: string): role is DashboardRole {
  return dashboardRoles.has(role);
}
