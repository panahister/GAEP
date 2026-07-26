const modelIndex = process.argv.indexOf("--model")
const mode = modelIndex >= 0 ? process.argv[modelIndex + 1] : "success"

let input = ""
process.stdin.setEncoding("utf8")
process.stdin.on("data", (chunk) => { input += chunk })
process.stdin.on("end", () => {
  if (mode === "malformed") {
    process.stdout.write("{not-json}\n")
    return
  }
  if (mode === "no-result") {
    process.stdout.write(`${JSON.stringify({ type: "system", subtype: "init", session_id: "session-no-result" })}\n`)
    return
  }
  if (mode === "wait") {
    process.stdout.write(`${JSON.stringify({ type: "system", subtype: "init", session_id: "session-wait" })}\n`)
    setInterval(() => undefined, 1_000)
    return
  }
  const sessionId = `session-${mode}`
  process.stdout.write(`${JSON.stringify({ type: "system", subtype: "init", session_id: sessionId })}\n`)
  if (mode === "auth-failure") {
    // Model an unauthenticated Claude CLI: is_error with a "Not logged in" result and an exit code.
    process.stdout.write(`${JSON.stringify({ type: "result", subtype: "success", is_error: true, terminal_reason: "api_error", result: "Not logged in · Please run /login", session_id: sessionId })}\n`)
    process.exitCode = 1
    return
  }
  process.stdout.write(`${JSON.stringify({
    type: "assistant",
    session_id: sessionId,
    uuid: `turn-${mode}`,
    message: { content: [{ type: "text", text: `analysis for ${input.length} bytes at /Users/alice/private token=abc123456789` }] },
  })}\n`)
  process.stdout.write(`${JSON.stringify({
    type: "result",
    subtype: mode === "failure" ? "error" : "success",
    is_error: mode === "failure",
    session_id: sessionId,
  })}\n`)
})
