import { canonicalDigest } from "@gaep/agent-sdk"
import type {
  ManagedApplyDecisionReceipt,
  ManagedRunEvidence,
  ManagedRunRecord,
  ManagedRunResult,
  ManagedWorkflowGateAssessment,
} from "@gaep/contracts"

export interface ManagedArtifactReader {
  readResult(id: string): Promise<ManagedRunResult>
  readEvidence(id: string): Promise<ManagedRunEvidence>
  readApplyDecision(id: string): Promise<ManagedApplyDecisionReceipt>
}

export interface VerifiedManagedArtifacts {
  result?: ManagedRunResult
  evidence?: ManagedRunEvidence
  applyDecision?: ManagedApplyDecisionReceipt
}

function reject(message: string): never {
  throw new Error(message)
}

function sameDigest(left: unknown, right: string | undefined): boolean {
  return right !== undefined && canonicalDigest(left) === right
}

function verifyEvaluator(assessment: ManagedWorkflowGateAssessment): void {
  if (assessment.evaluator.digest !== canonicalDigest({
    kind: assessment.evaluator.kind,
    id: assessment.evaluator.id,
    version: assessment.evaluator.version,
  })) reject("Managed Workflow gate evaluator binding is invalid")
}

function verifyRecord(record: ManagedRunRecord): void {
  if (!sameDigest(record.bindings, record.bindingsDigest)) {
    reject("Managed Run bindings digest is invalid")
  }
  if (!sameDigest(record.bindingSnapshots.initiative, record.bindings.initiative.digest) ||
      !sameDigest(record.bindingSnapshots.run, record.bindings.run.digest)) {
    reject("Managed Run binding snapshot digest is invalid")
  }
  const initiative = record.bindingSnapshots.initiative
  const run = record.bindingSnapshots.run
  if (record.bindings.product.recordId !== record.productId ||
      record.bindings.initiative.recordId !== record.initiativeId ||
      initiative.id !== record.initiativeId || initiative.productId !== record.productId ||
      record.bindings.run.recordId !== record.runId || run.id !== record.runId ||
      run.productId !== record.productId || run.initiativeId !== record.initiativeId ||
      record.bindings.charter.recordId !== run.charterId || run.charterDigest !== record.bindings.charter.digest ||
      canonicalDigest(run.agent) !== record.bindings.agentSelectionDigest) {
    reject("Managed Run exact binding identity is invalid")
  }
  if (record.provider.adapterId !== run.agent.adapterId ||
      record.provider.agentId !== run.agent.agentId ||
      record.provider.modelId !== run.agent.modelId ||
      record.provider.capabilityDigest !== run.agent.capabilityDigest) {
    reject("Managed Run provider binding does not match its exact Agent Selection")
  }
}

