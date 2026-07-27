import { canonicalDigest } from "@gaep/agent-sdk"
import {
  changeImpactDashboardSchema,
  changeSchema,
  initiativeSchema,
  p0P4ReadinessGateProjectionSchema,
  p0P4ReadinessGateSchema,
  p0P4ReadinessOutputKinds,
  p0P4ReadinessRecordKinds,
  p5HandoffPackageProjectionSchema,
  p5HandoffPackageSchema,
  phase1ChangeImpactDashboardContentSchema,
  phase1ChangeImpactDashboardRequestSchema,
  phase1ChangeImpactDashboardSchema,
  productSchema,
  type Change,
  type ChangeImpactDashboard,
  type Initiative,
  type P0P4ReadinessGate,
  type P0P4ReadinessGateProjection,
  type P5HandoffPackage,
  type P5HandoffPackageProjection,
  type Phase1ChangeImpactDashboard,
  type Phase1ChangeImpactDashboardRequest,
  type Product,
} from "@gaep/contracts"

export class Phase1ChangeImpactBindingError extends Error {
  constructor() {
    super("The requested Phase 1 Change/Impact dashboard bindings are not current")
    this.name = "Phase1ChangeImpactBindingError"
  }
}

export interface Phase1ChangeImpactDashboardSources {
  product: Product
  initiative: Initiative
  change: Change
  changeImpact: ChangeImpactDashboard
  readiness: P0P4ReadinessGateProjection
  readinessGate?: P0P4ReadinessGate
  handoff: P5HandoffPackageProjection
  handoffPackage?: P5HandoffPackage
}

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactSnapshot(value: { snapshotDigest: string }): boolean {
  const { snapshotDigest, ...content } = value
  return snapshotDigest === canonicalDigest(content)
}

function sameBinding(
  left: { recordId: string; revision: number; digest: string },
  right: { id: string; revision: number; digest: string },
): boolean {
  return left.recordId.toLowerCase() === right.id.toLowerCase() && left.revision === right.revision && left.digest === right.digest
}

function sameProjectionBinding(
  left: { id: string; revision: number; digest: string },
  right: { id: string; revision: number; digest: string },
): boolean {
  return left.id.toLowerCase() === right.id.toLowerCase() && left.revision === right.revision && left.digest === right.digest
}

