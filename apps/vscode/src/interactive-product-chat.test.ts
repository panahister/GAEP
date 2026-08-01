import { describe, expect, it } from "vitest"

import {
  acceptProductAnswer,
  answerProductInitialization,
  changeProductChatAdvisor,
  currentProductInitializationQuestion,
  editProductRevisionField,
  goBackProductInitialization,
  isProductInitializationChatState,
  preferredProductChatAdvisor,
  productInitializationInput,
  productInitializationProgress,
  recordProductAnswerAssessment,
  selectProductChatAdvisorForCommand,
  startProductInitialization,
  startProductRevision,
  type ProductChatAdvisorSelection,
} from "./interactive-product-chat.js"

const claude: ProductChatAdvisorSelection = {
  adapterId: "gaep.claude-code-cli",
  agentId: "claude-code-cli",
  agentLabel: "Claude Code",
  modelId: "sonnet",
  modelLabel: "Sonnet alias",
  modelTruthClass: "provider-declared",
  runtimeVersion: "2.1.220",
}

const codex: ProductChatAdvisorSelection = {
  adapterId: "gaep.codex-cli",
  agentId: "codex-cli",
  agentLabel: "Codex",
  modelId: "gpt-5.6-terra",
  modelLabel: "GPT-5.6 Terra",
  modelTruthClass: "observed",
}

const answers = [
  "Marine Shipping Services & Schedules",
  "A standalone platform for planning and monitoring maritime voyage schedules.",
  "Schedules are fragmented across spreadsheets, creating inconsistent data and slow operational recovery.",
  "Line managers, operations officers, schedule planners, and customer service teams.",
  "Create one authoritative schedule source and reduce manual operational intervention.",
  "70% fewer manual interventions\nSame-session feasibility output\nPlanned-versus-actual visibility",
  "An editor creates a service and voyage, an analyst simulates a schedule change, and a viewer confirms the result.",
  "Live AIS tracking\nAutomated deviation recovery\nCost posting",
  "internal-tool",
] as const

function assessAndAccept(state: ReturnType<typeof startProductInitialization>, answer: string) {
  const candidate = answerProductInitialization(state, answer)
  expect(candidate.challenge).toBeUndefined()
  expect(candidate.value).toBeDefined()
  const assessed = recordProductAnswerAssessment(candidate.state, answer, {
    assessment: "The answer is useful but benefits from an explicit decision-ready formulation.",
    strengths: ["It preserves the user's Product intent."],
    gaps: [],
    proposedAnswer: answer,
  })
  expect(assessed.phase).toBe("awaiting-approval")
  expect(assessed.step).toBe(state.step)
  return acceptProductAnswer(assessed)
}

