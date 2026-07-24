import { createHash } from "node:crypto"
import { stat } from "node:fs/promises"
import { isAbsolute, resolve } from "node:path"

export const protocolVersion = 2
export const maximumFrameBytes = 1024 * 1024
export const maximumOffset = 10_000
export const maximumPageSize = 200
export const defaultPageSize = 100
export const maximumSafeProductRevision = Number.MAX_SAFE_INTEGER

export const deliveryPhaseIds = [
  "phase-0-1a-foundation",
  "phase-1b-product",
  "phase-1c-acceptance",
  "phase-2-design",
  "phase-3a-readiness",
  "phase-3b-implementation",
  "phase-4-release-learning",
] as const

export type DeliveryPhaseId = typeof deliveryPhaseIds[number]

const deliveryPhaseCatalog = {
  "phase-0-1a-foundation": ["Phase 0 / 1A — Four-IDE Platform Foundation", "foundation-summary"],
  "phase-1b-product": ["Phase 1B — Product P0–P4", "product-architecture"],
  "phase-1c-acceptance": ["Phase 1C — Four-IDE Phase 1 Release", "phase-release-readiness"],
  "phase-2-design": ["Phase 2 — UX and Figma Loop", "ux-figma"],
  "phase-3a-readiness": ["Phase 3A — Backlog and Implementation Readiness", "backlog-readiness"],
  "phase-3b-implementation": ["Phase 3B — Controlled Implementation and QA", "implementation-qa"],
  "phase-4-release-learning": ["Phase 4 — Release, Publish, and Learning", "release-learning"],
} as const satisfies Record<DeliveryPhaseId, readonly [string, string]>

const phaseDashboardPanelCatalog = {
  "foundation-summary": ["phase", "Foundation summary and readiness"],
  "product-architecture": ["phase", "Product and architecture"],
  "phase-release-readiness": ["phase", "Phase release readiness"],
  "ux-figma": ["phase", "UX and Figma"],
  "backlog-readiness": ["phase", "Backlog and implementation readiness"],
  "implementation-qa": ["phase", "Controlled implementation and QA"],
  "release-learning": ["phase", "Release and learning"],
  "change-impact": ["change-impact", "Change and impact"],
  "agent-model": ["agent-model", "Agent and model"],
} as const

const changeImpactEffects = [
  "observe", "provisional", "reversible-change", "external-effect", "destructive-or-irreversible",
] as const
const changeImpactStates = ["proposed", "planned", "active", "blocked", "completed", "cancelled"] as const
const changeImpactWorkItemStates = [
  "proposed", "planned", "ready", "in-progress", "blocked", "completed", "cancelled",
] as const
const changeImpactRelationships = [
  "targets", "derives-from", "contributes-to", "depends-on", "implements", "satisfies", "validates",
  "mitigates", "decides", "affects", "supersedes", "related-to",
] as const
const changeImpactRecordTypes = [
  "product", "design-revision", "initiative", "change", "work-item", "requirement", "decision", "risk",
  "architecture", "evidence", "context-pack", "workflow-plan", "tool-definition", "instruction-privilege-grant",
  "run-tool-selection", "run", "external",
] as const

const maximumJsonDepth = 64
const maximumJsonCollectionEntries = 512
const summaryKind = "portable-design-snapshot-summary"
const governanceState = "pending-human-review"
const claimBoundary = "import-validation-is-not-design-approval-or-baseline"
const nonEscalation = "not-gaep-approval-design-baseline-implementation-or-release-readiness"
const summaryPrivacyBoundary = "Validated metadata only; no bundle root, artifact path, token value, source bytes, credentials, OAuth state, or external-account state."
const pageGovernanceBoundary = "Every item remains pending human review; source review is an upstream claim only."
const pagePrivacyBoundary = "Items contain validated metadata and digests only; local paths and source content are omitted."
const managedInventoryBoundary = "managed-run-inventory-is-read-only-and-does-not-grant-run-effect-apply-approval-or-outcome-authority"
const managedEvidenceBoundary = "managed-evidence-detail-is-verified-read-only-evidence-and-does-not-grant-apply-approval-or-outcome-authority"
const managedEvidencePrivacyBoundary = "Portable identifiers, states, counts, digests, warning codes and timestamps only; prompts, provider output, source bytes, changed paths, executable paths, process state and credentials are omitted."
const managedReviewBoundary = "managed-review-preview-authorizes-no-mutation-without-an-exact-digest-bound-human-decision" as const
const managedReviewPrivacyBoundary = "Exact portable identifiers, digests, warning codes, workspace-relative changed paths, file digests, sizes, modes and write scopes only; prompts, provider output, source bytes, absolute paths, executable paths, process state and credentials are omitted." as const
const managedReviewTransitionBoundary = "managed-review-transition-proves-persisted-state-not-provider-outcome-or-machine-local-cleanup" as const
const managedReviewCleanupBoundary = "Persisted discard or apply state does not independently prove machine-local stage or recovery-journal cleanup." as const
const actorIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:@+-]*$/u
const toolPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u
const digestPattern = /^sha256:[0-9a-f]{64}$/u
const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/u
const emptyUuid = "00000000-0000-0000-0000-000000000000"
const rfc3339Pattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/u

type JsonRecord = Record<string, unknown>

export type PortableDesignClassification = "public" | "internal" | "confidential" | "restricted"
export type PortableDesignSourceReviewStatus = "unreviewed" | "reviewed" | "approved"
export type PortableDesignExportMethod = "manual-export" | "design-tool-export" | "plugin-export"

export interface PortableDesignGovernanceMetadata {
  readonly state: "pending-human-review"
  readonly humanReviewRequired: true
  readonly claimBoundary: "import-validation-is-not-design-approval-or-baseline"
  readonly nonEscalation: "not-gaep-approval-design-baseline-implementation-or-release-readiness"
}

export interface PortableDesignSourceReviewMetadata {
  readonly status: PortableDesignSourceReviewStatus
  readonly claimLabel: string
  readonly gaepApproval: false
}

export interface PortableDesignSourceMetadata {
  readonly tool: string
  readonly exportMethod: PortableDesignExportMethod
}

export interface PortableDesignCounts {
  readonly artifacts: number
  readonly normalizedDesignTokens: number
  readonly validationChecks: number
  readonly recordedLimitations: number
}

export interface PortableDesignDigests {
  readonly snapshot: string
  readonly evidence: string
  readonly manifest: string
  readonly artifactInventory: string
}

export interface PortableDesignTimestamps {
  readonly sourceExportedAt: string
  readonly importedAt: string
}

export interface PortableDesignSnapshotSummary {
  readonly schemaVersion: 1
  readonly kind: "portable-design-snapshot-summary"
  readonly bundleId: string
  readonly productId: string
  readonly initiativeId?: string
  readonly title: string
  readonly classification: PortableDesignClassification
  readonly governance: PortableDesignGovernanceMetadata
  readonly sourceReview: PortableDesignSourceReviewMetadata
  readonly source: PortableDesignSourceMetadata
  readonly counts: PortableDesignCounts
  readonly digests: PortableDesignDigests
  readonly timestamps: PortableDesignTimestamps
  readonly privacyBoundary: string
}

export interface PortableDesignSnapshotPage {
  readonly items: readonly PortableDesignSnapshotSummary[]
  readonly offset: number
  readonly limit: number
  readonly total: number
  readonly hasMore: boolean
  readonly governanceBoundary: string
  readonly privacyBoundary: string
}

export interface ProductBinding {
  readonly id: string
  readonly name: string
  readonly revision: number
  readonly digest: string
}

export interface PhaseDashboardPanel {
  readonly id: keyof typeof phaseDashboardPanelCatalog
  readonly role: "phase" | "change-impact" | "agent-model"
  readonly title: string
  readonly applicability: {
    readonly status: "applicable" | "not-applicable" | "unknown"
    readonly basis: "phase-contract" | "governed-decision" | "not-evaluated"
    readonly decision?: { readonly recordType: "decision"; readonly recordId: string; readonly revision: number; readonly digest: string }
  }
  readonly state: "active" | "not-applicable" | "attention-required"
}

export interface PhaseDashboardFramework {
  readonly schemaVersion: 1
  readonly kind: "phase-dashboard-framework"
  readonly catalogVersion: "gaep-phase-dashboards-v1"
  readonly product: { readonly recordType: "product"; readonly recordId: string; readonly revision: number; readonly digest: string }
  readonly phase: { readonly id: DeliveryPhaseId; readonly label: string }
  readonly panels: readonly PhaseDashboardPanel[]
  readonly observedAt: string
  readonly sourceBoundary: "governed-repository-and-engine-only"
  readonly limitations: readonly string[]
  readonly authorityBoundary: "dashboard-is-a-projection-not-phase-approval-readiness-or-applicability-evidence"
  readonly compositionDigest: string
}

export interface ChangeImpactChangeReference {
  readonly recordType: "change"
  readonly recordId: string
  readonly revision: number
  readonly digest: string
  readonly state: typeof changeImpactStates[number]
  readonly effectEnvelope: readonly typeof changeImpactEffects[number][]
}

export interface ChangeImpactChangeCatalog {
  readonly schemaVersion: 1
  readonly kind: "change-impact-change-catalog"
  readonly product: { readonly recordType: "product"; readonly recordId: string; readonly revision: number; readonly digest: string }
  readonly items: readonly ChangeImpactChangeReference[]
  readonly total: number
  readonly omitted: number
  readonly observedAt: string
  readonly sourceBoundary: "current-governed-change-metadata-only"
  readonly limitations: readonly string[]
  readonly authorityBoundary: "change-catalog-selection-does-not-approve-change-or-authorize-effects"
  readonly snapshotDigest: string
}

export type ChangeImpactPortableLocator =
  | { readonly kind: "workspace-relative"; readonly path: string }
  | { readonly kind: "logical"; readonly value: string }
  | { readonly kind: "external-uri"; readonly uri: string }

interface ChangeImpactExactReference {
  readonly recordType: "product" | "work-item" | "decision" | "risk"
  readonly recordId: string
  readonly revision: number
  readonly digest: string
}

interface ChangeImpactTraceEndpoint {
  readonly recordType: typeof changeImpactRecordTypes[number]
  readonly recordId: string
  readonly revision?: number
  readonly digest?: string
}

interface ChangeImpactLimit {
  readonly shown: number
  readonly total: number
  readonly omitted: number
}

export interface ChangeImpactDashboard {
  readonly schemaVersion: 1
  readonly kind: "change-impact-dashboard"
  readonly product: ChangeImpactExactReference & { readonly recordType: "product" }
  readonly change: ChangeImpactChangeReference
  readonly workItems: readonly {
    readonly record: ChangeImpactExactReference & { readonly recordType: "work-item" }
    readonly state: typeof changeImpactWorkItemStates[number]
  }[]
  readonly changedArtifacts: readonly {
    readonly sourceWorkItem: ChangeImpactExactReference & { readonly recordType: "work-item" }
    readonly locator: ChangeImpactPortableLocator
  }[]
  readonly effectTargets: readonly {
    readonly sourceWorkItem: ChangeImpactExactReference & { readonly recordType: "work-item" }
    readonly locator: ChangeImpactPortableLocator
  }[]
  readonly affectedUnits: readonly {
    readonly direction: "upstream" | "downstream"
    readonly relationship: typeof changeImpactRelationships[number]
    readonly endpoint: ChangeImpactTraceEndpoint
    readonly trace: {
      readonly recordId: string
      readonly revision: number
      readonly assessmentDigest: string
      readonly assessedState: "valid" | "unresolved" | "stale" | "invalid"
    }
  }[]
  readonly governance: {
    readonly approval: { readonly state: "not-established"; readonly basis: "current-contract-has-no-change-approval-record" }
    readonly decisions: readonly {
      readonly record: ChangeImpactExactReference & { readonly recordType: "decision" }
      readonly state: "open" | "decided" | "deferred" | "superseded"
      readonly outcome: "human-selected" | "not-selected"
    }[]
    readonly risks: readonly {
      readonly record: ChangeImpactExactReference & { readonly recordType: "risk" }
      readonly state: "open" | "treated" | "accepted" | "closed"
      readonly likelihood: "rare" | "unlikely" | "possible" | "likely" | "almost-certain" | "unknown"
      readonly impact: "negligible" | "minor" | "moderate" | "major" | "critical" | "unknown"
      readonly acceptance: "human-accepted" | "not-accepted"
    }[]
    readonly authorityBoundary: "decisions-and-risk-acceptance-do-not-approve-the-change"
  }
  readonly freshness: {
    readonly state: "current" | "attention-required"
    readonly evaluatedAt: string
    readonly unresolvedTraceLinks: number
    readonly invalidTraceLinks: number
    readonly staleTraceLinks: number
    readonly staleGovernanceReferences: number
    readonly traceAnalysisTruncated: boolean
    readonly coverageBoundary: "absence-of-a-trace-link-does-not-prove-absence-of-impact"
  }
  readonly limits: {
    readonly workItems: ChangeImpactLimit
    readonly changedArtifacts: ChangeImpactLimit
    readonly effectTargets: ChangeImpactLimit
    readonly affectedUnits: ChangeImpactLimit
    readonly decisions: ChangeImpactLimit
    readonly risks: ChangeImpactLimit
    readonly truncated: boolean
  }
  readonly observedAt: string
  readonly sourceBoundary: "current-governed-records-and-bounded-trace-analysis"
  readonly limitations: readonly string[]
  readonly authorityBoundary: "change-impact-dashboard-does-not-approve-change-accept-risk-or-authorize-effects"
  readonly snapshotDigest: string
}

interface AgentModelLimit {
  readonly shown: number
  readonly total: number
  readonly omitted: number
}

interface AgentModelRecordReference {
  readonly recordType: "product" | "run" | "managed-run" | "handoff"
  readonly recordId: string
  readonly revision: number
  readonly digest: string
}

export interface AgentModelDashboard {
  readonly schemaVersion: 1
  readonly kind: "agent-model-dashboard"
  readonly product: AgentModelRecordReference & { readonly recordType: "product" }
  readonly capabilities: readonly {
    readonly adapterId: string
    readonly adapterVersion: string
    readonly agentId: string
    readonly agentLabel: string
    readonly runtimeVersion: string | null
    readonly capabilityDigest: string
    readonly detected: boolean
    readonly executionInterface: AgentReadinessSnapshot["executionInterface"]
    readonly interfaceMaturity: AgentReadinessSnapshot["interfaceMaturity"]
    readonly support: {
      readonly resume: boolean
      readonly cancel: boolean
      readonly checkpoints: boolean
      readonly modelDiscovery: boolean
      readonly toolSelection: boolean
    }
    readonly modelCount: number
    readonly limitations: { readonly values: readonly string[]; readonly shown: number; readonly total: number; readonly omitted: number }
    readonly observedAt: string
    readonly selected: boolean
  }[]
  readonly selection:
    | { readonly status: "unselected" | "invalid" }
    | {
        readonly status: "selected" | "migration-required"
        readonly selectionDigest: string
        readonly adapterId: string
        readonly agentId: string
        readonly modelId: string
        readonly modelTruthClass: AgentTruthClass
        readonly modelAlias: boolean | null
        readonly settings: Readonly<Record<string, PortableAgentSettingValue>>
        readonly selectedAt: string
        readonly capabilityDigest: string
        readonly capabilityState: "current" | "stale" | "migration-required"
      }
  readonly runs: readonly {
    readonly record: AgentModelRecordReference & { readonly recordType: "run" }
    readonly initiativeId: string
    readonly state: AgentRunState
    readonly agent: { readonly adapterId: string; readonly agentId: string; readonly modelId: string; readonly selectionDigest: string }
    readonly startedAt: string | null
    readonly endedAt: string | null
    readonly managed:
      | { readonly status: "not-observed-in-bounded-window" }
      | {
          readonly status: "observed"
          readonly record: AgentModelRecordReference & { readonly recordType: "managed-run" }
          readonly mode: "codex-staged" | "manual-offline" | "claude-context-only"
          readonly state: ManagedRunState
          readonly attemptNumber: number
          readonly bindingsDigest: string
          readonly provider: { readonly adapterId: string; readonly agentId: string; readonly modelId: string; readonly capabilityDigest: string }
          readonly result:
            | { readonly status: "not-bound" }
            | {
                readonly status: "bound"
                readonly recordId: string
                readonly digest: string
                readonly providerDisposition: "completed" | "failed" | "cancelled" | "interrupted" | "crashed" | "protocol-error" | "unknown"
                readonly outcomeStatus: "satisfied" | "failed" | "not-assessed" | "indeterminate"
                readonly evidence: {
                  readonly recordId: string
                  readonly digest: string
                  readonly eventCount: number
                  readonly eventsDigest: string
                  readonly actualEffectCount: number
                  readonly capturedAt: string
                }
              }
        }
  }[]
  readonly handoffs: readonly {
    readonly record: AgentModelRecordReference & { readonly recordType: "handoff" }
    readonly fromRun: AgentModelRecordReference & { readonly recordType: "run" }
    readonly toSelection: { readonly adapterId: string; readonly agentId: string; readonly modelId: string; readonly selectionDigest: string }
    readonly state: "pending-acknowledgement" | "acknowledged"
    readonly createdAt: string
    readonly acknowledgedAt: string | null
  }[]
  readonly providerMetrics: {
    readonly usage: { readonly state: "unavailable"; readonly basis: "current-managed-records-have-no-provider-usage-or-cost-contract" }
    readonly cost: { readonly state: "unavailable"; readonly basis: "current-managed-records-have-no-provider-usage-or-cost-contract" }
  }
  readonly freshness: {
    readonly state: "current" | "attention-required"
    readonly selectionCapabilityState: "current" | "unselected" | "stale" | "migration-required" | "invalid"
    readonly oldestCapabilityObservedAt: string
    readonly newestCapabilityObservedAt: string
    readonly truncated: boolean
    readonly coverageBoundary: "bounded-current-records-do-not-prove-provider-account-or-native-host-readiness"
  }
  readonly limits: {
    readonly capabilities: AgentModelLimit
    readonly runs: AgentModelLimit
    readonly handoffs: AgentModelLimit
    readonly managedRuns: AgentModelLimit
    readonly truncated: boolean
  }
  readonly observedAt: string
  readonly sourceBoundary: "current-governed-agent-selection-run-handoff-and-managed-evidence-metadata"
  readonly limitations: readonly string[]
  readonly authorityBoundary: "agent-model-dashboard-does-not-select-switch-handoff-launch-or-authorize-effects"
  readonly snapshotDigest: string
}

export type AgentTruthClass = "observed" | "provider-declared" | "configured" | "inferred" | "unknown"

export interface AgentModelReadiness {
  readonly id: string
  readonly label: string
  readonly truthClass: AgentTruthClass
  readonly alias: boolean
}

export type PortableAgentSettingValue = string | number | boolean | readonly string[]

export interface AgentSettingOption {
  readonly value: string
  readonly label: string
  readonly description?: string
}

export interface AgentSelectionSetting {
  readonly key: string
  readonly label: string
  readonly description: string
  readonly kind: "select" | "boolean" | "number" | "string" | "string-list"
  readonly required: boolean
  readonly sensitive: boolean
  readonly defaultValue?: PortableAgentSettingValue
  readonly options?: readonly AgentSettingOption[]
  readonly minimum?: number
  readonly maximum?: number
  readonly truthClass: AgentTruthClass
}

export interface AgentSelection {
  readonly schemaVersion: 2
  readonly adapterId: string
  readonly agentId: string
  readonly modelId: string
  readonly modelTruthClass: AgentTruthClass
  readonly modelAlias: boolean | null
  readonly settings: Readonly<Record<string, PortableAgentSettingValue>>
  readonly selectedAt: string
  readonly capabilityDigest: string
}

export type AgentSelectionState =
  | { readonly status: "unselected" }
  | { readonly status: "selected"; readonly selection: AgentSelection }
  | { readonly status: "migration-required"; readonly portableCandidate: AgentSelection }
  | { readonly status: "invalid" }

export type AgentRunState = "prepared" | "running" | "paused" | "completed" | "failed" | "cancelled" | "unknown"

export interface AgentRun {
  readonly schemaVersion: 1
  readonly id: string
  readonly revision?: number
  readonly charterId: string
  readonly charterDigest?: string
  readonly productId: string
  readonly initiativeId: string
  readonly agent: AgentSelection
  readonly state: AgentRunState
  readonly providerSessionRef?: string
  readonly startedAt?: string
  readonly endedAt?: string
  readonly previousRunId?: string
}

export interface HandoffWorkspaceBaseline {
  readonly gitHead?: string
  readonly dirty: boolean | null
  readonly changedFiles: readonly string[]
  readonly truthClass?: AgentTruthClass
  readonly observationError?: string
}

