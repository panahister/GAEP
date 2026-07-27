import { z } from "zod"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)

const exactRecordBindingSchema = z.object({
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
}).strict()

export const phase1SummaryDashboardRequestSchema = z.object({
  expectedProductId: z.string().uuid(),
  expectedProductRevision: z.number().int().positive(),
  expectedProductDigest: digestSchema,
  expectedInitiativeId: z.string().uuid(),
  expectedInitiativeRevision: z.number().int().positive(),
  expectedInitiativeDigest: digestSchema,
}).strict()

const gapBreakdownSchema = z.object({
  applicability: z.number().int().nonnegative(),
  conditional: z.number().int().nonnegative(),
  incomplete: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  blocked: z.number().int().nonnegative(),
  staleOrUnknown: z.number().int().nonnegative(),
  waivers: z.number().int().nonnegative(),
  decisions: z.number().int().nonnegative(),
  conditions: z.number().int().nonnegative(),
  requirements: z.number().int().nonnegative(),
  adverseEvidence: z.number().int().nonnegative(),
  bindings: z.number().int().nonnegative(),
  sourceReferences: z.number().int().nonnegative(),
  inconsistencies: z.number().int().nonnegative(),
  questions: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
}).strict().superRefine((gaps, context) => {
  const { total, ...categories } = gaps
  if (Object.values(categories).reduce((sum, count) => sum + count, 0) !== total) {
    context.addIssue({ code: "custom", path: ["total"], message: "Declared readiness gap counts must reconcile exactly" })
  }
})

const handoffGapBreakdownSchema = z.object({
  unresolvedItems: z.number().int().nonnegative(),
  staleOrUnknownItems: z.number().int().nonnegative(),
  requirements: z.number().int().nonnegative(),
  conflicts: z.number().int().nonnegative(),
  questions: z.number().int().nonnegative(),
  bindings: z.number().int().nonnegative(),
  sourceReferences: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
}).strict().superRefine((gaps, context) => {
  const { total, ...categories } = gaps
  if (Object.values(categories).reduce((sum, count) => sum + count, 0) !== total) {
    context.addIssue({ code: "custom", path: ["total"], message: "Declared handoff gap counts must reconcile exactly" })
  }
})

const phase1SummaryDashboardFields = {
  schemaVersion: z.literal(1),
  kind: z.literal("phase-1-summary-readiness-dashboard"),
  phase: z.object({
    id: z.literal("phase-1b-product"),
    label: z.literal("Phase 1B — Product P0–P4"),
  }).strict(),
  product: z.object({
    recordType: z.literal("product"),
    ...exactRecordBindingSchema.shape,
  }).strict(),
  initiative: z.object({
    recordType: z.literal("initiative"),
    ...exactRecordBindingSchema.shape,
    state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]),
  }).strict(),
  readiness: z.object({
    snapshotDigest: digestSchema,
    result: z.enum(["blocked", "conditionally-passed", "failed", "incomplete", "not-assessed", "passed"]),
    gate: exactRecordBindingSchema.optional(),
    assessedAt: z.string().datetime(),
    outputs: z.object({
      total: z.number().int().nonnegative().max(25),
      applicable: z.number().int().nonnegative().max(25),
      notApplicable: z.number().int().nonnegative().max(25),
      unresolvedApplicability: z.number().int().nonnegative().max(25),
      satisfied: z.number().int().nonnegative().max(25),
    }).strict().superRefine((outputs, context) => {
      if (outputs.applicable + outputs.notApplicable + outputs.unresolvedApplicability !== outputs.total) {
        context.addIssue({ code: "custom", message: "Readiness applicability counts must equal the output total" })
      }
      if (outputs.satisfied > outputs.applicable) {
        context.addIssue({ code: "custom", path: ["satisfied"], message: "Satisfied outputs cannot exceed applicable outputs" })
      }
    }),
    gaps: gapBreakdownSchema,
    reasonCount: z.number().int().nonnegative(),
    attentionRequired: z.boolean(),
    authorityBoundary: z.literal("readiness-result-is-evaluation-only-not-permission-or-product-readiness"),
  }).strict(),
  handoff: z.object({
    snapshotDigest: digestSchema,
    state: z.enum(["attention-required", "complete-for-review"]),
    transferState: z.enum(["draft", "held", "ready-for-human-review"]),
    package: exactRecordBindingSchema.optional(),
    assessedAt: z.string().datetime(),
    items: z.object({
      total: z.number().int().nonnegative().max(25),
      included: z.number().int().nonnegative().max(25),
      referenceOnly: z.number().int().nonnegative().max(25),
      omittedNotApplicable: z.number().int().nonnegative().max(25),
      unresolved: z.number().int().nonnegative().max(25),
    }).strict().superRefine((items, context) => {
      if (items.included + items.referenceOnly + items.omittedNotApplicable + items.unresolved !== items.total) {
        context.addIssue({ code: "custom", message: "Handoff disposition counts must equal the item total" })
      }
    }),
    gaps: handoffGapBreakdownSchema,
    reasonCount: z.number().int().nonnegative(),
    attentionRequired: z.boolean(),
    authorityBoundary: z.literal("handoff-status-is-candidate-context-only-not-transfer-or-phase-entry-authority"),
  }).strict(),
  phaseStatus: z.object({
    state: z.enum(["attention-required", "candidate-complete-for-human-review"]),
    declaredGapCount: z.number().int().nonnegative(),
    attentionSignalCount: z.number().int().min(0).max(3),
    productOwnerAcceptance: z.literal("not-established"),
    readinessAuthority: z.literal("not-established"),
    phaseEntryAuthority: z.literal("not-established"),
  }).strict(),
  owners: z.object({
    state: z.literal("unbound"),
    boundOwnerCount: z.literal(0),
    basis: z.literal("no-governed-phase-owner-assignment-is-bound"),
  }).strict(),
  freshness: z.object({
    state: z.enum(["current", "attention-required"]),
    readinessObservedAt: z.string().datetime(),
    handoffObservedAt: z.string().datetime(),
    staleBindingCount: z.number().int().nonnegative(),
    staleSourceReferenceCount: z.number().int().nonnegative(),
    basis: z.literal("exact-current-projections-and-declared-binding-freshness"),
  }).strict(),
  evidenceCues: z.object({
    freshness: z.enum(["current", "potentially-stale"]),
    confidence: z.object({
      state: z.literal("not-assessed"),
      basis: z.literal("no-governed-confidence-evaluation-is-bound"),
    }).strict(),
  }).strict(),
  observedAt: z.string().datetime(),
  sourceBoundary: z.literal("current-governed-product-initiative-readiness-and-handoff-projections-only"),
  privacyBoundary: z.literal("summary-exposes-identities-counts-statuses-times-and-digests-not-narrative-findings-evidence-source-content-personal-data-secrets-or-credentials"),
  limitations: z.array(z.string().trim().min(4).max(1_000)).min(1).max(8),
  authorityBoundary: z.literal("phase-1-summary-is-read-only-candidate-evidence-not-readiness-approval-acceptance-phase-entry-release-or-action-authority"),
}

