import {
  initiativeApplicabilityMatrixInputSchema,
  initiativeApplicabilitySubjectDefinitions,
  initiativeClassificationInputSchema,
  type InitiativeApplicabilityDecisionInput,
  type InitiativeApplicabilityMatrixInput,
  type InitiativeApplicabilityStatus,
  type InitiativeApplicabilitySubject,
  type InitiativeClassificationInput,
  type InitiativeType,
} from "./product.js"

const unresolvedCatalogSubjectReason =
  "No explicit applicability decision was recorded in this review; accountable resolution remains required."

export class InitiativeEntryWorkflowCancelled extends Error {
  constructor() {
    super("GAEP Initiative entry workflow cancelled")
  }
}

export interface InitiativeEntryWorkflowUi {
  pick<T extends string>(title: string, options: readonly T[]): Promise<T | undefined>
  pickMany<T extends string>(title: string, options: readonly T[], minimum?: number): Promise<T[] | undefined>
  input(prompt: string, options?: { required?: boolean; value?: string; secret?: boolean }): Promise<string | undefined>
  confirm(message: string, acceptLabel: string): Promise<boolean>
}

const initiativeTypes = [
  "product", "platform", "product-increment", "feature", "epic", "backlog-item", "service", "module",
  "client-application", "mobile-application", "api", "integration", "migration", "modernization", "refactoring",
  "technical-debt-remediation", "security-remediation", "infrastructure", "devops", "observability", "library", "sdk",
  "cli", "worker", "event-processor", "defect-fix", "experiment", "research", "data-capability", "ai-capability",
] as const satisfies readonly InitiativeType[]

const applicabilityStatuses = [
  "required", "recommended", "optional", "not-applicable", "deferred", "conditionally-required", "already-satisfied",
  "reused", "blocked", "awaiting-human-decision",
] as const satisfies readonly InitiativeApplicabilityStatus[]

const subjectTypes = [
  "phase", "activity", "artifact", "capability", "test-method", "test-level", "approval", "evidence-obligation",
] as const satisfies readonly InitiativeApplicabilitySubject["type"][]

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new InitiativeEntryWorkflowCancelled()
  return value
}

function requiredText(value: string | undefined): string {
  const text = required(value).trim()
  if (!text) throw new Error("A required Initiative entry value was empty")
  return text
}

function list(value: string | undefined): string[] {
  if (value === undefined) throw new InitiativeEntryWorkflowCancelled()
  return [...new Set(value.split(",").map((entry) => entry.trim()).filter(Boolean))]
}

function identifiers(value: string | undefined): string[] {
  return list(value)
}

async function subject(ui: InitiativeEntryWorkflowUi, prefix: string): Promise<InitiativeApplicabilitySubject> {
  return {
    type: required(await ui.pick(`${prefix} subject type`, subjectTypes)),
    key: requiredText(await ui.input(`${prefix} stable subject key (lower-case letters, numbers, dots or hyphens)`)),
    label: requiredText(await ui.input(`${prefix} human-readable subject label`)),
  }
}