export interface AgentHandoff {
  readonly schemaVersion: 1
  readonly id: string
  readonly productId: string
  readonly initiativeId: string
  readonly fromRunId: string
  readonly toAgent: AgentSelection
  readonly reason: string
  readonly workspaceBaseline: HandoffWorkspaceBaseline
  readonly completedWork: readonly string[]
  readonly unresolvedMatters: readonly string[]
  readonly decisions: readonly string[]
  readonly evidence: readonly string[]
  readonly capabilityDifferences: readonly string[]
  readonly createdAt: string
  readonly acknowledgedAt?: string
}

export type ManagedReadOnlyGatePhase =
  | "preconditions"
  | "outputs"
  | "evidence"
  | "stop-conditions"
  | "charter-evidence"
  | "charter-stop-conditions"

export interface ManagedReadOnlyGatePreview {
  readonly key: string
  readonly stepId?: string
  readonly phase: ManagedReadOnlyGatePhase
  readonly criteria: readonly string[]
  readonly criteriaDigest: string
}

export interface ManagedReadOnlyPreview {
  readonly schemaVersion: 1
  readonly kind: "managed-readonly-preview"
  readonly productId: string
  readonly initiativeId: string
  readonly charterId: string
  readonly charterDigest: string
  readonly workflowPlanId: string
  readonly workflowPlanDigest: string
  readonly adapterId: string
  readonly agentId: string
  readonly modelId: string
  readonly selectionDigest: string
  readonly strategy: "sequential" | "parallel-readonly"
  readonly stepIds: readonly string[]
  readonly contextPackCount: number
  readonly readScopeCount: number
  readonly gates: readonly ManagedReadOnlyGatePreview[]
  readonly authorityBoundary: "managed-readonly-preview-does-not-grant-execution-or-effect-authority"
  readonly previewDigest: string
}

export interface ManagedReadOnlyReceipt {
  readonly schemaVersion: 1
  readonly kind: "managed-readonly-receipt"
  readonly previewDigest: string
  readonly runId: string
  readonly managedRunId: string
  readonly productId: string
  readonly initiativeId: string
  readonly adapterId: string
  readonly agentId: string
  readonly modelId: string
  readonly mode: "codex-staged" | "manual-offline" | "claude-context-only"
  readonly state: "review-required" | "completed" | "failed" | "cancelled" | "timed-out" | "unknown" | "conflict" | "discarded"
  readonly providerDisposition: "completed" | "failed" | "cancelled" | "interrupted" | "crashed" | "protocol-error" | "unknown"
  readonly outcomeStatus: "satisfied" | "failed" | "not-assessed" | "indeterminate"
  readonly outcomeBasis: "postcondition-evaluator" | "deterministic-offline-runtime" | "not-evaluated" | "provider-failure"
  readonly eventCount: number
  readonly completedStepCount: number
  readonly totalStepCount: number
  readonly resultDigest: string
  readonly evidenceDigest: string
  readonly warnings: readonly string[]
  readonly startedAt: string
  readonly endedAt: string
  readonly authorityBoundary: "managed-readonly-receipt-does-not-grant-tool-write-effect-or-outcome-authority"
}

export type ManagedRunState =
  | "prepared" | "running" | "review-required" | "applying" | "completed" | "failed"
  | "cancelled" | "timed-out" | "unknown" | "conflict" | "discarded"

export interface ManagedRunSummary {
  readonly schemaVersion: 1
  readonly kind: "managed-run-summary"
  readonly managedRunId: string
  readonly runId: string
  readonly productId: string
  readonly initiativeId: string
  readonly mode: "codex-staged" | "manual-offline" | "claude-context-only"
  readonly state: ManagedRunState
  readonly adapterId: string
  readonly agentId: string
  readonly modelId: string
  readonly attemptNumber: number
  readonly recoveryStatus: "not-required" | "required" | "recovered" | "resume-unavailable"
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
  readonly authorityBoundary: "managed-run-inventory-is-read-only-and-does-not-grant-run-effect-apply-approval-or-outcome-authority"
}

export interface ManagedRunSummaryPage {
  readonly schemaVersion: 1
  readonly kind: "managed-run-summary-page"
  readonly items: readonly ManagedRunSummary[]
  readonly offset: number
  readonly limit: number
  readonly total: number
  readonly omittedCount: number
  readonly snapshotDigest: string
  readonly hasMore: boolean
  readonly authorityBoundary: ManagedRunSummary["authorityBoundary"]
  readonly privacyBoundary: string
}

export interface ManagedEvidenceDetail {
  readonly schemaVersion: 1
  readonly kind: "managed-evidence-detail"
  readonly summary: ManagedRunSummary
  readonly artifactStatus: "record-only" | "verified-result-and-evidence"
  readonly result?: {
    readonly resultId: string
    readonly resultDigest: string
    readonly providerDisposition: "completed" | "failed" | "cancelled" | "interrupted" | "crashed" | "protocol-error" | "unknown"
    readonly terminationCause: "normal" | "cancel-request" | "timeout" | "provider-failure" | "process-loss" | "protocol-error"
    readonly outcomeStatus: "satisfied" | "failed" | "not-assessed" | "indeterminate"
    readonly outcomeBasis: "postcondition-evaluator" | "deterministic-offline-runtime" | "not-evaluated" | "provider-failure"
    readonly terminalState: Exclude<ManagedRunState, "prepared" | "running" | "applying">
    readonly evidenceId: string
    readonly evidenceDigest: string
    readonly warningCodes: readonly string[]
    readonly startedAt: string
    readonly endedAt: string
  }
  readonly evidence?: {
    readonly evidenceId: string
    readonly evidenceDigest: string
    readonly eventCount: number
    readonly eventTypeCounts: Readonly<Record<"lifecycle" | "output" | "item" | "approval" | "warning" | "error", number>>
    readonly eventsDigest: string
    readonly workflowStrategy: "sequential" | "parallel-readonly"
    readonly workflowStepCount: number
    readonly workflowAttemptCount: number
    readonly completedStepCount: number
    readonly charterEvidenceStatus: "satisfied" | "failed" | "not-assessed"
    readonly charterStopStatus: "satisfied" | "failed" | "not-assessed"
    readonly terminalReasonCode: string
    readonly staging?: {
      readonly changeCount: number
      readonly excludedPathCount: number
      readonly applyState: "pending" | "applied" | "conflict" | "discarded" | "not-applied"
      readonly baselineDigest: string
      readonly finalDigest: string
      readonly changedInventoryDigest: string
      readonly excludedPathSetDigest: string
    }
    readonly actualEffectCounts: Readonly<Record<"not-observed" | "observed-provisional" | "applied" | "blocked" | "unknown", number>>
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
  readonly authorityBoundary: "managed-evidence-detail-is-verified-read-only-evidence-and-does-not-grant-apply-approval-or-outcome-authority"
  readonly privacyBoundary: string
}

export interface ManagedChangedFile {
  readonly path: string
  readonly kind: "added" | "modified" | "deleted"
  readonly beforeDigest?: string
  readonly afterDigest?: string
  readonly beforeSize?: number
  readonly afterSize?: number
  readonly beforeMode?: number
  readonly afterMode?: number
}

export interface ManagedReviewApplyConfirmation {
  readonly decision: "apply-exact-reviewed-inventory"
  readonly reviewEvidenceId: string
  readonly reviewEvidenceDigest: string
  readonly changedInventoryDigest: string
  readonly writeEnvelope: readonly string[]
  readonly writeEnvelopeDigest: string
}

export interface ManagedReviewPreview {
  readonly schemaVersion: 1
  readonly kind: "managed-review-preview"
  readonly managedRunId: string
  readonly managedRunRevision: number
  readonly runId: string
  readonly productId: string
  readonly initiativeId: string
  readonly mode: "codex-staged"
  readonly state: "review-required" | "conflict"
  readonly canApply: boolean
  readonly canDiscard: true
  readonly hasLocalJournal: boolean
  readonly bindingsDigest: string
  readonly result: {
    readonly resultId: string
    readonly resultDigest: string
    readonly terminalState: "review-required" | "conflict"
    readonly providerDisposition: "completed" | "failed" | "cancelled" | "interrupted" | "crashed" | "protocol-error" | "unknown"
    readonly outcomeStatus: "satisfied" | "failed" | "not-assessed" | "indeterminate"
    readonly outcomeBasis: "postcondition-evaluator" | "deterministic-offline-runtime" | "not-evaluated" | "provider-failure"
    readonly warningCodes: readonly string[]
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
    readonly changedInventoryLimit: 512
    readonly omittedCount: 0
    readonly changedInventory: readonly ManagedChangedFile[]
    readonly changedInventoryDigest: string
    readonly excludedPathCount: number
    readonly excludedPathSetDigest: string
  }
  readonly applyConfirmation?: ManagedReviewApplyConfirmation
  readonly postApplyGatePolicy: "record-not-assessed"
  readonly authorityBoundary: typeof managedReviewBoundary
  readonly privacyBoundary: typeof managedReviewPrivacyBoundary
  readonly cleanupBoundary: typeof managedReviewCleanupBoundary
  readonly previewDigest: string
}

export interface ManagedReviewTransition {
  readonly schemaVersion: 1
  readonly kind: "managed-review-transition"
  readonly decision: "apply-exact-managed-review" | "discard-exact-managed-review"
  readonly sourcePreviewDigest: string
  readonly sourceManagedRunRevision: number
  readonly managedRunId: string
  readonly managedRunRevision: number
  readonly state: ManagedRunState
  readonly canApply: boolean
  readonly canDiscard: boolean
  readonly hasLocalJournal: boolean
  readonly detail: ManagedEvidenceDetail
  readonly authorityBoundary: typeof managedReviewTransitionBoundary
  readonly cleanupBoundary: typeof managedReviewCleanupBoundary
  readonly transitionDigest: string
}

export interface AgentReadinessSnapshot {
  readonly schemaVersion: 1
  readonly adapterId: string
  readonly adapterVersion: string
  readonly agentId: string
  readonly agentLabel: string
  readonly runtimeVersion?: string
  readonly detected: boolean
  readonly executionInterface: "cli-jsonl" | "cli-stream-json" | "stdio-rpc" | "managed-in-process" | "unavailable"
  readonly interfaceMaturity: "stable" | "beta" | "experimental" | "unknown"
  readonly supportsResume: boolean
  readonly supportsCancel: boolean
  readonly supportsCheckpoints: boolean
  readonly supportsModelDiscovery: boolean
  readonly supportsToolSelection: boolean
  readonly settingsCount: number
  readonly settings: readonly AgentSelectionSetting[]
  readonly models: readonly AgentModelReadiness[]
  readonly limitations: readonly string[]
  readonly observedAt: string
  readonly capabilityDigest: string
}

export class GaepHostError extends Error {
  override readonly name = "GaepHostError"

  constructor(
    readonly code: number,
    readonly kind: string,
    message: string,
  ) {
    super(message)
  }
}

interface StableHostError {
  readonly code: number
  readonly message: string
}

const stableHostErrors = new Map<string, StableHostError>([
  ["PORTABLE_DESIGN_SOURCE_INVALID", {
    code: -32_030,
    message: "The local portable design bundle did not pass bounded validation.",
  }],
  ["PORTABLE_DESIGN_PRODUCT_CONTEXT_CHANGED", {
    code: -32_031,
    message: "The portable design request no longer matches the exact Product revision.",
  }],
  ["PORTABLE_DESIGN_AUDIT_INVALID", {
    code: -32_032,
    message: "GAEP could not verify the governed audit boundary for this portable design request.",
  }],
  ["PORTABLE_DESIGN_INTEGRITY_INVALID", {
    code: -32_033,
    message: "GAEP could not verify the portable design snapshot inventory and metadata.",
  }],
  ["PORTABLE_DESIGN_CONFLICT", {
    code: -32_034,
    message: "The portable design snapshot identity conflicts with governed inventory.",
  }],
  ["PORTABLE_DESIGN_NOT_FOUND", {
    code: -32_035,
    message: "The requested portable design snapshot does not exist in the current Product.",
  }],
  ["INVALID_CAPABILITY_SNAPSHOT", {
    code: -32_010,
    message: "The GAEP engine could not verify the agent capability snapshot.",
  }],
  ["CAPABILITIES_NOT_AVAILABLE", {
    code: -32_011,
    message: "The GAEP engine could not observe agent capabilities.",
  }],
  ["EXECUTABLE_UNAVAILABLE", {
    code: -32_013,
    message: "The configured agent executable is unavailable.",
  }],
  ["EXECUTABLE_CHANGED", {
    code: -32_014,
    message: "The configured agent executable changed during capability discovery.",
  }],
  ["AGENT_SELECTION_ACTIVE_RUN", {
    code: -32_015,
    message: "Agent selection cannot change while a Run is non-terminal.",
  }],
  ["AGENT_SELECTION_MIGRATION_REQUIRED", {
    code: -32_016,
    message: "The legacy Agent Selection requires explicit re-probe and reconfirmation.",
  }],
  ["AGENT_SELECTION_HANDOFF_REQUIRED", {
    code: -32_017,
    message: "A versioned handoff is required before changing agent, model, or settings after a Run.",
  }],
  ["AGENT_SELECTION_INVALID", {
    code: -32_018,
    message: "The persisted Agent Selection is invalid and cannot be replaced implicitly.",
  }],
  ["CAPABILITIES_CHANGED", {
    code: -32_012,
    message: "Agent capabilities changed during selection; probe again.",
  }],
  ["MANAGED_READ_ONLY_PREVIEW_CHANGED", {
    code: -32_022,
    message: "The managed read-only preview changed before execution; review the current preview.",
  }],
  ["MANAGED_READ_ONLY_RECEIPT_INVALID", {
    code: -32_023,
    message: "GAEP could not verify the managed read-only terminal evidence.",
  }],
  ["MANAGED_EVIDENCE_AUDIT_INVALID", {
    code: -32_024,
    message: "Managed Run evidence is unavailable because the governed audit chain is invalid.",
  }],
  ["MANAGED_EVIDENCE_SNAPSHOT_CHANGED", {
    code: -32_025,
    message: "Managed Run inventory changed during pagination; reload the first page.",
  }],
  ["MANAGED_EVIDENCE_INVENTORY_INVALID", {
    code: -32_026,
    message: "GAEP could not verify the bounded Managed Run inventory.",
  }],
  ["MANAGED_EVIDENCE_DETAIL_INVALID", {
    code: -32_027,
    message: "GAEP could not verify the exact Managed Run evidence detail.",
  }],
  ["MANAGED_REVIEW_AUDIT_INVALID", {
    code: -32_028,
    message: "Managed Run review is unavailable because the governed audit chain is invalid.",
  }],
  ["MANAGED_REVIEW_CHANGED", {
    code: -32_029,
    message: "The Managed Run review changed before the decision; open and review the current exact inventory.",
  }],
  ["MANAGED_REVIEW_INVALID", {
    code: -32_036,
    message: "GAEP could not verify an exact pending Managed Run review.",
  }],
  ["MANAGED_REVIEW_APPLY_FAILED", {
    code: -32_037,
    message: "The exact Managed Run apply transition could not be verified; reload the review before any retry.",
  }],
  ["MANAGED_REVIEW_DISCARD_FAILED", {
    code: -32_038,
    message: "The exact Managed Run discard transition could not be verified; reload the review before any retry.",
  }],
  ["DASHBOARD_PRODUCT_CONTEXT_CHANGED", {
    code: -32_039,
    message: "The Product changed before the phase dashboard was composed; reload the current Product.",
  }],
  ["CHANGE_IMPACT_PRODUCT_CONTEXT_CHANGED", {
    code: -32_040,
    message: "The Product changed before the Change/Impact projection was composed; reload the current Product.",
  }],
  ["CHANGE_IMPACT_CHANGE_CONTEXT_CHANGED", {
    code: -32_041,
    message: "The Change changed before the Change/Impact projection was composed; select the current Change again.",
  }],
  ["CHANGE_IMPACT_AUDIT_INVALID", {
    code: -32_042,
    message: "The Change/Impact projection is unavailable because the governed audit chain is invalid.",
  }],
  ["CHANGE_IMPACT_CATALOG_INVALID", {
    code: -32_043,
    message: "The current Change catalog could not be verified.",
  }],
  ["INVALID_PARAMS", {
    code: -32_602,
    message: "The GAEP engine rejected the local request parameters.",
  }],
  ["PROTOCOL_UPGRADE_REQUIRED", {
    code: -32_021,
    message: "The GAEP engine requires protocol version 2 for portable design requests.",
  }],
  ["UNSUPPORTED_PROTOCOL_VERSION", {
    code: -32_020,
    message: "The GAEP engine does not support the requested portable design protocol version.",
  }],
  ["FRAME_TOO_LARGE", {
    code: -32_001,
    message: "The GAEP engine rejected a frame that exceeded the protocol boundary.",
  }],
  ["RESPONSE_TOO_LARGE", {
    code: -32_002,
    message: "The GAEP engine response exceeded the protocol boundary.",
  }],
  ["INVALID_UTF8", {
    code: -32_700,
    message: "The GAEP engine response was not valid UTF-8.",
  }],
])

export function invalidHostResponse(): GaepHostError {
  return new GaepHostError(
    -32_603,
    "HOST_RESPONSE_INVALID",
    "The GAEP engine returned a local response that could not be verified.",
  )
}

export function hostUnavailable(): GaepHostError {
  return new GaepHostError(
    -32_603,
    "HOST_UNAVAILABLE",
    "The local GAEP engine could not complete the request.",
  )
}

export function responseTooLarge(): GaepHostError {
  return new GaepHostError(
    -32_002,
    "RESPONSE_TOO_LARGE",
    "The GAEP engine response exceeded the configured frame boundary.",
  )
}

export function invalidUtf8(): GaepHostError {
  return new GaepHostError(-32_700, "INVALID_UTF8", "The GAEP engine response was not valid UTF-8.")
}

export function frameTooLarge(): GaepHostError {
  return new GaepHostError(
    -32_001,
    "FRAME_TOO_LARGE",
    "The GAEP engine request exceeded the configured frame boundary.",
  )
}

export function normalizeActorId(actorId: string): string {
  if (actorId.length > 256) throw new TypeError("Actor ID must be a portable human principal")
  const normalized = actorId.trim()
  if (!normalized || normalized.length > 256 || !actorIdPattern.test(normalized)) {
    throw new TypeError("Actor ID must be a portable human principal")
  }
  return normalized
}

export function normalizeUuid(value: string, label: string): string {
  if (!uuidPattern.test(value) || value.toLowerCase() === emptyUuid) {
    throw new TypeError(`${label} must be a non-empty UUID`)
  }
  return value.toLowerCase()
}

export function validateProductRevision(revision: number): number {
  if (!Number.isSafeInteger(revision) || revision < 1 || revision > maximumSafeProductRevision) {
    throw new RangeError("Product revision must be a positive protocol-safe integer")
  }
  return revision
}

export function validatePage(offset: number, limit: number): void {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > maximumOffset) {
    throw new RangeError("Portable design offset must be between 0 and 10000")
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > maximumPageSize) {
    throw new RangeError("Portable design limit must be between 1 and 200")
  }
}

export async function normalizeExistingLocalFolder(rawPath: string): Promise<string> {
  if (!rawPath || rawPath.length > 32_768 || rawPath.includes("\0") || !isAbsolute(rawPath) || isNetworkPath(rawPath)) {
    throw new TypeError("Portable design bundle root must be an absolute local folder")
  }
  const normalized = resolve(rawPath)
  let metadata
  try {
    metadata = await stat(normalized)
  } catch {
    throw new TypeError("Portable design bundle root must be an existing local folder")
  }
  if (!metadata.isDirectory()) throw new TypeError("Portable design bundle root must be an existing local folder")
  return normalized
}

export function parseHostResult(raw: string, expectedId: number): unknown {
  const envelope = requireRecord(parseStrictJson(raw))
  if (requireString(envelope, "jsonrpc") !== "2.0" || requireSafeInteger(envelope, "id") !== expectedId) {
    throw invalidHostResponse()
  }
  if (Object.hasOwn(envelope, "error")) {
    requireExactKeys(envelope, ["jsonrpc", "id", "error"])
    throw parseHostError(requireRecord(envelope.error))
  }
  requireExactKeys(envelope, ["jsonrpc", "id", "result"])
  if (!Object.hasOwn(envelope, "result")) throw invalidHostResponse()
  return envelope.result
}

export function parseProductBinding(result: unknown): ProductBinding {
  const product = requireRecord(result)
  const id = normalizeUuid(requireString(product, "id"), "Product ID")
  const name = requireString(product, "name")
  if (!name.trim() || name !== name.trim() || name.length > 240 || containsControl(name)) throw invalidHostResponse()
  const revision = Object.hasOwn(product, "revision") ? requireSafeInteger(product, "revision") : 1
  validateProductRevision(revision)
  return Object.freeze({ id, name, revision, digest: canonicalDigest(product) })
}

