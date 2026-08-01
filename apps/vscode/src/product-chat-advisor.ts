import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  startManagedClaudeContextRun,
  startManagedCodexStagedRun,
  type ExecutableFingerprint,
  type ManagedRuntimeEvent,
} from "@gaep/agent-sdk"

import type {
  ProductAnswerAssessment,
  ProductChatAdvisorSelection,
} from "./interactive-product-chat.js"

export interface ProductAnswerChallengeRequest {
  advisor: ProductChatAdvisorSelection
  question: { key: string; title: string; prompt: string }
  acceptedAnswers: object
  userAnswer: string
  previousAssessment?: {
    proposedAnswer: string
    gaps: string[]
    followUpQuestion?: string
  }
}

export interface ProductChatAdvisorRuntime {
  executable: string
  runtimeVersion?: string
  executableFingerprint?: ExecutableFingerprint
}

export interface ProductChatAdvisorDependencies {
  startClaude: typeof startManagedClaudeContextRun
  startCodex: typeof startManagedCodexStagedRun
  createEmptySource(): Promise<string>
  removeEmptySource(path: string): Promise<void>
}

const defaultDependencies: ProductChatAdvisorDependencies = {
  startClaude: startManagedClaudeContextRun,
  startCodex: startManagedCodexStagedRun,
  createEmptySource: () => mkdtemp(join(tmpdir(), "gaep-product-advisor-source-")),
  removeEmptySource: (path) => rm(path, { recursive: true, force: true }),
}

export class ProductChatAdvisorError extends Error {
  constructor(
    readonly code: "cancelled" | "provider-unavailable" | "provider-failed" | "invalid-response",
    message: string,
  ) {
    super(message)
    this.name = "ProductChatAdvisorError"
  }
}

function bounded(value: unknown, label: string, maximum: number): string {
  if (typeof value !== "string") throw new ProductChatAdvisorError("invalid-response", `${label} is missing from the advisor response.`)
  const result = value.trim()
  if (!result || Buffer.byteLength(result) > maximum) {
    throw new ProductChatAdvisorError("invalid-response", `${label} is empty or exceeds its governed bound.`)
  }
  return result
}

function boundedList(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length > 8 || value.some((item) => typeof item !== "string")) {
    throw new ProductChatAdvisorError("invalid-response", `${label} must be a bounded list of text items.`)
  }
  return value.map((item, index) => bounded(item, `${label} item ${index + 1}`, 2_048))
}

export function parseProductAnswerAssessment(output: string): ProductAnswerAssessment {
  if (Buffer.byteLength(output) > 256 * 1_024) {
    throw new ProductChatAdvisorError("invalid-response", "The advisor response exceeded its governed bound.")
  }
  const first = output.indexOf("{")
  const last = output.lastIndexOf("}")
  if (first < 0 || last <= first) {
    throw new ProductChatAdvisorError("invalid-response", "The advisor did not return the required structured assessment.")
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(output.slice(first, last + 1))
  } catch {
    throw new ProductChatAdvisorError("invalid-response", "The advisor returned malformed structured assessment data.")
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ProductChatAdvisorError("invalid-response", "The advisor assessment must be a JSON object.")
  }
  const record = parsed as Record<string, unknown>
  const allowedKeys = new Set(["assessment", "strengths", "gaps", "followUpQuestion", "proposedAnswer"])
  if (Object.keys(record).some((key) => !allowedKeys.has(key))) {
    throw new ProductChatAdvisorError("invalid-response", "The advisor response contained an unsupported field.")
  }
  const followUpQuestion = record.followUpQuestion === null || record.followUpQuestion === undefined
    ? undefined
    : bounded(record.followUpQuestion, "followUpQuestion", 4_096)
  return {
    assessment: bounded(record.assessment, "assessment", 8_192),
    strengths: boundedList(record.strengths, "strengths"),
    gaps: boundedList(record.gaps, "gaps"),
    followUpQuestion,
    proposedAnswer: bounded(record.proposedAnswer, "proposedAnswer", 64 * 1_024),
  }
}

function priorAnswers(answers: object): string {
  const entries = Object.entries(answers)
  return entries.length === 0 ? "None accepted yet." : JSON.stringify(Object.fromEntries(entries), null, 2)
}

export function buildProductAnswerChallengePrompt(request: ProductAnswerChallengeRequest): string {
  const previous = request.previousAssessment
    ? [
        "Previous advisory round:",
        JSON.stringify({
          proposedAnswer: request.previousAssessment.proposedAnswer,
          gaps: request.previousAssessment.gaps,
          followUpQuestion: request.previousAssessment.followUpQuestion ?? null,
        }, null, 2),
      ].join("\n")
    : "No previous advisory round for this field."
  const proposedAnswerRules = request.question.key === "initiative-classification"
    ? [
        "Write assessment, strengths, gaps, and followUpQuestion in the same language as the user's latest input.",
        "For this Initiative Classification field only, proposedAnswer must be a JSON-encoded string whose decoded value is exactly the complete JSON classification requested by the current question.",
        "Keep the classification property names and enum tokens exactly as specified by the current question; do not translate or paraphrase them.",
      ]
    : [
        "Return the proposed answer in the same language as the user's latest input.",
        "For list fields, proposedAnswer must contain exactly one item per line. Never use commas as item separators and never return an array for proposedAnswer; commas inside an item are ordinary content.",
      ]
  return [
    "You are the critical Product-discovery advisor inside GAEP.",
    "Challenge the candidate answer constructively. Do not merely approve, paraphrase, or praise it.",
    "Identify missing specificity, assumptions, affected actors, measurable consequences, boundaries, or contradictions relevant to this exact field.",
    "Improve only the current field; do not invent unsupported facts. Preserve useful user intent.",
    "Ask at most one high-value follow-up question. If the proposal is already decision-ready, use null.",
    ...proposedAnswerRules,
    "Return exactly one JSON object and no Markdown with this shape:",
    '{"assessment":"...","strengths":["..."],"gaps":["..."],"followUpQuestion":"... or null","proposedAnswer":"..."}',
    "This output is advisory only. The human must explicitly accept it before GAEP records the field.",
    "",
    `Current field: ${request.question.title} (${String(request.question.key)})`,
    `Question: ${request.question.prompt}`,
    "Previously accepted Product fields:",
    priorAnswers(request.acceptedAnswers),
    previous,
    "Latest user input:",
    request.userAnswer.trim(),
  ].join("\n")
}

