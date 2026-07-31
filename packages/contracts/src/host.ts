import { z } from "zod"

import { portableSelectionSettingsSchema } from "./agent.js"
import { businessCapabilityMapInputSchema } from "./business-capability-map.js"
import { backlogHierarchyInputSchema } from "./backlog-hierarchy.js"
import { mvpSliceDefinitionInputSchema } from "./mvp-slice-definition.js"
import { prioritizationModelInputSchema } from "./prioritization-model.js"
import { acceptanceCriteriaInputSchema } from "./acceptance-criteria.js"
import { definitionOfReadyInputSchema } from "./definition-of-ready.js"
import { definitionOfDoneInputSchema } from "./definition-of-done.js"
import { implementationUnitModelInputSchema } from "./implementation-unit-model.js"
import { dependencyMappingInputSchema } from "./dependency-mapping.js"
import { technologyProfileInputSchema } from "./technology-profile.js"
import { boilerplateRegistryInputSchema } from "./boilerplate-registry.js"
import { boilerplateSelectionBindingInputSchema } from "./boilerplate-selection-binding.js"
import { boilerplateCompatibilityValidationInputSchema } from "./boilerplate-compatibility-validation.js"
import { figmaToBoilerplateMappingInputSchema } from "./figma-to-boilerplate-mapping.js"
import { designToCodeBindingRegistryInputSchema } from "./design-to-code-binding-registry.js"
import { routeScreenComponentMappingInputSchema } from "./route-screen-component-mapping.js"
import { testMethodologyInputSchema } from "./test-methodology.js"
import { testInventoryInputSchema } from "./test-inventory.js"
import { highLevelDesignInputSchema } from "./high-level-design.js"
import { lowLevelDesignInputSchema } from "./low-level-design.js"
import { implementationReadinessGateInputSchema } from "./implementation-readiness-gate.js"
import { changedUnitInventoryInputSchema } from "./changed-unit-inventory.js"
import { proposedChangePreviewInputSchema } from "./proposed-change-preview.js"
import { businessArchitectureBaselineInputSchema } from "./business-architecture-baseline.js"
import { businessRuleCatalogInputSchema } from "./business-rule-catalog.js"
import {
  businessUnderstandingInputSchema,
  outcomeModelInputSchema,
  stakeholderModelInputSchema,
} from "./business-understanding.js"
import {
  agentModelDashboardRequestSchema,
  changeImpactChangeCatalogRequestSchema,
  changeImpactDashboardRequestSchema,
  phaseDashboardCompositionRequestSchema,
} from "./dashboard.js"
import { phase1SummaryDashboardRequestSchema } from "./phase1-summary-dashboard.js"
import { phase1ChangeImpactDashboardRequestSchema } from "./phase1-change-impact-dashboard.js"
import { phase1AgentModelDashboardRequestSchema } from "./phase1-agent-model-dashboard.js"
import { phase2UxFigmaDashboardRequestSchema } from "./phase2-ux-figma-dashboard.js"
import { phase2ChangeImpactAgentModelDashboardRequestSchema } from "./phase2-change-impact-agent-model-dashboard.js"
import { phase3aDashboardRequestSchema } from "./phase3a-dashboard.js"
import { effectDescriptorSchema, toolPermissionSchema } from "./execution.js"
import {
  initiativeApplicabilityMatrixInputSchema,
  initiativeClassificationInputSchema,
  initiativeSchema,
  productSchema,
} from "./product.js"
import { productDomainRecordKindSchema, productExportBundleSchema } from "./product-studio.js"
import {
  sourceBaselineInputSchema,
  sourceProvenanceInputSchema,
  sourceRecordInputSchema,
} from "./source-governance.js"
import { valueStreamModelInputSchema } from "./value-stream-model.js"
import { operatingModelInputSchema } from "./operating-model.js"
import { systemSolutionArchitectureInputSchema } from "./system-solution-architecture.js"
import { boundedContextModelInputSchema } from "./bounded-context-model.js"
import { securityPrivacyAssessmentInputSchema } from "./security-privacy-assessment.js"
import { processModelInputSchema } from "./process-model.js"
import { dataModelInputSchema } from "./data-model.js"
import { authorizationModelInputSchema } from "./authorization-model.js"
import { eventIntegrationModelInputSchema } from "./event-integration-model.js"
import { failureRecoveryModelInputSchema } from "./failure-recovery-model.js"
import { architectureChallengeModelInputSchema } from "./architecture-challenge-model.js"
import { decisionRegisterInputSchema } from "./decision-register.js"
import { riskRegisterInputSchema } from "./risk-register.js"
import { evidenceRegistryInputSchema } from "./evidence-registry.js"
import { endToEndTraceabilityInputSchema } from "./end-to-end-traceability.js"
import { p0P4ReadinessGateInputSchema } from "./p0-p4-readiness-gate.js"
import { p5HandoffPackageInputSchema } from "./p5-handoff-package.js"
import { designApplicabilityInputSchema } from "./design-applicability.js"
import { designPersonaRoleModelInputSchema } from "./design-persona-role-model.js"
import { userJourneyModelInputSchema } from "./user-journey-model.js"
import { informationArchitectureModelInputSchema } from "./information-architecture-model.js"
import { screenStateInventoryInputSchema } from "./screen-state-inventory.js"
import { designRequirementsInputSchema } from "./design-requirements.js"
import { designSystemTokenContractInputSchema } from "./design-system-token-contract.js"
import { accessibilityDesignRulesInputSchema } from "./accessibility-design-rules.js"
import { responsiveMultiPlatformTargetsInputSchema } from "./responsive-multi-platform-targets.js"
import { manualFigmaExecutionPathInputSchema } from "./manual-figma-execution-path.js"
import { figmaMcpCapabilityDiscoveryInputSchema } from "./figma-mcp-capability-discovery.js"
import { figmaReadSnapshotInputSchema } from "./figma-read-snapshot.js"
import { figmaContextImportInputSchema } from "./figma-context-import.js"
import { outboundDesignBriefPackageInputSchema } from "./outbound-design-brief-package.js"
import { governedFigmaWriteInputSchema } from "./governed-figma-write.js"
import { finalizedFigmaSnapshotImportInputSchema } from "./finalized-figma-snapshot-import.js"
import { designToRequirementBindingInputSchema } from "./design-to-requirement-binding.js"
import { designerReadyGateInputSchema } from "./designer-ready-gate.js"
import { designDeltaInputSchema } from "./design-delta.js"
import { designConflictResolutionInputSchema } from "./design-conflict-resolution.js"
import { humanDesignApprovalInputSchema } from "./human-design-approval.js"
import { designBaselineInputSchema } from "./design-baseline.js"
import { designDriftDetectionInputSchema } from "./design-drift-detection.js"

export const hostProtocolVersionSchema = z.number().int().positive().max(1_000)
export const supportedHostProtocolVersionSchema = z.union([z.literal(1), z.literal(2)])
export const hostRequestIdSchema = z.union([z.string().min(1).max(128), z.number().int().safe()])
export const hostActorIdSchema = z.string().trim().min(1).max(256).optional()
export const hostNoParamsSchema = z.object({}).strict()

export const hostProductInputSchema = productSchema.pick({
  name: true,
  summary: true,
  problem: true,
  affectedUsers: true,
  desiredOutcome: true,
  successSignals: true,
  firstWorkflow: true,
  exclusions: true,
  profile: true,
}).strict()

export const hostInitiativeInputSchema = initiativeSchema.pick({
  title: true,
  outcome: true,
  scope: true,
  exclusions: true,
}).strict()

export const hostReadInitiativeParamsSchema = z.object({
  initiativeId: z.string().uuid(),
}).strict()

export const hostClassifyInitiativeParamsSchema = z.object({
  actorId: hostActorIdSchema,
  initiativeId: z.string().uuid(),
  expectedInitiativeRevision: z.number().int().positive(),
  classification: initiativeClassificationInputSchema,
}).strict()

export const hostResolveInitiativeApplicabilityParamsSchema = z.object({
  actorId: hostActorIdSchema,
  initiativeId: z.string().uuid(),
  expectedInitiativeRevision: z.number().int().positive(),
  applicability: initiativeApplicabilityMatrixInputSchema,
}).strict()

export const hostSelectAgentParamsSchema = z.object({
  actorId: hostActorIdSchema,
  adapterId: z.string().trim().min(1).max(200),
  modelId: z.string().trim().min(1).max(500),
  settings: portableSelectionSettingsSchema.default({}),
}).strict()

export const hostMigrateLegacySelectionParamsSchema = z.object({
  actorId: hostActorIdSchema,
  adapterId: z.string().trim().min(1).max(200),
  modelId: z.string().trim().min(1).max(500),
  settings: portableSelectionSettingsSchema.default({}),
  confirmation: z.literal("reconfirm-portable-agent-selection"),
}).strict()

