#!/usr/bin/env node
import { realpathSync, statSync } from "node:fs"
import { isAbsolute } from "node:path"

import { acquireEngineHostLock, releaseEngineHostLock } from "@gaep/engine"

import { EngineHost } from "./host.js"
import { normalizeRpcError, RpcFrameDecoder, type DecodedRpcFrame } from "./rpc.js"

const workspaceFlag = process.argv.indexOf("--workspace")
const requestedWorkspace = workspaceFlag >= 0 ? process.argv[workspaceFlag + 1] : undefined
if (!requestedWorkspace || !isAbsolute(requestedWorkspace)) {
  process.stderr.write("Usage: gaep-engine --workspace <absolute-path>\n")
  process.exit(64)
}

let workspacePath: string
try {
  workspacePath = realpathSync(requestedWorkspace)
  if (!statSync(workspacePath).isDirectory()) throw new Error("not a directory")
} catch {
  process.stderr.write("GAEP workspace must be an existing directory\n")
  process.exit(72)
}

// GAEP-P0-CS02: one live Engine Host per Product root (INV-05). Atomically acquire the lock; refuse
// to start a second live host; recover only a genuinely dead one. The lock lives outside the
// Product workspace and is released only by its owner (nonce), never by another host.
const acquisition = acquireEngineHostLock(workspacePath, {
  pid: process.pid,
  startedAt: new Date().toISOString(),
  packageVersion: "0.2.0",
})
if (!acquisition.acquired) {
  process.stderr.write("Another GAEP Engine Host already owns this Product root\n")
  process.exit(75)
}
const ownershipNonce = acquisition.record.nonce as string
const releaseLock = (): void => { try { releaseEngineHostLock(workspacePath, ownershipNonce) } catch { /* best effort */ } }
process.on("exit", releaseLock)
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
  process.on(signal, () => { releaseLock(); process.exit(0) })
}

const host = new EngineHost(workspacePath)
const decoder = new RpcFrameDecoder()
let queue = Promise.resolve()

function writeResult(id: string | number, result: unknown): void {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`)
}

function writeError(id: string | number | null, error: unknown): void {
  const normalized = normalizeRpcError(error)
  process.stdout.write(`${JSON.stringify({
    jsonrpc: "2.0",
    id,
    error: {
      code: normalized.code,
      message: normalized.message,
      data: { kind: normalized.kind, ...(normalized.data === undefined ? {} : { detail: normalized.data }) },
    },
  })}\n`)
}

async function processFrame(frame: DecodedRpcFrame): Promise<void> {
  if (frame.type === "error") {
    writeError(null, frame.error)
    return
  }
  let id: string | number | null = null
  try {
    const request = EngineHost.parse(frame.line)
    id = request.id
    writeResult(id, await host.dispatch(request))
  } catch (error) {
    writeError(id, error)
  }
}

function enqueue(frames: DecodedRpcFrame[]): void {
  for (const frame of frames) {
    queue = queue.then(() => processFrame(frame), () => processFrame(frame))
  }
}

process.stdin.on("data", (chunk: Buffer) => enqueue(decoder.push(chunk)))
process.stdin.on("end", () => {
  // The client closed the connection: drain any final frames, then exit gracefully so the `exit`
  // handler releases the machine-local lock (a SIGKILL would leave a stale lock behind).
  enqueue(decoder.end())
  queue = queue.then(() => process.exit(0), () => process.exit(0))
})
