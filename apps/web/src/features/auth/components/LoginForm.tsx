import React, { useState, useEffect } from 'react';
import { useSignIn } from '../hooks/useSignIn';
import { useNavigate, useSearchParams } from 'react-router-dom';

export function LoginForm() {
  const [searchParams] = useSearchParams();
  const { signIn, loading, error: hookError } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Surface a disabled-account block that happened outside this sign-in
  // attempt (e.g. an existing session was terminated).
  useEffect(() => {
    if (searchParams.get('disabled') === '1') {
      setFormError(
        'This account has been disabled. Contact your system administrator.',
      );
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const result = await signIn(email, password);
    if (!result.ok) {
      setFormError(result.error ?? 'Sign-in failed.');
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  return (
    <main className="min-h-screen bg-white text-[#111111]">
      <div className="mx-auto max-w-[420px] px-6 py-20">
        <header className="mb-12">
          <h1 className="text-xl font-semibold tracking-tight">
            CAR Management System
          </h1>
          <p className="mt-1 text-sm text-[#4a4a4a]">Sign in to your account</p>
        </header>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {formError && (
            <p role="alert" className="text-sm text-[#8b0000]">
              {formError}
            </p>
          )}
          {hookError && hookError !== formError && (
            <p role="alert" className="text-sm text-[#8b0000]">
              {hookError}
            </p>
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

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-[#c9c9c9] bg-white px-3 py-2 text-sm focus:border-[#111111] outline-none"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-sm text-[#4a4a4a]">
              <a
                href="/forgot-password"
                className="underline underline-offset-4 hover:text-[#111111]"
              >
                Forgot your password?
              </a>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full border border-[#111111] bg-[#111111] px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}
