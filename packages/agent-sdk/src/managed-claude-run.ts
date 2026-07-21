import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"

import { createManagedClaudeAnalysisInvocation, type ManagedClaudeAnalysisRequest } from "./managed-claude.js"
import {
  BoundedAsyncQueue,
  type ManagedRuntimeEvent,
  type ManagedRuntimeResultEnvelope,
  type ManagedTerminalDisposition,
  type UnsequencedManagedRuntimeEvent,
} from "./managed-runtime.js"
import type { ExecutableFingerprint } from "./process.js"

export interface ManagedClaudeContextRunRequest extends ManagedClaudeAnalysisRequest {
  runtimeVersion?: string
  capabilityDigest?: `sha256:${string}`
  executableFingerprint?: ExecutableFingerprint
  timeoutMs?: number
  maxOutputBytes?: number
  maxLineBytes?: number
}

export interface ManagedClaudeContextRunCompletion {
  result: ManagedRuntimeResultEnvelope
  terminationCause: "normal" | "cancel-request" | "timeout" | "provider-failure" | "protocol-error"
}

export interface ManagedClaudeContextRunHandle {
  readonly events: AsyncIterable<ManagedRuntimeEvent>
  readonly completion: Promise<ManagedClaudeContextRunCompletion>
  cancel(reason?: string): Promise<void>
}

const defaultTimeoutMs = 30 * 60 * 1_000

