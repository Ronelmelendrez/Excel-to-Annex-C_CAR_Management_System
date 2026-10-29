import { verifyJwt } from "../_shared/auth.ts";
import { enforceAdminOnly } from "../_shared/access.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { hasActiveRole } from "../_shared/rbac.ts";
import { auditLog } from "../_shared/audit.ts";
import { error, handleError, HttpError, json, preflight, text } from "../_shared/http.ts";
import {
  CANONICAL_FIELDS,
  DEFAULT_REQUIRED_COLUMNS,
  PREVIEW_HOUSEHOLD_LIMIT,
  PREVIEW_ISSUE_LIMIT,
  PREVIEW_ROW_LIMIT,
  type CanonicalField,
  type ColumnMapping,
  type ImportAnalysis,
} from "../_shared/import-domain.ts";
import { analyzeWorkbook, sha256Hex, type WorkbookAnalysisResult } from "./workbook.ts";
import { buildErrorReportCsv } from "./report.ts";

const IMPORT_ROLES = ["admin", "operator"];
const BUCKET = "imports";
const MAX_LIST_LIMIT = 50;

type ImportRowRecord = Record<string, any>;

function nowIso() {
  return new Date().toISOString();
}

async function requireImporter(userId: string) {
  await enforceAdminOnly(userId);
  if (!(await hasActiveRole(userId, IMPORT_ROLES))) {
    throw new HttpError(403, "forbidden", {
      guidance: "Excel imports are restricted to operators and administrators.",
    });
  }
}

async function loadRequiredColumns(supabase: any): Promise<CanonicalField[]> {
  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "import_required_columns")
    .maybeSingle();
  const value = data?.value;
  if (!Array.isArray(value) || !value.length) return DEFAULT_REQUIRED_COLUMNS;
  const allowed = new Set<string>(CANONICAL_FIELDS);
  const filtered = value.map((field) => String(field)).filter((field) => allowed.has(field)) as CanonicalField[];
  return filtered.length ? filtered : DEFAULT_REQUIRED_COLUMNS;
}

function safeStoragePath(path: unknown, userId: string): string {
  const value = String(path ?? "");
  if (!value || value.length > 512 || value.includes("..") || !/^[A-Za-z0-9._/-]+$/.test(value)) {
    throw new HttpError(422, "invalid_storage_path", {
      guidance: "The upload reference is invalid. Select the workbook again.",
    });
  }
  if (!value.startsWith(`${userId}/`)) {
    throw new HttpError(403, "forbidden", {
      guidance: "Workbooks can only be read from your own upload folder.",
    });
  }
  if (!/\.(xlsx|xls)$/i.test(value)) {
    throw new HttpError(415, "unsupported_file", {
      guidance: "Only .xlsx and .xls workbooks are accepted.",
    });
  }
  return value;
}

async function downloadWorkbook(supabase: any, storagePath: string) {
  const { data, error: downloadError } = await supabase.storage.from(BUCKET).download(storagePath);
  if (downloadError || !data) {
    throw new HttpError(404, "upload_not_found", {
      guidance: "The uploaded workbook could not be found. Upload it again.",
    });
  }
  const bytes = await data.arrayBuffer();
  return { bytes, size: bytes.byteLength };
}

async function profileName(supabase: any, userId: string | null | undefined) {
  if (!userId) return null;
  const { data } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
  return data?.display_name ?? null;
}

async function findDuplicate(supabase: any, fileHash: string, sheetName: string) {
  const { data } = await supabase
    .from("imports")
    .select("id, version, file_name, sheet_name, uploaded_by, committed_at, row_count, error_row_count, status")
    .eq("file_hash", fileHash)
    .eq("sheet_name", sheetName)
    .eq("status", "committed")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const uploader = await profileName(supabase, data.uploaded_by);
  return {
    id: data.id,
    version: data.version,
    file_name: data.file_name,
    sheet_name: data.sheet_name,
    uploaded_by: data.uploaded_by,
    uploaded_by_name: uploader,
    committed_at: data.committed_at,
    row_count: data.row_count,
    error_row_count: data.error_row_count,
  };
}

