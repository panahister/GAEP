import type { Disposable } from "vscode"

import { StudioMessageController } from "./studio-data-source.js"
import type { HostToStudioMessage, StudioRoute } from "./studio-protocol.js"

export interface StudioMessagePort {
  postMessage(message: HostToStudioMessage): Thenable<boolean>
  onDidReceiveMessage(listener: (message: unknown) => void): Disposable
}

export interface StudioSessionDiagnostic {
  (message: string, error?: unknown): void
}

/**
 * Serializes webview messages through the typed controller. Keeping this class
 * free of WebviewPanel concerns makes the host bridge unit-testable.
 */
export class StudioHostSession implements Disposable {
  private subscription?: Disposable
  private queue: Promise<void> = Promise.resolve()
  private readonly abortController = new AbortController()
  private disposed = false

  constructor(
    private readonly controller: StudioMessageController,
    private readonly diagnostic: StudioSessionDiagnostic,
  ) {}

  connect(port: StudioMessagePort): void {
    this.subscription?.dispose()
    this.subscription = port.onDidReceiveMessage((message) => {
      void this.enqueue(async (signal) => {
        const response = await this.controller.handle(message, signal)
        if (response && !this.disposed && !signal.aborted) await port.postMessage(response)
      })
    })
  }

  refresh(port: StudioMessagePort, route?: StudioRoute): Promise<void> {
    return this.enqueue(async (signal) => {
      const response = await this.controller.refresh(route, signal)
      if (!this.disposed && !signal.aborted) await port.postMessage(response)
    })
  }

  currentRoute(): StudioRoute {
    return this.controller.currentRoute()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.abortController.abort()
    this.subscription?.dispose()
    this.subscription = undefined
  }

  private enqueue(operation: (signal: AbortSignal) => Promise<void>): Promise<void> {
    if (this.disposed) return Promise.resolve()
    const signal = this.abortController.signal
    const run = async (): Promise<void> => {
      if (this.disposed || signal.aborted) return
      await operation(signal)
    }
    const next = this.queue.then(run, run).catch((error) => {
      if (!this.disposed && !signal.aborted) this.diagnostic("Product Studio message handling failed", error)
    })
    this.queue = next
    return next
  }
}