function positiveBound(value: number, label: string, maximum: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${label} must be between 1 and ${maximum}`)
  }
  return value
}

function portableRuntimeVersion(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  const version = value.trim()
  if (!version || Buffer.byteLength(version) > 1_024 || /[/\\][\w.-]+[/\\]/u.test(version)) {
    throw new Error("Managed Claude runtime version must be bounded and path-free")
  }
  return version
}

function textParts(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return []
  const content = (value as Record<string, unknown>).content
  if (!Array.isArray(content)) return []
  return content.flatMap((part) => {
    if (!part || typeof part !== "object" || Array.isArray(part)) return []
    const candidate = part as Record<string, unknown>
    return candidate.type === "text" && typeof candidate.text === "string" ? [candidate.text] : []
  })
}

function signalProcessTree(child: ChildProcessWithoutNullStreams, signal: NodeJS.Signals): void {
  if (!child.pid) return
  if (process.platform !== "win32") {
    try {
      process.kill(-child.pid, signal)
      return
    } catch {
      // Fall through to the direct-child fallback.
    }
  }
  try {
    child.kill(signal)
  } catch {
    // The hard-stop timer still bounds shutdown.
  }
}

export async function startManagedClaudeContextRun(
  request: ManagedClaudeContextRunRequest,
): Promise<ManagedClaudeContextRunHandle> {
  const timeoutMs = positiveBound(request.timeoutMs ?? defaultTimeoutMs, "Managed Claude timeout", 24 * 60 * 60 * 1_000)
  const maxOutputBytes = positiveBound(request.maxOutputBytes ?? 16 * 1024 * 1024, "Managed Claude output bound", 64 * 1024 * 1024)
  const maxLineBytes = positiveBound(request.maxLineBytes ?? 1024 * 1024, "Managed Claude line bound", 4 * 1024 * 1024)
  const invocation = await createManagedClaudeAnalysisInvocation(request)
  const events = new BoundedAsyncQueue<ManagedRuntimeEvent>(4_096, 32 * 1024 * 1024)
  const collected: ManagedRuntimeEvent[] = []
  let sequence = 0
  let child: ChildProcessWithoutNullStreams | undefined
  let providerThreadId: string | undefined
  let providerTurnId: string | undefined
  let cancelRequested = false
  let timeoutTriggered = false
  let protocolFailed = false
  let settled = false
  let stopOperation: Promise<void> | undefined

  const emit = (event: UnsequencedManagedRuntimeEvent): void => {
    if (collected.length >= 4_096) throw new Error("Managed Claude event count exceeded its configured bound")
    const normalized = {
      ...event,
      sequence: sequence++,
      observedAt: new Date().toISOString(),
      threadId: providerThreadId,
      turnId: providerTurnId,
    } as ManagedRuntimeEvent
    collected.push(normalized)
    events.push(normalized)
  }

  const stop = async (): Promise<void> => {
    if (stopOperation) return stopOperation
    stopOperation = (async () => {
      const processToStop = child
      if (!processToStop || processToStop.exitCode !== null || processToStop.signalCode !== null) return
      signalProcessTree(processToStop, "SIGTERM")
      await new Promise<void>((resolve) => {
        const closed = (): void => {
          clearTimeout(timer)
          resolve()
        }
        const timer = setTimeout(() => {
          processToStop.off("close", closed)
          signalProcessTree(processToStop, "SIGKILL")
          resolve()
        }, 500)
        timer.unref()
        processToStop.once("close", closed)
      })
    })()
    return stopOperation
  }

  const completion = (async (): Promise<ManagedClaudeContextRunCompletion> => {
    let terminalDisposition: ManagedTerminalDisposition = "unknown"
    let terminationCause: ManagedClaudeContextRunCompletion["terminationCause"] = "protocol-error"
    let resultObserved = false
    let outputBytes = 0
    let stdoutBuffer = ""
    let timer: NodeJS.Timeout | undefined
    try {
      child = spawn(invocation.invocation.executable, invocation.invocation.args, {
        cwd: invocation.invocation.cwd,
        env: invocation.invocation.environment,
        stdio: ["pipe", "pipe", "pipe"],
        detached: true,
        windowsHide: true,
      })
      const close = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
        child!.once("error", reject)
        child!.once("close", (code, signal) => resolve({ code, signal }))
      })
      emit({ type: "lifecycle", phase: "initialized" })
      timer = setTimeout(() => {
        timeoutTriggered = true
        void stop()
      }, timeoutMs)
      timer.unref()

      const parseLine = (line: string): void => {
        if (!line.trim()) return
        if (Buffer.byteLength(line) > maxLineBytes) throw new Error("Managed Claude protocol line exceeded its configured bound")
        let message: unknown
        try {
          message = JSON.parse(line)
        } catch {
          throw new Error("Managed Claude emitted malformed stream JSON")
        }
        if (!message || typeof message !== "object" || Array.isArray(message)) return
        const record = message as Record<string, unknown>
        if (typeof record.session_id === "string" && record.session_id.trim()) providerThreadId = record.session_id
        if (typeof record.uuid === "string" && record.uuid.trim()) providerTurnId = record.uuid
        if (record.type === "system" && record.subtype === "init") {
          emit({ type: "lifecycle", phase: "thread-started" })
          return
        }
        if (record.type === "assistant") {
          for (const text of textParts(record.message)) emit({ type: "output-delta", channel: "assistant", text })
          return
        }
        if (record.type === "result") {
          resultObserved = true
          const isError = record.is_error === true || record.subtype === "error"
          terminalDisposition = isError ? "failed" : "completed"
          terminationCause = isError ? "provider-failure" : "normal"
          emit({ type: "lifecycle", phase: "turn-completed", turnStatus: isError ? "failed" : "completed" })
        }
      }

      child.stdout.setEncoding("utf8")
      child.stdout.on("data", (chunk: string) => {
        try {
          outputBytes += Buffer.byteLength(chunk)
          if (outputBytes > maxOutputBytes) throw new Error("Managed Claude output exceeded its configured bound")
          stdoutBuffer += chunk
          let newline = stdoutBuffer.indexOf("\n")
          while (newline >= 0) {
            const line = stdoutBuffer.slice(0, newline)
            stdoutBuffer = stdoutBuffer.slice(newline + 1)
            parseLine(line)
            newline = stdoutBuffer.indexOf("\n")
          }
          if (Buffer.byteLength(stdoutBuffer) > maxLineBytes) throw new Error("Managed Claude protocol line exceeded its configured bound")
        } catch {
          protocolFailed = true
          terminalDisposition = "protocol-error"
          terminationCause = "protocol-error"
          void stop()
        }
      })
      child.stderr.on("data", (chunk: Buffer) => {
        outputBytes += chunk.length
        if (outputBytes > maxOutputBytes) {
          protocolFailed = true
          terminalDisposition = "protocol-error"
          terminationCause = "protocol-error"
          void stop()
        }
      })
      child.stdin.end(invocation.invocation.stdin ?? "")
      const closed = await close
      if (stdoutBuffer.trim() && !protocolFailed) parseLine(stdoutBuffer)
      if (timeoutTriggered) {
        terminalDisposition = "interrupted"
        terminationCause = "timeout"
      } else if (cancelRequested) {
        terminalDisposition = "cancelled"
        terminationCause = "cancel-request"
      } else if (protocolFailed) {
        terminalDisposition = "protocol-error"
        terminationCause = "protocol-error"
      } else if (!resultObserved) {
        terminalDisposition = closed.code === 0 ? "protocol-error" : "crashed"
        terminationCause = closed.code === 0 ? "protocol-error" : "provider-failure"
      }
    } catch {
      terminalDisposition = timeoutTriggered
        ? "interrupted"
        : cancelRequested
          ? "cancelled"
          : "protocol-error"
      terminationCause = timeoutTriggered
        ? "timeout"
        : cancelRequested
          ? "cancel-request"
          : "protocol-error"
      try {
        emit({ type: "error", message: "Managed Claude coordination failed.", code: "GAEP_MANAGED_CLAUDE_FAILURE", retryable: false })
      } catch {
        // Preserve the primary bounded-queue failure.
      }
      await stop().catch(() => undefined)
    } finally {
      if (timer) clearTimeout(timer)
      settled = true
      events.close()
      await invocation.cleanup().catch(() => undefined)
    }
    return {
      result: {
        portable: {
          schemaVersion: 1,
          provider: {
            adapterId: "gaep.claude-code-cli",
            agentId: "claude-code-cli",
            runtimeVersion: portableRuntimeVersion(request.runtimeVersion),
            capabilityDigest: request.capabilityDigest,
          },
          providerThreadId,
          providerTurnId,
          events: collected,
          terminalDisposition,
          warnings: ["Managed Claude execution was tool-free and context-only."],
          postconditionStatus: "not-assessed",
        },
        local: {
          executablePath: request.executable,
          executableFingerprint: request.executableFingerprint,
        },
      },
      terminationCause,
    }
  })().catch((error: unknown) => {
    events.fail(error instanceof Error ? error : new Error(String(error)))
    throw error
  })

  return {
    events,
    completion,
    cancel: async (_reason?: string): Promise<void> => {
      if (settled || cancelRequested) return
      cancelRequested = true
      await stop()
    },
  }
}
