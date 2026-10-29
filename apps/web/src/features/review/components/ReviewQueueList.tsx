import React from "react";
import { SectionCard } from "../../../components/ui/section-card";
import { getCurrentReviewStatus } from "../lib/review";
import type { ReviewRecord } from "../types";

export function ReviewQueueList({
  records,
  selectedId,
  onSelect,
}: {
  records: ReviewRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <SectionCard
      id="review-queue-heading"
      title="CAR queue"
      className="min-w-0"
      cardClassName="overflow-hidden"
      contentClassName="p-0"
      action={<span className="font-mono text-[10px] text-[#5b574e]">{records.length} shown</span>}
    >
      {records.length === 0 ? (
        <p className="px-4 py-8 text-sm leading-6 text-[#5b574e]">
          No CARs match these filters. Try another status or search term.
        </p>
      ) : (
        <ul className="divide-y divide-[#c9c3b6]">
          {records.map((record) => {
            const selected = record.id === selectedId;
            const status = getCurrentReviewStatus(record);
            return (
              <li key={record.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect(record.id)}
                  className={`w-full border-l-4 px-3 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7a1f1f] ${
                    selected
                      ? "border-[#7a1f1f] bg-[#ece7dc]"
                      : "border-transparent hover:bg-[#f8f5ee]"
                  }`}
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold">{record.reference}</span>
                    <span
                      className={`border px-2 py-1 text-[10px] font-medium ${
                        status === "approved"
                          ? "border-[#2f5b3a] bg-[#e6ecdf] text-[#244b2e]"
                          : status === "changes_requested"
                            ? "border-[#65418a] bg-[#eee8f4] text-[#50316e]"
                            : "border-[#8a5a00] bg-[#f3ead8] text-[#704700]"
                      }`}
                    >
                      {status === "changes_requested"
                        ? "Changes requested"
                        : status === "approved"
                          ? "Approved"
                          : "Submitted"}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs text-[#5b574e]">
                    {record.householdLabel} · Revision {record.revision}
                  </span>
                  <span className="mt-1 block text-xs text-[#5b574e]">
                    Submitted {new Date(record.submittedAt).toLocaleDateString()}
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
