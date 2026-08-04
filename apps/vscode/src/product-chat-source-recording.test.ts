import { describe, expect, it } from "vitest"

import { candidateSourceRecordInput, recordExactCandidateSources } from "./product-chat-source-recording.js"

const digest = `sha256:${"a".repeat(64)}` as const

describe("Product Chat candidate Source recording", () => {
  it("creates a fail-closed non-authoritative Source input from exact attachment metadata", () => {
    const input = candidateSourceRecordInput({
      initiativeId: "00000000-0000-4000-8000-000000000001",
      actorId: "local-product-owner",
      assessedAt: "2026-08-02T19:00:00.000Z",
      source: {
        label: "requirements.docx",
        format: "docx",
        extraction: "docx-ooxml",
        byteLength: 1024,
        contentDigest: digest,
        limitations: ["Images were not imported."],
      },
    })

    expect(input).toMatchObject({
      sourceType: "other",
      title: "requirements.docx",
      contentDigest: digest,
      revisionIdentity: { kind: "content-version", value: digest },
      owner: { kind: "unassigned" },
      semanticAuthority: {
        standing: "non-authoritative",
        declaredBy: { kind: "human", id: "local-product-owner" },
      },
      knowledgeDisposition: "unknown",
      trust: { sourceAuthenticity: "unknown", contentIntegrity: "verified" },
      informationClassification: "restricted",
      rights: { status: "unknown" },
      freshness: { status: "unknown" },
      availability: { status: "available" },
    })
    expect(input.locator).toEqual({ kind: "logical", value: `product-chat.attachment.${"a".repeat(64)}` })
    expect(input.limitations).toContain("Images were not imported.")
    expect(input.limitations.join(" ")).toContain("non-authoritative candidate")
  })

  it("uses a portable digest title when an attachment label is too short", () => {
    const input = candidateSourceRecordInput({
      initiativeId: "00000000-0000-4000-8000-000000000001",
      actorId: "local-product-owner",
      assessedAt: "2026-08-02T19:00:00.000Z",
      source: { label: "x", format: "txt", byteLength: 1, contentDigest: digest },
    })
    expect(input.title).toBe("Candidate source aaaaaaaaaaaa")
  })

  it("records each exact content digest once and reuses an existing Source on retry", async () => {
    const secondDigest = `sha256:${"b".repeat(64)}` as const
    const created: string[] = []
    const result = await recordExactCandidateSources({
      initiativeId: "00000000-0000-4000-8000-000000000001",
      actorId: "local-product-owner",
      assessedAt: "2026-08-02T19:00:00.000Z",
      sources: [
        { label: "copy.docx", format: "docx", byteLength: 1024, contentDigest: digest },
        { label: "requirements.docx", format: "docx", byteLength: 1024, contentDigest: digest },
        { label: "decisions.xlsx", format: "xlsx", byteLength: 2048, contentDigest: secondDigest },
      ],
      existing: [{ id: "source-a", title: "Earlier exact source", contentDigest: digest }],
      create: async (source) => {
        created.push(source.contentDigest)
        return { id: "source-b", title: source.title, contentDigest: source.contentDigest }
      },
    })

    expect(result.reused).toEqual([{ id: "source-a", title: "Earlier exact source", contentDigest: digest }])
    expect(result.recorded).toHaveLength(1)
    expect(created).toEqual([secondDigest])
  })
})
