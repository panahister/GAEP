import { describe, expect, it } from "vitest"

import {
  defaultSourceUnderstandingInstruction,
  isImplicitChatInstructionReference,
  markdownTable,
  nonWrappingTableLabel,
  sourceAdvisorFailureMarkdown,
  sourceAlignmentNextCheckpoint,
  sourceAlignmentTableRows,
  sourceIntakeManifestSummary,
  sourceReviewCacheKey,
  sourceUnderstandingInstruction,
} from "./product-chat-source-intake.js"

describe("Product Chat Source Intake UX", () => {
  it("uses the human file task instead of silently replacing it with lifecycle alignment", () => {
    expect(sourceUnderstandingInstruction("describe the attachment file")).toBe("describe the attachment file")
    expect(sourceUnderstandingInstruction("  ")).toBe(defaultSourceUnderstandingInstruction)
    expect(defaultSourceUnderstandingInstruction).toContain("do not perform GAEP lifecycle alignment")
  })

  it("excludes implicit instruction files while preserving explicit textual references", () => {
    expect(isImplicitChatInstructionReference({ id: "vscode.instructions", path: "/workspace/CLAUDE.md" })).toBe(true)
    expect(isImplicitChatInstructionReference({ id: "vscode.file", path: "/workspace/CLAUDE.md" })).toBe(true)
    expect(isImplicitChatInstructionReference({
      id: "vscode.file",
      path: "/workspace/CLAUDE.md",
      range: [0, 12],
    })).toBe(false)
    expect(isImplicitChatInstructionReference({ id: "vscode.file", path: "/outside/requirements.docx" })).toBe(false)
  })

  it("creates an order-independent cache key for the exact candidate source set", () => {
    expect(sourceReviewCacheKey(["sha256:b", "sha256:a"])).toBe(sourceReviewCacheKey(["sha256:a", "sha256:b"]))
    expect(sourceReviewCacheKey(["sha256:a"])).not.toBe(sourceReviewCacheKey(["sha256:b"]))
  })

  it("summarizes included, duplicate, and excluded candidates before recording", () => {
    expect(sourceIntakeManifestSummary({
      sources: [
        { byteLength: 10, contentDigest: "sha256:a" },
        { byteLength: 10, contentDigest: "sha256:a" },
        { byteLength: 20, contentDigest: "sha256:b" },
      ],
      rejected: [
        { reason: "unsupported-format" },
        { reason: "ignored-system-metadata" },
        { reason: "unsupported-format" },
      ],
    })).toEqual({
      includedFiles: 3,
      uniqueContentDigests: 2,
      duplicateContentInstances: 1,
      excludedEntries: 3,
      totalCandidateBytes: 40,
      exclusionsByReason: [
        { reason: "ignored-system-metadata", count: 1 },
        { reason: "unsupported-format", count: 2 },
      ],
    })
  })

  it("renders compact Markdown tables without breaking on pipes or multiline cells", () => {
    expect(markdownTable(
      ["Checkpoint", "Evidence"],
      [["Product Definition", "Vision | Requirements\nConflict retained"]],
    )).toBe([
      "| Checkpoint | Evidence |",
      "| --- | --- |",
      "| Product Definition | Vision \\| Requirements<br>Conflict retained |",
    ].join("\n"))
  })

  it("keeps compact field labels on one readable line in constrained Chat tables", () => {
    expect(nonWrappingTableLabel("One-sentence summary")).toBe("One\u2011sentence\u00a0summary")
    expect(nonWrappingTableLabel("Product name")).toBe("Product\u00a0name")
  })

  it("normalizes the seven lifecycle alignment rows into a stable decision table", () => {
    const proposal = [
      "Product Definition: partially-supported (authority: candidate) — Requirements supports scope; ERP shell conflicts.",
      "Initiative Definition: supported (authority: baselined) — Exact revision and digest match.",
      "Classification: unsupported (authority: candidate) — Explicit classification evidence is missing.",
      "Applicability: partially-supported (authority: reviewed) — MVP boundaries exist; one condition is open.",
      "Source Intake: supported (authority: reviewed) — Exact candidate set was reviewed.",
      "Source Baseline: supported (authority: baselined) — No source drift was detected.",
      "Source Provenance: partially-supported (authority: candidate) — External authorship is missing.",
      "Next checkpoint: Classification — resolve the standalone-versus-module conflict.",
    ].join("\n")
    const rows = sourceAlignmentTableRows(proposal)
    expect(rows).toHaveLength(7)
    expect(rows[0]).toEqual({
      checkpoint: "Product Definition",
      alignment: "partially-supported",
      authority: "candidate",
      evidenceAndGap: "Requirements supports scope; ERP shell conflicts.",
    })
    expect(rows[6]?.evidenceAndGap).toBe("External authorship is missing.")
    expect(sourceAlignmentNextCheckpoint(proposal)).toBe("Classification — resolve the standalone-versus-module conflict.")
  })

  it("keeps a missing advisor checkpoint visible instead of silently dropping it", () => {
    const rows = sourceAlignmentTableRows("Product Definition: supported (authority: candidate) — Scope is described.")
    expect(rows.find((row) => row.checkpoint === "Classification")).toEqual({
      checkpoint: "Classification",
      alignment: "Not returned",
      authority: "Not returned",
      evidenceAndGap: "The advisor response did not contain this required checkpoint row.",
    })
  })

  it("renders authentication failure as an unavailable operation rather than a document answer", () => {
    const markdown = sourceAdvisorFailureMarkdown({
      advisorLabel: "Claude Code · Sonnet alias",
      error: new Error("Claude Code authentication is unavailable for the governed advisory turn."),
      priorReviewPreserved: true,
    })
    expect(markdown).toContain("# Attachment answer unavailable")
    expect(markdown).toContain("could not authenticate")
    expect(markdown).toContain("last successful attachment review remains available")
    expect(markdown).toContain("No document answer or review note was generated")
    expect(markdown).not.toContain("## Answer")
  })
})
