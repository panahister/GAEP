import JSZip from "jszip"
import { describe, expect, it } from "vitest"

import {
  extractProductChatOfficeAttachment,
  ProductChatOfficeExtractionError,
} from "./product-chat-office-extraction.js"
import { readProductChatAttachments, type ProductChatAttachmentResource } from "./product-chat-attachments.js"

async function archive(entries: Record<string, string | Uint8Array>): Promise<Uint8Array> {
  const zip = new JSZip()
  for (const [name, content] of Object.entries(entries)) zip.file(name, content)
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 9 } })
}

function resource(label: string, path: string, bytes: Uint8Array): ProductChatAttachmentResource {
  return { label, path, scheme: "file", read: async () => bytes }
}

const docxContentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`

const xlsxContentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
</Types>`

describe("Product Chat bounded Office extraction", () => {
  it("extracts DOCX paragraphs and table cells while ignoring embedded binary content", async () => {
    const bytes = await archive({
      "[Content_Types].xml": docxContentTypes,
      "word/document.xml": `<?xml version="1.0" encoding="UTF-8"?>
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
          <w:p><w:r><w:t>Voyage scheduling requirements</w:t></w:r></w:p>
          <w:tbl><w:tr><w:tc><w:p><w:r><w:t>Owner</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Product Manager</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
        </w:body></w:document>`,
      "word/header1.xml": `<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>Controlled source</w:t></w:r></w:p></w:hdr>`,
      "word/embeddings/object.bin": Uint8Array.from([0, 1, 2, 3]),
    })
    const batch = await readProductChatAttachments([
      resource("Product Docs/requirements.docx", "/machine/private/requirements.docx", bytes),
    ])
    expect(batch.rejected).toEqual([])
    expect(batch.candidates[0]).toMatchObject({
      format: "docx",
      extraction: "docx-ooxml",
      limitations: [expect.stringContaining("embedded objects")],
      contentDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
    })
    expect(batch.candidates[0]?.text).toContain("Voyage scheduling requirements")
    expect(batch.candidates[0]?.text).toContain("Owner")
    expect(batch.candidates[0]?.text).toContain("Product Manager")
    expect(batch.candidates[0]?.text).toContain("Controlled source")
    expect(batch.candidates[0]?.text).not.toContain("machine/private")

    const aggregateLimited = await readProductChatAttachments([
      resource("Product Docs/requirements.docx", "/machine/private/requirements.docx", bytes),
    ], { perFileBytes: 256 * 1_024, totalBytes: 1024 * 1_024, files: 10, extractedCharacters: 16 })
    expect(aggregateLimited.candidates).toEqual([])
    expect(aggregateLimited.rejected).toEqual([
      { label: "Product Docs/requirements.docx", reason: "office-resource-limit" },
    ])
  })

  it("extracts XLSX sheet cells and formula text without executing the formula", async () => {
    const bytes = await archive({
      "[Content_Types].xml": xlsxContentTypes,
      "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8"?>
        <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
          <sheets><sheet name="Role Mapping" sheetId="1" r:id="rId1"/></sheets>
        </workbook>`,
      "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/xl/worksheets/sheet1.xml"/>
        </Relationships>`,
      "xl/sharedStrings.xml": `<?xml version="1.0" encoding="UTF-8"?>
        <sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Role</t></si><si><t>Solution Architect</t></si></sst>`,
      "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8"?>
        <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
          <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
          <row r="2"><c r="A2"><f>SUM(1,2)</f><v>3</v></c><c r="B2" t="inlineStr"><is><t>Security review</t></is></c></row>
        </sheetData></worksheet>`,
      "xl/externalLinks/externalLink1.xml": `<externalLink>ignored</externalLink>`,
    })
    const extraction = extractProductChatOfficeAttachment("xlsx", bytes)
    expect(extraction.extraction).toBe("xlsx-ooxml")
    expect(extraction.text).toContain("## Sheet: Role Mapping")
    expect(extraction.text).toContain("A1 = Role")
    expect(extraction.text).toContain("B1 = Solution Architect")
    expect(extraction.text).toContain("A2 = =SUM(1,2) [cached: 3]")
    expect(extraction.text).toContain("B2 = Security review")
    expect(extraction.text).not.toContain("externalLink")
    expect(extraction.limitations[0]).toContain("formulas were not executed")
  })

  it("rejects malformed Office packages and compressed expansion beyond the entry limit", async () => {
    const disguised = await archive({ "[Content_Types].xml": "<Types/>" })
    expect(() => extractProductChatOfficeAttachment("docx", disguised)).toThrow(ProductChatOfficeExtractionError)

    const oversized = await archive({
      "[Content_Types].xml": docxContentTypes,
      "word/document.xml": `<w:document>${"x".repeat(2 * 1_024 * 1_024 + 1)}</w:document>`,
    })
    try {
      extractProductChatOfficeAttachment("docx", oversized)
      throw new Error("Expected extraction to fail")
    } catch (error) {
      expect(error).toBeInstanceOf(ProductChatOfficeExtractionError)
      expect((error as ProductChatOfficeExtractionError).reason).toBe("office-resource-limit")
    }
  })
})
