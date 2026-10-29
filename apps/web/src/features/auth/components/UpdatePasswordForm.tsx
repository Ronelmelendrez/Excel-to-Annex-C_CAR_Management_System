import React, { useState, useCallback, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { updatePasswordFromRecovery } from '../api';

export function UpdatePasswordForm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const accessToken = searchParams.get('access_token');
  const refreshToken = searchParams.get('refresh_token');
  const type = searchParams.get('type');

  useEffect(() => {
    if (!accessToken || !refreshToken || type !== 'recovery') {
      setError(
        'Invalid or expired reset link. Request a new one at /forgot-password.',
      );
    }
  }, [accessToken, type]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!accessToken) return;
      if (password !== confirm) {
        setError('The two passwords do not match.');
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters.');
        return;
      }
      setLoading(true);
      try {
        const { error: err } = await updatePasswordFromRecovery(
          accessToken,
          refreshToken ?? '',
          password,
        );
        if (err) {
          setError(
            err.message ||
              'Could not update your password. The link may have expired.',
          );
          return;
        }
        setDone(true);
      } catch (err: any) {
        setError(err.message || 'Could not update your password. Try again.');
      } finally {
        setLoading(false);
      }
    },
    [accessToken, password, confirm],
  );

  if (done) {
    return (
      <main className="min-h-screen bg-white text-[#111111]">
        <div className="mx-auto max-w-[420px] px-6 py-20">
          <header className="mb-12">
            <h1 className="text-xl font-semibold tracking-tight">
              Password updated
            </h1>
          </header>
          <p className="text-sm text-[#111111]">
            Your password was updated. Sign in to continue.
          </p>
          <div className="mt-10">
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              className="border border-[#111111] bg-[#111111] px-3 py-2 text-sm text-white"
            >
              Sign in
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-[#111111]">
      <div className="mx-auto max-w-[420px] px-6 py-20">
        <header className="mb-12">
          <h1 className="text-xl font-semibold tracking-tight">
            Set a new password
          </h1>
          <p className="mt-1 text-sm text-[#4a4a4a]">
            Choose your new password
          </p>
        </header>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {error && (
            <p role="alert" className="text-sm text-[#8b0000]">{error}</p>
          )}

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium">
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-[#c9c9c9] bg-white px-3 py-2 text-sm focus:border-[#111111] outline-none"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="confirm" className="block text-sm font-medium">
              Confirm password
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full border border-[#c9c9c9] bg-white px-3 py-2 text-sm focus:border-[#111111] outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !accessToken}
            className="w-full border border-[#111111] bg-[#111111] px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </main>
  );
}