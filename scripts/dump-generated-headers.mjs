// One-off: prints header-cell text of both tables in the generated template
// so token order can be verified against FAMILY_COLUMNS / INTERVENTION_COLUMNS.
import { readFileSync } from 'node:fs';
import PizZip from 'pizzip';

const zip = new PizZip(readFileSync('apps/web/src/features/templates/assets/annex-c-car-v1.docx'));
const xml = zip.file('word/document.xml').asText();
const tables = [...xml.matchAll(/<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g)].map((x) => x[0]);
tables.forEach((tbl, ti) => {
  const rows = [...tbl.matchAll(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g)].map((x) => x[0]);
  rows.slice(0, 3).forEach((row, ri) => {
    const cells = [...row.matchAll(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g)].map((c) =>
      [...c[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((t) => t[1]).join(''),
    );
    console.log(`table ${ti} row ${ri}: ${JSON.stringify(cells)}`);
  });
});
