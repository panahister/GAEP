import { createInterface } from "node:readline"
import { spawn } from "node:child_process"
import { writeFile } from "node:fs/promises"
import { join } from "node:path"

const turns = new Map()

function exactKeys(value, allowed, method, id) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key))
  if (unknown.length === 0) return true
  send({ id, error: { code: -32602, message: `${method} unknown keys: ${unknown.join(",")}` } })
  return false
}

function send(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}

function thread(id) {
  return { id, sessionId: `session-${id}`, turns: [], cwd: process.cwd() }
}

function turn(id, status = "inProgress") {
  return { id, items: [], itemsView: "full", status, error: null, startedAt: 1, completedAt: null, durationMs: null }
}

function complete(threadId, turnId, status = "completed") {
  send({ method: "turn/completed", params: { threadId, turn: { ...turn(turnId, status), completedAt: 2, durationMs: 1 } } })
}

const input = createInterface({ input: process.stdin })
input.on("line", (line) => {
  const message = JSON.parse(line)
  if (message.method === "initialize") {
    send({ id: message.id, result: { userAgent: "fake-codex", codexHome: "/fake", platformFamily: "unix", platformOs: "test" } })
  } else if (message.method === "initialized") {
    return
  } else if (message.method === "thread/start") {
    if (!exactKeys(message.params, ["model", "cwd", "approvalPolicy", "approvalsReviewer", "sandbox", "config", "developerInstructions", "ephemeral"], "thread/start", message.id)) return
    const id = "thread-1"
    send({ id: message.id, result: { thread: thread(id), model: message.params.model, cwd: message.params.cwd } })
    send({ method: "thread/started", params: { thread: thread(id) } })
  } else if (message.method === "thread/resume") {
    if (!exactKeys(message.params, ["threadId", "model", "cwd", "approvalPolicy", "approvalsReviewer", "sandbox", "config", "developerInstructions"], "thread/resume", message.id)) return
    send({ id: message.id, result: { thread: thread(message.params.threadId), model: message.params.model, cwd: message.params.cwd } })
  } else if (message.method === "turn/start") {
    if (!exactKeys(message.params, ["threadId", "input", "cwd", "approvalPolicy", "approvalsReviewer", "sandboxPolicy", "model"], "turn/start", message.id)) return
    const turnId = `turn-${turns.size + 1}`
    const text = message.params.input[0].text
    turns.set(turnId, { threadId: message.params.threadId, text })
    send({ id: message.id, result: { turn: turn(turnId) } })
    send({ method: "turn/started", params: { threadId: message.params.threadId, turn: turn(turnId) } })
    if (text === "wait") return
    if (text === "failed") {
      complete(message.params.threadId, turnId, "failed")
      return
    }
    if (text === "oversized") {
      send({ method: "warning", params: { message: "X".repeat(8_192) } })
      return
    }
    if (text === "flood") {
      for (let index = 0; index < 64; index += 1) {
        send({ method: "item/agentMessage/delta", params: { threadId: message.params.threadId, turnId, itemId: "item-flood", delta: String(index) } })
      }
      complete(message.params.threadId, turnId)
      return
    }
    if (text === "sensitive") {
      send({ method: "item/agentMessage/delta", params: { threadId: message.params.threadId, turnId, itemId: "sensitive", delta: `cwd=${message.params.cwd} codexHome=${process.env.CODEX_HOME ?? "unset"} token=top-secret\u0000` } })
      complete(message.params.threadId, turnId)
      return
    }
    if (text === "descendant" || text === "descendant-leader-exit") {
      const descendant = spawn(process.execPath, ["-e", 'process.on("SIGTERM",()=>{});setInterval(()=>{},1000)'], { stdio: "ignore" })
      send({ method: "item/agentMessage/delta", params: { threadId: message.params.threadId, turnId, itemId: "descendant", delta: `pid=${String(descendant.pid)}` } })
      if (text === "descendant-leader-exit") setTimeout(() => process.exit(17), 10)
      return
    }
    if (text === "approval") {
      send({
        id: "approval-1",
        method: "item/commandExecution/requestApproval",
        params: { threadId: message.params.threadId, turnId, itemId: "command-1", startedAtMs: 1, reason: "test", command: "echo test" },
      })
      return
    }
    if (text === "write-stage") {
      void writeFile(join(message.params.cwd, "source.txt"), "managed update").then(
        () => complete(message.params.threadId, turnId),
        (error) => send({
          method: "error",
          params: {
            threadId: message.params.threadId,
            turnId,
            willRetry: false,
            error: { message: error instanceof Error ? error.message : String(error) },
          },
        }),
      )
      return
    }
    send({ method: "item/started", params: { threadId: message.params.threadId, turnId, item: { type: "agentMessage", id: "item-1" } } })
    send({ method: "item/agentMessage/delta", params: { threadId: message.params.threadId, turnId, itemId: "item-1", delta: "hello" } })
    send({ method: "item/completed", params: { threadId: message.params.threadId, turnId, item: { type: "agentMessage", id: "item-1" } } })
    complete(message.params.threadId, turnId)
  } else if (message.method === "turn/interrupt") {
    send({ id: message.id, result: {} })
    complete(message.params.threadId, message.params.turnId, "interrupted")
  } else if (message.id === "approval-1") {
    send({ method: "item/agentMessage/delta", params: { threadId: "thread-1", turnId: "turn-1", itemId: "approval-result", delta: `approval=${message.result.decision}` } })
    complete("thread-1", "turn-1")
  } else if (message.id !== undefined) {
    send({ id: message.id, error: { code: -32601, message: `unknown method ${String(message.method)}` } })
  }
})
