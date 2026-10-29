import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  analyzeRows,
  autoMapping,
  csvEscape,
  DEFAULT_REQUIRED_COLUMNS,
  detectHeaderRow,
  issuesToCsv,
  mappingIssues,
  normalizeGrantee,
  type ColumnMapping,
} from "@import-domain";

const { apiCallMock } = vi.hoisted(() => ({ apiCallMock: vi.fn() }));

vi.mock("../../../shared/supabase", () => ({
  isDemoMode: false,
  supabase: {
    auth: { getSession: vi.fn() },
    storage: { from: vi.fn() },
  },
}));

vi.mock("../../../shared/api", () => {
  class ApiError extends Error {
    status: number;
    code: string;
    payload: Record<string, any>;
    constructor(message: string, status: number, payload: Record<string, any> = {}) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.code = message;
      this.payload = payload;
    }
  }
  return {
    ApiError,
    apiBase: () => "/functions/v1",
    authHeaders: vi.fn(async () => ({})),
    apiCall: (...args: unknown[]) => apiCallMock(...args),
  };
});

import { commitImport, isDuplicateConflict, normalizeImportError, previewImport } from "../api";
import { ApiError } from "../../../shared/api";
import React from "react";
import { render, screen } from "@testing-library/react";
import { ImportHistory } from "../components/ImportHistory";
import type { ImportRecord } from "../types";

const HEADERS = ["HH_ID", "ENTRY_ID", "FIRST_NAME", "LAST_NAME", "GRANTEE", "LRN", "PCN"];

function baseMapping(headers: string[] = HEADERS): ColumnMapping {
  return autoMapping(headers);
}

function row(...values: string[]): string[] {
  return values;
}

describe("F3 header detection", () => {
  it("finds the real header below title and blank rows", () => {
    const matrix = [
      ["Barangay Household Profile"],
      [],
      ["REGION", "HH_ID", "ENTRY_ID", "FIRST_NAME", "LAST_NAME", "GRANTEE"],
      ["NCR", "0001", "000001", "Ana", "Cruz", "Yes"],
    ];
    expect(detectHeaderRow(matrix, DEFAULT_REQUIRED_COLUMNS)).toBe(2);
  });

  it("returns -1 when no row looks like a header", () => {
    expect(detectHeaderRow([["a", "b"], ["c", "d"]])).toBe(-1);
  });

  it("honours an explicit header row even when detection would differ", () => {
    const matrix = [
      ["REGION", "HH_ID", "ENTRY_ID", "FIRST_NAME", "LAST_NAME", "GRANTEE"],
      ["x"],
    ];
    expect(detectHeaderRow(matrix)).toBe(0);
  });
});

describe("F3 column mapping", () => {
  it("auto-maps common aliases and leaves unknown columns unmapped", () => {
    const headers = ["Household ID", "Entry ID", "Surname", "Given Name", "Grantee", "Notes"];
    const mapping = autoMapping(headers);
    expect(mapping.map((entry) => entry.field)).toEqual([
      "HH_ID",
      "ENTRY_ID",
      "LAST_NAME",
      "FIRST_NAME",
      "GRANTEE",
      null,
    ]);
  });

  it("does not map the same target twice", () => {
    const mapping = autoMapping(["HH_ID", "Household ID", "ENTRY_ID", "FIRST_NAME", "LAST_NAME", "GRANTEE"]);
    const hhMappings = mapping.filter((entry) => entry.field === "HH_ID");
    expect(hhMappings).toHaveLength(1);
  });

  it("reports duplicate targets and missing required columns", () => {
    const mapping: ColumnMapping = [
      { index: 0, header: "HH_ID", field: "HH_ID" },
      { index: 1, header: "Household ID", field: "HH_ID" },
      { index: 2, header: "ENTRY_ID", field: "ENTRY_ID" },
    ];
    const issues = mappingIssues(mapping, DEFAULT_REQUIRED_COLUMNS);
    expect(issues.some((issue) => issue.code === "duplicate_mapping")).toBe(true);
    expect(issues.some((issue) => issue.code === "missing_required_column" && issue.field === "FIRST_NAME")).toBe(
      true,
    );
  });
});

