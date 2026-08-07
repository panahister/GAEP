import { createInterface } from "node:readline"

let threadParams

function send(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}

function thread(id) {
  return { id, sessionId: `session-${id}`, turns: [], cwd: process.cwd() }
}

function turn(id, status = "inProgress") {
  return { id, items: [], itemsView: "full", status, error: null, startedAt: 1, completedAt: null, durationMs: null }
}

const input = createInterface({ input: process.stdin })
input.on("line", (line) => {
  const message = JSON.parse(line)
  if (message.method === "initialize") {
    send({ id: message.id, result: { userAgent: "fake-codex-output-schema", codexHome: "/fake", platformFamily: "unix", platformOs: "test" } })
    return
  }
  if (message.method === "initialized") return
  if (message.method === "thread/start") {
    threadParams = message.params
    const value = thread("thread-1")
    send({ id: message.id, result: { thread: value, model: message.params.model, cwd: message.params.cwd } })
    send({ method: "thread/started", params: { thread: value } })
    return
  }
  if (message.method === "turn/start") {
    const turnId = "turn-1"
    send({ id: message.id, result: { turn: turn(turnId) } })
    send({ method: "turn/started", params: { threadId: message.params.threadId, turn: turn(turnId) } })
    send({
      method: "item/agentMessage/delta",
      params: {
        threadId: message.params.threadId,
        turnId,
        itemId: "policy",
        delta: `policy=${JSON.stringify({
          threadSandbox: threadParams?.sandbox,
          config: threadParams?.config,
          turnSandboxPolicy: message.params.sandboxPolicy,
          outputSchema: message.params.outputSchema,
        })}`,
      },
    })
    send({
      method: "turn/completed",
      params: {
        threadId: message.params.threadId,
        turn: { ...turn(turnId, "completed"), completedAt: 2, durationMs: 1 },
      },
    })
    return
  }
  if (message.id !== undefined) {
    send({ id: message.id, error: { code: -32601, message: `unknown method ${String(message.method)}` } })
  }
})
