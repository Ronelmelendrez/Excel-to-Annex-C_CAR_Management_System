import type { ReviewRecord } from "./types";

const passedGates = [
  {
    id: "grantee",
    label: "Validated grantee",
    passed: true,
    summary: "Exactly one supported GRANTEE=Yes flag.",
    exceptionEligible: false,
  },
  {
    id: "household",
    label: "Household conflicts",
    passed: true,
    summary: "No unresolved household or member conflicts.",
    exceptionEligible: false,
  },
  {
    id: "required-fields",
    label: "Required CAR fields",
    passed: true,
    summary: "All sample required fields are present.",
    exceptionEligible: true,
  },
  {
    id: "template",
    label: "Active template",
    passed: true,
    summary: "A sample active template version is linked.",
    exceptionEligible: false,
  },
];

export const mockReviewRecords: ReviewRecord[] = [
  {
    id: "review-car-019",
    reference: "CAR-2026-019",
    householdId: "hh-0091",
    householdLabel: "HH_ID 000091",
    revision: 1,
    importVersion: "SY2026 Q1 · v3",
    templateVersion: "Annex C · v1.0 (mock)",
    submittedById: "case-worker-01",
    submittedByLabel: "Case worker (mock)",
    submittedAt: "2026-10-28T08:30:00.000Z",
    status: "submitted",
    gates: passedGates,
  },
  {
    id: "review-car-024",
    reference: "CAR-2026-024",
    householdId: "hh-0091",
    householdLabel: "HH_ID 000091",
    revision: 2,
    importVersion: "SY2026 Q1 · v3",
    templateVersion: "Annex C · v1.0 (mock)",
    submittedById: "case-worker-02",
    submittedByLabel: "Case worker (mock)",
    submittedAt: "2026-10-29T07:15:00.000Z",
    status: "submitted",
    gates: passedGates.map((gate) =>
      gate.id === "required-fields"
        ? {
            ...gate,
            passed: false,
            summary: "Some sample fields are incomplete. An exception requires a reason.",
          }
        : gate,
    ),
  },
  {
    id: "review-car-016",
    reference: "CAR-2026-016",
    householdId: "hh-0091",
    householdLabel: "HH_ID 000091",
    revision: 1,
    importVersion: "SY2026 Q1 · v3",
    templateVersion: "Annex C · v1.0 (mock)",
    submittedById: "case-worker-03",
    submittedByLabel: "Case worker (mock)",
    submittedAt: "2026-10-26T04:20:00.000Z",
    status: "approved",
    gates: passedGates,
    decision: {
      status: "approved",
      comment: "Mock approval history.",
      actor: "Reviewer (mock)",
      at: "2026-10-27T09:00:00.000Z",
    },
  },
];
