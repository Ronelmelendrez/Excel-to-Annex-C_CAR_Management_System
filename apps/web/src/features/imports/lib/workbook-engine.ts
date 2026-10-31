import {
  autoMapping,
  detectHeaderRow,
  DEFAULT_REQUIRED_COLUMNS,
  headersFromRow,
  analyzeRows,
} from "@import-domain";
import type { SheetInspection, WorkbookBatchResult } from "../types";
import type { ColumnMapping } from "@import-domain";
import { IMPORT_BATCH_SIZE } from "./import-limits";

/**
 * Shared workbook engine.
 *
 * Everything here is deliberately free of DOM/Worker globals so the exact same
 * code runs inside the Web Worker (the normal path) and on the main thread (the
 * fallback used in tests, jsdom, and browsers without Worker support). Keeping
 * one implementation means the bounded-read behaviour cannot drift between the
 * two paths.
 */

/**
 * Rows read into memory while shaping the import. Header detection only scores
 * the first 25 rows and the preview shows a handful of samples, so there is no
 * reason to materialize a full 1,000,000-row matrix just to build the column
 * map. The server re-reads and validates every row regardless.
 */
export const SHAPE_SNIFF_ROWS = 200;
/**
 * Column cap for the mapping-preview sniff. A sheet whose used range covers
 * the whole grid (stray formatting out to XFD — the same bloat that triggers
 * the browser's "Too many properties to enumerate") would otherwise scan
 * 16,384 columns and hand thousands of empty headers to the step-02 mapping
 * screen, which stalls both the worker and the render. Real import tables sit
 * far below this cap.
 */
export const SHAPE_SNIFF_COLS = 512;

export type ParsedSheet = {
  workbook: any;
  utils: typeof import("xlsx").utils;
  sheetNames: string[];
  unavailableSheetNames: string[];
  /**
   * Why each unavailable worksheet failed, captured with SheetJS's WTF mode
   * (normal mode swallows per-sheet errors). Keyed by sheet name; shown in the
   * UI so "could not be read" is never a dead end.
   */
  sheetReadErrors?: Record<string, string>;
};

// File signatures for the only two accepted containers (.xlsx = zip, .xls = OLE).
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

export function getWorkbookWorksheetNames(workbook: {
  SheetNames?: unknown;
  Sheets?: Record<string, unknown>;
}): { sheetNames: string[]; unavailableSheetNames: string[] } {
  const declaredNames = Array.isArray(workbook.SheetNames)
    ? workbook.SheetNames.filter((name): name is string => typeof name === "string")
    : [];
  const sheets = workbook.Sheets ?? {};
  const sheetNames = declaredNames.filter(
    (name) =>
      Object.prototype.hasOwnProperty.call(sheets, name) &&
      sheets[name] !== null &&
      typeof sheets[name] === "object",
  );
  return {
    sheetNames,
    unavailableSheetNames: declaredNames.filter((name) => !sheetNames.includes(name)),
  };
}

/**
 * Browsers refuse to build or enumerate objects holding an extreme number of
 * properties (Safari/Firefox throw "Too many properties to enumerate"). This
 * happens on worksheets whose used range is enormous — almost always stray
 * formatting stretched across empty rows or columns — because SheetJS's normal
 * mode stores every cell as a property of ONE sheet object.
 */
export function isSheetSizeLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /too many properties/i.test(message);
}

const SHEET_SIZE_LIMIT_EXPLANATION =
  "This worksheet's used range is extremely large (usually stray formatting stretched across " +
  "empty rows or columns), which exceeds what a browser can process, and it could not be read " +
  "even in the alternative cell-storage mode. In Excel, open the sheet, press Ctrl+End to see " +
  "how far it extends, then delete the unused rows and columns below and to the right of the " +
  "real data (or use Move or Copy to put the sheet into a new workbook), save as .xlsx, and " +
  "import that copy.";

