import React from "react";

export const primaryButton =
  "inline-flex min-h-[44px] items-center justify-center border border-[#161512] bg-[#161512] px-4 py-2 text-sm font-medium text-[#f4f1ea] hover:bg-[#7a1f1f] disabled:cursor-not-allowed disabled:border-[#8c877c] disabled:bg-[#8c877c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]";

export const secondaryButton =
  "inline-flex min-h-[44px] items-center justify-center border border-[#161512] bg-transparent px-4 py-2 text-sm font-medium text-[#161512] hover:bg-[#e6e0d4] disabled:cursor-not-allowed disabled:border-[#b5afa2] disabled:text-[#8c877c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]";

export const quietButton =
  "inline-flex min-h-[32px] items-center text-sm underline decoration-1 underline-offset-4 hover:text-[#7a1f1f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f] disabled:cursor-not-allowed disabled:text-[#8c877c]";

export function Notice({
  tone = "info",
  title,
  children,
  actions,
}: {
  tone?: "info" | "warning" | "error" | "success";
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const tones = {
    info: "border-[#161512] bg-[#ece7dc]",
    warning: "border-[#8a5a00] bg-[#f3ead8]",
    error: "border-[#7a1f1f] bg-[#f2e4e1]",
    success: "border-[#2f5b3a] bg-[#e6ecdf]",
  } as const;
  const role = tone === "error" ? "alert" : undefined;

  return (
    <div role={role} className={`border-l-4 border-y border-r px-4 py-3 ${tones[tone]}`}>
      <p className="text-sm font-semibold">{title}</p>
      {children && <div className="mt-1 text-sm leading-6 text-[#3f3b34]">{children}</div>}
      {actions && <div className="mt-3 flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  note,
  accent = false,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
  accent?: boolean;
}) {
  return (
    <div className="border-t border-[#161512] pt-2">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[#5b574e]">{label}</p>
      <p
        className={`mt-1 font-serif text-2xl leading-none tabular-nums ${accent ? "text-[#7a1f1f]" : ""}`}
      >
        {value}
      </p>
      {note && <p className="mt-1 text-xs leading-5 text-[#5b574e]">{note}</p>}
    </div>
  );
}

export function FieldLabel({
  htmlFor,
  children,
  hint,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-2">
      <label htmlFor={htmlFor} className="block text-sm font-semibold">
        {children}
      </label>
      {hint && <p className="mt-1 text-xs leading-5 text-[#5b574e]">{hint}</p>}
    </div>
  );
}
