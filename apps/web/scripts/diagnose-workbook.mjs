#!/usr/bin/env node
/**
 * Diagnose why a workbook's worksheet cannot be read by SheetJS.
 *
 * The importer shows a generic "could not be read" notice because SheetJS
 * swallows per-sheet parse errors. This script re-runs the read with WTF
 * mode (which rethrows), inspects the zip contents, and tests every rescue
 * mode the app tries — so we can see the exact reason and fix it.
 *
 * Usage:
 *   node scripts/diagnose-workbook.mjs "C:\path\to\workbook.xlsx"
 *   node scripts/diagnose-workbook.mjs            # uses the first file in ../fixtures
 *
 * Paste the full output into the chat.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const here = dirname(fileURLToPath(import.meta.url));

function findFile() {
  const arg = process.argv[2];
  if (arg) return resolve(arg);
  const dir = join(here, "..", "fixtures");
  if (existsSync(dir)) {
    const found = readdirSync(dir).find((f) => /\.(xlsx|xlsm|xls)$/i.test(f));
    if (found) return join(dir, found);
  }
  console.error("Usage: node scripts/diagnose-workbook.mjs <path-to-workbook.xlsx>");
  console.error(`(or place a workbook in ${dir})`);
  process.exit(1);
}

function toArrayBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

const RESCUE_MODES = [
  ["default", {}],
  ["raw", { raw: true }],
  ["cellText", { cellText: true }],
  ["cellText+raw", { cellText: true, raw: true }],
  ["sheetStubs", { sheetStubs: true }],
  ["sheetStubs+cellText", { sheetStubs: true, cellText: true }],
];

const file = findFile();
const bytes = readFileSync(file);
console.log("=== Workbook diagnostic ===");
console.log(`File:      ${file}`);
console.log(`Size:      ${bytes.length} bytes`);

const buffer = toArrayBuffer(bytes);

// 1. Baseline read (what the app does first).
let base = null;
let baseError = null;
try {
  base = XLSX.read(buffer, { type: "array" });
} catch (error) {
  baseError = error?.message ?? String(error);
}
console.log(`\n1) Baseline read: ${base ? "OK" : "FAILED — " + baseError}`);

if (base) {
  console.log(`   Declared sheets: ${JSON.stringify(base.SheetNames)}`);
  for (const name of base.SheetNames) {
    const present = Boolean(base.Sheets?.[name]);
    const ref = present ? base.Sheets[name]["!ref"] ?? "(no !ref — empty)" : "(no sheet object)";
    console.log(`   - ${name}: ${present ? `readable, ref=${ref}` : "MISSING — this is the unreadable one"}`);
  }

  // 2. What is actually inside the zip.
  console.log("\n2) Zip contents (worksheet parts):");
  try {
    const probe = XLSX.read(buffer, { type: "array", bookFiles: true });
    const keys = Array.isArray(probe.keys)
      ? probe.keys
      : probe.files
        ? Object.keys(probe.files)
        : [];
    const sheetParts = keys.filter((k) => /xl\/(worksheets|chartsheets|dialogsheets|macrosheets)\/[^/]+$/i.test(k));
    console.log(sheetParts.length ? sheetParts.map((k) => `   - ${k}`).join("\n") : "   (no worksheet parts found)");
    const missing = base.SheetNames.length - sheetParts.length;
    if (missing > 0) {
      console.log(`   !! Workbook declares ${base.SheetNames.length} sheets but the zip holds only ${sheetParts.length} sheet part(s) — a part is missing from the file.`);
    }
  } catch (error) {
    console.log(`   (zip listing failed: ${error?.message ?? error})`);
  }

  // 3. Per-sheet WTF read: SheetJS hides the real error unless WTF is set.
  console.log("\n3) Strict (WTF) per-sheet read:");
  for (const name of base.SheetNames) {
    if (base.Sheets?.[name]) {
      console.log(`   - ${name}: fine, skipping`);
      continue;
    }
    try {
      XLSX.read(buffer, { type: "array", WTF: true, sheets: [name] });
      console.log(`   - ${name}: WTF read produced NO error, yet the sheet object is missing.`);
      console.log("     Likely cause: the sheet is a chart/dialog/macro sheet (it has no cells),");
      console.log("     or its worksheet part is missing from the zip.");
    } catch (error) {
      console.log(`   - ${name}: THROWS -> ${error?.message ?? error}`);
      console.log("     (this is the reason the app cannot read the sheet)");
    }
  }

  // 4. Rescue matrix: does any mode the app can use bring the sheet back?
  console.log("\n4) Rescue modes:");
  const unreadable = base.SheetNames.filter((n) => !base.Sheets?.[n]);
  if (!unreadable.length) {
    console.log("   All sheets read in baseline mode.");
  }
  for (const name of unreadable) {
    console.log(`   ${name}:`);
    for (const [label, mode] of RESCUE_MODES) {
      try {
        const wb = XLSX.read(buffer, { type: "array", ...mode, sheets: [name] });
        console.log(`     - ${label}: ${wb.Sheets?.[name] ? "RESCUED" : "no effect"}`);
      } catch (error) {
        console.log(`     - ${label}: threw (${error?.message ?? error})`);
      }
    }
  }
}

console.log("\n=== Paste this whole output into the chat ===");
