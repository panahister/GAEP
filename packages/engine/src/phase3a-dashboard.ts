import { canonicalDigest } from "@gaep/agent-sdk"
import {
  acceptanceCriteriaProjectionSchema,
  backlogHierarchyProjectionSchema,
  boilerplateCompatibilityValidationProjectionSchema,
  boilerplateRegistryProjectionSchema,
  boilerplateSelectionBindingProjectionSchema,
  definitionOfDoneProjectionSchema,
  definitionOfReadyProjectionSchema,
  dependencyMappingProjectionSchema,
  designToCodeBindingRegistryProjectionSchema,
  figmaToBoilerplateMappingProjectionSchema,
  highLevelDesignProjectionSchema,
  implementationReadinessGateProjectionSchema,
  implementationUnitModelProjectionSchema,
  initiativeSchema,
  lowLevelDesignProjectionSchema,
  mvpSliceDefinitionProjectionSchema,
  phase3aDashboardContentSchema,
  phase3aDashboardRequestSchema,
  phase3aDashboardSchema,
  phase3aDashboardSourceDefinitions,
  phase3aDashboardSourceIds,
  phase3aDashboardViewDefinitions,
  phase3aDashboardViewIds,
  phase3aDashboardWorkflowSchema,
  prioritizationModelProjectionSchema,
  productSchema,
  routeScreenComponentMappingProjectionSchema,
  technologyProfileProjectionSchema,
  testInventoryProjectionSchema,
  testMethodologyProjectionSchema,
  type Initiative,
  type Phase3aDashboard,
  type Phase3aDashboardRequest,
  type Phase3aDashboardSource,
  type Phase3aDashboardSourceId,
  type Phase3aDashboardWorkflow,
  type Product,
} from "@gaep/contracts"

export class Phase3aDashboardBindingError extends Error {
  constructor(message = "The requested Phase 3A dashboard bindings are not current") {
    super(message)
    this.name = "Phase3aDashboardBindingError"
  }
}

const sourceSchemas = {
  "backlog-hierarchy-projection": backlogHierarchyProjectionSchema,
  "mvp-slice-definition-projection": mvpSliceDefinitionProjectionSchema,
  "prioritization-model-projection": prioritizationModelProjectionSchema,
  "acceptance-criteria-projection": acceptanceCriteriaProjectionSchema,
  "definition-of-ready-projection": definitionOfReadyProjectionSchema,
  "definition-of-done-projection": definitionOfDoneProjectionSchema,
  "implementation-unit-model-projection": implementationUnitModelProjectionSchema,
  "dependency-mapping-projection": dependencyMappingProjectionSchema,
  "technology-profile-projection": technologyProfileProjectionSchema,
  "boilerplate-registry-projection": boilerplateRegistryProjectionSchema,
  "boilerplate-selection-binding-projection": boilerplateSelectionBindingProjectionSchema,
  "boilerplate-compatibility-validation-projection": boilerplateCompatibilityValidationProjectionSchema,
  "figma-to-boilerplate-mapping-projection": figmaToBoilerplateMappingProjectionSchema,
  "design-to-code-binding-registry-projection": designToCodeBindingRegistryProjectionSchema,
  "route-screen-component-mapping-projection": routeScreenComponentMappingProjectionSchema,
  "test-methodology-projection": testMethodologyProjectionSchema,
  "test-inventory-projection": testInventoryProjectionSchema,
  "high-level-design-projection": highLevelDesignProjectionSchema,
  "low-level-design-projection": lowLevelDesignProjectionSchema,
  "implementation-readiness-gate-projection": implementationReadinessGateProjectionSchema,
} as const

type ProjectionKind = keyof typeof sourceSchemas

const sourceIdByProjectionKind = Object.fromEntries(
  phase3aDashboardSourceIds.map((id) => [phase3aDashboardSourceDefinitions[id].projectionKind, id]),
) as Record<ProjectionKind, Phase3aDashboardSourceId>

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function revisionOf(value: { revision?: number }): number {
  return value.revision ?? 1
}

function numericCounts(value: Record<string, unknown>, pattern: RegExp): number {
  return Object.entries(value).reduce((sum, [key, item]) =>
    pattern.test(key) && typeof item === "number" && Number.isSafeInteger(item) && item >= 0 ? sum + item : sum, 0)
}

