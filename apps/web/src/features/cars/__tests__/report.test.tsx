import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PizZip from "pizzip";
import {
  DEFAULT_REPORT_SETTINGS,
  FORBIDDEN_STATIC_NAMES,
  INTERVENTION_COLUMNS,
  REPORT_TEMPLATE,
  SLOT_BY_KEY,
  SLOT_DEFS,
  computeMissingKeys,
  fillTemplate,
  fillText,
  lintReportTemplate,
  resolveSlotValues,
  type ReportDraftLike,
  type SlotValues,
} from "@report-template";
import { useAuth } from "../../../app/providers";
import { CarsPage } from "../components/CarsPage";
import { InterventionPlanTable } from "../components/report/InterventionPlanTable";
import { SlotChip } from "../components/report/SlotChip";
import {
  defaultInterventions,
  ensureInterventions,
  getReportChecklist,
  withSlotValue,
} from "../lib/report/values";
import { listCars, createCar, deleteCar, updateCar, listCarTemplates, createCarRevision } from "../api";
import { downloadDocx } from "../../templates/lib/annex-c-docx";
import { listHouseholds } from "../../households/api";
import type { CarDraft } from "../types";
import type { HouseholdRecord } from "../../households/mock-data";

/* ------------------------------------------------------------------ *
 * Plan §9 coverage: golden render, static integrity (no leftover      *
 * personal names), one-value-many-places, counts, checklist/missing   *
 * slots, override-with-reason, sensitive masking, and page modes.     *
 * ------------------------------------------------------------------ */

const env = vi.hoisted(() => ({ demo: false }));

vi.mock("../../../shared/supabase", () => ({
  get isDemoMode() {
    return env.demo;
  },
  supabase: {
    auth: { getSession: async () => ({ data: { session: null } }) },
  },
}));

vi.mock("../../../app/providers", () => ({ useAuth: vi.fn() }));

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

// Keep the real renderer (it must produce the actual .docx bytes) but capture
// the download so the test can unzip and compare the file with the page.
vi.mock("../../templates/lib/annex-c-docx", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../templates/lib/annex-c-docx")>();
  return { ...actual, downloadDocx: vi.fn() };
});

/* ------------------------------------------------------- shared fixture */

