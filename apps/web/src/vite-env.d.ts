/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL, e.g. https://project-ref.supabase.co */
  readonly VITE_SUPABASE_URL: string;
  /** Public anon/publishable key. Never the service_role key. */
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Optional Edge Functions base URL; defaults to <url>/functions/v1. */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
