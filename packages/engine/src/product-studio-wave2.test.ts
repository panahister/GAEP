import { randomUUID } from "node:crypto"
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  containsSecretShapedValue,
  initiativeApplicabilitySubjectDefinitions,
  type AdapterCapabilities,
  type AgentSelection,
  type ContextItem,
  type ContextTrustDimensions,
  type ExecutionCharter,
  type Initiative,
  type ManagedRunEvidence,
  type ManagedRunRecord,
  type ManagedRunResult,
  type ProductExportBundle,
  type WorkflowStep,
} from "@gaep/contracts"
import {
  DeterministicManualAdapter,
  canonicalDigest,
  capabilityDigest,
  requireExecutableRuntimeBinding,
  type AdapterProbeResult,
  type AdapterRuntimeBinding,
  type AgentAdapter,
  type AgentInvocation,
} from "@gaep/agent-sdk"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { GaepEngine } from "./engine.js"

const capabilities: AdapterCapabilities = {
  schemaVersion: 1,
  adapterId: "gaep.product-studio-fake",
  adapterVersion: "1.0.0",
  agentId: "product-studio-fake",
  agentLabel: "Product Studio Fake",
  runtimeVersion: "1.0.0",
  detected: true,
  executionInterface: "cli-jsonl",
  interfaceMaturity: "stable",
  supportsResume: false,
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
  limitations: ["Test-only runtime"],
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
    digest: `sha256:${"c".repeat(64)}`,
    size: 1,
    modifiedAtMs: 1,
  },
}

