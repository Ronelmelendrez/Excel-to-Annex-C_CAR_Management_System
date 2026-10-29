import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "../../../app/providers";
import { ReviewPage } from "../components/ReviewPage";

vi.mock("../../../app/providers", () => ({
  useAuth: vi.fn(),
}));

function authFor(roles: string[], profileId = "reviewer-01") {
  return {
    session: {},
    user: { email: "reviewer@example.test" },
    profile: { id: profileId, display_name: "Demo reviewer", status: "active" as const },
    roles,
    loading: false,
    signIn: async () => ({}),
    signOut: async () => {},
  };
}

describe("F6 CAR review queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue(authFor(["reviewer"]));
  });

  afterEach(() => {
    cleanup();
  });

  it("shows submitted mock CARs with provenance and passing approval gates", () => {
    render(<ReviewPage />);

    expect(screen.getByText("Mock reviews · actions reset on reload")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /CAR-2026-019/ })).toBeTruthy();
    expect(screen.getByText("SY2026 Q1 · v3")).toBeTruthy();
    expect(screen.getByText("Annex C · v1.0 (mock)")).toBeTruthy();
    expect(screen.getByText("Validated grantee")).toBeTruthy();
    expect(screen.getByText("Every blocking gate must pass before approval. Only explicitly eligible checks may use a reasoned exception.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Approve revision 1" })).toHaveProperty("disabled", true);
  });

  it("requires a comment and records a local approval after all gates pass", () => {
    render(<ReviewPage />);

    const comment = screen.getByRole("textbox", { name: "Reviewer comment" });
    const approveButton = screen.getByRole("button", { name: "Approve revision 1" });
    expect(approveButton).toHaveProperty("disabled", true);

    fireEvent.change(comment, { target: { value: "Reviewed the submitted revision." } });
    expect(approveButton).toHaveProperty("disabled", false);
    fireEvent.click(approveButton);

    expect(screen.getByRole("status").textContent).toContain("CAR-2026-019 revision 1 was approved");
    expect(screen.getByText(/Approved · CAR-2026-019 · Revision 1/)).toBeTruthy();
    expect(screen.getByText("Reviewed the submitted revision.")).toBeTruthy();
    expect(screen.getByText("Approved revision · read-only")).toBeTruthy();
  });

  it("blocks approval on a failed gate unless an eligible mock exception has a reason", () => {
    render(<ReviewPage />);
    fireEvent.click(screen.getByRole("button", { name: /CAR-2026-024/ }));

    const approveButton = screen.getByRole("button", { name: "Approve revision 2" });
    expect(screen.getByText("1 blocked")).toBeTruthy();
    expect(approveButton).toHaveProperty("disabled", true);
    expect(screen.getByText("Eligible for a mock exception with a reason.")).toBeTruthy();

    fireEvent.click(screen.getByRole("checkbox", { name: /Request a mock exception/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Exception reason" }), {
      target: { value: "Mock exception reason for test coverage." },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Reviewer comment" }), {
      target: { value: "Reviewing with the sample exception." },
    });
    expect(approveButton).toHaveProperty("disabled", false);
    fireEvent.click(approveButton);

    expect(screen.getByText("Mock exception reason: Mock exception reason for test coverage.")).toBeTruthy();
    expect(screen.getByText(/CAR-2026-024 revision 2 was approved/)).toBeTruthy();
  });

  it("requires a comment before requesting changes", () => {
    render(<ReviewPage />);
    const requestButton = screen.getByRole("button", { name: "Request changes" });

    expect(requestButton).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByRole("textbox", { name: "Reviewer comment" }), {
      target: { value: "Please clarify the supporting information." },
    });
    fireEvent.click(requestButton);

    expect(screen.getByRole("status").textContent).toContain("Changes were requested for CAR-2026-019");
    expect(screen.getByText(/Changes requested · CAR-2026-019 · Revision 1/)).toBeTruthy();
  });

  it("prevents a reviewer from deciding on their own submission and denies other roles", () => {
    vi.mocked(useAuth).mockReturnValue(authFor(["reviewer"], "case-worker-01"));
    const { rerender } = render(<ReviewPage />);
    expect(screen.getByRole("alert").textContent).toContain("You submitted this CAR");
    expect(screen.queryByRole("button", { name: /Approve revision/ })).toBeNull();

    vi.mocked(useAuth).mockReturnValue(authFor(["auditor"]));
    rerender(<ReviewPage />);
    expect(screen.getByRole("alert").textContent).toContain("You do not have access to the review queue");
    expect(screen.queryByText("CAR-2026-019")).toBeNull();
  });
});
