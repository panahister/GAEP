import { randomUUID } from "node:crypto"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

import {
  agentSelectionSchema,
  adapterCapabilitiesSchema,
  executionWorkspaceScopeSchema,
  executionCharterSchema,
  executionManagedIntentSchema,
  handoffSchema,
  initiativeSchema,
  productSchema,
  productRevisionSchema,
  repositoryManifestSchema,
  runSchema,
  workspaceHealthSchema,
  type AdapterCapabilities,
  type AgentSelection,
  type ExecutionCharter,
  type ExecutionManagedIntent,
  type Handoff,
  type Initiative,
  type ManagedApplyDecisionReceipt,
  type ManagedRunEvidence,
  type ManagedRunRecord,
  type ManagedRunResult,
  type Product,
  type Run,
  type ToolPermission,
} from "@gaep/contracts"
import {
  canonicalDigest,
  capabilityDigest,
  ManagedStageRegistry,
  type AdapterProbeOptions,
  type AdapterProbeResult,
  type AgentAdapter,
  type AgentInvocation,
} from "@gaep/agent-sdk"

import { GaepRepository, type GaepRepositoryOptions, type MutationWrite } from "./repository.js"
import {
  ManagedExecutionService,
  type ManagedExecutionApplyInput,
  type ManagedExecutionHandle,
  type ManagedExecutionReview,
  type ManagedExecutionStartInput,
  type ManagedPendingReviewStatus,
} from "./managed-execution.js"
import { ProductStudioService } from "./product-studio.js"

const execFileAsync = promisify(execFile)

export const initiativeTransitions = {
  proposed: ["active", "cancelled"],
  active: ["blocked", "completed", "cancelled"],
  blocked: ["active", "cancelled"],
  completed: [],
  cancelled: [],
} as const satisfies Record<Initiative["state"], readonly Initiative["state"][]>

export const runTransitions = {
  prepared: ["running", "failed", "cancelled"],
  running: ["paused", "completed", "failed", "cancelled", "unknown"],
  paused: ["running", "failed", "cancelled", "unknown"],
  completed: [],
  failed: [],
  cancelled: [],
  unknown: ["running", "failed", "cancelled"],
} as const satisfies Record<Run["state"], readonly Run["state"][]>

function requireUuid(value: string, label: string): string {
  const result = productSchema.shape.id.safeParse(value)
  if (!result.success) throw new Error(`${label} must be a UUID`)
  return result.data
}

function revisionOf(value: { revision?: number }): number {
  return value.revision ?? 1
}

function assertTransition<TState extends string>(
  current: TState,
  next: TState,
  transitions: Readonly<Record<TState, readonly TState[]>>,
  subject: string,
): void {
  if (!transitions[current].includes(next)) {
    throw new Error(`Invalid ${subject} transition from ${current} to ${next}`)
  }
}

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

export interface HandoffInput {
  fromRunId: string
  toCapabilities: AdapterCapabilities
  toModelId: string
  toSettings: Record<string, unknown>
  reason: string
  completedWork: string[]
  unresolvedMatters: string[]
  decisions: string[]
  evidence: string[]
}

export interface AgentSelectionMutationGuard {
  expectedCurrentSelectionDigest: `sha256:${string}` | null
}

export interface HandoffConfirmation {
  decision: "accept-exact-handoff-preview"
  expectedReviewDigest: `sha256:${string}`
  expectedCurrentSelectionDigest: `sha256:${string}`
  expectedHandoffId: string
  expectedCreatedAt: string
}

function selectionMaterialDigest(selection: AgentSelection): `sha256:${string}` {
  return canonicalDigest({
    adapterId: selection.adapterId,
    agentId: selection.agentId,
    modelId: selection.modelId,
    modelTruthClass: selection.modelTruthClass,
    modelAlias: selection.modelAlias,
    settings: selection.settings,
    capabilityDigest: selection.capabilityDigest,
  }) as `sha256:${string}`
}

export function handoffReviewDigest(handoff: Handoff): `sha256:${string}` {
  return canonicalDigest({
    schemaVersion: handoff.schemaVersion,
    id: handoff.id,
    createdAt: handoff.createdAt,
    productId: handoff.productId,
    initiativeId: handoff.initiativeId,
    fromRunId: handoff.fromRunId,
    toAgent: {
      adapterId: handoff.toAgent.adapterId,
      agentId: handoff.toAgent.agentId,
      modelId: handoff.toAgent.modelId,
      modelTruthClass: handoff.toAgent.modelTruthClass,
      modelAlias: handoff.toAgent.modelAlias,
      settings: handoff.toAgent.settings,
      capabilityDigest: handoff.toAgent.capabilityDigest,
    },
    reason: handoff.reason,
    workspaceBaseline: handoff.workspaceBaseline,
    completedWork: handoff.completedWork,
    unresolvedMatters: handoff.unresolvedMatters,
    decisions: handoff.decisions,
    evidence: handoff.evidence,
    capabilityDifferences: handoff.capabilityDifferences,
  }) as `sha256:${string}`
}

export function legacySelectionStateDigest(state: {
  portableCandidate: AgentSelection
  localRuntimeHint: { scope: "machine-local"; requestedExecutable: string }
  machineLocalSettingKeys: string[]
  machineLocalSettingsDigest: `sha256:${string}`
}): `sha256:${string}` {
  return canonicalDigest({
    portableCandidate: state.portableCandidate,
    localRuntimeHint: state.localRuntimeHint,
    machineLocalSettingKeys: state.machineLocalSettingKeys,
    machineLocalSettingsDigest: state.machineLocalSettingsDigest,
  }) as `sha256:${string}`
}

export interface LegacyAgentSelectionMigrationPreview {
  targetSelection: AgentSelection
  retiredSettingKeys: string[]
  legacySelectionDigest: `sha256:${string}`
  previousPortableSelectionDigest: `sha256:${string}`
  decision: "accept-exact-legacy-migration-preview"
  expectedPreviewDigest: `sha256:${string}`
}

export interface LegacyAgentSelectionMigrationInput {
  capabilities: AdapterCapabilities
  decision: "accept-exact-legacy-migration-preview"
  expectedPreviewDigest: `sha256:${string}`
  expectedLegacySelectionDigest: `sha256:${string}`
}

const retainedHistoricalSettingKeys: Readonly<Record<string, ReadonlySet<string>>> = {
  "gaep.codex-cli": new Set(["reasoningEffort"]),
  "gaep.claude-code-cli": new Set(["effort", "maxBudgetUsd"]),
}

function isReviewedObsoleteLegacySetting(adapterId: string, key: string, value: unknown): boolean {
  if (adapterId === "gaep.codex-cli") {
    if (key === "sandbox") return ["read-only", "workspace-write", "danger-full-access"].includes(String(value))
    if (key === "approvalPolicy") {
      return ["untrusted", "on-request", "never", "fail-closed-noninteractive"].includes(String(value))
    }
    if (key === "search") return typeof value === "boolean"
    if (key === "profile") return typeof value === "string"
  }
  if (adapterId === "gaep.claude-code-cli") {
    if (key === "permissionMode") {
      return ["default", "acceptEdits", "auto", "dontAsk", "plan"].includes(String(value))
    }
    if (key === "allowedTools" || key === "disallowedTools") {
      return Array.isArray(value) && value.every((entry) => typeof entry === "string")
    }
  }
  return false
}

