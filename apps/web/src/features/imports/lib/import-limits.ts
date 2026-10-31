import { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS } from "@import-domain";

/**
 * Effective import limits.
 *
 * The shared domain exports safe defaults that also guard the server. The web
 * build can override them with Vite env vars without touching shared code:
 *
 *   VITE_IMPORT_MAX_MB=100     # byte cap for the workbook the browser/server will accept
 *   VITE_IMPORT_MAX_ROWS=1000000  # per-sheet row cap enforced during validation
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

/** Byte cap for an uploaded workbook (default 100 MB). */
export const IMPORT_MAX_MB = readPositiveMb(import.meta.env.VITE_IMPORT_MAX_MB, DEFAULT_MB);
export const IMPORT_MAX_BYTES = IMPORT_MAX_MB * 1024 * 1024;

/** Per-sheet row cap enforced during validation (default 1,000,000). */
export const IMPORT_MAX_ROWS = readPositiveInt(import.meta.env.VITE_IMPORT_MAX_ROWS, MAX_IMPORT_ROWS);

/** Rows converted and validated per worker request. */
export const IMPORT_BATCH_SIZE = 20_000;
