#!/usr/bin/env node
/**
 * Tokenizes the Annex C source .docx into the committed tagged template that
 * the DOCX generator fills (plan R5; REQ-RPT-005/006).
 *
 * Every {{slot}}, every fixed sentence, every identity label and the
 * family/intervention row vocabulary are taken from the versioned definition
 * in supabase/functions/_shared/report-template.ts, so the Word template and
 * the UI preview are generated from the same source and cannot drift.
 *
 * What this script does:
 *   - identity labels get a token run right after the label,
 *   - the Date/goal blanks become {{report_date}}/{{goal_year}},
 *   - prose paragraphs carrying blanks are rebuilt verbatim from the template
 *     definition text (static wording + {{slot}} tokens),
 *   - the family table keeps its two header rows and one {{#familyComposition}}
 *     row (extra empty rows dropped), the intervention table keeps its header
 *     and one {{#interventions}} row,
 *   - signatory names/titles/dates become setting-backed tokens,
 *   - leftover personal names from the old case file are gone by construction.
 *
 * Source: "Annex C CASE STUDY REPORT FOR ACTIVE OR LEVEL 2.docx" (repo root)
 * Output: apps/web/src/features/templates/assets/<template-version>.docx
 *
 * Run from the repo root:  node scripts/build-annex-c-template.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import PizZip from 'pizzip';
import {
  DEFAULT_REPORT_SETTINGS,
  FORBIDDEN_STATIC_NAMES,
  REPORT_TEMPLATE,
  REPORT_TEMPLATE_SOURCE,
  REPORT_TEMPLATE_VERSION,
  SLOT_DEFS,
} from '../supabase/functions/_shared/report-template.ts';

const OUTPUT = `apps/web/src/features/templates/assets/${REPORT_TEMPLATE_VERSION}.docx`;

/* ----------------------------------------------------------- XML helpers */

function decodeXmlText(raw) {
  return raw
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/g, '&');
}

function escXml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fail(message) {
  throw new Error(`build-annex-c-template: ${message}`);
}

/** Top-level <w:p>/<w:tbl> spans of the body (tables are single spans). */
function splitTopLevel(xml) {
  const re = /<(\/?)(w:p|w:tbl)(?=[\s/>])([^>]*)>/g;
  const spans = [];
  let depth = 0;
  let start = 0;
  let name = null;
  let m;
  while ((m = re.exec(xml))) {
    const isClose = m[1] === '/';
    const tag = m[2];
    const selfClose = /\/\s*$/.test(m[3] ?? '');
    if (depth === 0) {
      if (isClose) fail(`unexpected </${tag}> at offset ${m.index}`);
      if (selfClose) {
        spans.push({ type: tag.replace(/^w:/, ''), start: m.index, end: re.lastIndex });
        continue;
      }
      depth = 1;
      start = m.index;
      name = tag;
      continue;
    }
    if (tag !== name) continue; // nested <w:p> inside a table cell: part of the span
    if (selfClose) continue;
    if (isClose) {
      depth -= 1;
      if (depth === 0) {
        spans.push({ type: name.replace(/^w:/, ''), start, end: re.lastIndex });
        depth = 0;
        name = null;
      }
    } else {
      depth += 1;
    }
  }
  if (depth !== 0) fail('unbalanced paragraph/table tags in document.xml');
  return spans;
}

function getRuns(inner) {
  const runs = [];
  const re = /<w:r(?:\s[^>]*)?\/>|<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g;
  let m;
  while ((m = re.exec(inner))) {
    runs.push({ start: m.index, end: re.lastIndex, xml: m[0] });
  }
  return runs;
}

/** <w:t> content ranges of a run, relative to the run XML. */
function runPieces(runXml) {
  const pieces = [];
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  let m;
  while ((m = re.exec(runXml))) {
    const contentStart = m.index + m[0].indexOf('>') + 1;
    pieces.push({ start: contentStart, end: contentStart + m[1].length, raw: m[1] });
  }
  return pieces;
}

