import type {
  CarChecklistItem,
  CarDraft,
  CarDraftHistoryEntry,
  FamilyCompositionMember,
  InterventionDraft,
} from "../types";

export function getCarChecklist(draft: CarDraft): CarChecklistItem[] {
  return [
    { id: "templateVersion", label: "Template version selected", complete: Boolean(draft.templateVersion) },
    { id: "datePrepared", label: "Date prepared", complete: Boolean(draft.datePrepared) },
    {
      id: "familyComposition",
      label: "Family composition has at least one included member",
      complete: draft.familyComposition.some((member) => member.include),
    },
    { id: "presentingProblem", label: "Presenting problem", complete: Boolean(draft.presentingProblem.trim()) },
    { id: "backgroundInformation", label: "Background information", complete: Boolean(draft.backgroundInformation.trim()) },
    { id: "assessment", label: "Assessment", complete: Boolean(draft.assessment.trim()) },
    {
      id: "interventions",
      label: "At least one intervention has a type and details",
      complete: draft.interventions.some(
        (intervention) => Boolean(intervention.type) && Boolean(intervention.details.trim()),
      ),
    },
    { id: "recommendation", label: "Recommendation", complete: Boolean(draft.recommendation.trim()) },
  ];
}

export function createFamilyComposition(
  members: FamilyCompositionMember[],
): FamilyCompositionMember[] {
  return members.map((member) => ({ ...member }));
}

export function createIntervention(): InterventionDraft {
  return { id: `intervention-${crypto.randomUUID()}`, type: "", details: "" };
}

export function getDraftStatus(draft: CarDraft): CarDraft["status"] {
  return getCarChecklist(draft).every((item) => item.complete)
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
