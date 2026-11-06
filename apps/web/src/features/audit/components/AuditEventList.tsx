import { SectionCard } from "../../../components/ui/section-card";
import {
  formatAuditAction,
  formatAuditEntityType,
  formatAuditTimestamp,
} from "../lib/audit";
import type { AuditEvent } from "../types";

export function AuditEventList({
  events,
  selectedId,
  onSelect,
  loading,
  error,
}: {
  events: AuditEvent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
  error: string | null;
}) {
  return (
    <SectionCard
      id="audit-event-list-heading"
      title="Audit events"
      delay={240}
      className="min-w-0"
      cardClassName="overflow-hidden"
      contentClassName="p-0"
      action={
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#5b574e]">
          {events.length} loaded
        </span>
      }
    >
      {events.length === 0 && loading ? (
        <div role="status" aria-label="Loading audit events" className="px-3 py-3">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} aria-hidden="true" className="motion-safe:animate-pulse border-b border-[#e2ddd1] py-3 last:border-0">
              <div className="h-4 w-2/3 bg-[#e6e0d4]" />
              <div className="mt-2 h-3 w-1/2 bg-[#e6e0d4]" />
              <div className="mt-2 h-3 w-3/4 bg-[#e6e0d4]" />
            </div>
          ))}
        </div>
      ) : events.length === 0 && error ? (
        <p className="px-4 py-8 text-sm text-[#5b574e]">
          Audit events could not be loaded.
        </p>
      ) : events.length === 0 ? (
        <div className="px-4 py-8">
          <p className="font-serif text-lg">No audit events match these filters.</p>
          <p className="mt-1 text-sm leading-6 text-[#5b574e]">
            Adjust the actor, entity, or date range and try again.
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
                      : "border-transparent hover:bg-[#fbf9f4]"
                  }`}
                >
                  <span className="flex flex-wrap items-start justify-between gap-2">
                    <span className="text-sm font-semibold">
                      {formatAuditAction(event.action)}
                    </span>
                    <span className="border border-[#161512] px-2 py-1 text-[10px] font-medium text-[#161512]">
                      Recorded
                    </span>
                  </span>
                  <span className="mt-1 block text-xs text-[#5b574e]">
                    {formatAuditEntityType(event.entityType)}
                    {event.entityId ? ` · ${event.entityId}` : ""}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#5b574e]">
                    <span>{event.actorId ?? "System actor"}</span>
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
