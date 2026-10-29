import React from "react";
import { SectionCard } from "../../../components/ui/section-card";
import type { GeneratedDocumentRecord } from "../types";

export function DocumentProvenance({ record }: { record: GeneratedDocumentRecord }) {
  return (
    <SectionCard
      id="document-provenance-heading"
      eyebrow="Report provenance"
      title={`${record.reference} · Revision ${record.revision}`}
      titleClassName="font-mono text-lg font-semibold"
      description={`${record.householdLabel} · CAR state: ${record.carStatus}`}
    >
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="border-t border-[#e2ddd1] pt-2">
          <dt className="text-xs text-[#5b574e]">Source import</dt>
          <dd className="mt-1 text-sm">{record.importVersion}</dd>
        </div>
        <div className="border-t border-[#e2ddd1] pt-2">
          <dt className="text-xs text-[#5b574e]">Template version</dt>
          <dd className="mt-1 text-sm">{record.templateVersion}</dd>
        </div>
        <div className="border-t border-[#e2ddd1] pt-2">
          <dt className="text-xs text-[#5b574e]">Approved by</dt>
          <dd className="mt-1 text-sm">{record.approvedBy ?? "Not approved"}</dd>
        </div>
        <div className="border-t border-[#e2ddd1] pt-2">
          <dt className="text-xs text-[#5b574e]">Approval time</dt>
          <dd className="mt-1 text-sm">
            {record.approvedAt ? new Date(record.approvedAt).toLocaleString() : "Not approved"}
          </dd>
        </div>
        <div className="border-t border-[#e2ddd1] pt-2">
          <dt className="text-xs text-[#5b574e]">Latest request</dt>
          <dd className="mt-1 text-sm">{record.lastRequestedBy ?? "No export request"}</dd>
        </div>
        <div className="border-t border-[#e2ddd1] pt-2">
          <dt className="text-xs text-[#5b574e]">Request time</dt>
          <dd className="mt-1 text-sm">
            {record.lastRequestedAt
              ? new Date(record.lastRequestedAt).toLocaleString()
              : "No export request"}
          </dd>
        </div>
      </dl>
    </SectionCard>
  );
}
