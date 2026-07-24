import { z } from "zod"

import { portableSelectionSettingsSchema, truthClassSchema } from "./agent.js"
import { effectDescriptorSchema } from "./execution.js"
import {
  portableLocatorSchema,
  traceEndpointSchema,
  traceRelationshipSchema,
} from "./product-studio.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)

export const deliveryPhaseIds = [
  "phase-0-1a-foundation",
  "phase-1b-product",
  "phase-1c-acceptance",
  "phase-2-design",
  "phase-3a-readiness",
  "phase-3b-implementation",
  "phase-4-release-learning",
] as const

export const deliveryPhaseIdSchema = z.enum(deliveryPhaseIds)

export const phaseDashboardIds = [
  "foundation-summary",
  "product-architecture",
  "phase-release-readiness",
  "ux-figma",
  "backlog-readiness",
  "implementation-qa",
  "release-learning",
  "change-impact",
  "agent-model",
] as const

export const phaseDashboardIdSchema = z.enum(phaseDashboardIds)
export const phaseDashboardPanelRoleSchema = z.enum(["phase", "change-impact", "agent-model"])

export const deliveryPhaseDefinitions = {
  "phase-0-1a-foundation": {
    label: "Phase 0 / 1A — Four-IDE Platform Foundation",
    primaryDashboardId: "foundation-summary",
  },
  "phase-1b-product": {
    label: "Phase 1B — Product P0–P4",
    primaryDashboardId: "product-architecture",
  },
  "phase-1c-acceptance": {
    label: "Phase 1C — Four-IDE Phase 1 Release",
    primaryDashboardId: "phase-release-readiness",
  },
  "phase-2-design": {
    label: "Phase 2 — UX and Figma Loop",
    primaryDashboardId: "ux-figma",
  },
  "phase-3a-readiness": {
    label: "Phase 3A — Backlog and Implementation Readiness",
    primaryDashboardId: "backlog-readiness",
  },
  "phase-3b-implementation": {
    label: "Phase 3B — Controlled Implementation and QA",
    primaryDashboardId: "implementation-qa",
  },
  "phase-4-release-learning": {
    label: "Phase 4 — Release, Publish, and Learning",
    primaryDashboardId: "release-learning",
  },
} as const satisfies Record<
  typeof deliveryPhaseIds[number],
  { readonly label: string; readonly primaryDashboardId: typeof phaseDashboardIds[number] }
>

export const phaseDashboardDefinitions = {
  "foundation-summary": { title: "Foundation summary and readiness", role: "phase" },
  "product-architecture": { title: "Product and architecture", role: "phase" },
  "phase-release-readiness": { title: "Phase release readiness", role: "phase" },
  "ux-figma": { title: "UX and Figma", role: "phase" },
  "backlog-readiness": { title: "Backlog and implementation readiness", role: "phase" },
  "implementation-qa": { title: "Controlled implementation and QA", role: "phase" },
  "release-learning": { title: "Release and learning", role: "phase" },
  "change-impact": { title: "Change and impact", role: "change-impact" },
  "agent-model": { title: "Agent and model", role: "agent-model" },
} as const satisfies Record<
  typeof phaseDashboardIds[number],
  { readonly title: string; readonly role: "phase" | "change-impact" | "agent-model" }
>

export const phaseDashboardProductBindingSchema = z.object({
  recordType: z.literal("product"),
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
}).strict()

const dashboardApplicabilityDecisionSchema = z.object({
  recordType: z.literal("decision"),
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
}).strict()

export const dashboardApplicabilitySchema = z.object({
  status: z.enum(["applicable", "not-applicable", "unknown"]),
  basis: z.enum(["phase-contract", "governed-decision", "not-evaluated"]),
  decision: dashboardApplicabilityDecisionSchema.optional(),
}).strict().superRefine((applicability, context) => {
  if (applicability.basis === "phase-contract") {
    if (applicability.status !== "applicable" || applicability.decision) {
      context.addIssue({
        code: "custom",
        message: "Phase-contract applicability must be applicable and cannot cite a governance decision",
      })
    }
    return
  }
  if (applicability.basis === "not-evaluated") {
    if (applicability.status !== "unknown" || applicability.decision) {
      context.addIssue({
        code: "custom",
        message: "Unevaluated applicability must remain unknown and cannot cite a governance decision",
      })
    }
    return
  }
  if (applicability.status === "unknown" || !applicability.decision) {
    context.addIssue({
      code: "custom",
      message: "Governed applicability requires an exact decision and a resolved status",
    })
  }
})

