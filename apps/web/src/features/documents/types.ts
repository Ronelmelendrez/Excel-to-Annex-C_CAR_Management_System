export type DocumentFormat = "docx" | "pdf";
export type DocumentFormatStatus = "not_generated" | "queued" | "running" | "verified" | "failed";
export type DocumentFilter = "all" | "approved" | "not_approved";

export type DocumentJob = {
  id: string;
  format: DocumentFormat;
  status: DocumentFormatStatus;
  requestedBy: string;
  requestedAt: string;
  completedAt?: string;
  attempt: number;
  idempotencyKey: string;
  safeErrorCode?: string;
  fileReference?: string;
  verificationChecks?: {
    filePresent: boolean;
    nonZeroSize: boolean;
    validFormat: boolean;
    openedSuccessfully: boolean;
  };
};

export type GeneratedDocumentRecord = {
  id: string;
  reference: string;
  householdLabel: string;
  revision: number;
  carStatus: "approved" | "submitted" | "draft";
  importVersion: string;
  templateVersion: string;
  approvedBy?: string;
  approvedAt?: string;
  lastRequestedBy?: string;
  lastRequestedAt?: string;
  jobs: DocumentJob[];
};