function assistantOutput(events: readonly ManagedRuntimeEvent[]): string {
  return events
    .filter((event): event is Extract<ManagedRuntimeEvent, { type: "output-delta" }> =>
      event.type === "output-delta" && event.channel === "assistant")
    .map((event) => event.text)
    .join("")
    .trim()
}

function abortListener(signal: AbortSignal, cancel: () => Promise<void>): () => void {
  const onAbort = (): void => { void cancel() }
  signal.addEventListener("abort", onAbort, { once: true })
  return () => signal.removeEventListener("abort", onAbort)
}

async function runClaude(
  runtime: ProductChatAdvisorRuntime,
  request: ProductAnswerChallengeRequest,
  signal: AbortSignal,
  dependencies: ProductChatAdvisorDependencies,
): Promise<string> {
  const handle = await dependencies.startClaude({
    executable: runtime.executable,
    executableFingerprint: runtime.executableFingerprint,
    runtimeVersion: runtime.runtimeVersion,
    model: request.advisor.modelId,
    objective: "Return a rigorous structured assessment and improved candidate answer for one Product-discovery field.",
    contextPack: buildProductAnswerChallengePrompt(request),
    timeoutMs: 120_000,
    maxOutputBytes: 512 * 1_024,
    maxLineBytes: 256 * 1_024,
  })
  const removeAbort = abortListener(signal, () => handle.cancel("The human cancelled the Product advisory turn"))
  try {
    const completed = await handle.completion
    if (signal.aborted || completed.terminationCause === "cancel-request") {
      throw new ProductChatAdvisorError("cancelled", "The Product advisory turn was cancelled.")
    }
    if (completed.result.portable.terminalDisposition !== "completed") {
      const authUnavailable = completed.result.portable.events.some((event) =>
        event.type === "error" && event.code === "GAEP_CLAUDE_AUTH_UNAVAILABLE")
      throw new ProductChatAdvisorError(
        "provider-failed",
        authUnavailable
          ? "Claude Code authentication is unavailable for the governed advisory turn."
          : "Claude Code did not complete the governed advisory turn.",
      )
    }
    return assistantOutput(completed.result.portable.events)
  } finally {
    removeAbort()
  }
}

async function runCodex(
  runtime: ProductChatAdvisorRuntime,
  request: ProductAnswerChallengeRequest,
  signal: AbortSignal,
  dependencies: ProductChatAdvisorDependencies,
): Promise<string> {
  const emptySource = await dependencies.createEmptySource()
  try {
    const handle = await dependencies.startCodex({
      executable: runtime.executable,
      runtimeVersion: runtime.runtimeVersion,
      sourceWorkspacePath: emptySource,
      model: request.advisor.modelId,
      prompt: buildProductAnswerChallengePrompt(request),
      developerInstructions: "Perform only the bounded GAEP Product-discovery critique. Do not use shell, files, web, MCP, apps, subagents, memories, or external effects. Return only the requested JSON object.",
      timeoutMs: 120_000,
      policy: { allowCommands: false, allowFileChanges: false },
    })
    const removeAbort = abortListener(signal, () => handle.cancel("The human cancelled the Product advisory turn"))
    try {
      const review = await handle.completion
      const output = assistantOutput(review.result.portable.events)
      const disposition = review.result.portable.terminalDisposition
      await review.discard()
      if (signal.aborted || disposition === "cancelled" || disposition === "interrupted") {
        throw new ProductChatAdvisorError("cancelled", "The Product advisory turn was cancelled.")
      }
      if (disposition !== "completed") {
        throw new ProductChatAdvisorError("provider-failed", "Codex did not complete the governed advisory turn.")
      }
      return output
    } finally {
      removeAbort()
    }
  } finally {
    await dependencies.removeEmptySource(emptySource).catch(() => undefined)
  }
}

export async function runProductAnswerChallenge(
  runtime: ProductChatAdvisorRuntime,
  request: ProductAnswerChallengeRequest,
  signal: AbortSignal,
  dependencies: ProductChatAdvisorDependencies = defaultDependencies,
): Promise<ProductAnswerAssessment> {
  if (signal.aborted) throw new ProductChatAdvisorError("cancelled", "The Product advisory turn was cancelled.")
  if (!runtime.executable.trim()) {
    throw new ProductChatAdvisorError("provider-unavailable", "The selected advisor executable is unavailable.")
  }
  const output = request.advisor.adapterId === "gaep.claude-code-cli"
    ? await runClaude(runtime, request, signal, dependencies)
    : await runCodex(runtime, request, signal, dependencies)
  return parseProductAnswerAssessment(output)
}
