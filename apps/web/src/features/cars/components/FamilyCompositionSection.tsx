import React from "react";
import { Label } from "../../../components/ui/label";
import type { CarDraft } from "../types";

export function FamilyCompositionSection({
  members,
  onUpdateMember,
}: {
  members: CarDraft["familyComposition"];
  onUpdateMember: (
    memberId: string,
    update: Partial<CarDraft["familyComposition"][number]>,
  ) => void;
}) {
  return (
    <section id="familyComposition" aria-labelledby="family-composition-heading" className="border-b border-[#c9c3b6] px-4 py-5 sm:px-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="family-composition-heading" className="font-serif text-xl">Family composition</h3>
        <p className="text-xs text-[#5b574e]">Member details copied from the household sample</p>
      </div>
      {members.length === 0 ? (
        <p className="mt-3 border-l-4 border-[#8a5a00] bg-[#f3ead8] px-3 py-3 text-sm leading-6 text-[#704700]">
          No family members are available. Review household source data before continuing.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-left text-sm">
            <thead>
              <tr className="bg-[#ece7dc]">
                {["Include", "Member", "Relationship", "Age", "Entry ID", "Source"].map((heading) => (
                  <th key={heading} scope="col" className="border-b border-[#c9c3b6] px-2 py-2 font-mono text-[10px] uppercase tracking-[0.08em]">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className={member.include ? "odd:bg-[#fbf9f4]" : "bg-[#ece7dc] text-[#777166]"}>
                  <td className="border-b border-[#e2ddd1] px-2 py-2">
                    <Label className="flex min-h-[36px] items-center gap-2">
                      <input
                        type="checkbox"
                        checked={member.include}
                        onChange={(event) => onUpdateMember(member.id, { include: event.target.checked })}
                        className="h-4 w-4 accent-[#7a1f1f]"
                      />
                      <span className="text-xs">{member.include ? "Included" : "Excluded from draft"}</span>
                    </Label>
                  </td>
                  <th scope="row" className="border-b border-[#e2ddd1] px-2 py-2 font-medium">
                    {member.name}
                  </th>
                  <td className="border-b border-[#e2ddd1] px-2 py-2">{member.relationship}</td>
                  <td className="border-b border-[#e2ddd1] px-2 py-2 tabular-nums">{member.age}</td>
                  <td className="border-b border-[#e2ddd1] px-2 py-2 font-mono">{member.entryId}</td>
                  <td className="border-b border-[#e2ddd1] px-2 py-2 font-mono text-xs">Row {member.sourceRow}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs leading-5 text-[#5b574e]">
        Inclusion changes apply to this draft only. No household member or imported row is deleted.
      </p>
    </section>
  );
}
