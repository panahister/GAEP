import {
  initiativeApplicabilityDecisionInputSchema,
  initiativeApplicabilityMatrixInputSchema,
  initiativeApplicabilitySubjectSchema,
  initiativeClassificationInputSchema,
  type InitiativeApplicabilityMatrixInput,
  type InitiativeApplicabilitySubject,
  type InitiativeClassificationInput,
} from "@gaep/contracts"

import {
  isProductChatAdvisorSelection,
  type ProductAnswerAssessment,
  type ProductChatAdvisorSelection,
} from "./interactive-product-chat.js"

export interface InitiativeApplicabilityContext {
  initiativeId: string
  initiativeRevision: number
  productRevision: number
  product: { name: string; profile: string; summary: string }
  initiative: { title: string; outcome: string; scope: string[]; exclusions: string[] }
  classification: InitiativeClassificationInput
  catalog: {
    catalogVersion: "gaep-initiative-applicability-subjects-v1"
    digest: string
    subjects: InitiativeApplicabilitySubject[]
  }
  currentApplicability?: InitiativeApplicabilityMatrixInput
}

export interface PendingInitiativeApplicability {
  originalAnswer: string
  proposedAnswer: string
  matrix: InitiativeApplicabilityMatrixInput
  assessment: string
  strengths: string[]
  gaps: string[]
  followUpQuestion?: string
  round: number
  advisor: ProductChatAdvisorSelection
}

export interface InitiativeApplicabilityRepairAttempt {
  attempt: number
  contractErrors: string[]
  previousAssessment?: ProductAnswerAssessment
}

export interface InitiativeApplicabilityRepairResult {
  state: InitiativeApplicabilityChatState
  attempts: number
}

export class InitiativeApplicabilityRepairError extends Error {
  constructor(readonly contractErrors: string[]) {
    super("The selected advisor could not produce a contract-valid Initiative applicability matrix")
    this.name = "InitiativeApplicabilityRepairError"
  }
}

export interface InitiativeApplicabilityChatState extends InitiativeApplicabilityContext {
  schemaVersion: 1
  kind: "gaep-initiative-applicability-chat-state"
  phase: "collecting" | "awaiting-approval" | "review" | "committed" | "cancelled"
  advisor: ProductChatAdvisorSelection
  pending?: PendingInitiativeApplicability
  accepted?: InitiativeApplicabilityMatrixInput
}

function subjectKey(subject: InitiativeApplicabilitySubject): string {
  return `${subject.type}:${subject.key}`
}

function canonicalSubjects(state: InitiativeApplicabilityContext): string {
  return state.catalog.subjects.map((subject) => `- ${subjectKey(subject)} — ${subject.label}`).join("\n")
}

export interface StandardApplicabilityRoleRecommendation {
  subject: InitiativeApplicabilitySubject
  owner: string
  accountableApprover?: string
}

