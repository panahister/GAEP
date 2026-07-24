import { z } from "zod"

import { portableSelectionSettingsSchema } from "./agent.js"
import {
  changeImpactChangeCatalogRequestSchema,
  changeImpactDashboardRequestSchema,
  phaseDashboardCompositionRequestSchema,
} from "./dashboard.js"
import { effectDescriptorSchema, toolPermissionSchema } from "./execution.js"
import { initiativeSchema, productSchema } from "./product.js"
import { productDomainRecordKindSchema, productExportBundleSchema } from "./product-studio.js"

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

export const hostDashboardFrameworkParamsSchema = phaseDashboardCompositionRequestSchema
export const hostChangeImpactChangeCatalogParamsSchema = changeImpactChangeCatalogRequestSchema
export const hostChangeImpactDashboardParamsSchema = changeImpactDashboardRequestSchema

export const hostMethodSchema = z.enum([
  "ping",
  "probeAgents",
  "readAgentSelection",
  "workspaceHealth",
  "readProduct",
  "createProduct",
  "createInitiative",
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
  "verifyAudit",
  "productStudio.designReadiness",
  "productStudio.search",
  "productStudio.exportBuild",
  "productStudio.importPreview",
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
  requestVariant("verifyAudit", hostNoParamsSchema.default({})),
  requestVariant("productStudio.designReadiness", z.object({ productId: z.string().uuid() }).strict()),
  requestVariant("productStudio.search", hostSearchProductStudioParamsSchema),
  requestVariant("productStudio.exportBuild", hostNoParamsSchema.default({})),
  requestVariant("productStudio.importPreview", hostImportPreviewParamsSchema),
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
