/**
 * F3 Excel Import — pure domain rules.
 *
 * No Deno, browser, or database APIs live here so the same code runs in the
 * Edge Function and in the browser preview. The server remains the source of
 * truth: it re-runs every one of these rules against the uploaded bytes before
 * persisting anything.
 */

export const CANONICAL_FIELDS = [
  "REGION",
  "PROVINCE",
  "MUNICIPALITY",
  "BARANGAY",
  "HH_ID",
  "ENTRY_ID",
  "FIRST_NAME",
  "MIDDLE_NAME",
  "LAST_NAME",
  "EXT_NAME",
  "BIRTHDAY",
  "AGE",
  "AGE_ON_EDUC",
  "SEX",
  "CLIENT_STATUS",
  "CS_CATEGORY",
  "MEMBER_STATUS",
  "RELATION_TO_HH_HEAD",
  "CIVIL_STATUS",
  "GRANTEE",
  "HH_SET",
  "SOLO_PARENT",
  "IP_AFFLIATION",
  "PCN",
  "PCN_REMARKS",
  "PREGNANCY_STATUS",
  "LMP",
  "HEALTH_MONITORED",
  "HEALTH_FACILITY",
  "HEALTH_FACILITY_STATUS",
  "REASON_FOR_NOT_ATTENDING_HEALTH",
  "REASON_HEALTH_REMARKS",
  "DISABILITY_TYPES",
  "CHILD_BENE",
  "GRADE_LEVEL",
  "SHS_STRAND",
  "SHS_TRACK",
  "EDUC_MONITORED",
  "ATTEND_SCHOOL",
  "SCHOOL_NAME",
  "REASON_FOR_NOT_ATTENDING_SCHOOL",
  "REASON_EDUC_REMARKS",
  "LRN",
  "LRN_REMARKS",
] as const;

export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

export const DEFAULT_REQUIRED_COLUMNS: CanonicalField[] = [
  "HH_ID",
  "ENTRY_ID",
  "FIRST_NAME",
  "LAST_NAME",
  "GRANTEE",
];

export const IDENTIFIER_FIELDS: CanonicalField[] = ["HH_ID", "ENTRY_ID", "LRN", "PCN"];

export const MAX_IMPORT_BYTES = 25 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 20_000;
export const PREVIEW_ROW_LIMIT = 100;
export const PREVIEW_ISSUE_LIMIT = 200;
export const PREVIEW_HOUSEHOLD_LIMIT = 50;

export const FIELD_LABELS: Record<CanonicalField, string> = {
  REGION: "Region",
  PROVINCE: "Province",
  MUNICIPALITY: "Municipality",
  BARANGAY: "Barangay",
  HH_ID: "Household ID",
  ENTRY_ID: "Entry ID",
  FIRST_NAME: "First name",
  MIDDLE_NAME: "Middle name",
  LAST_NAME: "Last name",
  EXT_NAME: "Name extension",
  BIRTHDAY: "Birthday",
  AGE: "Age",
  AGE_ON_EDUC: "Age on education",
  SEX: "Sex",
  CLIENT_STATUS: "Client status",
  CS_CATEGORY: "CS category",
  MEMBER_STATUS: "Member status",
  RELATION_TO_HH_HEAD: "Relation to household head",
  CIVIL_STATUS: "Civil status",
  GRANTEE: "Grantee flag",
  HH_SET: "Household set",
  SOLO_PARENT: "Solo parent",
  IP_AFFLIATION: "IP affiliation",
  PCN: "PCN",
  PCN_REMARKS: "PCN remarks",
  PREGNANCY_STATUS: "Pregnancy status",
  LMP: "LMP",
  HEALTH_MONITORED: "Health monitored",
  HEALTH_FACILITY: "Health facility",
  HEALTH_FACILITY_STATUS: "Health facility status",
  REASON_FOR_NOT_ATTENDING_HEALTH: "Reason for not attending health",
  REASON_HEALTH_REMARKS: "Health remarks",
  DISABILITY_TYPES: "Disability types",
  CHILD_BENE: "Child beneficiary",
  GRADE_LEVEL: "Grade level",
  SHS_STRAND: "SHS strand",
  SHS_TRACK: "SHS track",
  EDUC_MONITORED: "Education monitored",
  ATTEND_SCHOOL: "Attends school",
  SCHOOL_NAME: "School name",
  REASON_FOR_NOT_ATTENDING_SCHOOL: "Reason for not attending school",
  REASON_EDUC_REMARKS: "Education remarks",
  LRN: "LRN",
  LRN_REMARKS: "LRN remarks",
};

