import type { RepeatingTableConfig, TemplateFieldMapping } from "../types";

export const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type InspectedTemplate = {
  placeholders: string[];
  repeatingSections: string[];
};

function decodeXmlText(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function textFromWordXml(xml: string): string {
  return decodeXmlText(
    xml
      .replace(/<\/w:p>/gi, "\n")
      .replace(/<\/w:tc>/gi, "\n")
      .replace(/<\/w:tr>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  );
}

async function loadDocxLibraries() {
  const [docxtemplaterModule, pizzipModule] = await Promise.all([
    import("docxtemplater"),
    import("pizzip"),
  ]);
  return {
    Docxtemplater: docxtemplaterModule.default,
    PizZip: pizzipModule.default,
  };
}

function makeZip(PizZip: typeof import("pizzip").default, bytes: ArrayBuffer) {
  try {
    const zip = new PizZip(new Uint8Array(bytes));
    if (!zip.file("word/document.xml")) {
      throw new Error("The .docx file does not contain a Word document.");
    }
    return zip;
  } catch (error) {
    if (error instanceof Error && error.message.includes("does not contain")) throw error;
    throw new Error("This file is not a readable Word .docx document.");
  }
}

export async function inspectDocxTemplate(file: File): Promise<InspectedTemplate> {
  const { Docxtemplater, PizZip } = await loadDocxLibraries();
  const zip = makeZip(PizZip, await file.arrayBuffer());
  const texts = zip
    .file(/^word\/.*\.xml$/)
    .map((entry) => textFromWordXml(entry.asText()))
    .join("\n");
  const tags = [...texts.matchAll(/\{\{\s*([#/^]?)([A-Za-z0-9_.-]+)\s*\}\}/g)];
  const placeholders = new Map<string, string>();
  const repeatingSections = new Set<string>();

  for (const tag of tags) {
    const marker = tag[1];
    const name = tag[2];
    if (marker === "#") {
      repeatingSections.add(name);
    } else if (marker !== "/" && marker !== "^") {
      const key = name.toLocaleUpperCase();
      if (!placeholders.has(key)) placeholders.set(key, name);
    }
  }

  try {
    new Docxtemplater(zip, {
      delimiters: { start: "{{", end: "}}" },
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => "",
    });
  } catch {
    throw new Error("The Word template contains invalid or unbalanced placeholder tags.");
  }

  return {
    placeholders: [...placeholders.values()],
    repeatingSections: [...repeatingSections],
  };
}

export async function renderDocxSample(
  bytes: ArrayBuffer,
  mappings: TemplateFieldMapping[],
  repeatingTables: RepeatingTableConfig[],
  sampleValues: Record<string, string>,
): Promise<Blob> {
  try {
    const { Docxtemplater, PizZip } = await loadDocxLibraries();
    const zip = makeZip(PizZip, bytes);
    const fields = Object.fromEntries(
      mappings.map((mapping) => [
        mapping.placeholder,
        sampleValues[mapping.fieldKey] ?? "",
      ]),
    );
    const data: Record<string, unknown> = { ...fields };
    for (const table of repeatingTables) {
      if (table.enabled && table.collectionKey) {
        data[table.sectionTag ?? table.collectionKey] = [{ ...fields }];
      }
    }

    const document = new Docxtemplater(zip, {
      delimiters: { start: "{{", end: "}}" },
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => "",
    });
    document.render(data);
    return document.getZip().generate({
      type: "blob",
      mimeType: DOCX_MIME_TYPE,
    });
  } catch {
    throw new Error("The DOCX sample could not be generated. Check the template placeholders and repeating sections.");
  }
}

export function downloadDocxSample(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName.replace(/\.docx$/i, "")}-sample.docx`;
  link.click();
  URL.revokeObjectURL(url);
}