export function normalizeDeliveryPhaseId(value: unknown): DeliveryPhaseId {
  if (typeof value !== "string" || !deliveryPhaseIds.includes(value as DeliveryPhaseId)) {
    throw new TypeError("Delivery phase is not supported by this GAEP client")
  }
  return value as DeliveryPhaseId
}

export function parsePhaseDashboardFramework(
  result: unknown,
  expected: { readonly phase: DeliveryPhaseId; readonly product: ProductBinding },
): PhaseDashboardFramework {
  const framework = requireRecord(result)
  requireExactKeys(framework, [
    "schemaVersion", "kind", "catalogVersion", "product", "phase", "panels", "observedAt", "sourceBoundary",
    "limitations", "authorityBoundary", "compositionDigest",
  ])
  if (requireSafeInteger(framework, "schemaVersion") !== 1 ||
      requireString(framework, "kind") !== "phase-dashboard-framework" ||
      requireString(framework, "catalogVersion") !== "gaep-phase-dashboards-v1" ||
      requireString(framework, "sourceBoundary") !== "governed-repository-and-engine-only" ||
      requireString(framework, "authorityBoundary") !== "dashboard-is-a-projection-not-phase-approval-readiness-or-applicability-evidence") {
    throw invalidHostResponse()
  }
  const product = requireRecord(framework.product)
  requireExactKeys(product, ["recordType", "recordId", "revision", "digest"])
  const productBinding = Object.freeze({
    recordType: "product" as const,
    recordId: normalizeUuid(requireString(product, "recordId"), "Dashboard Product ID"),
    revision: validateProductRevision(requireSafeInteger(product, "revision")),
    digest: requireDigest(product, "digest"),
  })
  if (requireString(product, "recordType") !== "product" || productBinding.recordId !== expected.product.id ||
      productBinding.revision !== expected.product.revision || productBinding.digest !== expected.product.digest) {
    throw invalidHostResponse()
  }
  const phase = requireRecord(framework.phase)
  requireExactKeys(phase, ["id", "label"])
  const phaseId = requireEnum(phase, "id", deliveryPhaseIds)
  const definition = deliveryPhaseCatalog[phaseId]
  if (phaseId !== expected.phase || requireString(phase, "label") !== definition[0]) throw invalidHostResponse()
  if (!Array.isArray(framework.panels) || framework.panels.length !== 3) throw invalidHostResponse()
  const expectedPanelIds = [definition[1], "change-impact", "agent-model"] as const
  const panels = Object.freeze(framework.panels.map((value, index) =>
    parsePhaseDashboardPanel(value, expectedPanelIds[index]!)))
  if (!Array.isArray(framework.limitations) || framework.limitations.length < 1 || framework.limitations.length > 8) {
    throw invalidHostResponse()
  }
  const limitations = Object.freeze(framework.limitations.map((value) => portableText(value, 4, 1_000)))
  const content = Object.freeze({
    schemaVersion: 1 as const,
    kind: "phase-dashboard-framework" as const,
    catalogVersion: "gaep-phase-dashboards-v1" as const,
    product: productBinding,
    phase: Object.freeze({ id: phaseId, label: definition[0] }),
    panels,
    observedAt: requireTimestamp(framework, "observedAt"),
    sourceBoundary: "governed-repository-and-engine-only" as const,
    limitations,
    authorityBoundary: "dashboard-is-a-projection-not-phase-approval-readiness-or-applicability-evidence" as const,
  })
  const compositionDigest = requireDigest(framework, "compositionDigest")
  if (compositionDigest !== canonicalDigest(content)) throw invalidHostResponse()
  return Object.freeze({ ...content, compositionDigest })
}

export function parseChangeImpactChangeCatalog(
  result: unknown,
  expectedProduct: ProductBinding,
): ChangeImpactChangeCatalog {
  const catalog = requireRecord(result)
  requireExactKeys(catalog, [
    "schemaVersion", "kind", "product", "items", "total", "omitted", "observedAt", "sourceBoundary",
    "limitations", "authorityBoundary", "snapshotDigest",
  ])
  if (requireSafeInteger(catalog, "schemaVersion") !== 1 ||
      requireString(catalog, "kind") !== "change-impact-change-catalog" ||
      requireString(catalog, "sourceBoundary") !== "current-governed-change-metadata-only" ||
      requireString(catalog, "authorityBoundary") !== "change-catalog-selection-does-not-approve-change-or-authorize-effects") {
    throw invalidHostResponse()
  }
  const product = parseChangeImpactExactReference(catalog.product, "product") as ChangeImpactChangeCatalog["product"]
  if (product.recordId !== expectedProduct.id || product.revision !== expectedProduct.revision ||
      product.digest !== expectedProduct.digest) throw invalidHostResponse()
  if (!Array.isArray(catalog.items) || catalog.items.length > 256) throw invalidHostResponse()
  const items = Object.freeze(catalog.items.map(parseChangeImpactChangeReference))
  if (new Set(items.map((item) => item.recordId)).size !== items.length ||
      items.some((item, index) => index > 0 && items[index - 1]!.recordId >= item.recordId)) throw invalidHostResponse()
  const total = nonNegativeInteger(catalog, "total", 1_000_000)
  const omitted = nonNegativeInteger(catalog, "omitted", 1_000_000)
  if (items.length + omitted !== total) throw invalidHostResponse()
  const limitations = parseChangeImpactLimitations(catalog.limitations)
  const content = Object.freeze({
    schemaVersion: 1 as const,
    kind: "change-impact-change-catalog" as const,
    product,
    items,
    total,
    omitted,
    observedAt: requireTimestamp(catalog, "observedAt"),
    sourceBoundary: "current-governed-change-metadata-only" as const,
    limitations,
    authorityBoundary: "change-catalog-selection-does-not-approve-change-or-authorize-effects" as const,
  })
  const snapshotDigest = requireDigest(catalog, "snapshotDigest")
  if (snapshotDigest !== canonicalDigest(content)) throw invalidHostResponse()
  return Object.freeze({ ...content, snapshotDigest })
}

export function parseChangeImpactDashboard(
  result: unknown,
  expected: { readonly product: ProductBinding; readonly change: ChangeImpactChangeReference },
): ChangeImpactDashboard {
  const dashboard = requireRecord(result)
  requireExactKeys(dashboard, [
    "schemaVersion", "kind", "product", "change", "workItems", "changedArtifacts", "effectTargets",
    "affectedUnits", "governance", "freshness", "limits", "observedAt", "sourceBoundary", "limitations",
    "authorityBoundary", "snapshotDigest",
  ])
  if (requireSafeInteger(dashboard, "schemaVersion") !== 1 || requireString(dashboard, "kind") !== "change-impact-dashboard" ||
      requireString(dashboard, "sourceBoundary") !== "current-governed-records-and-bounded-trace-analysis" ||
      requireString(dashboard, "authorityBoundary") !== "change-impact-dashboard-does-not-approve-change-accept-risk-or-authorize-effects") {
    throw invalidHostResponse()
  }
  const product = parseChangeImpactExactReference(dashboard.product, "product") as ChangeImpactDashboard["product"]
  if (product.recordId !== expected.product.id || product.revision !== expected.product.revision ||
      product.digest !== expected.product.digest) throw invalidHostResponse()
  const change = parseChangeImpactChangeReference(dashboard.change)
  if (change.recordId !== expected.change.recordId || change.revision !== expected.change.revision ||
      change.digest !== expected.change.digest || change.state !== expected.change.state ||
      JSON.stringify(change.effectEnvelope) !== JSON.stringify(expected.change.effectEnvelope)) throw invalidHostResponse()

  const workItems = parseChangeImpactArray(dashboard.workItems, 256, (value) => {
    const row = requireRecord(value)
    requireExactKeys(row, ["record", "state"])
    return Object.freeze({
      record: parseChangeImpactExactReference(row.record, "work-item") as ChangeImpactDashboard["workItems"][number]["record"],
      state: requireEnum(row, "state", changeImpactWorkItemStates),
    })
  })
  const parseArtifact = (value: unknown): ChangeImpactDashboard["changedArtifacts"][number] => {
    const row = requireRecord(value)
    requireExactKeys(row, ["sourceWorkItem", "locator"])
    return Object.freeze({
      sourceWorkItem: parseChangeImpactExactReference(row.sourceWorkItem, "work-item") as
        ChangeImpactDashboard["changedArtifacts"][number]["sourceWorkItem"],
      locator: parseChangeImpactLocator(row.locator),
    })
  }
  const changedArtifacts = parseChangeImpactArray(dashboard.changedArtifacts, 512, parseArtifact)
  const effectTargets = parseChangeImpactArray(dashboard.effectTargets, 512, parseArtifact)
  const affectedUnits = parseChangeImpactArray(dashboard.affectedUnits, 512, parseChangeImpactAffectedUnit)
  const governance = parseChangeImpactGovernance(dashboard.governance)
  const freshness = parseChangeImpactFreshness(dashboard.freshness)
  const limits = parseChangeImpactLimits(dashboard.limits)
  const categories = [
    [workItems, limits.workItems],
    [changedArtifacts, limits.changedArtifacts],
    [effectTargets, limits.effectTargets],
    [affectedUnits, limits.affectedUnits],
    [governance.decisions, limits.decisions],
    [governance.risks, limits.risks],
  ] as const
  if (categories.some(([rows, limit]) => limit.shown !== rows.length)) throw invalidHostResponse()
  const truncated = freshness.traceAnalysisTruncated || categories.some(([, limit]) => limit.omitted > 0)
  const attentionRequired = truncated || freshness.unresolvedTraceLinks > 0 || freshness.invalidTraceLinks > 0 ||
    freshness.staleTraceLinks > 0 || freshness.staleGovernanceReferences > 0
  const observedAt = requireTimestamp(dashboard, "observedAt")
  if (limits.truncated !== truncated || (freshness.state === "attention-required") !== attentionRequired ||
      Date.parse(freshness.evaluatedAt) > Date.parse(observedAt)) throw invalidHostResponse()
  ensureUniqueChangeImpactRows(workItems, changedArtifacts, effectTargets, affectedUnits, governance)
  const content = Object.freeze({
    schemaVersion: 1 as const,
    kind: "change-impact-dashboard" as const,
    product,
    change,
    workItems,
    changedArtifacts,
    effectTargets,
    affectedUnits,
    governance,
    freshness,
    limits,
    observedAt,
    sourceBoundary: "current-governed-records-and-bounded-trace-analysis" as const,
    limitations: parseChangeImpactLimitations(dashboard.limitations),
    authorityBoundary: "change-impact-dashboard-does-not-approve-change-accept-risk-or-authorize-effects" as const,
  })
  const snapshotDigest = requireDigest(dashboard, "snapshotDigest")
  if (snapshotDigest !== canonicalDigest(content)) throw invalidHostResponse()
  return Object.freeze({ ...content, snapshotDigest })
}

export function parseAgentModelDashboard(
  result: unknown,
  expected: {
    readonly product: ProductBinding
    readonly capabilities: readonly AgentReadinessSnapshot[]
    readonly selection: AgentSelectionState
  },
): AgentModelDashboard {
  const dashboard = requireRecord(result)
  requireExactKeys(dashboard, [
    "schemaVersion", "kind", "product", "capabilities", "selection", "runs", "handoffs", "providerMetrics",
    "freshness", "limits", "observedAt", "sourceBoundary", "limitations", "authorityBoundary", "snapshotDigest",
  ])
  if (requireSafeInteger(dashboard, "schemaVersion") !== 1 || requireString(dashboard, "kind") !== "agent-model-dashboard" ||
      requireString(dashboard, "sourceBoundary") !== "current-governed-agent-selection-run-handoff-and-managed-evidence-metadata" ||
      requireString(dashboard, "authorityBoundary") !== "agent-model-dashboard-does-not-select-switch-handoff-launch-or-authorize-effects") {
    throw invalidHostResponse()
  }
  const product = parseAgentModelReference(dashboard.product, "product") as AgentModelDashboard["product"]
  if (product.recordId !== expected.product.id || product.revision !== expected.product.revision ||
      product.digest !== expected.product.digest) throw invalidHostResponse()
  if (!Array.isArray(dashboard.capabilities) || dashboard.capabilities.length < 1 || dashboard.capabilities.length > 16 ||
      dashboard.capabilities.length !== expected.capabilities.length) throw invalidHostResponse()
  const expectedCapabilities = new Map(expected.capabilities.map((entry) => [`${entry.adapterId}:${entry.agentId}`, entry]))
  const capabilities = Object.freeze(dashboard.capabilities.map((entry) => {
    const row = requireRecord(entry)
    const key = `${requireString(row, "adapterId")}:${requireString(row, "agentId")}`
    const expectedCapability = expectedCapabilities.get(key)
    if (!expectedCapability) throw invalidHostResponse()
    return parseAgentModelCapability(row, expectedCapability)
  }))
  if (new Set(capabilities.map((entry) => `${entry.adapterId}:${entry.agentId}`)).size !== capabilities.length ||
      capabilities.some((entry, index) => index > 0 &&
        `${capabilities[index - 1]!.adapterId}:${capabilities[index - 1]!.agentId}` >= `${entry.adapterId}:${entry.agentId}`)) {
    throw invalidHostResponse()
  }
  const selection = parseAgentModelSelection(dashboard.selection, expected.selection, capabilities)
  if (!Array.isArray(dashboard.runs) || dashboard.runs.length > 256 || !Array.isArray(dashboard.handoffs) || dashboard.handoffs.length > 256) {
    throw invalidHostResponse()
  }
  const runs = Object.freeze(dashboard.runs.map(parseAgentModelRun))
  const handoffs = Object.freeze(dashboard.handoffs.map(parseAgentModelHandoff))
  if (new Set(runs.map((entry) => entry.record.recordId)).size !== runs.length ||
      new Set(handoffs.map((entry) => entry.record.recordId)).size !== handoffs.length ||
      new Set(runs.flatMap((entry) => entry.managed.status === "observed" ? [entry.managed.record.recordId] : [])).size !==
        runs.filter((entry) => entry.managed.status === "observed").length) throw invalidHostResponse()
  const providerMetrics = parseAgentModelMetrics(dashboard.providerMetrics)
  const freshness = parseAgentModelFreshness(dashboard.freshness)
  const limits = parseAgentModelLimits(dashboard.limits)
  const categories = [[capabilities, limits.capabilities], [runs, limits.runs], [handoffs, limits.handoffs]] as const
  if (categories.some(([rows, limit]) => rows.length !== limit.shown)) throw invalidHostResponse()
  const truncated = categories.some(([, limit]) => limit.omitted > 0) || limits.managedRuns.omitted > 0
  const selectionCapabilityState = selection.status === "selected" ? selection.capabilityState : selection.status
  const attentionRequired = truncated || ["stale", "migration-required", "invalid"].includes(selectionCapabilityState)
  const selectedCapabilities = capabilities.filter((entry) => entry.selected)
  if (freshness.selectionCapabilityState !== selectionCapabilityState || freshness.truncated !== truncated ||
      limits.truncated !== truncated || (freshness.state === "attention-required") !== attentionRequired) throw invalidHostResponse()
  if (selection.status === "selected") {
    if (selectedCapabilities.length !== 1 || selectedCapabilities[0]?.adapterId !== selection.adapterId ||
        selectedCapabilities[0]?.agentId !== selection.agentId ||
        ((selectedCapabilities[0]?.capabilityDigest === selection.capabilityDigest) !== (selection.capabilityState === "current"))) {
      throw invalidHostResponse()
    }
  } else if (selectedCapabilities.length !== 0) throw invalidHostResponse()
  const runIds = new Set(runs.map((entry) => entry.record.recordId))
  if (limits.runs.omitted === 0 && handoffs.some((entry) => !runIds.has(entry.fromRun.recordId))) throw invalidHostResponse()
  const observedAt = requireTimestamp(dashboard, "observedAt")
  if (Date.parse(freshness.oldestCapabilityObservedAt) > Date.parse(freshness.newestCapabilityObservedAt) ||
      Date.parse(freshness.newestCapabilityObservedAt) > Date.parse(observedAt)) throw invalidHostResponse()
  const limitations = parseChangeImpactLimitations(dashboard.limitations)
  const content = Object.freeze({
    schemaVersion: 1 as const,
    kind: "agent-model-dashboard" as const,
    product,
    capabilities,
    selection,
    runs,
    handoffs,
    providerMetrics,
    freshness,
    limits,
    observedAt,
    sourceBoundary: "current-governed-agent-selection-run-handoff-and-managed-evidence-metadata" as const,
    limitations,
    authorityBoundary: "agent-model-dashboard-does-not-select-switch-handoff-launch-or-authorize-effects" as const,
  })
  const snapshotDigest = requireDigest(dashboard, "snapshotDigest")
  if (snapshotDigest !== canonicalDigest(content)) throw invalidHostResponse()
  return Object.freeze({ ...content, snapshotDigest })
}

export function parseAgentReadiness(result: unknown): readonly AgentReadinessSnapshot[] {
  if (!Array.isArray(result) || result.length < 1 || result.length > 16) throw invalidHostResponse()
  const snapshots = result.map((entry) => parseAgentReadinessSnapshot(requireRecord(entry)))
  if (new Set(snapshots.map((snapshot) => snapshot.adapterId)).size !== snapshots.length ||
    new Set(snapshots.map((snapshot) => snapshot.agentId)).size !== snapshots.length) {
    throw invalidHostResponse()
  }
  return Object.freeze(snapshots.sort((left, right) => left.agentLabel.localeCompare(right.agentLabel)))
}

export function parseAgentSelectionState(result: unknown): AgentSelectionState {
  const state = requireRecord(result)
  const status = requireString(state, "status")
  if (status === "unselected" || status === "invalid") {
    requireExactKeys(state, ["status"])
    return Object.freeze({ status })
  }
  if (status === "selected") {
    requireExactKeys(state, ["status", "selection"])
    return Object.freeze({ status, selection: parseAgentSelection(state.selection) })
  }
  if (status === "migration-required") {
    requireExactKeys(state, ["status", "portableCandidate"])
    return Object.freeze({ status, portableCandidate: parseAgentSelection(state.portableCandidate) })
  }
  throw invalidHostResponse()
}

export function parseAgentSelection(result: unknown): AgentSelection {
  const selection = requireRecord(result)
  requireExactKeys(selection, [
    "schemaVersion", "adapterId", "agentId", "modelId", "modelTruthClass", "modelAlias", "settings",
    "selectedAt", "capabilityDigest",
  ])
  if (requireSafeInteger(selection, "schemaVersion") !== 2) throw invalidHostResponse()
  const modelAlias = selection.modelAlias
  if (modelAlias !== null && typeof modelAlias !== "boolean") throw invalidHostResponse()
  const capabilityDigest = requireString(selection, "capabilityDigest")
  if (!/^sha256:[0-9a-f]{64}$/u.test(capabilityDigest)) throw invalidHostResponse()
  return Object.freeze({
    schemaVersion: 2,
    adapterId: requirePortableText(selection, "adapterId", 1),
    agentId: requirePortableText(selection, "agentId", 1),
    modelId: requirePortableText(selection, "modelId", 1),
    modelTruthClass: requireTruthClass(selection, "modelTruthClass"),
    modelAlias,
    settings: parsePortableSelectionSettings(selection.settings),
    selectedAt: requireTimestamp(selection, "selectedAt"),
    capabilityDigest,
  })
}

export function parseAgentRuns(result: unknown): readonly AgentRun[] {
  if (!Array.isArray(result) || result.length > 512) throw invalidHostResponse()
  const runs = Object.freeze(result.map((value) => parseAgentRun(requireRecord(value))))
  if (new Set(runs.map((run) => run.id)).size !== runs.length) throw invalidHostResponse()
  return runs
}