export const hostCreateCharterParamsSchema = z.object({
  actorId: hostActorIdSchema,
  charter: z.object({
    initiativeId: z.string().uuid(),
    objective: z.string().trim().min(4).max(20_000),
    permissions: z.array(toolPermissionSchema).max(256),
    expectedEffects: z.array(effectDescriptorSchema).max(16),
    forbiddenActions: z.array(z.string().trim().min(1).max(2_000)).max(256),
    stopConditions: z.array(z.string().trim().min(1).max(2_000)).min(1).max(256),
    requiredEvidence: z.array(z.string().trim().min(1).max(2_000)).max(256),
  }).strict(),
}).strict()

export const hostCreateHandoffParamsSchema = z.object({
  actorId: hostActorIdSchema,
  handoff: z.object({
    fromRunId: z.string().uuid(),
    toAdapterId: z.string().trim().min(1).max(200),
    toModelId: z.string().trim().min(1).max(500),
    toSettings: portableSelectionSettingsSchema.default({}),
    reason: z.string().trim().min(2).max(5_000),
    completedWork: z.array(z.string().trim().min(1).max(2_000)).max(256),
    unresolvedMatters: z.array(z.string().trim().min(1).max(2_000)).max(256),
    decisions: z.array(z.string().trim().min(1).max(2_000)).max(256),
    evidence: z.array(z.string().trim().min(1).max(2_000)).max(256),
  }).strict(),
}).strict()

export const hostManagedReadOnlyPreviewParamsSchema = z.object({
  charterId: z.string().uuid(),
  workflowPlanId: z.string().uuid(),
}).strict()

export const hostManagedReadOnlyExecuteParamsSchema = z.object({
  actorId: hostActorIdSchema,
  charterId: z.string().uuid(),
  workflowPlanId: z.string().uuid(),
  expectedPreviewDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  timeoutMs: z.number().int().min(1_000).max(300_000),
  confirmation: z.literal("attest-exact-managed-readonly-preview"),
}).strict()

export const hostManagedEvidenceListParamsSchema = z.object({
  offset: z.number().int().nonnegative().max(2_000).default(0),
  limit: z.number().int().min(1).max(200).default(100),
  snapshotDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/).optional(),
}).strict()

export const hostManagedEvidenceReadParamsSchema = z.object({
  managedRunId: z.string().uuid(),
}).strict()

export const hostManagedReviewReadParamsSchema = z.object({
  managedRunId: z.string().uuid(),
}).strict()

const hostManagedReviewDecisionBaseSchema = z.object({
  actorId: hostActorIdSchema,
  managedRunId: z.string().uuid(),
  expectedManagedRunRevision: z.number().int().positive(),
  expectedPreviewDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
}).strict()

export const hostManagedReviewApplyParamsSchema = hostManagedReviewDecisionBaseSchema.extend({
  confirmation: z.literal("apply-exact-managed-review"),
}).strict()

export const hostManagedReviewDiscardParamsSchema = hostManagedReviewDecisionBaseSchema.extend({
  confirmation: z.literal("discard-exact-managed-review"),
}).strict()

export const hostSearchProductStudioParamsSchema = z.object({
  query: z.string().trim().min(2).max(500),
  kinds: z.array(productDomainRecordKindSchema).max(productDomainRecordKindSchema.options.length).optional(),
}).strict()

export const hostImportPreviewParamsSchema = z.object({
  bundle: productExportBundleSchema,
}).strict()

export const hostSourceInitiativeParamsSchema = z.object({
  initiativeId: z.string().uuid(),
}).strict()

export const hostSourceCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  source: sourceRecordInputSchema,
}).strict()

export const hostSourceReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  sourceId: z.string().uuid(),
  expectedSourceRevision: z.number().int().positive(),
  source: sourceRecordInputSchema,
}).strict()

export const hostSourceBaselineCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  baseline: sourceBaselineInputSchema,
}).strict()

export const hostSourceBaselineReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  baselineId: z.string().uuid(),
  expectedBaselineRevision: z.number().int().positive(),
  baseline: sourceBaselineInputSchema,
}).strict()

export const hostSourceProvenanceRecordParamsSchema = z.object({
  actorId: hostActorIdSchema,
  provenance: sourceProvenanceInputSchema,
}).strict()

export const hostBusinessInitiativeParamsSchema = z.object({
  initiativeId: z.string().uuid(),
}).strict()

export const hostBusinessUnderstandingCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: businessUnderstandingInputSchema,
}).strict()

export const hostBusinessUnderstandingReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: businessUnderstandingInputSchema,
}).strict()

export const hostStakeholderModelCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: stakeholderModelInputSchema,
}).strict()

export const hostStakeholderModelReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: stakeholderModelInputSchema,
}).strict()

export const hostOutcomeModelCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: outcomeModelInputSchema,
}).strict()

export const hostOutcomeModelReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: outcomeModelInputSchema,
}).strict()

export const hostBusinessCapabilityMapCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: businessCapabilityMapInputSchema,
}).strict()

export const hostBusinessCapabilityMapReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: businessCapabilityMapInputSchema,
}).strict()

export const hostValueStreamModelCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: valueStreamModelInputSchema,
}).strict()

export const hostValueStreamModelReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: valueStreamModelInputSchema,
}).strict()

export const hostOperatingModelCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: operatingModelInputSchema,
}).strict()

export const hostOperatingModelReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: operatingModelInputSchema,
}).strict()

export const hostBusinessRuleCatalogCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: businessRuleCatalogInputSchema,
}).strict()

export const hostBusinessRuleCatalogReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: businessRuleCatalogInputSchema,
}).strict()

export const hostBusinessArchitectureBaselineCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: businessArchitectureBaselineInputSchema,
}).strict()

export const hostBusinessArchitectureBaselineReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: businessArchitectureBaselineInputSchema,
}).strict()

export const hostSystemSolutionArchitectureCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: systemSolutionArchitectureInputSchema,
}).strict()

export const hostSystemSolutionArchitectureReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: systemSolutionArchitectureInputSchema,
}).strict()

export const hostBoundedContextModelCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: boundedContextModelInputSchema,
}).strict()

export const hostBoundedContextModelReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: boundedContextModelInputSchema,
}).strict()

export const hostSecurityPrivacyAssessmentCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: securityPrivacyAssessmentInputSchema,
}).strict()

export const hostSecurityPrivacyAssessmentReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: securityPrivacyAssessmentInputSchema,
}).strict()

export const hostProcessModelCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: processModelInputSchema,
}).strict()

export const hostProcessModelReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: processModelInputSchema,
}).strict()

export const hostDataModelCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: dataModelInputSchema,
}).strict()

export const hostDataModelReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: dataModelInputSchema,
}).strict()

export const hostAuthorizationModelCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: authorizationModelInputSchema,
}).strict()

export const hostAuthorizationModelReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: authorizationModelInputSchema,
}).strict()

export const hostEventIntegrationModelCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: eventIntegrationModelInputSchema,
}).strict()

export const hostEventIntegrationModelReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: eventIntegrationModelInputSchema,
}).strict()

export const hostFailureRecoveryModelCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: failureRecoveryModelInputSchema,
}).strict()

export const hostFailureRecoveryModelReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: failureRecoveryModelInputSchema,
}).strict()

export const hostArchitectureChallengeModelCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: architectureChallengeModelInputSchema,
}).strict()

export const hostArchitectureChallengeModelReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: architectureChallengeModelInputSchema,
}).strict()

export const hostDecisionRegisterCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: decisionRegisterInputSchema,
}).strict()

export const hostDecisionRegisterReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: decisionRegisterInputSchema,
}).strict()

export const hostRiskRegisterCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: riskRegisterInputSchema,
}).strict()

export const hostRiskRegisterReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: riskRegisterInputSchema,
}).strict()

export const hostEvidenceRegistryCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: evidenceRegistryInputSchema,
}).strict()

export const hostEvidenceRegistryReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: evidenceRegistryInputSchema,
}).strict()

export const hostEndToEndTraceabilityCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: endToEndTraceabilityInputSchema,
}).strict()

export const hostEndToEndTraceabilityReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: endToEndTraceabilityInputSchema,
}).strict()

export const hostP0P4ReadinessGateCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: p0P4ReadinessGateInputSchema,
}).strict()

export const hostP0P4ReadinessGateReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: p0P4ReadinessGateInputSchema,
}).strict()

export const hostP5HandoffPackageCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: p5HandoffPackageInputSchema,
}).strict()

export const hostP5HandoffPackageReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: p5HandoffPackageInputSchema,
}).strict()

export const hostDesignApplicabilityCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: designApplicabilityInputSchema,
}).strict()

export const hostDesignApplicabilityReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: designApplicabilityInputSchema,
}).strict()

export const hostDesignPersonaRoleCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: designPersonaRoleModelInputSchema,
}).strict()

export const hostDesignPersonaRoleReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: designPersonaRoleModelInputSchema,
}).strict()

export const hostUserJourneyCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: userJourneyModelInputSchema,
}).strict()

export const hostUserJourneyReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: userJourneyModelInputSchema,
}).strict()

export const hostInformationArchitectureCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: informationArchitectureModelInputSchema,
}).strict()

export const hostInformationArchitectureReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: informationArchitectureModelInputSchema,
}).strict()

export const hostScreenStateInventoryCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: screenStateInventoryInputSchema,
}).strict()

export const hostScreenStateInventoryReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: screenStateInventoryInputSchema,
}).strict()

export const hostDesignRequirementsCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: designRequirementsInputSchema,
}).strict()

export const hostDesignRequirementsReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: designRequirementsInputSchema,
}).strict()

export const hostBacklogHierarchyCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: backlogHierarchyInputSchema,
}).strict()

export const hostBacklogHierarchyReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: backlogHierarchyInputSchema,
}).strict()

export const hostMvpSliceDefinitionCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: mvpSliceDefinitionInputSchema,
}).strict()

export const hostMvpSliceDefinitionReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: mvpSliceDefinitionInputSchema,
}).strict()

export const hostPrioritizationModelCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: prioritizationModelInputSchema,
}).strict()

export const hostPrioritizationModelReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: prioritizationModelInputSchema,
}).strict()

export const hostAcceptanceCriteriaCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: acceptanceCriteriaInputSchema,
}).strict()

export const hostAcceptanceCriteriaReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: acceptanceCriteriaInputSchema,
}).strict()

export const hostDefinitionOfReadyCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: definitionOfReadyInputSchema,
}).strict()

export const hostDefinitionOfReadyReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: definitionOfReadyInputSchema,
}).strict()

export const hostDefinitionOfDoneCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: definitionOfDoneInputSchema,
}).strict()

export const hostDefinitionOfDoneReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: definitionOfDoneInputSchema,
}).strict()

export const hostImplementationUnitModelCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: implementationUnitModelInputSchema,
}).strict()

export const hostImplementationUnitModelReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: implementationUnitModelInputSchema,
}).strict()

export const hostDependencyMappingCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: dependencyMappingInputSchema,
}).strict()

export const hostDependencyMappingReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: dependencyMappingInputSchema,
}).strict()

export const hostTechnologyProfileCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: technologyProfileInputSchema,
}).strict()

export const hostTechnologyProfileReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: technologyProfileInputSchema,
}).strict()

export const hostBoilerplateRegistryCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: boilerplateRegistryInputSchema,
}).strict()

export const hostBoilerplateRegistryReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: boilerplateRegistryInputSchema,
}).strict()

export const hostBoilerplateSelectionBindingCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: boilerplateSelectionBindingInputSchema,
}).strict()

export const hostBoilerplateSelectionBindingReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: boilerplateSelectionBindingInputSchema,
}).strict()

export const hostBoilerplateCompatibilityValidationCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: boilerplateCompatibilityValidationInputSchema,
}).strict()

export const hostBoilerplateCompatibilityValidationReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: boilerplateCompatibilityValidationInputSchema,
}).strict()

export const hostFigmaToBoilerplateMappingCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: figmaToBoilerplateMappingInputSchema,
}).strict()

export const hostFigmaToBoilerplateMappingReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: figmaToBoilerplateMappingInputSchema,
}).strict()

export const hostDesignToCodeBindingRegistryCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: designToCodeBindingRegistryInputSchema,
}).strict()

export const hostDesignToCodeBindingRegistryReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: designToCodeBindingRegistryInputSchema,
}).strict()

export const hostRouteScreenComponentMappingCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: routeScreenComponentMappingInputSchema,
}).strict()

export const hostRouteScreenComponentMappingReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: routeScreenComponentMappingInputSchema,
}).strict()

export const hostTestMethodologyCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: testMethodologyInputSchema,
}).strict()

export const hostTestMethodologyReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: testMethodologyInputSchema,
}).strict()

export const hostTestInventoryCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: testInventoryInputSchema,
}).strict()

export const hostTestInventoryReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: testInventoryInputSchema,
}).strict()

export const hostHighLevelDesignCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: highLevelDesignInputSchema,
}).strict()

export const hostHighLevelDesignReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: highLevelDesignInputSchema,
}).strict()

export const hostLowLevelDesignReadParamsSchema = z.object({
  initiativeId: z.string().uuid(),
  implementationUnitId: z.string().uuid(),
}).strict()

export const hostLowLevelDesignCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: lowLevelDesignInputSchema,
}).strict()

export const hostLowLevelDesignReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: lowLevelDesignInputSchema,
}).strict()

export const hostImplementationReadinessGateCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: implementationReadinessGateInputSchema,
}).strict()

export const hostImplementationReadinessGateReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: implementationReadinessGateInputSchema,
}).strict()

export const hostChangedUnitInventoryCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: changedUnitInventoryInputSchema,
}).strict()

export const hostChangedUnitInventoryReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: changedUnitInventoryInputSchema,
}).strict()

export const hostProposedChangePreviewCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: proposedChangePreviewInputSchema,
}).strict()

export const hostProposedChangePreviewReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: proposedChangePreviewInputSchema,
}).strict()

export const hostDesignSystemTokenContractCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: designSystemTokenContractInputSchema,
}).strict()

export const hostDesignSystemTokenContractReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: designSystemTokenContractInputSchema,
}).strict()

export const hostAccessibilityDesignRulesCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: accessibilityDesignRulesInputSchema,
}).strict()

export const hostAccessibilityDesignRulesReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: accessibilityDesignRulesInputSchema,
}).strict()

export const hostResponsiveMultiPlatformTargetsCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: responsiveMultiPlatformTargetsInputSchema,
}).strict()

export const hostResponsiveMultiPlatformTargetsReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: responsiveMultiPlatformTargetsInputSchema,
}).strict()

export const hostManualFigmaExecutionPathCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: manualFigmaExecutionPathInputSchema,
}).strict()

export const hostManualFigmaExecutionPathReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: manualFigmaExecutionPathInputSchema,
}).strict()

export const hostFigmaMcpCapabilityDiscoveryCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: figmaMcpCapabilityDiscoveryInputSchema,
}).strict()

export const hostFigmaMcpCapabilityDiscoveryReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: figmaMcpCapabilityDiscoveryInputSchema,
}).strict()

export const hostFigmaReadSnapshotCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: figmaReadSnapshotInputSchema,
}).strict()

export const hostFigmaReadSnapshotReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: figmaReadSnapshotInputSchema,
}).strict()

export const hostFigmaContextImportCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: figmaContextImportInputSchema,
}).strict()

export const hostFigmaContextImportReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: figmaContextImportInputSchema,
}).strict()

export const hostOutboundDesignBriefPackageCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: outboundDesignBriefPackageInputSchema,
}).strict()

export const hostOutboundDesignBriefPackageReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: outboundDesignBriefPackageInputSchema,
}).strict()

export const hostGovernedFigmaWriteCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: governedFigmaWriteInputSchema,
}).strict()

export const hostGovernedFigmaWriteReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: governedFigmaWriteInputSchema,
}).strict()

export const hostFinalizedFigmaSnapshotImportCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: finalizedFigmaSnapshotImportInputSchema,
}).strict()

export const hostFinalizedFigmaSnapshotImportReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: finalizedFigmaSnapshotImportInputSchema,
}).strict()

export const hostDesignToRequirementBindingCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: designToRequirementBindingInputSchema,
}).strict()

export const hostDesignToRequirementBindingReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: designToRequirementBindingInputSchema,
}).strict()

export const hostDesignerReadyGateCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: designerReadyGateInputSchema,
}).strict()

export const hostDesignerReadyGateReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: designerReadyGateInputSchema,
}).strict()

export const hostDesignDeltaCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: designDeltaInputSchema,
}).strict()

export const hostDesignDeltaReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: designDeltaInputSchema,
}).strict()

export const hostDesignConflictResolutionCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: designConflictResolutionInputSchema,
}).strict()

export const hostDesignConflictResolutionReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: designConflictResolutionInputSchema,
}).strict()

export const hostHumanDesignApprovalCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: humanDesignApprovalInputSchema,
}).strict()

export const hostHumanDesignApprovalReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: humanDesignApprovalInputSchema,
}).strict()

export const hostDesignBaselineCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: designBaselineInputSchema,
}).strict()

export const hostDesignBaselineReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: designBaselineInputSchema,
}).strict()

