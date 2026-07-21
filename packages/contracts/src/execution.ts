import { z } from "zod"

import { agentSelectionSchema, truthClassSchema } from "./agent.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const boundedTextSchema = z.string().trim().min(1).max(5_000)
const shortTextSchema = z.string().trim().min(1).max(500)

export const executionWorkspaceScopeSchema = z.string().min(1).max(4_096).refine((value) => {
  if (value === ".") return true
  const segments = value.split("/")
  return !value.startsWith("/") &&
    !/^[A-Za-z]:/.test(value) &&
    !value.startsWith("~") &&
    !value.includes("\\") &&
    !value.includes("\0") &&
    !/%2e/i.test(value) &&
    !segments.includes("") &&
    !segments.includes(".") &&
    !segments.includes("..")
}, "Execution scopes must be normalized workspace-relative paths")

export const effectDescriptorSchema = z.enum([
  "observe",
  "provisional",
  "reversible-change",
  "external-effect",
  "destructive-or-irreversible",
])

const executionExternalUriSchema = z.string().url().max(8_192).refine((value) => {
  const parsed = new URL(value)
  if (!["http:", "https:", "urn:"].includes(parsed.protocol) || parsed.username || parsed.password) return false
  const sensitive = /(token|password|passwd|secret|signature|credential|api.?key|access.?key|auth)/i
  return ![...parsed.searchParams.keys()].some((key) => sensitive.test(key)) && !(parsed.hash && sensitive.test(parsed.hash))
}, "Managed intent URIs cannot embed credentials or secret-bearing parameters")

export const executionPortableLocatorSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("workspace-relative"), path: executionWorkspaceScopeSchema }).strict(),
  z.object({ kind: z.literal("logical"), value: z.string().regex(/^[a-z][a-z0-9.-]{0,127}$/) }).strict(),
  z.object({ kind: z.literal("external-uri"), uri: executionExternalUriSchema }).strict(),
])

export const executionManagedReferenceSchema = z.object({
  recordType: z.enum(["workflow-plan", "context-pack", "tool-definition"]),
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
}).strict()

export const executionManagedIntentSchema = z.object({
  workflowPlan: executionManagedReferenceSchema,
  contextPacks: z.array(executionManagedReferenceSchema).max(128),
  toolDefinitions: z.array(executionManagedReferenceSchema).max(128),
  requestedEffects: z.array(effectDescriptorSchema).max(16),
  requestedScopes: z.array(executionPortableLocatorSchema).max(256),
}).strict().superRefine((intent, context) => {
  if (intent.workflowPlan.recordType !== "workflow-plan") {
    context.addIssue({ code: "custom", path: ["workflowPlan"], message: "Managed intent must bind a Workflow Plan" })
  }
  if (intent.contextPacks.some((binding) => binding.recordType !== "context-pack")) {
    context.addIssue({ code: "custom", path: ["contextPacks"], message: "Managed Context intent must bind Context Packs" })
  }
  if (intent.toolDefinitions.some((binding) => binding.recordType !== "tool-definition")) {
    context.addIssue({ code: "custom", path: ["toolDefinitions"], message: "Managed Tool intent must bind Tool Definitions" })
  }
  for (const [path, values] of [["contextPacks", intent.contextPacks], ["toolDefinitions", intent.toolDefinitions]] as const) {
    if (new Set(values.map((value) => value.recordId)).size !== values.length) {
      context.addIssue({ code: "custom", path: [path], message: "Managed intent bindings must be unique" })
    }
  }
  if (new Set(intent.requestedEffects).size !== intent.requestedEffects.length) {
    context.addIssue({ code: "custom", path: ["requestedEffects"], message: "Managed intent effects must be unique" })
  }
})

export const toolPermissionSchema = z.object({
  capability: z.string().trim().min(1).max(256),
  mode: z.enum(["allow", "ask", "deny"]),
  scope: z.array(executionWorkspaceScopeSchema).max(256).default([]).refine(
    (scopes) => new Set(scopes).size === scopes.length,
    "Execution permission scopes must be unique",
  ),
}).strict()

export const executionCharterSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  productId: z.string().uuid(),
  initiativeId: z.string().uuid(),
  productRevision: z.number().int().positive().optional(),
  initiativeRevision: z.number().int().positive().optional(),
  productDigest: digestSchema.optional(),
  initiativeDigest: digestSchema.optional(),
  selectionDigest: digestSchema.optional(),
  agent: agentSelectionSchema,
  objective: z.string().trim().min(4).max(20_000),
  permissions: z.array(toolPermissionSchema).max(256).refine(
    (permissions) => new Set(permissions.map((permission) => permission.capability)).size === permissions.length,
    "Execution Charter permission capabilities must be unique",
  ),
  expectedEffects: z.array(effectDescriptorSchema).max(16).refine(
    (effects) => new Set(effects).size === effects.length,
    "Execution Charter expected effects must be unique",
  ),
  forbiddenActions: z.array(boundedTextSchema).max(256),
  stopConditions: z.array(boundedTextSchema).min(1).max(256),
  requiredEvidence: z.array(boundedTextSchema).max(256).default([]),
  managedIntent: executionManagedIntentSchema.optional(),
  createdAt: z.string().datetime(),
  confirmedAt: z.string().datetime().optional(),
}).strict().superRefine((charter, context) => {
  if (charter.managedIntent?.requestedEffects.some((effect) => !charter.expectedEffects.includes(effect))) {
    context.addIssue({ code: "custom", path: ["managedIntent", "requestedEffects"], message: "Managed intent effects must be inside the Charter effect envelope" })
  }
})

export const runSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  revision: z.number().int().positive().optional(),
  charterId: z.string().uuid(),
  charterDigest: digestSchema.optional(),
  productId: z.string().uuid(),
  initiativeId: z.string().uuid(),
  agent: agentSelectionSchema,
  state: z.enum(["prepared", "running", "paused", "completed", "failed", "cancelled", "unknown"]),
  /** Hash-only reference. The machine-local provider session ID is never repository state. */
  providerSessionRef: digestSchema.optional(),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
  previousRunId: z.string().uuid().optional(),
}).strict()

export const handoffSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  productId: z.string().uuid(),
  initiativeId: z.string().uuid(),
  fromRunId: z.string().uuid(),
  toAgent: agentSelectionSchema,
  reason: z.string().trim().min(2).max(5_000),
  workspaceBaseline: z.object({
    gitHead: z.string().regex(/^[0-9a-f]{7,64}$/i).optional(),
    dirty: z.boolean().nullable(),
    changedFiles: z.array(executionWorkspaceScopeSchema.refine((path) => path !== ".", "Changed files must name a file")).max(20_000),
    truthClass: truthClassSchema.optional(),
    observationError: shortTextSchema.optional(),
  }).strict(),
  completedWork: z.array(boundedTextSchema).max(512),
  unresolvedMatters: z.array(boundedTextSchema).max(512),
  decisions: z.array(boundedTextSchema).max(512),
  evidence: z.array(boundedTextSchema).max(512),
  capabilityDifferences: z.array(boundedTextSchema).max(512),
  createdAt: z.string().datetime(),
  acknowledgedAt: z.string().datetime().optional(),
}).strict()

export type ToolPermission = z.infer<typeof toolPermissionSchema>
export type ExecutionManagedIntent = z.infer<typeof executionManagedIntentSchema>
export type ExecutionCharter = z.infer<typeof executionCharterSchema>
export type Run = z.infer<typeof runSchema>
export type Handoff = z.infer<typeof handoffSchema>
