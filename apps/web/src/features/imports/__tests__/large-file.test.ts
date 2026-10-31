import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeRows, autoMapping, MAX_IMPORT_ROWS, type ColumnMapping } from "@import-domain";
import { IMPORT_MAX_BYTES, IMPORT_MAX_MB, IMPORT_MAX_ROWS } from "../lib/import-limits";
import { readWorkbookFile } from "../lib/analysis";
import {
  getWorkbookWorksheetNames,
  inspectWorkbookSheet,
  parseWorkbookBuffer,
  processWorkbookBatch,
  readWorkbookWithSheetRecovery,
  type ParsedSheet,
} from "../lib/workbook-engine";
import { workbookClient } from "../lib/workbook-client";

/**
 * Large-file performance and limit coverage.
 *
 * These tests pin down the behaviours that keep a 1,000,000-row import from
 * freezing the tab or silently exceeding its caps:
 *   - the mapping preview never materializes the full sheet (bounded sniff),
 *   - the byte and row caps are enforced with clear messages,
 *   - limits are configurable via env without touching shared code,
 *   - invalid workbooks fail with a clear error instead of crashing.
 */

const HEADERS = ["HH_ID", "ENTRY_ID", "FIRST_NAME", "LAST_NAME", "GRANTEE"];

// jsdom ships crypto.getRandomValues but not crypto.subtle; Node provides the
// real WebCrypto, so backfill it so the workbook hash path can run.
async function ensureSubtleCrypto() {
  if (!(globalThis.crypto as any)?.subtle) {
    const { webcrypto } = await import("node:crypto");
    Object.defineProperty(globalThis.crypto, "subtle", {
      value: (webcrypto as any).subtle,
      configurable: true,
    });
  }
}

// Some jsdom versions omit Blob/File.arrayBuffer; backfill it with FileReader so
// the workbook-open path can read file bytes in tests.
function ensureFileArrayBuffer() {
  if (typeof File !== "undefined" && typeof File.prototype.arrayBuffer !== "function") {
    Object.defineProperty(File.prototype, "arrayBuffer", {
      configurable: true,
      writable: true,
      value(this: Blob) {
        return new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = () => reject(reader.error ?? new Error("File read failed."));
          reader.readAsArrayBuffer(this);
        });
      },
    });
  }
}

/** Build an in-memory workbook whose first sheet claims `extentRows` rows (5 cols). */
function sheetWithExtent(rows: unknown[][], extentRows: number, utils: any): ParsedSheet {
  const sheet = utils.aoa_to_sheet(rows);
  // Force a huge used-range (matching HEADERS' 5 columns) so the reader must
  // treat it as a large sheet without widening the column count.
  sheet["!ref"] = `A1:E${extentRows}`;
  return {
    workbook: { SheetNames: ["Data"], Sheets: { Data: sheet } },
    utils,
    sheetNames: ["Data"],
    unavailableSheetNames: [],
  };
}

