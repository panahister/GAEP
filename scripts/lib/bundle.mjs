// GAEP-P0-CS02 — shared helpers for the local release-bundle workflow (release:matrix|collect|verify).
// The bundle is generated output under the Git-ignored `local-release-bundles/` tree; nothing here is
// committed. All digests are recomputed over exact bytes; publication is atomic.
import { createHash } from "node:crypto"
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { computeSourceIdentity } from "@gaep/engine"

export const CHANGE_SET_ID = "GAEP-P0-CS02"
export const VERSION = "0.2.0"
export const SCHEMA_VERSION = 1

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")

/** Canonical bundle target name for a host platform/arch. */
export function canonicalTarget(platform = process.platform, arch = process.arch) {
  if (platform === "darwin" && arch === "arm64") return "macos-arm64"
  if (platform === "linux" && arch === "x64") return "linux-x64"
  if (platform === "win32" && arch === "x64") return "windows-x64"
  return `${platform}-${arch}`
}

/** The Node/SEA target string for a bundle target. */
export const SEA_TARGET = { "macos-arm64": "darwin-arm64", "linux-x64": "linux-x64", "windows-x64": "win32-x64" }

/** The IDE hosts applicable to each OS target (Visual Studio is Windows-only). */
export const IDES_BY_TARGET = {
  "macos-arm64": ["vscode", "kiro", "rider"],
  "windows-x64": ["vscode", "kiro", "rider", "visual-studio"],
  "linux-x64": ["vscode", "kiro", "rider"],
}

/** OS+arch metadata for a bundle target. */
export const TARGET_OS = {
  "macos-arm64": { os: "macos", arch: "arm64" },
  "windows-x64": { os: "windows", arch: "x64" },
  "linux-x64": { os: "linux", arch: "x64" },
}

/** The expected artifact basename for an IDE within a target. */
export function artifactName(ide, target) {
  if (ide === "vscode") return `gaep-vscode-${VERSION}.vsix`
  if (ide === "kiro") return `gaep-kiro-${VERSION}.vsix`
  if (ide === "rider") return `gaep-rider-${VERSION}-${SEA_TARGET[target]}.zip`
  if (ide === "visual-studio") return `Gaep.VisualStudio-${VERSION}.vsix`
  throw new Error(`Unknown IDE host: ${ide}`)
}

export function bundleRoot(changeSet = CHANGE_SET_ID, version = VERSION, baseRoot = repoRoot) {
  return join(baseRoot, "local-release-bundles", changeSet, version)
}

export function sha256File(path) {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`
}

export async function currentSourceIdentity() {
  return computeSourceIdentity(repoRoot)
}

export function readManifest(root) {
  const path = join(root, "bundle-manifest.json")
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : undefined
}

/** Atomically write JSON (temp file + rename) so a failed write cannot corrupt a valid bundle. */
export function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8")
  renameSync(tmp, path)
}

/** Recompute SHA256SUMS.txt over every artifact recorded as built in the manifest. */
export function writeSha256Sums(root, manifest) {
  const lines = []
  for (const a of manifest.artifacts) {
    if (a.buildState !== "built" || !a.artifactSha256) continue
    lines.push(`${a.artifactSha256.slice("sha256:".length)}  ${a.artifactRelativePath}`)
  }
  writeJsonAtomicRaw(join(root, "SHA256SUMS.txt"), `${lines.sort().join("\n")}\n`)
}

export function writeJsonAtomicRaw(path, text) {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(tmp, text, "utf8")
  renameSync(tmp, path)
}

/** Insert or replace the manifest entry for (target, ide). */
export function upsertArtifact(manifest, entry) {
  const index = manifest.artifacts.findIndex((a) => a.targetOs === entry.targetOs && a.ideHost === entry.ideHost && a.targetArch === entry.targetArch)
  if (index >= 0) manifest.artifacts[index] = entry
  else manifest.artifacts.push(entry)
  manifest.artifacts.sort((l, r) => `${l.targetOs}/${l.ideHost}`.localeCompare(`${r.targetOs}/${r.ideHost}`))
}

export { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, join, relative, renameSync }
