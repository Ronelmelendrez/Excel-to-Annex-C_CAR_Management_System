import React, { useMemo, useRef, useState } from "react";
import {
  CANONICAL_FIELDS,
  DEFAULT_REQUIRED_COLUMNS,
  FIELD_LABELS,
  type CanonicalField,
} from "@import-domain";
import type { ImportWizard as ImportWizardState } from "../hooks/useImportWizard";
import { fetchErrorReportCsv } from "../api";
import { formatBytes, formatDateTime, issuesCsvFromPreview } from "../lib/analysis";
import { downloadText, safeFilename } from "../lib/download";
import { IMPORT_MAX_MB, IMPORT_MAX_ROWS } from "../lib/import-limits";
import { FieldLabel, Notice, Stat, primaryButton, quietButton, secondaryButton } from "./primitives";

const REQUIRED = new Set<CanonicalField>(DEFAULT_REQUIRED_COLUMNS);

const STEPS = [
  { key: "choose", label: "Choose" },
  { key: "shape", label: "Shape" },
  { key: "preview", label: "Validate" },
  { key: "committed", label: "Commit" },
] as const;

const GRANTEE_STATUS_LABEL: Record<string, string> = {
  valid: "Exactly one valid Yes",
  none: "No Yes flag",
  multiple: "More than one Yes",
  invalid: "Invalid or unrecognized flag",
  blank: "Blank flag",
};

