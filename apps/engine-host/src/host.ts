import { CodexAdapter } from "@gaep/adapter-codex"
import { ClaudeAdapter } from "@gaep/adapter-claude"
import {
  canonicalDigest,
  capabilityDigest,
  fingerprintExecutable,
  type AdapterProbeResult,
  type AdapterRuntimeBinding,
  type ExecutableFingerprint,
} from "@gaep/agent-sdk"
import {
  adapterCapabilitiesSnapshotSchema,
  hostHandoffPreviewResultSchema,
  hostLegacySelectionMigrationPreviewResultSchema,
  hostMethodSchema,
  hostRequestSchema,
  hostSelectionResultSchema,
  type AdapterCapabilities,
  type HostHandoffInput,
  type HostRequest,
  type Run,
} from "@gaep/contracts"
import {
  GaepEngine,
  handoffReviewDigest,
  legacySelectionStateDigest,
  type HandoffInput,
} from "@gaep/engine"
import { z, ZodError } from "zod"

import { HostRpcError, invalidParamsError, MAX_RPC_FRAME_BYTES, normalizeRpcError } from "./rpc.js"

const PROTOCOL_VERSION = 3
const SUPPORTED_PROTOCOL_VERSIONS = [1, 2, 3] as const
const v2OnlyMethods = new Set<HostRequest["method"]>([
  "workspaceHealth",
  "productStudio.designReadiness",
  "productStudio.search",
  "productStudio.exportBuild",
  "productStudio.importPreview",
])
const v3OnlyMethods = new Set<HostRequest["method"]>([
  "readSelection",
  "selectAgent",
  "previewLegacySelectionMigration",
  "migrateLegacySelection",
  "previewHandoff",
  "createHandoff",
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

function engineHandoffInput(handoff: HostHandoffInput, capabilities: AdapterCapabilities): HandoffInput {
  return {
    fromRunId: handoff.fromRunId,
    toCapabilities: structuredClone(capabilities),
    toModelId: handoff.toModelId,
    toSettings: handoff.toSettings,
    reason: handoff.reason,
    completedWork: handoff.completedWork,
    unresolvedMatters: handoff.unresolvedMatters,
    decisions: handoff.decisions,
    evidence: handoff.evidence,
  }
}

function throwLegacyMigrationHostError(error: unknown): never {
  const message = error instanceof Error ? error.message : ""
  if (/legacy Agent Selection changed after migration review|legacy selection.*changed|migration (?:preview )?requires an existing valid legacy Selection/iu.test(message)) {
    throw new HostRpcError(-32_017, "SELECTION_CHANGED", "The legacy Agent Selection changed; preview the migration again")
  }
  if (/migration preview.*changed|changed after.*migration preview|preview.*no longer matches|capabilities changed.*migration/iu.test(message)) {
    throw new HostRpcError(-32_024, "MIGRATION_PREVIEW_CHANGED", "The server-derived legacy migration preview changed; preview it again")
  }
  if (/dependent.*(?:Charter|Run|Handoff|history)|(?:Charter|Run|Handoff).*depend/iu.test(message)) {
    throw new HostRpcError(
      -32_025,
      "MIGRATION_DEPENDENT_HISTORY",
      "Legacy migration is blocked because governed Charter, Run, or Handoff history depends on the prior selection",
    )
  }
  if (/Legacy current setting .* is no longer declared|Legacy retained settings are incompatible with current capabilities/iu.test(message)) {
    throw new HostRpcError(
      -32_026,
      "CURRENT_SETTING_INCOMPATIBLE",
      "The legacy selection contains a current setting that cannot be preserved under the observed capabilities",
    )
  }
  if (/Legacy Agent Selection repository integrity is not current|dedicated reviewed integrity bootstrap/iu.test(message)) {
    throw new HostRpcError(
      -32_027,
      "MIGRATION_INTEGRITY_BOOTSTRAP_REQUIRED",
      "This pre-integrity legacy repository requires a separate reviewed integrity bootstrap before Agent Selection migration",
    )
  }
  if (/legacy Agent Selection capability snapshot is already portable|capability digest does not match the recognized historical capability snapshot/iu.test(message)) {
    throw new HostRpcError(
      -32_028,
      "LEGACY_CAPABILITY_BINDING_INVALID",
      "The legacy Agent Selection is not exactly bound to its recognized historical capability snapshot",
    )
  }
  throw error
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
    if (!SUPPORTED_PROTOCOL_VERSIONS.includes(requestProtocol as 1 | 2 | 3)) {
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
    if (requestProtocol < 3 && v3OnlyMethods.has(request.method)) {
      throw new HostRpcError(
        -32_021,
        "PROTOCOL_UPGRADE_REQUIRED",
        "This GAEP engine method requires protocol version 3",
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
      case "workspaceHealth":
        return this.engine.workspaceHealth()
      case "readProduct":
        return this.engine.readProduct()
      case "readSelection": {
        const compatibility = await this.engine.repository.readAgentSelectionCompatibility()
        if (compatibility.status === "current") {
          return hostSelectionResultSchema.parse({
            status: "current",
            selection: compatibility.selection,
            selectionDigest: canonicalDigest(compatibility.selection),
          })
        }
        if (compatibility.status === "migration-required") {
          return hostSelectionResultSchema.parse({
            status: "migration-required",
            portableCandidate: compatibility.portableCandidate,
            legacySelectionDigest: legacySelectionStateDigest(compatibility),
            capabilityReconfirmationRequired: true,
          })
        }
        throw new HostRpcError(-32_022, "SELECTION_INVALID", "The persisted Agent Selection is invalid")
      }
      case "createProduct":
        return this.engine.createProduct(request.params.product, actorId(request.params.actorId))
      case "createInitiative":
        return this.engine.createInitiative(request.params.initiative, actorId(request.params.actorId))
      case "selectAgent": {
        const snapshot = await this.observeAdapter(request.params.adapterId)
        try {
          const selection = await this.engine.selectAgent(
            structuredClone(snapshot.capabilities),
            request.params.modelId,
            request.params.settings,
            actorId(request.params.actorId),
            {
              expectedCurrentSelectionDigest: request.params.expectedCurrentSelectionDigest as `sha256:${string}` | null,
            },
          )
          this.selectedRuntimeBindings.set(request.params.adapterId, structuredClone(snapshot.runtimeBinding))
          return selection
        } catch (error) {
          const message = error instanceof Error ? error.message : ""
          if (/changed or was not explicitly bound|created while the mutation was being prepared/iu.test(message)) {
            throw new HostRpcError(-32_017, "SELECTION_CHANGED", "The current Agent Selection changed; read and confirm it again")
          }
          if (/work or staged review remains unresolved/iu.test(message)) {
            throw new HostRpcError(-32_018, "SELECTION_WORK_UNRESOLVED", "Resolve active work and staged reviews before rebinding or changing Agent Selection")
          }
          if (/requires an exact accepted handoff/iu.test(message)) {
            throw new HostRpcError(-32_019, "HANDOFF_REQUIRED", "This Agent Selection change requires an exact reviewed handoff")
          }
          throw error
        }
      }
      case "previewLegacySelectionMigration": {
        const snapshot = await this.observeAdapter(request.params.adapterId)
        try {
          return hostLegacySelectionMigrationPreviewResultSchema.parse(
            await this.engine.previewLegacyAgentSelectionMigration(structuredClone(snapshot.capabilities)),
          )
        } catch (error) {
          throwLegacyMigrationHostError(error)
        }
      }
      case "migrateLegacySelection": {
        const snapshot = await this.observeAdapter(request.params.adapterId)
        try {
          const selection = await this.engine.migrateLegacyAgentSelection({
            capabilities: structuredClone(snapshot.capabilities),
            decision: request.params.decision,
            expectedPreviewDigest: request.params.expectedPreviewDigest as `sha256:${string}`,
            expectedLegacySelectionDigest: request.params.expectedLegacySelectionDigest as `sha256:${string}`,
          }, actorId(request.params.actorId))
          this.selectedRuntimeBindings.set(request.params.adapterId, structuredClone(snapshot.runtimeBinding))
          return selection
        } catch (error) {
          throwLegacyMigrationHostError(error)
        }
      }
      case "createCharter":
        return this.engine.createCharter(request.params.charter, actorId(request.params.actorId))
      case "confirmCharter":
        return this.engine.confirmCharter(request.params.charterId, actorId(request.params.actorId))
      case "prepareRun": {
        const selection = await this.engine.readSelection()
        const selectedBinding = this.selectedRuntimeBindings.get(selection.adapterId)
        if (!selectedBinding) {
          throw new HostRpcError(
            -32_016,
            "RUNTIME_BINDING_MISSING",
            "No machine-local runtime is bound in this engine-host process; explicitly select the current agent and model again",
          )
        }
        const fresh = await this.observeAdapter(selection.adapterId)
        if (capabilityDigest(fresh.capabilities) !== selection.capabilityDigest) {
          throw new HostRpcError(
            -32_012,
            "CAPABILITIES_CHANGED",
            "Agent capabilities changed after selection; select the agent and model again",
          )
        }
        if (!sameRuntimeBinding(selectedBinding, fresh.runtimeBinding)) {
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
      case "previewHandoff": {
        const snapshot = await this.observeAdapter(request.params.handoff.toAdapterId)
        const input = engineHandoffInput(request.params.handoff, snapshot.capabilities)
        const handoff = await this.engine.previewHandoff(input)
        const sourceRun = (await this.engine.listRuns()).find((run) => run.id === handoff.fromRunId)
        if (!sourceRun) {
          throw new HostRpcError(-32_015, "HANDOFF_SOURCE_CHANGED", "The reviewed handoff source Run is no longer available")
        }
        return hostHandoffPreviewResultSchema.parse({
          handoff,
          decision: "accept-exact-handoff-preview" as const,
          expectedPreviewDigest: handoffReviewDigest(handoff),
          expectedCurrentSelectionDigest: canonicalDigest(sourceRun.agent),
        })
      }
      case "createHandoff": {
        const snapshot = await this.observeAdapter(request.params.handoff.toAdapterId)
        const handoff = await this.engine.createHandoff(
          engineHandoffInput(request.params.handoff, snapshot.capabilities),
          actorId(request.params.actorId),
          {
            decision: request.params.decision,
            expectedReviewDigest: request.params.expectedPreviewDigest as `sha256:${string}`,
            expectedCurrentSelectionDigest: request.params.expectedCurrentSelectionDigest as `sha256:${string}`,
            expectedHandoffId: request.params.expectedHandoffId,
            expectedCreatedAt: request.params.expectedHandoffCreatedAt,
          },
        )
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
    const requestProtocol = envelope.protocolVersion ?? 1
    if (!SUPPORTED_PROTOCOL_VERSIONS.includes(requestProtocol as 1 | 2 | 3)) {
      throw new HostRpcError(
        -32_020,
        "UNSUPPORTED_PROTOCOL_VERSION",
        `GAEP engine protocol ${requestProtocol} is unsupported`,
        { supportedProtocolVersions: [...SUPPORTED_PROTOCOL_VERSIONS] },
      )
    }
    const method = envelope.method as HostRequest["method"]
    if ((requestProtocol === 1 && v2OnlyMethods.has(method)) || (requestProtocol < 3 && v3OnlyMethods.has(method))) {
      throw new HostRpcError(
        -32_021,
        "PROTOCOL_UPGRADE_REQUIRED",
        `This GAEP engine method requires protocol version ${v3OnlyMethods.has(method) ? 3 : 2}`,
        { supportedProtocolVersions: [...SUPPORTED_PROTOCOL_VERSIONS] },
      )
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
