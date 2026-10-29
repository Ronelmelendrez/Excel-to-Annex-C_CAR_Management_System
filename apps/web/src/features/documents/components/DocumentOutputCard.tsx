import React from "react";
import { SectionCard } from "../../../components/ui/section-card";
import { getFormatStatus } from "../lib/document-jobs";
import type { DocumentFormat, GeneratedDocumentRecord } from "../types";

const formatLabels: Record<DocumentFormat, string> = {
  docx: "DOCX",
  pdf: "PDF",
};

const statusLabels = {
  not_generated: "Not generated",
  queued: "Queued",
  running: "Running",
  verified: "Verified · mock only",
  failed: "Failed",
} as const;

function verificationLabel(passed: boolean) {
  return passed ? "Passed · mock check" : "Failed · mock check";
}

export function DocumentOutputCard({
  record,
  format,
  canGenerate,
  activeJobId,
  onGenerate,
  onRetry,
}: {
  record: GeneratedDocumentRecord;
  format: DocumentFormat;
  canGenerate: boolean;
  activeJobId: string | null;
  onGenerate: (format: DocumentFormat) => void;
  onRetry: (format: DocumentFormat) => void;
}) {
  const job = record.jobs.find((item) => item.format === format);
  const status = getFormatStatus(record, format);
  const allowed = record.carStatus === "approved" && Boolean(record.approvedBy && record.approvedAt);
  const isActive = job?.id === activeJobId;
  const isRetryable = status === "failed";

  return (
    <SectionCard
      id={`document-${format}-heading`}
      eyebrow="Independent output"
      title={formatLabels[format]}
      action={
        <span
          role="status"
          className={`border px-2 py-1 text-[10px] font-semibold ${
            status === "verified"
              ? "border-[#2f5b3a] bg-[#e6ecdf] text-[#244b2e]"
              : status === "failed"
                ? "border-[#7a1f1f] bg-[#f2e4e1] text-[#7a1f1f]"
                : status === "queued" || status === "running"
                  ? "border-[#185a8b] bg-[#e4edf4] text-[#174c75]"
                  : "border-[#8c877c] bg-[#ece7dc] text-[#5b574e]"
          }`}
        >
          {statusLabels[status]}
        </span>
      }
    >
      {!allowed ? (
        <p className="border-l-4 border-[#8a5a00] bg-[#f3ead8] px-3 py-2 text-sm leading-5 text-[#704700]">
          Generation is unavailable until this CAR revision is approved.
        </p>
      ) : (
        <>
          {job && (
            <dl className="grid gap-2 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-[#5b574e]">Job ID</dt>
                <dd className="mt-0.5 break-all font-mono">{job.id}</dd>
              </div>
              <div>
                <dt className="text-[#5b574e]">Idempotency key</dt>
                <dd className="mt-0.5 break-all font-mono">{job.idempotencyKey}</dd>
              </div>
              <div>
                <dt className="text-[#5b574e]">Attempt</dt>
                <dd className="mt-0.5 tabular-nums">{job.attempt}</dd>
              </div>
              <div>
                <dt className="text-[#5b574e]">Requested by</dt>
                <dd className="mt-0.5">{job.requestedBy}</dd>
              </div>
            </dl>
          )}

          {status === "failed" && (
            <p role="alert" className="mt-3 border-l-4 border-[#7a1f1f] bg-[#f2e4e1] px-3 py-2 text-sm leading-5 text-[#7a1f1f]">
              Safe failure code: <span className="font-mono">{job?.safeErrorCode ?? "GENERATION_FAILED"}</span>.
              No file is available. You can retry this output.
            </p>
          )}

          {status === "verified" && job?.verificationChecks && (
            <div className="mt-3 border-t border-[#e2ddd1] pt-3">
              <p className="text-xs font-semibold">Integrity checks · mock status</p>
              <ul className="mt-2 grid gap-1 text-xs text-[#244b2e] sm:grid-cols-2">
                <li>{verificationLabel(job.verificationChecks.filePresent)} · file presence</li>
                <li>{verificationLabel(job.verificationChecks.nonZeroSize)} · non-zero size</li>
                <li>{verificationLabel(job.verificationChecks.validFormat)} · format</li>
                <li>{verificationLabel(job.verificationChecks.openedSuccessfully)} · opens successfully</li>
              </ul>
              {job.completedAt && (
                <p className="mt-2 text-xs text-[#5b574e]">
                  Verified {new Date(job.completedAt).toLocaleString()} · reference{" "}
                  <span className="font-mono">{job.fileReference}</span>
                </p>
              )}
            </div>
          )}

          {(status === "queued" || status === "running") && (
            <p className="mt-3 text-sm text-[#174c75]" aria-live="polite">
              {status === "queued" ? "Waiting for the mock worker…" : "Mock worker is processing this output…"}
            </p>
          )}

          {status === "failed" && canGenerate ? (
            <button
              type="button"
              onClick={() => onRetry(format)}
              className="mt-4 min-h-[44px] border border-[#161512] px-4 py-2 text-sm font-semibold hover:bg-[#e6e0d4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7a1f1f]"
            >
              Retry {formatLabels[format]} · same idempotency key
            </button>
          ) : status === "failed" ? (
            <p className="mt-4 text-xs leading-5 text-[#5b574e]">
              Retry is restricted to authorized document-generation roles.
            </p>
          ) : status === "verified" ? (
            <p className="mt-4 text-xs leading-5 text-[#5b574e]">
              This output is already verified for this revision. Create a new CAR revision for new document content.
            </p>
          ) : status === "queued" || status === "running" ? (
            <button
              type="button"
              disabled
              title="A job for this output is already in progress."
              className="mt-4 min-h-[44px] border border-[#b5afa2] bg-[#ece7dc] px-4 py-2 text-sm font-semibold text-[#5b574e]"
            >
              {isActive ? "Generation in progress" : "Job in progress"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onGenerate(format)}
              disabled={!canGenerate || !allowed}
              title={!canGenerate ? "This role cannot generate documents." : undefined}
              className="mt-4 min-h-[44px] border border-[#161512] bg-[#161512] px-4 py-2 text-sm font-semibold text-[#f4f1ea] hover:bg-[#7a1f1f] disabled:cursor-not-allowed disabled:border-[#b5afa2] disabled:bg-[#b5afa2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
            >
              {canGenerate ? `Generate ${formatLabels[format]} · mock` : `Generate ${formatLabels[format]} · unavailable`}
            </button>
          )}
        </>
      )}

      <p className="mt-3 text-xs leading-5 text-[#5b574e]">
        {status === "verified"
          ? "This mock verification does not mean a real document exists."
          : "No real document is generated, stored, or signed by this demo."}
      </p>
    </SectionCard>
  );
}
