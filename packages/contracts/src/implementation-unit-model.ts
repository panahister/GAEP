import { z } from "zod"

import { exactAcceptanceCriteriaReferenceSchema } from "./acceptance-criteria.js"
import {
  exactBacklogHierarchyReferenceSchema,
  exactBacklogRequirementReferenceSchema,
} from "./backlog-hierarchy.js"
import { businessContextBindingSchema } from "./business-understanding.js"
import { exactDefinitionOfDoneReferenceSchema } from "./definition-of-done.js"
import { exactDefinitionOfReadyReferenceSchema } from "./definition-of-ready.js"
import { exactMvpSliceDefinitionReferenceSchema } from "./mvp-slice-definition.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()
const relativeModulePathSchema = z.string().trim().min(1).max(512).superRefine((value, context) => {
  if (value.startsWith("/") || value.startsWith("\\") || /^[a-z]:/iu.test(value) ||
      value.split(/[\\/]/u).some((segment) => segment === "" || segment === "." || segment === "..")) {
    context.addIssue({ code: "custom", message: "Implementation-unit module paths must be portable repository-relative paths" })
  }
})

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length
}

function canonical(values: readonly string[]): boolean {
  const ordered = [...values].sort((left, right) => left.localeCompare(right))
  return values.every((value, index) => value === ordered[index])
}

function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable Implementation Unit Model candidates cannot contain secret-shaped values",
  }) as unknown as T
}

const canonicalUuidListSchema = z.array(z.string().uuid()).min(1).max(10_000)
  .refine(unique, "UUID references must be unique")
  .refine(canonical, "UUID references must use canonical lexical ordering")
const optionalCanonicalUuidListSchema = z.array(z.string().uuid()).max(10_000)
  .refine(unique, "UUID references must be unique")
  .refine(canonical, "UUID references must use canonical lexical ordering")
const canonicalIdentifierListSchema = z.array(identifierSchema).max(1_024)
  .refine(unique, "Identifiers must be unique")
  .refine(canonical, "Identifiers must use canonical lexical ordering")
const canonicalTextListSchema = z.array(shortTextSchema).max(512)
  .refine(unique, "Values must be unique")
  .refine(canonical, "Values must use canonical lexical ordering")

export const implementationUnitKindSchema = z.enum([
  "application",
  "data-store",
  "infrastructure",
  "integration",
  "library",
  "migration",
  "module",
  "service",
  "test-suite",
])

export const implementationUnitRepositoryCandidateSchema = z.object({
  repositoryKey: identifierSchema,
  modulePath: relativeModulePathSchema,
  placementState: z.literal("candidate-not-verified"),
  evidenceReferences: z.array(z.object({
    kind: z.enum(["architecture", "decision", "evidence", "repository-observation", "requirement", "risk"]),
    recordId: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
  }).strict()).max(256).refine(
    (values) => unique(values.map((value) => `${value.kind}:${value.recordId}:${value.revision}:${value.digest}`)),
    "Repository placement evidence references must be unique",
  ),
}).strict()

export const implementationUnitBlastRadiusSchema = z.object({
  assessmentState: z.enum(["candidate-assessed", "not-assessed"]),
  affectedUnitIds: optionalCanonicalUuidListSchema,
  affectedSurfaceKeys: canonicalIdentifierListSchema,
  rationale: shortTextSchema,
  assessedBy: humanActorSchema,
  assessedAt: z.string().datetime(),
}).strict().superRefine((value, context) => {
  if (value.assessmentState === "candidate-assessed" && value.affectedUnitIds.length === 0 &&
      value.affectedSurfaceKeys.length === 0) {
    context.addIssue({ code: "custom", path: ["affectedUnitIds"], message: "Candidate-assessed blast radius must identify at least one affected unit or surface" })
  }
})

export const implementationUnitSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().positive().max(10_000),
  key: identifierSchema,
  kind: implementationUnitKindSchema,
  title: z.string().trim().min(2).max(240),
  boundary: shortTextSchema,
  subjectNodeIds: canonicalUuidListSchema,
  requirementReferences: z.array(exactBacklogRequirementReferenceSchema).max(10_000).refine(
    (values) => unique(values.map((value) => `${value.recordId}:${value.revision}:${value.digest}`)),
    "Implementation-unit Requirement references must be unique",
  ),
  repository: implementationUnitRepositoryCandidateSchema,
  ownerCandidate: humanActorSchema,
  dependencyUnitIds: optionalCanonicalUuidListSchema,
  blastRadius: implementationUnitBlastRadiusSchema,
}).strict()

const implementationUnitModelInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  hierarchy: exactBacklogHierarchyReferenceSchema,
  mvpSliceDefinition: exactMvpSliceDefinitionReferenceSchema,
  acceptanceCriteria: exactAcceptanceCriteriaReferenceSchema,
  definitionOfReady: exactDefinitionOfReadyReferenceSchema,
  definitionOfDone: exactDefinitionOfDoneReferenceSchema,
  units: z.array(implementationUnitSchema).min(1).max(10_000),
  unresolvedQuestions: canonicalTextListSchema,
  limitations: canonicalTextListSchema,
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  repositoryTruthState: z.literal("not-established"),
  ownershipAppointmentState: z.literal("not-established"),
  dependencyCompletenessState: z.literal("not-established"),
  impactCompletenessState: z.literal("not-established"),
  implementationReadinessState: z.literal("not-established"),
  implementationCompletenessState: z.literal("not-established"),
  assignmentExecutionState: z.literal("not-established"),
  approvalState: z.literal("not-established"),
  acceptanceDecisionState: z.literal("not-established"),
  mergeReadinessState: z.literal("not-established"),
  releaseReadinessState: z.literal("not-established"),
  deploymentReadinessState: z.literal("not-established"),
  actionAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  const ids = candidate.units.map((unit) => unit.id)
  const keys = candidate.units.map((unit) => unit.key)
  if (!unique(ids) || !unique(keys)) {
    context.addIssue({ code: "custom", path: ["units"], message: "Implementation-unit identities and keys must be unique" })
  }
  if (!canonical(keys)) {
    context.addIssue({ code: "custom", path: ["units"], message: "Implementation units must use canonical key ordering" })
  }
  const idSet = new Set(ids)
  const subjectMembership = new Set<string>()
  for (const [index, unit] of candidate.units.entries()) {
    if (unit.ordinal !== index + 1) {
      context.addIssue({ code: "custom", path: ["units", index, "ordinal"], message: "Implementation units must use contiguous canonical ordinal ordering" })
    }
    if (unit.dependencyUnitIds.includes(unit.id) || unit.blastRadius.affectedUnitIds.includes(unit.id)) {
      context.addIssue({ code: "custom", path: ["units", index], message: "An implementation unit cannot depend on or affect itself" })
    }
    for (const dependencyId of unit.dependencyUnitIds) {
      if (!idSet.has(dependencyId)) context.addIssue({ code: "custom", path: ["units", index, "dependencyUnitIds"], message: "Unit dependencies must reference this catalog" })
    }
    for (const affectedId of unit.blastRadius.affectedUnitIds) {
      if (!idSet.has(affectedId)) context.addIssue({ code: "custom", path: ["units", index, "blastRadius", "affectedUnitIds"], message: "Blast-radius units must reference this catalog" })
    }
    for (const subjectId of unit.subjectNodeIds) {
      if (subjectMembership.has(subjectId)) context.addIssue({ code: "custom", path: ["units", index, "subjectNodeIds"], message: "Each Story or Task subject must belong to exactly one implementation unit" })
      subjectMembership.add(subjectId)
    }
  }
  const graph = new Map(candidate.units.map((unit) => [unit.id, unit.dependencyUnitIds]))
  const visiting = new Set<string>()
  const visited = new Set<string>()
  function visit(id: string): boolean {
    if (visiting.has(id)) return false
    if (visited.has(id)) return true
    visiting.add(id)
    for (const dependency of graph.get(id) ?? []) if (!visit(dependency)) return false
    visiting.delete(id)
    visited.add(id)
    return true
  }
  if (ids.some((id) => !visit(id))) context.addIssue({ code: "custom", path: ["units"], message: "Implementation-unit dependencies must be acyclic" })
  if (candidate.reviewState === "ready-for-human-review" &&
      (candidate.unresolvedQuestions.length > 0 || candidate.units.some((unit) =>
        unit.blastRadius.assessmentState !== "candidate-assessed"))) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready Implementation Unit Model requires candidate blast-radius assessments and no unresolved questions" })
  }
})

export const implementationUnitModelInputSchema = rejectSecrets(implementationUnitModelInputBaseSchema)

export const implementationUnitModelSchema = implementationUnitModelInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("implementation-unit-model-candidate"),
  id: z.string().uuid(),
  productId: z.string().uuid(),
  revision: z.number().int().positive(),
  membershipDigest: digestSchema,
  placementDigest: digestSchema,
  assessmentReceiptDigest: digestSchema,
  predecessorDigest: digestSchema.optional(),
  state: z.literal("candidate"),
  createdBy: humanActorSchema,
  updatedBy: humanActorSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  authorityBoundary: z.literal("implementation-unit-model-is-a-versioned-candidate-and-does-not-establish-repository-truth-ownership-appointment-dependency-or-impact-completeness-implementation-readiness-or-completeness-assignment-execution-approval-acceptance-merge-release-deployment-or-action-authority"),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Implementation Unit Model revisions after revision one require an exact predecessor digest" })
  }
})

export const exactImplementationUnitModelReferenceSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
}).strict()

