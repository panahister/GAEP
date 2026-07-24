import { canonicalDigest } from "@gaep/agent-sdk"
import {
  changeImpactDashboardContentSchema,
  changeImpactDashboardRequestSchema,
  changeImpactDashboardSchema,
  changeSchema,
  decisionSchema,
  productSchema,
  riskSchema,
  traceImpactSchema,
  workItemSchema,
  type Change,
  type ChangeImpactDashboard,
  type ChangeImpactDashboardRequest,
  type Decision,
  type Product,
  type Risk,
  type TraceImpact,
  type TraceLink,
  type WorkItem,
} from "@gaep/contracts"

export class ChangeImpactProductBindingError extends Error {
  constructor() {
    super("The requested Change/Impact dashboard Product binding is not current")
    this.name = "ChangeImpactProductBindingError"
  }
}

export class ChangeImpactChangeBindingError extends Error {
  constructor() {
    super("The requested Change/Impact dashboard Change binding is not current")
    this.name = "ChangeImpactChangeBindingError"
  }
}

export interface ChangeImpactDashboardSources {
  product: Product
  change: Change
  workItems: WorkItem[]
  traceImpact: TraceImpact
  decisions: Decision[]
  risks: Risk[]
}

const LIMITS = {
  workItems: 256,
  changedArtifacts: 512,
  effectTargets: 512,
  affectedUnits: 512,
  decisions: 256,
  risks: 256,
} as const

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function bounded<T>(values: T[], maximum: number): { values: T[]; limit: { shown: number; total: number; omitted: number } } {
  const projected = values.slice(0, maximum)
  return {
    values: projected,
    limit: { shown: projected.length, total: values.length, omitted: values.length - projected.length },
  }
}

function linkReference(link: TraceLink) {
  return {
    recordId: link.id,
    revision: link.revision,
    assessmentDigest: canonicalDigest(link),
    assessedState: link.state,
  }
}

function workItemReference(workItem: WorkItem) {
  return {
    recordType: "work-item" as const,
    recordId: workItem.id,
    revision: workItem.revision,
    digest: canonicalDigest(workItem),
  }
}

function uniqueTraceCount(links: TraceLink[]): number {
  return new Set(links.map((link) => link.id)).size
}

