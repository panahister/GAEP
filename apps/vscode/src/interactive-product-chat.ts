export const gaepChatParticipantId = "gaep.product"

export const productProfiles = [
  "software",
  "saas",
  "ai-enabled",
  "integration",
  "security-sensitive",
  "data-sensitive",
  "internal-tool",
  "mobile",
] as const

export type ProductProfile = typeof productProfiles[number]
export type ProductInitializationValue = string | string[]

export interface ProductChatAdvisorSelection {
  adapterId: "gaep.codex-cli" | "gaep.claude-code-cli"
  agentId: "codex-cli" | "claude-code-cli"
  agentLabel: "Codex" | "Claude Code"
  modelId: string
  modelLabel: string
  modelTruthClass: "observed" | "provider-declared" | "user-entered"
  runtimeVersion?: string
}

export type ProductChatAdvisorSelectionCommand = "advisor" | "agent" | "model"

export function preferredProductChatAdvisor(
  session: ProductChatAdvisorSelection | undefined,
  initiative: ProductChatAdvisorSelection | undefined,
  product: ProductChatAdvisorSelection | undefined,
): ProductChatAdvisorSelection | undefined {
  return session ?? initiative ?? product
}

export async function selectProductChatAdvisorForCommand(
  command: ProductChatAdvisorSelectionCommand,
  current: ProductChatAdvisorSelection | undefined,
  selectors: {
    advisor(value?: ProductChatAdvisorSelection): Promise<ProductChatAdvisorSelection | undefined>
    agent(value?: ProductChatAdvisorSelection): Promise<ProductChatAdvisorSelection | undefined>
    model(value: ProductChatAdvisorSelection): Promise<ProductChatAdvisorSelection | undefined>
  },
): Promise<ProductChatAdvisorSelection | undefined> {
  if (command === "model" && current) return selectors.model(current)
  if (command === "agent") return selectors.agent(current)
  return selectors.advisor(current)
}

export interface ProductInitializationAnswers {
  name?: string
  summary?: string
  problem?: string
  affectedUsers?: string
  desiredOutcome?: string
  successSignals?: string[]
  firstWorkflow?: string
  exclusions?: string[]
  profile?: ProductProfile
}

export interface ProductAnswerAssessment {
  assessment: string
  strengths: string[]
  gaps: string[]
  followUpQuestion?: string
  proposedAnswer: string
}

export interface PendingProductAnswer {
  questionKey: keyof ProductInitializationAnswers
  originalAnswer: string
  proposedAnswer: string
  proposedValue: ProductInitializationValue
  assessment: string
  strengths: string[]
  gaps: string[]
  followUpQuestion?: string
  round: number
  advisor: ProductChatAdvisorSelection
}

export interface ProductInitializationChatState {
  schemaVersion: 3
  kind: "gaep-product-initialization-chat-state"
  workflow: "initialization" | "revision"
  baseProductRevision?: number
  phase: "collecting" | "awaiting-approval" | "review" | "committed" | "cancelled"
  step: number
  answers: ProductInitializationAnswers
  candidateAttachments: string[]
  advisor: ProductChatAdvisorSelection
  pending?: PendingProductAnswer
}

export interface ProductInitializationInput {
  name: string
  summary: string
  problem: string
  affectedUsers: string
  desiredOutcome: string
  successSignals: string[]
  firstWorkflow: string
  exclusions: string[]
  profile: ProductProfile
}

export interface ProductInitializationQuestion {
  key: keyof ProductInitializationAnswers
  title: string
  prompt: string
  example: string
  parse(value: string): ProductInitializationValue
  challenge(value: ProductInitializationValue): string | undefined
}

export function parseLineItems(value: string): string[] {
  return value
    .split(/\r?\n/u)
    .map((item) => item.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/u, "").trim())
    .filter(Boolean)
}

function ambiguousSingleLineList(value: ProductInitializationValue): string | undefined {
  return Array.isArray(value) && value.length === 1 && value[0]?.includes(",")
    ? "Put each list item on its own line. GAEP preserves commas inside an item and will not guess where one item ends."
    : undefined
}

function textQuestion(
  key: keyof ProductInitializationAnswers,
  title: string,
  prompt: string,
  example: string,
  minimum: number,
): ProductInitializationQuestion {
  return {
    key,
    title,
    prompt,
    example,
    parse: (value) => value.trim(),
    challenge: (value) => typeof value !== "string" || value.trim().length < minimum
      ? `Please make this answer more specific (at least ${minimum} characters).`
      : undefined,
  }
}

