import React, { useState } from "react";
import {
  REPORT_TEMPLATE,
  SLOT_BY_KEY,
  type ReportBlock,
  type ReportSection,
  type SlotValue,
  type SlotValues,
} from "@report-template";
import type {
  CarDraft,
  FamilyCompositionMember,
  InterventionDraft,
  ReportMode,
  ValidatedHousehold,
} from "../../types";
import {
  buildSlotContext,
  describeSlotSource,
  resolveSlotValues,
  sentencePreview,
} from "../../lib/report/values";
import { SlotChip, StaticTextWithSlots } from "./SlotChip";
import { FamilyCompositionTable } from "./FamilyCompositionTable";
import { InterventionPlanTable } from "./InterventionPlanTable";

/**
 * The paper view: renders the versioned Annex C template section by section.
 * Static wording comes straight from the template definition and is never
 * editable; only `{{slot}}` blanks render as interactive chips (Edit mode).
 * Preview and Print show the same document with blanks filled or `____`.
 */
export function CarReportDocument({
  draft,
  household,
  mode,
  onSlotEdit,
  onSlotReveal,
  onUpdateFamilyMember,
  onUpdateIntervention,
  onAddIntervention,
  onRemoveIntervention,
}: {
  draft: CarDraft;
  household: ValidatedHousehold | null;
  mode: ReportMode;
  onSlotEdit: (key: string, value: string, reason?: string) => void;
  onSlotReveal?: (key: string) => void;
  onUpdateFamilyMember: (
    memberId: string,
    update: Partial<FamilyCompositionMember>,
  ) => void;
  onUpdateIntervention: (
    interventionId: string,
    update: Partial<InterventionDraft>,
  ) => void;
  onAddIntervention: () => void;
  onRemoveIntervention: (interventionId: string) => void;
}) {
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const values: SlotValues = resolveSlotValues(draft, household);
  const context = buildSlotContext(draft, household);
  const showDraftMark = mode !== "edit" && draft.workflowStatus !== "approved";

  function handleReveal(key: string) {
    setRevealedKeys((current) => new Set(current).add(key));
    onSlotReveal?.(key);
  }

  function textWithSlots(text: string) {
    return (
      <StaticTextWithSlots
        text={text}
        values={values}
        mode={mode}
        onSlotEdit={onSlotEdit}
        onSlotReveal={handleReveal}
        sourceDescriptionFor={(key) => {
          const def = SLOT_BY_KEY[key];
          if (!def) return "";
          let description = describeSlotSource(def, context, values[key]);
          if (def.sensitive && !revealedKeys.has(key) && mode !== "print") {
            description += " · masked until revealed (reveal is logged)";
          }
          return description;
        }}
        sentencePreviewFor={(key, value) => sentencePreview(key, values, value)}
      />
    );
  }

  function renderBlock(block: ReportBlock, index: number): React.ReactNode {
    switch (block.kind) {
      case "title":
        return (
          <h2
            key={index}
            className="text-center font-serif text-2xl font-bold uppercase tracking-[0.08em] sm:text-[26px]"
          >
            {block.text}
          </h2>
        );
      case "heading":
        return block.level === 2 ? (
          <h3
            key={index}
            className="mt-5 border-b border-[#c9c3b6] pb-1 font-serif text-xl font-semibold"
          >
            {block.text}
          </h3>
        ) : (
          <h4 key={index} className="mt-4 font-serif text-lg font-semibold">
            {block.text}
          </h4>
        );
      case "para":
        return (
          <p
            key={index}
            className={`mt-3 text-[15px] leading-7 text-justify ${
              block.align === "right" ? "text-right" : ""
            }`}
          >
            {textWithSlots(block.text)}
          </p>
        );
      case "goal":
        return (
          <p key={index} className="mt-3 font-semibold text-[15px] leading-7">
            {textWithSlots(block.text)}
          </p>
        );
      case "fields":
        return (
          <dl key={index} className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {block.fields.map((field) => {
              const def = SLOT_BY_KEY[field.slot];
              if (!def) return null;
              return (
                <div key={field.slot} className="flex items-baseline gap-2 border-b border-dotted border-[#e2ddd1] pb-1">
                  <dt className="whitespace-nowrap text-[13px] font-semibold text-[#3f3b34]">
                    {field.label}
                  </dt>
                  <dd className="min-w-0 flex-1 text-[15px]">
                    <SlotChip
                      def={def}
                      slotValue={values[field.slot]}
                      mode={mode}
                      onEdit={(value, reason) => onSlotEdit(field.slot, value, reason)}
                      onReveal={() => handleReveal(field.slot)}
                      sourceDescription={
                        def.sensitive && !revealedKeys.has(field.slot) && mode !== "print"
                          ? `${describeSlotSource(def, context, values[field.slot])} · masked until revealed (reveal is logged)`
                          : describeSlotSource(def, context, values[field.slot])
                      }
                      sentencePreview={(value) => sentencePreview(field.slot, values, value)}
                      resolvedValues={values}
                    />
                  </dd>
                </div>
              );
            })}
          </dl>
        );
      case "familyTable":
        return (
          <FamilyCompositionTable
            key={index}
            members={draft.familyComposition}
            mode={mode}
            onUpdateMember={onUpdateFamilyMember}
          />
        );
      case "interventionTable":
        return (
          <InterventionPlanTable
            key={index}
            interventions={draft.interventions}
            values={values}
            mode={mode}
            onUpdate={onUpdateIntervention}
            onAddCustom={onAddIntervention}
            onRemove={onRemoveIntervention}
          />
        );
      case "signatories":
        return (
          <Signatories key={index} values={values} mode={mode} onSlotEdit={onSlotEdit} onSlotReveal={handleReveal} context={context} revealedKeys={revealedKeys} />
        );
      default:
        return null;
    }
  }

  return (
    <article
      aria-label="Case Assessment Report document"
      className="relative mx-auto w-full max-w-[900px] border border-[#c9c3b6] bg-white px-5 py-7 shadow-sm sm:px-10 sm:py-10 print:max-w-none print:border-0 print:shadow-none"
    >
      {showDraftMark ? (
        <>
          <p className="mb-4 border border-[#7a1f1f] bg-[#f2e4e1] px-3 py-2 text-center font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#7a1f1f] sm:text-sm">
            Draft — not approved
          </p>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
          >
            <span className="rotate-[-16deg] select-none text-[clamp(3rem,12vw,7rem)] font-bold uppercase tracking-widest text-[#7a1f1f] opacity-[0.07]">
              Draft
            </span>
          </span>
        </>
      ) : null}

      {REPORT_TEMPLATE.sections.map((section: ReportSection) => (
        <section
          key={section.id}
          id={`section-${section.id}`}
          aria-labelledby={`section-${section.id}-title`}
          className={section.id === "header" ? "" : "mt-2"}
        >
          {section.blocks.map((block, index) => renderBlock(block, index))}
          <span id={`section-${section.id}-title`} className="sr-only">
            {section.title}
          </span>
        </section>
      ))}
    </article>
  );
}

