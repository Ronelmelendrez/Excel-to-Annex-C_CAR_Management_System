export type ReviewStatus = "submitted" | "approved" | "changes_requested";
export type ReviewStatusFilter = "all" | ReviewStatus;

export type ReviewGate = {
  id: string;
  label: string;
  passed: boolean;
  summary: string;
  exceptionEligible: boolean;
};

export type ReviewDecision = {
  status: Exclude<ReviewStatus, "submitted">;
  comment: string;
  actor: string;
  at: string;
  exceptionReason?: string;
};

export type ReviewRecord = {
  id: string;
  reference: string;
  householdId: string;
  householdLabel: string;
  revision: number;
  importVersion: string;
  templateVersion: string;
  submittedById: string;
  submittedByLabel: string;
  submittedAt: string;
  status: ReviewStatus;
  gates: ReviewGate[];
  decision?: ReviewDecision;
};
