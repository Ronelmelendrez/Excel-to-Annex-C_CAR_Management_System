import React from "react";
import { SectionCard } from "../../../components/ui/section-card";
import type { ReviewGate } from "../types";

export function ReviewGateChecklist({ gates }: { gates: ReviewGate[] }) {
  const failedCount = gates.filter((gate) => !gate.passed).length;

  return (
    <SectionCard
      id="review-gates-heading"
      eyebrow="Approval checks"
      title="Gate checklist"
      description="Every blocking gate must pass before approval. Only explicitly eligible checks may use a reasoned exception."
      action={
        <span className="font-mono text-xs tabular-nums">
          {failedCount === 0 ? "All pass" : `${failedCount} blocked`}
        </span>
      }
      contentClassName="pt-0"
    >
      <ul className="divide-y divide-[#e2ddd1]">
        {gates.map((gate) => (
          <li key={gate.id} className="flex items-start gap-3 py-3">
            <span
              aria-hidden="true"
              className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center border text-xs font-bold ${
                gate.passed
                  ? "border-[#2f5b3a] bg-[#e6ecdf] text-[#244b2e]"
                  : "border-[#8a5a00] bg-[#f3ead8] text-[#704700]"
              }`}
            >
              {gate.passed ? "✓" : "!"}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {gate.label}
                <span className="ml-2 text-xs font-normal text-[#5b574e]">
                  {gate.passed ? "Passed" : "Failed"}
                </span>
              </p>
              <p className="mt-1 text-xs leading-5 text-[#5b574e]">{gate.summary}</p>
              {!gate.passed && (
                <p className="mt-1 text-xs font-medium text-[#704700]">
                  {gate.exceptionEligible
                    ? "Eligible for a mock exception with a reason."
                    : "This gate cannot be overridden."}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