function rPrOf(runXml) {
  const match = /<w:rPr>[\s\S]*?<\/w:rPr>/.exec(runXml);
  return match ? match[0] : '';
}

function makeRun(text, rPr) {
  return `<w:r>${rPr}<w:t xml:space="preserve">${escXml(text)}</w:t></w:r>`;
}

/**
 * Paragraph model: concatenated text plus a per-character map back into the
 * run/<w:t> that produced it. Tabs and other non-text elements take no space.
 */
function paraInfo(inner) {
  const runs = getRuns(inner);
  const map = [];
  let text = '';
  for (let r = 0; r < runs.length; r += 1) {
    const pieces = runPieces(runs[r].xml);
    for (let p = 0; p < pieces.length; p += 1) {
      const decoded = decodeXmlText(pieces[p].raw);
      for (let i = 0; i < decoded.length; i += 1) {
        map.push({ char: decoded[i], run: r, piece: p, offset: i });
        text += decoded[i];
      }
    }
  }
  return { runs, map, text };
}

/** Whitespace-free view of a string plus norm-position → raw-position map. */
function normWithMap(text) {
  let norm = '';
  const idx = [];
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (/\s/.test(ch)) continue;
    norm += ch === '\u2019' ||ch === '\u2018' ? "'" : ch;
    idx.push(i);
  }
  return { norm, idx };
}

function norm(text) {
  return normWithMap(text).norm;
}

/* ---------------------------------------------------------- paragraph ops */

/** Insert token runs after the run that holds each insertion's anchor run. */
function insertTokenRuns(inner, insertions) {
  if (insertions.length === 0) return inner;
  const runs = getRuns(inner);
  let out = '';
  let cursor = 0;
  for (let r = 0; r < runs.length; r += 1) {
    out += inner.slice(cursor, runs[r].end);
    cursor = runs[r].end;
    for (const ins of insertions) {
      if (ins.afterRun === r) out += makeRun(ins.text, rPrOf(runs[r].xml));
    }
  }
  out += inner.slice(cursor);
  return out;
}

/**
 * Replace the paragraph's text runs with one run holding `newText`, keeping
 * the paragraph properties (style/indent) and any leading tab-only runs.
 */
function rebuildParagraph(inner, newText) {
  const runs = getRuns(inner);
  if (runs.length === 0) return inner + makeRun(newText, '');
  let firstTextRun = -1;
  for (let r = 0; r < runs.length; r += 1) {
    if (runPieces(runs[r].xml).length > 0) {
      firstTextRun = r;
      break;
    }
  }
  const anchor = firstTextRun >= 0 ? runs[firstTextRun] : runs[0];
  const rPr = rPrOf(anchor.xml);
  const lastRun = runs[runs.length - 1];
  return inner.slice(0, anchor.start) + makeRun(newText, rPr) + inner.slice(lastRun.end);
}

/** Range replacement bound to a paragraph's inner XML (single <w:t> range). */
function makeRangeReplacer(inner) {
  return (start, length, replacement, describe) => {
    const info = paraInfo(inner);
    const first = info.map[start];
    const last = info.map[start + length - 1];
    if (!first || !last) fail(`range out of bounds while replacing ${describe}`);
    if (first.run !== last.run || first.piece !== last.piece) {
      fail(`"${describe}" spans runs; expected a single <w:t> run`);
    }
    const run = info.runs[first.run];
    const pieces = runPieces(run.xml);
    const piece = pieces[first.piece];
    const decoded = decodeXmlText(piece.raw);
    const updated =
      decoded.slice(0, first.offset) + replacement + decoded.slice(first.offset + length);
    const newRunXml = run.xml.slice(0, piece.start) + escXml(updated) + run.xml.slice(piece.end);
    return inner.slice(0, run.start) + newRunXml + inner.slice(run.end);
  };
}

function replaceLiteralIn(inner, needle, replacement) {
  const at = paraInfo(inner).text.indexOf(needle);
  if (at < 0) fail(`literal not found in paragraph: "${needle}"`);
  return makeRangeReplacer(inner)(at, needle.length, replacement, needle);
}