function StepRail({ stage }: { stage: ImportWizardState["stage"] }) {
  const activeIndex = STEPS.findIndex((step) => step.key === stage);
  return (
    <ol className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b border-[#c9c3b6] pb-3">
      {STEPS.map((step, index) => {
        const done = index < activeIndex || stage === "committed";
        const active = index === activeIndex && stage !== "committed";
        return (
          <li key={step.key} className="flex items-baseline gap-2">
            <span
              className={`font-mono text-[10px] tabular-nums ${
                active ? "text-[#7a1f1f]" : "text-[#5b574e]"
              }`}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <span
              aria-current={active ? "step" : undefined}
              className={`text-xs uppercase tracking-[0.12em] ${
                active
                  ? "font-semibold text-[#161512] underline decoration-2 underline-offset-4"
                  : done
                    ? "text-[#3f3b34]"
                    : "text-[#6f6a5f]"
              }`}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ChoosePanel({ wizard }: { wizard: ImportWizardState }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div>
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) void wizard.chooseFile(file);
          }}
          className={`border-2 border-dashed p-8 sm:p-10 ${
            dragging ? "border-[#7a1f1f] bg-[#f2e4e1]" : "border-[#8c877c] bg-[#f8f5ee]"
          }`}
          aria-busy={wizard.busy === "reading"}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#5b574e]">
            Step 01 / source workbook
          </p>
          <h2 className="mt-3 font-serif text-3xl leading-tight tracking-tight">
            Drop a workbook here, or pick one from disk.
          </h2>
          <p className="mt-3 max-w-[48ch] text-sm leading-6 text-[#3f3b34]">
            The browser reads sheet names and headers for the preview. The file is not uploaded until
            you run validation, and nothing is written until you press Commit.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={wizard.busy === "reading"}
              className={primaryButton}
            >
              {wizard.busy === "reading" ? "Reading workbook…" : "Select workbook"}
            </button>
            {wizard.busy === "reading" && (
              <button type="button" onClick={wizard.cancelRead} className={secondaryButton}>
                Cancel
              </button>
            )}
            <span className="text-xs text-[#5b574e]">.xlsx or .xls, up to {IMPORT_MAX_MB} MB</span>
          </div>
          <input
            ref={inputRef}
            id="workbook-file"
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="sr-only"
            aria-describedby="workbook-help"
            disabled={wizard.busy === "reading"}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void wizard.chooseFile(file);
              event.target.value = "";
            }}
          />
          <p id="workbook-help" className="sr-only">
            Choose an Excel workbook. Only the first sheet is inspected until you choose another.
          </p>
        </div>
      </div>

      <aside className="border-t border-[#161512] pt-4">
        <h3 className="text-sm font-semibold">What happens next</h3>
        <ol className="mt-3 space-y-3 text-sm leading-6 text-[#3f3b34]">
          <li>
            <span className="font-mono text-xs text-[#7a1f1f]">01</span> Pick the worksheet and the
            row that holds the headers.
          </li>
          <li>
            <span className="font-mono text-xs text-[#7a1f1f]">02</span> Confirm the column map.
            Required targets must be explicit; nothing is guessed.
          </li>
          <li>
            <span className="font-mono text-xs text-[#7a1f1f]">03</span> The server re-reads the
            workbook, validates every row, and previews row-level issues.
          </li>
          <li>
            <span className="font-mono text-xs text-[#7a1f1f]">04</span> Commit one immutable
            version. A duplicate fingerprint needs a second, explicit confirmation.
          </li>
        </ol>
        <dl className="mt-6 space-y-3 border-t border-[#c9c3b6] pt-4 text-xs leading-5">
          <div>
            <dt className="font-semibold">Required columns by default</dt>
            <dd className="mt-1 font-mono text-[11px] text-[#3f3b34]">
              HH_ID · ENTRY_ID · FIRST_NAME · LAST_NAME · GRANTEE
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Limit</dt>
            <dd className="mt-1 text-[#5b574e]">
              {IMPORT_MAX_ROWS.toLocaleString()} data rows per sheet. Split larger files.
            </dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}

function SourcePreviewTable({
  headers,
  rows,
  limit = 3,
}: {
  headers: string[];
  rows: unknown[][];
  limit?: number;
}) {
  const visible = rows.slice(0, limit);
  if (!headers.length) {
    return <p className="text-sm text-[#5b574e]">The selected header row has no labels.</p>;
  }
  return (
    <div className="overflow-x-auto border border-[#c9c3b6]">
      <table className="min-w-full border-collapse text-left text-xs">
        <thead>
          <tr className="bg-[#ece7dc]">
            {headers.map((header, index) => (
              <th
                key={`${header}-${index}`}
                scope="col"
                className="whitespace-nowrap border-b border-[#c9c3b6] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[#3f3b34]"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-3 py-4 text-[#5b574e]">
                No rows below this header.
              </td>
            </tr>
          ) : (
            visible.map((row, rowIndex) => (
              <tr key={rowIndex} className="odd:bg-[#f8f5ee]">
                {headers.map((_, columnIndex) => (
                  <td
                    key={columnIndex}
                    className="max-w-[220px] truncate whitespace-nowrap border-b border-[#e2ddd1] px-3 py-2 text-[#3f3b34]"
                    title={String(row[columnIndex] ?? "")}
                  >
                    {String(row[columnIndex] ?? "—")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function MappingTable({ wizard }: { wizard: ImportWizardState }) {
  const sheet = wizard.sheet;
  if (!sheet) return null;
  const firstValues = sheet.mapping.map((entry) => {
    for (const row of sheet.sampleRows) {
      const value = row[entry.index];
      if (value !== null && value !== undefined && String(value).trim() !== "") return String(value);
    }
    return "—";
  });

  return (
    <div className="overflow-x-auto border border-[#c9c3b6]">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead>
          <tr className="bg-[#ece7dc]">
            <th scope="col" className="w-10 border-b border-[#c9c3b6] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em]">
              #
            </th>
            <th scope="col" className="border-b border-[#c9c3b6] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em]">
              Source header
            </th>
            <th scope="col" className="border-b border-[#c9c3b6] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em]">
              First value
            </th>
            <th scope="col" className="min-w-[220px] border-b border-[#c9c3b6] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em]">
              Annex C target
            </th>
          </tr>
        </thead>
        <tbody>
          {sheet.mapping.map((entry, index) => (
            <tr key={entry.index} className="odd:bg-[#f8f5ee]">
              <td className="border-b border-[#e2ddd1] px-3 py-2 font-mono text-xs text-[#5b574e]">
                {String(entry.index + 1).padStart(2, "0")}
              </td>
              <td className="border-b border-[#e2ddd1] px-3 py-2 font-mono text-xs">
                {entry.header}
              </td>
              <td
                className="max-w-[180px] truncate border-b border-[#e2ddd1] px-3 py-2 text-xs text-[#5b574e]"
                title={firstValues[index]}
              >
                {firstValues[index] ?? "—"}
              </td>
              <td className="border-b border-[#e2ddd1] px-3 py-2">
                <label className="sr-only" htmlFor={`mapping-${entry.index}`}>
                  Target field for {entry.header}
                </label>
                <select
                  id={`mapping-${entry.index}`}
                  value={entry.field ?? ""}
                  disabled={wizard.busy !== null}
                  onChange={(event) =>
                    wizard.setMappingField(
                      entry.index,
                      (event.target.value || null) as CanonicalField | null,
                    )
                  }
                  className="w-full border border-[#8c877c] bg-[#f8f5ee] px-2 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
                >
                  <option value="">Ignore this column</option>
                  {CANONICAL_FIELDS.map((field) => (
                    <option key={field} value={field}>
                      {FIELD_LABELS[field]}
                      {REQUIRED.has(field) ? " *" : ""}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ShapePanel({ wizard }: { wizard: ImportWizardState }) {
  const sheet = wizard.sheet;
  const bundle = wizard.bundle;
  if (!sheet || !bundle) return null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-[#161512] pt-3">
        <div>
          <p className="font-mono text-sm break-all">{bundle.file.name}</p>
          <p className="mt-1 text-xs text-[#5b574e]">
            {formatBytes(bundle.size)} · SHA-256{" "}
            <span className="font-mono" title={bundle.fileHash}>
              {bundle.fileHash.slice(0, 16)}…
            </span>
          </p>
        </div>
        <button type="button" className={quietButton} disabled={wizard.busy !== null} onClick={wizard.reset}>
          Replace file
        </button>
      </div>

      {sheet && bundle.unavailableSheetNames.includes(sheet.sheetName) && (
        <Notice tone="error" title="Import blocked: worksheet data is unavailable">
          The worksheet "{sheet.sheetName}" had no readable data. Open the workbook in Excel, use
          Move or Copy to copy that sheet into a new workbook, save it as .xlsx, and upload that
          copy.
        </Notice>
      )}

      {sheet && !bundle.unavailableSheetNames.includes(sheet.sheetName) &&
        bundle.unavailableSheetNames.length > 0 && (
          <Notice tone="warning" title="Some worksheets could not be read">
            {bundle.unavailableSheetNames.map((name) => (
              <p key={name}>
                <span className="font-mono">{name}</span>
                {bundle.sheetReadErrors?.[name]
                  ? ` — ${bundle.sheetReadErrors[name]}`
                  : " could not be read from this file, so it cannot be imported."}
              </p>
            ))}
            <p className="mt-1">
              If you need their data, open the workbook in Excel, use Move or Copy to put that
              sheet into a new workbook, save it as .xlsx, and import that copy. Other worksheets
              are unaffected.
            </p>
          </Notice>
        )}

      {sheet?.readError && (
        <Notice tone="warning" title={`"${sheet.sheetName}" cannot be read`}>
          {sheet.readError} The other worksheets in this workbook are unaffected.
        </Notice>
      )}

      {sheet &&
        sheet.dataRowCount === 0 &&
        !sheet.readError &&
        !bundle.unavailableSheetNames.includes(sheet.sheetName) && (
          <Notice tone="warning" title="This worksheet has no data rows">
            {bundle.sheetNames.length > 1
              ? `Nothing can be imported from "${sheet.sheetName}". Choose the worksheet that holds the household rows in the Worksheet dropdown below — it is usually the sheet with the HH_ID and ENTRY_ID columns.`
              : "This worksheet has no rows below its header, so there is nothing to import. The workbook appears to have no importable table."}
          </Notice>
        )}

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="sheet-name" hint="Worksheets with readable data are listed here.">
            Worksheet
          </FieldLabel>
          <select
            id="sheet-name"
            value={sheet.sheetName}
            disabled={wizard.busy !== null}
            onChange={(event) => wizard.selectSheet(event.target.value)}
            className="min-h-[44px] w-full border border-[#8c877c] bg-[#f8f5ee] px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
          >
            {bundle.sheetNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            {bundle.unavailableSheetNames.map((name) => (
              <option
                key={name}
                value={name}
                disabled
                title={bundle.sheetReadErrors?.[name] ?? "This worksheet could not be read."}
              >
                {name} (no readable data)
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel
            htmlFor="header-row"
            hint={
              sheet.detectedHeaderRow >= 0
                ? `Detected header on row ${sheet.detectedHeaderRow + 1}. Adjust if a title row sits above it.`
                : "No confident header was found. Row 1 is assumed; change it if needed."
            }
          >
            Header row (1-based)
          </FieldLabel>
          <input
            id="header-row"
            type="number"
            min={1}
            step={1}
            value={sheet.headerRow + 1}
            disabled={wizard.busy !== null}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (Number.isFinite(next)) wizard.setHeaderRow(Math.max(0, Math.floor(next) - 1));
            }}
            className="min-h-[44px] w-full border border-[#8c877c] bg-[#f8f5ee] px-3 py-2 text-sm tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
          />
        </div>
      </div>

      <section aria-labelledby="source-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="source-heading" className="font-serif text-xl">
            Source head
          </h3>
          <p className="text-xs text-[#5b574e]">
            {sheet.rowCount.toLocaleString()} non-blank data row{sheet.rowCount === 1 ? "" : "s"} below
            the header
          </p>
        </div>
        <div className="mt-3">
          <SourcePreviewTable headers={sheet.headers} rows={sheet.sampleRows} />
        </div>
      </section>

      <section aria-labelledby="mapping-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="mapping-heading" className="font-serif text-xl">
            Column map
          </h3>
          <p className="text-xs text-[#5b574e]">
            {wizard.coverage.mappedCount} of {wizard.coverage.totalCount} columns mapped
          </p>
        </div>
        <p className="mt-1 max-w-[70ch] text-sm leading-6 text-[#5b574e]">
          Required targets are marked with an asterisk. Choosing a target already used elsewhere
          clears the earlier assignment so one field never receives two columns.
        </p>
        <div className="mt-3">
          <MappingTable wizard={wizard} />
        </div>

        {wizard.coverage.missing.length > 0 && (
          <div className="mt-3">
            <Notice tone="warning" title="Required targets are still unmapped">
              {wizard.coverage.missing.map((field) => FIELD_LABELS[field] ?? field).join(", ")}
            </Notice>
          </div>
        )}
      </section>

      {sheet.dataRowCount > 0 && (
        <section aria-labelledby="batch-processing-heading" className="border-t border-[#c9c3b6] pt-5">
          <h3 id="batch-processing-heading" className="font-serif text-xl">
            Process worksheet batches
          </h3>
          <p className="mt-2 max-w-[72ch] text-sm leading-6 text-[#5b574e]">
            The worker checks up to 20,000 worksheet rows at a time. Saved batch summaries and
            checkpoints are kept in this browser; final cross-batch validation still runs on the
            server before any records are committed.
          </p>
          {wizard.batchProgress && (
            <p role="status" aria-live="polite" className="mt-3 font-mono text-xs text-[#5b574e]">
              {wizard.batchProgress.completedBatches.toLocaleString()} of{" "}
              {wizard.batchProgress.totalBatches.toLocaleString()} batches saved ·{" "}
              {wizard.batchProgress.validRows.toLocaleString()} valid ·{" "}
              {wizard.batchProgress.invalidRows.toLocaleString()} flagged
              {wizard.batchProgress.failedBatchIndex !== null
                ? ` · batch ${wizard.batchProgress.failedBatchIndex + 1} needs retry`
                : ""}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button
              type="button"
              className={primaryButton}
              onClick={() => void wizard.processRows()}
              disabled={
                wizard.busy !== null ||
                (sheet && bundle.unavailableSheetNames.includes(sheet.sheetName)) ||
                wizard.coverage.missing.length > 0 ||
                (wizard.batchProgress !== null &&
                  wizard.batchProgress.failedBatchIndex === null &&
                  wizard.batchProgress.completedBatches >= wizard.batchProgress.totalBatches)
              }
            >
              {wizard.busy === "processing"
                ? "Processing batches…"
                : wizard.batchProgress?.failedBatchIndex !== null &&
                    wizard.batchProgress?.failedBatchIndex !== undefined
                  ? "Retry batch"
                  : (wizard.batchProgress?.completedBatches ?? 0) > 0
                    ? "Resume processing"
                    : "Process rows"}
            </button>
            {wizard.busy === "processing" && wizard.activeSessionId !== null && (
              <button
                type="button"
                className={secondaryButton}
                onClick={() => void wizard.pauseProcessing()}
              >
                Pause after this batch
              </button>
            )}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-4 border-t border-[#c9c3b6] pt-5">
        <button
          type="button"
          className={primaryButton}
          onClick={() => void wizard.validate()}
          disabled={wizard.busy !== null || wizard.coverage.missing.length > 0}
        >
          {wizard.busy === "validating" ? "Validating workbook…" : "Validate workbook"}
        </button>
        <p className="max-w-[52ch] text-xs leading-5 text-[#5b574e]">
          This uploads the workbook to private storage and re-runs every rule on the server. A failed
          validation writes no import rows.
        </p>
      </div>
    </div>
  );
}

function IssueTable({ wizard }: { wizard: ImportWizardState }) {
  const preview = wizard.preview;
  if (!preview) return null;
  if (!preview.issues.length) {
    return (
      <p className="border-t border-[#2f5b3a] pt-3 text-sm text-[#2f5b3a]">
        No row-level issues were found.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto border border-[#c9c3b6]">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead>
          <tr className="bg-[#ece7dc]">
            <th scope="col" className="border-b border-[#c9c3b6] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em]">
              Row
            </th>
            <th scope="col" className="border-b border-[#c9c3b6] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em]">
              Field
            </th>
            <th scope="col" className="border-b border-[#c9c3b6] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em]">
              Issue
            </th>
            <th scope="col" className="min-w-[260px] border-b border-[#c9c3b6] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em]">
              What to do
            </th>
          </tr>
        </thead>
        <tbody>
          {preview.issues.map((issue, index) => (
            <tr key={`${issue.source_row_no}-${issue.field}-${issue.code}-${index}`} className="odd:bg-[#f8f5ee]">
              <td className="border-b border-[#e2ddd1] px-3 py-2 font-mono text-xs tabular-nums">
                {issue.source_row_no}
              </td>
              <td className="border-b border-[#e2ddd1] px-3 py-2 font-mono text-xs">{issue.field}</td>
              <td className="border-b border-[#e2ddd1] px-3 py-2 text-xs">
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#7a1f1f]">
                  {issue.code}
                </span>
                <span className="mt-1 block text-[#3f3b34]">{issue.message}</span>
              </td>
              <td className="border-b border-[#e2ddd1] px-3 py-2 text-xs leading-5 text-[#5b574e]">
                {issue.guidance}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowPreviewTable({ wizard }: { wizard: ImportWizardState }) {
  const preview = wizard.preview;
  if (!preview) return null;
  const rows = preview.rows.slice(0, 25);
  if (!rows.length) return null;

  return (
    <div className="overflow-x-auto border border-[#c9c3b6]">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead>
          <tr className="bg-[#ece7dc]">
            {["Row", "HH_ID", "ENTRY_ID", "Member", "GRANTEE", "Status"].map((label) => (
              <th
                key={label}
                scope="col"
                className="border-b border-[#c9c3b6] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em]"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const name = [row.normalized.FIRST_NAME, row.normalized.MIDDLE_NAME, row.normalized.LAST_NAME, row.normalized.EXT_NAME]
              .filter(Boolean)
              .join(" ");
            return (
              <tr key={row.source_row_no} className="odd:bg-[#f8f5ee]">
                <td className="border-b border-[#e2ddd1] px-3 py-2 font-mono text-xs tabular-nums">
                  {row.source_row_no}
                </td>
                <td className="border-b border-[#e2ddd1] px-3 py-2 font-mono text-xs">
                  {row.normalized.HH_ID ?? "—"}
                </td>
                <td className="border-b border-[#e2ddd1] px-3 py-2 font-mono text-xs">
                  {row.normalized.ENTRY_ID ?? "—"}
                </td>
                <td className="border-b border-[#e2ddd1] px-3 py-2 text-xs">{name || "—"}</td>
                <td className="border-b border-[#e2ddd1] px-3 py-2 font-mono text-xs">
                  {row.normalized.GRANTEE ?? "—"}
                </td>
                <td className="border-b border-[#e2ddd1] px-3 py-2 text-xs">
                  {row.status === "valid" ? "Valid" : "Review"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PreviewPanel({ wizard }: { wizard: ImportWizardState }) {
  const preview = wizard.preview;
  if (!preview) return null;
  const statusCounts = preview.households.reduce<Record<string, number>>((acc, household) => {
    acc[household.grantee_status] = (acc[household.grantee_status] ?? 0) + 1;
    return acc;
  }, {});

  const downloadIssues = () => {
    downloadText(
      `${safeFilename(preview.sheet_name)}-row-issues.csv`,
      `\uFEFF${issuesCsvFromPreview(preview)}`,
    );
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Data rows" value={preview.summary.total_rows.toLocaleString()} note="Non-blank rows read" />
        <Stat label="Valid rows" value={preview.summary.valid_rows.toLocaleString()} />
        <Stat
          label="Review rows"
          value={preview.summary.invalid_rows.toLocaleString()}
          accent={preview.summary.invalid_rows > 0}
          note="Kept, never dropped"
        />
        <Stat label="Households" value={preview.summary.household_count.toLocaleString()} />
        <Stat label="Members" value={preview.summary.member_count.toLocaleString()} />
      </div>

      {preview.structural_errors.length > 0 && (
        <Notice tone="error" title="Structural problems block this import">
          <ul className="list-disc space-y-2 pl-5">
            {preview.structural_errors.map((issue) => (
              <li key={`${issue.code}-${issue.field ?? ""}`}>
                <span className="font-mono text-[10px] uppercase tracking-[0.08em]">{issue.code}</span>
                <span className="mt-1 block">{issue.guidance || issue.message}</span>
              </li>
            ))}
          </ul>
        </Notice>
      )}

      {preview.duplicate && (
        <Notice tone="warning" title="Same fingerprint and sheet already committed">
          <p>
            Version {preview.duplicate.version} was committed{" "}
            {formatDateTime(preview.duplicate.committed_at)}
            {preview.duplicate.uploaded_by_name ? ` by ${preview.duplicate.uploaded_by_name}` : ""} with{" "}
            {preview.duplicate.row_count.toLocaleString()} rows. Nothing was overwritten.
          </p>
          <label className="mt-3 flex min-h-[44px] items-start gap-3 text-sm text-[#161512]">
            <input
              type="checkbox"
              checked={wizard.duplicateConfirmed}
              onChange={(event) => wizard.setDuplicateConfirmed(event.target.checked)}
              className="mt-1 h-4 w-4 accent-[#7a1f1f]"
            />
            <span>
              Store this as a new version. I understand the register will contain two imports with the
              same fingerprint, and the new version is the only one with this confirmation.
            </span>
          </label>
        </Notice>
      )}

      {preview.warnings.length > 0 && (
        <div>
          <Notice tone="info" title="Warnings">
            <ul className="list-disc space-y-1 pl-5">
              {preview.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </Notice>
        </div>
      )}

      <section aria-labelledby="grantee-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="grantee-heading" className="font-serif text-xl">
            Grantee check
          </h3>
          <p className="text-xs text-[#5b574e]">
            {preview.households_truncated
              ? `First ${preview.households.length} households shown`
              : "All households shown"}
          </p>
        </div>
        <p className="mt-1 max-w-[72ch] text-sm leading-6 text-[#5b574e]">
          A household is only valid when exactly one member has a valid <span className="font-mono">Yes</span>{" "}
          and every other flag is a valid <span className="font-mono">No</span>. The system never picks a
          grantee.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-5">
          {(["valid", "none", "multiple", "invalid", "blank"] as const).map((status) => (
            <Stat
              key={status}
              label={GRANTEE_STATUS_LABEL[status]}
              value={(statusCounts[status] ?? 0).toLocaleString()}
              accent={status !== "valid" && (statusCounts[status] ?? 0) > 0}
            />
          ))}
        </div>
        {preview.summary.rows_without_household > 0 && (
          <p className="mt-3 text-xs leading-5 text-[#7a1f1f]">
            {preview.summary.rows_without_household} row
            {preview.summary.rows_without_household === 1 ? " has" : "s have"} a blank HH_ID. Those rows
            are kept for review and are not guessed into a household.
          </p>
        )}
      </section>

      <section aria-labelledby="rows-heading">
        <h3 id="rows-heading" className="font-serif text-xl">
          Row preview
        </h3>
        <p className="mt-1 text-xs text-[#5b574e]">
          First {Math.min(preview.rows.length, 25)} rows, normalized as the server read them.
        </p>
        <div className="mt-3">
          <RowPreviewTable wizard={wizard} />
        </div>
      </section>

      <section aria-labelledby="issues-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="issues-heading" className="font-serif text-xl">
            Row issues
          </h3>
          <button type="button" className={quietButton} onClick={downloadIssues}>
            Download issue list (CSV)
          </button>
        </div>
        <p className="mt-1 text-xs text-[#5b574e]">
          {preview.issues.length} issue{preview.issues.length === 1 ? "" : "s"} shown
          {preview.issues_truncated ? " (first 200; the committed report contains all)" : ""}. The CSV
          carries row numbers and guidance, not raw personal values.
        </p>
        <div className="mt-3">
          <IssueTable wizard={wizard} />
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-4 border-t border-[#c9c3b6] pt-5">
        <button type="button" className={secondaryButton} onClick={wizard.backToShape}>
          Back to column map
        </button>
        <button
          type="button"
          className={primaryButton}
          onClick={() => void wizard.commit()}
          disabled={
            wizard.busy !== null ||
            !preview.can_commit ||
            (Boolean(preview.duplicate) && !wizard.duplicateConfirmed)
          }
        >
          {wizard.busy === "committing" ? "Committing import…" : "Commit import"}
        </button>
        <p className="max-w-[52ch] text-xs leading-5 text-[#5b574e]">
          Commit freezes the raw rows, normalized values, and review flags as one immutable version.
          To correct data later, import a corrected workbook; the source of this version stays intact.
        </p>
      </div>
    </div>
  );
}

function CommittedPanel({ wizard }: { wizard: ImportWizardState }) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const result = wizard.result;
  if (!result) return null;
  const record = result.import;

  const downloadReport = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const csv = await fetchErrorReportCsv(record.id);
      downloadText(`${safeFilename(record.file_name ?? "import")}-errors-v${record.version}.csv`, csv);
    } catch (error: any) {
      setDownloadError(error?.message ?? "The report could not be downloaded.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="border-t border-[#2f5b3a] pt-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#2f5b3a]">
          Committed · version {record.version}
        </p>
        <h2 className="mt-2 font-serif text-4xl leading-tight tracking-tight">
          {record.file_name ?? "Workbook"} is in the register.
        </h2>
        <p className="mt-3 max-w-[66ch] text-sm leading-6 text-[#3f3b34]">
          The source file, raw row values, normalized fields, household groups, and review flags are
          traceable to import{" "}
          <span className="font-mono text-xs" title={record.id}>
            {record.id.slice(0, 8)}…
          </span>
          . {record.is_duplicate ? "This version is an explicitly confirmed re-import." : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
        <Stat label="Rows" value={result.summary.total_rows.toLocaleString()} />
        <Stat label="Households" value={result.summary.household_count.toLocaleString()} />
        <Stat label="Members" value={result.summary.member_count.toLocaleString()} />
        <Stat
          label="Review rows"
          value={result.summary.invalid_rows.toLocaleString()}
          accent={result.summary.invalid_rows > 0}
        />
      </div>

      {downloadError && (
        <Notice tone="error" title="Report download failed">
          {downloadError}
        </Notice>
      )}

      <div className="flex flex-wrap items-center gap-4 border-t border-[#c9c3b6] pt-5">
        {result.report_available && (
          <button
            type="button"
            className={primaryButton}
            onClick={() => void downloadReport()}
            disabled={downloading}
          >
            {downloading ? "Preparing report…" : "Download error report"}
          </button>
        )}
        <button type="button" className={secondaryButton} onClick={wizard.reset}>
          Start another workbook
        </button>
      </div>
    </div>
  );
}

export function ImportWizard({ wizard }: { wizard: ImportWizardState }) {
  const retry = useMemo(() => {
    if (!wizard.error?.retryable) return null;
    if (wizard.stage === "preview") {
      return (
        <button type="button" className={secondaryButton} onClick={() => void wizard.commit()}>
          Try commit again
        </button>
      );
    }
    if (wizard.stage === "shape") {
      return (
        <button type="button" className={secondaryButton} onClick={() => void wizard.validate()}>
          Try validation again
        </button>
      );
    }
    return null;
  }, [wizard]);

  const heading =
    wizard.stage === "choose"
      ? "Import a household workbook"
      : wizard.stage === "shape"
        ? "Choose the sheet, header, and columns"
        : wizard.stage === "preview"
          ? "What the server found"
          : "Import complete";

  return (
    <section aria-labelledby="wizard-heading" className="border border-[#161512] bg-[#f8f5ee] p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#5b574e]">
             Excel import
          </p>
          <h1 id="wizard-heading" className="mt-2 font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
            {heading}
          </h1>
        </div>
        <p className="max-w-[34ch] text-xs leading-5 text-[#5b574e]">
          Raw rows are immutable. Corrections belong in overlays, not in a rewritten import.
        </p>
      </div>

      <div className="mt-6">
        <StepRail stage={wizard.stage} />
      </div>

      {wizard.error && (
        <div className="mt-5">
          <Notice tone="error" title={wizard.error.title} actions={retry}>
            {wizard.error.detail}
          </Notice>
        </div>
      )}

      {wizard.busy && (
        <p role="status" aria-live="polite" className="mt-4 font-mono text-xs text-[#5b574e]">
          {wizard.busy === "reading"
            ? wizard.readStage === "hashing"
              ? "Hashing workbook in the browser…"
              : wizard.readStage === "parsing"
                ? "Parsing workbook in a background thread…"
                : wizard.readStage === "ready"
                  ? "Workbook ready."
                  : "Reading workbook in the browser…"
            : wizard.busy === "processing"
              ? "Validating worksheet batches in a background thread…"
              : wizard.busy === "validating"
              ? "Uploading and validating on the server…"
              : "Writing the immutable import version…"}
        </p>
      )}

      <div className="mt-6">
        {wizard.stage === "choose" && <ChoosePanel wizard={wizard} />}
        {wizard.stage === "shape" && <ShapePanel wizard={wizard} />}
        {wizard.stage === "preview" && <PreviewPanel wizard={wizard} />}
        {wizard.stage === "committed" && <CommittedPanel wizard={wizard} />}
      </div>
    </section>
  );
}
