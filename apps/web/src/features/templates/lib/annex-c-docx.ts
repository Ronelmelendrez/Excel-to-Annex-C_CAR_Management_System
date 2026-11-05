/**
 * Annex C DOCX generation for the report generator page.
 *
 * Fills the committed tagged template (assets/annex-c-car-v1.docx — built by
 * scripts/build-annex-c-template.mjs from the same versioned REPORT_TEMPLATE
 * the UI preview renders) with `buildDocxData(...)`, so the downloaded Word
 * file and the on-screen preview are generated from one definition and one
 * data builder (REQ-RPT-005/006).
 *
 * The template is imported with `?inline` (Vite inlines it as a data URI), so
 * the file ships inside the bundle — no runtime fetch, works offline and in
 * tests. Letterhead, fonts, table borders and page setup come from the
 * original DSWD .docx because we fill that file rather than regenerate one.
 */
import { buildDocxData, type HouseholdContext, type ReportDraftLike, type SettingsOverrides } from '@report-template';
import templateBase64 from '../assets/annex-c-car-v1.docx?inline';

export const DOCX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** The versioned template file this module fills (matches REPORT_TEMPLATE_VERSION). */
export const ANNEX_C_TEMPLATE_FILE = 'annex-c-car-v1.docx';

function base64ToBytes(dataUri: string): Uint8Array {
  // Vite's `?inline` yields a data URI ("data:<mime>;base64,<payload>").
  const comma = dataUri.indexOf(',');
  const binary = atob(comma >= 0 ? dataUri.slice(comma + 1) : dataUri);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function loadDocxLibraries() {
  const [docxtemplaterModule, pizzipModule] = await Promise.all([
    import('docxtemplater'),
    import('pizzip'),
  ]);
  return {
    Docxtemplater: docxtemplaterModule.default,
    PizZip: pizzipModule.default,
  };
}

/**
 * Renders the Annex C report to .docx bytes from a draft + household context.
 * Pure data in, ArrayBuffer out — the caller decides how to deliver it.
 */
export async function renderAnnexCDocx(
  draft: ReportDraftLike,
  household?: HouseholdContext,
  settings?: SettingsOverrides,
): Promise<ArrayBuffer> {
  const { Docxtemplater, PizZip } = await loadDocxLibraries();
  const zip = new PizZip(base64ToBytes(templateBase64));
  const doc = new Docxtemplater(zip, {
    delimiters: { start: '{{', end: '}}' },
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
  });
  doc.render(buildDocxData(draft, household, settings));
  return doc.getZip().generate({ type: 'arraybuffer' }) as ArrayBuffer;
}

/**
 * Download filename for a CAR draft — shared by the report generator page and
 * the CAR authoring page so both exports are named identically.
 */
export function annexCDocxFileName(draft: { granteeName: string; hhId: string }): string {
  const safeName = draft.granteeName.replace(/[\\/:*?"<>|]/g, ' ').trim() || 'grantee';
  return `Annex C - CASE STUDY REPORT - ${safeName} (${draft.hhId}).docx`;
}

/** Triggers a browser download of already-rendered .docx bytes. */
export function downloadDocx(bytes: ArrayBuffer, filename: string): void {
  const blob = new Blob([bytes], { type: DOCX_MIME_TYPE });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.docx') ? filename : `${filename}.docx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