export const phaseDashboardPanelSchema = z.object({
  id: phaseDashboardIdSchema,
  role: phaseDashboardPanelRoleSchema,
  title: z.string().trim().min(2).max(160),
  applicability: dashboardApplicabilitySchema,
  state: z.enum(["active", "not-applicable", "attention-required"]),
}).strict().superRefine((panel, context) => {
  const expectedState = panel.applicability.status === "applicable"
    ? "active"
    : panel.applicability.status === "not-applicable"
      ? "not-applicable"
      : "attention-required"
  if (panel.state !== expectedState) {
    context.addIssue({
      code: "custom",
      path: ["state"],
      message: "Dashboard panel state must match its applicability status",
    })
  }
  const definition = phaseDashboardDefinitions[panel.id]
  if (panel.role !== definition.role || panel.title !== definition.title) {
    context.addIssue({
      code: "custom",
      message: "Dashboard panel identity must match the canonical catalog",
    })
  }
})

const phaseDashboardFrameworkFields = {
  schemaVersion: z.literal(1),
  kind: z.literal("phase-dashboard-framework"),
  catalogVersion: z.literal("gaep-phase-dashboards-v1"),
  product: phaseDashboardProductBindingSchema,
  phase: z.object({
    id: deliveryPhaseIdSchema,
    label: z.string().trim().min(2).max(160),
  }).strict(),
  panels: z.array(phaseDashboardPanelSchema).length(3),
  observedAt: z.string().datetime(),
  sourceBoundary: z.literal("governed-repository-and-engine-only"),
  limitations: z.array(z.string().trim().min(4).max(1_000)).min(1).max(8),
  authorityBoundary: z.literal("dashboard-is-a-projection-not-phase-approval-readiness-or-applicability-evidence"),
}

function validateFramework(value: {
  phase: { id: typeof deliveryPhaseIds[number]; label: string }
  panels: Array<{ id: typeof phaseDashboardIds[number]; role: "phase" | "change-impact" | "agent-model" }>
}, context: z.RefinementCtx): void {
  const definition = deliveryPhaseDefinitions[value.phase.id]
  if (value.phase.label !== definition.label) {
    context.addIssue({ code: "custom", path: ["phase", "label"], message: "Phase label must match the canonical catalog" })
  }
  const expected = [
    { id: definition.primaryDashboardId, role: "phase" },
    { id: "change-impact", role: "change-impact" },
    { id: "agent-model", role: "agent-model" },
  ] as const
  for (const [index, panel] of value.panels.entries()) {
    const expectedPanel = expected[index]
    if (!expectedPanel || panel.id !== expectedPanel.id || panel.role !== expectedPanel.role) {
      context.addIssue({
        code: "custom",
        path: ["panels", index],
        message: "Dashboard panels must follow the canonical phase, Change/Impact, Agent/Model order",
      })
    }
  }
}

export const phaseDashboardFrameworkContentSchema = z.object(phaseDashboardFrameworkFields)
  .strict()
  .superRefine(validateFramework)

export const phaseDashboardFrameworkSchema = z.object({
  ...phaseDashboardFrameworkFields,
  compositionDigest: digestSchema,
}).strict().superRefine(validateFramework)

export const phaseDashboardCompositionRequestSchema = z.object({
  phase: deliveryPhaseIdSchema,
  expectedProductId: z.string().uuid(),
  expectedProductRevision: z.number().int().positive(),
  expectedProductDigest: digestSchema,
}).strict()

const changeImpactReferenceFields = {
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
}

const changeImpactWorkItemReferenceSchema = z.object({
  recordType: z.literal("work-item"),
  ...changeImpactReferenceFields,
}).strict()

const changeImpactDecisionReferenceSchema = z.object({
  recordType: z.literal("decision"),
  ...changeImpactReferenceFields,
}).strict()

const changeImpactRiskReferenceSchema = z.object({
  recordType: z.literal("risk"),
  ...changeImpactReferenceFields,
}).strict()

const changeImpactWorkItemStateSchema = z.enum([
  "proposed",
  "planned",
  "ready",
  "in-progress",
  "blocked",
  "completed",
  "cancelled",
])

export const changeImpactDashboardRequestSchema = z.object({
  expectedProductId: z.string().uuid(),
  expectedProductRevision: z.number().int().positive(),
  expectedProductDigest: digestSchema,
  expectedChangeId: z.string().uuid(),
  expectedChangeRevision: z.number().int().positive(),
  expectedChangeDigest: digestSchema,
}).strict()

