import {
  adapterCapabilitiesSnapshotSchema,
  type AdapterCapabilities,
  type AgentSelection,
  type ExecutionCharter,
} from "@gaep/contracts"

import { canonicalDigest } from "./digest.js"
import {
  BoundedAsyncQueue,
  type ManagedRunHandle,
  type ManagedPostconditionStatus,
  type ManagedRuntimeEvent,
  type ManagedRuntimeResultEnvelope,
  type ManagedTerminalDisposition,
  type UnsequencedManagedRuntimeEvent,
} from "./managed-runtime.js"
import type {
  AdapterProbeOptions,
  AdapterProbeResult,
  AdapterRuntimeBinding,
  AgentAdapter,
  AgentInvocation,
} from "./types.js"
import {
  capabilityDigest,
  requireManagedInProcessRuntimeBinding,
  validateSelectionBase,
} from "./validation.js"

export interface ManualScriptEvent {
  delayMs?: number
  event: UnsequencedManagedRuntimeEvent
}

export interface ManualAdapterScript {
  id: string
  threadId: string
  turnId: string
  events: ManualScriptEvent[]
  terminalDisposition: ManagedTerminalDisposition
  postconditionStatus: ManagedPostconditionStatus
  failureMessage?: string
  waitForCancellation?: boolean
  warnings?: string[]
}

export interface ManualRunRequest {
  scriptId: string
  resumeThreadId?: string
}

