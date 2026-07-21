import { CodexAdapter } from "@gaep/adapter-codex"
import { ClaudeAdapter } from "@gaep/adapter-claude"
import {
  capabilityDigest,
  fingerprintExecutable,
  type ExecutableFingerprint,
} from "@gaep/agent-sdk"
import {
  adapterCapabilitiesSchema,
  effectDescriptorSchema,
  hostRequestSchema,
  initiativeSchema,
  productSchema,
  toolPermissionSchema,
  type AdapterCapabilities,
  type HostRequest,
} from "@gaep/contracts"
import { GaepEngine } from "@gaep/engine"
import { z, ZodError } from "zod"

import { HostRpcError, invalidParamsError } from "./rpc.js"

const actorIdSchema = z.string().trim().min(1).max(256).optional()
const noParamsSchema = z.object({}).strict()
const productInputSchema = productSchema.pick({
  name: true,
  summary: true,
  problem: true,
  affectedUsers: true,
  desiredOutcome: true,
  successSignals: true,
  firstWorkflow: true,
  exclusions: true,
  profile: true,
}).strict()
const initiativeInputSchema = initiativeSchema.pick({
  title: true,
  outcome: true,
  scope: true,
  exclusions: true,
}).strict()
const capabilityReferenceSchema = z.object({ adapterId: z.string().min(1).max(200) }).passthrough()
const selectAgentParamsSchema = z.object({
  actorId: actorIdSchema,
  adapterId: z.string().min(1).max(200).optional(),
  capabilities: capabilityReferenceSchema.optional(),
  modelId: z.string().trim().min(1).max(500),
  settings: z.record(z.string(), z.unknown()).default({}),
}).strict().refine((value) => value.adapterId !== undefined || value.capabilities !== undefined, {
  message: "adapterId is required",
  path: ["adapterId"],
})
const createCharterParamsSchema = z.object({
  actorId: actorIdSchema,
  charter: z.object({
    initiativeId: z.string().uuid(),
    objective: z.string().trim().min(4).max(20_000),
    permissions: z.array(toolPermissionSchema).max(256),
    expectedEffects: z.array(effectDescriptorSchema).max(16),
    forbiddenActions: z.array(z.string().trim().min(1).max(2_000)).max(256),
    stopConditions: z.array(z.string().trim().min(1).max(2_000)).min(1).max(256),
    requiredEvidence: z.array(z.string().trim().min(1).max(2_000)).max(256),
  }).strict(),
}).strict()
const createHandoffParamsSchema = z.object({
  actorId: actorIdSchema,
  handoff: z.object({
    fromRunId: z.string().uuid(),
    toAdapterId: z.string().min(1).max(200).optional(),
    toCapabilities: capabilityReferenceSchema.optional(),
    toModelId: z.string().trim().min(1).max(500),
    toSettings: z.record(z.string(), z.unknown()).default({}),
    reason: z.string().trim().min(2).max(5_000),
    completedWork: z.array(z.string().trim().min(1).max(2_000)).max(256),
    unresolvedMatters: z.array(z.string().trim().min(1).max(2_000)).max(256),
    decisions: z.array(z.string().trim().min(1).max(2_000)).max(256),
    evidence: z.array(z.string().trim().min(1).max(2_000)).max(256),
  }).strict().refine((value) => value.toAdapterId !== undefined || value.toCapabilities !== undefined, {
    message: "toAdapterId is required",
    path: ["toAdapterId"],
  }),
}).strict()

const requestEnvelopeSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string().min(1).max(128), z.number().int().safe()]),
  method: z.string().min(1).max(128),
  params: z.record(z.string(), z.unknown()).default({}),
}).strict()

const hostMethods = new Set([
  "ping",
  "probeAgents",
  "readProduct",
  "createProduct",
  "createInitiative",
  "selectAgent",
  "createCharter",
  "confirmCharter",
  "prepareRun",
  "listRuns",
  "createHandoff",
  "verifyAudit",
])

interface CapabilitySnapshot {
  capabilities: AdapterCapabilities
  executable?: ExecutableFingerprint
}

function actorId(value: string | undefined): string {
  return value ?? "gaep.local-founder"
}

function parseParams<T>(schema: z.ZodType<T>, value: unknown): T {
  try {
    return schema.parse(value)
  } catch (error) {
    if (error instanceof ZodError) throw invalidParamsError(error)
    throw error
  }
}

export class EngineHost {
  readonly engine: GaepEngine
  private readonly recovery: Promise<unknown>
  private readonly capabilitySnapshots = new Map<string, CapabilitySnapshot>()

  constructor(workspacePath: string) {
    this.engine = new GaepEngine(workspacePath, [new CodexAdapter(), new ClaudeAdapter()])
    this.recovery = this.engine.recoverInterruptedRuns("gaep.engine-host")
  }

