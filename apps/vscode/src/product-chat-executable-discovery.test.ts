import { describe, expect, it, vi } from "vitest"

import {
  knownCodexDesktopCandidates,
  resolveCodexExecutablePreference,
} from "./product-chat-executable-discovery.js"

describe("Product Chat Codex executable discovery", () => {
  it("preserves an explicit machine-scoped configuration", async () => {
    const findOnPath = vi.fn(async () => "/path/codex")
    const result = await resolveCodexExecutablePreference("/configured/codex", "darwin", {
      findOnPath,
      isRegularExecutable: async () => true,
    })
    expect(result).toEqual({ executable: "/configured/codex", source: "configured" })
    expect(findOnPath).not.toHaveBeenCalled()
  })

  it("prefers PATH before a known desktop-app candidate", async () => {
    const result = await resolveCodexExecutablePreference("codex", "darwin", {
      findOnPath: async () => "/opt/bin/codex",
      isRegularExecutable: async () => true,
    })
    expect(result).toEqual({ executable: "/opt/bin/codex", source: "path" })
  })

  it("discovers the official macOS ChatGPT desktop Codex binary without persisting its path", async () => {
    const [candidate] = knownCodexDesktopCandidates("darwin")
    const result = await resolveCodexExecutablePreference("codex", "darwin", {
      findOnPath: async () => undefined,
      isRegularExecutable: async (path) => path === candidate,
    })
    expect(result).toEqual({ executable: candidate, source: "chatgpt-desktop" })
  })

  it("keeps the unresolved command name so the adapter reports truthful unavailability", async () => {
    const result = await resolveCodexExecutablePreference("codex", "linux", {
      findOnPath: async () => undefined,
      isRegularExecutable: async () => false,
    })
    expect(result).toEqual({ executable: "codex", source: "unresolved" })
  })
})
