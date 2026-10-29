import { supabase } from '../../shared/supabase';
import { apiBase, apiCall, authHeaders, ApiError } from '../../shared/api';
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

export async function uploadWorkbook(params: {
  userId: string;
  file: File;
  fileHash: string;
}): Promise<{ path: string }> {
  const path = storagePathFor(params.userId, params.fileHash, params.file.name);
  const { error } = await supabase.storage.from(BUCKET).upload(path, params.file, {
    upsert: false,
    contentType: params.file.type || 'application/octet-stream',
    cacheControl: '3600',
  });
  // Content-addressed path: an existing object is the same workbook bytes.
  const status = (error as { statusCode?: number } | null)?.statusCode;
  if (error && status !== 409) {
    throw new Error(
      'The workbook could not be uploaded to private storage. Check your connection and try again.',
    );
  }
  return { path };
}

export async function previewImport(payload: PreviewRequest): Promise<ImportPreview> {
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
  try {
    return (await apiCall(`/imports?action=list&limit=${limit}&offset=${offset}`)) as ImportListResponse;
  } catch (error) {
    throw normalizeImportError(error, 'Import history could not be loaded');
  }
}

export async function fetchErrorReportCsv(importId: string): Promise<string> {
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
    const guidance =
      typeof error.payload?.guidance === 'string' ? error.payload.guidance : error.message;
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
