import { apiCall } from "../../shared/api";
import { isDemoMode } from "../../shared/supabase";
import { getDashboardSummary } from "./lib/dashboard";
import type { DashboardScope, DashboardSummary } from "./types";

export async function fetchDashboardSummary(scope: DashboardScope): Promise<DashboardSummary> {
  if (isDemoMode) return getDashboardSummary(scope);

  const data = (await apiCall(
    `/dashboard?action=summary&scope=${encodeURIComponent(scope)}`,
  )) as Partial<DashboardSummary>;
  const pipelineStatuses = ["draft", "submitted", "changes_requested", "approved"] as const;
  if (
    !data ||
    data.scope !== scope ||
    !data.scopeLabel ||
    ![
      data.importsCommitted,
      data.rowsProcessed,
      data.householdsDetected,
      data.granteeIssues,
      data.awaitingReview,
      data.exportFailures,
    ].every((value) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0) ||
    !data.carPipeline ||
    !pipelineStatuses.every(
      (status) =>
        typeof data.carPipeline?.[status] === "number" &&
        Number.isSafeInteger(data.carPipeline[status]) &&
        data.carPipeline[status] >= 0,
    ) ||
    !Array.isArray(data.importTrend) ||
    !Array.isArray(data.recentActivity)
  ) {
    throw new Error("Dashboard summary response is invalid.");
  }
  return data as DashboardSummary;
}
