import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { changedUnitEvidenceReferenceSchema } from "./changed-unit-inventory.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{0,127}$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const relativePathSchema = z.string().trim().min(1).max(4_096).superRefine((value, context) => {
  if (value.startsWith("/") || value.startsWith("\\") || /^[A-Za-z]:/u.test(value) || value.includes("\\") || value.split("/").some((segment) => ["", ".", ".."].includes(segment))) context.addIssue({ code: "custom", message: "Change conflict candidates must use normalized repository-relative paths" })
})
const exactReferenceSchema = z.object({ recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict()
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()
function unique(values: readonly string[]): boolean { return new Set(values).size === values.length }
function canonical(values: readonly string[]): boolean { const ordered = [...values].sort((a, b) => a.localeCompare(b)); return values.every((v, i) => v === ordered[i]) }
function canonicalList<T extends z.ZodTypeAny>(schema: T, maximum = 512) { return z.array(schema).max(maximum).refine((values) => unique(values.map(String)), "Values must be unique").refine((values) => canonical(values.map(String)), "Values must use canonical lexical ordering") }
function requiredCanonicalList<T extends z.ZodTypeAny>(schema: T, maximum = 512) { return canonicalList(schema, maximum).refine((values) => values.length > 0, "At least one value is required") }
function rejectSecrets<T extends z.ZodType>(schema: T): T { return schema.refine((value) => !containsSecretShapedValue(value), { message: "Portable Change Conflict Detection candidates cannot contain secret-shaped values" }) as unknown as T }

export const changeConflictDependencySchema = z.object({ changedUnitInventory: exactReferenceSchema, proposedChangePreview: exactReferenceSchema,
  stagingWorkspace: exactReferenceSchema, providerSwitchImplementation: exactReferenceSchema, modelSwitchImplementation: exactReferenceSchema,
  applyDiscardFoundation: exactReferenceSchema, scopedApply: exactReferenceSchema, rollbackRecovery: exactReferenceSchema }).strict()

export const changeConflictKindSchema = z.enum(["baseline-drift", "overlapping-stage", "provider-handoff", "stale-generation", "user-edit"])
export const changeConflictStateSchema = z.enum(["no-conflict-candidate", "conflict-candidate", "unavailable", "gap", "stale", "not-assessed"])
export const changeConflictFindingSchema = z.object({ kind: changeConflictKindSchema, state: changeConflictStateSchema,
  basisDigest: digestSchema, evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).min(1).max(2_048),
  resolutionState: z.literal("not-performed"), conflictTruthState: z.literal("not-established") }).strict()

export const changeConflictSubjectSchema = z.object({ id: z.string().uuid(), ordinal: z.number().int().positive().max(65_536), subjectKey: identifierSchema,
  scopedApplySelectedPathId: z.string().uuid(), changedPathId: z.string().uuid(), proposedPreviewPathId: z.string().uuid(), stagingPathId: z.string().uuid(),
  rollbackRecoverySubjectId: z.string().uuid(), pathCandidate: relativePathSchema, baselineDigestCandidate: digestSchema, stagedTargetDigestCandidate: digestSchema,
  currentContentDigestCandidate: digestSchema.optional(), currentObservationState: z.enum(["metadata-candidate", "unavailable", "not-assessed"]),
  handoff: z.object({ providerSwitchId: z.string().uuid(), modelSwitchId: z.string().uuid(), providerHandoffReceiptDigest: digestSchema,
    modelTransitionReceiptDigest: digestSchema, observationState: z.enum(["candidate-not-recorded", "metadata-candidate", "unavailable", "not-assessed"]) }).strict(),
  findings: z.array(changeConflictFindingSchema).length(5), evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).min(1).max(2_048),
  sourceInspectionState: z.literal("not-performed"), sourceMutationState: z.literal("not-performed"), resolutionState: z.literal("not-performed"),
  outcomeTruthState: z.literal("not-established") }).strict().superRefine((subject, context) => {
  const kinds = subject.findings.map((finding) => finding.kind)
  if (!unique(kinds) || !["baseline-drift", "overlapping-stage", "provider-handoff", "stale-generation", "user-edit"].every((kind) => kinds.includes(kind as never))) context.addIssue({ code: "custom", path: ["findings"], message: "Every conflict subject requires all five unique conflict kinds" })
  if (subject.currentObservationState === "metadata-candidate" && !subject.currentContentDigestCandidate) context.addIssue({ code: "custom", path: ["currentContentDigestCandidate"], message: "Metadata candidate observations require a bounded content digest candidate" })
  if (subject.currentObservationState !== "metadata-candidate" && subject.currentContentDigestCandidate) context.addIssue({ code: "custom", path: ["currentContentDigestCandidate"], message: "Unavailable or unassessed current content cannot carry a digest candidate" })
})

