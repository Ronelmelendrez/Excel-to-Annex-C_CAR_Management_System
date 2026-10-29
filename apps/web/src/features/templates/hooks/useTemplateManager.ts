import { useMemo, useState } from "react";
import {
  mockDetectedPlaceholders,
  mockInitialTemplateVersions,
} from "../mock-data";
import { getTemplateValidationIssues } from "../lib/template-validation";
import type {
  RepeatingTableConfig,
  TemplateFieldMapping,
  TemplateStatusFilter,
  TemplateVersion,
} from "../types";

const maxFileSizeBytes = 5 * 1024 * 1024;
const initialSelectedId = mockInitialTemplateVersions[0]?.id ?? null;

export function useTemplateManager(actor: string) {
  const [versions, setVersions] = useState(mockInitialTemplateVersions);
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TemplateStatusFilter>("all");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [pendingAction, setPendingAction] = useState<"approve" | "activate" | null>(null);
  const [samplePreviewOpen, setSamplePreviewOpen] = useState(false);

  const visibleVersions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return versions
      .filter((version) => statusFilter === "all" || version.status === statusFilter)
      .filter(
        (version) =>
          query.length === 0 ||
          version.name.toLocaleLowerCase().includes(query) ||
          version.fileName.toLocaleLowerCase().includes(query),
      )
      .sort((left, right) => right.version - left.version);
  }, [versions, search, statusFilter]);
  const selectedTemplate =
    visibleVersions.find((version) => version.id === selectedId) ??
    visibleVersions[0] ??
    null;
  const validationIssues = selectedTemplate
    ? getTemplateValidationIssues(selectedTemplate.mappings, selectedTemplate.repeatingTables)
    : [];
  const activeTemplate = versions.find(
    (version) => version.status === "active" && version.name === selectedTemplate?.name,
  );

  function chooseFile(file: File | null) {
    setFileError("");
    setFeedback("");
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (!file.name.toLocaleLowerCase().endsWith(".docx")) {
      setSelectedFile(null);
      setFileError("Choose a Word .docx file. Other formats are not supported.");
      return;
    }
    if (file.size === 0 || file.size > maxFileSizeBytes) {
      setSelectedFile(null);
      setFileError("The selected file must be larger than 0 bytes and no larger than 5 MB.");
      return;
    }
    setSelectedFile(file);
  }

  function addDraftVersion() {
    if (!selectedFile) return;
    const nextVersion = Math.max(0, ...versions.map((version) => version.version)) + 1;
    const id = `annex-c-v${nextVersion}-draft-${Date.now()}`;
    const template: TemplateVersion = {
      id,
      name: "Annex C",
      version: nextVersion,
      fileName: selectedFile.name,
      fileSizeBytes: selectedFile.size,
      status: "draft",
      uploadedAt: new Date().toISOString(),
      uploadedBy: actor,
      mappings: mockDetectedPlaceholders.map((item) => ({
        id: `${id}-${item.id}`,
        placeholder: item.placeholder,
        fieldKey: "",
        required: item.required,
      })),
      repeatingTables: [
        {
          id: `${id}-family`,
          label: "Family Composition",
          enabled: false,
          required: true,
          collectionKey: "",
        },
        {
          id: `${id}-interventions`,
          label: "Intervention Plan",
          enabled: false,
          required: true,
          collectionKey: "",
        },
      ],
    };
    setVersions((current) => [template, ...current]);
    setSelectedId(id);
    setSelectedFile(null);
    setFeedback(
      `${selectedFile.name} was added as a mock draft. File contents were not uploaded or parsed.`,
    );
    setPendingAction(null);
    setSamplePreviewOpen(false);
  }

  function selectTemplate(id: string) {
    setSelectedId(id);
    setFeedback("");
    setPendingAction(null);
    setSamplePreviewOpen(false);
  }

  function updateMapping(
    mappingId: string,
    update: Partial<TemplateFieldMapping>,
  ) {
    setVersions((current) =>
      current.map((version) =>
        version.id !== selectedTemplate?.id || version.status !== "draft"
          ? version
          : {
              ...version,
              mappings: version.mappings.map((mapping) =>
                mapping.id === mappingId ? { ...mapping, ...update } : mapping,
              ),
            },
      ),
    );
    setFeedback("");
  }

  function updateRepeatingTable(
    tableId: string,
    update: Partial<RepeatingTableConfig>,
  ) {
    setVersions((current) =>
      current.map((version) =>
        version.id !== selectedTemplate?.id || version.status !== "draft"
          ? version
          : {
              ...version,
              repeatingTables: version.repeatingTables.map((table) =>
                table.id === tableId ? { ...table, ...update } : table,
              ),
            },
      ),
    );
    setFeedback("");
  }

  function validateDraft() {
    if (!selectedTemplate || selectedTemplate.status !== "draft") return;
    if (validationIssues.length > 0) {
      setFeedback(
        `Validation blocked: ${validationIssues.length} required mapping or repeating-table check${validationIssues.length === 1 ? "" : "s"} need attention.`,
      );
      return;
    }
    setVersions((current) =>
      current.map((version) =>
        version.id === selectedTemplate.id ? { ...version, status: "validated" } : version,
      ),
    );
    setFeedback(`${selectedTemplate.name} v${selectedTemplate.version} passed mock validation.`);
  }

  function requestAction(action: "approve" | "activate") {
    setPendingAction(action);
  }

  function cancelAction() {
    setPendingAction(null);
  }

  function confirmAction() {
    if (!selectedTemplate) return;
    if (pendingAction === "approve") {
      if (selectedTemplate.status !== "validated" || validationIssues.length > 0) {
        setFeedback("Only a validated template with passing checks can be approved.");
        setPendingAction(null);
        return;
      }
      const approvedAt = new Date().toISOString();
      setVersions((current) =>
        current.map((version) =>
          version.id === selectedTemplate.id
            ? { ...version, approvedBy: actor, approvedAt }
            : version,
        ),
      );
      setFeedback(`${selectedTemplate.name} v${selectedTemplate.version} was approved in this mock session.`);
    }
    if (pendingAction === "activate") {
      if (
        selectedTemplate.status !== "validated" ||
        !selectedTemplate.approvedBy ||
        validationIssues.length > 0
      ) {
        setFeedback("Activation requires a validated, approved template with all checks passing.");
        setPendingAction(null);
        return;
      }
      const activatedAt = new Date().toISOString();
      setVersions((current) =>
        current.map((version) => {
          if (version.id === selectedTemplate.id) {
            return { ...version, status: "active", activatedAt };
          }
          if (version.name === selectedTemplate.name && version.status === "active") {
            return { ...version, status: "retired" };
          }
          return version;
        }),
      );
      setFeedback(
        `${selectedTemplate.name} v${selectedTemplate.version} was activated in this mock session. The previous active version is retired.`,
      );
    }
    setPendingAction(null);
  }

  function prepareSampleOutput(format: "docx" | "pdf") {
    if (!selectedTemplate) return;
    if (validationIssues.length > 0) {
      setFeedback("Resolve required mappings and repeating-table checks before preparing a sample.");
      return;
    }
    setVersions((current) =>
      current.map((version) =>
        version.id === selectedTemplate.id
          ? {
              ...version,
              sampleOutputs: { ...version.sampleOutputs, [format]: "ready" },
            }
          : version,
      ),
    );
    setFeedback(`Mock ${format.toUpperCase()} sample prepared. No file was generated or downloaded.`);
    setSamplePreviewOpen(true);
  }

  return {
    versions,
    visibleVersions,
    selectedTemplate,
    activeTemplate,
    validationIssues,
    search,
    statusFilter,
    selectedFile,
    fileError,
    feedback,
    pendingAction,
    samplePreviewOpen,
    setSearch,
    setStatusFilter,
    chooseFile,
    addDraftVersion,
    selectTemplate,
    updateMapping,
    updateRepeatingTable,
    validateDraft,
    requestAction,
    cancelAction,
    confirmAction,
    prepareSampleOutput,
    setSamplePreviewOpen,
  };
}
