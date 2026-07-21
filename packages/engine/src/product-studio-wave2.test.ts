import { randomUUID } from "node:crypto"
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  containsSecretShapedValue,
  type AdapterCapabilities,
  type AgentSelection,
  type ContextItem,
  type ContextTrustDimensions,
  type ExecutionCharter,
  type WorkflowStep,
} from "@gaep/contracts"
import {
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

    await engine.productStudio.revokeInstructionPrivilegeGrant(
      grant.id,
      grant.revision,
      "The external instruction source is no longer permitted for new Context Packs.",
      "founder",
    )
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
    await engine.updateInitiativeState(initiative.id, "active", "Begin bounded execution preparation", "founder")
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
