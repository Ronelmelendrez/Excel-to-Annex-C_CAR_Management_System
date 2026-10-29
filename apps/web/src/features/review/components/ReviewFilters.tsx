import React from "react";
import { Label } from "../../../components/ui/label";
import type { ReviewStatusFilter } from "../types";

export function ReviewFilters({
  search,
  status,
  total,
  pending,
  onSearchChange,
  onStatusChange,
}: {
  search: string;
  status: ReviewStatusFilter;
  total: number;
  pending: number;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: ReviewStatusFilter) => void;
}) {
  return (
    <section
      aria-label="Review queue filters"
      className="mt-5 grid gap-4 border-y border-[#c9c3b6] py-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_220px_auto]"
    >
      <div>
        <Label htmlFor="review-search" className="block text-xs font-semibold">
          Search CAR or household
        </Label>
        <input
          id="review-search"
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="CAR reference or HH_ID"
          className="mt-1 min-h-[44px] w-full border border-[#8c877c] bg-[#fbf9f4] px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
        />
      </div>
      <div>
        <Label htmlFor="review-status" className="block text-xs font-semibold">
          Review status
        </Label>
        <select
          id="review-status"
          value={status}
          onChange={(event) => onStatusChange(event.target.value as ReviewStatusFilter)}
          className="mt-1 min-h-[44px] w-full border border-[#8c877c] bg-[#fbf9f4] px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
        >
          <option value="submitted">Awaiting review</option>
          <option value="all">All statuses</option>
          <option value="approved">Approved</option>
          <option value="changes_requested">Changes requested</option>
        </select>
      </div>
      <div className="flex items-end">
        <p className="text-xs leading-5 text-[#5b574e]">
          {pending} awaiting review · {total} mock records
        </p>
      </div>
    </section>
  );
}
