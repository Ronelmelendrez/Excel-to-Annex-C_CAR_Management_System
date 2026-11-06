import { SectionCard } from "../../../components/ui/section-card";
import {
  formatAuditAction,
  formatAuditEntityType,
  formatAuditTimestamp,
} from "../lib/audit";
import type { AuditEvent } from "../types";

export function AuditEventDetail({ event }: { event: AuditEvent | null }) {
  if (!event) {
    return (
      <SectionCard id="audit-event-detail-heading" title="Event details">
        <p className="text-sm leading-6 text-[#5b574e]">
          Select an audit event to inspect its operational metadata.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      id="audit-event-detail-heading"
      title="Event details"
      description="Only operational metadata is shown. Stored before/after values are not exposed here."
      eyebrow={event.id}
      action={
        <span className="border border-[#8c877c] px-2 py-1 text-[10px] font-semibold text-[#3f3b34]">
          Recorded
        </span>
      }
    >
      <dl className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-[#5b574e]">Action</dt>
          <dd className="mt-1 text-sm font-semibold">{formatAuditAction(event.action)}</dd>
        </div>
        <div>
          <dt className="text-xs text-[#5b574e]">Actor ID</dt>
          <dd className="mt-1 text-sm">{event.actorId ?? "System actor"}</dd>
        </div>
        <div>
          <dt className="text-xs text-[#5b574e]">Entity</dt>
          <dd className="mt-1 text-sm">
            {formatAuditEntityType(event.entityType)}
            {event.entityId && <> · <span className="font-mono">{event.entityId}</span></>}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[#5b574e]">Timestamp</dt>
          <dd className="mt-1 text-sm">
            <time dateTime={event.occurredAt}>{formatAuditTimestamp(event.occurredAt)}</time>
          </dd>
        </div>
      </dl>

      <div className="mt-5 border-t border-[#c9c3b6] pt-4">
        <p className="mt-4 text-xs leading-5 text-[#5b574e]">
          Before/after payload values are intentionally omitted from the audit view.
        </p>
      </div>
    </SectionCard>
  );
}
