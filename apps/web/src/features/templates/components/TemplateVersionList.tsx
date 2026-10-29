import React from "react";
import { SectionCard } from "../../../components/ui/section-card";
import type { TemplateVersion } from "../types";

function statusStyle(status: TemplateVersion["status"]) {
  switch (status) {
    case "active":
      return "border-[#2f5b3a] bg-[#e6ecdf] text-[#244b2e]";
    case "validated":
      return "border-[#185a8b] bg-[#e4edf4] text-[#174c75]";
    case "retired":
      return "border-[#8c877c] bg-[#ece7dc] text-[#5b574e]";
    default:
      return "border-[#8a5a00] bg-[#f3ead8] text-[#704700]";
  }
}

export function TemplateVersionList({
  versions,
  selectedId,
  onSelect,
}: {
  versions: TemplateVersion[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <SectionCard
      id="template-versions-heading"
      title="Template versions"
      className="min-w-0"
      cardClassName="overflow-hidden"
      contentClassName="p-0"
      action={<span className="font-mono text-[10px] text-[#5b574e]">{versions.length} shown</span>}
    >
      {versions.length === 0 ? (
        <p className="px-4 py-8 text-sm leading-6 text-[#5b574e]">
          No template versions match these filters. Add a DOCX draft or change the search.
        </p>
      ) : (
        <ul className="divide-y divide-[#c9c3b6]">
          {versions.map((version) => {
            const selected = version.id === selectedId;
            return (
              <li key={version.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect(version.id)}
                  className={`w-full border-l-4 px-3 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7a1f1f] ${
                    selected
                      ? "border-[#7a1f1f] bg-[#ece7dc]"
                      : "border-transparent hover:bg-[#f8f5ee]"
                  }`}
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{version.name}</span>
                    <span className={`border px-2 py-1 text-[10px] font-medium ${statusStyle(version.status)}`}>
                      {version.status === "active"
                        ? "Active"
                        : version.status === "validated"
                          ? version.approvedBy
                            ? "Approved · ready"
                            : "Validated"
                          : version.status === "retired"
                            ? "Retired"
                            : "Draft"}
                    </span>
                  </span>
                  <span className="mt-1 block font-mono text-xs">Version {version.version}</span>
                  <span className="mt-1 block break-all text-xs text-[#5b574e]">{version.fileName}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
