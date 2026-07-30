import { canonicalDigest } from "@gaep/agent-sdk"
import {
  accessibilityDesignRulesProjectionSchema,
  designApplicabilityProjectionSchema,
  designBaselineProjectionSchema,
  designConflictResolutionProjectionSchema,
  designDeltaProjectionSchema,
  designDriftDetectionProjectionSchema,
  designPersonaRoleModelProjectionSchema,
  designRequirementsProjectionSchema,
  designSystemTokenContractProjectionSchema,
  designToRequirementBindingProjectionSchema,
  designerReadyGateProjectionSchema,
  figmaContextImportProjectionSchema,
  figmaMcpCapabilityDiscoveryProjectionSchema,
  figmaReadSnapshotProjectionSchema,
  finalizedFigmaSnapshotImportProjectionSchema,
  governedFigmaWriteProjectionSchema,
  humanDesignApprovalProjectionSchema,
  informationArchitectureModelProjectionSchema,
  initiativeSchema,
  manualFigmaExecutionPathProjectionSchema,
  outboundDesignBriefPackageProjectionSchema,
  phase2UxFigmaDashboardContentSchema,
  phase2UxFigmaDashboardRequestSchema,
  phase2UxFigmaDashboardSchema,
  phase2UxFigmaDashboardSourceDefinitions,
  phase2UxFigmaDashboardSourceIds,
  productSchema,
  responsiveMultiPlatformTargetsProjectionSchema,
  screenStateInventoryProjectionSchema,
  userJourneyModelProjectionSchema,
  type Initiative,
  type Phase2UxFigmaDashboard,
  type Phase2UxFigmaDashboardRequest,
  type Phase2UxFigmaDashboardSource,
  type Phase2UxFigmaDashboardSourceId,
  type Product,
} from "@gaep/contracts"

export class Phase2UxFigmaDashboardBindingError extends Error {
  constructor(message = "The requested Phase 2 UX/Figma dashboard bindings are not current") {
    super(message)
    this.name = "Phase2UxFigmaDashboardBindingError"
  }
}

const sourceSchemas = {
  "design-applicability-projection": designApplicabilityProjectionSchema,
  "design-persona-role-projection": designPersonaRoleModelProjectionSchema,
  "user-journey-model-projection": userJourneyModelProjectionSchema,
  "information-architecture-model-projection": informationArchitectureModelProjectionSchema,
  "screen-state-inventory-projection": screenStateInventoryProjectionSchema,
  "design-requirements-projection": designRequirementsProjectionSchema,
  "design-system-token-contract-projection": designSystemTokenContractProjectionSchema,
  "accessibility-design-rules-projection": accessibilityDesignRulesProjectionSchema,
  "responsive-multi-platform-targets-projection": responsiveMultiPlatformTargetsProjectionSchema,
  "manual-figma-execution-path-projection": manualFigmaExecutionPathProjectionSchema,
  "figma-mcp-capability-discovery-projection": figmaMcpCapabilityDiscoveryProjectionSchema,
  "figma-read-snapshot-projection": figmaReadSnapshotProjectionSchema,
  "figma-context-import-projection": figmaContextImportProjectionSchema,
  "outbound-design-brief-package-projection": outboundDesignBriefPackageProjectionSchema,
  "governed-figma-write-projection": governedFigmaWriteProjectionSchema,
  "finalized-figma-snapshot-import-projection": finalizedFigmaSnapshotImportProjectionSchema,
  "design-to-requirement-binding-projection": designToRequirementBindingProjectionSchema,
  "designer-ready-gate-projection": designerReadyGateProjectionSchema,
  "design-delta-projection": designDeltaProjectionSchema,
  "design-conflict-resolution-projection": designConflictResolutionProjectionSchema,
  "human-design-approval-projection": humanDesignApprovalProjectionSchema,
  "design-baseline-projection": designBaselineProjectionSchema,
  "design-drift-detection-projection": designDriftDetectionProjectionSchema,
} as const

type Phase2ProjectionKind = keyof typeof sourceSchemas
type ParsedProjection = ReturnType<(typeof sourceSchemas)[Phase2ProjectionKind]["parse"]>

