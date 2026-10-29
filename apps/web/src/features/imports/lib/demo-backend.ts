import {
  analyzeRows,
  autoMapping,
  DEFAULT_REQUIRED_COLUMNS,
  detectHeaderRow,
  headersFromRow,
  MAX_IMPORT_ROWS,
  PREVIEW_HOUSEHOLD_LIMIT,
  PREVIEW_ISSUE_LIMIT,
  PREVIEW_ROW_LIMIT,
  issuesToCsv,
  type CanonicalField,
  type ColumnMapping,
  type ImportAnalysis,
} from '@import-domain';
import { ApiError } from '../../../shared/api';
import { DEMO_DISPLAY_NAME, DEMO_USER_ID } from '../../../shared/demo';
import type {
  CommitRequest,
  CommitResponse,
  DuplicateImport,
  ImportListResponse,
  ImportPreview,
  ImportRecord,
  PreviewIssue,
  PreviewRequest,
} from '../types';

/**
 * Local mock implementation of the imports Edge Function.
 *
 * It mirrors the server rules closely enough to exercise the UI: the workbook
 * is parsed in the browser, validated with the shared import domain, duplicate
 * uploads are detected by fingerprint + sheet, and committed records persist in
 * localStorage. No data leaves the machine.
 */

const IMPORTS_KEY = 'car.demo.imports.v1';
const ISSUES_KEY = 'car.demo.issues.v1';
const BUCKET_FILES = new Map<string, File>();

type DemoState = {
  imports: ImportRecord[];
  issues: Record<string, PreviewIssue[]>;
};

const SEED_HASH_A = 'a3f19c0d5e8b7a2c4d6f8e0b1c3d5e7f9a0b2c4d6e8f0a1b3c5d7e9f1a3b5c7d';
const SEED_HASH_B = 'b7d24e1f6a9c3b5d8e0f2a4c6b8d1e3f5a7c9b0d2e4f6a8c1b3d5e7f9a0c2e4b';

function seededImports(): ImportRecord[] {
  return [
    {
      id: 'imp_demo_0003',
      file_name: 'SY2026_Q1_household_profiles.xlsx',
      file_hash: SEED_HASH_A,
      file_size: 184320,
      sheet_name: 'Households',
      version: 2,
      status: 'committed',
      uploaded_by: DEMO_USER_ID,
      uploaded_by_name: DEMO_DISPLAY_NAME,
      created_at: '2026-10-27T08:58:00.000Z',
      committed_at: '2026-10-27T09:00:14.000Z',
      row_count: 412,
      valid_row_count: 412,
      error_row_count: 0,
      household_count: 148,
      member_count: 412,
      is_duplicate: true,
      duplicate_of: 'imp_demo_0001',
      header_row: 2,
    },
    {
      id: 'imp_demo_0002',
      file_name: 'Region_IV-A_batch02.xlsx',
      file_hash: SEED_HASH_B,
      file_size: 76288,
      sheet_name: 'Sheet1',
      version: 1,
      status: 'committed',
      uploaded_by: DEMO_USER_ID,
      uploaded_by_name: DEMO_DISPLAY_NAME,
      created_at: '2026-10-26T03:12:00.000Z',
      committed_at: '2026-10-26T03:13:05.000Z',
      row_count: 96,
      valid_row_count: 96,
      error_row_count: 0,
      household_count: 31,
      member_count: 96,
      is_duplicate: false,
      duplicate_of: null,
      header_row: 1,
    },
    {
      id: 'imp_demo_0001',
      file_name: 'SY2026_Q1_household_profiles.xlsx',
      file_hash: SEED_HASH_A,
      file_size: 184320,
      sheet_name: 'Households',
      version: 1,
      status: 'committed',
      uploaded_by: DEMO_USER_ID,
      uploaded_by_name: DEMO_DISPLAY_NAME,
      created_at: '2026-10-24T01:40:00.000Z',
      committed_at: '2026-10-24T01:41:12.000Z',
      row_count: 412,
      valid_row_count: 409,
      error_row_count: 3,
      household_count: 148,
      member_count: 412,
      is_duplicate: false,
      duplicate_of: null,
      header_row: 2,
    },
  ];
}

function seededIssues(): Record<string, PreviewIssue[]> {
  return {
    imp_demo_0001: [
      {
        source_row_no: 14,
        field: 'ENTRY_ID',
        code: 'duplicate_entry_id',
        message: 'ENTRY_ID 0000457 appears 2 times in this sheet.',
        guidance: 'Keep both rows, then resolve the duplicate during household review.',
      },
      {
        source_row_no: 27,
        field: 'GRANTEE',
        code: 'invalid_grantee',
        message: 'GRANTEE "Y" is not Yes or No.',
        guidance: 'Use exactly Yes or No. Abbreviations such as Y, N, 1, or True are not accepted.',
      },
      {
        source_row_no: 33,
        field: 'FIRST_NAME',
        code: 'missing_required',
        message: 'FIRST_NAME is blank.',
        guidance: 'Fill First name on source row 33. The row is kept and flagged for review.',
      },
    ],
  };
}