const CANONICAL_SET = new Set<string>(CANONICAL_FIELDS);

/** Header aliases are normalized before comparison. */
export const HEADER_ALIASES: Record<string, CanonicalField> = {
  HOUSEHOLD_ID: "HH_ID",
  HOUSEHOLDID: "HH_ID",
  HH: "HH_ID",
  ENTRYID: "ENTRY_ID",
  ENTRY: "ENTRY_ID",
  FIRSTNAME: "FIRST_NAME",
  GIVEN_NAME: "FIRST_NAME",
  MIDDLENAME: "MIDDLE_NAME",
  LASTNAME: "LAST_NAME",
  SURNAME: "LAST_NAME",
  FAMILY_NAME: "LAST_NAME",
  EXTENSION_NAME: "EXT_NAME",
  NAME_EXTENSION: "EXT_NAME",
  BIRTHDATE: "BIRTHDAY",
  DOB: "BIRTHDAY",
  DATE_OF_BIRTH: "BIRTHDAY",
  GENDER: "SEX",
  RELATIONSHIP_TO_HH_HEAD: "RELATION_TO_HH_HEAD",
  RELATION_TO_HEAD: "RELATION_TO_HH_HEAD",
  RELATIONSHIP_TO_HEAD: "RELATION_TO_HH_HEAD",
  GRANTEE_FLAG: "GRANTEE",
  IS_GRANTEE: "GRANTEE",
  IP_AFFILIATION: "IP_AFFLIATION",
  IP_AFFILIATION_GROUP: "IP_AFFLIATION",
  INDIGENOUS_PEOPLE: "IP_AFFLIATION",
  LEARNER_REFERENCE_NUMBER: "LRN",
  PHILHEALTH_NUMBER: "PCN",
  SOLOPARENT: "SOLO_PARENT",
  CHILDBENE: "CHILD_BENE",
  GRADELEVEL: "GRADE_LEVEL",
  SHSSTRAND: "SHS_STRAND",
  SHSTRACK: "SHS_TRACK",
  ATTENDS_SCHOOL: "ATTEND_SCHOOL",
  SCHOOL: "SCHOOL_NAME",
};

export type ColumnMappingEntry = {
  index: number;
  header: string;
  field: CanonicalField | null;
};

export type ColumnMapping = ColumnMappingEntry[];

export type IssueCode =
  | "missing_required"
  | "invalid_grantee"
  | "blank_grantee"
  | "duplicate_entry_id"
  | "blank_hh_id"
  | "missing_header"
  | "duplicate_header"
  | "duplicate_mapping"
  | "missing_required_column"
  | "unknown_target_field"
  | "empty_worksheet"
  | "row_limit"
  | "header_not_found"
  | "unexpected_column";

export type ImportIssue = {
  code: IssueCode | string;
  message: string;
  guidance: string;
  field?: string;
};

export type RowIssue = ImportIssue & {
  field: string;
};

export type AnalyzedRow = {
  source_row_no: number;
  raw: Array<string | null>;
  normalized: Partial<Record<CanonicalField, string | null>>;
  grantee: boolean | null;
  hh_id: string | null;
  entry_id: string | null;
  issues: RowIssue[];
  status: "valid" | "invalid";
};

export type HouseholdGranteeStatus = "valid" | "none" | "multiple" | "invalid" | "blank";

export type HouseholdAnalysis = {
  hh_id: string;
  grantee_status: HouseholdGranteeStatus;
  review_status: "ok" | "needs_review";
  member_count: number;
  member_row_numbers: number[];
};

export type ImportSummaryCounts = {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  skipped_blank_rows: number;
  household_count: number;
  member_count: number;
  rows_without_household: number;
  issues_by_code: Record<string, number>;
};

export type ImportAnalysis = {
  headers: string[];
  mapping: ColumnMapping;
  required_columns: CanonicalField[];
  unmapped_headers: string[];
  missing_required_columns: CanonicalField[];
  duplicate_headers: string[];
  warnings: string[];
  structural_errors: ImportIssue[];
  rows: AnalyzedRow[];
  households: HouseholdAnalysis[];
  summary: ImportSummaryCounts;
  ok: boolean;
};

export function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function canonicalForHeader(header: unknown): CanonicalField | null {
  const key = normalizeHeader(header);
  if (!key) return null;
  if (CANONICAL_SET.has(key)) return key as CanonicalField;
  return HEADER_ALIASES[key] ?? null;
}

