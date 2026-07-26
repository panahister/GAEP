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
  type PlatformReadinessSnapshot,
  type Product,
  type Run,
  type ToolPermission,
} from "@gaep/contracts"
import {
  canonicalDigest,
  capabilityDigest,
  startManagedClaudeContextRun,
  CodexAppServerSupervisor,
  codexAppServerLaunchArgs,
  WorkspaceStagingService,
  ManagedStageRegistry,
  type AdapterProbeOptions,
  type AdapterProbeResult,
  type AgentAdapter,
  type AgentInvocation,
  type CodexAppServerOptions,
  type WorkspaceStage,
} from "@gaep/agent-sdk"

import { computePlatformReadinessSnapshot } from "./platform-readiness.js"
import {
  CODEX_READ_ONLY_FLAGS,
  providerRunnerKind,
  runCodexReadOnlyTurn,
  type CodexTurnDriver,
} from "./provider-runner.js"
import { ProviderCatalogService } from "./provider-catalog.js"
import {
  ReadOnlyAnalysisService,
  type ProviderRunHandle,
  type ProviderRunOutcome,
  type ProviderRunRequest,
} from "./read-only-analysis.js"
import { GaepRepository, type GaepRepositoryOptions } from "./repository.js"
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

/**
 * GAEP-P0-CS02 — adapt the real Codex app-server supervisor to the read-only CodexTurnDriver.
 * Codex operates on a staged COPY of the Product workspace with file changes disabled, so it can
 * read the workspace but can never write to it. Only invoked when a Codex runtime is installed.
 */
/** Minimal supervisor surface the read-only driver needs, so the boundary is fakeable in tests. */
export interface CodexSupervisorLike {
  start(): Promise<void>
  startStagedThread(options: { stage: WorkspaceStage; model: string; developerInstructions?: string }): Promise<{ threadId: string }>
  startStagedTurn(options: { stage: WorkspaceStage; threadId: string; prompt: string; model?: string }): Promise<{ threadId: string; turnId: string }>
  cancelTurn(threadId: string, turnId: string): Promise<void>
  buildResult(options: { stage: WorkspaceStage; providerThreadId: string; providerTurnId: string; terminalDisposition: "completed" | "failed" }): Promise<unknown>
  stop(): Promise<void>
  readonly events: AsyncIterable<unknown>
}

/** Minimal staging surface the read-only driver needs (create + cleanup). */
export interface CodexStagingLike {
  create(sourcePath: string): Promise<WorkspaceStage>
  cleanup(stage: WorkspaceStage): Promise<void>
}

export interface CodexReadOnlyRuntime {
  supervisor: CodexSupervisorLike
  stagingService: CodexStagingLike
}

export interface CodexReadOnlyRuntimeOptions {
  executable: string
  runtimeVersion?: string
  requestTimeoutMs: number
  processCwd: string
}

/** Factory for the real Codex read-only runtime; the sole seam faked by the integration test. */
export type CodexReadOnlyRuntimeFactory = (options: CodexReadOnlyRuntimeOptions) => CodexReadOnlyRuntime

/**
 * The production Codex read-only supervisor options. Read-only enforcement lives here: shell tool
 * and file-change authority are disabled, which makes the supervisor open the thread `read-only`
 * and the turn `{ type: "readOnly", networkAccess: false }` with no writable roots. Exported so a
 * test asserts the real production configuration without spawning a Codex binary.
 */
export function buildCodexReadOnlySupervisorOptions(
  options: CodexReadOnlyRuntimeOptions & { stagingService: WorkspaceStagingService },
): CodexAppServerOptions {
  return {
    executable: options.executable,
    stagingService: options.stagingService,
    ...CODEX_READ_ONLY_FLAGS,
    processCwd: options.processCwd,
    args: codexAppServerLaunchArgs(false),
    ...(options.runtimeVersion ? { runtimeVersion: options.runtimeVersion } : {}),
    requestTimeoutMs: Math.min(options.requestTimeoutMs, 600_000),
  }
}

