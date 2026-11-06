import { ApiError, apiCall } from "../../shared/api";
import { isSupabaseConfigured } from "../../shared/supabase";
import type { SlotValue, SlotValues } from "@report-template";
import { ensureInterventions } from "./lib/report/values";
import type {
  CarDraft,
  CarDraftHistoryEntry,
  CarTemplateOption,
  CarWorkflowStatus,
  FamilyCompositionMember,
  InterventionDraft,
} from "./types";

/** Error codes the `cars` edge function returns in `{ error: <code> }`. */
export type CarApiErrorCode =
  | "NOT_CONFIGURED"
  | "UNAUTHORIZED"
  | "forbidden"
  | "invalid_household"
  | "immutable"
  | "has_reports"
  | "revision_exists"
  | "reference_failed";

export class CarApiError extends Error {
  code: CarApiErrorCode | string;

  constructor(code: CarApiErrorCode | string, message: string) {
    super(message);
    this.name = "CarApiError";
    this.code = code;
  }
}

/** Shown when Supabase credentials are missing. */
export const CAR_NOT_CONFIGURED_MESSAGE =
  "CAR data requires Supabase. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then apply the Supabase migrations and deploy the cars function.";

function assertConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new CarApiError("NOT_CONFIGURED", CAR_NOT_CONFIGURED_MESSAGE);
  }
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asContent(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringRecord(value: unknown): Record<string, string> {
  const row = asContent(value);
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(row)) {
    if (typeof entry === "string") out[key] = entry;
  }
  return out;
}

/** Keeps only well-formed slot entries; the server re-sanitizes on write. */
function mapSlotValues(value: unknown): SlotValues {
  const row = asContent(value);
  const out: SlotValues = {};
  for (const [key, entry] of Object.entries(row)) {
    const slot = asContent(entry);
    if (typeof slot.value !== "string") continue;
    out[key] = {
      value: slot.value,
      source: typeof slot.source === "string" ? (slot.source as SlotValue["source"]) : undefined,
      overridden: slot.overridden === true,
      original: typeof slot.original === "string" ? slot.original : null,
      reason: typeof slot.reason === "string" ? slot.reason : undefined,
      at: typeof slot.at === "string" ? slot.at : undefined,
    };
  }
  return out;
}

function mapIntervention(value: unknown): InterventionDraft {
  const row = asContent(value);
  // Legacy rows store only {type, details}; new rows carry the full shape.
  const need = str(row.need) || str(row.type);
  const activities = str(row.activities) || str(row.details);
  return {
    id: str(row.id) || `intervention-${crypto.randomUUID()}`,
    type: need,
    details: activities,
    catalogId: typeof row.catalogId === "string" ? row.catalogId : undefined,
    custom: row.custom === true,
    included: row.included === undefined ? true : row.included === true,
    need,
    objective: str(row.objective),
    activities,
    responsible: str(row.responsible),
    timeline: str(row.timeline),
    remarks: str(row.remarks),
    values: asStringRecord(row.values),
  };
}

function mapFamilyMember(value: unknown): FamilyCompositionMember {
  const row = asContent(value);
  return {
    id: str(row.id),
    entryId: str(row.entryId),
    name: str(row.name),
    relationship: str(row.relationship),
    age: row.age === null || row.age === undefined ? null : num(row.age, 0),
    sourceRow: num(row.sourceRow, 0),
    include: row.include === true,
    data: asStringRecord(row.data),
    overlay: asStringRecord(row.overlay),
  };
}

function mapHistoryEntry(value: unknown): CarDraftHistoryEntry {
  const row = asContent(value);
  return {
    id: str(row.id) || crypto.randomUUID(),
    label: str(row.label),
    at: str(row.at) || new Date().toISOString(),
  };
}

/** Keeps the editor usable even if the server response shape drifts. */
function asCar(raw: unknown): CarDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const row = asContent(raw);
  if (typeof row.id !== "string" || !row.id) return null;

  const workflowStatus = str(row.workflowStatus, "draft") as CarWorkflowStatus;
  const completeness = str(row.status);

  return {
    id: row.id,
    reference: str(row.reference),
    householdId: str(row.householdId),
    granteeMemberId: str(row.granteeMemberId),
    revision: num(row.revision, 1),
    status: completeness === "draft_ready_for_review" ? "draft_ready_for_review" : "draft_incomplete",
    workflowStatus,
    hhId: str(row.hhId),
    granteeName: str(row.granteeName),
    granteeSourceRow: num(row.granteeSourceRow, 0),
    importName: str(row.importName),
    importVersion: num(row.importVersion, 1),
    templateVersion: str(row.templateVersion),
    datePrepared: str(row.datePrepared),
    presentingProblem: str(row.presentingProblem),
    backgroundInformation: str(row.backgroundInformation),
    assessment: str(row.assessment),
    recommendation: str(row.recommendation),
    interventions: ensureInterventions(asArray(row.interventions).map(mapIntervention)),
    familyComposition: asArray(row.familyComposition).map(mapFamilyMember),
    slots: mapSlotValues(row.slots),
    history: asArray(row.history).map(mapHistoryEntry),
    createdAt: str(row.createdAt),
    updatedAt: str(row.updatedAt),
  };
}

