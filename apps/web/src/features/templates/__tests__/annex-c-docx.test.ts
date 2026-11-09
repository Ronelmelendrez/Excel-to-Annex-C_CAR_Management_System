/**
 * DOCX parity and structure tests for the Annex C generator (REQ-RPT-005).
 *
 * Plan test: the text extracted from the generated .docx must equal the UI
 * preview text (`fillTemplate(REPORT_TEMPLATE, values)`) once whitespace is
 * normalized — both are produced from the same versioned definition and the
 * same `buildDocxData`/`resolveSlotValues` derivation, so they cannot drift.
 *
 * Also asserts the structural promises the generator relies on: the DSWD
 * letterhead survives, no `{{` tags remain, the leftover personal names from
 * the old case file are gone, and both row loops repeat once per entry.
 */
import PizZip from 'pizzip';
import { describe, expect, it } from 'vitest';
import {
  REPORT_TEMPLATE,
  fillTemplate,
  resolveSlotValues,
  type ReportDraftLike,
} from '@report-template';
import { renderAnnexCDocx } from '../lib/annex-c-docx';
import { defaultInterventions } from '../../cars/lib/report/values';

/* --------------------------------------------------------------- fixtures */

function makeDraft(): ReportDraftLike {
  return {
    hhId: '000091',
    datePrepared: '2026-11-05',
    granteeMemberId: 'm-1',
    slots: {
      report_date: { value: '2026-11-05', source: 'manual' },
      national_id_no: { value: '1234-5678-9012', source: 'manual' },
      place_of_birth: { value: 'Tagbilaran City', source: 'manual' },
      contact_info: { value: '0917 123 4567', source: 'manual' },
      religion: { value: 'Catholic', source: 'manual' },
      source_of_information: { value: 'Home visit interview', source: 'manual' },
      wellbeing_present: { value: 'Level 1', source: 'manual' },
      previous_assessment: { value: 'None', source: 'manual' },
      hh_risk_level: { value: 'High', source: 'manual' },
      case_category: { value: 'None', source: 'manual' },
      provider_occupation: { value: 'vendor', source: 'manual' },
      provider_monthly_income: { value: '8500', source: 'manual' },
      family_challenges: { value: 'medical bills and school fees', source: 'manual' },
      community_characteristics: { value: 'dense residential', source: 'manual' },
      basic_services: { value: 'health center and day care', source: 'manual' },
      residence_description: { value: 'concrete', source: 'manual' },
      housing_materials: { value: 'concrete and wood', source: 'manual' },
      access_level: { value: 'limited', source: 'manual' },
      neighbor_relationship: { value: 'cooperative', source: 'manual' },
      assessment_challenges: { value: 'medical bills and school fees', source: 'manual' },
      primary_income_source: { value: 'selling goods', source: 'manual' },
      income_sufficiency: { value: 'insufficient', source: 'manual' },
      coping_demonstrated: { value: 'borrowing from relatives', source: 'manual' },
      assessment_difficulties: { value: 'transport and medicine costs', source: 'manual' },
      strengths_resources: { value: 'supportive relatives', source: 'manual' },
      recommended_support: { value: 'medical and educational assistance', source: 'manual' },
    },
    familyComposition: [
      {
        id: 'm-1',
        name: 'Ana Dela Cruz',
        relationship: 'Household head',
        age: 38,
        sourceRow: 2,
        include: true,
        data: {
          SEX: 'Female',
          CIVIL_STATUS: 'Married',
          MEMBER_STATUS: 'Residing',
          CHILD_BENE: 'No',
          GRADE_LEVEL: 'College',
          DISABILITY_TYPES: '',
          RELATION_TO_HH_HEAD: 'Head',
          REGION: '07',
          PROVINCE: 'Bohol',
          MUNICIPALITY: 'Tagbilaran City',
          BARANGAY: 'Poblacion',
          FIRST_NAME: 'Ana',
          LAST_NAME: 'Dela Cruz',
          AGE: '38',
        },
      },
      {
        id: 'm-2',
        name: 'Ben Dela Cruz',
        relationship: 'Son',
        age: 9,
        sourceRow: 3,
        include: true,
        overlay: { occupation: 'Student' },
        data: {
          SEX: 'Male',
          CIVIL_STATUS: 'Single',
          MEMBER_STATUS: 'Residing',
          CHILD_BENE: 'Yes',
          GRADE_LEVEL: 'Grade 4',
          DISABILITY_TYPES: '',
          RELATION_TO_HH_HEAD: 'Son',
          AGE: '9',
        },
      },
      {
        id: 'm-3',
        name: 'Cara Dela Cruz',
        relationship: 'Daughter',
        age: 4,
        sourceRow: 4,
        include: false,
        data: { SEX: 'Female', CHILD_BENE: 'No', AGE: '4' },
      },
    ],
    interventions: [
      {
        included: true,
        need: 'Medical Assistance',
        objective: 'Avail free medical check-up',
        activities: '-refer {{grantee_first_name}} to RHU for monthly check up',
        responsible: 'RHU\nBarangay Health Center',
        timeline: 'Q1 2026',
        remarks: 'maintain the {{grantee_possessive}} overall health',
      },
      {
        included: true,
        need: 'Custom livelihood row',
        objective: 'Start a small store',
        activities: 'Attend entrepreneurship seminar',
        responsible: 'MLGU',
        timeline: '',
        remarks: '',
      },
      {
        included: false,
        need: 'Excluded row',
        objective: 'Should not appear',
        activities: 'Should not appear',
        responsible: 'Nobody',
        timeline: '',
        remarks: '',
      },
    ],
  };
}

