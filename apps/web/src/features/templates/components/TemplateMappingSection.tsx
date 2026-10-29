import React from "react";
import { Label } from "../../../components/ui/label";
import { SectionCard } from "../../../components/ui/section-card";
import { templateFieldOptions } from "../lib/template-validation";
import type { TemplateFieldMapping } from "../types";

export function TemplateMappingSection({
  mappings,
  editable,
  onChange,
}: {
  mappings: TemplateFieldMapping[];
  editable: boolean;
  onChange: (mappingId: string, update: Partial<TemplateFieldMapping>) => void;
}) {
  return (
    <SectionCard
      id="template-mappings-heading"
      eyebrow="Detected placeholders · mock list"
      title="Field mapping"
      description="Map each detected placeholder to a CAR field. Required placeholders without a mapping block validation."
      cardClassName="overflow-hidden"
      contentClassName="p-0"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-left text-sm">
          <thead>
            <tr className="bg-[#ece7dc]">
              <th scope="col" className="border-b border-[#c9c3b6] px-3 py-2 font-mono text-[10px] uppercase">
                Placeholder
              </th>
              <th scope="col" className="border-b border-[#c9c3b6] px-3 py-2 font-mono text-[10px] uppercase">
                CAR field
              </th>
              <th scope="col" className="border-b border-[#c9c3b6] px-3 py-2 font-mono text-[10px] uppercase">
                Required
              </th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((mapping) => (
              <tr key={mapping.id} className="odd:bg-[#fbf9f4]">
                <th scope="row" className="border-b border-[#e2ddd1] px-3 py-3 font-mono text-xs font-medium">
                  {"{{"}
                  {mapping.placeholder}
                  {"}}"}
                </th>
                <td className="border-b border-[#e2ddd1] px-3 py-2">
                  <Label htmlFor={`mapping-${mapping.id}`} className="sr-only">
                    CAR field for {mapping.placeholder}
                  </Label>
                  <select
                    id={`mapping-${mapping.id}`}
                    value={mapping.fieldKey}
                    onChange={(event) => onChange(mapping.id, { fieldKey: event.target.value })}
                    disabled={!editable}
                    className="min-h-[40px] w-full border border-[#8c877c] bg-[#fbf9f4] px-2 text-xs disabled:bg-[#ece7dc] disabled:text-[#5b574e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
                  >
                    <option value="">Not mapped</option>
                    {templateFieldOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="border-b border-[#e2ddd1] px-3 py-2">
                  <Label className="flex min-h-[36px] items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={mapping.required}
                      onChange={(event) =>
                        onChange(mapping.id, { required: event.target.checked })
                      }
                      disabled={!editable}
                      className="h-4 w-4 accent-[#7a1f1f] disabled:opacity-70"
                    />
                    {mapping.required ? "Required" : "Optional"}
                  </Label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!editable && (
        <p className="border-t border-[#c9c3b6] px-4 py-3 text-xs leading-5 text-[#5b574e]">
          This version is read-only. Changes require a new template version.
        </p>
      )}
    </SectionCard>
  );
}
