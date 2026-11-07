import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Router } from "../../../app/router";
import { useAuth } from "../../../app/providers";

vi.mock("../../../app/providers", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: vi.fn(),
}));

function visit(path: string) {
  window.history.pushState({}, "", path);
}

describe("imports route", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/");
    vi.mocked(useAuth).mockReturnValue({
      session: {},
      user: { id: "operator-01", email: "operator@example.test" },
      profile: { id: "operator-01", display_name: "Operator", status: "active" },
      roles: ["operator"],
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the import wizard instead of the paused notice", async () => {
    visit("/imports");
    render(<Router />);

    expect(
      await screen.findByRole("heading", { name: /Drop a workbook here/ }),
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Excel imports are paused" })).toBeNull();
  });

  it("offers the Excel imports nav link to operators", async () => {
    visit("/imports");
    render(<Router />);

    expect(await screen.findByRole("link", { name: "Excel imports" })).toBeTruthy();
  });
});
