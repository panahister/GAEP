import {
  adapterCapabilitiesSnapshotSchema,
  type AdapterCapabilities,
  type AgentSelection,
  type ExecutionCharter,
  type ModelDescriptor,
} from "@gaep/contracts"
import {
  DEFAULT_CHILD_ENVIRONMENT_KEYS,
  assertNoUnsupportedEffects,
  assertOnlySupportedPermissions,
  compileWorkspacePermission,
  filterChildEnvironment,
  findExecutable,
  fingerprintExecutable,
  firstVersionToken,
  requireExecutableRuntimeBinding,
  runCommand,
  requireExplicitWorkspacePermission,
  validateSelectionBase,
  type AgentAdapter,
  type AgentInvocation,
  type AdapterProbeOptions,
  type AdapterProbeResult,
  type AdapterRuntimeBinding,
  type ExecutableFingerprint,
} from "@gaep/agent-sdk"

const supportedCodexPermissions = [
  "read-workspace",
  "modify-workspace",
  "run-local-commands",
] as const

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

function compileCodexCharter(
  selection: AgentSelection,
  charter: ExecutionCharter,
  workspacePath: string,
): { sandbox: "read-only"; warnings: string[] } {
  assertNoUnsupportedEffects(charter, "Codex")
  assertOnlySupportedPermissions(charter, supportedCodexPermissions, "Codex")
  requireExplicitWorkspacePermission(charter, "read-workspace", workspacePath, "Codex")
  requireExplicitWorkspacePermission(charter, "run-local-commands", workspacePath, "Codex")

  const selectedSandbox = String(selection.settings.sandbox ?? "read-only")
  if (selectedSandbox !== "read-only") throw new Error("Current Codex CLI execution requires read-only sandbox")
  const modification = compileWorkspacePermission(charter, "modify-workspace", workspacePath)
  if (charter.permissions.some((permission) =>
    permission.capability === "modify-workspace" && permission.mode === "allow"
  )) {
    throw new Error("Current Codex CLI execution cannot enforce modify-workspace=allow without an isolated staging and effect mediator")
  }
  const mutationEffects = charter.expectedEffects.filter((effect) =>
    effect === "provisional" || effect === "reversible-change",
  )
  if (mutationEffects.length > 0) {
    throw new Error(
      `Current Codex CLI execution cannot enforce mutation effects without an isolated staging and effect mediator: ${mutationEffects.join(", ")}`,
    )
  }
  return {
    sandbox: "read-only",
    warnings: [
      `Effective Codex sandbox is read-only: the current CLI stop-line permits analysis only; ${modification.reason}; expected effects=${charter.expectedEffects.join(",") || "none"}.`,
      "Codex exec receives approval policy never because no interactive approval channel exists; denied operations fail closed and GAEP does not mediate each call.",
    ],
  }
}

export class CodexAdapter implements AgentAdapter {
  readonly id = "gaep.codex-cli"

  constructor(private readonly preferredExecutable = "codex") {}

