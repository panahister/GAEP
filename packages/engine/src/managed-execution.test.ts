import { randomUUID } from "node:crypto"
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import type {
  AdapterCapabilities,
  AgentSelection,
  ContextItem,
  ContextTrustDimensions,
  ExecutionCharter,
  ManagedEvidenceEvent,
  ToolDefinition,
  WorkflowPlan,
  WorkflowStep,
} from "@gaep/contracts"
import { adapterCapabilitiesSnapshotSchema, managedRunRecordSchema, runSchema } from "@gaep/contracts"
import {
  DeterministicManualAdapter,
  ManagedStageRegistry,
  canonicalDigest,
  capabilityDigest,
  fingerprintExecutable,
  type AdapterProbeResult,
  type AdapterRuntimeBinding,
  type AgentAdapter,
  type AgentInvocation,
} from "@gaep/agent-sdk"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { GaepEngine } from "./engine.js"
import {
  compileManagedCodexPolicy,
  compileManagedWorkflowOrder,
  workspacePathWithinEnvelope,
} from "./managed-execution.js"
import type { ManagedWorkflowGateEvaluator } from "./managed-execution.js"

const workspaceRoot = { kind: "workspace-relative" as const, path: "." }
const fakeCodexServer = fileURLToPath(new URL("../../agent-sdk/test/fixtures/fake-codex-app-server.mjs", import.meta.url))
const systemGateEvaluator = {
  kind: "system" as const,
  id: "gaep.managed-test",
  version: "1",
  digest: canonicalDigest({ kind: "system", id: "gaep.managed-test", version: "1" }) as `sha256:${string}`,
}

class FakeManagedCodexAdapter implements AgentAdapter {
  readonly id = "gaep.codex-cli"

  constructor(private readonly executable: string) {}

  async probe(): Promise<AdapterProbeResult> {
    const capabilities = adapterCapabilitiesSnapshotSchema.parse({
      schemaVersion: 1,
      adapterId: this.id,
      adapterVersion: "test",
      agentId: "codex-cli",
      agentLabel: "Fake managed Codex",
      runtimeVersion: "test",
      detected: true,
      executionInterface: "stdio-rpc",
      interfaceMaturity: "stable",
      supportsResume: true,
      supportsCancel: true,
      supportsCheckpoints: false,
      supportsModelDiscovery: true,
      supportsToolSelection: true,
      settings: [],
      models: [{
        id: "fake-model",
        label: "Fake model",
        reasoningOptions: [],
        inputModalities: ["text"],
        truthClass: "observed",
        alias: false,
      }],
      limitations: ["Test-only local app-server fixture"],
      observedAt: "2026-01-01T00:00:00.000Z",
    })
    return {
      capabilities,
      runtimeBinding: {
        scope: "machine-local",
        kind: "executable",
        adapterId: this.id,
        agentId: "codex-cli",
        executablePath: this.executable,
        executableFingerprint: await fingerprintExecutable(this.executable),
      },
    }
  }

  validateSelection(selection: AgentSelection, capabilities: AdapterCapabilities): string[] {
    return selection.adapterId === this.id &&
      selection.agentId === "codex-cli" &&
      selection.modelId === "fake-model" &&
      selection.capabilityDigest === capabilityDigest(capabilities)
      ? []
      : ["Fake managed Codex selection mismatch"]
  }

  buildInvocation(
    _selection: AgentSelection,
    _charter: ExecutionCharter,
    _workspacePath: string,
    _prompt: string,
    _runtimeBinding: AdapterRuntimeBinding,
  ): AgentInvocation {
    throw new Error("Fake managed Codex is app-server only")
  }
}

const satisfyWorkflowGate: ManagedWorkflowGateEvaluator = async (request) => ({
  status: "satisfied",
  basis: "system-evaluator",
  evaluator: systemGateEvaluator,
  evidenceDigest: canonicalDigest({
    stepId: request.stepId,
    attempt: request.attempt,
    phase: request.phase,
    criteriaDigest: request.criteriaDigest,
    eventsDigest: request.eventsDigest,
  }) as `sha256:${string}`,
})

