import type { SheetInspection, WorkbookBatchResult } from "../types";
import type { ColumnMapping } from "@import-domain";
import { IMPORT_MAX_BYTES } from "./import-limits";
import {
  inspectWorkbookSheet,
  parseWorkbookBuffer,
  processWorkbookBatch,
  sha256Hex,
  type ParsedSheet,
} from "./workbook-engine";

/**
 * Main-thread client for the background workbook parser.
 *
 * The parsed workbook is owned by the Web Worker and never crosses back to the
 * UI thread (see xlsx.worker.ts for why). This client exposes a tiny async API —
 * open a workbook, inspect a sheet, release/cancel — and maps worker progress
 * and errors onto values the wizard can render.
 *
 * If `Worker` is unavailable (jsdom in tests, very old browsers), it falls back
 * to doing the same work inline on the main thread using the identical engine,
 * so behaviour stays consistent everywhere.
 */

export type WorkbookBundle = {
  file: File;
  fileHash: string;
  size: number;
  sheetNames: string[];
  unavailableSheetNames: string[];
  /** Why each unavailable worksheet failed to parse, keyed by sheet name. */
  sheetReadErrors?: Record<string, string>;
};

export type OpenProgress = "hashing" | "parsing" | "ready";

type OpenResult = {
  fileHash: string;
  size: number;
  sheetNames: string[];
  unavailableSheetNames: string[];
  sheetReadErrors?: Record<string, string>;
};

function readPositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

type Pending =
  | { kind: "open"; resolve: (value: OpenResult) => void; reject: (error: Error) => void }
  | { kind: "inspect"; resolve: (value: SheetInspection) => void; reject: (error: Error) => void }
  | { kind: "batch"; resolve: (value: WorkbookBatchResult) => void; reject: (error: Error) => void };

/** A parse that runs longer than this is considered hung and is torn down.
 * 1,000,000-row workbooks can take 10+ minutes for SheetJS to fully parse,
 * especially on slower machines. Override with VITE_IMPORT_OPEN_TIMEOUT_MS if needed.
 */
const OPEN_TIMEOUT_MS = readPositiveInt(
  import.meta.env.VITE_IMPORT_OPEN_TIMEOUT_MS,
  1_800_000,
);

const supportsWorker =
  typeof Worker !== "undefined" &&
  typeof URL !== "undefined" &&
  typeof Worker.prototype.postMessage === "function";

class WorkbookClient {
  private worker: Worker | null = null;
  private pending = new Map<number, Pending>();
  private nextId = 1;
  private fallbackParsed: ParsedSheet | null = null;
  private openTimer: ReturnType<typeof setTimeout> | null = null;
  private openGeneration = 0;

