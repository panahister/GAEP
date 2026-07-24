import { canonicalDigest, capabilityDigest } from "@gaep/agent-sdk"
import {
  adapterCapabilitiesSchema,
  agentModelDashboardContentSchema,
  agentModelDashboardRequestSchema,
  agentModelDashboardSchema,
  agentSelectionStateSchema,
  handoffSchema,
  managedRunEvidenceSchema,
  managedRunRecordSchema,
  managedRunResultSchema,
  productSchema,
  runSchema,
  type AdapterCapabilities,
  type AgentModelDashboard,
  type AgentModelDashboardRequest,
  type AgentSelection,
  type AgentSelectionState,
  type Handoff,
  type ManagedRunEvidence,
  type ManagedRunRecord,
  type ManagedRunResult,
  type Product,
  type Run,
} from "@gaep/contracts"

export class AgentModelProductBindingError extends Error {
  constructor() {
    super("The requested Agent/Model dashboard Product binding is not current")
    this.name = "AgentModelProductBindingError"
  }
}

export class AgentModelCapabilityBindingError extends Error {
  constructor() {
    super("The requested Agent/Model dashboard capability bindings are not current")
    this.name = "AgentModelCapabilityBindingError"
  }
}

export class AgentModelSelectionBindingError extends Error {
  constructor() {
    super("The requested Agent/Model dashboard selection binding is not current")
    this.name = "AgentModelSelectionBindingError"
  }
}

export interface AgentModelManagedObservation {
  record: ManagedRunRecord
  result?: ManagedRunResult
  evidence?: ManagedRunEvidence
}

export interface AgentModelDashboardSources {
  product: Product
  capabilities: AdapterCapabilities[]
  selection: AgentSelectionState
  runs: Run[]
  handoffs: Handoff[]
  managedRuns: AgentModelManagedObservation[]
  managedRunTotal: number
}

const LIMITS = {
  capabilities: 16,
  runs: 256,
  handoffs: 256,
  capabilityLimitations: 64,
} as const

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function bounded<T>(values: T[], maximum: number) {
  const projected = values.slice(0, maximum)
  return {
    values: projected,
    limit: { shown: projected.length, total: values.length, omitted: values.length - projected.length },
  }
}

function selectionValue(state: AgentSelectionState): AgentSelection | undefined {
  if (state.status === "selected") return state.selection
  if (state.status === "migration-required") return state.portableCandidate
  return undefined
}

function assertExpectedSelection(actual: AgentSelectionState, expected: AgentModelDashboardRequest["expectedSelection"]): void {
  if (actual.status !== expected.status) throw new AgentModelSelectionBindingError()
  if (actual.status === "selected" && expected.status === "selected" &&
      canonicalDigest(actual.selection) !== expected.selectionDigest) throw new AgentModelSelectionBindingError()
  if (actual.status === "migration-required" && expected.status === "migration-required" &&
      canonicalDigest(actual.portableCandidate) !== expected.selectionDigest) throw new AgentModelSelectionBindingError()
}

function exactCapabilities(capabilities: AdapterCapabilities[]) {
  return capabilities.map((entry) => ({
    adapterId: entry.adapterId,
    agentId: entry.agentId,
    capabilityDigest: capabilityDigest(entry),
  })).sort((left, right) => compare(`${left.adapterId}:${left.agentId}`, `${right.adapterId}:${right.agentId}`))
}

function runReference(run: Run) {
  return {
    recordType: "run" as const,
    recordId: run.id,
    revision: run.revision ?? 1,
    digest: canonicalDigest(run),
  }
}

function projectSelection(state: AgentSelectionState, capabilities: AdapterCapabilities[]) {
  if (state.status === "unselected" || state.status === "invalid") return { status: state.status }
  const selection = selectionValue(state)!
  if (state.status === "migration-required") {
    return {
      status: "migration-required" as const,
      selectionDigest: canonicalDigest(selection),
      adapterId: selection.adapterId,
      agentId: selection.agentId,
      modelId: selection.modelId,
      modelTruthClass: selection.modelTruthClass,
      modelAlias: selection.modelAlias,
      settings: selection.settings,
      selectedAt: selection.selectedAt,
      capabilityDigest: selection.capabilityDigest,
      capabilityState: "migration-required" as const,
    }
  }
  const capability = capabilities.find((entry) =>
    entry.adapterId === selection.adapterId && entry.agentId === selection.agentId)
  return {
    status: "selected" as const,
    selectionDigest: canonicalDigest(selection),
    adapterId: selection.adapterId,
    agentId: selection.agentId,
    modelId: selection.modelId,
    modelTruthClass: selection.modelTruthClass,
    modelAlias: selection.modelAlias,
    settings: selection.settings,
    selectedAt: selection.selectedAt,
    capabilityDigest: selection.capabilityDigest,
    capabilityState: capability && capabilityDigest(capability) === selection.capabilityDigest
      ? "current" as const
      : "stale" as const,
  }
}