function arrayCounts(value: Record<string, unknown>, pattern: RegExp): number {
  return Object.entries(value).reduce((sum, [key, item]) => pattern.test(key) && Array.isArray(item) ? sum + item.length : sum, 0)
}

function parseProjection(value: unknown): Record<string, unknown> {
  const kind = record(value).kind
  if (typeof kind !== "string" || !(kind in sourceSchemas)) {
    throw new Phase3aDashboardBindingError("The Phase 3A dashboard source kind is unknown")
  }
  return sourceSchemas[kind as ProjectionKind].parse(value) as unknown as Record<string, unknown>
}

function exactProjectionBinding(product: Product, initiative: Initiative, projection: Record<string, unknown>): boolean {
  const productBinding = record(projection.product)
  const initiativeBinding = record(projection.initiative)
  return String(productBinding.id).toLowerCase() === product.id.toLowerCase() &&
    productBinding.revision === revisionOf(product) && productBinding.digest === canonicalDigest(product) &&
    String(initiativeBinding.id).toLowerCase() === initiative.id.toLowerCase() &&
    initiativeBinding.revision === revisionOf(initiative) && initiativeBinding.digest === canonicalDigest(initiative) &&
    initiativeBinding.state === initiative.state
}

function sourceEntry(id: Phase3aDashboardSourceId, projection?: Record<string, unknown>): Phase3aDashboardSource {
  const definition = phase3aDashboardSourceDefinitions[id]
  if (!projection) return { id, ...definition, availability: "unavailable" }
  const status = record(projection.status)
  const candidate = record(projection.candidate)
  const reviewState = typeof status.reviewState === "string" ? status.reviewState : undefined
  const reasonCount = arrayCounts(status, /reason/i)
  const evidenceReferenceCount = numericCounts(status, /evidence.*Count$/i)
  const gapCount = numericCounts(status, /(gap|unbound|unmapped|unsatisfied).*Count$/i) + arrayCounts(status, /gap/i)
  const conflictCount = numericCounts(status, /(conflict|incompatible|blocked).*Count$/i) + arrayCounts(status, /conflict/i)
  const staleCount = numericCounts(status, /(stale|expired).*Count$/i)
  const unresolvedCount = numericCounts(status, /(unresolved|notAssessed|missing).*Count$/i)
  const candidateCount = Object.keys(candidate).length > 0 ? 1 : 0
  const attentionRequired = candidateCount === 0 || reviewState !== "ready-for-human-review" ||
    reasonCount + gapCount + conflictCount + staleCount + unresolvedCount > 0
  const state = typeof status.state === "string" ? status.state : candidateCount > 0 ? "candidate" : "not-assessed"
  return {
    id,
    ...definition,
    availability: attentionRequired ? "attention-required" : "current",
    binding: {
      snapshotDigest: String(projection.snapshotDigest),
      observedAt: String(projection.observedAt),
      ...(candidateCount > 0 ? { candidate: { recordId: String(candidate.id), revision: Number(candidate.revision), digest: String(candidate.digest) } } : {}),
    },
    assessment: {
      state,
      ...(reviewState ? { reviewState } : {}),
      reasonCount,
      candidateCount,
      evidenceReferenceCount,
      gapCount,
      conflictCount,
      staleCount,
      unresolvedCount,
      attentionRequired,
    },
  }
}

function exactWorkflowBinding(product: Product, initiative: Initiative, workflow: Phase3aDashboardWorkflow): boolean {
  if (!workflow.binding) return false
  return workflow.binding.product.recordId.toLowerCase() === product.id.toLowerCase() &&
    workflow.binding.product.revision === revisionOf(product) && workflow.binding.product.digest === canonicalDigest(product) &&
    workflow.binding.initiative.recordId.toLowerCase() === initiative.id.toLowerCase() &&
    workflow.binding.initiative.revision === revisionOf(initiative) && workflow.binding.initiative.digest === canonicalDigest(initiative)
}

