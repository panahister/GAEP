import { describe, expect, it } from "vitest"

import { findActiveRun, isTerminal, modelPickItems, providerPickItems, renderRunResult, type ProviderCatalogEntryLite } from "./provider-model-workflow.js"

const providers: ProviderCatalogEntryLite[] = [
  { adapterId: "gaep.codex-cli", agentLabel: "Codex", detected: false, authReadiness: "auth-unverified", models: [] },
  { adapterId: "gaep.claude-code-cli", agentLabel: "Claude Code", detected: true, runtimeVersion: "2.1.218", authReadiness: "auth-unverified", models: [{ id: "sonnet", truthClass: "provider-declared", alias: true }] },
]

describe("provider/model workflow logic", () => {
  it("builds provider pick items reflecting detection and auth", () => {
    const items = providerPickItems(providers)
    expect(items.map((i) => i.value)).toEqual(["gaep.codex-cli", "gaep.claude-code-cli"])
    expect(items[1]!.description).toContain("detected v2.1.218")
    expect(items[1]!.detail).toBe("auth=auth-unverified")
  })

  it("builds model pick items showing server truth class (not editable)", () => {
    const items = modelPickItems(providers[1]!)
    expect(items[0]!.label).toBe("sonnet")
    expect(items[0]!.description).toContain("provider-declared")
    expect(items[0]!.description).toContain("alias")
  })

  it("renders terminal results truthfully and identifies the active run", () => {
    expect(isTerminal("running")).toBe(false)
    expect(isTerminal("completed")).toBe(true)
    expect(renderRunResult({ analysisRunId: "1", state: "completed", result: { text: "ok", truncated: false } })).toContain("completed")
    expect(renderRunResult({ analysisRunId: "1", state: "failed", failureCategory: "provider-error", failureSummary: "The provider exited with an error." })).toContain("provider-error")
    expect(findActiveRun([{ analysisRunId: "a", state: "completed" }, { analysisRunId: "b", state: "running" }])?.analysisRunId).toBe("b")
  })
})
