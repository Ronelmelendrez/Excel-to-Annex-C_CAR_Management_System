import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "../../../app/providers";
import { HouseholdsPage } from "../components/HouseholdsPage";
import { HouseholdList } from "../components/HouseholdList";
import { HouseholdMembersTable } from "../components/HouseholdMembersTable";
import type { HouseholdRecord } from "../types";
import { asHousehold } from "../api";
import { mockHouseholds } from "./fixtures";
import { serverDataCache } from "../../../shared/server-data-cache";

const { getHouseholdRegisterStats, listHouseholds } = vi.hoisted(() => ({
  getHouseholdRegisterStats: vi.fn(),
  listHouseholds: vi.fn(),
}));

vi.mock("../../../app/providers", () => ({
  useAuth: vi.fn(),
}));
vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return { ...actual, getHouseholdRegisterStats, listHouseholds };
});

function authFor(roles: string[], userId = "worker") {
  return {
    session: {},
    user: { id: userId, email: `${userId}@example.test` },
    profile: { id: userId, display_name: "Case worker", status: "active" as const },
    roles,
    loading: false,
    signIn: async () => ({}),
    signOut: async () => {},
  };
}

describe("F4 household register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverDataCache.clear();
    vi.mocked(useAuth).mockReturnValue(authFor(["case_worker"]));
    getHouseholdRegisterStats.mockResolvedValue({
      householdCount: mockHouseholds.length,
      memberCount: mockHouseholds.reduce((count, item) => count + item.members.length, 0),
      granteeCount: 1,
      needsReviewCount: 4,
    });
    listHouseholds.mockImplementation((hhId?: string) => {
      const households = hhId
        ? mockHouseholds.filter((item) => item.hhId === hhId)
        : mockHouseholds;
      return Promise.resolve({ households, total: households.length });
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows loaded household records and grantee validation states", async () => {
    render(<HouseholdsPage />);

    expect(await screen.findByText("Supabase household records")).toBeTruthy();
    expect(screen.getAllByText("Multiple Yes flags").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Grantee OK").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Blank flag").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Unsupported value").length).toBeGreaterThan(0);
    expect(screen.getAllByText("No Yes flag").length).toBeGreaterThan(0);
    expect(screen.getByText("Row 21")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /HH_ID 000091/ }));
    expect(screen.getByRole("heading", { name: "HH_ID 000091" })).toBeTruthy();
    expect(screen.getByText("Jomar Ramos · source row 44")).toBeTruthy();
  });

  it("keeps local-only household corrections disabled", async () => {
    render(<HouseholdsPage />);
    expect(await screen.findByText(/corrections and member exclusions are paused/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Resolve grantee" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Exclude member/ })).toBeNull();
  });

  it("reuses the user-scoped in-memory household data when returning to the page", async () => {
    const firstRender = render(<HouseholdsPage />);
    expect(await screen.findByRole("button", { name: /HH_ID 000091/ })).toBeTruthy();
    expect(listHouseholds).toHaveBeenCalledTimes(1);
    expect(getHouseholdRegisterStats).toHaveBeenCalledTimes(1);
    firstRender.unmount();

    render(<HouseholdsPage />);

    expect(screen.getByRole("button", { name: /HH_ID 000091/ })).toBeTruthy();
    expect(listHouseholds).toHaveBeenCalledTimes(1);
    expect(getHouseholdRegisterStats).toHaveBeenCalledTimes(1);
  });

  it("does not show one user's cached household data to another user", async () => {
    const view = render(<HouseholdsPage />);
    expect(await screen.findByRole("button", { name: /HH_ID 000091/ })).toBeTruthy();

    listHouseholds.mockRejectedValueOnce(new Error("network unavailable"));
    vi.mocked(useAuth).mockReturnValue(authFor(["case_worker"], "worker-2"));
    view.rerender(<HouseholdsPage />);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "The household register could not be loaded.",
    );
    expect(screen.queryByRole("button", { name: /HH_ID 000091/ })).toBeNull();
  });

  it("filters by household ID and provides a useful no-results state", async () => {
    render(<HouseholdsPage />);
    const search = await screen.findByRole("searchbox", { name: "Search households" });

    fireEvent.change(search, { target: { value: "000091" } });
    expect(await screen.findByRole("heading", { name: "HH_ID 000091" })).toBeTruthy();
    expect(screen.getByText(/Showing 1 of 5/)).toBeTruthy();

    fireEvent.change(search, { target: { value: "not-in-the-register" } });
    expect(await screen.findByText("No households match those filters.")).toBeTruthy();
    expect(screen.getByText("Select a household")).toBeTruthy();
  });

  it("preserves and renders a long HH_ID from an uppercase import-shaped response", () => {
    const household = asHousehold({
      id: "hh-long-id",
      HH_ID: "700007993656",
      members: [],
    });

    expect(household?.hhId).toBe("700007993656");
    render(
      <HouseholdList
        items={household ? [{ household, status: "valid" }] : []}
        total={1}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /HH_ID 700007993656/ })).toBeTruthy();
  });

  it("shows a clear access denial without household details for unrecognized roles", () => {
    vi.mocked(useAuth).mockReturnValue(authFor(["unassigned"]));

    render(<HouseholdsPage />);

    expect(screen.getByRole("alert").textContent).toContain("You do not have access");
    expect(screen.queryByText("HH_ID 000083")).toBeNull();
  });

  it("shows every imported Excel column for a member source row", () => {
    const household: HouseholdRecord = {
      id: "hh-live",
      hhId: "000777",
      barangay: "Bagong Silang",
      municipality: "Roxas City",
      importName: "annex-c-44-columns.xlsx",
      importVersion: 1,
      headers: ["HH_ID", "LRN", "PCN_REMARKS"],
      members: [
        {
          id: "m-live-1",
          entryId: "E-1",
          name: "Ana Reyes",
          relationship: "Household head",
          age: 33,
          granteeFlag: "Yes",
          sourceRow: 7,
          raw: ["000777", "LRN-998877", null],
        },
      ],
      car: null,
    };

    render(
      <HouseholdMembersTable
        household={household}
        overlay={undefined}
        granteeId="m-live-1"
        canCorrect={false}
        excludeMemberId={null}
        exclusionReason=""
        onStartExclusion={vi.fn()}
        onReasonChange={vi.fn()}
        onSaveExclusion={vi.fn()}
        onCancelExclusion={vi.fn()}
        onRestoreMember={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Columns" }));

    expect(screen.getByText("Excel row 7 · every column as imported")).toBeTruthy();
    expect(screen.getByText("HH_ID")).toBeTruthy();
    expect(screen.getByText("000777")).toBeTruthy();
    expect(screen.getByText("LRN-998877")).toBeTruthy();
    // Blank cells render as an em dash rather than an empty value.
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hide columns" })).toBeTruthy();
  });
});
