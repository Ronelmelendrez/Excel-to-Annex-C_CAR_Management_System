import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

vi.mock('../../../shared/supabase', () => ({
  isDemoMode: false,
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      setSession: vi.fn(),
      updateUser: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(),
  },
}));

vi.mock('../../../app/providers', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { supabase } from '../../../shared/supabase';
import {
  signInWithPassword,
  sendPasswordReset,
  updatePasswordFromRecovery,
  getProfile,
} from '../api';
import { useSignIn } from '../hooks/useSignIn';
import { usePasswordReset } from '../hooks/usePasswordReset';
import { useAuth } from '../../../app/providers';

const mockSignInWithPassword = vi.mocked(supabase.auth.signInWithPassword);
const mockSignOut = vi.mocked(supabase.auth.signOut);
const mockResetPasswordForEmail = vi.mocked(supabase.auth.resetPasswordForEmail);
const mockSetSession = vi.mocked(supabase.auth.setSession);
const mockUpdateUser = vi.mocked(supabase.auth.updateUser);
const mockFrom = vi.mocked(supabase.from);
const mockUseAuth = vi.mocked(useAuth);

const mockMaybeSingle = vi.fn();
const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

beforeEach(() => {
  vi.clearAllMocks();
  mockFrom.mockReturnValue({ select: mockSelect });
  mockUseAuth.mockReturnValue({ session: null, signOut: mockSignOut });
});

describe('F1 Authentication API', () => {
  it('signInWithPassword forwards email and password to Supabase', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: 'u1' } },
      error: null,
    });
    const res = await signInWithPassword('worker@example.com', 'password');
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'worker@example.com',
      password: 'password',
    });
    expect(res.data?.user.id).toBe('u1');
  });

  it('signInWithPassword returns the Supabase error for invalid credentials', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Invalid login credentials', status: 400 },
    });
    const res = await signInWithPassword('nope@example.com', 'wrong');
    expect(res.error?.message).toBe('Invalid login credentials');
    expect(res.data).toBeNull();
  });

  it('sendPasswordReset uses an allowed redirect URL and never reveals whether the email exists', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    const redirectTo = 'https://car-system.example.org/reset-password';
    const res = await sendPasswordReset('worker@example.com', redirectTo);
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('worker@example.com', {
      redirectTo,
    });
    expect(res.error).toBeNull();
  });

  it('updatePasswordFromRecovery establishes the recovery session, then updates the password', async () => {
    mockSetSession.mockResolvedValue({ error: null });
    mockUpdateUser.mockResolvedValue({
      data: { user: { id: 'u1' } },
      error: null,
    });
    const res = await updatePasswordFromRecovery('recovery-token-123', 'refresh-token-456', 'NewPassword123!');
    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: 'recovery-token-123',
      refresh_token: 'refresh-token-456',
    });
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'NewPassword123!' });
    expect(res.error).toBeNull();
  });

  it('updatePasswordFromRecovery surfaces a session error (expired link)', async () => {
    mockSetSession.mockResolvedValue({
      error: { message: 'Invalid refresh token' },
    });
    const res = await updatePasswordFromRecovery('stale-token', 'stale-refresh', 'NewPassword123!');
    expect(res.error?.message).toBe('Invalid refresh token');
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('getProfile returns null without calling the database when there is no user id', async () => {
    const res = await getProfile(null);
    expect(res.data).toBeNull();
    expect(res.error).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('getProfile fetches the profiles row for the signed-in user', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'u1', display_name: 'B. Worker', status: 'active' },
      error: null,
    });
    const res = await getProfile('u1');
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockSelect).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith('id', 'u1');
    expect(res.data?.status).toBe('active');
  });

  describe('F1 useSignIn hook', () => {
  it('signs in a valid user and returns ok', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: 'u1' } },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'u1', display_name: 'B. Worker', status: 'active' },
      error: null,
    });
    mockUseAuth.mockReturnValue({
      session: { user: { id: 'u1' } },
      signOut: mockSignOut,
    });
    const { result } = renderHook(() => useSignIn());
    let outcome: any;
    await act(async () => {
      outcome = await result.current.signIn('worker@example.com', 'password');
    });
    expect(outcome.ok).toBe(true);
    expect(outcome.disabled).toBe(false);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('rejects invalid credentials without revealing account existence and does not sign out', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Invalid login credentials', status: 400 },
    });
    mockUseAuth.mockReturnValue({
      session: null,
      signOut: mockSignOut,
    });
    const { result } = renderHook(() => useSignIn());
    let outcome: any;
    await act(async () => {
      outcome = await result.current.signIn('nope@example.com', 'wrong');
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.disabled).toBe(false);
    expect(outcome.error).toContain('Invalid login credentials');
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('blocks a disabled account: signs the user out and returns a specific disabled error', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: 'u1' } },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'u1', display_name: 'B. Worker', status: 'disabled' },
      error: null,
    });
    mockUseAuth.mockReturnValue({
      session: { user: { id: 'u1' } },
      signOut: mockSignOut,
    });
    const { result } = renderHook(() => useSignIn());
    let outcome: any;
    await act(async () => {
      outcome = await result.current.signIn('worker@example.com', 'password');
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.disabled).toBe(true);
    expect(outcome.error).toContain('disabled');
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});

describe('F1 usePasswordReset hook', () => {
  it('sends the reset email to the allowed /reset-password route', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    const { result } = renderHook(() => usePasswordReset());
    let outcome: any;
    await act(async () => {
      outcome = await result.current.sendReset('worker@example.com');
    });
    expect(outcome.ok).toBe(true);
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
      'worker@example.com',
      expect.objectContaining({
        redirectTo: expect.stringContaining('/reset-password'),
      }),
    );
    expect(result.current.sent).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('returns a specific error when sending the reset link fails', async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      data: null,
      error: { message: 'Too many requests. Try again later.' },
    });
    const { result } = renderHook(() => usePasswordReset());
    let outcome: any;
    await act(async () => {
      outcome = await result.current.sendReset('worker@example.com');
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toContain('Too many requests');
    expect(result.current.sent).toBe(false);
  });
});
});
