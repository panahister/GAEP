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

const executionStopLine = "Claude Code CLI execution is unavailable until GAEP can enforce an outer workspace, process, network, and per-call effect boundary"

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
      "Claude permission mode is a provider control and never substitutes for a GAEP Authorization Grant.",
      `${executionStopLine}. Detection and selection remain available for capability review only.`,
      "Read, Glob, Grep, Edit, Write, and Bash cannot be proven exact-root bounded by the current CLI; Bash can also cross network and external-effect boundaries.",
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
      executionInterface: "unavailable",
      interfaceMaturity: "unknown",
      supportsResume: false,
      supportsCancel: false,
      supportsCheckpoints: false,
      supportsModelDiscovery: false,
      supportsToolSelection: true,
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
          key: "permissionMode",
          label: "Permission mode",
          description: "Claude Code's native permission behavior; GAEP authorization remains separate.",
          kind: "select",
          required: true,
          sensitive: false,
          defaultValue: "default",
          options: ["default", "plan"].map((value) => ({ value, label: value })),
          truthClass: "provider-declared",
        },
        {
          key: "allowedTools",
          label: "Allowed Claude tools",
          description: "Optional Claude Code tool allowlist.",
          kind: "string-list",
          required: false,
          sensitive: false,
          defaultValue: [],
          truthClass: "configured",
        },
        {
          key: "disallowedTools",
          label: "Denied Claude tools",
          description: "Optional Claude Code tool denylist.",
          kind: "string-list",
          required: false,
          sensitive: false,
          defaultValue: [],
          truthClass: "configured",
        },
        {
          key: "maxBudgetUsd",
          label: "Maximum budget (USD)",
          description: "Optional provider-side budget ceiling for the run.",
          kind: "number",
          required: false,
          sensitive: false,
          minimum: 0,
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
    const permissionModes = ["default", "plan"]
    if (!permissionModes.includes(String(selection.settings.permissionMode ?? "default"))) {
      errors.push("Unsupported Claude Code permission mode")
    }
    const allowedTools = Array.isArray(selection.settings.allowedTools)
      ? selection.settings.allowedTools.filter((item): item is string => typeof item === "string")
      : []
    const disallowedTools = new Set(Array.isArray(selection.settings.disallowedTools)
      ? selection.settings.disallowedTools.filter((item): item is string => typeof item === "string")
      : [])
    const overlap = allowedTools.filter((tool) => disallowedTools.has(tool))
    if (overlap.length > 0) {
      errors.push(`Claude tools cannot be both allowed and denied: ${overlap.join(", ")}`)
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
