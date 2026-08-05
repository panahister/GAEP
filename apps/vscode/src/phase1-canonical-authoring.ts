import {
  architectureChallengeModelInputSchema,
  authorizationModelInputSchema,
  boundedContextModelInputSchema,
  businessArchitectureBaselineInputSchema,
  businessCapabilityMapInputSchema,
  businessRuleCatalogInputSchema,
  businessUnderstandingInputSchema,
  dataModelInputSchema,
  decisionRegisterInputSchema,
  endToEndTraceabilityInputSchema,
  eventIntegrationModelInputSchema,
  evidenceRegistryInputSchema,
  failureRecoveryModelInputSchema,
  operatingModelInputSchema,
  outcomeModelInputSchema,
  p0P4ReadinessGateInputSchema,
  p5HandoffPackageInputSchema,
  processModelInputSchema,
  riskRegisterInputSchema,
  securityPrivacyAssessmentInputSchema,
  stakeholderModelInputSchema,
  systemSolutionArchitectureInputSchema,
  valueStreamModelInputSchema,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import type { GaepEngine } from "@gaep/engine"
import { toJSONSchema, type ZodType } from "zod"

export const phase1CanonicalRecordKinds = [
  "business-understanding",
  "stakeholder-model",
  "outcome-model",
  "business-capability-map",
  "value-stream-model",
  "operating-model",
  "business-rule-catalog",
  "business-architecture-baseline",
  "system-solution-architecture",
  "bounded-context-model",
  "security-privacy-assessment",
  "process-model",
  "data-model",
  "authorization-model",
  "event-integration-model",
  "failure-recovery-model",
  "architecture-challenge-model",
  "decision-register",
  "risk-register",
  "evidence-registry",
  "end-to-end-traceability",
  "p0-p4-readiness-gate",
  "p5-handoff-package",
] as const

export type Phase1CanonicalRecordKind = typeof phase1CanonicalRecordKinds[number]

interface Definition {
  kind: Phase1CanonicalRecordKind
  label: string
  group: "Product discovery" | "Business architecture" | "Solution and security architecture" |
    "Detailed design and assurance" | "Pre-Figma readiness and handoff"
  schema: ZodType
}

const definitions: readonly Definition[] = [
  { kind: "business-understanding", label: "Business Understanding", group: "Product discovery", schema: businessUnderstandingInputSchema },
  { kind: "stakeholder-model", label: "Stakeholder and Role Model", group: "Product discovery", schema: stakeholderModelInputSchema },
  { kind: "outcome-model", label: "Outcome and Success Model", group: "Product discovery", schema: outcomeModelInputSchema },
  { kind: "business-capability-map", label: "Business Capability Map", group: "Business architecture", schema: businessCapabilityMapInputSchema },
  { kind: "value-stream-model", label: "Value Stream Model", group: "Business architecture", schema: valueStreamModelInputSchema },
  { kind: "operating-model", label: "Operating Model", group: "Business architecture", schema: operatingModelInputSchema },
  { kind: "business-rule-catalog", label: "Business Rule Catalog", group: "Business architecture", schema: businessRuleCatalogInputSchema },
  { kind: "business-architecture-baseline", label: "Business Architecture Baseline Candidate", group: "Business architecture", schema: businessArchitectureBaselineInputSchema },
  { kind: "system-solution-architecture", label: "System and Solution Architecture", group: "Solution and security architecture", schema: systemSolutionArchitectureInputSchema },
  { kind: "bounded-context-model", label: "Bounded Context and Ownership Model", group: "Solution and security architecture", schema: boundedContextModelInputSchema },
  { kind: "security-privacy-assessment", label: "Security, Privacy, and Threat Assessment", group: "Solution and security architecture", schema: securityPrivacyAssessmentInputSchema },
  { kind: "process-model", label: "Event Storming and Process Model", group: "Detailed design and assurance", schema: processModelInputSchema },
  { kind: "data-model", label: "Data Model", group: "Detailed design and assurance", schema: dataModelInputSchema },
  { kind: "authorization-model", label: "Authorization Model", group: "Detailed design and assurance", schema: authorizationModelInputSchema },
  { kind: "event-integration-model", label: "Event and Integration Model", group: "Detailed design and assurance", schema: eventIntegrationModelInputSchema },
  { kind: "failure-recovery-model", label: "Failure and Recovery Model", group: "Detailed design and assurance", schema: failureRecoveryModelInputSchema },
  { kind: "architecture-challenge-model", label: "Architecture Challenge Model", group: "Detailed design and assurance", schema: architectureChallengeModelInputSchema },
  { kind: "decision-register", label: "Decision Register", group: "Detailed design and assurance", schema: decisionRegisterInputSchema },
  { kind: "risk-register", label: "Risk Register", group: "Detailed design and assurance", schema: riskRegisterInputSchema },
  { kind: "evidence-registry", label: "Evidence Registry", group: "Detailed design and assurance", schema: evidenceRegistryInputSchema },
  { kind: "end-to-end-traceability", label: "End-to-End Traceability", group: "Detailed design and assurance", schema: endToEndTraceabilityInputSchema },
  { kind: "p0-p4-readiness-gate", label: "Pre-Figma Readiness Assessment", group: "Pre-Figma readiness and handoff", schema: p0P4ReadinessGateInputSchema },
  { kind: "p5-handoff-package", label: "Pre-Figma Handoff Package", group: "Pre-Figma readiness and handoff", schema: p5HandoffPackageInputSchema },
]

export const phase1CanonicalRecordCatalog = definitions.map(({ kind, label, group }) => ({
  kind,
  label,
  group,
}))

function definition(kind: Phase1CanonicalRecordKind): Definition {
  const found = definitions.find((candidate) => candidate.kind === kind)
  if (!found) throw new Error(`Unknown Product Journey record kind: ${kind}`)
  return found
}

function exactReference(value: { id: string; revision: number }): object {
  return { recordId: value.id, revision: value.revision, digest: canonicalDigest(value) }
}

async function currentRecords(engine: GaepEngine, initiativeId: string): Promise<Record<Phase1CanonicalRecordKind, unknown>> {
  const [
    business, stakeholder, outcome, capability, valueStream, operating, rules, businessBaseline,
    solution, boundedContext, security, process, data, authorization, integration, recovery,
    challenge, decisions, risks, evidence, traceability, readiness, handoff,
  ] = await Promise.all([
    engine.businessUnderstanding.readCurrentBusinessUnderstanding(initiativeId),
    engine.businessUnderstanding.readCurrentStakeholderModel(initiativeId),
    engine.businessUnderstanding.readCurrentOutcomeModel(initiativeId),
    engine.businessCapabilityMap.readCurrent(initiativeId),
    engine.valueStreamModel.readCurrent(initiativeId),
    engine.operatingModel.readCurrent(initiativeId),
    engine.businessRuleCatalog.readCurrent(initiativeId),
    engine.businessArchitectureBaseline.readCurrent(initiativeId),
    engine.systemSolutionArchitecture.readCurrent(initiativeId),
    engine.boundedContextModel.readCurrent(initiativeId),
    engine.securityPrivacyAssessment.readCurrent(initiativeId),
    engine.processModel.readCurrent(initiativeId),
    engine.dataModel.readCurrent(initiativeId),
    engine.authorizationModel.readCurrent(initiativeId),
    engine.eventIntegrationModel.readCurrent(initiativeId),
    engine.failureRecoveryModel.readCurrent(initiativeId),
    engine.architectureChallengeModel.readCurrent(initiativeId),
    engine.decisionRegister.readCurrent(initiativeId),
    engine.riskRegister.readCurrent(initiativeId),
    engine.evidenceRegistry.readCurrent(initiativeId),
    engine.endToEndTraceability.readCurrent(initiativeId),
    engine.p0P4ReadinessGate.readCurrent(initiativeId),
    engine.p5HandoffPackage.readCurrent(initiativeId),
  ])
  return {
    "business-understanding": business,
    "stakeholder-model": stakeholder,
    "outcome-model": outcome,
    "business-capability-map": capability,
    "value-stream-model": valueStream,
    "operating-model": operating,
    "business-rule-catalog": rules,
    "business-architecture-baseline": businessBaseline,
    "system-solution-architecture": solution,
    "bounded-context-model": boundedContext,
    "security-privacy-assessment": security,
    "process-model": process,
    "data-model": data,
    "authorization-model": authorization,
    "event-integration-model": integration,
    "failure-recovery-model": recovery,
    "architecture-challenge-model": challenge,
    "decision-register": decisions,
    "risk-register": risks,
    "evidence-registry": evidence,
    "end-to-end-traceability": traceability,
    "p0-p4-readiness-gate": readiness,
    "p5-handoff-package": handoff,
  }
}

export interface Phase1AuthoringTarget {
  kind: Phase1CanonicalRecordKind
  label: string
  group: Definition["group"]
  ordinal: number
  total: number
  schema: object
  context: object
  operation: "create" | "revise"
  current?: {
    id: string
    revision: number
    record: unknown
    history: Array<{ revision: number; recordedAt?: string; recordedBy?: string }>
  }
  downstream: Array<{ kind: Phase1CanonicalRecordKind; label: string; recorded: boolean }>
}

type VersionedRecord = {
  id: string
  revision: number
  createdAt?: string
  updatedAt?: string
  createdBy?: unknown
  updatedBy?: unknown
}

function actorLabel(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) return value
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === "string" && id.trim().length > 0) return id
  }
  return undefined
}

