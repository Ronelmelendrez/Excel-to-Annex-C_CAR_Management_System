import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "../../../app/providers";
import { AppShell } from "../../../app/layout";
import { AuditPage } from "../components/AuditPage";
import { serverDataCache } from "../../../shared/server-data-cache";

const { fetchAuditEvents } = vi.hoisted(() => ({ fetchAuditEvents: vi.fn() }));

vi.mock("../../../app/providers", () => ({
  useAuth: vi.fn(),
}));
vi.mock("../api", () => ({
  fetchAuditEvents,
  AUDIT_PAGE_SIZE: 50,
}));

function authFor(roles: string[]) {
  return {
    session: {},
    user: { id: "00000000-0000-4000-8000-000000000010", email: "staff@example.test" },
    profile: {
      id: "00000000-0000-4000-8000-000000000010",
      display_name: "Staff member",
      status: "active" as const,
    },
    roles,
    loading: false,
    signIn: async () => ({}),
    signOut: async () => {},
  };
}

const event = {
  id: "00000000-0000-4000-8000-000000000001",
  actorId: "00000000-0000-4000-8000-000000000002",
  action: "import_committed",
  entityType: "imports",
  entityId: "00000000-0000-4000-8000-000000000003",
  occurredAt: "2026-10-23T09:15:00.000Z",
};

function renderAudit() {
  return render(
    <MemoryRouter>
      <AuditPage />
    </MemoryRouter>,
  );
}

describe("audit log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverDataCache.clear();
    vi.mocked(useAuth).mockReturnValue(authFor(["auditor"]));
    fetchAuditEvents.mockResolvedValue({
      events: [event],
      total: 1,
      limit: 50,
      offset: 0,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders persisted event metadata without exposing before/after values", async () => {
    renderAudit();

    expect(await screen.findAllByText("Import Committed")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Audit trail" })).toBeTruthy();
    expect(screen.getAllByText(event.actorId)).toHaveLength(2);
    expect(screen.getByText(event.entityId)).toBeTruthy();
    expect(screen.getByText("Sensitive before-and-after details are not displayed here."))
      .toBeTruthy();
    expect(screen.queryByText("Status: Submitted")).toBeNull();
    expect(fetchAuditEvents).toHaveBeenCalledWith(
      { search: "", actor: "", entityType: "all", dateFrom: "", dateTo: "" },
      0,
      expect.any(AbortSignal),
    );
  });

  it("shows a page-level loading skeleton while the first audit request is pending", () => {
    fetchAuditEvents.mockReturnValue(new Promise(() => {}));

    renderAudit();

    expect(
      screen.getByRole("status", { name: "Loading Audit trail" }).getAttribute("aria-busy"),
    ).toBe("true");
    expect(screen.queryByRole("region", { name: "Audit log filters" })).toBeNull();
  });

  it("reuses cached events when returning to the audit page", async () => {
    const firstView = renderAudit();
    expect(await screen.findAllByText("Import Committed")).toHaveLength(2);
    expect(fetchAuditEvents).toHaveBeenCalledTimes(1);
    firstView.unmount();

    renderAudit();

    expect(screen.getAllByText("Import Committed")).toHaveLength(2);
    expect(fetchAuditEvents).toHaveBeenCalledTimes(1);
  });

  it("sends actor, entity, search, and date filters to the server", async () => {
    renderAudit();
    await screen.findAllByText("Import Committed");

    fireEvent.change(screen.getByRole("searchbox", { name: "Search action or record" }), {
      target: { value: "commit" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Account reference" }), {
      target: { value: event.actorId },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Record type" }), {
      target: { value: "imports" },
    });
    fireEvent.change(screen.getByLabelText("From date"), {
      target: { value: "2026-10-01" },
    });
    fireEvent.change(screen.getByLabelText("To date"), {
      target: { value: "2026-10-31" },
    });

    await waitFor(() => {
      expect(fetchAuditEvents).toHaveBeenLastCalledWith(
        {
          search: "commit",
          actor: event.actorId,
          entityType: "imports",
          dateFrom: "2026-10-01",
          dateTo: "2026-10-31",
        },
        0,
        expect.any(AbortSignal),
      );
    });
  });

  it("loads additional persisted records in another page", async () => {
    const firstPage = Array.from({ length: 50 }, (_, index) => ({
      ...event,
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      action: `event_${index + 1}`,
    }));
    const nextEvent = {
      ...event,
      id: "00000000-0000-4000-8000-000000000051",
      action: "event_51",
    };
    fetchAuditEvents
      .mockResolvedValueOnce({ events: firstPage, total: 51, limit: 50, offset: 0 })
      .mockResolvedValueOnce({ events: [nextEvent], total: 51, limit: 50, offset: 50 });

    renderAudit();
    expect(await screen.findAllByText("Event 1")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Load more audit events" }));

    expect(await screen.findAllByText("Event 51")).toHaveLength(1);
    expect(fetchAuditEvents).toHaveBeenLastCalledWith(
      { search: "", actor: "", entityType: "all", dateFrom: "", dateTo: "" },
      50,
      expect.any(AbortSignal),
    );
  });

  it("shows loading errors and retries without substituting sample data", async () => {
    fetchAuditEvents
      .mockRejectedValueOnce(new Error("Audit service unavailable."))
      .mockResolvedValueOnce({ events: [event], total: 1, limit: 50, offset: 0 });

    renderAudit();

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Audit records could not be loaded. Check your internet connection and try again.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findAllByText("Import Committed")).toHaveLength(2);
  });

  it("does not fetch audit data for unauthorized roles", () => {
    vi.mocked(useAuth).mockReturnValue(authFor(["case_worker"]));
    renderAudit();

    expect(screen.getByRole("alert").textContent).toContain(
      "You do not have access to audit records",
    );
    expect(fetchAuditEvents).not.toHaveBeenCalled();
  });

  it("shows the Audit navigation item only to auditors and admins", () => {
    const { rerender } = render(
      <MemoryRouter>
        <AppShell>
          <p>Workspace</p>
        </AppShell>
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Audit" })).toBeTruthy();

    vi.mocked(useAuth).mockReturnValue(authFor(["case_worker"]));
    rerender(
      <MemoryRouter>
        <AppShell>
          <p>Workspace</p>
        </AppShell>
      </MemoryRouter>,
    );
    expect(screen.queryByRole("link", { name: "Audit" })).toBeNull();
  });
});
