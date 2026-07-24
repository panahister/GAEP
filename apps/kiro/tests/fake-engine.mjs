import { createHash } from "node:crypto"
import { createInterface } from "node:readline"

const productId = "11111111-1111-4111-8111-111111111111"
const bundleId = "22222222-2222-4222-8222-222222222222"
const runId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const charterId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const handoffId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
const workflowPlanId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
const managedRunId = "ffffffff-ffff-4fff-8fff-ffffffffffff"
const managedGovernedRunId = "12121212-1212-4212-8212-121212121212"
const workflowStepId = "13131313-1313-4313-8313-131313131313"
const managedResultId = "14141414-1414-4414-8414-141414141414"
const managedEvidenceId = "15151515-1515-4515-8515-151515151515"
const stagedManagedRunId = "16161616-1616-4616-8616-161616161616"
const stagedResultId = "17171717-1717-4717-8717-171717171717"
const stagedEvidenceId = "18181818-1818-4818-8818-181818181818"
const transitionedResultId = "19191919-1919-4919-8919-191919191919"
const transitionedEvidenceId = "20202020-2020-4020-8020-202020202020"
const applyDecisionId = "21212121-2121-4121-8121-212121212121"
const previewDigest = managedReadOnlyPreview().previewDigest
const privateRoot = "/Users/private/portable-design"
const privateCredential = "PRIVATE-OAUTH-TOKEN"
const workspacePath = process.argv[process.argv.indexOf("--workspace") + 1] ?? ""
let selectedAgent = null

if (process.env.AWS_SECRET_ACCESS_KEY || process.env.OPENAI_API_KEY || process.env.HOME || process.env.USERPROFILE) {
  process.exit(91)
}

const input = createInterface({ input: process.stdin, crlfDelay: Infinity })
input.on("line", (line) => {
  const request = JSON.parse(line)
  const id = request.id
  if (!exactKeys(request, ["jsonrpc", "id", "method", "params", "protocolVersion"]) ||
    request.jsonrpc !== "2.0" || request.protocolVersion !== 2) {
    writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID ENVELOPE")
    return
  }
  switch (request.method) {
    case "readProduct":
      if (!exactKeys(request.params, [])) return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE PARAMS")
      return writeResult(id, {
        id: productId,
        name: "Example Product",
        revision: 7,
        providerState: privateCredential,
      })
    case "probeAgents":
      if (!exactKeys(request.params, [])) return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE PARAMS")
      return writeResult(id, readinessSnapshots(workspacePath.endsWith("bad-readiness")))
    case "readAgentSelection":
      if (!exactKeys(request.params, [])) return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE PARAMS")
      if (workspacePath.endsWith("bad-selection")) {
        return writeResult(id, {
          status: "selected",
          selection: { ...agentSelection(), runtimeExecutable: `${privateRoot}/${privateCredential}` },
        })
      }
      return writeResult(id, selectedAgent ? { status: "selected", selection: selectedAgent } : { status: "unselected" })
    case "selectAgent":
      return selectAgent(id, request.params)
    case "listRuns":
      if (!exactKeys(request.params, [])) return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE PARAMS")
      return writeResult(id, [agentRun(workspacePath.endsWith("bad-runs"))])
    case "createHandoff":
      return createHandoff(id, request.params)
    case "managed.readonly.preview":
      return previewManagedReadOnly(id, request.params)
    case "managed.readonly.execute":
      return executeManagedReadOnly(id, request.params)
    case "managed.evidence.list":
      return listManagedEvidence(id, request.params)
    case "managed.evidence.read":
      return readManagedEvidence(id, request.params)
    case "managed.review.read":
      return readManagedReview(id, request.params)
    case "managed.review.apply":
      return decideManagedReview(id, request.params, "apply-exact-managed-review")
    case "managed.review.discard":
      return decideManagedReview(id, request.params, "discard-exact-managed-review")
    case "productStudio.portableDesign.import":
      return importSnapshot(id, request.params)
    case "productStudio.portableDesign.list":
      return listSnapshots(id, request.params)
    case "productStudio.portableDesign.read":
      return readSnapshot(id, request.params)
    default:
      return writeError(id, -32_601, "METHOD_NOT_FOUND", "PRIVATE METHOD")
  }
})

function selectAgent(id, params) {
  if (!exactKeys(params, ["adapterId", "modelId", "settings", "actorId"]) ||
    params.adapterId !== "openai-codex" || params.modelId !== "gpt-5.6-codex" ||
    !exactKeys(params.settings, ["reasoningEffort"]) || params.settings.reasoningEffort !== "high" ||
    params.actorId !== "founder.kiro-review") {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE SELECTION PARAMS")
  }
  selectedAgent = agentSelection(params.settings)
  return writeResult(id, selectedAgent)
}