function validatePhase1Summary(value: {
  readiness: { result: string; gate?: unknown; gaps: { total: number }; attentionRequired: boolean }
  handoff: { state: string; package?: unknown; gaps: { total: number }; attentionRequired: boolean }
  phaseStatus: { state: string; declaredGapCount: number; attentionSignalCount: number }
  freshness: { state: string; readinessObservedAt: string; handoffObservedAt: string; staleBindingCount: number; staleSourceReferenceCount: number }
  evidenceCues: { freshness: string }
  observedAt: string
}, context: z.RefinementCtx): void {
  const readinessAttention = value.readiness.result !== "passed" || value.readiness.gaps.total > 0 || !value.readiness.gate
  const handoffAttention = value.handoff.state !== "complete-for-review" || value.handoff.gaps.total > 0 || !value.handoff.package
  const freshnessAttention = value.freshness.staleBindingCount > 0 || value.freshness.staleSourceReferenceCount > 0
  if (value.readiness.attentionRequired !== readinessAttention) {
    context.addIssue({ code: "custom", path: ["readiness", "attentionRequired"], message: "Readiness attention must reflect the exact gate result and gaps" })
  }
  if (value.handoff.attentionRequired !== handoffAttention) {
    context.addIssue({ code: "custom", path: ["handoff", "attentionRequired"], message: "Handoff attention must reflect the exact package state and gaps" })
  }
  const expectedSignals = Number(readinessAttention) + Number(handoffAttention) + Number(freshnessAttention)
  const expectedState = expectedSignals === 0 ? "candidate-complete-for-human-review" : "attention-required"
  if (value.phaseStatus.attentionSignalCount !== expectedSignals || value.phaseStatus.state !== expectedState) {
    context.addIssue({ code: "custom", path: ["phaseStatus"], message: "Phase status must reflect every readiness, handoff, and freshness attention signal" })
  }
  if (value.phaseStatus.declaredGapCount !== value.readiness.gaps.total + value.handoff.gaps.total) {
    context.addIssue({ code: "custom", path: ["phaseStatus", "declaredGapCount"], message: "Phase declared gap count must reconcile exactly" })
  }
  if ((value.freshness.state === "attention-required") !== freshnessAttention ||
      (value.evidenceCues.freshness === "potentially-stale") !== freshnessAttention) {
    context.addIssue({ code: "custom", path: ["freshness"], message: "Freshness must expose stale bindings and Source references" })
  }
  if (Date.parse(value.freshness.readinessObservedAt) > Date.parse(value.observedAt) ||
      Date.parse(value.freshness.handoffObservedAt) > Date.parse(value.observedAt)) {
    context.addIssue({ code: "custom", path: ["observedAt"], message: "Summary observation cannot predate its governed inputs" })
  }
}

export const phase1SummaryDashboardContentSchema = z.object(phase1SummaryDashboardFields)
  .strict()
  .superRefine(validatePhase1Summary)

export const phase1SummaryDashboardSchema = z.object({
  ...phase1SummaryDashboardFields,
  snapshotDigest: digestSchema,
}).strict().superRefine(validatePhase1Summary)

export type Phase1SummaryDashboardRequest = z.infer<typeof phase1SummaryDashboardRequestSchema>
export type Phase1SummaryDashboardContent = z.infer<typeof phase1SummaryDashboardContentSchema>
export type Phase1SummaryDashboard = z.infer<typeof phase1SummaryDashboardSchema>
