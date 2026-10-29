import React from "react";
import { SectionCard } from "../../../components/ui/section-card";
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
      <SectionCard
        id="household-detail-heading"
        title="Select a household"
        className="min-w-0"
        contentClassName="px-5 py-6 sm:py-10"
      >
        <p className="text-sm leading-6 text-[#5b574e]">
          Choose a row to inspect member details and source references.
        </p>
      </SectionCard>
    );
  }

  const grantee = household.members.find((member) => member.id === granteeId);

  return (
    <SectionCard
      id="household-detail-heading"
      title={`HH_ID ${household.hhId}`}
      titleClassName="font-mono text-2xl font-semibold tabular-nums"
      eyebrow={`Household detail / ${household.importName} · version ${household.importVersion}`}
      description={`${household.barangay}, ${household.municipality}`}
      className="min-w-0"
      cardClassName="overflow-hidden"
      contentClassName="p-0"
      action={status && <HouseholdStatusLabel status={status} />}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e2ddd1] px-4 py-3 sm:px-5">
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
    </SectionCard>
  );
}
