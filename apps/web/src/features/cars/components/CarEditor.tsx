import React, { useState } from "react";
import type {
  CarDraft,
  CarDraftHistoryEntry,
  CarChecklistItem,
  CarSaveState,
  ReportMode,
  ValidatedHousehold,
} from "../types";
import { missingBySection } from "../lib/report/values";
import { CarReportDocument } from "./report/CarReportDocument";
import { ReportContextPanel } from "./report/ReportContextPanel";
import { SectionRail } from "./report/SectionRail";

function SaveStatus({ state, message }: { state: CarSaveState; message: string | null }) {
  if (state === "error") {
    return (
      <span role="alert" className="max-w-[46ch] text-right text-xs text-[#7a1f1f]">
        {message ?? "Changes could not be saved."}
      </span>
    );
  }
  const label =
    state === "saving"
      ? "Saving to Supabase…"
      : state === "saved"
        ? "Saved to Supabase"
        : "No changes yet";
  return (
    <span role="status" aria-live="polite" className="text-xs text-[#5b574e]">
      {label}
    </span>
  );
}

const MODES: Array<{ id: ReportMode; label: string }> = [
  { id: "edit", label: "Edit" },
  { id: "preview", label: "Preview" },
  { id: "print", label: "Print" },
];

export function CarEditor({
  draft,
  household,
  checklist,
  history,
  saveState,
  saveError,
  actionError,
  deleting,
  creatingRevision,
  mode,
  templateVersions,
  onUpdateDraft,
  onUpdateSlot,
  onSlotReveal,
  onUpdateFamilyMember,
  onUpdateIntervention,
  onAddIntervention,
  onRemoveIntervention,
  onJumpToField,
  onSetMode,
  onDelete,
  onCreateRevision,
}: {
  draft: CarDraft | null;
  household: ValidatedHousehold | null;
  checklist: CarChecklistItem[];
  history: CarDraftHistoryEntry[];
  saveState: CarSaveState;
  saveError: string | null;
  actionError: string | null;
  deleting: boolean;
  creatingRevision: boolean;
  mode: ReportMode;
  templateVersions: Array<{ id: string; label: string }>;
  onUpdateDraft: (update: Partial<CarDraft>) => void;
  onUpdateSlot: (key: string, value: string, reason?: string) => void;
  onSlotReveal: (key: string) => void;
  onUpdateFamilyMember: (
    memberId: string,
    update: Partial<CarDraft["familyComposition"][number]>,
  ) => void;
  onUpdateIntervention: (
    interventionId: string,
    update: Partial<CarDraft["interventions"][number]>,
  ) => void;
  onAddIntervention: () => void;
  onRemoveIntervention: (interventionId: string) => void;
  onJumpToField: (fieldId: string) => void;
  onSetMode: (mode: ReportMode) => void;
  onDelete: () => void;
  onCreateRevision: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (!draft || !household) {
    return (
      <section className="min-w-0 border border-[#c9c3b6] bg-[#f8f5ee] px-5 py-10">
        <h2 className="font-serif text-2xl">Start with a validated household</h2>
        <p className="mt-2 max-w-[58ch] text-sm leading-6 text-[#5b574e]">
          A CAR draft can only be created from a household with exactly one supported GRANTEE=Yes flag.
          Choose a household from the panel to start.
        </p>
      </section>
    );
  }

  const missingCount = checklist.filter((item) => !item.complete).length;
  const canDelete = draft.workflowStatus === "draft";
  const sectionCounts = missingBySection(draft, household);

  return (
    <section className="min-w-0">
      <header className="mb-4 border-b border-[#161512] pb-3 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#5b574e]">
              CAR authoring / {household.importName || "Import unavailable"} · v{household.importVersion}
            </p>
            <h2 className="mt-1 font-mono text-xl font-semibold">
              {draft.reference} <span className="text-sm font-normal text-[#5b574e]">· Revision {draft.revision}</span>
            </h2>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="border border-[#8a5a00] bg-[#f3ead8] px-2 py-1 text-xs font-medium text-[#704700]">
              {draft.workflowStatus !== "draft"
                ? draft.workflowStatus
                : missingCount === 0
                  ? "Draft · fields complete"
                  : "Draft · incomplete"}
            </span>
            <SaveStatus state={saveState} message={saveError} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Report mode"
            className="flex border border-[#161512] bg-[#fbf9f4]"
          >
            {MODES.map((entry) => (
              <button
                key={entry.id}
                type="button"
                aria-pressed={mode === entry.id}
                onClick={() => onSetMode(entry.id)}
                className={`min-h-[40px] border-r border-[#c9c3b6] px-4 text-sm font-medium last:border-r-0 ${
                  mode === entry.id
                    ? "bg-[#161512] text-[#f4f1ea]"
                    : "text-[#3f3b34] hover:bg-[#ece7dc]"
                } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#7a1f1f]`}
              >
                {entry.label}
              </button>
            ))}
          </div>

          {mode === "print" ? (
            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-[40px] border border-[#161512] bg-[#161512] px-4 text-sm font-medium text-[#f4f1ea] hover:bg-[#7a1f1f]"
            >
              Print this report
            </button>
          ) : null}

          <button
            type="button"
            onClick={onCreateRevision}
            disabled={creatingRevision}
            className="min-h-[40px] border border-[#161512] px-4 text-sm font-medium hover:bg-[#ece7dc] disabled:cursor-not-allowed disabled:border-[#b5afa2] disabled:text-[#777166] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
          >
            {creatingRevision ? "Creating revision…" : "New revision"}
          </button>
          {canDelete ? (
            confirmingDelete ? (
              <span className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingDelete(false);
                    onDelete();
                  }}
                  disabled={deleting}
                  className="min-h-[40px] border border-[#7a1f1f] bg-[#7a1f1f] px-4 text-sm font-medium text-[#f4f1ea] hover:bg-[#5e1717] disabled:cursor-not-allowed"
                >
                  {deleting ? "Deleting…" : "Confirm delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="min-h-[40px] border border-[#161512] px-4 text-sm font-medium hover:bg-[#ece7dc]"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="min-h-[40px] border border-[#7a1f1f] px-4 text-sm font-medium text-[#7a1f1f] hover:bg-[#f2e4e1]"
              >
                Delete draft
              </button>
            )
          ) : null}
          <span className="text-xs text-[#5b574e]">
            {missingCount === 0
              ? "All required blanks are filled. Approval still runs through review."
              : `${missingCount} required blank${missingCount === 1 ? "" : "s"} outstanding.`}
          </span>
        </div>

        {actionError ? (
          <p
            role="alert"
            className="mt-3 border-l-4 border-[#7a1f1f] bg-[#f2e4e1] px-3 py-2 text-sm leading-6 text-[#7a1f1f]"
          >
            {actionError}
          </p>
        ) : null}
      </header>

      {mode === "edit" ? (
        <div className="space-y-5">
          <div className="min-w-0 print:hidden">
            <SectionRail
              missingBySection={sectionCounts}
              onJumpToSection={(sectionId) => onJumpToField(`section-${sectionId}`)}
            />
          </div>
          <div className="min-w-0">
            <CarReportDocument
              draft={draft}
              household={household}
              mode={mode}
              onSlotEdit={onUpdateSlot}
              onSlotReveal={onSlotReveal}
              onUpdateFamilyMember={onUpdateFamilyMember}
              onUpdateIntervention={onUpdateIntervention}
              onAddIntervention={onAddIntervention}
              onRemoveIntervention={onRemoveIntervention}
            />
          </div>
          <div className="mx-auto w-full max-w-[900px] print:hidden">
            <ReportContextPanel
              draft={draft}
              checklist={checklist}
              missingCount={missingCount}
              templateVersions={templateVersions}
              history={history}
              onJumpToField={onJumpToField}
              onUpdateDraft={onUpdateDraft}
            />
          </div>
        </div>
      ) : (
        <div className="print:max-w-none">
          <CarReportDocument
            draft={draft}
            household={household}
            mode={mode}
            onSlotEdit={onUpdateSlot}
            onSlotReveal={onSlotReveal}
            onUpdateFamilyMember={onUpdateFamilyMember}
            onUpdateIntervention={onUpdateIntervention}
            onAddIntervention={onAddIntervention}
            onRemoveIntervention={onRemoveIntervention}
          />
        </div>
      )}
    </section>
  );
}
