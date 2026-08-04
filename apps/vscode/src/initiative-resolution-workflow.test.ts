import { describe, expect, it } from "vitest"

import type { InitiativeApplicabilityChatState } from "./interactive-initiative-applicability-chat.js"
import type { InitiativeClassificationChatState } from "./interactive-initiative-classification-chat.js"
import type { InitiativeApplicabilityMatrixInput, InitiativeClassificationInput } from "@gaep/contracts"
import {
  canSafelyRebindInitiativeClassification,
  initiativeApplicabilityAttentionItems,
  initiativeClassificationAttentionItems,
  latestInitiativeResolutionState,
} from "./initiative-resolution-workflow.js"

const classification = {
  kind: "gaep-initiative-classification-chat-state",
  phase: "review",
} as InitiativeClassificationChatState

const applicability = {
  kind: "gaep-initiative-applicability-chat-state",
  phase: "awaiting-approval",
} as InitiativeApplicabilityChatState

describe("Initiative resolution workflow ownership", () => {
  it("gives shared chat commands to the most recently opened workflow", () => {
    expect(latestInitiativeResolutionState([applicability, classification])).toBe(classification)
    expect(latestInitiativeResolutionState([classification, applicability])).toBe(applicability)
  })

  it("does not reactivate an older unfinished workflow after the newer one commits", () => {
    const committedClassification = { ...classification, phase: "committed" as const }
    expect(latestInitiativeResolutionState([applicability, committedClassification])).toBe(committedClassification)
  })

  it("allows a revision-only rebind but rejects changed classification inputs", () => {
    const state = {
      ...classification,
      initiativeId: "initiative-1",
      initiative: {
        title: "Schedule planning MVP",
        outcome: "Produce an accepted pre-implementation package",
        scope: ["Discovery"],
        exclusions: ["Production implementation"],
      },
      currentClassification: { primaryType: "feature" },
    } as InitiativeClassificationChatState
    const current = {
      id: "initiative-1",
      title: state.initiative.title,
      outcome: state.initiative.outcome,
      scope: [...state.initiative.scope],
      exclusions: [...state.initiative.exclusions],
      classification: state.currentClassification,
    }

    expect(canSafelyRebindInitiativeClassification(state, current)).toBe(true)
    expect(canSafelyRebindInitiativeClassification(state, {
      ...current,
      title: "Changed Initiative",
    })).toBe(false)
    expect(canSafelyRebindInitiativeClassification(state, {
      ...current,
      classification: undefined,
    })).toBe(false)
  })

  it("reports classification questions and deduplicated applicability attention", () => {
    expect(initiativeClassificationAttentionItems({
      unresolvedQuestions: ["Choose an authority", "Choose an authority"],
    } as InitiativeClassificationInput)).toEqual(["Choose an authority"])

    expect(initiativeApplicabilityAttentionItems({
      decisions: [{
        subject: { type: "approval", key: "architecture", label: "Architecture approval" },
        status: "awaiting-human-decision",
        approval: { state: "pending" },
        accountableApprover: "Architecture Authority",
      }],
      unresolvedSubjects: [{
        subject: { type: "approval", key: "architecture", label: "Architecture approval" },
        reason: "The named authority is not appointed.",
        owner: "Solution Architect",
      }],
    } as InitiativeApplicabilityMatrixInput)).toEqual([
      "Architecture approval — pending human decision (Architecture Authority)",
    ])
  })
})