export const changeImpactChangeCatalogRequestSchema = z.object({
  expectedProductId: z.string().uuid(),
  expectedProductRevision: z.number().int().positive(),
  expectedProductDigest: digestSchema,
}).strict()

const changeImpactChangeStateSchema = z.enum(["proposed", "planned", "active", "blocked", "completed", "cancelled"])
const changeImpactEffectEnvelopeSchema = z.array(effectDescriptorSchema)
  .min(1)
  .max(effectDescriptorSchema.options.length)
  .refine((effects) => new Set(effects).size === effects.length, "Change effects must be unique")

const changeImpactChangeCatalogItemSchema = z.object({
  recordType: z.literal("change"),
  ...changeImpactReferenceFields,
  state: changeImpactChangeStateSchema,
  effectEnvelope: changeImpactEffectEnvelopeSchema,
}).strict()

const changeImpactChangeCatalogFields = {
  schemaVersion: z.literal(1),
  kind: z.literal("change-impact-change-catalog"),
  product: phaseDashboardProductBindingSchema,
  items: z.array(changeImpactChangeCatalogItemSchema).max(256),
  total: z.number().int().nonnegative(),
  omitted: z.number().int().nonnegative(),
  observedAt: z.string().datetime(),
  sourceBoundary: z.literal("current-governed-change-metadata-only"),
  limitations: z.array(z.string().trim().min(4).max(1_000)).min(1).max(8),
  authorityBoundary: z.literal("change-catalog-selection-does-not-approve-change-or-authorize-effects"),
}

function validateChangeImpactChangeCatalog(value: {
  items: Array<{ recordId: string }>
  total: number
  omitted: number
}, context: z.RefinementCtx): void {
  if (value.items.length + value.omitted !== value.total) {
    context.addIssue({ code: "custom", path: ["total"], message: "Change catalog totals must reconcile exactly" })
  }
  if (new Set(value.items.map((item) => item.recordId)).size !== value.items.length) {
    context.addIssue({ code: "custom", path: ["items"], message: "Change catalog rows must be unique" })
  }
}

export const changeImpactChangeCatalogContentSchema = z.object(changeImpactChangeCatalogFields)
  .strict()
  .superRefine(validateChangeImpactChangeCatalog)

export const changeImpactChangeCatalogSchema = z.object({
  ...changeImpactChangeCatalogFields,
  snapshotDigest: digestSchema,
}).strict().superRefine(validateChangeImpactChangeCatalog)

const changeImpactWorkItemSchema = z.object({
  record: changeImpactWorkItemReferenceSchema,
  state: changeImpactWorkItemStateSchema,
}).strict()

const changeImpactArtifactSchema = z.object({
  sourceWorkItem: changeImpactWorkItemReferenceSchema,
  locator: portableLocatorSchema,
}).strict()

const changeImpactTraceReferenceSchema = z.object({
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  assessmentDigest: digestSchema,
  assessedState: z.enum(["valid", "unresolved", "stale", "invalid"]),
}).strict()

const changeImpactAffectedUnitSchema = z.object({
  direction: z.enum(["upstream", "downstream"]),
  relationship: traceRelationshipSchema,
  endpoint: traceEndpointSchema,
  trace: changeImpactTraceReferenceSchema,
}).strict()

const changeImpactDecisionSchema = z.object({
  record: changeImpactDecisionReferenceSchema,
  state: z.enum(["open", "decided", "deferred", "superseded"]),
  outcome: z.enum(["human-selected", "not-selected"]),
}).strict().superRefine((decision, context) => {
  if ((decision.state === "decided") !== (decision.outcome === "human-selected")) {
    context.addIssue({ code: "custom", message: "Only a decided Decision can carry a human-selected outcome" })
  }
})

const changeImpactRiskSchema = z.object({
  record: changeImpactRiskReferenceSchema,
  state: z.enum(["open", "treated", "accepted", "closed"]),
  likelihood: z.enum(["rare", "unlikely", "possible", "likely", "almost-certain", "unknown"]),
  impact: z.enum(["negligible", "minor", "moderate", "major", "critical", "unknown"]),
  acceptance: z.enum(["human-accepted", "not-accepted"]),
}).strict().superRefine((risk, context) => {
  if ((risk.state === "accepted") !== (risk.acceptance === "human-accepted")) {
    context.addIssue({ code: "custom", message: "Only an accepted Risk can carry human acceptance" })
  }
})

const changeImpactLimitSchema = z.object({
  shown: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  omitted: z.number().int().nonnegative(),
}).strict().superRefine((limit, context) => {
  if (limit.shown + limit.omitted !== limit.total) {
    context.addIssue({ code: "custom", message: "Dashboard limit totals must reconcile exactly" })
  }
})