const householdRecord: HouseholdRecord = {
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

/** Two-member household with workbook snapshots — the golden fixture. */
const fixtureDraft: ReportDraftLike = {
  hhId: "000091",
  datePrepared: "2026-11-04",
  granteeMemberId: "m-1",
  slots: {},
  familyComposition: [
    {
      id: "m-1",
      name: "Jomar Ramos",
      relationship: "Son",
      age: 17,
      include: true,
      sourceRow: 44,
      data: {
        FIRST_NAME: "Jomar",
        LAST_NAME: "Ramos",
        SEX: "Male",
        BIRTHDAY: "May 1, 2009",
        AGE: "17",
        CIVIL_STATUS: "Single",
        HH_SET: "HH Set B",
        BARANGAY: "Poblacion II",
        MUNICIPALITY: "Tanauan City",
        REGION: "VII",
        PROVINCE: "Bohol",
        GRADE_LEVEL: "Grade 11",
        IP_AFFLIATION: "None",
        RELATION_TO_HH_HEAD: "Son",
      },
    },
    {
      id: "m-2",
      name: "Celia Ramos",
      relationship: "Household head",
      age: 42,
      include: true,
      sourceRow: 43,
      data: {
        FIRST_NAME: "Celia",
        LAST_NAME: "Ramos",
        SEX: "Female",
        CIVIL_STATUS: "Married",
      },
    },
  ],
  interventions: [{ included: true, need: "Medical Assistance" }],
};

/** Case-worker entries that fill every remaining (required and optional) blank. */
const manualSamples: Record<string, string> = {
  national_id_no: "1234-5678-9012",
  place_of_birth: "Tanauan City, Bohol",
  contact_info: "0917 123 4567",
  religion: "Roman Catholic",
  wellbeing_present: "Low",
  previous_assessment: "None on record",
  hh_risk_level: "Medium",
  case_category: "Child education risk",
  source_of_information: "Interview with the family",
  provider_occupation: "farmer",
  provider_monthly_income: "12500",
  family_challenges: "tuition fees and medicine",
  community_characteristics: "a dense residential area",
  basic_services: "water and electricity",
  residence_description: "a concrete house near the road",
  housing_materials: "concrete and galvanized iron",
  access_level: "limited",
  neighbor_relationship: "cooperative and supportive",
  primary_income_source: "agriculture",
  income_sufficiency: "insufficient",
  coping_demonstrated: "borrowing from relatives",
  assessment_difficulties: "medical expenses and school fees",
  strengths_resources: "a small sari-sari store",
  recommended_support: "livelihood assistance and scholarship",
  prepared_by_date: "2026-11-04",
  concurred_by_date: "2026-11-04",
  approved_by_date: "2026-11-04",
};

function goldenValues(): SlotValues {
  const slots: SlotValues = {};
  for (const [key, value] of Object.entries(manualSamples)) {
    slots[key] = { value, source: "manual" };
  }
  return resolveSlotValues({ ...fixtureDraft, slots });
}

describe("template static integrity", () => {
  it("lints clean: every token is a known slot and no personal name is baked in", () => {
    expect(lintReportTemplate()).toEqual([]);
  });

  it("keeps leftover names and typed-in locality out of the static wording", () => {
    const staticText = JSON.stringify(REPORT_TEMPLATE.sections);
    for (const name of FORBIDDEN_STATIC_NAMES) {
      expect(staticText).not.toContain(name);
    }
    // The old defect: "Tagbilaran City, Bohol" typed into the prose is now a
    // setting-backed slot, so the system is not locked to one city.
    expect(staticText).not.toContain("Tagbilaran City");
    expect(staticText).toContain("{{locality}}");
    expect(DEFAULT_REPORT_SETTINGS["report.locality"]).toBe("Tagbilaran City, Bohol");
  });

  it("marks Section III as fixed wording with no dynamic slots", () => {
    const problem = REPORT_TEMPLATE.sections.find((section) => section.id === "problem");
    expect(problem?.staticOnly).toBe(true);
    const text = problem?.blocks.map((block) => ("text" in block ? block.text : "")).join(" ") ?? "";
    expect(text).not.toContain("{{");
    expect(text).toContain("The family is experiencing financial difficulties");
  });
});

describe("golden render", () => {
  const lines = fillTemplate(REPORT_TEMPLATE, goldenValues());
  const text = lines.join("\n");

  it("leaves no unfilled tokens or blanks in a completed document", () => {
    expect(text).not.toContain("{{");
    expect(text).not.toContain("____");
  });

  it("renders the fixed wording exactly with the filled values", () => {
    const dateLine = lines.find((line) => line.startsWith("Date:"));
    expect(dateLine).toBe("Date: November 4, 2026");

    const granteeLine = lines.find((line) => line.startsWith("Grantee’s Name:"));
    expect(granteeLine).toBe("Grantee’s Name: Jomar Ramos");

    const presentingProblem = lines.find((line) =>
      line.startsWith("The family is experiencing financial difficulties"),
    );
    expect(presentingProblem).toBe(
      "The family is experiencing financial difficulties due to limited and/or unstable income, making it challenging to meet their basic needs, including food, education, healthcare, and other daily expenses. The situation requires further assessment to identify the family’s needs, available resources, and appropriate interventions to improve their overall well-being.",
    );

    const familyParagraph = lines.find((line) => line.includes("consists of"));
    expect(familyParagraph).toBe(
      "The family of Ramos consists of 2 members, including 1 adult and 1 child. " +
        "The family is currently residing in Tanauan City, Barangay Poblacion II, Tagbilaran City, Bohol. " +
        "The household is primarily supported by Celia Ramos, who works as a farmer " +
        "with an estimated monthly income of PHP 12,500.00. The family’s income is mainly used " +
        "for food, education, healthcare, utilities, and other daily expenses. Despite their efforts to meet their " +
        "basic needs, the family experiences challenges related to tuition fees and medicine. The family’s current " +
        "situation requires appropriate support and interventions to improve their living conditions and overall well-being.",
    );

    const goal = lines.find((line) => line.startsWith("Goal:"));
    expect(goal).toBe(
      "Goal: At the end of 2027 the family improve their economic stability and well-being through better access to program and services.",
    );
  });
});

describe("one value, many places", () => {
  const lines = fillTemplate(REPORT_TEMPLATE, goldenValues());

  it("shows the barangay entered once in IV.A, IV.B and the present address", () => {
    const presentAddress = lines.find((line) => line.startsWith("Present Address:"));
    expect(presentAddress).toContain("Poblacion II");

    const ivA = lines.find((line) => line.includes("consists of"));
    expect(ivA).toContain("Barangay Poblacion II, Tagbilaran City, Bohol");

    const ivB = lines.find((line) => line.includes("resides in Barangay"));
    expect(ivB).toContain("resides in Barangay Poblacion II, which is characterized by");

    // Every occurrence comes from the same resolved value.
    const occurrences = lines.filter((line) => line.includes("Poblacion II")).length;
    expect(occurrences).toBeGreaterThanOrEqual(3);
  });

  it("keeps the setting-backed locality in prose without hard-coding it", () => {
    const ivA = lines.find((line) => line.includes("consists of"))!;
    expect(ivA).toContain(DEFAULT_REPORT_SETTINGS["report.locality"]);
  });
});

describe("computed counts", () => {
  it("formats singular and plural noun phrases", () => {
    const values = resolveSlotValues(fixtureDraft);
    expect(fillText("{{member_count}}", values)).toBe("2 members");
    expect(fillText("{{adult_count}}", values)).toBe("1 adult");
    expect(fillText("{{child_count}}", values)).toBe("1 child");
  });

  it("recomputes when the household shrinks to a single child", () => {
    const values = resolveSlotValues({
      ...fixtureDraft,
      granteeMemberId: "c-1",
      familyComposition: [
        { id: "c-1", name: "Ana Cruz", age: 10, include: true, relationship: "Daughter" },
      ],
    });
    expect(fillText("{{member_count}}", values)).toBe("1 member");
    expect(fillText("{{adult_count}}", values)).toBe("0 adults");
    expect(fillText("{{child_count}}", values)).toBe("1 child");
  });
});

describe("completeness (checklist / missing slots)", () => {
  it("flags empty required slots plus the family and intervention structure", () => {
    const values = resolveSlotValues({ ...fixtureDraft, slots: {} });
    const missing = computeMissingKeys({
      slots: values,
      familyIncluded: 0,
      interventions: [],
    });
    expect(missing).toContain("source_of_information");
    expect(missing).toContain("family_challenges");
    expect(missing).toContain("familyComposition");
    expect(missing).toContain("interventions");
    // Derived and setting-backed values are present without any typing.
    expect(missing).not.toContain("household_id");
    expect(missing).not.toContain("barangay");
    expect(missing).not.toContain("locality");
  });

  it("returns no gaps for a fully completed draft", () => {
    const missing = computeMissingKeys({
      slots: goldenValues(),
      familyIncluded: 2,
      interventions: [{ included: true, need: "Medical Assistance" }],
    });
    expect(missing).toEqual([]);
  });

  it("excludes a row the case worker removed from the plan", () => {
    const missing = computeMissingKeys({
      slots: goldenValues(),
      familyIncluded: 2,
      interventions: [{ included: false, need: "Medical Assistance" }],
    });
    expect(missing).toContain("interventions");
  });

  it("maps checklist rows to slot jump targets", () => {
    const draft = makeDraft();
    const checklist = getReportChecklist(draft, {
      barangay: "Poblacion II",
      municipality: "Tanauan City",
    });
    const sourceItem = checklist.find((item) => item.id === "slot-source_of_information");
    expect(sourceItem).toMatchObject({ label: "Source of Information", complete: false });
    expect(checklist.some((item) => item.id === "familyComposition")).toBe(true);
    expect(checklist.some((item) => item.id === "interventions")).toBe(true);
    // Jump ids match the SlotChip DOM ids (`slot-<key>`).
    expect(SLOT_BY_KEY.source_of_information).toBeTruthy();
  });
});

describe("overrides keep the original and a reason (REQ-RPT-007)", () => {
  it("captures the resolved derived value as the original", () => {
    const resolved = resolveSlotValues(fixtureDraft);
    const original = resolved.barangay?.value;
    expect(original).toBe("Poblacion II");

    const overridden = withSlotValue({}, SLOT_BY_KEY.barangay, "San Isidro", {
      reason: "Confirmed during the home visit",
      previous: original,
    });
    expect(overridden.barangay).toMatchObject({
      value: "San Isidro",
      overridden: true,
      original: "Poblacion II",
      reason: "Confirmed during the home visit",
    });

    // The resolution honors the saved override on reload.
    const reloaded = resolveSlotValues({ ...fixtureDraft, slots: overridden });
    expect(reloaded.barangay?.value).toBe("San Isidro");
    expect(reloaded.barangay?.overridden).toBe(true);
  });

  it("keeps the first original when the value is overridden again", () => {
    const once = withSlotValue({}, SLOT_BY_KEY.barangay, "San Isidro", {
      reason: "First correction",
      previous: "Poblacion II",
    });
    const twice = withSlotValue(once, SLOT_BY_KEY.barangay, "Balele", {
      reason: "Second correction",
      previous: "San Isidro",
    });
    expect(twice.barangay?.original).toBe("Poblacion II");
    expect(twice.barangay?.reason).toBe("Second correction");
  });

  it("treats a gap fill of an empty slot as a plain value, not an override", () => {
    const filled = withSlotValue({}, SLOT_BY_KEY.source_of_information, "Neighbor interview");
    expect(filled.source_of_information?.overridden).toBeFalsy();
    expect(filled.source_of_information?.original).toBeNull();
    expect(filled.source_of_information?.value).toBe("Neighbor interview");
  });
});

describe("sensitive slots", () => {
  it("masks the value in preview and shows it in print", () => {
    render(
      <SlotChip
        def={SLOT_BY_KEY.contact_info}
        slotValue={{ value: "0917 123 4567", source: "manual" }}
        mode="preview"
        onEdit={() => undefined}
      />,
    );
    expect(screen.getByText("•••••")).toBeTruthy();
    expect(screen.queryByText("0917 123 4567")).toBeNull();
    cleanup();

    render(
      <SlotChip
        def={SLOT_BY_KEY.contact_info}
        slotValue={{ value: "0917 123 4567", source: "manual" }}
        mode="print"
        onEdit={() => undefined}
      />,
    );
    expect(screen.getByText("0917 123 4567")).toBeTruthy();
    cleanup();

    render(
      <SlotChip
        def={SLOT_BY_KEY.contact_info}
        slotValue={{ value: "0917 123 4567", source: "manual" }}
        mode="preview"
        onEdit={() => undefined}
      />,
    );
    // Non-sensitive slots are never masked.
    render(
      <SlotChip
        def={SLOT_BY_KEY.household_id}
        slotValue={{ value: "000091", source: "derived" }}
        mode="preview"
        onEdit={() => undefined}
      />,
    );
    expect(screen.getByText("000091")).toBeTruthy();
  });
});

/* ------------------------------------------------- page-level behaviour */

function makeDraft(overrides: Partial<CarDraft> = {}): CarDraft {
  return {
    id: "car-1",
    reference: "CAR-2026-023",
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
    slots: { contact_info: { value: "0917 123 4567", source: "manual" } },
    history: [{ id: "h-created", label: "Draft created", at: "2026-10-28T08:30:00.000Z" }],
    createdAt: "2026-10-28T08:30:00.000Z",
    updatedAt: "2026-10-28T08:30:00.000Z",
    ...overrides,
  };
}

function authFor(roles: string[]) {
  return {
    session: {},
    user: { email: "worker@example.test" },
    profile: { id: "worker", display_name: "Demo case worker", status: "active" as const },
    roles,
    loading: false,
    signIn: async () => ({}),
    signOut: async () => {},
  };
}

describe("Annex C intervention plan", () => {
  it("restores standard rows when a saved CAR contains only blank intervention rows", () => {
    const restored = ensureInterventions(
      Array.from({ length: 4 }, (_, index) => ({
        id: `legacy-row-${index}`,
        type: "",
        details: "",
      })),
    );

    expect(restored).toHaveLength(6);
    expect(restored.map((row) => row.need)).toEqual([
      "Medical Assistance",
      "Scholarship for college ongoing children",
      "Increased social network",
      "Stable Employment",
      "Capability Building",
      "Progress Monitoring",
    ]);
    expect(restored[0].activities).toContain("to RHU");
    expect(restored[4].responsible).toContain("TESDA");
  });

  it("shows all six standard source rows and their prefilled details in the CAR table", () => {
    render(
      <InterventionPlanTable
        interventions={defaultInterventions()}
        values={{}}
        mode="preview"
        onUpdate={() => undefined}
        onAddCustom={() => undefined}
        onRemove={() => undefined}
      />,
    );

    const table = screen.getByRole("table");
    const rows = Array.from(table.querySelectorAll("tbody tr"));
    expect(rows).toHaveLength(6);
    const cells = rows.map((row) =>
      Array.from(row.querySelectorAll("td")).map((cell) =>
        (cell.textContent ?? "").replace(/\s+/g, " ").trim(),
      ),
    );
    expect(cells.map((row) => row[0])).toEqual([
      "Medical Assistance",
      "Scholarship for college ongoing children",
      "Increased social network",
      "Stable Employment",
      "Capability Building",
      "Progress Monitoring",
    ]);
    expect(cells[0][2]).toContain("_________ to RHU");
    expect(cells[0][5]).toContain("maintain the _________’s overall health");
    expect(cells[3][3]).toContain("___________");
    expect(cells[4][2]).toContain("link ________ to TESDA");
    expect(cells[5][4]).toBe("Every 6mons");
    expect(document.body.textContent).not.toContain("Untitled row —");
  });
});

describe("report page modes and audit behaviour", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env.demo = false;
    vi.mocked(useAuth).mockReturnValue(authFor(["case_worker"]));
    vi.mocked(listCars).mockResolvedValue([makeDraft()]);
    vi.mocked(listCarTemplates).mockResolvedValue([]);
    vi.mocked(listHouseholds).mockResolvedValue({
      households: [householdRecord],
      total: 1,
    });
    vi.mocked(updateCar).mockImplementation(async (draft: CarDraft) => ({
      ...draft,
      updatedAt: new Date().toISOString(),
    }));
    vi.mocked(createCar).mockResolvedValue(makeDraft({ id: "car-2", reference: "CAR-2026-024" }));
    vi.mocked(deleteCar).mockResolvedValue(undefined);
    vi.mocked(createCarRevision).mockResolvedValue(makeDraft({ revision: 2 }));
  });

  afterEach(() => {
    cleanup();
  });

  async function renderLoaded() {
    render(<CarsPage />);
    await screen.findByRole("heading", { name: /CAR-2026-023/ });
  }

  it("shows the approval checklist as blocked while required blanks remain", async () => {
    await renderLoaded();
    expect(screen.getByText(/Approval is blocked while required blanks remain\./)).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Missing \(/ })).toBeTruthy();
  }, 30000);

  it("switches between Edit, Preview and Print without changing the wording", async () => {
    // Mode switches re-render every slot of the document in jsdom.
    await renderLoaded();

    // Edit: interactive blanks and family-table inputs.
    expect(screen.getByRole("button", { name: "Source of Information (needs input)" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Name for Celia Ramos" })).toBeTruthy();

    // Preview: clean document — blanks are plain text, editors are gone.
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.queryByRole("button", { name: "Source of Information (needs input)" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Name for Celia Ramos" })).toBeNull();
    expect(screen.getAllByText("____").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/The family is experiencing financial difficulties/),
    ).toBeTruthy();

    // Print: print action available, still the same document.
    const printCalls: number[] = [];
    Object.defineProperty(window, "print", {
      configurable: true,
      writable: true,
      value: () => printCalls.push(1),
    });
    fireEvent.click(screen.getByRole("button", { name: "Print" }));
    fireEvent.click(screen.getByRole("button", { name: "Print this report" }));
    expect(printCalls).toHaveLength(1);
    expect(
      screen.getByText(/The family is experiencing financial difficulties/),
    ).toBeTruthy();

    // Back to Edit.
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("button", { name: "Source of Information (needs input)" })).toBeTruthy();
  }, 30000);

  it("exports the Intervention Plan table and Goal paragraph to DOCX exactly as shown on the page", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    // ---- what the page shows ----------------------------------------
    const goalOnPage = Array.from(document.querySelectorAll("p"))
      .map((p) => p.textContent ?? "")
      .find((text) => text.trim().startsWith("Goal:"));
    expect(goalOnPage).toBeTruthy();

    const planTable = Array.from(document.querySelectorAll("table")).find((table) =>
      (table.textContent ?? "").includes("Need/Problem"),
    );
    expect(planTable).toBeTruthy();
    const headersOnPage = Array.from(planTable!.querySelectorAll("th")).map((th) =>
      (th.textContent ?? "").trim(),
    );
    expect(headersOnPage).toEqual([...INTERVENTION_COLUMNS]);

    const rowCellsOnPage = Array.from(planTable!.querySelectorAll("tbody tr")).map((tr) =>
      Array.from(tr.querySelectorAll("td")).map((td) => (td.textContent ?? "").trim()),
    );
    expect(rowCellsOnPage.length).toBeGreaterThan(0);

    const reportParagraphs = Array.from(document.querySelectorAll("p"))
      .map((p) => p.textContent ?? "")
      .map((text) => text.replace(/\s+/g, " ").trim());
    expect(reportParagraphs.some((text) => text.startsWith("Untitled row —"))).toBe(false);

    // ---- download and unzip ------------------------------------------
    fireEvent.click(screen.getByRole("button", { name: "Download DOCX" }));
    await waitFor(() => expect(downloadDocx).toHaveBeenCalledTimes(1), { timeout: 20000 });

    const [bytes, filename] = vi.mocked(downloadDocx).mock.calls[0];
    expect(filename).toBe("Annex C - CASE STUDY REPORT - Jomar Ramos (000091).docx");

    const zip = new PizZip(new Uint8Array(bytes as ArrayBuffer));
    const xml = zip.file("word/document.xml")?.asText() ?? "";
    expect(xml).not.toContain("{{");
    const docxText = xml
      .replace(/<w:tab\s*\/>/g, " ")
      .replace(/<w:br\s*\/>|<w:cr\s*\/>/g, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();

    // Same six columns, same first-row cells, same Goal paragraph — the
    // page and the DOCX are generated from one definition (REQ-RPT-005).
    for (const header of headersOnPage) {
      expect(docxText).toContain(header);
    }
    for (const cell of rowCellsOnPage[0]) {
      if (cell) expect(docxText).toContain(cell);
    }
    expect(docxText).not.toContain("Untitled row —");
    expect(docxText).toContain((goalOnPage ?? "").replace(/\s+/g, " ").trim());
    expect(docxText).toContain("INTERVENTION PLAN");
  }, 30000);

  it("requires a reason before overriding a derived value and stores it", async () => {
    await renderLoaded();

    // {{barangay}} is used in two sentences, so both chips share the label;
    // editing either one writes the single slot value.
    const [barangayChip] = screen.getAllByRole("button", { name: "Barangay" });
    fireEvent.click(barangayChip);
    const overrideButton = screen.getByRole("button", { name: "Override value" }) as HTMLButtonElement;
    expect(overrideButton.disabled).toBe(true);

    fireEvent.change(screen.getByRole("textbox", { name: "Barangay" }), {
      target: { value: "San Isidro" },
    });
    fireEvent.change(
      screen.getByRole("textbox", { name: "Reason for changing Barangay" }),
      { target: { value: "Confirmed during the home visit" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Override value" }));

    await waitFor(() => expect(updateCar).toHaveBeenCalled(), { timeout: 4000 });
    const payload = updateCar.mock.calls[0][0];
    expect(payload.slots.barangay).toMatchObject({
      value: "San Isidro",
      overridden: true,
      original: "Poblacion II",
      reason: "Confirmed during the home visit",
    });

    // The document marks the overridden blank (both {{barangay}} chips show it).
    const editedMarkers = await screen.findAllByText("edited");
    expect(editedMarkers.length).toBeGreaterThan(0);
  }, 30000);

  it("masks sensitive values until revealed, and the reveal is logged", async () => {
    await renderLoaded();

    expect(screen.getByText("•••••")).toBeTruthy();
    expect(screen.queryByText("0917 123 4567")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reveal Contact information" }));
    expect(screen.getByText("0917 123 4567")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "History" }));
    await screen.findByText(/Revealed sensitive field: Contact information/);
  }, 30000);
});
