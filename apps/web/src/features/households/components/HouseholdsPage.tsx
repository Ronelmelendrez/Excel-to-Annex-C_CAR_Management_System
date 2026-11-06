import React from "react";
import { useAuth } from "../../../app/providers";
import { useHouseholdRegister } from "../hooks/useHouseholdRegister";
import { HouseholdDetail } from "./HouseholdDetail";
import { HouseholdFilters } from "./HouseholdFilters";
import { HouseholdList } from "./HouseholdList";

export function HouseholdsPage() {
  const { user, profile, roles } = useAuth();
  const actor = profile?.display_name || user?.email || "Signed-in staff";
  const canView = roles.some((role) =>
    ["admin", "operator", "case_worker", "reviewer", "auditor"].includes(role),
  );
  const cacheOwner = user?.id
    ? `${user.id}:${[...roles].sort().join(",")}`
    : "";
  const register = useHouseholdRegister(actor, canView, cacheOwner);

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
          <span className="border border-[#2f5b3a] bg-[#e6ecdf] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#244b2e]">
            Supabase household records
          </span>
        </div>
      </header>

      <p
        role="status"
        className="mt-4 border-l-4 border-[#8a5a00] bg-[#f3ead8] px-4 py-3 text-sm leading-6 text-[#704700]"
      >
        Household corrections and member exclusions are paused until changes can be saved and
        audited by the server. You can still search and inspect source records.
      </p>

      {register.loading ? (
        <p
          role="status"
          className="mt-5 border-l-4 border-[#4a5a72] bg-[#e9edf3] px-4 py-4 text-sm leading-6 text-[#31405a]"
        >
          Loading household records from Supabase…
        </p>
      ) : register.loadError ? (
        <div
          role="alert"
          className="mt-5 border-l-4 border-[#7a1f1f] border-y border-r border-[#7a1f1f] bg-[#f2e4e1] px-4 py-4"
        >
          <p className="text-sm font-semibold leading-6 text-[#3f3b34]">{register.loadError}</p>
          <button
            type="button"
            onClick={register.reload}
            className="mt-3 min-h-[40px] border border-[#161512] px-3 py-2 text-xs font-semibold hover:bg-[#161512] hover:text-[#f4f1ea] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <HouseholdFilters
            query={register.query}
            reviewFilter={register.reviewFilter}
            versionFilter={register.versionFilter}
            versionOptions={register.versionOptions}
            householdCount={register.registerStats?.householdCount ?? null}
            memberCount={register.registerStats?.memberCount ?? null}
            granteeCount={register.registerStats?.granteeCount ?? null}
            needsReviewCount={register.registerStats?.needsReviewCount ?? null}
            resultCount={register.visibleHouseholds.length}
            statsError={register.statsError}
            onQueryChange={register.setQuery}
            onReviewFilterChange={register.setReviewFilter}
            onVersionFilterChange={register.setVersionFilter}
          />

          {register.searchError && (
            <p
              role="alert"
              className="mt-4 border-l-4 border-[#7a1f1f] bg-[#f2e4e1] px-4 py-3 text-sm leading-6 text-[#3f3b34]"
            >
              {register.searchError}
            </p>
          )}

          {register.refreshError && (
            <p
              role="status"
              className="mt-4 border-l-4 border-[#8a5a00] bg-[#f3ead8] px-4 py-3 text-sm leading-6 text-[#704700]"
            >
              {register.refreshError} Showing the last loaded household records.
            </p>
          )}

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
              total={register.registerStats?.householdCount ?? register.households.length}
              selectedId={register.selected?.id ?? null}
              onSelect={register.selectHousehold}
            />
            <HouseholdDetail
              household={register.selected}
              overlay={register.selectedOverlay}
              status={register.selectedStatus}
              granteeId={register.activeGrantee?.id}
              canCorrect={false}
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
        </>
      )}
    </div>
  );
}
