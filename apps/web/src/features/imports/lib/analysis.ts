import {
  autoMapping,
  detectHeaderRow,
  DEFAULT_REQUIRED_COLUMNS,
  headersFromRow,
  issuesToCsv,
  MAX_IMPORT_BYTES,
  type CanonicalField,
  type ColumnMapping,
} from "@import-domain";
import type { ImportPreview, SheetInspection } from "../types";

export type WorkbookBundle = {
  file: File;
  fileHash: string;
  size: number;
  workbook: any;
  sheetNames: string[];
  utils: typeof import("xlsx").utils;
};

export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function readWorkbookFile(file: File): Promise<WorkbookBundle> {
  if (!/\.(xlsx|xls)$/i.test(file.name)) {
    throw new Error("Choose an .xlsx or .xls workbook. Other file types are not read.");
  }
  if (file.size > MAX_IMPORT_BYTES) {
    throw new Error(
      `This file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 25 MB. Split the workbook first.`,
    );
  }

  const buffer = await file.arrayBuffer();
  const fileHash = await sha256Hex(buffer);

  // Load the spreadsheet parser only when a workbook is actually chosen.
  const XLSX = await import("xlsx");

  let workbook: any;
  try {
    workbook = XLSX.read(buffer, { type: "array", cellDates: false, cellNF: false });
  } catch {
    throw new Error("The workbook could not be opened. Re-save it as .xlsx and try again.");
  }

  const sheetNames: string[] = workbook?.SheetNames ?? [];
  if (!sheetNames.length) {
    throw new Error("This workbook has no worksheets. Nothing was uploaded.");
  }

  return { file, fileHash, size: file.size, workbook, sheetNames, utils: XLSX.utils };
}

function sheetMatrix(bundle: WorkbookBundle, sheetName: string): unknown[][] {
  const sheet = bundle.workbook?.Sheets?.[sheetName];
  if (!sheet) throw new Error("That worksheet is no longer available. Pick another sheet.");
  const matrix = bundle.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: null,
    blankrows: true,
  }) as unknown[][];
  return Array.isArray(matrix) ? matrix : [];
}

function isBlankRow(row: unknown[]): boolean {
  return row.every((value) => value === null || value === undefined || String(value).trim() === "");
}

export function inspectSheet(
  bundle: WorkbookBundle,
  sheetName: string,
  requestedHeaderRow?: number,
): SheetInspection {
  const matrix = sheetMatrix(bundle, sheetName);
  const detectedHeaderRow = detectHeaderRow(matrix, DEFAULT_REQUIRED_COLUMNS);
  const headerRow = Number.isInteger(requestedHeaderRow)
    ? Math.max(0, Number(requestedHeaderRow))
    : detectedHeaderRow >= 0
      ? detectedHeaderRow
      : 0;

  const headers = headersFromRow(matrix[headerRow] ?? []);
  const dataRows = matrix.slice(headerRow + 1);
  const rowCount = dataRows.filter((row) => !isBlankRow(row)).length;

  return {
    sheetName,
    headerRow,
    detectedHeaderRow,
    headers,
    sampleRows: dataRows.slice(0, 5),
    mapping: autoMapping(headers, DEFAULT_REQUIRED_COLUMNS),
    rowCount,
  };
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
