import {
  adapterCapabilitiesSnapshotSchema,
  type AdapterCapabilities,
  type AgentSelection,
  type ExecutionCharter,
} from "@gaep/contracts"
import {
  findExecutable,
  fingerprintExecutable,
  firstVersionToken,
  runCommand,
  validateSelectionBase,
  type AgentAdapter,
  type AgentInvocation,
  type AdapterProbeOptions,
  type AdapterProbeResult,
  type AdapterRuntimeBinding,
  type ExecutableFingerprint,
} from "@gaep/agent-sdk"

const executionStopLine = "Effectful direct Claude Code execution is unavailable; GAEP supports only the managed tool-free, context-only stream-JSON runtime"

export class ClaudeAdapter implements AgentAdapter {
  readonly id = "gaep.claude-code-cli"

  constructor(private readonly preferredExecutable = "claude") {}

  async probe(options: AdapterProbeOptions = {}): Promise<AdapterProbeResult> {
    const executablePath = await findExecutable(this.preferredExecutable)
    let runtimeVersion: string | undefined
    let executableFingerprint: ExecutableFingerprint | undefined
    let usable = false
    const limitations: string[] = [
      "The installed CLI does not expose a model-catalog command; GAEP accepts provider aliases or an explicit model identifier.",
      "Managed Claude runs use a fresh empty directory, no tools, no MCP, no settings, no browser, no slash commands, and no session persistence.",
      `${executionStopLine}.`,
      "Read, Glob, Grep, Edit, Write, Bash, effectful execution, and resume are not exposed by this capability snapshot.",
    ]
    if (executablePath) {
      try {
        executableFingerprint = await fingerprintExecutable(executablePath, this.preferredExecutable)
        const result = await runCommand(executablePath, ["--version"], { timeoutMs: options.timeoutMs })
        runtimeVersion = firstVersionToken(`${result.stdout}\n${result.stderr}`)
        usable = result.exitCode === 0 && !result.timedOut && runtimeVersion !== undefined
        if (!usable) {
          limitations.push("A Claude executable was found, but its version command did not complete successfully; execution is disabled.")
        }
      } catch {
        limitations.push("The detected Claude executable could not be fingerprinted safely; execution is disabled.")
      }
    }
    const capabilities = adapterCapabilitiesSnapshotSchema.parse({
      schemaVersion: 1,
      adapterId: this.id,
      adapterVersion: "0.1.0",
      agentId: "claude-code-cli",
      agentLabel: "Claude Code",
      runtimeVersion,
      detected: usable,
      executionInterface: usable ? "cli-stream-json" : "unavailable",
      interfaceMaturity: usable ? "stable" : "unknown",
      supportsResume: false,
      supportsCancel: usable,
      supportsCheckpoints: false,
      supportsModelDiscovery: false,
      supportsToolSelection: false,
      settings: [
        {
          key: "effort",
          label: "Effort",
          description: "Reasoning effort for the Claude Code session.",
          kind: "select",
          required: false,
          sensitive: false,
          options: ["low", "medium", "high", "xhigh", "max"].map((value) => ({ value, label: value })),
          truthClass: "provider-declared",
        },
        {
          key: "maxBudgetUsd",
          label: "Maximum budget (USD)",
          description: "Optional provider-side budget ceiling for the run.",
          kind: "number",
          required: false,
          sensitive: false,
          minimum: 0.01,
          maximum: 100_000,
          truthClass: "configured",
        },
      ],
      models: [
        {
          id: "sonnet",
          label: "Sonnet alias",
          description: "Provider-managed alias accepted by the installed CLI.",
          reasoningOptions: ["low", "medium", "high", "xhigh", "max"],
          inputModalities: ["text"],
          truthClass: "provider-declared",
          alias: true,
        },
        {
          id: "opus",
          label: "Opus alias",
          description: "Provider-managed alias accepted by the installed CLI.",
          reasoningOptions: ["low", "medium", "high", "xhigh", "max"],
          inputModalities: ["text"],
          truthClass: "provider-declared",
          alias: true,
        },
      ],
      limitations,
      observedAt: new Date().toISOString(),
    })
    return {
      capabilities,
      runtimeBinding: usable && executablePath && executableFingerprint
        ? {
            scope: "machine-local",
            kind: "executable",
            adapterId: this.id,
            agentId: "claude-code-cli",
            executablePath,
            executableFingerprint,
          }
        : {
            scope: "machine-local",
            kind: "unavailable",
            adapterId: this.id,
            agentId: "claude-code-cli",
            reason: "Claude executable detection, fingerprinting, or version verification failed",
          },
    }
  }

  validateSelection(selection: AgentSelection, capabilities: AdapterCapabilities): string[] {
    const errors = validateSelectionBase(selection, capabilities)
    const effort = selection.settings.effort
    if (effort !== undefined && !["low", "medium", "high", "xhigh", "max"].includes(String(effort))) {
      errors.push("Unsupported managed Claude effort")
    }
    const maxBudgetUsd = selection.settings.maxBudgetUsd
    if (maxBudgetUsd !== undefined &&
        (typeof maxBudgetUsd !== "number" || !Number.isFinite(maxBudgetUsd) || maxBudgetUsd <= 0 || maxBudgetUsd > 100_000)) {
      errors.push("Managed Claude maximum budget must be greater than zero and at most 100000 USD")
    }
    return errors
  }

  buildInvocation(
    _selection: AgentSelection,
    _charter: ExecutionCharter,
    _workspacePath: string,
    _prompt: string,
    _runtimeBinding: AdapterRuntimeBinding,
  ): AgentInvocation {
    throw new Error(executionStopLine)
  }

  buildResumeInvocation(
    _selection: AgentSelection,
    _charter: ExecutionCharter,
    _workspacePath: string,
    _providerSessionId: string,
    _prompt: string,
    _runtimeBinding: AdapterRuntimeBinding,
  ): AgentInvocation {
    throw new Error(executionStopLine)
  }
}
