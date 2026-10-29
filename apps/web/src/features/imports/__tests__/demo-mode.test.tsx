import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Router } from '../../../app/router';

// No VITE_SUPABASE_* values exist in the test environment, so the app must
// boot in demo mode: auto-signed-in operator, local mock data, no network.

function visit(path: string) {
  window.history.pushState({}, '', path);
}

describe('demo mode', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('auto-signs in and marks the build as a demo', async () => {
    visit('/dashboard');
    render(<Router />);

    expect(await screen.findByText(/Demo build/i)).toBeTruthy();
    expect(await screen.findByText(/The dashboard is not wired to records yet/i)).toBeTruthy();
    expect(screen.getByText('Demo operator')).toBeTruthy();
  });

  it('shows the seeded import history without a backend', async () => {
    visit('/imports');
    render(<Router />);

    expect((await screen.findAllByText(/SY2026_Q1_household_profiles.xlsx/)).length).toBeGreaterThan(0);
    expect(await screen.findByText(/Region_IV-A_batch02.xlsx/)).toBeTruthy();
    expect((await screen.findAllByText(/^3 versions$/)).length).toBeGreaterThan(0);
  });
});
