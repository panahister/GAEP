import { describe, expect, it } from "vitest"

import {
  existingProductJourneyCheckpointIds,
  journeyCheckpointLabels,
  type ExistingProductJourneyCoverage,
} from "./existing-product-journey-coverage.js"
import {
  existingProductAdoptionCheckpointMarkdown,
  existingProductAdoptionCheckpointSelectionMarkdown,
  existingProductAdoptionFollowThrough,
  existingProductAdoptionOverviewMarkdown,
  isExistingProductAdoptionReviewState,
  setExistingProductAdoptionReviewPhase,
  startExistingProductAdoptionReview,
} from "./existing-product-adoption-review.js"

const checkpoints: ExistingProductJourneyCoverage[] = existingProductJourneyCheckpointIds.map((checkpoint, index) => ({
  checkpoint,
  coverage: index < 6 ? "ready-to-propose" : "partially-supported",
  evidence: `Evidence for ${checkpoint}`,
  candidateProposal: `Candidate proposal for ${checkpoint}`,
  missingDecisions: index < 6 ? "None identified" : `Decision required for ${checkpoint}`,
}))

describe("Existing Product adoption review", () => {
  it("persists one bounded checkpoint review without granting authority", () => {
    const state = startExistingProductAdoptionReview({
      productAssessment: "The Product Definition is evidence-backed but remains a candidate.",
      productGaps: ["Confirm the standalone boundary."],
      journeyAssessment: "Six checkpoints are ready to propose and six require decisions.",
      checkpoints,
    })

    expect(isExistingProductAdoptionReviewState(state)).toBe(true)
    expect(state.phase).toBe("review")
    expect(state.checkpoints).toHaveLength(12)
    expect(state.authorityBoundary).toContain("uncommitted-preview")
    expect(setExistingProductAdoptionReviewPhase(state, "committed")).toMatchObject({ phase: "committed" })
  })

  it("renders a vertical readable Journey and states the exact commit boundary", () => {
    const state = startExistingProductAdoptionReview({
      productAssessment: "Candidate assessment.",
      productGaps: [],
      journeyAssessment: "Candidate Journey assessment.",
      checkpoints,
    })
    const markdown = existingProductAdoptionOverviewMarkdown(state, "## Product initialization review\n\n| Field | Proposed value |")

    expect(markdown).toContain("flowchart TD")
    expect(markdown).not.toContain("flowchart LR")
    expect(markdown).toContain("Nothing below is governed or authoritative yet")
    expect(markdown).toContain("captures the exact attachments as reviewed Source Intake")
    expect(markdown).toContain("saves downstream proposals as non-governed candidates")
    expect(markdown).not.toContain("Each proposal remains editable")
  })

  it("offers every checkpoint for inspection and renders exact detail without edit authority", () => {
    const state = startExistingProductAdoptionReview({
      productAssessment: "Candidate assessment.",
      productGaps: [],
      journeyAssessment: "Candidate Journey assessment.",
      checkpoints,
    })
    const selection = existingProductAdoptionCheckpointSelectionMarkdown(state)
    const detail = existingProductAdoptionCheckpointMarkdown(state, "product-discovery")

    for (const checkpoint of existingProductJourneyCheckpointIds) expect(selection).toContain(journeyCheckpointLabels[checkpoint])
    expect(detail).toContain("Product discovery — adoption preview")
    expect(detail).toContain("Supporting\u00a0evidence")
    expect(detail).toContain("Evidence for product-discovery")
    expect(detail).toContain("Read-only candidate detail")
  })

  it("rejects incomplete portable checkpoint state", () => {
    const state = startExistingProductAdoptionReview({
      productAssessment: "Candidate assessment.",
      productGaps: [],
      journeyAssessment: "Candidate Journey assessment.",
      checkpoints,
    })
    expect(isExistingProductAdoptionReviewState({ ...state, checkpoints: state.checkpoints.slice(1) })).toBe(false)
  })

  it("routes adopted Initiative candidates to proposal generation instead of revision-only commands", () => {
    expect(existingProductAdoptionFollowThrough("initiative-definition")).toMatchObject({
      command: "adopt",
      prompt: "create:initiative-definition",
      title: "Generate Initiative Proposal",
    })
    expect(existingProductAdoptionFollowThrough("initiative-classification")).toMatchObject({
      command: "adopt",
      prompt: "create:initiative-classification",
      title: "Generate Classification Proposal",
    })
    expect(existingProductAdoptionFollowThrough("initiative-applicability")).toMatchObject({
      command: "adopt",
      prompt: "create:initiative-applicability",
      title: "Generate Applicability Proposal",
    })
    expect(existingProductAdoptionFollowThrough("source-baseline")).toMatchObject({
      command: "baseline",
      title: "Generate Source Baseline Proposal",
    })
    expect(existingProductAdoptionFollowThrough("source-provenance")).toMatchObject({
      command: "provenance",
      title: "Generate Source Provenance Proposal",
    })
    expect(existingProductAdoptionFollowThrough("product-discovery")).toMatchObject({
      command: "adopt",
      prompt: "create:product-discovery",
      title: "Generate Product discovery Proposal",
    })
    expect(existingProductAdoptionFollowThrough("design-implementation-handoff")).toMatchObject({
      command: "adopt",
      prompt: "create:design-implementation-handoff",
      title: "Generate Pre-Figma readiness and handoff Proposal",
    })
  })
})
