import { useEffect, useRef } from "react";
import { useAuth } from "../../../app/providers";
import { useAuditLog } from "../hooks/useAuditLog";
import { AlertTriangleIcon } from "../../../components/icons";
import { AuditEventDetail } from "./AuditEventDetail";
import { AuditEventList } from "./AuditEventList";
import { AuditFilters } from "./AuditFilters";
import { PageDataSkeleton } from "../../../components/ui/PageSkeletons";

export function AuditPage() {
  const { roles, user } = useAuth();
  const canView = roles.some((role) => role === "admin" || role === "auditor");
  const audit = useAuditLog(canView, user?.id ?? "");
  const hasLoadedAuditRef = useRef(false);
  const invalidDateRange =
    Boolean(audit.filters.dateFrom && audit.filters.dateTo) &&
    audit.filters.dateFrom > audit.filters.dateTo;

  useEffect(() => {
    if (!audit.loading) hasLoadedAuditRef.current = true;
  }, [audit.loading]);

  if (!canView) {
    return (
      <div
        role="alert"
        className="flex max-w-[680px] items-start gap-3 border-l-4 border-[#7a1f1f] bg-[#f6eaea] px-4 py-4"
      >
        <AlertTriangleIcon className="mt-1 h-5 w-5 shrink-0 text-[#7a1f1f]" />
        <div>
          <h1 className="font-serif text-2xl leading-tight">
            You do not have access to audit records
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#3f3b34]">
            Audit logs are available to auditors and administrators. No event details are shown.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="border-b border-[#161512] pb-5">
        <p className="motion-safe:animate-fade-up font-mono text-[10px] uppercase tracking-[0.2em] text-[#7a1f1f]">
          Audit logs
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1
              className="motion-safe:animate-fade-up font-serif text-4xl leading-none tracking-tight sm:text-5xl"
              style={{ animationDelay: "60ms" }}
            >
              Audit trail
            </h1>
            <p
              className="motion-safe:animate-fade-up mt-3 max-w-[62ch] text-sm leading-6 text-[#3f3b34]"
              style={{ animationDelay: "120ms" }}
            >
              Review sensitive actions by actor, entity, and date without exposing case details.
            </p>
          </div>
          <span
            className="motion-safe:animate-fade-up border border-[#161512] bg-[#fbf9f4] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#161512]"
            style={{ animationDelay: "180ms" }}
          >
            Recorded audit events
          </span>
        </div>
      </header>

      <p className="mt-4 border-l-4 border-[#161512] bg-[#ece7dc] px-3 py-2 text-xs leading-5 text-[#3f3b34]">
        This page shows recorded actions and when they occurred, without displaying sensitive
        details of each change. Times are shown in UTC.
      </p>

      {audit.loading &&
      audit.events.length === 0 &&
      !hasLoadedAuditRef.current &&
      !invalidDateRange ? (
        <PageDataSkeleton page="audit" />
      ) : (
        <>
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
            <p
              role="alert"
              className="mt-3 flex items-start gap-3 border-l-4 border-[#7a1f1f] bg-[#f6eaea] px-3 py-2 text-sm text-[#7a1f1f]"
            >
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>The start date must be on or before the end date.</span>
            </p>
          )}

          {audit.error && (
            <div
              role="alert"
              className="mt-4 flex flex-wrap items-center justify-between gap-3 border-l-4 border-[#7a1f1f] bg-[#f6eaea] px-4 py-3"
            >
              <span className="flex items-start gap-3">
                <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#7a1f1f]" />
                <span className="text-sm leading-6 text-[#7a1f1f]">{audit.error}</span>
              </span>
              <button
                type="button"
                onClick={audit.retry}
                className="min-h-[40px] border border-[#7a1f1f] px-3 text-xs font-semibold text-[#7a1f1f] hover:bg-[#7a1f1f] hover:text-[#f4f1ea] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
              >
                Try again
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
            <AuditEventDetail
              event={invalidDateRange ? null : audit.selectedEvent}
              loading={audit.loading && !invalidDateRange && audit.events.length === 0}
            />
          </div>
          {audit.hasMore && !invalidDateRange && !audit.error && (
            <div className="mt-4">
              <button
                type="button"
                onClick={audit.loadMore}
                disabled={audit.loading}
                className="min-h-[44px] border border-[#161512] px-4 text-sm font-semibold hover:bg-[#161512] hover:text-[#f4f1ea] disabled:cursor-wait disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
              >
                {audit.loading ? "Loading…" : "Load more audit events"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
