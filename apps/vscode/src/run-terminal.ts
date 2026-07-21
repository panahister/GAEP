import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"

import { fingerprintExecutable, type AgentInvocation, type ExecutableFingerprint } from "@gaep/agent-sdk"
import type { GaepEngine } from "@gaep/engine"
import * as vscode from "vscode"

import type { ManagedAgentRun } from "./run-registry.js"
import { sameExecutableFingerprint } from "./runtime-binding.js"
import { filteredAgentEnvironment } from "./safety.js"
import {
  maximumProviderChunkCharacters,
  maximumProviderEventCharacters,
  maximumRenderedProviderCharacters,
  OutputLimiter,
  prefixTerminalLines,
  ProcessTerminationTracker,
  runExitDisposition,
  Utf8StreamDecoder,
} from "./terminal-safety.js"

const maximumRenderedSystemCharacters = 64 * 1024
const maximumSessionIdentifierCharacters = 1_024
const maximumInteractiveInputCharacters = 1024 * 1024

export class AgentRunTerminal implements vscode.Pseudoterminal, ManagedAgentRun {
  private readonly writeEmitter = new vscode.EventEmitter<string>()
  private readonly closeEmitter = new vscode.EventEmitter<number>()
  readonly onDidWrite = this.writeEmitter.event
  readonly onDidClose = this.closeEmitter.event
  readonly rootPath: string
  private readonly providerOutput = new OutputLimiter(maximumRenderedProviderCharacters)
  private readonly systemOutput = new OutputLimiter(maximumRenderedSystemCharacters)
  private readonly interactiveInput = new OutputLimiter(maximumInteractiveInputCharacters)
  private readonly termination = new ProcessTerminationTracker()
  private readonly stdoutDecoder = new Utf8StreamDecoder()
  private readonly stderrDecoder = new Utf8StreamDecoder()
  private resolveCompletion: () => void = () => undefined
  private readonly completion = new Promise<void>((resolve) => {
    this.resolveCompletion = resolve
  })
  private child?: ChildProcessWithoutNullStreams
  private providerSessionId?: string
  private buffer = ""
  private finalized = false
  private started = false
  private spawnedSuccessfully = false
  private stopRequested = false
  private discardingOversizedLine = false
  private oversizedInputAnnounced = false
  private forceKillTimer?: NodeJS.Timeout
  private runningTransition: Promise<void> = Promise.resolve()
  private startFailureDetail?: string

  constructor(
    private readonly engine: GaepEngine,
    readonly runId: string,
    private readonly invocation: AgentInvocation,
    private readonly expectedExecutable: ExecutableFingerprint,
    private readonly onStateChange: () => void = () => undefined,
    private readonly onFinalized: () => void = () => undefined,
  ) {
    this.rootPath = invocation.cwd
  }

  open(): void {
    if (this.started || this.finalized) return
    this.started = true
    void this.start()
  }

