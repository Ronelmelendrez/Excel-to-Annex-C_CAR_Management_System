import { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS } from "@import-domain";

/**
 * Effective import limits.
 *
 * The shared domain exports safe defaults that also guard the server. The web
 * build can override them with Vite env vars without touching shared code:
 *
 *   VITE_IMPORT_MAX_MB=50      # byte cap for the upload (see below)
 *   VITE_IMPORT_MAX_ROWS=1000000  # per-sheet row cap enforced during validation
 *
 * The MB cap applies to what gets uploaded, NOT to the workbook on disk: a
 * file that fits is uploaded as-is; a larger one is reduced at save time to a
 * single-sheet copy of the worksheet being imported (lib/upload-target.ts),
 * so the limit counts the imported sheet's data rather than the whole Excel
 * file. The server enforces the same cap on the stored bytes.
 *
 * Values are validated here so a bad env var degrades to the safe default
 * rather than producing an unusable or unlimited import.
 */

function readPositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function readPositiveMb(raw: string | undefined, fallbackMb: number): number {
  return readPositiveInt(raw, fallbackMb);
}

const DEFAULT_MB = Math.round(MAX_IMPORT_BYTES / (1024 * 1024));

/** Byte cap for an uploaded workbook or single-sheet extract (default 50 MB). */
export const IMPORT_MAX_MB = readPositiveMb(import.meta.env.VITE_IMPORT_MAX_MB, DEFAULT_MB);
export const IMPORT_MAX_BYTES = IMPORT_MAX_MB * 1024 * 1024;

/** Per-sheet row cap enforced during validation (default 1,000,000). */
export const IMPORT_MAX_ROWS = readPositiveInt(import.meta.env.VITE_IMPORT_MAX_ROWS, MAX_IMPORT_ROWS);

/** Rows converted and validated per worker request. */
export const IMPORT_BATCH_SIZE = 20_000;
