import React, { useState } from "react";
import type { ImportRecord } from "../types";
import { fetchErrorReportCsv } from "../api";
import { formatBytes, formatDateTime } from "../lib/analysis";
import { downloadText, safeFilename } from "../lib/download";
import { Notice, quietButton, secondaryButton } from "./primitives";

function StatusTag({ record }: { record: ImportRecord }) {
  const label = record.is_duplicate ? "Re-import" : record.status;
  const tone = record.is_duplicate
    ? "border-[#8a5a00] text-[#8a5a00]"
    : record.status === "committed"
      ? "border-[#2f5b3a] text-[#2f5b3a]"
      : "border-[#7a1f1f] text-[#7a1f1f]";
  return (
    <span
      className={`inline-block border px-2 py-[2px] font-mono text-[10px] uppercase tracking-[0.1em] ${tone}`}
    >
      {label}
    </span>
  );
}

function HistorySkeleton() {
  return (
    <div aria-hidden="true" className="border border-[#c9c3b6]">
      <div className="h-9 border-b border-[#c9c3b6] bg-[#ece7dc]" />
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="flex gap-6 border-b border-[#e2ddd1] px-3 py-3 last:border-b-0">
          <span className="h-3 w-32 bg-[#e6e0d4]" />
          <span className="h-3 w-20 bg-[#e6e0d4]" />
          <span className="h-3 w-24 bg-[#e6e0d4]" />
          <span className="h-3 w-16 bg-[#e6e0d4]" />
        </div>
      ))}
    </div>
  );
}

export function ImportHistory({
  items,
  total,
  loading,
  loadingMore,
  error,
  hasMore,
  onRefresh,
  onLoadMore,
}: {
  items: ImportRecord[];
  total: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  onRefresh: () => void;
  onLoadMore: () => void;
}) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleReport = async (record: ImportRecord) => {
    setDownloadingId(record.id);
    setDownloadError(null);
    try {
      const csv = await fetchErrorReportCsv(record.id);
      downloadText(
        `${safeFilename(record.file_name ?? "import")}-errors-v${record.version}.csv`,
        csv,
      );
    } catch (e: any) {
      setDownloadError(e?.message ?? "The error report could not be downloaded.");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <section aria-labelledby="history-heading" className="mt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[#161512] pb-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#5b574e]">
            Register / committed imports
          </p>
          <h2 id="history-heading" className="mt-1 font-serif text-2xl leading-tight tracking-tight">
            Import history
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-xs text-[#5b574e]">
            {loading ? "Loading…" : `${total.toLocaleString()} version${total === 1 ? "" : "s"}`}
          </p>
          <button
            type="button"
            className={quietButton}
            onClick={onRefresh}
            disabled={loading || loadingMore}
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <Notice
            tone="error"
            title="Import history is unavailable"
            actions={
              <button type="button" className={secondaryButton} onClick={onRefresh}>
                Try again
              </button>
            }
          >
            {error}
          </Notice>
        </div>
      )}

      {downloadError && (
        <div className="mt-4">
          <Notice tone="error" title="Report download failed">
            {downloadError}
          </Notice>
        </div>
      )}

      <div className="mt-4">
        {loading ? (
          <HistorySkeleton />
        ) : items.length === 0 ? (
          <div className="border border-[#c9c3b6] bg-[#f8f5ee] px-5 py-10">
            <p className="font-serif text-xl">No workbook has been committed yet.</p>
            <p className="mt-2 max-w-[60ch] text-sm leading-6 text-[#3f3b34]">
              The register is empty. Use the importer above to validate a workbook. An import appears
              here only after you commit it; previews and failed validations leave no record.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-[#c9c3b6]">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-[#ece7dc]">
                  {[
                    "Version",
                    "Workbook",
                    "Sheet",
                    "Rows",
                    "Review",
                    "Households",
                    "Committed",
                    "By",
                    "Report",
                  ].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className="whitespace-nowrap border-b border-[#c9c3b6] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[#3f3b34]"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((record) => (
                  <tr key={record.id} className="odd:bg-[#f8f5ee]">
                    <td className="whitespace-nowrap border-b border-[#e2ddd1] px-3 py-3 align-top">
                      <StatusTag record={record} />
                      <p className="mt-1 font-mono text-[10px] text-[#5b574e]">
                        v{record.version} · {record.file_size ? formatBytes(record.file_size) : "—"}
                      </p>
                    </td>
                    <td className="max-w-[240px] border-b border-[#e2ddd1] px-3 py-3 align-top">
                      <p className="truncate font-mono text-xs" title={record.file_name ?? undefined}>
                        {record.file_name ?? "—"}
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-[#5b574e]" title={record.file_hash}>
                        {record.file_hash.slice(0, 12)}…
                      </p>
                    </td>
                    <td className="border-b border-[#e2ddd1] px-3 py-3 align-top text-xs">
                      {record.sheet_name}
                    </td>
                    <td className="border-b border-[#e2ddd1] px-3 py-3 align-top font-mono text-xs tabular-nums">
                      {record.row_count.toLocaleString()}
                    </td>
                    <td className="border-b border-[#e2ddd1] px-3 py-3 align-top font-mono text-xs tabular-nums">
                      <span className={record.error_row_count > 0 ? "text-[#7a1f1f]" : ""}>
                        {record.error_row_count.toLocaleString()}
                      </span>
                    </td>
                    <td className="border-b border-[#e2ddd1] px-3 py-3 align-top font-mono text-xs tabular-nums">
                      {record.household_count.toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap border-b border-[#e2ddd1] px-3 py-3 align-top text-xs">
                      {formatDateTime(record.committed_at ?? record.created_at)}
                    </td>
                    <td className="border-b border-[#e2ddd1] px-3 py-3 align-top text-xs">
                      {record.uploaded_by_name ?? "—"}
                    </td>
                    <td className="border-b border-[#e2ddd1] px-3 py-3 align-top">
                      {record.error_row_count > 0 ? (
                        <button
                          type="button"
                          className={`${quietButton} whitespace-nowrap text-xs`}
                          onClick={() => void handleReport(record)}
                          disabled={downloadingId === record.id}
                        >
                          {downloadingId === record.id ? "Preparing…" : "Download"}
                        </button>
                      ) : (
                        <span className="text-xs text-[#5b574e]">None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && hasMore && (
        <div className="mt-4">
          <button
            type="button"
            className={secondaryButton}
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading older versions…" : "Load older versions"}
          </button>
        </div>
      )}
    </section>
  );
}
