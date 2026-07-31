import { z } from "zod"

import {
  changedUnitEvidenceReferenceSchema,
  exactChangedUnitInventoryReferenceSchema,
} from "./changed-unit-inventory.js"
import { businessContextBindingSchema } from "./business-understanding.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const identifierSchema = z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{0,127}$/)
const repositoryRelativePathSchema = z.string().trim().min(1).max(4_096).refine((value) => {
  if (value.startsWith("/") || value.includes("\\")) return false
  return value.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..")
}, "Preview paths must be portable repository-relative candidates")
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()
const exactReferenceSchema = z.object({ recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict()

function unique(values: readonly string[]): boolean { return new Set(values).size === values.length }
function canonical(values: readonly string[]): boolean {
  const ordered = [...values].sort((left, right) => left.localeCompare(right))
  return values.every((value, index) => value === ordered[index])
}
function canonicalList<T extends z.ZodTypeAny>(schema: T, maximum = 32_768) {
  return z.array(schema).max(maximum)
    .refine((values) => unique(values.map(String)), "Values must be unique")
    .refine((values) => canonical(values.map(String)), "Values must use canonical lexical ordering")
}
function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable Proposed Change Preview candidates cannot contain secret-shaped values",
  }) as unknown as T
}

export const previewEndpointStateSchema = z.enum([
  "candidate-observed", "candidate-generated", "candidate-absent", "unavailable", "not-assessed",
])
export const previewEndpointSchema = z.object({
  state: previewEndpointStateSchema,
  digest: digestSchema.optional(),
  bytes: z.number().int().nonnegative().max(1_073_741_824).optional(),
}).strict().superRefine((endpoint, context) => {
  const hasContent = endpoint.state === "candidate-observed" || endpoint.state === "candidate-generated"
  if (hasContent !== (endpoint.digest !== undefined && endpoint.bytes !== undefined)) {
    context.addIssue({ code: "custom", message: "Observed and generated preview endpoints require exact digest and byte metadata only" })
  }
})

export const proposedDiffStateSchema = z.enum(["candidate-generated", "unavailable", "gap", "conflict", "stale", "not-assessed"])
export const proposedDiffSchema = z.object({
  state: proposedDiffStateSchema,
  format: z.enum(["unified-text-metadata", "binary-metadata", "not-assessed"]),
  patchDigest: digestSchema.optional(),
  addedLineCount: z.number().int().nonnegative().max(10_000_000).optional(),
  removedLineCount: z.number().int().nonnegative().max(10_000_000).optional(),
  truncated: z.boolean(),
}).strict().superRefine((diff, context) => {
  const generated = diff.state === "candidate-generated"
  if (generated !== (diff.patchDigest !== undefined && diff.addedLineCount !== undefined && diff.removedLineCount !== undefined && diff.format !== "not-assessed")) {
    context.addIssue({ code: "custom", message: "Generated diff metadata requires a format, patch digest, and bounded line counts" })
  }
  if (!generated && (diff.patchDigest !== undefined || diff.addedLineCount !== undefined || diff.removedLineCount !== undefined)) {
    context.addIssue({ code: "custom", message: "Non-generated diff states cannot claim patch metadata" })
  }
})

export const proposedPreviewPathOutcomeSchema = z.enum(["candidate-previewed", "gap", "conflict", "stale", "not-assessed"])
export const proposedPathPreviewSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().positive().max(65_536),
  changedPathCandidateId: z.string().uuid(),
  pathCandidate: repositoryRelativePathSchema,
  sourcePathCandidate: repositoryRelativePathSchema.optional(),
  changeKind: z.enum(["add", "delete", "modify", "move", "not-assessed"]),
  source: previewEndpointSchema,
  target: previewEndpointSchema,
  diff: proposedDiffSchema,
  planOperations: canonicalList(z.enum(["create", "delete", "move", "replace", "verify"]), 16),
  traceDigest: digestSchema,
  evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).max(2_048),
  outcome: proposedPreviewPathOutcomeSchema,
}).strict().superRefine((path, context) => {
  if ((path.changeKind === "move") !== (path.sourcePathCandidate !== undefined)) {
    context.addIssue({ code: "custom", path: ["sourcePathCandidate"], message: "Only move previews require an exact source path candidate" })
  }
  const expected = {
    add: ["candidate-absent", "candidate-generated"],
    delete: ["candidate-observed", "candidate-absent"],
    modify: ["candidate-observed", "candidate-generated"],
    move: ["candidate-observed", "candidate-generated"],
  } as const
  if (path.outcome === "candidate-previewed") {
    const states = expected[path.changeKind as keyof typeof expected]
    if (!states || path.source.state !== states[0] || path.target.state !== states[1] || path.diff.state !== "candidate-generated" || path.evidenceReferences.length === 0) {
      context.addIssue({ code: "custom", path: ["outcome"], message: "Candidate-previewed paths require exact endpoint, diff, and evidence metadata for the proposed change kind" })
    }
  }
})

