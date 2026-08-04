import { sourceRecordInputSchema, type SourceRecordInput } from "@gaep/contracts"

export interface CandidateSourceAttachment {
  label: string
  format: string
  extraction?: "utf8-text" | "docx-ooxml" | "xlsx-ooxml"
  byteLength: number
  contentDigest: `sha256:${string}`
  limitations?: string[]
}

export interface CandidateSourceRecordSummary {
  id: string
  title: string
  contentDigest: string
}

function sourceTitle(source: CandidateSourceAttachment): string {
  const label = source.label.trim()
  return label.length >= 2 ? label.slice(0, 240) : `Candidate source ${source.contentDigest.slice(7, 19)}`
}

export function candidateSourceRecordInput(input: {
  initiativeId: string
  source: CandidateSourceAttachment
  actorId: string
  assessedAt: string
}): SourceRecordInput {
  const source = input.source
  const limitations = [...new Set([
    ...(source.limitations ?? []),
    "Recorded as a non-authoritative candidate; ownership, rights, freshness, authenticity, and semantic authority require later human review.",
  ])]
  return sourceRecordInputSchema.parse({
    initiativeId: input.initiativeId,
    sourceType: "other",
    title: sourceTitle(source),
    description: `Exact reviewed ${source.format.toUpperCase()} attachment recorded from Product Chat as a non-authoritative candidate input.`,
    locator: { kind: "logical", value: `product-chat.attachment.${source.contentDigest.slice(7)}` },
    revisionIdentity: { kind: "content-version", value: source.contentDigest },
    contentDigest: source.contentDigest,
    digestScope: "Exact original attachment bytes",
    owner: { kind: "unassigned" },
    semanticAuthority: {
      standing: "non-authoritative",
      domain: "Candidate Product documentation",
      scope: ["Candidate Source Intake only"],
      basis: "The local human explicitly recorded this exact attachment as a candidate input without declaring its content authoritative.",
      declaredBy: { kind: "human", id: input.actorId },
    },
    knowledgeDisposition: "unknown",
    trust: { sourceAuthenticity: "unknown", contentIntegrity: "verified" },
    informationClassification: "restricted",
    rights: {
      status: "unknown",
      basis: "Usage rights were not established during candidate Source Intake.",
    },
    freshness: {
      status: "unknown",
      assessedAt: input.assessedAt,
      basis: "Document freshness was not established during candidate Source Intake.",
    },
    availability: {
      status: "available",
      basis: "The exact attachment bytes were available and hashed during this Product Chat session.",
    },
    limitations,
  })
}

export async function recordExactCandidateSources(input: {
  initiativeId: string
  sources: CandidateSourceAttachment[]
  actorId: string
  assessedAt: string
  existing: CandidateSourceRecordSummary[]
  create(source: SourceRecordInput): Promise<CandidateSourceRecordSummary>
}): Promise<{ recorded: CandidateSourceRecordSummary[]; reused: CandidateSourceRecordSummary[] }> {
  const uniqueSources = [...new Map(
    input.sources.map((source) => [source.contentDigest, source]),
  ).values()].sort((left, right) =>
    left.contentDigest.localeCompare(right.contentDigest) || left.label.localeCompare(right.label))
  const sourceInputs = uniqueSources.map((source) => candidateSourceRecordInput({
    initiativeId: input.initiativeId,
    source,
    actorId: input.actorId,
    assessedAt: input.assessedAt,
  }))
  const byContentDigest = new Map(input.existing.map((source) => [source.contentDigest, source]))
  const recorded: CandidateSourceRecordSummary[] = []
  const reused: CandidateSourceRecordSummary[] = []
  for (const sourceInput of sourceInputs) {
    const prior = byContentDigest.get(sourceInput.contentDigest)
    if (prior) {
      reused.push(prior)
      continue
    }
    const source = await input.create(sourceInput)
    recorded.push(source)
    byContentDigest.set(source.contentDigest, source)
  }
  return { recorded, reused }
}
