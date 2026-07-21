import { z } from "zod"

export const repositoryManifestSchema = z.object({
  format: z.literal("gaep-project"),
  schemaVersion: z.literal(1),
  productId: z.string().uuid(),
  createdAt: z.string().datetime(),
  engineVersion: z.string().min(1),
})

export const auditEventSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  sequence: z.number().int().positive(),
  eventType: z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/),
  occurredAt: z.string().datetime(),
  actor: z.object({ kind: z.enum(["human", "agent", "system"]), id: z.string().min(1) }),
  subjectId: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
  previousHash: z.string().regex(/^sha256:[0-9a-f]{64}$/).nullable(),
  hash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
})

export type RepositoryManifest = z.infer<typeof repositoryManifestSchema>
export type AuditEvent = z.infer<typeof auditEventSchema>