function flattenIssues(analysis: ImportAnalysis) {
  return analysis.rows.flatMap((row) =>
    row.issues.map((issue) => ({
      source_row_no: row.source_row_no,
      field: issue.field,
      code: issue.code,
      message: issue.message,
      guidance: issue.guidance,
    })),
  );
}

function publicPreview(
  result: WorkbookAnalysisResult,
  duplicate: Awaited<ReturnType<typeof findDuplicate>>,
  fileHash: string,
  fileSize: number,
) {
  const { analysis } = result;
  const issues = flattenIssues(analysis);
  return {
    file_hash: fileHash,
    file_size: fileSize,
    sheet_name: result.sheet_name,
    sheet_names: result.sheet_names,
    header_row: result.header_row,
    detected_header_row: result.detected_header_row,
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
    duplicate,
    ok: analysis.ok && !duplicate,
    can_commit: analysis.ok,
  };
}

function importRecord(row: ImportRowRecord, uploaderName: string | null = null) {
  return {
    id: row.id,
    file_name: row.file_name,
    file_hash: row.file_hash,
    file_size: row.file_size,
    sheet_name: row.sheet_name,
    version: row.version,
    status: row.status,
    uploaded_by: row.uploaded_by,
    uploaded_by_name: uploaderName,
    created_at: row.created_at,
    committed_at: row.committed_at,
    row_count: row.row_count,
    valid_row_count: row.valid_row_count,
    error_row_count: row.error_row_count,
    household_count: row.household_count,
    member_count: row.member_count,
    is_duplicate: row.is_duplicate,
    duplicate_of: row.duplicate_of,
    header_row: row.header_row,
  };
}

async function prepareAnalysis(supabase: any, user: any, body: any) {
  const storagePath = safeStoragePath(body.storage_path, user.id);
  const requiredColumns = await loadRequiredColumns(supabase);
  const { bytes, size } = await downloadWorkbook(supabase, storagePath);
  const actualHash = await sha256Hex(bytes);
  if (body.file_hash && String(body.file_hash).toLowerCase() !== actualHash) {
    throw new HttpError(422, "fingerprint_mismatch", {
      guidance: "The uploaded file does not match the fingerprint computed in the browser. Upload it again.",
    });
  }
  const result = analyzeWorkbook({
    bytes,
    sheet_name: String(body.sheet_name ?? ""),
    header_row: body.header_row == null ? null : Number(body.header_row),
    mapping: body.column_mapping,
    required_columns: requiredColumns,
  });
  return { storagePath, actualHash, size, result };
}

async function previewImport(supabase: any, user: any, body: any) {
  const { actualHash, size, result } = await prepareAnalysis(supabase, user, body);
  const duplicate = await findDuplicate(supabase, actualHash, result.sheet_name);
  return json(publicPreview(result, duplicate, actualHash, size));
}

async function insertChunked(supabase: any, table: string, rows: any[], select = "") {
  const chunkSize = 500;
  const inserted: any[] = [];
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    let query = supabase.from(table).insert(chunk);
    if (select) query = query.select(select);
    const { data, error: insertError } = await query;
    if (insertError) throw insertError;
    if (data) inserted.push(...data);
  }
  return inserted;
}

