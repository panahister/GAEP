import { canonicalDigest } from "@gaep/agent-sdk"
import {
  initiativeApplicabilitySubjectDefinitions,
  type InitiativeApplicabilityMatrixInput,
} from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import {
  acceptInitiativeApplicability,
  answerInitiativeApplicability,
  assessInitiativeApplicability,
  assessInitiativeApplicabilityWithAutomaticRepair,
  changeInitiativeApplicabilityAdvisor,
  initiativeApplicabilityInput,
  initiativeApplicabilityQuestion,
  isInitiativeApplicabilityChatState,
  parseInitiativeApplicabilityProposal,
  standardInitiativeApplicabilityRoleCoverage,
  startInitiativeApplicabilityChat,
  suggestedInitiativeApplicabilityBrief,
  suggestedUnresolvedApplicabilityClarification,
  initiativeApplicabilityLifecycleAiCorrections,
} from "./interactive-initiative-applicability-chat.js"
import type { ProductChatAdvisorSelection } from "./interactive-product-chat.js"

const claude: ProductChatAdvisorSelection = {
  adapterId: "gaep.claude-code-cli", agentId: "claude-code-cli", agentLabel: "Claude Code",
  modelId: "opus", modelLabel: "Opus alias", modelTruthClass: "provider-declared",
}
const codex: ProductChatAdvisorSelection = {
  adapterId: "gaep.codex-cli", agentId: "codex-cli", agentLabel: "Codex",
  modelId: "gpt-5.6-sol", modelLabel: "GPT-5.6 Sol", modelTruthClass: "observed",
}
const subjects = initiativeApplicabilitySubjectDefinitions.map((subject) => ({ ...subject }))
const catalogIdentity = {
  schemaVersion: 1,
  catalogVersion: "gaep-initiative-applicability-subjects-v1",
  subjects,
}
const context = {
  initiativeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  initiativeRevision: 2,
  productRevision: 2,
  product: { name: "Marine Scheduler", profile: "internal-tool", summary: "Governed maritime scheduling." },
  initiative: {
    title: "Governed voyage scheduling", outcome: "Create an implementation-ready scheduling plan.",
    scope: ["Pre-implementation discovery"], exclusions: ["Implementation and release"],
  },
  classification: {
    primaryType: "feature" as const, secondaryTypes: ["data-capability" as const], systemState: "mixed" as const,
    changePosture: "new" as const, motivations: ["business-driven" as const, "operational" as const],
    characteristics: {
      userInterface: "ui-bearing" as const, data: "data-bearing" as const, integration: "unknown" as const,
      interactionModes: ["interactive" as const], exposure: "internal" as const,
    },
    regulated: false, policyDomains: [], sensitivities: ["data" as const, "operational" as const],
    expectedLifetime: "long-lived" as const, maintenanceHorizon: "Maintained throughout the Product lifetime.",
    risk: { blastRadius: "multi-unit" as const, reversibility: "partially-reversible" as const, urgency: "normal" as const, costOfFailure: "high" as const },
    dependencies: ["Governed source intake"], affectedAssets: ["Scheduling Product"], owner: "Product Owner",
    accountableAuthority: "Product Owner", confidence: { level: "medium" as const, basis: "Governed Product review." },
    evidence: [{ kind: "human-decision" as const, reference: "P1-02 accepted classification" }],
    unresolvedQuestions: ["Confirm external integration obligations."], rationale: "The feature adds governed scheduling capability.",
  },
  catalog: {
    catalogVersion: "gaep-initiative-applicability-subjects-v1" as const,
    digest: canonicalDigest(catalogIdentity),
    subjects,
  },
}

function compactProposal(): {
  groups: Array<{
    status: string
    subjects: string[]
    rationale: string
    owner: string
    accountableApprover: string | null
    condition: string | null
    reviewTrigger: string
  }>
  unresolvedSubjects: Array<{ subject: string; reason: string; owner: string }>
} {
  return {
    groups: [{
      status: "required",
      subjects: subjects.map((subject) => `${subject.type}:${subject.key}`),
      rationale: "These subjects are required for the governed pre-implementation journey.",
      owner: "Product Owner",
      accountableApprover: null,
      condition: null,
      reviewTrigger: "Reassess when Product scope, classification, or source evidence changes.",
    }],
    unresolvedSubjects: [],
  }
}

