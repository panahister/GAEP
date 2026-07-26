#!/usr/bin/env node
// GAEP-P0-CS02 — automated archive-content assertion + extracted-package Engine Host smoke test.
//
// 1) Asserts each VSIX contains its digest-verified Engine Host and no tests/maps/source.
// 2) Extracts the VS Code VSIX, launches the bundled Engine Host through Node, calls protocol-v3
//    dashboardProjection, and asserts a valid uninitialized projection is returned.
import { spawn, execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const outRoot = join(repoRoot, "dist", "phase0", "cs02")
const failures = []
const ok = (label, cond) => { console.log(`${cond ? "ok  " : "FAIL"} ${label}`); if (!cond) failures.push(label) }

function listVsix(vsix) {
  return execFileSync("unzip", ["-Z1", vsix], { encoding: "utf8" }).split("\n").filter(Boolean)
}

for (const [name, vsix] of [["vscode", "gaep-vscode-0.2.0.vsix"], ["kiro", "gaep-kiro-0.2.0.vsix"]]) {
  const path = join(outRoot, vsix)
  if (!existsSync(path)) { ok(`${name} vsix exists`, false); continue }
  const entries = listVsix(path)
  ok(`${name}: embeds Engine Host bundle`, entries.some((e) => e.endsWith("dist/engine-host/gaep-engine-host-0.2.0.cjs")))
  ok(`${name}: embeds Engine Host digest`, entries.some((e) => e.endsWith("dist/engine-host/engine-host.sha256")))
  ok(`${name}: ships the extension bundle`, entries.some((e) => e.endsWith("dist/extension.cjs")))
  ok(`${name}: ships no test files`, !entries.some((e) => /\.test\./.test(e)))
  ok(`${name}: ships no source maps`, !entries.some((e) => e.endsWith(".map")))
  ok(`${name}: ships no TypeScript source`, !entries.some((e) => e.endsWith(".ts")))
}

// Extract the VS Code VSIX and smoke-test the bundled Engine Host over protocol v3.
const stage = mkdtempSync(join(tmpdir(), "gaep-cs02-smoke-"))
try {
  execFileSync("unzip", ["-q", join(outRoot, "gaep-vscode-0.2.0.vsix"), "-d", stage])
  const engineHostDir = join(stage, "extension", "dist", "engine-host")
  const runtime = join(engineHostDir, "gaep-engine-host-0.2.0.cjs")
  const sidecar = readFileSync(join(engineHostDir, "engine-host.sha256"), "utf8").trim().split(" ")[0]
  const expected = sidecar.startsWith("sha256:") ? sidecar : `sha256:${sidecar}`
  const actual = `sha256:${createHash("sha256").update(readFileSync(runtime)).digest("hex")}`
  ok("extracted Engine Host digest matches its sidecar", actual === expected)

  const workspace = mkdtempSync(join(tmpdir(), "gaep-cs02-ws-"))
  const child = spawn(process.execPath, [runtime, "--workspace", workspace], { stdio: ["pipe", "pipe", "pipe"] })
  const projection = await new Promise((resolvePromise, rejectPromise) => {
    let buffer = ""
    const timer = setTimeout(() => rejectPromise(new Error("timeout")), 15000)
    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString("utf8")
      const nl = buffer.indexOf("\n")
      if (nl >= 0) {
        clearTimeout(timer)
        try { resolvePromise(JSON.parse(buffer.slice(0, nl)).result) } catch (e) { rejectPromise(e) }
      }
    })
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, protocolVersion: 3, method: "dashboardProjection", params: {} })}\n`)
  }).finally(() => { child.kill() })
  rmSync(workspace, { recursive: true, force: true })

  ok("packaged Engine Host returns a v3 dashboardProjection", projection && projection.schemaVersion === 1)
  ok("projection is a friendly uninitialized state (INV-16)", projection?.workspaceState === "product-uninitialized" && /Initialize Product first/.test(projection?.workspaceMessage ?? ""))
  ok("projection carries the Four-IDE host matrix", (projection?.hostMatrix ?? []).map((r) => r.host).join(",") === "vscode,visual-studio,rider,kiro")
} catch (error) {
  ok(`packaged Engine Host smoke test (${error instanceof Error ? error.message : error})`, false)
} finally {
  rmSync(stage, { recursive: true, force: true })
}

if (failures.length > 0) { console.error(`CS02 package verification: FAIL (${failures.length})`); process.exit(1) }
console.log("CS02 package verification: PASS")
