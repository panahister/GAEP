import { canonicalDigest } from "@gaep/agent-sdk"
import type {
  ManagedApplyDecisionReceipt,
  ManagedRunEvidence,
  ManagedRunRecord,
  ManagedRunResult,
} from "@gaep/contracts"
import type { ManagedRunListPage } from "@gaep/engine"

const inventoryBoundary = "managed-run-inventory-is-read-only-and-does-not-grant-run-effect-apply-approval-or-outcome-authority"
const detailBoundary = "managed-evidence-detail-is-verified-read-only-evidence-and-does-not-grant-apply-approval-or-outcome-authority"
const privacyBoundary = "Portable identifiers, states, counts, digests, warning codes and timestamps only; prompts, provider output, source bytes, changed paths, executable paths, process state and credentials are omitted."

export interface ManagedRunSummaryDto {
  readonly schemaVersion: 1
  readonly kind: "managed-run-summary"
  readonly managedRunId: string
  readonly runId: string
  readonly productId: string
  readonly initiativeId: string
  readonly mode: ManagedRunRecord["mode"]
  readonly state: ManagedRunRecord["state"]
  readonly adapterId: string
  readonly agentId: string
  readonly modelId: string
  readonly attemptNumber: number
  readonly recoveryStatus: ManagedRunRecord["recovery"]["status"]
  readonly workflowCheckpointCount: number
  readonly hasResult: boolean
  readonly hasApplyDecision: boolean
  readonly bindingsDigest: string
  readonly resultDigest?: string
  readonly applyDecisionDigest?: string
  readonly createdAt: string
  readonly startedAt?: string
  readonly updatedAt: string
  readonly endedAt?: string
  readonly authorityBoundary: typeof inventoryBoundary
}

export interface ManagedRunPageDto {
  readonly schemaVersion: 1
  readonly kind: "managed-run-summary-page"
  readonly items: readonly ManagedRunSummaryDto[]
  readonly offset: number
  readonly limit: number
  readonly total: number
  readonly omittedCount: number
  readonly snapshotDigest: string
  readonly hasMore: boolean
  readonly authorityBoundary: typeof inventoryBoundary
  readonly privacyBoundary: typeof privacyBoundary
}

export interface ManagedEvidenceDetailDto {
  readonly schemaVersion: 1
  readonly kind: "managed-evidence-detail"
  readonly summary: ManagedRunSummaryDto
  readonly artifactStatus: "record-only" | "verified-result-and-evidence"
  readonly result?: {
    readonly resultId: string
    readonly resultDigest: string
    readonly providerDisposition: ManagedRunResult["providerDisposition"]
    readonly terminationCause: ManagedRunResult["terminationCause"]
    readonly outcomeStatus: ManagedRunResult["outcome"]["status"]
    readonly outcomeBasis: ManagedRunResult["outcome"]["basis"]
    readonly terminalState: ManagedRunResult["terminalState"]
    readonly evidenceId: string
    readonly evidenceDigest: string
    readonly warningCodes: readonly ManagedRunResult["warnings"][number][]
    readonly startedAt: string
    readonly endedAt: string
  }
  readonly evidence?: {
    readonly evidenceId: string
    readonly evidenceDigest: string
    readonly eventCount: number
    readonly eventTypeCounts: Readonly<Record<ManagedRunEvidence["events"][number]["type"], number>>
    readonly eventsDigest: string
    readonly workflowStrategy: ManagedRunEvidence["workflow"]["strategy"]
    readonly workflowStepCount: number
    readonly workflowAttemptCount: number
    readonly completedStepCount: number
    readonly charterEvidenceStatus: ManagedRunEvidence["workflow"]["charterGates"]["requiredEvidence"]["status"]
    readonly charterStopStatus: ManagedRunEvidence["workflow"]["charterGates"]["stopConditions"]["status"]
    readonly terminalReasonCode: string
    readonly staging?: {
      readonly changeCount: number
      readonly excludedPathCount: number
      readonly applyState: NonNullable<ManagedRunEvidence["staging"]>["applyState"]
      readonly baselineDigest: string
      readonly finalDigest: string
      readonly changedInventoryDigest: string
      readonly excludedPathSetDigest: string
    }
    readonly actualEffectCounts: Readonly<Record<ManagedRunEvidence["actualEffects"][number]["status"], number>>
    readonly capturedAt: string
  }
  readonly applyDecision?: {
    readonly receiptId: string
    readonly receiptDigest: string
    readonly managedRunRevision: number
    readonly changedInventoryCount: number
    readonly writeEnvelopeCount: number
    readonly changedInventoryDigest: string
    readonly writeEnvelopeDigest: string
    readonly decidedAt: string
  }
  readonly authorityBoundary: typeof detailBoundary
  readonly privacyBoundary: typeof privacyBoundary
}

