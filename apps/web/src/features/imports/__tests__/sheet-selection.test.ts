import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import * as XLSX from "xlsx";
import { autoMapping, DEFAULT_REQUIRED_COLUMNS } from "@import-domain";
import "fake-indexeddb/auto";
import { useImportWizard } from "../hooks/useImportWizard";
import { inspectInitialSheet } from "../lib/analysis";
import { workbookClient } from "../lib/workbook-client";
import {
  explainSheetReadError,
  inspectWorkbookSheet,
  parseWorkbookBuffer,
  readWorkbookWithSheetRecovery,
  type ParsedSheet,
} from "../lib/workbook-engine";

// jsdom's File/Blob may not implement arrayBuffer(); the demo backend reads
// the uploaded file during preview. Backfill it with FileReader (same pattern
// as large-file.test.ts).
if (typeof File !== "undefined" && typeof File.prototype.arrayBuffer !== "function") {
  Object.defineProperty(File.prototype, "arrayBuffer", {
    writable: true,
    configurable: true,
    value(this: File): Promise<ArrayBuffer> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error ?? new Error("read_failed"));
        reader.readAsArrayBuffer(this);
      });
    },
  });
}

function buildWorkbookBytes(sheets: Record<string, unknown[][]>): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows as any[][]), name);
  }
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

/**
 * Rename xl/worksheets/sheetN.xml to sheet9.xml in the zip's local header AND
 * central directory, simulating a workbook that DECLARES the sheet but has no
 * worksheet part for it (the real-world "could not be read" case).
 */
