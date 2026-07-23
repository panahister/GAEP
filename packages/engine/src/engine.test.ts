import { randomUUID } from "node:crypto"
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  handoffSchema,
  legacyAdapterCapabilitiesV1Schema,
  legacyAgentSelectionV1Schema,
  type AdapterCapabilities,
  type AgentSelection,
  type ExecutionCharter,
} from "@gaep/contracts"
import {
  canonicalDigest,
  capabilityDigest,
  requireExecutableRuntimeBinding,
  validateSelectionBase,
  type AdapterProbeResult,
  type AdapterRuntimeBinding,
  type AgentAdapter,
  type AgentInvocation,
} from "@gaep/agent-sdk"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { GaepEngine, handoffReviewDigest, legacySelectionStateDigest } from "./engine.js"

const capabilities: AdapterCapabilities = {
  schemaVersion: 1,
  adapterId: "gaep.fake",
  adapterVersion: "1.0.0",
  agentId: "fake-agent",
  agentLabel: "Fake Agent",
  runtimeVersion: "1.0.0",
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

const runtimeBinding: AdapterRuntimeBinding = {
  scope: "machine-local",
  kind: "executable",
  adapterId: capabilities.adapterId,
  agentId: capabilities.agentId,
  executablePath: "/usr/bin/true",
  executableFingerprint: {
    requested: "true",
    canonicalPath: "/usr/bin/true",
    digest: `sha256:${"b".repeat(64)}`,
    size: 1,
    modifiedAtMs: 1,
  },
}

class FakeAdapter implements AgentAdapter {
  readonly id = "gaep.fake"
  observed: AdapterCapabilities = capabilities
  runtimeBinding: AdapterRuntimeBinding = runtimeBinding

  async probe(): Promise<AdapterProbeResult> {
    return { capabilities: this.observed, runtimeBinding: this.runtimeBinding }
  }
  validateSelection(selection: AgentSelection, observed: AdapterCapabilities): string[] {
    return selection.capabilityDigest === capabilityDigest(observed) ? [] : ["capability mismatch"]
  }
  buildInvocation(
    _selection: AgentSelection,
    _charter: ExecutionCharter,
    workspacePath: string,
    prompt: string,
    localBinding: AdapterRuntimeBinding,
  ): AgentInvocation {
    const executable = requireExecutableRuntimeBinding(localBinding, _selection, "Fake Adapter")
    return {
      executable: executable.executablePath,
      args: [prompt],
      cwd: workspacePath,
      environment: {},
      protocol: "jsonl",
      maturity: "stable",
      warnings: [],
    }
  }
}

class MutableFakeAdapter extends FakeAdapter {
}

class HistoricalProviderFixtureAdapter implements AgentAdapter {
  readonly runtimeBinding: AdapterRuntimeBinding

  constructor(readonly id: string, readonly observed: AdapterCapabilities) {
    this.runtimeBinding = {
      ...runtimeBinding,
      adapterId: observed.adapterId,
      agentId: observed.agentId,
    }
  }

  async probe(): Promise<AdapterProbeResult> {
    return { capabilities: this.observed, runtimeBinding: this.runtimeBinding }
  }

  validateSelection(selection: AgentSelection, observed: AdapterCapabilities): string[] {
    return validateSelectionBase(selection, observed)
  }

  buildInvocation(): AgentInvocation {
    throw new Error("Historical migration fixtures never execute")
  }
}

function currentHistoricalProviderCapabilities(provider: "codex" | "claude"): AdapterCapabilities {
  const codex = provider === "codex"
  return {
    schemaVersion: 1,
    adapterId: codex ? "gaep.codex-cli" : "gaep.claude-code-cli",
    adapterVersion: "0.1.0",
    agentId: codex ? "codex-cli" : "claude-code-cli",
    agentLabel: codex ? "Codex" : "Claude Code",
    runtimeVersion: "fixture-current",
    detected: true,
    executionInterface: codex ? "stdio-rpc" : "cli-stream-json",
    interfaceMaturity: "stable",
    supportsResume: codex,
    supportsCancel: true,
    supportsCheckpoints: false,
    supportsModelDiscovery: codex,
    supportsToolSelection: codex,
    settings: codex
      ? [{
          key: "reasoningEffort",
          label: "Reasoning effort",
          description: "Current observed reasoning effort",
          kind: "select",
          required: false,
          sensitive: false,
          options: [{ value: "high", label: "high" }],
          truthClass: "observed",
        }]
      : [
          {
            key: "effort",
            label: "Effort",
            description: "Current Claude effort",
            kind: "select",
            required: false,
            sensitive: false,
            options: [{ value: "high", label: "high" }],
            truthClass: "provider-declared",
          },
          {
            key: "maxBudgetUsd",
            label: "Maximum budget",
            description: "Current positive budget ceiling",
            kind: "number",
            required: false,
            sensitive: false,
            minimum: 0.01,
            maximum: 100_000,
            truthClass: "configured",
          },
        ],
    models: [{
      id: codex ? "gpt-5.6" : "sonnet",
      label: codex ? "GPT-5.6" : "Sonnet alias",
      reasoningOptions: ["high"],
      inputModalities: ["text"],
      truthClass: codex ? "observed" : "provider-declared",
      alias: !codex,
    }],
    limitations: ["Migration fixture only"],
    observedAt: "2026-07-23T00:00:00.000Z",
  }
}

function integrityEraHistoricalCapabilities(
  provider: "codex" | "claude",
  current: AdapterCapabilities,
): AdapterCapabilities {
  const codex = provider === "codex"
  return {
    ...current,
    runtimeVersion: "fixture-v1",
    executionInterface: codex ? "cli-jsonl" : "unavailable",
    interfaceMaturity: codex ? "stable" : "unknown",
    supportsResume: codex,
    supportsCancel: codex,
    supportsModelDiscovery: codex,
    supportsToolSelection: !codex,
    settings: codex
      ? [
          ...current.settings.filter((setting) => setting.key === "reasoningEffort"),
          {
            key: "sandbox",
            label: "Sandbox",
            description: "Historical read-only operating-system sandbox",
            kind: "select",
            required: true,
            sensitive: false,
            defaultValue: "read-only",
            options: [{ value: "read-only", label: "read-only" }],
            truthClass: "provider-declared",
          },
          {
            key: "approvalPolicy",
            label: "Command approvals",
            description: "Historical non-interactive fail-closed approval policy",
            kind: "select",
            required: true,
            sensitive: false,
            defaultValue: "fail-closed-noninteractive",
            options: [{ value: "fail-closed-noninteractive", label: "Fail closed" }],
            truthClass: "configured",
          },
        ]
      : [
          ...current.settings.filter((setting) => setting.key === "effort"),
          {
            key: "permissionMode",
            label: "Permission mode",
            description: "Historical Claude native permission behavior",
            kind: "select",
            required: true,
            sensitive: false,
            defaultValue: "default",
            options: ["default", "plan"].map((value) => ({ value, label: value })),
            truthClass: "provider-declared",
          },
          {
            key: "allowedTools",
            label: "Allowed tools",
            description: "Historical Claude tool allowlist",
            kind: "string-list",
            required: false,
            sensitive: false,
            defaultValue: [],
            truthClass: "configured",
          },
          {
            key: "disallowedTools",
            label: "Denied tools",
            description: "Historical Claude tool denylist",
            kind: "string-list",
            required: false,
            sensitive: false,
            defaultValue: [],
            truthClass: "configured",
          },
          {
            key: "maxBudgetUsd",
            label: "Maximum budget",
            description: "Historical nonnegative budget ceiling",
            kind: "number",
            required: false,
            sensitive: false,
            minimum: 0,
            truthClass: "configured",
          },
        ],
    limitations: [codex ? "Historical cli-jsonl boundary" : "Historical Claude execution unavailable"],
    observedAt: "2026-07-21T10:00:00.000Z",
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

  async function acceptedHandoffConfirmation(
    target: GaepEngine,
    input: Parameters<GaepEngine["previewHandoff"]>[0],
  ) {
    const preview = await target.previewHandoff(input)
    return {
      preview,
      confirmation: {
        decision: "accept-exact-handoff-preview" as const,
        expectedReviewDigest: handoffReviewDigest(preview),
        expectedCurrentSelectionDigest: canonicalDigest(await target.readSelection()) as `sha256:${string}`,
        expectedHandoffId: preview.id,
        expectedCreatedAt: preview.createdAt,
      },
    }
  }

  async function persistLegacyAgentRuntime(executablePath = "/opt/legacy/bin/fake-agent") {
    const selection = await engine.readSelection()
    const capabilityName = `capabilities-${canonicalDigest({
      adapterId: capabilities.adapterId,
      agentId: capabilities.agentId,
    }).slice("sha256:".length)}.json`
    const { schemaVersion: _selectionVersion, ...selectionFields } = selection
    const { schemaVersion: _capabilityVersion, ...capabilityFields } = capabilities
    const legacyCapabilities = legacyAdapterCapabilitiesV1Schema.parse({
      ...capabilityFields,
      executablePath,
    })
    const { observedAt: _observedAt, ...historicalStableCapabilities } = legacyCapabilities
    const legacySelection = legacyAgentSelectionV1Schema.parse({
      ...selectionFields,
      capabilityDigest: canonicalDigest(historicalStableCapabilities),
      runtimeExecutable: executablePath,
    })
    await engine.repository.withLock(async () => {
      await engine.repository.commitMutation({
        writes: [
          {
            path: engine.repository.resolve("runtime", "selection.json"),
            value: legacySelection,
            schema: legacyAgentSelectionV1Schema,
            governed: true,
          },
          {
            path: engine.repository.resolve("runtime", capabilityName),
            value: legacyCapabilities,
            schema: legacyAdapterCapabilitiesV1Schema,
            governed: true,
          },
        ],
        audit: {
          eventType: "test.legacy-runtime.persisted",
          actor: { kind: "system", id: "test.fixture" },
          subjectId: selection.agentId,
          payload: { fixture: true },
        },
      })
    })
    return { capabilityName }
  }

  async function legacyProviderFixture(
    provider: "codex" | "claude",
    legacySettings: Record<string, unknown>,
    capabilityFileEra: "agent-id" | "identity-digest" = "identity-digest",
  ) {
    const providerWorkspace = join(workspace, provider)
    await mkdir(providerWorkspace)
    const currentCapabilities = currentHistoricalProviderCapabilities(provider)
    const historicalCapabilities = integrityEraHistoricalCapabilities(provider, currentCapabilities)
    const adapter = new HistoricalProviderFixtureAdapter(currentCapabilities.adapterId, currentCapabilities)
    const providerEngine = new GaepEngine(providerWorkspace, [adapter])
    await providerEngine.createProduct({
      name: `${currentCapabilities.agentLabel} migration fixture`,
      summary: "An authentic legacy Agent Selection migration fixture.",
      problem: "Historical provider settings must not block or bypass safe migration.",
      affectedUsers: "Existing GAEP Founder users",
      desiredOutcome: "A path-free current selection with attributable normalization.",
      successSignals: ["The exact migration preview is accepted"],
      firstWorkflow: "Re-probe and normalize the legacy provider selection.",
      exclusions: ["Execution history migration"],
      profile: "software",
    }, "founder")
    const { schemaVersion: _schemaVersion, ...capabilityFields } = historicalCapabilities
    const legacyCapabilities = legacyAdapterCapabilitiesV1Schema.parse({
      ...capabilityFields,
      executablePath: `/opt/legacy/bin/${currentCapabilities.agentId}`,
    })
    const { observedAt: _observedAt, ...historicalStableCapabilities } = legacyCapabilities
    const model = historicalCapabilities.models[0]!
    const legacySelection = legacyAgentSelectionV1Schema.parse({
      adapterId: currentCapabilities.adapterId,
      agentId: currentCapabilities.agentId,
      modelId: model.id,
      modelTruthClass: model.truthClass,
      modelAlias: model.alias,
      settings: legacySettings,
      selectedAt: "2026-07-21T10:00:00.000Z",
      capabilityDigest: canonicalDigest(historicalStableCapabilities),
      runtimeExecutable: `/opt/legacy/bin/${currentCapabilities.agentId}`,
    })
    const capabilityName = capabilityFileEra === "agent-id"
      ? `capabilities-${currentCapabilities.agentId}.json`
      : `capabilities-${canonicalDigest({
          adapterId: currentCapabilities.adapterId,
          agentId: currentCapabilities.agentId,
        }).slice("sha256:".length)}.json`
    await providerEngine.repository.withLock(() => providerEngine.repository.commitMutation({
      writes: [
        {
          path: providerEngine.repository.resolve("runtime", "selection.json"),
          value: legacySelection,
          schema: legacyAgentSelectionV1Schema,
          governed: true,
        },
        {
          path: providerEngine.repository.resolve("runtime", capabilityName),
          value: legacyCapabilities,
          schema: legacyAdapterCapabilitiesV1Schema,
          governed: true,
        },
      ],
      audit: {
        eventType: "test.legacy-v1-provider.persisted",
        actor: { kind: "system", id: "test.fixture" },
        subjectId: currentCapabilities.agentId,
        payload: { provider, capabilityFileEra },
      },
    }))
    return { providerWorkspace, providerEngine, currentCapabilities, historicalCapabilities, capabilityName }
  }

  it("keeps Product and Initiative identities and lifecycle state separate", async () => {
    const { product, initiative } = await initialize()
    const productBefore = await readFile(join(workspace, ".gaep", "product.json"), "utf8")
    await engine.updateInitiativeState(initiative.id, "active", "Work started", "founder")
    await engine.updateInitiativeState(initiative.id, "completed", "Outcome verified", "founder")
    const productAfter = await readFile(join(workspace, ".gaep", "product.json"), "utf8")

    expect(product.id).not.toBe(initiative.id)
    expect(initiative.productId).toBe(product.id)
    expect(productAfter).toBe(productBefore)
    expect((await engine.readProduct()).lifecycleState).toBe("active")
  })

  it("refuses Product reinitialization and preserves the original manifest identity", async () => {
    const { product } = await initialize()
    const manifestBefore = await readFile(join(workspace, ".gaep", "manifest.json"), "utf8")
    const productBefore = await readFile(join(workspace, ".gaep", "product.json"), "utf8")

    await expect(engine.createProduct({
      name: "Replacement",
      summary: "A replacement that must not be accepted.",
      problem: "Replacing Product identity would orphan existing governed records.",
      affectedUsers: "Existing Product participants",
      desiredOutcome: "The original Product identity remains stable and protected.",
      successSignals: ["Replacement is rejected"],
      firstWorkflow: "Attempt to initialize the same workspace twice.",
      exclusions: [],
      profile: "software",
    }, "founder")).rejects.toThrow(/already initialized/i)

    expect(await readFile(join(workspace, ".gaep", "manifest.json"), "utf8")).toBe(manifestBefore)
    expect(await readFile(join(workspace, ".gaep", "product.json"), "utf8")).toBe(productBefore)
    expect((await engine.readProduct()).id).toBe(product.id)
    expect((await engine.workspaceHealth()).status).toBe("healthy")
  })

  it("enforces explicit Initiative transitions and monotonically increases revisions", async () => {
    const { initiative } = await initialize()
    await expect(
      engine.updateInitiativeState(initiative.id, "completed", "Skip directly", "founder"),
    ).rejects.toThrow("Invalid Initiative transition")

    const active = await engine.updateInitiativeState(initiative.id, "active", "Begin work", "founder")
    const blocked = await engine.updateInitiativeState(initiative.id, "blocked", "Dependency unavailable", "founder")
    const resumed = await engine.updateInitiativeState(initiative.id, "active", "Dependency restored", "founder")
    const completed = await engine.updateInitiativeState(initiative.id, "completed", "Outcome verified", "founder")

    expect([active.revision, blocked.revision, resumed.revision, completed.revision]).toEqual([2, 3, 4, 5])
    await expect(
      engine.updateInitiativeState(initiative.id, "active", "Attempt reopen", "founder"),
    ).rejects.toThrow("Invalid Initiative transition")
  })

  it("requires an active Initiative for Charter creation and Run preparation", async () => {
    const { initiative } = await initialize()
    const charterInput = {
      initiativeId: initiative.id,
      objective: "Run only while the bounded Initiative remains active.",
      permissions: [{ capability: "read-workspace", mode: "allow" as const, scope: ["."] }],
      expectedEffects: ["observe" as const],
      forbiddenActions: ["Do not mutate"],
      stopConditions: ["Stop if the Initiative is not active"],
      requiredEvidence: ["Initiative state"],
    }

    await expect(engine.createCharter(charterInput, "founder")).rejects.toThrow(/must be active.*proposed/i)
    await engine.updateInitiativeState(initiative.id, "active", "Begin governed work", "founder")
    const charter = await engine.createCharter(charterInput, "founder")
    await engine.confirmCharter(charter.id, "founder")
    await engine.updateInitiativeState(initiative.id, "blocked", "Dependency unavailable", "founder")
    await expect(engine.createCharter(charterInput, "founder")).rejects.toThrow(/must be active.*blocked/i)
    await expect(engine.prepareRun(charter.id, "founder")).rejects.toThrow(/Initiative changed|must be active/i)
    await engine.updateInitiativeState(initiative.id, "active", "Dependency restored", "founder")
    await engine.updateInitiativeState(initiative.id, "completed", "Outcome verified", "founder")
    await expect(engine.createCharter(charterInput, "founder")).rejects.toThrow(/must be active.*completed/i)

    const cancelled = await engine.createInitiative({
      title: "Cancelled Initiative",
      outcome: "Verify cancelled work remains non-executable.",
      scope: ["Lifecycle gate"],
      exclusions: [],
    }, "founder")
    await engine.updateInitiativeState(cancelled.id, "cancelled", "Work withdrawn", "founder")
    await expect(engine.createCharter(
      { ...charterInput, initiativeId: cancelled.id },
      "founder",
    )).rejects.toThrow(/must be active.*cancelled/i)
  })

  it("blocks Initiative completion or cancellation while associated Runs are non-terminal", async () => {
    const { initiative } = await initialize()
    await engine.updateInitiativeState(initiative.id, "active", "Begin governed work", "founder")
    const charter = await engine.createCharter({
      initiativeId: initiative.id,
      objective: "Keep Initiative lifecycle truthful while Runs need reconciliation.",
      permissions: [{ capability: "read-workspace", mode: "allow", scope: ["."] }],
      expectedEffects: ["observe"],
      forbiddenActions: ["Do not mutate"],
      stopConditions: ["Stop on lifecycle mismatch"],
      requiredEvidence: ["Run states"],
    }, "founder")
    await engine.confirmCharter(charter.id, "founder")
    const prepared = await engine.prepareRun(charter.id, "founder")
    const running = await engine.prepareRun(charter.id, "founder")
    const paused = await engine.prepareRun(charter.id, "founder")
    const unknown = await engine.prepareRun(charter.id, "founder")
    await engine.markRunState(running.run.id, "running", { kind: "system", id: "test" })
    await engine.markRunState(paused.run.id, "running", { kind: "system", id: "test" })
    await engine.markRunState(paused.run.id, "paused", { kind: "system", id: "test" })
    await engine.markRunState(unknown.run.id, "running", { kind: "system", id: "test" })
    await engine.markRunState(unknown.run.id, "unknown", { kind: "system", id: "test" })

    await expect(
      engine.updateInitiativeState(initiative.id, "completed", "Attempt premature completion", "founder"),
    ).rejects.toThrow(/Runs remain non-terminal/)
    await expect(
      engine.updateInitiativeState(initiative.id, "cancelled", "Attempt premature cancellation", "founder"),
    ).rejects.toThrow(/Runs remain non-terminal/)
    await expect(
      engine.updateInitiativeState(initiative.id, "blocked", "Pause while Runs reconcile", "founder"),
    ).resolves.toMatchObject({ state: "blocked" })

    await engine.markRunState(prepared.run.id, "cancelled", { kind: "human", id: "founder" })
    await engine.markRunState(running.run.id, "failed", { kind: "system", id: "test" })
    await engine.markRunState(paused.run.id, "failed", { kind: "system", id: "test" })
    await engine.markRunState(unknown.run.id, "failed", { kind: "system", id: "test" })
    await engine.updateInitiativeState(initiative.id, "active", "Reconciliation complete", "founder")
    await expect(
      engine.updateInitiativeState(initiative.id, "completed", "All Runs are terminal", "founder"),
    ).resolves.toMatchObject({ state: "completed" })
  })

  it("requires charter confirmation before preparing a safe argument-array invocation", async () => {
    const { initiative } = await initialize()
    await engine.updateInitiativeState(initiative.id, "active", "Begin governed work", "founder")
    const charter = await engine.createCharter({
      initiativeId: initiative.id,
      objective: "Implement and verify the bounded workflow.",
      permissions: [{ capability: "modify-workspace", mode: "ask", scope: ["."] }],
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

  it("re-probes the selected runtime and rejects capability drift before preparing a Run", async () => {
    const adapter = new MutableFakeAdapter()
    engine = new GaepEngine(workspace, [adapter])
    const { initiative } = await initialize()
    await engine.updateInitiativeState(initiative.id, "active", "Begin governed work", "founder")
    const charter = await engine.createCharter({
      initiativeId: initiative.id,
      objective: "Refuse execution after the selected runtime capabilities drift.",
      permissions: [{ capability: "read-workspace", mode: "allow", scope: ["."] }],
      expectedEffects: ["observe"],
      forbiddenActions: ["Do not mutate"],
      stopConditions: ["Stop on capability drift"],
      requiredEvidence: ["Fresh runtime probe"],
    }, "founder")
    await engine.confirmCharter(charter.id, "founder")
    adapter.observed = { ...capabilities, runtimeVersion: "2.0.0" }

    await expect(engine.prepareRun(charter.id, "founder")).rejects.toThrow(/capabilities changed/i)
  })

  it("uses the exact freshly re-probed local binding without persisting its path or fingerprint", async () => {
    const adapter = new MutableFakeAdapter()
    engine = new GaepEngine(workspace, [adapter])
    const { initiative } = await initialize()
    await engine.updateInitiativeState(initiative.id, "active", "Begin governed work", "founder")
    const charter = await engine.createCharter({
      initiativeId: initiative.id,
      objective: "Use only the runtime binding observed immediately before invocation.",
      permissions: [{ capability: "read-workspace", mode: "allow", scope: ["."] }],
      expectedEffects: ["observe"],
      forbiddenActions: ["Do not mutate"],
      stopConditions: ["Stop if the local runtime binding is invalid"],
      requiredEvidence: ["Fresh binding observation"],
    }, "founder")
    await engine.confirmCharter(charter.id, "founder")
    const changedBindingDigest = `sha256:${"d".repeat(64)}` as const
    adapter.runtimeBinding = {
      scope: "machine-local",
      kind: "executable",
      adapterId: capabilities.adapterId,
      agentId: capabilities.agentId,
      executablePath: "/opt/fresh/bin/fake-agent",
      executableFingerprint: {
        requested: "fake-agent",
        canonicalPath: "/opt/fresh/bin/fake-agent",
        digest: changedBindingDigest,
        size: 2,
        modifiedAtMs: 2,
      },
    }
    const { run, invocation } = await engine.prepareRun(charter.id, "founder")
    expect(invocation.executable).toBe("/opt/fresh/bin/fake-agent")

    const freshBinding = adapter.runtimeBinding
    if (freshBinding.kind !== "executable") throw new Error("Expected executable test binding")
    adapter.runtimeBinding = {
      ...freshBinding,
      executableFingerprint: {
        ...freshBinding.executableFingerprint,
        canonicalPath: "/opt/stale/bin/fake-agent",
      },
    }
    await expect(engine.prepareRun(charter.id, "founder")).rejects.toThrow(/fingerprint/i)
    adapter.runtimeBinding = freshBinding

    await engine.markRunState(run.id, "cancelled", { kind: "human", id: "founder" })
    const handoffInput = {
      fromRunId: run.id,
      toCapabilities: capabilities,
      toModelId: "fake-model",
      toSettings: { switched: true },
      reason: "Verify portable handoff persistence",
      completedWork: ["Fresh local binding used"],
      unresolvedMatters: [],
      decisions: [],
      evidence: [],
    }
    const { preview, confirmation } = await acceptedHandoffConfirmation(engine, handoffInput)
    const handoff = await engine.createHandoff(handoffInput, "founder", confirmation)
    expect(handoff.acknowledgedAt).toBeDefined()
    expect(handoff.id).toBe(preview.id)
    expect(handoff.createdAt).toBe(preview.createdAt)
    const capabilityName = (await readdir(join(workspace, ".gaep", "runtime")))
      .find((name) => /^capabilities-[0-9a-f]{64}\.json$/.test(name))!
    const persisted = await Promise.all([
      readFile(join(workspace, ".gaep", "runtime", "selection.json"), "utf8"),
      readFile(join(workspace, ".gaep", "runtime", capabilityName), "utf8"),
      readFile(join(workspace, ".gaep", "sessions", `charter-${charter.id}.json`), "utf8"),
      readFile(join(workspace, ".gaep", "sessions", `run-${run.id}.json`), "utf8"),
      readFile(join(workspace, ".gaep", "handoffs", `${handoff.id}.json`), "utf8"),
      readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"),
    ])
    for (const text of persisted) {
      expect(text).not.toContain(workspace)
      expect(text).not.toContain("/opt/fresh/bin/fake-agent")
      expect(text).not.toContain(changedBindingDigest)
      expect(text).not.toContain("executableFingerprint")
      expect(text).not.toContain("runtimeExecutable")
    }
    const preparedAudit = persisted.at(-1)!.trim().split("\n")
      .map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
      .find((event) => event.eventType === "run.prepared")
    expect(preparedAudit?.payload).not.toHaveProperty("executable")
    expect(preparedAudit?.payload).not.toHaveProperty("args")

  })

  it("keeps legacy runtime records readable for audit and requires explicit transactional migration", async () => {
    await initialize()
    const { capabilityName } = await persistLegacyAgentRuntime()
    const legacyCompatibility = await engine.repository.readAgentSelectionCompatibility()
    if (legacyCompatibility.status !== "migration-required") throw new Error("Expected legacy selection fixture")
    const expectedLegacySelectionDigest = legacySelectionStateDigest(legacyCompatibility)
    expect((await engine.repository.verifyAudit()).valid).toBe(true)
    const legacyHealth = await engine.workspaceHealth()
    expect(legacyHealth.status).toBe("degraded")
    expect(legacyHealth.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "workspace.agent-selection-migration-required",
      "workspace.agent-capabilities-migration-required",
    ]))
    await expect(engine.readSelection()).rejects.toThrow(/explicit re-probe and reconfirmation/i)
    const preview = await engine.previewLegacyAgentSelectionMigration(capabilities)
    expect(preview).toMatchObject({
      targetSelection: { modelId: "fake-model", settings: {} },
      retiredSettingKeys: [],
      legacySelectionDigest: expectedLegacySelectionDigest,
      decision: "accept-exact-legacy-migration-preview",
    })
    await expect(engine.migrateLegacyAgentSelection({
      capabilities,
      decision: "wrong" as "accept-exact-legacy-migration-preview",
      expectedPreviewDigest: preview.expectedPreviewDigest,
      expectedLegacySelectionDigest,
    }, "founder")).rejects.toThrow(/exact migration preview/i)
    await expect(engine.migrateLegacyAgentSelection({
      capabilities,
      decision: preview.decision,
      expectedPreviewDigest: preview.expectedPreviewDigest,
      expectedLegacySelectionDigest: `sha256:${"0".repeat(64)}`,
    }, "founder")).rejects.toThrow(/changed after migration review/i)
    await expect(engine.migrateLegacyAgentSelection({
      capabilities,
      decision: preview.decision,
      expectedPreviewDigest: `sha256:${"1".repeat(64)}`,
      expectedLegacySelectionDigest,
    }, "founder")).rejects.toThrow(/preview changed/i)
    await expect(engine.migrateLegacyAgentSelection({
      capabilities: { ...capabilities, runtimeVersion: "changed" },
      decision: preview.decision,
      expectedPreviewDigest: preview.expectedPreviewDigest,
      expectedLegacySelectionDigest,
    }, "founder")).rejects.toThrow(/changed during migration/i)

    const migrated = await engine.migrateLegacyAgentSelection({
      capabilities,
      decision: preview.decision,
      expectedPreviewDigest: preview.expectedPreviewDigest,
      expectedLegacySelectionDigest,
    }, "founder")
    expect(migrated.schemaVersion).toBe(2)
    expect((await engine.repository.verifyAudit()).valid).toBe(true)
    expect((await engine.workspaceHealth()).status).toBe("healthy")
    const selectionText = await readFile(join(workspace, ".gaep", "runtime", "selection.json"), "utf8")
    const capabilitiesText = await readFile(join(workspace, ".gaep", "runtime", capabilityName), "utf8")
    expect(selectionText).not.toContain("runtimeExecutable")
    expect(capabilitiesText).not.toContain("executablePath")
    expect(selectionText).not.toContain("/opt/legacy")
    expect(capabilitiesText).not.toContain("/opt/legacy")
    const migrationEvent = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
      .find((event) => event.eventType === "agent.selection.migrated")
    expect(migrationEvent?.payload).toMatchObject({
      previousPortableSelectionDigest: preview.previousPortableSelectionDigest,
      normalizationProfileId: "gaep.legacy-agent-selection.v1-to-v2",
      normalizationProfileVersion: 1,
      normalizationDigest: preview.expectedPreviewDigest,
      retainedSettingKeys: [],
      droppedSettingKeys: [],
      currentCapabilityDigest: migrated.capabilityDigest,
      historyDisposition: "no-bound-artifacts",
      exactMigrationPreviewAccepted: true,
      machineLocalDataPersisted: false,
    })
  })

  it.each([
    {
      provider: "codex" as const,
      legacySettings: {
        reasoningEffort: "high",
        sandbox: "read-only",
        approvalPolicy: "fail-closed-noninteractive",
      },
      expectedSettings: { reasoningEffort: "high" },
      retiredSettingKeys: ["approvalPolicy", "sandbox"],
    },
    {
      provider: "claude" as const,
      legacySettings: {
        effort: "high",
        permissionMode: "plan",
        allowedTools: ["Read", "Grep"],
        disallowedTools: ["Write", "Bash"],
        maxBudgetUsd: 12,
      },
      expectedSettings: { effort: "high", maxBudgetUsd: 12 },
      retiredSettingKeys: ["allowedTools", "disallowedTools", "permissionMode"],
    },
  ])("normalizes integrity-era v1 $provider settings", async ({
    provider,
    legacySettings,
    expectedSettings,
    retiredSettingKeys,
  }) => {
    const fixture = await legacyProviderFixture(provider, legacySettings, "identity-digest")
    const compatibility = await fixture.providerEngine.repository.readAgentSelectionCompatibility()
    if (compatibility.status !== "migration-required") throw new Error("Expected authentic v1 selection")
    const preview = await fixture.providerEngine.previewLegacyAgentSelectionMigration(fixture.currentCapabilities)
    expect(preview.targetSelection).toMatchObject({
      adapterId: fixture.currentCapabilities.adapterId,
      agentId: fixture.currentCapabilities.agentId,
      modelId: fixture.currentCapabilities.models[0]!.id,
      settings: expectedSettings,
      selectedAt: "2026-07-21T10:00:00.000Z",
    })
    expect(preview.retiredSettingKeys).toEqual(retiredSettingKeys)
    await fixture.providerEngine.migrateLegacyAgentSelection({
      capabilities: fixture.currentCapabilities,
      decision: preview.decision,
      expectedPreviewDigest: preview.expectedPreviewDigest,
      expectedLegacySelectionDigest: preview.legacySelectionDigest,
    }, "founder")

    const runtimeNames = await readdir(join(fixture.providerWorkspace, ".gaep", "runtime"))
    expect(runtimeNames).toContain(fixture.capabilityName)
    const persistedRuntime = await Promise.all(runtimeNames
      .filter((name) => name.endsWith(".json"))
      .map((name) => readFile(join(fixture.providerWorkspace, ".gaep", "runtime", name), "utf8")))
    for (const text of persistedRuntime) {
      expect(text).not.toContain("runtimeExecutable")
      expect(text).not.toContain("executablePath")
      expect(text).not.toContain("/opt/legacy")
    }
    const auditText = await readFile(join(fixture.providerWorkspace, ".gaep", "audit", "events.jsonl"), "utf8")
    expect(auditText).not.toContain("/opt/legacy")
  })

  it("rejects a legacy selection that is not bound to its historical capability snapshot", async () => {
    const fixture = await legacyProviderFixture("codex", {
      reasoningEffort: "high",
      sandbox: "read-only",
      approvalPolicy: "fail-closed-noninteractive",
    })
    const selectionPath = fixture.providerEngine.repository.resolve("runtime", "selection.json")
    const rawSelection = JSON.parse(await readFile(selectionPath, "utf8")) as Record<string, unknown>
    const mismatchedSelection = legacyAgentSelectionV1Schema.parse({
      ...rawSelection,
      capabilityDigest: `sha256:${"0".repeat(64)}`,
    })
    await fixture.providerEngine.repository.withLock(() => fixture.providerEngine.repository.commitMutation({
      writes: [{
        path: selectionPath,
        value: mismatchedSelection,
        schema: legacyAgentSelectionV1Schema,
        governed: true,
      }],
      audit: {
        eventType: "test.legacy-capability-binding.mismatched",
        actor: { kind: "system", id: "test.fixture" },
        payload: { expectedFailure: true },
      },
    }))
    await expect(
      fixture.providerEngine.previewLegacyAgentSelectionMigration(fixture.currentCapabilities),
    ).rejects.toThrow(/capability digest does not match.*historical capability snapshot/iu)
  })

  it("quarantines the pre-integrity agent-id capability era instead of synthesizing trusted state", async () => {
    const fixture = await legacyProviderFixture("codex", {
      reasoningEffort: "high",
      sandbox: "workspace-write",
      approvalPolicy: "on-request",
      search: false,
      profile: "/Users/founder/.codex/config.toml",
    }, "agent-id")
    const manifestPath = join(fixture.providerWorkspace, ".gaep", "manifest.json")
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>
    delete manifest.auditCheckpointRequired
    delete manifest.governedStateRequired
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    await Promise.all([
      rm(join(fixture.providerWorkspace, ".gaep", "audit", "checkpoint.json")),
      rm(join(fixture.providerWorkspace, ".gaep", "audit", "state.json")),
    ])
    await expect(
      fixture.providerEngine.previewLegacyAgentSelectionMigration(fixture.currentCapabilities),
    ).rejects.toThrow(/predates checkpoint and governed-state support.*integrity bootstrap/iu)
  })

  it("does not misclassify a damaged modern integrity workspace as a pre-integrity legacy repository", async () => {
    const fixture = await legacyProviderFixture("codex", {
      reasoningEffort: "high",
      sandbox: "read-only",
      approvalPolicy: "fail-closed-noninteractive",
    })
    await rm(join(fixture.providerWorkspace, ".gaep", "audit", "state.json"))
    await expect(
      fixture.providerEngine.previewLegacyAgentSelectionMigration(fixture.currentCapabilities),
    ).rejects.toThrow(/audit is invalid|governed-state|state/iu)
    await expect(
      fixture.providerEngine.previewLegacyAgentSelectionMigration(fixture.currentCapabilities),
    ).rejects.not.toThrow(/integrity bootstrap/iu)
  })

  it("blocks legacy current-setting normalization when the historical value is no longer valid", async () => {
    const fixture = await legacyProviderFixture("claude", {
      effort: "high",
      permissionMode: "default",
      allowedTools: [],
      disallowedTools: [],
      maxBudgetUsd: 0,
    })
    await expect(
      fixture.providerEngine.previewLegacyAgentSelectionMigration(fixture.currentCapabilities),
    ).rejects.toThrow(/retained settings are incompatible.*at least 0\.01/iu)
  })

  it("blocks legacy normalization when any selection-bound execution artifact exists", async () => {
    const { initiative } = await initialize()
    await engine.updateInitiativeState(initiative.id, "active", "Begin governed work", "founder")
    await engine.createCharter({
      initiativeId: initiative.id,
      objective: "Create selection-bound history before legacy normalization.",
      permissions: [{ capability: "read-workspace", mode: "allow", scope: ["."] }],
      expectedEffects: ["observe"],
      forbiddenActions: ["Do not mutate"],
      stopConditions: ["Stop after creating the fixture"],
      requiredEvidence: [],
    }, "founder")
    await persistLegacyAgentRuntime()
    await expect(engine.previewLegacyAgentSelectionMigration(capabilities)).rejects.toThrow(
      /dependent Charter, Run, Handoff, or managed history/iu,
    )
  })

  it("rejects absolute Charter permission scopes before persistence", async () => {
    const { initiative } = await initialize()
    await engine.updateInitiativeState(initiative.id, "active", "Begin governed work", "founder")
    await expect(engine.createCharter({
      initiativeId: initiative.id,
      objective: "Reject host-bound permission scopes.",
      permissions: [{ capability: "read-workspace", mode: "allow", scope: [workspace] }],
      expectedEffects: ["observe"],
      forbiddenActions: ["Do not mutate"],
      stopConditions: ["Stop on non-portable scope"],
      requiredEvidence: ["Schema rejection"],
    }, "founder")).rejects.toThrow(/workspace-relative/i)
    expect(await readdir(join(workspace, ".gaep", "sessions"))).toEqual([])
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
    await engine.updateInitiativeState(initiative.id, "active", "Begin governed work", "founder")
    const selection = await engine.readSelection()
    expect(selection.modelTruthClass).toBe("observed")
    expect(selection.modelAlias).toBe(false)

    const charter = await engine.createCharter({
      initiativeId: initiative.id,
      objective: "Exercise a governed switch.",
      permissions: [{ capability: "read-workspace", mode: "allow", scope: ["."] }],
      expectedEffects: ["observe"],
      forbiddenActions: ["Do not mutate the workspace"],
      stopConditions: ["Stop if mutation is required"],
      requiredEvidence: ["Observed state"],
    }, "founder")
    await engine.confirmCharter(charter.id, "founder")
    const { run } = await engine.prepareRun(charter.id, "founder")
    await engine.markRunState(run.id, "running", { kind: "system", id: "test" })

    const input = {
      fromRunId: run.id,
      toCapabilities: capabilities,
      toModelId: "fake-model",
      toSettings: {},
      reason: "Switch execution context",
      completedWork: [],
      unresolvedMatters: ["Run is active"],
      decisions: [],
      evidence: [],
    }
    const confirmation = {
      decision: "accept-exact-handoff-preview" as const,
      expectedReviewDigest: `sha256:${"0".repeat(64)}` as const,
      expectedCurrentSelectionDigest: canonicalDigest(await engine.readSelection()) as `sha256:${string}`,
      expectedHandoffId: "00000000-0000-4000-8000-000000000099",
      expectedCreatedAt: "2026-07-23T00:00:00.000Z",
    }
    await expect(engine.createHandoff(input, "founder", confirmation)).rejects.toThrow(/Run|complete|cancel|reconcile/i)
    await engine.markRunState(run.id, "unknown", { kind: "system", id: "test" })
    await expect(engine.createHandoff(input, "founder", confirmation)).rejects.toThrow(/Run|complete|cancel|reconcile/i)
  })

  it("treats identical selection as a no-op and requires an exact optimistic guard for material changes", async () => {
    await initialize()
    const before = await engine.readSelection()
    const selectionPath = join(workspace, ".gaep", "runtime", "selection.json")
    const persistedBefore = await readFile(selectionPath, "utf8")

    await expect(engine.selectAgent(capabilities, "fake-model", {}, "founder")).rejects.toThrow(/explicitly bound/i)
    expect(await engine.selectAgent(capabilities, "fake-model", {}, "founder", {
      expectedCurrentSelectionDigest: canonicalDigest(before) as `sha256:${string}`,
    })).toEqual(before)
    expect(await readFile(selectionPath, "utf8")).toBe(persistedBefore)
    await expect(engine.selectAgent(capabilities, "fake-model", { changed: true }, "founder"))
      .rejects.toThrow(/explicitly bound/i)
    await expect(engine.selectAgent(capabilities, "fake-model", { changed: true }, "founder", {
      expectedCurrentSelectionDigest: `sha256:${"0".repeat(64)}`,
    })).rejects.toThrow(/explicitly bound/i)

    const changed = await engine.selectAgent(capabilities, "fake-model", { changed: true }, "founder", {
      expectedCurrentSelectionDigest: canonicalDigest(before) as `sha256:${string}`,
    })
    expect(changed.settings).toEqual({ changed: true })
    expect(await readFile(selectionPath, "utf8")).not.toBe(persistedBefore)
  })

  it("prevents direct selection from bypassing unresolved work or the required terminal-Run handoff", async () => {
    const { initiative } = await initialize()
    await engine.updateInitiativeState(initiative.id, "active", "Begin governed work", "founder")
    const charter = await engine.createCharter({
      initiativeId: initiative.id,
      objective: "Prove selection switching cannot bypass execution history.",
      permissions: [{ capability: "read-workspace", mode: "allow", scope: ["."] }],
      expectedEffects: ["observe"],
      forbiddenActions: ["Do not mutate"],
      stopConditions: ["Stop before switching"],
      requiredEvidence: ["Engine rejection"],
    }, "founder")
    await engine.confirmCharter(charter.id, "founder")
    const { run } = await engine.prepareRun(charter.id, "founder")
    const expectedCurrentSelectionDigest = canonicalDigest(await engine.readSelection()) as `sha256:${string}`

    await expect(engine.selectAgent(capabilities, "fake-model", {}, "founder", {
      expectedCurrentSelectionDigest,
    })).rejects.toThrow(/work.*unresolved|Run .*prepared/i)
    await expect(engine.selectAgent(capabilities, "fake-model", { changed: true }, "founder", {
      expectedCurrentSelectionDigest,
    })).rejects.toThrow(/work.*unresolved|Run .*prepared/i)
    await engine.markRunState(run.id, "cancelled", { kind: "human", id: "founder" })
    await expect(engine.selectAgent(capabilities, "fake-model", { changed: true }, "founder", {
      expectedCurrentSelectionDigest,
    })).rejects.toThrow(/requires an exact accepted handoff/i)

    const handoffInput = {
      fromRunId: run.id,
      toCapabilities: capabilities,
      toModelId: "fake-model",
      toSettings: { changed: true },
      reason: "Complete the exact required handoff",
      completedWork: ["Source Run cancelled"],
      unresolvedMatters: [],
      decisions: [],
      evidence: [],
    }
    const { confirmation } = await acceptedHandoffConfirmation(engine, handoffInput)
    await engine.createHandoff(handoffInput, "founder", confirmation)
    const handedOffSelection = await engine.readSelection()
    const changedAgain = await engine.selectAgent(capabilities, "fake-model", { changedAgain: true }, "founder", {
      expectedCurrentSelectionDigest: canonicalDigest(handedOffSelection) as `sha256:${string}`,
    })
    expect(changedAgain.settings).toEqual({ changedAgain: true })
  })

  it("requires a handoff to use the newest terminal Run for the current selection", async () => {
    const { initiative } = await initialize()
    await engine.updateInitiativeState(initiative.id, "active", "Begin governed work", "founder")
    const charter = await engine.createCharter({
      initiativeId: initiative.id,
      objective: "Create two terminal Runs and preserve the latest continuity evidence.",
      permissions: [{ capability: "read-workspace", mode: "allow", scope: ["."] }],
      expectedEffects: ["observe"],
      forbiddenActions: ["Do not mutate"],
      stopConditions: ["Stop before switching"],
      requiredEvidence: ["Newest Run enforcement"],
    }, "founder")
    await engine.confirmCharter(charter.id, "founder")
    const first = await engine.prepareRun(charter.id, "founder")
    const second = await engine.prepareRun(charter.id, "founder")
    await engine.markRunState(first.run.id, "cancelled", { kind: "human", id: "founder" })
    await engine.markRunState(second.run.id, "cancelled", { kind: "human", id: "founder" })
    const terminal = (await engine.listRuns()).filter((run) => run.state === "cancelled")
    expect(terminal).toHaveLength(2)
    const inputFor = (fromRunId: string) => ({
      fromRunId,
      toCapabilities: capabilities,
      toModelId: "fake-model",
      toSettings: { switched: true },
      reason: "Switch from the latest completed context",
      completedWork: ["Both Runs are terminal"],
      unresolvedMatters: [],
      decisions: [],
      evidence: [],
    })

    await expect(engine.previewHandoff(inputFor(terminal[1]!.id))).rejects.toThrow(/newest terminal Run/i)
    await expect(engine.previewHandoff(inputFor(terminal[0]!.id))).resolves.toMatchObject({ fromRunId: terminal[0]!.id })
  })

  it("preserves immutable capability snapshots across capability changes and repeat observations", async () => {
    const adapter = new MutableFakeAdapter()
    engine = new GaepEngine(workspace, [adapter])
    await initialize()
    const firstSelection = await engine.readSelection()
    const firstName = `capabilities-${firstSelection.capabilityDigest.slice("sha256:".length)}.json`
    const firstPath = join(workspace, ".gaep", "runtime", firstName)
    const firstText = await readFile(firstPath, "utf8")

    adapter.observed = { ...capabilities, runtimeVersion: "2.0.0", observedAt: "2026-07-23T01:00:00.000Z" }
    const secondSelection = await engine.selectAgent(adapter.observed, "fake-model", {}, "founder", {
      expectedCurrentSelectionDigest: canonicalDigest(firstSelection) as `sha256:${string}`,
    })
    const secondName = `capabilities-${secondSelection.capabilityDigest.slice("sha256:".length)}.json`
    const secondPath = join(workspace, ".gaep", "runtime", secondName)
    const secondText = await readFile(secondPath, "utf8")
    expect(secondName).not.toBe(firstName)
    expect(await readFile(firstPath, "utf8")).toBe(firstText)

    adapter.observed = { ...adapter.observed, observedAt: "2026-07-23T02:00:00.000Z" }
    expect(await engine.selectAgent(adapter.observed, "fake-model", {}, "founder", {
      expectedCurrentSelectionDigest: canonicalDigest(secondSelection) as `sha256:${string}`,
    })).toEqual(secondSelection)
    expect(await readFile(secondPath, "utf8")).toBe(secondText)
    expect((await readdir(join(workspace, ".gaep", "runtime"))).filter((name) =>
      /^capabilities-[0-9a-f]{64}\.json$/u.test(name))).toEqual(expect.arrayContaining([firstName, secondName]))
  })

  it("marks a run left running across host restart as unknown, never completed", async () => {
    const { initiative } = await initialize()
    await engine.updateInitiativeState(initiative.id, "active", "Begin governed work", "founder")
    const charter = await engine.createCharter({
      initiativeId: initiative.id,
      objective: "Verify interrupted-run recovery.",
      permissions: [{ capability: "read-workspace", mode: "allow", scope: ["."] }],
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

  it("binds a Charter to exact Product, Initiative, and agent-selection state", async () => {
    const { initiative } = await initialize()
    await engine.updateInitiativeState(initiative.id, "active", "Begin governed work", "founder")
    const staleInitiativeCharter = await engine.createCharter({
      initiativeId: initiative.id,
      objective: "Reject a Charter after its bounded Initiative changes.",
      permissions: [{ capability: "read-workspace", mode: "allow", scope: ["."] }],
      expectedEffects: ["observe"],
      forbiddenActions: ["Do not mutate"],
      stopConditions: ["Stop on state drift"],
      requiredEvidence: ["Binding failure"],
    }, "founder")
    await engine.updateInitiativeState(initiative.id, "blocked", "Dependency became unavailable", "founder")
    await expect(engine.confirmCharter(staleInitiativeCharter.id, "founder")).rejects.toThrow(
      /Initiative changed/,
    )

    await engine.updateInitiativeState(initiative.id, "active", "Dependency restored", "founder")
    const charter = await engine.createCharter({
      initiativeId: initiative.id,
      objective: "Reject execution after the selected agent configuration changes.",
      permissions: [{ capability: "read-workspace", mode: "allow", scope: ["."] }],
      expectedEffects: ["observe"],
      forbiddenActions: ["Do not mutate"],
      stopConditions: ["Stop on selection drift"],
      requiredEvidence: ["Binding failure"],
    }, "founder")
    await engine.confirmCharter(charter.id, "founder")
    await engine.selectAgent(capabilities, "fake-model", { changed: true }, "founder", {
      expectedCurrentSelectionDigest: canonicalDigest(await engine.readSelection()) as `sha256:${string}`,
    })
    await expect(engine.prepareRun(charter.id, "founder")).rejects.toThrow(/Agent, model, or settings changed/)
  })

  it("enforces Run transitions and terminal-state immutability", async () => {
    const { initiative } = await initialize()
    await engine.updateInitiativeState(initiative.id, "active", "Begin governed work", "founder")
    const charter = await engine.createCharter({
      initiativeId: initiative.id,
      objective: "Exercise the explicit Run lifecycle.",
      permissions: [{ capability: "read-workspace", mode: "allow", scope: ["."] }],
      expectedEffects: ["observe"],
      forbiddenActions: ["Do not mutate"],
      stopConditions: ["Stop after observation"],
      requiredEvidence: ["Lifecycle events"],
    }, "founder")
    await engine.confirmCharter(charter.id, "founder")
    const { run } = await engine.prepareRun(charter.id, "founder")

    await expect(
      engine.markRunState(run.id, "completed", { kind: "system", id: "test" }),
    ).rejects.toThrow("Invalid Run transition")
    const running = await engine.markRunState(run.id, "running", { kind: "system", id: "test" })
    const completed = await engine.markRunState(run.id, "completed", { kind: "system", id: "test" })
    expect(running.revision).toBe(2)
    expect(completed.revision).toBe(3)
    expect(completed.startedAt).toBeDefined()
    expect(completed.endedAt).toBeDefined()
    await expect(
      engine.markRunState(run.id, "running", { kind: "system", id: "test" }),
    ).rejects.toThrow("Invalid Run transition")

    const launchFailure = await engine.prepareRun(charter.id, "founder")
    const failed = await engine.markRunState(
      launchFailure.run.id,
      "failed",
      { kind: "system", id: "test.launch" },
    )
    expect(failed.state).toBe("failed")
    expect(failed.startedAt).toBeUndefined()
    expect(failed.endedAt).toBeDefined()
  })

  it("recovers every interrupted Run sequentially without lock contention", async () => {
    const { initiative } = await initialize()
    await engine.updateInitiativeState(initiative.id, "active", "Begin governed work", "founder")
    const charter = await engine.createCharter({
      initiativeId: initiative.id,
      objective: "Recover multiple interrupted Runs.",
      permissions: [{ capability: "read-workspace", mode: "allow", scope: ["."] }],
      expectedEffects: ["observe"],
      forbiddenActions: ["Do not mutate"],
      stopConditions: ["Stop on restart"],
      requiredEvidence: ["Recovered states"],
    }, "founder")
    await engine.confirmCharter(charter.id, "founder")
    const first = await engine.prepareRun(charter.id, "founder")
    const second = await engine.prepareRun(charter.id, "founder")
    await engine.markRunState(first.run.id, "running", { kind: "system", id: "test" })
    await engine.markRunState(second.run.id, "running", { kind: "system", id: "test" })

    const restarted = new GaepEngine(workspace, [new FakeAdapter()])
    const recovered = await restarted.recoverInterruptedRuns("test.restart")
    expect(recovered).toHaveLength(2)
    expect(recovered.every((run) => run.state === "unknown")).toBe(true)
  })

  it("detects audit truncation and deletion and refuses mutation afterward", async () => {
    const { initiative } = await initialize()
    const auditPath = join(workspace, ".gaep", "audit", "events.jsonl")
    const checkpointPath = join(workspace, ".gaep", "audit", "checkpoint.json")
    const original = await readFile(auditPath, "utf8")
    const checkpoint = await readFile(checkpointPath, "utf8")
    const lines = original.trim().split("\n")
    await writeFile(auditPath, `${lines.slice(0, -1).join("\n")}\n`)

    const truncated = await engine.repository.verifyAudit()
    expect(truncated.valid).toBe(false)
    expect(truncated.error).toMatch(/checkpoint|count/i)
    const initiativeBefore = await readFile(
      join(workspace, ".gaep", "initiatives", `${initiative.id}.json`),
      "utf8",
    )
    await expect(
      engine.updateInitiativeState(initiative.id, "active", "Attempt mutation", "founder"),
    ).rejects.toThrow(/audit is invalid/i)
    expect(await readFile(
      join(workspace, ".gaep", "initiatives", `${initiative.id}.json`),
      "utf8",
    )).toBe(initiativeBefore)

    await writeFile(auditPath, original)
    expect((await engine.repository.verifyAudit()).valid).toBe(true)
    await rm(checkpointPath)
    const checkpointDeleted = await engine.repository.verifyAudit()
    expect(checkpointDeleted.valid).toBe(false)
    expect(checkpointDeleted.error).toMatch(/checkpoint is missing/i)
    await writeFile(checkpointPath, checkpoint)
    expect((await engine.repository.verifyAudit()).valid).toBe(true)
    await rm(auditPath)
    const deleted = await engine.repository.verifyAudit()
    expect(deleted.valid).toBe(false)
    expect(deleted.error).toMatch(/missing/i)
  })

  it("reports manifest mismatch as invalid health and blocks Product reads", async () => {
    await initialize()
    const manifestPath = join(workspace, ".gaep", "manifest.json")
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>
    manifest.productId = randomUUID()
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

    const health = await engine.workspaceHealth()
    expect(health.status).toBe("invalid")
    expect(health.issues.some((issue) => issue.code === "workspace.product-id-mismatch")).toBe(true)
    await expect(engine.readProduct()).rejects.toThrow(/identity do not match/i)
  })

  it("detects valid-JSON edits to every governed record class and fails closed", async () => {
    const { initiative } = await initialize()
    await engine.updateInitiativeState(initiative.id, "active", "Begin governed work", "founder")
    const charter = await engine.createCharter({
      initiativeId: initiative.id,
      objective: "Create every governed runtime record for integrity testing.",
      permissions: [{ capability: "read-workspace", mode: "allow", scope: ["."] }],
      expectedEffects: ["observe"],
      forbiddenActions: ["Do not mutate"],
      stopConditions: ["Stop after record creation"],
      requiredEvidence: ["Digest-index verification"],
    }, "founder")
    await engine.confirmCharter(charter.id, "founder")
    const { run } = await engine.prepareRun(charter.id, "founder")
    await engine.markRunState(run.id, "cancelled", { kind: "human", id: "founder" })
    const handoffInput = {
      fromRunId: run.id,
      toCapabilities: capabilities,
      toModelId: "fake-model",
      toSettings: { switched: true },
      reason: "Create a governed handoff record",
      completedWork: ["Integrity fixture"],
      unresolvedMatters: [],
      decisions: [],
      evidence: [],
    }
    const { confirmation } = await acceptedHandoffConfirmation(engine, handoffInput)
    const handoff = await engine.createHandoff(handoffInput, "founder", confirmation)
    const capabilitySnapshot = (await readdir(join(workspace, ".gaep", "runtime")))
      .find((name) => /^capabilities-[0-9a-f]{64}\.json$/.test(name))
    expect(capabilitySnapshot).toBeDefined()

    const cases: Array<{ path: string; mutate: (value: Record<string, unknown>) => void }> = [
      {
        path: join(workspace, ".gaep", "manifest.json"),
        mutate: (value) => { value.engineVersion = `${String(value.engineVersion)}-edited` },
      },
      {
        path: join(workspace, ".gaep", "product.json"),
        mutate: (value) => { value.summary = `${String(value.summary)} edited` },
      },
      {
        path: join(workspace, ".gaep", "initiatives", `${initiative.id}.json`),
        mutate: (value) => { value.title = `${String(value.title)} edited` },
      },
      {
        path: join(workspace, ".gaep", "runtime", "selection.json"),
        mutate: (value) => { value.settings = { directEdit: true } },
      },
      {
        path: join(workspace, ".gaep", "runtime", capabilitySnapshot!),
        mutate: (value) => { value.runtimeVersion = `${String(value.runtimeVersion)}-edited` },
      },
      {
        path: join(workspace, ".gaep", "sessions", `charter-${charter.id}.json`),
        mutate: (value) => { value.objective = `${String(value.objective)} edited` },
      },
      {
        path: join(workspace, ".gaep", "sessions", `run-${run.id}.json`),
        mutate: (value) => { value.providerSessionRef = `sha256:${"c".repeat(64)}` },
      },
      {
        path: join(workspace, ".gaep", "handoffs", `${handoff.id}.json`),
        mutate: (value) => { value.reason = `${String(value.reason)} edited` },
      },
    ]

    for (const testCase of cases) {
      const original = await readFile(testCase.path, "utf8")
      const edited = JSON.parse(original) as Record<string, unknown>
      testCase.mutate(edited)
      await writeFile(testCase.path, `${JSON.stringify(edited, null, 2)}\n`)
      const health = await engine.workspaceHealth()
      expect(health.status, testCase.path).toBe("invalid")
      expect(health.audit.error, testCase.path).toMatch(/differs from its committed digest/)
      await expect(engine.createInitiative({
        title: "Mutation must fail",
        outcome: "No new record is committed while integrity is invalid.",
        scope: ["Integrity gate"],
        exclusions: [],
      }, "founder")).rejects.toThrow(/integrity|audit is invalid/i)
      await writeFile(testCase.path, original)
      expect((await engine.workspaceHealth()).status, testCase.path).toBe("healthy")
    }
  })

  it("recovers an atomic Handoff and selection switch after an interrupted commit", async () => {
    const { initiative } = await initialize()
    await engine.updateInitiativeState(initiative.id, "active", "Begin governed work", "founder")
    const charter = await engine.createCharter({
      initiativeId: initiative.id,
      objective: "Create a source Run for an atomic agent switch.",
      permissions: [{ capability: "read-workspace", mode: "allow", scope: ["."] }],
      expectedEffects: ["observe"],
      forbiddenActions: ["Do not mutate"],
      stopConditions: ["Stop before switching"],
      requiredEvidence: ["Atomic handoff"],
    }, "founder")
    await engine.confirmCharter(charter.id, "founder")
    const { run } = await engine.prepareRun(charter.id, "founder")
    await engine.markRunState(run.id, "cancelled", { kind: "human", id: "founder" })

    let injected = false
    const failing = new GaepEngine(workspace, [new FakeAdapter()], {
      faultInjector: (point) => {
        if (!injected && point === "after-record-writes") {
          injected = true
          throw new Error("Injected atomic-switch failure")
        }
      },
    })
    const input = {
      fromRunId: run.id,
      toCapabilities: capabilities,
      toModelId: "fake-model",
      toSettings: { switched: true },
      reason: "Switch configuration atomically",
      completedWork: ["Source Run stopped"],
      unresolvedMatters: [],
      decisions: [],
      evidence: [],
    }
    const { preview, confirmation } = await acceptedHandoffConfirmation(failing, input)
    expect(preview.workspaceBaseline.truthClass).toBe("unknown")
    expect(preview.workspaceBaseline.dirty).toBeNull()
    await expect(failing.createHandoff(input, "founder", {
      ...confirmation,
      expectedCurrentSelectionDigest: `sha256:${"0".repeat(64)}`,
    })).rejects.toThrow(/Agent Selection changed after handoff review/)
    await expect(failing.createHandoff(input, "founder", {
      ...confirmation,
      expectedReviewDigest: `sha256:${"0".repeat(64)}`,
    })).rejects.toThrow(/changed after review/)
    await expect(failing.createHandoff(input, "founder", confirmation)).rejects.toThrow("Injected atomic-switch failure")

    const journal = JSON.parse(
      await readFile(join(workspace, ".gaep", "runtime", "transaction.json"), "utf8"),
    ) as { writes: Array<{ relativePath: string }> }
    const handoffPath = journal.writes.find((write) => write.relativePath.startsWith("handoffs/"))?.relativePath
    expect(handoffPath).toBeDefined()

    const recovered = new GaepEngine(workspace, [new FakeAdapter()])
    expect((await recovered.workspaceHealth()).status).toBe("healthy")
    expect((await recovered.readSelection()).settings).toEqual({ switched: true })
    const handoff = await recovered.repository.readJson(
      recovered.repository.resolve(...handoffPath!.split("/")),
      handoffSchema,
    )
    expect(handoff.toAgent.settings).toEqual({ switched: true })
    expect(handoff.workspaceBaseline.truthClass).toBe("unknown")
    expect(handoff.workspaceBaseline.dirty).toBeNull()
  })

  it("rejects traversal identifiers and client-forged capability snapshots", async () => {
    await initialize()
    await expect(engine.readInitiative("../../outside")).rejects.toThrow(/must be a UUID/)
    expect(() => engine.repository.resolve("..", "outside.json")).toThrow(/escapes/)

    await expect(engine.selectAgent(
      { ...capabilities, runtimeVersion: "forged" },
      "fake-model",
      {},
      "founder",
    )).rejects.toThrow(/not produced by the registered adapter/)
  })
})