export function parseAgentHandoff(
  result: unknown,
  expected: {
    readonly fromRunId: string
    readonly productId: string
    readonly initiativeId: string
    readonly toAdapterId: string
    readonly toAgentId: string
    readonly toModelId: string
    readonly toSettings: Readonly<Record<string, PortableAgentSettingValue>>
    readonly reason: string
    readonly completedWork: readonly string[]
    readonly unresolvedMatters: readonly string[]
    readonly decisions: readonly string[]
    readonly evidence: readonly string[]
  },
): AgentHandoff {
  const handoff = requireRecord(result)
  requireKeys(
    handoff,
    [
      "schemaVersion", "id", "productId", "initiativeId", "fromRunId", "toAgent", "reason",
      "workspaceBaseline", "completedWork", "unresolvedMatters", "decisions", "evidence",
      "capabilityDifferences", "createdAt",
    ],
    ["acknowledgedAt"],
  )
  if (requireSafeInteger(handoff, "schemaVersion") !== 1) throw invalidHostResponse()
  const fromRunId = normalizeUuid(requireString(handoff, "fromRunId"), "Source Run ID")
  const toAgent = parseAgentSelection(handoff.toAgent)
  const productId = normalizeUuid(requireString(handoff, "productId"), "Product ID")
  const initiativeId = normalizeUuid(requireString(handoff, "initiativeId"), "Initiative ID")
  if (fromRunId !== normalizeUuid(expected.fromRunId, "Source Run ID") ||
    productId !== normalizeUuid(expected.productId, "Product ID") ||
    initiativeId !== normalizeUuid(expected.initiativeId, "Initiative ID") ||
    toAgent.adapterId !== expected.toAdapterId || toAgent.agentId !== expected.toAgentId ||
    toAgent.modelId !== expected.toModelId ||
    JSON.stringify(sortedPortableSettings(toAgent.settings)) !== JSON.stringify(sortedPortableSettings(expected.toSettings))) {
    throw invalidHostResponse()
  }
  const baseline = parseHandoffWorkspaceBaseline(requireRecord(handoff.workspaceBaseline))
  const reason = portableHandoffText(handoff.reason, 2)
  const completedWork = parseHandoffTextArray(handoff.completedWork)
  const unresolvedMatters = parseHandoffTextArray(handoff.unresolvedMatters)
  const decisions = parseHandoffTextArray(handoff.decisions)
  const evidence = parseHandoffTextArray(handoff.evidence)
  if (reason !== expected.reason || JSON.stringify(completedWork) !== JSON.stringify(expected.completedWork) ||
    JSON.stringify(unresolvedMatters) !== JSON.stringify(expected.unresolvedMatters) ||
    JSON.stringify(decisions) !== JSON.stringify(expected.decisions) ||
    JSON.stringify(evidence) !== JSON.stringify(expected.evidence)) {
    throw invalidHostResponse()
  }
  const acknowledgedAt = Object.hasOwn(handoff, "acknowledgedAt")
    ? requireTimestamp(handoff, "acknowledgedAt")
    : undefined
  const parsed: AgentHandoff = {
    schemaVersion: 1,
    id: normalizeUuid(requireString(handoff, "id"), "Handoff ID"),
    productId,
    initiativeId,
    fromRunId,
    toAgent,
    reason,
    workspaceBaseline: baseline,
    completedWork,
    unresolvedMatters,
    decisions,
    evidence,
    capabilityDifferences: parseHandoffTextArray(handoff.capabilityDifferences),
    createdAt: requireTimestamp(handoff, "createdAt"),
    ...(acknowledgedAt !== undefined ? { acknowledgedAt } : {}),
  }
  return Object.freeze(parsed)
}

export function parseManagedReadOnlyPreview(result: unknown, expected: {
  readonly charterId: string
  readonly workflowPlanId: string
}): ManagedReadOnlyPreview {
  const preview = requireRecord(result)
  requireExactKeys(preview, [
    "schemaVersion", "kind", "productId", "initiativeId", "charterId", "charterDigest", "workflowPlanId",
    "workflowPlanDigest", "adapterId", "agentId", "modelId", "selectionDigest", "strategy", "stepIds",
    "contextPackCount", "readScopeCount", "gates", "authorityBoundary", "previewDigest",
  ])
  if (requireSafeInteger(preview, "schemaVersion") !== 1 || requireString(preview, "kind") !== "managed-readonly-preview" ||
    requireString(preview, "authorityBoundary") !== "managed-readonly-preview-does-not-grant-execution-or-effect-authority") {
    throw invalidHostResponse()
  }
  const charterId = normalizeUuid(requireString(preview, "charterId"), "Charter ID")
  const workflowPlanId = normalizeUuid(requireString(preview, "workflowPlanId"), "Workflow Plan ID")
  if (charterId !== normalizeUuid(expected.charterId, "Charter ID") ||
    workflowPlanId !== normalizeUuid(expected.workflowPlanId, "Workflow Plan ID")) throw invalidHostResponse()
  const strategy = requireString(preview, "strategy")
  if (!(strategy === "sequential" || strategy === "parallel-readonly")) throw invalidHostResponse()
  if (!Array.isArray(preview.stepIds) || preview.stepIds.length < 1 || preview.stepIds.length > 512 ||
    !Array.isArray(preview.gates) || preview.gates.length < 2 || preview.gates.length > 2_050) throw invalidHostResponse()
  const stepIds = Object.freeze(preview.stepIds.map((value) => normalizeUuidValue(value, "Workflow Step ID")))
  if (new Set(stepIds).size !== stepIds.length) throw invalidHostResponse()
  const gates = Object.freeze(preview.gates.map((value) => parseManagedReadOnlyGate(value, new Set(stepIds))))
  if (new Set(gates.map((gate) => gate.key)).size !== gates.length) throw invalidHostResponse()
  const contextPackCount = requireSafeInteger(preview, "contextPackCount")
  const readScopeCount = requireSafeInteger(preview, "readScopeCount")
  if (contextPackCount < 0 || contextPackCount > 512 || readScopeCount < 0 || readScopeCount > 100_000) {
    throw invalidHostResponse()
  }
  const body = {
    schemaVersion: 1,
    kind: "managed-readonly-preview",
    productId: normalizeUuid(requireString(preview, "productId"), "Product ID"),
    initiativeId: normalizeUuid(requireString(preview, "initiativeId"), "Initiative ID"),
    charterId,
    charterDigest: requireDigest(preview, "charterDigest"),
    workflowPlanId,
    workflowPlanDigest: requireDigest(preview, "workflowPlanDigest"),
    adapterId: requirePortableText(preview, "adapterId", 1),
    agentId: requirePortableText(preview, "agentId", 1),
    modelId: requirePortableText(preview, "modelId", 1),
    selectionDigest: requireDigest(preview, "selectionDigest"),
    strategy,
    stepIds,
    contextPackCount,
    readScopeCount,
    gates,
    authorityBoundary: "managed-readonly-preview-does-not-grant-execution-or-effect-authority",
  } as const
  const previewDigest = requireDigest(preview, "previewDigest")
  if (previewDigest !== canonicalDigest(body)) throw invalidHostResponse()
  return Object.freeze({ ...body, previewDigest })
}

export function parseManagedReadOnlyReceipt(result: unknown, preview: ManagedReadOnlyPreview): ManagedReadOnlyReceipt {
  const receipt = requireRecord(result)
  requireExactKeys(receipt, [
    "schemaVersion", "kind", "previewDigest", "runId", "managedRunId", "productId", "initiativeId", "adapterId",
    "agentId", "modelId", "mode", "state", "providerDisposition", "outcomeStatus", "outcomeBasis", "eventCount",
    "completedStepCount", "totalStepCount", "resultDigest", "evidenceDigest", "warnings", "startedAt", "endedAt",
    "authorityBoundary",
  ])
  if (requireSafeInteger(receipt, "schemaVersion") !== 1 || requireString(receipt, "kind") !== "managed-readonly-receipt" ||
    requireString(receipt, "authorityBoundary") !== "managed-readonly-receipt-does-not-grant-tool-write-effect-or-outcome-authority") {
    throw invalidHostResponse()
  }
  const previewDigest = requireDigest(receipt, "previewDigest")
  const productId = normalizeUuid(requireString(receipt, "productId"), "Product ID")
  const initiativeId = normalizeUuid(requireString(receipt, "initiativeId"), "Initiative ID")
  const adapterId = requirePortableText(receipt, "adapterId", 1)
  const agentId = requirePortableText(receipt, "agentId", 1)
  const modelId = requirePortableText(receipt, "modelId", 1)
  if (previewDigest !== preview.previewDigest || productId !== preview.productId || initiativeId !== preview.initiativeId ||
    adapterId !== preview.adapterId || agentId !== preview.agentId || modelId !== preview.modelId) throw invalidHostResponse()
  const mode = requireEnum(receipt, "mode", ["codex-staged", "manual-offline", "claude-context-only"] as const)
  const state = requireEnum(receipt, "state", [
    "review-required", "completed", "failed", "cancelled", "timed-out", "unknown", "conflict", "discarded",
  ] as const)
  const providerDisposition = requireEnum(receipt, "providerDisposition", [
    "completed", "failed", "cancelled", "interrupted", "crashed", "protocol-error", "unknown",
  ] as const)
  const outcomeStatus = requireEnum(receipt, "outcomeStatus", ["satisfied", "failed", "not-assessed", "indeterminate"] as const)
  const outcomeBasis = requireEnum(receipt, "outcomeBasis", [
    "postcondition-evaluator", "deterministic-offline-runtime", "not-evaluated", "provider-failure",
  ] as const)
  const eventCount = nonNegativeInteger(receipt, "eventCount", 4_096)
  const completedStepCount = nonNegativeInteger(receipt, "completedStepCount", 512)
  const totalStepCount = nonNegativeInteger(receipt, "totalStepCount", 512)
  if (totalStepCount !== preview.stepIds.length || completedStepCount > totalStepCount ||
    (state === "completed" && (providerDisposition !== "completed" || outcomeStatus !== "satisfied"))) {
    throw invalidHostResponse()
  }
  if (!Array.isArray(receipt.warnings) || receipt.warnings.length > 128) throw invalidHostResponse()
  const warningValues = [
    "provider-warning-redacted", "provider-output-redacted", "coordinator-failure", "runtime-output-truncated",
    "staging-read-confinement-unattested", "postcondition-evaluator-failed", "local-cleanup-pending",
    "local-cleanup-failed", "runtime-warning",
  ] as const
  const warnings = Object.freeze(receipt.warnings.map((warning) => {
    if (typeof warning !== "string" || !(warningValues as readonly string[]).includes(warning)) throw invalidHostResponse()
    return warning
  }))
  const startedAt = requireTimestamp(receipt, "startedAt")
  const endedAt = requireTimestamp(receipt, "endedAt")
  if (Date.parse(endedAt) < Date.parse(startedAt)) throw invalidHostResponse()
  return Object.freeze({
    schemaVersion: 1,
    kind: "managed-readonly-receipt",
    previewDigest,
    runId: normalizeUuid(requireString(receipt, "runId"), "Run ID"),
    managedRunId: normalizeUuid(requireString(receipt, "managedRunId"), "Managed Run ID"),
    productId,
    initiativeId,
    adapterId,
    agentId,
    modelId,
    mode,
    state,
    providerDisposition,
    outcomeStatus,
    outcomeBasis,
    eventCount,
    completedStepCount,
    totalStepCount,
    resultDigest: requireDigest(receipt, "resultDigest"),
    evidenceDigest: requireDigest(receipt, "evidenceDigest"),
    warnings,
    startedAt,
    endedAt,
    authorityBoundary: "managed-readonly-receipt-does-not-grant-tool-write-effect-or-outcome-authority",
  })
}

export function parseManagedRunSummaryPage(
  result: unknown,
  expected: {
    readonly offset: number
    readonly limit: number
    readonly snapshotDigest?: string
    readonly total?: number
  },
): ManagedRunSummaryPage {
  const page = requireRecord(result)
  requireExactKeys(page, [
    "schemaVersion", "kind", "items", "offset", "limit", "total", "omittedCount", "snapshotDigest", "hasMore",
    "authorityBoundary", "privacyBoundary",
  ])
  if (requireSafeInteger(page, "schemaVersion") !== 1 || requireString(page, "kind") !== "managed-run-summary-page" ||
    requireString(page, "authorityBoundary") !== managedInventoryBoundary ||
    requireString(page, "privacyBoundary") !== managedEvidencePrivacyBoundary) throw invalidHostResponse()
  const offset = nonNegativeInteger(page, "offset", 2_000)
  const limit = nonNegativeInteger(page, "limit", 200)
  const total = nonNegativeInteger(page, "total", 2_000)
  const omittedCount = nonNegativeInteger(page, "omittedCount", 2_000)
  if (limit < 1 || offset !== expected.offset || limit !== expected.limit ||
    (expected.total !== undefined && total !== expected.total) || !Array.isArray(page.items) ||
    page.items.length > limit || offset + page.items.length > total || omittedCount !== total - page.items.length) {
    throw invalidHostResponse()
  }
  const items = Object.freeze(page.items.map(parseManagedRunSummary))
  if (new Set(items.map((item) => item.managedRunId)).size !== items.length) throw invalidHostResponse()
  const snapshotDigest = requireDigest(page, "snapshotDigest")
  if (expected.snapshotDigest && snapshotDigest !== expected.snapshotDigest) throw invalidHostResponse()
  const hasMore = requireBoolean(page, "hasMore")
  if (hasMore !== (offset + items.length < total) || (hasMore && items.length === 0)) throw invalidHostResponse()
  return Object.freeze({
    schemaVersion: 1,
    kind: "managed-run-summary-page",
    items,
    offset,
    limit,
    total,
    omittedCount,
    snapshotDigest,
    hasMore,
    authorityBoundary: managedInventoryBoundary,
    privacyBoundary: managedEvidencePrivacyBoundary,
  })
}

export function parseManagedEvidenceDetail(result: unknown, expectedManagedRunId: string): ManagedEvidenceDetail {
  const detail = requireRecord(result)
  requireKeys(
    detail,
    ["schemaVersion", "kind", "summary", "artifactStatus", "authorityBoundary", "privacyBoundary"],
    ["result", "evidence", "applyDecision"],
  )
  if (requireSafeInteger(detail, "schemaVersion") !== 1 || requireString(detail, "kind") !== "managed-evidence-detail" ||
    requireString(detail, "authorityBoundary") !== managedEvidenceBoundary ||
    requireString(detail, "privacyBoundary") !== managedEvidencePrivacyBoundary) throw invalidHostResponse()
  const summary = parseManagedRunSummary(detail.summary)
  if (summary.managedRunId !== normalizeUuid(expectedManagedRunId, "Managed Run ID")) throw invalidHostResponse()
  const artifactStatus = requireEnum(detail, "artifactStatus", ["record-only", "verified-result-and-evidence"] as const)
  const hasResult = Object.hasOwn(detail, "result")
  const hasEvidence = Object.hasOwn(detail, "evidence")
  const hasApplyDecision = Object.hasOwn(detail, "applyDecision")
  if (hasResult !== hasEvidence || hasResult !== summary.hasResult || hasApplyDecision !== summary.hasApplyDecision ||
    (artifactStatus === "record-only") !== !hasResult) throw invalidHostResponse()
  const parsedResult = hasResult ? parseManagedEvidenceResult(detail.result, summary) : undefined
  const evidence = hasEvidence ? parseManagedEvidenceProjection(detail.evidence, parsedResult!) : undefined
  const applyDecision = hasApplyDecision ? parseManagedApplyDecisionProjection(detail.applyDecision, summary) : undefined
  return Object.freeze({
    schemaVersion: 1,
    kind: "managed-evidence-detail",
    summary,
    artifactStatus,
    ...(parsedResult ? { result: parsedResult } : {}),
    ...(evidence ? { evidence } : {}),
    ...(applyDecision ? { applyDecision } : {}),
    authorityBoundary: managedEvidenceBoundary,
    privacyBoundary: managedEvidencePrivacyBoundary,
  })
}

export function parseManagedReviewPreview(result: unknown, expectedManagedRunId: string): ManagedReviewPreview {
  const preview = requireRecord(result)
  requireKeys(preview, [
    "schemaVersion", "kind", "managedRunId", "managedRunRevision", "runId", "productId", "initiativeId", "mode",
    "state", "canApply", "canDiscard", "hasLocalJournal", "bindingsDigest", "result", "staging",
    "postApplyGatePolicy", "authorityBoundary", "privacyBoundary", "cleanupBoundary", "previewDigest",
  ], ["applyConfirmation"])
  if (requireSafeInteger(preview, "schemaVersion") !== 1 || requireString(preview, "kind") !== "managed-review-preview" ||
      requireString(preview, "mode") !== "codex-staged" || requireString(preview, "postApplyGatePolicy") !== "record-not-assessed" ||
      requireString(preview, "authorityBoundary") !== managedReviewBoundary ||
      requireString(preview, "privacyBoundary") !== managedReviewPrivacyBoundary ||
      requireString(preview, "cleanupBoundary") !== managedReviewCleanupBoundary) throw invalidHostResponse()
  const managedRunId = normalizeUuidValue(preview.managedRunId, "Managed Run ID")
  if (managedRunId !== normalizeUuid(expectedManagedRunId, "Managed Run ID")) throw invalidHostResponse()
  const managedRunRevision = requireSafeInteger(preview, "managedRunRevision")
  if (managedRunRevision < 1) throw invalidHostResponse()
  const state = requireEnum(preview, "state", ["review-required", "conflict"] as const)
  const canApply = requireBoolean(preview, "canApply")
  const canDiscard = requireBoolean(preview, "canDiscard")
  const hasLocalJournal = requireBoolean(preview, "hasLocalJournal")
  const hasApplyConfirmation = Object.hasOwn(preview, "applyConfirmation")
  if (!canDiscard || canApply !== hasApplyConfirmation || (state === "conflict" && canApply)) throw invalidHostResponse()

  const parsedResult = parseManagedReviewResult(preview.result, state)
  const staging = parseManagedReviewStaging(preview.staging, state)
  if (parsedResult.evidenceId !== staging.evidenceId || parsedResult.evidenceDigest !== staging.evidenceDigest) {
    throw invalidHostResponse()
  }
  const applyConfirmation = hasApplyConfirmation
    ? parseManagedReviewApplyConfirmation(preview.applyConfirmation, staging)
    : undefined
  const body = {
    schemaVersion: 1 as const,
    kind: "managed-review-preview" as const,
    managedRunId,
    managedRunRevision,
    runId: normalizeUuidValue(preview.runId, "Run ID"),
    productId: normalizeUuidValue(preview.productId, "Product ID"),
    initiativeId: normalizeUuidValue(preview.initiativeId, "Initiative ID"),
    mode: "codex-staged" as const,
    state,
    canApply,
    canDiscard: true as const,
    hasLocalJournal,
    bindingsDigest: requireDigest(preview, "bindingsDigest"),
    result: parsedResult,
    staging,
    ...(applyConfirmation ? { applyConfirmation } : {}),
    postApplyGatePolicy: "record-not-assessed" as const,
    authorityBoundary: managedReviewBoundary,
    privacyBoundary: managedReviewPrivacyBoundary,
    cleanupBoundary: managedReviewCleanupBoundary,
  }
  const previewDigest = requireDigest(preview, "previewDigest")
  if (previewDigest !== canonicalDigest(body)) throw invalidHostResponse()
  return Object.freeze({ ...body, previewDigest })
}

export function parseManagedReviewTransition(
  result: unknown,
  preview: ManagedReviewPreview,
  expectedDecision: ManagedReviewTransition["decision"],
): ManagedReviewTransition {
  const transition = requireRecord(result)
  requireExactKeys(transition, [
    "schemaVersion", "kind", "decision", "sourcePreviewDigest", "sourceManagedRunRevision", "managedRunId",
    "managedRunRevision", "state", "canApply", "canDiscard", "hasLocalJournal", "detail", "authorityBoundary",
    "cleanupBoundary", "transitionDigest",
  ])
  if (requireSafeInteger(transition, "schemaVersion") !== 1 ||
      requireString(transition, "kind") !== "managed-review-transition" ||
      requireString(transition, "decision") !== expectedDecision ||
      requireString(transition, "authorityBoundary") !== managedReviewTransitionBoundary ||
      requireString(transition, "cleanupBoundary") !== managedReviewCleanupBoundary ||
      requireDigest(transition, "sourcePreviewDigest") !== preview.previewDigest ||
      requireSafeInteger(transition, "sourceManagedRunRevision") !== preview.managedRunRevision) throw invalidHostResponse()
  const managedRunId = normalizeUuidValue(transition.managedRunId, "Managed Run ID")
  const managedRunRevision = requireSafeInteger(transition, "managedRunRevision")
  if (managedRunId !== preview.managedRunId || managedRunRevision <= preview.managedRunRevision) throw invalidHostResponse()
  const state = requireEnum(transition, "state", [
    "prepared", "running", "review-required", "applying", "completed", "failed", "cancelled", "timed-out", "unknown",
    "conflict", "discarded",
  ] as const)
  const canApply = requireBoolean(transition, "canApply")
  const canDiscard = requireBoolean(transition, "canDiscard")
  if (expectedDecision === "discard-exact-managed-review") {
    if (state !== "discarded" || canApply || canDiscard) throw invalidHostResponse()
  } else if (!["completed", "failed", "unknown", "conflict"].includes(state) || canApply || canDiscard !== (state === "conflict")) {
    throw invalidHostResponse()
  }
  const detail = parseManagedEvidenceDetail(transition.detail, managedRunId)
  if (detail.summary.state !== state || detail.artifactStatus !== "verified-result-and-evidence") throw invalidHostResponse()
  if (expectedDecision === "apply-exact-managed-review" && !detail.applyDecision) throw invalidHostResponse()
  const body = {
    schemaVersion: 1 as const,
    kind: "managed-review-transition" as const,
    decision: expectedDecision,
    sourcePreviewDigest: preview.previewDigest,
    sourceManagedRunRevision: preview.managedRunRevision,
    managedRunId,
    managedRunRevision,
    state,
    canApply,
    canDiscard,
    hasLocalJournal: requireBoolean(transition, "hasLocalJournal"),
    detail,
    authorityBoundary: managedReviewTransitionBoundary,
    cleanupBoundary: managedReviewCleanupBoundary,
  }
  const transitionDigest = requireDigest(transition, "transitionDigest")
  if (transitionDigest !== canonicalDigest(body)) throw invalidHostResponse()
  return Object.freeze({ ...body, transitionDigest })
}