/* --------------------------------------------------------------- extract */

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Paragraph texts of document.xml with tables dropped (UI parity compares
 *  prose/fields only — the tables have their own assertions below). */
function paragraphTexts(xml: string): string[] {
  const withoutTables = xml.replace(/<w:tbl[\s\S]*?<\/w:tbl>/g, '');
  const paragraphs = withoutTables.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>|<w:p\s*\/>/g) ?? [];
  return paragraphs
    .map((paragraph) =>
      decodeEntities(
        paragraph
          .replace(/<w:tab\s*\/>/g, ' ')
          .replace(/<w:br\s*\/>|<w:cr\s*\/>/g, ' ')
          .replace(/<[^>]+>/g, ''),
      ).trim(),
    )
    .filter((text) => text.length > 0);
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

async function render() {
  const draft = makeDraft();
  const household = { barangay: 'Poblacion', municipality: 'Tagbilaran City' };
  const bytes = await renderAnnexCDocx(draft, household);
  const zip = new PizZip(new Uint8Array(bytes));
  return {
    draft,
    household,
    documentXml: zip.file('word/document.xml')?.asText() ?? '',
    headerXml: zip.file('word/header1.xml')?.asText() ?? '',
    footerXml: zip.file('word/footer1.xml')?.asText() ?? '',
  };
}

/* ----------------------------------------------------------------- tests */

