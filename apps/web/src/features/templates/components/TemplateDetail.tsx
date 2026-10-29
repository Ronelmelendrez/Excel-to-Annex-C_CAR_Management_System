import React from "react";
import { SectionCard } from "../../../components/ui/section-card";
import type { TemplateValidationIssue, TemplateVersion } from "../types";
import { TemplateLifecycleActions } from "./TemplateLifecycleActions";
import { TemplateMappingSection } from "./TemplateMappingSection";
import { TemplateRepeatingTables } from "./TemplateRepeatingTables";
import { TemplateSamplePreview } from "./TemplateSamplePreview";
import { TemplateValidation } from "./TemplateValidation";

export function TemplateDetail({
  template,
  activeTemplate,
  validationIssues,
  pendingAction,
  samplePreviewOpen,
  onUpdateMapping,
  onUpdateRepeatingTable,
  onValidate,
  onRequestAction,
  onCancelAction,
  onConfirmAction,
  onToggleSamplePreview,
  onPrepareSampleOutput,
}: {
  template: TemplateVersion | null;
  activeTemplate: TemplateVersion | undefined;
  validationIssues: TemplateValidationIssue[];
  pendingAction: "approve" | "activate" | null;
  samplePreviewOpen: boolean;
  onUpdateMapping: (
    mappingId: string,
    update: Partial<TemplateVersion["mappings"][number]>,
  ) => void;
  onUpdateRepeatingTable: (
    tableId: string,
    update: Partial<TemplateVersion["repeatingTables"][number]>,
  ) => void;
  onValidate: () => void;
  onRequestAction: (action: "approve" | "activate") => void;
  onCancelAction: () => void;
  onConfirmAction: () => void;
  onToggleSamplePreview: (open: boolean) => void;
  onPrepareSampleOutput: (format: "docx" | "pdf") => void;
}) {
  if (!template) {
    return (
      <SectionCard id="template-detail-heading" title="Select a template version">
        <p className="text-sm leading-6 text-[#5b574e]">
          Choose a version from the list to inspect its mappings, validation, and lifecycle.
        </p>
      </SectionCard>
    );
  }

  const editable = template.status === "draft";
  return (
    <div className="min-w-0 space-y-4">
      <SectionCard
        id="template-detail-heading"
        eyebrow={`${template.name} · version ${template.version}`}
        title={template.fileName}
        titleClassName="break-all font-mono text-base font-semibold"
        description={`Added ${new Date(template.uploadedAt).toLocaleString()} by ${template.uploadedBy}`}
        action={
          <span className="border border-[#8c877c] bg-[#ece7dc] px-2 py-1 text-[10px] font-semibold uppercase text-[#5b574e]">
            {template.status}
          </span>
        }
      >
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="border-t border-[#e2ddd1] pt-2">
            <dt className="text-xs text-[#5b574e]">File size</dt>
            <dd className="mt-1 text-sm">{(template.fileSizeBytes / 1024).toFixed(0)} KB · mock metadata</dd>
          </div>
          <div className="border-t border-[#e2ddd1] pt-2">
            <dt className="text-xs text-[#5b574e]">Current active version</dt>
            <dd className="mt-1 text-sm">
              {activeTemplate ? `v${activeTemplate.version}` : "None"}
            </dd>
          </div>
        </dl>
        <p className="mt-4 border-l-4 border-[#8a5a00] bg-[#f3ead8] px-3 py-2 text-xs leading-5 text-[#704700]">
          This version is a UI mock. It has not been uploaded, parsed, legally approved, or activated on a server.
        </p>
      </SectionCard>

      <TemplateMappingSection
        mappings={template.mappings}
        editable={editable}
        onChange={onUpdateMapping}
      />
      <TemplateRepeatingTables
        tables={template.repeatingTables}
        editable={editable}
        onChange={onUpdateRepeatingTable}
      />
      <TemplateValidation
        issues={validationIssues}
        status={template.status}
        onValidate={onValidate}
      />
      <TemplateSamplePreview
        template={template}
        isOpen={samplePreviewOpen}
        canGenerate={validationIssues.length === 0}
        onToggle={onToggleSamplePreview}
        onPrepare={onPrepareSampleOutput}
      />
      <TemplateLifecycleActions
        template={template}
        activeTemplate={activeTemplate}
        issueCount={validationIssues.length}
        pendingAction={pendingAction}
        onRequestAction={onRequestAction}
        onCancelAction={onCancelAction}
        onConfirmAction={onConfirmAction}
      />
    </div>
  );
}