/** Turn a raw parser error into the message shown in the UI. */
export function explainSheetReadError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (!message) return "the worksheet part could not be parsed.";
  if (isSheetSizeLimitError(error)) {
    return `${SHEET_SIZE_LIMIT_EXPLANATION} (parser detail: ${message})`;
  }
  return message;
}

export function readWorkbookWithSheetRecovery(
  XLSX: typeof import("xlsx"),
  buffer: ArrayBuffer,
) {
  const options = { type: "array" as const, cellDates: false, cellNF: false };

  // Try to read the workbook. If Sheet1 is corrupt, SheetJS may throw during
  // the full-workbook parse. Fall back to raw mode (bypasses some XML
  // validation) and then cellText mode so we can still recover readable
  // sheets like Sheet2.
  let workbook: any;
  try {
    workbook = XLSX.read(buffer, options);
  } catch {
    try {
      workbook = XLSX.read(buffer, { ...options, raw: true });
    } catch {
      try {
        workbook = XLSX.read(buffer, { ...options, cellText: true });
      } catch {
        throw new Error(
          "The workbook could not be opened. Re-save it as .xlsx and try again.",
        );
      }
    }
  }

  const initial = getWorkbookWorksheetNames(workbook);

  // Recover any sheets that SheetJS could not materialize in the first pass.
  // Read all unavailable sheets in a single pass (SheetJS accepts an array of
  // sheet names) instead of re-reading the entire buffer once per sheet, which
  // is the dominant cost for multi-sheet, million-row workbooks.
  if (initial.unavailableSheetNames.length > 0) {
    try {
      const recovery = XLSX.read(buffer, {
        ...options,
        sheets: initial.unavailableSheetNames,
      });
      for (const sheetName of initial.unavailableSheetNames) {
        const sheet = recovery.Sheets?.[sheetName];
        if (sheet && typeof sheet === "object") {
          workbook.Sheets ??= {};
          workbook.Sheets[sheetName] = sheet;
        }
      }
    } catch {
      // Batch recovery failed; fall through to per-sheet attempts below.
    }

    // If some sheets are still unavailable, try reading each one individually
    // with alternative option combinations. SheetJS can sometimes read a sheet
    // with `sheets: ["Name"]` that it could not read in the full-workbook pass,
    // or vice versa.
    const stillUnavailable = initial.unavailableSheetNames.filter(
      (name) =>
        !workbook.Sheets?.[name] ||
        typeof workbook.Sheets[name] !== "object",
    );
    for (const sheetName of stillUnavailable) {
      let recovered = false;
      let sawSizeLimit = false;
      // `dense` stores each row as its own small array instead of ONE object
      // holding every cell. Browsers (Safari, Firefox) refuse to build objects
      // with an extreme number of properties — they throw "Too many properties
      // to enumerate" on sheets whose formatting stretches across a million
      // empty rows, no matter how the sheet is read. Dense mode sidesteps the
      // limit entirely and keeps the full data, so it is tried as soon as a
      // size-limit error is seen (and each earlier attempt on such a sheet is
      // slow, so the remaining plain modes are skipped past that point).
      // Every utility call (sheet_to_json, our batch reader) auto-detects dense
      // sheets via Array.isArray, so the rest of the pipeline needs no changes.
      for (const variant of [
        { ...options, sheets: sheetName },
        { ...options, sheets: sheetName, cellDates: true },
        { ...options, sheets: sheetName, cellNF: true },
        { ...options, sheets: sheetName, raw: true },
        // cellText mode parses every cell as text, which rescues sheets whose
        // typed values (dates, error cells, broken number formats) break the
        // normal or raw passes — a common cause of one unreadable first sheet.
        { ...options, sheets: sheetName, cellText: true },
        { ...options, sheets: sheetName, cellText: true, raw: true },
        { ...options, sheets: sheetName, dense: true },
        { ...options, sheets: sheetName, dense: true, cellText: true },
        { ...options, sheets: sheetName, dense: true, raw: true },
      ]) {
        if (sawSizeLimit && !("dense" in variant)) continue;
        try {
          const individual = XLSX.read(buffer, variant);
          const sheet = individual.Sheets?.[sheetName];
          if (sheet && typeof sheet === "object") {
            workbook.Sheets ??= {};
            workbook.Sheets[sheetName] = sheet;
            recovered = true;
            break;
          }
        } catch (error) {
          if (isSheetSizeLimitError(error)) sawSizeLimit = true;
          // Try the next option variant.
        }
      }
      if (!recovered && !sawSizeLimit) {
        // Last resort: try without the `sheets` restriction but with raw mode,
        // which can bypass certain XML parsing issues SheetJS hits on formatted
        // or merged-cell worksheets. Skipped after a size-limit error: it would
        // parse the whole giant workbook again just to fail the same way.
        try {
          const individual = XLSX.read(buffer, {
            ...options,
            raw: true,
          });
          const sheet = individual.Sheets?.[sheetName];
          if (sheet && typeof sheet === "object") {
            workbook.Sheets ??= {};
            workbook.Sheets[sheetName] = sheet;
          }
        } catch {
          // Sheet genuinely cannot be read; leave it unavailable.
        }
      }
    }
  }

  const names = getWorkbookWorksheetNames(workbook);

  // Capture the REAL reason each still-unavailable sheet failed. SheetJS
  // swallows per-sheet errors unless WTF is set, so this final strict read is
  // the only way to surface a specific cause ("part missing from the file",
  // a rels error, …) instead of a generic dead-end notice. One strict read per
  // failed sheet, never per good sheet.
  const sheetReadErrors: Record<string, string> = {};
  for (const sheetName of names.unavailableSheetNames) {
    try {
      XLSX.read(buffer, { ...options, WTF: true, sheets: [sheetName] });
      sheetReadErrors[sheetName] =
        "the file lists this worksheet but contains no worksheet data for it (it may be a chart, form, or macro sheet, or its worksheet part is missing from the file).";
    } catch (error) {
      sheetReadErrors[sheetName] = explainSheetReadError(error);
    }
  }

  return { workbook, ...names, sheetReadErrors };
}