function agentSelection(settings = { reasoningEffort: "high" }) {
  return {
    schemaVersion: 2,
    adapterId: "openai-codex",
    agentId: "codex",
    modelId: "gpt-5.6-codex",
    modelTruthClass: "observed",
    modelAlias: false,
    settings,
    selectedAt: "2026-07-24T08:05:00.000Z",
    capabilityDigest: `sha256:${"e".repeat(64)}`,
  }
}

function targetAgentSelection() {
  return {
    ...agentSelection({ reasoningEffort: "medium" }),
    modelId: "gpt-5.6-codex-next",
    selectedAt: "2026-07-24T08:10:00.000Z",
    capabilityDigest: `sha256:${"f".repeat(64)}`,
  }
}

function agentRun(includePrivatePath = false) {
  const run = {
    schemaVersion: 1,
    id: runId,
    revision: 3,
    charterId,
    charterDigest: `sha256:${"1".repeat(64)}`,
    productId,
    initiativeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    agent: agentSelection(),
    state: "completed",
    providerSessionRef: `sha256:${"2".repeat(64)}`,
    startedAt: "2026-07-24T08:00:00.000Z",
    endedAt: "2026-07-24T08:04:00.000Z",
  }
  if (includePrivatePath) run.runtimeExecutable = `${privateRoot}/${privateCredential}`
  return run
}

function createHandoff(id, params) {
  const expected = {
    fromRunId: runId,
    toAdapterId: "openai-codex",
    toModelId: "gpt-5.6-codex-next",
    toSettings: { reasoningEffort: "medium" },
    reason: "Switch to the reviewed model",
    completedWork: ["Selection workflow completed"],
    unresolvedMatters: ["Native Kiro acceptance remains"],
    decisions: ["Keep execution disabled"],
    evidence: ["evidence/kiro-selection.json"],
  }
  if (!exactKeys(params, ["actorId", "handoff"]) || params.actorId !== "founder.kiro-review" ||
    !params.handoff || !exactKeys(params.handoff, Object.keys(expected)) ||
    JSON.stringify(params.handoff) !== JSON.stringify(expected)) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE HANDOFF PARAMS")
  }
  selectedAgent = targetAgentSelection()
  const value = agentHandoff()
  if (workspacePath.endsWith("bad-handoff")) value.runtimeExecutable = `${privateRoot}/${privateCredential}`
  if (workspacePath.endsWith("bad-handoff-binding")) value.toAgent.settings.reasoningEffort = "high"
  return writeResult(id, value)
}

function agentHandoff() {
  return {
    schemaVersion: 1,
    id: handoffId,
    productId,
    initiativeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    fromRunId: runId,
    toAgent: targetAgentSelection(),
    reason: "Switch to the reviewed model",
    workspaceBaseline: {
      gitHead: "abcdef1",
      dirty: true,
      changedFiles: ["src/index.ts"],
      truthClass: "observed",
    },
    completedWork: ["Selection workflow completed"],
    unresolvedMatters: ["Native Kiro acceptance remains"],
    decisions: ["Keep execution disabled"],
    evidence: ["evidence/kiro-selection.json"],
    capabilityDifferences: ["Model changes from gpt-5.6-codex to gpt-5.6-codex-next."],
    createdAt: "2026-07-24T08:10:00.000Z",
  }
}

function previewManagedReadOnly(id, params) {
  if (!exactKeys(params, ["charterId", "workflowPlanId"]) || params.charterId !== charterId ||
    params.workflowPlanId !== workflowPlanId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE MANAGED PREVIEW PARAMS")
  }
  const value = managedReadOnlyPreview()
  if (workspacePath.endsWith("bad-managed-preview")) value.runtimeExecutable = `${privateRoot}/${privateCredential}`
  if (workspacePath.endsWith("bad-managed-criterion")) value.gates[2].criteria[0] = `Inspect ${privateRoot}/${privateCredential}`
  if (workspacePath.endsWith("bad-managed-digest")) value.previewDigest = `sha256:${"0".repeat(64)}`
  return writeResult(id, value)
}

