import React from "react";
import { Label } from "../../../components/ui/label";
import type { CarDraft, ValidatedHousehold } from "../types";

export function CarIdentitySection({
  draft,
  household,
  templateVersions,
  onChange,
}: {
  draft: CarDraft;
  household: ValidatedHousehold;
  templateVersions: Array<{ id: string; label: string }>;
  onChange: (update: Partial<CarDraft>) => void;
}) {
  return (
    <section aria-labelledby="car-identifying-heading" className="border-b border-[#c9c3b6] px-4 py-5 sm:px-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="car-identifying-heading" className="font-serif text-xl">Identifying information</h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#5b574e]">
          Source-linked fields
        </span>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="border-t border-[#e2ddd1] pt-2">
          <dt className="text-xs text-[#5b574e]">Household ID</dt>
          <dd className="mt-1 font-mono text-sm">HH_ID {household.hhId}</dd>
        </div>
        <div className="border-t border-[#e2ddd1] pt-2">
          <dt className="text-xs text-[#5b574e]">Validated grantee</dt>
          <dd className="mt-1 text-sm">
            {household.grantee.name}
            <span className="ml-2 font-mono text-xs text-[#5b574e]">Source row {household.grantee.sourceRow}</span>
          </dd>
        </div>
        <div className="border-t border-[#e2ddd1] pt-2">
          <dt className="text-xs text-[#5b574e]">Import</dt>
          <dd className="mt-1 break-words text-sm">
            {household.importName} · version {household.importVersion}
          </dd>
        </div>
        <div className="border-t border-[#e2ddd1] pt-2">
          <dt className="text-xs text-[#5b574e]">CAR reference</dt>
          <dd className="mt-1 font-mono text-sm">{draft.reference}</dd>
        </div>
      </dl>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="templateVersion" className="block text-xs font-semibold">
            Template version
          </Label>
          <select
            id="templateVersion"
            value={draft.templateVersion}
            onChange={(event) => onChange({ templateVersion: event.target.value })}
            className="mt-1 min-h-[44px] w-full border border-[#8c877c] bg-[#fbf9f4] px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
          >
            <option value="">Select a template version</option>
            {templateVersions.map((template) => (
              <option key={template.id} value={template.id}>{template.label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[#5b574e]">Sample option only; template management is not connected.</p>
        </div>
        <div>
          <Label htmlFor="datePrepared" className="block text-xs font-semibold">
            Date prepared
          </Label>
          <input
            id="datePrepared"
            type="date"
            value={draft.datePrepared}
            onChange={(event) => onChange({ datePrepared: event.target.value })}
            className="mt-1 min-h-[44px] w-full border border-[#8c877c] bg-[#fbf9f4] px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
          />
        </div>
      </div>
    </section>
  );
}
