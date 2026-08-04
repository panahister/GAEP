import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { startManagedClaudeContextRun, startManagedClaudeStagedRun } from "./managed-claude-run.js"
import type { ManagedRuntimeEvent } from "./managed-runtime.js"
import { WorkspaceStagingService } from "./workspace-staging.js"

const fixture = fileURLToPath(new URL("../test/fixtures/fake-claude-stream.mjs", import.meta.url))
const authenticationFailureFixture = fileURLToPath(
  new URL("../test/fixtures/fake-claude-auth-failure.mjs", import.meta.url),
)

async function collect(model: string, executableFixture = fixture) {
  const handle = await startManagedClaudeContextRun({
    executable: process.execPath,
    executableArguments: [executableFixture],
    model,
    objective: "Assess the supplied evidence",
    contextPack: "governed fixture context",
    timeoutMs: 2_000,
  })
  const events: ManagedRuntimeEvent[] = []
  const drain = (async () => {
    for await (const event of handle.events) events.push(event)
  })()
  const completion = await handle.completion
  await drain
  return { completion, events }
}

describe("managed Claude context runtime", () => {
  it("streams a bounded tool-free result and keeps local executable data separate", async () => {
    const { completion, events } = await collect("success")
    expect(completion.terminationCause).toBe("normal")
    expect(completion.result.portable.terminalDisposition).toBe("completed")
    expect(completion.result.portable.postconditionStatus).toBe("not-assessed")
    expect(completion.result.portable.providerThreadId).toBe("session-success")
    expect(events.some((event) => event.type === "output-delta")).toBe(true)
    expect(completion.result.local.executablePath).toBe(process.execPath)
  })

  it("forwards a bounded JSON Schema and emits provider structured output as the assistant result", async () => {
    const handle = await startManagedClaudeContextRun({
      executable: process.execPath,
      executableArguments: [fixture],
      model: "structured-output",
      objective: "Return a contract-valid object",
      contextPack: "governed fixture context",
      jsonSchema: {
        type: "object",
        properties: { status: { type: "string", const: "ok" } },
        required: ["status"],
        additionalProperties: false,
      },
      timeoutMs: 2_000,
    })
    const completion = await handle.completion
    expect(completion.terminationCause).toBe("normal")
    expect(completion.result.portable.events).toContainEqual(expect.objectContaining({
      type: "output-delta",
      channel: "assistant",
      text: '{"status":"ok"}',
    }))
  })

  it.each([
    ["failure", "failed", "provider-failure"],
    ["malformed", "protocol-error", "protocol-error"],
    ["no-result", "protocol-error", "protocol-error"],
  ] as const)("maps %s without treating process exit as outcome success", async (model, disposition, cause) => {
    const { completion } = await collect(model)
    expect(completion.result.portable.terminalDisposition).toBe(disposition)
    expect(completion.terminationCause).toBe(cause)
    expect(completion.result.portable.postconditionStatus).toBe("not-assessed")
  })

  it("classifies authentication failure without persisting raw provider text", async () => {
    const { completion, events } = await collect("auth-failure", authenticationFailureFixture)
    expect(completion.terminationCause).toBe("provider-failure")
    expect(completion.result.portable.terminalDisposition).toBe("failed")
    expect(events).toContainEqual(expect.objectContaining({
      type: "error",
      code: "GAEP_CLAUDE_AUTH_UNAVAILABLE",
      message: "Claude authentication is unavailable for the managed runtime.",
      retryable: false,
    }))
    const persisted = JSON.stringify(completion.result.portable)
    expect(persisted).not.toContain("Not logged in")
    expect(persisted).not.toContain("/Users/alice/private")
    expect(persisted).not.toContain("abc123456789")
  })

  it("fails closed when an authentication diagnostic is emitted inside an otherwise successful result", async () => {
    const { completion, events } = await collect("auth-assistant-success")
    expect(completion.terminationCause).toBe("provider-failure")
    expect(completion.result.portable.terminalDisposition).toBe("failed")
    expect(events).toContainEqual(expect.objectContaining({
      type: "error",
      code: "GAEP_CLAUDE_AUTH_UNAVAILABLE",
      retryable: false,
    }))
    expect(events.some((event) => event.type === "output-delta" &&
      event.text === "Claude authentication is unavailable for the managed runtime.")).toBe(false)
    const persisted = JSON.stringify(completion.result.portable)
    expect(persisted).not.toContain("Not logged in")
    expect(persisted).not.toContain("/Users/alice/private")
    expect(persisted).not.toContain("abc123456789")
  })

  it("does not misclassify ordinary security language as a provider authentication failure", async () => {
    const { completion, events } = await collect("security-answer")
    expect(completion.terminationCause).toBe("normal")
    expect(completion.result.portable.terminalDisposition).toBe("completed")
    expect(events).toContainEqual(expect.objectContaining({
      type: "output-delta",
      channel: "assistant",
      text: "Unauthorized access is a Product risk; define the authorization boundary before release.",
    }))
    expect(events.some((event) => event.type === "error" &&
      event.code === "GAEP_CLAUDE_AUTH_UNAVAILABLE")).toBe(false)
  })

  it("cancels the whole managed process group", async () => {
    const handle = await startManagedClaudeContextRun({
      executable: process.execPath,
      executableArguments: [fixture],
      model: "wait",
      objective: "Wait for cancellation",
      contextPack: "governed fixture context",
      timeoutMs: 5_000,
    })
    const drain = (async () => {
      for await (const _event of handle.events) { /* drain */ }
    })()
    await new Promise((resolve) => setTimeout(resolve, 50))
    await handle.cancel("test cancellation")
    const completion = await handle.completion
    await drain
    expect(completion.terminationCause).toBe("cancel-request")
    expect(completion.result.portable.terminalDisposition).toBe("cancelled")
  })

  it("rejects unsafe budget values before spawning", async () => {
    await expect(startManagedClaudeContextRun({
      executable: process.execPath,
      executableArguments: [fixture],
      model: "success",
      objective: "Assess",
      contextPack: "context",
      maxBudgetUsd: 0,
    })).rejects.toThrow(/maximum budget/)
  })
})

