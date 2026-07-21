import type { AdapterCapabilities, AgentSelection, ExecutionCharter, ModelDescriptor } from "@gaep/contracts"
import {
  findExecutable,
  firstVersionToken,
  runCommand,
  validateSelectionBase,
  type AgentAdapter,
  type AgentInvocation,
  type AdapterProbeOptions,
} from "@gaep/agent-sdk"

interface RawCodexModel {
  slug?: unknown
  display_name?: unknown
  description?: unknown
  supported_reasoning_levels?: unknown
  context_window?: unknown
  input_modalities?: unknown
  visibility?: unknown
}

function parseModelCatalog(output: string): ModelDescriptor[] {
  const parsed = JSON.parse(output) as { models?: RawCodexModel[] }
  if (!Array.isArray(parsed.models)) return []
  return parsed.models.flatMap((model) => {
    if (typeof model.slug !== "string" || typeof model.display_name !== "string") return []
    if (model.visibility === "hide") return []
    const reasoningOptions = Array.isArray(model.supported_reasoning_levels)
      ? model.supported_reasoning_levels.flatMap((entry) => {
          if (entry && typeof entry === "object" && typeof (entry as { effort?: unknown }).effort === "string") {
            return [(entry as { effort: string }).effort]
          }
          return []
        })
      : []
    return [{
      id: model.slug,
      label: model.display_name,
      description: typeof model.description === "string" ? model.description : undefined,
      reasoningOptions,
      contextWindow: typeof model.context_window === "number" ? model.context_window : undefined,
      inputModalities: Array.isArray(model.input_modalities)
        ? model.input_modalities.filter((item): item is string => typeof item === "string")
        : ["text"],
      truthClass: "observed" as const,
      alias: false,
    }]
  })
}

export class CodexAdapter implements AgentAdapter {
  readonly id = "gaep.codex-cli"

  constructor(private readonly preferredExecutable = "codex") {}

  async probe(options: AdapterProbeOptions = {}): Promise<AdapterCapabilities> {
    const executablePath = await findExecutable(this.preferredExecutable)
    const limitations: string[] = [
      "GAEP uses stable codex exec JSONL for execution; app-server integration remains optional and experimental.",
      "A model alias or provider-hidden attribute is not an immutable model revision.",
    ]
    let runtimeVersion: string | undefined
    let models: ModelDescriptor[] = []
    if (executablePath) {
      const version = await runCommand(executablePath, ["--version"], { timeoutMs: options.timeoutMs })
      runtimeVersion = firstVersionToken(`${version.stdout}\n${version.stderr}`)
      if (options.refreshModels !== false) {
        const catalog = await runCommand(executablePath, ["debug", "models", "--bundled"], {
          timeoutMs: options.timeoutMs ?? 15_000,
          maxOutputBytes: 16 * 1024 * 1024,
        })
        if (catalog.exitCode === 0) {
          try {
            models = parseModelCatalog(catalog.stdout)
          } catch {
            limitations.push("The experimental bundled model catalog could not be parsed; enter a model identifier manually.")
          }
        } else {
          limitations.push("Model catalog discovery is unavailable; enter a model identifier supported by this Codex installation.")
        }
      }
    }

    return {
      adapterId: this.id,
      adapterVersion: "0.1.0",
      agentId: "codex-cli",
      agentLabel: "Codex",
      runtimeVersion,
      executablePath: executablePath ?? undefined,
      detected: executablePath !== null,
      executionInterface: executablePath ? "cli-jsonl" : "unavailable",
      interfaceMaturity: "stable",
      supportsResume: true,
      supportsCancel: true,
      supportsCheckpoints: true,
      supportsModelDiscovery: models.length > 0,
      supportsToolSelection: false,
      settings: [
        {
          key: "reasoningEffort",
          label: "Reasoning effort",
          description: "Reasoning effort passed through Codex configuration for this run.",
          kind: "select",
          required: false,
          sensitive: false,
          options: ["low", "medium", "high", "xhigh"].map((value) => ({ value, label: value })),
          truthClass: "provider-declared",
        },
        {
          key: "sandbox",
          label: "Sandbox",
          description: "Operating-system sandbox applied to model-generated commands.",
          kind: "select",
          required: true,
          sensitive: false,
          defaultValue: "workspace-write",
          options: ["read-only", "workspace-write", "danger-full-access"].map((value) => ({ value, label: value })),
          truthClass: "provider-declared",
        },
        {
          key: "approvalPolicy",
          label: "Command approvals",
          description: "When Codex requests approval before running commands.",
          kind: "select",
          required: true,
          sensitive: false,
          defaultValue: "on-request",
          options: ["untrusted", "on-request", "never"].map((value) => ({ value, label: value })),
          truthClass: "provider-declared",
        },
        {
          key: "search",
          label: "Live web search",
          description: "Allow Codex to use live web search for this run.",
          kind: "boolean",
          required: false,
          sensitive: false,
          defaultValue: false,
          truthClass: "provider-declared",
        },
        {
          key: "profile",
          label: "Codex profile",
          description: "Optional installed Codex configuration profile.",
          kind: "string",
          required: false,
          sensitive: false,
          truthClass: "configured",
        },
      ],
      models,
      limitations,
      observedAt: new Date().toISOString(),
    }
  }

