import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { readdir } from "node:fs/promises"
import { join } from "node:path"

/**
 * GAEP-P0-CS02 — Product source immutability guard (INV-04) and the exact governed
 * mutation allowlist (INV-05).
 *
 * A read-only analysis may change nothing outside the allowlist. Machine-local state
 * (the Engine Host PID/lock) lives outside the workspace and must never appear here.
 */

const SKIPPED_DIRECTORIES = new Set(["node_modules", ".git", "dist", "build", "out", "bin", "obj", ".gradle", ".idea"])

/** Exactly the portable records a CS02 analysis may create or modify (INV-05). */
export const GOVERNED_MUTATION_ALLOWLIST = [
  ".gaep/runtime/selection.json",
  ".gaep/runs/",
  ".gaep/evidence/",
  ".gaep/audit/",
  ".gaep/product-studio/context-pack/",
] as const

export function isGovernedAllowlistedPath(relativePath: string): boolean {
  return GOVERNED_MUTATION_ALLOWLIST.some((allowed) =>
    allowed.endsWith("/") ? relativePath.startsWith(allowed) : relativePath === allowed)
}

/** Product source = everything outside `.gaep/`. */
export function isProductSourcePath(relativePath: string): boolean {
  return !relativePath.startsWith(".gaep/")
}

async function walk(root: string, directory: string, accumulator: Map<string, string>): Promise<void> {
  let entries
  try {
    entries = await readdir(join(root, directory), { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const relativePath = directory ? `${directory}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) continue
      await walk(root, relativePath, accumulator)
    } else if (entry.isFile()) {
      try {
        accumulator.set(relativePath, createHash("sha256").update(readFileSync(join(root, relativePath))).digest("hex"))
      } catch { /* unreadable file is reported as absent */ }
    }
  }
}

/** Digest every Product file (everything outside `.gaep/`). */
export async function snapshotProductDigests(root: string): Promise<Map<string, string>> {
  const digests = new Map<string, string>()
  await walk(root, "", digests)
  for (const key of [...digests.keys()]) if (!isProductSourcePath(key)) digests.delete(key)
  return digests
}

/** Digest EVERY workspace file, including `.gaep/**`, for provider-window enforcement (INV-05). */
export async function snapshotWorkspaceDigests(root: string): Promise<Map<string, string>> {
  const digests = new Map<string, string>()
  await walk(root, "", digests)
  return digests
}

export interface MutationViolation {
  path: string
  kind: "added" | "modified" | "deleted"
}

/** Return every Product-source difference. An empty array means no Product source changed. */
export function diffProductDigests(before: Map<string, string>, after: Map<string, string>): MutationViolation[] {
  const violations: MutationViolation[] = []
  for (const [path, digest] of before) {
    const current = after.get(path)
    if (current === undefined) violations.push({ path, kind: "deleted" })
    else if (current !== digest) violations.push({ path, kind: "modified" })
  }
  for (const path of after.keys()) if (!before.has(path)) violations.push({ path, kind: "added" })
  return violations.sort((left, right) => (left.path < right.path ? -1 : 1))
}

export class ProductSourceMutationError extends Error {
  constructor(readonly violations: MutationViolation[]) {
    // Only the count is surfaced; concrete paths never reach persisted evidence (INV-17).
    super(`Product source files changed during a read-only analysis (${violations.length})`)
    this.name = "ProductSourceMutationError"
  }
}

/** Throw when any Product source file changed (INV-04). */
export function assertNoProductMutation(before: Map<string, string>, after: Map<string, string>): void {
  const violations = diffProductDigests(before, after)
  if (violations.length > 0) throw new ProductSourceMutationError(violations)
}

/**
 * Enforce that the provider process changed NOTHING in the workspace during its execution window
 * (INV-04/05). GAEP's own governed writes happen outside this window, so any diff here — a Product
 * source change OR any `.gaep/**` write, allowlisted-looking or not — is an unauthorized provider
 * mutation. This prevents a provider from hiding a write inside a GAEP-owned execution.
 */
export function assertNoWorkspaceMutation(before: Map<string, string>, after: Map<string, string>): void {
  const violations = diffProductDigests(before, after)
  if (violations.length > 0) throw new ProductSourceMutationError(violations)
}
