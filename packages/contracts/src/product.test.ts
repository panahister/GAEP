import { describe, expect, it } from "vitest"

import {
  initiativeApplicabilityDecisionInputSchema,
  initiativeApplicabilityMatrixInputSchema,
  initiativeClassificationInputSchema,
} from "./product.js"

export const classificationInput = {
  primaryType: "service",
  secondaryTypes: ["api", "modernization"],
  systemState: "brownfield",
  changePosture: "modernization",
  motivations: ["business-driven", "technical"],
  characteristics: {
    userInterface: "non-ui",
    data: "data-bearing",
    integration: "integration-heavy",
    interactionModes: ["synchronous", "asynchronous"],
    exposure: "partner",
  },
  regulated: true,
  policyDomains: ["payments", "privacy"],
  sensitivities: ["security", "privacy", "data"],
  expectedLifetime: "long-lived",
  maintenanceHorizon: "Supported for at least five years after initial release",
  risk: {
    blastRadius: "multi-unit",
    reversibility: "partially-reversible",
    urgency: "high",
    costOfFailure: "high",
  },
  dependencies: ["Existing identity service", "Partner API consumers"],
  affectedAssets: ["Payments API", "Settlement worker"],
  owner: "Payments engineering owner",
  accountableAuthority: "Payments Product Owner",
  confidence: { level: "medium", basis: "Repository evidence is current but partner scope awaits confirmation" },
  evidence: [{ kind: "evidence", reference: "GAEP-EVD-001" }],
  unresolvedQuestions: ["Whether the legacy batch endpoint remains in scope"],
  rationale: "The initiative changes a brownfield service and its independently deployed API consumers.",
} as const

export const applicabilityDecisionInput = {
  subject: { type: "test-level", key: "consumer-contract-testing", label: "Consumer contract testing" },
  status: "required",
  rationale: "Independently deployed partner consumers require version-bound compatibility evidence.",
  sources: [{ kind: "policy", reference: "GAEP-POL-CONTRACT-001" }],
  owner: "Payments quality owner",
  accountableApprover: "Payments Product Owner",
  dependencies: ["partner-api-contract"],
  conditions: [],
  reviewTriggers: ["API contract or consumer inventory changes"],
  approval: { state: "pending", conditions: [] },
  relatedRecords: [],
  relatedImplementationUnits: ["payments-api"],
} as const

describe("Initiative classification and applicability contracts", () => {
  it("accepts a multi-dimensional classification and rejects contradictory lists", () => {
    expect(initiativeClassificationInputSchema.parse(classificationInput)).toEqual(classificationInput)
    expect(initiativeClassificationInputSchema.safeParse({
      ...classificationInput,
      secondaryTypes: [classificationInput.primaryType],
    }).success).toBe(false)
    expect(initiativeClassificationInputSchema.safeParse({
      ...classificationInput,
      sensitivities: ["none", "security"],
    }).success).toBe(false)
  })

  it("requires explicit sources, conditions, approval truth, and satisfaction evidence", () => {
    expect(initiativeApplicabilityDecisionInputSchema.parse(applicabilityDecisionInput)).toEqual(applicabilityDecisionInput)
    expect(initiativeApplicabilityDecisionInputSchema.safeParse({
      ...applicabilityDecisionInput,
      status: "conditionally-required",
      conditions: [],
    }).success).toBe(false)
    expect(initiativeApplicabilityDecisionInputSchema.safeParse({
      ...applicabilityDecisionInput,
      status: "reused",
      relatedRecords: [],
    }).success).toBe(false)
    expect(initiativeApplicabilityDecisionInputSchema.safeParse({
      ...applicabilityDecisionInput,
      status: "awaiting-human-decision",
      approval: { state: "not-required", conditions: [] },
    }).success).toBe(false)
  })

  it("keeps decided and unresolved subjects disjoint so absence never means not applicable", () => {
    expect(initiativeApplicabilityMatrixInputSchema.parse({
      decisions: [applicabilityDecisionInput],
      unresolvedSubjects: [{
        subject: { type: "activity", key: "figma", label: "Figma design workflow" },
        reason: "User-interface applicability remains unresolved",
        owner: "Product design owner",
      }],
    })).toBeDefined()
    expect(initiativeApplicabilityMatrixInputSchema.safeParse({
      decisions: [applicabilityDecisionInput],
      unresolvedSubjects: [{
        subject: applicabilityDecisionInput.subject,
        reason: "This subject cannot also be unresolved",
        owner: "Payments quality owner",
      }],
    }).success).toBe(false)
  })
})
