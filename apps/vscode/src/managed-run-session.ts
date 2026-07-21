import type { ManagedEvidenceEvent } from "@gaep/contracts"
import type { ManagedExecutionHandle, ManagedExecutionReview } from "@gaep/engine"

import type { ManagedAgentRun } from "./run-registry.js"

export interface ManagedRunSessionCallbacks {
  onEvent(event: ManagedEvidenceEvent): void | Promise<void>
  onReview(review: ManagedExecutionReview): void | Promise<void>
  onError(error: Error): void | Promise<void>
  onSettled(): void | Promise<void>
}

function normalizedError(error: unknown): Error {
  return error instanceof Error ? error : new Error("Unknown Managed Run session failure")
}

export class ManagedRunSession implements ManagedAgentRun {
  readonly runId: string
  readonly rootPath: string
  readonly completion: Promise<ManagedExecutionReview>
  private readonly handle: ManagedExecutionHandle
  private settled = false

  constructor(
    rootPath: string,
    handle: ManagedExecutionHandle,
    callbacks: ManagedRunSessionCallbacks,
  ) {
    this.rootPath = rootPath
    this.handle = handle
    this.runId = handle.record.id
    const drain = (async (): Promise<void> => {
      for await (const event of handle.events) await callbacks.onEvent(event)
    })()
    this.completion = (async (): Promise<ManagedExecutionReview> => {
      try {
        const review = await handle.completion
        await drain
        await callbacks.onReview(review)
        return review
      } catch (error) {
        const failure = normalizedError(error)
        await callbacks.onError(failure)
        throw failure
      } finally {
        this.settled = true
        await callbacks.onSettled()
      }
    })()
    void this.completion.catch(() => undefined)
  }

  async stopAndWait(timeoutMs = 10_000): Promise<void> {
    if (!this.settled) await this.handle.cancel("VS Code requested Managed Run shutdown")
    let timer: NodeJS.Timeout | undefined
    try {
      await Promise.race([
        this.completion.then(() => undefined),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error(`Managed Run ${this.runId} did not stop within ${timeoutMs} ms`)), timeoutMs)
        }),
      ])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
}
