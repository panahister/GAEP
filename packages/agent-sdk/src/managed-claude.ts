import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

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
}

export interface ManagedClaudeAnalysisInvocation {
  invocation: AgentInvocation
  cleanup(): Promise<void>
}

export async function createManagedClaudeAnalysisInvocation(
  request: ManagedClaudeAnalysisRequest,
): Promise<ManagedClaudeAnalysisInvocation> {
  if (!request.executable.trim()) throw new Error("A Claude executable path is required")
  if (!request.model.trim()) throw new Error("A Claude model identifier is required")
  if (!request.objective.trim()) throw new Error("A non-empty analysis objective is required")
  if (!request.contextPack.trim()) throw new Error("A non-empty governed context pack is required")
  if (request.maxBudgetUsd !== undefined &&
      (!Number.isFinite(request.maxBudgetUsd) || request.maxBudgetUsd <= 0 || request.maxBudgetUsd > 100_000)) {
    throw new Error("Managed Claude maximum budget must be greater than zero and at most 100000 USD")
  }
  const cwd = await mkdtemp(join(request.tempParent ?? tmpdir(), "gaep-claude-analysis-"))
  let cleaned = false
  if (request.executableArguments?.some((argument) => typeof argument !== "string" || Buffer.byteLength(argument) > 16 * 1_024)) {
    throw new Error("Managed Claude executable argument prefixes must be bounded strings")
  }
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
  ]
  if (request.effort) args.push("--effort", request.effort)
  if (request.maxBudgetUsd !== undefined) args.push("--max-budget-usd", String(request.maxBudgetUsd))
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
