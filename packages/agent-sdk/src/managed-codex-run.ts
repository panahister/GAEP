import { randomUUID } from "node:crypto"

import { CodexAppServerSupervisor, type CodexAppServerOptions } from "./codex-app-server.js"
import {
  BoundedAsyncQueue,
  type ManagedPostconditionStatus,
  type ManagedRuntimeEvent,
  type ManagedRuntimeResultEnvelope,
  type ManagedTerminalDisposition,
} from "./managed-runtime.js"
import {
  WorkspaceStagingService,
  type WorkspaceApplyOptions,
  type WorkspaceApplyResult,
  type WorkspaceStage,
  type WorkspaceStageInspection,
} from "./workspace-staging.js"

export interface ManagedCodexStagePolicy {
  allowCommands: boolean
  allowFileChanges: boolean
}

export interface ManagedCodexStagedRunRequest {
  executable: string
  sourceWorkspacePath: string
  model: string
  prompt: string
  developerInstructions?: string
  /** Machine-local provider thread identity; never persist this value in GAEP records. */
  resumeThreadId?: string
  runtimeVersion?: string
  capabilityDigest?: `sha256:${string}`
  timeoutMs?: number
  policy: ManagedCodexStagePolicy
  stagingService?: WorkspaceStagingService
  appServerOptions?: Omit<
    CodexAppServerOptions,
    | "executable"
    | "stagingService"
    | "processCwd"
    | "approvalMediator"
    | "runtimeVersion"
    | "capabilityDigest"
    | "allowShellTool"
    | "allowFileChanges"
  >
}

export interface ManagedCodexPostconditionContext {
  sourceWorkspacePath: string
  inspection: WorkspaceStageInspection
  applyResult?: WorkspaceApplyResult
}

export type ManagedCodexPostconditionEvaluator = (
  context: ManagedCodexPostconditionContext,
) => Promise<ManagedPostconditionStatus>

export interface ManagedCodexApplyRequest extends WorkspaceApplyOptions {
  evaluatePostconditions?: ManagedCodexPostconditionEvaluator
}

export interface ManagedCodexStageReview {
  readonly result: ManagedRuntimeResultEnvelope
  readonly inspection: WorkspaceStageInspection
  readonly state: "review-required" | "conflict" | "applied" | "discarded"
  apply(request: ManagedCodexApplyRequest): Promise<ManagedRuntimeResultEnvelope>
  discard(): Promise<ManagedRuntimeResultEnvelope>
}

export interface ManagedCodexStagedRunHandle {
  readonly events: AsyncIterable<ManagedRuntimeEvent>
  readonly completion: Promise<ManagedCodexStageReview>
  cancel(reason?: string): Promise<void>
}

const defaultRunTimeoutMs = 30 * 60 * 1_000

function requireBoundedText(value: string, label: string, maximum: number): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`${label} is required`)
  if (Buffer.byteLength(trimmed) > maximum) throw new Error(`${label} exceeds its configured bound`)
  return trimmed
}

function assertTimeout(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 24 * 60 * 60 * 1_000) {
    throw new Error("Managed Codex timeout must be between 1 ms and 24 hours")
  }
  return value
}

function optionalPortableRuntimeVersion(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  const version = requireBoundedText(value, "Runtime version", 1_024)
  if (/[/\\][\w.-]+[/\\]/u.test(version) || /\b(?:token|secret|password|api[_-]?key)\s*[:=]/iu.test(version)) {
    throw new Error("Runtime version must not contain a local path or secret-shaped value")
  }
  return version
}

function optionalCapabilityDigest(value: `sha256:${string}` | undefined): `sha256:${string}` | undefined {
  if (value === undefined) return undefined
  if (!/^sha256:[0-9a-f]{64}$/u.test(value)) throw new Error("Capability digest must be a lowercase SHA-256 digest")
  return value
}

