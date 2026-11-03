import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import {
  analyzeRows,
  autoMapping,
  DEFAULT_REQUIRED_COLUMNS,
  detectHeaderRow,
  headersFromRow,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_MB,
  MAX_IMPORT_ROWS,
  type CanonicalField,
  type ColumnMapping,
  type ImportAnalysis,
} from "../_shared/import-domain.ts";
import { HttpError } from "../_shared/http.ts";

export type WorkbookAnalysisResult = {
  analysis: ImportAnalysis;
  sheet_names: string[];
  sheet_name: string;
  header_row: number;
  detected_header_row: number;
};

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

export function assertWorkbookMagic(bytes: Uint8Array) {
  if (bytes.length < 8) {
    throw new HttpError(415, "unsupported_file", {
      guidance: "The file is empty or too small to be a valid Excel workbook.",
    });
  }
  const isZip = ZIP_MAGIC.every((value, index) => bytes[index] === value);
  const isOle = OLE_MAGIC.every((value, index) => bytes[index] === value);
  if (!isZip && !isOle) {
    throw new HttpError(415, "unsupported_file", {
      guidance: "Only .xlsx and .xls workbooks are accepted. The file signature does not match an Excel workbook.",
    });
  }
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function assertReadable(bytes: ArrayBuffer) {
  if (bytes.byteLength > MAX_IMPORT_BYTES) {
    throw new HttpError(413, "file_too_large", {
      guidance: `The file is ${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_IMPORT_MB} MB.`,
    });
  }
  assertWorkbookMagic(new Uint8Array(bytes));
}

/**
 * Read ONLY the worksheet names (plus the file structure) — no cells.
 *
 * Cost is milliseconds even for a 50 MB workbook: the worksheet parts are
 * never touched, which is what makes it safe to call before the real parse
 * on every preview/commit (see readWorkbook's memory notes).
 */
export function readWorkbookNames(bytes: ArrayBuffer): string[] {
  assertReadable(bytes);
  let workbook: any;
  try {
    workbook = XLSX.read(bytes, { type: "array", bookSheets: true });
  } catch {
    try {
      workbook = XLSX.read(bytes, { type: "array", bookSheets: true, raw: true });
    } catch {
      try {
        workbook = XLSX.read(bytes, { type: "array", bookSheets: true, cellText: true });
      } catch {
        throw new HttpError(415, "unsupported_file", {
          guidance: "The workbook could not be opened. Re-save it as .xlsx and try again.",
        });
      }
    }
  }
  const names = Array.isArray(workbook?.SheetNames)
    ? workbook.SheetNames.filter((name: unknown): name is string => typeof name === "string")
    : [];
  if (!names.length) {
    throw new HttpError(422, "empty_workbook", {
      guidance: "The workbook has no worksheets. Nothing was written.",
    });
  }
  return names;
}

/**
 * Parse a workbook — and when `sheetName` is given, parse ONLY that
 * worksheet's cells.
 *
 * Why this shape matters: the platform caps an Edge Function at 256 MB of
 * memory (exceeding it kills the request with HTTP 546 WORKER_RESOURCE_LIMIT)
 * and a full `dense:false` + `cellText:true` read of a mid-sized sheet blows
 * past that. Two changes keep a real roster-sized sheet inside the cap:
 *
 *   1. `sheets: [sheetName]` — sibling worksheets are never parsed, so extra
 *      sheets (or a bloated cover sheet) cost nothing here. The names are
 *      read separately and cheaply by readWorkbookNames().
 *   2. `dense: true` without `cellText` — rows are stored as plain arrays
 *      instead of one giant address-keyed object map, and no formatted-text
 *      shadow string is built per cell (~4x less memory on a 14 MB sheet,
 *      measured: 215 MB -> 75 MB). sheet_to_json formats values lazily, so
 *      the resulting matrix is byte-for-byte identical to the old options.
 *
 * The ladder only grows heavier (up to the exact legacy options) when a
 * sheet's parse fails, so unusual files keep the old rescue behaviour.
 */
export function readWorkbook(bytes: ArrayBuffer, sheetName?: string): any {
  assertReadable(bytes);

  const variants: Record<string, unknown>[] = sheetName
    ? [
        { cellDates: false, cellNF: false, dense: true, sheets: [sheetName] },
        { cellDates: false, cellNF: false, dense: true, cellText: true, sheets: [sheetName] },
        { cellDates: false, cellNF: false, dense: false, sheets: [sheetName] },
        { cellDates: false, cellNF: false, cellText: true, dense: false, sheets: [sheetName] },
      ]
    : [
        { cellDates: false, cellNF: false, dense: true },
        { cellDates: false, cellNF: false, dense: false, cellText: true },
      ];

  let lastError: unknown = null;
  for (const options of variants) {
    try {
      return XLSX.read(bytes, { type: "array", ...options });
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) console.error("workbook parse failed", lastError);
  throw new HttpError(415, "unsupported_file", {
    guidance: "The workbook could not be opened. Re-save it as .xlsx and try again.",
  });
}

export function sheetMatrix(workbook: any, sheetName: string): unknown[][] {
  const sheet = workbook?.Sheets?.[sheetName];
  if (!sheet) {
    throw new HttpError(422, "sheet_not_found", {
      guidance: "That worksheet no longer exists in the workbook.",
      sheet_names: Object.keys(workbook?.Sheets ?? {}),
    });
  }
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: null,
    blankrows: true,
  }) as unknown[][];
  return Array.isArray(matrix) ? matrix : [];
}

