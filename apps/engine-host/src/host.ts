import { CodexAdapter } from "@gaep/adapter-codex"
import { ClaudeAdapter } from "@gaep/adapter-claude"
import {
  capabilityDigest,
  fingerprintExecutable,
  type AdapterProbeResult,
  type AdapterRuntimeBinding,
  type ExecutableFingerprint,
} from "@gaep/agent-sdk"
import {
  adapterCapabilitiesSnapshotSchema,
  hostMethodSchema,
  hostRequestSchema,
  type AdapterCapabilities,
  type HostRequest,
  type Run,
} from "@gaep/contracts"
import {
  AnalysisError,
  GaepEngine,
  MAX_CONTEXT_BYTES,
  buildDashboardProjection,
  computeSourceIdentity,
} from "@gaep/engine"
import { z, ZodError } from "zod"

import { composeHostMatrix } from "@gaep/conformance"

import { HostRpcError, invalidParamsError, MAX_RPC_FRAME_BYTES, normalizeRpcError } from "./rpc.js"

const PROTOCOL_VERSION = 3
const CS02_PACKAGE_VERSION = "0.2.0"
const SUPPORTED_PROTOCOL_VERSIONS = [1, 2, 3] as const
const v2OnlyMethods = new Set<HostRequest["method"]>([
  "platformReadiness",
  "workspaceHealth",
  "migrateLegacySelection",
  "productStudio.designReadiness",
  "productStudio.search",
  "productStudio.exportBuild",
  "productStudio.importPreview",
])

/** GAEP-P0-CS02 methods require protocol version 3 (INV-18). */
const v3OnlyMethods = new Set<HostRequest["method"]>([
  "providerCatalog",
  "readProviderSelection",
  "selectProviderModel",
  "startReadOnlyAnalysis",
  "readAnalysisRun",
  "listAnalysisRuns",
  "cancelAnalysisRun",
  "dashboardProjection",
])

const requestEnvelopeSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string().min(1).max(128), z.number().int().safe()]),
  protocolVersion: z.number().int().positive().max(1_000).optional(),
  method: z.string().min(1).max(128),
  params: z.unknown().default({}),
}).strict()

interface CapabilitySnapshot {
  capabilities: AdapterCapabilities
  runtimeBinding: AdapterRuntimeBinding
}

interface PortablePreparedRun {
  run: Run
  execution: {
    inputMode?: "text-once" | "bidirectional-jsonl"
    protocol: "jsonl" | "stream-json" | "json-rpc"
    maturity: "stable" | "beta" | "experimental"
    warnings: string[]
    promptAttached: boolean
  }
}

function actorId(value: string | undefined): string {
  return value ?? "gaep.local-founder"
}

function sameExecutable(left: ExecutableFingerprint, right: ExecutableFingerprint): boolean {
  return left.canonicalPath === right.canonicalPath
    && left.digest === right.digest
    && left.size === right.size
    && left.modifiedAtMs === right.modifiedAtMs
}

function sameRuntimeBinding(left: AdapterRuntimeBinding, right: AdapterRuntimeBinding): boolean {
  if (left.kind !== right.kind || left.adapterId !== right.adapterId || left.agentId !== right.agentId) return false
  if (left.kind === "executable" && right.kind === "executable") {
    return left.executablePath === right.executablePath
      && sameExecutable(left.executableFingerprint, right.executableFingerprint)
  }
  if (left.kind === "managed-in-process" && right.kind === "managed-in-process") {
    return left.runtimeId === right.runtimeId
  }
  return left.kind === "unavailable" && right.kind === "unavailable"
}

function portablePreparedRun(value: { run: Run; invocation: {
  inputMode?: "text-once" | "bidirectional-jsonl"
  protocol: "jsonl" | "stream-json" | "json-rpc"
  maturity: "stable" | "beta" | "experimental"
  warnings: string[]
  stdin?: string
} }): PortablePreparedRun {
  return {
    run: value.run,
    execution: {
      inputMode: value.invocation.inputMode,
      protocol: value.invocation.protocol,
      maturity: value.invocation.maturity,
      warnings: [...value.invocation.warnings],
      promptAttached: value.invocation.stdin !== undefined,
    },
  }
}

export class EngineHost {
  readonly engine: GaepEngine
  private readonly recovery: Promise<unknown>
  private readonly capabilitySnapshots = new Map<string, CapabilitySnapshot>()
  private readonly selectedRuntimeBindings = new Map<string, AdapterRuntimeBinding>()

