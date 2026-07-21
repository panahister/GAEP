import { randomUUID } from "node:crypto"
import { execFile } from "node:child_process"
import { readdir } from "node:fs/promises"
import { promisify } from "node:util"

import {
  agentSelectionSchema,
  adapterCapabilitiesSchema,
  executionCharterSchema,
  handoffSchema,
  initiativeSchema,
  productSchema,
  runSchema,
  type AdapterCapabilities,
  type AgentSelection,
  type ExecutionCharter,
  type Handoff,
  type Initiative,
  type Product,
  type Run,
  type ToolPermission,
} from "@gaep/contracts"
import { capabilityDigest, type AgentAdapter, type AgentInvocation } from "@gaep/agent-sdk"

import { GaepRepository } from "./repository.js"

const execFileAsync = promisify(execFile)

export interface ProductInput {
  name: string
  summary: string
  problem: string
  affectedUsers: string
  desiredOutcome: string
  successSignals: string[]
  firstWorkflow: string
  exclusions: string[]
  profile: Product["profile"]
}

export interface InitiativeInput {
  title: string
  outcome: string
  scope: string[]
  exclusions: string[]
}

export class GaepEngine {
  readonly repository: GaepRepository
  readonly adapters = new Map<string, AgentAdapter>()

  constructor(readonly workspacePath: string, adapters: AgentAdapter[]) {
    this.repository = new GaepRepository(workspacePath)
    for (const adapter of adapters) {
      if (this.adapters.has(adapter.id)) throw new Error(`Duplicate adapter ${adapter.id}`)
      this.adapters.set(adapter.id, adapter)
    }
  }

  async probeAgents(): Promise<AdapterCapabilities[]> {
    return Promise.all([...this.adapters.values()].map((adapter) => adapter.probe({ refreshModels: true })))
  }

