import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "../../../app/providers";
import { TemplatesPage } from "../components/TemplatesPage";

vi.mock("../../../app/providers", () => ({
  useAuth: vi.fn(),
}));

function authFor(roles: string[]) {
  return {
    session: {},
    user: { id: "admin-01", email: "admin@example.test" },
    profile: { id: "admin-01", display_name: "Demo administrator", status: "active" as const },
    roles,
    loading: false,
    signIn: async () => ({}),
    signOut: async () => {},
  };
}

describe("F7 template management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue(authFor(["admin"]));
  });

  afterEach(() => {
    cleanup();
  });

  it("shows versioned mock templates and blocks incomplete required mappings", () => {
    render(<TemplatesPage />);

    expect(screen.getByText("Mock versions · changes reset on reload")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Template management" })).toBeTruthy();
    expect(screen.getAllByText("Annex_C_template_v2.docx").length).toBeGreaterThan(0);
    expect(screen.getByText(/Required placeholders without a mapping block validation/)).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "CAR field for ASSESSMENT" })).toBeTruthy();
    expect(screen.getAllByRole("combobox", { name: "Source collection" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Validate mock configuration" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("button", { name: "Generate sample DOCX" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("validates, approves, activates, and retires the previous version after confirmation", () => {
    render(<TemplatesPage />);

    fireEvent.change(screen.getByLabelText("CAR field for ASSESSMENT"), {
      target: { value: "car.assessment" },
    });
    fireEvent.click(screen.getAllByRole("checkbox", { name: "Enabled" })[1]);
    fireEvent.change(screen.getAllByRole("combobox", { name: "Source collection" })[1], {
      target: { value: "interventions" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Validate mock configuration" }));
    expect(screen.getByRole("status").textContent).toContain("passed mock validation");

    fireEvent.click(screen.getByRole("button", { name: "Approve version" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm approval" }));
    expect(screen.getByText(/Approved by Demo administrator/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Activate version" }));
    expect(screen.getByRole("alert").textContent).toContain("Activation retires Annex C v1");
    fireEvent.click(screen.getByRole("button", { name: "Confirm activation" }));
    expect(screen.getByRole("status").textContent).toContain("was activated in this mock session");

    fireEvent.click(screen.getByRole("button", { name: /Annex_C_template_v1\.docx/ }));
    expect(screen.getByText("Retired version · v1")).toBeTruthy();
    expect(screen.getAllByText(/This version is read-only/).length).toBeGreaterThan(0);
  });

  it("shows a sample preview and independent mock DOCX and PDF output states", () => {
    render(<TemplatesPage />);
    fireEvent.click(screen.getByRole("button", { name: /Annex_C_template_v1\.docx/ }));

    fireEvent.click(screen.getByRole("button", { name: "Generate sample DOCX" }));
    expect(screen.getByRole("status").textContent).toContain("Mock DOCX sample prepared");
    expect(screen.getByText("DOCX: Mock sample ready · no file created")).toBeTruthy();
    expect(screen.getByText("PDF: Not generated")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Generate sample PDF" }));
    expect(screen.getByText("PDF: Mock sample ready · no file created")).toBeTruthy();
    expect(screen.getByText(/Mock preview · not an official form/)).toBeTruthy();
    expect(screen.getByText("Sample test data — not a real case narrative.")).toBeTruthy();
  });

  it("validates DOCX selection and creates a new local draft without uploading file contents", () => {
    render(<TemplatesPage />);
    const fileInput = screen.getByLabelText("Word template");
    const invalidFile = new File(["sample"], "template.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    expect(screen.getByRole("alert").textContent).toContain("Choose a Word .docx file");
    expect(screen.getByRole("button", { name: "Add mock draft version" })).toHaveProperty(
      "disabled",
      true,
    );

    const validFile = new File(["mock"], "New_Annex_C.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    fireEvent.change(fileInput, { target: { files: [validFile] } });
    fireEvent.click(screen.getByRole("button", { name: "Add mock draft version" }));

    expect(screen.getByRole("status").textContent).toContain("File contents were not uploaded or parsed");
    expect(screen.getAllByText("New_Annex_C.docx").length).toBeGreaterThan(0);
    expect(screen.getByText("10 blockers")).toBeTruthy();
  });

  it("denies template details to non-admin roles", () => {
    vi.mocked(useAuth).mockReturnValue(authFor(["case_worker"]));
    render(<TemplatesPage />);

    expect(screen.getByRole("alert").textContent).toContain("You do not have access to template management");
    expect(screen.queryByText("Annex_C_template_v2.docx")).toBeNull();
  });
});
