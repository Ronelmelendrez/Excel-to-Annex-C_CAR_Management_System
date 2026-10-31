import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CanonicalField, ColumnMapping } from "@import-domain";
import {
  inspectInitialSheet,
  inspectSheet,
  mappingCoverage,
  readWorkbookFile,
  remapPreservingChoices,
  setMappingField as setField,
  type WorkbookBundle,
} from "../lib/analysis";
import { workbookClient, type OpenProgress } from "../lib/workbook-client";
import { IMPORT_BATCH_SIZE, IMPORT_MAX_ROWS } from "../lib/import-limits";
import { commitImport, isDuplicateConflict, previewImport, uploadWorkbook } from "../api";
import { isDemoMode } from "../../../shared/supabase";
import {
  LOCK_RENEW_MS,
  acquireLease,
  clearSessions,
  deleteSession,
  getSession,
  isClearable,
  isResumable,
  isImportStoreSupported,
  listSessions,
  loadWorkbook,
  mapStoreError,
  releaseLease,
  renewLease,
  isLeaseHeldByOther,
  saveBatchCheckpoint,
  saveSession,
  saveWorkbook,
  type StoredImportSession,
} from "../lib/import-store";
import type {
  CommitResponse,
  DuplicateImport,
  ImportPreview,
  SheetInspection,
  WizardError,
  WizardStage,
} from "../types";

