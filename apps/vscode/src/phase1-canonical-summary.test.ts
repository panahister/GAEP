import { describe, expect, it } from "vitest"

import { summarizeCanonicalRecord } from "./phase1-canonical-summary.js"

describe("summarizeCanonicalRecord", () => {
  it("returns a not-yet-created summary for a missing component", () => {
    const summary = summarizeCanonicalRecord(undefined)
    expect(summary).toMatchObject({ present: false, headline: "Not yet created", metrics: [], lines: ["Not yet created"] })
  })

  it("summarizes Business Understanding count metadata into a readable headline", () => {
    const summary = summarizeCanonicalRecord({
      revision: 1,
      state: "active",
      objectiveCount: 3,
      constraintCount: 5,
      assumptionCount: 2,
      unresolvedQuestionCount: 4,
    })
    expect(summary.present).toBe(true)
    expect(summary.revision).toBe(1)
    expect(summary.state).toBe("active")
    expect(summary.headline).toBe("3 objectives · 5 constraints · 2 assumptions · 4 unresolved questions")
    expect(summary.lines[0]).toBe("Governed · revision 1 · active")
    expect(summary.metrics).toEqual([
      { label: "objectives", value: 3 },
      { label: "constraints", value: 5 },
      { label: "assumptions", value: 2 },
      { label: "unresolved questions", value: 4 },
    ])
  })

  it("pluralizes count nouns correctly, including singular and irregular endings", () => {
    const summary = summarizeCanonicalRecord({
      objectiveCount: 1,
      processCount: 2,
      relationshipCount: 3,
      capabilityCount: 4,
    })
    expect(summary.headline).toBe("1 objective · 2 processes · 3 relationships · 4 capabilities")
  })

  it("never surfaces digests or identities and falls back to a governed status line when no counts exist", () => {
    const summary = summarizeCanonicalRecord({
      id: "0f164839-6f98-4d6f-a741-69d717769b69",
      revision: 2,
      state: "active",
      digest: "sha256:deadbeef",
      membershipDigest: "sha256:cafebabe",
    })
    expect(summary.headline).toBe("Governed · revision 2 · active")
    expect(summary.lines).toEqual(["Governed · revision 2 · active"])
    expect(JSON.stringify(summary)).not.toContain("sha256")
    expect(JSON.stringify(summary)).not.toContain("0f164839")
  })

  it("caps the number of surfaced metrics", () => {
    const record: Record<string, number> = {}
    for (let index = 0; index < 20; index += 1) record[`metric${index}Count`] = index
    const summary = summarizeCanonicalRecord(record, { maxMetrics: 3 })
    expect(summary.metrics).toHaveLength(3)
  })
})