const changeImpactDashboardFields = {
  schemaVersion: z.literal(1),
  kind: z.literal("change-impact-dashboard"),
  product: phaseDashboardProductBindingSchema,
  change: z.object({
    ...changeImpactReferenceFields,
    recordType: z.literal("change"),
    state: changeImpactChangeStateSchema,
    effectEnvelope: changeImpactEffectEnvelopeSchema,
  }).strict(),
  workItems: z.array(changeImpactWorkItemSchema).max(256),
  changedArtifacts: z.array(changeImpactArtifactSchema).max(512),
  effectTargets: z.array(changeImpactArtifactSchema).max(512),
  affectedUnits: z.array(changeImpactAffectedUnitSchema).max(512),
  governance: z.object({
    approval: z.object({
      state: z.literal("not-established"),
      basis: z.literal("current-contract-has-no-change-approval-record"),
    }).strict(),
    decisions: z.array(changeImpactDecisionSchema).max(256),
    risks: z.array(changeImpactRiskSchema).max(256),
    authorityBoundary: z.literal("decisions-and-risk-acceptance-do-not-approve-the-change"),
  }).strict(),
  freshness: z.object({
    state: z.enum(["current", "attention-required"]),
    evaluatedAt: z.string().datetime(),
    unresolvedTraceLinks: z.number().int().nonnegative(),
    invalidTraceLinks: z.number().int().nonnegative(),
    staleTraceLinks: z.number().int().nonnegative(),
    staleGovernanceReferences: z.number().int().nonnegative(),
    traceAnalysisTruncated: z.boolean(),
    coverageBoundary: z.literal("absence-of-a-trace-link-does-not-prove-absence-of-impact"),
  }).strict(),
  limits: z.object({
    workItems: changeImpactLimitSchema,
    changedArtifacts: changeImpactLimitSchema,
    effectTargets: changeImpactLimitSchema,
    affectedUnits: changeImpactLimitSchema,
    decisions: changeImpactLimitSchema,
    risks: changeImpactLimitSchema,
    truncated: z.boolean(),
  }).strict(),
  observedAt: z.string().datetime(),
  sourceBoundary: z.literal("current-governed-records-and-bounded-trace-analysis"),
  limitations: z.array(z.string().trim().min(4).max(1_000)).min(1).max(8),
  authorityBoundary: z.literal("change-impact-dashboard-does-not-approve-change-accept-risk-or-authorize-effects"),
}

function validateChangeImpactDashboard(value: {
  workItems: Array<{ record: { recordId: string } }>
  changedArtifacts: Array<{ sourceWorkItem: { recordId: string }; locator: unknown }>
  effectTargets: Array<{ sourceWorkItem: { recordId: string }; locator: unknown }>
  affectedUnits: Array<{ direction: string; endpoint: { recordType: string; recordId: string }; trace: { recordId: string } }>
  governance: { decisions: Array<{ record: { recordId: string } }>; risks: Array<{ record: { recordId: string } }> }
  freshness: {
    state: "current" | "attention-required"
    evaluatedAt: string
    unresolvedTraceLinks: number
    invalidTraceLinks: number
    staleTraceLinks: number
    staleGovernanceReferences: number
    traceAnalysisTruncated: boolean
  }
  limits: {
    workItems: { shown: number; omitted: number }
    changedArtifacts: { shown: number; omitted: number }
    effectTargets: { shown: number; omitted: number }
    affectedUnits: { shown: number; omitted: number }
    decisions: { shown: number; omitted: number }
    risks: { shown: number; omitted: number }
    truncated: boolean
  }
  observedAt: string
}, context: z.RefinementCtx): void {
  const categories = [
    ["workItems", value.workItems.length, value.limits.workItems],
    ["changedArtifacts", value.changedArtifacts.length, value.limits.changedArtifacts],
    ["effectTargets", value.effectTargets.length, value.limits.effectTargets],
    ["affectedUnits", value.affectedUnits.length, value.limits.affectedUnits],
    ["decisions", value.governance.decisions.length, value.limits.decisions],
    ["risks", value.governance.risks.length, value.limits.risks],
  ] as const
  for (const [name, length, limit] of categories) {
    if (limit.shown !== length) {
      context.addIssue({ code: "custom", path: ["limits", name, "shown"], message: "Shown count must match the projected rows" })
    }
  }
  const shouldBeTruncated = categories.some(([, , limit]) => limit.omitted > 0) || value.freshness.traceAnalysisTruncated
  if (value.limits.truncated !== shouldBeTruncated) {
    context.addIssue({ code: "custom", path: ["limits", "truncated"], message: "Truncation must reflect every omitted source row" })
  }
  const shouldRequireAttention = value.freshness.unresolvedTraceLinks > 0
    || value.freshness.invalidTraceLinks > 0
    || value.freshness.staleTraceLinks > 0
    || value.freshness.staleGovernanceReferences > 0
    || shouldBeTruncated
  if ((value.freshness.state === "attention-required") !== shouldRequireAttention) {
    context.addIssue({ code: "custom", path: ["freshness", "state"], message: "Freshness state must reflect trace uncertainty and truncation" })
  }
  if (Date.parse(value.freshness.evaluatedAt) > Date.parse(value.observedAt)) {
    context.addIssue({ code: "custom", path: ["freshness", "evaluatedAt"], message: "Trace analysis cannot be newer than dashboard observation" })
  }
  const unique = (values: string[], path: Array<string | number>) => {
    if (new Set(values).size !== values.length) context.addIssue({ code: "custom", path, message: "Dashboard rows must be unique" })
  }
  unique(value.workItems.map((entry) => entry.record.recordId), ["workItems"])
  unique(value.changedArtifacts.map((entry) => `${entry.sourceWorkItem.recordId}:${JSON.stringify(entry.locator)}`), ["changedArtifacts"])
  unique(value.effectTargets.map((entry) => `${entry.sourceWorkItem.recordId}:${JSON.stringify(entry.locator)}`), ["effectTargets"])
  unique(value.affectedUnits.map((entry) => `${entry.direction}:${entry.endpoint.recordType}:${entry.endpoint.recordId}:${entry.trace.recordId}`), ["affectedUnits"])
  unique(value.governance.decisions.map((entry) => entry.record.recordId), ["governance", "decisions"])
  unique(value.governance.risks.map((entry) => entry.record.recordId), ["governance", "risks"])
}

