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
  name: z.string().trim().min(2).max(160),
  summary: z.string().trim().min(4).max(2_000),
  problem: z.string().trim().min(10).max(10_000),
  affectedUsers: z.string().trim().min(2).max(5_000),
  desiredOutcome: z.string().trim().min(10).max(10_000),
  successSignals: z.array(z.string().trim().min(2).max(2_000)).min(1),
  firstWorkflow: z.string().trim().min(4).max(10_000),
  exclusions: z.array(z.string().trim().min(2).max(2_000)).default([]),
  profile: productProfileSchema,
  lifecycleState: z.enum(["active", "paused", "retired"]).default("active"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const initiativeSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  kind: z.literal("initiative"),
  productId: z.string().uuid(),
  title: z.string().trim().min(2).max(240),
  outcome: z.string().trim().min(4).max(5_000),
  scope: z.array(z.string().trim().min(2).max(2_000)).min(1),
  exclusions: z.array(z.string().trim().min(2).max(2_000)).default([]),
  state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Product = z.infer<typeof productSchema>
export type Initiative = z.infer<typeof initiativeSchema>