function parseManagedReviewResult(
  value: unknown,
  expectedState: ManagedReviewPreview["state"],
): ManagedReviewPreview["result"] {
  const result = requireRecord(value)
  requireExactKeys(result, [
    "resultId", "resultDigest", "terminalState", "providerDisposition", "outcomeStatus", "outcomeBasis", "warningCodes",
    "evidenceId", "evidenceDigest",
  ])
  if (!Array.isArray(result.warningCodes) || result.warningCodes.length > 128) throw invalidHostResponse()
  const warnings = [
    "provider-warning-redacted", "provider-output-redacted", "coordinator-failure", "runtime-output-truncated",
    "staging-read-confinement-unattested", "postcondition-evaluator-failed", "local-cleanup-pending",
    "local-cleanup-failed", "runtime-warning",
  ] as const
  const warningCodes = Object.freeze(result.warningCodes.map((warning) => {
    if (typeof warning !== "string" || !(warnings as readonly string[]).includes(warning)) throw invalidHostResponse()
    return warning
  }))
  return Object.freeze({
    resultId: normalizeUuidValue(result.resultId, "Managed Result ID"),
    resultDigest: requireDigest(result, "resultDigest"),
    terminalState: requireEnum(result, "terminalState", [expectedState] as const),
    providerDisposition: requireEnum(result, "providerDisposition", [
      "completed", "failed", "cancelled", "interrupted", "crashed", "protocol-error", "unknown",
    ] as const),
    outcomeStatus: requireEnum(result, "outcomeStatus", ["satisfied", "failed", "not-assessed", "indeterminate"] as const),
    outcomeBasis: requireEnum(result, "outcomeBasis", [
      "postcondition-evaluator", "deterministic-offline-runtime", "not-evaluated", "provider-failure",
    ] as const),
    warningCodes,
    evidenceId: normalizeUuidValue(result.evidenceId, "Managed Evidence ID"),
    evidenceDigest: requireDigest(result, "evidenceDigest"),
  })
}

function parseManagedReviewStaging(
  value: unknown,
  state: ManagedReviewPreview["state"],
): ManagedReviewPreview["staging"] {
  const staging = requireRecord(value)
  requireExactKeys(staging, [
    "evidenceId", "evidenceDigest", "baselineDigest", "finalDigest", "applyState", "changeCount",
    "changedInventoryLimit", "omittedCount", "changedInventory", "changedInventoryDigest", "excludedPathCount",
    "excludedPathSetDigest",
  ])
  const applyState = requireEnum(staging, "applyState", ["pending", "conflict"] as const)
  if (applyState !== (state === "review-required" ? "pending" : "conflict") ||
      requireSafeInteger(staging, "changedInventoryLimit") !== 512 ||
      requireSafeInteger(staging, "omittedCount") !== 0 ||
      !Array.isArray(staging.changedInventory) || staging.changedInventory.length > 512) throw invalidHostResponse()
  const changedInventory = Object.freeze(staging.changedInventory.map(parseManagedChangedFile))
  if (requireSafeInteger(staging, "changeCount") !== changedInventory.length ||
      new Set(changedInventory.map((change) => change.path)).size !== changedInventory.length ||
      changedInventory.some((change, index) => index > 0 && changedInventory[index - 1]!.path.localeCompare(change.path) >= 0)) {
    throw invalidHostResponse()
  }
  const changedInventoryDigest = requireDigest(staging, "changedInventoryDigest")
  if (changedInventoryDigest !== canonicalDigest(changedInventory)) throw invalidHostResponse()
  return Object.freeze({
    evidenceId: normalizeUuidValue(staging.evidenceId, "Managed Evidence ID"),
    evidenceDigest: requireDigest(staging, "evidenceDigest"),
    baselineDigest: requireDigest(staging, "baselineDigest"),
    finalDigest: requireDigest(staging, "finalDigest"),
    applyState,
    changeCount: changedInventory.length,
    changedInventoryLimit: 512,
    omittedCount: 0,
    changedInventory,
    changedInventoryDigest,
    excludedPathCount: nonNegativeInteger(staging, "excludedPathCount", 20_000),
    excludedPathSetDigest: requireDigest(staging, "excludedPathSetDigest"),
  })
}

function parseManagedChangedFile(value: unknown): ManagedChangedFile {
  const change = requireRecord(value)
  requireKeys(change, ["path", "kind"], [
    "beforeDigest", "afterDigest", "beforeSize", "afterSize", "beforeMode", "afterMode",
  ])
  const kind = requireEnum(change, "kind", ["added", "modified", "deleted"] as const)
  const before = Object.hasOwn(change, "beforeDigest") || Object.hasOwn(change, "beforeSize") || Object.hasOwn(change, "beforeMode")
  const after = Object.hasOwn(change, "afterDigest") || Object.hasOwn(change, "afterSize") || Object.hasOwn(change, "afterMode")
  const completeBefore = Object.hasOwn(change, "beforeDigest") && Object.hasOwn(change, "beforeSize") && Object.hasOwn(change, "beforeMode")
  const completeAfter = Object.hasOwn(change, "afterDigest") && Object.hasOwn(change, "afterSize") && Object.hasOwn(change, "afterMode")
  if (before !== completeBefore || after !== completeAfter ||
      (kind === "added" && (before || !after)) || (kind === "deleted" && (!before || after)) ||
      (kind === "modified" && (!before || !after))) throw invalidHostResponse()
  const beforeSize = completeBefore ? nonNegativeInteger(change, "beforeSize", Number.MAX_SAFE_INTEGER) : undefined
  const afterSize = completeAfter ? nonNegativeInteger(change, "afterSize", Number.MAX_SAFE_INTEGER) : undefined
  const beforeMode = completeBefore ? nonNegativeInteger(change, "beforeMode", 0o777) : undefined
  const afterMode = completeAfter ? nonNegativeInteger(change, "afterMode", 0o777) : undefined
  return Object.freeze({
    path: workspaceRelativePath(change.path),
    kind,
    ...(completeBefore ? { beforeDigest: requireDigest(change, "beforeDigest"), beforeSize: beforeSize!, beforeMode: beforeMode! } : {}),
    ...(completeAfter ? { afterDigest: requireDigest(change, "afterDigest"), afterSize: afterSize!, afterMode: afterMode! } : {}),
  })
}

function parseManagedReviewApplyConfirmation(
  value: unknown,
  staging: ManagedReviewPreview["staging"],
): ManagedReviewApplyConfirmation {
  const confirmation = requireRecord(value)
  requireExactKeys(confirmation, [
    "decision", "reviewEvidenceId", "reviewEvidenceDigest", "changedInventoryDigest", "writeEnvelope",
    "writeEnvelopeDigest",
  ])
  if (requireString(confirmation, "decision") !== "apply-exact-reviewed-inventory" ||
      normalizeUuidValue(confirmation.reviewEvidenceId, "Managed Evidence ID") !== staging.evidenceId ||
      requireDigest(confirmation, "reviewEvidenceDigest") !== staging.evidenceDigest ||
      requireDigest(confirmation, "changedInventoryDigest") !== staging.changedInventoryDigest ||
      !Array.isArray(confirmation.writeEnvelope) || confirmation.writeEnvelope.length > 256) throw invalidHostResponse()
  const writeEnvelope = Object.freeze(confirmation.writeEnvelope.map(workspaceRelativeScope))
  if (new Set(writeEnvelope).size !== writeEnvelope.length ||
      writeEnvelope.some((scope, index) => index > 0 && writeEnvelope[index - 1]!.localeCompare(scope) >= 0)) throw invalidHostResponse()
  const writeEnvelopeDigest = requireDigest(confirmation, "writeEnvelopeDigest")
  if (writeEnvelopeDigest !== canonicalDigest(writeEnvelope)) throw invalidHostResponse()
  return Object.freeze({
    decision: "apply-exact-reviewed-inventory",
    reviewEvidenceId: staging.evidenceId,
    reviewEvidenceDigest: staging.evidenceDigest,
    changedInventoryDigest: staging.changedInventoryDigest,
    writeEnvelope,
    writeEnvelopeDigest,
  })
}

function parseManagedRunSummary(value: unknown): ManagedRunSummary {
  const summary = requireRecord(value)
  requireKeys(summary, [
    "schemaVersion", "kind", "managedRunId", "runId", "productId", "initiativeId", "mode", "state", "adapterId",
    "agentId", "modelId", "attemptNumber", "recoveryStatus", "workflowCheckpointCount", "hasResult",
    "hasApplyDecision", "bindingsDigest", "createdAt", "updatedAt", "authorityBoundary",
  ], ["resultDigest", "applyDecisionDigest", "startedAt", "endedAt"])
  if (requireSafeInteger(summary, "schemaVersion") !== 1 || requireString(summary, "kind") !== "managed-run-summary" ||
    requireString(summary, "authorityBoundary") !== managedInventoryBoundary) throw invalidHostResponse()
  const state = requireEnum(summary, "state", [
    "prepared", "running", "review-required", "applying", "completed", "failed", "cancelled", "timed-out", "unknown",
    "conflict", "discarded",
  ] as const)
  const hasResult = requireBoolean(summary, "hasResult")
  const hasApplyDecision = requireBoolean(summary, "hasApplyDecision")
  const resultDigest = Object.hasOwn(summary, "resultDigest") ? requireDigest(summary, "resultDigest") : undefined
  const applyDecisionDigest = Object.hasOwn(summary, "applyDecisionDigest")
    ? requireDigest(summary, "applyDecisionDigest")
    : undefined
  if (hasResult !== (resultDigest !== undefined) || hasApplyDecision !== (applyDecisionDigest !== undefined)) {
    throw invalidHostResponse()
  }
  const createdAt = requireTimestamp(summary, "createdAt")
  const startedAt = Object.hasOwn(summary, "startedAt") ? requireTimestamp(summary, "startedAt") : undefined
  const updatedAt = requireTimestamp(summary, "updatedAt")
  const endedAt = Object.hasOwn(summary, "endedAt") ? requireTimestamp(summary, "endedAt") : undefined
  const terminal = ["completed", "failed", "cancelled", "timed-out", "unknown", "conflict", "discarded"].includes(state)
  if (terminal !== (endedAt !== undefined) || Date.parse(updatedAt) < Date.parse(createdAt) ||
    (startedAt !== undefined && Date.parse(startedAt) < Date.parse(createdAt)) ||
    (endedAt !== undefined && startedAt !== undefined && Date.parse(endedAt) < Date.parse(startedAt))) {
    throw invalidHostResponse()
  }
  const attemptNumber = requireSafeInteger(summary, "attemptNumber")
  if (attemptNumber < 1 || attemptNumber > 1_000_000) throw invalidHostResponse()
  return Object.freeze({
    schemaVersion: 1,
    kind: "managed-run-summary",
    managedRunId: normalizeUuid(requireString(summary, "managedRunId"), "Managed Run ID"),
    runId: normalizeUuid(requireString(summary, "runId"), "Run ID"),
    productId: normalizeUuid(requireString(summary, "productId"), "Product ID"),
    initiativeId: normalizeUuid(requireString(summary, "initiativeId"), "Initiative ID"),
    mode: requireEnum(summary, "mode", ["codex-staged", "manual-offline", "claude-context-only"] as const),
    state,
    adapterId: requirePortableText(summary, "adapterId", 1),
    agentId: requirePortableText(summary, "agentId", 1),
    modelId: requirePortableText(summary, "modelId", 1),
    attemptNumber,
    recoveryStatus: requireEnum(summary, "recoveryStatus", [
      "not-required", "required", "recovered", "resume-unavailable",
    ] as const),
    workflowCheckpointCount: nonNegativeInteger(summary, "workflowCheckpointCount", 511),
    hasResult,
    hasApplyDecision,
    bindingsDigest: requireDigest(summary, "bindingsDigest"),
    ...(resultDigest ? { resultDigest } : {}),
    ...(applyDecisionDigest ? { applyDecisionDigest } : {}),
    createdAt,
    ...(startedAt ? { startedAt } : {}),
    updatedAt,
    ...(endedAt ? { endedAt } : {}),
    authorityBoundary: managedInventoryBoundary,
  })
}

function parseManagedEvidenceResult(
  value: unknown,
  summary: ManagedRunSummary,
): NonNullable<ManagedEvidenceDetail["result"]> {
  const result = requireRecord(value)
  requireExactKeys(result, [
    "resultId", "resultDigest", "providerDisposition", "terminationCause", "outcomeStatus", "outcomeBasis",
    "terminalState", "evidenceId", "evidenceDigest", "warningCodes", "startedAt", "endedAt",
  ])
  const terminalState = requireEnum(result, "terminalState", [
    "review-required", "completed", "failed", "cancelled", "timed-out", "unknown", "conflict", "discarded",
  ] as const)
  const providerDisposition = requireEnum(result, "providerDisposition", [
    "completed", "failed", "cancelled", "interrupted", "crashed", "protocol-error", "unknown",
  ] as const)
  const outcomeStatus = requireEnum(result, "outcomeStatus", ["satisfied", "failed", "not-assessed", "indeterminate"] as const)
  if (terminalState !== summary.state || requireDigest(result, "resultDigest") !== summary.resultDigest ||
    (terminalState === "completed" && (providerDisposition !== "completed" || outcomeStatus !== "satisfied"))) {
    throw invalidHostResponse()
  }
  if (!Array.isArray(result.warningCodes) || result.warningCodes.length > 128) throw invalidHostResponse()
  const warnings = [
    "provider-warning-redacted", "provider-output-redacted", "coordinator-failure", "runtime-output-truncated",
    "staging-read-confinement-unattested", "postcondition-evaluator-failed", "local-cleanup-pending",
    "local-cleanup-failed", "runtime-warning",
  ] as const
  const warningCodes = Object.freeze(result.warningCodes.map((warning) => {
    if (typeof warning !== "string" || !(warnings as readonly string[]).includes(warning)) throw invalidHostResponse()
    return warning
  }))
  const startedAt = requireTimestamp(result, "startedAt")
  const endedAt = requireTimestamp(result, "endedAt")
  if (Date.parse(endedAt) < Date.parse(startedAt)) throw invalidHostResponse()
  return Object.freeze({
    resultId: normalizeUuid(requireString(result, "resultId"), "Managed Result ID"),
    resultDigest: summary.resultDigest!,
    providerDisposition,
    terminationCause: requireEnum(result, "terminationCause", [
      "normal", "cancel-request", "timeout", "provider-failure", "process-loss", "protocol-error",
    ] as const),
    outcomeStatus,
    outcomeBasis: requireEnum(result, "outcomeBasis", [
      "postcondition-evaluator", "deterministic-offline-runtime", "not-evaluated", "provider-failure",
    ] as const),
    terminalState,
    evidenceId: normalizeUuid(requireString(result, "evidenceId"), "Managed Evidence ID"),
    evidenceDigest: requireDigest(result, "evidenceDigest"),
    warningCodes,
    startedAt,
    endedAt,
  })
}

function parseManagedEvidenceProjection(
  value: unknown,
  result: NonNullable<ManagedEvidenceDetail["result"]>,
): NonNullable<ManagedEvidenceDetail["evidence"]> {
  const evidence = requireRecord(value)
  requireKeys(evidence, [
    "evidenceId", "evidenceDigest", "eventCount", "eventTypeCounts", "eventsDigest", "workflowStrategy",
    "workflowStepCount", "workflowAttemptCount", "completedStepCount", "charterEvidenceStatus", "charterStopStatus",
    "terminalReasonCode", "actualEffectCounts", "capturedAt",
  ], ["staging"])
  const eventCount = nonNegativeInteger(evidence, "eventCount", 4_096)
  const eventTypeCounts = parseExactCountRecord(
    evidence.eventTypeCounts,
    ["lifecycle", "output", "item", "approval", "warning", "error"] as const,
    4_096,
  )
  if (Object.values(eventTypeCounts).reduce((sum, count) => sum + count, 0) !== eventCount) throw invalidHostResponse()
  const workflowStepCount = nonNegativeInteger(evidence, "workflowStepCount", 512)
  const workflowAttemptCount = nonNegativeInteger(evidence, "workflowAttemptCount", 5_120)
  const completedStepCount = nonNegativeInteger(evidence, "completedStepCount", 512)
  if (workflowStepCount < 1 || completedStepCount > workflowStepCount) throw invalidHostResponse()
  const actualEffectCounts = parseExactCountRecord(
    evidence.actualEffectCounts,
    ["not-observed", "observed-provisional", "applied", "blocked", "unknown"] as const,
    32,
  )
  if (Object.values(actualEffectCounts).reduce((sum, count) => sum + count, 0) > 32) throw invalidHostResponse()
  const staging = Object.hasOwn(evidence, "staging") ? parseManagedStagingProjection(evidence.staging) : undefined
  const evidenceId = normalizeUuid(requireString(evidence, "evidenceId"), "Managed Evidence ID")
  const evidenceDigest = requireDigest(evidence, "evidenceDigest")
  if (evidenceId !== result.evidenceId || evidenceDigest !== result.evidenceDigest) throw invalidHostResponse()
  return Object.freeze({
    evidenceId,
    evidenceDigest,
    eventCount,
    eventTypeCounts,
    eventsDigest: requireDigest(evidence, "eventsDigest"),
    workflowStrategy: requireEnum(evidence, "workflowStrategy", ["sequential", "parallel-readonly"] as const),
    workflowStepCount,
    workflowAttemptCount,
    completedStepCount,
    charterEvidenceStatus: requireEnum(evidence, "charterEvidenceStatus", ["satisfied", "failed", "not-assessed"] as const),
    charterStopStatus: requireEnum(evidence, "charterStopStatus", ["satisfied", "failed", "not-assessed"] as const),
    terminalReasonCode: portableHandoffText(requireString(evidence, "terminalReasonCode"), 1, 128),
    ...(staging ? { staging } : {}),
    actualEffectCounts,
    capturedAt: requireTimestamp(evidence, "capturedAt"),
  })
}

function parseManagedStagingProjection(value: unknown): NonNullable<NonNullable<ManagedEvidenceDetail["evidence"]>["staging"]> {
  const staging = requireRecord(value)
  requireExactKeys(staging, [
    "changeCount", "excludedPathCount", "applyState", "baselineDigest", "finalDigest", "changedInventoryDigest",
    "excludedPathSetDigest",
  ])
  return Object.freeze({
    changeCount: nonNegativeInteger(staging, "changeCount", 20_000),
    excludedPathCount: nonNegativeInteger(staging, "excludedPathCount", 20_000),
    applyState: requireEnum(staging, "applyState", ["pending", "applied", "conflict", "discarded", "not-applied"] as const),
    baselineDigest: requireDigest(staging, "baselineDigest"),
    finalDigest: requireDigest(staging, "finalDigest"),
    changedInventoryDigest: requireDigest(staging, "changedInventoryDigest"),
    excludedPathSetDigest: requireDigest(staging, "excludedPathSetDigest"),
  })
}

function parseManagedApplyDecisionProjection(
  value: unknown,
  summary: ManagedRunSummary,
): NonNullable<ManagedEvidenceDetail["applyDecision"]> {
  const decision = requireRecord(value)
  requireExactKeys(decision, [
    "receiptId", "receiptDigest", "managedRunRevision", "changedInventoryCount", "writeEnvelopeCount",
    "changedInventoryDigest", "writeEnvelopeDigest", "decidedAt",
  ])
  const managedRunRevision = requireSafeInteger(decision, "managedRunRevision")
  if (managedRunRevision < 1 || requireDigest(decision, "receiptDigest") !== summary.applyDecisionDigest) {
    throw invalidHostResponse()
  }
  return Object.freeze({
    receiptId: normalizeUuid(requireString(decision, "receiptId"), "Apply Decision ID"),
    receiptDigest: summary.applyDecisionDigest!,
    managedRunRevision,
    changedInventoryCount: nonNegativeInteger(decision, "changedInventoryCount", 20_000),
    writeEnvelopeCount: nonNegativeInteger(decision, "writeEnvelopeCount", 256),
    changedInventoryDigest: requireDigest(decision, "changedInventoryDigest"),
    writeEnvelopeDigest: requireDigest(decision, "writeEnvelopeDigest"),
    decidedAt: requireTimestamp(decision, "decidedAt"),
  })
}

function parseExactCountRecord<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
  maximum: number,
): Readonly<Record<Keys[number], number>> {
  const record = requireRecord(value)
  requireExactKeys(record, keys)
  return Object.freeze(Object.fromEntries(keys.map((key) => [key, nonNegativeInteger(record, key, maximum)]))) as
    Readonly<Record<Keys[number], number>>
}

