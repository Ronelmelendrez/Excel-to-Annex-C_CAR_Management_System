import type { ColumnMapping } from "@import-domain";
import type { CommitResponse, ImportPreview, WorkbookBatchResult } from "../types";
import { IMPORT_BATCH_SIZE } from "./import-limits";

/**
 * Local import-recovery store (IndexedDB).
 *
 * IndexedDB holds TEMPORARY recovery data only: the uploaded workbook bytes,
 * the session metadata (sheet, header row, column mapping), compact batch
 * validation results, and the last successfully persisted checkpoint.
 * Final business records always live in Supabase — nothing here is
 * authoritative, and losing this database never loses committed data.
 *
 * Design notes:
 * - The workbook is stored as raw bytes + name/type rather than a File object,
 *   so the round-trip is deterministic across environments (jsdom's File is
 *   not structured-cloneable; browser File is — both work as bytes).
 * - Every read validates the record schema. Corrupted or foreign records are
 *   pruned instead of crashing the wizard (requirement: handle corrupted or
 *   missing local data gracefully).
 * - Cross-tab exclusion uses a lease (owner + expiry) renewed by a heartbeat:
 *   a crashed or closed tab simply stops renewing, and the lease expires.
 * - Storage failures surface as StoreError("quota") or "unavailable". Batch
 *   checkpoints never advance when their IndexedDB write fails.
 */

export const IMPORT_STORE_DB = "car_import_sessions";
export const IMPORT_STORE_VERSION = 1;

/** A session must be resumed within this lease or the lock is considered dead. */
export const LOCK_TTL_MS = 30_000;
/** Heartbeat renews the lease well before expiry while this tab holds it. */
export const LOCK_RENEW_MS = 10_000;
/** Finished or untouched sessions older than this are eligible for manual clearing. */
export const SESSION_EXPIRE_MS = 30 * 24 * 60 * 60 * 1000;

export const SESSION_CHECKPOINTS = [
  "file_saved",
  "parsed",
  "shaped",
  "processing",
  "processed",
  "uploaded",
  "validated",
  "committing",
  "committed",
] as const;
export type SessionCheckpoint = (typeof SESSION_CHECKPOINTS)[number];

