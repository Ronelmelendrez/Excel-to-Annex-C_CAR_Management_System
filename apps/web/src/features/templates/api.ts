import { isDemoMode, supabase } from "../../shared/supabase";
import type {
  RepeatingTableConfig,
  TemplateFieldMapping,
  TemplateStatus,
  TemplateVersion,
} from "./types";

const BUCKET = "document-templates";
const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type TemplateRow = {
  id: string;
  name: string;
  version: number;
  storage_path: string;
  file_name: string;
  file_size_bytes: number;
  field_mappings: TemplateFieldMapping[] | null;
  repeating_config: RepeatingTableConfig[] | null;
  status: TemplateStatus;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  activated_at: string | null;
  created_at: string;
};

function assertConfigured(): void {
  if (isDemoMode) {
    throw new Error(
      "Template management requires Supabase. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then apply the Supabase migrations.",
    );
  }
}

function mapTemplate(row: TemplateRow): TemplateVersion {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    fileName: row.file_name,
    fileSizeBytes: row.file_size_bytes,
    storagePath: row.storage_path,
    status: row.status,
    uploadedAt: row.created_at,
    uploadedBy: row.created_by ?? "Unknown administrator",
    mappings: Array.isArray(row.field_mappings) ? row.field_mappings : [],
    repeatingTables: Array.isArray(row.repeating_config) ? row.repeating_config : [],
    approvedBy: row.approved_by ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    activatedAt: row.activated_at ?? undefined,
  };
}

function cleanFileName(fileName: string): string {
  const cleaned = fileName.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return (cleaned || "template.docx").slice(0, 180);
}

function templateReadError(): Error {
  return new Error("Template versions could not be loaded. Check your connection and administrator permissions.");
}

export async function listTemplateVersions(): Promise<TemplateVersion[]> {
  assertConfigured();
  const { data, error } = await supabase
    .from("document_templates")
    .select("*")
    .order("version", { ascending: false });
  if (error || !data) throw templateReadError();
  return (data as TemplateRow[]).map(mapTemplate);
}

export async function createTemplateDraft(params: {
  file: File;
  userId: string;
  mappings: TemplateFieldMapping[];
  repeatingTables: RepeatingTableConfig[];
}): Promise<TemplateVersion> {
  assertConfigured();

  const { data: latest, error: versionError } = await supabase
    .from("document_templates")
    .select("version")
    .eq("name", "Annex C")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (versionError) {
    throw new Error("The next Annex C template version could not be determined.");
  }

  const id = crypto.randomUUID();
  const version = Number(latest?.version ?? 0) + 1;
  const storagePath = `annex-c/${id}/${cleanFileName(params.file.name)}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, params.file, {
    upsert: false,
    contentType: DOCX_MIME_TYPE,
    cacheControl: "3600",
  });
  if (uploadError) {
    throw new Error("The template could not be uploaded to private storage. Check your connection and permissions.");
  }

  const { data, error } = await supabase
    .from("document_templates")
    .insert({
      id,
      name: "Annex C",
      version,
      storage_path: storagePath,
      file_name: params.file.name,
      file_size_bytes: params.file.size,
      field_mappings: params.mappings,
      required_fields: params.mappings.filter((mapping) => mapping.required).map((mapping) => mapping.placeholder),
      repeating_config: params.repeatingTables,
      status: "draft",
      created_by: params.userId,
    })
    .select("*")
    .single();

  if (error || !data) {
    const { error: cleanupError } = await supabase.storage.from(BUCKET).remove([storagePath]);
    if (cleanupError) {
      throw new Error(
        "The template record could not be saved, and its uploaded file could not be cleaned up. Contact an administrator before retrying.",
      );
    }
    throw new Error("The template version could not be saved. Check administrator permissions and try again.");
  }
  return mapTemplate(data as TemplateRow);
}

export async function updateTemplateConfiguration(
  template: TemplateVersion,
): Promise<TemplateVersion> {
  assertConfigured();
  const { data, error } = await supabase
    .from("document_templates")
    .update({
      field_mappings: template.mappings,
      required_fields: template.mappings
        .filter((mapping) => mapping.required)
        .map((mapping) => mapping.placeholder),
      repeating_config: template.repeatingTables,
    })
    .eq("id", template.id)
    .eq("status", "draft")
    .select("*")
    .single();
  if (error || !data) {
    throw new Error("The template configuration could not be saved. Refresh and try again.");
  }
  return mapTemplate(data as TemplateRow);
}

export async function markTemplateValidated(templateId: string): Promise<TemplateVersion> {
  assertConfigured();
  const { data, error } = await supabase
    .from("document_templates")
    .update({ status: "validated" })
    .eq("id", templateId)
    .eq("status", "draft")
    .select("*")
    .single();
  if (error || !data) {
    throw new Error("The template could not be marked validated. Refresh and try again.");
  }
  return mapTemplate(data as TemplateRow);
}

export async function approveTemplate(
  templateId: string,
  userId: string,
): Promise<TemplateVersion> {
  assertConfigured();
  const { data, error } = await supabase
    .from("document_templates")
    .update({ approved_by: userId, approved_at: new Date().toISOString() })
    .eq("id", templateId)
    .eq("status", "validated")
    .is("approved_by", null)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error("Approval could not be saved. Confirm the template is validated and try again.");
  }
  return mapTemplate(data as TemplateRow);
}

export async function activateTemplate(templateId: string): Promise<TemplateVersion[]> {
  assertConfigured();
  const { error } = await supabase.rpc("activate_document_template", {
    template_uuid: templateId,
  });
  if (error) {
    throw new Error("The template could not be activated. Confirm it is approved and validated, then try again.");
  }
  return listTemplateVersions();
}

export async function downloadTemplateFile(storagePath: string): Promise<Blob> {
  assertConfigured();
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error || !data) {
    throw new Error("The private template file could not be downloaded. Check storage permissions and try again.");
  }
  return data;
}
