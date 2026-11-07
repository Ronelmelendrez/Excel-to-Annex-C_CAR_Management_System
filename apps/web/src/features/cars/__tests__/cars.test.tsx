import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "../../../app/providers";
import { CarsPage } from "../components/CarsPage";
import { CAR_NOT_CONFIGURED_MESSAGE, listCars, createCar, deleteCar, updateCar, listCarTemplates, createCarRevision } from "../api";
import { listHouseholds } from "../../households/api";
import { serverDataCache } from "../../../shared/server-data-cache";
import type { CarDraft } from "../types";
import type { HouseholdRecord } from "../../households/types";

const env = vi.hoisted(() => ({ configured: true }));

vi.mock("../../../shared/supabase", () => ({
  get isSupabaseConfigured() {
    return env.configured;
  },
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
    },
  },
}));

vi.mock("../../../app/providers", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return {
    ...actual,
    listCars: vi.fn(),
    listCarTemplates: vi.fn(),
    createCar: vi.fn(),
    updateCar: vi.fn(),
    deleteCar: vi.fn(),
    createCarRevision: vi.fn(),
  };
});

vi.mock("../../households/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../households/api")>();
  return { ...actual, listHouseholds: vi.fn() };
});

const validHousehold: HouseholdRecord = {
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
};

// Two GRANTEE=Yes flags: the register marks this household "multiple", so it
// must never appear as a CAR source.
const invalidHousehold: HouseholdRecord = {
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
};

function makeCar(overrides: Partial<CarDraft> & { id: string; reference: string }): CarDraft {
  return {
    householdId: "hh-0091",
    granteeMemberId: "m-091-2",
    revision: 1,
    status: "draft_incomplete",
    workflowStatus: "draft",
    hhId: "000091",
    granteeName: "Jomar Ramos",
    granteeSourceRow: 44,
    importName: "SY2026_Q1_household_profiles.xlsx",
    importVersion: 3,
    templateVersion: "annex-c-car-v1",
    datePrepared: "",
    presentingProblem: "",
    backgroundInformation: "",
    assessment: "",
    interventions: [{ id: "intervention-1", type: "", details: "" }],
    recommendation: "",
    familyComposition: [
      { id: "m-091-1", entryId: "00009101", name: "Celia Ramos", relationship: "Household head", age: 42, sourceRow: 43, include: true },
      { id: "m-091-2", entryId: "00009102", name: "Jomar Ramos", relationship: "Son", age: 17, sourceRow: 44, include: true },
    ],
    slots: {},
    history: [{ id: "h-created", label: "Draft created", at: "2026-10-28T08:30:00.000Z" }],
    createdAt: "2026-10-28T08:30:00.000Z",
    updatedAt: "2026-10-28T08:30:00.000Z",
    ...overrides,
  };
}

function authFor(roles: string[]) {
  return {
    session: {},
    user: { id: "worker", email: "worker@example.test" },
    profile: { id: "worker", display_name: "Demo case worker", status: "active" as const },
    roles,
    loading: false,
    signIn: async () => ({}),
    signOut: async () => {},
  };
}

async function renderLoadedPage() {
  render(<CarsPage />);
  return await screen.findByRole("heading", { name: /CAR-2026-023/ });
}

