import { describe, expect, it } from "vitest"

import {
  attachmentAlignmentInput,
  discoverProductChatAttachmentResources,
  isIgnoredRecursiveProductChatEntry,
  portableAttachmentMetadata,
  readProductChatAttachments,
  type ProductChatAttachmentNode,
  type ProductChatAttachmentResource,
} from "./product-chat-attachments.js"

function resource(label: string, path: string, content: string, scheme = "file"): ProductChatAttachmentResource {
  return { label, path, scheme, read: async () => new TextEncoder().encode(content) }
}

function node(
  label: string,
  kind: "file" | "directory" | "symbolic-link" | "other",
  children: ProductChatAttachmentNode[] = [],
  content = `${label} content`,
): ProductChatAttachmentNode {
  return {
    label,
    path: `/machine-private/${label}`,
    scheme: "file",
    read: async () => new TextEncoder().encode(content),
    kind: async () => kind,
    children: async () => children,
  }
}

describe("Product Chat attachment intake", () => {
  it("reads bounded explicit text references and exposes no machine path in portable metadata", async () => {
    const batch = await readProductChatAttachments([
      resource("Product/requirements.md", "/Users/private/Product/requirements.md", "# Requirements\nA governed scheduling workflow."),
    ])
    expect(batch).toMatchObject({ totalBytes: 46, rejected: [] })
    expect(batch.candidates[0]).toMatchObject({
      label: "Product/requirements.md",
      format: "md",
      contentDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
    })
    expect(JSON.stringify(portableAttachmentMetadata(batch))).not.toContain("/Users/private")
    expect(attachmentAlignmentInput(batch)).toContain("A governed scheduling workflow")
  })

  it("rejects unsupported, binary, and oversized resources without partial authority claims", async () => {
    const binary: ProductChatAttachmentResource = {
      label: "Product/binary.md",
      path: "/tmp/binary.md",
      scheme: "file",
      read: async () => Uint8Array.from([0xff, 0xfe, 0xfd]),
    }
    const batch = await readProductChatAttachments([
      resource("remote.md", "remote.md", "remote", "https"),
      resource("Product/design.pdf", "/tmp/design.pdf", "not parsed"),
      binary,
      resource("Product/large.md", "/tmp/large.md", "x".repeat(128)),
    ], { perFileBytes: 64, totalBytes: 128, files: 20 })
    expect(batch.candidates).toEqual([])
    expect(batch.rejected).toEqual([
      { label: "remote.md", reason: "unsupported-scheme" },
      { label: "Product/design.pdf", reason: "unsupported-format" },
      { label: "Product/binary.md", reason: "not-utf8" },
      { label: "Product/large.md", reason: "too-large" },
    ])
  })

  it("recursively discovers a folder deterministically while rejecting symlinks and unsupported members", async () => {
    const root = node("Product Docs", "directory", [
      node("Product Docs/roles.xlsx", "file"),
      node("Product Docs/z.md", "file"),
      node("Product Docs/archive.zip", "file"),
      node("Product Docs/nested", "directory", [
        node("Product Docs/nested/brief.docx", "file"),
        node("Product Docs/nested/requirements.md", "file"),
        node("Product Docs/nested/link.md", "symbolic-link"),
      ]),
      node("Product Docs/a.txt", "file"),
    ])
    const discovered = await discoverProductChatAttachmentResources([root])
    expect(discovered.resources.map((candidate) => candidate.label)).toEqual([
      "Product Docs/a.txt",
      "Product Docs/nested/brief.docx",
      "Product Docs/nested/requirements.md",
      "Product Docs/roles.xlsx",
      "Product Docs/z.md",
    ])
    expect(discovered.rejected).toEqual([
      { label: "Product Docs/archive.zip", reason: "unsupported-format" },
      { label: "Product Docs/nested/link.md", reason: "symbolic-link" },
    ])
    expect(discovered.resources).toHaveLength(5)
  })

  it("excludes common editor, VCS, dependency, and OS metadata from recursive Product evidence", async () => {
    const root = node("Product Docs", "directory", [
      node("Product Docs/.idea", "directory", [node("Product Docs/.idea/workspace.xml", "file")]),
      node("Product Docs/.git", "directory", [node("Product Docs/.git/config", "file")]),
      node("Product Docs/.vscode", "directory", [node("Product Docs/.vscode/settings.json", "file")]),
      node("Product Docs/node_modules", "directory", [node("Product Docs/node_modules/readme.md", "file")]),
      node("Product Docs/.DS_Store", "file"),
      node("Product Docs/requirements.md", "file"),
    ])

    const discovered = await discoverProductChatAttachmentResources([root])

    expect(discovered.resources.map((candidate) => candidate.label)).toEqual(["Product Docs/requirements.md"])
    expect(discovered.rejected).toEqual([
      { label: "Product Docs/.DS_Store", reason: "ignored-system-metadata" },
      { label: "Product Docs/.git", reason: "ignored-system-metadata" },
      { label: "Product Docs/.idea", reason: "ignored-system-metadata" },
      { label: "Product Docs/.vscode", reason: "ignored-system-metadata" },
      { label: "Product Docs/node_modules", reason: "ignored-system-metadata" },
    ])
    expect(isIgnoredRecursiveProductChatEntry("/workspace/.idea", "directory")).toBe(true)
    expect(isIgnoredRecursiveProductChatEntry("/workspace/design", "directory")).toBe(false)
  })

  it("fails bounded when recursive folder discovery exceeds the selected file limit", async () => {
    const root = node("Large Folder", "directory", [
      node("Large Folder/a.md", "file"),
      node("Large Folder/b.md", "file"),
      node("Large Folder/c.md", "file"),
    ])
    const discovered = await discoverProductChatAttachmentResources([root], { depth: 8, entries: 20, files: 2 })
    expect(discovered.resources.map((candidate) => candidate.label)).toEqual([
      "Large Folder/a.md",
      "Large Folder/b.md",
    ])
    expect(discovered.rejected).toContainEqual({ label: "Large Folder/c.md", reason: "selection-limit" })
  })
})
