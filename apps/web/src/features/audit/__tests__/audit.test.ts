import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAuditEvents } from "../api";

const { apiCall } = vi.hoisted(() => ({ apiCall: vi.fn() }));

vi.mock("../../../shared/supabase", () => ({ isDemoMode: false }));
vi.mock("../../../shared/api", () => ({ apiCall }));

const event = {
  id: "00000000-0000-4000-8000-000000000001",
  actorId: "00000000-0000-4000-8000-000000000002",
  action: "import_committed",
  entityType: "imports",
  entityId: "00000000-0000-4000-8000-000000000003",
  occurredAt: "2026-10-23T09:15:00.000Z",
};

describe("audit records API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests persisted records with server-side filters and pagination", async () => {
    apiCall.mockResolvedValue({
      events: [event],
      total: 1,
      limit: 50,
      offset: 50,
    });

    await expect(
      fetchAuditEvents(
        {
          search: "import",
          actor: event.actorId,
          entityType: "imports",
          dateFrom: "2026-10-01",
          dateTo: "2026-10-31",
        },
        50,
      ),
    ).resolves.toEqual({ events: [event], total: 1, limit: 50, offset: 50 });

    const request = apiCall.mock.calls[0][0] as string;
    expect(request).toContain("/audit?");
    expect(request).toContain("action=list");
    expect(request).toContain("actor_id=");
    expect(request).toContain("entity_type=imports");
    expect(request).toContain("date_from=2026-10-01");
    expect(request).toContain("date_to=2026-10-31");
    expect(request).toContain("offset=50");
  });

  it("rejects malformed or incomplete responses", async () => {
    apiCall.mockResolvedValueOnce({ events: [event], total: -1, limit: 50, offset: 0 });
    await expect(fetchAuditEvents({
      search: "",
      actor: "",
      entityType: "all",
      dateFrom: "",
      dateTo: "",
    }, 0)).rejects.toThrow("Audit records response is invalid.");

    apiCall.mockResolvedValueOnce({
      events: [{ ...event, action: null }],
      total: 1,
      limit: 50,
      offset: 0,
    });
    await expect(fetchAuditEvents({
      search: "",
      actor: "",
      entityType: "all",
      dateFrom: "",
      dateTo: "",
    }, 0)).rejects.toThrow("Audit records response is invalid.");
  });
});