describe("large-file mapping preview", () => {
  it("uses readable worksheets and reports worksheets missing parsed data", () => {
    expect(
      getWorkbookWorksheetNames({
        SheetNames: ["Sheet1", "Sheet2"],
        Sheets: { Sheet2: { "!ref": "A1:A2" } },
      }),
    ).toEqual({
      sheetNames: ["Sheet2"],
      unavailableSheetNames: ["Sheet1"],
    });
  });

  it("recovers unavailable worksheets in a single batch pass", () => {
    const sheet1 = { "!ref": "A1:A2" };
    const sheet2 = { "!ref": "A1:A2" };
    const read = vi.fn(
      (_buffer: ArrayBuffer, options: { sheets?: string | string[] }) => {
        const requested =
          Array.isArray(options.sheets) ? options.sheets : options.sheets ? [options.sheets] : [];
        if (requested.includes("Sheet1")) {
          return { SheetNames: ["Sheet1", "Sheet2"], Sheets: { Sheet1: sheet1 } };
        }
        return { SheetNames: ["Sheet1", "Sheet2"], Sheets: { Sheet2: sheet2 } };
      },
    );

    const result = readWorkbookWithSheetRecovery(
      { read } as unknown as typeof import("xlsx"),
      new ArrayBuffer(8),
    );

    expect(read).toHaveBeenCalledTimes(2);
    // Batch recovery passes all unavailable sheet names at once.
    expect(read.mock.calls[1]?.[1]?.sheets).toEqual(["Sheet1"]);
    expect(result.sheetNames).toEqual(["Sheet1", "Sheet2"]);
    expect(result.unavailableSheetNames).toEqual([]);
    expect(result.workbook.Sheets.Sheet1).toBe(sheet1);
    expect(result.workbook.Sheets.Sheet2).toBe(sheet2);
  });

  it("explains when a workbook lists a sheet but has no parsed sheet data", async () => {
    const XLSX = await import("xlsx");
    const parsed: ParsedSheet = {
      workbook: { SheetNames: ["Data"], Sheets: {} },
      utils: XLSX.utils,
      sheetNames: ["Data"],
      unavailableSheetNames: [],
    };

    expect(() => inspectWorkbookSheet(parsed, "Data")).toThrow(
      /lists "Data".*Parsed worksheets: none/,
    );
  });

  it("bounds the read instead of materializing a 1,000,000-row sheet", async () => {
    const XLSX = await import("xlsx");
    const rows = [HEADERS, ["A", "A1", "Ana", "Cruz", "Yes"]];
    const recorded: any[] = [];
    const utils = {
      ...XLSX.utils,
      sheet_to_json: (...args: any[]) => {
        recorded.push(args[1]);
        return (XLSX.utils as any).sheet_to_json(...args);
      },
    };

    const parsed = sheetWithExtent(rows, 1_000_000, utils);
    const inspection = inspectWorkbookSheet(parsed, "Data");

    // The only sheet_to_json call must be range-capped to the sniff window,
    // never the full million rows — this is what keeps the UI responsive.
    expect(recorded).toHaveLength(1);
    const options = recorded[0];
    expect(options.range).toBeDefined();
    expect(options.range.e.r).toBeLessThan(200);

    // Row count still reflects the full sheet extent (accurate to last cell).
    expect(inspection.rowCount).toBe(999_999);
    expect(inspection.dataRowCount).toBe(999_999);
    // Header detection and samples still work from the sniffed rows.
    expect(inspection.headerRow).toBe(0);
    expect(inspection.headers).toEqual(HEADERS);
    // Samples are capped at 5 raw rows below the header (blank rows retained).
    expect(inspection.sampleRows.length).toBeLessThanOrEqual(5);
  });

  it("reads a normal sheet fully and keeps the exact non-blank count", async () => {
    const XLSX = await import("xlsx");
    const rows = [
      HEADERS,
      ["A", "A1", "Ana", "Cruz", "Yes"],
      [null, null, null, null, null], // blank data row
      ["B", "B1", "Ben", "Reyes", "No"],
    ];
    const recorded: any[] = [];
    const utils = {
      ...XLSX.utils,
      sheet_to_json: (...args: any[]) => {
        recorded.push(args[1]);
        return (XLSX.utils as any).sheet_to_json(...args);
      },
    };

    const parsed: ParsedSheet = {
      workbook: { SheetNames: ["Data"], Sheets: { Data: utils.aoa_to_sheet(rows) } },
      utils,
      sheetNames: ["Data"],
      unavailableSheetNames: [],
    };
    const inspection = inspectWorkbookSheet(parsed, "Data");

    // Small sheet: no range cap, exact blank-filtered count.
    expect(recorded[0].range).toBeUndefined();
    expect(inspection.rowCount).toBe(2);
    // Samples are the raw rows below the header (blank rows are retained here;
    // only the count filters them).
    expect(inspection.sampleRows).toHaveLength(3);
  });

  it("sniffs a 1,000,000-row sheet quickly without crashing", async () => {
    const XLSX = await import("xlsx");
    const rows = [HEADERS, ["A", "A1", "Ana", "Cruz", "Yes"]];
    const parsed = sheetWithExtent(rows, 1_000_000, XLSX.utils);

    const started = performance.now();
    const inspection = inspectWorkbookSheet(parsed, "Data");
    const elapsed = performance.now() - started;

    expect(inspection.rowCount).toBe(999_999);
    // Bounded sniff keeps this effectively instant; a full materialization of a
    // million rows would blow well past this generous guard.
    expect(elapsed).toBeLessThan(2000);
  });

  it("processes bounded batches with stable worksheet row numbers", async () => {
    const XLSX = await import("xlsx");
    const rows = [
      HEADERS,
      ["A", "A1", "Ana", "Cruz", "Yes"],
      [null, null, null, null, null],
      ["B", "B1", "Ben", "Reyes", "No"],
      ["C", "C1", "Cia", "Santos", "No"],
    ];
    const parsed: ParsedSheet = {
      workbook: { SheetNames: ["Data"], Sheets: { Data: XLSX.utils.aoa_to_sheet(rows) } },
      utils: XLSX.utils,
      sheetNames: ["Data"],
      unavailableSheetNames: [],
    };
    const inspection = inspectWorkbookSheet(parsed, "Data");

    const first = processWorkbookBatch(parsed, {
      sheetName: "Data",
      headerRow: 0,
      headers: inspection.headers,
      mapping: inspection.mapping,
      batchIndex: 0,
      batchSize: 2,
    });
    const second = processWorkbookBatch(parsed, {
      sheetName: "Data",
      headerRow: 0,
      headers: inspection.headers,
      mapping: inspection.mapping,
      batchIndex: 1,
      batchSize: 2,
    });

    expect(first.firstRowNumber).toBe(2);
    expect(first.sourceRowCount).toBe(2);
    expect(first.summary.total_rows).toBe(1);
    expect(first.summary.skipped_blank_rows).toBe(1);
    expect(second.firstRowNumber).toBe(4);
    expect(second.sourceRowCount).toBe(2);
    expect(second.summary.total_rows).toBe(2);
  });
});

