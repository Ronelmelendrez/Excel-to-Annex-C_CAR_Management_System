import React from "react";
import type { CarDraft } from "../types";

const interventionTypes = [
  "Select an intervention type",
  "Counseling",
  "Referral",
  "Financial assistance",
  "Skills development",
  "Other",
];

export function InterventionPlanSection({
  interventions,
  onAdd,
  onUpdate,
  onRemove,
}: {
  interventions: CarDraft["interventions"];
  onAdd: () => void;
  onUpdate: (
    interventionId: string,
    update: Partial<CarDraft["interventions"][number]>,
  ) => void;
  onRemove: (interventionId: string) => void;
}) {
  return (
    <section id="interventions" aria-labelledby="intervention-plan-heading" className="border-b border-[#c9c3b6] px-4 py-5 sm:px-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 id="intervention-plan-heading" className="font-serif text-xl">Intervention plan</h3>
          <p className="mt-1 text-xs text-[#5b574e]">Enter only interventions confirmed by the case worker.</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="min-h-[40px] border border-[#161512] px-3 py-2 text-xs font-semibold hover:bg-[#ece7dc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
        >
          Add intervention
        </button>
      </div>
      {interventions.length === 0 ? (
        <p className="mt-3 border border-dashed border-[#b5afa2] px-3 py-5 text-sm text-[#5b574e]">
          No intervention rows. Add a row only when a planned intervention is known.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {interventions.map((intervention, index) => (
            <fieldset key={intervention.id} className="border border-[#d6d0c4] p-3">
              <legend className="px-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[#5b574e]">
                Intervention {index + 1}
              </legend>
              <div className="grid gap-3 sm:grid-cols-[minmax(160px,0.7fr)_minmax(0,1.3fr)]">
                <div>
                  <label htmlFor={`${intervention.id}-type`} className="block text-xs font-semibold">Type</label>
                  <select
                    id={`${intervention.id}-type`}
                    value={intervention.type}
                    onChange={(event) => onUpdate(intervention.id, { type: event.target.value })}
                    className="mt-1 min-h-[44px] w-full border border-[#8c877c] bg-[#fbf9f4] px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
                  >
                    {interventionTypes.map((type, typeIndex) => (
                      <option key={type} value={typeIndex === 0 ? "" : type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor={`${intervention.id}-details`} className="block text-xs font-semibold">Details</label>
                  <textarea
                    id={`${intervention.id}-details`}
                    value={intervention.details}
                    onChange={(event) => onUpdate(intervention.id, { details: event.target.value })}
                    rows={2}
                    className="mt-1 w-full border border-[#8c877c] bg-[#fbf9f4] px-3 py-2 text-sm leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
                    placeholder="Leave blank until details are confirmed."
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemove(intervention.id)}
                className="mt-2 min-h-[32px] text-xs text-[#7a1f1f] underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
              >
                Remove intervention row
              </button>
            </fieldset>
          ))}
        </div>
      )}
    </section>
  );
}
