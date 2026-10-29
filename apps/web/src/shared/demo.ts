import type { Session, SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Local-only stand-in for the Supabase client.
 *
 * Used when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not configured so
 * the UI can be reviewed without a backend. Nothing here talks to the network:
 * auth is simulated, profile/role lookups return fixed demo rows, and storage
 * uploads are accepted without writing anywhere.
 */

export const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001';
export const DEMO_EMAIL = 'operator@demo.local';
export const DEMO_PASSWORD = 'demo';
export const DEMO_DISPLAY_NAME = 'Demo operator';

const DEMO_PROFILE = {
  id: DEMO_USER_ID,
  display_name: DEMO_DISPLAY_NAME,
  status: 'active',
};

const DEMO_ROLES = [
  { user_id: DEMO_USER_ID, role: 'admin' },
  { user_id: DEMO_USER_ID, role: 'operator' },
];

const DEMO_TABLES: Record<string, Array<Record<string, any>>> = {
  profiles: [DEMO_PROFILE],
  user_roles: DEMO_ROLES,
  system_settings: [{ key: 'access_mode', value: 'open' }],
};

type AuthListener = (event: string, session: Session | null) => void;

let signedIn = true;
let activeEmail = DEMO_EMAIL;
const listeners = new Set<AuthListener>();

function demoUser(): User {
  return {
    id: DEMO_USER_ID,
    email: activeEmail,
    app_metadata: { provider: 'demo', providers: ['demo'] },
    user_metadata: { display_name: DEMO_DISPLAY_NAME },
    aud: 'authenticated',
    created_at: new Date(0).toISOString(),
  } as unknown as User;
}

function demoSession(): Session {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: 'demo-access-token',
    refresh_token: 'demo-refresh-token',
    expires_in: 3600,
    expires_at: now + 3600,
    token_type: 'bearer',
    user: demoUser(),
  } as unknown as Session;
}

function emit(event: string) {
  const session = signedIn ? demoSession() : null;
  for (const listener of listeners) {
    setTimeout(() => listener(event, session), 0);
  }
}

/** Minimal thenable query builder covering the calls this UI makes. */
function query(rows: Array<Record<string, any>>) {
  let current = rows;
  const builder: any = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      current = current.filter((row) => row[column] === value);
      return builder;
    },
    in: (column: string, values: unknown[]) => {
      current = current.filter((row) => values.includes(row[column]));
      return builder;
    },
    order: () => builder,
    limit: () => builder,
    range: () => builder,
    maybeSingle: async () => ({ data: current[0] ?? null, error: null }),
    single: async () => ({ data: current[0] ?? null, error: null }),
    then: (resolve: any, reject: any) =>
      Promise.resolve({ data: current, error: null }).then(resolve, reject),
  };
  return builder;
}

const demoAuth = {
  getSession: async () => ({
    data: { session: signedIn ? demoSession() : null },
    error: null,
  }),
  onAuthStateChange: (listener: AuthListener) => {
    listeners.add(listener);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            listeners.delete(listener);
          },
        },
      },
    };
  },
  signInWithPassword: async ({ email }: { email: string; password: string }) => {
    signedIn = true;
    activeEmail = email || DEMO_EMAIL;
    emit('SIGNED_IN');
    return { data: { user: demoUser(), session: demoSession() }, error: null };
  },
  signOut: async () => {
    signedIn = false;
    emit('SIGNED_OUT');
    return { error: null };
  },
  resetPasswordForEmail: async () => ({ data: {}, error: null }),
  setSession: async () => ({
    data: { session: demoSession(), user: demoUser() },
    error: null,
  }),
  updateUser: async () => ({ data: { user: demoUser() }, error: null }),
};

const demoStorage = {
  from: (_bucket: string) => ({
    upload: async (path: string) => ({
      data: { path, id: path, fullPath: path },
      error: null,
    }),
  }),
};

export function createDemoClient(): SupabaseClient {
  return {
    auth: demoAuth,
    from: (table: string) => query(DEMO_TABLES[table] ?? []),
    storage: demoStorage,
  } as unknown as SupabaseClient;
}
