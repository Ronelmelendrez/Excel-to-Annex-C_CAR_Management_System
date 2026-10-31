import {
  autoMapping,
  DEFAULT_REQUIRED_COLUMNS,
  issuesToCsv,
  type CanonicalField,
  type ColumnMapping,
} from "@import-domain";
import type { ImportPreview, SheetInspection } from "../types";
import { workbookClient, type WorkbookBundle } from "./workbook-client";
import { IMPORT_MAX_BYTES } from "./import-limits";

export type { WorkbookBundle };

/**
 * Read a workbook in the background (Web Worker) and return only its
 * lightweight metadata. The parsed workbook never enters the main thread —
 * see workbook-client.ts / xlsx.worker.ts. Throws a user-facing message when
 * the file is the wrong type, too large, or cannot be parsed.
 */
export async function readWorkbookFile(
  file: File,
  buffer?: ArrayBuffer,
): Promise<WorkbookBundle> {
  if (!/\.(xlsx|xls)$/i.test(file.name)) {
    throw new Error("Choose an .xlsx or .xls workbook. Other file types are not read.");
  }

  let opened = await workbookClient.open(file, IMPORT_MAX_BYTES, buffer);
  if (opened.unavailableSheetNames.length > 0) {
    // A worker can occasionally return stale/incomplete worksheet state during
    // replacement or recovery. Recreate it once and verify against the same
    // original bytes before allowing a partial workbook into the wizard.
    opened = await workbookClient.open(file, IMPORT_MAX_BYTES, buffer);
  }
  const { fileHash, size, sheetNames, unavailableSheetNames, sheetReadErrors } = opened;
  return { file, fileHash, size, sheetNames, unavailableSheetNames, sheetReadErrors };
}

/**
 * Inspect a sheet of the currently open workbook (async: the work happens in
 * the parser thread). Returns the small plain-data preview the mapping screen
 * needs — headers, a few sample rows, and the row count.
 */
export function inspectSheet(
  sheetName: string,
  headerRow?: number,
): Promise<SheetInspection> {
  return workbookClient.inspect(sheetName, headerRow);
}

/**
 * Extra worksheets sniffed while choosing the default sheet. Bounded so a
 * workbook with hundreds of tabs cannot turn "choose a file" into a scan.
 */
export const INITIAL_SHEET_SCAN_LIMIT = 20;

export type InitialSheetChoice = {
  inspection: SheetInspection;
  /** True when the first worksheet was skipped because it holds no importable table. */
  autoSwitched: boolean;
};

/** Data rows plus at least one auto-mapped required column: clearly the table. */
function looksImportable(sheet: SheetInspection): boolean {
  if (sheet.readError) return false;
  if (sheet.dataRowCount <= 0) return false;
  return sheet.mapping.some((entry) => entry.field !== null);
}

/** A detected header with rows — a real table, even if columns need hand mapping. */
function hasTableShape(sheet: SheetInspection): boolean {
  if (sheet.readError) return false;
  return sheet.dataRowCount > 0 && sheet.detectedHeaderRow >= 0;
}

/**
 * Pick the worksheet the import should open with.
 *
 * Workbooks commonly start with a cover, instructions, or an empty "Sheet1"
 * while the actual household table lives on the second sheet. Opening the
 * wrong sheet left the mapping screen empty and both action buttons disabled,
 * which looked like a broken import. The first worksheet is kept whenever it
 * is itself a plausible import table; otherwise the first worksheet with a
 * real table shape is chosen (preferring one whose headers auto-map to the
 * required columns), and the caller is told it auto-switched so the UI can
 * explain the choice.
 *
 * A worksheet that fails inspection (damaged cells, unreadable data) is
 * SKIPPED, never fatal: one bad sheet must not block importing the readable
 * ones. Only when every worksheet fails does this throw, with the original
 * first failure preserved as the message.
 */
export async function inspectInitialSheet(sheetNames: string[]): Promise<InitialSheetChoice> {
  if (!sheetNames.length) {
    throw new Error("This workbook has no worksheets. Nothing was uploaded.");
  }
  const scan = sheetNames.slice(0, 1 + INITIAL_SHEET_SCAN_LIMIT);

  let first: SheetInspection | null = null;
  let firstFailure: unknown = null;
  let tableShape: SheetInspection | null = null;
  let inspectedAny = false;

  for (let index = 0; index < scan.length; index += 1) {
    let candidate: SheetInspection;
    try {
      candidate = await inspectSheet(scan[index]);
    } catch (error) {
      if (index === 0) firstFailure = error;
      continue; // An unreadable sheet must not abort the search.
    }
    inspectedAny = true;
    if (index === 0) first = candidate;

    if (looksImportable(candidate)) {
      return { inspection: candidate, autoSwitched: index !== 0 };
    }
    if (!tableShape && hasTableShape(candidate)) tableShape = candidate;
  }

  if (tableShape) {
    return { inspection: tableShape, autoSwitched: tableShape.sheetName !== first?.sheetName };
  }
  if (first) return { inspection: first, autoSwitched: false };

  if (!inspectedAny && firstFailure instanceof Error && firstFailure.message) {
    throw firstFailure;
  }
  throw new Error(
    `None of this workbook's worksheets (${sheetNames.join(", ")}) could be read. Copy the data into a fresh sheet in Excel, save as .xlsx, and try again.`,
  );
}

/** Re-map a row while keeping the operator's earlier choices where possible. */
export function remapPreservingChoices(
  headers: string[],
  previous: ColumnMapping | null,
): ColumnMapping {
  const next = autoMapping(headers, DEFAULT_REQUIRED_COLUMNS);
  if (!previous) return next;
  const used = new Set<CanonicalField>();
  return next.map((entry) => {
    const old = previous.find((item) => item.index === entry.index);
    if (old?.field && !used.has(old.field)) {
      used.add(old.field);
      return { ...entry, field: old.field };
    }
    if (entry.field) used.add(entry.field);
    return entry;
  });
}

/** Setting a target clears any other column already using it. */
export function setMappingField(
  mapping: ColumnMapping,
  index: number,
  field: CanonicalField | null,
): ColumnMapping {
  return mapping.map((entry) => {
    if (entry.index === index) return { ...entry, field };
    if (field && entry.field === field) return { ...entry, field: null };
    return entry;
  });
}

export function mappingCoverage(
  mapping: ColumnMapping,
  required: CanonicalField[] = DEFAULT_REQUIRED_COLUMNS,
) {
  const mapped = new Set(mapping.map((entry) => entry.field).filter(Boolean));
  return {
    missing: required.filter((field) => !mapped.has(field)),
    mappedCount: mapping.filter((entry) => entry.field).length,
    totalCount: mapping.length,
  };
}

export function issuesCsvFromPreview(preview: ImportPreview): string {
  return issuesToCsv(
    preview.issues.map((issue) => ({
      source_row_no: issue.source_row_no,
      field: issue.field,
      code: issue.code,
      message: issue.message,
      guidance: issue.guidance,
    })),
  );
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
