import React from "react";
import type { CarDraft, ValidatedHousehold } from "../types";
import { formatCarDate } from "../lib/car-draft";

function PreviewText({ value }: { value: string }) {
  return value.trim() ? (
    <p className="whitespace-pre-wrap text-sm leading-6">{value}</p>
  ) : (
    <p className="text-sm italic text-[#777166]">Not entered</p>
  );
}

export function CarDraftPreview({
  draft,
  household,
  templateLabel,
  onEdit,
}: {
  draft: CarDraft;
  household: ValidatedHousehold;
  templateLabel: string;
  onEdit: () => void;
}) {
  const includedMembers = draft.familyComposition.filter((member) => member.include);

  return (
    <section aria-labelledby="car-preview-heading" className="border border-[#c9c3b6] bg-[#fbf9f4]">
      <header className="border-b-2 border-[#7a1f1f] bg-[#f2e4e1] px-4 py-4 text-center">
        <p className="font-mono text-lg font-bold tracking-[0.16em] text-[#7a1f1f] sm:text-2xl">
          DRAFT — NOT APPROVED
        </p>
        <p className="mt-1 text-xs text-[#5b574e]">Preview only · this is not an official Annex C document</p>
      </header>
      <div className="border-b border-[#c9c3b6] px-4 py-4 sm:px-7">
        <p className="text-center font-mono text-[10px] uppercase tracking-[0.14em] text-[#5b574e]">
          Case Assessment Report · Mock preview
        </p>
        <h2 id="car-preview-heading" className="mt-2 text-center font-serif text-2xl">
          Case Assessment Report
        </h2>
        <div className="mt-4 grid gap-2 border-y border-[#c9c3b6] py-3 text-sm sm:grid-cols-2">
          <p><span className="font-semibold">CAR reference:</span> <span className="font-mono">{draft.reference}</span></p>
          <p><span className="font-semibold">Revision:</span> {draft.revision}</p>
          <p><span className="font-semibold">Household:</span> <span className="font-mono">{household.hhId}</span></p>
          <p><span className="font-semibold">Grantee:</span> {household.grantee.name}</p>
          <p><span className="font-semibold">Date prepared:</span> {formatCarDate(draft.datePrepared)}</p>
          <p><span className="font-semibold">Template:</span> {templateLabel || "Not selected"}</p>
        </div>
      </div>
      <div className="space-y-5 px-4 py-5 sm:px-7">
        <PreviewSection label="Family composition">
          {includedMembers.length === 0 ? (
            <p className="text-sm italic text-[#777166]">No members included in this draft</p>
          ) : (
            <ul className="divide-y divide-[#e2ddd1]">
              {includedMembers.map((member) => (
                <li key={member.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                  <span>{member.name} <span className="text-[#5b574e]">· {member.relationship}</span></span>
                  <span className="font-mono text-xs">Age {member.age} · Row {member.sourceRow}</span>
                </li>
              ))}
            </ul>
          )}
        </PreviewSection>
        <PreviewSection label="Presenting problem"><PreviewText value={draft.presentingProblem} /></PreviewSection>
        <PreviewSection label="Background information"><PreviewText value={draft.backgroundInformation} /></PreviewSection>
        <PreviewSection label="Assessment"><PreviewText value={draft.assessment} /></PreviewSection>
        <PreviewSection label="Intervention plan">
          {draft.interventions.length === 0 ? (
            <p className="text-sm italic text-[#777166]">No intervention rows</p>
          ) : (
            <ol className="space-y-3">
              {draft.interventions.map((intervention) => (
                <li key={intervention.id} className="text-sm">
                  <p className="font-semibold">{intervention.type || "Type not selected"}</p>
                  <PreviewText value={intervention.details} />
                </li>
              ))}
            </ol>
          )}
        </PreviewSection>
        <PreviewSection label="Recommendation"><PreviewText value={draft.recommendation} /></PreviewSection>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#c9c3b6] px-4 py-4 sm:px-7">
        <p className="text-xs leading-5 text-[#5b574e]">
          Drafts can contain missing fields. Review the checklist before continuing.
        </p>
        <button
          type="button"
          onClick={onEdit}
          className="min-h-[44px] border border-[#161512] px-4 py-2 text-sm font-medium hover:bg-[#ece7dc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
        >
          Return to editor
        </button>
      </footer>
    </section>
  );
}

function PreviewSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-[#e2ddd1] pb-4 last:border-b-0">
      <h3 className="mb-2 font-serif text-lg">{label}</h3>
      {children}
    </section>
  );
}
