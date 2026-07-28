import { describe, expect, it } from "vitest"

import { resolveIde } from "./lib/ide_discovery.mjs"

describe("macOS IDE discovery (override → app → metadata → PATH, not PATH-only)", () => {
  it("prefers an explicit configured override when it exists", () => {
    const r = resolveIde("vscode", {
      platform: "darwin",
      env: { GAEP_VSCODE_CLI: "/custom/code" },
      exists: (p) => p === "/custom/code",
    })
    expect(r).toEqual({ kind: "vscode", source: "override", path: "/custom/code" })
  })

  it("uses the standard .app embedded CLI when present", () => {
    const r = resolveIde("kiro", {
      platform: "darwin",
      env: {},
      exists: (p) => p === "/Applications/Kiro.app/Contents/Resources/app/bin/code",
      which: () => undefined,
    })
    expect(r.source).toBe("app")
    expect(r.path).toContain("Kiro.app")
  })

  it("falls back to app metadata (bundle exists) when the embedded CLI path differs", () => {
    const r = resolveIde("kiro", {
      platform: "darwin",
      env: {},
      exists: (p) => p === "/Applications/Kiro.app", // only the bundle exists, not the embedded CLI
      which: () => undefined,
    })
    expect(r.source).toBe("metadata")
    expect(r.path).toBe("/Applications/Kiro.app")
  })

  it("resolves Rider's bundled JBR for gradle builds", () => {
    const r = resolveIde("jbr", {
      platform: "darwin",
      env: {},
      exists: (p) => p === "/Applications/Rider.app/Contents/jbr/Contents/Home",
      which: () => undefined,
    })
    expect(r.source).toBe("app")
    expect(r.path).toContain("jbr/Contents/Home")
  })

  it("uses PATH only as a last resort", () => {
    const r = resolveIde("vscode", {
      platform: "linux",
      env: {},
      exists: () => false,
      which: (bin) => (bin === "code" ? "/usr/bin/code" : undefined),
    })
    expect(r).toEqual({ kind: "vscode", source: "path", path: "/usr/bin/code" })
  })

  it("reports not-found when nothing resolves", () => {
    const r = resolveIde("kiro", { platform: "linux", env: {}, exists: () => false, which: () => undefined })
    expect(r.source).toBe("not-found")
    expect(r.path).toBeUndefined()
  })
})