const sourceIdByProjectionKind = Object.fromEntries(
  phase2UxFigmaDashboardSourceIds.map((id) => [phase2UxFigmaDashboardSourceDefinitions[id].projectionKind, id]),
) as Record<Phase2ProjectionKind, Phase2UxFigmaDashboardSourceId>

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function count(status: Record<string, unknown>, key: string): number {
  const value = status[key]
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0
}

function state(status: Record<string, unknown>, key: string, fallback = "not-assessed"): string {
  const value = status[key]
  return typeof value === "string" && value.length > 0 ? value : fallback
}

function parseProjection(value: unknown): ParsedProjection {
  const kind = record(value).kind
  if (typeof kind !== "string" || !(kind in sourceSchemas)) {
    throw new Phase2UxFigmaDashboardBindingError("The Phase 2 dashboard source kind is unknown")
  }
  return sourceSchemas[kind as Phase2ProjectionKind].parse(value) as ParsedProjection
}

function exactProjectionBinding(product: Product, initiative: Initiative, projection: ParsedProjection): boolean {
  return projection.product.id.toLowerCase() === product.id.toLowerCase() &&
    projection.product.revision === revisionOf(product) && projection.product.digest === canonicalDigest(product) &&
    projection.initiative.id.toLowerCase() === initiative.id.toLowerCase() &&
    projection.initiative.revision === revisionOf(initiative) && projection.initiative.digest === canonicalDigest(initiative) &&
    projection.initiative.state === initiative.state
}

function sourceEntry(id: Phase2UxFigmaDashboardSourceId, projection?: ParsedProjection): Phase2UxFigmaDashboardSource {
  const definition = phase2UxFigmaDashboardSourceDefinitions[id]
  if (!projection) {
    return {
      id,
      title: definition.title,
      group: definition.group,
      projectionKind: definition.projectionKind,
      availability: "unavailable",
    }
  }
  const status = record(projection.status)
  const staleBindingCount = count(status, "staleBindingCount")
  const staleSourceReferenceCount = count(status, "staleSourceReferenceCount")
  const unresolvedQuestionCount = count(status, "unresolvedQuestionCount")
  const reasonCount = Array.isArray(status.reasons) ? status.reasons.length : 0
  const assessmentState = state(status, "state")
  const attentionRequired = !assessmentState.startsWith("complete-") || reasonCount > 0 ||
    staleBindingCount > 0 || staleSourceReferenceCount > 0 || unresolvedQuestionCount > 0 || !projection.candidate
  return {
    id,
    title: definition.title,
    group: definition.group,
    projectionKind: definition.projectionKind,
    availability: attentionRequired ? "attention-required" : "current",
    binding: {
      snapshotDigest: projection.snapshotDigest,
      observedAt: projection.observedAt,
      assessedAt: state(status, "assessedAt", projection.observedAt),
      ...(projection.candidate ? {
        candidate: {
          recordId: projection.candidate.id,
          revision: projection.candidate.revision,
          digest: projection.candidate.digest,
        },
      } : {}),
    },
    assessment: {
      state: assessmentState,
      ...(typeof status.reviewState === "string" ? { reviewState: status.reviewState } : {}),
      ...(typeof status.candidateResult === "string" ? { candidateResult: status.candidateResult } : {}),
      reasonCount,
      staleBindingCount,
      staleSourceReferenceCount,
      unresolvedQuestionCount,
      attentionRequired,
    },
  }
}

