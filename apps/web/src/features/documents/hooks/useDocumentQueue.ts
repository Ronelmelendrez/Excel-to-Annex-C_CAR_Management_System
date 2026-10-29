import { useMemo, useState } from "react";
import { mockGeneratedDocuments } from "../mock-data";
import {
  canGenerateDocument,
  createDocumentJob,
  filterDocumentRecords,
  getFormatStatus,
} from "../lib/document-jobs";
import type { DocumentFilter, DocumentFormat, GeneratedDocumentRecord } from "../types";

const initialSelectedId = mockGeneratedDocuments[0]?.id ?? null;

export function useDocumentQueue(actor: string) {
  const [records, setRecords] = useState(mockGeneratedDocuments);
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<DocumentFilter>("all");
  const [feedback, setFeedback] = useState("");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const visibleRecords = useMemo(
    () => filterDocumentRecords(records, search, filter),
    [records, search, filter],
  );
  const selectedRecord =
    visibleRecords.find((record) => record.id === selectedId) ??
    visibleRecords[0] ??
    null;

  function selectRecord(id: string) {
    setSelectedId(id);
    setFeedback("");
  }

  function startGeneration(format: DocumentFormat) {
    if (!selectedRecord || !canGenerateDocument(selectedRecord)) {
      setFeedback("Generation is available only for an approved CAR revision.");
      return;
    }

    const existing = selectedRecord.jobs.find((job) => job.format === format);
    if (existing?.status === "queued" || existing?.status === "running") {
      setFeedback(
        `${format.toUpperCase()} generation is already ${existing.status}. This mock request was not duplicated.`,
      );
      return;
    }
    if (existing?.status === "verified") {
      setFeedback(
        `${format.toUpperCase()} output for this approved revision is already verified. The mock request was not duplicated.`,
      );
      return;
    }

    const now = new Date().toISOString();
    const job = createDocumentJob(selectedRecord, format, actor, now);
    setActiveJobId(job.id);
    setFeedback(
      `${format.toUpperCase()} generation queued for ${selectedRecord.reference} revision ${selectedRecord.revision} (attempt ${job.attempt}).`,
    );
    setRecords((current) =>
      current.map((record) =>
        record.id === selectedRecord.id
          ? {
              ...record,
              lastRequestedBy: actor,
              lastRequestedAt: now,
              jobs: [
                ...record.jobs.filter((existingJob) => existingJob.format !== format),
                job,
              ],
            }
          : record,
      ),
    );

    window.setTimeout(() => {
      setRecords((current) =>
        current.map((record) =>
          record.id !== selectedRecord.id
            ? record
            : {
                ...record,
                jobs: record.jobs.map((currentJob) =>
                  currentJob.id === job.id
                    ? {
                        ...currentJob,
                        status: "running",
                      }
                    : currentJob,
                ),
              },
        ),
      );
    }, 350);

    window.setTimeout(() => {
      const shouldFail =
        selectedRecord.reference === "CAR-2026-019" &&
        format === "pdf" &&
        job.attempt === 1;
      const completedAt = new Date().toISOString();
      setRecords((current) =>
        current.map((record) =>
          record.id !== selectedRecord.id
            ? record
            : {
                ...record,
                jobs: record.jobs.map((currentJob) =>
                  currentJob.id === job.id
                    ? {
                        ...currentJob,
                        status: shouldFail ? "failed" : "verified",
                        completedAt,
                        ...(shouldFail
                          ? { safeErrorCode: "PDF_CONVERSION_FAILED" }
                          : {
                              fileReference: `mock-storage/${record.reference.toLowerCase()}-r${record.revision}.${format}`,
                              verificationChecks: {
                                filePresent: true,
                                nonZeroSize: true,
                                validFormat: true,
                                openedSuccessfully: true,
                              },
                            }),
                      }
                    : currentJob,
                ),
              },
        ),
      );
      setFeedback(
        shouldFail
          ? `PDF job failed with safe code PDF_CONVERSION_FAILED. Retry is available using the same idempotency key.`
          : `${format.toUpperCase()} mock output passed all integrity checks. No file was created or stored.`,
      );
      setActiveJobId(null);
    }, 900);
  }

  function retryGeneration(format: DocumentFormat) {
    const status = selectedRecord ? getFormatStatus(selectedRecord, format) : "not_generated";
    if (status !== "failed") {
      setFeedback("Only failed document jobs can be retried.");
      return;
    }
    startGeneration(format);
  }

  return {
    records,
    visibleRecords,
    selectedRecord,
    search,
    filter,
    feedback,
    activeJobId,
    setSearch,
    setFilter,
    selectRecord,
    startGeneration,
    retryGeneration,
  };
}
