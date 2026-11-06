export type GranteeFlag = string;

export type HouseholdMember = {
  id: string;
  entryId: string;
  name: string;
  relationship: string;
  age: number | null;
  granteeFlag: GranteeFlag;
  sourceRow: number;
  raw?: (string | null)[];
};

export type HouseholdRecord = {
  id: string;
  hhId: string;
  barangay: string;
  municipality: string;
  importName: string;
  importVersion: number;
  headers?: string[];
  members: HouseholdMember[];
  car: { reference: string; status: string } | null;
};

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