describe("F3 row analysis", () => {
  it("preserves leading zeros on identifiers", () => {
    const analysis = analyzeRows({
      headers: HEADERS,
      rows: [row("000123", "0000001", "Ana", "Cruz", "Yes", "001234567890", "PCN-0007")],
      mapping: baseMapping(),
    });

    expect(analysis.rows).toHaveLength(1);
    expect(analysis.rows[0].normalized.HH_ID).toBe("000123");
    expect(analysis.rows[0].normalized.ENTRY_ID).toBe("0000001");
    expect(analysis.rows[0].normalized.LRN).toBe("001234567890");
    expect(analysis.rows[0].normalized.PCN).toBe("PCN-0007");
    expect(analysis.rows[0].raw[0]).toBe("000123");
  });

  it("classifies every grantee state without picking a grantee", () => {
    const rows = [
      row("A", "A1", "Ana", "A", "Yes"),
      row("A", "A2", "Ben", "A", "No"),
      row("B", "B1", "Cara", "B", "No"),
      row("B", "B2", "Dan", "B", "No"),
      row("C", "C1", "Eve", "C", "Yes"),
      row("C", "C2", "Fay", "C", "Yes"),
      row("D", "D1", "Gia", "D", ""),
      row("D", "D2", "Hal", "D", "No"),
      row("E", "E1", "Ivy", "E", "Y"),
      row("E", "E2", "Jon", "E", "No"),
    ];

    const analysis = analyzeRows({ headers: HEADERS, rows, mapping: baseMapping() });
    const status = Object.fromEntries(
      analysis.households.map((household) => [household.hh_id, household.grantee_status]),
    );

    expect(status).toEqual({
      A: "valid",
      B: "none",
      C: "multiple",
      D: "blank",
      E: "invalid",
    });
    // Every source row is retained for traceability.
    expect(analysis.rows).toHaveLength(rows.length);
    expect(analysis.summary.household_count).toBe(5);
  });

  it("treats only exact Yes/No flags as recognized", () => {
    expect(normalizeGrantee("Yes")).toBe(true);
    expect(normalizeGrantee(" no ")).toBe(false);
    expect(normalizeGrantee("Y")).toBeNull();
    expect(normalizeGrantee("1")).toBeNull();
    expect(normalizeGrantee("")).toBeNull();
  });

  it("flags duplicate ENTRY_ID values but never removes either row", () => {
    const analysis = analyzeRows({
      headers: HEADERS,
      rows: [
        row("A", "X1", "Ana", "A", "Yes"),
        row("A", "X1", "Ben", "A", "No"),
      ],
      mapping: baseMapping(),
    });

    expect(analysis.rows).toHaveLength(2);
    for (const analyzed of analysis.rows) {
      expect(analyzed.issues.some((issue) => issue.code === "duplicate_entry_id")).toBe(true);
      expect(analyzed.status).toBe("invalid");
    }
    expect(analysis.households[0].review_status).toBe("needs_review");
  });

  it("keeps blank HH_ID rows out of households and flags them", () => {
    const analysis = analyzeRows({
      headers: HEADERS,
      rows: [row("", "E1", "Ana", "A", "Yes")],
      mapping: baseMapping(),
    });
    expect(analysis.summary.rows_without_household).toBe(1);
    expect(analysis.households).toHaveLength(0);
    expect(analysis.rows[0].issues.some((issue) => issue.code === "blank_hh_id")).toBe(true);
  });

  it("numbers rows from the real sheet position when a header sits lower down", () => {
    const analysis = analyzeRows({
      headers: HEADERS,
      rows: [row("A", "A1", "", "Cruz", "Yes")],
      mapping: baseMapping(),
      firstDataRowNo: 7,
    });
    expect(analysis.rows[0].source_row_no).toBe(7);
    const issue = analysis.rows[0].issues.find((item) => item.code === "missing_required");
    expect(issue?.guidance).toContain("source row 7");
  });

  it("blocks an empty sheet as a structural error", () => {
    const analysis = analyzeRows({ headers: HEADERS, rows: [], mapping: baseMapping() });
    expect(analysis.ok).toBe(false);
    expect(analysis.structural_errors.some((issue) => issue.code === "empty_worksheet")).toBe(true);
  });
});

