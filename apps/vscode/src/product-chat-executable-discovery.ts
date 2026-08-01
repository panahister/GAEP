import { lstat } from "node:fs/promises"

import { findExecutable } from "@gaep/agent-sdk"

export function knownCodexDesktopCandidates(platform: NodeJS.Platform): string[] {
  return platform === "darwin"
    ? ["/Applications/ChatGPT.app/Contents/Resources/codex"]
    : []
}

async function regularExecutableCandidate(path: string): Promise<boolean> {
  try {
    const stat = await lstat(path)
    return stat.isFile() && !stat.isSymbolicLink()
  } catch {
    return false
  }
}

export interface CodexExecutableDiscoveryDependencies {
  findOnPath(name: string): Promise<string | null | undefined>
  isRegularExecutable(path: string): Promise<boolean>
}

const defaultDependencies: CodexExecutableDiscoveryDependencies = {
  findOnPath: findExecutable,
  isRegularExecutable: regularExecutableCandidate,
}

export async function resolveCodexExecutablePreference(
  configured: string,
  platform: NodeJS.Platform = process.platform,
  dependencies: CodexExecutableDiscoveryDependencies = defaultDependencies,
): Promise<{ executable: string; source: "configured" | "path" | "chatgpt-desktop" | "unresolved" }> {
  if (configured.trim() && configured !== "codex") {
    return { executable: configured, source: "configured" }
  }
  const onPath = await dependencies.findOnPath("codex")
  if (onPath) return { executable: onPath, source: "path" }
  for (const candidate of knownCodexDesktopCandidates(platform)) {
    if (await dependencies.isRegularExecutable(candidate)) {
      return { executable: candidate, source: "chatgpt-desktop" }
    }
  }
  return { executable: "codex", source: "unresolved" }
}
