import { canonicalDigest } from "@gaep/agent-sdk"
import {
  executionWorkspaceScopeSchema,
  managedChangedFileEvidenceSchema,
  type ManagedRunEvidence,
  type ManagedRunRecord,
  type ManagedRunResult,
} from "@gaep/contracts"
import type {
  ManagedExecutionApplyConfirmation,
  ManagedExecutionReview,
  ManagedEvaluatorIdentity,
  ManagedPendingReviewStatus,
  ManagedWorkflowGateEvaluator,
} from "@gaep/engine"

import {
  managedEvidenceDetailDto,
  type ManagedEvidenceDetailDto,
  type ManagedEvidenceReaders,
} from "./managed-evidence-rpc.js"

const previewBoundary = "managed-review-preview-authorizes-no-mutation-without-an-exact-digest-bound-human-decision" as const
const previewPrivacyBoundary = "Exact portable identifiers, digests, warning codes, workspace-relative changed paths, file digests, sizes, modes and write scopes only; prompts, provider output, source bytes, absolute paths, executable paths, process state and credentials are omitted." as const
const transitionBoundary = "managed-review-transition-proves-persisted-state-not-provider-outcome-or-machine-local-cleanup" as const
const cleanupBoundary = "Persisted discard or apply state does not independently prove machine-local stage or recovery-journal cleanup." as const
const changedInventoryLimit = 512 as const

const notAssessedEvaluatorIdentity = {
  kind: "system",
  id: "gaep.engine-host.review-boundary",
  version: "1",
  digest: canonicalDigest({
    kind: "managed-review-workflow-gate-policy",
    policy: "record-not-assessed",
    version: 1,
  }) as `sha256:${string}`,
} satisfies ManagedEvaluatorIdentity

export const recordManagedReviewWorkflowGatesNotAssessed: ManagedWorkflowGateEvaluator = async () => ({
  status: "not-assessed",
  basis: "system-evaluator",
  evaluator: notAssessedEvaluatorIdentity,
})

type ReviewState = Extract<ManagedRunRecord["state"], "review-required" | "conflict">
type ChangedFile = NonNullable<ManagedRunEvidence["staging"]>["changes"][number]

export interface ManagedReviewPreviewDto {
  readonly schemaVersion: 1
  readonly kind: "managed-review-preview"
  readonly managedRunId: string
  readonly managedRunRevision: number
  readonly runId: string
  readonly productId: string
  readonly initiativeId: string
  readonly mode: ManagedRunRecord["mode"]
  readonly state: ReviewState
  readonly canApply: boolean
  readonly canDiscard: boolean
  readonly hasLocalJournal: boolean
  readonly bindingsDigest: string
  readonly result: {
    readonly resultId: string
    readonly resultDigest: string
    readonly terminalState: ReviewState
    readonly providerDisposition: ManagedRunResult["providerDisposition"]
    readonly outcomeStatus: ManagedRunResult["outcome"]["status"]
    readonly outcomeBasis: ManagedRunResult["outcome"]["basis"]
    readonly warningCodes: readonly ManagedRunResult["warnings"][number][]
    readonly evidenceId: string
    readonly evidenceDigest: string
  }
  readonly staging: {
    readonly evidenceId: string
    readonly evidenceDigest: string
    readonly baselineDigest: string
    readonly finalDigest: string
    readonly applyState: "pending" | "conflict"
    readonly changeCount: number
    readonly changedInventoryLimit: typeof changedInventoryLimit
    readonly omittedCount: 0
    readonly changedInventory: readonly ChangedFile[]
    readonly changedInventoryDigest: string
    readonly excludedPathCount: number
    readonly excludedPathSetDigest: string
  }
  readonly applyConfirmation?: ManagedExecutionApplyConfirmation
  readonly postApplyGatePolicy: "record-not-assessed"
  readonly authorityBoundary: typeof previewBoundary
  readonly privacyBoundary: typeof previewPrivacyBoundary
  readonly cleanupBoundary: typeof cleanupBoundary
  readonly previewDigest: string
}

export interface ManagedReviewTransitionDto {
  readonly schemaVersion: 1
  readonly kind: "managed-review-transition"
  readonly decision: "apply-exact-managed-review" | "discard-exact-managed-review"
  readonly sourcePreviewDigest: string
  readonly sourceManagedRunRevision: number
  readonly managedRunId: string
  readonly managedRunRevision: number
  readonly state: ManagedRunRecord["state"]
  readonly canApply: boolean
  readonly canDiscard: boolean
  readonly hasLocalJournal: boolean
  readonly detail: ManagedEvidenceDetailDto
  readonly authorityBoundary: typeof transitionBoundary
  readonly cleanupBoundary: typeof cleanupBoundary
  readonly transitionDigest: string
}