/** Default production factory: real staging + real Codex app-server supervisor. */
export const defaultCodexReadOnlyRuntimeFactory: CodexReadOnlyRuntimeFactory = (options) => {
  const stagingService = new WorkspaceStagingService()
  const supervisor = new CodexAppServerSupervisor(buildCodexReadOnlySupervisorOptions({ ...options, stagingService }))
  return { supervisor, stagingService }
}

function createCodexTurnDriver(
  supervisor: CodexSupervisorLike,
  workspacePath: string,
  stagingService: CodexStagingLike,
): CodexTurnDriver {
  let stage: WorkspaceStage | undefined
  return {
    allowShellTool: false,
    allowFileChanges: false,
    async start(): Promise<void> {
      stage = await stagingService.create(workspacePath)
      await supervisor.start()
    },
    async startReadOnlyThread(options): Promise<{ threadId: string }> {
      if (!stage) throw new Error("Codex stage not created")
      return supervisor.startStagedThread({ stage, model: options.model, developerInstructions: options.developerInstructions })
    },
    async startTurn(options): Promise<{ threadId: string; turnId: string }> {
      if (!stage) throw new Error("Codex stage not created")
      return supervisor.startStagedTurn({ stage, threadId: options.threadId, prompt: options.prompt, model: options.model })
    },
    async cancelTurn(threadId, turnId): Promise<void> {
      await supervisor.cancelTurn(threadId, turnId)
    },
    async awaitResult(threadId, turnId): Promise<{ status: "completed" | "failed"; text?: string; failureDetail?: string }> {
      if (!stage) throw new Error("Codex stage not created")
      let failed = false
      const texts: string[] = []
      for await (const event of supervisor.events) {
        const record = event as { type?: string; text?: string; error?: { message?: string } }
        if (typeof record.text === "string") texts.push(record.text)
        if (record.type && /error|failed/i.test(record.type)) failed = true
        if (record.type && /turn[_.-]?(completed|finished|done)|task[_.-]?complete/i.test(record.type)) break
      }
      const result = await supervisor.buildResult({
        stage,
        providerThreadId: threadId,
        providerTurnId: turnId,
        terminalDisposition: failed ? "failed" : "completed",
      })
      const envelope = result as { status?: string; text?: string; failure?: { message?: string } }
      return {
        status: failed || envelope.status === "failed" ? "failed" : "completed",
        text: envelope.text ?? texts.join("\n"),
        failureDetail: envelope.failure?.message,
      }
    },
    async stop(): Promise<void> {
      // Stop the supervisor first (await provider termination), then always remove the staged copy
      // so no temporary staged workspace is left behind after completion/failure/cancel/timeout.
      try {
        await supervisor.stop()
      } finally {
        if (stage) {
          const staged = stage
          stage = undefined
          await stagingService.cleanup(staged).catch(() => undefined)
        }
      }
    },
  }
}


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

export interface LegacyAgentSelectionMigrationInput {
  capabilities: AdapterCapabilities
  modelId: string
  settings: Record<string, unknown>
  confirmation: "reconfirm-portable-agent-selection"
}

export class GaepEngine {
  readonly repository: GaepRepository
  readonly productStudio: ProductStudioService
  readonly managedExecution: ManagedExecutionService
  readonly adapters = new Map<string, AgentAdapter>()
  private providerCatalogService?: ProviderCatalogService
  private readOnlyAnalysisService?: ReadOnlyAnalysisService

  private readonly codexRuntimeFactory: CodexReadOnlyRuntimeFactory

