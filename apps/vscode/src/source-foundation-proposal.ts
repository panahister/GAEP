import type { AdoptionAccelerationCheckpoint } from "./adoption-acceleration.js"

export type SourceFoundationProposalCheckpoint = "source-baseline" | "source-provenance"

export interface SourceFoundationProposalState {
  schemaVersion: 1
  kind: "gaep-source-foundation-proposal-state"
  phase: "proposal" | "review" | "committed" | "cancelled"
  checkpoint: SourceFoundationProposalCheckpoint
  initiativeId: string
  initiativeRevision: number
  sourceCount: number
  sourceTitles: string[]
  sourceMembershipDigest: string
  baseline?: {
    revision: number
    memberCount: number
    membershipDigest: string
  }
  adoptedCandidate?: Pick<AdoptionAccelerationCheckpoint,
    "coverage" | "evidence" | "candidateProposal" | "missingDecisions" | "evidenceDigest" | "proposalDigest">
  authorityBoundary: "source-foundation-proposal-is-non-governed-until-explicit-accept-and-commit"
}

export function startSourceFoundationProposal(input: Omit<SourceFoundationProposalState,
  "schemaVersion" | "kind" | "phase" | "authorityBoundary">): SourceFoundationProposalState {
  const state: SourceFoundationProposalState = {
    schemaVersion: 1,
    kind: "gaep-source-foundation-proposal-state",
    phase: "proposal",
    ...structuredClone(input),
    authorityBoundary: "source-foundation-proposal-is-non-governed-until-explicit-accept-and-commit",
  }
  if (!isSourceFoundationProposalState(state)) throw new Error("The Source foundation proposal is invalid")
  return state
}

export function acceptSourceFoundationProposal(state: SourceFoundationProposalState): SourceFoundationProposalState {
  if (state.phase !== "proposal") throw new Error("No Source foundation proposal is awaiting acceptance")
  return { ...state, phase: "review" }
}

export function setSourceFoundationProposalPhase(
  state: SourceFoundationProposalState,
  phase: Extract<SourceFoundationProposalState["phase"], "committed" | "cancelled">,
): SourceFoundationProposalState {
  return { ...state, phase }
}

export function isSourceFoundationProposalState(value: unknown): value is SourceFoundationProposalState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const candidate = value as Partial<SourceFoundationProposalState>
  if (candidate.schemaVersion !== 1 || candidate.kind !== "gaep-source-foundation-proposal-state" ||
      !["proposal", "review", "committed", "cancelled"].includes(String(candidate.phase)) ||
      !["source-baseline", "source-provenance"].includes(String(candidate.checkpoint)) ||
      typeof candidate.initiativeId !== "string" || candidate.initiativeId.length === 0 ||
      !Number.isSafeInteger(candidate.initiativeRevision) || candidate.initiativeRevision! < 1 ||
      !Number.isSafeInteger(candidate.sourceCount) || candidate.sourceCount! < 1 ||
      !Array.isArray(candidate.sourceTitles) || candidate.sourceTitles.length !== candidate.sourceCount ||
      candidate.sourceTitles.some((title) => typeof title !== "string" || title.length === 0 || title.length > 2_048) ||
      typeof candidate.sourceMembershipDigest !== "string" ||
      !/^sha256:[a-f0-9]{64}$/u.test(candidate.sourceMembershipDigest) ||
      candidate.authorityBoundary !== "source-foundation-proposal-is-non-governed-until-explicit-accept-and-commit") return false
  if (candidate.checkpoint === "source-provenance") {
    const baseline = candidate.baseline
    if (!baseline || !Number.isSafeInteger(baseline.revision) || baseline.revision < 1 ||
        !Number.isSafeInteger(baseline.memberCount) || baseline.memberCount < 1 ||
        typeof baseline.membershipDigest !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(baseline.membershipDigest)) return false
  }
  const adopted = candidate.adoptedCandidate
  return adopted === undefined || (
    ["ready-to-propose", "partially-supported", "unsupported", "requires-governed-prerequisite"].includes(adopted.coverage) &&
    typeof adopted.evidence === "string" && adopted.evidence.length > 0 &&
    typeof adopted.candidateProposal === "string" && adopted.candidateProposal.length > 0 &&
    typeof adopted.missingDecisions === "string" && adopted.missingDecisions.length > 0 &&
    /^sha256:[a-f0-9]{64}$/u.test(adopted.evidenceDigest) && /^sha256:[a-f0-9]{64}$/u.test(adopted.proposalDigest)
  )
}
