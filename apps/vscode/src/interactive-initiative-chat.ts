import type { InitiativeInput, ProductInput } from "@gaep/engine"

import {
  isProductChatAdvisorSelection,
  parseLineItems,
  type ProductAnswerAssessment,
  type ProductChatAdvisorSelection,
} from "./interactive-product-chat.js"

export type InitiativeAnswerValue = string | string[]
export type InitiativeAnswerKey = "title" | "outcome" | "scope" | "exclusions"

export interface InitiativeAnswers {
  title?: string
  outcome?: string
  scope?: string[]
  exclusions?: string[]
}

export interface InitiativeQuestion {
  key: InitiativeAnswerKey
  title: string
  prompt: string
  example: string
  parse(value: string): InitiativeAnswerValue
  challenge(value: InitiativeAnswerValue): string | undefined
}

export interface PendingInitiativeAnswer {
  questionKey: InitiativeAnswerKey
  originalAnswer: string
  proposedAnswer: string
  proposedValue: InitiativeAnswerValue
  assessment: string
  strengths: string[]
  gaps: string[]
  followUpQuestion?: string
  round: number
  advisor: ProductChatAdvisorSelection
}

export interface InitiativeChatState {
  schemaVersion: 1
  kind: "gaep-initiative-chat-state"
  phase: "collecting" | "awaiting-approval" | "review" | "committed" | "cancelled"
  step: number
  answers: InitiativeAnswers
  advisor: ProductChatAdvisorSelection
  workflow?: "creation" | "revision"
  initiativeId?: string
  baseInitiativeRevision?: number
  pending?: PendingInitiativeAnswer
}

export interface InitiativeAnswerRepairAttempt {
  attempt: number
  contractErrors: string[]
  previousAssessment?: ProductAnswerAssessment
}

export interface InitiativeAnswerRepairResult {
  state: InitiativeChatState
  attempts: number
}

export class InitiativeAnswerRepairError extends Error {
  constructor(readonly contractErrors: readonly string[]) {
    super(contractErrors[0] ?? "The advisor could not produce a concrete Initiative answer")
    this.name = "InitiativeAnswerRepairError"
  }
}

function textQuestion(
  key: Extract<InitiativeAnswerKey, "title" | "outcome">,
  title: string,
  prompt: string,
  example: string,
  minimum: number,
): InitiativeQuestion {
  return {
    key,
    title,
    prompt,
    example,
    parse: (value) => value.trim(),
    challenge: (value) => {
      if (typeof value !== "string" || value.trim().length < minimum) {
        return `Make this Initiative answer more specific (at least ${minimum} characters).`
      }
      if (/\[[^\]]+\]|<[^>]+>|\{[^}]+\}/u.test(value)) {
        return "Replace template placeholders with a concrete, reviewable Initiative answer."
      }
      return undefined
    },
  }
}

function listChallenge(value: InitiativeAnswerValue, minimum: number, label: string): string | undefined {
  if (!Array.isArray(value) || value.length < minimum) return `Provide at least ${minimum} ${label}, one per line.`
  if (value.length === 1 && value[0]?.includes(",")) {
    return "Put each list item on its own line. GAEP preserves commas inside an item."
  }
  if (value.some((item) => /\[[^\]]+\]|<[^>]+>|\{[^}]+\}/u.test(item))) {
    return `Replace template placeholders with concrete, reviewable ${label}s.`
  }
  return value.some((item) => item.length < 3) ? `Each ${label} must be specific enough to review.` : undefined
}

