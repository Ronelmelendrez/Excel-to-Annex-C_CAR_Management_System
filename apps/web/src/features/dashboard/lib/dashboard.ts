import {
  mockDashboardActivity,
  mockDashboardCarStatusCounts,
  mockDashboardExportJobs,
  mockDashboardImports,
} from "../mock-data";
import type { DashboardRole, DashboardScope, DashboardSummary } from "../types";

const dashboardRoles = new Set<string>([
  "admin",
  "operator",
  "case_worker",
  "reviewer",
  "auditor",
]);
const carStatuses = ["draft", "submitted", "changes_requested", "approved"] as const;

export function isDashboardRole(role: string): role is DashboardRole {
  return dashboardRoles.has(role);
}

export function getDashboardSummary(scope: DashboardScope): DashboardSummary {
  const includesScope = (recordScope: DashboardScope) =>
    scope === "system" || recordScope === "assigned";
  const committedImports = mockDashboardImports.filter(
    (record) => includesScope(record.scope) && record.status === "committed",
  );
  const carPipeline: DashboardSummary["carPipeline"] = {
    draft: 0,
    submitted: 0,
    changes_requested: 0,
    approved: 0,
  };

  for (const record of mockDashboardCarStatusCounts) {
    if (includesScope(record.scope)) {
      carPipeline[record.status] += record.count;
    }
  }

  const weeklyRows = new Map<string, number>();
  for (const record of committedImports) {
    if (!record.weekLabel) continue;
    weeklyRows.set(record.weekLabel, (weeklyRows.get(record.weekLabel) ?? 0) + record.processedRows);
  }

  return {
    scope,
    scopeLabel: scope === "system" ? "System-wide sample" : "Assigned staff sample",
    importsCommitted: committedImports.length,
    rowsProcessed: committedImports.reduce((total, record) => total + record.processedRows, 0),
    householdsDetected: committedImports.reduce(
      (total, record) => total + record.householdsDetected,
      0,
    ),
    granteeIssues: committedImports.reduce((total, record) => total + record.granteeIssues, 0),
    awaitingReview: carPipeline.submitted,
    exportFailures: mockDashboardExportJobs.filter(
      (record) => includesScope(record.scope) && record.status === "failed",
    ).length,
    carPipeline,
    importTrend: [...weeklyRows].map(([label, value]) => ({ label, value })),
    recentActivity: mockDashboardActivity
      .filter((record) => includesScope(record.scope))
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      .slice(0, 5),
  };
}
