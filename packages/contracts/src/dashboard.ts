import { z } from "zod"

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

export type DeliveryPhaseId = z.infer<typeof deliveryPhaseIdSchema>
export type PhaseDashboardId = z.infer<typeof phaseDashboardIdSchema>
export type DashboardApplicability = z.infer<typeof dashboardApplicabilitySchema>
export type PhaseDashboardPanel = z.infer<typeof phaseDashboardPanelSchema>
export type PhaseDashboardFrameworkContent = z.infer<typeof phaseDashboardFrameworkContentSchema>
export type PhaseDashboardFramework = z.infer<typeof phaseDashboardFrameworkSchema>
export type PhaseDashboardCompositionRequest = z.infer<typeof phaseDashboardCompositionRequestSchema>
