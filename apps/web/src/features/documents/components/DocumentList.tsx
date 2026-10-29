import React from "react";
import { SectionCard } from "../../../components/ui/section-card";
import type { GeneratedDocumentRecord } from "../types";

function statusStyle(status: GeneratedDocumentRecord["carStatus"]) {
  if (status === "approved") return "border-[#2f5b3a] bg-[#e6ecdf] text-[#244b2e]";
  if (status === "submitted") return "border-[#185a8b] bg-[#e4edf4] text-[#174c75]";
  return "border-[#8a5a00] bg-[#f3ead8] text-[#704700]";
}

export function DocumentList({
  records,
  selectedId,
  onSelect,
}: {
  records: GeneratedDocumentRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <SectionCard
      id="document-list-heading"
      title="Reports"
      className="min-w-0"
      cardClassName="overflow-hidden"
      contentClassName="p-0"
      action={<span className="font-mono text-[10px] text-[#5b574e]">{records.length} shown</span>}
    >
      {records.length === 0 ? (
        <p className="px-4 py-8 text-sm leading-6 text-[#5b574e]">
          No reports match these filters. Try another CAR reference or approval status.
        </p>
      ) : (
        <ul className="divide-y divide-[#c9c3b6]">
          {records.map((record) => {
            const selected = record.id === selectedId;
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
                    <span className={`border px-2 py-1 text-[10px] font-medium ${statusStyle(record.carStatus)}`}>
                      {record.carStatus === "approved"
                        ? "Approved"
                        : record.carStatus === "submitted"
                          ? "Submitted"
                          : "Draft"}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs text-[#5b574e]">
                    {record.householdLabel} · Revision {record.revision}
                  </span>
                  <span className="mt-1 block text-xs text-[#5b574e]">
                    DOCX {record.jobs.find((job) => job.format === "docx")?.status ?? "not generated"}
                    {" · "}
                    PDF {record.jobs.find((job) => job.format === "pdf")?.status ?? "not generated"}
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
