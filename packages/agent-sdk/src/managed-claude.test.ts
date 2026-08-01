import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { createManagedClaudeAnalysisInvocation, createManagedClaudeStagedInvocation } from "./managed-claude.js"

describe("managed Claude tool-free analysis", () => {
  it("uses an empty cwd and an exact no-tools, no-settings, no-browser argv", async () => {
    const parent = await mkdtemp(join(tmpdir(), "gaep-claude-parent-"))
    try {
      const managed = await createManagedClaudeAnalysisInvocation({
        executable: "/opt/claude/bin/claude",
        model: "sonnet",
        objective: "Review the supplied design",
        contextPack: "A path-free governed context pack",
        effort: "high",
        tempParent: parent,
      })
      expect(await readdir(managed.invocation.cwd)).toEqual([])
      expect(managed.invocation.args).toEqual([
        "--print",
        "--output-format", "stream-json",
        "--verbose",
        "--no-session-persistence",
        "--setting-sources", "",
        "--strict-mcp-config",
        "--disable-slash-commands",
        "--no-chrome",
        "--tools", "",
        "--model", "sonnet",
        "--permission-mode", "dontAsk",
        "--effort", "high",
      ])
      expect(managed.invocation.args).not.toContain("--bare")
      expect(managed.invocation.stdin).toContain("Context pack")
      expect(managed.invocation.args).not.toContain(managed.invocation.stdin)
      expect(managed.invocation.environment).not.toHaveProperty("ANTHROPIC_API_KEY")
      expect(managed.invocation.environmentPolicy).toBeDefined()
      expect(managed.invocation.environmentPolicy!.allowedKeys).toContain("CLAUDE_CONFIG_DIR")
      expect(managed.invocation.environmentPolicy!.allowedKeys).toContain("USER")
      expect(managed.invocation.environmentPolicy!.allowedKeys).toContain("LOGNAME")
      expect(managed.invocation.environmentPolicy!.allowedKeys).not.toContain("CODEX_HOME")
      await managed.cleanup()
      await expect(readdir(managed.invocation.cwd)).rejects.toMatchObject({ code: "ENOENT" })
    } finally {
      await rm(parent, { recursive: true, force: true })
    }
  })

  it("binds file Tools to an exact existing isolated stage without source-apply authority", async () => {
    const parent = await mkdtemp(join(tmpdir(), "gaep-claude-stage-parent-"))
    const stage = join(parent, "stage")
    await mkdir(stage, { mode: 0o700 })
    try {
      const managed = await createManagedClaudeStagedInvocation({
        executable: "/opt/claude/bin/claude",
        model: "sonnet",
        prompt: "Update the bounded fixture",
        stagingWorkspacePath: stage,
        effort: "high",
        maxTurns: 7,
      })
      expect(managed.invocation.cwd).toBe(stage)
      expect(managed.invocation.args).toEqual([
        "--print",
        "--output-format", "stream-json",
        "--verbose",
        "--no-session-persistence",
        "--bare",
        "--setting-sources", "",
        "--settings", "{\"disableAllHooks\":true,\"disableArtifact\":true,\"disableClaudeAiConnectors\":true,\"autoMemoryEnabled\":false}",
        "--strict-mcp-config",
        "--disable-slash-commands",
        "--no-chrome",
        "--tools", "Read,Glob,Grep,Edit,Write",
        "--allowedTools", "Read(./**),Edit(./**)",
        "--disallowedTools", "Bash,WebFetch,WebSearch,Agent,mcp__*",
        "--model", "sonnet",
        "--permission-mode", "dontAsk",
        "--max-turns", "7",
        "--effort", "high",
      ])
      expect(managed.invocation.args).not.toContain("--dangerously-skip-permissions")
      expect(managed.invocation.stdin).toContain("separate, exact human confirmation")
      expect(managed.invocation.args).not.toContain(managed.invocation.stdin)
      expect(managed.invocation.environment).not.toHaveProperty("ANTHROPIC_API_KEY")
      expect(managed.invocation.warnings).toContainEqual(expect.stringContaining("skips OAuth and keychain reads"))
      await managed.cleanup()
      expect(await readdir(stage)).toEqual([])
    } finally {
      await rm(parent, { recursive: true, force: true })
    }
  })
})