export async function collectInitiativeClassification(
  ui: InitiativeEntryWorkflowUi,
): Promise<InitiativeClassificationInput> {
  const primaryType = required(await ui.pick("Primary Initiative type", initiativeTypes))
  const secondaryTypes = required(await ui.pickMany(
    "Secondary Initiative types (optional)",
    initiativeTypes.filter((candidate) => candidate !== primaryType),
  ))
  const regulated = required(await ui.pick("Is this Initiative regulated?", ["yes", "no"] as const)) === "yes"
  const input: InitiativeClassificationInput = {
    primaryType,
    secondaryTypes,
    systemState: required(await ui.pick("System state", ["greenfield", "brownfield", "mixed", "unknown"] as const)),
    changePosture: required(await ui.pick(
      "Change posture",
      ["new", "existing", "replacement", "modernization", "migration", "retirement", "mixed"] as const,
    )),
    motivations: required(await ui.pickMany(
      "Motivations",
      ["business-driven", "technical", "regulatory", "operational", "security-driven", "mixed"] as const,
      1,
    )),
    characteristics: {
      userInterface: required(await ui.pick("User-interface characteristic", ["ui-bearing", "non-ui", "unknown"] as const)),
      data: required(await ui.pick("Data characteristic", ["data-bearing", "stateless", "unknown"] as const)),
      integration: required(await ui.pick("Integration characteristic", ["integration-heavy", "isolated", "mixed", "unknown"] as const)),
      interactionModes: required(await ui.pickMany(
        "Interaction modes",
        ["synchronous", "asynchronous", "batch", "streaming", "interactive", "mixed"] as const,
        1,
      )),
      exposure: required(await ui.pick("Exposure", ["internal", "partner", "public", "mixed", "unknown"] as const)),
    },
    regulated,
    policyDomains: identifiers(await ui.input("Policy domains, separated by commas (optional)", { required: false })),
    sensitivities: required(await ui.pickMany(
      "Sensitivities",
      ["security", "privacy", "data", "safety", "financial", "operational", "none", "unknown"] as const,
      1,
    )),
    expectedLifetime: required(await ui.pick(
      "Expected lifetime",
      ["short-lived", "medium-term", "long-lived", "indefinite", "unknown"] as const,
    )),
    maintenanceHorizon: requiredText(await ui.input("Maintenance horizon")),
    risk: {
      blastRadius: required(await ui.pick("Risk: blast radius", ["localized", "multi-unit", "organization", "external", "unknown"] as const)),
      reversibility: required(await ui.pick("Risk: reversibility", ["reversible", "partially-reversible", "irreversible", "unknown"] as const)),
      urgency: required(await ui.pick("Risk: urgency", ["low", "normal", "high", "critical", "unknown"] as const)),
      costOfFailure: required(await ui.pick("Risk: cost of failure", ["low", "medium", "high", "critical", "unknown"] as const)),
    },
    dependencies: list(await ui.input("Dependencies, separated by commas (optional)", { required: false })),
    affectedAssets: list(await ui.input("Affected assets, separated by commas (optional)", { required: false })),
    owner: requiredText(await ui.input("Initiative classification owner")),
    accountableAuthority: requiredText(await ui.input("Accountable human authority")),
    confidence: {
      level: required(await ui.pick("Classification confidence", ["low", "medium", "high"] as const)),
      basis: requiredText(await ui.input("Evidence-based confidence rationale")),
    },
    evidence: [{
      kind: required(await ui.pick(
        "Primary classification evidence kind",
        ["rule", "policy", "evidence", "requirement", "dependency", "human-decision"] as const,
      )),
      reference: requiredText(await ui.input("Primary classification evidence reference")),
    }],
    unresolvedQuestions: list(await ui.input("Unresolved classification questions, separated by commas (optional)", { required: false })),
    rationale: requiredText(await ui.input("Classification rationale (at least 10 characters)")),
  }
  const parsed = initiativeClassificationInputSchema.parse(input)
  const accepted = await ui.confirm(
    `Record ${parsed.primaryType} classification with ${parsed.secondaryTypes.length} secondary type(s), ${parsed.evidence.length} evidence reference(s), and ${parsed.unresolvedQuestions.length} unresolved question(s)? Classification guides profile selection only and grants no approval or action authority.`,
    "Record Exact Classification",
  )
  if (!accepted) throw new InitiativeEntryWorkflowCancelled()
  return parsed
}

async function collectDecision(
  ui: InitiativeEntryWorkflowUi,
  actorId: string,
  now: () => string,
  index: number,
): Promise<InitiativeApplicabilityDecisionInput> {
  const currentSubject = await subject(ui, `Decision ${index}`)
  const status = required(await ui.pick(`Decision ${index} status`, applicabilityStatuses))
  const approvalState = status === "awaiting-human-decision"
    ? "pending" as const
    : required(await ui.pick(`Decision ${index} approval state`, ["not-required", "pending", "approved", "rejected"] as const))
  const conditions = list(await ui.input(
    `Decision ${index} conditions, separated by commas${["deferred", "conditionally-required", "blocked"].includes(status) ? " (required)" : " (optional)"}`,
    { required: ["deferred", "conditionally-required", "blocked"].includes(status) },
  ))
  const relatedRecords: InitiativeApplicabilityDecisionInput["relatedRecords"] = []
  if (status === "already-satisfied" || status === "reused") {
    relatedRecords.push({
      recordType: requiredText(await ui.input(`Decision ${index} related record type`)),
      recordId: requiredText(await ui.input(`Decision ${index} related record UUID`)),
      revision: Number(requiredText(await ui.input(`Decision ${index} related record revision`))),
      digest: requiredText(await ui.input(`Decision ${index} related record SHA-256 digest`)),
    })
  }
  return {
    subject: currentSubject,
    status,
    rationale: requiredText(await ui.input(`Decision ${index} rationale (at least 10 characters)`)),
    sources: [{
      kind: required(await ui.pick(
        `Decision ${index} primary source kind`,
        ["rule", "policy", "evidence", "requirement", "dependency", "human-decision"] as const,
      )),
      reference: requiredText(await ui.input(`Decision ${index} primary source reference`)),
    }],
    owner: requiredText(await ui.input(`Decision ${index} owner`)),
    ...((approvalState !== "not-required" || status === "awaiting-human-decision")
      ? { accountableApprover: requiredText(await ui.input(`Decision ${index} accountable approver`)) }
      : {}),
    dependencies: identifiers(await ui.input(`Decision ${index} dependency keys, separated by commas (optional)`, { required: false })),
    conditions,
    reviewTriggers: list(await ui.input(`Decision ${index} review triggers, separated by commas`, { required: true })),
    approval: {
      state: approvalState,
      conditions: list(await ui.input(`Decision ${index} approval conditions, separated by commas (optional)`, { required: false })),
      ...((approvalState === "approved" || approvalState === "rejected")
        ? { decidedBy: { kind: "human" as const, id: actorId }, decidedAt: now() }
        : {}),
    },
    relatedRecords,
    relatedImplementationUnits: identifiers(await ui.input(
      `Decision ${index} related implementation-unit keys, separated by commas (optional)`,
      { required: false },
    )),
  }
}

