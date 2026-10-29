import React from "react";
import { SectionCard } from "../../../components/ui/section-card";
import { getCurrentReviewStatus } from "../lib/review";
import type { ReviewRecord } from "../types";
import { ReviewGateChecklist } from "./ReviewGateChecklist";

export function ReviewDetail({ record }: { record: ReviewRecord | null }) {
  if (!record) {
    return (
      <SectionCard id="review-detail-heading" title="Select a CAR to review">
        <p className="text-sm leading-6 text-[#5b574e]">
          Choose a submitted CAR from the queue to inspect its revision and approval checks.
        </p>
      </SectionCard>
    );
  }

  const status = getCurrentReviewStatus(record);

  return (
    <div className="min-w-0 space-y-4">
      <SectionCard
        id="review-detail-heading"
        eyebrow="Submitted CAR / mock record"
        title={`${record.reference} · Revision ${record.revision}`}
        titleClassName="font-mono text-lg font-semibold sm:text-xl"
        description={`${record.householdLabel} · submitted ${new Date(record.submittedAt).toLocaleString()}`}
        action={
          <span
            className={`border px-2 py-1 text-[10px] font-semibold ${
              status === "approved"
                ? "border-[#2f5b3a] bg-[#e6ecdf] text-[#244b2e]"
                : status === "changes_requested"
                  ? "border-[#65418a] bg-[#eee8f4] text-[#50316e]"
                  : "border-[#185a8b] bg-[#e4edf4] text-[#174c75]"
            }`}
          >
            {status === "changes_requested"
              ? "Changes requested"
              : status === "approved"
                ? "Approved"
                : "Submitted"}
          </span>
        }
      >
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="border-t border-[#e2ddd1] pt-2">
            <dt className="text-xs text-[#5b574e]">Submitted by</dt>
            <dd className="mt-1 text-sm">{record.submittedByLabel}</dd>
          </div>
          <div className="border-t border-[#e2ddd1] pt-2">
            <dt className="text-xs text-[#5b574e]">Source import</dt>
            <dd className="mt-1 text-sm">{record.importVersion}</dd>
          </div>
          <div className="border-t border-[#e2ddd1] pt-2">
            <dt className="text-xs text-[#5b574e]">Template version</dt>
            <dd className="mt-1 text-sm">{record.templateVersion}</dd>
          </div>
          <div className="border-t border-[#e2ddd1] pt-2">
            <dt className="text-xs text-[#5b574e]">Revision status</dt>
            <dd className="mt-1 text-sm">
              {status === "approved"
                ? "Approved revision · read-only"
                : status === "changes_requested"
                  ? "Returned for changes"
                  : "Awaiting reviewer decision"}
            </dd>
          </div>
        </dl>
        <p className="mt-4 border-l-4 border-[#8a5a00] bg-[#f3ead8] px-3 py-2 text-xs leading-5 text-[#704700]">
          This is sample review metadata only. CAR narrative and case details are not included in this mock queue.
        </p>
      </SectionCard>
      <ReviewGateChecklist gates={record.gates} />
    </div>
  );
}
