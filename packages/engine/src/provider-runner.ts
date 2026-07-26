import type { AdapterCapabilities } from "@gaep/contracts"

import type { ProviderRunOutcome } from "./read-only-analysis.js"

/**
 * GAEP-P0-CS02 — provider-runner selection and the real read-only Codex path (INV-02/03).
 *
 * The runner is selected from the host-observed capabilities. Codex executes through the Codex
 * app-server with shell tools and file changes DISABLED (read-only), the Product workspace as the
 * only permitted read root, and only the bounded governed Context Pack as input. Claude executes
 * tool-free from an empty temporary directory. Neither may write; cancellation and timeout reach
 * the runner. This module owns the Codex read-only orchestration so there is no second analysis
 * service and no host-owned provider runner.
 */

export type ProviderRunnerKind = "codex" | "claude" | "unsupported"

export function providerRunnerKind(capabilities: Pick<AdapterCapabilities, "executionInterface" | "adapterId">): ProviderRunnerKind {
  if (capabilities.adapterId.includes("codex") && capabilities.executionInterface === "cli-jsonl") return "codex"
  if (capabilities.executionInterface === "cli-stream-json") return "claude"
  return "unsupported"
}

/** Read-only Codex enforcement flags: no shell tool, no file-change authority. */
export const CODEX_READ_ONLY_FLAGS = { allowShellTool: false, allowFileChanges: false } as const

/** Minimal driver surface of the Codex app-server supervisor, so the runner is testable. */
export interface CodexTurnDriver {
  readonly allowShellTool: boolean
  readonly allowFileChanges: boolean
  start(): Promise<void>
  startReadOnlyThread(options: { model: string; developerInstructions?: string }): Promise<{ threadId: string }>
  startTurn(options: { threadId: string; prompt: string; model?: string }): Promise<{ threadId: string; turnId: string }>
  cancelTurn(threadId: string, turnId: string): Promise<void>
  awaitResult(threadId: string, turnId: string): Promise<{ status: "completed" | "failed"; text?: string; failureDetail?: string }>
  stop(): Promise<void>
}

/**
 * Drive one bounded read-only Codex turn. Rejects if the driver grants shell or file-change
 * authority. Sends ONLY the bounded context as the prompt. Wires cancellation/timeout to the
 * turn, and classifies the terminal result (auth failures → auth-unavailable).
 */
export async function runCodexReadOnlyTurn(
  driver: CodexTurnDriver,
  input: { model: string; objective: string; contextText: string; signal: AbortSignal; timeoutMs: number },
): Promise<ProviderRunOutcome> {
  if (driver.allowShellTool || driver.allowFileChanges) {
    return { kind: "failed", failureCategory: "internal" }
  }
  let cancelled = false
  let onAbort: (() => void) | undefined
  try {
    // start()/thread/turn are inside the try so a startup failure still runs stop() → staging
    // cleanup in the finally (no leaked staged workspace on a supervisor start failure).
    await driver.start()
    const prompt = [
      "GAEP bounded read-only analysis. Use only the governed context below. Do not modify files or run tools.",
      `Objective:\n${input.objective}`,
      `Context:\n${input.contextText}`,
    ].join("\n\n")
    const { threadId } = await driver.startReadOnlyThread({ model: input.model })
    const { turnId } = await driver.startTurn({ threadId, prompt, model: input.model })

    onAbort = (): void => { cancelled = true; void driver.cancelTurn(threadId, turnId) }
    input.signal.addEventListener("abort", onAbort, { once: true })
    const result = await driver.awaitResult(threadId, turnId)
    if (cancelled || input.signal.aborted) return { kind: "cancelled" }
    if (result.status === "completed") return { kind: "completed", text: result.text ?? "" }
    const detail = (result.failureDetail ?? "").toLowerCase()
    const authFailure = detail.includes("unauthor") || detail.includes("authentication") || detail.includes("not logged in") || detail.includes("login")
    return { kind: "failed", failureCategory: authFailure ? "auth-unavailable" : "provider-error" }
  } catch {
    return input.signal.aborted || cancelled ? { kind: "cancelled" } : { kind: "failed", failureCategory: "provider-error" }
  } finally {
    if (onAbort) input.signal.removeEventListener("abort", onAbort)
    // Always terminate the supervisor and clean staging, on every terminal path.
    await driver.stop()
  }
}