  constructor(workspacePath: string) {
    this.engine = new GaepEngine(workspacePath, [new CodexAdapter(), new ClaudeAdapter()])
    this.recovery = this.engine.recoverInterruptedRuns("gaep.engine-host").then(() => {
      // GAEP-P0-CS02: reconcile any persisted orphaned read-only analysis runs after a restart.
      try { this.engine.readOnlyAnalysis.reconcileOrphans() } catch { /* no runs directory yet */ }
    })
  }

  async dispatch(rawRequest: unknown): Promise<unknown> {
    try {
      return await this.dispatchInternal(rawRequest)
    } catch (error) {
      throw normalizeRpcError(error)
    }
  }

  private async dispatchInternal(rawRequest: unknown): Promise<unknown> {
    await this.recovery
    const request = EngineHost.validateRequest(rawRequest)
    const requestProtocol = request.protocolVersion ?? 1
    if (!SUPPORTED_PROTOCOL_VERSIONS.includes(requestProtocol as 1 | 2 | 3)) {
      throw new HostRpcError(
        -32_020,
        "UNSUPPORTED_PROTOCOL_VERSION",
        `GAEP engine protocol ${requestProtocol} is unsupported`,
        { supportedProtocolVersions: [...SUPPORTED_PROTOCOL_VERSIONS] },
      )
    }
    if (requestProtocol < 3 && v3OnlyMethods.has(request.method)) {
      throw new HostRpcError(
        -32_021,
        "PROTOCOL_UPGRADE_REQUIRED",
        "This GAEP engine method requires protocol version 3",
        { supportedProtocolVersions: [...SUPPORTED_PROTOCOL_VERSIONS] },
      )
    }
    if (requestProtocol === 1 && v2OnlyMethods.has(request.method)) {
      throw new HostRpcError(
        -32_021,
        "PROTOCOL_UPGRADE_REQUIRED",
        "This GAEP engine method requires protocol version 2",
        { supportedProtocolVersions: [...SUPPORTED_PROTOCOL_VERSIONS] },
      )
    }

    switch (request.method) {
      case "ping":
        return {
          engineVersion: "0.1.0",
          protocolVersion: PROTOCOL_VERSION,
          negotiatedProtocolVersion: requestProtocol,
          supportedProtocolVersions: [...SUPPORTED_PROTOCOL_VERSIONS],
        }
      case "probeAgents":
        return this.refreshCapabilitySnapshots()
      case "platformReadiness":
        return this.engine.computePlatformReadiness()
      case "workspaceHealth":
        return this.engine.workspaceHealth()
      case "readProduct":
        return this.engine.readProduct()
      case "createProduct":
        return this.engine.createProduct(request.params.product, actorId(request.params.actorId))
      case "createInitiative":
        return this.engine.createInitiative(request.params.initiative, actorId(request.params.actorId))
      case "selectAgent": {
        const snapshot = await this.observeAdapter(request.params.adapterId)
        const selection = await this.engine.selectAgent(
          structuredClone(snapshot.capabilities),
          request.params.modelId,
          request.params.settings,
          actorId(request.params.actorId),
        )
        this.selectedRuntimeBindings.set(request.params.adapterId, structuredClone(snapshot.runtimeBinding))
        return selection
      }
      case "migrateLegacySelection": {
        const snapshot = await this.observeAdapter(request.params.adapterId)
        const selection = await this.engine.migrateLegacyAgentSelection({
          capabilities: structuredClone(snapshot.capabilities),
          modelId: request.params.modelId,
          settings: request.params.settings,
          confirmation: request.params.confirmation,
        }, actorId(request.params.actorId))
        this.selectedRuntimeBindings.set(request.params.adapterId, structuredClone(snapshot.runtimeBinding))
        return selection
      }
      case "createCharter":
        return this.engine.createCharter(request.params.charter, actorId(request.params.actorId))
      case "confirmCharter":
        return this.engine.confirmCharter(request.params.charterId, actorId(request.params.actorId))
      case "prepareRun": {
        const selection = await this.engine.readSelection()
        const selectedBinding = this.selectedRuntimeBindings.get(selection.adapterId)
        const fresh = await this.observeAdapter(selection.adapterId)
        if (capabilityDigest(fresh.capabilities) !== selection.capabilityDigest) {
          throw new HostRpcError(
            -32_012,
            "CAPABILITIES_CHANGED",
            "Agent capabilities changed after selection; select the agent and model again",
          )
        }
        if (selectedBinding && !sameRuntimeBinding(selectedBinding, fresh.runtimeBinding)) {
          throw new HostRpcError(
            -32_014,
            "EXECUTABLE_CHANGED",
            "The selected agent runtime changed after selection; probe and select it again",
          )
        }
        if (fresh.runtimeBinding.kind === "unavailable") {
          throw new HostRpcError(-32_013, "EXECUTABLE_UNAVAILABLE", "The selected agent runtime is unavailable")
        }
        this.selectedRuntimeBindings.set(selection.adapterId, structuredClone(fresh.runtimeBinding))
        return portablePreparedRun(await this.engine.prepareRun(request.params.charterId, actorId(request.params.actorId)))
      }
      case "listRuns":
        return this.engine.listRuns()
      case "createHandoff": {
        const snapshot = await this.observeAdapter(request.params.handoff.toAdapterId)
        return this.engine.createHandoff({
          fromRunId: request.params.handoff.fromRunId,
          toCapabilities: structuredClone(snapshot.capabilities),
          toModelId: request.params.handoff.toModelId,
          toSettings: request.params.handoff.toSettings,
          reason: request.params.handoff.reason,
          completedWork: request.params.handoff.completedWork,
          unresolvedMatters: request.params.handoff.unresolvedMatters,
          decisions: request.params.handoff.decisions,
          evidence: request.params.handoff.evidence,
        }, actorId(request.params.actorId))
      }
      case "verifyAudit":
        return this.engine.repository.verifyAudit()
      case "productStudio.designReadiness": {
        const draft = await this.engine.productStudio.readDesignDraft(request.params.productId)
        return this.engine.productStudio.evaluateDesignReadiness(draft)
      }
      case "productStudio.search":
        return this.engine.productStudio.search(request.params)
      case "productStudio.exportBuild":
        return this.engine.productStudio.buildPortableExport()
      case "productStudio.importPreview":
        return this.engine.productStudio.previewImportBundle(request.params.bundle)
      // --- GAEP-P0-CS02 protocol v3 ---
      case "providerCatalog":
        return this.engine.providerCatalog.catalog()
      case "readProviderSelection":
        return this.readProviderSelection()
      case "selectProviderModel": {
        // INV-31: truth is server-derived. ProviderCatalogService delegates the write to
        // GaepEngine.selectAgent(), keeping the single selection source of truth (INV-23).
        try {
          return await this.engine.providerCatalog.selectProviderModel(
            {
              adapterId: request.params.adapterId,
              modelId: request.params.modelId,
              settings: request.params.settings,
              actorId: actorId(request.params.actorId),
            },
            async (adapterId, modelId, settings, actor) => {
              const snapshot = await this.observeAdapter(adapterId)
              const selection = await this.engine.selectAgent(
                structuredClone(snapshot.capabilities), modelId, settings, actor,
              )
              this.selectedRuntimeBindings.set(adapterId, structuredClone(snapshot.runtimeBinding))
              return selection
            },
          )
        } catch (error) {
          if (error instanceof Error && error.message.startsWith("MODEL_NOT_PERMITTED")) {
            throw new HostRpcError(-32_011, "MODEL_NOT_PERMITTED", "No catalog entry exists for the requested adapter")
          }
          throw error
        }
      }
      case "startReadOnlyAnalysis":
        return this.startReadOnlyAnalysis(request.params)
      case "readAnalysisRun":
        return this.engine.readOnlyAnalysis.read(request.params.analysisRunId)
      case "listAnalysisRuns":
        return { runs: this.engine.readOnlyAnalysis.list(request.params.limit) }
      case "cancelAnalysisRun": {
        const record = await this.engine.readOnlyAnalysis.cancel(request.params.analysisRunId)
        return { analysisRunId: record.analysisRunId, state: record.state }
      }
      case "dashboardProjection":
        return this.buildDashboardProjection()
    }
  }

