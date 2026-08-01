import {
  initiativeClassificationInputSchema,
  type InitiativeClassificationInput,
} from "@gaep/contracts"

import {
  isProductChatAdvisorSelection,
  type ProductAnswerAssessment,
  type ProductChatAdvisorSelection,
} from "./interactive-product-chat.js"

export interface InitiativeClassificationContext {
  initiativeId: string
  initiativeRevision: number
  productRevision: number
  product: {
    name: string
    profile: string
    summary: string
  }
  initiative: {
    title: string
    outcome: string
    scope: string[]
    exclusions: string[]
  }
}

export interface PendingInitiativeClassification {
  originalAnswer: string
  proposedAnswer: string
  classification: InitiativeClassificationInput
  assessment: string
  strengths: string[]
  gaps: string[]
  followUpQuestion?: string
  round: number
  advisor: ProductChatAdvisorSelection
}

export interface InitiativeClassificationChatState extends InitiativeClassificationContext {
  schemaVersion: 1
  kind: "gaep-initiative-classification-chat-state"
  phase: "collecting" | "awaiting-approval" | "review" | "committed" | "cancelled"
  advisor: ProductChatAdvisorSelection
  pending?: PendingInitiativeClassification
  accepted?: InitiativeClassificationInput
}

const classificationShape = `{
  "primaryType": "product|platform|product-increment|feature|epic|backlog-item|service|module|client-application|mobile-application|api|integration|migration|modernization|refactoring|technical-debt-remediation|security-remediation|infrastructure|devops|observability|library|sdk|cli|worker|event-processor|defect-fix|experiment|research|data-capability|ai-capability",
  "secondaryTypes": [],
  "systemState": "greenfield|brownfield|mixed|unknown",
  "changePosture": "new|existing|replacement|modernization|migration|retirement|mixed",
  "motivations": ["business-driven|technical|regulatory|operational|security-driven|mixed"],
  "characteristics": {
    "userInterface": "ui-bearing|non-ui|unknown",
    "data": "data-bearing|stateless|unknown",
    "integration": "integration-heavy|isolated|mixed|unknown",
    "interactionModes": ["synchronous|asynchronous|batch|streaming|interactive|mixed"],
    "exposure": "internal|partner|public|mixed|unknown"
  },
  "regulated": false,
  "policyDomains": [],
  "sensitivities": ["security|privacy|data|safety|financial|operational|none|unknown"],
  "expectedLifetime": "short-lived|medium-term|long-lived|indefinite|unknown",
  "maintenanceHorizon": "...",
  "risk": {
    "blastRadius": "localized|multi-unit|organization|external|unknown",
    "reversibility": "reversible|partially-reversible|irreversible|unknown",
    "urgency": "low|normal|high|critical|unknown",
    "costOfFailure": "low|medium|high|critical|unknown"
  },
  "dependencies": [],
  "affectedAssets": [],
  "owner": "human role or identity",
  "accountableAuthority": "accountable human role or identity",
  "confidence": { "level": "low|medium|high", "basis": "..." },
  "evidence": [{ "kind": "rule|policy|evidence|requirement|dependency|human-decision", "reference": "..." }],
  "unresolvedQuestions": [],
  "rationale": "at least 10 characters"
}`

export function initiativeClassificationQuestion(state: InitiativeClassificationChatState): {
  key: string
  title: string
  prompt: string
} {
  return {
    key: "initiative-classification",
    title: "Initiative classification brief",
    prompt: [
      `Classify the governed Initiative '${state.initiative.title}' for Product '${state.product.name}'.`,
      "Challenge the human brief, then propose exactly one complete JSON classification using the shape below as proposedAnswer.",
      "Use only enum tokens shown in the shape. Do not invent named people, policies, dependencies, assets, or facts.",
      "When information is genuinely missing, use an available 'unknown' enum and record the exact gap in unresolvedQuestions.",
      "The current conversation itself may be referenced as human-decision evidence, but it does not establish external facts.",
      "Return proposedAnswer as JSON text, not Markdown.",
      "",
      "Required JSON shape:",
      classificationShape,
    ].join("\n"),
  }
}

export function startInitiativeClassificationChat(
  advisor: ProductChatAdvisorSelection,
  context: InitiativeClassificationContext,
): InitiativeClassificationChatState {
  return {
    schemaVersion: 1,
    kind: "gaep-initiative-classification-chat-state",
    phase: "collecting",
    advisor,
    ...context,
  }
}

export function answerInitiativeClassification(
  state: InitiativeClassificationChatState,
  rawAnswer: string,
): { state: InitiativeClassificationChatState; challenge?: string } {
  if (state.phase !== "collecting" && state.phase !== "awaiting-approval") {
    return { state, challenge: "Start or resume Initiative classification before answering." }
  }
  const answer = rawAnswer.trim()
  if (answer.length < 30) {
    return {
      state,
      challenge: "Provide a specific classification brief covering system state, change posture, users/data/integrations, risk, owner, accountable authority, evidence, and known unknowns.",
    }
  }
  return { state }
}

