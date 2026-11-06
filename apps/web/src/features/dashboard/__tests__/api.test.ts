import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchDashboardSummary } from "../api";

const { apiCall } = vi.hoisted(() => ({ apiCall: vi.fn() }));

vi.mock("../../../shared/supabase", () => ({ isSupabaseConfigured: true }));
vi.mock("../../../shared/api", () => ({ apiCall }));

const summary = {
  scope: "assigned",
  scopeLabel: "Assigned staff live data",
  importsCommitted: 10,
  rowsProcessed: 2500,
  householdsDetected: 800,
  granteeIssues: 20,
  awaitingReview: 6,
  exportFailures: 1,
  carPipeline: { draft: 12, submitted: 6, changes_requested: 3, approved: 25 },
  importTrend: [{ label: "Nov 2", value: 100 }],
  recentActivity: [],
};

describe("dashboard live summary API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests and returns live summary for the requested scope", async () => {
    apiCall.mockResolvedValue(summary);

    await expect(fetchDashboardSummary("assigned")).resolves.toEqual(summary);
    expect(apiCall).toHaveBeenCalledWith("/dashboard?action=summary&scope=assigned");
  });

  it("rejects malformed or mismatched server metrics", async () => {
    apiCall.mockResolvedValueOnce({ ...summary, scope: "system" });
    await expect(fetchDashboardSummary("assigned")).rejects.toThrow(
      "Dashboard summary response is invalid.",
    );

    apiCall.mockResolvedValueOnce({
      ...summary,
      carPipeline: { ...summary.carPipeline, draft: -1 },
    });
    await expect(fetchDashboardSummary("assigned")).rejects.toThrow(
      "Dashboard summary response is invalid.",
    );
  });
});
