import React from "react";
import { useAuth } from "../../../app/providers";
import { CAR_NOT_CONFIGURED_MESSAGE } from "../api";
import { useCarAuthoring } from "../hooks/useCarAuthoring";
import { AlertTriangleIcon } from "../../../components/icons";
import { CarDraftList } from "./CarDraftList";
import { CarEditor } from "./CarEditor";
import { PageDataSkeleton } from "../../../components/ui/PageSkeletons";

function StatusBadge({ text, tone }: { text: string; tone: "ok" | "warn" | "muted" }) {
  // Outline chips, matching the landing page's badge treatment.
  const tones = {
    ok: "border-[#161512] text-[#161512]",
    warn: "border-[#b45309] text-[#8a5a00]",
    muted: "border-[#c9c3b6] text-[#5b574e]",
  } as const;
  return (
    <span className={`border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] ${tones[tone]}`}>
      {text}
    </span>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-[#c9c3b6] bg-[#fbf9f4] px-5 py-8">
      <h2 className="font-serif text-2xl">{title}</h2>
      <div className="mt-2 max-w-[70ch] text-sm leading-6 text-[#5b574e]">{children}</div>
    </section>
  );
}

export function CarsPage() {
  const { roles, user } = useAuth();
  const canAuthor = roles.includes("admin") || roles.includes("case_worker");
  const authoring = useCarAuthoring(canAuthor, user?.id ?? "");

  if (!canAuthor) {
    return (
      <div
        role="alert"
        className="flex max-w-[680px] items-start gap-3 border-l-4 border-[#7a1f1f] bg-[#f6eaea] px-4 py-4"
      >
        <AlertTriangleIcon className="mt-1 h-5 w-5 shrink-0 text-[#7a1f1f]" />
        <div>
          <h1 className="font-serif text-2xl leading-tight">
            You do not have access to CAR authoring
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#3f3b34]">
            CAR drafts are available to case workers. Ask an administrator to review your account
            role.
          </p>
        </div>
      </div>
    );
  }

  const badge = authoring.notConfigured
    ? { text: "Temporarily unavailable", tone: "warn" as const }
    : authoring.loading
      ? null
      : authoring.loadError
        ? { text: "CARs unavailable", tone: "warn" as const }
        : { text: "CAR records ready", tone: "ok" as const };

  let body: React.ReactNode;
  if (authoring.notConfigured) {
    body = (
      <Panel title="CAR records are temporarily unavailable">
        <p>{CAR_NOT_CONFIGURED_MESSAGE}</p>
      </Panel>
    );
  } else if (authoring.loading) {
    body = <PageDataSkeleton page="cars" />;
  } else if (authoring.loadError) {
    body = (
      <div
        role="alert"
        className="flex max-w-[70ch] items-start gap-3 border-l-4 border-[#7a1f1f] bg-[#f6eaea] px-4 py-4"
      >
        <AlertTriangleIcon className="mt-1 h-5 w-5 shrink-0 text-[#7a1f1f]" />
        <div>
          <h2 className="font-serif text-xl leading-tight">CAR drafts could not be loaded</h2>
          <p className="mt-2 text-sm leading-6 text-[#3f3b34]">{authoring.loadError}</p>
          <button
            type="button"
            onClick={authoring.reload}
            className="mt-3 min-h-[40px] border border-[#161512] bg-[#161512] px-4 py-2 text-sm font-medium text-[#f4f1ea] hover:bg-[#7a1f1f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
          >
            Try again
          </button>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(245px,0.72fr)_minmax(0,1.8fr)]">
        <CarDraftList
          drafts={authoring.drafts}
          households={authoring.households}
          householdsLoading={authoring.householdsLoading}
          householdsError={authoring.householdsError}
          householdsRefreshError={authoring.householdsRefreshError}
          actionError={authoring.createError}
          creating={authoring.creating}
          selectedDraftId={authoring.selectedDraft?.id ?? null}
          onSelectDraft={authoring.selectDraft}
          onCreateDraft={authoring.createCarDraft}
        />
        <CarEditor
          key={authoring.selectedDraft?.id ?? "no-draft"}
          draft={authoring.selectedDraft}
          household={authoring.household}
          checklist={authoring.checklist}
          history={authoring.history}
          saveState={authoring.saveState}
          saveError={authoring.saveError}
          actionError={authoring.actionError}
          deleting={authoring.deleting}
          creatingRevision={authoring.creatingRevision}
          templateVersions={authoring.templateVersions}
          mode={authoring.mode}
          onUpdateDraft={authoring.updateDraft}
          onUpdateSlot={authoring.updateSlot}
          onSlotReveal={authoring.revealSlot}
          onUpdateFamilyMember={authoring.updateFamilyMember}
          onUpdateIntervention={authoring.updateIntervention}
          onAddIntervention={authoring.addIntervention}
          onRemoveIntervention={authoring.removeIntervention}
          onJumpToField={authoring.jumpToField}
          onSetMode={authoring.setMode}
          onDelete={authoring.deleteDraft}
          onCreateRevision={authoring.createRevision}
        />
      </div>
    );
  }

  return (
    <div>
      <header className="border-b border-[#161512] pb-5">
        <p className="motion-safe:animate-fade-up font-mono text-[10px] uppercase tracking-[0.2em] text-[#7a1f1f]">
          CAR authoring
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1
              className="motion-safe:animate-fade-up font-serif text-4xl leading-none tracking-tight sm:text-5xl"
              style={{ animationDelay: "60ms" }}
            >
              Case Assessment Reports
            </h1>
            <p
              className="motion-safe:animate-fade-up mt-3 max-w-[62ch] text-sm leading-6 text-[#3f3b34]"
              style={{ animationDelay: "120ms" }}
            >
              Create a draft from a validated household, record case-worker content, and review a clearly marked preview.
            </p>
          </div>
          {badge ? (
            <span className="motion-safe:animate-fade-up" style={{ animationDelay: "180ms" }}>
              <StatusBadge text={badge.text} tone={badge.tone} />
            </span>
          ) : (
            <span
              role="status"
              aria-label="Preparing CAR workspace"
              className="motion-safe:animate-pulse h-8 w-36 bg-[#e6e0d4]"
            />
          )}
        </div>
      </header>

      {authoring.refreshError && (
        <p
          role="status"
          className="mt-4 flex items-start gap-3 border-l-4 border-[#b45309] bg-[#f3ead8] px-4 py-3 text-sm leading-6 text-[#704700]"
        >
          <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#b45309]" />
          <span>{authoring.refreshError} Showing the last loaded CAR records.</span>
        </p>
      )}

      {body}
    </div>
  );
}