export const implementationUnitModelStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("implementation-unit-model-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactImplementationUnitModelReferenceSchema.optional(),
  hierarchy: exactBacklogHierarchyReferenceSchema.optional(),
  mvpSliceDefinition: exactMvpSliceDefinitionReferenceSchema.optional(),
  acceptanceCriteria: exactAcceptanceCriteriaReferenceSchema.optional(),
  definitionOfReady: exactDefinitionOfReadyReferenceSchema.optional(),
  definitionOfDone: exactDefinitionOfDoneReferenceSchema.optional(),
  unitCount: z.number().int().nonnegative().max(10_000),
  subjectCount: z.number().int().nonnegative().max(10_000),
  requirementReferenceCount: z.number().int().nonnegative().max(1_000_000),
  repositoryCandidateCount: z.number().int().nonnegative().max(10_000),
  ownerCandidateCount: z.number().int().nonnegative().max(10_000),
  dependencyEdgeCount: z.number().int().nonnegative().max(1_000_000),
  candidateAssessedBlastRadiusCount: z.number().int().nonnegative().max(10_000),
  notAssessedBlastRadiusCount: z.number().int().nonnegative().max(10_000),
  missingSubjectCount: z.number().int().nonnegative().max(10_000),
  invalidUnitCount: z.number().int().nonnegative().max(10_000),
  staleBindingCount: z.number().int().nonnegative().max(1),
  staleHierarchyCount: z.number().int().nonnegative().max(1),
  staleMvpSliceDefinitionCount: z.number().int().nonnegative().max(1),
  staleAcceptanceCriteriaCount: z.number().int().nonnegative().max(1),
  staleDefinitionOfReadyCount: z.number().int().nonnegative().max(1),
  staleDefinitionOfDoneCount: z.number().int().nonnegative().max(1),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "candidate-complete"]),
  reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal("implementation-unit-model-status-is-observational-and-does-not-establish-repository-truth-ownership-appointment-dependency-or-impact-completeness-implementation-readiness-or-completeness-assignment-execution-approval-acceptance-merge-release-deployment-or-action-authority"),
}).strict().superRefine((status, context) => {
  if (status.candidateAssessedBlastRadiusCount + status.notAssessedBlastRadiusCount !== status.unitCount ||
      status.repositoryCandidateCount > status.unitCount || status.ownerCandidateCount > status.unitCount) {
    context.addIssue({ code: "custom", path: ["unitCount"], message: "Implementation-unit status counts must reconcile" })
  }
  const gaps = status.missingSubjectCount + status.invalidUnitCount + status.notAssessedBlastRadiusCount +
    status.staleBindingCount + status.staleHierarchyCount + status.staleMvpSliceDefinitionCount +
    status.staleAcceptanceCriteriaCount + status.staleDefinitionOfReadyCount + status.staleDefinitionOfDoneCount +
    status.unresolvedQuestionCount
  if (status.state === "candidate-complete" &&
      (gaps > 0 || !status.candidate || !status.hierarchy || !status.mvpSliceDefinition ||
       !status.acceptanceCriteria || !status.definitionOfReady || !status.definitionOfDone ||
       status.reviewState !== "ready-for-human-review" || status.reasons.length > 0)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Candidate-complete requires exact current dependencies, complete subject membership, assessed blast radius, review state, and no declared gaps" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required Implementation Unit Model status must expose reasons" })
  }
})

export const implementationUnitModelProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("implementation-unit-model-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]),
  }).strict(),
  status: implementationUnitModelStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.literal("candidate"), membershipDigest: digestSchema, placementDigest: digestSchema,
    assessmentReceiptDigest: digestSchema, unitCount: z.number().int().nonnegative().max(10_000),
    subjectCount: z.number().int().nonnegative().max(10_000),
    requirementReferenceCount: z.number().int().nonnegative().max(1_000_000),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal("projection-contains-record-identities-counts-statuses-and-membership-placement-assessment-snapshot-digests-only-not-unit-titles-boundaries-subject-or-requirement-identities-repository-keys-module-paths-owner-identities-evidence-rationales-personal-data-secrets-credentials-or-machine-paths"),
  authorityBoundary: z.literal("implementation-unit-model-projection-is-read-only-and-does-not-establish-repository-truth-ownership-appointment-dependency-or-impact-completeness-implementation-readiness-or-completeness-assignment-execution-approval-acceptance-merge-release-deployment-or-action-authority"),
  snapshotDigest: digestSchema,
}).strict()

export type ImplementationUnitModelInput = z.infer<typeof implementationUnitModelInputSchema>
export type ImplementationUnitModel = z.infer<typeof implementationUnitModelSchema>
export type ImplementationUnitModelStatus = z.infer<typeof implementationUnitModelStatusSchema>
export type ImplementationUnitModelProjection = z.infer<typeof implementationUnitModelProjectionSchema>
