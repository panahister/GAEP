import type { AgentSelection } from "@gaep/contracts"
import { describe, expect, it, vi } from "vitest"

vi.mock("vscode", () => ({}))

import { agentTreePresentation, modelIdentityDescription } from "./tree.js"

function selection(overrides: Partial<AgentSelection>): AgentSelection {
  return {
    schemaVersion: 2,
    adapterId: "gaep.codex-cli",
    agentId: "codex-cli",
    modelId: "gpt-test",
    modelTruthClass: "provider-declared",
    modelAlias: false,
    settings: {},
    selectedAt: "2026-07-21T00:00:00.000Z",
    capabilityDigest: `sha256:${"a".repeat(64)}`,
    ...overrides,
  }
}

describe("GAEP agent tree presentation", () => {
  it("describes Manual, Codex, and Claude using their managed boundaries", () => {
    expect(agentTreePresentation(selection({
      adapterId: "gaep.manual",
      agentId: "manual",
      modelId: "manual-deterministic-v1",
      settings: { script: "success" },
    }))).toMatchObject({
      boundary: expect.stringMatching(/deterministic offline.*managed in-process/i),
      bindingLabel: "Machine-local managed runtime binding",
    })

    expect(agentTreePresentation(selection({ settings: { reasoningEffort: "high" } }))).toMatchObject({
      boundary: expect.stringMatching(/isolated staging.*reviewed apply/i),
      controls: expect.stringMatching(/reasoning=high/i),
      bindingLabel: "Machine-local executable binding",
    })

    expect(agentTreePresentation(selection({
      adapterId: "gaep.claude-code-cli",
      agentId: "claude-code-cli",
      modelId: "sonnet",
      modelAlias: true,
      settings: { effort: "max", maxBudgetUsd: 25 },
    }))).toMatchObject({
      boundary: expect.stringMatching(/tool-free.*context-only/i),
      controls: expect.stringMatching(/effort=max.*budget=25/i),
      bindingLabel: "Machine-local executable binding",
    })
  })

  it("keeps nullable model alias truth distinct", () => {
    expect(modelIdentityDescription(selection({ modelAlias: true }))).toMatch(/, alias$/)
    expect(modelIdentityDescription(selection({ modelAlias: false }))).toMatch(/not an alias$/)
    expect(modelIdentityDescription(selection({ modelAlias: null }))).toMatch(/alias status unknown$/)
  })
})
