import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "../../../app/providers";
import { DashboardPage } from "../components/DashboardPage";
import { getDashboardSummary } from "../lib/dashboard";

vi.mock("../../../app/providers", () => ({
  useAuth: vi.fn(),
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
  });

  afterEach(() => {
    cleanup();
  });

  it("calculates staff metrics only from the assigned mock scope", () => {
    const summary = getDashboardSummary("assigned");

    expect(summary.importsCommitted).toBe(2);
    expect(summary.rowsProcessed).toBe(618);
    expect(summary.householdsDetected).toBe(191);
    expect(summary.granteeIssues).toBe(12);
    expect(summary.awaitingReview).toBe(2);
    expect(summary.exportFailures).toBe(1);
    expect(summary.carPipeline).toEqual({
      draft: 3,
      submitted: 2,
      changes_requested: 1,
      approved: 5,
    });
  });

  it("shows staff-safe metrics, trend, pipeline, definitions, and anonymous activity", () => {
    const { container } = renderDashboard();
    const dashboardText = container.textContent ?? "";

    expect(screen.getByRole("heading", { name: "Operations at a glance" })).toBeTruthy();
    expect(dashboardText).toContain("Assigned staff sample");
    expect(dashboardText).toContain("Rows processed");
    expect(dashboardText).toContain("618");
    expect(dashboardText).toContain("Grantee issues");
    expect(dashboardText).toContain("12");
    expect(dashboardText).toContain("Export failures");
    expect(dashboardText).toContain("CAR pipeline");
    expect(dashboardText).toContain("Recent activity");
    expect(screen.getByRole("img", { name: /Oct 5-11: 258 rows; Oct 12-18: 360 rows/ })).toBeTruthy();

    fireEvent.click(screen.getAllByText("Definition")[0]);
    expect(screen.getByText(/Sum of source rows in committed import batches/)).toBeTruthy();

    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/LRN|PCN|pregnancy|disability|CAR-2026-\d+/i);
    expect(text).not.toContain("Demo staff");
    expect(text).not.toContain("staff@example.test");
  }, 15000);

  it("aggregates the wider mock system scope for admins", () => {
    vi.mocked(useAuth).mockReturnValue(authFor(["admin"]));
    const { container } = renderDashboard();
    const dashboardText = container.textContent ?? "";

    expect(dashboardText).toContain("System-wide sample");
    expect(dashboardText).toContain("Imports committed");
    expect(dashboardText).toContain("1,036");
    expect(dashboardText).toContain("Households detected");
    expect(dashboardText).toContain("321");
    expect(dashboardText).toContain("Grantee issues");
    expect(dashboardText).toContain("21");
    expect(dashboardText).toContain("Awaiting CAR review");
    expect(dashboardText).toContain("4");
    expect(dashboardText).toContain("Export failures");
    expect(dashboardText).toContain("2");
  });

  it("does not display metrics for an unrecognized role", () => {
    vi.mocked(useAuth).mockReturnValue(authFor(["guest"]));
    renderDashboard();

    expect(screen.getByRole("alert").textContent).toContain("You do not have access");
    expect(screen.queryByRole("region", { name: "Rows processed" })).toBeNull();
    expect(screen.queryByText("1,036")).toBeNull();
  });
});
