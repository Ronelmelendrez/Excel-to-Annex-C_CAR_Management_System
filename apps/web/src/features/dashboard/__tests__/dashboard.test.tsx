import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "../../../app/providers";
import { DashboardPage } from "../components/DashboardPage";

const { useDashboardSummary } = vi.hoisted(() => ({
  useDashboardSummary: vi.fn(),
}));

vi.mock("../../../app/providers", () => ({
  useAuth: vi.fn(),
}));
vi.mock("../hooks/useDashboardSummary", () => ({
  useDashboardSummary,
}));

function authFor(roles: string[]) {
  return {
    session: {},
    user: { id: "staff-01", email: "staff@example.test" },
    profile: { id: "staff-01", display_name: "Demo staff", status: "active" as const },
    roles,
    loading: false,
    signIn: async () => ({}),
    signOut: async () => {},
  };
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

describe("F9 dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue(authFor(["case_worker"]));
    useDashboardSummary.mockImplementation((scope: "assigned" | "system") => ({
      summary: {
        scope,
        scopeLabel: scope === "system" ? "Across the system" : "Your assigned work",
        importsCommitted: 2,
        rowsProcessed: 618,
        householdsDetected: 191,
        granteeIssues: 12,
        awaitingReview: 2,
        exportFailures: 1,
        carPipeline: { draft: 3, submitted: 2, changes_requested: 1, approved: 5 },
        importTrend: [
          { label: "Oct 5", value: 258 },
          { label: "Oct 12", value: 360 },
        ],
        recentActivity: [],
      },
      loading: false,
      error: null,
      reload: vi.fn(),
    }));
  });

  afterEach(() => {
    cleanup();
  });

  it("shows live metrics, trend, pipeline, definitions, and anonymous activity", () => {
    const { container } = renderDashboard();
    const dashboardText = container.textContent ?? "";

    expect(screen.getByRole("heading", { name: "Operations at a glance" })).toBeTruthy();
    expect(dashboardText).toContain("Your assigned work");
    expect(dashboardText).toContain("Updates automatically every 15 seconds");
    expect(dashboardText).toContain("Rows included");
    expect(dashboardText).toContain("618");
    expect(dashboardText).toContain("Households needing grantee review");
    expect(dashboardText).toContain("12");
    expect(dashboardText).toContain("Report generation issues");
    expect(dashboardText).toContain("CAR pipeline");
    expect(dashboardText).toContain("Recent activity");
    expect(
      screen.getByRole("img", {
        name: /Import activity\. Oct 5: 258 rows; Oct 12: 360 rows/,
      }),
    ).toBeTruthy();

    fireEvent.click(screen.getAllByText("Definition")[0]);
    expect(screen.getByText(/Number of spreadsheet rows included in completed imports/)).toBeTruthy();

    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/LRN|PCN|pregnancy|disability|CAR-2026-\d+/i);
    expect(text).not.toContain("Demo staff");
    expect(text).not.toContain("staff@example.test");
  }, 15000);

  it("uses the live dashboard scope for admins", () => {
    vi.mocked(useAuth).mockReturnValue(authFor(["admin"]));
    const { container } = renderDashboard();
    const dashboardText = container.textContent ?? "";

    expect(dashboardText).toContain("Across the system");
  });

  it("does not display metrics for an unrecognized role", () => {
    vi.mocked(useAuth).mockReturnValue(authFor(["guest"]));
    renderDashboard();

    expect(screen.getByRole("alert").textContent).toContain("You do not have access");
    expect(screen.queryByRole("region", { name: "Rows processed" })).toBeNull();
    expect(screen.queryByText("1,036")).toBeNull();
  });
});