export const changeImpactDashboardContentSchema = z.object(changeImpactDashboardFields)
  .strict()
  .superRefine(validateChangeImpactDashboard)

export const changeImpactDashboardSchema = z.object({
  ...changeImpactDashboardFields,
  snapshotDigest: digestSchema,
}).strict().superRefine(validateChangeImpactDashboard)

const agentModelPortableTextSchema = z.string().trim().min(1).max(20_000)

const agentModelExpectedSelectionSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("unselected") }).strict(),
  z.object({ status: z.literal("selected"), selectionDigest: digestSchema }).strict(),
  z.object({ status: z.literal("migration-required"), selectionDigest: digestSchema }).strict(),
  z.object({ status: z.literal("invalid") }).strict(),
])

const agentModelExpectedCapabilitySchema = z.object({
  adapterId: agentModelPortableTextSchema,
  agentId: agentModelPortableTextSchema,
  capabilityDigest: digestSchema,
}).strict()

export const agentModelDashboardRequestSchema = z.object({
  expectedProductId: z.string().uuid(),
  expectedProductRevision: z.number().int().positive(),
  expectedProductDigest: digestSchema,
  expectedSelection: agentModelExpectedSelectionSchema,
  expectedCapabilities: z.array(agentModelExpectedCapabilitySchema).min(1).max(16),
}).strict().superRefine((request, context) => {
  const keys = request.expectedCapabilities.map((entry) => `${entry.adapterId}:${entry.agentId}`)
  if (new Set(keys).size !== keys.length) {
    context.addIssue({ code: "custom", path: ["expectedCapabilities"], message: "Expected capability bindings must be unique" })
  }
})

const agentModelSelectionProjectionSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("unselected") }).strict(),
  z.object({ status: z.literal("invalid") }).strict(),
  z.object({
    status: z.literal("selected"),
    selectionDigest: digestSchema,
    adapterId: agentModelPortableTextSchema,
    agentId: agentModelPortableTextSchema,
    modelId: agentModelPortableTextSchema,
    modelTruthClass: truthClassSchema,
    modelAlias: z.boolean().nullable(),
    settings: portableSelectionSettingsSchema,
    selectedAt: z.string().datetime(),
    capabilityDigest: digestSchema,
    capabilityState: z.enum(["current", "stale"]),
  }).strict(),
  z.object({
    status: z.literal("migration-required"),
    selectionDigest: digestSchema,
    adapterId: agentModelPortableTextSchema,
    agentId: agentModelPortableTextSchema,
    modelId: agentModelPortableTextSchema,
    modelTruthClass: truthClassSchema,
    modelAlias: z.boolean().nullable(),
    settings: portableSelectionSettingsSchema,
    selectedAt: z.string().datetime(),
    capabilityDigest: digestSchema,
    capabilityState: z.literal("migration-required"),
  }).strict(),
])

