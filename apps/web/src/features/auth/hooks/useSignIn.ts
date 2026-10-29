import { useCallback, useState } from 'react';
import { useAuth } from '../../../app/providers';
import { signInWithPassword, getProfile } from '../api';

export type SignInResult = {
  ok: boolean;
  error: string | null;
  disabled: boolean;
};

export function useSignIn() {
  const { session, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = useCallback(
    async (email: string, password: string): Promise<SignInResult> => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: supabaseError } = await signInWithPassword(
          email,
          password,
        );
        if (supabaseError) {
          // Supabase returns "Invalid login credentials" — it never reveals
          // whether the account exists, so no role hints leak here.
          const message =
            supabaseError.message ||
            'Sign-in failed. Check your email and password.';
          setError(message);
          return { ok: false, error: message, disabled: false };
        }

        // F1: disabled-account block — a disabled profile must not establish
        // a session. Sign them back out and show a specific message.
        // IMPORTANT: use the user ID from the signInWithPassword result, NOT
        // from the React context session state. The context session is updated
        // asynchronously via onAuthStateChange and is still stale here —
        // reading session?.user?.id would yield null and skip this check.
        const userId = data?.user?.id ?? null;
        const { data: profile } = await getProfile(userId);
        if (profile?.status === 'disabled') {
          await signOut();
          const message =
            'This account has been disabled. Contact your system administrator.';
          setError(message);
          return { ok: false, error: message, disabled: true };
        }

        return { ok: true, error: null, disabled: false };
      } catch (err: any) {
        const message = err.message || 'Sign-in failed. Try again.';
        setError(message);
        return { ok: false, error: message, disabled: false };
      } finally {
        setLoading(false);
      }
    },
    [signOut],
  );

  return { signIn: handleSignIn, loading, error };
}