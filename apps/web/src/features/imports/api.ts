import { isDemoMode, supabase } from '../../shared/supabase';
import { apiBase, apiCall, authHeaders, ApiError } from '../../shared/api';
import { IMPORT_MAX_MB } from './lib/import-limits';
import {
  demoCommit,
  demoErrorReportCsv,
  demoListImports,
  demoPreview,
  demoUploadWorkbook,
} from './lib/demo-backend';
import type {
  CommitRequest,
  CommitResponse,
  ImportListResponse,
  ImportPreview,
  PreviewRequest,
} from './types';

const BUCKET = 'imports';

function safeName(name: string) {
  const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return (cleaned || 'workbook.xlsx').slice(0, 180);
}

export function storagePathFor(userId: string, fileHash: string, fileName: string) {
  return `${userId}/${fileHash}/${safeName(fileName)}`;
}

/**
 * The hash folder a storage path was uploaded under (`userId/<hash>/<name>`).
 *
 * Paths are content-addressed: the folder IS the SHA-256 of the bytes that
 * were uploaded. Comparing it against the current upload target's hash proves
 * the stored object already holds exactly those bytes — no re-upload needed —
 * and catches a stored copy of a different sheet (or an older workbook) that
 * must be replaced before validating.
 */
export function storageHashFromPath(path: string | null | undefined): string | null {
  const folder = path?.split("/")[1] ?? "";
  return /^[0-9a-f]{64}$/.test(folder) ? folder : null;
}

export async function uploadWorkbook(params: {
  userId: string;
  file: File;
  fileHash: string;
}): Promise<{ path: string }> {
  const path = storagePathFor(params.userId, params.fileHash, params.file.name);
  if (isDemoMode) {
    // Demo mode keeps the file in memory; no storage bucket is touched.
    return demoUploadWorkbook(path, params.file);
  }
  const { error } = await supabase.storage.from(BUCKET).upload(path, params.file, {
    upsert: false,
    contentType: params.file.type || 'application/octet-stream',
    cacheControl: '3600',
  });
  // Content-addressed path: an existing object is the same workbook bytes.
  const status = (error as { statusCode?: number | string } | null)?.statusCode;
  const message = (error as { message?: string } | null)?.message ?? '';
  if (error && status !== 409) {
    // Storage rejects oversized bodies (413, surfaced under HTTP 400) with a
    // generic payload message; turn it into guidance the operator can act on.
    const sizeRejected =
      status === 413 ||
      status === '413' ||
      ((status === 400 || status === '400') && /size|large|exceed/i.test(message)) ||
      /exceed|too large|payload too large/i.test(message);
    if (sizeRejected) {
      throw new Error(
        `The upload exceeded the ${IMPORT_MAX_MB} MB limit allowed by this Supabase project. Import a smaller worksheet, then try again.`,
      );
    }
    throw new Error(
      'The workbook could not be uploaded to private storage. Check your connection and try again.',
    );
  }
  return { path };
}

export async function previewImport(payload: PreviewRequest): Promise<ImportPreview> {
  if (isDemoMode) {
    try {
      return await demoPreview(payload);
    } catch (error) {
      throw normalizeImportError(error, 'Validation could not run');
    }
  }
  try {
    return (await apiCall('/imports', {
      method: 'POST',
      body: JSON.stringify({ action: 'preview', ...payload }),
    })) as ImportPreview;
  } catch (error) {
    throw normalizeImportError(error, 'Validation could not run');
  }
}

export async function commitImport(payload: CommitRequest): Promise<CommitResponse> {
  if (isDemoMode) {
    try {
      return await demoCommit(payload);
    } catch (error) {
      throw normalizeImportError(error, 'The import could not be committed');
    }
  }
  try {
    return (await apiCall('/imports', {
      method: 'POST',
      body: JSON.stringify({ action: 'commit', ...payload }),
    })) as CommitResponse;
  } catch (error) {
    throw normalizeImportError(error, 'The import could not be committed');
  }
}

export async function listImports(params: { limit?: number; offset?: number } = {}): Promise<ImportListResponse> {
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;
  if (isDemoMode) {
    return demoListImports(limit, offset);
  }
  try {
    return (await apiCall(`/imports?action=list&limit=${limit}&offset=${offset}`)) as ImportListResponse;
  } catch (error) {
    throw normalizeImportError(error, 'Import history could not be loaded');
  }
}

export async function fetchErrorReportCsv(importId: string): Promise<string> {
  if (isDemoMode) {
    try {
      return demoErrorReportCsv(importId);
    } catch (error) {
      throw error instanceof Error ? error : new Error('The error report could not be downloaded.');
    }
  }
  const headers = await authHeaders();
  const res = await fetch(`${apiBase()}/imports?action=errors&id=${encodeURIComponent(importId)}`, {
    headers,
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error('The error report is no longer available.');
    throw new Error('The error report could not be downloaded. Try again.');
  }
  return res.text();
}

export function normalizeImportError(error: unknown, fallbackTitle: string): ApiError {
  if (error instanceof ApiError) {
    // 546 WORKER_RESOURCE_LIMIT: the Edge Function was killed mid-request
    // because one worksheet needs more memory than the server allows in a
    // single pass. The raw body ("…not having enough compute resources…")
    // is meaningless to an operator, so translate it into what to do.
    const resourceLimit =
      error.status === 546 ||
      error.payload?.code === 'WORKER_RESOURCE_LIMIT' ||
      error.payload?.code === 'WORKER_LIMIT';
    const guidance = resourceLimit
      ? 'The server ran out of memory processing this worksheet — it holds more data than one pass can handle. In Excel, split the worksheet\'s rows into smaller files, save each as .xlsx, and import them one at a time.'
      : typeof error.payload?.guidance === 'string'
        ? error.payload.guidance
        : error.message;
    const wrapped = new ApiError(guidance || error.message, error.status, error.payload);
    wrapped.code = error.code;
    return wrapped;
  }
  if (error instanceof Error) {
    return new ApiError(error.message || fallbackTitle, 0, {});
  }
  return new ApiError(fallbackTitle, 0, {});
}

export function isDuplicateConflict(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 409 && error.code === 'duplicate_import';
}