export async function managedReviewPreviewDto(
  record: ManagedRunRecord,
  status: ManagedPendingReviewStatus,
  readers: ManagedEvidenceReaders,
): Promise<ManagedReviewPreviewDto> {
  if (record.id !== status.managedRunId || record.state !== status.state ||
      !["review-required", "conflict"].includes(record.state)) {
    throw new Error("Managed review status does not match an exact pending review record")
  }
  if (!status.canDiscard || status.canApply !== (status.applyConfirmation !== undefined) ||
      (record.state === "conflict" && status.canApply)) {
    throw new Error("Managed review decision availability is inconsistent")
  }

  const detail = await managedEvidenceDetailDto(record, readers)
  if (detail.artifactStatus !== "verified-result-and-evidence" || !detail.result || !detail.evidence ||
      !record.resultId || !record.resultDigest) {
    throw new Error("Managed review does not have exact verified result and evidence artifacts")
  }
  const [result, evidence] = await Promise.all([
    readers.readResult(record.resultId),
    readers.readEvidence(detail.result.evidenceId),
  ])
  if (canonicalDigest(result) !== record.resultDigest || canonicalDigest(evidence) !== detail.result.evidenceDigest ||
      result.id !== detail.result.resultId || evidence.id !== detail.result.evidenceId) {
    throw new Error("Managed review artifacts changed during projection")
  }
  const staging = evidence.staging
  const expectedApplyState = record.state === "review-required" ? "pending" : "conflict"
  if (!staging || staging.applyState !== expectedApplyState) {
    throw new Error("Managed review staging evidence does not match its pending state")
  }
  if (staging.changes.length > changedInventoryLimit) {
    throw new Error("Managed review changed inventory exceeds the exact cross-host review bound")
  }
  const changedInventory = staging.changes.map((change) => managedChangedFileEvidenceSchema.parse(change))
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((change) => ({ ...change }))
  const changedInventoryDigest = canonicalDigest(changedInventory)
  const applyConfirmation = status.applyConfirmation
  const writeEnvelope = applyConfirmation
    ? applyConfirmation.writeEnvelope.map((scope) => executionWorkspaceScopeSchema.parse(scope))
    : undefined
  if (applyConfirmation && (
    !writeEnvelope ||
    applyConfirmation.decision !== "apply-exact-reviewed-inventory" ||
    applyConfirmation.reviewEvidenceId !== evidence.id ||
    applyConfirmation.reviewEvidenceDigest !== canonicalDigest(evidence) ||
    applyConfirmation.changedInventoryDigest !== changedInventoryDigest ||
    applyConfirmation.writeEnvelopeDigest !== canonicalDigest(writeEnvelope) ||
    new Set(writeEnvelope).size !== writeEnvelope.length
  )) {
    throw new Error("Managed review apply confirmation does not bind the exact staged inventory")
  }

  const body = {
    schemaVersion: 1 as const,
    kind: "managed-review-preview" as const,
    managedRunId: record.id,
    managedRunRevision: record.revision,
    runId: record.runId,
    productId: record.productId,
    initiativeId: record.initiativeId,
    mode: record.mode,
    state: record.state as ReviewState,
    canApply: status.canApply,
    canDiscard: status.canDiscard,
    hasLocalJournal: status.hasLocalJournal,
    bindingsDigest: record.bindingsDigest,
    result: {
      resultId: result.id,
      resultDigest: record.resultDigest,
      terminalState: result.terminalState as ReviewState,
      providerDisposition: result.providerDisposition,
      outcomeStatus: result.outcome.status,
      outcomeBasis: result.outcome.basis,
      warningCodes: [...result.warnings],
      evidenceId: evidence.id,
      evidenceDigest: canonicalDigest(evidence),
    },
    staging: {
      evidenceId: evidence.id,
      evidenceDigest: canonicalDigest(evidence),
      baselineDigest: staging.baselineDigest,
      finalDigest: staging.finalDigest,
      applyState: staging.applyState as "pending" | "conflict",
      changeCount: changedInventory.length,
      changedInventoryLimit,
      omittedCount: 0 as const,
      changedInventory,
      changedInventoryDigest,
      excludedPathCount: staging.excludedPathCount,
      excludedPathSetDigest: staging.excludedPathSetDigest,
    },
    ...(applyConfirmation ? {
      applyConfirmation: {
        ...applyConfirmation,
        writeEnvelope: [...writeEnvelope!],
      },
    } : {}),
    postApplyGatePolicy: "record-not-assessed" as const,
    authorityBoundary: previewBoundary,
    privacyBoundary: previewPrivacyBoundary,
    cleanupBoundary,
  }
  return { ...body, previewDigest: canonicalDigest(body) }
}

export async function managedReviewTransitionDto(
  decision: ManagedReviewTransitionDto["decision"],
  source: ManagedReviewPreviewDto,
  review: ManagedExecutionReview,
  readers: ManagedEvidenceReaders,
): Promise<ManagedReviewTransitionDto> {
  if (review.record.id !== source.managedRunId || review.record.revision <= source.managedRunRevision ||
      review.result.managedRunId !== review.record.id || review.evidence.managedRunId !== review.record.id ||
      canonicalDigest(review.result) !== review.record.resultDigest ||
      canonicalDigest(review.evidence) !== review.result.evidenceDigest) {
    throw new Error("Managed review transition does not advance the exact reviewed Run")
  }
  const detail = await managedEvidenceDetailDto(review.record, readers)
  if (detail.artifactStatus !== "verified-result-and-evidence") {
    throw new Error("Managed review transition has no verified terminal artifacts")
  }
  if (decision === "apply-exact-managed-review" && !detail.applyDecision) {
    throw new Error("Managed review apply transition has no exact apply-decision receipt")
  }
  const body = {
    schemaVersion: 1 as const,
    kind: "managed-review-transition" as const,
    decision,
    sourcePreviewDigest: source.previewDigest,
    sourceManagedRunRevision: source.managedRunRevision,
    managedRunId: review.record.id,
    managedRunRevision: review.record.revision,
    state: review.record.state,
    canApply: review.canApply,
    canDiscard: review.canDiscard,
    hasLocalJournal: review.hasLocalJournal,
    detail,
    authorityBoundary: transitionBoundary,
    cleanupBoundary,
  }
  return { ...body, transitionDigest: canonicalDigest(body) }
}