describe("managed execution engine", () => {
  let workspace: string
  let engine: GaepEngine
  let adapter: DeterministicManualAdapter

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "gaep-managed-engine-"))
    adapter = new DeterministicManualAdapter()
    engine = new GaepEngine(workspace, [adapter])
  })

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true })
  })

  function trust(recipient = "manual"): ContextTrustDimensions {
    return {
      semanticAuthority: {
        standing: "advisory",
        domain: "Managed execution fixture",
        owner: "founder",
        scope: ["Local test"],
        precedence: 10,
      },
      epistemicRole: "reference",
      sourceAuthenticity: "verified",
      contentIntegrity: "verified",
      confidentiality: {
        classification: "internal",
        purpose: "Exercise the deterministic offline runtime",
        recipients: [recipient],
        retention: "Retain with the governed Product",
      },
      instructionPrivilege: "workflow-data",
      freshness: { status: "fresh", assessedAt: "2026-07-21T00:00:00.000Z", basis: "Current fixture" },
      validity: { status: "valid", basis: "Deterministic fixture" },
      revisionDisposition: "current",
      applicability: { status: "applicable", basis: "Targets this exact Workflow" },
    }
  }

  async function readyRun(
    script: "success" | "failure" | "cancellation" | "resume" = "success",
    options: { stepCount?: number; retry?: WorkflowStep["retry"]; extraUnusedContext?: boolean; timeoutMs?: number } = {},
  ) {
    const product = await engine.createProduct({
      name: "Managed Atlas",
      summary: "A governed Product for managed execution tests.",
      problem: "Provider exit can otherwise be mistaken for verified Product outcomes.",
      affectedUsers: "Founders and product engineers",
      desiredOutcome: "Managed execution persists bounded evidence and honest outcome state.",
      successSignals: ["Provider completion and outcome completion remain distinct"],
      firstWorkflow: "Run an offline deterministic analysis through exact governed bindings.",
      exclusions: ["External effects"],
      profile: "software",
    }, "founder")
    const initiative = await engine.createInitiative({
      title: "Exercise managed execution",
      outcome: "A deterministic bounded run produces portable evidence.",
      scope: ["Managed runtime"],
      exclusions: ["Network and workspace mutation"],
    }, "founder")
    await engine.updateInitiativeState(initiative.id, "active", "Begin managed fixture", "founder")
    const probe = await adapter.probe()
    await engine.selectAgent(probe.capabilities, "manual-deterministic-v1", { script }, "founder")
    const content = "Bounded governed context for the deterministic offline Managed Run."
    const item: ContextItem = {
      id: randomUUID(),
      source: { kind: "logical", value: "managed-execution-fixture" },
      sourceDigest: canonicalDigest(content),
      selectionReason: "Required deterministic fixture context",
      required: true,
      content,
      contentDigest: canonicalDigest(content),
      trust: trust(),
      transformations: [],
    }
    const pack = await engine.productStudio.createContextPack({
      objective: "Provide sufficient context for the deterministic offline fixture.",
      recipient: { kind: "agent", id: "manual" },
      items: [item],
      omissions: [],
      warnings: [],
      conflicts: [],
      classificationCombinationRisk: "The single internal fixture item adds no material combination risk.",
      sufficiencyCriteria: ["The exact deterministic fixture context is present and current"],
      sufficiencyEvaluator: { kind: "system", id: "gaep.managed-test" },
      sufficiencyAssumptions: [],
    }, 1, "founder")
    const packRef = { recordType: "context-pack" as const, recordId: pack.id, revision: pack.revision, digest: canonicalDigest(pack) }
    const planContextRefs = [packRef]
    if (options.extraUnusedContext) {
      const unusedContent = "A valid but intentionally unused Context declaration."
      const unused = await engine.productStudio.createContextPack({
        objective: "Exercise rejection of an unused Plan-level Context declaration.",
        recipient: { kind: "agent", id: "manual" },
        items: [{
          ...item,
          id: randomUUID(),
          source: { kind: "logical", value: "unused-managed-context" },
          sourceDigest: canonicalDigest(unusedContent),
          content: unusedContent,
          contentDigest: canonicalDigest(unusedContent),
        }],
        omissions: [],
        warnings: [],
        conflicts: [],
        classificationCombinationRisk: "The second internal fixture item adds no material combination risk.",
        sufficiencyCriteria: ["The unused declaration remains structurally valid"],
        sufficiencyEvaluator: { kind: "system", id: "gaep.managed-test" },
        sufficiencyAssumptions: [],
      }, 1, "founder")
      planContextRefs.push({ recordType: "context-pack", recordId: unused.id, revision: unused.revision, digest: canonicalDigest(unused) })
    }
    const steps: WorkflowStep[] = []
    for (let index = 0; index < (options.stepCount ?? 1); index += 1) {
      steps.push({
        id: randomUUID(),
        title: `Run deterministic observation ${index + 1}`,
        objective: `Produce bounded offline observation ${index + 1} from the governed Context Pack.`,
        responsibility: { kind: "agent", id: "manual" },
        contextPacks: [packRef],
        toolDefinitions: [],
        dependsOn: index === 0 ? [] : [steps[index - 1]!.id],
        preconditions: ["The exact Context Pack is sufficient"],
        outputs: ["A normalized deterministic observation"],
        evidenceCriteria: ["A portable event digest is committed"],
        retry: options.retry ?? { maxAttempts: 1, backoffMs: 0, retryOn: [] },
        stopConditions: ["Stop at the scripted terminal event"],
        scope: { read: [workspaceRoot], write: [], effects: [] },
        effectEnvelope: ["observe"],
        ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
      })
    }
    const step = steps[0]!
    const draftPlan = await engine.productStudio.createWorkflowPlan({
      title: "Deterministic managed workflow",
      objective: "Execute one offline observation without granting tool authority.",
      subject: { recordType: "product", recordId: product.id, revision: 1, digest: canonicalDigest(product) },
      actor: { kind: "human", id: "founder" },
      strategy: "sequential",
      contextPacks: planContextRefs,
      toolDefinitions: [],
      steps,
    }, 1, "founder")
    const plan = await engine.productStudio.reviseWorkflowPlan(
      draftPlan.id,
      draftPlan.revision,
      { state: "resolved" },
      "founder",
      "All exact Context references and offline effects are resolved",
    )
    const charter = await engine.createCharter({
      initiativeId: initiative.id,
      objective: "Produce one deterministic offline observation with no tool effects.",
      permissions: [{ capability: "all-tools", mode: "deny", scope: [] }],
      expectedEffects: ["observe"],
      forbiddenActions: ["Do not access tools, network, or workspace files"],
      stopConditions: ["Stop after the deterministic script reaches its terminal fixture"],
      requiredEvidence: ["Normalized event evidence and an explicit outcome status"],
      managedIntent: {
        workflowPlan: { recordType: "workflow-plan", recordId: plan.id, revision: plan.revision, digest: canonicalDigest(plan) },
        contextPacks: planContextRefs,
        toolDefinitions: [],
        requestedEffects: ["observe"],
        requestedScopes: [],
      },
    }, "founder")
    await engine.confirmCharter(charter.id, "founder")
    const run = await engine.prepareManagedRun(charter.id, "founder")
    return { product, initiative, run, plan, pack, step, steps, charter }
  }

  async function drain(handle: Awaited<ReturnType<GaepEngine["startManagedRun"]>>) {
    const events: ManagedEvidenceEvent[] = []
    const eventDrain = (async () => {
      for await (const event of handle.events) events.push(event)
    })()
    const review = await handle.completion
    await eventDrain
    return { review, events }
  }

  it("runs the deterministic adapter as a first-class portable managed runtime", async () => {
    const { run, plan } = await readyRun("success")
    const handle = await engine.startManagedRun({ runId: run.id, workflowPlanId: plan.id, evaluateWorkflowGate: satisfyWorkflowGate }, "founder")
    const { review, events } = await drain(handle)

    expect(review.record.state).toBe("completed")
    expect(review.result.providerDisposition).toBe("completed")
    expect(review.result.outcome).toEqual({ status: "satisfied", basis: "deterministic-offline-runtime" })
    expect(review.evidence.events).toEqual(events)
    expect(review.evidence.actualEffects).toEqual([
      expect.objectContaining({ effect: "observe", status: "observed-provisional" }),
    ])
    const persistedJson = JSON.stringify({ record: review.record, result: review.result, evidence: review.evidence })
    expect(persistedJson).not.toContain(workspace)
    expect(persistedJson).not.toContain("deterministic output")
    expect(persistedJson).not.toContain("providerThreadId")
    expect((await engine.repository.verifyAudit()).valid).toBe(true)
    await expect(engine.markRunState(run.id, "completed", { kind: "human", id: "founder" }))
      .rejects.toThrow(/derived from durable managed evidence/)
  })

  it("rejects Workflow Plan substitution after the managed Charter is confirmed", async () => {
    const { product, run, pack, step } = await readyRun("success")
    const packRef = { recordType: "context-pack" as const, recordId: pack.id, revision: pack.revision, digest: canonicalDigest(pack) }
    const substituteDraft = await engine.productStudio.createWorkflowPlan({
      title: "Substitute managed workflow",
      objective: "Attempt to substitute a different Plan after Charter confirmation.",
      subject: { recordType: "product", recordId: product.id, revision: 1, digest: canonicalDigest(product) },
      actor: { kind: "human", id: "founder" },
      strategy: "sequential",
      contextPacks: [packRef],
      toolDefinitions: [],
      steps: [{ ...step, id: randomUUID() }],
    }, 1, "founder")
    const substitute = await engine.productStudio.reviseWorkflowPlan(
      substituteDraft.id,
      substituteDraft.revision,
      { state: "resolved" },
      "founder",
      "Substitute fixture is structurally resolved",
    )
    await expect(engine.startManagedRun({ runId: run.id, workflowPlanId: substitute.id }, "founder"))
      .rejects.toThrow(/substitution is forbidden/)
    expect((await engine.listRuns()).find((candidate) => candidate.id === run.id)?.state).toBe("prepared")
  })

  it("exports and semantically previews the complete Managed Run evidence graph", async () => {
    const { run, plan } = await readyRun("success")
    await drain(await engine.startManagedRun({ runId: run.id, workflowPlanId: plan.id, evaluateWorkflowGate: satisfyWorkflowGate }, "founder"))
    const bundle = await engine.productStudio.buildPortableExport()
    expect(bundle.manifest.members.map((member) => member.recordType)).toEqual(expect.arrayContaining([
      "managed-run",
      "managed-run-evidence",
      "managed-run-result",
    ]))
    await expect(engine.productStudio.previewImportBundle(bundle)).resolves.toMatchObject({ status: "compatible" })

    const tampered = structuredClone(bundle)
    const record = tampered.records.find((candidate) => candidate.path.startsWith("sessions/managed-run-"))!
    ;(record.content as { bindingsDigest: string }).bindingsDigest = `sha256:${"0".repeat(64)}`
    const member = tampered.manifest.members.find((candidate) => candidate.path === record.path)!
    member.digest = canonicalDigest(record.content)
    member.byteLength = Buffer.byteLength(`${JSON.stringify(record.content, null, 2)}\n`)
    tampered.manifest.membershipDigest = canonicalDigest(
      tampered.manifest.members.map(({ path, digest }) => ({ path, digest })),
    )
    await expect(engine.productStudio.previewImportBundle(tampered)).rejects.toThrow(/bindings digest/i)
  })

  it("distinguishes legacy Managed Execution v1 records and requires explicit migration", async () => {
    const { run, plan } = await readyRun("success")
    const { review } = await drain(await engine.startManagedRun({
      runId: run.id,
      workflowPlanId: plan.id,
      evaluateWorkflowGate: satisfyWorkflowGate,
    }, "founder"))
    await writeFile(
      engine.repository.resolve("sessions", `managed-run-${review.record.id}.json`),
      `${JSON.stringify({ ...review.record, schemaVersion: 1 }, null, 2)}\n`,
    )
    await expect(engine.readManagedRun(review.record.id)).rejects.toThrow(/explicit evidence-preserving migration/)
  })

  it("does not treat provider completion with an indeterminate outcome as completed", async () => {
    const { run, plan } = await readyRun("resume")
    const { review } = await drain(await engine.startManagedRun({ runId: run.id, workflowPlanId: plan.id, evaluateWorkflowGate: satisfyWorkflowGate }, "founder"))
    expect(review.result.providerDisposition).toBe("completed")
    expect(review.result.outcome.status).toBe("indeterminate")
    expect(review.record.state).toBe("unknown")
    expect((await engine.listRuns()).find((candidate) => candidate.id === run.id)?.state).toBe("unknown")
  })

  it("resumes only from a retained machine-local provider binding and creates a new Managed Run", async () => {
    const { run, plan } = await readyRun("resume")
    const first = (await drain(await engine.startManagedRun({
      runId: run.id,
      workflowPlanId: plan.id,
      evaluateWorkflowGate: satisfyWorkflowGate,
    }, "founder"))).review
    const resumed = (await drain(await engine.startManagedRun({
      runId: run.id,
      workflowPlanId: plan.id,
      previousManagedRunId: first.record.id,
      evaluateWorkflowGate: satisfyWorkflowGate,
    }, "founder"))).review
    expect(resumed.record.id).not.toBe(first.record.id)
    expect(resumed.record.previousManagedRunId).toBe(first.record.id)
    expect(first.record.rootManagedRunId).toBe(first.record.id)
    expect(first.record.attemptNumber).toBe(1)
    expect(resumed.record.rootManagedRunId).toBe(first.record.id)
    expect(resumed.record.attemptNumber).toBe(2)
    expect(resumed.record.state).toBe("unknown")
    expect(resumed.evidence.events.some((event) => event.type === "lifecycle" && event.phase === "thread-resumed")).toBe(true)
    await expect(engine.startManagedRun({
      runId: run.id,
      workflowPlanId: plan.id,
      previousManagedRunId: first.record.id,
      evaluateWorkflowGate: satisfyWorkflowGate,
    }, "founder")).rejects.toThrow(/already has a successor|branching is forbidden/)
  })

  it("persists deterministic provider failure as a failed outcome", async () => {
    const failed = await readyRun("failure")
    const failureReview = (await drain(await engine.startManagedRun({
      runId: failed.run.id,
      workflowPlanId: failed.plan.id,
      evaluateWorkflowGate: satisfyWorkflowGate,
    }, "founder"))).review
    expect(failureReview.record.state).toBe("failed")
    expect(failureReview.result.outcome.status).toBe("failed")
  })

  it("cancels an active deterministic run without inventing outcome evidence", async () => {
    const { run, plan } = await readyRun("cancellation")
    const handle = await engine.startManagedRun({ runId: run.id, workflowPlanId: plan.id, evaluateWorkflowGate: satisfyWorkflowGate }, "founder")
    const draining = drain(handle)
    await handle.cancel("Founder cancelled the fixture")
    const { review } = await draining
    expect(review.record.state).toBe("cancelled")
    expect(review.result.terminationCause).toBe("cancel-request")
    expect(review.result.outcome.status).toBe("not-assessed")
  })

  it("creates and enforces an engine-owned exact apply-decision receipt before staged apply", async () => {
    const executableRoot = await mkdtemp(join(tmpdir(), "gaep-fake-codex-"))
    try {
      const executable = join(executableRoot, "fake-codex")
      await writeFile(executable, `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(fakeCodexServer)} "$@"\n`)
      await chmod(executable, 0o700)
      const codex = new FakeManagedCodexAdapter(executable)
      engine = new GaepEngine(workspace, [codex])
      await writeFile(join(workspace, "source.txt"), "baseline")
      const product = await engine.createProduct({
        name: "Managed Apply",
        summary: "Exercise exact staged apply decisions.",
        problem: "A caller-controlled authorization string cannot prove reviewed scope.",
        affectedUsers: "Founders",
        desiredOutcome: "Every apply is bound to exact durable review evidence.",
        successSignals: ["A durable apply receipt precedes workspace mutation"],
        firstWorkflow: "Run one isolated staged Codex step.",
        exclusions: ["External effects"],
        profile: "software",
      }, "founder")
      const initiative = await engine.createInitiative({
        title: "Verify managed apply receipt",
        outcome: "An exact apply receipt is committed before the stage is applied.",
        scope: ["Managed staging"],
        exclusions: ["External effects"],
      }, "founder")
      await engine.updateInitiativeState(initiative.id, "active", "Begin receipt test", "founder")
      const probe = await codex.probe()
      await engine.selectAgent(probe.capabilities, "fake-model", {}, "founder")
      const content = "Exact bounded Context for the managed staged apply fixture."
      const pack = await engine.productStudio.createContextPack({
        objective: "Provide exact Context to the selected Codex test agent.",
        recipient: { kind: "agent", id: "codex-cli" },
        items: [{
          id: randomUUID(),
          source: { kind: "logical", value: "managed-apply-fixture" },
          sourceDigest: canonicalDigest(content),
          selectionReason: "Required exact managed apply fixture",
          required: true,
          content,
          contentDigest: canonicalDigest(content),
          trust: trust("codex-cli"),
          transformations: [],
        }],
        omissions: [],
        warnings: [],
        conflicts: [],
        classificationCombinationRisk: "One internal fixture adds no material combination risk.",
        sufficiencyCriteria: ["The exact fixture Context is present"],
        sufficiencyEvaluator: { kind: "system", id: "gaep.managed-test" },
        sufficiencyAssumptions: [],
      }, product.revision ?? 1, "founder")
      const packRef = { recordType: "context-pack" as const, recordId: pack.id, revision: pack.revision, digest: canonicalDigest(pack) }
      const tool = async (definitionType: "tool" | "capability", key: string, toolName: string, permission: string) =>
        engine.productStudio.createToolDefinition({
          definitionType,
          key,
          name: key === "shell" ? "Managed Shell" : "Managed Workspace Write",
          binding: { adapterId: "gaep.codex-cli", providerId: "local", toolName },
          purpose: "Exercise exact intrinsic managed Codex policy compilation.",
          inputContract: ["An exact workspace-relative scope"],
          outputContract: ["Bounded staged evidence"],
          allowedScopes: [workspaceRoot],
          requiredPermissions: [{ capability: permission, mode: "allow" as const }],
          effectEnvelope: ["reversible-change" as const],
          trust: {
            source: "configured" as const,
            maturity: "experimental" as const,
            assessedAt: "2026-01-01T00:00:00.000Z",
            basis: "Test-only exact intrinsic binding",
          },
          limitations: ["Test-only fixture"],
          enabled: true,
          policy: {
            requiresHumanConfirmation: true,
            forbiddenInUntrustedWorkspace: true,
            allowedProfiles: ["software" as const],
          },
        }, product.revision ?? 1, "founder")
      const shell = await tool("tool", "shell", "shell", "run-local-commands")
      const write = await tool("capability", "workspace-write", "workspace-write", "modify-workspace")
      const toolRefs = [shell, write].map((candidate) => ({
        recordType: "tool-definition" as const,
        recordId: candidate.id,
        revision: candidate.revision,
        digest: canonicalDigest(candidate),
      }))
      const step: WorkflowStep = {
        id: randomUUID(),
        title: "Complete one staged receipt fixture",
        objective: "Complete one bounded staged provider turn without external effects.",
        responsibility: { kind: "agent", id: "codex-cli" },
        contextPacks: [packRef],
        toolDefinitions: toolRefs,
        dependsOn: [],
        preconditions: ["The exact staged baseline and Context are current"],
        outputs: ["A bounded staged inspection"],
        evidenceCriteria: ["Exact changed inventory evidence is persisted"],
        retry: { maxAttempts: 1, backoffMs: 0, retryOn: [] },
        stopConditions: ["Stop after the one provider turn"],
        scope: { read: [], write: [workspaceRoot], effects: [] },
        effectEnvelope: ["reversible-change"],
      }
      const draftPlan = await engine.productStudio.createWorkflowPlan({
        title: "Managed apply receipt workflow",
        objective: "Bind one staged provider turn to an exact apply decision.",
        subject: { recordType: "product", recordId: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
        actor: { kind: "human", id: "founder" },
        strategy: "sequential",
        contextPacks: [packRef],
        toolDefinitions: toolRefs,
        steps: [step],
      }, product.revision ?? 1, "founder")
      const plan = await engine.productStudio.reviseWorkflowPlan(
        draftPlan.id,
        draftPlan.revision,
        { state: "resolved" },
        "founder",
        "Exact staged bindings are resolved",
      )
      const charter = await engine.createCharter({
        initiativeId: initiative.id,
        objective: "Run one isolated reversible staged fixture.",
        permissions: [
          { capability: "run-local-commands", mode: "allow", scope: ["."] },
          { capability: "modify-workspace", mode: "allow", scope: ["."] },
        ],
        expectedEffects: ["reversible-change"],
        forbiddenActions: ["Do not access network or external systems"],
        stopConditions: ["Stop after the exact Workflow Step"],
        requiredEvidence: ["Exact staging and apply-decision evidence"],
        managedIntent: {
          workflowPlan: { recordType: "workflow-plan", recordId: plan.id, revision: plan.revision, digest: canonicalDigest(plan) },
          contextPacks: [packRef],
          toolDefinitions: toolRefs,
          requestedEffects: ["reversible-change"],
          requestedScopes: [workspaceRoot],
        },
      }, "founder")
      await engine.confirmCharter(charter.id, "founder")
      const run = await engine.prepareManagedRun(charter.id, "founder")
      const selection = await engine.productStudio.createRunToolSelection({
        runId: run.id,
        tools: toolRefs,
        requestedEffects: ["reversible-change"],
        requestedScopes: [workspaceRoot],
        confirmedToolIds: [shell.id, write.id],
        workspaceTrusted: true,
      }, product.revision ?? 1, "founder")
      const { review } = await drain(await engine.startManagedRun({
        runId: run.id,
        workflowPlanId: plan.id,
        runToolSelectionId: selection.id,
        evaluateWorkflowGate: satisfyWorkflowGate,
      }, "founder"))
      expect(review.record.state).toBe("review-required")
      expect(review.canApply).toBe(true)
      expect((await engine.readPendingManagedReviewStatus(review.record.id)).canApply).toBe(true)
      const restartedObserver = new GaepEngine(
        workspace,
        [codex],
        {},
        new ManagedStageRegistry(tmpdir(), { isProcessAlive: () => false }),
      )
      await expect(restartedObserver.recoverInterruptedRuns("gaep.managed-test.restart"))
        .resolves.toEqual([])
      expect((await restartedObserver.readManagedRun(review.record.id)).state).toBe("review-required")
      expect((await restartedObserver.listRuns()).find((candidate) => candidate.id === run.id)?.state).toBe("running")
      expect(await restartedObserver.listPendingManagedReviewStatuses()).toEqual([
        {
          managedRunId: review.record.id,
          state: "review-required",
          canApply: false,
          canDiscard: true,
          hasLocalJournal: false,
          applyConfirmation: undefined,
        },
      ])
      const confirmation = review.applyConfirmation!
      const reviewResultId = review.result.id
      await expect(review.apply({
        confirmation: { ...confirmation, changedInventoryDigest: `sha256:${"0".repeat(64)}` },
        evaluatePostconditions: async () => "satisfied",
        postconditionEvaluator: systemGateEvaluator,
      }, "intruder")).rejects.toThrow(/does not match the exact reviewed evidence/)
      expect(review.record.state).toBe("review-required")
      expect(review.record.applyDecisionId).toBeUndefined()
      const applying = review.apply({
        confirmation,
        evaluatePostconditions: async () => "satisfied",
        postconditionEvaluator: systemGateEvaluator,
      }, "founder")
      await expect(review.discard("intruder")).rejects.toThrow(/already in progress/)
      const applied = await applying
      expect(applied.record.state).toBe("completed")
      expect(applied.record.applyDecisionId).toBeDefined()
      const receipt = await engine.readManagedApplyDecision(applied.record.applyDecisionId!)
      expect(receipt).toMatchObject({
        managedRunId: applied.record.id,
        runId: run.id,
        actor: { kind: "human", id: "founder" },
        changedInventory: [expect.objectContaining({ path: "source.txt", kind: "modified" })],
        writeEnvelope: ["."],
        decision: "apply-exact-reviewed-inventory",
      })
      expect(applied.evidence.staging?.applyDecision).toEqual({
        receiptId: receipt.id,
        receiptDigest: canonicalDigest(receipt),
      })
      expect(applied.result.previousResultId).toBe(reviewResultId)
      const bundle = await engine.productStudio.buildPortableExport()
      expect(bundle.manifest.members.some((member) => member.recordType === "managed-apply-decision")).toBe(true)
      await expect(engine.productStudio.previewImportBundle(bundle)).resolves.toMatchObject({ status: "compatible" })
      expect(await engine.listPendingManagedReviewStatuses()).toEqual([])
      expect(applied.hasLocalJournal).toBe(true)
      await applied.disposeLocalJournal()
      expect(await readFile(join(workspace, "source.txt"), "utf8")).toBe("managed update")

      await writeFile(join(workspace, "source.txt"), "second baseline")
      const conflictingCharter = await engine.createCharter({
        initiativeId: initiative.id,
        objective: "Prove that a concurrent source change cannot be overwritten by staged apply.",
        permissions: [
          { capability: "run-local-commands", mode: "allow", scope: ["."] },
          { capability: "modify-workspace", mode: "allow", scope: ["."] },
        ],
        expectedEffects: ["reversible-change"],
        forbiddenActions: ["Do not access network or external systems"],
        stopConditions: ["Stop after the exact Workflow Step"],
        requiredEvidence: ["Exact conflict, discard, and lineage evidence"],
        managedIntent: {
          workflowPlan: { recordType: "workflow-plan", recordId: plan.id, revision: plan.revision, digest: canonicalDigest(plan) },
          contextPacks: [packRef],
          toolDefinitions: toolRefs,
          requestedEffects: ["reversible-change"],
          requestedScopes: [workspaceRoot],
        },
      }, "founder")
      await engine.confirmCharter(conflictingCharter.id, "founder")
      const conflictingRun = await engine.prepareManagedRun(conflictingCharter.id, "founder")
      const conflictingSelection = await engine.productStudio.createRunToolSelection({
        runId: conflictingRun.id,
        tools: toolRefs,
        requestedEffects: ["reversible-change"],
        requestedScopes: [workspaceRoot],
        confirmedToolIds: [shell.id, write.id],
        workspaceTrusted: true,
      }, product.revision ?? 1, "founder")
      const { review: conflictingReview } = await drain(await engine.startManagedRun({
        runId: conflictingRun.id,
        workflowPlanId: plan.id,
        runToolSelectionId: conflictingSelection.id,
        evaluateWorkflowGate: satisfyWorkflowGate,
      }, "founder"))
      expect(conflictingReview.evidence.staging?.changes).toEqual([
        expect.objectContaining({ path: "source.txt", kind: "modified" }),
      ])
      const conflictingReviewResultId = conflictingReview.result.id
      const conflictingAttemptV1 = conflictingReview.evidence.workflow.attempts.at(-1)!
      expect(conflictingAttemptV1).toMatchObject({ revision: 1, state: "review-required" })

      await writeFile(join(workspace, "source.txt"), "concurrent change")
      const conflict = await conflictingReview.apply({
        confirmation: conflictingReview.applyConfirmation!,
        evaluatePostconditions: async () => "satisfied",
        postconditionEvaluator: systemGateEvaluator,
      }, "founder")
      expect(conflict.record.state).toBe("conflict")
      expect(conflict.canApply).toBe(false)
      expect(conflict.canDiscard).toBe(true)
      expect(await readFile(join(workspace, "source.txt"), "utf8")).toBe("concurrent change")
      expect(conflict.result.previousResultId).toBe(conflictingReviewResultId)
      const conflictingAttemptV2 = conflict.evidence.workflow.attempts.at(-1)!
      expect(conflictingAttemptV2).toMatchObject({
        id: conflictingAttemptV1.id,
        revision: 2,
        previousSnapshotDigest: canonicalDigest(conflictingAttemptV1),
        state: "unknown",
        retryReasonCode: "source-workspace-conflict",
      })

      const conflictResultId = conflict.result.id
      const discarded = await conflict.discard("founder")
      expect(discarded.record.state).toBe("discarded")
      expect(discarded.canDiscard).toBe(false)
      expect(discarded.result.previousResultId).toBe(conflictResultId)
      expect(discarded.evidence.staging?.applyDecision).toEqual({
        receiptId: conflict.record.applyDecisionId,
        receiptDigest: canonicalDigest(await engine.readManagedApplyDecision(conflict.record.applyDecisionId!)),
      })
      expect(discarded.evidence.workflow.attempts.at(-1)).toMatchObject({
        id: conflictingAttemptV1.id,
        revision: 3,
        previousSnapshotDigest: canonicalDigest(conflictingAttemptV2),
        state: "discarded",
      })
      expect(await engine.listPendingManagedReviewStatuses()).toEqual([])
      expect(discarded.hasLocalJournal).toBe(true)
      await discarded.disposeLocalJournal()

      await writeFile(join(workspace, "source.txt"), "restart baseline")
      const restartCharter = await engine.createCharter({
        initiativeId: initiative.id,
        objective: "Prove that a durable staged review can be discarded after process restart.",
        permissions: [
          { capability: "run-local-commands", mode: "allow", scope: ["."] },
          { capability: "modify-workspace", mode: "allow", scope: ["."] },
        ],
        expectedEffects: ["reversible-change"],
        forbiddenActions: ["Do not access network or external systems"],
        stopConditions: ["Stop after the exact Workflow Step"],
        requiredEvidence: ["Exact durable restart and discard evidence"],
        managedIntent: {
          workflowPlan: { recordType: "workflow-plan", recordId: plan.id, revision: plan.revision, digest: canonicalDigest(plan) },
          contextPacks: [packRef],
          toolDefinitions: toolRefs,
          requestedEffects: ["reversible-change"],
          requestedScopes: [workspaceRoot],
        },
      }, "founder")
      await engine.confirmCharter(restartCharter.id, "founder")
      const restartRun = await engine.prepareManagedRun(restartCharter.id, "founder")
      const restartSelection = await engine.productStudio.createRunToolSelection({
        runId: restartRun.id,
        tools: toolRefs,
        requestedEffects: ["reversible-change"],
        requestedScopes: [workspaceRoot],
        confirmedToolIds: [shell.id, write.id],
        workspaceTrusted: true,
      }, product.revision ?? 1, "founder")
      const { review: restartReview } = await drain(await engine.startManagedRun({
        runId: restartRun.id,
        workflowPlanId: plan.id,
        runToolSelectionId: restartSelection.id,
        evaluateWorkflowGate: satisfyWorkflowGate,
      }, "founder"))
      const restartReviewResultId = restartReview.result.id
      const restartAttemptV1 = restartReview.evidence.workflow.attempts.at(-1)!
      expect(restartReview.record.state).toBe("review-required")
      expect(await readFile(join(workspace, "source.txt"), "utf8")).toBe("restart baseline")

      const restarted = new GaepEngine(
        workspace,
        [codex],
        {},
        new ManagedStageRegistry(tmpdir(), { isProcessAlive: () => false }),
      )
      await expect(restarted.recoverInterruptedRuns("gaep.managed-test.restart"))
        .resolves.toEqual([])
      expect((await restarted.listRuns()).find((candidate) => candidate.id === restartRun.id)?.state).toBe("running")
      expect(await restarted.readPendingManagedReviewStatus(restartReview.record.id)).toEqual({
        managedRunId: restartReview.record.id,
        state: "review-required",
        canApply: false,
        canDiscard: true,
        hasLocalJournal: false,
        applyConfirmation: undefined,
      })
      const restartDiscarded = await restarted.discardPendingManagedReview(restartReview.record.id, "founder")
      expect(restartDiscarded.record.state).toBe("discarded")
      expect(restartDiscarded.result.previousResultId).toBe(restartReviewResultId)
      expect(restartDiscarded.evidence.workflow.attempts.at(-1)).toMatchObject({
        id: restartAttemptV1.id,
        revision: 2,
        previousSnapshotDigest: canonicalDigest(restartAttemptV1),
        state: "discarded",
      })
      expect(await readFile(join(workspace, "source.txt"), "utf8")).toBe("restart baseline")
      expect(await restarted.listPendingManagedReviewStatuses()).toEqual([])

      const conflictBundle = await restarted.productStudio.buildPortableExport()
      await expect(restarted.productStudio.previewImportBundle(conflictBundle)).resolves.toMatchObject({ status: "compatible" })
    } finally {
      await rm(executableRoot, { recursive: true, force: true })
    }
  }, 20_000)

  it("fails closed when natural-language Workflow gates have no explicit evaluator", async () => {
    const { run, plan } = await readyRun()
    await expect(engine.startManagedRun({ runId: run.id, workflowPlanId: plan.id }, "founder"))
      .rejects.toThrow(/explicit Workflow gate evaluator/)
    expect((await engine.listRuns()).find((candidate) => candidate.id === run.id)?.state).toBe("prepared")
    expect(await engine.listManagedRuns()).toEqual([])
  })

  it("rejects Plan-level Context declarations that no exact Workflow Step uses", async () => {
    const { run, plan } = await readyRun("success", { extraUnusedContext: true })
    await expect(engine.startManagedRun({
      runId: run.id,
      workflowPlanId: plan.id,
      evaluateWorkflowGate: satisfyWorkflowGate,
    }, "founder")).rejects.toThrow(/Context inventory contains declarations that no Workflow Step uses/)
    expect(await engine.listManagedRuns()).toEqual([])
  })

  it("coordinates dependency-ordered steps with immutable gate-backed attempts", async () => {
    const { run, plan, steps } = await readyRun("success", { stepCount: 2 })
    const observed: Array<{ stepId: string; phase: string }> = []
    const evaluator: ManagedWorkflowGateEvaluator = async (request) => {
      observed.push({ stepId: request.stepId, phase: request.phase })
      return {
        status: "satisfied",
        basis: "system-evaluator",
        evaluator: systemGateEvaluator,
        evidenceDigest: canonicalDigest({ request }) as `sha256:${string}`,
      }
    }
    const { review } = await drain(await engine.startManagedRun({
      runId: run.id,
      workflowPlanId: plan.id,
      evaluateWorkflowGate: evaluator,
    }, "founder"))
    expect(review.record.state).toBe("completed")
    expect(review.evidence.workflow.orderedStepIds).toEqual(steps.map((step) => step.id))
    expect(review.evidence.workflow.completedStepIds).toEqual(steps.map((step) => step.id))
    expect(review.evidence.workflow.attempts.map((attempt) => ({
      stepId: attempt.stepId,
      attempt: attempt.attempt,
      state: attempt.state,
    }))).toEqual(steps.map((step) => ({ stepId: step.id, attempt: 1, state: "completed" })))
    expect(observed.map((entry) => entry.stepId)).toEqual([
      steps[0]!.id, steps[0]!.id, steps[0]!.id, steps[0]!.id,
      steps[1]!.id, steps[1]!.id, steps[1]!.id, steps[1]!.id,
      steps[1]!.id, steps[1]!.id,
    ])
  })

  it("stops before provider launch when an explicit precondition gate is blocked", async () => {
    const { run, plan } = await readyRun()
    const evaluator: ManagedWorkflowGateEvaluator = async (request) => ({
      status: request.phase === "preconditions" ? "failed" : "not-assessed",
      basis: "system-evaluator",
      evaluator: systemGateEvaluator,
      evidenceDigest: request.phase === "preconditions"
        ? canonicalDigest({ blocked: request.criteriaDigest }) as `sha256:${string}`
        : undefined,
    })
    const { review, events } = await drain(await engine.startManagedRun({
      runId: run.id,
      workflowPlanId: plan.id,
      evaluateWorkflowGate: evaluator,
    }, "founder"))
    expect(events).toEqual([])
    expect(review.record.state).toBe("failed")
    expect(review.evidence.workflow.attempts).toEqual([
      expect.objectContaining({ state: "blocked", retryReasonCode: "precondition-gate-blocked" }),
    ])
  })

  it("requires explicit Charter-level evidence and stop-boundary assessments before completion", async () => {
    const { run, plan, steps } = await readyRun()
    const evaluator: ManagedWorkflowGateEvaluator = async (request) => ({
      status: request.phase === "charter-evidence" ? "failed" : "satisfied",
      basis: "system-evaluator",
      evaluator: systemGateEvaluator,
      evidenceDigest: canonicalDigest({ phase: request.phase, criteria: request.criteriaDigest }) as `sha256:${string}`,
    })
    const { review } = await drain(await engine.startManagedRun({
      runId: run.id,
      workflowPlanId: plan.id,
      evaluateWorkflowGate: evaluator,
    }, "founder"))
    expect(review.record.state).toBe("failed")
    expect(review.evidence.workflow.completedStepIds).toEqual([steps[0]!.id])
    expect(review.evidence.workflow.charterGates.requiredEvidence.status).toBe("failed")
    expect(review.evidence.workflow.terminalReasonCode).toBe("charter-evidence-gate-failed")
  })

  it("cancels a final gate assessment without allowing Workflow completion", async () => {
    const { run, plan } = await readyRun()
    let signalGate!: () => void
    const gateStarted = new Promise<void>((resolve) => { signalGate = resolve })
    const evaluator: ManagedWorkflowGateEvaluator = async (request) => {
      if (request.phase === "outputs") {
        signalGate()
        await new Promise<void>((resolve) => request.signal.addEventListener("abort", () => resolve(), { once: true }))
      }
      return satisfyWorkflowGate(request)
    }
    const handle = await engine.startManagedRun({
      runId: run.id,
      workflowPlanId: plan.id,
      evaluateWorkflowGate: evaluator,
    }, "founder")
    const draining = drain(handle)
    await gateStarted
    await handle.cancel("Cancel during output assessment")
    const { review } = await draining
    expect(review.record.state).toBe("cancelled")
    expect(review.evidence.workflow.terminalReasonCode).toBe("cancel-requested")
    expect(review.evidence.workflow.completedStepIds).toEqual([])
  })

  it("enforces the exact Workflow Step timeout even when the caller omits a timeout", async () => {
    const { run, plan } = await readyRun("cancellation", { timeoutMs: 25 })
    const { review } = await drain(await engine.startManagedRun({
      runId: run.id,
      workflowPlanId: plan.id,
      evaluateWorkflowGate: satisfyWorkflowGate,
    }, "founder"))
    expect(review.record.state).toBe("timed-out")
    expect(review.result.terminationCause).toBe("timeout")
    expect(review.evidence.workflow.attempts.at(-1)).toMatchObject({ state: "timed-out", retryReasonCode: "step-timeout" })
  })

  it("allows only one concurrent Managed Run start for the same underlying Run", async () => {
    const { run, plan } = await readyRun()
    const starts = await Promise.allSettled([
      engine.startManagedRun({ runId: run.id, workflowPlanId: plan.id, evaluateWorkflowGate: satisfyWorkflowGate }, "founder-a"),
      engine.startManagedRun({ runId: run.id, workflowPlanId: plan.id, evaluateWorkflowGate: satisfyWorkflowGate }, "founder-b"),
    ])
    expect(starts.filter((result) => result.status === "fulfilled")).toHaveLength(1)
    expect(starts.filter((result) => result.status === "rejected")).toHaveLength(1)
    const started = starts.find((result): result is PromiseFulfilledResult<Awaited<ReturnType<GaepEngine["startManagedRun"]>>> =>
      result.status === "fulfilled")!
    await drain(started.value)
    expect(await engine.listManagedRuns()).toHaveLength(1)
  })

  it("recovers a crash-window prepared Managed Run without permanently blocking its Run", async () => {
    const { run, plan } = await readyRun()
    const completed = (await drain(await engine.startManagedRun({
      runId: run.id,
      workflowPlanId: plan.id,
      evaluateWorkflowGate: satisfyWorkflowGate,
    }, "founder"))).review
    const preparedRun = runSchema.parse(completed.record.bindingSnapshots.run)
    const interrupted = managedRunRecordSchema.parse({
      ...completed.record,
      revision: completed.record.revision + 1,
      state: "prepared",
      resultId: undefined,
      resultDigest: undefined,
      applyDecisionId: undefined,
      applyDecisionDigest: undefined,
      startedAt: undefined,
      endedAt: undefined,
      recovery: { status: "not-required" },
      updatedAt: new Date().toISOString(),
    })
    await engine.repository.withLock(() => engine.repository.commitMutation({
      writes: [
        {
          path: engine.repository.resolve("sessions", `managed-run-${interrupted.id}.json`),
          value: interrupted,
          schema: managedRunRecordSchema,
          governed: true,
        },
        {
          path: engine.repository.resolve("sessions", `run-${preparedRun.id}.json`),
          value: preparedRun,
          schema: runSchema,
          governed: true,
        },
      ],
      audit: {
        eventType: "test.managed-run.crash-window",
        actor: { kind: "system", id: "gaep.managed-test" },
        subjectId: interrupted.id,
        payload: { simulated: true },
      },
    }))

    const restarted = new GaepEngine(workspace, [adapter])
    await restarted.recoverInterruptedRuns("gaep.managed-test.restart")
    expect(await restarted.readManagedRun(interrupted.id)).toMatchObject({
      state: "unknown",
      recovery: { status: "resume-unavailable", reasonCode: "machine-local-runtime-lost" },
    })
    expect((await restarted.listRuns()).find((candidate) => candidate.id === run.id)?.state).toBe("prepared")
  })

  it("records contiguous retry attempts only for exact configured retry reasons", async () => {
    const { run, plan } = await readyRun("failure", {
      retry: { maxAttempts: 2, backoffMs: 0, retryOn: ["provider-failed"] },
    })
    const { review } = await drain(await engine.startManagedRun({
      runId: run.id,
      workflowPlanId: plan.id,
      evaluateWorkflowGate: satisfyWorkflowGate,
    }, "founder"))
    expect(review.record.state).toBe("failed")
    expect(review.evidence.workflow.attempts.map((attempt) => attempt.attempt)).toEqual([1, 2])
    expect(review.evidence.workflow.attempts.every((attempt) => attempt.retryReasonCode === "provider-failed")).toBe(true)
  })

  it("cancels a retry backoff without launching another Workflow attempt", async () => {
    const { run, plan } = await readyRun("failure", {
      retry: { maxAttempts: 2, backoffMs: 10_000, retryOn: ["provider-failed"] },
    })
    let signalFirstAttempt!: () => void
    const firstAttemptAssessed = new Promise<void>((resolve) => { signalFirstAttempt = resolve })
    const evaluator: ManagedWorkflowGateEvaluator = async (request) => {
      if (request.phase === "stop-conditions" && request.attempt === 1) signalFirstAttempt()
      return satisfyWorkflowGate(request)
    }
    const handle = await engine.startManagedRun({
      runId: run.id,
      workflowPlanId: plan.id,
      evaluateWorkflowGate: evaluator,
    }, "founder")
    const draining = drain(handle)
    await firstAttemptAssessed
    await handle.cancel("Cancel retry backoff")
    const { review } = await draining
    expect(review.record.state).toBe("cancelled")
    expect(review.evidence.workflow.terminalReasonCode).toBe("cancel-requested")
    expect(review.evidence.workflow.attempts).toHaveLength(1)
  }, 5_000)
})

