import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { AdapterCapabilities, AgentSelection, ExecutionCharter } from "@gaep/contracts"
import { capabilityDigest, type AgentAdapter, type AgentInvocation } from "@gaep/agent-sdk"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { GaepEngine } from "./engine.js"

const capabilities: AdapterCapabilities = {
  adapterId: "gaep.fake",
  adapterVersion: "1.0.0",
  agentId: "fake-agent",
  agentLabel: "Fake Agent",
  runtimeVersion: "1.0.0",
  executablePath: "/usr/bin/true",
  detected: true,
  executionInterface: "cli-jsonl",
  interfaceMaturity: "stable",
  supportsResume: true,
  supportsCancel: true,
  supportsCheckpoints: true,
  supportsModelDiscovery: true,
  supportsToolSelection: true,
  settings: [],
  models: [{
    id: "fake-model",
    label: "Fake Model",
    reasoningOptions: [],
    inputModalities: ["text"],
    truthClass: "observed",
    alias: false,
  }],
  limitations: [],
  observedAt: "2026-07-21T00:00:00.000Z",
}

class FakeAdapter implements AgentAdapter {
  readonly id = "gaep.fake"
  async probe(): Promise<AdapterCapabilities> {
    return capabilities
  }
  validateSelection(selection: AgentSelection, observed: AdapterCapabilities): string[] {
    return selection.capabilityDigest === capabilityDigest(observed) ? [] : ["capability mismatch"]
  }
  buildInvocation(
    _selection: AgentSelection,
    _charter: ExecutionCharter,
    workspacePath: string,
    prompt: string,
  ): AgentInvocation {
    return {
      executable: "/usr/bin/true",
      args: [prompt],
      cwd: workspacePath,
      environment: {},
      protocol: "jsonl",
      maturity: "stable",
      warnings: [],
    }
  }
}

describe("GAEP local engine", () => {
  let workspace: string
  let engine: GaepEngine

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "gaep-engine-"))
    engine = new GaepEngine(workspace, [new FakeAdapter()])
  })

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true })
  })

  async function initialize() {
    const product = await engine.createProduct({
      name: "Atlas",
      summary: "A governed product design workspace.",
      problem: "Product decisions and implementation context become disconnected.",
      affectedUsers: "Founders and product engineering teams",
      desiredOutcome: "Every implementation step remains linked to explicit product intent.",
      successSignals: ["A complete trace exists"],
      firstWorkflow: "Define a Product, select an agent, and execute a bounded Initiative.",
      exclusions: ["Automatic deployment"],
      profile: "software",
    }, "founder")
    const initiative = await engine.createInitiative({
      title: "Build the first workflow",
      outcome: "A user can complete the first governed workflow.",
      scope: ["Local engine", "VS Code host"],
      exclusions: ["Cloud synchronization"],
    }, "founder")
    await engine.selectAgent(capabilities, "fake-model", {}, "founder")
    return { product, initiative }
  }

  it("keeps Product and Initiative identities and lifecycle state separate", async () => {
    const { product, initiative } = await initialize()
    const productBefore = await readFile(join(workspace, ".gaep", "product.json"), "utf8")
    await engine.updateInitiativeState(initiative.id, "completed", "Outcome verified", "founder")
    const productAfter = await readFile(join(workspace, ".gaep", "product.json"), "utf8")

    expect(product.id).not.toBe(initiative.id)
    expect(initiative.productId).toBe(product.id)
    expect(productAfter).toBe(productBefore)
    expect((await engine.readProduct()).lifecycleState).toBe("active")
  })

  it("requires charter confirmation before preparing a safe argument-array invocation", async () => {
    const { initiative } = await initialize()
    const charter = await engine.createCharter({
      initiativeId: initiative.id,
      objective: "Implement and verify the bounded workflow.",
      permissions: [{ capability: "modify-workspace", mode: "ask", scope: [workspace] }],
      expectedEffects: ["reversible-change"],
      forbiddenActions: ["Do not push or deploy"],
      stopConditions: ["Stop when authority is missing"],
      requiredEvidence: ["Test output"],
    }, "founder")

    await expect(engine.prepareRun(charter.id, "founder")).rejects.toThrow("Confirm")
    await engine.confirmCharter(charter.id, "founder")
    const prepared = await engine.prepareRun(charter.id, "founder")
    expect(prepared.run.state).toBe("prepared")
    expect(prepared.invocation.executable).toBe("/usr/bin/true")
    expect(prepared.invocation.args).toHaveLength(1)
    expect(prepared.invocation.args[0]).toContain("Technical access is not a GAEP Approval Determination")
  })

  it("maintains a verifiable append-only audit hash chain and detects tampering", async () => {
    await initialize()
    const before = await engine.repository.verifyAudit()
    expect(before.valid).toBe(true)
    expect(before.events).toBeGreaterThan(2)

    const auditPath = join(workspace, ".gaep", "audit", "events.jsonl")
    const tampered = (await readFile(auditPath, "utf8")).replace("product.created", "product.deleted")
    await writeFile(auditPath, tampered)
    const after = await engine.repository.verifyAudit()
    expect(after.valid).toBe(false)
    expect(after.error).toMatch(/hash/i)
  })

  it("records model truth and blocks handoff while the prior agent process is running", async () => {
    const { initiative } = await initialize()
    const selection = await engine.readSelection()
    expect(selection.modelTruthClass).toBe("observed")
    expect(selection.modelAlias).toBe(false)

    const charter = await engine.createCharter({
      initiativeId: initiative.id,
      objective: "Exercise a governed switch.",
      permissions: [{ capability: "read-workspace", mode: "allow", scope: [workspace] }],
      expectedEffects: ["observe"],
      forbiddenActions: ["Do not mutate the workspace"],
      stopConditions: ["Stop if mutation is required"],
      requiredEvidence: ["Observed state"],
    }, "founder")
    await engine.confirmCharter(charter.id, "founder")
    const { run } = await engine.prepareRun(charter.id, "founder")
    await engine.markRunState(run.id, "running", { kind: "system", id: "test" })

    await expect(engine.createHandoff({
      fromRunId: run.id,
      toCapabilities: capabilities,
      toModelId: "fake-model",
      toSettings: {},
      reason: "Switch execution context",
      completedWork: [],
      unresolvedMatters: ["Run is active"],
      decisions: [],
      evidence: [],
    }, "founder")).rejects.toThrow("Stop or cancel")
  })

  it("marks a run left running across host restart as unknown, never completed", async () => {
    const { initiative } = await initialize()
    const charter = await engine.createCharter({
      initiativeId: initiative.id,
      objective: "Verify interrupted-run recovery.",
      permissions: [{ capability: "read-workspace", mode: "allow", scope: [workspace] }],
      expectedEffects: ["observe"],
      forbiddenActions: ["Do not mutate"],
      stopConditions: ["Stop on interruption"],
      requiredEvidence: ["Recovered state"],
    }, "founder")
    await engine.confirmCharter(charter.id, "founder")
    const { run } = await engine.prepareRun(charter.id, "founder")
    await engine.markRunState(run.id, "running", { kind: "system", id: "test" })

    const restarted = new GaepEngine(workspace, [new FakeAdapter()])
    const recovered = await restarted.recoverInterruptedRuns("test.restart")
    expect(recovered).toHaveLength(1)
    expect((await restarted.listRuns())[0]?.state).toBe("unknown")
  })
})
