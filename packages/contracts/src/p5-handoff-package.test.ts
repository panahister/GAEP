import { describe, expect, it } from "vitest"

import { p0P4ReadinessOutputKinds, p0P4ReadinessRecordKinds } from "./p0-p4-readiness-gate.js"
import {
  p5HandoffPackageInputSchema,
  p5HandoffPackageProjectionSchema,
  p5HandoffPackageSchema,
  p5HandoffPackageStatusSchema,
  p5HandoffRequirementIds,
} from "./p5-handoff-package.js"

const productId = "11111111-1111-4111-8111-111111111111"
const initiativeId = "22222222-2222-4222-8222-222222222222"
const gateId = "33333333-3333-4333-8333-333333333333"
const handoffId = "44444444-4444-4444-8444-444444444444"
const digest = (character: string) => `sha256:${character.repeat(64)}`

function input() {
  const applicable = new Set(["end-to-end-traceability", "evidence-registry", "initiative-entry"])
  return {
    initiativeId,
    context: {
      productRevision: 7,
      productDigest: digest("a"),
      initiativeRevision: 3,
      initiativeDigest: digest("b"),
    },
    informationClassification: "internal" as const,
    title: "Candidate P5 experience-design handoff",
    objective: "Transfer exact governed P0 through P4 candidate context into bounded P5 experience-design review.",
    scope: "Provide the declared P5 audience with exact references, limitations, gaps and next actions for this Initiative revision.",
    readinessGate: { recordId: gateId, revision: 2, digest: digest("c") },
    readinessStatusDigest: digest("d"),
    readinessResult: "incomplete" as const,
    target: {
      phase: "p5-experience-and-figma" as const,
      capability: "experience-design" as const,
      audience: { kind: "role" as const, id: "experience-designer" },
      deliveryMode: "disconnected" as const,
    },
    items: p0P4ReadinessOutputKinds.map((outputKind, index) => {
      const isApplicable = applicable.has(outputKind)
      return {
        outputKind,
        applicability: isApplicable ? "applicable" as const : "not-applicable-candidate" as const,
        subjects: isApplicable ? [{
          recordKind: p0P4ReadinessRecordKinds[outputKind],
          recordId: `${String(index + 1).padStart(8, "0")}-0000-4000-8000-000000000001`,
          revision: 1,
          digest: digest("e"),
        }] : [],
        disposition: isApplicable ? "reference-only" as const : "omitted-not-applicable" as const,
        representation: isApplicable ? "exact-reference" as const : "omitted" as const,
        semanticRelationship: isApplicable ? "exact" as const : "not-applicable" as const,
        freshness: isApplicable ? "current" as const : "unknown" as const,
        consumerPurpose: isApplicable
          ? "Provide the exact governed candidate reference needed for bounded P5 context assembly."
          : "Preserve the explicit candidate not-applicable disposition without inventing P5 context.",
        selectionRationale: isApplicable
          ? "The exact readiness evaluation declares this output applicable to the Initiative."
          : "The exact readiness evaluation declares this output candidate not applicable.",
        materialOmissions: [],
        uncertainties: isApplicable ? ["Substantive P5 interpretation remains pending human review"] : [],
        limitations: ["The handoff item grants no approval, ownership transfer, readiness or action authority"],
        sources: [],
        authorityBoundary: "handoff-item-transfers-candidate-context-only-and-does-not-transfer-source-ownership-approve-content-establish-readiness-or-authorize-action" as const,
      }
    }),
    requirementCoverage: p5HandoffRequirementIds.map((requirementId) => ({
      requirementId,
      state: "unresolved" as const,
      itemKinds: [],
      basis: "The requirement remains explicit until exact evidence and accountable P5 review are completed.",
      sources: [],
    })),
    assumptions: ["The declared P5 audience can resolve the exact repository-governed references"],
    unresolvedQuestions: ["Who will acknowledge receipt for the exact P5 audience?"],
    conflicts: [],
    limitations: ["No acknowledgement, design approval, P5 entry, transfer authority or action authority is established"],
    nextActions: ["Assign an accountable human reviewer before any P5 phase-entry decision"],
    transferState: "held" as const,
    acknowledgementState: "not-established" as const,
    sourceOwnershipState: "retained" as const,
    transferAuthorityState: "not-established" as const,
    p5EntryAuthorityState: "not-established" as const,
  }
}