const inputBaseSchema = z.object({ initiativeId: z.string().uuid(), context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema, title: z.string().trim().min(2).max(240), dependencies: changeConflictDependencySchema,
  stageIdentity: z.object({ namespace: z.literal("gaep-managed-stage"), stageKey: identifierSchema, generation: z.number().int().positive().max(1_000_000), scopeDigest: digestSchema }).strict(),
  subjects: z.array(changeConflictSubjectSchema).min(1).max(65_536), evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).min(1).max(2_048),
  preconditions: requiredCanonicalList(shortTextSchema, 256), unresolvedQuestions: canonicalList(shortTextSchema), limitations: requiredCanonicalList(shortTextSchema),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]), assessedBy: humanActorSchema, assessedAt: z.string().datetime(),
  repositoryTruthState: z.literal("not-established"), sourceTruthState: z.literal("not-established"), conflictAbsenceTruthState: z.literal("not-established"),
  approvalState: z.literal("not-established"), authorizationState: z.literal("not-established"), sourceInspectionState: z.literal("not-performed"),
  sourceMutationState: z.literal("not-performed"), conflictResolutionState: z.literal("not-performed"), outcomeTruthState: z.literal("not-established"),
  acceptanceState: z.literal("not-established"), nativeHostAcceptanceState: z.literal("not-established"), liveProviderAcceptanceState: z.literal("not-established"),
  securityAcceptanceState: z.literal("not-established"), releaseReadinessState: z.literal("not-established"), deploymentReadinessState: z.literal("not-established"),
  actionAuthorityState: z.literal("not-granted") }).strict().superRefine((candidate, context) => {
  if (!unique(candidate.subjects.map((subject) => subject.id)) || !unique(candidate.subjects.map((subject) => subject.subjectKey)) ||
      !unique(candidate.subjects.map((subject) => subject.scopedApplySelectedPathId)) || !unique(candidate.subjects.map((subject) => subject.stagingPathId)) ||
      !unique(candidate.subjects.map((subject) => subject.pathCandidate))) context.addIssue({ code: "custom", path: ["subjects"], message: "Conflict subject identities, keys, selected paths, stage paths, and candidate paths must be unique" })
  candidate.subjects.forEach((subject, index) => { if (subject.ordinal !== index + 1) context.addIssue({ code: "custom", path: ["subjects", index, "ordinal"], message: "Conflict subjects must use contiguous ordering" }) })
  if (candidate.reviewState === "ready-for-human-review" && (candidate.unresolvedQuestions.length || candidate.subjects.some((subject) =>
    subject.currentObservationState !== "metadata-candidate" || subject.handoff.observationState !== "metadata-candidate" ||
    subject.findings.some((finding) => !["no-conflict-candidate", "conflict-candidate"].includes(finding.state))))) context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready conflict metadata requires bounded observations, assessed candidate findings, and no unresolved questions" })
})

