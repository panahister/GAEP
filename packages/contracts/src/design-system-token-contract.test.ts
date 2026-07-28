import { describe, expect, it } from "vitest"

import {
  designSystemTokenContractInputSchema,
  designSystemTokenContractProjectionSchema,
  designSystemTokenContractSchema,
  designSystemTokenContractStatusSchema,
  type DesignSystemTokenContractInput,
} from "./design-system-token-contract.js"

const productId = "11111111-1111-4111-8111-111111111111"
const initiativeId = "22222222-2222-4222-8222-222222222222"
const candidateId = "33333333-3333-4333-8333-333333333333"
const applicabilityId = "44444444-4444-4444-8444-444444444444"
const inventoryId = "55555555-5555-4555-8555-555555555555"
const requirementsId = "66666666-6666-4666-8666-666666666666"
const bundleId = "77777777-7777-4777-8777-777777777777"
const sourceId = "88888888-8888-4888-8888-888888888888"
const observedAt = "2026-07-28T12:30:00.000Z"
const reviewer = { kind: "human" as const, id: "design-system-reviewer" }
const owner = { state: "assigned-candidate" as const, owner: { kind: "role" as const, id: "product-designer" } }

function digest(value: string) {
  return `sha256:${value.repeat(64)}`
}

function source() {
  return { sourceId, sourceRevision: 1, recordDigest: digest("a"), contentDigest: digest("b") }
}

function input(): DesignSystemTokenContractInput {
  return {
    initiativeId,
    context: {
      productRevision: 4,
      productDigest: digest("c"),
      initiativeRevision: 7,
      initiativeDigest: digest("d"),
    },
    informationClassification: "internal",
    title: "Customer portal Design System and Token Contract candidate",
    designApplicability: { recordId: applicabilityId, revision: 2, digest: digest("e"), membershipDigest: digest("f") },
    screenStateInventory: { recordId: inventoryId, revision: 3, digest: digest("1"), membershipDigest: digest("2") },
    designRequirements: { recordId: requirementsId, revision: 1, digest: digest("3"), membershipDigest: digest("4") },
    portableDesignSnapshot: {
      bundleId,
      snapshotDigest: digest("5"),
      evidenceDigest: digest("6"),
      sourceReviewStatus: "reviewed",
    },
    designSystems: [{
      key: "customer-portal",
      name: "Customer Portal System",
      disposition: "reuse-approved",
      approvedReference: { scopeKind: "client-application", scopeId: "customer-portal", name: "Customer Portal System" },
      ownership: owner,
      sources: [source()],
      limitations: ["Ownership is a candidate assignment and design approval remains not established"],
    }],
    tokens: [{
      path: "color.action.primary",
      designSystemKey: "customer-portal",
      origin: "imported-snapshot",
      type: "color",
      valueDigest: digest("7"),
      importedToken: { artifactId: "portal-tokens", path: "color.action.primary", type: "color", valueDigest: digest("7") },
      ownership: owner,
      requirementKeys: ["DESIGN-REVIEW-01"],
      platformKeys: ["responsive-web"],
      screenKeys: ["release-review"],
      accessibilityImpact: "human-reviewed",
      reviewedBy: reviewer,
      reviewedAt: observedAt,
      sources: [source()],
    }],
    variableCollections: [{
      key: "portal-theme",
      designSystemKey: "customer-portal",
      ownership: owner,
      variableKeys: ["action-primary"],
      platformKeys: ["responsive-web"],
      sources: [source()],
    }],
    variables: [{
      key: "action-primary",
      collectionKey: "portal-theme",
      designSystemKey: "customer-portal",
      state: "bound-to-token",
      tokenPath: "color.action.primary",
      ownership: owner,
      requirementKeys: ["DESIGN-REVIEW-01"],
      sources: [source()],
    }],
    components: [{
      key: "release-review-card",
      designSystemKey: "customer-portal",
      disposition: "imported-snapshot",
      importedComponent: { artifactId: "release-review-card", digest: digest("8") },
      ownership: owner,
      tokenPaths: ["color.action.primary"],
      variableKeys: ["action-primary"],
      requirementKeys: ["DESIGN-REVIEW-01"],
      platformKeys: ["responsive-web"],
      screenKeys: ["release-review"],
      stateKeys: ["review-default"],
      variantKeys: ["review-wide"],
      accessibilityEvidenceState: "human-reviewed",
      reviewedBy: reviewer,
      reviewedAt: observedAt,
      sources: [source()],
    }],
    requirementCoverage: [{
      requirementKey: "DESIGN-REVIEW-01",
      state: "represented",
      tokenPaths: ["color.action.primary"],
      variableKeys: ["action-primary"],
      componentKeys: ["release-review-card"],
      rationale: "The exact token, variable, and component candidate links represent the governed design requirement.",
      sources: [source()],
    }],
    catalogCompletenessState: "candidate-complete",
    unresolvedQuestions: [],
    limitations: ["Design-system, token, variable, component, ownership, accessibility, approval, baseline, readiness, and implementation validity remain not established"],
    reviewState: "ready-for-human-review",
    designSystemValidityState: "not-established",
    ownershipAuthorityState: "not-established",
    designApprovalState: "not-established",
    designBaselineState: "not-established",
    readinessState: "not-established",
    implementationAuthorityState: "not-established",
  }
}

