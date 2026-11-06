import { Label } from "../../../components/ui/label";
import { auditEntityLabels } from "../lib/audit";
import type { AuditEntityType, AuditFilters as AuditFilterValues } from "../types";

export function AuditFilters({
  filters,
  resultCount,
  totalCount,
  loading,
  onFilterChange,
  onEntityTypeChange,
  onClear,
}: {
  filters: AuditFilterValues;
  resultCount: number;
  totalCount: number;
  loading: boolean;
  onFilterChange: <Key extends keyof AuditFilterValues>(
    key: Key,
    value: AuditFilterValues[Key],
  ) => void;
  onEntityTypeChange: (value: AuditEntityType | "all") => void;
  onClear: () => void;
}) {
  return (
    <section
      aria-label="Audit log filters"
      className="mt-5 grid gap-3 border-y border-[#c9c3b6] py-4 sm:grid-cols-2 lg:grid-cols-[minmax(150px,1fr)_minmax(150px,1fr)_minmax(140px,0.8fr)_minmax(140px,0.8fr)_minmax(140px,0.8fr)]"
    >
      <div>
        <Label htmlFor="audit-search" className="mb-1 block text-xs font-semibold">
          Search action or record
        </Label>
        <input
          id="audit-search"
          type="search"
          value={filters.search}
          maxLength={80}
          onChange={(event) => onFilterChange("search", event.target.value)}
          placeholder="Action or record reference"
          className="min-h-[44px] w-full border border-[#c9c3b6] bg-white px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
        />
      </div>
      <div>
        <Label htmlFor="audit-actor" className="mb-1 block text-xs font-semibold">
          Account reference
        </Label>
        <input
          id="audit-actor"
          type="text"
          value={filters.actor}
          maxLength={36}
          placeholder="Exact account reference"
          autoComplete="off"
          onChange={(event) => onFilterChange("actor", event.target.value)}
          className="min-h-[44px] w-full border border-[#c9c3b6] bg-white px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
        />
      </div>
      <div>
        <Label htmlFor="audit-entity-type" className="mb-1 block text-xs font-semibold">
          Record type
        </Label>
        <select
          id="audit-entity-type"
          value={filters.entityType}
          onChange={(event) =>
            onEntityTypeChange(event.target.value as AuditEntityType | "all")
          }
          className="min-h-[44px] w-full border border-[#c9c3b6] bg-white px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
        >
          <option value="all">All records</option>
          {Object.entries(auditEntityLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="audit-date-from" className="mb-1 block text-xs font-semibold">
          From date
        </Label>
        <input
          id="audit-date-from"
          type="date"
          value={filters.dateFrom}
          max={filters.dateTo || undefined}
          onChange={(event) => onFilterChange("dateFrom", event.target.value)}
          className="min-h-[44px] w-full border border-[#c9c3b6] bg-white px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
        />
      </div>
      <div>
        <Label htmlFor="audit-date-to" className="mb-1 block text-xs font-semibold">
          To date
        </Label>
        <input
          id="audit-date-to"
          type="date"
          value={filters.dateTo}
          min={filters.dateFrom || undefined}
          onChange={(event) => onFilterChange("dateTo", event.target.value)}
          className="min-h-[44px] w-full border border-[#c9c3b6] bg-white px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
        />
      </div>
      <div className="flex items-end justify-between gap-3 sm:col-span-2 lg:col-span-5">
        <p className="text-xs text-[#5b574e]" aria-live="polite">
          {loading
            ? "Loading audit records…"
            : `Showing ${resultCount} of ${totalCount} matching entries`}
        </p>
        <button
          type="button"
          onClick={onClear}
          disabled={
            !filters.search &&
            !filters.actor &&
            filters.entityType === "all" &&
            !filters.dateFrom &&
            !filters.dateTo
          }
          className="min-h-[40px] px-3 text-xs font-semibold underline underline-offset-2 hover:text-[#7a1f1f] disabled:cursor-not-allowed disabled:text-[#8c877c] disabled:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
        >
          Clear filters
        </button>
      </div>
    </section>
  );
}