describe("import limits", () => {
  it("defaults to 100 MB and 1,000,000 rows", async () => {
    vi.resetModules();
    const mod = await import("../lib/import-limits");
    expect(mod.IMPORT_MAX_MB).toBe(100);
    expect(mod.IMPORT_MAX_BYTES).toBe(100 * 1024 * 1024);
    expect(mod.IMPORT_MAX_ROWS).toBe(1_000_000);
    expect(MAX_IMPORT_ROWS).toBe(1_000_000);
  });

  it("honours env overrides", async () => {
    vi.stubEnv("VITE_IMPORT_MAX_MB", "25");
    vi.stubEnv("VITE_IMPORT_MAX_ROWS", "50000");
    vi.resetModules();
    try {
      const mod = await import("../lib/import-limits");
      expect(mod.IMPORT_MAX_MB).toBe(25);
      expect(mod.IMPORT_MAX_BYTES).toBe(25 * 1024 * 1024);
      expect(mod.IMPORT_MAX_ROWS).toBe(50000);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("falls back to the default when an env override is invalid", async () => {
    vi.stubEnv("VITE_IMPORT_MAX_MB", "-5");
    vi.stubEnv("VITE_IMPORT_MAX_ROWS", "not-a-number");
    vi.resetModules();
    try {
      const mod = await import("../lib/import-limits");
      expect(mod.IMPORT_MAX_MB).toBe(100);
      expect(mod.IMPORT_MAX_ROWS).toBe(1_000_000);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("rejects a workbook over the byte cap with a clear MB message", async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])], "huge.xlsx");
    Object.defineProperty(file, "size", { value: 150 * 1024 * 1024, configurable: true });

    await expect(workbookClient.open(file)).rejects.toThrow(/limit is 100 MB/);
  });

  it("blocks a sheet over the row cap as a structural error", () => {
    const mapping: ColumnMapping = autoMapping(HEADERS);
    const overLimit = Array.from({ length: 5 }, (_, i) => [
      "A",
      `E${i}`,
      "Ana",
      "Cruz",
      "Yes",
    ]);
    const analysis = analyzeRows({ headers: HEADERS, rows: overLimit, mapping, maxRows: 4 });
    const rowLimit = analysis.structural_errors.find((issue) => issue.code === "row_limit");
    expect(rowLimit).toBeDefined();
    expect(rowLimit?.message).toContain("the limit is 4");
    expect(analysis.ok).toBe(false);
  });
});

describe("invalid workbooks", () => {
  beforeEach(() => {
    void ensureSubtleCrypto();
    ensureFileArrayBuffer();
  });

  it("fails with a clear message on corrupt bytes instead of crashing", async () => {
    // Not a valid zip (xlsx) or OLE (xls) container.
    const corrupt = new Uint8Array(16).fill(0x01);
    await expect(parseWorkbookBuffer(corrupt.buffer as ArrayBuffer)).rejects.toThrow(
      /not a valid Excel workbook|could not be opened|no worksheets/i,
    );
  });

  it("parses a real workbook end-to-end through the main-thread fallback", async () => {
    await ensureSubtleCrypto();
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.aoa_to_sheet([
      HEADERS,
      ["A", "A1", "Ana", "Cruz", "Yes"],
      ["B", "B1", "Ben", "Reyes", "No"],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Households");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    const file = new File([bytes], "households.xlsx");
    const opened = await workbookClient.open(file);
    expect(opened.sheetNames).toEqual(["Households"]);
    expect(opened.fileHash).toMatch(/^[0-9a-f]{64}$/);

    // jsdom has no Worker, so this exercises the identical main-thread fallback.
    const inspection = await workbookClient.inspect("Households");
    expect(inspection.headers).toEqual(HEADERS);
    expect(inspection.rowCount).toBe(2);
  });

  it("restarts the parser once when a worksheet is missing from the first parse", async () => {
    const file = new File(["workbook"], "households.xlsx");
    const open = vi.spyOn(workbookClient, "open");
    open
      .mockResolvedValueOnce({
        fileHash: "a".repeat(64),
        size: file.size,
        sheetNames: ["Sheet2"],
        unavailableSheetNames: ["Sheet1"],
      })
      .mockResolvedValueOnce({
        fileHash: "a".repeat(64),
        size: file.size,
        sheetNames: ["Sheet1", "Sheet2"],
        unavailableSheetNames: [],
      });

    const result = await readWorkbookFile(file);

    expect(open).toHaveBeenCalledTimes(2);
    expect(result.sheetNames).toEqual(["Sheet1", "Sheet2"]);
    expect(result.unavailableSheetNames).toEqual([]);
  });

  it("keeps the newest workbook when file reads finish out of order", async () => {
    await ensureSubtleCrypto();
    const XLSX = await import("xlsx");
    const makeFile = (name: string, header: string) => {
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet([[header], ["value"]]),
        "Data",
      );
      const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
      return new File([bytes], name);
    };

    const olderFile = makeFile("older.xlsx", "OLDER_WORKBOOK");
    const newerFile = makeFile("newer.xlsx", "NEWER_WORKBOOK");
    const readOlderFile = olderFile.arrayBuffer.bind(olderFile);
    let finishOlderRead!: (buffer: ArrayBuffer) => void;
    Object.defineProperty(olderFile, "arrayBuffer", {
      value: () =>
        new Promise<ArrayBuffer>((resolve) => {
          finishOlderRead = resolve;
        }),
    });

    const olderOpen = workbookClient.open(olderFile);
    const olderRejected = expect(olderOpen).rejects.toThrow("Cancelled.");
    const newerOpen = await workbookClient.open(newerFile);
    finishOlderRead(await readOlderFile());
    await olderRejected;

    expect(newerOpen.sheetNames).toEqual(["Data"]);
    await expect(workbookClient.inspect("Data")).resolves.toMatchObject({
      headers: ["NEWER_WORKBOOK"],
    });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  workbookClient.cancel();
});