function parseManagedReadOnlyGate(value: unknown, stepIds: ReadonlySet<string>): ManagedReadOnlyGatePreview {
  const gate = requireRecord(value)
  requireKeys(gate, ["key", "phase", "criteria", "criteriaDigest"], ["stepId"])
  const phase = requireEnum(gate, "phase", [
    "preconditions", "outputs", "evidence", "stop-conditions", "charter-evidence", "charter-stop-conditions",
  ] as const)
  const stepId = Object.hasOwn(gate, "stepId") ? normalizeUuidValue(gate.stepId, "Workflow Step ID") : undefined
  const charterGate = phase === "charter-evidence" || phase === "charter-stop-conditions"
  if (charterGate === (stepId !== undefined) || (stepId !== undefined && !stepIds.has(stepId))) throw invalidHostResponse()
  if (!Array.isArray(gate.criteria) || gate.criteria.length > 256) throw invalidHostResponse()
  const criteria = Object.freeze(gate.criteria.map((criterion) => portableHandoffText(criterion, 1, 2_000)))
  const criteriaDigest = requireDigest(gate, "criteriaDigest")
  if (criteriaDigest !== canonicalDigest(criteria)) throw invalidHostResponse()
  return Object.freeze({
    key: portableHandoffText(requireString(gate, "key"), 1, 500),
    ...(stepId !== undefined ? { stepId } : {}),
    phase,
    criteria,
    criteriaDigest,
  })
}

function parsePhaseDashboardPanel(value: unknown, expectedId: keyof typeof phaseDashboardPanelCatalog): PhaseDashboardPanel {
  const panel = requireRecord(value)
  requireExactKeys(panel, ["id", "role", "title", "applicability", "state"])
  const definition = phaseDashboardPanelCatalog[expectedId]
  if (requireString(panel, "id") !== expectedId || requireString(panel, "role") !== definition[0] ||
      requireString(panel, "title") !== definition[1]) throw invalidHostResponse()
  const applicability = requireRecord(panel.applicability)
  requireKeys(applicability, ["status", "basis"], ["decision"])
  const status = requireEnum(applicability, "status", ["applicable", "not-applicable", "unknown"] as const)
  const basis = requireEnum(applicability, "basis", ["phase-contract", "governed-decision", "not-evaluated"] as const)
  const decision = Object.hasOwn(applicability, "decision")
    ? parsePhaseDashboardDecision(applicability.decision)
    : undefined
  if ((basis === "phase-contract" && (status !== "applicable" || decision)) ||
      (basis === "not-evaluated" && (status !== "unknown" || decision)) ||
      (basis === "governed-decision" && (status === "unknown" || !decision))) throw invalidHostResponse()
  const state = requireEnum(panel, "state", ["active", "not-applicable", "attention-required"] as const)
  const expectedState = status === "applicable" ? "active" : status === "not-applicable" ? "not-applicable" : "attention-required"
  if (state !== expectedState) throw invalidHostResponse()
  return Object.freeze({
    id: expectedId,
    role: definition[0],
    title: definition[1],
    applicability: Object.freeze({ status, basis, ...(decision ? { decision } : {}) }),
    state,
  })
}

function parsePhaseDashboardDecision(value: unknown): NonNullable<PhaseDashboardPanel["applicability"]["decision"]> {
  const decision = requireRecord(value)
  requireExactKeys(decision, ["recordType", "recordId", "revision", "digest"])
  if (requireString(decision, "recordType") !== "decision") throw invalidHostResponse()
  return Object.freeze({
    recordType: "decision",
    recordId: normalizeUuid(requireString(decision, "recordId"), "Dashboard applicability decision ID"),
    revision: validateProductRevision(requireSafeInteger(decision, "revision")),
    digest: requireDigest(decision, "digest"),
  })
}

function parseChangeImpactArray<T>(value: unknown, maximum: number, parse: (entry: unknown) => T): readonly T[] {
  if (!Array.isArray(value) || value.length > maximum) throw invalidHostResponse()
  return Object.freeze(value.map(parse))
}

function parseChangeImpactExactReference(
  value: unknown,
  expectedType: ChangeImpactExactReference["recordType"],
): ChangeImpactExactReference {
  const reference = requireRecord(value)
  requireExactKeys(reference, ["recordType", "recordId", "revision", "digest"])
  if (requireString(reference, "recordType") !== expectedType) throw invalidHostResponse()
  return Object.freeze({
    recordType: expectedType,
    recordId: normalizeUuidValue(reference.recordId, `${expectedType} ID`),
    revision: validateProductRevision(requireSafeInteger(reference, "revision")),
    digest: requireDigest(reference, "digest"),
  })
}

function parseChangeImpactChangeReference(value: unknown): ChangeImpactChangeReference {
  const change = requireRecord(value)
  requireExactKeys(change, ["recordType", "recordId", "revision", "digest", "state", "effectEnvelope"])
  if (requireString(change, "recordType") !== "change" || !Array.isArray(change.effectEnvelope) ||
      change.effectEnvelope.length < 1 || change.effectEnvelope.length > changeImpactEffects.length) throw invalidHostResponse()
  const effectEnvelope = Object.freeze(change.effectEnvelope.map((effect) => {
    if (typeof effect !== "string" || !changeImpactEffects.includes(effect as typeof changeImpactEffects[number])) {
      throw invalidHostResponse()
    }
    return effect as typeof changeImpactEffects[number]
  }))
  if (new Set(effectEnvelope).size !== effectEnvelope.length) throw invalidHostResponse()
  return Object.freeze({
    recordType: "change" as const,
    recordId: normalizeUuidValue(change.recordId, "Change ID"),
    revision: validateProductRevision(requireSafeInteger(change, "revision")),
    digest: requireDigest(change, "digest"),
    state: requireEnum(change, "state", changeImpactStates),
    effectEnvelope,
  })
}

function parseChangeImpactLocator(value: unknown): ChangeImpactPortableLocator {
  const locator = requireRecord(value)
  const kind = requireString(locator, "kind")
  if (kind === "workspace-relative") {
    requireExactKeys(locator, ["kind", "path"])
    const path = requireString(locator, "path")
    const segments = path.split("/")
    if (path.length < 1 || path.length > 4_096 || (path !== "." && (
      path.startsWith("/") || /^[A-Za-z]:/u.test(path) || path.startsWith("~") || path.includes("\\") ||
      path.includes("\0") || /%2e/iu.test(path) || segments.some((segment) => segment === "" || segment === "." || segment === "..")
    ))) throw invalidHostResponse()
    return Object.freeze({ kind, path })
  }
  if (kind === "logical") {
    requireExactKeys(locator, ["kind", "value"])
    const logical = requireString(locator, "value")
    if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(logical)) throw invalidHostResponse()
    return Object.freeze({ kind, value: logical })
  }
  if (kind !== "external-uri") throw invalidHostResponse()
  requireExactKeys(locator, ["kind", "uri"])
  const uri = requireString(locator, "uri")
  if (uri.length > 8_192) throw invalidHostResponse()
  try {
    const parsed = new URL(uri)
    const sensitive = /(token|password|passwd|secret|signature|credential|api.?key|access.?key|auth)/iu
    if (!["http:", "https:", "urn:"].includes(parsed.protocol) || parsed.username || parsed.password ||
        [...parsed.searchParams.keys()].some((key) => sensitive.test(key)) || (parsed.hash && sensitive.test(parsed.hash))) {
      throw invalidHostResponse()
    }
  } catch (error) {
    if (error instanceof GaepHostError) throw error
    throw invalidHostResponse()
  }
  return Object.freeze({ kind, uri })
}

function parseChangeImpactTraceEndpoint(value: unknown): ChangeImpactTraceEndpoint {
  const endpoint = requireRecord(value)
  requireKeys(endpoint, ["recordType", "recordId"], ["revision", "digest"])
  const recordType = requireEnum(endpoint, "recordType", changeImpactRecordTypes)
  if (recordType === "external") {
    if (Object.hasOwn(endpoint, "revision") || Object.hasOwn(endpoint, "digest")) throw invalidHostResponse()
    return Object.freeze({ recordType, recordId: portableText(endpoint.recordId, 1, 500) })
  }
  if (!Object.hasOwn(endpoint, "revision") || !Object.hasOwn(endpoint, "digest")) throw invalidHostResponse()
  return Object.freeze({
    recordType,
    recordId: normalizeUuidValue(endpoint.recordId, `${recordType} trace endpoint ID`),
    revision: validateProductRevision(requireSafeInteger(endpoint, "revision")),
    digest: requireDigest(endpoint, "digest"),
  })
}

function parseChangeImpactAffectedUnit(value: unknown): ChangeImpactDashboard["affectedUnits"][number] {
  const unit = requireRecord(value)
  requireExactKeys(unit, ["direction", "relationship", "endpoint", "trace"])
  const trace = requireRecord(unit.trace)
  requireExactKeys(trace, ["recordId", "revision", "assessmentDigest", "assessedState"])
  return Object.freeze({
    direction: requireEnum(unit, "direction", ["upstream", "downstream"] as const),
    relationship: requireEnum(unit, "relationship", changeImpactRelationships),
    endpoint: parseChangeImpactTraceEndpoint(unit.endpoint),
    trace: Object.freeze({
      recordId: normalizeUuidValue(trace.recordId, "Trace assessment ID"),
      revision: validateProductRevision(requireSafeInteger(trace, "revision")),
      assessmentDigest: requireDigest(trace, "assessmentDigest"),
      assessedState: requireEnum(trace, "assessedState", ["valid", "unresolved", "stale", "invalid"] as const),
    }),
  })
}

function parseChangeImpactGovernance(value: unknown): ChangeImpactDashboard["governance"] {
  const governance = requireRecord(value)
  requireExactKeys(governance, ["approval", "decisions", "risks", "authorityBoundary"])
  const approval = requireRecord(governance.approval)
  requireExactKeys(approval, ["state", "basis"])
  if (requireString(approval, "state") !== "not-established" ||
      requireString(approval, "basis") !== "current-contract-has-no-change-approval-record" ||
      requireString(governance, "authorityBoundary") !== "decisions-and-risk-acceptance-do-not-approve-the-change") {
    throw invalidHostResponse()
  }
  const decisions = parseChangeImpactArray(governance.decisions, 256, (entry) => {
    const decision = requireRecord(entry)
    requireExactKeys(decision, ["record", "state", "outcome"])
    const state = requireEnum(decision, "state", ["open", "decided", "deferred", "superseded"] as const)
    const outcome = requireEnum(decision, "outcome", ["human-selected", "not-selected"] as const)
    if ((state === "decided") !== (outcome === "human-selected")) throw invalidHostResponse()
    return Object.freeze({
      record: parseChangeImpactExactReference(decision.record, "decision") as
        ChangeImpactDashboard["governance"]["decisions"][number]["record"],
      state,
      outcome,
    })
  })
  const risks = parseChangeImpactArray(governance.risks, 256, (entry) => {
    const risk = requireRecord(entry)
    requireExactKeys(risk, ["record", "state", "likelihood", "impact", "acceptance"])
    const state = requireEnum(risk, "state", ["open", "treated", "accepted", "closed"] as const)
    const acceptance = requireEnum(risk, "acceptance", ["human-accepted", "not-accepted"] as const)
    if ((state === "accepted") !== (acceptance === "human-accepted")) throw invalidHostResponse()
    return Object.freeze({
      record: parseChangeImpactExactReference(risk.record, "risk") as
        ChangeImpactDashboard["governance"]["risks"][number]["record"],
      state,
      likelihood: requireEnum(risk, "likelihood", ["rare", "unlikely", "possible", "likely", "almost-certain", "unknown"] as const),
      impact: requireEnum(risk, "impact", ["negligible", "minor", "moderate", "major", "critical", "unknown"] as const),
      acceptance,
    })
  })
  return Object.freeze({
    approval: Object.freeze({ state: "not-established" as const, basis: "current-contract-has-no-change-approval-record" as const }),
    decisions,
    risks,
    authorityBoundary: "decisions-and-risk-acceptance-do-not-approve-the-change" as const,
  })
}

function parseChangeImpactFreshness(value: unknown): ChangeImpactDashboard["freshness"] {
  const freshness = requireRecord(value)
  requireExactKeys(freshness, [
    "state", "evaluatedAt", "unresolvedTraceLinks", "invalidTraceLinks", "staleTraceLinks",
    "staleGovernanceReferences", "traceAnalysisTruncated", "coverageBoundary",
  ])
  if (requireString(freshness, "coverageBoundary") !== "absence-of-a-trace-link-does-not-prove-absence-of-impact") {
    throw invalidHostResponse()
  }
  return Object.freeze({
    state: requireEnum(freshness, "state", ["current", "attention-required"] as const),
    evaluatedAt: requireTimestamp(freshness, "evaluatedAt"),
    unresolvedTraceLinks: nonNegativeInteger(freshness, "unresolvedTraceLinks", 1_000_000),
    invalidTraceLinks: nonNegativeInteger(freshness, "invalidTraceLinks", 1_000_000),
    staleTraceLinks: nonNegativeInteger(freshness, "staleTraceLinks", 1_000_000),
    staleGovernanceReferences: nonNegativeInteger(freshness, "staleGovernanceReferences", 1_000_000),
    traceAnalysisTruncated: requireBoolean(freshness, "traceAnalysisTruncated"),
    coverageBoundary: "absence-of-a-trace-link-does-not-prove-absence-of-impact" as const,
  })
}

function parseChangeImpactLimit(value: unknown): ChangeImpactLimit {
  const limit = requireRecord(value)
  requireExactKeys(limit, ["shown", "total", "omitted"])
  const shown = nonNegativeInteger(limit, "shown", 1_000_000)
  const total = nonNegativeInteger(limit, "total", 1_000_000)
  const omitted = nonNegativeInteger(limit, "omitted", 1_000_000)
  if (shown + omitted !== total) throw invalidHostResponse()
  return Object.freeze({ shown, total, omitted })
}

function parseChangeImpactLimits(value: unknown): ChangeImpactDashboard["limits"] {
  const limits = requireRecord(value)
  requireExactKeys(limits, [
    "workItems", "changedArtifacts", "effectTargets", "affectedUnits", "decisions", "risks", "truncated",
  ])
  return Object.freeze({
    workItems: parseChangeImpactLimit(limits.workItems),
    changedArtifacts: parseChangeImpactLimit(limits.changedArtifacts),
    effectTargets: parseChangeImpactLimit(limits.effectTargets),
    affectedUnits: parseChangeImpactLimit(limits.affectedUnits),
    decisions: parseChangeImpactLimit(limits.decisions),
    risks: parseChangeImpactLimit(limits.risks),
    truncated: requireBoolean(limits, "truncated"),
  })
}

function parseChangeImpactLimitations(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) throw invalidHostResponse()
  return Object.freeze(value.map((limitation) => portableText(limitation, 4, 1_000)))
}

function ensureUniqueChangeImpactRows(
  workItems: ChangeImpactDashboard["workItems"],
  changedArtifacts: ChangeImpactDashboard["changedArtifacts"],
  effectTargets: ChangeImpactDashboard["effectTargets"],
  affectedUnits: ChangeImpactDashboard["affectedUnits"],
  governance: ChangeImpactDashboard["governance"],
): void {
  const unique = (values: readonly string[]) => new Set(values).size === values.length
  if (!unique(workItems.map((entry) => entry.record.recordId)) ||
      !unique(changedArtifacts.map((entry) => `${entry.sourceWorkItem.recordId}:${JSON.stringify(entry.locator)}`)) ||
      !unique(effectTargets.map((entry) => `${entry.sourceWorkItem.recordId}:${JSON.stringify(entry.locator)}`)) ||
      !unique(affectedUnits.map((entry) => `${entry.direction}:${entry.endpoint.recordType}:${entry.endpoint.recordId}:${entry.trace.recordId}`)) ||
      !unique(governance.decisions.map((entry) => entry.record.recordId)) ||
      !unique(governance.risks.map((entry) => entry.record.recordId))) throw invalidHostResponse()
}

function parseAgentModelReference(value: unknown, recordType: AgentModelRecordReference["recordType"]): AgentModelRecordReference {
  const record = requireRecord(value)
  requireExactKeys(record, ["recordType", "recordId", "revision", "digest"])
  if (requireString(record, "recordType") !== recordType) throw invalidHostResponse()
  return Object.freeze({
    recordType,
    recordId: normalizeUuidValue(record.recordId, `Agent/Model ${recordType} ID`),
    revision: validateProductRevision(requireSafeInteger(record, "revision")),
    digest: requireDigest(record, "digest"),
  })
}

function parseAgentModelCapability(
  row: JsonRecord,
  expected: AgentReadinessSnapshot,
): AgentModelDashboard["capabilities"][number] {
  requireExactKeys(row, [
    "adapterId", "adapterVersion", "agentId", "agentLabel", "runtimeVersion", "capabilityDigest", "detected",
    "executionInterface", "interfaceMaturity", "support", "modelCount", "limitations", "observedAt", "selected",
  ])
  const runtimeVersion = row.runtimeVersion === null ? null : requirePortableText(row, "runtimeVersion", 1)
  const executionInterface = requireEnum(row, "executionInterface", [
    "cli-jsonl", "cli-stream-json", "stdio-rpc", "managed-in-process", "unavailable",
  ] as const)
  const interfaceMaturity = requireEnum(row, "interfaceMaturity", ["stable", "beta", "experimental", "unknown"] as const)
  const support = requireRecord(row.support)
  requireExactKeys(support, ["resume", "cancel", "checkpoints", "modelDiscovery", "toolSelection"])
  const parsedSupport = Object.freeze({
    resume: requireBoolean(support, "resume"),
    cancel: requireBoolean(support, "cancel"),
    checkpoints: requireBoolean(support, "checkpoints"),
    modelDiscovery: requireBoolean(support, "modelDiscovery"),
    toolSelection: requireBoolean(support, "toolSelection"),
  })
  const limitationRecord = requireRecord(row.limitations)
  requireExactKeys(limitationRecord, ["values", "shown", "total", "omitted"])
  if (!Array.isArray(limitationRecord.values) || limitationRecord.values.length > 64) throw invalidHostResponse()
  const limitationValues = Object.freeze(limitationRecord.values.map((entry) => portableText(entry, 1, 20_000)))
  const limitationShown = nonNegativeInteger(limitationRecord, "shown", 64)
  const limitationTotal = nonNegativeInteger(limitationRecord, "total", 512)
  const limitationOmitted = nonNegativeInteger(limitationRecord, "omitted", 512)
  if (limitationShown !== limitationValues.length || limitationShown + limitationOmitted !== limitationTotal) throw invalidHostResponse()
  const parsed = Object.freeze({
    adapterId: requirePortableText(row, "adapterId", 1),
    adapterVersion: requirePortableText(row, "adapterVersion", 1),
    agentId: requirePortableText(row, "agentId", 1),
    agentLabel: requirePortableText(row, "agentLabel", 1),
    runtimeVersion,
    capabilityDigest: requireDigest(row, "capabilityDigest"),
    detected: requireBoolean(row, "detected"),
    executionInterface,
    interfaceMaturity,
    support: parsedSupport,
    modelCount: nonNegativeInteger(row, "modelCount", 512),
    limitations: Object.freeze({ values: limitationValues, shown: limitationShown, total: limitationTotal, omitted: limitationOmitted }),
    observedAt: requireTimestamp(row, "observedAt"),
    selected: requireBoolean(row, "selected"),
  })
  if (parsed.adapterId !== expected.adapterId || parsed.adapterVersion !== expected.adapterVersion ||
      parsed.agentId !== expected.agentId || parsed.agentLabel !== expected.agentLabel ||
      parsed.runtimeVersion !== (expected.runtimeVersion ?? null) || parsed.capabilityDigest !== expected.capabilityDigest ||
      parsed.detected !== expected.detected || parsed.executionInterface !== expected.executionInterface ||
      parsed.interfaceMaturity !== expected.interfaceMaturity || parsed.modelCount !== expected.models.length ||
      parsed.limitations.total !== expected.limitations.length || parsed.observedAt !== expected.observedAt ||
      JSON.stringify(parsed.limitations.values) !== JSON.stringify(expected.limitations.slice(0, 64)) ||
      parsedSupport.resume !== expected.supportsResume || parsedSupport.cancel !== expected.supportsCancel ||
      parsedSupport.checkpoints !== expected.supportsCheckpoints || parsedSupport.modelDiscovery !== expected.supportsModelDiscovery ||
      parsedSupport.toolSelection !== expected.supportsToolSelection) throw invalidHostResponse()
  return parsed
}

