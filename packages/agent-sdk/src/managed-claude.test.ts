import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { createManagedClaudeAnalysisInvocation } from "./managed-claude.js"

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
      expect(managed.invocation.environmentPolicy!.allowedKeys).not.toContain("CODEX_HOME")
      await managed.cleanup()
      await expect(readdir(managed.invocation.cwd)).rejects.toMatchObject({ code: "ENOENT" })
    } finally {
      await rm(parent, { recursive: true, force: true })
    }
  })
})