async function recordHistory(
  engine: GaepEngine,
  kind: Phase1CanonicalRecordKind,
  id: string,
): Promise<VersionedRecord[]> {
  switch (kind) {
    case "business-understanding": return engine.businessUnderstanding.listBusinessUnderstandingHistory(id)
    case "stakeholder-model": return engine.businessUnderstanding.listStakeholderModelHistory(id)
    case "outcome-model": return engine.businessUnderstanding.listOutcomeModelHistory(id)
    case "business-capability-map": return engine.businessCapabilityMap.listHistory(id)
    case "value-stream-model": return engine.valueStreamModel.listHistory(id)
    case "operating-model": return engine.operatingModel.listHistory(id)
    case "business-rule-catalog": return engine.businessRuleCatalog.listHistory(id)
    case "business-architecture-baseline": return engine.businessArchitectureBaseline.listHistory(id)
    case "system-solution-architecture": return engine.systemSolutionArchitecture.listHistory(id)
    case "bounded-context-model": return engine.boundedContextModel.listHistory(id)
    case "security-privacy-assessment": return engine.securityPrivacyAssessment.listHistory(id)
    case "process-model": return engine.processModel.listHistory(id)
    case "data-model": return engine.dataModel.listHistory(id)
    case "authorization-model": return engine.authorizationModel.listHistory(id)
    case "event-integration-model": return engine.eventIntegrationModel.listHistory(id)
    case "failure-recovery-model": return engine.failureRecoveryModel.listHistory(id)
    case "architecture-challenge-model": return engine.architectureChallengeModel.listHistory(id)
    case "decision-register": return engine.decisionRegister.listHistory(id)
    case "risk-register": return engine.riskRegister.listHistory(id)
    case "evidence-registry": return engine.evidenceRegistry.listHistory(id)
    case "end-to-end-traceability": return engine.endToEndTraceability.listHistory(id)
    case "p0-p4-readiness-gate": return engine.p0P4ReadinessGate.listHistory(id)
    case "p5-handoff-package": return engine.p5HandoffPackage.listHistory(id)
  }
}

