import { z } from "zod"

export const repositoryManifestSchema = z.object({
  format: z.literal("gaep-project"),
  schemaVersion: z.literal(1),
  productId: z.string().uuid(),
  createdAt: z.string().datetime(),
  engineVersion: z.string().min(1),
  auditCheckpointRequired: z.boolean().optional(),
  governedStateRequired: z.boolean().optional(),
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

export const auditCheckpointSchema = z.object({
  schemaVersion: z.literal(1),
  eventCount: z.number().int().nonnegative(),
  headHash: z.string().regex(/^sha256:[0-9a-f]{64}$/).nullable(),
  stateDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/).optional(),
  updatedAt: z.string().datetime(),
})

export const governedRecordStateSchema = z.object({
  digest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  revision: z.number().int().positive().optional(),
  transactionId: z.string().uuid(),
  auditSequence: z.number().int().positive(),
})

export const governedStateSchema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.string().datetime(),
  records: z.record(z.string(), governedRecordStateSchema),
})

const repositoryRelativePathSchema = z.string().min(1).refine((value) => {
  const segments = value.split("/")
  return !value.startsWith("/") &&
    !value.includes("\\") &&
    !segments.includes(".") &&
    !segments.includes("..") &&
    !segments.includes("")
}, "Repository transaction paths must be normalized relative paths")

export const repositoryTransactionWriteSchema = z.object({
  relativePath: repositoryRelativePathSchema,
  content: z.string(),
  contentDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  governed: z.boolean(),
})

export const repositoryTransactionBodySchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  writes: z.array(repositoryTransactionWriteSchema).min(1),
  auditEvent: auditEventSchema,
  checkpoint: auditCheckpointSchema,
  governedState: governedStateSchema,
})

export const repositoryTransactionSchema = repositoryTransactionBodySchema.extend({
  hash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
})

export const workspaceHealthIssueSchema = z.object({
  code: z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/),
  severity: z.enum(["warning", "error"]),
  message: z.string().min(1),
  portablePath: z.string().optional(),
  fieldPath: z.array(z.union([z.string(), z.number()])).max(64).optional(),
  record: z.object({ type: z.string().min(1), id: z.string().min(1), revision: z.number().int().positive().optional() }).optional(),
  repairActions: z.array(z.enum([
    "inspect-read-only",
    "export-valid-records",
    "rebuild-derived-index",
    "rebind-local-runtime",
    "resume-or-quarantine-run",
    "create-superseding-revision",
    "manual-repair-required",
  ])).max(16).optional(),
})

export const workspaceHealthSchema = z.object({
  status: z.enum(["uninitialized", "healthy", "degraded", "invalid"]),
  initialized: z.boolean(),
  productId: z.string().uuid().optional(),
  audit: z.object({
    valid: z.boolean(),
    events: z.number().int().nonnegative(),
    error: z.string().optional(),
    warning: z.string().optional(),
  }),
  lock: z.object({
    present: z.boolean(),
    stale: z.boolean(),
  }),
  issues: z.array(workspaceHealthIssueSchema),
})

export type RepositoryManifest = z.infer<typeof repositoryManifestSchema>
export type AuditEvent = z.infer<typeof auditEventSchema>
export type AuditCheckpoint = z.infer<typeof auditCheckpointSchema>
export type GovernedRecordState = z.infer<typeof governedRecordStateSchema>
export type GovernedState = z.infer<typeof governedStateSchema>
export type RepositoryTransactionBody = z.infer<typeof repositoryTransactionBodySchema>
export type RepositoryTransaction = z.infer<typeof repositoryTransactionSchema>
export type WorkspaceHealth = z.infer<typeof workspaceHealthSchema>
export type WorkspaceHealthIssue = z.infer<typeof workspaceHealthIssueSchema>
