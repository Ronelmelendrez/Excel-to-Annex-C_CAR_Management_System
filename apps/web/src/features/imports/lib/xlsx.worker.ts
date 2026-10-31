/// <reference lib="webworker" />
import {
  inspectWorkbookSheet,
  parseWorkbookBuffer,
  processWorkbookBatch,
  sha256Hex,
  type ParsedSheet,
} from "./workbook-engine";
import type { ColumnMapping } from "@import-domain";
import type { WorkbookBatchResult } from "../types";

/**
 * Background workbook parser.
 *
 * The parsed SheetJS workbook lives ONLY inside this worker for the lifetime of
 * the import session. The main thread never receives it — it would be pointless
 * (and expensive) to structured-clone a 1,000,000-row workbook across the
 * thread boundary, which would simply move the freeze back onto the UI. Instead
 * the main thread asks this worker to inspect a sheet and gets back a small
 * plain-data SheetInspection.
 *
 * Protocol (main -> worker):
 *   { type: "parse",    id, buffer, fileName, size, maxBytes }
 *   { type: "inspect",  id, sheetName, headerRow? }
 *   { type: "release" }            drop the parsed workbook and free memory
 *
 * Protocol (worker -> main):
 *   { type: "progress", id, stage }
 *   { type: "parsed",   id, fileHash, size, sheetNames }
 *   { type: "inspected",id, inspection }
 *   { type: "error",    id, message, retryable }
 */

type ParseRequest = {
  type: "parse";
  id: number;
  buffer: ArrayBuffer;
  fileName: string;
  size: number;
  maxBytes: number;
};

type InspectRequest = {
  type: "inspect";
  id: number;
  sheetName: string;
  headerRow?: number;
};

type BatchRequest = {
  type: "batch";
  id: number;
  sheetName: string;
  headerRow: number;
  headers: string[];
  mapping: ColumnMapping;
  batchIndex: number;
  batchSize: number;
};

type ReleaseRequest = { type: "release" };

type WorkerRequest = ParseRequest | InspectRequest | BatchRequest | ReleaseRequest;

type WorkerResponse =
  | { type: "progress"; id: number; stage: "hashing" | "parsing" | "ready" }
  | {
      type: "parsed";
      id: number;
      fileHash: string;
      size: number;
      sheetNames: string[];
      unavailableSheetNames: string[];
      sheetReadErrors?: Record<string, string>;
    }
  | { type: "inspected"; id: number; inspection: ReturnType<typeof inspectWorkbookSheet> }
  | { type: "batch-processed"; id: number; result: WorkbookBatchResult }
  | { type: "error"; id: number; message: string; retryable: boolean };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

/** The single parsed workbook owned by this worker, if any. */
let parsed: ParsedSheet | null = null;

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

function isBlankBuffer(buffer: ArrayBuffer): boolean {
  return buffer.byteLength < 8;
}

async function handleParse(request: ParseRequest): Promise<void> {
  const { id, buffer, size, maxBytes } = request;

  // Release any workbook from a previous session before parsing a new one.
  parsed = null;

  if (isBlankBuffer(buffer)) {
    fail(id, new Error("This file is empty or too small to be a valid Excel workbook."), false);
    return;
  }

  if (size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    fail(
      id,
      new Error(`This file is ${(size / 1024 / 1024).toFixed(1)} MB. The limit is ${mb} MB. Split the workbook first.`),
      false,
    );
    return;
  }

  try {
    post({ type: "progress", id, stage: "hashing" });
    const fileHash = await sha256Hex(buffer);

    post({ type: "progress", id, stage: "parsing" });
    const next = await parseWorkbookBuffer(buffer);
    parsed = next;

    post({ type: "progress", id, stage: "ready" });
    post({
      type: "parsed",
      id,
      fileHash,
      size,
      sheetNames: next.sheetNames,
      unavailableSheetNames: next.unavailableSheetNames,
      sheetReadErrors: next.sheetReadErrors ?? {},
    });
  } catch (error) {
    parsed = null;
    // A parse failure on a well-formed-size file is usually a corrupt/unsupported
    // workbook; retrying the same file rarely helps, so mark non-retryable.
    fail(id, error, false);
  } finally {
    // The worker keeps no reference to the raw buffer after parsing.
  }
}

function handleInspect(request: InspectRequest): void {
  const { id, sheetName, headerRow } = request;
  if (!parsed) {
    fail(id, new Error("No workbook is loaded. Choose a file first."), true);
    return;
  }
  try {
    const inspection = inspectWorkbookSheet(parsed, sheetName, headerRow);
    post({ type: "inspected", id, inspection });
  } catch (error) {
    fail(id, error, true);
  }
}

function handleBatch(request: BatchRequest): void {
  if (!parsed) {
    fail(request.id, new Error("No workbook is loaded. Choose a file first."), true);
    return;
  }
  try {
    const result = processWorkbookBatch(parsed, request);
    post({ type: "batch-processed", id: request.id, result });
  } catch (error) {
    fail(request.id, error, true);
  }
}

function release() {
  parsed = null;
}

ctx.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  switch (request.type) {
    case "parse":
      void handleParse(request);
      return;
    case "inspect":
      handleInspect(request);
      return;
    case "batch":
      handleBatch(request);
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