  private async readProviderSelection(): Promise<unknown> {
    try {
      const selection = await this.engine.readSelection()
      return {
        selection,
        provenance: {
          priorSelectionCount: 0,
          priorRunIds: this.engine.readOnlyAnalysis.list(100).map((run) => run.analysisRunId),
        },
      }
    } catch {
      return { selection: null, provenance: { priorSelectionCount: 0, priorRunIds: [] } }
    }
  }

  private async startReadOnlyAnalysis(params: {
    actorId?: string
    objective: string
    contextPackIds: string[]
    timeoutMs: number
    idempotencyKey: string
  }): Promise<unknown> {
    let selection
    try {
      selection = await this.engine.readSelection()
    } catch {
      throw new HostRpcError(-32_030, "NO_SELECTION", "Select a provider and model before starting an analysis")
    }
    const entry = await this.engine.providerCatalog.entry(selection.adapterId)
    if (!entry) {
      throw new HostRpcError(-32_011, "CAPABILITIES_NOT_AVAILABLE", "No catalog entry exists for the selected adapter")
    }
    const contextText = await this.buildBoundedContext(params.contextPackIds)
    const sourceIdentity = await computeSourceIdentity(this.engine.workspacePath)
    try {
      const record = await this.engine.readOnlyAnalysis.start({
        adapterId: selection.adapterId,
        modelId: selection.modelId,
        objective: params.objective,
        contextPackIds: params.contextPackIds,
        contextText,
        timeoutMs: params.timeoutMs,
        idempotencyKey: params.idempotencyKey,
        catalogEntry: entry,
        sourceIdentity,
      })
      return { analysisRunId: record.analysisRunId, state: record.state, startedAt: record.startedAt, envelope: record.envelope }
    } catch (error) {
      if (error instanceof AnalysisError) {
        throw new HostRpcError(-32_031, error.kind, error.message)
      }
      throw error
    }
  }