export function parseInitiativeClassificationProposal(value: string): InitiativeClassificationInput {
  if (Buffer.byteLength(value) > 128 * 1_024) throw new Error("The proposed Initiative classification exceeds its governed bound")
  const first = value.indexOf("{")
  const last = value.lastIndexOf("}")
  if (first < 0 || last <= first) throw new Error("The advisor proposal does not contain a JSON Initiative classification")
  let parsed: unknown
  try {
    parsed = JSON.parse(value.slice(first, last + 1))
  } catch {
    throw new Error("The advisor proposal contains malformed Initiative classification JSON")
  }
  return initiativeClassificationInputSchema.parse(parsed)
}

export function assessInitiativeClassification(
  state: InitiativeClassificationChatState,
  rawAnswer: string,
  assessment: ProductAnswerAssessment,
): InitiativeClassificationChatState {
  const classification = parseInitiativeClassificationProposal(assessment.proposedAnswer)
  return {
    ...state,
    phase: "awaiting-approval",
    pending: {
      originalAnswer: rawAnswer.trim(),
      proposedAnswer: assessment.proposedAnswer.trim(),
      classification,
      assessment: assessment.assessment.trim(),
      strengths: [...assessment.strengths],
      gaps: [...assessment.gaps],
      followUpQuestion: assessment.followUpQuestion?.trim() || undefined,
      round: state.pending ? state.pending.round + 1 : 1,
      advisor: state.advisor,
    },
    accepted: undefined,
  }
}

export function acceptInitiativeClassification(
  state: InitiativeClassificationChatState,
): InitiativeClassificationChatState {
  if (state.phase !== "awaiting-approval" || !state.pending) {
    throw new Error("There is no assessed Initiative classification awaiting explicit approval")
  }
  return { ...state, phase: "review", accepted: state.pending.classification, pending: undefined }
}

export function backInitiativeClassification(
  state: InitiativeClassificationChatState,
): InitiativeClassificationChatState {
  return { ...state, phase: "collecting", accepted: undefined, pending: undefined }
}

export function changeInitiativeClassificationAdvisor(
  state: InitiativeClassificationChatState,
  advisor: ProductChatAdvisorSelection,
  preservePending = false,
): InitiativeClassificationChatState {
  if (preservePending && state.phase === "awaiting-approval" && state.pending) return { ...state, advisor }
  return {
    ...state,
    advisor,
    phase: state.phase === "awaiting-approval" || state.phase === "review" ? "collecting" : state.phase,
    pending: undefined,
    accepted: undefined,
  }
}

export function initiativeClassificationInput(
  state: InitiativeClassificationChatState,
): InitiativeClassificationInput {
  if (state.phase !== "review" || !state.accepted) throw new Error("The Initiative classification draft is incomplete")
  return initiativeClassificationInputSchema.parse(state.accepted)
}

function boundedStrings(value: unknown, maximumItems: number, maximumLength: number): value is string[] {
  return Array.isArray(value) && value.length <= maximumItems &&
    value.every((item) => typeof item === "string" && item.length <= maximumLength)
}

export function isInitiativeClassificationChatState(value: unknown): value is InitiativeClassificationChatState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  const product = candidate.product as Record<string, unknown> | undefined
  const initiative = candidate.initiative as Record<string, unknown> | undefined
  if (candidate.schemaVersion !== 1 || candidate.kind !== "gaep-initiative-classification-chat-state" ||
      !["collecting", "awaiting-approval", "review", "committed", "cancelled"].includes(String(candidate.phase)) ||
      typeof candidate.initiativeId !== "string" ||
      typeof candidate.initiativeRevision !== "number" || !Number.isSafeInteger(candidate.initiativeRevision) ||
      typeof candidate.productRevision !== "number" || !Number.isSafeInteger(candidate.productRevision) ||
      !isProductChatAdvisorSelection(candidate.advisor) ||
      !product || typeof product.name !== "string" || typeof product.profile !== "string" || typeof product.summary !== "string" ||
      !initiative || typeof initiative.title !== "string" || typeof initiative.outcome !== "string" ||
      !boundedStrings(initiative.scope, 256, 2_000) || !boundedStrings(initiative.exclusions, 256, 2_000)) return false
  const phase = String(candidate.phase)
  const accepted = initiativeClassificationInputSchema.safeParse(candidate.accepted)
  if (phase === "review" || phase === "committed") return accepted.success && candidate.pending === undefined
  if (candidate.accepted !== undefined) return false
  if (phase !== "awaiting-approval") return candidate.pending === undefined
  const pending = candidate.pending as Record<string, unknown> | undefined
  return !!pending && typeof pending.originalAnswer === "string" && typeof pending.proposedAnswer === "string" &&
    initiativeClassificationInputSchema.safeParse(pending.classification).success &&
    typeof pending.assessment === "string" && boundedStrings(pending.strengths, 16, 4_096) &&
    boundedStrings(pending.gaps, 16, 4_096) &&
    (pending.followUpQuestion === undefined || typeof pending.followUpQuestion === "string") &&
    typeof pending.round === "number" && Number.isSafeInteger(pending.round) && pending.round >= 1 &&
    isProductChatAdvisorSelection(pending.advisor)
}
