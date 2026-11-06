import React, { useState, useCallback, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { updatePasswordFromRecovery } from '../api';
import { AuthLayout } from './AuthLayout';
import { TextField } from './TextField';

const MIN_PASSWORD_LENGTH = 8;

export function UpdatePasswordForm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({});
  const [done, setDone] = useState(false);

  const accessToken = searchParams.get('access_token');
  const refreshToken = searchParams.get('refresh_token');
  const type = searchParams.get('type');
  const linkValid = Boolean(accessToken && refreshToken && type === 'recovery');

  useEffect(() => {
    if (!linkValid) {
      setError(
        'This password-reset link is invalid or has expired. Request a new link and try again.',
      );
    }
  }, [linkValid]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (loading) return;
      setError(null);

      const errors: { password?: string; confirm?: string } = {};
      if (!accessToken) return;
      if (password.length < MIN_PASSWORD_LENGTH) {
        errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
      }
      if (password !== confirm) {
        errors.confirm = 'The two passwords do not match.';
      }
      setFieldErrors(errors);
      if (errors.password || errors.confirm) return;

      setLoading(true);
      try {
        const { error: err } = await updatePasswordFromRecovery(
          accessToken,
          refreshToken ?? '',
          password,
        );
        if (err) {
          setError(
            'We could not update your password. The reset link may have expired. Request a new link and try again.',
          );
          return;
        }
        setDone(true);
      } catch {
        setError(
          'We could not update your password. Check your internet connection and try again.',
        );
      } finally {
        setLoading(false);
      }
    },
    [accessToken, refreshToken, loading, password, confirm],
  );

  if (done) {
    return (
      <AuthLayout
        eyebrow="Account recovery"
        headline="Password updated."
        lede="Your new password is active. Sign in to pick up where you left off."
        cardLabel="Password reset"
        cardTitle="All set"
      >
        <button
          type="button"
          onClick={() => navigate('/login', { replace: true })}
          className="flex min-h-[48px] w-full items-center justify-center border border-[#161512] bg-[#161512] px-5 py-3 text-sm font-semibold text-[#f4f1ea] transition-colors hover:bg-[#7a1f1f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
        >
          Sign in
        </button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow="Account recovery"
      headline="Set a new password."
      lede="Choose a password you have not used before, then sign in with it."
      cardLabel="Password reset"
      cardTitle="Choose a new password"
      cardDescription="At least 8 characters."
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 border-l-4 border-[#7a1f1f] bg-[#f6eaea] px-4 py-3 text-sm leading-6 text-[#7a1414]"
          >
            <span aria-hidden="true" className="mt-0.5 leading-none">
              ▲
            </span>
            <span>{error}</span>
          </div>
        )}

        <TextField
          label="New password"
          name="new-password"
          type="password"
          autoComplete="new-password"
          required
          revealable
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(value) => {
            setPassword(value);
            if (fieldErrors.password) setFieldErrors((c) => ({ ...c, password: undefined }));
          }}
          error={fieldErrors.password}
        />

        <TextField
          label="Confirm password"
          name="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          revealable
          minLength={MIN_PASSWORD_LENGTH}
          value={confirm}
          onChange={(value) => {
            setConfirm(value);
            if (fieldErrors.confirm) setFieldErrors((c) => ({ ...c, confirm: undefined }));
          }}
          error={fieldErrors.confirm}
        />

        <button
          type="submit"
          disabled={loading || !linkValid}
          aria-busy={loading || undefined}
          className="flex min-h-[48px] w-full items-center justify-center border border-[#161512] bg-[#161512] px-5 py-3 text-sm font-semibold text-[#f4f1ea] transition-colors hover:bg-[#7a1f1f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Updating…' : 'Update password'}
        </button>

        {!linkValid && (
          <p className="text-xs leading-5 text-[#5b574e]">
            This button is unavailable because the reset link is missing or expired.{' '}
            <Link
              to="/forgot-password"
              className="underline underline-offset-4 decoration-[#8c877c] hover:decoration-[#161512] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
            >
              Request a new link
            </Link>
            .
          </p>
        )}
      </form>
    </AuthLayout>
  );
}