export function composePhase3aDashboard(
  productValue: Product,
  initiativeValue: Initiative,
  projectionValues: readonly unknown[],
  requestValue: Phase3aDashboardRequest,
  workflowValues: readonly Phase3aDashboardWorkflow[] = [],
  observedAt = new Date().toISOString(),
): Phase3aDashboard {
  const product = productSchema.parse(productValue)
  const initiative = initiativeSchema.parse(initiativeValue)
  const request = phase3aDashboardRequestSchema.parse(requestValue)
  const productRevision = revisionOf(product)
  const productDigest = canonicalDigest(product)
  const initiativeRevision = revisionOf(initiative)
  const initiativeDigest = canonicalDigest(initiative)
  if (request.expectedProductId.toLowerCase() !== product.id.toLowerCase() || request.expectedProductRevision !== productRevision ||
      request.expectedProductDigest !== productDigest || request.expectedInitiativeId.toLowerCase() !== initiative.id.toLowerCase() ||
      request.expectedInitiativeRevision !== initiativeRevision || request.expectedInitiativeDigest !== initiativeDigest ||
      initiative.productId.toLowerCase() !== product.id.toLowerCase()) throw new Phase3aDashboardBindingError()

  const byId = new Map<Phase3aDashboardSourceId, Record<string, unknown>>()
  for (const value of projectionValues) {
    const projection = parseProjection(value)
    const kind = projection.kind as ProjectionKind
    const id = sourceIdByProjectionKind[kind]
    if (!id || byId.has(id) || !exactProjectionBinding(product, initiative, projection)) throw new Phase3aDashboardBindingError()
    byId.set(id, projection)
  }
  const sources = phase3aDashboardSourceIds.map((id) => sourceEntry(id, byId.get(id)))

  const workflowByProvider = new Map<"codex" | "claude", Phase3aDashboardWorkflow>()
  for (const value of workflowValues) {
    const workflow = phase3aDashboardWorkflowSchema.parse(value)
    if (workflow.availability !== "sealed-local-deterministic" || !exactWorkflowBinding(product, initiative, workflow) || workflowByProvider.has(workflow.provider)) {
      throw new Phase3aDashboardBindingError("The Phase 3A provider workflow evidence binding is not current")
    }
    workflowByProvider.set(workflow.provider, workflow)
  }
  const workflows = (["codex", "claude"] as const).map((provider): Phase3aDashboardWorkflow => workflowByProvider.get(provider) ?? ({
    provider,
    availability: "unavailable",
    executionMode: "offline-deterministic",
    liveAcceptance: "not-established",
    semanticQuality: "not-assessed",
    authority: "not-granted",
  }))
  const workflowEvidenceCount = workflows.filter((workflow) => workflow.availability === "sealed-local-deterministic").length

  const views = phase3aDashboardViewIds.map((id) => {
    const definition = phase3aDashboardViewDefinitions[id]
    const entries = definition.sourceIds.map((sourceId) => sources[phase3aDashboardSourceIds.indexOf(sourceId)]!)
    const currentSourceCount = entries.filter((source) => source.availability === "current").length
    const attentionRequiredSourceCount = entries.filter((source) => source.availability === "attention-required").length
    const unavailableSourceCount = entries.filter((source) => source.availability === "unavailable").length
    const total = (key: "candidateCount" | "evidenceReferenceCount" | "gapCount" | "conflictCount" | "staleCount" | "unresolvedCount"): number =>
      entries.reduce((sum, source) => sum + (source.assessment?.[key] ?? 0), 0)
    return {
      id,
      title: definition.title,
      sourceIds: [...definition.sourceIds],
      state: unavailableSourceCount === entries.length ? "unavailable" as const
        : attentionRequiredSourceCount > 0 || unavailableSourceCount > 0 ? "attention-required" as const : "current" as const,
      currentSourceCount,
      attentionRequiredSourceCount,
      unavailableSourceCount,
      candidateCount: total("candidateCount"),
      evidenceReferenceCount: total("evidenceReferenceCount"),
      gapCount: total("gapCount"),
      conflictCount: total("conflictCount"),
      staleCount: total("staleCount"),
      unresolvedCount: total("unresolvedCount"),
      workflowEvidenceCount: id === "agent-model" ? workflowEvidenceCount : 0,
    }
  })

  const currentSourceCount = sources.filter((source) => source.availability === "current").length
  const attentionRequiredSourceCount = sources.filter((source) => source.availability === "attention-required").length
  const unavailableSourceCount = sources.filter((source) => source.availability === "unavailable").length
  const staleCount = sources.reduce((sum, source) => sum + (source.assessment?.staleCount ?? 0), 0)
  const unresolvedCount = sources.reduce((sum, source) => sum + (source.assessment?.unresolvedCount ?? 0), 0)
  const sourceTimes = sources.flatMap((source) => source.binding ? [source.binding.observedAt] : []).sort()
  const requiresAttention = attentionRequiredSourceCount > 0 || unavailableSourceCount > 0 || staleCount > 0 || unresolvedCount > 0
  const content = phase3aDashboardContentSchema.parse({
    schemaVersion: 1,
    kind: "phase-3a-dashboard",
    viewDefinitionVersion: "gaep-phase-3a-dashboard-v1",
    phase: { id: "phase-3a-readiness", label: "Phase 3A — Backlog and Implementation Readiness" },
    product: { recordType: "product", recordId: product.id, revision: productRevision, digest: productDigest },
    initiative: { recordType: "initiative", recordId: initiative.id, revision: initiativeRevision, digest: initiativeDigest, state: initiative.state },
    sources,
    views,
    workflows,
    freshness: {
      state: unavailableSourceCount > 0 ? "unknown" : staleCount + unresolvedCount > 0 ? "attention-required" : "current",
      staleCount,
      unresolvedCount,
      ...(sourceTimes[0] ? { oldestSourceObservedAt: sourceTimes[0] } : {}),
      ...(sourceTimes.at(-1) ? { newestSourceObservedAt: sourceTimes.at(-1) } : {}),
    },
    phaseStatus: {
      state: requiresAttention ? "attention-required" : "candidate-complete-for-human-review",
      expectedSourceCount: phase3aDashboardSourceIds.length,
      currentSourceCount,
      attentionRequiredSourceCount,
      unavailableSourceCount,
      sourceCatalogDigest: canonicalDigest(sources),
      providerWorkflowEvidenceCount: workflowEvidenceCount,
      liveProviderAcceptanceCount: 0,
      nativeHostAcceptanceCount: 0,
      readinessAuthority: "not-established",
      waiverAuthority: "not-established",
      ownershipAuthority: "not-established",
      productOwnerAcceptance: "not-established",
    },
    pagination: { offset: 0, limit: 20, total: 20, truncated: false },
    export: { format: "csv-visible-metadata-only", formulaPrefixesNeutralized: true, hiddenContentExcluded: true },
    evidenceCues: {
      freshness: unavailableSourceCount > 0 ? "unknown" : staleCount + unresolvedCount > 0 ? "potentially-stale" : "current",
      confidence: { state: "not-assessed", basis: "no-governed-confidence-or-semantic-quality-evaluation-is-bound" },
    },
    observedAt,
    sourceBoundary: "current-governed-product-initiative-p3a-projections-and-explicit-sealed-local-workflow-evidence-only",
    privacyBoundary: "dashboard-exposes-identities-counts-states-times-and-digests-not-product-design-source-code-provider-output-personal-content-secrets-credentials-permissions-or-private-paths",
    limitations: [
      "Unavailable and attention-required sources remain explicit; zero counts never establish not-applicability, completeness, priority, readiness, waiver, ownership, or acceptance.",
      "Codex and Claude entries bind only explicit sealed deterministic local workflow evidence and never establish live availability, semantic quality, authentication, policy, or provider acceptance.",
      "The dashboard is reproducible only for the exact Product, Initiative, source snapshot digests, workflow evidence digests, and view-definition version recorded here.",
      "Accessible sorting, filtering, bounded pagination, and CSV export expose only the visible private-safe metadata represented by this snapshot.",
    ],
    authorityBoundary: "phase-3a-dashboard-is-a-derived-read-only-view-not-completeness-priority-readiness-waiver-ownership-implementation-acceptance-release-deployment-or-action-authority",
  })
  return phase3aDashboardSchema.parse({ ...content, snapshotDigest: canonicalDigest(content) })
}
