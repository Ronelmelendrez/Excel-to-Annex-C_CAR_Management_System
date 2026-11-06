import React from "react";
import { Label } from "../../../components/ui/label";
import type { ReviewFilter } from "../types";
import { HouseholdStat } from "./primitives";

export function HouseholdFilters({
  query,
  reviewFilter,
  versionFilter,
  versionOptions,
  householdCount,
  memberCount,
  granteeCount,
  needsReviewCount,
  resultCount,
  statsError,
  onQueryChange,
  onReviewFilterChange,
  onVersionFilterChange,
}: {
  query: string;
  reviewFilter: ReviewFilter;
  versionFilter: string;
  versionOptions: { value: string; label: string }[];
  householdCount: number | null;
  memberCount: number | null;
  granteeCount: number | null;
  needsReviewCount: number | null;
  resultCount: number;
  statsError: string | null;
  onQueryChange: (value: string) => void;
  onReviewFilterChange: (value: ReviewFilter) => void;
  onVersionFilterChange: (value: string) => void;
}) {
  return (
    <>
      <section
        aria-label="Register summary"
        className="grid grid-cols-2 gap-5 border-b border-[#c9c3b6] py-5 sm:grid-cols-4"
      >
        <HouseholdStat label="Households" value={householdCount ?? "—"} />
        <HouseholdStat label="Members" value={memberCount ?? "—"} />
        <HouseholdStat label="Grantee OK" value={granteeCount ?? "—"} />
        <HouseholdStat label="Needs review" value={needsReviewCount ?? "—"} emphasis />
      </section>
      <div className="flex flex-wrap justify-between gap-2 py-2 text-xs text-[#5b574e]" aria-live="polite">
        <span>{statsError ? statsError : "Live Supabase counts · refreshed every 15 seconds"}</span>
        {statsError && <span>Last successful counts remain visible.</span>}
      </div>

      <section aria-label="Household search and filters" className="border-b border-[#c9c3b6] py-5">
        <div className="grid gap-3 md:grid-cols-[minmax(220px,1.5fr)_minmax(160px,1fr)_minmax(180px,1fr)]">
          <div>
            <Label htmlFor="household-search" className="mb-1 block text-xs font-semibold">
              Search households
            </Label>
            <input
              id="household-search"
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="HH_ID, member name, or barangay"
              className="min-h-[44px] w-full border border-[#8c877c] bg-[#f8f5ee] px-3 text-sm placeholder:text-[#777166] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#7a1f1f]"
            />
          </div>
          <div>
            <Label htmlFor="review-filter" className="mb-1 block text-xs font-semibold">
              Grantee status
            </Label>
            <select
              id="review-filter"
              value={reviewFilter}
              onChange={(event) => onReviewFilterChange(event.target.value as ReviewFilter)}
              className="min-h-[44px] w-full border border-[#8c877c] bg-[#f8f5ee] px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#7a1f1f]"
            >
              <option value="all">All households</option>
              <option value="needs_review">Needs review</option>
              <option value="ok">Grantee OK</option>
              <option value="resolved">Resolved by staff</option>
            </select>
          </div>
          <div>
            <Label htmlFor="import-filter" className="mb-1 block text-xs font-semibold">
              Import version
            </Label>
            <select
              id="import-filter"
              value={versionFilter}
              onChange={(event) => onVersionFilterChange(event.target.value)}
              className="min-h-[44px] w-full border border-[#8c877c] bg-[#f8f5ee] px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#7a1f1f]"
            >
              <option value="all">All versions</option>
              {versionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="mt-3 text-xs text-[#5b574e]" aria-live="polite">
          Showing {resultCount} of {householdCount ?? "—"}{" "}
          households
        </p>
      </section>
    </>
  );
}