function executeManagedReadOnly(id, params) {
  if (!exactKeys(params, [
    "actorId", "charterId", "workflowPlanId", "expectedPreviewDigest", "timeoutMs", "confirmation",
  ]) || params.actorId !== "founder.kiro-review" || params.charterId !== charterId ||
    params.workflowPlanId !== workflowPlanId || params.expectedPreviewDigest !== previewDigest ||
    params.timeoutMs !== 30_000 || params.confirmation !== "attest-exact-managed-readonly-preview") {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE MANAGED EXECUTE PARAMS")
  }
  const value = managedReadOnlyReceipt()
  if (workspacePath.endsWith("bad-managed-receipt")) value.rawProviderOutput = `${privateRoot}/${privateCredential}`
  if (workspacePath.endsWith("bad-managed-binding")) value.previewDigest = `sha256:${"b".repeat(64)}`
  return writeResult(id, value)
}

function managedReadOnlyPreview() {
  const stepGate = (phase, criterion) => {
    const criteria = [criterion]
    return {
      key: `step:${workflowStepId}:${phase}`,
      stepId: workflowStepId,
      phase,
      criteria,
      criteriaDigest: canonicalDigest(criteria),
    }
  }
  const requiredEvidence = ["Record one observation receipt"]
  const stopConditions = ["Stop if governed scope changes"]
  const body = {
    schemaVersion: 1,
    kind: "managed-readonly-preview",
    productId,
    initiativeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    charterId,
    charterDigest: `sha256:${"3".repeat(64)}`,
    workflowPlanId,
    workflowPlanDigest: `sha256:${"4".repeat(64)}`,
    adapterId: "openai-codex",
    agentId: "codex",
    modelId: "gpt-5.6-codex",
    selectionDigest: `sha256:${"5".repeat(64)}`,
    strategy: "sequential",
    stepIds: [workflowStepId],
    contextPackCount: 1,
    readScopeCount: 2,
    gates: [
      {
        key: "charter:required-evidence",
        phase: "charter-evidence",
        criteria: requiredEvidence,
        criteriaDigest: canonicalDigest(requiredEvidence),
      },
      {
        key: "charter:stop-conditions",
        phase: "charter-stop-conditions",
        criteria: stopConditions,
        criteriaDigest: canonicalDigest(stopConditions),
      },
      stepGate("preconditions", "Confirmed Product context is available"),
      stepGate("outputs", "Return metadata-only observations"),
      stepGate("evidence", "Record bounded event evidence"),
      stepGate("stop-conditions", "Stop before any write or Tool request"),
    ],
    authorityBoundary: "managed-readonly-preview-does-not-grant-execution-or-effect-authority",
  }
  return { ...body, previewDigest: canonicalDigest(body) }
}

function managedReadOnlyReceipt() {
  return {
    schemaVersion: 1,
    kind: "managed-readonly-receipt",
    previewDigest,
    runId: managedGovernedRunId,
    managedRunId,
    productId,
    initiativeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    adapterId: "openai-codex",
    agentId: "codex",
    modelId: "gpt-5.6-codex",
    mode: "manual-offline",
    state: "completed",
    providerDisposition: "completed",
    outcomeStatus: "satisfied",
    outcomeBasis: "deterministic-offline-runtime",
    eventCount: 4,
    completedStepCount: 1,
    totalStepCount: 1,
    resultDigest: `sha256:${"e".repeat(64)}`,
    evidenceDigest: `sha256:${"f".repeat(64)}`,
    warnings: [],
    startedAt: "2026-07-24T08:20:00.000Z",
    endedAt: "2026-07-24T08:20:01.000Z",
    authorityBoundary: "managed-readonly-receipt-does-not-grant-tool-write-effect-or-outcome-authority",
  }
}

function listManagedEvidence(id, params) {
  if (!exactKeys(params, params.snapshotDigest === undefined ? ["offset", "limit"] : ["offset", "limit", "snapshotDigest"]) ||
    ![0, 1].includes(params.offset) || params.limit !== 100 ||
    (params.offset > 0 && params.snapshotDigest === undefined) ||
    (params.snapshotDigest !== undefined && params.snapshotDigest !== `sha256:${"6".repeat(64)}`)) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE MANAGED EVIDENCE LIST PARAMS")
  }
  const value = managedRunPage(params.offset)
  if (workspacePath.endsWith("bad-managed-evidence-page")) value.items[0].localStagePath = `${privateRoot}/${privateCredential}`
  if (workspacePath.endsWith("bad-managed-evidence-count")) value.omittedCount = 0
  if (workspacePath.endsWith("bad-managed-evidence-snapshot")) value.snapshotDigest = `sha256:${"7".repeat(64)}`
  if (workspacePath.endsWith("bad-managed-evidence-total") && params.offset === 1) {
    value.total = 4
    value.omittedCount = value.total - value.items.length
    value.hasMore = true
  }
  return writeResult(id, value)
}