export function composePhase1ChangeImpactDashboard(
  sourceValues: Phase1ChangeImpactDashboardSources,
  requestValue: Phase1ChangeImpactDashboardRequest,
  observedAt = new Date().toISOString(),
): Phase1ChangeImpactDashboard {
  const request = phase1ChangeImpactDashboardRequestSchema.parse(requestValue)
  const product = productSchema.parse(sourceValues.product)
  const initiative = initiativeSchema.parse(sourceValues.initiative)
  const change = changeSchema.parse(sourceValues.change)
  const changeImpact = changeImpactDashboardSchema.parse(sourceValues.changeImpact)
  const readiness = p0P4ReadinessGateProjectionSchema.parse(sourceValues.readiness)
  const readinessGate = sourceValues.readinessGate
    ? p0P4ReadinessGateSchema.parse(sourceValues.readinessGate)
    : undefined
  const handoff = p5HandoffPackageProjectionSchema.parse(sourceValues.handoff)
  const handoffPackage = sourceValues.handoffPackage
    ? p5HandoffPackageSchema.parse(sourceValues.handoffPackage)
    : undefined

  const productRevision = revisionOf(product)
  const productDigest = canonicalDigest(product)
  const initiativeRevision = revisionOf(initiative)
  const initiativeDigest = canonicalDigest(initiative)
  const changeDigest = canonicalDigest(change)
  const exactRequest = request.expectedProductId.toLowerCase() === product.id.toLowerCase() &&
    request.expectedProductRevision === productRevision && request.expectedProductDigest === productDigest &&
    request.expectedInitiativeId.toLowerCase() === initiative.id.toLowerCase() &&
    request.expectedInitiativeRevision === initiativeRevision && request.expectedInitiativeDigest === initiativeDigest &&
    request.expectedChangeId.toLowerCase() === change.id.toLowerCase() &&
    request.expectedChangeRevision === change.revision && request.expectedChangeDigest === changeDigest
  const exactOwnership = initiative.productId.toLowerCase() === product.id.toLowerCase() &&
    change.productId.toLowerCase() === product.id.toLowerCase() && change.initiativeId.toLowerCase() === initiative.id.toLowerCase()
  const exactChangeImpact = exactSnapshot(changeImpact) &&
    changeImpact.product.recordId.toLowerCase() === product.id.toLowerCase() &&
    changeImpact.product.revision === productRevision && changeImpact.product.digest === productDigest &&
    changeImpact.change.recordId.toLowerCase() === change.id.toLowerCase() &&
    changeImpact.change.revision === change.revision && changeImpact.change.digest === changeDigest &&
    changeImpact.change.state === change.state &&
    canonicalDigest(changeImpact.change.effectEnvelope) === canonicalDigest(change.effectEnvelope)
  const exactReadiness = exactSnapshot(readiness) &&
    readiness.product.id.toLowerCase() === product.id.toLowerCase() &&
    readiness.product.revision === productRevision && readiness.product.digest === productDigest &&
    readiness.initiative.id.toLowerCase() === initiative.id.toLowerCase() &&
    readiness.initiative.revision === initiativeRevision && readiness.initiative.digest === initiativeDigest &&
    readiness.initiative.state === initiative.state
  const exactHandoff = exactSnapshot(handoff) &&
    handoff.product.id.toLowerCase() === product.id.toLowerCase() &&
    handoff.product.revision === productRevision && handoff.product.digest === productDigest &&
    handoff.initiative.id.toLowerCase() === initiative.id.toLowerCase() &&
    handoff.initiative.revision === initiativeRevision && handoff.initiative.digest === initiativeDigest &&
    handoff.initiative.state === initiative.state
  if (!exactRequest || !exactOwnership || !exactChangeImpact || !exactReadiness || !exactHandoff) {
    throw new Phase1ChangeImpactBindingError()
  }

  if ((readiness.gate === undefined) !== (readinessGate === undefined) ||
      (handoff.handoff === undefined) !== (handoffPackage === undefined)) {
    throw new Phase1ChangeImpactBindingError()
  }
  if (readiness.gate && readinessGate) {
    const gateBinding = { id: readinessGate.id, revision: readinessGate.revision, digest: canonicalDigest(readinessGate) }
    if (!sameProjectionBinding(readiness.gate, gateBinding) ||
        readinessGate.productId.toLowerCase() !== product.id.toLowerCase() ||
        readinessGate.initiativeId.toLowerCase() !== initiative.id.toLowerCase()) {
      throw new Phase1ChangeImpactBindingError()
    }
  }
  if (handoff.handoff && handoffPackage) {
    const handoffBinding = { id: handoffPackage.id, revision: handoffPackage.revision, digest: canonicalDigest(handoffPackage) }
    if (!sameProjectionBinding(handoff.handoff, handoffBinding) ||
        handoffPackage.productId.toLowerCase() !== product.id.toLowerCase() ||
        handoffPackage.initiativeId.toLowerCase() !== initiative.id.toLowerCase() ||
        !readinessGate || !sameBinding(handoffPackage.readinessGate, {
          id: readinessGate.id,
          revision: readinessGate.revision,
          digest: canonicalDigest(readinessGate),
        })) {
      throw new Phase1ChangeImpactBindingError()
    }
  }

  const readinessByKind = new Map(readinessGate?.outputs.map((output) => [output.outputKind, output]))
  const handoffByKind = new Map(handoffPackage?.items.map((item) => [item.outputKind, item]))
  const outputs = p0P4ReadinessOutputKinds.map((outputKind) => {
    const readinessOutput = readinessByKind.get(outputKind)
    const handoffItem = handoffByKind.get(outputKind)
    const exactMatchedSubjects = new Set<string>()
    const staleMatchedSubjects = new Set<string>()
    const traceReferences = new Map<string, typeof changeImpact.affectedUnits[number]>()
    for (const subject of readinessOutput?.subjects ?? []) {
      const subjectKey = `${subject.recordKind}:${subject.recordId}:${subject.revision}:${subject.digest}`
      for (const affected of changeImpact.affectedUnits) {
        if (affected.endpoint.recordType === "external" || affected.endpoint.recordId.toLowerCase() !== subject.recordId.toLowerCase()) continue
        const exact = affected.endpoint.revision === subject.revision && affected.endpoint.digest === subject.digest
        if (exact) exactMatchedSubjects.add(subjectKey)
        else staleMatchedSubjects.add(subjectKey)
        traceReferences.set(`${affected.direction}:${affected.trace.recordId}`, affected)
      }
    }
    const traces = [...traceReferences.values()]
    const counts = {
      valid: traces.filter((trace) => trace.trace.assessedState === "valid").length,
      unresolved: traces.filter((trace) => trace.trace.assessedState === "unresolved").length,
      stale: traces.filter((trace) => trace.trace.assessedState === "stale").length,
      invalid: traces.filter((trace) => trace.trace.assessedState === "invalid").length,
      upstream: traces.filter((trace) => trace.direction === "upstream").length,
      downstream: traces.filter((trace) => trace.direction === "downstream").length,
    }
    const attention = staleMatchedSubjects.size > 0 || counts.unresolved > 0 || counts.stale > 0 || counts.invalid > 0
    return {
      outputKind,
      recordKind: p0P4ReadinessRecordKinds[outputKind],
      readiness: readinessOutput ? {
        applicability: readinessOutput.applicability,
        evaluationState: readinessOutput.evaluationState,
        freshness: readinessOutput.freshness,
        subjectCount: readinessOutput.subjects.length,
      } : {
        applicability: "not-assessed" as const,
        evaluationState: "not-assessed" as const,
        freshness: "unknown" as const,
        subjectCount: 0,
      },
      impact: {
        state: attention
          ? "attention-required" as const
          : exactMatchedSubjects.size > 0
            ? "current-trace-observed" as const
            : "not-established" as const,
        exactMatchedSubjectCount: exactMatchedSubjects.size,
        staleSubjectBindingCount: staleMatchedSubjects.size,
        traceReferenceCount: traces.length,
        validTraceCount: counts.valid,
        unresolvedTraceCount: counts.unresolved,
        staleTraceCount: counts.stale,
        invalidTraceCount: counts.invalid,
        upstreamTraceCount: counts.upstream,
        downstreamTraceCount: counts.downstream,
        revalidationState: "not-established" as const,
        coverageBoundary: "absence-of-an-exact-trace-match-does-not-prove-absence-of-impact" as const,
      },
      handoff: handoffItem ? {
        disposition: handoffItem.disposition,
        freshness: handoffItem.freshness,
        subjectCount: handoffItem.subjects.length,
      } : {
        disposition: "not-established" as const,
        freshness: "unknown" as const,
        subjectCount: 0,
      },
    }
  })
  const currentTraceObservedOutputCount = outputs.filter((output) => output.impact.state === "current-trace-observed").length
  const attentionRequiredOutputCount = outputs.filter((output) => output.impact.state === "attention-required").length
  const impactNotEstablishedOutputCount = outputs.filter((output) => output.impact.state === "not-established").length
  const outputStaleBindingCount = outputs.reduce((sum, output) => sum + output.impact.staleSubjectBindingCount, 0)
  const staleBindingCount = readiness.status.staleBindingCount + handoff.status.staleBindingCount +
    changeImpact.freshness.staleGovernanceReferences + outputStaleBindingCount
  const staleSourceReferenceCount = readiness.status.staleSourceReferenceCount + handoff.status.staleSourceReferenceCount
  const traceAttentionLinkCount = changeImpact.freshness.unresolvedTraceLinks + changeImpact.freshness.staleTraceLinks +
    changeImpact.freshness.invalidTraceLinks
  const freshnessAttention = staleBindingCount > 0 || staleSourceReferenceCount > 0 || traceAttentionLinkCount > 0 ||
    changeImpact.freshness.traceAnalysisTruncated || attentionRequiredOutputCount > 0

  const content = phase1ChangeImpactDashboardContentSchema.parse({
    schemaVersion: 1,
    kind: "phase-1-change-impact-dashboard",
    phase: { id: "phase-1b-product", label: "Phase 1B — Product P0–P4" },
    product: { recordType: "product", recordId: product.id, revision: productRevision, digest: productDigest },
    initiative: {
      recordType: "initiative",
      recordId: initiative.id,
      revision: initiativeRevision,
      digest: initiativeDigest,
      state: initiative.state,
    },
    change: {
      recordType: "change",
      recordId: change.id,
      revision: change.revision,
      digest: changeDigest,
      state: change.state,
      effectEnvelope: change.effectEnvelope,
    },
    sources: {
      changeImpactSnapshotDigest: changeImpact.snapshotDigest,
      readinessSnapshotDigest: readiness.snapshotDigest,
      handoffSnapshotDigest: handoff.snapshotDigest,
      ...(readiness.gate ? { readinessGate: {
        recordId: readiness.gate.id,
        revision: readiness.gate.revision,
        digest: readiness.gate.digest,
      } } : {}),
      ...(handoff.handoff ? { handoffPackage: {
        recordId: handoff.handoff.id,
        revision: handoff.handoff.revision,
        digest: handoff.handoff.digest,
      } } : {}),
    },
    changeScope: {
      workItemCount: changeImpact.limits.workItems.total,
      changedArtifactCount: changeImpact.limits.changedArtifacts.total,
      effectTargetCount: changeImpact.limits.effectTargets.total,
      affectedUnitCount: changeImpact.limits.affectedUnits.total,
      decisionCount: changeImpact.limits.decisions.total,
      riskCount: changeImpact.limits.risks.total,
      unresolvedTraceLinkCount: changeImpact.freshness.unresolvedTraceLinks,
      staleTraceLinkCount: changeImpact.freshness.staleTraceLinks,
      invalidTraceLinkCount: changeImpact.freshness.invalidTraceLinks,
      traceAnalysisTruncated: changeImpact.freshness.traceAnalysisTruncated,
    },
    outputs,
    coverage: {
      state: "bounded-not-complete",
      outputCount: p0P4ReadinessOutputKinds.length,
      applicableOutputCount: outputs.filter((output) => output.readiness.applicability === "applicable").length,
      currentTraceObservedOutputCount,
      attentionRequiredOutputCount,
      impactNotEstablishedOutputCount,
      revalidationNotEstablishedOutputCount: p0P4ReadinessOutputKinds.length,
      basis: "exact-current-readiness-subjects-matched-to-bounded-governed-change-trace-results",
      coverageBoundary: "trace-presence-proves-only-the-recorded-link-and-trace-absence-does-not-prove-no-impact",
    },
    owners: { state: "unbound", boundOutputOwnerCount: 0, basis: "no-governed-phase-output-owner-assignment-is-bound" },
    governance: {
      changeApproval: "not-established",
      riskAcceptanceAuthority: "not-established",
      revalidationAuthority: "not-established",
      productOwnerAcceptance: "not-established",
      effectAuthority: "not-established",
    },
    freshness: {
      state: freshnessAttention ? "attention-required" : "current",
      changeImpactEvaluatedAt: changeImpact.freshness.evaluatedAt,
      readinessObservedAt: readiness.observedAt,
      handoffObservedAt: handoff.observedAt,
      staleBindingCount,
      staleSourceReferenceCount,
      traceAttentionLinkCount,
      traceAnalysisTruncated: changeImpact.freshness.traceAnalysisTruncated,
      basis: "current-governed-snapshots-and-declared-trace-readiness-handoff-freshness",
    },
    evidenceCues: {
      freshness: freshnessAttention ? "potentially-stale" : "current",
      confidence: {
        state: "not-assessed",
        basis: "bounded-trace-coverage-does-not-establish-impact-confidence-or-completeness",
      },
    },
    observedAt,
    sourceBoundary: "current-governed-product-initiative-change-readiness-handoff-and-bounded-trace-projections-only",
    privacyBoundary: "dashboard-exposes-identities-digests-counts-statuses-effects-and-times-not-change-text-output-content-findings-evidence-source-content-personal-data-secrets-or-credentials",
    limitations: [
      "Only exact current readiness subjects can be matched; outputs without exact matches remain impact not established rather than unaffected.",
      "The bounded trace query may omit relevant relationships, and trace presence proves only each recorded relationship.",
      "Phase output owners and governed revalidation dispositions are not available in the current repository contracts.",
      "Decision and Risk metadata from the source dashboard do not approve this Change or accept its risks.",
    ],
    authorityBoundary: "phase-1-change-impact-dashboard-is-read-only-observed-candidate-evidence-not-impact-completeness-revalidation-approval-risk-acceptance-readiness-effect-release-or-action-authority",
  })
  return phase1ChangeImpactDashboardSchema.parse({ ...content, snapshotDigest: canonicalDigest(content) })
}
