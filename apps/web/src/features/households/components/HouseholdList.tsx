import React from "react";
import type { HouseholdListItem } from "../types";
import { HouseholdStatusLabel } from "./primitives";

export function HouseholdList({
  items,
  selectedId,
  onSelect,
}: {
  items: HouseholdListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section aria-labelledby="household-list-heading" className="min-w-0">
      <div className="flex items-baseline justify-between border-b border-[#161512] pb-2">
        <h2 id="household-list-heading" className="font-serif text-xl">
          Household list
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#5b574e]">
          {items.length} shown
        </span>
      </div>
      {items.length === 0 ? (
        <div className="border-b border-[#c9c3b6] px-3 py-8">
          <p className="font-serif text-lg">No households match those filters.</p>
          <p className="mt-1 text-sm leading-6 text-[#5b574e]">
            Clear the search or choose a different import version.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[#c9c3b6]">
          {items.map(({ household, status }) => {
            const isSelected = household.id === selectedId;
            return (
              <li key={household.id}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelect(household.id)}
                  className={`w-full border-l-4 px-3 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7a1f1f] ${
                    isSelected ? "border-[#7a1f1f] bg-[#ece7dc]" : "border-transparent hover:bg-[#f8f5ee]"
                  }`}
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold tabular-nums">
                      HH_ID {household.hhId}
                    </span>
                    <span className="text-xs text-[#5b574e]">
                      {household.members.length} members
                    </span>
                  </span>
                  <span className="mt-1 block text-xs text-[#5b574e]">
                    {household.barangay} · Import v{household.importVersion}
                  </span>
                  <span className="mt-2 block">
                    <HouseholdStatusLabel status={status} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