function replaceRegexIn(inner, regex, replacement) {
  const m = regex.exec(paraInfo(inner).text);
  if (!m) fail(`pattern ${regex} not found in paragraph`);
  return makeRangeReplacer(inner)(m.index, m[0].length, replacement, String(regex));
}

/* ------------------------------------------------------------- table ops */

function splitRows(tblXml) {
  const re = /<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g;
  const rows = [];
  let m;
  while ((m = re.exec(tblXml))) {
    rows.push({ start: m.index, end: re.lastIndex, xml: m[0] });
  }
  if (rows.length === 0) fail('table has no rows');
  return {
    prefix: tblXml.slice(0, rows[0].start),
    suffix: tblXml.slice(rows[rows.length - 1].end),
    rows,
  };
}

function splitCells(rowXml) {
  const re = /<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g;
  const cells = [];
  let m;
  while ((m = re.exec(rowXml))) {
    cells.push({ start: m.index, end: re.lastIndex, xml: m[0] });
  }
  return cells;
}

function cellText(cellXml) {
  const texts = [];
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  let m;
  while ((m = re.exec(cellXml))) texts.push(decodeXmlText(m[1]));
  return texts.join('');
}

/** Reduce a cell to a single paragraph holding `text` (keeps <w:tcPr>).
 *  Any extra paragraphs the source cell carried are dropped so no stray text
 *  survives next to the token. */
function rebuildCell(cellXml, text) {
  const re = /<w:p(?:\s[^>]*)?\/>|<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
  const first = re.exec(cellXml);
  const close = cellXml.lastIndexOf('</w:tc>');
  if (!first) {
    return `${cellXml.slice(0, close)}<w:p>${makeRun(text, '')}</w:p>${cellXml.slice(close)}`;
  }
  const openMatch = /^<w:p(?:\s[^>]*)?\/>|^<w:p(?:\s[^>]*)?>/.exec(first[0]);
  const openTag = openMatch[0];
  const selfClosing = /\/>$/.test(openTag);
  const newParagraph = selfClosing
    ? `<w:p>${makeRun(text, '')}</w:p>`
    : (() => {
        const inner = first[0].slice(openTag.length, -'</w:p>'.length);
        return `${openTag}${rebuildParagraph(inner, text)}</w:p>`;
      })();
  // Everything between the first paragraph and </w:tc> (extra paragraphs) goes.
  return `${cellXml.slice(0, first.index)}${newParagraph}${cellXml.slice(close)}`;
}

/* ------------------------------------------------------ template mapping */

const sections = REPORT_TEMPLATE.sections;
const identityBlock = sections
  .flatMap((section) => section.blocks)
  .find((block) => block.kind === 'fields');
if (!identityBlock) fail('template definition has no identity fields block');
const identityFields = identityBlock.fields;

const paraBlocks = sections
  .flatMap((section) => section.blocks)
  .filter((block) => block.kind === 'para' || block.kind === 'goal');

/** Template paragraph whose text starts with the docx paragraph anchor. */
function templateBlock(anchor) {
  const block = paraBlocks.find((entry) => entry.text.startsWith(anchor));
  if (!block) fail(`template has no paragraph starting with "${anchor}"`);
  return block;
}

const proseTargets = [
  { anchor: 'The family is experiencing financial difficulties', kind: 'assert-equal' },
  { anchor: 'The family of ', kind: 'rebuild' },
  { anchor: 'The family resides in Barangay', kind: 'rebuild' },
  { anchor: 'Based on the information gathered', kind: 'rebuild' },
  { anchor: 'The family has available strengths', kind: 'rebuild' },
  { anchor: 'It is recommended that the family of', kind: 'rebuild' },
];

/* --------------------------------------------------------------- reading */