export const proposedPreviewUnitSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().positive().max(65_536),
  changedUnitCandidateId: z.string().uuid(),
  implementationUnitId: z.string().uuid(),
  implementationUnitKey: identifierSchema,
  pathPreviews: z.array(proposedPathPreviewSchema).min(1).max(65_536),
  dependencyUnitIds: canonicalList(z.string().uuid()),
  directBlastRadiusUnitIds: canonicalList(z.string().uuid()),
  indirectBlastRadiusUnitIds: canonicalList(z.string().uuid()),
  evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).max(2_048),
  outcome: z.enum(["candidate-previewed", "gap", "conflict", "stale", "not-assessed"]),
}).strict().superRefine((unit, context) => {
  if (!unique(unit.pathPreviews.map((path) => path.id)) || !unique(unit.pathPreviews.map((path) => path.changedPathCandidateId))) {
    context.addIssue({ code: "custom", path: ["pathPreviews"], message: "Preview path and source candidate identities must be unique within a unit" })
  }
  unit.pathPreviews.forEach((path, index) => {
    if (path.ordinal !== index + 1) context.addIssue({ code: "custom", path: ["pathPreviews", index, "ordinal"], message: "Path previews must use contiguous canonical ordinal ordering" })
  })
  if (unit.outcome === "candidate-previewed" && (unit.evidenceReferences.length === 0 || unit.pathPreviews.some((path) => path.outcome !== "candidate-previewed"))) {
    context.addIssue({ code: "custom", path: ["outcome"], message: "Candidate-previewed units require attributable evidence and complete candidate-previewed paths" })
  }
})

const inputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  changedUnitInventory: exactChangedUnitInventoryReferenceSchema,
  previewUnits: z.array(proposedPreviewUnitSchema).min(1).max(65_536),
  unresolvedQuestions: canonicalList(shortTextSchema, 512),
  limitations: canonicalList(shortTextSchema, 512).refine((values) => values.length > 0, "At least one limitation is required"),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  repositoryTruthState: z.literal("not-established"), pathTruthState: z.literal("not-established"),
  sourceObservationTruthState: z.literal("not-established"), targetProposalTruthState: z.literal("not-established"),
  diffTruthState: z.literal("not-established"), changeScopeApprovalState: z.literal("not-established"),
  changeApprovalState: z.literal("not-established"), codeMutationState: z.literal("not-performed"),
  stagingState: z.literal("not-performed"), applyDiscardState: z.literal("not-performed"),
  assignmentExecutionState: z.literal("not-established"), acceptanceDecisionState: z.literal("not-established"),
  mergeReadinessState: z.literal("not-established"), releaseReadinessState: z.literal("not-established"),
  deploymentReadinessState: z.literal("not-established"), actionAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  if (!unique(candidate.previewUnits.map((unit) => unit.id)) || !unique(candidate.previewUnits.map((unit) => unit.changedUnitCandidateId))) {
    context.addIssue({ code: "custom", path: ["previewUnits"], message: "Preview unit and source inventory identities must be unique" })
  }
  candidate.previewUnits.forEach((unit, index) => {
    if (unit.ordinal !== index + 1) context.addIssue({ code: "custom", path: ["previewUnits", index, "ordinal"], message: "Preview units must use contiguous canonical ordinal ordering" })
  })
  if (candidate.reviewState === "ready-for-human-review" && (candidate.unresolvedQuestions.length > 0 || candidate.previewUnits.some((unit) => unit.outcome !== "candidate-previewed"))) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready preview requires complete candidate previews and no unresolved questions" })
  }
})

export const proposedChangePreviewInputSchema = rejectSecrets(inputBaseSchema)
const authorityBoundary = "proposed-change-preview-is-a-versioned-pre-apply-candidate-and-does-not-establish-repository-path-source-target-or-diff-truth-approved-change-scope-or-change-approval-code-mutation-staging-apply-discard-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
export const proposedChangePreviewSchema = proposedChangePreviewInputSchema.safeExtend({
  schemaVersion: z.literal(1), kind: z.literal("proposed-change-preview-candidate"), id: z.string().uuid(), productId: z.string().uuid(),
  revision: z.number().int().positive(), dependencyReceiptDigest: digestSchema, planReceiptDigest: digestSchema,
  diffReceiptDigest: digestSchema, traceReceiptDigest: digestSchema, evidenceReceiptDigest: digestSchema,
  assessmentReceiptDigest: digestSchema, predecessorDigest: digestSchema.optional(), state: z.literal("candidate"),
  createdBy: humanActorSchema, updatedBy: humanActorSchema, createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  authorityBoundary: z.literal(authorityBoundary),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only revisions after revision one require an exact predecessor digest" })
})

