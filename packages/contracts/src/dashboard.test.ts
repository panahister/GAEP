import { describe, expect, it } from "vitest"

import {
  deliveryPhaseDefinitions,
  deliveryPhaseIds,
  phaseDashboardDefinitions,
  phaseDashboardFrameworkSchema,
  type DeliveryPhaseId,
} from "./index.js"

const digest = `sha256:${"a".repeat(64)}`
const productId = "00000000-0000-4000-8000-000000000001"

function framework(phaseId: DeliveryPhaseId): Record<string, unknown> {
  const phase = deliveryPhaseDefinitions[phaseId]
  const primary = phaseDashboardDefinitions[phase.primaryDashboardId]
  return {
    schemaVersion: 1,
    kind: "phase-dashboard-framework",
    catalogVersion: "gaep-phase-dashboards-v1",
    product: { recordType: "product", recordId: productId, revision: 1, digest },
    phase: { id: phaseId, label: phase.label },
    panels: [
      {
        id: phase.primaryDashboardId,
        role: primary.role,
        title: primary.title,
        applicability: { status: "unknown", basis: "not-evaluated" },
        state: "attention-required",
      },
      {
        id: "change-impact",
        role: "change-impact",
        title: "Change and impact",
        applicability: { status: "applicable", basis: "phase-contract" },
        state: "active",
      },
      {
        id: "agent-model",
        role: "agent-model",
        title: "Agent and model",
        applicability: { status: "applicable", basis: "phase-contract" },
        state: "active",
      },
    ],
    evidenceCues: {
      freshness: "current",
      confidence: { state: "not-assessed", basis: "no-governed-confidence-evaluation-is-bound" },
    },
    observedAt: "2026-07-24T00:00:00.000Z",
    sourceBoundary: "governed-repository-and-engine-only",
    limitations: ["This projection grants no phase or readiness authority."],
    authorityBoundary: "dashboard-is-a-projection-not-phase-approval-readiness-or-applicability-evidence",
    compositionDigest: digest,
  }
}

describe("phase dashboard contracts", () => {
  it.each(deliveryPhaseIds)("accepts the canonical bounded panel order for %s", (phaseId) => {
    const parsed = phaseDashboardFrameworkSchema.parse(framework(phaseId))
    expect(parsed.panels).toHaveLength(3)
    expect(parsed.panels.map((panel) => panel.role)).toEqual(["phase", "change-impact", "agent-model"])
  })

  it("rejects extra caller fields and catalog drift", () => {
    expect(phaseDashboardFrameworkSchema.safeParse({ ...framework(deliveryPhaseIds[0]), ready: true }).success).toBe(false)

    const wrongLabel = structuredClone(framework(deliveryPhaseIds[0])) as {
      phase: { label: string }
    }
    wrongLabel.phase.label = "Caller supplied phase"
    expect(phaseDashboardFrameworkSchema.safeParse(wrongLabel).success).toBe(false)

    const wrongOrder = structuredClone(framework(deliveryPhaseIds[0])) as {
      panels: unknown[]
    }
    wrongOrder.panels.reverse()
    expect(phaseDashboardFrameworkSchema.safeParse(wrongOrder).success).toBe(false)

    const forgedEvidenceCue = structuredClone(framework(deliveryPhaseIds[0])) as {
      evidenceCues: { freshness: string }
    }
    forgedEvidenceCue.evidenceCues.freshness = "unknown"
    expect(phaseDashboardFrameworkSchema.safeParse(forgedEvidenceCue).success).toBe(false)
  })

  it("keeps applicability, evidence basis, and presentation state consistent", () => {
    const forged = structuredClone(framework(deliveryPhaseIds[0])) as {
      panels: Array<{ applicability: Record<string, unknown>; state: string }>
    }
    forged.panels[0]!.applicability = { status: "applicable", basis: "not-evaluated" }
    forged.panels[0]!.state = "active"
    expect(phaseDashboardFrameworkSchema.safeParse(forged).success).toBe(false)

    const unboundDecision = structuredClone(framework(deliveryPhaseIds[0])) as {
      panels: Array<{ applicability: Record<string, unknown>; state: string }>
    }
    unboundDecision.panels[0]!.applicability = { status: "not-applicable", basis: "governed-decision" }
    unboundDecision.panels[0]!.state = "not-applicable"
    expect(phaseDashboardFrameworkSchema.safeParse(unboundDecision).success).toBe(false)
  })
})
