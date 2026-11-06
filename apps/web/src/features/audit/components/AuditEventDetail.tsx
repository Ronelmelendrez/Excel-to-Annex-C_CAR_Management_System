import { SectionCard } from "../../../components/ui/section-card";
import {
  formatAuditAction,
  formatAuditEntityType,
  formatAuditTimestamp,
} from "../lib/audit";
import type { AuditEvent } from "../types";

export function AuditEventDetail({
  event,
  loading = false,
}: {
  event: AuditEvent | null;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <SectionCard id="audit-event-detail-heading" title="Audit entry">
        <div role="status" aria-label="Loading audit entry" className="motion-safe:animate-pulse">
          <div aria-hidden="true" className="grid gap-5 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index}>
                <div className="h-3 w-20 bg-[#e6e0d4]" />
                <div className="mt-2 h-4 w-36 bg-[#e6e0d4]" />
              </div>
            ))}
          </div>
        </div>
      </SectionCard>
    );
  }

  if (!event) {
    return (
      <SectionCard id="audit-event-detail-heading" title="Audit entry">
        <p className="text-sm leading-6 text-[#5b574e]">
          Choose an entry to see what happened.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      id="audit-event-detail-heading"
      title="Audit entry"
      delay={300}
      description="This record shows what happened and when. Sensitive details of the change are not shown."
      eyebrow={event.id}
      action={
        <span className="border border-[#161512] px-2 py-1 text-[10px] font-semibold text-[#161512]">
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
          <dt className="text-xs text-[#5b574e]">Account reference</dt>
          <dd className="mt-1 text-sm">{event.actorId ?? "System actor"}</dd>
        </div>
        <div>
          <dt className="text-xs text-[#5b574e]">Record</dt>
          <dd className="mt-1 text-sm">
            {formatAuditEntityType(event.entityType)}
            {event.entityId && <> · <span className="font-mono">{event.entityId}</span></>}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[#5b574e]">Time</dt>
          <dd className="mt-1 text-sm">
            <time dateTime={event.occurredAt}>{formatAuditTimestamp(event.occurredAt)}</time>
          </dd>
        </div>
      </dl>

      <div className="mt-5 border-t border-[#c9c3b6] pt-4">
        <p className="mt-4 text-xs leading-5 text-[#5b574e]">
          Sensitive before-and-after details are not displayed here.
        </p>
      </div>
    </SectionCard>
  );
}