describe('Annex C DOCX generation', () => {
  it('rendered DOCX text equals the UI preview text (fillTemplate parity)', async () => {
    const { draft, household, documentXml } = await render();
    const values = resolveSlotValues(draft, household);

    // UI side: the versioned template filled with the same derived values.
    const lines = fillTemplate(REPORT_TEMPLATE, values);
    const expected = normalize(lines.join('\n'));

    // DOCX side: paragraph text (tables dropped), cut at the sign-off block
    // which the UI preview does not render.
    const docxLines = paragraphTexts(documentXml);
    const cutAt = docxLines.findIndex((line) => normalize(line).startsWith('Prepared by:'));
    expect(cutAt).toBeGreaterThanOrEqual(0);
    const actual = normalize(docxLines.slice(0, cutAt).join('\n'));

    expect(actual).toBe(expected);
    expect(documentXml).not.toContain('Untitled row —');
  });

  it('keeps the DSWD letterhead and footer parts intact', async () => {
    const { headerXml, footerXml } = await render();
    expect(headerXml).toContain('DEPARTMENT OF SOCIAL WELFARE AND DEVELOPMENT');
    expect(headerXml).toContain('Annex C');
    expect(headerXml).toContain('Pantawid');
    expect(footerXml).toContain('Page');
  });

  it('leaves no placeholder tags and no leftover personal names', async () => {
    const { documentXml } = await render();
    expect(documentXml).not.toContain('{{');
    expect(documentXml).not.toContain('}}');
    expect(documentXml).not.toContain('Vicenta');
    expect(documentXml).not.toContain('Ramil');
  });

  it('repeats the family table row for each included member, with cell values', async () => {
    const { documentXml } = await render();
    const [familyTable] = documentXml.match(/<w:tbl[\s\S]*?<\/w:tbl>/g) ?? [];
    expect(familyTable).toBeTruthy();

    // 2 header rows (Monitored Child spans YES/NO) + one row per included member.
    expect((familyTable.match(/<w:tr\b/g) ?? []).length).toBe(2 + 2);

    expect(documentXml).toContain('Ana Dela Cruz');
    expect(documentXml).toContain('Ben Dela Cruz');
    // Excluded member never renders.
    expect(documentXml).not.toContain('Cara Dela Cruz');
    // Cell values derived from the workbook columns and the case-worker overlay.
    expect(documentXml).toContain('Married');
    expect(documentXml).toContain('Grade 4');
    expect(documentXml).toContain('Student');
    // Monitored Child YES mark lands in the YES cell only.
    expect(documentXml).toContain('✓');
  });

  it('repeats the intervention table row for each included row', async () => {
    const { documentXml } = await render();
    const tables = documentXml.match(/<w:tbl[\s\S]*?<\/w:tbl>/g) ?? [];
    expect(tables.length).toBe(2);
    const interventionTable = tables[1];

    // 1 header row + one row per included plan row.
    expect((interventionTable.match(/<w:tr\b/g) ?? []).length).toBe(1 + 2);

    expect(documentXml).toContain('Medical Assistance');
    expect(documentXml).toContain('Start a small store');
    expect(documentXml).not.toContain('Excluded row');
    // Catalog tokens are pre-filled by buildDocxData (no nested tags reach
    // docxtemplater): {{grantee_first_name}} → derived first name.
    expect(documentXml).toContain('refer Ana to RHU');
    expect(documentXml).toContain("Ana’s overall health");
  });

  it('exports the six Annex C intervention rows in the plan table', async () => {
    const bytes = await renderAnnexCDocx(
      { ...makeDraft(), interventions: defaultInterventions() },
      { barangay: 'Poblacion', municipality: 'Tagbilaran City' },
    );
    const zip = new PizZip(new Uint8Array(bytes));
    const xml = zip.file('word/document.xml')?.asText() ?? '';
    const tables = xml.match(/<w:tbl[\s\S]*?<\/w:tbl>/g) ?? [];
    const interventionTable = tables[1];
    expect((interventionTable.match(/<w:tr\b/g) ?? []).length).toBe(7);
    for (const need of [
      'Medical Assistance',
      'Scholarship for college ongoing children',
      'Increased social network',
      'Stable Employment',
      'Capability Building',
      'Progress Monitoring',
    ]) {
      expect(interventionTable).toContain(need);
    }
    expect(interventionTable).toContain('_________');
    expect(interventionTable).toContain('Brgy');
    expect(interventionTable).toContain('Every 6mons');
    expect(xml).not.toContain('Untitled row —');
    expect(xml).not.toContain('Helping activities:');
  });

  it('does not append prose duplicates after the intervention table', async () => {
    const { documentXml } = await render();
    expect(documentXml).not.toContain('Untitled row —');
    expect(documentXml).not.toContain('Helping activities:');
  });
});
