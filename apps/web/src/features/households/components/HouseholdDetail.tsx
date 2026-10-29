import React from "react";
import type { HouseholdOverlay, HouseholdRecord, HouseholdStatus } from "../types";
import { GranteeResolutionForm } from "./GranteeResolutionForm";
import { HouseholdHistory } from "./HouseholdHistory";
import { HouseholdMembersTable } from "./HouseholdMembersTable";
import { HouseholdStatusLabel } from "./primitives";
import { LinkedCars } from "./LinkedCars";

export function HouseholdDetail({
  household,
  overlay,
  status,
  granteeId,
  canCorrect,
  showResolveForm,
  candidateId,
  resolutionReason,
  excludeMemberId,
  exclusionReason,
  onToggleResolveForm,
  onCandidateChange,
  onResolutionReasonChange,
  onSaveResolution,
  onStartExclusion,
  onExclusionReasonChange,
  onSaveExclusion,
  onCancelExclusion,
  onRestoreMember,
}: {
  household: HouseholdRecord | null;
  overlay?: HouseholdOverlay;
  status: HouseholdStatus | null;
  granteeId?: string;
  canCorrect: boolean;
  showResolveForm: boolean;
  candidateId: string;
  resolutionReason: string;
  excludeMemberId: string | null;
  exclusionReason: string;
  onToggleResolveForm: () => void;
  onCandidateChange: (value: string) => void;
  onResolutionReasonChange: (value: string) => void;
  onSaveResolution: (event: React.FormEvent<HTMLFormElement>) => void;
  onStartExclusion: (memberId: string) => void;
  onExclusionReasonChange: (value: string) => void;
  onSaveExclusion: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancelExclusion: () => void;
  onRestoreMember: (memberId: string) => void;
}) {
  if (!household) {
    return (
      <section
        aria-labelledby="household-detail-heading"
        className="min-w-0 border border-[#c9c3b6] bg-[#f8f5ee] px-5 py-10"
      >
        <h2 id="household-detail-heading" className="font-serif text-2xl">
          Select a household
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#5b574e]">
          Choose a row to inspect member details and source references.
        </p>
      </section>
    );
  }

  const grantee = household.members.find((member) => member.id === granteeId);

  return (
    <section
      aria-labelledby="household-detail-heading"
      className="min-w-0 border border-[#c9c3b6] bg-[#f8f5ee]"
    >
      <header className="border-b border-[#c9c3b6] px-4 py-4 sm:px-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#5b574e]">
          Household detail / {household.importName} · version {household.importVersion}
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="household-detail-heading" className="font-mono text-2xl font-semibold tabular-nums">
              HH_ID {household.hhId}
            </h2>
            <p className="mt-1 text-sm text-[#3f3b34]">
              {household.barangay}, {household.municipality}
            </p>
          </div>
          {status && <HouseholdStatusLabel status={status} />}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#e2ddd1] pt-3">
          <p className="text-sm">
            <span className="font-semibold">Grantee:</span>{" "}
            {grantee ? `${grantee.name} · source row ${grantee.sourceRow}` : "Not validated"}
          </p>
          {status === "valid" && (
            <span className="text-xs font-medium text-[#244b2e]">Exactly one supported Yes flag</span>
          )}
          {canCorrect && status !== "valid" && status !== "resolved" && (
            <button
              type="button"
              onClick={onToggleResolveForm}
              className="min-h-[40px] border border-[#161512] px-3 py-2 text-xs font-semibold hover:bg-[#161512] hover:text-[#f4f1ea] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
            >
              {showResolveForm ? "Cancel correction" : "Resolve grantee"}
            </button>
          )}
        </div>
      </header>

      {showResolveForm && canCorrect && (
        <GranteeResolutionForm
          household={household}
          overlay={overlay}
          candidateId={candidateId}
          reason={resolutionReason}
          onCandidateChange={onCandidateChange}
          onReasonChange={onResolutionReasonChange}
          onSubmit={onSaveResolution}
        />
      )}

      <HouseholdMembersTable
        household={household}
        overlay={overlay}
        granteeId={granteeId}
        canCorrect={canCorrect}
        excludeMemberId={excludeMemberId}
        exclusionReason={exclusionReason}
        onStartExclusion={onStartExclusion}
        onReasonChange={onExclusionReasonChange}
        onSaveExclusion={onSaveExclusion}
        onCancelExclusion={onCancelExclusion}
        onRestoreMember={onRestoreMember}
      />

      <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 sm:px-5">
        <HouseholdHistory overlay={overlay} />
        <LinkedCars household={household} />
      </div>
    </section>
  );
}