export const SESSION_STATUSES = ["in_progress", "paused", "cancelled", "completed"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export type StoredImportSession = {
  schema: 1;
  id: string;
  userId: string | null;
  createdAt: number;
  updatedAt: number;
  fileName: string;
  fileSize: number;
  /** SHA-256 of the workbook; set once parsing succeeds. */
  fileHash: string | null;
  /**
   * Batch results and their cursor are saved together. Later checkpoints only
   * advance after their underlying upload, validation, or commit succeeds.
   */
  checkpoint: SessionCheckpoint;
  status: SessionStatus;
  sheetNames: string[];
  sheetName: string | null;
  headerRow: number | null;
  headers: string[];
  mapping: ColumnMapping | null;
  rowCount: number | null;
  dataRowCount: number | null;
  batchSize: number;
  lastCompletedBatchIndex: number;
  failedBatchIndex: number | null;
  batchResults: WorkbookBatchResult[];
  /** Supabase Storage path; persisted only after the upload succeeded. */
  storagePath: string | null;
  /** Bounded server preview (100 rows / 200 issues / 50 households max). */
  preview: ImportPreview | null;
  /** Set after the server confirmed the commit. */
  result: CommitResponse | null;
  lastError: string | null;
};

export type StoredWorkbook = {
  id: string;
  bytes: ArrayBuffer;
  name: string;
  type: string;
};

type SessionLease = {
  id: string;
  owner: string;
  expiresAt: number;
};

type LeasePresence = {
  owner: string;
  expiresAt: number;
  released: boolean;
};

function leasePresenceKey(id: string): string {
  return `${IMPORT_STORE_DB}:lease:${id}`;
}

function readLeasePresence(id: string): LeasePresence | null {
  try {
    const raw = localStorage.getItem(leasePresenceKey(id));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<LeasePresence>;
    if (
      typeof value.owner !== "string" ||
      typeof value.expiresAt !== "number" ||
      typeof value.released !== "boolean"
    ) return null;
    return value as LeasePresence;
  } catch {
    return null;
  }
}

function writeLeasePresence(lease: SessionLease, released = false): void {
  try {
    localStorage.setItem(
      leasePresenceKey(lease.id),
      JSON.stringify({ owner: lease.owner, expiresAt: lease.expiresAt, released }),
    );
  } catch {
    // IndexedDB remains the source of truth when localStorage is unavailable.
  }
}

function markLeaseReleased(id: string, owner: string): void {
  const presence = readLeasePresence(id);
  if (!presence || presence.owner !== owner) return;
  writeLeasePresence({ id, owner, expiresAt: Date.now() }, true);
}

function clearLeasePresence(id: string): void {
  try {
    localStorage.removeItem(leasePresenceKey(id));
  } catch {
    // The marker is only a fast stale-tab hint; the IndexedDB lease still expires.
  }
}

function isLeaseLive(lease: SessionLease, id: string, now: number): boolean {
  if (lease.expiresAt <= now) return false;
  const presence = readLeasePresence(id);
  if (!presence) return true;
  return !presence.released && presence.expiresAt > now;
}

export type StoreErrorCode = "quota" | "unavailable" | "corrupted" | "unknown";

export class StoreError extends Error {
  code: StoreErrorCode;
  constructor(code: StoreErrorCode, message: string) {
    super(message);
    this.name = "StoreError";
    this.code = code;
  }
}

/** True when this browser can persist recovery data at all. */
export function isImportStoreSupported(): boolean {
  return typeof indexedDB !== "undefined";
}

/** Map a low-level IndexedDB failure to a user-facing StoreError. */
export function mapStoreError(error: unknown): StoreError {
  if (error instanceof StoreError) return error;
  const name = (error as { name?: string } | null)?.name ?? "";
  const message = (error as Error)?.message ?? "";
  if (name === "QuotaExceededError" || /quota/i.test(message)) {
    return new StoreError(
      "quota",
      "This browser's local storage quota is full. Earlier checkpoints are preserved, but the current batch will not advance until it is saved. Delete old sessions or free up browser storage, then retry.",
    );
  }
  if (name === "InvalidStateError" || name === "SecurityError" || typeof indexedDB === "undefined") {
    return new StoreError(
      "unavailable",
      "Local recovery storage is unavailable in this browser (private mode may block it). The import still works, but a refresh will lose progress.",
    );
  }
  return new StoreError("unknown", "Local recovery storage could not be written. The current operation was not checkpointed; retry it before continuing.");
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function promisifyTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("transaction_aborted"));
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!isImportStoreSupported()) {
    return Promise.reject(new StoreError("unavailable", "IndexedDB is not available."));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(IMPORT_STORE_DB, IMPORT_STORE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("sessions")) {
        db.createObjectStore("sessions", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("workbooks")) {
        db.createObjectStore("workbooks", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("leases")) {
        db.createObjectStore("leases", { keyPath: "id" });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      // Another tab upgrading would otherwise wedge us; a clean close lets the
      // next call reopen at the new version.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(mapStoreError(request.error));
    };
    request.onblocked = () => {
      dbPromise = null;
      reject(new StoreError("unavailable", "The local recovery database is blocked by another tab."));
    };
  });
  return dbPromise;
}