function normalizedLegacySettings(
  legacySelection: AgentSelection,
  capabilities: AdapterCapabilities,
  machineLocalSettingKeys: readonly string[],
): { settings: AgentSelection["settings"]; retiredSettingKeys: string[] } {
  const declared = new Set(capabilities.settings.map((setting) => setting.key))
  const retained = retainedHistoricalSettingKeys[legacySelection.adapterId] ?? new Set<string>()
  const settings: AgentSelection["settings"] = {}
  const retired = new Set(machineLocalSettingKeys)
  for (const [key, value] of Object.entries(legacySelection.settings)) {
    if (retained.has(key)) {
      if (!declared.has(key)) {
        throw new Error(`Legacy current setting ${key} is no longer declared by the installed adapter`)
      }
      settings[key] = value
      continue
    }
    if (isReviewedObsoleteLegacySetting(legacySelection.adapterId, key, value)) {
      retired.add(key)
      continue
    }
    throw new Error(`Legacy Agent Selection setting ${key} has no reviewed migration rule`)
  }
  return { settings, retiredSettingKeys: [...retired].sort() }
}

export function legacyAgentSelectionMigrationReviewDigest(
  preview: Omit<LegacyAgentSelectionMigrationPreview, "expectedPreviewDigest">,
): `sha256:${string}` {
  // The exact legacy-state digest is checked separately and may bind machine-local
  // hints. Keep the review/normalization digest portable so it is safe to audit.
  return canonicalDigest({
    targetSelection: preview.targetSelection,
    retiredSettingKeys: preview.retiredSettingKeys,
    previousPortableSelectionDigest: preview.previousPortableSelectionDigest,
    decision: preview.decision,
  }) as `sha256:${string}`
}

export class GaepEngine {
  readonly repository: GaepRepository
  readonly productStudio: ProductStudioService
  readonly managedExecution: ManagedExecutionService
  readonly adapters = new Map<string, AgentAdapter>()

  constructor(
    readonly workspacePath: string,
    adapters: AgentAdapter[],
    repositoryOptions: GaepRepositoryOptions = {},
    managedStageRegistry: ManagedStageRegistry = new ManagedStageRegistry(),
  ) {
    this.repository = new GaepRepository(workspacePath, repositoryOptions)
    this.productStudio = new ProductStudioService(
      this.repository,
      () => this.readProduct(),
      (id) => this.readInitiative(id),
    )
    for (const adapter of adapters) {
      if (this.adapters.has(adapter.id)) throw new Error(`Duplicate adapter ${adapter.id}`)
      this.adapters.set(adapter.id, adapter)
    }
    this.managedExecution = new ManagedExecutionService(
      this.workspacePath,
      this.repository,
      this.productStudio,
      this.adapters,
      managedStageRegistry,
    )
  }

  async probeAgents(): Promise<AdapterCapabilities[]> {
    const results = await Promise.all(
      [...this.adapters.values()].map((adapter) => this.probeAdapter(adapter, { refreshModels: true })),
    )
    return results.map((result) => result.capabilities)
  }