const standardRoleGroups: ReadonlyArray<{
  owner: string
  accountableApprover?: string
  subjects: readonly string[]
}> = [
  { owner: "Product Owner", subjects: ["phase:intake"] },
  { owner: "Product Owner", accountableApprover: "Business Sponsor", subjects: ["approval:initiative-entry"] },
  { owner: "Product Owner", subjects: [
    "phase:initiative-classification", "phase:applicability-assessment",
    "artifact:initiative-profile", "artifact:applicability-matrix",
    "evidence-obligation:classification", "evidence-obligation:applicability", "evidence-obligation:approval",
  ] },
  { owner: "Product Manager", subjects: ["activity:product-discovery"] },
  { owner: "Business Analyst", subjects: ["artifact:requirements-acceptance"] },
  { owner: "Risk Owner", subjects: ["phase:scope-criticality-assessment"] },
  { owner: "Solution Architect", subjects: [
    "phase:existing-system-assessment", "phase:architecture-assurance-resolution",
    "activity:existing-system-discovery", "artifact:architecture-assets",
  ] },
  { owner: "Solution Architect", accountableApprover: "Architecture Authority", subjects: ["approval:architecture"] },
  { owner: "Business Architect", subjects: ["activity:business-architecture"] },
  { owner: "Delivery Manager", subjects: ["activity:change-impact-analysis", "evidence-obligation:traceability"] },
  { owner: "Product Designer", subjects: ["activity:experience-design", "capability:design-reference-integration"] },
  { owner: "Accessibility Reviewer", subjects: ["test-method:usability-accessibility-testing"] },
  { owner: "AI Governance Owner", subjects: [
    "activity:human-ai-challenge", "capability:governed-agent-execution", "capability:provider-model-handoff",
  ] },
  { owner: "Security Architect", subjects: [
    "activity:threat-modeling", "activity:identity-authorization-analysis",
    "test-method:security-testing",
  ] },
  { owner: "Security Architect", accountableApprover: "Security Authority", subjects: ["approval:security"] },
  { owner: "Software Architect", subjects: ["activity:technology-selection", "artifact:technology-profile"] },
  { owner: "Data Steward", subjects: ["artifact:source-baseline"] },
  { owner: "QA/Test Lead", subjects: [
    "artifact:assurance-strategy", "test-level:service", "test-level:system", "test-level:acceptance",
    "evidence-obligation:test-results",
  ] },
  { owner: "Software Engineer", subjects: ["test-method:unit-testing", "test-level:component"] },
  { owner: "Integration/API Owner", subjects: ["test-method:integration-testing", "test-method:consumer-contract-testing"] },
  { owner: "DevOps/Platform Owner", subjects: ["capability:managed-staging"] },
  { owner: "Technical Lead", subjects: ["phase:implementation-verification"] },
  { owner: "Technical Lead", accountableApprover: "Engineering Authority", subjects: ["approval:implementation"] },
  { owner: "Release Manager", subjects: ["phase:release-operation-learning", "artifact:release-evidence"] },
  { owner: "Release Manager", accountableApprover: "Release Authority", subjects: ["approval:release"] },
  { owner: "SRE/Operations Owner", subjects: ["evidence-obligation:rollback-operability"] },
]

export function standardInitiativeApplicabilityRoleCoverage(
  context: InitiativeApplicabilityContext,
): StandardApplicabilityRoleRecommendation[] {
  const bySubject = new Map<string, { owner: string; accountableApprover?: string }>()
  for (const group of standardRoleGroups) {
    for (const key of group.subjects) {
      if (bySubject.has(key)) throw new Error(`Standard applicability role coverage duplicates '${key}'`)
      bySubject.set(key, { owner: group.owner, accountableApprover: group.accountableApprover })
    }
  }
  return context.catalog.subjects.map((subject) => {
    const recommendation = bySubject.get(subjectKey(subject))
    if (!recommendation) throw new Error(`Standard applicability role coverage is missing '${subjectKey(subject)}'`)
    return { subject: { ...subject }, ...recommendation }
  })
}

function standardRoleCoverageBrief(context: InitiativeApplicabilityContext): string {
  return standardInitiativeApplicabilityRoleCoverage(context).map((recommendation) =>
    `- ${subjectKey(recommendation.subject)} — candidate owner: ${recommendation.owner}${recommendation.accountableApprover ? `; candidate accountable approver: ${recommendation.accountableApprover}` : ""}`
  ).join("\n")
}

const proposalShape = `{
  "groups": [{
    "status": "required|recommended|optional|not-applicable|deferred|conditionally-required|blocked|awaiting-human-decision",
    "subjects": ["type:key", "type:key"],
    "rationale": "concise, at least 10 characters",
    "owner": "human role or identity",
    "accountableApprover": "human role when awaiting a human decision; otherwise null",
    "condition": "required for deferred, conditionally-required, or blocked; otherwise null",
    "reviewTrigger": "one explicit trigger"
  }],
  "unresolvedSubjects": [{"subject":"type:key","reason":"...","owner":"human role or identity"}]
}`

