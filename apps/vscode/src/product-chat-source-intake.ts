import { createHash } from "node:crypto"
import { basename } from "node:path"

export const defaultSourceUnderstandingInstruction = [
  "Explain the attached Product documents in plain language.",
  "Summarize their purpose, important content, decisions, constraints, risks, and open questions.",
  "Use the document content directly and do not perform GAEP lifecycle alignment unless the human explicitly asks for alignment.",
].join(" ")

export interface ProductChatReferenceDescriptor {
  id: string
  modelDescription?: string
  path: string
  range?: readonly [number, number]
}

const instructionBasenames = new Set([
  "agents.md",
  "claude.md",
  "copilot-instructions.md",
])

/**
 * VS Code may surface automatically-applied instruction files in ChatRequest.references.
 * They are model context, not human-selected Product evidence. A textual # reference is
 * explicit and remains eligible; GAEP's own Choose File/Folder selections bypass this filter.
 */
export function isImplicitChatInstructionReference(reference: ProductChatReferenceDescriptor): boolean {
  if (reference.range) return false
  const identity = `${reference.id} ${reference.modelDescription ?? ""}`.toLowerCase()
  const name = basename(reference.path).toLowerCase()
  return identity.includes("instruction") || instructionBasenames.has(name)
}

export function sourceReviewCacheKey(digests: readonly string[]): string {
  return createHash("sha256").update([...digests].sort().join("\n")).digest("hex")
}

export function sourceUnderstandingInstruction(prompt: string): string {
  const instruction = prompt.trim()
  return instruction || defaultSourceUnderstandingInstruction
}

export interface SourceIntakeManifestSummary {
  includedFiles: number
  uniqueContentDigests: number
  duplicateContentInstances: number
  excludedEntries: number
  totalCandidateBytes: number
  exclusionsByReason: Array<{ reason: string; count: number }>
}

export interface SourceAlignmentTableRow {
  checkpoint: string
  alignment: string
  authority: string
  evidenceAndGap: string
}

export function markdownTable(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const normalizedRows = rows.map((row) => headers.map((_, index) => markdownTableCell(row[index] ?? "")))
  return [
    `| ${headers.map(markdownTableCell).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...normalizedRows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n")
}

function markdownTableCell(value: string): string {
  return value
    .replace(/\r?\n/gu, "<br>")
    .replace(/\|/gu, "\\|")
    .trim()
}

const sourceAlignmentCheckpoints = [
  "Product Definition",
  "Initiative Definition",
  "Classification",
  "Applicability",
  "Source Intake",
  "Source Baseline",
  "Source Provenance",
] as const

/**
 * Advisor prose is converted into a stable decision table at the presentation boundary.
 * The raw proposal remains in Chat state; failure to parse is visible instead of silently
 * dropping a checkpoint.
 */
export function sourceAlignmentTableRows(proposedAnswer: string): SourceAlignmentTableRow[] {
  const normalized = proposedAnswer.replace(/\*\*/gu, "")
  return sourceAlignmentCheckpoints.map((checkpoint, index) => {
    const nextCheckpoint = sourceAlignmentCheckpoints[index + 1]
    const start = normalized.search(new RegExp(`(?:^|\\n)\\s*(?:[-*]\\s*)?${escapeRegExp(checkpoint)}\\s*:`, "iu"))
    if (start < 0) {
      return {
        checkpoint,
        alignment: "Not returned",
        authority: "Not returned",
        evidenceAndGap: "The advisor response did not contain this required checkpoint row.",
      }
    }
    const remaining = normalized.slice(start).replace(/^\s+/u, "")
    const nextCheckpointIndex = nextCheckpoint
      ? remaining.search(new RegExp(`\\n\\s*(?:[-*]\\s*)?${escapeRegExp(nextCheckpoint)}\\s*:`, "iu"))
      : -1
    const nextStepIndex = remaining.search(/\n\s*next checkpoint\s*:/iu)
    const boundaries = [nextCheckpointIndex, nextStepIndex].filter((candidate) => candidate >= 0)
    const next = boundaries.length > 0 ? Math.min(...boundaries) : -1
    const segment = (next >= 0 ? remaining.slice(0, next) : remaining)
      .replace(/\s+/gu, " ")
      .trim()
    const body = segment.replace(new RegExp(`^(?:[-*]\\s*)?${escapeRegExp(checkpoint)}\\s*:\\s*`, "iu"), "")
    const match = body.match(/^([^—–-]+(?:-[^—–]+)?)\s*\(\s*authority\s*:\s*([^)]+)\)\s*[—–-]\s*(.+)$/iu)
    if (!match) {
      return {
        checkpoint,
        alignment: "Review needed",
        authority: "Review needed",
        evidenceAndGap: body || "The advisor returned an empty checkpoint assessment.",
      }
    }
    return {
      checkpoint,
      alignment: match[1]?.trim() ?? "Review needed",
      authority: match[2]?.trim() ?? "Review needed",
      evidenceAndGap: match[3]?.trim() ?? "Review needed",
    }
  })
}

export function sourceAlignmentNextCheckpoint(proposedAnswer: string): string | undefined {
  return proposedAnswer.match(/(?:^|\n)\s*next checkpoint\s*:\s*(.+)$/imu)?.[1]?.trim()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
}

export function sourceIntakeManifestSummary(input: {
  sources: readonly { byteLength: number; contentDigest: string }[]
  rejected: readonly { reason: string }[]
}): SourceIntakeManifestSummary {
  const uniqueContentDigests = new Set(input.sources.map((source) => source.contentDigest)).size
  const reasonCounts = new Map<string, number>()
  for (const rejection of input.rejected) {
    reasonCounts.set(rejection.reason, (reasonCounts.get(rejection.reason) ?? 0) + 1)
  }
  return {
    includedFiles: input.sources.length,
    uniqueContentDigests,
    duplicateContentInstances: input.sources.length - uniqueContentDigests,
    excludedEntries: input.rejected.length,
    totalCandidateBytes: input.sources.reduce((total, source) => total + source.byteLength, 0),
    exclusionsByReason: [...reasonCounts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([reason, count]) => ({ reason, count })),
  }
}

export function sourceAdvisorFailureMarkdown(input: {
  advisorLabel: string
  error: unknown
  priorReviewPreserved: boolean
  operation?: "answer" | "alignment"
}): string {
  const message = input.error instanceof Error ? input.error.message : ""
  const authenticationUnavailable = /authentication is unavailable|not logged in|login required/iu.test(message)
  const operation = input.operation ?? "answer"
  return [
    operation === "alignment" ? "# Attachment alignment unavailable" : "# Attachment answer unavailable",
    "",
    authenticationUnavailable
      ? `**${input.advisorLabel} could not authenticate for this managed request.**`
      : `**${input.advisorLabel} did not complete this managed request.**`,
    "",
    operation === "alignment"
      ? "No alignment preview was generated or accepted."
      : "No document answer or review note was generated.",
    input.priorReviewPreserved
      ? "The last successful attachment review remains available. Retry the request, switch the agent/model, or inspect Diagnostics."
      : "The selected files were not recorded. Retry after confirming the provider login; if the Chat was reloaded, select the files again.",
    "",
    "> No Source, Baseline, Provenance, approval, readiness, or lifecycle authority was created.",
  ].join("\n")
}
