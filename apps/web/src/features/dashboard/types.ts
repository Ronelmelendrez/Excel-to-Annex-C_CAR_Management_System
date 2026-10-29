export type DashboardScope = "assigned" | "system";
export type DashboardRole = "admin" | "operator" | "case_worker" | "reviewer" | "auditor";
export type DashboardImportStatus = "committed" | "failed";
export type DashboardCarStatus = "draft" | "submitted" | "changes_requested" | "approved";

export type DashboardImportRecord = {
  id: string;
  scope: DashboardScope;
  status: DashboardImportStatus;
  committedAt: string | null;
  weekLabel: string | null;
  processedRows: number;
  householdsDetected: number;
  granteeIssues: number;
};

export type DashboardCarStatusCount = {
  scope: DashboardScope;
  status: DashboardCarStatus;
  count: number;
};

export type DashboardExportJob = {
  id: string;
  scope: DashboardScope;
  status: "verified" | "failed";
  occurredAt: string;
};

export type DashboardActivity = {
  id: string;
  scope: DashboardScope;
  occurredAt: string;
  label: string;
  destination: "/imports" | "/households" | "/review" | "/documents";
};

export type DashboardMetric = {
  id: string;
  label: string;
  value: number;
  definition: string;
};

export type DashboardTrendPoint = {
  label: string;
  value: number;
};

export type DashboardSummary = {
  scope: DashboardScope;
  scopeLabel: string;
  importsCommitted: number;
  rowsProcessed: number;
  householdsDetected: number;
  granteeIssues: number;
  awaitingReview: number;
  exportFailures: number;
  carPipeline: Record<DashboardCarStatus, number>;
  importTrend: DashboardTrendPoint[];
  recentActivity: DashboardActivity[];
};