  constructor(
    readonly workspacePath: string,
    adapters: AgentAdapter[],
    repositoryOptions: GaepRepositoryOptions = {},
    managedStageRegistry: ManagedStageRegistry = new ManagedStageRegistry(),
    // The Codex read-only runtime seam. Production uses the real supervisor; the integration test
    // fakes only this boundary while exercising the real dispatch through runReadOnlyProvider.
    codexRuntimeFactory: CodexReadOnlyRuntimeFactory = defaultCodexReadOnlyRuntimeFactory,
  ) {
    this.codexRuntimeFactory = codexRuntimeFactory
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

  /** GAEP-P0-CS02: provider catalog + server-derived model truth (INV-31). */
  get providerCatalog(): ProviderCatalogService {
    this.providerCatalogService ??= new ProviderCatalogService(() => this.probeAgents())
    return this.providerCatalogService
  }

  /** GAEP-P0-CS02: the single owner of read-only provider execution (INV-02). */
  get readOnlyAnalysis(): ReadOnlyAnalysisService {
    this.readOnlyAnalysisService ??= new ReadOnlyAnalysisService(
      this.workspacePath,
      (request) => this.runReadOnlyProvider(request),
      (adapterId, observation) => this.providerCatalog.recordAuthObservation(adapterId, observation),
    )
    return this.readOnlyAnalysisService
  }

  /**
   * Execute one bounded read-only provider invocation (INV-03), returning a handle whose `completion`
   * settles only AFTER the provider process terminates and whose `forceStop` hard-kills the real
   * process/supervisor (Claude: escalated cancel → SIGKILL; Codex: supervisor stop unblocks the turn).
   * Codex runs in a read-only sandbox; Claude runs tool-free from an empty temporary directory.
   */
  private runReadOnlyProvider(request: ProviderRunRequest): ProviderRunHandle {
    // Cancellation state is owned by the handle BEFORE probing begins, so a cancel/timeout during
    // adapter initialization prevents provider startup and forceStop is never a no-op race.
    let forceStopped = false
    let killer: (() => Promise<void>) | undefined
    const cancelledBeforeStart = (): boolean => request.signal.aborted || forceStopped
    const completion = (async (): Promise<ProviderRunOutcome> => {
      if (cancelledBeforeStart()) return { kind: "cancelled" }
      const adapter = this.adapters.get(request.adapterId)
      if (!adapter) return { kind: "failed", failureCategory: "provider-unavailable" }
      const probed = await adapter.probe({ refreshModels: false })
      // Re-check cancellation AFTER probing and BEFORE creating/spawning any provider.
      if (cancelledBeforeStart()) return { kind: "cancelled" }
      if (!probed.capabilities.detected || probed.runtimeBinding.kind !== "executable") {
        return { kind: "failed", failureCategory: "provider-unavailable" }
      }
      const kind = providerRunnerKind(probed.capabilities)
      if (kind === "codex") {
        // Real Codex read-only path: shell/tool + file-change authority disabled, Product
        // workspace as the only read root, bounded governed Context Pack as the sole input.
        try {
          const { supervisor, stagingService } = this.codexRuntimeFactory({
            executable: probed.runtimeBinding.executablePath,
            processCwd: this.workspacePath,
            requestTimeoutMs: request.timeoutMs,
            ...(probed.capabilities.runtimeVersion ? { runtimeVersion: probed.capabilities.runtimeVersion } : {}),
          })
          const driver = createCodexTurnDriver(supervisor, this.workspacePath, stagingService)
          // Force-stop kills the supervisor, which unblocks the turn's awaitResult and cleans staging.
          killer = () => driver.stop()
          // If cancellation raced factory construction, stop the supervisor + clean staging and abort
          // before any turn starts, so nothing survives finalization.
          if (cancelledBeforeStart()) { await driver.stop(); return { kind: "cancelled" } }
          return await runCodexReadOnlyTurn(driver, {
            model: request.modelId,
            objective: request.objective,
            contextText: request.contextText,
            signal: request.signal,
            timeoutMs: request.timeoutMs,
          })
        } catch {
          return { kind: "failed", failureCategory: "provider-error" }
        }
      }
      if (kind !== "claude") {
        return { kind: "failed", failureCategory: "provider-unavailable" }
      }
      try {
        const handle = await startManagedClaudeContextRun({
          executable: probed.runtimeBinding.executablePath,
          model: request.modelId,
          objective: request.objective,
          contextPack: request.contextText,
          timeoutMs: request.timeoutMs,
          runtimeVersion: probed.capabilities.runtimeVersion,
        })
        // Force-stop escalates the managed cancel (SIGTERM → SIGKILL); completion resolves on close.
        killer = async () => { try { await handle.cancel("force-stop") } catch { /* already terminating */ } }
        // If cancellation raced startup, cancel the managed run immediately.
        if (cancelledBeforeStart()) { try { await handle.cancel("cancel-request") } catch { /* terminating */ } }
        const abortListener = (): void => { void handle.cancel("cancel-request") }
        request.signal.addEventListener("abort", abortListener, { once: true })
        try {
          const completion = await handle.completion
          if (completion.terminationCause === "timeout") return { kind: "timed-out" }
          if (completion.terminationCause === "cancel-request") return { kind: "cancelled" }
          if (completion.terminationCause === "protocol-error") {
            return { kind: "failed", failureCategory: "protocol-error" }
          }
          const analysis = completion.analysis
          if (completion.terminationCause === "provider-failure" || analysis?.status === "failed") {
            // Classify from the provider's own diagnostic (e.g. "Not logged in · Please run /login").
            const detail = String(analysis?.failureDetail ?? "").toLowerCase()
            const authFailure = detail.includes("unauthor") || detail.includes("authentication")
              || detail.includes("not logged in") || detail.includes("please run /login") || detail.includes("/login")
            return { kind: "failed", failureCategory: authFailure ? "auth-unavailable" : "provider-error" }
          }
          return { kind: "completed", text: String(analysis?.text ?? "") }
        } finally {
          request.signal.removeEventListener("abort", abortListener)
        }
      } catch {
        return { kind: "failed", failureCategory: "provider-error" }
      }
    })()
    const forceStop = async (): Promise<void> => {
      forceStopped = true
      // Terminate the provider if one started; then WAIT for initialization/completion to settle so
      // forceStop never resolves while `completion` is still pending (no provider can start afterward).
      try { await killer?.() } catch { /* best effort */ }
      await completion.catch(() => undefined)
    }
    return { completion, forceStop }
  }

  /**
   * Produce the Base Platform Readiness Snapshot: provider readiness (`probeAgents`) plus
   * workspace readiness (`workspaceHealth`), with the Four-IDE Host Matrix left at its defaults.
   * The engine makes no host-conformance claim and accepts no host-conformance input.
   */
  async computePlatformReadiness(): Promise<PlatformReadinessSnapshot> {
    const [providers, workspace] = await Promise.all([this.probeAgents(), this.workspaceHealth()])
    return computePlatformReadinessSnapshot({ providers, workspace })
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
      const capabilitiesPath = this.capabilitiesPath(observedCapabilities)
      await this.repository.commitMutation({
        writes: [
          {
            path: this.repository.resolve("runtime", "selection.json"),
            value: selection,
            schema: agentSelectionSchema,
            governed: true,
          },
          {
            path: capabilitiesPath,
            value: observedCapabilities,
            schema: adapterCapabilitiesSchema,
            governed: true,
          },
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

  async migrateLegacyAgentSelection(
    input: LegacyAgentSelectionMigrationInput,
    actorId: string,
  ): Promise<AgentSelection> {
    if (input.confirmation !== "reconfirm-portable-agent-selection") {
      throw new Error("Legacy Agent Selection migration requires explicit capability reconfirmation")
    }
    const suppliedCapabilities = adapterCapabilitiesSchema.parse(input.capabilities)
    const adapter = this.adapters.get(suppliedCapabilities.adapterId)
    if (!adapter) throw new Error(`Adapter ${suppliedCapabilities.adapterId} is not registered`)
    return this.repository.withLock(async () => {
      await this.assertAuditIntegrity()
      await this.readProduct()
      const legacySelection = await this.repository.readAgentSelectionCompatibility()
      if (legacySelection.status !== "migration-required") {
        throw new Error("Agent Selection migration requires an existing valid legacy Selection")
      }
      if (
        legacySelection.portableCandidate.adapterId !== suppliedCapabilities.adapterId ||
        legacySelection.portableCandidate.agentId !== suppliedCapabilities.agentId
      ) {
        throw new Error("Migration cannot change the legacy Agent identity; perform a separate Agent Selection instead")
      }
      const capabilitiesPath = this.capabilitiesPath(suppliedCapabilities)
      const legacyCapabilities = await this.repository.readAdapterCapabilitiesCompatibility(capabilitiesPath)
      if (legacyCapabilities.status === "invalid") {
        throw new Error(`Legacy capability snapshot is invalid: ${legacyCapabilities.issues.join("; ")}`)
      }
      const persistedCapabilities = legacyCapabilities.status === "current"
        ? legacyCapabilities.capabilities
        : legacyCapabilities.portableCandidate
      if (
        persistedCapabilities.adapterId !== suppliedCapabilities.adapterId ||
        persistedCapabilities.agentId !== suppliedCapabilities.agentId
      ) {
        throw new Error("Persisted legacy capability identity does not match the Selection being migrated")
      }
      const { capabilities: observedCapabilities } = await this.probeAdapter(adapter, { refreshModels: true })
      if (capabilityDigest(observedCapabilities) !== capabilityDigest(suppliedCapabilities)) {
        throw new Error("Agent capabilities changed during migration; probe and reconfirm again")
      }
      const model = observedCapabilities.models.find((candidate) => candidate.id === input.modelId)
      const selection = agentSelectionSchema.parse({
        schemaVersion: 2,
        adapterId: observedCapabilities.adapterId,
        agentId: observedCapabilities.agentId,
        modelId: input.modelId,
        modelTruthClass: model?.truthClass ?? "configured",
        modelAlias: model?.alias ?? null,
        settings: input.settings,
        selectedAt: new Date().toISOString(),
        capabilityDigest: capabilityDigest(observedCapabilities),
      })
      const errors = adapter.validateSelection(selection, observedCapabilities)
      if (errors.length > 0) throw new Error(errors.join("; "))
      await this.repository.commitMutation({
        writes: [
          {
            path: this.repository.resolve("runtime", "selection.json"),
            value: selection,
            schema: agentSelectionSchema,
            governed: true,
          },
          {
            path: capabilitiesPath,
            value: observedCapabilities,
            schema: adapterCapabilitiesSchema,
            governed: true,
          },
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
            capabilityReconfirmed: true,
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
      return rightTime.localeCompare(leftTime)
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

  async createHandoff(input: HandoffInput, actorId: string): Promise<Handoff> {
    return this.repository.withLock(async () => {
      await this.assertAuditIntegrity()
      const { handoff, capabilities } = await this.buildHandoffWithCapabilities(input)
      const selection = handoff.toAgent
      const capabilitiesPath = this.capabilitiesPath(capabilities)
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
          {
            path: capabilitiesPath,
            value: capabilities,
            schema: adapterCapabilitiesSchema,
            governed: true,
          },
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
    const fromRunId = requireUuid(input.fromRunId, "Source Run ID")
    const fromRun = await this.repository.readJson(
      this.repository.resolve("sessions", `run-${fromRunId}.json`),
      runSchema,
    )
    if (fromRun.state === "running" || fromRun.state === "unknown") {
      throw new Error("Stop, cancel, or reconcile the active agent process before creating a switch handoff")
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
    const baseline = await this.workspaceBaseline()
    const capabilityDifferences = [
      fromRun.agent.adapterId !== toSelection.adapterId
        ? `Agent adapter changes from ${fromRun.agent.adapterId} to ${toSelection.adapterId}.`
        : "Agent adapter is unchanged.",
      fromRun.agent.modelId !== toSelection.modelId
        ? `Model changes from ${fromRun.agent.modelId} to ${toSelection.modelId}.`
        : "Model is unchanged.",
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

  private capabilitiesPath(capabilities: Pick<AdapterCapabilities, "adapterId" | "agentId">): string {
    return this.repository.resolve(
      "runtime",
      `capabilities-${canonicalDigest({
        adapterId: capabilities.adapterId,
        agentId: capabilities.agentId,
      }).slice("sha256:".length)}.json`,
    )
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
