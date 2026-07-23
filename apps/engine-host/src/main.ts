#!/usr/bin/env node
import { once } from "node:events"
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
let inputEnded = false

async function writeFrame(value: unknown): Promise<void> {
  const frame = `${serializeRpcFrame(value)}\n`
  if (!process.stdout.write(frame)) await once(process.stdout, "drain")
}

async function writeResult(id: string | number, result: unknown): Promise<void> {
  await writeFrame({ jsonrpc: "2.0", id, result })
}

async function writeError(id: string | number | null, error: unknown): Promise<void> {
  const normalized = normalizeRpcError(error)
  await writeFrame({
    jsonrpc: "2.0",
    id,
    error: {
      code: normalized.code,
      message: normalized.message,
      data: { kind: normalized.kind, ...(normalized.data === undefined ? {} : { detail: normalized.data }) },
    },
  })
}

async function processFrame(frame: DecodedRpcFrame): Promise<void> {
  if (frame.type === "error") {
    await writeError(null, frame.error)
    return
  }
  let id: string | number | null = null
  try {
    const request = EngineHost.parse(frame.line)
    id = request.id
    await writeResult(id, await host.dispatch(request))
  } catch (error) {
    await writeError(id, error)
  }
}

function enqueue(frames: DecodedRpcFrame[], resumeInput: boolean): void {
  queue = queue
    .then(async () => {
      for (const frame of frames) await processFrame(frame)
    })
    .catch(() => {
      inputEnded = true
      process.stdin.destroy()
      process.exitCode = 74
    })
    .then(() => {
      if (resumeInput && !inputEnded) process.stdin.resume()
    })
}

process.stdin.on("data", (chunk: Buffer) => {
  process.stdin.pause()
  enqueue(decoder.push(chunk), true)
})
process.stdin.on("end", () => {
  inputEnded = true
  enqueue(decoder.end(), false)
})