export interface Phase1CanonicalRecordedRecord {
  kind: Phase1CanonicalRecordKind
  label: string
  group: Definition["group"]
  id: string
  revision: number
  record: unknown
  history: Array<{ revision: number; recordedAt?: string; recordedBy?: string }>
}

export async function listPhase1CanonicalRecordedRecords(
  engine: GaepEngine,
  initiativeId: string,
): Promise<Phase1CanonicalRecordedRecord[]> {
  const current = await currentRecords(engine, initiativeId)
  const entries: Array<Phase1CanonicalRecordedRecord | undefined> = await Promise.all(definitions.map(async (
    candidate,
  ): Promise<Phase1CanonicalRecordedRecord | undefined> => {
    const value = current[candidate.kind] as VersionedRecord | undefined
    if (!value) return undefined
    const history = await recordHistory(engine, candidate.kind, value.id)
    return {
      kind: candidate.kind,
      label: candidate.label,
      group: candidate.group,
      id: value.id,
      revision: value.revision,
      record: value as unknown,
      history: history.map((entry) => ({
        revision: entry.revision,
        ...(entry.updatedAt ?? entry.createdAt ? { recordedAt: entry.updatedAt ?? entry.createdAt } : {}),
        ...(actorLabel(entry.updatedBy ?? entry.createdBy)
          ? { recordedBy: actorLabel(entry.updatedBy ?? entry.createdBy) }
          : {}),
      })),
    } satisfies Phase1CanonicalRecordedRecord
  }))
  return entries.filter((entry): entry is Phase1CanonicalRecordedRecord => Boolean(entry))
}