const sourceBytes = readFileSync(REPORT_TEMPLATE_SOURCE);
const zip = new PizZip(sourceBytes);
const documentEntry = zip.file('word/document.xml');
if (!documentEntry) fail(`${REPORT_TEMPLATE_SOURCE} has no word/document.xml`);
const docXml = documentEntry.asText();
const bodyClose = docXml.lastIndexOf('</w:body>');
if (bodyClose < 0) fail('document.xml has no body');
const bodyOpenEnd = docXml.indexOf('>') + 1;
const bodyXml = docXml.slice(bodyOpenEnd, bodyClose);

const children = splitTopLevel(bodyXml).map((span) => {
  const xml = bodyXml.slice(span.start, span.end);
  const inner =
    span.type === 'p'
      ? xml.replace(/^<w:p(?:\s[^>]*)?>/, '').replace(/<\/w:p>$/, '')
      : null;
  return { ...span, xml, inner, info: inner !== null ? paraInfo(inner) : null };
});

const paragraphs = children.filter((child) => child.type === 'p');
const tables = children.filter((child) => child.type === 'tbl');

/** ops[childIndex] = list of (inner) => inner transforms for that paragraph. */
const ops = new Map();
const note = [];
function addOp(child, fn) {
  const index = children.indexOf(child);
  if (!ops.has(index)) ops.set(index, []);
  ops.get(index).push(fn);
}

/* 1. Headings/title must match the versioned definition (whitespace aside). */
for (const section of sections) {
  for (const block of section.blocks) {
    if (block.kind !== 'title' && block.kind !== 'heading') continue;
    const hit = paragraphs.find((child) => norm(child.info.text) === norm(block.text));
    if (!hit) {
      console.error('paragraph texts:', paragraphs.slice(0, 8).map((p) => JSON.stringify(p.info.text)));
      console.error('want:', JSON.stringify(norm(block.text)));
      fail(`no docx paragraph matches heading "${block.text}"`);
    }
  }
}

/* 2. Fixed prose (Section III) must match the definition exactly. */
for (const target of proseTargets) {
  const block = templateBlock(target.anchor);
  const hits = paragraphs.filter((child) =>
    child.info.text.trim().startsWith(target.anchor),
  );
  if (hits.length !== 1) {
    fail(`expected one paragraph starting with "${target.anchor}", found ${hits.length}`);
  }
  if (target.kind === 'assert-equal' && norm(hits[0].info.text) !== norm(block.text)) {
    fail(`fixed paragraph "${target.anchor}..." drifted from the template definition`);
  }
  if (target.kind === 'rebuild') {
    const child = hits[0];
    addOp(child, (inner) => rebuildParagraph(inner, block.text));
    note.push(`rebuilt paragraph from definition: ${target.anchor}…`);
  }
}

/* 3. Identity fields: token run right after each label. */
const headingIndex = paragraphs.findIndex(
  (child) => norm(child.info.text) === norm('Identifying Information:'),
);
if (headingIndex < 0) fail('no "Identifying Information:" heading');
const insertionsByChild = new Map();
let cursor = headingIndex + 1;
for (const field of identityFields) {
  const labelNorm = norm(field.label);
  let found = null;
  for (let p = cursor; p < paragraphs.length; p += 1) {
    const child = paragraphs[p];
    const { norm: childNorm, idx } = normWithMap(child.info.text);
    const at = childNorm.indexOf(labelNorm);
    if (at < 0) continue;
    const lastRaw = idx[at + labelNorm.length - 1];
    found = { child, lastRaw, next: p };
    break;
  }
  if (!found) fail(`label "${field.label}" not found after the identity heading`);
  const { child, lastRaw } = found;
  cursor = found.next;
  const char = child.info.map[lastRaw];
  if (!char) fail(`label "${field.label}" mapped outside the paragraph`);
  // The token lands right after the run that holds the label's last character;
  // anything left in that run must be trailing whitespace.
  const runChars = child.info.text
    .split('')
    .filter((_, i) => child.info.map[i]?.run === char.run && i > lastRaw);
  if (runChars.some((ch) => !/\s/.test(ch))) {
    fail(`label "${field.label}" is followed by text inside the same run`);
  }
  if (!insertionsByChild.has(child)) insertionsByChild.set(child, []);
  insertionsByChild.get(child).push({ afterRun: char.run, text: ` {{${field.slot}}}` });
}
for (const [child, insertions] of insertionsByChild) {
  addOp(child, (inner) => insertTokenRuns(inner, insertions));
}
note.push(`inserted ${identityFields.length} identity slot tokens`);