let state: DemoState | null = null;

function loadState(): DemoState {
  if (state) return state;
  const fallback: DemoState = {
    imports: seededImports(),
    issues: seededIssues(),
  };
  if (typeof localStorage === 'undefined') {
    state = fallback;
    return state;
  }
  try {
    const rawImports = localStorage.getItem(IMPORTS_KEY);
    const rawIssues = localStorage.getItem(ISSUES_KEY);
    if (rawImports) {
      const parsed = JSON.parse(rawImports);
      if (Array.isArray(parsed)) fallback.imports = parsed as ImportRecord[];
    }
    if (rawIssues) {
      const parsed = JSON.parse(rawIssues);
      if (parsed && typeof parsed === 'object') {
        fallback.issues = parsed as Record<string, PreviewIssue[]>;
      }
    }
  } catch {
    // Corrupt demo storage: fall back to the seeds.
  }
  state = fallback;
  return state;
}

function persist() {
  if (!state || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(IMPORTS_KEY, JSON.stringify(state.imports));
    localStorage.setItem(ISSUES_KEY, JSON.stringify(state.issues));
  } catch {
    // Quota or privacy mode: keep the in-memory copy.
  }
}

function findDuplicate(fileHash: string, sheetName: string): ImportRecord | null {
  const matches = loadState()
    .imports.filter(
      (record) =>
        record.status === 'committed' &&
        record.file_hash === fileHash &&
        record.sheet_name === sheetName,
    )
    .sort((a, b) => b.version - a.version);
  return matches[0] ?? null;
}

function toDuplicate(record: ImportRecord): DuplicateImport {
  return {
    id: record.id,
    version: record.version,
    file_name: record.file_name,
    sheet_name: record.sheet_name,
    uploaded_by: record.uploaded_by,
    uploaded_by_name: record.uploaded_by_name,
    committed_at: record.committed_at,
    row_count: record.row_count,
    error_row_count: record.error_row_count,
  };
}

function sanitizeMapping(raw: unknown, headers: string[]): ColumnMapping {
  if (!Array.isArray(raw)) return autoMapping(headers, DEFAULT_REQUIRED_COLUMNS);
  if (raw.length !== headers.length) {
    throw new ApiError('mapping_mismatch', 422, {
      guidance:
        'The column mapping no longer matches this header row. Re-run auto-map and validate again.',
    });
  }
  return raw.map((entry: any, index) => ({
    index,
    header: headers[index],
    field: (entry?.field == null || entry.field === '' ? null : entry.field) as CanonicalField | null,
  }));
}

type LocalAnalysis = {
  analysis: ImportAnalysis;
  sheetNames: string[];
  sheetName: string;
  headerRow: number;
  detectedHeaderRow: number;
  fileSize: number;
};

async function analyzeUpload(payload: PreviewRequest): Promise<LocalAnalysis> {
  const file = BUCKET_FILES.get(payload.storage_path);
  if (!file) {
    throw new ApiError('The workbook is no longer held in this browser session.', 422, {
      guidance: 'Choose the workbook again. Demo mode keeps uploaded files in memory only.',
    });
  }

  const bytes = await file.arrayBuffer();
  const XLSX = await import('xlsx');

  let workbook: any;
  try {
    workbook = XLSX.read(bytes, {
      type: 'array',
      cellDates: false,
      cellNF: false,
      cellText: true,
    });
  } catch {
    throw new ApiError('unsupported_file', 415, {
      guidance: 'The workbook could not be opened. Re-save it as .xlsx and try again.',
    });
  }

  const sheetNames = Object.keys(workbook?.Sheets ?? {});
  if (!sheetNames.length) {
    throw new ApiError('empty_workbook', 422, {
      guidance: 'The workbook has no worksheets. Nothing was written.',
    });
  }

  const sheetName = payload.sheet_name || sheetNames[0];
  if (!sheetNames.includes(sheetName)) {
    throw new ApiError('sheet_not_found', 422, {
      guidance: 'Select one of the worksheets in this workbook.',
    });
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = (XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: null,
    blankrows: true,
  }) ?? []) as unknown[][];

  const detectedHeaderRow = detectHeaderRow(matrix, DEFAULT_REQUIRED_COLUMNS);
  const headerRow = Number.isInteger(payload.header_row)
    ? Math.max(0, Number(payload.header_row))
    : detectedHeaderRow;

  if (headerRow < 0 || headerRow >= matrix.length) {
    throw new ApiError('header_not_found', 422, {
      guidance:
        'No header row could be detected. Choose the row that contains HH_ID, ENTRY_ID, FIRST_NAME, LAST_NAME, and GRANTEE.',
    });
  }

  const headers = headersFromRow(matrix[headerRow] ?? []);
  const mapping = sanitizeMapping(payload.column_mapping, headers);
  const analysis = analyzeRows({
    headers,
    rows: matrix.slice(headerRow + 1),
    mapping,
    requiredColumns: DEFAULT_REQUIRED_COLUMNS,
    maxRows: MAX_IMPORT_ROWS,
    firstDataRowNo: headerRow + 2,
  });

  return {
    analysis,
    sheetNames,
    sheetName,
    headerRow,
    detectedHeaderRow,
    fileSize: file.size,
  };
}

