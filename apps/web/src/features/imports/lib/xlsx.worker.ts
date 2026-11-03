/// <reference lib="webworker" />
import {
  extractSheetWorkbook,
  inspectWorkbookSheet,
  parseWorkbookSheet,
  readWorkbookSheetNames,
  sha256Hex,
  type ParsedSheet,
} from "./workbook-engine";

/**
 * Background workbook reader.
 *
 * Opening a workbook here reads ONLY its worksheet names (plus the file hash)
 * — no worksheet data is parsed until the main thread asks for one specific
 * sheet. When it does, this worker parses just that worksheet: the parsed
 * worksheet lives ONLY inside this worker for the lifetime of the import
 * session. The main thread never receives it — it would be pointless (and
 * expensive) to structured-clone a 1,000,000-row worksheet across the thread
 * boundary, which would simply move the freeze back onto the UI. Instead the
 * main thread asks this worker to inspect a sheet and gets back a small
 * plain-data SheetInspection.
 *
 * The raw bytes are retained so switching worksheets re-parses only the newly
 * chosen sheet; the previously parsed sheet is dropped to free memory.
 *
 * Protocol (main -> worker):
 *   { type: "open",    id, buffer, fileName, size }            // names only
 *   { type: "inspect", id, sheetName, headerRow? }             // focused parse + inspect
 *   { type: "extract", id, sheetName }                         // single-sheet copy for upload
 *   { type: "release" }            drop bytes and parsed sheet, free memory
 *
 * Protocol (worker -> main):
 *   { type: "progress", id, stage }
 *   { type: "opened",   id, fileHash, size, sheetNames }
 *   { type: "inspected",id, inspection }
 *   { type: "extracted",id, buffer, hash, size }
 *   { type: "error",    id, message, retryable }
 */

type OpenRequest = {
  type: "open";
  id: number;
  buffer: ArrayBuffer;
  fileName: string;
  size: number;
};

type InspectRequest = {
  type: "inspect";
  id: number;
  sheetName: string;
  headerRow?: number;
};

type ExtractRequest = {
  type: "extract";
  id: number;
  sheetName: string;
};

type ReleaseRequest = { type: "release" };

type WorkerRequest = OpenRequest | InspectRequest | ExtractRequest | ReleaseRequest;

type WorkerResponse =
  | { type: "progress"; id: number; stage: "hashing" | "parsing" | "sheet" | "ready" }
  | {
      type: "opened";
      id: number;
      fileHash: string;
      size: number;
      sheetNames: string[];
    }
  | { type: "inspected"; id: number; inspection: ReturnType<typeof inspectWorkbookSheet> }
  | { type: "extracted"; id: number; buffer: ArrayBuffer; hash: string; size: number }
  | { type: "error"; id: number; message: string; retryable: boolean };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

/** Raw bytes of the open workbook, kept so each chosen sheet can be parsed on demand. */
let buffer: ArrayBuffer | null = null;
/** The single worksheet parsed so far, if any. Switching sheets drops the previous one. */
let focused: { sheetName: string; parsed: ParsedSheet } | null = null;

function post(message: WorkerResponse, transfer: Transferable[] = []) {
  ctx.postMessage(message, transfer);
}

function fail(id: number, error: unknown, retryable: boolean) {
  const message =
    error instanceof Error && error.message
      ? error.message
      : "The workbook could not be read. Try a different file.";
  post({ type: "error", id, message, retryable });
}

function isBlankBuffer(bytes: ArrayBuffer): boolean {
  return bytes.byteLength < 8;
}

async function handleOpen(request: OpenRequest): Promise<void> {
  const { id, size } = request;
  const bytes = request.buffer;

  // Release any workbook from a previous session before opening a new one.
  buffer = null;
  focused = null;

  if (isBlankBuffer(bytes)) {
    fail(id, new Error("This file is empty or too small to be a valid Excel workbook."), false);
    return;
  }

  // NOTE: no whole-file size check here on purpose. The upload cap applies to
  // what gets uploaded — the workbook when it fits, otherwise just the sheet
  // being imported (see upload-target.ts) — so a large workbook must still
  // open, list its sheets, and let the operator pick one.

  try {
    post({ type: "progress", id, stage: "hashing" });
    const fileHash = await sha256Hex(bytes);

    // Names only: no worksheet data is parsed until a sheet is chosen.
    post({ type: "progress", id, stage: "parsing" });
    const sheetNames = await readWorkbookSheetNames(bytes);

    buffer = bytes;
    post({ type: "progress", id, stage: "ready" });
    post({ type: "opened", id, fileHash, size, sheetNames });
  } catch (error) {
    buffer = null;
    focused = null;
    // An open failure on a well-formed-size file is usually a corrupt or
    // unsupported workbook; retrying the same file rarely helps.
    fail(id, error, false);
  }
}

async function handleInspect(request: InspectRequest): Promise<void> {
  const { id, sheetName, headerRow } = request;
  if (!buffer) {
    fail(id, new Error("No workbook is loaded. Choose a file first."), true);
    return;
  }
  try {
    let parsed = focused?.sheetName === sheetName ? focused.parsed : null;
    if (!parsed) {
      // Parse just this worksheet. Sibling sheets — even broken ones — are
      // never read, and the previously parsed sheet is dropped below.
      post({ type: "progress", id, stage: "sheet" });
      parsed = await parseWorkbookSheet(buffer, sheetName);
      focused = { sheetName, parsed };
    }
    const inspection = inspectWorkbookSheet(parsed, sheetName, headerRow);
    post({ type: "inspected", id, inspection });
  } catch (error) {
    // A sheet-level failure is specific to the chosen worksheet; the message
    // already carries the real cause, so mark it non-retryable.
    fail(id, error, false);
  }
}

/**
 * Build a single-sheet copy of the chosen worksheet for upload. Used when the
 * whole workbook exceeds the upload cap: only the imported sheet is sent, so
 * the limit applies to the sheet's data rather than the entire file. The bytes
 * are transferred (not cloned) back to the main thread.
 */
async function handleExtract(request: ExtractRequest): Promise<void> {
  const { id, sheetName } = request;
  if (!buffer) {
    fail(id, new Error("No workbook is loaded. Choose a file first."), true);
    return;
  }
  try {
    post({ type: "progress", id, stage: "sheet" });
    const extracted = await extractSheetWorkbook(buffer, sheetName);
    const size = extracted.bytes.byteLength;
    post(
      { type: "extracted", id, buffer: extracted.bytes, hash: extracted.hash, size },
      [extracted.bytes],
    );
  } catch (error) {
    // Extraction reuses the focused-parse errors, which already carry the
    // real cause for this specific worksheet.
    fail(id, error, false);
  }
}

function release() {
  buffer = null;
  focused = null;
}

ctx.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  switch (request.type) {
    case "open":
      void handleOpen(request);
      return;
    case "inspect":
      void handleInspect(request);
      return;
    case "extract":
      void handleExtract(request);
      return;
    case "release":
      release();
      return;
    default:
      return;
  }
});

// A thrown error inside the worker (e.g. out-of-memory during a huge parse)
// surfaces here so the main thread can show a friendly message instead of a
// silently dead worker.
ctx.addEventListener("error", (event) => {
  post({
    type: "error",
    id: -1,
    message:
      event?.message ||
      "The workbook ran out of memory while reading. Try a smaller file or split the workbook.",
    retryable: true,
  });
});
