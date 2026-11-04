/**
 * Client-side slot helpers for the CAR report page.
 *
 * The value derivation itself lives in the shared template module
 * (`@report-template` → supabase/functions/_shared/report-template.ts) so the
 * Edge Function computes identical values and completeness — this file keeps
 * the editor-facing wrappers (checklist, source descriptions, overrides).
 */
import {
  DEFAULT_INTERVENTION_CATALOG,
  REPORT_TEMPLATE,
  SLOT_BY_KEY,
  SLOT_DEFS,
  computeMissingKeys,
  fillText,
  resolveSettings,
  resolveSlotValues,
  sentenceForSlot,
  type InterventionCatalogRow,
  type ReportSettings,
  type SlotDef,
  type SlotValues,
} from '@report-template';
import type {
  CarChecklistItem,
  CarDraft,
  InterventionDraft,
} from '../../types';

export { resolveSlotValues };

export type DerivedMember = NonNullable<CarDraft['familyComposition'][number]>;

/* --------------------------------------------------------------- context */

export type SlotContext = {
  draft: CarDraft;
  settings: ReportSettings;
  /** From the household register when loaded; the grantee snapshot in
   *  `familyComposition` covers barangay/municipality when it is not. */
  household?: { barangay?: string; municipality?: string } | null;
};

export function buildSlotContext(
  draft: CarDraft,
  household?: { barangay?: string; municipality?: string } | null,
  settings?: Partial<ReportSettings> | null,
): SlotContext {
  return { draft, settings: resolveSettings(settings), household: household ?? null };
}

export function granteeRow(draft: CarDraft): DerivedMember | null {
  return draft.familyComposition.find((member) => member.id === draft.granteeMemberId) ?? null;
}

/* ------------------------------------------------------------- mutations */

export type SlotEditOptions = {
  /** Required when replacing a non-empty derived/setting value (REQ-RPT-007). */
  reason?: string;
  at?: string;
  /** Resolved (derived/computed) value currently on screen, used as `original`
   *  when nothing has been saved for this slot yet. */
  previous?: string;
};

/** Returns updated slot values for an edit. With `reason`, the previous value
 *  is kept as `original` and the change is flagged as an override. */
export function withSlotValue(
  current: SlotValues,
  def: SlotDef,
  value: string,
  options?: SlotEditOptions,
): SlotValues {
  const previous = current[def.key];
  const at = options?.at ?? new Date().toISOString();
  if (options?.reason) {
    // Keep the first original forever: re-overriding never loses it.
    const priorOriginal = previous?.overridden ? previous.original ?? null : null;
    const savedValue = previous?.value ?? '';
    const priorValue = priorOriginal ?? (savedValue.trim() ? savedValue : null);
    const original =
      priorValue ?? (options.previous?.trim() ? options.previous : null);
    return {
      ...current,
      [def.key]: {
        value,
        source: previous?.source ?? def.source,
        overridden: true,
        original,
        reason: options.reason,
        at,
      },
    };
  }
  const filled = Boolean((previous?.value ?? '').trim());
  const gapFilled = def.source === 'derived' && !filled;
  return {
    ...current,
    [def.key]: {
      value,
      source: gapFilled && value ? 'manual' : previous?.source ?? def.source,
      overridden: previous?.overridden,
      original: previous?.original ?? null,
      reason: previous?.reason,
      at,
    },
  };
}

/* ------------------------------------------------------------- checklist */

/** Checklist rows for the context panel: every required slot plus the two
 *  structural checks, in template order. Ids double as DOM jump targets. */
export function getReportChecklist(
  draft: CarDraft,
  household?: { barangay?: string; municipality?: string } | null,
  settings?: Partial<ReportSettings> | null,
): CarChecklistItem[] {
  const values = resolveSlotValues(draft, household, settings);
  const missing = new Set(
    computeMissingKeys({
      slots: values,
      familyIncluded: draft.familyComposition.filter((member) => member.include).length,
      interventions: draft.interventions,
    }),
  );
  const items: CarChecklistItem[] = SLOT_DEFS.filter((def) => def.required).map((def) => ({
    id: `slot-${def.key}`,
    label: def.label,
    complete: !missing.has(def.key),
  }));
  items.push({
    id: 'familyComposition',
    label: 'Family composition has at least one included member',
    complete: !missing.has('familyComposition'),
  });
  items.push({
    id: 'interventions',
    label: 'Intervention plan has at least one included row with a need',
    complete: !missing.has('interventions'),
  });
  return items;
}