export function initiativeApplicabilityQuestion(state: InitiativeApplicabilityChatState): {
  key: string
  title: string
  prompt: string
} {
  return {
    key: "initiative-applicability",
    title: "Initiative applicability brief",
    prompt: [
      state.currentApplicability
        ? `Revise the current governed applicability matrix for Initiative '${state.initiative.title}' in Product '${state.product.name}'.`
        : `Resolve the canonical applicability catalog for Initiative '${state.initiative.title}' in Product '${state.product.name}'.`,
      `The current governed classification is '${state.classification.primaryType}' with owner '${state.classification.owner}'.`,
      ...(state.currentApplicability ? [
        "The complete current matrix is supplied in acceptedAnswers. Preserve every unaffected decision exactly in meaning, revise only decisions supported by the latest human answer, and return one complete replacement matrix rather than a patch.",
      ] : []),
      "Challenge the human brief, then return proposedAnswer as JSON text using exactly the compact shape below.",
      "Represent every canonical subject exactly once across decisions and unresolvedSubjects. Absence never means not-applicable.",
      "Use only the exact subject keys, status tokens, and source-kind tokens shown here. Do not invent policies, approvals, records, authorities, dependencies, or implementation truth.",
      "If a subject cannot be decided from governed facts and the human brief, place it in unresolvedSubjects with an explicit reason and human owner.",
      "AI cannot approve, reject, satisfy, or reuse anything. If an exact related governed record is not supplied, keep that subject unresolved instead of using already-satisfied or reused.",
      "Use awaiting-human-decision only with an accountableApprover. Deferred, conditionally-required, and blocked decisions require a condition. Every decision requires one reviewTrigger.",
      "GAEP supplies one editable standard candidate owner for every canonical subject below. Use that candidate owner in every decision or unresolved subject unless the latest human input explicitly overrides it. A candidate role is not an appointment, approval, authority grant, or governed fact.",
      "Group subjects that share the exact same status, rationale, owner, approver, condition, and review trigger. Keep the number of groups and all text concise. GAEP expands groups into the full per-subject matrix and deterministically supplies repetitive source, approval-boundary, empty dependency, and empty related-record fields after validation.",
      "Return proposedAnswer as JSON text, not Markdown.",
      "",
      "Compact proposedAnswer shape:",
      proposalShape,
      "",
      `Canonical catalog (${state.catalog.subjects.length} subjects; ${state.catalog.catalogVersion}; ${state.catalog.digest}):`,
      canonicalSubjects(state),
      "",
      "GAEP standard candidate role coverage (editable by the human):",
      standardRoleCoverageBrief(state),
    ].join("\n"),
  }
}

export function suggestedInitiativeApplicabilityBrief(_state: InitiativeApplicabilityContext): string {
  return [
    "Use the complete governed Product, Initiative, Classification, included scope, and explicit exclusions supplied in GAEP context as the only factual basis for this applicability assessment.",
    "Do not repeat those records in the proposal; apply them to the canonical catalog.",
    "Assess every canonical lifecycle, artifact, capability, testing, approval, and evidence subject against those governed facts.",
    "Treat work supported by the included scope as required, recommended, or optional only when the rationale is explicit. Treat an exclusion as deferred or not-applicable only when the governed facts support that exact status and condition.",
    "Where status, evidence, owner, accountable approver, dependency, condition, or review trigger is not established, keep the subject explicitly unresolved for a human decision. Never infer not-applicable from silence.",
    "Do not claim approved or rejected status. Do not claim already-satisfied or reused records unless an exact governed record identity, revision, and digest already exists in the supplied context.",
    "Use GAEP's supplied standard candidate role for every subject unless the human overrides it. These roles are recommendations, not appointments, approvals, or governed facts.",
  ].join("\n\n")
}

const existingSystemSubjectKeys = new Set([
  "phase:existing-system-assessment",
  "activity:existing-system-discovery",
])

const runtimeAiSubjectKeys = new Set([
  "capability:governed-agent-execution",
  "capability:provider-model-handoff",
])

const humanAiChallengeSubjectKey = "activity:human-ai-challenge"
const approvalEvidenceSubjectKey = "evidence-obligation:approval"
const technologySubjectKeys = new Set([
  "activity:technology-selection",
  "artifact:technology-profile",
])
const lifecycleAiSubjectKeys = new Set([
  humanAiChallengeSubjectKey,
  ...runtimeAiSubjectKeys,
])

export function initiativeApplicabilityLifecycleAiCorrections(
  state: InitiativeApplicabilityChatState,
): string[] {
  const matrix = state.pending?.matrix ?? state.currentApplicability
  if (!matrix) return []
  const unresolved = new Set(matrix.unresolvedSubjects.map((entry) => subjectKey(entry.subject)))
  return matrix.decisions
    .filter((decision) => lifecycleAiSubjectKeys.has(subjectKey(decision.subject)) &&
      decision.status !== "required" && !unresolved.has(subjectKey(decision.subject)))
    .map((decision) => subjectKey(decision.subject))
}

