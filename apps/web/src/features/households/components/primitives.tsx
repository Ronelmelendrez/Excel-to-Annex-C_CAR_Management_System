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

const statusStyles: Record<HouseholdStatus, string> = {
  valid: "border-[#2f5b3a] bg-[#e6ecdf] text-[#244b2e]",
  resolved: "border-[#2f5b3a] bg-[#e6ecdf] text-[#244b2e]",
  none: "border-[#8a5a00] bg-[#f3ead8] text-[#704700]",
  multiple: "border-[#7a1f1f] bg-[#f2e4e1] text-[#7a1f1f]",
  invalid: "border-[#8a5a00] bg-[#f3ead8] text-[#704700]",
  blank: "border-[#8a5a00] bg-[#f3ead8] text-[#704700]",
};

export function HouseholdStatusLabel({ status }: { status: HouseholdStatus }) {
  const isValid = status === "valid" || status === "resolved";

  return (
    <span className={`inline-flex items-center gap-1 border px-2 py-1 text-[11px] font-medium ${statusStyles[status]}`}>
      <span aria-hidden="true">{isValid ? "✓" : "!"}</span>
      {statusLabels[status]}
    </span>
  );
}

export function HouseholdStat({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <div className="border-t border-[#161512] pt-2">
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