export function composePhase2UxFigmaDashboard(
  productValue: Product,
  initiativeValue: Initiative,
  projectionValues: readonly unknown[],
  requestValue: Phase2UxFigmaDashboardRequest,
  observedAt = new Date().toISOString(),
): Phase2UxFigmaDashboard {
  const product = productSchema.parse(productValue)
  const initiative = initiativeSchema.parse(initiativeValue)
  const request = phase2UxFigmaDashboardRequestSchema.parse(requestValue)
  const productRevision = revisionOf(product)
  const productDigest = canonicalDigest(product)
  const initiativeRevision = revisionOf(initiative)
  const initiativeDigest = canonicalDigest(initiative)
  if (request.expectedProductId.toLowerCase() !== product.id.toLowerCase() ||
      request.expectedProductRevision !== productRevision || request.expectedProductDigest !== productDigest ||
      request.expectedInitiativeId.toLowerCase() !== initiative.id.toLowerCase() ||
      request.expectedInitiativeRevision !== initiativeRevision || request.expectedInitiativeDigest !== initiativeDigest ||
      initiative.productId.toLowerCase() !== product.id.toLowerCase()) {
    throw new Phase2UxFigmaDashboardBindingError()
  }

  const byId = new Map<Phase2UxFigmaDashboardSourceId, ParsedProjection>()
  for (const value of projectionValues) {
    const projection = parseProjection(value)
    const id = sourceIdByProjectionKind[projection.kind as Phase2ProjectionKind]
    if (!id || byId.has(id) || !exactProjectionBinding(product, initiative, projection)) {
      throw new Phase2UxFigmaDashboardBindingError()
    }
    byId.set(id, projection)
  }
  const sources = phase2UxFigmaDashboardSourceIds.map((id) => sourceEntry(id, byId.get(id)))
  const sourceStatus = (id: Phase2UxFigmaDashboardSourceId): Record<string, unknown> =>
    record(byId.get(id)?.status)
  const metric = (id: Phase2UxFigmaDashboardSourceId, key: string): number => count(sourceStatus(id), key)
  const statusState = (id: Phase2UxFigmaDashboardSourceId, key: string): string => state(sourceStatus(id), key)
  const currentSourceCount = sources.filter((source) => source.availability === "current").length
  const attentionRequiredSourceCount = sources.filter((source) => source.availability === "attention-required").length
  const unavailableSourceCount = sources.filter((source) => source.availability === "unavailable").length
  const staleBindingCount = sources.reduce((sum, source) => sum + (source.assessment?.staleBindingCount ?? 0), 0)
  const staleSourceReferenceCount = sources.reduce((sum, source) => sum + (source.assessment?.staleSourceReferenceCount ?? 0), 0)
  const unresolvedQuestionCount = sources.reduce((sum, source) => sum + (source.assessment?.unresolvedQuestionCount ?? 0), 0)
  const observedTimes = sources.flatMap((source) => source.binding ? [source.binding.observedAt] : []).sort()
  const freshnessAttention = staleBindingCount > 0 || staleSourceReferenceCount > 0
  const phaseAttention = attentionRequiredSourceCount > 0 || unavailableSourceCount > 0 || freshnessAttention

  const content = phase2UxFigmaDashboardContentSchema.parse({
    schemaVersion: 1,
    kind: "phase-2-ux-figma-dashboard",
    viewDefinitionVersion: "gaep-phase-2-ux-figma-dashboard-v1",
    phase: { id: "phase-2-design", label: "Phase 2 — UX and Figma Loop" },
    product: { recordType: "product", recordId: product.id, revision: productRevision, digest: productDigest },
    initiative: { recordType: "initiative", recordId: initiative.id, revision: initiativeRevision, digest: initiativeDigest, state: initiative.state },
    sources,
    experience: {
      personaCount: metric("design-personas-roles", "personaCount"),
      designRoleCount: metric("design-personas-roles", "designRoleCount"),
      journeyCount: metric("user-journeys", "journeyCount"),
      touchpointCount: metric("user-journeys", "touchpointCount"),
      informationArchitectureNodeCount: metric("information-architecture", "nodeCount"),
      routeCount: metric("information-architecture", "routeCount"),
      screenCount: metric("screen-state-inventory", "screenCount"),
      stateCount: metric("screen-state-inventory", "stateCount"),
      variantCount: metric("screen-state-inventory", "variantCount"),
    },
    designSystem: {
      requirementCount: metric("design-requirements", "requirementCount"),
      designSystemCount: metric("design-system-token-contract", "designSystemCount"),
      tokenCount: metric("design-system-token-contract", "tokenCount"),
      componentCount: metric("design-system-token-contract", "componentCount"),
      accessibilityRuleCount: metric("accessibility-design-rules", "ruleCount"),
      accessibilityCheckCount: metric("accessibility-design-rules", "checkCount"),
      platformTargetCount: metric("responsive-multi-platform-targets", "platformTargetCount"),
      breakpointCount: metric("responsive-multi-platform-targets", "breakpointCount"),
    },
    figma: {
      fileCount: metric("figma-read-snapshot", "fileCount"),
      componentCount: metric("figma-read-snapshot", "componentCount"),
      variableCount: metric("figma-read-snapshot", "variableCount"),
      designBindingCount: metric("design-to-requirement-binding", "bindingCount"),
      humanReviewedBindingCount: metric("design-to-requirement-binding", "humanReviewedBindingCount"),
      unboundDesignItemCount: metric("design-to-requirement-binding", "unboundDesignItemCount"),
      connectionState: "not-established",
      writeExecutionState: "not-performed",
      importExecutionState: "not-performed",
    },
    governance: {
      designerReadyCandidateResult: statusState("designer-ready-gate", "candidateResult"),
      humanApprovalCandidateResult: statusState("human-design-approval", "candidateResult"),
      baselineCandidateResult: statusState("design-baseline", "candidateResult"),
      baselineDesignationState: "not-established",
      driftCandidateResult: statusState("design-drift-detection", "candidateResult"),
      approvalState: "not-established",
      readinessState: "not-established",
      remediationEffectState: "not-applied",
    },
    drift: {
      observationCount: metric("design-drift-detection", "observationCount"),
      requirementToDesignCount: metric("design-drift-detection", "requirementToDesignCount"),
      designToImplementationCount: metric("design-drift-detection", "designToImplementationCount"),
      conformantCount: metric("design-drift-detection", "conformantCount"),
      driftCount: metric("design-drift-detection", "driftCount"),
      unassessedCount: metric("design-drift-detection", "unassessedCount"),
      blockerCount: metric("design-drift-detection", "blockerCount"),
      highSeverityCount: metric("design-drift-detection", "highSeverityCount"),
      remediationCandidateCount: metric("design-drift-detection", "remediationCandidateCount"),
    },
    freshness: {
      state: freshnessAttention ? "attention-required" : "current",
      staleBindingCount,
      staleSourceReferenceCount,
      unresolvedQuestionCount,
      ...(observedTimes[0] ? { oldestSourceObservedAt: observedTimes[0] } : {}),
      ...(observedTimes.at(-1) ? { newestSourceObservedAt: observedTimes.at(-1) } : {}),
    },
    phaseStatus: {
      state: phaseAttention ? "attention-required" : "candidate-complete-for-human-review",
      expectedSourceCount: phase2UxFigmaDashboardSourceIds.length,
      currentSourceCount,
      attentionRequiredSourceCount,
      unavailableSourceCount,
      sourceCatalogDigest: canonicalDigest(sources),
      productOwnerAcceptance: "not-established",
      readinessAuthority: "not-established",
      phaseEntryAuthority: "not-established",
    },
    evidenceCues: {
      freshness: unavailableSourceCount > 0 ? "unknown" : freshnessAttention ? "potentially-stale" : "current",
      confidence: { state: "not-assessed", basis: "no-governed-confidence-evaluation-is-bound" },
    },
    observedAt,
    sourceBoundary: "current-governed-product-initiative-and-phase-2-projections-only",
    privacyBoundary: "dashboard-exposes-identities-counts-statuses-times-and-digests-not-design-requirement-figma-source-human-or-personal-content-secrets-credentials-or-permissions",
    limitations: [
      "Unavailable or attention-required sources remain explicit; zero counts never establish not-applicability, completeness, validity, approval, baseline, or readiness.",
      "Figma connection, read, import, write, and remediation effects are not performed by this derived dashboard.",
      "The dashboard is reproducible only for the exact source snapshot digests and view-definition version recorded here.",
    ],
    authorityBoundary: "phase-2-dashboard-is-a-derived-read-only-view-not-a-second-source-of-truth-or-completeness-validity-approval-baseline-readiness-remediation-figma-implementation-or-action-authority",
  })
  return phase2UxFigmaDashboardSchema.parse({ ...content, snapshotDigest: canonicalDigest(content) })
}