export const exactProposedChangePreviewReferenceSchema = exactReferenceSchema
const statusAuthorityBoundary = "proposed-change-preview-status-is-observational-and-does-not-establish-repository-path-source-target-or-diff-truth-approved-change-scope-or-change-approval-code-mutation-staging-apply-discard-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
export const proposedChangePreviewStatusSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("proposed-change-preview-status"), productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(), candidate: exactReferenceSchema.optional(),
  changedUnitInventory: exactChangedUnitInventoryReferenceSchema.optional(), inventoryUnitCount: z.number().int().nonnegative(),
  inventoryPathCount: z.number().int().nonnegative(), previewUnitCount: z.number().int().nonnegative(), previewPathCount: z.number().int().nonnegative(),
  candidatePreviewedCount: z.number().int().nonnegative(), gapCount: z.number().int().nonnegative(), conflictCount: z.number().int().nonnegative(),
  staleCount: z.number().int().nonnegative(), notAssessedCount: z.number().int().nonnegative(), orphanUnitCount: z.number().int().nonnegative(),
  orphanPathCount: z.number().int().nonnegative(), endpointGapCount: z.number().int().nonnegative(), diffGapCount: z.number().int().nonnegative(),
  traceGapCount: z.number().int().nonnegative(), evidenceGapCount: z.number().int().nonnegative(), staleBindingCount: z.number().int().nonnegative(),
  staleInventoryCount: z.number().int().nonnegative(), invalidCandidateCount: z.number().int().nonnegative(), unresolvedQuestionCount: z.number().int().nonnegative(),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]), state: z.enum(["attention-required", "candidate-previewed"]),
  reasons: z.array(shortTextSchema).max(2_048), assessedAt: z.string().datetime(), authorityBoundary: z.literal(statusAuthorityBoundary),
}).strict().superRefine((status, context) => {
  const gaps = status.gapCount + status.conflictCount + status.staleCount + status.notAssessedCount + status.orphanUnitCount + status.orphanPathCount + status.endpointGapCount + status.diffGapCount + status.traceGapCount + status.evidenceGapCount + status.staleBindingCount + status.staleInventoryCount + status.invalidCandidateCount + status.unresolvedQuestionCount
  if (status.state === "candidate-previewed" && (gaps > 0 || !status.candidate || !status.changedUnitInventory || status.reviewState !== "ready-for-human-review" || status.reasons.length > 0 || status.inventoryUnitCount !== status.previewUnitCount || status.inventoryPathCount !== status.previewPathCount)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Candidate-previewed status requires exact current inventory coverage and human-review candidacy" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required preview must expose reasons" })
})

const projectionAuthorityBoundary = "proposed-change-preview-projection-is-read-only-and-does-not-establish-repository-path-source-target-or-diff-truth-approved-change-scope-or-change-approval-code-mutation-staging-apply-discard-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-record-identities-repository-relative-path-candidates-change-kinds-endpoint-and-diff-metadata-counts-statuses-and-receipt-digests-only-not-file-or-diff-content-evidence-content-personal-data-secrets-credentials-or-machine-paths" as const
export const proposedChangePreviewProjectionSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("proposed-change-preview-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]) }).strict(),
  status: proposedChangePreviewStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.literal("candidate"),
    dependencyReceiptDigest: digestSchema, planReceiptDigest: digestSchema, diffReceiptDigest: digestSchema,
    traceReceiptDigest: digestSchema, evidenceReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema,
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
    units: z.array(z.object({ implementationUnitId: z.string().uuid(), implementationUnitKey: identifierSchema,
      outcome: z.enum(["candidate-previewed", "gap", "conflict", "stale", "not-assessed"]),
      paths: z.array(z.object({ pathCandidate: repositoryRelativePathSchema, sourcePathCandidate: repositoryRelativePathSchema.optional(),
        changeKind: z.enum(["add", "delete", "modify", "move", "not-assessed"]), sourceState: previewEndpointStateSchema,
        targetState: previewEndpointStateSchema, diffState: proposedDiffStateSchema, diffFormat: z.enum(["unified-text-metadata", "binary-metadata", "not-assessed"]),
        patchDigest: digestSchema.optional(), addedLineCount: z.number().int().nonnegative().optional(), removedLineCount: z.number().int().nonnegative().optional(), truncated: z.boolean(),
      }).strict()).max(65_536),
    }).strict()).max(65_536),
  }).strict().optional(),
  observedAt: z.string().datetime(), privacyBoundary: z.literal(privacyBoundary), authorityBoundary: z.literal(projectionAuthorityBoundary), snapshotDigest: digestSchema,
}).strict()

export type PreviewEndpoint = z.infer<typeof previewEndpointSchema>
export type ProposedPathPreview = z.infer<typeof proposedPathPreviewSchema>
export type ProposedChangePreviewInput = z.infer<typeof proposedChangePreviewInputSchema>
export type ProposedChangePreview = z.infer<typeof proposedChangePreviewSchema>
export type ProposedChangePreviewStatus = z.infer<typeof proposedChangePreviewStatusSchema>
export type ProposedChangePreviewProjection = z.infer<typeof proposedChangePreviewProjectionSchema>