/**
 * Reject anything that is not actually an Excel container before handing it to
 * the parser. Mirrors the server's assertWorkbookMagic so the browser fails with
 * the same clear message instead of letting SheetJS silently "parse" garbage.
 */
function assertWorkbookMagic(bytes: Uint8Array) {
  if (bytes.length < 8) {
    throw new Error("The file is empty or too small to be a valid Excel workbook.");
  }
  const isZip = ZIP_MAGIC.every((value, index) => bytes[index] === value);
  const isOle = OLE_MAGIC.every((value, index) => bytes[index] === value);
  if (!isZip && !isOle) {
    throw new Error(
      "This file is not a valid Excel workbook. Only .xlsx and .xls files are accepted.",
    );
  }
}

export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Parse workbook bytes into a SheetJS workbook. Throws a user-facing message on
 * failure. Callers own the returned workbook's lifetime (and should release it
 * when the import session ends).
 */
export async function parseWorkbookBuffer(buffer: ArrayBuffer): Promise<ParsedSheet> {
  assertWorkbookMagic(new Uint8Array(buffer));

  // Load the spreadsheet parser only when a workbook is actually chosen.
  const XLSX = await import("xlsx");

  let workbook: any;
  let sheetNames: string[];
  let unavailableSheetNames: string[];
  let sheetReadErrors: Record<string, string> | undefined;
  try {
    ({ workbook, sheetNames, unavailableSheetNames, sheetReadErrors } =
      readWorkbookWithSheetRecovery(XLSX, buffer));
  } catch {
    throw new Error("The workbook could not be opened. Re-save it as .xlsx and try again.");
  }

  if (!sheetNames.length) {
    if (unavailableSheetNames.length) {
      const reason = sheetReadErrors?.[unavailableSheetNames[0]];
      throw new Error(
        `This workbook lists worksheets (${unavailableSheetNames.join(", ")}) but none contained readable worksheet data.${reason ? ` Detail: ${reason}` : ""}`,
      );
    }
    throw new Error("This workbook has no worksheets. Nothing was uploaded.");
  }

  return { workbook, utils: XLSX.utils, sheetNames, unavailableSheetNames, sheetReadErrors };
}

