import type { AdapterCapabilities, AgentSelection, ExecutionCharter } from "@gaep/contracts"
import {
  findExecutable,
  firstVersionToken,
  runCommand,
  validateSelectionBase,
  type AgentAdapter,
  type AgentInvocation,
  type AdapterProbeOptions,
} from "@gaep/agent-sdk"

export class ClaudeAdapter implements AgentAdapter {
  readonly id = "gaep.claude-code-cli"

  constructor(private readonly preferredExecutable = "claude") {}

  async probe(options: AdapterProbeOptions = {}): Promise<AdapterCapabilities> {
    const executablePath = await findExecutable(this.preferredExecutable)
    let runtimeVersion: string | undefined
    if (executablePath) {
      const result = await runCommand(executablePath, ["--version"], { timeoutMs: options.timeoutMs })
      runtimeVersion = firstVersionToken(`${result.stdout}\n${result.stderr}`)
    }
    return {
      adapterId: this.id,
      adapterVersion: "0.1.0",
      agentId: "claude-code-cli",
      agentLabel: "Claude Code",
      runtimeVersion,
      executablePath: executablePath ?? undefined,
      detected: executablePath !== null,
      executionInterface: executablePath ? "cli-stream-json" : "unavailable",
      interfaceMaturity: "stable",
      supportsResume: true,
      supportsCancel: true,
      supportsCheckpoints: true,
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
          options: ["default", "acceptEdits", "auto", "dontAsk", "plan"].map((value) => ({ value, label: value })),
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
      limitations: [
        "The installed CLI does not expose a model-catalog command; GAEP accepts provider aliases or an explicit model identifier.",
        "Claude permission mode is a provider control and never substitutes for a GAEP Authorization Grant.",
      ],
      observedAt: new Date().toISOString(),
    }
  }

  validateSelection(selection: AgentSelection, capabilities: AdapterCapabilities): string[] {
    const errors = validateSelectionBase(selection, capabilities)
    const permissionModes = ["default", "acceptEdits", "auto", "dontAsk", "plan"]
    if (!permissionModes.includes(String(selection.settings.permissionMode ?? "default"))) {
      errors.push("Unsupported Claude Code permission mode")
    }
    if (selection.settings.maxBudgetUsd !== undefined) {
      const budget = Number(selection.settings.maxBudgetUsd)
      if (!Number.isFinite(budget) || budget < 0) errors.push("Claude Code budget must be a finite non-negative number")
    }
    return errors
  }

  buildInvocation(
    selection: AgentSelection,
    charter: ExecutionCharter,
    workspacePath: string,
    prompt: string,
  ): AgentInvocation {
    const permissionMode = String(selection.settings.permissionMode ?? "default")
    const args = [
      "--print",
      "--output-format", "stream-json",
      "--verbose",
      "--session-id", charter.id,
      "--model", selection.modelId,
      "--permission-mode", permissionMode,
    ]
    if (typeof selection.settings.effort === "string") args.push("--effort", selection.settings.effort)
    const allowedTools = Array.isArray(selection.settings.allowedTools)
      ? selection.settings.allowedTools.filter((item): item is string => typeof item === "string")
      : []
    const disallowedTools = Array.isArray(selection.settings.disallowedTools)
      ? selection.settings.disallowedTools.filter((item): item is string => typeof item === "string")
      : []
    if (allowedTools.length > 0) args.push("--allowedTools", allowedTools.join(","))
    if (disallowedTools.length > 0) args.push("--disallowedTools", disallowedTools.join(","))
    if (typeof selection.settings.maxBudgetUsd === "number") {
      args.push("--max-budget-usd", String(selection.settings.maxBudgetUsd))
    }
    args.push(prompt)
    return {
      executable: selection.runtimeExecutable,
      args,
      cwd: workspacePath,
      environment: {},
      protocol: "stream-json",
      maturity: "stable",
      warnings: permissionMode === "dontAsk"
        ? ["Claude Code will not request provider-native permissions; denied operations may fail immediately."]
        : [],
    }
  }

  buildResumeInvocation(
    _selection: AgentSelection,
    _charter: ExecutionCharter,
    workspacePath: string,
    providerSessionId: string,
    prompt: string,
  ): AgentInvocation {
    return {
      executable: _selection.runtimeExecutable,
      args: ["--print", "--output-format", "stream-json", "--verbose", "--resume", providerSessionId, prompt],
      cwd: workspacePath,
      environment: {},
      protocol: "stream-json",
      maturity: "stable",
      warnings: ["Resume uses the provider session's prior configuration; GAEP records any configuration difference separately."],
    }
  }
}