export const changeConflictDetectionInputSchema = rejectSecrets(inputBaseSchema)
const authorityBoundary = "change-conflict-detection-is-a-versioned-portable-candidate-and-does-not-establish-repository-source-baseline-current-content-user-edit-handoff-conflict-absence-resolution-mutation-outcome-approval-acceptance-release-deployment-or-action-authority" as const
export const changeConflictDetectionSchema = changeConflictDetectionInputSchema.safeExtend({ schemaVersion: z.literal(1), kind: z.literal("change-conflict-detection-candidate"),
  id: z.string().uuid(), productId: z.string().uuid(), revision: z.number().int().positive(), dependencyReceiptDigest: digestSchema, stageReceiptDigest: digestSchema,
  subjectReceiptDigest: digestSchema, observationReceiptDigest: digestSchema, conflictReceiptDigest: digestSchema, evidenceReceiptDigest: digestSchema,
  assessmentReceiptDigest: digestSchema, predecessorDigest: digestSchema.optional(), state: z.literal("candidate"), createdBy: humanActorSchema, updatedBy: humanActorSchema,
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(), authorityBoundary: z.literal(authorityBoundary) }).strict()
  .superRefine((record, context) => { if ((record.revision === 1) !== (record.predecessorDigest === undefined)) context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only later revisions require a predecessor digest" }) })

const statusAuthorityBoundary = "change-conflict-detection-status-is-observational-and-grants-no-repository-source-baseline-current-content-user-edit-handoff-conflict-absence-resolution-mutation-outcome-approval-acceptance-release-deployment-or-action-authority" as const
export const changeConflictDetectionStatusSchema = z.object({ schemaVersion: z.literal(1), kind: z.literal("change-conflict-detection-status"), productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(), candidate: exactReferenceSchema.optional(), dependencies: changeConflictDependencySchema.optional(),
  stageKey: identifierSchema.optional(), stageGeneration: z.number().int().positive().optional(), subjectCount: z.number().int().nonnegative(), conflictCandidateCount: z.number().int().nonnegative(),
  noConflictCandidateCount: z.number().int().nonnegative(), unavailableCount: z.number().int().nonnegative(), gapCount: z.number().int().nonnegative(), staleCount: z.number().int().nonnegative(),
  notAssessedCount: z.number().int().nonnegative(), staleBindingCount: z.number().int().nonnegative(), coverageGapCount: z.number().int().nonnegative(), invalidCandidateCount: z.number().int().nonnegative(),
  unresolvedQuestionCount: z.number().int().nonnegative(), reviewState: z.enum(["draft", "held", "ready-for-human-review"]), state: z.enum(["attention-required", "candidate-defined"]),
  reasons: z.array(shortTextSchema).max(2_048), assessedAt: z.string().datetime(), authorityBoundary: z.literal(statusAuthorityBoundary) }).strict()

const projectionAuthorityBoundary = "change-conflict-detection-projection-is-read-only-and-grants-no-repository-source-baseline-current-content-user-edit-handoff-conflict-absence-resolution-mutation-outcome-approval-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-bounded-path-digest-handoff-conflict-evidence-identities-states-counts-and-receipts-only-not-source-diff-provider-output-machine-paths-personal-data-secrets-credentials-or-permissions" as const
export const changeConflictDetectionProjectionSchema = z.object({ schemaVersion: z.literal(1), kind: z.literal("change-conflict-detection-projection"), product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]) }).strict(),
  status: changeConflictDetectionStatusSchema, candidate: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    stageIdentity: z.object({ namespace: z.literal("gaep-managed-stage"), stageKey: identifierSchema, generation: z.number().int().positive(), scopeDigest: digestSchema }).strict(),
    subjects: z.array(z.object({ id: z.string().uuid(), subjectKey: identifierSchema, pathCandidate: relativePathSchema,
      currentObservationState: z.enum(["metadata-candidate", "unavailable", "not-assessed"]), handoffObservationState: z.enum(["candidate-not-recorded", "metadata-candidate", "unavailable", "not-assessed"]),
      findings: z.array(z.object({ kind: changeConflictKindSchema, state: changeConflictStateSchema }).strict()).length(5) }).strict()).max(65_536),
    dependencyReceiptDigest: digestSchema, stageReceiptDigest: digestSchema, subjectReceiptDigest: digestSchema, observationReceiptDigest: digestSchema,
    conflictReceiptDigest: digestSchema, evidenceReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema,
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime() }).strict().optional(),
  observedAt: z.string().datetime(), privacyBoundary: z.literal(privacyBoundary), authorityBoundary: z.literal(projectionAuthorityBoundary), snapshotDigest: digestSchema }).strict()

export type ChangeConflictDetectionInput = z.infer<typeof changeConflictDetectionInputSchema>
export type ChangeConflictDetection = z.infer<typeof changeConflictDetectionSchema>
export type ChangeConflictDetectionStatus = z.infer<typeof changeConflictDetectionStatusSchema>
export type ChangeConflictDetectionProjection = z.infer<typeof changeConflictDetectionProjectionSchema>
