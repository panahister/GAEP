import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { readFileSync, statSync } from "node:fs"
import { readdir } from "node:fs/promises"
import { join, relative, sep } from "node:path"

import { sourceIdentitySchema, type SourceIdentity } from "@gaep/contracts"

/**
 * GAEP-P0-CS02 — reproducible, non-self-referential source identity (INV-27).
 *
 * `sourceTreeDigest` covers every artifact-producing input. Generated outputs and acceptance
 * artifacts are excluded so committing a generated manifest can never change the identity.
 */

/** Directories never traversed. */
const EXCLUDED_DIRECTORIES = new Set([
  "node_modules", ".git", "dist", "build", "out", "bin", "obj", ".gradle", ".idea", ".vitest", "coverage",
])

/** Repo-relative path prefixes that are excluded even when reachable. */
const EXCLUDED_PREFIXES = [
  "docs/",
  "examples/",
  "design/",
  "design sample/",
]

/** Explicit root-level files that are build inputs. */
const INCLUDED_ROOT_FILES = ["package.json", "package-lock.json", "tsconfig.json", "tsconfig.base.json"]

/** Directory subtrees scanned for build inputs. */
const INCLUDED_DIRECTORIES = ["packages", "apps", "scripts", ".github/workflows"]

/** File extensions and exact names treated as artifact-producing inputs. */
const INCLUDED_EXTENSIONS = [
  ".ts", ".tsx", ".mjs", ".cjs", ".js", ".json", ".kt", ".kts", ".cs", ".csproj",
  ".vsixmanifest", ".xml", ".properties", ".yml", ".yaml", ".jar",
]

function isIncludedFile(relativePath: string): boolean {
  if (EXCLUDED_PREFIXES.some((prefix) => relativePath.startsWith(prefix))) return false
  if (relativePath.endsWith(".tsbuildinfo")) return false
  // Test files do not change produced package bytes, but including them is harmless and
  // keeps the rule simple; exclude only generated map files.
  if (relativePath.endsWith(".map")) return false
  return INCLUDED_EXTENSIONS.some((extension) => relativePath.endsWith(extension))
}

async function collectFiles(root: string, directory: string, accumulator: string[]): Promise<void> {
  let entries
  try {
    entries = await readdir(join(root, directory), { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const relativePath = directory ? `${directory}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRECTORIES.has(entry.name)) continue
      await collectFiles(root, relativePath, accumulator)
    } else if (entry.isFile() && isIncludedFile(relativePath)) {
      accumulator.push(relativePath)
    }
  }
}

function digestFile(absolutePath: string): string {
  return createHash("sha256").update(readFileSync(absolutePath)).digest("hex")
}

/** Enumerate the canonical build-input paths, sorted byte-ascending. */
export async function listSourceInputs(root: string): Promise<string[]> {
  const files: string[] = []
  for (const name of INCLUDED_ROOT_FILES) {
    try {
      if (statSync(join(root, name)).isFile()) files.push(name)
    } catch { /* absent input is simply not included */ }
  }
  for (const directory of INCLUDED_DIRECTORIES) await collectFiles(root, directory, files)
  return files.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
}

/**
 * Compute the source identity. `sourceTreeDigest` is the equivalence/staleness identity;
 * `baseCommit` and `dirty` are provenance metadata only and never gate acceptance.
 */
export async function computeSourceIdentity(root: string): Promise<SourceIdentity> {
  const files = await listSourceInputs(root)
  const lines = files.map((file) => `${digestFile(join(root, file))}  ${file}`)
  const sourceTreeDigest = `sha256:${createHash("sha256").update(lines.join("\n"), "utf8").digest("hex")}`

  let baseCommit = "0".repeat(40)
  let dirty = false
  try {
    baseCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim()
    const status = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" })
    dirty = status.split("\n").some((line) => {
      const path = line.slice(3).trim()
      return path.length > 0 && isIncludedFile(path)
    })
  } catch { /* not a git checkout: provenance stays at its zero value */ }

  return sourceIdentitySchema.parse({ sourceTreeDigest, baseCommit, dirty })
}

/** Repo-relative POSIX path helper used by callers that report inputs. */
export function toRepoRelative(root: string, absolutePath: string): string {
  return relative(root, absolutePath).split(sep).join("/")
}