  private async start(): Promise<void> {
    this.emitSystem(`Run ${this.runId}`)
    this.emitSystem("Provider-native controls enforce the effective run boundary; GAEP records the exact Charter and outcome evidence.")
    for (const warning of this.invocation.warnings.slice(0, 20)) this.emitSystem(`Warning: ${warning}`)
    if (this.invocation.warnings.length > 20) this.emitSystem("Additional provider warnings were truncated.")

    const environment = filteredAgentEnvironment(
      process.env,
      this.invocation.environment,
      this.invocation.environmentPolicy?.allowedKeys,
    )
    environment.GAEP_RUN_ID = this.runId
    try {
      const launchFingerprint = await fingerprintExecutable(this.invocation.executable)
      if (!sameExecutableFingerprint(this.expectedExecutable, launchFingerprint)) {
        await this.finalize(
          "failed",
          1,
          "The selected agent executable changed after confirmation; GAEP refused to launch it. Probe and select the agent again.",
        )
        return
      }
    } catch (error) {
      await this.finalize(
        "failed",
        1,
        `GAEP could not verify the selected executable immediately before launch: ${error instanceof Error ? error.message : "unknown error"}`,
      )
      return
    }
    try {
      this.child = spawn(this.invocation.executable, this.invocation.args, {
        cwd: this.invocation.cwd,
        env: environment,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
        detached: process.platform !== "win32",
      })
    } catch (error) {
      this.termination.markExited()
      await this.finalize("failed", 1, error instanceof Error ? error.message : "Unable to create provider process")
      return
    }

    const child = this.child
    child.stdout.on("data", (chunk: Buffer) => this.consume(this.stdoutDecoder.write(chunk)))
    child.stderr.on("data", (chunk: Buffer) => this.consumeStderr(this.stderrDecoder.write(chunk)))
    child.on("close", (code, signal) => {
      const stdoutTail = this.stdoutDecoder.end()
      if (stdoutTail) this.consume(stdoutTail)
      const stderrTail = this.stderrDecoder.end()
      if (stderrTail) this.consumeStderr(stderrTail)
      this.termination.markExited()
      if (this.forceKillTimer) clearTimeout(this.forceKillTimer)
      void this.finish(code, signal)
    })

    const spawned = new Promise<void>((resolve, reject) => {
      child.once("spawn", () => {
        this.spawnedSuccessfully = true
        resolve()
      })
      child.once("error", reject)
    })
    this.runningTransition = spawned.then(async () => {
      await this.engine.markRunState(this.runId, "running", { kind: "system", id: "gaep.vscode" })
      this.onStateChange()
    })
    try {
      await this.runningTransition
      if (this.invocation.stdin !== undefined && child.stdin.writable) child.stdin.end(this.invocation.stdin)
      if (this.stopRequested) this.terminate("SIGTERM")
    } catch (error) {
      this.startFailureDetail = error instanceof Error ? error.message : "Unknown spawn or start-state failure"
      this.emitSystem(`Unable to start agent: ${this.startFailureDetail}`)
      if (this.spawnedSuccessfully) {
        this.terminate("SIGTERM")
      } else {
        this.termination.markExited()
        await this.finalize("failed", 1, this.startFailureDetail)
      }
    }
  }

  private async finish(code: number | null, signal: NodeJS.Signals | null): Promise<void> {
    await this.runningTransition.catch(() => undefined)
    if (this.startFailureDetail) {
      await this.finalize("failed", code ?? 1, this.startFailureDetail)
      return
    }
    const disposition = runExitDisposition(this.stopRequested, code, signal)
    await this.finalize(disposition.state, disposition.terminalCode, disposition.detail)
  }

  private async finalize(
    state: "failed" | "cancelled" | "unknown",
    terminalCode: number,
    detail?: string,
  ): Promise<void> {
    if (this.finalized) return
    this.finalized = true
    if (this.forceKillTimer) clearTimeout(this.forceKillTimer)
    if (this.discardingOversizedLine) this.emitSystem("An oversized incomplete provider event was discarded.")
    if (this.buffer.trim()) this.processProviderLine(this.buffer)
    this.buffer = ""
    if (detail) this.emitSystem(detail)
    try {
      await this.engine.markRunState(
        this.runId,
        state,
        { kind: "system", id: "gaep.vscode" },
        this.providerSessionId,
      )
      this.emitSystem(`Recorded run state: ${state}`)
    } catch (error) {
      this.emitSystem(`Could not persist final run state: ${error instanceof Error ? error.message : "unknown failure"}`)
    } finally {
      this.onStateChange()
      this.onFinalized()
      this.closeEmitter.fire(terminalCode)
      this.resolveCompletion()
    }
  }

  close(): void {
    if (this.finalized) return
    this.stopRequested = true
    if (!this.started) {
      this.termination.markExited()
      void this.finalize("cancelled", 1, "Run cancelled before the provider process started.")
      return
    }
    this.terminate("SIGTERM")
  }

