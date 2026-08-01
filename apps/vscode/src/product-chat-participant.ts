import { basename, relative, sep } from "node:path"

import type { InitiativeClassificationInput } from "@gaep/contracts"
import type { InitiativeInput, ProductInput } from "@gaep/engine"
import * as vscode from "vscode"

import {
  acceptProductAnswer,
  answerProductInitialization,
  changeProductChatAdvisor,
  currentProductInitializationQuestion,
  editProductRevisionField,
  gaepChatParticipantId,
  goBackProductInitialization,
  isProductInitializationChatState,
  preferredProductChatAdvisor,
  productInitializationInput,
  productInitializationProgress,
  recordProductAnswerAssessment,
  startProductInitialization,
  startProductRevision,
  selectProductChatAdvisorForCommand,
  type ProductAnswerAssessment,
  type ProductChatAdvisorSelection,
  type ProductInitializationChatState,
} from "./interactive-product-chat.js"
import {
  acceptInitiativeAnswer,
  answerInitiative,
  assessInitiativeAnswer,
  backInitiative,
  changeInitiativeAdvisor,
  currentInitiativeQuestion,
  initiativeInput,
  initiativeProgress,
  isInitiativeChatState,
  startInitiativeChat,
  type InitiativeChatState,
} from "./interactive-initiative-chat.js"
import {
  acceptInitiativeClassification,
  answerInitiativeClassification,
  assessInitiativeClassification,
  backInitiativeClassification,
  changeInitiativeClassificationAdvisor,
  initiativeClassificationInput,
  initiativeClassificationQuestion,
  isInitiativeClassificationChatState,
  startInitiativeClassificationChat,
  type InitiativeClassificationChatState,
} from "./interactive-initiative-classification-chat.js"

export type GovernedProductState =
  | { state: "uninitialized" }
  | { state: "partial" }
  | { state: "initialized"; name: string; revision: number; input: ProductInput }

export interface GaepProductChatOptions {
  productState(): Promise<GovernedProductState>
  commitProduct(input: ProductInput): Promise<{ name: string }>
  reviseProduct(input: ProductInput, expectedRevision: number): Promise<{ name: string; revision: number }>
  selectRevisionField(): Promise<keyof ProductInitializationChatState["answers"] | undefined>
  currentInitiative(): Promise<{
    id: string
    title: string
    outcome: string
    scope: string[]
    exclusions: string[]
    state: string
    revision: number
    classificationStatus: "missing" | "stale" | "current"
    applicabilityStatus: "missing" | "stale" | "current"
  } | undefined>
  commitInitiative(input: InitiativeInput): Promise<{ title: string; state: string; revision: number }>
  commitInitiativeClassification(
    initiativeId: string,
    input: InitiativeClassificationInput,
    expectedRevision: number,
  ): Promise<{ title: string; revision: number; primaryType: string; entryState: string }>
  currentAdvisor(): ProductChatAdvisorSelection | undefined
  selectAdvisor(current?: ProductChatAdvisorSelection): Promise<ProductChatAdvisorSelection | undefined>
  selectAgent(current?: ProductChatAdvisorSelection): Promise<ProductChatAdvisorSelection | undefined>
  selectModel(current: ProductChatAdvisorSelection): Promise<ProductChatAdvisorSelection | undefined>
  challengeAnswer(input: {
    advisor: ProductChatAdvisorSelection
    question: { key: string; title: string; prompt: string }
    acceptedAnswers: object
    userAnswer: string
    previousAssessment?: { proposedAnswer: string; gaps: string[]; followUpQuestion?: string }
  }, signal: AbortSignal): Promise<ProductAnswerAssessment>
}

function metadata(state: ProductInitializationChatState): vscode.ChatResult {
  return { metadata: { gaepProductInitialization: state } }
}

function latestState(context: vscode.ChatContext): ProductInitializationChatState | undefined {
  for (const turn of [...context.history].reverse()) {
    if (!("result" in turn)) continue
    const candidate = turn.result.metadata?.gaepProductInitialization
    if (isProductInitializationChatState(candidate)) return candidate
  }
  return undefined
}

function initiativeMetadata(state: InitiativeChatState): vscode.ChatResult {
  return { metadata: { gaepInitiative: state } }
}

function latestInitiativeState(context: vscode.ChatContext): InitiativeChatState | undefined {
  for (const turn of [...context.history].reverse()) {
    if (!("result" in turn)) continue
    const candidate = turn.result.metadata?.gaepInitiative
    if (isInitiativeChatState(candidate)) return candidate
  }
  return undefined
}

function classificationMetadata(state: InitiativeClassificationChatState): vscode.ChatResult {
  return { metadata: { gaepInitiativeClassification: state } }
}

function latestClassificationState(context: vscode.ChatContext): InitiativeClassificationChatState | undefined {
  for (const turn of [...context.history].reverse()) {
    if (!("result" in turn)) continue
    const candidate = turn.result.metadata?.gaepInitiativeClassification
    if (isInitiativeClassificationChatState(candidate)) return candidate
  }
  return undefined
}

function referenceUri(reference: vscode.ChatPromptReference): vscode.Uri | undefined {
  if (reference.value instanceof vscode.Uri) return reference.value
  if (reference.value instanceof vscode.Location) return reference.value.uri
  return undefined
}

function portableAttachmentLabel(uri: vscode.Uri): string {
  if (uri.scheme !== "file") return `${uri.scheme}:${basename(uri.path) || "attachment"}`
  const folder = vscode.workspace.getWorkspaceFolder(uri)
  if (!folder) return basename(uri.fsPath) || "external-attachment"
  const path = relative(folder.uri.fsPath, uri.fsPath)
  if (!path || path === ".." || path.startsWith(`..${sep}`)) return basename(uri.fsPath) || "attachment"
  return `${folder.name}/${path.split(sep).join("/")}`
}

function attachments(request: vscode.ChatRequest, response: vscode.ChatResponseStream): string[] {
  const labels: string[] = []
  for (const reference of request.references.slice(0, 20)) {
    const uri = referenceUri(reference)
    if (!uri) continue
    response.reference(uri)
    labels.push(portableAttachmentLabel(uri))
  }
  return [...new Set(labels)]
}

