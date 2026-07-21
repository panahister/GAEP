import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"

import type { AgentInvocation } from "@gaep/agent-sdk"
import type { GaepEngine } from "@gaep/engine"
import * as vscode from "vscode"

export class AgentRunTerminal implements vscode.Pseudoterminal {
  private readonly writeEmitter = new vscode.EventEmitter<string>()
  private readonly closeEmitter = new vscode.EventEmitter<number>()
  readonly onDidWrite = this.writeEmitter.event
  readonly onDidClose = this.closeEmitter.event
  private child?: ChildProcessWithoutNullStreams
  private providerSessionId?: string
  private buffer = ""

  constructor(
    private readonly engine: GaepEngine,
    private readonly runId: string,
    private readonly invocation: AgentInvocation,
  ) {}

  open(): void {
    void this.start()
  }

  private async start(): Promise<void> {
    this.writeEmitter.fire(`GAEP run ${this.runId}\r\n`)
    for (const warning of this.invocation.warnings) this.writeEmitter.fire(`Warning: ${warning}\r\n`)
    await this.engine.markRunState(this.runId, "running", { kind: "system", id: "gaep.vscode" })
    this.child = spawn(this.invocation.executable, this.invocation.args, {
      cwd: this.invocation.cwd,
      env: { ...process.env, ...this.invocation.environment },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    })
    this.child.stdout.on("data", (chunk: Buffer) => this.consume(chunk.toString("utf8")))
    this.child.stderr.on("data", (chunk: Buffer) => this.writeEmitter.fire(chunk.toString("utf8").replaceAll("\n", "\r\n")))
    this.child.on("error", (error) => this.writeEmitter.fire(`\r\nUnable to start agent: ${error.message}\r\n`))
    this.child.on("close", (code, signal) => {
      void this.finish(code, signal)
    })
  }

  private async finish(code: number | null, signal: NodeJS.Signals | null): Promise<void> {
      const state = signal ? "cancelled" : code === 0 ? "completed" : "failed"
      await this.engine.markRunState(
        this.runId,
        state,
        { kind: "system", id: "gaep.vscode" },
        this.providerSessionId,
      )
      this.writeEmitter.fire(`\r\nGAEP recorded run state: ${state}\r\n`)
      this.closeEmitter.fire(code ?? 1)
  }

  close(): void {
    this.child?.kill("SIGTERM")
  }

  handleInput(data: string): void {
    if (data === "\u0003") this.child?.kill("SIGINT")
  }

  private consume(chunk: string): void {
    this.buffer += chunk
    const lines = this.buffer.split("\n")
    this.buffer = lines.pop() ?? ""
    for (const line of lines) {
      if (!line.trim()) continue
      this.captureSession(line)
      this.writeEmitter.fire(`${this.renderLine(line)}\r\n`)
    }
  }

  private captureSession(line: string): void {
    try {
      const event = JSON.parse(line) as Record<string, unknown>
      const candidate = event.session_id ?? event.thread_id ??
        (event.thread && typeof event.thread === "object" ? (event.thread as Record<string, unknown>).id : undefined)
      if (typeof candidate === "string") this.providerSessionId = candidate
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
