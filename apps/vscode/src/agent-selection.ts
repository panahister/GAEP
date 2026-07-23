import { canonicalDigest, type AdapterProbeResult } from "@gaep/agent-sdk"
import type {
  AdapterCapabilities,
  AgentSelection,
  AgentSetting,
  ManagedRunState,
  ModelDescriptor,
  Run,
} from "@gaep/contracts"

export type SelectableRuntimeKind = "executable" | "managed-in-process"
export const exactSelectionReviewCharacterLimit = 10_000

export function exactSelectionReviewText(sections: readonly string[]): string {
  const review = sections.join("\n\n")
  if (review.length > exactSelectionReviewCharacterLimit) {
    throw new Error(
      `The exact selection review is ${review.length} characters and exceeds the ${exactSelectionReviewCharacterLimit}-character review limit; reduce settings or handoff detail before confirming`,
    )
  }
  return review
}

export type ProbeSelectionEligibility =
  | { selectable: true; runtimeKind: SelectableRuntimeKind }
  | { selectable: false; reason: string }

export function probeSelectionEligibility(probe: AdapterProbeResult): ProbeSelectionEligibility {
  const { capabilities, runtimeBinding } = probe
  if (!capabilities.detected || capabilities.executionInterface === "unavailable") {
    return { selectable: false, reason: `${capabilities.agentLabel} has no available managed execution interface` }
  }
  if (
    runtimeBinding.scope !== "machine-local" ||
    runtimeBinding.adapterId !== capabilities.adapterId ||
    runtimeBinding.agentId !== capabilities.agentId
  ) {
    return { selectable: false, reason: `${capabilities.agentLabel} returned an inconsistent machine-local runtime identity` }
  }
  if (runtimeBinding.kind === "unavailable") {
    return { selectable: false, reason: runtimeBinding.reason }
  }
  if (runtimeBinding.kind === "managed-in-process") {
    if (capabilities.executionInterface !== "managed-in-process" || !runtimeBinding.runtimeId.trim()) {
      return { selectable: false, reason: `${capabilities.agentLabel} returned an inconsistent managed in-process binding` }
    }
    return { selectable: true, runtimeKind: "managed-in-process" }
  }
  if (capabilities.executionInterface === "managed-in-process") {
    return { selectable: false, reason: `${capabilities.agentLabel} requires a managed in-process binding, not an executable` }
  }
  if (
    !runtimeBinding.executableFingerprint.requested.trim() ||
    !runtimeBinding.executablePath.trim() ||
    runtimeBinding.executableFingerprint.canonicalPath !== runtimeBinding.executablePath ||
    !/^sha256:[0-9a-f]{64}$/u.test(runtimeBinding.executableFingerprint.digest) ||
    !Number.isSafeInteger(runtimeBinding.executableFingerprint.size) ||
    runtimeBinding.executableFingerprint.size < 0 ||
    !Number.isFinite(runtimeBinding.executableFingerprint.modifiedAtMs)
  ) {
    return { selectable: false, reason: `${capabilities.agentLabel} returned an invalid executable fingerprint` }
  }
  return { selectable: true, runtimeKind: "executable" }
}

export function allowsCustomModelIdentifier(capabilities: AdapterCapabilities): boolean {
  return capabilities.executionInterface !== "managed-in-process" &&
    (capabilities.adapterId === "gaep.codex-cli" || capabilities.adapterId === "gaep.claude-code-cli")
}

export function settingForSelectedModel(
  adapterId: string,
  setting: AgentSetting,
  model: ModelDescriptor | undefined,
): AgentSetting | undefined {
  const effortKey = (adapterId === "gaep.codex-cli" && setting.key === "reasoningEffort") ||
    (adapterId === "gaep.claude-code-cli" && setting.key === "effort")
  if (!effortKey || setting.kind !== "select" || !model || model.reasoningOptions.length === 0) return setting
  const permitted = new Set(model.reasoningOptions)
  const options = (setting.options ?? []).filter((option) => permitted.has(option.value))
  if (options.length === 0 && !setting.required) return undefined
  const defaultValue = typeof setting.defaultValue === "string" && options.some((option) => option.value === setting.defaultValue)
    ? setting.defaultValue
    : undefined
  return { ...setting, options, defaultValue }
}

export interface SelectionSwitchSnapshot {
  runs: readonly Pick<Run, "id" | "state">[]
  managedRuns: readonly { id: string; state: ManagedRunState }[]
  pendingReviews: readonly { managedRunId: string; state: string }[]
  activeRoot: boolean
}

const blockingRunStates = new Set<Run["state"]>(["prepared", "running", "paused", "unknown"])
const settledManagedStates = new Set(["completed", "failed", "cancelled", "timed-out", "discarded"])

export function selectionSwitchBlockers(snapshot: SelectionSwitchSnapshot): string[] {
  const blockers: string[] = []
  if (snapshot.activeRoot) blockers.push("An active provider session is still registered for this Product root")
  for (const run of snapshot.runs.filter((candidate) => blockingRunStates.has(candidate.state))) {
    blockers.push(`Run ${run.id} is ${run.state} and must be completed, cancelled, or reconciled before changing selection`)
  }
  const pendingIds = new Set(snapshot.pendingReviews.map((review) => review.managedRunId))
  for (const managed of snapshot.managedRuns.filter((candidate) => !settledManagedStates.has(candidate.state))) {
    if (!pendingIds.has(managed.id)) {
      blockers.push(`Managed Run ${managed.id} is ${managed.state} and must be resolved before changing selection`)
    }
  }
  for (const review of snapshot.pendingReviews) {
    blockers.push(`Managed Run ${review.managedRunId} has an unresolved ${review.state} staged review`)
  }
  return [...new Set(blockers)]
}

export type MaterialSelection = Pick<AgentSelection,
  "adapterId" | "agentId" | "modelId" | "modelTruthClass" | "modelAlias" | "settings" | "capabilityDigest"
>

export function materialSelectionChange(current: AgentSelection, next: MaterialSelection): boolean {
  const material = (selection: MaterialSelection): object => ({
    adapterId: selection.adapterId,
    agentId: selection.agentId,
    modelId: selection.modelId,
    modelTruthClass: selection.modelTruthClass,
    modelAlias: selection.modelAlias,
    settings: selection.settings,
    capabilityDigest: selection.capabilityDigest,
  })
  return canonicalDigest(material(current)) !== canonicalDigest(material(next))
}
