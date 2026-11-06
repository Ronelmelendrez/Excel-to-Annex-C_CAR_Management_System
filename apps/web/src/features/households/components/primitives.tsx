import React from "react";
import type { HouseholdStatus } from "../types";

const statusLabels: Record<HouseholdStatus, string> = {
  valid: "Grantee OK",
  none: "No Yes flag",
  multiple: "Multiple Yes flags",
  invalid: "Unsupported value",
  blank: "Blank flag",
  resolved: "Resolved by staff",
};

// Outline chips, matching the landing page's badge treatment (e.g. the
// "Draft" badge): a coloured 1px border and matching text, no fill.
// Amber follows the landing page's warning colour (#b45309); text stays the
// darker brown for contrast on tinted rows.
const statusStyles: Record<HouseholdStatus, string> = {
  valid: "border-[#161512] text-[#161512]",
  resolved: "border-[#161512] text-[#161512]",
  none: "border-[#b45309] text-[#8a5a00]",
  multiple: "border-[#7a1f1f] text-[#7a1f1f]",
  invalid: "border-[#b45309] text-[#8a5a00]",
  blank: "border-[#b45309] text-[#8a5a00]",
};

export function HouseholdStatusLabel({ status }: { status: HouseholdStatus }) {
  const isValid = status === "valid" || status === "resolved";

  return (
    <span className={`inline-flex items-center gap-1 border px-2 py-1 text-[11px] font-medium ${statusStyles[status]}`}>
      <span aria-hidden="true" className={isValid ? "text-[#7a1f1f]" : undefined}>
        {isValid ? "✓" : "!"}
      </span>
      {statusLabels[status]}
    </span>
  );
}

export function HouseholdStat({
  label,
  value,
  emphasis = false,
  delay,
}: {
  label: string;
  value: number | string;
  emphasis?: boolean;
  /** Entrance delay (ms) for the landing-style `fade-up` animation. */
  delay?: number;
}) {
  return (
    <div
      className="motion-safe:animate-fade-up border border-[#c9c3b6] bg-[#fbf9f4] p-4"
      style={delay !== undefined ? { animationDelay: `${delay}ms` } : undefined}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#5b574e]">{label}</p>
      <p className={`mt-1 font-serif text-2xl tabular-nums ${emphasis ? "text-[#7a1f1f]" : ""}`}>{value}</p>
    </div>
  );
}

export function HouseholdSectionHeading({
  id,
  children,
}: {
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <h3 id={id} className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">
      {children}
    </h3>
  );
}