export async function collectInitiativeApplicability(
  ui: InitiativeEntryWorkflowUi,
  actorId: string,
  now: () => string = () => new Date().toISOString(),
): Promise<InitiativeApplicabilityMatrixInput> {
  const decisions: InitiativeApplicabilityDecisionInput[] = []
  while (true) {
    const operation = required(await ui.pick(
      decisions.length === 0 ? "Add the first applicability decision" : "Add another applicability decision or continue",
      decisions.length === 0 ? ["add-decision"] as const : ["add-decision", "continue"] as const,
    ))
    if (operation === "continue") break
    decisions.push(await collectDecision(ui, actorId, now, decisions.length + 1))
  }
  const unresolvedSubjects: InitiativeApplicabilityMatrixInput["unresolvedSubjects"] = []
  while (true) {
    const operation = required(await ui.pick(
      "Record an unresolved subject or finish the matrix",
      ["add-unresolved-subject", "finish"] as const,
    ))
    if (operation === "finish") break
    unresolvedSubjects.push({
      subject: await subject(ui, `Unresolved subject ${unresolvedSubjects.length + 1}`),
      reason: requiredText(await ui.input(`Unresolved subject ${unresolvedSubjects.length + 1} reason`)),
      owner: requiredText(await ui.input(`Unresolved subject ${unresolvedSubjects.length + 1} owner`)),
    })
  }
  const parsed = completeInitiativeApplicabilityCoverage({ decisions, unresolvedSubjects }, actorId)
  const accepted = await ui.confirm(
    `Record ${parsed.decisions.length} explicit applicability decision(s) and ${parsed.unresolvedSubjects.length} unresolved subject(s)? Every canonical subject is represented exactly once; absence is never treated as not applicable, and this matrix grants no approval, readiness, or action authority.`,
    "Record Exact Applicability Matrix",
  )
  if (!accepted) throw new InitiativeEntryWorkflowCancelled()
  return parsed
}

export function completeInitiativeApplicabilityCoverage(
  input: InitiativeApplicabilityMatrixInput,
  unresolvedOwner: string,
): InitiativeApplicabilityMatrixInput {
  const parsed = initiativeApplicabilityMatrixInputSchema.parse(input)
  const catalog = new Map(initiativeApplicabilitySubjectDefinitions.map((subject) => [
    `${subject.type}:${subject.key}`,
    subject,
  ]))
  const represented = new Set<string>()
  for (const subject of [
    ...parsed.decisions.map((decision) => decision.subject),
    ...parsed.unresolvedSubjects.map((unresolved) => unresolved.subject),
  ]) {
    const key = `${subject.type}:${subject.key}`
    const canonical = catalog.get(key)
    if (!canonical || canonical.label !== subject.label) {
      throw new Error(`Applicability subject ${key} does not match the canonical catalog`)
    }
    represented.add(key)
  }
  return initiativeApplicabilityMatrixInputSchema.parse({
    ...parsed,
    unresolvedSubjects: [
      ...parsed.unresolvedSubjects,
      ...initiativeApplicabilitySubjectDefinitions
        .filter((subject) => !represented.has(`${subject.type}:${subject.key}`))
        .map((subject) => ({
          subject: { ...subject },
          reason: unresolvedCatalogSubjectReason,
          owner: unresolvedOwner,
        })),
    ],
  })
}
