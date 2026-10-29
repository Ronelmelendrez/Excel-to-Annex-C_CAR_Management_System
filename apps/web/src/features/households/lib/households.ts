import { normalizeGrantee } from "@import-domain";
import type { HouseholdRecord } from "../mock-data";
import type { GranteeStatus } from "../types";

export function getGranteeStatus(
  household: HouseholdRecord,
  excludedMemberIds: string[] = [],
): GranteeStatus {
  const parsed = household.members
    .filter((member) => !excludedMemberIds.includes(member.id))
    .map((member) => ({
      raw: member.granteeFlag.trim(),
      value: normalizeGrantee(member.granteeFlag),
    }));
  const yesCount = parsed.filter((member) => member.value === true).length;
  const invalidCount = parsed.filter((member) => member.raw !== "" && member.value === null).length;
  const blankCount = parsed.filter((member) => member.raw === "").length;

  if (yesCount > 1) return "multiple";
  if (yesCount === 1 && invalidCount > 0) return "invalid";
  if (yesCount === 1 && blankCount > 0) return "blank";
  if (yesCount === 1) return "valid";
  if (invalidCount > 0) return "invalid";
  if (blankCount > 0) return "blank";
  return "none";
}

export function formatHouseholdEventTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
