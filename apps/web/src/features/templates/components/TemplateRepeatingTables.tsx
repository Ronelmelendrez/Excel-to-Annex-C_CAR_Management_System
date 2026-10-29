import React from "react";
import { Label } from "../../../components/ui/label";
import { SectionCard } from "../../../components/ui/section-card";
import { repeatingCollectionOptions } from "../lib/template-validation";
import type { RepeatingTableConfig } from "../types";

export function TemplateRepeatingTables({
  tables,
  editable,
  onChange,
}: {
  tables: RepeatingTableConfig[];
  editable: boolean;
  onChange: (tableId: string, update: Partial<RepeatingTableConfig>) => void;
}) {
  return (
    <SectionCard
      id="template-repeating-heading"
      title="Repeating table configuration"
      description="Connect repeated Word table rows to the appropriate CAR collection."
      contentClassName="pt-0"
    >
      <ul className="divide-y divide-[#e2ddd1]">
        {tables.map((table) => (
          <li key={table.id} className="grid gap-3 py-3 sm:grid-cols-[minmax(150px,0.7fr)_minmax(0,1.3fr)]">
            <div>
              <p className="text-sm font-semibold">{table.label}</p>
              <div className="mt-2 flex flex-wrap gap-4">
                <Label className="flex min-h-[32px] items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={table.enabled}
                    onChange={(event) => onChange(table.id, { enabled: event.target.checked })}
                    disabled={!editable}
                    className="h-4 w-4 accent-[#7a1f1f] disabled:opacity-70"
                  />
                  Enabled
                </Label>
                <Label className="flex min-h-[32px] items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={table.required}
                    onChange={(event) => onChange(table.id, { required: event.target.checked })}
                    disabled={!editable}
                    className="h-4 w-4 accent-[#7a1f1f] disabled:opacity-70"
                  />
                  Required
                </Label>
              </div>
            </div>
            <div>
              <Label htmlFor={`repeat-${table.id}`} className="block text-xs font-semibold">
                Source collection
              </Label>
              <select
                id={`repeat-${table.id}`}
                value={table.collectionKey}
                onChange={(event) => onChange(table.id, { collectionKey: event.target.value })}
                disabled={!editable || !table.enabled}
                className="mt-1 min-h-[40px] w-full border border-[#8c877c] bg-[#fbf9f4] px-2 text-sm disabled:bg-[#ece7dc] disabled:text-[#5b574e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
              >
                <option value="">Select a collection</option>
                {repeatingCollectionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </li>
        ))}
      </ul>
      {!editable && (
        <p className="border-t border-[#c9c3b6] pt-3 text-xs leading-5 text-[#5b574e]">
          This version is read-only. Changes require a new template version.
        </p>
      )}
    </SectionCard>
  );
}
