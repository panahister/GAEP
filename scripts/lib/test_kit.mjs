// GAEP-P0-CS02 — generate a self-contained per-target test kit. The generated runner verifies
// exact-byte checksums, archive membership, and an Engine Host protocol-v3 dashboard request.
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { IDES_BY_TARGET, SEA_TARGET, VERSION, artifactName } from "./bundle.mjs"

const INSTALL = {
  "macos-arm64": {
    vscode: "'/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code' --user-data-dir <isolated-user-data> --extensions-dir <isolated-extensions> --install-extension <path>",
    kiro: "'/Applications/Kiro.app/Contents/Resources/app/bin/code' --user-data-dir <isolated-user-data> --extensions-dir <isolated-extensions> --install-extension <path>",
    rider: "Install the plugin ZIP via Rider ▸ Settings ▸ Plugins ▸ ⚙ ▸ Install Plugin from Disk… (use an isolated sandbox/config dir)",
  },
  "windows-x64": {
    vscode: "code.cmd --user-data-dir <isolated-user-data> --extensions-dir <isolated-extensions> --install-extension <path>",
    kiro: "kiro.cmd --user-data-dir <isolated-user-data> --extensions-dir <isolated-extensions> --install-extension <path>",
    rider: "Install the plugin ZIP via Rider ▸ Settings ▸ Plugins ▸ Install Plugin from Disk…",
    "visual-studio": "Double-click the VSIX or run: VSIXInstaller.exe <path>",
  },
  "linux-x64": {
    vscode: "code --user-data-dir <isolated-user-data> --extensions-dir <isolated-extensions> --install-extension <path>",
    kiro: "kiro --user-data-dir <isolated-user-data> --extensions-dir <isolated-extensions> --install-extension <path>",
    rider: "Install the plugin ZIP via Rider ▸ Settings ▸ Plugins ▸ Install Plugin from Disk…",
  },
}

export function writeTestKit(bundle, target) {
  const dir = join(bundle, "test-kits", target)
  mkdirSync(dir, { recursive: true })
  const install = IDES_BY_TARGET[target]
    .map((ide) => `- **${ide}** (\`${artifactName(ide, target)}\`): \`${INSTALL[target][ide]}\``)
    .join("\n")

  writeFileSync(join(dir, "README.md"), `# GAEP-P0-CS02 test kit — ${target}

Package version ${VERSION}. Machine-readable results are written to \`./results.json\` by \`smoke.mjs\`.

## 1. Verify package and protocol evidence
\`\`\`
node smoke.mjs
\`\`\`
This recomputes SHA-256 over each artifact, verifies that every package embeds its Engine Host and
digest sidecar, extracts the host, and executes a protocol-v3 dashboard handshake.

## 2. Install (isolated profile/sandbox — do not touch normal IDE settings)
${install}

## 3. In-IDE smoke (manual, one step per IDE)
- Launch the IDE and open the GAEP view/Tool Window.
- Run **Dashboard** and confirm all four host rows.
- Run **Provider catalog** and confirm detected providers/models.
- Select a provider/model; start, refresh, and cancel an analysis using a governed Context Pack.
- Confirm no Product source mutation; only governed \`.gaep\` run/evidence paths may change.

## 4. Uninstall / cleanup
- VS Code/Kiro: use the same isolated directories with \`--uninstall-extension\`, then remove them.
- Rider/Visual Studio: remove the plugin/VSIX and delete the isolated sandbox/config directory.

## Result contract
\`results.json\` records per-artifact \`checksum\`, \`membership\`, \`protocol\`, and \`ui\` outcomes.
Automated results are \`passed\`/\`failed\`/\`not-applicable\`; UI remains \`manual-required\` until a human records it.
`)
  writeFileSync(join(dir, "smoke.mjs"), smokeRunner(target))
}

