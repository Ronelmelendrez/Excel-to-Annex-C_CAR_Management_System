import { issuesToCsv } from "../_shared/import-domain.ts";

type StoredRowIssue = {
  source_row_no: number;
  field: string;
  code: string;
  message: string;
  guidance: string;
};

/** Flattens stored import_rows.errors into a PII-free CSV. */
export function buildErrorReportCsv(rows: Array<{ source_row_no: number; errors: unknown }>): string {
  const flat: StoredRowIssue[] = [];
  for (const row of rows) {
    const errors = Array.isArray(row.errors) ? row.errors : [];
    for (const entry of errors) {
      const issue = entry as Record<string, unknown>;
      flat.push({
        source_row_no: row.source_row_no,
        field: String(issue.field ?? ""),
        code: String(issue.code ?? "issue"),
        message: String(issue.message ?? ""),
        guidance: String(issue.guidance ?? ""),
      });
    }
  }
  flat.sort((a, b) => a.source_row_no - b.source_row_no);
  return issuesToCsv(flat);
}
