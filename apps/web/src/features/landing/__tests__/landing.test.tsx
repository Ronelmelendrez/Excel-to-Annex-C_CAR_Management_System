import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "../../../app/providers";
import { LandingPage } from "../components/LandingPage";

vi.mock("../../../app/providers", () => ({
  useAuth: vi.fn(),
}));

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

describe("public landing page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue(authState());
  });

  it("introduces the authorized workspace and links sign-in actions to login", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "A clearer workspace for CAR operations." })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Staff sign in" }).getAttribute("href")).toBe("/login");
    expect(
      screen.getByRole("link", { name: /Sign in to your workspace/ }).getAttribute("href"),
    ).toBe("/login");
    expect(screen.getByText(/Household and case information is confidential/)).toBeTruthy();
  });

  it("routes an authenticated visitor to the dashboard", () => {
    vi.mocked(useAuth).mockReturnValue(authState({ user: { id: "staff-1" } }));
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<h1>Dashboard</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeTruthy();
  });

  it("shows the branded loading screen while authentication is loading", () => {
    vi.mocked(useAuth).mockReturnValue(authState(null, true));
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("status", { name: "Loading A clearer workspace for CAR operations." }),
    ).toBeTruthy();
  });

  it("navigates the primary call to action to the sign-in page", () => {
    vi.mocked(useAuth).mockReturnValue(authState());
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<h1>Sign in to your account</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("link", { name: /Sign in to your workspace/ }));
    expect(screen.getByRole("heading", { name: "Sign in to your account" })).toBeTruthy();
  });
});
