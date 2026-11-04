import React from "react";
import { REPORT_TEMPLATE } from "@report-template";

/**
 * Left section rail (plan §5): jump links to each template section with a
 * completion marker. Sections with fixed wording show "static".
 */
export function SectionRail({
  missingBySection,
  onJumpToSection,
}: {
  missingBySection: Record<string, number>;
  onJumpToSection: (sectionId: string) => void;
}) {
  return (
    <nav aria-label="Report sections" className="border border-[#c9c3b6] bg-[#f8f5ee] p-2">
      <p className="mb-1 px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#5b574e]">
        Sections
      </p>
      <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3 xl:grid-cols-4">
        {REPORT_TEMPLATE.sections
          .filter((section) => section.id !== "header")
          .map((section) => {
            const count = missingBySection[section.id] ?? 0;
            return (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() => onJumpToSection(section.id)}
                  className="flex min-h-[40px] w-full items-center justify-between gap-2 px-2 text-left text-sm hover:bg-[#ece7dc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-10 shrink-0 font-mono text-[10px] uppercase text-[#5b574e]">
                      {section.rail}
                    </span>
                    <span className="truncate">{section.title}</span>
                  </span>
                  {section.staticOnly ? (
                    <span className="shrink-0 font-mono text-[9px] uppercase text-[#777166]">
                      static
                    </span>
                  ) : count > 0 ? (
                    <span className="shrink-0 border border-[#8a5a00] bg-[#f3ead8] px-1.5 font-mono text-[10px] font-semibold text-[#704700]">
                      {count}
                    </span>
                  ) : (
                    <span aria-hidden="true" className="shrink-0 text-xs text-[#244b2e]">
                      ✓
                    </span>
                  )}
                </button>
              </li>
            );
          })}
      </ul>
    </nav>
  );
}
