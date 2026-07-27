import { z } from "zod"

import { p0P4ReadinessOutputKinds, p0P4ReadinessOutputKindSchema, p0P4ReadinessRecordKinds } from "./p0-p4-readiness-gate.js"
import { effectDescriptorSchema } from "./execution.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)

const exactRecordBindingSchema = z.object({
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
}).strict()

export const phase1ChangeImpactDashboardRequestSchema = z.object({
  expectedProductId: z.string().uuid(),
  expectedProductRevision: z.number().int().positive(),
  expectedProductDigest: digestSchema,
  expectedInitiativeId: z.string().uuid(),
  expectedInitiativeRevision: z.number().int().positive(),
  expectedInitiativeDigest: digestSchema,
  expectedChangeId: z.string().uuid(),
  expectedChangeRevision: z.number().int().positive(),
  expectedChangeDigest: digestSchema,
}).strict()

const phase1ImpactOutputSchema = z.object({
  outputKind: p0P4ReadinessOutputKindSchema,
  recordKind: z.string().trim().min(2).max(160),
  readiness: z.object({
    applicability: z.enum(["applicable", "not-applicable-candidate", "unresolved", "not-assessed"]),
    evaluationState: z.enum([
      "blocked",
      "conditionally-satisfied",
      "failed",
      "incomplete",
      "not-applicable-candidate",
      "not-assessed",
      "satisfied",
    ]),
    freshness: z.enum(["current", "stale", "unknown"]),
    subjectCount: z.number().int().nonnegative().max(512),
  }).strict(),
  impact: z.object({
    state: z.enum(["current-trace-observed", "attention-required", "not-established"]),
    exactMatchedSubjectCount: z.number().int().nonnegative().max(512),
    staleSubjectBindingCount: z.number().int().nonnegative().max(512),
    traceReferenceCount: z.number().int().nonnegative().max(512),
    validTraceCount: z.number().int().nonnegative().max(512),
    unresolvedTraceCount: z.number().int().nonnegative().max(512),
    staleTraceCount: z.number().int().nonnegative().max(512),
    invalidTraceCount: z.number().int().nonnegative().max(512),
    upstreamTraceCount: z.number().int().nonnegative().max(512),
    downstreamTraceCount: z.number().int().nonnegative().max(512),
    revalidationState: z.literal("not-established"),
    coverageBoundary: z.literal("absence-of-an-exact-trace-match-does-not-prove-absence-of-impact"),
  }).strict(),
  handoff: z.object({
    disposition: z.enum(["included", "omitted-not-applicable", "reference-only", "unresolved", "not-established"]),
    freshness: z.enum(["current", "stale", "unknown"]),
    subjectCount: z.number().int().nonnegative().max(512),
  }).strict(),
}).strict().superRefine((output, context) => {
  if (output.recordKind !== p0P4ReadinessRecordKinds[output.outputKind]) {
    context.addIssue({ code: "custom", path: ["recordKind"], message: "Phase 1 impact output kind must use its canonical governed record kind" })
  }
  if (output.impact.exactMatchedSubjectCount > output.readiness.subjectCount) {
    context.addIssue({ code: "custom", path: ["impact", "exactMatchedSubjectCount"], message: "Exact impact matches cannot exceed governed readiness subjects" })
  }
  if (output.impact.traceReferenceCount !== output.impact.validTraceCount + output.impact.unresolvedTraceCount +
      output.impact.staleTraceCount + output.impact.invalidTraceCount) {
    context.addIssue({ code: "custom", path: ["impact", "traceReferenceCount"], message: "Impact trace assessment counts must reconcile exactly" })
  }
  if (output.impact.traceReferenceCount !== output.impact.upstreamTraceCount + output.impact.downstreamTraceCount) {
    context.addIssue({ code: "custom", path: ["impact", "traceReferenceCount"], message: "Impact trace direction counts must reconcile exactly" })
  }
  const attention = output.impact.staleSubjectBindingCount > 0 || output.impact.unresolvedTraceCount > 0 ||
    output.impact.staleTraceCount > 0 || output.impact.invalidTraceCount > 0
  const expectedImpactState = attention
    ? "attention-required"
    : output.impact.exactMatchedSubjectCount > 0
      ? "current-trace-observed"
      : "not-established"
  if (output.impact.state !== expectedImpactState) {
    context.addIssue({ code: "custom", path: ["impact", "state"], message: "Impact state must reflect exact and stale trace evidence" })
  }
  if (output.readiness.applicability === "not-assessed" &&
      (output.readiness.evaluationState !== "not-assessed" || output.readiness.freshness !== "unknown" || output.readiness.subjectCount !== 0)) {
    context.addIssue({ code: "custom", path: ["readiness"], message: "An absent readiness output must remain wholly not assessed" })
  }
  if (output.handoff.disposition === "not-established" &&
      (output.handoff.freshness !== "unknown" || output.handoff.subjectCount !== 0)) {
    context.addIssue({ code: "custom", path: ["handoff"], message: "An absent handoff item must remain wholly not established" })
  }
})

