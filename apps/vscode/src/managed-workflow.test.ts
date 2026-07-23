import type { ToolDefinition, WorkflowPlan } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import {
  buildManagedWorkflowEnvelope,
  buildRunToolSelectionInput,
  createHumanWorkflowGateEvaluator,
  humanWorkflowGatePrompt,
} from "./managed-workflow.js"

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
    } as unknown as ToolDefinition
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

  it("records only explicit human Workflow gate attestations as satisfied", async () => {
    const request = {
      managedRunId: "00000000-0000-4000-8000-000000000111",
      runId: "00000000-0000-4000-8000-000000000112",
      stepId: "00000000-0000-4000-8000-000000000113",
      stepIndex: 0,
      attempt: 1,
      phase: "evidence" as const,
      criteria: ["A portable evidence digest is committed"],
      criteriaDigest: `sha256:${"4".repeat(64)}` as const,
      completedStepIds: [],
      providerDisposition: "completed" as const,
      postconditionStatus: "satisfied" as const,
      eventsDigest: `sha256:${"5".repeat(64)}` as const,
      signal: new AbortController().signal,
    }
    const evaluator = createHumanWorkflowGateEvaluator("local-actor", async () => "satisfied")
    const assessment = await evaluator(request)

    expect(assessment).toMatchObject({ status: "satisfied", basis: "human-attestation" })
    expect(assessment.evidenceDigest).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(assessment.evaluator).toMatchObject({ kind: "human", id: "local-actor" })
  })

  it("keeps a dismissed Workflow gate explicitly not assessed", async () => {
    const request = {
      managedRunId: "00000000-0000-4000-8000-000000000121",
      runId: "00000000-0000-4000-8000-000000000122",
      stepId: "00000000-0000-4000-8000-000000000123",
      stepIndex: 1,
      attempt: 2,
      phase: "stop-conditions" as const,
      criteria: ["Stop on scope drift"],
      criteriaDigest: `sha256:${"6".repeat(64)}` as const,
      completedStepIds: [],
      signal: new AbortController().signal,
    }
    const evaluator = createHumanWorkflowGateEvaluator("local-actor", async () => "not-assessed")
    const assessment = await evaluator(request)
    const prompt = humanWorkflowGatePrompt(request)

    expect(assessment).toMatchObject({ status: "not-assessed", basis: "human-attestation" })
    expect(assessment.evidenceDigest).toBeUndefined()
    expect(prompt.satisfiedLabel).toBe("Attest Boundary Complied")
    expect(prompt.canAttest).toBe(true)
    expect(prompt.message).toContain("Criteria digest")
  })

  it("prevents native attestation when the criteria cannot be displayed completely", () => {
    const request = {
      managedRunId: "00000000-0000-4000-8000-000000000131",
      runId: "00000000-0000-4000-8000-000000000132",
      stepId: "00000000-0000-4000-8000-000000000133",
      stepIndex: 0,
      attempt: 1,
      phase: "outputs" as const,
      criteria: ["x".repeat(2_001)],
      criteriaDigest: `sha256:${"7".repeat(64)}` as const,
      completedStepIds: [],
      signal: new AbortController().signal,
    }
    const prompt = humanWorkflowGatePrompt(request)

    expect(prompt.canAttest).toBe(false)
    expect(prompt.message).toContain("truncated")
  })
})
