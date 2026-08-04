import { describe, expect, it, vi } from "vitest"

import type { startManagedClaudeContextRun, startManagedCodexStagedRun } from "@gaep/agent-sdk"

import type { ProductChatAdvisorSelection } from "./interactive-product-chat.js"
import {
  buildProductAnswerChallengePrompt,
  parseProductAdvisorOutput,
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

function dependencies(advisorOutput = assessmentJson): {
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
        portable: { terminalDisposition: "completed", events: [event(advisorOutput)] },
        local: {},
      },
    }),
    cancel: vi.fn(async () => undefined),
  }))
  const startCodex = vi.fn(async () => ({
    events: { async *[Symbol.asyncIterator]() {} },
    completion: Promise.resolve({
      result: { portable: { terminalDisposition: "completed", events: [event(advisorOutput)] }, local: {} },
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

function authenticationUnavailableDependencies(): ProductChatAdvisorDependencies {
  const startClaude = vi.fn(async () => ({
    events: { async *[Symbol.asyncIterator]() {} },
    completion: Promise.resolve({
      terminationCause: "normal" as const,
      result: {
        portable: {
          terminalDisposition: "completed" as const,
          events: [event("Claude authentication is unavailable for the managed runtime.")],
        },
        local: {},
      },
    }),
    cancel: vi.fn(async () => undefined),
  }))
  return {
    startClaude: startClaude as unknown as typeof startManagedClaudeContextRun,
    startCodex: vi.fn() as unknown as typeof startManagedCodexStagedRun,
    createEmptySource: async () => "/tmp/gaep-test-advisor-source",
    removeEmptySource: async () => undefined,
  }
}

describe("Product Chat AI advisor", () => {
  it("answers the human's attachment task before offering lifecycle alignment", () => {
    const prompt = buildProductAnswerChallengePrompt({
      ...request(claude),
      question: {
        key: "source-understanding",
        title: "Understand attached Product documents",
        prompt: "describe the attachment file",
      },
      acceptedAnswers: { sourceMetadata: [{ label: "requirements.docx" }] },
      userAnswer: "requirements.docx\nProduct summary: ...",
    })
    expect(prompt).toContain("Directly perform the human's requested task")
    expect(prompt).toContain("describe the attachment file")
    expect(prompt).toContain("Do not produce GAEP checkpoint alignment")
    expect(prompt).toContain("Lead with the useful answer")
    expect(prompt).toContain("the candidate document set declares")
    expect(prompt).toContain("never convert internal document wording into GAEP semantic authority")
    expect(prompt).toContain("Use a Markdown table when three or more comparable facts")
    expect(prompt).toContain("include a valid Mermaid diagram")
    expect(prompt).toContain("Return only the complete direct answer in Markdown")
    expect(prompt).not.toContain("Return exactly one JSON object")
  })

  it("builds a bounded critical prompt with human-approval authority", () => {
    const prompt = buildProductAnswerChallengePrompt(request(claude))
    expect(prompt).toContain("Challenge the candidate answer constructively")
    expect(prompt).toContain("Marine Scheduler")
    expect(prompt).toContain("human must explicitly accept")
    expect(prompt).toContain("same language")
  })

  it("requires concrete context-grounded help instead of template placeholders", () => {
    const prompt = buildProductAnswerChallengePrompt({
      ...request(codex),
      question: {
        key: "title",
        title: "Initiative title",
        prompt: "Name the bounded change or outcome this Initiative will govern.",
      },
      acceptedAnswers: {
        acceptedInitiativeFields: {},
        governedProduct: {
          name: "Marine Shipping Platform",
          desiredOutcome: "Create one traceable schedule-planning workflow.",
          firstWorkflow: "Service-to-voyage schedule planning",
        },
      },
      userAnswer: "What do you suggest for this field?",
    })
    expect(prompt).toContain("do the drafting work for them")
    expect(prompt).toContain("Marine Shipping Platform")
    expect(prompt).toContain("Do not return square-bracket placeholders")
    expect(prompt).toContain("Never answer with a template")
  })

  it("requires a complete JSON string proposal for Initiative Classification without the ordinary list-field rule", () => {
    const prompt = buildProductAnswerChallengePrompt({
      ...request(codex),
      question: {
        key: "initiative-classification",
        title: "Initiative classification brief",
        prompt: "Return the complete classification contract with exact enum tokens.",
      },
    })
    expect(prompt).toContain("proposedAnswer must be a JSON-encoded string")
    expect(prompt).toContain("property names, subject keys, and enum tokens exactly")
    expect(prompt).not.toContain("proposedAnswer must contain exactly one item per line")
  })

  it("normalizes structured Initiative proposals returned as objects or direct candidates", () => {
    const wrapped = parseProductAdvisorOutput("initiative-classification", JSON.stringify({
      assessment: "The candidate is ready for contract validation.",
      strengths: [],
      gaps: [],
      followUpQuestion: null,
      proposedAnswer: { primaryType: "feature", secondaryTypes: [] },
    }))
    expect(JSON.parse(wrapped.proposedAnswer)).toEqual({ primaryType: "feature", secondaryTypes: [] })

    const direct = parseProductAdvisorOutput("initiative-classification", JSON.stringify({
      primaryType: "feature",
      secondaryTypes: [],
    }))
    expect(direct.assessment).toContain("governed candidate directly")
    expect(JSON.parse(direct.proposedAnswer)).toEqual({ primaryType: "feature", secondaryTypes: [] })
  })

  it("applies the same machine-readable proposal boundary to Initiative Applicability", () => {
    const prompt = buildProductAnswerChallengePrompt({
      ...request(claude),
      question: {
        key: "initiative-applicability",
        title: "Initiative applicability brief",
        prompt: "Represent every canonical subject exactly once.",
      },
    })
    expect(prompt).toContain("proposedAnswer must be a JSON-encoded string")
    expect(prompt).toContain("subject keys, and enum tokens exactly")
    expect(prompt).toContain("candidate human decisions")
    expect(prompt).toContain("standard candidate owner for every decided or unresolved applicability subject")
    expect(prompt).toContain("GAEP-generated unresolved-subject clarification")
    expect(prompt).toContain("Do not discard an explicit candidate human decision")
    expect(prompt).toContain("remains ungoverned until the human explicitly uses /accept and /commit CONFIRM")
    expect(prompt).toContain("not required for required, recommended, optional, deferred")
    expect(prompt).not.toContain("proposedAnswer must contain exactly one item per line")
  })

  it("uses a cross-functional fail-closed prompt for canonical Phase 1 records", () => {
    const prompt = buildProductAnswerChallengePrompt({
      ...request(codex),
      question: {
        key: "phase1-canonical-record",
        title: "Business Understanding",
        prompt: "Create the complete canonical input object from the supplied schema.",
      },
      acceptedAnswers: {
        jsonSchema: { type: "object", required: ["initiativeId"] },
        governedContext: { initiativeId: "initiative-1" },
      },
    })
    expect(prompt).toContain("cross-functional Product, business architecture, solution architecture, security")
    expect(prompt).toContain("one complete canonical candidate record")
    expect(prompt).toContain("proposedAnswer must be a JSON-encoded string")
    expect(prompt).toContain("Do not invent unsupported facts")
    expect(prompt).toContain("human must explicitly accept")
  })

  it("parses only the governed structured response shape", () => {
    expect(parseProductAnswerAssessment(`\n\`\`\`json\n${assessmentJson}\n\`\`\``)).toMatchObject({
      gaps: ["The affected actor is missing."],
      proposedAnswer: "A maritime scheduling platform for operations teams to plan and monitor voyage schedules.",
    })
    expect(() => parseProductAnswerAssessment("Looks good to me.")).toThrow(ProductChatAdvisorError)
    expect(() => parseProductAnswerAssessment('{"assessment":"fine"}')).toThrow(/strengths/)
  })

  it("parses the first complete assessment object without swallowing trailing model commentary", () => {
    const output = `Here is the requested assessment:\n${assessmentJson}\nThe proposal above is ready for governed review {not another JSON response}.`
    expect(parseProductAnswerAssessment(output)).toMatchObject({
      gaps: ["The affected actor is missing."],
      proposedAnswer: "A maritime scheduling platform for operations teams to plan and monitor voyage schedules.",
    })
  })

  it("accepts a direct Markdown answer only for attachment understanding", () => {
    const markdown = "# Document summary\n\nThe document defines voyage-planning requirements."
    expect(parseProductAdvisorOutput("source-understanding", markdown)).toMatchObject({
      assessment: "The advisor answered the bounded attachment request directly.",
      proposedAnswer: markdown,
    })
    expect(() => parseProductAdvisorOutput("summary", markdown)).toThrow(ProductChatAdvisorError)
  })

  it("still accepts a structured answer for attachment understanding for provider compatibility", () => {
    expect(parseProductAdvisorOutput("source-understanding", assessmentJson).proposedAnswer)
      .toContain("maritime scheduling platform")
  })

  it("allows the larger bounded proposal only for the complete applicability matrix", () => {
    const large = JSON.stringify({
      assessment: "The exact canonical matrix was evaluated.",
      strengths: [], gaps: [], followUpQuestion: null,
      proposedAnswer: "x".repeat(70 * 1_024),
    })
    expect(() => parseProductAnswerAssessment(large)).toThrow(/proposedAnswer/)
    expect(parseProductAnswerAssessment(large, {
      responseBytes: 512 * 1_024,
      proposedAnswerBytes: 192 * 1_024,
    }).proposedAnswer).toHaveLength(70 * 1_024)
  })

  it("accepts a provider-enforced canonical proposal object and preserves it as the governed JSON string", () => {
    const structured = JSON.stringify({
      assessment: "The candidate follows the exact schema.",
      strengths: [],
      gaps: [],
      followUpQuestion: null,
      proposedAnswer: { initiativeId: "00000000-0000-4000-8000-000000000001" },
    })
    expect(JSON.parse(parseProductAdvisorOutput("phase1-canonical-record", structured).proposedAnswer)).toEqual({
      initiativeId: "00000000-0000-4000-8000-000000000001",
    })
  })

  it("wraps a direct schema-bound canonical candidate in a deterministic governed assessment", () => {
    const candidate = JSON.stringify({ initiativeId: "00000000-0000-4000-8000-000000000001" })
    expect(parseProductAdvisorOutput("phase1-canonical-record", candidate)).toMatchObject({
      assessment: "The selected advisor produced the canonical candidate directly for GAEP contract validation.",
      proposedAnswer: candidate,
    })
  })

  it("binds the canonical candidate schema to Claude native structured output", async () => {
    const output = JSON.stringify({
      assessment: "The candidate follows the exact schema.",
      strengths: [],
      gaps: [],
      followUpQuestion: null,
      proposedAnswer: { initiativeId: "00000000-0000-4000-8000-000000000001" },
    })
    const setup = dependencies(output)
    await runProductAnswerChallenge(
      { executable: "/verified/claude" },
      {
        ...request(claude),
        question: {
          key: "phase1-canonical-record",
          title: "Business Understanding",
          prompt: "Create the complete canonical input object.",
        },
        acceptedAnswers: {
          jsonSchema: {
            $schema: "https://json-schema.org/draft/2020-12/schema",
            type: "object",
            properties: { initiativeId: { type: "string" } },
            required: ["initiativeId"],
            additionalProperties: false,
          },
        },
      },
      new AbortController().signal,
      setup.dependencies,
    )
    expect(setup.startClaude.mock.calls[0]?.[0]).toMatchObject({
      jsonSchema: expect.objectContaining({
        required: expect.arrayContaining(["initiativeId"]),
      }),
    })
    expect(setup.startClaude.mock.calls[0]?.[0].jsonSchema).not.toHaveProperty("$schema")
    expect(setup.startClaude.mock.calls[0]?.[0].contextPack).toContain("Do not return an assessment wrapper")
  })

  it("asks Codex for a direct canonical candidate without the escaped assessment wrapper", async () => {
    const candidate = { initiativeId: "00000000-0000-4000-8000-000000000001" }
    const setup = dependencies(JSON.stringify(candidate))
    const result = await runProductAnswerChallenge(
      { executable: "/verified/codex" },
      {
        ...request(codex),
        question: {
          key: "phase1-canonical-record",
          title: "Business Understanding",
          prompt: "Create the complete canonical input object.",
        },
        acceptedAnswers: {
          jsonSchema: {
            $schema: "https://json-schema.org/draft/2020-12/schema",
            type: "object",
            properties: { initiativeId: { type: "string" } },
            required: ["initiativeId"],
            additionalProperties: false,
          },
        },
      },
      new AbortController().signal,
      setup.dependencies,
    )
    expect(JSON.parse(result.proposedAnswer)).toEqual(candidate)
    expect(setup.startCodex.mock.calls[0]?.[0]).toMatchObject({
      appServerOptions: { requestTimeoutMs: 30_000 },
      effort: "low",
      timeoutMs: 480_000,
    })
    expect(setup.startCodex.mock.calls[0]?.[0]).not.toHaveProperty("outputSchema")
    expect(setup.startCodex.mock.calls[0]?.[0].prompt).toContain("Do not return an assessment wrapper")
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

  it("returns a plain Markdown attachment answer from Claude without discarding it", async () => {
    const markdown = "## What this file contains\n\nIt defines the Product scope and constraints."
    const setup = dependencies(markdown)
    const result = await runProductAnswerChallenge(
      { executable: "/verified/claude" },
      {
        ...request(claude),
        question: {
          key: "source-understanding",
          title: "Understand attached Product documents",
          prompt: "describe the attachment file",
        },
      },
      new AbortController().signal,
      setup.dependencies,
    )
    expect(result.proposedAnswer).toBe(markdown)
    expect(setup.startClaude.mock.calls[0]?.[0]).toMatchObject({
      objective: "Directly answer the human's bounded question using only the supplied attachment content.",
    })
  })

  it("never renders a Claude authentication diagnostic as a successful attachment answer", async () => {
    await expect(runProductAnswerChallenge(
      { executable: "/verified/claude" },
      {
        ...request(claude),
        question: {
          key: "source-understanding",
          title: "Understand attached Product documents",
          prompt: "list the risks",
        },
      },
      new AbortController().signal,
      authenticationUnavailableDependencies(),
    )).rejects.toMatchObject({
      code: "provider-failed",
      message: "Claude Code authentication is unavailable for the governed advisory turn.",
    })
  })

  it("gives the grouped applicability proposal a bounded low-effort eight-minute provider window", async () => {
    const setup = dependencies()
    await runProductAnswerChallenge(
      { executable: "/verified/claude" },
      {
        ...request(claude),
        question: {
          key: "initiative-applicability",
          title: "Initiative applicability brief",
          prompt: "Represent all canonical subjects.",
        },
      },
      new AbortController().signal,
      setup.dependencies,
    )
    expect(setup.startClaude.mock.calls[0]?.[0]).toMatchObject({ timeoutMs: 480_000, effort: "low" })
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

  it("drains high-fragmentation live Codex events while waiting for the terminal result", async () => {
    let consumed = 0
    let release!: () => void
    const allDelivered = new Promise<void>((resolve) => { release = resolve })
    const discard = vi.fn(async () => ({ portable: {}, local: {} }))
    const startCodex = vi.fn(async () => ({
      events: {
        async *[Symbol.asyncIterator]() {
          for (let index = 0; index < 5_000; index += 1) {
            consumed += 1
            yield event("x")
          }
          release()
        },
      },
      completion: (async () => {
        await allDelivered
        return {
          result: { portable: { terminalDisposition: "completed" as const, events: [event(assessmentJson)] }, local: {} },
          discard,
        }
      })(),
      cancel: vi.fn(async () => undefined),
    }))
    await runProductAnswerChallenge(
      { executable: "/verified/codex" },
      request(codex),
      new AbortController().signal,
      {
        startClaude: vi.fn() as unknown as typeof startManagedClaudeContextRun,
        startCodex: startCodex as unknown as typeof startManagedCodexStagedRun,
        createEmptySource: async () => "/tmp/gaep-test-advisor-source",
        removeEmptySource: async () => undefined,
      },
    )
    expect(consumed).toBe(5_000)
    expect(discard).toHaveBeenCalledOnce()
  })

  it("asks Codex for direct Markdown in attachment-understanding mode", async () => {
    const setup = dependencies("The file documents schedule-planning requirements.")
    await runProductAnswerChallenge(
      { executable: "/verified/codex" },
      {
        ...request(codex),
        question: {
          key: "source-understanding",
          title: "Understand attached Product documents",
          prompt: "describe the attachment file",
        },
      },
      new AbortController().signal,
      setup.dependencies,
    )
    expect(setup.startCodex.mock.calls[0]?.[0].developerInstructions)
      .toContain("Return the direct Markdown answer only")
  })
})