function verifyWorkflow(record: ManagedRunRecord, result: ManagedRunResult, evidence: ManagedRunEvidence): void {
  const plan = record.bindings.workflowPlan
  if (!plan || evidence.workflow.plan.digest !== plan.digest ||
      canonicalDigest(evidence.workflow.plan) !== canonicalDigest(plan)) {
    reject("Managed Workflow Plan binding is invalid")
  }
  const assessments = [
    evidence.workflow.charterGates.requiredEvidence,
    evidence.workflow.charterGates.stopConditions,
    ...evidence.workflow.attempts.flatMap((attempt) => [
      attempt.gates.preconditions,
      attempt.gates.outputs,
      attempt.gates.evidence,
      attempt.gates.stopConditions,
    ]),
  ]
  for (const assessment of assessments) verifyEvaluator(assessment)

  for (const attempt of evidence.workflow.attempts) {
    if (attempt.stepIndex !== evidence.workflow.orderedStepIds.indexOf(attempt.stepId) ||
        (attempt.eventRange !== undefined && attempt.eventRange.endSequence >= evidence.events.length)) {
      reject("Managed Workflow attempt binding is invalid")
    }
  }
  const completed = new Set(evidence.workflow.attempts
    .filter((attempt) => attempt.state === "completed")
    .map((attempt) => attempt.stepId))
  const exactCompleted = evidence.workflow.orderedStepIds.filter((stepId) => completed.has(stepId))
  if (canonicalDigest(exactCompleted) !== canonicalDigest(evidence.workflow.completedStepIds) ||
      canonicalDigest(evidence.workflow.completedStepIds) !== canonicalDigest(
        evidence.workflow.orderedStepIds.slice(0, evidence.workflow.completedStepIds.length),
      )) {
    reject("Managed Workflow completion set is invalid")
  }

  if (result.outcome.evaluator && result.outcome.evaluator.digest !== canonicalDigest({
    kind: result.outcome.evaluator.kind,
    id: result.outcome.evaluator.id,
    version: result.outcome.evaluator.version,
  })) reject("Managed Result postcondition evaluator binding is invalid")

  const workflowCompleted = evidence.workflow.terminalReasonCode === "workflow-completed" &&
    evidence.workflow.completedStepIds.length === evidence.workflow.orderedStepIds.length &&
    evidence.workflow.charterGates.requiredEvidence.status === "satisfied" &&
    evidence.workflow.charterGates.stopConditions.status === "satisfied"
  if ((result.terminalState === "completed") !== workflowCompleted) {
    reject("Managed Result completion contradicts Workflow evidence")
  }
  const lastAttempt = evidence.workflow.attempts.at(-1)
  if (result.terminalState === "review-required" &&
      (evidence.workflow.terminalReasonCode !== "apply-review-required" || lastAttempt?.state !== "review-required" ||
       evidence.staging?.applyState !== "pending")) {
    reject("Managed Result review state contradicts Workflow evidence")
  }
  if (result.terminalState === "conflict" &&
      (evidence.workflow.terminalReasonCode !== "source-workspace-conflict" || evidence.staging?.applyState !== "conflict")) {
    reject("Managed Result conflict state contradicts Workflow evidence")
  }
  if (result.terminalState === "discarded" &&
      (evidence.workflow.terminalReasonCode !== "staged-changes-discarded" || evidence.staging?.applyState !== "discarded")) {
    reject("Managed Result discard state contradicts Workflow evidence")
  }
}

function expectedEffectStatus(
  effect: ManagedRunEvidence["actualEffects"][number]["effect"],
  state: ManagedRunResult["terminalState"],
  staging: ManagedRunEvidence["staging"],
): ManagedRunEvidence["actualEffects"][number]["status"] {
  if (effect === "reversible-change" && staging?.applyState === "applied") return "applied"
  if (["unknown", "conflict"].includes(state)) return "unknown"
  if (["failed", "cancelled", "timed-out", "discarded"].includes(state)) return "blocked"
  if (effect === "reversible-change") {
    return staging?.changes.length ? "observed-provisional" : "not-observed"
  }
  if (effect === "provisional") return staging?.changes.length ? "observed-provisional" : "not-observed"
  if (effect === "observe") return "observed-provisional"
  return "blocked"
}

function matchesCurrentEngineDiscardEffectDigest(
  effect: ManagedRunEvidence["actualEffects"][number],
  evidence: ManagedRunEvidence,
  priorEvidenceDigest: string | undefined,
): boolean {
  // Current persisted discard evidence predates the common effectsSeed formula. Keep these
  // two exact, discard-only encodings visible until a governed evidence-version migration.
  const liveReviewDiscard = canonicalDigest({
    effect: effect.effect,
    disposition: "discarded",
    eventsDigest: evidence.eventsDigest,
  })
  const durableReviewDiscard = priorEvidenceDigest === undefined ? undefined : canonicalDigest({
    priorEvidenceDigest,
    effect: effect.effect,
    disposition: "durable-review-discarded",
  })
  return effect.evidenceDigest === liveReviewDiscard || effect.evidenceDigest === durableReviewDiscard
}