function Signatories({
  values,
  mode,
  onSlotEdit,
  onSlotReveal,
  context,
  revealedKeys,
}: {
  values: SlotValues;
  mode: ReportMode;
  onSlotEdit: (key: string, value: string, reason?: string) => void;
  onSlotReveal: (key: string) => void;
  context: ReturnType<typeof buildSlotContext>;
  revealedKeys: Set<string>;
}) {
  const slot = (key: string) => {
    const def = SLOT_BY_KEY[key];
    if (!def) return null;
    return (
      <SlotChip
        def={def}
        slotValue={values[key]}
        mode={mode}
        onEdit={(value, reason) => onSlotEdit(key, value, reason)}
        onReveal={() => onSlotReveal(key)}
        sourceDescription={describeSlotSource(def, context, values[key])}
        resolvedValues={values}
      />
    );
  };

  return (
    <div className="mt-8 grid gap-6 border-t border-[#c9c3b6] pt-5 sm:grid-cols-3">
      <div>
        <p className="text-[13px] font-semibold">Prepared by:</p>
        <p className="mt-2 text-[15px]">{slot("prepared_by_name")}</p>
        <p className="text-[15px]">{slot("prepared_by_title")}</p>
        <p className="mt-2 text-[13px]">Date: {slot("prepared_by_date")}</p>
      </div>
      <div>
        <p className="text-[13px] font-semibold">Concurred by:</p>
        <p className="mt-2 text-[15px]">{slot("concurred_by_name")}</p>
        <p className="text-[15px]">{slot("concurred_by_title")}</p>
        <p className="mt-2 text-[13px]">Date: {slot("concurred_by_date")}</p>
      </div>
      <div>
        <p className="text-[13px] font-semibold">Approved by:</p>
        <p className="mt-2 text-[15px]">{slot("approved_by_name")}</p>
        <p className="text-[15px]">{slot("approved_by_title")}</p>
        <p className="mt-2 text-[13px]">Date: {slot("approved_by_date")}</p>
      </div>
    </div>
  );
}