describe("interactive Initiative applicability chat", () => {
  it("presents the exact canonical catalog and challenges an incomplete brief", () => {
    const state = startInitiativeApplicabilityChat(claude, context)
    const prompt = initiativeApplicabilityQuestion(state).prompt
    expect(prompt).toContain(`Canonical catalog (${subjects.length} subjects`)
    expect(prompt).toContain("phase:intake — Initiative intake")
    expect(answerInitiativeApplicability(state, "everything applies").challenge).toMatch(/lifecycle depth/)
  })

  it("revises a current matrix as a complete replacement without dropping unaffected decisions", () => {
    const initial = startInitiativeApplicabilityChat(claude, context)
    const currentApplicability = parseInitiativeApplicabilityProposal(JSON.stringify(compactProposal()), initial)
    const revision = startInitiativeApplicabilityChat(claude, { ...context, currentApplicability })

    expect(initiativeApplicabilityQuestion(revision).prompt).toContain("Revise the current governed applicability matrix")
    expect(initiativeApplicabilityQuestion(revision).prompt).toContain("return one complete replacement matrix rather than a patch")
    expect(isInitiativeApplicabilityChatState(revision)).toBe(true)
  })

  it("offers a safe context-aware starter without fabricating applicability or approval truth", () => {
    const brief = suggestedInitiativeApplicabilityBrief(context)
    expect(brief).toContain("complete governed Product, Initiative, Classification")
    expect(brief).toContain("Do not repeat those records")
    expect(brief).toContain("keep the subject explicitly unresolved")
    expect(brief).toContain("Do not claim approved or rejected")
    expect(brief).toContain("standard candidate role")
    expect(brief).not.toContain(context.initiative.outcome)
    expect(brief).not.toContain(context.initiative.scope[0])
    expect(brief).not.toContain('"status":"required"')
  })

  it("proposes one editable standard owner for every canonical subject", () => {
    const coverage = standardInitiativeApplicabilityRoleCoverage(context)
    expect(coverage).toHaveLength(subjects.length)
    expect(new Set(coverage.map(({ subject }) => `${subject.type}:${subject.key}`)).size).toBe(subjects.length)
    expect(coverage.find(({ subject }) => subject.key === "architecture-assets")?.owner).toBe("Solution Architect")
    expect(coverage.find(({ subject }) => subject.key === "business-architecture")?.owner).toBe("Business Architect")
    expect(coverage.find(({ subject }) => subject.key === "security-testing")?.owner).toBe("Security Architect")
    expect(coverage.find(({ subject }) => subject.key === "unit-testing")?.owner).toBe("Software Engineer")
    expect(coverage.find(({ subject }) => subject.key === "architecture")?.accountableApprover).toBe("Architecture Authority")
    expect(coverage.find(({ subject }) => subject.key === "security")?.accountableApprover).toBe("Security Authority")
    expect(coverage.find(({ subject }) => subject.key === "implementation")?.accountableApprover).toBe("Engineering Authority")
    expect(coverage.find(({ subject }) => subject.key === "release")?.accountableApprover).toBe("Release Authority")
    expect(coverage.find(({ subject }) => subject.key === "initiative-entry")?.accountableApprover).toBe("Business Sponsor")
    expect(coverage.find(({ subject }) => subject.key === "threat-modeling")?.accountableApprover).toBeUndefined()
    expect(coverage.find(({ subject }) => subject.key === "architecture-assets")?.accountableApprover).toBeUndefined()
    expect(coverage.find(({ subject }) => subject.key === "release-evidence")?.accountableApprover).toBeUndefined()
  })

  it("separates lifecycle AI governance from target-runtime AI and proposes bounded greenfield defaults", () => {
    const unresolvedKeys = new Set([
      "phase:existing-system-assessment",
      "activity:existing-system-discovery",
      "activity:human-ai-challenge",
      "capability:governed-agent-execution",
      "capability:provider-model-handoff",
    ])
    const proposal = compactProposal()
    proposal.groups[0]!.subjects = proposal.groups[0]!.subjects.filter((key) => !unresolvedKeys.has(key))
    const owners = new Map(standardInitiativeApplicabilityRoleCoverage(context).map((entry) => [
      `${entry.subject.type}:${entry.subject.key}`,
      entry.owner,
    ]))
    proposal.unresolvedSubjects = [...unresolvedKeys].map((key) => ({
      subject: key,
      reason: "The current governed facts do not establish this applicability decision.",
      owner: owners.get(key)!,
    }))
    const clarificationContext = {
      ...context,
      classification: { ...context.classification, systemState: "unknown" as const },
    }
    const state = assessInitiativeApplicability(
      startInitiativeApplicabilityChat(codex, clarificationContext),
      "Assess the complete catalog and preserve unsupported subjects as explicitly unresolved.",
      {
        assessment: "Five subjects require clarification.", strengths: [], gaps: ["Delivery and runtime context are unclear."],
        proposedAnswer: JSON.stringify(proposal),
      },
    )
    const clarification = suggestedUnresolvedApplicabilityClarification(state)
    expect(clarification).toContain("GAEP-generated clarification proposal for human review")
    expect(clarification).toContain("treat this Initiative as greenfield")
    expect(clarification).toContain("activity:human-ai-challenge and mark it required")
    expect(clarification).toContain("capability:governed-agent-execution and capability:provider-model-handoff and mark both required")
    expect(clarification).toContain("does not assert that the delivered Product runtime contains AI")
    expect(clarification).toContain("Preserve the separate Classification question")
    expect(clarification).toContain("not a governed fact")
  })

  it("turns unresolved approval applicability into decided checkpoints without appointing anyone", () => {
    const unresolvedKeys = new Set([
      "approval:initiative-entry",
      "approval:architecture",
      "approval:security",
      "evidence-obligation:approval",
    ])
    const proposal = compactProposal()
    proposal.groups[0]!.subjects = proposal.groups[0]!.subjects.filter((key) => !unresolvedKeys.has(key))
    const owners = new Map(standardInitiativeApplicabilityRoleCoverage(context).map((entry) => [
      `${entry.subject.type}:${entry.subject.key}`,
      entry.owner,
    ]))
    proposal.unresolvedSubjects = [...unresolvedKeys].map((key) => ({
      subject: key,
      reason: "The accountable person is not yet appointed.",
      owner: owners.get(key)!,
    }))
    const state = assessInitiativeApplicability(
      startInitiativeApplicabilityChat(claude, context),
      "Use candidate standard approval roles while preserving the human decision boundary.",
      { assessment: "Approval roles remain open.", strengths: [], gaps: [], proposedAnswer: JSON.stringify(proposal) },
    )
    const clarification = suggestedUnresolvedApplicabilityClarification(state)
    expect(clarification).toContain("approval:initiative-entry and mark the approval checkpoint required")
    expect(clarification).toContain("candidate accountable approver: Business Sponsor")
    expect(clarification).toContain("approval:architecture and mark the approval checkpoint required")
    expect(clarification).toContain("candidate accountable approver: Architecture Authority")
    expect(clarification).toContain("approval:security and mark the approval checkpoint required")
    expect(clarification).toContain("candidate accountable approver: Security Authority")
    expect(clarification).toContain("evidence-obligation:approval conditionally-required")
    expect(clarification).toContain("not a named appointment, approval decision, or authority grant")
  })

  it("resolves already-decided awaiting-human rows instead of ignoring them", () => {
    const proposal = compactProposal()
    proposal.groups[0]!.subjects = proposal.groups[0]!.subjects.filter((key) => key !== "approval:initiative-entry")
    proposal.groups.push({
      status: "awaiting-human-decision",
      subjects: ["approval:initiative-entry"],
      rationale: "The approval checkpoint is applicable but its accountable person is not appointed.",
      owner: "Product Owner",
      accountableApprover: "Business Sponsor",
      condition: null,
      reviewTrigger: "Reassess when the approval responsibility is formally assigned.",
    })
    const state = assessInitiativeApplicability(
      startInitiativeApplicabilityChat(claude, context),
      "Use the standard approval role as an editable applicability decision without granting approval.",
      { assessment: "One decision awaits a human.", strengths: [], gaps: [], proposedAnswer: JSON.stringify(proposal) },
    )
    const clarification = suggestedUnresolvedApplicabilityClarification(state)
    expect(clarification).toContain("Current unresolved coverage: 0 subject(s)")
    expect(clarification).toContain("Current decisions awaiting a human applicability decision: 1 subject(s)")
    expect(clarification).toContain("approval:initiative-entry and mark the approval checkpoint required")

    const persisted = state.pending!.matrix
    const resumed = startInitiativeApplicabilityChat(claude, { ...context, currentApplicability: persisted })
    const resumedClarification = suggestedUnresolvedApplicabilityClarification(resumed)
    expect(resumedClarification).toContain("Current decisions awaiting a human applicability decision: 1 subject(s)")
  })

  it("provides bounded conditional defaults for technology subjects instead of looping unresolved", () => {
    const unresolvedKeys = new Set(["activity:technology-selection", "artifact:technology-profile"])
    const proposal = compactProposal()
    proposal.groups[0]!.subjects = proposal.groups[0]!.subjects.filter((key) => !unresolvedKeys.has(key))
    proposal.unresolvedSubjects = [...unresolvedKeys].map((key) => ({
      subject: key,
      reason: "The exact technology decision is intentionally deferred to solution architecture.",
      owner: "Software Architect",
    }))
    const state = assessInitiativeApplicability(
      startInitiativeApplicabilityChat(claude, context),
      "Resolve technology planning without choosing or approving a stack prematurely.",
      { assessment: "Technology decisions are deferred.", strengths: [], gaps: [], proposedAnswer: JSON.stringify(proposal) },
    )
    const clarification = suggestedUnresolvedApplicabilityClarification(state)
    expect(clarification).toContain("Technology-readiness proposal")
    expect(clarification).toContain("conditionally-required")
    expect(clarification).not.toContain("Preserve these subjects as unresolved")
  })

  it("does not fabricate a clarification when the assessed matrix has no unresolved subject", () => {
    const state = assessInitiativeApplicability(
      startInitiativeApplicabilityChat(codex, context),
      "Assess the complete catalog from the explicit governed scope and supplied candidate decisions.",
      {
        assessment: "The matrix is complete.", strengths: ["All subjects are decided."], gaps: [],
        proposedAnswer: JSON.stringify(compactProposal()),
      },
    )
    expect(suggestedUnresolvedApplicabilityClarification(state)).toBeUndefined()
  })

  it("repairs lifecycle AI scope even when those subjects were already decided as not applicable", () => {
    const proposal = compactProposal()
    const lifecycleAiKeys = new Set([
      "activity:human-ai-challenge",
      "capability:governed-agent-execution",
      "capability:provider-model-handoff",
    ])
    proposal.groups[0]!.subjects = proposal.groups[0]!.subjects.filter((key) => !lifecycleAiKeys.has(key))
    proposal.groups.push({
      ...proposal.groups[0]!,
      status: "not-applicable",
      subjects: [...lifecycleAiKeys],
      rationale: "The delivered Product runtime is deterministic and contains no AI behavior.",
    })
    const state = assessInitiativeApplicability(
      startInitiativeApplicabilityChat(claude, context),
      "Resolve the complete lifecycle matrix while keeping target-runtime AI separate from GAEP-assisted lifecycle work.",
      { assessment: "All subjects are decided.", strengths: [], gaps: [], proposedAnswer: JSON.stringify(proposal) },
    )
    expect(state.pending?.matrix.unresolvedSubjects).toHaveLength(0)
    expect(initiativeApplicabilityLifecycleAiCorrections(state)).toEqual([
      "activity:human-ai-challenge",
      "capability:governed-agent-execution",
      "capability:provider-model-handoff",
    ])
    const clarification = suggestedUnresolvedApplicabilityClarification(state)
    expect(clarification).toContain("replace—not preserve—the current decisions")
    expect(clarification).toContain("mark it required")
    expect(clarification).toContain("mark both required")
    expect(clarification).toContain("does not assert that the delivered Product runtime contains AI")
  })

  it("parses exact complete coverage, assesses it, and requires explicit acceptance", () => {
    let state = startInitiativeApplicabilityChat(claude, context)
    const matrix = parseInitiativeApplicabilityProposal(JSON.stringify(compactProposal()), state)
    expect(matrix.decisions).toHaveLength(subjects.length)
    expect(matrix.subjectCatalog?.digest).toBe(context.catalog.digest)
    expect(matrix.decisions[0]).toMatchObject({
      sources: [{ kind: "human-decision", reference: "P1-03 interactive applicability brief" }],
      approval: { state: "not-required" },
      dependencies: [], relatedRecords: [], relatedImplementationUnits: [],
    })
    state = assessInitiativeApplicability(state, "A detailed applicability brief covering lifecycle, testing, approvals, evidence, owners, and unresolved decisions.", {
      assessment: "The proposal covers the canonical catalog.", strengths: ["Every subject is represented."], gaps: [],
      proposedAnswer: JSON.stringify(compactProposal()),
    })
    expect(state.phase).toBe("awaiting-approval")
    expect(() => initiativeApplicabilityInput(state)).toThrow(/incomplete/)
    state = acceptInitiativeApplicability(state)
    expect(initiativeApplicabilityInput(state).decisions).toHaveLength(subjects.length)
    expect(isInitiativeApplicabilityChatState(state)).toBe(true)
  })

  it("automatically repairs an invalid applicability matrix without changing the human brief", async () => {
    const state = startInitiativeApplicabilityChat(claude, context)
    const originalAnswer = "Use the governed context and standard roles to assess the complete lifecycle."
    const seenErrors: string[][] = []
    const result = await assessInitiativeApplicabilityWithAutomaticRepair(
      state,
      originalAnswer,
      async ({ attempt, contractErrors }) => {
        seenErrors.push(contractErrors)
        return {
          assessment: attempt === 1 ? "Incomplete first proposal." : "Complete repaired proposal.",
          strengths: [],
          gaps: [],
          proposedAnswer: JSON.stringify(attempt === 1 ? { groups: [], unresolvedSubjects: [] } : compactProposal()),
        }
      },
    )
    expect(result.attempts).toBe(2)
    expect(seenErrors[1]?.[0]).toMatch(/at least one decided or unresolved subject/i)
    expect(result.state.phase).toBe("awaiting-approval")
    expect(result.state.pending?.originalAnswer).toBe(originalAnswer)
    expect(result.state.pending?.matrix.decisions).toHaveLength(subjects.length)
    expect(result.state.pending?.assessment).toContain("automatically repaired and contract-validated")
  })

  it("repairs an unparseable advisor envelope before assessing the matrix", async () => {
    const state = startInitiativeApplicabilityChat(codex, context)
    const result = await assessInitiativeApplicabilityWithAutomaticRepair(
      state,
      "Generate the complete governed applicability proposal.",
      async ({ attempt }) => {
        if (attempt === 1) throw new Error("The advisor did not return the required structured assessment")
        return {
          assessment: "The repaired matrix has exact coverage.", strengths: [], gaps: [],
          proposedAnswer: JSON.stringify(compactProposal()),
        }
      },
    )
    expect(result.attempts).toBe(2)
    expect(result.state.pending?.matrix.decisions).toHaveLength(49)
  })

  it("rejects missing, unknown, duplicate, unsupported, and fabricated-reuse subject coverage", () => {
    const state = startInitiativeApplicabilityChat(claude, context)
    const missing = compactProposal()
    missing.groups[0]!.subjects.pop()
    expect(() => parseInitiativeApplicabilityProposal(JSON.stringify(missing), state)).toThrow(/represent all/)
    const unknown = compactProposal()
    unknown.groups[0]!.subjects[0] = "phase:invented"
    expect(() => parseInitiativeApplicabilityProposal(JSON.stringify(unknown), state)).toThrow(/not in the current/)
    const duplicate = compactProposal()
    duplicate.groups[0]!.subjects[1] = duplicate.groups[0]!.subjects[0]!
    expect(() => parseInitiativeApplicabilityProposal(JSON.stringify(duplicate), state)).toThrow()
    const unsupported = compactProposal()
    Object.assign(unsupported.groups[0]!, { approval: { state: "approved", conditions: [] } })
    expect(() => parseInitiativeApplicabilityProposal(JSON.stringify(unsupported), state)).toThrow(/unsupported field/)
    const reused = compactProposal()
    reused.groups[0]!.status = "reused"
    expect(() => parseInitiativeApplicabilityProposal(JSON.stringify(reused), state)).toThrow(/cannot claim satisfied or reused/)
  })

  it("accepts explicit unresolved coverage and drops an unaccepted matrix when the advisor changes", () => {
    const state = startInitiativeApplicabilityChat(claude, context)
    const proposal = compactProposal()
    const unresolvedSubject = proposal.groups[0]!.subjects.pop()!
    proposal.unresolvedSubjects.push({
      subject: unresolvedSubject,
      reason: "Accountable release authority is not yet established.",
      owner: "Product Owner",
    })
    const matrix: InitiativeApplicabilityMatrixInput = parseInitiativeApplicabilityProposal(JSON.stringify(proposal), state)
    expect(matrix.unresolvedSubjects).toHaveLength(1)
    let assessed = assessInitiativeApplicability(state, "A detailed applicability brief covering every governed decision and unknown authority.", {
      assessment: "One authority remains unresolved.", strengths: [], gaps: ["Release authority is unknown."],
      proposedAnswer: JSON.stringify(proposal),
    })
    assessed = changeInitiativeApplicabilityAdvisor(assessed, codex)
    expect(assessed.phase).toBe("collecting")
    expect(assessed.pending).toBeUndefined()
    expect(assessed.initiativeRevision).toBe(2)
  })

  it("accepts honest complete coverage when every subject awaits human resolution", () => {
    const state = startInitiativeApplicabilityChat(codex, context)
    const proposal = {
      groups: [],
      unresolvedSubjects: subjects.map((subject) => ({
        subject: `${subject.type}:${subject.key}`,
        reason: "The governed facts do not establish this exact applicability decision.",
        owner: "Initiative owner (human, unassigned)",
      })),
    }
    const matrix = parseInitiativeApplicabilityProposal(JSON.stringify(proposal), state)
    expect(matrix.decisions).toEqual([])
    expect(matrix.unresolvedSubjects).toHaveLength(subjects.length)
    expect(matrix.unresolvedSubjects.map(({ subject }) => `${subject.type}:${subject.key}`))
      .toEqual(subjects.map((subject) => `${subject.type}:${subject.key}`))
  })

  it("expands compact conditional and pending decisions without granting approval", () => {
    const state = startInitiativeApplicabilityChat(claude, context)
    const proposal = compactProposal()
    const required = proposal.groups[0]!
    const deferredSubject = required.subjects.shift()!
    const pendingSubject = required.subjects.shift()!
    proposal.groups.push({
      ...required,
      status: "deferred",
      subjects: [deferredSubject],
      condition: "Resume only after explicit implementation authority is granted.",
    }, {
      ...required,
      status: "awaiting-human-decision",
      subjects: [pendingSubject],
      accountableApprover: "Product Owner",
    })
    const matrix = parseInitiativeApplicabilityProposal(JSON.stringify(proposal), state)
    expect(matrix.decisions.find((decision) => decision.subject.key === subjects[0]!.key)).toMatchObject({
      status: "deferred",
      conditions: ["Resume only after explicit implementation authority is granted."],
      approval: { state: "not-required" },
    })
    expect(matrix.decisions.find((decision) => decision.subject.key === subjects[1]!.key)).toMatchObject({
      status: "awaiting-human-decision",
      accountableApprover: "Product Owner",
      approval: { state: "pending" },
    })
    const invalid = compactProposal()
    invalid.groups[0]!.status = "awaiting-human-decision"
    expect(() => parseInitiativeApplicabilityProposal(JSON.stringify(invalid), state)).toThrow(/accountableApprover/)
  })
})