export const MANUAL_ADAPTER_FIXTURES: readonly ManualAdapterScript[] = [
  {
    id: "success",
    threadId: "manual-thread-success",
    turnId: "manual-turn-success",
    events: [
      { event: { type: "output-delta", channel: "assistant", text: "deterministic output" } },
      { event: { type: "item", itemId: "manual-item", itemType: "agentMessage", status: "completed" } },
    ],
    terminalDisposition: "completed",
    postconditionStatus: "satisfied",
  },
  {
    id: "failure",
    threadId: "manual-thread-failure",
    turnId: "manual-turn-failure",
    events: [{ event: { type: "warning", message: "scripted failure follows" } }],
    terminalDisposition: "failed",
    postconditionStatus: "failed",
    failureMessage: "deterministic scripted failure",
  },
  {
    id: "cancellation",
    threadId: "manual-thread-cancellation",
    turnId: "manual-turn-cancellation",
    events: [{ event: { type: "lifecycle", phase: "turn-started" } }],
    terminalDisposition: "cancelled",
    postconditionStatus: "not-assessed",
    waitForCancellation: true,
  },
  {
    id: "resume",
    threadId: "manual-thread-resume",
    turnId: "manual-turn-resume",
    events: [{ event: { type: "output-delta", channel: "assistant", text: "resumed deterministically" } }],
    terminalDisposition: "completed",
    postconditionStatus: "indeterminate",
  },
]

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export class DeterministicManualAdapter implements AgentAdapter {
  readonly id = "gaep.manual"
  private readonly scripts: Map<string, ManualAdapterScript>

  constructor(scripts: readonly ManualAdapterScript[] = MANUAL_ADAPTER_FIXTURES) {
    this.scripts = new Map(scripts.map((script) => [script.id, structuredClone(script)]))
    if (this.scripts.size !== scripts.length) throw new Error("Manual adapter script IDs must be unique")
  }

  async probe(_options: AdapterProbeOptions = {}): Promise<AdapterProbeResult> {
    const capabilities = adapterCapabilitiesSnapshotSchema.parse({
      schemaVersion: 1,
      adapterId: this.id,
      adapterVersion: "0.1.0",
      agentId: "manual",
      agentLabel: "Deterministic Manual Agent",
      runtimeVersion: "1",
      detected: true,
      executionInterface: "managed-in-process",
      interfaceMaturity: "stable",
      supportsResume: true,
      supportsCancel: true,
      supportsCheckpoints: true,
      supportsModelDiscovery: true,
      supportsToolSelection: false,
      settings: [{
        key: "script",
        label: "Deterministic script",
        description: "Offline scripted event/failure/cancellation fixture used by the managed runtime.",
        kind: "select",
        required: true,
        sensitive: false,
        defaultValue: "success",
        options: [...this.scripts.keys()].sort().map((value) => ({ value, label: value })),
        truthClass: "configured",
      }],
      models: [{
        id: "manual-deterministic-v1",
        label: "Deterministic Manual v1",
        description: "Offline deterministic model substitute; it never contacts a provider.",
        reasoningOptions: [],
        inputModalities: ["text"],
        truthClass: "configured",
        alias: false,
      }],
      limitations: [
        "This adapter has no executable path and can run only through the GAEP in-process managed-runtime contract.",
        "This offline deterministic rehearsal runtime cannot perform arbitrary implementation, provider, network, Tool, or workspace effects.",
      ],
      observedAt: new Date().toISOString(),
    })
    return {
      capabilities,
      runtimeBinding: {
        scope: "machine-local",
        kind: "managed-in-process",
        adapterId: this.id,
        agentId: "manual",
        runtimeId: this.id,
      },
    }
  }

  validateSelection(selection: AgentSelection, capabilities: AdapterCapabilities): string[] {
    const errors = validateSelectionBase(selection, capabilities)
    if (selection.adapterId !== this.id || selection.agentId !== "manual") errors.push("Manual adapter identity mismatch")
    if (selection.modelId !== "manual-deterministic-v1") errors.push("Unsupported deterministic manual model")
    if (selection.capabilityDigest !== capabilityDigest(capabilities)) errors.push("Manual adapter capabilities changed; select again")
    const script = selection.settings.script
    if (typeof script !== "string" || !this.scripts.has(script)) errors.push("Unknown deterministic manual script")
    for (const key of Object.keys(selection.settings)) {
      if (key !== "script") errors.push(`Unsupported manual adapter setting: ${key}`)
    }
    return errors
  }

  buildInvocation(
    _selection: AgentSelection,
    _charter: ExecutionCharter,
    _workspacePath: string,
    _prompt: string,
    runtimeBinding: AdapterRuntimeBinding,
  ): AgentInvocation {
    requireManagedInProcessRuntimeBinding(runtimeBinding, _selection, this.id, "Deterministic manual adapter")
    throw new Error("Deterministic manual execution requires the in-process managed-runtime contract")
  }

  buildResumeInvocation(
    _selection: AgentSelection,
    _charter: ExecutionCharter,
    _workspacePath: string,
    _providerSessionId: string,
    _prompt: string,
    runtimeBinding: AdapterRuntimeBinding,
  ): AgentInvocation {
    requireManagedInProcessRuntimeBinding(runtimeBinding, _selection, this.id, "Deterministic manual adapter")
    throw new Error("Deterministic manual resume requires the in-process managed-runtime contract")
  }

  start(request: ManualRunRequest): ManagedRunHandle {
    const script = this.scripts.get(request.scriptId)
    if (!script) throw new Error(`Unknown manual adapter script: ${request.scriptId}`)
    if (request.resumeThreadId !== undefined && request.resumeThreadId !== script.threadId) {
      throw new Error("Manual resume thread does not match the scripted provider thread")
    }

    const queue = new BoundedAsyncQueue<ManagedRuntimeEvent>(256, 1024 * 1024)
    const collected: ManagedRuntimeEvent[] = []
    let sequence = 0
    let cancelled = false
    let releaseCancellation: (() => void) | undefined
    const cancellation = new Promise<void>((resolve) => {
      releaseCancellation = resolve
    })
    const observedAt = "2026-01-01T00:00:00.000Z"
    const emit = (event: ManualScriptEvent["event"]): void => {
      const normalized = {
        ...event,
        sequence: sequence++,
        observedAt,
        threadId: script.threadId,
        turnId: script.turnId,
      } as ManagedRuntimeEvent
      collected.push(normalized)
      queue.push(normalized)
    }

    const completion = (async (): Promise<ManagedRuntimeResultEnvelope> => {
      emit({
        type: "lifecycle",
        phase: request.resumeThreadId ? "thread-resumed" : "thread-started",
      })
      for (const scripted of script.events) {
        if (scripted.delayMs) await delay(scripted.delayMs)
        if (cancelled) break
        emit(scripted.event)
      }
      if (script.waitForCancellation && !cancelled) await cancellation
      const disposition = cancelled ? "cancelled" : script.terminalDisposition
      if (cancelled) emit({ type: "lifecycle", phase: "cancelled" })
      if (!cancelled && script.failureMessage) {
        emit({ type: "error", message: script.failureMessage, retryable: false })
      }
      queue.close()
      return {
        portable: {
          schemaVersion: 1,
          provider: { adapterId: "gaep.manual", agentId: "manual" },
          providerThreadId: script.threadId,
          providerTurnId: script.turnId,
          events: collected,
          terminalDisposition: disposition,
          warnings: [...(script.warnings ?? [])],
          postconditionStatus: script.postconditionStatus,
        },
        local: {},
      }
    })().catch((error: unknown) => {
      queue.fail(error instanceof Error ? error : new Error(String(error)))
      throw error
    })

    return {
      events: queue,
      completion,
      cancel: async (_reason?: string): Promise<void> => {
        if (cancelled) return
        cancelled = true
        releaseCancellation?.()
      },
    }
  }

  resume(scriptId: string, providerThreadId: string): ManagedRunHandle {
    return this.start({ scriptId, resumeThreadId: providerThreadId })
  }

  scriptDigest(scriptId: string): string {
    const script = this.scripts.get(scriptId)
    if (!script) throw new Error(`Unknown manual adapter script: ${scriptId}`)
    return canonicalDigest(script)
  }
}
