import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        'Deployed functions receive it automatically; for local serving copy ' +
        'supabase/functions/.env.example to supabase/functions/.env and fill in ' +
        'the values from `supabase status`.',
    );
  }
  return value;
}

export function getServiceClient() {
  return createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } }
  );
}
