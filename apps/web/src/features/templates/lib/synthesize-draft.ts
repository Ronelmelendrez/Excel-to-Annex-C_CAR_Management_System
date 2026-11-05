/**
 * Builds a read-only `CarDraft` from a validated household for the Annex C
 * report generator page.
 *
 * The generator previews and downloads reports without writing to Supabase:
 * when the case worker already saved a CAR for the household we use that
 * draft (it carries slot overrides and history); otherwise the same snapshot
 * shape the server writes on CAR creation is reconstructed here from the
 * import rows — headers × `raw` for `CAR_MEMBER_FIELDS` only, raw import
 * rows never modified (REQ-RPT-007).
 */
import { CAR_MEMBER_FIELDS, REPORT_TEMPLATE_VERSION } from '@report-template';
import { defaultInterventions } from '../../cars/lib/report/values';
import type { CarDraft, FamilyCompositionMember, ValidatedHousehold } from '../../cars/types';

/** Workbook columns snapshotted onto a family row, from the member's raw
 *  import cells aligned with `household.headers` (mirrors the server's
 *  `pickMemberData`, which reads the normalized row instead). */
function snapshotMemberData(
  household: ValidatedHousehold,
  raw: (string | null)[] | undefined,
): Record<string, string> | undefined {
  if (!household.headers || !raw) return undefined;
  const data: Record<string, string> = {};
  for (const field of CAR_MEMBER_FIELDS) {
    const index = household.headers.indexOf(field);
    if (index < 0) continue;
    const cell = raw[index];
    if (cell != null && String(cell).trim() !== '') data[field] = String(cell);
  }
  return Object.keys(data).length > 0 ? data : undefined;
}

/**
 * Family rows for the report: grantee first (REQ-RPT-008), the rest in
 * import-row order, every member included by default.
 */
function familyFrom(household: ValidatedHousehold): FamilyCompositionMember[] {
  const ordered = [...household.members].sort((a, b) => a.sourceRow - b.sourceRow);
  const granteeIndex = ordered.findIndex((member) => member.id === household.grantee.id);
  const grantee = granteeIndex >= 0 ? ordered.splice(granteeIndex, 1)[0] : household.grantee;
  return [grantee, ...ordered].map((member) => {
    const data = snapshotMemberData(household, member.raw);
    return {
      id: member.id,
      entryId: member.entryId,
      name: member.name,
      relationship: member.relationship,
      age: member.age,
      sourceRow: member.sourceRow,
      include: true,
      ...(data ? { data } : {}),
    };
  });
}

/** A draft shaped exactly like the server's `createCar` content, but local
 *  and never persisted — the generator's preview/download input. */
export function synthesizeDraft(household: ValidatedHousehold): CarDraft {
  const now = new Date().toISOString();
  return {
    id: `preview-${household.id}`,
    reference: household.car?.reference ?? 'PREVIEW',
    householdId: household.id,
    granteeMemberId: household.grantee.id,
    revision: household.car ? 1 : 0,
    status: 'draft_incomplete',
    workflowStatus: 'draft',
    hhId: household.hhId,
    granteeName: household.grantee.name,
    granteeSourceRow: household.grantee.sourceRow,
    importName: household.importName,
    importVersion: household.importVersion,
    templateVersion: REPORT_TEMPLATE_VERSION,
    datePrepared: '',
    presentingProblem: '',
    backgroundInformation: '',
    assessment: '',
    interventions: defaultInterventions(),
    recommendation: '',
    familyComposition: familyFrom(household),
    slots: {},
    history: [{ id: 'preview-history', label: 'Preview generated from import data', at: now }],
    createdAt: now,
    updatedAt: now,
  };
}
