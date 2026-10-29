import React from "react";
import type { CarDraftHistoryEntry } from "../types";

export function CarRevisionHistory({
  revision,
  history,
}: {
  revision: number;
  history: CarDraftHistoryEntry[];
}) {
  return (
    <section aria-labelledby="car-revision-history-heading" className="border border-[#c9c3b6] bg-[#f8f5ee] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#5b574e]">
            Draft history
          </p>
          <h2 id="car-revision-history-heading" className="mt-1 font-serif text-xl">
            Revision {revision}
          </h2>
        </div>
        <span className="border border-[#8a5a00] bg-[#f3ead8] px-2 py-1 text-[10px] font-medium text-[#704700]">
          Draft only
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-[#5b574e]">
        Local autosave activity is shown for this mock session. This is not a persisted audit log.
      </p>
      {history.length === 0 ? (
        <p className="mt-3 text-sm text-[#5b574e]">No draft history entries yet.</p>
      ) : (
        <ol className="mt-3 space-y-3">
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
    </section>
  );
}