export function composeChangeImpactDashboard(
  sourceValues: ChangeImpactDashboardSources,
  requestValue: ChangeImpactDashboardRequest,
  observedAt = new Date().toISOString(),
): ChangeImpactDashboard {
  const request = changeImpactDashboardRequestSchema.parse(requestValue)
  const product = productSchema.parse(sourceValues.product)
  const change = changeSchema.parse(sourceValues.change)
  const workItems = sourceValues.workItems.map((record) => workItemSchema.parse(record))
  const traceImpact = traceImpactSchema.parse(sourceValues.traceImpact)
  const decisions = sourceValues.decisions.map((record) => decisionSchema.parse(record))
  const risks = sourceValues.risks.map((record) => riskSchema.parse(record))

  const productRevision = product.revision ?? 1
  const productDigest = canonicalDigest(product)
  if (
    request.expectedProductId.toLowerCase() !== product.id.toLowerCase()
    || request.expectedProductRevision !== productRevision
    || request.expectedProductDigest !== productDigest
  ) {
    throw new ChangeImpactProductBindingError()
  }

  const changeDigest = canonicalDigest(change)
  if (
    change.productId.toLowerCase() !== product.id.toLowerCase()
    || request.expectedChangeId.toLowerCase() !== change.id.toLowerCase()
    || request.expectedChangeRevision !== change.revision
    || request.expectedChangeDigest !== changeDigest
  ) {
    throw new ChangeImpactChangeBindingError()
  }
  if (
    traceImpact.subject.recordType !== "change"
    || traceImpact.subject.recordId.toLowerCase() !== change.id.toLowerCase()
    || traceImpact.subject.revision !== change.revision
    || traceImpact.subject.digest !== changeDigest
  ) {
    throw new ChangeImpactChangeBindingError()
  }

  for (const record of [...workItems, ...decisions, ...risks]) {
    if (record.productId.toLowerCase() !== product.id.toLowerCase()) {
      throw new ChangeImpactProductBindingError()
    }
  }

  const directWorkItems = workItems
    .filter((record) => record.changeId.toLowerCase() === change.id.toLowerCase())
    .sort((left, right) => compare(left.id, right.id))
  const workItemRows = directWorkItems.map((record) => ({ record: workItemReference(record), state: record.state }))
  const boundedWorkItems = bounded(workItemRows, LIMITS.workItems)

  const changedArtifactCandidates = directWorkItems.flatMap((record) => record.scope.write.map((locator) => ({
    sourceWorkItem: workItemReference(record),
    locator,
  }))).sort((left, right) => compare(
    `${left.sourceWorkItem.recordId}:${canonicalDigest(left.locator)}`,
    `${right.sourceWorkItem.recordId}:${canonicalDigest(right.locator)}`,
  ))
  const changedArtifacts = [...new Map(changedArtifactCandidates.map((entry) => [
    `${entry.sourceWorkItem.recordId}:${canonicalDigest(entry.locator)}`,
    entry,
  ])).values()]
  const effectTargetCandidates = directWorkItems.flatMap((record) => record.scope.effects.map((locator) => ({
    sourceWorkItem: workItemReference(record),
    locator,
  }))).sort((left, right) => compare(
    `${left.sourceWorkItem.recordId}:${canonicalDigest(left.locator)}`,
    `${right.sourceWorkItem.recordId}:${canonicalDigest(right.locator)}`,
  ))
  const effectTargets = [...new Map(effectTargetCandidates.map((entry) => [
    `${entry.sourceWorkItem.recordId}:${canonicalDigest(entry.locator)}`,
    entry,
  ])).values()]
  const boundedArtifacts = bounded(changedArtifacts, LIMITS.changedArtifacts)
  const boundedEffectTargets = bounded(effectTargets, LIMITS.effectTargets)

  const affectedUnits = [
    ...traceImpact.upstream.map((link) => ({
      direction: "upstream" as const,
      relationship: link.relationship,
      endpoint: link.source,
      trace: linkReference(link),
    })),
    ...traceImpact.downstream.map((link) => ({
      direction: "downstream" as const,
      relationship: link.relationship,
      endpoint: link.target,
      trace: linkReference(link),
    })),
  ].sort((left, right) => compare(
    `${left.direction}:${left.endpoint.recordType}:${left.endpoint.recordId}:${left.trace.recordId}`,
    `${right.direction}:${right.endpoint.recordType}:${right.endpoint.recordId}:${right.trace.recordId}`,
  ))
  const uniqueAffectedUnits = [...new Map(affectedUnits.map((entry) => [
    `${entry.direction}:${entry.endpoint.recordType}:${entry.endpoint.recordId}:${entry.trace.recordId}`,
    entry,
  ])).values()]
  const boundedAffectedUnits = bounded(uniqueAffectedUnits, LIMITS.affectedUnits)

  const currentReferences = new Map<string, { revision: number; digest: string }>([
    [`change:${change.id.toLowerCase()}`, { revision: change.revision, digest: changeDigest }],
    ...directWorkItems.map((record) => [
      `work-item:${record.id.toLowerCase()}`,
      { revision: record.revision, digest: canonicalDigest(record) },
    ] as const),
  ])
  const traceGovernanceIds = new Set(traceImpact.decisionsAndRisks.flatMap((link) => [link.source, link.target])
    .filter((endpoint) => endpoint.recordType === "decision" || endpoint.recordType === "risk")
    .map((endpoint) => `${endpoint.recordType}:${endpoint.recordId.toLowerCase()}`))

  let staleGovernanceReferences = 0
  const relevantDecisions = decisions.filter((decision) => {
    const traced = traceGovernanceIds.has(`decision:${decision.id.toLowerCase()}`)
    const affectsCurrentScope = decision.affectedRecords.some((reference) => {
      const current = currentReferences.get(`${reference.recordType}:${reference.recordId.toLowerCase()}`)
      if (!current) return false
      if (current.revision !== reference.revision || current.digest !== reference.digest) staleGovernanceReferences += 1
      return true
    })
    return traced || affectsCurrentScope
  }).sort((left, right) => compare(left.id, right.id))
  const decisionRows = relevantDecisions.map((decision) => ({
    record: {
      recordType: "decision" as const,
      recordId: decision.id,
      revision: decision.revision,
      digest: canonicalDigest(decision),
    },
    state: decision.state,
    outcome: decision.selectedOutcome ? "human-selected" as const : "not-selected" as const,
  }))
  const boundedDecisions = bounded(decisionRows, LIMITS.decisions)

  const relevantRisks = risks.filter((risk) => traceGovernanceIds.has(`risk:${risk.id.toLowerCase()}`))
    .sort((left, right) => compare(left.id, right.id))
  const riskRows = relevantRisks.map((risk) => ({
    record: {
      recordType: "risk" as const,
      recordId: risk.id,
      revision: risk.revision,
      digest: canonicalDigest(risk),
    },
    state: risk.state,
    likelihood: risk.likelihood,
    impact: risk.impact,
    acceptance: risk.acceptance ? "human-accepted" as const : "not-accepted" as const,
  }))
  const boundedRisks = bounded(riskRows, LIMITS.risks)

  const unresolvedTraceLinks = uniqueTraceCount(traceImpact.unresolved)
  const invalidTraceLinks = uniqueTraceCount(traceImpact.invalid)
  const staleTraceLinks = uniqueTraceCount(traceImpact.stale)
  const truncated = traceImpact.truncated || [
    boundedWorkItems.limit,
    boundedArtifacts.limit,
    boundedEffectTargets.limit,
    boundedAffectedUnits.limit,
    boundedDecisions.limit,
    boundedRisks.limit,
  ].some((limit) => limit.omitted > 0)
  const attentionRequired = truncated
    || unresolvedTraceLinks > 0
    || invalidTraceLinks > 0
    || staleTraceLinks > 0
    || staleGovernanceReferences > 0

  const content = changeImpactDashboardContentSchema.parse({
    schemaVersion: 1,
    kind: "change-impact-dashboard",
    product: {
      recordType: "product",
      recordId: product.id,
      revision: productRevision,
      digest: productDigest,
    },
    change: {
      recordType: "change",
      recordId: change.id,
      revision: change.revision,
      digest: changeDigest,
      state: change.state,
      effectEnvelope: change.effectEnvelope,
    },
    workItems: boundedWorkItems.values,
    changedArtifacts: boundedArtifacts.values,
    effectTargets: boundedEffectTargets.values,
    affectedUnits: boundedAffectedUnits.values,
    governance: {
      approval: {
        state: "not-established",
        basis: "current-contract-has-no-change-approval-record",
      },
      decisions: boundedDecisions.values,
      risks: boundedRisks.values,
      authorityBoundary: "decisions-and-risk-acceptance-do-not-approve-the-change",
    },
    freshness: {
      state: attentionRequired ? "attention-required" : "current",
      evaluatedAt: traceImpact.evaluatedAt,
      unresolvedTraceLinks,
      invalidTraceLinks,
      staleTraceLinks,
      staleGovernanceReferences,
      traceAnalysisTruncated: traceImpact.truncated,
      coverageBoundary: traceImpact.coverageBoundary,
    },
    limits: {
      workItems: boundedWorkItems.limit,
      changedArtifacts: boundedArtifacts.limit,
      effectTargets: boundedEffectTargets.limit,
      affectedUnits: boundedAffectedUnits.limit,
      decisions: boundedDecisions.limit,
      risks: boundedRisks.limit,
      truncated,
    },
    observedAt,
    sourceBoundary: "current-governed-records-and-bounded-trace-analysis",
    limitations: [
      "Only persisted Work Item scopes and trace links are shown; missing trace does not prove missing impact.",
      "The current record model has no general Change approval record, so approval remains not established.",
    ],
    authorityBoundary: "change-impact-dashboard-does-not-approve-change-accept-risk-or-authorize-effects",
  })
  return changeImpactDashboardSchema.parse({
    ...content,
    snapshotDigest: canonicalDigest(content),
  })
}
