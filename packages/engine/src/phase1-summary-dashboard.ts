import { canonicalDigest } from "@gaep/agent-sdk"
import {
  initiativeSchema,
  p0P4ReadinessGateProjectionSchema,
  p5HandoffPackageProjectionSchema,
  phase1SummaryDashboardContentSchema,
  phase1SummaryDashboardRequestSchema,
  phase1SummaryDashboardSchema,
  productSchema,
  type Initiative,
  type P0P4ReadinessGateProjection,
  type P5HandoffPackageProjection,
  type Phase1SummaryDashboard,
  type Phase1SummaryDashboardRequest,
  type Product,
} from "@gaep/contracts"

export class Phase1SummaryBindingError extends Error {
  constructor() {
    super("The requested Phase 1 summary bindings are not current")
    this.name = "Phase1SummaryBindingError"
  }
}

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function total(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0)
}

export function composePhase1SummaryDashboard(
  productValue: Product,
  initiativeValue: Initiative,
  readinessValue: P0P4ReadinessGateProjection,
  handoffValue: P5HandoffPackageProjection,
  requestValue: Phase1SummaryDashboardRequest,
  observedAt = new Date().toISOString(),
): Phase1SummaryDashboard {
  const product = productSchema.parse(productValue)
  const initiative = initiativeSchema.parse(initiativeValue)
  const readiness = p0P4ReadinessGateProjectionSchema.parse(readinessValue)
  const handoff = p5HandoffPackageProjectionSchema.parse(handoffValue)
  const request = phase1SummaryDashboardRequestSchema.parse(requestValue)
  const productRevision = revisionOf(product)
  const productDigest = canonicalDigest(product)
  const initiativeRevision = revisionOf(initiative)
  const initiativeDigest = canonicalDigest(initiative)
  const exactProduct = request.expectedProductId.toLowerCase() === product.id.toLowerCase() &&
    request.expectedProductRevision === productRevision && request.expectedProductDigest === productDigest
  const exactInitiative = request.expectedInitiativeId.toLowerCase() === initiative.id.toLowerCase() &&
    request.expectedInitiativeRevision === initiativeRevision && request.expectedInitiativeDigest === initiativeDigest &&
    initiative.productId.toLowerCase() === product.id.toLowerCase()
  const exactReadiness = readiness.product.id.toLowerCase() === product.id.toLowerCase() &&
    readiness.product.revision === productRevision && readiness.product.digest === productDigest &&
    readiness.initiative.id.toLowerCase() === initiative.id.toLowerCase() &&
    readiness.initiative.revision === initiativeRevision && readiness.initiative.digest === initiativeDigest &&
    readiness.initiative.state === initiative.state
  const exactHandoff = handoff.product.id.toLowerCase() === product.id.toLowerCase() &&
    handoff.product.revision === productRevision && handoff.product.digest === productDigest &&
    handoff.initiative.id.toLowerCase() === initiative.id.toLowerCase() &&
    handoff.initiative.revision === initiativeRevision && handoff.initiative.digest === initiativeDigest &&
    handoff.initiative.state === initiative.state
  if (!exactProduct || !exactInitiative || !exactReadiness || !exactHandoff) throw new Phase1SummaryBindingError()

  const readinessGaps = {
    applicability: readiness.status.unresolvedApplicabilityCount,
    conditional: readiness.status.conditionalOutputCount,
    incomplete: readiness.status.incompleteOutputCount,
    failed: readiness.status.failedOutputCount,
    blocked: readiness.status.blockedOutputCount,
    staleOrUnknown: readiness.status.staleOrUnknownOutputCount,
    waivers: readiness.status.pendingOrInvalidWaiverCount,
    decisions: readiness.status.unresolvedDecisionCount,
    conditions: readiness.status.unmetConditionCount,
    requirements: readiness.status.unresolvedRequirementCount,
    adverseEvidence: readiness.status.adverseEvidenceCount,
    bindings: readiness.status.staleBindingCount,
    sourceReferences: readiness.status.staleSourceReferenceCount,
    inconsistencies: readiness.status.inconsistencyCount,
    questions: readiness.status.unresolvedQuestionCount,
  }
  const readinessGapTotal = total(Object.values(readinessGaps))
  const handoffGaps = {
    unresolvedItems: handoff.status.unresolvedItemCount,
    staleOrUnknownItems: handoff.status.staleOrUnknownItemCount,
    requirements: handoff.status.unresolvedRequirementCount,
    conflicts: handoff.status.conflictCount,
    questions: handoff.status.unresolvedQuestionCount,
    bindings: handoff.status.staleBindingCount,
    sourceReferences: handoff.status.staleSourceReferenceCount,
  }
  const handoffGapTotal = total(Object.values(handoffGaps))
  const readinessAttention = readiness.status.result !== "passed" || readinessGapTotal > 0 || !readiness.gate
  const handoffAttention = handoff.status.state !== "complete-for-review" || handoffGapTotal > 0 || !handoff.handoff
  const staleBindingCount = readiness.status.staleBindingCount + handoff.status.staleBindingCount
  const staleSourceReferenceCount = readiness.status.staleSourceReferenceCount + handoff.status.staleSourceReferenceCount
  const freshnessAttention = staleBindingCount > 0 || staleSourceReferenceCount > 0
  const attentionSignalCount = Number(readinessAttention) + Number(handoffAttention) + Number(freshnessAttention)

  const content = phase1SummaryDashboardContentSchema.parse({
    schemaVersion: 1,
    kind: "phase-1-summary-readiness-dashboard",
    phase: { id: "phase-1b-product", label: "Phase 1B — Product P0–P4" },
    product: { recordType: "product", recordId: product.id, revision: productRevision, digest: productDigest },
    initiative: {
      recordType: "initiative",
      recordId: initiative.id,
      revision: initiativeRevision,
      digest: initiativeDigest,
      state: initiative.state,
    },
    readiness: {
      snapshotDigest: readiness.snapshotDigest,
      result: readiness.status.result,
      ...(readiness.gate ? { gate: { recordId: readiness.gate.id, revision: readiness.gate.revision, digest: readiness.gate.digest } } : {}),
      assessedAt: readiness.status.assessedAt,
      outputs: {
        total: readiness.status.outputCount,
        applicable: readiness.status.applicableOutputCount,
        notApplicable: readiness.status.notApplicableOutputCount,
        unresolvedApplicability: readiness.status.unresolvedApplicabilityCount,
        satisfied: readiness.status.satisfiedOutputCount,
      },
      gaps: { ...readinessGaps, total: readinessGapTotal },
      reasonCount: readiness.status.reasons.length,
      attentionRequired: readinessAttention,
      authorityBoundary: "readiness-result-is-evaluation-only-not-permission-or-product-readiness",
    },
    handoff: {
      snapshotDigest: handoff.snapshotDigest,
      state: handoff.status.state,
      transferState: handoff.status.transferState,
      ...(handoff.handoff ? { package: { recordId: handoff.handoff.id, revision: handoff.handoff.revision, digest: handoff.handoff.digest } } : {}),
      assessedAt: handoff.status.assessedAt,
      items: {
        total: handoff.status.itemCount,
        included: handoff.status.includedItemCount,
        referenceOnly: handoff.status.referenceOnlyItemCount,
        omittedNotApplicable: handoff.status.omittedNotApplicableItemCount,
        unresolved: handoff.status.unresolvedItemCount,
      },
      gaps: { ...handoffGaps, total: handoffGapTotal },
      reasonCount: handoff.status.reasons.length,
      attentionRequired: handoffAttention,
      authorityBoundary: "handoff-status-is-candidate-context-only-not-transfer-or-phase-entry-authority",
    },
    phaseStatus: {
      state: attentionSignalCount === 0 ? "candidate-complete-for-human-review" : "attention-required",
      declaredGapCount: readinessGapTotal + handoffGapTotal,
      attentionSignalCount,
      productOwnerAcceptance: "not-established",
      readinessAuthority: "not-established",
      phaseEntryAuthority: "not-established",
    },
    owners: { state: "unbound", boundOwnerCount: 0, basis: "no-governed-phase-owner-assignment-is-bound" },
    freshness: {
      state: freshnessAttention ? "attention-required" : "current",
      readinessObservedAt: readiness.observedAt,
      handoffObservedAt: handoff.observedAt,
      staleBindingCount,
      staleSourceReferenceCount,
      basis: "exact-current-projections-and-declared-binding-freshness",
    },
    evidenceCues: {
      freshness: freshnessAttention ? "potentially-stale" : "current",
      confidence: { state: "not-assessed", basis: "no-governed-confidence-evaluation-is-bound" },
    },
    observedAt,
    sourceBoundary: "current-governed-product-initiative-readiness-and-handoff-projections-only",
    privacyBoundary: "summary-exposes-identities-counts-statuses-times-and-digests-not-narrative-findings-evidence-source-content-personal-data-secrets-or-credentials",
    limitations: [
      "Declared gap counts may overlap because readiness and handoff evaluate related candidate evidence through different governed contracts.",
      "Phase ownership remains unbound until a governed phase-owner assignment record is available.",
      "Provider comparison evidence is not included because no governed repository binding exists for that scan-local receipt.",
    ],
    authorityBoundary: "phase-1-summary-is-read-only-candidate-evidence-not-readiness-approval-acceptance-phase-entry-release-or-action-authority",
  })
  return phase1SummaryDashboardSchema.parse({ ...content, snapshotDigest: canonicalDigest(content) })
}