function markdownValue(value: string): string {
  return value.replace(/[\\`*_{}[\]()#+.!|>-]/gu, "\\$&")
}

function sameAdvisor(left: ProductChatAdvisorSelection, right: ProductChatAdvisorSelection): boolean {
  return left.adapterId === right.adapterId && left.modelId === right.modelId
}

function initializationValue(value: string | string[]): string {
  return Array.isArray(value) ? value.join("\n") : value
}

function questionMarkdown(state: ProductInitializationChatState, challenge?: string): string {
  const question = currentProductInitializationQuestion(state)
  if (!question) return "The initialization draft is ready for review."
  return [
    `### ${question.title}`,
    "",
    `Progress: **${productInitializationProgress(state)}**`,
    `Advisor: **${markdownValue(state.advisor.agentLabel)} · ${markdownValue(state.advisor.modelLabel)}** (${state.advisor.modelTruthClass})`,
    "",
    ...(challenge ? [`> ${challenge}`, ""] : []),
    question.prompt,
    ...(state.workflow === "revision" && state.answers[question.key] !== undefined
      ? ["", `Current governed value: ${markdownValue(initializationValue(state.answers[question.key]!))}`]
      : []),
    "",
    `Example: _${question.example}_`,
    "",
    "Answer naturally, paste multiple lines, or use the VS Code Chat microphone. Attachments remain candidate inputs until a governed Source Intake records them.",
  ].join("\n")
}

function assessedAnswerMarkdown(state: ProductInitializationChatState): string {
  const question = currentProductInitializationQuestion(state)
  const pending = state.pending
  if (!question || !pending) return "No assessed answer is awaiting approval."
  const list = (values: readonly string[], empty: string) => values.length > 0
    ? values.map((value) => `- ${markdownValue(value)}`).join("\n")
    : `- ${empty}`
  return [
    `### ${question.title} — advisory round ${pending.round}`,
    "",
    `Advisor: **${markdownValue(pending.advisor.agentLabel)} · ${markdownValue(pending.advisor.modelLabel)}**`,
    "",
    `**Assessment:** ${markdownValue(pending.assessment)}`,
    "",
    "**Strengths retained:**",
    list(pending.strengths, "No distinct strength was identified."),
    "",
    "**Gaps or assumptions:**",
    list(pending.gaps, "No material gap was identified."),
    "",
    "**Proposed answer:**",
    "",
    `> ${markdownValue(pending.proposedAnswer).replace(/\n/gu, "\n> ")}`,
    ...(pending.followUpQuestion ? ["", `**Challenge question:** ${markdownValue(pending.followUpQuestion)}`] : []),
    "",
    "> This is an AI proposal, not accepted Product truth. GAEP will not advance automatically.",
    "",
    "Send **`@gaep /accept`** to accept this proposal and move to the next question. Otherwise reply naturally with a correction, objection, or more context; the selected advisor will challenge and improve it again.",
  ].join("\n")
}

function initiativeQuestionMarkdown(state: InitiativeChatState, challenge?: string): string {
  const question = currentInitiativeQuestion(state)
  if (!question) return "The Initiative draft is ready for review."
  return [
    `### ${question.title}`,
    "",
    `Initiative progress: **${initiativeProgress(state)}**`,
    `Advisor: **${markdownValue(state.advisor.agentLabel)} · ${markdownValue(state.advisor.modelLabel)}** (${state.advisor.modelTruthClass})`,
    "",
    ...(challenge ? [`> ${challenge}`, ""] : []),
    question.prompt,
    "",
    `Example: _${question.example.replace(/\n/gu, " · ")}_`,
    "",
    "Reply naturally. GAEP will ask the selected advisor to challenge the answer and will not advance until `/accept`.",
  ].join("\n")
}

function initiativeAssessedMarkdown(state: InitiativeChatState): string {
  const question = currentInitiativeQuestion(state)
  const pending = state.pending
  if (!question || !pending) return "No assessed Initiative answer is awaiting approval."
  const items = (values: readonly string[], empty: string) => values.length > 0
    ? values.map((value) => `- ${markdownValue(value)}`).join("\n")
    : `- ${empty}`
  return [
    `### ${question.title} — advisory round ${pending.round}`,
    "",
    `Advisor: **${markdownValue(pending.advisor.agentLabel)} · ${markdownValue(pending.advisor.modelLabel)}**`,
    "",
    `**Assessment:** ${markdownValue(pending.assessment)}`,
    "",
    "**Strengths retained:**",
    items(pending.strengths, "No distinct strength was identified."),
    "",
    "**Gaps or assumptions:**",
    items(pending.gaps, "No material gap was identified."),
    "",
    "**Proposed answer:**",
    "",
    `> ${markdownValue(pending.proposedAnswer).replace(/\n/gu, "\n> ")}`,
    ...(pending.followUpQuestion ? ["", `**Challenge question:** ${markdownValue(pending.followUpQuestion)}`] : []),
    "",
    "> This proposal does not create or advance an Initiative.",
    "",
    "Send **`@gaep /accept`** to accept it, or reply with a correction for another advisory round.",
  ].join("\n")
}

function initiativeReviewMarkdown(state: InitiativeChatState): string {
  const input = initiativeInput(state)
  const items = (values: readonly string[]) => values.length > 0
    ? values.map((value) => `- ${markdownValue(value)}`).join("\n")
    : "- None declared"
  return [
    "## Initiative review",
    "",
    `**Title:** ${markdownValue(input.title)}`,
    "",
    `**Bounded outcome:** ${markdownValue(input.outcome)}`,
    "",
    "**Included scope:**",
    items(input.scope),
    "",
    "**Exclusions:**",
    items(input.exclusions),
    "",
    "> Commit creates a proposed Initiative only. It grants no activation, execution, implementation, or source authority.",
    "",
    "Send **`@gaep /commit CONFIRM`** to create it, `/back` to revise the last field, or `/cancel` to discard the draft.",
  ].join("\n")
}

function classificationSummary(input: InitiativeClassificationInput): string {
  const list = (values: readonly string[]) => values.length > 0 ? values.map(markdownValue).join(", ") : "none"
  return [
    `**Primary / secondary types:** \`${input.primaryType}\` / ${list(input.secondaryTypes)}`,
    `**System / change:** \`${input.systemState}\` / \`${input.changePosture}\``,
    `**Motivations:** ${list(input.motivations)}`,
    `**UI / data / integration / exposure:** \`${input.characteristics.userInterface}\` / \`${input.characteristics.data}\` / \`${input.characteristics.integration}\` / \`${input.characteristics.exposure}\``,
    `**Interaction modes:** ${list(input.characteristics.interactionModes)}`,
    `**Regulated / policy domains:** ${input.regulated ? "yes" : "no"} / ${list(input.policyDomains)}`,
    `**Sensitivities:** ${list(input.sensitivities)}`,
    `**Lifetime / maintenance:** \`${input.expectedLifetime}\` / ${markdownValue(input.maintenanceHorizon)}`,
    `**Risk:** blast radius \`${input.risk.blastRadius}\`, reversibility \`${input.risk.reversibility}\`, urgency \`${input.risk.urgency}\`, cost of failure \`${input.risk.costOfFailure}\``,
    `**Dependencies / affected assets:** ${list(input.dependencies)} / ${list(input.affectedAssets)}`,
    `**Owner / accountable authority:** ${markdownValue(input.owner)} / ${markdownValue(input.accountableAuthority)}`,
    `**Confidence:** \`${input.confidence.level}\` — ${markdownValue(input.confidence.basis)}`,
    `**Evidence:** ${input.evidence.map((entry) => `${entry.kind}: ${markdownValue(entry.reference)}`).join("; ")}`,
    `**Unresolved questions:** ${list(input.unresolvedQuestions)}`,
    `**Rationale:** ${markdownValue(input.rationale)}`,
  ].join("\n\n")
}

function classificationQuestionMarkdown(state: InitiativeClassificationChatState, challenge?: string): string {
  return [
    "## Initiative Classification",
    "",
    `Initiative: **${markdownValue(state.initiative.title)}** · revision ${state.initiativeRevision}`,
    `Product: **${markdownValue(state.product.name)}** · revision ${state.productRevision} · profile \`${state.product.profile}\``,
    `Advisor: **${markdownValue(state.advisor.agentLabel)} · ${markdownValue(state.advisor.modelLabel)}** (${state.advisor.modelTruthClass})`,
    "",
    ...(challenge ? [`> ${challenge}`, ""] : []),
    "Describe the classification in natural language. Include what is known about:",
    "",
    "- primary/secondary Initiative type and whether this is greenfield or brownfield;",
    "- change posture and motivations;",
    "- UI, data, integrations, interaction modes, and exposure;",
    "- regulation, policy domains, sensitivities, lifetime, and maintenance horizon;",
    "- blast radius, reversibility, urgency, cost of failure, dependencies, and affected assets;",
    "- human owner, accountable authority, evidence basis, confidence, and unresolved questions.",
    "",
    "The selected advisor will challenge the brief and propose the complete governed classification. GAEP will not persist it without `/accept` followed by `/commit CONFIRM`.",
  ].join("\n")
}

function classificationAssessedMarkdown(state: InitiativeClassificationChatState): string {
  const pending = state.pending
  if (!pending) return "No assessed Initiative classification is awaiting approval."
  const items = (values: readonly string[], empty: string) => values.length > 0
    ? values.map((value) => `- ${markdownValue(value)}`).join("\n")
    : `- ${empty}`
  return [
    `## Initiative Classification — advisory round ${pending.round}`,
    "",
    `Advisor: **${markdownValue(pending.advisor.agentLabel)} · ${markdownValue(pending.advisor.modelLabel)}**`,
    "",
    `**Assessment:** ${markdownValue(pending.assessment)}`,
    "",
    "**Strengths retained:**",
    items(pending.strengths, "No distinct strength was identified."),
    "",
    "**Gaps or assumptions:**",
    items(pending.gaps, "No material gap was identified."),
    ...(pending.followUpQuestion ? ["", `**Challenge question:** ${markdownValue(pending.followUpQuestion)}`] : []),
    "",
    "### Proposed governed classification",
    "",
    classificationSummary(pending.classification),
    "",
    "> This is an AI proposal. It grants no approval, applicability decision, activation, execution, or implementation authority.",
    "",
    "Send **`@gaep /accept`** to move to exact review, or reply naturally with corrections for another advisory round.",
  ].join("\n")
}

function classificationReviewMarkdown(state: InitiativeClassificationChatState): string {
  const input = initiativeClassificationInput(state)
  return [
    "## Initiative Classification review",
    "",
    classificationSummary(input),
    "",
    `Bound to Initiative revision **${state.initiativeRevision}** and Product revision **${state.productRevision}**.`,
    "",
    "> Commit records human-attributed classification only. It does not resolve applicability or activate the Initiative.",
    "",
    "Send **`@gaep /commit CONFIRM`** to record it, `/back` to revise the brief, or `/cancel` to discard the draft.",
  ].join("\n")
}

function reviewMarkdown(state: ProductInitializationChatState): string {
  const input = productInitializationInput(state)
  const items = (values: readonly string[]) => values.length > 0
    ? values.map((value) => `- ${markdownValue(value)}`).join("\n")
    : "- None declared"
  return [
    "## Product initialization review",
    "",
    `**Name:** ${markdownValue(input.name)}`,
    "",
    `**Summary:** ${markdownValue(input.summary)}`,
    "",
    `**Problem:** ${markdownValue(input.problem)}`,
    "",
    `**Affected users:** ${markdownValue(input.affectedUsers)}`,
    "",
    `**Desired outcome:** ${markdownValue(input.desiredOutcome)}`,
    "",
    "**Success signals:**",
    items(input.successSignals),
    "",
    `**First workflow:** ${markdownValue(input.firstWorkflow)}`,
    "",
    "**Initial exclusions:**",
    items(input.exclusions),
    "",
    `**Profile:** \`${input.profile}\``,
    "",
    `**Candidate attachments (${state.candidateAttachments.length}):** ${state.candidateAttachments.length > 0 ? state.candidateAttachments.map(markdownValue).join(", ") : "none"}`,
    "",
    "> Conversation and attachments are not yet the engineering source of truth. Only the explicit commit below creates governed Product state; attachments require a later Source Intake.",
    "",
    state.workflow === "revision"
      ? "Use **`@gaep /revise`** to edit another field. To create an audited Product revision, send **`@gaep /commit CONFIRM`**. Use `/cancel` to discard this revision draft."
      : "To create `.gaep`, send **`@gaep /commit CONFIRM`**. Use `/back` to revise the last answer or `/cancel` to discard this chat draft.",
  ].join("\n")
}

function helpMarkdown(): string {
  return [
    "## GAEP interactive Product workspace",
    "",
    "- `/initialize` — start a challenged Product initialization",
    "- `/revise` — revise one or more fields of an existing Product without replacing its identity",
    "- `/continue` — inspect governed state and start the next valid conversational workflow",
    "- `/agent` — switch between Codex and Claude Code, then select its model",
    "- `/model` — switch models within the current agent",
    "- `/advisor` — combined agent-and-model selector (compatibility alias)",
    "- `/accept` — explicitly accept the current AI-assisted proposal and advance",
    "- `/status` — inspect governed Product and draft state",
    "- `/review` — review a completed initialization draft",
    "- `/back` — revise the previous answer",
    "- `/commit CONFIRM` — explicitly create governed Product state",
    "- `/cancel` — discard the current chat draft",
    "",
    "Use VS Code Chat attachments for files and the host microphone for speech-to-text. GAEP stores neither raw audio nor attachment contents during initialization.",
  ].join("\n")
}

export function registerGaepProductChat(
  context: vscode.ExtensionContext,
  options: GaepProductChatOptions,
): vscode.ChatParticipant {
  const handler: vscode.ChatRequestHandler = async (request, chatContext, response, token) => {
    if (!vscode.workspace.isTrusted) {
      response.markdown("GAEP is fail-closed in Restricted Mode. Trust the intended Product folder before starting an interactive workflow.")
      response.button({ command: "gaep.manageWorkspaceTrust", title: "Manage Workspace Trust" })
      return { errorDetails: { message: "Workspace trust is required" } }
    }
    const command = request.command ?? ""
    const attached = attachments(request, response)
    let state = latestState(chatContext)
    let initiativeState = latestInitiativeState(chatContext)
    let classificationState = latestClassificationState(chatContext)
    const sessionAdvisor = options.currentAdvisor()
    if (state && sessionAdvisor && !sameAdvisor(state.advisor, sessionAdvisor)) {
      state = changeProductChatAdvisor(state, sessionAdvisor, true)
    }
    if (initiativeState && sessionAdvisor && !sameAdvisor(initiativeState.advisor, sessionAdvisor)) {
      initiativeState = changeInitiativeAdvisor(initiativeState, sessionAdvisor, true)
    }
    if (classificationState && sessionAdvisor && !sameAdvisor(classificationState.advisor, sessionAdvisor)) {
      classificationState = changeInitiativeClassificationAdvisor(classificationState, sessionAdvisor, true)
    }

    if (command === "help") {
      response.markdown(helpMarkdown())
      return classificationState ? classificationMetadata(classificationState)
        : initiativeState ? initiativeMetadata(initiativeState) : state ? metadata(state) : undefined
    }
    if (command === "status") {
      const product = await options.productState()
      const advisor = preferredProductChatAdvisor(
        options.currentAdvisor(),
        classificationState?.advisor ?? initiativeState?.advisor,
        state?.advisor,
      )
      const advisorStatus = advisor
        ? `${markdownValue(advisor.agentLabel)} · ${markdownValue(advisor.modelLabel)} (${advisor.modelTruthClass})`
        : "not selected"
      const draftStatus = classificationState && !["committed", "cancelled"].includes(classificationState.phase)
        ? `Initiative classification ${classificationState.phase} (Initiative revision ${classificationState.initiativeRevision})`
        : initiativeState && !["committed", "cancelled"].includes(initiativeState.phase)
          ? `Initiative ${initiativeState.phase} (${initiativeProgress(initiativeState)})`
          : state ? `Product ${state.phase} (${productInitializationProgress(state)})` : "none"
      response.markdown(product.state === "initialized"
        ? `Governed Product: **${markdownValue(product.name)}** at revision ${product.revision}. Chat draft: ${draftStatus}. Advisor: **${advisorStatus}**.`
        : `Governed Product: **${product.state}**. Chat draft: ${draftStatus}. Advisor: **${advisorStatus}**.`)
      return classificationState ? classificationMetadata(classificationState)
        : initiativeState ? initiativeMetadata(initiativeState) : state ? metadata(state) : undefined
    }
    const productDraftActive = Boolean(state && !["committed", "cancelled"].includes(state.phase))
    const initiativeDraftActive = Boolean(initiativeState && !["committed", "cancelled"].includes(initiativeState.phase))
    const classificationDraftActive = Boolean(classificationState && !["committed", "cancelled"].includes(classificationState.phase))
    if ((command === "advisor" || command === "agent" || command === "model") &&
        !productDraftActive && !initiativeDraftActive && !classificationDraftActive) {
      const current = preferredProductChatAdvisor(
        options.currentAdvisor(),
        classificationState?.advisor ?? initiativeState?.advisor,
        state?.advisor,
      )
      const advisor = await selectProductChatAdvisorForCommand(command, current, {
        advisor: options.selectAdvisor,
        agent: options.selectAgent,
        model: options.selectModel,
      })
      if (!advisor) {
        response.markdown("Agent/model selection was cancelled. The current Product Chat selection was preserved.")
        return classificationState ? classificationMetadata(classificationState)
          : initiativeState ? initiativeMetadata(initiativeState) : state ? metadata(state) : undefined
      }
      response.markdown([
        `Product Chat advisor changed to **${markdownValue(advisor.agentLabel)} · ${markdownValue(advisor.modelLabel)}** (${advisor.modelTruthClass}).`,
        "",
        "This selection applies to the next Product or Initiative advisory turn. It does not change committed Product or Initiative history.",
        "",
        "Use **`@gaep /status`** to verify the active selection, then **`@gaep /continue`** to resume the lifecycle.",
      ].join("\n"))
      return classificationState ? classificationMetadata(classificationState)
        : initiativeState ? initiativeMetadata(initiativeState) : state ? metadata(state) : undefined
    }
    if (command === "initialize") {
      const product = await options.productState()
      if (product.state === "initialized") {
        response.markdown(`This workspace already contains the governed Product **${markdownValue(product.name)}**. Use **\`@gaep /revise\`** to correct it or **\`@gaep /continue\`** to start the next valid lifecycle step; initialization will not overwrite it.`)
        return
      }
      if (product.state === "partial") {
        response.markdown("This folder contains partial `.gaep` state without a valid Product manifest. Initialization is disabled to preserve evidence.")
        response.button({ command: "gaep.showDiagnostics", title: "Show Diagnostics" })
        return { errorDetails: { message: "Partial GAEP state requires diagnosis" } }
      }
      const advisor = await options.selectAdvisor(state?.advisor)
      if (!advisor) {
        response.markdown("Product initialization did not start because no executable Codex or Claude Code advisor/model was selected. No Product state was changed.")
        return state ? metadata(state) : undefined
      }
      state = startProductInitialization(advisor, request.prompt, attached)
      response.markdown([
        "# GAEP Product initialization",
        "",
        `I will collect nine bounded inputs. **${markdownValue(advisor.agentLabel)} · ${markdownValue(advisor.modelLabel)}** will challenge and improve every candidate answer, and GAEP will require **\`/accept\`** before moving to the next question.`,
        ...(attached.length > 0 ? ["", `Received ${attached.length} candidate attachment(s). They are referenced but not yet governed or treated as authoritative.`] : []),
        "",
        questionMarkdown(state),
      ].join("\n"))
      return metadata(state)
    }
    if (command === "revise") {
      const product = await options.productState()
      if (product.state !== "initialized") {
        response.markdown(product.state === "partial"
          ? "Product revision is disabled because this folder contains partial `.gaep` state. Review diagnostics first."
          : "Initialize the Product before starting a governed revision.")
        return state ? metadata(state) : undefined
      }
      const advisor = preferredProductChatAdvisor(options.currentAdvisor(), undefined, state?.advisor) ?? await options.selectAdvisor()
      if (!advisor) {
        response.markdown("Product revision did not start because no executable Codex or Claude Code advisor/model was selected.")
        return state ? metadata(state) : undefined
      }
      if (state?.workflow !== "revision" || state.baseProductRevision !== product.revision ||
          state.phase === "committed" || state.phase === "cancelled") {
        state = startProductRevision(advisor, product.input, product.revision, attached)
      }
      const field = await options.selectRevisionField()
      if (!field) {
        response.markdown(`${reviewMarkdown(state)}\n\nNo field was selected; the revision draft was preserved.`)
        return metadata(state)
      }
      state = editProductRevisionField(state, field)
      response.markdown(questionMarkdown(state, "Revise this field. The existing governed value remains unchanged until explicit acceptance and commit."))
      return metadata(state)
    }
    if (command === "continue") {
      const product = await options.productState()
      if (product.state !== "initialized") {
        response.markdown(product.state === "partial"
          ? "GAEP found partial Product state. Continuation is blocked until diagnostics and recovery complete."
          : "No governed Product exists yet. Start with **`@gaep /initialize`**.")
        return state ? metadata(state) : undefined
      }
      if (classificationState && !["committed", "cancelled"].includes(classificationState.phase)) {
        response.markdown(classificationState.phase === "review"
          ? classificationReviewMarkdown(classificationState)
          : classificationState.phase === "awaiting-approval"
            ? classificationAssessedMarkdown(classificationState)
            : classificationQuestionMarkdown(classificationState, "Resumed the current uncommitted Initiative classification."))
        return classificationMetadata(classificationState)
      }
      if (initiativeState && !["committed", "cancelled"].includes(initiativeState.phase)) {
        response.markdown(initiativeState.phase === "review"
          ? initiativeReviewMarkdown(initiativeState)
          : initiativeQuestionMarkdown(initiativeState, "Resumed the current uncommitted Initiative draft."))
        return initiativeMetadata(initiativeState)
      }
      const current = await options.currentInitiative()
      if (current) {
        if (current.classificationStatus === "current") {
          response.markdown([
            `Current Initiative: **${markdownValue(current.title)}** · ${markdownValue(current.state)} · revision ${current.revision}.`,
            "",
            "Its governed classification is current. The next step is conversational applicability resolution, which will be installed in the next independently testable checkpoint.",
          ].join("\n"))
          return classificationState ? classificationMetadata(classificationState)
            : initiativeState ? initiativeMetadata(initiativeState) : state ? metadata(state) : undefined
        }
        const advisor = preferredProductChatAdvisor(
          options.currentAdvisor(),
          classificationState?.advisor ?? initiativeState?.advisor,
          state?.advisor,
        ) ?? await options.selectAdvisor()
        if (!advisor) {
          response.markdown("Initiative classification did not start because no executable Codex or Claude Code advisor/model was selected.")
          return classificationState ? classificationMetadata(classificationState)
            : initiativeState ? initiativeMetadata(initiativeState) : state ? metadata(state) : undefined
        }
        classificationState = startInitiativeClassificationChat(advisor, {
          initiativeId: current.id,
          initiativeRevision: current.revision,
          productRevision: product.revision,
          product: {
            name: product.name,
            profile: product.input.profile,
            summary: product.input.summary,
          },
          initiative: {
            title: current.title,
            outcome: current.outcome,
            scope: [...current.scope],
            exclusions: [...current.exclusions],
          },
        })
        response.markdown([
          "# GAEP Initiative classification",
          "",
          `The proposed Initiative **${markdownValue(current.title)}** is bound to Product revision ${product.revision}. **${markdownValue(advisor.agentLabel)} · ${markdownValue(advisor.modelLabel)}** will challenge one natural-language classification brief and map it to the complete governed contract. No classification is recorded until /accept and /commit CONFIRM.`,
          "",
          classificationQuestionMarkdown(classificationState),
        ].join("\n"))
        return classificationMetadata(classificationState)
      }
      const advisor = preferredProductChatAdvisor(options.currentAdvisor(), initiativeState?.advisor, state?.advisor) ?? await options.selectAdvisor()
      if (!advisor) {
        response.markdown("Continuation did not start because no executable Product advisor/model was selected.")
        return state ? metadata(state) : undefined
      }
      initiativeState = startInitiativeChat(advisor)
      response.markdown([
        "# GAEP Initiative creation",
        "",
        `The governed Product **${markdownValue(product.name)}** is at revision ${product.revision}. I will collect four bounded Initiative inputs. **${markdownValue(advisor.agentLabel)} · ${markdownValue(advisor.modelLabel)}** will challenge each answer; only /accept advances and only /commit CONFIRM creates a proposed Initiative.`,
        "",
        initiativeQuestionMarkdown(initiativeState),
      ].join("\n"))
      return initiativeMetadata(initiativeState)
    }
    if (classificationState && !["committed", "cancelled"].includes(classificationState.phase)) {
      if (command === "cancel") {
        classificationState = { ...classificationState, phase: "cancelled" }
        response.markdown("The Initiative classification draft was discarded. No governed Initiative record was changed.")
        return classificationMetadata(classificationState)
      }
      if (command === "advisor" || command === "agent" || command === "model") {
        const advisor = command === "model"
          ? await options.selectModel(classificationState.advisor)
          : command === "agent"
            ? await options.selectAgent(classificationState.advisor)
            : await options.selectAdvisor(classificationState.advisor)
        if (!advisor) {
          response.markdown("Agent/model selection was cancelled. The classification draft was preserved.")
          return classificationMetadata(classificationState)
        }
        if (sameAdvisor(classificationState.advisor, advisor)) {
          response.markdown(classificationState.phase === "awaiting-approval"
            ? classificationAssessedMarkdown(classificationState)
            : classificationQuestionMarkdown(classificationState, "The selected agent and model are already active."))
          return classificationMetadata(classificationState)
        }
        const pending = classificationState.pending
        classificationState = changeInitiativeClassificationAdvisor(classificationState, advisor, true)
        if (pending && !sameAdvisor(pending.advisor, advisor)) {
          response.progress(`Re-evaluating the Initiative classification with ${advisor.agentLabel} · ${advisor.modelLabel}`)
          const abort = new AbortController()
          const cancellation = token.onCancellationRequested(() => abort.abort())
          try {
            const assessment = await options.challengeAnswer({
              advisor,
              question: initiativeClassificationQuestion(classificationState),
              acceptedAnswers: {
                product: classificationState.product,
                initiative: classificationState.initiative,
                revisionBinding: {
                  initiativeRevision: classificationState.initiativeRevision,
                  productRevision: classificationState.productRevision,
                },
              },
              userAnswer: pending.originalAnswer,
              previousAssessment: pending,
            }, abort.signal)
            classificationState = assessInitiativeClassification(classificationState, pending.originalAnswer, assessment)
            response.markdown(classificationAssessedMarkdown(classificationState))
          } catch {
            response.markdown(`${classificationAssessedMarkdown(classificationState)}\n\nRe-evaluation failed; the prior unaccepted proposal remains visible and GAEP did not advance.`)
            response.button({ command: "gaep.showDiagnostics", title: "Show Diagnostics" })
          } finally {
            cancellation.dispose()
          }
          return classificationMetadata(classificationState)
        }
        classificationState = changeInitiativeClassificationAdvisor(classificationState, advisor)
        response.markdown(classificationQuestionMarkdown(classificationState, "The new advisor applies to the unaccepted classification brief."))
        return classificationMetadata(classificationState)
      }
      if (command === "back") {
        classificationState = backInitiativeClassification(classificationState)
        response.markdown(classificationQuestionMarkdown(classificationState, "The accepted classification proposal was reopened for revision."))
        return classificationMetadata(classificationState)
      }
      if (command === "review") {
        response.markdown(classificationState.phase === "review"
          ? classificationReviewMarkdown(classificationState)
          : classificationState.phase === "awaiting-approval"
            ? classificationAssessedMarkdown(classificationState)
            : classificationQuestionMarkdown(classificationState, "Provide and accept a classification brief before review."))
        return classificationMetadata(classificationState)
      }
      if (command === "accept") {
        if (!classificationState.pending) {
          response.markdown(classificationQuestionMarkdown(classificationState, "There is no Initiative classification proposal awaiting acceptance."))
          return classificationMetadata(classificationState)
        }
        classificationState = acceptInitiativeClassification(classificationState)
        response.markdown(classificationReviewMarkdown(classificationState))
        return classificationMetadata(classificationState)
      }
      if (command === "commit") {
        if (classificationState.phase !== "review") {
          response.markdown(classificationState.phase === "awaiting-approval"
            ? `${classificationAssessedMarkdown(classificationState)}\n\nAccept the exact proposal before commit.`
            : classificationQuestionMarkdown(classificationState, "The classification draft is incomplete."))
          return classificationMetadata(classificationState)
        }
        if (request.prompt.trim() !== "CONFIRM") {
          response.markdown(`${classificationReviewMarkdown(classificationState)}\n\nCommit was not performed. Send exactly **\`@gaep /commit CONFIRM\`**.`)
          return classificationMetadata(classificationState)
        }
        response.progress("Recording the revision-bound Initiative classification")
        const committed = await options.commitInitiativeClassification(
          classificationState.initiativeId,
          initiativeClassificationInput(classificationState),
          classificationState.initiativeRevision,
        )
        classificationState = { ...classificationState, phase: "committed" }
        response.markdown([
          `Initiative **${markdownValue(committed.title)}** was classified as **${markdownValue(committed.primaryType)}** at revision ${committed.revision}.`,
          "",
          `Entry state: **${markdownValue(committed.entryState)}**. The classification grants no approval, applicability decision, activation, execution, or implementation authority.`,
          "",
          "Next: use **`@gaep /continue`** after the conversational applicability checkpoint is installed.",
        ].join("\n"))
        return classificationMetadata(classificationState)
      }
      const candidate = answerInitiativeClassification(classificationState, request.prompt)
      classificationState = candidate.state
      if (candidate.challenge) {
        response.markdown(classificationQuestionMarkdown(classificationState, candidate.challenge))
        return classificationMetadata(classificationState)
      }
      response.progress(`Asking ${classificationState.advisor.agentLabel} · ${classificationState.advisor.modelLabel} to challenge and structure this Initiative classification`)
      const abort = new AbortController()
      const cancellation = token.onCancellationRequested(() => abort.abort())
      try {
        const assessment = await options.challengeAnswer({
          advisor: classificationState.advisor,
          question: initiativeClassificationQuestion(classificationState),
          acceptedAnswers: {
            product: classificationState.product,
            initiative: classificationState.initiative,
            revisionBinding: {
              initiativeRevision: classificationState.initiativeRevision,
              productRevision: classificationState.productRevision,
            },
          },
          userAnswer: request.prompt,
          previousAssessment: classificationState.pending,
        }, abort.signal)
        classificationState = assessInitiativeClassification(classificationState, request.prompt, assessment)
        response.markdown(classificationAssessedMarkdown(classificationState))
      } catch {
        response.markdown(classificationQuestionMarkdown(
          classificationState,
          "The selected advisor did not return a valid governed classification. Nothing was accepted or persisted. Add detail, retry, or switch `/agent` or `/model`.",
        ))
        response.button({ command: "gaep.showDiagnostics", title: "Show Diagnostics" })
      } finally {
        cancellation.dispose()
      }
      return classificationMetadata(classificationState)
    }
    if (initiativeState && !["committed", "cancelled"].includes(initiativeState.phase)) {
      if (command === "cancel") {
        initiativeState = { ...initiativeState, phase: "cancelled" }
        response.markdown("The Initiative chat draft was discarded. No governed Initiative was created or changed.")
        return initiativeMetadata(initiativeState)
      }
      if (command === "advisor" || command === "agent" || command === "model") {
        const advisor = command === "model"
          ? await options.selectModel(initiativeState.advisor)
          : command === "agent"
            ? await options.selectAgent(initiativeState.advisor)
            : await options.selectAdvisor(initiativeState.advisor)
        if (!advisor) {
          response.markdown("Agent/model selection was cancelled. The Initiative draft was preserved.")
          return initiativeMetadata(initiativeState)
        }
        if (sameAdvisor(initiativeState.advisor, advisor)) {
          response.markdown(initiativeQuestionMarkdown(initiativeState, "The selected agent and model are already active."))
          return initiativeMetadata(initiativeState)
        }
        const pending = initiativeState.pending
        initiativeState = changeInitiativeAdvisor(initiativeState, advisor, true)
        if (pending && !sameAdvisor(pending.advisor, advisor)) {
          const question = currentInitiativeQuestion(initiativeState)!
          response.progress(`Re-evaluating the Initiative answer with ${advisor.agentLabel} · ${advisor.modelLabel}`)
          const abort = new AbortController()
          const cancellation = token.onCancellationRequested(() => abort.abort())
          try {
            const assessment = await options.challengeAnswer({
              advisor,
              question,
              acceptedAnswers: initiativeState.answers,
              userAnswer: pending.originalAnswer,
              previousAssessment: pending,
            }, abort.signal)
            initiativeState = assessInitiativeAnswer(initiativeState, pending.originalAnswer, assessment)
            response.markdown(initiativeAssessedMarkdown(initiativeState))
          } catch {
            response.markdown(`${initiativeAssessedMarkdown(initiativeState)}\n\nRe-evaluation failed; GAEP did not advance.`)
          } finally {
            cancellation.dispose()
          }
          return initiativeMetadata(initiativeState)
        }
        initiativeState = changeInitiativeAdvisor(initiativeState, advisor)
        response.markdown(initiativeQuestionMarkdown(initiativeState, "The new advisor applies to this and later unaccepted Initiative answers."))
        return initiativeMetadata(initiativeState)
      }
      if (command === "back") {
        initiativeState = backInitiative(initiativeState)
        response.markdown(initiativeQuestionMarkdown(initiativeState, "The previous Initiative answer was removed."))
        return initiativeMetadata(initiativeState)
      }
      if (command === "review") {
        response.markdown(initiativeState.phase === "review"
          ? initiativeReviewMarkdown(initiativeState)
          : initiativeQuestionMarkdown(initiativeState, "Complete the remaining Initiative questions before review."))
        return initiativeMetadata(initiativeState)
      }
      if (command === "accept") {
        if (!initiativeState.pending) {
          response.markdown(initiativeQuestionMarkdown(initiativeState, "There is no Initiative proposal awaiting acceptance."))
          return initiativeMetadata(initiativeState)
        }
        initiativeState = acceptInitiativeAnswer(initiativeState)
        response.markdown(initiativeState.phase === "review"
          ? initiativeReviewMarkdown(initiativeState)
          : initiativeQuestionMarkdown(initiativeState, "The previous Initiative proposal was explicitly accepted."))
        return initiativeMetadata(initiativeState)
      }
      if (command === "commit") {
        if (initiativeState.phase !== "review") {
          response.markdown(initiativeQuestionMarkdown(initiativeState, "The Initiative draft is incomplete."))
          return initiativeMetadata(initiativeState)
        }
        if (request.prompt.trim() !== "CONFIRM") {
          response.markdown(`${initiativeReviewMarkdown(initiativeState)}\n\nCommit was not performed. Send exactly **\`@gaep /commit CONFIRM\`**.`)
          return initiativeMetadata(initiativeState)
        }
        response.progress("Creating the governed proposed Initiative")
        const initiative = await options.commitInitiative(initiativeInput(initiativeState))
        initiativeState = { ...initiativeState, phase: "committed" }
        response.markdown([
          `Proposed Initiative **${markdownValue(initiative.title)}** was created at revision ${initiative.revision}.`,
          "",
          "It remains proposed and grants no execution or implementation authority.",
          "",
          "Next: run **`@gaep /continue`** to classify this Initiative conversationally.",
        ].join("\n"))
        return initiativeMetadata(initiativeState)
      }
      const candidate = answerInitiative(initiativeState, request.prompt)
      initiativeState = candidate.state
      if (candidate.challenge || candidate.value === undefined) {
        response.markdown(initiativeQuestionMarkdown(initiativeState, candidate.challenge))
        return initiativeMetadata(initiativeState)
      }
      const question = currentInitiativeQuestion(initiativeState)!
      response.progress(`Asking ${initiativeState.advisor.agentLabel} · ${initiativeState.advisor.modelLabel} to challenge this Initiative answer`)
      const abort = new AbortController()
      const cancellation = token.onCancellationRequested(() => abort.abort())
      try {
        const assessment = await options.challengeAnswer({
          advisor: initiativeState.advisor,
          question,
          acceptedAnswers: initiativeState.answers,
          userAnswer: request.prompt,
          previousAssessment: initiativeState.pending,
        }, abort.signal)
        initiativeState = assessInitiativeAnswer(initiativeState, request.prompt, assessment)
        response.markdown(initiativeAssessedMarkdown(initiativeState))
      } catch {
        response.markdown(initiativeQuestionMarkdown(initiativeState, "The advisor did not return a valid Initiative assessment. GAEP did not advance."))
        response.button({ command: "gaep.showDiagnostics", title: "Show Diagnostics" })
      } finally {
        cancellation.dispose()
      }
      return initiativeMetadata(initiativeState)
    }
    if (!state || state.phase === "cancelled" || state.phase === "committed") {
      response.markdown(`${helpMarkdown()}\n\nStart with **\`@gaep /initialize\`** for a new Product or **\`@gaep /revise\`** for an existing Product.`)
      return
    }
    if (command === "cancel") {
      state = { ...state, phase: "cancelled" }
      response.markdown("The conversational draft was discarded. No governed Product state was created or changed.")
      return metadata(state)
    }
    if (command === "advisor" || command === "agent" || command === "model") {
      const advisor = command === "model"
        ? await options.selectModel(state.advisor)
        : command === "agent"
          ? await options.selectAgent(state.advisor)
          : await options.selectAdvisor(state.advisor)
      if (!advisor) {
        response.markdown("Agent/model selection was cancelled. The current draft and advisor were preserved.")
        return metadata(state)
      }
      if (sameAdvisor(state.advisor, advisor)) {
        response.markdown(`${questionMarkdown(state, "The selected agent and model are already active.")}\n\nUse \`/agent\` to change provider or \`/model\` to change its model.`)
        return metadata(state)
      }
      const pending = state.pending
      state = changeProductChatAdvisor(state, advisor, true)
      if (pending) {
        response.progress(`Re-evaluating the current answer with ${advisor.agentLabel} · ${advisor.modelLabel}`)
        const abort = new AbortController()
        const cancellation = token.onCancellationRequested(() => abort.abort())
        try {
          const question = currentProductInitializationQuestion(state)!
          const assessment = await options.challengeAnswer({
            advisor: state.advisor,
            question,
            acceptedAnswers: state.answers,
            userAnswer: pending.originalAnswer,
            previousAssessment: pending,
          }, abort.signal)
          state = recordProductAnswerAssessment(state, pending.originalAnswer, assessment)
          response.markdown([
            `Agent/model changed to **${markdownValue(advisor.agentLabel)} · ${markdownValue(advisor.modelLabel)}**. The current answer was re-evaluated without advancing the Product step.`,
            "",
            assessedAnswerMarkdown(state),
          ].join("\n"))
        } catch {
          response.markdown([
            `Agent/model changed to **${markdownValue(advisor.agentLabel)} · ${markdownValue(advisor.modelLabel)}**, but re-evaluation did not complete.`,
            "",
            "The previous unaccepted proposal remains visible under its original advisor. Reply with a revision to retry using the new selection; GAEP did not advance.",
            "",
            assessedAnswerMarkdown(state),
          ].join("\n"))
          response.button({ command: "gaep.showDiagnostics", title: "Show Diagnostics" })
        } finally {
          cancellation.dispose()
        }
        return metadata(state)
      }
      state = changeProductChatAdvisor(state, advisor)
      response.markdown([
        `Agent/model changed to **${markdownValue(advisor.agentLabel)} · ${markdownValue(advisor.modelLabel)}**.`,
        "",
        questionMarkdown(state, "The new selection applies to this and all later unaccepted answers."),
      ].join("\n"))
      return metadata(state)
    }
    if (command === "back") {
      state = goBackProductInitialization(state)
      response.markdown(questionMarkdown(state, "The previous answer was removed. Provide its replacement."))
      return metadata(state)
    }
    if (command === "review") {
      if (state.phase !== "review") {
        response.markdown(questionMarkdown(state, "Complete the remaining questions before review."))
        return metadata(state)
      }
      response.markdown(reviewMarkdown(state))
      return metadata(state)
    }
    if (command === "accept") {
      if (state.phase !== "awaiting-approval" || !state.pending) {
        response.markdown(questionMarkdown(state, "There is no AI-assisted proposal awaiting approval. Answer the current question first."))
        return metadata(state)
      }
      state = acceptProductAnswer(state)
      if (state.phase === "review") response.markdown(reviewMarkdown(state))
      else response.markdown(questionMarkdown(state, "The previous proposal was explicitly accepted. Continue with the next question."))
      return metadata(state)
    }
    if (command === "commit") {
      if (state.phase !== "review") {
        response.markdown(questionMarkdown(state, "The draft is incomplete and cannot be committed."))
        return metadata(state)
      }
      if (request.prompt.trim() !== "CONFIRM") {
        response.markdown(`${reviewMarkdown(state)}\n\nCommit was not performed. Send exactly **\`@gaep /commit CONFIRM\`**.`)
        return metadata(state)
      }
      const input = productInitializationInput(state) as ProductInput
      response.progress(state.workflow === "revision" ? "Creating the audited Product revision" : "Creating the governed Product record")
      const product = state.workflow === "revision"
        ? await options.reviseProduct(input, state.baseProductRevision!)
        : await options.commitProduct(input)
      state = { ...state, phase: "committed" }
      response.markdown(state.workflow === "revision" ? [
        `Governed Product **${markdownValue(product.name)}** was revised successfully at revision **${"revision" in product ? product.revision : state.baseProductRevision! + 1}**.`,
        "",
        "The Product identity was preserved, the prior revision remains in history, and an audit event records the explicit correction.",
        "",
        "Next: use **`@gaep /continue`** to start the guided Initiative checkpoint.",
      ].join("\n") : [
        `Governed Product **${markdownValue(product.name)}** was initialized successfully.`,
        "",
        "The chat transcript is not the source of truth; `.gaep` now is. Candidate attachments were not silently imported or granted authority.",
        "",
        "Next: create an Initiative and run governed Source Intake for the attached Product documents.",
      ].join("\n"))
      return metadata(state)
    }
    if (state.phase === "review") {
      response.markdown(reviewMarkdown(state))
      return metadata(state)
    }

    const result = answerProductInitialization(state, request.prompt, attached)
    state = result.state
    if (result.challenge || result.value === undefined) {
      response.markdown(questionMarkdown(state, result.challenge))
      return metadata(state)
    }
    response.progress(`Asking ${state.advisor.agentLabel} · ${state.advisor.modelLabel} to challenge this candidate answer`)
    const abort = new AbortController()
    const cancellation = token.onCancellationRequested(() => abort.abort())
    try {
      const question = currentProductInitializationQuestion(state)!
      const assessment = await options.challengeAnswer({
        advisor: state.advisor,
        question,
        acceptedAnswers: state.answers,
        userAnswer: request.prompt,
        previousAssessment: state.pending,
      }, abort.signal)
      state = recordProductAnswerAssessment(state, request.prompt, assessment)
      response.markdown(assessedAnswerMarkdown(state))
    } catch {
      response.markdown(questionMarkdown(
        state,
        "The selected advisor did not return a valid governed assessment. This answer was not accepted and GAEP did not advance. Retry the answer, use `/agent` to change provider, or `/model` to change its model.",
      ))
      response.button({ command: "gaep.showDiagnostics", title: "Show Diagnostics" })
    } finally {
      cancellation.dispose()
    }
    return metadata(state)
  }

  const participant = vscode.chat.createChatParticipant(gaepChatParticipantId, handler)
  participant.iconPath = vscode.Uri.joinPath(context.extensionUri, "media", "gaep.svg")
  participant.followupProvider = {
    provideFollowups: (result) => {
      const classification = result.metadata?.gaepInitiativeClassification
      if (isInitiativeClassificationChatState(classification)) {
        if (classification.phase === "review") return [
          { prompt: "/commit CONFIRM", label: "Record exact classification" },
          { prompt: "/back", label: "Revise classification" },
        ]
        if (classification.phase === "awaiting-approval") return [
          { prompt: "/accept", label: "Accept classification" },
          { prompt: "/agent", label: "Switch agent" },
          { prompt: "/model", label: "Switch model" },
        ]
        if (classification.phase === "collecting") return [
          { prompt: "/agent", label: "Switch agent" },
          { prompt: "/model", label: "Switch model" },
          { prompt: "/continue", label: "Resume classification" },
        ]
        return [{ prompt: "/continue", label: "Continue lifecycle" }]
      }
      const initiative = result.metadata?.gaepInitiative
      if (isInitiativeChatState(initiative)) {
        if (initiative.phase === "review") return [
          { prompt: "/commit CONFIRM", label: "Create proposed Initiative" },
          { prompt: "/back", label: "Revise last answer" },
        ]
        if (initiative.phase === "awaiting-approval") return [
          { prompt: "/accept", label: "Accept and continue" },
          { prompt: "/agent", label: "Switch agent" },
          { prompt: "/model", label: "Switch model" },
        ]
        if (initiative.phase === "collecting") return [
          { prompt: "/agent", label: "Switch agent" },
          { prompt: "/model", label: "Switch model" },
          { prompt: "/continue", label: "Show Initiative progress" },
        ]
        return [{ prompt: "/continue", label: "Continue lifecycle" }]
      }
      const state = result.metadata?.gaepProductInitialization
      if (!isProductInitializationChatState(state)) return [{ prompt: "/initialize", label: "Initialize Product" }]
      if (state.phase === "review") return [
        { prompt: "/commit CONFIRM", label: "Commit exact draft" },
        { prompt: "/back", label: "Revise last answer" },
      ]
      if (state.phase === "awaiting-approval") return [
        { prompt: "/accept", label: "Accept and continue" },
        { prompt: "/agent", label: "Switch agent" },
        { prompt: "/model", label: "Switch model" },
      ]
      if (state.phase === "collecting") return [
        { prompt: "/agent", label: "Switch agent" },
        { prompt: "/model", label: "Switch model" },
        { prompt: "/status", label: "Show progress" },
      ]
      return [{ prompt: "/status", label: "Show Product status" }]
    },
  }
  context.subscriptions.push(participant)
  return participant
}
