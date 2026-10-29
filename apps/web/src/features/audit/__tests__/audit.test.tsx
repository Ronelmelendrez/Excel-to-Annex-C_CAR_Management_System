import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "../../../app/providers";
import { AppShell } from "../../../app/layout";
import { AuditPage } from "../components/AuditPage";

vi.mock("../../../app/providers", () => ({
  useAuth: vi.fn(),
}));

function authFor(roles: string[]) {
  return {
    session: {},
    user: { id: "staff-104", email: "staff@example.test" },
    profile: { id: "staff-104", display_name: "Mock staff", status: "active" as const },
    roles,
    loading: false,
    signIn: async () => ({}),
    signOut: async () => {},
  };
}

function renderAudit() {
  return render(
    <MemoryRouter>
      <AuditPage />
    </MemoryRouter>,
  );
}

describe("F10 audit log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue(authFor(["auditor"]));
  });

  afterEach(() => {
    cleanup();
  });

  it("shows a PII-minimized mock event list and selected event details", () => {
    const { container } = renderAudit();
    const pageText = container.textContent ?? "";

    expect(screen.getByRole("heading", { name: "Audit trail" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Audit events" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Event details" })).toBeTruthy();
    expect(pageText).toContain("CAR approved");
    expect(pageText).toContain("staff-104");
    expect(pageText).toContain("car-record-019");
    expect(pageText).toContain("Status: Submitted");
    expect(pageText).toContain("Status: Approved");
    expect(pageText).toContain("Sensitive before/after values are omitted");
    expect(pageText).not.toMatch(/LRN|PCN|pregnancy|disability|@example|Dela Cruz|Ramos/i);
  });

  it("filters by actor, entity type, and inclusive date range", () => {
    const { container } = renderAudit();
    fireEvent.change(screen.getByRole("combobox", { name: "Actor" }), {
      target: { value: "staff-104" },
    });
    expect(container.textContent).toContain("5 of 12 mock events");

    fireEvent.change(screen.getByRole("combobox", { name: "Entity type" }), {
      target: { value: "export" },
    });
    expect(container.textContent).toContain("2 of 12 mock events");
    expect(container.textContent).toContain("PDF export failed");
    expect(container.textContent).toContain("PDF export downloaded");

    fireEvent.change(screen.getByLabelText("From date"), {
      target: { value: "2026-10-25" },
    });
    fireEvent.change(screen.getByLabelText("To date"), {
      target: { value: "2026-10-28" },
    });
    expect(container.textContent).toContain("1 of 12 mock events");
    expect(container.textContent).toContain("PDF export failed");
    expect(container.textContent).not.toContain("PDF export downloaded");
  });

  it("announces invalid date ranges and offers a useful empty state", () => {
    const { container } = renderAudit();
    fireEvent.change(screen.getByLabelText("From date"), {
      target: { value: "2026-10-29" },
    });
    fireEvent.change(screen.getByLabelText("To date"), {
      target: { value: "2026-10-20" },
    });

    expect(screen.getByRole("alert").textContent).toContain(
      "The start date must be on or before the end date.",
    );
    expect(container.textContent).toContain("0 of 12 mock events");

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search action or entity" }), {
      target: { value: "no-such-event" },
    });
    expect(screen.getByText("No audit events match these filters.")).toBeTruthy();
  });

  it("denies event details to roles other than auditor and admin", () => {
    vi.mocked(useAuth).mockReturnValue(authFor(["case_worker"]));
    renderAudit();

    expect(screen.getByRole("alert").textContent).toContain(
      "You do not have access to audit records",
    );
    expect(screen.queryByText("CAR approved")).toBeNull();
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
