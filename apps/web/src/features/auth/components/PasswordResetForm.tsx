import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePasswordReset } from '../hooks/usePasswordReset';
import { AuthLayout } from './AuthLayout';
import { TextField } from './TextField';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function PasswordResetForm() {
  const { sendReset, loading, error, sent } = usePasswordReset();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setFieldError(null);
    if (!email.trim()) {
      setFieldError('Enter your email address.');
      return;
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      setFieldError('Enter a valid email address, for example name@example.com.');
      return;
    }
    await sendReset(email.trim());
  };

  if (sent) {
    return (
      <AuthLayout
        eyebrow="Account recovery"
        headline="Check your inbox."
        lede="If an account exists for this address, a password-reset link is on its way."
        cardLabel="Password reset"
        cardTitle="Reset link sent"
        cardDescription="The link expires shortly after it is sent."
      >
        <p className="text-sm leading-6 text-[#3f3b34]">
          Open the link, set a new password, then sign in. Nothing arrived? Check your spam
          folder or ask your administrator to resend it.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigate('/login', { replace: true })}
            className="inline-flex min-h-[44px] items-center border border-[#161512] bg-[#161512] px-5 py-2.5 text-sm font-semibold text-[#f4f1ea] transition-colors hover:bg-[#7a1f1f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
          >
            Back to sign in
          </button>
          <Link
            to="/"
            className="inline-flex min-h-[44px] items-center px-2 py-2.5 text-sm underline underline-offset-4 decoration-[#8c877c] hover:decoration-[#161512] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
          >
            Back to home
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow="Account recovery"
      headline="Reset your password."
      lede="Enter the email address on your staff account and we will send you a link to set a new password."
      cardLabel="Password reset"
      cardTitle="Send a reset link"
      cardDescription="Use the address you sign in with."
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
          label="Email address"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(value) => {
            setEmail(value);
            if (fieldError) setFieldError(null);
          }}
          error={fieldError}
        />

        <button
          type="submit"
          disabled={loading}
          aria-busy={loading || undefined}
          className="flex min-h-[48px] w-full items-center justify-center border border-[#161512] bg-[#161512] px-5 py-3 text-sm font-semibold text-[#f4f1ea] transition-colors hover:bg-[#7a1f1f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Sending…' : 'Send reset link'}
        </button>

        <p className="text-sm text-[#5b574e]">
          Remembered it after all?{' '}
          <Link
            to="/login"
            className="underline underline-offset-4 decoration-[#8c877c] hover:decoration-[#161512] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
          >
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
