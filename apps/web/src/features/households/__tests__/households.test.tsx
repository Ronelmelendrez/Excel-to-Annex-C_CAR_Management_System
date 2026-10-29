import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "../../../app/providers";
import { HouseholdsPage } from "../components/HouseholdsPage";

vi.mock("../../../app/providers", () => ({
  useAuth: vi.fn(),
}));

function authFor(roles: string[]) {
  return {
    session: {},
    user: { email: "worker@example.test" },
    profile: { id: "worker", display_name: "Demo case worker", status: "active" as const },
    roles,
    loading: false,
    signIn: async () => ({}),
    signOut: async () => {},
  };
}

describe("F4 household register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue(authFor(["case_worker"]));
  });

  afterEach(() => {
    cleanup();
  });

  it("shows imported member rows and all grantee validation states", () => {
    render(<HouseholdsPage />);

    expect(screen.getByText("Mock records · local changes reset on reload")).toBeTruthy();
    expect(screen.getAllByText("Multiple Yes flags").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Grantee OK").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Blank flag").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Unsupported value").length).toBeGreaterThan(0);
    expect(screen.getAllByText("No Yes flag").length).toBeGreaterThan(0);
    expect(screen.getByText("Row 21")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /HH_ID 000091/ }));
    expect(screen.getByRole("heading", { name: "HH_ID 000091" })).toBeTruthy();
    expect(screen.getByText("Jomar Ramos · source row 44")).toBeTruthy();
  });

  it("requires a deliberate member choice and reason before recording a local correction", () => {
    render(<HouseholdsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Resolve grantee" }));

    const candidates = screen.getAllByRole("radio");
    expect(candidates).toHaveLength(5);
    expect(candidates.some((candidate) => (candidate as HTMLInputElement).checked)).toBe(false);

    fireEvent.click(screen.getByRole("radio", { name: /Rosa Dela Cruz/ }));
    fireEvent.change(screen.getByLabelText("Reason for correction"), {
      target: { value: "Verified against the signed household record." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record local correction" }));

    expect(screen.getAllByText("Resolved by staff").length).toBeGreaterThan(0);
    expect(screen.getByRole("status").textContent).toContain("Imported GRANTEE values remain unchanged");
    expect(screen.getByText(/Before: Rosa Dela Cruz: Yes, Mario Dela Cruz: Yes/)).toBeTruthy();
    expect(screen.getByText(/Verified against the signed household record/)).toBeTruthy();
  });

  it("filters by household ID and provides a useful no-results state", () => {
    render(<HouseholdsPage />);
    const search = screen.getByRole("searchbox", { name: "Search households" });

    fireEvent.change(search, { target: { value: "000091" } });
    expect(screen.getByRole("heading", { name: "HH_ID 000091" })).toBeTruthy();
    expect(screen.getByText("Showing 1 of 5 sample households")).toBeTruthy();

    fireEvent.change(search, { target: { value: "not-in-the-register" } });
    expect(screen.getByText("No households match those filters.")).toBeTruthy();
    expect(screen.getByText("Select a household")).toBeTruthy();
  });

  it("shows a clear access denial without household details for unrecognized roles", () => {
    vi.mocked(useAuth).mockReturnValue(authFor(["unassigned"]));

    render(<HouseholdsPage />);

    expect(screen.getByRole("alert").textContent).toContain("You do not have access");
    expect(screen.queryByText("HH_ID 000083")).toBeNull();
  });
});
