import React from "react";
import { Label } from "../../../components/ui/label";
import type { DocumentFilter } from "../types";

export function DocumentFilters({
  search,
  filter,
  recordsCount,
  onSearchChange,
  onFilterChange,
}: {
  search: string;
  filter: DocumentFilter;
  recordsCount: number;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: DocumentFilter) => void;
}) {
  return (
    <section
      aria-label="Document search and filters"
      className="mt-5 grid gap-3 border-y border-[#c9c3b6] py-4 sm:grid-cols-[minmax(0,1.5fr)_minmax(180px,1fr)_auto]"
    >
      <div>
        <Label htmlFor="document-search" className="mb-1 block text-xs font-semibold">
          Search report or household
        </Label>
        <input
          id="document-search"
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="CAR reference or HH_ID"
          className="min-h-[44px] w-full border border-[#8c877c] bg-[#fbf9f4] px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
        />
      </div>
      <div>
        <Label htmlFor="document-filter" className="mb-1 block text-xs font-semibold">
          CAR approval status
        </Label>
        <select
          id="document-filter"
          value={filter}
          onChange={(event) => onFilterChange(event.target.value as DocumentFilter)}
          className="min-h-[44px] w-full border border-[#8c877c] bg-[#fbf9f4] px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
        >
          <option value="all">All records</option>
          <option value="approved">Approved CARs</option>
          <option value="not_approved">Not approved</option>
        </select>
      </div>
      <p className="self-end text-xs text-[#5b574e]">{recordsCount} mock records</p>
    </section>
  );
}
