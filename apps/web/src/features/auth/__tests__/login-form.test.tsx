import React from 'react';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../../../app/providers';
import { useSignIn } from '../hooks/useSignIn';
import { LoginForm } from '../components/LoginForm';

vi.mock('../../../app/providers', () => ({ useAuth: vi.fn() }));
vi.mock('../hooks/useSignIn', () => ({ useSignIn: vi.fn() }));

const mockUseAuth = vi.mocked(useAuth);
const mockUseSignIn = vi.mocked(useSignIn);
const signIn = vi.fn();

function authState(session: unknown = null, loading = false) {
  return {
    session,
    user: null,
    profile: null,
    roles: [],
    loading,
    signIn: vi.fn(),
    signOut: vi.fn(),
  };
}

function signInState(overrides: Partial<ReturnType<typeof useSignIn>> = {}) {
  return { signIn, loading: false, error: null, ...overrides };
}

function renderLogin(initialEntries: any[] = ['/login']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/login" element={<LoginForm />} />
        <Route path="/dashboard" element={<h1>Dashboard</h1>} />
        <Route path="/households" element={<h1>Households</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

function submitForm() {
  const form = screen.getByRole('button', { name: /Sign in/ }).closest('form');
  if (!form) throw new Error('sign-in form not found');
  fireEvent.submit(form);
}

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(authState());
    mockUseSignIn.mockReturnValue(signInState());
  });

  it('renders a labelled sign-in form with the forgot-password path', () => {
    renderLogin();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Sign in to your workspace.' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Forgot your password?' }).getAttribute('href'),
    ).toBe('/forgot-password');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('shows the branded loading screen while the session resolves', () => {
    mockUseAuth.mockReturnValue(authState(null, true));
    renderLogin();

    expect(
      screen.getByRole('status', { name: 'Loading Sign in to your account' }),
    ).toBeInTheDocument();
  });

  it('sends an already signed-in visitor to the dashboard', () => {
    mockUseAuth.mockReturnValue(authState({ user: { id: 'staff-1' } }));
    renderLogin();

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('validates required fields inline before calling the sign-in service', () => {
    renderLogin();
    submitForm();

    expect(signIn).not.toHaveBeenCalled();
    expect(screen.getByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toHaveAttribute('aria-invalid', 'true');
  });

  it('reports a rejected sign-in attempt in an alert', async () => {
    mockUseSignIn.mockReturnValue(
      signInState({
        signIn: vi
          .fn()
          .mockResolvedValue({ ok: false, error: 'Email or password is incorrect.', disabled: false }),
      }),
    );
    renderLogin();

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'worker@example.org' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong-password' } });
    submitForm();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Email or password is incorrect.');
  });

  it('signs in with the typed credentials and routes to the dashboard', async () => {
    signIn.mockResolvedValue({ ok: true, error: null, disabled: false });
    renderLogin();

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'worker@example.org' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret-123' } });
    submitForm();

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(signIn).toHaveBeenCalledWith('worker@example.org', 'secret-123');
  });

  it('returns the visitor to the page that required authentication', async () => {
    signIn.mockResolvedValue({ ok: true, error: null, disabled: false });
    renderLogin([{ pathname: '/login', state: { from: { pathname: '/households' } } }]);

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'worker@example.org' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret-123' } });
    submitForm();

    expect(await screen.findByRole('heading', { name: 'Households' })).toBeInTheDocument();
  });

  it('lets the user reveal the password they typed', () => {
    renderLogin();

    const password = screen.getByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });

  it('surfaces an account disabled outside this sign-in attempt', () => {
    renderLogin(['/login?disabled=1']);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This account has been disabled. Contact your system administrator.',
    );
  });
});
