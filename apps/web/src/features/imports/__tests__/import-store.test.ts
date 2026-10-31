import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  IMPORT_STORE_DB,
  IMPORT_STORE_VERSION,
  LOCK_TTL_MS,
  __resetImportStoreForTests,
  acquireLease,
  deleteSession,
  getSession,
  isClearable,
  isLeaseHeldByOther,
  isResumable,
  listSessions,
  loadWorkbook,
  mapStoreError,
  releaseLease,
  renewLease,
  saveSession,
  saveBatchCheckpoint,
  saveWorkbook,
  StoreError,
  type StoredImportSession,
  type StoredWorkbook,
} from "../lib/import-store";

let nextId = 0;
const sessionIds: string[] = [];

function newId(label: string): string {
  const id = `${label}-${++nextId}`;
  sessionIds.push(id);
  return id;
}

function makeSession(id: string, userId: string): StoredImportSession {
  const now = Date.now();
  return {
    schema: 1,
    id,
    userId,
    createdAt: now,
    updatedAt: now,
    fileName: "annex-c.xlsx",
    fileSize: 4,
    fileHash: null,
    checkpoint: "file_saved",
    status: "in_progress",
    sheetNames: [],
    sheetName: null,
    headerRow: null,
    headers: [],
    mapping: null,
    rowCount: null,
    dataRowCount: null,
    batchSize: 20_000,
    lastCompletedBatchIndex: -1,
    failedBatchIndex: null,
    batchResults: [],
    storagePath: null,
    preview: null,
    result: null,
    lastError: null,
  };
}

async function openStoreDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IMPORT_STORE_DB, IMPORT_STORE_VERSION);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

afterEach(async () => {
  await Promise.all(sessionIds.splice(0).map((id) => deleteSession(id)));
});

