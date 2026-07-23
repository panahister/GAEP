import { z } from "zod"

import { agentSelectionSchema, portableSelectionSettingsSchema } from "./agent.js"
import { effectDescriptorSchema, handoffSchema, toolPermissionSchema } from "./execution.js"
import { initiativeSchema, productSchema } from "./product.js"
import { productDomainRecordKindSchema, productExportBundleSchema } from "./product-studio.js"

export const hostProtocolVersionSchema = z.number().int().positive().max(1_000)
export const supportedHostProtocolVersionSchema = z.union([z.literal(1), z.literal(2), z.literal(3)])
export const hostRequestIdSchema = z.union([z.string().min(1).max(128), z.number().int().safe()])
export const hostActorIdSchema = z.string().trim().min(1).max(256).optional()
export const hostNoParamsSchema = z.object({}).strict()
const hostDigestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)

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
  expectedCurrentSelectionDigest: hostDigestSchema.nullable(),
}).strict()

export const hostPreviewLegacySelectionMigrationParamsSchema = z.object({
  adapterId: z.string().trim().min(1).max(200),
}).strict()

export const hostMigrateLegacySelectionParamsSchema = z.object({
  actorId: hostActorIdSchema,
  adapterId: z.string().trim().min(1).max(200),
  decision: z.literal("accept-exact-legacy-migration-preview"),
  expectedPreviewDigest: hostDigestSchema,
  expectedLegacySelectionDigest: hostDigestSchema,
}).strict()

export const hostLegacySelectionMigrationPreviewResultSchema = z.object({
  targetSelection: agentSelectionSchema,
  retiredSettingKeys: z.array(z.string().trim().min(1).max(200)).max(256),
  legacySelectionDigest: hostDigestSchema,
  previousPortableSelectionDigest: hostDigestSchema,
  decision: z.literal("accept-exact-legacy-migration-preview"),
  expectedPreviewDigest: hostDigestSchema,
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

export const hostHandoffInputSchema = z.object({
  fromRunId: z.string().uuid(),
  toAdapterId: z.string().trim().min(1).max(200),
  toModelId: z.string().trim().min(1).max(500),
  toSettings: portableSelectionSettingsSchema.default({}),
  reason: z.string().trim().min(2).max(5_000),
  completedWork: z.array(z.string().trim().min(1).max(2_000)).max(256),
  unresolvedMatters: z.array(z.string().trim().min(1).max(2_000)).max(256),
  decisions: z.array(z.string().trim().min(1).max(2_000)).max(256),
  evidence: z.array(z.string().trim().min(1).max(2_000)).max(256),
}).strict()

export const hostPreviewHandoffParamsSchema = z.object({
  handoff: hostHandoffInputSchema,
}).strict()

export const hostCreateHandoffParamsSchema = z.object({
  actorId: hostActorIdSchema,
  handoff: hostHandoffInputSchema,
  decision: z.literal("accept-exact-handoff-preview"),
  expectedPreviewDigest: hostDigestSchema,
  expectedCurrentSelectionDigest: hostDigestSchema,
  expectedHandoffId: z.string().uuid(),
  expectedHandoffCreatedAt: z.string().datetime(),
}).strict()

export const hostHandoffPreviewResultSchema = z.object({
  handoff: handoffSchema,
  decision: z.literal("accept-exact-handoff-preview"),
  expectedPreviewDigest: hostDigestSchema,
  expectedCurrentSelectionDigest: hostDigestSchema,
}).strict()

export const hostSelectionResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("current"),
    selection: agentSelectionSchema,
    selectionDigest: hostDigestSchema,
  }).strict(),
  z.object({
    status: z.literal("migration-required"),
    portableCandidate: agentSelectionSchema,
    legacySelectionDigest: hostDigestSchema,
    capabilityReconfirmationRequired: z.literal(true),
  }).strict(),
])

export const hostSearchProductStudioParamsSchema = z.object({
  query: z.string().trim().min(2).max(500),
  kinds: z.array(productDomainRecordKindSchema).max(productDomainRecordKindSchema.options.length).optional(),
}).strict()

export const hostImportPreviewParamsSchema = z.object({
  bundle: productExportBundleSchema,
}).strict()

export const hostMethodSchema = z.enum([
  "ping",
  "probeAgents",
  "workspaceHealth",
  "readProduct",
  "readSelection",
  "createProduct",
  "createInitiative",
  "selectAgent",
  "previewLegacySelectionMigration",
  "migrateLegacySelection",
  "createCharter",
  "confirmCharter",
  "prepareRun",
  "listRuns",
  "previewHandoff",
  "createHandoff",
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
  requestVariant("workspaceHealth", hostNoParamsSchema.default({})),
  requestVariant("readProduct", hostNoParamsSchema.default({})),
  requestVariant("readSelection", hostNoParamsSchema.default({})),
  requestVariant("createProduct", z.object({ actorId: hostActorIdSchema, product: hostProductInputSchema }).strict()),
  requestVariant("createInitiative", z.object({ actorId: hostActorIdSchema, initiative: hostInitiativeInputSchema }).strict()),
  requestVariant("selectAgent", hostSelectAgentParamsSchema),
  requestVariant("previewLegacySelectionMigration", hostPreviewLegacySelectionMigrationParamsSchema),
  requestVariant("migrateLegacySelection", hostMigrateLegacySelectionParamsSchema),
  requestVariant("createCharter", hostCreateCharterParamsSchema),
  requestVariant("confirmCharter", z.object({ actorId: hostActorIdSchema, charterId: z.string().uuid() }).strict()),
  requestVariant("prepareRun", z.object({ actorId: hostActorIdSchema, charterId: z.string().uuid() }).strict()),
  requestVariant("listRuns", hostNoParamsSchema.default({})),
  requestVariant("previewHandoff", hostPreviewHandoffParamsSchema),
  requestVariant("createHandoff", hostCreateHandoffParamsSchema),
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
export type HostHandoffInput = z.infer<typeof hostHandoffInputSchema>
export type HostHandoffPreviewResult = z.infer<typeof hostHandoffPreviewResultSchema>
export type HostLegacySelectionMigrationPreviewResult = z.infer<typeof hostLegacySelectionMigrationPreviewResultSchema>
export type HostSelectionResult = z.infer<typeof hostSelectionResultSchema>
export type HostRequest = z.infer<typeof hostRequestSchema>
export type HostSuccess = z.infer<typeof hostSuccessSchema>
export type HostError = z.infer<typeof hostErrorSchema>
