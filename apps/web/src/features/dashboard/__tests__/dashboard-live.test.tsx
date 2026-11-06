import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "../components/DashboardPage";
import { serverDataCache } from "../../../shared/server-data-cache";

const { fetchDashboardSummary } = vi.hoisted(() => ({
  fetchDashboardSummary: vi.fn(),
}));

vi.mock("../../../shared/supabase", () => ({ isSupabaseConfigured: true }));
vi.mock("../../../app/providers", () => ({
  useAuth: () => ({ roles: ["case_worker"], user: { id: "dashboard-worker" } }),
}));
vi.mock("../api", () => ({ fetchDashboardSummary }));

describe("live dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverDataCache.clear();
    fetchDashboardSummary.mockResolvedValue({
      scope: "assigned",
      scopeLabel: "Assigned staff live data",
      importsCommitted: 7,
      rowsProcessed: 5200,
      householdsDetected: 1600,
      granteeIssues: 42,
      awaitingReview: 3,
      exportFailures: 1,
      carPipeline: { draft: 5, submitted: 3, changes_requested: 2, approved: 10 },
      importTrend: [{ label: "Nov 2", value: 500 }],
      recentActivity: [],
    });
  });

  it("renders live Supabase metrics instead of sample dashboard data", async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Your assigned work")).toBeTruthy();
    expect(screen.getByText("Updates automatically every 15 seconds")).toBeTruthy();
    expect(screen.getByText("5,200")).toBeTruthy();
    expect(screen.getByText("1,600")).toBeTruthy();
    expect(screen.queryByText(/Mock aggregates|Sample figures only|October 2026 sample/)).toBeNull();
    expect(fetchDashboardSummary).toHaveBeenCalledWith("assigned");
  });

  it("shows cached metrics immediately when returning to the dashboard", async () => {
    const firstView = render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Your assigned work")).toBeTruthy();
    expect(fetchDashboardSummary).toHaveBeenCalledTimes(1);
    firstView.unmount();

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("5,200")).toBeTruthy();
    expect(fetchDashboardSummary).toHaveBeenCalledTimes(1);
  });
});
