import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { createEngineHostRpc, sanitizeDiagnostic } from "./lib/engine_host_rpc.mjs"

let work
beforeEach(() => { work = mkdtempSync(join(tmpdir(), "gaep-rpc-")) })
afterEach(() => rmSync(work, { recursive: true, force: true }))

/** Write a fake Engine Host that behaves per `mode`, and return its path. */
function fakeHost(mode) {
  const path = join(work, `host-${mode}.mjs`)
  writeFileSync(path, `
    const mode = ${JSON.stringify(mode)}
    if (mode === "startup-fail") {
      process.stderr.write("boot failure at /Users/secret/x\\n"); process.exit(3)
    } else if (mode === "stubborn") {
      // Ignores stdin close and never exits gracefully — it can only be SIGKILLed.
      process.stderr.write("stuck at /Users/secret/creds.json token=abc123\\n"); setInterval(() => {}, 1000)
    } else {
      let buf = ""
      process.stdin.setEncoding("utf8")
      process.stdin.on("data", (c) => {
        buf += c
        let i = buf.indexOf("\\n")
        while (i >= 0) {
          const line = buf.slice(0, i); buf = buf.slice(i + 1)
          if (line.trim()) {
            const msg = JSON.parse(line)
            if (mode === "echo") process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { ok: msg.method } }) + "\\n")
            if (mode === "crash") { process.stderr.write("kaboom\\n"); process.exit(1) }
          }
          i = buf.indexOf("\\n")
        }
      })
      if (mode !== "silent") process.stdin.on("end", () => process.exit(0))
    }
  `)
  return path
}

const rpc = (mode, opts = {}) => createEngineHostRpc({ command: process.execPath, args: [fakeHost(mode)], requestTimeoutMs: 300, shutdownGraceMs: 300, forceExitTimeoutMs: 2000, ...opts })

describe("hardened Engine Host RPC client", () => {
  it("resolves a normal request over protocol v3", async () => {
    const client = rpc("echo")
    expect(await client.request("dashboardProjection")).toEqual({ ok: "dashboardProjection" })
    await client.close()
  })

  it("fails fast (does not hang) when the host exits on startup, with sanitized diagnostics only", async () => {
    const client = rpc("startup-fail")
    const message = await client.awaitReady().catch((e) => e.message)
    expect(message).toMatch(/Engine Host/)
    // No raw absolute path is ever exposed — only the sanitized diagnostic.
    expect(message).not.toContain("/Users/secret")
    expect(client.diagnostics()).not.toContain("/Users/secret")
    expect(client.diagnostics()).toContain("[redacted-path]")
  })

  it("times out a request the host never answers", async () => {
    const client = rpc("silent")
    await expect(client.request("readAnalysisRun")).rejects.toThrow(/timed out/)
    await client.close()
  })

  it("rejects in-flight requests when the host crashes mid-call", async () => {
    const client = rpc("crash")
    await expect(client.request("startReadOnlyAnalysis")).rejects.toThrow(/exited/)
  })

  it("closes gracefully: stdin end → awaited exit", async () => {
    const client = rpc("echo")
    await client.request("providerCatalog")
    const info = await client.close()
    expect(info.code).toBe(0)
  })

  it("forces a kill when the host ignores shutdown, WAITS for the confirmed exit, and cleans up pending requests", async () => {
    const client = rpc("stubborn")
    // A request that will never be answered; it must be rejected deterministically on shutdown.
    const pending = client.request("readAnalysisRun")
    const rejected = pending.then(() => "resolved", () => "rejected")
    const info = await client.close()
    // close() returned only after a CONFIRMED exit, and only SIGKILL could stop this host.
    expect(info.signal).toBe("SIGKILL")
    expect(client.exited).toBe(true)
    expect(await rejected).toBe("rejected")
    // No raw stderr / path / token is externally accessible — only sanitized diagnostics.
    expect(client.diagnostics()).not.toContain("/Users/secret")
    expect(client.diagnostics()).toContain("[redacted-path]")
  })
})

describe("sanitizeDiagnostic", () => {
  it("redacts absolute and home paths and bounds output", () => {
    expect(sanitizeDiagnostic("error at /Users/alice/secret.json now")).toContain("[redacted-path]")
    expect(sanitizeDiagnostic("C:\\\\Users\\\\bob\\\\x")).toContain("[redacted-path]")
    expect(sanitizeDiagnostic("a\nb\nc\nd\ne\nf\ng")).not.toContain("g")
  })
})