function sheetRefRange(parsed: ParsedSheet, sheetName: string) {
  const sheet = parsed.workbook?.Sheets?.[sheetName];
  if (!sheet) {
    const parsedSheetNames = Object.keys(parsed.workbook?.Sheets ?? {});
    const available =
      parsedSheetNames.length > 0 ? parsedSheetNames.join(", ") : "none";
    throw new Error(
      `The workbook lists "${sheetName}", but its worksheet data was not available after parsing. Parsed worksheets: ${available}. Try saving a fresh .xlsx copy and importing it again.`,
    );
  }
  const ref = sheet["!ref"];
  const range = ref ? parsed.utils.decode_range(ref) : null;
  return { sheet, range };
}

function isBlankRow(row: unknown[]): boolean {
  return row.every((value) => value === null || value === undefined || String(value).trim() === "");
}

/**
 * Read a sheet into a row matrix without letting one damaged worksheet sink
 * the whole import. A malformed cell (common in files saved by broken tooling)
 * can make SheetJS's formatter throw; we retry with raw cell values and, if
 * that also fails, return an empty matrix so the operator can still see and
 * use the OTHER worksheets in the same workbook. The failure reason travels
 * back on `readError` so the UI can say plainly that this sheet cannot be read.
 */
function safeSheetMatrix(
  parsed: ParsedSheet,
  sheet: unknown,
  options: Parameters<typeof parsed.utils.sheet_to_json>[1],
): { matrix: unknown[][]; readError: string | null } {
  try {
    const raw = parsed.utils.sheet_to_json(sheet as any, options);
    return { matrix: (Array.isArray(raw) ? raw : []) as unknown[][], readError: null };
  } catch {
    // Retry once with raw cell values: unformatted reads skip the formatter
    // that usually trips over corrupt cells.
    try {
      const raw = parsed.utils.sheet_to_json(sheet as any, { ...(options as object), raw: true });
      return { matrix: (Array.isArray(raw) ? raw : []) as unknown[][], readError: null };
    } catch {
      return {
        matrix: [],
        readError: "This worksheet's cells could not be read; it may be damaged or saved by an incompatible tool. Copy its data into a new sheet in Excel and re-save the workbook to include it.",
      };
    }
  }
}

/**
 * Build the column-map preview for a sheet without materializing a huge matrix.
 *
 * The mapping screen only needs the header row, a handful of sample rows, and a
 * row count. For a normal sheet we read the top rows and keep the exact,
 * blank-filtered count. For a very large sheet (up to 1,000,000 rows) we only
 * sniff the top rows so the thread does not stall building a million-cell array;
 * the count then falls back to the sheet extent, which is cheap and accurate to
 * the last used cell. The sniff is bounded in BOTH dimensions (SHAPE_SNIFF_ROWS
 * x SHAPE_SNIFF_COLS): a bloated used range must never scan the whole grid or
 * flood step 02 with thousands of empty headers. The server re-reads and
 * validates every row regardless.
 */
