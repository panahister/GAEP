import { describe, expect, it, vi } from "vitest"

import type { startManagedClaudeContextRun, startManagedCodexStagedRun } from "@gaep/agent-sdk"

import type { ProductChatAdvisorSelection } from "./interactive-product-chat.js"
import {
  buildProductAnswerChallengePrompt,
  parseProductAnswerAssessment,
  ProductChatAdvisorError,
  runProductAnswerChallenge,
  type ProductChatAdvisorDependencies,
} from "./product-chat-advisor.js"

const assessmentJson = JSON.stringify({
  assessment: "The answer names the domain but not the decision outcome.",
  strengths: ["The domain is explicit."],
  gaps: ["The affected actor is missing."],
  followUpQuestion: "Who makes the scheduling decision?",
  proposedAnswer: "A maritime scheduling platform for operations teams to plan and monitor voyage schedules.",
})

const claude: ProductChatAdvisorSelection = {
  adapterId: "gaep.claude-code-cli",
  agentId: "claude-code-cli",
  agentLabel: "Claude Code",
  modelId: "sonnet",
  modelLabel: "Sonnet",
  modelTruthClass: "provider-declared",
}

const codex: ProductChatAdvisorSelection = {
  adapterId: "gaep.codex-cli",
  agentId: "codex-cli",
  agentLabel: "Codex",
  modelId: "gpt-5.6-terra",
  modelLabel: "GPT-5.6 Terra",
  modelTruthClass: "observed",
}

function request(advisor: ProductChatAdvisorSelection) {
  return {
    advisor,
    question: { key: "summary" as const, title: "One-sentence summary", prompt: "Describe the Product." },
    acceptedAnswers: { name: "Marine Scheduler" },
    userAnswer: "A platform for voyage schedules.",
  }
}

function event(text: string) {
  return {
    type: "output-delta" as const,
    channel: "assistant" as const,
    text,
    sequence: 0,
    observedAt: "2026-08-01T00:00:00.000Z",
  }
}

function dependencies(): {
  dependencies: ProductChatAdvisorDependencies
  startClaude: ReturnType<typeof vi.fn>
  startCodex: ReturnType<typeof vi.fn>
  discard: ReturnType<typeof vi.fn>
} {
  const discard = vi.fn(async () => ({ portable: {}, local: {} }))
  const startClaude = vi.fn(async () => ({
    events: { async *[Symbol.asyncIterator]() {} },
    completion: Promise.resolve({
      terminationCause: "normal",
      result: {
        portable: { terminalDisposition: "completed", events: [event(assessmentJson)] },
        local: {},
      },
    }),
    cancel: vi.fn(async () => undefined),
  }))
  const startCodex = vi.fn(async () => ({
    events: { async *[Symbol.asyncIterator]() {} },
    completion: Promise.resolve({
      result: { portable: { terminalDisposition: "completed", events: [event(assessmentJson)] }, local: {} },
      discard,
    }),
    cancel: vi.fn(async () => undefined),
  }))
  return {
    startClaude,
    startCodex,
    discard,
    dependencies: {
      startClaude: startClaude as unknown as typeof startManagedClaudeContextRun,
      startCodex: startCodex as unknown as typeof startManagedCodexStagedRun,
      createEmptySource: async () => "/tmp/gaep-test-advisor-source",
      removeEmptySource: async () => undefined,
    },
  }
}

describe("Product Chat AI advisor", () => {
  it("builds a bounded critical prompt with human-approval authority", () => {
    const prompt = buildProductAnswerChallengePrompt(request(claude))
    expect(prompt).toContain("Challenge the candidate answer constructively")
    expect(prompt).toContain("Marine Scheduler")
    expect(prompt).toContain("human must explicitly accept")
    expect(prompt).toContain("same language")
  })

  it("parses only the governed structured response shape", () => {
    expect(parseProductAnswerAssessment(`\n\`\`\`json\n${assessmentJson}\n\`\`\``)).toMatchObject({
      gaps: ["The affected actor is missing."],
      proposedAnswer: "A maritime scheduling platform for operations teams to plan and monitor voyage schedules.",
    })
    expect(() => parseProductAnswerAssessment("Looks good to me.")).toThrow(ProductChatAdvisorError)
    expect(() => parseProductAnswerAssessment('{"assessment":"fine"}')).toThrow(/strengths/)
  })

  it("dispatches a Claude selection to the real managed-Claude boundary", async () => {
    const setup = dependencies()
    const result = await runProductAnswerChallenge(
      { executable: "/verified/claude" }, request(claude), new AbortController().signal, setup.dependencies,
    )
    expect(result.assessment).toMatch(/names the domain/)
    expect(setup.startClaude).toHaveBeenCalledOnce()
    expect(setup.startCodex).not.toHaveBeenCalled()
    expect(setup.startClaude.mock.calls[0]?.[0]).toMatchObject({
      executable: "/verified/claude",
      model: "sonnet",
    })
  })

  it("dispatches Codex with commands and file changes denied, then discards the empty stage", async () => {
    const setup = dependencies()
    await runProductAnswerChallenge(
      { executable: "/verified/codex" }, request(codex), new AbortController().signal, setup.dependencies,
    )
    expect(setup.startCodex).toHaveBeenCalledOnce()
    expect(setup.startClaude).not.toHaveBeenCalled()
    expect(setup.startCodex.mock.calls[0]?.[0]).toMatchObject({
      executable: "/verified/codex",
      model: "gpt-5.6-terra",
      policy: { allowCommands: false, allowFileChanges: false },
    })
    expect(setup.discard).toHaveBeenCalledOnce()
  })
})
