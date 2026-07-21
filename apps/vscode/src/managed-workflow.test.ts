import type { ToolDefinition, WorkflowPlan } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import { buildManagedWorkflowEnvelope, buildRunToolSelectionInput } from "./managed-workflow.js"

const plan = {
  id: "00000000-0000-4000-8000-000000000101",
  revision: 2,
  recordDigest: `sha256:${"1".repeat(64)}`,
  state: "resolved",
  contextPacks: [{
    recordType: "context-pack",
    recordId: "00000000-0000-4000-8000-000000000102",
    revision: 1,
    digest: `sha256:${"2".repeat(64)}`,
  }],
  toolDefinitions: [],
  steps: [{
    effectEnvelope: ["observe"],
    scope: { read: [{ kind: "workspace-relative", path: "." }], write: [], effects: [] },
    stopConditions: ["Stop on scope drift"],
    evidenceCriteria: ["Record normalized evidence"],
  }],
} as unknown as WorkflowPlan

describe("managed Workflow host compilation", () => {
  it("builds an exact observe-only Manual envelope", () => {
    const envelope = buildManagedWorkflowEnvelope(plan, [], "gaep.manual")
    expect(envelope.permissions).toEqual([{ capability: "all-tools", mode: "deny", scope: [] }])
    expect(envelope.expectedEffects).toEqual(["observe"])
    expect(envelope.managedIntent).toMatchObject({ requestedScopes: [], workflowPlan: { revision: 2 } })
  })

  it("compiles exact Codex Tool permissions and Run selection", () => {
    const tool = {
      id: "00000000-0000-4000-8000-000000000103",
      key: "workspace-write",
      name: "Workspace write",
      binding: { adapterId: "gaep.codex-cli", toolName: "workspace-write" },
      requiredPermissions: [{ capability: "modify-workspace", mode: "allow", scope: ["src"] }],
      effectEnvelope: ["reversible-change"],
      allowedScopes: [{ kind: "workspace-relative", path: "src" }],
      policy: { requiresHumanConfirmation: true },
    } as ToolDefinition
    const withTool = {
      ...plan,
      toolDefinitions: [{
        recordType: "tool-definition",
        recordId: tool.id,
        revision: 1,
        digest: `sha256:${"3".repeat(64)}`,
      }],
      steps: [{
        ...plan.steps[0],
        effectEnvelope: ["reversible-change"],
        scope: { read: [], write: [{ kind: "workspace-relative", path: "src" }], effects: [] },
      }],
    } as WorkflowPlan
    const envelope = buildManagedWorkflowEnvelope(withTool, [tool], "gaep.codex-cli")
    const selection = buildRunToolSelectionInput(
      "00000000-0000-4000-8000-000000000104",
      withTool,
      [tool],
      envelope,
      true,
    )

    expect(envelope.permissions).toContainEqual({ capability: "modify-workspace", mode: "allow", scope: ["src"] })
    expect(envelope.managedIntent.requestedScopes).toEqual([{ kind: "workspace-relative", path: "src" }])
    expect(selection.confirmedToolIds).toEqual([tool.id])
  })

  it("rejects Tool and effect authority for context-only providers", () => {
    const unsafe = { ...plan, steps: [{ ...plan.steps[0], effectEnvelope: ["reversible-change"] }] } as WorkflowPlan
    expect(() => buildManagedWorkflowEnvelope(unsafe, [], "gaep.claude-code-cli")).toThrow(/observe-only/)
  })
})
