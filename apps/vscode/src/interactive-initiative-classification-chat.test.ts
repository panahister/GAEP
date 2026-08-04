import { describe, expect, it } from "vitest"

import type { InitiativeClassificationInput } from "@gaep/contracts"

import {
  acceptInitiativeClassification,
  answerInitiativeClassification,
  assessInitiativeClassification,
  assessInitiativeClassificationWithAutomaticRepair,
  backInitiativeClassification,
  changeInitiativeClassificationAdvisor,
  initiativeClassificationInput,
  initiativeClassificationQuestion,
  isInitiativeClassificationChatState,
  parseInitiativeClassificationProposal,
  startInitiativeClassificationChat,
  suggestedInitiativeClassificationResolution,
} from "./interactive-initiative-classification-chat.js"
import type { ProductChatAdvisorSelection } from "./interactive-product-chat.js"

const claude: ProductChatAdvisorSelection = {
  adapterId: "gaep.claude-code-cli", agentId: "claude-code-cli", agentLabel: "Claude Code",
  modelId: "sonnet", modelLabel: "Sonnet alias", modelTruthClass: "provider-declared",
}
const codex: ProductChatAdvisorSelection = {
  adapterId: "gaep.codex-cli", agentId: "codex-cli", agentLabel: "Codex",
  modelId: "gpt-5.6-sol", modelLabel: "GPT-5.6 Sol", modelTruthClass: "observed",
}
const context = {
  initiativeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  initiativeRevision: 1,
  productRevision: 2,
  product: { name: "Marine Scheduler", profile: "internal-tool", summary: "Governed maritime scheduling." },
  initiative: {
    title: "Prepare the scheduling MVP", outcome: "Reach an accepted implementation-readiness decision.",
    scope: ["Product discovery through P7"], exclusions: ["Implementation and release"],
  },
}
const classification: InitiativeClassificationInput = {
  primaryType: "product-increment",
  secondaryTypes: ["feature"],
  systemState: "brownfield",
  changePosture: "modernization",
  motivations: ["business-driven", "operational"],
  characteristics: {
    userInterface: "ui-bearing", data: "data-bearing", integration: "integration-heavy",
    interactionModes: ["interactive", "batch"], exposure: "internal",
  },
  regulated: false,
  policyDomains: [],
  sensitivities: ["data", "operational"],
  expectedLifetime: "long-lived",
  maintenanceHorizon: "Maintained by the Product team while the scheduling service is active.",
  risk: { blastRadius: "multi-unit", reversibility: "partially-reversible", urgency: "normal", costOfFailure: "high" },
  dependencies: ["Current shipping service documentation"],
  affectedAssets: ["Marine scheduling Product"],
  owner: "Product Owner",
  accountableAuthority: "Product Owner",
  confidence: { level: "medium", basis: "Current Product and Initiative records plus explicit human review." },
  evidence: [{ kind: "human-decision", reference: "GAEP Initiative classification conversation" }],
  unresolvedQuestions: ["Confirm external regulatory obligations during Source Intake."],
  rationale: "The Initiative incrementally prepares an existing operational Product for controlled implementation.",
}

