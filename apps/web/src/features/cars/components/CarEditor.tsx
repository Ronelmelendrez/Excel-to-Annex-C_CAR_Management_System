import React, { useState } from "react";
import type {
  CarDraft,
  CarDraftHistoryEntry,
  CarChecklistItem,
  CarSaveState,
  ValidatedHousehold,
} from "../types";
import { CarChecklist } from "./CarChecklist";
import { CarDraftPreview } from "./CarDraftPreview";
import { CarIdentitySection } from "./CarIdentitySection";
import { CarNarrativeFields } from "./CarNarrativeFields";
import { CarRevisionHistory } from "./CarRevisionHistory";
import { FamilyCompositionSection } from "./FamilyCompositionSection";
import { InterventionPlanSection } from "./InterventionPlanSection";
import { RecommendationSection } from "./RecommendationSection";

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
  previewOpen,
  templateVersions,
  onUpdateDraft,
  onUpdateFamilyMember,
  onUpdateIntervention,
  onAddIntervention,
  onRemoveIntervention,
  onJumpToField,
  onSetPreview,
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
  previewOpen: boolean;
  templateVersions: Array<{ id: string; label: string }>;
  onUpdateDraft: (update: Partial<CarDraft>) => void;
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
  onSetPreview: (value: boolean) => void;
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

  const selectedTemplate = templateVersions.find((template) => template.id === draft.templateVersion);
  const missingCount = checklist.filter((item) => !item.complete).length;
  const canDelete = draft.workflowStatus === "draft";

  return (
    <section className="min-w-0">
      <header className="mb-4 border-b border-[#161512] pb-3">
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
              {draft.status === "draft_ready_for_review" ? "Draft · fields complete" : "Draft · incomplete"}
            </span>
            <SaveStatus state={saveState} message={saveError} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onSetPreview(true)}
            className="min-h-[44px] border border-[#161512] bg-[#161512] px-4 py-2 text-sm font-medium text-[#f4f1ea] hover:bg-[#7a1f1f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
          >
            Preview draft
          </button>
          <button
            type="button"
            onClick={onCreateRevision}
            disabled={creatingRevision}
            className="min-h-[44px] border border-[#161512] px-4 py-2 text-sm font-medium hover:bg-[#ece7dc] disabled:cursor-not-allowed disabled:border-[#b5afa2] disabled:text-[#777166] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
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
                  className="min-h-[44px] border border-[#7a1f1f] bg-[#7a1f1f] px-4 py-2 text-sm font-medium text-[#f4f1ea] hover:bg-[#5e1717] disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
                >
                  {deleting ? "Deleting…" : "Confirm delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="min-h-[44px] border border-[#161512] px-4 py-2 text-sm font-medium hover:bg-[#ece7dc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="min-h-[44px] border border-[#7a1f1f] px-4 py-2 text-sm font-medium text-[#7a1f1f] hover:bg-[#f2e4e1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
              >
                Delete draft
              </button>
            )
          ) : null}
          <span className="text-xs text-[#5b574e]">
            {missingCount === 0
              ? "All checks are complete. This draft is still not approved."
              : `${missingCount} check${missingCount === 1 ? "" : "s"} incomplete. Draft remains editable.`}
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

      {previewOpen ? (
        <CarDraftPreview
          draft={draft}
          household={household}
          templateLabel={selectedTemplate?.label ?? ""}
          onEdit={() => onSetPreview(false)}
        />
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(250px,0.8fr)]">
          <div className="min-w-0 border border-[#c9c3b6] bg-[#f8f5ee]">
            <CarIdentitySection
              draft={draft}
              household={household}
              templateVersions={templateVersions}
              onChange={onUpdateDraft}
            />
            <FamilyCompositionSection
              members={draft.familyComposition}
              onUpdateMember={onUpdateFamilyMember}
            />
            <CarNarrativeFields draft={draft} onChange={onUpdateDraft} />
            <InterventionPlanSection
              interventions={draft.interventions}
              onAdd={onAddIntervention}
              onUpdate={onUpdateIntervention}
              onRemove={onRemoveIntervention}
            />
            <RecommendationSection
              value={draft.recommendation}
              onChange={(recommendation) => onUpdateDraft({ recommendation })}
            />
            <footer className="border-t border-[#c9c3b6] bg-[#ece7dc] px-4 py-3 text-xs leading-5 text-[#5b574e] sm:px-5">
              Draft content is saved to Supabase as you type. Approval, submission, and document
              generation are not available on this page.
            </footer>
          </div>
          <aside className="space-y-4 xl:sticky xl:top-4">
            <CarChecklist
              items={checklist}
              missingCount={missingCount}
              onJumpToField={onJumpToField}
            />
            <CarRevisionHistory revision={draft.revision} history={history} />
          </aside>
        </div>
      )}
    </section>
  );
}
