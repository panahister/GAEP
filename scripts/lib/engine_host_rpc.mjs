// GAEP-P0-CS02 — a hardened newline-delimited JSON-RPC v3 client for the packaged Engine Host used
// by the realistic example. It bounds every request, fails fast when the host cannot start or exits,
// retains ONLY bounded sanitized stderr diagnostics (never raw stderr, paths, or secrets), cleans up
// pending requests deterministically, and shuts the host down gracefully (stdin close → awaited exit
// → forced kill → awaited confirmed exit; if exit cannot be confirmed, close() rejects truthfully).
import { spawn } from "node:child_process"

const MAX_SANITIZED_LINES = 5

/** Redact absolute/home paths from a single line and bound its length (INV-16/17). */
function sanitizeLine(line) {
  const redacted = String(line)
    .replace(/(?:[A-Za-z]:\\[^\s]*|(?:\/[A-Za-z0-9._-]+){2,}\/?|~\/[^\s]*)/g, "[redacted-path]")
    .trim()
  return redacted.length > 200 ? `${redacted.slice(0, 200)}…` : redacted
}

/** Sanitize a (possibly multi-line) diagnostic to a bounded single line. */
export function sanitizeDiagnostic(text) {
  return String(text)
    .split("\n")
    .map(sanitizeLine)
    .filter(Boolean)
    .slice(0, MAX_SANITIZED_LINES)
    .join(" | ")
}

export function createEngineHostRpc({ command, args, requestTimeoutMs = 15_000, shutdownGraceMs = 2_000, forceExitTimeoutMs = 2_000, maxStderrBytes = 4_096 }) {
  const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] })
  const pending = new Map()
  let buffer = ""
  let exited = false
  let exitInfo
  let nextId = 0

  // ONLY sanitized, bounded stderr lines are retained; raw stderr is never stored or exposed.
  const sanitized = []
  let stderrFragment = ""
  const pushSanitized = (line) => {
    const clean = sanitizeLine(line)
    if (!clean) return
    sanitized.push(clean)
    while (sanitized.length > MAX_SANITIZED_LINES) sanitized.shift()
  }
  const diagnostics = () => sanitized.join(" | ")

  const failAll = (error) => {
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(error) }
    pending.clear()
  }

  child.stdout.setEncoding("utf8")
  child.stdout.on("data", (chunk) => {
    buffer += chunk
    let index = buffer.indexOf("\n")
    while (index >= 0) {
      const line = buffer.slice(0, index).trim()
      buffer = buffer.slice(index + 1)
      if (line) {
        let message
        try { message = JSON.parse(line) } catch { message = undefined }
        const entry = message && pending.get(message.id)
        if (entry) {
          pending.delete(message.id)
          clearTimeout(entry.timer)
          if (message.error) entry.reject(new Error(`${message.error.data?.kind ?? "RPC_ERROR"}: ${message.error.message}`))
          else entry.resolve(message.result)
        }
      }
      index = buffer.indexOf("\n")
    }
  })
  child.stderr.setEncoding("utf8")
  child.stderr.on("data", (chunk) => {
    // Process line by line, sanitizing immediately; never retain the raw text beyond a bounded fragment.
    stderrFragment += chunk
    if (stderrFragment.length > maxStderrBytes) stderrFragment = stderrFragment.slice(-maxStderrBytes)
    let nl = stderrFragment.indexOf("\n")
    while (nl >= 0) {
      pushSanitized(stderrFragment.slice(0, nl))
      stderrFragment = stderrFragment.slice(nl + 1)
      nl = stderrFragment.indexOf("\n")
    }
  })
  child.on("error", (error) => { exited = true; failAll(new Error(`Engine Host failed to start: ${sanitizeDiagnostic(error.message)}`)) })
  child.on("exit", (code, signal) => {
    exited = true
    exitInfo = { code, signal }
    if (stderrFragment) { pushSanitized(stderrFragment); stderrFragment = "" }
    const tail = diagnostics()
    failAll(new Error(`Engine Host exited (code=${code ?? "null"}, signal=${signal ?? "null"})${tail ? `: ${tail}` : ""}`))
  })

  const request = (method, params = {}) => new Promise((resolve, reject) => {
    if (exited) { reject(new Error("Engine Host is not running")); return }
    const id = ++nextId
    const timer = setTimeout(() => {
      if (pending.delete(id)) reject(new Error(`Engine Host request timed out after ${requestTimeoutMs}ms: ${method}`))
    }, requestTimeoutMs)
    if (typeof timer.unref === "function") timer.unref()
    pending.set(id, { resolve, reject, timer })
    try {
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, protocolVersion: 3, method, params })}\n`)
    } catch (error) {
      pending.delete(id)
      clearTimeout(timer)
      reject(new Error(`Engine Host stdin write failed: ${sanitizeDiagnostic(error.message)}`))
    }
  })

  /** Fail fast if the host dies during startup instead of hanging. */
  const awaitReady = async (probeMethod = "dashboardProjection") => { await request(probeMethod) }

  const waitForExit = (ms) => new Promise((resolve) => {
    if (exited) { resolve(true); return }
    const timer = setTimeout(() => resolve(false), ms)
    if (typeof timer.unref === "function") timer.unref()
    child.once("exit", () => { clearTimeout(timer); resolve(true) })
  })

  /**
   * Graceful shutdown: close stdin and WAIT for a real exit. If the host ignores it past the grace,
   * force-kill and WAIT for the confirmed exit. Only returns once termination is confirmed; if the
   * process cannot be confirmed dead within the final bounded timeout, reject truthfully. Pending
   * requests are always rejected and removed.
   */
  const close = async () => {
    if (exited) { failAll(new Error("Engine Host shut down")); return exitInfo }
    try { child.stdin.end() } catch { /* already closed */ }
    if (!(await waitForExit(shutdownGraceMs))) {
      try { child.kill("SIGKILL") } catch { /* already gone */ }
      if (!(await waitForExit(forceExitTimeoutMs))) {
        failAll(new Error("Engine Host shut down"))
        throw new Error("Engine Host did not exit after SIGKILL within the shutdown timeout")
      }
    }
    failAll(new Error("Engine Host shut down"))
    return exitInfo
  }

  return { request, awaitReady, close, diagnostics, get exited() { return exited } }
}