export const initiativeQuestions: readonly InitiativeQuestion[] = [
  textQuestion(
    "title",
    "Initiative title",
    "Name the bounded change or outcome this Initiative will govern.",
    "Establish the maritime schedule planning MVP",
    5,
  ),
  textQuestion(
    "outcome",
    "Bounded Initiative outcome",
    "What exact, observable outcome should this Initiative produce without claiming implementation completion?",
    "Produce an accepted pre-implementation package for the first voyage schedule planning workflow.",
    30,
  ),
  {
    key: "scope",
    title: "Included scope",
    prompt: "List the work explicitly included in this Initiative, one item per line.",
    example: "Source intake and business understanding\nArchitecture and backlog through implementation readiness\nApplicable Product design and Figma handoff",
    parse: parseLineItems,
    challenge: (value) => listChallenge(value, 1, "scope item"),
  },
  {
    key: "exclusions",
    title: "Initiative exclusions",
    prompt: "List what this Initiative will not do, one item per line. Enter `none` only when that is deliberate.",
    example: "Production implementation\nRelease and deployment\nCross-IDE acceptance",
    parse: (value) => value.trim().toLowerCase() === "none" ? [] : parseLineItems(value),
    challenge: (value) => Array.isArray(value) ? listChallenge(value, 0, "exclusion") : "Provide exclusions as a list.",
  },
] as const

export function startInitiativeChat(advisor: ProductChatAdvisorSelection): InitiativeChatState {
  return {
    schemaVersion: 1,
    kind: "gaep-initiative-chat-state",
    phase: "collecting",
    step: 0,
    answers: {},
    advisor,
    workflow: "creation",
  }
}

/**
 * Gives the advisor the governed Product truth that surrounds a new Initiative.
 * Initiative state deliberately stores only Initiative answers; this projection is
 * rebuilt for every advisory turn so stale Product context is never persisted in chat metadata.
 */
export function initiativeAdvisorAcceptedAnswers(
  answers: InitiativeAnswers,
  product?: { revision: number; input: ProductInput },
): object {
  return {
    acceptedInitiativeFields: { ...answers },
    ...(product ? {
      governedProduct: {
        revision: product.revision,
        ...product.input,
      },
    } : {}),
  }
}

export function startInitiativeRevision(
  advisor: ProductChatAdvisorSelection,
  initiative: { id: string; revision: number; title: string; outcome: string; scope: string[]; exclusions: string[] },
): InitiativeChatState {
  return {
    schemaVersion: 1,
    kind: "gaep-initiative-chat-state",
    phase: "review",
    step: initiativeQuestions.length,
    answers: {
      title: initiative.title,
      outcome: initiative.outcome,
      scope: [...initiative.scope],
      exclusions: [...initiative.exclusions],
    },
    advisor,
    workflow: "revision",
    initiativeId: initiative.id,
    baseInitiativeRevision: initiative.revision,
  }
}

export function editInitiativeField(state: InitiativeChatState, key: InitiativeAnswerKey): InitiativeChatState {
  if (state.workflow !== "revision") throw new Error("Only an Initiative revision can edit a recorded field")
  const step = initiativeQuestions.findIndex((question) => question.key === key)
  if (step < 0) throw new Error("Unknown Initiative field")
  const answers = { ...state.answers }
  delete answers[key]
  return { ...state, phase: "collecting", step, answers, pending: undefined }
}

export function currentInitiativeQuestion(state: InitiativeChatState): InitiativeQuestion | undefined {
  return state.phase === "collecting" || state.phase === "awaiting-approval"
    ? initiativeQuestions[state.step]
    : undefined
}

export function answerInitiative(
  state: InitiativeChatState,
  rawAnswer: string,
): { state: InitiativeChatState; value?: InitiativeAnswerValue; challenge?: string } {
  const question = currentInitiativeQuestion(state)
  if (!question) return { state, challenge: "Start or resume the Initiative workflow before answering." }
  if (!rawAnswer.trim()) return { state, challenge: "Answer the current Initiative question before continuing." }
  const value = question.parse(rawAnswer)
  return { state, value, challenge: question.challenge(value) }
}