function withWarning(result: ManagedRuntimeResultEnvelope, warning: string): ManagedRuntimeResultEnvelope {
  return {
    portable: {
      ...structuredClone(result.portable),
      warnings: [...result.portable.warnings, warning],
    },
    local: structuredClone(result.local),
  }
}

function resultWithApply(
  initial: ManagedRuntimeResultEnvelope,
  applyResult: WorkspaceApplyResult,
  postconditionStatus: ManagedPostconditionStatus,
): ManagedRuntimeResultEnvelope {
  return {
    portable: {
      ...structuredClone(initial.portable),
      staging: structuredClone(applyResult.evidence),
      postconditionStatus,
      warnings: [
        ...initial.portable.warnings,
        ...(applyResult.status === "conflict"
          ? ["The source workspace changed after staging; no staged changes were applied."]
          : []),
      ],
    },
    local: {
      ...structuredClone(initial.local),
      applyJournalPath: applyResult.journalPath,
    },
  }
}

class CodexStageReview implements ManagedCodexStageReview {
  private disposition: ManagedCodexStageReview["state"] = "review-required"
  private finalResult: ManagedRuntimeResultEnvelope
  private operation: Promise<ManagedRuntimeResultEnvelope> | undefined

  constructor(
    initialResult: ManagedRuntimeResultEnvelope,
    readonly inspection: WorkspaceStageInspection,
    private readonly terminalDisposition: ManagedTerminalDisposition,
    private readonly sourceWorkspacePath: string,
    private readonly stage: WorkspaceStage,
    private readonly stagingService: WorkspaceStagingService,
  ) {
    this.finalResult = initialResult
  }

  get result(): ManagedRuntimeResultEnvelope {
    return structuredClone(this.finalResult)
  }

  get state(): ManagedCodexStageReview["state"] {
    return this.disposition
  }

  async apply(request: ManagedCodexApplyRequest): Promise<ManagedRuntimeResultEnvelope> {
    if (this.operation) throw new Error("A staged-run review operation is already in progress")
    if (this.disposition !== "review-required") {
      throw new Error(`Staged-run changes cannot be applied from ${this.disposition} state`)
    }
    if (this.terminalDisposition !== "completed") {
      throw new Error(
        `Staged changes cannot be applied after provider disposition ${this.terminalDisposition}; inspect and discard them`,
      )
    }
    this.operation = this.applyOnce(request)
    try {
      return await this.operation
    } finally {
      this.operation = undefined
    }
  }

  private async applyOnce(request: ManagedCodexApplyRequest): Promise<ManagedRuntimeResultEnvelope> {
    const applyResult = await this.stagingService.apply(this.stage, {
      authorizationId: requireBoundedText(request.authorizationId, "Apply authorization ID", 1_024),
      approvedPaths: request.approvedPaths,
    })
    if (applyResult.status === "conflict") {
      this.disposition = "conflict"
      this.finalResult = resultWithApply(this.finalResult, applyResult, "indeterminate")
      return this.result
    }
    let postconditionStatus: ManagedPostconditionStatus = "not-assessed"
    if (request.evaluatePostconditions) {
      try {
        postconditionStatus = await request.evaluatePostconditions({
          sourceWorkspacePath: this.sourceWorkspacePath,
          inspection: this.inspection,
          applyResult,
        })
      } catch {
        postconditionStatus = "indeterminate"
        this.finalResult = withWarning(
          this.finalResult,
          "The postcondition evaluator failed after apply; outcome verification is indeterminate.",
        )
      }
      if (!["satisfied", "failed", "not-assessed", "indeterminate"].includes(postconditionStatus)) {
        postconditionStatus = "indeterminate"
        this.finalResult = withWarning(
          this.finalResult,
          "The postcondition evaluator returned an unsupported status; outcome verification is indeterminate.",
        )
      }
    }
    this.finalResult = resultWithApply(this.finalResult, applyResult, postconditionStatus)
    this.disposition = "applied"
    try {
      await this.stagingService.cleanup(this.stage)
    } catch {
      this.finalResult = withWarning(
        this.finalResult,
        "The staged temporary workspace could not be cleaned; review local diagnostics.",
      )
    }
    return this.result
  }