function requireCar(raw: unknown): CarDraft {
  const car = asCar(raw);
  if (!car) throw new CarApiError("bad_response", "The server returned an unexpected CAR record.");
  return car;
}

/** The editable slice of a draft; identity fields stay server-owned. */
function toContent(draft: CarDraft): Record<string, unknown> {
  // Legacy mirror: the report date slot also fills the old `datePrepared`
  // field so older readers (and old drafts) keep working.
  const reportDate = draft.slots?.report_date?.value ?? "";
  return {
    templateVersion: draft.templateVersion,
    datePrepared: /^\d{4}-\d{2}-\d{2}$/.test(reportDate) ? reportDate : draft.datePrepared,
    presentingProblem: draft.presentingProblem,
    backgroundInformation: draft.backgroundInformation,
    assessment: draft.assessment,
    recommendation: draft.recommendation,
    familyComposition: draft.familyComposition,
    interventions: draft.interventions,
    slots: draft.slots,
    history: draft.history,
  };
}

/** All CAR drafts, newest first. */
export async function listCars(): Promise<CarDraft[]> {
  assertConfigured();
  const data = (await apiCall("/cars?action=list")) as { cars?: unknown[] };
  return asArray(data?.cars)
    .map(asCar)
    .filter((car): car is CarDraft => car !== null);
}

/** Template versions offered by the CAR template select. */
export async function listCarTemplates(): Promise<CarTemplateOption[]> {
  assertConfigured();
  const data = (await apiCall("/cars?action=templates")) as { templates?: unknown[] };
  return asArray(data?.templates)
    .map((raw) => {
      const row = asContent(raw);
      if (typeof row.id !== "string" || !row.id) return null;
      return { id: row.id, label: str(row.label, "Template version") };
    })
    .filter((option): option is CarTemplateOption => option !== null);
}

/** Starts a CAR from a household that has exactly one validated grantee. */
export async function createCar(householdId: string): Promise<CarDraft> {
  assertConfigured();
  const data = await apiCall("/cars?action=create", {
    method: "POST",
    body: JSON.stringify({ household_id: householdId }),
  });
  return requireCar((data as { car?: unknown })?.car);
}

/** Persists draft edits (debounced by the authoring hook). */
export async function updateCar(draft: CarDraft): Promise<CarDraft> {
  assertConfigured();
  const data = await apiCall("/cars?action=update", {
    method: "POST",
    body: JSON.stringify({ id: draft.id, content: toContent(draft) }),
  });
  return requireCar((data as { car?: unknown })?.car);
}

/** Deletes a draft CAR. Submitted and approved records are rejected. */
export async function deleteCar(id: string): Promise<void> {
  assertConfigured();
  await apiCall("/cars?action=delete", {
    method: "POST",
    body: JSON.stringify({ id }),
  });
}

/** Snapshots the current CAR as its next revision. */
export async function createCarRevision(id: string): Promise<CarDraft> {
  assertConfigured();
  const data = await apiCall("/cars?action=revise", {
    method: "POST",
    body: JSON.stringify({ id }),
  });
  return requireCar((data as { car?: unknown })?.car);
}

/**
 * Friendly copy for failures instead of raw server codes. `fallback` is used
 * for anything the server did not name explicitly.
 */
export function carErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof CarApiError && error.code === "NOT_CONFIGURED") return error.message;

  const code = error instanceof ApiError || error instanceof CarApiError ? error.code : "";
  switch (code) {
    case "UNAUTHORIZED":
    case "unauthorized":
      return "Your session has expired. Sign in again to continue working on CARs.";
    case "forbidden":
      return "You do not have permission to change CAR records.";
    case "invalid_household":
      return "That household no longer has exactly one supported GRANTEE=Yes flag, so a CAR cannot start from it.";
    case "immutable":
      return "This CAR is no longer a draft. Only draft CARs can be changed — create a new revision instead.";
    case "has_reports":
      return "This CAR has generated reports attached and cannot be deleted.";
    case "revision_exists":
      return "A newer revision of this CAR already exists. Refresh the page and try again.";
    case "reference_failed":
      return "A CAR reference could not be generated. Apply the latest Supabase migration, then try again.";
    default: {
      // Keep the user-facing sentence but name the actual failure, so a
      // generic message can never hide the cause again.
      if (error instanceof ApiError) return `${fallback} [HTTP ${error.status}: ${error.code}]`;
      if (error instanceof Error && error.message) return `${fallback} [${error.message}]`;
      return fallback;
    }
  }
}