/** Sections with counts of missing required slots, for the rail badges. */
export function missingBySection(
  draft: CarDraft,
  household?: { barangay?: string; municipality?: string } | null,
): Record<string, number> {
  const values = resolveSlotValues(draft, household);
  const counts: Record<string, number> = {};
  for (const def of SLOT_DEFS) {
    if (!def.required) continue;
    if (!(values[def.key]?.value ?? '').trim()) {
      counts[def.section] = (counts[def.section] ?? 0) + 1;
    }
  }
  return counts;
}

/* --------------------------------------------------------- source display */

/** Human description of where a slot's value comes from (popover). */
export function describeSlotSource(
  def: SlotDef,
  context: SlotContext,
  value: SlotValues[string],
): string {
  if (value?.overridden) return 'Overridden by case worker';
  switch (def.source) {
    case 'manual':
      return 'Case worker entry';
    case 'setting':
      return `Setting ${(def.from ?? '').replace(/^setting:/, '')}`;
    case 'computed': {
      const map: Record<string, string> = {
        'formula:age': 'Calculated from birthday as of the report date',
        'formula:member_count': 'Count of included family members',
        'formula:adult_count': `Count of included members aged ${context.settings['report.adult_age_threshold'] ?? '18'}+`,
        'formula:child_count': `Count of included members under ${context.settings['report.adult_age_threshold'] ?? '18'}`,
        'formula:grantee_first_name': 'Grantee name from the imported row',
        'formula:grantee_possessive': 'Grantee name from the imported row',
      };
      return map[def.from ?? ''] ?? 'Calculated';
    }
    case 'derived': {
      const from = def.from ?? '';
      const row = granteeRow(context.draft);
      if (from.startsWith('grantee.data.')) {
        const column = from.slice('grantee.data.'.length);
        return `Workbook column ${column}${row ? ` · import row ${row.sourceRow}` : ''}`;
      }
      if (from.startsWith('household.')) {
        const column =
          from === 'household.hhId'
            ? 'HH_ID'
            : from === 'household.barangay'
              ? 'BARANGAY'
              : from === 'household.municipality'
                ? 'MUNICIPALITY'
                : from;
        return `Workbook column ${column}${row ? ` · import row ${row.sourceRow}` : ''}`;
      }
      if (from.startsWith('formula:')) {
        if (from === 'formula:present_address') return 'Composed from REGION/PROVINCE/MUNICIPALITY/BARANGAY';
        if (from === 'formula:provider') return 'Suggested from Relationship to household head — confirm';
        if (from === 'grantee.last_name' || from === 'grantee.name') return 'Grantee name from the imported row';
        return 'Calculated from imported data';
      }
      return 'Imported household data';
    }
    default:
      return 'Imported data';
  }
}

/** Fills the template sentence containing `key` with `previewValue` in place
 *  of that slot — shown live under long-text editors. */
export function sentencePreview(
  key: string,
  values: SlotValues,
  previewValue: string,
): string | null {
  const sentence = sentenceForSlot(key, REPORT_TEMPLATE);
  if (!sentence) return null;
  const withPreview: SlotValues = { ...values };
  withPreview[key] = { value: previewValue };
  return fillText(sentence, withPreview);
}

/* --------------------------------------------------------- interventions */

export function interventionFromCatalog(row: InterventionCatalogRow): InterventionDraft {
  return {
    id: `intervention-${row.id}-${crypto.randomUUID().slice(0, 8)}`,
    catalogId: row.id,
    type: row.need,
    details: row.activities,
    custom: false,
    included: true,
    need: row.need,
    objective: row.objective,
    activities: row.activities,
    responsible: row.responsible,
    timeline: row.timeline,
    remarks: row.remarks,
    values: {},
  };
}

export function customIntervention(): InterventionDraft {
  return {
    id: `intervention-${crypto.randomUUID()}`,
    type: '',
    details: '',
    custom: true,
    included: true,
    need: '',
    objective: '',
    activities: '',
    responsible: '',
    timeline: '',
    remarks: '',
    values: {},
  };
}

/** The standard rows a CAR starts with (admin catalog in a later phase;
 *  the versioned default lives with the template today). */
export function defaultInterventions(): InterventionDraft[] {
  return DEFAULT_INTERVENTION_CATALOG.map(interventionFromCatalog);
}

/** Fills catalog tokens (`{{grantee_first_name}}`, per-row values) for render. */
export function fillInterventionText(
  text: string,
  values: SlotValues,
  row: InterventionDraft | undefined,
): string {
  const merged: SlotValues = { ...values };
  for (const [key, entry] of Object.entries(row?.values ?? {})) {
    merged[key] = { value: entry };
  }
  return fillText(text, merged);
}
