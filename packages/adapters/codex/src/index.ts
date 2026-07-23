import {
  adapterCapabilitiesSnapshotSchema,
  modelDescriptorSchema,
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

const requiredCodexRootOptions = [
  "app-server",
  "--strict-config",
  "--model",
  "--sandbox",
  "--cd",
  "--ask-for-approval",
] as const

const requiredCodexAppServerOptions = ["--strict-config", "--listen", "stdio://"] as const

const requiredDirectExecOptions = [
  "--ignore-user-config",
  "--ignore-rules",
  "--color",
  "--json",
] as const

const requiredDirectResumeOptions = [
  "--strict-config",
  "--model",
  "--ignore-user-config",
  "--ignore-rules",
  "--json",
] as const

function successfulCommand(result: Awaited<ReturnType<typeof runCommand>>): boolean {
  return result.exitCode === 0 && !result.timedOut && !result.outputExceeded
}

function missingOptions(help: string, required: readonly string[]): string[] {
  return required.filter((option) => !help.includes(option))
}

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
  const models: ModelDescriptor[] = []
  const seen = new Set<string>()
  for (const model of parsed.models.slice(0, 2_048)) {
    if (typeof model.slug !== "string" || typeof model.display_name !== "string") continue
    if (model.visibility === "hide" || seen.has(model.slug)) continue
    const reasoningOptions = Array.isArray(model.supported_reasoning_levels)
      ? model.supported_reasoning_levels.slice(0, 256).flatMap((entry) => {
          if (entry && typeof entry === "object" && typeof (entry as { effort?: unknown }).effort === "string") {
            return [(entry as { effort: string }).effort]
          }
          return []
        })
      : []
    const candidate = modelDescriptorSchema.safeParse({
      id: model.slug,
      label: model.display_name,
      description: typeof model.description === "string" ? model.description : undefined,
      reasoningOptions: [...new Set(reasoningOptions)],
      contextWindow: typeof model.context_window === "number" ? model.context_window : undefined,
      inputModalities: Array.isArray(model.input_modalities)
        ? [...new Set(model.input_modalities.slice(0, 64).filter((item): item is string => typeof item === "string"))]
        : ["text"],
      truthClass: "observed" as const,
      alias: false,
    })
    if (!candidate.success) continue
    seen.add(candidate.data.id)
    models.push(candidate.data)
    if (models.length >= 512) break
  }
  return models
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
  private verifiedDirectExecutableDigest: string | undefined

  constructor(
    private readonly preferredExecutable = "codex",
    private readonly commandRunner: typeof runCommand = runCommand,
  ) {}

  async probe(options: AdapterProbeOptions = {}): Promise<AdapterProbeResult> {
    const executablePath = await findExecutable(this.preferredExecutable)
    const limitations: string[] = [
      "Detected means the executable was found, fingerprinted, and version-checked. The managed execution interface and direct read-only fallback are verified and reported separately; none of these states proves authentication, account entitlement, provider reachability, or model availability.",
      "Probe-time verification checks the advertised CLI contract, not a live app-server v2 handshake; protocol or provider incompatibility remains a fail-closed managed-launch outcome.",
      "Managed execution uses the Codex app-server v2 stdio RPC transport with isolated staging and Charter-derived shell/file gates; maturity follows the probed CLI's own experimental marker.",
      "A model alias or provider-hidden attribute is not an immutable model revision.",
      "The bundled model catalog is an executable-supplied candidate catalog, not proof that the current account can access or route every listed model.",
      "Apps, remote plugins, MCP, collaboration, web search, memories, and goals are disabled for managed runs.",
      "Managed Tool Selection supports only exact gaep.codex-cli bindings for the intrinsic shell Tool and workspace-write capability; every other selected Tool fails closed.",
      "Provider threads can be resumed only while their machine-local identity remains in the current engine process; GAEP does not persist that identity.",
      "The legacy direct codex exec JSONL builder remains an explicitly read-only fallback, requires a fresh same-instance probe of the exact executable, and is not the interface described by this capability snapshot.",
    ]
    let runtimeVersion: string | undefined
    let executableFingerprint: ExecutableFingerprint | undefined
    let models: ModelDescriptor[] = []
    let detected = false
    let usable = false
    let managedExperimental = true
    let unavailableReason = "Codex executable was not found"
    this.verifiedDirectExecutableDigest = undefined
    if (executablePath) {
      try {
        executableFingerprint = await fingerprintExecutable(executablePath, this.preferredExecutable)
        const version = await this.commandRunner(executablePath, ["--version"], { timeoutMs: options.timeoutMs })
        runtimeVersion = firstVersionToken(`${version.stdout}\n${version.stderr}`)
        if (!successfulCommand(version) || runtimeVersion === undefined) {
          unavailableReason = "Codex version verification failed"
          limitations.push("A Codex executable was found, but its version command did not complete successfully with a bounded version token; execution is disabled.")
        } else {
          detected = true
          const [rootHelp, appServerHelp, execHelp, resumeHelp] = await Promise.all([
            this.commandRunner(executablePath, ["--help"], { timeoutMs: options.timeoutMs, maxOutputBytes: 2 * 1024 * 1024 }),
            this.commandRunner(executablePath, ["app-server", "--help"], { timeoutMs: options.timeoutMs, maxOutputBytes: 2 * 1024 * 1024 }),
            this.commandRunner(executablePath, ["exec", "--help"], { timeoutMs: options.timeoutMs, maxOutputBytes: 2 * 1024 * 1024 }),
            this.commandRunner(executablePath, ["exec", "resume", "--help"], { timeoutMs: options.timeoutMs, maxOutputBytes: 2 * 1024 * 1024 }),
          ])
          const rootHelpText = `${rootHelp.stdout}\n${rootHelp.stderr}`
          const appServerHelpText = `${appServerHelp.stdout}\n${appServerHelp.stderr}`
          const execHelpText = `${execHelp.stdout}\n${execHelp.stderr}`
          const resumeHelpText = `${resumeHelp.stdout}\n${resumeHelp.stderr}`
          const missingManaged = [
            ...missingOptions(rootHelpText, requiredCodexRootOptions),
            ...missingOptions(appServerHelpText, requiredCodexAppServerOptions),
          ]
          const missingDirect = [
            ...missingOptions(rootHelpText, requiredCodexRootOptions.filter((option) => option !== "app-server")),
            ...missingOptions(execHelpText, requiredDirectExecOptions),
            ...missingOptions(resumeHelpText, requiredDirectResumeOptions),
          ]
          usable = successfulCommand(rootHelp) && successfulCommand(appServerHelp) && missingManaged.length === 0
          managedExperimental = /\bexperimental\b/iu.test(`${rootHelpText}\n${appServerHelpText}`)
          if (!usable) {
            unavailableReason = "Codex managed app-server interface verification failed"
            limitations.push(
              successfulCommand(rootHelp) && successfulCommand(appServerHelp)
                ? `The detected Codex CLI does not advertise required managed options: ${[...new Set(missingManaged)].join(", ")}; execution is disabled.`
                : "The detected Codex CLI help or app-server help command failed or exceeded its bounds; managed execution is disabled.",
            )
          }
          if (successfulCommand(rootHelp) && successfulCommand(execHelp) && successfulCommand(resumeHelp) && missingDirect.length === 0) {
            this.verifiedDirectExecutableDigest = executableFingerprint.digest
          } else {
            limitations.push(
              successfulCommand(rootHelp) && successfulCommand(execHelp) && successfulCommand(resumeHelp)
                ? `The direct read-only fallback is disabled because required options are absent: ${[...new Set(missingDirect)].join(", ")}.`
                : "The direct read-only fallback is disabled because its help contract could not be verified.",
            )
          }
        }
        if (usable && options.refreshModels !== false) {
          const catalog = await this.commandRunner(executablePath, ["debug", "models", "--bundled"], {
            timeoutMs: options.timeoutMs ?? 15_000,
            maxOutputBytes: 16 * 1024 * 1024,
          })
          if (successfulCommand(catalog)) {
            try {
              models = parseModelCatalog(catalog.stdout)
              if (models.length === 0) limitations.push("The bundled model catalog contained no usable visible model entries; enter a model identifier manually.")
            } catch {
              limitations.push("The experimental bundled model catalog could not be parsed; enter a model identifier manually.")
            }
          } else {
            limitations.push("Model catalog discovery is unavailable; enter a model identifier supported by this Codex installation.")
          }
        }
      } catch {
        unavailableReason = "Codex executable fingerprint or interface verification failed"
        this.verifiedDirectExecutableDigest = undefined
        limitations.push("The detected Codex executable could not be fingerprinted or interface-verified safely; execution is disabled.")
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
    const capabilities = adapterCapabilitiesSnapshotSchema.parse({
      schemaVersion: 1,
      adapterId: this.id,
      adapterVersion: "0.1.0",
      agentId: "codex-cli",
      agentLabel: "Codex",
      runtimeVersion,
      detected,
      executionInterface: usable ? "stdio-rpc" : "unavailable",
      interfaceMaturity: usable ? (managedExperimental ? "experimental" : "unknown") : "unknown",
      supportsResume: usable,
      supportsCancel: usable,
      supportsCheckpoints: false,
      supportsModelDiscovery: models.length > 0,
      supportsToolSelection: usable,
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
            reason: unavailableReason,
          },
    }
  }

  validateSelection(selection: AgentSelection, capabilities: AdapterCapabilities): string[] {
    const errors = validateSelectionBase(selection, capabilities)
    if (capabilities.executionInterface === "unavailable") {
      errors.push("Managed Codex app-server execution interface is unavailable")
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
    this.requireVerifiedDirectFallback(runtime.executableFingerprint)
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
      environment: filterChildEnvironment(process.env, ["CODEX_HOME"]),
      environmentPolicy: { inherit: "allowlist", allowedKeys: [...DEFAULT_CHILD_ENVIRONMENT_KEYS, "CODEX_HOME"] },
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
    this.requireVerifiedDirectFallback(runtime.executableFingerprint)
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
      environment: filterChildEnvironment(process.env, ["CODEX_HOME"]),
      environmentPolicy: { inherit: "allowlist", allowedKeys: [...DEFAULT_CHILD_ENVIRONMENT_KEYS, "CODEX_HOME"] },
      protocol: "jsonl",
      maturity: "stable",
      warnings: [
        "Resume reuses provider conversation history; GAEP reapplies the selected model and compiled Charter boundary.",
        ...compiled.warnings,
      ],
    }
  }

  private requireVerifiedDirectFallback(fingerprint: ExecutableFingerprint): void {
    if (!this.verifiedDirectExecutableDigest || this.verifiedDirectExecutableDigest !== fingerprint.digest) {
      throw new Error("Codex direct read-only fallback requires a fresh probe that verified the exact executable and exec option contract")
    }
  }
}
