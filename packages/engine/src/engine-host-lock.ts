import { createHash, randomUUID } from "node:crypto"
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { homedir, platform } from "node:os"
import { dirname, join, resolve } from "node:path"

/**
 * GAEP-P0-CS02 — machine-local Engine Host PID/lock (INV-05/21).
 *
 * The lock is keyed by a digest of the absolute Product root and stored OUTSIDE the workspace.
 * It must never enter portable `.gaep` records, evidence, package manifests, or Git.
 */

export function engineHostStateRoot(): string {
  if (platform() === "win32") {
    const localAppData = process.env.LOCALAPPDATA
    if (localAppData) return join(localAppData, "gaep", "engine-host")
  }
  return join(homedir(), ".gaep-state", "engine-host")
}

/** Absolute, machine-local lock path for a Product root. Never inside the workspace. */
export function engineHostLockPath(productRoot: string, stateRoot = engineHostStateRoot()): string {
  const key = createHash("sha256").update(resolve(productRoot), "utf8").digest("hex")
  return join(stateRoot, `${key}.json`)
}

export interface EngineHostLockRecord {
  pid: number
  startedAt: string
  packageVersion: string
  /** Ownership token: only the holder of this nonce may release the lock (PID-reuse protection). */
  nonce?: string
}

export function writeEngineHostLock(productRoot: string, record: EngineHostLockRecord, stateRoot?: string): string {
  const path = engineHostLockPath(productRoot, stateRoot)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`, "utf8")
  return path
}

export type EngineHostLockAcquisition =
  | { acquired: true; record: EngineHostLockRecord; path: string }
  | { acquired: false; owner: EngineHostLockRecord }

/**
 * Atomically acquire the machine-local Engine Host lock for a Product root (INV-05). Acquisition
 * uses exclusive file creation (`wx`) so only one caller can win. A stale lock (its owner PID is
 * proven dead) is recovered via an atomic rename takeover — only the caller that wins the rename
 * removes it and re-creates the lock, so two concurrent recoverers cannot both win. A live lock is
 * never disturbed: the call returns `{ acquired: false, owner }`.
 */
export function acquireEngineHostLock(
  productRoot: string,
  record: Omit<EngineHostLockRecord, "nonce"> & { nonce?: string },
  stateRoot?: string,
): EngineHostLockAcquisition {
  const path = engineHostLockPath(productRoot, stateRoot)
  mkdirSync(dirname(path), { recursive: true })
  const owned: EngineHostLockRecord = { ...record, nonce: record.nonce ?? randomUUID() }
  const serialized = `${JSON.stringify(owned, null, 2)}\n`

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      writeFileSync(path, serialized, { encoding: "utf8", flag: "wx" })
      return { acquired: true, record: owned, path }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
    }
    const existing = readEngineHostLock(productRoot, stateRoot)
    if (existing && !isLockStale(existing)) return { acquired: false, owner: existing }
    // The lock is stale (owner proven dead). Attempt an atomic rename takeover: only one caller can
    // rename the same source path; the loser gets ENOENT and retries the exclusive create.
    const claim = `${path}.${owned.nonce}.claim`
    try {
      renameSync(path, claim)
      rmSync(claim, { force: true })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
      // Lost the takeover race; loop and retry the exclusive create against the new owner.
    }
  }
  const owner = readEngineHostLock(productRoot, stateRoot)
  return owner && !isLockStale(owner) ? { acquired: false, owner } : { acquired: false, owner: owned }
}

/**
 * Release the lock only if the caller still owns it (its on-disk nonce matches). A non-owner — a
 * second host, or a host whose lock was already taken over — cannot clear another host's lock.
 * Returns true when this call removed the lock.
 */
export function releaseEngineHostLock(productRoot: string, nonce: string, stateRoot?: string): boolean {
  const existing = readEngineHostLock(productRoot, stateRoot)
  if (!existing || existing.nonce !== nonce) return false
  clearEngineHostLock(productRoot, stateRoot)
  return true
}

export function readEngineHostLock(productRoot: string, stateRoot?: string): EngineHostLockRecord | undefined {
  try {
    return JSON.parse(readFileSync(engineHostLockPath(productRoot, stateRoot), "utf8")) as EngineHostLockRecord
  } catch {
    return undefined
  }
}

export function clearEngineHostLock(productRoot: string, stateRoot?: string): void {
  rmSync(engineHostLockPath(productRoot, stateRoot), { force: true })
}

/** True when the recorded PID is no longer a live process (orphan reconciliation input). */
export function isLockStale(record: EngineHostLockRecord | undefined): boolean {
  if (!record) return true
  try {
    process.kill(record.pid, 0)
    return false
  } catch {
    return true
  }
}
