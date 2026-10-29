import React from "react";
import { SectionCard } from "../../../components/ui/section-card";
import type { DocumentFormat, GeneratedDocumentRecord } from "../types";
import { DocumentJobHistory } from "./DocumentJobHistory";
import { DocumentOutputCard } from "./DocumentOutputCard";
import { DocumentProvenance } from "./DocumentProvenance";

export function DocumentDetail({
  record,
  canGenerate,
  activeJobId,
  onGenerate,
  onRetry,
}: {
  record: GeneratedDocumentRecord | null;
  canGenerate: boolean;
  activeJobId: string | null;
  onGenerate: (format: DocumentFormat) => void;
  onRetry: (format: DocumentFormat) => void;
}) {
  if (!record) {
    return (
      <SectionCard id="document-detail-heading" title="Select a report">
        <p className="text-sm leading-6 text-[#5b574e]">
          Choose a CAR revision to inspect its approval, template, import, and export-job details.
        </p>
      </SectionCard>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      <DocumentProvenance record={record} />
      {record.carStatus !== "approved" && (
        <p role="status" className="border-l-4 border-[#8a5a00] bg-[#f3ead8] px-4 py-3 text-sm leading-6 text-[#704700]">
          This CAR revision is {record.carStatus}. Only manually approved revisions can generate final documents.
        </p>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        <DocumentOutputCard
          record={record}
          format="docx"
          canGenerate={canGenerate}
          activeJobId={activeJobId}
          onGenerate={onGenerate}
          onRetry={onRetry}
        />
        <DocumentOutputCard
          record={record}
          format="pdf"
          canGenerate={canGenerate}
          activeJobId={activeJobId}
          onGenerate={onGenerate}
          onRetry={onRetry}
        />
      </div>
      <SectionCard
        id="document-download-heading"
        title="Downloads"
        description="Production downloads require an authorized server-issued, short-lived signed URL."
      >
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled
            title="Signed download links are not connected in this mock UI."
            className="min-h-[44px] border border-[#b5afa2] bg-[#ece7dc] px-4 py-2 text-sm font-medium text-[#5b574e]"
          >
            Download DOCX · unavailable
          </button>
          <button
            type="button"
            disabled
            title="Signed download links are not connected in this mock UI."
            className="min-h-[44px] border border-[#b5afa2] bg-[#ece7dc] px-4 py-2 text-sm font-medium text-[#5b574e]"
          >
            Download PDF · unavailable
          </button>
        </div>
        <p className="mt-3 text-xs leading-5 text-[#5b574e]">
          Verified mock output statuses do not indicate that a file exists. No signed URL or public file link is provided.
        </p>
      </SectionCard>
      <DocumentJobHistory record={record} />
    </div>
  );
}