  async probe(options: AdapterProbeOptions = {}): Promise<AdapterProbeResult> {
    const executablePath = await findExecutable(this.preferredExecutable)
    const limitations: string[] = [
      "Founder execution uses stable codex exec JSONL; rich-client approvals and event parity require a future migration to the experimental app-server transport.",
      "A model alias or provider-hidden attribute is not an immutable model revision.",
      "Live web search is not exposed because codex exec provides no per-call approval channel.",
      "Current Codex CLI execution is read-only analysis; workspace mutation requires a later isolated staging and effect mediator.",
    ]
    let runtimeVersion: string | undefined
    let executableFingerprint: ExecutableFingerprint | undefined
    let models: ModelDescriptor[] = []
    let usable = false
    if (executablePath) {
      try {
        executableFingerprint = await fingerprintExecutable(executablePath, this.preferredExecutable)
        const version = await runCommand(executablePath, ["--version"], { timeoutMs: options.timeoutMs })
        runtimeVersion = firstVersionToken(`${version.stdout}\n${version.stderr}`)
        usable = version.exitCode === 0 && !version.timedOut && runtimeVersion !== undefined
        if (!usable) {
          limitations.push("A Codex executable was found, but its version command did not complete successfully; execution is disabled.")
        }
        if (usable && options.refreshModels !== false) {
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
      } catch {
        limitations.push("The detected Codex executable could not be fingerprinted safely; execution is disabled.")
      }
    }

    const reasoningOptions = [...new Set(models.flatMap((model) => model.reasoningOptions))]
    const settings: AdapterCapabilities["settings"] = []
    if (reasoningOptions.length > 0) {
      settings.push({
        key: "reasoningEffort",
        label: "Reasoning effort",
        description: "Reasoning effort observed in the installed Codex model catalog.",
        kind: "select",
        required: false,
        sensitive: false,
        options: reasoningOptions.map((value) => ({ value, label: value })),
        truthClass: "observed",
      })
    }
    settings.push(
      {
        key: "sandbox",
        label: "Sandbox",
        description: "Read-only operating-system sandbox for the current analysis-only CLI stop-line.",
        kind: "select",
        required: true,
        sensitive: false,
        defaultValue: "read-only",
        options: [{ value: "read-only", label: "read-only" }],
        truthClass: "provider-declared",
      },
      {
        key: "approvalPolicy",
        label: "Command approvals",
        description: "Non-interactive execution fails denied operations closed instead of waiting for an unavailable approval channel.",
        kind: "select",
        required: true,
        sensitive: false,
        defaultValue: "fail-closed-noninteractive",
        options: [{ value: "fail-closed-noninteractive", label: "Fail closed (non-interactive)" }],
        truthClass: "configured",
      },
    )

    const capabilities = adapterCapabilitiesSnapshotSchema.parse({
      schemaVersion: 1,
      adapterId: this.id,
      adapterVersion: "0.1.0",
      agentId: "codex-cli",
      agentLabel: "Codex",
      runtimeVersion,
      detected: usable,
      executionInterface: usable ? "cli-jsonl" : "unavailable",
      interfaceMaturity: usable ? "stable" : "unknown",
      supportsResume: usable,
      supportsCancel: usable,
      supportsCheckpoints: false,
      supportsModelDiscovery: models.length > 0,
      supportsToolSelection: false,
      settings,
      models,
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
            agentId: "codex-cli",
            executablePath,
            executableFingerprint,
          }
        : {
            scope: "machine-local",
            kind: "unavailable",
            adapterId: this.id,
            agentId: "codex-cli",
            reason: "Codex executable detection, fingerprinting, or version verification failed",
          },
    }
  }

  validateSelection(selection: AgentSelection, capabilities: AdapterCapabilities): string[] {
    const errors = validateSelectionBase(selection, capabilities)
    const allowedSandboxes = ["read-only"]
    const allowedApprovals = ["fail-closed-noninteractive"]
    if (!allowedSandboxes.includes(String(selection.settings.sandbox ?? "read-only"))) {
      errors.push("Unsupported Codex sandbox setting")
    }
    if (!allowedApprovals.includes(String(selection.settings.approvalPolicy ?? "fail-closed-noninteractive"))) {
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
    charter: ExecutionCharter,
    workspacePath: string,
    prompt: string,
    runtimeBinding: AdapterRuntimeBinding,
  ): AgentInvocation {
    const runtime = requireExecutableRuntimeBinding(runtimeBinding, selection, "Codex")
    const compiled = compileCodexCharter(selection, charter, workspacePath)
    const approvalSetting = String(selection.settings.approvalPolicy ?? "fail-closed-noninteractive")
    if (approvalSetting !== "fail-closed-noninteractive") {
      throw new Error("Codex exec requires fail-closed non-interactive approvals")
    }
    if (selection.settings.search !== undefined) throw new Error("Codex live search is unavailable without a mediated approval channel")
    const args = ["--strict-config", "-C", workspacePath, "-m", selection.modelId, "-s", compiled.sandbox, "-a", "never"]
    if (typeof selection.settings.reasoningEffort === "string") {
      args.push("-c", `model_reasoning_effort=${JSON.stringify(selection.settings.reasoningEffort)}`)
    }
    args.push("exec", "--ignore-user-config", "--ignore-rules", "--color", "never", "--json", "-")
    return {
      executable: runtime.executablePath,
      args,
      cwd: workspacePath,
      stdin: prompt,
      inputMode: "text-once",
      environment: filterChildEnvironment(),
      environmentPolicy: { inherit: "allowlist", allowedKeys: [...DEFAULT_CHILD_ENVIRONMENT_KEYS] },
      protocol: "jsonl",
      maturity: "stable",
      warnings: compiled.warnings,
    }
  }

  buildResumeInvocation(
    _selection: AgentSelection,
    charter: ExecutionCharter,
    workspacePath: string,
    providerSessionId: string,
    prompt: string,
    runtimeBinding: AdapterRuntimeBinding,
  ): AgentInvocation {
    const runtime = requireExecutableRuntimeBinding(runtimeBinding, _selection, "Codex")
    const compiled = compileCodexCharter(_selection, charter, workspacePath)
    const approvalSetting = String(_selection.settings.approvalPolicy ?? "fail-closed-noninteractive")
    if (approvalSetting !== "fail-closed-noninteractive") {
      throw new Error("Codex exec requires fail-closed non-interactive approvals")
    }
    if (_selection.settings.search !== undefined) throw new Error("Codex live search is unavailable without a mediated approval channel")
    const args = [
      "--strict-config", "-C", workspacePath, "-m", _selection.modelId, "-s", compiled.sandbox, "-a", "never",
    ]
    if (typeof _selection.settings.reasoningEffort === "string") {
      args.push("-c", `model_reasoning_effort=${JSON.stringify(_selection.settings.reasoningEffort)}`)
    }
    args.push("exec", "resume", "--ignore-user-config", "--ignore-rules", "--json", providerSessionId, "-")
    return {
      executable: runtime.executablePath,
      args,
      cwd: workspacePath,
      stdin: prompt,
      inputMode: "text-once",
      environment: filterChildEnvironment(),
      environmentPolicy: { inherit: "allowlist", allowedKeys: [...DEFAULT_CHILD_ENVIRONMENT_KEYS] },
      protocol: "jsonl",
      maturity: "stable",
      warnings: [
        "Resume reuses provider conversation history; GAEP reapplies the selected model and compiled Charter boundary.",
        ...compiled.warnings,
      ],
    }
  }
}
