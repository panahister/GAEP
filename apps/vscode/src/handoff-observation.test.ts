import { handoffSchema, type Handoff } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import {
  handoffReadLimit,
  handoffRecordByteLimit,
  observePortableHandoffs,
} from "./handoff-observation.js"

const digest = `sha256:${"a".repeat(64)}`

function id(index: number): string {
  return `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`
}

function record(index: number): Handoff {
  return handoffSchema.parse({
    schemaVersion: 1,
    id: id(index),
    productId: id(9_001),
    initiativeId: id(9_002),
    fromRunId: id(9_003),
    toAgent: {
      schemaVersion: 2,
      adapterId: "codex-adapter",
      agentId: "codex-cli",
      modelId: "gpt-test",
      modelTruthClass: "observed",
      modelAlias: false,
      settings: {},
      selectedAt: "2026-07-24T00:00:00.000Z",
      capabilityDigest: digest,
    },
    reason: "Bounded handoff observation fixture.",
    workspaceBaseline: { dirty: false, changedFiles: [], truthClass: "observed" },
    completedWork: [],
    unresolvedMatters: [],
    decisions: [],
    evidence: [],
    capabilityDifferences: [],
    createdAt: `2026-07-24T00:${String(index % 60).padStart(2, "0")}:00.000Z`,
  })
}

describe("portable handoff observation bounds", () => {
  it("reads only the deterministic bounded filename window", async () => {
    const names = Array.from({ length: handoffReadLimit + 5 }, (_, index) => `${id(index + 1)}.json`).reverse()
    const reads: string[] = []
    const observed = await observePortableHandoffs(names, {
      read: async (name) => {
        reads.push(name)
        return {
          status: "read",
          record: record(Number(name.slice(24, 36))),
          byteLength: 1_024,
        }
      },
    })
    expect(reads).toHaveLength(handoffReadLimit)
    expect(observed).toMatchObject({
      total: handoffReadLimit + 5,
      selectedFileCount: handoffReadLimit,
      omittedOutsideWindow: 5,
      omittedForResourceSafety: 0,
    })
  })

  it("withholds oversized and aggregate-over-budget records before parsing their contents", async () => {
    const names = Array.from({ length: 6 }, (_, index) => `${id(index + 1)}.json`)
    const attempts: string[] = []
    const parsed: string[] = []
    const observed = await observePortableHandoffs(names, {
      read: async (name) => {
        attempts.push(name)
        if (name === `${id(1)}.json`) return { status: "omitted" }
        parsed.push(name)
        return {
          status: "read",
          record: record(Number(name.slice(24, 36))),
          byteLength: handoffRecordByteLimit,
        }
      },
    })
    expect(attempts).toHaveLength(5)
    expect(parsed).toHaveLength(4)
    expect(observed.omittedForResourceSafety).toBe(2)
    expect(observed.records).toHaveLength(4)
  })
})
