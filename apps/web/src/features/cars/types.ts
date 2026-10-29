import type { HouseholdMember, HouseholdRecord } from "../households/mock-data";

export type CarDraftStatus = "draft_incomplete" | "draft_ready_for_review";

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
  status: CarDraftStatus;
  templateVersion: string;
  datePrepared: string;
  presentingProblem: string;
  backgroundInformation: string;
  assessment: string;
  interventions: InterventionDraft[];
  recommendation: string;
  familyComposition: FamilyCompositionMember[];
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

export type ValidatedHousehold = HouseholdRecord & {
  grantee: HouseholdMember;
};