describe("Design System and Token Contract", () => {
  it("accepts exact system, token, variable, component, requirement, ownership, and imported-snapshot metadata without authority", () => {
    expect(designSystemTokenContractInputSchema.safeParse(input()).success).toBe(true)
  })

  it("rejects orphan variables, components, requirement coverage, and implicit approved-system reuse", () => {
    const orphanVariable = structuredClone(input())
    orphanVariable.variables[0]!.tokenPath = "color.missing"
    expect(designSystemTokenContractInputSchema.safeParse(orphanVariable).success).toBe(false)

    const orphanComponent = structuredClone(input())
    orphanComponent.components[0]!.variableKeys = ["missing-variable"]
    expect(designSystemTokenContractInputSchema.safeParse(orphanComponent).success).toBe(false)

    const orphanCoverage = structuredClone(input())
    orphanCoverage.requirementCoverage[0]!.componentKeys = ["missing-component"]
    expect(designSystemTokenContractInputSchema.safeParse(orphanCoverage).success).toBe(false)

    const implicitApproval = structuredClone(input())
    delete implicitApproval.designSystems[0]!.approvedReference
    expect(designSystemTokenContractInputSchema.safeParse(implicitApproval).success).toBe(false)
  })

  it("rejects unresolved review-ready catalogs and secret-shaped portable content", () => {
    const unresolved = structuredClone(input())
    unresolved.tokens[0]!.accessibilityImpact = "not-assessed"
    delete unresolved.tokens[0]!.reviewedBy
    delete unresolved.tokens[0]!.reviewedAt
    expect(designSystemTokenContractInputSchema.safeParse(unresolved).success).toBe(false)

    const secret = structuredClone(input())
    secret.designSystems[0]!.limitations = ["Use API_KEY=123456789012345678901234567890 to read the design library"]
    expect(designSystemTokenContractInputSchema.safeParse(secret).success).toBe(false)
  })

  it("preserves immutable history plus observational, privacy-safe, no-authority status and projection contracts", () => {
    const candidate = {
      ...input(),
      schemaVersion: 1 as const,
      kind: "design-system-token-contract-candidate" as const,
      id: candidateId,
      productId,
      revision: 1,
      membershipDigest: digest("9"),
      state: "candidate" as const,
      createdBy: reviewer,
      updatedBy: reviewer,
      createdAt: observedAt,
      updatedAt: observedAt,
      authorityBoundary: "design-system-token-contract-is-candidate-metadata-and-does-not-establish-design-system-token-variable-or-component-validity-ownership-authority-accessibility-design-approval-baseline-readiness-implementation-or-action-authority" as const,
    }
    expect(designSystemTokenContractSchema.safeParse(candidate).success).toBe(true)
    expect(designSystemTokenContractSchema.safeParse({ ...candidate, revision: 2 }).success).toBe(false)

    const status = {
      schemaVersion: 1 as const,
      kind: "design-system-token-contract-status" as const,
      productId,
      productRevision: 4,
      initiativeId,
      initiativeRevision: 7,
      candidate: { recordId: candidateId, revision: 1, digest: digest("0") },
      designSystemCount: 1,
      tokenCount: 1,
      variableCollectionCount: 1,
      variableCount: 1,
      componentCount: 1,
      representedRequirementCount: 1,
      unresolvedRequirementCount: 0,
      unresolvedOwnershipCount: 0,
      unresolvedCatalogItemCount: 0,
      accessibilityReviewGapCount: 0,
      staleBindingCount: 0,
      stalePortableSnapshotCount: 0,
      staleSourceReferenceCount: 0,
      unresolvedQuestionCount: 0,
      catalogCompletenessState: "candidate-complete" as const,
      reviewState: "ready-for-human-review" as const,
      state: "complete-for-review" as const,
      reasons: [],
      assessedAt: observedAt,
      authorityBoundary: "design-system-token-contract-status-is-observational-and-does-not-establish-design-system-token-variable-or-component-validity-ownership-authority-accessibility-design-approval-baseline-readiness-implementation-or-action-authority" as const,
    }
    expect(designSystemTokenContractStatusSchema.safeParse(status).success).toBe(true)

    const projection = {
      schemaVersion: 1 as const,
      kind: "design-system-token-contract-projection" as const,
      product: { id: productId, revision: 4, digest: digest("1") },
      initiative: { id: initiativeId, revision: 7, digest: digest("2"), state: "active" as const },
      status,
      candidate: {
        id: candidateId,
        revision: 1,
        digest: digest("0"),
        membershipDigest: digest("9"),
        state: "candidate" as const,
        designSystemCount: 1,
        tokenCount: 1,
        variableCollectionCount: 1,
        variableCount: 1,
        componentCount: 1,
        representedRequirementCount: 1,
        reviewState: "ready-for-human-review" as const,
        updatedAt: observedAt,
      },
      observedAt,
      privacyBoundary: "projection-contains-record-identities-counts-statuses-and-digests-only-not-token-values-component-content-requirement-source-design-or-personal-content-secrets-or-credentials" as const,
      authorityBoundary: "design-system-token-contract-projection-is-read-only-and-does-not-establish-design-system-token-variable-or-component-validity-ownership-authority-accessibility-design-approval-baseline-readiness-implementation-write-or-action-authority" as const,
      snapshotDigest: digest("3"),
    }
    expect(designSystemTokenContractProjectionSchema.safeParse(projection).success).toBe(true)
    expect(JSON.stringify(projection)).not.toContain("color.action.primary")
    expect(projection.authorityBoundary).toContain("does-not-establish")
  })
})