/* 4. Date blank → {{report_date}} (the header line, before section I). */
{
  const block = templateBlock('Date: ');
  const hits = paragraphs.filter(
    (child) =>
      child.info.text.includes('_') &&
      norm(child.info.text).startsWith('Date:') &&
      paragraphs.indexOf(child) < headingIndex,
  );
  if (hits.length !== 1) fail(`expected one blank Date paragraph, found ${hits.length}`);
  const child = hits[0];
  const token = block.text.match(/\{\{([a-z0-9_]+)\}\}/)?.[1];
  if (!token) fail('Date template paragraph has no token');
  addOp(child, (inner) => replaceRegexIn(inner, /_{4,}/, `{{${token}}}`));
  note.push('tokenized the Date blank');
}

/* 5. Goal year literal → {{goal_year}}. */
{
  const goalBlock = sections
    .flatMap((section) => section.blocks)
    .find((block) => block.kind === 'goal');
  if (!goalBlock) fail('template has no goal block');
  const token = goalBlock.text.match(/\{\{([a-z0-9_]+)\}\}/)?.[1];
  const value = DEFAULT_REPORT_SETTINGS[`report.${token}`] ?? DEFAULT_REPORT_SETTINGS['report.goal_year'];
  const hits = paragraphs.filter((child) => child.info.text.includes(value));
  if (hits.length !== 1) {
    fail(`expected one paragraph containing the goal-year literal "${value}", found ${hits.length}`);
  }
  const child = hits[0];
  const expected = goalBlock.text.replace(`{{${token}}}`, value);
  if (norm(child.info.text) !== norm(expected)) {
    fail('goal paragraph drifted from the template definition');
  }
  addOp(child, (inner) => replaceLiteralIn(inner, value, `{{${token}}}`));
  note.push('tokenized the goal year');
}

/* 6. Signatories → setting-backed tokens. */
function paragraphContaining(needle) {
  const hits = paragraphs.filter((child) => child.info.text.includes(needle));
  if (hits.length !== 1) {
    fail(`expected one paragraph containing "${needle}", found ${hits.length}`);
  }
  return hits[0];
}
{
  const settings = [
    { needle: 'JAY ANN L. EMBUSCADO', key: 'prepared_by_name', setting: 'report.signatories.prepared_by.name', mode: 'rebuild' },
    { needle: 'City Link', key: 'prepared_by_title', setting: 'report.signatories.prepared_by.title', mode: 'rebuild' },
    { needle: 'MICHAEL ANGELO ADO', key: 'concurred_by_name', setting: 'report.signatories.concurred_by.name', mode: 'literal' },
    { needle: 'LUZ C. FEGARIDO', key: 'approved_by_name', setting: 'report.signatories.approved_by.name', mode: 'literal' },
    { needle: 'Social Welfare Officer III', key: 'concurred_by_title', setting: 'report.signatories.concurred_by.title', mode: 'literal' },
    { needle: 'Provincial Link', key: 'approved_by_title', setting: 'report.signatories.approved_by.title', mode: 'literal' },
  ];
  for (const entry of settings) {
    const child = paragraphContaining(entry.needle);
    const value = DEFAULT_REPORT_SETTINGS[entry.setting] ?? '';
    if (entry.mode === 'rebuild') {
      addOp(child, (inner) => rebuildParagraph(inner, `{{${entry.key}}}`));
    } else {
      if (!value.includes(entry.needle)) {
        fail(`settings value for ${entry.key} does not contain "${entry.needle}"`);
      }
      const valueEnd = value.slice(value.indexOf(entry.needle));
      addOp(child, (inner) => replaceLiteralIn(inner, valueEnd, `{{${entry.key}}}`));
    }
  }
  note.push('tokenized the three signatory blocks');
}
// Signature dates: two underscore lines in one paragraph after the sign-off
// headings, plus the Prepared-by "Date:" line with no underscores at all.
{
  const signStart = paragraphs.findIndex(
    (child) => norm(child.info.text) === norm('Prepared by:'),
  );
  if (signStart < 0) fail('no "Prepared by:" paragraph');
  const dateLines = paragraphs.filter(
    (child) =>
      child.info.text.includes('_') &&
      norm(child.info.text).startsWith('Date:') &&
      paragraphs.indexOf(child) > signStart,
  );
  if (dateLines.length !== 1) fail(`expected one signature-date paragraph, found ${dateLines.length}`);
  const child = dateLines[0];
  addOp(child, (inner) => replaceRegexIn(inner, /_{4,}/, '{{concurred_by_date}}'));
  addOp(child, (inner) => replaceRegexIn(inner, /_{4,}/, '{{approved_by_date}}'));
  const preparedDate = paragraphs.find(
    (child) => norm(child.info.text) === norm('Date:') && paragraphs.indexOf(child) > signStart,
  );
  if (!preparedDate) fail('no Prepared-by "Date:" paragraph');
  addOp(preparedDate, (inner) => {
    const info = paraInfo(inner);
    const lastChar = info.text.length - 1;
    const anchorRun = info.map[lastChar]?.run;
    if (anchorRun === undefined) fail('cannot anchor the prepared-by date token');
    return insertTokenRuns(inner, [{ afterRun: anchorRun, text: ' {{prepared_by_date}}' }]);
  });
  note.push('tokenized the signature dates');
}