/** This tab's identity for the cross-tab session lease. Stable per page load. */
const TAB_OWNER = (() => {
  try {
    return `tab-${crypto.randomUUID()}`;
  } catch {
    return `tab-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
  }
})();

function newSessionId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/** Read the file's bytes exactly once (at choose time) so they can be persisted. */
function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") return file.arrayBuffer();
  // Older jsdom builds omit Blob.arrayBuffer; FileReader covers them.
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("file_read_failed"));
    reader.readAsArrayBuffer(file);
  });
}

export type StoreNotice = { title: string; detail: string };

export type ImportWizard = {
  stage: WizardStage;
  bundle: WorkbookBundle | null;
  sheet: SheetInspection | null;
  preview: ImportPreview | null;
  result: CommitResponse | null;
  busy: "reading" | "processing" | "validating" | "committing" | null;
  batchProgress: {
    completedBatches: number;
    totalBatches: number;
    failedBatchIndex: number | null;
    validRows: number;
    invalidRows: number;
  } | null;
  /** Parse progress while reading: hashing -> parsing -> ready. */
  readStage: OpenProgress | null;
  error: (WizardError & { duplicate?: DuplicateImport }) | null;
  duplicateConfirmed: boolean;
  coverage: ReturnType<typeof mappingCoverage>;
  chooseFile: (file: File) => Promise<void>;
  selectSheet: (sheetName: string) => void;
  setHeaderRow: (row: number) => void;
  setMappingField: (index: number, field: CanonicalField | null) => void;
  processRows: () => Promise<void>;
  pauseProcessing: () => Promise<void>;
  validate: () => Promise<void>;
  commit: () => Promise<void>;
  setDuplicateConfirmed: (value: boolean) => void;
  cancelRead: () => void;
  backToShape: () => void;
  reset: () => void;

  /** Locally persisted recovery sessions (IndexedDB, temporary storage). */
  sessions: StoredImportSession[];
  sessionsLoading: boolean;
  sessionsError: boolean;
  activeSessionId: string | null;
  /** Non-fatal local-storage problem (quota, private mode, cross-tab, corruption). */
  storeNotice: StoreNotice | null;
  dismissStoreNotice: () => void;
  resumeSession: (id: string) => Promise<void>;
  pauseSession: (id: string) => Promise<void>;
  cancelSession: (id: string) => Promise<void>;
  removeSession: (id: string) => Promise<void>;
  clearFinishedSessions: () => Promise<void>;
};

function toWizardError(error: any, title: string): WizardError & { duplicate?: DuplicateImport } {
  const payload = error?.payload ?? {};
  return {
    title,
    detail:
      typeof payload.guidance === "string"
        ? payload.guidance
        : error?.message || "Something interrupted the import. Try again.",
    retryable: error?.status === 0 || error?.status >= 500,
    duplicate: payload.duplicate ?? undefined,
  };
}

export function useImportWizard(params: {
  userId: string | null;
  onCommitted?: () => void;
}): ImportWizard {
  const { userId, onCommitted } = params;
  const [stage, setStage] = useState<WizardStage>("choose");
  const [bundle, setBundle] = useState<WorkbookBundle | null>(null);
  const [sheet, setSheet] = useState<SheetInspection | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<CommitResponse | null>(null);
  const [busy, setBusy] = useState<ImportWizard["busy"]>(null);
  const [readStage, setReadStage] = useState<OpenProgress | null>(null);
  const [error, setError] = useState<ImportWizard["error"]>(null);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [sessions, setSessions] = useState<StoredImportSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState(false);
  const [storeNotice, setStoreNotice] = useState<StoreNotice | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<ImportWizard["batchProgress"]>(null);

  // Guards async parse results so a superseded sheet/header inspection never
  // overwrites a newer one, and so unmounting mid-read does not setState.
  const mountedRef = useRef(true);
  const inspectSeqRef = useRef(0);

  // Recovery-session state lives in refs (not state) so every async step
  // persists the latest record without stale closures, and so session writes
  // serialize through one promise chain instead of racing each other.
  const sessionRef = useRef<StoredImportSession | null>(null);
  const persistChainRef = useRef<Promise<void>>(Promise.resolve());
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoValidateRef = useRef(false);
  const processingPromiseRef = useRef<Promise<void> | null>(null);
  const processingControlRef = useRef<"pause" | "cancel" | null>(null);

  const reportStoreError = useCallback((error: unknown) => {
    const mapped = mapStoreError(error);
    const title =
      mapped.code === "quota"
        ? "Browser storage is full"
        : mapped.code === "unavailable"
          ? "Local recovery is unavailable"
          : "Local recovery could not be updated";
    setStoreNotice({ title, detail: mapped.message });
  }, []);

  const refreshSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      setSessions(await listSessions(userId));
      setSessionsError(false);
    } catch (error: unknown) {
      setSessionsError(true);
      reportStoreError(error);
    } finally {
      setSessionsLoading(false);
    }
  }, [reportStoreError, userId]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current !== null) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  /** Keep the cross-tab lease alive while this tab actively owns a session. */
  const startHeartbeat = useCallback(
    (id: string) => {
      stopHeartbeat();
      heartbeatRef.current = setInterval(() => {
        void renewLease(id, TAB_OWNER).then((stillOurs) => {
          if (stillOurs || sessionRef.current?.id !== id) return;
          void isLeaseHeldByOther(id, TAB_OWNER).then((otherTab) => {
            if (!otherTab || sessionRef.current?.id !== id) return;
            stopHeartbeat();
            setStoreNotice({
              title: "Session taken by another tab",
              detail:
                "Another browser tab took over this import session. Finish it there, or reload this page to see its state.",
            });
          });
        });
      }, LOCK_RENEW_MS);
    },
    [stopHeartbeat],
  );

  /**
   * Persist the active session record. Checkpoints are only ever advanced by
   * callers AFTER the underlying write (blob, upload, preview, commit result)
   * actually succeeded. Returns the queued write so callers that must wait
   * (e.g. the "committing" marker) can await it.
   */
  const persistSession = useCallback(
    (patch: Partial<StoredImportSession>): Promise<void> => {
      const current = sessionRef.current;
      if (!current) return Promise.resolve();
      const next = { ...current, ...patch, updatedAt: Date.now() } as StoredImportSession;
      sessionRef.current = next;
      const chain = persistChainRef.current
        .then(async () => {
          await saveSession(next);
          if (!mountedRef.current) return;
          setSessions((list) => list.map((item) => (item.id === next.id ? next : item)));
        })
        .catch((e: unknown) => reportStoreError(e));
      persistChainRef.current = chain;
      return chain;
    },
    [reportStoreError],
  );

  /** Create a fresh session and persist the workbook bytes BEFORE parsing. */
  const startSession = useCallback(
    async (file: File, buffer?: ArrayBuffer) => {
      sessionRef.current = null;
      setActiveSessionId(null);
      if (!isImportStoreSupported()) {
        setSessionsError(true);
        setStoreNotice({
          title: "Local recovery is unavailable",
          detail:
            "This browser is not providing IndexedDB (private mode can block it). The import still works, but refreshing will lose progress.",
        });
        return;
      }
      const id = newSessionId();
      try {
        const bytes = buffer ?? (await fileToArrayBuffer(file));
        await saveWorkbook({ id, bytes, name: file.name, type: file.type });
        const now = Date.now();
        const record: StoredImportSession = {
          schema: 1,
          id,
          userId,
          createdAt: now,
          updatedAt: now,
          fileName: file.name,
          fileSize: file.size,
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
          batchSize: IMPORT_BATCH_SIZE,
          lastCompletedBatchIndex: -1,
          failedBatchIndex: null,
          batchResults: [],
          storagePath: null,
          preview: null,
          result: null,
          lastError: null,
        };
        await saveSession(record);
        sessionRef.current = record;
        setActiveSessionId(id);
        setSessions((list) => [record, ...list.filter((item) => item.id !== id)]);
        void acquireLease(id, TAB_OWNER);
        startHeartbeat(id);
      } catch (e: unknown) {
        // Never leave an orphaned blob behind when the session record failed.
        void deleteSession(id).catch(reportStoreError);
        sessionRef.current = null;
        reportStoreError(e);
      }
    },
    [reportStoreError, startHeartbeat, userId],
  );

  useEffect(() => {
    mountedRef.current = true;
    workbookClient.onOpenProgress = setReadStage;
    const releaseSessionOnPageHide = (event: PageTransitionEvent) => {
      if (event.persisted) return;
      stopHeartbeat();
      const active = sessionRef.current;
      if (active) void releaseLease(active.id, TAB_OWNER);
    };
    window.addEventListener("pagehide", releaseSessionOnPageHide);
    if (!isImportStoreSupported()) {
      setStoreNotice({
        title: "Local recovery is unavailable",
        detail:
          "This browser is not providing IndexedDB (private mode can block it). Imports will work, but saved recovery sessions cannot be listed.",
      });
    }
    void refreshSessions();
    return () => {
      mountedRef.current = false;
      workbookClient.onOpenProgress = null;
      // Free the worker and its retained workbook when the wizard goes away.
      workbookClient.cancel();
      // Releasing on teardown lets refresh/navigation resume immediately; if
      // cleanup is interrupted, the lease still expires after its normal TTL.
      stopHeartbeat();
      const active = sessionRef.current;
      if (active) void releaseLease(active.id, TAB_OWNER);
      window.removeEventListener("pagehide", releaseSessionOnPageHide);
    };
  }, [refreshSessions, stopHeartbeat]);

  const coverage = useMemo(
    () => mappingCoverage(sheet?.mapping ?? []),
    [sheet?.mapping],
  );

  const chooseFile = useCallback(
    async (file: File) => {
      setError(null);
      setPreview(null);
      setResult(null);
      setStoragePath(null);
      setBatchProgress(null);
      setReadStage(null);
      setStoreNotice(null);
      setBusy("reading");

      // A previous session (if any) is left in place — unfinished imports are
      // never auto-deleted — but its lease is handed back for other tabs.
      const previous = sessionRef.current;
      if (previous) {
        stopHeartbeat();
        void releaseLease(previous.id, TAB_OWNER);
      }
      // Read the file once so both persistence and parsing reuse the same bytes,
      // avoiding double memory usage on large workbooks.
      const fileBytes = await fileToArrayBuffer(file);

      // Persist bytes first so a refresh during parsing is still recoverable.
      await startSession(file, fileBytes);

      try {
        const nextBundle = await readWorkbookFile(file, fileBytes);
        // Default to the worksheet that actually holds the table: many workbooks
        // start with an empty or cover sheet ("Sheet1") while the data sits on
        // the second one, and opening the wrong sheet left the import stuck with
        // no columns mapped and both action buttons disabled.
        const choice = await inspectInitialSheet(nextBundle.sheetNames);
        const inspection = choice.inspection;
        if (!mountedRef.current) return;
        setBundle(nextBundle);
        setSheet(inspection);
        setStage("shape");
        if (choice.autoSwitched) {
          setStoreNotice({
            title: "Worksheet with data selected automatically",
            detail: `"${nextBundle.sheetNames[0]}" does not contain a readable import table, so "${inspection.sheetName}" was opened instead. Use the Worksheet dropdown on the next screen to change it.`,
          });
        }
        // Each checkpoint is written only after its underlying step succeeded.
        persistSession({
          fileHash: nextBundle.fileHash,
          sheetNames: nextBundle.sheetNames,
          checkpoint: "parsed",
        });
        persistSession({
          sheetName: inspection.sheetName,
          headerRow: inspection.headerRow,
          headers: inspection.headers,
          mapping: inspection.mapping,
          rowCount: inspection.rowCount,
          dataRowCount: inspection.dataRowCount,
          batchSize: IMPORT_BATCH_SIZE,
          lastCompletedBatchIndex: -1,
          failedBatchIndex: null,
          batchResults: [],
          checkpoint: "shaped",
        });
      } catch (e: any) {
        if (!mountedRef.current) return;
        if (e?.message === "Cancelled.") {
          // User cancelled mid-read: return to the picker without an error.
          setStage("choose");
        } else {
          setError({ title: "That file was not read", detail: e?.message ?? "Choose an Excel workbook.", retryable: true });
          setStage("choose");
        }
      } finally {
        if (mountedRef.current) {
          setBusy(null);
          setReadStage(null);
        }
      }
    },
    [persistSession, startSession, stopHeartbeat],
  );

  const selectSheet = useCallback(
    (sheetName: string) => {
      if (!bundle) return;
      setError(null);
      setPreview(null);
      setStoragePath(null);
      setBatchProgress(null);
      const previousHeaders = sheet?.headers ?? null;
      const previousMapping = sheet?.mapping ?? null;
      const seq = ++inspectSeqRef.current;
      void (async () => {
        try {
          const next = await inspectSheet(sheetName);
          if (!mountedRef.current || seq !== inspectSeqRef.current) return;
          // Only carry explicit choices across when the header row is identical.
          if (previousHeaders && previousHeaders.join("\u0000") === next.headers.join("\u0000")) {
            next.mapping = remapPreservingChoices(next.headers, previousMapping);
          }
          setSheet(next);
          setStage("shape");
          // Changing the sheet invalidates any earlier preview or upload.
          persistSession({
            sheetName: next.sheetName,
            headerRow: next.headerRow,
            headers: next.headers,
            mapping: next.mapping,
            rowCount: next.rowCount,
            dataRowCount: next.dataRowCount,
            batchSize: IMPORT_BATCH_SIZE,
            lastCompletedBatchIndex: -1,
            failedBatchIndex: null,
            batchResults: [],
            checkpoint: "shaped",
            storagePath: null,
            preview: null,
          });
        } catch (e: any) {
          if (!mountedRef.current || seq !== inspectSeqRef.current) return;
          setError({
            title: "That worksheet could not be read",
            detail: e?.message ?? "Pick another sheet.",
            retryable: true,
          });
        }
      })();
    },
    [bundle, persistSession, sheet],
  );

  const setHeaderRow = useCallback(
    (row: number) => {
      if (!bundle || !sheet) return;
      setError(null);
      setPreview(null);
      setStoragePath(null);
      setBatchProgress(null);
      const seq = ++inspectSeqRef.current;
      void (async () => {
        try {
          // A different header row is a different shape: start from auto-map again.
          const next = await inspectSheet(sheet.sheetName, row);
          if (!mountedRef.current || seq !== inspectSeqRef.current) return;
          setSheet(next);
          setStage("shape");
          persistSession({
            sheetName: next.sheetName,
            headerRow: next.headerRow,
            headers: next.headers,
            mapping: next.mapping,
            rowCount: next.rowCount,
            dataRowCount: next.dataRowCount,
            batchSize: IMPORT_BATCH_SIZE,
            lastCompletedBatchIndex: -1,
            failedBatchIndex: null,
            batchResults: [],
            checkpoint: "shaped",
            storagePath: null,
            preview: null,
          });
        } catch (e: any) {
          if (!mountedRef.current || seq !== inspectSeqRef.current) return;
          setError({
            title: "That header row could not be read",
            detail: e?.message ?? "Choose a different header row.",
            retryable: true,
          });
        }
      })();
    },
    [bundle, persistSession, sheet],
  );

  const setMappingField = useCallback(
    (index: number, field: CanonicalField | null) => {
      setError(null);
      setPreview(null);
      setStoragePath(null);
      setBatchProgress(null);
      setSheet((current) =>
        current ? { ...current, mapping: setField(current.mapping, index, field) } : current,
      );
      setStage("shape");
      const current = sessionRef.current;
      if (current?.mapping) {
        persistSession({
          mapping: setField(current.mapping, index, field),
          checkpoint: "shaped",
          lastCompletedBatchIndex: -1,
          failedBatchIndex: null,
          batchResults: [],
          storagePath: null,
          preview: null,
        });
      }
    },
    [persistSession],
  );

  const processRows = useCallback(async () => {
    if (!bundle || !sheet || busy || processingPromiseRef.current || coverage.missing.length > 0) return;
    // Only block if the sheet the operator actually selected is unreadable.
    // Other unavailable sheets in the same workbook do not block importing a
    // readable sheet.
    if (sheet && bundle.unavailableSheetNames.includes(sheet.sheetName)) {
      setError({
        title: "Import blocked: worksheet data is unavailable",
        detail: `The worksheet "${sheet.sheetName}" had no readable data. Open the workbook in Excel, use Move or Copy to copy that sheet into a new workbook, save it as .xlsx, and upload that copy.`,
        retryable: false,
      });
      return;
    }
    if (sheet.dataRowCount > IMPORT_MAX_ROWS) {
      setError({
        title: "Worksheet exceeds the import row limit",
        detail: `This worksheet has approximately ${sheet.dataRowCount.toLocaleString()} rows, above the configured limit of ${IMPORT_MAX_ROWS.toLocaleString()}. Split it into smaller workbooks before processing.`,
        retryable: false,
      });
      return;
    }
    setBusy("processing");
    const active = sessionRef.current;
    const batchSize = active?.batchSize ?? IMPORT_BATCH_SIZE;
    const dataRowCount = sheet.dataRowCount;
    const totalBatches = Math.ceil(dataRowCount / batchSize);

    if (active && !(await acquireLease(active.id, TAB_OWNER))) {
      setBusy(null);
      setStoreNotice({
        title: "Session is active in another tab",
        detail: "Switch to the tab holding this import session before processing more rows.",
      });
      return;
    }

    processingControlRef.current = null;
    setError(null);
    setBatchProgress({
      completedBatches: Math.max(0, (active?.lastCompletedBatchIndex ?? -1) + 1),
      totalBatches,
      failedBatchIndex: active?.failedBatchIndex ?? null,
      validRows: active?.batchResults.reduce((sum, item) => sum + item.summary.valid_rows, 0) ?? 0,
      invalidRows: active?.batchResults.reduce((sum, item) => sum + item.summary.invalid_rows, 0) ?? 0,
    });

    const run = async () => {
      let failedBatchIndex: number | null = null;
      try {
        await persistChainRef.current;
        const latest = sessionRef.current;
        let lastCompleted = latest?.lastCompletedBatchIndex ?? -1;
        if (totalBatches === 0 && latest) {
          await persistSession({
            dataRowCount,
            checkpoint: "processed",
            lastCompletedBatchIndex: -1,
            failedBatchIndex: null,
            status: "in_progress",
          });
        }

        for (let batchIndex = lastCompleted + 1; batchIndex < totalBatches; batchIndex += 1) {
          if (processingControlRef.current) break;
          failedBatchIndex = batchIndex;
          const result = await workbookClient.processBatch({
            sheetName: sheet.sheetName,
            headerRow: sheet.headerRow,
            headers: sheet.headers,
            mapping: sheet.mapping,
            batchIndex,
            batchSize,
          });

          const session = sessionRef.current;
          if (session) {
            const write = persistChainRef.current.then(() =>
              saveBatchCheckpoint(session.id, result, totalBatches),
            );
            persistChainRef.current = write.then(() => undefined, () => undefined);
            const saved = await write;
            sessionRef.current = saved;
            if (mountedRef.current) {
              setSessions((list) => list.map((item) => (item.id === saved.id ? saved : item)));
            }
            lastCompleted = saved.lastCompletedBatchIndex;
          } else {
            lastCompleted = batchIndex;
          }

          const savedResults = sessionRef.current?.batchResults ?? [];
          const currentResults = sessionRef.current ? savedResults : [];
          setBatchProgress({
            completedBatches: lastCompleted + 1,
            totalBatches,
            failedBatchIndex: null,
            validRows: sessionRef.current
              ? currentResults.reduce((sum, item) => sum + item.summary.valid_rows, 0)
              : result.summary.valid_rows,
            invalidRows: sessionRef.current
              ? currentResults.reduce((sum, item) => sum + item.summary.invalid_rows, 0)
              : result.summary.invalid_rows,
          });
        }

        if (failedBatchIndex !== null && lastCompleted < failedBatchIndex) {
          const message =
            processingControlRef.current === "pause"
              ? "Processing paused after the last saved batch."
              : "Processing was cancelled after the last saved batch.";
          setStoreNotice({ title: "Batch processing stopped", detail: message });
          return;
        }
        await refreshSessions();
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "The current batch could not be processed.";
        const session = sessionRef.current;
        if (session && failedBatchIndex !== null) {
          const failed = {
            ...session,
            failedBatchIndex,
            lastError: message,
            status: "paused" as const,
            updatedAt: Date.now(),
          };
          try {
            await saveSession(failed);
            sessionRef.current = failed;
            setSessions((list) => list.map((item) => (item.id === failed.id ? failed : item)));
          } catch (storeError) {
            reportStoreError(storeError);
          }
        }
        setBatchProgress((current) =>
          current ? { ...current, failedBatchIndex } : current,
        );
        setError({
          title: "Batch processing stopped",
          detail: `${message} Successfully saved batches are kept. Retry to continue from the first unsaved batch.`,
          retryable: true,
        });
        if (cause instanceof Error && "code" in cause) reportStoreError(cause);
      } finally {
        if (mountedRef.current) setBusy(null);
        processingControlRef.current = null;
      }
    };

    const operation = run();
    processingPromiseRef.current = operation;
    try {
      await operation;
    } finally {
      if (processingPromiseRef.current === operation) processingPromiseRef.current = null;
    }
  }, [
    bundle,
    busy,
    batchProgress,
    coverage.missing.length,
    persistSession,
    refreshSessions,
    reportStoreError,
    sheet,
  ]);

  const validate = useCallback(async () => {
    if (!userId || !bundle || !sheet) return;
    if (sheet.dataRowCount > IMPORT_MAX_ROWS) {
      setError({
        title: "Worksheet exceeds the import row limit",
        detail: `This worksheet has approximately ${sheet.dataRowCount.toLocaleString()} rows, above the configured limit of ${IMPORT_MAX_ROWS.toLocaleString()}. Split it into smaller workbooks before validation.`,
        retryable: false,
      });
      return;
    }
    const active = sessionRef.current;
    const totalBatches = Math.ceil(
      sheet.dataRowCount / (active?.batchSize ?? IMPORT_BATCH_SIZE),
    );
    if (active && active.lastCompletedBatchIndex + 1 < totalBatches) {
      setError({
        title: "Process all rows before validation",
        detail: "Run the worker batch checks through the entire worksheet. You can resume from the last saved batch after a refresh.",
        retryable: false,
      });
      return;
    }
    if (coverage.missing.length) {
      setError({
        title: "Required columns are not mapped",
        detail: `Map ${coverage.missing.join(", ")} before validating.`,
        retryable: false,
      });
      return;
    }

    setBusy("validating");
    setError(null);
    try {
      let path = storagePath;
      if (!path) {
        const uploaded = await uploadWorkbook({ userId, file: bundle.file, fileHash: bundle.fileHash });
        path = uploaded.path;
        setStoragePath(path);
        // Upload succeeded -> safe to record the storage path checkpoint.
        persistSession({ storagePath: path, checkpoint: "uploaded" });
      }
      const payload = {
        storage_path: path,
        sheet_name: sheet.sheetName,
        header_row: sheet.headerRow,
        column_mapping: sheet.mapping as ColumnMapping,
        file_hash: bundle.fileHash,
        file_name: bundle.file.name,
      };
      const nextPreview = await previewImport(payload);
      setPreview(nextPreview);
      setDuplicateConfirmed(false);
      setStage("preview");
      // Server returned a full preview -> safe to persist it as the checkpoint.
      persistSession({ preview: nextPreview, checkpoint: "validated", lastError: null });
    } catch (e: any) {
      setError(toWizardError(e, "Validation could not run"));
      persistSession({ lastError: e?.message ?? "validation_failed" });
    } finally {
      setBusy(null);
    }
  }, [bundle, coverage.missing, persistSession, sheet, storagePath, userId]);

  const commit = useCallback(async () => {
    if (!userId || !bundle || !sheet || !preview) return;
    if (preview.duplicate && !duplicateConfirmed) {
      setError({
        title: "Duplicate import not confirmed",
        detail: "This file and sheet were imported before. Confirm the duplicate policy to store a new version.",
        retryable: false,
      });
      return;
    }

    setBusy("committing");
    setError(null);
    try {
      let path = storagePath;
      if (!path) {
        const uploaded = await uploadWorkbook({ userId, file: bundle.file, fileHash: bundle.fileHash });
        path = uploaded.path;
        setStoragePath(path);
        persistSession({ storagePath: path, checkpoint: "uploaded" });
      }
      // Marker written BEFORE the commit request: if the tab dies mid-commit,
      // resume finds "committing" and re-validates instead of blindly re-running
      // the commit (the server's duplicate check then reports what landed).
      await persistSession({ checkpoint: "committing", lastError: null });
      const committed = await commitImport({
        storage_path: path,
        sheet_name: sheet.sheetName,
        header_row: sheet.headerRow,
        column_mapping: sheet.mapping as ColumnMapping,
        file_hash: bundle.fileHash,
        file_name: bundle.file.name,
        confirm_duplicate: duplicateConfirmed,
      });
      setResult(committed);
      setStage("committed");
      // Server confirmed the commit -> this checkpoint is now authoritative.
      persistSession({
        result: committed,
        checkpoint: "committed",
        status: "completed",
        lastError: null,
      });
      onCommitted?.();
    } catch (e: any) {
      // The outcome is known (the request returned), so step back to the last
      // safe checkpoint and remember why. Only a tab crash leaves "committing".
      persistSession({
        checkpoint: "validated",
        lastError: e?.message ?? "commit_failed",
      });
      if (isDuplicateConflict(e)) {
        const duplicate = e.payload?.duplicate ?? preview.duplicate;
        setPreview((current) => (current ? { ...current, duplicate, can_commit: true } : current));
        setError({
          title: "This workbook was already imported",
          detail:
            "A previous committed version has the same fingerprint and sheet. Confirm the duplicate policy to store a new version.",
          retryable: false,
          duplicate: duplicate ?? undefined,
        });
      } else {
        setError(toWizardError(e, "The import could not be committed"));
      }
    } finally {
      setBusy(null);
    }
  }, [bundle, duplicateConfirmed, onCommitted, persistSession, preview, sheet, storagePath, userId]);

  /**
   * Restore a persisted session: reinit the worker by re-reading the stored
   * bytes, re-inspect the sheet, and land on the stage matching the last
   * persisted checkpoint. Never re-commits a "committed" session, and a
   * "committing" session re-runs validation first so server-side duplicate
   * detection decides — no silently duplicated rows.
   */
  const resumeSession = useCallback(
    async (id: string) => {
      if (busy) return;
      setStoreNotice(null);
      setError(null);

      const record = await getSession(id);
      if (!record) {
        setStoreNotice({
          title: "Saved session could not be restored",
          detail:
            "The local session record is missing or damaged and was cleaned up. Choose the workbook again to start over.",
        });
        await refreshSessions();
        return;
      }
      if (!isResumable(record)) {
        setStoreNotice({
          title: "This import is already complete",
          detail: "Completed imports cannot be resumed. View the committed record in import history.",
        });
        await refreshSessions();
        return;
      }

      // Hand back any other session this tab was holding.
      const held = sessionRef.current;
      if (held && held.id !== id) {
        stopHeartbeat();
        await releaseLease(held.id, TAB_OWNER);
        sessionRef.current = null;
      }

      const leased = await acquireLease(id, TAB_OWNER);
      if (!leased) {
        setStoreNotice({
          title: "Session could not be opened safely",
          detail:
            "Another tab may be processing this import, or local storage may be unavailable. Check the other tab and browser storage before trying again.",
        });
        return;
      }
      setActiveSessionId(id);

      const stored = await loadWorkbook(id);
      if (!stored) {
        stopHeartbeat();
        await releaseLease(id, TAB_OWNER);
        setActiveSessionId(null);
        setStoreNotice({
          title: "Workbook file is missing",
          detail:
            "The stored copy of this workbook is gone (browser storage may have been cleared). Delete this session and upload the file again.",
        });
        await refreshSessions();
        return;
      }

      setBusy("reading");
      try {
        const file = new File([stored.bytes], stored.name, { type: stored.type });
        // Re-parse through the worker: this reinitializes it with the workbook.
        // Pass the stored bytes so the file is not read a second time.
        const nextBundle = await readWorkbookFile(file, stored.bytes);
        const inspection =
          record.sheetName && nextBundle.sheetNames.includes(record.sheetName)
            ? await inspectSheet(record.sheetName, record.headerRow ?? undefined)
            : (await inspectInitialSheet(nextBundle.sheetNames)).inspection;
        if (!mountedRef.current) return;

        const headersMatch =
          record.headers.length > 0 &&
          record.headers.join("\u0000") === inspection.headers.join("\u0000");
        const restoredMapping =
          headersMatch && record.mapping ? remapPreservingChoices(inspection.headers, record.mapping) : null;
        const nextSheet: SheetInspection = restoredMapping
          ? { ...inspection, mapping: restoredMapping }
          : inspection;

        const showPreview =
          record.checkpoint === "validated" ||
          record.checkpoint === "committing" ||
          record.checkpoint === "committed";

        // Demo uploads live in an in-memory bucket that a refresh clears, so a
        // resumed demo session must re-upload before validating again.
        const restoredPath = isDemoMode ? null : record.storagePath;

        setBundle(nextBundle);
        setSheet(nextSheet);
        setPreview(showPreview ? record.preview : null);
        setResult(record.checkpoint === "committed" ? record.result : null);
        setDuplicateConfirmed(false);
        setReadStage(null);
        setStoragePath(restoredPath);
        sessionRef.current = {
          ...record,
          fileHash: nextBundle.fileHash,
          sheetNames: nextBundle.sheetNames,
          sheetName: nextSheet.sheetName,
          headerRow: nextSheet.headerRow,
          headers: nextSheet.headers,
          mapping: nextSheet.mapping,
          rowCount: nextSheet.rowCount,
          dataRowCount: nextSheet.dataRowCount,
          lastCompletedBatchIndex: headersMatch ? record.lastCompletedBatchIndex : -1,
          failedBatchIndex: headersMatch ? record.failedBatchIndex : null,
          batchResults: headersMatch ? record.batchResults : [],
          checkpoint:
            !headersMatch && record.lastCompletedBatchIndex >= 0 ? "shaped" : record.checkpoint,
          storagePath: restoredPath,
          status: record.status === "completed" ? "completed" : "in_progress",
        };
        const restoredResults = headersMatch ? record.batchResults : [];
        setBatchProgress({
          completedBatches: headersMatch ? record.lastCompletedBatchIndex + 1 : 0,
          totalBatches: Math.ceil(nextSheet.dataRowCount / record.batchSize),
          failedBatchIndex: headersMatch ? record.failedBatchIndex : null,
          validRows: restoredResults.reduce((sum, item) => sum + item.summary.valid_rows, 0),
          invalidRows: restoredResults.reduce((sum, item) => sum + item.summary.invalid_rows, 0),
        });
        await persistSession({});
        startHeartbeat(id);

        if (record.mapping && !headersMatch) {
          setStoreNotice({
            title: "Column layout changed",
            detail:
              "The stored mapping no longer matches this file's headers, so columns were re-detected. Review the mapping before validating.",
          });
        }

        if (record.checkpoint === "committed" && record.result) {
          setStage("committed");
        } else if (record.checkpoint === "validated" && record.preview) {
          setStage("preview");
        } else if (record.checkpoint === "committing") {
          // Unknown commit outcome: re-validate first. The server's duplicate
          // detection (file hash + sheet) reports whether it actually landed.
          setStage("shape");
          autoValidateRef.current = true;
        } else {
          setStage("shape");
        }
      } catch (e: any) {
        stopHeartbeat();
        await releaseLease(id, TAB_OWNER);
        sessionRef.current = null;
        setActiveSessionId(null);
        if (!mountedRef.current) return;
        if (e?.message === "Cancelled.") {
          setStage("choose");
        } else {
          setError({
            title: "The saved session could not be restored",
            detail: e?.message ?? "The stored workbook could not be reopened. Try resuming again.",
            retryable: true,
          });
          setStage("choose");
        }
      } finally {
        if (mountedRef.current) {
          setBusy(null);
          setReadStage(null);
        }
      }
    },
    [busy, persistSession, refreshSessions, startHeartbeat, stopHeartbeat],
  );

  // A "committing" resume lands on the shape stage and re-validates once the
  // restored bundle/sheet are actually in state (fresh closures).
  useEffect(() => {
    if (!autoValidateRef.current) return;
    if (stage !== "shape" || busy || !bundle || !sheet) return;
    autoValidateRef.current = false;
    void validate();
  }, [bundle, busy, sheet, stage, validate]);

  /** Update one session record (active sessions go through the write chain). */
  const updateSession = useCallback(
    async (
      id: string,
      patch: Partial<StoredImportSession>,
    ): Promise<StoredImportSession | null> => {
      const isActive = sessionRef.current?.id === id;
      const base = isActive ? sessionRef.current! : await getSession(id);
      if (!base) return null;
      if (isActive) {
        sessionRef.current = { ...base, ...patch, updatedAt: Date.now() } as StoredImportSession;
        await persistSession({});
        return sessionRef.current;
      }
      const next = { ...base, ...patch, updatedAt: Date.now() } as StoredImportSession;
      try {
        await saveSession(next);
        setSessions((list) => list.map((item) => (item.id === id ? next : item)));
      } catch (e: unknown) {
        reportStoreError(e);
      }
      return next;
    },
    [persistSession, reportStoreError],
  );

  const reset = useCallback(() => {
    // Invalidate any in-flight inspection and free the parser's workbook.
    inspectSeqRef.current += 1;
    workbookClient.cancel();
    stopHeartbeat();
    const active = sessionRef.current;
    if (active) void releaseLease(active.id, TAB_OWNER);
    sessionRef.current = null;
    setActiveSessionId(null);
    autoValidateRef.current = false;
    setStage("choose");
    setBundle(null);
    setSheet(null);
    setPreview(null);
    setResult(null);
    setStoragePath(null);
    setError(null);
    setReadStage(null);
    setDuplicateConfirmed(false);
    setBusy(null);
    setBatchProgress(null);
    void refreshSessions();
  }, [refreshSessions, stopHeartbeat]);

  const pauseProcessing = useCallback(async () => {
    const active = sessionRef.current;
    if (active && processingPromiseRef.current) {
      processingControlRef.current = "pause";
      await processingPromiseRef.current;
      await updateSession(active.id, { status: "paused" });
      stopHeartbeat();
      await releaseLease(active.id, TAB_OWNER);
      reset();
      await refreshSessions();
    }
  }, [refreshSessions, reset, stopHeartbeat, updateSession]);

  const pauseSession = useCallback(
    async (id: string) => {
      const isActive = sessionRef.current?.id === id;
      if (await isLeaseHeldByOther(id, TAB_OWNER)) {
        setStoreNotice({
          title: "Session is active in another tab",
          detail: "Switch to that tab to pause or cancel this import.",
        });
        return;
      }
      if (isActive && processingPromiseRef.current) {
        processingControlRef.current = "pause";
        await processingPromiseRef.current;
      }
      if (isActive) stopHeartbeat();
      await releaseLease(id, TAB_OWNER);
      await updateSession(id, { status: "paused" });
      if (isActive) reset();
      await refreshSessions();
    },
    [refreshSessions, reset, stopHeartbeat, updateSession],
  );

  const cancelSession = useCallback(
    async (id: string) => {
      if (await isLeaseHeldByOther(id, TAB_OWNER)) {
        setStoreNotice({
          title: "Session is active in another tab",
          detail: "Switch to that tab to pause or cancel this import.",
        });
        return;
      }
      if (sessionRef.current?.id === id && processingPromiseRef.current) {
        processingControlRef.current = "cancel";
        await processingPromiseRef.current;
      }
      // Status first (while the record is still "active" so the write goes
      // through the serialized chain), then drop the wizard's hold on it.
      await updateSession(id, { status: "cancelled" });
      if (sessionRef.current?.id === id) reset();
      await releaseLease(id, TAB_OWNER);
      // Cancelling keeps the data: the session and its bytes stay until the
      // user explicitly deletes or clears them.
      await refreshSessions();
    },
    [refreshSessions, reset, updateSession],
  );

  const removeSession = useCallback(
    async (id: string) => {
      if (await isLeaseHeldByOther(id, TAB_OWNER)) {
        setStoreNotice({
          title: "Session is active in another tab",
          detail: "Switch to that tab before deleting this import session.",
        });
        return;
      }
      if (sessionRef.current?.id === id) reset();
      await deleteSession(id);
      await refreshSessions();
    },
    [refreshSessions, reset],
  );

  const clearFinishedSessions = useCallback(async () => {
    // Only finished or long-expired sessions — never the active one, and
    // never an unfinished recent import (nothing is auto-deleted, ever).
    const ids = sessions
      .filter((item) => item.id !== activeSessionId && isClearable(item))
      .map((item) => item.id);
    if (!ids.length) return;
    try {
      await clearSessions(ids);
      await refreshSessions();
    } catch (error: unknown) {
      reportStoreError(error);
    }
  }, [activeSessionId, refreshSessions, reportStoreError, sessions]);

  const setDuplicateConfirmedValue = useCallback((value: boolean) => {
    setDuplicateConfirmed(value);
  }, []);

  /** Abort an in-flight read and drop any retained workbook memory. */
  const cancelRead = useCallback(() => {
    workbookClient.cancel();
  }, []);

  const backToShape = useCallback(() => {
    setError(null);
    setPreview(null);
    setStage("shape");
  }, []);

  const dismissStoreNotice = useCallback(() => setStoreNotice(null), []);

  return {
    stage,
    bundle,
    sheet,
    preview,
    result,
    busy,
    batchProgress,
    readStage,
    error,
    duplicateConfirmed,
    coverage,
    chooseFile,
    selectSheet,
    setHeaderRow,
    setMappingField,
    processRows,
    pauseProcessing,
    validate,
    commit,
    setDuplicateConfirmed: setDuplicateConfirmedValue,
    cancelRead,
    backToShape,
    reset,
    sessions,
    sessionsLoading,
    sessionsError,
    activeSessionId,
    storeNotice,
    dismissStoreNotice,
    resumeSession,
    pauseSession,
    cancelSession,
    removeSession,
    clearFinishedSessions,
  };
}