function readManagedEvidence(id, params) {
  if (!exactKeys(params, ["managedRunId"]) || params.managedRunId !== managedRunId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE MANAGED EVIDENCE READ PARAMS")
  }
  const value = managedEvidenceDetail()
  if (workspacePath.endsWith("bad-managed-evidence-detail")) value.rawProviderOutput = `${privateRoot}/${privateCredential}`
  if (workspacePath.endsWith("bad-managed-evidence-binding")) value.evidence.evidenceDigest = `sha256:${"0".repeat(64)}`
  return writeResult(id, value)
}

function managedRunSummary() {
  return {
    schemaVersion: 1,
    kind: "managed-run-summary",
    managedRunId,
    runId: managedGovernedRunId,
    productId,
    initiativeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    mode: "manual-offline",
    state: "completed",
    adapterId: "openai-codex",
    agentId: "codex",
    modelId: "gpt-5.6-codex",
    attemptNumber: 1,
    recoveryStatus: "not-required",
    workflowCheckpointCount: 0,
    hasResult: true,
    hasApplyDecision: false,
    bindingsDigest: `sha256:${"8".repeat(64)}`,
    resultDigest: `sha256:${"9".repeat(64)}`,
    createdAt: "2026-07-24T08:19:59.000Z",
    startedAt: "2026-07-24T08:20:00.000Z",
    updatedAt: "2026-07-24T08:20:01.000Z",
    endedAt: "2026-07-24T08:20:01.000Z",
    authorityBoundary: "managed-run-inventory-is-read-only-and-does-not-grant-run-effect-apply-approval-or-outcome-authority",
  }
}

function managedRunPage(offset = 0) {
  const items = offset === 0
    ? [managedRunSummary()]
    : [
        { ...managedRunSummary(), managedRunId: "17171717-1717-4717-8717-171717171717", runId: "18181818-1818-4818-8818-181818181818" },
        { ...managedRunSummary(), managedRunId: "19191919-1919-4919-8919-191919191919", runId: "20202020-2020-4020-8020-202020202020" },
      ]
  return {
    schemaVersion: 1,
    kind: "managed-run-summary-page",
    items,
    offset,
    limit: 100,
    total: 3,
    omittedCount: 3 - items.length,
    snapshotDigest: `sha256:${"6".repeat(64)}`,
    hasMore: offset + items.length < 3,
    authorityBoundary: "managed-run-inventory-is-read-only-and-does-not-grant-run-effect-apply-approval-or-outcome-authority",
    privacyBoundary: "Portable identifiers, states, counts, digests, warning codes and timestamps only; prompts, provider output, source bytes, changed paths, executable paths, process state and credentials are omitted.",
  }
}

function managedEvidenceDetail() {
  return {
    schemaVersion: 1,
    kind: "managed-evidence-detail",
    summary: managedRunSummary(),
    artifactStatus: "verified-result-and-evidence",
    result: {
      resultId: managedResultId,
      resultDigest: `sha256:${"9".repeat(64)}`,
      providerDisposition: "completed",
      terminationCause: "normal",
      outcomeStatus: "satisfied",
      outcomeBasis: "deterministic-offline-runtime",
      terminalState: "completed",
      evidenceId: managedEvidenceId,
      evidenceDigest: `sha256:${"a".repeat(64)}`,
      warningCodes: [],
      startedAt: "2026-07-24T08:20:00.000Z",
      endedAt: "2026-07-24T08:20:01.000Z",
    },
    evidence: {
      evidenceId: managedEvidenceId,
      evidenceDigest: `sha256:${"a".repeat(64)}`,
      eventCount: 4,
      eventTypeCounts: { lifecycle: 2, output: 1, item: 1, approval: 0, warning: 0, error: 0 },
      eventsDigest: `sha256:${"b".repeat(64)}`,
      workflowStrategy: "sequential",
      workflowStepCount: 1,
      workflowAttemptCount: 1,
      completedStepCount: 1,
      charterEvidenceStatus: "satisfied",
      charterStopStatus: "satisfied",
      terminalReasonCode: "workflow-completed",
      actualEffectCounts: { "not-observed": 1, "observed-provisional": 0, applied: 0, blocked: 0, unknown: 0 },
      capturedAt: "2026-07-24T08:20:01.000Z",
    },
    authorityBoundary: "managed-evidence-detail-is-verified-read-only-evidence-and-does-not-grant-apply-approval-or-outcome-authority",
    privacyBoundary: "Portable identifiers, states, counts, digests, warning codes and timestamps only; prompts, provider output, source bytes, changed paths, executable paths, process state and credentials are omitted.",
  }
}

