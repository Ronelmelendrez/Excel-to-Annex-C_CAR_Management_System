import { getReportChecklist } from "./report/values";
import type {
  CarChecklistItem,
  CarDraft,
  CarDraftHistoryEntry,
  FamilyCompositionMember,
  InterventionDraft,
} from "../types";

/**
 * Checklist for the context panel: every required slot from the template
 * registry plus the family/intervention structural checks. Ids are the DOM
 * jump targets (`slot-<key>`). The server computes the same list through
 * `computeMissingKeys` in _shared/report-template.ts, so completeness in the
 * UI and `missing_fields` can never drift.
 */
export function getCarChecklist(
  draft: CarDraft,
  household?: { barangay?: string; municipality?: string } | null,
): CarChecklistItem[] {
  return getReportChecklist(draft, household);
}

export function createFamilyComposition(
  members: FamilyCompositionMember[],
): FamilyCompositionMember[] {
  return members.map((member) => ({ ...member }));
}

export function createIntervention(): InterventionDraft {
  return {
    id: `intervention-${crypto.randomUUID()}`,
    type: "",
    details: "",
    custom: true,
    included: true,
    need: "",
    objective: "",
    activities: "",
    responsible: "",
    timeline: "",
    remarks: "",
    values: {},
  };
}

export function getDraftStatus(
  draft: CarDraft,
  household?: { barangay?: string; municipality?: string } | null,
): CarDraft["status"] {
  return getCarChecklist(draft, household).every((item) => item.complete)
    ? "draft_ready_for_review"
    : "draft_incomplete";
}

export function formatCarDate(value: string) {
  if (!value) return "Not set";
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const HISTORY_LIMIT = 8;
/** Repeated saves inside this window update the existing entry instead of
 *  growing the persisted history on every keystroke batch. */
const HISTORY_MERGE_WINDOW_MS = 5 * 60 * 1000;

/** Prepends a history entry to the list that is stored with the CAR record. */
export function appendHistoryEntry(
  history: CarDraftHistoryEntry[],
  label: string,
): CarDraftHistoryEntry[] {
  const now = Date.now();
  const [latest, ...rest] = history;
  const mergedAt = latest && latest.label === label ? Date.parse(latest.at) : Number.NaN;
  if (latest && Number.isFinite(mergedAt) && now - mergedAt < HISTORY_MERGE_WINDOW_MS) {
    return [{ ...latest, at: new Date(now).toISOString() }, ...rest];
  }
  return [
    { id: crypto.randomUUID(), label, at: new Date(now).toISOString() },
    ...history,
  ].slice(0, HISTORY_LIMIT);
}
