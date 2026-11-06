import { useCallback, useState } from 'react';
import { sendPasswordReset } from '../api';

export type ResetResult = {
  ok: boolean;
  error: string | null;
};

export function usePasswordReset() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSend = useCallback(
    async (email: string): Promise<ResetResult> => {
      setLoading(true);
      setError(null);
      try {
        const redirectTo = `${window.location.origin}/reset-password`;
        const { error: supabaseError } = await sendPasswordReset(
          email,
          redirectTo,
        );
        if (supabaseError) {
          const message = 'We could not send a reset link. Check your email and try again.';
          setError(message);
          return { ok: false, error: message };
        }
        setSent(true);
        return { ok: true, error: null };
      } catch {
        const message =
          'We could not send a reset link. Check your internet connection and try again.';
        setError(message);
        return { ok: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { sendReset: handleSend, loading, error, sent };
}