export interface ManagedEvidenceReaders {
  readResult(id: string): Promise<ManagedRunResult>
  readEvidence(id: string): Promise<ManagedRunEvidence>
  readApplyDecision(id: string): Promise<ManagedApplyDecisionReceipt>
}

export function managedRunSummaryDto(record: ManagedRunRecord): ManagedRunSummaryDto {
  return {
    schemaVersion: 1,
    kind: "managed-run-summary",
    managedRunId: record.id,
    runId: record.runId,
    productId: record.productId,
    initiativeId: record.initiativeId,
    mode: record.mode,
    state: record.state,
    adapterId: record.provider.adapterId,
    agentId: record.provider.agentId,
    modelId: record.provider.modelId,
    attemptNumber: record.attemptNumber,
    recoveryStatus: record.recovery.status,
    workflowCheckpointCount: record.workflowCheckpoints?.length ?? 0,
    hasResult: record.resultId !== undefined,
    hasApplyDecision: record.applyDecisionId !== undefined,
    bindingsDigest: record.bindingsDigest,
    ...(record.resultDigest ? { resultDigest: record.resultDigest } : {}),
    ...(record.applyDecisionDigest ? { applyDecisionDigest: record.applyDecisionDigest } : {}),
    createdAt: record.createdAt,
    ...(record.startedAt ? { startedAt: record.startedAt } : {}),
    updatedAt: record.updatedAt,
    ...(record.endedAt ? { endedAt: record.endedAt } : {}),
    authorityBoundary: inventoryBoundary,
  }
}

export function managedRunPageDto(page: ManagedRunListPage): ManagedRunPageDto {
  return {
    schemaVersion: 1,
    kind: "managed-run-summary-page",
    items: page.items.map(managedRunSummaryDto),
    offset: page.offset,
    limit: page.limit,
    total: page.total,
    omittedCount: Math.max(0, page.total - page.items.length),
    snapshotDigest: page.snapshotDigest,
    hasMore: page.hasMore,
    authorityBoundary: inventoryBoundary,
    privacyBoundary,
  }
}

