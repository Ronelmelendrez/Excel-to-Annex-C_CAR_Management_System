import React, { useState } from "react";
import { Label } from "../../../components/ui/label";
import type { HouseholdMember, HouseholdRecord, HouseholdOverlay } from "../types";

function MemberExclusionForm({
  member,
  reason,
  onReasonChange,
  onSubmit,
  onCancel,
}: {
  member: HouseholdMember;
  reason: string;
  onReasonChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="mt-3 border-l-4 border-[#8a5a00] bg-[#f3ead8] px-3 py-3">
      <p className="text-sm font-semibold">Exclude {member.name} from this household view?</p>
      <p className="mt-1 text-xs leading-5 text-[#5b574e]">
        This only hides the member from this view; it does not change the original spreadsheet. A reason is required.
      </p>
      <Label htmlFor="exclusion-reason" className="sr-only">
        Reason for exclusion
      </Label>
      <textarea
        id="exclusion-reason"
        value={reason}
        onChange={(event) => onReasonChange(event.target.value)}
        required
        rows={2}
        className="mt-2 w-full border border-[#8c877c] bg-[#f8f5ee] px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
        placeholder="Reason for excluding this member"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={!reason.trim()}
          className="min-h-[40px] border border-[#161512] bg-[#161512] px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:border-[#b5afa2] disabled:bg-[#b5afa2]"
        >
          Hide member from this view
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[40px] px-3 py-2 text-xs underline underline-offset-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function HouseholdMembersTable({
  household,
  overlay,
  granteeId,
  canCorrect,
  excludeMemberId,
  exclusionReason,
  onStartExclusion,
  onReasonChange,
  onSaveExclusion,
  onCancelExclusion,
  onRestoreMember,
}: {
  household: HouseholdRecord;
  overlay?: HouseholdOverlay;
  granteeId?: string;
  canCorrect: boolean;
  excludeMemberId: string | null;
  exclusionReason: string;
  onStartExclusion: (memberId: string) => void;
  onReasonChange: (value: string) => void;
  onSaveExclusion: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancelExclusion: () => void;
  onRestoreMember: (memberId: string) => void;
}) {
  const exclusionMember = household.members.find((member) => member.id === excludeMemberId);
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const headers = household.headers ?? [];
  const canShowColumns = headers.length > 0;

  return (
    <section aria-labelledby="household-members-heading" className="border-b border-[#c9c3b6] px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="household-members-heading" className="font-serif text-lg">
          Household members
        </h3>
        <p className="text-xs text-[#5b574e]">
          Original spreadsheet rows are kept; no imported information is removed.
        </p>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse text-left text-sm">
          <thead>
            <tr className="bg-[#ece7dc]">
              {["Member", "Relationship", "Age", "GRANTEE", "Source"].map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className="border-b border-[#c9c3b6] px-2 py-2 font-mono text-[10px] uppercase tracking-[0.08em]"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {household.members.map((member) => {
              const excluded = overlay?.excludedMemberIds.includes(member.id) ?? false;
              const isGrantee = granteeId === member.id;
              const showColumns = canShowColumns && (member.raw?.length ?? 0) > 0;
              const isExpanded = showColumns && expandedMemberId === member.id;
              return (
                <React.Fragment key={member.id}>
                  <tr className={excluded ? "bg-[#ece7dc] text-[#777166]" : "odd:bg-[#fbf9f4]"}>
                    <th scope="row" className="border-b border-[#e2ddd1] px-2 py-3 font-medium">
                      <span className={excluded ? "line-through" : ""}>{member.name}</span>
                      {isGrantee && (
                        <span className="ml-2 inline-block text-[10px] font-semibold text-[#244b2e]">
                          GRANTEE
                        </span>
                      )}
                      {excluded && (
                        <span className="ml-2 inline-block border border-[#777166] px-1 text-[9px] uppercase">
                          Hidden from this view
                        </span>
                      )}
                    </th>
                    <td className="border-b border-[#e2ddd1] px-2 py-3">{member.relationship}</td>
                    <td className="border-b border-[#e2ddd1] px-2 py-3 tabular-nums">
                      {member.age ?? "—"}
                    </td>
                    <td className="border-b border-[#e2ddd1] px-2 py-3 font-mono">
                      {member.granteeFlag || "Blank"}
                    </td>
                    <td className="border-b border-[#e2ddd1] px-2 py-3">
                      <span className="font-mono text-xs">Row {member.sourceRow}</span>
                      {showColumns && (
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          onClick={() =>
                            setExpandedMemberId((current) =>
                              current === member.id ? null : member.id,
                            )
                          }
                          className="ml-2 min-h-[32px] text-xs underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
                        >
                          {isExpanded ? "Hide columns" : "Columns"}
                        </button>
                      )}
                      {canCorrect && (
                        <span className="ml-2 inline-block">
                          {excluded ? (
                            <button
                              type="button"
                              onClick={() => onRestoreMember(member.id)}
                              className="min-h-[32px] text-xs underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
                            >
                              Restore
                            </button>
                          ) : excludeMemberId === member.id ? null : (
                            <button
                              type="button"
                              onClick={() => onStartExclusion(member.id)}
                              className="min-h-[32px] text-xs underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
                            >
                              Exclude…
                            </button>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-[#f8f5ee]">
                      <td colSpan={5} className="border-b border-[#e2ddd1] px-3 py-3">
                        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#5b574e]">
                          Spreadsheet row {member.sourceRow} · information as imported
                        </p>
                        <dl className="mt-2 grid gap-x-5 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                          {(household.headers ?? []).map((header, index) => {
                            const value = member.raw?.[index] ?? null;
                            return (
                              <div
                                key={`${header}-${index}`}
                                className="flex items-baseline justify-between gap-3 border-b border-dashed border-[#e2ddd1] py-1"
                              >
                                <dt className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#5b574e]">
                                  {header}
                                </dt>
                                <dd
                                  className={`max-w-[60%] break-words text-right text-xs ${
                                    value ? "text-[#161512]" : "text-[#777166]"
                                  }`}
                                >
                                  {value || "—"}
                                </dd>
                              </div>
                            );
                          })}
                        </dl>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {exclusionMember && canCorrect && (
        <MemberExclusionForm
          member={exclusionMember}
          reason={exclusionReason}
          onReasonChange={onReasonChange}
          onSubmit={onSaveExclusion}
          onCancel={onCancelExclusion}
        />
      )}
    </section>
  );
}
