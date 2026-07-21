import type { AdapterCapabilities, AgentSelection, ExecutionCharter } from "@gaep/contracts"

import type { ExecutableFingerprint } from "./process.js"

export interface AgentInvocation {
  executable: string
  args: string[]
  cwd: string
  /** Initial prompt/input delivered through child stdin, never the process list. */
  stdin?: string
  /** Keeps the process contract extensible for a later bidirectional app-server transport. */
  inputMode?: "text-once" | "bidirectional-jsonl"
  environment: Record<string, string>
  /**
   * Callers must construct the child environment from this policy rather than
   * spreading the ambient IDE/host environment.
   */
  environmentPolicy?: {
    inherit: "allowlist"
    allowedKeys: string[]
  }
  protocol: "jsonl" | "stream-json" | "json-rpc"
  maturity: "stable" | "beta" | "experimental"
  warnings: string[]
}

export interface AdapterProbeOptions {
  refreshModels?: boolean
  timeoutMs?: number
}

interface AdapterRuntimeBindingBase {
  /** Explicitly prevents this object from being mistaken for portable repository state. */
  scope: "machine-local"
  adapterId: string
  agentId: string
}

export type AdapterRuntimeBinding =
  | (AdapterRuntimeBindingBase & {
      kind: "executable"
      executablePath: string
      executableFingerprint: ExecutableFingerprint
    })
  | (AdapterRuntimeBindingBase & {
      kind: "managed-in-process"
      runtimeId: string
    })
  | (AdapterRuntimeBindingBase & {
      kind: "unavailable"
      reason: string
    })

export interface AdapterProbeResult {
  /** Portable and repository-safe logical snapshot. */
  capabilities: AdapterCapabilities
  /** Host-only observation; never embed this in Selection, Charter, Run, or Handoff records. */
  runtimeBinding: AdapterRuntimeBinding
}

export interface AgentAdapter {
  readonly id: string
  probe(options?: AdapterProbeOptions): Promise<AdapterProbeResult>
  validateSelection(selection: AgentSelection, capabilities: AdapterCapabilities): string[]
  buildInvocation(
    selection: AgentSelection,
    charter: ExecutionCharter,
    workspacePath: string,
    prompt: string,
    runtimeBinding: AdapterRuntimeBinding,
  ): AgentInvocation
  buildResumeInvocation?(
    selection: AgentSelection,
    charter: ExecutionCharter,
    workspacePath: string,
    providerSessionId: string,
    prompt: string,
    runtimeBinding: AdapterRuntimeBinding,
  ): AgentInvocation
}

export interface CommandResult {
  exitCode: number | null
  stdout: string
  stderr: string
  timedOut: boolean
  outputExceeded: boolean
}
