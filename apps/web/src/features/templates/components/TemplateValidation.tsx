import React from "react";
import { SectionCard } from "../../../components/ui/section-card";
import type { TemplateValidationIssue } from "../types";

export function TemplateValidation({
  issues,
  status,
  onValidate,
}: {
  issues: TemplateValidationIssue[];
  status: "draft" | "validated" | "active" | "retired";
  onValidate: () => void;
}) {
  return (
    <SectionCard
      id="template-validation-heading"
      eyebrow="Configuration checks"
      title="Validation"
      action={
        <span className="font-mono text-xs">
          {issues.length === 0 ? "No blockers" : `${issues.length} blocker${issues.length === 1 ? "" : "s"}`}
        </span>
      }
      contentClassName="pt-0"
    >
      {issues.length === 0 ? (
        <p className="text-sm leading-6 text-[#244b2e]">
          All required placeholders and repeating table configurations are mapped.
          {status === "draft" ? " Run validation to mark this version validated." : ""}
        </p>
      ) : (
        <ul className="space-y-2">
          {issues.map((issue) => (
            <li key={issue.id} className="border-l-4 border-[#8a5a00] bg-[#f3ead8] px-3 py-2">
              <p className="text-sm font-semibold text-[#704700]">{issue.label}</p>
              <p className="mt-1 text-xs leading-5 text-[#704700]">{issue.message}</p>
            </li>
          ))}
        </ul>
      )}
      {status === "draft" && (
        <button
          type="button"
          onClick={onValidate}
          disabled={issues.length > 0}
          title={issues.length > 0 ? "Map required placeholders and repeating tables first." : undefined}
          className="mt-4 min-h-[44px] border border-[#161512] bg-[#161512] px-4 py-2 text-sm font-medium text-[#f4f1ea] hover:bg-[#7a1f1f] disabled:cursor-not-allowed disabled:border-[#b5afa2] disabled:bg-[#b5afa2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
        >
          Validate mock configuration
        </button>
      )}
      {status !== "draft" && (
        <p className="mt-3 text-xs text-[#5b574e]">
          {status === "active" || status === "retired"
            ? "Validated configuration is immutable for this version."
            : "Validated version is read-only; make changes in a new version."}
        </p>
      )}
    </SectionCard>
  );
}
