import React, { useEffect, useRef, useState } from "react";
import type { SlotDef, SlotValue } from "@report-template";
import { SLOT_BY_KEY, formatSlotValue, parseSegments, slotDisplay } from "@report-template";

/**
 * One dynamic blank (`____`) of the template.
 *
 * Edit mode shows the chip states from the plan: teal for derived/computed,
 * indigo for manual, amber underline for missing, dotted underline + "edited"
 * for overrides, `•••••` + Reveal for sensitive fields. Preview and Print
 * render plain filled text so the document reads exactly like the paper form.
 * Static template wording is never routed through this component.
 */
export function SlotChip({
  def,
  slotValue,
  mode,
  onEdit,
  onReveal,
  sourceDescription,
  sentencePreview,
  resolvedValues,
}: {
  def: SlotDef;
  slotValue: SlotValue | undefined;
  mode: "edit" | "preview" | "print";
  onEdit: (value: string, reason?: string) => void;
  onReveal?: () => void;
  sourceDescription?: string;
  sentencePreview?: (value: string) => string | null;
  /** Full resolved values, for the live sentence preview. */
  resolvedValues?: Record<string, SlotValue | undefined>;
}) {
  const [open, setOpen] = useState(false);
  const [draftValue, setDraftValue] = useState("");
  const [reason, setReason] = useState("");
  const [revealed, setRevealed] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);

  const display = slotDisplay(def, slotValue);
  const missing = display === null;
  const masked = Boolean(def.sensitive) && !revealed && mode !== "print";
  const overridden = Boolean(slotValue?.overridden);

  useEffect(() => {
    if (!open) return;
    const onOutside = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  function openEditor() {
    if (mode !== "edit") return;
    setDraftValue(slotValue?.value ?? "");
    setReason("");
    setOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function save() {
    const trimmed = draftValue.trim();
    const needsReason =
      Boolean((slotValue?.value ?? "").trim()) &&
      (def.source === "derived" || def.source === "setting");
    if (needsReason) {
      if (!reason.trim()) return; // Override requires a reason (REQ-RPT-007).
      onEdit(trimmed, reason.trim());
    } else {
      onEdit(trimmed);
    }
    setOpen(false);
  }

  /** Plain (non-interactive) rendering for Preview and Print. */
  if (mode !== "edit") {
    let text: string;
    if (missing) text = "____";
    else if (masked) text = "•••••";
    else text = display ?? "";
    return (
      <span
        id={`slot-${def.key}`}
        className={missing ? "text-[#8a5a00]" : undefined}
        data-slot={def.key}
      >
        {text}
      </span>
    );
  }

  const triggerClass = missing
    ? "border-b-2 border-dashed border-[#d6a100] bg-[#fdf6e6] text-[#8a5a00] hover:bg-[#f7ecd2]"
    : overridden
      ? "border-b border-dotted border-[#7a1f1f] bg-[#f6eeee] text-[#3f3b34] hover:bg-[#f2e4e1]"
      : def.source === "derived" || def.source === "computed"
        ? "border-b border-[#0b5c56] bg-[#e3f1ef] text-[#0b5c56] hover:bg-[#d3e9e6]"
        : "border-b border-[#3b3fa0] bg-[#e9e9f7] text-[#33357f] hover:bg-[#dedef3]";

  const triggerTitle = [
    missing ? `${def.label} — needs input` : def.label,
    def.source === "computed" ? "Calculated value (read-only)" : null,
    slotValue?.overridden && slotValue.original
      ? `Original: ${slotValue.original}${slotValue.reason ? ` · ${slotValue.reason}` : ""}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const previewSentence = open ? sentencePreview?.(draftValue) : null;
  const isComputed = def.source === "computed";
  const requiresReason =
    open &&
    Boolean((slotValue?.value ?? "").trim()) &&
    (def.source === "derived" || def.source === "setting");

  return (
    <span
      ref={wrapperRef}
      id={`slot-${def.key}`}
      data-slot={def.key}
      data-slot-source={def.source}
      className="relative inline-block max-w-full align-baseline"
    >
      <button
        type="button"
        onClick={isComputed ? () => { setDraftValue(slotValue?.value ?? ""); setReason(""); setOpen(true); } : openEditor}
        title={triggerTitle}
        aria-label={`${def.label}${missing ? " (needs input)" : ""}`}
        aria-expanded={open}
        className={`inline-block max-w-[26ch] truncate px-1 text-left text-[0.95em] leading-6 ${triggerClass}`}
      >
        {missing ? "____" : masked ? "•••••" : (display ?? "").replace(/\n+/g, " · ")}
        {overridden ? (
          <span className="ml-1 align-super text-[9px] font-semibold uppercase tracking-wide text-[#7a1f1f]">
            edited
          </span>
        ) : null}
        {def.source === "computed" && !missing ? (
          <span className="ml-1 align-super text-[9px] font-semibold text-[#0b5c56]">calc</span>
        ) : null}
      </button>

      {def.sensitive && !revealed && !missing ? (
        <button
          type="button"
          onClick={() => {
            setRevealed(true);
            onReveal?.();
          }}
          aria-label={`Reveal ${def.label}`}
          className="ml-1 border border-[#8c877c] bg-[#ece7dc] px-1 text-[10px] font-medium text-[#5b574e] hover:bg-[#e2ddd1]"
        >
          Reveal
        </button>
      ) : null}

      {open ? (
        <span className="absolute left-0 top-full z-30 mt-1 block w-[min(340px,80vw)] border border-[#8c877c] bg-[#fbf9f4] p-3 text-left shadow-lg">
          <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-[#5b574e]">
            {def.label}
          </span>

          <span className="mt-2 block">
            {def.type === "longtext" ? (
              <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={draftValue}
                onChange={(event) => setDraftValue(event.target.value)}
                rows={3}
                aria-label={def.label}
                className="w-full border border-[#8c877c] bg-white px-2 py-1 text-sm leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
              />
            ) : def.type === "select" && def.options ? (
              <select
                ref={inputRef as React.RefObject<HTMLSelectElement>}
                value={draftValue}
                onChange={(event) => setDraftValue(event.target.value)}
                aria-label={def.label}
                className="min-h-[36px] w-full border border-[#8c877c] bg-white px-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
              >
                <option value="">Select…</option>
                {def.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type={def.type === "date" ? "date" : "text"}
                value={draftValue}
                onChange={(event) => setDraftValue(event.target.value)}
                aria-label={def.label}
                className="min-h-[36px] w-full border border-[#8c877c] bg-white px-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
              />
            )}
          </span>

          {previewSentence ? (
            <span className="mt-2 block border-l-2 border-[#0b5c56] bg-[#e3f1ef] px-2 py-1 text-xs leading-5 text-[#0b4a46]">
              <span className="mb-1 block font-mono text-[9px] uppercase tracking-[0.1em]">
                In context
              </span>
              {previewSentence}
            </span>
          ) : null}

          <span className="mt-2 block text-[11px] leading-4 text-[#5b574e]">
            {slotValue?.overridden && slotValue.original
              ? `Overridden · original: ${slotValue.original}${slotValue.reason ? ` · ${slotValue.reason}` : ""}`
              : sourceDescription ?? def.source}
          </span>

          {requiresReason ? (
            <span className="mt-2 block">
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                aria-label={`Reason for changing ${def.label}`}
                placeholder="Reason for changing this value (required)"
                className="min-h-[36px] w-full border border-[#8c877c] bg-white px-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
              />
            </span>
          ) : null}

          <span className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={requiresReason && !reason.trim()}
              className="min-h-[32px] border border-[#161512] bg-[#161512] px-3 text-xs font-medium text-[#f4f1ea] hover:bg-[#7a1f1f] disabled:cursor-not-allowed disabled:border-[#b5afa2] disabled:bg-[#b5afa2]"
            >
              {requiresReason ? "Override value" : isComputed ? "Close" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-[32px] border border-[#8c877c] px-3 text-xs font-medium text-[#5b574e] hover:bg-[#ece7dc]"
            >
              Cancel
            </button>
            {isComputed ? (
              <span className="text-[10px] text-[#5b574e]">Calculated — not editable.</span>
            ) : null}
          </span>
        </span>
      ) : null}
    </span>
  );
}

/** Renders static template text with its `{{slot}}` blanks as SlotChips. */
export function StaticTextWithSlots({
  text,
  values,
  mode,
  onSlotEdit,
  onSlotReveal,
  sourceDescriptionFor,
  sentencePreviewFor,
}: {
  text: string;
  values: Record<string, SlotValue | undefined>;
  mode: "edit" | "preview" | "print";
  onSlotEdit: (key: string, value: string, reason?: string) => void;
  onSlotReveal?: (key: string) => void;
  sourceDescriptionFor?: (key: string) => string;
  sentencePreviewFor?: (key: string, value: string) => string | null;
}) {
  const segments = parseSegments(text);
  return (
    <>
      {segments.map((segment, index) => {
        if (segment.t === "text") {
          return <React.Fragment key={index}>{segment.value}</React.Fragment>;
        }
        const def = SLOT_BY_KEY[segment.key];
        if (!def) {
          return <React.Fragment key={index}>____</React.Fragment>;
        }
        return (
          <SlotChip
            key={`${segment.key}-${index}`}
            def={def}
            slotValue={values[segment.key]}
            mode={mode}
            onEdit={(value, reason) => onSlotEdit(segment.key, value, reason)}
            onReveal={() => onSlotReveal?.(segment.key)}
            sourceDescription={sourceDescriptionFor?.(segment.key)}
            sentencePreview={(value) => sentencePreviewFor?.(segment.key, value) ?? null}
            resolvedValues={values}
          />
        );
      })}
    </>
  );
}
