import { describe, expect, it } from "vitest"

import {
  acceptInitiativeAnswer,
  answerInitiative,
  assessInitiativeAnswer,
  assessInitiativeAnswerWithAutomaticRepair,
  backInitiative,
  currentInitiativeQuestion,
  initiativeAdvisorAcceptedAnswers,
  initiativeInput,
  initiativeProgress,
  isInitiativeChatState,
  startInitiativeChat,
} from "./interactive-initiative-chat.js"

const advisor = {
  adapterId: "gaep.codex-cli" as const,
  agentId: "codex-cli" as const,
  agentLabel: "Codex" as const,
  modelId: "gpt-5.6-sol",
  modelLabel: "GPT-5.6 Sol",
  modelTruthClass: "observed" as const,
}

const answers = [
  "Establish the maritime schedule planning MVP",
  "Produce an accepted pre-implementation package for the first voyage schedule planning workflow.",
  "Source intake and business understanding\nArchitecture and backlog through implementation readiness",
  "Production implementation\nRelease and deployment\nCross-IDE acceptance",
] as const

function assess(state: ReturnType<typeof startInitiativeChat>, raw: string) {
  const candidate = answerInitiative(state, raw)
  expect(candidate.challenge).toBeUndefined()
  const assessed = assessInitiativeAnswer(candidate.state, raw, {
    assessment: "The bounded answer is reviewable.",
    strengths: ["It preserves the intended boundary."],
    gaps: [],
    proposedAnswer: raw,
  })
  expect(assessed.step).toBe(state.step)
  return acceptInitiativeAnswer(assessed)
}

describe("interactive Initiative chat", () => {
  it("requires assessment and explicit acceptance for all four fields", () => {
    let state = startInitiativeChat(advisor)
    expect(initiativeProgress(state)).toBe("0/4")
    for (const answer of answers) state = assess(state, answer)
    expect(state.phase).toBe("review")
    expect(initiativeInput(state)).toEqual({
      title: answers[0],
      outcome: answers[1],
      scope: answers[2].split("\n"),
      exclusions: answers[3].split("\n"),
    })
    expect(isInitiativeChatState(state)).toBe(true)
  })

  it("preserves commas inside scope items and rejects comma-only ambiguity", () => {
    let state = startInitiativeChat(advisor)
    state = assess(state, answers[0])
    state = assess(state, answers[1])
    expect(answerInitiative(state, "Research, architecture, and backlog, Implementation readiness").challenge).toMatch(/own line/i)
    const candidate = answerInitiative(state, "Research, architecture, and backlog\nImplementation readiness")
    expect(candidate.value).toEqual(["Research, architecture, and backlog", "Implementation readiness"])
  })

  it("backtracks without creating governed state", () => {
    let state = startInitiativeChat(advisor)
    state = assess(state, answers[0])
    state = backInitiative(state)
    expect(state.step).toBe(0)
    expect(state.answers.title).toBeUndefined()
    expect(currentInitiativeQuestion(state)?.key).toBe("title")
  })

  it("rejects unresolved template placeholders in Initiative text fields", () => {
    const state = startInitiativeChat(advisor)
    expect(answerInitiative(state, "Improve [specific outcome] for [target actor]").challenge)
      .toMatch(/concrete, reviewable/i)
  })

  it("automatically repairs a placeholder advisor proposal before showing it to the human", async () => {
    const state = startInitiativeChat(advisor)
    const proposals = [
      "Improve [specific outcome] for [target actor] in [bounded workflow]",
      "Establish governed service-to-voyage schedule planning for maritime planners",
    ]
    const result = await assessInitiativeAnswerWithAutomaticRepair(
      state,
      "Please suggest the strongest title from the Product context",
      async ({ attempt }) => ({
        assessment: "A context-grounded candidate title is available.",
        strengths: [],
        gaps: [],
        proposedAnswer: proposals[attempt - 1]!,
      }),
    )
    expect(result.attempts).toBe(2)
    expect(result.state.pending?.proposedAnswer).toBe(proposals[1])
  })

  it("projects governed Product context into Initiative advisory turns", () => {
    expect(initiativeAdvisorAcceptedAnswers({}, {
      revision: 3,
      input: {
        name: "Marine Shipping Platform",
        summary: "Plans and monitors maritime services and voyage schedules.",
        problem: "Schedule data is fragmented.",
        affectedUsers: "Service planners and vessel planners",
        desiredOutcome: "Create one traceable planning workflow.",
        successSignals: ["A planner can produce a reviewed schedule draft"],
        firstWorkflow: "Service-to-voyage schedule planning",
        exclusions: ["Production publication"],
        profile: "data-sensitive",
      },
    })).toMatchObject({
      acceptedInitiativeFields: {},
      governedProduct: {
        revision: 3,
        name: "Marine Shipping Platform",
        firstWorkflow: "Service-to-voyage schedule planning",
      },
    })
  })
})
