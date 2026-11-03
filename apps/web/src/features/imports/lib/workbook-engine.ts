import {
  autoMapping,
  detectHeaderRow,
  DEFAULT_REQUIRED_COLUMNS,
  headersFromRow,
} from "@import-domain";
import type { SheetInspection } from "../types";

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
  /**
   * The worksheets this parse materialized. Parsing is focused on ONE chosen
   * worksheet, so this is always exactly that sheet — the rest of the workbook
   * (including any sibling sheet with a missing or corrupt part) is never read.
   */
  sheetNames: string[];
};

// File signatures for the only two accepted containers (.xlsx = zip, .xls = OLE).
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

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

/**
 * Read ONLY the worksheet names of a workbook — no worksheet data is parsed.
 *
 * This is what "choose a file" does now: a multi-sheet workbook can show its
 * picker (and a single-sheet workbook can proceed) without paying for a parse
 * the operator may never need, and a sibling worksheet with a missing or
 * corrupt part can never block reading the names. `bookSheets` works for both
 * .xlsx and .xls containers.
 */
export function readSheetNamesWith(
  XLSX: typeof import("xlsx"),
  buffer: ArrayBuffer,
): string[] {
  const options = { type: "array" as const, bookSheets: true };
  let workbook: any;
  try {
    workbook = XLSX.read(buffer, options);
  } catch {
    // Same rescue ladder as the old full read: raw mode bypasses some XML
    // validation and cellText mode rescues sheets whose typed values break
    // the normal pass (for names-only reads this rarely triggers, but it
    // costs nothing when the first attempt fails).
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

  const names = Array.isArray(workbook?.SheetNames)
    ? workbook.SheetNames.filter((name: unknown): name is string => typeof name === "string")
    : [];
  if (!names.length) {
    throw new Error("This workbook has no worksheets. Nothing was uploaded.");
  }
  return names;
}

/**
 * The REAL reason a chosen worksheet could not be parsed. SheetJS swallows
 * per-sheet errors unless WTF is set, so one strict focused read is what
 * turns a dead-end "could not be read" into a specific cause ("part missing
 * from the file", a rels error, …). Only runs after every normal attempt
 * failed, never for a readable sheet.
 */
function focusedSheetFailureReason(
  XLSX: typeof import("xlsx"),
  buffer: ArrayBuffer,
  sheetName: string,
): string {
  try {
    XLSX.read(buffer, { type: "array", WTF: true, sheets: [sheetName] });
    return "the file lists this worksheet but contains no worksheet data for it (it may be a chart, form, or macro sheet, or its worksheet part is missing from the file).";
  } catch (error) {
    return explainSheetReadError(error);
  }
}

/**
 * Parse ONE worksheet — the one the operator chose — and nothing else.
 *
 * Every attempt is restricted with SheetJS's `sheets` option, so a workbook
 * with a million-row sibling (or a sibling whose part is missing or corrupt)
 * costs nothing here: only the chosen sheet's cells are read. The attempts
 * ladder through the same option variants as the old full-workbook recovery
 * (cellDates, cellNF, raw, cellText, and dense for the browser's property
 * limit), and a sheet the parser never materializes fails with the specific
 * cause from a WTF read instead of a generic dead end.
 */
export function readSheetWithRecovery(
  XLSX: typeof import("xlsx"),
  buffer: ArrayBuffer,
  sheetName: string,
): ParsedSheet {
  const base = { type: "array" as const, cellDates: false, cellNF: false, sheets: [sheetName] };
  let sawSizeLimit = false;
  for (const variant of [
    base,
    { ...base, cellDates: true },
    { ...base, cellNF: true },
    { ...base, raw: true },
    // cellText mode parses every cell as text, which rescues sheets whose
    // typed values (dates, error cells, broken number formats) break the
    // normal or raw passes — a common cause of one unreadable sheet.
    { ...base, cellText: true },
    { ...base, cellText: true, raw: true },
    // `dense` stores each row as its own small array instead of ONE object
    // holding every cell. Browsers (Safari, Firefox) refuse to build objects
    // with an extreme number of properties — they throw "Too many properties
    // to enumerate" on sheets whose formatting stretches across a million
    // empty rows, no matter how the sheet is read. Dense mode sidesteps the
    // limit entirely and keeps the full data, so it is tried as soon as a
    // size-limit error is seen (each earlier attempt on such a sheet is slow,
    // so the remaining plain modes are skipped past that point).
    // Every utility call (sheet_to_json) auto-detects dense sheets via
    // Array.isArray, so the rest of the pipeline needs no changes.
    { ...base, dense: true },
    { ...base, dense: true, cellText: true },
    { ...base, dense: true, raw: true },
  ]) {
    if (sawSizeLimit && !("dense" in variant)) continue;
    try {
      const workbook = XLSX.read(buffer, variant);
      const sheet = workbook?.Sheets?.[sheetName];
      if (sheet && typeof sheet === "object") {
        return { workbook, utils: XLSX.utils, sheetNames: [sheetName] };
      }
      // A successful read with no worksheet for the chosen name means the
      // part is genuinely absent (a chart/form sheet, or a broken file): no
      // option variant can conjure data that is not there.
      break;
    } catch (error) {
      if (isSheetSizeLimitError(error)) sawSizeLimit = true;
      // Try the next option variant.
    }
  }
  const reason = focusedSheetFailureReason(XLSX, buffer, sheetName);
  throw new Error(
    `The worksheet "${sheetName}" could not be read: ${reason} Copy the data into a new sheet in Excel, save the workbook as .xlsx, and import that copy.`,
  );
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
 * Read only the worksheet names of a workbook — no worksheet data is parsed.
 * Throws a user-facing message when the file is not an Excel container or the
 * workbook cannot be opened at all.
 */
export async function readWorkbookSheetNames(buffer: ArrayBuffer): Promise<string[]> {
  assertWorkbookMagic(new Uint8Array(buffer));

  // Load the spreadsheet parser only when a workbook is actually chosen.
  const XLSX = await import("xlsx");
  return readSheetNamesWith(XLSX, buffer);
}

/**
 * Parse the chosen worksheet only (see readSheetWithRecovery). Throws a
 * user-facing message — including the specific cause — when that worksheet
 * cannot be read; the other worksheets are never touched, so a broken sibling
 * sheet can never block importing this one. Callers own the returned
 * workbook's lifetime (and should release it when the import session ends).
 */
export async function parseWorkbookSheet(
  buffer: ArrayBuffer,
  sheetName: string,
): Promise<ParsedSheet> {
  assertWorkbookMagic(new Uint8Array(buffer));

  const XLSX = await import("xlsx");
  return readSheetWithRecovery(XLSX, buffer, sheetName);
}

export type ExtractedSheet = {
  /** Bytes of a fresh single-sheet workbook holding only `sheetName`. */
  bytes: ArrayBuffer;
  /** SHA-256 of `bytes` — the fingerprint the server verifies on upload. */
  hash: string;
};

/**
 * Re-serialize ONE worksheet into a new single-sheet workbook.
 *
 * This is how a workbook larger than the upload cap still imports: only the
 * worksheet the operator chose is uploaded, so the size limit applies to the
 * sheet being imported — extra sheets, formatting, and images never count
 * against it. SheetJS writes deterministic bytes for identical input, so
 * re-extracting the same sheet in a later session yields the same hash:
 * resume, content-addressed storage paths, and duplicate detection keep
 * working exactly as before. Cell values survive the round trip untouched
 * (the server re-reads and validates them from these bytes regardless).
 */
export async function extractSheetWorkbook(
  buffer: ArrayBuffer,
  sheetName: string,
): Promise<ExtractedSheet> {
  assertWorkbookMagic(new Uint8Array(buffer));
  const XLSX = await import("xlsx");
  const parsed = readSheetWithRecovery(XLSX, buffer, sheetName);
  const sheet = parsed.workbook?.Sheets?.[sheetName];
  if (!sheet || typeof sheet !== "object") {
    throw new Error(
      `The worksheet "${sheetName}" could not be extracted from the workbook. Copy it into a new sheet in Excel, save the workbook as .xlsx, and try again.`,
    );
  }
  const single = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(single, sheet, sheetName);
  const bytes = XLSX.write(single, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return { bytes, hash: await sha256Hex(bytes) };
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
