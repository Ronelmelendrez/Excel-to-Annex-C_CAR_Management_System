import { normalizeGrantee } from "@import-domain";
import type { HouseholdRecord } from "../types";
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

/**
 * Value of a workbook column (e.g. `CS_CATEGORY`) for a household, read from
 * the stored import row: `member.raw[i]` is the cell under `headers[i]`.
 *
 * The grantee's row wins because the CAR is written about the grantee; the
 * other members are only a fallback for a blank grantee cell. Returns "" when
 * the column is absent (imports from before the column existed, or snapshot
 * records that carry no headers).
 */
export function workbookColumnValue(household: HouseholdRecord, column: string): string {
  const headers = household.headers;
  if (!headers || headers.length === 0) return "";

  const wanted = column.trim().toUpperCase();
  const index = headers.findIndex((header) => header.trim().toUpperCase() === wanted);
  if (index < 0) return "";

  const members = household.members;
  const granteeIndex = members.findIndex(
    (member) => normalizeGrantee(member.granteeFlag) === true,
  );
  const ordered =
    granteeIndex >= 0
      ? [members[granteeIndex], ...members.filter((_, i) => i !== granteeIndex)]
      : members;

  for (const member of ordered) {
    const cell = member.raw?.[index];
    const value = (typeof cell === "string" ? cell : "").trim();
    if (value) return value;
  }
  return "";
}
