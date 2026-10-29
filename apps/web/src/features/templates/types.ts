export type TemplateStatus = "draft" | "validated" | "active" | "retired";

export type TemplateFieldMapping = {
  id: string;
  placeholder: string;
  fieldKey: string;
  required: boolean;
};

export type RepeatingTableConfig = {
  id: string;
  label: string;
  enabled: boolean;
  required: boolean;
  collectionKey: string;
};

export type TemplateVersion = {
  id: string;
  name: string;
  version: number;
  fileName: string;
  fileSizeBytes: number;
  status: TemplateStatus;
  uploadedAt: string;
  uploadedBy: string;
  mappings: TemplateFieldMapping[];
  repeatingTables: RepeatingTableConfig[];
  approvedBy?: string;
  approvedAt?: string;
  activatedAt?: string;
  sampleOutputs?: Partial<Record<"docx" | "pdf", "ready" | "failed">>;
};

export type TemplateValidationIssue = {
  id: string;
  label: string;
  message: string;
};

export type TemplateStatusFilter = "all" | TemplateStatus;
