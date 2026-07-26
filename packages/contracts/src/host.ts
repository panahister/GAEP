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

export const hostDashboardFrameworkParamsSchema = phaseDashboardCompositionRequestSchema
export const hostChangeImpactChangeCatalogParamsSchema = changeImpactChangeCatalogRequestSchema
export const hostChangeImpactDashboardParamsSchema = changeImpactDashboardRequestSchema
export const hostAgentModelDashboardParamsSchema = agentModelDashboardRequestSchema

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
  "dashboard.changeImpact.changes",
  "dashboard.changeImpact",
  "dashboard.agentModel",
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
  requestVariant("dashboard.changeImpact.changes", hostChangeImpactChangeCatalogParamsSchema),
  requestVariant("dashboard.changeImpact", hostChangeImpactDashboardParamsSchema),
  requestVariant("dashboard.agentModel", hostAgentModelDashboardParamsSchema),
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