function readManagedReview(id, params) {
  if (!exactKeys(params, ["managedRunId"]) || params.managedRunId !== stagedManagedRunId) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE MANAGED REVIEW READ PARAMS")
  }
  const value = managedReviewPreview()
  if (workspacePath.endsWith("bad-managed-review-digest")) value.previewDigest = `sha256:${"0".repeat(64)}`
  if (workspacePath.endsWith("bad-managed-review-private")) value.sourceRoot = `${privateRoot}/${privateCredential}`
  if (workspacePath.endsWith("bad-managed-review-binding")) {
    value.applyConfirmation.reviewEvidenceId = managedEvidenceId
    value.previewDigest = digestWithout(value, "previewDigest")
  }
  if (workspacePath.endsWith("bad-managed-review-path")) {
    value.staging.changedInventory[0].path = `${privateRoot}/secret.ts`
    value.staging.changedInventoryDigest = canonicalDigest(value.staging.changedInventory)
    value.applyConfirmation.changedInventoryDigest = value.staging.changedInventoryDigest
    value.previewDigest = digestWithout(value, "previewDigest")
  }
  return writeResult(id, value)
}

function decideManagedReview(id, params, decision) {
  const preview = managedReviewPreview()
  if (!exactKeys(params, [
    "actorId", "managedRunId", "expectedManagedRunRevision", "expectedPreviewDigest", "confirmation",
  ]) || params.actorId !== "founder.kiro-review" || params.managedRunId !== stagedManagedRunId ||
    params.expectedManagedRunRevision !== preview.managedRunRevision || params.expectedPreviewDigest !== preview.previewDigest ||
    params.confirmation !== decision) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE MANAGED REVIEW DECISION PARAMS")
  }
  if (workspacePath.endsWith("stale-managed-review")) {
    return writeError(id, -32_029, "MANAGED_REVIEW_CHANGED", `${privateRoot}; token=${privateCredential}`)
  }
  const value = managedReviewTransition(decision)
  if (workspacePath.endsWith("bad-managed-transition-digest")) value.transitionDigest = `sha256:${"0".repeat(64)}`
  if (workspacePath.endsWith("bad-managed-transition-private")) value.localJournalPath = `${privateRoot}/${privateCredential}`
  return writeResult(id, value)
}

function managedReviewPreview() {
  const changedInventory = [
    {
      path: "src/new.ts",
      kind: "added",
      afterDigest: `sha256:${"1".repeat(64)}`,
      afterSize: 24,
      afterMode: 0o644,
    },
    {
      path: "src/review.ts",
      kind: "modified",
      beforeDigest: `sha256:${"2".repeat(64)}`,
      afterDigest: `sha256:${"3".repeat(64)}`,
      beforeSize: 80,
      afterSize: 96,
      beforeMode: 0o644,
      afterMode: 0o644,
    },
  ]
  const changedInventoryDigest = canonicalDigest(changedInventory)
  const writeEnvelope = ["src"]
  const body = {
    schemaVersion: 1,
    kind: "managed-review-preview",
    managedRunId: stagedManagedRunId,
    managedRunRevision: 3,
    runId: managedGovernedRunId,
    productId,
    initiativeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    mode: "codex-staged",
    state: "review-required",
    canApply: true,
    canDiscard: true,
    hasLocalJournal: false,
    bindingsDigest: `sha256:${"4".repeat(64)}`,
    result: {
      resultId: stagedResultId,
      resultDigest: `sha256:${"5".repeat(64)}`,
      terminalState: "review-required",
      providerDisposition: "completed",
      outcomeStatus: "not-assessed",
      outcomeBasis: "not-evaluated",
      warningCodes: ["provider-output-redacted", "staging-read-confinement-unattested"],
      evidenceId: stagedEvidenceId,
      evidenceDigest: `sha256:${"6".repeat(64)}`,
    },
    staging: {
      evidenceId: stagedEvidenceId,
      evidenceDigest: `sha256:${"6".repeat(64)}`,
      baselineDigest: `sha256:${"7".repeat(64)}`,
      finalDigest: `sha256:${"8".repeat(64)}`,
      applyState: "pending",
      changeCount: changedInventory.length,
      changedInventoryLimit: 512,
      omittedCount: 0,
      changedInventory,
      changedInventoryDigest,
      excludedPathCount: 0,
      excludedPathSetDigest: canonicalDigest([]),
    },
    applyConfirmation: {
      decision: "apply-exact-reviewed-inventory",
      reviewEvidenceId: stagedEvidenceId,
      reviewEvidenceDigest: `sha256:${"6".repeat(64)}`,
      changedInventoryDigest,
      writeEnvelope,
      writeEnvelopeDigest: canonicalDigest(writeEnvelope),
    },
    postApplyGatePolicy: "record-not-assessed",
    authorityBoundary: "managed-review-preview-authorizes-no-mutation-without-an-exact-digest-bound-human-decision",
    privacyBoundary: "Exact portable identifiers, digests, warning codes, workspace-relative changed paths, file digests, sizes, modes and write scopes only; prompts, provider output, source bytes, absolute paths, executable paths, process state and credentials are omitted.",
    cleanupBoundary: "Persisted discard or apply state does not independently prove machine-local stage or recovery-journal cleanup.",
  }
  return { ...body, previewDigest: canonicalDigest(body) }
}

