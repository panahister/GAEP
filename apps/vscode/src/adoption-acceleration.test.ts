import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

import { afterEach, describe, expect, it } from "vitest"

import {
  adoptionAccelerationPath,
  adoptionCandidateForCheckpoint,
  adoptionPlanMatchesProduct,
  createAdoptionAccelerationPlan,
  readAdoptionAccelerationPlan,
  writeAdoptionAccelerationPlan,
} from "./adoption-acceleration.js"
import { existingProductJourneyCheckpointIds } from "./existing-product-journey-coverage.js"
import { startExistingProductAdoptionReview } from "./existing-product-adoption-review.js"

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

function review() {
  return startExistingProductAdoptionReview({
    productAssessment: "Evidence-backed candidate Product.",
    productGaps: ["Confirm the accountable owner."],
    journeyAssessment: "Downstream records can be proposed but remain ungoverned.",
    sources: [{
      label: "requirements.md",
      format: "md",
      extraction: "utf8-text",
      byteLength: 42,
      contentDigest: `sha256:${"a".repeat(64)}`,
      limitations: [],
    }],
    checkpoints: existingProductJourneyCheckpointIds.map((checkpoint, index) => ({
      checkpoint,
      coverage: index < 7 ? "ready-to-propose" as const : "partially-supported" as const,
      evidence: `Evidence for ${checkpoint}`,
      candidateProposal: `Proposal for ${checkpoint}`,
      missingDecisions: index < 7 ? "None identified" : "Human decision required",
    })),
  })
}

describe("adoption acceleration persistence", () => {
  it("persists only integrity-bound metadata and checkpoint candidates", async () => {
    const root = await mkdtemp(join(tmpdir(), "gaep-adoption-"))
    roots.push(root)
    const plan = createAdoptionAccelerationPlan({
      product: { id: "product-1", revision: 1, digest: `sha256:${"b".repeat(64)}` },
      review: review(),
      committedAt: "2026-08-05T12:00:00.000Z",
    })

    await writeAdoptionAccelerationPlan(root, plan)
    const persistedText = await readFile(adoptionAccelerationPath(root), "utf8")
    const restored = await readAdoptionAccelerationPlan(root)

    expect(persistedText).not.toContain("raw attachment content")
    expect(restored).toEqual(plan)
    expect(restored?.sources).toHaveLength(1)
    expect(adoptionCandidateForCheckpoint(plan, "product-discovery")?.candidateProposal).toContain("product-discovery")
    expect(adoptionCandidateForCheckpoint(plan, "product-discovery")?.evidenceDigest).toMatch(/^sha256:/u)
    expect(adoptionCandidateForCheckpoint(plan, "product-discovery")?.proposalDigest).toMatch(/^sha256:/u)
    expect(adoptionPlanMatchesProduct(plan, plan.product)).toBe(true)
    expect(adoptionPlanMatchesProduct(plan, { ...plan.product, revision: 2 })).toBe(false)
  })

  it("fails closed when a persisted proposal is modified without updating its digest", async () => {
    const root = await mkdtemp(join(tmpdir(), "gaep-adoption-"))
    roots.push(root)
    const plan = createAdoptionAccelerationPlan({
      product: { id: "product-1", revision: 1, digest: `sha256:${"b".repeat(64)}` },
      review: review(),
      committedAt: "2026-08-05T12:00:00.000Z",
    })
    await writeAdoptionAccelerationPlan(root, plan)
    await writeFile(adoptionAccelerationPath(root), JSON.stringify({ ...plan, journeyAssessment: "tampered" }), "utf8")

    await expect(readAdoptionAccelerationPlan(root)).rejects.toThrow("integrity validation")
  })
})