export const productInitializationQuestions: readonly ProductInitializationQuestion[] = [
  textQuestion("name", "Product name", "What is the durable name of this Product?", "Marine Shipping Services & Schedules", 2),
  textQuestion("summary", "One-sentence summary", "Describe the Product in one clear sentence.", "A standalone platform for planning and monitoring maritime voyage schedules.", 20),
  textQuestion("problem", "Problem", "What concrete problem does this Product solve, and what happens today without it?", "Schedules are fragmented across spreadsheets, creating inconsistency and slow recovery.", 40),
  textQuestion("affectedUsers", "Affected users", "Who experiences this problem? Name the user or stakeholder groups.", "Line managers, operations officers, schedule planners, and customer service teams.", 20),
  textQuestion("desiredOutcome", "Desired outcome", "What measurable or observable outcome should this Product create?", "Create one authoritative schedule source and reduce manual schedule intervention.", 30),
  {
    key: "successSignals",
    title: "Success signals",
    prompt: "List at least two observable success signals, one item per line. Commas inside an item are preserved.",
    example: "70% fewer manual interventions\nSame-session feasibility output\nPlanned-versus-actual visibility",
    parse: parseLineItems,
    challenge: (value) => ambiguousSingleLineList(value) ?? (!Array.isArray(value) || value.length < 2
      ? "Provide at least two distinct, observable success signals, one per line."
      : value.some((item) => item.length < 4)
        ? "Each success signal must be specific enough to review later."
        : undefined),
  },
  textQuestion("firstWorkflow", "First complete workflow", "Describe the first end-to-end workflow that proves this Product is useful.", "An editor creates a service and voyage, an analyst simulates a change, and a viewer confirms the resulting schedule.", 40),
  {
    key: "exclusions",
    title: "Initial exclusions",
    prompt: "What is explicitly outside the first scope? Put one exclusion on each line. Commas inside an item are preserved. Enter `none` only if the absence of exclusions is deliberate.",
    example: "Live AIS tracking\nAutomated deviation recovery\nCost posting",
    parse: (value) => value.trim().toLowerCase() === "none" ? [] : parseLineItems(value),
    challenge: (value) => ambiguousSingleLineList(value) ?? (!Array.isArray(value) ? "Provide exclusions as a list." : undefined),
  },
  {
    key: "profile",
    title: "Product profile",
    prompt: `Choose one profile: ${productProfiles.join(", ")}.`,
    example: "internal-tool",
    parse: (value) => value.trim().toLowerCase(),
    challenge: (value) => typeof value !== "string" || !productProfiles.includes(value as ProductProfile)
      ? `Choose exactly one supported profile: ${productProfiles.join(", ")}.`
      : undefined,
  },
] as const

function boundedStrings(value: unknown, maximumItems: number, maximumLength: number): value is string[] {
  return Array.isArray(value) && value.length <= maximumItems &&
    value.every((item) => typeof item === "string" && item.length <= maximumLength)
}

export function isProductChatAdvisorSelection(value: unknown): value is ProductChatAdvisorSelection {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  const providerMatches = candidate.adapterId === "gaep.codex-cli"
    ? candidate.agentId === "codex-cli" && candidate.agentLabel === "Codex"
    : candidate.adapterId === "gaep.claude-code-cli" && candidate.agentId === "claude-code-cli" && candidate.agentLabel === "Claude Code"
  return providerMatches &&
    typeof candidate.modelId === "string" && candidate.modelId.length > 0 && candidate.modelId.length <= 1_024 &&
    typeof candidate.modelLabel === "string" && candidate.modelLabel.length > 0 && candidate.modelLabel.length <= 1_024 &&
    ["observed", "provider-declared", "user-entered"].includes(String(candidate.modelTruthClass)) &&
    (candidate.runtimeVersion === undefined || (typeof candidate.runtimeVersion === "string" && candidate.runtimeVersion.length <= 1_024))
}

export function startProductInitialization(
  advisor: ProductChatAdvisorSelection,
  _openingBrief = "",
  candidateAttachments: readonly string[] = [],
): ProductInitializationChatState {
  return {
    schemaVersion: 3,
    kind: "gaep-product-initialization-chat-state",
    workflow: "initialization",
    phase: "collecting",
    step: 0,
    answers: {},
    candidateAttachments: [...new Set(candidateAttachments)].slice(0, 20),
    advisor,
  }
}

