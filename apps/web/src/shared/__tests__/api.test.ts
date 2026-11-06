import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiCall } from "../api";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock("../supabase", () => ({
  supabase: {
    auth: { getSession },
  },
}));

describe("shared API client", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    getSession.mockResolvedValue({ data: { session: null } });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("disables browser caching for authenticated API requests", async () => {
    await apiCall("/households?action=list");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/households?action=list"),
      expect.objectContaining({ cache: "no-store" }),
    );
  });
});
