import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "../../../app/providers";
import { RoleGuard } from "../../../app/guards";
import { REPORT_GENERATOR_ROLES, TemplatesPage } from "..";
import { DOCX_MIME_TYPE } from "../lib/annex-c-docx";
import { listHouseholds } from "../../households/api";
import { listCars } from "../../cars/api";
import type { HouseholdRecord } from "../../households/types";

/* ------------------------------------------------------------------ *
 * Annex C report generator: pick a validated household → live preview *
 * from the versioned template → download a real filled .docx.         *
 * ------------------------------------------------------------------ */

const env = vi.hoisted(() => ({ configured: true }));

vi.mock("../../../shared/supabase", () => ({
  get isSupabaseConfigured() {
    return env.configured;
  },
  supabase: {
    auth: { getSession: async () => ({ data: { session: null } }) },
  },
}));

vi.mock("../../../app/providers", () => ({ useAuth: vi.fn() }));

vi.mock("../../households/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../households/api")>();
  return { ...actual, listHouseholds: vi.fn() };
});

vi.mock("../../cars/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../cars/api")>();
  return { ...actual, listCars: vi.fn() };
});

function authFor(roles: string[]) {
  return {
    session: {},
    user: { id: "case-01", email: "worker@example.test" },
    profile: { id: "case-01", display_name: "Demo worker", status: "active" as const },
    roles,
    loading: false,
    signIn: async () => ({}),
    signOut: async () => {},
  };
}

/* ------------------------------------------------------- fixtures */

const households: HouseholdRecord[] = [
  {
    id: "hh-0091",
    hhId: "000091",
    barangay: "Poblacion II",
    municipality: "Tanauan City",
    importName: "SY2026_Q1_household_profiles.xlsx",
    importVersion: 3,
    members: [
      { id: "m-091-1", entryId: "00009101", name: "Celia Ramos", relationship: "Household head", age: 42, granteeFlag: "No", sourceRow: 43 },
      { id: "m-091-2", entryId: "00009102", name: "Jomar Ramos", relationship: "Son", age: 17, granteeFlag: "Yes", sourceRow: 44 },
    ],
    car: null,
  },
  {
    id: "hh-0142",
    hhId: "000142",
    barangay: "San Jose",
    municipality: "Tanauan City",
    importName: "SY2026_Q1_household_profiles.xlsx",
    importVersion: 3,
    members: [
      { id: "m-142-1", entryId: "00014201", name: "Lorna Bautista", relationship: "Household head", age: 35, granteeFlag: "Yes", sourceRow: 12 },
      { id: "m-142-2", entryId: "00014202", name: "Pedro Bautista", relationship: "Spouse", age: 37, granteeFlag: "No", sourceRow: 13 },
    ],
    car: null,
  },
  // Two "Yes" flags → not a valid CAR source, must not be offered.
  {
    id: "hh-0083",
    hhId: "000083",
    barangay: "San Isidro",
    municipality: "Tanauan City",
    importName: "SY2026_Q1_household_profiles.xlsx",
    importVersion: 3,
    members: [
      { id: "m-083-1", entryId: "00008301", name: "Rosa Dela Cruz", relationship: "Household head", age: 48, granteeFlag: "Yes", sourceRow: 17 },
      { id: "m-083-2", entryId: "00008302", name: "Mario Dela Cruz", relationship: "Spouse", age: 51, granteeFlag: "Yes", sourceRow: 18 },
    ],
    car: null,
  },
];

/* ------------------------------------------------------- lifecycle */

