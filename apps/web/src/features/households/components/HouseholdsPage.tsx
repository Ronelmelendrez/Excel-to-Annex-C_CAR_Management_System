import React from "react";
import { useAuth } from "../../../app/providers";
import { mockHouseholds } from "../mock-data";
import { useHouseholdRegister } from "../hooks/useHouseholdRegister";
import { HouseholdDetail } from "./HouseholdDetail";
import { HouseholdFilters } from "./HouseholdFilters";
import { HouseholdList } from "./HouseholdList";

export function HouseholdsPage() {
  const { user, profile, roles } = useAuth();
  const actor = profile?.display_name || user?.email || "Signed-in staff";
  const register = useHouseholdRegister(actor);
  const canCorrect = roles.some((role) => ["admin", "case_worker", "reviewer"].includes(role));
  const canView = roles.some((role) =>
    ["admin", "operator", "case_worker", "reviewer", "auditor"].includes(role),
  );

  if (!canView) {
    return (
      <div
        role="alert"
        className="max-w-[680px] border-l-4 border-[#7a1f1f] border-y border-r border-[#7a1f1f] bg-[#f2e4e1] px-4 py-4"
      >
        <h1 className="font-serif text-2xl">You do not have access to household records</h1>
        <p className="mt-2 text-sm leading-6 text-[#3f3b34]">
          Ask an administrator to review your account role. No household details are shown.
        </p>
      </div>
    );
  }

  return (
    <div>
      <header className="border-b border-[#161512] pb-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#5b574e]">
          Household register
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl leading-none tracking-tight sm:text-5xl">
              Households
            </h1>
            <p className="mt-3 max-w-[62ch] text-sm leading-6 text-[#3f3b34]">
              Check household members and resolve GRANTEE conflicts against the imported source rows.
            </p>
          </div>
          <span className="border border-[#8a5a00] bg-[#f3ead8] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#704700]">
            Mock records · local changes reset on reload
          </span>
        </div>
      </header>

      <HouseholdFilters
        query={register.query}
        reviewFilter={register.reviewFilter}
        versionFilter={register.versionFilter}
        householdCount={mockHouseholds.length}
        memberCount={register.totalMembers}
        granteeCount={register.granteeCount}
        needsReviewCount={register.needsReviewCount}
        resultCount={register.visibleHouseholds.length}
        onQueryChange={register.setQuery}
        onReviewFilterChange={register.setReviewFilter}
        onVersionFilterChange={register.setVersionFilter}
      />

      {register.feedback && (
        <p
          role="status"
          className="mt-4 border-l-4 border-[#2f5b3a] bg-[#e6ecdf] px-4 py-3 text-sm leading-6 text-[#244b2e]"
        >
          {register.feedback}
        </p>
      )}

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.7fr)]">
        <HouseholdList
          items={register.visibleHouseholds}
          selectedId={register.selected?.id ?? null}
          onSelect={register.selectHousehold}
        />
        <HouseholdDetail
          household={register.selected}
          overlay={register.selectedOverlay}
          status={register.selectedStatus}
          granteeId={register.activeGrantee?.id}
          canCorrect={canCorrect}
          showResolveForm={register.showResolveForm}
          candidateId={register.candidateId}
          resolutionReason={register.resolutionReason}
          excludeMemberId={register.excludeMemberId}
          exclusionReason={register.exclusionReason}
          onToggleResolveForm={register.toggleResolveForm}
          onCandidateChange={register.setCandidateId}
          onResolutionReasonChange={register.setResolutionReason}
          onSaveResolution={register.saveResolution}
          onStartExclusion={register.startExclusion}
          onExclusionReasonChange={register.setExclusionReason}
          onSaveExclusion={register.saveExclusion}
          onCancelExclusion={register.cancelExclusion}
          onRestoreMember={register.restoreMember}
        />
      </div>
    </div>
  );
}