  async createProduct(input: ProductInput, actorId: string): Promise<Product> {
    const now = new Date().toISOString()
    const product = productSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      kind: "product",
      revision: 1,
      ...input,
      lifecycleState: "active",
      createdAt: now,
      updatedAt: now,
    })
    await this.repository.withLock(async () => {
      await this.repository.assertCanCreateProduct()
      await this.repository.prepareLayout()
      const manifest = this.repository.createManifest(product.id)
      const productRevision = productRevisionSchema.parse({
        schemaVersion: 1,
        kind: "product-revision",
        productId: product.id,
        revision: revisionOf(product),
        product,
        source: { kind: "initialization", id: product.id },
        productDigest: canonicalDigest(product),
        recordedAt: now,
      })
      await this.repository.commitMutation({
        initialization: true,
        writes: [
          {
            path: this.repository.resolve("manifest.json"),
            value: manifest,
            schema: repositoryManifestSchema,
            governed: true,
          },
          {
            path: this.repository.resolve("product.json"),
            value: product,
            schema: productSchema,
            governed: true,
          },
          {
            path: this.repository.resolve("product-history", `product-${product.id}-r1.json`),
            value: productRevision,
            schema: productRevisionSchema,
            governed: true,
          },
        ],
        audit: {
          eventType: "product.created",
          actor: { kind: "human", id: actorId },
          subjectId: product.id,
          payload: { profile: product.profile, revision: revisionOf(product), recordDigest: canonicalDigest(product) },
        },
      })
    })
    return product
  }

  async readProduct(): Promise<Product> {
    const [manifest, product] = await Promise.all([
      this.repository.readJson(this.repository.resolve("manifest.json"), repositoryManifestSchema),
      this.repository.readJson(this.repository.resolve("product.json"), productSchema),
    ])
    if (manifest.productId !== product.id) throw new Error("GAEP manifest and Product identity do not match")
    return product
  }

  async workspaceHealth() {
    const health = await this.repository.workspaceHealth()
    if (!health.initialized || health.status === "invalid") return health
    let domainIssues
    try {
      domainIssues = await this.productStudio.healthIssues()
    } catch (error) {
      domainIssues = [{
        code: "product.health-evaluation-failed" as const,
        severity: "error" as const,
        message: error instanceof Error ? error.message : "Product-domain health evaluation failed.",
      }]
    }
    const issues = [...health.issues, ...domainIssues]
    const status = issues.some((issue) => issue.severity === "error")
      ? "invalid"
      : issues.length > 0
        ? "degraded"
        : "healthy"
    return workspaceHealthSchema.parse({ ...health, status, issues })
  }

  async createInitiative(input: InitiativeInput, actorId: string): Promise<Initiative> {
    return this.repository.withLock(async () => {
      await this.assertAuditIntegrity()
      const product = await this.readProduct()
      const now = new Date().toISOString()
      const initiative = initiativeSchema.parse({
        schemaVersion: 1,
        id: randomUUID(),
        kind: "initiative",
        revision: 1,
        productId: product.id,
        ...input,
        state: "proposed",
        createdAt: now,
        updatedAt: now,
      })
      await this.repository.commitMutation({
        writes: [{
          path: this.repository.resolve("initiatives", `${initiative.id}.json`),
          value: initiative,
          schema: initiativeSchema,
          governed: true,
        }],
        audit: {
          eventType: "initiative.created",
          actor: { kind: "human", id: actorId },
          subjectId: initiative.id,
          payload: {
            productId: product.id,
            revision: revisionOf(initiative),
            recordDigest: canonicalDigest(initiative),
          },
        },
      })
      return initiative
    })
  }

  async readInitiative(id: string): Promise<Initiative> {
    const initiativeId = requireUuid(id, "Initiative ID")
    const initiative = await this.repository.readJson(
      this.repository.resolve("initiatives", `${initiativeId}.json`),
      initiativeSchema,
    )
    const product = await this.readProduct()
    if (initiative.productId !== product.id) throw new Error("Initiative does not target this Product")
    return initiative
  }

  async updateInitiativeState(
    id: string,
    state: Initiative["state"],
    reason: string,
    actorId: string,
  ): Promise<Initiative> {
    if (reason.trim().length < 2) throw new Error("A state-change reason is required")
    const initiativeId = requireUuid(id, "Initiative ID")
    const path = this.repository.resolve("initiatives", `${initiativeId}.json`)
    return this.repository.withLock(async () => {
      await this.assertAuditIntegrity()
      const current = await this.repository.readJson(path, initiativeSchema)
      assertTransition(current.state, state, initiativeTransitions, "Initiative")
      if (state === "completed" || state === "cancelled") {
        const nonTerminalRuns = (await this.listRuns()).filter((run) =>
          run.initiativeId === initiativeId && ["prepared", "running", "paused", "unknown"].includes(run.state),
        )
        if (nonTerminalRuns.length > 0) {
          const summary = nonTerminalRuns.map((run) => `${run.id}:${run.state}`).join(", ")
          throw new Error(
            `Initiative cannot become ${state} while associated Runs remain non-terminal: ${summary}`,
          )
        }
      }
      const updated = initiativeSchema.parse({
        ...current,
        revision: revisionOf(current) + 1,
        state,
        updatedAt: new Date().toISOString(),
      })
      await this.repository.commitMutation({
        writes: [{ path, value: updated, schema: initiativeSchema, governed: true }],
        audit: {
          eventType: "initiative.state.changed",
          actor: { kind: "human", id: actorId },
          subjectId: initiativeId,
          payload: {
            from: current.state,
            to: state,
            reason,
            revision: revisionOf(updated),
            recordDigest: canonicalDigest(updated),
            productMutation: false,
          },
        },
      })
      return updated
    })
  }

  async selectAgent(
    capabilities: AdapterCapabilities,
    modelId: string,
    settings: Record<string, unknown>,
    actorId: string,
    guard?: AgentSelectionMutationGuard,
  ): Promise<AgentSelection> {
    const suppliedCapabilities = adapterCapabilitiesSchema.parse(capabilities)
    const adapter = this.adapters.get(suppliedCapabilities.adapterId)
    if (!adapter) throw new Error(`Adapter ${suppliedCapabilities.adapterId} is not registered`)
    return this.repository.withLock(async () => {
      await this.assertAuditIntegrity()
      await this.readProduct()
      const { capabilities: observedCapabilities } = await this.probeAdapter(adapter, { refreshModels: true })
      if (capabilityDigest(observedCapabilities) !== capabilityDigest(suppliedCapabilities)) {
        throw new Error("Agent capabilities changed or were not produced by the registered adapter; probe again")
      }
      const model = observedCapabilities.models.find((candidate) => candidate.id === modelId)
      const selection = agentSelectionSchema.parse({
        schemaVersion: 2,
        adapterId: observedCapabilities.adapterId,
        agentId: observedCapabilities.agentId,
        modelId,
        modelTruthClass: model?.truthClass ?? "configured",
        modelAlias: model?.alias ?? null,
        settings,
        selectedAt: new Date().toISOString(),
        capabilityDigest: capabilityDigest(observedCapabilities),
      })
      const errors = adapter.validateSelection(selection, observedCapabilities)
      if (errors.length > 0) throw new Error(errors.join("; "))
      const current = await this.currentSelectionOptional()
      if (current) {
        if (!guard || guard.expectedCurrentSelectionDigest !== canonicalDigest(current)) {
          throw new Error("Agent Selection changed or was not explicitly bound before mutation; re-read and confirm the current selection")
        }
        await this.assertNoUnresolvedSelectionWork()
        if (selectionMaterialDigest(current) === selectionMaterialDigest(selection)) return current
        const currentSelectionDigest = canonicalDigest(current)
        if ((await this.listRuns()).some((run) => canonicalDigest(run.agent) === currentSelectionDigest)) {
          throw new Error("A material Agent Selection change after a bound Run requires an exact accepted handoff")
        }
      } else if (guard?.expectedCurrentSelectionDigest) {
        throw new Error("Agent Selection was created while the mutation was being prepared; re-read and confirm it")
      }
      const capabilityWrite = await this.capabilitySnapshotWrite(observedCapabilities)
      await this.repository.commitMutation({
        writes: [
          {
            path: this.repository.resolve("runtime", "selection.json"),
            value: selection,
            schema: agentSelectionSchema,
            governed: true,
          },
          ...(capabilityWrite ? [capabilityWrite] : []),
        ],
        audit: {
          eventType: "agent.selected",
          actor: { kind: "human", id: actorId },
          subjectId: selection.agentId,
          payload: {
            modelId,
            adapterId: selection.adapterId,
            capabilityDigest: selection.capabilityDigest,
            selectionDigest: canonicalDigest(selection),
            previousSelectionDigest: current ? canonicalDigest(current) : undefined,
          },
        },
      })
      return selection
    })
  }

  async readSelection(): Promise<AgentSelection> {
    const compatibility = await this.repository.readAgentSelectionCompatibility()
    if (compatibility.status === "current") return compatibility.selection
    if (compatibility.status === "migration-required") {
      throw new Error("The persisted Agent Selection is legacy and requires explicit re-probe and reconfirmation")
    }
    throw new Error(`The persisted Agent Selection is invalid: ${compatibility.issues.join("; ")}`)
  }

  async previewLegacyAgentSelectionMigration(
    supplied: AdapterCapabilities,
  ): Promise<LegacyAgentSelectionMigrationPreview> {
    const suppliedCapabilities = adapterCapabilitiesSchema.parse(supplied)
    const adapter = this.adapters.get(suppliedCapabilities.adapterId)
    if (!adapter) throw new Error(`Adapter ${suppliedCapabilities.adapterId} is not registered`)
    return this.repository.withLock(async () => {
      const legacySelection = await this.repository.readAgentSelectionCompatibility()
      if (legacySelection.status !== "migration-required") {
        throw new Error("Agent Selection migration preview requires an existing valid legacy Selection")
      }
      await this.assertLegacyMigrationIntegrity()
      await this.readProduct()
      await this.assertNoLegacySelectionDependents()
      await this.assertNoUnresolvedSelectionWork()
      await this.legacyCapabilityPathsForMigration(
        suppliedCapabilities,
        legacySelection.portableCandidate.capabilityDigest,
      )
      const { capabilities: observedCapabilities } = await this.probeAdapter(adapter, { refreshModels: true })
      if (capabilityDigest(observedCapabilities) !== capabilityDigest(suppliedCapabilities)) {
        throw new Error("Agent capabilities changed during migration preview; probe and review again")
      }
      return this.buildLegacyAgentSelectionMigrationPreview(legacySelection, observedCapabilities, adapter)
    })
  }

  async migrateLegacyAgentSelection(
    input: LegacyAgentSelectionMigrationInput,
    actorId: string,
  ): Promise<AgentSelection> {
    if (input.decision !== "accept-exact-legacy-migration-preview") {
      throw new Error("Legacy Agent Selection migration requires acceptance of the exact migration preview")
    }
    const suppliedCapabilities = adapterCapabilitiesSchema.parse(input.capabilities)
    const adapter = this.adapters.get(suppliedCapabilities.adapterId)
    if (!adapter) throw new Error(`Adapter ${suppliedCapabilities.adapterId} is not registered`)
    return this.repository.withLock(async () => {
      const legacySelection = await this.repository.readAgentSelectionCompatibility()
      if (legacySelection.status !== "migration-required") {
        throw new Error("Agent Selection migration requires an existing valid legacy Selection")
      }
      await this.assertLegacyMigrationIntegrity()
      await this.readProduct()
      if (legacySelectionStateDigest(legacySelection) !== input.expectedLegacySelectionDigest) {
        throw new Error("The legacy Agent Selection changed after migration review; re-read and reconfirm it")
      }
      if (
        legacySelection.portableCandidate.adapterId !== suppliedCapabilities.adapterId ||
        legacySelection.portableCandidate.agentId !== suppliedCapabilities.agentId
      ) {
        throw new Error("Migration cannot change the legacy Agent identity; perform a separate Agent Selection instead")
      }
      const legacyCapabilityPaths = await this.legacyCapabilityPathsForMigration(
        suppliedCapabilities,
        legacySelection.portableCandidate.capabilityDigest,
      )
      const { capabilities: observedCapabilities } = await this.probeAdapter(adapter, { refreshModels: true })
      if (capabilityDigest(observedCapabilities) !== capabilityDigest(suppliedCapabilities)) {
        throw new Error("Agent capabilities changed during migration; probe and reconfirm again")
      }
      await this.assertNoLegacySelectionDependents()
      await this.assertNoUnresolvedSelectionWork()
      const preview = this.buildLegacyAgentSelectionMigrationPreview(legacySelection, observedCapabilities, adapter)
      if (preview.expectedPreviewDigest !== input.expectedPreviewDigest) {
        throw new Error("The exact legacy migration preview changed; review and accept it again")
      }
      const selection = preview.targetSelection
      const capabilityWrite = await this.capabilitySnapshotWrite(observedCapabilities)
      const rewrittenLegacyCapabilities = legacyCapabilityPaths.map((path) => ({
        path,
        value: observedCapabilities,
        schema: adapterCapabilitiesSchema,
        governed: true,
      }))
      await this.repository.commitMutation({
        writes: [
          {
            path: this.repository.resolve("runtime", "selection.json"),
            value: selection,
            schema: agentSelectionSchema,
            governed: true,
          },
          ...rewrittenLegacyCapabilities,
          ...(capabilityWrite && !legacyCapabilityPaths.includes(capabilityWrite.path) ? [capabilityWrite] : []),
        ],
        audit: {
          eventType: "agent.selection.migrated",
          actor: { kind: "human", id: actorId },
          subjectId: selection.agentId,
          payload: {
            adapterId: selection.adapterId,
            modelId: selection.modelId,
            capabilityDigest: selection.capabilityDigest,
            selectionDigest: canonicalDigest(selection),
            previousPortableSelectionDigest: preview.previousPortableSelectionDigest,
            normalizationProfileId: "gaep.legacy-agent-selection.v1-to-v2",
            normalizationProfileVersion: 1,
            normalizationDigest: preview.expectedPreviewDigest,
            retainedSettingKeys: Object.keys(selection.settings).sort(),
            droppedSettingKeys: preview.retiredSettingKeys,
            rewrittenLegacyCapabilitySnapshots: legacyCapabilityPaths.length,
            currentCapabilityDigest: selection.capabilityDigest,
            historyDisposition: "no-bound-artifacts",
            capabilityReconfirmed: true,
            exactMigrationPreviewAccepted: true,
            machineLocalDataPersisted: false,
          },
        },
      })
      return selection
    })
  }

  async listRuns(): Promise<Run[]> {
    let names: string[]
    try {
      names = (await this.repository.readDirectory(this.repository.resolve("sessions")))
        .filter((name) => /^run-[0-9a-f-]+\.json$/i.test(name))
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return []
      throw error
    }
    const runs = await Promise.all(names.map((name) =>
      this.repository.readJson(this.repository.resolve("sessions", name), runSchema),
    ))
    return runs.sort((left, right) => {
      const leftTime = left.endedAt ?? left.startedAt ?? ""
      const rightTime = right.endedAt ?? right.startedAt ?? ""
      return rightTime.localeCompare(leftTime) || right.id.localeCompare(left.id)
    })
  }

  async recoverInterruptedRuns(actorId: string): Promise<Run[]> {
    const managedRecovered = await this.managedExecution.recoverInterrupted(actorId)
    const recoveredManagedRuns = await Promise.all(managedRecovered.map((managed) =>
      this.repository.readJson(this.repository.resolve("sessions", `run-${managed.runId}.json`), runSchema),
    ))
    const durableReviews = new Set((await this.managedExecution.list())
      .filter((managed) => managed.state === "review-required" || managed.state === "conflict")
      .map((managed) => managed.runId))
    const interrupted = (await this.listRuns()).filter((run) =>
      run.state === "running" && !durableReviews.has(run.id))
    const recovered: Run[] = [...recoveredManagedRuns]
    for (const run of interrupted) {
      recovered.push(await this.markRunState(
        run.id,
        "unknown",
        { kind: "system", id: actorId },
      ))
    }
    return recovered
  }

  async createCharter(input: {
    initiativeId: string
    objective: string
    permissions: ToolPermission[]
    expectedEffects: ExecutionCharter["expectedEffects"]
    forbiddenActions: string[]
    stopConditions: string[]
    requiredEvidence: string[]
    managedIntent?: ExecutionManagedIntent
  }, actorId: string): Promise<ExecutionCharter> {
    const initiativeId = requireUuid(input.initiativeId, "Initiative ID")
    return this.repository.withLock(async () => {
      await this.assertAuditIntegrity()
      const product = await this.readProduct()
      const initiative = await this.readInitiative(initiativeId)
      if (initiative.productId !== product.id) throw new Error("Initiative does not target this Product")
      if (initiative.state !== "active") {
        throw new Error(`Initiative must be active before creating an Execution Charter; current state is ${initiative.state}`)
      }
      const selection = await this.readSelection()
      const managedIntent = input.managedIntent
        ? executionManagedIntentSchema.parse(input.managedIntent)
        : undefined
      if (managedIntent) {
        if (JSON.stringify([...managedIntent.requestedEffects].sort()) !== JSON.stringify([...input.expectedEffects].sort())) {
          throw new Error("Managed Charter intent must exactly bind the Charter expected effects")
        }
        await this.assertManagedIntentBindings(managedIntent, product.id)
      }
      const charter = executionCharterSchema.parse({
        schemaVersion: 1,
        id: randomUUID(),
        productId: product.id,
        initiativeId: initiative.id,
        productRevision: revisionOf(product),
        initiativeRevision: revisionOf(initiative),
        productDigest: canonicalDigest(product),
        initiativeDigest: canonicalDigest(initiative),
        selectionDigest: canonicalDigest(selection),
        agent: selection,
        objective: input.objective,
        permissions: input.permissions,
        expectedEffects: input.expectedEffects,
        forbiddenActions: input.forbiddenActions,
        stopConditions: input.stopConditions,
        requiredEvidence: input.requiredEvidence,
        managedIntent,
        createdAt: new Date().toISOString(),
      })
      await this.repository.commitMutation({
        writes: [{
          path: this.repository.resolve("sessions", `charter-${charter.id}.json`),
          value: charter,
          schema: executionCharterSchema,
          governed: true,
        }],
        audit: {
          eventType: "charter.created",
          actor: { kind: "human", id: actorId },
          subjectId: charter.id,
          payload: {
            initiativeId: initiative.id,
            adapterId: selection.adapterId,
            modelId: selection.modelId,
            productRevision: revisionOf(product),
            initiativeRevision: revisionOf(initiative),
            selectionDigest: charter.selectionDigest,
            recordDigest: canonicalDigest(charter),
          },
        },
      })
      return charter
    })
  }

  async confirmCharter(charterId: string, actorId: string): Promise<ExecutionCharter> {
    const validatedCharterId = requireUuid(charterId, "Charter ID")
    const path = this.repository.resolve("sessions", `charter-${validatedCharterId}.json`)
    return this.repository.withLock(async () => {
      await this.assertAuditIntegrity()
      const current = await this.repository.readJson(path, executionCharterSchema)
      await this.assertCharterBindings(current)
      if (current.confirmedAt) return current
      const confirmed = executionCharterSchema.parse({ ...current, confirmedAt: new Date().toISOString() })
      await this.repository.commitMutation({
        writes: [{ path, value: confirmed, schema: executionCharterSchema, governed: true }],
        audit: {
          eventType: "charter.confirmed",
          actor: { kind: "human", id: actorId },
          subjectId: validatedCharterId,
          payload: { authorizationSubstitution: false, recordDigest: canonicalDigest(confirmed) },
        },
      })
      return confirmed
    })
  }

  async prepareRun(charterId: string, actorId: string): Promise<{ run: Run; invocation: AgentInvocation }> {
    const validatedCharterId = requireUuid(charterId, "Charter ID")
    return this.repository.withLock(async () => {
      await this.assertAuditIntegrity()
      const charter = await this.repository.readJson(
        this.repository.resolve("sessions", `charter-${validatedCharterId}.json`),
        executionCharterSchema,
      )
      if (!charter.confirmedAt) throw new Error("Confirm the Execution Charter before preparing a run")
      await this.assertCharterBindings(charter)
      const currentInitiative = await this.readInitiative(charter.initiativeId)
      if (currentInitiative.state !== "active") {
        throw new Error(`Initiative must be active before preparing a Run; current state is ${currentInitiative.state}`)
      }
      const adapter = this.adapters.get(charter.agent.adapterId)
      if (!adapter) throw new Error(`Adapter ${charter.agent.adapterId} is unavailable`)
      const { capabilities: observedCapabilities, runtimeBinding } = await this.probeAdapter(
        adapter,
        { refreshModels: true },
      )
      if (capabilityDigest(observedCapabilities) !== charter.agent.capabilityDigest) {
        throw new Error("Agent runtime capabilities changed after Charter confirmation; select again and recreate the Charter")
      }
      const selectionErrors = adapter.validateSelection(charter.agent, observedCapabilities)
      if (selectionErrors.length > 0) throw new Error(selectionErrors.join("; "))
      const prompt = this.buildPrompt(charter)
      const invocation = adapter.buildInvocation(
        charter.agent,
        charter,
        this.workspacePath,
        prompt,
        runtimeBinding,
      )
      const run = runSchema.parse({
        schemaVersion: 1,
        id: randomUUID(),
        revision: 1,
        charterId: charter.id,
        charterDigest: canonicalDigest(charter),
        productId: charter.productId,
        initiativeId: charter.initiativeId,
        agent: charter.agent,
        state: "prepared",
      })
      await this.repository.commitMutation({
        writes: [{
          path: this.repository.resolve("sessions", `run-${run.id}.json`),
          value: run,
          schema: runSchema,
          governed: true,
        }],
        audit: {
          eventType: "run.prepared",
          actor: { kind: "human", id: actorId },
          subjectId: run.id,
          payload: {
            charterId: validatedCharterId,
            charterDigest: run.charterDigest,
            revision: revisionOf(run),
            recordDigest: canonicalDigest(run),
            adapterId: run.agent.adapterId,
            modelId: run.agent.modelId,
            runtimeBindingPersisted: false,
          },
        },
      })
      return { run, invocation }
    })
  }

  /**
   * Creates the portable Run identity needed by the managed execution lane
   * without constructing a direct CLI invocation. Runtime bindings remain
   * process-local and are re-probed only when startManagedRun is called.
   */
  async prepareManagedRun(charterId: string, actorId: string): Promise<Run> {
    const validatedCharterId = requireUuid(charterId, "Charter ID")
    return this.repository.withLock(async () => {
      await this.assertAuditIntegrity()
      const charter = await this.repository.readJson(
        this.repository.resolve("sessions", `charter-${validatedCharterId}.json`),
        executionCharterSchema,
      )
      if (!charter.confirmedAt) throw new Error("Confirm the Execution Charter before preparing a managed Run")
      if (!charter.managedIntent) {
        throw new Error("Managed Run preparation requires a Charter with exact managed Workflow, Context, Tool, effect, and scope intent")
      }
      await this.assertCharterBindings(charter)
      const initiative = await this.readInitiative(charter.initiativeId)
      if (initiative.state !== "active") {
        throw new Error(`Initiative must be active before preparing a managed Run; current state is ${initiative.state}`)
      }
      const run = runSchema.parse({
        schemaVersion: 1,
        id: randomUUID(),
        revision: 1,
        charterId: charter.id,
        charterDigest: canonicalDigest(charter),
        productId: charter.productId,
        initiativeId: charter.initiativeId,
        agent: charter.agent,
        state: "prepared",
      })
      await this.repository.commitMutation({
        writes: [{
          path: this.repository.resolve("sessions", `run-${run.id}.json`),
          value: run,
          schema: runSchema,
          governed: true,
        }],
        audit: {
          eventType: "run.prepared-managed",
          actor: { kind: "human", id: actorId },
          subjectId: run.id,
          payload: {
            charterId: validatedCharterId,
            charterDigest: run.charterDigest,
            revision: revisionOf(run),
            recordDigest: canonicalDigest(run),
            adapterId: run.agent.adapterId,
            modelId: run.agent.modelId,
            runtimeBindingPersisted: false,
            invocationPersisted: false,
          },
        },
      })
      return run
    })
  }

  async startManagedRun(input: ManagedExecutionStartInput, actorId: string): Promise<ManagedExecutionHandle> {
    return this.managedExecution.start(input, actorId)
  }

  async listManagedRuns(): Promise<ManagedRunRecord[]> {
    return this.managedExecution.list()
  }

  async readManagedRun(id: string): Promise<ManagedRunRecord> {
    return this.managedExecution.read(id)
  }

  async readManagedRunResult(id: string): Promise<ManagedRunResult> {
    return this.managedExecution.readResult(id)
  }

  async readManagedRunEvidence(id: string): Promise<ManagedRunEvidence> {
    return this.managedExecution.readEvidence(id)
  }

  async readManagedApplyDecision(id: string): Promise<ManagedApplyDecisionReceipt> {
    return this.managedExecution.readApplyDecision(id)
  }

  async listPendingManagedReviewStatuses(): Promise<ManagedPendingReviewStatus[]> {
    return this.managedExecution.listPendingReviewStatuses()
  }

  async readPendingManagedReviewStatus(id: string): Promise<ManagedPendingReviewStatus> {
    return this.managedExecution.pendingReviewStatus(id)
  }

  async applyPendingManagedReview(
    id: string,
    input: ManagedExecutionApplyInput,
    actorId: string,
  ): Promise<ManagedExecutionReview> {
    return this.managedExecution.applyPendingReview(id, input, actorId)
  }

  async discardPendingManagedReview(id: string, actorId: string): Promise<ManagedExecutionReview> {
    return this.managedExecution.discardPendingReview(id, actorId)
  }

  async cancelManagedRun(id: string, reason?: string): Promise<void> {
    return this.managedExecution.cancel(id, reason)
  }

  async markRunState(
    runId: string,
    state: Extract<Run["state"], "running" | "paused" | "completed" | "failed" | "cancelled" | "unknown">,
    actor: { kind: "human" | "agent" | "system"; id: string },
    providerSessionId?: string,
  ): Promise<Run> {
    const validatedRunId = requireUuid(runId, "Run ID")
    if ((await this.managedExecution.list()).some((managed) => managed.runId === validatedRunId)) {
      throw new Error("Managed Run state is derived from durable managed evidence and cannot be set directly")
    }
    const path = this.repository.resolve("sessions", `run-${validatedRunId}.json`)
    return this.repository.withLock(async () => {
      await this.assertAuditIntegrity()
      const current = await this.repository.readJson(path, runSchema)
      assertTransition(current.state, state, runTransitions, "Run")
      const now = new Date().toISOString()
      const terminal = ["completed", "failed", "cancelled", "unknown"].includes(state)
      const next = runSchema.parse({
        ...current,
        revision: revisionOf(current) + 1,
        state,
        providerSessionRef: providerSessionId
          ? canonicalDigest({ kind: "provider-session", value: providerSessionId })
          : current.providerSessionRef,
        startedAt: current.startedAt ?? (state === "running" ? now : undefined),
        endedAt: terminal ? now : undefined,
      })
      await this.repository.commitMutation({
        writes: [{ path, value: next, schema: runSchema, governed: true }],
        audit: {
          eventType: `run.${state}`,
          actor,
          subjectId: validatedRunId,
          payload: {
            from: current.state,
            to: state,
            revision: revisionOf(next),
            providerSessionRef: next.providerSessionRef,
            recordDigest: canonicalDigest(next),
          },
        },
      })
      return next
    })
  }

  async previewHandoff(input: HandoffInput): Promise<Handoff> {
    return this.repository.withLock(async () => {
      await this.assertAuditIntegrity()
      return this.buildHandoff(input)
    })
  }

  async createHandoff(
    input: HandoffInput,
    actorId: string,
    confirmation: HandoffConfirmation,
  ): Promise<Handoff> {
    return this.repository.withLock(async () => {
      await this.assertAuditIntegrity()
      if (confirmation.decision !== "accept-exact-handoff-preview") {
        throw new Error("Handoff commit requires acceptance of the exact reviewed preview")
      }
      const currentSelection = await this.currentSelectionOptional()
      if (!currentSelection || canonicalDigest(currentSelection) !== confirmation.expectedCurrentSelectionDigest) {
        throw new Error("The current Agent Selection changed after handoff review")
      }
      const { handoff: rebuilt, capabilities } = await this.buildHandoffWithCapabilities(input)
      const candidate = handoffSchema.parse({
        ...rebuilt,
        id: confirmation.expectedHandoffId,
        createdAt: confirmation.expectedCreatedAt,
      })
      if (handoffReviewDigest(candidate) !== confirmation.expectedReviewDigest) {
        throw new Error("The handoff source, target, capabilities, settings, or workspace baseline changed after review")
      }
      const handoff = handoffSchema.parse({ ...candidate, acknowledgedAt: new Date().toISOString() })
      const selection = handoff.toAgent
      const capabilityWrite = await this.capabilitySnapshotWrite(capabilities)
      await this.repository.commitMutation({
        writes: [
          {
            path: this.repository.resolve("handoffs", `${handoff.id}.json`),
            value: handoff,
            schema: handoffSchema,
            governed: true,
          },
          {
            path: this.repository.resolve("runtime", "selection.json"),
            value: selection,
            schema: agentSelectionSchema,
            governed: true,
          },
          ...(capabilityWrite ? [capabilityWrite] : []),
        ],
        audit: {
          eventType: "handoff.committed",
          actor: { kind: "human", id: actorId },
          subjectId: handoff.id,
          payload: {
            fromRunId: handoff.fromRunId,
            toAgent: selection.agentId,
            toModel: selection.modelId,
            selectionDigest: canonicalDigest(selection),
            previousSelectionDigest: confirmation.expectedCurrentSelectionDigest,
            reviewDigest: confirmation.expectedReviewDigest,
            recordDigest: canonicalDigest(handoff),
          },
        },
      })
      return handoff
    })
  }

  private async buildHandoff(input: HandoffInput): Promise<Handoff> {
    return (await this.buildHandoffWithCapabilities(input)).handoff
  }

  private async buildHandoffWithCapabilities(
    input: HandoffInput,
  ): Promise<{ handoff: Handoff; capabilities: AdapterCapabilities }> {
    await this.assertNoUnresolvedSelectionWork()
    const fromRunId = requireUuid(input.fromRunId, "Source Run ID")
    const fromRun = await this.repository.readJson(
      this.repository.resolve("sessions", `run-${fromRunId}.json`),
      runSchema,
    )
    if (!["completed", "failed", "cancelled"].includes(fromRun.state)) {
      throw new Error("Complete, fail, or cancel the source Run before creating a switch handoff")
    }
    const currentSelection = await this.currentSelectionOptional()
    if (!currentSelection || canonicalDigest(fromRun.agent) !== canonicalDigest(currentSelection)) {
      throw new Error("The handoff source Run is not bound to the exact current Agent Selection")
    }
    const currentSelectionDigest = canonicalDigest(currentSelection)
    const newestBoundTerminalRun = (await this.listRuns()).find((run) =>
      ["completed", "failed", "cancelled"].includes(run.state) &&
      canonicalDigest(run.agent) === currentSelectionDigest)
    if (!newestBoundTerminalRun || newestBoundTerminalRun.id !== fromRun.id) {
      throw new Error("The handoff source must be the newest terminal Run bound to the exact current Agent Selection")
    }
    const suppliedCapabilities = adapterCapabilitiesSchema.parse(input.toCapabilities)
    const adapter = this.adapters.get(suppliedCapabilities.adapterId)
    if (!adapter) throw new Error(`Adapter ${suppliedCapabilities.adapterId} is unavailable`)
    const { capabilities } = await this.probeAdapter(adapter, { refreshModels: true })
    if (capabilityDigest(capabilities) !== capabilityDigest(suppliedCapabilities)) {
      throw new Error("Handoff target capabilities changed; review the switch again")
    }
    const model = capabilities.models.find((candidate) => candidate.id === input.toModelId)
    const toSelection = agentSelectionSchema.parse({
      schemaVersion: 2,
      adapterId: capabilities.adapterId,
      agentId: capabilities.agentId,
      modelId: input.toModelId,
      modelTruthClass: model?.truthClass ?? "configured",
      modelAlias: model?.alias ?? null,
      settings: input.toSettings,
      selectedAt: new Date().toISOString(),
      capabilityDigest: capabilityDigest(capabilities),
    })
    const validationErrors = adapter.validateSelection(toSelection, capabilities)
    if (validationErrors.length > 0) throw new Error(validationErrors.join("; "))
    if (selectionMaterialDigest(currentSelection) === selectionMaterialDigest(toSelection)) {
      throw new Error("A handoff requires a material Agent, model, setting, or capability change")
    }
    const baseline = await this.workspaceBaseline()
    const capabilityDifferences = [
      currentSelection.adapterId !== toSelection.adapterId
        ? `Agent adapter changes from ${currentSelection.adapterId} to ${toSelection.adapterId}.`
        : "Agent adapter is unchanged.",
      currentSelection.agentId !== toSelection.agentId
        ? `Agent identity changes from ${currentSelection.agentId} to ${toSelection.agentId}.`
        : "Agent identity is unchanged.",
      currentSelection.modelId !== toSelection.modelId
        ? `Model changes from ${currentSelection.modelId} to ${toSelection.modelId}.`
        : "Model is unchanged.",
      currentSelection.modelTruthClass !== toSelection.modelTruthClass || currentSelection.modelAlias !== toSelection.modelAlias
        ? `Model truth changes from ${currentSelection.modelTruthClass}/alias=${String(currentSelection.modelAlias)} to ${toSelection.modelTruthClass}/alias=${String(toSelection.modelAlias)}.`
        : "Model truth and alias status are unchanged.",
      canonicalDigest(currentSelection.settings) !== canonicalDigest(toSelection.settings)
        ? "Adapter-declared settings change."
        : "Adapter-declared settings are unchanged.",
      currentSelection.capabilityDigest !== toSelection.capabilityDigest
        ? `Capability snapshot changes from ${currentSelection.capabilityDigest} to ${toSelection.capabilityDigest}.`
        : "Capability snapshot is unchanged.",
      `Target execution interface is ${capabilities.executionInterface} (${capabilities.interfaceMaturity}).`,
      `Target resume=${capabilities.supportsResume}, cancel=${capabilities.supportsCancel}, checkpoints=${capabilities.supportsCheckpoints}, tool-selection=${capabilities.supportsToolSelection}.`,
      ...capabilities.limitations,
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
    return { handoff, capabilities }
  }

  private async currentSelectionOptional(): Promise<AgentSelection | undefined> {
    try {
      const compatibility = await this.repository.readAgentSelectionCompatibility()
      if (compatibility.status === "current") return compatibility.selection
      if (compatibility.status === "migration-required") {
        throw new Error("The persisted Agent Selection is legacy and requires explicit migration before it can change")
      }
      throw new Error(`The persisted Agent Selection is invalid: ${compatibility.issues.join("; ")}`)
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined
      throw error
    }
  }

  private buildLegacyAgentSelectionMigrationPreview(
    legacySelection: {
      portableCandidate: AgentSelection
      localRuntimeHint: { scope: "machine-local"; requestedExecutable: string }
      machineLocalSettingKeys: string[]
      machineLocalSettingsDigest: `sha256:${string}`
    },
    capabilities: AdapterCapabilities,
    adapter: AgentAdapter,
  ): LegacyAgentSelectionMigrationPreview {
    const legacy = legacySelection.portableCandidate
    if (legacy.adapterId !== capabilities.adapterId || legacy.agentId !== capabilities.agentId) {
      throw new Error("Migration cannot change the legacy Agent identity")
    }
    const normalization = normalizedLegacySettings(
      legacy,
      capabilities,
      legacySelection.machineLocalSettingKeys,
    )
    const model = capabilities.models.find((candidate) => candidate.id === legacy.modelId)
    const targetSelection = agentSelectionSchema.parse({
      schemaVersion: 2,
      adapterId: capabilities.adapterId,
      agentId: capabilities.agentId,
      modelId: legacy.modelId,
      modelTruthClass: model?.truthClass ?? "configured",
      modelAlias: model?.alias ?? null,
      settings: normalization.settings,
      selectedAt: legacy.selectedAt,
      capabilityDigest: capabilityDigest(capabilities),
    })
    const errors = adapter.validateSelection(targetSelection, capabilities)
    if (errors.length > 0) {
      throw new Error(`Legacy retained settings are incompatible with current capabilities: ${errors.join("; ")}`)
    }
    const previewWithoutDigest = {
      targetSelection,
      retiredSettingKeys: normalization.retiredSettingKeys,
      legacySelectionDigest: legacySelectionStateDigest(legacySelection),
      previousPortableSelectionDigest: canonicalDigest(legacy) as `sha256:${string}`,
      decision: "accept-exact-legacy-migration-preview" as const,
    }
    return {
      ...previewWithoutDigest,
      expectedPreviewDigest: legacyAgentSelectionMigrationReviewDigest(previewWithoutDigest),
    }
  }

  private async assertNoLegacySelectionDependents(): Promise<void> {
    const readNames = async (directory: "sessions" | "handoffs"): Promise<string[]> => {
      try {
        return await this.repository.readDirectory(this.repository.resolve(directory))
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") return []
        throw error
      }
    }
    const [sessionNames, handoffNames] = await Promise.all([readNames("sessions"), readNames("handoffs")])
    const selectionBoundArtifacts = [
      ...sessionNames.filter((name) => name.endsWith(".json")),
      ...handoffNames.filter((name) => name.endsWith(".json")),
    ]
    if (selectionBoundArtifacts.length > 0) {
      throw new Error(
        "Legacy Agent Selection has dependent Charter, Run, Handoff, or managed history; a dedicated handoff-compatible corpus migration is required",
      )
    }
  }

  private async assertLegacyMigrationIntegrity(): Promise<void> {
    try {
      await this.assertAuditIntegrity()
    } catch (error) {
      const manifest = await this.repository.readJson(
        this.repository.resolve("manifest.json"),
        repositoryManifestSchema,
      )
      let auditNames: string[] = []
      try {
        auditNames = await this.repository.readDirectory(this.repository.resolve("audit"))
      } catch (directoryError) {
        if (!(directoryError instanceof Error && "code" in directoryError && directoryError.code === "ENOENT")) {
          throw directoryError
        }
      }
      const preIntegritySignature =
        manifest.auditCheckpointRequired === undefined &&
        manifest.governedStateRequired === undefined &&
        !auditNames.includes("checkpoint.json") &&
        !auditNames.includes("state.json")
      if (preIntegritySignature) {
        throw new Error(
          "Legacy Agent Selection repository integrity predates checkpoint and governed-state support; a dedicated reviewed integrity bootstrap is required before selection migration",
        )
      }
      throw error
    }
  }

  private async assertNoUnresolvedSelectionWork(): Promise<void> {
    const [runs, managedRuns, pendingReviews] = await Promise.all([
      this.listRuns(),
      this.managedExecution.list(),
      this.managedExecution.listPendingReviewStatuses(),
    ])
    const blockedRuns = runs.filter((run) => ["prepared", "running", "paused", "unknown"].includes(run.state))
    const settledManaged = new Set(["completed", "failed", "cancelled", "timed-out", "discarded"])
    const blockedManaged = managedRuns.filter((run) => !settledManaged.has(run.state))
    if (blockedRuns.length > 0 || blockedManaged.length > 0 || pendingReviews.length > 0) {
      const details = [
        ...blockedRuns.map((run) => `Run ${run.id} is ${run.state}`),
        ...blockedManaged.map((run) => `Managed Run ${run.id} is ${run.state}`),
        ...pendingReviews.map((review) => `Managed Run ${review.managedRunId} has an unresolved ${review.state} review`),
      ]
      throw new Error(`Agent Selection cannot change while work or staged review remains unresolved: ${[...new Set(details)].join("; ")}`)
    }
  }

  private async assertAuditIntegrity(): Promise<void> {
    const audit = await this.repository.verifyAudit()
    if (!audit.valid) {
      throw new Error(`GAEP workspace audit is invalid; refusing mutation: ${audit.error ?? "unknown error"}`)
    }
  }

  private async probeAdapter(
    adapter: AgentAdapter,
    options: AdapterProbeOptions,
  ): Promise<AdapterProbeResult> {
    const result = await adapter.probe(options)
    const capabilities = adapterCapabilitiesSchema.parse(result.capabilities)
    const runtimeBinding = result.runtimeBinding
    if (capabilities.adapterId !== adapter.id) {
      throw new Error(`Adapter ${adapter.id} returned capabilities for ${capabilities.adapterId}`)
    }
    if (
      !runtimeBinding ||
      runtimeBinding.scope !== "machine-local" ||
      runtimeBinding.adapterId !== capabilities.adapterId ||
      runtimeBinding.agentId !== capabilities.agentId
    ) {
      throw new Error(`Adapter ${adapter.id} returned a mismatched machine-local runtime binding`)
    }
    if (capabilities.detected === (runtimeBinding.kind === "unavailable")) {
      throw new Error(`Adapter ${adapter.id} returned inconsistent availability and runtime binding state`)
    }
    return { capabilities, runtimeBinding }
  }

  private capabilitiesPath(capabilities: AdapterCapabilities): string {
    return this.repository.resolve(
      "runtime",
      `capabilities-${capabilityDigest(capabilities).slice("sha256:".length)}.json`,
    )
  }

  private async capabilitySnapshotWrite(
    capabilities: AdapterCapabilities,
  ): Promise<MutationWrite<AdapterCapabilities> | undefined> {
    const path = this.capabilitiesPath(capabilities)
    try {
      const existing = await this.repository.readJson(path, adapterCapabilitiesSchema)
      if (capabilityDigest(existing) !== capabilityDigest(capabilities)) {
        throw new Error("The immutable capability snapshot path contains mismatched governed content")
      }
      return undefined
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error
      return {
        path,
        value: capabilities,
        schema: adapterCapabilitiesSchema,
        governed: true,
      }
    }
  }

  private async legacyCapabilityPathsForMigration(
    capabilities: Pick<AdapterCapabilities, "adapterId" | "agentId">,
    expectedHistoricalCapabilityDigest: string,
  ): Promise<string[]> {
    const identityName = `capabilities-${canonicalDigest({
          adapterId: capabilities.adapterId,
          agentId: capabilities.agentId,
        }).slice("sha256:".length)}.json`
    const candidateNames = [identityName]
    let runtimeNames: string[]
    try {
      runtimeNames = await this.repository.readDirectory(this.repository.resolve("runtime"))
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") runtimeNames = []
      else throw error
    }
    const existing: string[] = []
    for (const name of [...new Set(candidateNames)]) {
      if (!runtimeNames.includes(name)) continue
      const path = this.repository.resolve("runtime", name)
      const compatibility = await this.repository.readAdapterCapabilitiesCompatibility(path)
      if (compatibility.status === "invalid") {
        throw new Error(`Legacy capability snapshot is invalid: ${compatibility.issues.join("; ")}`)
      }
      if (compatibility.status !== "migration-required") {
        throw new Error("The legacy Agent Selection capability snapshot is already portable and cannot prove its historical binding")
      }
      const persisted = compatibility.portableCandidate
      if (persisted.adapterId !== capabilities.adapterId || persisted.agentId !== capabilities.agentId) {
        throw new Error("Persisted legacy capability identity does not match the Selection being migrated")
      }
      if (compatibility.historicalCapabilityDigest !== expectedHistoricalCapabilityDigest) {
        throw new Error(
          "Legacy Agent Selection capability digest does not match the recognized historical capability snapshot",
        )
      }
      existing.push(path)
    }
    if (existing.length === 0) {
      throw new Error("The legacy Agent Selection has no recognized same-identity capability snapshot")
    }
    return existing
  }

  private async assertCharterBindings(charter: ExecutionCharter): Promise<void> {
    if (
      charter.productRevision === undefined ||
      charter.initiativeRevision === undefined ||
      charter.productDigest === undefined ||
      charter.initiativeDigest === undefined ||
      charter.selectionDigest === undefined
    ) {
      throw new Error("This legacy Execution Charter lacks exact state bindings; recreate and confirm it")
    }
    const [product, initiative, selection] = await Promise.all([
      this.readProduct(),
      this.readInitiative(charter.initiativeId),
      this.readSelection(),
    ])
    if (charter.productId !== product.id || initiative.productId !== product.id) {
      throw new Error("Execution Charter Product binding is no longer valid")
    }
    if (charter.productRevision !== revisionOf(product) || charter.productDigest !== canonicalDigest(product)) {
      throw new Error("Product changed after the Execution Charter was created; recreate the Charter")
    }
    if (
      charter.initiativeRevision !== revisionOf(initiative) ||
      charter.initiativeDigest !== canonicalDigest(initiative)
    ) {
      throw new Error("Initiative changed after the Execution Charter was created; recreate the Charter")
    }
    if (
      charter.selectionDigest !== canonicalDigest(charter.agent) ||
      charter.selectionDigest !== canonicalDigest(selection)
    ) {
      throw new Error("Agent, model, or settings changed after the Execution Charter was created")
    }
    if (charter.managedIntent) {
      if (JSON.stringify([...charter.managedIntent.requestedEffects].sort()) !== JSON.stringify([...charter.expectedEffects].sort())) {
        throw new Error("Managed Charter intent no longer matches the Charter expected effects")
      }
      await this.assertManagedIntentBindings(charter.managedIntent, product.id)
    }
  }

  private async assertManagedIntentBindings(intent: ExecutionManagedIntent, productId: string): Promise<void> {
    const plan = await this.productStudio.readWorkflowPlan(intent.workflowPlan.recordId)
    if (
      plan.productId !== productId ||
      plan.revision !== intent.workflowPlan.revision ||
      canonicalDigest(plan) !== intent.workflowPlan.digest ||
      plan.state !== "resolved"
    ) {
      throw new Error("Managed Charter intent requires the exact resolved Workflow Plan revision")
    }
    const contexts = await Promise.all(intent.contextPacks.map(async (binding) => {
      const pack = await this.productStudio.readContextPack(binding.recordId)
      if (pack.productId !== productId || pack.revision !== binding.revision || canonicalDigest(pack) !== binding.digest) {
        throw new Error("Managed Charter intent contains a stale or mismatched Context Pack binding")
      }
      return pack
    }))
    const tools = await Promise.all(intent.toolDefinitions.map(async (binding) => {
      const tool = await this.productStudio.readToolDefinition(binding.recordId)
      if (tool.productId !== productId || tool.revision !== binding.revision || canonicalDigest(tool) !== binding.digest) {
        throw new Error("Managed Charter intent contains a stale or mismatched Tool Definition binding")
      }
      return tool
    }))
    const planContexts = plan.contextPacks.map((binding) => `${binding.recordId}:${binding.revision}:${binding.digest}`).sort()
    const intentContexts = intent.contextPacks.map((binding) => `${binding.recordId}:${binding.revision}:${binding.digest}`).sort()
    const planTools = plan.toolDefinitions.map((binding) => `${binding.recordId}:${binding.revision}:${binding.digest}`).sort()
    const intentTools = intent.toolDefinitions.map((binding) => `${binding.recordId}:${binding.revision}:${binding.digest}`).sort()
    if (JSON.stringify(planContexts) !== JSON.stringify(intentContexts) || JSON.stringify(planTools) !== JSON.stringify(intentTools)) {
      throw new Error("Managed Charter intent must exactly match the Workflow Plan Context and Tool inventories")
    }
    if (contexts.some((pack) => pack.sufficiency.status === "insufficient") || tools.some((tool) => !tool.enabled)) {
      throw new Error("Managed Charter intent requires sufficient Context Packs and enabled Tools")
    }
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
      "Expected effects:",
      ...charter.expectedEffects.map((effect) => `- ${effect}`),
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

  private async workspaceBaseline(): Promise<{
    gitHead?: string
    dirty: boolean | null
    changedFiles: string[]
    truthClass: "observed" | "unknown"
    observationError?: string
  }> {
    try {
      const [{ stdout: head }, { stdout: status }] = await Promise.all([
        execFileAsync("git", ["rev-parse", "HEAD"], { cwd: this.workspacePath }),
        execFileAsync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], { cwd: this.workspacePath }),
      ])
      const entries = status.split("\0").filter(Boolean)
      const observedPaths: string[] = []
      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index]!
        const statusCode = entry.slice(0, 2)
        observedPaths.push(entry.slice(3))
        if (/[RC]/.test(statusCode) && entries[index + 1]) observedPaths.push(entries[++index]!)
      }
      const changedFiles: string[] = []
      let omittedNonPortablePath = false
      for (const path of observedPaths) {
        const parsed = executionWorkspaceScopeSchema.safeParse(path)
        if (parsed.success && parsed.data !== ".") changedFiles.push(parsed.data)
        else omittedNonPortablePath = true
      }
      return {
        gitHead: head.trim(),
        dirty: observedPaths.length > 0,
        changedFiles: [...new Set(changedFiles)].sort(),
        truthClass: "observed",
        observationError: omittedNonPortablePath
          ? "One or more changed file paths were omitted because they were not portable."
          : undefined,
      }
    } catch (error) {
      return {
        dirty: null,
        changedFiles: [],
        truthClass: "unknown",
        observationError: error instanceof Error &&
          "code" in error &&
          typeof error.code === "string" &&
          /^[A-Z0-9_]+$/.test(error.code)
          ? `Git workspace state could not be observed (${error.code}).`
          : "Git workspace state could not be observed.",
      }
    }
  }
}
