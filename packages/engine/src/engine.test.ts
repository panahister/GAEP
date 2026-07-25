import { randomUUID } from "node:crypto"
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  executionCharterSchema,
  handoffSchema,
  legacyAdapterCapabilitiesV1Schema,
  legacyAgentSelectionV1Schema,
  managedRunRecordSchema,
  initiativeApplicabilitySubjectDefinitions,
  productSchema,
  type AdapterCapabilities,
  type AgentSelection,
  type ExecutionCharter,
  type Initiative,
  type InitiativeApplicabilityMatrixInput,
  type InitiativeClassificationInput,
} from "@gaep/contracts"
import {
  capabilityDigest,
  canonicalDigest,
  ManagedStageRegistry,
  requireExecutableRuntimeBinding,
  WorkspaceStagingService,
  type AdapterProbeResult,
  type AdapterRuntimeBinding,
  type AgentAdapter,
  type AgentInvocation,
} from "@gaep/agent-sdk"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { GaepEngine } from "./engine.js"

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

  async function initialize(entryReady = true) {
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
    let initiative = await engine.createInitiative({
      title: "Build the first workflow",
      outcome: "A user can complete the first governed workflow.",
      scope: ["Local engine", "VS Code host"],
      exclusions: ["Cloud synchronization"],
    }, "founder")
    if (entryReady) initiative = await satisfyInitiativeEntry(initiative)
    await engine.selectAgent(capabilities, "fake-model", {}, "founder")
    return { product, initiative }
  }

  const classificationInput: InitiativeClassificationInput = {
    primaryType: "service",
    secondaryTypes: ["api", "modernization"],
    systemState: "brownfield",
    changePosture: "modernization",
    motivations: ["business-driven", "technical"],
    characteristics: {
      userInterface: "non-ui",
      data: "data-bearing",
      integration: "integration-heavy",
      interactionModes: ["synchronous", "asynchronous"],
      exposure: "partner",
    },
    regulated: true,
    policyDomains: ["payments", "privacy"],
    sensitivities: ["security", "privacy", "data"],
    expectedLifetime: "long-lived",
    maintenanceHorizon: "Supported for at least five years after initial release",
    risk: {
      blastRadius: "multi-unit",
      reversibility: "partially-reversible",
      urgency: "high",
      costOfFailure: "high",
    },
    dependencies: ["Existing identity service", "Partner API consumers"],
    affectedAssets: ["Payments API", "Settlement worker"],
    owner: "Payments engineering owner",
    accountableAuthority: "Payments Product Owner",
    confidence: { level: "medium", basis: "Repository evidence is current but partner scope awaits confirmation" },
    evidence: [{ kind: "evidence", reference: "GAEP-EVD-001" }],
    unresolvedQuestions: ["Whether the legacy batch endpoint remains in scope"],
    rationale: "The initiative changes a brownfield service and its independently deployed API consumers.",
  }

  const applicabilityInput: InitiativeApplicabilityMatrixInput = {
    decisions: [{
      subject: { type: "test-method", key: "consumer-contract-testing", label: "Consumer contract testing" },
      status: "required",
      rationale: "Independently deployed partner consumers require version-bound compatibility evidence.",
      sources: [{ kind: "policy", reference: "GAEP-POL-CONTRACT-001" }],
      owner: "Payments quality owner",
      accountableApprover: "Payments Product Owner",
      dependencies: ["partner-api-contract"],
      conditions: [],
      reviewTriggers: ["API contract or consumer inventory changes"],
      approval: { state: "pending", conditions: [] },
      relatedRecords: [],
      relatedImplementationUnits: ["payments-api"],
    }],
    unresolvedSubjects: [{
      subject: { type: "activity", key: "figma", label: "Figma design workflow" },
      reason: "User-interface applicability remains unresolved",
      owner: "Product design owner",
    }],
  }

  function completeApplicabilityInput(): InitiativeApplicabilityMatrixInput {
    return {
      decisions: initiativeApplicabilitySubjectDefinitions.map((subject) => ({
        subject: { ...subject },
        status: "optional" as const,
        rationale: "The accountable owner evaluated this canonical subject for Initiative entry.",
        sources: [{ kind: "policy" as const, reference: "GAEP-DYNAMIC-ENGINEERING-MODEL" }],
        owner: "Initiative owner",
        dependencies: [],
        conditions: [],
        reviewTriggers: ["Initiative scope, classification, policy, or evidence changes"],
        approval: { state: "not-required" as const, conditions: [] },
        relatedRecords: [],
        relatedImplementationUnits: [],
      })),
      unresolvedSubjects: [],
    }
  }

  async function satisfyInitiativeEntry(initiative: Initiative): Promise<Initiative> {
    const classified = await engine.classifyInitiative(
      initiative.id,
      {
        ...classificationInput,
        confidence: { level: "high", basis: "Current repository and accountable-owner evidence agree" },
        unresolvedQuestions: [],
      },
      initiative.revision!,
      "founder",
    )
    return engine.resolveInitiativeApplicability(
      initiative.id,
      completeApplicabilityInput(),
      classified.revision!,
      "founder",
    )
  }

  async function persistLegacyAgentRuntime(executablePath = "/opt/legacy/bin/fake-agent") {
    const selection = await engine.readSelection()
    const capabilityName = (await readdir(join(workspace, ".gaep", "runtime")))
      .find((name) => /^capabilities-[0-9a-f]{64}\.json$/.test(name))
    if (!capabilityName) throw new Error("Expected a persisted capability snapshot")
    const { schemaVersion: _selectionVersion, ...selectionFields } = selection
    const { schemaVersion: _capabilityVersion, ...capabilityFields } = capabilities
    const legacySelection = legacyAgentSelectionV1Schema.parse({
      ...selectionFields,
      runtimeExecutable: executablePath,
    })
    const legacyCapabilities = legacyAdapterCapabilitiesV1Schema.parse({
      ...capabilityFields,
      executablePath,
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

  it("records exact human-attributed Initiative classification and applicability without manufacturing authority", async () => {
    const { product, initiative } = await initialize(false)
    await expect(engine.assessInitiativeEntry(initiative.id)).resolves.toMatchObject({
      state: "attention-required",
      classification: { status: "missing" },
      applicability: { status: "missing" },
    })
    const classified = await engine.classifyInitiative(
      initiative.id,
      classificationInput,
      initiative.revision!,
      "founder",
    )
    expect(classified).toMatchObject({
      revision: 2,
      classification: {
        primaryType: "service",
        secondaryTypes: ["api", "modernization"],
        productProfile: product.profile,
        productRevision: product.revision,
        completenessPolicyVersion: "gaep-initiative-classification-completeness-v1",
        completenessPolicyDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
        classifiedBy: { kind: "human", id: "founder" },
        authorityBoundary: "classification-guides-profile-selection-and-does-not-grant-approval-or-action-authority",
      },
    })
    expect(classified.classification?.productDigest).toBe(canonicalDigest(product))
    const classifiedAssessment = await engine.assessInitiativeEntry(initiative.id)
    expect(classifiedAssessment).toMatchObject({
      state: "attention-required",
      classification: {
        status: "current",
        completeness: {
          status: "incomplete",
          unresolvedQuestionCount: 1,
          policyVersion: "gaep-initiative-classification-completeness-v1",
        },
      },
      applicability: {
        status: "missing",
        coverage: {
          status: "missing",
          subjectCount: initiativeApplicabilitySubjectDefinitions.length,
          coveredSubjectCount: 0,
          missingSubjectCount: initiativeApplicabilitySubjectDefinitions.length,
        },
      },
    })
    await expect(engine.resolveInitiativeApplicability(
      initiative.id,
      {
        ...applicabilityInput,
        subjectCatalog: {
          catalogVersion: "gaep-initiative-applicability-subjects-v1",
          digest: `sha256:${"f".repeat(64)}`,
          subjectCount: initiativeApplicabilitySubjectDefinitions.length,
        },
      },
      classified.revision!,
      "founder",
    )).rejects.toThrow(/subject catalog changed/i)

    const resolved = await engine.resolveInitiativeApplicability(
      initiative.id,
      applicabilityInput,
      classified.revision!,
      "founder",
    )
    expect(resolved).toMatchObject({
      revision: 3,
      applicability: {
        revision: 1,
        initiativeRevision: 3,
        state: "current",
        subjectCatalog: {
          catalogVersion: "gaep-initiative-applicability-subjects-v1",
          subjectCount: initiativeApplicabilitySubjectDefinitions.length,
        },
        evaluatedBy: { kind: "human", id: "founder" },
        authorityBoundary: "applicability-matrix-does-not-grant-approval-readiness-or-action-authority",
        decisions: [{
          revision: 1,
          initiativeRevision: 3,
          status: "required",
          approval: { state: "pending" },
          decidedBy: { kind: "human", id: "founder" },
          authorityBoundary: "applicability-decision-does-not-grant-approval-readiness-or-action-authority",
        }],
        unresolvedSubjects: [{ subject: { key: "figma" } }],
      },
    })
    expect(resolved.applicability?.classificationDigest).toBe(canonicalDigest(resolved.classification))
    await expect(engine.assessInitiativeEntry(initiative.id)).resolves.toMatchObject({
      state: "attention-required",
      classification: { status: "current" },
      applicability: {
        status: "current",
        unresolvedSubjectCount: 1,
        pendingApprovalCount: 1,
        coverage: {
          status: "incomplete",
          subjectCount: initiativeApplicabilitySubjectDefinitions.length,
          coveredSubjectCount: 1,
          missingSubjectCount: initiativeApplicabilitySubjectDefinitions.length - 1,
          unexpectedSubjectCount: 1,
        },
      },
      authorityBoundary: "entry-assessment-is-read-only-and-does-not-grant-approval-readiness-or-action-authority",
    })
    await expect(engine.resolveInitiativeApplicability(
      initiative.id,
      applicabilityInput,
      classified.revision!,
      "founder",
    )).rejects.toThrow(/changed before applicability resolution/i)
    await expect(engine.repository.verifyAudit()).resolves.toMatchObject({ valid: true })
  })

  it("marks applicability stale when Initiative classification is superseded and preserves decision lineage on re-resolution", async () => {
    const { initiative } = await initialize(false)
    const classified = await engine.classifyInitiative(initiative.id, classificationInput, initiative.revision!, "founder")
    const firstResolution = await engine.resolveInitiativeApplicability(
      initiative.id,
      applicabilityInput,
      classified.revision!,
      "founder",
    )
    const reclassified = await engine.classifyInitiative(
      initiative.id,
      {
        ...classificationInput,
        confidence: { level: "high", basis: "Partner scope was confirmed against the current contract inventory" },
        unresolvedQuestions: [],
      },
      firstResolution.revision!,
      "founder",
    )
    expect(reclassified.applicability).toMatchObject({
      state: "stale",
      invalidationReason: "Initiative classification was superseded",
    })
    await expect(engine.assessInitiativeEntry(initiative.id)).resolves.toMatchObject({
      state: "attention-required",
      classification: { status: "current" },
      applicability: { status: "stale" },
    })
    const refreshed = await engine.resolveInitiativeApplicability(
      initiative.id,
      applicabilityInput,
      reclassified.revision!,
      "founder",
    )
    expect(refreshed.applicability).toMatchObject({ revision: 2, state: "current" })
    expect(refreshed.applicability?.decisions[0]?.id).toBe(firstResolution.applicability?.decisions[0]?.id)
    expect(refreshed.applicability?.decisions[0]?.revision).toBe(2)
    expect(refreshed.applicability?.decisions[0]?.initiativeRevision).toBe(refreshed.revision)

    const readyInput = completeApplicabilityInput()
    const ready = await engine.resolveInitiativeApplicability(
      initiative.id,
      readyInput,
      refreshed.revision!,
      "founder",
    )
    await expect(engine.assessInitiativeEntry(initiative.id)).resolves.toMatchObject({
      initiativeRevision: ready.revision,
      state: "ready",
      reasons: [],
      classification: { status: "current" },
      applicability: {
        status: "current",
        unresolvedSubjectCount: 0,
        pendingApprovalCount: 0,
        coverage: {
          status: "complete",
          subjectCount: initiativeApplicabilitySubjectDefinitions.length,
          coveredSubjectCount: initiativeApplicabilitySubjectDefinitions.length,
          missingSubjectCount: 0,
          unexpectedSubjectCount: 0,
          mismatchedSubjectCount: 0,
        },
      },
    })
  })

  it("fails closed at proposed-to-active until policy completeness and canonical coverage are ready", async () => {
    const { initiative } = await initialize(false)
    await expect(engine.updateInitiativeState(
      initiative.id,
      "active",
      "Attempt entry without governed evidence",
      "founder",
    )).rejects.toThrow(/classification is missing.*applicability has not been resolved/i)

    const classified = await engine.classifyInitiative(
      initiative.id,
      classificationInput,
      initiative.revision!,
      "founder",
    )
    const partial = await engine.resolveInitiativeApplicability(
      initiative.id,
      applicabilityInput,
      classified.revision!,
      "founder",
    )
    await expect(engine.updateInitiativeState(
      initiative.id,
      "active",
      "Attempt entry with incomplete evidence",
      "founder",
    )).rejects.toThrow(/completeness policy.*cover every canonical subject/i)

    const ready = await satisfyInitiativeEntry(partial)
    await expect(engine.assessInitiativeEntry(initiative.id)).resolves.toMatchObject({
      initiativeRevision: ready.revision,
      state: "ready",
      reasons: [],
    })
    const active = await engine.updateInitiativeState(
      initiative.id,
      "active",
      "Exact Initiative entry evidence is ready",
      "founder",
    )
    expect(active).toMatchObject({ state: "active", revision: ready.revision! + 1 })
    const activationEvent = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
      .filter((event) => event.eventType === "initiative.state.changed")
      .at(-1)
    expect(activationEvent?.payload).toMatchObject({
      from: "proposed",
      to: "active",
      entryGate: {
        assessmentDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
        classificationDigest: ready.classification ? canonicalDigest(ready.classification) : undefined,
        completenessPolicyDigest: ready.classification?.completenessPolicyDigest,
        applicabilityDigest: ready.applicability ? canonicalDigest(ready.applicability) : undefined,
        subjectCatalogDigest: ready.applicability?.subjectCatalog?.digest,
      },
    })
    await expect(engine.repository.verifyAudit()).resolves.toMatchObject({ valid: true })
  })

  it("refuses to resolve applicability against a classification from an older Product revision", async () => {
    const { product, initiative } = await initialize(false)
    const classified = await engine.classifyInitiative(initiative.id, classificationInput, initiative.revision!, "founder")
    const revisedProduct = productSchema.parse({
      ...product,
      revision: (product.revision ?? 1) + 1,
      summary: "A governed product design workspace with a revised entry profile.",
      updatedAt: new Date().toISOString(),
    })
    await engine.repository.withLock(async () => engine.repository.commitMutation({
      writes: [{
        path: engine.repository.resolve("product.json"),
        value: revisedProduct,
        schema: productSchema,
        governed: true,
      }],
      audit: {
        eventType: "test.product.revised",
        actor: { kind: "human", id: "founder" },
        subjectId: product.id,
        payload: { revision: revisedProduct.revision, recordDigest: canonicalDigest(revisedProduct) },
      },
    }))

    await expect(engine.assessInitiativeEntry(initiative.id)).resolves.toMatchObject({
      classification: { status: "stale" },
      applicability: { status: "missing" },
    })
    await expect(engine.resolveInitiativeApplicability(
      initiative.id,
      applicabilityInput,
      classified.revision!,
      "founder",
    )).rejects.toThrow(/does not bind the current Product/i)
    await expect(engine.repository.verifyAudit()).resolves.toMatchObject({ valid: true })
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

    expect([active.revision, blocked.revision, resumed.revision, completed.revision]).toEqual([4, 5, 6, 7])
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
  }, 15_000)

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
    const handoff = await engine.createHandoff({
      fromRunId: run.id,
      toCapabilities: capabilities,
      toModelId: "fake-model",
      toSettings: {},
      reason: "Verify portable handoff persistence",
      completedWork: ["Fresh local binding used"],
      unresolvedMatters: [],
      decisions: [],
      evidence: [],
    }, "founder")
    await expect(engine.listHandoffs()).resolves.toEqual([handoff])
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
    const legacyState = await engine.readSelectionState()
    expect(legacyState).toMatchObject({
      status: "migration-required",
      portableCandidate: { schemaVersion: 2, adapterId: "gaep.fake", modelId: "fake-model" },
    })
    expect(JSON.stringify(legacyState)).not.toContain("runtimeExecutable")
    expect(JSON.stringify(legacyState)).not.toContain("/opt/legacy")
    expect((await engine.repository.verifyAudit()).valid).toBe(true)
    const legacyHealth = await engine.workspaceHealth()
    expect(legacyHealth.status).toBe("degraded")
    expect(legacyHealth.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "workspace.agent-selection-migration-required",
      "workspace.agent-capabilities-migration-required",
    ]))
    await expect(engine.readSelection()).rejects.toThrow(/explicit re-probe and reconfirmation/i)
    await expect(engine.migrateLegacyAgentSelection({
      capabilities,
      modelId: "fake-model",
      settings: {},
      confirmation: "wrong" as "reconfirm-portable-agent-selection",
    }, "founder")).rejects.toThrow(/explicit capability reconfirmation/i)
    await expect(engine.migrateLegacyAgentSelection({
      capabilities: { ...capabilities, runtimeVersion: "changed" },
      modelId: "fake-model",
      settings: {},
      confirmation: "reconfirm-portable-agent-selection",
    }, "founder")).rejects.toThrow(/changed during migration/i)

    const migrated = await engine.migrateLegacyAgentSelection({
      capabilities,
      modelId: "fake-model",
      settings: {},
      confirmation: "reconfirm-portable-agent-selection",
    }, "founder")
    expect(migrated.schemaVersion).toBe(2)
    expect(await engine.readSelectionState()).toMatchObject({ status: "selected", selection: migrated })
    expect((await engine.repository.verifyAudit()).valid).toBe(true)
    expect((await engine.workspaceHealth()).status).toBe("healthy")
    const selectionText = await readFile(join(workspace, ".gaep", "runtime", "selection.json"), "utf8")
    const capabilitiesText = await readFile(join(workspace, ".gaep", "runtime", capabilityName), "utf8")
    expect(selectionText).not.toContain("runtimeExecutable")
    expect(capabilitiesText).not.toContain("executablePath")
    expect(selectionText).not.toContain("/opt/legacy")
    expect(capabilitiesText).not.toContain("/opt/legacy")
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

  it("records model truth and blocks handoff while any Run remains non-terminal", async () => {
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
    await expect(engine.createHandoff(input, "founder")).rejects.toThrow(/Stop, cancel, or reconcile/)
    await engine.markRunState(run.id, "running", { kind: "system", id: "test" })
    await expect(engine.createHandoff(input, "founder")).rejects.toThrow(/Stop, cancel, or reconcile/)
    await engine.markRunState(run.id, "paused", { kind: "system", id: "test" })
    await expect(engine.createHandoff(input, "founder")).rejects.toThrow(/Stop, cancel, or reconcile/)
    await engine.markRunState(run.id, "running", { kind: "system", id: "test" })
    await engine.markRunState(run.id, "unknown", { kind: "system", id: "test" })
    await expect(engine.createHandoff(input, "founder")).rejects.toThrow(/Stop, cancel, or reconcile/)
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

  it("keeps a live durable managed applying Run out of generic interrupted recovery", async () => {
    const { product, initiative } = await initialize()
    await engine.updateInitiativeState(initiative.id, "active", "Begin governed work", "founder")
    const activeInitiative = await engine.readInitiative(initiative.id)
    const selection = await engine.readSelection()
    const stepId = randomUUID()
    const draftPlan = await engine.productStudio.createWorkflowPlan({
      title: "Managed recovery exclusion",
      objective: "Bind a live applying Managed Run for public recovery testing.",
      subject: { recordType: "product", recordId: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
      actor: { kind: "human", id: "founder" },
      strategy: "sequential",
      contextPacks: [],
      toolDefinitions: [],
      steps: [{
        id: stepId,
        title: "Observe managed recovery",
        objective: "Remain live while public interrupted recovery runs.",
        responsibility: { kind: "agent", id: "fake-agent" },
        contextPacks: [],
        toolDefinitions: [],
        dependsOn: [],
        preconditions: ["The managed record is durable"],
        outputs: ["A recovery exclusion observation"],
        evidenceCriteria: ["The portable Run remains running"],
        retry: { maxAttempts: 1, backoffMs: 0, retryOn: [] },
        stopConditions: ["Stop after recovery inspection"],
        scope: { read: [{ kind: "workspace-relative", path: "." }], write: [], effects: [] },
        effectEnvelope: ["observe"],
      }],
    }, product.revision ?? 1, "founder")
    const plan = await engine.productStudio.reviseWorkflowPlan(
      draftPlan.id,
      draftPlan.revision,
      { state: "resolved" },
      "founder",
      "The bounded recovery fixture is resolved",
    )
    const charter = await engine.createCharter({
      initiativeId: activeInitiative.id,
      objective: "Verify public recovery preserves live Managed Run truth.",
      permissions: [{ capability: "read-workspace", mode: "allow", scope: ["."] }],
      expectedEffects: ["observe"],
      forbiddenActions: ["Do not mutate"],
      stopConditions: ["Stop after recovery inspection"],
      requiredEvidence: ["The Run remains running"],
      managedIntent: {
        workflowPlan: { recordType: "workflow-plan", recordId: plan.id, revision: plan.revision, digest: canonicalDigest(plan) },
        contextPacks: [],
        toolDefinitions: [],
        requestedEffects: ["observe"],
        requestedScopes: [],
      },
    }, "founder")
    await engine.confirmCharter(charter.id, "founder")
    const confirmedCharter = await engine.repository.readJson(
      engine.repository.resolve("sessions", `charter-${charter.id}.json`),
      executionCharterSchema,
    )
    const preparedRun = await engine.prepareManagedRun(charter.id, "founder")
    const runningRun = await engine.markRunState(preparedRun.id, "running", { kind: "system", id: "test" })
    const managedRunId = randomUUID()
    const revisionOf = (value: { revision?: number }) => value.revision ?? 1
    const binding = (recordType: "product" | "initiative" | "execution-charter" | "run", value: { id: string; revision?: number }) => ({
      recordType,
      recordId: value.id,
      revision: revisionOf(value),
      digest: canonicalDigest(value),
    })
    const bindings = {
      product: binding("product", product),
      initiative: binding("initiative", activeInitiative),
      charter: binding("execution-charter", confirmedCharter),
      run: binding("run", runningRun),
      agentSelectionDigest: canonicalDigest(selection),
      contextPacks: [],
      workflowPlan: { recordType: "workflow-plan" as const, recordId: plan.id, revision: plan.revision, digest: canonicalDigest(plan) },
      tools: [],
    }
    const now = new Date().toISOString()
    const managedRecord = managedRunRecordSchema.parse({
      schemaVersion: 2,
      kind: "managed-run",
      id: managedRunId,
      revision: 1,
      runId: runningRun.id,
      productId: product.id,
      initiativeId: activeInitiative.id,
      mode: "codex-staged",
      state: "applying",
      bindings,
      bindingsDigest: canonicalDigest(bindings),
      bindingSnapshots: { initiative: activeInitiative, run: runningRun },
      provider: {
        adapterId: selection.adapterId,
        agentId: selection.agentId,
        modelId: selection.modelId,
        capabilityDigest: selection.capabilityDigest,
        runtimeVersion: capabilities.runtimeVersion,
      },
      rootManagedRunId: managedRunId,
      attemptNumber: 1,
      recovery: { status: "not-required" },
      createdAt: now,
      startedAt: now,
      updatedAt: now,
    })
    await engine.repository.withLock(async () => engine.repository.commitMutation({
      writes: [{
        path: engine.repository.resolve("sessions", `managed-run-${managedRunId}.json`),
        value: managedRecord,
        schema: managedRunRecordSchema,
        governed: true,
      }],
      audit: {
        eventType: "test.managed-run.applying",
        actor: { kind: "system", id: "test.fixture" },
        subjectId: managedRunId,
        payload: { fixture: true },
      },
    }))

    const localTemp = await mkdtemp(join(tmpdir(), "gaep-engine-managed-recovery-"))
    try {
      const staging = new WorkspaceStagingService({ tempParent: localTemp })
      const stageRegistry = new ManagedStageRegistry(localTemp)
      const stage = await staging.create(workspace)
      await stageRegistry.register(managedRunId, stage)
      await stageRegistry.markReview(managedRunId)
      await stageRegistry.markApplying(managedRunId)

      const restarted = new GaepEngine(workspace, [new FakeAdapter()], {}, stageRegistry)
      await expect(restarted.recoverInterruptedRuns("test.managed-restart")).resolves.toEqual([])
      expect((await restarted.readManagedRun(managedRunId)).state).toBe("applying")
      expect((await restarted.listRuns()).find((run) => run.id === runningRun.id)?.state).toBe("running")
    } finally {
      await rm(localTemp, { recursive: true, force: true })
    }
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
    await engine.selectAgent(capabilities, "fake-model", { changed: true }, "founder")
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
    const handoff = await engine.createHandoff({
      fromRunId: run.id,
      toCapabilities: capabilities,
      toModelId: "fake-model",
      toSettings: { switched: true },
      reason: "Create a governed handoff record",
      completedWork: ["Integrity fixture"],
      unresolvedMatters: [],
      decisions: [],
      evidence: [],
    }, "founder")
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
    const preview = await failing.previewHandoff(input)
    expect(preview.workspaceBaseline.truthClass).toBe("unknown")
    expect(preview.workspaceBaseline.dirty).toBeNull()
    await expect(failing.createHandoff(input, "founder")).rejects.toThrow("Injected atomic-switch failure")

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
