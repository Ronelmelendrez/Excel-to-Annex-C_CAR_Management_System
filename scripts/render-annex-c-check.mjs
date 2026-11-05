#!/usr/bin/env node
/**
 * Renders the generated Annex C template (scripts/build-annex-c-template.mjs
 * output) with synthetic data and asserts the structural promises the DOCX
 * generator relies on (plan R5; REQ-RPT-005):
 *
 *   - docxtemplater row loops repeat the tagged row per entry (the open tag
 *     in the first cell and the close tag in the last cell of one w:tr),
 *   - every scalar/loop tag is consumed (no "{{" left in the output),
 *   - the DSWD letterhead in word/header1.xml survives untouched,
 *   - the footer/page-number part survives untouched.
 *
 * Run from the repo root:  node scripts/render-annex-c-check.mjs
 */
import { readFileSync } from 'node:fs';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { SLOT_DEFS } from '../supabase/functions/_shared/report-template.ts';

const TEMPLATE = 'apps/web/src/features/templates/assets/annex-c-car-v1.docx';

const FAMILY_TOKENS = [
  'member_name',
  'member_sex',
  'member_age',
  'member_civil_status',
  'member_relationship',
  'member_staying',
  'member_monitored_yes',
  'member_monitored_no',
  'member_education',
  'member_occupation',
  'member_income',
  'member_disability',
];
const INTERVENTION_TOKENS = [
  'need',
  'objective',
  'activities',
  'responsible',
  'timeline',
  'remarks',
];

function fail(message) {
  throw new Error(`render-annex-c-check: ${message}`);
}

/* ------------------------------------------------------ synthetic values */

// One unmistakable value per slot so we can prove each tag was consumed.
const data = {};
for (const def of SLOT_DEFS) data[def.key] = `[${def.key}]`;

// Two rows per loop: a single row cannot prove the loop repeats.
const familyMembers = ['ALPHA', 'BRAVO'].map((name, i) => {
  const row = {};
  for (const token of FAMILY_TOKENS) row[`${token}`] = `${token}-${name}`;
  row.member_name = name;
  row.member_monitored_yes = i === 0 ? '✓' : '';
  row.member_monitored_no = i === 0 ? '' : '✓';
  return row;
});
data.familyComposition = familyMembers;

data.interventions = ['DELTA', 'ECHO'].map((name) => {
  const row = {};
  for (const token of INTERVENTION_TOKENS) row[token] = `${token}-${name}`;
  row.name = name;
  return row;
});

/* --------------------------------------------------------------- render */

const zip = new PizZip(readFileSync(TEMPLATE));
const headerBefore = zip.file('word/header1.xml')?.asText();
const footerBefore = zip.file('word/footer1.xml')?.asText();
if (!headerBefore) fail('word/header1.xml missing from the template');
if (!footerBefore) fail('word/footer1.xml missing from the template');

const doc = new Docxtemplater(zip, {
  delimiters: { start: '{{', end: '}}' },
  paragraphLoop: true,
  linebreaks: true,
  nullGetter: () => '',
});
doc.render(data);
const rendered = doc.getFullText(); // document.xml text (incl. tables)

/* ------------------------------------------------------------ assertions */

// 1. Every tag was consumed.
if (rendered.includes('{{')) {
  const leftovers = [...rendered.matchAll(/\{\{[^}]*\}\}/g)].map((m) => m[0]);
  fail(`rendered document still contains tags: ${JSON.stringify(leftovers)}`);
}

// 2. Family row loop repeats: both members' values in every cell column.
for (const member of familyMembers) {
  if (!rendered.includes(member.member_name)) {
    fail(`family loop did not repeat for "${member.member_name}"`);
  }
}
// The second member's row can only exist if the loop repeated.
const lastMember = familyMembers[1];
for (const token of ['member_relationship', 'member_education', 'member_income']) {
  if (!rendered.includes(`${token}-${lastMember.member_name}`)) {
    fail(`family cell "{{${token}}}" missing for the repeated row`);
  }
}

// 3. Intervention row loop repeats: both objectives present.
for (const row of data.interventions) {
  if (!rendered.includes(row.objective)) {
    fail(`intervention loop did not repeat for "${row.objective}"`);
  }
}
if (!rendered.includes(`responsible-${data.interventions[1].name}`)) {
  fail('intervention cell "{{responsible}}" missing for the repeated row');
}

// 4. Scalar slots were filled (spot-check one per major section).
for (const key of ['report_date', 'grantee_name', 'barangay', 'goal_year', 'prepared_by_name']) {
  if (!rendered.includes(`[${key}]`)) {
    fail(`scalar slot {{${key}}} was not filled`);
  }
}

// 5. Letterhead and footer parts are byte-identical (never touched).
const after = new PizZip(doc.getZip().generate({ type: 'nodebuffer' }));
if (after.file('word/header1.xml')?.asText() !== headerBefore) {
  fail('word/header1.xml changed during render (letterhead)');
}
if (after.file('word/footer1.xml')?.asText() !== footerBefore) {
  fail('word/footer1.xml changed during render (footer)');
}

console.log('render-annex-c-check: OK');
console.log(`  - family rows rendered: ${familyMembers.length}, intervention rows: ${data.interventions.length}`);
console.log(`  - ${SLOT_DEFS.length} scalar slots filled, no tags left, letterhead/footer intact`);
