import type { HouseholdMember, HouseholdRecord } from "./mock-data";

export type GranteeStatus = "valid" | "none" | "multiple" | "invalid" | "blank";
export type HouseholdStatus = GranteeStatus | "resolved";
export type ReviewFilter = "all" | "needs_review" | "ok" | "resolved";

export type OverlayEvent = {
  action: "Grantee corrected" | "Member excluded" | "Member restored";
  actor: string;
  reason: string;
  memberName: string;
  beforeValue: string;
  afterValue: string;
  at: string;
};

export type HouseholdOverlay = {
  selectedGranteeId?: string;
  excludedMemberIds: string[];
  events: OverlayEvent[];
};

export type HouseholdListItem = {
  household: HouseholdRecord;
  status: HouseholdStatus;
};

export type { HouseholdMember, HouseholdRecord };
