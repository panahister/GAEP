let input = ""
process.stdin.setEncoding("utf8")
process.stdin.on("data", (chunk) => { input += chunk })
process.stdin.on("end", () => {
  const diagnostic = "Not logged in · Please run /login at /Users/alice/private token=abc123456789"
  process.stdout.write(`${JSON.stringify({
    type: "system",
    subtype: "init",
    session_id: "session-auth-failure",
  })}\n`)
  process.stdout.write(`${JSON.stringify({
    type: "assistant",
    session_id: "session-auth-failure",
    uuid: "turn-auth-failure",
    message: { content: [{ type: "text", text: diagnostic }] },
  })}\n`)
  process.stdout.write(`${JSON.stringify({
    type: "result",
    subtype: "error",
    is_error: true,
    result: diagnostic,
    session_id: "session-auth-failure",
  })}\n`)
})