function managedReviewTransition(decision) {
  const preview = managedReviewPreview()
  const state = decision === "apply-exact-managed-review" ? "failed" : "discarded"
  const detail = transitionedManagedEvidenceDetail(state, decision === "apply-exact-managed-review")
  const body = {
    schemaVersion: 1,
    kind: "managed-review-transition",
    decision,
    sourcePreviewDigest: preview.previewDigest,
    sourceManagedRunRevision: preview.managedRunRevision,
    managedRunId: stagedManagedRunId,
    managedRunRevision: 4,
    state,
    canApply: false,
    canDiscard: false,
    hasLocalJournal: decision === "apply-exact-managed-review",
    detail,
    authorityBoundary: "managed-review-transition-proves-persisted-state-not-provider-outcome-or-machine-local-cleanup",
    cleanupBoundary: "Persisted discard or apply state does not independently prove machine-local stage or recovery-journal cleanup.",
  }
  return { ...body, transitionDigest: canonicalDigest(body) }
}

function transitionedManagedEvidenceDetail(state, applied) {
  const resultDigest = `sha256:${"9".repeat(64)}`
  const evidenceDigest = `sha256:${"a".repeat(64)}`
  const applyDecisionDigest = `sha256:${"b".repeat(64)}`
  const summary = {
    schemaVersion: 1,
    kind: "managed-run-summary",
    managedRunId: stagedManagedRunId,
    runId: managedGovernedRunId,
    productId,
    initiativeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    mode: "codex-staged",
    state,
    adapterId: "openai-codex",
    agentId: "codex",
    modelId: "gpt-5.6-codex",
    attemptNumber: 1,
    recoveryStatus: "recovered",
    workflowCheckpointCount: 0,
    hasResult: true,
    hasApplyDecision: applied,
    bindingsDigest: `sha256:${"4".repeat(64)}`,
    resultDigest,
    ...(applied ? { applyDecisionDigest } : {}),
    createdAt: "2026-07-24T08:29:59.000Z",
    startedAt: "2026-07-24T08:30:00.000Z",
    updatedAt: "2026-07-24T08:30:02.000Z",
    endedAt: "2026-07-24T08:30:02.000Z",
    authorityBoundary: "managed-run-inventory-is-read-only-and-does-not-grant-run-effect-apply-approval-or-outcome-authority",
  }
  return {
    schemaVersion: 1,
    kind: "managed-evidence-detail",
    summary,
    artifactStatus: "verified-result-and-evidence",
    result: {
      resultId: transitionedResultId,
      resultDigest,
      providerDisposition: "completed",
      terminationCause: "normal",
      outcomeStatus: "failed",
      outcomeBasis: "not-evaluated",
      terminalState: state,
      evidenceId: transitionedEvidenceId,
      evidenceDigest,
      warningCodes: ["provider-output-redacted", ...(state === "discarded" ? ["local-cleanup-pending"] : [])],
      startedAt: "2026-07-24T08:30:00.000Z",
      endedAt: "2026-07-24T08:30:02.000Z",
    },
    evidence: {
      evidenceId: transitionedEvidenceId,
      evidenceDigest,
      eventCount: 2,
      eventTypeCounts: { lifecycle: 1, output: 1, item: 0, approval: 0, warning: 0, error: 0 },
      eventsDigest: `sha256:${"c".repeat(64)}`,
      workflowStrategy: "sequential",
      workflowStepCount: 1,
      workflowAttemptCount: 1,
      completedStepCount: 0,
      charterEvidenceStatus: "not-assessed",
      charterStopStatus: "not-assessed",
      terminalReasonCode: applied ? "workflow-output-gate-failed" : "staged-review-discarded",
      staging: {
        changeCount: 2,
        excludedPathCount: 0,
        applyState: applied ? "applied" : "discarded",
        baselineDigest: `sha256:${"7".repeat(64)}`,
        finalDigest: `sha256:${"8".repeat(64)}`,
        changedInventoryDigest: previewChangedInventoryDigest(),
        excludedPathSetDigest: canonicalDigest([]),
      },
      actualEffectCounts: { "not-observed": 0, "observed-provisional": 0, applied: applied ? 1 : 0, blocked: applied ? 0 : 1, unknown: 0 },
      capturedAt: "2026-07-24T08:30:02.000Z",
    },
    ...(applied ? {
      applyDecision: {
        receiptId: applyDecisionId,
        receiptDigest: applyDecisionDigest,
        managedRunRevision: 3,
        changedInventoryCount: 2,
        writeEnvelopeCount: 1,
        changedInventoryDigest: previewChangedInventoryDigest(),
        writeEnvelopeDigest: canonicalDigest(["src"]),
        decidedAt: "2026-07-24T08:30:01.000Z",
      },
    } : {}),
    authorityBoundary: "managed-evidence-detail-is-verified-read-only-evidence-and-does-not-grant-apply-approval-or-outcome-authority",
    privacyBoundary: "Portable identifiers, states, counts, digests, warning codes and timestamps only; prompts, provider output, source bytes, changed paths, executable paths, process state and credentials are omitted.",
  }
}