export const hostDesignDriftDetectionCreateParamsSchema = z.object({
  actorId: hostActorIdSchema,
  record: designDriftDetectionInputSchema,
}).strict()

export const hostDesignDriftDetectionReviseParamsSchema = z.object({
  actorId: hostActorIdSchema,
  recordId: z.string().uuid(),
  expectedRevision: z.number().int().positive(),
  record: designDriftDetectionInputSchema,
}).strict()

export const hostDashboardFrameworkParamsSchema = phaseDashboardCompositionRequestSchema
export const hostPhase2UxFigmaDashboardParamsSchema = phase2UxFigmaDashboardRequestSchema
export const hostPhase2ChangeImpactAgentModelDashboardParamsSchema = phase2ChangeImpactAgentModelDashboardRequestSchema
export const hostPhase3aDashboardParamsSchema = phase3aDashboardRequestSchema
export const hostPhase1SummaryDashboardParamsSchema = phase1SummaryDashboardRequestSchema
export const hostPhase1ChangeImpactDashboardParamsSchema = phase1ChangeImpactDashboardRequestSchema
export const hostChangeImpactChangeCatalogParamsSchema = changeImpactChangeCatalogRequestSchema
export const hostChangeImpactDashboardParamsSchema = changeImpactDashboardRequestSchema
export const hostAgentModelDashboardParamsSchema = agentModelDashboardRequestSchema
export const hostPhase1AgentModelDashboardParamsSchema = phase1AgentModelDashboardRequestSchema

export const hostMethodSchema = z.enum([
  "ping",
  "probeAgents",
  "readAgentSelection",
  "workspaceHealth",
  "readProduct",
  "createProduct",
  "createInitiative",
  "readInitiative",
  "assessInitiativeEntry",
  "classifyInitiative",
  "resolveInitiativeApplicability",
  "selectAgent",
  "migrateLegacySelection",
  "createCharter",
  "confirmCharter",
  "prepareRun",
  "listRuns",
  "createHandoff",
  "managed.readonly.preview",
  "managed.readonly.execute",
  "managed.evidence.list",
  "managed.evidence.read",
  "managed.review.read",
  "managed.review.apply",
  "managed.review.discard",
  "dashboard.framework",
  "dashboard.phase2UxFigma",
  "dashboard.phase2ChangeImpactAgentModel",
  "dashboard.phase3a",
  "dashboard.phase1Summary",
  "dashboard.phase1ChangeImpact",
  "dashboard.changeImpact.changes",
  "dashboard.changeImpact",
  "dashboard.agentModel",
  "dashboard.phase1AgentModel",
  "verifyAudit",
  "productStudio.designReadiness",
  "productStudio.search",
  "productStudio.exportBuild",
  "productStudio.importPreview",
  "backlog.hierarchy.read",
  "backlog.hierarchy.create",
  "backlog.hierarchy.revise",
  "backlog.hierarchy.assess",
  "backlog.hierarchy.snapshot",
  "planning.mvpSlices.read",
  "planning.mvpSlices.create",
  "planning.mvpSlices.revise",
  "planning.mvpSlices.assess",
  "planning.mvpSlices.snapshot",
  "planning.prioritization.read",
  "planning.prioritization.create",
  "planning.prioritization.revise",
  "planning.prioritization.assess",
  "planning.prioritization.snapshot",
  "planning.acceptanceCriteria.read",
  "planning.acceptanceCriteria.create",
  "planning.acceptanceCriteria.revise",
  "planning.acceptanceCriteria.assess",
  "planning.acceptanceCriteria.snapshot",
  "planning.definitionOfReady.read",
  "planning.definitionOfReady.create",
  "planning.definitionOfReady.revise",
  "planning.definitionOfReady.assess",
  "planning.definitionOfReady.snapshot",
  "planning.definitionOfDone.read",
  "planning.definitionOfDone.create",
  "planning.definitionOfDone.revise",
  "planning.definitionOfDone.assess",
  "planning.definitionOfDone.snapshot",
  "planning.implementationUnits.read",
  "planning.implementationUnits.create",
  "planning.implementationUnits.revise",
  "planning.implementationUnits.assess",
  "planning.implementationUnits.snapshot",
  "planning.dependencyMapping.read",
  "planning.dependencyMapping.create",
  "planning.dependencyMapping.revise",
  "planning.dependencyMapping.assess",
  "planning.dependencyMapping.snapshot",
  "planning.technologyProfile.read",
  "planning.technologyProfile.create",
  "planning.technologyProfile.revise",
  "planning.technologyProfile.assess",
  "planning.technologyProfile.snapshot",
  "planning.boilerplateRegistry.read",
  "planning.boilerplateRegistry.create",
  "planning.boilerplateRegistry.revise",
  "planning.boilerplateRegistry.assess",
  "planning.boilerplateRegistry.snapshot",
  "planning.boilerplateSelectionBinding.read",
  "planning.boilerplateSelectionBinding.create",
  "planning.boilerplateSelectionBinding.revise",
  "planning.boilerplateSelectionBinding.assess",
  "planning.boilerplateSelectionBinding.snapshot",
  "planning.boilerplateCompatibilityValidation.read",
  "planning.boilerplateCompatibilityValidation.create",
  "planning.boilerplateCompatibilityValidation.revise",
  "planning.boilerplateCompatibilityValidation.assess",
  "planning.boilerplateCompatibilityValidation.snapshot",
  "planning.figmaToBoilerplateMapping.read",
  "planning.figmaToBoilerplateMapping.create",
  "planning.figmaToBoilerplateMapping.revise",
  "planning.figmaToBoilerplateMapping.assess",
  "planning.figmaToBoilerplateMapping.snapshot",
  "planning.designToCodeBindingRegistry.read",
  "planning.designToCodeBindingRegistry.create",
  "planning.designToCodeBindingRegistry.revise",
  "planning.designToCodeBindingRegistry.assess",
  "planning.designToCodeBindingRegistry.snapshot",
  "source.list",
  "source.create",
  "source.revise",
  "source.baseline.list",
  "source.baseline.create",
  "source.baseline.revise",
  "source.provenance.list",
  "source.provenance.record",
  "source.assess",
  "source.snapshot",
  "business.understanding.read",
  "business.understanding.create",
  "business.understanding.revise",
  "business.stakeholders.read",
  "business.stakeholders.create",
  "business.stakeholders.revise",
  "business.outcomes.read",
  "business.outcomes.create",
  "business.outcomes.revise",
  "business.assess",
  "business.snapshot",
  "business.capabilities.read",
  "business.capabilities.create",
  "business.capabilities.revise",
  "business.capabilities.assess",
  "business.capabilities.snapshot",
  "business.valueStreams.read",
  "business.valueStreams.create",
  "business.valueStreams.revise",
  "business.valueStreams.assess",
  "business.valueStreams.snapshot",
  "business.operatingModels.read",
  "business.operatingModels.create",
  "business.operatingModels.revise",
  "business.operatingModels.assess",
  "business.operatingModels.snapshot",
  "business.businessRules.read",
  "business.businessRules.create",
  "business.businessRules.revise",
  "business.businessRules.assess",
  "business.businessRules.snapshot",
  "business.architectureBaselines.read",
  "business.architectureBaselines.create",
  "business.architectureBaselines.revise",
  "business.architectureBaselines.assess",
  "business.architectureBaselines.snapshot",
  "architecture.systemSolution.read",
  "architecture.systemSolution.create",
  "architecture.systemSolution.revise",
  "architecture.systemSolution.assess",
  "architecture.systemSolution.snapshot",
  "architecture.boundedContexts.read",
  "architecture.boundedContexts.create",
  "architecture.boundedContexts.revise",
  "architecture.boundedContexts.assess",
  "architecture.boundedContexts.snapshot",
  "security.privacyThreat.read",
  "security.privacyThreat.create",
  "security.privacyThreat.revise",
  "security.privacyThreat.assess",
  "security.privacyThreat.snapshot",
  "process.models.read",
  "process.models.create",
  "process.models.revise",
  "process.models.assess",
  "process.models.snapshot",
  "data.models.read",
  "data.models.create",
  "data.models.revise",
  "data.models.assess",
  "data.models.snapshot",
  "authorization.models.read",
  "authorization.models.create",
  "authorization.models.revise",
  "authorization.models.assess",
  "authorization.models.snapshot",
  "integration.models.read",
  "integration.models.create",
  "integration.models.revise",
  "integration.models.assess",
  "integration.models.snapshot",
  "recovery.models.read",
  "recovery.models.create",
  "recovery.models.revise",
  "recovery.models.assess",
  "recovery.models.snapshot",
  "challenge.models.read",
  "challenge.models.create",
  "challenge.models.revise",
  "challenge.models.assess",
  "challenge.models.snapshot",
  "decision.registers.read",
  "decision.registers.create",
  "decision.registers.revise",
  "decision.registers.assess",
  "decision.registers.snapshot",
  "risk.registers.read",
  "risk.registers.create",
  "risk.registers.revise",
  "risk.registers.assess",
  "risk.registers.snapshot",
  "evidence.registries.read",
  "evidence.registries.create",
  "evidence.registries.revise",
  "evidence.registries.assess",
  "evidence.registries.snapshot",
  "traceability.graphs.read",
  "traceability.graphs.create",
  "traceability.graphs.revise",
  "traceability.graphs.assess",
  "traceability.graphs.snapshot",
  "readiness.gates.read",
  "readiness.gates.create",
  "readiness.gates.revise",
  "readiness.gates.assess",
  "readiness.gates.snapshot",
  "handoff.p5.read",
  "handoff.p5.create",
  "handoff.p5.revise",
  "handoff.p5.assess",
  "handoff.p5.snapshot",
  "design.applicability.read",
  "design.applicability.create",
  "design.applicability.revise",
  "design.applicability.assess",
  "design.applicability.snapshot",
  "design.personas.roles.read",
  "design.personas.roles.create",
  "design.personas.roles.revise",
  "design.personas.roles.assess",
  "design.personas.roles.snapshot",
  "design.journeys.read",
  "design.journeys.create",
  "design.journeys.revise",
  "design.journeys.assess",
  "design.journeys.snapshot",
  "design.informationArchitecture.read",
  "design.informationArchitecture.create",
  "design.informationArchitecture.revise",
  "design.informationArchitecture.assess",
  "design.informationArchitecture.snapshot",
  "design.screenStateInventory.read",
  "design.screenStateInventory.create",
  "design.screenStateInventory.revise",
  "design.screenStateInventory.assess",
  "design.screenStateInventory.snapshot",
  "design.requirements.read",
  "design.requirements.create",
  "design.requirements.revise",
  "design.requirements.assess",
  "design.requirements.snapshot",
  "design.systemTokenContract.read",
  "design.systemTokenContract.create",
  "design.systemTokenContract.revise",
  "design.systemTokenContract.assess",
  "design.systemTokenContract.snapshot",
  "design.accessibilityRules.read",
  "design.accessibilityRules.create",
  "design.accessibilityRules.revise",
  "design.accessibilityRules.assess",
  "design.accessibilityRules.snapshot",
  "design.responsiveMultiPlatformTargets.read",
  "design.responsiveMultiPlatformTargets.create",
  "design.responsiveMultiPlatformTargets.revise",
  "design.responsiveMultiPlatformTargets.assess",
  "design.responsiveMultiPlatformTargets.snapshot",
  "design.manualFigmaExecutionPath.read",
  "design.manualFigmaExecutionPath.create",
  "design.manualFigmaExecutionPath.revise",
  "design.manualFigmaExecutionPath.assess",
  "design.manualFigmaExecutionPath.snapshot",
  "design.figmaMcpCapabilityDiscovery.read",
  "design.figmaMcpCapabilityDiscovery.create",
  "design.figmaMcpCapabilityDiscovery.revise",
  "design.figmaMcpCapabilityDiscovery.assess",
  "design.figmaMcpCapabilityDiscovery.snapshot",
  "design.figmaReadSnapshot.read",
  "design.figmaReadSnapshot.create",
  "design.figmaReadSnapshot.revise",
  "design.figmaReadSnapshot.assess",
  "design.figmaReadSnapshot.snapshot",
  "design.figmaContextImport.read",
  "design.figmaContextImport.create",
  "design.figmaContextImport.revise",
  "design.figmaContextImport.assess",
  "design.figmaContextImport.snapshot",
  "design.outboundDesignBriefPackage.read",
  "design.outboundDesignBriefPackage.create",
  "design.outboundDesignBriefPackage.revise",
  "design.outboundDesignBriefPackage.assess",
  "design.outboundDesignBriefPackage.snapshot",
  "design.governedFigmaWrite.read",
  "design.governedFigmaWrite.create",
  "design.governedFigmaWrite.revise",
  "design.governedFigmaWrite.assess",
  "design.governedFigmaWrite.snapshot",
  "design.finalizedFigmaSnapshotImport.read",
  "design.finalizedFigmaSnapshotImport.create",
  "design.finalizedFigmaSnapshotImport.revise",
  "design.finalizedFigmaSnapshotImport.assess",
  "design.finalizedFigmaSnapshotImport.snapshot",
  "design.designToRequirementBinding.read",
  "design.designToRequirementBinding.create",
  "design.designToRequirementBinding.revise",
  "design.designToRequirementBinding.assess",
  "design.designToRequirementBinding.snapshot",
  "design.designerReadyGate.read",
  "design.designerReadyGate.create",
  "design.designerReadyGate.revise",
  "design.designerReadyGate.assess",
  "design.designerReadyGate.snapshot",
  "design.designDelta.read",
  "design.designDelta.create",
  "design.designDelta.revise",
  "design.designDelta.assess",
  "design.designDelta.snapshot",
  "design.designConflictResolution.read",
  "design.designConflictResolution.create",
  "design.designConflictResolution.revise",
  "design.designConflictResolution.assess",
  "design.designConflictResolution.snapshot",
  "design.humanDesignApproval.read",
  "design.humanDesignApproval.create",
  "design.humanDesignApproval.revise",
  "design.humanDesignApproval.assess",
  "design.humanDesignApproval.snapshot",
  "design.designBaseline.read",
  "design.designBaseline.create",
  "design.designBaseline.revise",
  "design.designBaseline.assess",
  "design.designBaseline.snapshot",
  "design.designDriftDetection.read",
  "design.designDriftDetection.create",
  "design.designDriftDetection.revise",
  "design.designDriftDetection.assess",
  "design.designDriftDetection.snapshot",
])

