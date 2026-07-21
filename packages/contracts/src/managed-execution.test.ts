import { describe, expect, it } from "vitest"

import {
  executionCharterSchema,
  handoffSchema,
  managedEvidenceEventSchema,
  managedRunEvidenceSchema,
  managedRunRecordSchema,
  managedRunResultSchema,
  runSchema,
} from "./index.js"

const digest = `sha256:${"a".repeat(64)}`
const id = (tail: number): string => `00000000-0000-4000-8000-${tail.toString().padStart(12, "0")}`
const portableSelection = {
  schemaVersion: 2,
  adapterId: "gaep.manual",
  agentId: "manual",
  modelId: "manual-deterministic-v1",
  modelTruthClass: "configured",
  modelAlias: false,
  settings: { script: "success" },
  selectedAt: "2026-01-01T00:00:00.000Z",
  capabilityDigest: digest,
}

function exact(recordType: "product" | "initiative" | "execution-charter" | "run") {
  return { recordType, recordId: id({ product: 1, initiative: 2, "execution-charter": 3, run: 4 }[recordType]), revision: 1, digest }
}

function managedRecord(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    kind: "managed-run",
    id: id(5),
    revision: 1,
    runId: id(4),
    productId: id(1),
    initiativeId: id(2),
    mode: "manual-offline",
    state: "prepared",
    bindings: {
      product: exact("product"),
      initiative: exact("initiative"),
      charter: exact("execution-charter"),
      run: exact("run"),
      agentSelectionDigest: digest,
      contextPacks: [],
      tools: [],
    },
    bindingsDigest: digest,
    bindingSnapshots: {
      initiative: {
        schemaVersion: 1,
        id: id(2),
        kind: "initiative",
        revision: 1,
        productId: id(1),
        title: "Managed fixture",
        outcome: "Produce managed evidence",
        scope: ["Managed runtime"],
        exclusions: [],
        state: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      run: {
        schemaVersion: 1,
        id: id(4),
        revision: 1,
        charterId: id(3),
        productId: id(1),
        initiativeId: id(2),
        agent: portableSelection,
        state: "prepared",
      },
    },
    provider: {
      adapterId: "gaep.manual",
      agentId: "manual",
      modelId: "manual-deterministic-v1",
      capabilityDigest: digest,
      runtimeVersion: "1.0.0",
    },
    recovery: { status: "not-required" },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }
}

function evidence(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    kind: "managed-run-evidence",
    id: id(6),
    managedRunId: id(5),
    runId: id(4),
    productId: id(1),
    bindingsDigest: digest,
    events: [{
      sequence: 0,
      observedAt: "2026-01-01T00:00:00.000Z",
      type: "output",
      channel: "assistant",
      contentDigest: digest,
      byteLength: 10,
      redactionCount: 0,
    }],
    eventsDigest: digest,
    actualEffects: [{ effect: "observe", status: "observed-provisional", evidenceDigest: digest }],
    capturedAt: "2026-01-01T00:00:01.000Z",
    authorityBoundary: "evidence-does-not-self-assert-outcome-or-authorization",
  }
}

function result(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    kind: "managed-run-result",
    id: id(7),
    managedRunId: id(5),
    runId: id(4),
    productId: id(1),
    mode: "manual-offline",
    provider: (managedRecord().provider as Record<string, unknown>),
    providerDisposition: "completed",
    terminationCause: "normal",
    outcome: { status: "satisfied", basis: "deterministic-offline-runtime" },
    terminalState: "completed",
    evidenceId: id(6),
    evidenceDigest: digest,
    warnings: [],
    startedAt: "2026-01-01T00:00:00.000Z",
    endedAt: "2026-01-01T00:00:01.000Z",
    authorityBoundary: "provider-completion-does-not-equal-outcome-completion",
  }
}

