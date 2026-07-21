#!/usr/bin/env node
import { createInterface } from "node:readline"

import { EngineHost } from "./host.js"

const workspaceFlag = process.argv.indexOf("--workspace")
const workspacePath = workspaceFlag >= 0 ? process.argv[workspaceFlag + 1] : undefined
if (!workspacePath) {
  process.stderr.write("Usage: gaep-engine --workspace <absolute-path>\n")
  process.exit(64)
}

const host = new EngineHost(workspacePath)
const lines = createInterface({ input: process.stdin, crlfDelay: Number.POSITIVE_INFINITY })
let queue = Promise.resolve()

lines.on("line", (line) => {
  queue = queue.then(async () => {
    let id: string | number | null = null
    try {
      const request = EngineHost.parse(line)
      id = request.id
      const result = await host.dispatch(request)
      process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`)
    } catch (error) {
      process.stdout.write(`${JSON.stringify({
        jsonrpc: "2.0",
        id,
        error: {
          code: -32_000,
          message: error instanceof Error ? error.message : "Unknown engine error",
        },
      })}\n`)
    }
  })
})
