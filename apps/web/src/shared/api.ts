import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const API_BASE = import.meta.env.VITE_API_BASE || (SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : '/functions/v1');

export class ApiError extends Error {
  status: number;
  code: string;
  payload: Record<string, any>;

  constructor(message: string, status: number, payload: Record<string, any> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = message;
    this.payload = payload;
  }
}

export function apiBase() {
  return API_BASE;
}

export async function authHeaders(extra: Record<string, string> = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  const headers: Record<string, string> = { ...extra };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function apiCall(path: string, options: RequestInit = {}) {
  const headers = await authHeaders({
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  });
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    let payload: Record<string, any> = {};
    let msg = `api_error_${res.status}`;
    try {
      const parsed = await res.json();
      if (parsed && typeof parsed === 'object') {
        payload = parsed;
        if (typeof parsed.error === 'string') msg = parsed.error;
      }
    } catch {
      // Non-JSON error body: keep the status-based message.
    }
    if (res.status === 401) {
      throw Object.assign(new ApiError(msg, res.status, payload), { code: 'UNAUTHORIZED' });
    }
    throw new ApiError(msg, res.status, payload);
  }
  try {
    return await res.json();
  } catch {
    return null;
  }
}
