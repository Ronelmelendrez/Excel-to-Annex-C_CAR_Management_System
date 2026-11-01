import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import {
  DOCX_MIME_TYPE,
  inspectDocxTemplate,
  renderDocxSample,
} from "../lib/docx-template";

function createDocxFixture(): ArrayBuffer {
  const zip = new PizZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      "</Types>",
  );
  zip.file(
    "_rels/.rels",
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      "</Relationships>",
  );
  zip.file(
    "word/document.xml",
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      "<w:body>" +
      "<w:p><w:r><w:t>{{CAR_</w:t></w:r><w:r><w:t>REFERENCE}}</w:t></w:r></w:p>" +
      "<w:p><w:r><w:t>{{#familyComposition}}</w:t></w:r></w:p>" +
      "<w:p><w:r><w:t>{{MEMBER_NAME}}</w:t></w:r></w:p>" +
      "<w:p><w:r><w:t>{{/familyComposition}}</w:t></w:r></w:p>" +
      "<w:sectPr/></w:body></w:document>",
  );
  return zip.generate({ type: "arraybuffer" });
}

function withArrayBuffer<T extends Blob>(blob: T): T {
  if (typeof blob.arrayBuffer !== "function") {
    Object.defineProperty(blob, "arrayBuffer", {
      value: () =>
        new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (reader.result instanceof ArrayBuffer) resolve(reader.result);
            else reject(new Error("The test Blob could not be read as an ArrayBuffer."));
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsArrayBuffer(blob);
        }),
    });
  }
  return blob;
}

describe("DOCX template parsing and sample generation", () => {
  it("detects placeholders across Word runs and configured repeating sections", async () => {
    const file = withArrayBuffer(
      new File([createDocxFixture()], "annex-c.docx", { type: DOCX_MIME_TYPE }),
    );

    await expect(inspectDocxTemplate(file)).resolves.toEqual({
      placeholders: ["CAR_REFERENCE", "MEMBER_NAME"],
      repeatingSections: ["familyComposition"],
    });
  });

  it("renders a real DOCX sample using only fabricated configured values", async () => {
    const blob = withArrayBuffer(
      await renderDocxSample(
        createDocxFixture(),
        [
          {
            id: "car",
            placeholder: "CAR_REFERENCE",
            fieldKey: "car.reference",
            required: true,
          },
          {
            id: "member",
            placeholder: "MEMBER_NAME",
            fieldKey: "family.memberName",
            required: true,
          },
        ],
        [
          {
            id: "family",
            label: "Family composition rows",
            enabled: true,
            required: true,
            collectionKey: "familyComposition",
            sectionTag: "familyComposition",
          },
        ],
        {
          "car.reference": "CAR-SAMPLE-001",
          "family.memberName": "Sample Member",
        },
      ),
    );
    const output = new PizZip(new Uint8Array(await blob.arrayBuffer()));
    const xml = output.file("word/document.xml")?.asText() ?? "";

    expect(blob.type).toBe(DOCX_MIME_TYPE);
    expect(xml).toContain("CAR-SAMPLE-001");
    expect(xml).toContain("Sample Member");
    expect(xml).not.toContain("{{");
  });

  it("rejects a file that is not a readable DOCX archive", async () => {
    const file = withArrayBuffer(
      new File(["not a zip"], "broken.docx", { type: DOCX_MIME_TYPE }),
    );

    await expect(inspectDocxTemplate(file)).rejects.toThrow("not a readable Word .docx");
  });
});
