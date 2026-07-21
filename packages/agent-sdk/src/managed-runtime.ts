import type { ExecutableFingerprint } from "./process.js"

export type ManagedTerminalDisposition =
  | "completed"
  | "failed"
  | "cancelled"
  | "interrupted"
  | "crashed"
  | "protocol-error"
  | "unknown"

export type ManagedPostconditionStatus = "satisfied" | "failed" | "not-assessed" | "indeterminate"

interface ManagedEventBase {
  sequence: number
  observedAt: string
  threadId?: string
  turnId?: string
}

export type ManagedRuntimeEvent =
  | (ManagedEventBase & {
      type: "lifecycle"
      phase: "initialized" | "thread-started" | "thread-resumed" | "turn-started" | "turn-completed" | "cancelled" | "restarted"
      turnStatus?: "completed" | "interrupted" | "failed"
    })
  | (ManagedEventBase & {
      type: "output-delta"
      channel: "assistant" | "reasoning" | "plan" | "command" | "file-change"
      text: string
    })
  | (ManagedEventBase & {
      type: "item"
      itemId: string
      itemType: string
      status: "started" | "completed"
    })
  | (ManagedEventBase & {
      type: "approval"
      requestId: string
      approvalKind: "command" | "file-change" | "permissions" | "unsupported"
      outcome: "allowed-once" | "denied" | "unsupported"
      authorizationId?: string
    })
  | (ManagedEventBase & {
      type: "warning"
      message: string
    })
  | (ManagedEventBase & {
      type: "error"
      message: string
      code?: string
      retryable: boolean
    })

type WithoutEventEnvelope<T> = T extends unknown
  ? Omit<T, "sequence" | "observedAt" | "threadId" | "turnId">
  : never

export type UnsequencedManagedRuntimeEvent = WithoutEventEnvelope<ManagedRuntimeEvent>

export interface ManagedProviderIdentity {
  adapterId: string
  agentId: string
  runtimeVersion?: string
  capabilityDigest?: `sha256:${string}`
}

export interface ManagedChangedFile {
  path: string
  kind: "added" | "modified" | "deleted"
  beforeDigest?: `sha256:${string}`
  afterDigest?: `sha256:${string}`
  beforeSize?: number
  afterSize?: number
  beforeMode?: number
  afterMode?: number
}

export interface ManagedStagingEvidence {
  baselineDigest: `sha256:${string}`
  finalDigest: `sha256:${string}`
  changes: ManagedChangedFile[]
  excludedPaths: string[]
  applied: boolean
  applyJournalDigest?: `sha256:${string}`
}

export interface ManagedRuntimePortableResult {
  schemaVersion: 1
  provider: ManagedProviderIdentity
  providerThreadId?: string
  providerTurnId?: string
  events: ManagedRuntimeEvent[]
  staging?: ManagedStagingEvidence
  terminalDisposition: ManagedTerminalDisposition
  warnings: string[]
  postconditionStatus: ManagedPostconditionStatus
}

export interface ManagedRuntimeLocalBindings {
  executablePath?: string
  sourceWorkspacePath?: string
  stagingWorkspacePath?: string
  processId?: number
  applyJournalPath?: string
  executableFingerprint?: ExecutableFingerprint
}

export interface ManagedRuntimeResultEnvelope {
  portable: ManagedRuntimePortableResult
  local: ManagedRuntimeLocalBindings
}

export interface ManagedRunHandle {
  readonly events: AsyncIterable<ManagedRuntimeEvent>
  readonly completion: Promise<ManagedRuntimeResultEnvelope>
  cancel(reason?: string): Promise<void>
}

export interface ManagedApprovalRequest {
  requestId: string
  kind: "command" | "file-change" | "permissions" | "unsupported"
  threadId?: string
  turnId?: string
  itemId?: string
  reason?: string
  commandDigest?: `sha256:${string}`
}

export type ManagedApprovalDecision =
  | { outcome: "deny"; reason: string }
  | { outcome: "allow-once"; authorizationId: string; reason: string }

export type ManagedApprovalMediator = (request: ManagedApprovalRequest) => Promise<ManagedApprovalDecision>

export class BoundedAsyncQueue<T> implements AsyncIterable<T> {
  private readonly values: Array<{ value: T; bytes: number }> = []
  private readonly waiters: Array<{
    resolve: (value: IteratorResult<T>) => void
    reject: (error: Error) => void
  }> = []
  private queuedBytes = 0
  private ended = false
  private failure: Error | undefined

  constructor(
    private readonly maxItems: number,
    private readonly maxBytes: number,
    private readonly sizeOf: (value: T) => number = (value) => Buffer.byteLength(JSON.stringify(value)),
  ) {
    if (!Number.isSafeInteger(maxItems) || maxItems < 1) throw new Error("maxItems must be a positive safe integer")
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error("maxBytes must be a positive safe integer")
  }

  push(value: T): void {
    if (this.ended) throw new Error("Cannot push to a closed queue")
    const bytes = this.sizeOf(value)
    if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error("Queue item size must be a non-negative safe integer")
    const waiter = this.waiters.shift()
    if (waiter) {
      waiter.resolve({ value, done: false })
      return
    }
    if (this.values.length + 1 > this.maxItems || this.queuedBytes + bytes > this.maxBytes) {
      const error = new Error("Managed runtime event buffer exceeded its configured bound")
      this.fail(error)
      throw error
    }
    this.values.push({ value, bytes })
    this.queuedBytes += bytes
  }

  close(): void {
    if (this.ended) return
    this.ended = true
    for (const waiter of this.waiters.splice(0)) waiter.resolve({ value: undefined, done: true })
  }

  fail(error: Error): void {
    if (this.ended) return
    this.failure = error
    this.ended = true
    this.values.length = 0
    this.queuedBytes = 0
    for (const waiter of this.waiters.splice(0)) waiter.reject(error)
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: async (): Promise<IteratorResult<T>> => {
        const entry = this.values.shift()
        if (entry) {
          this.queuedBytes -= entry.bytes
          return { value: entry.value, done: false }
        }
        if (this.failure) throw this.failure
        if (this.ended) return { value: undefined, done: true }
        return new Promise<IteratorResult<T>>((resolve, reject) => this.waiters.push({ resolve, reject }))
      },
    }
  }
}
