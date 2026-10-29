import React from "react";
import type { CarChecklistItem } from "../types";

export function CarChecklist({
  items,
  missingCount,
  onJumpToField,
}: {
  items: CarChecklistItem[];
  missingCount: number;
  onJumpToField: (fieldId: string) => void;
}) {
  return (
    <section aria-labelledby="car-checklist-heading" className="border border-[#c9c3b6] bg-[#f8f5ee] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#5b574e]">
            Working checklist
          </p>
          <h2 id="car-checklist-heading" className="mt-1 font-serif text-xl">Draft completeness</h2>
        </div>
        <span className="font-mono text-sm tabular-nums">{missingCount} missing</span>
      </div>
      <p className="mt-2 text-xs leading-5 text-[#5b574e]">
        Sample checks for this mock UI. The official CAR template and required-field policy are not connected.
      </p>
      <ul className="mt-3 divide-y divide-[#e2ddd1]">
        {items.map((item) => (
          <li key={item.id} className="py-2">
            {item.complete ? (
              <span className="flex items-start gap-2 text-sm text-[#244b2e]">
                <span aria-hidden="true">✓</span>
                <span>{item.label}</span>
                <span className="sr-only">Complete</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onJumpToField(item.id)}
                className="flex min-h-[32px] items-start gap-2 text-left text-sm text-[#704700] underline decoration-1 underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
              >
                <span aria-hidden="true">!</span>
                <span>{item.label}</span>
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
