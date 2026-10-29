import React, { useState } from 'react';
import { usePasswordReset } from '../hooks/usePasswordReset';
import { useNavigate } from 'react-router-dom';

export function PasswordResetForm() {
  const { sendReset, loading, error, sent } = usePasswordReset();
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

  if (sent) {
    return (
      <main className="min-h-screen bg-white text-[#111111]">
        <div className="mx-auto max-w-[420px] px-6 py-20">
          <header className="mb-12">
            <h1 className="text-xl font-semibold tracking-tight">
              Reset password
            </h1>
            <p className="mt-1 text-sm text-[#4a4a4a]">Check your inbox</p>
          </header>
          <p className="text-sm text-[#111111]">
            If an account exists for this address, a password-reset link has
            been sent. Open the link, set a new password, then sign in.
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendReset(email);
  };

  return (
    <main className="min-h-screen bg-white text-[#111111]">
      <div className="mx-auto max-w-[420px] px-6 py-20">
        <header className="mb-12">
          <h1 className="text-xl font-semibold tracking-tight">
            Reset password
          </h1>
          <p className="mt-1 text-sm text-[#4a4a4a]">
            Enter your email address
          </p>
        </header>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {error && (
            <p role="alert" className="text-sm text-[#8b0000]">{error}</p>
          )}

          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-[#c9c9c9] bg-white px-3 py-2 text-sm focus:border-[#111111] outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full border border-[#111111] bg-[#111111] px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <div className="mt-8 text-sm text-[#4a4a4a]">
          <a
            href="/login"
            className="underline underline-offset-4 hover:text-[#111111]"
          >
            Remember your password? Sign in
          </a>
        </div>
      </div>
    </main>
  );
}