function verifyEffects(
  result: ManagedRunResult,
  evidence: ManagedRunEvidence,
  discardPriorEvidenceDigest?: string,
): void {
  const effectsSeed = canonicalDigest({
    events: evidence.events,
    staging: evidence.staging,
    disposition: result.providerDisposition,
  })
  const discardCompatibility = result.terminalState === "discarded" &&
    evidence.staging?.applyState === "discarded"
  for (const effect of evidence.actualEffects) {
    if (effect.status !== expectedEffectStatus(effect.effect, result.terminalState, evidence.staging)) {
      reject("Managed effect status contradicts terminal or staging evidence")
    }
    const currentDigest = canonicalDigest({ effectsSeed, effect: effect.effect })
    if (effect.evidenceDigest !== currentDigest &&
        !(discardCompatibility && matchesCurrentEngineDiscardEffectDigest(
          effect,
          evidence,
          discardPriorEvidenceDigest,
        ))) {
      reject("Managed effect evidence digest is invalid")
    }
  }
}

function verifyResultAndEvidence(
  record: ManagedRunRecord,
  result: ManagedRunResult,
  expectedResultId: string,
  expectedResultDigest: string,
  evidence: ManagedRunEvidence,
  discardPriorEvidenceDigest?: string,
): void {
  if (result.id !== expectedResultId || !sameDigest(result, expectedResultDigest) ||
      result.managedRunId !== record.id || result.runId !== record.runId || result.productId !== record.productId ||
      result.mode !== record.mode || canonicalDigest(result.provider) !== canonicalDigest(record.provider)) {
    reject("Managed Result identity or provider binding is invalid")
  }
  if (evidence.id !== result.evidenceId || !sameDigest(evidence, result.evidenceDigest) ||
      evidence.managedRunId !== record.id || evidence.runId !== record.runId || evidence.productId !== record.productId ||
      evidence.bindingsDigest !== record.bindingsDigest || !sameDigest(evidence.events, evidence.eventsDigest)) {
    reject("Managed Evidence identity or event-set binding is invalid")
  }
  verifyWorkflow(record, result, evidence)
  verifyEffects(result, evidence, discardPriorEvidenceDigest)
}

async function readDiscardPriorEvidenceDigest(
  record: ManagedRunRecord,
  result: ManagedRunResult,
  reader: ManagedArtifactReader,
): Promise<string | undefined> {
  if (result.terminalState !== "discarded") return undefined
  if (!result.previousResultId || !result.previousResultDigest) {
    reject("Discarded Managed Result is missing its exact predecessor")
  }
  const priorResult = await reader.readResult(result.previousResultId)
  const priorEvidence = await reader.readEvidence(priorResult.evidenceId)
  verifyResultAndEvidence(
    record,
    priorResult,
    result.previousResultId,
    result.previousResultDigest,
    priorEvidence,
  )
  if (!["review-required", "conflict"].includes(priorResult.terminalState)) {
    reject("Discarded Managed Result predecessor is not a review or conflict state")
  }
  return canonicalDigest(priorEvidence)
}

function pathWithinEnvelope(path: string, envelope: readonly string[]): boolean {
  return envelope.some((scope) => scope === "." || path === scope || path.startsWith(`${scope}/`))
}

