import { supabase } from '../../shared/supabase';
import type { Profile } from './types';

export async function signInWithPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getSession() {
  return supabase.auth.getSession();
}

/**
 * Send a password-recovery email. redirectTo must point at a route of this app
 * (/reset-password) so Supabase's redirect URL allow-list accepts it.
 * The response intentionally does not reveal whether the email exists.
 */
export async function sendPasswordReset(email: string, redirectTo: string) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
}

/**
 * Complete a password recovery from a Supabase recovery link:
 * establish the temporary session from the access_token + refresh_token,
 * then set the new password.
 */
export async function updatePasswordFromRecovery(
  accessToken: string,
  refreshToken: string,
  password: string,
) {
  const { error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (sessionError) return { error: sessionError };
  return supabase.auth.updateUser({ password });
}

/**
 * Fetch the signing-in user's profile so a disabled account can be blocked.
 * Returns { data: null } when no profile row exists (never blocks on lookup
 * failure — only on an explicit disabled status).
 */
export async function getProfile(userId: string | null | undefined) {
  if (!userId) return { data: null as Profile | null, error: null };
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, status')
    .eq('id', userId)
    .maybeSingle();
  return { data: (data as Profile | null) ?? null, error };
}
