import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useAuth } from "../../../app/providers";
import { DashboardGuard } from "../../../app/guards";

vi.mock("../../../app/providers", () => ({
  useAuth: vi.fn(),
}));

function authState({
  session = null,
  profile = null,
  roles = [],
  loading = false,
}: {
  session?: object | null;
  profile?: { status: "active" | "disabled" } | null;
  roles?: string[];
  loading?: boolean;
} = {}) {
  return {
    session,
    user: session ? { id: "staff-01" } : null,
    profile: profile ? { id: "staff-01", display_name: null, ...profile } : null,
    roles,
    loading,
    signIn: async () => ({}),
    signOut: async () => {},
  };
}

function renderDashboardGuard() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route
          path="/dashboard"
          element={
            <DashboardGuard>
              <h1>Private dashboard</h1>
            </DashboardGuard>
          }
        />
        <Route path="/login" element={<h1>Login</h1>} />
        <Route path="/" element={<h1>Public landing page</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("DashboardGuard", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("sends public visitors to login", () => {
    vi.mocked(useAuth).mockReturnValue(authState());

    renderDashboardGuard();

    expect(screen.getByRole("heading", { name: "Login" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Private dashboard" })).toBeNull();
  });

  it("denies authenticated accounts without an active dashboard role", () => {
    vi.mocked(useAuth).mockReturnValue(
      authState({ session: {}, profile: { status: "active" }, roles: ["guest"] }),
    );

    renderDashboardGuard();

    expect(screen.getByRole("heading", { name: "Public landing page" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Private dashboard" })).toBeNull();
  });

  it("denies accounts without an active profile", () => {
    vi.mocked(useAuth).mockReturnValue(authState({ session: {}, roles: ["admin"] }));

    renderDashboardGuard();

    expect(screen.getByRole("heading", { name: "Public landing page" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Private dashboard" })).toBeNull();
  });

  it("allows an active account with a dashboard role", () => {
    vi.mocked(useAuth).mockReturnValue(
      authState({ session: {}, profile: { status: "active" }, roles: ["case_worker"] }),
    );

    renderDashboardGuard();

    expect(screen.getByRole("heading", { name: "Private dashboard" })).toBeTruthy();
  });
});