function sanitizeMapping(raw: unknown, headers: string[]): ColumnMapping {
  if (!Array.isArray(raw)) {
    return autoMapping(headers);
  }
  if (raw.length !== headers.length) {
    throw new HttpError(422, "mapping_mismatch", {
      guidance: "The column mapping no longer matches this header row. Re-run auto-map and validate again.",
      expected_columns: headers.length,
      mapped_columns: raw.length,
    });
  }
  return raw.map((entry: any, index) => {
    const field = entry?.field == null || entry.field === "" ? null : String(entry.field);
    return {
      index,
      header: headers[index],
      field: field as CanonicalField | null,
    };
  });
}

export function analyzeWorkbook(input: {
  bytes: ArrayBuffer;
  sheet_name: string;
  header_row?: number | null;
  mapping?: unknown;
  required_columns?: CanonicalField[];
  max_rows?: number;
}): WorkbookAnalysisResult {
  // Names first: a cheap read that never touches worksheet cells, so the
  // heavy parse below can stay restricted to the chosen sheet (and the sheet
  // name is validated BEFORE spending any parse memory on it).
  const sheetNames = readWorkbookNames(input.bytes);

  const sheetName = input.sheet_name || sheetNames[0];
  if (!sheetNames.includes(sheetName)) {
    throw new HttpError(422, "sheet_not_found", {
      guidance: "Select one of the worksheets in this workbook.",
      sheet_names: sheetNames,
    });
  }

  const workbook = readWorkbook(input.bytes, sheetName);
  const matrix = sheetMatrix(workbook, sheetName);
  const detectedHeaderRow = detectHeaderRow(matrix, input.required_columns ?? DEFAULT_REQUIRED_COLUMNS);
  const headerRow = Number.isInteger(input.header_row)
    ? Math.max(0, Number(input.header_row))
    : detectedHeaderRow;

  if (headerRow < 0 || headerRow >= matrix.length) {
    throw new HttpError(422, "header_not_found", {
      guidance: "No header row could be detected. Choose the row that contains HH_ID, ENTRY_ID, FIRST_NAME, LAST_NAME, and GRANTEE.",
      sheet_names: sheetNames,
      detected_header_row: detectedHeaderRow,
    });
  }

  const headers = headersFromRow(matrix[headerRow] ?? []);
  const mapping = sanitizeMapping(input.mapping, headers);
  const analysis = analyzeRows({
    headers,
    rows: matrix.slice(headerRow + 1),
    mapping,
    requiredColumns: input.required_columns ?? DEFAULT_REQUIRED_COLUMNS,
    maxRows: input.max_rows ?? MAX_IMPORT_ROWS,
    firstDataRowNo: headerRow + 2,
  });

  return {
    analysis,
    sheet_names: sheetNames,
    sheet_name: sheetName,
    header_row: headerRow,
    detected_header_row: detectedHeaderRow,
  };
}