  async discard(): Promise<ManagedRuntimeResultEnvelope> {
    if (this.operation) throw new Error("A staged-run review operation is already in progress")
    if (this.disposition === "discarded" || this.disposition === "applied") return this.result
    this.operation = (async () => {
      await this.stagingService.cleanup(this.stage)
      this.disposition = "discarded"
      return this.result
    })()
    try {
      return await this.operation
    } finally {
      this.operation = undefined
    }
  }
}

export async function startManagedCodexStagedRun(
  request: ManagedCodexStagedRunRequest,
): Promise<ManagedCodexStagedRunHandle> {
  const executable = requireBoundedText(request.executable, "Codex executable", 16 * 1_024)
  const model = requireBoundedText(request.model, "Codex model", 1_024)
  const prompt = requireBoundedText(request.prompt, "Managed Codex prompt", 2 * 1_024 * 1_024)
  const developerInstructions = request.developerInstructions === undefined
    ? undefined
    : requireBoundedText(request.developerInstructions, "Developer instructions", 256 * 1_024)
  const resumeThreadId = request.resumeThreadId === undefined
    ? undefined
    : requireBoundedText(request.resumeThreadId, "Codex resume thread ID", 4 * 1_024)
  const timeoutMs = assertTimeout(request.timeoutMs ?? defaultRunTimeoutMs)
  if (!request.policy || typeof request.policy.allowCommands !== "boolean" || typeof request.policy.allowFileChanges !== "boolean") {
    throw new Error("Managed Codex stage policy must contain explicit boolean command and file-change decisions")
  }
  const runtimeVersion = optionalPortableRuntimeVersion(request.runtimeVersion)
  const capabilityDigest = optionalCapabilityDigest(request.capabilityDigest)
  const stagingService = request.stagingService ?? new WorkspaceStagingService()
  const stage = await stagingService.create(request.sourceWorkspacePath)
  const events = new BoundedAsyncQueue<ManagedRuntimeEvent>(4_096, 32 * 1_024 * 1_024)
  let threadId: string | undefined
  let turnId: string | undefined
  let cancelRequested = false
  let timeoutTriggered = false
  let completionSettled = false
  let lastSequence = -1
  let coordinatorFailure: ManagedRuntimeEvent | undefined

  let supervisor: CodexAppServerSupervisor
  try {
    supervisor = new CodexAppServerSupervisor({
      ...request.appServerOptions,
      executable,
      stagingService,
      processCwd: stage.root,
      runtimeVersion,
      capabilityDigest,
      allowShellTool: request.policy.allowCommands,
      allowFileChanges: request.policy.allowFileChanges,
      approvalMediator: async (approval) => {
        const allowed = approval.kind === "command"
          ? request.policy.allowCommands
          : approval.kind === "file-change"
            ? request.policy.allowFileChanges
            : false
        return allowed
          ? {
              outcome: "allow-once",
              authorizationId: `gaep-stage:${randomUUID()}`,
              reason: "Allowed only inside the isolated staged workspace; source-workspace apply remains separately confirmed",
            }
          : {
              outcome: "deny",
              reason: "The confirmed GAEP stage policy denies this provider request",
            }
      },
    })
  } catch (error) {
    await stagingService.cleanup(stage).catch(() => undefined)
    throw error
  }

  const cancel = async (_reason?: string): Promise<void> => {
    if (completionSettled || cancelRequested) return
    cancelRequested = true
    if (threadId && turnId) {
      const interrupt = supervisor.cancelTurn(threadId, turnId).catch(() => undefined)
      await Promise.race([
        interrupt,
        new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 250)
          timer.unref()
        }),
      ])
    }
    await supervisor.stop()
  }

  const completion = (async (): Promise<ManagedCodexStageReview> => {
    let terminalDisposition: ManagedTerminalDisposition = "unknown"
    let timer: NodeJS.Timeout | undefined
    try {
      await supervisor.start()
      if (cancelRequested) throw new Error("Managed Codex run was cancelled before thread creation")
      const thread = resumeThreadId
        ? await supervisor.resumeStagedThread({ stage, model, developerInstructions, threadId: resumeThreadId })
        : await supervisor.startStagedThread({ stage, model, developerInstructions })
      threadId = thread.threadId
      if (cancelRequested) throw new Error("Managed Codex run was cancelled before turn creation")
      const turn = await supervisor.startStagedTurn({ stage, threadId, prompt, model })
      turnId = turn.turnId
      timer = setTimeout(() => {
        timeoutTriggered = true
        void cancel("Managed Codex run timed out")
      }, timeoutMs)
      timer.unref()
      for await (const event of supervisor.events) {
        lastSequence = Math.max(lastSequence, event.sequence)
        events.push(event)
        if (event.type === "lifecycle" && event.phase === "turn-completed" && event.turnId === turnId) {
          terminalDisposition = event.turnStatus === "completed"
            ? "completed"
            : event.turnStatus === "interrupted"
              ? "interrupted"
              : event.turnStatus === "failed"
                ? "failed"
                : "protocol-error"
          break
        }
        if (event.type === "error" && !event.retryable) {
          terminalDisposition = "failed"
          break
        }
      }
      if (timeoutTriggered) terminalDisposition = "interrupted"
      else if (cancelRequested) terminalDisposition = "cancelled"
    } catch (error) {
      terminalDisposition = timeoutTriggered
        ? "interrupted"
        : cancelRequested
          ? "cancelled"
          : "protocol-error"
      coordinatorFailure = {
        type: "error",
        message: "Managed Codex coordination failed; inspect local diagnostics.",
        code: "GAEP_MANAGED_COORDINATOR_FAILURE",
        retryable: false,
        sequence: lastSequence + 1,
        observedAt: new Date().toISOString(),
        threadId,
        turnId,
      }
      try {
        events.push(coordinatorFailure)
      } catch {
        // The bounded event queue already contains the primary failure.
      }
    } finally {
      if (timer) clearTimeout(timer)
      await supervisor.stop().catch(() => undefined)
      events.close()
      completionSettled = true
    }
    const inspection = await stagingService.inspect(stage)
    const initialResult = await supervisor.buildResult({
      stage,
      providerThreadId: threadId,
      providerTurnId: turnId,
      terminalDisposition,
      postconditionStatus: "not-assessed",
    })
    initialResult.portable.warnings.push(request.policy.allowFileChanges
      ? "Codex received a network-disabled workspace-write sandbox rooted at the isolated stage; this result does not attest read confinement outside that stage."
      : "Codex received a network-disabled read-only sandbox; this result does not attest read confinement outside the staged workspace.")
    if (!request.policy.allowCommands) {
      initialResult.portable.warnings.push("The Codex shell tool was disabled for this run and command approval requests were fail-closed.")
    }
    if (coordinatorFailure) {
      const maximumSequence = initialResult.portable.events.reduce(
        (maximum, event) => Math.max(maximum, event.sequence),
        -1,
      )
      initialResult.portable.events.push({ ...coordinatorFailure, sequence: maximumSequence + 1 })
      initialResult.portable.warnings.push("Managed Codex coordination ended before a normal terminal result.")
    }
    return new CodexStageReview(
      initialResult,
      inspection,
      terminalDisposition,
      stage.sourceRoot,
      stage,
      stagingService,
    )
  })().catch(async (error: unknown) => {
    events.fail(error instanceof Error ? error : new Error(String(error)))
    await supervisor.stop().catch(() => undefined)
    await stagingService.cleanup(stage).catch(() => undefined)
    throw error
  })

  return { events, completion, cancel }
}
