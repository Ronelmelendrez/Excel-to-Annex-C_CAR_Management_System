import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "../../../app/providers";
import { DocumentsPage } from "../components/DocumentsPage";

vi.mock("../../../app/providers", () => ({
  useAuth: vi.fn(),
}));

function authFor(roles: string[]) {
  return {
    session: {},
    user: { id: "worker-01", email: "worker@example.test" },
    profile: { id: "worker-01", display_name: "Demo case worker", status: "active" as const },
    roles,
    loading: false,
    signIn: async () => ({}),
    signOut: async () => {},
  };
}

describe("F8 document generation and downloads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue(authFor(["case_worker"]));
  });

  afterEach(() => {
    cleanup();
  });

  it("shows report provenance and independent mock DOCX and PDF status", () => {
    render(<DocumentsPage />);

    expect(screen.getByText("Mock jobs · no files or signed links")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /CAR-2026-023 · Revision 2/ })).toBeTruthy();
    expect(screen.getByText("SY2026 Q1 · v3")).toBeTruthy();
    expect(screen.getByText("Annex C · v1.0")).toBeTruthy();
    expect(screen.getByText("Reviewer A (mock)")).toBeTruthy();
    expect(screen.getAllByText("Verified · mock only")).toHaveLength(2);
    expect(screen.getAllByText("This mock verification does not mean a real document exists.")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Download PDF · unavailable" })).toHaveProperty("disabled", true);
  });

  it("blocks generation for submitted and draft CAR revisions", () => {
    render(<DocumentsPage />);
    fireEvent.click(screen.getByRole("button", { name: /CAR-2026-024/ }));

    expect(screen.getByText(/Only manually approved revisions can generate/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Generate DOCX/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Generate PDF/ })).toBeNull();
  });

  it("retries a failed PDF job using the existing idempotency key and verifies only that output", async () => {
    render(<DocumentsPage />);
    fireEvent.click(screen.getByRole("button", { name: /CAR-2026-019/ }));

    expect(screen.getByRole("alert").textContent).toContain("PDF_CONVERSION_FAILED");
    expect(screen.getByRole("button", { name: /Retry PDF/ })).toBeTruthy();
    const idempotencyKey = screen.getByText("mock-report-019-rev1-pdf").textContent;
    expect(idempotencyKey).toBe("mock-report-019-rev1-pdf");
    fireEvent.click(screen.getByRole("button", { name: /Retry PDF/ }));

    expect(screen.getByText(idempotencyKey ?? "")).toBeTruthy();
    await waitFor(() => {
      expect(screen.getAllByText("Verified · mock only")).toHaveLength(2);
      expect(screen.getByText(/passed all integrity checks/)).toBeTruthy();
    });
    expect(screen.getAllByText("Verified · mock only")).toHaveLength(2);
    expect(
      screen.getAllByText(
        "This output is already verified for this revision. Create a new CAR revision for new document content.",
      ),
    ).toHaveLength(2);
  });

  it("prevents duplicate generation for a verified output", () => {
    render(<DocumentsPage />);
    fireEvent.click(screen.getByRole("button", { name: /CAR-2026-023/ }));

    expect(
      screen.getAllByText("This output is already verified for this revision. Create a new CAR revision for new document content."),
    ).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Generate DOCX · mock" })).toBeNull();
  });

  it("filters by report or household and provides an empty state", () => {
    render(<DocumentsPage />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search report or household" }), {
      target: { value: "000083" },
    });
    expect(screen.getByRole("button", { name: /CAR-2026-014/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /CAR-2026-019/ })).toBeNull();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search report or household" }), {
      target: { value: "missing-record" },
    });
    expect(screen.getByText("No reports match these filters. Try another CAR reference or approval status.")).toBeTruthy();
    expect(screen.getByText("Select a report")).toBeTruthy();
  });

  it("shows reports read-only to auditors and denies unrecognized roles", () => {
    vi.mocked(useAuth).mockReturnValue(authFor(["auditor"]));
    const { rerender } = render(<DocumentsPage />);
    expect(screen.getByText("This is a read-only view. Your role cannot generate or retry document jobs.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Generate DOCX/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Download PDF · unavailable" })).toHaveProperty("disabled", true);
    expect(screen.queryByRole("button", { name: /Retry PDF/ })).toBeNull();

    vi.mocked(useAuth).mockReturnValue(authFor(["operator"]));
    rerender(<DocumentsPage />);
    expect(screen.getByRole("alert").textContent).toContain("You do not have access to generated documents");
    expect(screen.queryByText("CAR-2026-023")).toBeNull();
  });
});