async function commitImport(supabase: any, user: any, body: any) {
  const { storagePath, actualHash, size, result } = await prepareAnalysis(supabase, user, body);
  const { analysis } = result;

  if (!analysis.ok) {
    throw new HttpError(422, "validation_failed", {
      guidance: "Fix the structural issues before committing. No rows were written.",
      summary: analysis.summary,
      structural_errors: analysis.structural_errors,
    });
  }

  const duplicate = await findDuplicate(supabase, actualHash, result.sheet_name);
  if (duplicate && body.confirm_duplicate !== true) {
    throw new HttpError(409, "duplicate_import", {
      guidance: "This exact file and sheet was already committed. Confirm a re-import to store a new version, or cancel.",
      duplicate,
      summary: analysis.summary,
    });
  }

  const { data: latest } = await supabase
    .from("imports")
    .select("version")
    .eq("file_hash", actualHash)
    .eq("sheet_name", result.sheet_name)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = (latest?.version ?? 0) + 1;

  const importId = crypto.randomUUID();
  const fileName = String(body.file_name ?? storagePath.split("/").pop() ?? "workbook.xlsx").slice(0, 255);
  const validationSummary = {
    headers: analysis.headers,
    warnings: analysis.warnings,
    structural_errors: analysis.structural_errors,
    counts: analysis.summary,
    header_row: result.header_row,
    detected_header_row: result.detected_header_row,
    generated_at: nowIso(),
  };

  const baseRecord = {
    id: importId,
    file_hash: actualHash,
    storage_path: storagePath,
    sheet_name: result.sheet_name,
    version,
    status: "validating",
    uploaded_by: user.id,
    column_mapping: analysis.mapping,
    file_name: fileName,
    file_size: size,
    header_row: result.header_row,
    row_count: analysis.summary.total_rows,
    valid_row_count: analysis.summary.valid_rows,
    error_row_count: analysis.summary.invalid_rows,
    household_count: analysis.summary.household_count,
    member_count: analysis.summary.member_count,
    validation_summary: validationSummary,
    is_duplicate: Boolean(duplicate),
    duplicate_of: duplicate?.id ?? null,
  };

  let wroteImport = false;
  try {
    const { error: importError } = await supabase.from("imports").insert(baseRecord);
    if (importError) throw importError;
    wroteImport = true;

    const rowInserts = analysis.rows.map((row) => ({
      import_id: importId,
      source_row_no: row.source_row_no,
      raw: row.raw,
      normalized: row.normalized,
      errors: row.issues,
      status: row.status,
      issue_count: row.issues.length,
    }));
    const insertedRows = await insertChunked(
      supabase,
      "import_rows",
      rowInserts,
      "id, source_row_no",
    );
    const rowIdByNumber = new Map<number, string>();
    for (const row of insertedRows) rowIdByNumber.set(Number(row.source_row_no), String(row.id));

    const householdById = new Map<string, string>();
    const householdInserts = analysis.households.map((household) => {
      const id = crypto.randomUUID();
      householdById.set(household.hh_id, id);
      return {
        id,
        import_id: importId,
        hh_id: household.hh_id,
        grantee_status: household.grantee_status,
        review_status: household.review_status,
        member_count: household.member_count,
      };
    });
    await insertChunked(supabase, "households", householdInserts, "id, hh_id");

    const rowsByNumber = new Map<number, (typeof analysis.rows)[number]>();
    for (const row of analysis.rows) rowsByNumber.set(row.source_row_no, row);
    const granteeIndex = analysis.mapping.find((entry) => entry.field === "GRANTEE")?.index ?? -1;

    const memberInserts: any[] = [];
    for (const household of analysis.households) {
      const householdId = householdById.get(household.hh_id);
      for (const rowNumber of household.member_row_numbers) {
        const row = rowsByNumber.get(rowNumber);
        if (!row || !householdId) continue;
        memberInserts.push({
          household_id: householdId,
          import_row_id: rowIdByNumber.get(rowNumber) ?? null,
          entry_id: row.entry_id,
          lrn: row.normalized.LRN ?? null,
          pcn: row.normalized.PCN ?? null,
          is_grantee_flag_raw: granteeIndex >= 0 ? row.raw[granteeIndex] ?? null : null,
          normalized_grantee: row.grantee,
          excluded: false,
          raw: row.raw,
        });
      }
    }
    if (memberInserts.length) {
      await insertChunked(supabase, "household_members", memberInserts);
    }

    const { data: committed, error: commitError } = await supabase
      .from("imports")
      .update({
        status: "committed",
        committed_at: nowIso(),
        validation_summary: validationSummary,
      })
      .eq("id", importId)
      .select("*")
      .single();
    if (commitError) throw commitError;

    await auditLog({
      actorId: user.id,
      action: "import_committed",
      entityType: "imports",
      entityId: importId,
      afterState: {
        version,
        sheet_name: result.sheet_name,
        file_hash: actualHash,
        row_count: analysis.summary.total_rows,
        invalid_rows: analysis.summary.invalid_rows,
        household_count: analysis.summary.household_count,
        is_duplicate: Boolean(duplicate),
        duplicate_of: duplicate?.id ?? null,
      },
    });

    return json({
      import: importRecord(committed, user.email ?? null),
      summary: analysis.summary,
      report_available: analysis.summary.invalid_rows > 0,
    });
  } catch (e) {
    if (wroteImport) {
      try {
        await supabase.from("imports").delete().eq("id", importId);
      } catch {
        // Best-effort cleanup. The audit entry below still records the failure.
      }
    }
    try {
      await auditLog({
        actorId: user.id,
        action: "import_commit_failed",
        entityType: "imports",
        entityId: importId,
        afterState: { sheet_name: result.sheet_name, file_hash: actualHash, safe_error: "commit_failed" },
      });
    } catch {
      // Auditing failure must not mask the user-facing error.
    }
    throw new HttpError(500, "commit_failed", {
      guidance: "The import could not be committed. Nothing was kept. Try again or contact an administrator.",
    });
  }
}