describe("managed execution portable contracts", () => {
  it("accepts strict path-free records, evidence, and a verified completion", () => {
    expect(managedRunRecordSchema.parse(managedRecord()).state).toBe("prepared")
    expect(managedRunEvidenceSchema.parse(evidence()).events).toHaveLength(1)
    expect(managedRunResultSchema.parse(result()).terminalState).toBe("completed")
  })

  it.each([
    ["record root", () => ({ ...managedRecord(), executablePath: "/usr/local/bin/agent" }), managedRunRecordSchema],
    ["provider", () => ({ ...managedRecord(), provider: { ...(managedRecord().provider as object), processId: 42 } }), managedRunRecordSchema],
    ["evidence event", () => ({ ...evidence(), events: [{ ...(evidence().events as object[])[0], text: "raw provider output" }] }), managedRunEvidenceSchema],
    ["result", () => ({ ...result(), prompt: "do the private task" }), managedRunResultSchema],
  ])("rejects unknown machine-local or raw-content fields at the %s", (_label, create, schema) => {
    expect(schema.safeParse(create()).success).toBe(false)
  })

  it("rejects provider metadata containing local paths or secret-shaped text", () => {
    expect(managedRunRecordSchema.safeParse({
      ...managedRecord(),
      provider: { ...(managedRecord().provider as object), modelId: "/Users/alice/private/model" },
    }).success).toBe(false)
    expect(managedRunRecordSchema.safeParse({
      ...managedRecord(),
      provider: { ...(managedRecord().provider as object), runtimeVersion: "token=super-secret-value" },
    }).success).toBe(false)
  })

  it("requires contiguous bounded normalized evidence", () => {
    const event = (sequence: number) => ({
      sequence,
      observedAt: "2026-01-01T00:00:00.000Z",
      type: "lifecycle" as const,
      phase: "initialized" as const,
    })
    expect(managedRunEvidenceSchema.safeParse({ ...evidence(), events: [event(1)] }).success).toBe(false)
    expect(managedRunEvidenceSchema.safeParse({
      ...evidence(),
      events: Array.from({ length: 4_097 }, (_, sequence) => event(sequence)),
    }).success).toBe(false)
    expect(managedEvidenceEventSchema.safeParse({
      sequence: 0,
      observedAt: "2026-01-01T00:00:00.000Z",
      type: "output",
      channel: "assistant",
      contentDigest: digest,
      byteLength: 16 * 1024 * 1024 + 1,
      redactionCount: 0,
    }).success).toBe(false)
  })

  it("never equates provider exit with outcome completion", () => {
    expect(managedRunResultSchema.safeParse({
      ...result(),
      outcome: { status: "not-assessed", basis: "not-evaluated" },
    }).success).toBe(false)
    expect(managedRunResultSchema.safeParse({
      ...result(),
      providerDisposition: "failed",
    }).success).toBe(false)
  })
})

describe("bounded legacy execution contracts", () => {
  const selection = portableSelection

  it("rejects raw provider session IDs and oversized Charter collections", () => {
    expect(runSchema.safeParse({
      schemaVersion: 1,
      id: id(4),
      charterId: id(3),
      productId: id(1),
      initiativeId: id(2),
      agent: selection,
      state: "running",
      providerSessionId: "/Users/alice/.provider/session",
    }).success).toBe(false)
    expect(executionCharterSchema.safeParse({
      schemaVersion: 1,
      id: id(3),
      productId: id(1),
      initiativeId: id(2),
      agent: selection,
      objective: "bounded objective",
      permissions: [],
      expectedEffects: ["observe"],
      forbiddenActions: [],
      stopConditions: Array.from({ length: 257 }, () => "stop"),
      requiredEvidence: [],
      createdAt: "2026-01-01T00:00:00.000Z",
    }).success).toBe(false)
  })

  it("rejects oversized Handoff evidence", () => {
    expect(handoffSchema.safeParse({
      schemaVersion: 1,
      id: id(8),
      productId: id(1),
      initiativeId: id(2),
      fromRunId: id(4),
      toAgent: selection,
      reason: "switch",
      workspaceBaseline: { dirty: false, changedFiles: [] },
      completedWork: [],
      unresolvedMatters: [],
      decisions: [],
      evidence: Array.from({ length: 513 }, () => "evidence"),
      capabilityDifferences: [],
      createdAt: "2026-01-01T00:00:00.000Z",
    }).success).toBe(false)
  })
})
