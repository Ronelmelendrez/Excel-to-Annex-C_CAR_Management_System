// One-off diagnostic: prints every paragraph/table-row of the Annex C source
// template as a run-by-run breakdown (text runs + tabs) so the tokenizer can be
// written against the real structure. Run: node scripts/dump-annex-c.mjs
import { readFileSync } from 'node:fs';
import PizZip from 'pizzip';

const file = 'Annex C CASE STUDY REPORT FOR ACTIVE OR LEVEL 2.docx';
const zip = new PizZip(readFileSync(file));
const xml = zip.file('word/document.xml').asText();

function runsOf(inner) {
  const out = [];
  const runRe = /<w:r(?: [^>]*)?>([\s\S]*?)<\/w:r>|<w:r\/>/g;
  let m;
  while ((m = runRe.exec(inner))) {
    if (!m[1]) {
      out.push('<empty-run/>');
      continue;
    }
    const parts = [];
    const partRe = /<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>|<w:cr\/>/g;
    let p;
    while ((p = partRe.exec(m[1]))) {
      if (p[1] !== undefined) parts.push(`T"${decode(p[1])}"`);
      else if (p[0] === '<w:tab/>') parts.push('TAB');
      else parts.push(p[0] === '<w:br/>' ? 'BR' : 'CR');
    }
    if (parts.length) out.push(parts.join(' + '));
  }
  return out;
}

function decode(v) {
  return v.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

// walk body children
const bodyRe = /<w:body>([\s\S]*)<\/w:body>/;
const body = bodyRe.exec(xml)[1];
const childRe = /<w:p(?: [^>]*)?>[\s\S]*?<\/w:p>|<w:p\/>|<w:tbl(?: [^>]*)?>[\s\S]*?<\/w:tbl>|<w:sectPr[\s\S]*?\/>|<w:sectPr(?: [^>]*)?>[\s\S]*?<\/w:sectPr>/g;
let c;
let index = 0;
while ((c = childRe.exec(body))) {
  const node = c[0];
  if (node.startsWith('<w:p')) {
    const inner = node.replace(/^<w:p(?: [^>]*)?>/, '').replace(/<\/w:p>$/, '');
    const runs = runsOf(inner);
    console.log(`P${index}: ${JSON.stringify(runs)}`);
  } else if (node.startsWith('<w:tbl')) {
    console.log(`TBL${index}:`);
    const trRe = /<w:tr(?: [^>]*)?>[\s\S]*?<\/w:tr>/g;
    let t;
    let row = 0;
    while ((t = trRe.exec(node))) {
      const cells = [];
      const tcRe = /<w:tc(?: [^>]*)?>[\s\S]*?<\/w:tc>/g;
      let k;
      while ((k = tcRe.exec(t[0]))) {
        const cellRuns = [];
        const pRe = /<w:p(?: [^>]*)?>[\s\S]*?<\/w:p>|<w:p\/>/g;
        let q;
        while ((q = pRe.exec(k[0]))) {
          const inner = q[0].replace(/^<w:p(?: [^>]*)?>/, '').replace(/<\/w:p>$/, '');
          cellRuns.push(runsOf(inner));
        }
        cells.push(cellRuns);
      }
      console.log(`  R${row}: ${JSON.stringify(cells)}`);
      row++;
    }
  } else {
    console.log(`OTHER${index}: ${node.slice(0, 60)}`);
  }
  index++;
}
