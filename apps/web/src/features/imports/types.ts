import type {
  AnalyzedRow,
  CanonicalField,
  ColumnMapping,
  HouseholdAnalysis,
  ImportAnalysis,
  ImportIssue,
  ImportSummaryCounts,
  RowIssue,
} from "@import-domain";

export type {
  AnalyzedRow,
  CanonicalField,
  ColumnMapping,
  HouseholdAnalysis,
  ImportAnalysis,
  ImportIssue,
  ImportSummaryCounts,
  RowIssue,
};

export type WorkbookFile = {
  file: File;
  fileHash: string;
  size: number;
  sheetNames: string[];
};

export type SheetInspection = {
  sheetName: string;
  headerRow: number;
  detectedHeaderRow: number;
  headers: string[];
  sampleRows: unknown[][];
  mapping: ColumnMapping;
  rowCount: number;
};

export type DuplicateImport = {
  id: string;
  version: number;
  file_name: string | null;
  sheet_name: string;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  committed_at: string | null;
  row_count: number;
  error_row_count: number;
};

export type PreviewRow = {
  source_row_no: number;
  status: "valid" | "invalid";
  normalized: Partial<Record<CanonicalField, string | null>>;
  issues: RowIssue[];
};

export type PreviewIssue = {
  source_row_no: number;
  field: string;
  code: string;
  message: string;
  guidance: string;
};

export type ImportPreview = {
  file_hash: string;
  file_size: number;
  sheet_name: string;
  sheet_names: string[];
  header_row: number;
  detected_header_row: number;
  headers: string[];
  mapping: ColumnMapping;
  required_columns: CanonicalField[];
  warnings: string[];
  structural_errors: ImportIssue[];
  summary: ImportSummaryCounts;
  rows: PreviewRow[];
  rows_truncated: boolean;
  issues: PreviewIssue[];
  issues_truncated: boolean;
  households: HouseholdAnalysis[];
  households_truncated: boolean;
  duplicate: DuplicateImport | null;
  ok: boolean;
  can_commit: boolean;
};

export type ImportRecord = {
  id: string;
  file_name: string | null;
  file_hash: string;
  file_size: number | null;
  sheet_name: string;
  version: number;
  status: string;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  created_at: string;
  committed_at: string | null;
  row_count: number;
  valid_row_count: number;
  error_row_count: number;
  household_count: number;
  member_count: number;
  is_duplicate: boolean;
  duplicate_of: string | null;
  header_row: number | null;
};

export type ImportListResponse = {
  imports: ImportRecord[];
  total: number;
  limit: number;
  offset: number;
};

export type CommitResponse = {
  import: ImportRecord;
  summary: ImportSummaryCounts;
  report_available: boolean;
};

export type PreviewRequest = {
  storage_path: string;
  sheet_name: string;
  header_row: number;
  column_mapping: ColumnMapping;
  file_hash: string;
  file_name: string;
};

export type CommitRequest = PreviewRequest & {
  confirm_duplicate: boolean;
};

export type WizardStage = "choose" | "shape" | "preview" | "committed";

export type WizardError = {
  title: string;
  detail: string;
  retryable: boolean;
};
