import type { DocumentJob, GeneratedDocumentRecord } from "./types";

function verifiedJob(
  id: string,
  format: "docx" | "pdf",
  requestedBy: string,
  requestedAt: string,
): DocumentJob {
  return {
    id,
    format,
    status: "verified",
    requestedBy,
    requestedAt,
    completedAt: "2026-10-28T10:42:00.000Z",
    attempt: 1,
    idempotencyKey: `mock-${id}`,
    fileReference: `mock-storage/${id}.${format}`,
    verificationChecks: {
      filePresent: true,
      nonZeroSize: true,
      validFormat: true,
      openedSuccessfully: true,
    },
  };
}

export const mockGeneratedDocuments: GeneratedDocumentRecord[] = [
  {
    id: "report-023",
    reference: "CAR-2026-023",
    householdLabel: "HH_ID 000091",
    revision: 2,
    carStatus: "approved",
    importVersion: "SY2026 Q1 · v3",
    templateVersion: "Annex C · v1.0",
    approvedBy: "Reviewer A (mock)",
    approvedAt: "2026-10-28T09:30:00.000Z",
    lastRequestedBy: "Case worker (mock)",
    lastRequestedAt: "2026-10-28T10:40:00.000Z",
    jobs: [
      verifiedJob("job-023-docx", "docx", "Case worker (mock)", "2026-10-28T10:40:00.000Z"),
      verifiedJob("job-023-pdf", "pdf", "Case worker (mock)", "2026-10-28T10:40:00.000Z"),
    ],
  },
  {
    id: "report-019",
    reference: "CAR-2026-019",
    householdLabel: "HH_ID 000091",
    revision: 1,
    carStatus: "approved",
    importVersion: "SY2026 Q1 · v3",
    templateVersion: "Annex C · v1.0",
    approvedBy: "Reviewer B (mock)",
    approvedAt: "2026-10-27T06:20:00.000Z",
    lastRequestedBy: "Case worker (mock)",
    lastRequestedAt: "2026-10-27T06:45:00.000Z",
    jobs: [
      verifiedJob("job-019-docx", "docx", "Case worker (mock)", "2026-10-27T06:45:00.000Z"),
      {
        id: "job-019-pdf",
        format: "pdf",
        status: "failed",
        requestedBy: "Case worker (mock)",
        requestedAt: "2026-10-27T06:45:00.000Z",
        completedAt: "2026-10-27T06:47:00.000Z",
        attempt: 1,
        idempotencyKey: "mock-report-019-rev1-pdf",
        safeErrorCode: "PDF_CONVERSION_FAILED",
      },
    ],
  },
  {
    id: "report-024",
    reference: "CAR-2026-024",
    householdLabel: "HH_ID 000091",
    revision: 1,
    carStatus: "submitted",
    importVersion: "SY2026 Q1 · v3",
    templateVersion: "Annex C · v1.0",
    jobs: [],
  },
  {
    id: "report-014",
    reference: "CAR-2026-014",
    householdLabel: "HH_ID 000083",
    revision: 1,
    carStatus: "draft",
    importVersion: "SY2026 Q1 · v3",
    templateVersion: "Annex C · v1.0",
    jobs: [],
  },
];