function smokeRunner(target) {
  const seaTarget = SEA_TARGET[target]
  return `#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { chmodSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const target = ${JSON.stringify(target)}
const seaTarget = ${JSON.stringify(seaTarget)}
const bundle = resolve(here, "..", "..")
const manifest = JSON.parse(readFileSync(join(bundle, "bundle-manifest.json"), "utf8"))
const results = { target, checkedAt: new Date().toISOString(), artifacts: [] }
const digest = (path) => "sha256:" + createHash("sha256").update(readFileSync(path)).digest("hex")

for (const artifact of manifest.artifacts.filter((item) => item.artifactRelativePath.startsWith(target + "/"))) {
  const absolute = join(bundle, artifact.artifactRelativePath)
  const result = { ide: artifact.ideHost, checksum: "not-applicable", membership: "not-applicable", protocol: "not-applicable", ui: "manual-required" }
  if (artifact.buildState === "built" && existsSync(absolute)) {
    result.checksum = digest(absolute) === artifact.artifactSha256 ? "passed" : "failed"
    const basenames = listZipEntries(absolute).map((name) => name.split("/").pop())
    result.membership = requiredMembers(artifact.ideHost).every((name) => basenames.includes(name)) ? "passed" : "failed"
    if (result.membership === "passed") result.protocol = await protocolSmoke(absolute, artifact.ideHost)
  } else if (artifact.buildState !== "not-built") {
    result.checksum = "failed"
  }
  results.artifacts.push(result)
}

writeFileSync(join(here, "results.json"), JSON.stringify(results, null, 2) + "\\n")
const failed = results.artifacts.some((item) => item.checksum === "failed" || item.membership === "failed" || item.protocol === "failed")
process.stdout.write("smoke results -> results.json\\n")
process.exit(failed ? 1 : 0)

function requiredMembers(ide) {
  if (ide === "vscode" || ide === "kiro") return ["gaep-engine-host-${VERSION}.cjs", "engine-host.sha256"]
  if (ide === "rider") return ["gaep-engine-host-${VERSION}-" + seaTarget, "gaep-engine-host-${VERSION}-" + seaTarget + ".sha256"]
  if (ide === "visual-studio") return ["gaep-engine-host-${VERSION}-win32-x64.exe", "gaep-engine-host-${VERSION}-win32-x64.exe.sha256"]
  return []
}

function listZipEntries(path) {
  const buffer = readFileSync(path)
  let eocd = -1
  for (let index = buffer.length - 22; index >= 0 && index >= buffer.length - 22 - 0x10000; index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) { eocd = index; break }
  }
  if (eocd < 0) throw new Error("Not a ZIP archive")
  const count = buffer.readUInt16LE(eocd + 10)
  let pointer = buffer.readUInt32LE(eocd + 16)
  const names = []
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(pointer) !== 0x02014b50) throw new Error("Corrupt ZIP central directory")
    const nameLength = buffer.readUInt16LE(pointer + 28)
    const extraLength = buffer.readUInt16LE(pointer + 30)
    const commentLength = buffer.readUInt16LE(pointer + 32)
    names.push(buffer.toString("utf8", pointer + 46, pointer + 46 + nameLength))
    pointer += 46 + nameLength + extraLength + commentLength
  }
  return names
}

async function protocolSmoke(archive, ide) {
  const extracted = mkdtempSync(join(tmpdir(), "gaep-target-smoke-"))
  const workspace = mkdtempSync(join(tmpdir(), "gaep-target-workspace-"))
  try {
    if (process.platform === "win32") {
      execFileSync("powershell.exe", ["-NoProfile", "-Command", "Expand-Archive -LiteralPath $args[0] -DestinationPath $args[1] -Force", archive, extracted], { stdio: "ignore" })
    } else {
      execFileSync("unzip", ["-oq", archive, "-d", extracted], { stdio: "ignore" })
    }
    const basename = ide === "vscode" || ide === "kiro"
      ? "gaep-engine-host-${VERSION}.cjs"
      : ide === "visual-studio"
        ? "gaep-engine-host-${VERSION}-win32-x64.exe"
        : "gaep-engine-host-${VERSION}-" + seaTarget
    const host = findFile(extracted, basename)
    if (!host) return "failed"
    if (process.platform !== "win32") chmodSync(host, 0o755)
    const command = host.endsWith(".cjs") ? process.execPath : host
    const args = host.endsWith(".cjs") ? [host, "--workspace", workspace] : ["--workspace", workspace]
    return await runProtocol(command, args) ? "passed" : "failed"
  } catch {
    return "failed"
  } finally {
    rmSync(extracted, { recursive: true, force: true })
    rmSync(workspace, { recursive: true, force: true })
  }
}

function findFile(root, basename) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) { const nested = findFile(path, basename); if (nested) return nested }
    else if (entry.name === basename) return path
  }
  return undefined
}

function runProtocol(command, args) {
  return new Promise((done) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "ignore"] })
    let output = ""
    let settled = false
    const finish = (value) => { if (settled) return; settled = true; clearTimeout(timer); done(value) }
    const timer = setTimeout(() => { try { child.kill("SIGKILL") } catch {}; finish(false) }, 15000)
    child.stdout.on("data", (chunk) => {
      output += chunk
      if (output.includes('"result"') && output.includes("hostMatrix")) { try { child.stdin.end() } catch {}; finish(true) }
    })
    child.on("error", () => finish(false))
    child.on("exit", () => finish(output.includes('"result"') && output.includes("hostMatrix")))
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, protocolVersion: 3, method: "dashboardProjection", params: {} }) + "\\n")
  })
}
`
}