export function inspectWorkbookSheet(
  parsed: ParsedSheet,
  sheetName: string,
  requestedHeaderRow?: number,
): SheetInspection {
  const { sheet, range } = sheetRefRange(parsed, sheetName);
  const extentRows = range ? range.e.r - range.s.r + 1 : 0;
  const requested = Number.isInteger(requestedHeaderRow)
    ? Math.max(0, Number(requestedHeaderRow))
    : null;
  // Read enough rows to cover header detection (top 25) plus any explicit
  // header choice and its sample rows, but never the full sheet when it is huge.
  const sniffRows = Math.max(SHAPE_SNIFF_ROWS, (requested ?? 0) + 6);
  const large = extentRows > sniffRows;

  // Only pass an explicit range when it actually caps something: a small,
  // narrow sheet keeps reading exactly its full extent (so exact counts and
  // full samples are preserved), while a bloated one is bounded to the sniff
  // window in both dimensions.
  const capsRows = range ? range.e.r > range.s.r + sniffRows - 1 : false;
  const capsCols = range ? range.e.c > range.s.c + SHAPE_SNIFF_COLS - 1 : false;
  const sniffRange =
    range && (capsRows || capsCols)
      ? {
          s: range.s,
          e: {
            r: Math.min(range.e.r, range.s.r + sniffRows - 1),
            c: Math.min(range.e.c, range.s.c + SHAPE_SNIFF_COLS - 1),
          },
        }
      : undefined;

  const options = {
    header: 1 as const,
    raw: false,
    defval: null,
    blankrows: true,
    ...(sniffRange ? { range: sniffRange } : {}),
  };

  const { matrix: rawMatrix, readError } = safeSheetMatrix(parsed, sheet, options);
  const matrix = Array.isArray(rawMatrix) ? rawMatrix : [];

  const detectedHeaderRow = detectHeaderRow(matrix, DEFAULT_REQUIRED_COLUMNS);
  const headerRow = requested ?? (detectedHeaderRow >= 0 ? detectedHeaderRow : 0);

  const headers = headersFromRow(matrix[headerRow] ?? []);
  const dataRows = matrix.slice(headerRow + 1);
  const rowCount = large
    ? Math.max(0, extentRows - (headerRow + 1))
    : dataRows.filter((row) => !isBlankRow(row)).length;
  const dataRowCount = Math.max(0, extentRows - (headerRow + 1));

  return {
    sheetName,
    headerRow,
    detectedHeaderRow,
    headers,
    sampleRows: dataRows.slice(0, 5),
    mapping: autoMapping(headers, DEFAULT_REQUIRED_COLUMNS),
    rowCount,
    dataRowCount,
    readError,
  };
}

/** Convert and validate one bounded worksheet batch inside the worker. */
export function processWorkbookBatch(
  parsed: ParsedSheet,
  params: {
    sheetName: string;
    headerRow: number;
    headers: string[];
    mapping: ColumnMapping;
    batchIndex: number;
    batchSize: number;
  },
): WorkbookBatchResult {
  const { sheet, range } = sheetRefRange(parsed, params.sheetName);
  if (!range) throw new Error("The selected worksheet is empty.");
  if (!Number.isInteger(params.batchIndex) || params.batchIndex < 0) {
    throw new Error("The requested import batch is invalid.");
  }
  if (!Number.isInteger(params.batchSize) || params.batchSize < 1 || params.batchSize > IMPORT_BATCH_SIZE) {
    throw new Error("The requested import batch size is invalid.");
  }

  const firstDataRow = range.s.r + params.headerRow + 1;
  const startRow = firstDataRow + params.batchIndex * params.batchSize;
  if (startRow > range.e.r) throw new Error("The requested import batch is past the end of the worksheet.");
  const endRow = Math.min(range.e.r, startRow + params.batchSize - 1);
  const rows = parsed.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: null,
    blankrows: true,
    range: {
      s: { r: startRow, c: range.s.c },
      e: { r: endRow, c: range.e.c },
    },
  }) as unknown[][];
  const analysis = analyzeRows({
    headers: params.headers,
    rows: Array.isArray(rows) ? rows : [],
    mapping: params.mapping,
    firstDataRowNo: startRow + 1,
  });

  return {
    batchIndex: params.batchIndex,
    firstRowNumber: startRow + 1,
    sourceRowCount: endRow - startRow + 1,
    summary: analysis.summary,
    structuralErrors: analysis.structural_errors,
    warnings: analysis.warnings,
  };
}
