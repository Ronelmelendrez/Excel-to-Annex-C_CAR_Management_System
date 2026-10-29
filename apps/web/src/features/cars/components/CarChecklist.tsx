import React from "react";
import { SectionCard } from "../../../components/ui/section-card";
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
    <SectionCard
      id="car-checklist-heading"
      eyebrow="Working checklist"
      title="Draft completeness"
      description={
        <span className="text-xs leading-5">
          Sample checks for this mock UI. The official CAR template and required-field policy are not connected.
        </span>
      }
      action={<span className="font-mono text-sm tabular-nums">{missingCount} missing</span>}
      contentClassName="pt-0"
    >
      <ul className="divide-y divide-[#e2ddd1]">
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
    </SectionCard>
  );
}
