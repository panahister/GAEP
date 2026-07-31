import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { changedUnitEvidenceReferenceSchema } from "./changed-unit-inventory.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{0,127}$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const relativePathSchema = z.string().trim().min(1).max(512).superRefine((value, context) => {
  if (value.startsWith("/") || value.startsWith("\\") || /^[A-Za-z]:/u.test(value) || value.includes("\\") ||
      value.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    context.addIssue({ code: "custom", message: "Constraint targets must use normalized repository-relative paths" })
  }
})
const exactReferenceSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
}).strict()
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()

function unique(values: readonly string[]): boolean { return new Set(values).size === values.length }
function canonical(values: readonly string[]): boolean {
  const ordered = [...values].sort((left, right) => left.localeCompare(right))
  return values.every((value, index) => value === ordered[index])
}
function canonicalList<T extends z.ZodTypeAny>(schema: T, maximum = 65_536) {
  return z.array(schema).max(maximum)
    .refine((values) => unique(values.map(String)), "Values must be unique")
    .refine((values) => canonical(values.map(String)), "Values must use canonical lexical ordering")
}
function requiredCanonicalList<T extends z.ZodTypeAny>(schema: T, maximum = 65_536) {
  return canonicalList(schema, maximum).refine((values) => values.length > 0, "At least one value is required")
}
function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable Boilerplate Constraint Enforcement candidates cannot contain secret-shaped values",
  }) as unknown as T
}

export const boilerplateConstraintEnforcementDependencySchema = z.object({
  technologyProfile: exactReferenceSchema,
  boilerplateRegistry: exactReferenceSchema,
  boilerplateSelectionBinding: exactReferenceSchema,
  boilerplateCompatibilityValidation: exactReferenceSchema,
  figmaToBoilerplateMapping: exactReferenceSchema,
  designToCodeBindingRegistry: exactReferenceSchema,
  routeScreenComponentMapping: exactReferenceSchema,
  implementationUnitModel: exactReferenceSchema,
  proposedChangePreview: exactReferenceSchema,
  stagingWorkspace: exactReferenceSchema,
  controlledDesignToCodeGeneration: exactReferenceSchema,
  designToCodeTraceability: exactReferenceSchema,
}).strict()

export const boilerplateConstraintKinds = [
  "architecture", "component", "dependency", "module", "path", "route", "stack", "test",
] as const
export const boilerplateConstraintKindSchema = z.enum(boilerplateConstraintKinds)
export const boilerplateConstraintSourceSchema = z.enum([
  "technology-profile", "boilerplate-registry", "boilerplate-selection-binding",
  "boilerplate-compatibility-validation", "figma-to-boilerplate-mapping",
  "design-to-code-binding-registry", "route-screen-component-mapping", "implementation-unit-model",
])

export const boilerplateConstraintRuleSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().positive().max(65_536),
  ruleKey: identifierSchema,
  kind: boilerplateConstraintKindSchema,
  source: boilerplateConstraintSourceSchema,
  sourceRecord: exactReferenceSchema,
  disposition: z.enum(["mandatory", "preferred", "advisory"]),
  matchMode: z.enum(["exact", "prefix", "catalog-membership", "relationship"]),
  allowedValueCandidates: requiredCanonicalList(shortTextSchema, 4_096),
  evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).min(1).max(2_048),
  actualConstraintTruthState: z.literal("not-established"),
  approvalState: z.literal("not-established"),
}).strict()

export const boilerplateConstraintViolationSchema = z.object({
  id: z.string().uuid(),
  violationKey: identifierSchema,
  targetId: z.string().uuid(),
  ruleId: z.string().uuid(),
  outcome: z.enum(["candidate-violation", "candidate-conflict", "not-assessed"]),
  evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).min(1).max(2_048),
  exceptionReferenceCandidates: z.array(changedUnitEvidenceReferenceSchema).max(2_048),
  actualViolationTruthState: z.literal("not-established"),
  waiverState: z.literal("not-established"),
  resolutionState: z.literal("not-established"),
}).strict().superRefine((violation, context) => {
  if (violation.outcome === "candidate-conflict" && violation.exceptionReferenceCandidates.length === 0) {
    context.addIssue({ code: "custom", path: ["exceptionReferenceCandidates"], message: "Conflicting violations require exact conflict or exception evidence" })
  }
})

export const boilerplateConstraintTargetSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().positive().max(65_536),
  targetKey: identifierSchema,
  generationTargetId: z.string().uuid(),
  traceId: z.string().uuid(),
  traceKey: identifierSchema,
  implementationUnitId: z.string().uuid(),
  repositoryCandidate: identifierSchema,
  moduleCandidate: identifierSchema,
  pathCandidate: relativePathSchema,
  applicableRuleIds: requiredCanonicalList(z.string().uuid()),
  applicableRuleKeys: requiredCanonicalList(identifierSchema),
  violationIds: canonicalList(z.string().uuid()),
  violationKeys: canonicalList(identifierSchema),
  enforcementState: z.enum(["candidate-conformant", "candidate-nonconformant", "exception-candidate", "not-assessed"]),
  repositoryInspectionState: z.literal("not-performed"),
  sourceInspectionState: z.literal("not-performed"),
  generatedOutputInspectionState: z.literal("not-performed"),
  enforcementExecutionState: z.literal("not-performed"),
  complianceTruthState: z.literal("not-established"),
}).strict()

const inputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  dependencies: boilerplateConstraintEnforcementDependencySchema,
  policyKey: identifierSchema,
  rules: z.array(boilerplateConstraintRuleSchema).min(boilerplateConstraintKinds.length).max(65_536),
  targets: z.array(boilerplateConstraintTargetSchema).min(1).max(65_536),
  violations: z.array(boilerplateConstraintViolationSchema).max(65_536),
  unresolvedQuestions: canonicalList(shortTextSchema, 512),
  limitations: requiredCanonicalList(shortTextSchema, 512),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  policyApprovalState: z.literal("not-established"),
  exceptionWaiverState: z.literal("not-established"),
  repositoryInspectionState: z.literal("not-performed"),
  sourceInspectionState: z.literal("not-performed"),
  generatedOutputInspectionState: z.literal("not-performed"),
  enforcementExecutionState: z.literal("not-performed"),
  complianceTruthState: z.literal("not-established"),
  nativeHostAcceptanceState: z.literal("not-established"),
  liveProviderAcceptanceState: z.literal("not-established"),
  securityAcceptanceState: z.literal("not-established"),
  releaseReadinessState: z.literal("not-established"),
  deploymentReadinessState: z.literal("not-established"),
  actionAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  if (!unique(candidate.rules.map((rule) => rule.id)) || !unique(candidate.rules.map((rule) => rule.ruleKey))) {
    context.addIssue({ code: "custom", path: ["rules"], message: "Constraint rule identities and keys must be unique" })
  }
  if (!boilerplateConstraintKinds.every((kind) => candidate.rules.some((rule) => rule.kind === kind))) {
    context.addIssue({ code: "custom", path: ["rules"], message: "Constraint rules must cover stack, architecture, dependency, module, path, route, component, and test" })
  }
  if (!unique(candidate.targets.map((target) => target.id)) || !unique(candidate.targets.map((target) => target.generationTargetId))) {
    context.addIssue({ code: "custom", path: ["targets"], message: "Constraint target and generation-target identities must be unique" })
  }
  if (!unique(candidate.violations.map((violation) => violation.id)) || !unique(candidate.violations.map((violation) => violation.violationKey))) {
    context.addIssue({ code: "custom", path: ["violations"], message: "Constraint violation identities and keys must be unique" })
  }
  candidate.rules.forEach((rule, index) => {
    if (rule.ordinal !== index + 1) context.addIssue({ code: "custom", path: ["rules", index, "ordinal"], message: "Rules must use contiguous canonical ordering" })
  })
  candidate.targets.forEach((target, index) => {
    if (target.ordinal !== index + 1) context.addIssue({ code: "custom", path: ["targets", index, "ordinal"], message: "Targets must use contiguous canonical ordering" })
    const targetViolations = candidate.violations.filter((violation) => violation.targetId === target.id)
    const expectedState = targetViolations.some((violation) => violation.outcome === "candidate-violation")
      ? "candidate-nonconformant"
      : targetViolations.some((violation) => violation.outcome === "candidate-conflict")
        ? "exception-candidate"
        : targetViolations.some((violation) => violation.outcome === "not-assessed")
          ? "not-assessed" : "candidate-conformant"
    if (target.enforcementState !== expectedState) context.addIssue({ code: "custom", path: ["targets", index, "enforcementState"], message: "Target enforcement state must reconcile with candidate violations" })
  })
  if (candidate.reviewState === "ready-for-human-review" &&
      (candidate.unresolvedQuestions.length > 0 || candidate.targets.some((target) => target.enforcementState !== "candidate-conformant"))) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready enforcement requires candidate-conformant targets and no unresolved questions" })
  }
})