describe("managed Claude isolated staging runtime", () => {
  it("rejects incomplete durable metadata before creating an isolated stage", async () => {
    const source = await mkdtemp(join(tmpdir(), "gaep-claude-stage-invalid-source-"))
    const stageParent = await mkdtemp(join(tmpdir(), "gaep-claude-stage-invalid-parent-"))
    try {
      await expect(startManagedClaudeStagedRun({
        executable: process.execPath,
        executableArguments: [fixture],
        sourceWorkspacePath: source,
        model: "stage-edit",
        prompt: "This must not launch",
        managedRunId: "00000000-0000-4000-8000-000000000013",
        stagingService: new WorkspaceStagingService({ tempParent: stageParent }),
      })).rejects.toThrow(/durable review requires exact/)
      expect(await readdir(stageParent)).toEqual([])
    } finally {
      await rm(source, { recursive: true, force: true })
      await rm(stageParent, { recursive: true, force: true })
    }
  })

  it("keeps provider edits isolated until exact review and apply", async () => {
    const source = await mkdtemp(join(tmpdir(), "gaep-claude-stage-source-"))
    try {
      await writeFile(join(source, "existing.txt"), "source remains unchanged during provider execution\n")
      const handle = await startManagedClaudeStagedRun({
        executable: process.execPath,
        executableArguments: [fixture],
        sourceWorkspacePath: source,
        model: "stage-edit",
        prompt: "Create generated.txt inside the isolated stage",
        timeoutMs: 2_000,
      })
      const events: ManagedRuntimeEvent[] = []
      const drain = (async () => {
        for await (const event of handle.events) events.push(event)
      })()
      const review = await handle.completion
      await drain

      expect(review.state).toBe("review-required")
      expect(review.result.portable.terminalDisposition).toBe("completed")
      expect(review.inspection.changes).toEqual([
        expect.objectContaining({ path: "generated.txt", kind: "added" }),
      ])
      await expect(readFile(join(source, "generated.txt"), "utf8")).rejects.toMatchObject({ code: "ENOENT" })
      expect(JSON.stringify(review.result.portable)).not.toContain(source)
      expect(events.some((event) => event.type === "output-delta")).toBe(true)

      const applied = await review.apply({
        authorizationId: "phase0-claude-stage-apply",
        approvedPaths: ["generated.txt"],
        evaluatePostconditions: async () => "satisfied",
        postconditionTimeoutMs: 2_000,
      })
      expect(review.state).toBe("applied")
      expect(applied.portable.staging).toMatchObject({ applied: true })
      expect(applied.portable.postconditionStatus).toBe("satisfied")
      expect(await readFile(join(source, "generated.txt"), "utf8"))
        .toBe("generated only inside the isolated stage\n")
    } finally {
      await rm(source, { recursive: true, force: true })
    }
  }, 15_000)

  it("discards an isolated Claude stage without touching the source workspace", async () => {
    const source = await mkdtemp(join(tmpdir(), "gaep-claude-stage-discard-"))
    try {
      const handle = await startManagedClaudeStagedRun({
        executable: process.execPath,
        executableArguments: [fixture],
        sourceWorkspacePath: source,
        model: "stage-edit",
        prompt: "Create generated.txt only in the stage",
        timeoutMs: 2_000,
      })
      const drain = (async () => {
        for await (const _event of handle.events) { /* drain */ }
      })()
      const review = await handle.completion
      await drain
      await review.discard()
      expect(review.state).toBe("discarded")
      await expect(readFile(join(source, "generated.txt"), "utf8")).rejects.toMatchObject({ code: "ENOENT" })
    } finally {
      await rm(source, { recursive: true, force: true })
    }
  }, 15_000)
})