/** Schema guard: anything that fails this is pruned rather than surfaced. */
export function isValidSession(value: unknown): value is StoredImportSession {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (record.schema !== 1) return false;
  if (typeof record.id !== "string" || !record.id) return false;
  if (typeof record.fileName !== "string") return false;
  if (typeof record.fileSize !== "number") return false;
  if (typeof record.createdAt !== "number" || typeof record.updatedAt !== "number") return false;
  if (!SESSION_CHECKPOINTS.includes(record.checkpoint as SessionCheckpoint)) return false;
  if (!SESSION_STATUSES.includes(record.status as SessionStatus)) return false;
  if (!Array.isArray(record.sheetNames)) return false;
  if (record.sheetName !== null && typeof record.sheetName !== "string") return false;
  if (record.headerRow !== null && typeof record.headerRow !== "number") return false;
  if (!Array.isArray(record.headers)) return false;
  if (record.mapping !== null && !Array.isArray(record.mapping)) return false;
  if (
    record.dataRowCount !== undefined &&
    record.dataRowCount !== null &&
    (typeof record.dataRowCount !== "number" || !Number.isInteger(record.dataRowCount) || record.dataRowCount < 0)
  ) return false;
  if (
    record.batchSize !== undefined &&
    (typeof record.batchSize !== "number" || !Number.isInteger(record.batchSize) || record.batchSize < 1 || record.batchSize > IMPORT_BATCH_SIZE)
  ) return false;
  if (
    record.lastCompletedBatchIndex !== undefined &&
    (typeof record.lastCompletedBatchIndex !== "number" ||
      !Number.isInteger(record.lastCompletedBatchIndex) ||
      record.lastCompletedBatchIndex < -1)
  ) return false;
  if (
    record.failedBatchIndex !== undefined &&
    record.failedBatchIndex !== null &&
    (typeof record.failedBatchIndex !== "number" ||
      !Number.isInteger(record.failedBatchIndex) ||
      record.failedBatchIndex < 0)
  ) return false;
  if (record.batchResults !== undefined) {
    if (!Array.isArray(record.batchResults)) return false;
    if (record.batchResults.some((batch) => {
      if (!batch || typeof batch !== "object") return true;
      const item = batch as Partial<WorkbookBatchResult>;
      return (
        !Number.isInteger(item.batchIndex) ||
        typeof item.firstRowNumber !== "number" ||
        !Number.isFinite(item.firstRowNumber) ||
        typeof item.sourceRowCount !== "number" ||
        !Number.isFinite(item.sourceRowCount) ||
        item.sourceRowCount < 1 ||
        !item.summary ||
        typeof item.summary !== "object" ||
        !Number.isFinite(item.summary.total_rows) ||
        !Number.isFinite(item.summary.valid_rows) ||
        !Number.isFinite(item.summary.invalid_rows) ||
        !item.summary.issues_by_code ||
        typeof item.summary.issues_by_code !== "object" ||
        !Array.isArray(item.structuralErrors) ||
        !Array.isArray(item.warnings)
      );
    })) return false;
    const indexes = (record.batchResults as WorkbookBatchResult[])
      .map((batch) => batch.batchIndex)
      .sort((left, right) => left - right);
    const lastCompleted = typeof record.lastCompletedBatchIndex === "number"
      ? record.lastCompletedBatchIndex
      : -1;
    if (
      indexes.length !== lastCompleted + 1 ||
      indexes.some((index, position) => index !== position)
    ) return false;
  }
  return true;
}

function normalizeSession(value: StoredImportSession): StoredImportSession {
  const legacy = value as StoredImportSession & {
    dataRowCount?: number | null;
    batchSize?: number;
    lastCompletedBatchIndex?: number;
    failedBatchIndex?: number | null;
    batchResults?: WorkbookBatchResult[];
  };
  return {
    ...legacy,
    dataRowCount: legacy.dataRowCount ?? legacy.rowCount,
    batchSize: legacy.batchSize ?? IMPORT_BATCH_SIZE,
    lastCompletedBatchIndex: legacy.lastCompletedBatchIndex ?? -1,
    failedBatchIndex: legacy.failedBatchIndex ?? null,
    batchResults: legacy.batchResults ?? [],
  };
}

async function pruneSession(id: string): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(["sessions", "workbooks", "leases"], "readwrite");
    tx.objectStore("sessions").delete(id);
    tx.objectStore("workbooks").delete(id);
    tx.objectStore("leases").delete(id);
    await promisifyTransaction(tx);
    clearLeasePresence(id);
  } catch {
    // Pruning is best-effort hygiene; never surface it to the user.
  }
}

/** Newest-first sessions for one user, with invalid records pruned. */
export async function listSessions(userId: string | null): Promise<StoredImportSession[]> {
  if (!isImportStoreSupported()) return [];
  const db = await openDb();
  const tx = db.transaction("sessions", "readonly");
  const all = await promisifyRequest(tx.objectStore("sessions").getAll());
  const valid: StoredImportSession[] = [];
  const corrupt: string[] = [];
  for (const value of all as unknown[]) {
    if (isValidSession(value)) {
      if (userId === null || value.userId === null || value.userId === userId) {
        valid.push(normalizeSession(value));
      }
    } else if (value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string") {
      corrupt.push((value as { id: string }).id);
    }
  }
  for (const id of corrupt) void pruneSession(id);
  valid.sort((a, b) => b.updatedAt - a.updatedAt);
  return valid;
}

