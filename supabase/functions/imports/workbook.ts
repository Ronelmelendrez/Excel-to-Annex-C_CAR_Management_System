import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import {
  analyzeRows,
  autoMapping,
  DEFAULT_REQUIRED_COLUMNS,
  detectHeaderRow,
  headersFromRow,
  MAX_IMPORT_BYTES,
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

export function readWorkbook(bytes: ArrayBuffer): any {
  if (bytes.byteLength > MAX_IMPORT_BYTES) {
    throw new HttpError(413, "file_too_large", {
      guidance: `The file is ${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB. The limit is 25 MB.`,
    });
  }
  assertWorkbookMagic(new Uint8Array(bytes));
  try {
    return XLSX.read(bytes, {
      type: "array",
      cellDates: false,
      cellNF: false,
      cellText: true,
      dense: false,
    });
  } catch {
    throw new HttpError(415, "unsupported_file", {
      guidance: "The workbook could not be opened. Re-save it as .xlsx and try again.",
    });
  }
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
  const workbook = readWorkbook(input.bytes);
  const sheetNames = Object.keys(workbook?.Sheets ?? {});
  if (!sheetNames.length) {
    throw new HttpError(422, "empty_workbook", {
      guidance: "The workbook has no worksheets. Nothing was written.",
    });
  }

  const sheetName = input.sheet_name || sheetNames[0];
  if (!sheetNames.includes(sheetName)) {
    throw new HttpError(422, "sheet_not_found", {
      guidance: "Select one of the worksheets in this workbook.",
      sheet_names: sheetNames,
    });
  }

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
