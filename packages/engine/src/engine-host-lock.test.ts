import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { acquireEngineHostLock, clearEngineHostLock, engineHostLockPath, isLockStale, readEngineHostLock, releaseEngineHostLock, writeEngineHostLock } from "./engine-host-lock.js"

let productRoot: string
let stateRoot: string
beforeEach(() => {
  productRoot = mkdtempSync(join(tmpdir(), "gaep-product-"))
  stateRoot = mkdtempSync(join(tmpdir(), "gaep-state-"))
})
afterEach(() => {
  rmSync(productRoot, { recursive: true, force: true })
  rmSync(stateRoot, { recursive: true, force: true })
})

describe("engine host lock", () => {
  it("stores the lock outside the Product workspace, keyed by root digest (INV-05/21)", () => {
    const path = writeEngineHostLock(productRoot, { pid: process.pid, startedAt: new Date().toISOString(), packageVersion: "0.2.0" }, stateRoot)
    expect(path.startsWith(stateRoot)).toBe(true)
    expect(path.includes(productRoot)).toBe(false)
    // Nothing is written into the portable workspace.
    expect(existsSync(join(productRoot, ".gaep"))).toBe(false)
    expect(engineHostLockPath(productRoot, stateRoot)).toMatch(/[0-9a-f]{64}\.json$/)
  })

  it("reconciles a stale PID and clears the lock", () => {
    writeEngineHostLock(productRoot, { pid: process.pid, startedAt: new Date().toISOString(), packageVersion: "0.2.0" }, stateRoot)
    expect(isLockStale(readEngineHostLock(productRoot, stateRoot))).toBe(false)
    writeEngineHostLock(productRoot, { pid: 2 ** 30, startedAt: new Date().toISOString(), packageVersion: "0.2.0" }, stateRoot)
    expect(isLockStale(readEngineHostLock(productRoot, stateRoot))).toBe(true)
    clearEngineHostLock(productRoot, stateRoot)
    expect(readEngineHostLock(productRoot, stateRoot)).toBeUndefined()
    expect(isLockStale(undefined)).toBe(true)
  })

  it("atomic acquisition has exactly one winner; a second live host is refused (INV-05)", () => {
    const first = acquireEngineHostLock(productRoot, { pid: process.pid, startedAt: new Date().toISOString(), packageVersion: "0.2.0" }, stateRoot)
    expect(first.acquired).toBe(true)
    const second = acquireEngineHostLock(productRoot, { pid: process.pid, startedAt: new Date().toISOString(), packageVersion: "0.2.0" }, stateRoot)
    expect(second.acquired).toBe(false)
    if (!second.acquired) expect(second.owner.nonce).toBe(first.acquired ? first.record.nonce : undefined)
  })

  it("a non-owner cannot release another host's lock; the owner can", () => {
    const owner = acquireEngineHostLock(productRoot, { pid: process.pid, startedAt: new Date().toISOString(), packageVersion: "0.2.0" }, stateRoot)
    expect(owner.acquired).toBe(true)
    expect(releaseEngineHostLock(productRoot, "not-the-owner-nonce", stateRoot)).toBe(false)
    expect(readEngineHostLock(productRoot, stateRoot)).not.toBeUndefined()
    if (owner.acquired) expect(releaseEngineHostLock(productRoot, owner.record.nonce as string, stateRoot)).toBe(true)
    expect(readEngineHostLock(productRoot, stateRoot)).toBeUndefined()
  })

  it("recovers a stale (dead-owner) lock exactly once and grants ownership to the recoverer", () => {
    writeEngineHostLock(productRoot, { pid: 2 ** 30, startedAt: new Date().toISOString(), packageVersion: "0.2.0", nonce: "dead" }, stateRoot)
    const recovered = acquireEngineHostLock(productRoot, { pid: process.pid, startedAt: new Date().toISOString(), packageVersion: "0.2.0" }, stateRoot)
    expect(recovered.acquired).toBe(true)
    const onDisk = readEngineHostLock(productRoot, stateRoot)
    expect(onDisk?.nonce).toBe(recovered.acquired ? recovered.record.nonce : undefined)
    expect(onDisk?.nonce).not.toBe("dead")
  })
})