const agentModelLimitSchema = z.object({
  shown: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  omitted: z.number().int().nonnegative(),
}).strict().superRefine((limit, context) => {
  if (limit.shown + limit.omitted !== limit.total) {
    context.addIssue({ code: "custom", message: "Agent/Model limit totals must reconcile exactly" })
  }
})

const agentModelCapabilitiesSchema = z.object({
  adapterId: agentModelPortableTextSchema,
  adapterVersion: agentModelPortableTextSchema,
  agentId: agentModelPortableTextSchema,
  agentLabel: agentModelPortableTextSchema,
  runtimeVersion: agentModelPortableTextSchema.nullable(),
  capabilityDigest: digestSchema,
  detected: z.boolean(),
  executionInterface: z.enum(["cli-jsonl", "cli-stream-json", "stdio-rpc", "managed-in-process", "unavailable"]),
  interfaceMaturity: z.enum(["stable", "beta", "experimental", "unknown"]),
  support: z.object({
    resume: z.boolean(),
    cancel: z.boolean(),
    checkpoints: z.boolean(),
    modelDiscovery: z.boolean(),
    toolSelection: z.boolean(),
  }).strict(),
  modelCount: z.number().int().nonnegative().max(512),
  limitations: z.object({
    values: z.array(agentModelPortableTextSchema).max(64),
    shown: z.number().int().nonnegative().max(64),
    total: z.number().int().nonnegative().max(512),
    omitted: z.number().int().nonnegative().max(512),
  }).strict().superRefine((limitations, context) => {
    if (limitations.values.length !== limitations.shown || limitations.shown + limitations.omitted !== limitations.total) {
      context.addIssue({ code: "custom", message: "Capability limitation totals must reconcile exactly" })
    }
  }),
  observedAt: z.string().datetime(),
  selected: z.boolean(),
}).strict()

const agentModelRunReferenceSchema = z.object({
  recordType: z.literal("run"),
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
}).strict()

const agentModelManagedProjectionSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("not-observed-in-bounded-window") }).strict(),
  z.object({
    status: z.literal("observed"),
    record: z.object({
      recordType: z.literal("managed-run"),
      recordId: z.string().uuid(),
      revision: z.number().int().positive(),
      digest: digestSchema,
    }).strict(),
    mode: z.enum(["codex-staged", "manual-offline", "claude-context-only"]),
    state: z.enum([
      "prepared", "running", "review-required", "applying", "completed", "failed", "cancelled", "timed-out",
      "unknown", "conflict", "discarded",
    ]),
    attemptNumber: z.number().int().positive().max(1_000_000),
    bindingsDigest: digestSchema,
    provider: z.object({
      adapterId: agentModelPortableTextSchema,
      agentId: agentModelPortableTextSchema,
      modelId: agentModelPortableTextSchema,
      capabilityDigest: digestSchema,
    }).strict(),
    result: z.discriminatedUnion("status", [
      z.object({ status: z.literal("not-bound") }).strict(),
      z.object({
        status: z.literal("bound"),
        recordId: z.string().uuid(),
        digest: digestSchema,
        providerDisposition: z.enum(["completed", "failed", "cancelled", "interrupted", "crashed", "protocol-error", "unknown"]),
        outcomeStatus: z.enum(["satisfied", "failed", "not-assessed", "indeterminate"]),
        evidence: z.object({
          recordId: z.string().uuid(),
          digest: digestSchema,
          eventCount: z.number().int().nonnegative().max(4_096),
          eventsDigest: digestSchema,
          actualEffectCount: z.number().int().nonnegative().max(32),
          capturedAt: z.string().datetime(),
        }).strict(),
      }).strict(),
    ]),
  }).strict(),
])

const agentModelRunSchema = z.object({
  record: agentModelRunReferenceSchema,
  initiativeId: z.string().uuid(),
  state: z.enum(["prepared", "running", "paused", "completed", "failed", "cancelled", "unknown"]),
  agent: z.object({
    adapterId: agentModelPortableTextSchema,
    agentId: agentModelPortableTextSchema,
    modelId: agentModelPortableTextSchema,
    selectionDigest: digestSchema,
  }).strict(),
  startedAt: z.string().datetime().nullable(),
  endedAt: z.string().datetime().nullable(),
  managed: agentModelManagedProjectionSchema,
}).strict()

