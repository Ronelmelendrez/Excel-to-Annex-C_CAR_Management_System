import React from "react";
import { Label } from "../../../components/ui/label";
import type { CarDraft } from "../types";

function NarrativeField({
  id,
  label,
  value,
  hint,
  onChange,
  rows = 4,
}: {
  id: string;
  label: string;
  value: string;
  hint: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <Label htmlFor={id} className="block text-sm font-semibold">{label}</Label>
      <p className="mt-1 text-xs leading-5 text-[#5b574e]">{hint}</p>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="mt-2 w-full resize-y border border-[#8c877c] bg-[#fbf9f4] px-3 py-2 text-sm leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
        placeholder="Enter verified information. Leave blank if it has not been confirmed."
      />
    </div>
  );
}

export function CarNarrativeFields({
  draft,
  onChange,
}: {
  draft: CarDraft;
  onChange: (update: Partial<CarDraft>) => void;
}) {
  return (
    <>
      <section aria-labelledby="presenting-problem-heading" className="border-b border-[#c9c3b6] px-4 py-5 sm:px-5">
        <h3 id="presenting-problem-heading" className="mb-4 font-serif text-xl">Presenting problem</h3>
        <NarrativeField
          id="presentingProblem"
          label="Presenting problem"
          value={draft.presentingProblem}
          hint="Case worker entry. Do not infer facts that are not in an approved source."
          onChange={(presentingProblem) => onChange({ presentingProblem })}
        />
      </section>
      <section aria-labelledby="background-information-heading" className="border-b border-[#c9c3b6] px-4 py-5 sm:px-5">
        <h3 id="background-information-heading" className="mb-4 font-serif text-xl">Background information</h3>
        <NarrativeField
          id="backgroundInformation"
          label="Background information"
          value={draft.backgroundInformation}
          hint="Enter verified context relevant to this case. This mock editor does not generate narrative."
          onChange={(backgroundInformation) => onChange({ backgroundInformation })}
        />
      </section>
      <section aria-labelledby="assessment-heading" className="border-b border-[#c9c3b6] px-4 py-5 sm:px-5">
        <h3 id="assessment-heading" className="mb-4 font-serif text-xl">Assessment</h3>
        <NarrativeField
          id="assessment"
          label="Case worker assessment"
          value={draft.assessment}
          hint="Professional judgment must be entered by the responsible case worker."
          onChange={(assessment) => onChange({ assessment })}
        />
      </section>
    </>
  );
}