export async function managedEvidenceDetailDto(
  record: ManagedRunRecord,
  readers: ManagedEvidenceReaders,
): Promise<ManagedEvidenceDetailDto> {
  const summary = managedRunSummaryDto(record)
  if (!record.resultId || !record.resultDigest) {
    if (record.applyDecisionId || record.applyDecisionDigest) throw new Error("Managed apply decision exists without a bound result")
    return {
      schemaVersion: 1,
      kind: "managed-evidence-detail",
      summary,
      artifactStatus: "record-only",
      authorityBoundary: detailBoundary,
      privacyBoundary,
    }
  }

  const result = await readers.readResult(record.resultId)
  if (canonicalDigest(result) !== record.resultDigest || result.id !== record.resultId ||
      result.managedRunId !== record.id || result.runId !== record.runId || result.productId !== record.productId ||
      result.mode !== record.mode || result.terminalState !== record.state || result.evidenceDigest === undefined) {
    throw new Error("Managed result does not match its exact Run binding")
  }
  const evidence = await readers.readEvidence(result.evidenceId)
  if (canonicalDigest(evidence) !== result.evidenceDigest || evidence.id !== result.evidenceId ||
      evidence.managedRunId !== record.id || evidence.runId !== record.runId || evidence.productId !== record.productId ||
      evidence.bindingsDigest !== record.bindingsDigest) {
    throw new Error("Managed evidence does not match its exact result binding")
  }

  let applyDecision: ManagedApplyDecisionReceipt | undefined
  if (record.applyDecisionId && record.applyDecisionDigest) {
    applyDecision = await readers.readApplyDecision(record.applyDecisionId)
    if (!result.previousResultId || !result.previousResultDigest) {
      throw new Error("Managed apply decision has no exact predecessor review result")
    }
    const reviewResult = await readers.readResult(result.previousResultId)
    if (canonicalDigest(reviewResult) !== result.previousResultDigest || reviewResult.id !== result.previousResultId ||
        reviewResult.managedRunId !== record.id || reviewResult.runId !== record.runId ||
        reviewResult.productId !== record.productId || reviewResult.mode !== record.mode ||
        reviewResult.terminalState !== "review-required") {
      throw new Error("Managed apply decision predecessor result binding is invalid")
    }
    const reviewEvidence = await readers.readEvidence(reviewResult.evidenceId)
    if (canonicalDigest(reviewEvidence) !== reviewResult.evidenceDigest || reviewEvidence.id !== reviewResult.evidenceId ||
        reviewEvidence.managedRunId !== record.id || reviewEvidence.runId !== record.runId ||
        reviewEvidence.productId !== record.productId || reviewEvidence.bindingsDigest !== record.bindingsDigest ||
        reviewEvidence.staging?.applyState !== "pending") {
      throw new Error("Managed apply decision predecessor evidence binding is invalid")
    }
    if (canonicalDigest(applyDecision) !== record.applyDecisionDigest || applyDecision.id !== record.applyDecisionId ||
        applyDecision.managedRunId !== record.id || applyDecision.runId !== record.runId ||
        applyDecision.productId !== record.productId || applyDecision.bindingsDigest !== record.bindingsDigest ||
        applyDecision.reviewResultId !== reviewResult.id || applyDecision.reviewResultDigest !== result.previousResultDigest ||
        applyDecision.reviewEvidenceId !== reviewEvidence.id ||
        applyDecision.reviewEvidenceDigest !== reviewResult.evidenceDigest ||
        evidence.staging?.applyDecision?.receiptId !== applyDecision.id ||
        evidence.staging.applyDecision.receiptDigest !== record.applyDecisionDigest) {
      throw new Error("Managed apply decision does not match its exact evidence binding")
    }
  } else if (record.applyDecisionId || record.applyDecisionDigest) {
    throw new Error("Managed apply decision identity is incomplete")
  }

  const eventTypeCounts = countBy(
    ["lifecycle", "output", "item", "approval", "warning", "error"] as const,
    evidence.events.map((event) => event.type),
  )
  const actualEffectCounts = countBy(
    ["not-observed", "observed-provisional", "applied", "blocked", "unknown"] as const,
    evidence.actualEffects.map((effect) => effect.status),
  )
  return {
    schemaVersion: 1,
    kind: "managed-evidence-detail",
    summary,
    artifactStatus: "verified-result-and-evidence",
    result: {
      resultId: result.id,
      resultDigest: record.resultDigest,
      providerDisposition: result.providerDisposition,
      terminationCause: result.terminationCause,
      outcomeStatus: result.outcome.status,
      outcomeBasis: result.outcome.basis,
      terminalState: result.terminalState,
      evidenceId: result.evidenceId,
      evidenceDigest: result.evidenceDigest,
      warningCodes: [...result.warnings],
      startedAt: result.startedAt,
      endedAt: result.endedAt,
    },
    evidence: {
      evidenceId: evidence.id,
      evidenceDigest: result.evidenceDigest,
      eventCount: evidence.events.length,
      eventTypeCounts,
      eventsDigest: evidence.eventsDigest,
      workflowStrategy: evidence.workflow.strategy,
      workflowStepCount: evidence.workflow.orderedStepIds.length,
      workflowAttemptCount: evidence.workflow.attempts.length,
      completedStepCount: evidence.workflow.completedStepIds.length,
      charterEvidenceStatus: evidence.workflow.charterGates.requiredEvidence.status,
      charterStopStatus: evidence.workflow.charterGates.stopConditions.status,
      terminalReasonCode: evidence.workflow.terminalReasonCode,
      ...(evidence.staging ? {
        staging: {
          changeCount: evidence.staging.changes.length,
          excludedPathCount: evidence.staging.excludedPathCount,
          applyState: evidence.staging.applyState,
          baselineDigest: evidence.staging.baselineDigest,
          finalDigest: evidence.staging.finalDigest,
          changedInventoryDigest: canonicalDigest(evidence.staging.changes),
          excludedPathSetDigest: evidence.staging.excludedPathSetDigest,
        },
      } : {}),
      actualEffectCounts,
      capturedAt: evidence.capturedAt,
    },
    ...(applyDecision ? {
      applyDecision: {
        receiptId: applyDecision.id,
        receiptDigest: record.applyDecisionDigest!,
        managedRunRevision: applyDecision.managedRunRevision,
        changedInventoryCount: applyDecision.changedInventory.length,
        writeEnvelopeCount: applyDecision.writeEnvelope.length,
        changedInventoryDigest: applyDecision.changedInventoryDigest,
        writeEnvelopeDigest: applyDecision.writeEnvelopeDigest,
        decidedAt: applyDecision.decidedAt,
      },
    } : {}),
    authorityBoundary: detailBoundary,
    privacyBoundary,
  }
}

function countBy<const Values extends readonly string[]>(
  values: Values,
  observed: readonly Values[number][],
): Readonly<Record<Values[number], number>> {
  const counts = Object.fromEntries(values.map((value) => [value, 0])) as Record<Values[number], number>
  for (const value of observed) counts[value] += 1
  return counts
}
