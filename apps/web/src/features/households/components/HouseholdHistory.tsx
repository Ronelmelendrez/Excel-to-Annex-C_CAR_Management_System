import React from "react";
import type { HouseholdOverlay } from "../types";
import { formatHouseholdEventTime } from "../lib/households";
import { HouseholdSectionHeading } from "./primitives";

export function HouseholdHistory({ overlay }: { overlay?: HouseholdOverlay }) {
  return (
    <section aria-labelledby="household-history-heading">
      <HouseholdSectionHeading id="household-history-heading">
        Correction history
      </HouseholdSectionHeading>
      {(overlay?.events.length ?? 0) === 0 ? (
        <p className="mt-2 text-sm text-[#5b574e]">No local overlays recorded for this household.</p>
      ) : (
        <ol className="mt-2 space-y-3">
          {overlay?.events
            .slice()
            .reverse()
            .map((entry, index) => (
              <li key={`${entry.at}-${index}`} className="border-l-2 border-[#8a5a00] pl-3">
                <p className="text-sm font-semibold">
                  {entry.action} · {entry.memberName}
                </p>
                <p className="mt-1 text-xs leading-5 text-[#5b574e]">{entry.reason}</p>
                <p className="mt-1 text-xs text-[#5b574e]">
                  Before: {entry.beforeValue} · After: {entry.afterValue}
                </p>
                <p className="mt-1 font-mono text-[10px] text-[#5b574e]">
                  {entry.actor} · {formatHouseholdEventTime(entry.at)}
                </p>
              </li>
            ))}
        </ol>
      )}
    </section>
  );
}
