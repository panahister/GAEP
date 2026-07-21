import { z } from "zod"

import { agentSelectionSchema, truthClassSchema } from "./agent.js"

export const effectDescriptorSchema = z.enum([
  "observe",
  "provisional",
  "reversible-change",
  "external-effect",
  "destructive-or-irreversible",
])

export const toolPermissionSchema = z.object({
  capability: z.string().min(1),
  mode: z.enum(["allow", "ask", "deny"]),
  scope: z.array(z.string()).default([]),
})

export const executionCharterSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  productId: z.string().uuid(),
  initiativeId: z.string().uuid(),
  productRevision: z.number().int().positive().optional(),
  initiativeRevision: z.number().int().positive().optional(),
  productDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/).optional(),
  initiativeDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/).optional(),
  selectionDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/).optional(),
  agent: agentSelectionSchema,
  objective: z.string().trim().min(4).max(20_000),
  permissions: z.array(toolPermissionSchema),
  expectedEffects: z.array(effectDescriptorSchema),
  forbiddenActions: z.array(z.string()),
  stopConditions: z.array(z.string()).min(1),
  requiredEvidence: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  confirmedAt: z.string().datetime().optional(),
})

export const runSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  revision: z.number().int().positive().optional(),
  charterId: z.string().uuid(),
  charterDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/).optional(),
  productId: z.string().uuid(),
  initiativeId: z.string().uuid(),
  agent: agentSelectionSchema,
  state: z.enum(["prepared", "running", "paused", "completed", "failed", "cancelled", "unknown"]),
  providerSessionId: z.string().optional(),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
  previousRunId: z.string().uuid().optional(),
})

export const handoffSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  productId: z.string().uuid(),
  initiativeId: z.string().uuid(),
  fromRunId: z.string().uuid(),
  toAgent: agentSelectionSchema,
  reason: z.string().trim().min(2).max(5_000),
  workspaceBaseline: z.object({
    gitHead: z.string().optional(),
    dirty: z.boolean().nullable(),
    changedFiles: z.array(z.string()),
    truthClass: truthClassSchema.optional(),
    observationError: z.string().optional(),
  }),
  completedWork: z.array(z.string()),
  unresolvedMatters: z.array(z.string()),
  decisions: z.array(z.string()),
  evidence: z.array(z.string()),
  capabilityDifferences: z.array(z.string()),
  createdAt: z.string().datetime(),
  acknowledgedAt: z.string().datetime().optional(),
})

export type ToolPermission = z.infer<typeof toolPermissionSchema>
export type ExecutionCharter = z.infer<typeof executionCharterSchema>
export type Run = z.infer<typeof runSchema>
export type Handoff = z.infer<typeof handoffSchema>
