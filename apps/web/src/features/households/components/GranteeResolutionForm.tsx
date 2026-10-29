import React from "react";
import { Label } from "../../../components/ui/label";
import type { HouseholdRecord, HouseholdOverlay } from "../types";

export function GranteeResolutionForm({
  household,
  overlay,
  candidateId,
  reason,
  onCandidateChange,
  onReasonChange,
  onSubmit,
}: {
  household: HouseholdRecord;
  overlay?: HouseholdOverlay;
  candidateId: string;
  reason: string;
  onCandidateChange: (value: string) => void;
  onReasonChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="border-b border-[#c9c3b6] bg-[#f3ead8] px-4 py-4 sm:px-5">
      <h3 className="font-semibold">Choose the verified grantee</h3>
      <p className="mt-1 text-xs leading-5 text-[#5b574e]">
        No member is preselected. This creates a mock correction overlay; imported flags stay as recorded.
      </p>
      <fieldset className="mt-3 space-y-2">
        <legend className="sr-only">Select one household member as the grantee</legend>
        {household.members.map((member) => {
          const isExcluded = overlay?.excludedMemberIds.includes(member.id) ?? false;
          return (
            <Label
              key={member.id}
              className="flex min-h-[44px] items-center gap-3 border border-[#d6cdb9] bg-[#f8f5ee] px-3 py-2 text-sm"
            >
              <input
                type="radio"
                name="grantee-candidate"
                value={member.id}
                checked={candidateId === member.id}
                onChange={(event) => onCandidateChange(event.target.value)}
                disabled={isExcluded}
                required
                className="h-4 w-4 accent-[#7a1f1f]"
              />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{member.name}</span>
                <span className="text-xs text-[#5b574e]">
                  {member.relationship} · source row {member.sourceRow} · imported flag:{" "}
                  {member.granteeFlag || "Blank"}
                  {isExcluded ? " · excluded from this household" : ""}
                </span>
              </span>
            </Label>
          );
        })}
      </fieldset>
      <Label htmlFor="resolution-reason" className="mt-3 block text-xs font-semibold">
        Reason for correction
      </Label>
      <textarea
        id="resolution-reason"
        value={reason}
        onChange={(event) => onReasonChange(event.target.value)}
        required
        rows={2}
        className="mt-1 w-full border border-[#8c877c] bg-[#f8f5ee] px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
        placeholder="Record what was checked and why this member was selected."
      />
      <button
        type="submit"
        disabled={!candidateId || !reason.trim()}
        className="mt-3 min-h-[44px] border border-[#161512] bg-[#161512] px-4 py-2 text-sm font-medium text-white hover:bg-[#7a1f1f] disabled:cursor-not-allowed disabled:border-[#b5afa2] disabled:bg-[#b5afa2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
      >
        Record local correction
      </button>
    </form>
  );
}