export function suggestedUnresolvedApplicabilityClarification(
  state: InitiativeApplicabilityChatState,
): string | undefined {
  const matrix = state.pending?.matrix ?? state.currentApplicability
  const unresolved = matrix?.unresolvedSubjects ?? []
  const pendingHumanDecisionKeys = matrix?.decisions
    .filter((decision) => decision.status === "awaiting-human-decision" || decision.approval.state === "pending")
    .map((decision) => subjectKey(decision.subject)) ?? []
  const lifecycleAiCorrections = initiativeApplicabilityLifecycleAiCorrections(state)
  if (unresolved.length === 0 && pendingHumanDecisionKeys.length === 0 && lifecycleAiCorrections.length === 0) return undefined
  const keys = new Set([
    ...unresolved.map((entry) => subjectKey(entry.subject)),
    ...pendingHumanDecisionKeys,
    ...lifecycleAiCorrections,
  ])
  const proposals: string[] = []
  const standardRoles = new Map(standardInitiativeApplicabilityRoleCoverage(state).map((recommendation) => [
    subjectKey(recommendation.subject), recommendation,
  ]))

  if ([...existingSystemSubjectKeys].some((key) => keys.has(key))) {
    if (state.classification.systemState === "greenfield" ||
        (state.classification.systemState === "unknown" && state.classification.changePosture === "new")) {
      proposals.push([
        "Delivery-context proposal: treat this Initiative as greenfield and treat the existing-system subjects as not-applicable.",
        `Basis: systemState=${state.classification.systemState} and changePosture=${state.classification.changePosture}.`,
        "Review trigger: reassess if an existing deployed system, migration, replacement, or brownfield integration enters scope.",
      ].join(" "))
    } else if (["brownfield", "mixed"].includes(state.classification.systemState) ||
               ["existing", "replacement", "modernization", "migration"].includes(state.classification.changePosture)) {
      proposals.push([
        "Delivery-context proposal: treat existing-system assessment and discovery as required.",
        `Basis: systemState=${state.classification.systemState} and changePosture=${state.classification.changePosture}.`,
        "Review trigger: reassess when the deployed baseline, migration boundary, or replacement scope changes.",
      ].join(" "))
    } else {
      proposals.push("Delivery-context proposal: preserve the existing-system subjects as unresolved and ask the Product Owner to choose greenfield, brownfield, or mixed delivery context.")
    }
  }

  if (keys.has(humanAiChallengeSubjectKey)) {
    proposals.push([
      `Lifecycle human-AI correction: replace any existing decision for ${humanAiChallengeSubjectKey} and mark it required for this Initiative because the active governed advisor is ${state.advisor.agentLabel} · ${state.advisor.modelLabel}.`,
      "This decision applies to AI-assisted lifecycle/discovery work and does not assert that the delivered Product runtime contains AI.",
      "Owner: AI Governance Owner. Review trigger: reassess when AI-assisted lifecycle participation or its governance boundary changes.",
    ].join(" "))
  }

  if ([...runtimeAiSubjectKeys].some((key) => keys.has(key))) {
    proposals.push([
      "Lifecycle agent correction: replace any existing decisions for capability:governed-agent-execution and capability:provider-model-handoff and mark both required for the GAEP-assisted Initiative workflow because an explicit governed advisor/provider/model selection is active.",
      "Scope the rationale to lifecycle tooling, not to intelligent behavior inside the delivered Marine Shipping runtime.",
      "Owner: AI Governance Owner. Review trigger: reassess when the selected advisor, provider, model, execution boundary, or target-runtime AI decision changes.",
      "Preserve the separate Classification question about future AI inside the delivered Product runtime.",
    ].join(" "))
  }

  const affectedApprovalKeys = [...keys].filter((key) => key.startsWith("approval:"))
  for (const key of affectedApprovalKeys) {
    const recommendation = standardRoles.get(key)
    if (!recommendation?.accountableApprover) continue
    proposals.push([
      `Approval-applicability proposal: replace the current row for ${key} and mark the approval checkpoint required in this Initiative's governance plan.`,
      `Candidate owner: ${recommendation.owner}; candidate accountable approver: ${recommendation.accountableApprover}.`,
      "This decides applicability and role responsibility only; it is not a named appointment, approval decision, or authority grant. Keep the later approval checkpoint itself ungranted.",
      "Review trigger: reassess when the accountable person, delegation, or gate requirement is formally recorded.",
    ].join(" "))
  }

  if (keys.has(approvalEvidenceSubjectKey)) {
    const recommendation = standardRoles.get(approvalEvidenceSubjectKey)
    proposals.push([
      `Approval-evidence proposal: mark ${approvalEvidenceSubjectKey} conditionally-required.`,
      `Candidate owner: ${recommendation?.owner ?? "Product Owner"}.`,
      "Condition: required when any Initiative, architecture, security, implementation, or release approval gate applies.",
      "Review trigger: reassess when an approval gate, approver, decision, or evidence obligation changes.",
    ].join(" "))
  }

  if (keys.has("activity:identity-authorization-analysis")) {
    proposals.push(state.classification.characteristics.exposure === "internal"
      ? "Identity proposal: recommend identity and authorization analysis for authenticated internal users; keep exact roles and permissions subject to requirements acceptance."
      : "Identity proposal: preserve identity and authorization analysis as unresolved until actors, authentication, authorization, and exposure boundaries are stated.")
  }

  if (keys.has("capability:design-reference-integration")) {
    proposals.push(state.classification.characteristics.userInterface === "ui-bearing"
      ? "Design-reference proposal: make design-reference integration conditionally required, pending governed Source Intake of an applicable design system or screen specification."
      : "Design-reference proposal: keep design-reference integration optional unless a governed design source or UI dependency is introduced.")
  }

  if ([...technologySubjectKeys].some((key) => keys.has(key))) {
    proposals.push([
      "Technology-readiness proposal: replace unresolved technology-selection and technology-profile rows with conditionally-required decisions.",
      "Owner: Software Architect. Condition: required when solution architecture or implementation-readiness work reaches a technology decision or records its selected stack.",
      "This does not select or approve a technology. Review trigger: reassess when architecture constraints, implementation scope, or the selected stack changes.",
    ].join(" "))
  }

  const covered = new Set([
    ...existingSystemSubjectKeys,
    humanAiChallengeSubjectKey,
    ...runtimeAiSubjectKeys,
    ...affectedApprovalKeys,
    approvalEvidenceSubjectKey,
    "activity:identity-authorization-analysis",
    "capability:design-reference-integration",
    ...technologySubjectKeys,
  ])
  const remaining = unresolved.filter((entry) => !covered.has(subjectKey(entry.subject)))
  if (remaining.length > 0) {
    for (const entry of remaining) {
      const key = subjectKey(entry.subject)
      const recommendation = standardRoles.get(key)
      proposals.push([
        `Bounded fallback proposal: replace unresolved ${key} with a conditionally-required decision.`,
        `Candidate owner: ${recommendation?.owner ?? entry.owner}.`,
        `Condition: the subject becomes required when the missing fact identified by this reason is established: ${entry.reason}`,
        "This does not claim the condition is already met. Review trigger: reassess when the missing fact, dependency, or lifecycle scope changes.",
      ].join(" "))
    }
  }

  return [
    "GAEP-generated clarification proposal for human review. It is not a governed fact, appointment, approval, or human confirmation. Correct any false assumption before acceptance.",
    `Current unresolved coverage: ${unresolved.length} subject(s).`,
    `Current decisions awaiting a human applicability decision: ${pendingHumanDecisionKeys.length} subject(s).`,
    `Existing decided rows requiring lifecycle-AI scope correction: ${lifecycleAiCorrections.length} subject(s).`,
    ...(lifecycleAiCorrections.length > 0
      ? [`The revised matrix must replace—not preserve—the current decisions for: ${lifecycleAiCorrections.join(", ")}.`]
      : []),
    ...proposals.map((proposal) => `- ${proposal}`),
    "Ask the advisor to produce a complete revised 49-subject matrix from these candidate defaults. Replace every explicitly addressed row rather than preserving its old unresolved or awaiting-human-decision state. If a genuinely unsafe ambiguity remains, keep only that exact subject unresolved for explicit human handling.",
  ].join("\n")
}