function validateManagedObservation(
  value: AgentModelManagedObservation,
  product: Product,
  runIds: Set<string>,
): AgentModelManagedObservation {
  const record = managedRunRecordSchema.parse(value.record)
  const result = value.result ? managedRunResultSchema.parse(value.result) : undefined
  const evidence = value.evidence ? managedRunEvidenceSchema.parse(value.evidence) : undefined
  const runSnapshot = record.bindingSnapshots.run
  const initiativeSnapshot = record.bindingSnapshots.initiative
  if (record.productId.toLowerCase() !== product.id.toLowerCase() || !runIds.has(record.runId.toLowerCase()) ||
      record.bindingsDigest !== canonicalDigest(record.bindings) ||
      record.bindings.product.recordType !== "product" ||
      record.bindings.product.recordId.toLowerCase() !== product.id.toLowerCase() ||
      record.bindings.product.revision !== (product.revision ?? 1) ||
      record.bindings.product.digest !== canonicalDigest(product) ||
      record.bindings.initiative.recordId !== initiativeSnapshot.id ||
      record.bindings.initiative.revision !== (initiativeSnapshot.revision ?? 1) ||
      record.bindings.initiative.digest !== canonicalDigest(initiativeSnapshot) ||
      record.bindings.run.recordId !== runSnapshot.id ||
      record.bindings.run.revision !== (runSnapshot.revision ?? 1) ||
      record.bindings.run.digest !== canonicalDigest(runSnapshot) ||
      record.bindings.agentSelectionDigest !== canonicalDigest(runSnapshot.agent) ||
      record.provider.adapterId !== runSnapshot.agent.adapterId ||
      record.provider.agentId !== runSnapshot.agent.agentId ||
      record.provider.modelId !== runSnapshot.agent.modelId ||
      record.provider.capabilityDigest !== runSnapshot.agent.capabilityDigest) {
    throw new AgentModelProductBindingError()
  }
  if (record.resultId) {
    if (!result || !evidence || record.resultId !== result.id || record.resultDigest !== canonicalDigest(result) ||
        result.managedRunId !== record.id || result.runId !== record.runId || result.productId !== record.productId ||
        result.mode !== record.mode || canonicalDigest(result.provider) !== canonicalDigest(record.provider) ||
        result.evidenceId !== evidence.id || result.evidenceDigest !== canonicalDigest(evidence) ||
        evidence.managedRunId !== record.id || evidence.runId !== record.runId || evidence.productId !== record.productId ||
        evidence.bindingsDigest !== record.bindingsDigest || evidence.eventsDigest !== canonicalDigest(evidence.events)) {
      throw new Error("Managed Run result and evidence bindings are incomplete or stale")
    }
  } else if (result || evidence) {
    throw new Error("Unbound Managed Run result or evidence was supplied")
  }
  return { record, result, evidence }
}

function projectManaged(observation: AgentModelManagedObservation | undefined) {
  if (!observation) return { status: "not-observed-in-bounded-window" as const }
  const { record, result, evidence } = observation
  return {
    status: "observed" as const,
    record: {
      recordType: "managed-run" as const,
      recordId: record.id,
      revision: record.revision,
      digest: canonicalDigest(record),
    },
    mode: record.mode,
    state: record.state,
    attemptNumber: record.attemptNumber,
    bindingsDigest: record.bindingsDigest,
    provider: {
      adapterId: record.provider.adapterId,
      agentId: record.provider.agentId,
      modelId: record.provider.modelId,
      capabilityDigest: record.provider.capabilityDigest,
    },
    result: result && evidence ? {
      status: "bound" as const,
      recordId: result.id,
      digest: canonicalDigest(result),
      providerDisposition: result.providerDisposition,
      outcomeStatus: result.outcome.status,
      evidence: {
        recordId: evidence.id,
        digest: canonicalDigest(evidence),
        eventCount: evidence.events.length,
        eventsDigest: evidence.eventsDigest,
        actualEffectCount: evidence.actualEffects.length,
        capturedAt: evidence.capturedAt,
      },
    } : { status: "not-bound" as const },
  }
}