describe("F5 CAR authoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverDataCache.clear();
    env.configured = true;
    vi.mocked(useAuth).mockReturnValue(authFor(["case_worker"]));
    vi.mocked(listCars).mockResolvedValue([makeCar({ id: "car-1", reference: "CAR-2026-023" })]);
    vi.mocked(listCarTemplates).mockResolvedValue([
      { id: "tpl-1", label: "Annex C · v1 (active)" },
    ]);
    vi.mocked(listHouseholds).mockResolvedValue({
      households: [validHousehold, invalidHousehold],
      total: 2,
    });
    vi.mocked(createCar).mockImplementation(async (householdId: string) =>
      makeCar({
        id: "car-2",
        reference: "CAR-2026-024",
        householdId,
        familyComposition: validHousehold.members.map((member) => ({
          id: member.id,
          entryId: member.entryId,
          name: member.name,
          relationship: member.relationship,
          age: member.age,
          sourceRow: member.sourceRow,
          include: true,
        })),
      }),
    );
    vi.mocked(updateCar).mockImplementation(async (draft: CarDraft) => ({
      ...draft,
      updatedAt: new Date().toISOString(),
    }));
    vi.mocked(deleteCar).mockResolvedValue(undefined);
    vi.mocked(createCarRevision).mockResolvedValue(
      makeCar({ id: "car-3", reference: "CAR-2026-023", revision: 2 }),
    );
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the CAR register with the template document and slot blanks", async () => {
    await renderLoadedPage();

    expect(listCars).toHaveBeenCalledTimes(1);
    expect(screen.getByText("CAR records ready")).toBeTruthy();
    expect(screen.queryByText(/Mock drafts/)).toBeNull();
    expect(screen.getByText("1 records")).toBeTruthy();
    expect(
      screen.getByRole("complementary", { name: "CAR authoring panels" }).classList.contains("lg:sticky"),
    ).toBe(true);
    expect(
      screen
        .getByRole("region", { name: "Scrollable CAR drafts" })
        .classList.contains("lg:overflow-y-auto"),
    ).toBe(true);
    expect(screen.getAllByText(/Jomar Ramos/).length).toBeGreaterThan(0);

    // The template's fixed wording is rendered read-only; only blanks are dynamic.
    expect(
      screen.getByText(/The family is experiencing financial difficulties/),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Source of Information (needs input)" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Family Composition:" })).toBeTruthy();

    // Context panel: approval checklist and template version.
    expect(screen.getByRole("tab", { name: /Missing \(/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Data source" })).toBeTruthy();
    // The template-version select lives under the "Data source" tab.
    fireEvent.click(screen.getByRole("tab", { name: "Data source" }));
    expect(screen.getByRole("combobox", { name: "Template version" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Missing \(/ }));

    // Modes and status.
    expect(screen.getByText("Draft · incomplete")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Preview" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Print" })).toBeTruthy();
    // No approval/submit action on this page (only the signatory blanks read
    // "Approved by …"). Approval runs in the review workflow.
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Submit for review" })).toBeNull();
  });

  it("shows all drafts in a viewport-sized scrollable list", async () => {
    vi.mocked(listCars).mockResolvedValue(
      ["023", "024", "025", "026"].map((number) =>
        makeCar({ id: `car-${number}`, reference: `CAR-2026-${number}` }),
      ),
    );

    render(<CarsPage />);

    const draftRegion = await screen.findByRole("region", { name: "Scrollable CAR drafts" });
    expect(screen.getByText("4 records")).toBeTruthy();
    expect(draftRegion.querySelectorAll("li")).toHaveLength(4);
    expect(
      screen
        .getByRole("complementary", { name: "CAR authoring panels" })
        .className.includes("lg:h-[calc(100dvh-7rem)]"),
    ).toBe(true);
    expect(
      screen.getByRole("region", { name: "Drafts" }).classList.contains("lg:flex"),
    ).toBe(true);
    expect(draftRegion.classList.contains("lg:flex-1")).toBe(true);
    expect(draftRegion.classList.contains("lg:overflow-y-auto")).toBe(true);
  });

  it("shows a loading indicator in the household picker until household records arrive", async () => {
    let resolveHouseholds!: (value: Awaited<ReturnType<typeof listHouseholds>>) => void;
    vi.mocked(listHouseholds).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveHouseholds = resolve;
      }),
    );

    render(<CarsPage />);

    await screen.findByRole("heading", { name: /CAR-2026-023/ });
    expect(screen.getByRole("status", { name: "Loading households for CAR draft" })).toBeTruthy();

    resolveHouseholds({ households: [validHousehold, invalidHousehold], total: 2 });
    expect(await screen.findByRole("combobox", { name: "Household" })).toBeTruthy();
  });

  it("reuses CAR drafts and household choices when returning to the page", async () => {
    const firstView = render(<CarsPage />);
    await screen.findByRole("heading", { name: /CAR-2026-023/ });
    expect(listCars).toHaveBeenCalledTimes(1);
    expect(listHouseholds).toHaveBeenCalledTimes(1);
    firstView.unmount();

    render(<CarsPage />);

    expect(screen.getByRole("heading", { name: /CAR-2026-023/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /000091 · Jomar Ramos/ })).toBeTruthy();
    expect(listCars).toHaveBeenCalledTimes(1);
    expect(listHouseholds).toHaveBeenCalledTimes(1);
  });

  it("creates a draft through the API only after selecting a validated household", async () => {
    await renderLoadedPage();

    const householdSelect = screen.getByRole("combobox", { name: "Household" });
    expect((householdSelect as HTMLSelectElement).value).toBe("");
    expect(screen.getByRole("button", { name: "Create draft" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("option", { name: /000091 · Jomar Ramos/ })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /000083/ })).toBeNull();

    fireEvent.change(householdSelect, { target: { value: "hh-0091" } });
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));

    await screen.findByRole("heading", { name: /CAR-2026-024/ });
    expect(createCar).toHaveBeenCalledWith("hh-0091");
    expect(screen.getAllByText(/HH_ID 000091/).length).toBeGreaterThan(0);
  });

  it("saves slot edits back to Supabase instead of keeping them in memory", async () => {
    await renderLoadedPage();

    // Fill a required manual blank through its slot chip.
    fireEvent.click(screen.getByRole("button", { name: "Source of Information (needs input)" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Source of Information" }), {
      target: { value: "Interview with the child’s teacher" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Saving changes…")).toBeTruthy();

    await waitFor(() => expect(updateCar).toHaveBeenCalledTimes(1), { timeout: 4000 });
    const payload = updateCar.mock.calls[0][0];
    expect(payload.id).toBe("car-1");
    expect(payload.slots.source_of_information).toMatchObject({
      value: "Interview with the child’s teacher",
      source: "manual",
    });

    await screen.findAllByText("Changes saved");

    // The save is recorded in the draft history shown in the context panel.
    fireEvent.click(screen.getByRole("tab", { name: "History" }));
    expect(await screen.findAllByText("Changes saved")).toHaveLength(2);
  });

  it("deletes a draft through the API after an explicit confirmation", async () => {
    await renderLoadedPage();

    fireEvent.click(screen.getByRole("button", { name: "Delete draft" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() => expect(deleteCar).toHaveBeenCalledWith("car-1"));
    await screen.findByText(/No CAR drafts yet/);
    expect(screen.queryByRole("heading", { name: /CAR-2026-023/ })).toBeNull();
  });

  it("creates the next revision through the API", async () => {
    await renderLoadedPage();

    fireEvent.click(screen.getByRole("button", { name: "New revision" }));

    await waitFor(() => expect(createCarRevision).toHaveBeenCalledWith("car-1"));
    await screen.findByRole("heading", { name: /CAR-2026-023 · Revision 2/ });
    expect(screen.getAllByText(/Revision 2/).length).toBeGreaterThan(0);
  });

  it("shows an explicit not-configured state instead of sample records", () => {
    env.configured = false;

    render(<CarsPage />);

    expect(screen.getByText(CAR_NOT_CONFIGURED_MESSAGE)).toBeTruthy();
    expect(screen.getByText("Temporarily unavailable")).toBeTruthy();
    expect(listCars).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: /CAR-2026-023/ })).toBeNull();
    expect(screen.queryByRole("option", { name: /000091/ })).toBeNull();
  });

  it("denies CAR details to users without an authoring role", () => {
    vi.mocked(useAuth).mockReturnValue(authFor(["auditor"]));

    render(<CarsPage />);

    expect(screen.getByRole("alert").textContent).toContain("You do not have access to CAR authoring");
    expect(screen.queryByText("CAR-2026-023")).toBeNull();
    expect(listCars).not.toHaveBeenCalled();
  });
});
