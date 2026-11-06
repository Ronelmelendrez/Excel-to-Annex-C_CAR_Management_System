import React from "react";
import { useAuth } from "../../../app/providers";
import { useHouseholdRegister } from "../hooks/useHouseholdRegister";
import { HouseholdDetail } from "./HouseholdDetail";
import { HouseholdFilters } from "./HouseholdFilters";
import { HouseholdList } from "./HouseholdList";
import { AlertTriangleIcon, CheckIcon } from "../../../components/icons";
import { PageDataSkeleton } from "../../../components/ui/PageSkeletons";

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
        className="flex max-w-[680px] items-start gap-3 border-l-4 border-[#7a1f1f] bg-[#f6eaea] px-4 py-4"
      >
        <AlertTriangleIcon className="mt-1 h-5 w-5 shrink-0 text-[#7a1f1f]" />
        <div>
          <h1 className="font-serif text-2xl leading-tight">
            You do not have access to household records
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#3f3b34]">
            Ask an administrator to review your account role. No household details are shown.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="border-b border-[#161512] pb-5">
        <p className="motion-safe:animate-fade-up font-mono text-[10px] uppercase tracking-[0.2em] text-[#7a1f1f]">
          Household register
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1
              className="motion-safe:animate-fade-up font-serif text-4xl leading-none tracking-tight sm:text-5xl"
              style={{ animationDelay: "60ms" }}
            >
              Households
            </h1>
            <p
              className="motion-safe:animate-fade-up mt-3 max-w-[62ch] text-sm leading-6 text-[#3f3b34]"
              style={{ animationDelay: "120ms" }}
            >
              Review household members and check GRANTEE information against the original spreadsheet.
            </p>
          </div>
          <span
            className="motion-safe:animate-fade-up border border-[#161512] bg-[#fbf9f4] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#161512]"
            style={{ animationDelay: "180ms" }}
          >
            Household records
          </span>
        </div>
      </header>

      <p
        role="status"
        className="mt-4 flex items-start gap-3 border-l-4 border-[#b45309] bg-[#f3ead8] px-4 py-3 text-sm leading-6 text-[#704700]"
      >
        <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#b45309]" />
        <span>
          Editing household details and excluding members are temporarily unavailable so every change
          can be recorded. You can still search and review household records.
        </span>
      </p>

      {register.loading ? (
        <div className="mt-5">
          <PageDataSkeleton page="households" />
        </div>
      ) : register.loadError ? (
        <div
          role="alert"
          className="mt-5 flex items-start gap-3 border-l-4 border-[#7a1f1f] bg-[#f6eaea] px-4 py-4"
        >
          <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#7a1f1f]" />
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
              className="mt-4 flex items-start gap-3 border-l-4 border-[#7a1f1f] bg-[#f6eaea] px-4 py-3 text-sm leading-6 text-[#3f3b34]"
            >
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#7a1f1f]" />
              <span>{register.searchError}</span>
            </p>
          )}

          {register.refreshError && (
            <p
              role="status"
              className="mt-4 flex items-start gap-3 border-l-4 border-[#b45309] bg-[#f3ead8] px-4 py-3 text-sm leading-6 text-[#704700]"
            >
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#b45309]" />
              <span>
                {register.refreshError} Showing the last loaded household records.
              </span>
            </p>
          )}

          {register.feedback && (
            <p
              role="status"
              className="mt-4 flex items-start gap-3 border-l-4 border-[#161512] bg-[#fbf9f4] px-4 py-3 text-sm leading-6 text-[#161512]"
            >
              <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#7a1f1f]" />
              <span>{register.feedback}</span>
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
