import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  activateTemplate,
  approveTemplate,
  createTemplateDraft,
  downloadTemplateFile,
  listTemplateVersions,
  markTemplateValidated,
  updateTemplateConfiguration,
} from "../api";
import { downloadDocxSample, inspectDocxTemplate, renderDocxSample } from "../lib/docx-template";
import {
  getTemplateValidationIssues,
  repeatingCollectionOptions,
} from "../lib/template-validation";
import { templateSampleData } from "../mock-data";
import type {
  RepeatingTableConfig,
  TemplateFieldMapping,
  TemplateStatusFilter,
  TemplateVersion,
} from "../types";

const maxFileSizeBytes = 5 * 1024 * 1024;
type PendingAction = "approve" | "activate" | null;

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function preserveSampleOutputs(
  updated: TemplateVersion,
  current: TemplateVersion[],
): TemplateVersion {
  return {
    ...updated,
    sampleOutputs: current.find((item) => item.id === updated.id)?.sampleOutputs,
  };
}

export function useTemplateManager(
  actor: string,
  userId: string | null,
  enabled = true,
) {
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TemplateStatusFilter>("all");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [samplePreviewOpen, setSamplePreviewOpen] = useState(false);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const loaded = await listTemplateVersions();
      if (!mountedRef.current) return;
      setVersions(loaded);
      setSelectedId((current) =>
        current && loaded.some((item) => item.id === current) ? current : loaded[0]?.id ?? null,
      );
    } catch (error: unknown) {
      if (mountedRef.current) {
        setLoadError(messageOf(error, "Template versions could not be loaded."));
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (enabled) void refresh();
    else setLoading(false);
    return () => {
      mountedRef.current = false;
    };
  }, [enabled, refresh]);

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

  function replaceTemplate(updated: TemplateVersion) {
    setVersions((current) =>
      current.map((version) =>
        version.id === updated.id ? preserveSampleOutputs(updated, current) : version,
      ),
    );
  }

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

  async function addDraftVersion() {
    const file = selectedFile;
    if (!file || !userId || busy) return;
    setBusy(true);
    setFileError("");
    setFeedback("");
    try {
      const inspected = await inspectDocxTemplate(file);
      const mappings: TemplateFieldMapping[] = inspected.placeholders.map((placeholder, index) => ({
        id: `placeholder-${index + 1}`,
        placeholder,
        fieldKey: "",
        required: true,
      }));
      const repeatingTables: RepeatingTableConfig[] = inspected.repeatingSections.map(
        (sectionTag) => {
          const knownCollection = repeatingCollectionOptions.find(
            (option) => option.value === sectionTag,
          );
          return {
            id: `repeat-${sectionTag}`,
            label: knownCollection?.label ?? `Repeating section: ${sectionTag}`,
            enabled: true,
            required: true,
            collectionKey: knownCollection?.value ?? "",
            sectionTag,
          };
        },
      );
      const created = await createTemplateDraft({ file, userId, mappings, repeatingTables });
      if (!mountedRef.current) return;
      setVersions((current) => [ { ...created, uploadedBy: actor }, ...current ]);
      setSelectedId(created.id);
      setSelectedFile(null);
      setPendingAction(null);
      setSamplePreviewOpen(false);
      setFeedback(
        `${file.name} was uploaded to private storage as Annex C v${created.version}. Review the detected placeholders and mappings.`,
      );
    } catch (error: unknown) {
      if (mountedRef.current) {
        setFeedback(messageOf(error, "The template draft could not be created."));
      }
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }

  function selectTemplate(id: string) {
    setSelectedId(id);
    setFeedback("");
    setPendingAction(null);
    setSamplePreviewOpen(false);
  }

  async function updateMapping(
    mappingId: string,
    update: Partial<TemplateFieldMapping>,
  ) {
    if (!selectedTemplate || selectedTemplate.status !== "draft" || busy) return;
    const updated: TemplateVersion = {
      ...selectedTemplate,
      mappings: selectedTemplate.mappings.map((mapping) =>
        mapping.id === mappingId ? { ...mapping, ...update } : mapping,
      ),
    };
    setBusy(true);
    setFeedback("");
    try {
      replaceTemplate(await updateTemplateConfiguration(updated));
      setFeedback("Template mapping saved.");
    } catch (error: unknown) {
      setFeedback(messageOf(error, "The template mapping could not be saved."));
    } finally {
      setBusy(false);
    }
  }

  async function updateRepeatingTable(
    tableId: string,
    update: Partial<RepeatingTableConfig>,
  ) {
    if (!selectedTemplate || selectedTemplate.status !== "draft" || busy) return;
    const updated: TemplateVersion = {
      ...selectedTemplate,
      repeatingTables: selectedTemplate.repeatingTables.map((table) =>
        table.id === tableId ? { ...table, ...update } : table,
      ),
    };
    setBusy(true);
    setFeedback("");
    try {
      replaceTemplate(await updateTemplateConfiguration(updated));
      setFeedback("Repeating-table configuration saved.");
    } catch (error: unknown) {
      setFeedback(messageOf(error, "The repeating-table configuration could not be saved."));
    } finally {
      setBusy(false);
    }
  }

  async function validateDraft() {
    if (!selectedTemplate || selectedTemplate.status !== "draft" || busy) return;
    if (validationIssues.length > 0) {
      setFeedback(
        `Validation blocked: ${validationIssues.length} required mapping or repeating-table check${validationIssues.length === 1 ? "" : "s"} need attention.`,
      );
      return;
    }

    setBusy(true);
    setFeedback("");
    try {
      const file = await downloadTemplateFile(selectedTemplate.storagePath);
      await renderDocxSample(
        await file.arrayBuffer(),
        selectedTemplate.mappings,
        selectedTemplate.repeatingTables,
        templateSampleData,
      );
      const validated = await markTemplateValidated(selectedTemplate.id);
      replaceTemplate(validated);
      setFeedback(`${selectedTemplate.name} v${selectedTemplate.version} passed DOCX and mapping validation.`);
    } catch (error: unknown) {
      setFeedback(messageOf(error, "The Word template could not be validated."));
    } finally {
      setBusy(false);
    }
  }

  function requestAction(action: Exclude<PendingAction, null>) {
    setPendingAction(action);
  }

  function cancelAction() {
    setPendingAction(null);
  }

  async function confirmAction() {
    if (!selectedTemplate || !pendingAction || !userId || busy) return;
    const action = pendingAction;
    setBusy(true);
    setFeedback("");
    try {
      if (action === "approve") {
        const approved = await approveTemplate(selectedTemplate.id, userId);
        replaceTemplate(approved);
        setFeedback(`${selectedTemplate.name} v${selectedTemplate.version} was approved.`);
      } else {
        const updated = await activateTemplate(selectedTemplate.id);
        setVersions(updated.map((version) => preserveSampleOutputs(version, versions)));
        setFeedback(
          `${selectedTemplate.name} v${selectedTemplate.version} was activated. The previous active version is retired.`,
        );
      }
    } catch (error: unknown) {
      setFeedback(messageOf(error, `The template could not be ${action === "approve" ? "approved" : "activated"}.`));
    } finally {
      setPendingAction(null);
      setBusy(false);
    }
  }

  async function prepareSampleOutput(format: "docx" | "pdf") {
    if (format === "pdf") {
      setFeedback("PDF sample generation is not available in this browser workflow. Generate the DOCX sample instead.");
      return;
    }
    if (!selectedTemplate || busy) return;
    if (validationIssues.length > 0) {
      setFeedback("Resolve required mappings and repeating-table checks before generating a sample.");
      return;
    }

    setBusy(true);
    setFeedback("");
    try {
      const file = await downloadTemplateFile(selectedTemplate.storagePath);
      const blob = await renderDocxSample(
        await file.arrayBuffer(),
        selectedTemplate.mappings,
        selectedTemplate.repeatingTables,
        templateSampleData,
      );
      downloadDocxSample(blob, selectedTemplate.fileName);
      setVersions((current) =>
        current.map((version) =>
          version.id === selectedTemplate.id
            ? {
                ...version,
                sampleOutputs: { ...version.sampleOutputs, docx: "ready" },
              }
            : version,
        ),
      );
      setFeedback("A DOCX sample with fabricated test values was downloaded. It is not an official case report.");
      setSamplePreviewOpen(true);
    } catch (error: unknown) {
      setFeedback(messageOf(error, "The DOCX sample could not be generated."));
    } finally {
      setBusy(false);
    }
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
    loadError,
    loading,
    busy,
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
    refresh,
  };
}
