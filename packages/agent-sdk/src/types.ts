import type { AdapterCapabilities, AgentSelection, ExecutionCharter } from "@gaep/contracts"

export interface AgentInvocation {
  executable: string
  args: string[]
  cwd: string
  environment: Record<string, string>
  protocol: "jsonl" | "stream-json"
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
}