function status() {
  return {
    schemaVersion: 1 as const,
    kind: "p5-handoff-package-status" as const,
    productId,
    productRevision: 7,
    initiativeId,
    initiativeRevision: 3,
    handoff: { recordId: handoffId, revision: 1, digest: digest("f") },
    itemCount: 25,
    includedItemCount: 0,
    referenceOnlyItemCount: 3,
    omittedNotApplicableItemCount: 22,
    unresolvedItemCount: 0,
    staleOrUnknownItemCount: 0,
    lossyTransformationCount: 0,
    unresolvedRequirementCount: p5HandoffRequirementIds.length,
    conflictCount: 0,
    unresolvedQuestionCount: 1,
    staleBindingCount: 0,
    staleSourceReferenceCount: 0,
    readinessResult: "incomplete" as const,
    transferState: "held" as const,
    state: "attention-required" as const,
    reasons: ["The captured readiness evaluation is not passed"],
    assessedAt: "2026-07-27T10:00:00.000Z",
    handoffBoundary: "handoff-transfers-exact-candidate-context-not-source-ownership-or-authority" as const,
    authorityBoundary: "p5-handoff-package-status-does-not-establish-acknowledgement-readiness-approval-design-baseline-p5-entry-transfer-or-action-authority" as const,
  }
}

describe("P5 Handoff Package contract", () => {
  it("accepts a complete exact candidate catalog without transferring ownership or authority", () => {
    const parsed = p5HandoffPackageInputSchema.parse(input())
    expect(parsed.items).toHaveLength(25)
    expect(parsed.requirementCoverage).toHaveLength(p5HandoffRequirementIds.length)
    expect(parsed.sourceOwnershipState).toBe("retained")
    expect(parsed.p5EntryAuthorityState).toBe("not-established")
  })

  it("rejects incomplete catalogs, applicability drift, lossy summaries without omissions, and premature review readiness", () => {
    const missing: any = structuredClone(input())
    missing.items.pop()
    expect(p5HandoffPackageInputSchema.safeParse(missing).success).toBe(false)

    const drift: any = structuredClone(input())
    const initiative = drift.items.find((entry: any) => entry.outputKind === "initiative-entry")
    initiative.applicability = "unresolved"
    expect(p5HandoffPackageInputSchema.safeParse(drift).success).toBe(false)

    const lossy: any = structuredClone(input())
    const traceability = lossy.items.find((entry: any) => entry.outputKind === "end-to-end-traceability")
    traceability.disposition = "included"
    traceability.representation = "bounded-summary"
    traceability.semanticRelationship = "lossy"
    expect(p5HandoffPackageInputSchema.safeParse(lossy).success).toBe(false)

    const premature: any = structuredClone(input())
    premature.transferState = "ready-for-human-review"
    expect(p5HandoffPackageInputSchema.safeParse(premature).success).toBe(false)
  })

  it("rejects secret-shaped content and invalid immutable revision ancestry", () => {
    const secret: any = structuredClone(input())
    secret.limitations = ["Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456"]
    expect(p5HandoffPackageInputSchema.safeParse(secret).success).toBe(false)

    const record = {
      ...input(), schemaVersion: 1 as const, kind: "p5-handoff-package-candidate" as const,
      id: handoffId, productId, revision: 2, membershipDigest: digest("7"), state: "candidate" as const,
      createdBy: { kind: "human" as const, id: "product-owner" },
      updatedBy: { kind: "human" as const, id: "product-owner" },
      createdAt: "2026-07-27T10:00:00.000Z", updatedAt: "2026-07-27T10:00:00.000Z",
      authorityBoundary: "p5-handoff-package-is-candidate-context-and-does-not-transfer-source-ownership-establish-acknowledgement-approve-design-authorize-p5-entry-or-authorize-action" as const,
    }
    expect(p5HandoffPackageSchema.safeParse(record).success).toBe(false)
  })

  it("rejects forged status arithmetic and projection context", () => {
    const invalid = structuredClone(status())
    invalid.omittedNotApplicableItemCount = 21
    expect(p5HandoffPackageStatusSchema.safeParse(invalid).success).toBe(false)

    const projection = {
      schemaVersion: 1 as const,
      kind: "p5-handoff-package-projection" as const,
      product: { id: productId, revision: 7, digest: digest("a") },
      initiative: { id: initiativeId, revision: 3, digest: digest("b"), state: "active" as const },
      status: status(),
      handoff: {
        id: handoffId, revision: 1, digest: digest("f"), membershipDigest: digest("7"), state: "candidate" as const,
        readinessStatusDigest: digest("d"), itemCount: 25, requirementCount: p5HandoffRequirementIds.length,
        deliveryMode: "disconnected" as const, updatedAt: "2026-07-27T10:00:00.000Z",
      },
      observedAt: "2026-07-27T10:00:00.000Z",
      privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-item-content-summaries-omissions-uncertainties-source-content-personal-data-secrets-credentials-or-destinations" as const,
      authorityBoundary: "p5-handoff-package-projection-does-not-establish-acknowledgement-readiness-approval-design-baseline-p5-entry-transfer-write-or-action-authority" as const,
      snapshotDigest: digest("8"),
    }
    expect(p5HandoffPackageProjectionSchema.safeParse(projection).success).toBe(true)
    projection.initiative.revision = 4
    expect(p5HandoffPackageProjectionSchema.safeParse(projection).success).toBe(false)
  })
})
