#!/usr/bin/env node
import { realpathSync, statSync } from "node:fs"
import { isAbsolute } from "node:path"

import { EngineHost } from "./host.js"
import { normalizeRpcError, RpcFrameDecoder, serializeRpcFrame, type DecodedRpcFrame } from "./rpc.js"

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

const host = new EngineHost(workspacePath)
const decoder = new RpcFrameDecoder()
let queue = Promise.resolve()

function writeResult(id: string | number, result: unknown): void {
  process.stdout.write(`${serializeRpcFrame({ jsonrpc: "2.0", id, result })}\n`)
}

function writeError(id: string | number | null, error: unknown): void {
  const normalized = normalizeRpcError(error)
  process.stdout.write(`${serializeRpcFrame({
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
process.stdin.on("end", () => enqueue(decoder.end()))
