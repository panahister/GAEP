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
import { GaepEngine } from "@gaep/engine"
import { z, ZodError } from "zod"

import {
  isPortableDesignHostMethod,
  parsePortableDesignHostRequest,
  portableDesignHostMethods,
  portableDesignProductContextError,
  portableDesignRpcError,
  portableDesignSnapshotDto,
  portableDesignSnapshotPageDto,
  type PortableDesignHostRequest,
} from "./portable-design-rpc.js"
import { HostRpcError, invalidParamsError, MAX_RPC_FRAME_BYTES, normalizeRpcError } from "./rpc.js"

const PROTOCOL_VERSION = 2
const SUPPORTED_PROTOCOL_VERSIONS = [1, 2] as const
type EngineHostRequest = HostRequest | PortableDesignHostRequest
type EngineHostMethod = EngineHostRequest["method"]

const v2OnlyMethods = new Set<EngineHostMethod>([
  "workspaceHealth",
  "readAgentSelection",
  "migrateLegacySelection",
  "productStudio.designReadiness",
  "productStudio.search",
  "productStudio.exportBuild",
  "productStudio.importPreview",
  ...portableDesignHostMethods,
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
    this.recovery = this.engine.recoverInterruptedRuns("gaep.engine-host")
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
    if (!SUPPORTED_PROTOCOL_VERSIONS.includes(requestProtocol as 1 | 2)) {
      throw new HostRpcError(
        -32_020,
        "UNSUPPORTED_PROTOCOL_VERSION",
        `GAEP engine protocol ${requestProtocol} is unsupported`,
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
      case "readAgentSelection":
        return this.engine.readSelectionState()
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
        const result = await this.engine.selectAgentGoverned(
          structuredClone(snapshot.capabilities),
          request.params.modelId,
          request.params.settings,
          actorId(request.params.actorId),
        )
        if (result.status === "blocked") {
          const blocked = {
            "active-run": [-32_015, "AGENT_SELECTION_ACTIVE_RUN", "Agent selection cannot change while a Run is non-terminal"],
            "capabilities-changed": [-32_012, "CAPABILITIES_CHANGED", "Agent capabilities changed during selection; probe again"],
            "migration-required": [-32_016, "AGENT_SELECTION_MIGRATION_REQUIRED", "The legacy Agent Selection requires explicit re-probe and reconfirmation"],
            "handoff-required": [-32_017, "AGENT_SELECTION_HANDOFF_REQUIRED", "A versioned handoff is required before changing agent, model, or settings after a Run"],
            "invalid-selection": [-32_018, "AGENT_SELECTION_INVALID", "The persisted Agent Selection is invalid and cannot be replaced implicitly"],
          } as const
          const [code, kind, message] = blocked[result.reason]
          throw new HostRpcError(code, kind, message)
        }
        this.selectedRuntimeBindings.set(request.params.adapterId, structuredClone(snapshot.runtimeBinding))
        return result.selection
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
        const handoff = await this.engine.createHandoff({
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
        this.selectedRuntimeBindings.set(request.params.handoff.toAdapterId, structuredClone(snapshot.runtimeBinding))
        return handoff
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
      case "productStudio.portableDesign.import": {
        let product: Awaited<ReturnType<GaepEngine["readProduct"]>>
        try {
          product = await this.engine.readProduct()
        } catch {
          throw portableDesignProductContextError()
        }
        if (
          product.id.toLowerCase() !== request.params.expectedProductId.toLowerCase()
          || (product.revision ?? 1) !== request.params.expectedProductRevision
        ) {
          throw portableDesignProductContextError()
        }
        try {
          const snapshot = await this.engine.productStudio.importPortableDesignSnapshot({
            bundleRoot: request.params.bundleRoot,
            expectedProductId: request.params.expectedProductId,
            expectedProductRevision: request.params.expectedProductRevision,
          }, request.params.actorId)
          return portableDesignSnapshotDto(snapshot)
        } catch (error) {
          throw portableDesignRpcError("import", error)
        }
      }
      case "productStudio.portableDesign.list":
        try {
          return portableDesignSnapshotPageDto(
            await this.engine.productStudio.listPortableDesignSnapshots(request.params),
          )
        } catch (error) {
          throw portableDesignRpcError("list", error)
        }
      case "productStudio.portableDesign.read":
        try {
          return portableDesignSnapshotDto(
            await this.engine.productStudio.readPortableDesignSnapshot(request.params.bundleId),
          )
        } catch (error) {
          throw portableDesignRpcError("read", error)
        }
    }
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

  static parse(line: string): EngineHostRequest {
    let raw: unknown
    try {
      raw = JSON.parse(line)
    } catch {
      throw new HostRpcError(-32_700, "PARSE_ERROR", "Invalid JSON")
    }
    return EngineHost.validateRequest(raw)
  }

  static validateRequest(rawRequest: unknown): EngineHostRequest {
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
    if (isPortableDesignHostMethod(envelope.method)) {
      return parsePortableDesignHostRequest(envelope)
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