const agentModelHandoffSchema = z.object({
  record: z.object({
    recordType: z.literal("handoff"),
    recordId: z.string().uuid(),
    revision: z.literal(1),
    digest: digestSchema,
  }).strict(),
  fromRun: agentModelRunReferenceSchema,
  toSelection: z.object({
    adapterId: agentModelPortableTextSchema,
    agentId: agentModelPortableTextSchema,
    modelId: agentModelPortableTextSchema,
    selectionDigest: digestSchema,
  }).strict(),
  state: z.enum(["pending-acknowledgement", "acknowledged"]),
  createdAt: z.string().datetime(),
  acknowledgedAt: z.string().datetime().nullable(),
}).strict()

const unavailableProviderMetricSchema = z.object({
  state: z.literal("unavailable"),
  basis: z.literal("current-managed-records-have-no-provider-usage-or-cost-contract"),
}).strict()

const agentModelDashboardFields = {
  schemaVersion: z.literal(1),
  kind: z.literal("agent-model-dashboard"),
  product: phaseDashboardProductBindingSchema,
  capabilities: z.array(agentModelCapabilitiesSchema).max(16),
  selection: agentModelSelectionProjectionSchema,
  runs: z.array(agentModelRunSchema).max(256),
  handoffs: z.array(agentModelHandoffSchema).max(256),
  providerMetrics: z.object({
    usage: unavailableProviderMetricSchema,
    cost: unavailableProviderMetricSchema,
  }).strict(),
  freshness: z.object({
    state: z.enum(["current", "attention-required"]),
    selectionCapabilityState: z.enum(["current", "unselected", "stale", "migration-required", "invalid"]),
    oldestCapabilityObservedAt: z.string().datetime(),
    newestCapabilityObservedAt: z.string().datetime(),
    truncated: z.boolean(),
    coverageBoundary: z.literal("bounded-current-records-do-not-prove-provider-account-or-native-host-readiness"),
  }).strict(),
  limits: z.object({
    capabilities: agentModelLimitSchema,
    runs: agentModelLimitSchema,
    handoffs: agentModelLimitSchema,
    managedRuns: agentModelLimitSchema,
    truncated: z.boolean(),
  }).strict(),
  observedAt: z.string().datetime(),
  sourceBoundary: z.literal("current-governed-agent-selection-run-handoff-and-managed-evidence-metadata"),
  limitations: z.array(z.string().trim().min(4).max(1_000)).min(1).max(8),
  authorityBoundary: z.literal("agent-model-dashboard-does-not-select-switch-handoff-launch-or-authorize-effects"),
}

