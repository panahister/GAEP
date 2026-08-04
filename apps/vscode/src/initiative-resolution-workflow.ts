import type { InitiativeApplicabilityChatState } from "./interactive-initiative-applicability-chat.js"
import type { InitiativeClassificationChatState } from "./interactive-initiative-classification-chat.js"
import type {
  InitiativeApplicabilityMatrixInput,
  InitiativeClassificationInput,
} from "@gaep/contracts"

export type InitiativeResolutionChatState =
  | InitiativeClassificationChatState
  | InitiativeApplicabilityChatState

/**
 * Classification and applicability use the same conversational commands
 * (`/suggest`, `/accept`, and `/commit`). Only the most recently opened one
 * may own those commands; an older unfinished draft must never reactivate.
 */
export function latestInitiativeResolutionState(
  history: readonly (InitiativeResolutionChatState | undefined)[],
): InitiativeResolutionChatState | undefined {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const candidate = history[index]
    if (candidate) return candidate
  }
  return undefined
}

export interface CurrentInitiativeClassificationBinding {
  id: string
  title: string
  outcome: string
  scope: string[]
  exclusions: string[]
  classification?: InitiativeClassificationInput
}

function sameJsonValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

/**
 * A classification review may be rebound only when another checkpoint (for
 * example applicability) advanced the Initiative revision without changing
 * any fact that the classification proposal was based on.
 */
export function canSafelyRebindInitiativeClassification(
  state: InitiativeClassificationChatState,
  current: CurrentInitiativeClassificationBinding,
): boolean {
  return current.id === state.initiativeId &&
    current.title === state.initiative.title &&
    current.outcome === state.initiative.outcome &&
    sameJsonValue(current.scope, state.initiative.scope) &&
    sameJsonValue(current.exclusions, state.initiative.exclusions) &&
    sameJsonValue(current.classification, state.currentClassification)
}

export function initiativeClassificationAttentionItems(
  input: InitiativeClassificationInput,
): string[] {
  return [...new Set(input.unresolvedQuestions.map((question) => question.trim()).filter(Boolean))]
}

export function initiativeApplicabilityAttentionItems(
  input: InitiativeApplicabilityMatrixInput,
): string[] {
  const items = new Map<string, string>()
  for (const unresolved of input.unresolvedSubjects) {
    const key = `${unresolved.subject.type}:${unresolved.subject.key}`
    items.set(key, `${unresolved.subject.label} — unresolved: ${unresolved.reason}`)
  }
  for (const decision of input.decisions) {
    if (decision.status !== "awaiting-human-decision" && decision.approval.state !== "pending") continue
    const key = `${decision.subject.type}:${decision.subject.key}`
    items.set(key, `${decision.subject.label} — pending human decision${decision.accountableApprover ? ` (${decision.accountableApprover})` : ""}`)
  }
  return [...items.values()]
}
