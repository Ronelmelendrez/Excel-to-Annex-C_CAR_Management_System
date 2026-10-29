import React from "react";
import { SectionCard } from "../../../components/ui/section-card";
import { templateFieldOptions } from "../lib/template-validation";
import { mockTemplatePreviewData } from "../mock-data";
import type { TemplateVersion } from "../types";

export function TemplateSamplePreview({
  template,
  isOpen,
  canGenerate,
  onToggle,
  onPrepare,
}: {
  template: TemplateVersion;
  isOpen: boolean;
  canGenerate: boolean;
  onToggle: (open: boolean) => void;
  onPrepare: (format: "docx" | "pdf") => void;
}) {
  const mappedRows = template.mappings.filter((mapping) => mapping.fieldKey);

  return (
    <SectionCard
      id="template-preview-heading"
      eyebrow="Test data only"
      title="Preview and sample outputs"
      description="Preview values are fabricated examples. Do not treat them as case records or an official Annex C."
    >
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onToggle(!isOpen)}
          className="min-h-[44px] border border-[#161512] px-4 py-2 text-sm font-medium hover:bg-[#e6e0d4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
        >
          {isOpen ? "Hide sample preview" : "Show sample preview"}
        </button>
        <button
          type="button"
          onClick={() => onPrepare("docx")}
          disabled={!canGenerate}
          title={!canGenerate ? "Resolve validation blockers before generating a sample." : undefined}
          className="min-h-[44px] border border-[#161512] bg-[#161512] px-4 py-2 text-sm font-medium text-[#f4f1ea] hover:bg-[#7a1f1f] disabled:cursor-not-allowed disabled:border-[#b5afa2] disabled:bg-[#b5afa2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
        >
          Generate sample DOCX
        </button>
        <button
          type="button"
          onClick={() => onPrepare("pdf")}
          disabled={!canGenerate}
          title={!canGenerate ? "Resolve validation blockers before generating a sample." : undefined}
          className="min-h-[44px] border border-[#161512] bg-[#161512] px-4 py-2 text-sm font-medium text-[#f4f1ea] hover:bg-[#7a1f1f] disabled:cursor-not-allowed disabled:border-[#b5afa2] disabled:bg-[#b5afa2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
        >
          Generate sample PDF
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#5b574e]" aria-live="polite">
        <span>DOCX: {template.sampleOutputs?.docx === "ready" ? "Mock sample ready · no file created" : "Not generated"}</span>
        <span>PDF: {template.sampleOutputs?.pdf === "ready" ? "Mock sample ready · no file created" : "Not generated"}</span>
      </div>
      {isOpen && (
        <div className="mt-4 border border-[#c9c3b6] bg-[#fbf9f4] p-4">
          <div className="border-b-2 border-[#8c877c] pb-3 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#7a1f1f]">
              Mock preview · not an official form
            </p>
            <h3 className="mt-1 font-serif text-lg">Annex C — Sample layout</h3>
          </div>
          {mappedRows.length === 0 ? (
            <p className="py-5 text-sm text-[#5b574e]">Map a placeholder to display its sample value.</p>
          ) : (
            <dl className="grid gap-3 pt-3 sm:grid-cols-2">
              {mappedRows.map((mapping) => {
                const field = templateFieldOptions.find(
                  (option) => option.value === mapping.fieldKey,
                );
                return (
                  <div key={mapping.id} className="border-t border-[#e2ddd1] pt-2">
                    <dt className="text-xs text-[#5b574e]">
                      {field?.label ?? mapping.fieldKey} · {"{{"}
                      {mapping.placeholder}
                      {"}}"}
                    </dt>
                    <dd className="mt-1 break-words text-sm">
                      {mockTemplatePreviewData[mapping.fieldKey] ?? "Sample value not configured"}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}
          {template.repeatingTables
            .filter((table) => table.enabled)
            .map((table) => (
              <div key={table.id} className="mt-4 border-t border-[#c9c3b6] pt-3">
                <h4 className="text-sm font-semibold">{table.label} · sample rows</h4>
                <p className="mt-1 text-xs text-[#5b574e]">
                  {table.collectionKey === "familyComposition"
                    ? "Sample Member A · Household head"
                    : "Sample support service · Not a real service plan"}
                </p>
              </div>
            ))}
        </div>
      )}
    </SectionCard>
  );
}