/** Single session or null (missing, foreign schema → pruned). */
export async function getSession(id: string): Promise<StoredImportSession | null> {
  if (!isImportStoreSupported() || !id) return null;
  try {
    const db = await openDb();
    const tx = db.transaction("sessions", "readonly");
    const value = await promisifyRequest(tx.objectStore("sessions").get(id));
    if (value === undefined) return null;
    if (!isValidSession(value)) {
      await pruneSession(id);
      return null;
    }
    return normalizeSession(value);
  } catch {
    return null;
  }
}

/** Upsert a session record. Throws StoreError("quota") when the browser is full. */
export async function saveSession(session: StoredImportSession): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction("sessions", "readwrite");
    tx.objectStore("sessions").put(session);
    await promisifyTransaction(tx);
  } catch (error) {
    throw mapStoreError(error);
  }
}

/**
 * Persist one batch result and its checkpoint in the same transaction. The
 * checkpoint therefore can never advance past a batch that was not saved.
 */
export async function saveBatchCheckpoint(
  id: string,
  result: WorkbookBatchResult,
  totalBatches: number,
): Promise<StoredImportSession> {
  try {
    const db = await openDb();
    const tx = db.transaction("sessions", "readwrite");
    const store = tx.objectStore("sessions");
    const stored = await promisifyRequest(store.get(id));
    if (!stored || !isValidSession(stored)) {
      tx.abort();
      throw new StoreError("corrupted", "The saved import session is missing or damaged.");
    }
    const current = normalizeSession(stored);
    if (result.batchIndex < current.lastCompletedBatchIndex) {
      tx.abort();
      throw new StoreError("corrupted", "A previously checkpointed batch cannot be processed again.");
    }
    if (
      result.batchIndex === current.lastCompletedBatchIndex &&
      current.batchResults.some((item) => item.batchIndex === result.batchIndex)
    ) {
      await promisifyTransaction(tx);
      return current;
    }
    if (result.batchIndex > current.lastCompletedBatchIndex + 1) {
      tx.abort();
      throw new StoreError("corrupted", "The import checkpoint is not sequential.");
    }
    const batchResults = current.batchResults.filter((item) => item.batchIndex !== result.batchIndex);
    batchResults.push(result);
    batchResults.sort((left, right) => left.batchIndex - right.batchIndex);
    const next: StoredImportSession = {
      ...current,
      batchResults,
      lastCompletedBatchIndex: Math.max(current.lastCompletedBatchIndex, result.batchIndex),
      failedBatchIndex: null,
      checkpoint: result.batchIndex + 1 >= totalBatches ? "processed" : "processing",
      status: "in_progress",
      lastError: null,
      updatedAt: Date.now(),
    };
    store.put(next);
    await promisifyTransaction(tx);
    return next;
  } catch (error) {
    throw mapStoreError(error);
  }
}

/** Persist workbook bytes for a session. Throws StoreError on quota/unsupported. */
export async function saveWorkbook(stored: StoredWorkbook): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction("workbooks", "readwrite");
    tx.objectStore("workbooks").put(stored);
    await promisifyTransaction(tx);
  } catch (error) {
    throw mapStoreError(error);
  }
}

function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.prototype.toString.call(value) === "[object ArrayBuffer]" &&
    typeof Reflect.get(value, "byteLength") === "number"
  );
}

/** Load workbook bytes, or null when they were never saved / were cleared. */
export async function loadWorkbook(id: string): Promise<StoredWorkbook | null> {
  if (!isImportStoreSupported() || !id) return null;
  try {
    const db = await openDb();
    const tx = db.transaction("workbooks", "readonly");
    const value = await promisifyRequest(tx.objectStore("workbooks").get(id));
    if (!value || !isArrayBuffer(value.bytes) || value.bytes.byteLength === 0) return null;
    if (typeof value.name !== "string") return null;
    return value as StoredWorkbook;
  } catch {
    return null;
  }
}

/** Remove a session together with its workbook bytes and lease. */
export async function deleteSession(id: string): Promise<void> {
  if (!id) return;
  try {
    const db = await openDb();
    const tx = db.transaction(["sessions", "workbooks", "leases"], "readwrite");
    tx.objectStore("sessions").delete(id);
    tx.objectStore("workbooks").delete(id);
    tx.objectStore("leases").delete(id);
    await promisifyTransaction(tx);
    clearLeasePresence(id);
  } catch (error) {
    throw mapStoreError(error);
  }
}