function indexOfSubarray(haystack: Uint8Array, needle: Uint8Array, from: number): number {
  const limit = haystack.length - needle.length;
  outer: for (let i = Math.max(0, from); i <= limit; i += 1) {
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function renameSheetEntry(bytes: ArrayBuffer, sheetFile: string): ArrayBuffer {
  const buf = new Uint8Array(bytes.slice(0));
  const needle = new TextEncoder().encode(`xl/worksheets/${sheetFile}`);
  const digitIndex = needle.length - "9.xml".length; // position of "1" in "sheet1.xml"
  let renamed = 0;
  let idx = indexOfSubarray(buf, needle, 0);
  while (idx >= 0) {
    const view = new DataView(buf.buffer);
    const local = idx - 30;
    const central = idx - 46;
    const isLocal =
      local >= 0 &&
      view.getUint32(local, true) === 0x04034b50 &&
      view.getUint16(local + 26, true) === needle.length;
    const isCentral =
      central >= 0 &&
      view.getUint32(central, true) === 0x02014b50 &&
      view.getUint16(central + 46, true) === needle.length;
    if (isLocal || isCentral) {
      buf[idx + digitIndex] = "9".charCodeAt(0);
      renamed += 1;
    }
    idx = indexOfSubarray(buf, needle, idx + 1);
  }
  if (renamed === 0) throw new Error(`no zip headers found for ${sheetFile}`);
  return buf.buffer;
}

const ANNEX_HEADERS = [
  "HH_ID",
  "ENTRY_ID",
  "FIRST_NAME",
  "LAST_NAME",
  "GRANTEE",
  "RELATION",
  "ADDRESS",
];
const DATA_ROWS = [
  ANNEX_HEADERS,
  ["0001", "E1", "Ana", "Cruz", "Yes", "Head", "Purok 1"],
  ["0002", "E2", "Ben", "Santos", "No", "Spouse", "Purok 2"],
];

describe("workbook whose data sheet is Sheet2, not Sheet1", () => {
  it("auto-opens the sheet with data and imports it end to end", async () => {
    const bytes = buildWorkbookBytes({ Sheet1: [], Sheet2: DATA_ROWS });
    const file = new File([bytes], "Annex C - October 2026.xlsx");

    const { result, unmount } = renderHook(() => useImportWizard({ userId: "operator-1" }));

    await act(async () => {
      await result.current.chooseFile(file);
    });

    await waitFor(() => expect(result.current.stage).toBe("shape"));
    // Sheet1 is empty -> the wizard must open Sheet2 on its own.
    expect(result.current.sheet?.sheetName).toBe("Sheet2");
    expect(result.current.sheet?.headers).toEqual(ANNEX_HEADERS);
    expect(result.current.coverage.missing).toEqual([]);
    // The auto-switch is explained to the operator.
    expect(result.current.storeNotice?.title).toMatch(/selected automatically/i);
    expect(result.current.storeNotice?.detail).toContain("Sheet2");

    // Process worker batches (required before validation).
    await act(async () => {
      await result.current.processRows();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.batchProgress?.completedBatches).toBe(1);

    // Validate -> the server preview must analyze Sheet2.
    await act(async () => {
      await result.current.validate();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.stage).toBe("preview");
    expect(result.current.preview?.sheet_name).toBe("Sheet2");
    expect(result.current.preview?.rows.length).toBe(2);

    await act(async () => {
      await result.current.commit();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.stage).toBe("committed");
    unmount();
  }, 60_000);

  it("keeps Sheet1 when it is the real table (normal workbooks unchanged)", async () => {
    const bytes = buildWorkbookBytes({ Sheet1: DATA_ROWS, Sheet2: [["other"]] });
    const file = new File([bytes], "normal.xlsx");

    const { result, unmount } = renderHook(() => useImportWizard({ userId: "operator-1" }));
    await act(async () => {
      await result.current.chooseFile(file);
    });
    await waitFor(() => expect(result.current.stage).toBe("shape"));
    expect(result.current.sheet?.sheetName).toBe("Sheet1");
    expect(result.current.storeNotice).toBeNull();
    unmount();
  }, 60_000);

  it("skips a title-only cover sheet when picking the default worksheet", async () => {
    const bytes = buildWorkbookBytes({
      Sheet1: [["Annex C — Household Listing"], ["generated 2026-10-31"]],
      Sheet2: DATA_ROWS,
    });
    const file = new File([bytes], "cover.xlsx");

    const { result, unmount } = renderHook(() => useImportWizard({ userId: "operator-1" }));
    await act(async () => {
      await result.current.chooseFile(file);
    });
    await waitFor(() => expect(result.current.stage).toBe("shape"));
    expect(result.current.sheet?.sheetName).toBe("Sheet2");
    unmount();
  }, 60_000);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("damaged or unreadable worksheets", () => {
  it("degrades a sheet whose cells throw during read instead of failing the import", async () => {
    const bytes = buildWorkbookBytes({ Sheet1: DATA_ROWS, Sheet2: DATA_ROWS });
    const parsed = await parseWorkbookBuffer(bytes);

    // Poison Sheet1 so every sheet_to_json call on it throws, simulating the
    // malformed cells SheetJS rejects inside the formatter.
    const original = parsed.utils.sheet_to_json.bind(parsed.utils);
    (parsed.workbook.Sheets.Sheet1 as any).__poisoned = true;
    const poisoned: ParsedSheet = {
      ...parsed,
      utils: {
        ...parsed.utils,
        sheet_to_json: (ws: any, options?: any) => {
          if (ws?.__poisoned) throw new Error("Cannot read damaged sheet");
          return original(ws, options);
        },
      } as typeof parsed.utils,
    };

    const broken = inspectWorkbookSheet(poisoned, "Sheet1");
    expect(broken.readError).toBeTruthy();
    expect(broken.headers).toEqual([]);

    // The readable sheet in the same workbook still works.
    const healthy = inspectWorkbookSheet(poisoned, "Sheet2");
    expect(healthy.readError).toBeFalsy();
    expect(healthy.headers).toEqual(ANNEX_HEADERS);
  });

  it("skips the first worksheet when its inspection throws and opens the readable one", async () => {
    const good = (name: string) => ({
      sheetName: name,
      headerRow: 0,
      detectedHeaderRow: 0,
      headers: ANNEX_HEADERS,
      sampleRows: DATA_ROWS.slice(1),
      mapping: autoMapping(ANNEX_HEADERS, DEFAULT_REQUIRED_COLUMNS),
      rowCount: 2,
      dataRowCount: 2,
      readError: null,
    });

    vi.spyOn(workbookClient, "inspect").mockImplementation(async (name: string) => {
      if (name === "Sheet1") throw new Error("The workbook lists \"Sheet1\", but its worksheet data was not available after parsing.");
      return good(name);
    });

    const choice = await inspectInitialSheet(["Sheet1", "Sheet2"]);
    expect(choice.inspection.sheetName).toBe("Sheet2");
    expect(choice.autoSwitched).toBe(true);
  });

  it("surfaces the real reason a worksheet part cannot be read (missing part)", async () => {
    // Simulate a workbook that DECLARES Sheet1 but has no worksheet part for
    // it: rename the zip entry to a name nothing references. The app must
    // report Sheet1 as unavailable AND carry the specific cause, not a
    // generic dead-end message.
    const bytes = renameSheetEntry(
      buildWorkbookBytes({ Sheet1: DATA_ROWS, Sheet2: DATA_ROWS }),
      "sheet1.xml",
    );

    const parsed = await parseWorkbookBuffer(bytes);

    expect(parsed.sheetNames).toEqual(["Sheet2"]);
    expect(parsed.unavailableSheetNames).toEqual(["Sheet1"]);
    expect(parsed.sheetReadErrors?.Sheet1).toContain("sheet1.xml");
  });

  it("rescues a sheet rejected by the browser's property limit via dense mode", async () => {
    // Safari/Firefox throw "Too many properties to enumerate" on worksheets
    // whose used range is enormous (usually stray formatting across a million
    // empty rows) because normal mode stores every cell in ONE object. Dense
    // mode stores each row as its own array and sidesteps the limit.
    const bytes = buildWorkbookBytes({ Sheet1: DATA_ROWS, Sheet2: DATA_ROWS });
    const denseSheet = (
      XLSX.read(bytes, { type: "array", sheets: ["Sheet1"], dense: true }).Sheets as any
    ).Sheet1;
    expect(Array.isArray(denseSheet)).toBe(true);

    // Fake SheetJS: baseline pass leaves Sheet1 missing; every restricted read
    // of it throws the browser size error unless dense mode is requested.
    const attempts: Array<{ sheets?: string[]; dense?: boolean }> = [];
    const fakeXlsx: any = {
      read: (buf: ArrayBuffer, opts: any = {}) => {
        attempts.push({ sheets: opts.sheets, dense: opts.dense });
        if (!opts.sheets) {
          const wb = XLSX.read(buf, { type: "array" });
          delete (wb.Sheets as any).Sheet1;
          return wb;
        }
        if (opts.sheets != null) {
          // The engine passes an array for the batch pass and a string for the
          // per-sheet variants.
          const names: string[] = Array.isArray(opts.sheets) ? opts.sheets : [opts.sheets];
          if (names.includes("Sheet1")) {
            if (!opts.dense) throw new Error("Too many properties to enumerate");
            return { SheetNames: ["Sheet1"], Sheets: { Sheet1: denseSheet } };
          }
        }
        return XLSX.read(buf, opts);
      },
    };

    const parsed = readWorkbookWithSheetRecovery(fakeXlsx, bytes);

    // Sheet1 came back — fully readable, not truncated.
    expect(parsed.sheetNames).toContain("Sheet1");
    expect(parsed.unavailableSheetNames).toEqual([]);
    // Dense mode was actually used, and the slow plain variants were skipped
    // once the size error was seen.
    expect(attempts.some((a) => a.dense)).toBe(true);
    expect(attempts.some((a) => !a.dense && a.sheets?.includes("Sheet1"))).toBe(true);

    // The dense sheet is interchangeable with a normal one for inspection.
    const inspection = inspectWorkbookSheet({ ...parsed, utils: XLSX.utils } as ParsedSheet, "Sheet1");
    expect(inspection.readError).toBeFalsy();
    expect(inspection.headers).toEqual(ANNEX_HEADERS);
    expect(inspection.dataRowCount).toBe(2);
  });

  it("explains the browser property-limit error with concrete Excel fix steps", () => {
    const friendly = explainSheetReadError(new Error("Too many properties to enumerate"));
    expect(friendly).toContain("Ctrl+End");
    expect(friendly).toContain("formatting");
    // The parser detail is preserved for support/diagnosis.
    expect(friendly).toContain("Too many properties to enumerate");
    // Other errors are passed through unchanged.
    expect(explainSheetReadError(new Error("Cannot find file xl/worksheets/sheet1.xml in zip"))).toBe(
      "Cannot find file xl/worksheets/sheet1.xml in zip",
    );
  });

  it("throws the original first-sheet error only when no worksheet can be read", async () => {
    vi.spyOn(workbookClient, "inspect").mockImplementation(async (name: string) => {
      throw new Error(`All ${name} broken`);
    });
    await expect(inspectInitialSheet(["Sheet1", "Sheet2"])).rejects.toThrow("All Sheet1 broken");
  });
});
