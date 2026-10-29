import React from "react";
import { SectionCard } from "../../../components/ui/section-card";
import type { ReviewRecord } from "../types";

export function ReviewHistory({ records }: { records: ReviewRecord[] }) {
  const decisions = records
    .filter((record) => record.decision)
    .slice()
    .sort((left, right) =>
      (right.decision?.at ?? "").localeCompare(left.decision?.at ?? ""),
    );

  return (
    <SectionCard
      id="review-history-heading"
      eyebrow="Mock session activity"
      title="Decision history"
      description="Local review actions reset when the page reloads. This is not an audit log."
      contentClassName="pt-0"
    >
      {decisions.length === 0 ? (
        <p className="text-sm text-[#5b574e]">No mock decisions have been recorded.</p>
      ) : (
        <ol className="space-y-4">
          {decisions.map((record) => {
            const decision = record.decision;
            if (!decision) return null;
            return (
              <li key={record.id} className="border-l-2 border-[#8c877c] pl-3">
                <p className="text-sm font-semibold">
                  {decision.status === "approved" ? "Approved" : "Changes requested"} ·{" "}
                  {record.reference} · Revision {record.revision}
                </p>
                <p className="mt-1 text-sm leading-5 text-[#3f3b34]">{decision.comment}</p>
                {decision.exceptionReason && (
                  <p className="mt-1 text-xs leading-5 text-[#704700]">
                    Mock exception reason: {decision.exceptionReason}
                  </p>
                )}
                <time
                  dateTime={decision.at}
                  className="mt-1 block font-mono text-[10px] text-[#5b574e]"
                >
                  {decision.actor} · {new Date(decision.at).toLocaleString()}
                </time>
              </li>
            );
          })}
        </ol>
      )}
    </SectionCard>
  );
}
