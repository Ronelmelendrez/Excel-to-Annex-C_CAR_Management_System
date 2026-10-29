import React from "react";
import { useAuth } from "../../../app/providers";
import { useCarAuthoring } from "../hooks/useCarAuthoring";
import { CarDraftList } from "./CarDraftList";
import { CarEditor } from "./CarEditor";

export function CarsPage() {
  const { roles } = useAuth();
  const authoring = useCarAuthoring();
  const canAuthor = roles.includes("admin") || roles.includes("case_worker");

  if (!canAuthor) {
    return (
      <div
        role="alert"
        className="max-w-[680px] border-l-4 border-[#7a1f1f] border-y border-r border-[#7a1f1f] bg-[#f2e4e1] px-4 py-4"
      >
        <h1 className="font-serif text-2xl">You do not have access to CAR authoring</h1>
        <p className="mt-2 text-sm leading-6 text-[#3f3b34]">
          CAR drafts are available to case workers. Ask an administrator to review your account role.
        </p>
      </div>
    );
  }

  return (
    <div>
      <header className="border-b border-[#161512] pb-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#5b574e]">
          F5 / CAR authoring
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl leading-none tracking-tight sm:text-5xl">
              Case Assessment Reports
            </h1>
            <p className="mt-3 max-w-[62ch] text-sm leading-6 text-[#3f3b34]">
              Create a draft from a validated household, record case-worker content, and review a clearly marked preview.
            </p>
          </div>
          <span className="border border-[#8a5a00] bg-[#f3ead8] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#704700]">
            Mock drafts · changes reset on reload
          </span>
        </div>
      </header>

      <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(245px,0.72fr)_minmax(0,1.8fr)]">
        <CarDraftList
          drafts={authoring.drafts}
          households={authoring.validatedHouseholds}
          selectedDraftId={authoring.selectedDraft?.id ?? null}
          onSelectDraft={authoring.selectDraft}
          onCreateDraft={authoring.createCarDraft}
        />
        <CarEditor
          draft={authoring.selectedDraft}
          household={authoring.household}
          checklist={authoring.checklist}
          history={authoring.history}
          saveState={authoring.saveState}
          previewOpen={authoring.previewOpen}
          templateVersions={authoring.templateVersions}
          onUpdateDraft={authoring.updateDraft}
          onUpdateFamilyMember={authoring.updateFamilyMember}
          onUpdateIntervention={authoring.updateIntervention}
          onAddIntervention={authoring.addIntervention}
          onRemoveIntervention={authoring.removeIntervention}
          onJumpToField={authoring.jumpToField}
          onSetPreview={authoring.setPreviewOpen}
        />
      </div>
    </div>
  );
}