function previewChangedInventoryDigest() {
  return managedReviewPreview().staging.changedInventoryDigest
}

function digestWithout(value, key) {
  return canonicalDigest(Object.fromEntries(Object.entries(value).filter(([name]) => name !== key)))
}

function canonicalDigest(value) {
  const normalize = (entry) => {
    if (Array.isArray(entry)) return entry.map(normalize)
    if (entry !== null && typeof entry === "object") {
      return Object.fromEntries(
        Object.entries(entry).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, normalize(child)]),
      )
    }
    return entry
  }
  return `sha256:${createHash("sha256").update(JSON.stringify(normalize(value))).digest("hex")}`
}

function importSnapshot(id, params) {
  if (!exactKeys(params, ["bundleRoot", "expectedProductId", "expectedProductRevision", "actorId"]) ||
    params.expectedProductId !== productId || params.expectedProductRevision !== 7 ||
    params.actorId !== "founder.kiro-review") {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE IMPORT PARAMS")
  }
  if (params.bundleRoot.endsWith("source-error")) {
    return writeError(
      id,
      -32_030,
      "PORTABLE_DESIGN_SOURCE_INVALID",
      `Malformed bundle at ${privateRoot}; password=${privateCredential}`,
    )
  }
  return writeResult(id, snapshot())
}

function listSnapshots(id, params) {
  if (!exactKeys(params, ["offset", "limit"])) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE LIST PARAMS")
  }
  const items = params.offset === 9_999 ? Array.from({ length: 201 }, () => snapshot()) : [snapshot()]
  return writeResult(id, {
    items,
    offset: params.offset,
    limit: params.limit,
    total: params.offset === 9_999 ? 10_200 : 1,
    hasMore: params.offset === 9_999,
    governanceBoundary: "Every item remains pending human review; source review is an upstream claim only.",
    privacyBoundary: "Items contain validated metadata and digests only; local paths and source content are omitted.",
  })
}

function readSnapshot(id, params) {
  if (!exactKeys(params, ["bundleId"])) {
    return writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE READ PARAMS")
  }
  switch (params.bundleId) {
    case "33333333-3333-4333-8333-333333333333":
      return writeError(id, -32_035, "PORTABLE_DESIGN_NOT_FOUND", `Missing ${privateRoot}; token=${privateCredential}`)
    case "44444444-4444-4444-8444-444444444444":
      process.stdout.write(`{"jsonrpc":"2.0","id":${id},"id":${id},"result":{}}\n`)
      return
    case "55555555-5555-4555-8555-555555555555":
      process.stdout.write(Buffer.from([0xc3, 0x28, 0x0a]))
      return
    case "66666666-6666-4666-8666-666666666666":
      process.stdout.write(`{"jsonrpc":"2.0","id":${id},"result":{"padding":"${"x".repeat(1024 * 1024 + 1)}"}}\n`)
      return
    case "77777777-7777-4777-8777-777777777777": {
      const value = snapshot(params.bundleId)
      value.bundleRoot = `${privateRoot}/${privateCredential}`
      return writeResult(id, value)
    }
    case "88888888-8888-4888-8888-888888888888": {
      const value = snapshot(params.bundleId)
      value.governance.state = "approved"
      return writeResult(id, value)
    }
    case "99999999-9999-4999-8999-999999999999":
      return writeError(id, -32_030, "PORTABLE_DESIGN_NOT_FOUND", `Wrong code ${privateRoot} ${privateCredential}`)
    default:
      return writeResult(id, snapshot(params.bundleId))
  }
}

