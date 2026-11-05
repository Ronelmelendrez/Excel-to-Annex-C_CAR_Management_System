// One-off diagnostic: table structure (cell counts, gridSpan, vMerge) of both
// tables in the Annex C source template.
import { readFileSync } from 'node:fs';
import PizZip from 'pizzip';

const zip = new PizZip(readFileSync('Annex C CASE STUDY REPORT FOR ACTIVE OR LEVEL 2.docx'));
const xml = zip.file('word/document.xml').asText();
const tables = [...xml.matchAll(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g)].map((x) => x[0]);
tables.forEach((tbl, ti) => {
  const rows = [...tbl.matchAll(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g)].map((x) => x[0]);
  rows.forEach((row, ri) => {
    const cells = [...row.matchAll(/<w:tc(?:\s[^>]*)?>/g)].length;
    const gs = [...row.matchAll(/<w:gridSpan w:val="(\d+)"\/>/g)].map((x) => x[1]);
    const vm = [...row.matchAll(/<w:vMerge(?: w:val="(\w+)")?\/>/g)].map(
      (x) => x[1] ?? 'continue',
    );
    console.log(`table ${ti} row ${ri}: cells=${cells} gridSpan=${JSON.stringify(gs)} vMerge=${JSON.stringify(vm)}`);
  });
});
