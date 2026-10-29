import React from "react";
import { useAuth } from "../../../app/providers";
import { useDocumentQueue } from "../hooks/useDocumentQueue";
import { DocumentDetail } from "./DocumentDetail";
import { DocumentFilters } from "./DocumentFilters";
import { DocumentList } from "./DocumentList";

export function DocumentsPage() {
  const { profile, user, roles } = useAuth();
  const actor = profile?.display_name || user?.email || "Signed-in staff";
  const documents = useDocumentQueue(actor);
  const canView = roles.some((role) =>
    ["admin", "case_worker", "reviewer", "auditor"].includes(role),
  );
  const canGenerate = roles.some((role) => ["admin", "case_worker", "reviewer"].includes(role));

  if (!canView) {
    return (
      <div
        role="alert"
        className="max-w-[680px] border-l-4 border-[#7a1f1f] border-y border-r border-[#7a1f1f] bg-[#f2e4e1] px-4 py-4"
      >
        <h1 className="font-serif text-2xl">You do not have access to generated documents</h1>
        <p className="mt-2 text-sm leading-6 text-[#3f3b34]">
          No report or export details are shown for this account.
        </p>
      </div>
    );
  }

  return (
    <div>
      <header className="border-b border-[#161512] pb-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#5b574e]">
          F8 / Document generation &amp; downloads
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl leading-none tracking-tight sm:text-5xl">
              Generated documents
            </h1>
            <p className="mt-3 max-w-[62ch] text-sm leading-6 text-[#3f3b34]">
              Track DOCX and PDF jobs independently, inspect report provenance, and review safe job statuses.
            </p>
          </div>
          <span className="border border-[#8a5a00] bg-[#f3ead8] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#704700]">
            Mock jobs · no files or signed links
          </span>
        </div>
      </header>

      <DocumentFilters
        search={documents.search}
        filter={documents.filter}
        recordsCount={documents.visibleRecords.length}
        onSearchChange={documents.setSearch}
        onFilterChange={documents.setFilter}
      />

      {documents.feedback && (
        <p
          role="status"
          aria-live="polite"
          className="mt-4 border-l-4 border-[#2f5b3a] bg-[#e6ecdf] px-4 py-3 text-sm leading-6 text-[#244b2e]"
        >
          {documents.feedback}
        </p>
      )}

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(260px,0.78fr)_minmax(0,1.55fr)]">
        <DocumentList
          records={documents.visibleRecords}
          selectedId={documents.selectedRecord?.id ?? null}
          onSelect={documents.selectRecord}
        />
        <div className="min-w-0 space-y-4">
          <DocumentDetail
            record={documents.selectedRecord}
            canGenerate={canGenerate}
            activeJobId={documents.activeJobId}
            onGenerate={documents.startGeneration}
            onRetry={documents.retryGeneration}
          />
          {!canGenerate && (
            <p className="border-l-4 border-[#8c877c] bg-[#ece7dc] px-4 py-3 text-sm leading-5 text-[#5b574e]">
              This is a read-only view. Your role cannot generate or retry document jobs.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