const phase1ChangeImpactDashboardFields = {
  schemaVersion: z.literal(1),
  kind: z.literal("phase-1-change-impact-dashboard"),
  phase: z.object({
    id: z.literal("phase-1b-product"),
    label: z.literal("Phase 1B — Product P0–P4"),
  }).strict(),
  product: z.object({ recordType: z.literal("product"), ...exactRecordBindingSchema.shape }).strict(),
  initiative: z.object({
    recordType: z.literal("initiative"),
    ...exactRecordBindingSchema.shape,
    state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]),
  }).strict(),
  change: z.object({
    recordType: z.literal("change"),
    ...exactRecordBindingSchema.shape,
    state: z.enum(["proposed", "planned", "active", "blocked", "completed", "cancelled"]),
    effectEnvelope: z.array(effectDescriptorSchema).min(1).max(effectDescriptorSchema.options.length),
  }).strict(),
  sources: z.object({
    changeImpactSnapshotDigest: digestSchema,
    readinessSnapshotDigest: digestSchema,
    handoffSnapshotDigest: digestSchema,
    readinessGate: exactRecordBindingSchema.optional(),
    handoffPackage: exactRecordBindingSchema.optional(),
  }).strict(),
  changeScope: z.object({
    workItemCount: z.number().int().nonnegative(),
    changedArtifactCount: z.number().int().nonnegative(),
    effectTargetCount: z.number().int().nonnegative(),
    affectedUnitCount: z.number().int().nonnegative(),
    decisionCount: z.number().int().nonnegative(),
    riskCount: z.number().int().nonnegative(),
    unresolvedTraceLinkCount: z.number().int().nonnegative(),
    staleTraceLinkCount: z.number().int().nonnegative(),
    invalidTraceLinkCount: z.number().int().nonnegative(),
    traceAnalysisTruncated: z.boolean(),
  }).strict(),
  outputs: z.array(phase1ImpactOutputSchema).length(p0P4ReadinessOutputKinds.length),
  coverage: z.object({
    state: z.literal("bounded-not-complete"),
    outputCount: z.literal(p0P4ReadinessOutputKinds.length),
    applicableOutputCount: z.number().int().nonnegative().max(p0P4ReadinessOutputKinds.length),
    currentTraceObservedOutputCount: z.number().int().nonnegative().max(p0P4ReadinessOutputKinds.length),
    attentionRequiredOutputCount: z.number().int().nonnegative().max(p0P4ReadinessOutputKinds.length),
    impactNotEstablishedOutputCount: z.number().int().nonnegative().max(p0P4ReadinessOutputKinds.length),
    revalidationNotEstablishedOutputCount: z.literal(p0P4ReadinessOutputKinds.length),
    basis: z.literal("exact-current-readiness-subjects-matched-to-bounded-governed-change-trace-results"),
    coverageBoundary: z.literal("trace-presence-proves-only-the-recorded-link-and-trace-absence-does-not-prove-no-impact"),
  }).strict(),
  owners: z.object({
    state: z.literal("unbound"),
    boundOutputOwnerCount: z.literal(0),
    basis: z.literal("no-governed-phase-output-owner-assignment-is-bound"),
  }).strict(),
  governance: z.object({
    changeApproval: z.literal("not-established"),
    riskAcceptanceAuthority: z.literal("not-established"),
    revalidationAuthority: z.literal("not-established"),
    productOwnerAcceptance: z.literal("not-established"),
    effectAuthority: z.literal("not-established"),
  }).strict(),
  freshness: z.object({
    state: z.enum(["current", "attention-required"]),
    changeImpactEvaluatedAt: z.string().datetime(),
    readinessObservedAt: z.string().datetime(),
    handoffObservedAt: z.string().datetime(),
    staleBindingCount: z.number().int().nonnegative(),
    staleSourceReferenceCount: z.number().int().nonnegative(),
    traceAttentionLinkCount: z.number().int().nonnegative(),
    traceAnalysisTruncated: z.boolean(),
    basis: z.literal("current-governed-snapshots-and-declared-trace-readiness-handoff-freshness"),
  }).strict(),
  evidenceCues: z.object({
    freshness: z.enum(["current", "potentially-stale"]),
    confidence: z.object({
      state: z.literal("not-assessed"),
      basis: z.literal("bounded-trace-coverage-does-not-establish-impact-confidence-or-completeness"),
    }).strict(),
  }).strict(),
  observedAt: z.string().datetime(),
  sourceBoundary: z.literal("current-governed-product-initiative-change-readiness-handoff-and-bounded-trace-projections-only"),
  privacyBoundary: z.literal("dashboard-exposes-identities-digests-counts-statuses-effects-and-times-not-change-text-output-content-findings-evidence-source-content-personal-data-secrets-or-credentials"),
  limitations: z.array(z.string().trim().min(4).max(1_000)).min(1).max(8),
  authorityBoundary: z.literal("phase-1-change-impact-dashboard-is-read-only-observed-candidate-evidence-not-impact-completeness-revalidation-approval-risk-acceptance-readiness-effect-release-or-action-authority"),
}

