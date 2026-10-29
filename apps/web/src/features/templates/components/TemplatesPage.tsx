import React from "react";
import { useAuth } from "../../../app/providers";
import { useTemplateManager } from "../hooks/useTemplateManager";
import { TemplateDetail } from "./TemplateDetail";
import { TemplateFilters } from "./TemplateFilters";
import { TemplateUploadPanel } from "./TemplateUploadPanel";
import { TemplateVersionList } from "./TemplateVersionList";

export function TemplatesPage() {
  const { profile, user, roles } = useAuth();
  const actor = profile?.display_name || user?.email || "Template administrator (mock)";
  const manager = useTemplateManager(actor);
  const canManageTemplates = roles.includes("admin");

  if (!canManageTemplates) {
    return (
      <div
        role="alert"
        className="max-w-[680px] border-l-4 border-[#7a1f1f] border-y border-r border-[#7a1f1f] bg-[#f2e4e1] px-4 py-4"
      >
        <h1 className="font-serif text-2xl">You do not have access to template management</h1>
        <p className="mt-2 text-sm leading-6 text-[#3f3b34]">
          Template administration is restricted to administrators. No template details are shown.
        </p>
      </div>
    );
  }

  return (
    <div>
      <header className="border-b border-[#161512] pb-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#5b574e]">
          F7 / Document templates
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl leading-none tracking-tight sm:text-5xl">
              Template management
            </h1>
            <p className="mt-3 max-w-[62ch] text-sm leading-6 text-[#3f3b34]">
              Map detected fields, configure repeating rows, validate the version, and review a sample before activation.
            </p>
          </div>
          <span className="border border-[#8a5a00] bg-[#f3ead8] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#704700]">
            Mock versions · changes reset on reload
          </span>
        </div>
      </header>

      {manager.feedback && (
        <p
          role="status"
          className="mt-4 border-l-4 border-[#2f5b3a] bg-[#e6ecdf] px-4 py-3 text-sm leading-6 text-[#244b2e]"
        >
          {manager.feedback}
        </p>
      )}

      <TemplateFilters
        search={manager.search}
        status={manager.statusFilter}
        onSearchChange={manager.setSearch}
        onStatusChange={manager.setStatusFilter}
      />

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(260px,0.78fr)_minmax(0,1.55fr)]">
        <aside className="min-w-0 space-y-4" aria-label="Template versions and upload">
          <TemplateUploadPanel
            fileError={manager.fileError}
            selectedFile={manager.selectedFile}
            onChooseFile={manager.chooseFile}
            onAddDraft={manager.addDraftVersion}
          />
          <TemplateVersionList
            versions={manager.visibleVersions}
            selectedId={manager.selectedTemplate?.id ?? null}
            onSelect={manager.selectTemplate}
          />
        </aside>
        <TemplateDetail
          template={manager.selectedTemplate}
          activeTemplate={manager.activeTemplate}
          validationIssues={manager.validationIssues}
          pendingAction={manager.pendingAction}
          samplePreviewOpen={manager.samplePreviewOpen}
          onUpdateMapping={manager.updateMapping}
          onUpdateRepeatingTable={manager.updateRepeatingTable}
          onValidate={manager.validateDraft}
          onRequestAction={manager.requestAction}
          onCancelAction={manager.cancelAction}
          onConfirmAction={manager.confirmAction}
          onToggleSamplePreview={manager.setSamplePreviewOpen}
          onPrepareSampleOutput={manager.prepareSampleOutput}
        />
      </div>
    </div>
  );
}
