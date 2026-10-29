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
          const message =
            supabaseError.message ||
            'Could not send the reset link. Try again.';
          setError(message);
          return { ok: false, error: message };
        }
        setSent(true);
        return { ok: true, error: null };
      } catch (err: any) {
        const message =
          err.message || 'Could not send the reset link. Try again.';
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