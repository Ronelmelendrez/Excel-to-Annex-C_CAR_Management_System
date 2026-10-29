import React from "react";
import { Label } from "../../../components/ui/label";
import type { TemplateStatusFilter } from "../types";

export function TemplateFilters({
  search,
  status,
  onSearchChange,
  onStatusChange,
}: {
  search: string;
  status: TemplateStatusFilter;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: TemplateStatusFilter) => void;
}) {
  return (
    <section
      aria-label="Template search and filters"
      className="mt-5 grid gap-3 border-y border-[#c9c3b6] py-4 sm:grid-cols-2"
    >
      <div>
        <Label htmlFor="template-search" className="mb-1 block text-xs font-semibold">
          Search templates
        </Label>
        <input
          id="template-search"
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Template name or file name"
          className="min-h-[44px] w-full border border-[#8c877c] bg-[#fbf9f4] px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
        />
      </div>
      <div>
        <Label htmlFor="template-status-filter" className="mb-1 block text-xs font-semibold">
          Version status
        </Label>
        <select
          id="template-status-filter"
          value={status}
          onChange={(event) => onStatusChange(event.target.value as TemplateStatusFilter)}
          className="min-h-[44px] w-full border border-[#8c877c] bg-[#fbf9f4] px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="validated">Validated</option>
          <option value="active">Active</option>
          <option value="retired">Retired</option>
        </select>
      </div>
    </section>
  );
}
