import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "../../../app/providers";
import {
  activateTemplate,
  approveTemplate,
  createTemplateDraft,
  downloadTemplateFile,
  listTemplateVersions,
  markTemplateValidated,
  updateTemplateConfiguration,
} from "../api";
import {
  downloadDocxSample,
  inspectDocxTemplate,
  renderDocxSample,
} from "../lib/docx-template";
import { TemplatesPage } from "../components/TemplatesPage";
import type { TemplateVersion } from "../types";

vi.mock("../../../app/providers", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../api", () => ({
  activateTemplate: vi.fn(),
  approveTemplate: vi.fn(),
  createTemplateDraft: vi.fn(),
  downloadTemplateFile: vi.fn(),
  listTemplateVersions: vi.fn(),
  markTemplateValidated: vi.fn(),
  updateTemplateConfiguration: vi.fn(),
}));

vi.mock("../lib/docx-template", () => ({
  downloadDocxSample: vi.fn(),
  inspectDocxTemplate: vi.fn(),
  renderDocxSample: vi.fn(),
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

function withArrayBuffer<T extends Blob>(blob: T): T {
  if (typeof blob.arrayBuffer !== "function") {
    Object.defineProperty(blob, "arrayBuffer", {
      value: () =>
        new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (reader.result instanceof ArrayBuffer) resolve(reader.result);
            else reject(new Error("The test Blob could not be read as an ArrayBuffer."));
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsArrayBuffer(blob);
        }),
    });
  }
  return blob;
}

const draftTemplate: TemplateVersion = {
  id: "annex-c-v2-draft",
  name: "Annex C",
  version: 2,
  fileName: "Annex_C_template_v2.docx",
  fileSizeBytes: 284_160,
  storagePath: "annex-c/template-2/Annex_C_template_v2.docx",
  status: "draft",
  uploadedAt: "2026-10-28T07:45:00.000Z",
  uploadedBy: "admin-01",
  mappings: [
    { id: "car-ref", placeholder: "CAR_REFERENCE", fieldKey: "car.reference", required: true },
    { id: "assessment", placeholder: "ASSESSMENT", fieldKey: "", required: true },
  ],
  repeatingTables: [
    {
      id: "family",
      label: "Family composition rows",
      enabled: true,
      required: true,
      collectionKey: "familyComposition",
      sectionTag: "familyComposition",
    },
    {
      id: "interventions",
      label: "Intervention plan rows",
      enabled: false,
      required: true,
      collectionKey: "",
      sectionTag: "interventions",
    },
  ],
};

const activeTemplate: TemplateVersion = {
  ...draftTemplate,
  id: "annex-c-v1-active",
  version: 1,
  fileName: "Annex_C_template_v1.docx",
  storagePath: "annex-c/template-1/Annex_C_template_v1.docx",
  status: "active",
  mappings: draftTemplate.mappings.map((mapping) => ({
    ...mapping,
    fieldKey: mapping.fieldKey || "car.assessment",
  })),
  repeatingTables: draftTemplate.repeatingTables.map((table) => ({
    ...table,
    enabled: true,
    collectionKey: table.sectionTag ?? "familyComposition",
  })),
  approvedBy: "admin-01",
  approvedAt: "2026-10-27T03:00:00.000Z",
  activatedAt: "2026-10-28T04:30:00.000Z",
};

const configuredDraftTemplate: TemplateVersion = {
  ...draftTemplate,
  mappings: draftTemplate.mappings.map((mapping) => ({
    ...mapping,
    fieldKey: mapping.fieldKey || "car.assessment",
  })),
  repeatingTables: draftTemplate.repeatingTables.map((table) => ({
    ...table,
    enabled: true,
    collectionKey: table.id === "interventions" ? "interventions" : table.collectionKey,
  })),
};

describe("F7 template management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue(authFor(["admin"]));
    vi.mocked(listTemplateVersions).mockResolvedValue([draftTemplate, activeTemplate]);
    vi.mocked(inspectDocxTemplate).mockResolvedValue({
      placeholders: ["CAR_REFERENCE", "ASSESSMENT"],
      repeatingSections: ["familyComposition"],
    });
    vi.mocked(createTemplateDraft).mockImplementation(async ({ file, mappings, repeatingTables }) => ({
      ...draftTemplate,
      id: "annex-c-v3-draft",
      version: 3,
      fileName: file.name,
      storagePath: "annex-c/template-3/template.docx",
      mappings,
      repeatingTables,
    }));
    vi.mocked(updateTemplateConfiguration).mockImplementation(async (template) => template);
    vi.mocked(downloadTemplateFile).mockResolvedValue(withArrayBuffer(new Blob(["template"])));
    vi.mocked(renderDocxSample).mockResolvedValue(new Blob(["sample"]));
    vi.mocked(markTemplateValidated).mockResolvedValue({
      ...draftTemplate,
      status: "validated",
    });
    vi.mocked(approveTemplate).mockResolvedValue({
      ...draftTemplate,
      status: "validated",
      approvedBy: "admin-01",
      approvedAt: "2026-10-29T03:00:00.000Z",
    });
    vi.mocked(activateTemplate).mockResolvedValue([
      { ...draftTemplate, status: "active", approvedBy: "admin-01" },
      { ...activeTemplate, status: "retired" },
    ]);
  });

  afterEach(() => {
    cleanup();
  });

  it("loads persisted versions and blocks incomplete required mappings", async () => {
    render(<TemplatesPage />);

    expect(await screen.findByRole("heading", { name: "Annex_C_template_v2.docx" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Template management" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "CAR field for ASSESSMENT" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Validate template" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("button", { name: "Generate sample DOCX" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(listTemplateVersions).toHaveBeenCalledOnce();
  });

  it("uploads a DOCX, detects its real placeholders, and saves a draft version", async () => {
    render(<TemplatesPage />);
    await screen.findByRole("heading", { name: "Annex_C_template_v2.docx" });
    const file = new File(["docx bytes"], "New_Annex_C.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    fireEvent.change(screen.getByLabelText("Word template"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Upload and inspect" }));

    await waitFor(() => expect(createTemplateDraft).toHaveBeenCalledOnce());
    expect(inspectDocxTemplate).toHaveBeenCalledWith(file);
    expect(createTemplateDraft).toHaveBeenCalledWith({
      file,
      userId: "admin-01",
      mappings: [
        { id: "placeholder-1", placeholder: "CAR_REFERENCE", fieldKey: "", required: true },
        { id: "placeholder-2", placeholder: "ASSESSMENT", fieldKey: "", required: true },
      ],
      repeatingTables: [
        {
          id: "repeat-familyComposition",
          label: "Family composition rows",
          enabled: true,
          required: true,
          collectionKey: "familyComposition",
          sectionTag: "familyComposition",
        },
      ],
    });
    expect(await screen.findByRole("heading", { name: "New_Annex_C.docx" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("uploaded to private storage");
  });

  it("persists configuration, validates the DOCX, approves, and activates the version", async () => {
    vi.mocked(markTemplateValidated).mockResolvedValue({
      ...configuredDraftTemplate,
      status: "validated",
    });
    vi.mocked(approveTemplate).mockResolvedValue({
      ...configuredDraftTemplate,
      status: "validated",
      approvedBy: "admin-01",
      approvedAt: "2026-10-29T03:00:00.000Z",
    });
    vi.mocked(activateTemplate).mockResolvedValue([
      {
        ...configuredDraftTemplate,
        status: "active",
        approvedBy: "admin-01",
      },
      { ...activeTemplate, status: "retired" },
    ]);

    render(<TemplatesPage />);
    await screen.findByRole("heading", { name: "Annex_C_template_v2.docx" });

    fireEvent.change(screen.getByLabelText("CAR field for ASSESSMENT"), {
      target: { value: "car.assessment" },
    });
    await waitFor(() => expect(updateTemplateConfiguration).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByLabelText("CAR field for ASSESSMENT")).not.toBeDisabled(),
    );

    fireEvent.click(screen.getAllByRole("checkbox", { name: "Enabled" })[1]);
    await waitFor(() => expect(updateTemplateConfiguration).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getAllByRole("combobox", { name: "Source collection" })[1]).not.toBeDisabled());
    fireEvent.change(screen.getAllByRole("combobox", { name: "Source collection" })[1], {
      target: { value: "interventions" },
    });
    await waitFor(() => expect(updateTemplateConfiguration).toHaveBeenCalledTimes(3));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Validate template" })).not.toBeDisabled(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Validate template" }));
    await waitFor(() => expect(markTemplateValidated).toHaveBeenCalledWith(draftTemplate.id));
    expect(downloadTemplateFile).toHaveBeenCalledWith(draftTemplate.storagePath);
    expect(renderDocxSample).toHaveBeenCalled();

    fireEvent.click(await screen.findByRole("button", { name: "Approve version" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm approval" }));
    await waitFor(() => expect(approveTemplate).toHaveBeenCalledWith("annex-c-v2-draft", "admin-01"));

    fireEvent.click(await screen.findByRole("button", { name: "Activate version" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm activation" }));
    await waitFor(() => expect(activateTemplate).toHaveBeenCalledWith("annex-c-v2-draft"));
    expect(screen.getByRole("status").textContent).toContain("was activated");
  });

  it("generates a real DOCX sample and clearly leaves PDF unavailable", async () => {
    vi.mocked(listTemplateVersions).mockResolvedValue([activeTemplate]);
    render(<TemplatesPage />);
    await screen.findByRole("heading", { name: "Annex_C_template_v1.docx" });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Generate sample DOCX" })).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Generate sample DOCX" }));
    await waitFor(() => expect(downloadDocxSample).toHaveBeenCalledOnce());
    expect(screen.getByRole("status").textContent).toContain("DOCX sample with fabricated test values was downloaded");
    expect(screen.getByRole("button", { name: "PDF output unavailable" })).toBeDisabled();
    expect(screen.getByText("PDF: Not available in this workflow")).toBeTruthy();
  });

  it("shows a clear load error with retry and does not fetch templates for non-admins", async () => {
    vi.mocked(listTemplateVersions)
      .mockRejectedValueOnce(new Error("Supabase is not configured."))
      .mockResolvedValueOnce([]);
    render(<TemplatesPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Supabase is not configured.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText(/No template versions match/)).toBeTruthy();
    expect(listTemplateVersions).toHaveBeenCalledTimes(2);

    cleanup();
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue(authFor(["case_worker"]));
    render(<TemplatesPage />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "You do not have access to template management",
    );
    expect(listTemplateVersions).not.toHaveBeenCalled();
  });
});