describe("IndexedDB import recovery store", () => {
  it("round-trips workbook bytes and user-scoped session metadata", async () => {
    const id = newId("round-trip");
    const session = makeSession(id, "operator-1");
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer;

    await saveWorkbook({ id, bytes, name: session.fileName, type: "application/vnd.ms-excel" });
    await saveSession(session);

    const database = await openStoreDatabase();
    const persisted = await new Promise<StoredWorkbook | undefined>((resolve, reject) => {
      const request = database.transaction("workbooks", "readonly").objectStore("workbooks").get(id);
      request.onsuccess = () => resolve(request.result as StoredWorkbook | undefined);
      request.onerror = () => reject(request.error);
    });
    database.close();
    expect(persisted).toBeDefined();

    const restored = await loadWorkbook(id);
    if (!restored) throw new Error("The stored workbook was not restored.");
    expect(Array.from(new Uint8Array(restored.bytes))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(restored?.name).toBe(session.fileName);
    expect(await getSession(id)).toEqual(session);
    expect(await listSessions("operator-1")).toEqual([session]);
    expect(await listSessions("operator-2")).toEqual([]);

    await deleteSession(id);
    expect(await getSession(id)).toBeNull();
    expect(await loadWorkbook(id)).toBeNull();
  });

  it("restores a persisted session after reopening the database connection", async () => {
    const id = newId("reopen");
    const session = makeSession(id, "operator-1");
    await saveWorkbook({
      id,
      bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer,
      name: session.fileName,
      type: "application/vnd.ms-excel",
    });

    await saveSession(session);

    __resetImportStoreForTests();

    expect(await getSession(id)).toEqual(session);
    expect((await loadWorkbook(id))?.name).toBe(session.fileName);
  });

  it("persists batch results and checkpoints atomically and resumes sequentially", async () => {
    const id = newId("batches");
    await saveSession(makeSession(id, "operator-1"));
    const result = (batchIndex: number) => ({
      batchIndex,
      firstRowNumber: batchIndex * 20_000 + 2,
      sourceRowCount: 20_000,
      summary: {
        total_rows: 20_000,
        valid_rows: 19_000,
        invalid_rows: 1_000,
        skipped_blank_rows: 0,
        household_count: 100,
        member_count: 20_000,
        rows_without_household: 0,
        issues_by_code: {},
      },
      structuralErrors: [],
      warnings: [],
    });

    const first = await saveBatchCheckpoint(id, result(0), 3);
    expect(first.lastCompletedBatchIndex).toBe(0);
    expect(first.checkpoint).toBe("processing");
    expect(first.batchResults).toHaveLength(1);

    await expect(saveBatchCheckpoint(id, result(2), 3)).rejects.toThrow(/checkpoint is not sequential/i);
    expect((await getSession(id))?.lastCompletedBatchIndex).toBe(0);
    const retriedFirst = await saveBatchCheckpoint(id, result(0), 3);
    expect(retriedFirst.batchResults).toHaveLength(1);

    const second = await saveBatchCheckpoint(id, result(1), 3);
    expect(second.lastCompletedBatchIndex).toBe(1);
    expect(second.batchResults.map((item) => item.batchIndex)).toEqual([0, 1]);
    expect((await getSession(id))?.lastCompletedBatchIndex).toBe(1);
    await expect(saveBatchCheckpoint(id, result(0), 3)).rejects.toThrow(/cannot be processed again/i);
  });

  it("does not advance a checkpoint when IndexedDB reports a quota failure", async () => {
    const id = newId("quota-batch");
    await saveSession(makeSession(id, "operator-1"));
    const result = {
      batchIndex: 0,
      firstRowNumber: 2,
      sourceRowCount: 2,
      summary: {
        total_rows: 2,
        valid_rows: 2,
        invalid_rows: 0,
        skipped_blank_rows: 0,
        household_count: 2,
        member_count: 2,
        rows_without_household: 0,
        issues_by_code: {},
      },
      structuralErrors: [],
      warnings: [],
    };
    const put = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(() => {
      throw new DOMException("quota exceeded", "QuotaExceededError");
    });

    try {
      await expect(saveBatchCheckpoint(id, result, 1)).rejects.toMatchObject({ code: "quota" });
    } finally {
      put.mockRestore();
    }

    const persisted = await getSession(id);
    expect(persisted?.lastCompletedBatchIndex).toBe(-1);
    expect(persisted?.batchResults).toEqual([]);
  });

  it("prevents a second live tab from taking a lease and preserves the new owner", async () => {
    const id = newId("lease");
    const now = Date.now();

    expect(await acquireLease(id, "tab-a", now)).toBe(true);
    expect(await acquireLease(id, "tab-b", now + 1)).toBe(false);
    expect(await isLeaseHeldByOther(id, "tab-b", now + 2)).toBe(true);
    expect(await renewLease(id, "tab-a", now + 3)).toBe(true);

    const afterExpiry = now + LOCK_TTL_MS + 4;
    expect(await acquireLease(id, "tab-b", afterExpiry)).toBe(true);
    await releaseLease(id, "tab-a");
    expect(await isLeaseHeldByOther(id, "tab-a", afterExpiry + 1)).toBe(true);

    await releaseLease(id, "tab-b");
    expect(await isLeaseHeldByOther(id, "tab-a", afterExpiry + 2)).toBe(false);
  });

  it("releases a tab lease immediately when the page is closing", async () => {
    const id = newId("pagehide");
    const now = Date.now();

    expect(await acquireLease(id, "tab-a", now)).toBe(true);
    await releaseLease(id, "tab-a");

    expect(await acquireLease(id, "tab-b", now + 1)).toBe(true);
    expect(await isLeaseHeldByOther(id, "tab-a", now + 2)).toBe(true);
    await releaseLease(id, "tab-b");
  });

  it("marks completed and expired sessions clearable but keeps recent unfinished sessions", () => {
    const now = Date.now();
    const inProgress = { ...makeSession(newId("active"), "operator-1"), updatedAt: now };
    const completed = { ...makeSession(newId("done"), "operator-1"), status: "completed" as const };
    const expired = {
      ...makeSession(newId("expired"), "operator-1"),
      updatedAt: now - 31 * 24 * 60 * 60 * 1000,
    };

    expect(isClearable(inProgress, now)).toBe(false);
    expect(isClearable(completed, now)).toBe(true);
    expect(isClearable(expired, now)).toBe(true);
    expect(isResumable(inProgress)).toBe(true);
    expect(isResumable(completed)).toBe(false);
    expect(isResumable({ ...inProgress, checkpoint: "committed" })).toBe(false);
  });

  it("maps quota failures to an actionable local-storage error", () => {
    const mapped = mapStoreError(new DOMException("quota exceeded", "QuotaExceededError"));
    expect(mapped).toBeInstanceOf(StoreError);
    expect(mapped.code).toBe("quota");
    expect(mapped.message).toMatch(/delete old local sessions|free up browser storage/i);
  });

  it("returns null for missing workbook bytes", async () => {
    expect(await loadWorkbook(newId("missing"))).toBeNull();
  });

  it("prunes a corrupted session instead of returning it", async () => {
    const id = newId("corrupt");
    await listSessions("operator-1");
    const database = await openStoreDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("sessions", "readwrite");
      transaction.objectStore("sessions").put({ id, schema: 999 });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();

    expect(await getSession(id)).toBeNull();
    const verificationDatabase = await openStoreDatabase();
    const stored = await new Promise<unknown>((resolve, reject) => {
      const request = verificationDatabase.transaction("sessions", "readonly").objectStore("sessions").get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    verificationDatabase.close();
    expect(stored).toBeUndefined();
  });
});
