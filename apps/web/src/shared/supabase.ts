import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createDemoClient } from './demo';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

/**
 * Demo mode is active whenever Supabase is not configured. The app then runs
 * entirely on local mock data: no network calls, no persistence beyond
 * localStorage, and an auto-signed-in demo operator.
 */
export const isDemoMode = !supabaseUrl || !supabaseAnonKey;

export const supabase: SupabaseClient = isDemoMode
  ? createDemoClient()
  : createClient(supabaseUrl, supabaseAnonKey);