describe("F3 error report CSV", () => {
  it("escapes quotes, commas, and neutralizes formula prefixes", () => {
    expect(csvEscape("plain")).toBe("plain");
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape('He said "no"')).toBe('"He said ""no"""');
    expect(csvEscape("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvEscape("+1")).toBe("'+1");
  });

  it("contains row numbers, codes, and guidance but no raw personal values", () => {
    const analysis = analyzeRows({
      headers: HEADERS,
      rows: [row("A", "A1", "Ana", "Cruz", "Maybe")],
      mapping: baseMapping(),
    });
    const csv = issuesToCsv(
      analysis.rows.flatMap((analyzed) =>
        analyzed.issues.map((issue) => ({
          source_row_no: analyzed.source_row_no,
          field: issue.field,
          code: issue.code,
          message: issue.message,
          guidance: issue.guidance,
        })),
      ),
    );

    expect(csv.split("\r\n")[0]).toBe("Row,Field,Issue,Guidance");
    expect(csv).toContain("invalid_grantee");
    expect(csv).toContain("2");
    expect(csv).not.toContain("Ana");
    expect(csv).not.toContain("Cruz");
  });
});

describe("F3 import API", () => {
  beforeEach(() => {
    apiCallMock.mockReset();
  });

  it("preview posts the explicit mapping to the imports function", async () => {
    apiCallMock.mockResolvedValue({ ok: true, can_commit: true, duplicate: null });
    const payload = {
      storage_path: "user/hash/book.xlsx",
      sheet_name: "Sheet1",
      header_row: 0,
      column_mapping: baseMapping(),
      file_hash: "abc",
      file_name: "book.xlsx",
    };

    const result = await previewImport(payload);

    expect(result).toMatchObject({ ok: true, can_commit: true });
    const [path, options] = apiCallMock.mock.calls[0];
    expect(path).toBe("/imports");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toMatchObject({ action: "preview", ...payload });
  });

  it("commit is blocked by a duplicate conflict until explicitly confirmed", async () => {
    apiCallMock
      .mockRejectedValueOnce(
        new ApiError("duplicate_import", 409, {
          duplicate: { id: "imp-1", version: 2 },
          guidance: "Already committed.",
        }),
      )
      .mockResolvedValueOnce({ import: { id: "imp-2", version: 3 }, summary: {}, report_available: false });

    const payload = {
      storage_path: "user/hash/book.xlsx",
      sheet_name: "Sheet1",
      header_row: 0,
      column_mapping: baseMapping(),
      file_hash: "abc",
      file_name: "book.xlsx",
      confirm_duplicate: false,
    };

    const error = await commitImport(payload).catch((cause) => cause);
    expect(isDuplicateConflict(error)).toBe(true);
    expect((error as InstanceType<typeof ApiError>).payload.duplicate.id).toBe("imp-1");

    const committed = await commitImport({ ...payload, confirm_duplicate: true });
    expect(committed.import.version).toBe(3);
    const body = JSON.parse(apiCallMock.mock.calls[1][1].body);
    expect(body.action).toBe("commit");
    expect(body.confirm_duplicate).toBe(true);
  });

  it("surfaces server guidance instead of a generic error", () => {
    const error = normalizeImportError(
      new ApiError("validation_failed", 422, {
        guidance: "Required column HH_ID is not mapped.",
        structural_errors: [{ code: "missing_required_column" }],
      }),
      "Validation could not run",
    );
    expect(error.message).toBe("Required column HH_ID is not mapped.");
    expect(error.code).toBe("validation_failed");
    expect(error.status).toBe(422);
  });
});

const baseHistoryProps = {
  total: 0,
  loading: false,
  loadingMore: false,
  error: null,
  hasMore: false,
  onRefresh: vi.fn(),
  onLoadMore: vi.fn(),
};

function importRecord(overrides: Partial<ImportRecord> = {}): ImportRecord {
  return {
    id: "imp-1",
    file_name: "households.xlsx",
    file_hash: "abcdef0123456789",
    file_size: 2048,
    sheet_name: "Sheet1",
    version: 1,
    status: "committed",
    uploaded_by: "u1",
    uploaded_by_name: "B. Worker",
    created_at: "2026-10-28T08:00:00.000Z",
    committed_at: "2026-10-28T08:05:00.000Z",
    row_count: 12,
    valid_row_count: 10,
    error_row_count: 2,
    household_count: 3,
    member_count: 12,
    is_duplicate: false,
    duplicate_of: null,
    header_row: 0,
    ...overrides,
  };
}

describe("F3 import history states", () => {
  it("shows the first-use empty state before anything is committed", () => {
    render(React.createElement(ImportHistory, { ...baseHistoryProps, items: [] }));
    expect(screen.getByText(/No workbook has been committed yet/i)).toBeTruthy();
  });

  it("renders the history error state without dropping prior rows", () => {
    render(
      React.createElement(ImportHistory, {
        ...baseHistoryProps,
        items: [importRecord()],
        total: 1,
        error: "Import history could not be loaded.",
      }),
    );
    expect(screen.getByText("Import history is unavailable")).toBeTruthy();
    expect(screen.getByText("households.xlsx")).toBeTruthy();
  });

  it("offers the error report only when a version has review rows", () => {
    render(
      React.createElement(ImportHistory, {
        ...baseHistoryProps,
        items: [importRecord({ id: "with-errors" }), importRecord({ id: "clean", error_row_count: 0, is_duplicate: true })],
        total: 2,
      }),
    );
    expect(screen.getAllByText("Download")).toHaveLength(1);
    expect(screen.getByText("None")).toBeTruthy();
    expect(screen.getByText("Re-import")).toBeTruthy();
  });
});
