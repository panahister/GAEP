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
  }
  const context: CurrentEngineStudioContext = {
    contextGeneration: () => contextGeneration,
    deliveryPhase: () => "phase-0-1a-foundation",
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
    const { source } = harness({ productStudio: service })
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