export async function nextPhase1AuthoringTarget(
  engine: GaepEngine,
  initiativeId: string,
  requestedKind?: Phase1CanonicalRecordKind,
): Promise<Phase1AuthoringTarget | undefined> {
  const records = await currentRecords(engine, initiativeId)
  const next = requestedKind ? definition(requestedKind) : definitions.find((candidate) => !records[candidate.kind])
  if (!next) return undefined
  const [product, initiative, sources] = await Promise.all([
    engine.readProduct(),
    engine.readInitiative(initiativeId),
    engine.sourceGovernance.listSources(initiativeId),
  ])
  let productDesign: unknown
  try {
    productDesign = await engine.productStudio.readDesignDraft(product.id)
  } catch {
    productDesign = undefined
  }
  const upstream = Object.fromEntries(definitions.flatMap((candidate) => {
    const value = records[candidate.kind]
    return value && typeof value === "object" && "id" in value && "revision" in value
      ? [[candidate.kind, { exactReference: exactReference(value as { id: string; revision: number }), record: value }]]
      : []
  }))
  const sourceReferences = sources.map((source) => ({
    sourceId: source.id,
    sourceRevision: source.revision,
    recordDigest: canonicalDigest(source),
    contentDigest: source.contentDigest,
  })).sort((left, right) => left.sourceId.localeCompare(right.sourceId) || left.sourceRevision - right.sourceRevision)
  const existing = records[next.kind] as VersionedRecord | undefined
  const history = existing ? await recordHistory(engine, next.kind, existing.id) : []
  const downstream = definitions.slice(definitions.indexOf(next) + 1).map((candidate) => ({
    kind: candidate.kind,
    label: candidate.label,
    recorded: Boolean(records[candidate.kind]),
  }))
  return {
    kind: next.kind,
    label: next.label,
    group: next.group,
    ordinal: definitions.indexOf(next) + 1,
    total: definitions.length,
    schema: toJSONSchema(next.schema, { target: "draft-2020-12", unrepresentable: "any" }) as object,
    operation: existing ? "revise" : "create",
    ...(existing ? {
      current: {
        id: existing.id,
        revision: existing.revision,
        record: existing,
        history: history.map((record) => ({
          revision: record.revision,
          ...(record.updatedAt ?? record.createdAt ? { recordedAt: record.updatedAt ?? record.createdAt } : {}),
          ...(actorLabel(record.updatedBy ?? record.createdBy)
            ? { recordedBy: actorLabel(record.updatedBy ?? record.createdBy) }
            : {}),
        })),
      },
    } : {}),
    downstream,
    context: {
      exactBindings: {
        initiativeId,
        context: {
          productRevision: product.revision ?? 1,
          productDigest: canonicalDigest(product),
          initiativeRevision: initiative.revision ?? 1,
          initiativeDigest: canonicalDigest(initiative),
        },
        sourceReferences,
      },
      product,
      initiative,
      ...(productDesign ? { reviewedProductDesignDraft: productDesign } : {}),
      upstream,
      ...(existing ? {
        revisionRequest: {
          currentRecord: existing,
          currentRevision: existing.revision,
          revisionHistory: history,
          downstreamImpact: downstream.filter((candidate) => candidate.recorded),
          instruction: "Revise this exact record. Preserve still-valid facts and explicitly identify changed assumptions and downstream records that require review.",
        },
      } : {}),
      sourceCatalog: sources.map((source) => ({
        title: source.title,
        sourceType: source.sourceType,
        informationClassification: source.informationClassification,
        exactReference: {
          sourceId: source.id,
          sourceRevision: source.revision,
          recordDigest: canonicalDigest(source),
          contentDigest: source.contentDigest,
        },
      })).sort((left, right) => left.title.localeCompare(right.title)),
      authoringRules: [
        "Return exactly one complete input object matching the supplied JSON Schema.",
        "The human is never responsible for knowing or writing this internal schema. Produce the strongest concrete editable candidate that the governed context supports.",
        "When the human asks for help, a suggestion, an example, or says they do not know, draft the answer from Product, Initiative, Sources, reviewed design, and upstream records instead of returning placeholders or asking them to repeat known context.",
        "Copy exact IDs, revisions, digests, source references, and upstream keys; never invent or alter them.",
        "Use only supplied governed facts. Represent missing knowledge as explicit limitations, questions, candidate states, or unresolved evidence where the schema permits.",
        "Keep identifier arrays unique and lexically ordered and sequence arrays in canonical order.",
        "Do not claim approval, appointment, baseline designation, readiness, implementation, release, or action authority.",
        "All human-readable content must be English.",
        ...(next.kind === "process-model" ? [
          "Treat the Process Model as the canonical Event Storming record: identify domain events, commands and triggers, actors, policies and guards, bounded contexts or aggregates, state transitions, and hotspots explicitly.",
        ] : []),
        ...(next.kind === "p0-p4-readiness-gate" ? [
          "Assess the exact governed Product Journey record set for pre-Figma readiness. Identify incomplete, stale, contradictory, or attention-required inputs explicitly; never infer readiness from record presence alone.",
          "This assessment prepares a human decision and grants no design, Figma, implementation, or release authority.",
        ] : []),
        ...(next.kind === "p5-handoff-package" ? [
          "Build an editable pre-Figma handoff from the exact governed Product, Initiative, classification, applicability, Sources, discovery, business architecture, Event Storming, solution and security architecture, data, authorization, integration, recovery, decisions, risks, evidence, and traceability records.",
          "Describe the design questions, constraints, acceptance boundaries, and exact source references a Product Designer needs before creating or updating Figma artifacts.",
          "Do not claim that a Figma file, Figma MCP roundtrip, design approval, implementation, or release has occurred.",
        ] : []),
      ],
    },
  }
}