function parseAgentModelSelection(
  value: unknown,
  expected: AgentSelectionState,
  capabilities: AgentModelDashboard["capabilities"],
): AgentModelDashboard["selection"] {
  const selection = requireRecord(value)
  const status = requireString(selection, "status")
  if (status !== expected.status) throw invalidHostResponse()
  if (status === "unselected" || status === "invalid") {
    requireExactKeys(selection, ["status"])
    return Object.freeze({ status })
  }
  if (status !== "selected" && status !== "migration-required") throw invalidHostResponse()
  requireExactKeys(selection, [
    "status", "selectionDigest", "adapterId", "agentId", "modelId", "modelTruthClass", "modelAlias", "settings",
    "selectedAt", "capabilityDigest", "capabilityState",
  ])
  if (expected.status !== "selected" && expected.status !== "migration-required") throw invalidHostResponse()
  const current = expected.status === "selected" ? expected.selection : expected.portableCandidate
  const parsed = Object.freeze({
    status,
    selectionDigest: requireDigest(selection, "selectionDigest"),
    adapterId: requirePortableText(selection, "adapterId", 1),
    agentId: requirePortableText(selection, "agentId", 1),
    modelId: requirePortableText(selection, "modelId", 1),
    modelTruthClass: requireTruthClass(selection, "modelTruthClass"),
    modelAlias: selection.modelAlias === null ? null : requireBoolean(selection, "modelAlias"),
    settings: parsePortableSelectionSettings(selection.settings),
    selectedAt: requireTimestamp(selection, "selectedAt"),
    capabilityDigest: requireDigest(selection, "capabilityDigest"),
    capabilityState: requireEnum(selection, "capabilityState", status === "selected"
      ? ["current", "stale"] as const
      : ["migration-required"] as const),
  })
  if (parsed.selectionDigest !== canonicalDigest(current) || parsed.adapterId !== current.adapterId ||
      parsed.agentId !== current.agentId || parsed.modelId !== current.modelId ||
      parsed.modelTruthClass !== current.modelTruthClass || parsed.modelAlias !== current.modelAlias ||
      parsed.selectedAt !== current.selectedAt || parsed.capabilityDigest !== current.capabilityDigest) throw invalidHostResponse()
  if (status === "selected") {
    const capability = capabilities.find((entry) => entry.adapterId === parsed.adapterId && entry.agentId === parsed.agentId)
    if (!capability || ((capability.capabilityDigest === parsed.capabilityDigest) !== (parsed.capabilityState === "current"))) {
      throw invalidHostResponse()
    }
  }
  return parsed
}

function parseAgentModelRun(value: unknown): AgentModelDashboard["runs"][number] {
  const row = requireRecord(value)
  requireExactKeys(row, ["record", "initiativeId", "state", "agent", "startedAt", "endedAt", "managed"])
  const agent = requireRecord(row.agent)
  requireExactKeys(agent, ["adapterId", "agentId", "modelId", "selectionDigest"])
  return Object.freeze({
    record: parseAgentModelReference(row.record, "run") as AgentModelDashboard["runs"][number]["record"],
    initiativeId: normalizeUuidValue(row.initiativeId, "Agent/Model Initiative ID"),
    state: requireEnum(row, "state", ["prepared", "running", "paused", "completed", "failed", "cancelled", "unknown"] as const),
    agent: Object.freeze({
      adapterId: requirePortableText(agent, "adapterId", 1),
      agentId: requirePortableText(agent, "agentId", 1),
      modelId: requirePortableText(agent, "modelId", 1),
      selectionDigest: requireDigest(agent, "selectionDigest"),
    }),
    startedAt: nullableTimestamp(row.startedAt),
    endedAt: nullableTimestamp(row.endedAt),
    managed: parseAgentModelManaged(row.managed),
  })
}

function parseAgentModelManaged(value: unknown): AgentModelDashboard["runs"][number]["managed"] {
  const managed = requireRecord(value)
  const status = requireString(managed, "status")
  if (status === "not-observed-in-bounded-window") {
    requireExactKeys(managed, ["status"])
    return Object.freeze({ status })
  }
  if (status !== "observed") throw invalidHostResponse()
  requireExactKeys(managed, ["status", "record", "mode", "state", "attemptNumber", "bindingsDigest", "provider", "result"])
  const provider = requireRecord(managed.provider)
  requireExactKeys(provider, ["adapterId", "agentId", "modelId", "capabilityDigest"])
  const result = requireRecord(managed.result)
  const resultStatus = requireString(result, "status")
  let parsedResult: Extract<AgentModelDashboard["runs"][number]["managed"], { status: "observed" }>["result"]
  if (resultStatus === "not-bound") {
    requireExactKeys(result, ["status"])
    parsedResult = Object.freeze({ status: "not-bound" })
  } else {
    if (resultStatus !== "bound") throw invalidHostResponse()
    requireExactKeys(result, ["status", "recordId", "digest", "providerDisposition", "outcomeStatus", "evidence"])
    const evidence = requireRecord(result.evidence)
    requireExactKeys(evidence, ["recordId", "digest", "eventCount", "eventsDigest", "actualEffectCount", "capturedAt"])
    parsedResult = Object.freeze({
      status: "bound",
      recordId: normalizeUuidValue(result.recordId, "Agent/Model result ID"),
      digest: requireDigest(result, "digest"),
      providerDisposition: requireEnum(result, "providerDisposition", [
        "completed", "failed", "cancelled", "interrupted", "crashed", "protocol-error", "unknown",
      ] as const),
      outcomeStatus: requireEnum(result, "outcomeStatus", ["satisfied", "failed", "not-assessed", "indeterminate"] as const),
      evidence: Object.freeze({
        recordId: normalizeUuidValue(evidence.recordId, "Agent/Model evidence ID"),
        digest: requireDigest(evidence, "digest"),
        eventCount: nonNegativeInteger(evidence, "eventCount", 4_096),
        eventsDigest: requireDigest(evidence, "eventsDigest"),
        actualEffectCount: nonNegativeInteger(evidence, "actualEffectCount", 32),
        capturedAt: requireTimestamp(evidence, "capturedAt"),
      }),
    })
  }
  return Object.freeze({
    status: "observed",
    record: parseAgentModelReference(managed.record, "managed-run") as Extract<AgentModelDashboard["runs"][number]["managed"], { status: "observed" }>["record"],
    mode: requireEnum(managed, "mode", ["codex-staged", "manual-offline", "claude-context-only"] as const),
    state: requireEnum(managed, "state", [
      "prepared", "running", "review-required", "applying", "completed", "failed", "cancelled", "timed-out",
      "unknown", "conflict", "discarded",
    ] as const),
    attemptNumber: positiveInteger(managed, "attemptNumber", 1_000_000),
    bindingsDigest: requireDigest(managed, "bindingsDigest"),
    provider: Object.freeze({
      adapterId: requirePortableText(provider, "adapterId", 1),
      agentId: requirePortableText(provider, "agentId", 1),
      modelId: requirePortableText(provider, "modelId", 1),
      capabilityDigest: requireDigest(provider, "capabilityDigest"),
    }),
    result: parsedResult,
  })
}

function parseAgentModelHandoff(value: unknown): AgentModelDashboard["handoffs"][number] {
  const row = requireRecord(value)
  requireExactKeys(row, ["record", "fromRun", "toSelection", "state", "createdAt", "acknowledgedAt"])
  const record = parseAgentModelReference(row.record, "handoff") as AgentModelDashboard["handoffs"][number]["record"]
  if (record.revision !== 1) throw invalidHostResponse()
  const toSelection = requireRecord(row.toSelection)
  requireExactKeys(toSelection, ["adapterId", "agentId", "modelId", "selectionDigest"])
  return Object.freeze({
    record,
    fromRun: parseAgentModelReference(row.fromRun, "run") as AgentModelDashboard["handoffs"][number]["fromRun"],
    toSelection: Object.freeze({
      adapterId: requirePortableText(toSelection, "adapterId", 1),
      agentId: requirePortableText(toSelection, "agentId", 1),
      modelId: requirePortableText(toSelection, "modelId", 1),
      selectionDigest: requireDigest(toSelection, "selectionDigest"),
    }),
    state: requireEnum(row, "state", ["pending-acknowledgement", "acknowledged"] as const),
    createdAt: requireTimestamp(row, "createdAt"),
    acknowledgedAt: nullableTimestamp(row.acknowledgedAt),
  })
}

function parseAgentModelMetrics(value: unknown): AgentModelDashboard["providerMetrics"] {
  const metrics = requireRecord(value)
  requireExactKeys(metrics, ["usage", "cost"])
  const unavailable = (metricValue: unknown) => {
    const metric = requireRecord(metricValue)
    requireExactKeys(metric, ["state", "basis"])
    if (requireString(metric, "state") !== "unavailable" ||
        requireString(metric, "basis") !== "current-managed-records-have-no-provider-usage-or-cost-contract") {
      throw invalidHostResponse()
    }
    return Object.freeze({
      state: "unavailable" as const,
      basis: "current-managed-records-have-no-provider-usage-or-cost-contract" as const,
    })
  }
  return Object.freeze({ usage: unavailable(metrics.usage), cost: unavailable(metrics.cost) })
}

function parseAgentModelFreshness(value: unknown): AgentModelDashboard["freshness"] {
  const freshness = requireRecord(value)
  requireExactKeys(freshness, [
    "state", "selectionCapabilityState", "oldestCapabilityObservedAt", "newestCapabilityObservedAt", "truncated", "coverageBoundary",
  ])
  if (requireString(freshness, "coverageBoundary") !== "bounded-current-records-do-not-prove-provider-account-or-native-host-readiness") {
    throw invalidHostResponse()
  }
  return Object.freeze({
    state: requireEnum(freshness, "state", ["current", "attention-required"] as const),
    selectionCapabilityState: requireEnum(freshness, "selectionCapabilityState", [
      "current", "unselected", "stale", "migration-required", "invalid",
    ] as const),
    oldestCapabilityObservedAt: requireTimestamp(freshness, "oldestCapabilityObservedAt"),
    newestCapabilityObservedAt: requireTimestamp(freshness, "newestCapabilityObservedAt"),
    truncated: requireBoolean(freshness, "truncated"),
    coverageBoundary: "bounded-current-records-do-not-prove-provider-account-or-native-host-readiness" as const,
  })
}

function parseAgentModelLimits(value: unknown): AgentModelDashboard["limits"] {
  const limits = requireRecord(value)
  requireExactKeys(limits, ["capabilities", "runs", "handoffs", "managedRuns", "truncated"])
  return Object.freeze({
    capabilities: parseChangeImpactLimit(limits.capabilities),
    runs: parseChangeImpactLimit(limits.runs),
    handoffs: parseChangeImpactLimit(limits.handoffs),
    managedRuns: parseChangeImpactLimit(limits.managedRuns),
    truncated: requireBoolean(limits, "truncated"),
  })
}

function nullableTimestamp(value: unknown): string | null {
  if (value === null) return null
  const record = { value }
  return requireTimestamp(record, "value")
}

export function canonicalDigest(value: unknown): string {
  const normalize = (entry: unknown): unknown => {
    if (Array.isArray(entry)) return entry.map(normalize)
    if (entry !== null && typeof entry === "object") {
      return Object.fromEntries(
        Object.entries(entry as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, child]) => [key, normalize(child)]),
      )
    }
    return entry
  }
  return `sha256:${createHash("sha256").update(JSON.stringify(normalize(value))).digest("hex")}`
}

function normalizeUuidValue(value: unknown, label: string): string {
  if (typeof value !== "string") throw invalidHostResponse()
  try {
    return normalizeUuid(value, label)
  } catch {
    throw invalidHostResponse()
  }
}

function nonNegativeInteger(record: JsonRecord, name: string, maximum: number): number {
  const value = requireSafeInteger(record, name)
  if (value < 0 || value > maximum) throw invalidHostResponse()
  return value
}

function positiveInteger(record: JsonRecord, name: string, maximum: number): number {
  const value = nonNegativeInteger(record, name, maximum)
  if (value < 1) throw invalidHostResponse()
  return value
}

function requireEnum<const Values extends readonly string[]>(record: JsonRecord, name: string, values: Values): Values[number] {
  const value = requireString(record, name)
  if (!(values as readonly string[]).includes(value)) throw invalidHostResponse()
  return value as Values[number]
}

function sortedPortableSettings(
  settings: Readonly<Record<string, PortableAgentSettingValue>>,
): Record<string, PortableAgentSettingValue> {
  return Object.fromEntries(Object.entries(settings).sort(([left], [right]) => left.localeCompare(right)))
}

export function parsePortableSelectionSettings(value: unknown): Readonly<Record<string, PortableAgentSettingValue>> {
  const settings = requireRecord(value)
  const entries = Object.entries(settings)
  if (entries.length > 128) throw invalidHostResponse()
  const parsed: Record<string, PortableAgentSettingValue> = Object.create(null) as Record<string, PortableAgentSettingValue>
  for (const [key, rawValue] of entries) {
    if (!/^[a-z][a-zA-Z0-9]{0,127}$/u.test(key) ||
      /(?:apiKey|accessToken|refreshToken|authToken|bearerToken|password|passwd|clientSecret|privateKey|credential)/iu.test(key) ||
      /^(?:secret|token)$/iu.test(key)) throw invalidHostResponse()
    parsed[key] = parsePortableSettingValue(rawValue)
  }
  return Object.freeze(parsed)
}

function parseAgentRun(run: JsonRecord): AgentRun {
  requireKeys(
    run,
    ["schemaVersion", "id", "charterId", "productId", "initiativeId", "agent", "state"],
    ["revision", "charterDigest", "providerSessionRef", "startedAt", "endedAt", "previousRunId"],
  )
  if (requireSafeInteger(run, "schemaVersion") !== 1) throw invalidHostResponse()
  const revision = Object.hasOwn(run, "revision") ? requireSafeInteger(run, "revision") : undefined
  if (revision !== undefined && revision < 1) throw invalidHostResponse()
  const state = requireString(run, "state")
  if (!(/* keep this aligned with contracts/execution.ts */[
    "prepared", "running", "paused", "completed", "failed", "cancelled", "unknown",
  ] as const).includes(state as AgentRunState)) throw invalidHostResponse()
  const charterDigest = Object.hasOwn(run, "charterDigest") ? requireDigest(run, "charterDigest") : undefined
  const providerSessionRef = Object.hasOwn(run, "providerSessionRef") ? requireDigest(run, "providerSessionRef") : undefined
  const startedAt = Object.hasOwn(run, "startedAt") ? requireTimestamp(run, "startedAt") : undefined
  const endedAt = Object.hasOwn(run, "endedAt") ? requireTimestamp(run, "endedAt") : undefined
  const previousRunId = Object.hasOwn(run, "previousRunId")
    ? normalizeUuid(requireString(run, "previousRunId"), "Previous Run ID")
    : undefined
  return Object.freeze({
    schemaVersion: 1,
    id: normalizeUuid(requireString(run, "id"), "Run ID"),
    ...(revision !== undefined ? { revision } : {}),
    charterId: normalizeUuid(requireString(run, "charterId"), "Charter ID"),
    ...(charterDigest !== undefined ? { charterDigest } : {}),
    productId: normalizeUuid(requireString(run, "productId"), "Product ID"),
    initiativeId: normalizeUuid(requireString(run, "initiativeId"), "Initiative ID"),
    agent: parseAgentSelection(run.agent),
    state: state as AgentRunState,
    ...(providerSessionRef !== undefined ? { providerSessionRef } : {}),
    ...(startedAt !== undefined ? { startedAt } : {}),
    ...(endedAt !== undefined ? { endedAt } : {}),
    ...(previousRunId !== undefined ? { previousRunId } : {}),
  })
}

function parseHandoffWorkspaceBaseline(baseline: JsonRecord): HandoffWorkspaceBaseline {
  requireKeys(baseline, ["dirty", "changedFiles"], ["gitHead", "truthClass", "observationError"])
  const gitHead = Object.hasOwn(baseline, "gitHead") ? requireString(baseline, "gitHead") : undefined
  if (gitHead !== undefined && !/^[0-9a-f]{7,64}$/iu.test(gitHead)) throw invalidHostResponse()
  const dirty = baseline.dirty
  if (dirty !== null && typeof dirty !== "boolean") throw invalidHostResponse()
  if (!Array.isArray(baseline.changedFiles) || baseline.changedFiles.length > 20_000) throw invalidHostResponse()
  const changedFiles = Object.freeze(baseline.changedFiles.map((path) => workspaceRelativePath(path)))
  if (new Set(changedFiles).size !== changedFiles.length) throw invalidHostResponse()
  const truthClass = Object.hasOwn(baseline, "truthClass")
    ? requireTruthClass(baseline, "truthClass")
    : undefined
  const observationError = Object.hasOwn(baseline, "observationError")
    ? portableHandoffText(baseline.observationError, 1, 500)
    : undefined
  return Object.freeze({
    ...(gitHead !== undefined ? { gitHead } : {}),
    dirty,
    changedFiles,
    ...(truthClass !== undefined ? { truthClass } : {}),
    ...(observationError !== undefined ? { observationError } : {}),
  })
}

function parseHandoffTextArray(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length > 512) throw invalidHostResponse()
  return Object.freeze(value.map((item) => portableHandoffText(item, 1)))
}

function portableHandoffText(value: unknown, minimum: number, maximum = 5_000): string {
  const parsed = portableText(value, minimum, maximum)
  if (parsed !== parsed.trim() ||
    /(?:^|[\s(="'])(?:~[\\/]|\/(?!\/)[^\s"'<>)]*|[A-Za-z]:[\\/][^\s"'<>)]*|\\\\[^\s"'<>)]*|file:\/\/[^\s"'<>)]*)/u.test(parsed)) {
    throw invalidHostResponse()
  }
  return parsed
}

function workspaceRelativePath(value: unknown): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 4_096 || value === ".") throw invalidHostResponse()
  const segments = value.split("/")
  if (value.startsWith("/") || /^[A-Za-z]:/u.test(value) || value.startsWith("~") || value.includes("\\") ||
    value.includes("\0") || /%2e/iu.test(value) || segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw invalidHostResponse()
  }
  return value
}

function workspaceRelativeScope(value: unknown): string {
  return value === "." ? "." : workspaceRelativePath(value)
}

function parseAgentReadinessSnapshot(snapshot: JsonRecord): AgentReadinessSnapshot {
  requireExactKeys(snapshot, [
    "schemaVersion", "adapterId", "adapterVersion", "agentId", "agentLabel", "runtimeVersion", "detected",
    "executionInterface", "interfaceMaturity", "supportsResume", "supportsCancel", "supportsCheckpoints",
    "supportsModelDiscovery", "supportsToolSelection", "settings", "models", "limitations", "observedAt",
  ].filter((key) => key !== "runtimeVersion" || Object.hasOwn(snapshot, "runtimeVersion")))
  if (requireSafeInteger(snapshot, "schemaVersion") !== 1) throw invalidHostResponse()
  const adapterId = requirePortableText(snapshot, "adapterId", 1)
  const adapterVersion = requirePortableText(snapshot, "adapterVersion", 1)
  const agentId = requirePortableText(snapshot, "agentId", 1)
  const agentLabel = requirePortableText(snapshot, "agentLabel", 1)
  const runtimeVersion = Object.hasOwn(snapshot, "runtimeVersion")
    ? requirePortableText(snapshot, "runtimeVersion")
    : undefined
  const executionInterface = requireString(snapshot, "executionInterface")
  const interfaceMaturity = requireString(snapshot, "interfaceMaturity")
  if (!(["cli-jsonl", "cli-stream-json", "stdio-rpc", "managed-in-process", "unavailable"] as const)
      .includes(executionInterface as AgentReadinessSnapshot["executionInterface"]) ||
    !(["stable", "beta", "experimental", "unknown"] as const)
      .includes(interfaceMaturity as AgentReadinessSnapshot["interfaceMaturity"])) {
    throw invalidHostResponse()
  }
  if (!Array.isArray(snapshot.settings) || snapshot.settings.length > 256 ||
    !Array.isArray(snapshot.models) || snapshot.models.length > 512 ||
    !Array.isArray(snapshot.limitations) || snapshot.limitations.length > 512) {
    throw invalidHostResponse()
  }
  const settings = Object.freeze(snapshot.settings.map((setting) => parseAgentSetting(setting)))
  const models = Object.freeze(snapshot.models.map((model) => parseAgentModel(requireRecord(model))))
  if (new Set(models.map((model) => model.id)).size !== models.length) throw invalidHostResponse()
  const limitations = Object.freeze(snapshot.limitations.map((limitation) => portableText(limitation)))
  return Object.freeze({
    schemaVersion: 1,
    adapterId,
    adapterVersion,
    agentId,
    agentLabel,
    ...(runtimeVersion !== undefined ? { runtimeVersion } : {}),
    detected: requireBoolean(snapshot, "detected"),
    executionInterface: executionInterface as AgentReadinessSnapshot["executionInterface"],
    interfaceMaturity: interfaceMaturity as AgentReadinessSnapshot["interfaceMaturity"],
    supportsResume: requireBoolean(snapshot, "supportsResume"),
    supportsCancel: requireBoolean(snapshot, "supportsCancel"),
    supportsCheckpoints: requireBoolean(snapshot, "supportsCheckpoints"),
    supportsModelDiscovery: requireBoolean(snapshot, "supportsModelDiscovery"),
    supportsToolSelection: requireBoolean(snapshot, "supportsToolSelection"),
    settingsCount: settings.length,
    settings,
    models,
    limitations,
    observedAt: requireTimestamp(snapshot, "observedAt"),
    capabilityDigest: canonicalDigest(snapshot),
  })
}