  async stopAndWait(timeoutMs = 8_000): Promise<void> {
    this.close()
    let timeout: NodeJS.Timeout | undefined
    try {
      await Promise.race([
        this.completion,
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => reject(new Error(`Run ${this.runId} did not exit within ${timeoutMs}ms`)), timeoutMs)
        }),
      ])
    } finally {
      if (timeout) clearTimeout(timeout)
    }
  }

  handleInput(data: string): void {
    if (data === "\u0003") {
      this.stopRequested = true
      this.terminate("SIGINT")
      return
    }
    if (this.invocation.stdin === undefined && this.child?.stdin.writable) {
      const limited = this.interactiveInput.take(data)
      if (limited.value) this.child.stdin.write(limited.value)
      if (limited.truncationStarted) {
        this.emitSystem(`Interactive provider input was capped at ${maximumInteractiveInputCharacters} characters.`)
      }
    }
  }

  private terminate(signal: NodeJS.Signals): void {
    const child = this.child
    if (!child || this.termination.hasExited) return
    const shouldSignal = signal === "SIGKILL"
      ? this.termination.requestForceSignal()
      : this.termination.requestGracefulSignal()
    if (!shouldSignal) return
    try {
      if (process.platform !== "win32" && child.pid) process.kill(-child.pid, signal)
      else child.kill(signal)
    } catch {
      try {
        child.kill(signal)
      } catch {
        // The close/error event owns final state; failed signaling remains visible through the stop timeout.
      }
    }
    if (signal !== "SIGKILL" && !this.forceKillTimer) {
      this.forceKillTimer = setTimeout(() => this.terminate("SIGKILL"), 5_000)
      this.forceKillTimer.unref()
    }
  }

  private emitSystem(value: string): void {
    const framed = `${prefixTerminalLines("[GAEP]", value)}\r\n`
    const limited = this.systemOutput.take(framed)
    if (limited.value) this.writeEmitter.fire(limited.value)
    if (limited.truncationStarted) this.writeEmitter.fire("[GAEP] Further GAEP diagnostic output was truncated.\r\n")
  }

  private emitProvider(source: "provider" | "provider stderr", value: string): void {
    const framed = `${prefixTerminalLines(`[${source}]`, value)}\r\n`
    const limited = this.providerOutput.take(framed)
    if (limited.value) this.writeEmitter.fire(limited.value)
    if (limited.truncationStarted) {
      this.emitSystem(`Provider output was truncated after ${maximumRenderedProviderCharacters} rendered characters.`)
    }
  }

  private consumeStderr(value: string): void {
    if (this.providerOutput.truncated) return
    if (value.length > maximumProviderChunkCharacters) {
      this.emitProvider("provider stderr", value.slice(0, maximumProviderChunkCharacters))
      this.emitSystem(`An oversized provider stderr chunk was truncated at ${maximumProviderChunkCharacters} characters.`)
      return
    }
    this.emitProvider("provider stderr", value)
  }

  private consume(chunk: string): void {
    if (this.providerOutput.truncated) return
    if (chunk.length > maximumProviderChunkCharacters) {
      this.buffer = ""
      this.discardingOversizedLine = true
      this.announceOversizedInput("provider output chunk")
      return
    }
    let remaining = chunk
    if (this.discardingOversizedLine) {
      const newline = remaining.indexOf("\n")
      if (newline < 0) return
      remaining = remaining.slice(newline + 1)
      this.discardingOversizedLine = false
    }
    this.buffer += remaining
    let newline = this.buffer.indexOf("\n")
    while (newline >= 0) {
      const line = this.buffer.slice(0, newline)
      this.buffer = this.buffer.slice(newline + 1)
      if (line.length > maximumProviderEventCharacters) {
        this.announceOversizedInput("provider event")
      } else if (line.trim()) {
        this.processProviderLine(line)
      }
      if (this.providerOutput.truncated) {
        this.buffer = ""
        return
      }
      newline = this.buffer.indexOf("\n")
    }
    if (this.buffer.length > maximumProviderEventCharacters) {
      this.buffer = ""
      this.discardingOversizedLine = true
      this.announceOversizedInput("provider event")
    }
  }

  private announceOversizedInput(kind: string): void {
    if (this.oversizedInputAnnounced) return
    this.oversizedInputAnnounced = true
    this.emitSystem(`An oversized ${kind} was discarded at the ${maximumProviderEventCharacters}-character event boundary.`)
  }

  private processProviderLine(line: string): void {
    this.captureSession(line)
    this.emitProvider("provider", this.renderLine(line))
  }

  private captureSession(line: string): void {
    try {
      const event = JSON.parse(line) as Record<string, unknown>
      const candidate = event.session_id ?? event.thread_id ??
        (event.thread && typeof event.thread === "object" ? (event.thread as Record<string, unknown>).id : undefined)
      if (typeof candidate === "string" && candidate.length <= maximumSessionIdentifierCharacters &&
        /^[\x20-\x7E]+$/.test(candidate)) {
        this.providerSessionId = candidate
      }
    } catch {
      // Provider output may include non-JSON diagnostics.
    }
  }

  private renderLine(line: string): string {
    try {
      const event = JSON.parse(line) as Record<string, unknown>
      const message = event.message ?? event.result ?? event.text
      if (typeof message === "string") return message
      const type = typeof event.type === "string" ? event.type : "agent-event"
      return `[${type}] ${line}`
    } catch {
      return line
    }
  }
}