/* 7. Family table: header rows kept, one {{#familyComposition}} row. */
const FAMILY_ROW_TOKENS = [
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
/* 8. Intervention table: header kept, one {{#interventions}} row. */
const INTERVENTION_ROW_TOKENS = ['need', 'objective', 'activities', 'responsible', 'timeline', 'remarks'];

function tokenizeTable(tableChild, headerNeedle, headerRowCount, tokens, loopName) {
  const { prefix, suffix, rows } = splitRows(tableChild.xml);
  const headerCells = splitCells(rows[0].xml);
  const headerNorm = headerCells.map((cell) => norm(cellText(cell.xml)));
  if (!headerNorm.includes(norm(headerNeedle))) {
    fail(`table without "${headerNeedle}" header`);
  }
  if (rows.length <= headerRowCount) {
    fail(`table "${headerNeedle}" has no body row to tokenize`);
  }
  const body = rows[headerRowCount];
  const cells = splitCells(body.xml);
  if (cells.length !== tokens.length) {
    fail(
      `table "${headerNeedle}" body row has ${cells.length} cells, expected ${tokens.length}`,
    );
  }
  const newCells = cells.map((cell, index) => {
    let text = `{{${tokens[index]}}}`;
    if (index === 0) text = `{{#${loopName}}}` + text;
    if (index === cells.length - 1) text += `{{/${loopName}}}`;
    return rebuildCell(cell.xml, text);
  });
  let rebuilt = body.xml;
  // Replace cells right-to-left so earlier offsets stay valid.
  for (let index = cells.length - 1; index >= 0; index -= 1) {
    rebuilt =
      rebuilt.slice(0, cells[index].start) + newCells[index] + rebuilt.slice(cells[index].end);
  }
  const headerXml = rows.slice(0, headerRowCount).map((row) => row.xml).join('');
  const newXml = prefix + headerXml + rebuilt + suffix;
  // Table edits replace the whole child element (applied below as-is).
  tableChild.wholeChild = newXml;
  ops.set(children.indexOf(tableChild), []); // mark the child for reassembly
  note.push(
    `table "${headerNeedle}": kept ${headerRowCount} header row(s), ${rows.length - headerRowCount} body row(s) → one {{#${loopName}}} row`,
  );
}
const familyTable = tables.find((table) =>
  norm(cellText(splitRows(table.xml).rows[0].xml).slice(0, 40)).startsWith('Name'),
);
if (!familyTable) fail('family composition table not found');
// Two header rows (Monitored Child spans YES/NO), then the empty data rows.
tokenizeTable(familyTable, 'Name', 2, FAMILY_ROW_TOKENS, 'familyComposition');
const interventionTable = tables.find((table) => table.xml.includes('Need/Problem'));
if (!interventionTable) fail('intervention plan table not found');
tokenizeTable(interventionTable, 'Need/Problem', 1, INTERVENTION_ROW_TOKENS, 'interventions');

/* ------------------------------------------------------- applying edits */

let out = bodyXml;
const edited = [...ops.entries()].sort((a, b) => b[0] - a[0]);
for (const [childIndex, childOps] of edited) {
  const child = children[childIndex];
  let xml = child.wholeChild ?? child.xml;
  if (!child.wholeChild) {
    let inner = child.inner;
    for (const op of childOps) inner = op(inner);
    const open = /^<w:p(?:\s[^>]*)?>/.exec(child.xml)[0];
    xml = `${open}${inner}</w:p>`;
  }
  if (process.env.ANNEX_DEBUG) {
    console.error(
      `apply idx=${childIndex} type=${child.type} span=[${child.start},${child.end}) ops=${childOps.length} braces=${(xml.match(/\{\{/g) || []).length}`,
    );
  }
  out = out.slice(0, child.start) + xml + out.slice(child.end);
}
const newDocXml = docXml.slice(0, bodyOpenEnd) + out + docXml.slice(bodyClose);

/* ---------------------------------------------------------- validation */

const ALLOWED_STRUCTURAL = new Set([
  '#familyComposition',
  '/familyComposition',
  '#interventions',
  '/interventions',
  ...FAMILY_ROW_TOKENS,
  ...INTERVENTION_ROW_TOKENS,
]);
const slotKeys = new Set(SLOT_DEFS.map((def) => def.key));
const tags = [...newDocXml.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map((m) => m[1]);
if (process.env.ANNEX_DEBUG) {
  console.error('ops entries:', ops.size, 'paragraph children:', paragraphs.length, 'tables:', tables.length);
  console.error('table wholeChild set:', tables.map((t) => Boolean(t.wholeChild)));
  console.error('brace count:', (newDocXml.match(/\{\{/g) || []).length, 'tags:', tags.length);
  console.error('tags:', JSON.stringify(tags));
}
for (const tag of tags) {
  if (tag.startsWith('#') || tag.startsWith('/')) {
    if (!ALLOWED_STRUCTURAL.has(tag)) fail(`unexpected loop tag {{${tag}}}`);
    continue;
  }
  if (!slotKeys.has(tag) && !ALLOWED_STRUCTURAL.has(tag)) {
    fail(`unknown tag {{${tag}}} in the generated template`);
  }
}
for (const loop of ['familyComposition', 'interventions']) {
  const opens = tags.filter((tag) => tag === `#${loop}`).length;
  const closes = tags.filter((tag) => tag === `/${loop}`).length;
  if (opens !== 1 || closes !== 1) {
    fail(`loop {{#${loop}}} must appear exactly once (open=${opens}, close=${closes})`);
  }
}
for (const field of identityFields) {
  if (!tags.includes(field.slot)) fail(`identity token {{${field.slot}}} missing from output`);
}
for (const name of FORBIDDEN_STATIC_NAMES) {
  if (newDocXml.includes(name)) {
    fail(`personal name "${name}" survived tokenization (REQ-RPT-014)`);
  }
}
// Header/footer (letterhead, page numbers) are never touched by this script.
for (const part of ['word/header1.xml', 'word/footer1.xml']) {
  if (!zip.file(part)) fail(`${part} missing from the source template`);
}

/* ---------------------------------------------------------------- write */

mkdirSync(dirname(OUTPUT), { recursive: true });
zip.file('word/document.xml', newDocXml);
const outputBytes = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
writeFileSync(OUTPUT, outputBytes);

console.log(`Wrote ${OUTPUT} (${outputBytes.length} bytes, ${tags.length} tags)`);
for (const line of note) console.log(`  - ${line}`);