  async dispatch(rawRequest: unknown): Promise<unknown> {
    await this.recovery
    const request = EngineHost.validateRequest(rawRequest)

    switch (request.method) {
      case "ping":
        parseParams(noParamsSchema, request.params)
        return { engineVersion: "0.1.0", protocolVersion: 1 }
      case "probeAgents":
        parseParams(noParamsSchema, request.params)
        return this.refreshCapabilitySnapshots()
      case "readProduct":
        parseParams(noParamsSchema, request.params)
        return this.engine.readProduct()
      case "createProduct": {
        const params = parseParams(z.object({ actorId: actorIdSchema, product: productInputSchema }).strict(), request.params)
        return this.engine.createProduct(params.product, actorId(params.actorId))
      }
      case "createInitiative": {
        const params = parseParams(z.object({ actorId: actorIdSchema, initiative: initiativeInputSchema }).strict(), request.params)
        return this.engine.createInitiative(params.initiative, actorId(params.actorId))
      }
      case "selectAgent": {
        const params = parseParams(selectAgentParamsSchema, request.params)
        const adapterId = params.adapterId ?? params.capabilities!.adapterId
        const snapshot = await this.currentSnapshot(adapterId)
        return this.engine.selectAgent(
          structuredClone(snapshot.capabilities),
          params.modelId,
          params.settings,
          actorId(params.actorId),
        )
      }
      case "createCharter": {
        const params = parseParams(createCharterParamsSchema, request.params)
        return this.engine.createCharter(params.charter, actorId(params.actorId))
      }
      case "confirmCharter": {
        const params = parseParams(
          z.object({ actorId: actorIdSchema, charterId: z.string().uuid() }).strict(),
          request.params,
        )
        return this.engine.confirmCharter(params.charterId, actorId(params.actorId))
      }
      case "prepareRun": {
        const params = parseParams(
          z.object({ actorId: actorIdSchema, charterId: z.string().uuid() }).strict(),
          request.params,
        )
        const selection = await this.engine.readSelection()
        const snapshot = await this.currentSnapshot(selection.adapterId)
        if (capabilityDigest(snapshot.capabilities) !== selection.capabilityDigest) {
          throw new HostRpcError(
            -32_012,
            "CAPABILITIES_CHANGED",
            "Agent capabilities changed after selection; select the agent and model again",
          )
        }
        return this.engine.prepareRun(params.charterId, actorId(params.actorId))
      }
      case "listRuns":
        parseParams(noParamsSchema, request.params)
        return this.engine.listRuns()
      case "createHandoff": {
        const params = parseParams(createHandoffParamsSchema, request.params)
        const adapterId = params.handoff.toAdapterId ?? params.handoff.toCapabilities!.adapterId
        const snapshot = await this.currentSnapshot(adapterId)
        return this.engine.createHandoff({
          fromRunId: params.handoff.fromRunId,
          toCapabilities: structuredClone(snapshot.capabilities),
          toModelId: params.handoff.toModelId,
          toSettings: params.handoff.toSettings,
          reason: params.handoff.reason,
          completedWork: params.handoff.completedWork,
          unresolvedMatters: params.handoff.unresolvedMatters,
          decisions: params.handoff.decisions,
          evidence: params.handoff.evidence,
        }, actorId(params.actorId))
      }
      case "verifyAudit":
        parseParams(noParamsSchema, request.params)
        return this.engine.repository.verifyAudit()
    }
  }

  private async refreshCapabilitySnapshots(): Promise<AdapterCapabilities[]> {
    const probed = await this.engine.probeAgents()
    const next = new Map<string, CapabilitySnapshot>()
    for (const rawCapabilities of probed) {
      const capabilities = adapterCapabilitiesSchema.parse(rawCapabilities)
      let executable: ExecutableFingerprint | undefined
      if (capabilities.detected) {
        if (!capabilities.executablePath) {
          throw new HostRpcError(-32_010, "INVALID_CAPABILITY_SNAPSHOT", "Detected agent has no executable identity")
        }
        executable = await fingerprintExecutable(capabilities.executablePath)
      }
      next.set(capabilities.adapterId, { capabilities: structuredClone(capabilities), executable })
    }
    this.capabilitySnapshots.clear()
    for (const [adapterId, snapshot] of next) this.capabilitySnapshots.set(adapterId, snapshot)
    return [...next.values()].map((snapshot) => structuredClone(snapshot.capabilities))
  }

  private async currentSnapshot(adapterId: string): Promise<CapabilitySnapshot> {
    if (!this.capabilitySnapshots.has(adapterId)) await this.refreshCapabilitySnapshots()
    const snapshot = this.capabilitySnapshots.get(adapterId)
    if (!snapshot) {
      throw new HostRpcError(-32_011, "CAPABILITIES_NOT_AVAILABLE", `No host-observed capabilities exist for ${adapterId}`)
    }
    if (snapshot.executable) {
      let current: ExecutableFingerprint
      try {
        current = await fingerprintExecutable(snapshot.executable.canonicalPath)
      } catch {
        throw new HostRpcError(-32_013, "EXECUTABLE_UNAVAILABLE", "The selected agent executable is no longer available")
      }
      if (
        current.canonicalPath !== snapshot.executable.canonicalPath ||
        current.digest !== snapshot.executable.digest ||
        current.size !== snapshot.executable.size
      ) {
        throw new HostRpcError(
          -32_014,
          "EXECUTABLE_CHANGED",
          "The selected agent executable changed after capability discovery; probe and select it again",
        )
      }
    }
    return snapshot
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
    if (!hostMethods.has(envelope.method)) {
      throw new HostRpcError(-32_601, "METHOD_NOT_FOUND", "Unknown GAEP engine method")
    }
    return hostRequestSchema.parse(envelope)
  }
}