  /** Build the bounded, normalized analysis context from governed Context Pack records (INV-24). */
  private async buildBoundedContext(contextPackIds: string[]): Promise<string> {
    const sections: string[] = []
    for (const id of contextPackIds) {
      try {
        const record = await this.engine.productStudio.readContextPack(id)
        const fields = record as unknown as Record<string, unknown>
        const parts = ["name", "summary", "purpose", "objective", "content", "body"]
          .map((key) => (typeof fields[key] === "string" ? String(fields[key]) : ""))
          .filter((value) => value.length > 0)
        // Include the governed Context Item contents, the substance of a real Context Pack.
        const items = Array.isArray(fields.items) ? fields.items : []
        for (const item of items) {
          const content = (item as { content?: unknown }).content
          if (typeof content === "string" && content.length > 0) parts.push(content)
        }
        sections.push([`# context-pack ${id}`, ...parts].join("\n"))
      } catch {
        throw new HostRpcError(-32_032, "CONTEXT_PACK_NOT_FOUND", "A requested Context Pack record was not found")
      }
    }
    const text = sections.join("\n\n")
    if (Buffer.byteLength(text, "utf8") > MAX_CONTEXT_BYTES) {
      throw new HostRpcError(-32_033, "CONTEXT_TOO_LARGE", "The bounded analysis context exceeds its maximum size")
    }
    return text
  }

  private async buildDashboardProjection(): Promise<unknown> {
    const health = await this.engine.workspaceHealth()
    const workspaceState = !health.initialized
      ? "product-uninitialized"
      : health.status === "invalid"
        ? "product-invalid"
        : health.status === "degraded"
          ? "product-degraded"
          : "product-ready"
    let catalog = null
    try {
      catalog = await this.engine.providerCatalog.catalog()
    } catch { /* provider probe failure leaves an empty catalog */ }
    let selection = null
    try {
      selection = await this.engine.readSelection()
    } catch { /* no selection yet */ }
    return buildDashboardProjection({
      workspaceState,
      catalog,
      selection,
      latestRun: this.engine.readOnlyAnalysis.latest() ?? null,
      // Consume host-conformance composition (INV-13): no runtime evidence bundles are present,
      // so every host stays at its base posture until its own lane publishes verified evidence.
      hostMatrix: composeHostMatrix([
        { host: "vscode", packageVersion: CS02_PACKAGE_VERSION },
        { host: "visual-studio", packageVersion: CS02_PACKAGE_VERSION },
        { host: "rider", packageVersion: CS02_PACKAGE_VERSION },
        { host: "kiro", packageVersion: CS02_PACKAGE_VERSION },
      ]),
    })
  }

  private async refreshCapabilitySnapshots(): Promise<AdapterCapabilities[]> {
    const observed = await Promise.all([...this.engine.adapters.keys()].map((adapterId) => this.observeAdapter(adapterId)))
    return observed.map((snapshot) => structuredClone(snapshot.capabilities))
  }

