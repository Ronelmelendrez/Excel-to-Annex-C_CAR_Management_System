import { IMPORT_MAX_BYTES } from "./import-limits";
import { workbookClient, type WorkbookBundle } from "./workbook-client";

/**
 * What actually gets uploaded for an import.
 *
 * Supabase rejects any single object above IMPORT_MAX_BYTES, so the cap is
 * applied to the upload — never to the workbook sitting on disk:
 *   - a workbook that fits is uploaded as-is (byte-for-byte unchanged);
 *   - a larger workbook is reduced, at save time, to a copy of ONLY the
 *     worksheet being imported, so a 59.7 MB roster with a 12 MB sheet
 *     imports fine — the limit counts the sheet's data, not the whole file.
 *
 * `hash` is always the SHA-256 of `file`, because the server recomputes it
 * from the stored bytes and rejects any mismatch (fingerprint_mismatch).
 * For a reduced upload that is the extract's hash; SheetJS writes
 * deterministic bytes, so re-extracting the same sheet later yields the same
 * hash — resume, content-addressed storage paths, and duplicate detection
 * keep working without any server-side change.
 */
export type UploadTarget = {
  /** The bytes to upload: the original workbook, or a single-sheet copy. */
  file: File;
  /** SHA-256 of `file` — sent as file_hash and verified by the server. */
  hash: string;
  /** True when only the chosen sheet is uploaded instead of the whole workbook. */
  extracted: boolean;
  /** Size of the original workbook, for user-facing messages. */
  sourceSize: number;
};

function mb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function wholeMb(bytes: number): string {
  return String(Math.max(1, Math.round(bytes / (1024 * 1024))));
}

/**
 * Resolve the upload for (workbook, sheet). Cheap when the workbook fits —
 * it returns the file untouched — and otherwise asks the parser thread for a
 * single-sheet copy of the chosen worksheet. Throws a sheet-scoped message
 * when even that sheet exceeds the cap, so the operator knows exactly what
 * to split.
 */
export async function buildUploadTarget(
  source: Pick<WorkbookBundle, "file" | "fileHash">,
  sheetName: string,
  maxBytes: number = IMPORT_MAX_BYTES,
): Promise<UploadTarget> {
  const sourceSize = source.file.size;
  if (sourceSize <= maxBytes) {
    return { file: source.file, hash: source.fileHash, extracted: false, sourceSize };
  }

  const extracted = await workbookClient.extractSheet(sheetName);
  if (extracted.size > maxBytes) {
    throw new Error(
      `The worksheet "${sheetName}" alone is ${mb(extracted.size)} MB — over the ${wholeMb(maxBytes)} MB limit. ` +
        `Your workbook is ${mb(sourceSize)} MB, but only the sheet you import is uploaded, so the other sheets do not count. ` +
        `In Excel, split this worksheet's rows into smaller files, save each as .xlsx, and import them one at a time.`,
    );
  }
  return {
    file: new File([extracted.buffer], source.file.name, {
      type:
        source.file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    hash: extracted.hash,
    extracted: true,
    sourceSize,
  };
}
