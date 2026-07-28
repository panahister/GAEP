// GAEP-P0-CS02 — locate the installed IDE CLIs/apps deterministically WITHOUT PATH-only discovery.
// Priority: (1) explicit configured override env var; (2) standard `.app` locations; (3) application
// metadata (the app bundle exists); (4) PATH fallback. Pure and injectable so it is unit-testable.
import { existsSync } from "node:fs"
import { execFileSync } from "node:child_process"

const OVERRIDES = {
  vscode: "GAEP_VSCODE_CLI",
  kiro: "GAEP_KIRO_CLI",
  rider: "GAEP_RIDER_APP",
  jbr: "GAEP_RIDER_JBR",
}

// Standard macOS locations. VS Code / Kiro expose an embedded `code`/`kiro` CLI; Rider is an app dir
// with a bundled JetBrains Runtime used to run gradle.
const MACOS = {
  vscode: { app: "/Applications/Visual Studio Code.app", cli: "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" },
  kiro: { app: "/Applications/Kiro.app", cli: "/Applications/Kiro.app/Contents/Resources/app/bin/code" },
  rider: { app: "/Applications/Rider.app", cli: "/Applications/Rider.app" },
  jbr: { app: "/Applications/Rider.app/Contents/jbr/Contents/Home", cli: "/Applications/Rider.app/Contents/jbr/Contents/Home" },
}

const PATH_BIN = { vscode: "code", kiro: "kiro", rider: "rider", jbr: "java" }

function whichOnPath(bin, which) {
  try { return (which ?? ((b) => execFileSync("which", [b], { encoding: "utf8" }).trim()))(bin) || undefined }
  catch { return undefined }
}

/**
 * Resolve one IDE/runtime. Returns { kind, source, path } where source is
 * "override" | "app" | "metadata" | "path" | "not-found".
 */
export function resolveIde(kind, options = {}) {
  const { env = process.env, platform = process.platform, exists = existsSync, which } = options
  const overrideKey = OVERRIDES[kind]
  const override = overrideKey ? env[overrideKey] : undefined
  if (override && exists(override)) return { kind, source: "override", path: override }

  if (platform === "darwin") {
    const std = MACOS[kind]
    if (std) {
      if (exists(std.cli)) return { kind, source: "app", path: std.cli }
      // Metadata: the .app bundle exists even if the embedded CLI path differs by version.
      if (exists(std.app)) return { kind, source: "metadata", path: std.app }
    }
  }

  const onPath = whichOnPath(PATH_BIN[kind], which)
  if (onPath) return { kind, source: "path", path: onPath }
  return { kind, source: "not-found", path: undefined }
}

export const IDE_OVERRIDE_KEYS = OVERRIDES
