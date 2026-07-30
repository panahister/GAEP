import {
  handoffSchema,
  managedApplyDecisionReceiptSchema,
  managedRunEvidenceSchema,
  managedRunRecordSchema,
  managedRunResultSchema,
  productStudioSectionIds,
  type AdapterCapabilities,
  type AgentSelection,
  type BusinessArchitectureBaselineProjection,
  type BoundedContextModelProjection,
  type SecurityPrivacyAssessmentProjection,
  type ProcessModelProjection,
  type DataModelProjection,
  type AuthorizationModelProjection,
  type EventIntegrationModelProjection,
  type FailureRecoveryModelProjection,
  type ArchitectureChallengeModelProjection,
  type DecisionRegisterProjection,
  type DeliveryPhaseId,
  type RiskRegisterProjection,
  type EvidenceRegistryProjection,
  type EndToEndTraceabilityProjection,
  type P0P4ReadinessGateProjection,
  type P5HandoffPackageProjection,
  type DesignApplicabilityProjection,
  type DesignPersonaRoleModelProjection,
  type UserJourneyModelProjection,
  type InformationArchitectureModelProjection,
  type ScreenStateInventoryProjection,
  type DesignRequirementsProjection,
  type DesignSystemTokenContractProjection,
  type AccessibilityDesignRulesProjection,
  type ResponsiveMultiPlatformTargetsProjection,
  type ManualFigmaExecutionPathProjection,
  type FigmaMcpCapabilityDiscoveryProjection,
  type FigmaReadSnapshotProjection,
  type FigmaContextImportProjection,
  type OutboundDesignBriefPackageProjection,
  type GovernedFigmaWriteProjection,
  type FinalizedFigmaSnapshotImportProjection,
  type DesignToRequirementBindingProjection,
  type DesignerReadyGateProjection,
  type DesignDeltaProjection,
  type DesignConflictResolutionProjection,
  type HumanDesignApprovalProjection,
  type DesignBaselineProjection,
  type DesignDriftDetectionProjection,
  type BusinessCapabilityMapProjection,
  type BusinessRuleCatalogProjection,
  type BusinessUnderstandingProjection,
  type Change,
  type Decision,
  type Handoff,
  type Initiative,
  type InitiativeEntryAssessment,
  type ManagedApplyDecisionReceipt,
  type ManagedRunEvidence,
  type ManagedRunRecord,
  type ManagedRunResult,
  type OperatingModelProjection,
  type Product,
  type ProductDesignDraft,
  type Risk,
  type Run,
  type SourceGovernanceProjection,
  type SystemSolutionArchitectureProjection,
  type TraceImpact,
  type TraceLink,
  type ValueStreamModelProjection,
  type WorkItem,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import type { ProductStudioService } from "@gaep/engine"
import { describe, expect, it, vi } from "vitest"

import {
  CurrentEngineStudioDataSource,
  type CurrentEngineStudioContext,
  type ExistingStudioCommand,
} from "./current-engine-studio-data-source.js"
import type { PortableDesignSnapshot } from "./portable-design-workflow.js"
import { isStudioSnapshot, studioRoutes } from "./studio-protocol.js"

const workspacePath = "/machine-only/example-product"
const product: Product = {
  schemaVersion: 1,
  id: "11111111-1111-4111-8111-111111111111",
  kind: "product",
  revision: 3,
  name: "Example Product",
  summary: "A bounded example Product.",
  problem: "Teams need a governed way to create product context.",
  affectedUsers: "Product and engineering teams",
  desiredOutcome: "Teams can inspect truthful local Product state.",
  successSignals: ["A valid local snapshot exists"],
  firstWorkflow: "Open Product Studio and inspect the overview.",
  exclusions: ["No external deployment"],
  profile: "software",
  lifecycleState: "active",
  createdAt: "2026-07-21T00:00:00.000Z",
  updatedAt: "2026-07-21T00:00:00.000Z",
}

const initiative: Initiative = {
  schemaVersion: 1,
  id: "22222222-2222-4222-8222-222222222222",
  kind: "initiative",
  revision: 1,
  productId: product.id,
  title: "Inspect current truth",
  outcome: "Product Studio exposes only observed engine truth.",
  scope: ["VS Code extension"],
  exclusions: ["Cross-host implementation"],
  state: "active",
  createdAt: "2026-07-21T00:00:00.000Z",
  updatedAt: "2026-07-21T00:00:00.000Z",
}

function entryAssessment(
  overrides: Partial<InitiativeEntryAssessment> = {},
): InitiativeEntryAssessment {
  return {
    schemaVersion: 1,
    kind: "initiative-entry-assessment",
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    productId: product.id,
    productRevision: product.revision ?? 1,
    productDigest: canonicalDigest(product),
    classification: {
      status: "current",
      digest: `sha256:${"c".repeat(64)}`,
      completeness: {
        status: "complete",
        policyVersion: "gaep-initiative-classification-completeness-v1",
        policyDigest: `sha256:${"e".repeat(64)}`,
        unknownDimensionCount: 0,
        unresolvedQuestionCount: 0,
        missingConditionalDimensionCount: 0,
        confidenceSufficient: true,
      },
    },
    applicability: {
      status: "missing",
      decisionCount: 0,
      unresolvedSubjectCount: 0,
      pendingHumanDecisionCount: 0,
      blockedDecisionCount: 0,
      pendingApprovalCount: 0,
      rejectedApprovalCount: 0,
      coverage: {
        status: "missing",
        catalogVersion: "gaep-initiative-applicability-subjects-v1",
        catalogDigest: `sha256:${"f".repeat(64)}`,
        subjectCount: 49,
        coveredSubjectCount: 0,
        missingSubjectCount: 49,
        unexpectedSubjectCount: 0,
        mismatchedSubjectCount: 0,
      },
    },
    state: "attention-required",
    reasons: ["Initiative applicability has not been resolved"],
    assessedAt: "2026-07-25T00:00:00.000Z",
    authorityBoundary: "entry-assessment-is-read-only-and-does-not-grant-approval-readiness-or-action-authority",
    ...overrides,
  }
}

function sourceGovernanceProjection(): SourceGovernanceProjection {
  const assessment = {
    schemaVersion: 1 as const,
    kind: "source-governance-assessment" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    sourceCount: 1,
    baselineCount: 1,
    provenanceCount: 1,
    currentBaseline: {
      id: "77777777-7777-4777-8777-777777777777",
      revision: 1,
      digest: `sha256:${"7".repeat(64)}` as const,
      membershipDigest: `sha256:${"8".repeat(64)}` as const,
      status: "current" as const,
      memberCount: 1,
    },
    staleSourceCount: 0,
    unknownAuthorityCount: 0,
    unbaselinedSourceCount: 0,
    unprovenancedSourceCount: 0,
    state: "ready" as const,
    reasons: [],
    assessedAt: "2026-07-25T03:00:00.000Z",
    authorityBoundary: "source-governance-assessment-reports-recorded-evidence-and-does-not-designate-a-baseline-approve-readiness-or-authorize-action" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "source-governance-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: {
      id: initiative.id,
      revision: initiative.revision ?? 1,
      digest: canonicalDigest(initiative),
      state: initiative.state,
    },
    assessment,
    sources: [{
      id: "66666666-6666-4666-8666-666666666666",
      revision: 1,
      title: "Reviewed requirements source",
      sourceType: "requirements" as const,
      owner: { kind: "human" as const, id: "local-actor-test" },
      semanticAuthority: {
        standing: "authoritative" as const,
        domain: "VS Code Source workflow",
        scope: ["P0 source intake"],
      },
      knowledgeDisposition: "confirmed" as const,
      informationClassification: "internal" as const,
      freshness: "fresh" as const,
      availability: "available" as const,
      contentDigest: `sha256:${"6".repeat(64)}` as const,
      recordDigest: `sha256:${"5".repeat(64)}` as const,
      updatedAt: "2026-07-25T02:58:00.000Z",
    }],
    baselines: [{
      id: assessment.currentBaseline.id,
      revision: 1,
      title: "P0 exact source candidate",
      state: "candidate" as const,
      membershipDigest: assessment.currentBaseline.membershipDigest,
      memberCount: 1,
      assessmentStatus: "current" as const,
      updatedAt: "2026-07-25T02:59:00.000Z",
    }],
    provenance: [{
      id: "88888888-8888-4888-8888-888888888888",
      targetKind: "claim" as const,
      targetDigest: `sha256:${"6".repeat(64)}` as const,
      disposition: "confirmed" as const,
      sourceCount: 1,
      transformationCount: 0,
      recordedAt: "2026-07-25T03:00:00.000Z",
    }],
    limits: {
      sources: { shown: 1, total: 1, omitted: 0 },
      baselines: { shown: 1, total: 1, omitted: 0 },
      provenance: { shown: 1, total: 1, omitted: 0 },
    },
    observedAt: assessment.assessedAt,
    privacyBoundary: "projection-contains-portable-governance-metadata-and-digests-only-not-source-bytes-locators-local-paths-or-credentials" as const,
    authorityBoundary: "source-governance-projection-does-not-designate-a-baseline-approve-readiness-transfer-authority-or-authorize-action" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function businessUnderstandingProjection(): BusinessUnderstandingProjection {
  const assessment = {
    schemaVersion: 1 as const,
    kind: "business-understanding-assessment" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    businessUnderstanding: {
      recordId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      revision: 2,
      digest: `sha256:${"a".repeat(64)}` as const,
    },
    stakeholderModel: {
      recordId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      revision: 1,
      digest: `sha256:${"b".repeat(64)}` as const,
    },
    outcomeModel: {
      recordId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      revision: 1,
      digest: `sha256:${"c".repeat(64)}` as const,
    },
    stakeholderCount: 8,
    representedStakeholderCategoryCount: 8,
    unresolvedStakeholderCategoryCount: 0,
    verifiedAuthorityCount: 0,
    unverifiedAuthorityCount: 0,
    outcomeCount: 2,
    measureCount: 4,
    observedBaselineCount: 4,
    unresolvedQuestionCount: 0,
    blockingQuestionCount: 0,
    staleBindingCount: 0,
    staleSourceReferenceCount: 0,
    state: "complete-for-review" as const,
    reasons: [],
    assessedAt: "2026-07-25T04:00:00.000Z",
    authorityBoundary: "business-understanding-assessment-reports-recorded-candidate-evidence-and-does-not-approve-decide-designate-readiness-or-authorize-action" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "business-understanding-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: {
      id: initiative.id,
      revision: initiative.revision ?? 1,
      digest: canonicalDigest(initiative),
      state: initiative.state,
    },
    assessment,
    businessUnderstanding: {
      id: assessment.businessUnderstanding.recordId,
      revision: assessment.businessUnderstanding.revision,
      digest: assessment.businessUnderstanding.digest,
      state: "candidate" as const,
      objectiveCount: 3,
      constraintCount: 2,
      assumptionCount: 1,
      unresolvedQuestionCount: 0,
      glossaryTermCount: 5,
      updatedAt: "2026-07-25T03:55:00.000Z",
    },
    stakeholderModel: {
      id: assessment.stakeholderModel.recordId,
      revision: assessment.stakeholderModel.revision,
      digest: assessment.stakeholderModel.digest,
      state: "candidate" as const,
      stakeholderCount: 8,
      representedCategoryCount: 8,
      unresolvedCategoryCount: 0,
      verifiedAuthorityCount: 0,
      updatedAt: "2026-07-25T03:56:00.000Z",
    },
    outcomeModel: {
      id: assessment.outcomeModel.recordId,
      revision: assessment.outcomeModel.revision,
      digest: assessment.outcomeModel.digest,
      state: "candidate" as const,
      outcomeCount: 2,
      measureCount: 4,
      countermetricCount: 1,
      burdenMeasureCount: 1,
      observedBaselineCount: 4,
      updatedAt: "2026-07-25T03:57:00.000Z",
    },
    observedAt: assessment.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-business-narrative-personal-data-source-content-locators-or-credentials" as const,
    authorityBoundary: "business-understanding-projection-does-not-approve-appoint-decide-designate-readiness-or-authorize-action" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function businessCapabilityMapProjection(): BusinessCapabilityMapProjection {
  const assessment = {
    schemaVersion: 1 as const,
    kind: "business-capability-map-assessment" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    capabilityMap: {
      recordId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      revision: 2,
      digest: `sha256:${"d".repeat(64)}` as const,
    },
    capabilityCount: 7,
    ownedCapabilityCount: 6,
    unownedCapabilityCount: 1,
    objectiveCoverageCount: 3,
    outcomeCoverageCount: 2,
    openGapCount: 2,
    criticalGapCount: 1,
    unknownCurrentMaturityCount: 1,
    unassessedPriorityCount: 1,
    staleBindingCount: 0,
    staleSourceReferenceCount: 0,
    state: "attention-required" as const,
    reasons: ["One or more capabilities do not have a candidate owner"],
    assessedAt: "2026-07-25T04:10:00.000Z",
    authorityBoundary: "business-capability-map-assessment-reports-recorded-candidate-coverage-and-gaps-and-does-not-approve-priority-readiness-or-authorize-action" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "business-capability-map-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: {
      id: initiative.id,
      revision: initiative.revision ?? 1,
      digest: canonicalDigest(initiative),
      state: initiative.state,
    },
    assessment,
    capabilityMap: {
      id: assessment.capabilityMap.recordId,
      revision: assessment.capabilityMap.revision,
      digest: assessment.capabilityMap.digest,
      state: "candidate" as const,
      capabilityCount: 7,
      ownedCapabilityCount: 6,
      openGapCount: 2,
      criticalGapCount: 1,
      candidatePriorityCount: 6,
      updatedAt: "2026-07-25T04:09:00.000Z",
    },
    observedAt: assessment.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-capability-narrative-personal-data-source-content-locators-or-credentials" as const,
    authorityBoundary: "business-capability-map-projection-does-not-approve-prioritize-baseline-designate-readiness-or-authorize-action" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function valueStreamModelProjection(): ValueStreamModelProjection {
  const assessment = {
    schemaVersion: 1 as const,
    kind: "value-stream-model-assessment" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    valueStreamModel: {
      recordId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      revision: 2,
      digest: `sha256:${"e".repeat(64)}` as const,
    },
    valueStreamCount: 3,
    ownedValueStreamCount: 2,
    unownedValueStreamCount: 1,
    stageCount: 9,
    dependencyCount: 2,
    capabilityCoverageCount: 6,
    outcomeCoverageCount: 2,
    absentFlowEvidenceCount: 1,
    openBottleneckCount: 2,
    criticalBottleneckCount: 1,
    staleBindingCount: 0,
    staleSourceReferenceCount: 0,
    state: "attention-required" as const,
    reasons: ["One or more value streams do not have a candidate owner"],
    assessedAt: "2026-07-25T05:00:00.000Z",
    authorityBoundary: "value-stream-model-assessment-reports-recorded-candidate-flow-coverage-and-gaps-and-does-not-approve-baseline-readiness-or-authorize-action" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "value-stream-model-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: {
      id: initiative.id,
      revision: initiative.revision ?? 1,
      digest: canonicalDigest(initiative),
      state: initiative.state,
    },
    assessment,
    valueStreamModel: {
      id: assessment.valueStreamModel.recordId,
      revision: assessment.valueStreamModel.revision,
      digest: assessment.valueStreamModel.digest,
      state: "candidate" as const,
      valueStreamCount: 3,
      ownedValueStreamCount: 2,
      stageCount: 9,
      dependencyCount: 2,
      openBottleneckCount: 2,
      criticalBottleneckCount: 1,
      updatedAt: "2026-07-25T04:59:00.000Z",
    },
    observedAt: assessment.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-value-stream-narrative-personal-data-source-content-locators-or-credentials" as const,
    authorityBoundary: "value-stream-model-projection-does-not-approve-baseline-priority-readiness-or-authorize-action" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function operatingModelProjection(): OperatingModelProjection {
  const assessment = {
    schemaVersion: 1 as const,
    kind: "operating-model-assessment" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    operatingModel: {
      recordId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      revision: 2,
      digest: `sha256:${"f".repeat(64)}` as const,
    },
    roleCount: 6,
    governanceSystemCount: 2,
    unassignedAppointingAuthorityCount: 1,
    insufficientCapacityCount: 2,
    unfundedCapacityCount: 3,
    decisionRightCount: 8,
    unassignedDecisionAuthorityCount: 1,
    forumCount: 2,
    cycleCount: 3,
    supportCapacityGapCount: 1,
    emergencyAuthorityGapCount: 1,
    staleBindingCount: 0,
    staleSourceReferenceCount: 0,
    state: "attention-required" as const,
    reasons: ["One or more candidate roles have no candidate appointing authority"],
    assessedAt: "2026-07-26T07:00:00.000Z",
    authorityBoundary: "operating-model-assessment-reports-candidate-structural-coverage-and-gaps-and-does-not-appoint-fund-approve-baseline-readiness-or-authorize-action" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "operating-model-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: {
      id: initiative.id,
      revision: initiative.revision ?? 1,
      digest: canonicalDigest(initiative),
      state: initiative.state,
    },
    assessment,
    operatingModel: {
      id: assessment.operatingModel.recordId,
      revision: assessment.operatingModel.revision,
      digest: assessment.operatingModel.digest,
      state: "candidate" as const,
      roleCount: 6,
      decisionRightCount: 8,
      forumCount: 2,
      cycleCount: 3,
      updatedAt: "2026-07-26T06:59:00.000Z",
    },
    observedAt: assessment.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-operating-narrative-personal-data-source-content-locators-or-credentials" as const,
    authorityBoundary: "operating-model-projection-does-not-appoint-fund-approve-baseline-readiness-or-authorize-action" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function businessRuleCatalogProjection(): BusinessRuleCatalogProjection {
  const assessment = {
    schemaVersion: 1 as const,
    kind: "business-rule-catalog-assessment" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    businessRuleCatalog: {
      recordId: "abababab-abab-4bab-8bab-abababababab",
      revision: 2,
      digest: `sha256:${"b".repeat(64)}` as const,
    },
    ruleCount: 7,
    sourceBackedRuleCount: 7,
    nonExceptionableRuleCount: 3,
    enforcementTargetCount: 4,
    unassignedEnforcementTargetCount: 1,
    unverifiedEnforcementTargetCount: 2,
    exceptionCount: 2,
    unassignedExceptionAuthorityCount: 1,
    staleBindingCount: 0,
    staleSourceReferenceCount: 0,
    state: "attention-required" as const,
    reasons: ["One or more enforcement targets have no candidate assignment"],
    assessedAt: "2026-07-26T08:30:00.000Z",
    authorityBoundary: "business-rule-catalog-assessment-reports-candidate-coverage-and-gaps-and-does-not-evaluate-policy-grant-exceptions-deploy-enforcement-approve-baseline-readiness-or-authorize-action" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "business-rule-catalog-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: {
      id: initiative.id,
      revision: initiative.revision ?? 1,
      digest: canonicalDigest(initiative),
      state: initiative.state,
    },
    assessment,
    businessRuleCatalog: {
      id: assessment.businessRuleCatalog.recordId,
      revision: assessment.businessRuleCatalog.revision,
      digest: assessment.businessRuleCatalog.digest,
      state: "candidate" as const,
      ruleCount: 7,
      enforcementTargetCount: 4,
      exceptionCount: 2,
      nonExceptionableRuleCount: 3,
      updatedAt: "2026-07-26T08:29:00.000Z",
    },
    observedAt: assessment.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-rule-narrative-source-content-personal-data-locators-or-credentials" as const,
    authorityBoundary: "business-rule-catalog-projection-does-not-evaluate-policy-grant-exceptions-deploy-enforcement-approve-baseline-readiness-or-authorize-action" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function businessArchitectureBaselineProjection(): BusinessArchitectureBaselineProjection {
  const assessment = {
    schemaVersion: 1 as const,
    kind: "business-architecture-baseline-assessment" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    baseline: {
      recordId: "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd",
      revision: 2,
      digest: `sha256:${"c".repeat(64)}` as const,
    },
    coveredElementCount: 27,
    includedElementCount: 25,
    excludedElementCount: 1,
    unresolvedElementCount: 1,
    integrationClaimCount: 8,
    consistencyCheckCount: 6,
    consistencyGapCount: 2,
    staleBindingCount: 1,
    staleSourceReferenceCount: 0,
    state: "attention-required" as const,
    reasons: ["One or more candidate architecture elements remain unresolved"],
    assessedAt: "2026-07-26T09:30:00.000Z",
    authorityBoundary: "business-architecture-baseline-assessment-reports-candidate-coherence-and-gaps-and-does-not-designate-or-approve-a-baseline-establish-readiness-or-authorize-action" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "business-architecture-baseline-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: {
      id: initiative.id,
      revision: initiative.revision ?? 1,
      digest: canonicalDigest(initiative),
      state: initiative.state,
    },
    assessment,
    baseline: {
      id: assessment.baseline.recordId,
      revision: assessment.baseline.revision,
      digest: assessment.baseline.digest,
      membershipDigest: `sha256:${"d".repeat(64)}` as const,
      state: "candidate" as const,
      coveredElementCount: 27,
      integrationClaimCount: 8,
      consistencyGapCount: 2,
      updatedAt: "2026-07-26T09:29:00.000Z",
    },
    observedAt: assessment.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-architecture-narrative-source-content-personal-data-locators-or-credentials" as const,
    authorityBoundary: "business-architecture-baseline-projection-does-not-designate-or-approve-a-baseline-establish-readiness-grant-exceptions-deploy-enforcement-or-authorize-action" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function systemSolutionArchitectureProjection(): SystemSolutionArchitectureProjection {
  const assessment = {
    schemaVersion: 1 as const,
    kind: "system-solution-architecture-assessment" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    architecture: {
      recordId: "dededede-dede-4ede-8ede-dededededede",
      revision: 3,
      digest: `sha256:${"e".repeat(64)}` as const,
    },
    concernCount: 4,
    viewCount: 3,
    elementCount: 9,
    relationCount: 12,
    qualityAttributeCount: 5,
    unresolvedQualityAttributeCount: 1,
    decisionCount: 4,
    unresolvedDecisionCount: 2,
    conformanceCriterionCount: 6,
    unresolvedConformanceCriterionCount: 1,
    lifecycleGapCount: 1,
    inconsistencyCount: 0,
    unresolvedQuestionCount: 2,
    staleBindingCount: 1,
    staleSourceReferenceCount: 0,
    state: "attention-required" as const,
    reasons: ["One or more architecture decisions remain unresolved"],
    assessedAt: "2026-07-26T10:30:00.000Z",
    authorityBoundary: "system-solution-architecture-assessment-reports-candidate-coverage-and-gaps-and-does-not-approve-baseline-readiness-conformance-technology-or-action" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "system-solution-architecture-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: {
      id: initiative.id,
      revision: initiative.revision ?? 1,
      digest: canonicalDigest(initiative),
      state: initiative.state,
    },
    assessment,
    architecture: {
      id: assessment.architecture.recordId,
      revision: assessment.architecture.revision,
      digest: assessment.architecture.digest,
      membershipDigest: `sha256:${"f".repeat(64)}` as const,
      state: "candidate" as const,
      concernCount: 4,
      viewCount: 3,
      elementCount: 9,
      qualityAttributeCount: 5,
      decisionCount: 4,
      updatedAt: "2026-07-26T10:29:00.000Z",
    },
    observedAt: assessment.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-architecture-narrative-source-content-personal-data-locators-or-credentials" as const,
    authorityBoundary: "system-solution-architecture-projection-does-not-approve-or-designate-an-architecture-baseline-establish-readiness-prove-conformance-mandate-technology-or-authorize-action" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function boundedContextModelProjection(): BoundedContextModelProjection {
  const assessment = {
    schemaVersion: 1 as const,
    kind: "bounded-context-ownership-assessment" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    model: {
      recordId: "efefefef-efef-4fef-8fef-efefefefefef",
      revision: 2,
      digest: `sha256:${"1".repeat(64)}` as const,
    },
    boundedContextCount: 3,
    coreContextCount: 1,
    languageTermCount: 11,
    contractCount: 4,
    unresolvedContractCount: 1,
    relationshipCount: 3,
    unresolvedRelationshipCount: 1,
    unassignedArchitectureElementCount: 2,
    unownedDataAssetCount: 1,
    unmappedCrossContextRelationCount: 2,
    inconsistencyCount: 0,
    unresolvedQuestionCount: 2,
    staleBindingCount: 1,
    staleSourceReferenceCount: 0,
    state: "attention-required" as const,
    reasons: ["One or more cross-context contracts remain unresolved"],
    assessedAt: "2026-07-26T11:00:00.000Z",
    authorityBoundary: "bounded-context-model-assessment-reports-candidate-coverage-and-gaps-and-does-not-appoint-owners-approve-boundaries-accept-contracts-establish-readiness-or-authorize-action" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "bounded-context-ownership-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: {
      id: initiative.id,
      revision: initiative.revision ?? 1,
      digest: canonicalDigest(initiative),
      state: initiative.state,
    },
    assessment,
    model: {
      id: assessment.model.recordId,
      revision: assessment.model.revision,
      digest: assessment.model.digest,
      membershipDigest: `sha256:${"2".repeat(64)}` as const,
      state: "candidate" as const,
      boundedContextCount: 3,
      contractCount: 4,
      relationshipCount: 3,
      updatedAt: "2026-07-26T10:59:00.000Z",
    },
    observedAt: assessment.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-boundary-language-contract-source-content-personal-data-locators-or-credentials" as const,
    authorityBoundary: "bounded-context-model-projection-does-not-appoint-owners-approve-boundaries-accept-contracts-establish-readiness-or-authorize-action" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function securityPrivacyAssessmentProjection(): SecurityPrivacyAssessmentProjection {
  const status = {
    schemaVersion: 1 as const,
    kind: "security-privacy-threat-assessment-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    assessment: {
      recordId: "f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f1f1",
      revision: 2,
      digest: `sha256:${"3".repeat(64)}` as const,
    },
    assetCount: 4,
    actorCount: 5,
    trustBoundaryCount: 3,
    dataClassCount: 2,
    dataFlowCount: 4,
    controlCount: 6,
    threatCount: 7,
    unresolvedThreatCount: 2,
    unverifiedControlCount: 1,
    unresolvedProcessingAuthorityCount: 1,
    uncoveredArchitectureElementCount: 0,
    unmappedArchitectureRelationCount: 1,
    unresolvedRequirementCount: 3,
    inconsistencyCount: 0,
    unresolvedQuestionCount: 2,
    staleBindingCount: 1,
    staleSourceReferenceCount: 0,
    state: "attention-required" as const,
    reasons: ["One or more Security or Data Profile requirements remain unresolved"],
    assessedAt: "2026-07-26T11:15:00.000Z",
    authorityBoundary: "security-privacy-threat-status-reports-candidate-coverage-and-gaps-and-does-not-approve-threats-attest-controls-accept-risk-approve-processing-establish-security-readiness-or-authorize-action" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "security-privacy-threat-assessment-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: {
      id: initiative.id,
      revision: initiative.revision ?? 1,
      digest: canonicalDigest(initiative),
      state: initiative.state,
    },
    status,
    assessment: {
      id: status.assessment.recordId,
      revision: status.assessment.revision,
      digest: status.assessment.digest,
      membershipDigest: `sha256:${"4".repeat(64)}` as const,
      state: "candidate" as const,
      assetCount: 4,
      trustBoundaryCount: 3,
      dataClassCount: 2,
      controlCount: 6,
      threatCount: 7,
      updatedAt: "2026-07-26T11:14:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-threat-scenarios-control-content-data-content-personal-data-locators-secrets-or-credentials" as const,
    authorityBoundary: "security-privacy-threat-projection-does-not-approve-a-threat-model-attest-control-effectiveness-accept-risk-approve-processing-establish-security-readiness-or-authorize-action" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function processModelProjection(): ProcessModelProjection {
  const status = {
    schemaVersion: 1 as const,
    kind: "process-model-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    model: {
      recordId: "f2f2f2f2-f2f2-42f2-82f2-f2f2f2f2f2f2",
      revision: 2,
      digest: `sha256:${"5".repeat(64)}` as const,
    },
    processCount: 3,
    stepCount: 9,
    stateDimensionCount: 5,
    stateValueCount: 18,
    transitionCount: 11,
    eventDefinitionCount: 8,
    approvalRequirementCount: 4,
    uncoveredValueStreamCount: 1,
    uncoveredBoundedContextCount: 2,
    uncoveredBusinessRuleCount: 3,
    unresolvedRequirementCount: 4,
    inconsistencyCount: 1,
    unresolvedQuestionCount: 2,
    staleBindingCount: 1,
    staleSourceReferenceCount: 0,
    state: "attention-required" as const,
    reasons: ["One or more Process Model requirements remain unresolved"],
    assessedAt: "2026-07-26T11:30:00.000Z",
    authorityBoundary: "process-model-status-reports-candidate-coverage-and-gaps-and-does-not-approve-workflows-grant-transition-or-execution-authority-establish-operational-readiness-or-authorize-action" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "process-model-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: {
      id: initiative.id,
      revision: initiative.revision ?? 1,
      digest: canonicalDigest(initiative),
      state: initiative.state,
    },
    status,
    model: {
      id: status.model.recordId,
      revision: status.model.revision,
      digest: status.model.digest,
      membershipDigest: `sha256:${"6".repeat(64)}` as const,
      state: "candidate" as const,
      processCount: 3,
      transitionCount: 11,
      approvalRequirementCount: 4,
      updatedAt: "2026-07-26T11:29:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-process-narrative-transition-guards-approval-content-source-content-personal-data-locators-secrets-or-credentials" as const,
    authorityBoundary: "process-model-projection-does-not-approve-workflows-grant-transition-or-execution-authority-establish-operational-readiness-or-authorize-action" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function dataModelProjection(): DataModelProjection {
  const status = {
    schemaVersion: 1 as const,
    kind: "data-model-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    model: {
      recordId: "f3f3f3f3-f3f3-43f3-83f3-f3f3f3f3f3f3",
      revision: 2,
      digest: `sha256:${"7".repeat(64)}` as const,
    },
    entityCount: 6,
    attributeCount: 24,
    relationshipCount: 9,
    lifecycleCount: 4,
    transformationCount: 5,
    uncoveredBoundedContextCount: 1,
    uncoveredSecurityDataClassCount: 2,
    uncoveredProcessCount: 3,
    unresolvedSystemOfRecordCount: 1,
    unresolvedTransformationCount: 2,
    unresolvedRequirementCount: 3,
    inconsistencyCount: 1,
    unresolvedQuestionCount: 2,
    staleBindingCount: 1,
    staleSourceReferenceCount: 0,
    state: "attention-required" as const,
    reasons: ["One or more Data Profile requirements remain unresolved"],
    assessedAt: "2026-07-26T12:30:00.000Z",
    authorityBoundary: "data-model-status-reports-candidate-coverage-and-gaps-and-does-not-approve-a-data-model-or-classification-appoint-ownership-grant-migration-authority-establish-operational-readiness-or-authorize-action" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "data-model-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: {
      id: initiative.id,
      revision: initiative.revision ?? 1,
      digest: canonicalDigest(initiative),
      state: initiative.state,
    },
    status,
    model: {
      id: status.model.recordId,
      revision: status.model.revision,
      digest: status.model.digest,
      membershipDigest: `sha256:${"8".repeat(64)}` as const,
      state: "candidate" as const,
      entityCount: 6,
      relationshipCount: 9,
      lifecycleCount: 4,
      updatedAt: "2026-07-26T12:29:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-entity-attributes-relationships-lifecycle-content-source-content-personal-data-locators-secrets-or-credentials" as const,
    authorityBoundary: "data-model-projection-does-not-approve-a-data-model-or-classification-appoint-ownership-grant-migration-authority-establish-operational-readiness-or-authorize-action" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function authorizationModelProjection(): AuthorizationModelProjection {
  const status = {
    schemaVersion: 1 as const,
    kind: "authorization-model-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    model: {
      recordId: "a4a4a4a4-a4a4-44a4-84a4-a4a4a4a4a4a4",
      revision: 2,
      digest: `sha256:${"9".repeat(64)}` as const,
    },
    principalCount: 5,
    roleAssignmentCount: 6,
    resourceCount: 7,
    actionCount: 8,
    approvalBindingCount: 3,
    ruleCount: 9,
    uncoveredOperatingRoleCount: 1,
    uncoveredProcessCount: 2,
    uncoveredDataEntityCount: 3,
    unresolvedIdentityCount: 4,
    unresolvedRuleCount: 5,
    unresolvedRequirementCount: 6,
    inconsistencyCount: 1,
    unresolvedQuestionCount: 2,
    staleBindingCount: 1,
    staleSourceReferenceCount: 0,
    state: "attention-required" as const,
    reasons: ["One or more Authorization Rules remain unresolved"],
    assessedAt: "2026-07-26T13:30:00.000Z",
    authorityBoundary: "authorization-model-status-reports-candidate-coverage-and-gaps-and-does-not-verify-identity-approve-role-assignments-or-standing-authority-create-an-authorization-grant-enforce-policy-establish-operational-readiness-or-authorize-action" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "authorization-model-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: {
      id: initiative.id,
      revision: initiative.revision ?? 1,
      digest: canonicalDigest(initiative),
      state: initiative.state,
    },
    status,
    model: {
      id: status.model.recordId,
      revision: status.model.revision,
      digest: status.model.digest,
      membershipDigest: `sha256:${"a".repeat(64)}` as const,
      state: "candidate" as const,
      principalCount: 5,
      actionCount: 8,
      ruleCount: 9,
      updatedAt: "2026-07-26T13:29:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-principal-identifiers-role-assignments-rules-conditions-approval-content-source-content-personal-data-locators-secrets-or-credentials" as const,
    authorityBoundary: "authorization-model-projection-does-not-verify-identity-approve-role-assignments-or-standing-authority-create-an-authorization-grant-enforce-policy-establish-operational-readiness-or-authorize-action" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function eventIntegrationModelProjection(): EventIntegrationModelProjection {
  const status = {
    schemaVersion: 1 as const,
    kind: "event-integration-model-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    model: {
      recordId: "b4b4b4b4-b4b4-44b4-84b4-b4b4b4b4b4b4",
      revision: 2,
      digest: `sha256:${"b".repeat(64)}` as const,
    },
    eventTypeCount: 10,
    commandCount: 11,
    adapterCount: 4,
    externalContractCount: 5,
    mappingCount: 6,
    routeCount: 7,
    uncoveredProcessEventCount: 1,
    uncoveredProcessCount: 2,
    uncoveredBoundedContextCount: 3,
    uncoveredDataEntityCount: 4,
    uncoveredAuthorizationActionCount: 5,
    unknownMappingTruthCount: 6,
    unresolvedRequirementCount: 7,
    inconsistencyCount: 1,
    unresolvedQuestionCount: 2,
    staleBindingCount: 1,
    staleSourceReferenceCount: 0,
    state: "attention-required" as const,
    reasons: ["One or more integration mappings remain unresolved"],
    assessedAt: "2026-07-26T14:00:00.000Z",
    authorityBoundary: "event-integration-model-status-reports-candidate-coverage-and-gaps-and-does-not-prove-event-occurrence-send-or-deliver-a-command-accept-an-external-contract-activate-an-adapter-create-an-authorization-grant-execute-an-effect-establish-operational-readiness-or-authorize-action" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "event-integration-model-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: {
      id: initiative.id,
      revision: initiative.revision ?? 1,
      digest: canonicalDigest(initiative),
      state: initiative.state,
    },
    status,
    model: {
      id: status.model.recordId,
      revision: status.model.revision,
      digest: status.model.digest,
      membershipDigest: `sha256:${"c".repeat(64)}` as const,
      state: "candidate" as const,
      eventTypeCount: 10,
      commandCount: 11,
      adapterCount: 4,
      externalContractCount: 5,
      mappingCount: 6,
      routeCount: 7,
      updatedAt: "2026-07-26T13:59:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-event-payloads-command-inputs-mapping-content-external-locators-source-content-personal-data-secrets-or-credentials" as const,
    authorityBoundary: "event-integration-model-projection-does-not-prove-event-occurrence-send-or-deliver-a-command-accept-an-external-contract-activate-an-adapter-create-an-authorization-grant-execute-an-effect-establish-operational-readiness-or-authorize-action" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function failureRecoveryModelProjection(): FailureRecoveryModelProjection {
  const status = {
    schemaVersion: 1 as const,
    kind: "failure-recovery-model-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    model: {
      recordId: "c5c5c5c5-c5c5-45c5-85c5-c5c5c5c5c5c5",
      revision: 2,
      digest: `sha256:${"d".repeat(64)}` as const,
    },
    failureModeCount: 8,
    retryPolicyCount: 6,
    compensationPlanCount: 5,
    recoveryPlanCount: 4,
    recoveryEvidenceDefinitionCount: 3,
    uncoveredProcessCount: 1,
    uncoveredCommandCount: 2,
    uncoveredRouteCount: 3,
    uncoveredAuthorizationActionCount: 4,
    unresolvedRecoveryEvidenceCount: 5,
    unresolvedRequirementCount: 6,
    inconsistencyCount: 1,
    unresolvedQuestionCount: 2,
    staleBindingCount: 1,
    staleSourceReferenceCount: 0,
    state: "attention-required" as const,
    reasons: ["One or more recovery evidence definitions remain unresolved"],
    assessedAt: "2026-07-26T15:00:00.000Z",
    authorityBoundary: "failure-recovery-model-status-reports-candidate-coverage-and-gaps-and-does-not-prove-failure-occurrence-retry-safety-compensation-or-restoration-recovery-success-return-to-service-operational-readiness-or-authorize-action" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "failure-recovery-model-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: {
      id: initiative.id,
      revision: initiative.revision ?? 1,
      digest: canonicalDigest(initiative),
      state: initiative.state,
    },
    status,
    model: {
      id: status.model.recordId,
      revision: status.model.revision,
      digest: status.model.digest,
      membershipDigest: `sha256:${"e".repeat(64)}` as const,
      state: "candidate" as const,
      failureModeCount: 8,
      retryPolicyCount: 6,
      compensationPlanCount: 5,
      recoveryPlanCount: 4,
      recoveryEvidenceDefinitionCount: 3,
      updatedAt: "2026-07-26T14:59:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-failure-evidence-operational-telemetry-retry-keys-compensation-content-recovery-steps-source-content-personal-data-secrets-or-credentials" as const,
    authorityBoundary: "failure-recovery-model-projection-does-not-prove-failure-occurrence-retry-safety-compensation-or-restoration-recovery-success-return-to-service-operational-readiness-or-authorize-action" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function architectureChallengeModelProjection(): ArchitectureChallengeModelProjection {
  const status = {
    schemaVersion: 1 as const,
    kind: "architecture-challenge-model-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    model: {
      recordId: "d6d6d6d6-d6d6-46d6-86d6-d6d6d6d6d6d6",
      revision: 2,
      digest: `sha256:${"d".repeat(64)}` as const,
    },
    challengeSubjectCount: 3,
    assumptionCount: 4,
    alternativeCount: 5,
    findingCount: 6,
    responseCount: 2,
    unrespondedFindingCount: 4,
    unresolvedAssumptionCount: 2,
    unresolvedRequirementCount: 1,
    inconsistencyCount: 0,
    unresolvedQuestionCount: 1,
    staleBindingCount: 1,
    staleSourceReferenceCount: 0,
    state: "attention-required" as const,
    reasons: ["One or more Challenge Findings lack an attributable candidate response"],
    assessedAt: "2026-07-26T16:00:00.000Z",
    authorityBoundary: "architecture-challenge-status-reports-candidate-coverage-and-gaps-and-does-not-establish-independence-assurance-risk-acceptance-architecture-approval-operational-readiness-or-authorize-action" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "architecture-challenge-model-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: {
      id: initiative.id,
      revision: initiative.revision ?? 1,
      digest: canonicalDigest(initiative),
      state: initiative.state,
    },
    status,
    model: {
      id: status.model.recordId,
      revision: status.model.revision,
      digest: status.model.digest,
      membershipDigest: `sha256:${"e".repeat(64)}` as const,
      state: "candidate" as const,
      challengeSubjectCount: 3,
      assumptionCount: 4,
      alternativeCount: 5,
      findingCount: 6,
      responseCount: 2,
      updatedAt: "2026-07-26T15:59:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-challenge-content-assumptions-evidence-findings-responses-source-content-personal-data-secrets-or-credentials" as const,
    authorityBoundary: "architecture-challenge-projection-does-not-establish-independence-assurance-risk-acceptance-architecture-approval-operational-readiness-or-authorize-action" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function decisionRegisterProjection(): DecisionRegisterProjection {
  const status = {
    schemaVersion: 1 as const,
    kind: "decision-register-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    register: {
      recordId: "e7e7e7e7-e7e7-47e7-87e7-e7e7e7e7e7e7",
      revision: 2,
      digest: `sha256:${"d".repeat(64)}` as const,
    },
    decisionCount: 7,
    unresolvedDecisionCount: 2,
    selectedPendingDecisionCount: 3,
    deferredDecisionCount: 1,
    unresolvedRequirementCount: 1,
    staleBindingCount: 1,
    staleSourceReferenceCount: 0,
    inconsistencyCount: 0,
    unresolvedQuestionCount: 1,
    state: "attention-required" as const,
    reasons: ["One or more Decision Questions remain unresolved"],
    assessedAt: "2026-07-26T17:00:00.000Z",
    authorityBoundary: "decision-register-status-reports-candidate-coverage-and-gaps-and-does-not-establish-decision-effectiveness-approval-risk-acceptance-baseline-promotion-readiness-or-action-authority" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "decision-register-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: {
      id: initiative.id,
      revision: initiative.revision ?? 1,
      digest: canonicalDigest(initiative),
      state: initiative.state,
    },
    status,
    register: {
      id: status.register.recordId,
      revision: status.register.revision,
      digest: status.register.digest,
      membershipDigest: `sha256:${"e".repeat(64)}` as const,
      state: "candidate" as const,
      decisionCount: 7,
      updatedAt: "2026-07-26T16:59:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-decision-questions-options-recommendations-outcomes-rationale-evidence-subject-content-personal-data-secrets-or-credentials" as const,
    authorityBoundary: "decision-register-projection-does-not-establish-decision-effectiveness-approval-risk-acceptance-baseline-promotion-readiness-or-action-authority" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function riskRegisterProjection(): RiskRegisterProjection {
  const status = {
    schemaVersion: 1 as const,
    kind: "risk-register-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    register: {
      recordId: "f8f8f8f8-f8f8-48f8-88f8-f8f8f8f8f8f8",
      revision: 3,
      digest: `sha256:${"f".repeat(64)}` as const,
    },
    riskCount: 9,
    notAssessedRiskCount: 2,
    unresolvedResidualRiskCount: 3,
    proposedTreatmentCount: 9,
    unassignedOwnerCount: 9,
    unverifiedControlCount: 4,
    unresolvedRequirementCount: 1,
    staleBindingCount: 1,
    staleSourceReferenceCount: 0,
    inconsistencyCount: 0,
    unresolvedQuestionCount: 1,
    state: "attention-required" as const,
    reasons: ["One or more Risk Assessments remain explicitly not assessed"],
    assessedAt: "2026-07-26T18:00:00.000Z",
    authorityBoundary: "risk-register-status-reports-candidate-coverage-and-gaps-and-does-not-establish-assessment-fact-control-effectiveness-risk-acceptance-approval-exception-baseline-promotion-readiness-or-action-authority" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "risk-register-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: {
      id: initiative.id,
      revision: initiative.revision ?? 1,
      digest: canonicalDigest(initiative),
      state: initiative.state,
    },
    status,
    register: {
      id: status.register.recordId,
      revision: status.register.revision,
      digest: status.register.digest,
      membershipDigest: `sha256:${"9".repeat(64)}` as const,
      state: "candidate" as const,
      riskCount: 9,
      updatedAt: "2026-07-26T17:59:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-risk-statements-assessments-controls-treatments-residual-risk-evidence-related-record-content-personal-data-secrets-or-credentials" as const,
    authorityBoundary: "risk-register-projection-does-not-establish-assessment-fact-control-effectiveness-risk-acceptance-approval-exception-baseline-promotion-readiness-or-action-authority" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function evidenceRegistryProjection(): EvidenceRegistryProjection {
  const status = {
    schemaVersion: 1 as const,
    kind: "evidence-registry-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    registry: {
      recordId: "fafafafa-fafa-4afa-8afa-fafafafafafa",
      revision: 4,
      digest: `sha256:${"a".repeat(64)}` as const,
    },
    claimCount: 12,
    evidenceItemCount: 18,
    linkCount: 21,
    notAssessedClaimCount: 2,
    notAssessedEvidenceCount: 3,
    adverseEvidencePendingDispositionCount: 1,
    staleOrUnknownEvidenceCount: 4,
    invalidatedEvidenceCount: 1,
    unresolvedLinkCount: 21,
    unresolvedRequirementCount: 2,
    staleBindingCount: 1,
    staleSourceReferenceCount: 0,
    inconsistencyCount: 0,
    unresolvedQuestionCount: 1,
    state: "attention-required" as const,
    reasons: ["One or more Claims remain explicitly not assessed"],
    assessedAt: "2026-07-27T00:00:00.000Z",
    authorityBoundary: "evidence-registry-status-reports-candidate-coverage-freshness-and-gaps-and-does-not-establish-claim-validation-evidence-sufficiency-assurance-approval-readiness-or-action-authority" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "evidence-registry-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: {
      id: initiative.id,
      revision: initiative.revision ?? 1,
      digest: canonicalDigest(initiative),
      state: initiative.state,
    },
    status,
    registry: {
      id: status.registry.recordId,
      revision: status.registry.revision,
      digest: status.registry.digest,
      membershipDigest: `sha256:${"b".repeat(64)}` as const,
      state: "candidate" as const,
      claimCount: 12,
      evidenceItemCount: 18,
      linkCount: 21,
      updatedAt: "2026-07-26T23:59:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-claim-statements-evidence-observations-methods-warrants-quality-details-source-content-personal-data-secrets-or-credentials" as const,
    authorityBoundary: "evidence-registry-projection-does-not-establish-claim-validation-evidence-sufficiency-assurance-review-approval-risk-acceptance-readiness-or-action-authority" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function endToEndTraceabilityProjection(): EndToEndTraceabilityProjection {
  const status = {
    schemaVersion: 1 as const,
    kind: "end-to-end-traceability-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    traceability: {
      recordId: "abababab-abab-4bab-8bab-abababababab",
      revision: 3,
      digest: `sha256:${"c".repeat(64)}` as const,
    },
    nodeCount: 44,
    relationshipCount: 12,
    linkCount: 67,
    transformationCount: 5,
    verifiedLinkCount: 40,
    proposedLinkCount: 20,
    invalidOrHistoricalLinkCount: 7,
    unresolvedEndpointCount: 2,
    notAssessedSemanticCount: 6,
    missingSpineCount: 1,
    unknownRelationshipCount: 3,
    unresolvedRequirementCount: 2,
    staleBindingCount: 1,
    staleSourceReferenceCount: 0,
    inconsistencyCount: 1,
    unresolvedQuestionCount: 2,
    state: "attention-required" as const,
    reasons: ["One or more Trace Links have unresolved endpoints"],
    assessedAt: "2026-07-27T02:30:00.000Z",
    coverageBoundary: "absence-of-a-trace-link-does-not-prove-absence-of-impact-or-relationship" as const,
    authorityBoundary: "end-to-end-traceability-status-reports-candidate-coverage-and-gaps-and-does-not-establish-relationship-truth-completeness-approval-readiness-or-action-authority" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "end-to-end-traceability-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: {
      id: initiative.id,
      revision: initiative.revision ?? 1,
      digest: canonicalDigest(initiative),
      state: initiative.state,
    },
    status,
    traceability: {
      id: status.traceability.recordId,
      revision: status.traceability.revision,
      digest: status.traceability.digest,
      membershipDigest: `sha256:${"d".repeat(64)}` as const,
      state: "candidate" as const,
      nodeCount: 44,
      relationshipCount: 12,
      linkCount: 67,
      transformationCount: 5,
      updatedAt: "2026-07-27T02:29:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-node-content-link-rationale-transformation-detail-source-content-personal-data-secrets-or-credentials" as const,
    authorityBoundary: "end-to-end-traceability-projection-does-not-establish-relationship-truth-completeness-approval-baseline-promotion-readiness-or-action-authority" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function p0P4ReadinessGateProjection(): P0P4ReadinessGateProjection {
  const status = {
    schemaVersion: 1 as const,
    kind: "p0-p4-readiness-gate-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    gate: {
      recordId: "bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc",
      revision: 2,
      digest: `sha256:${"e".repeat(64)}` as const,
    },
    outputCount: 25,
    applicableOutputCount: 20,
    notApplicableOutputCount: 4,
    unresolvedApplicabilityCount: 1,
    satisfiedOutputCount: 17,
    conditionalOutputCount: 1,
    incompleteOutputCount: 1,
    failedOutputCount: 1,
    blockedOutputCount: 0,
    staleOrUnknownOutputCount: 1,
    pendingOrInvalidWaiverCount: 1,
    unresolvedDecisionCount: 2,
    unmetConditionCount: 1,
    unresolvedRequirementCount: 2,
    adverseEvidenceCount: 1,
    staleBindingCount: 1,
    staleSourceReferenceCount: 0,
    inconsistencyCount: 0,
    unresolvedQuestionCount: 1,
    result: "failed" as const,
    reasons: ["The exact Evidence Registry contains adverse evidence"],
    assessedAt: "2026-07-27T03:30:00.000Z",
    gateBoundary: "a-passing-gate-is-an-evaluation-result-not-permission" as const,
    authorityBoundary: "p0-p4-readiness-gate-status-is-an-evaluation-result-and-does-not-establish-readiness-approval-waiver-acceptance-phase-entry-implementation-authorization-baseline-promotion-or-action-authority" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "p0-p4-readiness-gate-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: {
      id: initiative.id,
      revision: initiative.revision ?? 1,
      digest: canonicalDigest(initiative),
      state: initiative.state,
    },
    status,
    gate: {
      id: status.gate.recordId,
      revision: status.gate.revision,
      digest: status.gate.digest,
      membershipDigest: `sha256:${"f".repeat(64)}` as const,
      state: "candidate" as const,
      evaluationDefinitionDigest: `sha256:${"a".repeat(64)}` as const,
      outputCount: 25,
      waiverCount: 1,
      unresolvedDecisionCount: 2,
      conditionCount: 1,
      updatedAt: "2026-07-27T03:29:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-results-and-digests-only-not-output-content-criteria-findings-waiver-rationale-decision-content-evidence-content-source-content-personal-data-secrets-or-credentials" as const,
    authorityBoundary: "p0-p4-readiness-gate-projection-does-not-establish-readiness-approval-waiver-acceptance-phase-entry-implementation-authorization-baseline-promotion-or-action-authority" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function p5HandoffPackageProjection(): P5HandoffPackageProjection {
  const status = {
    schemaVersion: 1 as const,
    kind: "p5-handoff-package-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    handoff: {
      recordId: "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd",
      revision: 3,
      digest: `sha256:${"1".repeat(64)}` as const,
    },
    itemCount: 25,
    includedItemCount: 17,
    referenceOnlyItemCount: 3,
    omittedNotApplicableItemCount: 4,
    unresolvedItemCount: 1,
    staleOrUnknownItemCount: 2,
    lossyTransformationCount: 1,
    unresolvedRequirementCount: 2,
    conflictCount: 1,
    unresolvedQuestionCount: 2,
    staleBindingCount: 1,
    staleSourceReferenceCount: 0,
    readinessResult: "incomplete" as const,
    transferState: "held" as const,
    state: "attention-required" as const,
    reasons: ["The current P0-P4 Readiness Gate evaluation has not passed"],
    assessedAt: "2026-07-27T04:00:00.000Z",
    handoffBoundary: "handoff-transfers-exact-candidate-context-not-source-ownership-or-authority" as const,
    authorityBoundary: "p5-handoff-package-status-does-not-establish-acknowledgement-readiness-approval-design-baseline-p5-entry-transfer-or-action-authority" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "p5-handoff-package-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: {
      id: initiative.id,
      revision: initiative.revision ?? 1,
      digest: canonicalDigest(initiative),
      state: initiative.state,
    },
    status,
    handoff: {
      id: status.handoff.recordId,
      revision: status.handoff.revision,
      digest: status.handoff.digest,
      membershipDigest: `sha256:${"2".repeat(64)}` as const,
      state: "candidate" as const,
      readinessStatusDigest: `sha256:${"3".repeat(64)}` as const,
      itemCount: 25,
      requirementCount: 66,
      deliveryMode: "disconnected" as const,
      updatedAt: "2026-07-27T03:59:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-item-content-summaries-omissions-uncertainties-source-content-personal-data-secrets-credentials-or-destinations" as const,
    authorityBoundary: "p5-handoff-package-projection-does-not-establish-acknowledgement-readiness-approval-design-baseline-p5-entry-transfer-write-or-action-authority" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function designApplicabilityProjection(): DesignApplicabilityProjection {
  const status = {
    schemaVersion: 1 as const,
    kind: "design-applicability-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    candidate: {
      recordId: "cececece-cece-4ece-8ece-cececececece",
      revision: 2,
      digest: `sha256:${"4".repeat(64)}` as const,
    },
    scopeCount: 2,
    decisionCount: 8,
    unresolvedDecisionCount: 1,
    blockedDecisionCount: 0,
    pendingApprovalCount: 1,
    rejectedApprovalCount: 0,
    unresolvedDepthCount: 1,
    unresolvedSourceCount: 1,
    staleBindingCount: 0,
    staleSourceReferenceCount: 1,
    unresolvedQuestionCount: 2,
    reviewState: "held" as const,
    state: "attention-required" as const,
    reasons: ["One or more target scopes remain unresolved"],
    assessedAt: "2026-07-28T04:00:00.000Z",
    authorityBoundary: "design-applicability-status-is-observational-and-does-not-approve-design-establish-a-baseline-grant-readiness-or-authorize-implementation-or-action" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "design-applicability-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: {
      id: initiative.id,
      revision: initiative.revision ?? 1,
      digest: canonicalDigest(initiative),
      state: initiative.state,
    },
    status,
    candidate: {
      id: status.candidate.recordId,
      revision: status.candidate.revision,
      digest: status.candidate.digest,
      membershipDigest: `sha256:${"5".repeat(64)}` as const,
      state: "candidate" as const,
      scopeCount: 2,
      reviewState: "held" as const,
      updatedAt: "2026-07-28T03:59:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-rationales-source-content-journeys-design-content-personal-data-secrets-or-credentials" as const,
    authorityBoundary: "design-applicability-projection-is-read-only-and-does-not-approve-design-establish-a-baseline-grant-readiness-or-authorize-write-implementation-or-action" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function designPersonaRoleProjection(): DesignPersonaRoleModelProjection {
  const status = {
    schemaVersion: 1 as const,
    kind: "design-persona-role-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    candidate: {
      recordId: "dededede-dede-4ede-8ede-dededededede",
      revision: 2,
      digest: `sha256:${"6".repeat(64)}` as const,
    },
    personaCount: 2,
    designRoleCount: 1,
    representedParticipantCategoryCount: 4,
    unresolvedParticipantCategoryCount: 1,
    representedRoleKindCount: 1,
    unresolvedRoleKindCount: 1,
    weakEvidencePersonaCount: 1,
    humanReviewedPersonaCount: 1,
    staleBindingCount: 0,
    staleSourceReferenceCount: 1,
    unresolvedQuestionCount: 2,
    reviewState: "held" as const,
    state: "attention-required" as const,
    reasons: ["One or more design participant categories remain unresolved"],
    assessedAt: "2026-07-28T08:30:00.000Z",
    authorityBoundary: "design-persona-role-status-is-observational-and-does-not-validate-personas-appoint-roles-verify-competence-approve-design-grant-readiness-or-authorize-action" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "design-persona-role-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: {
      id: initiative.id,
      revision: initiative.revision ?? 1,
      digest: canonicalDigest(initiative),
      state: initiative.state,
    },
    status,
    candidate: {
      id: status.candidate.recordId,
      revision: status.candidate.revision,
      digest: status.candidate.digest,
      membershipDigest: `sha256:${"7".repeat(64)}` as const,
      state: "candidate" as const,
      personaCount: 2,
      designRoleCount: 1,
      reviewState: "held" as const,
      updatedAt: "2026-07-28T08:29:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-record-identities-counts-statuses-and-digests-only-not-persona-content-behaviors-constraints-source-content-personal-data-secrets-or-credentials" as const,
    authorityBoundary: "design-persona-role-projection-is-read-only-and-does-not-validate-personas-appoint-roles-verify-competence-approve-design-grant-readiness-or-authorize-write-or-action" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function userJourneyProjection(): UserJourneyModelProjection {
  const status = {
    schemaVersion: 1 as const,
    kind: "user-journey-model-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    candidate: { recordId: "efefefef-efef-4fef-8fef-efefefefefef", revision: 2, digest: `sha256:${"8".repeat(64)}` as const },
    journeyCount: 2,
    touchpointCount: 3,
    primaryPathCount: 2,
    successPathCount: 2,
    failurePathCount: 2,
    recoveryPathCount: 2,
    representedScopeCount: 1,
    unresolvedScopeCount: 1,
    weakEvidencePathCount: 2,
    staleBindingCount: 0,
    staleSourceReferenceCount: 1,
    unresolvedQuestionCount: 2,
    reviewState: "held" as const,
    state: "attention-required" as const,
    reasons: ["One or more Design Applicability scopes have unresolved User Journey coverage"],
    assessedAt: "2026-07-28T09:30:00.000Z",
    authorityBoundary: "user-journey-model-status-is-observational-and-does-not-prove-observed-behavior-validate-journeys-approve-design-grant-readiness-or-authorize-action" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "user-journey-model-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: { id: initiative.id, revision: initiative.revision ?? 1, digest: canonicalDigest(initiative), state: initiative.state },
    status,
    candidate: {
      id: status.candidate.recordId,
      revision: status.candidate.revision,
      digest: status.candidate.digest,
      membershipDigest: `sha256:${"9".repeat(64)}` as const,
      state: "candidate" as const,
      journeyCount: 2,
      touchpointCount: 3,
      reviewState: "held" as const,
      updatedAt: "2026-07-28T09:29:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-record-identities-counts-statuses-and-digests-only-not-journey-step-touchpoint-persona-source-or-personal-content-secrets-or-credentials" as const,
    authorityBoundary: "user-journey-model-projection-is-read-only-and-does-not-prove-observed-behavior-validate-journeys-approve-design-grant-readiness-or-authorize-write-or-action" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function informationArchitectureProjection(): InformationArchitectureModelProjection {
  const status = {
    schemaVersion: 1 as const,
    kind: "information-architecture-model-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    candidate: { recordId: "f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f1f1", revision: 2, digest: `sha256:${"a".repeat(64)}` as const },
    nodeCount: 6,
    rootNodeCount: 2,
    routeCount: 8,
    representedScopeCount: 1,
    unresolvedScopeCount: 1,
    weakEvidenceNodeCount: 2,
    weakEvidenceRouteCount: 1,
    staleBindingCount: 0,
    staleSourceReferenceCount: 1,
    unresolvedQuestionCount: 2,
    reviewState: "held" as const,
    state: "attention-required" as const,
    reasons: ["One or more Design Applicability scopes have unresolved Information Architecture coverage"],
    assessedAt: "2026-07-28T10:30:00.000Z",
    authorityBoundary: "information-architecture-status-is-observational-and-does-not-prove-findability-comprehension-or-accessibility-validate-content-approve-design-grant-readiness-or-authorize-action" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "information-architecture-model-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: { id: initiative.id, revision: initiative.revision ?? 1, digest: canonicalDigest(initiative), state: initiative.state },
    status,
    candidate: {
      id: status.candidate.recordId,
      revision: status.candidate.revision,
      digest: status.candidate.digest,
      membershipDigest: `sha256:${"b".repeat(64)}` as const,
      state: "candidate" as const,
      nodeCount: 6,
      rootNodeCount: 2,
      routeCount: 8,
      reviewState: "held" as const,
      updatedAt: "2026-07-28T10:29:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-record-identities-counts-statuses-and-digests-only-not-node-route-content-persona-source-or-personal-content-secrets-or-credentials" as const,
    authorityBoundary: "information-architecture-projection-is-read-only-and-does-not-prove-findability-comprehension-or-accessibility-validate-content-approve-design-grant-readiness-or-authorize-write-or-action" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function screenStateInventoryProjection(): ScreenStateInventoryProjection {
  const status = {
    schemaVersion: 1 as const,
    kind: "screen-state-inventory-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    candidate: { recordId: "f2f2f2f2-f2f2-42f2-82f2-f2f2f2f2f2f2", revision: 2, digest: `sha256:${"c".repeat(64)}` as const },
    platformCount: 3,
    targetedPlatformCount: 2,
    unresolvedPlatformCount: 1,
    screenCount: 9,
    stateCount: 18,
    variantCount: 5,
    representedRouteCount: 7,
    unresolvedRouteCount: 1,
    representedScopeCount: 1,
    unresolvedScopeCount: 1,
    weakEvidenceItemCount: 2,
    staleBindingCount: 0,
    staleSourceReferenceCount: 1,
    unresolvedQuestionCount: 2,
    reviewState: "held" as const,
    state: "attention-required" as const,
    reasons: ["One or more Information Architecture routes have unresolved Screen and State Inventory coverage"],
    assessedAt: "2026-07-28T11:30:00.000Z",
    authorityBoundary: "screen-state-inventory-status-is-observational-and-does-not-prove-ui-completeness-platform-parity-state-reachability-interaction-quality-or-accessibility-approve-design-grant-readiness-or-authorize-action" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "screen-state-inventory-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: { id: initiative.id, revision: initiative.revision ?? 1, digest: canonicalDigest(initiative), state: initiative.state },
    status,
    candidate: {
      id: status.candidate.recordId,
      revision: status.candidate.revision,
      digest: status.candidate.digest,
      membershipDigest: `sha256:${"d".repeat(64)}` as const,
      state: "candidate" as const,
      platformCount: 3,
      screenCount: 9,
      stateCount: 18,
      variantCount: 5,
      reviewState: "held" as const,
      updatedAt: "2026-07-28T11:29:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-record-identities-counts-statuses-and-digests-only-not-screen-state-variant-platform-content-persona-source-or-personal-content-secrets-or-credentials" as const,
    authorityBoundary: "screen-state-inventory-projection-is-read-only-and-does-not-prove-ui-completeness-platform-parity-state-reachability-interaction-quality-or-accessibility-approve-design-grant-readiness-or-authorize-write-or-action" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function designRequirementsProjection(): DesignRequirementsProjection {
  const status = {
    schemaVersion: 1 as const,
    kind: "design-requirements-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    candidate: { recordId: "f3f3f3f3-f3f3-43f3-83f3-f3f3f3f3f3f3", revision: 2, digest: `sha256:${"e".repeat(64)}` as const },
    requirementCount: 12,
    mustPriorityCount: 5,
    representedOutcomeCount: 4,
    unresolvedOutcomeCount: 1,
    linkedBacklogRequirementCount: 8,
    notPlannedRequirementCount: 2,
    unresolvedBacklogRequirementCount: 2,
    workItemCount: 10,
    weakEvidenceRequirementCount: 3,
    staleBindingCount: 0,
    staleDomainReferenceCount: 1,
    staleSourceReferenceCount: 1,
    unresolvedQuestionCount: 2,
    catalogCompletenessState: "not-assessed" as const,
    reviewState: "held" as const,
    state: "attention-required" as const,
    reasons: ["One or more Design Requirements retain unresolved outcome or backlog coverage"],
    assessedAt: "2026-07-28T12:30:00.000Z",
    authorityBoundary: "design-requirements-status-is-observational-and-does-not-establish-requirement-validity-completeness-priority-approval-satisfaction-backlog-commitment-design-approval-readiness-implementation-or-action-authority" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "design-requirements-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: { id: initiative.id, revision: initiative.revision ?? 1, digest: canonicalDigest(initiative), state: initiative.state },
    status,
    candidate: {
      id: status.candidate.recordId,
      revision: status.candidate.revision,
      digest: status.candidate.digest,
      membershipDigest: `sha256:${"f".repeat(64)}` as const,
      state: "candidate" as const,
      requirementCount: 12,
      representedOutcomeCount: 4,
      workItemCount: 10,
      reviewState: "held" as const,
      updatedAt: "2026-07-28T12:29:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-record-identities-counts-statuses-and-digests-only-not-requirement-outcome-work-item-design-target-source-or-personal-content-secrets-or-credentials" as const,
    authorityBoundary: "design-requirements-projection-is-read-only-and-does-not-establish-requirement-validity-completeness-priority-approval-satisfaction-backlog-commitment-design-approval-readiness-implementation-or-write-or-action-authority" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function designSystemTokenContractProjection(): DesignSystemTokenContractProjection {
  const status = {
    schemaVersion: 1 as const,
    kind: "design-system-token-contract-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    candidate: { recordId: "a4a4a4a4-a4a4-44a4-84a4-a4a4a4a4a4a4", revision: 2, digest: `sha256:${"1".repeat(64)}` as const },
    designSystemCount: 2,
    tokenCount: 48,
    variableCollectionCount: 3,
    variableCount: 19,
    componentCount: 12,
    representedRequirementCount: 10,
    unresolvedRequirementCount: 2,
    unresolvedOwnershipCount: 1,
    unresolvedCatalogItemCount: 3,
    accessibilityReviewGapCount: 4,
    staleBindingCount: 0,
    stalePortableSnapshotCount: 1,
    staleSourceReferenceCount: 2,
    unresolvedQuestionCount: 2,
    catalogCompletenessState: "not-assessed" as const,
    reviewState: "held" as const,
    state: "attention-required" as const,
    reasons: ["One or more Design Systems, Tokens, Variables, or Components remain unresolved"],
    assessedAt: "2026-07-28T13:30:00.000Z",
    authorityBoundary: "design-system-token-contract-status-is-observational-and-does-not-establish-design-system-token-variable-or-component-validity-ownership-authority-accessibility-design-approval-baseline-readiness-implementation-or-action-authority" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "design-system-token-contract-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: { id: initiative.id, revision: initiative.revision ?? 1, digest: canonicalDigest(initiative), state: initiative.state },
    status,
    candidate: {
      id: status.candidate.recordId,
      revision: status.candidate.revision,
      digest: status.candidate.digest,
      membershipDigest: `sha256:${"2".repeat(64)}` as const,
      state: "candidate" as const,
      designSystemCount: 2,
      tokenCount: 48,
      variableCollectionCount: 3,
      variableCount: 19,
      componentCount: 12,
      representedRequirementCount: 10,
      reviewState: "held" as const,
      updatedAt: "2026-07-28T13:29:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-record-identities-counts-statuses-and-digests-only-not-token-values-component-content-requirement-source-design-or-personal-content-secrets-or-credentials" as const,
    authorityBoundary: "design-system-token-contract-projection-is-read-only-and-does-not-establish-design-system-token-variable-or-component-validity-ownership-authority-accessibility-design-approval-baseline-readiness-implementation-write-or-action-authority" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function accessibilityDesignRulesProjection(): AccessibilityDesignRulesProjection {
  const status = {
    schemaVersion: 1 as const,
    kind: "accessibility-design-rules-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    candidate: { recordId: "b5b5b5b5-b5b5-45b5-85b5-b5b5b5b5b5b5", revision: 2, digest: `sha256:${"3".repeat(64)}` as const },
    targetCount: 12,
    ruleCount: 18,
    checkCount: 24,
    applicableRuleCount: 14,
    notApplicableRuleCount: 2,
    unresolvedRuleCount: 2,
    notAssessedCheckCount: 4,
    evidenceRecordedCheckCount: 3,
    humanReviewedCheckCount: 17,
    contradictedCheckCount: 1,
    representedRequirementCount: 10,
    unresolvedRequirementCount: 2,
    unresolvedOwnershipCount: 1,
    staleBindingCount: 0,
    staleSourceReferenceCount: 2,
    unresolvedQuestionCount: 3,
    catalogCompletenessState: "not-assessed" as const,
    reviewState: "held" as const,
    state: "attention-required" as const,
    reasons: ["One or more accessibility rules retain unresolved applicability or impact"],
    assessedAt: "2026-07-28T14:30:00.000Z",
    authorityBoundary: "accessibility-design-rules-status-is-observational-and-does-not-establish-accessibility-conformance-rule-or-check-validity-legal-compliance-ownership-design-approval-baseline-readiness-implementation-or-action-authority" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "accessibility-design-rules-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: { id: initiative.id, revision: initiative.revision ?? 1, digest: canonicalDigest(initiative), state: initiative.state },
    status,
    candidate: {
      id: status.candidate.recordId,
      revision: status.candidate.revision,
      digest: status.candidate.digest,
      membershipDigest: `sha256:${"4".repeat(64)}` as const,
      state: "candidate" as const,
      targetCount: 12,
      ruleCount: 18,
      checkCount: 24,
      representedRequirementCount: 10,
      reviewState: "held" as const,
      updatedAt: "2026-07-28T14:29:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-record-identities-counts-statuses-and-digests-only-not-rule-procedures-evidence-requirement-source-design-or-personal-content-secrets-or-credentials" as const,
    authorityBoundary: "accessibility-design-rules-projection-is-read-only-and-does-not-establish-accessibility-conformance-rule-or-check-validity-legal-compliance-ownership-design-approval-baseline-readiness-implementation-write-or-action-authority" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function responsiveMultiPlatformTargetsProjection(): ResponsiveMultiPlatformTargetsProjection {
  const status = {
    schemaVersion: 1 as const,
    kind: "responsive-multi-platform-targets-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    candidate: { recordId: "c6c6c6c6-c6c6-46c6-86c6-c6c6c6c6c6c6", revision: 2, digest: `sha256:${"5".repeat(64)}` as const },
    platformTargetCount: 3,
    breakpointCount: 7,
    behaviorCount: 16,
    checkCount: 22,
    applicableBehaviorCount: 13,
    unresolvedBehaviorCount: 3,
    notAssessedCheckCount: 4,
    evidenceRecordedCheckCount: 2,
    humanReviewedCheckCount: 16,
    contradictedCheckCount: 1,
    representedRequirementCount: 10,
    unresolvedRequirementCount: 2,
    unresolvedOwnershipCount: 1,
    staleBindingCount: 0,
    staleSourceReferenceCount: 2,
    unresolvedQuestionCount: 3,
    targetCatalogState: "candidate-complete" as const,
    breakpointCatalogState: "candidate-complete" as const,
    behaviorCatalogState: "not-assessed" as const,
    reviewState: "held" as const,
    state: "attention-required" as const,
    reasons: ["One or more responsive platform behaviors retain unresolved applicability"],
    assessedAt: "2026-07-28T15:30:00.000Z",
    authorityBoundary: "responsive-multi-platform-targets-status-is-observational-and-does-not-establish-responsive-completeness-platform-parity-breakpoint-or-behavior-validity-accessibility-conformance-ownership-design-approval-baseline-readiness-implementation-or-action-authority" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "responsive-multi-platform-targets-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: { id: initiative.id, revision: initiative.revision ?? 1, digest: canonicalDigest(initiative), state: initiative.state },
    status,
    candidate: {
      id: status.candidate.recordId,
      revision: status.candidate.revision,
      digest: status.candidate.digest,
      membershipDigest: `sha256:${"6".repeat(64)}` as const,
      state: "candidate" as const,
      platformTargetCount: 3,
      breakpointCount: 7,
      behaviorCount: 16,
      checkCount: 22,
      representedRequirementCount: 10,
      reviewState: "held" as const,
      updatedAt: "2026-07-28T15:29:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-record-identities-counts-statuses-and-digests-only-not-breakpoint-rules-behavior-procedures-evidence-requirement-source-design-or-personal-content-secrets-or-credentials" as const,
    authorityBoundary: "responsive-multi-platform-targets-projection-is-read-only-and-does-not-establish-responsive-completeness-platform-parity-breakpoint-or-behavior-validity-accessibility-conformance-ownership-design-approval-baseline-readiness-implementation-write-or-action-authority" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function manualFigmaExecutionPathProjection(): ManualFigmaExecutionPathProjection {
  const status = {
    schemaVersion: 1 as const,
    kind: "manual-figma-execution-path-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    candidate: { recordId: "d7d7d7d7-d7d7-47d7-87d7-d7d7d7d7d7d7", revision: 2, digest: `sha256:${"7".repeat(64)}` as const },
    scopeCount: 3,
    instructionCount: 5,
    checkCount: 24,
    notAssessedCheckCount: 4,
    evidenceRecordedCheckCount: 2,
    humanReviewedCheckCount: 18,
    contradictedCheckCount: 1,
    representedRequirementCount: 10,
    unresolvedRequirementCount: 2,
    unresolvedOwnershipCount: 1,
    staleBindingCount: 0,
    staleSourceReferenceCount: 2,
    unresolvedQuestionCount: 3,
    guideCatalogState: "candidate-complete" as const,
    handoffCatalogState: "candidate-complete" as const,
    returnContractState: "not-assessed" as const,
    reviewState: "held" as const,
    state: "attention-required" as const,
    reasons: ["The manual return contract is not marked candidate-complete"],
    assessedAt: "2026-07-28T18:30:00.000Z",
    authorityBoundary: "manual-figma-execution-path-status-is-observational-and-does-not-connect-to-figma-prove-execution-or-return-completeness-grant-write-authority-approve-design-establish-a-baseline-readiness-implementation-or-action-authority" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "manual-figma-execution-path-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: { id: initiative.id, revision: initiative.revision ?? 1, digest: canonicalDigest(initiative), state: initiative.state },
    status,
    candidate: {
      id: status.candidate.recordId,
      revision: status.candidate.revision,
      digest: status.candidate.digest,
      membershipDigest: `sha256:${"8".repeat(64)}` as const,
      state: "candidate" as const,
      scopeCount: 3,
      instructionCount: 5,
      checkCount: 24,
      representedRequirementCount: 10,
      reviewState: "held" as const,
      updatedAt: "2026-07-28T18:29:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-record-identities-counts-statuses-and-digests-only-not-handoff-content-instructions-figma-identifiers-returned-design-source-or-personal-content-secrets-or-credentials" as const,
    authorityBoundary: "manual-figma-execution-path-projection-is-read-only-and-does-not-connect-to-figma-prove-execution-or-return-completeness-grant-write-authority-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function figmaMcpCapabilityDiscoveryProjection(): FigmaMcpCapabilityDiscoveryProjection {
  const status = {
    schemaVersion: 1 as const,
    kind: "figma-mcp-capability-discovery-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    candidate: { recordId: "e8e8e8e8-e8e8-48e8-88e8-e8e8e8e8e8e8", revision: 2, digest: `sha256:${"8".repeat(64)}` as const },
    toolCount: 7,
    advertisedToolCount: 5,
    unavailableToolCount: 1,
    unknownAvailabilityCount: 1,
    readToolCount: 3,
    writeToolCount: 2,
    unknownEffectCount: 1,
    notAssessedToolCount: 1,
    sourceRecordedToolCount: 2,
    humanReviewedToolCount: 4,
    unresolvedPermissionCount: 2,
    unresolvedLimitCount: 1,
    unresolvedVersionCount: 3,
    unresolvedOwnershipCount: 1,
    staleBindingCount: 0,
    staleSourceReferenceCount: 2,
    unresolvedQuestionCount: 3,
    catalogState: "candidate-observation-complete" as const,
    permissionModelState: "candidate-separated" as const,
    limitCatalogState: "not-assessed" as const,
    versionCatalogState: "not-assessed" as const,
    reviewState: "held" as const,
    state: "attention-required" as const,
    reasons: ["One or more source-recorded candidate observations require human review"],
    assessedAt: "2026-07-28T19:30:00.000Z",
    authorityBoundary: "figma-mcp-capability-discovery-status-is-observational-and-does-not-connect-to-or-call-figma-request-credentials-grant-permissions-establish-tool-availability-or-compatibility-authorize-write-approve-design-establish-a-baseline-readiness-implementation-or-action-authority" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "figma-mcp-capability-discovery-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: { id: initiative.id, revision: initiative.revision ?? 1, digest: canonicalDigest(initiative), state: initiative.state },
    status,
    candidate: {
      id: status.candidate.recordId,
      revision: status.candidate.revision,
      digest: status.candidate.digest,
      membershipDigest: `sha256:${"9".repeat(64)}` as const,
      state: "candidate" as const,
      toolCount: status.toolCount,
      advertisedToolCount: status.advertisedToolCount,
      readToolCount: status.readToolCount,
      writeToolCount: status.writeToolCount,
      reviewState: status.reviewState,
      updatedAt: "2026-07-28T19:29:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-record-identities-counts-statuses-and-digests-only-not-tool-names-schemas-permissions-limits-versions-source-content-personal-content-secrets-credentials-or-figma-content" as const,
    authorityBoundary: "figma-mcp-capability-discovery-projection-is-read-only-and-does-not-connect-to-or-call-figma-request-credentials-grant-permissions-establish-tool-availability-or-compatibility-authorize-write-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function figmaReadSnapshotProjection(): FigmaReadSnapshotProjection {
  const status = {
    schemaVersion: 1 as const,
    kind: "figma-read-snapshot-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    candidate: { recordId: "f8f8f8f8-f8f8-48f8-88f8-f8f8f8f8f8f8", revision: 2, digest: `sha256:${"a".repeat(64)}` as const },
    fileCount: 2,
    componentCount: 12,
    variableCollectionCount: 3,
    variableCount: 18,
    sourceRecordedItemCount: 5,
    humanReviewedItemCount: 25,
    notAssessedItemCount: 5,
    staleFileCount: 1,
    unknownFreshnessFileCount: 1,
    unresolvedTypeCount: 2,
    unresolvedOwnershipCount: 1,
    staleBindingCount: 0,
    staleSourceReferenceCount: 2,
    unresolvedQuestionCount: 3,
    snapshotCompletenessState: "partial" as const,
    provenanceState: "partial" as const,
    reviewState: "held" as const,
    state: "attention-required" as const,
    reasons: ["One or more source-recorded snapshot observations require human review"],
    assessedAt: "2026-07-28T20:30:00.000Z",
    authorityBoundary: "figma-read-snapshot-status-is-observational-and-does-not-connect-to-or-call-figma-request-credentials-grant-permissions-prove-external-completeness-authorize-write-validate-or-approve-design-establish-a-baseline-readiness-implementation-or-action-authority" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "figma-read-snapshot-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: { id: initiative.id, revision: initiative.revision ?? 1, digest: canonicalDigest(initiative), state: initiative.state },
    status,
    candidate: {
      id: status.candidate.recordId,
      revision: status.candidate.revision,
      digest: status.candidate.digest,
      membershipDigest: `sha256:${"b".repeat(64)}` as const,
      state: "candidate" as const,
      fileCount: status.fileCount,
      componentCount: status.componentCount,
      variableCollectionCount: status.variableCollectionCount,
      variableCount: status.variableCount,
      reviewState: status.reviewState,
      updatedAt: "2026-07-28T20:29:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-record-identities-counts-statuses-and-digests-only-not-figma-file-component-variable-names-external-identities-values-source-content-personal-content-secrets-credentials-or-permissions" as const,
    authorityBoundary: "figma-read-snapshot-projection-is-read-only-and-does-not-connect-to-or-call-figma-request-credentials-grant-permissions-prove-external-completeness-authorize-write-validate-or-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function figmaContextImportProjection(): FigmaContextImportProjection {
  const status = {
    schemaVersion: 1 as const,
    kind: "figma-context-import-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    candidate: { recordId: "fafafafa-fafa-4afa-8afa-fafafafafafa", revision: 2, digest: `sha256:${"c".repeat(64)}` as const },
    contextPackCount: 2,
    sectionCount: 8,
    contextItemCount: 24,
    targetCount: 2,
    humanReviewedSectionCount: 5,
    sourceRecordedSectionCount: 2,
    notAssessedSectionCount: 1,
    unresolvedRedactionCount: 1,
    representedRequirementCount: 7,
    unresolvedRequirementCount: 2,
    unresolvedOwnershipCount: 1,
    staleBindingCount: 0,
    staleSourceReferenceCount: 2,
    unresolvedQuestionCount: 3,
    contextSelectionState: "partial" as const,
    provenanceState: "partial" as const,
    previewState: "candidate-generated" as const,
    reviewState: "held" as const,
    state: "attention-required" as const,
    reasons: ["One or more selected sections require human review"],
    assessedAt: "2026-07-29T09:30:00.000Z",
    authorityBoundary: "figma-context-import-status-is-observational-and-does-not-package-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-or-action-authority" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "figma-context-import-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: { id: initiative.id, revision: initiative.revision ?? 1, digest: canonicalDigest(initiative), state: initiative.state },
    status,
    candidate: {
      id: status.candidate.recordId,
      revision: status.candidate.revision,
      digest: status.candidate.digest,
      membershipDigest: `sha256:${"d".repeat(64)}` as const,
      state: "candidate" as const,
      contextPackCount: status.contextPackCount,
      sectionCount: status.sectionCount,
      contextItemCount: status.contextItemCount,
      targetCount: status.targetCount,
      representedRequirementCount: status.representedRequirementCount,
      reviewState: status.reviewState,
      updatedAt: "2026-07-29T09:29:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-record-identities-counts-statuses-and-digests-only-not-brief-requirement-constraint-context-item-figma-target-tool-source-or-personal-content-secrets-credentials-or-permissions" as const,
    authorityBoundary: "figma-context-import-projection-is-read-only-and-does-not-package-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function outboundDesignBriefPackageProjection(): OutboundDesignBriefPackageProjection {
  const status = {
    schemaVersion: 1 as const,
    kind: "outbound-design-brief-package-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    candidate: { recordId: "abababab-abab-4bab-8bab-abababababab", revision: 2, digest: `sha256:${"e".repeat(64)}` as const },
    contextPackCount: 2,
    entryCount: 8,
    contextItemCount: 24,
    recipientCount: 2,
    humanReviewedEntryCount: 5,
    sourceRecordedEntryCount: 2,
    notAssessedEntryCount: 1,
    unresolvedRedactionCount: 1,
    representedRequirementCount: 7,
    unresolvedRequirementCount: 2,
    unresolvedDisclosureCount: 3,
    staleBindingCount: 0,
    staleSourceReferenceCount: 2,
    unresolvedQuestionCount: 3,
    manifestState: "partial" as const,
    provenanceState: "partial" as const,
    redactionReviewState: "partial" as const,
    previewState: "candidate-generated" as const,
    reviewState: "held" as const,
    state: "attention-required" as const,
    reasons: ["One or more outbound package entries require human review"],
    assessedAt: "2026-07-29T10:30:00.000Z",
    authorityBoundary: "outbound-design-brief-package-status-is-observational-and-does-not-materialize-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-or-action-authority" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "outbound-design-brief-package-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: { id: initiative.id, revision: initiative.revision ?? 1, digest: canonicalDigest(initiative), state: initiative.state },
    status,
    candidate: {
      id: status.candidate.recordId,
      revision: status.candidate.revision,
      digest: status.candidate.digest,
      membershipDigest: `sha256:${"f".repeat(64)}` as const,
      state: "candidate" as const,
      manifestFormat: "gaep-outbound-design-brief-package-v1" as const,
      manifestDigest: `sha256:${"a".repeat(64)}` as const,
      payloadDigest: `sha256:${"b".repeat(64)}` as const,
      contextPackCount: status.contextPackCount,
      entryCount: status.entryCount,
      contextItemCount: status.contextItemCount,
      recipientCount: status.recipientCount,
      representedRequirementCount: status.representedRequirementCount,
      unresolvedDisclosureCount: status.unresolvedDisclosureCount,
      reviewState: status.reviewState,
      updatedAt: "2026-07-29T10:29:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-record-identities-counts-statuses-and-digests-only-not-brief-requirement-constraint-context-item-figma-target-tool-source-transformation-disclosure-or-personal-content-secrets-credentials-or-permissions" as const,
    authorityBoundary: "outbound-design-brief-package-projection-is-read-only-and-does-not-materialize-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function governedFigmaWriteProjection(): GovernedFigmaWriteProjection {
  const status = {
    schemaVersion: 1 as const,
    kind: "governed-figma-write-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    candidate: { recordId: "bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc", revision: 2, digest: `sha256:${"1".repeat(64)}` as const },
    selectedEntryCount: 8,
    unresolvedDisclosureCount: 2,
    staleBindingCount: 1,
    staleSourceReferenceCount: 2,
    unresolvedQuestionCount: 3,
    previewState: "candidate-generated" as const,
    approvalState: "pending" as const,
    permissionEvidenceState: "missing" as const,
    idempotencyState: "defined" as const,
    replayProtectionState: "defined" as const,
    recoveryPlanState: "defined" as const,
    writePlanState: "held" as const,
    reviewState: "held" as const,
    writeExecutionState: "not-performed" as const,
    writeResultState: "not-recorded" as const,
    state: "attention-required" as const,
    reasons: ["Exact permission evidence is missing"],
    assessedAt: "2026-07-29T14:00:00.000Z",
    authorityBoundary: "governed-figma-write-status-is-observational-and-does-not-materialize-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-or-action-authority" as const,
  }
  const outboundPackage = {
    recordId: "abababab-abab-4bab-8bab-abababababab",
    revision: 2,
    digest: `sha256:${"2".repeat(64)}` as const,
    membershipDigest: `sha256:${"3".repeat(64)}` as const,
    manifestDigest: `sha256:${"4".repeat(64)}` as const,
    payloadDigest: `sha256:${"5".repeat(64)}` as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "governed-figma-write-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: { id: initiative.id, revision: initiative.revision ?? 1, digest: canonicalDigest(initiative), state: initiative.state },
    status,
    candidate: {
      id: status.candidate.recordId,
      revision: status.candidate.revision,
      digest: status.candidate.digest,
      membershipDigest: `sha256:${"6".repeat(64)}` as const,
      state: "candidate" as const,
      requestFormat: "gaep-governed-figma-write-request-v1" as const,
      requestDigest: `sha256:${"7".repeat(64)}` as const,
      effectDigest: `sha256:${"8".repeat(64)}` as const,
      outboundPackage,
      externalFileIdentityDigest: `sha256:${"9".repeat(64)}` as const,
      expectedExternalVersionDigest: `sha256:${"a".repeat(64)}` as const,
      selectedEntryCount: status.selectedEntryCount,
      previewState: status.previewState,
      previewDigest: `sha256:${"b".repeat(64)}` as const,
      approvalState: status.approvalState,
      permissionEvidenceState: status.permissionEvidenceState,
      idempotencyState: status.idempotencyState,
      recoveryPlanState: status.recoveryPlanState,
      reviewState: status.reviewState,
      writeExecutionState: status.writeExecutionState,
      updatedAt: "2026-07-29T13:59:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-record-identities-counts-statuses-and-digests-only-not-brief-requirement-constraint-context-item-figma-target-tool-source-approval-actor-permission-evidence-recovery-or-personal-content-secrets-or-credentials" as const,
    authorityBoundary: "governed-figma-write-projection-is-read-only-and-does-not-materialize-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function finalizedFigmaSnapshotImportProjection(): FinalizedFigmaSnapshotImportProjection {
  const status = {
    schemaVersion: 1 as const,
    kind: "finalized-figma-snapshot-import-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    candidate: { recordId: "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd", revision: 2, digest: `sha256:${"c".repeat(64)}` as const },
    itemCount: 18,
    humanReviewedItemCount: 12,
    sourceRecordedItemCount: 4,
    notAssessedItemCount: 2,
    openConflictCount: 3,
    staleBindingCount: 1,
    staleSourceReferenceCount: 2,
    unresolvedQuestionCount: 5,
    returnAuthorizationState: "missing" as const,
    reconciliationState: "partial" as const,
    provenanceState: "partial" as const,
    snapshotCompletenessState: "partial" as const,
    reviewState: "held" as const,
    importExecutionState: "not-performed" as const,
    importResultState: "not-recorded" as const,
    state: "attention-required" as const,
    reasons: ["Exact return authorization is missing"],
    assessedAt: "2026-07-29T15:30:00.000Z",
    authorityBoundary: "finalized-figma-snapshot-import-status-is-observational-and-does-not-transfer-or-import-content-connect-to-or-call-figma-request-credentials-grant-permissions-prove-external-completeness-validate-or-approve-design-establish-a-baseline-readiness-implementation-or-action-authority" as const,
  }
  const governedWrite = {
    recordId: "bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc",
    revision: 2,
    digest: `sha256:${"1".repeat(64)}` as const,
    membershipDigest: `sha256:${"2".repeat(64)}` as const,
    requestDigest: `sha256:${"3".repeat(64)}` as const,
    effectDigest: `sha256:${"4".repeat(64)}` as const,
    externalFileIdentityDigest: `sha256:${"5".repeat(64)}` as const,
    expectedExternalVersionDigest: `sha256:${"6".repeat(64)}` as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "finalized-figma-snapshot-import-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: { id: initiative.id, revision: initiative.revision ?? 1, digest: canonicalDigest(initiative), state: initiative.state },
    status,
    candidate: {
      id: status.candidate.recordId,
      revision: status.candidate.revision,
      digest: status.candidate.digest,
      membershipDigest: `sha256:${"7".repeat(64)}` as const,
      state: "candidate" as const,
      governedWrite,
      externalFileIdentityDigest: governedWrite.externalFileIdentityDigest,
      returnedExternalVersionDigest: `sha256:${"8".repeat(64)}` as const,
      payloadDigest: `sha256:${"9".repeat(64)}` as const,
      receiptDigest: `sha256:${"a".repeat(64)}` as const,
      reconciliationDigest: `sha256:${"b".repeat(64)}` as const,
      itemCount: status.itemCount,
      conflictCount: 4,
      returnAuthorizationState: status.returnAuthorizationState,
      reconciliationState: status.reconciliationState,
      provenanceState: status.provenanceState,
      reviewState: status.reviewState,
      importExecutionState: status.importExecutionState,
      updatedAt: "2026-07-29T15:29:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-record-identities-counts-statuses-and-digests-only-not-figma-content-names-external-identities-source-content-authorization-actor-personal-content-secrets-credentials-or-permissions" as const,
    authorityBoundary: "finalized-figma-snapshot-import-projection-is-read-only-and-does-not-transfer-or-import-content-connect-to-or-call-figma-request-credentials-grant-permissions-prove-external-completeness-validate-or-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function designToRequirementBindingProjection(): DesignToRequirementBindingProjection {
  const status = {
    schemaVersion: 1 as const,
    kind: "design-to-requirement-binding-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    candidate: { recordId: "dededede-dede-4ede-8ede-dededededede", revision: 2, digest: `sha256:${"d".repeat(64)}` as const },
    bindingCount: 7,
    humanReviewedBindingCount: 5,
    designItemCount: 4,
    boundDesignItemCount: 3,
    unboundDesignItemCount: 1,
    requirementCount: 3,
    boundRequirementCount: 2,
    unboundRequirementCount: 1,
    decisionCount: 2,
    boundDecisionCount: 1,
    unboundDecisionCount: 1,
    openConflictCount: 2,
    staleBindingCount: 1,
    staleSourceReferenceCount: 2,
    unresolvedQuestionCount: 3,
    reconciliationState: "partial" as const,
    candidateCoverageState: "partial" as const,
    provenanceState: "exact" as const,
    reviewState: "held" as const,
    state: "attention-required" as const,
    reasons: ["One or more governed subjects remain unbound"],
    assessedAt: "2026-07-29T16:30:00.000Z",
    authorityBoundary: "design-to-requirement-binding-status-is-observational-and-does-not-establish-relationship-truth-coverage-completeness-requirement-satisfaction-decision-effectiveness-external-completeness-design-validity-or-approval-baseline-readiness-implementation-write-import-or-action-authority" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "design-to-requirement-binding-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: { id: initiative.id, revision: initiative.revision ?? 1, digest: canonicalDigest(initiative), state: initiative.state },
    status,
    candidate: {
      id: status.candidate.recordId,
      revision: status.candidate.revision,
      digest: status.candidate.digest,
      membershipDigest: `sha256:${"e".repeat(64)}` as const,
      state: "candidate" as const,
      finalizedSnapshot: {
        recordId: "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd",
        revision: 2,
        digest: `sha256:${"1".repeat(64)}` as const,
        membershipDigest: `sha256:${"2".repeat(64)}` as const,
        itemCatalogDigest: `sha256:${"3".repeat(64)}` as const,
      },
      designRequirements: {
        recordId: "abababab-abab-4bab-8bab-abababababab",
        revision: 3,
        digest: `sha256:${"4".repeat(64)}` as const,
        membershipDigest: `sha256:${"5".repeat(64)}` as const,
        requirementCatalogDigest: `sha256:${"6".repeat(64)}` as const,
      },
      decisionRegister: {
        recordId: "bcbcbcbc-bcbc-4cbc-8cbc-bcbcbcbcbcbc",
        revision: 4,
        digest: `sha256:${"7".repeat(64)}` as const,
        membershipDigest: `sha256:${"8".repeat(64)}` as const,
        decisionCatalogDigest: `sha256:${"9".repeat(64)}` as const,
      },
      reconciliationDigest: `sha256:${"a".repeat(64)}` as const,
      bindingCount: status.bindingCount,
      designItemCoverageCount: status.designItemCount,
      subjectCoverageCount: status.requirementCount + status.decisionCount,
      conflictCount: 3,
      reconciliationState: status.reconciliationState,
      candidateCoverageState: status.candidateCoverageState,
      provenanceState: status.provenanceState,
      reviewState: status.reviewState,
      updatedAt: "2026-07-29T16:29:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-record-identities-counts-statuses-and-digests-only-not-figma-content-external-identities-requirement-text-decision-content-source-content-human-attribution-personal-content-secrets-credentials-or-permissions" as const,
    authorityBoundary: "design-to-requirement-binding-projection-is-read-only-and-does-not-establish-relationship-truth-coverage-completeness-requirement-satisfaction-decision-effectiveness-external-completeness-design-validity-or-approval-baseline-readiness-implementation-write-import-or-action-authority" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function designerReadyGateProjection(): DesignerReadyGateProjection {
  const status = {
    schemaVersion: 1 as const,
    kind: "designer-ready-gate-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    candidate: { recordId: "efefefef-efef-4fef-8fef-efefefefefef", revision: 2, digest: `sha256:${"1".repeat(64)}` as const },
    prerequisiteCount: 12,
    satisfiedCount: 9,
    notApplicableCount: 1,
    unsatisfiedCount: 1,
    notAssessedCount: 1,
    staleOrUnknownCount: 2,
    humanReviewedCount: 10,
    pendingExceptionCount: 1,
    grantedExceptionCandidateCount: 1,
    invalidExceptionCount: 1,
    staleBindingCount: 2,
    staleSourceReferenceCount: 3,
    unresolvedQuestionCount: 4,
    candidateResult: "incomplete" as const,
    reviewState: "held" as const,
    state: "attention-required" as const,
    reasons: ["One or more prerequisites remain incomplete"],
    assessedAt: "2026-07-29T22:25:00.000Z",
    gateBoundary: "a-passing-designer-ready-gate-candidate-is-an-evaluation-result-not-permission-or-readiness" as const,
    authorityBoundary: "designer-ready-gate-status-is-observational-and-does-not-establish-design-completeness-external-completeness-design-validity-approval-baseline-readiness-exception-waiver-acceptance-phase-entry-implementation-write-import-or-action-authority" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "designer-ready-gate-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: { id: initiative.id, revision: initiative.revision ?? 1, digest: canonicalDigest(initiative), state: initiative.state },
    status,
    candidate: {
      id: status.candidate.recordId,
      revision: status.candidate.revision,
      digest: status.candidate.digest,
      membershipDigest: `sha256:${"2".repeat(64)}` as const,
      state: "candidate" as const,
      prerequisiteCount: 12 as const,
      prerequisiteCatalogDigest: `sha256:${"3".repeat(64)}` as const,
      evaluationCatalogDigest: `sha256:${"4".repeat(64)}` as const,
      exceptionCatalogDigest: `sha256:${"5".repeat(64)}` as const,
      assessmentDefinitionDigest: `sha256:${"6".repeat(64)}` as const,
      assessmentReceiptDigest: `sha256:${"7".repeat(64)}` as const,
      candidateResult: status.candidateResult,
      reviewState: status.reviewState,
      updatedAt: "2026-07-29T22:24:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-record-identities-counts-results-and-digests-only-not-design-content-criteria-findings-exception-rationale-decision-content-source-content-human-attribution-personal-content-secrets-credentials-or-permissions" as const,
    authorityBoundary: "designer-ready-gate-projection-is-read-only-and-does-not-establish-design-completeness-external-completeness-design-validity-approval-baseline-readiness-exception-waiver-acceptance-phase-entry-implementation-write-import-or-action-authority" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function designDeltaProjection(): DesignDeltaProjection {
  const status = {
    schemaVersion: 1 as const,
    kind: "design-delta-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    candidate: { recordId: "81818181-8181-4181-8181-818181818181", revision: 2, digest: `sha256:${"1".repeat(64)}` as const },
    sourceItemCount: 12,
    targetItemCount: 14,
    deltaCount: 6,
    addedCount: 2,
    changedCount: 1,
    conflictingCount: 1,
    missingCount: 1,
    staleCount: 1,
    unmappedCount: 0,
    humanReviewedCount: 3,
    staleBindingCount: 1,
    staleSourceReferenceCount: 2,
    unresolvedMappingCount: 2,
    unresolvedQuestionCount: 3,
    comparisonState: "partial" as const,
    provenanceState: "partial" as const,
    candidateResult: "conflict-candidate" as const,
    reviewState: "held" as const,
    state: "attention-required" as const,
    reasons: ["The candidate contains an unresolved conflicting delta"],
    assessedAt: "2026-07-29T23:12:00.000Z",
    authorityBoundary: "design-delta-status-is-observational-and-does-not-establish-delta-completeness-external-completeness-design-validity-approval-baseline-readiness-conflict-resolution-synchronization-implementation-write-import-or-action-authority" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "design-delta-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: { id: initiative.id, revision: initiative.revision ?? 1, digest: canonicalDigest(initiative), state: initiative.state },
    status,
    candidate: {
      id: status.candidate.recordId,
      revision: status.candidate.revision,
      digest: status.candidate.digest,
      membershipDigest: `sha256:${"2".repeat(64)}` as const,
      state: "candidate" as const,
      designerReadyGate: {
        recordId: "efefefef-efef-4fef-8fef-efefefefefef", revision: 2,
        digest: `sha256:${"3".repeat(64)}` as const, membershipDigest: `sha256:${"4".repeat(64)}` as const,
        prerequisiteCatalogDigest: `sha256:${"5".repeat(64)}` as const,
        assessmentReceiptDigest: `sha256:${"6".repeat(64)}` as const,
        candidateResult: "incomplete" as const,
      },
      finalizedSnapshot: {
        recordId: "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd", revision: 2,
        digest: `sha256:${"7".repeat(64)}` as const, membershipDigest: `sha256:${"8".repeat(64)}` as const,
        itemCatalogDigest: `sha256:${"9".repeat(64)}` as const,
        reconciliationDigest: `sha256:${"a".repeat(64)}` as const,
        reviewState: "held" as const,
      },
      designBinding: {
        recordId: "dededede-dede-4ede-8ede-dededededede", revision: 2,
        digest: `sha256:${"b".repeat(64)}` as const, membershipDigest: `sha256:${"c".repeat(64)}` as const,
        bindingCatalogDigest: `sha256:${"d".repeat(64)}` as const,
        reconciliationDigest: `sha256:${"e".repeat(64)}` as const,
        reviewState: "held" as const,
      },
      sourceSnapshotDigest: `sha256:${"f".repeat(64)}` as const,
      targetSnapshotDigest: `sha256:${"0".repeat(64)}` as const,
      comparisonDefinitionDigest: `sha256:${"1".repeat(64)}` as const,
      comparisonReceiptDigest: `sha256:${"2".repeat(64)}` as const,
      deltaCatalogDigest: `sha256:${"3".repeat(64)}` as const,
      deltaCount: status.deltaCount,
      comparisonState: status.comparisonState,
      provenanceState: status.provenanceState,
      candidateResult: status.candidateResult,
      reviewState: status.reviewState,
      updatedAt: "2026-07-29T23:11:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-record-identities-counts-results-and-digests-only-not-design-content-delta-content-external-identities-evidence-content-source-content-human-attribution-personal-content-secrets-credentials-or-permissions" as const,
    authorityBoundary: "design-delta-projection-is-read-only-and-does-not-establish-delta-completeness-external-completeness-design-validity-approval-baseline-readiness-conflict-resolution-synchronization-implementation-write-import-or-action-authority" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function designConflictResolutionProjection(): DesignConflictResolutionProjection {
  const status = {
    schemaVersion: 1 as const,
    kind: "design-conflict-resolution-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    candidate: { recordId: "82828282-8282-4282-8282-828282828282", revision: 2, digest: `sha256:${"4".repeat(64)}` as const },
    conflictCount: 5,
    resolutionCount: 4,
    acceptSourceCount: 1,
    acceptTargetCount: 1,
    mergeCount: 1,
    rejectChangeCount: 0,
    escalateCount: 1,
    humanReviewedCount: 3,
    distinctActorDeclaredCount: 2,
    expiredCandidateCount: 1,
    unresolvedConflictCount: 1,
    unresolvedQuestionCount: 2,
    staleBindingCount: 1,
    staleSourceReferenceCount: 2,
    coverageState: "partial" as const,
    provenanceState: "partial" as const,
    candidateResult: "escalation-plan-candidate" as const,
    reviewState: "held" as const,
    state: "attention-required" as const,
    reasons: ["The candidate records unresolved design conflicts"],
    assessedAt: "2026-07-30T00:10:00.000Z",
    authorityBoundary: "design-conflict-resolution-status-is-observational-and-does-not-enforce-separation-of-duties-resolve-conflicts-synchronize-design-establish-validity-approval-baseline-readiness-or-grant-implementation-write-import-or-action-authority" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "design-conflict-resolution-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: { id: initiative.id, revision: initiative.revision ?? 1, digest: canonicalDigest(initiative), state: initiative.state },
    status,
    candidate: {
      id: status.candidate.recordId,
      revision: status.candidate.revision,
      digest: status.candidate.digest,
      membershipDigest: `sha256:${"5".repeat(64)}` as const,
      state: "candidate" as const,
      designDelta: {
        recordId: "81818181-8181-4181-8181-818181818181",
        revision: 2,
        digest: `sha256:${"1".repeat(64)}` as const,
        membershipDigest: `sha256:${"2".repeat(64)}` as const,
        deltaCatalogDigest: `sha256:${"3".repeat(64)}` as const,
        comparisonReceiptDigest: `sha256:${"4".repeat(64)}` as const,
        conflictingCount: 5,
        candidateResult: "conflict-candidate" as const,
        reviewState: "ready-for-human-review" as const,
      },
      resolutionDefinitionDigest: `sha256:${"6".repeat(64)}` as const,
      resolutionReceiptDigest: `sha256:${"7".repeat(64)}` as const,
      resolutionCatalogDigest: `sha256:${"8".repeat(64)}` as const,
      conflictCount: status.conflictCount,
      resolutionCount: status.resolutionCount,
      coverageState: status.coverageState,
      provenanceState: status.provenanceState,
      candidateResult: status.candidateResult,
      reviewState: status.reviewState,
      updatedAt: "2026-07-30T00:09:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-record-identities-counts-results-and-digests-only-not-design-content-delta-content-resolution-content-evidence-content-source-content-human-attribution-personal-content-secrets-credentials-or-permissions" as const,
    authorityBoundary: "design-conflict-resolution-projection-is-read-only-and-does-not-enforce-separation-of-duties-resolve-conflicts-synchronize-design-establish-validity-approval-baseline-readiness-or-grant-implementation-write-import-or-action-authority" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function humanDesignApprovalProjection(): HumanDesignApprovalProjection {
  const status = {
    schemaVersion: 1 as const,
    kind: "human-design-approval-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    candidate: { recordId: "83838383-8383-4383-8383-838383838383", revision: 2, digest: `sha256:${"4".repeat(64)}` as const },
    prerequisiteCount: 5,
    completePrerequisiteCount: 4,
    decisionCount: 1,
    approveCount: 1,
    rejectCount: 0,
    requestChangeCount: 0,
    abstainCount: 0,
    expiredDecisionCount: 1,
    revokedDecisionCount: 0,
    staleBindingCount: 1,
    staleSourceReferenceCount: 2,
    unresolvedQuestionCount: 3,
    candidateResult: "approved-candidate" as const,
    reviewState: "recorded-human-decision" as const,
    approverAuthorityState: "not-established" as const,
    separationOfDutiesEnforcementState: "not-established" as const,
    state: "attention-required" as const,
    reasons: ["The recorded human design decision candidate is expired"],
    assessedAt: "2026-07-30T00:55:00.000Z",
    authorityBoundary: "human-design-approval-status-is-observational-and-does-not-verify-approver-authority-enforce-separation-of-duties-establish-design-approval-baseline-readiness-phase-entry-or-grant-implementation-write-import-or-action-authority" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "human-design-approval-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: { id: initiative.id, revision: initiative.revision ?? 1, digest: canonicalDigest(initiative), state: initiative.state },
    status,
    candidate: {
      id: status.candidate.recordId,
      revision: status.candidate.revision,
      digest: status.candidate.digest,
      membershipDigest: `sha256:${"5".repeat(64)}` as const,
      state: "candidate" as const,
      prerequisiteCatalogDigest: `sha256:${"6".repeat(64)}` as const,
      subject: {
        kind: "finalized-figma-snapshot-import-candidate" as const,
        recordId: "71717171-7171-4171-8171-717171717171",
        revision: 2,
        digest: `sha256:${"7".repeat(64)}` as const,
        membershipDigest: `sha256:${"8".repeat(64)}` as const,
        externalFileIdentityDigest: `sha256:${"9".repeat(64)}` as const,
        returnedExternalVersionDigest: `sha256:${"a".repeat(64)}` as const,
        itemCatalogDigest: `sha256:${"b".repeat(64)}` as const,
        itemCount: 18,
      },
      scopeDigest: `sha256:${"c".repeat(64)}` as const,
      decisionDefinitionDigest: `sha256:${"d".repeat(64)}` as const,
      decisionReceiptDigest: `sha256:${"e".repeat(64)}` as const,
      decisionKind: "approve-candidate" as const,
      decisionDigest: `sha256:${"f".repeat(64)}` as const,
      decisionLifecycleState: "active-candidate" as const,
      candidateResult: status.candidateResult,
      reviewState: status.reviewState,
      updatedAt: "2026-07-30T00:54:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-record-identities-counts-results-and-digests-only-not-design-content-decision-rationale-condition-evidence-source-content-human-attribution-personal-content-secrets-credentials-or-permissions" as const,
    authorityBoundary: "human-design-approval-projection-is-read-only-and-does-not-verify-approver-authority-enforce-separation-of-duties-establish-design-approval-baseline-readiness-phase-entry-or-grant-implementation-write-import-or-action-authority" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function designBaselineProjection(): DesignBaselineProjection {
  const approval = humanDesignApprovalProjection()
  const approved = approval.candidate!
  const status = {
    schemaVersion: 1 as const,
    kind: "design-baseline-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    candidate: { recordId: "84848484-8484-4484-8484-848484848484", revision: 3, digest: `sha256:${"1".repeat(64)}` as const },
    candidateSetCount: 1,
    designationCandidateCount: 1,
    supersessionCandidateCount: 1,
    withdrawalCandidateCount: 0,
    restorationCandidateCount: 0,
    expiredDesignationCount: 1,
    staleBindingCount: 2,
    staleSourceReferenceCount: 3,
    unresolvedQuestionCount: 4,
    candidateResult: "supersession-candidate" as const,
    reviewState: "ready-for-human-review" as const,
    approvalDeterminationState: "not-established" as const,
    baselineDesignationState: "not-established" as const,
    state: "attention-required" as const,
    reasons: ["The baseline designation candidate is expired"],
    assessedAt: "2026-07-30T01:40:00.000Z",
    authorityBoundary: "design-baseline-status-is-observational-and-does-not-convert-an-approval-candidate-into-approval-verify-approver-authority-enforce-separation-of-duties-establish-a-baseline-readiness-phase-entry-or-grant-implementation-write-import-or-action-authority" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "design-baseline-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: { id: initiative.id, revision: initiative.revision ?? 1, digest: canonicalDigest(initiative), state: initiative.state },
    status,
    candidate: {
      id: status.candidate.recordId,
      revision: status.candidate.revision,
      digest: status.candidate.digest,
      membershipDigest: `sha256:${"2".repeat(64)}` as const,
      state: "candidate" as const,
      humanDesignApproval: {
        kind: "human-design-approval-candidate" as const,
        recordId: approved.id,
        revision: approved.revision,
        digest: approved.digest,
        membershipDigest: approved.membershipDigest,
        decisionReceiptDigest: approved.decisionReceiptDigest,
        subjectDigest: approved.subject.digest,
        scopeDigest: approved.scopeDigest,
        candidateResult: "approved-candidate" as const,
        reviewState: "recorded-human-decision" as const,
        assessmentDigest: `sha256:${"3".repeat(64)}` as const,
        assessmentState: "complete-for-recorded-decision" as const,
      },
      subject: approved.subject,
      scopeDigest: approved.scopeDigest,
      baselineLineageId: "85858585-8585-4585-8585-858585858585",
      candidateSetId: "86868686-8686-4686-8686-868686868686",
      candidateSetRevision: 3,
      semanticVersion: "2.0.0",
      versionPolicyDigest: `sha256:${"4".repeat(64)}` as const,
      designationDefinitionDigest: `sha256:${"5".repeat(64)}` as const,
      designationReceiptDigest: `sha256:${"6".repeat(64)}` as const,
      designationKind: "supersede-baseline-candidate" as const,
      designationDigest: `sha256:${"7".repeat(64)}` as const,
      supersedes: {
        recordId: status.candidate.recordId,
        revision: 2,
        digest: `sha256:${"8".repeat(64)}` as const,
        membershipDigest: `sha256:${"9".repeat(64)}` as const,
        baselineLineageId: "85858585-8585-4585-8585-858585858585",
        semanticVersion: "1.0.0",
      },
      candidateResult: status.candidateResult,
      reviewState: status.reviewState,
      updatedAt: "2026-07-30T01:39:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-record-identities-version-axes-counts-results-and-digests-only-not-design-content-rationale-evidence-source-content-human-attribution-personal-content-secrets-credentials-or-permissions" as const,
    authorityBoundary: "design-baseline-projection-is-read-only-and-does-not-convert-an-approval-candidate-into-approval-verify-approver-authority-enforce-separation-of-duties-establish-a-baseline-readiness-phase-entry-or-grant-implementation-write-import-or-action-authority" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function designDriftDetectionProjection(): DesignDriftDetectionProjection {
  const status = {
    schemaVersion: 1 as const,
    kind: "design-drift-detection-status" as const,
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    candidate: { recordId: "87878787-8787-4787-8787-878787878787", revision: 2, digest: `sha256:${"1".repeat(64)}` as const },
    implementationTargetCount: 5,
    humanReviewedImplementationTargetCount: 4,
    observationCount: 9,
    humanReviewedObservationCount: 8,
    requirementToDesignCount: 4,
    designToImplementationCount: 5,
    conformantCount: 3,
    driftCount: 5,
    unassessedCount: 1,
    blockerCount: 1,
    highSeverityCount: 2,
    remediationCandidateCount: 4,
    expiredRemediationCandidateCount: 1,
    staleBindingCount: 2,
    staleSourceReferenceCount: 3,
    unresolvedQuestionCount: 1,
    candidateResult: "incomplete" as const,
    reviewState: "held" as const,
    state: "attention-required" as const,
    reasons: ["One or more exact comparison subjects remain not assessed"],
    assessedAt: "2026-07-30T03:30:00.000Z",
    authorityBoundary: "design-drift-detection-status-is-observational-and-does-not-establish-an-actual-baseline-comparison-completeness-external-completeness-design-or-implementation-validity-approval-readiness-remediation-effect-or-figma-import-write-implementation-or-action-authority" as const,
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "design-drift-detection-projection" as const,
    product: { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    initiative: { id: initiative.id, revision: initiative.revision ?? 1, digest: canonicalDigest(initiative), state: initiative.state },
    status,
    candidate: {
      id: status.candidate.recordId,
      revision: status.candidate.revision,
      digest: status.candidate.digest,
      membershipDigest: `sha256:${"2".repeat(64)}` as const,
      state: "candidate" as const,
      designBaseline: {
        recordId: "88888888-8888-4888-8888-888888888888", revision: 1, digest: `sha256:${"3".repeat(64)}` as const,
        membershipDigest: `sha256:${"4".repeat(64)}` as const,
        baselineLineageId: "89898989-8989-4989-8989-898989898989",
        candidateSetId: "90909090-9090-4090-8090-909090909090", candidateSetRevision: 2,
        semanticVersion: "1.1.0", designationReceiptDigest: `sha256:${"5".repeat(64)}` as const,
        baselineDesignationState: "not-established" as const,
      },
      returnedFigmaSnapshot: {
        recordId: "91919191-9191-4191-8191-919191919191", revision: 3, digest: `sha256:${"6".repeat(64)}` as const,
        membershipDigest: `sha256:${"7".repeat(64)}` as const, externalFileIdentityDigest: `sha256:${"8".repeat(64)}` as const,
        returnedExternalVersionDigest: `sha256:${"9".repeat(64)}` as const, itemCatalogDigest: `sha256:${"a".repeat(64)}` as const,
      },
      designRequirements: {
        recordId: "92929292-9292-4292-8292-929292929292", revision: 4, digest: `sha256:${"b".repeat(64)}` as const,
        membershipDigest: `sha256:${"c".repeat(64)}` as const, requirementCatalogDigest: `sha256:${"d".repeat(64)}` as const,
      },
      designTrace: {
        recordId: "93939393-9393-4393-8393-939393939393", revision: 2, digest: `sha256:${"e".repeat(64)}` as const,
        membershipDigest: `sha256:${"f".repeat(64)}` as const, reconciliationDigest: `sha256:${"0".repeat(64)}` as const,
      },
      implementationTargetCatalogRevision: 2,
      implementationTargetCatalogDigest: `sha256:${"1".repeat(64)}` as const,
      comparisonPolicyDigest: `sha256:${"2".repeat(64)}` as const,
      comparisonDigest: `sha256:${"3".repeat(64)}` as const,
      implementationTargetCount: status.implementationTargetCount,
      observationCount: status.observationCount,
      remediationCandidateCount: status.remediationCandidateCount,
      candidateResult: status.candidateResult,
      reviewState: status.reviewState,
      updatedAt: "2026-07-30T03:29:00.000Z",
    },
    observedAt: status.assessedAt,
    privacyBoundary: "projection-contains-record-identities-version-axes-counts-classifications-severities-statuses-and-digests-only-not-design-requirement-or-implementation-content-source-content-human-attribution-personal-content-secrets-credentials-or-permissions" as const,
    authorityBoundary: "design-drift-detection-projection-is-read-only-and-does-not-establish-an-actual-baseline-comparison-completeness-external-completeness-design-or-implementation-validity-approval-readiness-remediation-effect-or-figma-import-write-implementation-or-action-authority" as const,
  }
  return { ...body, snapshotDigest: canonicalDigest(body) }
}

function p0P4ReadinessGateProjectionWithoutCandidate(): P0P4ReadinessGateProjection {
  const projection = p0P4ReadinessGateProjection()
  const body = {
    ...projection,
    status: {
      ...projection.status,
      gate: undefined,
      outputCount: 0,
      applicableOutputCount: 0,
      notApplicableOutputCount: 0,
      unresolvedApplicabilityCount: 0,
      satisfiedOutputCount: 0,
      conditionalOutputCount: 0,
      incompleteOutputCount: 0,
      failedOutputCount: 0,
      blockedOutputCount: 0,
      staleOrUnknownOutputCount: 0,
      pendingOrInvalidWaiverCount: 0,
      unresolvedDecisionCount: 0,
      unmetConditionCount: 0,
      unresolvedRequirementCount: 0,
      adverseEvidenceCount: 0,
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      inconsistencyCount: 0,
      unresolvedQuestionCount: 0,
      result: "not-assessed" as const,
      reasons: ["No current readiness gate candidate is available"],
    },
    gate: undefined,
    snapshotDigest: undefined,
  }
  const { snapshotDigest: _snapshotDigest, gate: _gate, ...content } = body
  const { gate: _statusGate, ...status } = content.status
  const canonical = { ...content, status }
  return { ...canonical, snapshotDigest: canonicalDigest(canonical) }
}

function p5HandoffPackageProjectionWithoutCandidate(): P5HandoffPackageProjection {
  const projection = p5HandoffPackageProjection()
  const body = {
    ...projection,
    status: {
      ...projection.status,
      handoff: undefined,
      itemCount: 0,
      includedItemCount: 0,
      referenceOnlyItemCount: 0,
      omittedNotApplicableItemCount: 0,
      unresolvedItemCount: 0,
      staleOrUnknownItemCount: 0,
      lossyTransformationCount: 0,
      unresolvedRequirementCount: 0,
      conflictCount: 0,
      unresolvedQuestionCount: 0,
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      readinessResult: "not-assessed" as const,
      transferState: "draft" as const,
      state: "attention-required" as const,
      reasons: ["No current P5 Handoff Package candidate is available"],
    },
    handoff: undefined,
    snapshotDigest: undefined,
  }
  const { snapshotDigest: _snapshotDigest, handoff: _handoff, ...content } = body
  const { handoff: _statusHandoff, ...status } = content.status
  const canonical = { ...content, status }
  return { ...canonical, snapshotDigest: canonicalDigest(canonical) }
}

const selection: AgentSelection = {
  schemaVersion: 2,
  adapterId: "codex-adapter",
  agentId: "codex-cli",
  modelId: "gpt-test",
  modelTruthClass: "provider-declared",
  modelAlias: false,
  settings: { sandbox: "read-only", approvalPolicy: "fail-closed-noninteractive", secretSetting: "must-redact" },
  selectedAt: "2026-07-21T00:00:00.000Z",
  capabilityDigest: `sha256:${"a".repeat(64)}`,
}

const charterDigest = `sha256:${"4".repeat(64)}`
const run: Run = {
  schemaVersion: 1,
  id: "33333333-3333-4333-8333-333333333333",
  revision: 1,
  charterId: "44444444-4444-4444-8444-444444444444",
  charterDigest,
  productId: product.id,
  initiativeId: initiative.id,
  agent: selection,
  state: "completed",
  startedAt: "2026-07-21T00:00:00.000Z",
  endedAt: "2026-07-21T00:01:00.000Z",
}

const managedRunId = "66666666-6666-4666-8666-666666666666"
const managedResultId = "77777777-7777-4777-8777-777777777777"
const managedEvidenceId = "88888888-8888-4888-8888-888888888888"
const managedDecisionId = "99999999-9999-4999-8999-999999999999"
const reviewResultId = "77777777-7777-4777-8777-777777777776"
const reviewEvidenceId = "88888888-8888-4888-8888-888888888887"
const workflowPlanId = "12121212-1212-4212-8212-121212121212"
const workflowStepId = "13131313-1313-4313-8313-131313131313"
const workflowAttemptId = "14141414-1414-4414-8414-141414141414"
const workflowPlanDigest = `sha256:${"5".repeat(64)}`
const provider = {
  adapterId: selection.adapterId,
  agentId: selection.agentId,
  modelId: selection.modelId,
  capabilityDigest: selection.capabilityDigest,
  runtimeVersion: "0.135.0",
}
const bindings = {
  product: { recordType: "product" as const, recordId: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
  initiative: { recordType: "initiative" as const, recordId: initiative.id, revision: initiative.revision ?? 1, digest: canonicalDigest(initiative) },
  charter: { recordType: "execution-charter" as const, recordId: run.charterId, revision: 1, digest: charterDigest },
  run: { recordType: "run" as const, recordId: run.id, revision: run.revision ?? 1, digest: canonicalDigest(run) },
  agentSelectionDigest: canonicalDigest(selection),
  contextPacks: [{
    recordType: "context-pack" as const,
    recordId: "15151515-1515-4515-8515-151515151515",
    revision: 1,
    digest: `sha256:${"6".repeat(64)}`,
  }],
  workflowPlan: { recordType: "workflow-plan" as const, recordId: workflowPlanId, revision: 1, digest: workflowPlanDigest },
  tools: [{
    recordType: "tool-definition" as const,
    recordId: "16161616-1616-4616-8616-161616161616",
    revision: 1,
    digest: `sha256:${"7".repeat(64)}`,
  }],
}
const bindingsDigest = canonicalDigest(bindings)
const evaluator = { kind: "human" as const, id: "local-reviewer", version: "1" }
const evaluatorBinding = { ...evaluator, digest: canonicalDigest(evaluator) }
const gate = (phase: "preconditions" | "outputs" | "evidence" | "stop-conditions" | "charter-evidence" | "charter-stop-conditions") => ({
  phase,
  interpretation: phase === "stop-conditions" || phase === "charter-stop-conditions"
    ? "stop-boundary-complied" as const
    : "criteria-satisfied" as const,
  criteriaDigest: `sha256:${"8".repeat(64)}`,
  status: "satisfied" as const,
  basis: "human-attestation" as const,
  evidenceDigest: `sha256:${"9".repeat(64)}`,
  actor: { kind: "human" as const, id: evaluator.id },
  evaluator: evaluatorBinding,
  assessedAt: "2026-07-21T00:00:50.000Z",
})
const managedEvents = [{
  sequence: 0,
  observedAt: "2026-07-21T00:00:30.000Z",
  type: "output" as const,
  channel: "assistant" as const,
  contentDigest: `sha256:${"c".repeat(64)}`,
  byteLength: 512,
  redactionCount: 2,
}]
const changedInventory = [{
  path: "src/safe.ts",
  kind: "modified" as const,
  beforeDigest: `sha256:${"1".repeat(64)}`,
  afterDigest: `sha256:${"2".repeat(64)}`,
  beforeSize: 128,
  afterSize: 256,
  beforeMode: 0o644,
  afterMode: 0o644,
}]
const reviewStaging = {
  baselineDigest: `sha256:${"a".repeat(64)}`,
  finalDigest: `sha256:${"b".repeat(64)}`,
  changes: changedInventory,
  excludedPathCount: 1,
  excludedPathSetDigest: `sha256:${"d".repeat(64)}`,
  applyState: "pending" as const,
}
const reviewAttempt = {
  id: workflowAttemptId,
  revision: 1,
  stepId: workflowStepId,
  stepIndex: 0,
  attempt: 1,
  state: "review-required" as const,
  dependencies: [],
  contextPacks: bindings.contextPacks,
  tools: bindings.tools,
  effectEnvelope: ["reversible-change" as const],
  eventRange: { startSequence: 0, endSequence: 0 },
  providerDisposition: "completed" as const,
  terminationCause: "normal" as const,
  postconditionStatus: "not-assessed" as const,
  gates: {
    preconditions: gate("preconditions"),
    outputs: gate("outputs"),
    evidence: gate("evidence"),
    stopConditions: gate("stop-conditions"),
  },
  startedAt: "2026-07-21T00:00:05.000Z",
  endedAt: "2026-07-21T00:01:00.000Z",
}
const reviewEvidence = managedRunEvidenceSchema.parse({
  schemaVersion: 2,
  kind: "managed-run-evidence",
  id: reviewEvidenceId,
  managedRunId,
  runId: run.id,
  productId: product.id,
  bindingsDigest,
  events: managedEvents,
  eventsDigest: canonicalDigest(managedEvents),
  workflow: {
    plan: bindings.workflowPlan,
    strategy: "sequential",
    orderedStepIds: [workflowStepId],
    attempts: [reviewAttempt],
    completedStepIds: [],
    charterGates: { requiredEvidence: gate("charter-evidence"), stopConditions: gate("charter-stop-conditions") },
    terminalReasonCode: "apply-review-required",
    capabilityBoundary: "natural-language-gates-require-explicit-human-or-system-assessment",
  },
  staging: reviewStaging,
  actualEffects: [{
    effect: "reversible-change",
    status: "observed-provisional",
    evidenceDigest: canonicalDigest({
      effectsSeed: canonicalDigest({ events: managedEvents, staging: reviewStaging, disposition: "completed" }),
      effect: "reversible-change",
    }),
  }],
  capturedAt: "2026-07-21T00:01:01.000Z",
  authorityBoundary: "evidence-does-not-self-assert-outcome-or-authorization",
})
const reviewResult = managedRunResultSchema.parse({
  schemaVersion: 1,
  kind: "managed-run-result",
  id: reviewResultId,
  managedRunId,
  runId: run.id,
  productId: product.id,
  mode: "codex-staged",
  provider,
  providerDisposition: "completed",
  terminationCause: "normal",
  outcome: { status: "not-assessed", basis: "not-evaluated" },
  terminalState: "review-required",
  evidenceId: reviewEvidence.id,
  evidenceDigest: canonicalDigest(reviewEvidence),
  warnings: ["provider-output-redacted"],
  startedAt: "2026-07-21T00:00:05.000Z",
  endedAt: "2026-07-21T00:01:00.000Z",
  authorityBoundary: "provider-completion-does-not-equal-outcome-completion",
})
const managedDecision = managedApplyDecisionReceiptSchema.parse({
  schemaVersion: 1,
  kind: "managed-apply-decision",
  id: managedDecisionId,
  managedRunId,
  managedRunRevision: 3,
  runId: run.id,
  productId: product.id,
  bindingsDigest,
  reviewResultId: reviewResult.id,
  reviewResultDigest: canonicalDigest(reviewResult),
  reviewEvidenceId: reviewEvidence.id,
  reviewEvidenceDigest: canonicalDigest(reviewEvidence),
  changedInventory,
  changedInventoryDigest: canonicalDigest(changedInventory),
  writeEnvelope: ["src"],
  writeEnvelopeDigest: canonicalDigest(["src"]),
  actor: { kind: "human", id: "machine-local-actor-must-not-render" },
  decision: "apply-exact-reviewed-inventory",
  decidedAt: "2026-07-21T00:01:02.000Z",
  authorityBoundary: "apply-decision-is-exact-run-evidence-inventory-actor-and-scope",
})
const completedAttempt = {
  ...reviewAttempt,
  revision: 2,
  previousSnapshotDigest: canonicalDigest(reviewAttempt),
  state: "completed" as const,
  postconditionStatus: "satisfied" as const,
}
const appliedStaging = {
  ...reviewStaging,
  applyState: "applied" as const,
  applyJournalDigest: `sha256:${"f".repeat(64)}`,
  applyDecision: { receiptId: managedDecision.id, receiptDigest: canonicalDigest(managedDecision) },
}
const managedEvidence = managedRunEvidenceSchema.parse({
  ...reviewEvidence,
  id: managedEvidenceId,
  workflow: {
    ...reviewEvidence.workflow,
    attempts: [completedAttempt],
    completedStepIds: [workflowStepId],
    terminalReasonCode: "workflow-completed",
  },
  staging: appliedStaging,
  actualEffects: [{
    effect: "reversible-change",
    status: "applied",
    evidenceDigest: canonicalDigest({
      effectsSeed: canonicalDigest({ events: managedEvents, staging: appliedStaging, disposition: "completed" }),
      effect: "reversible-change",
    }),
  }],
  capturedAt: "2026-07-21T00:01:04.000Z",
})
const outcomeEvaluator = { kind: "human" as const, id: "postcondition-reviewer", version: "1" }
const managedResult = managedRunResultSchema.parse({
  ...reviewResult,
  id: managedResultId,
  outcome: { status: "satisfied", basis: "postcondition-evaluator", evaluator: {
    ...outcomeEvaluator,
    digest: canonicalDigest(outcomeEvaluator),
  } },
  terminalState: "completed",
  evidenceId: managedEvidence.id,
  evidenceDigest: canonicalDigest(managedEvidence),
  previousResultId: reviewResult.id,
  previousResultDigest: canonicalDigest(reviewResult),
  endedAt: "2026-07-21T00:01:04.000Z",
})
const managedRun = managedRunRecordSchema.parse({
  schemaVersion: 2,
  kind: "managed-run",
  id: managedRunId,
  revision: 5,
  runId: run.id,
  productId: product.id,
  initiativeId: initiative.id,
  mode: "codex-staged",
  state: "completed",
  bindings,
  bindingsDigest,
  bindingSnapshots: { initiative, run },
  provider,
  rootManagedRunId: managedRunId,
  attemptNumber: 1,
  applyDecisionId: managedDecision.id,
  applyDecisionDigest: canonicalDigest(managedDecision),
  resultId: managedResult.id,
  resultDigest: canonicalDigest(managedResult),
  recovery: { status: "not-required" },
  createdAt: "2026-07-21T00:00:05.000Z",
  startedAt: "2026-07-21T00:00:05.000Z",
  updatedAt: "2026-07-21T00:01:05.000Z",
  endedAt: "2026-07-21T00:01:05.000Z",
})

function managedRecordWithoutArtifacts(id: string, boundRun: Run, updatedAt: string): ManagedRunRecord {
  const recordBindings = {
    ...bindings,
    run: {
      recordType: "run" as const,
      recordId: boundRun.id,
      revision: boundRun.revision ?? 1,
      digest: canonicalDigest(boundRun),
    },
    agentSelectionDigest: canonicalDigest(boundRun.agent),
  }
  return managedRunRecordSchema.parse({
    schemaVersion: 2,
    kind: "managed-run",
    id,
    revision: 1,
    runId: boundRun.id,
    productId: product.id,
    initiativeId: initiative.id,
    mode: "codex-staged",
    state: "prepared",
    bindings: recordBindings,
    bindingsDigest: canonicalDigest(recordBindings),
    bindingSnapshots: { initiative, run: boundRun },
    provider: {
      adapterId: boundRun.agent.adapterId,
      agentId: boundRun.agent.agentId,
      modelId: boundRun.agent.modelId,
      capabilityDigest: boundRun.agent.capabilityDigest,
      runtimeVersion: "0.135.0",
    },
    rootManagedRunId: id,
    attemptNumber: 1,
    recovery: { status: "not-required" },
    createdAt: updatedAt,
    updatedAt,
  })
}

const handoff = handoffSchema.parse({
  schemaVersion: 1,
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  productId: product.id,
  initiativeId: initiative.id,
  fromRunId: run.id,
  toAgent: {
    ...selection,
    adapterId: "claude-adapter",
    agentId: "claude-code-cli",
    modelId: "sonnet",
    modelAlias: true,
    settings: { effort: "must-not-render-setting" },
  },
  reason: "Use a second provider for an independent review.",
  workspaceBaseline: { dirty: true, changedFiles: ["src/safe.ts"], truthClass: "observed" },
  completedWork: ["Completed the bounded implementation."],
  evidence: ["digest-only reference"],
  unresolvedMatters: ["free text must not render"],
  decisions: ["Keep provider output private."],
  capabilityDifferences: ["The target uses a provider alias."],
  acknowledgedAt: "2026-07-21T00:02:00.000Z",
  createdAt: "2026-07-21T00:01:30.000Z",
})

const designDraft: ProductDesignDraft = {
  schemaVersion: 1,
  kind: "product-design-draft",
  id: "55555555-5555-4555-8555-555555555555",
  productId: product.id,
  revision: 2,
  baseProductRevision: product.revision ?? 1,
  sections: Object.fromEntries(productStudioSectionIds.map((sectionId) => [sectionId, {
    sectionId,
    summary: `${sectionId} summary`,
    fields: [{
      key: `${sectionId.replaceAll("-", ".")}.truth`,
      question: `What is the governed ${sectionId} truth?`,
      value: `${sectionId} truth`,
      state: "complete" as const,
      provenance: ["human:local-actor-test"],
    }],
    gaps: [],
    conflicts: [],
    updatedAt: "2026-07-21T00:00:00.000Z",
  }])) as unknown as ProductDesignDraft["sections"],
  createdAt: "2026-07-21T00:00:00.000Z",
  updatedAt: "2026-07-21T00:00:00.000Z",
}

const portableDesignSnapshot = {
  schemaVersion: 1,
  kind: "portable-design-snapshot",
  bundleId: "23232323-2323-4323-8323-232323232323",
  productId: product.id,
  initiativeId: initiative.id,
  title: "Checkout design",
  classification: "internal",
  owner: { kind: "human", id: "upstream-designer" },
  source: {
    tool: "figma",
    objectId: "private-source-object",
    revision: "source-r1",
    exportMethod: "manual-export",
    exportedAt: "2026-07-21T00:00:00.000Z",
  },
  sourceReview: {
    status: "approved",
    actor: { kind: "human", id: "upstream-reviewer" },
    occurredAt: "2026-07-21T00:01:00.000Z",
    evidenceId: "upstream-evidence",
  },
  governance: {
    state: "pending-human-review",
    claimBoundary: "import-validation-is-not-design-approval-or-baseline",
  },
  artifacts: [{
    id: "checkout-screen",
    kind: "screen",
    format: "png",
    path: "private/raw-checkout.png",
    mediaType: "image/png",
    sizeBytes: 512,
    digest: `sha256:${"a".repeat(64)}`,
    targets: [],
    validation: "signature-verified",
  }],
  tokens: [{
    artifactId: "checkout-tokens",
    path: "auth.private",
    type: "string",
    value: "private-token-value",
    valueDigest: `sha256:${"b".repeat(64)}`,
  }],
  snapshotDigest: `sha256:${"c".repeat(64)}`,
  evidence: {
    policy: "gaep-portable-design-import/1",
    importedAt: "2026-07-21T00:02:00.000Z",
    manifestDigest: `sha256:${"d".repeat(64)}`,
    artifactInventoryDigest: `sha256:${"e".repeat(64)}`,
    checks: [
      "manifest-strict-schema",
      "bundle-exact-inventory",
      "paths-contained-and-link-free",
      "sizes-and-digests-exact",
      "text-secret-scan-clear",
      "formats-passively-validated",
    ],
    limitations: ["A successful import remains pending human review and does not establish a Design Baseline."],
    evidenceDigest: `sha256:${"f".repeat(64)}`,
  },
} as PortableDesignSnapshot

function productStudioStub(): ProductStudioService {
  const readiness = {
    schemaVersion: 1 as const,
    productId: product.id,
    draftId: designDraft.id,
    draftRevision: designDraft.revision,
    status: "ready" as const,
    sections: productStudioSectionIds.map((sectionId) => ({
      sectionId,
      state: "complete" as const,
      missingFields: [],
      weakFields: [],
      deferredFields: [],
      openConflictIds: [],
      blockerGapIds: [],
    })),
    blockingGapIds: [],
    openConflictIds: [],
    deferredFieldCount: 0,
    evaluatedAt: "2026-07-21T00:00:00.000Z",
    claimBoundary: "design-readiness-is-not-implementation-approval" as const,
  }
  return {
    readDesignDraft: async () => designDraft,
    evaluateDesignReadiness: () => readiness,
    listDesignRevisions: async () => [],
    listProductRevisions: async () => [],
    listChanges: async () => [],
    listWorkItems: async () => [],
    listRequirements: async () => [],
    listDecisions: async () => [],
    listRisks: async () => [],
    listArchitectureRecords: async () => [],
    listEvidence: async () => [],
    listContextPacks: async () => [],
    listWorkflowPlans: async () => [],
    listToolDefinitions: async () => [],
    listRunToolSelections: async () => [],
    listTraceLinks: async () => [],
    listInstructionPrivilegeGrants: async () => [],
    listDomainPage: async (_kind: string, input: { offset?: number; limit?: number } = {}) => ({
      items: [],
      offset: input.offset ?? 0,
      limit: input.limit ?? 50,
      total: 0,
      hasMore: false,
    }),
    listPortableDesignSnapshots: async (input: { offset?: number; limit?: number } = {}) => ({
      items: [],
      offset: input.offset ?? 0,
      limit: input.limit ?? 50,
      total: 0,
      hasMore: false,
    }),
    readPortableDesignSnapshot: async () => {
      throw Object.assign(new Error("missing portable design snapshot"), { code: "ENOENT" })
    },
    healthIssues: async () => [],
  } as unknown as ProductStudioService
}

function capability(overrides: Partial<AdapterCapabilities>): AdapterCapabilities {
  return {
    schemaVersion: 1,
    adapterId: "codex-adapter",
    adapterVersion: "0.1.0",
    agentId: "codex-cli",
    agentLabel: "Codex",
    runtimeVersion: "1.0.0",
    detected: true,
    executionInterface: "cli-jsonl",
    interfaceMaturity: "stable",
    supportsResume: false,
    supportsCancel: true,
    supportsCheckpoints: false,
    supportsModelDiscovery: true,
    supportsToolSelection: false,
    settings: [{
      key: "secretSetting",
      label: "Secret",
      description: "A sensitive test value",
      kind: "string",
      required: false,
      sensitive: true,
      truthClass: "configured",
    }],
    models: [{ id: "gpt-test", label: "Test model", reasoningOptions: [], inputModalities: ["text"], truthClass: "provider-declared", alias: false }],
    limitations: [],
    observedAt: "2026-07-21T00:00:00.000Z",
    ...overrides,
  }
}

interface HarnessOptions {
  deliveryPhase?: DeliveryPhaseId
  trusted?: boolean
  withWorkspace?: boolean
  withProduct?: boolean
  selection?: AgentSelection | null
  selectionError?: Error
  initiatives?: Initiative[]
  initiativeEntryAssessments?: Record<string, InitiativeEntryAssessment>
  runs?: Run[]
  managedRuns?: ManagedRunRecord[]
  managedRunTotal?: number
  managedObservationError?: Error
  managedResults?: Record<string, ManagedRunResult>
  managedEvidence?: Record<string, ManagedRunEvidence>
  managedApplyDecisions?: Record<string, ManagedApplyDecisionReceipt>
  handoffs?: Handoff[]
  handoffTotal?: number
  handoffSelectedFileCount?: number
  handoffOmittedOutsideWindow?: number
  handoffOmittedForResourceSafety?: number
  handoffPlatformAttestationUnavailable?: boolean
  handoffObservationError?: Error
  audit?: { valid: boolean; events: number; error?: string }
  runtimeBindings?: Record<string, unknown>
  rotateContextDuringObservation?: boolean
  productStudio?: ProductStudioService
  sourceGovernanceProjection?: SourceGovernanceProjection
  businessUnderstandingProjection?: BusinessUnderstandingProjection
  businessCapabilityMapProjection?: BusinessCapabilityMapProjection
  valueStreamModelProjection?: ValueStreamModelProjection
  operatingModelProjection?: OperatingModelProjection
  businessRuleCatalogProjection?: BusinessRuleCatalogProjection
  businessArchitectureBaselineProjection?: BusinessArchitectureBaselineProjection
  systemSolutionArchitectureProjection?: SystemSolutionArchitectureProjection
  boundedContextModelProjection?: BoundedContextModelProjection
  securityPrivacyAssessmentProjection?: SecurityPrivacyAssessmentProjection
  processModelProjection?: ProcessModelProjection
  dataModelProjection?: DataModelProjection
  authorizationModelProjection?: AuthorizationModelProjection
  eventIntegrationModelProjection?: EventIntegrationModelProjection
  failureRecoveryModelProjection?: FailureRecoveryModelProjection
  architectureChallengeModelProjection?: ArchitectureChallengeModelProjection
  decisionRegisterProjection?: DecisionRegisterProjection
  riskRegisterProjection?: RiskRegisterProjection
  evidenceRegistryProjection?: EvidenceRegistryProjection
  endToEndTraceabilityProjection?: EndToEndTraceabilityProjection
  p0P4ReadinessGateProjection?: P0P4ReadinessGateProjection
  p5HandoffPackageProjection?: P5HandoffPackageProjection
  designApplicabilityProjection?: DesignApplicabilityProjection
  designPersonaRoleProjection?: DesignPersonaRoleModelProjection
  userJourneyProjection?: UserJourneyModelProjection
  informationArchitectureProjection?: InformationArchitectureModelProjection
  screenStateInventoryProjection?: ScreenStateInventoryProjection
  designRequirementsProjection?: DesignRequirementsProjection
  designSystemTokenContractProjection?: DesignSystemTokenContractProjection
  accessibilityDesignRulesProjection?: AccessibilityDesignRulesProjection
  responsiveMultiPlatformTargetsProjection?: ResponsiveMultiPlatformTargetsProjection
  manualFigmaExecutionPathProjection?: ManualFigmaExecutionPathProjection
  figmaMcpCapabilityDiscoveryProjection?: FigmaMcpCapabilityDiscoveryProjection
  figmaReadSnapshotProjection?: FigmaReadSnapshotProjection
  figmaContextImportProjection?: FigmaContextImportProjection
  outboundDesignBriefPackageProjection?: OutboundDesignBriefPackageProjection
  governedFigmaWriteProjection?: GovernedFigmaWriteProjection
  finalizedFigmaSnapshotImportProjection?: FinalizedFigmaSnapshotImportProjection
  designToRequirementBindingProjection?: DesignToRequirementBindingProjection
  designerReadyGateProjection?: DesignerReadyGateProjection
  designDeltaProjection?: DesignDeltaProjection
  designDeltaProjectionError?: Error
  designConflictResolutionProjection?: DesignConflictResolutionProjection
  designConflictResolutionProjectionError?: Error
  humanDesignApprovalProjection?: HumanDesignApprovalProjection
  humanDesignApprovalProjectionError?: Error
  designBaselineProjection?: DesignBaselineProjection
  designBaselineProjectionError?: Error
  designDriftDetectionProjection?: DesignDriftDetectionProjection
  designDriftDetectionProjectionError?: Error
  commandResult?: unknown
}

function harness(options: HarnessOptions = {}) {
  const commands: Array<{ command: ExistingStudioCommand; args: unknown[] }> = []
  const diagnostics: string[] = []
  const hasProduct = options.withProduct ?? true
  let contextGeneration = "context_generation_1234567890"
  let contextRotatedDuringObservation = false
  const managedPageRequests: Array<{ offset?: number; limit?: number; snapshotDigest?: string }> = []
  const selectedAgent = options.selection === undefined ? selection : options.selection
  const engine = {
    readProduct: async () => {
      if (!hasProduct) throw Object.assign(new Error("missing"), { code: "ENOENT" })
      return product
    },
    readSelection: async () => {
      if (options.selectionError) throw options.selectionError
      if (!selectedAgent) throw new Error("missing selection")
      return selectedAgent
    },
    assessInitiativeEntry: async (id: string): Promise<InitiativeEntryAssessment> => {
      const observed = (options.initiatives ?? [initiative]).find((candidate) => candidate.id === id)
      if (!observed) throw new Error("missing Initiative")
      return options.initiativeEntryAssessments?.[id] ?? {
        schemaVersion: 1,
        kind: "initiative-entry-assessment",
        initiativeId: observed.id,
        initiativeRevision: observed.revision ?? 1,
        productId: product.id,
        productRevision: product.revision ?? 1,
        productDigest: canonicalDigest(product),
        classification: { status: "missing" },
        applicability: {
          status: "missing",
          decisionCount: 0,
          unresolvedSubjectCount: 0,
          pendingHumanDecisionCount: 0,
          blockedDecisionCount: 0,
          pendingApprovalCount: 0,
          rejectedApprovalCount: 0,
        },
        state: "attention-required",
        reasons: ["Initiative classification is missing", "Initiative applicability has not been resolved"],
        assessedAt: "2026-07-25T00:00:00.000Z",
        authorityBoundary: "entry-assessment-is-read-only-and-does-not-grant-approval-readiness-or-action-authority",
      }
    },
    listRuns: async () => options.runs ?? [run],
    listManagedRuns: async () => {
      if (options.managedObservationError) throw options.managedObservationError
      return options.managedRuns ?? []
    },
    listManagedRunsPage: async (input: { offset?: number; limit?: number; snapshotDigest?: `sha256:${string}` } = {}) => {
      if (options.managedObservationError) throw options.managedObservationError
      managedPageRequests.push(input)
      const offset = input.offset ?? 0
      const limit = input.limit ?? 200
      const records = [...(options.managedRuns ?? [])].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id))
      const total = options.managedRunTotal ?? records.length
      const items = records.slice(offset, offset + limit)
      return {
        items,
        offset,
        limit,
        total,
        snapshotDigest: canonicalDigest(
          records.map((record) => ({ id: record.id, digest: canonicalDigest(record) })),
        ) as `sha256:${string}`,
        hasMore: offset + items.length < total,
      }
    },
    readManagedRunResult: async (id: string) => {
      const result = options.managedResults?.[id]
      if (!result) throw Object.assign(new Error("missing Managed Result"), { code: "ENOENT" })
      return result
    },
    readManagedRunEvidence: async (id: string) => {
      const evidence = options.managedEvidence?.[id]
      if (!evidence) throw Object.assign(new Error("missing Managed Evidence"), { code: "ENOENT" })
      return evidence
    },
    readManagedApplyDecision: async (id: string) => {
      const decision = options.managedApplyDecisions?.[id]
      if (!decision) throw Object.assign(new Error("missing apply decision"), { code: "ENOENT" })
      return decision
    },
    repository: { verifyAudit: async () => options.audit ?? ({ valid: true, events: 8 }) },
    productStudio: options.productStudio ?? productStudioStub(),
    ...(options.sourceGovernanceProjection ? {
      sourceGovernance: {
        project: async () => options.sourceGovernanceProjection!,
      },
    } : {}),
    ...(options.businessUnderstandingProjection ? {
      businessUnderstanding: {
        project: async () => options.businessUnderstandingProjection!,
      },
    } : {}),
    ...(options.businessCapabilityMapProjection ? {
      businessCapabilityMap: {
        project: async () => options.businessCapabilityMapProjection!,
      },
    } : {}),
    ...(options.valueStreamModelProjection ? {
      valueStreamModel: {
        project: async () => options.valueStreamModelProjection!,
      },
    } : {}),
    ...(options.operatingModelProjection ? {
      operatingModel: {
        project: async () => options.operatingModelProjection!,
      },
    } : {}),
    ...(options.businessRuleCatalogProjection ? {
      businessRuleCatalog: {
        project: async () => options.businessRuleCatalogProjection!,
      },
    } : {}),
    ...(options.businessArchitectureBaselineProjection ? {
      businessArchitectureBaseline: {
        project: async () => options.businessArchitectureBaselineProjection!,
      },
    } : {}),
    ...(options.systemSolutionArchitectureProjection ? {
      systemSolutionArchitecture: {
        project: async () => options.systemSolutionArchitectureProjection!,
      },
    } : {}),
    ...(options.boundedContextModelProjection ? {
      boundedContextModel: {
        project: async () => options.boundedContextModelProjection!,
      },
    } : {}),
    ...(options.securityPrivacyAssessmentProjection ? {
      securityPrivacyAssessment: {
        project: async () => options.securityPrivacyAssessmentProjection!,
      },
    } : {}),
    ...(options.processModelProjection ? {
      processModel: {
        project: async () => options.processModelProjection!,
      },
    } : {}),
    ...(options.dataModelProjection ? {
      dataModel: {
        project: async () => options.dataModelProjection!,
      },
    } : {}),
    ...(options.authorizationModelProjection ? {
      authorizationModel: {
        project: async () => options.authorizationModelProjection!,
      },
    } : {}),
    ...(options.eventIntegrationModelProjection ? {
      eventIntegrationModel: {
        project: async () => options.eventIntegrationModelProjection!,
      },
    } : {}),
    ...(options.failureRecoveryModelProjection ? {
      failureRecoveryModel: {
        project: async () => options.failureRecoveryModelProjection!,
      },
    } : {}),
    ...(options.architectureChallengeModelProjection ? {
      architectureChallengeModel: {
        project: async () => options.architectureChallengeModelProjection!,
      },
    } : {}),
    ...(options.decisionRegisterProjection ? {
      decisionRegister: {
        project: async () => options.decisionRegisterProjection!,
      },
    } : {}),
    ...(options.riskRegisterProjection ? {
      riskRegister: {
        project: async () => options.riskRegisterProjection!,
      },
    } : {}),
    ...(options.evidenceRegistryProjection ? {
      evidenceRegistry: {
        project: async () => options.evidenceRegistryProjection!,
      },
    } : {}),
    ...(options.endToEndTraceabilityProjection ? {
      endToEndTraceability: {
        project: async () => options.endToEndTraceabilityProjection!,
      },
    } : {}),
    ...(options.p0P4ReadinessGateProjection ? {
      p0P4ReadinessGate: {
        project: async () => options.p0P4ReadinessGateProjection!,
        readCurrent: async () => undefined,
      },
    } : {}),
    ...(options.p5HandoffPackageProjection ? {
      p5HandoffPackage: {
        project: async () => options.p5HandoffPackageProjection!,
        readCurrent: async () => undefined,
      },
    } : {}),
    ...(options.designApplicabilityProjection ? {
      designApplicability: {
        project: async () => options.designApplicabilityProjection!,
      },
    } : {}),
    ...(options.designPersonaRoleProjection ? {
      designPersonaRoleModel: {
        project: async () => options.designPersonaRoleProjection!,
      },
    } : {}),
    ...(options.userJourneyProjection ? {
      userJourneyModel: {
        project: async () => options.userJourneyProjection!,
      },
    } : {}),
    ...(options.informationArchitectureProjection ? {
      informationArchitectureModel: {
        project: async () => options.informationArchitectureProjection!,
      },
    } : {}),
    ...(options.screenStateInventoryProjection ? {
      screenStateInventory: {
        project: async () => options.screenStateInventoryProjection!,
      },
    } : {}),
    ...(options.designRequirementsProjection ? {
      designRequirements: {
        project: async () => options.designRequirementsProjection!,
      },
    } : {}),
    ...(options.designSystemTokenContractProjection ? {
      designSystemTokenContract: {
        project: async () => options.designSystemTokenContractProjection!,
      },
    } : {}),
    ...(options.accessibilityDesignRulesProjection ? {
      accessibilityDesignRules: {
        project: async () => options.accessibilityDesignRulesProjection!,
      },
    } : {}),
    ...(options.responsiveMultiPlatformTargetsProjection ? {
      responsiveMultiPlatformTargets: {
        project: async () => options.responsiveMultiPlatformTargetsProjection!,
      },
    } : {}),
    ...(options.manualFigmaExecutionPathProjection ? {
      manualFigmaExecutionPath: {
        project: async () => options.manualFigmaExecutionPathProjection!,
      },
    } : {}),
    ...(options.figmaMcpCapabilityDiscoveryProjection ? {
      figmaMcpCapabilityDiscovery: {
        project: async () => options.figmaMcpCapabilityDiscoveryProjection!,
      },
    } : {}),
    ...(options.figmaReadSnapshotProjection ? {
      figmaReadSnapshot: {
        project: async () => options.figmaReadSnapshotProjection!,
      },
    } : {}),
    ...(options.figmaContextImportProjection ? {
      figmaContextImport: {
        project: async () => options.figmaContextImportProjection!,
      },
    } : {}),
    ...(options.outboundDesignBriefPackageProjection ? {
      outboundDesignBriefPackage: {
        project: async () => options.outboundDesignBriefPackageProjection!,
      },
    } : {}),
    ...(options.governedFigmaWriteProjection ? {
      governedFigmaWrite: {
        project: async () => options.governedFigmaWriteProjection!,
      },
    } : {}),
    ...(options.finalizedFigmaSnapshotImportProjection ? {
      finalizedFigmaSnapshotImport: {
        project: async () => options.finalizedFigmaSnapshotImportProjection!,
      },
    } : {}),
    ...(options.designToRequirementBindingProjection ? {
      designToRequirementBinding: {
        project: async () => options.designToRequirementBindingProjection!,
      },
    } : {}),
    ...(options.designerReadyGateProjection ? {
      designerReadyGate: {
        project: async () => options.designerReadyGateProjection!,
      },
    } : {}),
    ...(options.designDeltaProjection || options.designDeltaProjectionError ? {
      designDelta: {
        project: async () => {
          if (options.designDeltaProjectionError) throw options.designDeltaProjectionError
          return options.designDeltaProjection!
        },
      },
    } : {}),
    ...(options.designConflictResolutionProjection || options.designConflictResolutionProjectionError ? {
      designConflictResolution: {
        project: async () => {
          if (options.designConflictResolutionProjectionError) throw options.designConflictResolutionProjectionError
          return options.designConflictResolutionProjection!
        },
      },
    } : {}),
    ...(options.humanDesignApprovalProjection || options.humanDesignApprovalProjectionError ? {
      humanDesignApproval: {
        project: async () => {
          if (options.humanDesignApprovalProjectionError) throw options.humanDesignApprovalProjectionError
          return options.humanDesignApprovalProjection!
        },
      },
    } : {}),
    ...(options.designBaselineProjection || options.designBaselineProjectionError ? {
      designBaseline: {
        project: async () => {
          if (options.designBaselineProjectionError) throw options.designBaselineProjectionError
          return options.designBaselineProjection!
        },
      },
    } : {}),
    ...(options.designDriftDetectionProjection || options.designDriftDetectionProjectionError ? {
      designDriftDetection: {
        project: async () => {
          if (options.designDriftDetectionProjectionError) throw options.designDriftDetectionProjectionError
          return options.designDriftDetectionProjection!
        },
      },
    } : {}),
  }
  const context: CurrentEngineStudioContext = {
    contextGeneration: () => contextGeneration,
    deliveryPhase: () => options.deliveryPhase ?? "phase-0-1a-foundation",
    trusted: () => options.trusted ?? true,
    workspace: () => options.withWorkspace === false ? undefined : ({ name: "Example Product", path: workspacePath }),
    engine: () => engine,
    recoveryDiagnostic: () => undefined,
    hasGaepState: async () => hasProduct,
    listInitiatives: async () => {
      if (options.rotateContextDuringObservation && !contextRotatedDuringObservation) {
        contextGeneration = "context_generation_0987654321"
        contextRotatedDuringObservation = true
      }
      return options.initiatives ?? [initiative]
    },
    listHandoffs: async () => {
      if (options.handoffObservationError) throw options.handoffObservationError
      const records = options.handoffs ?? []
      return {
        records,
        total: options.handoffTotal ?? records.length,
        selectedFileCount: options.handoffSelectedFileCount ?? records.length,
        omittedOutsideWindow: options.handoffOmittedOutsideWindow ?? 0,
        omittedForResourceSafety: options.handoffOmittedForResourceSafety ?? 0,
        platformAttestationUnavailable: options.handoffPlatformAttestationUnavailable ?? false,
      }
    },
    probeAgents: async () => [
      capability({}),
      capability({
        adapterId: "claude-adapter",
        agentId: "claude-code-cli",
        agentLabel: "Claude Code",
        executionInterface: "unavailable",
        interfaceMaturity: "unknown",
        models: [],
      }),
    ],
    runtimeBindings: () => options.runtimeBindings ?? ({
      [`${workspacePath}\u0000codex-adapter`]: {
        schemaVersion: 2,
        scope: "machine-local",
        kind: "executable",
        adapterId: "codex-adapter",
        agentId: "codex-cli",
        capabilityDigest: selection.capabilityDigest,
        executable: {
          requested: "codex",
          canonicalPath: "/opt/local/bin/codex",
          digest: `sha256:${"b".repeat(64)}`,
          size: 42,
          modifiedAtMs: 1,
        },
        observedAt: "2026-07-21T00:00:00.000Z",
      },
    }),
    actorId: () => "local-actor-test",
    executeCommand: (expectedContextGeneration, command, ...args) => {
      if (expectedContextGeneration !== contextGeneration) throw new Error("stale context")
      commands.push({ command, args })
      return Promise.resolve(options.commandResult)
    },
    logDiagnostic: (message) => diagnostics.push(message),
  }
  return {
    source: new CurrentEngineStudioDataSource(context),
    commands,
    diagnostics,
    managedPageRequests,
    setContextGeneration: (value: string) => { contextGeneration = value },
  }
}

describe("current-engine Product Studio data source", () => {
  it("produces protocol-valid honest snapshots for every approved route", async () => {
    const { source } = harness()
    for (const route of studioRoutes) {
      const snapshot = await source.readSnapshot(route)
      expect(isStudioSnapshot(snapshot), route).toBe(true)
    }
    const architecture = await source.readSnapshot("architecture")
    expect(architecture.surface.kind).toBe("ready")
    expect(architecture.page.design?.sectionId).toBe("architecture")
    expect(architecture.dashboard).toMatchObject({
      phase: { id: "phase-0-1a-foundation" },
      panels: [
        { id: "foundation-summary", state: "attention-required" },
        { id: "change-impact", state: "active" },
        { id: "agent-model", state: "active" },
      ],
    })
    const dashboard = architecture.dashboard
    if (!dashboard) throw new Error("Expected a Product-bound phase dashboard")
    const { compositionDigest, ...dashboardContent } = dashboard
    expect(compositionDigest).toBe(canonicalDigest(dashboardContent))
    expect(JSON.stringify(dashboard)).not.toContain(product.name)
    const readiness = await source.readSnapshot("readiness")
    expect(readiness.page.kind).toBe("readiness")
    expect(readiness.page.kind === "readiness" && readiness.page.statement).toMatch(/Design readiness is ready/i)
    const agents = await source.readSnapshot("agents-tools")
    expect(agents.surface.knownEffects).toEqual(expect.arrayContaining([
      expect.stringMatching(/invokes configured agent executables/i),
    ]))
    expect(agents.agentModel).toMatchObject({
      kind: "agent-model-dashboard",
      product: { recordId: product.id, revision: product.revision },
      selection: { status: "selected", capabilityState: "stale", settings: { secretSetting: "[redacted]" } },
      limits: { runs: { shown: 1, total: 1, omitted: 0 }, handoffs: { shown: 0, total: 0, omitted: 0 } },
      providerMetrics: { usage: { state: "unavailable" }, cost: { state: "unavailable" } },
    })
    const agentModel = agents.agentModel
    if (!agentModel) throw new Error("Expected exact Agent/Model dashboard")
    const { snapshotDigest, ...agentModelContent } = agentModel
    expect(snapshotDigest).toBe(canonicalDigest(agentModelContent))
    expect(JSON.stringify(agentModel)).not.toContain("must-redact")
    expect(agents.phase1AgentModel).toMatchObject({
      kind: "phase-1-agent-model-dashboard",
      product: { recordId: product.id, revision: product.revision },
      initiative: { recordId: initiative.id, revision: initiative.revision, state: initiative.state },
      source: { scope: "exact-current-initiative" },
      executionTruth: {
        capabilities: { shown: 2, total: 2, omitted: 0, selected: 1 },
        runs: { shown: 1, total: 1, omitted: 0, terminal: 1, nonTerminal: 0 },
        handoffs: { shown: 0, total: 0, omitted: 0 },
        liveProviderQuality: "not-assessed",
        semanticOutputQuality: "not-assessed",
      },
      governance: { runLaunchAuthority: "not-granted", productOwnerAcceptance: "not-established" },
    })
    const phase1AgentModel = agents.phase1AgentModel
    if (!phase1AgentModel) throw new Error("Expected exact Phase 1 Agent/Model dashboard")
    const { snapshotDigest: phase1Digest, ...phase1Content } = phase1AgentModel
    expect(phase1Digest).toBe(canonicalDigest(phase1Content))
    expect(JSON.stringify(phase1AgentModel)).not.toContain("must-redact")
    const { source: phase2Source } = harness({ deliveryPhase: "phase-2-design" })
    const phase2Agents = await phase2Source.readSnapshot("agents-tools")
    expect(isStudioSnapshot(phase2Agents)).toBe(true)
    expect(phase2Agents.phase2ChangeImpactAgentModel).toMatchObject({
      kind: "phase-2-change-impact-agent-model-dashboard",
      product: { recordId: product.id, revision: product.revision },
      initiative: { recordId: initiative.id, revision: initiative.revision, state: initiative.state },
      synchronizationChange: { state: "attention-required", synchronizationEffectState: "not-applied" },
      impact: { coverage: "bounded-not-complete", impactCompleteness: "not-established", designValidity: "not-established" },
      agentModel: {
        capabilities: { shown: 2, total: 2, omitted: 0, selected: 1 },
        runs: { shown: 1, total: 1, omitted: 0, terminal: 1, nonTerminal: 0 },
        providerMetrics: { usage: "unavailable", cost: "unavailable" },
      },
      governance: { runLaunchAuthority: "not-granted", effectAuthority: "not-granted", productOwnerAcceptance: "not-established" },
    })
    const phase2Integrated = phase2Agents.phase2ChangeImpactAgentModel
    if (!phase2Integrated) throw new Error("Expected exact Phase 2 integrated dashboard")
    const { snapshotDigest: phase2IntegratedDigest, ...phase2IntegratedContent } = phase2Integrated
    expect(phase2IntegratedDigest).toBe(canonicalDigest(phase2IntegratedContent))
    expect(phase2Integrated.sources).toMatchObject({
      phase2UxFigmaSnapshotDigest: phase2Agents.phase2UxFigma?.snapshotDigest,
      agentModelSnapshotDigest: phase2Agents.phase1AgentModel?.agentModel.snapshotDigest,
    })
    expect(JSON.stringify(phase2Integrated)).not.toContain("must-redact")
    const tampered = structuredClone(agents)
    if (!tampered.phase1AgentModel) throw new Error("Expected Phase 1 Agent/Model dashboard to tamper")
    tampered.phase1AgentModel.executionTruth.runs.terminal = 0
    expect(isStudioSnapshot(tampered)).toBe(false)
  })

  it("composes an exact Phase 1 summary from current Initiative readiness and handoff projections", async () => {
    const { source, diagnostics } = harness({
      p0P4ReadinessGateProjection: p0P4ReadinessGateProjection(),
      p5HandoffPackageProjection: p5HandoffPackageProjection(),
    })
    const snapshot = await source.readSnapshot("trace")
    expect(isStudioSnapshot(snapshot)).toBe(true)
    expect(snapshot.phase1Summary).toMatchObject({
      kind: "phase-1-summary-readiness-dashboard",
      product: { recordId: product.id, revision: product.revision },
      initiative: { recordId: initiative.id, revision: initiative.revision, state: initiative.state },
      phaseStatus: {
        state: "attention-required",
        productOwnerAcceptance: "not-established",
        readinessAuthority: "not-established",
        phaseEntryAuthority: "not-established",
      },
      owners: { state: "unbound", boundOwnerCount: 0 },
    })
    const summary = snapshot.phase1Summary
    if (!summary) throw new Error("Expected an exact Phase 1 summary")
    const { snapshotDigest, ...content } = summary
    expect(snapshotDigest).toBe(canonicalDigest(content))
    const tampered = structuredClone(snapshot)
    if (!tampered.phase1Summary) throw new Error("Expected a Phase 1 summary to tamper")
    tampered.phase1Summary.limitations[0] = "Tampered after digest composition."
    expect(isStudioSnapshot(tampered)).toBe(false)
    expect(JSON.stringify(summary)).not.toContain(product.name)
    expect(JSON.stringify(summary)).not.toContain(initiative.title)
    expect(diagnostics).toEqual([])
  })

  it("composes a derived Phase 2 UX/Figma dashboard with explicit unavailable sources and no authority", async () => {
    const projection = designDriftDetectionProjection()
    const { source, diagnostics } = harness({
      deliveryPhase: "phase-2-design",
      designDriftDetectionProjection: projection,
    })
    const snapshot = await source.readSnapshot("overview")
    expect(isStudioSnapshot(snapshot)).toBe(true)
    expect(snapshot.dashboard).toMatchObject({ phase: { id: "phase-2-design" } })
    expect(snapshot.dashboard?.panels).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "ux-figma", state: "attention-required" }),
    ]))
    expect(snapshot.phase2UxFigma).toMatchObject({
      kind: "phase-2-ux-figma-dashboard",
      product: { recordId: product.id, revision: product.revision },
      initiative: { recordId: initiative.id, revision: initiative.revision, state: initiative.state },
      phaseStatus: {
        state: "attention-required",
        currentSourceCount: 0,
        attentionRequiredSourceCount: 1,
        unavailableSourceCount: 22,
        productOwnerAcceptance: "not-established",
        readinessAuthority: "not-established",
        phaseEntryAuthority: "not-established",
      },
      governance: {
        baselineDesignationState: "not-established",
        approvalState: "not-established",
        readinessState: "not-established",
        remediationEffectState: "not-applied",
      },
      figma: { connectionState: "not-established", writeExecutionState: "not-performed", importExecutionState: "not-performed" },
      drift: { observationCount: projection.status.observationCount, driftCount: projection.status.driftCount },
    })
    const dashboard = snapshot.phase2UxFigma
    if (!dashboard) throw new Error("Expected exact Phase 2 UX/Figma dashboard")
    const { snapshotDigest, ...content } = dashboard
    expect(snapshotDigest).toBe(canonicalDigest(content))
    expect(JSON.stringify(dashboard)).not.toContain(product.name)
    expect(JSON.stringify(dashboard)).not.toContain(initiative.title)
    const tampered = structuredClone(snapshot)
    if (!tampered.phase2UxFigma) throw new Error("Expected Phase 2 dashboard to tamper")
    tampered.phase2UxFigma.drift.driftCount += 1
    expect(isStudioSnapshot(tampered)).toBe(false)
    expect(diagnostics).toEqual([])
  })

  it("projects exact privacy-safe Source, candidate Baseline, and Provenance metadata on Delivery", async () => {
    const projection = sourceGovernanceProjection()
    const { source } = harness({ sourceGovernanceProjection: projection })
    const snapshot = await source.readSnapshot("delivery")

    expect(isStudioSnapshot(snapshot)).toBe(true)
    expect(snapshot.page).toMatchObject({
      kind: "delivery",
      sources: {
        rows: [{
          id: projection.sources[0]?.id,
          cells: {
            title: "Reviewed requirements source",
            owner: "human:local-actor-test",
            authority: "authoritative · VS Code Source workflow",
          },
        }],
      },
      sourceBaselines: {
        rows: [{
          id: projection.baselines[0]?.id,
          cells: {
            status: "current",
            boundary: "Candidate snapshot only; no approval, designation, authorization, or supersession.",
          },
        }],
      },
      sourceProvenance: {
        rows: [{
          id: projection.provenance[0]?.id,
          cells: {
            target: "claim",
            boundary: "Attributed lineage only; no approval, validation, authorization, or authority transfer.",
          },
        }],
      },
    })
    expect(JSON.stringify(snapshot)).not.toContain("sourceLocator")
  })

  it("projects privacy-safe governed business, stakeholder, and outcome metadata on their native pages", async () => {
    const projection = businessUnderstandingProjection()
    const { source } = harness({ businessUnderstandingProjection: projection })
    const direction = await source.readSnapshot("direction")
    const stakeholders = await source.readSnapshot("users-jobs")
    const outcomes = await source.readSnapshot("outcomes")

    expect(direction.page.kind === "record-form" && direction.page.relatedRecords?.[0]).toMatchObject({
      id: "business-understanding",
      rows: [{
        id: projection.businessUnderstanding?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          counts: "3 objectives · 2 constraints · 1 assumptions · 0 unresolved questions",
          assessment: "complete-for-review",
        },
      }],
    })
    expect(stakeholders.page.kind === "record-form" && stakeholders.page.relatedRecords?.[0]).toMatchObject({
      id: "stakeholder-model",
      rows: [{
        id: projection.stakeholderModel?.id,
        cells: {
          counts: "8 stakeholders · 8 represented categories · 0 unresolved categories · 0 verified authority claims",
        },
      }],
    })
    expect(outcomes.page.kind === "record-form" && outcomes.page.relatedRecords?.[0]).toMatchObject({
      id: "outcome-model",
      rows: [{
        id: projection.outcomeModel?.id,
        cells: {
          counts: "2 outcomes · 4 measures · 1 countermetrics · 1 burden measures · 4 observed baselines",
          boundary: "Candidate evidence only; no approval, appointment, decision, readiness, or action authority.",
        },
      }],
    })
    expect(JSON.stringify({ direction, stakeholders, outcomes })).not.toMatch(
      /personal assignment|business narrative|source content|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe governed capability-map metadata on the native architecture page", async () => {
    const projection = businessCapabilityMapProjection()
    const { source } = harness({ businessCapabilityMapProjection: projection })
    const snapshot = await source.readSnapshot("architecture")
    expect(snapshot.page.kind === "record-form" && snapshot.page.relatedRecords?.[0]).toMatchObject({
      id: "business-capability-map",
      rows: [{
        id: projection.capabilityMap?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          counts: "7 capabilities · 6 owned · 2 open gaps · 1 critical gaps · 6 candidate priorities",
          assessment: "attention-required",
          boundary: "Candidate architecture only; no priority approval, baseline, readiness, or action authority.",
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /capability narrative|personal assignment|source content|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe governed value-stream metadata on the native architecture page", async () => {
    const projection = valueStreamModelProjection()
    const { source } = harness({ valueStreamModelProjection: projection })
    const snapshot = await source.readSnapshot("architecture")
    expect(snapshot.page.kind === "record-form" && snapshot.page.relatedRecords?.[1]).toMatchObject({
      id: "value-stream-model",
      rows: [{
        id: projection.valueStreamModel?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          counts: "3 value streams · 2 owned · 9 stages · 2 dependencies · 2 open bottlenecks · 1 critical bottlenecks",
          assessment: "attention-required",
          boundary: "Candidate value flow only; no baseline, priority, readiness, or action authority.",
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /value-stream narrative|personal assignment|source content|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe governed operating-model metadata on the native architecture page", async () => {
    const projection = operatingModelProjection()
    const { source } = harness({ operatingModelProjection: projection })
    const snapshot = await source.readSnapshot("architecture")
    expect(snapshot.page.kind === "record-form" && snapshot.page.relatedRecords?.[2]).toMatchObject({
      id: "operating-model",
      rows: [{
        id: projection.operatingModel?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          counts: "6 roles · 8 decision rights · 2 forums · 3 cycles",
          assessment: "attention-required",
          gaps: "1 appointing · 2 capacity · 3 funding · 1 decision authority",
          boundary: "Candidate operating structure only; no appointment, funding, baseline, readiness, or action authority.",
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /operating narrative|personal assignment|source content|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe governed Business Rule metadata on the native architecture page", async () => {
    const projection = businessRuleCatalogProjection()
    const { source } = harness({ businessRuleCatalogProjection: projection })
    const snapshot = await source.readSnapshot("architecture")
    expect(snapshot.page.kind === "record-form" && snapshot.page.relatedRecords?.[3]).toMatchObject({
      id: "business-rule-catalog",
      rows: [{
        id: projection.businessRuleCatalog?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          counts: "7 rules · 4 targets · 2 exceptions · 3 non-exceptionable",
          assessment: "attention-required",
          gaps: "1 unassigned targets · 2 unverified targets · 1 exception authorities",
          boundary: "Candidate rules only; no policy evaluation, exception grant, deployed enforcement, baseline, readiness, or action authority.",
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /rule narrative|source content|personal data|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe governed Business Architecture Baseline metadata on the native architecture page", async () => {
    const projection = businessArchitectureBaselineProjection()
    const { source } = harness({ businessArchitectureBaselineProjection: projection })
    const snapshot = await source.readSnapshot("architecture")
    expect(snapshot.page.kind === "record-form" && snapshot.page.relatedRecords?.[4]).toMatchObject({
      id: "business-architecture-baseline",
      rows: [{
        id: projection.baseline?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          membership: projection.baseline?.membershipDigest,
          counts: "27 elements · 8 integration claims",
          assessment: "attention-required",
          gaps: "1 unresolved · 2 consistency gaps · 1 stale bindings",
          boundary: "Candidate compound snapshot only; no baseline designation, approval, readiness, exception grant, enforcement, or action authority.",
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /architecture narrative|source content|personal data|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe governed System/Solution Architecture metadata on the native architecture page", async () => {
    const projection = systemSolutionArchitectureProjection()
    const { source } = harness({ systemSolutionArchitectureProjection: projection })
    const snapshot = await source.readSnapshot("architecture")
    expect(snapshot.page.kind === "record-form" && snapshot.page.relatedRecords?.[5]).toMatchObject({
      id: "system-solution-architecture",
      rows: [{
        id: projection.architecture?.id,
        cells: {
          initiative: initiative.id,
          revision: "3",
          membership: projection.architecture?.membershipDigest,
          counts: "4 concerns · 3 views · 9 elements · 5 quality scenarios · 4 decisions",
          assessment: "attention-required",
          gaps: "1 quality gaps · 2 unresolved decisions · 1 conformance gaps · 1 lifecycle gaps · 1 stale bindings",
          boundary: "Candidate design only; no architecture-baseline designation, approval, readiness, proven conformance, technology mandate, or action authority.",
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /architecture narrative|source content|personal data|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe governed Bounded Context and Ownership metadata on the native architecture page", async () => {
    const projection = boundedContextModelProjection()
    const { source } = harness({ boundedContextModelProjection: projection })
    const snapshot = await source.readSnapshot("architecture")
    expect(snapshot.page.kind === "record-form" && snapshot.page.relatedRecords?.[6]).toMatchObject({
      id: "bounded-context-ownership",
      rows: [{
        id: projection.model?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          membership: projection.model?.membershipDigest,
          counts: "3 contexts · 4 contracts · 3 relationships",
          assessment: "attention-required",
          gaps: "1 contract gaps · 1 relationship gaps · 2 unassigned elements · 1 unowned data assets · 2 unmapped relations · 1 stale bindings",
          boundary: "Candidate boundaries and ownership traces only; no owner appointment, ownership acceptance, boundary approval, contract acceptance, readiness, or action authority.",
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /ubiquitous language|contract narrative|source content|personal data|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe governed Security, Privacy, and Threat metadata on the native architecture page", async () => {
    const projection = securityPrivacyAssessmentProjection()
    const { source } = harness({ securityPrivacyAssessmentProjection: projection })
    const snapshot = await source.readSnapshot("architecture")
    expect(snapshot.page.kind === "record-form" && snapshot.page.relatedRecords?.[7]).toMatchObject({
      id: "security-privacy-threat-assessment",
      rows: [{
        id: projection.assessment?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          membership: projection.assessment?.membershipDigest,
          counts: "4 assets · 3 trust boundaries · 2 data classes · 6 controls · 7 threats",
          assessment: "attention-required",
          gaps: "2 unresolved threats · 1 unverified controls · 1 processing-authority gaps · 0 uncovered elements · 1 unmapped relations · 3 requirement gaps · 1 stale bindings",
          boundary: "Candidate security, privacy, and threat coverage only; no threat-model approval, control-effectiveness attestation, risk acceptance, processing approval, security readiness, or action authority.",
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /threat scenario|control statement|data content|source content|personal data|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe governed Process Model metadata on the native architecture page", async () => {
    const projection = processModelProjection()
    const { source } = harness({ processModelProjection: projection })
    const snapshot = await source.readSnapshot("architecture")
    expect(snapshot.page.kind === "record-form" && snapshot.page.relatedRecords?.[8]).toMatchObject({
      id: "process-model",
      rows: [{
        id: projection.model?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          membership: projection.model?.membershipDigest,
          counts: "3 processes · 9 steps · 5 dimensions · 11 transitions · 8 events · 4 approval requirements",
          assessment: "attention-required",
          gaps: "1 uncovered value streams · 2 uncovered contexts · 3 uncovered rules · 4 requirement gaps · 1 inconsistencies · 2 unresolved questions · 1 stale bindings",
          boundary: "Candidate workflows, states, transitions, events, and approval requirements only; no workflow approval, transition or execution authority, operational readiness, baseline promotion, or action authority.",
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /process narrative|transition guards|approval content|source content|personal data|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe governed Data Model metadata on the native architecture page", async () => {
    const projection = dataModelProjection()
    const { source } = harness({ dataModelProjection: projection })
    const snapshot = await source.readSnapshot("architecture")
    expect(snapshot.page.kind === "record-form" && snapshot.page.relatedRecords?.[9]).toMatchObject({
      id: "data-model",
      rows: [{
        id: projection.model?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          membership: projection.model?.membershipDigest,
          counts: "6 entities · 24 attributes · 9 relationships · 4 lifecycles · 5 transformations",
          assessment: "attention-required",
          gaps: "1 uncovered contexts · 2 uncovered data classes · 3 uncovered processes · 1 unresolved systems of record · 2 unresolved transformations · 3 requirement gaps · 1 stale bindings",
          boundary: "Candidate entities, attributes, relationships, ownership, lifecycle, and transformations only; no Data Model or classification approval, ownership appointment, migration authority, operational readiness, baseline promotion, or action authority.",
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /entity attributes|relationship content|lifecycle content|source content|personal data|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe governed Authorization Model metadata on the native architecture page", async () => {
    const projection = authorizationModelProjection()
    const { source } = harness({ authorizationModelProjection: projection })
    const snapshot = await source.readSnapshot("architecture")
    expect(snapshot.page.kind === "record-form" && snapshot.page.relatedRecords?.[10]).toMatchObject({
      id: "authorization-model",
      rows: [{
        id: projection.model?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          membership: projection.model?.membershipDigest,
          counts: "5 principals · 6 role assignments · 7 resources · 8 actions · 3 approval bindings · 9 rules",
          assessment: "attention-required",
          gaps: "1 uncovered roles · 2 uncovered processes · 3 uncovered data entities · 4 unresolved identities · 5 unresolved rules · 6 requirement gaps · 1 stale bindings",
          boundary: "Candidate principals, role assignments, resources, actions, approval bindings, and authorization rules only; no identity verification, effective appointment, standing authority, authorization grant, enforcement decision, operational readiness, or action authority.",
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /principal@example\.com|private rule condition|private approval response|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe governed Event and Integration Model metadata on the native architecture page", async () => {
    const projection = eventIntegrationModelProjection()
    const { source } = harness({ eventIntegrationModelProjection: projection })
    const snapshot = await source.readSnapshot("architecture")
    expect(snapshot.page.kind === "record-form" && snapshot.page.relatedRecords?.[11]).toMatchObject({
      id: "event-integration-model",
      rows: [{
        id: projection.model?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          membership: projection.model?.membershipDigest,
          counts: "10 event types · 11 commands · 4 adapters · 5 external contracts · 6 mappings · 7 routes",
          assessment: "attention-required",
          gaps: "1 uncovered process events · 2 uncovered processes · 3 uncovered contexts · 4 uncovered data entities · 5 uncovered authorization actions · 6 unknown mapping truths · 7 requirement gaps · 1 stale bindings",
          boundary: "Candidate event types, commands, adapters, contracts, mappings, and routes only; no event occurrence, command delivery, external acceptance, adapter activation, authorization grant, effect execution, operational readiness, or action authority.",
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /private event payload|private command input|private mapping content|external locator|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe governed Failure and Recovery Model metadata on the native architecture page", async () => {
    const projection = failureRecoveryModelProjection()
    const { source } = harness({ failureRecoveryModelProjection: projection })
    const snapshot = await source.readSnapshot("architecture")
    expect(snapshot.page.kind === "record-form" && snapshot.page.relatedRecords?.[12]).toMatchObject({
      id: "failure-recovery-model",
      rows: [{
        id: projection.model?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          membership: projection.model?.membershipDigest,
          counts: "8 failure modes · 6 retry policies · 5 compensation plans · 4 recovery plans · 3 recovery evidence definitions",
          assessment: "attention-required",
          gaps: "1 uncovered processes · 2 uncovered commands · 3 uncovered routes · 4 uncovered authorization actions · 5 recovery evidence gaps · 6 requirement gaps · 1 stale bindings",
          boundary: "Candidate failure modes, retry policies, compensation plans, recovery plans, and evidence definitions only; no failure occurrence, retry safety, compensation or restoration, recovery success, return-to-service authority, operational readiness, or action authority.",
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /private failure evidence|private operational telemetry|private recovery steps|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe governed Architecture Challenge metadata on the native architecture page", async () => {
    const projection = architectureChallengeModelProjection()
    const { source } = harness({ architectureChallengeModelProjection: projection })
    const snapshot = await source.readSnapshot("architecture")
    expect(snapshot.page.kind === "record-form" && snapshot.page.relatedRecords?.[13]).toMatchObject({
      id: "architecture-challenge-model",
      rows: [{
        id: projection.model?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          membership: projection.model?.membershipDigest,
          counts: "3 challenge subjects · 4 assumptions · 5 alternatives · 6 findings · 2 responses",
          assessment: "attention-required",
          gaps: "4 unresponded findings · 2 unresolved assumptions · 1 requirement gaps · 1 stale bindings",
          boundary: "Candidate challenge subjects, assumptions, alternatives, findings, responses, and independence disclosures only; no completed independent review, assurance, risk acceptance, architecture approval, operational readiness, or action authority.",
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /private challenge content|private assumptions|private evidence|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe governed Design Applicability metadata on the native architecture page", async () => {
    const projection = designApplicabilityProjection()
    const { source } = harness({ designApplicabilityProjection: projection })
    const snapshot = await source.readSnapshot("architecture")
    expect(snapshot.page.kind === "record-form" && snapshot.page.relatedRecords?.at(-1)).toMatchObject({
      id: "design-applicability",
      rows: [{
        id: projection.candidate?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          membership: projection.candidate?.membershipDigest,
          coverage: "2 scopes · 8 explicit UX, UI, design-work, and Figma decisions",
          assessment: "attention-required · held",
          gaps: "1 unresolved decisions · 0 blocked decisions · 1 pending approvals · 0 rejected approvals · 1 unresolved depths · 1 unresolved sources · 2 questions · 0 stale bindings · 1 stale Source references",
          boundary: "Candidate guidance only; silence is never not applicable, and this does not approve design, establish a Design Baseline, grant readiness, authorize implementation, write, or action.",
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /private rationale|private source content|private journey|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe governed Design Personas and Roles metadata on the native users and jobs page", async () => {
    const projection = designPersonaRoleProjection()
    const { source } = harness({ designPersonaRoleProjection: projection })
    const snapshot = await source.readSnapshot("users-jobs")
    expect(snapshot.page.kind === "record-form" && snapshot.page.relatedRecords?.find((table) => table.id === "design-persona-role-model")).toMatchObject({
      id: "design-persona-role-model",
      rows: [{
        id: projection.candidate?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          membership: projection.candidate?.membershipDigest,
          coverage: "2 personas · 1 design roles · 4/5 participant categories · 1/4 role kinds",
          evidence: "1 human-reviewed personas · 1 weak-evidence personas",
          assessment: "attention-required · held",
          gaps: "1 unresolved participant categories · 1 unresolved role kinds · 2 questions · 0 stale bindings · 1 stale Source references",
          boundary: "Purpose-limited candidate persona hypotheses and design responsibilities only; no persona validation, role appointment, competence verification, design approval, readiness, write, or action authority.",
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /private persona behavior|private constraints|private source content|pilot-change-owner|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe governed User Journey metadata on the native users and jobs page", async () => {
    const projection = userJourneyProjection()
    const { source } = harness({ userJourneyProjection: projection })
    const snapshot = await source.readSnapshot("users-jobs")
    expect(snapshot.page.kind === "record-form" && snapshot.page.relatedRecords?.find((table) => table.id === "user-journey-model")).toMatchObject({
      id: "user-journey-model",
      rows: [{
        id: projection.candidate?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          membership: projection.candidate?.membershipDigest,
          inventory: "2 journeys · 3 touchpoints",
          paths: "2 primary · 2 success · 2 failure · 2 recovery",
          coverage: "1 represented scopes · 1 unresolved scopes",
          assessment: "attention-required · held",
          gaps: "2 weak-evidence paths · 2 questions · 0 stale bindings · 1 stale Source references",
          boundary: "Candidate journey structure and coverage metadata only; no observed-behavior proof, journey validation, design approval, readiness, write, or action authority.",
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /private journey step|private touchpoint|private persona|private source content|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe governed Information Architecture metadata on the native users and jobs page", async () => {
    const projection = informationArchitectureProjection()
    const { source } = harness({ informationArchitectureProjection: projection })
    const snapshot = await source.readSnapshot("users-jobs")
    expect(snapshot.page.kind === "record-form" && snapshot.page.relatedRecords?.find((table) => table.id === "information-architecture-model")).toMatchObject({
      id: "information-architecture-model",
      rows: [{
        id: projection.candidate?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          membership: projection.candidate?.membershipDigest,
          inventory: "6 nodes · 2 roots · 8 routes",
          coverage: "1 represented scopes · 1 unresolved scopes",
          assessment: "attention-required · held",
          gaps: "2 weak-evidence nodes · 1 weak-evidence routes · 2 questions · 0 stale bindings · 1 stale Source references",
          boundary: "Candidate hierarchy, content-model, and route metadata only; no findability, comprehension, accessibility, content, or design validation, readiness, write, or action authority.",
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /private node label|private route purpose|private persona|private source content|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe governed Screen and State Inventory metadata on the native users and jobs page", async () => {
    const projection = screenStateInventoryProjection()
    const { source } = harness({ screenStateInventoryProjection: projection })
    const snapshot = await source.readSnapshot("users-jobs")
    expect(snapshot.page.kind === "record-form" && snapshot.page.relatedRecords?.find((table) => table.id === "screen-state-inventory")).toMatchObject({
      id: "screen-state-inventory",
      rows: [{
        id: projection.candidate?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          membership: projection.candidate?.membershipDigest,
          inventory: "3 platforms · 9 screens · 18 states · 5 variants",
          coverage: "7 represented routes · 1 unresolved routes · 1 represented scopes · 1 unresolved scopes",
          assessment: "attention-required · held",
          gaps: "1 unresolved platforms · 2 weak-evidence items · 2 questions · 0 stale bindings · 1 stale Source references",
          boundary: "Candidate platform, screen, state, and variant counts only; no UI completeness, platform parity, state reachability, interaction quality, accessibility validation, design approval, readiness, write, or action authority.",
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /private screen label|private state|private variant|private route|private persona|private source content|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe governed Design Requirements metadata on the native scope page", async () => {
    const projection = designRequirementsProjection()
    const { source } = harness({ designRequirementsProjection: projection })
    const snapshot = await source.readSnapshot("scope")
    expect(snapshot.page.kind === "record-form" && snapshot.page.relatedRecords?.find((table) => table.id === "design-requirements")).toMatchObject({
      id: "design-requirements",
      rows: [{
        id: projection.candidate?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          membership: projection.candidate?.membershipDigest,
          inventory: "12 requirements · 5 must-priority · 10 Work Items",
          coverage: "4 represented outcomes · 1 unresolved outcomes · 8 backlog-linked · 2 not planned",
          assessment: "attention-required · held · not-assessed",
          gaps: "2 unresolved backlog links · 3 weak-evidence requirements · 2 questions · 0 stale bindings · 1 stale domain references · 1 stale Source references",
          boundary: "Candidate identities, counts, statuses, and digests only; no requirement, outcome, target, Work Item, Source, or personal content and no validity, completeness, priority approval, satisfaction, backlog commitment, design approval, readiness, implementation, write, or action authority.",
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /private requirement|private outcome|private work item|private design target|private source content|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe governed Design System and Token Contract metadata on the native scope page", async () => {
    const projection = designSystemTokenContractProjection()
    const { source } = harness({ designSystemTokenContractProjection: projection })
    const snapshot = await source.readSnapshot("scope")
    expect(snapshot.page.kind === "record-form" && snapshot.page.relatedRecords?.find((table) => table.id === "design-system-token-contract")).toMatchObject({
      id: "design-system-token-contract",
      rows: [{
        id: projection.candidate?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          membership: projection.candidate?.membershipDigest,
          inventory: "2 systems · 48 tokens · 3 collections · 19 variables · 12 components",
          coverage: "10 represented requirements · 2 unresolved requirements",
          assessment: "attention-required · held · not-assessed",
          gaps: "1 ownership gaps · 3 unresolved catalog items · 4 accessibility review gaps · 2 questions · 0 stale bindings · 1 stale portable snapshots · 2 stale Source references",
          boundary: "Candidate identities, counts, statuses, and digests only; no token values, component content, requirements, Source, design, or personal content and no system, token, variable, or component validity, ownership authority, accessibility validation, design approval, baseline, readiness, implementation, write, or action authority.",
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /private token value|private component content|private requirement|private source content|private design content|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe governed Accessibility Design Rules metadata on the native scope page", async () => {
    const projection = accessibilityDesignRulesProjection()
    const { source } = harness({ accessibilityDesignRulesProjection: projection })
    const snapshot = await source.readSnapshot("scope")
    expect(snapshot.page.kind === "record-form" && snapshot.page.relatedRecords?.find((table) => table.id === "accessibility-design-rules")).toMatchObject({
      id: "accessibility-design-rules",
      rows: [{
        id: projection.candidate?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          membership: projection.candidate?.membershipDigest,
          inventory: "12 targets · 18 rules · 24 checks",
          rules: "14 applicable · 2 not applicable · 2 unresolved",
          checks: "17 human-reviewed · 3 evidence-recorded · 4 not assessed · 1 contradicted",
          coverage: "10 represented requirements · 2 unresolved requirements",
          assessment: "attention-required · held · not-assessed",
          gaps: "1 ownership gaps · 3 questions · 0 stale bindings · 2 stale Source references",
          boundary: "Candidate identities, counts, statuses, and digests only; no rule procedures, evidence, requirements, Source, design, or personal content and no accessibility conformance, rule or check validity, legal compliance, ownership authority, design approval, baseline, readiness, implementation, write, or action authority.",
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /private rule procedure|private evidence|private requirement|private source content|private design content|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe governed Responsive and Multi-Platform Targets metadata on the native scope page", async () => {
    const projection = responsiveMultiPlatformTargetsProjection()
    const { source } = harness({ responsiveMultiPlatformTargetsProjection: projection })
    const snapshot = await source.readSnapshot("scope")
    expect(snapshot.page.kind === "record-form" && snapshot.page.relatedRecords?.find((table) => table.id === "responsive-multi-platform-targets")).toMatchObject({
      id: "responsive-multi-platform-targets",
      rows: [{
        id: projection.candidate?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          membership: projection.candidate?.membershipDigest,
          inventory: "3 platform targets · 7 breakpoints · 16 behaviors · 22 checks",
          behaviors: "13 applicable · 3 unresolved",
          checks: "16 human-reviewed · 2 evidence-recorded · 4 not assessed · 1 contradicted",
          coverage: "10 represented requirements · 2 unresolved requirements",
          assessment: "attention-required · held · targets candidate-complete · breakpoints candidate-complete · behaviors not-assessed",
          gaps: "1 ownership gaps · 3 questions · 0 stale bindings · 2 stale Source references",
          boundary: "Candidate identities, counts, statuses, and digests only; no breakpoint rules, behavior procedures, evidence, requirements, Source, design, or personal content and no responsive completeness, platform parity, breakpoint or behavior validity, accessibility conformance, ownership authority, design approval, baseline, readiness, implementation, write, or action authority.",
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /private breakpoint rule|private behavior procedure|private evidence|private requirement|private source content|private design content|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe governed Manual Figma Execution Path metadata on the native scope page", async () => {
    const projection = manualFigmaExecutionPathProjection()
    const { source } = harness({ manualFigmaExecutionPathProjection: projection })
    const snapshot = await source.readSnapshot("scope")
    expect(snapshot.page.kind === "record-form" && snapshot.page.relatedRecords?.find((table) => table.id === "manual-figma-execution-path")).toMatchObject({
      id: "manual-figma-execution-path",
      rows: [{
        id: projection.candidate?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          membership: projection.candidate?.membershipDigest,
          inventory: "3 scopes · 5 instruction stages · 24 checks",
          checks: "18 human-reviewed · 2 evidence-recorded · 4 not assessed · 1 contradicted",
          coverage: "10 represented requirements · 2 unresolved requirements",
          assessment: "attention-required · held · guide candidate-complete · handoff candidate-complete · return not-assessed",
          gaps: "1 ownership gaps · 3 questions · 0 stale bindings · 2 stale Source references",
          boundary: "Candidate identities, counts, statuses, and digests only; no handoff content, instructions, Figma identifiers, returned design, evidence, requirements, Source, or personal content and no Figma connection, execution, return completeness, write authority, design approval, baseline, readiness, implementation, or action authority.",
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /private handoff content|private instructions|private figma identifiers|private returned design|private source content|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe governed Figma MCP Capability Discovery metadata on the native scope page", async () => {
    const projection = figmaMcpCapabilityDiscoveryProjection()
    const { source } = harness({ figmaMcpCapabilityDiscoveryProjection: projection })
    const snapshot = await source.readSnapshot("scope")
    expect(snapshot.page.kind === "record-form" && snapshot.page.relatedRecords?.find((table) => table.id === "figma-mcp-capability-discovery")).toMatchObject({
      id: "figma-mcp-capability-discovery",
      rows: [{
        id: projection.candidate?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          membership: projection.candidate?.membershipDigest,
          inventory: "7 tool observations · 5 advertised · 1 not advertised · 1 unknown",
          effects: "3 read · 2 write · 1 unknown",
          evidence: "4 human-reviewed · 2 source-recorded · 1 not assessed",
          catalogs: "permissions candidate-separated · limits not-assessed · versions not-assessed",
          assessment: "attention-required · held · catalog candidate-observation-complete",
          gaps: "2 permission gaps · 1 limit gaps · 3 version gaps · 1 ownership gaps · 3 questions · 0 stale bindings · 2 stale Source references",
          boundary: "Candidate identities, counts, statuses, and digests only; no tool names, schemas, permissions, limits, versions, Source, personal, secret, credential, or Figma content and no Figma connection or call, credential request, permission grant, compatibility claim, write authority, design approval, baseline, readiness, implementation, or action authority.",
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /private tool name|private schema|private permission|private limit|private version|private source content|private figma content|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe governed Figma Read Snapshot metadata on the native scope page", async () => {
    const projection = figmaReadSnapshotProjection()
    const { source } = harness({ figmaReadSnapshotProjection: projection })
    const snapshot = await source.readSnapshot("scope")
    expect(snapshot.page.kind === "record-form" && snapshot.page.relatedRecords?.find((table) => table.id === "figma-read-snapshot")).toMatchObject({
      id: "figma-read-snapshot",
      rows: [{
        id: projection.candidate?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          membership: projection.candidate?.membershipDigest,
          inventory: "2 files · 12 components · 3 variable collections · 18 variables",
          evidence: "25 human-reviewed · 5 source-recorded · 5 not assessed",
          freshness: "1 stale at capture · 1 unknown freshness · 2 unresolved variable types",
          assessment: "attention-required · held · snapshot partial · provenance partial",
          gaps: "1 ownership gaps · 3 questions · 0 stale bindings · 2 stale Source references",
          boundary: "Candidate identities, counts, statuses, and digests only; no Figma file, component, collection, variable, external identity, value, Source, personal, secret, credential, or permission content and no Figma connection or call, credential request, permission grant, external completeness claim, write authority, design validation or approval, baseline, readiness, implementation, or action authority.",
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /private figma file|private component|private collection|private variable|private external identity|private value|private source content|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe governed Figma Context Import metadata on the native scope page", async () => {
    const projection = figmaContextImportProjection()
    const { source } = harness({ figmaContextImportProjection: projection })
    const snapshot = await source.readSnapshot("scope")
    expect(snapshot.page.kind === "record-form" && snapshot.page.relatedRecords?.find((table) => table.id === "figma-context-import")).toMatchObject({
      id: "figma-context-import",
      rows: [{
        id: projection.candidate?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          membership: projection.candidate?.membershipDigest,
          selection: "2 Context Packs · 8 sections · 24 Context Items · 2 Figma targets",
          evidence: "5 human-reviewed · 2 source-recorded · 1 not assessed · 1 redaction gaps",
          requirements: "7 represented · 2 unresolved",
          assessment: "attention-required · held · selection partial · provenance partial · preview candidate-generated",
          gaps: "1 ownership gaps · 3 questions · 0 stale bindings · 2 stale Source references",
          boundary: "Candidate identities, counts, statuses, and digests only; no brief, Requirement, constraint, Context Item, Figma target, tool, Source, personal, secret, credential, or permission content and no context packaging or transfer, Figma connection or call, credential request, permission grant, write, target or design validation, design approval, baseline, readiness, implementation, or action authority.",
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /private brief|private requirement|private constraint|private context item|private figma target|private tool|private source content|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe governed Outbound Design Brief Package metadata on the native scope page", async () => {
    const projection = outboundDesignBriefPackageProjection()
    const { source } = harness({ outboundDesignBriefPackageProjection: projection })
    const snapshot = await source.readSnapshot("scope")
    expect(snapshot.page.kind === "record-form" && snapshot.page.relatedRecords?.find((table) => table.id === "outbound-design-brief-package")).toMatchObject({
      id: "outbound-design-brief-package",
      rows: [{
        id: projection.candidate?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          membership: projection.candidate?.membershipDigest,
          receipts: `gaep-outbound-design-brief-package-v1 · manifest ${projection.candidate?.manifestDigest} · payload ${projection.candidate?.payloadDigest}`,
          inventory: "2 Context Packs · 8 entries · 24 Context Items · 2 recipients",
          evidence: "5 human-reviewed · 2 source-recorded · 1 not assessed · 1 redaction gaps",
          requirements: "7 represented · 2 unresolved · 3 unresolved disclosures",
          assessment: "attention-required · held · manifest partial · provenance partial · redaction partial · preview candidate-generated",
          gaps: "3 questions · 0 stale bindings · 2 stale Source references",
          boundary: "Candidate identities, counts, statuses, and digests only; no brief, Requirement, constraint, Context Item, Figma target, tool, Source, transformation, disclosure, personal, secret, credential, or permission content and no package materialization or context transfer, Figma connection or call, credential request, permission grant, write, target or design validation, design approval, baseline, readiness, implementation, or action authority.",
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /private brief|private requirement|private constraint|private context item|private figma target|private tool|private transformation|private disclosure|private source content|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe Governed Figma Write authorization-review metadata on the native scope page", async () => {
    const projection = governedFigmaWriteProjection()
    const { source } = harness({ governedFigmaWriteProjection: projection })
    const snapshot = await source.readSnapshot("scope")
    expect(snapshot.page.kind === "record-form" && snapshot.page.relatedRecords?.find((table) => table.id === "governed-figma-write")).toMatchObject({
      id: "governed-figma-write",
      rows: [{
        id: projection.candidate?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          membership: projection.candidate?.membershipDigest,
          receipts: `gaep-governed-figma-write-request-v1 · request ${projection.candidate?.requestDigest} · effect ${projection.candidate?.effectDigest} · preview ${projection.candidate?.previewDigest}`,
          package: `${projection.candidate?.outboundPackage.recordId} · r2 · manifest ${projection.candidate?.outboundPackage.manifestDigest} · payload ${projection.candidate?.outboundPackage.payloadDigest}`,
          target: `file ${projection.candidate?.externalFileIdentityDigest} · expected version ${projection.candidate?.expectedExternalVersionDigest} · 8 selected entries`,
          governance: "preview candidate-generated · approval pending · permission evidence missing · idempotency defined/defined · recovery defined",
          assessment: "attention-required · held · plan held · execution not-performed · result not-recorded",
          gaps: "2 disclosures · 3 questions · 1 stale bindings · 2 stale Source references",
          boundary: "Candidate identities, counts, statuses, and digests only; no brief, Requirement, constraint, Context Item, Figma target, tool, Source, approval actor, permission evidence, recovery detail, personal, secret, or credential content and no package materialization or transfer, Figma connection or call, credential request, permission grant, write authorization or execution, target or design validation, design approval, baseline, readiness, implementation, or action authority.",
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /private brief|private requirement|private constraint|private context item|private figma target|private tool|private approval actor|private permission evidence|private recovery detail|private source content|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe Finalized Figma Snapshot Import metadata on the native scope page", async () => {
    const projection = finalizedFigmaSnapshotImportProjection()
    const { source } = harness({ finalizedFigmaSnapshotImportProjection: projection })
    const snapshot = await source.readSnapshot("scope")
    expect(snapshot.page.kind === "record-form" && snapshot.page.relatedRecords?.find((table) => table.id === "finalized-figma-snapshot-import")).toMatchObject({
      id: "finalized-figma-snapshot-import",
      rows: [{
        id: projection.candidate?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          membership: projection.candidate?.membershipDigest,
          governedWrite: `${projection.candidate?.governedWrite.recordId} · r2 · request ${projection.candidate?.governedWrite.requestDigest} · effect ${projection.candidate?.governedWrite.effectDigest}`,
          receipts: `file ${projection.candidate?.externalFileIdentityDigest} · returned version ${projection.candidate?.returnedExternalVersionDigest} · payload ${projection.candidate?.payloadDigest} · receipt ${projection.candidate?.receiptDigest}`,
          inventory: `18 items · 4 conflicts · reconciliation ${projection.candidate?.reconciliationDigest}`,
          governance: "return authorization missing · reconciliation partial · provenance partial · completeness partial",
          assessment: "attention-required · held · execution not-performed · result not-recorded",
          gaps: "4 source-recorded items · 2 unassessed items · 3 open conflicts · 5 questions · 1 stale bindings · 2 stale Source references",
          boundary: "Candidate identities, counts, statuses, and digests only; no Figma content, names, external identities, Source content, authorization actor, personal, secret, credential, or permission content and no content transfer or import, Figma connection or call, credential request, permission grant, external-completeness proof, target or design validation, design approval, baseline, readiness, implementation, or action authority.",
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /private figma content|private figma name|private external identity|private authorization actor|private source content|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe Design-to-Requirement Binding metadata on the native scope page", async () => {
    const projection = designToRequirementBindingProjection()
    const { source } = harness({ designToRequirementBindingProjection: projection })
    const snapshot = await source.readSnapshot("scope")
    expect(snapshot.page.kind === "record-form" && snapshot.page.relatedRecords?.find((table) => table.id === "design-to-requirement-binding")).toMatchObject({
      id: "design-to-requirement-binding",
      rows: [{
        id: projection.candidate?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          membership: projection.candidate?.membershipDigest,
          dependencies: `snapshot ${projection.candidate?.finalizedSnapshot.recordId} · r2 · Requirements ${projection.candidate?.designRequirements.recordId} · r3 · Decisions ${projection.candidate?.decisionRegister.recordId} · r4`,
          catalogs: `items ${projection.candidate?.finalizedSnapshot.itemCatalogDigest} · Requirements ${projection.candidate?.designRequirements.requirementCatalogDigest} · Decisions ${projection.candidate?.decisionRegister.decisionCatalogDigest}`,
          inventory: "7 bindings · 4 design items · 5 governed subjects · 3 conflicts",
          governance: "reconciliation partial · candidate coverage partial · provenance exact",
          assessment: "attention-required · held · 5/7 human-reviewed bindings",
          gaps: "1 unbound design items · 1 unbound Requirements · 1 unbound Decisions · 2 open conflicts · 3 questions · 1 stale bindings · 2 stale Source references",
          boundary: "Candidate identities, exact dependency and catalog digests, counts, and statuses only; no Figma content, external identities, Requirement text, Decision content, Source content, human attribution, personal, secret, credential, or permission content and no relationship-truth or coverage-completeness proof, Requirement satisfaction, Decision effectiveness, external-completeness proof, design validation, approval, baseline, readiness, Figma connection or call, credential request, permission grant, import or write execution, implementation, or action authority.",
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /private figma content|private external identity|private requirement text|private decision content|private source content|private human attribution|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe Designer-Ready Gate metadata on the native readiness page", async () => {
    const projection = designerReadyGateProjection()
    const { source } = harness({ designerReadyGateProjection: projection })
    const snapshot = await source.readSnapshot("readiness")
    expect(snapshot.page.kind === "readiness" && snapshot.page.designerReadyGates).toMatchObject({
      id: "designer-ready-gate",
      rows: [{
        id: projection.candidate?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          membership: projection.candidate?.membershipDigest,
          prerequisites: `12 exact prerequisites · ${projection.candidate?.prerequisiteCatalogDigest}`,
          assessment: `definition ${projection.candidate?.assessmentDefinitionDigest} · receipt ${projection.candidate?.assessmentReceiptDigest} · evaluations ${projection.candidate?.evaluationCatalogDigest}`,
          exceptions: projection.candidate?.exceptionCatalogDigest,
          result: "incomplete · attention-required · held",
          coverage: "9 satisfied · 1 not-applicable candidates · 10/12 human-reviewed",
          gaps: "1 unsatisfied · 1 not assessed · 2 stale/unknown · 1 pending exceptions · 1 invalid exceptions · 4 questions · 2 stale bindings · 3 stale Source references",
          boundary: expect.stringContaining("passing candidate is an evaluation result, not permission or readiness"),
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /private design content|private criteria|private finding|private exception rationale|private decision content|private source content|private human attribution|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe Design Delta metadata on the native readiness page", async () => {
    const projection = designDeltaProjection()
    const { source } = harness({ designDeltaProjection: projection })
    const snapshot = await source.readSnapshot("readiness")
    expect(snapshot.page.kind === "readiness" && snapshot.page.designDeltas).toMatchObject({
      id: "design-delta",
      rows: [{
        id: projection.candidate?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          membership: projection.candidate?.membershipDigest,
          dependencies: `Designer-Ready ${projection.candidate?.designerReadyGate.recordId} · r2 · finalized snapshot ${projection.candidate?.finalizedSnapshot.recordId} · r2 · design binding ${projection.candidate?.designBinding.recordId} · r2`,
          snapshots: `source ${projection.candidate?.sourceSnapshotDigest} · target ${projection.candidate?.targetSnapshotDigest}`,
          comparison: `definition ${projection.candidate?.comparisonDefinitionDigest} · receipt ${projection.candidate?.comparisonReceiptDigest} · catalog ${projection.candidate?.deltaCatalogDigest}`,
          result: "conflict-candidate · attention-required · held",
          inventory: "12 source items · 14 target items · 6 deltas",
          deltas: "2 added · 1 changed · 1 conflicting · 1 missing · 1 stale · 0 unmapped · 3/6 human-reviewed",
          governance: "comparison partial · provenance partial",
          gaps: "2 unresolved mappings · 3 questions · 1 stale bindings · 2 stale Source references",
          boundary: expect.stringContaining("no delta completeness"),
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /private design content|private delta content|private external identity|private evidence content|private source content|private human attribution|customer@example\.com|api_key/iu,
    )
  })

  it("fails closed when Design Delta metadata is unavailable or binds a different exact Product", async () => {
    const unavailable = harness({ designDeltaProjectionError: new Error("private upstream failure") })
    const unavailableSnapshot = await unavailable.source.readSnapshot("readiness")
    expect(unavailableSnapshot.page.kind === "readiness" && unavailableSnapshot.page.designDeltas.rows).toEqual([])
    expect(unavailableSnapshot.page.kind === "readiness" && unavailableSnapshot.page.gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: `design-delta-${initiative.id}-unavailable`, severity: "warning" }),
    ]))
    expect(unavailable.diagnostics.join(" ")).not.toContain("private upstream failure")

    const projection = designDeltaProjection()
    const body = { ...projection, product: { ...projection.product, digest: `sha256:${"a".repeat(64)}` as const } }
    const mismatched = harness({ designDeltaProjection: { ...body, snapshotDigest: canonicalDigest(body) } })
    const mismatchedSnapshot = await mismatched.source.readSnapshot("readiness")
    expect(mismatchedSnapshot.page.kind === "readiness" && mismatchedSnapshot.page.designDeltas.rows).toEqual([])
    expect(mismatched.diagnostics).toEqual(expect.arrayContaining([
      expect.stringContaining("did not bind the exact Product and Initiative revisions"),
    ]))
  })

  it("withholds Design Delta metadata when the audit chain is invalid", async () => {
    const { source } = harness({ audit: { valid: false, events: 1 }, designDeltaProjection: designDeltaProjection() })
    const snapshot = await source.readSnapshot("readiness")
    expect(snapshot.page.kind === "readiness" && snapshot.page.designDeltas.rows).toEqual([])
    expect(snapshot.page.kind === "readiness" && snapshot.page.gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "design-delta-unavailable", severity: "blocker" }),
    ]))
  })

  it("projects privacy-safe Design Conflict Resolution metadata on the native readiness page", async () => {
    const projection = designConflictResolutionProjection()
    const { source } = harness({ designConflictResolutionProjection: projection })
    const snapshot = await source.readSnapshot("readiness")
    expect(snapshot.page.kind === "readiness" && snapshot.page.designConflictResolutions).toMatchObject({
      id: "design-conflict-resolution",
      rows: [{
        id: projection.candidate?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          membership: projection.candidate?.membershipDigest,
          designDelta: `${projection.candidate?.designDelta.recordId} · r2 · 5 conflicts · catalog ${projection.candidate?.designDelta.deltaCatalogDigest}`,
          evidence: `definition ${projection.candidate?.resolutionDefinitionDigest} · receipt ${projection.candidate?.resolutionReceiptDigest} · catalog ${projection.candidate?.resolutionCatalogDigest}`,
          result: "escalation-plan-candidate · attention-required · held",
          inventory: "5 conflicts · 4 resolution candidates",
          actions: "1 accept source · 1 accept target · 1 merge · 0 reject change · 1 escalate",
          review: "3/4 human-reviewed · 2 distinct-actor declarations · 1 expired",
          governance: "coverage partial · provenance partial · separation of duties not enforced",
          gaps: "1 unresolved conflicts · 2 questions · 1 stale bindings · 2 stale Source references",
          boundary: expect.stringContaining("does not enforce separation of duties"),
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /private design content|private delta content|private resolution content|private evidence content|private source content|private human attribution|customer@example\.com|api_key/iu,
    )
  })

  it("fails closed when Design Conflict Resolution metadata is unavailable or binds a different exact Product", async () => {
    const unavailable = harness({ designConflictResolutionProjectionError: new Error("private upstream failure") })
    const unavailableSnapshot = await unavailable.source.readSnapshot("readiness")
    expect(unavailableSnapshot.page.kind === "readiness" && unavailableSnapshot.page.designConflictResolutions.rows).toEqual([])
    expect(unavailableSnapshot.page.kind === "readiness" && unavailableSnapshot.page.gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: `design-conflict-resolution-${initiative.id}-unavailable`, severity: "warning" }),
    ]))
    expect(unavailable.diagnostics.join(" ")).not.toContain("private upstream failure")

    const projection = designConflictResolutionProjection()
    const body = { ...projection, product: { ...projection.product, digest: `sha256:${"a".repeat(64)}` as const } }
    const mismatched = harness({ designConflictResolutionProjection: { ...body, snapshotDigest: canonicalDigest(body) } })
    const mismatchedSnapshot = await mismatched.source.readSnapshot("readiness")
    expect(mismatchedSnapshot.page.kind === "readiness" && mismatchedSnapshot.page.designConflictResolutions.rows).toEqual([])
    expect(mismatched.diagnostics).toEqual(expect.arrayContaining([
      expect.stringContaining("did not bind the exact Product and Initiative revisions"),
    ]))
  })

  it("withholds Design Conflict Resolution metadata when the audit chain is invalid", async () => {
    const { source } = harness({
      audit: { valid: false, events: 1 },
      designConflictResolutionProjection: designConflictResolutionProjection(),
    })
    const snapshot = await source.readSnapshot("readiness")
    expect(snapshot.page.kind === "readiness" && snapshot.page.designConflictResolutions.rows).toEqual([])
    expect(snapshot.page.kind === "readiness" && snapshot.page.gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "design-conflict-resolution-unavailable", severity: "blocker" }),
    ]))
  })

  it("projects privacy-safe Human Design Approval metadata on the native readiness page", async () => {
    const projection = humanDesignApprovalProjection()
    const { source } = harness({ humanDesignApprovalProjection: projection })
    const snapshot = await source.readSnapshot("readiness")
    expect(snapshot.page.kind === "readiness" && snapshot.page.humanDesignApprovals).toMatchObject({
      id: "human-design-approval",
      rows: [{
        id: projection.candidate?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          membership: projection.candidate?.membershipDigest,
          subject: `${projection.candidate?.subject.recordId} · r2 · returned version ${projection.candidate?.subject.returnedExternalVersionDigest} · 18 items`,
          scope: `${projection.candidate?.scopeDigest} · exact finalized snapshot`,
          evidence: `definition ${projection.candidate?.decisionDefinitionDigest} · receipt ${projection.candidate?.decisionReceiptDigest}`,
          decision: `approve-candidate · active-candidate · ${projection.candidate?.decisionDigest}`,
          result: "approved-candidate · attention-required · recorded-human-decision",
          prerequisites: "4/5 complete",
          governance: "approver authority not-established · separation enforcement not-established",
          gaps: "1 expired · 0 revoked · 3 questions · 1 stale bindings · 2 stale Source references",
          boundary: expect.stringContaining("does not verify approver authority"),
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /private design content|private decision rationale|private condition|private evidence|private source content|private human attribution|customer@example\.com|api_key/iu,
    )
  })

  it("fails closed when Human Design Approval metadata is unavailable, mismatched, or audit-invalid", async () => {
    const unavailable = harness({ humanDesignApprovalProjectionError: new Error("private upstream failure") })
    const unavailableSnapshot = await unavailable.source.readSnapshot("readiness")
    expect(unavailableSnapshot.page.kind === "readiness" && unavailableSnapshot.page.humanDesignApprovals.rows).toEqual([])
    expect(unavailableSnapshot.page.kind === "readiness" && unavailableSnapshot.page.gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: `human-design-approval-${initiative.id}-unavailable`, severity: "warning" }),
    ]))
    expect(unavailable.diagnostics.join(" ")).not.toContain("private upstream failure")

    const projection = humanDesignApprovalProjection()
    const body = { ...projection, product: { ...projection.product, digest: `sha256:${"0".repeat(64)}` as const } }
    const mismatched = harness({ humanDesignApprovalProjection: { ...body, snapshotDigest: canonicalDigest(body) } })
    const mismatchedSnapshot = await mismatched.source.readSnapshot("readiness")
    expect(mismatchedSnapshot.page.kind === "readiness" && mismatchedSnapshot.page.humanDesignApprovals.rows).toEqual([])
    expect(mismatched.diagnostics).toEqual(expect.arrayContaining([
      expect.stringContaining("did not bind the exact Product and Initiative revisions"),
    ]))

    const invalidAudit = harness({
      audit: { valid: false, events: 1 },
      humanDesignApprovalProjection: humanDesignApprovalProjection(),
    })
    const invalidAuditSnapshot = await invalidAudit.source.readSnapshot("readiness")
    expect(invalidAuditSnapshot.page.kind === "readiness" && invalidAuditSnapshot.page.humanDesignApprovals.rows).toEqual([])
    expect(invalidAuditSnapshot.page.kind === "readiness" && invalidAuditSnapshot.page.gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "human-design-approval-unavailable", severity: "blocker" }),
    ]))
  })

  it("projects privacy-safe Design Baseline version metadata on the native readiness page", async () => {
    const projection = designBaselineProjection()
    const { source } = harness({ designBaselineProjection: projection })
    const snapshot = await source.readSnapshot("readiness")
    expect(snapshot.page.kind === "readiness" && snapshot.page.designBaselines).toMatchObject({
      id: "design-baseline",
      rows: [{
        id: projection.candidate?.id,
        cells: {
          initiative: initiative.id,
          revision: "3",
          membership: projection.candidate?.membershipDigest,
          approval: `${projection.candidate?.humanDesignApproval.recordId} · r2 · complete-for-recorded-decision`,
          subject: `${projection.candidate?.subject.recordId} · r2 · returned version ${projection.candidate?.subject.returnedExternalVersionDigest} · 18 items`,
          scope: `${projection.candidate?.scopeDigest} · exact finalized snapshot`,
          lineage: `${projection.candidate?.baselineLineageId} · set ${projection.candidate?.candidateSetId} r3`,
          version: `2.0.0 · policy ${projection.candidate?.versionPolicyDigest}`,
          evidence: `definition ${projection.candidate?.designationDefinitionDigest} · receipt ${projection.candidate?.designationReceiptDigest}`,
          designation: `supersede-baseline-candidate · ${projection.candidate?.designationDigest}`,
          predecessor: `${projection.candidate?.supersedes?.recordId} · r2 · 1.0.0`,
          result: "supersession-candidate · attention-required · ready-for-human-review",
          governance: "approval determination not-established · baseline designation not-established",
          gaps: "1 expired · 4 questions · 2 stale bindings · 3 stale Source references",
          boundary: expect.stringContaining("does not convert an approval candidate into approval"),
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /private design content|private rationale|private evidence|private source content|private human attribution|customer@example\.com|api_key/iu,
    )
  })

  it("fails closed when Design Baseline metadata is unavailable, mismatched, or audit-invalid", async () => {
    const unavailable = harness({ designBaselineProjectionError: new Error("private upstream failure") })
    const unavailableSnapshot = await unavailable.source.readSnapshot("readiness")
    expect(unavailableSnapshot.page.kind === "readiness" && unavailableSnapshot.page.designBaselines.rows).toEqual([])
    expect(unavailableSnapshot.page.kind === "readiness" && unavailableSnapshot.page.gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: `design-baseline-${initiative.id}-unavailable`, severity: "warning" }),
    ]))
    expect(unavailable.diagnostics.join(" ")).not.toContain("private upstream failure")

    const projection = designBaselineProjection()
    const body = { ...projection, product: { ...projection.product, digest: `sha256:${"0".repeat(64)}` as const } }
    const mismatched = harness({ designBaselineProjection: { ...body, snapshotDigest: canonicalDigest(body) } })
    const mismatchedSnapshot = await mismatched.source.readSnapshot("readiness")
    expect(mismatchedSnapshot.page.kind === "readiness" && mismatchedSnapshot.page.designBaselines.rows).toEqual([])
    expect(mismatched.diagnostics).toEqual(expect.arrayContaining([
      expect.stringContaining("did not bind the exact Product and Initiative revisions"),
    ]))

    const invalidAudit = harness({
      audit: { valid: false, events: 1 },
      designBaselineProjection: designBaselineProjection(),
    })
    const invalidAuditSnapshot = await invalidAudit.source.readSnapshot("readiness")
    expect(invalidAuditSnapshot.page.kind === "readiness" && invalidAuditSnapshot.page.designBaselines.rows).toEqual([])
    expect(invalidAuditSnapshot.page.kind === "readiness" && invalidAuditSnapshot.page.gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "design-baseline-unavailable", severity: "blocker" }),
    ]))
  })

  it("projects privacy-safe Design Drift Detection metadata on the native readiness page", async () => {
    const projection = designDriftDetectionProjection()
    const { source } = harness({ designDriftDetectionProjection: projection })
    const snapshot = await source.readSnapshot("readiness")
    expect(snapshot.page.kind === "readiness" && snapshot.page.designDriftDetections).toMatchObject({
      id: "design-drift-detection",
      rows: [{
        id: projection.candidate?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          baseline: `${projection.candidate?.designBaseline.recordId} · r1 · 1.1.0 · candidate only`,
          returnedDesign: `${projection.candidate?.returnedFigmaSnapshot.recordId} · r3 · returned version ${projection.candidate?.returnedFigmaSnapshot.returnedExternalVersionDigest}`,
          targets: `catalog r2 · ${projection.candidate?.implementationTargetCatalogDigest} · 4/5 human-reviewed`,
          paths: "4 requirement→design · 5 design→implementation",
          classifications: "3 conformant · 5 drift · 1 unassessed",
          severity: "1 blocker · 2 high",
          remediation: "4 candidates · 1 expired · effects not applied",
          result: "incomplete · attention-required · held",
          gaps: "1 questions · 2 stale bindings · 3 stale Source references",
          boundary: expect.stringContaining("does not establish an actual Baseline Set"),
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /private design content|private requirement|private implementation|private source content|customer@example\.com|api_key/iu,
    )
  })

  it("fails closed when Design Drift Detection metadata is unavailable, mismatched, or audit-invalid", async () => {
    const unavailable = harness({ designDriftDetectionProjectionError: new Error("private upstream failure") })
    const unavailableSnapshot = await unavailable.source.readSnapshot("readiness")
    expect(unavailableSnapshot.page.kind === "readiness" && unavailableSnapshot.page.designDriftDetections.rows).toEqual([])
    expect(unavailableSnapshot.page.kind === "readiness" && unavailableSnapshot.page.gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: `design-drift-detection-${initiative.id}-unavailable`, severity: "warning" }),
    ]))
    expect(unavailable.diagnostics.join(" ")).not.toContain("private upstream failure")

    const projection = designDriftDetectionProjection()
    const body = { ...projection, product: { ...projection.product, digest: `sha256:${"0".repeat(64)}` as const } }
    const mismatched = harness({ designDriftDetectionProjection: { ...body, snapshotDigest: canonicalDigest(body) } })
    const mismatchedSnapshot = await mismatched.source.readSnapshot("readiness")
    expect(mismatchedSnapshot.page.kind === "readiness" && mismatchedSnapshot.page.designDriftDetections.rows).toEqual([])
    expect(mismatched.diagnostics).toEqual(expect.arrayContaining([
      expect.stringContaining("Design Drift Detection projection was unavailable or did not bind the exact Product and Initiative revisions"),
    ]))

    const invalidAudit = harness({
      audit: { valid: false, events: 1 },
      designDriftDetectionProjection: designDriftDetectionProjection(),
    })
    const invalidAuditSnapshot = await invalidAudit.source.readSnapshot("readiness")
    expect(invalidAuditSnapshot.page.kind === "readiness" && invalidAuditSnapshot.page.designDriftDetections.rows).toEqual([])
    expect(invalidAuditSnapshot.page.kind === "readiness" && invalidAuditSnapshot.page.gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "design-drift-detection-unavailable", severity: "blocker" }),
    ]))
  })

  it("projects privacy-safe governed Decision Register metadata on the native risks and decisions page", async () => {
    const projection = decisionRegisterProjection()
    const { source } = harness({ decisionRegisterProjection: projection })
    const snapshot = await source.readSnapshot("risks-decisions")
    expect(snapshot.page.kind === "risks-decisions" && snapshot.page.decisionRegisters).toMatchObject({
      id: "decision-register",
      rows: [{
        id: projection.register?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          membership: projection.register?.membershipDigest,
          counts: "7 decisions",
          assessment: "attention-required",
          gaps: "2 unresolved decisions · 3 selected pending decisions · 1 deferred decisions · 1 requirement gaps · 1 stale bindings",
          boundary: "Candidate decision metadata only; no decision effectiveness, approval, risk acceptance, baseline promotion, operational readiness, or action authority.",
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /private decision question|private options|private recommendations|private outcomes|private rationale|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe governed Risk Register metadata on the native risks and decisions page", async () => {
    const projection = riskRegisterProjection()
    const { source } = harness({ riskRegisterProjection: projection })
    const snapshot = await source.readSnapshot("risks-decisions")
    expect(snapshot.page.kind === "risks-decisions" && snapshot.page.riskRegisters).toMatchObject({
      id: "risk-register",
      rows: [{
        id: projection.register?.id,
        cells: {
          initiative: initiative.id,
          revision: "3",
          membership: projection.register?.membershipDigest,
          counts: "9 risks",
          assessment: "attention-required",
          gaps: "2 not assessed · 3 residual risk gaps · 4 control effectiveness gaps · 1 requirement gaps · 1 stale bindings",
          boundary: "Candidate risk metadata only; no assessment fact, owner assignment, control effectiveness, risk acceptance, approval, exception, baseline promotion, operational readiness, or action authority.",
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /private risk statement|private assessment|private controls|private treatment|private residual risk|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe governed Evidence Registry metadata on the native risks and decisions page", async () => {
    const projection = evidenceRegistryProjection()
    const { source } = harness({ evidenceRegistryProjection: projection })
    const snapshot = await source.readSnapshot("risks-decisions")
    expect(snapshot.page.kind === "risks-decisions" && snapshot.page.evidenceRegistries).toMatchObject({
      id: "evidence-registry",
      rows: [{
        id: projection.registry?.id,
        cells: {
          initiative: initiative.id,
          revision: "4",
          membership: projection.registry?.membershipDigest,
          counts: "12 claims · 18 evidence items · 21 links",
          assessment: "attention-required",
          gaps: "2 claims not assessed · 3 evidence items not assessed · 1 adverse dispositions pending · 4 stale or unknown · 1 invalidated · 2 requirement gaps · 1 stale bindings",
          boundary: "Candidate claim-to-evidence metadata only; no claim validation, evidence sufficiency, assurance, review, approval, risk acceptance, readiness, or action authority.",
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /private claim statement|private evidence observation|private method|private warrant|private quality detail|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe governed End-to-End Traceability metadata on the native trace page", async () => {
    const projection = endToEndTraceabilityProjection()
    const { source } = harness({ endToEndTraceabilityProjection: projection })
    const snapshot = await source.readSnapshot("trace")
    expect(snapshot.page.kind === "trace" && snapshot.page.traceabilityGraphs).toMatchObject({
      id: "end-to-end-traceability",
      rows: [{
        id: projection.traceability?.id,
        cells: {
          initiative: initiative.id,
          revision: "3",
          membership: projection.traceability?.membershipDigest,
          counts: "44 nodes · 12 relationship types · 67 links · 5 transformations",
          assessment: "attention-required",
          gaps: "2 unresolved endpoints · 6 semantic reviews pending · 1 missing spine segments · 3 unknown relationships · 2 requirement gaps · 1 stale bindings",
          boundary: "Candidate graph metadata only; absence does not prove no impact, and presence does not establish relationship truth, completeness, approval, baseline promotion, readiness, or action authority.",
        },
      }],
    })
    expect(JSON.stringify(snapshot)).not.toMatch(
      /private node content|private link rationale|private transformation detail|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe governed P0-P4 Readiness Gate metadata without turning a result into permission", async () => {
    const projection = p0P4ReadinessGateProjection()
    const { source } = harness({ p0P4ReadinessGateProjection: projection })
    const snapshot = await source.readSnapshot("trace")
    expect(snapshot.page.kind === "trace" && snapshot.page.readinessGates).toMatchObject({
      id: "p0-p4-readiness-gates",
      rows: [{
        id: projection.gate?.id,
        cells: {
          initiative: initiative.id,
          revision: "2",
          membership: projection.gate?.membershipDigest,
          definition: projection.gate?.evaluationDefinitionDigest,
          outputs: "17/20 applicable satisfied · 4 candidate not applicable",
          assessment: "failed",
          gaps: "0 blocked · 1 failed · 1 incomplete · 1 conditional · 1 unresolved applicability · 1 waiver gaps · 2 open decisions · 1 unmet conditions · 1 adverse evidence · 1 stale bindings",
          boundary: expect.stringContaining("passing gate is an evaluation result, not permission"),
        },
        state: "failed",
        actions: [],
      }],
    })
    expect(snapshot.page).not.toHaveProperty("approved")
    expect(snapshot.page).not.toHaveProperty("ready")
    expect(JSON.stringify(snapshot.page)).not.toMatch(
      /private output content|private waiver rationale|private decision content|private evidence content|customer@example\.com|api_key/iu,
    )
  })

  it("projects privacy-safe governed P5 Handoff Package metadata without synthesizing transfer or design authority", async () => {
    const projection = p5HandoffPackageProjection()
    const { source } = harness({ p5HandoffPackageProjection: projection })
    const snapshot = await source.readSnapshot("trace")
    expect(snapshot.page.kind === "trace" && snapshot.page.p5Handoffs).toMatchObject({
      id: "p5-handoff-packages",
      rows: [{
        id: projection.handoff?.id,
        cells: {
          initiative: initiative.id,
          revision: "3",
          membership: projection.handoff?.membershipDigest,
          readiness: projection.handoff?.readinessStatusDigest,
          delivery: "disconnected",
          items: "17 included · 3 exact references · 4 explicit N/A · 1 unresolved",
          assessment: "attention-required · readiness incomplete · transfer held",
          gaps: "2 stale/unknown applicable items · 1 lossy transformations · 2 requirement gaps · 1 conflicts · 2 open questions · 1 stale bindings",
          boundary: expect.stringContaining("does not establish acknowledgement"),
        },
        state: "attention-required",
        actions: [],
      }],
    })
    expect(snapshot.page).not.toHaveProperty("acknowledged")
    expect(snapshot.page).not.toHaveProperty("approved")
    expect(snapshot.page).not.toHaveProperty("p5EntryAuthorized")
    expect(JSON.stringify(snapshot.page)).not.toMatch(
      /private item content|private omission|private uncertainty|customer@example\.com|api_key/iu,
    )
  })

  it("withholds the Agent/Model projection when exact history sources are incomplete", async () => {
    const handoffFailure = await harness({ handoffObservationError: new Error("private handoff failure") }).source.readSnapshot("agents-tools")
    expect(handoffFailure.agentModel).toBeUndefined()
    expect(handoffFailure.surface.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "agent-model-unavailable" }),
    ]))
    expect(JSON.stringify(handoffFailure)).not.toContain("private handoff failure")

    const managedFailure = await harness({ managedObservationError: new Error("private Managed Run failure") }).source.readSnapshot("agents-tools")
    expect(managedFailure.agentModel).toBeUndefined()
    expect(managedFailure.surface.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "agent-model-unavailable" }),
    ]))
    expect(JSON.stringify(managedFailure)).not.toContain("private Managed Run failure")
  })

  it("opens an exact audit-gated Change/Impact dashboard from a current Change row", async () => {
    const change: Change = {
      schemaVersion: 1,
      kind: "change",
      id: "24242424-2424-4424-8424-242424242424",
      productId: product.id,
      revision: 2,
      initiativeId: initiative.id,
      title: "Expose exact impact",
      summary: "Bind the selected Change to current portable impact metadata.",
      baseline: { kind: "genesis", declaration: "No exact dashboard existed.", rationale: "First VS Code view." },
      state: "planned",
      effectEnvelope: ["reversible-change"],
      createdAt: "2026-07-24T00:00:00.000Z",
      updatedAt: "2026-07-24T00:01:00.000Z",
    }
    const workItem: WorkItem = {
      schemaVersion: 1,
      kind: "work-item",
      id: "25252525-2525-4525-8525-252525252525",
      productId: product.id,
      revision: 1,
      changeId: change.id,
      title: "Render impact",
      objective: "Render only exact bounded impact metadata.",
      state: "planned",
      dependsOn: [],
      completionCriteria: ["The browser protocol validates"],
      evidenceCriteria: ["Accessibility tests pass"],
      scope: {
        read: [{ kind: "workspace-relative", path: "." }],
        write: [{ kind: "workspace-relative", path: "apps/vscode/src/studio-client.ts" }],
        effects: [],
      },
      owner: { kind: "agent", id: "codex" },
      createdAt: "2026-07-24T00:02:00.000Z",
      updatedAt: "2026-07-24T00:02:00.000Z",
    }
    const decision: Decision = {
      schemaVersion: 1,
      kind: "decision",
      id: "26262626-2626-4626-8626-262626262626",
      productId: product.id,
      revision: 1,
      question: "Should this projection remain observational?",
      options: [
        { id: "27272727-2727-4727-8727-272727272727", label: "Read only", description: "No authority.", tradeoffs: [] },
        { id: "28282828-2828-4828-8828-282828282828", label: "Mutating", description: "Wider authority.", tradeoffs: [] },
      ],
      dissentAndUncertainty: [],
      affectedRecords: [{ recordType: "change", recordId: change.id, revision: change.revision, digest: canonicalDigest(change) }],
      state: "open",
      createdAt: "2026-07-24T00:03:00.000Z",
      updatedAt: "2026-07-24T00:03:00.000Z",
    }
    const risk: Risk = {
      schemaVersion: 1,
      kind: "risk",
      id: "29292929-2929-4929-8929-292929292929",
      productId: product.id,
      revision: 1,
      title: "Missing trace",
      cause: "A relationship is absent.",
      condition: "Trace coverage is incomplete.",
      consequence: "Impact may be understated.",
      likelihood: "possible",
      impact: "major",
      uncertainty: "Coverage is bounded.",
      treatment: "Expose the coverage boundary.",
      owner: { kind: "human", id: "founder" },
      reviewTriggers: ["Change review begins"],
      residualRisk: "Missing links remain possible.",
      evidence: [],
      state: "open",
      createdAt: "2026-07-24T00:04:00.000Z",
      updatedAt: "2026-07-24T00:04:00.000Z",
    }
    const link: TraceLink = {
      schemaVersion: 1,
      kind: "trace-link",
      id: "30303030-3030-4030-8030-303030303030",
      productId: product.id,
      revision: 1,
      source: { recordType: "risk", recordId: risk.id, revision: risk.revision, digest: canonicalDigest(risk) },
      relationship: "affects",
      target: { recordType: "change", recordId: change.id, revision: change.revision, digest: canonicalDigest(change) },
      state: "valid",
      provenance: { kind: "human", actorId: "founder", rationale: "The risk affects this Change." },
      createdAt: "2026-07-24T00:05:00.000Z",
      updatedAt: "2026-07-24T00:05:00.000Z",
    }
    const impact: TraceImpact = {
      subject: { recordType: "change", recordId: change.id, revision: change.revision, digest: canonicalDigest(change) },
      upstream: [link],
      downstream: [],
      validatingEvidence: [],
      decisionsAndRisks: [link],
      unresolved: [],
      invalid: [],
      stale: [],
      invalidatedByProposedRevision: [],
      coverageBoundary: "absence-of-a-trace-link-does-not-prove-absence-of-impact",
      truncated: false,
      evaluatedAt: "2026-07-24T00:06:00.000Z",
    }
    const base = productStudioStub()
    const service = {
      ...base,
      listDomainPage: async (kind: string, input: { offset?: number; limit?: number } = {}) => {
        const items = kind === "change" ? [change] : kind === "work-item" ? [workItem] : []
        return { items, offset: input.offset ?? 0, limit: input.limit ?? 50, total: items.length, hasMore: false }
      },
      readChange: async () => change,
      listWorkItems: async () => [workItem],
      impactAnalysis: async () => impact,
      listDecisions: async () => [decision],
      listRisks: async () => [risk],
    } as unknown as ProductStudioService
    const { source } = harness({
      productStudio: service,
      deliveryPhase: "phase-1b-product",
      p0P4ReadinessGateProjection: p0P4ReadinessGateProjectionWithoutCandidate(),
      p5HandoffPackageProjection: p5HandoffPackageProjectionWithoutCandidate(),
    })
    const delivery = await source.readSnapshot("delivery")
    if (delivery.page.kind !== "delivery") throw new Error("Expected Delivery page")
    const action = delivery.page.changes.rows[0]?.actions.find((entry) => entry.label === "Show impact")?.action
    if (!action || action.kind !== "show-change-impact") throw new Error("Expected exact Change impact action")
    expect(await source.execute(action, {
      requestId: "show-change-impact",
      expectedContextGeneration: delivery.contextGeneration,
      expectedSnapshotRevision: delivery.snapshotRevision,
    })).toMatchObject({ status: "accepted", announcement: expect.stringMatching(/approval remains not established/i) })
    const refreshed = await source.readSnapshot("delivery")
    expect(isStudioSnapshot(refreshed)).toBe(true)
    expect(refreshed.changeImpact).toMatchObject({
      change: { recordId: change.id, revision: change.revision },
      changedArtifacts: [{ locator: { kind: "workspace-relative", path: "apps/vscode/src/studio-client.ts" } }],
      governance: {
        approval: { state: "not-established" },
        decisions: [{ state: "open", outcome: "not-selected" }],
        risks: [{ state: "open", impact: "major", acceptance: "not-accepted" }],
      },
      freshness: { state: "current" },
    })
    const dashboard = refreshed.changeImpact
    if (!dashboard) throw new Error("Expected exact Change/Impact dashboard")
    const { snapshotDigest, ...content } = dashboard
    expect(snapshotDigest).toBe(canonicalDigest(content))
    expect(JSON.stringify(dashboard)).not.toContain(change.title)
    expect(JSON.stringify(dashboard)).not.toContain(risk.title)
    expect(refreshed.phase1ChangeImpact).toMatchObject({
      kind: "phase-1-change-impact-dashboard",
      initiative: { recordId: initiative.id, revision: initiative.revision },
      change: { recordId: change.id, revision: change.revision },
      coverage: {
        state: "bounded-not-complete",
        outputCount: 25,
        currentTraceObservedOutputCount: 0,
        attentionRequiredOutputCount: 0,
        impactNotEstablishedOutputCount: 25,
        revalidationNotEstablishedOutputCount: 25,
      },
      owners: { state: "unbound", boundOutputOwnerCount: 0 },
    })
    const phase1ChangeImpact = refreshed.phase1ChangeImpact
    if (!phase1ChangeImpact) throw new Error("Expected exact Phase 1 Change/Impact dashboard")
    const { snapshotDigest: phase1Digest, ...phase1Content } = phase1ChangeImpact
    expect(phase1Digest).toBe(canonicalDigest(phase1Content))
    expect(phase1ChangeImpact.outputs).toHaveLength(25)
    expect(phase1ChangeImpact.outputs.every((output) => output.impact.revalidationState === "not-established")).toBe(true)
    expect(JSON.stringify(phase1ChangeImpact)).not.toContain(change.title)
    const tamperedPhase1 = structuredClone(refreshed)
    if (!tamperedPhase1.phase1ChangeImpact) throw new Error("Expected Phase 1 impact dashboard to tamper")
    tamperedPhase1.phase1ChangeImpact.coverage.impactNotEstablishedOutputCount = 24
    expect(isStudioSnapshot(tamperedPhase1)).toBe(false)

    const hostile = { ...action, expectedChangeDigest: `sha256:${"0".repeat(64)}` }
    expect(await source.execute(hostile, {
      requestId: "show-change-impact-stale",
      expectedContextGeneration: refreshed.contextGeneration,
      expectedSnapshotRevision: refreshed.snapshotRevision,
    })).toMatchObject({ status: "rejected" })
  })

  it("keeps executable paths out of portable tables and limits them to the machine-local inspector", async () => {
    const { source } = harness()
    const snapshot = await source.readSnapshot("agents-tools")
    expect(snapshot.page.kind).toBe("agents-tools")
    if (snapshot.page.kind !== "agents-tools") return
    const portableSnapshot = { ...snapshot, inspector: undefined }
    expect(JSON.stringify(portableSnapshot)).not.toContain("/opt/local/bin")
    expect(JSON.stringify(snapshot.page.adapters)).not.toContain(`sha256:${"b".repeat(64)}`)
    expect(snapshot.inspector?.title).toMatch(/Machine-local/i)
    expect(JSON.stringify(snapshot.inspector)).toContain("/opt/local/bin/codex")
    expect(JSON.stringify(snapshot.page.selection)).not.toContain("must-redact")
    expect(JSON.stringify(snapshot.page.selection)).toContain("[redacted]")
    expect(JSON.stringify(snapshot.agentModel)).not.toContain("must-redact")
    expect(JSON.stringify(snapshot.agentModel)).toContain("[redacted]")
  })

  it("blocks run preparation when a machine-local binding is missing or legacy", async () => {
    const missing = harness({ runtimeBindings: {} }).source
    const missingRuns = await missing.readSnapshot("runs-evidence")
    if (missingRuns.page.kind !== "runs-evidence") throw new Error("Expected runs page")
    expect(missingRuns.page.actions[0]).toMatchObject({ enabled: false })
    expect(missingRuns.page.actions[0]?.disabledReason).toMatch(/No machine-local executable fingerprint/i)

    const key = `${workspacePath}\u0000codex-adapter`
    const legacy = harness({
      runtimeBindings: {
        [key]: {
          adapterId: "codex-adapter",
          canonicalPath: "/legacy/machine/path/codex",
          digest: `sha256:${"c".repeat(64)}`,
          size: 1,
          modifiedAtMs: 1,
        },
      },
    }).source
    const legacyOverview = await legacy.readSnapshot("overview")
    if (legacyOverview.page.kind !== "overview") throw new Error("Expected overview")
    expect(legacyOverview.page.blockers.some((blocker) => /legacy path-bearing format/i.test(blocker.message))).toBe(true)
    expect(JSON.stringify(legacyOverview)).not.toContain("/legacy/machine/path")
  })

  it("offers an explicit migration stop-line for a legacy portable-selection read failure", async () => {
    const { source } = harness({ selectionError: new Error("Legacy agent selection migration is required") })
    const overview = await source.readSnapshot("overview")
    if (overview.page.kind !== "overview") throw new Error("Expected overview")
    expect(overview.page.primaryAction?.label).toMatch(/Reconfirm and migrate/i)
    expect(overview.page.primaryAction?.action.kind).toBe("select-agent")
    expect(overview.page.blockers.some((blocker) => /legacy path-bearing selection is blocked/i.test(blocker.message))).toBe(true)
    expect(JSON.stringify(overview)).not.toContain("runtimeExecutable")
  })

  it("separates detection, managed-interface support, maturity, and native-picker actions", async () => {
    const { source, commands } = harness()
    const snapshot = await source.readSnapshot("agents-tools")
    if (snapshot.page.kind !== "agents-tools") throw new Error("Expected agent page")
    const codex = snapshot.page.adapters.rows.find((row) => row.id === "codex-adapter")
    const claude = snapshot.page.adapters.rows.find((row) => row.id === "claude-adapter")
    expect(codex?.cells.status).toMatch(/structured CLI capability.*interface maturity stable/i)
    expect(codex?.actions[0]?.enabled).toBe(true)
    expect(codex?.actions[0]).toMatchObject({
      label: "Open native agent/model picker",
      action: { kind: "select-agent", adapterId: "native-picker", agentId: "native-picker", modelId: "native-picker" },
    })
    expect(claude?.cells.status).toMatch(/managed execution interface unsupported by this build.*interface maturity unknown/i)
    expect(claude?.actions[0]?.enabled).toBe(false)
    expect(claude?.actions[0]?.disabledReason).toMatch(/cannot be selected for managed execution/i)
    expect(JSON.stringify(snapshot.page.adapters)).not.toContain("provider-selected")
    const nativePicker = codex?.actions[0]
    if (!nativePicker) throw new Error("Expected native picker action")
    expect(await source.execute(nativePicker.action, {
      requestId: "open-native-agent-picker",
      expectedContextGeneration: snapshot.contextGeneration,
      expectedSnapshotRevision: snapshot.snapshotRevision,
    })).toMatchObject({ status: "accepted" })
    expect(commands.at(-1)).toEqual({ command: "gaep.selectAgent", args: [] })
  })

  it("maps native actions, opens portable inspectors, and rejects stale operations", async () => {
    const { source, commands } = harness()
    const snapshot = await source.readSnapshot("delivery")
    const accepted = await source.execute({ kind: "create-initiative" }, {
      requestId: "request-1",
      expectedContextGeneration: snapshot.contextGeneration,
      expectedSnapshotRevision: snapshot.snapshotRevision,
    })
    expect(accepted.status).toBe("accepted")
    expect(commands).toEqual([{ command: "gaep.createInitiative", args: [] }])
    const inspected = await source.execute({ kind: "open-record", recordId: "record-1" }, {
      requestId: "request-2",
      expectedContextGeneration: snapshot.contextGeneration,
      expectedSnapshotRevision: snapshot.snapshotRevision,
    })
    expect(inspected.status).toBe("accepted")
    const stale = await source.execute({ kind: "show-diagnostics" }, {
      requestId: "request-3",
      expectedContextGeneration: snapshot.contextGeneration,
      expectedSnapshotRevision: 0,
    })
    expect(stale.status).toBe("rejected")
  })

  it("presents exact Initiative entry truth and maps revision-bound native classification and applicability workflows", async () => {
    const assessment = entryAssessment()
    const { source, commands } = harness({
      initiativeEntryAssessments: { [initiative.id]: assessment },
    })
    let snapshot = await source.readSnapshot("delivery")
    if (snapshot.page.kind !== "delivery") throw new Error("Expected Delivery page")
    const row = snapshot.page.initiatives.rows[0]
    expect(row?.cells).toMatchObject({
      classification: "current · completeness complete (0 unknown, 0 unresolved question(s))",
      applicability: "missing · 0 decision(s) · 0 unresolved · coverage missing (0/49, 49 missing, 0 unexpected, 0 mismatched)",
      entry: "attention-required · Initiative applicability has not been resolved",
    })
    const classify = row?.actions.find((action) => action.action.kind === "classify-initiative")
    const resolve = row?.actions.find((action) => action.action.kind === "resolve-initiative-applicability")
    expect(classify).toMatchObject({ enabled: true, action: { initiativeId: initiative.id, expectedRevision: 1 } })
    expect(resolve).toMatchObject({ enabled: true, action: { initiativeId: initiative.id, expectedRevision: 1 } })
    if (!classify) throw new Error("Expected classification action")
    await source.execute(classify.action, {
      requestId: "classify-entry",
      expectedContextGeneration: snapshot.contextGeneration,
      expectedSnapshotRevision: snapshot.snapshotRevision,
    })
    expect(commands.at(-1)).toEqual({ command: "gaep.classifyInitiative", args: [initiative.id, 1] })

    snapshot = await source.readSnapshot("delivery")
    if (snapshot.page.kind !== "delivery") throw new Error("Expected Delivery page")
    const currentResolve = snapshot.page.initiatives.rows[0]?.actions.find(
      (action) => action.action.kind === "resolve-initiative-applicability",
    )
    if (!currentResolve) throw new Error("Expected applicability action")
    await source.execute(currentResolve.action, {
      requestId: "resolve-entry",
      expectedContextGeneration: snapshot.contextGeneration,
      expectedSnapshotRevision: snapshot.snapshotRevision,
    })
    expect(commands.at(-1)).toEqual({ command: "gaep.resolveInitiativeApplicability", args: [initiative.id, 1] })
    expect(JSON.stringify(snapshot)).toContain("grants no approval, readiness, or action authority")
  })

  it("rejects an otherwise-current action after the opaque root context changes", async () => {
    const { source, commands, setContextGeneration } = harness()
    const snapshot = await source.readSnapshot("delivery")
    setContextGeneration("context_generation_0987654321")

    const result = await source.execute({ kind: "create-initiative" }, {
      requestId: "request-context-race",
      expectedContextGeneration: snapshot.contextGeneration,
      expectedSnapshotRevision: snapshot.snapshotRevision,
    })

    expect(result.status).toBe("rejected")
    expect(result.announcement).toMatch(/Product root or trust context changed/i)
    expect(commands).toEqual([])
    expect((await source.readSnapshot("delivery")).contextGeneration).toBe("context_generation_0987654321")
  })

  it("rejects a torn snapshot when the root context changes during observation", async () => {
    const { source } = harness({ rotateContextDuringObservation: true })
    await expect(source.readSnapshot("overview")).rejects.toThrow(/context changed while the snapshot was being read/i)
  })

  it("uses one fail-closed run eligibility result across Overview blockers and Runs actions", async () => {
    const cases: Array<{ name: string; options: HarnessOptions; reason: RegExp; overviewAction: string }> = [
      {
        name: "inspection-only selection",
        options: { selection: { ...selection, agentId: "claude-code-cli" } },
        reason: /inspection-only/i,
        overviewAction: "select-agent",
      },
      {
        name: "unsafe Codex settings",
        options: { selection: { ...selection, settings: { ...selection.settings, sandbox: "workspace-write" } } },
        reason: /workspace-write is disabled/i,
        overviewAction: "select-agent",
      },
      {
        name: "missing Initiative",
        options: { initiatives: [] },
        reason: /Create and activate a bounded Initiative/i,
        overviewAction: "create-initiative",
      },
      {
        name: "invalid audit",
        options: { audit: { valid: false, events: 4, error: "broken" } },
        reason: /audit chain did not verify/i,
        overviewAction: "prepare-run",
      },
      {
        name: "unknown run effects",
        options: { runs: [{ ...run, state: "unknown" }] },
        reason: /unknown effects/i,
        overviewAction: "prepare-run",
      },
    ]

    for (const candidate of cases) {
      const { source } = harness(candidate.options)
      const overview = await source.readSnapshot("overview")
      if (overview.page.kind !== "overview") throw new Error(`Expected Overview for ${candidate.name}`)
      expect(overview.page.blockers.some((blocker) => candidate.reason.test(blocker.message)), candidate.name).toBe(true)
      expect(overview.page.primaryAction?.action.kind, candidate.name).toBe(candidate.overviewAction)
      if (overview.page.primaryAction?.action.kind === "prepare-run") {
        expect(overview.page.primaryAction.enabled, candidate.name).toBe(false)
        expect(overview.page.primaryAction.disabledReason, candidate.name).toMatch(candidate.reason)
      }

      const runs = await source.readSnapshot("runs-evidence")
      if (runs.page.kind !== "runs-evidence") throw new Error(`Expected Runs for ${candidate.name}`)
      expect(runs.page.actions[0]?.action.kind, candidate.name).toBe("prepare-run")
      expect(runs.page.actions[0]?.enabled, candidate.name).toBe(false)
      expect(runs.page.actions[0]?.disabledReason, candidate.name).toMatch(candidate.reason)
    }

    const healthy = harness().source
    const healthyOverview = await healthy.readSnapshot("overview")
    if (healthyOverview.page.kind !== "overview") throw new Error("Expected healthy Overview")
    expect(healthyOverview.page.primaryAction).toMatchObject({ enabled: true, action: { kind: "prepare-run" } })
    const healthyRuns = await healthy.readSnapshot("runs-evidence")
    if (healthyRuns.page.kind !== "runs-evidence") throw new Error("Expected healthy Runs")
    expect(healthyRuns.page.actions[0]).toMatchObject({ enabled: true, action: { kind: "prepare-run" } })
  })

  it("uses blocked and uninitialized lifecycle states without probing untrusted roots", async () => {
    const blockedHarness = harness({ trusted: false })
    const blocked = blockedHarness.source
    const blockedSnapshot = await blocked.readSnapshot("overview")
    expect(blockedSnapshot.surface.kind).toBe("blocked")
    expect(await blocked.execute({ kind: "start-design-draft", expectedProductRevision: 3 }, {
      requestId: "untrusted-mutation",
      expectedContextGeneration: blockedSnapshot.contextGeneration,
      expectedSnapshotRevision: blockedSnapshot.snapshotRevision,
    })).toMatchObject({ status: "rejected", announcement: expect.stringMatching(/trust/i) })
    expect(blockedHarness.commands).toEqual([])
    const absent = harness({ withProduct: false }).source
    expect((await absent.readSnapshot("overview")).surface.kind).toBe("uninitialized")
  })

  it("loads only route-relevant bounded pages with accurate totals and next/previous navigation", async () => {
    const requirements = Array.from({ length: 250 }, (_, index) => ({
      schemaVersion: 1 as const,
      kind: "requirement" as const,
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      productId: product.id,
      revision: 1,
      key: `GAEP-REQ-${String(index + 1).padStart(3, "0")}`,
      statement: `Requirement ${index + 1}`,
      rationale: "Bounded test rationale",
      priority: "must" as const,
      state: "proposed" as const,
      verificationCriteria: ["Observable criterion"],
      sourceRecords: [],
      createdAt: "2026-07-21T00:00:00.000Z",
      updatedAt: "2026-07-21T00:00:00.000Z",
    }))
    const base = productStudioStub()
    let availableRequirements = requirements
    const listDomainPage = vi.fn(async (kind: string, input: { offset?: number; limit?: number } = {}) => {
      const offset = input.offset ?? 0
      const limit = input.limit ?? 50
      const records = kind === "requirement" ? availableRequirements : []
      return { items: records.slice(offset, offset + limit), offset, limit, total: records.length, hasMore: offset + limit < records.length }
    })
    const source = harness({
      productStudio: { ...base, listDomainPage } as unknown as ProductStudioService,
    }).source
    const snapshot = await source.readSnapshot("scope")
    if (snapshot.page.kind !== "record-form") throw new Error("Expected Scope form")
    const table = snapshot.page.relatedRecords?.find((candidate) => candidate.id === "requirements")
    expect(table?.rows).toHaveLength(50)
    expect(table?.pagination).toEqual({ offset: 0, limit: 50, total: 250, hasPrevious: false, hasNext: true })
    expect(listDomainPage).toHaveBeenCalledWith("requirement", { offset: 0, limit: 50 })
    const next = table?.actions.find((candidate) => candidate.label === "Next Requirements page")
    expect(next).toMatchObject({ enabled: true, action: { kind: "domain-page", recordKind: "requirement", offset: 50, limit: 50 } })
    if (!next) throw new Error("Expected next-page action")
    expect(await source.execute(next.action, {
      requestId: "requirements-next",
      expectedContextGeneration: snapshot.contextGeneration,
      expectedSnapshotRevision: snapshot.snapshotRevision,
    })).toMatchObject({ status: "accepted" })
    const second = await source.readSnapshot("scope")
    if (second.page.kind !== "record-form") throw new Error("Expected Scope form")
    const secondTable = second.page.relatedRecords?.find((candidate) => candidate.id === "requirements")
    expect(secondTable?.rows[0]?.cells.key).toBe("GAEP-REQ-051")
    expect(secondTable?.pagination).toEqual({ offset: 50, limit: 50, total: 250, hasPrevious: true, hasNext: true })
    expect(secondTable?.actions.find((candidate) => candidate.label === "Previous Requirements page")).toMatchObject({ enabled: true })
    expect(listDomainPage.mock.calls.every(([kind]) => kind === "requirement")).toBe(true)

    expect(await source.execute({ kind: "domain-page", recordKind: "requirement", offset: 200, limit: 25 }, {
      requestId: "requirements-custom-page",
      expectedContextGeneration: second.contextGeneration,
      expectedSnapshotRevision: second.snapshotRevision,
    })).toMatchObject({ status: "accepted" })
    availableRequirements = []
    const emptied = await source.readSnapshot("scope")
    if (emptied.page.kind !== "record-form") throw new Error("Expected Scope form")
    expect(emptied.page.relatedRecords?.find((candidate) => candidate.id === "requirements")?.pagination)
      .toEqual({ offset: 0, limit: 25, total: 0, hasPrevious: false, hasNext: false })

    availableRequirements = requirements.slice(0, 70)
    expect(await source.execute({ kind: "domain-page", recordKind: "requirement", offset: 100, limit: 25 }, {
      requestId: "requirements-shrunk-page",
      expectedContextGeneration: emptied.contextGeneration,
      expectedSnapshotRevision: emptied.snapshotRevision,
    })).toMatchObject({ status: "accepted" })
    const shrunk = await source.readSnapshot("scope")
    if (shrunk.page.kind !== "record-form") throw new Error("Expected Scope form")
    expect(shrunk.page.relatedRecords?.find((candidate) => candidate.id === "requirements")?.pagination)
      .toEqual({ offset: 50, limit: 25, total: 70, hasPrevious: true, hasNext: false })
  })

  it("lists and exactly reads bounded portable design metadata without exposing source paths or token values", async () => {
    const listPortableDesignSnapshots = vi.fn(async (input: { offset?: number; limit?: number } = {}) => {
      const offset = input.offset ?? 0
      const limit = input.limit ?? 50
      return {
        items: [portableDesignSnapshot],
        offset,
        limit,
        total: 51,
        hasMore: offset + limit < 51,
      }
    })
    const readPortableDesignSnapshot = vi.fn(async () => portableDesignSnapshot)
    const auditState = { valid: true, events: 8, error: undefined as string | undefined }
    const source = harness({
      audit: auditState,
      productStudio: {
        ...productStudioStub(),
        listPortableDesignSnapshots,
        readPortableDesignSnapshot,
      } as unknown as ProductStudioService,
    }).source

    const first = await source.readSnapshot("readiness")
    expect(isStudioSnapshot(first)).toBe(true)
    if (first.page.kind !== "readiness") throw new Error("Expected Readiness page")
    const table = first.page.portableDesignSnapshots
    expect(table.pagination).toEqual({ offset: 0, limit: 50, total: 51, hasPrevious: false, hasNext: true })
    expect(table.rows[0]).toMatchObject({
      id: portableDesignSnapshot.bundleId,
      cells: {
        governance: "pending-human-review",
        sourceReview: "approved upstream claim; not GAEP approval",
        artifacts: "1",
      },
    })
    expect(listPortableDesignSnapshots).toHaveBeenCalledWith({ offset: 0, limit: 50 })
    const portableUi = JSON.stringify({ table, portability: first.page.portability })
    expect(portableUi).not.toContain("private/raw-checkout.png")
    expect(portableUi).not.toContain("private-token-value")
    expect(portableUi).not.toContain("private-source-object")
    expect(portableUi).toMatch(/not GAEP approval.*Design Baseline.*implementation readiness.*release readiness/i)

    const read = table.rows[0]?.actions.find((candidate) => candidate.action.kind === "read-portable-design-snapshot")
    if (!read) throw new Error("Expected exact portable design metadata action")
    expect(await source.execute(read.action, {
      requestId: "read-portable-design",
      expectedContextGeneration: first.contextGeneration,
      expectedSnapshotRevision: first.snapshotRevision,
    })).toMatchObject({ status: "accepted", announcement: expect.stringMatching(/pending human review/i) })
    expect(readPortableDesignSnapshot).toHaveBeenCalledWith(portableDesignSnapshot.bundleId)

    const inspected = await source.readSnapshot("readiness")
    expect(inspected.inspector?.title).toMatch(/Verified portable design metadata/i)
    const inspector = JSON.stringify(inspected.inspector)
    expect(inspector).toMatch(/pending-human-review/i)
    expect(inspector).toMatch(/not design approval.*Design Baseline.*implementation readiness.*release readiness/i)
    expect(inspector).not.toContain("private/raw-checkout.png")
    expect(inspector).not.toContain("private-token-value")
    expect(inspector).not.toContain("private-source-object")

    if (inspected.page.kind !== "readiness") throw new Error("Expected Readiness page")
    const next = inspected.page.portableDesignSnapshots.actions.find((candidate) =>
      candidate.label === "Next Portable design snapshots page")
    if (!next) throw new Error("Expected next portable design page action")
    expect(await source.execute(next.action, {
      requestId: "next-portable-design-page",
      expectedContextGeneration: inspected.contextGeneration,
      expectedSnapshotRevision: inspected.snapshotRevision,
    })).toMatchObject({ status: "accepted" })
    const second = await source.readSnapshot("readiness")
    if (second.page.kind !== "readiness") throw new Error("Expected Readiness page")
    expect(second.page.portableDesignSnapshots.pagination)
      .toEqual({ offset: 50, limit: 50, total: 51, hasPrevious: true, hasNext: false })
    expect(listPortableDesignSnapshots).toHaveBeenLastCalledWith({ offset: 50, limit: 50 })

    auditState.valid = false
    auditState.error = "invalid after exact read"
    const auditInvalidated = await source.readSnapshot("readiness")
    expect(auditInvalidated.inspector).toBeUndefined()
    if (auditInvalidated.page.kind !== "readiness") throw new Error("Expected Readiness page")
    expect(auditInvalidated.page.portableDesignSnapshots.rows).toEqual([])
  })

  it("withholds portable design records when audit verification or inventory validation fails", async () => {
    const listWithInvalidAudit = vi.fn(async () => ({
      items: [portableDesignSnapshot], offset: 0, limit: 50, total: 1, hasMore: false,
    }))
    const invalidAudit = harness({
      audit: { valid: false, events: 8, error: "invalid" },
      productStudio: {
        ...productStudioStub(),
        listPortableDesignSnapshots: listWithInvalidAudit,
      } as unknown as ProductStudioService,
    }).source
    const blocked = await invalidAudit.readSnapshot("readiness")
    if (blocked.page.kind !== "readiness") throw new Error("Expected Readiness page")
    expect(listWithInvalidAudit).not.toHaveBeenCalled()
    expect(blocked.page.portableDesignSnapshots.rows).toEqual([])
    expect(blocked.page.portableDesignSnapshots.actions[0]).toMatchObject({
      enabled: false,
      disabledReason: expect.stringMatching(/Audit and governed snapshot inventory verification must pass/i),
    })
    expect(blocked.page.actions[0]).toMatchObject({ enabled: false })
    expect(blocked.page.gaps.some((candidate) => /withheld because the audit chain is invalid/i.test(candidate.message))).toBe(true)

    const privateFailure = "/Users/private/token-ghp_secret/candidates/raw-content"
    const tampered = harness({
      productStudio: {
        ...productStudioStub(),
        listPortableDesignSnapshots: async () => { throw new Error(`tampered inventory at ${privateFailure}`) },
      } as unknown as ProductStudioService,
    })
    const withheld = await tampered.source.readSnapshot("readiness")
    if (withheld.page.kind !== "readiness") throw new Error("Expected Readiness page")
    expect(withheld.page.portableDesignSnapshots.rows).toEqual([])
    expect(withheld.page.portableDesignSnapshots.actions[0]).toMatchObject({ enabled: false })
    expect(withheld.page.actions[0]).toMatchObject({ enabled: false })
    expect(withheld.page.gaps.some((candidate) => /portable design snapshots could not be observed/i.test(candidate.message))).toBe(true)
    expect(JSON.stringify(withheld)).not.toContain(privateFailure)
    expect(tampered.diagnostics.some((entry) =>
      /Product Studio portable-design-snapshots observation failed; local source details were withheld/i.test(entry))).toBe(true)
    expect(JSON.stringify(tampered.diagnostics)).not.toContain(privateFailure)

    const exactReadFailure = harness({
      productStudio: {
        ...productStudioStub(),
        listPortableDesignSnapshots: async () => ({
          items: [portableDesignSnapshot], offset: 0, limit: 50, total: 1, hasMore: false,
        }),
        readPortableDesignSnapshot: async () => { throw new Error(`raw snapshot content at ${privateFailure}`) },
      } as unknown as ProductStudioService,
    })
    const readable = await exactReadFailure.source.readSnapshot("readiness")
    const rejected = await exactReadFailure.source.execute({
      kind: "read-portable-design-snapshot",
      bundleId: portableDesignSnapshot.bundleId,
    }, {
      requestId: "private-exact-read-failure",
      expectedContextGeneration: readable.contextGeneration,
      expectedSnapshotRevision: readable.snapshotRevision,
    })
    expect(rejected).toMatchObject({
      status: "rejected",
      announcement: expect.stringMatching(/could not verify.*current audit and Product binding/i),
    })
    expect(JSON.stringify(rejected)).not.toContain(privateFailure)
    expect(JSON.stringify(exactReadFailure.diagnostics)).not.toContain(privateFailure)
  })

  it("saves one design section with exact optimistic revisions and local actor provenance", async () => {
    const saveDesignDraft = vi.fn(async (input: unknown) => ({ ...designDraft, revision: 3, input }))
    const source = harness({
      productStudio: { ...productStudioStub(), saveDesignDraft } as unknown as ProductStudioService,
    }).source
    const snapshot = await source.readSnapshot("direction")
    const result = await source.execute({
      kind: "save-draft",
      route: "direction",
      draftId: designDraft.id,
      draftRevision: designDraft.revision,
      baseRevision: designDraft.baseProductRevision,
      values: { "direction.truth": "Revised direction truth" },
      states: { "direction.truth": "weak" },
      deferredReasons: {},
      revisitTriggers: {},
    }, {
      requestId: "save-design",
      expectedContextGeneration: snapshot.contextGeneration,
      expectedSnapshotRevision: snapshot.snapshotRevision,
    })
    expect(result.status).toBe("accepted")
    expect(saveDesignDraft).toHaveBeenCalledOnce()
    const input = saveDesignDraft.mock.calls[0]?.[0] as {
      expectedDraftRevision: number
      expectedProductRevision: number
      sections: ProductDesignDraft["sections"]
    }
    expect(input.expectedDraftRevision).toBe(2)
    expect(input.expectedProductRevision).toBe(3)
    expect(input.sections.direction.fields[0]).toMatchObject({
      value: "Revised direction truth",
      state: "weak",
      provenance: expect.arrayContaining(["human:local-actor-test"]),
    })
  })

  it("rejects a design save when the draft revision changed after the snapshot", async () => {
    let reads = 0
    const base = productStudioStub()
    const readDesignDraft = vi.fn(async () => {
      reads += 1
      return reads === 1 ? designDraft : { ...designDraft, revision: designDraft.revision + 1 }
    })
    const saveDesignDraft = vi.fn()
    const source = harness({
      productStudio: { ...base, readDesignDraft, saveDesignDraft } as unknown as ProductStudioService,
    }).source
    const snapshot = await source.readSnapshot("direction")
    const result = await source.execute({
      kind: "save-draft",
      route: "direction",
      draftId: designDraft.id,
      draftRevision: designDraft.revision,
      baseRevision: designDraft.baseProductRevision,
      values: { "direction.truth": "stale edit" },
    }, {
      requestId: "stale-design",
      expectedContextGeneration: snapshot.contextGeneration,
      expectedSnapshotRevision: snapshot.snapshotRevision,
    })
    expect(result).toMatchObject({ status: "rejected", announcement: expect.stringMatching(/changed since/i) })
    expect(saveDesignDraft).not.toHaveBeenCalled()
  })

  it("rejects secret-shaped design content before any repository mutation", async () => {
    const saveDesignDraft = vi.fn()
    const source = harness({
      productStudio: { ...productStudioStub(), saveDesignDraft } as unknown as ProductStudioService,
    }).source
    const snapshot = await source.readSnapshot("direction")
    const result = await source.execute({
      kind: "save-draft",
      route: "direction",
      draftId: designDraft.id,
      draftRevision: designDraft.revision,
      baseRevision: designDraft.baseProductRevision,
      values: { "direction.truth": "api_key=abcdefghijklmnopqrstuvwxyz123456" },
    }, {
      requestId: "secret-design",
      expectedContextGeneration: snapshot.contextGeneration,
      expectedSnapshotRevision: snapshot.snapshotRevision,
    })
    expect(result).toMatchObject({ status: "rejected", announcement: expect.stringMatching(/secret-shaped/i) })
    expect(saveDesignDraft).not.toHaveBeenCalled()
  })

  it("retains bounded native search results and their explicit total", async () => {
    const searchResult = {
      schemaVersion: 1 as const,
      kind: "requirement" as const,
      id: "77777777-7777-4777-8777-777777777777",
      productId: product.id,
      revision: 2,
      label: "GAEP-REQ-777",
      excerpt: "bounded search result",
      updatedAt: "2026-07-21T00:00:00.000Z",
    }
    const { source, commands } = harness({ commandResult: { kind: "search-results", results: [searchResult], total: 300 } })
    const snapshot = await source.readSnapshot("trace")
    const result = await source.execute({ kind: "domain-workflow", workflow: "search" }, {
      requestId: "search",
      expectedContextGeneration: snapshot.contextGeneration,
      expectedSnapshotRevision: snapshot.snapshotRevision,
    })
    expect(result.status).toBe("accepted")
    expect(commands[0]).toMatchObject({
      command: "gaep.productStudio.domainWorkflow",
      args: [{
        kind: "domain-workflow",
        workflow: "search",
        expectedProductRevision: product.revision,
        expectedContextGeneration: snapshot.contextGeneration,
      }],
    })
    const refreshed = await source.readSnapshot("trace")
    if (refreshed.page.kind !== "trace") throw new Error("Expected Trace page")
    expect(refreshed.page.searchResults.rows).toHaveLength(1)
    expect(refreshed.page.searchResults.truncation).toMatchObject({ shown: 1, total: 300 })
  })

  it("exposes inspectable and revocable Instruction Privilege Grants without treating them as authority", async () => {
    const grant = {
      schemaVersion: 1 as const,
      kind: "instruction-privilege-grant" as const,
      id: "88888888-8888-4888-8888-888888888888",
      productId: product.id,
      revision: 2,
      source: { kind: "logical" as const, value: "reviewed-instruction-source" },
      sourceDigest: `sha256:${"8".repeat(64)}`,
      privilege: "governing-instruction" as const,
      purpose: "Bounded Product design guidance",
      recipient: { kind: "agent" as const, id: "codex-cli" },
      scope: Array.from({ length: 128 }, (_, index) => `scope-${index}-${"s".repeat(300)}`),
      authority: {
        recordType: "requirement" as const,
        recordId: "99999999-9999-4999-8999-999999999999",
        revision: 1,
        digest: `sha256:${"9".repeat(64)}`,
      },
      state: "active" as const,
      acceptedBy: { kind: "human" as const, id: "local-actor-test" },
      acceptedAt: "2026-07-21T00:00:00.000Z",
      expiresAt: "2027-07-21T00:00:00.000Z",
      authorityBoundary: "instruction-privilege-is-exact-source-purpose-recipient-and-scope" as const,
      createdAt: "2026-07-21T00:00:00.000Z",
      updatedAt: "2026-07-21T00:00:00.000Z",
    }
    const base = productStudioStub()
    const listDomainPage = vi.fn(async (kind: string, input: { offset?: number; limit?: number } = {}) => ({
      items: kind === "instruction-privilege-grant" ? [grant] : [],
      offset: input.offset ?? 0,
      limit: input.limit ?? 50,
      total: kind === "instruction-privilege-grant" ? 1 : 0,
      hasMore: false,
    }))
    const { source } = harness({ productStudio: { ...base, listDomainPage } as unknown as ProductStudioService })
    const snapshot = await source.readSnapshot("agents-tools")
    if (snapshot.page.kind !== "agents-tools") throw new Error("Expected Agents & Tools page")
    const table = snapshot.page.instructionPrivilegeGrants
    expect(table.rows[0]).toMatchObject({
      id: grant.id,
      state: "active",
      cells: { privilege: "governing-instruction", state: "active", revision: "2" },
    })
    expect(table.actions.some((candidate) => candidate.action.kind === "domain-workflow" &&
      candidate.action.workflow === "create-instruction-privilege-grant")).toBe(true)
    const revoke = table.rows[0]?.actions.find((candidate) => candidate.label === "Revoke")
    expect(revoke).toMatchObject({
      enabled: true,
      action: { workflow: "revoke-instruction-privilege-grant", recordId: grant.id, expectedRevision: 2 },
    })
    expect(await source.execute({ kind: "open-record", recordId: grant.id }, {
      requestId: "inspect-grant",
      expectedContextGeneration: snapshot.contextGeneration,
      expectedSnapshotRevision: snapshot.snapshotRevision,
    })).toMatchObject({ status: "accepted" })
    const inspected = await source.readSnapshot("agents-tools")
    expect(isStudioSnapshot(inspected)).toBe(true)
    expect(inspected.inspector).toMatchObject({
      recordId: grant.id,
      entries: expect.arrayContaining([{ term: "Record type", value: "instruction-privilege-grant" }]),
    })
    expect(inspected.inspector?.entries.find((entry) => entry.term === "Scope summary")?.value).toMatch(/display truncated/i)
  })

  it("projects durable Managed Run evidence and handoff lineage without private provider or machine-local content", async () => {
    const newerRun = {
      ...run,
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      createdAt: "2026-07-21T00:03:00.000Z",
      updatedAt: "2026-07-21T00:03:00.000Z",
    }
    const { source } = harness({
      runs: [run, newerRun],
      managedRuns: [managedRun],
      managedResults: { [managedResultId]: managedResult, [reviewResultId]: reviewResult },
      managedEvidence: { [managedEvidenceId]: managedEvidence, [reviewEvidenceId]: reviewEvidence },
      managedApplyDecisions: { [managedDecisionId]: managedDecision },
      handoffs: [handoff],
    })

    const snapshot = await source.readSnapshot("runs-evidence")
    expect(isStudioSnapshot(snapshot)).toBe(true)
    if (snapshot.page.kind !== "runs-evidence") throw new Error("Expected Runs & Evidence page")

    expect(snapshot.page.managedEvidence.rows[0]).toMatchObject({
      id: managedRunId,
      cells: {
        run: run.id,
        attempt: "1",
        state: "completed",
        outcome: "satisfied · postcondition-evaluator",
        events: "1",
        staging: "1 file(s) · applied",
        applyDecision: "1 file(s) bound",
        observation: "bound graph verified",
      },
    })
    expect(snapshot.page.events.map((event) => event.kind)).toEqual(expect.arrayContaining([
      "Managed attempt 1",
      "output",
      "durable result",
      "durable evidence",
      "apply decision",
    ]))
    expect(snapshot.page.events.find((event) => event.kind === "output")?.summary)
      .toContain(`sha256:${"c".repeat(64)}`)
    expect(snapshot.page.events.find((event) => event.kind === "output")?.summary).toMatch(/2 redaction\(s\)/i)
    expect(snapshot.page.handoffs.rows[0]).toMatchObject({
      id: handoff.id,
      cells: {
        fromRun: run.id,
        target: "claude-code-cli / sonnet",
        workspace: "1 workspace-relative change(s) · observed",
        evidence: "1 evidence reference(s)",
        unresolved: "1",
        status: "acknowledged",
      },
    })

    const serialized = JSON.stringify(snapshot)
    for (const privateValue of [
      "machine-local-actor-must-not-render",
      "must-not-render",
      "free text must not render",
      "src/safe.ts",
      "/machine-only",
    ]) expect(serialized).not.toContain(privateValue)

    const select = snapshot.page.managedEvidence.rows[0]?.actions[0]
    if (!select) throw new Error("Expected Managed Run selection action")
    expect(await source.execute(select.action, {
      requestId: "select-managed-underlying-run",
      expectedContextGeneration: snapshot.contextGeneration,
      expectedSnapshotRevision: snapshot.snapshotRevision,
    })).toMatchObject({ status: "accepted" })
    const selected = await source.readSnapshot("runs-evidence")
    if (selected.page.kind !== "runs-evidence") throw new Error("Expected Runs & Evidence page")
    expect(selected.page.selectedRun).toEqual(expect.arrayContaining([
      { term: "Run", value: run.id, recordId: run.id },
      { term: "Managed lineage", value: `Latest observed attempt 1; 1 record(s) shown in the bounded window; complete lineage is not inferred; root ${managedRunId}` },
      { term: "Handoff lineage", value: "1 portable handoff(s) originate from this Run." },
    ]))
  })

  it("presents pending review as provisional and opens only the existing exact discard workflow", async () => {
    const pendingInput = structuredClone(managedRun)
    delete pendingInput.endedAt
    delete pendingInput.applyDecisionId
    delete pendingInput.applyDecisionDigest
    const pendingRun = managedRunRecordSchema.parse({
      ...pendingInput,
      revision: 2,
      state: "review-required",
      resultId: reviewResult.id,
      resultDigest: canonicalDigest(reviewResult),
      updatedAt: "2026-07-21T00:01:01.000Z",
    })
    const { source, commands } = harness({
      managedRuns: [pendingRun],
      managedResults: { [reviewResultId]: reviewResult },
      managedEvidence: { [reviewEvidenceId]: reviewEvidence },
    })
    const snapshot = await source.readSnapshot("runs-evidence")
    if (snapshot.page.kind !== "runs-evidence") throw new Error("Expected Runs & Evidence page")
    const row = snapshot.page.recovery.rows[0]
    expect(row).toMatchObject({
      state: "pending-review",
      cells: {
        persistedState: "review-required",
        attention: "Pending human review",
        boundary: expect.stringMatching(/not approval, apply success, or Product outcome completion/i),
      },
    })
    const discard = row?.actions.find((action) => action.action.kind === "open-managed-discard")
    expect(discard).toMatchObject({
      label: "Open exact discard review",
      enabled: true,
      emphasis: "danger",
      action: { managedRunId, expectedRevision: 2 },
    })
    if (!discard) throw new Error("Expected exact discard review action")
    expect(await source.execute(discard.action, {
      requestId: "open-managed-discard",
      expectedContextGeneration: snapshot.contextGeneration,
      expectedSnapshotRevision: snapshot.snapshotRevision,
    })).toMatchObject({
      status: "accepted",
      announcement: expect.stringMatching(/No discard or cleanup result is claimed/i),
    })
    expect(commands).toContainEqual({
      command: "gaep.reviewManagedRun",
      args: [managedRunId, "discard-only", 2],
    })
  })

  it("accepts the applying transition only when the exact current review Result and receipt are bound", async () => {
    const applyingInput = structuredClone(managedRun)
    delete applyingInput.endedAt
    const applyingRun = managedRunRecordSchema.parse({
      ...applyingInput,
      revision: managedDecision.managedRunRevision + 1,
      state: "applying",
      resultId: reviewResult.id,
      resultDigest: canonicalDigest(reviewResult),
      updatedAt: "2026-07-21T00:01:03.000Z",
    })
    const { source } = harness({
      managedRuns: [applyingRun],
      managedResults: { [reviewResultId]: reviewResult },
      managedEvidence: { [reviewEvidenceId]: reviewEvidence },
      managedApplyDecisions: { [managedDecisionId]: managedDecision },
    })
    const snapshot = await source.readSnapshot("runs-evidence")
    if (snapshot.page.kind !== "runs-evidence") throw new Error("Expected Runs & Evidence page")
    expect(snapshot.page.managedEvidence.rows[0]?.cells).toMatchObject({
      state: "applying",
      outcome: "not-assessed · not-evaluated",
      observation: "bound graph verified",
    })
    expect(snapshot.page.recovery.rows[0]).toMatchObject({
      state: "recovery-deferred",
      cells: {
        persistedState: "applying",
        attention: "Apply or restart recovery is deferred",
        boundary: expect.stringMatching(/non-terminal.*not inferred/i),
      },
    })
    expect(snapshot.page.recovery.rows[0]?.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: { kind: "retry-recovery" } }),
    ]))
    expect(snapshot.page.events.map((event) => event.kind)).toContain("apply decision")
  })

  it("rejects a schema-valid current Result whose terminal state contradicts its Managed Run", async () => {
    const mismatchedRun = managedRunRecordSchema.parse({ ...managedRun, state: "failed" })
    const { source } = harness({
      managedRuns: [mismatchedRun],
      managedResults: { [managedResultId]: managedResult, [reviewResultId]: reviewResult },
      managedEvidence: { [managedEvidenceId]: managedEvidence, [reviewEvidenceId]: reviewEvidence },
      managedApplyDecisions: { [managedDecisionId]: managedDecision },
    })
    const snapshot = await source.readSnapshot("runs-evidence")
    if (snapshot.page.kind !== "runs-evidence") throw new Error("Expected Runs & Evidence page")
    expect(snapshot.page.managedEvidence.rows[0]?.cells.observation).toMatch(/could not be verified/i)
    for (const kind of ["durable result", "durable evidence", "apply decision"]) {
      expect(snapshot.page.events.map((event) => event.kind)).not.toContain(kind)
    }
  })

  it("preserves applied mutation truth when a later Workflow postcondition fails", async () => {
    const failedAttempt = {
      ...completedAttempt,
      state: "failed" as const,
      postconditionStatus: "failed" as const,
    }
    const failedEvidence = managedRunEvidenceSchema.parse({
      ...managedEvidence,
      workflow: {
        ...managedEvidence.workflow,
        attempts: [failedAttempt],
        completedStepIds: [],
        terminalReasonCode: "postcondition-failed",
      },
    })
    const failedResult = managedRunResultSchema.parse({
      ...managedResult,
      outcome: { ...managedResult.outcome, status: "failed" },
      terminalState: "failed",
      evidenceDigest: canonicalDigest(failedEvidence),
    })
    const failedRun = managedRunRecordSchema.parse({
      ...managedRun,
      state: "failed",
      resultDigest: canonicalDigest(failedResult),
    })
    const { source } = harness({
      managedRuns: [failedRun],
      managedResults: { [managedResultId]: failedResult, [reviewResultId]: reviewResult },
      managedEvidence: { [managedEvidenceId]: failedEvidence, [reviewEvidenceId]: reviewEvidence },
      managedApplyDecisions: { [managedDecisionId]: managedDecision },
    })
    const snapshot = await source.readSnapshot("runs-evidence")
    if (snapshot.page.kind !== "runs-evidence") throw new Error("Expected Runs & Evidence page")
    expect(snapshot.page.managedEvidence.rows[0]?.cells).toMatchObject({
      state: "failed",
      outcome: "failed · postcondition-evaluator",
      observation: "bound graph verified",
    })
    expect(snapshot.page.events.find((event) => event.kind === "durable evidence")?.summary)
      .toContain("reversible-change=applied")
  })

  it("accepts both exact current-engine discard encodings only with an exact review predecessor", async () => {
    const discardEvidenceId = "abababab-abab-4bab-8bab-abababababab"
    const discardResultId = "acacacac-acac-4cac-8cac-acacacacacac"
    const discardedAttempt = {
      ...reviewAttempt,
      revision: reviewAttempt.revision + 1,
      previousSnapshotDigest: canonicalDigest(reviewAttempt),
      state: "discarded" as const,
      endedAt: "2026-07-21T00:01:03.000Z",
    }
    const discardedStaging = { ...reviewStaging, applyState: "discarded" as const }
    const discardDigests = [
      canonicalDigest({
        effect: "reversible-change",
        disposition: "discarded",
        eventsDigest: canonicalDigest(managedEvents),
      }),
      canonicalDigest({
        priorEvidenceDigest: canonicalDigest(reviewEvidence),
        effect: "reversible-change",
        disposition: "durable-review-discarded",
      }),
    ]
    for (const effectDigest of discardDigests) {
      const discardedEvidence = managedRunEvidenceSchema.parse({
        ...reviewEvidence,
        id: discardEvidenceId,
        workflow: {
          ...reviewEvidence.workflow,
          attempts: [discardedAttempt],
          terminalReasonCode: "staged-changes-discarded",
        },
        staging: discardedStaging,
        actualEffects: [{ effect: "reversible-change", status: "blocked", evidenceDigest: effectDigest }],
        capturedAt: "2026-07-21T00:01:03.000Z",
      })
      const discardedResult = managedRunResultSchema.parse({
        ...reviewResult,
        id: discardResultId,
        terminalState: "discarded",
        evidenceId: discardedEvidence.id,
        evidenceDigest: canonicalDigest(discardedEvidence),
        previousResultId: reviewResult.id,
        previousResultDigest: canonicalDigest(reviewResult),
        endedAt: "2026-07-21T00:01:03.000Z",
      })
      const discardedRunInput = structuredClone(managedRun)
      delete discardedRunInput.applyDecisionId
      delete discardedRunInput.applyDecisionDigest
      const discardedRun = managedRunRecordSchema.parse({
        ...discardedRunInput,
        revision: 3,
        state: "discarded",
        resultId: discardedResult.id,
        resultDigest: canonicalDigest(discardedResult),
        updatedAt: "2026-07-21T00:01:03.000Z",
        endedAt: "2026-07-21T00:01:03.000Z",
      })
      const { source } = harness({
        managedRuns: [discardedRun],
        managedResults: { [discardResultId]: discardedResult, [reviewResultId]: reviewResult },
        managedEvidence: { [discardEvidenceId]: discardedEvidence, [reviewEvidenceId]: reviewEvidence },
      })
      const snapshot = await source.readSnapshot("runs-evidence")
      if (snapshot.page.kind !== "runs-evidence") throw new Error("Expected Runs & Evidence page")
      expect(snapshot.page.managedEvidence.rows[0]?.cells).toMatchObject({
        state: "discarded",
        observation: "bound graph verified",
      })
    }
  })

  it("rejects discard-only effect digests outside discarded staging", async () => {
    const misusedEvidence = managedRunEvidenceSchema.parse({
      ...managedEvidence,
      actualEffects: [{
        ...managedEvidence.actualEffects[0]!,
        evidenceDigest: canonicalDigest({
          effect: "reversible-change",
          disposition: "discarded",
          eventsDigest: managedEvidence.eventsDigest,
        }),
      }],
    })
    const reboundResult = managedRunResultSchema.parse({
      ...managedResult,
      evidenceDigest: canonicalDigest(misusedEvidence),
    })
    const reboundRun = managedRunRecordSchema.parse({
      ...managedRun,
      resultDigest: canonicalDigest(reboundResult),
    })
    const { source } = harness({
      managedRuns: [reboundRun],
      managedResults: { [managedResultId]: reboundResult, [reviewResultId]: reviewResult },
      managedEvidence: { [managedEvidenceId]: misusedEvidence, [reviewEvidenceId]: reviewEvidence },
      managedApplyDecisions: { [managedDecisionId]: managedDecision },
    })
    const snapshot = await source.readSnapshot("runs-evidence")
    if (snapshot.page.kind !== "runs-evidence") throw new Error("Expected Runs & Evidence page")
    expect(snapshot.page.managedEvidence.rows[0]?.cells.observation).toMatch(/could not be verified/i)
    expect(snapshot.page.events.map((event) => event.kind)).not.toContain("durable evidence")
  })

  it("rejects a discarded Result whose exact predecessor was not a review or conflict", async () => {
    const discardEvidenceId = "adadadad-adad-4dad-8dad-adadadadadad"
    const discardResultId = "aeaeaeae-aeae-4eae-8eae-aeaeaeaeaeae"
    const discardedAttempt = {
      ...reviewAttempt,
      revision: reviewAttempt.revision + 1,
      previousSnapshotDigest: canonicalDigest(reviewAttempt),
      state: "discarded" as const,
      endedAt: "2026-07-21T00:01:06.000Z",
    }
    const discardedEvidence = managedRunEvidenceSchema.parse({
      ...reviewEvidence,
      id: discardEvidenceId,
      workflow: {
        ...reviewEvidence.workflow,
        attempts: [discardedAttempt],
        terminalReasonCode: "staged-changes-discarded",
      },
      staging: { ...reviewStaging, applyState: "discarded" },
      actualEffects: [{
        effect: "reversible-change",
        status: "blocked",
        evidenceDigest: canonicalDigest({
          effect: "reversible-change",
          disposition: "discarded",
          eventsDigest: canonicalDigest(managedEvents),
        }),
      }],
      capturedAt: "2026-07-21T00:01:06.000Z",
    })
    const discardedResult = managedRunResultSchema.parse({
      ...reviewResult,
      id: discardResultId,
      terminalState: "discarded",
      evidenceId: discardedEvidence.id,
      evidenceDigest: canonicalDigest(discardedEvidence),
      previousResultId: managedResult.id,
      previousResultDigest: canonicalDigest(managedResult),
      endedAt: "2026-07-21T00:01:06.000Z",
    })
    const discardedRunInput = structuredClone(managedRun)
    delete discardedRunInput.applyDecisionId
    delete discardedRunInput.applyDecisionDigest
    const discardedRun = managedRunRecordSchema.parse({
      ...discardedRunInput,
      state: "discarded",
      resultId: discardedResult.id,
      resultDigest: canonicalDigest(discardedResult),
      updatedAt: "2026-07-21T00:01:06.000Z",
      endedAt: "2026-07-21T00:01:06.000Z",
    })
    const { source } = harness({
      managedRuns: [discardedRun],
      managedResults: { [discardResultId]: discardedResult, [managedResultId]: managedResult },
      managedEvidence: { [discardEvidenceId]: discardedEvidence, [managedEvidenceId]: managedEvidence },
    })
    const snapshot = await source.readSnapshot("runs-evidence")
    if (snapshot.page.kind !== "runs-evidence") throw new Error("Expected Runs & Evidence page")
    expect(snapshot.page.managedEvidence.rows[0]?.cells.observation).toMatch(/could not be verified/i)
    expect(snapshot.page.events.map((event) => event.kind)).not.toContain("durable result")
  })

  it("withholds all Managed and handoff semantic artifacts when the audit trust anchor is invalid", async () => {
    const { source } = harness({
      audit: { valid: false, events: 8, error: "tampered audit" },
      managedRuns: [managedRun],
      managedResults: { [managedResultId]: managedResult, [reviewResultId]: reviewResult },
      managedEvidence: { [managedEvidenceId]: managedEvidence, [reviewEvidenceId]: reviewEvidence },
      managedApplyDecisions: { [managedDecisionId]: managedDecision },
      handoffs: [handoff],
    })
    const snapshot = await source.readSnapshot("runs-evidence")
    if (snapshot.page.kind !== "runs-evidence") throw new Error("Expected Runs & Evidence page")
    expect(snapshot.page.managedEvidence.rows).toEqual([])
    expect(snapshot.page.managedEvidence.emptyState?.title).toBe("Managed execution evidence unavailable")
    expect(snapshot.page.recovery.rows).toEqual([])
    expect(snapshot.page.recovery.emptyState).toMatchObject({
      title: "Recovery observation unavailable",
      detail: expect.stringMatching(/audit.*could not be verified.*No absence or success claim/i),
    })
    expect(snapshot.page.handoffs.rows).toEqual([])
    expect(snapshot.page.handoffs.emptyState).toMatchObject({
      title: "Portable handoff history unavailable",
      detail: expect.stringMatching(/does not assert that handoff history is absent/i),
    })
    const serialized = JSON.stringify(snapshot)
    expect(serialized).not.toContain(managedResultId)
    expect(serialized).not.toContain(managedEvidenceId)
    expect(serialized).not.toContain(managedDecisionId)
    expect(serialized).not.toContain(handoff.id)
    expect(serialized).not.toContain("claude-code-cli")
    expect(serialized).not.toContain("machine-local-actor-must-not-render")
  })

  it("rejects a self-consistently rebound outer graph when its internal event-set digest is stale", async () => {
    const staleEvidence = managedRunEvidenceSchema.parse({
      ...managedEvidence,
      eventsDigest: `sha256:${"3".repeat(64)}`,
    })
    const reboundResult = managedRunResultSchema.parse({
      ...managedResult,
      evidenceDigest: canonicalDigest(staleEvidence),
    })
    const reboundRun = managedRunRecordSchema.parse({
      ...managedRun,
      resultDigest: canonicalDigest(reboundResult),
    })
    const { source } = harness({
      managedRuns: [reboundRun],
      managedResults: { [managedResultId]: reboundResult, [reviewResultId]: reviewResult },
      managedEvidence: { [managedEvidenceId]: staleEvidence, [reviewEvidenceId]: reviewEvidence },
      managedApplyDecisions: { [managedDecisionId]: managedDecision },
    })
    const snapshot = await source.readSnapshot("runs-evidence")
    if (snapshot.page.kind !== "runs-evidence") throw new Error("Expected Runs & Evidence page")
    expect(snapshot.page.managedEvidence.rows[0]?.cells.observation).toMatch(/could not be verified/i)
    for (const kind of ["durable result", "durable evidence", "apply decision"]) {
      expect(snapshot.page.events.map((event) => event.kind)).not.toContain(kind)
    }
    expect(JSON.stringify(snapshot)).not.toContain(`sha256:${"c".repeat(64)}`)
  })

  it("rejects self-consistent outer bindings when provider or Workflow outcome semantics contradict the Run", async () => {
    const wrongProviderResult = managedRunResultSchema.parse({
      ...managedResult,
      provider: { ...managedResult.provider, modelId: "different-model" },
    })
    const contradictoryWorkflowEvidence = managedRunEvidenceSchema.parse({
      ...managedEvidence,
      workflow: { ...managedEvidence.workflow, terminalReasonCode: "workflow-not-completed" },
    })
    const contradictoryWorkflowResult = managedRunResultSchema.parse({
      ...managedResult,
      evidenceDigest: canonicalDigest(contradictoryWorkflowEvidence),
    })
    for (const candidate of [
      { result: wrongProviderResult, evidence: managedEvidence },
      { result: contradictoryWorkflowResult, evidence: contradictoryWorkflowEvidence },
    ]) {
      const reboundRun = managedRunRecordSchema.parse({
        ...managedRun,
        resultDigest: canonicalDigest(candidate.result),
      })
      const { source } = harness({
        managedRuns: [reboundRun],
        managedResults: { [managedResultId]: candidate.result, [reviewResultId]: reviewResult },
        managedEvidence: { [managedEvidenceId]: candidate.evidence, [reviewEvidenceId]: reviewEvidence },
        managedApplyDecisions: { [managedDecisionId]: managedDecision },
      })
      const snapshot = await source.readSnapshot("runs-evidence")
      if (snapshot.page.kind !== "runs-evidence") throw new Error("Expected Runs & Evidence page")
      expect(snapshot.page.managedEvidence.rows[0]?.cells.observation).toMatch(/could not be verified/i)
      for (const kind of ["durable result", "durable evidence", "apply decision"]) {
        expect(snapshot.page.events.map((event) => event.kind)).not.toContain(kind)
      }
    }
  })

  it("rejects a schema-valid Managed Run whose canonical bindings digest is stale", async () => {
    const staleRun = managedRunRecordSchema.parse({
      ...managedRun,
      bindingsDigest: `sha256:${"3".repeat(64)}`,
    })
    const { source } = harness({
      managedRuns: [staleRun],
      managedResults: { [managedResultId]: managedResult, [reviewResultId]: reviewResult },
      managedEvidence: { [managedEvidenceId]: managedEvidence, [reviewEvidenceId]: reviewEvidence },
      managedApplyDecisions: { [managedDecisionId]: managedDecision },
    })
    const snapshot = await source.readSnapshot("runs-evidence")
    if (snapshot.page.kind !== "runs-evidence") throw new Error("Expected Runs & Evidence page")
    expect(snapshot.page.managedEvidence.rows[0]?.cells.observation).toMatch(/could not be verified/i)
    expect(snapshot.page.events.map((event) => event.kind)).not.toContain("durable result")
  })

  it("rejects a rebound apply receipt whose inventory digest is not internally exact", async () => {
    const staleDecision = managedApplyDecisionReceiptSchema.parse({
      ...managedDecision,
      changedInventoryDigest: `sha256:${"3".repeat(64)}`,
    })
    const reboundEvidence = managedRunEvidenceSchema.parse({
      ...managedEvidence,
      staging: {
        ...managedEvidence.staging,
        applyDecision: { receiptId: staleDecision.id, receiptDigest: canonicalDigest(staleDecision) },
      },
    })
    const reboundResult = managedRunResultSchema.parse({
      ...managedResult,
      evidenceDigest: canonicalDigest(reboundEvidence),
    })
    const reboundRun = managedRunRecordSchema.parse({
      ...managedRun,
      applyDecisionDigest: canonicalDigest(staleDecision),
      resultDigest: canonicalDigest(reboundResult),
    })
    const { source } = harness({
      managedRuns: [reboundRun],
      managedResults: { [managedResultId]: reboundResult, [reviewResultId]: reviewResult },
      managedEvidence: { [managedEvidenceId]: reboundEvidence, [reviewEvidenceId]: reviewEvidence },
      managedApplyDecisions: { [managedDecisionId]: staleDecision },
    })
    const snapshot = await source.readSnapshot("runs-evidence")
    if (snapshot.page.kind !== "runs-evidence") throw new Error("Expected Runs & Evidence page")
    expect(snapshot.page.managedEvidence.rows[0]?.cells.observation).toMatch(/could not be verified/i)
    expect(snapshot.page.events.map((event) => event.kind)).not.toContain("apply decision")
  })

  it("uses the persisted attempt number and never promotes the bounded record count to complete lineage", async () => {
    const initial = managedRecordWithoutArtifacts(
      "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      run,
      "2026-07-22T00:00:00.000Z",
    )
    const resumed = managedRunRecordSchema.parse({
      ...initial,
      rootManagedRunId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      previousManagedRunId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      attemptNumber: 5,
    })
    const { source } = harness({ managedRuns: [resumed] })
    const snapshot = await source.readSnapshot("runs-evidence")
    if (snapshot.page.kind !== "runs-evidence") throw new Error("Expected Runs & Evidence page")
    expect(snapshot.page.runs.rows[0]?.cells.attempts).toBe("latest attempt 5; 1 shown")
    expect(snapshot.page.selectedRun.find((entry) => entry.term === "Managed lineage")?.value)
      .toMatch(/Latest observed attempt 5; 1 record\(s\) shown.*complete lineage is not inferred/i)
  })

  it("keeps long composed handoff fields protocol-safe and exposes the exact observation boundary", async () => {
    const longHandoff = handoffSchema.parse({
      ...handoff,
      id: "abababab-abab-4bab-8bab-abababababab",
      toAgent: { ...handoff.toAgent, modelId: `m${"x".repeat(19_999)}` },
    })
    const { source } = harness({
      handoffs: [longHandoff],
      handoffTotal: 250,
      handoffSelectedFileCount: 200,
      handoffOmittedOutsideWindow: 50,
      handoffOmittedForResourceSafety: 199,
    })
    const snapshot = await source.readSnapshot("runs-evidence")
    expect(isStudioSnapshot(snapshot)).toBe(true)
    if (snapshot.page.kind !== "runs-evidence") throw new Error("Expected Runs & Evidence page")
    const target = snapshot.page.handoffs.rows[0]?.cells.target ?? ""
    expect(target.length).toBeLessThanOrEqual(20_000)
    expect(target).toMatch(/display truncated/i)
    expect(snapshot.page.handoffs.truncation).toMatchObject({ shown: 1, total: 250 })
    expect(snapshot.page.handoffs.truncation?.message).toMatch(/deterministic filename window.*byte or stable-file identity limits.*does not assert global recency or absence/i)
  })

  it("states the native-Windows no-follow limitation when handoff contents are withheld", async () => {
    const { source } = harness({
      handoffTotal: 2,
      handoffSelectedFileCount: 2,
      handoffOmittedForResourceSafety: 2,
      handoffPlatformAttestationUnavailable: true,
    })
    const snapshot = await source.readSnapshot("runs-evidence")
    if (snapshot.page.kind !== "runs-evidence") throw new Error("Expected Runs & Evidence page")
    expect(snapshot.page.handoffs.emptyState).toMatchObject({
      title: "Portable handoff details withheld by safety bounds",
      detail: expect.stringMatching(/native Windows cannot attest no-follow file identity/i),
    })
    expect(snapshot.page.handoffs.truncation?.message).toMatch(/native Windows cannot attest no-follow file identity/i)
  })

  it("distinguishes an unavailable Managed Run observation from verified absence", async () => {
    const { source } = harness({ managedObservationError: new Error("private reader failure must not render") })
    const snapshot = await source.readSnapshot("runs-evidence")
    if (snapshot.page.kind !== "runs-evidence") throw new Error("Expected Runs & Evidence page")
    expect(snapshot.page.managedEvidence.emptyState).toMatchObject({
      title: "Managed execution evidence unavailable",
      detail: expect.stringMatching(/does not assert that evidence is absent/i),
    })
    expect(snapshot.page.selectedRun.find((entry) => entry.term === "Managed evidence")?.value)
      .toMatch(/observation is unavailable.*no absence claim/i)
    expect(snapshot.page.runs.rows[0]?.cells).toMatchObject({ managed: "observation unavailable", attempts: "unavailable" })
    expect(snapshot.page.recovery.emptyState).toMatchObject({
      title: "Recovery observation unavailable",
      detail: expect.stringMatching(/No absence or success claim/i),
    })
    expect(JSON.stringify(snapshot)).not.toContain("private reader failure must not render")
  })

  it("distinguishes unavailable portable handoff history from verified absence", async () => {
    const { source } = harness({ handoffObservationError: new Error("private handoff failure must not render") })
    const snapshot = await source.readSnapshot("runs-evidence")
    if (snapshot.page.kind !== "runs-evidence") throw new Error("Expected Runs & Evidence page")
    expect(snapshot.page.handoffs.emptyState).toMatchObject({
      title: "Portable handoff history unavailable",
      detail: expect.stringMatching(/does not assert that handoff history is absent/i),
    })
    expect(snapshot.page.selectedRun.find((entry) => entry.term === "Handoff lineage")?.value)
      .toMatch(/observation is unavailable.*no absence claim/i)
    expect(JSON.stringify(snapshot)).not.toContain("private handoff failure must not render")
  })

  it("does not claim a Run is unmanaged when its durable record may be outside the bounded view", async () => {
    const otherRunId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    const otherRun: Run = {
      ...run,
      id: otherRunId,
      state: "prepared",
      startedAt: undefined,
      endedAt: undefined,
    }
    const newerRecords = Array.from({ length: 200 }, (_, index) => {
      const id = `aaaa0000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`
      return managedRecordWithoutArtifacts(id, otherRun, "2026-07-22T00:00:00.000Z")
    })
    const omittedSelectedRecord = managedRecordWithoutArtifacts(
      managedRunId,
      run,
      "2026-07-20T00:00:00.000Z",
    )
    const { source, managedPageRequests } = harness({ managedRuns: [...newerRecords, omittedSelectedRecord] })
    const snapshot = await source.readSnapshot("runs-evidence")
    if (snapshot.page.kind !== "runs-evidence") throw new Error("Expected Runs & Evidence page")
    expect(snapshot.page.managedEvidence.truncation).toMatchObject({ shown: 200, total: 201 })
    expect(snapshot.page.recovery.truncation).toMatchObject({ shown: 200, total: 201 })
    expect(snapshot.page.recovery.truncation?.message).toMatch(/newest 200.*Older persisted recovery states are not interpreted/i)
    expect(snapshot.page.selectedRun.find((entry) => entry.term === "Managed evidence")?.value)
      .toMatch(/No Managed Run.*is present in the newest 200 of 201.*may or may not contain one/i)
    expect(snapshot.page.runs.rows[0]?.cells).toMatchObject({
      managed: "not present in newest bounded window",
      attempts: "0 shown; older unknown",
    })
    expect(managedPageRequests).toEqual([{ offset: 0, limit: 200 }])
  })

  it("does not invent an omitted binding for a Run merely because the global Managed window is truncated", async () => {
    const otherRun: Run = {
      ...run,
      id: "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd",
      state: "prepared",
      startedAt: undefined,
      endedAt: undefined,
    }
    const otherRecords = Array.from({ length: 201 }, (_, index) => managedRecordWithoutArtifacts(
      `bbbb0000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`,
      otherRun,
      "2026-07-22T00:00:00.000Z",
    ))
    const { source } = harness({ managedRuns: otherRecords })
    const snapshot = await source.readSnapshot("runs-evidence")
    if (snapshot.page.kind !== "runs-evidence") throw new Error("Expected Runs & Evidence page")
    const claim = snapshot.page.selectedRun.find((entry) => entry.term === "Managed evidence")?.value ?? ""
    expect(claim).toMatch(/omitted records may or may not contain one/i)
    expect(claim).not.toMatch(/A bound Managed Run/i)
  })

  it("withholds every bound artifact when a Managed Run digest does not verify", async () => {
    const tamperedResult = managedRunResultSchema.parse({
      ...managedResult,
      warnings: [...managedResult.warnings, "runtime-warning"],
    })
    const { source } = harness({
      managedRuns: [managedRun],
      managedResults: { [managedResultId]: tamperedResult },
      managedEvidence: { [managedEvidenceId]: managedEvidence },
      managedApplyDecisions: { [managedDecisionId]: managedDecision },
    })
    const snapshot = await source.readSnapshot("runs-evidence")
    if (snapshot.page.kind !== "runs-evidence") throw new Error("Expected Runs & Evidence page")
    expect(snapshot.page.managedEvidence.rows[0]?.cells.observation).toMatch(/could not be verified/i)
    for (const withheldKind of ["durable result", "durable evidence", "apply decision"]) {
      expect(snapshot.page.events.map((event) => event.kind)).not.toContain(withheldKind)
    }
    expect(JSON.stringify(snapshot)).not.toContain("Provider failed")
  })

  it("exposes every Product-domain creation workflow from its keyboard-renderable route", async () => {
    const { source } = harness()
    const snapshots = await Promise.all([
      source.readSnapshot("delivery"),
      source.readSnapshot("scope"),
      source.readSnapshot("architecture"),
      source.readSnapshot("risks-decisions"),
      source.readSnapshot("agents-tools"),
      source.readSnapshot("runs-evidence"),
      source.readSnapshot("trace"),
    ])
    const actions = JSON.stringify(snapshots.map((snapshot) => snapshot.page))
    for (const workflow of [
      "create-change", "create-work-item", "create-requirement", "create-architecture", "create-decision", "create-risk",
      "create-context-pack", "create-workflow-plan", "create-tool-definition", "create-run-tool-selection", "create-evidence",
      "create-instruction-privilege-grant", "create-trace-link",
    ]) expect(actions, workflow).toContain(`\"workflow\":\"${workflow}\"`)
  })
})
