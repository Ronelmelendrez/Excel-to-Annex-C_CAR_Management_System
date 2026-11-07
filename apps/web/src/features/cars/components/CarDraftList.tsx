import React, { useState } from "react";
import { AlertTriangleIcon, ArrowRightIcon } from "../../../components/icons";
import { Label } from "../../../components/ui/label";
import { SectionCard } from "../../../components/ui/section-card";
import type { CarDraft, ValidatedHousehold } from "../types";

export function CarDraftList({
  drafts,
  households,
  householdsLoading,
  householdsError,
  householdsRefreshError,
  actionError,
  creating,
  selectedDraftId,
  onSelectDraft,
  onCreateDraft,
}: {
  drafts: CarDraft[];
  households: ValidatedHousehold[];
  householdsLoading: boolean;
  householdsError: string | null;
  householdsRefreshError: string | null;
  actionError: string | null;
  creating: boolean;
  selectedDraftId: string | null;
  onSelectDraft: (draftId: string) => void;
  onCreateDraft: (householdId: string) => void;
}) {
  const [householdId, setHouseholdId] = useState("");

  return (
    <aside
      // The aside itself is NOT sticky: it stretches to the grid row height
      // (the editor column's height) so the sticky Drafts card inside can
      // stay pinned for the whole editor scroll, while the household picker
      // above it scrolls away with the page.
      className="min-w-0 space-y-5 lg:self-stretch"
      aria-label="CAR authoring panels"
    >
      <SectionCard
        id="car-new-draft-heading"
        eyebrow="Start a CAR"
        title="Choose a validated household"
        delay={240}
        description={
          <span className="text-xs leading-5">
            Only households with exactly one supported GRANTEE=Yes flag can start a CAR.
          </span>
        }
      >
        {householdsError ? (
          <p
            role="alert"
            className="flex items-start gap-3 border-l-4 border-[#7a1f1f] bg-[#f6eaea] px-3 py-3 text-sm leading-6 text-[#7a1f1f]"
          >
            <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{householdsError}</span>
          </p>
        ) : householdsLoading ? (
          <div
            role="status"
            aria-label="Loading households for CAR draft"
            aria-busy="true"
            className="space-y-3"
          >
            <div aria-hidden="true" className="motion-safe:animate-pulse h-3 w-24 bg-[#e6e0d4]" />
            <div aria-hidden="true" className="motion-safe:animate-pulse h-11 w-full border border-[#c9c3b6] bg-[#ece7dc]" />
            <div aria-hidden="true" className="motion-safe:animate-pulse h-11 w-full bg-[#e6e0d4]" />
            <p className="text-xs text-[#5b574e]">Finding households ready for a CAR…</p>
          </div>
        ) : (
          <>
            <Label htmlFor="car-household" className="block text-xs font-semibold">
              Household
            </Label>
            <select
              id="car-household"
              value={householdId}
              disabled={creating || households.length === 0}
              onChange={(event) => setHouseholdId(event.target.value)}
              className="mt-1 min-h-[44px] w-full border border-[#c9c3b6] bg-white px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f] disabled:cursor-not-allowed disabled:bg-[#ece7dc]"
            >
              <option value="">
                {households.length === 0 ? "No validated household available" : "Select a household"}
              </option>
              {households.map((household) => (
                <option key={household.id} value={household.id}>
                  {household.hhId} · {household.grantee.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!householdId || creating}
              onClick={() => {
                void onCreateDraft(householdId);
                setHouseholdId("");
              }}
              className="group mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 border border-[#161512] bg-[#161512] px-3 py-2 text-sm font-medium text-[#f4f1ea] hover:bg-[#7a1f1f] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
            >
              {creating ? "Creating draft…" : "Create draft"}
              {!creating && householdId && (
                <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              )}
            </button>
            {householdsRefreshError ? (
              <p
                role="status"
                className="mt-3 flex items-start gap-2 border-l-4 border-[#b45309] bg-[#f3ead8] px-3 py-2 text-xs leading-5 text-[#704700]"
              >
                <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#b45309]" />
                <span>{householdsRefreshError} Showing previously loaded households.</span>
              </p>
            ) : null}
            {actionError ? (
              <p
                role="alert"
                className="mt-3 flex items-start gap-2 border-l-4 border-[#7a1f1f] bg-[#f6eaea] px-3 py-2 text-xs leading-5 text-[#7a1f1f]"
              >
                <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{actionError}</span>
              </p>
            ) : null}
          </>
        )}
      </SectionCard>

      <SectionCard
        id="car-drafts-heading"
        title="Drafts"
        delay={300}
        // Sticky at the header offset; capped to the viewport so the list
        // scrolls internally instead of growing past the screen. The section
        // is the flex parent that fills this cap (previously the aside was).
        className="lg:sticky lg:top-24 lg:flex lg:max-h-[calc(100dvh-7rem)] lg:flex-col"
        cardClassName="overflow-hidden lg:flex lg:min-h-0 lg:flex-1 lg:flex-col"
        headerClassName="lg:shrink-0"
        contentClassName="min-h-0 p-0 lg:flex lg:flex-1 lg:flex-col lg:overflow-hidden"
        action={<span className="font-mono text-[10px] text-[#5b574e]">{drafts.length} records</span>}
      >
        <div
          role="region"
          aria-label="Scrollable CAR drafts"
          className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
          tabIndex={0}
        >
          {drafts.length === 0 ? (
            <p className="px-3 py-5 text-sm leading-6 text-[#5b574e]">
              No CAR drafts yet. Select a validated household above to begin.
            </p>
          ) : (
            <ul className="divide-y divide-[#c9c3b6]">
              {drafts.map((draft) => {
                const selected = draft.id === selectedDraftId;
                const ready = draft.status === "draft_ready_for_review";
                return (
                  <li key={draft.id}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onSelectDraft(draft.id)}
                      className={`w-full border-l-4 px-3 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7a1f1f] ${
                        selected ? "border-[#7a1f1f] bg-[#ece7dc]" : "border-transparent hover:bg-[#fbf9f4]"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-semibold">{draft.reference}</span>
                        <span
                          className={`border px-1.5 py-0.5 text-[10px] ${
                            ready
                              ? "border-[#161512] text-[#161512]"
                              : "border-[#b45309] text-[#8a5a00]"
                          }`}
                        >
                          {ready ? "Ready for review" : "Draft"}
                        </span>
                      </span>
                      <span className="mt-1 block text-xs text-[#5b574e]">
                        HH_ID {draft.hhId || "Unavailable"} · Revision {draft.revision}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SectionCard>
    </aside>
  );
}