/**
 * Sessions eligible for the manual "clear finished or expired" action:
 * committed sessions and anything untouched for SESSION_EXPIRE_MS.
 * Unfinished, recent sessions are NEVER cleared automatically.
 */
export function isClearable(session: StoredImportSession, now: number = Date.now()): boolean {
  if (session.status === "completed") return true;
  return now - session.updatedAt > SESSION_EXPIRE_MS;
}

export function isResumable(session: StoredImportSession): boolean {
  return session.status !== "completed" && session.status !== "cancelled" && session.checkpoint !== "committed";
}

/** Manually clear finished/expired sessions. Returns how many were removed. */
export async function clearSessions(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  try {
    const db = await openDb();
    const tx = db.transaction(["sessions", "workbooks", "leases"], "readwrite");
    for (const id of ids) {
      tx.objectStore("sessions").delete(id);
      tx.objectStore("workbooks").delete(id);
      tx.objectStore("leases").delete(id);
    }
    await promisifyTransaction(tx);
    for (const id of ids) clearLeasePresence(id);
    return ids.length;
  } catch (error) {
    throw mapStoreError(error);
  }
}

/**
 * Take the cross-tab lease for a session. Succeeds when no lease exists,
 * the previous holder's lease expired or signalled a page close, or we already
 * hold it. Fails while another live tab holds an unexpired lease.
 */
export async function acquireLease(id: string, owner: string, now: number = Date.now()): Promise<boolean> {
  if (!isImportStoreSupported() || !id) return false;
  try {
    const db = await openDb();
    const tx = db.transaction("leases", "readwrite");
    const store = tx.objectStore("leases");
    const current: SessionLease | undefined = await promisifyRequest(store.get(id));
    if (current && current.owner !== owner && isLeaseLive(current, id, now)) {
      await promisifyTransaction(tx);
      return false;
    }
    const next = { id, owner, expiresAt: now + LOCK_TTL_MS } satisfies SessionLease;
    store.put(next);
    writeLeasePresence(next);
    await promisifyTransaction(tx);
    return true;
  } catch {
    return false;
  }
}

/** Extend our lease. Returns false when another tab has taken the session over. */
export async function renewLease(id: string, owner: string, now: number = Date.now()): Promise<boolean> {
  if (!isImportStoreSupported() || !id) return false;
  try {
    const db = await openDb();
    const tx = db.transaction("leases", "readwrite");
    const store = tx.objectStore("leases");
    const current: SessionLease | undefined = await promisifyRequest(store.get(id));
    if (!current || current.owner !== owner) {
      await promisifyTransaction(tx);
      return false;
    }
    const next = { id, owner, expiresAt: now + LOCK_TTL_MS } satisfies SessionLease;
    store.put(next);
    writeLeasePresence(next);
    await promisifyTransaction(tx);
    return true;
  } catch {
    return false;
  }
}

/** Release our lease (only if we still own it). */
export async function releaseLease(id: string, owner: string): Promise<void> {
  if (!isImportStoreSupported() || !id) return;
  markLeaseReleased(id, owner);
  try {
    const db = await openDb();
    const tx = db.transaction("leases", "readwrite");
    const store = tx.objectStore("leases");
    const current: SessionLease | undefined = await promisifyRequest(store.get(id));
    if (!current || current.owner === owner) store.delete(id);
    await promisifyTransaction(tx);
  } catch {
    // Lease expires on its own if release fails.
  }
}

/** True while a lease held by someone else is still valid. */
export async function isLeaseHeldByOther(id: string, owner: string, now: number = Date.now()): Promise<boolean> {
  if (!isImportStoreSupported() || !id) return false;
  try {
    const db = await openDb();
    const tx = db.transaction("leases", "readonly");
    const current: SessionLease | undefined = await promisifyRequest(tx.objectStore("leases").get(id));
    return Boolean(current && current.owner !== owner && isLeaseLive(current, id, now));
  } catch {
    return true;
  }
}

/** Test seam: forget the cached connection handle. */
export function __resetImportStoreForTests(): void {
  if (dbPromise) {
    void dbPromise.then((db) => db.close()).catch(() => undefined);
  }
  dbPromise = null;
}
