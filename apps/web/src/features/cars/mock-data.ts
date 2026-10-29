import { mockHouseholds } from "../households/mock-data";
import { normalizeGrantee } from "@import-domain";
import type { CarDraft, ValidatedHousehold } from "./types";

export const mockValidatedHouseholds: ValidatedHousehold[] = mockHouseholds.flatMap((household) => {
  const parsed = household.members.map((member) => ({
    member,
    raw: member.granteeFlag.trim(),
    value: normalizeGrantee(member.granteeFlag),
  }));
  const grantees = parsed.filter((record) => record.value === true);
  const hasInvalidOrBlankFlag = parsed.some((record) => record.raw === "" || record.value === null);
  if (grantees.length !== 1 || hasInvalidOrBlankFlag) return [];
  return [{ ...household, grantee: grantees[0].member }];
});

export const mockTemplateVersions = [
  { id: "annex-c-v1", label: "Sample Annex C template · v1.0 (mock, approval unverified)" },
];

export const mockInitialCarDrafts: CarDraft[] = [
  {
    id: "car-draft-023",
    reference: "CAR-2026-023",
    householdId: "hh-0091",
    granteeMemberId: "m-091-2",
    revision: 1,
    status: "draft_incomplete",
    templateVersion: "",
    datePrepared: "",
    presentingProblem: "",
    backgroundInformation: "",
    assessment: "",
    interventions: [{ id: "intervention-1", type: "", details: "" }],
    recommendation: "",
    familyComposition: mockValidatedHouseholds
      .find((household) => household.id === "hh-0091")
      ?.members.map((member) => ({
        id: member.id,
        entryId: member.entryId,
        name: member.name,
        age: member.age,
        relationship: member.relationship,
        sourceRow: member.sourceRow,
        include: true,
      })) ?? [],
    createdAt: "2026-10-28T08:30:00.000Z",
    updatedAt: "2026-10-28T08:30:00.000Z",
  },
];
