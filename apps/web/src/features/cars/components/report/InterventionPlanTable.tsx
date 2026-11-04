import React, { useState } from "react";
import { INTERVENTION_COLUMNS } from "@report-template";
import type { InterventionDraft } from "../../types";
import { fillInterventionText } from "../../lib/report/values";
import type { SlotValues } from "@report-template";

/**
 * Intervention Plan: standard rows come from the versioned catalog, each CAR
 * may include or exclude them and add custom rows. Activity/remark tokens
 * (`{{grantee_first_name}}`) fill from the shared slot values, so the fixed
 * wording stays static while the blanks are dynamic. Excluded rows are hidden
 * in Preview/Print.
 */
export function InterventionPlanTable({
  interventions,
  values,
  mode,
  onUpdate,
  onAddCustom,
  onRemove,
}: {
  interventions: InterventionDraft[];
  values: SlotValues;
  mode: "edit" | "preview" | "print";
  onUpdate: (id: string, update: Partial<InterventionDraft>) => void;
  onAddCustom: () => void;
  onRemove: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const visible =
    mode === "edit" ? interventions : interventions.filter((row) => row.included ?? true);

  const fill = (text: string, row: InterventionDraft) =>
    fillInterventionText(text ?? "", values, row);

  return (
    <div className="mt-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="bg-[#ece7dc]">
              {INTERVENTION_COLUMNS.map((label) => (
                <th
                  key={label}
                  scope="col"
                  className="border border-[#c9c3b6] px-2 py-2 font-mono text-[10px] uppercase tracking-[0.06em]"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td
                  colSpan={INTERVENTION_COLUMNS.length}
                  className="border border-[#c9c3b6] px-3 py-4 text-sm text-[#704700]"
                >
                  No intervention rows included. Add a row or include a standard one.
                </td>
              </tr>
            ) : (
              visible.map((row) => {
                const included = row.included ?? true;
                const need = (row.need ?? row.type ?? "").trim();
                return (
                  <tr
                    key={row.id}
                    data-intervention={row.id}
                    className={included ? "odd:bg-[#fbf9f4]" : "bg-[#ece7dc] text-[#777166]"}
                  >
                    <td className="border border-[#e2ddd1] px-2 py-2 align-top font-medium">
                      {mode === "edit" ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <input
                            type="checkbox"
                            checked={included}
                            onChange={(event) =>
                              onUpdate(row.id, { included: event.target.checked })
                            }
                            aria-label={`Include ${need || "row"} in the report`}
                            className="h-4 w-4 accent-[#7a1f1f]"
                          />
                          <span>{need || <em className="text-[#8a5a00]">Untitled row</em>}</span>
                        </span>
                      ) : (
                        need || <em>Untitled row</em>
                      )}
                    </td>
                    <td className="border border-[#e2ddd1] px-2 py-2 align-top">
                      {fill(row.objective ?? "", row) || "____"}
                    </td>
                    <td className="whitespace-pre-wrap border border-[#e2ddd1] px-2 py-2 align-top">
                      {fill(row.activities ?? "", row) || "____"}
                    </td>
                    <td className="whitespace-pre-wrap border border-[#e2ddd1] px-2 py-2 align-top">
                      {fill(row.responsible ?? "", row) || "____"}
                    </td>
                    <td className="border border-[#e2ddd1] px-2 py-2 align-top">
                      {fill(row.timeline ?? "", row) || "____"}
                    </td>
                    <td className="whitespace-pre-wrap border border-[#e2ddd1] px-2 py-2 align-top">
                      {fill(row.remarks ?? "", row) || "____"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {mode === "edit" ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onAddCustom}
              className="min-h-[36px] border border-[#161512] px-3 py-1.5 text-xs font-semibold hover:bg-[#ece7dc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
            >
              Add custom row
            </button>
            <p className="text-xs text-[#5b574e]">
              Standard rows are maintained by an admin; this CAR can include, exclude, or extend
              them without changing the catalog.
            </p>
          </div>

          <ul className="space-y-2">
            {interventions.map((row, index) => (
              <li key={row.id} className="border border-[#d6d0c4] bg-[#fbf9f4] px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#5b574e]">
                    Row {index + 1}
                    {row.catalogId ? "" : " · custom"} · {row.included ?? true ? "included" : "excluded"}
                  </span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(editingId === row.id ? null : row.id)}
                      aria-expanded={editingId === row.id}
                      className="min-h-[30px] border border-[#8c877c] px-2 text-xs font-medium hover:bg-[#ece7dc]"
                    >
                      {editingId === row.id ? "Close" : "Edit row"}
                    </button>
                    {row.custom ? (
                      <button
                        type="button"
                        onClick={() => onRemove(row.id)}
                        className="min-h-[30px] border border-[#7a1f1f] px-2 text-xs font-medium text-[#7a1f1f] hover:bg-[#f2e4e1]"
                      >
                        Remove row
                      </button>
                    ) : null}
                  </span>
                </div>

                {editingId === row.id ? (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {(
                      [
                        ["need", "Need/Problem", "text"],
                        ["objective", "Objective", "text"],
                        ["activities", "Helping Activities", "textarea"],
                        ["responsible", "Responsible Person", "textarea"],
                        ["timeline", "Timeline", "text"],
                        ["remarks", "Remarks/Expected Outputs", "textarea"],
                      ] as Array<[keyof InterventionDraft, string, "text" | "textarea"]>
                    ).map(([field, label, control]) => (
                      <label key={String(field)} className="block text-xs font-semibold">
                        {label}
                        {control === "textarea" ? (
                          <textarea
                            value={String(row[field] ?? "")}
                            onChange={(event) => onUpdate(row.id, { [field]: event.target.value })}
                            rows={2}
                            className="mt-1 w-full border border-[#8c877c] bg-white px-2 py-1 text-sm font-normal leading-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
                          />
                        ) : (
                          <input
                            value={String(row[field] ?? "")}
                            onChange={(event) => onUpdate(row.id, { [field]: event.target.value })}
                            className="mt-1 min-h-[34px] w-full border border-[#8c877c] bg-white px-2 text-sm font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
                          />
                        )}
                      </label>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
