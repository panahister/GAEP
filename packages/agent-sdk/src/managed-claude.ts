import { lstat, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { isAbsolute, join } from "node:path"

import { DEFAULT_CHILD_ENVIRONMENT_KEYS, filterChildEnvironment } from "./process.js"
import type { AgentInvocation } from "./types.js"

export interface ManagedClaudeAnalysisRequest {
  executable: string
  /** Local test/wrapper prefix placed before Claude CLI arguments; never persisted. */
  executableArguments?: string[]
  model: string
  objective: string
  contextPack: string
  effort?: "low" | "medium" | "high" | "xhigh" | "max"
  maxBudgetUsd?: number
  tempParent?: string
  jsonSchema?: object
}

export interface ManagedClaudeAnalysisInvocation {
  invocation: AgentInvocation
  cleanup(): Promise<void>
}

export interface ManagedClaudeStagedInvocationRequest {
  executable: string
  /** Local test/wrapper prefix placed before Claude CLI arguments; never persisted. */
  executableArguments?: string[]
  model: string
  prompt: string
  stagingWorkspacePath: string
  effort?: "low" | "medium" | "high" | "xhigh" | "max"
  maxBudgetUsd?: number
  maxTurns?: number
}

const stagedFileTools = "Read,Glob,Grep,Edit,Write"
const stagedAllowedTools = "Read(./**),Edit(./**)"
const stagedDeniedTools = "Bash,WebFetch,WebSearch,Agent,mcp__*"
const stagedSettings = JSON.stringify({
  disableAllHooks: true,
  disableArtifact: true,
  disableClaudeAiConnectors: true,
  autoMemoryEnabled: false,
})

function assertCommonRequest(request: {
  executable: string
  executableArguments?: string[]
  model: string
  effort?: string
  maxBudgetUsd?: number
}): void {
  if (!request.executable.trim()) throw new Error("A Claude executable path is required")
  if (Buffer.byteLength(request.executable) > 16 * 1_024) throw new Error("Claude executable path exceeds its configured bound")
  if (!request.model.trim()) throw new Error("A Claude model identifier is required")
  if (Buffer.byteLength(request.model) > 1_024) throw new Error("Claude model identifier exceeds its configured bound")
  if (request.maxBudgetUsd !== undefined &&
      (!Number.isFinite(request.maxBudgetUsd) || request.maxBudgetUsd <= 0 || request.maxBudgetUsd > 100_000)) {
    throw new Error("Managed Claude maximum budget must be greater than zero and at most 100000 USD")
  }
  if ((request.executableArguments?.length ?? 0) > 16 ||
      request.executableArguments?.some((argument) => typeof argument !== "string" || Buffer.byteLength(argument) > 16 * 1_024) ||
      Buffer.byteLength((request.executableArguments ?? []).join("")) > 64 * 1_024) {
    throw new Error("Managed Claude executable argument prefixes must be bounded strings")
  }
}

function optionalClaudeArguments(request: {
  effort?: "low" | "medium" | "high" | "xhigh" | "max"
  maxBudgetUsd?: number
}): string[] {
  const args: string[] = []
  if (request.effort) args.push("--effort", request.effort)
  if (request.maxBudgetUsd !== undefined) args.push("--max-budget-usd", String(request.maxBudgetUsd))
  return args
}

export async function createManagedClaudeAnalysisInvocation(
  request: ManagedClaudeAnalysisRequest,
): Promise<ManagedClaudeAnalysisInvocation> {
  assertCommonRequest(request)
  if (!request.objective.trim()) throw new Error("A non-empty analysis objective is required")
  if (!request.contextPack.trim()) throw new Error("A non-empty governed context pack is required")
  if (Buffer.byteLength(request.objective) > 512 * 1_024 || Buffer.byteLength(request.contextPack) > 1_500_000) {
    throw new Error("Managed Claude analysis input exceeds its configured bound")
  }
  const cwd = await mkdtemp(join(request.tempParent ?? tmpdir(), "gaep-claude-analysis-"))
  const jsonSchema = request.jsonSchema === undefined ? undefined : JSON.stringify(request.jsonSchema)
  if (jsonSchema !== undefined && Buffer.byteLength(jsonSchema) > 512 * 1_024) {
    throw new Error("Managed Claude structured-output schema exceeds its configured bound")
  }
  let cleaned = false
  const args = [
    ...(request.executableArguments ?? []),
    "--print",
    "--output-format", "stream-json",
    "--verbose",
    "--no-session-persistence",
    "--setting-sources", "",
    "--strict-mcp-config",
    "--disable-slash-commands",
    "--no-chrome",
    "--tools", "",
    "--model", request.model,
    "--permission-mode", "dontAsk",
    ...(jsonSchema === undefined ? [] : ["--json-schema", jsonSchema]),
    ...optionalClaudeArguments(request),
  ]
  return {
    invocation: {
      executable: request.executable,
      args,
      cwd,
      stdin: [
        "GAEP managed tool-free analysis.",
        "Use only the governed context pack below. Do not request or claim filesystem, shell, browser, MCP, network, or external effects.",
        `Objective:\n${request.objective}`,
        `Context pack:\n${request.contextPack}`,
      ].join("\n\n"),
      inputMode: "text-once",
      environment: filterChildEnvironment(process.env, ["CLAUDE_CONFIG_DIR"]),
      environmentPolicy: { inherit: "allowlist", allowedKeys: [...DEFAULT_CHILD_ENVIRONMENT_KEYS, "CLAUDE_CONFIG_DIR"] },
      protocol: "stream-json",
      maturity: "stable",
      warnings: [
        "Managed Claude analysis has no built-in tools and runs from a fresh empty directory; effectful Claude execution remains unavailable.",
        "User/project/local setting sources, MCP configuration, slash commands, and browser integration are disabled without using --bare, preserving normal credential behavior.",
      ],
    },
    cleanup: async (): Promise<void> => {
      if (cleaned) return
      cleaned = true
      await rm(cwd, { recursive: true, force: true })
    },
  }
}

export async function createManagedClaudeStagedInvocation(
  request: ManagedClaudeStagedInvocationRequest,
): Promise<ManagedClaudeAnalysisInvocation> {
  assertCommonRequest(request)
  if (!request.prompt.trim()) throw new Error("A non-empty staged Claude prompt is required")
  if (Buffer.byteLength(request.prompt) > 2 * 1_024 * 1_024) {
    throw new Error("Managed Claude staged prompt exceeds its configured bound")
  }
  if (!isAbsolute(request.stagingWorkspacePath)) throw new Error("Managed Claude staging workspace must be absolute")
  const workspace = await lstat(request.stagingWorkspacePath)
  if (!workspace.isDirectory() || workspace.isSymbolicLink()) {
    throw new Error("Managed Claude staging workspace must be a regular directory")
  }
  const maxTurns = request.maxTurns ?? 32
  if (!Number.isSafeInteger(maxTurns) || maxTurns < 1 || maxTurns > 128) {
    throw new Error("Managed Claude maximum turns must be between 1 and 128")
  }
  return {
    invocation: {
      executable: request.executable,
      args: [
        ...(request.executableArguments ?? []),
        "--print",
        "--output-format", "stream-json",
        "--verbose",
        "--no-session-persistence",
        "--bare",
        "--setting-sources", "",
        "--settings", stagedSettings,
        "--strict-mcp-config",
        "--disable-slash-commands",
        "--no-chrome",
        "--tools", stagedFileTools,
        "--allowedTools", stagedAllowedTools,
        "--disallowedTools", stagedDeniedTools,
        "--model", request.model,
        "--permission-mode", "dontAsk",
        "--max-turns", String(maxTurns),
        ...optionalClaudeArguments(request),
      ],
      cwd: request.stagingWorkspacePath,
      stdin: [
        "GAEP managed isolated-stage execution.",
        "Read and edit only the current isolated staging workspace. Do not use shell, browser, web, MCP, subagents, external side effects, or files outside this directory.",
        "Source-workspace apply is a later, separate, exact human confirmation controlled by GAEP.",
        request.prompt,
      ].join("\n\n"),
      inputMode: "text-once",
      environment: filterChildEnvironment(process.env, ["CLAUDE_CONFIG_DIR"]),
      environmentPolicy: { inherit: "allowlist", allowedKeys: [...DEFAULT_CHILD_ENVIRONMENT_KEYS, "CLAUDE_CONFIG_DIR"] },
      protocol: "stream-json",
      maturity: "experimental",
      warnings: [
        "This invocation requests only Read, Glob, Grep, Edit, and Write with current-stage-only Read/Edit permission rules, while requesting that shell, web, subagent, MCP, discovered settings, hooks, connectors, browser, slash commands, auto-memory, artifacts, and session persistence remain unavailable.",
        "Bare mode skips OAuth and keychain reads. This launcher does not inject an Anthropic API key or apiKeyHelper; a later runtime binding must attest an explicit non-persisted authentication path before live Anthropic execution can be advertised.",
        "The provider request still requires network access; provider-managed context and higher-priority administrator policy behavior are not attested by this launcher.",
        "Staged output grants no source-workspace apply authority; exact review and a separate GAEP apply decision remain required.",
      ],
    },
    cleanup: async (): Promise<void> => {
      // The staged-review owner controls cleanup so review/apply/discard remains possible.
    },
  }
}
