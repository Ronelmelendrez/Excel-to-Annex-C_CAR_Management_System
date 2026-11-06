import React from "react";
import { FAMILY_COLUMNS, familyCellDisplay } from "@report-template";
import type { FamilyCompositionMember } from "../../types";

/**
 * Section II — one row per household member. Columns and headers follow the
 * Annex C table exactly (11 columns; Monitored Child split YES/NO). Cell
 * values derive from the imported workbook columns; case-worker corrections
 * are stored as overlays beside the raw values, never over them.
 * Excluded members are greyed out in Edit and hidden in Preview/Print.
 */
export function FamilyCompositionTable({
  members,
  mode,
  onUpdateMember,
}: {
  members: FamilyCompositionMember[];
  mode: "edit" | "preview" | "print";
  onUpdateMember: (
    memberId: string,
    update: Partial<FamilyCompositionMember>,
  ) => void;
}) {
  const visible =
    mode === "edit" ? members : members.filter((member) => member.include);
  const totalColumns = FAMILY_COLUMNS.reduce(
    (sum, column) => sum + (column.split ? column.split.length : 1),
    0,
  );

  function setOverlay(member: FamilyCompositionMember, key: string, value: string) {
    onUpdateMember(member.id, { overlay: { ...(member.overlay ?? {}), [key]: value } });
  }

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
        <thead>
          <tr className="bg-[#ece7dc]">
            {FAMILY_COLUMNS.map((column) => (
              <th
                key={column.key}
                colSpan={column.split ? 2 : 1}
                scope="col"
                className="border border-[#c9c3b6] px-2 py-2 font-mono text-[10px] uppercase tracking-[0.06em]"
              >
                {column.label}
              </th>
            ))}
          </tr>
          <tr className="bg-[#f4f1ea]">
            {FAMILY_COLUMNS.flatMap((column) =>
              column.split ? (
                column.split.map((sub) => (
                  <th
                    key={`${column.key}-${sub}`}
                    scope="col"
                    className="border border-[#c9c3b6] px-2 py-1 text-center font-mono text-[10px] uppercase"
                  >
                    {sub}
                  </th>
                ))
              ) : [
                <th key={`${column.key}-spacer`} className="border border-[#c9c3b6] px-2 py-1" />,
              ],
            )}
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 ? (
            <tr>
              <td
                colSpan={totalColumns}
                className="border border-[#c9c3b6] px-3 py-4 text-sm text-[#704700]"
              >
                No included family members. Review the household source data before continuing.
              </td>
            </tr>
          ) : (
            visible.map((member) => (
              <tr
                key={member.id}
                className={
                  member.include
                    ? "odd:bg-[#fbf9f4]"
                    : "bg-[#ece7dc] text-[#777166] line-through"
                }
                data-member={member.id}
              >
                {FAMILY_COLUMNS.map((column) => {
                  const raw = familyCellDisplay(column.key, member);
                  const original = familyCellDisplay(column.key, {
                    ...member,
                    overlay: undefined,
                  });
                  const hasOverlay = Object.prototype.hasOwnProperty.call(
                    member.overlay ?? {},
                    column.key,
                  );
                  const derivedFromData =
                    column.key !== "occupation" &&
                    column.key !== "monthlyIncome" &&
                    column.key !== "stayingWithHh";

                  if (column.split) {
                    // Monitored Child: YES/NO mark (editable toggle in Edit).
                    return [
                      ...column.split.map((sub) => {
                        const selected = raw === sub;
                        const cell = mode === "edit" ? (
                          <button
                            type="button"
                            key={sub}
                            onClick={() => setOverlay(member, column.key, selected ? "" : sub)}
                            aria-label={`${column.label} ${sub} for ${member.name}`}
                            aria-pressed={selected}
                            className={`min-h-[28px] w-full text-center font-semibold ${
                              selected ? "text-[#7a1f1f]" : "text-[#777166] hover:text-[#161512]"
                            }`}
                          >
                            {selected ? "✓" : ""}
                          </button>
                        ) : (
                          <span key={sub} className="block text-center">
                            {selected ? "✓" : ""}
                          </span>
                        );
                        return (
                          <td
                            key={sub}
                            className="border border-[#e2ddd1] px-1 py-1 text-center"
                          >
                            {cell}
                          </td>
                        );
                      }),
                    ];
                  }

                  const editable = mode === "edit";
                  return (
                    <td
                      key={column.key}
                      className={`border border-[#e2ddd1] px-2 py-1 ${
                        column.key === "age" || column.key === "monthlyIncome"
                          ? "tabular-nums"
                          : ""
                      } ${hasOverlay ? "border-b border-dotted border-b-[#7a1f1f]" : ""} ${
                        derivedFromData && !hasOverlay ? "bg-[#ece7dc]" : ""
                      }`}
                      title={
                        hasOverlay
                          ? `Corrected — original value: "${original}"`
                          : derivedFromData
                            ? "From imported household data"
                            : "Case worker entry"
                      }
                    >
                      {editable ? (
                        <input
                          value={raw}
                          onChange={(event) => setOverlay(member, column.key, event.target.value)}
                          aria-label={`${column.label} for ${member.name}`}
                          placeholder="____"
                          className="min-h-[26px] w-full min-w-[64px] border border-transparent bg-transparent px-1 py-0.5 text-[13px] hover:border-[#c9c3b6] focus-visible:border-[#161512] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
                        />
                      ) : raw ? (
                        <span className="block px-1">{raw}</span>
                      ) : (
                        <span className="block px-1 text-[#8a5a00]">____</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {mode === "edit" ? (
        <div className="mt-2 space-y-1 text-xs leading-5 text-[#5b574e]">
          <p>
            Grey cells come from the imported household columns; corrections are stored as overlays
            beside the raw values. Import rows are never changed.
          </p>
          <ul className="flex flex-wrap gap-x-4">
            {members
              .filter((member) => !member.include)
              .map((member) => (
                <li key={member.id} className="text-[#7a1f1f]">
                  {member.name} — excluded from this report (still in the household register)
                </li>
              ))}
          </ul>
        </div>
      ) : null}
      {mode === "edit" ? (
        <div className="mt-2 space-y-1">
          {members.map((member) => (
            <label key={member.id} className="flex min-h-[32px] items-center gap-2 text-xs text-[#3f3b34]">
              <input
                type="checkbox"
                checked={member.include}
                onChange={(event) =>
                  onUpdateMember(member.id, { include: event.target.checked })
                }
                className="h-4 w-4 accent-[#7a1f1f]"
              />
              Include {member.name} in the report
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
