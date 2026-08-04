import { describe, expect, it } from "vitest"

import {
  existingProductJourneyCheckpointIds,
  parseExistingProductJourneyCoverage,
} from "./existing-product-journey-coverage.js"

const row = (checkpoint: string) => ({
  checkpoint,
  coverage: "partially-supported",
  evidence: `Evidence for ${checkpoint}`,
  candidateProposal: `Candidate proposal for ${checkpoint}`,
  missingDecisions: `Missing decisions for ${checkpoint}`,
})

describe("Existing Product Journey coverage", () => {
  it("accepts exactly one evidence-aware proposal for every Product Journey checkpoint", () => {
    const parsed = parseExistingProductJourneyCoverage({
      checkpoints: existingProductJourneyCheckpointIds.map(row),
    })

    expect(parsed).toHaveLength(12)
    expect(parsed.map((entry) => entry.checkpoint)).toEqual(existingProductJourneyCheckpointIds)
  })

  it("rejects a nine-field-only adoption response", () => {
    expect(() => parseExistingProductJourneyCoverage({
      checkpoints: existingProductJourneyCheckpointIds.slice(0, 9).map(row),
    })).toThrow("exactly 12 checkpoints")
  })

  it("rejects duplicate, unsupported, or empty checkpoint proposals", () => {
    const duplicate = existingProductJourneyCheckpointIds.map(row)
    duplicate[11] = row(existingProductJourneyCheckpointIds[0])
    expect(() => parseExistingProductJourneyCoverage({ checkpoints: duplicate })).toThrow("duplicated")

    const unsupported = existingProductJourneyCheckpointIds.map(row)
    unsupported[0] = { ...row(existingProductJourneyCheckpointIds[0]), coverage: "complete" }
    expect(() => parseExistingProductJourneyCoverage({ checkpoints: unsupported })).toThrow("unsupported coverage state")

    const empty = existingProductJourneyCheckpointIds.map(row)
    empty[0] = { ...row(existingProductJourneyCheckpointIds[0]), candidateProposal: "" }
    expect(() => parseExistingProductJourneyCoverage({ checkpoints: empty })).toThrow("bounded non-empty text")
  })
})