export function validatePhase1CanonicalDraft(kind: Phase1CanonicalRecordKind, value: unknown): {
  valid: boolean
  value?: unknown
  errors: string[]
} {
  const parsed = definition(kind).schema.safeParse(value)
  if (parsed.success) return { valid: true, value: parsed.data, errors: [] }
  return {
    valid: false,
    errors: parsed.error.issues.slice(0, 24).map((issue) =>
      `${issue.path.length > 0 ? issue.path.join(".") : "root"}: ${issue.message}`),
  }
}

export async function commitPhase1CanonicalDraft(
  engine: GaepEngine,
  kind: Phase1CanonicalRecordKind,
  value: unknown,
  actorId: string,
  current?: { id: string; expectedRevision: number },
): Promise<{ id: string; revision: number; kind: Phase1CanonicalRecordKind; label: string; operation: "created" | "revised" }> {
  const parsed = definition(kind).schema.parse(value) as never
  let record: { id: string; revision: number }
  if (current) switch (kind) {
    case "business-understanding": record = await engine.businessUnderstanding.reviseBusinessUnderstanding(current.id, current.expectedRevision, parsed, actorId); break
    case "stakeholder-model": record = await engine.businessUnderstanding.reviseStakeholderModel(current.id, current.expectedRevision, parsed, actorId); break
    case "outcome-model": record = await engine.businessUnderstanding.reviseOutcomeModel(current.id, current.expectedRevision, parsed, actorId); break
    case "business-capability-map": record = await engine.businessCapabilityMap.revise(current.id, current.expectedRevision, parsed, actorId); break
    case "value-stream-model": record = await engine.valueStreamModel.revise(current.id, current.expectedRevision, parsed, actorId); break
    case "operating-model": record = await engine.operatingModel.revise(current.id, current.expectedRevision, parsed, actorId); break
    case "business-rule-catalog": record = await engine.businessRuleCatalog.revise(current.id, current.expectedRevision, parsed, actorId); break
    case "business-architecture-baseline": record = await engine.businessArchitectureBaseline.revise(current.id, current.expectedRevision, parsed, actorId); break
    case "system-solution-architecture": record = await engine.systemSolutionArchitecture.revise(current.id, current.expectedRevision, parsed, actorId); break
    case "bounded-context-model": record = await engine.boundedContextModel.revise(current.id, current.expectedRevision, parsed, actorId); break
    case "security-privacy-assessment": record = await engine.securityPrivacyAssessment.revise(current.id, current.expectedRevision, parsed, actorId); break
    case "process-model": record = await engine.processModel.revise(current.id, current.expectedRevision, parsed, actorId); break
    case "data-model": record = await engine.dataModel.revise(current.id, current.expectedRevision, parsed, actorId); break
    case "authorization-model": record = await engine.authorizationModel.revise(current.id, current.expectedRevision, parsed, actorId); break
    case "event-integration-model": record = await engine.eventIntegrationModel.revise(current.id, current.expectedRevision, parsed, actorId); break
    case "failure-recovery-model": record = await engine.failureRecoveryModel.revise(current.id, current.expectedRevision, parsed, actorId); break
    case "architecture-challenge-model": record = await engine.architectureChallengeModel.revise(current.id, current.expectedRevision, parsed, actorId); break
    case "decision-register": record = await engine.decisionRegister.revise(current.id, current.expectedRevision, parsed, actorId); break
    case "risk-register": record = await engine.riskRegister.revise(current.id, current.expectedRevision, parsed, actorId); break
    case "evidence-registry": record = await engine.evidenceRegistry.revise(current.id, current.expectedRevision, parsed, actorId); break
    case "end-to-end-traceability": record = await engine.endToEndTraceability.revise(current.id, current.expectedRevision, parsed, actorId); break
    case "p0-p4-readiness-gate": record = await engine.p0P4ReadinessGate.revise(current.id, current.expectedRevision, parsed, actorId); break
    case "p5-handoff-package": record = await engine.p5HandoffPackage.revise(current.id, current.expectedRevision, parsed, actorId); break
  }
  else switch (kind) {
    case "business-understanding": record = await engine.businessUnderstanding.createBusinessUnderstanding(parsed, actorId); break
    case "stakeholder-model": record = await engine.businessUnderstanding.createStakeholderModel(parsed, actorId); break
    case "outcome-model": record = await engine.businessUnderstanding.createOutcomeModel(parsed, actorId); break
    case "business-capability-map": record = await engine.businessCapabilityMap.create(parsed, actorId); break
    case "value-stream-model": record = await engine.valueStreamModel.create(parsed, actorId); break
    case "operating-model": record = await engine.operatingModel.create(parsed, actorId); break
    case "business-rule-catalog": record = await engine.businessRuleCatalog.create(parsed, actorId); break
    case "business-architecture-baseline": record = await engine.businessArchitectureBaseline.create(parsed, actorId); break
    case "system-solution-architecture": record = await engine.systemSolutionArchitecture.create(parsed, actorId); break
    case "bounded-context-model": record = await engine.boundedContextModel.create(parsed, actorId); break
    case "security-privacy-assessment": record = await engine.securityPrivacyAssessment.create(parsed, actorId); break
    case "process-model": record = await engine.processModel.create(parsed, actorId); break
    case "data-model": record = await engine.dataModel.create(parsed, actorId); break
    case "authorization-model": record = await engine.authorizationModel.create(parsed, actorId); break
    case "event-integration-model": record = await engine.eventIntegrationModel.create(parsed, actorId); break
    case "failure-recovery-model": record = await engine.failureRecoveryModel.create(parsed, actorId); break
    case "architecture-challenge-model": record = await engine.architectureChallengeModel.create(parsed, actorId); break
    case "decision-register": record = await engine.decisionRegister.create(parsed, actorId); break
    case "risk-register": record = await engine.riskRegister.create(parsed, actorId); break
    case "evidence-registry": record = await engine.evidenceRegistry.create(parsed, actorId); break
    case "end-to-end-traceability": record = await engine.endToEndTraceability.create(parsed, actorId); break
    case "p0-p4-readiness-gate": record = await engine.p0P4ReadinessGate.create(parsed, actorId); break
    case "p5-handoff-package": record = await engine.p5HandoffPackage.create(parsed, actorId); break
  }
  return { id: record.id, revision: record.revision, kind, label: definition(kind).label, operation: current ? "revised" : "created" }
}
