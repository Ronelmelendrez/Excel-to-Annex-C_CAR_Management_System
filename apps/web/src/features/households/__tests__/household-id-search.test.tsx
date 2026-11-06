import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HouseholdsPage } from "../components/HouseholdsPage";
import { serverDataCache } from "../../../shared/server-data-cache";

const { getHouseholdRegisterStats, listHouseholds } = vi.hoisted(() => ({
  getHouseholdRegisterStats: vi.fn(),
  listHouseholds: vi.fn(),
}));

vi.mock("../../../shared/supabase", () => ({ isSupabaseConfigured: true }));
vi.mock("../api", () => ({
  getHouseholdRegisterStats,
  listHouseholds,
  householdListError: () => "Could not load households.",
}));
vi.mock("../../../app/providers", () => ({
  useAuth: () => ({
    user: { id: "worker", email: "worker@example.test" },
    profile: { display_name: "Case worker" },
    roles: ["case_worker"],
  }),
}));

const household = {
  id: "household-700007993656",
  hhId: "700007993656",
  barangay: "Test Barangay",
  municipality: "Test Municipality",
  importName: "households.xlsx",
  importVersion: 1,
  members: [],
  car: null,
};

describe("household ID search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverDataCache.clear();
    getHouseholdRegisterStats.mockResolvedValue({
      householdCount: 1758,
      memberCount: 6200,
      granteeCount: 1740,
      needsReviewCount: 18,
    });
    listHouseholds.mockImplementation((hhId?: string) =>
      Promise.resolve({
        households: hhId === household.hhId ? [household] : [],
        total: hhId === household.hhId ? 1 : 0,
      }),
    );
  });

  it("looks up and lists an HH_ID beyond the initially loaded register", async () => {
    render(<HouseholdsPage />);

    expect(await screen.findByText("1758")).toBeTruthy();
    expect(screen.getByText("6200")).toBeTruthy();
    expect(screen.getByText("1740")).toBeTruthy();
    expect(screen.getByText("18")).toBeTruthy();
    expect(getHouseholdRegisterStats).toHaveBeenCalled();

    const search = await screen.findByRole("searchbox", { name: "Search households" });
    fireEvent.change(search, { target: { value: "700007993656" } });

    expect(await screen.findByRole("button", { name: /HH_ID 700007993656/ })).toBeTruthy();
    expect(listHouseholds).toHaveBeenCalledWith("700007993656");
  });
});
