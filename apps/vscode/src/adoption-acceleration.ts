import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

import { canonicalDigest } from "@gaep/agent-sdk"

import {
  startExistingProductAdoptionReview,
  type ExistingProductAdoptionReviewState,
} from "./existing-product-adoption-review.js"
import type {
  ExistingProductJourneyCheckpointId,
  ExistingProductJourneyCoverage,
} from "./existing-product-journey-coverage.js"
import type { CandidateSourceAttachment } from "./product-chat-source-recording.js"

export type AdoptionAccelerationCheckpoint = ExistingProductJourneyCoverage & {
  evidenceDigest: string
  proposalDigest: string
}

export interface AdoptionAccelerationPlan {
  schemaVersion: 1
  kind: "gaep-existing-product-adoption-acceleration"
  product: { id: string; revision: number; digest: string }
  committedAt: string
  productAssessment: string
  productGaps: string[]
  journeyAssessment: string
  sources: CandidateSourceAttachment[]
  checkpoints: AdoptionAccelerationCheckpoint[]
  authorityBoundary: "non-governed-candidates-require-checkpoint-review-and-explicit-commit"
  planDigest: string
}

const planFile = "existing-product-adoption-v1.json"

function digestBody(plan: Omit<AdoptionAccelerationPlan, "planDigest">): string {
  return canonicalDigest(plan)
}

export function adoptionAccelerationPath(workspacePath: string): string {
  return join(workspacePath, ".gaep", "candidates", planFile)
}

export function createAdoptionAccelerationPlan(input: {
  product: { id: string; revision: number; digest: string }
  review: ExistingProductAdoptionReviewState
  committedAt: string
}): AdoptionAccelerationPlan {
  const body: Omit<AdoptionAccelerationPlan, "planDigest"> = {
    schemaVersion: 1,
    kind: "gaep-existing-product-adoption-acceleration",
    product: structuredClone(input.product),
    committedAt: input.committedAt,
    productAssessment: input.review.productAssessment,
    productGaps: structuredClone(input.review.productGaps),
    journeyAssessment: input.review.journeyAssessment,
    sources: structuredClone(input.review.sources),
    checkpoints: input.review.checkpoints.map((checkpoint) => ({
      ...structuredClone(checkpoint),
      evidenceDigest: canonicalDigest({ checkpoint: checkpoint.checkpoint, evidence: checkpoint.evidence }),
      proposalDigest: canonicalDigest({
        checkpoint: checkpoint.checkpoint,
        candidateProposal: checkpoint.candidateProposal,
        missingDecisions: checkpoint.missingDecisions,
      }),
    })),
    authorityBoundary: "non-governed-candidates-require-checkpoint-review-and-explicit-commit",
  }
  const plan = { ...body, planDigest: digestBody(body) }
  if (!isAdoptionAccelerationPlan(plan)) throw new Error("The adoption acceleration plan is invalid")
  return plan
}

export function isAdoptionAccelerationPlan(value: unknown): value is AdoptionAccelerationPlan {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const candidate = value as Partial<AdoptionAccelerationPlan>
  if (candidate.schemaVersion !== 1 || candidate.kind !== "gaep-existing-product-adoption-acceleration" ||
      candidate.authorityBoundary !== "non-governed-candidates-require-checkpoint-review-and-explicit-commit" ||
      typeof candidate.committedAt !== "string" || Number.isNaN(Date.parse(candidate.committedAt)) ||
      !candidate.product || typeof candidate.product.id !== "string" || candidate.product.id.length === 0 || candidate.product.id.length > 256 ||
      !Number.isSafeInteger(candidate.product.revision) || candidate.product.revision < 1 ||
      typeof candidate.product.digest !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(candidate.product.digest) ||
      typeof candidate.planDigest !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(candidate.planDigest)) return false
  if (!Array.isArray(candidate.checkpoints) || candidate.checkpoints.some((checkpoint) =>
    checkpoint.evidenceDigest !== canonicalDigest({ checkpoint: checkpoint.checkpoint, evidence: checkpoint.evidence }) ||
    checkpoint.proposalDigest !== canonicalDigest({
      checkpoint: checkpoint.checkpoint,
      candidateProposal: checkpoint.candidateProposal,
      missingDecisions: checkpoint.missingDecisions,
    }))) return false
  try {
    startExistingProductAdoptionReview({
      productAssessment: candidate.productAssessment ?? "",
      productGaps: candidate.productGaps ?? [],
      journeyAssessment: candidate.journeyAssessment ?? "",
      sources: candidate.sources ?? [],
      checkpoints: candidate.checkpoints ?? [],
    })
  } catch {
    return false
  }
  const { planDigest, ...body } = candidate as AdoptionAccelerationPlan
  return planDigest === digestBody(body)
}

export async function writeAdoptionAccelerationPlan(workspacePath: string, plan: AdoptionAccelerationPlan): Promise<void> {
  if (!isAdoptionAccelerationPlan(plan)) throw new Error("Refusing to persist an invalid adoption acceleration plan")
  const target = adoptionAccelerationPath(workspacePath)
  await mkdir(dirname(target), { recursive: true })
  const temporary = `${target}.${randomUUID()}.tmp`
  await writeFile(temporary, `${JSON.stringify(plan, null, 2)}\n`, { encoding: "utf8", mode: 0o600 })
  await rename(temporary, target)
}

export async function readAdoptionAccelerationPlan(workspacePath: string): Promise<AdoptionAccelerationPlan | undefined> {
  try {
    const parsed: unknown = JSON.parse(await readFile(adoptionAccelerationPath(workspacePath), "utf8"))
    if (!isAdoptionAccelerationPlan(parsed)) throw new Error("The persisted adoption acceleration plan failed integrity validation")
    return parsed
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined
    throw error
  }
}

export function adoptionPlanMatchesProduct(
  plan: AdoptionAccelerationPlan,
  product: { id: string; revision?: number; digest: string },
): boolean {
  return plan.product.id === product.id && plan.product.revision === (product.revision ?? 1) && plan.product.digest === product.digest
}

export function adoptionCandidateForCheckpoint(
  plan: AdoptionAccelerationPlan,
  checkpoint: ExistingProductJourneyCheckpointId,
): AdoptionAccelerationCheckpoint | undefined {
  return plan.checkpoints.find((candidate) => candidate.checkpoint === checkpoint)
}

export function reviewStateFromAdoptionPlan(plan: AdoptionAccelerationPlan): ExistingProductAdoptionReviewState {
  return startExistingProductAdoptionReview({
    productAssessment: plan.productAssessment,
    productGaps: plan.productGaps,
    journeyAssessment: plan.journeyAssessment,
    sources: plan.sources,
    checkpoints: plan.checkpoints,
  })
}
