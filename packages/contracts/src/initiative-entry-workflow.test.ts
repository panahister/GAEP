import { describe, expect, it } from "vitest"

import {
  completeInitiativeApplicabilityCoverage,
  collectInitiativeApplicability,
  collectInitiativeClassification,
  InitiativeEntryWorkflowCancelled,
  type InitiativeEntryWorkflowUi,
} from "./initiative-entry-workflow.js"

function classificationUi(confirm = true): InitiativeEntryWorkflowUi {
  return {
    pick: async (title, options) => {
      const preferred = title.includes("Primary Initiative") ? "service"
        : title.includes("regulated") ? "yes"
          : title.includes("System state") ? "brownfield"
            : title.includes("Change posture") ? "modernization"
              : title.includes("User-interface") ? "non-ui"
                : title.includes("Data characteristic") ? "data-bearing"
                  : title.includes("Integration characteristic") ? "integration-heavy"
                    : title.includes("Exposure") ? "partner"
                      : title.includes("Expected lifetime") ? "long-lived"
                        : title.includes("blast radius") ? "multi-unit"
                          : title.includes("reversibility") ? "partially-reversible"
                            : title.includes("urgency") ? "high"
                              : title.includes("cost of failure") ? "high"
                                : title.includes("confidence") ? "medium"
                                  : title.includes("evidence kind") ? "evidence"
                                    : options[0]
      return options.find((candidate) => candidate === preferred) ?? options[0]
    },
    pickMany: async (title, options) => {
      if (title.includes("Secondary")) return options.filter((candidate) => ["api", "modernization"].includes(candidate))
      if (title.includes("Motivations")) return options.filter((candidate) => ["business-driven", "technical"].includes(candidate))
      if (title.includes("Interaction")) return options.filter((candidate) => ["synchronous", "asynchronous"].includes(candidate))
      if (title.includes("Sensitivities")) return options.filter((candidate) => ["security", "privacy"].includes(candidate))
      return []
    },
    input: async (prompt) => {
      if (prompt.includes("Policy domains")) return "payments, privacy"
      if (prompt.includes("Maintenance horizon")) return "Supported for at least five years"
      if (prompt.includes("Dependencies")) return "Identity service"
      if (prompt.includes("Affected assets")) return "Payments API"
      if (prompt.includes("classification owner")) return "Payments engineering owner"
      if (prompt.includes("Accountable human")) return "Payments Product Owner"
      if (prompt.includes("confidence rationale")) return "Repository evidence is current and bounded"
      if (prompt.includes("evidence reference")) return "GAEP-EVD-001"
      if (prompt.includes("Unresolved")) return "Partner consumer scope"
      if (prompt.includes("Classification rationale")) return "This brownfield service changes independently deployed partner APIs."
      return "bounded input"
    },
    confirm: async () => confirm,
  }
}

function applicabilityUi(confirm = true): InitiativeEntryWorkflowUi {
  let decisionOperation = 0
  return {
    pick: async (title, options) => {
      const preferred = title.includes("Add the first") ? "add-decision"
        : title.includes("Add another") ? (++decisionOperation > 0 ? "continue" : "add-decision")
          : title.includes("unresolved") ? "finish"
            : title.includes("subject type") ? "test-method"
              : title.includes("status") && !title.includes("approval") ? "required"
                : title.includes("approval state") ? "pending"
                  : title.includes("source kind") ? "policy"
                    : options[0]
      return options.find((candidate) => candidate === preferred) ?? options[0]
    },
    pickMany: async () => [],
    input: async (prompt) => {
      if (prompt.includes("stable subject key")) return "consumer-contract-testing"
      if (prompt.includes("human-readable")) return "Consumer contract testing"
      if (prompt.includes("conditions")) return ""
      if (prompt.includes("rationale")) return "Partner consumers require compatibility evidence."
      if (prompt.includes("source reference")) return "GAEP-POL-CONTRACT-001"
      if (prompt.endsWith(" owner")) return "Payments quality owner"
      if (prompt.includes("accountable approver")) return "Payments Product Owner"
      if (prompt.includes("dependency keys")) return "partner-api-contract"
      if (prompt.includes("review triggers")) return "API contract changes"
      if (prompt.includes("implementation-unit")) return "payments-api"
      return ""
    },
    confirm: async () => confirm,
  }
}

describe("Initiative entry native workflow inputs", () => {
  it("collects a strict multi-dimensional classification and preserves unresolved truth", async () => {
    const input = await collectInitiativeClassification(classificationUi())
    expect(input).toMatchObject({
      primaryType: "service",
      secondaryTypes: ["api", "modernization"],
      systemState: "brownfield",
      regulated: true,
      policyDomains: ["payments", "privacy"],
      unresolvedQuestions: ["Partner consumer scope"],
    })
  })

  it("collects an explicit applicability matrix without treating absence as not applicable", async () => {
    const input = await collectInitiativeApplicability(
      applicabilityUi(),
      "founder",
      () => "2026-07-25T00:00:00.000Z",
    )
    expect(input).toMatchObject({
      decisions: [{
        subject: { type: "test-method", key: "consumer-contract-testing" },
        status: "required",
        approval: { state: "pending" },
      }],
    })
    expect(input.unresolvedSubjects).toHaveLength(48)
    expect(input.unresolvedSubjects).toContainEqual(expect.objectContaining({
      subject: { type: "approval", key: "release", label: "Release approval" },
      owner: "founder",
    }))
    expect(input.decisions[0]?.status).not.toBe("not-applicable")
    expect(() => completeInitiativeApplicabilityCoverage({
      ...input,
      decisions: [{
        ...input.decisions[0]!,
        subject: { type: "activity", key: "non-canonical-review", label: "Non-canonical review" },
      }],
    }, "founder")).toThrow("does not match the canonical catalog")
  })

  it("is cancel-default at the final human confirmation boundary", async () => {
    await expect(collectInitiativeClassification(classificationUi(false))).rejects.toBeInstanceOf(
      InitiativeEntryWorkflowCancelled,
    )
    await expect(collectInitiativeApplicability(applicabilityUi(false), "founder")).rejects.toBeInstanceOf(
      InitiativeEntryWorkflowCancelled,
    )
  })
})