describe("managed Workflow compilation and write-envelope containment", () => {
  it("uses deterministic declared-order tie breaking and rejects unsupported parallel claims", () => {
    const first = randomUUID()
    const second = randomUUID()
    const third = randomUUID()
    const step = (id: string, dependsOn: string[]): WorkflowStep => ({
      id,
      title: id,
      objective: "Compile the exact Workflow dependency order.",
      responsibility: { kind: "agent", id: "manual" },
      contextPacks: [],
      toolDefinitions: [],
      dependsOn,
      preconditions: ["Explicitly assessed"],
      outputs: ["Order"],
      evidenceCriteria: ["Order digest"],
      retry: { maxAttempts: 1, backoffMs: 0, retryOn: [] },
      stopConditions: ["Stop after order compilation"],
      scope: { read: [], write: [], effects: [] },
      effectEnvelope: ["observe"],
    })
    const plan = {
      strategy: "sequential",
      steps: [step(second, [first]), step(first, []), step(third, [first])],
    } as WorkflowPlan
    expect(compileManagedWorkflowOrder(plan).map((candidate) => candidate.id)).toEqual([first, second, third])
    expect(() => compileManagedWorkflowOrder({ ...plan, strategy: "parallel-readonly" }))
      .toThrow(/fails closed/)
  })

  it("accepts only an exact path or descendant of a confirmed workspace scope", () => {
    expect(workspacePathWithinEnvelope("src/a.ts", ["src"])).toBe(true)
    expect(workspacePathWithinEnvelope("src", ["src"])).toBe(true)
    expect(workspacePathWithinEnvelope("src-other/a.ts", ["src"])).toBe(false)
    expect(workspacePathWithinEnvelope("anything", ["."])).toBe(true)
  })
})

