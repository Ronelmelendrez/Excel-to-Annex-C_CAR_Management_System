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
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    cleanup();
  });

  it('auto-signs in and marks the build as a demo', async () => {
    visit('/dashboard');
    render(<Router />);

    expect(await screen.findByText(/Demo build/i)).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Operations at a glance" })).toBeTruthy();
    expect(await screen.findByText(/Mock aggregates · no live records/i)).toBeTruthy();
    expect(screen.getByText('Demo operator')).toBeTruthy();
  }, 15000);

  it('shows the seeded import history without a backend', async () => {
    visit('/imports');
    render(<Router />);

    expect(
      (await screen.findAllByText(/SY2026_Q1_household_profiles.xlsx/, {}, { timeout: 10000 })).length,
    ).toBeGreaterThan(0);
    expect(await screen.findByText(/Region_IV-A_batch02.xlsx/, {}, { timeout: 10000 })).toBeTruthy();
    expect((await screen.findAllByText(/^3 versions$/, {}, { timeout: 10000 })).length).toBeGreaterThan(0);
  }, 15000);
});