async function verifyApplyDecision(
  record: ManagedRunRecord,
  currentResult: ManagedRunResult,
  currentEvidence: ManagedRunEvidence,
  receipt: ManagedApplyDecisionReceipt,
  reader: ManagedArtifactReader,
): Promise<void> {
  if (receipt.id !== record.applyDecisionId || !sameDigest(receipt, record.applyDecisionDigest) ||
      receipt.managedRunId !== record.id || receipt.runId !== record.runId || receipt.productId !== record.productId ||
      receipt.bindingsDigest !== record.bindingsDigest ||
      !sameDigest(receipt.changedInventory, receipt.changedInventoryDigest) ||
      !sameDigest(receipt.writeEnvelope, receipt.writeEnvelopeDigest) ||
      receipt.changedInventory.some((change) => !pathWithinEnvelope(change.path, receipt.writeEnvelope))) {
    reject("Managed apply-decision binding is invalid")
  }

  const receiptBindsCurrent = receipt.reviewResultId === currentResult.id
  let reviewResult: ManagedRunResult
  let reviewEvidence: ManagedRunEvidence
  if (receiptBindsCurrent) {
    if (record.state !== "applying" || record.revision !== receipt.managedRunRevision + 1 ||
        receipt.reviewResultDigest !== canonicalDigest(currentResult)) {
      reject("Managed apply decision does not bind the current review revision")
    }
    reviewResult = currentResult
    reviewEvidence = currentEvidence
  } else {
    if (record.revision !== receipt.managedRunRevision + 2 ||
        currentResult.previousResultId !== receipt.reviewResultId ||
        currentResult.previousResultDigest !== receipt.reviewResultDigest) {
      reject("Managed apply decision does not bind the immediate review predecessor")
    }
    reviewResult = await reader.readResult(receipt.reviewResultId)
    reviewEvidence = await reader.readEvidence(reviewResult.evidenceId)
    verifyResultAndEvidence(
      record,
      reviewResult,
      receipt.reviewResultId,
      receipt.reviewResultDigest,
      reviewEvidence,
    )
  }

  if (reviewResult.terminalState !== "review-required" ||
      receipt.reviewEvidenceId !== reviewEvidence.id ||
      receipt.reviewEvidenceDigest !== canonicalDigest(reviewEvidence) ||
      reviewResult.evidenceId !== reviewEvidence.id || reviewResult.evidenceDigest !== receipt.reviewEvidenceDigest ||
      reviewEvidence.staging?.applyState !== "pending" ||
      canonicalDigest(reviewEvidence.staging.changes) !== receipt.changedInventoryDigest) {
    reject("Managed apply decision does not bind exact pending review evidence")
  }

  if (!receiptBindsCurrent && currentEvidence.staging) {
    if (currentEvidence.staging.applyState === "pending" ||
        canonicalDigest(currentEvidence.staging.changes) !== receipt.changedInventoryDigest ||
        currentEvidence.staging.applyDecision?.receiptId !== receipt.id ||
        currentEvidence.staging.applyDecision.receiptDigest !== canonicalDigest(receipt)) {
      reject("Post-apply evidence does not bind the exact apply decision")
    }
  } else if (!receiptBindsCurrent &&
      !["failed", "unknown"].includes(currentResult.terminalState)) {
    reject("Post-apply terminal evidence is missing its staging decision binding")
  }
}

export async function readVerifiedManagedArtifacts(
  record: ManagedRunRecord,
  reader: ManagedArtifactReader,
): Promise<VerifiedManagedArtifacts> {
  verifyRecord(record)
  if (!record.resultId || !record.resultDigest) {
    if (record.applyDecisionId || record.applyDecisionDigest) {
      reject("Managed Run has an apply decision without a current result")
    }
    if (!["prepared", "running"].includes(record.state)) {
      reject("Managed Run state requires a current Result")
    }
    return {}
  }

  const result = await reader.readResult(record.resultId)
  const evidence = await reader.readEvidence(result.evidenceId)
  const discardPriorEvidenceDigest = await readDiscardPriorEvidenceDigest(record, result, reader)
  verifyResultAndEvidence(record, result, record.resultId, record.resultDigest, evidence, discardPriorEvidenceDigest)

  const applyingBoundReview = record.state === "applying" && result.terminalState === "review-required" &&
    record.applyDecisionId !== undefined && record.applyDecisionDigest !== undefined
  if (record.state !== result.terminalState && !applyingBoundReview) {
    reject("Managed Run state contradicts its current Result terminal state")
  }

  if (!record.applyDecisionId || !record.applyDecisionDigest) return { result, evidence }
  const applyDecision = await reader.readApplyDecision(record.applyDecisionId)
  await verifyApplyDecision(record, result, evidence, applyDecision, reader)
  return { result, evidence, applyDecision }
}