  validateSelection(selection: AgentSelection, capabilities: AdapterCapabilities): string[] {
    const errors = validateSelectionBase(selection, capabilities)
    const allowedSandboxes = ["read-only", "workspace-write", "danger-full-access"]
    const allowedApprovals = ["untrusted", "on-request", "never"]
    if (!allowedSandboxes.includes(String(selection.settings.sandbox ?? "workspace-write"))) {
      errors.push("Unsupported Codex sandbox setting")
    }
    if (!allowedApprovals.includes(String(selection.settings.approvalPolicy ?? "on-request"))) {
      errors.push("Unsupported Codex approval policy")
    }
    const model = capabilities.models.find((candidate) => candidate.id === selection.modelId)
    const effort = selection.settings.reasoningEffort
    if (model && typeof effort === "string" && model.reasoningOptions.length > 0 && !model.reasoningOptions.includes(effort)) {
      errors.push(`Reasoning effort ${effort} is not advertised for model ${model.id}`)
    }
    return errors
  }

  buildInvocation(
    selection: AgentSelection,
    _charter: ExecutionCharter,
    workspacePath: string,
    prompt: string,
  ): AgentInvocation {
    const sandbox = String(selection.settings.sandbox ?? "workspace-write")
    const approval = String(selection.settings.approvalPolicy ?? "on-request")
    const args = ["exec", "--json", "--strict-config", "-C", workspacePath, "-m", selection.modelId, "-s", sandbox, "-a", approval]
    if (typeof selection.settings.reasoningEffort === "string") {
      args.push("-c", `model_reasoning_effort=${JSON.stringify(selection.settings.reasoningEffort)}`)
    }
    if (selection.settings.search === true) args.push("--search")
    if (typeof selection.settings.profile === "string" && selection.settings.profile.trim()) {
      args.push("--profile", selection.settings.profile.trim())
    }
    args.push(prompt)
    return {
      executable: selection.runtimeExecutable,
      args,
      cwd: workspacePath,
      environment: {},
      protocol: "jsonl",
      maturity: "stable",
      warnings: sandbox === "danger-full-access"
        ? ["Codex danger-full-access removes the operating-system sandbox; GAEP authorization still applies."]
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
      args: ["exec", "resume", providerSessionId, prompt],
      cwd: workspacePath,
      environment: {},
      protocol: "jsonl",
      maturity: "stable",
      warnings: ["Resume uses the provider session's prior configuration; GAEP records any configuration difference separately."],
    }
  }
}
