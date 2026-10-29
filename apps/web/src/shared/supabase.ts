import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

const missing = [
  ['VITE_SUPABASE_URL', supabaseUrl],
  ['VITE_SUPABASE_ANON_KEY', supabaseAnonKey],
]
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missing.length > 0) {
  throw new Error(
    `Supabase is not configured: missing ${missing.join(', ')}. ` +
      'Copy apps/web/.env.example to apps/web/.env.local, then set the values ' +
      'from Supabase Dashboard -> Project Settings -> API and restart the dev server.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
