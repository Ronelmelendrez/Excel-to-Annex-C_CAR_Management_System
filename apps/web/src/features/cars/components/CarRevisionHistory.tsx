import React from "react";
import { SectionCard } from "../../../components/ui/section-card";
import type { CarDraftHistoryEntry } from "../types";

export function CarRevisionHistory({
  revision,
  history,
}: {
  revision: number;
  history: CarDraftHistoryEntry[];
}) {
  return (
    <SectionCard
      id="car-revision-history-heading"
      eyebrow="Draft history"
      title={`Revision ${revision}`}
      description="Local autosave activity is shown for this mock session. This is not a persisted audit log."
      action={
        <span className="border border-[#8a5a00] bg-[#f3ead8] px-2 py-1 text-[10px] font-medium text-[#704700]">
          Draft only
        </span>
      }
      contentClassName="pt-0"
    >
      {history.length === 0 ? (
        <p className="text-sm text-[#5b574e]">No draft history entries yet.</p>
      ) : (
        <ol className="space-y-3">
          {history.map((entry) => (
            <li key={entry.id} className="border-l-2 border-[#8c877c] pl-3">
              <p className="text-sm font-medium">{entry.label}</p>
              <time dateTime={entry.at} className="mt-1 block font-mono text-[10px] text-[#5b574e]">
                {new Date(entry.at).toLocaleString()}
              </time>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}
