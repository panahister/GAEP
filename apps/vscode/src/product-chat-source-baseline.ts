import { canonicalDigest } from "@gaep/agent-sdk"
import type {
  Initiative,
  SourceBaseline,
  SourceBaselineInput,
  SourceProvenance,
  SourceProvenanceInput,
  SourceRecord,
} from "@gaep/contracts"

export interface SourceCheckpointState {
  sources: SourceRecord[]
  baselines: SourceBaseline[]
  provenance: SourceProvenance[]
}

export function exactSourceMember(source: SourceRecord): SourceBaselineInput["members"][number] {
  return {
    sourceId: source.id,
    sourceRevision: source.revision,
    recordDigest: canonicalDigest(source),
    contentDigest: source.contentDigest,
  }
}

export function candidateBaselineInput(
  initiativeId: string,
  sources: readonly SourceRecord[],
): SourceBaselineInput {
  if (sources.length === 0) throw new Error("A Candidate Source Baseline requires at least one exact Source")
  return {
    initiativeId,
    title: "Reviewed Candidate Source Baseline",
    purpose: "Freeze the exact reviewed candidate Source revisions used for the next Product planning checkpoint.",
    scope: ["Current Initiative planning inputs"],
    members: [...sources].sort((left, right) => left.id.localeCompare(right.id)).map(exactSourceMember),
    limitations: [
      "Membership is candidate-only and does not establish semantic authority, approval, completeness, or readiness.",
    ],
  }
}

export function matchingCandidateBaseline(
  input: SourceBaselineInput,
  baselines: readonly SourceBaseline[],
): SourceBaseline | undefined {
  const membershipDigest = canonicalDigest(input.members)
  return baselines.find((baseline) =>
    baseline.initiativeId === input.initiativeId && baseline.membershipDigest === membershipDigest)
}

export function initiativeSourceProvenanceInput(
  initiative: Initiative,
  sources: readonly SourceRecord[],
  actorId: string,
): SourceProvenanceInput {
  if (sources.length === 0) throw new Error("Source Provenance requires at least one exact Source")
  const initiativeDigest = canonicalDigest(initiative)
  return {
    initiativeId: initiative.id,
    target: {
      kind: "governed-record",
      reference: {
        recordType: "initiative",
        recordId: initiative.id,
        revision: initiative.revision ?? 1,
        digest: initiativeDigest,
      },
    },
    disposition: "unknown",
    sources: [...sources].sort((left, right) => left.id.localeCompare(right.id)).map((source) => ({
      reference: exactSourceMember(source),
      role: "supporting" as const,
      rationale: "This exact reviewed candidate Source may support the current Initiative; claim-level validation remains pending.",
    })),
    transformations: [{
      kind: "aggregation",
      description: "Bind the exact candidate Source set to the current Initiative record without asserting claim-level truth.",
      inputDigests: [...new Set(sources.map((source) => source.contentDigest))].sort(),
      outputDigest: initiativeDigest,
      performedBy: { kind: "human", id: actorId },
    }],
    contributors: [{ kind: "human", id: actorId }],
    generation: { kind: "manual", processId: "gaep.product-chat.source-provenance" },
    omissions: ["No claim-level extraction or semantic validation has been asserted."],
    uncertainty: ["Candidate Source authority, ownership, freshness, and completeness remain unresolved until reviewed."],
  }
}

export function matchingInitiativeProvenance(
  input: SourceProvenanceInput,
  provenance: readonly SourceProvenance[],
): SourceProvenance | undefined {
  const targetDigest = input.target.kind === "governed-record"
    ? input.target.reference.digest
    : input.target.kind === "claim" ? input.target.digest : input.target.digest
  const sourceKey = input.sources.map((source) => source.reference.recordDigest).sort().join("|")
  return provenance.find((record) => {
    const recordTargetDigest = record.target.kind === "governed-record"
      ? record.target.reference.digest
      : record.target.kind === "claim" ? record.target.digest : record.target.digest
    return recordTargetDigest === targetDigest &&
      record.sources.map((source) => source.reference.recordDigest).sort().join("|") === sourceKey
  })
}
