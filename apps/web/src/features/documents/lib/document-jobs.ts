import type {
  DocumentFormat,
  DocumentFormatStatus,
  DocumentJob,
  GeneratedDocumentRecord,
} from "../types";

export function getFormatStatus(
  record: GeneratedDocumentRecord,
  format: DocumentFormat,
): DocumentFormatStatus {
  return record.jobs.find((job) => job.format === format)?.status ?? "not_generated";
}

export function canGenerateDocument(record: GeneratedDocumentRecord): boolean {
  return (
    record.carStatus === "approved" &&
    Boolean(record.approvedBy && record.approvedAt && record.templateVersion)
  );
}

export function createDocumentJob(
  record: GeneratedDocumentRecord,
  format: DocumentFormat,
  actor: string,
  now: string,
): DocumentJob {
  const previous = record.jobs.find((job) => job.format === format);
  const idempotencyKey =
    previous?.idempotencyKey ?? `${record.id}-revision-${record.revision}-${format}`;
  return {
    id: previous?.id ?? `mock-${idempotencyKey}`,
    format,
    status: "queued",
    requestedBy: actor,
    requestedAt: now,
    attempt: (previous?.attempt ?? 0) + 1,
    idempotencyKey,
  };
}

export function getVerifiedOutputCount(record: GeneratedDocumentRecord): number {
  return record.jobs.filter((job) => job.status === "verified").length;
}

export function filterDocumentRecords(
  records: GeneratedDocumentRecord[],
  search: string,
  filter: "all" | "approved" | "not_approved",
): GeneratedDocumentRecord[] {
  const query = search.trim().toLocaleLowerCase();
  return records.filter((record) => {
    const matchesSearch =
      !query ||
      record.reference.toLocaleLowerCase().includes(query) ||
      record.householdLabel.toLocaleLowerCase().includes(query);
    const matchesFilter =
      filter === "all" ||
      (filter === "approved" && record.carStatus === "approved") ||
      (filter === "not_approved" && record.carStatus !== "approved");
    return matchesSearch && matchesFilter;
  });
}
