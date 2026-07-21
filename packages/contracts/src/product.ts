import { z } from "zod"

export const productProfileSchema = z.enum([
  "software",
  "saas",
  "ai-enabled",
  "integration",
  "security-sensitive",
  "data-sensitive",
  "internal-tool",
  "mobile",
])

export const productSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  kind: z.literal("product"),
  revision: z.number().int().positive().optional(),
  name: z.string().trim().min(2).max(160),
  summary: z.string().trim().min(4).max(2_000),
  problem: z.string().trim().min(10).max(10_000),
  affectedUsers: z.string().trim().min(2).max(5_000),
  desiredOutcome: z.string().trim().min(10).max(10_000),
  successSignals: z.array(z.string().trim().min(2).max(2_000)).min(1).max(256),
  firstWorkflow: z.string().trim().min(4).max(10_000),
  exclusions: z.array(z.string().trim().min(2).max(2_000)).max(256).default([]),
  profile: productProfileSchema,
  lifecycleState: z.enum(["active", "paused", "retired"]).default("active"),
  currentDesign: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  }).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const initiativeSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  kind: z.literal("initiative"),
  revision: z.number().int().positive().optional(),
  productId: z.string().uuid(),
  title: z.string().trim().min(2).max(240),
  outcome: z.string().trim().min(4).max(5_000),
  scope: z.array(z.string().trim().min(2).max(2_000)).min(1).max(256),
  exclusions: z.array(z.string().trim().min(2).max(2_000)).max(256).default([]),
  state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Product = z.infer<typeof productSchema>
export type Initiative = z.infer<typeof initiativeSchema>