export function assessInitiativeAnswer(
  state: InitiativeChatState,
  rawAnswer: string,
  assessment: ProductAnswerAssessment,
): InitiativeChatState {
  const question = currentInitiativeQuestion(state)
  if (!question) throw new Error("There is no Initiative question awaiting assessment")
  const proposedValue = question.parse(assessment.proposedAnswer)
  const challenge = question.challenge(proposedValue)
  if (challenge) throw new Error(`The advisor proposal failed the Initiative field contract: ${challenge}`)
  return {
    ...state,
    phase: "awaiting-approval",
    pending: {
      questionKey: question.key,
      originalAnswer: rawAnswer.trim(),
      proposedAnswer: assessment.proposedAnswer.trim(),
      proposedValue,
      assessment: assessment.assessment.trim(),
      strengths: [...assessment.strengths],
      gaps: [...assessment.gaps],
      followUpQuestion: assessment.followUpQuestion?.trim() || undefined,
      round: state.pending?.questionKey === question.key ? state.pending.round + 1 : 1,
      advisor: state.advisor,
    },
  }
}

function repairDiagnostic(error: unknown): string {
  const message = error instanceof Error ? error.message : "The advisor response was not contract-valid"
  return message.replace(/\s+/gu, " ").trim().slice(0, 2_048) || "The advisor response was not contract-valid"
}

function nonRepairableAdvisorFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const code = (error as { code?: unknown }).code
  return code === "cancelled" || code === "provider-unavailable" || code === "provider-failed"
}

/**
 * Keeps provider formatting mistakes and placeholder answers away from the human.
 * The user supplies intent; GAEP owns normalization to the current field contract.
 */
export async function assessInitiativeAnswerWithAutomaticRepair(
  state: InitiativeChatState,
  rawAnswer: string,
  runAttempt: (input: InitiativeAnswerRepairAttempt) => Promise<ProductAnswerAssessment>,
  maximumAttempts = 3,
): Promise<InitiativeAnswerRepairResult> {
  let previousAssessment: ProductAnswerAssessment | undefined = state.pending ? {
    assessment: state.pending.assessment,
    strengths: [...state.pending.strengths],
    gaps: [...state.pending.gaps],
    ...(state.pending.followUpQuestion ? { followUpQuestion: state.pending.followUpQuestion } : {}),
    proposedAnswer: state.pending.proposedAnswer,
  } : undefined
  let contractErrors: string[] = []
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    let assessment: ProductAnswerAssessment
    try {
      assessment = await runAttempt({ attempt, contractErrors, previousAssessment })
    } catch (error) {
      if (nonRepairableAdvisorFailure(error)) throw error
      contractErrors = [repairDiagnostic(error)]
      continue
    }
    try {
      return { state: assessInitiativeAnswer(state, rawAnswer, assessment), attempts: attempt }
    } catch (error) {
      previousAssessment = assessment
      contractErrors = [repairDiagnostic(error)]
    }
  }
  throw new InitiativeAnswerRepairError(contractErrors)
}

export function acceptInitiativeAnswer(state: InitiativeChatState): InitiativeChatState {
  const question = currentInitiativeQuestion(state)
  if (!question || !state.pending || state.phase !== "awaiting-approval" || state.pending.questionKey !== question.key) {
    throw new Error("There is no assessed Initiative answer awaiting explicit approval")
  }
  const revisionComplete = state.workflow === "revision"
  const step = revisionComplete ? initiativeQuestions.length : state.step + 1
  return {
    ...state,
    step,
    phase: step === initiativeQuestions.length ? "review" : "collecting",
    answers: { ...state.answers, [question.key]: state.pending.proposedValue },
    pending: undefined,
  }
}

export function changeInitiativeAdvisor(
  state: InitiativeChatState,
  advisor: ProductChatAdvisorSelection,
  preservePending = false,
): InitiativeChatState {
  if (preservePending && state.phase === "awaiting-approval" && state.pending) return { ...state, advisor }
  return { ...state, advisor, phase: state.phase === "awaiting-approval" ? "collecting" : state.phase, pending: undefined }
}