describe("interactive Initiative classification chat", () => {
  it("creates a bounded context-aware question and challenges incomplete briefs", () => {
    const state = startInitiativeClassificationChat(claude, context)
    expect(initiativeClassificationQuestion(state).prompt).toContain("Marine Scheduler")
    expect(initiativeClassificationQuestion(state).prompt).toContain("Do not invent")
    expect(answerInitiativeClassification(state, "brownfield").challenge).toMatch(/specific classification brief/)
  })

  it("starts a revision from the complete current classification without asking for internal JSON", () => {
    const state = startInitiativeClassificationChat(claude, { ...context, currentClassification: classification })
    const prompt = initiativeClassificationQuestion(state).prompt
    expect(prompt).toContain("Revise the current governed classification")
    expect(prompt).toContain("Preserve every supported current value")
    expect(prompt).toContain("complete replacement classification, not a patch")
    expect(state.currentClassification?.unresolvedQuestions).toEqual(classification.unresolvedQuestions)
  })

  it("turns open classification questions into a bounded human-review resolution brief", () => {
    const state = startInitiativeClassificationChat(claude, { ...context, currentClassification: classification })
    const resolution = suggestedInitiativeClassificationResolution(state)
    expect(resolution).toContain("GAEP-generated classification resolution proposal for human review")
    expect(resolution).toContain("standard role titles")
    expect(resolution).toContain("consequential-gate condition")
    expect(resolution).toContain(classification.unresolvedQuestions[0])
    expect(resolution).toContain("unresolvedQuestions empty")
  })

  it("parses, assesses, accepts, and exposes only an explicitly reviewed classification", () => {
    let state = startInitiativeClassificationChat(claude, context)
    const answer = "This is a brownfield internal Product increment owned and approved by the Product Owner, based on this human classification review."
    expect(answerInitiativeClassification(state, answer).challenge).toBeUndefined()
    state = assessInitiativeClassification(state, answer, {
      assessment: "The brief is usable but preserves one regulatory unknown.",
      strengths: ["Owner and system state are explicit."], gaps: ["Regulatory scope needs Source Intake evidence."],
      followUpQuestion: "Which maritime policies apply?", proposedAnswer: JSON.stringify(classification),
    })
    expect(state.phase).toBe("awaiting-approval")
    expect(state.pending?.classification.primaryType).toBe("product-increment")
    expect(() => initiativeClassificationInput(state)).toThrow(/incomplete/)
    state = acceptInitiativeClassification(state)
    expect(state.phase).toBe("review")
    expect(initiativeClassificationInput(state)).toEqual(classification)
    expect(isInitiativeClassificationChatState(state)).toBe(true)
  })

  it("rejects malformed or contract-invalid model proposals", () => {
    expect(() => parseInitiativeClassificationProposal("not JSON")).toThrow(/does not contain/)
    expect(() => parseInitiativeClassificationProposal('{"primaryType":"invented"}')).toThrow()
  })

  it("repairs an invalid advisor proposal without asking the human to format the contract", async () => {
    const state = startInitiativeClassificationChat(claude, context)
    const humanBrief = "This is a natural-language greenfield Product classification brief with operational scope, risk, evidence, and unresolved authority."
    const attempts: Array<{ attempt: number; errors: string[] }> = []
    const result = await assessInitiativeClassificationWithAutomaticRepair(
      state,
      humanBrief,
      async ({ attempt, contractErrors }) => {
        attempts.push({ attempt, errors: contractErrors })
        return attempt === 1
          ? { assessment: "Initial proposal", strengths: [], gaps: [], proposedAnswer: '{"primaryType":"invented"}' }
          : { assessment: "Repaired proposal", strengths: [], gaps: [], proposedAnswer: JSON.stringify(classification) }
      },
    )
    expect(result.attempts).toBe(2)
    expect(attempts[1]?.errors.join(" ")).toContain("primaryType")
    expect(result.state.pending?.originalAnswer).toBe(humanBrief)
    expect(result.state.pending?.classification).toEqual(classification)
  })

  it("retries an unparseable advisor envelope and stops after a contract-valid result", async () => {
    const state = startInitiativeClassificationChat(claude, context)
    let calls = 0
    const result = await assessInitiativeClassificationWithAutomaticRepair(
      state,
      "A natural-language classification brief with sufficient detail for the governed Initiative.",
      async () => {
        calls += 1
        if (calls === 1) throw new Error("The advisor did not return the required structured assessment")
        return { assessment: "Repaired", strengths: [], gaps: [], proposedAnswer: JSON.stringify(classification) }
      },
    )
    expect(calls).toBe(2)
    expect(result.state.phase).toBe("awaiting-approval")
  })

  it("preserves revision binding, supports correction, and drops stale proposals when the advisor changes", () => {
    let state = startInitiativeClassificationChat(claude, context)
    state = assessInitiativeClassification(state, "A sufficiently detailed classification brief for the governed Initiative.", {
      assessment: "Assessment", strengths: [], gaps: [], proposedAnswer: JSON.stringify(classification),
    })
    state = changeInitiativeClassificationAdvisor(state, codex)
    expect(state.phase).toBe("collecting")
    expect(state.pending).toBeUndefined()
    expect(state.initiativeRevision).toBe(1)
    state = backInitiativeClassification(state)
    expect(state.phase).toBe("collecting")
  })
})
