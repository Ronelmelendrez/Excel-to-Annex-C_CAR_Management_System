import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "../../../app/providers";
import { CarsPage } from "../components/CarsPage";

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

describe("F5 CAR authoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue(authFor(["case_worker"]));
  });

  afterEach(() => {
    cleanup();
  });

  it("shows a mock draft, validated source household, blank narrative fields, and missing-field checklist", () => {
    render(<CarsPage />);

    expect(screen.getByText("Mock drafts · changes reset on reload")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /CAR-2026-023/ })).toBeTruthy();
    expect(screen.getAllByText(/Jomar Ramos/).length).toBeGreaterThan(0);
    expect(screen.getByRole("textbox", { name: "Presenting problem" })).toHaveProperty("value", "");
    expect(screen.getByRole("textbox", { name: "Background information" })).toHaveProperty("value", "");
    expect(screen.getByRole("textbox", { name: "Case worker assessment" })).toHaveProperty("value", "");
    expect(screen.getByRole("textbox", { name: "Case worker recommendation" })).toHaveProperty("value", "");
    expect(screen.getByText("Draft · incomplete")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Template version selected/ }).length).toBe(1);
    expect(screen.queryByRole("button", { name: /Approve|Submit for review/ })).toBeNull();
  });

  it("creates a draft only after selecting a validated household", () => {
    render(<CarsPage />);

    const householdSelect = screen.getByRole("combobox", { name: "Household" });
    expect((householdSelect as HTMLSelectElement).value).toBe("");
    expect(screen.getByRole("button", { name: "Create draft" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("option", { name: /000091 · Jomar Ramos/ })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /000083|000104|000117|000132/ })).toBeNull();

    fireEvent.change(householdSelect, { target: { value: "hh-0091" } });
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));

    expect(screen.getByRole("heading", { name: /CAR-2026-024/ })).toBeTruthy();
    expect(screen.getAllByText(/HH_ID 000091/).length).toBeGreaterThan(0);
  });

  it("renders a non-final draft preview with blank sections clearly labeled", () => {
    render(<CarsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Preview draft" }));

    expect(screen.getByText("DRAFT — NOT APPROVED")).toBeTruthy();
    expect(screen.getByText(/not an official Annex C document/i)).toBeTruthy();
    expect(screen.getAllByText("Not entered").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Return to editor" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Return to editor" }));
    expect(screen.getByRole("textbox", { name: "Presenting problem" })).toBeTruthy();
  });

  it("supports editing family composition and repeating intervention rows with local autosave", async () => {
    render(<CarsPage />);

    const compositionToggle = screen.getAllByRole("checkbox", { name: /Included/ })[0];
    fireEvent.click(compositionToggle);
    expect(screen.getByText("Excluded from draft")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Add intervention" }));
    expect(screen.getByRole("group", { name: "Intervention 2" })).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText("Saved in this session")).toBeTruthy();
      expect(screen.getByText("Autosaved locally")).toBeTruthy();
    });
  });

  it("denies CAR details to users without an authoring role", () => {
    vi.mocked(useAuth).mockReturnValue(authFor(["auditor"]));

    render(<CarsPage />);

    expect(screen.getByRole("alert").textContent).toContain("You do not have access to CAR authoring");
    expect(screen.queryByText("CAR-2026-023")).toBeNull();
  });
});