export function startProductRevision(
  advisor: ProductChatAdvisorSelection,
  input: ProductInitializationInput,
  baseProductRevision: number,
  candidateAttachments: readonly string[] = [],
): ProductInitializationChatState {
  if (!Number.isSafeInteger(baseProductRevision) || baseProductRevision < 1) {
    throw new Error("A Product revision workflow requires an exact positive base revision")
  }
  return {
    schemaVersion: 3,
    kind: "gaep-product-initialization-chat-state",
    workflow: "revision",
    baseProductRevision,
    phase: "review",
    step: productInitializationQuestions.length,
    answers: { ...input, successSignals: [...input.successSignals], exclusions: [...input.exclusions] },
    candidateAttachments: [...new Set(candidateAttachments)].slice(0, 20),
    advisor,
  }
}

export function editProductRevisionField(
  state: ProductInitializationChatState,
  key: keyof ProductInitializationAnswers,
): ProductInitializationChatState {
  if (state.workflow !== "revision") throw new Error("Only a Product revision draft can edit one existing field")
  const step = productInitializationQuestions.findIndex((question) => question.key === key)
  if (step < 0) throw new Error("The Product field is not supported by the interactive revision workflow")
  return { ...state, phase: "collecting", step, pending: undefined }
}

export function currentProductInitializationQuestion(state: ProductInitializationChatState): ProductInitializationQuestion | undefined {
  return state.phase === "collecting" || state.phase === "awaiting-approval"
    ? productInitializationQuestions[state.step]
    : undefined
}

export function answerProductInitialization(
  state: ProductInitializationChatState,
  rawAnswer: string,
  candidateAttachments: readonly string[] = [],
): { state: ProductInitializationChatState; value?: ProductInitializationValue; challenge?: string } {
  const question = currentProductInitializationQuestion(state)
  if (!question) return { state, challenge: "Start a new initialization or review the completed draft." }
  const attachments = [...new Set([...state.candidateAttachments, ...candidateAttachments])].slice(0, 20)
  if (!rawAnswer.trim()) return {
    state: { ...state, candidateAttachments: attachments },
    challenge: "Answer the current question before continuing.",
  }
  const parsed = question.parse(rawAnswer)
  const challenge = question.challenge(parsed)
  if (challenge) return { state: { ...state, candidateAttachments: attachments }, challenge }
  return { state: { ...state, candidateAttachments: attachments }, value: parsed }
}

export function recordProductAnswerAssessment(
  state: ProductInitializationChatState,
  rawAnswer: string,
  assessment: ProductAnswerAssessment,
): ProductInitializationChatState {
  const question = currentProductInitializationQuestion(state)
  if (!question) throw new Error("There is no Product question awaiting assessment")
  const proposedValue = question.parse(assessment.proposedAnswer)
  const challenge = question.challenge(proposedValue)
  if (challenge) throw new Error(`The advisor proposal failed the governed field contract: ${challenge}`)
  const previousRound = state.pending?.questionKey === question.key ? state.pending.round : 0
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
      round: previousRound + 1,
      advisor: state.advisor,
    },
  }
}

export function acceptProductAnswer(state: ProductInitializationChatState): ProductInitializationChatState {
  const question = currentProductInitializationQuestion(state)
  if (state.phase !== "awaiting-approval" || !state.pending || !question || state.pending.questionKey !== question.key) {
    throw new Error("There is no assessed Product answer awaiting explicit approval")
  }
  const answers = { ...state.answers, [question.key]: state.pending.proposedValue }
  const step = state.workflow === "revision" ? productInitializationQuestions.length : state.step + 1
  return {
    ...state,
    answers,
    step,
    pending: undefined,
    phase: step === productInitializationQuestions.length ? "review" : "collecting",
  }
}

export function changeProductChatAdvisor(
  state: ProductInitializationChatState,
  advisor: ProductChatAdvisorSelection,
  preservePending = false,
): ProductInitializationChatState {
  if (preservePending && state.phase === "awaiting-approval" && state.pending) {
    return { ...state, advisor }
  }
  return {
    ...state,
    advisor,
    phase: state.phase === "awaiting-approval" ? "collecting" : state.phase,
    pending: undefined,
  }
}

export function goBackProductInitialization(state: ProductInitializationChatState): ProductInitializationChatState {
  if (state.phase === "awaiting-approval") return { ...state, phase: "collecting", pending: undefined }
  if (state.workflow === "revision") {
    return { ...state, phase: "review", step: productInitializationQuestions.length, pending: undefined }
  }
  const step = Math.max(0, Math.min(state.step, productInitializationQuestions.length) - 1)
  const question = productInitializationQuestions[step]
  const answers = { ...state.answers }
  if (question) delete answers[question.key]
  return { ...state, phase: "collecting", step, answers, pending: undefined }
}