export function headerLabel(index: number, value: unknown): string {
  const text = String(value ?? "").trim();
  return text || `Column ${index + 1}`;
}

export function headersFromRow(row: unknown[]): string[] {
  return (row ?? []).map((value, index) => headerLabel(index, value));
}

function rowIsBlank(row: unknown[]): boolean {
  return row.every((value) => value === null || value === undefined || String(value).trim() === "");
}

/**
 * Score the first rows of a sheet and return the best header candidate.
 * Returns -1 when no row contains at least two known source headers.
 */
export function detectHeaderRow(
  matrix: unknown[][],
  requiredColumns: CanonicalField[] = DEFAULT_REQUIRED_COLUMNS,
): number {
  const scanLimit = Math.min(matrix.length, 25);
  let bestIndex = -1;
  let bestScore = 0;

  for (let i = 0; i < scanLimit; i += 1) {
    const row = matrix[i] ?? [];
    const found = new Set<string>();
    for (const value of row) {
      const field = canonicalForHeader(value);
      if (field) found.add(field);
    }
    const requiredScore = requiredColumns.filter((field) => found.has(field)).length;
    const score = requiredScore * 10 + found.size;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  if (bestScore < 20) return -1;
  return bestIndex;
}

export function autoMapping(
  headers: string[],
  requiredColumns: CanonicalField[] = DEFAULT_REQUIRED_COLUMNS,
): ColumnMapping {
  const used = new Set<CanonicalField>();
  const mapping: ColumnMapping = headers.map((header, index) => {
    const field = canonicalForHeader(header);
    if (field && !used.has(field)) {
      used.add(field);
      return { index, header, field };
    }
    return { index, header, field: null };
  });

  // Required fields that only exist under an unrecognized header stay
  // unmapped on purpose — the operator must make an explicit choice.
  void requiredColumns;
  return mapping;
}

export function mappingIssues(
  mapping: ColumnMapping,
  requiredColumns: CanonicalField[] = DEFAULT_REQUIRED_COLUMNS,
): ImportIssue[] {
  const issues: ImportIssue[] = [];
  const seen = new Map<string, ColumnMappingEntry[]>();

  for (const entry of mapping) {
    if (!entry.field) continue;
    if (!CANONICAL_SET.has(entry.field)) {
      issues.push({
        code: "unknown_target_field",
        field: entry.field,
        message: `Unknown target field "${entry.field}".`,
        guidance: "Pick a field from the recognized Annex C source list.",
      });
      continue;
    }
    const current = seen.get(entry.field) ?? [];
    current.push(entry);
    seen.set(entry.field, current);
  }

  for (const [field, entries] of seen) {
    if (entries.length > 1) {
      issues.push({
        code: "duplicate_mapping",
        field,
        message: `${entries.length} source columns map to ${FIELD_LABELS[field as CanonicalField] ?? field}.`,
        guidance: "Each target field can receive exactly one source column. Map the others to Ignore.",
      });
    }
  }

  const mappedFields = new Set(mapping.map((entry) => entry.field).filter(Boolean));
  for (const field of requiredColumns) {
    if (!mappedFields.has(field)) {
      issues.push({
        code: "missing_required_column",
        field,
        message: `Required column ${field} is not mapped.`,
        guidance: `Map one source column to ${FIELD_LABELS[field] ?? field} before validating.`,
      });
    }
  }

  return issues;
}

export function normalizeGrantee(value: unknown): boolean | null {
  const text = String(value ?? "").trim().toLowerCase();
  if (text === "yes") return true;
  if (text === "no") return false;
  return null;
}

function cellText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value);
  return text === "" ? null : text;
}

function trimmed(value: unknown): string | null {
  const text = cellText(value);
  if (text === null) return null;
  const t = text.trim();
  return t === "" ? null : t;
}

function dedupeHeaders(headers: string[]): string[] {
  return headers.filter((header, index) => headers.indexOf(header) !== index);
}

export type AnalyzeRowsInput = {
  headers: string[];
  rows: unknown[][];
  mapping: ColumnMapping;
  requiredColumns?: CanonicalField[];
  maxRows?: number;
  /** 1-based worksheet row number of the first data row (header row + 1). */
  firstDataRowNo?: number;
};

/**
 * Validate a data matrix and group rows by trimmed HH_ID. Never auto-selects a
 * grantee. Rows are retained even when invalid so every source row stays
 * traceable.
 */