  async createProduct(input: ProductInput, actorId: string): Promise<Product> {
    const now = new Date().toISOString()
    const product = productSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      kind: "product",
      ...input,
      lifecycleState: "active",
      createdAt: now,
      updatedAt: now,
    })
    await this.repository.withLock(async () => {
      await this.repository.initialize(product.id)
      await this.repository.writeJson(this.repository.resolve("product.json"), product, productSchema)
      await this.repository.appendAudit({
        eventType: "product.created",
        actor: { kind: "human", id: actorId },
        subjectId: product.id,
        payload: { profile: product.profile },
      })
    })
    return product
  }

  async readProduct(): Promise<Product> {
    return this.repository.readJson(this.repository.resolve("product.json"), productSchema)
  }

  async createInitiative(input: InitiativeInput, actorId: string): Promise<Initiative> {
    const product = await this.readProduct()
    const now = new Date().toISOString()
    const initiative = initiativeSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      kind: "initiative",
      productId: product.id,
      ...input,
      state: "proposed",
      createdAt: now,
      updatedAt: now,
    })
    await this.repository.withLock(async () => {
      await this.repository.writeJson(
        this.repository.resolve("initiatives", `${initiative.id}.json`),
        initiative,
        initiativeSchema,
      )
      await this.repository.appendAudit({
        eventType: "initiative.created",
        actor: { kind: "human", id: actorId },
        subjectId: initiative.id,
        payload: { productId: product.id },
      })
    })
    return initiative
  }

  async readInitiative(id: string): Promise<Initiative> {
    return this.repository.readJson(this.repository.resolve("initiatives", `${id}.json`), initiativeSchema)
  }

  async updateInitiativeState(
    id: string,
    state: Initiative["state"],
    reason: string,
    actorId: string,
  ): Promise<Initiative> {
    if (reason.trim().length < 2) throw new Error("A state-change reason is required")
    const path = this.repository.resolve("initiatives", `${id}.json`)
    const current = await this.repository.readJson(path, initiativeSchema)
    const updated = initiativeSchema.parse({ ...current, state, updatedAt: new Date().toISOString() })
    await this.repository.withLock(async () => {
      await this.repository.writeJson(path, updated, initiativeSchema)
      await this.repository.appendAudit({
        eventType: "initiative.state.changed",
        actor: { kind: "human", id: actorId },
        subjectId: id,
        payload: { from: current.state, to: state, reason, productMutation: false },
      })
    })
    return updated
  }

  async selectAgent(
    capabilities: AdapterCapabilities,
    modelId: string,
    settings: Record<string, unknown>,
    actorId: string,
  ): Promise<AgentSelection> {
    const adapter = this.adapters.get(capabilities.adapterId)
    if (!adapter) throw new Error(`Adapter ${capabilities.adapterId} is not registered`)
    const model = capabilities.models.find((candidate) => candidate.id === modelId)
    const selection = agentSelectionSchema.parse({
      adapterId: capabilities.adapterId,
      agentId: capabilities.agentId,
      runtimeExecutable: capabilities.executablePath,
      modelId,
      modelTruthClass: model?.truthClass ?? "configured",
      modelAlias: model?.alias ?? null,
      settings,
      selectedAt: new Date().toISOString(),
      capabilityDigest: capabilityDigest(capabilities),
    })
    const errors = adapter.validateSelection(selection, capabilities)
    if (errors.length > 0) throw new Error(errors.join("; "))
    await this.repository.withLock(async () => {
      await this.repository.writeJson(
        this.repository.resolve("runtime", "selection.json"),
        selection,
        agentSelectionSchema,
      )
      await this.repository.writeJson(
        this.repository.resolve("runtime", `capabilities-${capabilities.agentId}.json`),
        capabilities,
        adapterCapabilitiesSchema,
      )
      await this.repository.appendAudit({
        eventType: "agent.selected",
        actor: { kind: "human", id: actorId },
        subjectId: selection.agentId,
        payload: { modelId, adapterId: selection.adapterId, capabilityDigest: selection.capabilityDigest },
      })
    })
    return selection
  }

  async readSelection(): Promise<AgentSelection> {
    return this.repository.readJson(this.repository.resolve("runtime", "selection.json"), agentSelectionSchema)
  }

  async listRuns(): Promise<Run[]> {
    let names: string[]
    try {
      names = (await readdir(this.repository.resolve("sessions"))).filter((name) => /^run-.+\.json$/.test(name))
    } catch {
      return []
    }
    const runs = await Promise.all(names.map((name) =>
      this.repository.readJson(this.repository.resolve("sessions", name), runSchema),
    ))
    return runs.sort((left, right) => {
      const leftTime = left.endedAt ?? left.startedAt ?? ""
      const rightTime = right.endedAt ?? right.startedAt ?? ""
      return rightTime.localeCompare(leftTime)
    })
  }

  async recoverInterruptedRuns(actorId: string): Promise<Run[]> {
    const interrupted = (await this.listRuns()).filter((run) => run.state === "running")
    return Promise.all(interrupted.map((run) => this.markRunState(
      run.id,
      "unknown",
      { kind: "system", id: actorId },
    )))
  }

  async createCharter(input: {
    initiativeId: string
    objective: string
    permissions: ToolPermission[]
    expectedEffects: ExecutionCharter["expectedEffects"]
    forbiddenActions: string[]
    stopConditions: string[]
    requiredEvidence: string[]
  }, actorId: string): Promise<ExecutionCharter> {
    const product = await this.readProduct()
    const initiative = await this.readInitiative(input.initiativeId)
    if (initiative.productId !== product.id) throw new Error("Initiative does not target this Product")
    const selection = await this.readSelection()
    const charter = executionCharterSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      productId: product.id,
      initiativeId: initiative.id,
      agent: selection,
      objective: input.objective,
      permissions: input.permissions,
      expectedEffects: input.expectedEffects,
      forbiddenActions: input.forbiddenActions,
      stopConditions: input.stopConditions,
      requiredEvidence: input.requiredEvidence,
      createdAt: new Date().toISOString(),
    })
    await this.repository.withLock(async () => {
      await this.repository.writeJson(
        this.repository.resolve("sessions", `charter-${charter.id}.json`),
        charter,
        executionCharterSchema,
      )
      await this.repository.appendAudit({
        eventType: "charter.created",
        actor: { kind: "human", id: actorId },
        subjectId: charter.id,
        payload: { initiativeId: initiative.id, adapterId: selection.adapterId, modelId: selection.modelId },
      })
    })
    return charter
  }

  async confirmCharter(charterId: string, actorId: string): Promise<ExecutionCharter> {
    const path = this.repository.resolve("sessions", `charter-${charterId}.json`)
    const current = await this.repository.readJson(path, executionCharterSchema)
    const confirmed = executionCharterSchema.parse({ ...current, confirmedAt: new Date().toISOString() })
    await this.repository.withLock(async () => {
      await this.repository.writeJson(path, confirmed, executionCharterSchema)
      await this.repository.appendAudit({
        eventType: "charter.confirmed",
        actor: { kind: "human", id: actorId },
        subjectId: charterId,
        payload: { authorizationSubstitution: false },
      })
    })
    return confirmed
  }

  async prepareRun(charterId: string, actorId: string): Promise<{ run: Run; invocation: AgentInvocation }> {
    const charter = await this.repository.readJson(
      this.repository.resolve("sessions", `charter-${charterId}.json`),
      executionCharterSchema,
    )
    if (!charter.confirmedAt) throw new Error("Confirm the Execution Charter before preparing a run")
    const currentSelection = await this.readSelection()
    if (currentSelection.capabilityDigest !== charter.agent.capabilityDigest) {
      throw new Error("Agent capabilities or selection changed after the charter was created")
    }
    const adapter = this.adapters.get(charter.agent.adapterId)
    if (!adapter) throw new Error(`Adapter ${charter.agent.adapterId} is unavailable`)
    const prompt = this.buildPrompt(charter)
    const invocation = adapter.buildInvocation(charter.agent, charter, this.workspacePath, prompt)
    const run = runSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      charterId: charter.id,
      productId: charter.productId,
      initiativeId: charter.initiativeId,
      agent: charter.agent,
      state: "prepared",
    })
    await this.repository.withLock(async () => {
      await this.repository.writeJson(
        this.repository.resolve("sessions", `run-${run.id}.json`),
        run,
        runSchema,
      )
      await this.repository.appendAudit({
        eventType: "run.prepared",
        actor: { kind: "human", id: actorId },
        subjectId: run.id,
        payload: {
          charterId,
          executable: invocation.executable,
          args: invocation.args.map((value, index) => index === invocation.args.length - 1 ? "[PROMPT]" : value),
          warnings: invocation.warnings,
        },
      })
    })
    return { run, invocation }
  }

  async markRunState(
    runId: string,
    state: Extract<Run["state"], "running" | "paused" | "completed" | "failed" | "cancelled" | "unknown">,
    actor: { kind: "human" | "agent" | "system"; id: string },
    providerSessionId?: string,
  ): Promise<Run> {
    const path = this.repository.resolve("sessions", `run-${runId}.json`)
    const current = await this.repository.readJson(path, runSchema)
    const now = new Date().toISOString()
    const next = runSchema.parse({
      ...current,
      state,
      providerSessionId: providerSessionId ?? current.providerSessionId,
      startedAt: current.startedAt ?? (state === "running" ? now : undefined),
      endedAt: ["completed", "failed", "cancelled", "unknown"].includes(state) ? now : undefined,
    })
    await this.repository.withLock(async () => {
      await this.repository.writeJson(path, next, runSchema)
      await this.repository.appendAudit({
        eventType: `run.${state}`,
        actor,
        subjectId: runId,
        payload: { providerSessionId: next.providerSessionId },
      })
    })
    return next
  }

  async createHandoff(input: {
    fromRunId: string
    toCapabilities: AdapterCapabilities
    toModelId: string
    toSettings: Record<string, unknown>
    reason: string
    completedWork: string[]
    unresolvedMatters: string[]
    decisions: string[]
    evidence: string[]
  }, actorId: string): Promise<Handoff> {
    const fromRun = await this.repository.readJson(
      this.repository.resolve("sessions", `run-${input.fromRunId}.json`),
      runSchema,
    )
    if (fromRun.state === "running") {
      throw new Error("Stop or cancel the active agent process before creating a switch handoff")
    }
    const toSelection = agentSelectionSchema.parse({
      adapterId: input.toCapabilities.adapterId,
      agentId: input.toCapabilities.agentId,
      runtimeExecutable: input.toCapabilities.executablePath,
      modelId: input.toModelId,
      modelTruthClass: input.toCapabilities.models.find((model) => model.id === input.toModelId)?.truthClass ?? "configured",
      modelAlias: input.toCapabilities.models.find((model) => model.id === input.toModelId)?.alias ?? null,
      settings: input.toSettings,
      selectedAt: new Date().toISOString(),
      capabilityDigest: capabilityDigest(input.toCapabilities),
    })
    const adapter = this.adapters.get(toSelection.adapterId)
    if (!adapter) throw new Error(`Adapter ${toSelection.adapterId} is unavailable`)
    const validationErrors = adapter.validateSelection(toSelection, input.toCapabilities)
    if (validationErrors.length > 0) throw new Error(validationErrors.join("; "))
    const baseline = await this.workspaceBaseline()
    const capabilityDifferences = [
      fromRun.agent.adapterId !== toSelection.adapterId
        ? `Agent adapter changes from ${fromRun.agent.adapterId} to ${toSelection.adapterId}.`
        : "Agent adapter is unchanged.",
      fromRun.agent.modelId !== toSelection.modelId
        ? `Model changes from ${fromRun.agent.modelId} to ${toSelection.modelId}.`
        : "Model is unchanged.",
      ...input.toCapabilities.limitations,
    ]
    const handoff = handoffSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      productId: fromRun.productId,
      initiativeId: fromRun.initiativeId,
      fromRunId: fromRun.id,
      toAgent: toSelection,
      reason: input.reason,
      workspaceBaseline: baseline,
      completedWork: input.completedWork,
      unresolvedMatters: input.unresolvedMatters,
      decisions: input.decisions,
      evidence: input.evidence,
      capabilityDifferences,
      createdAt: new Date().toISOString(),
    })
    await this.repository.withLock(async () => {
      await this.repository.writeJson(
        this.repository.resolve("handoffs", `${handoff.id}.json`),
        handoff,
        handoffSchema,
      )
      await this.repository.appendAudit({
        eventType: "handoff.created",
        actor: { kind: "human", id: actorId },
        subjectId: handoff.id,
        payload: { fromRunId: fromRun.id, toAgent: toSelection.agentId, toModel: toSelection.modelId },
      })
    })
    return handoff
  }

  private buildPrompt(charter: ExecutionCharter): string {
    const permissionLines = charter.permissions.map((permission) =>
      `- ${permission.capability}: ${permission.mode}${permission.scope.length ? ` within ${permission.scope.join(", ")}` : ""}`,
    )
    return [
      "Execute this bounded GAEP Initiative under the confirmed Execution Charter.",
      "",
      `Objective: ${charter.objective}`,
      `Product ID: ${charter.productId}`,
      `Initiative ID: ${charter.initiativeId}`,
      "",
      "Tool permissions:",
      ...permissionLines,
      "",
      "Forbidden actions:",
      ...charter.forbiddenActions.map((action) => `- ${action}`),
      "",
      "Stop conditions:",
      ...charter.stopConditions.map((condition) => `- ${condition}`),
      "",
      "Required evidence:",
      ...charter.requiredEvidence.map((evidence) => `- ${evidence}`),
      "",
      "Technical access is not a GAEP Approval Determination or Authorization Grant. Stop before any unlisted high-impact effect.",
    ].join("\n")
  }

  private async workspaceBaseline(): Promise<{ gitHead?: string; dirty: boolean; changedFiles: string[] }> {
    try {
      const [{ stdout: head }, { stdout: status }] = await Promise.all([
        execFileAsync("git", ["rev-parse", "HEAD"], { cwd: this.workspacePath }),
        execFileAsync("git", ["status", "--porcelain=v1"], { cwd: this.workspacePath }),
      ])
      const changedFiles = status.split("\n").filter(Boolean).map((line) => line.slice(3))
      return { gitHead: head.trim(), dirty: changedFiles.length > 0, changedFiles }
    } catch {
      return { dirty: false, changedFiles: [] }
    }
  }
}
