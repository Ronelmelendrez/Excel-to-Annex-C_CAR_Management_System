import { useCallback, useMemo, useState } from "react";
import type { CanonicalField, ColumnMapping } from "@import-domain";
import {
  inspectSheet,
  mappingCoverage,
  readWorkbookFile,
  remapPreservingChoices,
  setMappingField as setField,
  type WorkbookBundle,
} from "../lib/analysis";
import { commitImport, isDuplicateConflict, previewImport, uploadWorkbook } from "../api";
import type {
  CommitResponse,
  DuplicateImport,
  ImportPreview,
  SheetInspection,
  WizardError,
  WizardStage,
} from "../types";

export type ImportWizard = {
  stage: WizardStage;
  bundle: WorkbookBundle | null;
  sheet: SheetInspection | null;
  preview: ImportPreview | null;
  result: CommitResponse | null;
  busy: "reading" | "validating" | "committing" | null;
  error: (WizardError & { duplicate?: DuplicateImport }) | null;
  duplicateConfirmed: boolean;
  coverage: ReturnType<typeof mappingCoverage>;
  chooseFile: (file: File) => Promise<void>;
  selectSheet: (sheetName: string) => void;
  setHeaderRow: (row: number) => void;
  setMappingField: (index: number, field: CanonicalField | null) => void;
  validate: () => Promise<void>;
  commit: () => Promise<void>;
  setDuplicateConfirmed: (value: boolean) => void;
  backToShape: () => void;
  reset: () => void;
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
  const [error, setError] = useState<ImportWizard["error"]>(null);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);
  const [storagePath, setStoragePath] = useState<string | null>(null);

  const coverage = useMemo(
    () => mappingCoverage(sheet?.mapping ?? []),
    [sheet?.mapping],
  );

  const chooseFile = useCallback(async (file: File) => {
    setError(null);
    setPreview(null);
    setResult(null);
    setStoragePath(null);
    setBusy("reading");
    try {
      const nextBundle = await readWorkbookFile(file);
      const inspection = inspectSheet(nextBundle, nextBundle.sheetNames[0]);
      setBundle(nextBundle);
      setSheet(inspection);
      setStage("shape");
    } catch (e: any) {
      setError({ title: "That file was not read", detail: e?.message ?? "Choose an Excel workbook.", retryable: true });
      setStage("choose");
    } finally {
      setBusy(null);
    }
  }, []);

  const selectSheet = useCallback(
    (sheetName: string) => {
      if (!bundle) return;
      setError(null);
      setPreview(null);
      setStoragePath(null);
      const next = inspectSheet(bundle, sheetName);
      // Only carry explicit choices across when the header row is identical.
      if (sheet && sheet.headers.join("\u0000") === next.headers.join("\u0000")) {
        next.mapping = remapPreservingChoices(next.headers, sheet.mapping);
      }
      setSheet(next);
      setStage("shape");
    },
    [bundle, sheet],
  );

  const setHeaderRow = useCallback(
    (row: number) => {
      if (!bundle || !sheet) return;
      setError(null);
      setPreview(null);
      setStoragePath(null);
      // A different header row is a different shape: start from auto-map again.
      setSheet(inspectSheet(bundle, sheet.sheetName, row));
      setStage("shape");
    },
    [bundle, sheet],
  );

  const setMappingField = useCallback(
    (index: number, field: CanonicalField | null) => {
      setError(null);
      setPreview(null);
      setStoragePath(null);
      setSheet((current) =>
        current ? { ...current, mapping: setField(current.mapping, index, field) } : current,
      );
      setStage("shape");
    },
    [],
  );

  const validate = useCallback(async () => {
    if (!userId || !bundle || !sheet) return;
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
    } catch (e: any) {
      setError(toWizardError(e, "Validation could not run"));
    } finally {
      setBusy(null);
    }
  }, [bundle, coverage.missing, sheet, storagePath, userId]);

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
      }
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
      onCommitted?.();
    } catch (e: any) {
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
  }, [bundle, duplicateConfirmed, onCommitted, preview, sheet, storagePath, userId]);

  const backToShape = useCallback(() => {
    setError(null);
    setPreview(null);
    setStage("shape");
  }, []);

  const reset = useCallback(() => {
    setStage("choose");
    setBundle(null);
    setSheet(null);
    setPreview(null);
    setResult(null);
    setStoragePath(null);
    setError(null);
    setDuplicateConfirmed(false);
    setBusy(null);
  }, []);

  return {
    stage,
    bundle,
    sheet,
    preview,
    result,
    busy,
    error,
    duplicateConfirmed,
    coverage,
    chooseFile,
    selectSheet,
    setHeaderRow,
    setMappingField,
    validate,
    commit,
    setDuplicateConfirmed,
    backToShape,
    reset,
  };
}