describe("interactive Product initialization chat", () => {
  it("requires an AI assessment and explicit acceptance before every step advances", () => {
    let state = startProductInitialization(claude, "Use the attached vision as candidate context.", ["Vision.md"])
    expect(productInitializationProgress(state)).toBe("0/9")
    expect(currentProductInitializationQuestion(state)?.key).toBe("name")

    const candidate = answerProductInitialization(state, answers[0])
    expect(candidate.state.step).toBe(0)
    expect(candidate.state.answers.name).toBeUndefined()
    state = recordProductAnswerAssessment(candidate.state, answers[0], {
      assessment: "The durable name is clear.",
      strengths: ["Domain is identifiable."],
      gaps: ["Confirm whether the name is externally visible."],
      followUpQuestion: "Is this the durable public Product name?",
      proposedAnswer: answers[0],
    })
    expect(state.phase).toBe("awaiting-approval")
    expect(state.step).toBe(0)
    expect(state.answers.name).toBeUndefined()
    state = acceptProductAnswer(state)
    expect(state.step).toBe(1)
    expect(state.answers.name).toBe(answers[0])

    for (const answer of answers.slice(1)) state = assessAndAccept(state, answer)
    expect(state.phase).toBe("review")
    expect(productInitializationProgress(state)).toBe("9/9")
    expect(productInitializationInput(state)).toMatchObject({
      name: answers[0],
      profile: "internal-tool",
      successSignals: [
        "70% fewer manual interventions",
        "Same-session feasibility output",
        "Planned-versus-actual visibility",
      ],
      exclusions: ["Live AIS tracking", "Automated deviation recovery", "Cost posting"],
    })
  })

  it("supports iterative revision without advancing until the latest proposal is accepted", () => {
    let state = startProductInitialization(claude)
    state = recordProductAnswerAssessment(state, answers[0], {
      assessment: "Clarify durability.", strengths: [], gaps: ["Audience unknown"],
      followUpQuestion: "Is this name public?", proposedAnswer: answers[0],
    })
    const revised = "Marine Schedule Planning Platform"
    const candidate = answerProductInitialization(state, revised)
    state = recordProductAnswerAssessment(candidate.state, revised, {
      assessment: "The revised name is clearer.", strengths: ["Scope is explicit"], gaps: [], proposedAnswer: revised,
    })
    expect(state.pending?.round).toBe(2)
    expect(state.step).toBe(0)
    state = acceptProductAnswer(state)
    expect(state.answers.name).toBe(revised)
  })

  it("challenges locally-invalid answers before any provider call", () => {
    let state = startProductInitialization(claude)
    state = assessAndAccept(state, "Scheduler")
    expect(answerProductInitialization(state, "Too short").challenge).toMatch(/more specific/)
    expect(state.step).toBe(1)
  })

  it("preserves commas inside newline-delimited list items and rejects ambiguous comma-only lists", () => {
    let state = startProductInitialization(claude)
    for (const answer of answers.slice(0, 5)) state = assessAndAccept(state, answer)
    const ambiguous = answerProductInitialization(state, "Noon, arrival, and departure reports are complete, Deviations are detected")
    expect(ambiguous.challenge).toMatch(/own line/i)

    const candidate = answerProductInitialization(state, [
      "Noon, arrival, and departure reports preserve estimates and actuals",
      "Schedule deviations are detected, attributed, and handled traceably",
    ].join("\n"))
    expect(candidate.challenge).toBeUndefined()
    expect(candidate.value).toEqual([
      "Noon, arrival, and departure reports preserve estimates and actuals",
      "Schedule deviations are detected, attributed, and handled traceably",
    ])
  })

  it("revises selected fields without discarding the rest of the current Product", () => {
    const input = {
      name: answers[0], summary: answers[1], problem: answers[2], affectedUsers: answers[3],
      desiredOutcome: answers[4],
      successSignals: ["Old signal one", "Old signal two"],
      firstWorkflow: answers[6], exclusions: ["Old exclusion"], profile: "internal-tool" as const,
    }
    let state = startProductRevision(codex, input, 1)
    expect(state.phase).toBe("review")
    expect(state.baseProductRevision).toBe(1)
    state = editProductRevisionField(state, "successSignals")
    expect(currentProductInitializationQuestion(state)?.key).toBe("successSignals")
    const candidate = answerProductInitialization(state, "New signal, with preserved comma\nSecond new signal")
    state = recordProductAnswerAssessment(candidate.state, candidate.state.answers.successSignals?.join("\n") ?? "", {
      assessment: "The signals are now independently reviewable.", strengths: [], gaps: [],
      proposedAnswer: "New signal, with preserved comma\nSecond new signal",
    })
    state = acceptProductAnswer(state)
    expect(state.phase).toBe("review")
    expect(state.answers.successSignals).toEqual(["New signal, with preserved comma", "Second new signal"])
    expect(state.answers.exclusions).toEqual(["Old exclusion"])
    expect(productInitializationInput(state).name).toBe(input.name)
    expect(isProductInitializationChatState(state)).toBe(true)
  })

  it("discards an unaccepted proposal when the advisor changes", () => {
    let state = startProductInitialization(claude)
    state = recordProductAnswerAssessment(state, answers[0], {
      assessment: "Assessment", strengths: [], gaps: [], proposedAnswer: answers[0],
    })
    state = changeProductChatAdvisor(state, codex)
    expect(state.phase).toBe("collecting")
    expect(state.pending).toBeUndefined()
    expect(state.step).toBe(0)
    expect(state.advisor).toEqual(codex)
  })

  it("can preserve an unaccepted proposal solely as revision context during a productive switch", () => {
    let state = startProductInitialization(claude)
    state = recordProductAnswerAssessment(state, answers[0], {
      assessment: "Assessment", strengths: [], gaps: ["Needs another view"], proposedAnswer: answers[0],
    })
    state = changeProductChatAdvisor(state, codex, true)
    expect(state.phase).toBe("awaiting-approval")
    expect(state.advisor).toEqual(codex)
    expect(state.pending?.advisor).toEqual(claude)
    expect(state.pending?.originalAnswer).toBe(answers[0])
    expect(state.step).toBe(0)
  })

  it("prefers the workspace-session advisor over stale committed Chat metadata", async () => {
    expect(preferredProductChatAdvisor(claude, codex, codex)).toEqual(claude)

    let modelInput: ProductChatAdvisorSelection | undefined
    const selected = await selectProductChatAdvisorForCommand("model", claude, {
      advisor: async () => codex,
      agent: async () => codex,
      model: async (current) => {
        modelInput = current
        return { ...current, modelId: "opus", modelLabel: "Opus alias" }
      },
    })
    expect(modelInput).toEqual(claude)
    expect(selected).toMatchObject({ adapterId: "gaep.claude-code-cli", modelId: "opus" })
  })

  it("supports backtracking and bounds candidate attachment metadata", () => {
    let state = startProductInitialization(claude, "brief", Array.from({ length: 30 }, (_, index) => `source-${index}.md`))
    expect(state.candidateAttachments).toHaveLength(20)
    state = assessAndAccept(state, answers[0])
    state = goBackProductInitialization(state)
    expect(state.step).toBe(0)
    expect(state.answers.name).toBeUndefined()
  })

  it("recognizes only the bounded portable state shape", () => {
    expect(isProductInitializationChatState(startProductInitialization(claude))).toBe(true)
    expect(isProductInitializationChatState({
      ...startProductInitialization(claude),
      candidateAttachments: [42],
    })).toBe(false)
  })
})