export function productInitializationInput(state: ProductInitializationChatState): ProductInitializationInput {
  const answers = state.answers
  if (state.phase !== "review" || !answers.name || !answers.summary || !answers.problem ||
      !answers.affectedUsers || !answers.desiredOutcome || !answers.successSignals ||
      !answers.firstWorkflow || answers.exclusions === undefined || !answers.profile) {
    throw new Error("The Product initialization draft is incomplete")
  }
  return {
    name: answers.name,
    summary: answers.summary,
    problem: answers.problem,
    affectedUsers: answers.affectedUsers,
    desiredOutcome: answers.desiredOutcome,
    successSignals: answers.successSignals,
    firstWorkflow: answers.firstWorkflow,
    exclusions: answers.exclusions,
    profile: answers.profile,
  }
}

export function productInitializationProgress(state: ProductInitializationChatState): string {
  return `${Math.min(state.step, productInitializationQuestions.length)}/${productInitializationQuestions.length}`
}

function validPending(value: unknown): value is PendingProductAnswer {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  const question = productInitializationQuestions.find((item) => item.key === candidate.questionKey)
  return !!question &&
    typeof candidate.originalAnswer === "string" && candidate.originalAnswer.length <= 64 * 1_024 &&
    typeof candidate.proposedAnswer === "string" && candidate.proposedAnswer.length <= 64 * 1_024 &&
    (typeof candidate.proposedValue === "string" || boundedStrings(candidate.proposedValue, 256, 8_192)) &&
    !question.challenge(candidate.proposedValue as ProductInitializationValue) &&
    typeof candidate.assessment === "string" && candidate.assessment.length <= 16 * 1_024 &&
    boundedStrings(candidate.strengths, 16, 4_096) && boundedStrings(candidate.gaps, 16, 4_096) &&
    (candidate.followUpQuestion === undefined || (typeof candidate.followUpQuestion === "string" && candidate.followUpQuestion.length <= 8_192)) &&
    Number.isSafeInteger(candidate.round) && Number(candidate.round) >= 1 && Number(candidate.round) <= 32 &&
    isProductChatAdvisorSelection(candidate.advisor)
}

function validAnswers(value: unknown): value is ProductInitializationAnswers {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const answers = value as Record<string, unknown>
  const allowed = new Set(productInitializationQuestions.map((question) => String(question.key)))
  if (Object.keys(answers).some((key) => !allowed.has(key))) return false
  for (const question of productInitializationQuestions) {
    const candidate = answers[question.key]
    if (candidate === undefined) continue
    if ((typeof candidate !== "string" && !boundedStrings(candidate, 256, 8_192)) ||
        question.challenge(candidate as ProductInitializationValue)) return false
  }
  return true
}

export function isProductInitializationChatState(value: unknown): value is ProductInitializationChatState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  const phase = String(candidate.phase)
  const step = Number(candidate.step)
  const pendingMatchesPhase = phase === "awaiting-approval"
    ? validPending(candidate.pending) && candidate.pending.questionKey === productInitializationQuestions[step]?.key
    : candidate.pending === undefined
  const workflow = String(candidate.workflow)
  const phaseMatchesStep = phase === "review" || phase === "committed"
    ? step === productInitializationQuestions.length
    : step < productInitializationQuestions.length
  const answers = candidate.answers as Record<string, unknown> | undefined
  const answersMatchStep = !!answers && (workflow === "revision"
    ? productInitializationQuestions.every((question) => answers[question.key] !== undefined)
    : productInitializationQuestions.every((question, index) =>
        index < step ? answers[question.key] !== undefined : answers[question.key] === undefined))
  const revisionBindingMatches = workflow === "revision"
    ? Number.isSafeInteger(candidate.baseProductRevision) && Number(candidate.baseProductRevision) >= 1
    : candidate.baseProductRevision === undefined
  return candidate.schemaVersion === 3 && candidate.kind === "gaep-product-initialization-chat-state" &&
    ["initialization", "revision"].includes(workflow) && revisionBindingMatches &&
    ["collecting", "awaiting-approval", "review", "committed", "cancelled"].includes(phase) &&
    Number.isSafeInteger(candidate.step) && Number(candidate.step) >= 0 &&
    step <= productInitializationQuestions.length && phaseMatchesStep && answersMatchStep &&
    validAnswers(candidate.answers) &&
    boundedStrings(candidate.candidateAttachments, 20, 8_192) &&
    isProductChatAdvisorSelection(candidate.advisor) && pendingMatchesPhase
}
