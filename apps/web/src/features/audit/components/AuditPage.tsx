import { useAuth } from "../../../app/providers";
import { useAuditLog } from "../hooks/useAuditLog";
import { AuditEventDetail } from "./AuditEventDetail";
import { AuditEventList } from "./AuditEventList";
import { AuditFilters } from "./AuditFilters";

export function AuditPage() {
  const { roles } = useAuth();
  const canView = roles.some((role) => role === "admin" || role === "auditor");
  const audit = useAuditLog(canView);
  const invalidDateRange =
    Boolean(audit.filters.dateFrom && audit.filters.dateTo) &&
    audit.filters.dateFrom > audit.filters.dateTo;

  if (!canView) {
    return (
      <div
        role="alert"
        className="max-w-[680px] border-l-4 border-[#7a1f1f] border-y border-r border-[#7a1f1f] bg-[#f2e4e1] px-4 py-4"
      >
        <h1 className="font-serif text-2xl">You do not have access to audit records</h1>
        <p className="mt-2 text-sm leading-6 text-[#3f3b34]">
          Audit logs are available to auditors and administrators. No event details are shown.
        </p>
      </div>
    );
  }

  return (
    <div>
      <header className="border-b border-[#161512] pb-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#5b574e]">
          Audit logs
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl leading-none tracking-tight sm:text-5xl">
              Audit trail
            </h1>
            <p className="mt-3 max-w-[62ch] text-sm leading-6 text-[#3f3b34]">
              Review sensitive actions by actor, entity, and date without exposing case details.
            </p>
          </div>
          <span className="border border-[#2f5b3a] bg-[#e6ecdf] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#244b2e]">
            Persisted audit records
          </span>
        </div>
      </header>

      <p className="mt-4 border-l-4 border-[#8c877c] bg-[#ece7dc] px-3 py-2 text-xs leading-5 text-[#3f3b34]">
        Events are loaded from protected server-side audit records. Before/after payload values are
        withheld from this view. Timestamps are UTC.
      </p>

      <AuditFilters
        filters={audit.filters}
        resultCount={invalidDateRange ? 0 : audit.events.length}
        totalCount={invalidDateRange ? 0 : audit.total}
        loading={audit.loading}
        onFilterChange={audit.updateFilter}
        onEntityTypeChange={audit.setEntityType}
        onClear={audit.clearFilters}
      />

      {invalidDateRange && (
        <p role="alert" className="mt-3 text-sm text-[#7a1f1f]">
          The start date must be on or before the end date.
        </p>
      )}

      {audit.error && (
        <div
          role="alert"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 border-l-4 border-[#7a1f1f] border-y border-r border-[#7a1f1f] bg-[#f2e4e1] px-4 py-3"
        >
          <p className="text-sm leading-6 text-[#7a1f1f]">{audit.error}</p>
          <button
            type="button"
            onClick={audit.retry}
            className="min-h-[40px] border border-[#7a1f1f] px-3 text-xs font-semibold text-[#7a1f1f] hover:bg-[#7a1f1f] hover:text-[#f4f1ea] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
          >
            Retry
          </button>
        </div>
      )}

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(280px,0.82fr)_minmax(0,1.5fr)]">
        <AuditEventList
          events={invalidDateRange ? [] : audit.events}
          selectedId={audit.selectedEvent?.id ?? null}
          onSelect={audit.setSelectedId}
          loading={audit.loading && !invalidDateRange}
          error={audit.error}
        />
        <AuditEventDetail event={invalidDateRange ? null : audit.selectedEvent} />
      </div>
      {audit.hasMore && !invalidDateRange && !audit.error && (
        <div className="mt-4">
          <button
            type="button"
            onClick={audit.loadMore}
            disabled={audit.loading}
            className="min-h-[44px] border border-[#161512] px-4 text-sm font-semibold hover:bg-[#161512] hover:text-[#f4f1ea] disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
          >
            {audit.loading ? "Loading…" : "Load more audit events"}
          </button>
        </div>
      )}
    </div>
  );
}
