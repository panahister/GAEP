import type { AdapterCapabilities, AgentSelection, ExecutionCharter } from "@gaep/contracts"

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

export interface AgentAdapter {
  readonly id: string
  probe(options?: AdapterProbeOptions): Promise<AdapterCapabilities>
  validateSelection(selection: AgentSelection, capabilities: AdapterCapabilities): string[]
  buildInvocation(
    selection: AgentSelection,
    charter: ExecutionCharter,
    workspacePath: string,
    prompt: string,
  ): AgentInvocation
  buildResumeInvocation?(
    selection: AgentSelection,
    charter: ExecutionCharter,
    workspacePath: string,
    providerSessionId: string,
    prompt: string,
  ): AgentInvocation
}

export interface CommandResult {
  exitCode: number | null
  stdout: string
  stderr: string
  timedOut: boolean
  outputExceeded: boolean
}