class FakeAdapter implements AgentAdapter {
  readonly id = capabilities.adapterId
  async probe(): Promise<AdapterProbeResult> { return { capabilities, runtimeBinding } }
  validateSelection(selection: AgentSelection, observed: AdapterCapabilities): string[] {
    return selection.capabilityDigest === capabilityDigest(observed) ? [] : ["Capability mismatch"]
  }
  buildInvocation(
    _selection: AgentSelection,
    _charter: ExecutionCharter,
    workspacePath: string,
    prompt: string,
    localBinding: AdapterRuntimeBinding,
  ): AgentInvocation {
    const executable = requireExecutableRuntimeBinding(localBinding, _selection, "Product Studio Fake Adapter")
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

const workspaceRoot = { kind: "workspace-relative" as const, path: "." }
const sourceScope = { kind: "workspace-relative" as const, path: "src" }

describe("Product Studio context, workflow, tools, and portability", () => {
  let workspace: string
  let engine: GaepEngine

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "gaep-product-wave2-"))
    engine = new GaepEngine(workspace, [new FakeAdapter()])
  })

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true })
  })

  async function initialize() {
    const product = await engine.createProduct({
      name: "Atlas",
      summary: "A portable local Product for context and workflow tests.",
      problem: "Context, tool, and workflow semantics can be collapsed into unsafe execution assumptions.",
      affectedUsers: "Founders and engineering teams",
      desiredOutcome: "Context and plans remain explicit, bounded, and independently inspectable.",
      successSignals: ["Portable exports reproduce exact Product-domain records"],
      firstWorkflow: "Assemble context, resolve a plan, select tools, and preview an export.",
      exclusions: ["Production authorization"],
      profile: "software",
    }, "founder")
    const initiative = await engine.createInitiative({
      title: "Context and workflow slice",
      outcome: "Exercise context, planning, tool, and portability semantics.",
      scope: ["Local Product Studio"],
      exclusions: ["External effects"],
    }, "founder")
    return { product, initiative }
  }

  async function activateTestInitiative(initiative: Initiative, reason: string): Promise<Initiative> {
    const classified = await engine.classifyInitiative(initiative.id, {
      primaryType: "product-increment",
      secondaryTypes: ["feature"],
      systemState: "brownfield",
      changePosture: "existing",
      motivations: ["business-driven", "technical"],
      characteristics: {
        userInterface: "ui-bearing",
        data: "data-bearing",
        integration: "mixed",
        interactionModes: ["interactive", "synchronous"],
        exposure: "internal",
      },
      regulated: false,
      policyDomains: [],
      sensitivities: ["security", "privacy", "data"],
      expectedLifetime: "long-lived",
      maintenanceHorizon: "Maintained with the local Product Studio lifecycle",
      risk: { blastRadius: "localized", reversibility: "reversible", urgency: "normal", costOfFailure: "medium" },
      dependencies: ["Local Product Studio records"],
      affectedAssets: ["Portable Product workspace"],
      owner: "Product Studio test owner",
      accountableAuthority: "Product Studio test authority",
      confidence: { level: "high", basis: "The deterministic Product Studio fixture is exact" },
      evidence: [{ kind: "evidence", reference: "product-studio-wave2-test-fixture" }],
      unresolvedQuestions: [],
      rationale: "The fixture exercises an existing Product Studio increment with bounded portable evidence.",
    }, initiative.revision!, "founder")
    const resolved = await engine.resolveInitiativeApplicability(initiative.id, {
      decisions: initiativeApplicabilitySubjectDefinitions.map((subject) => ({
        subject: { ...subject },
        status: "optional",
        rationale: "This canonical subject was explicitly evaluated for the bounded Product Studio fixture.",
        sources: [{ kind: "policy", reference: "GAEP-DYNAMIC-ENGINEERING-MODEL" }],
        owner: "Product Studio test owner",
        dependencies: [],
        conditions: [],
        reviewTriggers: ["The fixture scope, classification, policy, or evidence changes"],
        approval: { state: "not-required", conditions: [] },
        relatedRecords: [],
        relatedImplementationUnits: [],
      })),
      unresolvedSubjects: [],
    }, classified.revision!, "founder")
    return engine.updateInitiativeState(resolved.id, "active", reason, "founder")
  }

  function trust(
    classification: ContextTrustDimensions["confidentiality"]["classification"] = "internal",
    instructionPrivilege: ContextTrustDimensions["instructionPrivilege"] = "workflow-data",
  ): ContextTrustDimensions {
    return {
      semanticAuthority: {
        standing: "advisory",
        domain: "Product design",
        owner: "founder",
        scope: ["Local Founder Edition"],
        precedence: 10,
      },
      epistemicRole: "reference",
      sourceAuthenticity: "verified",
      contentIntegrity: "verified",
      confidentiality: {
        classification,
        purpose: "Resolve the bounded local workflow",
        recipients: ["local-agent"],
        retention: "Retain with the Product revision",
      },
      instructionPrivilege,
      freshness: { status: "fresh", assessedAt: new Date().toISOString(), basis: "Current governed revision" },
      validity: { status: "valid", basis: "Schema and source checks passed" },
      revisionDisposition: "current",
      applicability: { status: "applicable", basis: "Directly targets the tested workflow" },
    }
  }

  function contextItem(overrides: Partial<ContextItem> = {}): ContextItem {
    const content = overrides.content ?? "Bounded reference context for the local workflow."
    return {
      id: randomUUID(),
      source: { kind: "logical", value: "product-direction" },
      sourceDigest: canonicalDigest(content),
      selectionReason: "Required Product direction",
      required: true,
      content,
      contentDigest: canonicalDigest(content),
      trust: trust(),
      transformations: [],
      ...overrides,
    }
  }

  function workflowStep(overrides: Partial<WorkflowStep> = {}): WorkflowStep {
    return {
      id: randomUUID(),
      title: "Inspect bounded context",
      objective: "Read the selected context and produce one reviewable observation.",
      responsibility: { kind: "agent", id: "local-agent" },
      contextPacks: [],
      toolDefinitions: [],
      dependsOn: [],
      preconditions: ["The Context Pack is sufficient"],
      outputs: ["A bounded observation"],
      evidenceCriteria: ["The observation cites its Context Item"],
      retry: { maxAttempts: 1, backoffMs: 0, retryOn: [] },
      stopConditions: ["Stop if context validity changes"],
      scope: { read: [workspaceRoot], write: [], effects: [] },
      effectEnvelope: ["observe"],
      ...overrides,
    }
  }

  async function createContextPack(item = contextItem()) {
    return engine.productStudio.createContextPack({
      objective: "Provide sufficient bounded context for one local workflow.",
      recipient: { kind: "agent", id: "local-agent" },
      items: [item],
      omissions: [],
      warnings: [],
      conflicts: [],
      classificationCombinationRisk: "No additional combination risk was identified for this single item.",
      sufficiencyCriteria: ["The current Product direction is present and valid"],
      sufficiencyEvaluator: { kind: "system", id: "gaep.context-evaluator" },
      sufficiencyAssumptions: [],
    }, 1, "founder")
  }

  async function createTool(effect: "observe" | "reversible-change" = "observe") {
    return engine.productStudio.createToolDefinition({
      definitionType: "tool",
      key: effect === "observe" ? "workspace-reader" : "workspace-editor",
      name: effect === "observe" ? "Workspace Reader" : "Workspace Editor",
      binding: { adapterId: "gaep.product-studio-fake", providerId: "local", toolName: effect === "observe" ? "read-workspace" : "edit-workspace" },
      purpose: effect === "observe" ? "Read declared workspace-relative files." : "Modify declared workspace-relative files.",
      inputContract: ["A normalized workspace-relative scope"],
      outputContract: ["A bounded result with provenance"],
      allowedScopes: [sourceScope],
      requiredPermissions: [{ capability: effect === "observe" ? "read-workspace" : "modify-workspace", mode: "allow" }],
      effectEnvelope: [effect],
      trust: {
        source: "configured",
        maturity: "experimental",
        assessedAt: new Date().toISOString(),
        basis: "Locally configured Founder Edition definition",
      },
      limitations: ["Definition presence does not grant permission or authority"],
      enabled: true,
      policy: {
        requiresHumanConfirmation: true,
        forbiddenInUntrustedWorkspace: true,
        allowedProfiles: ["software"],
      },
    }, 1, "founder")
  }

  function refreshPortableMembership(bundle: ProductExportBundle): void {
    bundle.manifest.membershipDigest = canonicalDigest(
      bundle.manifest.members.map(({ path, digest }) => ({ path, digest })),
    )
  }

  function refreshPortableMember(bundle: ProductExportBundle, path: string): void {
    const record = bundle.records.find((candidate) => candidate.path === path)
    const member = bundle.manifest.members.find((candidate) => candidate.path === path)
    if (!record || !member) throw new Error(`Portable fixture member is missing: ${path}`)
    member.digest = canonicalDigest(record.content)
    member.byteLength = Buffer.byteLength(`${JSON.stringify(record.content, null, 2)}\n`)
  }

  function addPortableMember(
    bundle: ProductExportBundle,
    path: string,
    recordType: string,
    content: ProductExportBundle["records"][number]["content"],
  ): void {
    bundle.records.push({ path, content })
    bundle.manifest.members.push({
      path,
      recordType,
      digest: canonicalDigest(content),
      byteLength: Buffer.byteLength(`${JSON.stringify(content, null, 2)}\n`),
    })
    bundle.records.sort((left, right) => left.path.localeCompare(right.path))
    bundle.manifest.members.sort((left, right) => left.path.localeCompare(right.path))
    refreshPortableMembership(bundle)
  }

  async function createManagedPortableFixture(options: { runCount?: number; stepCount?: number } = {}) {
    const adapter = new DeterministicManualAdapter()
    engine = new GaepEngine(workspace, [adapter])
    const product = await engine.createProduct({
      name: "Portable Managed Atlas",
      summary: "A Product with complete portable Managed Run lineage.",
      problem: "Portable import must reject cross-run and orphan execution evidence.",
      affectedUsers: "Founders reviewing imported execution evidence",
      desiredOutcome: "Every imported result is bound to its exact Managed Run and evidence.",
      successSignals: ["Adversarial execution graphs fail closed"],
      firstWorkflow: "Execute deterministic offline Workflow steps and export their evidence.",
      exclusions: ["External effects"],
      profile: "software",
    }, "founder")
    const probe = await adapter.probe()
    await engine.selectAgent(probe.capabilities, "manual-deterministic-v1", { script: "success" }, "founder")
    const managedRunIds: string[] = []
    for (let runIndex = 0; runIndex < (options.runCount ?? 1); runIndex += 1) {
      const initiative = await engine.createInitiative({
        title: `Portable managed graph ${runIndex + 1}`,
        outcome: "Produce one exact deterministic Managed Run graph.",
        scope: ["Portable evidence validation"],
        exclusions: ["Workspace mutation"],
      }, "founder")
      await activateTestInitiative(initiative, "Begin portable graph fixture")
      const content = `Bounded deterministic Context for Managed Run ${runIndex + 1}.`
      const manualTrust = trust()
      manualTrust.confidentiality.recipients = ["manual"]
      const pack = await engine.productStudio.createContextPack({
        objective: `Provide exact Context for Managed Run ${runIndex + 1}.`,
        recipient: { kind: "agent", id: "manual" },
        items: [{
          id: randomUUID(),
          source: { kind: "logical", value: `portable-managed-${runIndex + 1}` },
          sourceDigest: canonicalDigest(content),
          selectionReason: "Required deterministic import fixture",
          required: true,
          content,
          contentDigest: canonicalDigest(content),
          trust: manualTrust,
          transformations: [],
        }],
        omissions: [],
        warnings: [],
        conflicts: [],
        classificationCombinationRisk: "One bounded internal fixture adds no combination risk.",
        sufficiencyCriteria: ["The exact deterministic fixture is present"],
        sufficiencyEvaluator: { kind: "system", id: "gaep.portable-import-test" },
        sufficiencyAssumptions: [],
      }, product.revision ?? 1, "founder")
      const packReference = {
        recordType: "context-pack" as const,
        recordId: pack.id,
        revision: pack.revision,
        digest: canonicalDigest(pack),
      }
      const steps: WorkflowStep[] = []
      for (let stepIndex = 0; stepIndex < (options.stepCount ?? 1); stepIndex += 1) {
        steps.push(workflowStep({
          id: randomUUID(),
          title: `Portable deterministic step ${stepIndex + 1}`,
          objective: `Produce exact offline evidence for step ${stepIndex + 1}.`,
          responsibility: { kind: "agent", id: "manual" },
          contextPacks: [packReference],
          dependsOn: stepIndex === 0 ? [] : [steps[stepIndex - 1]!.id],
          scope: { read: [workspaceRoot], write: [], effects: [] },
        }))
      }
      const draftPlan = await engine.productStudio.createWorkflowPlan({
        title: `Portable managed Workflow ${runIndex + 1}`,
        objective: "Produce a complete deterministic result and evidence lineage.",
        subject: {
          recordType: "product",
          recordId: product.id,
          revision: product.revision ?? 1,
          digest: canonicalDigest(product),
        },
        actor: { kind: "human", id: "founder" },
        strategy: "sequential",
        contextPacks: [packReference],
        toolDefinitions: [],
        steps,
      }, product.revision ?? 1, "founder")
      const plan = await engine.productStudio.reviseWorkflowPlan(
        draftPlan.id,
        draftPlan.revision,
        { state: "resolved" },
        "founder",
        "The deterministic portable Workflow is exactly resolved",
      )
      const charter = await engine.createCharter({
        initiativeId: initiative.id,
        objective: "Produce deterministic offline evidence without Tool effects.",
        permissions: [{ capability: "all-tools", mode: "deny", scope: [] }],
        expectedEffects: ["observe"],
        forbiddenActions: ["Do not use tools, network, or workspace mutation"],
        stopConditions: ["Stop after the deterministic terminal fixture"],
        requiredEvidence: ["Exact Workflow attempts and normalized events"],
        managedIntent: {
          workflowPlan: { recordType: "workflow-plan", recordId: plan.id, revision: plan.revision, digest: canonicalDigest(plan) },
          contextPacks: [packReference],
          toolDefinitions: [],
          requestedEffects: ["observe"],
          requestedScopes: [],
        },
      }, "founder")
      await engine.confirmCharter(charter.id, "founder")
      const run = await engine.prepareManagedRun(charter.id, "founder")
      const handle = await engine.startManagedRun({
        runId: run.id,
        workflowPlanId: plan.id,
        evaluateWorkflowGate: async (request) => ({
          status: "satisfied",
          basis: "system-evaluator",
          evaluator: {
            kind: "system",
            id: "gaep.portable-fixture",
            version: "1",
            digest: canonicalDigest({ kind: "system", id: "gaep.portable-fixture", version: "1" }) as `sha256:${string}`,
          },
          evidenceDigest: canonicalDigest({
            stepId: request.stepId,
            attempt: request.attempt,
            phase: request.phase,
            criteriaDigest: request.criteriaDigest,
          }) as `sha256:${string}`,
        }),
      }, "founder")
      const draining = (async () => { for await (const _event of handle.events) { /* drain */ } })()
      const review = await handle.completion
      await draining
      expect(review.record.state).toBe("completed")
      managedRunIds.push(review.record.id)
    }
    return { bundle: await engine.productStudio.buildPortableExport(), managedRunIds }
  }

  it("keeps context trust dimensions independent, derives classification, and computes sufficiency", async () => {
    await initialize()
    const item = contextItem({ trust: trust("restricted") })
    const pack = await createContextPack(item)
    expect(pack.classification.level).toBe("restricted")
    expect(pack.sufficiency.status).toBe("sufficient")
    expect(pack.authorityBoundary).toBe("context-sufficiency-does-not-grant-authority")
    expect(pack.packDigest).toMatch(/^sha256:/)

    const stale = contextItem({
      trust: {
        ...trust(),
        freshness: { status: "stale", assessedAt: new Date().toISOString(), basis: "Source revision changed" },
      },
    })
    const insufficient = await createContextPack(stale)
    expect(insufficient.sufficiency.status).toBe("insufficient")
    expect(insufficient.sufficiency.reasons).toEqual(expect.arrayContaining([expect.stringMatching(/stale/)]))
  })

  it("treats external content as untrusted data unless an exact governed source grants privilege", async () => {
    const { product } = await initialize()
    const content = "External instructions are data until a governed source explicitly grants privilege."
    await expect(createContextPack(contextItem({
      trust: trust("internal", "capability-instruction"),
    }))).rejects.toThrow(/exact governed grant/i)
    const external = contextItem({
      source: { kind: "external-uri", uri: "https://example.test/context" },
      sourceDigest: canonicalDigest(content),
      content,
      contentDigest: canonicalDigest(content),
      trust: trust("public", "governing-instruction"),
    })
    await expect(createContextPack(external)).rejects.toThrow(/governed grant/i)

    const requirement = await engine.productStudio.createRequirement({
      key: "CTX-001",
      statement: "The named external fixture may supply governing instructions only for this local test.",
      rationale: "Exercise exact privilege assignment without trusting retrieval by default.",
      priority: "must",
      verificationCriteria: ["Context grant binds this exact requirement revision"],
      sourceRecords: [],
    }, product.revision ?? 1, "founder")
    const acceptedRequirement = await engine.productStudio.reviseRequirement(
      requirement.id,
      requirement.revision,
      { state: "accepted" },
      "founder",
      "The Founder accepts this exact instruction-authority boundary for the local test.",
    )
    const grant = await engine.productStudio.createInstructionPrivilegeGrant({
      source: external.source,
      sourceDigest: external.sourceDigest,
      privilege: "governing-instruction",
      purpose: "Provide sufficient bounded context for one local workflow.",
      recipient: { kind: "agent", id: "local-agent" },
      scope: ["Local Founder Edition"],
      authority: {
        recordType: "requirement",
        recordId: acceptedRequirement.id,
        revision: acceptedRequirement.revision,
        digest: canonicalDigest(acceptedRequirement),
      },
    }, product.revision ?? 1, "founder")
    external.instructionPrivilegeGrant = {
      recordType: "instruction-privilege-grant",
      recordId: grant.id,
      revision: grant.revision,
      digest: canonicalDigest(grant),
    }
    const privileged = await createContextPack(external)
    expect(privileged.items[0]?.instructionPrivilegeGrant?.recordId).toBe(grant.id)
    await expect(engine.productStudio.assertContextPackExecutionAuthority(privileged, "local-agent")).resolves.toBeUndefined()

    await engine.productStudio.revokeInstructionPrivilegeGrant(
      grant.id,
      grant.revision,
      "The external instruction source is no longer permitted for new Context Packs.",
      "founder",
    )
    await expect(engine.productStudio.assertContextPackExecutionAuthority(privileged, "local-agent"))
      .rejects.toThrow(/stale or no longer active/i)
    await expect(createContextPack(external)).rejects.toThrow(/stale or no longer active/i)

    await engine.productStudio.reviseRequirement(requirement.id, acceptedRequirement.revision, {
      statement: "The external privilege grant has been materially revised and prior packs are stale.",
    }, "founder")
    await expect(engine.productStudio.createInstructionPrivilegeGrant({
      source: external.source,
      sourceDigest: external.sourceDigest,
      privilege: "governing-instruction",
      purpose: "Provide sufficient bounded context for one local workflow.",
      recipient: { kind: "agent", id: "local-agent" },
      scope: ["Local Founder Edition"],
      authority: {
        recordType: "requirement",
        recordId: acceptedRequirement.id,
        revision: acceptedRequirement.revision,
        digest: canonicalDigest(acceptedRequirement),
      },
    }, product.revision ?? 1, "founder")).rejects.toThrow(/current governed revision/i)
    const health = await engine.workspaceHealth()
    expect(health.status).toBe("degraded")
    expect(health.issues.some((issue) => issue.code === "product.context-stale")).toBe(true)
  })

  it("rejects external locators containing userinfo or secret-bearing URL parameters", async () => {
    await initialize()
    const content = "Untrusted external reference data."
    for (const uri of [
      "https://user:password@example.test/context",
      "https://example.test/context?access_token=abcdefghijklmnopqrstuvwxyz123456",
      "https://example.test/context#signature=abcdefghijklmnopqrstuvwxyz123456",
    ]) {
      await expect(createContextPack(contextItem({
        source: { kind: "external-uri", uri },
        sourceDigest: canonicalDigest(content),
        content,
        contentDigest: canonicalDigest(content),
        trust: trust("public", "untrusted-external-content"),
      }))).rejects.toThrow(/External URIs/i)
    }
  })

  it("redacts secret-shaped transient content and rejects unredacted portable context", async () => {
    await initialize()
    const raw = "api_key=sk-abcdefghijklmnopqrstuvwxyz123456"
    const redacted = engine.productStudio.redactContextContent(raw)
    expect(redacted.redactions).toBe(1)
    expect(redacted.text).toBe("[REDACTED_SECRET]")
    expect(containsSecretShapedValue(redacted.text)).toBe(false)
    expect(containsSecretShapedValue("Bearer abcdefghijklmnopqrstuvwxyz123456")).toBe(true)
    expect(containsSecretShapedValue("The bearer role is discussed in ordinary prose.")).toBe(false)
    await expect(createContextPack(contextItem({
      content: raw,
      sourceDigest: canonicalDigest(raw),
      contentDigest: canonicalDigest(raw),
    }))).rejects.toThrow(/secret-shaped/i)
    await expect(createContextPack(contextItem({
      content: redacted.text,
      sourceDigest: canonicalDigest(raw),
      contentDigest: canonicalDigest(redacted.text),
      transformations: [{
        kind: "redaction",
        method: "GAEP local secret-shaped-value redaction",
        sourceDigest: canonicalDigest(raw),
        outputDigest: canonicalDigest(redacted.text),
        omissions: ["One secret-shaped value"],
        lossy: true,
      }],
    }))).resolves.toMatchObject({ sufficiency: { status: "sufficient" } })
  })

  it("validates Workflow Step DAGs and defaults to sequential execution", async () => {
    const { product } = await initialize()
    const first = workflowStep()
    const second = workflowStep({
      id: randomUUID(),
      title: "Review the observation",
      objective: "Review the prior bounded observation against the Product objective.",
      dependsOn: [first.id],
      responsibility: { kind: "human", id: "founder" },
    })
    const plan = await engine.productStudio.createWorkflowPlan({
      title: "Sequential review workflow",
      objective: "Produce and review one bounded Product observation.",
      subject: { recordType: "product", recordId: product.id, revision: 1, digest: canonicalDigest(product) },
      actor: { kind: "human", id: "founder" },
      contextPacks: [],
      toolDefinitions: [],
      steps: [first, second],
    }, 1, "founder")
    expect(plan.strategy).toBe("sequential")
    expect(plan.planDigest).toMatch(/^sha256:/)

    const cyclicFirst = { ...first, dependsOn: [second.id] }
    await expect(engine.productStudio.createWorkflowPlan({
      title: "Cyclic workflow",
      objective: "This workflow must fail dependency validation.",
      subject: { recordType: "product", recordId: product.id, revision: 1, digest: canonicalDigest(product) },
      actor: { kind: "human", id: "founder" },
      contextPacks: [],
      toolDefinitions: [],
      steps: [cyclicFirst, second],
    }, 1, "founder")).rejects.toThrow(/cycle/i)
  })

  it("allows read-only parallel analysis and fails closed on effectful scopes or tools", async () => {
    const { product } = await initialize()
    const readTool = await createTool("observe")
    const readReference = {
      recordType: "tool-definition" as const,
      recordId: readTool.id,
      revision: readTool.revision,
      digest: canonicalDigest(readTool),
    }
    const first = workflowStep()
    const second = workflowStep({ id: randomUUID(), title: "Inspect the same read scope" })
    await expect(engine.productStudio.createWorkflowPlan({
      title: "Parallel read-only analysis",
      objective: "Run independent observations over overlapping read-only context.",
      subject: { recordType: "product", recordId: product.id, revision: 1, digest: canonicalDigest(product) },
      actor: { kind: "human", id: "founder" },
      strategy: "parallel-readonly",
      contextPacks: [],
      toolDefinitions: [readReference],
      steps: [first, second],
    }, 1, "founder")).resolves.toMatchObject({ strategy: "parallel-readonly" })

    const effectfulStep = workflowStep({
      scope: { read: [workspaceRoot], write: [sourceScope], effects: [] },
      effectEnvelope: ["reversible-change"],
    })
    await expect(engine.productStudio.createWorkflowPlan({
      title: "Unsafe parallel write",
      objective: "This plan must fail rather than race an effectful workspace scope.",
      subject: { recordType: "product", recordId: product.id, revision: 1, digest: canonicalDigest(product) },
      actor: { kind: "human", id: "founder" },
      strategy: "parallel-readonly",
      contextPacks: [],
      toolDefinitions: [],
      steps: [effectfulStep],
    }, 1, "founder")).rejects.toThrow(/read-only/i)

    const effectfulTool = await createTool("reversible-change")
    await expect(engine.productStudio.createWorkflowPlan({
      title: "Unsafe parallel tool",
      objective: "This plan must reject an effectful tool in a read-only parallel strategy.",
      subject: { recordType: "product", recordId: product.id, revision: 1, digest: canonicalDigest(product) },
      actor: { kind: "human", id: "founder" },
      strategy: "parallel-readonly",
      contextPacks: [],
      toolDefinitions: [{
        recordType: "tool-definition",
        recordId: effectfulTool.id,
        revision: effectfulTool.revision,
        digest: canonicalDigest(effectfulTool),
      }],
      steps: [first],
    }, 1, "founder")).rejects.toThrow(/effectful Tool/i)
  })

  it("keeps Tool Definitions non-authorizing and derives exact run-selection policy readiness", async () => {
    const { product, initiative } = await initialize()
    await activateTestInitiative(initiative, "Begin bounded execution preparation")
    await engine.selectAgent(capabilities, "fake-model", {}, "founder")
    const charter = await engine.createCharter({
      initiativeId: initiative.id,
      objective: "Prepare a Run for exact Tool selection policy evaluation.",
      permissions: [{ capability: "read-workspace", mode: "allow", scope: ["."] }],
      expectedEffects: ["observe"],
      forbiddenActions: ["Do not mutate"],
      stopConditions: ["Stop if tool policy is blocked"],
      requiredEvidence: ["Tool readiness result"],
    }, "founder")
    await engine.confirmCharter(charter.id, "founder")
    const { run } = await engine.prepareRun(charter.id, "founder")
    const tool = await createTool("observe")
    expect(tool.authorityBoundary).toBe("tool-presence-does-not-grant-authority")
    const reference = {
      recordType: "tool-definition" as const,
      recordId: tool.id,
      revision: tool.revision,
      digest: canonicalDigest(tool),
    }
    const blocked = await engine.productStudio.createRunToolSelection({
      runId: run.id,
      tools: [reference],
      requestedEffects: ["observe"],
      requestedScopes: [sourceScope],
      confirmedToolIds: [],
      workspaceTrusted: false,
    }, product.revision ?? 1, "founder")
    expect(blocked.readiness.status).toBe("blocked")
    expect(blocked.readiness.issues).toEqual(expect.arrayContaining([
      expect.stringMatching(/untrusted workspace/),
      expect.stringMatching(/human confirmation/),
    ]))
    const outOfScope = await engine.productStudio.reviseRunToolSelection(blocked.id, 1, {
      confirmedToolIds: [tool.id],
      requestedScopes: [workspaceRoot],
      workspaceTrusted: true,
    }, "founder")
    expect(outOfScope.readiness.status).toBe("blocked")
    expect(outOfScope.readiness.issues).toEqual(expect.arrayContaining([expect.stringMatching(/not allowed/i)]))
    const ready = await engine.productStudio.reviseRunToolSelection(blocked.id, outOfScope.revision, {
      requestedScopes: [sourceScope],
      workspaceTrusted: true,
    }, "founder")
    expect(ready.readiness.status).toBe("ready")
    expect(ready.authorityBoundary).toBe("tool-selection-does-not-grant-authority")
    await engine.markRunState(run.id, "running", { kind: "human", id: "founder" })
    await expect(engine.productStudio.reviseRunToolSelection(ready.id, ready.revision, {
      workspaceTrusted: true,
    }, "founder")).rejects.toThrow(/immutable while Run is running/i)
  })

  it("builds deterministic safe exports and previews imports without mutation", async () => {
    await initialize()
    await createContextPack()
    await createTool("observe")
    const auditBefore = await engine.repository.verifyAudit()
    const first = await engine.productStudio.buildPortableExport()
    const second = await engine.productStudio.buildPortableExport()
    expect(second).toEqual(first)
    expect(first.manifest.members.map((member) => member.path)).toEqual(
      [...first.manifest.members.map((member) => member.path)].sort(),
    )
    expect(first.manifest.members.some((member) => member.path.startsWith("runtime/"))).toBe(false)
    expect(first.manifest.members.some((member) => member.path.startsWith("sessions/"))).toBe(false)
    expect((await engine.repository.verifyAudit()).events).toBe(auditBefore.events)

    const bundlePath = join(workspace, "portable-product.json")
    await writeFile(bundlePath, `${JSON.stringify(first, null, 2)}\n`)
    const preview = await engine.productStudio.previewImportFile(bundlePath)
    expect(preview.status).toBe("compatible")
    expect(preview.importMutation).toBe("not-performed")
    expect((await engine.repository.verifyAudit()).events).toBe(auditBefore.events)

    const tampered = structuredClone(first)
    tampered.manifest.members[0]!.digest = `sha256:${"0".repeat(64)}`
    await expect(engine.productStudio.previewImportBundle(tampered)).rejects.toThrow(/digest mismatch/i)

    const forgedHistory = structuredClone(first)
    const historyRecord = forgedHistory.records.find((record) => record.path.startsWith("record-history/"))!
    ;(historyRecord.content as { predecessorDigest?: string }).predecessorDigest = `sha256:${"0".repeat(64)}`
    const historyMember = forgedHistory.manifest.members.find((member) => member.path === historyRecord.path)!
    historyMember.digest = canonicalDigest(historyRecord.content)
    historyMember.byteLength = Buffer.byteLength(`${JSON.stringify(historyRecord.content, null, 2)}\n`)
    forgedHistory.manifest.membershipDigest = canonicalDigest(
      forgedHistory.manifest.members.map(({ path, digest }) => ({ path, digest })),
    )
    await expect(engine.productStudio.previewImportBundle(forgedHistory)).rejects.toThrow(/first immutable history revision/i)

    const traversal = structuredClone(first) as unknown as { manifest: { members: Array<{ path: string }> }; records: Array<{ path: string }> }
    traversal.manifest.members[0]!.path = "../outside.json"
    traversal.records[0]!.path = "../outside.json"
    await expect(engine.productStudio.previewImportBundle(traversal)).rejects.toThrow()

    if (process.platform !== "win32") {
      const symlinkPath = join(workspace, "portable-product-link.json")
      await symlink(bundlePath, symlinkPath)
      await expect(engine.productStudio.previewImportFile(symlinkPath)).rejects.toThrow(/symbolic-link/i)
    }
  })

  it("accepts exact Record History paths whose UUID begins with hexadecimal letters", async () => {
    await initialize()
    await createTool("observe")
    const bundle = structuredClone(await engine.productStudio.buildPortableExport())
    const toolRecord = bundle.records.find((record) => record.path.startsWith("tools/"))!
    const tool = toolRecord.content as { id: string }
    const historyRecord = bundle.records.find((record) => {
      const history = record.content as { recordType?: string; recordId?: string }
      return history.recordType === "tool-definition" && history.recordId === tool.id
    })!
    const history = historyRecord.content as {
      recordId: string
      revision: number
      recordDigest: string
      snapshot: { id: string }
    }
    const toolMember = bundle.manifest.members.find((member) => member.path === toolRecord.path)!
    const historyMember = bundle.manifest.members.find((member) => member.path === historyRecord.path)!
    const ambiguousUuid = "abcdefab-cdef-4abc-8def-abcdefabcdef"

    tool.id = ambiguousUuid
    history.recordId = ambiguousUuid
    history.snapshot.id = ambiguousUuid
    history.recordDigest = canonicalDigest(history.snapshot)
    toolRecord.path = `tools/${ambiguousUuid}.json`
    toolMember.path = toolRecord.path
    historyRecord.path = `record-history/tool-definition-${ambiguousUuid}-r${history.revision}.json`
    historyMember.path = historyRecord.path
    bundle.records.sort((left, right) => left.path.localeCompare(right.path))
    bundle.manifest.members.sort((left, right) => left.path.localeCompare(right.path))
    refreshPortableMember(bundle, toolRecord.path)
    refreshPortableMember(bundle, historyRecord.path)
    refreshPortableMembership(bundle)

    await expect(engine.productStudio.previewImportBundle(bundle)).resolves.toMatchObject({
      status: "compatible",
      importMutation: "not-performed",
    })

    const mismatched = structuredClone(bundle)
    const exactHistoryPath = historyRecord.path
    const mismatchedPath = exactHistoryPath.replace(/-r1\.json$/u, "-r2.json")
    mismatched.records.find((record) => record.path === exactHistoryPath)!.path = mismatchedPath
    mismatched.manifest.members.find((member) => member.path === exactHistoryPath)!.path = mismatchedPath
    mismatched.records.sort((left, right) => left.path.localeCompare(right.path))
    mismatched.manifest.members.sort((left, right) => left.path.localeCompare(right.path))
    refreshPortableMembership(mismatched)
    await expect(engine.productStudio.previewImportBundle(mismatched))
      .rejects.toThrow(/Record History filename does not match its envelope/u)
  })

  it("rejects a Managed Result that substitutes exact Evidence from another Managed Run", async () => {
    const { bundle, managedRunIds } = await createManagedPortableFixture({ runCount: 2 })
    const tampered = structuredClone(bundle)
    const firstManagedPath = `sessions/managed-run-${managedRunIds[0]}.json`
    const secondManagedPath = `sessions/managed-run-${managedRunIds[1]}.json`
    const firstManaged = tampered.records.find((record) => record.path === firstManagedPath)!.content as ManagedRunRecord
    const secondManaged = tampered.records.find((record) => record.path === secondManagedPath)!.content as ManagedRunRecord
    const firstResultPath = `sessions/managed-result-${firstManaged.resultId}.json`
    const secondResultPath = `sessions/managed-result-${secondManaged.resultId}.json`
    const firstResult = tampered.records.find((record) => record.path === firstResultPath)!.content as ManagedRunResult
    const secondResult = tampered.records.find((record) => record.path === secondResultPath)!.content as ManagedRunResult
    const secondEvidence = tampered.records.find(
      (record) => record.path === `sessions/managed-evidence-${secondResult.evidenceId}.json`,
    )!.content as ManagedRunEvidence

    firstResult.evidenceId = secondEvidence.id
    firstResult.evidenceDigest = canonicalDigest(secondEvidence)
    refreshPortableMember(tampered, firstResultPath)
    firstManaged.resultDigest = canonicalDigest(firstResult)
    refreshPortableMember(tampered, firstManagedPath)
    refreshPortableMembership(tampered)

    await expect(engine.productStudio.previewImportBundle(tampered))
      .rejects.toThrow(/Managed Result .* orphaned or internally inconsistent/i)
  }, 20_000)

  it("requires an exact completed-step set and consistent Result/Workflow terminal state", async () => {
    const { bundle, managedRunIds } = await createManagedPortableFixture({ stepCount: 2 })
    const rewriteEvidenceChain = (
      candidate: ProductExportBundle,
      mutate: (evidence: ManagedRunEvidence) => void,
    ): void => {
      const managedPath = `sessions/managed-run-${managedRunIds[0]}.json`
      const managed = candidate.records.find((record) => record.path === managedPath)!.content as ManagedRunRecord
      const resultPath = `sessions/managed-result-${managed.resultId}.json`
      const result = candidate.records.find((record) => record.path === resultPath)!.content as ManagedRunResult
      const evidencePath = `sessions/managed-evidence-${result.evidenceId}.json`
      const evidence = candidate.records.find((record) => record.path === evidencePath)!.content as ManagedRunEvidence
      mutate(evidence)
      refreshPortableMember(candidate, evidencePath)
      result.evidenceDigest = canonicalDigest(evidence)
      refreshPortableMember(candidate, resultPath)
      managed.resultDigest = canonicalDigest(result)
      refreshPortableMember(candidate, managedPath)
      refreshPortableMembership(candidate)
    }

    const understated = structuredClone(bundle)
    rewriteEvidenceChain(understated, (evidence) => {
      evidence.workflow.completedStepIds = evidence.workflow.completedStepIds.slice(0, 1)
    })
    await expect(engine.productStudio.previewImportBundle(understated))
      .rejects.toThrow(/completed Workflow step set is not exact|Completed Workflow steps must exactly equal/i)

    const contradictoryTerminal = structuredClone(bundle)
    rewriteEvidenceChain(contradictoryTerminal, (evidence) => {
      evidence.workflow.terminalReasonCode = "workflow-step-failed"
    })
    await expect(engine.productStudio.previewImportBundle(contradictoryTerminal))
      .rejects.toThrow(/terminal state contradicts its Workflow completion evidence/i)
  })

  it("rejects Managed Evidence that is not reachable from retained Result lineage", async () => {
    const { bundle } = await createManagedPortableFixture()
    const tampered = structuredClone(bundle)
    const source = tampered.records.find((record) => record.path.startsWith("sessions/managed-evidence-"))!
      .content as ManagedRunEvidence
    const orphan = structuredClone(source)
    orphan.id = randomUUID()
    orphan.events = []
    orphan.eventsDigest = canonicalDigest([])
    orphan.workflow.attempts = []
    orphan.workflow.completedStepIds = []
    orphan.workflow.terminalReasonCode = "process-loss"
    orphan.actualEffects = []
    delete orphan.staging
    addPortableMember(
      tampered,
      `sessions/managed-evidence-${orphan.id}.json`,
      "managed-run-evidence",
      orphan,
    )

    await expect(engine.productStudio.previewImportBundle(tampered))
      .rejects.toThrow(/not bound by retained Managed Result lineage/i)
  })

  it("requires explicit disclosure review and provides bounded true-count pages", async () => {
    const { product } = await initialize()
    const restricted = await createContextPack(contextItem({ trust: trust("restricted") }))
    await expect(engine.productStudio.buildPortableExport()).rejects.toThrow(/explicit disclosure review/i)
    const reviewedAt = new Date().toISOString()
    const exported = await engine.productStudio.buildPortableExport({
      reviewedRecordIds: [restricted.id],
      actorId: "founder",
      reviewedAt,
    })
    expect(exported.manifest.disclosureReview).toMatchObject({
      reviewedRecordIds: [restricted.id],
      reviewedBy: { kind: "human", id: "founder" },
      evaluatedAt: reviewedAt,
    })

    for (const [index, key] of ["PAGE-001", "PAGE-002", "PAGE-003"].entries()) {
      await engine.productStudio.createRequirement({
        key,
        statement: `Bounded pagination requirement number ${index + 1}.`,
        rationale: "The host must know the true count without rendering an unbounded table.",
        priority: "should",
        verificationCriteria: ["The service returns a bounded page and total"],
        sourceRecords: [],
      }, product.revision ?? 1, "founder")
    }
    const firstPage = await engine.productStudio.listDomainPage("requirement", { limit: 2 })
    expect(firstPage.items).toHaveLength(2)
    expect(firstPage.total).toBe(3)
    expect(firstPage.hasMore).toBe(true)
    const secondPage = await engine.productStudio.listDomainPage("requirement", { offset: 2, limit: 2 })
    expect(secondPage.items).toHaveLength(1)
    expect(secondPage.hasMore).toBe(false)
    await expect(engine.productStudio.listDomainPage("requirement", { limit: 201 })).rejects.toThrow(/between 1 and 200/i)
  })

  it("blocks conflicting Product identity during preview and rejects secret-shaped imported content", async () => {
    await initialize()
    const bundle = await engine.productStudio.buildPortableExport()
    const secretBundle = structuredClone(bundle)
    const productRecord = secretBundle.records.find((record) => record.path === "product.json")!
    ;(productRecord.content as { summary: string }).summary = "api_key=sk-abcdefghijklmnopqrstuvwxyz123456"
    await expect(engine.productStudio.previewImportBundle(secretBundle)).rejects.toThrow(/secret-shaped/i)

    const otherWorkspace = await mkdtemp(join(tmpdir(), "gaep-product-import-target-"))
    try {
      const other = new GaepEngine(otherWorkspace, [])
      await other.createProduct({
        name: "Different Product",
        summary: "An initialized Product with a distinct durable identity.",
        problem: "Import must not silently replace an existing Product identity.",
        affectedUsers: "Import preview users",
        desiredOutcome: "Identity conflict remains explicit and no files are changed.",
        successSignals: ["Preview returns blocked"],
        firstWorkflow: "Preview a bundle for a different Product.",
        exclusions: [],
        profile: "software",
      }, "founder")
      const before = await other.readProduct()
      const preview = await other.productStudio.previewImportBundle(bundle)
      expect(preview.status).toBe("blocked")
      expect(preview.conflicts.some((conflict) => conflict.code === "product-identity-conflict")).toBe(true)
      expect(await other.readProduct()).toEqual(before)
    } finally {
      await rm(otherWorkspace, { recursive: true, force: true })
    }
  })
})
