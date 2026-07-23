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

const executionStopLine = "Direct Claude Code invocation through the adapter is unavailable; GAEP supports Claude only through the managed tool-free, context-only stream-JSON runtime"

const requiredManagedClaudeOptions = [
  "--print",
  "--output-format",
  "--verbose",
  "--no-session-persistence",
  "--setting-sources",
  "--strict-mcp-config",
  "--disable-slash-commands",
  "--no-chrome",
  "--tools",
  "--model",
  "--permission-mode",
] as const

function successfulCommand(result: Awaited<ReturnType<typeof runCommand>>): boolean {
  return result.exitCode === 0 && !result.timedOut && !result.outputExceeded
}

function missingOptions(help: string, required: readonly string[]): string[] {
  return required.filter((option) => !help.includes(option))
}

function advertisedEffortOptions(help: string): string[] {
  const marker = help.indexOf("--effort")
  if (marker < 0) return []
  const section = help.slice(marker, marker + 512)
  return ["low", "medium", "high", "xhigh", "max"].filter((value) =>
    new RegExp(`\\b${value}\\b`, "u").test(section))
}

function advertisedModelAliases(help: string): string[] {
  const marker = help.indexOf("--model")
  if (marker < 0) return []
  const section = help.slice(marker, marker + 1_024)
  return ["sonnet", "opus"].filter((value) => new RegExp(`\\b${value}\\b`, "iu").test(section))
}

export class ClaudeAdapter implements AgentAdapter {
  readonly id = "gaep.claude-code-cli"

  constructor(
    private readonly preferredExecutable = "claude",
    private readonly commandRunner: typeof runCommand = runCommand,
  ) {}

  async probe(options: AdapterProbeOptions = {}): Promise<AdapterProbeResult> {
    const executablePath = await findExecutable(this.preferredExecutable)
    let runtimeVersion: string | undefined
    let executableFingerprint: ExecutableFingerprint | undefined
    let detected = false
    let usable = false
    let helpText = ""
    let unavailableReason = "Claude executable was not found"
    const limitations: string[] = [
      "Detected means the executable was found, fingerprinted, and version-checked. The execution interface is advertised only after required managed CLI options are separately verified; neither state proves authentication, account entitlement, provider reachability, or model availability.",
      "Probe-time verification checks the advertised CLI contract, not a live provider handshake; stream-protocol and provider failures remain fail-closed launch outcomes.",
      "The CLI does not expose a model-catalog command; GAEP can offer only aliases documented by the verified CLI or a manually entered identifier, neither of which proves account access.",
      "Managed Claude runs use a fresh empty directory, no built-in tools, no MCP, no user/project/local setting sources, no browser, no slash commands, and no session persistence.",
      "The managed runtime still makes a provider request using existing machine-local authentication and network access. Non-bare mode preserves normal OAuth/keychain behavior and does not prove that provider-managed system context, user memory, or other startup context is absent.",
      `${executionStopLine}.`,
      "Read, Glob, Grep, Edit, Write, Bash, effectful execution, and resume are not exposed by this capability snapshot.",
    ]
    if (executablePath) {
      try {
        executableFingerprint = await fingerprintExecutable(executablePath, this.preferredExecutable)
        const version = await this.commandRunner(executablePath, ["--version"], { timeoutMs: options.timeoutMs })
        runtimeVersion = firstVersionToken(`${version.stdout}\n${version.stderr}`)
        if (!successfulCommand(version) || runtimeVersion === undefined) {
          unavailableReason = "Claude version verification failed"
          limitations.push("A Claude executable was found, but its version command did not complete successfully with a bounded version token; execution is disabled.")
        } else {
          detected = true
          const help = await this.commandRunner(executablePath, ["--help"], {
            timeoutMs: options.timeoutMs,
            maxOutputBytes: 2 * 1024 * 1024,
          })
          helpText = `${help.stdout}\n${help.stderr}`
          const missing = missingOptions(helpText, requiredManagedClaudeOptions)
          usable = successfulCommand(help) && missing.length === 0
          if (!usable) {
            unavailableReason = "Claude managed context-only interface verification failed"
            limitations.push(successfulCommand(help)
              ? `The detected Claude CLI does not advertise required managed options: ${missing.join(", ")}; execution is disabled.`
              : "The detected Claude CLI help command failed or exceeded its bounds; managed execution is disabled.")
          }
        }
      } catch {
        unavailableReason = "Claude executable fingerprint or interface verification failed"
        limitations.push("The detected Claude executable could not be fingerprinted or interface-verified safely; execution is disabled.")
      }
    }
    const settings: AdapterCapabilities["settings"] = []
    const effortOptions = usable ? advertisedEffortOptions(helpText) : []
    if (effortOptions.length > 0) {
      settings.push({
        key: "effort",
        label: "Effort",
        description: "Reasoning effort advertised by the verified Claude Code CLI; model support remains provider-controlled.",
        kind: "select",
        required: false,
        sensitive: false,
        options: effortOptions.map((value) => ({ value, label: value })),
        truthClass: "provider-declared",
      })
    }
    if (usable && helpText.includes("--max-budget-usd")) {
      settings.push({
        key: "maxBudgetUsd",
        label: "Maximum budget (USD)",
        description: "Optional provider-side budget ceiling advertised for non-interactive runs; it is not a GAEP cost guarantee.",
        kind: "number",
        required: false,
        sensitive: false,
        minimum: 0.01,
        maximum: 100_000,
        truthClass: "provider-declared",
      })
    }
    const capabilities = adapterCapabilitiesSnapshotSchema.parse({
      schemaVersion: 1,
      adapterId: this.id,
      adapterVersion: "0.1.0",
      agentId: "claude-code-cli",
      agentLabel: "Claude Code",
      runtimeVersion,
      detected,
      executionInterface: usable ? "cli-stream-json" : "unavailable",
      interfaceMaturity: usable ? "stable" : "unknown",
      supportsResume: false,
      supportsCancel: usable,
      supportsCheckpoints: false,
      supportsModelDiscovery: false,
      supportsToolSelection: false,
      settings,
      models: usable ? advertisedModelAliases(helpText).map((alias) => ({
        id: alias,
        label: `${alias[0]!.toUpperCase()}${alias.slice(1)} alias`,
        description: "Provider-managed alias documented by the verified CLI; account availability and the resolved immutable model revision are not verified.",
        reasoningOptions: [],
        inputModalities: ["text"],
        truthClass: "provider-declared" as const,
        alias: true,
      })) : [],
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
            reason: unavailableReason,
          },
    }
  }

  validateSelection(selection: AgentSelection, capabilities: AdapterCapabilities): string[] {
    const errors = validateSelectionBase(selection, capabilities)
    if (capabilities.executionInterface === "unavailable") {
      errors.push("Managed Claude context-only execution interface is unavailable")
    }
    const effort = selection.settings.effort
    if (capabilities.settings.some((setting) => setting.key === "effort") &&
        effort !== undefined && !["low", "medium", "high", "xhigh", "max"].includes(String(effort))) {
      errors.push("Unsupported managed Claude effort")
    }
    const maxBudgetUsd = selection.settings.maxBudgetUsd
    if (capabilities.settings.some((setting) => setting.key === "maxBudgetUsd") && maxBudgetUsd !== undefined &&
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
