import React, { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../app/providers';
import { RouteLoadingSkeleton } from '../../../components/ui/PageSkeletons';
import { useSignIn } from '../hooks/useSignIn';
import { AuthLayout } from './AuthLayout';
import { TextField } from './TextField';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = {
  email?: string;
  password?: string;
};

export function LoginForm() {
  const [searchParams] = useSearchParams();
  const { session, loading: authLoading } = useAuth();
  const { signIn, loading, error: hookError } = useSignIn();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  // Where to go after signing in: the page that asked us to authenticate,
  // otherwise the dashboard.
  const returnTo =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/dashboard';

  // Surface a disabled-account block that happened outside this sign-in
  // attempt (e.g. an existing session was terminated).
  useEffect(() => {
    if (searchParams.get('disabled') === '1') {
      setFormError(
        'This account has been disabled. Contact your system administrator.',
      );
    }
  }, [searchParams]);

  // A failed attempt should be announced and reachable by keyboard.
  useEffect(() => {
    if (formError) errorRef.current?.focus();
  }, [formError]);

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      errors.email = 'Enter your email address.';
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      errors.email = 'Enter a valid email address, for example name@example.com.';
    }
    if (!password) {
      errors.password = 'Enter your password.';
    }
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // ignore repeat submits while a request is in flight

    setFormError(null);
    const errors = validate();
    setFieldErrors(errors);
    if (errors.email) {
      emailRef.current?.focus();
      return;
    }
    if (errors.password) {
      passwordRef.current?.focus();
      return;
    }

    const result = await signIn(email.trim(), password);
    if (!result.ok) {
      setFormError(result.error ?? 'We could not sign you in. Try again.');
      return;
    }
    navigate(returnTo, { replace: true });
  };

  // Wait for the session to resolve before showing the form, so a signed-in
  // visitor is redirected instead of asked to sign in again.
  if (authLoading) {
    return <RouteLoadingSkeleton pathname="/login" />;
  }
  if (session) {
    return <Navigate to={returnTo} replace />;
  }

  const errorMessage = formError ?? hookError;

  return (
    <AuthLayout
      eyebrow="Case Assessment Report · Annex C"
      headline="Sign in to your workspace."
      lede="Household records, case assessments and reporting tools come together in one workspace for authorized staff."
      cardLabel="Authorized staff"
      cardTitle="Sign in"
      cardDescription="Use the email address registered on your staff account."
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {errorMessage && (
          <div
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="flex items-start gap-2 border-l-4 border-[#7a1f1f] bg-[#f6eaea] px-4 py-3 text-sm leading-6 text-[#7a1414] focus:outline-none"
          >
            <span aria-hidden="true" className="mt-0.5 leading-none">
              ▲
            </span>
            <span>{errorMessage}</span>
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
            if (fieldErrors.email) setFieldErrors((current) => ({ ...current, email: undefined }));
          }}
          error={fieldErrors.email}
          inputRef={emailRef}
        />

        <div>
          <TextField
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            revealable
            value={password}
            onChange={(value) => {
              setPassword(value);
              if (fieldErrors.password) {
                setFieldErrors((current) => ({ ...current, password: undefined }));
              }
            }}
            error={fieldErrors.password}
            inputRef={passwordRef}
          />
          <div className="mt-2 text-right">
            <Link
              to="/forgot-password"
              className="text-sm underline underline-offset-4 decoration-[#8c877c] hover:decoration-[#161512] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f]"
            >
              Forgot your password?
            </Link>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          aria-busy={loading || undefined}
          className="flex min-h-[48px] w-full items-center justify-center border border-[#161512] bg-[#161512] px-5 py-3 text-sm font-semibold text-[#f4f1ea] transition-colors hover:bg-[#7a1f1f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="text-xs leading-5 text-[#5b574e]">
          Accounts are issued by a system administrator. If you need access, ask your
          administrator to create one for you.
        </p>
      </form>
    </AuthLayout>
  );
}
