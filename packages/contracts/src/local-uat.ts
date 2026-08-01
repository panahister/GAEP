import { z } from "zod"
import { businessContextBindingSchema } from "./business-understanding.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{0,127}$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const relativePathSchema = z.string().trim().min(1).max(4_096).superRefine((value, context) => {
  if (value.startsWith("/") || value.startsWith("\\") || /^[A-Za-z]:/u.test(value) || value.includes("\\") || value.split("/").some((part) => ["", ".", ".."].includes(part))) context.addIssue({ code: "custom", message: "UAT evidence paths must be normalized and repository-relative" })
})
const actorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()
const exactReferenceSchema = z.object({ recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict()
function unique(values: readonly string[]) { return new Set(values).size === values.length }
function canonical(values: readonly string[]) { const sorted = [...values].sort((a, b) => a.localeCompare(b)); return values.every((value, index) => value === sorted[index]) }
function canonicalList<T extends z.ZodTypeAny>(schema: T, max = 512) { return z.array(schema).max(max).refine((values) => unique(values.map(String)), "Values must be unique").refine((values) => canonical(values.map(String)), "Values must use canonical lexical order") }
function rejectSecrets<T extends z.ZodType>(schema: T): T { return schema.refine((value) => !containsSecretShapedValue(value), { message: "Portable UAT candidates cannot contain secret-shaped values" }) as unknown as T }

export const localUatOutcomeSchema = z.enum(["pending", "pass", "fail", "not-performed"])
export const localUatEvidenceSchema = z.object({ id: z.string().uuid(), kind: z.enum(["observation", "screenshot-digest", "checklist", "issue-reference"]),
  artifactPath: relativePathSchema, artifactDigest: digestSchema, capturedBy: actorSchema, capturedAt: z.string().datetime(), note: shortTextSchema }).strict()
export const localUatStepSchema = z.object({ id: z.string().uuid(), ordinal: z.number().int().positive().max(4_096), instruction: shortTextSchema,
  expectedObservation: shortTextSchema, outcome: localUatOutcomeSchema, evidenceIds: canonicalList(z.string().uuid(), 256), note: shortTextSchema.optional() }).strict()
export const localUatScenarioSchema = z.object({ id: z.string().uuid(), ordinal: z.number().int().positive().max(1_024), scenarioKey: identifierSchema,
  title: z.string().trim().min(2).max(240), purpose: shortTextSchema, preconditions: z.array(shortTextSchema).min(1).max(128),
  steps: z.array(localUatStepSchema).min(1).max(4_096), outcome: localUatOutcomeSchema, evidenceIds: canonicalList(z.string().uuid(), 512),
  performedBy: actorSchema.optional(), performedAt: z.string().datetime().optional(), limitationKeys: canonicalList(identifierSchema, 512) }).strict().superRefine((scenario, context) => {
    if (!unique(scenario.steps.map((step) => step.id))) context.addIssue({ code: "custom", path: ["steps"], message: "Scenario step identities must be unique" })
    scenario.steps.forEach((step, index) => { if (step.ordinal !== index + 1) context.addIssue({ code: "custom", path: ["steps", index], message: "Scenario steps must use contiguous ordering" }) })
    const performed = scenario.outcome === "pass" || scenario.outcome === "fail"
    if (performed !== Boolean(scenario.performedBy && scenario.performedAt)) context.addIssue({ code: "custom", path: ["outcome"], message: "Performed outcomes require attributable human execution and unperformed outcomes cannot claim it" })
    if (scenario.outcome === "pass" && (scenario.steps.some((step) => step.outcome !== "pass") || scenario.evidenceIds.length === 0)) context.addIssue({ code: "custom", path: ["outcome"], message: "Passing scenarios require every step to pass and attributable evidence" })
    if (scenario.outcome === "fail" && !scenario.steps.some((step) => step.outcome === "fail")) context.addIssue({ code: "custom", path: ["outcome"], message: "Failed scenarios require a failed step" })
    if (scenario.outcome === "pending" && scenario.steps.some((step) => step.outcome === "pass" || step.outcome === "fail")) context.addIssue({ code: "custom", path: ["outcome"], message: "Pending scenarios cannot claim executed step outcomes" })
    if (scenario.outcome === "not-performed" && scenario.steps.some((step) => step.outcome !== "not-performed")) context.addIssue({ code: "custom", path: ["outcome"], message: "Not-performed scenarios require every step to be not performed" })
  })

export const localUatSignOffSchema = z.object({ state: z.enum(["pending", "accepted", "rejected"]), actor: actorSchema.optional(), decidedAt: z.string().datetime().optional(),
  evidenceDigest: digestSchema.optional(), note: shortTextSchema }).strict().superRefine((signOff, context) => {
    const decided = signOff.state !== "pending"
    if (decided !== Boolean(signOff.actor && signOff.decidedAt && signOff.evidenceDigest)) context.addIssue({ code: "custom", message: "Only an attributable evidence-bound human decision can complete sign-off" })
  })

const inputBase = z.object({ initiativeId: z.string().uuid(), context: businessContextBindingSchema, informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240), qaScorecard: exactReferenceSchema, scenarios: z.array(localUatScenarioSchema).min(1).max(1_024),
  evidence: z.array(localUatEvidenceSchema).max(4_096), unresolvedQuestionKeys: canonicalList(identifierSchema, 1_024), limitations: z.array(shortTextSchema).min(1).max(256),
  signOff: localUatSignOffSchema, reviewState: z.enum(["draft", "held", "ready-for-human-validation"]), preparedBy: actorSchema, preparedAt: z.string().datetime(),
  deterministicFixtureState: z.enum(["not-run", "passed", "failed"]), humanValidationState: z.enum(["pending", "partially-performed", "performed"]),
  productOwnerAcceptanceState: z.literal("not-established"), releaseReadinessState: z.literal("not-established"), deploymentReadinessState: z.literal("not-established"),
  actionAuthorityState: z.literal("not-granted") }).strict().superRefine((candidate, context) => {
    if (!unique(candidate.scenarios.map((scenario) => scenario.id)) || !unique(candidate.scenarios.map((scenario) => scenario.scenarioKey))) context.addIssue({ code: "custom", path: ["scenarios"], message: "Scenario identities and keys must be unique" })
    candidate.scenarios.forEach((scenario, index) => { if (scenario.ordinal !== index + 1) context.addIssue({ code: "custom", path: ["scenarios", index], message: "Scenarios must use contiguous ordering" }) })
    const evidenceIds = new Set(candidate.evidence.map((evidence) => evidence.id)); if (evidenceIds.size !== candidate.evidence.length) context.addIssue({ code: "custom", path: ["evidence"], message: "Evidence identities must be unique" })
    if (candidate.scenarios.some((scenario) => [...scenario.evidenceIds, ...scenario.steps.flatMap((step) => step.evidenceIds)].some((id) => !evidenceIds.has(id)))) context.addIssue({ code: "custom", path: ["evidence"], message: "Every scenario evidence reference must resolve exactly" })
    const performed = candidate.scenarios.filter((scenario) => scenario.outcome === "pass" || scenario.outcome === "fail").length
    const expectedHumanState = performed === 0 ? "pending" : performed === candidate.scenarios.length ? "performed" : "partially-performed"
    if (candidate.humanValidationState !== expectedHumanState) context.addIssue({ code: "custom", path: ["humanValidationState"], message: "Human validation state must reconcile with scenario outcomes" })
    if (candidate.signOff.state === "accepted" && (candidate.scenarios.some((scenario) => scenario.outcome !== "pass") || candidate.unresolvedQuestionKeys.length > 0)) context.addIssue({ code: "custom", path: ["signOff"], message: "Accepted sign-off requires all scenarios to pass with no unresolved questions" })
  })
export const localUatInputSchema = rejectSecrets(inputBase)
const authorityBoundary = "local-uat-is-a-versioned-scenario-and-evidence-workflow-and-does-not-sign-for-a-human-establish-product-owner-acceptance-release-deployment-or-action-authority" as const
export const localUatSchema = localUatInputSchema.safeExtend({ schemaVersion: z.literal(1), kind: z.literal("local-uat-candidate"), id: z.string().uuid(), productId: z.string().uuid(), revision: z.number().int().positive(),
  scenarioReceiptDigest: digestSchema, evidenceReceiptDigest: digestSchema, outcomeReceiptDigest: digestSchema, signOffReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema,
  predecessorDigest: digestSchema.optional(), state: z.literal("candidate"), createdBy: actorSchema, updatedBy: actorSchema, createdAt: z.string().datetime(), updatedAt: z.string().datetime(), authorityBoundary: z.literal(authorityBoundary) }).strict()

const statusBoundary = "local-uat-status-is-observational-and-grants-no-human-sign-off-product-owner-acceptance-release-deployment-or-action-authority" as const
export const localUatStatusSchema = z.object({ schemaVersion: z.literal(1), kind: z.literal("local-uat-status"), productId: z.string().uuid(), productRevision: z.number().int().positive(), initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactReferenceSchema.optional(), qaScorecard: exactReferenceSchema.optional(), scenarioCount: z.number().int().nonnegative(), pendingCount: z.number().int().nonnegative(), passCount: z.number().int().nonnegative(), failCount: z.number().int().nonnegative(),
  notPerformedCount: z.number().int().nonnegative(), evidenceCount: z.number().int().nonnegative(), unresolvedQuestionCount: z.number().int().nonnegative(), staleBindingCount: z.number().int().nonnegative(), signOffState: z.enum(["pending", "accepted", "rejected"]),
  state: z.enum(["attention-required", "awaiting-human-validation", "human-validation-recorded"]), reasons: z.array(shortTextSchema).max(256), assessedAt: z.string().datetime(), authorityBoundary: z.literal(statusBoundary) }).strict().superRefine((status, context) => {
    if (status.pendingCount + status.passCount + status.failCount + status.notPerformedCount !== status.scenarioCount) context.addIssue({ code: "custom", path: ["scenarioCount"], message: "Scenario counts must reconcile" })
  })
const projectionBoundary = "local-uat-projection-is-read-only-and-grants-no-human-sign-off-product-owner-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-scenario-step-count-outcome-evidence-digest-actor-id-sign-off-and-receipt-metadata-only-not-artifact-bytes-product-content-personal-data-secrets-credentials-permissions-or-machine-paths" as const
export const localUatProjectionSchema = z.object({ schemaVersion: z.literal(1), kind: z.literal("local-uat-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(), initiative: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]) }).strict(),
  status: localUatStatusSchema, candidate: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, scenarios: z.array(z.object({ id: z.string().uuid(), scenarioKey: identifierSchema, title: z.string(), stepCount: z.number().int().nonnegative(), outcome: localUatOutcomeSchema,
    evidenceCount: z.number().int().nonnegative(), limitationCount: z.number().int().nonnegative() }).strict()).max(1_024), signOff: localUatSignOffSchema, scenarioReceiptDigest: digestSchema, evidenceReceiptDigest: digestSchema, outcomeReceiptDigest: digestSchema,
    signOffReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema, reviewState: z.enum(["draft", "held", "ready-for-human-validation"]), updatedAt: z.string().datetime() }).strict().optional(), observedAt: z.string().datetime(), privacyBoundary: z.literal(privacyBoundary), authorityBoundary: z.literal(projectionBoundary), snapshotDigest: digestSchema }).strict()

export type LocalUatInput = z.infer<typeof localUatInputSchema>
export type LocalUat = z.infer<typeof localUatSchema>
export type LocalUatStatus = z.infer<typeof localUatStatusSchema>
export type LocalUatProjection = z.infer<typeof localUatProjectionSchema>