describe("managed Codex intrinsic Tool compilation", () => {
  const charter = {
    permissions: [
      { capability: "run-local-commands", mode: "allow", scope: ["."] },
      { capability: "modify-workspace", mode: "allow", scope: ["."] },
    ],
    expectedEffects: ["reversible-change"],
  } as ExecutionCharter

  const intrinsic = (definitionType: "tool" | "capability", toolName: string): ToolDefinition => ({
    definitionType,
    key: toolName,
    binding: { adapterId: "gaep.codex-cli", toolName },
  } as ToolDefinition)

  it("maps only exact shell and workspace-write definitions to supervisor gates", () => {
    expect(compileManagedCodexPolicy(charter, [
      intrinsic("tool", "shell"),
      intrinsic("capability", "workspace-write"),
    ])).toEqual({ allowCommands: true, allowFileChanges: true })
  })

  it("fails closed for selected Tools that the managed provider cannot enforce", () => {
    expect(() => compileManagedCodexPolicy(charter, [intrinsic("tool", "browser")]))
      .toThrow(/cannot enforce selected Tool/)
    expect(() => compileManagedCodexPolicy(charter, [{
      ...intrinsic("tool", "shell"),
      binding: { adapterId: "another-adapter", toolName: "shell" },
    }])).toThrow(/adapter binding/)
  })

  it("rejects a write envelope outside the exact matching Charter permission and Tool scopes", () => {
    const scopedCharter = {
      ...charter,
      permissions: [
        { capability: "run-local-commands", mode: "allow", scope: ["docs"] },
        { capability: "modify-workspace", mode: "allow", scope: ["docs"] },
      ],
    } as ExecutionCharter
    const scoped = (definitionType: "tool" | "capability", toolName: string, permission: string): ToolDefinition => ({
      ...intrinsic(definitionType, toolName),
      key: toolName,
      requiredPermissions: [{ capability: permission, mode: "allow" }],
      allowedScopes: [{ kind: "workspace-relative", path: "docs" }],
    } as ToolDefinition)
    const tools = [
      scoped("tool", "shell", "run-local-commands"),
      scoped("capability", "workspace-write", "modify-workspace"),
    ]
    expect(compileManagedCodexPolicy(scopedCharter, tools, ["docs/generated"])).toEqual({
      allowCommands: true,
      allowFileChanges: true,
    })
    expect(() => compileManagedCodexPolicy(scopedCharter, tools, ["src"])).toThrow(/exceeds Charter permission|exceeds selected Tool/)
  })
})