function validatePhase1ChangeImpact(value: {
  outputs: Array<{
    outputKind: string
    readiness: { applicability: string }
    impact: { state: string; staleSubjectBindingCount: number }
  }>
  changeScope: {
    unresolvedTraceLinkCount: number
    staleTraceLinkCount: number
    invalidTraceLinkCount: number
    traceAnalysisTruncated: boolean
  }
  coverage: {
    applicableOutputCount: number
    currentTraceObservedOutputCount: number
    attentionRequiredOutputCount: number
    impactNotEstablishedOutputCount: number
  }
  freshness: {
    state: string
    changeImpactEvaluatedAt: string
    readinessObservedAt: string
    handoffObservedAt: string
    staleBindingCount: number
    staleSourceReferenceCount: number
    traceAttentionLinkCount: number
    traceAnalysisTruncated: boolean
  }
  evidenceCues: { freshness: string }
  observedAt: string
}, context: z.RefinementCtx): void {
  if (value.outputs.some((output, index) => output.outputKind !== p0P4ReadinessOutputKinds[index])) {
    context.addIssue({ code: "custom", path: ["outputs"], message: "Phase 1 impact outputs must contain the complete canonical P0-P4 output catalog" })
  }
  const counts = {
    applicable: value.outputs.filter((output) => output.readiness.applicability === "applicable").length,
    current: value.outputs.filter((output) => output.impact.state === "current-trace-observed").length,
    attention: value.outputs.filter((output) => output.impact.state === "attention-required").length,
    unknown: value.outputs.filter((output) => output.impact.state === "not-established").length,
  }
  if (value.coverage.applicableOutputCount !== counts.applicable ||
      value.coverage.currentTraceObservedOutputCount !== counts.current ||
      value.coverage.attentionRequiredOutputCount !== counts.attention ||
      value.coverage.impactNotEstablishedOutputCount !== counts.unknown ||
      counts.current + counts.attention + counts.unknown !== p0P4ReadinessOutputKinds.length) {
    context.addIssue({ code: "custom", path: ["coverage"], message: "Phase 1 impact coverage counts must reconcile exactly" })
  }
  if (value.freshness.traceAnalysisTruncated !== value.changeScope.traceAnalysisTruncated) {
    context.addIssue({ code: "custom", path: ["freshness", "traceAnalysisTruncated"], message: "Trace truncation must be consistent across the dashboard" })
  }
  if (value.freshness.traceAttentionLinkCount !== value.changeScope.unresolvedTraceLinkCount +
      value.changeScope.staleTraceLinkCount + value.changeScope.invalidTraceLinkCount) {
    context.addIssue({ code: "custom", path: ["freshness", "traceAttentionLinkCount"], message: "Trace attention count must reconcile to the bounded Change/Impact source" })
  }
  const freshnessAttention = value.freshness.staleBindingCount > 0 || value.freshness.staleSourceReferenceCount > 0 ||
    value.freshness.traceAttentionLinkCount > 0 || value.freshness.traceAnalysisTruncated || counts.attention > 0
  if ((value.freshness.state === "attention-required") !== freshnessAttention ||
      (value.evidenceCues.freshness === "potentially-stale") !== freshnessAttention) {
    context.addIssue({ code: "custom", path: ["freshness"], message: "Dashboard freshness must expose every bounded stale or truncated input" })
  }
  if ([value.freshness.changeImpactEvaluatedAt, value.freshness.readinessObservedAt, value.freshness.handoffObservedAt]
    .some((timestamp) => Date.parse(timestamp) > Date.parse(value.observedAt))) {
    context.addIssue({ code: "custom", path: ["observedAt"], message: "Dashboard observation cannot predate its governed inputs" })
  }
}

export const phase1ChangeImpactDashboardContentSchema = z.object(phase1ChangeImpactDashboardFields)
  .strict()
  .superRefine(validatePhase1ChangeImpact)

export const phase1ChangeImpactDashboardSchema = z.object({
  ...phase1ChangeImpactDashboardFields,
  snapshotDigest: digestSchema,
}).strict().superRefine(validatePhase1ChangeImpact)

export type Phase1ChangeImpactDashboardRequest = z.infer<typeof phase1ChangeImpactDashboardRequestSchema>
export type Phase1ChangeImpactDashboardContent = z.infer<typeof phase1ChangeImpactDashboardContentSchema>
export type Phase1ChangeImpactDashboard = z.infer<typeof phase1ChangeImpactDashboardSchema>