export function composeAgentModelDashboard(
  sourceValues: AgentModelDashboardSources,
  requestValue: AgentModelDashboardRequest,
  observedAt = new Date().toISOString(),
): AgentModelDashboard {
  const request = agentModelDashboardRequestSchema.parse(requestValue)
  const product = productSchema.parse(sourceValues.product)
  const capabilities = sourceValues.capabilities.map((entry) => adapterCapabilitiesSchema.parse(entry))
  const selection = agentSelectionStateSchema.parse(sourceValues.selection)
  const runs = sourceValues.runs.map((entry) => runSchema.parse(entry))
  const handoffs = sourceValues.handoffs.map((entry) => handoffSchema.parse(entry))
  const productRevision = product.revision ?? 1
  const productDigest = canonicalDigest(product)
  if (request.expectedProductId.toLowerCase() !== product.id.toLowerCase() ||
      request.expectedProductRevision !== productRevision || request.expectedProductDigest !== productDigest) {
    throw new AgentModelProductBindingError()
  }
  const actualCapabilities = exactCapabilities(capabilities)
  const expectedCapabilities = [...request.expectedCapabilities]
    .sort((left, right) => compare(`${left.adapterId}:${left.agentId}`, `${right.adapterId}:${right.agentId}`))
  if (canonicalDigest(actualCapabilities) !== canonicalDigest(expectedCapabilities)) {
    throw new AgentModelCapabilityBindingError()
  }
  assertExpectedSelection(selection, request.expectedSelection)
  if (runs.some((entry) => entry.productId.toLowerCase() !== product.id.toLowerCase()) ||
      handoffs.some((entry) => entry.productId.toLowerCase() !== product.id.toLowerCase())) {
    throw new AgentModelProductBindingError()
  }
  if (!Number.isSafeInteger(sourceValues.managedRunTotal) || sourceValues.managedRunTotal < sourceValues.managedRuns.length) {
    throw new Error("Managed Run observation total is invalid")
  }
  const runById = new Map(runs.map((entry) => [entry.id.toLowerCase(), entry]))
  if (runById.size !== runs.length) throw new Error("Run sources must be unique")
  const managedRuns = sourceValues.managedRuns.map((entry) =>
    validateManagedObservation(entry, product, new Set(runById.keys())))
  if (new Set(managedRuns.map((entry) => entry.record.id)).size !== managedRuns.length) {
    throw new Error("Managed Run observations must be unique")
  }
  const latestManagedByRun = new Map<string, AgentModelManagedObservation>()
  for (const entry of managedRuns) {
    const key = entry.record.runId.toLowerCase()
    const current = latestManagedByRun.get(key)
    if (!current || entry.record.attemptNumber > current.record.attemptNumber ||
        (entry.record.attemptNumber === current.record.attemptNumber && entry.record.updatedAt > current.record.updatedAt)) {
      latestManagedByRun.set(key, entry)
    }
  }

  const selected = selection.status === "selected" ? selection.selection : undefined
  const capabilityRows = capabilities.map((entry) => {
    const limitationValues = entry.limitations.slice(0, LIMITS.capabilityLimitations)
    return {
      adapterId: entry.adapterId,
      adapterVersion: entry.adapterVersion,
      agentId: entry.agentId,
      agentLabel: entry.agentLabel,
      runtimeVersion: entry.runtimeVersion ?? null,
      capabilityDigest: capabilityDigest(entry),
      detected: entry.detected,
      executionInterface: entry.executionInterface,
      interfaceMaturity: entry.interfaceMaturity,
      support: {
        resume: entry.supportsResume,
        cancel: entry.supportsCancel,
        checkpoints: entry.supportsCheckpoints,
        modelDiscovery: entry.supportsModelDiscovery,
        toolSelection: entry.supportsToolSelection,
      },
      modelCount: entry.models.length,
      limitations: {
        values: limitationValues,
        shown: limitationValues.length,
        total: entry.limitations.length,
        omitted: entry.limitations.length - limitationValues.length,
      },
      observedAt: entry.observedAt,
      selected: selected?.adapterId === entry.adapterId && selected.agentId === entry.agentId,
    }
  }).sort((left, right) => compare(`${left.adapterId}:${left.agentId}`, `${right.adapterId}:${right.agentId}`))
  const boundedCapabilities = bounded(capabilityRows, LIMITS.capabilities)

  const runRows = runs.map((run) => ({
    record: runReference(run),
    initiativeId: run.initiativeId,
    state: run.state,
    agent: {
      adapterId: run.agent.adapterId,
      agentId: run.agent.agentId,
      modelId: run.agent.modelId,
      selectionDigest: canonicalDigest(run.agent),
    },
    startedAt: run.startedAt ?? null,
    endedAt: run.endedAt ?? null,
    managed: projectManaged(latestManagedByRun.get(run.id.toLowerCase())),
  })).sort((left, right) => compare(
    `${right.endedAt ?? right.startedAt ?? ""}:${right.record.recordId}`,
    `${left.endedAt ?? left.startedAt ?? ""}:${left.record.recordId}`,
  ))
  const boundedRuns = bounded(runRows, LIMITS.runs)

  const handoffRows = handoffs.map((handoff) => {
    const fromRun = runById.get(handoff.fromRunId.toLowerCase())
    if (!fromRun || handoff.initiativeId.toLowerCase() !== fromRun.initiativeId.toLowerCase()) {
      throw new Error("Handoff source Run is unavailable or rebound")
    }
    return {
      record: { recordType: "handoff" as const, recordId: handoff.id, revision: 1 as const, digest: canonicalDigest(handoff) },
      fromRun: runReference(fromRun),
      toSelection: {
        adapterId: handoff.toAgent.adapterId,
        agentId: handoff.toAgent.agentId,
        modelId: handoff.toAgent.modelId,
        selectionDigest: canonicalDigest(handoff.toAgent),
      },
      state: handoff.acknowledgedAt ? "acknowledged" as const : "pending-acknowledgement" as const,
      createdAt: handoff.createdAt,
      acknowledgedAt: handoff.acknowledgedAt ?? null,
    }
  }).sort((left, right) => compare(
    `${right.createdAt}:${right.record.recordId}`,
    `${left.createdAt}:${left.record.recordId}`,
  ))
  const boundedHandoffs = bounded(handoffRows, LIMITS.handoffs)
  const managedRunLimit = {
    shown: managedRuns.length,
    total: sourceValues.managedRunTotal,
    omitted: sourceValues.managedRunTotal - managedRuns.length,
  }
  const truncated = [
    boundedCapabilities.limit,
    boundedRuns.limit,
    boundedHandoffs.limit,
    managedRunLimit,
  ].some((limit) => limit.omitted > 0)
  const selectionProjection = projectSelection(selection, capabilities)
  const selectionCapabilityState = selectionProjection.status === "selected"
    ? selectionProjection.capabilityState
    : selectionProjection.status
  const attentionRequired = truncated || ["stale", "migration-required", "invalid"].includes(selectionCapabilityState)
  const observedTimes = capabilities.map((entry) => entry.observedAt).sort(compare)

  const content = agentModelDashboardContentSchema.parse({
    schemaVersion: 1,
    kind: "agent-model-dashboard",
    product: { recordType: "product", recordId: product.id, revision: productRevision, digest: productDigest },
    capabilities: boundedCapabilities.values,
    selection: selectionProjection,
    runs: boundedRuns.values,
    handoffs: boundedHandoffs.values,
    providerMetrics: {
      usage: { state: "unavailable", basis: "current-managed-records-have-no-provider-usage-or-cost-contract" },
      cost: { state: "unavailable", basis: "current-managed-records-have-no-provider-usage-or-cost-contract" },
    },
    freshness: {
      state: attentionRequired ? "attention-required" : "current",
      selectionCapabilityState,
      oldestCapabilityObservedAt: observedTimes[0],
      newestCapabilityObservedAt: observedTimes.at(-1),
      truncated,
      coverageBoundary: "bounded-current-records-do-not-prove-provider-account-or-native-host-readiness",
    },
    limits: {
      capabilities: boundedCapabilities.limit,
      runs: boundedRuns.limit,
      handoffs: boundedHandoffs.limit,
      managedRuns: managedRunLimit,
      truncated,
    },
    observedAt,
    sourceBoundary: "current-governed-agent-selection-run-handoff-and-managed-evidence-metadata",
    limitations: [
      "Capability truth is bounded to the current portable adapter observations and does not prove provider-account or native-host readiness.",
      "Current managed records do not carry a provider usage or cost contract, so both metrics remain explicitly unavailable.",
      "Run and handoff history is bounded; omitted records remain governed but are not summarized by this snapshot.",
    ],
    authorityBoundary: "agent-model-dashboard-does-not-select-switch-handoff-launch-or-authorize-effects",
  })
  return agentModelDashboardSchema.parse({ ...content, snapshotDigest: canonicalDigest(content) })
}
