import { beforeEach, describe, expect, it, vi } from "vitest";
import { getHouseholdRegisterStats, listHouseholds } from "../api";

const { apiCall } = vi.hoisted(() => ({ apiCall: vi.fn() }));

vi.mock("../../../shared/supabase", () => ({ isSupabaseConfigured: true }));
vi.mock("../../../shared/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../shared/api")>();
  return { ...actual, apiCall };
});

const firstPage = Array.from({ length: 1000 }, (_, index) => ({
  id: `household-${index}`,
  hhId: `${index}`.padStart(12, "0"),
  members: [],
}));
const target = {
  id: "household-700007993656",
  hhId: "700007993656",
  members: [],
};

describe("household list API pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiCall
      .mockResolvedValueOnce({ households: firstPage, total: 1001 })
      .mockResolvedValueOnce({ households: [target], total: 1001 });
  });

  it("loads and returns records beyond the first 1000-row page", async () => {
    const result = await listHouseholds();

    expect(apiCall).toHaveBeenNthCalledWith(1, "/households?action=list&offset=0");
    expect(apiCall).toHaveBeenNthCalledWith(2, "/households?action=list&offset=1000");
    expect(result.total).toBe(1001);
    expect(result.households).toHaveLength(1001);
    expect(result.households.at(-1)?.hhId).toBe("700007993656");
  });
});

describe("household register statistics API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiCall.mockResolvedValue({
      householdCount: 1758,
      memberCount: 6200,
      granteeCount: 1740,
      needsReviewCount: 18,
    });
  });

  it("loads the current register totals from the Supabase summary endpoint", async () => {
    await expect(getHouseholdRegisterStats()).resolves.toEqual({
      householdCount: 1758,
      memberCount: 6200,
      granteeCount: 1740,
      needsReviewCount: 18,
    });
    expect(apiCall).toHaveBeenCalledWith("/households?action=summary");
  });

  it("rejects invalid counts instead of showing false values", async () => {
    apiCall.mockResolvedValueOnce({
      householdCount: 1758,
      memberCount: null,
      granteeCount: 1740,
      needsReviewCount: 18,
    });

    await expect(getHouseholdRegisterStats()).rejects.toThrow(
      "Household summary returned an invalid memberCount.",
    );
  });
});
