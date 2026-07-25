import { randomUUID } from "node:crypto"

import {
  initiativeApplicabilityMatrixSchema,
  initiativeClassificationSchema,
  initiativeApplicabilitySubjectDefinitions,
  productSchema,
  type InitiativeApplicabilitySubject,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { describe, expect, it } from "vitest"

import {
  assessInitiativeApplicabilityCoverage,
  assessInitiativeClassificationCompleteness,
  composeInitiativeApplicabilitySubjectCatalog,
  composeInitiativeClassificationCompletenessPolicy,
} from "./initiative-entry.js"

function fixtures() {
  const product = productSchema.parse({
    schemaVersion: 1,
    id: randomUUID(),
    kind: "product",
    revision: 1,
    name: "Atlas",
    summary: "A governed Product workspace.",
    problem: "Initiative entry evidence can be incomplete or stale.",
    affectedUsers: "Product engineering teams",
    desiredOutcome: "Every Initiative entry decision binds exact governed evidence.",
    successSignals: ["Incomplete entry evidence fails closed"],
    firstWorkflow: "Classify the Initiative and resolve canonical applicability subjects.",
    exclusions: [],
    profile: "software",
    lifecycleState: "active",
    createdAt: "2026-07-25T00:00:00.000Z",
    updatedAt: "2026-07-25T00:00:00.000Z",
  })
  const classification = initiativeClassificationSchema.parse({
    primaryType: "service",
    secondaryTypes: ["api"],
    systemState: "brownfield",
    changePosture: "modernization",
    motivations: ["technical"],
    characteristics: {
      userInterface: "non-ui",
      data: "data-bearing",
      integration: "integration-heavy",
      interactionModes: ["synchronous"],
      exposure: "partner",
    },
    regulated: true,
    policyDomains: ["payments"],
    sensitivities: ["security", "data"],
    expectedLifetime: "long-lived",
    maintenanceHorizon: "Supported for five years after release",
    risk: {
      blastRadius: "multi-unit",
      reversibility: "partially-reversible",
      urgency: "high",
      costOfFailure: "high",
    },
    dependencies: ["Identity service"],
    affectedAssets: ["Payments API"],
    owner: "Payments engineering owner",
    accountableAuthority: "Payments Product Owner",
    confidence: { level: "high", basis: "Current repository and owner evidence agree" },
    evidence: [{ kind: "evidence", reference: "GAEP-EVD-ENTRY-001" }],
    unresolvedQuestions: [],
    rationale: "The Initiative changes a brownfield service with independently deployed consumers.",
    productProfile: product.profile,
    productRevision: product.revision,
    productDigest: canonicalDigest(product),
    classifiedBy: { kind: "human", id: "founder" },
    classifiedAt: "2026-07-25T00:01:00.000Z",
    authorityBoundary: "classification-guides-profile-selection-and-does-not-grant-approval-or-action-authority",
  })
  return { product, classification }
}

function unresolved(subject: InitiativeApplicabilitySubject) {
  return {
    subject,
    reason: "The accountable owner must resolve this canonical subject before Initiative entry",
    owner: "Initiative owner",
  }
}

describe("Initiative entry policy and catalog evaluation", () => {
  it("binds the completeness policy and subject catalog to exact Product and classification state", () => {
    const { product, classification } = fixtures()
    const policy = composeInitiativeClassificationCompletenessPolicy(product)
    const catalog = composeInitiativeApplicabilitySubjectCatalog(product, classification)

    expect(policy).toMatchObject({
      productId: product.id,
      productRevision: product.revision,
      productDigest: canonicalDigest(product),
      requiredDimensions: expect.arrayContaining(["primary-type", "unresolved-questions"]),
    })
    expect(catalog).toMatchObject({
      productId: product.id,
      classificationDigest: canonicalDigest(classification),
      subjects: initiativeApplicabilitySubjectDefinitions,
    })
    expect(canonicalDigest(composeInitiativeClassificationCompletenessPolicy({
      ...product,
      revision: 2,
      updatedAt: "2026-07-25T00:02:00.000Z",
    }))).not.toBe(canonicalDigest(policy))
  })

  it("treats unknowns, unresolved questions, low confidence, and missing regulated domains as incomplete", () => {
    const { product, classification } = fixtures()
    expect(assessInitiativeClassificationCompleteness(product, classification)).toMatchObject({
      status: "complete",
      unknownDimensions: [],
      unresolvedQuestionCount: 0,
      missingConditionalDimensions: [],
      confidenceSufficient: true,
    })

    const incomplete = initiativeClassificationSchema.parse({
      ...classification,
      systemState: "unknown",
      policyDomains: [],
      confidence: { level: "low", basis: "Only an unverified intake statement is available" },
      unresolvedQuestions: ["Whether partner consumers remain in scope"],
    })
    expect(assessInitiativeClassificationCompleteness(product, incomplete)).toMatchObject({
      status: "incomplete",
      unknownDimensions: ["system-state"],
      unresolvedQuestionCount: 1,
      missingConditionalDimensions: ["regulated-policy-domain"],
      confidenceSufficient: false,
    })
    expect(assessInitiativeClassificationCompleteness(product)).toMatchObject({ status: "missing" })
  })

  it("requires exact decided-or-unresolved coverage of every canonical subject", () => {
    const { product, classification } = fixtures()
    const catalog = composeInitiativeApplicabilitySubjectCatalog(product, classification)
    const [first, ...remaining] = catalog.subjects
    const matrix = initiativeApplicabilityMatrixSchema.parse({
      schemaVersion: 1,
      kind: "initiative-applicability-matrix",
      revision: 1,
      initiativeId: randomUUID(),
      productId: product.id,
      initiativeRevision: 2,
      classificationDigest: canonicalDigest(classification),
      state: "current",
      decisions: [{
        id: randomUUID(),
        revision: 1,
        initiativeRevision: 2,
        subject: first,
        status: "required",
        rationale: "Initiative intake is a binding prerequisite for governed entry.",
        sources: [{ kind: "policy", reference: "GAEP-DYNAMIC-MODEL-ENTRY" }],
        owner: "Initiative owner",
        dependencies: [],
        conditions: [],
        reviewTriggers: ["Initiative scope or classification changes"],
        approval: { state: "not-required", conditions: [] },
        relatedRecords: [],
        relatedImplementationUnits: [],
        decidedBy: { kind: "human", id: "founder" },
        decidedAt: "2026-07-25T00:03:00.000Z",
        authorityBoundary: "applicability-decision-does-not-grant-approval-readiness-or-action-authority",
      }],
      unresolvedSubjects: remaining.map(unresolved),
      evaluatedBy: { kind: "human", id: "founder" },
      evaluatedAt: "2026-07-25T00:03:00.000Z",
      authorityBoundary: "applicability-matrix-does-not-grant-approval-readiness-or-action-authority",
    })

    expect(assessInitiativeApplicabilityCoverage(product, classification, matrix)).toMatchObject({
      status: "complete",
      coveredSubjectCount: catalog.subjects.length,
      missingSubjects: [],
      unexpectedSubjects: [],
      mismatchedSubjects: [],
    })
    expect(assessInitiativeApplicabilityCoverage(product, classification, {
      ...matrix,
      unresolvedSubjects: matrix.unresolvedSubjects.slice(1),
    })).toMatchObject({ status: "incomplete", coveredSubjectCount: catalog.subjects.length - 1 })
    expect(assessInitiativeApplicabilityCoverage(product, classification)).toMatchObject({
      status: "missing",
      coveredSubjectCount: 0,
      missingSubjects: catalog.subjects,
    })
  })
})