  /** Wizard subscribes here to render parse progress (hashing/parsing/ready). */
  onOpenProgress: ((stage: OpenProgress) => void) | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      // Free the worker (and its retained workbook) if the app unloads.
      window.addEventListener("pagehide", () => this.release());
    }
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL("./xlsx.worker.ts", import.meta.url), { type: "module" });
    worker.addEventListener("message", (event: MessageEvent) => this.onMessage(event.data));
    // A worker-level error (e.g. OOM) leaves no message to correlate, so fail
    // every in-flight request with a friendly, retryable error.
    worker.addEventListener("error", () =>
      this.failAll("The workbook ran out of memory while reading. Try a smaller file."),
    );
    worker.addEventListener("messageerror", () =>
      this.failAll("The workbook response could not be read. Try again."),
    );
    this.worker = worker;
    return worker;
  }

  private onMessage(data: any) {
    if (!data || typeof data.id !== "number") return;
    const entry = this.pending.get(data.id);
    if (!entry) return;

    switch (data.type) {
      case "progress":
        // Progress is only meaningful while opening a workbook; forward it to
        // whatever listener the wizard has registered.
        this.onOpenProgress?.(data.stage as OpenProgress);
        return;
      case "parsed":
        this.clearOpenTimer();
        this.pending.delete(data.id);
        if (entry.kind === "open") {
          entry.resolve({
            fileHash: data.fileHash,
            size: data.size,
            sheetNames: data.sheetNames,
            unavailableSheetNames: data.unavailableSheetNames ?? [],
            sheetReadErrors: data.sheetReadErrors ?? {},
          });
        } else {
          entry.reject(new Error("Received a workbook parse response for a sheet inspection."));
        }
        return;
      case "inspected":
        this.pending.delete(data.id);
        if (entry.kind === "inspect") {
          entry.resolve(data.inspection as SheetInspection);
        } else {
          entry.reject(new Error("Received a sheet inspection response for a workbook parse."));
        }
        return;
      case "batch-processed":
        this.pending.delete(data.id);
        if (entry.kind === "batch") {
          entry.resolve(data.result as WorkbookBatchResult);
        } else {
          entry.reject(new Error("Received a batch response for another workbook operation."));
        }
        return;
      case "error":
        this.clearOpenTimer();
        this.pending.delete(data.id);
        entry.reject(new Error(data.message));
        return;
      default:
        return;
    }
  }

  private failAll(message: string) {
    this.clearOpenTimer();
    for (const entry of this.pending.values()) entry.reject(new Error(message));
    this.pending.clear();
    this.teardownWorker();
  }

  private clearOpenTimer() {
    if (this.openTimer) {
      clearTimeout(this.openTimer);
      this.openTimer = null;
    }
  }

  private teardownWorker() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  /**
   * Parse a workbook and return its lightweight metadata (never the workbook
   * itself). The parsed sheet stays inside the worker for inspect() calls.
   *
   * If `buffer` is provided (already read by the caller), the file is not read
   * a second time — this avoids doubling memory usage on large workbooks.
   */
  async open(
    file: File,
    maxBytes: number = IMPORT_MAX_BYTES,
    buffer?: ArrayBuffer,
  ): Promise<OpenResult> {
    // Guard the size before touching the file so we fail fast and cheaply.
    if (file.size > maxBytes) {
      const mb = Math.round(maxBytes / (1024 * 1024));
      throw new Error(
        `This file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${mb} MB. Split the workbook first.`,
      );
    }

    // This client owns one workbook at a time. Tear down prior work before
    // opening another file so an older asynchronous parse cannot replace it.
    this.cancel();
    const generation = this.openGeneration;

    if (!supportsWorker) return this.openFallback(file, generation, buffer);

    // Read the file once if the caller didn't already provide the bytes.
    const bytes = buffer ?? (await file.arrayBuffer());
    if (generation !== this.openGeneration) throw new Error("Cancelled.");
    const id = this.nextId++;
    const worker = this.ensureWorker();

    const promise = new Promise<OpenResult>((resolve, reject) => {
      this.pending.set(id, { kind: "open", resolve, reject });
    });

    // Start the timeout before any async work so the full read + parse cycle
    // is covered, not just the worker parse time.
    this.clearOpenTimer();
    this.openTimer = setTimeout(() => {
      const entry = this.pending.get(id);
      if (entry) {
        this.pending.delete(id);
        entry.reject(
          new Error("Reading the workbook took too long. Try a smaller file or split the workbook."),
        );
      }
      // A hung worker cannot be interrupted cleanly; terminate and start fresh
      // next time so the UI is never stuck behind a dead thread.
      this.failAll("Reading the workbook timed out. Try a smaller file.");
    }, OPEN_TIMEOUT_MS);

    // Do NOT transfer the buffer: the caller may reuse the same bytes for a
    // retry (e.g. when unavailable sheets need a second parse attempt).
    worker.postMessage(
      { type: "parse", id, buffer: bytes, fileName: file.name, size: file.size, maxBytes },
    );
    return promise;
  }

  private async openFallback(
    file: File,
    generation: number,
    buffer?: ArrayBuffer,
  ): Promise<OpenResult> {
    // Reuse the caller's bytes when provided: the wizard reads the file once
    // for persistence, and re-reading it here would double peak memory on large
    // workbooks (and fail outright where File.arrayBuffer is unavailable).
    const buf = buffer ?? (await file.arrayBuffer());
    if (generation !== this.openGeneration) throw new Error("Cancelled.");
    const fileHash = await sha256Hex(buf);
    if (generation !== this.openGeneration) throw new Error("Cancelled.");
    const parsed = await parseWorkbookBuffer(buf);
    if (generation !== this.openGeneration) throw new Error("Cancelled.");
    this.fallbackParsed = parsed;
    return {
      fileHash,
      size: file.size,
      sheetNames: parsed.sheetNames,
      unavailableSheetNames: parsed.unavailableSheetNames,
      sheetReadErrors: parsed.sheetReadErrors ?? {},
    };
  }

  /** Inspect a sheet of the currently open workbook. */
  async inspect(sheetName: string, headerRow?: number): Promise<SheetInspection> {
    if (!supportsWorker) {
      if (!this.fallbackParsed) throw new Error("No workbook is loaded. Choose a file first.");
      return inspectWorkbookSheet(this.fallbackParsed, sheetName, headerRow);
    }

    const id = this.nextId++;
    const worker = this.ensureWorker();
    const promise = new Promise<SheetInspection>((resolve, reject) => {
      this.pending.set(id, { kind: "inspect", resolve, reject });
    });
    worker.postMessage({ type: "inspect", id, sheetName, headerRow });
    return promise;
  }

  /** Process one bounded batch without returning workbook rows to React. */
  async processBatch(params: {
    sheetName: string;
    headerRow: number;
    headers: string[];
    mapping: ColumnMapping;
    batchIndex: number;
    batchSize: number;
  }): Promise<WorkbookBatchResult> {
    if (!supportsWorker) {
      if (!this.fallbackParsed) throw new Error("No workbook is loaded. Choose a file first.");
      return processWorkbookBatch(this.fallbackParsed, params);
    }

    const id = this.nextId++;
    const worker = this.ensureWorker();
    const promise = new Promise<WorkbookBatchResult>((resolve, reject) => {
      this.pending.set(id, { kind: "batch", resolve, reject });
    });
    worker.postMessage({ type: "batch", id, ...params });
    return promise;
  }

  /**
   * Cancel any in-flight work and free the retained workbook. Safe to call at
   * any time; the next open() simply starts a fresh worker.
   */
  cancel() {
    this.openGeneration += 1;
    this.clearOpenTimer();
    for (const entry of this.pending.values()) entry.reject(new Error("Cancelled."));
    this.pending.clear();
    this.fallbackParsed = null;
    this.teardownWorker();
  }

  /** Drop the retained workbook to release memory, keeping the client usable. */
  release() {
    this.fallbackParsed = null;
    if (this.worker) this.worker.postMessage({ type: "release" });
  }
}

/** Single shared client: the import wizard is the only consumer. */
export const workbookClient = new WorkbookClient();
