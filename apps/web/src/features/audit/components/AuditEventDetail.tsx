import { SectionCard } from "../../../components/ui/section-card";
import { auditEntityLabels, formatAuditTimestamp } from "../lib/audit";
import type { AuditEvent } from "../types";

export function AuditEventDetail({ event }: { event: AuditEvent | null }) {
  if (!event) {
    return (
      <SectionCard id="audit-event-detail-heading" title="Event details">
        <p className="text-sm leading-6 text-[#5b574e]">
          Select an audit event to inspect its minimized details.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      id="audit-event-detail-heading"
      title="Event details"
      description="Only operational metadata is shown. Sensitive before/after values are omitted from this sample."
      eyebrow={event.id}
      action={
        <span
          role="status"
          className={`border px-2 py-1 text-[10px] font-semibold ${
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
      }
    >
      <dl className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-[#5b574e]">Action</dt>
          <dd className="mt-1 text-sm font-semibold">{event.action}</dd>
        </div>
        <div>
          <dt className="text-xs text-[#5b574e]">Actor</dt>
          <dd className="mt-1 text-sm">{event.actorId} · {event.actorRole}</dd>
        </div>
        <div>
          <dt className="text-xs text-[#5b574e]">Entity</dt>
          <dd className="mt-1 text-sm">
            {auditEntityLabels[event.entityType]} · <span className="font-mono">{event.entityId}</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[#5b574e]">Timestamp</dt>
          <dd className="mt-1 text-sm">
            <time dateTime={event.occurredAt}>{formatAuditTimestamp(event.occurredAt)}</time>
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-[#5b574e]">Event summary</dt>
          <dd className="mt-1 text-sm leading-6">{event.summary}</dd>
        </div>
      </dl>

      <div className="mt-5 border-t border-[#c9c3b6] pt-4">
        <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">
          Change summary
        </h3>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="border-l-2 border-[#8c877c] pl-3">
            <dt className="text-xs text-[#5b574e]">Before</dt>
            <dd className="mt-1 text-sm leading-5">{event.before ?? "No prior value recorded"}</dd>
          </div>
          <div className="border-l-2 border-[#2f5b3a] pl-3">
            <dt className="text-xs text-[#5b574e]">After</dt>
            <dd className="mt-1 text-sm leading-5">{event.after ?? "No resulting value recorded"}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs leading-5 text-[#5b574e]">
          Personal and case-sensitive payloads are intentionally omitted from this sample.
        </p>
      </div>
    </SectionCard>
  );
}