export const boilerplateConstraintEnforcementInputSchema = rejectSecrets(inputBaseSchema)
const authorityBoundary = "boilerplate-constraint-enforcement-is-a-versioned-portable-policy-candidate-and-does-not-inspect-repository-source-or-generated-output-execute-enforcement-establish-stack-architecture-dependency-module-path-route-component-test-compliance-approval-waiver-acceptance-release-deployment-or-action-authority" as const
export const boilerplateConstraintEnforcementSchema = boilerplateConstraintEnforcementInputSchema.safeExtend({
  schemaVersion: z.literal(1), kind: z.literal("boilerplate-constraint-enforcement-candidate"),
  id: z.string().uuid(), productId: z.string().uuid(), revision: z.number().int().positive(),
  dependencyReceiptDigest: digestSchema, ruleCatalogDigest: digestSchema, targetCoverageDigest: digestSchema,
  violationReceiptDigest: digestSchema, policyReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema,
  predecessorDigest: digestSchema.optional(), state: z.literal("candidate"),
  createdBy: humanActorSchema, updatedBy: humanActorSchema, createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  authorityBoundary: z.literal(authorityBoundary),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only revisions after revision one require a predecessor digest" })
  }
})

const statusAuthorityBoundary = "boilerplate-constraint-enforcement-status-is-observational-and-grants-no-repository-source-output-enforcement-compliance-approval-waiver-acceptance-release-deployment-or-action-authority" as const
export const boilerplateConstraintEnforcementStatusSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("boilerplate-constraint-enforcement-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(), initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactReferenceSchema.optional(), dependencies: boilerplateConstraintEnforcementDependencySchema.optional(),
  ruleCount: z.number().int().nonnegative(), coveredKindCount: z.number().int().nonnegative(), targetCount: z.number().int().nonnegative(),
  generationTargetCount: z.number().int().nonnegative(), conformantTargetCount: z.number().int().nonnegative(),
  nonconformantTargetCount: z.number().int().nonnegative(), exceptionTargetCount: z.number().int().nonnegative(),
  notAssessedTargetCount: z.number().int().nonnegative(), violationCount: z.number().int().nonnegative(),
  staleBindingCount: z.number().int().nonnegative(), coverageGapCount: z.number().int().nonnegative(),
  ruleGapCount: z.number().int().nonnegative(), invalidCandidateCount: z.number().int().nonnegative(),
  unresolvedQuestionCount: z.number().int().nonnegative(), reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "candidate-defined"]), reasons: z.array(shortTextSchema).max(2_048),
  assessedAt: z.string().datetime(), authorityBoundary: z.literal(statusAuthorityBoundary),
}).strict()

const projectionAuthorityBoundary = "boilerplate-constraint-enforcement-projection-is-read-only-and-grants-no-repository-source-output-enforcement-compliance-approval-waiver-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-bounded-policy-rule-target-violation-identities-repository-relative-candidate-locations-states-counts-and-digests-only-not-source-or-generated-content-test-results-machine-paths-personal-data-secrets-credentials-or-permissions" as const
export const boilerplateConstraintEnforcementProjectionSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("boilerplate-constraint-enforcement-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]) }).strict(),
  status: boilerplateConstraintEnforcementStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, policyKey: identifierSchema,
    ruleKindCounts: z.record(boilerplateConstraintKindSchema, z.number().int().nonnegative()),
    targets: z.array(z.object({
      id: z.string().uuid(), targetKey: identifierSchema, traceKey: identifierSchema, implementationUnitId: z.string().uuid(),
      repositoryCandidate: identifierSchema, moduleCandidate: identifierSchema, pathCandidate: relativePathSchema,
      applicableRuleCount: z.number().int().positive(), violationCount: z.number().int().nonnegative(),
      enforcementState: z.enum(["candidate-conformant", "candidate-nonconformant", "exception-candidate", "not-assessed"]),
    }).strict()).max(65_536),
    dependencyReceiptDigest: digestSchema, ruleCatalogDigest: digestSchema, targetCoverageDigest: digestSchema,
    violationReceiptDigest: digestSchema, policyReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema,
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(), privacyBoundary: z.literal(privacyBoundary),
  authorityBoundary: z.literal(projectionAuthorityBoundary), snapshotDigest: digestSchema,
}).strict()

export type BoilerplateConstraintEnforcementInput = z.infer<typeof boilerplateConstraintEnforcementInputSchema>
export type BoilerplateConstraintEnforcement = z.infer<typeof boilerplateConstraintEnforcementSchema>
export type BoilerplateConstraintEnforcementStatus = z.infer<typeof boilerplateConstraintEnforcementStatusSchema>
export type BoilerplateConstraintEnforcementProjection = z.infer<typeof boilerplateConstraintEnforcementProjectionSchema>