const requestEnvelopeFields = {
  jsonrpc: z.literal("2.0"),
  id: hostRequestIdSchema,
  /** Omitted means legacy protocol v1 behavior for methods whose v1 shape remains safe. */
  protocolVersion: hostProtocolVersionSchema.optional(),
}

function requestVariant<Method extends string, Params extends z.ZodType>(method: Method, params: Params) {
  return z.object({
    ...requestEnvelopeFields,
    method: z.literal(method),
    params,
  }).strict()
}

export const hostRequestSchema = z.discriminatedUnion("method", [
  requestVariant("ping", hostNoParamsSchema.default({})),
  requestVariant("probeAgents", hostNoParamsSchema.default({})),
  requestVariant("readAgentSelection", hostNoParamsSchema.default({})),
  requestVariant("workspaceHealth", hostNoParamsSchema.default({})),
  requestVariant("readProduct", hostNoParamsSchema.default({})),
  requestVariant("createProduct", z.object({ actorId: hostActorIdSchema, product: hostProductInputSchema }).strict()),
  requestVariant("createInitiative", z.object({ actorId: hostActorIdSchema, initiative: hostInitiativeInputSchema }).strict()),
  requestVariant("readInitiative", hostReadInitiativeParamsSchema),
  requestVariant("assessInitiativeEntry", hostReadInitiativeParamsSchema),
  requestVariant("classifyInitiative", hostClassifyInitiativeParamsSchema),
  requestVariant("resolveInitiativeApplicability", hostResolveInitiativeApplicabilityParamsSchema),
  requestVariant("selectAgent", hostSelectAgentParamsSchema),
  requestVariant("migrateLegacySelection", hostMigrateLegacySelectionParamsSchema),
  requestVariant("createCharter", hostCreateCharterParamsSchema),
  requestVariant("confirmCharter", z.object({ actorId: hostActorIdSchema, charterId: z.string().uuid() }).strict()),
  requestVariant("prepareRun", z.object({ actorId: hostActorIdSchema, charterId: z.string().uuid() }).strict()),
  requestVariant("listRuns", hostNoParamsSchema.default({})),
  requestVariant("createHandoff", hostCreateHandoffParamsSchema),
  requestVariant("managed.readonly.preview", hostManagedReadOnlyPreviewParamsSchema),
  requestVariant("managed.readonly.execute", hostManagedReadOnlyExecuteParamsSchema),
  requestVariant("managed.evidence.list", hostManagedEvidenceListParamsSchema),
  requestVariant("managed.evidence.read", hostManagedEvidenceReadParamsSchema),
  requestVariant("managed.review.read", hostManagedReviewReadParamsSchema),
  requestVariant("managed.review.apply", hostManagedReviewApplyParamsSchema),
  requestVariant("managed.review.discard", hostManagedReviewDiscardParamsSchema),
  requestVariant("dashboard.framework", hostDashboardFrameworkParamsSchema),
  requestVariant("dashboard.phase2UxFigma", hostPhase2UxFigmaDashboardParamsSchema),
  requestVariant("dashboard.phase2ChangeImpactAgentModel", hostPhase2ChangeImpactAgentModelDashboardParamsSchema),
  requestVariant("dashboard.phase3a", hostPhase3aDashboardParamsSchema),
  requestVariant("dashboard.phase1Summary", hostPhase1SummaryDashboardParamsSchema),
  requestVariant("dashboard.phase1ChangeImpact", hostPhase1ChangeImpactDashboardParamsSchema),
  requestVariant("dashboard.changeImpact.changes", hostChangeImpactChangeCatalogParamsSchema),
  requestVariant("dashboard.changeImpact", hostChangeImpactDashboardParamsSchema),
  requestVariant("dashboard.agentModel", hostAgentModelDashboardParamsSchema),
  requestVariant("dashboard.phase1AgentModel", hostPhase1AgentModelDashboardParamsSchema),
  requestVariant("verifyAudit", hostNoParamsSchema.default({})),
  requestVariant("productStudio.designReadiness", z.object({ productId: z.string().uuid() }).strict()),
  requestVariant("productStudio.search", hostSearchProductStudioParamsSchema),
  requestVariant("productStudio.exportBuild", hostNoParamsSchema.default({})),
  requestVariant("productStudio.importPreview", hostImportPreviewParamsSchema),
  requestVariant("backlog.hierarchy.read", hostBusinessInitiativeParamsSchema),
  requestVariant("backlog.hierarchy.create", hostBacklogHierarchyCreateParamsSchema),
  requestVariant("backlog.hierarchy.revise", hostBacklogHierarchyReviseParamsSchema),
  requestVariant("backlog.hierarchy.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("backlog.hierarchy.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.mvpSlices.read", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.mvpSlices.create", hostMvpSliceDefinitionCreateParamsSchema),
  requestVariant("planning.mvpSlices.revise", hostMvpSliceDefinitionReviseParamsSchema),
  requestVariant("planning.mvpSlices.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.mvpSlices.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.prioritization.read", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.prioritization.create", hostPrioritizationModelCreateParamsSchema),
  requestVariant("planning.prioritization.revise", hostPrioritizationModelReviseParamsSchema),
  requestVariant("planning.prioritization.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.prioritization.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.acceptanceCriteria.read", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.acceptanceCriteria.create", hostAcceptanceCriteriaCreateParamsSchema),
  requestVariant("planning.acceptanceCriteria.revise", hostAcceptanceCriteriaReviseParamsSchema),
  requestVariant("planning.acceptanceCriteria.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.acceptanceCriteria.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.definitionOfReady.read", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.definitionOfReady.create", hostDefinitionOfReadyCreateParamsSchema),
  requestVariant("planning.definitionOfReady.revise", hostDefinitionOfReadyReviseParamsSchema),
  requestVariant("planning.definitionOfReady.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.definitionOfReady.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.definitionOfDone.read", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.definitionOfDone.create", hostDefinitionOfDoneCreateParamsSchema),
  requestVariant("planning.definitionOfDone.revise", hostDefinitionOfDoneReviseParamsSchema),
  requestVariant("planning.definitionOfDone.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.definitionOfDone.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.implementationUnits.read", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.implementationUnits.create", hostImplementationUnitModelCreateParamsSchema),
  requestVariant("planning.implementationUnits.revise", hostImplementationUnitModelReviseParamsSchema),
  requestVariant("planning.implementationUnits.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.implementationUnits.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.dependencyMapping.read", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.dependencyMapping.create", hostDependencyMappingCreateParamsSchema),
  requestVariant("planning.dependencyMapping.revise", hostDependencyMappingReviseParamsSchema),
  requestVariant("planning.dependencyMapping.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.dependencyMapping.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.technologyProfile.read", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.technologyProfile.create", hostTechnologyProfileCreateParamsSchema),
  requestVariant("planning.technologyProfile.revise", hostTechnologyProfileReviseParamsSchema),
  requestVariant("planning.technologyProfile.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.technologyProfile.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.boilerplateRegistry.read", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.boilerplateRegistry.create", hostBoilerplateRegistryCreateParamsSchema),
  requestVariant("planning.boilerplateRegistry.revise", hostBoilerplateRegistryReviseParamsSchema),
  requestVariant("planning.boilerplateRegistry.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.boilerplateRegistry.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.boilerplateSelectionBinding.read", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.boilerplateSelectionBinding.create", hostBoilerplateSelectionBindingCreateParamsSchema),
  requestVariant("planning.boilerplateSelectionBinding.revise", hostBoilerplateSelectionBindingReviseParamsSchema),
  requestVariant("planning.boilerplateSelectionBinding.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.boilerplateSelectionBinding.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.boilerplateCompatibilityValidation.read", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.boilerplateCompatibilityValidation.create", hostBoilerplateCompatibilityValidationCreateParamsSchema),
  requestVariant("planning.boilerplateCompatibilityValidation.revise", hostBoilerplateCompatibilityValidationReviseParamsSchema),
  requestVariant("planning.boilerplateCompatibilityValidation.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.boilerplateCompatibilityValidation.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.figmaToBoilerplateMapping.read", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.figmaToBoilerplateMapping.create", hostFigmaToBoilerplateMappingCreateParamsSchema),
  requestVariant("planning.figmaToBoilerplateMapping.revise", hostFigmaToBoilerplateMappingReviseParamsSchema),
  requestVariant("planning.figmaToBoilerplateMapping.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.figmaToBoilerplateMapping.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.designToCodeBindingRegistry.read", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.designToCodeBindingRegistry.create", hostDesignToCodeBindingRegistryCreateParamsSchema),
  requestVariant("planning.designToCodeBindingRegistry.revise", hostDesignToCodeBindingRegistryReviseParamsSchema),
  requestVariant("planning.designToCodeBindingRegistry.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.designToCodeBindingRegistry.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.routeScreenComponentMapping.read", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.routeScreenComponentMapping.create", hostRouteScreenComponentMappingCreateParamsSchema),
  requestVariant("planning.routeScreenComponentMapping.revise", hostRouteScreenComponentMappingReviseParamsSchema),
  requestVariant("planning.routeScreenComponentMapping.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.routeScreenComponentMapping.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.testMethodology.read", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.testMethodology.create", hostTestMethodologyCreateParamsSchema),
  requestVariant("planning.testMethodology.revise", hostTestMethodologyReviseParamsSchema),
  requestVariant("planning.testMethodology.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.testMethodology.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.testInventory.read", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.testInventory.create", hostTestInventoryCreateParamsSchema),
  requestVariant("planning.testInventory.revise", hostTestInventoryReviseParamsSchema),
  requestVariant("planning.testInventory.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.testInventory.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.highLevelDesign.read", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.highLevelDesign.create", hostHighLevelDesignCreateParamsSchema),
  requestVariant("planning.highLevelDesign.revise", hostHighLevelDesignReviseParamsSchema),
  requestVariant("planning.highLevelDesign.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.highLevelDesign.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.lowLevelDesign.read", hostLowLevelDesignReadParamsSchema),
  requestVariant("planning.lowLevelDesign.create", hostLowLevelDesignCreateParamsSchema),
  requestVariant("planning.lowLevelDesign.revise", hostLowLevelDesignReviseParamsSchema),
  requestVariant("planning.lowLevelDesign.assess", hostLowLevelDesignReadParamsSchema),
  requestVariant("planning.lowLevelDesign.snapshot", hostLowLevelDesignReadParamsSchema),
  requestVariant("planning.implementationReadinessGate.read", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.implementationReadinessGate.create", hostImplementationReadinessGateCreateParamsSchema),
  requestVariant("planning.implementationReadinessGate.revise", hostImplementationReadinessGateReviseParamsSchema),
  requestVariant("planning.implementationReadinessGate.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("planning.implementationReadinessGate.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("delivery.changedUnitInventory.read", hostBusinessInitiativeParamsSchema),
  requestVariant("delivery.changedUnitInventory.create", hostChangedUnitInventoryCreateParamsSchema),
  requestVariant("delivery.changedUnitInventory.revise", hostChangedUnitInventoryReviseParamsSchema),
  requestVariant("delivery.changedUnitInventory.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("delivery.changedUnitInventory.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("delivery.proposedChangePreview.read", hostBusinessInitiativeParamsSchema),
  requestVariant("delivery.proposedChangePreview.create", hostProposedChangePreviewCreateParamsSchema),
  requestVariant("delivery.proposedChangePreview.revise", hostProposedChangePreviewReviseParamsSchema),
  requestVariant("delivery.proposedChangePreview.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("delivery.proposedChangePreview.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("delivery.stagingWorkspace.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("delivery.controlledCodexImplementation.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("delivery.controlledClaudeImplementation.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("delivery.providerSwitchImplementation.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("delivery.modelSwitchImplementation.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("delivery.approvedFigmaContextRetrieval.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("source.list", hostSourceInitiativeParamsSchema),
  requestVariant("source.create", hostSourceCreateParamsSchema),
  requestVariant("source.revise", hostSourceReviseParamsSchema),
  requestVariant("source.baseline.list", hostSourceInitiativeParamsSchema),
  requestVariant("source.baseline.create", hostSourceBaselineCreateParamsSchema),
  requestVariant("source.baseline.revise", hostSourceBaselineReviseParamsSchema),
  requestVariant("source.provenance.list", hostSourceInitiativeParamsSchema),
  requestVariant("source.provenance.record", hostSourceProvenanceRecordParamsSchema),
  requestVariant("source.assess", hostSourceInitiativeParamsSchema),
  requestVariant("source.snapshot", hostSourceInitiativeParamsSchema),
  requestVariant("business.understanding.read", hostBusinessInitiativeParamsSchema),
  requestVariant("business.understanding.create", hostBusinessUnderstandingCreateParamsSchema),
  requestVariant("business.understanding.revise", hostBusinessUnderstandingReviseParamsSchema),
  requestVariant("business.stakeholders.read", hostBusinessInitiativeParamsSchema),
  requestVariant("business.stakeholders.create", hostStakeholderModelCreateParamsSchema),
  requestVariant("business.stakeholders.revise", hostStakeholderModelReviseParamsSchema),
  requestVariant("business.outcomes.read", hostBusinessInitiativeParamsSchema),
  requestVariant("business.outcomes.create", hostOutcomeModelCreateParamsSchema),
  requestVariant("business.outcomes.revise", hostOutcomeModelReviseParamsSchema),
  requestVariant("business.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("business.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("business.capabilities.read", hostBusinessInitiativeParamsSchema),
  requestVariant("business.capabilities.create", hostBusinessCapabilityMapCreateParamsSchema),
  requestVariant("business.capabilities.revise", hostBusinessCapabilityMapReviseParamsSchema),
  requestVariant("business.capabilities.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("business.capabilities.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("business.valueStreams.read", hostBusinessInitiativeParamsSchema),
  requestVariant("business.valueStreams.create", hostValueStreamModelCreateParamsSchema),
  requestVariant("business.valueStreams.revise", hostValueStreamModelReviseParamsSchema),
  requestVariant("business.valueStreams.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("business.valueStreams.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("business.operatingModels.read", hostBusinessInitiativeParamsSchema),
  requestVariant("business.operatingModels.create", hostOperatingModelCreateParamsSchema),
  requestVariant("business.operatingModels.revise", hostOperatingModelReviseParamsSchema),
  requestVariant("business.operatingModels.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("business.operatingModels.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("business.businessRules.read", hostBusinessInitiativeParamsSchema),
  requestVariant("business.businessRules.create", hostBusinessRuleCatalogCreateParamsSchema),
  requestVariant("business.businessRules.revise", hostBusinessRuleCatalogReviseParamsSchema),
  requestVariant("business.businessRules.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("business.businessRules.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("business.architectureBaselines.read", hostBusinessInitiativeParamsSchema),
  requestVariant("business.architectureBaselines.create", hostBusinessArchitectureBaselineCreateParamsSchema),
  requestVariant("business.architectureBaselines.revise", hostBusinessArchitectureBaselineReviseParamsSchema),
  requestVariant("business.architectureBaselines.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("business.architectureBaselines.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("architecture.systemSolution.read", hostBusinessInitiativeParamsSchema),
  requestVariant("architecture.systemSolution.create", hostSystemSolutionArchitectureCreateParamsSchema),
  requestVariant("architecture.systemSolution.revise", hostSystemSolutionArchitectureReviseParamsSchema),
  requestVariant("architecture.systemSolution.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("architecture.systemSolution.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("architecture.boundedContexts.read", hostBusinessInitiativeParamsSchema),
  requestVariant("architecture.boundedContexts.create", hostBoundedContextModelCreateParamsSchema),
  requestVariant("architecture.boundedContexts.revise", hostBoundedContextModelReviseParamsSchema),
  requestVariant("architecture.boundedContexts.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("architecture.boundedContexts.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("security.privacyThreat.read", hostBusinessInitiativeParamsSchema),
  requestVariant("security.privacyThreat.create", hostSecurityPrivacyAssessmentCreateParamsSchema),
  requestVariant("security.privacyThreat.revise", hostSecurityPrivacyAssessmentReviseParamsSchema),
  requestVariant("security.privacyThreat.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("security.privacyThreat.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("process.models.read", hostBusinessInitiativeParamsSchema),
  requestVariant("process.models.create", hostProcessModelCreateParamsSchema),
  requestVariant("process.models.revise", hostProcessModelReviseParamsSchema),
  requestVariant("process.models.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("process.models.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("data.models.read", hostBusinessInitiativeParamsSchema),
  requestVariant("data.models.create", hostDataModelCreateParamsSchema),
  requestVariant("data.models.revise", hostDataModelReviseParamsSchema),
  requestVariant("data.models.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("data.models.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("authorization.models.read", hostBusinessInitiativeParamsSchema),
  requestVariant("authorization.models.create", hostAuthorizationModelCreateParamsSchema),
  requestVariant("authorization.models.revise", hostAuthorizationModelReviseParamsSchema),
  requestVariant("authorization.models.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("authorization.models.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("integration.models.read", hostBusinessInitiativeParamsSchema),
  requestVariant("integration.models.create", hostEventIntegrationModelCreateParamsSchema),
  requestVariant("integration.models.revise", hostEventIntegrationModelReviseParamsSchema),
  requestVariant("integration.models.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("integration.models.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("recovery.models.read", hostBusinessInitiativeParamsSchema),
  requestVariant("recovery.models.create", hostFailureRecoveryModelCreateParamsSchema),
  requestVariant("recovery.models.revise", hostFailureRecoveryModelReviseParamsSchema),
  requestVariant("recovery.models.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("recovery.models.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("challenge.models.read", hostBusinessInitiativeParamsSchema),
  requestVariant("challenge.models.create", hostArchitectureChallengeModelCreateParamsSchema),
  requestVariant("challenge.models.revise", hostArchitectureChallengeModelReviseParamsSchema),
  requestVariant("challenge.models.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("challenge.models.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("decision.registers.read", hostBusinessInitiativeParamsSchema),
  requestVariant("decision.registers.create", hostDecisionRegisterCreateParamsSchema),
  requestVariant("decision.registers.revise", hostDecisionRegisterReviseParamsSchema),
  requestVariant("decision.registers.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("decision.registers.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("risk.registers.read", hostBusinessInitiativeParamsSchema),
  requestVariant("risk.registers.create", hostRiskRegisterCreateParamsSchema),
  requestVariant("risk.registers.revise", hostRiskRegisterReviseParamsSchema),
  requestVariant("risk.registers.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("risk.registers.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("evidence.registries.read", hostBusinessInitiativeParamsSchema),
  requestVariant("evidence.registries.create", hostEvidenceRegistryCreateParamsSchema),
  requestVariant("evidence.registries.revise", hostEvidenceRegistryReviseParamsSchema),
  requestVariant("evidence.registries.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("evidence.registries.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("traceability.graphs.read", hostBusinessInitiativeParamsSchema),
  requestVariant("traceability.graphs.create", hostEndToEndTraceabilityCreateParamsSchema),
  requestVariant("traceability.graphs.revise", hostEndToEndTraceabilityReviseParamsSchema),
  requestVariant("traceability.graphs.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("traceability.graphs.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("readiness.gates.read", hostBusinessInitiativeParamsSchema),
  requestVariant("readiness.gates.create", hostP0P4ReadinessGateCreateParamsSchema),
  requestVariant("readiness.gates.revise", hostP0P4ReadinessGateReviseParamsSchema),
  requestVariant("readiness.gates.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("readiness.gates.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("handoff.p5.read", hostBusinessInitiativeParamsSchema),
  requestVariant("handoff.p5.create", hostP5HandoffPackageCreateParamsSchema),
  requestVariant("handoff.p5.revise", hostP5HandoffPackageReviseParamsSchema),
  requestVariant("handoff.p5.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("handoff.p5.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("design.applicability.read", hostBusinessInitiativeParamsSchema),
  requestVariant("design.applicability.create", hostDesignApplicabilityCreateParamsSchema),
  requestVariant("design.applicability.revise", hostDesignApplicabilityReviseParamsSchema),
  requestVariant("design.applicability.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("design.applicability.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("design.personas.roles.read", hostBusinessInitiativeParamsSchema),
  requestVariant("design.personas.roles.create", hostDesignPersonaRoleCreateParamsSchema),
  requestVariant("design.personas.roles.revise", hostDesignPersonaRoleReviseParamsSchema),
  requestVariant("design.personas.roles.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("design.personas.roles.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("design.journeys.read", hostBusinessInitiativeParamsSchema),
  requestVariant("design.journeys.create", hostUserJourneyCreateParamsSchema),
  requestVariant("design.journeys.revise", hostUserJourneyReviseParamsSchema),
  requestVariant("design.journeys.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("design.journeys.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("design.informationArchitecture.read", hostBusinessInitiativeParamsSchema),
  requestVariant("design.informationArchitecture.create", hostInformationArchitectureCreateParamsSchema),
  requestVariant("design.informationArchitecture.revise", hostInformationArchitectureReviseParamsSchema),
  requestVariant("design.informationArchitecture.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("design.informationArchitecture.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("design.screenStateInventory.read", hostBusinessInitiativeParamsSchema),
  requestVariant("design.screenStateInventory.create", hostScreenStateInventoryCreateParamsSchema),
  requestVariant("design.screenStateInventory.revise", hostScreenStateInventoryReviseParamsSchema),
  requestVariant("design.screenStateInventory.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("design.screenStateInventory.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("design.requirements.read", hostBusinessInitiativeParamsSchema),
  requestVariant("design.requirements.create", hostDesignRequirementsCreateParamsSchema),
  requestVariant("design.requirements.revise", hostDesignRequirementsReviseParamsSchema),
  requestVariant("design.requirements.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("design.requirements.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("design.systemTokenContract.read", hostBusinessInitiativeParamsSchema),
  requestVariant("design.systemTokenContract.create", hostDesignSystemTokenContractCreateParamsSchema),
  requestVariant("design.systemTokenContract.revise", hostDesignSystemTokenContractReviseParamsSchema),
  requestVariant("design.systemTokenContract.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("design.systemTokenContract.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("design.accessibilityRules.read", hostBusinessInitiativeParamsSchema),
  requestVariant("design.accessibilityRules.create", hostAccessibilityDesignRulesCreateParamsSchema),
  requestVariant("design.accessibilityRules.revise", hostAccessibilityDesignRulesReviseParamsSchema),
  requestVariant("design.accessibilityRules.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("design.accessibilityRules.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("design.responsiveMultiPlatformTargets.read", hostBusinessInitiativeParamsSchema),
  requestVariant("design.responsiveMultiPlatformTargets.create", hostResponsiveMultiPlatformTargetsCreateParamsSchema),
  requestVariant("design.responsiveMultiPlatformTargets.revise", hostResponsiveMultiPlatformTargetsReviseParamsSchema),
  requestVariant("design.responsiveMultiPlatformTargets.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("design.responsiveMultiPlatformTargets.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("design.manualFigmaExecutionPath.read", hostBusinessInitiativeParamsSchema),
  requestVariant("design.manualFigmaExecutionPath.create", hostManualFigmaExecutionPathCreateParamsSchema),
  requestVariant("design.manualFigmaExecutionPath.revise", hostManualFigmaExecutionPathReviseParamsSchema),
  requestVariant("design.manualFigmaExecutionPath.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("design.manualFigmaExecutionPath.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("design.figmaMcpCapabilityDiscovery.read", hostBusinessInitiativeParamsSchema),
  requestVariant("design.figmaMcpCapabilityDiscovery.create", hostFigmaMcpCapabilityDiscoveryCreateParamsSchema),
  requestVariant("design.figmaMcpCapabilityDiscovery.revise", hostFigmaMcpCapabilityDiscoveryReviseParamsSchema),
  requestVariant("design.figmaMcpCapabilityDiscovery.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("design.figmaMcpCapabilityDiscovery.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("design.figmaReadSnapshot.read", hostBusinessInitiativeParamsSchema),
  requestVariant("design.figmaReadSnapshot.create", hostFigmaReadSnapshotCreateParamsSchema),
  requestVariant("design.figmaReadSnapshot.revise", hostFigmaReadSnapshotReviseParamsSchema),
  requestVariant("design.figmaReadSnapshot.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("design.figmaReadSnapshot.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("design.figmaContextImport.read", hostBusinessInitiativeParamsSchema),
  requestVariant("design.figmaContextImport.create", hostFigmaContextImportCreateParamsSchema),
  requestVariant("design.figmaContextImport.revise", hostFigmaContextImportReviseParamsSchema),
  requestVariant("design.figmaContextImport.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("design.figmaContextImport.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("design.outboundDesignBriefPackage.read", hostBusinessInitiativeParamsSchema),
  requestVariant("design.outboundDesignBriefPackage.create", hostOutboundDesignBriefPackageCreateParamsSchema),
  requestVariant("design.outboundDesignBriefPackage.revise", hostOutboundDesignBriefPackageReviseParamsSchema),
  requestVariant("design.outboundDesignBriefPackage.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("design.outboundDesignBriefPackage.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("design.governedFigmaWrite.read", hostBusinessInitiativeParamsSchema),
  requestVariant("design.governedFigmaWrite.create", hostGovernedFigmaWriteCreateParamsSchema),
  requestVariant("design.governedFigmaWrite.revise", hostGovernedFigmaWriteReviseParamsSchema),
  requestVariant("design.governedFigmaWrite.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("design.governedFigmaWrite.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("design.finalizedFigmaSnapshotImport.read", hostBusinessInitiativeParamsSchema),
  requestVariant("design.finalizedFigmaSnapshotImport.create", hostFinalizedFigmaSnapshotImportCreateParamsSchema),
  requestVariant("design.finalizedFigmaSnapshotImport.revise", hostFinalizedFigmaSnapshotImportReviseParamsSchema),
  requestVariant("design.finalizedFigmaSnapshotImport.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("design.finalizedFigmaSnapshotImport.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("design.designToRequirementBinding.read", hostBusinessInitiativeParamsSchema),
  requestVariant("design.designToRequirementBinding.create", hostDesignToRequirementBindingCreateParamsSchema),
  requestVariant("design.designToRequirementBinding.revise", hostDesignToRequirementBindingReviseParamsSchema),
  requestVariant("design.designToRequirementBinding.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("design.designToRequirementBinding.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("design.designerReadyGate.read", hostBusinessInitiativeParamsSchema),
  requestVariant("design.designerReadyGate.create", hostDesignerReadyGateCreateParamsSchema),
  requestVariant("design.designerReadyGate.revise", hostDesignerReadyGateReviseParamsSchema),
  requestVariant("design.designerReadyGate.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("design.designerReadyGate.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("design.designDelta.read", hostBusinessInitiativeParamsSchema),
  requestVariant("design.designDelta.create", hostDesignDeltaCreateParamsSchema),
  requestVariant("design.designDelta.revise", hostDesignDeltaReviseParamsSchema),
  requestVariant("design.designDelta.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("design.designDelta.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("design.designConflictResolution.read", hostBusinessInitiativeParamsSchema),
  requestVariant("design.designConflictResolution.create", hostDesignConflictResolutionCreateParamsSchema),
  requestVariant("design.designConflictResolution.revise", hostDesignConflictResolutionReviseParamsSchema),
  requestVariant("design.designConflictResolution.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("design.designConflictResolution.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("design.humanDesignApproval.read", hostBusinessInitiativeParamsSchema),
  requestVariant("design.humanDesignApproval.create", hostHumanDesignApprovalCreateParamsSchema),
  requestVariant("design.humanDesignApproval.revise", hostHumanDesignApprovalReviseParamsSchema),
  requestVariant("design.humanDesignApproval.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("design.humanDesignApproval.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("design.designBaseline.read", hostBusinessInitiativeParamsSchema),
  requestVariant("design.designBaseline.create", hostDesignBaselineCreateParamsSchema),
  requestVariant("design.designBaseline.revise", hostDesignBaselineReviseParamsSchema),
  requestVariant("design.designBaseline.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("design.designBaseline.snapshot", hostBusinessInitiativeParamsSchema),
  requestVariant("design.designDriftDetection.read", hostBusinessInitiativeParamsSchema),
  requestVariant("design.designDriftDetection.create", hostDesignDriftDetectionCreateParamsSchema),
  requestVariant("design.designDriftDetection.revise", hostDesignDriftDetectionReviseParamsSchema),
  requestVariant("design.designDriftDetection.assess", hostBusinessInitiativeParamsSchema),
  requestVariant("design.designDriftDetection.snapshot", hostBusinessInitiativeParamsSchema),
])

export const hostSuccessSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: hostRequestIdSchema,
  result: z.unknown(),
}).strict()

export const hostErrorSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: hostRequestIdSchema.nullable(),
  error: z.object({
    code: z.number().int(),
    message: z.string().max(4_096),
    data: z.json().optional(),
  }).strict(),
}).strict()

export type HostProtocolVersion = z.infer<typeof supportedHostProtocolVersionSchema>
export type HostRequest = z.infer<typeof hostRequestSchema>
export type HostSuccess = z.infer<typeof hostSuccessSchema>
export type HostError = z.infer<typeof hostErrorSchema>
