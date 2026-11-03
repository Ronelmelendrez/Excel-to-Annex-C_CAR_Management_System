import type { SheetInspection } from "../types";
import {
  extractSheetWorkbook,
  inspectWorkbookSheet,
  parseWorkbookSheet,
  readWorkbookSheetNames,
  sha256Hex,
  type ParsedSheet,
} from "./workbook-engine";

/**
 * Main-thread client for the background workbook reader.
 *
 * Opening a workbook reads only its sheet names — no worksheet data is parsed
 * until the operator picks a sheet, and then only THAT sheet is parsed (see
 * xlsx.worker.ts for why the parse never crosses back to the UI thread). This
 * client exposes a tiny async API — open a workbook, inspect a sheet, extract
 * a single-sheet copy for upload, release/cancel — and maps worker progress
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
  /** Worksheet names read from the workbook WITHOUT parsing any worksheet. */
  sheetNames: string[];
};

export type OpenProgress = "hashing" | "parsing" | "sheet" | "ready";

type OpenResult = {
  fileHash: string;
  size: number;
  sheetNames: string[];
};

/** A single-sheet copy produced by extractSheet(): bytes plus their hash. */
type ExtractResult = {
  buffer: ArrayBuffer;
  hash: string;
  size: number;
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
  | { kind: "extract"; resolve: (value: ExtractResult) => void; reject: (error: Error) => void };

/** A read or focused-sheet parse that runs longer than this is considered hung
 * and is torn down. 1,000,000-row worksheets can take 10+ minutes for SheetJS
 * to parse, especially on slower machines. Override with
 * VITE_IMPORT_OPEN_TIMEOUT_MS if needed.
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
  /** Bytes of the open workbook in the no-Worker fallback path. */
  private fallbackBuffer: ArrayBuffer | null = null;
  /** The single worksheet parsed by the fallback path, if any. */
  private fallbackFocused: { sheetName: string; parsed: ParsedSheet } | null = null;
  /** Timeout guarding the in-flight open/inspect request (OPEN_TIMEOUT_MS). */
  private requestTimer: { id: number; handle: ReturnType<typeof setTimeout> } | null = null;
  private openGeneration = 0;

  /** Wizard subscribes here to render parse progress (hashing → parsing → sheet → ready). */
  onOpenProgress: ((stage: OpenProgress) => void) | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      // Free the worker (and its retained bytes) if the app unloads.
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
        // Progress is only meaningful while opening or parsing a chosen
        // worksheet; forward it to whatever listener the wizard registered.
        this.onOpenProgress?.(data.stage as OpenProgress);
        return;
      case "opened":
        this.clearRequestTimer(data.id);
        this.pending.delete(data.id);
        if (entry.kind === "open") {
          entry.resolve({
            fileHash: data.fileHash,
            size: data.size,
            sheetNames: data.sheetNames,
          });
        } else {
          entry.reject(new Error("Received a workbook open response for a sheet inspection."));
        }
        return;
      case "inspected":
        this.clearRequestTimer(data.id);
        this.pending.delete(data.id);
        if (entry.kind === "inspect") {
          entry.resolve(data.inspection as SheetInspection);
        } else {
          entry.reject(new Error("Received a sheet inspection response for a workbook open."));
        }
        return;
      case "extracted":
        this.clearRequestTimer(data.id);
        this.pending.delete(data.id);
        if (entry.kind === "extract") {
          entry.resolve({ buffer: data.buffer, hash: data.hash, size: data.size });
        } else {
          entry.reject(new Error("Received a single-sheet extract for a different request."));
        }
        return;
      case "error":
        this.clearRequestTimer(data.id);
        this.pending.delete(data.id);
        entry.reject(new Error(data.message));
        return;
      default:
        return;
    }
  }

  private failAll(message: string) {
    this.clearRequestTimer();
    for (const entry of this.pending.values()) entry.reject(new Error(message));
    this.pending.clear();
    this.teardownWorker();
  }

  /** Clear the hung-request timer, optionally only if it belongs to `id`. */
  private clearRequestTimer(id?: number) {
    if (!this.requestTimer) return;
    if (id !== undefined && this.requestTimer.id !== id) return;
    clearTimeout(this.requestTimer.handle);
    this.requestTimer = null;
  }

  /** Start (or replace) the hung-request timer for the given request. */
  private startRequestTimer(id: number) {
    this.clearRequestTimer();
    this.requestTimer = {
      id,
      handle: setTimeout(() => {
        this.requestTimer = null;
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
      }, OPEN_TIMEOUT_MS),
    };
  }

  private teardownWorker() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  /**
   * Read a workbook's metadata — the file hash and its worksheet names —
   * WITHOUT parsing any worksheet. The chosen sheet is parsed later, on
   * demand, by inspect().
   *
   * There is deliberately NO whole-file size rejection here: the upload cap
   * applies at save time to what actually gets uploaded (the workbook when it
   * fits, otherwise a single-sheet copy of the chosen worksheet — see
   * upload-target.ts), so a workbook over the cap must still open and list
   * its sheets.
   *
   * If `buffer` is provided (already read by the caller), the file is not read
   * a second time — this avoids doubling memory usage on large workbooks.
   */
  async open(file: File, buffer?: ArrayBuffer): Promise<OpenResult> {
    // This client owns one workbook at a time. Tear down prior work before
    // opening another file so an older asynchronous read cannot replace it.
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

    // Start the timeout before handing work to the worker so the whole cycle
    // (hash + names read) is covered, not just part of it.
    this.startRequestTimer(id);

    // Do NOT transfer the buffer: the caller may reuse the same bytes (a
    // resumed session re-reads the same stored bytes) and the worker retains
    // its copy so each chosen sheet can be parsed on demand.
    worker.postMessage({ type: "open", id, buffer: bytes, fileName: file.name, size: file.size });
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
    // Names only — the chosen sheet is parsed lazily by inspect().
    const sheetNames = await readWorkbookSheetNames(buf);
    if (generation !== this.openGeneration) throw new Error("Cancelled.");
    this.fallbackBuffer = buf;
    this.fallbackFocused = null;
    return { fileHash, size: file.size, sheetNames };
  }

  /**
   * Inspect a sheet of the currently open workbook. The first inspect for a
   * given sheet parses just that worksheet (focused read); later calls reuse
   * the parsed sheet until a different one is requested.
   */
  async inspect(sheetName: string, headerRow?: number): Promise<SheetInspection> {
    if (!supportsWorker) {
      const buffer = this.fallbackBuffer;
      if (!buffer) throw new Error("No workbook is loaded. Choose a file first.");
      const generation = this.openGeneration;
      let parsed =
        this.fallbackFocused?.sheetName === sheetName ? this.fallbackFocused.parsed : null;
      if (!parsed) {
        parsed = await parseWorkbookSheet(buffer, sheetName);
        if (generation !== this.openGeneration) throw new Error("Cancelled.");
        this.fallbackFocused = { sheetName, parsed };
      }
      return inspectWorkbookSheet(parsed, sheetName, headerRow);
    }

    const id = this.nextId++;
    const worker = this.ensureWorker();
    const promise = new Promise<SheetInspection>((resolve, reject) => {
      this.pending.set(id, { kind: "inspect", resolve, reject });
    });
    // The focused parse of a huge worksheet can take minutes; guard it so a
    // hung worker never leaves the undismissable progress overlay up forever.
    this.startRequestTimer(id);
    worker.postMessage({ type: "inspect", id, sheetName, headerRow });
    return promise;
  }

  /**
   * Build a single-sheet copy of the chosen worksheet (bytes + SHA-256) from
   * the workbook opened by open(). This is the upload used when the whole
   * workbook exceeds the upload cap: only the imported sheet is sent, so the
   * cap applies to the sheet's data instead of the entire file. The workbook
   * must be open — the retained bytes are what get re-serialized.
   */
  async extractSheet(sheetName: string): Promise<ExtractResult> {
    if (!supportsWorker) {
      const buffer = this.fallbackBuffer;
      if (!buffer) throw new Error("No workbook is loaded. Choose a file first.");
      const extracted = await extractSheetWorkbook(buffer, sheetName);
      return { buffer: extracted.bytes, hash: extracted.hash, size: extracted.bytes.byteLength };
    }

    const id = this.nextId++;
    const worker = this.ensureWorker();
    const promise = new Promise<ExtractResult>((resolve, reject) => {
      this.pending.set(id, { kind: "extract", resolve, reject });
    });
    // Re-serializing a very large worksheet can take a while; the same
    // hung-request guard as inspect() keeps the overlay from sticking.
    this.startRequestTimer(id);
    worker.postMessage({ type: "extract", id, sheetName });
    return promise;
  }

  /**
   * Cancel any in-flight work and free the retained bytes. Safe to call at
   * any time; the next open() simply starts a fresh worker.
   */
  cancel() {
    this.openGeneration += 1;
    this.clearRequestTimer();
    for (const entry of this.pending.values()) entry.reject(new Error("Cancelled."));
    this.pending.clear();
    this.fallbackBuffer = null;
    this.fallbackFocused = null;
    this.teardownWorker();
  }

  /** Drop the retained workbook to release memory, keeping the client usable. */
  release() {
    this.fallbackBuffer = null;
    this.fallbackFocused = null;
    if (this.worker) this.worker.postMessage({ type: "release" });
  }
}

/** Single shared client: the import wizard is the only consumer. */
export const workbookClient = new WorkbookClient();
