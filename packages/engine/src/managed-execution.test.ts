import { randomUUID } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type {
  ContextItem,
  ContextTrustDimensions,
  ExecutionCharter,
  ManagedEvidenceEvent,
  ToolDefinition,
  WorkflowStep,
} from "@gaep/contracts"
import { DeterministicManualAdapter, canonicalDigest } from "@gaep/agent-sdk"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { GaepEngine } from "./engine.js"
import { compileManagedCodexPolicy } from "./managed-execution.js"

const workspaceRoot = { kind: "workspace-relative" as const, path: "." }

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

  function trust(): ContextTrustDimensions {
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
        recipients: ["manual"],
        retention: "Retain with the governed Product",
      },
      instructionPrivilege: "workflow-data",
      freshness: { status: "fresh", assessedAt: "2026-07-21T00:00:00.000Z", basis: "Current fixture" },
      validity: { status: "valid", basis: "Deterministic fixture" },
      revisionDisposition: "current",
      applicability: { status: "applicable", basis: "Targets this exact Workflow" },
    }
  }

  async function readyRun(script: "success" | "failure" | "cancellation" | "resume" = "success") {
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
    const step: WorkflowStep = {
      id: randomUUID(),
      title: "Run deterministic observation",
      objective: "Produce one bounded offline observation from the governed Context Pack.",
      responsibility: { kind: "agent", id: "manual" },
      contextPacks: [packRef],
      toolDefinitions: [],
      dependsOn: [],
      preconditions: ["The exact Context Pack is sufficient"],
      outputs: ["A normalized deterministic observation"],
      evidenceCriteria: ["A portable event digest is committed"],
      retry: { maxAttempts: 1, backoffMs: 0, retryOn: [] },
      stopConditions: ["Stop at the scripted terminal event"],
      scope: { read: [workspaceRoot], write: [], effects: [] },
      effectEnvelope: ["observe"],
    }
    const draftPlan = await engine.productStudio.createWorkflowPlan({
      title: "Deterministic managed workflow",
      objective: "Execute one offline observation without granting tool authority.",
      subject: { recordType: "product", recordId: product.id, revision: 1, digest: canonicalDigest(product) },
      actor: { kind: "human", id: "founder" },
      strategy: "sequential",
      contextPacks: [packRef],
      toolDefinitions: [],
      steps: [step],
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
        contextPacks: [packRef],
        toolDefinitions: [],
        requestedEffects: ["observe"],
        requestedScopes: [],
      },
    }, "founder")
    await engine.confirmCharter(charter.id, "founder")
    const run = await engine.prepareManagedRun(charter.id, "founder")
    return { product, initiative, run, plan, pack, step, charter }
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
    const handle = await engine.startManagedRun({ runId: run.id, workflowPlanId: plan.id }, "founder")
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
    await drain(await engine.startManagedRun({ runId: run.id, workflowPlanId: plan.id }, "founder"))
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

  it("does not treat provider completion with an indeterminate outcome as completed", async () => {
    const { run, plan } = await readyRun("resume")
    const { review } = await drain(await engine.startManagedRun({ runId: run.id, workflowPlanId: plan.id }, "founder"))
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
    }, "founder"))).review
    const resumed = (await drain(await engine.startManagedRun({
      runId: run.id,
      workflowPlanId: plan.id,
      previousManagedRunId: first.record.id,
    }, "founder"))).review
    expect(resumed.record.id).not.toBe(first.record.id)
    expect(resumed.record.previousManagedRunId).toBe(first.record.id)
    expect(resumed.record.state).toBe("unknown")
    expect(resumed.evidence.events.some((event) => event.type === "lifecycle" && event.phase === "thread-resumed")).toBe(true)
  })

  it("persists deterministic provider failure as a failed outcome", async () => {
    const failed = await readyRun("failure")
    const failureReview = (await drain(await engine.startManagedRun({
      runId: failed.run.id,
      workflowPlanId: failed.plan.id,
    }, "founder"))).review
    expect(failureReview.record.state).toBe("failed")
    expect(failureReview.result.outcome.status).toBe("failed")
  })

  it("cancels an active deterministic run without inventing outcome evidence", async () => {
    const { run, plan } = await readyRun("cancellation")
    const handle = await engine.startManagedRun({ runId: run.id, workflowPlanId: plan.id }, "founder")
    const draining = drain(handle)
    await handle.cancel("Founder cancelled the fixture")
    const { review } = await draining
    expect(review.record.state).toBe("cancelled")
    expect(review.result.terminationCause).toBe("cancel-request")
    expect(review.result.outcome.status).toBe("not-assessed")
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
})