function parseAgentModel(model: JsonRecord): AgentModelReadiness {
  requireKeys(
    model,
    ["id", "label", "reasoningOptions", "inputModalities", "truthClass", "alias"],
    ["description", "contextWindow"],
  )
  const id = requirePortableText(model, "id", 1)
  const label = requirePortableText(model, "label", 1)
  if (Object.hasOwn(model, "description")) requirePortableText(model, "description")
  validatePortableTextArray(model.reasoningOptions, 64)
  validatePortableTextArray(model.inputModalities, 32)
  if (Object.hasOwn(model, "contextWindow")) {
    const contextWindow = requireSafeInteger(model, "contextWindow")
    if (contextWindow < 1) throw invalidHostResponse()
  }
  const truthClass = requireTruthClass(model, "truthClass")
  return Object.freeze({ id, label, truthClass, alias: requireBoolean(model, "alias") })
}

function parseAgentSetting(value: unknown): AgentSelectionSetting {
  const setting = requireRecord(value)
  requireKeys(
    setting,
    ["key", "label", "description", "kind", "required", "sensitive", "truthClass"],
    ["defaultValue", "options", "minimum", "maximum"],
  )
  const key = requireString(setting, "key")
  if (!/^[a-z][a-zA-Z0-9]{0,127}$/u.test(key)) throw invalidHostResponse()
  const label = requirePortableText(setting, "label", 1)
  const description = requirePortableText(setting, "description", 1)
  const kind = requireString(setting, "kind")
  if (!(["select", "boolean", "number", "string", "string-list"] as const)
      .includes(kind as AgentSelectionSetting["kind"])) throw invalidHostResponse()
  const required = requireBoolean(setting, "required")
  const sensitive = requireBoolean(setting, "sensitive")
  const truthClass = requireTruthClass(setting, "truthClass")
  const defaultValue = Object.hasOwn(setting, "defaultValue")
    ? parsePortableSettingValue(setting.defaultValue)
    : undefined
  if (Object.hasOwn(setting, "defaultValue")) {
    if (sensitive) throw invalidHostResponse()
  }
  let options: readonly AgentSettingOption[] | undefined
  if (Object.hasOwn(setting, "options")) {
    if (!Array.isArray(setting.options) || setting.options.length > 256) throw invalidHostResponse()
    options = Object.freeze(setting.options.map((value): AgentSettingOption => {
      const option = requireRecord(value)
      requireKeys(option, ["value", "label"], ["description"])
      const description = Object.hasOwn(option, "description")
        ? requirePortableText(option, "description")
        : undefined
      return Object.freeze({
        value: requirePortableText(option, "value"),
        label: requirePortableText(option, "label"),
        ...(description !== undefined ? { description } : {}),
      })
    }))
  }
  const bounds: { minimum?: number; maximum?: number } = {}
  for (const name of ["minimum", "maximum"]) {
    if (Object.hasOwn(setting, name) && (typeof setting[name] !== "number" || !Number.isFinite(setting[name]))) {
      throw invalidHostResponse()
    }
    if (typeof setting[name] === "number") bounds[name as "minimum" | "maximum"] = setting[name]
  }
  if (bounds.minimum !== undefined && bounds.maximum !== undefined && bounds.minimum > bounds.maximum) {
    throw invalidHostResponse()
  }
  return Object.freeze({
    key,
    label,
    description,
    kind: kind as AgentSelectionSetting["kind"],
    required,
    sensitive,
    ...(defaultValue !== undefined ? { defaultValue } : {}),
    ...(options !== undefined ? { options } : {}),
    ...bounds,
    truthClass,
  })
}

function parsePortableSettingValue(value: unknown): PortableAgentSettingValue {
  if (typeof value === "string") {
    return portableText(value, 0, 10_000)
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw invalidHostResponse()
    return value
  }
  if (typeof value === "boolean") return value
  if (!Array.isArray(value) || value.length > 256) throw invalidHostResponse()
  return Object.freeze(value.map((item) => portableText(item, 0, 10_000)))
}

function validatePortableTextArray(value: unknown, maximumItems: number, maximumText = 20_000): void {
  if (!Array.isArray(value) || value.length > maximumItems) throw invalidHostResponse()
  value.forEach((item) => portableText(item, 0, maximumText))
}

function requirePortableText(record: JsonRecord, name: string, minimum = 0): string {
  return portableText(requireString(record, name), minimum)
}

function requireTruthClass(record: JsonRecord, name: string): AgentTruthClass {
  const value = requireString(record, name)
  if (!(["observed", "provider-declared", "configured", "inferred", "unknown"] as const)
      .includes(value as AgentTruthClass)) throw invalidHostResponse()
  return value as AgentTruthClass
}

function portableText(value: unknown, minimum = 0, maximum = 20_000): string {
  if (typeof value !== "string" || value.length < minimum || value.length > maximum || containsControl(value) ||
    /^(?:\/[^\s]*|[A-Za-z]:[\\/][^\s]*|\\\\[^\s]*|file:\/\/[^\s]*)$/u.test(value.trim()) ||
    /(?:^|[\s(="'])(?:\/(?:Users|home|tmp|private|Volumes)\/[^\s"'<>)]*|[A-Za-z]:\\[^\s"'<>)]*|\\\\[^\s"'<>)]*)/u.test(value) ||
    /\bBearer\s+\S+|\b(?:sk|sk-ant)-[A-Za-z0-9_-]{8,}\b|\b(?:token|secret|password|passwd|api[_-]?key)\s*[:=]\s*\S+/iu.test(value)) {
    throw invalidHostResponse()
  }
  return value
}

export function parseSnapshotResult(
  result: unknown,
  expected: { readonly bundleId?: string; readonly productId?: string } = {},
): PortableDesignSnapshotSummary {
  const summary = parseSnapshot(requireRecord(result))
  if ((expected.bundleId && summary.bundleId !== normalizeUuid(expected.bundleId, "Bundle ID")) ||
    (expected.productId && summary.productId !== normalizeUuid(expected.productId, "Product ID"))) {
    throw invalidHostResponse()
  }
  return summary
}

export function parsePageResult(result: unknown, expectedOffset: number, expectedLimit: number): PortableDesignSnapshotPage {
  const page = requireRecord(result)
  requireExactKeys(page, ["items", "offset", "limit", "total", "hasMore", "governanceBoundary", "privacyBoundary"])
  if (!Array.isArray(page.items)) throw invalidHostResponse()
  const offset = requireSafeInteger(page, "offset")
  const limit = requireSafeInteger(page, "limit")
  const total = requireSafeInteger(page, "total")
  const hasMore = requireBoolean(page, "hasMore")
  if (offset !== expectedOffset || limit !== expectedLimit || offset < 0 || offset > maximumOffset ||
    limit < 1 || limit > maximumPageSize || total < 0 || page.items.length > limit ||
    page.items.length > maximumPageSize || (page.items.length > 0 && offset + page.items.length > total) ||
    hasMore !== (offset + page.items.length < total) ||
    requireString(page, "governanceBoundary") !== pageGovernanceBoundary ||
    requireString(page, "privacyBoundary") !== pagePrivacyBoundary) {
    throw invalidHostResponse()
  }
  const items = Object.freeze(page.items.map((item) => parseSnapshot(requireRecord(item))))
  if (new Set(items.map((item) => item.bundleId)).size !== items.length) throw invalidHostResponse()
  return Object.freeze({
    items,
    offset,
    limit,
    total,
    hasMore,
    governanceBoundary: pageGovernanceBoundary,
    privacyBoundary: pagePrivacyBoundary,
  })
}

function parseSnapshot(snapshot: JsonRecord): PortableDesignSnapshotSummary {
  requireKeys(
    snapshot,
    [
      "schemaVersion", "kind", "bundleId", "productId", "title", "classification", "governance",
      "sourceReview", "source", "counts", "digests", "timestamps", "privacyBoundary",
    ],
    ["initiativeId"],
  )
  if (requireSafeInteger(snapshot, "schemaVersion") !== 1 || requireString(snapshot, "kind") !== summaryKind) {
    throw invalidHostResponse()
  }
  const bundleId = normalizeUuid(requireString(snapshot, "bundleId"), "Bundle ID")
  const productId = normalizeUuid(requireString(snapshot, "productId"), "Product ID")
  const initiativeId = Object.hasOwn(snapshot, "initiativeId")
    ? normalizeUuid(requireString(snapshot, "initiativeId"), "Initiative ID")
    : undefined
  const title = requireString(snapshot, "title")
  if (title.length < 2 || title.length > 240 || title !== title.trim() || containsControl(title)) {
    throw invalidHostResponse()
  }
  const classification = requireString(snapshot, "classification")
  if (!["public", "internal", "confidential", "restricted"].includes(classification)) throw invalidHostResponse()

  const governance = requireRecord(snapshot.governance)
  requireExactKeys(governance, ["state", "humanReviewRequired", "claimBoundary", "nonEscalation"])
  if (requireString(governance, "state") !== governanceState ||
    requireBoolean(governance, "humanReviewRequired") !== true ||
    requireString(governance, "claimBoundary") !== claimBoundary ||
    requireString(governance, "nonEscalation") !== nonEscalation) {
    throw invalidHostResponse()
  }

  const sourceReview = requireRecord(snapshot.sourceReview)
  requireExactKeys(sourceReview, ["status", "claimLabel", "gaepApproval"])
  const reviewStatus = requireString(sourceReview, "status")
  if (!["unreviewed", "reviewed", "approved"].includes(reviewStatus)) throw invalidHostResponse()
  const expectedClaim = `${reviewStatus} upstream claim; not GAEP approval, a Design Baseline, implementation readiness, or release readiness`
  if (requireString(sourceReview, "claimLabel") !== expectedClaim || requireBoolean(sourceReview, "gaepApproval")) {
    throw invalidHostResponse()
  }

  const source = requireRecord(snapshot.source)
  requireExactKeys(source, ["tool", "exportMethod"])
  const tool = requireString(source, "tool")
  const exportMethod = requireString(source, "exportMethod")
  if (tool.length < 1 || tool.length > 80 || !toolPattern.test(tool) ||
    !["manual-export", "design-tool-export", "plugin-export"].includes(exportMethod)) {
    throw invalidHostResponse()
  }

  const counts = requireRecord(snapshot.counts)
  requireExactKeys(counts, ["artifacts", "normalizedDesignTokens", "validationChecks", "recordedLimitations"])
  const artifactCount = requireSafeInteger(counts, "artifacts")
  const tokenCount = requireSafeInteger(counts, "normalizedDesignTokens")
  const validationChecks = requireSafeInteger(counts, "validationChecks")
  const recordedLimitations = requireSafeInteger(counts, "recordedLimitations")
  if (artifactCount < 1 || artifactCount > 512 || tokenCount < 0 || tokenCount > 5_000 ||
    validationChecks !== 6 || recordedLimitations < 1 || recordedLimitations > 32) {
    throw invalidHostResponse()
  }

  const digests = requireRecord(snapshot.digests)
  requireExactKeys(digests, ["snapshot", "evidence", "manifest", "artifactInventory"])
  const parsedDigests = Object.freeze({
    snapshot: requireDigest(digests, "snapshot"),
    evidence: requireDigest(digests, "evidence"),
    manifest: requireDigest(digests, "manifest"),
    artifactInventory: requireDigest(digests, "artifactInventory"),
  })

  const timestamps = requireRecord(snapshot.timestamps)
  requireExactKeys(timestamps, ["sourceExportedAt", "importedAt"])
  const parsedTimestamps = Object.freeze({
    sourceExportedAt: requireTimestamp(timestamps, "sourceExportedAt"),
    importedAt: requireTimestamp(timestamps, "importedAt"),
  })
  if (requireString(snapshot, "privacyBoundary") !== summaryPrivacyBoundary) throw invalidHostResponse()

  const summary: PortableDesignSnapshotSummary = {
    schemaVersion: 1,
    kind: summaryKind,
    bundleId,
    productId,
    ...(initiativeId ? { initiativeId } : {}),
    title,
    classification: classification as PortableDesignClassification,
    governance: Object.freeze({
      state: governanceState,
      humanReviewRequired: true,
      claimBoundary,
      nonEscalation,
    }),
    sourceReview: Object.freeze({
      status: reviewStatus as PortableDesignSourceReviewStatus,
      claimLabel: expectedClaim,
      gaepApproval: false,
    }),
    source: Object.freeze({ tool, exportMethod: exportMethod as PortableDesignExportMethod }),
    counts: Object.freeze({
      artifacts: artifactCount,
      normalizedDesignTokens: tokenCount,
      validationChecks,
      recordedLimitations,
    }),
    digests: parsedDigests,
    timestamps: parsedTimestamps,
    privacyBoundary: summaryPrivacyBoundary,
  }
  return Object.freeze(summary)
}

function parseHostError(error: JsonRecord): GaepHostError {
  requireExactKeys(error, ["code", "message", "data"])
  const code = requireSafeInteger(error, "code")
  requireString(error, "message")
  const data = requireRecord(error.data)
  requireKeys(data, ["kind"], ["detail"])
  const kind = requireString(data, "kind")
  const stable = stableHostErrors.get(kind)
  if (!stable) return new GaepHostError(-32_603, "HOST_ERROR", "The GAEP engine could not complete the request.")
  if (stable.code !== code) return invalidHostResponse()
  return new GaepHostError(stable.code, kind, stable.message)
}

class StrictJsonParser {
  private offset = 0

  constructor(private readonly raw: string) {}

  parse(): unknown {
    const value = this.parseValue(0)
    this.skipWhitespace()
    if (this.offset !== this.raw.length) throw invalidHostResponse()
    return value
  }

  private parseValue(depth: number): unknown {
    if (depth > maximumJsonDepth) throw invalidHostResponse()
    this.skipWhitespace()
    const token = this.raw[this.offset]
    if (token === "{") return this.parseObject(depth)
    if (token === "[") return this.parseArray(depth)
    if (token === "\"") return this.parseString()
    if (token === "t") return this.parseLiteral("true", true)
    if (token === "f") return this.parseLiteral("false", false)
    if (token === "n") return this.parseLiteral("null", null)
    if (token === "-" || (token !== undefined && token >= "0" && token <= "9")) return this.parseNumber()
    throw invalidHostResponse()
  }

  private parseObject(depth: number): JsonRecord {
    this.offset++
    const value: JsonRecord = Object.create(null) as JsonRecord
    const names = new Set<string>()
    this.skipWhitespace()
    if (this.raw[this.offset] === "}") {
      this.offset++
      return value
    }
    while (true) {
      if (names.size >= maximumJsonCollectionEntries || this.raw[this.offset] !== "\"") throw invalidHostResponse()
      const name = this.parseString()
      if (names.has(name)) throw invalidHostResponse()
      names.add(name)
      this.skipWhitespace()
      if (this.raw[this.offset++] !== ":") throw invalidHostResponse()
      value[name] = this.parseValue(depth + 1)
      this.skipWhitespace()
      const delimiter = this.raw[this.offset++]
      if (delimiter === "}") return value
      if (delimiter !== ",") throw invalidHostResponse()
      this.skipWhitespace()
    }
  }

  private parseArray(depth: number): unknown[] {
    this.offset++
    const value: unknown[] = []
    this.skipWhitespace()
    if (this.raw[this.offset] === "]") {
      this.offset++
      return value
    }
    while (true) {
      if (value.length >= maximumJsonCollectionEntries) throw invalidHostResponse()
      value.push(this.parseValue(depth + 1))
      this.skipWhitespace()
      const delimiter = this.raw[this.offset++]
      if (delimiter === "]") return value
      if (delimiter !== ",") throw invalidHostResponse()
      this.skipWhitespace()
    }
  }

  private parseString(): string {
    const start = this.offset
    this.offset++
    while (this.offset < this.raw.length) {
      const character = this.raw[this.offset++]!
      if (character === "\"") {
        try {
          return JSON.parse(this.raw.slice(start, this.offset)) as string
        } catch {
          throw invalidHostResponse()
        }
      }
      if (character.charCodeAt(0) < 0x20) throw invalidHostResponse()
      if (character !== "\\") continue
      const escape = this.raw[this.offset++]
      if (escape === "u") {
        const digits = this.raw.slice(this.offset, this.offset + 4)
        if (!/^[0-9a-fA-F]{4}$/u.test(digits)) throw invalidHostResponse()
        this.offset += 4
      } else if (!escape || !"\"\\/bfnrt".includes(escape)) {
        throw invalidHostResponse()
      }
    }
    throw invalidHostResponse()
  }

  private parseNumber(): number {
    const start = this.offset
    if (this.raw[this.offset] === "-") this.offset++
    if (this.raw[this.offset] === "0") {
      this.offset++
      if (isDigit(this.raw[this.offset])) throw invalidHostResponse()
    } else {
      if (!isDigitOneToNine(this.raw[this.offset])) throw invalidHostResponse()
      while (isDigit(this.raw[this.offset])) this.offset++
    }
    if (this.raw[this.offset] === ".") {
      this.offset++
      if (!isDigit(this.raw[this.offset])) throw invalidHostResponse()
      while (isDigit(this.raw[this.offset])) this.offset++
    }
    if (this.raw[this.offset] === "e" || this.raw[this.offset] === "E") {
      this.offset++
      if (this.raw[this.offset] === "+" || this.raw[this.offset] === "-") this.offset++
      if (!isDigit(this.raw[this.offset])) throw invalidHostResponse()
      while (isDigit(this.raw[this.offset])) this.offset++
    }
    const value = Number(this.raw.slice(start, this.offset))
    if (!Number.isFinite(value)) throw invalidHostResponse()
    return value
  }

  private parseLiteral<T>(literal: string, value: T): T {
    if (this.raw.slice(this.offset, this.offset + literal.length) !== literal) throw invalidHostResponse()
    this.offset += literal.length
    return value
  }

  private skipWhitespace(): void {
    while ([" ", "\t", "\r", "\n"].includes(this.raw[this.offset] ?? "")) this.offset++
  }
}

function parseStrictJson(raw: string): unknown {
  try {
    return new StrictJsonParser(raw).parse()
  } catch (error) {
    if (error instanceof GaepHostError) throw error
    throw invalidHostResponse()
  }
}

function requireRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalidHostResponse()
  return value as JsonRecord
}

function requireString(record: JsonRecord, name: string): string {
  const value = record[name]
  if (typeof value !== "string") throw invalidHostResponse()
  return value
}

function requireBoolean(record: JsonRecord, name: string): boolean {
  const value = record[name]
  if (typeof value !== "boolean") throw invalidHostResponse()
  return value
}

function requireSafeInteger(record: JsonRecord, name: string): number {
  const value = record[name]
  if (!Number.isSafeInteger(value)) throw invalidHostResponse()
  return value as number
}

function requireDigest(record: JsonRecord, name: string): string {
  const value = requireString(record, name)
  if (!digestPattern.test(value)) throw invalidHostResponse()
  return value
}

function requireTimestamp(record: JsonRecord, name: string): string {
  const value = requireString(record, name)
  const match = rfc3339Pattern.exec(value)
  if (!match) throw invalidHostResponse()
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6])
  const offsetHour = Number(match[8] ?? 0)
  const offsetMinute = Number(match[9] ?? 0)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth || hour > 23 || minute > 59 || second > 59 ||
    offsetHour > 23 || offsetMinute > 59 || !Number.isFinite(Date.parse(value))) {
    throw invalidHostResponse()
  }
  return value
}

function requireExactKeys(record: JsonRecord, expected: readonly string[]): void {
  const keys = Object.keys(record)
  if (keys.length !== expected.length || keys.some((key) => !expected.includes(key))) throw invalidHostResponse()
}

function requireKeys(record: JsonRecord, required: readonly string[], optional: readonly string[]): void {
  const keys = Object.keys(record)
  if (required.some((key) => !Object.hasOwn(record, key)) || keys.some((key) => !required.includes(key) && !optional.includes(key))) {
    throw invalidHostResponse()
  }
}

function isNetworkPath(value: string): boolean {
  return value.startsWith("//") || value.startsWith("\\\\")
}

function containsControl(value: string): boolean {
  return /[\u0000-\u001F\u007F-\u009F]/u.test(value)
}

function isDigit(value: string | undefined): boolean {
  return value !== undefined && value >= "0" && value <= "9"
}

function isDigitOneToNine(value: string | undefined): boolean {
  return value !== undefined && value >= "1" && value <= "9"
}