beforeEach(() => {
  vi.clearAllMocks();
  env.configured = true;
  vi.mocked(useAuth).mockReturnValue(authFor(["case_worker"]));
  vi.mocked(listHouseholds).mockResolvedValue({ households, total: households.length });
  vi.mocked(listCars).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/* ----------------------------------------------------------------- */

describe("Annex C report generator page", () => {
  it("offers only validated households and previews the fixed template wording with the grantee", async () => {
    render(<TemplatesPage />);

    const select = await screen.findByRole("combobox", { name: "Household" });
    expect(within(select).getByRole("option", { name: /HH 000091 · Jomar Ramos/ })).toBeTruthy();
    expect(within(select).getByRole("option", { name: /HH 000142 · Lorna Bautista/ })).toBeTruthy();
    // Two grantee flags → never offered as a report source.
    expect(within(select).queryByRole("option", { name: /HH 000083/ })).toBeNull();

    // Static wording comes from the versioned definition, verbatim.
    const preview = screen.getByTestId("annex-c-preview");
    expect(
      within(preview).getByRole("heading", { name: "CASE ASSESSMENT REPORT (CAR)" }),
    ).toBeTruthy();
    expect(within(preview).getByRole("heading", { name: "Identifying Information:" })).toBeTruthy();
    expect(within(preview).getByRole("heading", { name: "Family Composition:" })).toBeTruthy();
    // Derived blank filled from the import data.
    expect(within(preview).getAllByText("Jomar Ramos").length).toBeGreaterThan(0);

    // Source note + completeness summary.
    expect(screen.getByRole("status")).toHaveTextContent("preview created from imported household information");
    expect(screen.getByText(/required fields? still blank/)).toBeTruthy();
    expect(listHouseholds).toHaveBeenCalledOnce();
  });

  it("switches the preview when another household is selected", async () => {
    render(<TemplatesPage />);

    const select = await screen.findByRole("combobox", { name: "Household" });
    const preview = screen.getByTestId("annex-c-preview");
    expect(within(preview).getAllByText("Jomar Ramos").length).toBeGreaterThan(0);

    fireEvent.change(select, { target: { value: "hh-0142" } });

    // The name lands in several slots (grantee, provider, family row).
    expect((await within(preview).findAllByText("Lorna Bautista")).length).toBeGreaterThan(0);
    expect(within(preview).queryByText("Jomar Ramos")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("preview created from imported household information");
  });

  it("downloads a real Annex C .docx built from the committed template", async () => {
    const createObjectURL = vi.fn(() => "blob:annex-c");
    const revokeObjectURL = vi.fn();
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download);
    });

    try {
      render(<TemplatesPage />);
      await screen.findByRole("combobox", { name: "Household" });

      fireEvent.click(screen.getByRole("button", { name: "Download Word document" }));

      await waitFor(() => expect(createObjectURL).toHaveBeenCalledOnce(), { timeout: 10_000 });
      const blob = createObjectURL.mock.calls[0][0] as Blob;
      expect(blob.type).toBe(DOCX_MIME_TYPE);
      expect(downloads).toEqual([
        "Annex C - CASE STUDY REPORT - Jomar Ramos (000091).docx",
      ]);
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:annex-c");
      expect(await screen.findByText(/Annex C downloaded for Jomar Ramos \(000091\)/)).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
    } finally {
      if (originalCreate) URL.createObjectURL = originalCreate;
      else delete (URL as unknown as Record<string, unknown>).createObjectURL;
      if (originalRevoke) URL.revokeObjectURL = originalRevoke;
      else delete (URL as unknown as Record<string, unknown>).revokeObjectURL;
    }
  });

  it("reports a household load failure with a retry", async () => {
    vi.mocked(listHouseholds)
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({ households, total: households.length });

    render(<TemplatesPage />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Household information could not be loaded");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("combobox", { name: "Household" })).toBeTruthy();
    expect(listHouseholds).toHaveBeenCalledTimes(2);
  });

  it("lets report roles into /templates and redirects everyone else", async () => {
    const route = (
      <MemoryRouter initialEntries={["/templates"]}>
        <Routes>
          <Route
            path="/templates"
            element={
              <RoleGuard roles={REPORT_GENERATOR_ROLES}>
                <div>generator-route</div>
              </RoleGuard>
            }
          />
          <Route path="/dashboard" element={<div>dashboard-route</div>} />
        </Routes>
      </MemoryRouter>
    );

    vi.mocked(useAuth).mockReturnValue(authFor(["auditor"]));
    render(route);
    expect(await screen.findByText("dashboard-route")).toBeTruthy();
    expect(screen.queryByText("generator-route")).toBeNull();

    cleanup();
    vi.mocked(useAuth).mockReturnValue(authFor(["case_worker"]));
    render(route);
    expect(await screen.findByText("generator-route")).toBeTruthy();
  });
});