async function listImports(supabase: any, url: URL) {
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 20), 1), MAX_LIST_LIMIT);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

  const { data, error: listError, count } = await supabase
    .from("imports")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (listError) throw listError;

  const rows = (data ?? []) as ImportRowRecord[];
  const userIds = [...new Set(rows.map((row) => row.uploaded_by).filter(Boolean))];
  const names = new Map<string, string | null>();
  if (userIds.length) {
    const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", userIds);
    for (const profile of profiles ?? []) names.set(profile.id, profile.display_name ?? null);
  }

  return json({
    imports: rows.map((row) => importRecord(row, names.get(row.uploaded_by) ?? null)),
    total: count ?? rows.length,
    limit,
    offset,
  });
}

async function importDetail(supabase: any, url: URL) {
  const id = String(url.searchParams.get("id") ?? "");
  if (!id) return error(422, "missing_import_id");

  const { data, error: detailError } = await supabase.from("imports").select("*").eq("id", id).maybeSingle();
  if (detailError) throw detailError;
  if (!data) throw new HttpError(404, "not_found");

  const { data: rows } = await supabase
    .from("import_rows")
    .select("source_row_no, normalized, errors, status, issue_count")
    .eq("import_id", id)
    .order("source_row_no", { ascending: true })
    .limit(50);

  return json({
    import: importRecord(data, await profileName(supabase, data.uploaded_by)),
    rows: rows ?? [],
    report_available: Number(data.error_row_count ?? 0) > 0,
  });
}

async function errorReport(supabase: any, url: URL) {
  const id = String(url.searchParams.get("id") ?? "");
  if (!id) return error(422, "missing_import_id");

  const { data: record } = await supabase
    .from("imports")
    .select("id, file_name, sheet_name, version, error_row_count")
    .eq("id", id)
    .maybeSingle();
  if (!record) throw new HttpError(404, "not_found");

  const rows: Array<{ source_row_no: number; errors: unknown }> = [];
  const pageSize = 1000;
  for (let from = 0; from < 100_000; from += pageSize) {
    const { data, error: rowsError } = await supabase
      .from("import_rows")
      .select("source_row_no, errors")
      .eq("import_id", id)
      .eq("status", "invalid")
      .order("source_row_no", { ascending: true })
      .range(from, from + pageSize - 1);
    if (rowsError) throw rowsError;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
  }

  const csv = buildErrorReportCsv(rows);
  return text(`\uFEFF${csv}`, 200, "text/csv; charset=utf-8");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();

  try {
    const user = await verifyJwt(req);
    await requireImporter(user.id);
    const supabase = getServiceClient();
    const url = new URL(req.url);

    if (req.method === "GET") {
      const action = url.searchParams.get("action") ?? "list";
      if (action === "list") return await listImports(supabase, url);
      if (action === "detail") return await importDetail(supabase, url);
      if (action === "errors") return await errorReport(supabase, url);
      return error(404, "not_found");
    }

    if (req.method === "POST") {
      let body: any;
      try {
        body = await req.json();
      } catch {
        return error(422, "invalid_json");
      }
      const action = String(body.action ?? "");
      if (action === "preview") return await previewImport(supabase, user, body);
      if (action === "commit") return await commitImport(supabase, user, body);
      return error(404, "not_found");
    }

    return error(405, "method_not_allowed");
  } catch (e) {
    return handleError(e);
  }
});