export function backInitiative(state: InitiativeChatState): InitiativeChatState {
  if (state.phase === "awaiting-approval") return { ...state, phase: "collecting", pending: undefined }
  const step = Math.max(0, Math.min(state.step, initiativeQuestions.length) - 1)
  const question = initiativeQuestions[step]
  const answers = { ...state.answers }
  if (question) delete answers[question.key]
  return { ...state, phase: "collecting", step, answers, pending: undefined }
}

export function initiativeInput(state: InitiativeChatState): InitiativeInput {
  const { title, outcome, scope, exclusions } = state.answers
  if (state.phase !== "review" || !title || !outcome || !scope || exclusions === undefined) {
    throw new Error("The Initiative draft is incomplete")
  }
  return { title, outcome, scope, exclusions }
}

export function initiativeProgress(state: InitiativeChatState): string {
  return `${Math.min(state.step, initiativeQuestions.length)}/${initiativeQuestions.length}`
}

function boundedStrings(value: unknown, maximumItems: number, maximumLength: number): value is string[] {
  return Array.isArray(value) && value.length <= maximumItems &&
    value.every((item) => typeof item === "string" && item.length <= maximumLength)
}

export function isInitiativeChatState(value: unknown): value is InitiativeChatState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  const phase = String(candidate.phase)
  const step = Number(candidate.step)
  const answers = candidate.answers as Record<string, unknown> | undefined
  if (candidate.schemaVersion !== 1 || candidate.kind !== "gaep-initiative-chat-state" ||
      !["collecting", "awaiting-approval", "review", "committed", "cancelled"].includes(phase) ||
      !Number.isSafeInteger(step) || step < 0 || step > initiativeQuestions.length ||
      !answers || !isProductChatAdvisorSelection(candidate.advisor)) return false
  if (candidate.workflow !== undefined && !["creation", "revision"].includes(String(candidate.workflow))) return false
  if (candidate.workflow === "revision" &&
      (typeof candidate.initiativeId !== "string" || !Number.isSafeInteger(candidate.baseInitiativeRevision) || Number(candidate.baseInitiativeRevision) < 1)) return false
  if ((phase === "review" || phase === "committed") && step !== initiativeQuestions.length) return false
  if ((phase === "collecting" || phase === "awaiting-approval") && step >= initiativeQuestions.length) return false
  if (candidate.workflow === "revision") {
    if (!initiativeQuestions.every((question, index) => index === step && phase !== "review"
      ? answers[question.key] === undefined
      : answers[question.key] !== undefined)) return false
  } else if (!initiativeQuestions.every((question, index) => index < step
    ? answers[question.key] !== undefined
    : answers[question.key] === undefined)) return false
  for (const question of initiativeQuestions) {
    const answer = answers[question.key]
    if (answer === undefined) continue
    if ((typeof answer !== "string" && !boundedStrings(answer, 256, 8_192)) || question.challenge(answer as InitiativeAnswerValue)) return false
  }
  const pending = candidate.pending as Record<string, unknown> | undefined
  if (phase !== "awaiting-approval") return pending === undefined
  const question = initiativeQuestions[step]
  return !!question && !!pending && pending.questionKey === question.key &&
    typeof pending.originalAnswer === "string" && typeof pending.proposedAnswer === "string" &&
    (typeof pending.proposedValue === "string" || boundedStrings(pending.proposedValue, 256, 8_192)) &&
    !question.challenge(pending.proposedValue as InitiativeAnswerValue) &&
    typeof pending.assessment === "string" && boundedStrings(pending.strengths, 16, 4_096) &&
    boundedStrings(pending.gaps, 16, 4_096) &&
    (pending.followUpQuestion === undefined || typeof pending.followUpQuestion === "string") &&
    Number.isSafeInteger(pending.round) && Number(pending.round) >= 1 &&
    isProductChatAdvisorSelection(pending.advisor)
}
