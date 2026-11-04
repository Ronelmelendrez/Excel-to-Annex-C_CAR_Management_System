import type { HouseholdMember, HouseholdRecord } from "../households/mock-data";

export type CarDraftStatus = "draft_incomplete" | "draft_ready_for_review";

/** Workflow status stored in `case_assessments.status`. */
export type CarWorkflowStatus = "draft" | "submitted" | "changes_requested" | "approved";

/** Editor save state: the draft is written back to Supabase on a debounce. */
export type CarSaveState = "idle" | "saving" | "saved" | "error";

export type FamilyCompositionMember = Pick<
  HouseholdMember,
  "id" | "entryId" | "name" | "age" | "sourceRow"
> & {
  relationship: string;
  include: boolean;
};

export type InterventionDraft = {
  id: string;
  type: string;
  details: string;
};

export type CarDraft = {
  id: string;
  reference: string;
  householdId: string;
  granteeMemberId: string;
  revision: number;
  /** Completeness, derived from the saved checklist gaps. */
  status: CarDraftStatus;
  /** Workflow state from the database row. */
  workflowStatus: CarWorkflowStatus;
  /** Source-record snapshot kept in `content` so a CAR renders even if the
   *  household register cannot be reloaded. */
  hhId: string;
  granteeName: string;
  granteeSourceRow: number;
  importName: string;
  importVersion: number;
  templateVersion: string;
  datePrepared: string;
  presentingProblem: string;
  backgroundInformation: string;
  assessment: string;
  interventions: InterventionDraft[];
  recommendation: string;
  familyComposition: FamilyCompositionMember[];
  history: CarDraftHistoryEntry[];
  createdAt: string;
  updatedAt: string;
};

export type CarDraftHistoryEntry = {
  id: string;
  label: string;
  at: string;
};

export type CarChecklistItem = {
  id: string;
  label: string;
  complete: boolean;
};

/** Template offered by the CAR template-version select. */
export type CarTemplateOption = {
  id: string;
  label: string;
};

export type ValidatedHousehold = HouseholdRecord & {
  grantee: HouseholdMember;
};