function flattenIssues(analysis: ImportAnalysis): PreviewIssue[] {
  return analysis.rows.flatMap((row) =>
    row.issues.map((issue) => ({
      source_row_no: row.source_row_no,
      field: issue.field ?? '',
      code: issue.code,
      message: issue.message,
      guidance: issue.guidance,
    })),
  );
}

export function demoUploadWorkbook(storagePath: string, file: File) {
  BUCKET_FILES.set(storagePath, file);
  return { path: storagePath };
}

export async function demoPreview(payload: PreviewRequest): Promise<ImportPreview> {
  const result = await analyzeUpload(payload);
  const { analysis } = result;
  const issues = flattenIssues(analysis);
  const duplicate = findDuplicate(payload.file_hash, result.sheetName);

  return {
    file_hash: payload.file_hash,
    file_size: result.fileSize,
    sheet_name: result.sheetName,
    sheet_names: result.sheetNames,
    header_row: result.headerRow,
    detected_header_row: result.detectedHeaderRow,
    headers: analysis.headers,
    mapping: analysis.mapping,
    required_columns: analysis.required_columns,
    warnings: analysis.warnings,
    structural_errors: analysis.structural_errors,
    summary: analysis.summary,
    rows: analysis.rows.slice(0, PREVIEW_ROW_LIMIT).map((row) => ({
      source_row_no: row.source_row_no,
      status: row.status,
      normalized: row.normalized,
      issues: row.issues,
    })),
    rows_truncated: analysis.rows.length > PREVIEW_ROW_LIMIT,
    issues: issues.slice(0, PREVIEW_ISSUE_LIMIT),
    issues_truncated: issues.length > PREVIEW_ISSUE_LIMIT,
    households: analysis.households.slice(0, PREVIEW_HOUSEHOLD_LIMIT),
    households_truncated: analysis.households.length > PREVIEW_HOUSEHOLD_LIMIT,
    duplicate: duplicate ? toDuplicate(duplicate) : null,
    ok: analysis.ok && !duplicate,
    can_commit: analysis.ok,
  };
}

export async function demoCommit(payload: CommitRequest): Promise<CommitResponse> {
  const result = await analyzeUpload(payload);
  const { analysis } = result;
  const duplicate = findDuplicate(payload.file_hash, result.sheetName);

  if (!analysis.ok) {
    throw new ApiError('validation_failed', 422, {
      guidance: 'Fix the structural issues before committing. No rows were written.',
      summary: analysis.summary,
      structural_errors: analysis.structural_errors,
    });
  }

  if (duplicate && payload.confirm_duplicate !== true) {
    throw new ApiError('duplicate_import', 409, {
      guidance:
        'This exact file and sheet was already committed. Confirm a re-import to store a new version, or cancel.',
      duplicate: toDuplicate(duplicate),
    });
  }

  const previousVersions = loadState()
    .imports.filter(
      (record) => record.file_hash === payload.file_hash && record.sheet_name === result.sheetName,
    )
    .map((record) => record.version);
  const version = previousVersions.length ? Math.max(...previousVersions) + 1 : 1;
  const now = new Date().toISOString();

  const record: ImportRecord = {
    id: `imp_demo_${Date.now().toString(36)}`,
    file_name: payload.file_name,
    file_hash: payload.file_hash,
    file_size: result.fileSize,
    sheet_name: result.sheetName,
    version,
    status: 'committed',
    uploaded_by: DEMO_USER_ID,
    uploaded_by_name: DEMO_DISPLAY_NAME,
    created_at: now,
    committed_at: now,
    row_count: analysis.summary.total_rows,
    valid_row_count: analysis.summary.valid_rows,
    error_row_count: analysis.summary.invalid_rows,
    household_count: analysis.summary.household_count,
    member_count: analysis.summary.member_count,
    is_duplicate: Boolean(duplicate),
    duplicate_of: duplicate?.id ?? null,
    header_row: result.headerRow,
  };

  const current = loadState();
  current.imports = [record, ...current.imports];
  current.issues[record.id] = flattenIssues(analysis);
  persist();

  return {
    import: record,
    summary: analysis.summary,
    report_available: record.error_row_count > 0,
  };
}

export function demoListImports(limit: number, offset: number): ImportListResponse {
  const all = [...loadState().imports].sort((a, b) =>
    a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0,
  );
  return {
    imports: all.slice(offset, offset + limit),
    total: all.length,
    limit,
    offset,
  };
}

export function demoErrorReportCsv(importId: string): string {
  const current = loadState();
  const record = current.imports.find((item) => item.id === importId);
  if (!record) throw new Error('The error report is no longer available.');
  const issues = current.issues[importId] ?? [];
  if (!issues.length) throw new Error('This import has no validation issues to report.');
  return issuesToCsv(issues);
}
