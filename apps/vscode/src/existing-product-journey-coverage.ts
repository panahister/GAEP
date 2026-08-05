export const existingProductJourneyCheckpointIds = [
  "product-definition",
  "initiative-definition",
  "initiative-classification",
  "initiative-applicability",
  "source-intake",
  "source-baseline",
  "source-provenance",
  "product-discovery",
  "business-architecture",
  "solution-security-architecture",
  "detailed-design-assurance",
  "design-implementation-handoff",
] as const

export type ExistingProductJourneyCheckpointId = typeof existingProductJourneyCheckpointIds[number]

export type ExistingProductJourneyCoverage = {
  checkpoint: ExistingProductJourneyCheckpointId
  coverage: "ready-to-propose" | "partially-supported" | "unsupported" | "requires-governed-prerequisite"
  evidence: string
  candidateProposal: string
  missingDecisions: string
}

export const journeyCheckpointLabels: Readonly<Record<ExistingProductJourneyCheckpointId, string>> = {
  "product-definition": "Product definition",
  "initiative-definition": "Initiative definition",
  "initiative-classification": "Initiative classification",
  "initiative-applicability": "Initiative applicability",
  "source-intake": "Source intake",
  "source-baseline": "Source baseline",
  "source-provenance": "Source provenance",
  "product-discovery": "Product discovery",
  "business-architecture": "Business architecture",
  "solution-security-architecture": "Solution and security architecture",
  "detailed-design-assurance": "Detailed design and assurance",
  "design-implementation-handoff": "Pre-Figma readiness and handoff",
}

export function parseExistingProductJourneyCoverage(value: unknown): ExistingProductJourneyCoverage[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The advisor did not return a Product Journey coverage object")
  }
  const rows = (value as Record<string, unknown>).checkpoints
  if (!Array.isArray(rows) || rows.length !== existingProductJourneyCheckpointIds.length) {
    throw new Error(`The Product Journey proposal must contain exactly ${existingProductJourneyCheckpointIds.length} checkpoints`)
  }
  const allowedCoverage = new Set(["ready-to-propose", "partially-supported", "unsupported", "requires-governed-prerequisite"])
  const seen = new Set<string>()
  const boundedText = (entry: Record<string, unknown>, key: string): string => {
    const text = typeof entry[key] === "string" ? entry[key].trim() : ""
    if (!text || text.length > 8_192) throw new Error(`Journey checkpoint ${key} must be bounded non-empty text`)
    return text
  }
  const parsed = rows.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("Each Journey checkpoint must be an object")
    const entry = row as Record<string, unknown>
    const checkpoint = String(entry.checkpoint)
    const coverage = String(entry.coverage)
    if (!existingProductJourneyCheckpointIds.includes(checkpoint as ExistingProductJourneyCheckpointId) || seen.has(checkpoint)) {
      throw new Error(`Journey checkpoint ${checkpoint} is missing, duplicated, or unsupported`)
    }
    if (!allowedCoverage.has(coverage)) throw new Error(`Journey checkpoint ${checkpoint} has an unsupported coverage state`)
    seen.add(checkpoint)
    return {
      checkpoint: checkpoint as ExistingProductJourneyCheckpointId,
      coverage: coverage as ExistingProductJourneyCoverage["coverage"],
      evidence: boundedText(entry, "evidence"),
      candidateProposal: boundedText(entry, "candidateProposal"),
      missingDecisions: boundedText(entry, "missingDecisions"),
    }
  })
  if (existingProductJourneyCheckpointIds.some((checkpoint) => !seen.has(checkpoint))) {
    throw new Error("The Product Journey proposal does not cover every checkpoint exactly once")
  }
  return parsed
}
