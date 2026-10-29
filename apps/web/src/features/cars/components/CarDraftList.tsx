import React, { useState } from "react";
import { SectionCard } from "../../../components/ui/section-card";
import type { CarDraft, ValidatedHousehold } from "../types";

export function CarDraftList({
  drafts,
  households,
  selectedDraftId,
  onSelectDraft,
  onCreateDraft,
}: {
  drafts: CarDraft[];
  households: ValidatedHousehold[];
  selectedDraftId: string | null;
  onSelectDraft: (draftId: string) => void;
  onCreateDraft: (householdId: string) => void;
}) {
  const [householdId, setHouseholdId] = useState("");

  return (
    <aside className="min-w-0 space-y-5" aria-label="CAR drafts">
      <SectionCard
        id="car-new-draft-heading"
        eyebrow="Start a CAR"
        title="Choose a validated household"
        description={
          <span className="text-xs leading-5">
            Only households with exactly one supported GRANTEE=Yes flag can start a CAR.
          </span>
        }
      >
        <label htmlFor="car-household" className="block text-xs font-semibold">
          Household
        </label>
        <select
          id="car-household"
          value={householdId}
          onChange={(event) => setHouseholdId(event.target.value)}
          className="mt-1 min-h-[44px] w-full border border-[#8c877c] bg-[#fbf9f4] px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
        >
          <option value="">Select a household</option>
          {households.map((household) => (
            <option key={household.id} value={household.id}>
              {household.hhId} · {household.grantee.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!householdId}
          onClick={() => {
            onCreateDraft(householdId);
            setHouseholdId("");
          }}
          className="mt-3 min-h-[44px] w-full border border-[#161512] bg-[#161512] px-3 py-2 text-sm font-medium text-[#f4f1ea] hover:bg-[#7a1f1f] disabled:cursor-not-allowed disabled:border-[#b5afa2] disabled:bg-[#b5afa2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
        >
          Create draft
        </button>
      </SectionCard>

      <SectionCard
        id="car-drafts-heading"
        title="Drafts"
        cardClassName="overflow-hidden"
        contentClassName="p-0"
        action={<span className="font-mono text-[10px] text-[#5b574e]">{drafts.length} records</span>}
      >
        {drafts.length === 0 ? (
          <p className="px-3 py-5 text-sm leading-6 text-[#5b574e]">
            No CAR drafts yet. Select a validated household above to begin.
          </p>
        ) : (
          <ul className="divide-y divide-[#c9c3b6]">
            {drafts.map((draft) => {
              const household = households.find((item) => item.id === draft.householdId);
              const selected = draft.id === selectedDraftId;
              return (
                <li key={draft.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelectDraft(draft.id)}
                    className={`w-full border-l-4 px-3 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7a1f1f] ${
                      selected ? "border-[#7a1f1f] bg-[#ece7dc]" : "border-transparent hover:bg-[#f8f5ee]"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-semibold">{draft.reference}</span>
                      <span className="border border-[#8a5a00] bg-[#f3ead8] px-1.5 py-0.5 text-[10px] text-[#704700]">
                        Draft
                      </span>
                    </span>
                    <span className="mt-1 block text-xs text-[#5b574e]">
                      HH_ID {household?.hhId ?? "Unavailable"} · Revision {draft.revision}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </aside>
  );
}