function validateAgentModelDashboard(value: {
  capabilities: Array<{ adapterId: string; agentId: string; capabilityDigest: string; selected: boolean; observedAt: string }>
  selection: { status: string; adapterId?: string; agentId?: string; capabilityDigest?: string; capabilityState?: string }
  runs: Array<{ record: { recordId: string }; managed: { status: string; record?: { recordId: string } } }>
  handoffs: Array<{ record: { recordId: string }; fromRun: { recordId: string } }>
  freshness: { state: "current" | "attention-required"; selectionCapabilityState: string; oldestCapabilityObservedAt: string; newestCapabilityObservedAt: string; truncated: boolean }
  limits: {
    capabilities: { shown: number; omitted: number }
    runs: { shown: number; omitted: number }
    handoffs: { shown: number; omitted: number }
    managedRuns: { shown: number; omitted: number }
    truncated: boolean
  }
  observedAt: string
}, context: z.RefinementCtx): void {
  const unique = (values: string[], path: Array<string | number>) => {
    if (new Set(values).size !== values.length) context.addIssue({ code: "custom", path, message: "Agent/Model rows must be unique" })
  }
  unique(value.capabilities.map((entry) => `${entry.adapterId}:${entry.agentId}`), ["capabilities"])
  unique(value.runs.map((entry) => entry.record.recordId), ["runs"])
  unique(value.handoffs.map((entry) => entry.record.recordId), ["handoffs"])
  unique(value.runs.flatMap((entry) => entry.managed.status === "observed" && entry.managed.record ? [entry.managed.record.recordId] : []), ["runs", "managed"])
  const categories = [
    ["capabilities", value.capabilities.length, value.limits.capabilities],
    ["runs", value.runs.length, value.limits.runs],
    ["handoffs", value.handoffs.length, value.limits.handoffs],
  ] as const
  for (const [name, length, limit] of categories) {
    if (limit.shown !== length) context.addIssue({ code: "custom", path: ["limits", name, "shown"], message: "Shown count must match projected rows" })
  }
  const shouldBeTruncated = categories.some(([, , limit]) => limit.omitted > 0) || value.limits.managedRuns.omitted > 0
  if (value.limits.truncated !== shouldBeTruncated || value.freshness.truncated !== shouldBeTruncated) {
    context.addIssue({ code: "custom", path: ["limits", "truncated"], message: "Truncation must reflect every omitted source row" })
  }
  const expectedSelectionState = value.selection.status === "selected"
    ? value.selection.capabilityState
    : value.selection.status
  if (value.freshness.selectionCapabilityState !== expectedSelectionState) {
    context.addIssue({ code: "custom", path: ["freshness", "selectionCapabilityState"], message: "Selection capability freshness differs from the projected selection" })
  }
  const selectedRows = value.capabilities.filter((entry) => entry.selected)
  if (value.selection.status === "selected") {
    if (selectedRows.length !== 1 || selectedRows[0]?.adapterId !== value.selection.adapterId ||
        selectedRows[0]?.agentId !== value.selection.agentId) {
      context.addIssue({ code: "custom", path: ["capabilities"], message: "Selected capability row must match the exact selection" })
    }
    const current = selectedRows[0]?.capabilityDigest === value.selection.capabilityDigest
    if (current !== (value.selection.capabilityState === "current")) {
      context.addIssue({ code: "custom", path: ["selection", "capabilityState"], message: "Selection capability state must reflect the observed digest" })
    }
  } else if (selectedRows.length !== 0) {
    context.addIssue({ code: "custom", path: ["capabilities"], message: "Only a current selected state can mark a capability selected" })
  }
  const shouldRequireAttention = shouldBeTruncated || ["stale", "migration-required", "invalid"].includes(value.freshness.selectionCapabilityState)
  if ((value.freshness.state === "attention-required") !== shouldRequireAttention) {
    context.addIssue({ code: "custom", path: ["freshness", "state"], message: "Freshness must expose selection drift and bounded omissions" })
  }
  if (Date.parse(value.freshness.oldestCapabilityObservedAt) > Date.parse(value.freshness.newestCapabilityObservedAt) ||
      Date.parse(value.freshness.newestCapabilityObservedAt) > Date.parse(value.observedAt)) {
    context.addIssue({ code: "custom", path: ["freshness"], message: "Capability observation range is invalid" })
  }
  const runIds = new Set(value.runs.map((entry) => entry.record.recordId))
  for (const [index, handoff] of value.handoffs.entries()) {
    if (!runIds.has(handoff.fromRun.recordId) && value.limits.runs.omitted === 0) {
      context.addIssue({ code: "custom", path: ["handoffs", index, "fromRun"], message: "Handoff source Run is absent from a complete Run projection" })
    }
  }
}

export const agentModelDashboardContentSchema = z.object(agentModelDashboardFields)
  .strict()
  .superRefine(validateAgentModelDashboard)

export const agentModelDashboardSchema = z.object({
  ...agentModelDashboardFields,
  snapshotDigest: digestSchema,
}).strict().superRefine(validateAgentModelDashboard)

export type DeliveryPhaseId = z.infer<typeof deliveryPhaseIdSchema>
export type PhaseDashboardId = z.infer<typeof phaseDashboardIdSchema>
export type DashboardApplicability = z.infer<typeof dashboardApplicabilitySchema>
export type PhaseDashboardPanel = z.infer<typeof phaseDashboardPanelSchema>
export type PhaseDashboardFrameworkContent = z.infer<typeof phaseDashboardFrameworkContentSchema>
export type PhaseDashboardFramework = z.infer<typeof phaseDashboardFrameworkSchema>
export type PhaseDashboardCompositionRequest = z.infer<typeof phaseDashboardCompositionRequestSchema>
export type ChangeImpactDashboardRequest = z.infer<typeof changeImpactDashboardRequestSchema>
export type ChangeImpactChangeCatalogRequest = z.infer<typeof changeImpactChangeCatalogRequestSchema>
export type ChangeImpactChangeCatalogContent = z.infer<typeof changeImpactChangeCatalogContentSchema>
export type ChangeImpactChangeCatalog = z.infer<typeof changeImpactChangeCatalogSchema>
export type ChangeImpactDashboardContent = z.infer<typeof changeImpactDashboardContentSchema>
export type ChangeImpactDashboard = z.infer<typeof changeImpactDashboardSchema>
export type AgentModelDashboardRequest = z.infer<typeof agentModelDashboardRequestSchema>
export type AgentModelDashboardContent = z.infer<typeof agentModelDashboardContentSchema>
export type AgentModelDashboard = z.infer<typeof agentModelDashboardSchema>