function snapshot(id = bundleId) {
  return {
    schemaVersion: 1,
    kind: "portable-design-snapshot-summary",
    bundleId: id,
    productId,
    initiativeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    title: "Imported Product Design",
    classification: "confidential",
    governance: {
      state: "pending-human-review",
      humanReviewRequired: true,
      claimBoundary: "import-validation-is-not-design-approval-or-baseline",
      nonEscalation: "not-gaep-approval-design-baseline-implementation-or-release-readiness",
    },
    sourceReview: {
      status: "approved",
      claimLabel: "approved upstream claim; not GAEP approval, a Design Baseline, implementation readiness, or release readiness",
      gaepApproval: false,
    },
    source: { tool: "figma", exportMethod: "manual-export" },
    counts: { artifacts: 2, normalizedDesignTokens: 1, validationChecks: 6, recordedLimitations: 5 },
    digests: {
      snapshot: `sha256:${"a".repeat(64)}`,
      evidence: `sha256:${"b".repeat(64)}`,
      manifest: `sha256:${"c".repeat(64)}`,
      artifactInventory: `sha256:${"d".repeat(64)}`,
    },
    timestamps: {
      sourceExportedAt: "2026-07-24T00:00:00.000Z",
      importedAt: "2026-07-24T00:01:00.000Z",
    },
    privacyBoundary: "Validated metadata only; no bundle root, artifact path, token value, source bytes, credentials, OAuth state, or external-account state.",
  }
}

function readinessSnapshots(includePrivatePath) {
  const codex = {
    schemaVersion: 1,
    adapterId: "openai-codex",
    adapterVersion: "0.1.0",
    agentId: "codex",
    agentLabel: "OpenAI Codex",
    runtimeVersion: "0.42.0",
    detected: true,
    executionInterface: "cli-jsonl",
    interfaceMaturity: "beta",
    supportsResume: true,
    supportsCancel: true,
    supportsCheckpoints: true,
    supportsModelDiscovery: true,
    supportsToolSelection: true,
    settings: [{
      key: "reasoningEffort",
      label: "Reasoning effort",
      description: "Provider-declared reasoning effort for a future governed run.",
      kind: "select",
      required: false,
      sensitive: false,
      options: [{ value: "high", label: "High" }],
      truthClass: "provider-declared",
    }],
    models: [{
      id: "gpt-5.6-codex",
      label: "GPT-5.6 Codex",
      description: "Observed local Codex model metadata.",
      reasoningOptions: ["high"],
      contextWindow: 200000,
      inputModalities: ["text", "image"],
      truthClass: "observed",
      alias: false,
    }],
    limitations: ["Capability observation does not authorize execution."],
    observedAt: "2026-07-24T08:00:00.000Z",
  }
  if (includePrivatePath) codex.runtimeExecutable = `${privateRoot}/${privateCredential}`
  return [codex, {
    schemaVersion: 1,
    adapterId: "anthropic-claude-code",
    adapterVersion: "0.1.0",
    agentId: "claude-code",
    agentLabel: "Anthropic Claude Code",
    detected: false,
    executionInterface: "unavailable",
    interfaceMaturity: "unknown",
    supportsResume: false,
    supportsCancel: false,
    supportsCheckpoints: false,
    supportsModelDiscovery: false,
    supportsToolSelection: false,
    settings: [],
    models: [],
    limitations: ["The local Claude Code runtime was not observed."],
    observedAt: "2026-07-24T08:00:00.000Z",
  }]
}

function writeResult(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`)
}

function writeError(id, code, kind, rawMessage) {
  process.stdout.write(`${JSON.stringify({
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message: rawMessage,
      data: { kind, detail: { bundleRoot: privateRoot, credential: privateCredential } },
    },
  })}\n`)
}

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const keys = Object.keys(value)
  return keys.length === expected.length && keys.every((key) => expected.includes(key))
}
