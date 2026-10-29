import { SectionCard } from "../../../components/ui/section-card";
import { auditEntityLabels, formatAuditTimestamp } from "../lib/audit";
import type { AuditEvent } from "../types";

export function AuditEventList({
  events,
  selectedId,
  onSelect,
}: {
  events: AuditEvent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <SectionCard
      id="audit-event-list-heading"
      title="Audit events"
      className="min-w-0"
      cardClassName="overflow-hidden"
      contentClassName="p-0"
      action={
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#5b574e]">
          {events.length} shown
        </span>
      }
    >
      {events.length === 0 ? (
        <div className="px-4 py-8">
          <p className="font-serif text-lg">No audit events match these filters.</p>
          <p className="mt-1 text-sm leading-6 text-[#5b574e]">
            Adjust the actor, entity, or date range to search the mock log.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[#c9c3b6]">
          {events.map((event) => {
            const selected = event.id === selectedId;
            return (
              <li key={event.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect(event.id)}
                  className={`w-full border-l-4 px-3 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7a1f1f] ${
                    selected
                      ? "border-[#7a1f1f] bg-[#ece7dc]"
                      : "border-transparent hover:bg-[#f8f5ee]"
                  }`}
                >
                  <span className="flex flex-wrap items-start justify-between gap-2">
                    <span className="text-sm font-semibold">{event.action}</span>
                    <span
                      className={`border px-2 py-1 text-[10px] font-medium ${
                        event.outcome === "success"
                          ? "border-[#2f5b3a] bg-[#e6ecdf] text-[#244b2e]"
                          : event.outcome === "failure"
                            ? "border-[#7a1f1f] bg-[#f2e4e1] text-[#7a1f1f]"
                            : "border-[#8a5a00] bg-[#f3ead8] text-[#704700]"
                      }`}
                    >
                      {event.outcome === "success"
                        ? "✓ Success"
                        : event.outcome === "failure"
                          ? "! Failed"
                          : "! Denied"}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs text-[#5b574e]">
                    {auditEntityLabels[event.entityType]} · {event.entityId}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#5b574e]">
                    <span>{event.actorId} · {event.actorRole}</span>
                    <time dateTime={event.occurredAt}>
                      {formatAuditTimestamp(event.occurredAt)}
                    </time>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