export function analyzeRows(input: AnalyzeRowsInput): ImportAnalysis {
  const requiredColumns = input.requiredColumns ?? DEFAULT_REQUIRED_COLUMNS;
  const maxRows = input.maxRows ?? MAX_IMPORT_ROWS;
  const headers = input.headers;
  const mapping = input.mapping;
  const structuralErrors: ImportIssue[] = [];
  const warnings: string[] = [];

  const duplicateHeaders = dedupeHeaders(headers);
  if (duplicateHeaders.length) {
    warnings.push(
      `Duplicate header${duplicateHeaders.length === 1 ? "" : "s"}: ${[...new Set(duplicateHeaders)].join(", ")}. Mapping is by column position, so both columns can still be reviewed.`,
    );
  }

  structuralErrors.push(...mappingIssues(mapping, requiredColumns));

  const mappedFields = new Set(mapping.map((entry) => entry.field).filter(Boolean) as CanonicalField[]);
  const unmappedHeaders = headers.filter((header, index) => {
    const entry = mapping.find((item) => item.index === index);
    return !entry?.field && !canonicalForHeader(header);
  });
  if (unmappedHeaders.length) {
    warnings.push(`${unmappedHeaders.length} column(s) are not mapped and will be preserved but not normalized.`);
  }

  if (input.rows.length === 0) {
    structuralErrors.push({
      code: "empty_worksheet",
      message: "The selected sheet has no data rows below the header.",
      guidance: "Pick another sheet or adjust the header row, then run validation again.",
    });
  }

  if (input.rows.length > maxRows) {
    structuralErrors.push({
      code: "row_limit",
      message: `This sheet has ${input.rows.length.toLocaleString()} data rows; the limit is ${maxRows.toLocaleString()}.`,
      guidance: "Split the workbook into smaller files. No rows were written.",
    });
  }

  const rows: AnalyzedRow[] = [];
  let skippedBlankRows = 0;
  const firstDataRowNumber = Number.isInteger(input.firstDataRowNo) && input.firstDataRowNo! > 0
    ? Number(input.firstDataRowNo)
    : 2;

  for (let index = 0; index < input.rows.length; index += 1) {
    const rawRow = input.rows[index] ?? [];
    const sourceRowNo = firstDataRowNumber + index;
    if (rowIsBlank(rawRow)) {
      skippedBlankRows += 1;
      continue;
    }

    const raw = headers.map((_, columnIndex) => cellText(rawRow[columnIndex]));
    const normalized: Partial<Record<CanonicalField, string | null>> = {};
    const issues: RowIssue[] = [];

    for (const entry of mapping) {
      if (!entry.field) continue;
      normalized[entry.field] = trimmed(rawRow[entry.index]);
    }

    for (const field of requiredColumns) {
      if (field === "GRANTEE") continue;
      if (!normalized[field]) {
        issues.push({
          code: "missing_required",
          field,
          message: `${field} is blank.`,
          guidance: `Fill ${FIELD_LABELS[field] ?? field} on source row ${sourceRowNo}. The row is kept and flagged for review.`,
        });
      }
    }

    const rawGrantee = trimmed(rawRow[mapping.find((entry) => entry.field === "GRANTEE")?.index ?? -1]);
    const grantee = normalizeGrantee(rawGrantee);
    if (rawGrantee === null) {
      issues.push({
        code: "blank_grantee",
        field: "GRANTEE",
        message: "GRANTEE is blank.",
        guidance: "Use exactly Yes or No. Blank flags send the household to the review queue.",
      });
    } else if (grantee === null) {
      issues.push({
        code: "invalid_grantee",
        field: "GRANTEE",
        message: `GRANTEE "${rawGrantee}" is not Yes or No.`,
        guidance: "Use exactly Yes or No. Abbreviations such as Y, N, 1, or True are not accepted.",
      });
    }

    const hhId = normalized.HH_ID ?? null;
    if (!hhId) {
      issues.push({
        code: "blank_hh_id",
        field: "HH_ID",
        message: "HH_ID is blank.",
        guidance: "Rows without an HH_ID are kept for review and are never guessed into a household.",
      });
    }

    rows.push({
      source_row_no: sourceRowNo,
      raw,
      normalized,
      grantee,
      hh_id: hhId,
      entry_id: normalized.ENTRY_ID ?? null,
      issues,
      status: issues.length ? "invalid" : "valid",
    });
  }

  // Duplicate ENTRY_ID values are flagged, never removed or merged.
  const entryCounts = new Map<string, number>();
  for (const row of rows) {
    if (row.entry_id) entryCounts.set(row.entry_id, (entryCounts.get(row.entry_id) ?? 0) + 1);
  }
  for (const row of rows) {
    if (row.entry_id && (entryCounts.get(row.entry_id) ?? 0) > 1) {
      row.issues.push({
        code: "duplicate_entry_id",
        field: "ENTRY_ID",
        message: `ENTRY_ID ${row.entry_id} appears ${entryCounts.get(row.entry_id)} times in this sheet.`,
        guidance: "Keep both rows, then resolve the duplicate during household review.",
      });
      row.status = "invalid";
    }
  }

  const byHousehold = new Map<string, AnalyzedRow[]>();
  for (const row of rows) {
    if (!row.hh_id) continue;
    const group = byHousehold.get(row.hh_id) ?? [];
    group.push(row);
    byHousehold.set(row.hh_id, group);
  }

  const households: HouseholdAnalysis[] = [];
  for (const [hhId, members] of byHousehold) {
    let yes = 0;
    let no = 0;
    let blank = 0;
    let invalid = 0;
    for (const member of members) {
      const granteeIndex = mapping.find((entry) => entry.field === "GRANTEE")?.index ?? -1;
      const rawFlag = trimmed(member.raw[granteeIndex]);
      if (rawFlag === null) blank += 1;
      else if (member.grantee === true) yes += 1;
      else if (member.grantee === false) no += 1;
      else invalid += 1;
    }

    let granteeStatus: HouseholdGranteeStatus;
    if (yes > 1) granteeStatus = "multiple";
    else if (yes === 1 && invalid === 0 && blank === 0) granteeStatus = "valid";
    else if (yes === 1 && invalid > 0) granteeStatus = "invalid";
    else if (yes === 1 && blank > 0) granteeStatus = "blank";
    else if (yes === 0 && invalid > 0) granteeStatus = "invalid";
    else if (yes === 0 && blank > 0) granteeStatus = "blank";
    else granteeStatus = "none";

    const hasBlockingRowIssue = members.some((member) =>
      member.issues.some((issue) =>
        ["missing_required", "duplicate_entry_id", "blank_grantee", "invalid_grantee"].includes(issue.code),
      ),
    );

    households.push({
      hh_id: hhId,
      grantee_status: granteeStatus,
      review_status: granteeStatus === "valid" && !hasBlockingRowIssue ? "ok" : "needs_review",
      member_count: members.length,
      member_row_numbers: members.map((member) => member.source_row_no),
    });
    void no;
  }

  const issuesByCode: Record<string, number> = {};
  for (const row of rows) {
    for (const issue of row.issues) {
      issuesByCode[issue.code] = (issuesByCode[issue.code] ?? 0) + 1;
    }
  }

  const summary: ImportSummaryCounts = {
    total_rows: rows.length,
    valid_rows: rows.filter((row) => row.status === "valid").length,
    invalid_rows: rows.filter((row) => row.status === "invalid").length,
    skipped_blank_rows: skippedBlankRows,
    household_count: households.length,
    member_count: households.reduce((sum, household) => sum + household.member_count, 0),
    rows_without_household: rows.filter((row) => !row.hh_id).length,
    issues_by_code: issuesByCode,
  };

  return {
    headers,
    mapping,
    required_columns: requiredColumns,
    unmapped_headers: unmappedHeaders,
    missing_required_columns: requiredColumns.filter((field) => !mappedFields.has(field)),
    duplicate_headers: [...new Set(duplicateHeaders)],
    warnings,
    structural_errors: structuralErrors,
    rows,
    households,
    summary,
    ok: structuralErrors.length === 0 && rows.length > 0,
  };
}

export function csvEscape(value: unknown): string {
  let text = String(value ?? "");
  // Neutralize spreadsheet formula injection before quoting.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Error report contains row numbers and guidance only — never raw PII values. */
export function issuesToCsv(
  issues: Array<{ source_row_no: number; field: string; code: string; message: string; guidance: string }>,
): string {
  const lines = ["Row,Field,Issue,Guidance"];
  for (const issue of issues) {
    lines.push(
      [
        issue.source_row_no,
        csvEscape(issue.field),
        csvEscape(issue.code),
        csvEscape(issue.guidance || issue.message),
      ].join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}