export function startInitiativeApplicabilityChat(
  advisor: ProductChatAdvisorSelection,
  context: InitiativeApplicabilityContext,
): InitiativeApplicabilityChatState {
  return {
    schemaVersion: 1,
    kind: "gaep-initiative-applicability-chat-state",
    phase: "collecting",
    advisor,
    ...context,
  }
}

export function answerInitiativeApplicability(
  state: InitiativeApplicabilityChatState,
  rawAnswer: string,
): { state: InitiativeApplicabilityChatState; challenge?: string } {
  if (state.phase !== "collecting" && state.phase !== "awaiting-approval") {
    return { state, challenge: "Start or resume Initiative applicability before answering." }
  }
  if (rawAnswer.trim().length < 40) {
    return {
      state,
      challenge: "Describe the desired lifecycle depth, required and excluded work, assurance/testing expectations, known owners or approvers, reuse evidence, and any decisions that must remain unresolved.",
    }
  }
  return { state }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a JSON object`)
  return value as Record<string, unknown>
}

function resolveSubject(value: unknown, catalog: readonly InitiativeApplicabilitySubject[]): InitiativeApplicabilitySubject {
  if (typeof value !== "string") throw new Error("Every applicability subject must use one canonical type:key string")
  const subject = catalog.find((candidate) => subjectKey(candidate) === value)
  if (!subject) throw new Error(`Applicability subject '${value}' is not in the current canonical catalog`)
  return { ...subject }
}

export function parseInitiativeApplicabilityProposal(
  value: string,
  context: InitiativeApplicabilityContext,
): InitiativeApplicabilityMatrixInput {
  if (Buffer.byteLength(value) > 192 * 1_024) throw new Error("The proposed Initiative applicability matrix exceeds its governed bound")
  const first = value.indexOf("{")
  const last = value.lastIndexOf("}")
  if (first < 0 || last <= first) throw new Error("The advisor proposal does not contain a JSON Initiative applicability matrix")
  let parsed: unknown
  try {
    parsed = JSON.parse(value.slice(first, last + 1))
  } catch {
    throw new Error("The advisor proposal contains malformed Initiative applicability JSON")
  }
  const proposal = record(parsed, "Initiative applicability proposal")
  const allowed = new Set(["groups", "unresolvedSubjects"])
  if (Object.keys(proposal).some((key) => !allowed.has(key))) throw new Error("The Initiative applicability proposal contains an unsupported field")
  if (!Array.isArray(proposal.groups) || !Array.isArray(proposal.unresolvedSubjects)) {
    throw new Error("The Initiative applicability proposal requires groups and unresolvedSubjects arrays")
  }
  const decisions = proposal.groups.flatMap((value, index) => {
    const candidate = record(value, `Applicability group ${index + 1}`)
    const allowedKeys = new Set([
      "status", "subjects", "rationale", "owner", "accountableApprover", "condition", "reviewTrigger",
    ])
    if (Object.keys(candidate).some((key) => !allowedKeys.has(key))) {
      throw new Error(`Applicability group ${index + 1} contains an unsupported field`)
    }
    if (!Array.isArray(candidate.subjects) || candidate.subjects.length === 0) {
      throw new Error(`Applicability group ${index + 1} requires at least one canonical subject`)
    }
    if (candidate.status === "already-satisfied" || candidate.status === "reused") {
      throw new Error("An AI-assisted applicability proposal cannot claim satisfied or reused records without exact governed record identity")
    }
    const condition = candidate.condition === null || candidate.condition === undefined
      ? undefined
      : candidate.condition
    const accountableApprover = candidate.accountableApprover === null || candidate.accountableApprover === undefined
      ? undefined
      : candidate.accountableApprover
    if (candidate.status === "awaiting-human-decision" && accountableApprover === undefined) {
      throw new Error("Awaiting-human applicability requires an accountableApprover")
    }
    return candidate.subjects.map((subject) => initiativeApplicabilityDecisionInputSchema.parse({
        subject: resolveSubject(subject, context.catalog.subjects),
        status: candidate.status,
        rationale: candidate.rationale,
        sources: [{ kind: "human-decision", reference: "P1-03 interactive applicability brief" }],
        owner: candidate.owner,
        accountableApprover,
        dependencies: [],
        conditions: condition === undefined ? [] : [condition],
        reviewTriggers: [candidate.reviewTrigger],
        approval: {
          state: candidate.status === "awaiting-human-decision" ? "pending" : "not-required",
          conditions: condition === undefined ? [] : [condition],
        },
        relatedRecords: [],
        relatedImplementationUnits: [],
      }))
  })
  const unresolvedSubjects = proposal.unresolvedSubjects.map((value, index) => {
    const candidate = record(value, `Unresolved applicability subject ${index + 1}`)
    const allowedKeys = new Set(["subject", "reason", "owner"])
    if (Object.keys(candidate).some((key) => !allowedKeys.has(key))) {
      throw new Error(`Unresolved applicability subject ${index + 1} contains an unsupported field`)
    }
    return {
      subject: resolveSubject(candidate.subject, context.catalog.subjects),
      reason: candidate.reason,
      owner: candidate.owner,
    }
  })
  const matrix = initiativeApplicabilityMatrixInputSchema.parse({
    subjectCatalog: {
      catalogVersion: context.catalog.catalogVersion,
      digest: context.catalog.digest,
      subjectCount: context.catalog.subjects.length,
    },
    decisions,
    unresolvedSubjects,
  })
  const represented = new Set([
    ...matrix.decisions.map((decision) => subjectKey(decision.subject)),
    ...matrix.unresolvedSubjects.map((entry) => subjectKey(entry.subject)),
  ])
  const expected = new Set(context.catalog.subjects.map(subjectKey))
  if (represented.size !== expected.size || [...expected].some((key) => !represented.has(key))) {
    throw new Error(`The applicability proposal must represent all ${expected.size} canonical subjects exactly once`)
  }
  return matrix
}

export function assessInitiativeApplicability(
  state: InitiativeApplicabilityChatState,
  rawAnswer: string,
  assessment: ProductAnswerAssessment,
): InitiativeApplicabilityChatState {
  const matrix = parseInitiativeApplicabilityProposal(assessment.proposedAnswer, state)
  return {
    ...state,
    phase: "awaiting-approval",
    pending: {
      originalAnswer: rawAnswer.trim(),
      proposedAnswer: assessment.proposedAnswer.trim(),
      matrix,
      assessment: assessment.assessment.trim(),
      strengths: [...assessment.strengths],
      gaps: [...assessment.gaps],
      followUpQuestion: assessment.followUpQuestion?.trim() || undefined,
      round: state.pending ? state.pending.round + 1 : 1,
      advisor: state.advisor,
    },
    accepted: undefined,
  }
}

function repairDiagnostic(error: unknown): string {
  const message = error instanceof Error ? error.message : "The advisor response was not contract-valid"
  return message.replace(/\s+/gu, " ").trim().slice(0, 2_048) || "The advisor response was not contract-valid"
}

function nonRepairableAdvisorFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const code = (error as { code?: unknown }).code
  return code === "cancelled" || code === "provider-unavailable" || code === "provider-failed"
}

export async function assessInitiativeApplicabilityWithAutomaticRepair(
  state: InitiativeApplicabilityChatState,
  rawAnswer: string,
  runAttempt: (input: InitiativeApplicabilityRepairAttempt) => Promise<ProductAnswerAssessment>,
  maximumAttempts = 3,
): Promise<InitiativeApplicabilityRepairResult> {
  let previousAssessment: ProductAnswerAssessment | undefined = state.pending ? {
    assessment: state.pending.assessment,
    strengths: [...state.pending.strengths],
    gaps: [...state.pending.gaps],
    ...(state.pending.followUpQuestion ? { followUpQuestion: state.pending.followUpQuestion } : {}),
    proposedAnswer: state.pending.proposedAnswer,
  } : undefined
  let contractErrors: string[] = []
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    let assessment: ProductAnswerAssessment
    try {
      assessment = await runAttempt({ attempt, contractErrors, previousAssessment })
    } catch (error) {
      if (nonRepairableAdvisorFailure(error)) throw error
      contractErrors = [repairDiagnostic(error)]
      continue
    }
    try {
      const assessed = assessInitiativeApplicability(state, rawAnswer, assessment)
      const repaired = attempt > 1 && assessed.pending
        ? {
            ...assessed,
            pending: {
              ...assessed.pending,
              assessment: `GAEP automatically repaired and contract-validated the current 49-subject matrix on attempt ${attempt}. The advisor assessment below may describe defects found in the preceding candidate. ${assessed.pending.assessment}`,
            },
          }
        : assessed
      return {
        state: repaired,
        attempts: attempt,
      }
    } catch (error) {
      previousAssessment = assessment
      contractErrors = [repairDiagnostic(error)]
    }
  }
  throw new InitiativeApplicabilityRepairError(contractErrors)
}

export function acceptInitiativeApplicability(state: InitiativeApplicabilityChatState): InitiativeApplicabilityChatState {
  if (state.phase !== "awaiting-approval" || !state.pending) {
    throw new Error("There is no assessed Initiative applicability matrix awaiting explicit approval")
  }
  return { ...state, phase: "review", accepted: state.pending.matrix, pending: undefined }
}

export function backInitiativeApplicability(state: InitiativeApplicabilityChatState): InitiativeApplicabilityChatState {
  return { ...state, phase: "collecting", accepted: undefined, pending: undefined }
}

export function changeInitiativeApplicabilityAdvisor(
  state: InitiativeApplicabilityChatState,
  advisor: ProductChatAdvisorSelection,
  preservePending = false,
): InitiativeApplicabilityChatState {
  if (preservePending && state.phase === "awaiting-approval" && state.pending) return { ...state, advisor }
  return {
    ...state,
    advisor,
    phase: state.phase === "awaiting-approval" || state.phase === "review" ? "collecting" : state.phase,
    pending: undefined,
    accepted: undefined,
  }
}

export function initiativeApplicabilityInput(state: InitiativeApplicabilityChatState): InitiativeApplicabilityMatrixInput {
  if (state.phase !== "review" || !state.accepted) throw new Error("The Initiative applicability draft is incomplete")
  return initiativeApplicabilityMatrixInputSchema.parse(state.accepted)
}

function boundedStrings(value: unknown, maximumItems: number, maximumLength: number): value is string[] {
  return Array.isArray(value) && value.length <= maximumItems &&
    value.every((item) => typeof item === "string" && item.length <= maximumLength)
}

export function isInitiativeApplicabilityChatState(value: unknown): value is InitiativeApplicabilityChatState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  const product = candidate.product as Record<string, unknown> | undefined
  const initiative = candidate.initiative as Record<string, unknown> | undefined
  const catalog = candidate.catalog as Record<string, unknown> | undefined
  if (candidate.schemaVersion !== 1 || candidate.kind !== "gaep-initiative-applicability-chat-state" ||
      !["collecting", "awaiting-approval", "review", "committed", "cancelled"].includes(String(candidate.phase)) ||
      typeof candidate.initiativeId !== "string" ||
      typeof candidate.initiativeRevision !== "number" || !Number.isSafeInteger(candidate.initiativeRevision) ||
      typeof candidate.productRevision !== "number" || !Number.isSafeInteger(candidate.productRevision) ||
      !isProductChatAdvisorSelection(candidate.advisor) ||
      !product || typeof product.name !== "string" || typeof product.profile !== "string" || typeof product.summary !== "string" ||
      !initiative || typeof initiative.title !== "string" || typeof initiative.outcome !== "string" ||
      !boundedStrings(initiative.scope, 256, 2_000) || !boundedStrings(initiative.exclusions, 256, 2_000) ||
      !initiativeClassificationInputSchema.safeParse(candidate.classification).success ||
      (candidate.currentApplicability !== undefined &&
        !initiativeApplicabilityMatrixInputSchema.safeParse(candidate.currentApplicability).success) ||
      !catalog || catalog.catalogVersion !== "gaep-initiative-applicability-subjects-v1" ||
      typeof catalog.digest !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(catalog.digest) ||
      !Array.isArray(catalog.subjects) || catalog.subjects.length < 1 ||
      catalog.subjects.some((subject) => !initiativeApplicabilitySubjectSchema.safeParse(subject).success)) return false
  const phase = String(candidate.phase)
  const accepted = initiativeApplicabilityMatrixInputSchema.safeParse(candidate.accepted)
  if (phase === "review" || phase === "committed") return accepted.success && candidate.pending === undefined
  if (candidate.accepted !== undefined) return false
  if (phase !== "awaiting-approval") return candidate.pending === undefined
  const pending = candidate.pending as Record<string, unknown> | undefined
  return !!pending && typeof pending.originalAnswer === "string" && typeof pending.proposedAnswer === "string" &&
    initiativeApplicabilityMatrixInputSchema.safeParse(pending.matrix).success &&
    typeof pending.assessment === "string" && boundedStrings(pending.strengths, 16, 4_096) &&
    boundedStrings(pending.gaps, 16, 4_096) &&
    (pending.followUpQuestion === undefined || typeof pending.followUpQuestion === "string") &&
    typeof pending.round === "number" && Number.isSafeInteger(pending.round) && pending.round >= 1 &&
    isProductChatAdvisorSelection(pending.advisor)
}
