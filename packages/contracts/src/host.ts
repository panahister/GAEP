import { z } from "zod"

import { portableSelectionSettingsSchema } from "./agent.js"
import { businessCapabilityMapInputSchema } from "./business-capability-map.js"
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

export const hostDashboardFrameworkParamsSchema = phaseDashboardCompositionRequestSchema
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