  private async observeAdapter(adapterId: string): Promise<CapabilitySnapshot> {
    const adapter = this.engine.adapters.get(adapterId)
    if (!adapter) {
      throw new HostRpcError(-32_011, "CAPABILITIES_NOT_AVAILABLE", "No host-observed capabilities exist for the requested adapter")
    }
    const probed = await adapter.probe({ refreshModels: true })
    const snapshot = await this.validateProbeResult(probed)
    this.capabilitySnapshots.set(adapterId, snapshot)
    return snapshot
  }

  private async validateProbeResult(probed: AdapterProbeResult): Promise<CapabilitySnapshot> {
    const capabilities = adapterCapabilitiesSnapshotSchema.parse(probed.capabilities)
    const rawBinding = probed.runtimeBinding
    if (
      !rawBinding
      || rawBinding.scope !== "machine-local"
      || rawBinding.adapterId !== capabilities.adapterId
      || rawBinding.agentId !== capabilities.agentId
    ) {
      throw new HostRpcError(-32_010, "INVALID_CAPABILITY_SNAPSHOT", "Agent runtime binding identity is invalid")
    }
    let runtimeBinding: AdapterRuntimeBinding
    if (rawBinding.kind === "executable") {
      let current: ExecutableFingerprint
      try {
        current = await fingerprintExecutable(rawBinding.executablePath, rawBinding.executableFingerprint.requested)
      } catch {
        throw new HostRpcError(-32_013, "EXECUTABLE_UNAVAILABLE", "The observed agent executable is unavailable")
      }
      if (!sameExecutable(current, rawBinding.executableFingerprint)) {
        throw new HostRpcError(
          -32_014,
          "EXECUTABLE_CHANGED",
          "The observed agent executable changed during capability discovery",
        )
      }
      runtimeBinding = { ...rawBinding, executablePath: current.canonicalPath, executableFingerprint: current }
    } else if (rawBinding.kind === "managed-in-process") {
      if (!rawBinding.runtimeId.trim()) {
        throw new HostRpcError(-32_010, "INVALID_CAPABILITY_SNAPSHOT", "Managed runtime identity is invalid")
      }
      runtimeBinding = structuredClone(rawBinding)
    } else if (rawBinding.kind === "unavailable") {
      runtimeBinding = structuredClone(rawBinding)
    } else {
      throw new HostRpcError(-32_010, "INVALID_CAPABILITY_SNAPSHOT", "Agent runtime binding kind is invalid")
    }
    if (capabilities.detected && runtimeBinding.kind === "unavailable") {
      throw new HostRpcError(-32_010, "INVALID_CAPABILITY_SNAPSHOT", "Detected agent has no usable local runtime binding")
    }
    return { capabilities: structuredClone(capabilities), runtimeBinding }
  }

  static parse(line: string): HostRequest {
    let raw: unknown
    try {
      raw = JSON.parse(line)
    } catch {
      throw new HostRpcError(-32_700, "PARSE_ERROR", "Invalid JSON")
    }
    return EngineHost.validateRequest(raw)
  }

  static validateRequest(rawRequest: unknown): HostRequest {
    let serialized: string
    try {
      serialized = JSON.stringify(rawRequest)
    } catch {
      throw new HostRpcError(-32_600, "INVALID_REQUEST", "Invalid JSON-RPC 2.0 request")
    }
    if (Buffer.byteLength(serialized) > MAX_RPC_FRAME_BYTES) {
      throw new HostRpcError(-32_001, "FRAME_TOO_LARGE", "JSON-RPC request exceeds the configured byte limit")
    }

    let envelope: z.infer<typeof requestEnvelopeSchema>
    try {
      envelope = requestEnvelopeSchema.parse(rawRequest)
    } catch (error) {
      throw new HostRpcError(
        -32_600,
        "INVALID_REQUEST",
        "Invalid JSON-RPC 2.0 request",
        error instanceof ZodError
          ? { issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) }
          : undefined,
      )
    }
    if (!hostMethodSchema.safeParse(envelope.method).success) {
      throw new HostRpcError(-32_601, "METHOD_NOT_FOUND", "Unknown GAEP engine method")
    }
    try {
      return hostRequestSchema.parse(envelope)
    } catch (error) {
      if (error instanceof ZodError && error.issues.every((issue) => issue.path[0] === "params")) {
        throw invalidParamsError(error)
      }
      throw new HostRpcError(-32_600, "INVALID_REQUEST", "Invalid JSON-RPC 2.0 request")
    }
  }
}
