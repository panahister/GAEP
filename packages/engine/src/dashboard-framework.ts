import { canonicalDigest } from "@gaep/agent-sdk"
import {
  deliveryPhaseDefinitions,
  phaseDashboardCompositionRequestSchema,
  phaseDashboardDefinitions,
  phaseDashboardFrameworkContentSchema,
  phaseDashboardFrameworkSchema,
  productSchema,
  type PhaseDashboardCompositionRequest,
  type PhaseDashboardFramework,
  type PhaseDashboardPanel,
  type Product,
} from "@gaep/contracts"

export class DashboardProductBindingError extends Error {
  constructor() {
    super("The requested dashboard Product binding is not current")
    this.name = "DashboardProductBindingError"
  }
}

function commonPanel(id: "change-impact" | "agent-model"): PhaseDashboardPanel {
  const definition = phaseDashboardDefinitions[id]
  return {
    id,
    role: definition.role,
    title: definition.title,
    applicability: { status: "applicable", basis: "phase-contract" },
    state: "active",
  }
}

export function composePhaseDashboardFramework(
  productValue: Product,
  requestValue: PhaseDashboardCompositionRequest,
  observedAt = new Date().toISOString(),
): PhaseDashboardFramework {
  const product = productSchema.parse(productValue)
  const request = phaseDashboardCompositionRequestSchema.parse(requestValue)
  const actualRevision = product.revision ?? 1
  const actualDigest = canonicalDigest(product)
  if (
    request.expectedProductId.toLowerCase() !== product.id.toLowerCase()
    || request.expectedProductRevision !== actualRevision
    || request.expectedProductDigest !== actualDigest
  ) {
    throw new DashboardProductBindingError()
  }

  const phase = deliveryPhaseDefinitions[request.phase]
  const primary = phaseDashboardDefinitions[phase.primaryDashboardId]
  const content = phaseDashboardFrameworkContentSchema.parse({
    schemaVersion: 1,
    kind: "phase-dashboard-framework",
    catalogVersion: "gaep-phase-dashboards-v1",
    product: {
      recordType: "product",
      recordId: product.id,
      revision: actualRevision,
      digest: actualDigest,
    },
    phase: { id: request.phase, label: phase.label },
    panels: [
      {
        id: phase.primaryDashboardId,
        role: primary.role,
        title: primary.title,
        applicability: { status: "unknown", basis: "not-evaluated" },
        state: "attention-required",
      },
      commonPanel("change-impact"),
      commonPanel("agent-model"),
    ],
    observedAt,
    sourceBoundary: "governed-repository-and-engine-only",
    limitations: [
      "The selected phase scopes presentation only; it does not prove phase entry, completion, acceptance, or release readiness.",
      "The phase dashboard remains attention-required until a governed applicability decision is bound.",
    ],
    authorityBoundary: "dashboard-is-a-projection-not-phase-approval-readiness-or-applicability-evidence",
  })
  return phaseDashboardFrameworkSchema.parse({
    ...content,
    compositionDigest: canonicalDigest(content),
  })
}
