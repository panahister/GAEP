package dev.gaep.rider

import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonNull
import com.google.gson.JsonObject
import com.google.gson.JsonPrimitive
import com.google.gson.Strictness
import com.google.gson.stream.JsonReader
import com.google.gson.stream.JsonToken
import java.io.StringReader
import java.math.BigDecimal
import java.net.URI
import java.nio.file.Files
import java.nio.file.Path
import java.security.MessageDigest
import java.time.Instant
import java.util.UUID

enum class PortableDesignClassification {
    PUBLIC,
    INTERNAL,
    CONFIDENTIAL,
    RESTRICTED,
}

enum class PortableDesignSourceReviewStatus {
    UNREVIEWED,
    REVIEWED,
    APPROVED,
}

enum class PortableDesignExportMethod {
    MANUAL_EXPORT,
    DESIGN_TOOL_EXPORT,
    PLUGIN_EXPORT,
}

data class ProductBinding(
    val id: UUID,
    val name: String,
    val revision: Long,
    val digest: String,
)

enum class DeliveryPhaseId(val wireValue: String) {
    PHASE_0_1A_FOUNDATION("phase-0-1a-foundation"),
    PHASE_1B_PRODUCT("phase-1b-product"),
    PHASE_1C_ACCEPTANCE("phase-1c-acceptance"),
    PHASE_2_DESIGN("phase-2-design"),
    PHASE_3A_READINESS("phase-3a-readiness"),
    PHASE_3B_IMPLEMENTATION("phase-3b-implementation"),
    PHASE_4_RELEASE_LEARNING("phase-4-release-learning"),
}

data class PhaseDashboardDecision(
    val recordId: UUID,
    val revision: Long,
    val digest: String,
)

data class PhaseDashboardApplicability(
    val status: String,
    val basis: String,
    val decision: PhaseDashboardDecision?,
)

data class PhaseDashboardPanel(
    val id: String,
    val role: String,
    val title: String,
    val applicability: PhaseDashboardApplicability,
    val state: String,
)

data class DashboardEvidenceCues(
    val freshness: String,
    val confidenceState: String,
    val confidenceBasis: String,
)

data class PhaseDashboardFramework(
    val productId: UUID,
    val productRevision: Long,
    val productDigest: String,
    val phase: DeliveryPhaseId,
    val phaseLabel: String,
    val panels: List<PhaseDashboardPanel>,
    val evidenceCues: DashboardEvidenceCues,
    val observedAt: Instant,
    val sourceBoundary: String,
    val limitations: List<String>,
    val compositionDigest: String,
)

data class Phase1SummaryDashboard(
    val productId: UUID,
    val productRevision: Long,
    val productDigest: String,
    val initiativeId: UUID,
    val initiativeRevision: Long,
    val initiativeDigest: String,
    val initiativeState: String,
    val phaseState: String,
    val declaredGapCount: Long,
    val attentionSignalCount: Int,
    val readinessResult: String,
    val readinessSatisfiedOutputs: Long,
    val readinessApplicableOutputs: Long,
    val readinessTotalOutputs: Long,
    val readinessGapCount: Long,
    val handoffState: String,
    val handoffTransferState: String,
    val handoffIncludedItems: Long,
    val handoffTotalItems: Long,
    val handoffGapCount: Long,
    val freshnessState: String,
    val staleBindingCount: Long,
    val staleSourceReferenceCount: Long,
    val observedAt: Instant,
    val sourceBoundary: String,
    val privacyBoundary: String,
    val limitations: List<String>,
    val snapshotDigest: String,
)

data class Phase1ChangeImpactOutput(
    val outputKind: String,
    val recordKind: String,
    val readinessApplicability: String,
    val readinessEvaluationState: String,
    val readinessFreshness: String,
    val readinessSubjectCount: Long,
    val impactState: String,
    val exactMatchedSubjectCount: Long,
    val traceReferenceCount: Long,
    val handoffDisposition: String,
    val handoffFreshness: String,
    val revalidationState: String,
)

data class Phase1ChangeImpactDashboard(
    val productId: UUID,
    val productRevision: Long,
    val productDigest: String,
    val initiativeId: UUID,
    val initiativeRevision: Long,
    val initiativeDigest: String,
    val initiativeState: String,
    val change: ChangeImpactChangeReference,
    val changedArtifactCount: Long,
    val effectTargetCount: Long,
    val affectedUnitCount: Long,
    val outputs: List<Phase1ChangeImpactOutput>,
    val currentTraceObservedOutputCount: Int,
    val attentionRequiredOutputCount: Int,
    val impactNotEstablishedOutputCount: Int,
    val freshnessState: String,
    val traceAttentionLinkCount: Long,
    val staleBindingCount: Long,
    val observedAt: Instant,
    val limitations: List<String>,
    val snapshotDigest: String,
)

data class ChangeImpactChangeReference(
    val recordId: UUID,
    val revision: Long,
    val digest: String,
    val state: String,
    val effectEnvelope: List<String>,
)

data class ChangeImpactChangeCatalog(
    val productId: UUID,
    val productRevision: Long,
    val productDigest: String,
    val items: List<ChangeImpactChangeReference>,
    val total: Long,
    val omitted: Long,
    val observedAt: Instant,
    val limitations: List<String>,
    val snapshotDigest: String,
)

data class ChangeImpactExactReference(
    val recordType: String,
    val recordId: UUID,
    val revision: Long,
    val digest: String,
)

data class ChangeImpactLocator(val kind: String, val value: String)

data class ChangeImpactWorkItem(val record: ChangeImpactExactReference, val state: String)

data class ChangeImpactArtifact(
    val sourceWorkItem: ChangeImpactExactReference,
    val locator: ChangeImpactLocator,
)

data class ChangeImpactTraceEndpoint(
    val recordType: String,
    val recordId: String,
    val revision: Long?,
    val digest: String?,
)

data class ChangeImpactTraceAssessment(
    val recordId: UUID,
    val revision: Long,
    val assessmentDigest: String,
    val assessedState: String,
)

data class ChangeImpactAffectedUnit(
    val direction: String,
    val relationship: String,
    val endpoint: ChangeImpactTraceEndpoint,
    val trace: ChangeImpactTraceAssessment,
)

data class ChangeImpactDecision(
    val record: ChangeImpactExactReference,
    val state: String,
    val outcome: String,
)

data class ChangeImpactRisk(
    val record: ChangeImpactExactReference,
    val state: String,
    val likelihood: String,
    val impact: String,
    val acceptance: String,
)

data class ChangeImpactFreshness(
    val state: String,
    val evaluatedAt: Instant,
    val unresolvedTraceLinks: Long,
    val invalidTraceLinks: Long,
    val staleTraceLinks: Long,
    val staleGovernanceReferences: Long,
    val traceAnalysisTruncated: Boolean,
)

data class ChangeImpactLimit(val shown: Long, val total: Long, val omitted: Long)

data class ChangeImpactLimits(
    val workItems: ChangeImpactLimit,
    val changedArtifacts: ChangeImpactLimit,
    val effectTargets: ChangeImpactLimit,
    val affectedUnits: ChangeImpactLimit,
    val decisions: ChangeImpactLimit,
    val risks: ChangeImpactLimit,
    val truncated: Boolean,
)

data class ChangeImpactDashboard(
    val productId: UUID,
    val productRevision: Long,
    val productDigest: String,
    val change: ChangeImpactChangeReference,
    val workItems: List<ChangeImpactWorkItem>,
    val changedArtifacts: List<ChangeImpactArtifact>,
    val effectTargets: List<ChangeImpactArtifact>,
    val affectedUnits: List<ChangeImpactAffectedUnit>,
    val decisions: List<ChangeImpactDecision>,
    val risks: List<ChangeImpactRisk>,
    val freshness: ChangeImpactFreshness,
    val evidenceCues: DashboardEvidenceCues,
    val limits: ChangeImpactLimits,
    val observedAt: Instant,
    val sourceBoundary: String,
    val limitations: List<String>,
    val snapshotDigest: String,
)

data class AgentModelLimit(val shown: Long, val total: Long, val omitted: Long)

data class AgentModelCapability(
    val adapterId: String,
    val adapterVersion: String,
    val agentId: String,
    val agentLabel: String,
    val runtimeVersion: String?,
    val capabilityDigest: String,
    val detected: Boolean,
    val executionInterface: String,
    val interfaceMaturity: String,
    val modelCount: Long,
    val limitationShown: Long,
    val limitationTotal: Long,
    val observedAt: Instant,
    val selected: Boolean,
)

data class AgentModelSelectionProjection(
    val status: String,
    val selectionDigest: String?,
    val adapterId: String?,
    val agentId: String?,
    val modelId: String?,
    val modelTruthClass: String?,
    val modelAlias: Boolean?,
    val settings: Map<String, PortableAgentSettingValue>,
    val selectedAt: Instant?,
    val capabilityDigest: String?,
    val capabilityState: String?,
)

data class AgentModelManagedProjection(
    val status: String,
    val recordId: UUID?,
    val state: String?,
    val attemptNumber: Long?,
    val resultStatus: String?,
    val providerDisposition: String?,
    val outcomeStatus: String?,
    val evidenceId: UUID?,
    val eventCount: Long?,
    val actualEffectCount: Long?,
)

data class AgentModelRunProjection(
    val recordId: UUID,
    val revision: Long,
    val initiativeId: UUID,
    val state: String,
    val adapterId: String,
    val agentId: String,
    val modelId: String,
    val managed: AgentModelManagedProjection,
)

data class AgentModelHandoffProjection(
    val recordId: UUID,
    val fromRunId: UUID,
    val toAdapterId: String,
    val toAgentId: String,
    val toModelId: String,
    val state: String,
    val createdAt: Instant,
)

data class AgentModelFreshness(
    val state: String,
    val selectionCapabilityState: String,
    val oldestCapabilityObservedAt: Instant,
    val newestCapabilityObservedAt: Instant,
    val truncated: Boolean,
)

data class AgentModelDashboard(
    val productId: UUID,
    val productRevision: Long,
    val productDigest: String,
    val capabilities: List<AgentModelCapability>,
    val selection: AgentModelSelectionProjection,
    val runs: List<AgentModelRunProjection>,
    val handoffs: List<AgentModelHandoffProjection>,
    val freshness: AgentModelFreshness,
    val evidenceCues: DashboardEvidenceCues,
    val capabilityLimit: AgentModelLimit,
    val runLimit: AgentModelLimit,
    val handoffLimit: AgentModelLimit,
    val managedRunLimit: AgentModelLimit,
    val truncated: Boolean,
    val observedAt: Instant,
    val sourceBoundary: String,
    val limitations: List<String>,
    val snapshotDigest: String,
)

data class Phase1AgentModelCapabilityTruth(
    val shown: Long,
    val total: Long,
    val omitted: Long,
    val detected: Long,
    val unavailable: Long,
    val selected: Long,
)

data class Phase1AgentModelOutcomeTruth(
    val satisfied: Long,
    val failed: Long,
    val notAssessed: Long,
    val indeterminate: Long,
)

data class Phase1AgentModelRunTruth(
    val shown: Long,
    val total: Long,
    val omitted: Long,
    val terminal: Long,
    val nonTerminal: Long,
    val managedObserved: Long,
    val resultBound: Long,
    val actualEffectCount: Long,
    val outcomes: Phase1AgentModelOutcomeTruth,
)

data class Phase1AgentModelHandoffTruth(
    val shown: Long,
    val total: Long,
    val omitted: Long,
    val pendingAcknowledgement: Long,
    val acknowledged: Long,
)

data class Phase1AgentModelDashboard(
    val productId: UUID,
    val productRevision: Long,
    val productDigest: String,
    val initiativeId: UUID,
    val initiativeRevision: Long,
    val initiativeDigest: String,
    val initiativeState: String,
    val agentModel: AgentModelDashboard,
    val capabilities: Phase1AgentModelCapabilityTruth,
    val runs: Phase1AgentModelRunTruth,
    val managedRuns: AgentModelLimit,
    val handoffs: Phase1AgentModelHandoffTruth,
    val freshnessState: String,
    val selectionCapabilityState: String,
    val liveProviderQuality: String,
    val semanticOutputQuality: String,
    val productOwnerAcceptance: String,
    val observedAt: Instant,
    val sourceBoundary: String,
    val privacyBoundary: String,
    val limitations: List<String>,
    val snapshotDigest: String,
)

private data class AgentModelReference(
    val recordId: UUID,
    val revision: Long,
    val digest: String,
)

data class AgentModelReadiness(
    val id: String,
    val label: String,
    val truthClass: String,
    val alias: Boolean,
)

sealed interface PortableAgentSettingValue {
    data class Text(val value: String) : PortableAgentSettingValue
    data class Decimal(val value: BigDecimal) : PortableAgentSettingValue
    data class Flag(val value: Boolean) : PortableAgentSettingValue
    data class TextList(val value: List<String>) : PortableAgentSettingValue
}

data class AgentSettingOption(
    val value: String,
    val label: String,
    val description: String?,
)

data class AgentSelectionSetting(
    val key: String,
    val label: String,
    val description: String,
    val kind: String,
    val required: Boolean,
    val sensitive: Boolean,
    val defaultValue: PortableAgentSettingValue?,
    val options: List<AgentSettingOption>?,
    val minimum: BigDecimal?,
    val maximum: BigDecimal?,
    val truthClass: String,
)

data class AgentSelection(
    val schemaVersion: Int,
    val adapterId: String,
    val agentId: String,
    val modelId: String,
    val modelTruthClass: String,
    val modelAlias: Boolean?,
    val settings: Map<String, PortableAgentSettingValue>,
    val selectedAt: Instant,
    val capabilityDigest: String,
    val selectionDigest: String,
)

sealed interface AgentSelectionState {
    data object Unselected : AgentSelectionState
    data class Selected(val selection: AgentSelection) : AgentSelectionState
    data class MigrationRequired(val portableCandidate: AgentSelection) : AgentSelectionState
    data object Invalid : AgentSelectionState
}

enum class AgentRunState {
    PREPARED,
    RUNNING,
    PAUSED,
    COMPLETED,
    FAILED,
    CANCELLED,
    UNKNOWN,
}

data class AgentRun(
    val schemaVersion: Int,
    val id: UUID,
    val revision: Long?,
    val charterId: UUID,
    val charterDigest: String?,
    val productId: UUID,
    val initiativeId: UUID,
    val agent: AgentSelection,
    val state: AgentRunState,
    val providerSessionRef: String?,
    val startedAt: Instant?,
    val endedAt: Instant?,
    val previousRunId: UUID?,
)

data class HandoffWorkspaceBaseline(
    val gitHead: String?,
    val dirty: Boolean?,
    val changedFiles: List<String>,
    val truthClass: String?,
    val observationError: String?,
)

data class AgentHandoff(
    val schemaVersion: Int,
    val id: UUID,
    val productId: UUID,
    val initiativeId: UUID,
    val fromRunId: UUID,
    val toAgent: AgentSelection,
    val reason: String,
    val workspaceBaseline: HandoffWorkspaceBaseline,
    val completedWork: List<String>,
    val unresolvedMatters: List<String>,
    val decisions: List<String>,
    val evidence: List<String>,
    val capabilityDifferences: List<String>,
    val createdAt: Instant,
    val acknowledgedAt: Instant?,
)

data class ManagedReadOnlyGatePreview(
    val key: String,
    val stepId: UUID?,
    val phase: String,
    val criteria: List<String>,
    val criteriaDigest: String,
)

data class ManagedReadOnlyPreview(
    val schemaVersion: Int,
    val kind: String,
    val productId: UUID,
    val initiativeId: UUID,
    val charterId: UUID,
    val charterDigest: String,
    val workflowPlanId: UUID,
    val workflowPlanDigest: String,
    val adapterId: String,
    val agentId: String,
    val modelId: String,
    val selectionDigest: String,
    val strategy: String,
    val stepIds: List<UUID>,
    val contextPackCount: Int,
    val readScopeCount: Int,
    val gates: List<ManagedReadOnlyGatePreview>,
    val authorityBoundary: String,
    val previewDigest: String,
)

data class ManagedReadOnlyReceipt(
    val schemaVersion: Int,
    val kind: String,
    val previewDigest: String,
    val runId: UUID,
    val managedRunId: UUID,
    val productId: UUID,
    val initiativeId: UUID,
    val adapterId: String,
    val agentId: String,
    val modelId: String,
    val mode: String,
    val state: String,
    val providerDisposition: String,
    val outcomeStatus: String,
    val outcomeBasis: String,
    val eventCount: Int,
    val completedStepCount: Int,
    val totalStepCount: Int,
    val resultDigest: String,
    val evidenceDigest: String,
    val warnings: List<String>,
    val startedAt: Instant,
    val endedAt: Instant,
    val authorityBoundary: String,
)

data class ManagedRunSummary(
    val schemaVersion: Int,
    val kind: String,
    val managedRunId: UUID,
    val runId: UUID,
    val productId: UUID,
    val initiativeId: UUID,
    val mode: String,
    val state: String,
    val adapterId: String,
    val agentId: String,
    val modelId: String,
    val attemptNumber: Int,
    val recoveryStatus: String,
    val workflowCheckpointCount: Int,
    val hasResult: Boolean,
    val hasApplyDecision: Boolean,
    val bindingsDigest: String,
    val resultDigest: String?,
    val applyDecisionDigest: String?,
    val createdAt: Instant,
    val startedAt: Instant?,
    val updatedAt: Instant,
    val endedAt: Instant?,
    val authorityBoundary: String,
)

data class ManagedRunSummaryPage(
    val schemaVersion: Int,
    val kind: String,
    val items: List<ManagedRunSummary>,
    val offset: Int,
    val limit: Int,
    val total: Int,
    val omittedCount: Int,
    val snapshotDigest: String,
    val hasMore: Boolean,
    val authorityBoundary: String,
    val privacyBoundary: String,
)

data class ManagedEvidenceResult(
    val resultId: UUID,
    val resultDigest: String,
    val providerDisposition: String,
    val terminationCause: String,
    val outcomeStatus: String,
    val outcomeBasis: String,
    val terminalState: String,
    val evidenceId: UUID,
    val evidenceDigest: String,
    val warningCodes: List<String>,
    val startedAt: Instant,
    val endedAt: Instant,
)

data class ManagedStagingProjection(
    val changeCount: Int,
    val excludedPathCount: Int,
    val applyState: String,
    val baselineDigest: String,
    val finalDigest: String,
    val changedInventoryDigest: String,
    val excludedPathSetDigest: String,
)

data class ManagedEvidenceProjection(
    val evidenceId: UUID,
    val evidenceDigest: String,
    val eventCount: Int,
    val eventTypeCounts: Map<String, Int>,
    val eventsDigest: String,
    val workflowStrategy: String,
    val workflowStepCount: Int,
    val workflowAttemptCount: Int,
    val completedStepCount: Int,
    val charterEvidenceStatus: String,
    val charterStopStatus: String,
    val terminalReasonCode: String,
    val staging: ManagedStagingProjection?,
    val actualEffectCounts: Map<String, Int>,
    val capturedAt: Instant,
)

data class ManagedApplyDecisionProjection(
    val receiptId: UUID,
    val receiptDigest: String,
    val managedRunRevision: Int,
    val changedInventoryCount: Int,
    val writeEnvelopeCount: Int,
    val changedInventoryDigest: String,
    val writeEnvelopeDigest: String,
    val decidedAt: Instant,
)

data class ManagedEvidenceDetail(
    val schemaVersion: Int,
    val kind: String,
    val summary: ManagedRunSummary,
    val artifactStatus: String,
    val result: ManagedEvidenceResult?,
    val evidence: ManagedEvidenceProjection?,
    val applyDecision: ManagedApplyDecisionProjection?,
    val authorityBoundary: String,
    val privacyBoundary: String,
)

data class ManagedChangedFile(
    val path: String,
    val kind: String,
    val beforeDigest: String?,
    val afterDigest: String?,
    val beforeSize: Long?,
    val afterSize: Long?,
    val beforeMode: Int?,
    val afterMode: Int?,
)

data class ManagedReviewResult(
    val resultId: UUID,
    val resultDigest: String,
    val terminalState: String,
    val providerDisposition: String,
    val outcomeStatus: String,
    val outcomeBasis: String,
    val warningCodes: List<String>,
    val evidenceId: UUID,
    val evidenceDigest: String,
)

data class ManagedReviewStaging(
    val evidenceId: UUID,
    val evidenceDigest: String,
    val baselineDigest: String,
    val finalDigest: String,
    val applyState: String,
    val changeCount: Int,
    val changedInventoryLimit: Int,
    val omittedCount: Int,
    val changedInventory: List<ManagedChangedFile>,
    val changedInventoryDigest: String,
    val excludedPathCount: Int,
    val excludedPathSetDigest: String,
)

data class ManagedReviewApplyConfirmation(
    val decision: String,
    val reviewEvidenceId: UUID,
    val reviewEvidenceDigest: String,
    val changedInventoryDigest: String,
    val writeEnvelope: List<String>,
    val writeEnvelopeDigest: String,
)

data class ManagedReviewPreview(
    val schemaVersion: Int,
    val kind: String,
    val managedRunId: UUID,
    val managedRunRevision: Long,
    val runId: UUID,
    val productId: UUID,
    val initiativeId: UUID,
    val mode: String,
    val state: String,
    val canApply: Boolean,
    val canDiscard: Boolean,
    val hasLocalJournal: Boolean,
    val bindingsDigest: String,
    val result: ManagedReviewResult,
    val staging: ManagedReviewStaging,
    val applyConfirmation: ManagedReviewApplyConfirmation?,
    val postApplyGatePolicy: String,
    val authorityBoundary: String,
    val privacyBoundary: String,
    val cleanupBoundary: String,
    val previewDigest: String,
)

data class ManagedReviewTransition(
    val schemaVersion: Int,
    val kind: String,
    val decision: String,
    val sourcePreviewDigest: String,
    val sourceManagedRunRevision: Long,
    val managedRunId: UUID,
    val managedRunRevision: Long,
    val state: String,
    val canApply: Boolean,
    val canDiscard: Boolean,
    val hasLocalJournal: Boolean,
    val detail: ManagedEvidenceDetail,
    val authorityBoundary: String,
    val cleanupBoundary: String,
    val transitionDigest: String,
)

data class AgentReadinessSnapshot(
    val schemaVersion: Int,
    val adapterId: String,
    val adapterVersion: String,
    val agentId: String,
    val agentLabel: String,
    val runtimeVersion: String?,
    val detected: Boolean,
    val executionInterface: String,
    val interfaceMaturity: String,
    val supportsResume: Boolean,
    val supportsCancel: Boolean,
    val supportsCheckpoints: Boolean,
    val supportsModelDiscovery: Boolean,
    val supportsToolSelection: Boolean,
    val settingsCount: Int,
    val settings: List<AgentSelectionSetting>,
    val models: List<AgentModelReadiness>,
    val limitations: List<String>,
    val observedAt: Instant,
    val capabilityDigest: String,
)

data class PortableDesignGovernanceMetadata(
    val state: String,
    val humanReviewRequired: Boolean,
    val claimBoundary: String,
    val nonEscalation: String,
)

data class PortableDesignSourceReviewMetadata(
    val status: PortableDesignSourceReviewStatus,
    val claimLabel: String,
    val gaepApproval: Boolean,
)

data class PortableDesignSourceMetadata(
    val tool: String,
    val exportMethod: PortableDesignExportMethod,
)

data class PortableDesignCounts(
    val artifacts: Int,
    val normalizedDesignTokens: Int,
    val validationChecks: Int,
    val recordedLimitations: Int,
)

data class PortableDesignDigests(
    val snapshot: String,
    val evidence: String,
    val manifest: String,
    val artifactInventory: String,
)

data class PortableDesignTimestamps(
    val sourceExportedAt: Instant,
    val importedAt: Instant,
)

data class PortableDesignSnapshotSummary(
    val schemaVersion: Int,
    val kind: String,
    val bundleId: UUID,
    val productId: UUID,
    val initiativeId: UUID?,
    val title: String,
    val classification: PortableDesignClassification,
    val governance: PortableDesignGovernanceMetadata,
    val sourceReview: PortableDesignSourceReviewMetadata,
    val source: PortableDesignSourceMetadata,
    val counts: PortableDesignCounts,
    val digests: PortableDesignDigests,
    val timestamps: PortableDesignTimestamps,
    val privacyBoundary: String,
)

data class PortableDesignSnapshotPage(
    val items: List<PortableDesignSnapshotSummary>,
    val offset: Int,
    val limit: Int,
    val total: Int,
    val hasMore: Boolean,
    val governanceBoundary: String,
    val privacyBoundary: String,
)

data class SourceGovernanceSourceView(
    val id: UUID,
    val revision: Long,
    val title: String,
    val sourceType: String,
    val owner: String,
    val semanticAuthority: String,
    val knowledgeDisposition: String,
    val classification: String,
    val freshness: String,
    val availability: String,
)

data class SourceGovernanceBaselineView(
    val id: UUID,
    val revision: Long,
    val title: String,
    val memberCount: Int,
    val assessmentStatus: String,
)

data class SourceGovernanceProvenanceView(
    val id: UUID,
    val targetKind: String,
    val disposition: String,
    val sourceCount: Int,
    val transformationCount: Int,
)

data class SourceGovernanceProjection(
    val productId: UUID,
    val productRevision: Long,
    val productDigest: String,
    val initiativeId: UUID,
    val initiativeRevision: Long,
    val initiativeDigest: String,
    val initiativeState: String,
    val assessmentState: String,
    val reasons: List<String>,
    val sourceCount: Int,
    val baselineCount: Int,
    val provenanceCount: Int,
    val staleSourceCount: Int,
    val unknownAuthorityCount: Int,
    val unbaselinedSourceCount: Int,
    val unprovenancedSourceCount: Int,
    val currentBaseline: String?,
    val sources: List<SourceGovernanceSourceView>,
    val baselines: List<SourceGovernanceBaselineView>,
    val provenance: List<SourceGovernanceProvenanceView>,
    val snapshotDigest: String,
)

data class BusinessUnderstandingRecordView(
    val id: UUID,
    val revision: Long,
    val digest: String,
    val objectiveCount: Int,
    val constraintCount: Int,
    val assumptionCount: Int,
    val unresolvedQuestionCount: Int,
    val glossaryTermCount: Int,
)

data class StakeholderModelRecordView(
    val id: UUID,
    val revision: Long,
    val digest: String,
    val stakeholderCount: Int,
    val representedCategoryCount: Int,
    val unresolvedCategoryCount: Int,
    val verifiedAuthorityCount: Int,
)

data class OutcomeModelRecordView(
    val id: UUID,
    val revision: Long,
    val digest: String,
    val outcomeCount: Int,
    val measureCount: Int,
    val countermetricCount: Int,
    val burdenMeasureCount: Int,
    val observedBaselineCount: Int,
)

data class BusinessUnderstandingProjection(
    val productId: UUID,
    val productRevision: Long,
    val productDigest: String,
    val initiativeId: UUID,
    val initiativeRevision: Long,
    val initiativeDigest: String,
    val initiativeState: String,
    val assessmentState: String,
    val reasons: List<String>,
    val unresolvedQuestionCount: Int,
    val blockingQuestionCount: Int,
    val staleBindingCount: Int,
    val staleSourceReferenceCount: Int,
    val businessUnderstanding: BusinessUnderstandingRecordView?,
    val stakeholderModel: StakeholderModelRecordView?,
    val outcomeModel: OutcomeModelRecordView?,
    val snapshotDigest: String,
)

data class BusinessCapabilityMapRecordView(
    val id: UUID,
    val revision: Long,
    val digest: String,
    val capabilityCount: Int,
    val ownedCapabilityCount: Int,
    val openGapCount: Int,
    val criticalGapCount: Int,
    val candidatePriorityCount: Int,
)

data class BusinessCapabilityMapProjection(
    val productId: UUID,
    val productRevision: Long,
    val productDigest: String,
    val initiativeId: UUID,
    val initiativeRevision: Long,
    val initiativeDigest: String,
    val initiativeState: String,
    val assessmentState: String,
    val reasons: List<String>,
    val capabilityCount: Int,
    val ownedCapabilityCount: Int,
    val unownedCapabilityCount: Int,
    val objectiveCoverageCount: Int,
    val outcomeCoverageCount: Int,
    val openGapCount: Int,
    val criticalGapCount: Int,
    val unknownCurrentMaturityCount: Int,
    val unassessedPriorityCount: Int,
    val staleBindingCount: Int,
    val staleSourceReferenceCount: Int,
    val capabilityMap: BusinessCapabilityMapRecordView?,
    val snapshotDigest: String,
)

data class ValueStreamModelRecordView(
    val id: UUID,
    val revision: Long,
    val digest: String,
    val valueStreamCount: Int,
    val ownedValueStreamCount: Int,
    val stageCount: Int,
    val dependencyCount: Int,
    val openBottleneckCount: Int,
    val criticalBottleneckCount: Int,
)

data class ValueStreamModelProjection(
    val productId: UUID,
    val productRevision: Long,
    val productDigest: String,
    val initiativeId: UUID,
    val initiativeRevision: Long,
    val initiativeDigest: String,
    val initiativeState: String,
    val assessmentState: String,
    val reasons: List<String>,
    val valueStreamCount: Int,
    val ownedValueStreamCount: Int,
    val unownedValueStreamCount: Int,
    val stageCount: Int,
    val dependencyCount: Int,
    val capabilityCoverageCount: Int,
    val outcomeCoverageCount: Int,
    val absentFlowEvidenceCount: Int,
    val openBottleneckCount: Int,
    val criticalBottleneckCount: Int,
    val staleBindingCount: Int,
    val staleSourceReferenceCount: Int,
    val valueStreamModel: ValueStreamModelRecordView?,
    val snapshotDigest: String,
)

data class OperatingModelRecordView(
    val id: UUID,
    val revision: Long,
    val digest: String,
    val roleCount: Int,
    val decisionRightCount: Int,
    val forumCount: Int,
    val cycleCount: Int,
)

data class OperatingModelProjection(
    val productId: UUID,
    val productRevision: Long,
    val productDigest: String,
    val initiativeId: UUID,
    val initiativeRevision: Long,
    val initiativeDigest: String,
    val initiativeState: String,
    val assessmentState: String,
    val reasons: List<String>,
    val roleCount: Int,
    val governanceSystemCount: Int,
    val unassignedAppointingAuthorityCount: Int,
    val insufficientCapacityCount: Int,
    val unfundedCapacityCount: Int,
    val decisionRightCount: Int,
    val unassignedDecisionAuthorityCount: Int,
    val forumCount: Int,
    val cycleCount: Int,
    val supportCapacityGapCount: Int,
    val emergencyAuthorityGapCount: Int,
    val staleBindingCount: Int,
    val staleSourceReferenceCount: Int,
    val operatingModel: OperatingModelRecordView?,
    val snapshotDigest: String,
)

data class BusinessRuleCatalogRecordView(
    val id: UUID,
    val revision: Long,
    val digest: String,
    val ruleCount: Int,
    val enforcementTargetCount: Int,
    val exceptionCount: Int,
    val nonExceptionableRuleCount: Int,
)

data class BusinessRuleCatalogProjection(
    val productId: UUID,
    val productRevision: Long,
    val productDigest: String,
    val initiativeId: UUID,
    val initiativeRevision: Long,
    val initiativeDigest: String,
    val initiativeState: String,
    val assessmentState: String,
    val reasons: List<String>,
    val ruleCount: Int,
    val sourceBackedRuleCount: Int,
    val nonExceptionableRuleCount: Int,
    val enforcementTargetCount: Int,
    val unassignedEnforcementTargetCount: Int,
    val unverifiedEnforcementTargetCount: Int,
    val exceptionCount: Int,
    val unassignedExceptionAuthorityCount: Int,
    val staleBindingCount: Int,
    val staleSourceReferenceCount: Int,
    val businessRuleCatalog: BusinessRuleCatalogRecordView?,
    val snapshotDigest: String,
)

data class BusinessArchitectureBaselineRecordView(
    val id: UUID,
    val revision: Long,
    val digest: String,
    val membershipDigest: String,
    val coveredElementCount: Int,
    val integrationClaimCount: Int,
    val consistencyGapCount: Int,
)

data class BusinessArchitectureBaselineProjection(
    val productId: UUID,
    val productRevision: Long,
    val productDigest: String,
    val initiativeId: UUID,
    val initiativeRevision: Long,
    val initiativeDigest: String,
    val initiativeState: String,
    val assessmentState: String,
    val reasons: List<String>,
    val coveredElementCount: Int,
    val includedElementCount: Int,
    val excludedElementCount: Int,
    val unresolvedElementCount: Int,
    val integrationClaimCount: Int,
    val consistencyCheckCount: Int,
    val consistencyGapCount: Int,
    val staleBindingCount: Int,
    val staleSourceReferenceCount: Int,
    val baseline: BusinessArchitectureBaselineRecordView?,
    val snapshotDigest: String,
)

data class SystemSolutionArchitectureRecordView(
    val id: UUID,
    val revision: Long,
    val digest: String,
    val membershipDigest: String,
    val concernCount: Int,
    val viewCount: Int,
    val elementCount: Int,
    val qualityAttributeCount: Int,
    val decisionCount: Int,
)

data class SystemSolutionArchitectureProjection(
    val productId: UUID,
    val productRevision: Long,
    val productDigest: String,
    val initiativeId: UUID,
    val initiativeRevision: Long,
    val initiativeDigest: String,
    val initiativeState: String,
    val assessmentState: String,
    val reasons: List<String>,
    val concernCount: Int,
    val viewCount: Int,
    val elementCount: Int,
    val relationCount: Int,
    val qualityAttributeCount: Int,
    val unresolvedQualityAttributeCount: Int,
    val decisionCount: Int,
    val unresolvedDecisionCount: Int,
    val conformanceCriterionCount: Int,
    val unresolvedConformanceCriterionCount: Int,
    val lifecycleGapCount: Int,
    val inconsistencyCount: Int,
    val unresolvedQuestionCount: Int,
    val staleBindingCount: Int,
    val staleSourceReferenceCount: Int,
    val architecture: SystemSolutionArchitectureRecordView?,
    val snapshotDigest: String,
)

data class BoundedContextModelRecordView(
    val id: UUID,
    val revision: Long,
    val digest: String,
    val membershipDigest: String,
    val boundedContextCount: Int,
    val contractCount: Int,
    val relationshipCount: Int,
)

data class BoundedContextModelProjection(
    val productId: UUID,
    val productRevision: Long,
    val productDigest: String,
    val initiativeId: UUID,
    val initiativeRevision: Long,
    val initiativeDigest: String,
    val initiativeState: String,
    val assessmentState: String,
    val reasons: List<String>,
    val boundedContextCount: Int,
    val coreContextCount: Int,
    val languageTermCount: Int,
    val contractCount: Int,
    val unresolvedContractCount: Int,
    val relationshipCount: Int,
    val unresolvedRelationshipCount: Int,
    val unassignedArchitectureElementCount: Int,
    val unownedDataAssetCount: Int,
    val unmappedCrossContextRelationCount: Int,
    val inconsistencyCount: Int,
    val unresolvedQuestionCount: Int,
    val staleBindingCount: Int,
    val staleSourceReferenceCount: Int,
    val model: BoundedContextModelRecordView?,
    val snapshotDigest: String,
)

data class SecurityPrivacyAssessmentRecordView(
    val id: UUID,
    val revision: Long,
    val digest: String,
    val membershipDigest: String,
    val assetCount: Int,
    val trustBoundaryCount: Int,
    val dataClassCount: Int,
    val controlCount: Int,
    val threatCount: Int,
)

data class SecurityPrivacyAssessmentProjection(
    val productId: UUID,
    val productRevision: Long,
    val productDigest: String,
    val initiativeId: UUID,
    val initiativeRevision: Long,
    val initiativeDigest: String,
    val initiativeState: String,
    val assessmentState: String,
    val reasons: List<String>,
    val assetCount: Int,
    val actorCount: Int,
    val trustBoundaryCount: Int,
    val dataClassCount: Int,
    val dataFlowCount: Int,
    val controlCount: Int,
    val threatCount: Int,
    val unresolvedThreatCount: Int,
    val unverifiedControlCount: Int,
    val unresolvedProcessingAuthorityCount: Int,
    val uncoveredArchitectureElementCount: Int,
    val unmappedArchitectureRelationCount: Int,
    val unresolvedRequirementCount: Int,
    val inconsistencyCount: Int,
    val unresolvedQuestionCount: Int,
    val staleBindingCount: Int,
    val staleSourceReferenceCount: Int,
    val assessment: SecurityPrivacyAssessmentRecordView?,
    val snapshotDigest: String,
)

data class ProcessModelRecordView(
    val id: UUID,
    val revision: Long,
    val digest: String,
    val membershipDigest: String,
    val processCount: Int,
    val transitionCount: Int,
    val approvalRequirementCount: Int,
)

data class ProcessModelProjection(
    val productId: UUID,
    val productRevision: Long,
    val productDigest: String,
    val initiativeId: UUID,
    val initiativeRevision: Long,
    val initiativeDigest: String,
    val initiativeState: String,
    val assessmentState: String,
    val reasons: List<String>,
    val processCount: Int,
    val stepCount: Int,
    val stateDimensionCount: Int,
    val stateValueCount: Int,
    val transitionCount: Int,
    val eventDefinitionCount: Int,
    val approvalRequirementCount: Int,
    val uncoveredValueStreamCount: Int,
    val uncoveredBoundedContextCount: Int,
    val uncoveredBusinessRuleCount: Int,
    val unresolvedRequirementCount: Int,
    val inconsistencyCount: Int,
    val unresolvedQuestionCount: Int,
    val staleBindingCount: Int,
    val staleSourceReferenceCount: Int,
    val model: ProcessModelRecordView?,
    val snapshotDigest: String,
)

data class DataModelRecordView(
    val id: UUID,
    val revision: Long,
    val digest: String,
    val membershipDigest: String,
    val entityCount: Int,
    val relationshipCount: Int,
    val lifecycleCount: Int,
)

data class DataModelProjection(
    val productId: UUID,
    val productRevision: Long,
    val productDigest: String,
    val initiativeId: UUID,
    val initiativeRevision: Long,
    val initiativeDigest: String,
    val initiativeState: String,
    val assessmentState: String,
    val reasons: List<String>,
    val entityCount: Int,
    val attributeCount: Int,
    val relationshipCount: Int,
    val lifecycleCount: Int,
    val transformationCount: Int,
    val uncoveredBoundedContextCount: Int,
    val uncoveredSecurityDataClassCount: Int,
    val uncoveredProcessCount: Int,
    val unresolvedSystemOfRecordCount: Int,
    val unresolvedTransformationCount: Int,
    val unresolvedRequirementCount: Int,
    val inconsistencyCount: Int,
    val unresolvedQuestionCount: Int,
    val staleBindingCount: Int,
    val staleSourceReferenceCount: Int,
    val model: DataModelRecordView?,
    val snapshotDigest: String,
)

data class AuthorizationModelRecordView(
    val id: UUID,
    val revision: Long,
    val digest: String,
    val membershipDigest: String,
    val principalCount: Int,
    val actionCount: Int,
    val ruleCount: Int,
)

data class AuthorizationModelProjection(
    val productId: UUID,
    val productRevision: Long,
    val productDigest: String,
    val initiativeId: UUID,
    val initiativeRevision: Long,
    val initiativeDigest: String,
    val initiativeState: String,
    val assessmentState: String,
    val reasons: List<String>,
    val principalCount: Int,
    val roleAssignmentCount: Int,
    val resourceCount: Int,
    val actionCount: Int,
    val approvalBindingCount: Int,
    val ruleCount: Int,
    val uncoveredOperatingRoleCount: Int,
    val uncoveredProcessCount: Int,
    val uncoveredDataEntityCount: Int,
    val unresolvedIdentityCount: Int,
    val unresolvedRuleCount: Int,
    val unresolvedRequirementCount: Int,
    val inconsistencyCount: Int,
    val unresolvedQuestionCount: Int,
    val staleBindingCount: Int,
    val staleSourceReferenceCount: Int,
    val model: AuthorizationModelRecordView?,
    val snapshotDigest: String,
)

data class EventIntegrationModelRecordView(
    val id: UUID,
    val revision: Long,
    val digest: String,
    val membershipDigest: String,
    val eventTypeCount: Int,
    val commandCount: Int,
    val adapterCount: Int,
    val externalContractCount: Int,
    val mappingCount: Int,
    val routeCount: Int,
)

data class EventIntegrationModelProjection(
    val productId: UUID,
    val productRevision: Long,
    val productDigest: String,
    val initiativeId: UUID,
    val initiativeRevision: Long,
    val initiativeDigest: String,
    val initiativeState: String,
    val assessmentState: String,
    val reasons: List<String>,
    val eventTypeCount: Int,
    val commandCount: Int,
    val adapterCount: Int,
    val externalContractCount: Int,
    val mappingCount: Int,
    val routeCount: Int,
    val uncoveredProcessEventCount: Int,
    val uncoveredProcessCount: Int,
    val uncoveredBoundedContextCount: Int,
    val uncoveredDataEntityCount: Int,
    val uncoveredAuthorizationActionCount: Int,
    val unknownMappingTruthCount: Int,
    val unresolvedRequirementCount: Int,
    val inconsistencyCount: Int,
    val unresolvedQuestionCount: Int,
    val staleBindingCount: Int,
    val staleSourceReferenceCount: Int,
    val model: EventIntegrationModelRecordView?,
    val snapshotDigest: String,
)

data class FailureRecoveryModelRecordView(
    val id: UUID,
    val revision: Long,
    val digest: String,
    val membershipDigest: String,
    val failureModeCount: Int,
    val retryPolicyCount: Int,
    val compensationPlanCount: Int,
    val recoveryPlanCount: Int,
    val recoveryEvidenceDefinitionCount: Int,
)

data class FailureRecoveryModelProjection(
    val productId: UUID,
    val productRevision: Long,
    val productDigest: String,
    val initiativeId: UUID,
    val initiativeRevision: Long,
    val initiativeDigest: String,
    val initiativeState: String,
    val assessmentState: String,
    val reasons: List<String>,
    val failureModeCount: Int,
    val retryPolicyCount: Int,
    val compensationPlanCount: Int,
    val recoveryPlanCount: Int,
    val recoveryEvidenceDefinitionCount: Int,
    val uncoveredProcessCount: Int,
    val uncoveredCommandCount: Int,
    val uncoveredRouteCount: Int,
    val uncoveredAuthorizationActionCount: Int,
    val unresolvedRecoveryEvidenceCount: Int,
    val unresolvedRequirementCount: Int,
    val inconsistencyCount: Int,
    val unresolvedQuestionCount: Int,
    val staleBindingCount: Int,
    val staleSourceReferenceCount: Int,
    val model: FailureRecoveryModelRecordView?,
    val snapshotDigest: String,
)

data class ArchitectureChallengeModelRecordView(
    val id: UUID,
    val revision: Long,
    val digest: String,
    val membershipDigest: String,
    val challengeSubjectCount: Int,
    val assumptionCount: Int,
    val alternativeCount: Int,
    val findingCount: Int,
    val responseCount: Int,
)

data class ArchitectureChallengeModelProjection(
    val productId: UUID,
    val productRevision: Long,
    val productDigest: String,
    val initiativeId: UUID,
    val initiativeRevision: Long,
    val initiativeDigest: String,
    val initiativeState: String,
    val assessmentState: String,
    val reasons: List<String>,
    val challengeSubjectCount: Int,
    val assumptionCount: Int,
    val alternativeCount: Int,
    val findingCount: Int,
    val responseCount: Int,
    val unrespondedFindingCount: Int,
    val unresolvedAssumptionCount: Int,
    val unresolvedRequirementCount: Int,
    val inconsistencyCount: Int,
    val unresolvedQuestionCount: Int,
    val staleBindingCount: Int,
    val staleSourceReferenceCount: Int,
    val model: ArchitectureChallengeModelRecordView?,
    val snapshotDigest: String,
)

data class DecisionRegisterRecordView(
    val id: UUID,
    val revision: Long,
    val digest: String,
    val membershipDigest: String,
    val decisionCount: Int,
)

data class DecisionRegisterProjection(
    val productId: UUID,
    val productRevision: Long,
    val productDigest: String,
    val initiativeId: UUID,
    val initiativeRevision: Long,
    val initiativeDigest: String,
    val initiativeState: String,
    val assessmentState: String,
    val reasons: List<String>,
    val decisionCount: Int,
    val unresolvedDecisionCount: Int,
    val selectedPendingDecisionCount: Int,
    val deferredDecisionCount: Int,
    val unresolvedRequirementCount: Int,
    val inconsistencyCount: Int,
    val unresolvedQuestionCount: Int,
    val staleBindingCount: Int,
    val staleSourceReferenceCount: Int,
    val register: DecisionRegisterRecordView?,
    val snapshotDigest: String,
)

data class RiskRegisterRecordView(
    val id: UUID,
    val revision: Long,
    val digest: String,
    val membershipDigest: String,
    val riskCount: Int,
)

data class RiskRegisterProjection(
    val productId: UUID,
    val productRevision: Long,
    val productDigest: String,
    val initiativeId: UUID,
    val initiativeRevision: Long,
    val initiativeDigest: String,
    val initiativeState: String,
    val assessmentState: String,
    val reasons: List<String>,
    val riskCount: Int,
    val notAssessedRiskCount: Int,
    val unresolvedResidualRiskCount: Int,
    val proposedTreatmentCount: Int,
    val unassignedOwnerCount: Int,
    val unverifiedControlCount: Int,
    val unresolvedRequirementCount: Int,
    val inconsistencyCount: Int,
    val unresolvedQuestionCount: Int,
    val staleBindingCount: Int,
    val staleSourceReferenceCount: Int,
    val register: RiskRegisterRecordView?,
    val snapshotDigest: String,
)

data class EvidenceRegistryRecordView(
    val id: UUID,
    val revision: Long,
    val digest: String,
    val membershipDigest: String,
    val claimCount: Int,
    val evidenceItemCount: Int,
    val linkCount: Int,
)

data class EvidenceRegistryProjection(
    val productId: UUID,
    val productRevision: Long,
    val productDigest: String,
    val initiativeId: UUID,
    val initiativeRevision: Long,
    val initiativeDigest: String,
    val initiativeState: String,
    val assessmentState: String,
    val reasons: List<String>,
    val claimCount: Int,
    val evidenceItemCount: Int,
    val linkCount: Int,
    val notAssessedClaimCount: Int,
    val notAssessedEvidenceCount: Int,
    val adverseEvidencePendingDispositionCount: Int,
    val staleOrUnknownEvidenceCount: Int,
    val invalidatedEvidenceCount: Int,
    val unresolvedLinkCount: Int,
    val unresolvedRequirementCount: Int,
    val inconsistencyCount: Int,
    val unresolvedQuestionCount: Int,
    val staleBindingCount: Int,
    val staleSourceReferenceCount: Int,
    val registry: EvidenceRegistryRecordView?,
    val snapshotDigest: String,
)

data class EndToEndTraceabilityRecordView(
    val id: UUID,
    val revision: Long,
    val digest: String,
    val membershipDigest: String,
    val nodeCount: Int,
    val relationshipCount: Int,
    val linkCount: Int,
    val transformationCount: Int,
)

data class EndToEndTraceabilityProjection(
    val productId: UUID,
    val productRevision: Long,
    val productDigest: String,
    val initiativeId: UUID,
    val initiativeRevision: Long,
    val initiativeDigest: String,
    val initiativeState: String,
    val assessmentState: String,
    val reasons: List<String>,
    val nodeCount: Int,
    val relationshipCount: Int,
    val linkCount: Int,
    val transformationCount: Int,
    val verifiedLinkCount: Int,
    val proposedLinkCount: Int,
    val invalidOrHistoricalLinkCount: Int,
    val unresolvedEndpointCount: Int,
    val notAssessedSemanticCount: Int,
    val missingSpineCount: Int,
    val unknownRelationshipCount: Int,
    val unresolvedRequirementCount: Int,
    val staleBindingCount: Int,
    val staleSourceReferenceCount: Int,
    val inconsistencyCount: Int,
    val unresolvedQuestionCount: Int,
    val coverageBoundary: String,
    val traceability: EndToEndTraceabilityRecordView?,
    val snapshotDigest: String,
)

data class P0P4ReadinessGateRecordView(
    val id: UUID,
    val revision: Long,
    val digest: String,
    val membershipDigest: String,
    val evaluationDefinitionDigest: String,
    val outputCount: Int,
    val waiverCount: Int,
    val unresolvedDecisionCount: Int,
    val conditionCount: Int,
)

data class P0P4ReadinessGateProjection(
    val productId: UUID,
    val productRevision: Long,
    val productDigest: String,
    val initiativeId: UUID,
    val initiativeRevision: Long,
    val initiativeDigest: String,
    val initiativeState: String,
    val result: String,
    val reasons: List<String>,
    val outputCount: Int,
    val applicableOutputCount: Int,
    val notApplicableOutputCount: Int,
    val unresolvedApplicabilityCount: Int,
    val satisfiedOutputCount: Int,
    val conditionalOutputCount: Int,
    val incompleteOutputCount: Int,
    val failedOutputCount: Int,
    val blockedOutputCount: Int,
    val staleOrUnknownOutputCount: Int,
    val pendingOrInvalidWaiverCount: Int,
    val unresolvedDecisionCount: Int,
    val unmetConditionCount: Int,
    val unresolvedRequirementCount: Int,
    val adverseEvidenceCount: Int,
    val staleBindingCount: Int,
    val staleSourceReferenceCount: Int,
    val inconsistencyCount: Int,
    val unresolvedQuestionCount: Int,
    val gateBoundary: String,
    val gate: P0P4ReadinessGateRecordView?,
    val snapshotDigest: String,
)

data class P5HandoffPackageRecordView(
    val id: UUID,
    val revision: Long,
    val digest: String,
    val membershipDigest: String,
    val readinessStatusDigest: String,
    val itemCount: Int,
    val requirementCount: Int,
    val deliveryMode: String,
)

data class P5HandoffPackageProjection(
    val productId: UUID,
    val productRevision: Long,
    val productDigest: String,
    val initiativeId: UUID,
    val initiativeRevision: Long,
    val initiativeDigest: String,
    val initiativeState: String,
    val assessmentState: String,
    val readinessResult: String,
    val transferState: String,
    val reasons: List<String>,
    val itemCount: Int,
    val includedItemCount: Int,
    val referenceOnlyItemCount: Int,
    val omittedNotApplicableItemCount: Int,
    val unresolvedItemCount: Int,
    val staleOrUnknownItemCount: Int,
    val lossyTransformationCount: Int,
    val unresolvedRequirementCount: Int,
    val conflictCount: Int,
    val unresolvedQuestionCount: Int,
    val staleBindingCount: Int,
    val staleSourceReferenceCount: Int,
    val handoffBoundary: String,
    val handoff: P5HandoffPackageRecordView?,
    val snapshotDigest: String,
)

data class DesignApplicabilityRecordView(
    val id: UUID,
    val revision: Long,
    val digest: String,
    val membershipDigest: String,
    val scopeCount: Int,
    val reviewState: String,
)

data class DesignApplicabilityProjection(
    val productId: UUID,
    val productRevision: Long,
    val productDigest: String,
    val initiativeId: UUID,
    val initiativeRevision: Long,
    val initiativeDigest: String,
    val initiativeState: String,
    val assessmentState: String,
    val reviewState: String,
    val reasons: List<String>,
    val scopeCount: Int,
    val decisionCount: Int,
    val unresolvedDecisionCount: Int,
    val blockedDecisionCount: Int,
    val pendingApprovalCount: Int,
    val rejectedApprovalCount: Int,
    val unresolvedDepthCount: Int,
    val unresolvedSourceCount: Int,
    val staleBindingCount: Int,
    val staleSourceReferenceCount: Int,
    val unresolvedQuestionCount: Int,
    val candidate: DesignApplicabilityRecordView?,
    val snapshotDigest: String,
)

class GaepHostException(
    val code: Int,
    val kind: String,
    message: String,
) : RuntimeException(message)

internal object PortableDesignProtocol {
    const val PROTOCOL_VERSION = 2
    const val MAX_OFFSET = 10_000
    const val MAX_PAGE_SIZE = 200
    const val DEFAULT_PAGE_SIZE = 100
    const val MAX_FRAME_BYTES = 1024 * 1024
    const val MAX_SAFE_PRODUCT_REVISION = 9_007_199_254_740_991L
    private const val MAX_JSON_DEPTH = 64
    private const val MAX_JSON_COLLECTION_ENTRIES = 4_096
    private const val SUMMARY_KIND = "portable-design-snapshot-summary"
    private const val GOVERNANCE_STATE = "pending-human-review"
    private const val CLAIM_BOUNDARY = "import-validation-is-not-design-approval-or-baseline"
    private const val NON_ESCALATION = "not-gaep-approval-design-baseline-implementation-or-release-readiness"
    private const val SUMMARY_PRIVACY_BOUNDARY =
        "Validated metadata only; no bundle root, artifact path, token value, source bytes, credentials, OAuth state, or external-account state."
    private const val PAGE_GOVERNANCE_BOUNDARY =
        "Every item remains pending human review; source review is an upstream claim only."
    private const val PAGE_PRIVACY_BOUNDARY =
        "Items contain validated metadata and digests only; local paths and source content are omitted."
    private const val SOURCE_PROJECTION_PRIVACY_BOUNDARY =
        "projection-contains-portable-governance-metadata-and-digests-only-not-source-bytes-locators-local-paths-or-credentials"
    private const val SOURCE_PROJECTION_AUTHORITY_BOUNDARY =
        "source-governance-projection-does-not-designate-a-baseline-approve-readiness-transfer-authority-or-authorize-action"
    private const val SOURCE_ASSESSMENT_AUTHORITY_BOUNDARY =
        "source-governance-assessment-reports-recorded-evidence-and-does-not-designate-a-baseline-approve-readiness-or-authorize-action"
    private const val BUSINESS_PROJECTION_PRIVACY_BOUNDARY =
        "projection-contains-identities-counts-statuses-and-digests-only-not-business-narrative-personal-data-source-content-locators-or-credentials"
    private const val BUSINESS_PROJECTION_AUTHORITY_BOUNDARY =
        "business-understanding-projection-does-not-approve-appoint-decide-designate-readiness-or-authorize-action"
    private const val BUSINESS_ASSESSMENT_AUTHORITY_BOUNDARY =
        "business-understanding-assessment-reports-recorded-candidate-evidence-and-does-not-approve-decide-designate-readiness-or-authorize-action"
    private const val CAPABILITY_MAP_PROJECTION_PRIVACY_BOUNDARY =
        "projection-contains-identities-counts-statuses-and-digests-only-not-capability-narrative-personal-data-source-content-locators-or-credentials"
    private const val CAPABILITY_MAP_PROJECTION_AUTHORITY_BOUNDARY =
        "business-capability-map-projection-does-not-approve-prioritize-baseline-designate-readiness-or-authorize-action"
    private const val CAPABILITY_MAP_ASSESSMENT_AUTHORITY_BOUNDARY =
        "business-capability-map-assessment-reports-recorded-candidate-coverage-and-gaps-and-does-not-approve-priority-readiness-or-authorize-action"
    private const val VALUE_STREAM_PROJECTION_PRIVACY_BOUNDARY =
        "projection-contains-identities-counts-statuses-and-digests-only-not-value-stream-narrative-personal-data-source-content-locators-or-credentials"
    private const val VALUE_STREAM_PROJECTION_AUTHORITY_BOUNDARY =
        "value-stream-model-projection-does-not-approve-baseline-priority-readiness-or-authorize-action"
    private const val VALUE_STREAM_ASSESSMENT_AUTHORITY_BOUNDARY =
        "value-stream-model-assessment-reports-recorded-candidate-flow-coverage-and-gaps-and-does-not-approve-baseline-readiness-or-authorize-action"
    private const val OPERATING_MODEL_PROJECTION_PRIVACY_BOUNDARY =
        "projection-contains-identities-counts-statuses-and-digests-only-not-operating-narrative-personal-data-source-content-locators-or-credentials"
    private const val OPERATING_MODEL_PROJECTION_AUTHORITY_BOUNDARY =
        "operating-model-projection-does-not-appoint-fund-approve-baseline-readiness-or-authorize-action"
    private const val OPERATING_MODEL_ASSESSMENT_AUTHORITY_BOUNDARY =
        "operating-model-assessment-reports-candidate-structural-coverage-and-gaps-and-does-not-appoint-fund-approve-baseline-readiness-or-authorize-action"
    private const val BUSINESS_RULE_PROJECTION_PRIVACY_BOUNDARY =
        "projection-contains-identities-counts-statuses-and-digests-only-not-rule-narrative-source-content-personal-data-locators-or-credentials"
    private const val BUSINESS_RULE_PROJECTION_AUTHORITY_BOUNDARY =
        "business-rule-catalog-projection-does-not-evaluate-policy-grant-exceptions-deploy-enforcement-approve-baseline-readiness-or-authorize-action"
    private const val BUSINESS_RULE_ASSESSMENT_AUTHORITY_BOUNDARY =
        "business-rule-catalog-assessment-reports-candidate-coverage-and-gaps-and-does-not-evaluate-policy-grant-exceptions-deploy-enforcement-approve-baseline-readiness-or-authorize-action"
    private const val BUSINESS_ARCHITECTURE_BASELINE_PROJECTION_PRIVACY_BOUNDARY =
        "projection-contains-identities-counts-statuses-and-digests-only-not-architecture-narrative-source-content-personal-data-locators-or-credentials"
    private const val BUSINESS_ARCHITECTURE_BASELINE_PROJECTION_AUTHORITY_BOUNDARY =
        "business-architecture-baseline-projection-does-not-designate-or-approve-a-baseline-establish-readiness-grant-exceptions-deploy-enforcement-or-authorize-action"
    private const val BUSINESS_ARCHITECTURE_BASELINE_ASSESSMENT_AUTHORITY_BOUNDARY =
        "business-architecture-baseline-assessment-reports-candidate-coherence-and-gaps-and-does-not-designate-or-approve-a-baseline-establish-readiness-or-authorize-action"
    private const val SYSTEM_SOLUTION_ARCHITECTURE_PROJECTION_PRIVACY_BOUNDARY =
        "projection-contains-identities-counts-statuses-and-digests-only-not-architecture-narrative-source-content-personal-data-locators-or-credentials"
    private const val SYSTEM_SOLUTION_ARCHITECTURE_PROJECTION_AUTHORITY_BOUNDARY =
        "system-solution-architecture-projection-does-not-approve-or-designate-an-architecture-baseline-establish-readiness-prove-conformance-mandate-technology-or-authorize-action"
    private const val SYSTEM_SOLUTION_ARCHITECTURE_ASSESSMENT_AUTHORITY_BOUNDARY =
        "system-solution-architecture-assessment-reports-candidate-coverage-and-gaps-and-does-not-approve-baseline-readiness-conformance-technology-or-action"
    private const val BOUNDED_CONTEXT_MODEL_PROJECTION_PRIVACY_BOUNDARY =
        "projection-contains-identities-counts-statuses-and-digests-only-not-boundary-language-contract-source-content-personal-data-locators-or-credentials"
    private const val BOUNDED_CONTEXT_MODEL_PROJECTION_AUTHORITY_BOUNDARY =
        "bounded-context-model-projection-does-not-appoint-owners-approve-boundaries-accept-contracts-establish-readiness-or-authorize-action"
    private const val BOUNDED_CONTEXT_MODEL_ASSESSMENT_AUTHORITY_BOUNDARY =
        "bounded-context-model-assessment-reports-candidate-coverage-and-gaps-and-does-not-appoint-owners-approve-boundaries-accept-contracts-establish-readiness-or-authorize-action"
    private const val SECURITY_PRIVACY_ASSESSMENT_PROJECTION_PRIVACY_BOUNDARY =
        "projection-contains-identities-counts-statuses-and-digests-only-not-threat-scenarios-control-content-data-content-personal-data-locators-secrets-or-credentials"
    private const val SECURITY_PRIVACY_ASSESSMENT_PROJECTION_AUTHORITY_BOUNDARY =
        "security-privacy-threat-projection-does-not-approve-a-threat-model-attest-control-effectiveness-accept-risk-approve-processing-establish-security-readiness-or-authorize-action"
    private const val SECURITY_PRIVACY_ASSESSMENT_STATUS_AUTHORITY_BOUNDARY =
        "security-privacy-threat-status-reports-candidate-coverage-and-gaps-and-does-not-approve-threats-attest-controls-accept-risk-approve-processing-establish-security-readiness-or-authorize-action"
    private const val PROCESS_MODEL_PROJECTION_PRIVACY_BOUNDARY =
        "projection-contains-identities-counts-statuses-and-digests-only-not-process-narrative-transition-guards-approval-content-source-content-personal-data-locators-secrets-or-credentials"
    private const val PROCESS_MODEL_PROJECTION_AUTHORITY_BOUNDARY =
        "process-model-projection-does-not-approve-workflows-grant-transition-or-execution-authority-establish-operational-readiness-or-authorize-action"
    private const val PROCESS_MODEL_STATUS_AUTHORITY_BOUNDARY =
        "process-model-status-reports-candidate-coverage-and-gaps-and-does-not-approve-workflows-grant-transition-or-execution-authority-establish-operational-readiness-or-authorize-action"
    private const val DATA_MODEL_PROJECTION_PRIVACY_BOUNDARY =
        "projection-contains-identities-counts-statuses-and-digests-only-not-entity-attributes-relationships-lifecycle-content-source-content-personal-data-locators-secrets-or-credentials"
    private const val DATA_MODEL_PROJECTION_AUTHORITY_BOUNDARY =
        "data-model-projection-does-not-approve-a-data-model-or-classification-appoint-ownership-grant-migration-authority-establish-operational-readiness-or-authorize-action"
    private const val DATA_MODEL_STATUS_AUTHORITY_BOUNDARY =
        "data-model-status-reports-candidate-coverage-and-gaps-and-does-not-approve-a-data-model-or-classification-appoint-ownership-grant-migration-authority-establish-operational-readiness-or-authorize-action"
    private const val AUTHORIZATION_MODEL_PROJECTION_PRIVACY_BOUNDARY =
        "projection-contains-identities-counts-statuses-and-digests-only-not-principal-identifiers-role-assignments-rules-conditions-approval-content-source-content-personal-data-locators-secrets-or-credentials"
    private const val AUTHORIZATION_MODEL_PROJECTION_AUTHORITY_BOUNDARY =
        "authorization-model-projection-does-not-verify-identity-approve-role-assignments-or-standing-authority-create-an-authorization-grant-enforce-policy-establish-operational-readiness-or-authorize-action"
    private const val AUTHORIZATION_MODEL_STATUS_AUTHORITY_BOUNDARY =
        "authorization-model-status-reports-candidate-coverage-and-gaps-and-does-not-verify-identity-approve-role-assignments-or-standing-authority-create-an-authorization-grant-enforce-policy-establish-operational-readiness-or-authorize-action"
    private const val EVENT_INTEGRATION_MODEL_PROJECTION_PRIVACY_BOUNDARY =
        "projection-contains-identities-counts-statuses-and-digests-only-not-event-payloads-command-inputs-mapping-content-external-locators-source-content-personal-data-secrets-or-credentials"
    private const val EVENT_INTEGRATION_MODEL_PROJECTION_AUTHORITY_BOUNDARY =
        "event-integration-model-projection-does-not-prove-event-occurrence-send-or-deliver-a-command-accept-an-external-contract-activate-an-adapter-create-an-authorization-grant-execute-an-effect-establish-operational-readiness-or-authorize-action"
    private const val EVENT_INTEGRATION_MODEL_STATUS_AUTHORITY_BOUNDARY =
        "event-integration-model-status-reports-candidate-coverage-and-gaps-and-does-not-prove-event-occurrence-send-or-deliver-a-command-accept-an-external-contract-activate-an-adapter-create-an-authorization-grant-execute-an-effect-establish-operational-readiness-or-authorize-action"
    private const val FAILURE_RECOVERY_MODEL_PROJECTION_PRIVACY_BOUNDARY =
        "projection-contains-identities-counts-statuses-and-digests-only-not-failure-evidence-operational-telemetry-retry-keys-compensation-content-recovery-steps-source-content-personal-data-secrets-or-credentials"
    private const val FAILURE_RECOVERY_MODEL_PROJECTION_AUTHORITY_BOUNDARY =
        "failure-recovery-model-projection-does-not-prove-failure-occurrence-retry-safety-compensation-or-restoration-recovery-success-return-to-service-operational-readiness-or-authorize-action"
    private const val FAILURE_RECOVERY_MODEL_STATUS_AUTHORITY_BOUNDARY =
        "failure-recovery-model-status-reports-candidate-coverage-and-gaps-and-does-not-prove-failure-occurrence-retry-safety-compensation-or-restoration-recovery-success-return-to-service-operational-readiness-or-authorize-action"
    private const val ARCHITECTURE_CHALLENGE_PROJECTION_PRIVACY_BOUNDARY =
        "projection-contains-identities-counts-statuses-and-digests-only-not-challenge-content-assumptions-evidence-findings-responses-source-content-personal-data-secrets-or-credentials"
    private const val ARCHITECTURE_CHALLENGE_PROJECTION_AUTHORITY_BOUNDARY =
        "architecture-challenge-projection-does-not-establish-independence-assurance-risk-acceptance-architecture-approval-operational-readiness-or-authorize-action"
    private const val ARCHITECTURE_CHALLENGE_STATUS_AUTHORITY_BOUNDARY =
        "architecture-challenge-status-reports-candidate-coverage-and-gaps-and-does-not-establish-independence-assurance-risk-acceptance-architecture-approval-operational-readiness-or-authorize-action"
    private const val DECISION_REGISTER_PROJECTION_PRIVACY_BOUNDARY =
        "projection-contains-identities-counts-statuses-and-digests-only-not-decision-questions-options-recommendations-outcomes-rationale-evidence-subject-content-personal-data-secrets-or-credentials"
    private const val DECISION_REGISTER_PROJECTION_AUTHORITY_BOUNDARY =
        "decision-register-projection-does-not-establish-decision-effectiveness-approval-risk-acceptance-baseline-promotion-readiness-or-action-authority"
    private const val DECISION_REGISTER_STATUS_AUTHORITY_BOUNDARY =
        "decision-register-status-reports-candidate-coverage-and-gaps-and-does-not-establish-decision-effectiveness-approval-risk-acceptance-baseline-promotion-readiness-or-action-authority"
    private const val RISK_REGISTER_PROJECTION_PRIVACY_BOUNDARY =
        "projection-contains-identities-counts-statuses-and-digests-only-not-risk-statements-assessments-controls-treatments-residual-risk-evidence-related-record-content-personal-data-secrets-or-credentials"
    private const val RISK_REGISTER_PROJECTION_AUTHORITY_BOUNDARY =
        "risk-register-projection-does-not-establish-assessment-fact-control-effectiveness-risk-acceptance-approval-exception-baseline-promotion-readiness-or-action-authority"
    private const val RISK_REGISTER_STATUS_AUTHORITY_BOUNDARY =
        "risk-register-status-reports-candidate-coverage-and-gaps-and-does-not-establish-assessment-fact-control-effectiveness-risk-acceptance-approval-exception-baseline-promotion-readiness-or-action-authority"
    private const val EVIDENCE_REGISTRY_PROJECTION_PRIVACY_BOUNDARY =
        "projection-contains-identities-counts-statuses-and-digests-only-not-claim-statements-evidence-observations-methods-warrants-quality-details-source-content-personal-data-secrets-or-credentials"
    private const val EVIDENCE_REGISTRY_PROJECTION_AUTHORITY_BOUNDARY =
        "evidence-registry-projection-does-not-establish-claim-validation-evidence-sufficiency-assurance-review-approval-risk-acceptance-readiness-or-action-authority"
    private const val EVIDENCE_REGISTRY_STATUS_AUTHORITY_BOUNDARY =
        "evidence-registry-status-reports-candidate-coverage-freshness-and-gaps-and-does-not-establish-claim-validation-evidence-sufficiency-assurance-approval-readiness-or-action-authority"
    private const val END_TO_END_TRACEABILITY_PROJECTION_PRIVACY_BOUNDARY =
        "projection-contains-identities-counts-statuses-and-digests-only-not-node-content-link-rationale-transformation-detail-source-content-personal-data-secrets-or-credentials"
    private const val END_TO_END_TRACEABILITY_PROJECTION_AUTHORITY_BOUNDARY =
        "end-to-end-traceability-projection-does-not-establish-relationship-truth-completeness-approval-baseline-promotion-readiness-or-action-authority"
    private const val END_TO_END_TRACEABILITY_STATUS_AUTHORITY_BOUNDARY =
        "end-to-end-traceability-status-reports-candidate-coverage-and-gaps-and-does-not-establish-relationship-truth-completeness-approval-readiness-or-action-authority"
    private const val END_TO_END_TRACEABILITY_COVERAGE_BOUNDARY =
        "absence-of-a-trace-link-does-not-prove-absence-of-impact-or-relationship"
    private const val P0_P4_READINESS_GATE_PROJECTION_PRIVACY_BOUNDARY =
        "projection-contains-identities-counts-results-and-digests-only-not-output-content-criteria-findings-waiver-rationale-decision-content-evidence-content-source-content-personal-data-secrets-or-credentials"
    private const val P0_P4_READINESS_GATE_PROJECTION_AUTHORITY_BOUNDARY =
        "p0-p4-readiness-gate-projection-does-not-establish-readiness-approval-waiver-acceptance-phase-entry-implementation-authorization-baseline-promotion-or-action-authority"
    private const val P0_P4_READINESS_GATE_STATUS_AUTHORITY_BOUNDARY =
        "p0-p4-readiness-gate-status-is-an-evaluation-result-and-does-not-establish-readiness-approval-waiver-acceptance-phase-entry-implementation-authorization-baseline-promotion-or-action-authority"
    private const val P0_P4_READINESS_GATE_BOUNDARY =
        "a-passing-gate-is-an-evaluation-result-not-permission"
    private const val P5_HANDOFF_PROJECTION_PRIVACY_BOUNDARY =
        "projection-contains-identities-counts-statuses-and-digests-only-not-item-content-summaries-omissions-uncertainties-source-content-personal-data-secrets-credentials-or-destinations"
    private const val P5_HANDOFF_PROJECTION_AUTHORITY_BOUNDARY =
        "p5-handoff-package-projection-does-not-establish-acknowledgement-readiness-approval-design-baseline-p5-entry-transfer-write-or-action-authority"
    private const val P5_HANDOFF_STATUS_AUTHORITY_BOUNDARY =
        "p5-handoff-package-status-does-not-establish-acknowledgement-readiness-approval-design-baseline-p5-entry-transfer-or-action-authority"
    private const val P5_HANDOFF_BOUNDARY =
        "handoff-transfers-exact-candidate-context-not-source-ownership-or-authority"
    private const val DESIGN_APPLICABILITY_PROJECTION_PRIVACY_BOUNDARY =
        "projection-contains-identities-counts-statuses-and-digests-only-not-rationales-source-content-journeys-design-content-personal-data-secrets-or-credentials"
    private const val DESIGN_APPLICABILITY_PROJECTION_AUTHORITY_BOUNDARY =
        "design-applicability-projection-is-read-only-and-does-not-approve-design-establish-a-baseline-grant-readiness-or-authorize-write-implementation-or-action"
    private const val DESIGN_APPLICABILITY_STATUS_AUTHORITY_BOUNDARY =
        "design-applicability-status-is-observational-and-does-not-approve-design-establish-a-baseline-grant-readiness-or-authorize-implementation-or-action"
    private const val MANAGED_PREVIEW_BOUNDARY =
        "managed-readonly-preview-does-not-grant-execution-or-effect-authority"
    private const val MANAGED_RECEIPT_BOUNDARY =
        "managed-readonly-receipt-does-not-grant-tool-write-effect-or-outcome-authority"
    private const val MANAGED_INVENTORY_BOUNDARY =
        "managed-run-inventory-is-read-only-and-does-not-grant-run-effect-apply-approval-or-outcome-authority"
    private const val MANAGED_EVIDENCE_BOUNDARY =
        "managed-evidence-detail-is-verified-read-only-evidence-and-does-not-grant-apply-approval-or-outcome-authority"
    private const val MANAGED_EVIDENCE_PRIVACY_BOUNDARY =
        "Portable identifiers, states, counts, digests, warning codes and timestamps only; prompts, provider output, source bytes, changed paths, executable paths, process state and credentials are omitted."
    private const val MANAGED_REVIEW_BOUNDARY =
        "managed-review-preview-authorizes-no-mutation-without-an-exact-digest-bound-human-decision"
    private const val MANAGED_REVIEW_PRIVACY_BOUNDARY =
        "Exact portable identifiers, digests, warning codes, workspace-relative changed paths, file digests, sizes, modes and write scopes only; prompts, provider output, source bytes, absolute paths, executable paths, process state and credentials are omitted."
    private const val MANAGED_REVIEW_TRANSITION_BOUNDARY =
        "managed-review-transition-proves-persisted-state-not-provider-outcome-or-machine-local-cleanup"
    private const val MANAGED_REVIEW_CLEANUP_BOUNDARY =
        "Persisted discard or apply state does not independently prove machine-local stage or recovery-journal cleanup."
    private const val PHASE_DASHBOARD_AUTHORITY_BOUNDARY =
        "dashboard-is-a-projection-not-phase-approval-readiness-or-applicability-evidence"
    private const val PHASE1_SUMMARY_AUTHORITY_BOUNDARY =
        "phase-1-summary-is-read-only-candidate-evidence-not-readiness-approval-acceptance-phase-entry-release-or-action-authority"
    private const val PHASE1_SUMMARY_SOURCE_BOUNDARY =
        "current-governed-product-initiative-readiness-and-handoff-projections-only"
    private const val PHASE1_SUMMARY_PRIVACY_BOUNDARY =
        "summary-exposes-identities-counts-statuses-times-and-digests-not-narrative-findings-evidence-source-content-personal-data-secrets-or-credentials"
    private const val CHANGE_CATALOG_AUTHORITY_BOUNDARY =
        "change-catalog-selection-does-not-approve-change-or-authorize-effects"
    private const val CHANGE_DASHBOARD_AUTHORITY_BOUNDARY =
        "change-impact-dashboard-does-not-approve-change-accept-risk-or-authorize-effects"
    private const val INITIATIVE_CLASSIFICATION_BOUNDARY =
        "classification-guides-profile-selection-and-does-not-grant-approval-or-action-authority"
    private const val INITIATIVE_DECISION_BOUNDARY =
        "applicability-decision-does-not-grant-approval-readiness-or-action-authority"
    private const val INITIATIVE_MATRIX_BOUNDARY =
        "applicability-matrix-does-not-grant-approval-readiness-or-action-authority"
    private const val INITIATIVE_ASSESSMENT_BOUNDARY =
        "entry-assessment-is-read-only-and-does-not-grant-approval-readiness-or-action-authority"
    private val initiativeTypes = setOf(
        "product", "platform", "product-increment", "feature", "epic", "backlog-item", "service", "module",
        "client-application", "mobile-application", "api", "integration", "migration", "modernization",
        "refactoring", "technical-debt-remediation", "security-remediation", "infrastructure", "devops",
        "observability", "library", "sdk", "cli", "worker", "event-processor", "defect-fix", "experiment",
        "research", "data-capability", "ai-capability",
    )
    private val initiativeApplicabilityStatuses = setOf(
        "required", "recommended", "optional", "not-applicable", "deferred", "conditionally-required",
        "already-satisfied", "reused", "blocked", "awaiting-human-decision",
    )
    private val initiativeSubjectTypes = setOf(
        "phase", "activity", "artifact", "capability", "test-method", "test-level", "approval",
        "evidence-obligation",
    )
    private val initiativeSourceKinds = setOf(
        "rule", "policy", "evidence", "requirement", "dependency", "human-decision",
    )
    private val initiativeIdentifierPattern = Regex("^[a-z][a-z0-9.-]{0,127}$")
    private val changeImpactEffects = setOf(
        "observe", "provisional", "reversible-change", "external-effect", "destructive-or-irreversible",
    )
    private val changeImpactStates = setOf("proposed", "planned", "active", "blocked", "completed", "cancelled")
    private val phase1ImpactOutputRecordKinds = linkedMapOf(
        "architecture-challenge-model" to "architecture-challenge-model",
        "authorization-model" to "authorization-model",
        "bounded-context-ownership" to "bounded-context-model",
        "business-architecture-baseline" to "business-architecture-baseline",
        "business-capability-map" to "business-capability-map",
        "business-rule-catalog" to "business-rule-catalog",
        "business-understanding" to "business-understanding",
        "candidate-source-baseline" to "source-baseline",
        "data-model" to "data-model",
        "decision-register" to "decision-register",
        "end-to-end-traceability" to "end-to-end-traceability-candidate",
        "event-integration-model" to "event-integration-model",
        "evidence-registry" to "evidence-registry",
        "failure-recovery-model" to "failure-recovery-model",
        "initiative-entry" to "initiative",
        "operating-model" to "operating-model",
        "outcome-success-model" to "outcome-model",
        "process-model" to "process-model",
        "risk-register" to "risk-register",
        "security-privacy-threat-assessment" to "security-privacy-threat-assessment",
        "source-intake" to "source-record",
        "source-provenance" to "source-provenance",
        "stakeholder-role-model" to "stakeholder-model",
        "system-solution-architecture" to "system-solution-architecture",
        "value-stream-model" to "value-stream-model",
    )
    private val changeImpactWorkItemStates = changeImpactStates + "ready" + "in-progress"
    private val changeImpactRelationships = setOf(
        "targets", "derives-from", "contributes-to", "depends-on", "implements", "satisfies", "validates",
        "mitigates", "decides", "affects", "supersedes", "related-to",
    )
    private val changeImpactRecordTypes = setOf(
        "product", "design-revision", "initiative", "change", "work-item", "requirement", "decision", "risk",
        "architecture", "evidence", "context-pack", "workflow-plan", "tool-definition", "instruction-privilege-grant",
        "run-tool-selection", "run", "external",
    )
    private val deliveryPhaseCatalog = mapOf(
        DeliveryPhaseId.PHASE_0_1A_FOUNDATION to Pair("Phase 0 / 1A — Four-IDE Platform Foundation", "foundation-summary"),
        DeliveryPhaseId.PHASE_1B_PRODUCT to Pair("Phase 1B — Product P0–P4", "product-architecture"),
        DeliveryPhaseId.PHASE_1C_ACCEPTANCE to Pair("Phase 1C — Four-IDE Phase 1 Release", "phase-release-readiness"),
        DeliveryPhaseId.PHASE_2_DESIGN to Pair("Phase 2 — UX and Figma Loop", "ux-figma"),
        DeliveryPhaseId.PHASE_3A_READINESS to Pair("Phase 3A — Backlog and Implementation Readiness", "backlog-readiness"),
        DeliveryPhaseId.PHASE_3B_IMPLEMENTATION to Pair("Phase 3B — Controlled Implementation and QA", "implementation-qa"),
        DeliveryPhaseId.PHASE_4_RELEASE_LEARNING to Pair("Phase 4 — Release, Publish, and Learning", "release-learning"),
    )
    private val phaseDashboardPanelCatalog = mapOf(
        "foundation-summary" to Pair("phase", "Foundation summary and readiness"),
        "product-architecture" to Pair("phase", "Product and architecture"),
        "phase-release-readiness" to Pair("phase", "Phase release readiness"),
        "ux-figma" to Pair("phase", "UX and Figma"),
        "backlog-readiness" to Pair("phase", "Backlog and implementation readiness"),
        "implementation-qa" to Pair("phase", "Controlled implementation and QA"),
        "release-learning" to Pair("phase", "Release and learning"),
        "change-impact" to Pair("change-impact", "Change and impact"),
        "agent-model" to Pair("agent-model", "Agent and model"),
    )
    private val actorIdPattern = Regex("^[A-Za-z0-9][A-Za-z0-9._:@+-]*$")
    private val toolPattern = Regex("^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$")
    private val digestPattern = Regex("^sha256:[0-9a-f]{64}$")
    private val settingKeyPattern = Regex("^[a-z][a-zA-Z0-9]{0,127}$")
    private val absolutePathPattern = Regex("""^(?:/\S*|[A-Za-z]:[\\/]\S*|\\\\\S*|file://\S*)$""")
    private val portableSettingPathPattern = Regex("""^(?:/|[A-Za-z]:[\\/]|\\\\|file://|~[\\/])""")
    private val privatePathPattern = Regex("""(?:^|[\s(="'])(?:/(?:Users|home|tmp|private|Volumes)/[^\s"'<>)]*|[A-Za-z]:\\[^\s"'<>)]*|\\\\[^\s"'<>)]*)""")
    private val handoffPathPattern = Regex("""(?:^|[\s(="'])(?:~[\\/]|/(?!/)[^\s"'<>)]*|[A-Za-z]:[\\/][^\s"'<>)]*|\\\\[^\s"'<>)]*|file://[^\s"'<>)]*)""")
    private val secretPattern = Regex(
        """\bBearer\s+\S+|\b(?:sk|sk-ant)-[A-Za-z0-9_-]{8,}\b|\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b|\bAKIA[A-Z0-9]{16}\b|-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:token|secret|password|passwd|api[_-]?key)\s*[:=]\s*\S+""",
        RegexOption.IGNORE_CASE,
    )
    private val secretSettingKeyPattern = Regex(
        "(?:apiKey|accessToken|refreshToken|authToken|bearerToken|password|passwd|clientSecret|privateKey|credential)",
        RegexOption.IGNORE_CASE,
    )
    private val secretEnvironmentSettingPattern = Regex(
        "^\\$\\{?[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY)[A-Z0-9_]*}?$",
        RegexOption.IGNORE_CASE,
    )
    private val uuidPattern = Regex(
        "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
    )
    private data class StableHostError(val code: Int, val message: String)
    private val stableHostErrors = mapOf(
        "PORTABLE_DESIGN_SOURCE_INVALID" to StableHostError(
            -32_030,
            "The local portable design bundle did not pass bounded validation.",
        ),
        "PORTABLE_DESIGN_PRODUCT_CONTEXT_CHANGED" to StableHostError(
            -32_031,
            "The portable design request no longer matches the exact Product revision.",
        ),
        "PORTABLE_DESIGN_AUDIT_INVALID" to StableHostError(
            -32_032,
            "GAEP could not verify the governed audit boundary for this portable design request.",
        ),
        "PORTABLE_DESIGN_INTEGRITY_INVALID" to StableHostError(
            -32_033,
            "GAEP could not verify the portable design snapshot inventory and metadata.",
        ),
        "PORTABLE_DESIGN_CONFLICT" to StableHostError(
            -32_034,
            "The portable design snapshot identity conflicts with governed inventory.",
        ),
        "PORTABLE_DESIGN_NOT_FOUND" to StableHostError(
            -32_035,
            "The requested portable design snapshot does not exist in the current Product.",
        ),
        "INVALID_CAPABILITY_SNAPSHOT" to StableHostError(
            -32_010,
            "The GAEP engine could not verify the agent capability snapshot.",
        ),
        "CAPABILITIES_NOT_AVAILABLE" to StableHostError(
            -32_011,
            "The GAEP engine could not observe agent capabilities.",
        ),
        "EXECUTABLE_UNAVAILABLE" to StableHostError(-32_013, "The configured agent executable is unavailable."),
        "EXECUTABLE_CHANGED" to StableHostError(
            -32_014,
            "The configured agent executable changed during capability discovery.",
        ),
        "CAPABILITIES_CHANGED" to StableHostError(
            -32_012,
            "Agent capabilities changed during selection; probe again.",
        ),
        "AGENT_SELECTION_ACTIVE_RUN" to StableHostError(
            -32_015,
            "Agent selection cannot change while a Run is non-terminal.",
        ),
        "AGENT_SELECTION_MIGRATION_REQUIRED" to StableHostError(
            -32_016,
            "The legacy Agent Selection requires explicit re-probe and reconfirmation.",
        ),
        "AGENT_SELECTION_HANDOFF_REQUIRED" to StableHostError(
            -32_017,
            "A versioned handoff is required before changing agent, model, or settings after a Run.",
        ),
        "AGENT_SELECTION_INVALID" to StableHostError(
            -32_018,
            "The persisted Agent Selection is invalid and cannot be replaced implicitly.",
        ),
        "MANAGED_READ_ONLY_PREVIEW_CHANGED" to StableHostError(
            -32_022,
            "The managed read-only preview changed before execution; review the current preview.",
        ),
        "MANAGED_READ_ONLY_RECEIPT_INVALID" to StableHostError(
            -32_023,
            "GAEP could not verify the managed read-only terminal evidence.",
        ),
        "MANAGED_EVIDENCE_AUDIT_INVALID" to StableHostError(
            -32_024,
            "Managed Run evidence is unavailable because the governed audit chain is invalid.",
        ),
        "MANAGED_EVIDENCE_SNAPSHOT_CHANGED" to StableHostError(
            -32_025,
            "Managed Run inventory changed during pagination; reload the first page.",
        ),
        "MANAGED_EVIDENCE_INVENTORY_INVALID" to StableHostError(
            -32_026,
            "GAEP could not verify the bounded Managed Run inventory.",
        ),
        "MANAGED_EVIDENCE_DETAIL_INVALID" to StableHostError(
            -32_027,
            "GAEP could not verify the exact Managed Run evidence detail.",
        ),
        "MANAGED_REVIEW_AUDIT_INVALID" to StableHostError(
            -32_028,
            "Managed Run review is unavailable because the governed audit chain is invalid.",
        ),
        "MANAGED_REVIEW_CHANGED" to StableHostError(
            -32_029,
            "The Managed Run review changed before the decision; open and review the current exact inventory.",
        ),
        "MANAGED_REVIEW_INVALID" to StableHostError(
            -32_036,
            "GAEP could not verify an exact pending Managed Run review.",
        ),
        "MANAGED_REVIEW_APPLY_FAILED" to StableHostError(
            -32_037,
            "The exact Managed Run apply transition could not be verified; reload the review before any retry.",
        ),
        "MANAGED_REVIEW_DISCARD_FAILED" to StableHostError(
            -32_038,
            "The exact Managed Run discard transition could not be verified; reload the review before any retry.",
        ),
        "DASHBOARD_PRODUCT_CONTEXT_CHANGED" to StableHostError(
            -32_039,
            "The Product changed before the phase dashboard was composed; reload the current Product.",
        ),
        "CHANGE_IMPACT_PRODUCT_CONTEXT_CHANGED" to StableHostError(
            -32_040,
            "The Product changed before the Change/Impact projection was composed; reload the current Product.",
        ),
        "CHANGE_IMPACT_CHANGE_CONTEXT_CHANGED" to StableHostError(
            -32_041,
            "The Change changed before the Change/Impact projection was composed; select the current Change again.",
        ),
        "CHANGE_IMPACT_AUDIT_INVALID" to StableHostError(
            -32_042,
            "The Change/Impact projection is unavailable because the governed audit chain is invalid.",
        ),
        "CHANGE_IMPACT_CATALOG_INVALID" to StableHostError(
            -32_043,
            "The current Change catalog could not be verified.",
        ),
        "PHASE1_CHANGE_IMPACT_CONTEXT_CHANGED" to StableHostError(
            -32_049,
            "The Phase 1 Change/Impact context changed; reload the exact Product, Initiative, Change, readiness, handoff, and trace records.",
        ),
        "PHASE1_CHANGE_IMPACT_AUDIT_INVALID" to StableHostError(
            -32_048,
            "The Phase 1 Change/Impact projection is unavailable because the governed audit chain is invalid.",
        ),
        "INVALID_PARAMS" to StableHostError(-32_602, "The GAEP engine rejected the local request parameters."),
        "PROTOCOL_UPGRADE_REQUIRED" to StableHostError(
            -32_021,
            "The GAEP engine requires protocol version 2 for portable design requests.",
        ),
        "UNSUPPORTED_PROTOCOL_VERSION" to StableHostError(
            -32_020,
            "The GAEP engine does not support the requested portable design protocol version.",
        ),
        "FRAME_TOO_LARGE" to StableHostError(
            -32_001,
            "The GAEP engine rejected a frame that exceeded the protocol boundary.",
        ),
        "RESPONSE_TOO_LARGE" to StableHostError(-32_002, "The GAEP engine response exceeded the protocol boundary."),
        "INVALID_UTF8" to StableHostError(-32_700, "The GAEP engine response was not valid UTF-8."),
    )

    fun normalizeBundleRoot(bundleRoot: Path): Path {
        val raw = bundleRoot.toString()
        require(raw.length <= 32_768 && '\u0000' !in raw && bundleRoot.isAbsolute && !isNetworkPath(raw)) {
            "Portable design bundle root must be an absolute local folder"
        }
        val normalized = bundleRoot.toAbsolutePath().normalize()
        require(Files.isDirectory(normalized)) {
            "Portable design bundle root must be an existing local folder"
        }
        return normalized
    }

    fun validateProductId(productId: UUID) {
        require(productId != UUID(0, 0)) { "Expected Product ID must be a non-empty UUID" }
    }

    fun validateBundleId(bundleId: UUID) {
        require(bundleId != UUID(0, 0)) { "Bundle ID must be a non-empty UUID" }
    }

    fun validateProductRevision(revision: Long) {
        require(revision in 1..MAX_SAFE_PRODUCT_REVISION) { "Product revision must be a positive protocol-safe integer" }
    }

    fun normalizeActorId(actorId: String): String {
        require(actorId.length <= 256) { "Actor ID must be a portable human principal" }
        val normalized = actorId.trim()
        require(normalized.isNotEmpty() && normalized.length <= 256 && actorIdPattern.matches(normalized)) {
            "Actor ID must be a portable human principal"
        }
        return normalized
    }

    fun normalizeSelectionIdentifier(value: String, label: String): String = try {
        portableText(value, minimum = 1)
    } catch (_: GaepHostException) {
        throw IllegalArgumentException("$label must be verified portable capability text")
    }

    fun normalizePortableSettingText(value: String, label: String, minimum: Int = 0): String = try {
        portableSettingText(value, minimum)
    } catch (_: GaepHostException) {
        throw IllegalArgumentException("$label must be portable text without paths, controls, or secret-shaped values")
    }

    fun normalizeHandoffText(value: String, label: String, minimum: Int, maximum: Int): String {
        val normalized = value.trim()
        require(normalized.length in minimum..maximum && normalized.none(Char::isISOControl) &&
            !handoffPathPattern.containsMatchIn(normalized) && !secretPattern.containsMatchIn(normalized)
        ) {
            "$label must be portable text without paths, controls, or secret-shaped values"
        }
        return normalized
    }

    fun normalizeHandoffTextList(values: List<String>, label: String): List<String> {
        require(values.size <= 256) { "$label may contain at most 256 entries" }
        return values.map { normalizeHandoffText(it, label, minimum = 1, maximum = 2_000) }
    }

    fun portableSettingsEqual(
        left: Map<String, PortableAgentSettingValue>,
        right: Map<String, PortableAgentSettingValue>,
    ): Boolean = left.keys == right.keys && left.all { (key, value) ->
        when (val candidate = right[key]) {
            is PortableAgentSettingValue.Decimal -> value is PortableAgentSettingValue.Decimal &&
                value.value.compareTo(candidate.value) == 0
            else -> value == candidate
        }
    }

    fun portableSelectionSettingsToJson(settings: Map<String, PortableAgentSettingValue>): JsonObject {
        require(settings.size <= 128) { "Agent settings may contain at most 128 portable values" }
        return JsonObject().apply {
            settings.forEach { (key, value) ->
                require(validSettingKey(key)) { "Agent settings must use portable non-secret keys" }
                add(key, portableSettingValueToJson(value))
            }
        }
    }

    fun validatePage(offset: Int, limit: Int) {
        require(offset in 0..MAX_OFFSET) { "Portable design offset must be between 0 and 10000" }
        require(limit in 1..MAX_PAGE_SIZE) { "Portable design limit must be between 1 and 200" }
    }

    fun validateManagedEvidencePage(offset: Int, limit: Int, snapshotDigest: String?, expectedTotal: Int? = null) {
        require(offset in 0..2_000) { "Managed Run offset must be between 0 and 2000" }
        require(limit in 1..200) { "Managed Run limit must be between 1 and 200" }
        require(snapshotDigest == null || digestPattern.matches(snapshotDigest)) {
            "Managed Run snapshot digest must be SHA-256"
        }
        require(expectedTotal == null || expectedTotal in 0..2_000) {
            "Managed Run expected total must be between 0 and 2000"
        }
    }

    fun parseStrictObject(raw: String): JsonObject {
        try {
            JsonReader(StringReader(raw)).use { reader ->
                reader.strictness = Strictness.STRICT
                val value = readJsonValue(reader, 0)
                if (reader.peek() != JsonToken.END_DOCUMENT || !value.isJsonObject) throw invalidResponse()
                return value.asJsonObject
            }
        } catch (error: GaepHostException) {
            throw error
        } catch (_: Exception) {
            throw invalidResponse()
        }
    }

    fun parseSnapshotEnvelope(
        envelope: JsonObject,
        expectedBundleId: UUID? = null,
        expectedProductId: UUID? = null,
    ): PortableDesignSnapshotSummary {
        val summary = parseSnapshot(readResult(envelope).requireObject())
        if ((expectedBundleId != null && summary.bundleId != expectedBundleId) ||
            (expectedProductId != null && summary.productId != expectedProductId)
        ) {
            throw invalidResponse()
        }
        return summary
    }

    fun initiativeClassificationInputToJson(input: InitiativeClassificationInput): JsonObject = JsonObject().apply {
        addProperty("primaryType", input.primaryType)
        add("secondaryTypes", input.secondaryTypes.toJsonArray())
        addProperty("systemState", input.systemState)
        addProperty("changePosture", input.changePosture)
        add("motivations", input.motivations.toJsonArray())
        add("characteristics", JsonObject().apply {
            addProperty("userInterface", input.characteristics.userInterface)
            addProperty("data", input.characteristics.data)
            addProperty("integration", input.characteristics.integration)
            add("interactionModes", input.characteristics.interactionModes.toJsonArray())
            addProperty("exposure", input.characteristics.exposure)
        })
        addProperty("regulated", input.regulated)
        add("policyDomains", input.policyDomains.toJsonArray())
        add("sensitivities", input.sensitivities.toJsonArray())
        addProperty("expectedLifetime", input.expectedLifetime)
        addProperty("maintenanceHorizon", input.maintenanceHorizon)
        add("risk", JsonObject().apply {
            addProperty("blastRadius", input.risk.blastRadius)
            addProperty("reversibility", input.risk.reversibility)
            addProperty("urgency", input.risk.urgency)
            addProperty("costOfFailure", input.risk.costOfFailure)
        })
        add("dependencies", input.dependencies.toJsonArray())
        add("affectedAssets", input.affectedAssets.toJsonArray())
        addProperty("owner", input.owner)
        addProperty("accountableAuthority", input.accountableAuthority)
        add("confidence", JsonObject().apply {
            addProperty("level", input.confidence.level)
            addProperty("basis", input.confidence.basis)
        })
        add("evidence", JsonArray().apply { input.evidence.forEach { add(initiativeSourceToJson(it)) } })
        add("unresolvedQuestions", input.unresolvedQuestions.toJsonArray())
        addProperty("rationale", input.rationale)
    }.also { value ->
        try {
            validateInitiativeClassificationInput(value)
        } catch (_: GaepHostException) {
            throw IllegalArgumentException(
                "Initiative classification must contain only strict portable, non-secret, internally consistent values",
            )
        }
    }

    fun completeInitiativeApplicabilityCoverage(
        input: InitiativeApplicabilityMatrixInput,
        unresolvedOwner: String,
    ): InitiativeApplicabilityMatrixInput {
        val canonical = canonicalInitiativeApplicabilitySubjects.associateBy { "${it.type}:${it.key}" }
        val represented = mutableSetOf<String>()
        (input.decisions.map { it.subject } + input.unresolvedSubjects.map { it.subject }).forEach { subject ->
            val key = "${subject.type}:${subject.key}"
            require(canonical[key] == subject) {
                "Applicability subject $key does not match the canonical catalog."
            }
            represented += key
        }
        val completed = input.copy(
            unresolvedSubjects = input.unresolvedSubjects + canonicalInitiativeApplicabilitySubjects
                .filter { "${it.type}:${it.key}" !in represented }
                .map { subject ->
                    InitiativeUnresolvedSubject(
                        subject,
                        "No explicit applicability decision was recorded in this review; accountable resolution remains required.",
                        unresolvedOwner,
                    )
                },
        )
        initiativeApplicabilityInputToJson(completed)
        return completed
    }

    fun initiativeApplicabilityInputToJson(input: InitiativeApplicabilityMatrixInput): JsonObject = JsonObject().apply {
        input.subjectCatalog?.let { catalog ->
            add("subjectCatalog", JsonObject().apply {
                addProperty("catalogVersion", catalog.catalogVersion)
                addProperty("digest", catalog.digest)
                addProperty("subjectCount", catalog.subjectCount)
            })
        }
        add("decisions", JsonArray().apply {
            input.decisions.forEach { decision ->
                add(JsonObject().apply {
                    add("subject", initiativeSubjectToJson(decision.subject))
                    addProperty("status", decision.status)
                    addProperty("rationale", decision.rationale)
                    add("sources", JsonArray().apply { decision.sources.forEach { add(initiativeSourceToJson(it)) } })
                    addProperty("owner", decision.owner)
                    decision.accountableApprover?.let { addProperty("accountableApprover", it) }
                    add("dependencies", decision.dependencies.toJsonArray())
                    add("conditions", decision.conditions.toJsonArray())
                    add("reviewTriggers", decision.reviewTriggers.toJsonArray())
                    add("approval", JsonObject().apply {
                        addProperty("state", decision.approval.state)
                        decision.approval.decidedBy?.let { actor ->
                            add("decidedBy", JsonObject().apply {
                                addProperty("kind", "human")
                                addProperty("id", actor)
                            })
                        }
                        decision.approval.decidedAt?.let { addProperty("decidedAt", it.toString()) }
                        add("conditions", decision.approval.conditions.toJsonArray())
                    })
                    add("relatedRecords", JsonArray().apply {
                        decision.relatedRecords.forEach { record ->
                            add(JsonObject().apply {
                                addProperty("recordType", record.recordType)
                                addProperty("recordId", record.recordId.toString())
                                addProperty("revision", record.revision)
                                addProperty("digest", record.digest)
                            })
                        }
                    })
                    add("relatedImplementationUnits", decision.relatedImplementationUnits.toJsonArray())
                })
            }
        })
        add("unresolvedSubjects", JsonArray().apply {
            input.unresolvedSubjects.forEach { unresolved ->
                add(JsonObject().apply {
                    add("subject", initiativeSubjectToJson(unresolved.subject))
                    addProperty("reason", unresolved.reason)
                    addProperty("owner", unresolved.owner)
                })
            }
        })
    }.also { value ->
        try {
            validateInitiativeApplicabilityInput(value)
        } catch (_: GaepHostException) {
            throw IllegalArgumentException(
                "Initiative applicability must contain only explicit portable, non-secret, internally consistent decisions",
            )
        }
    }

    fun parseInitiativeEnvelope(
        envelope: JsonObject,
        expectedInitiativeId: UUID,
        expectedRevision: Long? = null,
        expectedActorId: String? = null,
        expectedClassificationInput: JsonObject? = null,
        expectedApplicabilityInput: JsonObject? = null,
    ): InitiativeEntryRecord {
        val initiative = readResult(envelope).requireObject()
        initiative.requireKeys(
            required = setOf(
                "schemaVersion", "id", "kind", "revision", "productId", "title", "outcome", "scope",
                "exclusions", "state", "createdAt", "updatedAt",
            ),
            optional = setOf("classification", "applicability"),
        )
        if (initiative.requireInt("schemaVersion") != 1 || initiative.requireString("kind") != "initiative") {
            throw invalidResponse()
        }
        val id = initiative.requireNonEmptyUuid("id")
        val revision = initiative.requireLong("revision")
        val productId = initiative.requireNonEmptyUuid("productId")
        if (id != expectedInitiativeId || revision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
        initiative.requirePortableText("title", minimum = 2).also { if (it.length > 240) throw invalidResponse() }
        initiative.requirePortableText("outcome", minimum = 4).also { if (it.length > 5_000) throw invalidResponse() }
        validateInitiativeTextArray(initiative.get("scope"), 1, 256)
        validateInitiativeTextArray(initiative.get("exclusions"), 0, 256)
        val state = initiative.requireOneOf("state", setOf("proposed", "active", "blocked", "completed", "cancelled"))
        val createdAt = initiative.requireInstant("createdAt")
        val updatedAt = initiative.requireInstant("updatedAt")
        if (updatedAt.isBefore(createdAt)) throw invalidResponse()

        val classification = initiative.get("classification")?.let {
            parseInitiativeClassification(it.requireObject())
        }
        val applicability = initiative.get("applicability")?.let {
            parseInitiativeApplicability(it.requireObject(), id, productId)
        }
        expectedRevision?.let { expected ->
            if (revision != expected + 1) throw invalidResponse()
        }
        expectedClassificationInput?.let { expected ->
            validateInitiativeClassificationInput(expected)
            if (classification == null || classification.inputDigest != canonicalDigest(expected) ||
                classification.classifiedBy != expectedActorId
            ) {
                throw invalidResponse()
            }
        }
        expectedApplicabilityInput?.let { expected ->
            validateInitiativeApplicabilityInput(expected)
            if (classification == null || applicability == null || applicability.state != "current" ||
                applicability.initiativeRevision != revision || applicability.inputDigest != canonicalDigest(expected) ||
                applicability.evaluatedBy != expectedActorId ||
                applicability.classificationDigest != classification.digest
            ) {
                throw invalidResponse()
            }
        }
        return InitiativeEntryRecord(
            id,
            revision,
            productId,
            state,
            canonicalDigest(initiative),
            classification,
            applicability,
        )
    }

    fun parseInitiativeEntryAssessmentEnvelope(
        envelope: JsonObject,
        expectedInitiativeId: UUID,
    ): InitiativeEntryAssessment {
        val assessment = readResult(envelope).requireObject()
        assessment.requireExactKeys(
            "schemaVersion", "kind", "initiativeId", "initiativeRevision", "productId", "productRevision",
            "productDigest", "classification", "applicability", "state", "reasons", "assessedAt",
            "authorityBoundary",
        )
        if (assessment.requireInt("schemaVersion") != 1 ||
            assessment.requireString("kind") != "initiative-entry-assessment" ||
            assessment.requireString("authorityBoundary") != INITIATIVE_ASSESSMENT_BOUNDARY
        ) {
            throw invalidResponse()
        }
        val initiativeId = assessment.requireNonEmptyUuid("initiativeId")
        val initiativeRevision = assessment.requireLong("initiativeRevision")
        val productRevision = assessment.requireLong("productRevision")
        if (initiativeId != expectedInitiativeId || initiativeRevision !in 1..MAX_SAFE_PRODUCT_REVISION ||
            productRevision !in 1..MAX_SAFE_PRODUCT_REVISION
        ) {
            throw invalidResponse()
        }
        val classification = assessment.get("classification").requireObject()
        classification.requireKeys(setOf("status", "completeness"), setOf("digest"))
        val classificationStatus = classification.requireOneOf("status", setOf("missing", "current", "stale"))
        val classificationDigest = classification.get("digest")?.let { classification.requireDigest("digest") }
        if ((classificationStatus == "missing") != (classificationDigest == null)) throw invalidResponse()
        val completeness = classification.get("completeness").requireObject()
        completeness.requireExactKeys(
            "status", "policyVersion", "policyDigest", "unknownDimensionCount", "unresolvedQuestionCount",
            "missingConditionalDimensionCount", "confidenceSufficient",
        )
        val completenessStatus = completeness.requireOneOf("status", setOf("missing", "complete", "incomplete", "stale"))
        if ((classificationStatus == "missing" && completenessStatus != "missing") ||
            (classificationStatus == "stale" && completenessStatus != "stale")
        ) {
            throw invalidResponse()
        }
        val completenessPolicyVersion = completeness.requireString("policyVersion")
        if (completenessPolicyVersion != "gaep-initiative-classification-completeness-v1") throw invalidResponse()
        val completenessCounts = listOf(
            "unknownDimensionCount",
            "unresolvedQuestionCount",
            "missingConditionalDimensionCount",
        ).map { completeness.requireBoundedNonNegativeInt(it, 512) }

        val applicability = assessment.get("applicability").requireObject()
        applicability.requireKeys(
            required = setOf(
                "status", "decisionCount", "unresolvedSubjectCount", "pendingHumanDecisionCount",
                "blockedDecisionCount", "pendingApprovalCount", "rejectedApprovalCount", "coverage",
            ),
            optional = setOf("matrixRevision", "digest"),
        )
        val applicabilityStatus = applicability.requireOneOf("status", setOf("missing", "current", "stale"))
        val matrixRevision = applicability.get("matrixRevision")?.let { applicability.requireLong("matrixRevision") }
        val applicabilityDigest = applicability.get("digest")?.let { applicability.requireDigest("digest") }
        if ((matrixRevision == null) != (applicabilityDigest == null) ||
            (applicabilityStatus == "missing") != (matrixRevision == null) ||
            (matrixRevision != null && matrixRevision !in 1..MAX_SAFE_PRODUCT_REVISION)
        ) {
            throw invalidResponse()
        }
        val counts = (0 until 6).map { index ->
            applicability.requireBoundedNonNegativeInt(
                listOf(
                    "decisionCount", "unresolvedSubjectCount", "pendingHumanDecisionCount", "blockedDecisionCount",
                    "pendingApprovalCount", "rejectedApprovalCount",
                )[index],
                512,
            )
        }
        val coverage = applicability.get("coverage").requireObject()
        coverage.requireKeys(
            required = setOf(
                "status", "subjectCount", "coveredSubjectCount", "missingSubjectCount",
                "unexpectedSubjectCount", "mismatchedSubjectCount",
            ),
            optional = setOf("catalogVersion", "catalogDigest"),
        )
        val coverageStatus = coverage.requireOneOf(
            "status",
            setOf("unavailable", "missing", "complete", "incomplete", "stale"),
        )
        val catalogVersion = coverage.get("catalogVersion")?.let { coverage.requireString("catalogVersion") }
        val catalogDigest = coverage.get("catalogDigest")?.let { coverage.requireDigest("catalogDigest") }
        if ((catalogVersion == null) != (catalogDigest == null) ||
            (coverageStatus == "unavailable") != (catalogVersion == null) ||
            (catalogVersion != null && catalogVersion != "gaep-initiative-applicability-subjects-v1")
        ) {
            throw invalidResponse()
        }
        val coverageCounts = listOf(
            "subjectCount",
            "coveredSubjectCount",
            "missingSubjectCount",
            "unexpectedSubjectCount",
            "mismatchedSubjectCount",
        ).map { coverage.requireBoundedNonNegativeInt(it, 512) }
        if (coverageCounts[1] + coverageCounts[2] + coverageCounts[4] != coverageCounts[0] ||
            (coverageStatus == "complete" && coverageCounts.slice(2..4).any { it > 0 })
        ) {
            throw invalidResponse()
        }
        val reasonsElement = assessment.get("reasons")
        if (reasonsElement == null || !reasonsElement.isJsonArray || reasonsElement.asJsonArray.size() > 256) {
            throw invalidResponse()
        }
        val reasons = reasonsElement.asJsonArray.map { portableText(it.requireString(), minimum = 2, maximum = 2_000) }
        val state = assessment.requireOneOf("state", setOf("ready", "attention-required", "blocked"))
        if ((state == "ready") != reasons.isEmpty()) throw invalidResponse()
        return InitiativeEntryAssessment(
            initiativeId = initiativeId,
            initiativeRevision = initiativeRevision,
            productId = assessment.requireNonEmptyUuid("productId"),
            productRevision = productRevision,
            productDigest = assessment.requireDigest("productDigest"),
            classification = InitiativeEntryAssessmentClassification(
                classificationStatus,
                classificationDigest,
                InitiativeClassificationCompletenessAssessment(
                    completenessStatus,
                    completenessPolicyVersion,
                    completeness.requireDigest("policyDigest"),
                    completenessCounts[0],
                    completenessCounts[1],
                    completenessCounts[2],
                    completeness.requireBoolean("confidenceSufficient"),
                ),
            ),
            applicability = InitiativeEntryAssessmentApplicability(
                applicabilityStatus,
                matrixRevision,
                applicabilityDigest,
                counts[0],
                counts[1],
                counts[2],
                counts[3],
                counts[4],
                counts[5],
                InitiativeApplicabilityCoverageAssessment(
                    coverageStatus,
                    catalogVersion,
                    catalogDigest,
                    coverageCounts[0],
                    coverageCounts[1],
                    coverageCounts[2],
                    coverageCounts[3],
                    coverageCounts[4],
                ),
            ),
            state = state,
            reasons = reasons,
            assessedAt = assessment.requireInstant("assessedAt"),
        )
    }

    fun parseSourceGovernanceEnvelope(
        envelope: JsonObject,
        expectedInitiativeId: UUID,
    ): SourceGovernanceProjection {
        val projection = readResult(envelope).requireObject()
        projection.requireExactKeys(
            "schemaVersion", "kind", "product", "initiative", "assessment", "sources", "baselines",
            "provenance", "limits", "observedAt", "privacyBoundary", "authorityBoundary", "snapshotDigest",
        )
        if (projection.requireInt("schemaVersion") != 1 ||
            projection.requireString("kind") != "source-governance-projection" ||
            projection.requireString("privacyBoundary") != SOURCE_PROJECTION_PRIVACY_BOUNDARY ||
            projection.requireString("authorityBoundary") != SOURCE_PROJECTION_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val snapshotDigest = projection.requireDigest("snapshotDigest")
        val digestBody = projection.deepCopy().also { it.remove("snapshotDigest") }
        if (snapshotDigest != canonicalDigest(digestBody)) throw invalidResponse()

        val product = projection.get("product").requireObject()
        product.requireExactKeys("id", "revision", "digest")
        val productId = product.requireNonEmptyUuid("id")
        val productRevision = product.requireLong("revision")
        if (productRevision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
        val productDigest = product.requireDigest("digest")
        val initiative = projection.get("initiative").requireObject()
        initiative.requireExactKeys("id", "revision", "digest", "state")
        val initiativeId = initiative.requireNonEmptyUuid("id")
        val initiativeRevision = initiative.requireLong("revision")
        if (initiativeId != expectedInitiativeId || initiativeRevision !in 1..MAX_SAFE_PRODUCT_REVISION) {
            throw invalidResponse()
        }
        val initiativeDigest = initiative.requireDigest("digest")
        val initiativeState = initiative.requireOneOf(
            "state",
            setOf("proposed", "active", "blocked", "completed", "cancelled"),
        )

        val assessment = projection.get("assessment").requireObject()
        assessment.requireKeys(
            setOf(
                "schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision",
                "sourceCount", "baselineCount", "provenanceCount", "staleSourceCount", "unknownAuthorityCount",
                "unbaselinedSourceCount", "unprovenancedSourceCount", "state", "reasons", "assessedAt",
                "authorityBoundary",
            ),
            setOf("currentBaseline"),
        )
        if (assessment.requireInt("schemaVersion") != 1 ||
            assessment.requireString("kind") != "source-governance-assessment" ||
            assessment.requireNonEmptyUuid("productId") != productId ||
            assessment.requireLong("productRevision") != productRevision ||
            assessment.requireNonEmptyUuid("initiativeId") != initiativeId ||
            assessment.requireLong("initiativeRevision") != initiativeRevision ||
            assessment.requireString("authorityBoundary") != SOURCE_ASSESSMENT_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val sourceCount = assessment.requireBoundedNonNegativeInt("sourceCount", 10_000)
        val baselineCount = assessment.requireBoundedNonNegativeInt("baselineCount", 10_000)
        val provenanceCount = assessment.requireBoundedNonNegativeInt("provenanceCount", 10_000)
        val staleSourceCount = assessment.requireBoundedNonNegativeInt("staleSourceCount", sourceCount)
        val unknownAuthorityCount = assessment.requireBoundedNonNegativeInt("unknownAuthorityCount", sourceCount)
        val unbaselinedSourceCount = assessment.requireBoundedNonNegativeInt("unbaselinedSourceCount", sourceCount)
        val unprovenancedSourceCount = assessment.requireBoundedNonNegativeInt("unprovenancedSourceCount", sourceCount)
        val assessmentState = assessment.requireOneOf("state", setOf("ready", "attention-required"))
        val reasonsElement = assessment.get("reasons")
        if (reasonsElement == null || !reasonsElement.isJsonArray || reasonsElement.asJsonArray.size() > 512) {
            throw invalidResponse()
        }
        val reasons = reasonsElement.asJsonArray.map { portableText(it.requireString(), 2, 2_000) }
        if ((assessmentState == "ready") != reasons.isEmpty()) throw invalidResponse()
        val assessedAt = assessment.requireInstant("assessedAt")
        val currentBaseline = assessment.get("currentBaseline")?.let { element ->
            val current = element.requireObject()
            current.requireExactKeys("id", "revision", "digest", "membershipDigest", "status", "memberCount")
            val id = current.requireNonEmptyUuid("id")
            val revision = current.requireLong("revision")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION ||
                current.requireBoundedNonNegativeInt("memberCount", 2_000) < 1
            ) throw invalidResponse()
            current.requireDigest("digest")
            current.requireDigest("membershipDigest")
            "$id@$revision · ${current.requireOneOf("status", setOf("current", "stale", "incomplete"))}"
        }
        if ((baselineCount == 0) != (currentBaseline == null)) throw invalidResponse()

        val limits = projection.get("limits").requireObject()
        limits.requireExactKeys("sources", "baselines", "provenance")
        fun parseLimit(name: String, expectedTotal: Int): Int {
            val limit = limits.get(name).requireObject()
            limit.requireExactKeys("shown", "total", "omitted")
            val shown = limit.requireBoundedNonNegativeInt("shown", 200)
            val total = limit.requireBoundedNonNegativeInt("total", 10_000)
            val omitted = limit.requireBoundedNonNegativeInt("omitted", 10_000)
            if (total != expectedTotal || shown + omitted != total) throw invalidResponse()
            return shown
        }
        val sourceShown = parseLimit("sources", sourceCount)
        val baselineShown = parseLimit("baselines", baselineCount)
        val provenanceShown = parseLimit("provenance", provenanceCount)
        val sourceTypes = setOf(
            "stakeholder-note", "voice-transcript", "whiteboard", "feature-list", "research", "repository",
            "requirements", "design", "architecture", "production-observation", "policy", "standard",
            "boilerplate", "dataset", "external-system", "other",
        )
        val knowledgeStates = setOf("confirmed", "inferred", "assumed", "placeholder", "deferred", "unknown")

        val sourceElements = projection.get("sources")
        if (sourceElements == null || !sourceElements.isJsonArray || sourceElements.asJsonArray.size() != sourceShown) {
            throw invalidResponse()
        }
        val sources = sourceElements.asJsonArray.map { element ->
            val source = element.requireObject()
            source.requireExactKeys(
                "id", "revision", "title", "sourceType", "owner", "semanticAuthority",
                "knowledgeDisposition", "informationClassification", "freshness", "availability",
                "contentDigest", "recordDigest", "updatedAt",
            )
            val id = source.requireNonEmptyUuid("id")
            val revision = source.requireLong("revision")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
            val title = portableText(source.requireString("title"), 2, 240)
            val sourceType = source.requireOneOf("sourceType", sourceTypes)
            val owner = source.get("owner").requireObject()
            owner.requireKeys(setOf("kind"), setOf("id"))
            val ownerKind = owner.requireOneOf("kind", setOf("human", "organization", "role", "system", "unassigned"))
            val ownerId = owner.get("id")?.requireString()?.let { portableText(it, 2, 2_000) }
            if ((ownerKind == "unassigned") != (ownerId == null)) throw invalidResponse()
            val semantic = source.get("semanticAuthority").requireObject()
            semantic.requireExactKeys("standing", "domain", "scope")
            val authority = semantic.requireOneOf(
                "standing",
                setOf("authoritative", "advisory", "non-authoritative", "unknown"),
            )
            val domain = portableText(semantic.requireString("domain"), 2, 2_000)
            validateInitiativeTextArray(semantic.get("scope"), 1, 128)
            val disposition = source.requireOneOf("knowledgeDisposition", knowledgeStates)
            val classification = source.requireOneOf(
                "informationClassification",
                setOf("public", "internal", "confidential", "restricted"),
            )
            val freshness = source.requireOneOf("freshness", setOf("fresh", "potentially-stale", "stale", "unknown"))
            val availability = source.requireOneOf(
                "availability",
                setOf("available", "unavailable", "moved", "deleted", "unknown"),
            )
            source.requireDigest("contentDigest")
            source.requireDigest("recordDigest")
            source.requireInstant("updatedAt")
            SourceGovernanceSourceView(
                id, revision, title, sourceType, "$ownerKind:${ownerId ?: "unassigned"}",
                "$authority · $domain", disposition, classification, freshness, availability,
            )
        }

        val baselineElements = projection.get("baselines")
        if (baselineElements == null || !baselineElements.isJsonArray ||
            baselineElements.asJsonArray.size() != baselineShown
        ) throw invalidResponse()
        val baselines = baselineElements.asJsonArray.map { element ->
            val baseline = element.requireObject()
            baseline.requireExactKeys(
                "id", "revision", "title", "state", "membershipDigest", "memberCount",
                "assessmentStatus", "updatedAt",
            )
            val id = baseline.requireNonEmptyUuid("id")
            val revision = baseline.requireLong("revision")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION || baseline.requireString("state") != "candidate") {
                throw invalidResponse()
            }
            val title = portableText(baseline.requireString("title"), 2, 240)
            baseline.requireDigest("membershipDigest")
            val memberCount = baseline.requireBoundedNonNegativeInt("memberCount", 2_000)
            if (memberCount < 1) throw invalidResponse()
            val status = baseline.requireOneOf(
                "assessmentStatus",
                setOf("current", "stale", "incomplete", "not-assessed"),
            )
            baseline.requireInstant("updatedAt")
            SourceGovernanceBaselineView(id, revision, title, memberCount, status)
        }

        val provenanceElements = projection.get("provenance")
        if (provenanceElements == null || !provenanceElements.isJsonArray ||
            provenanceElements.asJsonArray.size() != provenanceShown
        ) throw invalidResponse()
        val provenance = provenanceElements.asJsonArray.map { element ->
            val record = element.requireObject()
            record.requireKeys(
                setOf(
                    "id", "targetKind", "targetDigest", "disposition", "sourceCount",
                    "transformationCount", "recordedAt",
                ),
                setOf("amendmentRecordId"),
            )
            val id = record.requireNonEmptyUuid("id")
            val targetKind = record.requireOneOf("targetKind", setOf("governed-record", "claim", "artifact"))
            record.requireDigest("targetDigest")
            val disposition = record.requireOneOf("disposition", knowledgeStates)
            val exactSources = record.requireBoundedNonNegativeInt("sourceCount", 256)
            if (exactSources < 1) throw invalidResponse()
            val transformations = record.requireBoundedNonNegativeInt("transformationCount", 128)
            record.get("amendmentRecordId")?.requireString()?.let(::parseNonEmptyUuid)
            record.requireInstant("recordedAt")
            SourceGovernanceProvenanceView(id, targetKind, disposition, exactSources, transformations)
        }
        if (sources.map { it.id }.distinct().size != sources.size ||
            baselines.map { it.id }.distinct().size != baselines.size ||
            provenance.map { it.id }.distinct().size != provenance.size ||
            (baselineCount > 0 && baselines.firstOrNull()?.let {
                currentBaseline?.startsWith("${it.id}@${it.revision} · ")
            } != true) ||
            projection.requireInstant("observedAt") != assessedAt
        ) throw invalidResponse()
        return SourceGovernanceProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest, initiativeState,
            assessmentState, reasons, sourceCount, baselineCount, provenanceCount, staleSourceCount,
            unknownAuthorityCount, unbaselinedSourceCount, unprovenancedSourceCount, currentBaseline,
            sources, baselines, provenance, snapshotDigest,
        )
    }

    fun parseBusinessUnderstandingEnvelope(
        envelope: JsonObject,
        expectedInitiativeId: UUID,
    ): BusinessUnderstandingProjection {
        val projection = readResult(envelope).requireObject()
        projection.requireKeys(
            setOf(
                "schemaVersion", "kind", "product", "initiative", "assessment", "observedAt",
                "privacyBoundary", "authorityBoundary", "snapshotDigest",
            ),
            setOf("businessUnderstanding", "stakeholderModel", "outcomeModel"),
        )
        if (projection.requireInt("schemaVersion") != 1 ||
            projection.requireString("kind") != "business-understanding-projection" ||
            projection.requireString("privacyBoundary") != BUSINESS_PROJECTION_PRIVACY_BOUNDARY ||
            projection.requireString("authorityBoundary") != BUSINESS_PROJECTION_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val snapshotDigest = projection.requireDigest("snapshotDigest")
        val digestBody = projection.deepCopy().also { it.remove("snapshotDigest") }
        if (snapshotDigest != canonicalDigest(digestBody)) throw invalidResponse()

        val product = projection.get("product").requireObject()
        product.requireExactKeys("id", "revision", "digest")
        val productId = product.requireNonEmptyUuid("id")
        val productRevision = product.requireLong("revision")
        if (productRevision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
        val productDigest = product.requireDigest("digest")

        val initiative = projection.get("initiative").requireObject()
        initiative.requireExactKeys("id", "revision", "digest", "state")
        val initiativeId = initiative.requireNonEmptyUuid("id")
        val initiativeRevision = initiative.requireLong("revision")
        if (initiativeId != expectedInitiativeId || initiativeRevision !in 1..MAX_SAFE_PRODUCT_REVISION) {
            throw invalidResponse()
        }
        val initiativeDigest = initiative.requireDigest("digest")
        val initiativeState = initiative.requireOneOf(
            "state",
            setOf("proposed", "active", "blocked", "completed", "cancelled"),
        )

        data class Reference(val id: UUID, val revision: Long, val digest: String)
        fun reference(container: JsonObject, name: String): Reference? = container.get(name)?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys("recordId", "revision", "digest")
            val revision = value.requireLong("revision")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
            Reference(value.requireNonEmptyUuid("recordId"), revision, value.requireDigest("digest"))
        }

        val assessment = projection.get("assessment").requireObject()
        assessment.requireKeys(
            setOf(
                "schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision",
                "stakeholderCount", "representedStakeholderCategoryCount", "unresolvedStakeholderCategoryCount",
                "verifiedAuthorityCount", "unverifiedAuthorityCount", "outcomeCount", "measureCount",
                "observedBaselineCount", "unresolvedQuestionCount", "blockingQuestionCount", "staleBindingCount",
                "staleSourceReferenceCount", "state", "reasons", "assessedAt", "authorityBoundary",
            ),
            setOf("businessUnderstanding", "stakeholderModel", "outcomeModel"),
        )
        if (assessment.requireInt("schemaVersion") != 1 ||
            assessment.requireString("kind") != "business-understanding-assessment" ||
            assessment.requireNonEmptyUuid("productId") != productId ||
            assessment.requireLong("productRevision") != productRevision ||
            assessment.requireNonEmptyUuid("initiativeId") != initiativeId ||
            assessment.requireLong("initiativeRevision") != initiativeRevision ||
            assessment.requireString("authorityBoundary") != BUSINESS_ASSESSMENT_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val businessReference = reference(assessment, "businessUnderstanding")
        val stakeholderReference = reference(assessment, "stakeholderModel")
        val outcomeReference = reference(assessment, "outcomeModel")
        val stakeholderCount = assessment.requireBoundedNonNegativeInt("stakeholderCount", 256)
        val representedCategoryCount =
            assessment.requireBoundedNonNegativeInt("representedStakeholderCategoryCount", 8)
        val unresolvedCategoryCount =
            assessment.requireBoundedNonNegativeInt("unresolvedStakeholderCategoryCount", 8)
        val verifiedAuthorityCount = assessment.requireBoundedNonNegativeInt("verifiedAuthorityCount", 256)
        val unverifiedAuthorityCount = assessment.requireBoundedNonNegativeInt("unverifiedAuthorityCount", 256)
        val outcomeCount = assessment.requireBoundedNonNegativeInt("outcomeCount", 256)
        val measureCount = assessment.requireBoundedNonNegativeInt("measureCount", 512)
        val observedBaselineCount = assessment.requireBoundedNonNegativeInt("observedBaselineCount", measureCount)
        val unresolvedQuestionCount = assessment.requireBoundedNonNegativeInt("unresolvedQuestionCount", 256)
        val blockingQuestionCount =
            assessment.requireBoundedNonNegativeInt("blockingQuestionCount", unresolvedQuestionCount)
        val staleBindingCount = assessment.requireBoundedNonNegativeInt("staleBindingCount", 3)
        val staleSourceReferenceCount =
            assessment.requireBoundedNonNegativeInt("staleSourceReferenceCount", 10_000)
        if (representedCategoryCount + unresolvedCategoryCount > 8 ||
            verifiedAuthorityCount + unverifiedAuthorityCount > stakeholderCount
        ) throw invalidResponse()
        val assessmentState = assessment.requireOneOf(
            "state",
            setOf("complete-for-review", "attention-required"),
        )
        val reasonsElement = assessment.get("reasons")
        if (reasonsElement == null || !reasonsElement.isJsonArray || reasonsElement.asJsonArray.size() > 512) {
            throw invalidResponse()
        }
        val reasons = reasonsElement.asJsonArray.map { portableText(it.requireString(), 2, 2_000) }
        if ((assessmentState == "complete-for-review") != reasons.isEmpty()) throw invalidResponse()
        val assessedAt = assessment.requireInstant("assessedAt")

        fun matches(reference: Reference?, id: UUID, revision: Long, digest: String): Boolean =
            reference?.let { it.id == id && it.revision == revision && it.digest == digest } == true

        val business = projection.get("businessUnderstanding")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys(
                "id", "revision", "digest", "state", "objectiveCount", "constraintCount", "assumptionCount",
                "unresolvedQuestionCount", "glossaryTermCount", "updatedAt",
            )
            val id = value.requireNonEmptyUuid("id")
            val revision = value.requireLong("revision")
            val digest = value.requireDigest("digest")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION || value.requireString("state") != "candidate" ||
                !matches(businessReference, id, revision, digest)
            ) throw invalidResponse()
            val record = BusinessUnderstandingRecordView(
                id,
                revision,
                digest,
                value.requireBoundedNonNegativeInt("objectiveCount", 256),
                value.requireBoundedNonNegativeInt("constraintCount", 256),
                value.requireBoundedNonNegativeInt("assumptionCount", 256),
                value.requireBoundedNonNegativeInt("unresolvedQuestionCount", 256),
                value.requireBoundedNonNegativeInt("glossaryTermCount", 512),
            )
            value.requireInstant("updatedAt")
            record
        }
        val stakeholders = projection.get("stakeholderModel")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys(
                "id", "revision", "digest", "state", "stakeholderCount", "representedCategoryCount",
                "unresolvedCategoryCount", "verifiedAuthorityCount", "updatedAt",
            )
            val id = value.requireNonEmptyUuid("id")
            val revision = value.requireLong("revision")
            val digest = value.requireDigest("digest")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION || value.requireString("state") != "candidate" ||
                !matches(stakeholderReference, id, revision, digest)
            ) throw invalidResponse()
            val record = StakeholderModelRecordView(
                id,
                revision,
                digest,
                value.requireBoundedNonNegativeInt("stakeholderCount", 256),
                value.requireBoundedNonNegativeInt("representedCategoryCount", 8),
                value.requireBoundedNonNegativeInt("unresolvedCategoryCount", 8),
                value.requireBoundedNonNegativeInt("verifiedAuthorityCount", 256),
            )
            if (record.representedCategoryCount + record.unresolvedCategoryCount > 8 ||
                record.verifiedAuthorityCount > record.stakeholderCount
            ) throw invalidResponse()
            value.requireInstant("updatedAt")
            record
        }
        val outcomes = projection.get("outcomeModel")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys(
                "id", "revision", "digest", "state", "outcomeCount", "measureCount", "countermetricCount",
                "burdenMeasureCount", "observedBaselineCount", "updatedAt",
            )
            val id = value.requireNonEmptyUuid("id")
            val revision = value.requireLong("revision")
            val digest = value.requireDigest("digest")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION || value.requireString("state") != "candidate" ||
                !matches(outcomeReference, id, revision, digest)
            ) throw invalidResponse()
            val recordMeasureCount = value.requireBoundedNonNegativeInt("measureCount", 512)
            val record = OutcomeModelRecordView(
                id,
                revision,
                digest,
                value.requireBoundedNonNegativeInt("outcomeCount", 256),
                recordMeasureCount,
                value.requireBoundedNonNegativeInt("countermetricCount", recordMeasureCount),
                value.requireBoundedNonNegativeInt("burdenMeasureCount", recordMeasureCount),
                value.requireBoundedNonNegativeInt("observedBaselineCount", recordMeasureCount),
            )
            value.requireInstant("updatedAt")
            record
        }
        if ((businessReference == null) != (business == null) ||
            (stakeholderReference == null) != (stakeholders == null) ||
            (outcomeReference == null) != (outcomes == null) ||
            (business?.unresolvedQuestionCount ?: 0) != unresolvedQuestionCount ||
            (stakeholders?.stakeholderCount ?: 0) != stakeholderCount ||
            (stakeholders?.representedCategoryCount ?: 0) != representedCategoryCount ||
            (stakeholders?.unresolvedCategoryCount ?: 0) != unresolvedCategoryCount ||
            (stakeholders?.verifiedAuthorityCount ?: 0) != verifiedAuthorityCount ||
            (outcomes?.outcomeCount ?: 0) != outcomeCount ||
            (outcomes?.measureCount ?: 0) != measureCount ||
            (outcomes?.observedBaselineCount ?: 0) != observedBaselineCount ||
            projection.requireInstant("observedAt") != assessedAt
        ) throw invalidResponse()

        return BusinessUnderstandingProjection(
            productId,
            productRevision,
            productDigest,
            initiativeId,
            initiativeRevision,
            initiativeDigest,
            initiativeState,
            assessmentState,
            reasons,
            unresolvedQuestionCount,
            blockingQuestionCount,
            staleBindingCount,
            staleSourceReferenceCount,
            business,
            stakeholders,
            outcomes,
            snapshotDigest,
        )
    }

    fun parseBusinessCapabilityMapEnvelope(
        envelope: JsonObject,
        expectedInitiativeId: UUID,
    ): BusinessCapabilityMapProjection {
        val projection = readResult(envelope).requireObject()
        projection.requireKeys(
            setOf(
                "schemaVersion", "kind", "product", "initiative", "assessment", "observedAt",
                "privacyBoundary", "authorityBoundary", "snapshotDigest",
            ),
            setOf("capabilityMap"),
        )
        if (projection.requireInt("schemaVersion") != 1 ||
            projection.requireString("kind") != "business-capability-map-projection" ||
            projection.requireString("privacyBoundary") != CAPABILITY_MAP_PROJECTION_PRIVACY_BOUNDARY ||
            projection.requireString("authorityBoundary") != CAPABILITY_MAP_PROJECTION_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val snapshotDigest = projection.requireDigest("snapshotDigest")
        val digestBody = projection.deepCopy().also { it.remove("snapshotDigest") }
        if (snapshotDigest != canonicalDigest(digestBody)) throw invalidResponse()

        val product = projection.get("product").requireObject()
        product.requireExactKeys("id", "revision", "digest")
        val productId = product.requireNonEmptyUuid("id")
        val productRevision = product.requireLong("revision")
        if (productRevision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
        val productDigest = product.requireDigest("digest")

        val initiative = projection.get("initiative").requireObject()
        initiative.requireExactKeys("id", "revision", "digest", "state")
        val initiativeId = initiative.requireNonEmptyUuid("id")
        val initiativeRevision = initiative.requireLong("revision")
        if (initiativeId != expectedInitiativeId || initiativeRevision !in 1..MAX_SAFE_PRODUCT_REVISION) {
            throw invalidResponse()
        }
        val initiativeDigest = initiative.requireDigest("digest")
        val initiativeState = initiative.requireOneOf(
            "state",
            setOf("proposed", "active", "blocked", "completed", "cancelled"),
        )

        data class Reference(val id: UUID, val revision: Long, val digest: String)
        val assessment = projection.get("assessment").requireObject()
        assessment.requireKeys(
            setOf(
                "schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision",
                "capabilityCount", "ownedCapabilityCount", "unownedCapabilityCount", "objectiveCoverageCount",
                "outcomeCoverageCount", "openGapCount", "criticalGapCount", "unknownCurrentMaturityCount",
                "unassessedPriorityCount", "staleBindingCount", "staleSourceReferenceCount", "state", "reasons",
                "assessedAt", "authorityBoundary",
            ),
            setOf("capabilityMap"),
        )
        if (assessment.requireInt("schemaVersion") != 1 ||
            assessment.requireString("kind") != "business-capability-map-assessment" ||
            assessment.requireNonEmptyUuid("productId") != productId ||
            assessment.requireLong("productRevision") != productRevision ||
            assessment.requireNonEmptyUuid("initiativeId") != initiativeId ||
            assessment.requireLong("initiativeRevision") != initiativeRevision ||
            assessment.requireString("authorityBoundary") != CAPABILITY_MAP_ASSESSMENT_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val reference = assessment.get("capabilityMap")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys("recordId", "revision", "digest")
            val revision = value.requireLong("revision")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
            Reference(value.requireNonEmptyUuid("recordId"), revision, value.requireDigest("digest"))
        }
        val capabilityCount = assessment.requireBoundedNonNegativeInt("capabilityCount", 512)
        val ownedCapabilityCount = assessment.requireBoundedNonNegativeInt("ownedCapabilityCount", capabilityCount)
        val unownedCapabilityCount = assessment.requireBoundedNonNegativeInt("unownedCapabilityCount", capabilityCount)
        val objectiveCoverageCount = assessment.requireBoundedNonNegativeInt("objectiveCoverageCount", 256)
        val outcomeCoverageCount = assessment.requireBoundedNonNegativeInt("outcomeCoverageCount", 256)
        val openGapCount = assessment.requireBoundedNonNegativeInt("openGapCount", 131_072)
        val criticalGapCount = assessment.requireBoundedNonNegativeInt("criticalGapCount", openGapCount)
        val unknownCurrentMaturityCount =
            assessment.requireBoundedNonNegativeInt("unknownCurrentMaturityCount", capabilityCount)
        val unassessedPriorityCount =
            assessment.requireBoundedNonNegativeInt("unassessedPriorityCount", capabilityCount)
        val staleBindingCount = assessment.requireBoundedNonNegativeInt("staleBindingCount", 4)
        val staleSourceReferenceCount =
            assessment.requireBoundedNonNegativeInt("staleSourceReferenceCount", 131_072)
        if (ownedCapabilityCount + unownedCapabilityCount != capabilityCount) throw invalidResponse()
        val assessmentState = assessment.requireOneOf(
            "state",
            setOf("complete-for-review", "attention-required"),
        )
        val reasonsElement = assessment.get("reasons")
        if (reasonsElement == null || !reasonsElement.isJsonArray || reasonsElement.asJsonArray.size() > 512) {
            throw invalidResponse()
        }
        val reasons = reasonsElement.asJsonArray.map { portableText(it.requireString(), 2, 2_000) }
        if ((assessmentState == "complete-for-review") != reasons.isEmpty()) throw invalidResponse()
        val assessedAt = assessment.requireInstant("assessedAt")

        val map = projection.get("capabilityMap")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys(
                "id", "revision", "digest", "state", "capabilityCount", "ownedCapabilityCount",
                "openGapCount", "criticalGapCount", "candidatePriorityCount", "updatedAt",
            )
            val id = value.requireNonEmptyUuid("id")
            val revision = value.requireLong("revision")
            val digest = value.requireDigest("digest")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION ||
                value.requireString("state") != "candidate" ||
                reference?.let { it.id == id && it.revision == revision && it.digest == digest } != true
            ) throw invalidResponse()
            val recordCapabilityCount = value.requireBoundedNonNegativeInt("capabilityCount", 512)
            val record = BusinessCapabilityMapRecordView(
                id,
                revision,
                digest,
                recordCapabilityCount,
                value.requireBoundedNonNegativeInt("ownedCapabilityCount", recordCapabilityCount),
                value.requireBoundedNonNegativeInt("openGapCount", 131_072),
                value.requireBoundedNonNegativeInt("criticalGapCount", 131_072),
                value.requireBoundedNonNegativeInt("candidatePriorityCount", recordCapabilityCount),
            )
            if (record.criticalGapCount > record.openGapCount) throw invalidResponse()
            value.requireInstant("updatedAt")
            record
        }
        if ((reference == null) != (map == null) ||
            (map?.capabilityCount ?: 0) != capabilityCount ||
            (map?.ownedCapabilityCount ?: 0) != ownedCapabilityCount ||
            (map?.openGapCount ?: 0) != openGapCount ||
            (map?.criticalGapCount ?: 0) != criticalGapCount ||
            projection.requireInstant("observedAt") != assessedAt
        ) throw invalidResponse()
        return BusinessCapabilityMapProjection(
            productId,
            productRevision,
            productDigest,
            initiativeId,
            initiativeRevision,
            initiativeDigest,
            initiativeState,
            assessmentState,
            reasons,
            capabilityCount,
            ownedCapabilityCount,
            unownedCapabilityCount,
            objectiveCoverageCount,
            outcomeCoverageCount,
            openGapCount,
            criticalGapCount,
            unknownCurrentMaturityCount,
            unassessedPriorityCount,
            staleBindingCount,
            staleSourceReferenceCount,
            map,
            snapshotDigest,
        )
    }

    fun parseValueStreamModelEnvelope(
        envelope: JsonObject,
        expectedInitiativeId: UUID,
    ): ValueStreamModelProjection {
        val projection = readResult(envelope).requireObject()
        projection.requireKeys(
            setOf(
                "schemaVersion", "kind", "product", "initiative", "assessment", "observedAt",
                "privacyBoundary", "authorityBoundary", "snapshotDigest",
            ),
            setOf("valueStreamModel"),
        )
        if (projection.requireInt("schemaVersion") != 1 ||
            projection.requireString("kind") != "value-stream-model-projection" ||
            projection.requireString("privacyBoundary") != VALUE_STREAM_PROJECTION_PRIVACY_BOUNDARY ||
            projection.requireString("authorityBoundary") != VALUE_STREAM_PROJECTION_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val snapshotDigest = projection.requireDigest("snapshotDigest")
        val digestBody = projection.deepCopy().also { it.remove("snapshotDigest") }
        if (snapshotDigest != canonicalDigest(digestBody)) throw invalidResponse()

        val product = projection.get("product").requireObject()
        product.requireExactKeys("id", "revision", "digest")
        val productId = product.requireNonEmptyUuid("id")
        val productRevision = product.requireLong("revision")
        if (productRevision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
        val productDigest = product.requireDigest("digest")

        val initiative = projection.get("initiative").requireObject()
        initiative.requireExactKeys("id", "revision", "digest", "state")
        val initiativeId = initiative.requireNonEmptyUuid("id")
        val initiativeRevision = initiative.requireLong("revision")
        if (initiativeId != expectedInitiativeId || initiativeRevision !in 1..MAX_SAFE_PRODUCT_REVISION) {
            throw invalidResponse()
        }
        val initiativeDigest = initiative.requireDigest("digest")
        val initiativeState = initiative.requireOneOf(
            "state",
            setOf("proposed", "active", "blocked", "completed", "cancelled"),
        )

        data class Reference(val id: UUID, val revision: Long, val digest: String)
        val assessment = projection.get("assessment").requireObject()
        assessment.requireKeys(
            setOf(
                "schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision",
                "valueStreamCount", "ownedValueStreamCount", "unownedValueStreamCount", "stageCount",
                "dependencyCount", "capabilityCoverageCount", "outcomeCoverageCount", "absentFlowEvidenceCount",
                "openBottleneckCount", "criticalBottleneckCount", "staleBindingCount",
                "staleSourceReferenceCount", "state", "reasons", "assessedAt", "authorityBoundary",
            ),
            setOf("valueStreamModel"),
        )
        if (assessment.requireInt("schemaVersion") != 1 ||
            assessment.requireString("kind") != "value-stream-model-assessment" ||
            assessment.requireNonEmptyUuid("productId") != productId ||
            assessment.requireLong("productRevision") != productRevision ||
            assessment.requireNonEmptyUuid("initiativeId") != initiativeId ||
            assessment.requireLong("initiativeRevision") != initiativeRevision ||
            assessment.requireString("authorityBoundary") != VALUE_STREAM_ASSESSMENT_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val reference = assessment.get("valueStreamModel")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys("recordId", "revision", "digest")
            val revision = value.requireLong("revision")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
            Reference(value.requireNonEmptyUuid("recordId"), revision, value.requireDigest("digest"))
        }
        val valueStreamCount = assessment.requireBoundedNonNegativeInt("valueStreamCount", 256)
        val ownedValueStreamCount =
            assessment.requireBoundedNonNegativeInt("ownedValueStreamCount", valueStreamCount)
        val unownedValueStreamCount =
            assessment.requireBoundedNonNegativeInt("unownedValueStreamCount", valueStreamCount)
        val stageCount = assessment.requireBoundedNonNegativeInt("stageCount", 131_072)
        val dependencyCount = assessment.requireBoundedNonNegativeInt("dependencyCount", 65_536)
        val capabilityCoverageCount = assessment.requireBoundedNonNegativeInt("capabilityCoverageCount", 512)
        val outcomeCoverageCount = assessment.requireBoundedNonNegativeInt("outcomeCoverageCount", 512)
        val absentFlowEvidenceCount =
            assessment.requireBoundedNonNegativeInt("absentFlowEvidenceCount", stageCount)
        val openBottleneckCount = assessment.requireBoundedNonNegativeInt("openBottleneckCount", 131_072)
        val criticalBottleneckCount =
            assessment.requireBoundedNonNegativeInt("criticalBottleneckCount", openBottleneckCount)
        val staleBindingCount = assessment.requireBoundedNonNegativeInt("staleBindingCount", 5)
        val staleSourceReferenceCount =
            assessment.requireBoundedNonNegativeInt("staleSourceReferenceCount", 131_072)
        if (ownedValueStreamCount + unownedValueStreamCount != valueStreamCount) throw invalidResponse()
        val assessmentState = assessment.requireOneOf(
            "state",
            setOf("complete-for-review", "attention-required"),
        )
        val reasonsElement = assessment.get("reasons")
        if (reasonsElement == null || !reasonsElement.isJsonArray || reasonsElement.asJsonArray.size() > 512) {
            throw invalidResponse()
        }
        val reasons = reasonsElement.asJsonArray.map { portableText(it.requireString(), 2, 2_000) }
        if ((assessmentState == "complete-for-review") != reasons.isEmpty()) throw invalidResponse()
        val assessedAt = assessment.requireInstant("assessedAt")

        val model = projection.get("valueStreamModel")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys(
                "id", "revision", "digest", "state", "valueStreamCount", "ownedValueStreamCount",
                "stageCount", "dependencyCount", "openBottleneckCount", "criticalBottleneckCount", "updatedAt",
            )
            val id = value.requireNonEmptyUuid("id")
            val revision = value.requireLong("revision")
            val digest = value.requireDigest("digest")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION ||
                value.requireString("state") != "candidate" ||
                reference?.let { it.id == id && it.revision == revision && it.digest == digest } != true
            ) throw invalidResponse()
            val recordValueStreamCount = value.requireBoundedNonNegativeInt("valueStreamCount", 256)
            val record = ValueStreamModelRecordView(
                id,
                revision,
                digest,
                recordValueStreamCount,
                value.requireBoundedNonNegativeInt("ownedValueStreamCount", recordValueStreamCount),
                value.requireBoundedNonNegativeInt("stageCount", 131_072),
                value.requireBoundedNonNegativeInt("dependencyCount", 65_536),
                value.requireBoundedNonNegativeInt("openBottleneckCount", 131_072),
                value.requireBoundedNonNegativeInt("criticalBottleneckCount", 131_072),
            )
            if (record.criticalBottleneckCount > record.openBottleneckCount) throw invalidResponse()
            value.requireInstant("updatedAt")
            record
        }
        if ((reference == null) != (model == null) ||
            (model?.valueStreamCount ?: 0) != valueStreamCount ||
            (model?.ownedValueStreamCount ?: 0) != ownedValueStreamCount ||
            (model?.stageCount ?: 0) != stageCount ||
            (model?.dependencyCount ?: 0) != dependencyCount ||
            (model?.openBottleneckCount ?: 0) != openBottleneckCount ||
            (model?.criticalBottleneckCount ?: 0) != criticalBottleneckCount ||
            projection.requireInstant("observedAt") != assessedAt
        ) throw invalidResponse()
        return ValueStreamModelProjection(
            productId,
            productRevision,
            productDigest,
            initiativeId,
            initiativeRevision,
            initiativeDigest,
            initiativeState,
            assessmentState,
            reasons,
            valueStreamCount,
            ownedValueStreamCount,
            unownedValueStreamCount,
            stageCount,
            dependencyCount,
            capabilityCoverageCount,
            outcomeCoverageCount,
            absentFlowEvidenceCount,
            openBottleneckCount,
            criticalBottleneckCount,
            staleBindingCount,
            staleSourceReferenceCount,
            model,
            snapshotDigest,
        )
    }

    fun parseOperatingModelEnvelope(
        envelope: JsonObject,
        expectedInitiativeId: UUID,
    ): OperatingModelProjection {
        val projection = readResult(envelope).requireObject()
        projection.requireKeys(
            setOf(
                "schemaVersion", "kind", "product", "initiative", "assessment", "observedAt",
                "privacyBoundary", "authorityBoundary", "snapshotDigest",
            ),
            setOf("operatingModel"),
        )
        if (projection.requireInt("schemaVersion") != 1 ||
            projection.requireString("kind") != "operating-model-projection" ||
            projection.requireString("privacyBoundary") != OPERATING_MODEL_PROJECTION_PRIVACY_BOUNDARY ||
            projection.requireString("authorityBoundary") != OPERATING_MODEL_PROJECTION_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val snapshotDigest = projection.requireDigest("snapshotDigest")
        val digestBody = projection.deepCopy().also { it.remove("snapshotDigest") }
        if (snapshotDigest != canonicalDigest(digestBody)) throw invalidResponse()

        val product = projection.get("product").requireObject()
        product.requireExactKeys("id", "revision", "digest")
        val productId = product.requireNonEmptyUuid("id")
        val productRevision = product.requireLong("revision")
        if (productRevision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
        val productDigest = product.requireDigest("digest")
        val initiative = projection.get("initiative").requireObject()
        initiative.requireExactKeys("id", "revision", "digest", "state")
        val initiativeId = initiative.requireNonEmptyUuid("id")
        val initiativeRevision = initiative.requireLong("revision")
        if (initiativeId != expectedInitiativeId || initiativeRevision !in 1..MAX_SAFE_PRODUCT_REVISION) {
            throw invalidResponse()
        }
        val initiativeDigest = initiative.requireDigest("digest")
        val initiativeState = initiative.requireOneOf(
            "state",
            setOf("proposed", "active", "blocked", "completed", "cancelled"),
        )

        data class Reference(val id: UUID, val revision: Long, val digest: String)
        val assessment = projection.get("assessment").requireObject()
        assessment.requireKeys(
            setOf(
                "schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision",
                "roleCount", "governanceSystemCount", "unassignedAppointingAuthorityCount",
                "insufficientCapacityCount", "unfundedCapacityCount", "decisionRightCount",
                "unassignedDecisionAuthorityCount", "forumCount", "cycleCount", "supportCapacityGapCount",
                "emergencyAuthorityGapCount", "staleBindingCount", "staleSourceReferenceCount", "state",
                "reasons", "assessedAt", "authorityBoundary",
            ),
            setOf("operatingModel"),
        )
        if (assessment.requireInt("schemaVersion") != 1 ||
            assessment.requireString("kind") != "operating-model-assessment" ||
            assessment.requireNonEmptyUuid("productId") != productId ||
            assessment.requireLong("productRevision") != productRevision ||
            assessment.requireNonEmptyUuid("initiativeId") != initiativeId ||
            assessment.requireLong("initiativeRevision") != initiativeRevision ||
            assessment.requireString("authorityBoundary") != OPERATING_MODEL_ASSESSMENT_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val reference = assessment.get("operatingModel")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys("recordId", "revision", "digest")
            val revision = value.requireLong("revision")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
            Reference(value.requireNonEmptyUuid("recordId"), revision, value.requireDigest("digest"))
        }
        val roleCount = assessment.requireBoundedNonNegativeInt("roleCount", 256)
        val governanceSystemCount = assessment.requireBoundedNonNegativeInt("governanceSystemCount", 2)
        val unassignedAppointingAuthorityCount =
            assessment.requireBoundedNonNegativeInt("unassignedAppointingAuthorityCount", roleCount)
        val insufficientCapacityCount =
            assessment.requireBoundedNonNegativeInt("insufficientCapacityCount", roleCount)
        val unfundedCapacityCount = assessment.requireBoundedNonNegativeInt("unfundedCapacityCount", roleCount)
        val decisionRightCount = assessment.requireBoundedNonNegativeInt("decisionRightCount", 512)
        val unassignedDecisionAuthorityCount =
            assessment.requireBoundedNonNegativeInt("unassignedDecisionAuthorityCount", decisionRightCount)
        val forumCount = assessment.requireBoundedNonNegativeInt("forumCount", 128)
        val cycleCount = assessment.requireBoundedNonNegativeInt("cycleCount", 128)
        val supportCapacityGapCount = assessment.requireBoundedNonNegativeInt("supportCapacityGapCount", 1)
        val emergencyAuthorityGapCount = assessment.requireBoundedNonNegativeInt("emergencyAuthorityGapCount", 1)
        val staleBindingCount = assessment.requireBoundedNonNegativeInt("staleBindingCount", 6)
        val staleSourceReferenceCount =
            assessment.requireBoundedNonNegativeInt("staleSourceReferenceCount", 131_072)
        val assessmentState = assessment.requireOneOf(
            "state",
            setOf("complete-for-review", "attention-required"),
        )
        val reasonsElement = assessment.get("reasons")
        if (reasonsElement == null || !reasonsElement.isJsonArray || reasonsElement.asJsonArray.size() > 512) {
            throw invalidResponse()
        }
        val reasons = reasonsElement.asJsonArray.map { portableText(it.requireString(), 2, 2_000) }
        if ((assessmentState == "complete-for-review") != reasons.isEmpty()) throw invalidResponse()
        val assessedAt = assessment.requireInstant("assessedAt")

        val model = projection.get("operatingModel")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys(
                "id", "revision", "digest", "state", "roleCount", "decisionRightCount",
                "forumCount", "cycleCount", "updatedAt",
            )
            val id = value.requireNonEmptyUuid("id")
            val revision = value.requireLong("revision")
            val digest = value.requireDigest("digest")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION ||
                value.requireString("state") != "candidate" ||
                reference?.let { it.id == id && it.revision == revision && it.digest == digest } != true
            ) throw invalidResponse()
            val record = OperatingModelRecordView(
                id,
                revision,
                digest,
                value.requireBoundedNonNegativeInt("roleCount", 256),
                value.requireBoundedNonNegativeInt("decisionRightCount", 512),
                value.requireBoundedNonNegativeInt("forumCount", 128),
                value.requireBoundedNonNegativeInt("cycleCount", 128),
            )
            value.requireInstant("updatedAt")
            record
        }
        if ((reference == null) != (model == null) ||
            (model?.roleCount ?: 0) != roleCount ||
            (model?.decisionRightCount ?: 0) != decisionRightCount ||
            (model?.forumCount ?: 0) != forumCount ||
            (model?.cycleCount ?: 0) != cycleCount ||
            projection.requireInstant("observedAt") != assessedAt
        ) throw invalidResponse()
        return OperatingModelProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reasons, roleCount, governanceSystemCount,
            unassignedAppointingAuthorityCount, insufficientCapacityCount, unfundedCapacityCount,
            decisionRightCount, unassignedDecisionAuthorityCount, forumCount, cycleCount, supportCapacityGapCount,
            emergencyAuthorityGapCount, staleBindingCount, staleSourceReferenceCount, model, snapshotDigest,
        )
    }

    fun parseBusinessRuleCatalogEnvelope(
        envelope: JsonObject,
        expectedInitiativeId: UUID,
    ): BusinessRuleCatalogProjection {
        val projection = readResult(envelope).requireObject()
        projection.requireKeys(
            setOf(
                "schemaVersion", "kind", "product", "initiative", "assessment", "observedAt",
                "privacyBoundary", "authorityBoundary", "snapshotDigest",
            ),
            setOf("businessRuleCatalog"),
        )
        if (projection.requireInt("schemaVersion") != 1 ||
            projection.requireString("kind") != "business-rule-catalog-projection" ||
            projection.requireString("privacyBoundary") != BUSINESS_RULE_PROJECTION_PRIVACY_BOUNDARY ||
            projection.requireString("authorityBoundary") != BUSINESS_RULE_PROJECTION_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val snapshotDigest = projection.requireDigest("snapshotDigest")
        val digestBody = projection.deepCopy().also { it.remove("snapshotDigest") }
        if (snapshotDigest != canonicalDigest(digestBody)) throw invalidResponse()

        val product = projection.get("product").requireObject()
        product.requireExactKeys("id", "revision", "digest")
        val productId = product.requireNonEmptyUuid("id")
        val productRevision = product.requireLong("revision")
        if (productRevision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
        val productDigest = product.requireDigest("digest")
        val initiative = projection.get("initiative").requireObject()
        initiative.requireExactKeys("id", "revision", "digest", "state")
        val initiativeId = initiative.requireNonEmptyUuid("id")
        val initiativeRevision = initiative.requireLong("revision")
        if (initiativeId != expectedInitiativeId || initiativeRevision !in 1..MAX_SAFE_PRODUCT_REVISION) {
            throw invalidResponse()
        }
        val initiativeDigest = initiative.requireDigest("digest")
        val initiativeState = initiative.requireOneOf(
            "state",
            setOf("proposed", "active", "blocked", "completed", "cancelled"),
        )

        data class Reference(val id: UUID, val revision: Long, val digest: String)
        val assessment = projection.get("assessment").requireObject()
        assessment.requireKeys(
            setOf(
                "schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision",
                "ruleCount", "sourceBackedRuleCount", "nonExceptionableRuleCount", "enforcementTargetCount",
                "unassignedEnforcementTargetCount", "unverifiedEnforcementTargetCount", "exceptionCount",
                "unassignedExceptionAuthorityCount", "staleBindingCount", "staleSourceReferenceCount", "state",
                "reasons", "assessedAt", "authorityBoundary",
            ),
            setOf("businessRuleCatalog"),
        )
        if (assessment.requireInt("schemaVersion") != 1 ||
            assessment.requireString("kind") != "business-rule-catalog-assessment" ||
            assessment.requireNonEmptyUuid("productId") != productId ||
            assessment.requireLong("productRevision") != productRevision ||
            assessment.requireNonEmptyUuid("initiativeId") != initiativeId ||
            assessment.requireLong("initiativeRevision") != initiativeRevision ||
            assessment.requireString("authorityBoundary") != BUSINESS_RULE_ASSESSMENT_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val reference = assessment.get("businessRuleCatalog")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys("recordId", "revision", "digest")
            val revision = value.requireLong("revision")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
            Reference(value.requireNonEmptyUuid("recordId"), revision, value.requireDigest("digest"))
        }
        val ruleCount = assessment.requireBoundedNonNegativeInt("ruleCount", 512)
        val sourceBackedRuleCount = assessment.requireBoundedNonNegativeInt("sourceBackedRuleCount", ruleCount)
        val nonExceptionableRuleCount = assessment.requireBoundedNonNegativeInt("nonExceptionableRuleCount", ruleCount)
        val enforcementTargetCount = assessment.requireBoundedNonNegativeInt("enforcementTargetCount", 512)
        val unassignedEnforcementTargetCount =
            assessment.requireBoundedNonNegativeInt("unassignedEnforcementTargetCount", enforcementTargetCount)
        val unverifiedEnforcementTargetCount =
            assessment.requireBoundedNonNegativeInt("unverifiedEnforcementTargetCount", enforcementTargetCount)
        val exceptionCount = assessment.requireBoundedNonNegativeInt("exceptionCount", 512)
        val unassignedExceptionAuthorityCount =
            assessment.requireBoundedNonNegativeInt("unassignedExceptionAuthorityCount", exceptionCount)
        val staleBindingCount = assessment.requireBoundedNonNegativeInt("staleBindingCount", 9)
        val staleSourceReferenceCount =
            assessment.requireBoundedNonNegativeInt("staleSourceReferenceCount", 131_072)
        val assessmentState = assessment.requireOneOf(
            "state",
            setOf("complete-for-review", "attention-required"),
        )
        val reasonsElement = assessment.get("reasons")
        if (reasonsElement == null || !reasonsElement.isJsonArray || reasonsElement.asJsonArray.size() > 512) {
            throw invalidResponse()
        }
        val reasons = reasonsElement.asJsonArray.map { portableText(it.requireString(), 2, 2_000) }
        if ((assessmentState == "complete-for-review") != reasons.isEmpty()) throw invalidResponse()
        val assessedAt = assessment.requireInstant("assessedAt")

        val catalog = projection.get("businessRuleCatalog")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys(
                "id", "revision", "digest", "state", "ruleCount", "enforcementTargetCount",
                "exceptionCount", "nonExceptionableRuleCount", "updatedAt",
            )
            val id = value.requireNonEmptyUuid("id")
            val revision = value.requireLong("revision")
            val digest = value.requireDigest("digest")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION ||
                value.requireString("state") != "candidate" ||
                reference?.let { it.id == id && it.revision == revision && it.digest == digest } != true
            ) throw invalidResponse()
            val record = BusinessRuleCatalogRecordView(
                id,
                revision,
                digest,
                value.requireBoundedNonNegativeInt("ruleCount", 512),
                value.requireBoundedNonNegativeInt("enforcementTargetCount", 512),
                value.requireBoundedNonNegativeInt("exceptionCount", 512),
                value.requireBoundedNonNegativeInt("nonExceptionableRuleCount", 512),
            )
            value.requireInstant("updatedAt")
            record
        }
        if ((reference == null) != (catalog == null) ||
            (catalog?.ruleCount ?: 0) != ruleCount ||
            (catalog?.enforcementTargetCount ?: 0) != enforcementTargetCount ||
            (catalog?.exceptionCount ?: 0) != exceptionCount ||
            (catalog?.nonExceptionableRuleCount ?: 0) != nonExceptionableRuleCount ||
            projection.requireInstant("observedAt") != assessedAt
        ) throw invalidResponse()
        return BusinessRuleCatalogProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reasons, ruleCount, sourceBackedRuleCount, nonExceptionableRuleCount,
            enforcementTargetCount, unassignedEnforcementTargetCount, unverifiedEnforcementTargetCount,
            exceptionCount, unassignedExceptionAuthorityCount, staleBindingCount, staleSourceReferenceCount,
            catalog, snapshotDigest,
        )
    }

    fun parseBusinessArchitectureBaselineEnvelope(
        envelope: JsonObject,
        expectedInitiativeId: UUID,
    ): BusinessArchitectureBaselineProjection {
        val projection = readResult(envelope).requireObject()
        projection.requireKeys(
            setOf(
                "schemaVersion", "kind", "product", "initiative", "assessment", "observedAt",
                "privacyBoundary", "authorityBoundary", "snapshotDigest",
            ),
            setOf("baseline"),
        )
        if (projection.requireInt("schemaVersion") != 1 ||
            projection.requireString("kind") != "business-architecture-baseline-projection" ||
            projection.requireString("privacyBoundary") != BUSINESS_ARCHITECTURE_BASELINE_PROJECTION_PRIVACY_BOUNDARY ||
            projection.requireString("authorityBoundary") != BUSINESS_ARCHITECTURE_BASELINE_PROJECTION_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val snapshotDigest = projection.requireDigest("snapshotDigest")
        val digestBody = projection.deepCopy().also { it.remove("snapshotDigest") }
        if (snapshotDigest != canonicalDigest(digestBody)) throw invalidResponse()

        val product = projection.get("product").requireObject()
        product.requireExactKeys("id", "revision", "digest")
        val productId = product.requireNonEmptyUuid("id")
        val productRevision = product.requireLong("revision")
        if (productRevision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
        val productDigest = product.requireDigest("digest")
        val initiative = projection.get("initiative").requireObject()
        initiative.requireExactKeys("id", "revision", "digest", "state")
        val initiativeId = initiative.requireNonEmptyUuid("id")
        val initiativeRevision = initiative.requireLong("revision")
        if (initiativeId != expectedInitiativeId || initiativeRevision !in 1..MAX_SAFE_PRODUCT_REVISION) {
            throw invalidResponse()
        }
        val initiativeDigest = initiative.requireDigest("digest")
        val initiativeState = initiative.requireOneOf(
            "state",
            setOf("proposed", "active", "blocked", "completed", "cancelled"),
        )

        data class Reference(val id: UUID, val revision: Long, val digest: String)
        val assessment = projection.get("assessment").requireObject()
        assessment.requireKeys(
            setOf(
                "schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision",
                "coveredElementCount", "includedElementCount", "excludedElementCount", "unresolvedElementCount",
                "integrationClaimCount", "consistencyCheckCount", "consistencyGapCount", "staleBindingCount",
                "staleSourceReferenceCount", "state", "reasons", "assessedAt", "authorityBoundary",
            ),
            setOf("baseline"),
        )
        if (assessment.requireInt("schemaVersion") != 1 ||
            assessment.requireString("kind") != "business-architecture-baseline-assessment" ||
            assessment.requireNonEmptyUuid("productId") != productId ||
            assessment.requireLong("productRevision") != productRevision ||
            assessment.requireNonEmptyUuid("initiativeId") != initiativeId ||
            assessment.requireLong("initiativeRevision") != initiativeRevision ||
            assessment.requireString("authorityBoundary") != BUSINESS_ARCHITECTURE_BASELINE_ASSESSMENT_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val reference = assessment.get("baseline")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys("recordId", "revision", "digest")
            val revision = value.requireLong("revision")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
            Reference(value.requireNonEmptyUuid("recordId"), revision, value.requireDigest("digest"))
        }
        val coveredElementCount = assessment.requireBoundedNonNegativeInt("coveredElementCount", 4_096)
        val includedElementCount = assessment.requireBoundedNonNegativeInt("includedElementCount", coveredElementCount)
        val excludedElementCount = assessment.requireBoundedNonNegativeInt("excludedElementCount", coveredElementCount)
        val unresolvedElementCount = assessment.requireBoundedNonNegativeInt("unresolvedElementCount", coveredElementCount)
        if (includedElementCount + excludedElementCount + unresolvedElementCount != coveredElementCount) {
            throw invalidResponse()
        }
        val integrationClaimCount = assessment.requireBoundedNonNegativeInt("integrationClaimCount", 2_048)
        val consistencyCheckCount = assessment.requireBoundedNonNegativeInt("consistencyCheckCount", 6)
        val consistencyGapCount = assessment.requireBoundedNonNegativeInt("consistencyGapCount", consistencyCheckCount)
        val staleBindingCount = assessment.requireBoundedNonNegativeInt("staleBindingCount", 16)
        val staleSourceReferenceCount = assessment.requireBoundedNonNegativeInt("staleSourceReferenceCount", 131_072)
        val assessmentState = assessment.requireOneOf("state", setOf("complete-for-review", "attention-required"))
        val reasonsElement = assessment.get("reasons")
        if (reasonsElement == null || !reasonsElement.isJsonArray || reasonsElement.asJsonArray.size() > 512) {
            throw invalidResponse()
        }
        val reasons = reasonsElement.asJsonArray.map { portableText(it.requireString(), 2, 2_000) }
        if ((assessmentState == "complete-for-review") != reasons.isEmpty()) throw invalidResponse()
        val assessedAt = assessment.requireInstant("assessedAt")

        val baseline = projection.get("baseline")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys(
                "id", "revision", "digest", "membershipDigest", "state", "coveredElementCount",
                "integrationClaimCount", "consistencyGapCount", "updatedAt",
            )
            val id = value.requireNonEmptyUuid("id")
            val revision = value.requireLong("revision")
            val digest = value.requireDigest("digest")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION ||
                value.requireString("state") != "candidate" ||
                reference?.let { it.id == id && it.revision == revision && it.digest == digest } != true
            ) throw invalidResponse()
            val record = BusinessArchitectureBaselineRecordView(
                id,
                revision,
                digest,
                value.requireDigest("membershipDigest"),
                value.requireBoundedNonNegativeInt("coveredElementCount", 4_096),
                value.requireBoundedNonNegativeInt("integrationClaimCount", 2_048),
                value.requireBoundedNonNegativeInt("consistencyGapCount", 6),
            )
            value.requireInstant("updatedAt")
            record
        }
        if ((reference == null) != (baseline == null) ||
            (baseline?.coveredElementCount ?: 0) != coveredElementCount ||
            (baseline?.integrationClaimCount ?: 0) != integrationClaimCount ||
            (baseline?.consistencyGapCount ?: 0) != consistencyGapCount ||
            projection.requireInstant("observedAt") != assessedAt
        ) throw invalidResponse()
        return BusinessArchitectureBaselineProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reasons, coveredElementCount, includedElementCount,
            excludedElementCount, unresolvedElementCount, integrationClaimCount, consistencyCheckCount,
            consistencyGapCount, staleBindingCount, staleSourceReferenceCount, baseline, snapshotDigest,
        )
    }

    fun parseSystemSolutionArchitectureEnvelope(
        envelope: JsonObject,
        expectedInitiativeId: UUID,
    ): SystemSolutionArchitectureProjection {
        val projection = readResult(envelope).requireObject()
        projection.requireKeys(
            setOf(
                "schemaVersion", "kind", "product", "initiative", "assessment", "observedAt",
                "privacyBoundary", "authorityBoundary", "snapshotDigest",
            ),
            setOf("architecture"),
        )
        if (projection.requireInt("schemaVersion") != 1 ||
            projection.requireString("kind") != "system-solution-architecture-projection" ||
            projection.requireString("privacyBoundary") != SYSTEM_SOLUTION_ARCHITECTURE_PROJECTION_PRIVACY_BOUNDARY ||
            projection.requireString("authorityBoundary") != SYSTEM_SOLUTION_ARCHITECTURE_PROJECTION_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val snapshotDigest = projection.requireDigest("snapshotDigest")
        val digestBody = projection.deepCopy().also { it.remove("snapshotDigest") }
        if (snapshotDigest != canonicalDigest(digestBody)) throw invalidResponse()

        val product = projection.get("product").requireObject()
        product.requireExactKeys("id", "revision", "digest")
        val productId = product.requireNonEmptyUuid("id")
        val productRevision = product.requireLong("revision")
        if (productRevision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
        val productDigest = product.requireDigest("digest")
        val initiative = projection.get("initiative").requireObject()
        initiative.requireExactKeys("id", "revision", "digest", "state")
        val initiativeId = initiative.requireNonEmptyUuid("id")
        val initiativeRevision = initiative.requireLong("revision")
        if (initiativeId != expectedInitiativeId || initiativeRevision !in 1..MAX_SAFE_PRODUCT_REVISION) {
            throw invalidResponse()
        }
        val initiativeDigest = initiative.requireDigest("digest")
        val initiativeState = initiative.requireOneOf(
            "state",
            setOf("proposed", "active", "blocked", "completed", "cancelled"),
        )

        data class Reference(val id: UUID, val revision: Long, val digest: String)
        val assessment = projection.get("assessment").requireObject()
        assessment.requireKeys(
            setOf(
                "schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision",
                "concernCount", "viewCount", "elementCount", "relationCount", "qualityAttributeCount",
                "unresolvedQualityAttributeCount", "decisionCount", "unresolvedDecisionCount",
                "conformanceCriterionCount", "unresolvedConformanceCriterionCount", "lifecycleGapCount",
                "inconsistencyCount", "unresolvedQuestionCount", "staleBindingCount", "staleSourceReferenceCount",
                "state", "reasons", "assessedAt", "authorityBoundary",
            ),
            setOf("architecture"),
        )
        if (assessment.requireInt("schemaVersion") != 1 ||
            assessment.requireString("kind") != "system-solution-architecture-assessment" ||
            assessment.requireNonEmptyUuid("productId") != productId ||
            assessment.requireLong("productRevision") != productRevision ||
            assessment.requireNonEmptyUuid("initiativeId") != initiativeId ||
            assessment.requireLong("initiativeRevision") != initiativeRevision ||
            assessment.requireString("authorityBoundary") != SYSTEM_SOLUTION_ARCHITECTURE_ASSESSMENT_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val reference = assessment.get("architecture")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys("recordId", "revision", "digest")
            val revision = value.requireLong("revision")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
            Reference(value.requireNonEmptyUuid("recordId"), revision, value.requireDigest("digest"))
        }
        val concernCount = assessment.requireBoundedNonNegativeInt("concernCount", 1_024)
        val viewCount = assessment.requireBoundedNonNegativeInt("viewCount", 1_024)
        val elementCount = assessment.requireBoundedNonNegativeInt("elementCount", 2_048)
        val relationCount = assessment.requireBoundedNonNegativeInt("relationCount", 4_096)
        val qualityAttributeCount = assessment.requireBoundedNonNegativeInt("qualityAttributeCount", 1_024)
        val unresolvedQualityAttributeCount = assessment.requireBoundedNonNegativeInt(
            "unresolvedQualityAttributeCount",
            qualityAttributeCount,
        )
        val decisionCount = assessment.requireBoundedNonNegativeInt("decisionCount", 1_024)
        val unresolvedDecisionCount = assessment.requireBoundedNonNegativeInt(
            "unresolvedDecisionCount",
            decisionCount,
        )
        val conformanceCriterionCount = assessment.requireBoundedNonNegativeInt("conformanceCriterionCount", 2_048)
        val unresolvedConformanceCriterionCount = assessment.requireBoundedNonNegativeInt(
            "unresolvedConformanceCriterionCount",
            conformanceCriterionCount,
        )
        val lifecycleGapCount = assessment.requireBoundedNonNegativeInt("lifecycleGapCount", 5)
        val inconsistencyCount = assessment.requireBoundedNonNegativeInt("inconsistencyCount", 512)
        val unresolvedQuestionCount = assessment.requireBoundedNonNegativeInt("unresolvedQuestionCount", 512)
        val staleBindingCount = assessment.requireBoundedNonNegativeInt("staleBindingCount", 16)
        val staleSourceReferenceCount = assessment.requireBoundedNonNegativeInt("staleSourceReferenceCount", 131_072)
        val assessmentState = assessment.requireOneOf("state", setOf("complete-for-review", "attention-required"))
        val reasonsElement = assessment.get("reasons")
        if (reasonsElement == null || !reasonsElement.isJsonArray || reasonsElement.asJsonArray.size() > 512) {
            throw invalidResponse()
        }
        val reasons = reasonsElement.asJsonArray.map { portableText(it.requireString(), 2, 2_000) }
        if ((assessmentState == "complete-for-review") != reasons.isEmpty()) throw invalidResponse()
        val assessedAt = assessment.requireInstant("assessedAt")

        val architecture = projection.get("architecture")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys(
                "id", "revision", "digest", "membershipDigest", "state", "concernCount", "viewCount",
                "elementCount", "qualityAttributeCount", "decisionCount", "updatedAt",
            )
            val id = value.requireNonEmptyUuid("id")
            val revision = value.requireLong("revision")
            val digest = value.requireDigest("digest")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION ||
                value.requireString("state") != "candidate" ||
                reference?.let { it.id == id && it.revision == revision && it.digest == digest } != true
            ) throw invalidResponse()
            val record = SystemSolutionArchitectureRecordView(
                id,
                revision,
                digest,
                value.requireDigest("membershipDigest"),
                value.requireBoundedNonNegativeInt("concernCount", 1_024),
                value.requireBoundedNonNegativeInt("viewCount", 1_024),
                value.requireBoundedNonNegativeInt("elementCount", 2_048),
                value.requireBoundedNonNegativeInt("qualityAttributeCount", 1_024),
                value.requireBoundedNonNegativeInt("decisionCount", 1_024),
            )
            value.requireInstant("updatedAt")
            record
        }
        if ((reference == null) != (architecture == null) ||
            (architecture?.concernCount ?: 0) != concernCount ||
            (architecture?.viewCount ?: 0) != viewCount ||
            (architecture?.elementCount ?: 0) != elementCount ||
            (architecture?.qualityAttributeCount ?: 0) != qualityAttributeCount ||
            (architecture?.decisionCount ?: 0) != decisionCount ||
            projection.requireInstant("observedAt") != assessedAt
        ) throw invalidResponse()
        return SystemSolutionArchitectureProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reasons, concernCount, viewCount, elementCount, relationCount,
            qualityAttributeCount, unresolvedQualityAttributeCount, decisionCount, unresolvedDecisionCount,
            conformanceCriterionCount, unresolvedConformanceCriterionCount, lifecycleGapCount, inconsistencyCount,
            unresolvedQuestionCount, staleBindingCount, staleSourceReferenceCount, architecture, snapshotDigest,
        )
    }

    fun parseBoundedContextModelEnvelope(
        envelope: JsonObject,
        expectedInitiativeId: UUID,
    ): BoundedContextModelProjection {
        val projection = readResult(envelope).requireObject()
        projection.requireKeys(
            setOf(
                "schemaVersion", "kind", "product", "initiative", "assessment", "observedAt",
                "privacyBoundary", "authorityBoundary", "snapshotDigest",
            ),
            setOf("model"),
        )
        if (projection.requireInt("schemaVersion") != 1 ||
            projection.requireString("kind") != "bounded-context-ownership-projection" ||
            projection.requireString("privacyBoundary") != BOUNDED_CONTEXT_MODEL_PROJECTION_PRIVACY_BOUNDARY ||
            projection.requireString("authorityBoundary") != BOUNDED_CONTEXT_MODEL_PROJECTION_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val snapshotDigest = projection.requireDigest("snapshotDigest")
        val digestBody = projection.deepCopy().also { it.remove("snapshotDigest") }
        if (snapshotDigest != canonicalDigest(digestBody)) throw invalidResponse()

        val product = projection.get("product").requireObject()
        product.requireExactKeys("id", "revision", "digest")
        val productId = product.requireNonEmptyUuid("id")
        val productRevision = product.requireLong("revision")
        if (productRevision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
        val productDigest = product.requireDigest("digest")
        val initiative = projection.get("initiative").requireObject()
        initiative.requireExactKeys("id", "revision", "digest", "state")
        val initiativeId = initiative.requireNonEmptyUuid("id")
        val initiativeRevision = initiative.requireLong("revision")
        if (initiativeId != expectedInitiativeId || initiativeRevision !in 1..MAX_SAFE_PRODUCT_REVISION) {
            throw invalidResponse()
        }
        val initiativeDigest = initiative.requireDigest("digest")
        val initiativeState = initiative.requireOneOf(
            "state",
            setOf("proposed", "active", "blocked", "completed", "cancelled"),
        )

        data class Reference(val id: UUID, val revision: Long, val digest: String)
        val assessment = projection.get("assessment").requireObject()
        assessment.requireKeys(
            setOf(
                "schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision",
                "boundedContextCount", "coreContextCount", "languageTermCount", "contractCount",
                "unresolvedContractCount", "relationshipCount", "unresolvedRelationshipCount",
                "unassignedArchitectureElementCount", "unownedDataAssetCount", "unmappedCrossContextRelationCount",
                "inconsistencyCount", "unresolvedQuestionCount", "staleBindingCount", "staleSourceReferenceCount",
                "state", "reasons", "assessedAt", "authorityBoundary",
            ),
            setOf("model"),
        )
        if (assessment.requireInt("schemaVersion") != 1 ||
            assessment.requireString("kind") != "bounded-context-ownership-assessment" ||
            assessment.requireNonEmptyUuid("productId") != productId ||
            assessment.requireLong("productRevision") != productRevision ||
            assessment.requireNonEmptyUuid("initiativeId") != initiativeId ||
            assessment.requireLong("initiativeRevision") != initiativeRevision ||
            assessment.requireString("authorityBoundary") != BOUNDED_CONTEXT_MODEL_ASSESSMENT_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val reference = assessment.get("model")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys("recordId", "revision", "digest")
            val revision = value.requireLong("revision")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
            Reference(value.requireNonEmptyUuid("recordId"), revision, value.requireDigest("digest"))
        }
        val boundedContextCount = assessment.requireBoundedNonNegativeInt("boundedContextCount", 1_024)
        val coreContextCount = assessment.requireBoundedNonNegativeInt("coreContextCount", boundedContextCount)
        val languageTermCount = assessment.requireBoundedNonNegativeInt("languageTermCount", 1_048_576)
        val contractCount = assessment.requireBoundedNonNegativeInt("contractCount", 4_096)
        val unresolvedContractCount = assessment.requireBoundedNonNegativeInt(
            "unresolvedContractCount",
            contractCount,
        )
        val relationshipCount = assessment.requireBoundedNonNegativeInt("relationshipCount", 4_096)
        val unresolvedRelationshipCount = assessment.requireBoundedNonNegativeInt(
            "unresolvedRelationshipCount",
            relationshipCount,
        )
        val unassignedArchitectureElementCount = assessment.requireBoundedNonNegativeInt(
            "unassignedArchitectureElementCount",
            2_048,
        )
        val unownedDataAssetCount = assessment.requireBoundedNonNegativeInt("unownedDataAssetCount", 2_048)
        val unmappedCrossContextRelationCount = assessment.requireBoundedNonNegativeInt(
            "unmappedCrossContextRelationCount",
            4_096,
        )
        val inconsistencyCount = assessment.requireBoundedNonNegativeInt("inconsistencyCount", 512)
        val unresolvedQuestionCount = assessment.requireBoundedNonNegativeInt("unresolvedQuestionCount", 512)
        val staleBindingCount = assessment.requireBoundedNonNegativeInt("staleBindingCount", 16)
        val staleSourceReferenceCount = assessment.requireBoundedNonNegativeInt("staleSourceReferenceCount", 131_072)
        val assessmentState = assessment.requireOneOf("state", setOf("complete-for-review", "attention-required"))
        val reasonsElement = assessment.get("reasons")
        if (reasonsElement == null || !reasonsElement.isJsonArray || reasonsElement.asJsonArray.size() > 512) {
            throw invalidResponse()
        }
        val reasons = reasonsElement.asJsonArray.map { portableText(it.requireString(), 2, 2_000) }
        if ((assessmentState == "complete-for-review") != reasons.isEmpty()) throw invalidResponse()
        val assessedAt = assessment.requireInstant("assessedAt")

        val model = projection.get("model")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys(
                "id", "revision", "digest", "membershipDigest", "state", "boundedContextCount",
                "contractCount", "relationshipCount", "updatedAt",
            )
            val id = value.requireNonEmptyUuid("id")
            val revision = value.requireLong("revision")
            val digest = value.requireDigest("digest")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION ||
                value.requireString("state") != "candidate" ||
                reference?.let { it.id == id && it.revision == revision && it.digest == digest } != true
            ) throw invalidResponse()
            val record = BoundedContextModelRecordView(
                id,
                revision,
                digest,
                value.requireDigest("membershipDigest"),
                value.requireBoundedNonNegativeInt("boundedContextCount", 1_024),
                value.requireBoundedNonNegativeInt("contractCount", 4_096),
                value.requireBoundedNonNegativeInt("relationshipCount", 4_096),
            )
            value.requireInstant("updatedAt")
            record
        }
        if ((reference == null) != (model == null) ||
            (model?.boundedContextCount ?: 0) != boundedContextCount ||
            (model?.contractCount ?: 0) != contractCount ||
            (model?.relationshipCount ?: 0) != relationshipCount ||
            projection.requireInstant("observedAt") != assessedAt
        ) throw invalidResponse()
        return BoundedContextModelProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reasons, boundedContextCount, coreContextCount, languageTermCount,
            contractCount, unresolvedContractCount, relationshipCount, unresolvedRelationshipCount,
            unassignedArchitectureElementCount, unownedDataAssetCount, unmappedCrossContextRelationCount,
            inconsistencyCount, unresolvedQuestionCount, staleBindingCount, staleSourceReferenceCount, model,
            snapshotDigest,
        )
    }

    fun parseSecurityPrivacyAssessmentEnvelope(
        envelope: JsonObject,
        expectedInitiativeId: UUID,
    ): SecurityPrivacyAssessmentProjection {
        val projection = readResult(envelope).requireObject()
        projection.requireKeys(
            setOf(
                "schemaVersion", "kind", "product", "initiative", "status", "observedAt",
                "privacyBoundary", "authorityBoundary", "snapshotDigest",
            ),
            setOf("assessment"),
        )
        if (projection.requireInt("schemaVersion") != 1 ||
            projection.requireString("kind") != "security-privacy-threat-assessment-projection" ||
            projection.requireString("privacyBoundary") != SECURITY_PRIVACY_ASSESSMENT_PROJECTION_PRIVACY_BOUNDARY ||
            projection.requireString("authorityBoundary") != SECURITY_PRIVACY_ASSESSMENT_PROJECTION_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val snapshotDigest = projection.requireDigest("snapshotDigest")
        val digestBody = projection.deepCopy().also { it.remove("snapshotDigest") }
        if (snapshotDigest != canonicalDigest(digestBody)) throw invalidResponse()

        val product = projection.get("product").requireObject()
        product.requireExactKeys("id", "revision", "digest")
        val productId = product.requireNonEmptyUuid("id")
        val productRevision = product.requireLong("revision")
        if (productRevision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
        val productDigest = product.requireDigest("digest")
        val initiative = projection.get("initiative").requireObject()
        initiative.requireExactKeys("id", "revision", "digest", "state")
        val initiativeId = initiative.requireNonEmptyUuid("id")
        val initiativeRevision = initiative.requireLong("revision")
        if (initiativeId != expectedInitiativeId || initiativeRevision !in 1..MAX_SAFE_PRODUCT_REVISION) {
            throw invalidResponse()
        }
        val initiativeDigest = initiative.requireDigest("digest")
        val initiativeState = initiative.requireOneOf(
            "state",
            setOf("proposed", "active", "blocked", "completed", "cancelled"),
        )

        data class Reference(val id: UUID, val revision: Long, val digest: String)
        val status = projection.get("status").requireObject()
        status.requireKeys(
            setOf(
                "schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision",
                "assetCount", "actorCount", "trustBoundaryCount", "dataClassCount", "dataFlowCount",
                "controlCount", "threatCount", "unresolvedThreatCount", "unverifiedControlCount",
                "unresolvedProcessingAuthorityCount", "uncoveredArchitectureElementCount",
                "unmappedArchitectureRelationCount", "unresolvedRequirementCount", "inconsistencyCount",
                "unresolvedQuestionCount", "staleBindingCount", "staleSourceReferenceCount", "state", "reasons",
                "assessedAt", "authorityBoundary",
            ),
            setOf("assessment"),
        )
        if (status.requireInt("schemaVersion") != 1 ||
            status.requireString("kind") != "security-privacy-threat-assessment-status" ||
            status.requireNonEmptyUuid("productId") != productId ||
            status.requireLong("productRevision") != productRevision ||
            status.requireNonEmptyUuid("initiativeId") != initiativeId ||
            status.requireLong("initiativeRevision") != initiativeRevision ||
            status.requireString("authorityBoundary") != SECURITY_PRIVACY_ASSESSMENT_STATUS_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val reference = status.get("assessment")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys("recordId", "revision", "digest")
            val revision = value.requireLong("revision")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
            Reference(value.requireNonEmptyUuid("recordId"), revision, value.requireDigest("digest"))
        }
        val assetCount = status.requireBoundedNonNegativeInt("assetCount", 2_048)
        val actorCount = status.requireBoundedNonNegativeInt("actorCount", 1_024)
        val trustBoundaryCount = status.requireBoundedNonNegativeInt("trustBoundaryCount", 2_048)
        val dataClassCount = status.requireBoundedNonNegativeInt("dataClassCount", 2_048)
        val dataFlowCount = status.requireBoundedNonNegativeInt("dataFlowCount", 4_096)
        val controlCount = status.requireBoundedNonNegativeInt("controlCount", 4_096)
        val threatCount = status.requireBoundedNonNegativeInt("threatCount", 4_096)
        val unresolvedThreatCount = status.requireBoundedNonNegativeInt("unresolvedThreatCount", threatCount)
        val unverifiedControlCount = status.requireBoundedNonNegativeInt("unverifiedControlCount", controlCount)
        val unresolvedProcessingAuthorityCount = status.requireBoundedNonNegativeInt(
            "unresolvedProcessingAuthorityCount",
            dataClassCount,
        )
        val uncoveredArchitectureElementCount = status.requireBoundedNonNegativeInt(
            "uncoveredArchitectureElementCount",
            2_048,
        )
        val unmappedArchitectureRelationCount = status.requireBoundedNonNegativeInt(
            "unmappedArchitectureRelationCount",
            4_096,
        )
        val unresolvedRequirementCount = status.requireBoundedNonNegativeInt("unresolvedRequirementCount", 28)
        val inconsistencyCount = status.requireBoundedNonNegativeInt("inconsistencyCount", 512)
        val unresolvedQuestionCount = status.requireBoundedNonNegativeInt("unresolvedQuestionCount", 512)
        val staleBindingCount = status.requireBoundedNonNegativeInt("staleBindingCount", 16)
        val staleSourceReferenceCount = status.requireBoundedNonNegativeInt("staleSourceReferenceCount", 131_072)
        val assessmentState = status.requireOneOf("state", setOf("complete-for-review", "attention-required"))
        val reasonsElement = status.get("reasons")
        if (reasonsElement == null || !reasonsElement.isJsonArray || reasonsElement.asJsonArray.size() > 512) {
            throw invalidResponse()
        }
        val reasons = reasonsElement.asJsonArray.map { portableText(it.requireString(), 2, 2_000) }
        if ((assessmentState == "complete-for-review") != reasons.isEmpty()) throw invalidResponse()
        val assessedAt = status.requireInstant("assessedAt")

        val assessment = projection.get("assessment")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys(
                "id", "revision", "digest", "membershipDigest", "state", "assetCount", "trustBoundaryCount",
                "dataClassCount", "controlCount", "threatCount", "updatedAt",
            )
            val id = value.requireNonEmptyUuid("id")
            val revision = value.requireLong("revision")
            val digest = value.requireDigest("digest")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION ||
                value.requireString("state") != "candidate" ||
                reference?.let { it.id == id && it.revision == revision && it.digest == digest } != true
            ) throw invalidResponse()
            val record = SecurityPrivacyAssessmentRecordView(
                id,
                revision,
                digest,
                value.requireDigest("membershipDigest"),
                value.requireBoundedNonNegativeInt("assetCount", 2_048),
                value.requireBoundedNonNegativeInt("trustBoundaryCount", 2_048),
                value.requireBoundedNonNegativeInt("dataClassCount", 2_048),
                value.requireBoundedNonNegativeInt("controlCount", 4_096),
                value.requireBoundedNonNegativeInt("threatCount", 4_096),
            )
            value.requireInstant("updatedAt")
            record
        }
        if ((reference == null) != (assessment == null) ||
            (assessment?.assetCount ?: 0) != assetCount ||
            (assessment?.trustBoundaryCount ?: 0) != trustBoundaryCount ||
            (assessment?.dataClassCount ?: 0) != dataClassCount ||
            (assessment?.controlCount ?: 0) != controlCount ||
            (assessment?.threatCount ?: 0) != threatCount ||
            projection.requireInstant("observedAt") != assessedAt
        ) throw invalidResponse()
        return SecurityPrivacyAssessmentProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reasons, assetCount, actorCount, trustBoundaryCount, dataClassCount,
            dataFlowCount, controlCount, threatCount, unresolvedThreatCount, unverifiedControlCount,
            unresolvedProcessingAuthorityCount, uncoveredArchitectureElementCount, unmappedArchitectureRelationCount,
            unresolvedRequirementCount, inconsistencyCount, unresolvedQuestionCount, staleBindingCount,
            staleSourceReferenceCount, assessment, snapshotDigest,
        )
    }

    fun parseProcessModelEnvelope(
        envelope: JsonObject,
        expectedInitiativeId: UUID,
    ): ProcessModelProjection {
        val projection = readResult(envelope).requireObject()
        projection.requireKeys(
            setOf(
                "schemaVersion", "kind", "product", "initiative", "status", "observedAt",
                "privacyBoundary", "authorityBoundary", "snapshotDigest",
            ),
            setOf("model"),
        )
        if (projection.requireInt("schemaVersion") != 1 ||
            projection.requireString("kind") != "process-model-projection" ||
            projection.requireString("privacyBoundary") != PROCESS_MODEL_PROJECTION_PRIVACY_BOUNDARY ||
            projection.requireString("authorityBoundary") != PROCESS_MODEL_PROJECTION_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val snapshotDigest = projection.requireDigest("snapshotDigest")
        val digestBody = projection.deepCopy().also { it.remove("snapshotDigest") }
        if (snapshotDigest != canonicalDigest(digestBody)) throw invalidResponse()

        val product = projection.get("product").requireObject()
        product.requireExactKeys("id", "revision", "digest")
        val productId = product.requireNonEmptyUuid("id")
        val productRevision = product.requireLong("revision")
        if (productRevision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
        val productDigest = product.requireDigest("digest")
        val initiative = projection.get("initiative").requireObject()
        initiative.requireExactKeys("id", "revision", "digest", "state")
        val initiativeId = initiative.requireNonEmptyUuid("id")
        val initiativeRevision = initiative.requireLong("revision")
        if (initiativeId != expectedInitiativeId || initiativeRevision !in 1..MAX_SAFE_PRODUCT_REVISION) {
            throw invalidResponse()
        }
        val initiativeDigest = initiative.requireDigest("digest")
        val initiativeState = initiative.requireOneOf(
            "state",
            setOf("proposed", "active", "blocked", "completed", "cancelled"),
        )

        data class Reference(val id: UUID, val revision: Long, val digest: String)
        val status = projection.get("status").requireObject()
        status.requireKeys(
            setOf(
                "schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision",
                "processCount", "stepCount", "stateDimensionCount", "stateValueCount", "transitionCount",
                "eventDefinitionCount", "approvalRequirementCount", "uncoveredValueStreamCount",
                "uncoveredBoundedContextCount", "uncoveredBusinessRuleCount", "unresolvedRequirementCount",
                "inconsistencyCount", "unresolvedQuestionCount", "staleBindingCount", "staleSourceReferenceCount",
                "state", "reasons", "assessedAt", "authorityBoundary",
            ),
            setOf("model"),
        )
        if (status.requireInt("schemaVersion") != 1 ||
            status.requireString("kind") != "process-model-status" ||
            status.requireNonEmptyUuid("productId") != productId ||
            status.requireLong("productRevision") != productRevision ||
            status.requireNonEmptyUuid("initiativeId") != initiativeId ||
            status.requireLong("initiativeRevision") != initiativeRevision ||
            status.requireString("authorityBoundary") != PROCESS_MODEL_STATUS_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val reference = status.get("model")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys("recordId", "revision", "digest")
            val revision = value.requireLong("revision")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
            Reference(value.requireNonEmptyUuid("recordId"), revision, value.requireDigest("digest"))
        }
        val processCount = status.requireBoundedNonNegativeInt("processCount", 512)
        val stepCount = status.requireBoundedNonNegativeInt("stepCount", 65_536)
        val stateDimensionCount = status.requireBoundedNonNegativeInt("stateDimensionCount", 32_768)
        val stateValueCount = status.requireBoundedNonNegativeInt("stateValueCount", 65_536)
        val transitionCount = status.requireBoundedNonNegativeInt("transitionCount", 65_536)
        val eventDefinitionCount = status.requireBoundedNonNegativeInt("eventDefinitionCount", 65_536)
        val approvalRequirementCount = status.requireBoundedNonNegativeInt("approvalRequirementCount", 32_768)
        val uncoveredValueStreamCount = status.requireBoundedNonNegativeInt("uncoveredValueStreamCount", 2_048)
        val uncoveredBoundedContextCount = status.requireBoundedNonNegativeInt("uncoveredBoundedContextCount", 2_048)
        val uncoveredBusinessRuleCount = status.requireBoundedNonNegativeInt("uncoveredBusinessRuleCount", 4_096)
        val unresolvedRequirementCount = status.requireBoundedNonNegativeInt("unresolvedRequirementCount", 70)
        val inconsistencyCount = status.requireBoundedNonNegativeInt("inconsistencyCount", 512)
        val unresolvedQuestionCount = status.requireBoundedNonNegativeInt("unresolvedQuestionCount", 512)
        val staleBindingCount = status.requireBoundedNonNegativeInt("staleBindingCount", 16)
        val staleSourceReferenceCount = status.requireBoundedNonNegativeInt("staleSourceReferenceCount", 131_072)
        val assessmentState = status.requireOneOf("state", setOf("complete-for-review", "attention-required"))
        val reasonsElement = status.get("reasons")
        if (reasonsElement == null || !reasonsElement.isJsonArray || reasonsElement.asJsonArray.size() > 512) {
            throw invalidResponse()
        }
        val reasons = reasonsElement.asJsonArray.map { portableText(it.requireString(), 2, 2_000) }
        if ((assessmentState == "complete-for-review") != reasons.isEmpty()) throw invalidResponse()
        val assessedAt = status.requireInstant("assessedAt")

        val model = projection.get("model")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys(
                "id", "revision", "digest", "membershipDigest", "state", "processCount", "transitionCount",
                "approvalRequirementCount", "updatedAt",
            )
            val id = value.requireNonEmptyUuid("id")
            val revision = value.requireLong("revision")
            val digest = value.requireDigest("digest")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION ||
                value.requireString("state") != "candidate" ||
                reference?.let { it.id == id && it.revision == revision && it.digest == digest } != true
            ) throw invalidResponse()
            val record = ProcessModelRecordView(
                id,
                revision,
                digest,
                value.requireDigest("membershipDigest"),
                value.requireBoundedNonNegativeInt("processCount", 512),
                value.requireBoundedNonNegativeInt("transitionCount", 65_536),
                value.requireBoundedNonNegativeInt("approvalRequirementCount", 32_768),
            )
            value.requireInstant("updatedAt")
            record
        }
        if ((reference == null) != (model == null) ||
            (model?.processCount ?: 0) != processCount ||
            (model?.transitionCount ?: 0) != transitionCount ||
            (model?.approvalRequirementCount ?: 0) != approvalRequirementCount ||
            projection.requireInstant("observedAt") != assessedAt
        ) throw invalidResponse()
        return ProcessModelProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reasons, processCount, stepCount, stateDimensionCount,
            stateValueCount, transitionCount, eventDefinitionCount, approvalRequirementCount,
            uncoveredValueStreamCount, uncoveredBoundedContextCount, uncoveredBusinessRuleCount,
            unresolvedRequirementCount, inconsistencyCount, unresolvedQuestionCount, staleBindingCount,
            staleSourceReferenceCount, model, snapshotDigest,
        )
    }

    fun parseDataModelEnvelope(
        envelope: JsonObject,
        expectedInitiativeId: UUID,
    ): DataModelProjection {
        val projection = readResult(envelope).requireObject()
        projection.requireKeys(
            setOf(
                "schemaVersion", "kind", "product", "initiative", "status", "observedAt",
                "privacyBoundary", "authorityBoundary", "snapshotDigest",
            ),
            setOf("model"),
        )
        if (projection.requireInt("schemaVersion") != 1 ||
            projection.requireString("kind") != "data-model-projection" ||
            projection.requireString("privacyBoundary") != DATA_MODEL_PROJECTION_PRIVACY_BOUNDARY ||
            projection.requireString("authorityBoundary") != DATA_MODEL_PROJECTION_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val snapshotDigest = projection.requireDigest("snapshotDigest")
        val digestBody = projection.deepCopy().also { it.remove("snapshotDigest") }
        if (snapshotDigest != canonicalDigest(digestBody)) throw invalidResponse()

        val product = projection.get("product").requireObject()
        product.requireExactKeys("id", "revision", "digest")
        val productId = product.requireNonEmptyUuid("id")
        val productRevision = product.requireLong("revision")
        if (productRevision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
        val productDigest = product.requireDigest("digest")
        val initiative = projection.get("initiative").requireObject()
        initiative.requireExactKeys("id", "revision", "digest", "state")
        val initiativeId = initiative.requireNonEmptyUuid("id")
        val initiativeRevision = initiative.requireLong("revision")
        if (initiativeId != expectedInitiativeId || initiativeRevision !in 1..MAX_SAFE_PRODUCT_REVISION) {
            throw invalidResponse()
        }
        val initiativeDigest = initiative.requireDigest("digest")
        val initiativeState = initiative.requireOneOf(
            "state",
            setOf("proposed", "active", "blocked", "completed", "cancelled"),
        )

        data class Reference(val id: UUID, val revision: Long, val digest: String)
        val status = projection.get("status").requireObject()
        status.requireKeys(
            setOf(
                "schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision",
                "entityCount", "attributeCount", "relationshipCount", "lifecycleCount", "transformationCount",
                "uncoveredBoundedContextCount", "uncoveredSecurityDataClassCount", "uncoveredProcessCount",
                "unresolvedSystemOfRecordCount", "unresolvedTransformationCount", "unresolvedRequirementCount",
                "inconsistencyCount", "unresolvedQuestionCount", "staleBindingCount", "staleSourceReferenceCount",
                "state", "reasons", "assessedAt", "authorityBoundary",
            ),
            setOf("model"),
        )
        if (status.requireInt("schemaVersion") != 1 ||
            status.requireString("kind") != "data-model-status" ||
            status.requireNonEmptyUuid("productId") != productId ||
            status.requireLong("productRevision") != productRevision ||
            status.requireNonEmptyUuid("initiativeId") != initiativeId ||
            status.requireLong("initiativeRevision") != initiativeRevision ||
            status.requireString("authorityBoundary") != DATA_MODEL_STATUS_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val reference = status.get("model")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys("recordId", "revision", "digest")
            val revision = value.requireLong("revision")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
            Reference(value.requireNonEmptyUuid("recordId"), revision, value.requireDigest("digest"))
        }
        val entityCount = status.requireBoundedNonNegativeInt("entityCount", 2_048)
        val attributeCount = status.requireBoundedNonNegativeInt("attributeCount", 131_072)
        val relationshipCount = status.requireBoundedNonNegativeInt("relationshipCount", 8_192)
        val lifecycleCount = status.requireBoundedNonNegativeInt("lifecycleCount", 2_048)
        val transformationCount = status.requireBoundedNonNegativeInt("transformationCount", 4_096)
        val uncoveredBoundedContextCount = status.requireBoundedNonNegativeInt("uncoveredBoundedContextCount", 2_048)
        val uncoveredSecurityDataClassCount = status.requireBoundedNonNegativeInt("uncoveredSecurityDataClassCount", 2_048)
        val uncoveredProcessCount = status.requireBoundedNonNegativeInt("uncoveredProcessCount", 512)
        val unresolvedSystemOfRecordCount = status.requireBoundedNonNegativeInt("unresolvedSystemOfRecordCount", 2_048)
        val unresolvedTransformationCount = status.requireBoundedNonNegativeInt("unresolvedTransformationCount", 4_096)
        val unresolvedRequirementCount = status.requireBoundedNonNegativeInt("unresolvedRequirementCount", 14)
        val inconsistencyCount = status.requireBoundedNonNegativeInt("inconsistencyCount", 512)
        val unresolvedQuestionCount = status.requireBoundedNonNegativeInt("unresolvedQuestionCount", 512)
        val staleBindingCount = status.requireBoundedNonNegativeInt("staleBindingCount", 16)
        val staleSourceReferenceCount = status.requireBoundedNonNegativeInt("staleSourceReferenceCount", 131_072)
        val assessmentState = status.requireOneOf("state", setOf("complete-for-review", "attention-required"))
        val reasonsElement = status.get("reasons")
        if (reasonsElement == null || !reasonsElement.isJsonArray || reasonsElement.asJsonArray.size() > 512) {
            throw invalidResponse()
        }
        val reasons = reasonsElement.asJsonArray.map { portableText(it.requireString(), 2, 2_000) }
        if ((assessmentState == "complete-for-review") != reasons.isEmpty()) throw invalidResponse()
        val assessedAt = status.requireInstant("assessedAt")

        val model = projection.get("model")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys(
                "id", "revision", "digest", "membershipDigest", "state", "entityCount", "relationshipCount",
                "lifecycleCount", "updatedAt",
            )
            val id = value.requireNonEmptyUuid("id")
            val revision = value.requireLong("revision")
            val digest = value.requireDigest("digest")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION ||
                value.requireString("state") != "candidate" ||
                reference?.let { it.id == id && it.revision == revision && it.digest == digest } != true
            ) throw invalidResponse()
            val record = DataModelRecordView(
                id,
                revision,
                digest,
                value.requireDigest("membershipDigest"),
                value.requireBoundedNonNegativeInt("entityCount", 2_048),
                value.requireBoundedNonNegativeInt("relationshipCount", 8_192),
                value.requireBoundedNonNegativeInt("lifecycleCount", 2_048),
            )
            value.requireInstant("updatedAt")
            record
        }
        if ((reference == null) != (model == null) ||
            (model?.entityCount ?: 0) != entityCount ||
            (model?.relationshipCount ?: 0) != relationshipCount ||
            (model?.lifecycleCount ?: 0) != lifecycleCount ||
            projection.requireInstant("observedAt") != assessedAt
        ) throw invalidResponse()
        return DataModelProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reasons, entityCount, attributeCount, relationshipCount,
            lifecycleCount, transformationCount, uncoveredBoundedContextCount, uncoveredSecurityDataClassCount,
            uncoveredProcessCount, unresolvedSystemOfRecordCount, unresolvedTransformationCount,
            unresolvedRequirementCount, inconsistencyCount, unresolvedQuestionCount, staleBindingCount,
            staleSourceReferenceCount, model, snapshotDigest,
        )
    }

    fun parseAuthorizationModelEnvelope(
        envelope: JsonObject,
        expectedInitiativeId: UUID,
    ): AuthorizationModelProjection {
        val projection = readResult(envelope).requireObject()
        projection.requireKeys(
            setOf(
                "schemaVersion", "kind", "product", "initiative", "status", "observedAt",
                "privacyBoundary", "authorityBoundary", "snapshotDigest",
            ),
            setOf("model"),
        )
        if (projection.requireInt("schemaVersion") != 1 ||
            projection.requireString("kind") != "authorization-model-projection" ||
            projection.requireString("privacyBoundary") != AUTHORIZATION_MODEL_PROJECTION_PRIVACY_BOUNDARY ||
            projection.requireString("authorityBoundary") != AUTHORIZATION_MODEL_PROJECTION_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val snapshotDigest = projection.requireDigest("snapshotDigest")
        val digestBody = projection.deepCopy().also { it.remove("snapshotDigest") }
        if (snapshotDigest != canonicalDigest(digestBody)) throw invalidResponse()

        val product = projection.get("product").requireObject()
        product.requireExactKeys("id", "revision", "digest")
        val productId = product.requireNonEmptyUuid("id")
        val productRevision = product.requireLong("revision")
        if (productRevision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
        val productDigest = product.requireDigest("digest")
        val initiative = projection.get("initiative").requireObject()
        initiative.requireExactKeys("id", "revision", "digest", "state")
        val initiativeId = initiative.requireNonEmptyUuid("id")
        val initiativeRevision = initiative.requireLong("revision")
        if (initiativeId != expectedInitiativeId || initiativeRevision !in 1..MAX_SAFE_PRODUCT_REVISION) {
            throw invalidResponse()
        }
        val initiativeDigest = initiative.requireDigest("digest")
        val initiativeState = initiative.requireOneOf(
            "state",
            setOf("proposed", "active", "blocked", "completed", "cancelled"),
        )

        data class Reference(val id: UUID, val revision: Long, val digest: String)
        val status = projection.get("status").requireObject()
        status.requireKeys(
            setOf(
                "schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision",
                "principalCount", "roleAssignmentCount", "resourceCount", "actionCount", "approvalBindingCount",
                "ruleCount", "uncoveredOperatingRoleCount", "uncoveredProcessCount", "uncoveredDataEntityCount",
                "unresolvedIdentityCount", "unresolvedRuleCount", "unresolvedRequirementCount", "inconsistencyCount",
                "unresolvedQuestionCount", "staleBindingCount", "staleSourceReferenceCount", "state", "reasons",
                "assessedAt", "authorityBoundary",
            ),
            setOf("model"),
        )
        if (status.requireInt("schemaVersion") != 1 ||
            status.requireString("kind") != "authorization-model-status" ||
            status.requireNonEmptyUuid("productId") != productId ||
            status.requireLong("productRevision") != productRevision ||
            status.requireNonEmptyUuid("initiativeId") != initiativeId ||
            status.requireLong("initiativeRevision") != initiativeRevision ||
            status.requireString("authorityBoundary") != AUTHORIZATION_MODEL_STATUS_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val reference = status.get("model")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys("recordId", "revision", "digest")
            val revision = value.requireLong("revision")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
            Reference(value.requireNonEmptyUuid("recordId"), revision, value.requireDigest("digest"))
        }
        val principalCount = status.requireBoundedNonNegativeInt("principalCount", 4_096)
        val roleAssignmentCount = status.requireBoundedNonNegativeInt("roleAssignmentCount", 8_192)
        val resourceCount = status.requireBoundedNonNegativeInt("resourceCount", 8_192)
        val actionCount = status.requireBoundedNonNegativeInt("actionCount", 4_096)
        val approvalBindingCount = status.requireBoundedNonNegativeInt("approvalBindingCount", 4_096)
        val ruleCount = status.requireBoundedNonNegativeInt("ruleCount", 16_384)
        val uncoveredOperatingRoleCount = status.requireBoundedNonNegativeInt("uncoveredOperatingRoleCount", 2_048)
        val uncoveredProcessCount = status.requireBoundedNonNegativeInt("uncoveredProcessCount", 512)
        val uncoveredDataEntityCount = status.requireBoundedNonNegativeInt("uncoveredDataEntityCount", 2_048)
        val unresolvedIdentityCount = status.requireBoundedNonNegativeInt("unresolvedIdentityCount", 4_096)
        val unresolvedRuleCount = status.requireBoundedNonNegativeInt("unresolvedRuleCount", 16_384)
        val unresolvedRequirementCount = status.requireBoundedNonNegativeInt("unresolvedRequirementCount", 28)
        val inconsistencyCount = status.requireBoundedNonNegativeInt("inconsistencyCount", 512)
        val unresolvedQuestionCount = status.requireBoundedNonNegativeInt("unresolvedQuestionCount", 512)
        val staleBindingCount = status.requireBoundedNonNegativeInt("staleBindingCount", 16)
        val staleSourceReferenceCount = status.requireBoundedNonNegativeInt("staleSourceReferenceCount", 131_072)
        val assessmentState = status.requireOneOf("state", setOf("complete-for-review", "attention-required"))
        val reasonsElement = status.get("reasons")
        if (reasonsElement == null || !reasonsElement.isJsonArray || reasonsElement.asJsonArray.size() > 512) {
            throw invalidResponse()
        }
        val reasons = reasonsElement.asJsonArray.map { portableText(it.requireString(), 2, 2_000) }
        if ((assessmentState == "complete-for-review") != reasons.isEmpty()) throw invalidResponse()
        val assessedAt = status.requireInstant("assessedAt")

        val model = projection.get("model")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys(
                "id", "revision", "digest", "membershipDigest", "state", "principalCount", "actionCount",
                "ruleCount", "updatedAt",
            )
            val id = value.requireNonEmptyUuid("id")
            val revision = value.requireLong("revision")
            val digest = value.requireDigest("digest")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION ||
                value.requireString("state") != "candidate" ||
                reference?.let { it.id == id && it.revision == revision && it.digest == digest } != true
            ) throw invalidResponse()
            val record = AuthorizationModelRecordView(
                id,
                revision,
                digest,
                value.requireDigest("membershipDigest"),
                value.requireBoundedNonNegativeInt("principalCount", 4_096),
                value.requireBoundedNonNegativeInt("actionCount", 4_096),
                value.requireBoundedNonNegativeInt("ruleCount", 16_384),
            )
            value.requireInstant("updatedAt")
            record
        }
        if ((reference == null) != (model == null) ||
            (model?.principalCount ?: 0) != principalCount ||
            (model?.actionCount ?: 0) != actionCount ||
            (model?.ruleCount ?: 0) != ruleCount ||
            projection.requireInstant("observedAt") != assessedAt
        ) throw invalidResponse()
        return AuthorizationModelProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reasons, principalCount, roleAssignmentCount, resourceCount,
            actionCount, approvalBindingCount, ruleCount, uncoveredOperatingRoleCount, uncoveredProcessCount,
            uncoveredDataEntityCount, unresolvedIdentityCount, unresolvedRuleCount, unresolvedRequirementCount,
            inconsistencyCount, unresolvedQuestionCount, staleBindingCount, staleSourceReferenceCount, model,
            snapshotDigest,
        )
    }

    fun parseEventIntegrationModelEnvelope(
        envelope: JsonObject,
        expectedInitiativeId: UUID,
    ): EventIntegrationModelProjection {
        val projection = readResult(envelope).requireObject()
        projection.requireKeys(
            setOf(
                "schemaVersion", "kind", "product", "initiative", "status", "observedAt",
                "privacyBoundary", "authorityBoundary", "snapshotDigest",
            ),
            setOf("model"),
        )
        if (projection.requireInt("schemaVersion") != 1 ||
            projection.requireString("kind") != "event-integration-model-projection" ||
            projection.requireString("privacyBoundary") != EVENT_INTEGRATION_MODEL_PROJECTION_PRIVACY_BOUNDARY ||
            projection.requireString("authorityBoundary") != EVENT_INTEGRATION_MODEL_PROJECTION_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val snapshotDigest = projection.requireDigest("snapshotDigest")
        val digestBody = projection.deepCopy().also { it.remove("snapshotDigest") }
        if (snapshotDigest != canonicalDigest(digestBody)) throw invalidResponse()

        val product = projection.get("product").requireObject()
        product.requireExactKeys("id", "revision", "digest")
        val productId = product.requireNonEmptyUuid("id")
        val productRevision = product.requireLong("revision")
        if (productRevision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
        val productDigest = product.requireDigest("digest")
        val initiative = projection.get("initiative").requireObject()
        initiative.requireExactKeys("id", "revision", "digest", "state")
        val initiativeId = initiative.requireNonEmptyUuid("id")
        val initiativeRevision = initiative.requireLong("revision")
        if (initiativeId != expectedInitiativeId || initiativeRevision !in 1..MAX_SAFE_PRODUCT_REVISION) {
            throw invalidResponse()
        }
        val initiativeDigest = initiative.requireDigest("digest")
        val initiativeState = initiative.requireOneOf(
            "state",
            setOf("proposed", "active", "blocked", "completed", "cancelled"),
        )

        data class Reference(val id: UUID, val revision: Long, val digest: String)
        val status = projection.get("status").requireObject()
        status.requireKeys(
            setOf(
                "schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision",
                "eventTypeCount", "commandCount", "adapterCount", "externalContractCount", "mappingCount", "routeCount",
                "uncoveredProcessEventCount", "uncoveredProcessCount", "uncoveredBoundedContextCount",
                "uncoveredDataEntityCount", "uncoveredAuthorizationActionCount", "unknownMappingTruthCount",
                "unresolvedRequirementCount", "inconsistencyCount", "unresolvedQuestionCount", "staleBindingCount",
                "staleSourceReferenceCount", "state", "reasons", "assessedAt", "authorityBoundary",
            ),
            setOf("model"),
        )
        if (status.requireInt("schemaVersion") != 1 ||
            status.requireString("kind") != "event-integration-model-status" ||
            status.requireNonEmptyUuid("productId") != productId ||
            status.requireLong("productRevision") != productRevision ||
            status.requireNonEmptyUuid("initiativeId") != initiativeId ||
            status.requireLong("initiativeRevision") != initiativeRevision ||
            status.requireString("authorityBoundary") != EVENT_INTEGRATION_MODEL_STATUS_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val reference = status.get("model")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys("recordId", "revision", "digest")
            val revision = value.requireLong("revision")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
            Reference(value.requireNonEmptyUuid("recordId"), revision, value.requireDigest("digest"))
        }
        val eventTypeCount = status.requireBoundedNonNegativeInt("eventTypeCount", 8_192)
        val commandCount = status.requireBoundedNonNegativeInt("commandCount", 8_192)
        val adapterCount = status.requireBoundedNonNegativeInt("adapterCount", 4_096)
        val externalContractCount = status.requireBoundedNonNegativeInt("externalContractCount", 8_192)
        val mappingCount = status.requireBoundedNonNegativeInt("mappingCount", 8_192)
        val routeCount = status.requireBoundedNonNegativeInt("routeCount", 8_192)
        val uncoveredProcessEventCount = status.requireBoundedNonNegativeInt("uncoveredProcessEventCount", 65_536)
        val uncoveredProcessCount = status.requireBoundedNonNegativeInt("uncoveredProcessCount", 512)
        val uncoveredBoundedContextCount = status.requireBoundedNonNegativeInt("uncoveredBoundedContextCount", 2_048)
        val uncoveredDataEntityCount = status.requireBoundedNonNegativeInt("uncoveredDataEntityCount", 2_048)
        val uncoveredAuthorizationActionCount = status.requireBoundedNonNegativeInt("uncoveredAuthorizationActionCount", 4_096)
        val unknownMappingTruthCount = status.requireBoundedNonNegativeInt("unknownMappingTruthCount", 131_072)
        val unresolvedRequirementCount = status.requireBoundedNonNegativeInt("unresolvedRequirementCount", 71)
        val inconsistencyCount = status.requireBoundedNonNegativeInt("inconsistencyCount", 512)
        val unresolvedQuestionCount = status.requireBoundedNonNegativeInt("unresolvedQuestionCount", 512)
        val staleBindingCount = status.requireBoundedNonNegativeInt("staleBindingCount", 131_072)
        val staleSourceReferenceCount = status.requireBoundedNonNegativeInt("staleSourceReferenceCount", 131_072)
        val assessmentState = status.requireOneOf("state", setOf("complete-for-review", "attention-required"))
        val reasonsElement = status.get("reasons")
        if (reasonsElement == null || !reasonsElement.isJsonArray || reasonsElement.asJsonArray.size() > 512) {
            throw invalidResponse()
        }
        val reasons = reasonsElement.asJsonArray.map { portableText(it.requireString(), 2, 2_000) }
        if ((assessmentState == "complete-for-review") != reasons.isEmpty()) throw invalidResponse()
        val assessedAt = status.requireInstant("assessedAt")

        val model = projection.get("model")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys(
                "id", "revision", "digest", "membershipDigest", "state", "eventTypeCount", "commandCount",
                "adapterCount", "externalContractCount", "mappingCount", "routeCount", "updatedAt",
            )
            val id = value.requireNonEmptyUuid("id")
            val revision = value.requireLong("revision")
            val digest = value.requireDigest("digest")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION ||
                value.requireString("state") != "candidate" ||
                reference?.let { it.id == id && it.revision == revision && it.digest == digest } != true
            ) throw invalidResponse()
            val record = EventIntegrationModelRecordView(
                id,
                revision,
                digest,
                value.requireDigest("membershipDigest"),
                value.requireBoundedNonNegativeInt("eventTypeCount", 8_192),
                value.requireBoundedNonNegativeInt("commandCount", 8_192),
                value.requireBoundedNonNegativeInt("adapterCount", 4_096),
                value.requireBoundedNonNegativeInt("externalContractCount", 8_192),
                value.requireBoundedNonNegativeInt("mappingCount", 8_192),
                value.requireBoundedNonNegativeInt("routeCount", 8_192),
            )
            value.requireInstant("updatedAt")
            record
        }
        if ((reference == null) != (model == null) ||
            (model?.eventTypeCount ?: 0) != eventTypeCount ||
            (model?.commandCount ?: 0) != commandCount ||
            (model?.adapterCount ?: 0) != adapterCount ||
            (model?.externalContractCount ?: 0) != externalContractCount ||
            (model?.mappingCount ?: 0) != mappingCount ||
            (model?.routeCount ?: 0) != routeCount ||
            projection.requireInstant("observedAt") != assessedAt
        ) throw invalidResponse()
        return EventIntegrationModelProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reasons, eventTypeCount, commandCount, adapterCount,
            externalContractCount, mappingCount, routeCount, uncoveredProcessEventCount, uncoveredProcessCount,
            uncoveredBoundedContextCount, uncoveredDataEntityCount, uncoveredAuthorizationActionCount,
            unknownMappingTruthCount, unresolvedRequirementCount, inconsistencyCount, unresolvedQuestionCount,
            staleBindingCount, staleSourceReferenceCount, model, snapshotDigest,
        )
    }

    fun parseFailureRecoveryModelEnvelope(
        envelope: JsonObject,
        expectedInitiativeId: UUID,
    ): FailureRecoveryModelProjection {
        val projection = readResult(envelope).requireObject()
        projection.requireKeys(
            setOf(
                "schemaVersion", "kind", "product", "initiative", "status", "observedAt",
                "privacyBoundary", "authorityBoundary", "snapshotDigest",
            ),
            setOf("model"),
        )
        if (projection.requireInt("schemaVersion") != 1 ||
            projection.requireString("kind") != "failure-recovery-model-projection" ||
            projection.requireString("privacyBoundary") != FAILURE_RECOVERY_MODEL_PROJECTION_PRIVACY_BOUNDARY ||
            projection.requireString("authorityBoundary") != FAILURE_RECOVERY_MODEL_PROJECTION_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val snapshotDigest = projection.requireDigest("snapshotDigest")
        val digestBody = projection.deepCopy().also { it.remove("snapshotDigest") }
        if (snapshotDigest != canonicalDigest(digestBody)) throw invalidResponse()

        val product = projection.get("product").requireObject()
        product.requireExactKeys("id", "revision", "digest")
        val productId = product.requireNonEmptyUuid("id")
        val productRevision = product.requireLong("revision")
        if (productRevision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
        val productDigest = product.requireDigest("digest")
        val initiative = projection.get("initiative").requireObject()
        initiative.requireExactKeys("id", "revision", "digest", "state")
        val initiativeId = initiative.requireNonEmptyUuid("id")
        val initiativeRevision = initiative.requireLong("revision")
        if (initiativeId != expectedInitiativeId || initiativeRevision !in 1..MAX_SAFE_PRODUCT_REVISION) {
            throw invalidResponse()
        }
        val initiativeDigest = initiative.requireDigest("digest")
        val initiativeState = initiative.requireOneOf(
            "state",
            setOf("proposed", "active", "blocked", "completed", "cancelled"),
        )

        data class Reference(val id: UUID, val revision: Long, val digest: String)
        val status = projection.get("status").requireObject()
        status.requireKeys(
            setOf(
                "schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision",
                "failureModeCount", "retryPolicyCount", "compensationPlanCount", "recoveryPlanCount",
                "recoveryEvidenceDefinitionCount", "uncoveredProcessCount", "uncoveredCommandCount",
                "uncoveredRouteCount", "uncoveredAuthorizationActionCount", "unresolvedRecoveryEvidenceCount",
                "unresolvedRequirementCount", "inconsistencyCount", "unresolvedQuestionCount", "staleBindingCount",
                "staleSourceReferenceCount", "state", "reasons", "assessedAt", "authorityBoundary",
            ),
            setOf("model"),
        )
        if (status.requireInt("schemaVersion") != 1 ||
            status.requireString("kind") != "failure-recovery-model-status" ||
            status.requireNonEmptyUuid("productId") != productId ||
            status.requireLong("productRevision") != productRevision ||
            status.requireNonEmptyUuid("initiativeId") != initiativeId ||
            status.requireLong("initiativeRevision") != initiativeRevision ||
            status.requireString("authorityBoundary") != FAILURE_RECOVERY_MODEL_STATUS_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val reference = status.get("model")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys("recordId", "revision", "digest")
            val revision = value.requireLong("revision")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
            Reference(value.requireNonEmptyUuid("recordId"), revision, value.requireDigest("digest"))
        }
        val failureModeCount = status.requireBoundedNonNegativeInt("failureModeCount", 8_192)
        val retryPolicyCount = status.requireBoundedNonNegativeInt("retryPolicyCount", 8_192)
        val compensationPlanCount = status.requireBoundedNonNegativeInt("compensationPlanCount", 8_192)
        val recoveryPlanCount = status.requireBoundedNonNegativeInt("recoveryPlanCount", 8_192)
        val recoveryEvidenceDefinitionCount = status.requireBoundedNonNegativeInt("recoveryEvidenceDefinitionCount", 8_192)
        val uncoveredProcessCount = status.requireBoundedNonNegativeInt("uncoveredProcessCount", 512)
        val uncoveredCommandCount = status.requireBoundedNonNegativeInt("uncoveredCommandCount", 8_192)
        val uncoveredRouteCount = status.requireBoundedNonNegativeInt("uncoveredRouteCount", 8_192)
        val uncoveredAuthorizationActionCount = status.requireBoundedNonNegativeInt("uncoveredAuthorizationActionCount", 4_096)
        val unresolvedRecoveryEvidenceCount = status.requireBoundedNonNegativeInt("unresolvedRecoveryEvidenceCount", 8_192)
        val unresolvedRequirementCount = status.requireBoundedNonNegativeInt("unresolvedRequirementCount", 47)
        val inconsistencyCount = status.requireBoundedNonNegativeInt("inconsistencyCount", 512)
        val unresolvedQuestionCount = status.requireBoundedNonNegativeInt("unresolvedQuestionCount", 512)
        val staleBindingCount = status.requireBoundedNonNegativeInt("staleBindingCount", 131_072)
        val staleSourceReferenceCount = status.requireBoundedNonNegativeInt("staleSourceReferenceCount", 131_072)
        val assessmentState = status.requireOneOf("state", setOf("complete-for-review", "attention-required"))
        val reasonsElement = status.get("reasons")
        if (reasonsElement == null || !reasonsElement.isJsonArray || reasonsElement.asJsonArray.size() > 512) {
            throw invalidResponse()
        }
        val reasons = reasonsElement.asJsonArray.map { portableText(it.requireString(), 2, 2_000) }
        if ((assessmentState == "complete-for-review") != reasons.isEmpty()) throw invalidResponse()
        val assessedAt = status.requireInstant("assessedAt")

        val model = projection.get("model")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys(
                "id", "revision", "digest", "membershipDigest", "state", "failureModeCount", "retryPolicyCount",
                "compensationPlanCount", "recoveryPlanCount", "recoveryEvidenceDefinitionCount", "updatedAt",
            )
            val id = value.requireNonEmptyUuid("id")
            val revision = value.requireLong("revision")
            val digest = value.requireDigest("digest")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION ||
                value.requireString("state") != "candidate" ||
                reference?.let { it.id == id && it.revision == revision && it.digest == digest } != true
            ) throw invalidResponse()
            val record = FailureRecoveryModelRecordView(
                id,
                revision,
                digest,
                value.requireDigest("membershipDigest"),
                value.requireBoundedNonNegativeInt("failureModeCount", 8_192),
                value.requireBoundedNonNegativeInt("retryPolicyCount", 8_192),
                value.requireBoundedNonNegativeInt("compensationPlanCount", 8_192),
                value.requireBoundedNonNegativeInt("recoveryPlanCount", 8_192),
                value.requireBoundedNonNegativeInt("recoveryEvidenceDefinitionCount", 8_192),
            )
            value.requireInstant("updatedAt")
            record
        }
        if ((reference == null) != (model == null) ||
            (model?.failureModeCount ?: 0) != failureModeCount ||
            (model?.retryPolicyCount ?: 0) != retryPolicyCount ||
            (model?.compensationPlanCount ?: 0) != compensationPlanCount ||
            (model?.recoveryPlanCount ?: 0) != recoveryPlanCount ||
            (model?.recoveryEvidenceDefinitionCount ?: 0) != recoveryEvidenceDefinitionCount ||
            projection.requireInstant("observedAt") != assessedAt
        ) throw invalidResponse()
        return FailureRecoveryModelProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reasons, failureModeCount, retryPolicyCount, compensationPlanCount,
            recoveryPlanCount, recoveryEvidenceDefinitionCount, uncoveredProcessCount, uncoveredCommandCount,
            uncoveredRouteCount, uncoveredAuthorizationActionCount, unresolvedRecoveryEvidenceCount,
            unresolvedRequirementCount, inconsistencyCount, unresolvedQuestionCount, staleBindingCount,
            staleSourceReferenceCount, model, snapshotDigest,
        )
    }

    fun parseArchitectureChallengeModelEnvelope(
        envelope: JsonObject,
        expectedInitiativeId: UUID,
    ): ArchitectureChallengeModelProjection {
        val projection = readResult(envelope).requireObject()
        projection.requireKeys(
            setOf(
                "schemaVersion", "kind", "product", "initiative", "status", "observedAt",
                "privacyBoundary", "authorityBoundary", "snapshotDigest",
            ),
            setOf("model"),
        )
        if (projection.requireInt("schemaVersion") != 1 ||
            projection.requireString("kind") != "architecture-challenge-model-projection" ||
            projection.requireString("privacyBoundary") != ARCHITECTURE_CHALLENGE_PROJECTION_PRIVACY_BOUNDARY ||
            projection.requireString("authorityBoundary") != ARCHITECTURE_CHALLENGE_PROJECTION_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val snapshotDigest = projection.requireDigest("snapshotDigest")
        val digestBody = projection.deepCopy().also { it.remove("snapshotDigest") }
        if (snapshotDigest != canonicalDigest(digestBody)) throw invalidResponse()

        val product = projection.get("product").requireObject()
        product.requireExactKeys("id", "revision", "digest")
        val productId = product.requireNonEmptyUuid("id")
        val productRevision = product.requireLong("revision")
        if (productRevision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
        val productDigest = product.requireDigest("digest")
        val initiative = projection.get("initiative").requireObject()
        initiative.requireExactKeys("id", "revision", "digest", "state")
        val initiativeId = initiative.requireNonEmptyUuid("id")
        val initiativeRevision = initiative.requireLong("revision")
        if (initiativeId != expectedInitiativeId || initiativeRevision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
        val initiativeDigest = initiative.requireDigest("digest")
        val initiativeState = initiative.requireOneOf("state", setOf("proposed", "active", "blocked", "completed", "cancelled"))

        data class Reference(val id: UUID, val revision: Long, val digest: String)
        val status = projection.get("status").requireObject()
        status.requireKeys(
            setOf(
                "schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision",
                "challengeSubjectCount", "assumptionCount", "alternativeCount", "findingCount", "responseCount",
                "unrespondedFindingCount", "unresolvedAssumptionCount", "unresolvedRequirementCount",
                "inconsistencyCount", "unresolvedQuestionCount", "staleBindingCount", "staleSourceReferenceCount",
                "state", "reasons", "assessedAt", "authorityBoundary",
            ),
            setOf("model"),
        )
        if (status.requireInt("schemaVersion") != 1 ||
            status.requireString("kind") != "architecture-challenge-model-status" ||
            status.requireNonEmptyUuid("productId") != productId ||
            status.requireLong("productRevision") != productRevision ||
            status.requireNonEmptyUuid("initiativeId") != initiativeId ||
            status.requireLong("initiativeRevision") != initiativeRevision ||
            status.requireString("authorityBoundary") != ARCHITECTURE_CHALLENGE_STATUS_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val reference = status.get("model")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys("recordId", "revision", "digest")
            val revision = value.requireLong("revision")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
            Reference(value.requireNonEmptyUuid("recordId"), revision, value.requireDigest("digest"))
        }
        val challengeSubjectCount = status.requireBoundedNonNegativeInt("challengeSubjectCount", 4_096)
        val assumptionCount = status.requireBoundedNonNegativeInt("assumptionCount", 4_096)
        val alternativeCount = status.requireBoundedNonNegativeInt("alternativeCount", 4_096)
        val findingCount = status.requireBoundedNonNegativeInt("findingCount", 8_192)
        val responseCount = status.requireBoundedNonNegativeInt("responseCount", 8_192)
        val unrespondedFindingCount = status.requireBoundedNonNegativeInt("unrespondedFindingCount", 8_192)
        val unresolvedAssumptionCount = status.requireBoundedNonNegativeInt("unresolvedAssumptionCount", 4_096)
        val unresolvedRequirementCount = status.requireBoundedNonNegativeInt("unresolvedRequirementCount", 36)
        val inconsistencyCount = status.requireBoundedNonNegativeInt("inconsistencyCount", 512)
        val unresolvedQuestionCount = status.requireBoundedNonNegativeInt("unresolvedQuestionCount", 512)
        val staleBindingCount = status.requireBoundedNonNegativeInt("staleBindingCount", 131_072)
        val staleSourceReferenceCount = status.requireBoundedNonNegativeInt("staleSourceReferenceCount", 131_072)
        val assessmentState = status.requireOneOf("state", setOf("complete-for-review", "attention-required"))
        val reasonsElement = status.get("reasons")
        if (reasonsElement == null || !reasonsElement.isJsonArray || reasonsElement.asJsonArray.size() > 512) throw invalidResponse()
        val reasons = reasonsElement.asJsonArray.map { portableText(it.requireString(), 2, 2_000) }
        if ((assessmentState == "complete-for-review") != reasons.isEmpty()) throw invalidResponse()
        val assessedAt = status.requireInstant("assessedAt")

        val model = projection.get("model")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys(
                "id", "revision", "digest", "membershipDigest", "state", "challengeSubjectCount",
                "assumptionCount", "alternativeCount", "findingCount", "responseCount", "updatedAt",
            )
            val id = value.requireNonEmptyUuid("id")
            val revision = value.requireLong("revision")
            val record = ArchitectureChallengeModelRecordView(
                id, revision, value.requireDigest("digest"), value.requireDigest("membershipDigest"),
                value.requireBoundedNonNegativeInt("challengeSubjectCount", 4_096),
                value.requireBoundedNonNegativeInt("assumptionCount", 4_096),
                value.requireBoundedNonNegativeInt("alternativeCount", 4_096),
                value.requireBoundedNonNegativeInt("findingCount", 8_192),
                value.requireBoundedNonNegativeInt("responseCount", 8_192),
            )
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION || value.requireString("state") != "candidate" ||
                reference == null || reference.id != id || reference.revision != revision || reference.digest != record.digest
            ) throw invalidResponse()
            value.requireInstant("updatedAt")
            record
        }
        if ((reference == null) != (model == null) ||
            (model?.challengeSubjectCount ?: 0) != challengeSubjectCount ||
            (model?.assumptionCount ?: 0) != assumptionCount ||
            (model?.alternativeCount ?: 0) != alternativeCount ||
            (model?.findingCount ?: 0) != findingCount ||
            (model?.responseCount ?: 0) != responseCount ||
            projection.requireInstant("observedAt") != assessedAt
        ) throw invalidResponse()
        return ArchitectureChallengeModelProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reasons, challengeSubjectCount, assumptionCount, alternativeCount,
            findingCount, responseCount, unrespondedFindingCount, unresolvedAssumptionCount,
            unresolvedRequirementCount, inconsistencyCount, unresolvedQuestionCount, staleBindingCount,
            staleSourceReferenceCount, model, snapshotDigest,
        )
    }

    fun parseDecisionRegisterEnvelope(
        envelope: JsonObject,
        expectedInitiativeId: UUID,
    ): DecisionRegisterProjection {
        val projection = readResult(envelope).requireObject()
        projection.requireKeys(
            setOf(
                "schemaVersion", "kind", "product", "initiative", "status", "observedAt",
                "privacyBoundary", "authorityBoundary", "snapshotDigest",
            ),
            setOf("register"),
        )
        if (projection.requireInt("schemaVersion") != 1 ||
            projection.requireString("kind") != "decision-register-projection" ||
            projection.requireString("privacyBoundary") != DECISION_REGISTER_PROJECTION_PRIVACY_BOUNDARY ||
            projection.requireString("authorityBoundary") != DECISION_REGISTER_PROJECTION_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val snapshotDigest = projection.requireDigest("snapshotDigest")
        val digestBody = projection.deepCopy().also { it.remove("snapshotDigest") }
        if (snapshotDigest != canonicalDigest(digestBody)) throw invalidResponse()

        val product = projection.get("product").requireObject()
        product.requireExactKeys("id", "revision", "digest")
        val productId = product.requireNonEmptyUuid("id")
        val productRevision = product.requireLong("revision")
        if (productRevision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
        val productDigest = product.requireDigest("digest")
        val initiative = projection.get("initiative").requireObject()
        initiative.requireExactKeys("id", "revision", "digest", "state")
        val initiativeId = initiative.requireNonEmptyUuid("id")
        val initiativeRevision = initiative.requireLong("revision")
        if (initiativeId != expectedInitiativeId || initiativeRevision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
        val initiativeDigest = initiative.requireDigest("digest")
        val initiativeState = initiative.requireOneOf("state", setOf("proposed", "active", "blocked", "completed", "cancelled"))

        data class Reference(val id: UUID, val revision: Long, val digest: String)
        val status = projection.get("status").requireObject()
        status.requireKeys(
            setOf(
                "schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision",
                "decisionCount", "unresolvedDecisionCount", "selectedPendingDecisionCount", "deferredDecisionCount",
                "unresolvedRequirementCount", "staleBindingCount", "staleSourceReferenceCount", "inconsistencyCount",
                "unresolvedQuestionCount", "state", "reasons", "assessedAt", "authorityBoundary",
            ),
            setOf("register"),
        )
        if (status.requireInt("schemaVersion") != 1 ||
            status.requireString("kind") != "decision-register-status" ||
            status.requireNonEmptyUuid("productId") != productId ||
            status.requireLong("productRevision") != productRevision ||
            status.requireNonEmptyUuid("initiativeId") != initiativeId ||
            status.requireLong("initiativeRevision") != initiativeRevision ||
            status.requireString("authorityBoundary") != DECISION_REGISTER_STATUS_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val reference = status.get("register")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys("recordId", "revision", "digest")
            val revision = value.requireLong("revision")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
            Reference(value.requireNonEmptyUuid("recordId"), revision, value.requireDigest("digest"))
        }
        val decisionCount = status.requireBoundedNonNegativeInt("decisionCount", 4_096)
        val unresolvedDecisionCount = status.requireBoundedNonNegativeInt("unresolvedDecisionCount", 4_096)
        val selectedPendingDecisionCount = status.requireBoundedNonNegativeInt("selectedPendingDecisionCount", 4_096)
        val deferredDecisionCount = status.requireBoundedNonNegativeInt("deferredDecisionCount", 4_096)
        if (unresolvedDecisionCount + selectedPendingDecisionCount + deferredDecisionCount > decisionCount) throw invalidResponse()
        val unresolvedRequirementCount = status.requireBoundedNonNegativeInt("unresolvedRequirementCount", 12)
        val staleBindingCount = status.requireBoundedNonNegativeInt("staleBindingCount", 131_072)
        val staleSourceReferenceCount = status.requireBoundedNonNegativeInt("staleSourceReferenceCount", 131_072)
        val inconsistencyCount = status.requireBoundedNonNegativeInt("inconsistencyCount", 512)
        val unresolvedQuestionCount = status.requireBoundedNonNegativeInt("unresolvedQuestionCount", 512)
        val assessmentState = status.requireOneOf("state", setOf("complete-for-review", "attention-required"))
        val reasonsElement = status.get("reasons")
        if (reasonsElement == null || !reasonsElement.isJsonArray || reasonsElement.asJsonArray.size() > 512) throw invalidResponse()
        val reasons = reasonsElement.asJsonArray.map { portableText(it.requireString(), 2, 2_000) }
        if ((assessmentState == "complete-for-review") != reasons.isEmpty()) throw invalidResponse()
        val assessedAt = status.requireInstant("assessedAt")

        val register = projection.get("register")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys(
                "id", "revision", "digest", "membershipDigest", "state", "decisionCount", "updatedAt",
            )
            val id = value.requireNonEmptyUuid("id")
            val revision = value.requireLong("revision")
            val record = DecisionRegisterRecordView(
                id,
                revision,
                value.requireDigest("digest"),
                value.requireDigest("membershipDigest"),
                value.requireBoundedNonNegativeInt("decisionCount", 4_096),
            )
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION || value.requireString("state") != "candidate" ||
                reference == null || reference.id != id || reference.revision != revision || reference.digest != record.digest
            ) throw invalidResponse()
            value.requireInstant("updatedAt")
            record
        }
        if ((reference == null) != (register == null) ||
            (register?.decisionCount ?: 0) != decisionCount ||
            projection.requireInstant("observedAt") != assessedAt
        ) throw invalidResponse()
        return DecisionRegisterProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reasons, decisionCount, unresolvedDecisionCount,
            selectedPendingDecisionCount, deferredDecisionCount, unresolvedRequirementCount, inconsistencyCount,
            unresolvedQuestionCount, staleBindingCount, staleSourceReferenceCount, register, snapshotDigest,
        )
    }

    fun parseRiskRegisterEnvelope(
        envelope: JsonObject,
        expectedInitiativeId: UUID,
    ): RiskRegisterProjection {
        val projection = readResult(envelope).requireObject()
        projection.requireKeys(
            setOf(
                "schemaVersion", "kind", "product", "initiative", "status", "observedAt",
                "privacyBoundary", "authorityBoundary", "snapshotDigest",
            ),
            setOf("register"),
        )
        if (projection.requireInt("schemaVersion") != 1 ||
            projection.requireString("kind") != "risk-register-projection" ||
            projection.requireString("privacyBoundary") != RISK_REGISTER_PROJECTION_PRIVACY_BOUNDARY ||
            projection.requireString("authorityBoundary") != RISK_REGISTER_PROJECTION_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val snapshotDigest = projection.requireDigest("snapshotDigest")
        val digestBody = projection.deepCopy().also { it.remove("snapshotDigest") }
        if (snapshotDigest != canonicalDigest(digestBody)) throw invalidResponse()

        val product = projection.get("product").requireObject()
        product.requireExactKeys("id", "revision", "digest")
        val productId = product.requireNonEmptyUuid("id")
        val productRevision = product.requireLong("revision")
        if (productRevision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
        val productDigest = product.requireDigest("digest")
        val initiative = projection.get("initiative").requireObject()
        initiative.requireExactKeys("id", "revision", "digest", "state")
        val initiativeId = initiative.requireNonEmptyUuid("id")
        val initiativeRevision = initiative.requireLong("revision")
        if (initiativeId != expectedInitiativeId || initiativeRevision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
        val initiativeDigest = initiative.requireDigest("digest")
        val initiativeState = initiative.requireOneOf("state", setOf("proposed", "active", "blocked", "completed", "cancelled"))

        data class Reference(val id: UUID, val revision: Long, val digest: String)
        val status = projection.get("status").requireObject()
        status.requireKeys(
            setOf(
                "schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision",
                "riskCount", "notAssessedRiskCount", "unresolvedResidualRiskCount", "proposedTreatmentCount",
                "unassignedOwnerCount", "unverifiedControlCount", "unresolvedRequirementCount", "staleBindingCount",
                "staleSourceReferenceCount", "inconsistencyCount", "unresolvedQuestionCount", "state", "reasons",
                "assessedAt", "authorityBoundary",
            ),
            setOf("register"),
        )
        if (status.requireInt("schemaVersion") != 1 ||
            status.requireString("kind") != "risk-register-status" ||
            status.requireNonEmptyUuid("productId") != productId ||
            status.requireLong("productRevision") != productRevision ||
            status.requireNonEmptyUuid("initiativeId") != initiativeId ||
            status.requireLong("initiativeRevision") != initiativeRevision ||
            status.requireString("authorityBoundary") != RISK_REGISTER_STATUS_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val reference = status.get("register")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys("recordId", "revision", "digest")
            val revision = value.requireLong("revision")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
            Reference(value.requireNonEmptyUuid("recordId"), revision, value.requireDigest("digest"))
        }
        val riskCount = status.requireBoundedNonNegativeInt("riskCount", 4_096)
        val notAssessedRiskCount = status.requireBoundedNonNegativeInt("notAssessedRiskCount", 4_096)
        val unresolvedResidualRiskCount = status.requireBoundedNonNegativeInt("unresolvedResidualRiskCount", 4_096)
        val proposedTreatmentCount = status.requireBoundedNonNegativeInt("proposedTreatmentCount", 4_096)
        val unassignedOwnerCount = status.requireBoundedNonNegativeInt("unassignedOwnerCount", 4_096)
        if (listOf(notAssessedRiskCount, unresolvedResidualRiskCount, proposedTreatmentCount, unassignedOwnerCount)
                .any { it > riskCount }
        ) throw invalidResponse()
        val unverifiedControlCount = status.requireBoundedNonNegativeInt("unverifiedControlCount", 2_097_152)
        val unresolvedRequirementCount = status.requireBoundedNonNegativeInt("unresolvedRequirementCount", 15)
        val staleBindingCount = status.requireBoundedNonNegativeInt("staleBindingCount", 131_072)
        val staleSourceReferenceCount = status.requireBoundedNonNegativeInt("staleSourceReferenceCount", 131_072)
        val inconsistencyCount = status.requireBoundedNonNegativeInt("inconsistencyCount", 512)
        val unresolvedQuestionCount = status.requireBoundedNonNegativeInt("unresolvedQuestionCount", 512)
        val assessmentState = status.requireOneOf("state", setOf("complete-for-review", "attention-required"))
        val reasonsElement = status.get("reasons")
        if (reasonsElement == null || !reasonsElement.isJsonArray || reasonsElement.asJsonArray.size() > 512) throw invalidResponse()
        val reasons = reasonsElement.asJsonArray.map { portableText(it.requireString(), 2, 2_000) }
        if ((assessmentState == "complete-for-review") != reasons.isEmpty()) throw invalidResponse()
        val assessedAt = status.requireInstant("assessedAt")

        val register = projection.get("register")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys("id", "revision", "digest", "membershipDigest", "state", "riskCount", "updatedAt")
            val id = value.requireNonEmptyUuid("id")
            val revision = value.requireLong("revision")
            val record = RiskRegisterRecordView(
                id,
                revision,
                value.requireDigest("digest"),
                value.requireDigest("membershipDigest"),
                value.requireBoundedNonNegativeInt("riskCount", 4_096),
            )
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION || value.requireString("state") != "candidate" ||
                reference == null || reference.id != id || reference.revision != revision || reference.digest != record.digest
            ) throw invalidResponse()
            value.requireInstant("updatedAt")
            record
        }
        if ((reference == null) != (register == null) ||
            (register?.riskCount ?: 0) != riskCount ||
            projection.requireInstant("observedAt") != assessedAt
        ) throw invalidResponse()
        return RiskRegisterProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reasons, riskCount, notAssessedRiskCount,
            unresolvedResidualRiskCount, proposedTreatmentCount, unassignedOwnerCount, unverifiedControlCount,
            unresolvedRequirementCount, inconsistencyCount, unresolvedQuestionCount, staleBindingCount,
            staleSourceReferenceCount, register, snapshotDigest,
        )
    }

    fun parseEvidenceRegistryEnvelope(
        envelope: JsonObject,
        expectedInitiativeId: UUID,
    ): EvidenceRegistryProjection {
        val projection = readResult(envelope).requireObject()
        projection.requireKeys(
            setOf(
                "schemaVersion", "kind", "product", "initiative", "status", "observedAt",
                "privacyBoundary", "authorityBoundary", "snapshotDigest",
            ),
            setOf("registry"),
        )
        if (projection.requireInt("schemaVersion") != 1 ||
            projection.requireString("kind") != "evidence-registry-projection" ||
            projection.requireString("privacyBoundary") != EVIDENCE_REGISTRY_PROJECTION_PRIVACY_BOUNDARY ||
            projection.requireString("authorityBoundary") != EVIDENCE_REGISTRY_PROJECTION_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val snapshotDigest = projection.requireDigest("snapshotDigest")
        val digestBody = projection.deepCopy().also { it.remove("snapshotDigest") }
        if (snapshotDigest != canonicalDigest(digestBody)) throw invalidResponse()

        val product = projection.get("product").requireObject()
        product.requireExactKeys("id", "revision", "digest")
        val productId = product.requireNonEmptyUuid("id")
        val productRevision = product.requireLong("revision")
        if (productRevision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
        val productDigest = product.requireDigest("digest")
        val initiative = projection.get("initiative").requireObject()
        initiative.requireExactKeys("id", "revision", "digest", "state")
        val initiativeId = initiative.requireNonEmptyUuid("id")
        val initiativeRevision = initiative.requireLong("revision")
        if (initiativeId != expectedInitiativeId || initiativeRevision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
        val initiativeDigest = initiative.requireDigest("digest")
        val initiativeState = initiative.requireOneOf("state", setOf("proposed", "active", "blocked", "completed", "cancelled"))

        data class Reference(val id: UUID, val revision: Long, val digest: String)
        val status = projection.get("status").requireObject()
        status.requireKeys(
            setOf(
                "schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision",
                "claimCount", "evidenceItemCount", "linkCount", "notAssessedClaimCount", "notAssessedEvidenceCount",
                "adverseEvidencePendingDispositionCount", "staleOrUnknownEvidenceCount", "invalidatedEvidenceCount",
                "unresolvedLinkCount", "unresolvedRequirementCount", "staleBindingCount", "staleSourceReferenceCount",
                "inconsistencyCount", "unresolvedQuestionCount", "state", "reasons", "assessedAt", "authorityBoundary",
            ),
            setOf("registry"),
        )
        if (status.requireInt("schemaVersion") != 1 ||
            status.requireString("kind") != "evidence-registry-status" ||
            status.requireNonEmptyUuid("productId") != productId ||
            status.requireLong("productRevision") != productRevision ||
            status.requireNonEmptyUuid("initiativeId") != initiativeId ||
            status.requireLong("initiativeRevision") != initiativeRevision ||
            status.requireString("authorityBoundary") != EVIDENCE_REGISTRY_STATUS_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val reference = status.get("registry")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys("recordId", "revision", "digest")
            val revision = value.requireLong("revision")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
            Reference(value.requireNonEmptyUuid("recordId"), revision, value.requireDigest("digest"))
        }
        val claimCount = status.requireBoundedNonNegativeInt("claimCount", 4_096)
        val evidenceItemCount = status.requireBoundedNonNegativeInt("evidenceItemCount", 8_192)
        val linkCount = status.requireBoundedNonNegativeInt("linkCount", 32_768)
        val notAssessedClaimCount = status.requireBoundedNonNegativeInt("notAssessedClaimCount", 4_096)
        val notAssessedEvidenceCount = status.requireBoundedNonNegativeInt("notAssessedEvidenceCount", 8_192)
        val adverseEvidencePendingDispositionCount = status.requireBoundedNonNegativeInt("adverseEvidencePendingDispositionCount", 8_192)
        val staleOrUnknownEvidenceCount = status.requireBoundedNonNegativeInt("staleOrUnknownEvidenceCount", 8_192)
        val invalidatedEvidenceCount = status.requireBoundedNonNegativeInt("invalidatedEvidenceCount", 8_192)
        val unresolvedLinkCount = status.requireBoundedNonNegativeInt("unresolvedLinkCount", 32_768)
        if (notAssessedClaimCount > claimCount ||
            listOf(notAssessedEvidenceCount, adverseEvidencePendingDispositionCount, staleOrUnknownEvidenceCount, invalidatedEvidenceCount)
                .any { it > evidenceItemCount } || unresolvedLinkCount > linkCount
        ) throw invalidResponse()
        val unresolvedRequirementCount = status.requireBoundedNonNegativeInt("unresolvedRequirementCount", 23)
        val staleBindingCount = status.requireBoundedNonNegativeInt("staleBindingCount", 131_072)
        val staleSourceReferenceCount = status.requireBoundedNonNegativeInt("staleSourceReferenceCount", 131_072)
        val inconsistencyCount = status.requireBoundedNonNegativeInt("inconsistencyCount", 512)
        val unresolvedQuestionCount = status.requireBoundedNonNegativeInt("unresolvedQuestionCount", 512)
        val assessmentState = status.requireOneOf("state", setOf("complete-for-review", "attention-required"))
        val reasonsElement = status.get("reasons")
        if (reasonsElement == null || !reasonsElement.isJsonArray || reasonsElement.asJsonArray.size() > 512) throw invalidResponse()
        val reasons = reasonsElement.asJsonArray.map { portableText(it.requireString(), 2, 2_000) }
        if ((assessmentState == "complete-for-review") != reasons.isEmpty()) throw invalidResponse()
        val assessedAt = status.requireInstant("assessedAt")

        val registry = projection.get("registry")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys(
                "id", "revision", "digest", "membershipDigest", "state", "claimCount",
                "evidenceItemCount", "linkCount", "updatedAt",
            )
            val id = value.requireNonEmptyUuid("id")
            val revision = value.requireLong("revision")
            val record = EvidenceRegistryRecordView(
                id,
                revision,
                value.requireDigest("digest"),
                value.requireDigest("membershipDigest"),
                value.requireBoundedNonNegativeInt("claimCount", 4_096),
                value.requireBoundedNonNegativeInt("evidenceItemCount", 8_192),
                value.requireBoundedNonNegativeInt("linkCount", 32_768),
            )
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION || value.requireString("state") != "candidate" ||
                reference == null || reference.id != id || reference.revision != revision || reference.digest != record.digest
            ) throw invalidResponse()
            value.requireInstant("updatedAt")
            record
        }
        if ((reference == null) != (registry == null) ||
            (registry?.claimCount ?: 0) != claimCount ||
            (registry?.evidenceItemCount ?: 0) != evidenceItemCount ||
            (registry?.linkCount ?: 0) != linkCount ||
            projection.requireInstant("observedAt") != assessedAt
        ) throw invalidResponse()
        return EvidenceRegistryProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reasons, claimCount, evidenceItemCount, linkCount,
            notAssessedClaimCount, notAssessedEvidenceCount, adverseEvidencePendingDispositionCount,
            staleOrUnknownEvidenceCount, invalidatedEvidenceCount, unresolvedLinkCount, unresolvedRequirementCount,
            inconsistencyCount, unresolvedQuestionCount, staleBindingCount, staleSourceReferenceCount, registry,
            snapshotDigest,
        )
    }

    fun parseEndToEndTraceabilityEnvelope(
        envelope: JsonObject,
        expectedInitiativeId: UUID,
    ): EndToEndTraceabilityProjection {
        val projection = readResult(envelope).requireObject()
        projection.requireKeys(
            setOf(
                "schemaVersion", "kind", "product", "initiative", "status", "observedAt",
                "privacyBoundary", "authorityBoundary", "snapshotDigest",
            ),
            setOf("traceability"),
        )
        if (projection.requireInt("schemaVersion") != 1 ||
            projection.requireString("kind") != "end-to-end-traceability-projection" ||
            projection.requireString("privacyBoundary") != END_TO_END_TRACEABILITY_PROJECTION_PRIVACY_BOUNDARY ||
            projection.requireString("authorityBoundary") != END_TO_END_TRACEABILITY_PROJECTION_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val snapshotDigest = projection.requireDigest("snapshotDigest")
        val digestBody = projection.deepCopy().also { it.remove("snapshotDigest") }
        if (snapshotDigest != canonicalDigest(digestBody)) throw invalidResponse()

        val product = projection.get("product").requireObject()
        product.requireExactKeys("id", "revision", "digest")
        val productId = product.requireNonEmptyUuid("id")
        val productRevision = product.requireLong("revision")
        if (productRevision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
        val productDigest = product.requireDigest("digest")
        val initiative = projection.get("initiative").requireObject()
        initiative.requireExactKeys("id", "revision", "digest", "state")
        val initiativeId = initiative.requireNonEmptyUuid("id")
        val initiativeRevision = initiative.requireLong("revision")
        if (initiativeId != expectedInitiativeId || initiativeRevision !in 1..MAX_SAFE_PRODUCT_REVISION) {
            throw invalidResponse()
        }
        val initiativeDigest = initiative.requireDigest("digest")
        val initiativeState = initiative.requireOneOf(
            "state",
            setOf("proposed", "active", "blocked", "completed", "cancelled"),
        )

        data class Reference(val id: UUID, val revision: Long, val digest: String)
        val status = projection.get("status").requireObject()
        status.requireKeys(
            setOf(
                "schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision",
                "nodeCount", "relationshipCount", "linkCount", "transformationCount", "verifiedLinkCount",
                "proposedLinkCount", "invalidOrHistoricalLinkCount", "unresolvedEndpointCount",
                "notAssessedSemanticCount", "missingSpineCount", "unknownRelationshipCount",
                "unresolvedRequirementCount", "staleBindingCount", "staleSourceReferenceCount",
                "inconsistencyCount", "unresolvedQuestionCount", "state", "reasons", "assessedAt",
                "coverageBoundary", "authorityBoundary",
            ),
            setOf("traceability"),
        )
        if (status.requireInt("schemaVersion") != 1 ||
            status.requireString("kind") != "end-to-end-traceability-status" ||
            status.requireNonEmptyUuid("productId") != productId ||
            status.requireLong("productRevision") != productRevision ||
            status.requireNonEmptyUuid("initiativeId") != initiativeId ||
            status.requireLong("initiativeRevision") != initiativeRevision ||
            status.requireString("authorityBoundary") != END_TO_END_TRACEABILITY_STATUS_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val coverageBoundary = status.requireString("coverageBoundary")
        if (coverageBoundary != END_TO_END_TRACEABILITY_COVERAGE_BOUNDARY) throw invalidResponse()
        val reference = status.get("traceability")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys("recordId", "revision", "digest")
            val revision = value.requireLong("revision")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
            Reference(value.requireNonEmptyUuid("recordId"), revision, value.requireDigest("digest"))
        }
        val nodeCount = status.requireBoundedNonNegativeInt("nodeCount", 8_192)
        val relationshipCount = status.requireBoundedNonNegativeInt("relationshipCount", 512)
        val linkCount = status.requireBoundedNonNegativeInt("linkCount", 32_768)
        val transformationCount = status.requireBoundedNonNegativeInt("transformationCount", 4_096)
        val verifiedLinkCount = status.requireBoundedNonNegativeInt("verifiedLinkCount", 32_768)
        val proposedLinkCount = status.requireBoundedNonNegativeInt("proposedLinkCount", 32_768)
        val invalidOrHistoricalLinkCount = status.requireBoundedNonNegativeInt("invalidOrHistoricalLinkCount", 32_768)
        val unresolvedEndpointCount = status.requireBoundedNonNegativeInt("unresolvedEndpointCount", 65_536)
        val notAssessedSemanticCount = status.requireBoundedNonNegativeInt("notAssessedSemanticCount", 32_768)
        if (verifiedLinkCount + proposedLinkCount + invalidOrHistoricalLinkCount > linkCount ||
            notAssessedSemanticCount > linkCount
        ) throw invalidResponse()
        val missingSpineCount = status.requireBoundedNonNegativeInt("missingSpineCount", 4_096)
        val unknownRelationshipCount = status.requireBoundedNonNegativeInt("unknownRelationshipCount", 512)
        val unresolvedRequirementCount = status.requireBoundedNonNegativeInt("unresolvedRequirementCount", 21)
        val staleBindingCount = status.requireBoundedNonNegativeInt("staleBindingCount", 131_072)
        val staleSourceReferenceCount = status.requireBoundedNonNegativeInt("staleSourceReferenceCount", 131_072)
        val inconsistencyCount = status.requireBoundedNonNegativeInt("inconsistencyCount", 512)
        val unresolvedQuestionCount = status.requireBoundedNonNegativeInt("unresolvedQuestionCount", 512)
        val assessmentState = status.requireOneOf("state", setOf("complete-for-review", "attention-required"))
        val reasonsElement = status.get("reasons")
        if (reasonsElement == null || !reasonsElement.isJsonArray || reasonsElement.asJsonArray.size() > 512) {
            throw invalidResponse()
        }
        val reasons = reasonsElement.asJsonArray.map { portableText(it.requireString(), 2, 2_000) }
        if ((assessmentState == "complete-for-review") != reasons.isEmpty()) throw invalidResponse()
        val assessedAt = status.requireInstant("assessedAt")

        val traceability = projection.get("traceability")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys(
                "id", "revision", "digest", "membershipDigest", "state", "nodeCount",
                "relationshipCount", "linkCount", "transformationCount", "updatedAt",
            )
            val id = value.requireNonEmptyUuid("id")
            val revision = value.requireLong("revision")
            val record = EndToEndTraceabilityRecordView(
                id,
                revision,
                value.requireDigest("digest"),
                value.requireDigest("membershipDigest"),
                value.requireBoundedNonNegativeInt("nodeCount", 8_192),
                value.requireBoundedNonNegativeInt("relationshipCount", 512),
                value.requireBoundedNonNegativeInt("linkCount", 32_768),
                value.requireBoundedNonNegativeInt("transformationCount", 4_096),
            )
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION || value.requireString("state") != "candidate" ||
                reference == null || reference.id != id || reference.revision != revision ||
                reference.digest != record.digest
            ) throw invalidResponse()
            value.requireInstant("updatedAt")
            record
        }
        if ((reference == null) != (traceability == null) ||
            (traceability?.nodeCount ?: 0) != nodeCount ||
            (traceability?.relationshipCount ?: 0) != relationshipCount ||
            (traceability?.linkCount ?: 0) != linkCount ||
            (traceability?.transformationCount ?: 0) != transformationCount ||
            projection.requireInstant("observedAt") != assessedAt
        ) throw invalidResponse()
        return EndToEndTraceabilityProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reasons, nodeCount, relationshipCount, linkCount,
            transformationCount, verifiedLinkCount, proposedLinkCount, invalidOrHistoricalLinkCount,
            unresolvedEndpointCount, notAssessedSemanticCount, missingSpineCount, unknownRelationshipCount,
            unresolvedRequirementCount, staleBindingCount, staleSourceReferenceCount, inconsistencyCount,
            unresolvedQuestionCount, coverageBoundary, traceability, snapshotDigest,
        )
    }

    fun parseP0P4ReadinessGateEnvelope(
        envelope: JsonObject,
        expectedInitiativeId: UUID,
    ): P0P4ReadinessGateProjection {
        val projection = readResult(envelope).requireObject()
        projection.requireKeys(
            setOf(
                "schemaVersion", "kind", "product", "initiative", "status", "observedAt",
                "privacyBoundary", "authorityBoundary", "snapshotDigest",
            ),
            setOf("gate"),
        )
        if (projection.requireInt("schemaVersion") != 1 ||
            projection.requireString("kind") != "p0-p4-readiness-gate-projection" ||
            projection.requireString("privacyBoundary") != P0_P4_READINESS_GATE_PROJECTION_PRIVACY_BOUNDARY ||
            projection.requireString("authorityBoundary") != P0_P4_READINESS_GATE_PROJECTION_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val snapshotDigest = projection.requireDigest("snapshotDigest")
        val digestBody = projection.deepCopy().also { it.remove("snapshotDigest") }
        if (snapshotDigest != canonicalDigest(digestBody)) throw invalidResponse()

        val product = projection.get("product").requireObject()
        product.requireExactKeys("id", "revision", "digest")
        val productId = product.requireNonEmptyUuid("id")
        val productRevision = product.requireLong("revision")
        if (productRevision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
        val productDigest = product.requireDigest("digest")
        val initiative = projection.get("initiative").requireObject()
        initiative.requireExactKeys("id", "revision", "digest", "state")
        val initiativeId = initiative.requireNonEmptyUuid("id")
        val initiativeRevision = initiative.requireLong("revision")
        if (initiativeId != expectedInitiativeId || initiativeRevision !in 1..MAX_SAFE_PRODUCT_REVISION) {
            throw invalidResponse()
        }
        val initiativeDigest = initiative.requireDigest("digest")
        val initiativeState = initiative.requireOneOf(
            "state",
            setOf("proposed", "active", "blocked", "completed", "cancelled"),
        )

        data class Reference(val id: UUID, val revision: Long, val digest: String)
        val status = projection.get("status").requireObject()
        status.requireKeys(
            setOf(
                "schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision",
                "outputCount", "applicableOutputCount", "notApplicableOutputCount", "unresolvedApplicabilityCount",
                "satisfiedOutputCount", "conditionalOutputCount", "incompleteOutputCount", "failedOutputCount",
                "blockedOutputCount", "staleOrUnknownOutputCount", "pendingOrInvalidWaiverCount",
                "unresolvedDecisionCount", "unmetConditionCount", "unresolvedRequirementCount",
                "adverseEvidenceCount", "staleBindingCount", "staleSourceReferenceCount", "inconsistencyCount",
                "unresolvedQuestionCount", "result", "reasons", "assessedAt", "gateBoundary", "authorityBoundary",
            ),
            setOf("gate"),
        )
        if (status.requireInt("schemaVersion") != 1 ||
            status.requireString("kind") != "p0-p4-readiness-gate-status" ||
            status.requireNonEmptyUuid("productId") != productId ||
            status.requireLong("productRevision") != productRevision ||
            status.requireNonEmptyUuid("initiativeId") != initiativeId ||
            status.requireLong("initiativeRevision") != initiativeRevision ||
            status.requireString("gateBoundary") != P0_P4_READINESS_GATE_BOUNDARY ||
            status.requireString("authorityBoundary") != P0_P4_READINESS_GATE_STATUS_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val reference = status.get("gate")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys("recordId", "revision", "digest")
            val revision = value.requireLong("revision")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
            Reference(value.requireNonEmptyUuid("recordId"), revision, value.requireDigest("digest"))
        }
        val outputCount = status.requireBoundedNonNegativeInt("outputCount", 25)
        val applicableOutputCount = status.requireBoundedNonNegativeInt("applicableOutputCount", 25)
        val notApplicableOutputCount = status.requireBoundedNonNegativeInt("notApplicableOutputCount", 25)
        val unresolvedApplicabilityCount = status.requireBoundedNonNegativeInt("unresolvedApplicabilityCount", 25)
        val satisfiedOutputCount = status.requireBoundedNonNegativeInt("satisfiedOutputCount", 25)
        val conditionalOutputCount = status.requireBoundedNonNegativeInt("conditionalOutputCount", 25)
        val incompleteOutputCount = status.requireBoundedNonNegativeInt("incompleteOutputCount", 25)
        val failedOutputCount = status.requireBoundedNonNegativeInt("failedOutputCount", 25)
        val blockedOutputCount = status.requireBoundedNonNegativeInt("blockedOutputCount", 25)
        val staleOrUnknownOutputCount = status.requireBoundedNonNegativeInt("staleOrUnknownOutputCount", 25)
        val pendingOrInvalidWaiverCount = status.requireBoundedNonNegativeInt("pendingOrInvalidWaiverCount", 512)
        val unresolvedDecisionCount = status.requireBoundedNonNegativeInt("unresolvedDecisionCount", 512)
        val unmetConditionCount = status.requireBoundedNonNegativeInt("unmetConditionCount", 512)
        val unresolvedRequirementCount = status.requireBoundedNonNegativeInt("unresolvedRequirementCount", 37)
        val adverseEvidenceCount = status.requireBoundedNonNegativeInt("adverseEvidenceCount", 32_768)
        val staleBindingCount = status.requireBoundedNonNegativeInt("staleBindingCount", 131_072)
        val staleSourceReferenceCount = status.requireBoundedNonNegativeInt("staleSourceReferenceCount", 131_072)
        val inconsistencyCount = status.requireBoundedNonNegativeInt("inconsistencyCount", 512)
        val unresolvedQuestionCount = status.requireBoundedNonNegativeInt("unresolvedQuestionCount", 512)
        if (applicableOutputCount + notApplicableOutputCount + unresolvedApplicabilityCount != outputCount ||
            satisfiedOutputCount + conditionalOutputCount + incompleteOutputCount + failedOutputCount +
            blockedOutputCount + notApplicableOutputCount > outputCount
        ) throw invalidResponse()
        val result = status.requireOneOf(
            "result",
            setOf("blocked", "conditionally-passed", "failed", "incomplete", "not-assessed", "passed"),
        )
        val reasonsElement = status.get("reasons")
        if (reasonsElement == null || !reasonsElement.isJsonArray || reasonsElement.asJsonArray.size() > 1_024) {
            throw invalidResponse()
        }
        val reasons = reasonsElement.asJsonArray.map { portableText(it.requireString(), 2, 2_000) }
        val gapCount = unresolvedApplicabilityCount + conditionalOutputCount + incompleteOutputCount +
            failedOutputCount + blockedOutputCount + staleOrUnknownOutputCount + pendingOrInvalidWaiverCount +
            unresolvedDecisionCount + unmetConditionCount + unresolvedRequirementCount + adverseEvidenceCount +
            staleBindingCount + staleSourceReferenceCount + inconsistencyCount + unresolvedQuestionCount
        if ((result == "passed" && (gapCount > 0 || satisfiedOutputCount != applicableOutputCount || reasons.isNotEmpty())) ||
            (result != "passed" && reasons.isEmpty()) ||
            (result == "conditionally-passed" &&
                (conditionalOutputCount == 0 || failedOutputCount > 0 || blockedOutputCount > 0)) ||
            (reference == null && result != "not-assessed")
        ) throw invalidResponse()
        val assessedAt = status.requireInstant("assessedAt")

        val gate = projection.get("gate")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys(
                "id", "revision", "digest", "membershipDigest", "state", "evaluationDefinitionDigest",
                "outputCount", "waiverCount", "unresolvedDecisionCount", "conditionCount", "updatedAt",
            )
            val id = value.requireNonEmptyUuid("id")
            val revision = value.requireLong("revision")
            val record = P0P4ReadinessGateRecordView(
                id,
                revision,
                value.requireDigest("digest"),
                value.requireDigest("membershipDigest"),
                value.requireDigest("evaluationDefinitionDigest"),
                value.requireBoundedNonNegativeInt("outputCount", 25),
                value.requireBoundedNonNegativeInt("waiverCount", 512),
                value.requireBoundedNonNegativeInt("unresolvedDecisionCount", 512),
                value.requireBoundedNonNegativeInt("conditionCount", 512),
            )
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION || value.requireString("state") != "candidate" ||
                reference == null || reference.id != id || reference.revision != revision ||
                reference.digest != record.digest || record.outputCount != outputCount ||
                record.unresolvedDecisionCount != unresolvedDecisionCount
            ) throw invalidResponse()
            value.requireInstant("updatedAt")
            record
        }
        if ((reference == null) != (gate == null) || projection.requireInstant("observedAt") != assessedAt) {
            throw invalidResponse()
        }
        return P0P4ReadinessGateProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, result, reasons, outputCount, applicableOutputCount, notApplicableOutputCount,
            unresolvedApplicabilityCount, satisfiedOutputCount, conditionalOutputCount, incompleteOutputCount,
            failedOutputCount, blockedOutputCount, staleOrUnknownOutputCount, pendingOrInvalidWaiverCount,
            unresolvedDecisionCount, unmetConditionCount, unresolvedRequirementCount, adverseEvidenceCount,
            staleBindingCount, staleSourceReferenceCount, inconsistencyCount, unresolvedQuestionCount,
            P0_P4_READINESS_GATE_BOUNDARY, gate, snapshotDigest,
        )
    }

    fun parseP5HandoffPackageEnvelope(
        envelope: JsonObject,
        expectedInitiativeId: UUID,
    ): P5HandoffPackageProjection {
        val projection = readResult(envelope).requireObject()
        projection.requireKeys(
            setOf(
                "schemaVersion", "kind", "product", "initiative", "status", "observedAt",
                "privacyBoundary", "authorityBoundary", "snapshotDigest",
            ),
            setOf("handoff"),
        )
        if (projection.requireInt("schemaVersion") != 1 ||
            projection.requireString("kind") != "p5-handoff-package-projection" ||
            projection.requireString("privacyBoundary") != P5_HANDOFF_PROJECTION_PRIVACY_BOUNDARY ||
            projection.requireString("authorityBoundary") != P5_HANDOFF_PROJECTION_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val snapshotDigest = projection.requireDigest("snapshotDigest")
        val digestBody = projection.deepCopy().also { it.remove("snapshotDigest") }
        if (snapshotDigest != canonicalDigest(digestBody)) throw invalidResponse()

        val product = projection.get("product").requireObject()
        product.requireExactKeys("id", "revision", "digest")
        val productId = product.requireNonEmptyUuid("id")
        val productRevision = product.requireLong("revision")
        if (productRevision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
        val productDigest = product.requireDigest("digest")
        val initiative = projection.get("initiative").requireObject()
        initiative.requireExactKeys("id", "revision", "digest", "state")
        val initiativeId = initiative.requireNonEmptyUuid("id")
        val initiativeRevision = initiative.requireLong("revision")
        if (initiativeId != expectedInitiativeId || initiativeRevision !in 1..MAX_SAFE_PRODUCT_REVISION) {
            throw invalidResponse()
        }
        val initiativeDigest = initiative.requireDigest("digest")
        val initiativeState = initiative.requireOneOf(
            "state",
            setOf("proposed", "active", "blocked", "completed", "cancelled"),
        )

        data class Reference(val id: UUID, val revision: Long, val digest: String)
        val status = projection.get("status").requireObject()
        status.requireKeys(
            setOf(
                "schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision",
                "itemCount", "includedItemCount", "referenceOnlyItemCount", "omittedNotApplicableItemCount",
                "unresolvedItemCount", "staleOrUnknownItemCount", "lossyTransformationCount",
                "unresolvedRequirementCount", "conflictCount", "unresolvedQuestionCount", "staleBindingCount",
                "staleSourceReferenceCount", "readinessResult", "transferState", "state", "reasons", "assessedAt",
                "handoffBoundary", "authorityBoundary",
            ),
            setOf("handoff"),
        )
        if (status.requireInt("schemaVersion") != 1 ||
            status.requireString("kind") != "p5-handoff-package-status" ||
            status.requireNonEmptyUuid("productId") != productId ||
            status.requireLong("productRevision") != productRevision ||
            status.requireNonEmptyUuid("initiativeId") != initiativeId ||
            status.requireLong("initiativeRevision") != initiativeRevision ||
            status.requireString("handoffBoundary") != P5_HANDOFF_BOUNDARY ||
            status.requireString("authorityBoundary") != P5_HANDOFF_STATUS_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val reference = status.get("handoff")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys("recordId", "revision", "digest")
            val revision = value.requireLong("revision")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
            Reference(value.requireNonEmptyUuid("recordId"), revision, value.requireDigest("digest"))
        }
        val itemCount = status.requireBoundedNonNegativeInt("itemCount", 25)
        val includedItemCount = status.requireBoundedNonNegativeInt("includedItemCount", 25)
        val referenceOnlyItemCount = status.requireBoundedNonNegativeInt("referenceOnlyItemCount", 25)
        val omittedNotApplicableItemCount = status.requireBoundedNonNegativeInt("omittedNotApplicableItemCount", 25)
        val unresolvedItemCount = status.requireBoundedNonNegativeInt("unresolvedItemCount", 25)
        val staleOrUnknownItemCount = status.requireBoundedNonNegativeInt("staleOrUnknownItemCount", 25)
        val lossyTransformationCount = status.requireBoundedNonNegativeInt("lossyTransformationCount", 25)
        val unresolvedRequirementCount = status.requireBoundedNonNegativeInt("unresolvedRequirementCount", 66)
        val conflictCount = status.requireBoundedNonNegativeInt("conflictCount", 512)
        val unresolvedQuestionCount = status.requireBoundedNonNegativeInt("unresolvedQuestionCount", 512)
        val staleBindingCount = status.requireBoundedNonNegativeInt("staleBindingCount", 131_072)
        val staleSourceReferenceCount = status.requireBoundedNonNegativeInt("staleSourceReferenceCount", 131_072)
        if (includedItemCount + referenceOnlyItemCount + omittedNotApplicableItemCount + unresolvedItemCount != itemCount) {
            throw invalidResponse()
        }
        val readinessResult = status.requireOneOf(
            "readinessResult",
            setOf("blocked", "conditionally-passed", "failed", "incomplete", "not-assessed", "passed"),
        )
        val transferState = status.requireOneOf("transferState", setOf("draft", "held", "ready-for-human-review"))
        val assessmentState = status.requireOneOf("state", setOf("attention-required", "complete-for-review"))
        val reasonsElement = status.get("reasons")
        if (reasonsElement == null || !reasonsElement.isJsonArray || reasonsElement.asJsonArray.size() > 1_024) {
            throw invalidResponse()
        }
        val reasons = reasonsElement.asJsonArray.map { portableText(it.requireString(), 2, 2_000) }
        val gapCount = unresolvedItemCount + staleOrUnknownItemCount + unresolvedRequirementCount + conflictCount +
            unresolvedQuestionCount + staleBindingCount + staleSourceReferenceCount
        if ((assessmentState == "complete-for-review" &&
                (gapCount > 0 || readinessResult != "passed" || transferState != "ready-for-human-review" || reasons.isNotEmpty())) ||
            (assessmentState == "attention-required" && reasons.isEmpty()) ||
            (reference == null && assessmentState != "attention-required")
        ) throw invalidResponse()
        val assessedAt = status.requireInstant("assessedAt")

        val handoff = projection.get("handoff")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys(
                "id", "revision", "digest", "membershipDigest", "state", "readinessStatusDigest",
                "itemCount", "requirementCount", "deliveryMode", "updatedAt",
            )
            val id = value.requireNonEmptyUuid("id")
            val revision = value.requireLong("revision")
            val record = P5HandoffPackageRecordView(
                id,
                revision,
                value.requireDigest("digest"),
                value.requireDigest("membershipDigest"),
                value.requireDigest("readinessStatusDigest"),
                value.requireBoundedNonNegativeInt("itemCount", 25),
                value.requireBoundedNonNegativeInt("requirementCount", 66),
                value.requireOneOf("deliveryMode", setOf("disconnected", "governed-figma", "repository")),
            )
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION || value.requireString("state") != "candidate" ||
                reference == null || reference.id != id || reference.revision != revision ||
                reference.digest != record.digest || record.itemCount != itemCount
            ) throw invalidResponse()
            value.requireInstant("updatedAt")
            record
        }
        if ((reference == null) != (handoff == null) || projection.requireInstant("observedAt") != assessedAt) {
            throw invalidResponse()
        }
        return P5HandoffPackageProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, readinessResult, transferState, reasons, itemCount,
            includedItemCount, referenceOnlyItemCount, omittedNotApplicableItemCount, unresolvedItemCount,
            staleOrUnknownItemCount, lossyTransformationCount, unresolvedRequirementCount, conflictCount,
            unresolvedQuestionCount, staleBindingCount, staleSourceReferenceCount, P5_HANDOFF_BOUNDARY,
            handoff, snapshotDigest,
        )
    }

    fun parseDesignApplicabilityEnvelope(
        envelope: JsonObject,
        expectedInitiativeId: UUID,
    ): DesignApplicabilityProjection {
        val projection = readResult(envelope).requireObject()
        projection.requireKeys(
            setOf(
                "schemaVersion", "kind", "product", "initiative", "status", "observedAt",
                "privacyBoundary", "authorityBoundary", "snapshotDigest",
            ),
            setOf("candidate"),
        )
        if (projection.requireInt("schemaVersion") != 1 ||
            projection.requireString("kind") != "design-applicability-projection" ||
            projection.requireString("privacyBoundary") != DESIGN_APPLICABILITY_PROJECTION_PRIVACY_BOUNDARY ||
            projection.requireString("authorityBoundary") != DESIGN_APPLICABILITY_PROJECTION_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val snapshotDigest = projection.requireDigest("snapshotDigest")
        val digestBody = projection.deepCopy().also { it.remove("snapshotDigest") }
        if (snapshotDigest != canonicalDigest(digestBody)) throw invalidResponse()

        val product = projection.get("product").requireObject()
        product.requireExactKeys("id", "revision", "digest")
        val productId = product.requireNonEmptyUuid("id")
        val productRevision = product.requireLong("revision")
        if (productRevision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
        val productDigest = product.requireDigest("digest")
        val initiative = projection.get("initiative").requireObject()
        initiative.requireExactKeys("id", "revision", "digest", "state")
        val initiativeId = initiative.requireNonEmptyUuid("id")
        val initiativeRevision = initiative.requireLong("revision")
        if (initiativeId != expectedInitiativeId || initiativeRevision !in 1..MAX_SAFE_PRODUCT_REVISION) {
            throw invalidResponse()
        }
        val initiativeDigest = initiative.requireDigest("digest")
        val initiativeState = initiative.requireOneOf(
            "state",
            setOf("proposed", "active", "blocked", "completed", "cancelled"),
        )

        data class Reference(val id: UUID, val revision: Long, val digest: String)
        val status = projection.get("status").requireObject()
        status.requireKeys(
            setOf(
                "schemaVersion", "kind", "productId", "productRevision", "initiativeId", "initiativeRevision",
                "scopeCount", "decisionCount", "unresolvedDecisionCount", "blockedDecisionCount",
                "pendingApprovalCount", "rejectedApprovalCount", "unresolvedDepthCount", "unresolvedSourceCount",
                "staleBindingCount", "staleSourceReferenceCount", "unresolvedQuestionCount", "reviewState", "state",
                "reasons", "assessedAt", "authorityBoundary",
            ),
            setOf("candidate"),
        )
        if (status.requireInt("schemaVersion") != 1 ||
            status.requireString("kind") != "design-applicability-status" ||
            status.requireNonEmptyUuid("productId") != productId ||
            status.requireLong("productRevision") != productRevision ||
            status.requireNonEmptyUuid("initiativeId") != initiativeId ||
            status.requireLong("initiativeRevision") != initiativeRevision ||
            status.requireString("authorityBoundary") != DESIGN_APPLICABILITY_STATUS_AUTHORITY_BOUNDARY
        ) throw invalidResponse()
        val reference = status.get("candidate")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys("recordId", "revision", "digest")
            val revision = value.requireLong("revision")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
            Reference(value.requireNonEmptyUuid("recordId"), revision, value.requireDigest("digest"))
        }
        val scopeCount = status.requireBoundedNonNegativeInt("scopeCount", 256)
        val decisionCount = status.requireBoundedNonNegativeInt("decisionCount", 1_024)
        val unresolvedDecisionCount = status.requireBoundedNonNegativeInt("unresolvedDecisionCount", 1_024)
        val blockedDecisionCount = status.requireBoundedNonNegativeInt("blockedDecisionCount", 1_024)
        val pendingApprovalCount = status.requireBoundedNonNegativeInt("pendingApprovalCount", 1_024)
        val rejectedApprovalCount = status.requireBoundedNonNegativeInt("rejectedApprovalCount", 1_024)
        val unresolvedDepthCount = status.requireBoundedNonNegativeInt("unresolvedDepthCount", 256)
        val unresolvedSourceCount = status.requireBoundedNonNegativeInt("unresolvedSourceCount", 256)
        val staleBindingCount = status.requireBoundedNonNegativeInt("staleBindingCount", 131_072)
        val staleSourceReferenceCount = status.requireBoundedNonNegativeInt("staleSourceReferenceCount", 131_072)
        val unresolvedQuestionCount = status.requireBoundedNonNegativeInt("unresolvedQuestionCount", 512)
        if (decisionCount != scopeCount * 4) throw invalidResponse()
        val reviewState = status.requireOneOf("reviewState", setOf("draft", "held", "ready-for-human-review"))
        val assessmentState = status.requireOneOf("state", setOf("attention-required", "complete-for-review"))
        val reasonsElement = status.get("reasons")
        if (reasonsElement == null || !reasonsElement.isJsonArray || reasonsElement.asJsonArray.size() > 1_024) {
            throw invalidResponse()
        }
        val reasons = reasonsElement.asJsonArray.map { portableText(it.requireString(), 2, 2_000) }
        val gapCount = unresolvedDecisionCount + blockedDecisionCount + pendingApprovalCount + rejectedApprovalCount +
            unresolvedDepthCount + unresolvedSourceCount + staleBindingCount + staleSourceReferenceCount +
            unresolvedQuestionCount
        if ((assessmentState == "complete-for-review" &&
                (gapCount > 0 || reviewState != "ready-for-human-review" || reasons.isNotEmpty() || reference == null)) ||
            (assessmentState == "attention-required" && reasons.isEmpty())
        ) throw invalidResponse()
        val assessedAt = status.requireInstant("assessedAt")

        val candidate = projection.get("candidate")?.let { element ->
            val value = element.requireObject()
            value.requireExactKeys(
                "id", "revision", "digest", "membershipDigest", "state", "scopeCount", "reviewState", "updatedAt",
            )
            val id = value.requireNonEmptyUuid("id")
            val revision = value.requireLong("revision")
            val record = DesignApplicabilityRecordView(
                id,
                revision,
                value.requireDigest("digest"),
                value.requireDigest("membershipDigest"),
                value.requireBoundedNonNegativeInt("scopeCount", 256),
                value.requireOneOf("reviewState", setOf("draft", "held", "ready-for-human-review")),
            )
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION || value.requireString("state") != "candidate" ||
                reference == null || reference.id != id || reference.revision != revision ||
                reference.digest != record.digest || record.scopeCount != scopeCount || record.reviewState != reviewState
            ) throw invalidResponse()
            value.requireInstant("updatedAt")
            record
        }
        if ((reference == null) != (candidate == null) || projection.requireInstant("observedAt") != assessedAt) {
            throw invalidResponse()
        }
        return DesignApplicabilityProjection(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, assessmentState, reviewState, reasons, scopeCount, decisionCount,
            unresolvedDecisionCount, blockedDecisionCount, pendingApprovalCount, rejectedApprovalCount,
            unresolvedDepthCount, unresolvedSourceCount, staleBindingCount, staleSourceReferenceCount,
            unresolvedQuestionCount, candidate, snapshotDigest,
        )
    }

    fun parseProductBindingEnvelope(envelope: JsonObject): ProductBinding {
        val product = readResult(envelope).requireObject()
        val id = parseUuid(product.requireString("id"))
        val name = product.requireString("name")
        val revision = product.get("revision")?.let { product.requireLong("revision") } ?: 1L
        if (id == UUID(0, 0) || name.length !in 1..240 || name != name.trim() ||
            name.any(Char::isISOControl) || revision !in 1..MAX_SAFE_PRODUCT_REVISION
        ) {
            throw invalidResponse()
        }
        return ProductBinding(id, name, revision, canonicalDigest(product))
    }

    fun parsePhaseDashboardEnvelope(
        envelope: JsonObject,
        expectedPhase: DeliveryPhaseId,
        expectedProduct: ProductBinding,
    ): PhaseDashboardFramework {
        val framework = readResult(envelope).requireObject()
        framework.requireExactKeys(
            "schemaVersion", "kind", "catalogVersion", "product", "phase", "panels", "evidenceCues", "observedAt",
            "sourceBoundary", "limitations", "authorityBoundary", "compositionDigest",
        )
        if (framework.requireInt("schemaVersion") != 1 ||
            framework.requireString("kind") != "phase-dashboard-framework" ||
            framework.requireString("catalogVersion") != "gaep-phase-dashboards-v1" ||
            framework.requireString("sourceBoundary") != "governed-repository-and-engine-only" ||
            framework.requireString("authorityBoundary") != PHASE_DASHBOARD_AUTHORITY_BOUNDARY
        ) {
            throw invalidResponse()
        }
        val product = framework.get("product").requireObject()
        product.requireExactKeys("recordType", "recordId", "revision", "digest")
        val productId = parseUuid(product.requireString("recordId"))
        val productRevision = product.requireLong("revision")
        val productDigest = product.requireDigest("digest")
        if (product.requireString("recordType") != "product" || productId != expectedProduct.id ||
            productRevision != expectedProduct.revision || productDigest != expectedProduct.digest
        ) {
            throw invalidResponse()
        }
        val phase = framework.get("phase").requireObject()
        phase.requireExactKeys("id", "label")
        val phaseId = DeliveryPhaseId.entries.singleOrNull { it.wireValue == phase.requireString("id") }
            ?: throw invalidResponse()
        val phaseDefinition = deliveryPhaseCatalog.getValue(phaseId)
        if (phaseId != expectedPhase || phase.requireString("label") != phaseDefinition.first) throw invalidResponse()
        val panelsElement = framework.get("panels")
        if (panelsElement == null || !panelsElement.isJsonArray || panelsElement.asJsonArray.size() != 3) {
            throw invalidResponse()
        }
        val expectedPanels = listOf(phaseDefinition.second, "change-impact", "agent-model")
        val panels = panelsElement.asJsonArray.mapIndexed { index, value ->
            parsePhaseDashboardPanel(value.requireObject(), expectedPanels[index])
        }
        val limitationsElement = framework.get("limitations")
        if (limitationsElement == null || !limitationsElement.isJsonArray || limitationsElement.asJsonArray.size() !in 1..8) {
            throw invalidResponse()
        }
        val limitations = limitationsElement.asJsonArray.map { value ->
            portableText(value.requireString(), minimum = 4).also { if (it.length > 1_000) throw invalidResponse() }
        }
        val observedAt = parseInstant(framework.get("observedAt"))
        val compositionDigest = framework.requireDigest("compositionDigest")
        val digestBody = framework.deepCopy().apply { remove("compositionDigest") }
        if (compositionDigest != canonicalDigest(digestBody)) throw invalidResponse()
        return PhaseDashboardFramework(
            productId = productId,
            productRevision = productRevision,
            productDigest = productDigest,
            phase = phaseId,
            phaseLabel = phaseDefinition.first,
            panels = panels,
            evidenceCues = parseDashboardEvidenceCues(framework.get("evidenceCues"), "current"),
            observedAt = observedAt,
            sourceBoundary = "governed-repository-and-engine-only",
            limitations = limitations,
            compositionDigest = compositionDigest,
        )
    }

    fun parsePhase1SummaryEnvelope(
        envelope: JsonObject,
        expectedProduct: ProductBinding,
        expectedInitiative: InitiativeEntryRecord,
    ): Phase1SummaryDashboard {
        val summary = readResult(envelope).requireObject()
        summary.requireExactKeys(
            "schemaVersion", "kind", "phase", "product", "initiative", "readiness", "handoff", "phaseStatus",
            "owners", "freshness", "evidenceCues", "observedAt", "sourceBoundary", "privacyBoundary", "limitations",
            "authorityBoundary", "snapshotDigest",
        )
        if (summary.requireInt("schemaVersion") != 1 ||
            summary.requireString("kind") != "phase-1-summary-readiness-dashboard" ||
            summary.requireString("sourceBoundary") != PHASE1_SUMMARY_SOURCE_BOUNDARY ||
            summary.requireString("privacyBoundary") != PHASE1_SUMMARY_PRIVACY_BOUNDARY ||
            summary.requireString("authorityBoundary") != PHASE1_SUMMARY_AUTHORITY_BOUNDARY
        ) throw invalidResponse()

        val phase = summary.get("phase").requireObject()
        phase.requireExactKeys("id", "label")
        if (phase.requireString("id") != "phase-1b-product" ||
            phase.requireString("label") != "Phase 1B — Product P0–P4"
        ) throw invalidResponse()

        val product = summary.get("product").requireObject()
        product.requireExactKeys("recordType", "recordId", "revision", "digest")
        val productId = parseUuid(product.requireString("recordId"))
        val productRevision = product.requireLong("revision")
        val productDigest = product.requireDigest("digest")
        if (product.requireString("recordType") != "product" || productId != expectedProduct.id ||
            productRevision != expectedProduct.revision || productDigest != expectedProduct.digest
        ) throw invalidResponse()

        val initiative = summary.get("initiative").requireObject()
        initiative.requireExactKeys("recordType", "recordId", "revision", "digest", "state")
        val initiativeId = parseUuid(initiative.requireString("recordId"))
        val initiativeRevision = initiative.requireLong("revision")
        val initiativeDigest = initiative.requireDigest("digest")
        val initiativeState = initiative.requireString("state")
        if (initiative.requireString("recordType") != "initiative" || initiativeId != expectedInitiative.id ||
            initiativeRevision != expectedInitiative.revision || initiativeDigest != expectedInitiative.digest ||
            initiativeState != expectedInitiative.state || expectedInitiative.productId != expectedProduct.id ||
            initiativeState !in setOf("active", "blocked", "cancelled", "completed", "proposed")
        ) throw invalidResponse()

        fun validateOptionalReference(container: JsonObject, key: String): Boolean {
            val value = container.get(key) ?: return false
            val reference = value.requireObject()
            reference.requireExactKeys("recordId", "revision", "digest")
            if (parseUuid(reference.requireString("recordId")) == UUID(0, 0) ||
                reference.requireLong("revision") !in 1..MAX_SAFE_PRODUCT_REVISION
            ) throw invalidResponse()
            reference.requireDigest("digest")
            return true
        }

        fun reconciledGapTotal(gaps: JsonObject, fields: List<String>): Long {
            gaps.requireExactKeys(*(fields + "total").toTypedArray())
            val expected = fields.sumOf { field -> gaps.requireLong(field).also { if (it < 0) throw invalidResponse() } }
            val declared = gaps.requireLong("total")
            if (declared < 0 || declared != expected) throw invalidResponse()
            return declared
        }

        val readiness = summary.get("readiness").requireObject()
        readiness.requireKeys(
            setOf("snapshotDigest", "result", "assessedAt", "outputs", "gaps", "reasonCount", "attentionRequired", "authorityBoundary"),
            setOf("gate"),
        )
        readiness.requireDigest("snapshotDigest")
        val readinessResult = readiness.requireString("result")
        if (readinessResult !in setOf("blocked", "conditionally-passed", "failed", "incomplete", "not-assessed", "passed") ||
            readiness.requireString("authorityBoundary") !=
            "readiness-result-is-evaluation-only-not-permission-or-product-readiness"
        ) throw invalidResponse()
        val hasGate = validateOptionalReference(readiness, "gate")
        val readinessAssessedAt = parseInstant(readiness.get("assessedAt"))
        val outputs = readiness.get("outputs").requireObject()
        outputs.requireExactKeys("total", "applicable", "notApplicable", "unresolvedApplicability", "satisfied")
        val readinessTotal = outputs.requireLong("total")
        val readinessApplicable = outputs.requireLong("applicable")
        val readinessNotApplicable = outputs.requireLong("notApplicable")
        val readinessUnresolved = outputs.requireLong("unresolvedApplicability")
        val readinessSatisfied = outputs.requireLong("satisfied")
        if (listOf(readinessTotal, readinessApplicable, readinessNotApplicable, readinessUnresolved, readinessSatisfied)
                .any { it !in 0..25 } ||
            readinessApplicable + readinessNotApplicable + readinessUnresolved != readinessTotal ||
            readinessSatisfied > readinessApplicable
        ) throw invalidResponse()
        val readinessGapCount = reconciledGapTotal(
            readiness.get("gaps").requireObject(),
            listOf(
                "applicability", "conditional", "incomplete", "failed", "blocked", "staleOrUnknown", "waivers",
                "decisions", "conditions", "requirements", "adverseEvidence", "bindings", "sourceReferences",
                "inconsistencies", "questions",
            ),
        )
        if (readiness.requireLong("reasonCount") < 0) throw invalidResponse()
        val readinessAttention = readinessResult != "passed" || readinessGapCount > 0 || !hasGate
        if (readiness.requireBoolean("attentionRequired") != readinessAttention) throw invalidResponse()

        val handoff = summary.get("handoff").requireObject()
        handoff.requireKeys(
            setOf("snapshotDigest", "state", "transferState", "assessedAt", "items", "gaps", "reasonCount", "attentionRequired", "authorityBoundary"),
            setOf("package"),
        )
        handoff.requireDigest("snapshotDigest")
        val handoffState = handoff.requireString("state")
        val handoffTransferState = handoff.requireString("transferState")
        if (handoffState !in setOf("attention-required", "complete-for-review") ||
            handoffTransferState !in setOf("draft", "held", "ready-for-human-review") ||
            handoff.requireString("authorityBoundary") !=
            "handoff-status-is-candidate-context-only-not-transfer-or-phase-entry-authority"
        ) throw invalidResponse()
        val hasHandoff = validateOptionalReference(handoff, "package")
        val handoffAssessedAt = parseInstant(handoff.get("assessedAt"))
        val items = handoff.get("items").requireObject()
        items.requireExactKeys("total", "included", "referenceOnly", "omittedNotApplicable", "unresolved")
        val handoffTotal = items.requireLong("total")
        val handoffIncluded = items.requireLong("included")
        val handoffReferenceOnly = items.requireLong("referenceOnly")
        val handoffOmitted = items.requireLong("omittedNotApplicable")
        val handoffUnresolved = items.requireLong("unresolved")
        if (listOf(handoffTotal, handoffIncluded, handoffReferenceOnly, handoffOmitted, handoffUnresolved)
                .any { it !in 0..25 } ||
            handoffIncluded + handoffReferenceOnly + handoffOmitted + handoffUnresolved != handoffTotal
        ) throw invalidResponse()
        val handoffGapCount = reconciledGapTotal(
            handoff.get("gaps").requireObject(),
            listOf("unresolvedItems", "staleOrUnknownItems", "requirements", "conflicts", "questions", "bindings", "sourceReferences"),
        )
        if (handoff.requireLong("reasonCount") < 0) throw invalidResponse()
        val handoffAttention = handoffState != "complete-for-review" || handoffGapCount > 0 || !hasHandoff
        if (handoff.requireBoolean("attentionRequired") != handoffAttention) throw invalidResponse()

        val freshness = summary.get("freshness").requireObject()
        freshness.requireExactKeys(
            "state", "readinessObservedAt", "handoffObservedAt", "staleBindingCount", "staleSourceReferenceCount", "basis",
        )
        val staleBindingCount = freshness.requireLong("staleBindingCount")
        val staleSourceReferenceCount = freshness.requireLong("staleSourceReferenceCount")
        val freshnessAttention = staleBindingCount > 0 || staleSourceReferenceCount > 0
        val freshnessState = freshness.requireString("state")
        if (staleBindingCount < 0 || staleSourceReferenceCount < 0 ||
            freshness.requireString("basis") != "exact-current-projections-and-declared-binding-freshness" ||
            (freshnessState == "attention-required") != freshnessAttention ||
            freshnessState !in setOf("current", "attention-required")
        ) throw invalidResponse()
        val readinessObservedAt = parseInstant(freshness.get("readinessObservedAt"))
        val handoffObservedAt = parseInstant(freshness.get("handoffObservedAt"))

        val phaseStatus = summary.get("phaseStatus").requireObject()
        phaseStatus.requireExactKeys(
            "state", "declaredGapCount", "attentionSignalCount", "productOwnerAcceptance", "readinessAuthority",
            "phaseEntryAuthority",
        )
        val declaredGapCount = phaseStatus.requireLong("declaredGapCount")
        val attentionSignalCount = phaseStatus.requireInt("attentionSignalCount")
        val expectedAttentionSignals = listOf(readinessAttention, handoffAttention, freshnessAttention).count { it }
        val expectedPhaseState = if (expectedAttentionSignals == 0) "candidate-complete-for-human-review" else "attention-required"
        val phaseState = phaseStatus.requireString("state")
        if (declaredGapCount != readinessGapCount + handoffGapCount || attentionSignalCount != expectedAttentionSignals ||
            phaseState != expectedPhaseState || phaseStatus.requireString("productOwnerAcceptance") != "not-established" ||
            phaseStatus.requireString("readinessAuthority") != "not-established" ||
            phaseStatus.requireString("phaseEntryAuthority") != "not-established"
        ) throw invalidResponse()

        val owners = summary.get("owners").requireObject()
        owners.requireExactKeys("state", "boundOwnerCount", "basis")
        if (owners.requireString("state") != "unbound" || owners.requireInt("boundOwnerCount") != 0 ||
            owners.requireString("basis") != "no-governed-phase-owner-assignment-is-bound"
        ) throw invalidResponse()
        parseDashboardEvidenceCues(summary.get("evidenceCues"), if (freshnessAttention) "potentially-stale" else "current")

        val observedAt = parseInstant(summary.get("observedAt"))
        if (readinessAssessedAt > observedAt || handoffAssessedAt > observedAt ||
            readinessObservedAt > observedAt || handoffObservedAt > observedAt
        ) throw invalidResponse()
        val limitationsElement = summary.get("limitations")
        if (limitationsElement == null || !limitationsElement.isJsonArray || limitationsElement.asJsonArray.size() !in 1..8) {
            throw invalidResponse()
        }
        val limitations = limitationsElement.asJsonArray.map { value ->
            portableText(value.requireString(), minimum = 4).also { if (it.length > 1_000) throw invalidResponse() }
        }
        val snapshotDigest = summary.requireDigest("snapshotDigest")
        val digestBody = summary.deepCopy().apply { remove("snapshotDigest") }
        if (snapshotDigest != canonicalDigest(digestBody)) throw invalidResponse()
        return Phase1SummaryDashboard(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest, initiativeState,
            phaseState, declaredGapCount, attentionSignalCount, readinessResult, readinessSatisfied, readinessApplicable,
            readinessTotal, readinessGapCount, handoffState, handoffTransferState, handoffIncluded, handoffTotal,
            handoffGapCount, freshnessState, staleBindingCount, staleSourceReferenceCount, observedAt,
            PHASE1_SUMMARY_SOURCE_BOUNDARY, PHASE1_SUMMARY_PRIVACY_BOUNDARY, limitations, snapshotDigest,
        )
    }

    fun parsePhase1ChangeImpactEnvelope(
        envelope: JsonObject,
        expectedProduct: ProductBinding,
        expectedInitiative: InitiativeEntryRecord,
        expectedChange: ChangeImpactChangeReference,
    ): Phase1ChangeImpactDashboard {
        val dashboard = readResult(envelope).requireObject()
        dashboard.requireExactKeys(
            "schemaVersion", "kind", "phase", "product", "initiative", "change", "sources", "changeScope",
            "outputs", "coverage", "owners", "governance", "freshness", "evidenceCues", "observedAt",
            "sourceBoundary", "privacyBoundary", "limitations", "authorityBoundary", "snapshotDigest",
        )
        if (dashboard.requireInt("schemaVersion") != 1 ||
            dashboard.requireString("kind") != "phase-1-change-impact-dashboard" ||
            dashboard.requireString("sourceBoundary") !=
            "current-governed-product-initiative-change-readiness-handoff-and-bounded-trace-projections-only" ||
            dashboard.requireString("privacyBoundary") !=
            "dashboard-exposes-identities-digests-counts-statuses-effects-and-times-not-change-text-output-content-findings-evidence-source-content-personal-data-secrets-or-credentials" ||
            dashboard.requireString("authorityBoundary") !=
            "phase-1-change-impact-dashboard-is-read-only-observed-candidate-evidence-not-impact-completeness-revalidation-approval-risk-acceptance-readiness-effect-release-or-action-authority"
        ) throw invalidResponse()
        val phase = dashboard.get("phase").requireObject()
        phase.requireExactKeys("id", "label")
        if (phase.requireString("id") != "phase-1b-product" ||
            phase.requireString("label") != "Phase 1B — Product P0–P4"
        ) throw invalidResponse()

        val product = dashboard.get("product").requireObject()
        product.requireExactKeys("recordType", "recordId", "revision", "digest")
        val productId = product.requireNonEmptyUuid("recordId")
        val productRevision = product.requireLong("revision")
        val productDigest = product.requireDigest("digest")
        if (product.requireString("recordType") != "product" || productId != expectedProduct.id ||
            productRevision != expectedProduct.revision || productDigest != expectedProduct.digest
        ) throw invalidResponse()
        val initiative = dashboard.get("initiative").requireObject()
        initiative.requireExactKeys("recordType", "recordId", "revision", "digest", "state")
        val initiativeId = initiative.requireNonEmptyUuid("recordId")
        val initiativeRevision = initiative.requireLong("revision")
        val initiativeDigest = initiative.requireDigest("digest")
        val initiativeState = initiative.requireOneOf("state", setOf("active", "blocked", "cancelled", "completed", "proposed"))
        if (initiative.requireString("recordType") != "initiative" || initiativeId != expectedInitiative.id ||
            initiativeRevision != expectedInitiative.revision || initiativeDigest != expectedInitiative.digest ||
            initiativeState != expectedInitiative.state || expectedInitiative.productId != expectedProduct.id
        ) throw invalidResponse()
        val change = parseChangeImpactChangeReference(dashboard.get("change"))
        if (change != expectedChange) throw invalidResponse()

        fun validateReference(value: JsonElement?) {
            val reference = value.requireObject()
            reference.requireExactKeys("recordId", "revision", "digest")
            reference.requireNonEmptyUuid("recordId")
            if (reference.requireLong("revision") !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
            reference.requireDigest("digest")
        }
        val sources = dashboard.get("sources").requireObject()
        sources.requireKeys(
            setOf("changeImpactSnapshotDigest", "readinessSnapshotDigest", "handoffSnapshotDigest"),
            setOf("readinessGate", "handoffPackage"),
        )
        sources.requireDigest("changeImpactSnapshotDigest")
        sources.requireDigest("readinessSnapshotDigest")
        sources.requireDigest("handoffSnapshotDigest")
        sources.get("readinessGate")?.let(::validateReference)
        sources.get("handoffPackage")?.let(::validateReference)

        val scope = dashboard.get("changeScope").requireObject()
        scope.requireExactKeys(
            "workItemCount", "changedArtifactCount", "effectTargetCount", "affectedUnitCount", "decisionCount",
            "riskCount", "unresolvedTraceLinkCount", "staleTraceLinkCount", "invalidTraceLinkCount", "traceAnalysisTruncated",
        )
        fun scopeCount(key: String) = scope.requireBoundedNonNegativeLong(key, 1_000_000)
        scopeCount("workItemCount")
        val changedArtifactCount = scopeCount("changedArtifactCount")
        val effectTargetCount = scopeCount("effectTargetCount")
        val affectedUnitCount = scopeCount("affectedUnitCount")
        scopeCount("decisionCount")
        scopeCount("riskCount")
        val unresolvedTraceLinkCount = scopeCount("unresolvedTraceLinkCount")
        val staleTraceLinkCount = scopeCount("staleTraceLinkCount")
        val invalidTraceLinkCount = scopeCount("invalidTraceLinkCount")
        val traceAnalysisTruncated = scope.requireBoolean("traceAnalysisTruncated")

        val outputArray = dashboard.get("outputs")
        if (outputArray == null || !outputArray.isJsonArray || outputArray.asJsonArray.size() != phase1ImpactOutputRecordKinds.size) {
            throw invalidResponse()
        }
        val outputs = outputArray.asJsonArray.mapIndexed { index, element ->
            val output = element.requireObject()
            output.requireExactKeys("outputKind", "recordKind", "readiness", "impact", "handoff")
            val outputKind = output.requireString("outputKind")
            val expectedKind = phase1ImpactOutputRecordKinds.entries.elementAt(index)
            if (outputKind != expectedKind.key || output.requireString("recordKind") != expectedKind.value) throw invalidResponse()
            val readiness = output.get("readiness").requireObject()
            readiness.requireExactKeys("applicability", "evaluationState", "freshness", "subjectCount")
            val applicability = readiness.requireOneOf(
                "applicability", setOf("applicable", "not-applicable-candidate", "unresolved", "not-assessed"),
            )
            val evaluationState = readiness.requireOneOf(
                "evaluationState",
                setOf("blocked", "conditionally-satisfied", "failed", "incomplete", "not-applicable-candidate", "not-assessed", "satisfied"),
            )
            val readinessFreshness = readiness.requireOneOf("freshness", setOf("current", "stale", "unknown"))
            val subjectCount = readiness.requireBoundedNonNegativeLong("subjectCount", 512)
            if (applicability == "not-assessed" &&
                (evaluationState != "not-assessed" || readinessFreshness != "unknown" || subjectCount != 0L)
            ) throw invalidResponse()

            val impact = output.get("impact").requireObject()
            impact.requireExactKeys(
                "state", "exactMatchedSubjectCount", "staleSubjectBindingCount", "traceReferenceCount",
                "validTraceCount", "unresolvedTraceCount", "staleTraceCount", "invalidTraceCount",
                "upstreamTraceCount", "downstreamTraceCount", "revalidationState", "coverageBoundary",
            )
            val exactMatches = impact.requireBoundedNonNegativeLong("exactMatchedSubjectCount", 512)
            val staleBindings = impact.requireBoundedNonNegativeLong("staleSubjectBindingCount", 512)
            val traceCount = impact.requireBoundedNonNegativeLong("traceReferenceCount", 512)
            val validTraces = impact.requireBoundedNonNegativeLong("validTraceCount", 512)
            val unresolvedTraces = impact.requireBoundedNonNegativeLong("unresolvedTraceCount", 512)
            val staleTraces = impact.requireBoundedNonNegativeLong("staleTraceCount", 512)
            val invalidTraces = impact.requireBoundedNonNegativeLong("invalidTraceCount", 512)
            val upstreamTraces = impact.requireBoundedNonNegativeLong("upstreamTraceCount", 512)
            val downstreamTraces = impact.requireBoundedNonNegativeLong("downstreamTraceCount", 512)
            val expectedImpactState = if (staleBindings + unresolvedTraces + staleTraces + invalidTraces > 0) {
                "attention-required"
            } else if (exactMatches > 0) "current-trace-observed" else "not-established"
            val impactState = impact.requireString("state")
            if (exactMatches > subjectCount || traceCount != validTraces + unresolvedTraces + staleTraces + invalidTraces ||
                traceCount != upstreamTraces + downstreamTraces || impactState != expectedImpactState ||
                impact.requireString("revalidationState") != "not-established" ||
                impact.requireString("coverageBoundary") !=
                "absence-of-an-exact-trace-match-does-not-prove-absence-of-impact"
            ) throw invalidResponse()

            val handoff = output.get("handoff").requireObject()
            handoff.requireExactKeys("disposition", "freshness", "subjectCount")
            val handoffDisposition = handoff.requireOneOf(
                "disposition", setOf("included", "omitted-not-applicable", "reference-only", "unresolved", "not-established"),
            )
            val handoffFreshness = handoff.requireOneOf("freshness", setOf("current", "stale", "unknown"))
            val handoffSubjectCount = handoff.requireBoundedNonNegativeLong("subjectCount", 512)
            if (handoffDisposition == "not-established" && (handoffFreshness != "unknown" || handoffSubjectCount != 0L)) {
                throw invalidResponse()
            }
            Phase1ChangeImpactOutput(
                outputKind, expectedKind.value, applicability, evaluationState, readinessFreshness, subjectCount,
                impactState, exactMatches, traceCount, handoffDisposition, handoffFreshness, "not-established",
            )
        }

        val coverage = dashboard.get("coverage").requireObject()
        coverage.requireExactKeys(
            "state", "outputCount", "applicableOutputCount", "currentTraceObservedOutputCount",
            "attentionRequiredOutputCount", "impactNotEstablishedOutputCount", "revalidationNotEstablishedOutputCount",
            "basis", "coverageBoundary",
        )
        val currentCount = outputs.count { it.impactState == "current-trace-observed" }
        val attentionCount = outputs.count { it.impactState == "attention-required" }
        val unknownCount = outputs.count { it.impactState == "not-established" }
        val applicableCount = outputs.count { it.readinessApplicability == "applicable" }
        if (coverage.requireString("state") != "bounded-not-complete" || coverage.requireInt("outputCount") != 25 ||
            coverage.requireInt("applicableOutputCount") != applicableCount ||
            coverage.requireInt("currentTraceObservedOutputCount") != currentCount ||
            coverage.requireInt("attentionRequiredOutputCount") != attentionCount ||
            coverage.requireInt("impactNotEstablishedOutputCount") != unknownCount ||
            coverage.requireInt("revalidationNotEstablishedOutputCount") != 25 ||
            coverage.requireString("basis") !=
            "exact-current-readiness-subjects-matched-to-bounded-governed-change-trace-results" ||
            coverage.requireString("coverageBoundary") !=
            "trace-presence-proves-only-the-recorded-link-and-trace-absence-does-not-prove-no-impact"
        ) throw invalidResponse()

        val owners = dashboard.get("owners").requireObject()
        owners.requireExactKeys("state", "boundOutputOwnerCount", "basis")
        if (owners.requireString("state") != "unbound" || owners.requireInt("boundOutputOwnerCount") != 0 ||
            owners.requireString("basis") != "no-governed-phase-output-owner-assignment-is-bound"
        ) throw invalidResponse()
        val governance = dashboard.get("governance").requireObject()
        governance.requireExactKeys(
            "changeApproval", "riskAcceptanceAuthority", "revalidationAuthority", "productOwnerAcceptance", "effectAuthority",
        )
        if (governance.keySet().any { governance.requireString(it) != "not-established" }) throw invalidResponse()

        val freshness = dashboard.get("freshness").requireObject()
        freshness.requireExactKeys(
            "state", "changeImpactEvaluatedAt", "readinessObservedAt", "handoffObservedAt", "staleBindingCount",
            "staleSourceReferenceCount", "traceAttentionLinkCount", "traceAnalysisTruncated", "basis",
        )
        val freshnessState = freshness.requireOneOf("state", setOf("current", "attention-required"))
        val changeImpactEvaluatedAt = freshness.requireInstant("changeImpactEvaluatedAt")
        val readinessObservedAt = freshness.requireInstant("readinessObservedAt")
        val handoffObservedAt = freshness.requireInstant("handoffObservedAt")
        val staleBindingCount = freshness.requireBoundedNonNegativeLong("staleBindingCount", 1_000_000)
        val staleSourceCount = freshness.requireBoundedNonNegativeLong("staleSourceReferenceCount", 1_000_000)
        val traceAttentionCount = freshness.requireBoundedNonNegativeLong("traceAttentionLinkCount", 1_000_000)
        val freshnessTruncated = freshness.requireBoolean("traceAnalysisTruncated")
        val expectedFreshnessAttention = staleBindingCount > 0 || staleSourceCount > 0 || traceAttentionCount > 0 ||
            freshnessTruncated || attentionCount > 0
        if (traceAttentionCount != unresolvedTraceLinkCount + staleTraceLinkCount + invalidTraceLinkCount ||
            freshnessTruncated != traceAnalysisTruncated ||
            (freshnessState == "attention-required") != expectedFreshnessAttention ||
            freshness.requireString("basis") !=
            "current-governed-snapshots-and-declared-trace-readiness-handoff-freshness"
        ) throw invalidResponse()
        val cues = dashboard.get("evidenceCues").requireObject()
        cues.requireExactKeys("freshness", "confidence")
        val confidence = cues.get("confidence").requireObject()
        confidence.requireExactKeys("state", "basis")
        if (cues.requireString("freshness") != (if (expectedFreshnessAttention) "potentially-stale" else "current") ||
            confidence.requireString("state") != "not-assessed" || confidence.requireString("basis") !=
            "bounded-trace-coverage-does-not-establish-impact-confidence-or-completeness"
        ) throw invalidResponse()

        val observedAt = dashboard.requireInstant("observedAt")
        if (listOf(changeImpactEvaluatedAt, readinessObservedAt, handoffObservedAt).any { it > observedAt }) throw invalidResponse()
        val limitationsElement = dashboard.get("limitations")
        if (limitationsElement == null || !limitationsElement.isJsonArray || limitationsElement.asJsonArray.size() !in 1..8) {
            throw invalidResponse()
        }
        val limitations = limitationsElement.asJsonArray.map {
            portableText(it.requireString(), minimum = 4).also { text -> if (text.length > 1_000) throw invalidResponse() }
        }
        val snapshotDigest = dashboard.requireDigest("snapshotDigest")
        val digestBody = dashboard.deepCopy().apply { remove("snapshotDigest") }
        if (snapshotDigest != canonicalDigest(digestBody)) throw invalidResponse()
        return Phase1ChangeImpactDashboard(
            productId, productRevision, productDigest, initiativeId, initiativeRevision, initiativeDigest,
            initiativeState, change, changedArtifactCount, effectTargetCount, affectedUnitCount, outputs,
            currentCount, attentionCount, unknownCount, freshnessState, traceAttentionCount, staleBindingCount,
            observedAt, limitations, snapshotDigest,
        )
    }

    fun parseChangeImpactChangeCatalogEnvelope(
        envelope: JsonObject,
        expectedProduct: ProductBinding,
    ): ChangeImpactChangeCatalog {
        val catalog = readResult(envelope).requireObject()
        catalog.requireExactKeys(
            "schemaVersion", "kind", "product", "items", "total", "omitted", "observedAt",
            "sourceBoundary", "limitations", "authorityBoundary", "snapshotDigest",
        )
        if (catalog.requireInt("schemaVersion") != 1 ||
            catalog.requireString("kind") != "change-impact-change-catalog" ||
            catalog.requireString("sourceBoundary") != "current-governed-change-metadata-only" ||
            catalog.requireString("authorityBoundary") != CHANGE_CATALOG_AUTHORITY_BOUNDARY
        ) {
            throw invalidResponse()
        }
        val product = parseChangeImpactExactReference(catalog.get("product"), "product")
        if (product.recordId != expectedProduct.id || product.revision != expectedProduct.revision ||
            product.digest != expectedProduct.digest
        ) {
            throw invalidResponse()
        }
        val items = parseChangeImpactArray(catalog.get("items"), 256, ::parseChangeImpactChangeReference)
        if (items.map { it.recordId }.distinct().size != items.size ||
            items.zipWithNext().any { (left, right) -> left.recordId.toString() >= right.recordId.toString() }
        ) {
            throw invalidResponse()
        }
        val total = catalog.requireBoundedNonNegativeLong("total", 1_000_000)
        val omitted = catalog.requireBoundedNonNegativeLong("omitted", 1_000_000)
        if (items.size.toLong() + omitted != total) throw invalidResponse()
        val limitations = parseChangeImpactLimitations(catalog.get("limitations"))
        val observedAt = catalog.requireInstant("observedAt")
        val snapshotDigest = catalog.requireDigest("snapshotDigest")
        val digestBody = catalog.deepCopy().apply { remove("snapshotDigest") }
        if (snapshotDigest != canonicalDigest(digestBody)) throw invalidResponse()
        return ChangeImpactChangeCatalog(
            productId = product.recordId,
            productRevision = product.revision,
            productDigest = product.digest,
            items = items,
            total = total,
            omitted = omitted,
            observedAt = observedAt,
            limitations = limitations,
            snapshotDigest = snapshotDigest,
        )
    }

    fun parseChangeImpactDashboardEnvelope(
        envelope: JsonObject,
        expectedProduct: ProductBinding,
        expectedChange: ChangeImpactChangeReference,
    ): ChangeImpactDashboard {
        val dashboard = readResult(envelope).requireObject()
        dashboard.requireExactKeys(
            "schemaVersion", "kind", "product", "change", "workItems", "changedArtifacts", "effectTargets",
            "affectedUnits", "governance", "freshness", "evidenceCues", "limits", "observedAt", "sourceBoundary", "limitations",
            "authorityBoundary", "snapshotDigest",
        )
        if (dashboard.requireInt("schemaVersion") != 1 ||
            dashboard.requireString("kind") != "change-impact-dashboard" ||
            dashboard.requireString("sourceBoundary") != "current-governed-records-and-bounded-trace-analysis" ||
            dashboard.requireString("authorityBoundary") != CHANGE_DASHBOARD_AUTHORITY_BOUNDARY
        ) {
            throw invalidResponse()
        }
        val product = parseChangeImpactExactReference(dashboard.get("product"), "product")
        if (product.recordId != expectedProduct.id || product.revision != expectedProduct.revision ||
            product.digest != expectedProduct.digest
        ) {
            throw invalidResponse()
        }
        val change = parseChangeImpactChangeReference(dashboard.get("change"))
        if (change != expectedChange) throw invalidResponse()
        val workItems = parseChangeImpactArray(dashboard.get("workItems"), 256) { value ->
            val row = value.requireObject()
            row.requireExactKeys("record", "state")
            ChangeImpactWorkItem(
                parseChangeImpactExactReference(row.get("record"), "work-item"),
                row.requireOneOf("state", changeImpactWorkItemStates),
            )
        }
        fun parseArtifact(value: JsonElement): ChangeImpactArtifact {
            val row = value.requireObject()
            row.requireExactKeys("sourceWorkItem", "locator")
            return ChangeImpactArtifact(
                parseChangeImpactExactReference(row.get("sourceWorkItem"), "work-item"),
                parseChangeImpactLocator(row.get("locator")),
            )
        }
        val changedArtifacts = parseChangeImpactArray(dashboard.get("changedArtifacts"), 512, ::parseArtifact)
        val effectTargets = parseChangeImpactArray(dashboard.get("effectTargets"), 512, ::parseArtifact)
        val affectedUnits = parseChangeImpactArray(dashboard.get("affectedUnits"), 512, ::parseChangeImpactAffectedUnit)
        val governance = dashboard.get("governance").requireObject()
        governance.requireExactKeys("approval", "decisions", "risks", "authorityBoundary")
        val approval = governance.get("approval").requireObject()
        approval.requireExactKeys("state", "basis")
        if (approval.requireString("state") != "not-established" ||
            approval.requireString("basis") != "current-contract-has-no-change-approval-record" ||
            governance.requireString("authorityBoundary") != "decisions-and-risk-acceptance-do-not-approve-the-change"
        ) {
            throw invalidResponse()
        }
        val decisions = parseChangeImpactArray(governance.get("decisions"), 256) { value ->
            val row = value.requireObject()
            row.requireExactKeys("record", "state", "outcome")
            val state = row.requireOneOf("state", setOf("open", "decided", "deferred", "superseded"))
            val outcome = row.requireOneOf("outcome", setOf("human-selected", "not-selected"))
            if ((state == "decided") != (outcome == "human-selected")) throw invalidResponse()
            ChangeImpactDecision(parseChangeImpactExactReference(row.get("record"), "decision"), state, outcome)
        }
        val risks = parseChangeImpactArray(governance.get("risks"), 256) { value ->
            val row = value.requireObject()
            row.requireExactKeys("record", "state", "likelihood", "impact", "acceptance")
            val state = row.requireOneOf("state", setOf("open", "treated", "accepted", "closed"))
            val acceptance = row.requireOneOf("acceptance", setOf("human-accepted", "not-accepted"))
            if ((state == "accepted") != (acceptance == "human-accepted")) throw invalidResponse()
            ChangeImpactRisk(
                parseChangeImpactExactReference(row.get("record"), "risk"),
                state,
                row.requireOneOf("likelihood", setOf("rare", "unlikely", "possible", "likely", "almost-certain", "unknown")),
                row.requireOneOf("impact", setOf("negligible", "minor", "moderate", "major", "critical", "unknown")),
                acceptance,
            )
        }
        val freshnessObject = dashboard.get("freshness").requireObject()
        freshnessObject.requireExactKeys(
            "state", "evaluatedAt", "unresolvedTraceLinks", "invalidTraceLinks", "staleTraceLinks",
            "staleGovernanceReferences", "traceAnalysisTruncated", "coverageBoundary",
        )
        if (freshnessObject.requireString("coverageBoundary") !=
            "absence-of-a-trace-link-does-not-prove-absence-of-impact"
        ) {
            throw invalidResponse()
        }
        val freshness = ChangeImpactFreshness(
            freshnessObject.requireOneOf("state", setOf("current", "attention-required")),
            freshnessObject.requireInstant("evaluatedAt"),
            freshnessObject.requireBoundedNonNegativeLong("unresolvedTraceLinks", 1_000_000),
            freshnessObject.requireBoundedNonNegativeLong("invalidTraceLinks", 1_000_000),
            freshnessObject.requireBoundedNonNegativeLong("staleTraceLinks", 1_000_000),
            freshnessObject.requireBoundedNonNegativeLong("staleGovernanceReferences", 1_000_000),
            freshnessObject.requireBoolean("traceAnalysisTruncated"),
        )
        val limitsObject = dashboard.get("limits").requireObject()
        limitsObject.requireExactKeys(
            "workItems", "changedArtifacts", "effectTargets", "affectedUnits", "decisions", "risks", "truncated",
        )
        val limits = ChangeImpactLimits(
            parseChangeImpactLimit(limitsObject.get("workItems")),
            parseChangeImpactLimit(limitsObject.get("changedArtifacts")),
            parseChangeImpactLimit(limitsObject.get("effectTargets")),
            parseChangeImpactLimit(limitsObject.get("affectedUnits")),
            parseChangeImpactLimit(limitsObject.get("decisions")),
            parseChangeImpactLimit(limitsObject.get("risks")),
            limitsObject.requireBoolean("truncated"),
        )
        val categories = listOf(
            workItems.size.toLong() to limits.workItems,
            changedArtifacts.size.toLong() to limits.changedArtifacts,
            effectTargets.size.toLong() to limits.effectTargets,
            affectedUnits.size.toLong() to limits.affectedUnits,
            decisions.size.toLong() to limits.decisions,
            risks.size.toLong() to limits.risks,
        )
        if (categories.any { (size, limit) -> size != limit.shown }) throw invalidResponse()
        val truncated = freshness.traceAnalysisTruncated || categories.any { (_, limit) -> limit.omitted > 0 }
        val attentionRequired = truncated || freshness.unresolvedTraceLinks > 0 || freshness.invalidTraceLinks > 0 ||
            freshness.staleTraceLinks > 0 || freshness.staleGovernanceReferences > 0
        val evidenceFreshness = if (freshness.staleTraceLinks > 0 || freshness.staleGovernanceReferences > 0) {
            "stale"
        } else if (freshness.unresolvedTraceLinks > 0 || freshness.invalidTraceLinks > 0 || truncated) {
            "potentially-stale"
        } else {
            "current"
        }
        val evidenceCues = parseDashboardEvidenceCues(dashboard.get("evidenceCues"), evidenceFreshness)
        val observedAt = dashboard.requireInstant("observedAt")
        if (limits.truncated != truncated || (freshness.state == "attention-required") != attentionRequired ||
            freshness.evaluatedAt.isAfter(observedAt)
        ) {
            throw invalidResponse()
        }
        ensureUniqueChangeImpactRows(workItems, changedArtifacts, effectTargets, affectedUnits, decisions, risks)
        val limitations = parseChangeImpactLimitations(dashboard.get("limitations"))
        val snapshotDigest = dashboard.requireDigest("snapshotDigest")
        val digestBody = dashboard.deepCopy().apply { remove("snapshotDigest") }
        if (snapshotDigest != canonicalDigest(digestBody)) throw invalidResponse()
        return ChangeImpactDashboard(
            product.recordId,
            product.revision,
            product.digest,
            change,
            workItems,
            changedArtifacts,
            effectTargets,
            affectedUnits,
            decisions,
            risks,
            freshness,
            evidenceCues,
            limits,
            observedAt,
            "current-governed-records-and-bounded-trace-analysis",
            limitations,
            snapshotDigest,
        )
    }

    fun parseAgentModelDashboardEnvelope(
        envelope: JsonObject,
        expectedProduct: ProductBinding,
        expectedCapabilities: List<AgentReadinessSnapshot>,
        expectedSelection: AgentSelectionState,
    ): AgentModelDashboard {
        return parseAgentModelDashboard(
            readResult(envelope).requireObject(),
            expectedProduct,
            expectedCapabilities,
            expectedSelection,
        )
    }

    private fun parseAgentModelDashboard(
        dashboard: JsonObject,
        expectedProduct: ProductBinding,
        expectedCapabilities: List<AgentReadinessSnapshot>,
        expectedSelection: AgentSelectionState,
    ): AgentModelDashboard {
        dashboard.requireExactKeys(
            "schemaVersion", "kind", "product", "capabilities", "selection", "runs", "handoffs",
            "providerMetrics", "freshness", "evidenceCues", "limits", "observedAt", "sourceBoundary", "limitations",
            "authorityBoundary", "snapshotDigest",
        )
        if (dashboard.requireInt("schemaVersion") != 1 ||
            dashboard.requireString("kind") != "agent-model-dashboard" ||
            dashboard.requireString("sourceBoundary") !=
            "current-governed-agent-selection-run-handoff-and-managed-evidence-metadata" ||
            dashboard.requireString("authorityBoundary") !=
            "agent-model-dashboard-does-not-select-switch-handoff-launch-or-authorize-effects"
        ) {
            throw invalidResponse()
        }
        val product = parseAgentModelReference(dashboard.get("product"), "product")
        if (product.recordId != expectedProduct.id || product.revision != expectedProduct.revision ||
            product.digest != expectedProduct.digest
        ) {
            throw invalidResponse()
        }
        val capabilityValues = dashboard.get("capabilities")
        if (capabilityValues == null || !capabilityValues.isJsonArray || capabilityValues.asJsonArray.size() !in 1..16 ||
            capabilityValues.asJsonArray.size() != expectedCapabilities.size
        ) {
            throw invalidResponse()
        }
        val expectedByKey = expectedCapabilities.associateBy { "${it.adapterId}:${it.agentId}" }
        if (expectedByKey.size != expectedCapabilities.size) throw invalidResponse()
        val capabilities = capabilityValues.asJsonArray.map { value ->
            val row = value.requireObject()
            val key = "${row.requireString("adapterId")}:${row.requireString("agentId")}"
            parseAgentModelCapability(row, expectedByKey[key] ?: throw invalidResponse())
        }
        val capabilityKeys = capabilities.map { "${it.adapterId}:${it.agentId}" }
        if (capabilityKeys.distinct().size != capabilities.size ||
            capabilityKeys.zipWithNext().any { (left, right) -> left >= right }
        ) {
            throw invalidResponse()
        }
        val selection = parseAgentModelSelection(dashboard.get("selection"), expectedSelection, capabilities)
        val runValues = dashboard.get("runs")
        val handoffValues = dashboard.get("handoffs")
        if (runValues == null || !runValues.isJsonArray || runValues.asJsonArray.size() > 256 ||
            handoffValues == null || !handoffValues.isJsonArray || handoffValues.asJsonArray.size() > 256
        ) {
            throw invalidResponse()
        }
        val runs = runValues.asJsonArray.map(::parseAgentModelRun)
        val handoffs = handoffValues.asJsonArray.map(::parseAgentModelHandoff)
        if (runs.map { it.recordId }.distinct().size != runs.size ||
            handoffs.map { it.recordId }.distinct().size != handoffs.size ||
            runs.mapNotNull { it.managed.recordId }.distinct().size != runs.count { it.managed.recordId != null }
        ) {
            throw invalidResponse()
        }
        validateAgentModelMetrics(dashboard.get("providerMetrics"))
        val freshness = parseAgentModelFreshness(dashboard.get("freshness"))
        val limitObject = dashboard.get("limits").requireObject()
        limitObject.requireExactKeys("capabilities", "runs", "handoffs", "managedRuns", "truncated")
        val capabilityLimit = parseAgentModelLimit(limitObject.get("capabilities"))
        val runLimit = parseAgentModelLimit(limitObject.get("runs"))
        val handoffLimit = parseAgentModelLimit(limitObject.get("handoffs"))
        val managedRunLimit = parseAgentModelLimit(limitObject.get("managedRuns"))
        val limitsTruncated = limitObject.requireBoolean("truncated")
        if (capabilityLimit.shown != capabilities.size.toLong() || runLimit.shown != runs.size.toLong() ||
            handoffLimit.shown != handoffs.size.toLong() ||
            managedRunLimit.shown != runs.count { it.managed.status == "observed" }.toLong()
        ) {
            throw invalidResponse()
        }
        val truncated = listOf(capabilityLimit, runLimit, handoffLimit, managedRunLimit).any { it.omitted > 0 }
        val selectionCapabilityState = if (selection.status == "selected") {
            selection.capabilityState ?: throw invalidResponse()
        } else {
            selection.status
        }
        val attentionRequired = truncated || selectionCapabilityState in setOf("stale", "migration-required", "invalid")
        val evidenceFreshness = when {
            selectionCapabilityState == "stale" -> "stale"
            selectionCapabilityState == "invalid" -> "unknown"
            truncated || selectionCapabilityState == "migration-required" -> "potentially-stale"
            else -> "current"
        }
        val evidenceCues = parseDashboardEvidenceCues(dashboard.get("evidenceCues"), evidenceFreshness)
        val selectedCapabilities = capabilities.filter { it.selected }
        if (freshness.selectionCapabilityState != selectionCapabilityState || freshness.truncated != truncated ||
            limitsTruncated != truncated || (freshness.state == "attention-required") != attentionRequired
        ) {
            throw invalidResponse()
        }
        if (selection.status == "selected") {
            val selectedCapability = selectedCapabilities.singleOrNull() ?: throw invalidResponse()
            if (selectedCapability.adapterId != selection.adapterId || selectedCapability.agentId != selection.agentId ||
                ((selectedCapability.capabilityDigest == selection.capabilityDigest) !=
                    (selection.capabilityState == "current"))
            ) {
                throw invalidResponse()
            }
        } else if (selectedCapabilities.isNotEmpty()) {
            throw invalidResponse()
        }
        if (runLimit.omitted == 0L && handoffs.any { handoff -> runs.none { it.recordId == handoff.fromRunId } }) {
            throw invalidResponse()
        }
        val observedAt = dashboard.requireInstant("observedAt")
        if (freshness.oldestCapabilityObservedAt.isAfter(freshness.newestCapabilityObservedAt) ||
            freshness.newestCapabilityObservedAt.isAfter(observedAt)
        ) {
            throw invalidResponse()
        }
        val limitations = parseChangeImpactLimitations(dashboard.get("limitations"))
        val snapshotDigest = dashboard.requireDigest("snapshotDigest")
        val digestBody = dashboard.deepCopy().apply { remove("snapshotDigest") }
        if (snapshotDigest != canonicalDigest(digestBody)) throw invalidResponse()
        return AgentModelDashboard(
            productId = product.recordId,
            productRevision = product.revision,
            productDigest = product.digest,
            capabilities = capabilities,
            selection = selection,
            runs = runs,
            handoffs = handoffs,
            freshness = freshness,
            evidenceCues = evidenceCues,
            capabilityLimit = capabilityLimit,
            runLimit = runLimit,
            handoffLimit = handoffLimit,
            managedRunLimit = managedRunLimit,
            truncated = truncated,
            observedAt = observedAt,
            sourceBoundary = "current-governed-agent-selection-run-handoff-and-managed-evidence-metadata",
            limitations = limitations,
            snapshotDigest = snapshotDigest,
        )
    }

    fun parsePhase1AgentModelEnvelope(
        envelope: JsonObject,
        expectedProduct: ProductBinding,
        expectedInitiative: InitiativeEntryRecord,
        expectedCapabilities: List<AgentReadinessSnapshot>,
        expectedSelection: AgentSelectionState,
    ): Phase1AgentModelDashboard {
        val dashboard = readResult(envelope).requireObject()
        dashboard.requireExactKeys(
            "schemaVersion", "kind", "phase", "product", "initiative", "source", "agentModel",
            "executionTruth", "freshness", "governance", "observedAt", "sourceBoundary", "privacyBoundary",
            "limitations", "authorityBoundary", "snapshotDigest",
        )
        if (dashboard.requireInt("schemaVersion") != 1 ||
            dashboard.requireString("kind") != "phase-1-agent-model-dashboard" ||
            dashboard.requireString("sourceBoundary") !=
            "current-governed-product-initiative-capability-selection-run-handoff-and-managed-evidence-metadata-only" ||
            dashboard.requireString("privacyBoundary") !=
            "dashboard-exposes-identities-digests-counts-statuses-times-and-redacted-selection-metadata-not-prompts-provider-output-run-content-evidence-content-personal-data-secrets-credentials-or-machine-paths" ||
            dashboard.requireString("authorityBoundary") !=
            "phase-1-agent-model-dashboard-is-read-only-observed-evidence-not-provider-quality-preference-automatic-selection-handoff-acknowledgement-run-launch-readiness-approval-effect-release-or-action-authority"
        ) throw invalidResponse()
        val phase = dashboard.get("phase").requireObject()
        phase.requireExactKeys("id", "label")
        if (phase.requireString("id") != "phase-1b-product" ||
            phase.requireString("label") != "Phase 1B — Product P0–P4"
        ) throw invalidResponse()
        val product = parseAgentModelReference(dashboard.get("product"), "product")
        if (product.recordId != expectedProduct.id || product.revision != expectedProduct.revision ||
            product.digest != expectedProduct.digest
        ) throw invalidResponse()
        val initiative = dashboard.get("initiative").requireObject()
        initiative.requireExactKeys("recordType", "recordId", "revision", "digest", "state")
        val initiativeId = initiative.requireNonEmptyUuid("recordId")
        val initiativeRevision = initiative.requireLong("revision")
        val initiativeDigest = initiative.requireDigest("digest")
        val initiativeState = initiative.requireOneOf("state", setOf("active", "blocked", "cancelled", "completed", "proposed"))
        if (initiative.requireString("recordType") != "initiative" || initiativeId != expectedInitiative.id ||
            initiativeRevision != expectedInitiative.revision || initiativeDigest != expectedInitiative.digest ||
            initiativeState != expectedInitiative.state || expectedInitiative.productId != expectedProduct.id
        ) throw invalidResponse()

        val rawAgentModel = dashboard.get("agentModel").requireObject()
        val agentModel = parseAgentModelDashboard(rawAgentModel, expectedProduct, expectedCapabilities, expectedSelection)
        if (agentModel.runs.any { it.initiativeId != initiativeId }) throw invalidResponse()
        val runIds = agentModel.runs.map { it.recordId }.toSet()
        if (agentModel.handoffs.any { it.fromRunId !in runIds }) throw invalidResponse()
        val source = dashboard.get("source").requireObject()
        source.requireExactKeys("agentModelSnapshotDigest", "scope")
        if (source.requireDigest("agentModelSnapshotDigest") != agentModel.snapshotDigest ||
            source.requireString("scope") != "exact-current-initiative"
        ) throw invalidResponse()

        val truth = dashboard.get("executionTruth").requireObject()
        truth.requireExactKeys(
            "capabilities", "runs", "managedRuns", "handoffs", "providerMetrics",
            "liveProviderQuality", "semanticOutputQuality",
        )
        val capabilityTruth = truth.get("capabilities").requireObject().let { value ->
            value.requireExactKeys("shown", "total", "omitted", "detected", "unavailable", "selected")
            Phase1AgentModelCapabilityTruth(
                value.requireBoundedNonNegativeLong("shown", 1_000_000),
                value.requireBoundedNonNegativeLong("total", 1_000_000),
                value.requireBoundedNonNegativeLong("omitted", 1_000_000),
                value.requireBoundedNonNegativeLong("detected", 1_000_000),
                value.requireBoundedNonNegativeLong("unavailable", 1_000_000),
                value.requireBoundedNonNegativeLong("selected", 1),
            )
        }
        val detected = agentModel.capabilities.count { it.detected }.toLong()
        if (capabilityTruth.shown != agentModel.capabilityLimit.shown ||
            capabilityTruth.total != agentModel.capabilityLimit.total ||
            capabilityTruth.omitted != agentModel.capabilityLimit.omitted ||
            capabilityTruth.detected != detected ||
            capabilityTruth.unavailable != agentModel.capabilities.size.toLong() - detected ||
            capabilityTruth.selected != agentModel.capabilities.count { it.selected }.toLong() ||
            capabilityTruth.shown + capabilityTruth.omitted != capabilityTruth.total
        ) throw invalidResponse()

        val runTruthObject = truth.get("runs").requireObject()
        runTruthObject.requireExactKeys(
            "shown", "total", "omitted", "terminal", "nonTerminal", "managedObserved", "resultBound",
            "actualEffectCount", "outcomes",
        )
        val outcomeObject = runTruthObject.get("outcomes").requireObject()
        outcomeObject.requireExactKeys("satisfied", "failed", "notAssessed", "indeterminate")
        val outcomes = Phase1AgentModelOutcomeTruth(
            outcomeObject.requireBoundedNonNegativeLong("satisfied", 1_000_000),
            outcomeObject.requireBoundedNonNegativeLong("failed", 1_000_000),
            outcomeObject.requireBoundedNonNegativeLong("notAssessed", 1_000_000),
            outcomeObject.requireBoundedNonNegativeLong("indeterminate", 1_000_000),
        )
        val runTruth = Phase1AgentModelRunTruth(
            runTruthObject.requireBoundedNonNegativeLong("shown", 1_000_000),
            runTruthObject.requireBoundedNonNegativeLong("total", 1_000_000),
            runTruthObject.requireBoundedNonNegativeLong("omitted", 1_000_000),
            runTruthObject.requireBoundedNonNegativeLong("terminal", 1_000_000),
            runTruthObject.requireBoundedNonNegativeLong("nonTerminal", 1_000_000),
            runTruthObject.requireBoundedNonNegativeLong("managedObserved", 1_000_000),
            runTruthObject.requireBoundedNonNegativeLong("resultBound", 1_000_000),
            runTruthObject.requireBoundedNonNegativeLong("actualEffectCount", 1_000_000),
            outcomes,
        )
        val terminalStates = setOf("completed", "failed", "cancelled")
        val managed = agentModel.runs.map { it.managed }.filter { it.status == "observed" }
        val bound = managed.filter { it.resultStatus == "bound" }
        if (runTruth.shown != agentModel.runLimit.shown || runTruth.total != agentModel.runLimit.total ||
            runTruth.omitted != agentModel.runLimit.omitted ||
            runTruth.terminal != agentModel.runs.count { it.state in terminalStates }.toLong() ||
            runTruth.nonTerminal != agentModel.runs.count { it.state !in terminalStates }.toLong() ||
            runTruth.managedObserved != managed.size.toLong() || runTruth.resultBound != bound.size.toLong() ||
            runTruth.actualEffectCount != bound.sumOf { it.actualEffectCount ?: 0L } ||
            outcomes.satisfied != bound.count { it.outcomeStatus == "satisfied" }.toLong() ||
            outcomes.failed != bound.count { it.outcomeStatus == "failed" }.toLong() ||
            outcomes.notAssessed != bound.count { it.outcomeStatus == "not-assessed" }.toLong() ||
            outcomes.indeterminate != bound.count { it.outcomeStatus == "indeterminate" }.toLong() ||
            runTruth.shown + runTruth.omitted != runTruth.total
        ) throw invalidResponse()

        val managedRuns = parseAgentModelLimit(truth.get("managedRuns"))
        if (managedRuns != agentModel.managedRunLimit) throw invalidResponse()
        val handoffObject = truth.get("handoffs").requireObject()
        handoffObject.requireExactKeys("shown", "total", "omitted", "pendingAcknowledgement", "acknowledged")
        val handoffs = Phase1AgentModelHandoffTruth(
            handoffObject.requireBoundedNonNegativeLong("shown", 1_000_000),
            handoffObject.requireBoundedNonNegativeLong("total", 1_000_000),
            handoffObject.requireBoundedNonNegativeLong("omitted", 1_000_000),
            handoffObject.requireBoundedNonNegativeLong("pendingAcknowledgement", 1_000_000),
            handoffObject.requireBoundedNonNegativeLong("acknowledged", 1_000_000),
        )
        val acknowledged = agentModel.handoffs.count { it.state == "acknowledged" }.toLong()
        if (handoffs.shown != agentModel.handoffLimit.shown || handoffs.total != agentModel.handoffLimit.total ||
            handoffs.omitted != agentModel.handoffLimit.omitted || handoffs.acknowledged != acknowledged ||
            handoffs.pendingAcknowledgement != agentModel.handoffs.size.toLong() - acknowledged ||
            handoffs.shown + handoffs.omitted != handoffs.total
        ) throw invalidResponse()
        val metrics = truth.get("providerMetrics").requireObject()
        metrics.requireExactKeys("usage", "cost")
        if (metrics.requireString("usage") != "unavailable" || metrics.requireString("cost") != "unavailable" ||
            truth.requireString("liveProviderQuality") != "not-assessed" ||
            truth.requireString("semanticOutputQuality") != "not-assessed"
        ) throw invalidResponse()

        val freshness = dashboard.get("freshness").requireObject()
        freshness.requireExactKeys(
            "state", "selectionCapabilityState", "oldestCapabilityObservedAt", "newestCapabilityObservedAt",
            "agentModelObservedAt", "truncated", "basis",
        )
        val freshnessState = freshness.requireOneOf("state", setOf("current", "attention-required"))
        val selectionCapabilityState = freshness.requireOneOf(
            "selectionCapabilityState", setOf("current", "unselected", "stale", "migration-required", "invalid"),
        )
        if (freshnessState != agentModel.freshness.state ||
            selectionCapabilityState != agentModel.freshness.selectionCapabilityState ||
            freshness.requireInstant("oldestCapabilityObservedAt") != agentModel.freshness.oldestCapabilityObservedAt ||
            freshness.requireInstant("newestCapabilityObservedAt") != agentModel.freshness.newestCapabilityObservedAt ||
            freshness.requireInstant("agentModelObservedAt") != agentModel.observedAt ||
            freshness.requireBoolean("truncated") != agentModel.truncated ||
            freshness.requireString("basis") !=
            "exact-initiative-scoped-agent-model-snapshot-and-declared-bounded-coverage"
        ) throw invalidResponse()
        val governance = dashboard.get("governance").requireObject()
        governance.requireExactKeys(
            "providerAccountReadiness", "providerPreference", "automaticSelectionAuthority",
            "handoffAcknowledgementAuthority", "runLaunchAuthority", "effectAuthority",
            "phaseReadinessAuthority", "productOwnerAcceptance",
        )
        if (governance.requireString("providerAccountReadiness") != "not-established" ||
            governance.requireString("providerPreference") != "not-established" ||
            governance.requireString("automaticSelectionAuthority") != "not-granted" ||
            governance.requireString("handoffAcknowledgementAuthority") != "not-granted" ||
            governance.requireString("runLaunchAuthority") != "not-granted" ||
            governance.requireString("effectAuthority") != "not-granted" ||
            governance.requireString("phaseReadinessAuthority") != "not-established" ||
            governance.requireString("productOwnerAcceptance") != "not-established"
        ) throw invalidResponse()
        val observedAt = dashboard.requireInstant("observedAt")
        if (observedAt.isBefore(agentModel.observedAt)) throw invalidResponse()
        val limitations = parseChangeImpactLimitations(dashboard.get("limitations"))
        val snapshotDigest = dashboard.requireDigest("snapshotDigest")
        val digestBody = dashboard.deepCopy().apply { remove("snapshotDigest") }
        if (snapshotDigest != canonicalDigest(digestBody)) throw invalidResponse()
        return Phase1AgentModelDashboard(
            product.recordId, product.revision, product.digest,
            initiativeId, initiativeRevision, initiativeDigest, initiativeState,
            agentModel, capabilityTruth, runTruth, managedRuns, handoffs,
            freshnessState, selectionCapabilityState, "not-assessed", "not-assessed", "not-established",
            observedAt,
            "current-governed-product-initiative-capability-selection-run-handoff-and-managed-evidence-metadata-only",
            "dashboard-exposes-identities-digests-counts-statuses-times-and-redacted-selection-metadata-not-prompts-provider-output-run-content-evidence-content-personal-data-secrets-credentials-or-machine-paths",
            limitations, snapshotDigest,
        )
    }

    fun parseAgentReadinessEnvelope(envelope: JsonObject): List<AgentReadinessSnapshot> {
        val result = readResult(envelope)
        if (!result.isJsonArray || result.asJsonArray.size() !in 1..16) throw invalidResponse()
        val snapshots = result.asJsonArray.map { parseAgentReadinessSnapshot(it.requireObject()) }
            .sortedBy { it.agentLabel }
        if (snapshots.map { it.adapterId }.distinct().size != snapshots.size ||
            snapshots.map { it.agentId }.distinct().size != snapshots.size
        ) {
            throw invalidResponse()
        }
        return snapshots
    }

    fun parseAgentSelectionStateEnvelope(envelope: JsonObject): AgentSelectionState {
        val state = readResult(envelope).requireObject()
        return when (state.requireString("status")) {
            "unselected" -> {
                state.requireExactKeys("status")
                AgentSelectionState.Unselected
            }
            "selected" -> {
                state.requireExactKeys("status", "selection")
                AgentSelectionState.Selected(parseAgentSelection(state.get("selection").requireObject()))
            }
            "migration-required" -> {
                state.requireExactKeys("status", "portableCandidate")
                AgentSelectionState.MigrationRequired(parseAgentSelection(state.get("portableCandidate").requireObject()))
            }
            "invalid" -> {
                state.requireExactKeys("status")
                AgentSelectionState.Invalid
            }
            else -> throw invalidResponse()
        }
    }

    fun parseAgentSelectionEnvelope(envelope: JsonObject): AgentSelection =
        parseAgentSelection(readResult(envelope).requireObject())

    fun parseAgentRunsEnvelope(envelope: JsonObject): List<AgentRun> {
        val result = readResult(envelope)
        if (!result.isJsonArray || result.asJsonArray.size() > 512) throw invalidResponse()
        val runs = result.asJsonArray.map { parseAgentRun(it.requireObject()) }
        if (runs.map { it.id }.distinct().size != runs.size) throw invalidResponse()
        return runs.toList()
    }

    fun parseAgentHandoffEnvelope(
        envelope: JsonObject,
        expectedFromRunId: UUID,
        expectedProductId: UUID,
        expectedInitiativeId: UUID,
        expectedAdapterId: String,
        expectedAgentId: String,
        expectedModelId: String,
        expectedSettings: Map<String, PortableAgentSettingValue>,
        expectedReason: String,
        expectedCompletedWork: List<String>,
        expectedUnresolvedMatters: List<String>,
        expectedDecisions: List<String>,
        expectedEvidence: List<String>,
    ): AgentHandoff {
        val handoff = readResult(envelope).requireObject()
        handoff.requireKeys(
            required = setOf(
                "schemaVersion", "id", "productId", "initiativeId", "fromRunId", "toAgent", "reason",
                "workspaceBaseline", "completedWork", "unresolvedMatters", "decisions", "evidence",
                "capabilityDifferences", "createdAt",
            ),
            optional = setOf("acknowledgedAt"),
        )
        if (handoff.requireInt("schemaVersion") != 1) throw invalidResponse()
        val id = parseUuid(handoff.requireString("id"))
        val productId = parseUuid(handoff.requireString("productId"))
        val initiativeId = parseUuid(handoff.requireString("initiativeId"))
        val fromRunId = parseUuid(handoff.requireString("fromRunId"))
        if (listOf(id, productId, initiativeId, fromRunId).any { it == UUID(0, 0) } ||
            fromRunId != expectedFromRunId || productId != expectedProductId || initiativeId != expectedInitiativeId
        ) {
            throw invalidResponse()
        }
        val toAgent = parseAgentSelection(handoff.get("toAgent").requireObject())
        if (toAgent.adapterId != expectedAdapterId || toAgent.agentId != expectedAgentId ||
            toAgent.modelId != expectedModelId ||
            !portableSettingsEqual(toAgent.settings, expectedSettings)
        ) {
            throw invalidResponse()
        }
        val reason = portableHandoffText(handoff.requireString("reason"), minimum = 2)
        val completedWork = parseHandoffTextArray(handoff.get("completedWork"))
        val unresolvedMatters = parseHandoffTextArray(handoff.get("unresolvedMatters"))
        val decisions = parseHandoffTextArray(handoff.get("decisions"))
        val evidence = parseHandoffTextArray(handoff.get("evidence"))
        if (reason != expectedReason || completedWork != expectedCompletedWork ||
            unresolvedMatters != expectedUnresolvedMatters || decisions != expectedDecisions || evidence != expectedEvidence
        ) {
            throw invalidResponse()
        }
        return AgentHandoff(
            schemaVersion = 1,
            id = id,
            productId = productId,
            initiativeId = initiativeId,
            fromRunId = fromRunId,
            toAgent = toAgent,
            reason = reason,
            workspaceBaseline = parseHandoffWorkspaceBaseline(handoff.get("workspaceBaseline").requireObject()),
            completedWork = completedWork,
            unresolvedMatters = unresolvedMatters,
            decisions = decisions,
            evidence = evidence,
            capabilityDifferences = parseHandoffTextArray(handoff.get("capabilityDifferences")),
            createdAt = handoff.requireInstant("createdAt"),
            acknowledgedAt = handoff.get("acknowledgedAt")?.let { parseInstant(it) },
        )
    }

    fun parseManagedReadOnlyPreviewEnvelope(
        envelope: JsonObject,
        expectedCharterId: UUID,
        expectedWorkflowPlanId: UUID,
    ): ManagedReadOnlyPreview {
        val preview = readResult(envelope).requireObject()
        preview.requireExactKeys(
            "schemaVersion", "kind", "productId", "initiativeId", "charterId", "charterDigest",
            "workflowPlanId", "workflowPlanDigest", "adapterId", "agentId", "modelId", "selectionDigest",
            "strategy", "stepIds", "contextPackCount", "readScopeCount", "gates", "authorityBoundary",
            "previewDigest",
        )
        if (preview.requireInt("schemaVersion") != 1 ||
            preview.requireString("kind") != "managed-readonly-preview" ||
            preview.requireString("authorityBoundary") != MANAGED_PREVIEW_BOUNDARY
        ) {
            throw invalidResponse()
        }
        val productId = preview.requireNonEmptyUuid("productId")
        val initiativeId = preview.requireNonEmptyUuid("initiativeId")
        val charterId = preview.requireNonEmptyUuid("charterId")
        val workflowPlanId = preview.requireNonEmptyUuid("workflowPlanId")
        if (charterId != expectedCharterId || workflowPlanId != expectedWorkflowPlanId) throw invalidResponse()
        val strategy = preview.requireString("strategy").takeIf { it in setOf("sequential", "parallel-readonly") }
            ?: throw invalidResponse()
        val rawStepIds = preview.get("stepIds")
        val rawGates = preview.get("gates")
        if (rawStepIds == null || !rawStepIds.isJsonArray || rawStepIds.asJsonArray.size() !in 1..512 ||
            rawGates == null || !rawGates.isJsonArray || rawGates.asJsonArray.size() !in 2..2_050
        ) {
            throw invalidResponse()
        }
        val stepIds = rawStepIds.asJsonArray.map { parseNonEmptyUuid(it.requireString()) }.toList()
        if (stepIds.distinct().size != stepIds.size) throw invalidResponse()
        val gates = rawGates.asJsonArray.map { parseManagedReadOnlyGate(it.requireObject(), stepIds.toSet()) }.toList()
        if (gates.map { it.key }.distinct().size != gates.size) throw invalidResponse()
        val contextPackCount = preview.requireInt("contextPackCount")
        val readScopeCount = preview.requireInt("readScopeCount")
        if (contextPackCount !in 0..512 || readScopeCount !in 0..100_000) throw invalidResponse()
        val previewDigest = preview.requireDigest("previewDigest")
        val digestBody = preview.deepCopy().apply { remove("previewDigest") }
        if (previewDigest != canonicalDigest(digestBody)) throw invalidResponse()
        return ManagedReadOnlyPreview(
            schemaVersion = 1,
            kind = "managed-readonly-preview",
            productId = productId,
            initiativeId = initiativeId,
            charterId = charterId,
            charterDigest = preview.requireDigest("charterDigest"),
            workflowPlanId = workflowPlanId,
            workflowPlanDigest = preview.requireDigest("workflowPlanDigest"),
            adapterId = preview.requirePortableText("adapterId", minimum = 1),
            agentId = preview.requirePortableText("agentId", minimum = 1),
            modelId = preview.requirePortableText("modelId", minimum = 1),
            selectionDigest = preview.requireDigest("selectionDigest"),
            strategy = strategy,
            stepIds = stepIds,
            contextPackCount = contextPackCount,
            readScopeCount = readScopeCount,
            gates = gates,
            authorityBoundary = MANAGED_PREVIEW_BOUNDARY,
            previewDigest = previewDigest,
        )
    }

    fun parseManagedReadOnlyReceiptEnvelope(
        envelope: JsonObject,
        preview: ManagedReadOnlyPreview,
    ): ManagedReadOnlyReceipt {
        validateManagedReadOnlyPreview(preview)
        val receipt = readResult(envelope).requireObject()
        receipt.requireExactKeys(
            "schemaVersion", "kind", "previewDigest", "runId", "managedRunId", "productId", "initiativeId",
            "adapterId", "agentId", "modelId", "mode", "state", "providerDisposition", "outcomeStatus",
            "outcomeBasis", "eventCount", "completedStepCount", "totalStepCount", "resultDigest",
            "evidenceDigest", "warnings", "startedAt", "endedAt", "authorityBoundary",
        )
        if (receipt.requireInt("schemaVersion") != 1 ||
            receipt.requireString("kind") != "managed-readonly-receipt" ||
            receipt.requireString("authorityBoundary") != MANAGED_RECEIPT_BOUNDARY
        ) {
            throw invalidResponse()
        }
        val productId = receipt.requireNonEmptyUuid("productId")
        val initiativeId = receipt.requireNonEmptyUuid("initiativeId")
        val adapterId = receipt.requirePortableText("adapterId", minimum = 1)
        val agentId = receipt.requirePortableText("agentId", minimum = 1)
        val modelId = receipt.requirePortableText("modelId", minimum = 1)
        val previewDigest = receipt.requireDigest("previewDigest")
        if (previewDigest != preview.previewDigest || productId != preview.productId ||
            initiativeId != preview.initiativeId || adapterId != preview.adapterId ||
            agentId != preview.agentId || modelId != preview.modelId
        ) {
            throw invalidResponse()
        }
        val mode = receipt.requireOneOf("mode", setOf("codex-staged", "manual-offline", "claude-context-only"))
        val state = receipt.requireOneOf(
            "state",
            setOf("review-required", "completed", "failed", "cancelled", "timed-out", "unknown", "conflict", "discarded"),
        )
        val providerDisposition = receipt.requireOneOf(
            "providerDisposition",
            setOf("completed", "failed", "cancelled", "interrupted", "crashed", "protocol-error", "unknown"),
        )
        val outcomeStatus = receipt.requireOneOf("outcomeStatus", setOf("satisfied", "failed", "not-assessed", "indeterminate"))
        val outcomeBasis = receipt.requireOneOf(
            "outcomeBasis",
            setOf("postcondition-evaluator", "deterministic-offline-runtime", "not-evaluated", "provider-failure"),
        )
        val eventCount = receipt.requireBoundedNonNegativeInt("eventCount", 4_096)
        val completedStepCount = receipt.requireBoundedNonNegativeInt("completedStepCount", 512)
        val totalStepCount = receipt.requireBoundedNonNegativeInt("totalStepCount", 512)
        if (totalStepCount != preview.stepIds.size || completedStepCount > totalStepCount ||
            (state == "completed" && (providerDisposition != "completed" || outcomeStatus != "satisfied"))
        ) {
            throw invalidResponse()
        }
        val warningValues = setOf(
            "provider-warning-redacted", "provider-output-redacted", "coordinator-failure", "runtime-output-truncated",
            "staging-read-confinement-unattested", "postcondition-evaluator-failed", "local-cleanup-pending",
            "local-cleanup-failed", "runtime-warning",
        )
        val rawWarnings = receipt.get("warnings")
        if (rawWarnings == null || !rawWarnings.isJsonArray || rawWarnings.asJsonArray.size() > 128) throw invalidResponse()
        val warnings = rawWarnings.asJsonArray.map { it.requireString().takeIf(warningValues::contains) ?: throw invalidResponse() }
        val startedAt = receipt.requireInstant("startedAt")
        val endedAt = receipt.requireInstant("endedAt")
        if (endedAt.isBefore(startedAt)) throw invalidResponse()
        return ManagedReadOnlyReceipt(
            schemaVersion = 1,
            kind = "managed-readonly-receipt",
            previewDigest = previewDigest,
            runId = receipt.requireNonEmptyUuid("runId"),
            managedRunId = receipt.requireNonEmptyUuid("managedRunId"),
            productId = productId,
            initiativeId = initiativeId,
            adapterId = adapterId,
            agentId = agentId,
            modelId = modelId,
            mode = mode,
            state = state,
            providerDisposition = providerDisposition,
            outcomeStatus = outcomeStatus,
            outcomeBasis = outcomeBasis,
            eventCount = eventCount,
            completedStepCount = completedStepCount,
            totalStepCount = totalStepCount,
            resultDigest = receipt.requireDigest("resultDigest"),
            evidenceDigest = receipt.requireDigest("evidenceDigest"),
            warnings = warnings,
            startedAt = startedAt,
            endedAt = endedAt,
            authorityBoundary = MANAGED_RECEIPT_BOUNDARY,
        )
    }

    fun parseManagedRunSummaryPageEnvelope(
        envelope: JsonObject,
        expectedOffset: Int,
        expectedLimit: Int,
        expectedSnapshotDigest: String? = null,
        expectedTotal: Int? = null,
    ): ManagedRunSummaryPage {
        val page = readResult(envelope).requireObject()
        page.requireExactKeys(
            "schemaVersion", "kind", "items", "offset", "limit", "total", "omittedCount", "snapshotDigest",
            "hasMore", "authorityBoundary", "privacyBoundary",
        )
        if (page.requireInt("schemaVersion") != 1 || page.requireString("kind") != "managed-run-summary-page" ||
            page.requireString("authorityBoundary") != MANAGED_INVENTORY_BOUNDARY ||
            page.requireString("privacyBoundary") != MANAGED_EVIDENCE_PRIVACY_BOUNDARY
        ) {
            throw invalidResponse()
        }
        val offset = page.requireBoundedNonNegativeInt("offset", 2_000)
        val limit = page.requireBoundedNonNegativeInt("limit", 200)
        val total = page.requireBoundedNonNegativeInt("total", 2_000)
        val omittedCount = page.requireBoundedNonNegativeInt("omittedCount", 2_000)
        val rawItems = page.get("items")?.takeIf(JsonElement::isJsonArray)?.asJsonArray ?: throw invalidResponse()
        if (limit < 1 || offset != expectedOffset || limit != expectedLimit ||
            (expectedTotal != null && total != expectedTotal) || rawItems.size() > limit ||
            offset.toLong() + rawItems.size() > total.toLong() || omittedCount != total - rawItems.size()
        ) {
            throw invalidResponse()
        }
        val items = rawItems.map { parseManagedRunSummary(it.requireObject()) }.toList()
        if (items.map { it.managedRunId }.distinct().size != items.size) throw invalidResponse()
        val snapshotDigest = page.requireDigest("snapshotDigest")
        if (expectedSnapshotDigest != null && snapshotDigest != expectedSnapshotDigest) throw invalidResponse()
        val hasMore = page.requireBoolean("hasMore")
        if (hasMore != (offset.toLong() + items.size < total.toLong()) || (hasMore && items.isEmpty())) {
            throw invalidResponse()
        }
        return ManagedRunSummaryPage(
            schemaVersion = 1,
            kind = "managed-run-summary-page",
            items = items,
            offset = offset,
            limit = limit,
            total = total,
            omittedCount = omittedCount,
            snapshotDigest = snapshotDigest,
            hasMore = hasMore,
            authorityBoundary = MANAGED_INVENTORY_BOUNDARY,
            privacyBoundary = MANAGED_EVIDENCE_PRIVACY_BOUNDARY,
        )
    }

    fun parseManagedEvidenceDetailEnvelope(
        envelope: JsonObject,
        expectedManagedRunId: UUID,
    ): ManagedEvidenceDetail = parseManagedEvidenceDetail(readResult(envelope).requireObject(), expectedManagedRunId)

    fun parseManagedReviewPreviewEnvelope(
        envelope: JsonObject,
        expectedManagedRunId: UUID,
    ): ManagedReviewPreview {
        val preview = readResult(envelope).requireObject()
        preview.requireKeys(
            required = setOf(
                "schemaVersion", "kind", "managedRunId", "managedRunRevision", "runId", "productId",
                "initiativeId", "mode", "state", "canApply", "canDiscard", "hasLocalJournal", "bindingsDigest",
                "result", "staging", "postApplyGatePolicy", "authorityBoundary", "privacyBoundary",
                "cleanupBoundary", "previewDigest",
            ),
            optional = setOf("applyConfirmation"),
        )
        if (preview.requireInt("schemaVersion") != 1 || preview.requireString("kind") != "managed-review-preview" ||
            preview.requireString("mode") != "codex-staged" ||
            preview.requireString("postApplyGatePolicy") != "record-not-assessed" ||
            preview.requireString("authorityBoundary") != MANAGED_REVIEW_BOUNDARY ||
            preview.requireString("privacyBoundary") != MANAGED_REVIEW_PRIVACY_BOUNDARY ||
            preview.requireString("cleanupBoundary") != MANAGED_REVIEW_CLEANUP_BOUNDARY
        ) {
            throw invalidResponse()
        }
        val managedRunId = preview.requireNonEmptyUuid("managedRunId")
        val managedRunRevision = preview.requireLong("managedRunRevision")
        if (managedRunId != expectedManagedRunId || managedRunRevision < 1) throw invalidResponse()
        val state = preview.requireOneOf("state", setOf("review-required", "conflict"))
        val canApply = preview.requireBoolean("canApply")
        val canDiscard = preview.requireBoolean("canDiscard")
        val hasApplyConfirmation = preview.has("applyConfirmation")
        if (!canDiscard || canApply != hasApplyConfirmation || (state == "conflict" && canApply)) {
            throw invalidResponse()
        }
        val result = parseManagedReviewResult(preview.get("result").requireObject(), state)
        val staging = parseManagedReviewStaging(preview.get("staging").requireObject(), state)
        if (result.evidenceId != staging.evidenceId || result.evidenceDigest != staging.evidenceDigest) {
            throw invalidResponse()
        }
        val applyConfirmation = preview.get("applyConfirmation")?.let {
            parseManagedReviewApplyConfirmation(it.requireObject(), staging)
        }
        return ManagedReviewPreview(
            schemaVersion = 1,
            kind = "managed-review-preview",
            managedRunId = managedRunId,
            managedRunRevision = managedRunRevision,
            runId = preview.requireNonEmptyUuid("runId"),
            productId = preview.requireNonEmptyUuid("productId"),
            initiativeId = preview.requireNonEmptyUuid("initiativeId"),
            mode = "codex-staged",
            state = state,
            canApply = canApply,
            canDiscard = true,
            hasLocalJournal = preview.requireBoolean("hasLocalJournal"),
            bindingsDigest = preview.requireDigest("bindingsDigest"),
            result = result,
            staging = staging,
            applyConfirmation = applyConfirmation,
            postApplyGatePolicy = "record-not-assessed",
            authorityBoundary = MANAGED_REVIEW_BOUNDARY,
            privacyBoundary = MANAGED_REVIEW_PRIVACY_BOUNDARY,
            cleanupBoundary = MANAGED_REVIEW_CLEANUP_BOUNDARY,
            previewDigest = preview.requireDigest("previewDigest"),
        ).also(::validateManagedReviewPreview)
    }

    fun parseManagedReviewTransitionEnvelope(
        envelope: JsonObject,
        preview: ManagedReviewPreview,
        expectedDecision: String,
    ): ManagedReviewTransition {
        require(expectedDecision in setOf("apply-exact-managed-review", "discard-exact-managed-review")) {
            "Managed review decision is invalid"
        }
        validateManagedReviewPreview(preview)
        val transition = readResult(envelope).requireObject()
        transition.requireExactKeys(
            "schemaVersion", "kind", "decision", "sourcePreviewDigest", "sourceManagedRunRevision",
            "managedRunId", "managedRunRevision", "state", "canApply", "canDiscard", "hasLocalJournal", "detail",
            "authorityBoundary", "cleanupBoundary", "transitionDigest",
        )
        if (transition.requireInt("schemaVersion") != 1 ||
            transition.requireString("kind") != "managed-review-transition" ||
            transition.requireString("decision") != expectedDecision ||
            transition.requireString("authorityBoundary") != MANAGED_REVIEW_TRANSITION_BOUNDARY ||
            transition.requireString("cleanupBoundary") != MANAGED_REVIEW_CLEANUP_BOUNDARY ||
            transition.requireDigest("sourcePreviewDigest") != preview.previewDigest ||
            transition.requireLong("sourceManagedRunRevision") != preview.managedRunRevision
        ) {
            throw invalidResponse()
        }
        val managedRunId = transition.requireNonEmptyUuid("managedRunId")
        val managedRunRevision = transition.requireLong("managedRunRevision")
        if (managedRunId != preview.managedRunId || managedRunRevision <= preview.managedRunRevision) {
            throw invalidResponse()
        }
        val state = transition.requireOneOf(
            "state",
            setOf(
                "prepared", "running", "review-required", "applying", "completed", "failed", "cancelled",
                "timed-out", "unknown", "conflict", "discarded",
            ),
        )
        val canApply = transition.requireBoolean("canApply")
        val canDiscard = transition.requireBoolean("canDiscard")
        if (expectedDecision == "discard-exact-managed-review") {
            if (state != "discarded" || canApply || canDiscard) throw invalidResponse()
        } else if (state !in setOf("completed", "failed", "unknown", "conflict") || canApply ||
            canDiscard != (state == "conflict")
        ) {
            throw invalidResponse()
        }
        val detailElement = transition.get("detail").requireObject()
        val detail = parseManagedEvidenceDetail(detailElement, managedRunId)
        if (detail.summary.state != state || detail.artifactStatus != "verified-result-and-evidence" ||
            (expectedDecision == "apply-exact-managed-review" && detail.applyDecision == null)
        ) {
            throw invalidResponse()
        }
        val body = JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "managed-review-transition")
            addProperty("decision", expectedDecision)
            addProperty("sourcePreviewDigest", preview.previewDigest)
            addProperty("sourceManagedRunRevision", preview.managedRunRevision)
            addProperty("managedRunId", managedRunId.toString())
            addProperty("managedRunRevision", managedRunRevision)
            addProperty("state", state)
            addProperty("canApply", canApply)
            addProperty("canDiscard", canDiscard)
            addProperty("hasLocalJournal", transition.requireBoolean("hasLocalJournal"))
            add("detail", detailElement.deepCopy())
            addProperty("authorityBoundary", MANAGED_REVIEW_TRANSITION_BOUNDARY)
            addProperty("cleanupBoundary", MANAGED_REVIEW_CLEANUP_BOUNDARY)
        }
        val transitionDigest = transition.requireDigest("transitionDigest")
        if (transitionDigest != canonicalDigest(body)) throw invalidResponse()
        return ManagedReviewTransition(
            schemaVersion = 1,
            kind = "managed-review-transition",
            decision = expectedDecision,
            sourcePreviewDigest = preview.previewDigest,
            sourceManagedRunRevision = preview.managedRunRevision,
            managedRunId = managedRunId,
            managedRunRevision = managedRunRevision,
            state = state,
            canApply = canApply,
            canDiscard = canDiscard,
            hasLocalJournal = transition.requireBoolean("hasLocalJournal"),
            detail = detail,
            authorityBoundary = MANAGED_REVIEW_TRANSITION_BOUNDARY,
            cleanupBoundary = MANAGED_REVIEW_CLEANUP_BOUNDARY,
            transitionDigest = transitionDigest,
        )
    }

    private fun parseManagedEvidenceDetail(
        detail: JsonObject,
        expectedManagedRunId: UUID,
    ): ManagedEvidenceDetail {
        detail.requireKeys(
            required = setOf("schemaVersion", "kind", "summary", "artifactStatus", "authorityBoundary", "privacyBoundary"),
            optional = setOf("result", "evidence", "applyDecision"),
        )
        if (detail.requireInt("schemaVersion") != 1 || detail.requireString("kind") != "managed-evidence-detail" ||
            detail.requireString("authorityBoundary") != MANAGED_EVIDENCE_BOUNDARY ||
            detail.requireString("privacyBoundary") != MANAGED_EVIDENCE_PRIVACY_BOUNDARY
        ) {
            throw invalidResponse()
        }
        val summary = parseManagedRunSummary(detail.get("summary").requireObject())
        if (summary.managedRunId != expectedManagedRunId) throw invalidResponse()
        val artifactStatus = detail.requireOneOf(
            "artifactStatus",
            setOf("record-only", "verified-result-and-evidence"),
        )
        val hasResult = detail.has("result")
        val hasEvidence = detail.has("evidence")
        val hasApplyDecision = detail.has("applyDecision")
        if (hasResult != hasEvidence || hasResult != summary.hasResult || hasApplyDecision != summary.hasApplyDecision ||
            (artifactStatus == "record-only") != !hasResult
        ) {
            throw invalidResponse()
        }
        val result = detail.get("result")?.let { parseManagedEvidenceResult(it.requireObject(), summary) }
        val evidence = detail.get("evidence")?.let {
            parseManagedEvidenceProjection(it.requireObject(), result ?: throw invalidResponse())
        }
        val applyDecision = detail.get("applyDecision")?.let {
            parseManagedApplyDecisionProjection(it.requireObject(), summary)
        }
        return ManagedEvidenceDetail(
            schemaVersion = 1,
            kind = "managed-evidence-detail",
            summary = summary,
            artifactStatus = artifactStatus,
            result = result,
            evidence = evidence,
            applyDecision = applyDecision,
            authorityBoundary = MANAGED_EVIDENCE_BOUNDARY,
            privacyBoundary = MANAGED_EVIDENCE_PRIVACY_BOUNDARY,
        )
    }

    private fun parseManagedReviewResult(result: JsonObject, expectedState: String): ManagedReviewResult {
        result.requireExactKeys(
            "resultId", "resultDigest", "terminalState", "providerDisposition", "outcomeStatus", "outcomeBasis",
            "warningCodes", "evidenceId", "evidenceDigest",
        )
        val rawWarnings = result.get("warningCodes")?.takeIf(JsonElement::isJsonArray)?.asJsonArray
            ?: throw invalidResponse()
        if (rawWarnings.size() > 128) throw invalidResponse()
        val allowedWarnings = setOf(
            "provider-warning-redacted", "provider-output-redacted", "coordinator-failure", "runtime-output-truncated",
            "staging-read-confinement-unattested", "postcondition-evaluator-failed", "local-cleanup-pending",
            "local-cleanup-failed", "runtime-warning",
        )
        val warningCodes = rawWarnings.map {
            it.requireString().takeIf(allowedWarnings::contains) ?: throw invalidResponse()
        }
        return ManagedReviewResult(
            resultId = result.requireNonEmptyUuid("resultId"),
            resultDigest = result.requireDigest("resultDigest"),
            terminalState = result.requireOneOf("terminalState", setOf(expectedState)),
            providerDisposition = result.requireOneOf(
                "providerDisposition",
                setOf("completed", "failed", "cancelled", "interrupted", "crashed", "protocol-error", "unknown"),
            ),
            outcomeStatus = result.requireOneOf(
                "outcomeStatus",
                setOf("satisfied", "failed", "not-assessed", "indeterminate"),
            ),
            outcomeBasis = result.requireOneOf(
                "outcomeBasis",
                setOf("postcondition-evaluator", "deterministic-offline-runtime", "not-evaluated", "provider-failure"),
            ),
            warningCodes = warningCodes,
            evidenceId = result.requireNonEmptyUuid("evidenceId"),
            evidenceDigest = result.requireDigest("evidenceDigest"),
        )
    }

    private fun parseManagedReviewStaging(staging: JsonObject, state: String): ManagedReviewStaging {
        staging.requireExactKeys(
            "evidenceId", "evidenceDigest", "baselineDigest", "finalDigest", "applyState", "changeCount",
            "changedInventoryLimit", "omittedCount", "changedInventory", "changedInventoryDigest",
            "excludedPathCount", "excludedPathSetDigest",
        )
        val applyState = staging.requireOneOf("applyState", setOf("pending", "conflict"))
        val rawInventory = staging.get("changedInventory")?.takeIf(JsonElement::isJsonArray)?.asJsonArray
            ?: throw invalidResponse()
        if (applyState != (if (state == "review-required") "pending" else "conflict") ||
            staging.requireInt("changedInventoryLimit") != 512 || staging.requireInt("omittedCount") != 0 ||
            rawInventory.size() > 512
        ) {
            throw invalidResponse()
        }
        val changedInventory = rawInventory.map { parseManagedChangedFile(it.requireObject()) }
        if (staging.requireInt("changeCount") != changedInventory.size ||
            changedInventory.map { it.path }.distinct().size != changedInventory.size ||
            changedInventory.zipWithNext().any { (left, right) -> left.path >= right.path }
        ) {
            throw invalidResponse()
        }
        val changedInventoryDigest = staging.requireDigest("changedInventoryDigest")
        if (changedInventoryDigest != canonicalDigest(managedChangedInventoryToJson(changedInventory))) {
            throw invalidResponse()
        }
        return ManagedReviewStaging(
            evidenceId = staging.requireNonEmptyUuid("evidenceId"),
            evidenceDigest = staging.requireDigest("evidenceDigest"),
            baselineDigest = staging.requireDigest("baselineDigest"),
            finalDigest = staging.requireDigest("finalDigest"),
            applyState = applyState,
            changeCount = changedInventory.size,
            changedInventoryLimit = 512,
            omittedCount = 0,
            changedInventory = changedInventory,
            changedInventoryDigest = changedInventoryDigest,
            excludedPathCount = staging.requireBoundedNonNegativeInt("excludedPathCount", 20_000),
            excludedPathSetDigest = staging.requireDigest("excludedPathSetDigest"),
        )
    }

    private fun parseManagedChangedFile(change: JsonObject): ManagedChangedFile {
        change.requireKeys(
            required = setOf("path", "kind"),
            optional = setOf("beforeDigest", "afterDigest", "beforeSize", "afterSize", "beforeMode", "afterMode"),
        )
        val kind = change.requireOneOf("kind", setOf("added", "modified", "deleted"))
        val before = listOf("beforeDigest", "beforeSize", "beforeMode").any(change::has)
        val after = listOf("afterDigest", "afterSize", "afterMode").any(change::has)
        val completeBefore = listOf("beforeDigest", "beforeSize", "beforeMode").all(change::has)
        val completeAfter = listOf("afterDigest", "afterSize", "afterMode").all(change::has)
        if (before != completeBefore || after != completeAfter ||
            (kind == "added" && (before || !after)) ||
            (kind == "deleted" && (!before || after)) ||
            (kind == "modified" && (!before || !after))
        ) {
            throw invalidResponse()
        }
        return ManagedChangedFile(
            path = workspaceRelativePath(change.requireString("path")),
            kind = kind,
            beforeDigest = if (completeBefore) change.requireDigest("beforeDigest") else null,
            afterDigest = if (completeAfter) change.requireDigest("afterDigest") else null,
            beforeSize = if (completeBefore) {
                change.requireBoundedNonNegativeLong("beforeSize", MAX_SAFE_PRODUCT_REVISION)
            } else null,
            afterSize = if (completeAfter) {
                change.requireBoundedNonNegativeLong("afterSize", MAX_SAFE_PRODUCT_REVISION)
            } else null,
            beforeMode = if (completeBefore) change.requireBoundedNonNegativeInt("beforeMode", 0x1ff) else null,
            afterMode = if (completeAfter) change.requireBoundedNonNegativeInt("afterMode", 0x1ff) else null,
        )
    }

    private fun parseManagedReviewApplyConfirmation(
        confirmation: JsonObject,
        staging: ManagedReviewStaging,
    ): ManagedReviewApplyConfirmation {
        confirmation.requireExactKeys(
            "decision", "reviewEvidenceId", "reviewEvidenceDigest", "changedInventoryDigest", "writeEnvelope",
            "writeEnvelopeDigest",
        )
        val rawEnvelope = confirmation.get("writeEnvelope")?.takeIf(JsonElement::isJsonArray)?.asJsonArray
            ?: throw invalidResponse()
        if (confirmation.requireString("decision") != "apply-exact-reviewed-inventory" ||
            confirmation.requireNonEmptyUuid("reviewEvidenceId") != staging.evidenceId ||
            confirmation.requireDigest("reviewEvidenceDigest") != staging.evidenceDigest ||
            confirmation.requireDigest("changedInventoryDigest") != staging.changedInventoryDigest ||
            rawEnvelope.size() > 256
        ) {
            throw invalidResponse()
        }
        val writeEnvelope = rawEnvelope.map { workspaceRelativeScope(it.requireString()) }
        if (writeEnvelope.distinct().size != writeEnvelope.size ||
            writeEnvelope.zipWithNext().any { (left, right) -> left >= right }
        ) {
            throw invalidResponse()
        }
        val writeEnvelopeDigest = confirmation.requireDigest("writeEnvelopeDigest")
        if (writeEnvelopeDigest != canonicalDigest(JsonArray().apply { writeEnvelope.forEach(::add) })) {
            throw invalidResponse()
        }
        return ManagedReviewApplyConfirmation(
            decision = "apply-exact-reviewed-inventory",
            reviewEvidenceId = staging.evidenceId,
            reviewEvidenceDigest = staging.evidenceDigest,
            changedInventoryDigest = staging.changedInventoryDigest,
            writeEnvelope = writeEnvelope,
            writeEnvelopeDigest = writeEnvelopeDigest,
        )
    }

    private fun parseManagedRunSummary(summary: JsonObject): ManagedRunSummary {
        summary.requireKeys(
            required = setOf(
                "schemaVersion", "kind", "managedRunId", "runId", "productId", "initiativeId", "mode", "state",
                "adapterId", "agentId", "modelId", "attemptNumber", "recoveryStatus", "workflowCheckpointCount",
                "hasResult", "hasApplyDecision", "bindingsDigest", "createdAt", "updatedAt", "authorityBoundary",
            ),
            optional = setOf("resultDigest", "applyDecisionDigest", "startedAt", "endedAt"),
        )
        if (summary.requireInt("schemaVersion") != 1 || summary.requireString("kind") != "managed-run-summary" ||
            summary.requireString("authorityBoundary") != MANAGED_INVENTORY_BOUNDARY
        ) {
            throw invalidResponse()
        }
        val state = summary.requireOneOf(
            "state",
            setOf(
                "prepared", "running", "review-required", "applying", "completed", "failed", "cancelled",
                "timed-out", "unknown", "conflict", "discarded",
            ),
        )
        val hasResult = summary.requireBoolean("hasResult")
        val hasApplyDecision = summary.requireBoolean("hasApplyDecision")
        val resultDigest = summary.get("resultDigest")?.let { summary.requireDigest("resultDigest") }
        val applyDecisionDigest = summary.get("applyDecisionDigest")?.let { summary.requireDigest("applyDecisionDigest") }
        if (hasResult != (resultDigest != null) || hasApplyDecision != (applyDecisionDigest != null)) throw invalidResponse()
        val createdAt = summary.requireInstant("createdAt")
        val startedAt = summary.get("startedAt")?.let { summary.requireInstant("startedAt") }
        val updatedAt = summary.requireInstant("updatedAt")
        val endedAt = summary.get("endedAt")?.let { summary.requireInstant("endedAt") }
        val terminal = state in setOf("completed", "failed", "cancelled", "timed-out", "unknown", "conflict", "discarded")
        if (terminal != (endedAt != null) || updatedAt.isBefore(createdAt) ||
            (startedAt != null && startedAt.isBefore(createdAt)) ||
            (startedAt != null && endedAt != null && endedAt.isBefore(startedAt))
        ) {
            throw invalidResponse()
        }
        val attemptNumber = summary.requireInt("attemptNumber")
        if (attemptNumber !in 1..1_000_000) throw invalidResponse()
        return ManagedRunSummary(
            schemaVersion = 1,
            kind = "managed-run-summary",
            managedRunId = summary.requireNonEmptyUuid("managedRunId"),
            runId = summary.requireNonEmptyUuid("runId"),
            productId = summary.requireNonEmptyUuid("productId"),
            initiativeId = summary.requireNonEmptyUuid("initiativeId"),
            mode = summary.requireOneOf("mode", setOf("codex-staged", "manual-offline", "claude-context-only")),
            state = state,
            adapterId = summary.requirePortableText("adapterId", minimum = 1),
            agentId = summary.requirePortableText("agentId", minimum = 1),
            modelId = summary.requirePortableText("modelId", minimum = 1),
            attemptNumber = attemptNumber,
            recoveryStatus = summary.requireOneOf(
                "recoveryStatus",
                setOf("not-required", "required", "recovered", "resume-unavailable"),
            ),
            workflowCheckpointCount = summary.requireBoundedNonNegativeInt("workflowCheckpointCount", 511),
            hasResult = hasResult,
            hasApplyDecision = hasApplyDecision,
            bindingsDigest = summary.requireDigest("bindingsDigest"),
            resultDigest = resultDigest,
            applyDecisionDigest = applyDecisionDigest,
            createdAt = createdAt,
            startedAt = startedAt,
            updatedAt = updatedAt,
            endedAt = endedAt,
            authorityBoundary = MANAGED_INVENTORY_BOUNDARY,
        )
    }

    private fun parseManagedEvidenceResult(result: JsonObject, summary: ManagedRunSummary): ManagedEvidenceResult {
        result.requireExactKeys(
            "resultId", "resultDigest", "providerDisposition", "terminationCause", "outcomeStatus", "outcomeBasis",
            "terminalState", "evidenceId", "evidenceDigest", "warningCodes", "startedAt", "endedAt",
        )
        val terminalState = result.requireOneOf(
            "terminalState",
            setOf("review-required", "completed", "failed", "cancelled", "timed-out", "unknown", "conflict", "discarded"),
        )
        val providerDisposition = result.requireOneOf(
            "providerDisposition",
            setOf("completed", "failed", "cancelled", "interrupted", "crashed", "protocol-error", "unknown"),
        )
        val outcomeStatus = result.requireOneOf("outcomeStatus", setOf("satisfied", "failed", "not-assessed", "indeterminate"))
        val resultDigest = result.requireDigest("resultDigest")
        if (terminalState != summary.state || resultDigest != summary.resultDigest ||
            (terminalState == "completed" && (providerDisposition != "completed" || outcomeStatus != "satisfied"))
        ) {
            throw invalidResponse()
        }
        val warningValues = setOf(
            "provider-warning-redacted", "provider-output-redacted", "coordinator-failure", "runtime-output-truncated",
            "staging-read-confinement-unattested", "postcondition-evaluator-failed", "local-cleanup-pending",
            "local-cleanup-failed", "runtime-warning",
        )
        val rawWarnings = result.get("warningCodes")?.takeIf(JsonElement::isJsonArray)?.asJsonArray ?: throw invalidResponse()
        if (rawWarnings.size() > 128) throw invalidResponse()
        val warningCodes = rawWarnings.map { it.requireString().takeIf(warningValues::contains) ?: throw invalidResponse() }
        val startedAt = result.requireInstant("startedAt")
        val endedAt = result.requireInstant("endedAt")
        if (endedAt.isBefore(startedAt)) throw invalidResponse()
        return ManagedEvidenceResult(
            resultId = result.requireNonEmptyUuid("resultId"),
            resultDigest = resultDigest,
            providerDisposition = providerDisposition,
            terminationCause = result.requireOneOf(
                "terminationCause",
                setOf("normal", "cancel-request", "timeout", "provider-failure", "process-loss", "protocol-error"),
            ),
            outcomeStatus = outcomeStatus,
            outcomeBasis = result.requireOneOf(
                "outcomeBasis",
                setOf("postcondition-evaluator", "deterministic-offline-runtime", "not-evaluated", "provider-failure"),
            ),
            terminalState = terminalState,
            evidenceId = result.requireNonEmptyUuid("evidenceId"),
            evidenceDigest = result.requireDigest("evidenceDigest"),
            warningCodes = warningCodes,
            startedAt = startedAt,
            endedAt = endedAt,
        )
    }

    private fun parseManagedEvidenceProjection(
        evidence: JsonObject,
        result: ManagedEvidenceResult,
    ): ManagedEvidenceProjection {
        evidence.requireKeys(
            required = setOf(
                "evidenceId", "evidenceDigest", "eventCount", "eventTypeCounts", "eventsDigest", "workflowStrategy",
                "workflowStepCount", "workflowAttemptCount", "completedStepCount", "charterEvidenceStatus",
                "charterStopStatus", "terminalReasonCode", "actualEffectCounts", "capturedAt",
            ),
            optional = setOf("staging"),
        )
        val evidenceId = evidence.requireNonEmptyUuid("evidenceId")
        val evidenceDigest = evidence.requireDigest("evidenceDigest")
        if (evidenceId != result.evidenceId || evidenceDigest != result.evidenceDigest) throw invalidResponse()
        val eventCount = evidence.requireBoundedNonNegativeInt("eventCount", 4_096)
        val eventTypeCounts = parseExactCountMap(
            evidence.get("eventTypeCounts").requireObject(),
            setOf("lifecycle", "output", "item", "approval", "warning", "error"),
            4_096,
        )
        if (eventTypeCounts.values.sum() != eventCount) throw invalidResponse()
        val workflowStepCount = evidence.requireBoundedNonNegativeInt("workflowStepCount", 512)
        val completedStepCount = evidence.requireBoundedNonNegativeInt("completedStepCount", 512)
        if (workflowStepCount < 1 || completedStepCount > workflowStepCount) throw invalidResponse()
        val actualEffectCounts = parseExactCountMap(
            evidence.get("actualEffectCounts").requireObject(),
            setOf("not-observed", "observed-provisional", "applied", "blocked", "unknown"),
            32,
        )
        if (actualEffectCounts.values.sum() > 32) throw invalidResponse()
        return ManagedEvidenceProjection(
            evidenceId = evidenceId,
            evidenceDigest = evidenceDigest,
            eventCount = eventCount,
            eventTypeCounts = eventTypeCounts,
            eventsDigest = evidence.requireDigest("eventsDigest"),
            workflowStrategy = evidence.requireOneOf("workflowStrategy", setOf("sequential", "parallel-readonly")),
            workflowStepCount = workflowStepCount,
            workflowAttemptCount = evidence.requireBoundedNonNegativeInt("workflowAttemptCount", 5_120),
            completedStepCount = completedStepCount,
            charterEvidenceStatus = evidence.requireOneOf("charterEvidenceStatus", setOf("satisfied", "failed", "not-assessed")),
            charterStopStatus = evidence.requireOneOf("charterStopStatus", setOf("satisfied", "failed", "not-assessed")),
            terminalReasonCode = portableHandoffText(evidence.requireString("terminalReasonCode"), minimum = 1, maximum = 128),
            staging = evidence.get("staging")?.let { parseManagedStagingProjection(it.requireObject()) },
            actualEffectCounts = actualEffectCounts,
            capturedAt = evidence.requireInstant("capturedAt"),
        )
    }

    private fun parseManagedStagingProjection(staging: JsonObject): ManagedStagingProjection {
        staging.requireExactKeys(
            "changeCount", "excludedPathCount", "applyState", "baselineDigest", "finalDigest",
            "changedInventoryDigest", "excludedPathSetDigest",
        )
        return ManagedStagingProjection(
            changeCount = staging.requireBoundedNonNegativeInt("changeCount", 20_000),
            excludedPathCount = staging.requireBoundedNonNegativeInt("excludedPathCount", 20_000),
            applyState = staging.requireOneOf("applyState", setOf("pending", "applied", "conflict", "discarded", "not-applied")),
            baselineDigest = staging.requireDigest("baselineDigest"),
            finalDigest = staging.requireDigest("finalDigest"),
            changedInventoryDigest = staging.requireDigest("changedInventoryDigest"),
            excludedPathSetDigest = staging.requireDigest("excludedPathSetDigest"),
        )
    }

    private fun parseManagedApplyDecisionProjection(
        decision: JsonObject,
        summary: ManagedRunSummary,
    ): ManagedApplyDecisionProjection {
        decision.requireExactKeys(
            "receiptId", "receiptDigest", "managedRunRevision", "changedInventoryCount", "writeEnvelopeCount",
            "changedInventoryDigest", "writeEnvelopeDigest", "decidedAt",
        )
        val receiptDigest = decision.requireDigest("receiptDigest")
        val revision = decision.requireInt("managedRunRevision")
        if (receiptDigest != summary.applyDecisionDigest || revision < 1) throw invalidResponse()
        return ManagedApplyDecisionProjection(
            receiptId = decision.requireNonEmptyUuid("receiptId"),
            receiptDigest = receiptDigest,
            managedRunRevision = revision,
            changedInventoryCount = decision.requireBoundedNonNegativeInt("changedInventoryCount", 20_000),
            writeEnvelopeCount = decision.requireBoundedNonNegativeInt("writeEnvelopeCount", 256),
            changedInventoryDigest = decision.requireDigest("changedInventoryDigest"),
            writeEnvelopeDigest = decision.requireDigest("writeEnvelopeDigest"),
            decidedAt = decision.requireInstant("decidedAt"),
        )
    }

    private fun parseExactCountMap(value: JsonObject, keys: Set<String>, maximum: Int): Map<String, Int> {
        if (value.keySet() != keys) throw invalidResponse()
        return keys.associateWith { value.requireBoundedNonNegativeInt(it, maximum) }
    }

    fun validateManagedReadOnlyPreview(preview: ManagedReadOnlyPreview) {
        require(preview.productId != UUID(0, 0) && preview.initiativeId != UUID(0, 0) &&
            preview.charterId != UUID(0, 0) && preview.workflowPlanId != UUID(0, 0)
        ) { "Managed read-only preview identities must be non-empty UUIDs" }
        val body = managedReadOnlyPreviewBody(preview)
        require(preview.previewDigest == canonicalDigest(body)) { "Managed read-only preview digest is invalid" }
    }

    fun validateManagedReviewPreview(preview: ManagedReviewPreview) {
        val body = managedReviewPreviewBody(preview)
        require(preview.previewDigest == canonicalDigest(body)) { "Managed review preview digest is invalid" }
    }

    private fun managedReviewPreviewBody(preview: ManagedReviewPreview): JsonObject {
        require(preview.schemaVersion == 1 && preview.kind == "managed-review-preview" &&
            preview.mode == "codex-staged" && preview.state in setOf("review-required", "conflict") &&
            preview.managedRunId != UUID(0, 0) && preview.managedRunRevision >= 1 && preview.runId != UUID(0, 0) &&
            preview.productId != UUID(0, 0) && preview.initiativeId != UUID(0, 0)
        ) { "Managed review preview identity is invalid" }
        require(preview.canDiscard && preview.canApply == (preview.applyConfirmation != null) &&
            !(preview.state == "conflict" && preview.canApply)
        ) { "Managed review actions are invalid" }
        require(digestPattern.matches(preview.bindingsDigest) && digestPattern.matches(preview.previewDigest) &&
            preview.postApplyGatePolicy == "record-not-assessed" && preview.authorityBoundary == MANAGED_REVIEW_BOUNDARY &&
            preview.privacyBoundary == MANAGED_REVIEW_PRIVACY_BOUNDARY &&
            preview.cleanupBoundary == MANAGED_REVIEW_CLEANUP_BOUNDARY
        ) { "Managed review boundaries are invalid" }

        val result = preview.result
        require(result.resultId != UUID(0, 0) && result.evidenceId != UUID(0, 0) &&
            digestPattern.matches(result.resultDigest) && digestPattern.matches(result.evidenceDigest) &&
            result.terminalState == preview.state &&
            result.providerDisposition in setOf(
                "completed", "failed", "cancelled", "interrupted", "crashed", "protocol-error", "unknown",
            ) && result.outcomeStatus in setOf("satisfied", "failed", "not-assessed", "indeterminate") &&
            result.outcomeBasis in setOf(
                "postcondition-evaluator", "deterministic-offline-runtime", "not-evaluated", "provider-failure",
            ) && result.warningCodes.size <= 128 && result.warningCodes.all {
                it in setOf(
                    "provider-warning-redacted", "provider-output-redacted", "coordinator-failure",
                    "runtime-output-truncated", "staging-read-confinement-unattested",
                    "postcondition-evaluator-failed", "local-cleanup-pending", "local-cleanup-failed", "runtime-warning",
                )
            }
        ) { "Managed review result is invalid" }

        val staging = preview.staging
        require(staging.evidenceId == result.evidenceId && staging.evidenceDigest == result.evidenceDigest &&
            digestPattern.matches(staging.baselineDigest) && digestPattern.matches(staging.finalDigest) &&
            staging.applyState == (if (preview.state == "review-required") "pending" else "conflict") &&
            staging.changeCount == staging.changedInventory.size && staging.changedInventoryLimit == 512 &&
            staging.omittedCount == 0 && staging.changedInventory.size <= 512 &&
            staging.changedInventory.map { it.path }.distinct().size == staging.changedInventory.size &&
            staging.changedInventory.zipWithNext().none { (left, right) -> left.path >= right.path } &&
            staging.excludedPathCount in 0..20_000 && digestPattern.matches(staging.excludedPathSetDigest)
        ) { "Managed review staging is invalid" }
        val inventory = managedChangedInventoryToJson(staging.changedInventory)
        require(staging.changedInventoryDigest == canonicalDigest(inventory)) {
            "Managed review changed inventory digest is invalid"
        }

        val resultJson = JsonObject().apply {
            addProperty("resultId", result.resultId.toString())
            addProperty("resultDigest", result.resultDigest)
            addProperty("terminalState", result.terminalState)
            addProperty("providerDisposition", result.providerDisposition)
            addProperty("outcomeStatus", result.outcomeStatus)
            addProperty("outcomeBasis", result.outcomeBasis)
            add("warningCodes", JsonArray().apply { result.warningCodes.forEach(::add) })
            addProperty("evidenceId", result.evidenceId.toString())
            addProperty("evidenceDigest", result.evidenceDigest)
        }
        val stagingJson = JsonObject().apply {
            addProperty("evidenceId", staging.evidenceId.toString())
            addProperty("evidenceDigest", staging.evidenceDigest)
            addProperty("baselineDigest", staging.baselineDigest)
            addProperty("finalDigest", staging.finalDigest)
            addProperty("applyState", staging.applyState)
            addProperty("changeCount", staging.changeCount)
            addProperty("changedInventoryLimit", 512)
            addProperty("omittedCount", 0)
            add("changedInventory", inventory)
            addProperty("changedInventoryDigest", staging.changedInventoryDigest)
            addProperty("excludedPathCount", staging.excludedPathCount)
            addProperty("excludedPathSetDigest", staging.excludedPathSetDigest)
        }
        val applyConfirmationJson = preview.applyConfirmation?.let { confirmation ->
            require(confirmation.decision == "apply-exact-reviewed-inventory" &&
                confirmation.reviewEvidenceId == staging.evidenceId &&
                confirmation.reviewEvidenceDigest == staging.evidenceDigest &&
                confirmation.changedInventoryDigest == staging.changedInventoryDigest &&
                confirmation.writeEnvelope.size <= 256 &&
                confirmation.writeEnvelope.distinct().size == confirmation.writeEnvelope.size &&
                confirmation.writeEnvelope.zipWithNext().none { (left, right) -> left >= right }
            ) { "Managed review apply confirmation is invalid" }
            val envelope = JsonArray().apply {
                confirmation.writeEnvelope.forEach { add(workspaceRelativeScope(it)) }
            }
            require(confirmation.writeEnvelopeDigest == canonicalDigest(envelope)) {
                "Managed review write envelope digest is invalid"
            }
            JsonObject().apply {
                addProperty("decision", "apply-exact-reviewed-inventory")
                addProperty("reviewEvidenceId", confirmation.reviewEvidenceId.toString())
                addProperty("reviewEvidenceDigest", confirmation.reviewEvidenceDigest)
                addProperty("changedInventoryDigest", confirmation.changedInventoryDigest)
                add("writeEnvelope", envelope)
                addProperty("writeEnvelopeDigest", confirmation.writeEnvelopeDigest)
            }
        }
        return JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "managed-review-preview")
            addProperty("managedRunId", preview.managedRunId.toString())
            addProperty("managedRunRevision", preview.managedRunRevision)
            addProperty("runId", preview.runId.toString())
            addProperty("productId", preview.productId.toString())
            addProperty("initiativeId", preview.initiativeId.toString())
            addProperty("mode", "codex-staged")
            addProperty("state", preview.state)
            addProperty("canApply", preview.canApply)
            addProperty("canDiscard", true)
            addProperty("hasLocalJournal", preview.hasLocalJournal)
            addProperty("bindingsDigest", preview.bindingsDigest)
            add("result", resultJson)
            add("staging", stagingJson)
            applyConfirmationJson?.let { add("applyConfirmation", it) }
            addProperty("postApplyGatePolicy", "record-not-assessed")
            addProperty("authorityBoundary", MANAGED_REVIEW_BOUNDARY)
            addProperty("privacyBoundary", MANAGED_REVIEW_PRIVACY_BOUNDARY)
            addProperty("cleanupBoundary", MANAGED_REVIEW_CLEANUP_BOUNDARY)
        }
    }

    private fun managedChangedInventoryToJson(changes: List<ManagedChangedFile>): JsonArray = JsonArray().apply {
        changes.forEach { change ->
            require(change.path == workspaceRelativePath(change.path) && change.kind in setOf("added", "modified", "deleted")) {
                "Managed changed-file identity is invalid"
            }
            val hasBefore = change.beforeDigest != null || change.beforeSize != null || change.beforeMode != null
            val hasAfter = change.afterDigest != null || change.afterSize != null || change.afterMode != null
            val completeBefore = change.beforeDigest != null && change.beforeSize != null && change.beforeMode != null
            val completeAfter = change.afterDigest != null && change.afterSize != null && change.afterMode != null
            require(hasBefore == completeBefore && hasAfter == completeAfter &&
                !(change.kind == "added" && (hasBefore || !hasAfter)) &&
                !(change.kind == "deleted" && (!hasBefore || hasAfter)) &&
                !(change.kind == "modified" && (!hasBefore || !hasAfter)) &&
                (!completeBefore || (
                    digestPattern.matches(change.beforeDigest!!) && change.beforeSize!! in 0..MAX_SAFE_PRODUCT_REVISION &&
                        change.beforeMode!! in 0..0x1ff
                    )) &&
                (!completeAfter || (
                    digestPattern.matches(change.afterDigest!!) && change.afterSize!! in 0..MAX_SAFE_PRODUCT_REVISION &&
                        change.afterMode!! in 0..0x1ff
                    ))
            ) { "Managed changed-file metadata is invalid" }
            add(JsonObject().apply {
                addProperty("path", change.path)
                addProperty("kind", change.kind)
                if (completeBefore) {
                    addProperty("beforeDigest", change.beforeDigest)
                    addProperty("beforeSize", change.beforeSize)
                    addProperty("beforeMode", change.beforeMode)
                }
                if (completeAfter) {
                    addProperty("afterDigest", change.afterDigest)
                    addProperty("afterSize", change.afterSize)
                    addProperty("afterMode", change.afterMode)
                }
            })
        }
    }

    private fun parseManagedReadOnlyGate(gate: JsonObject, stepIds: Set<UUID>): ManagedReadOnlyGatePreview {
        gate.requireKeys(
            required = setOf("key", "phase", "criteria", "criteriaDigest"),
            optional = setOf("stepId"),
        )
        val phase = gate.requireOneOf(
            "phase",
            setOf("preconditions", "outputs", "evidence", "stop-conditions", "charter-evidence", "charter-stop-conditions"),
        )
        val stepId = gate.get("stepId")?.let { parseNonEmptyUuid(it.requireString()) }
        val charterGate = phase == "charter-evidence" || phase == "charter-stop-conditions"
        if (charterGate == (stepId != null) || (stepId != null && stepId !in stepIds)) throw invalidResponse()
        val rawCriteria = gate.get("criteria")
        if (rawCriteria == null || !rawCriteria.isJsonArray || rawCriteria.asJsonArray.size() > 256) throw invalidResponse()
        val criteria = rawCriteria.asJsonArray.map {
            portableHandoffText(it.requireString(), minimum = 1, maximum = 2_000)
        }.toList()
        val criteriaDigest = gate.requireDigest("criteriaDigest")
        if (criteriaDigest != canonicalDigest(rawCriteria)) throw invalidResponse()
        return ManagedReadOnlyGatePreview(
            key = portableHandoffText(gate.requireString("key"), minimum = 1, maximum = 500),
            stepId = stepId,
            phase = phase,
            criteria = criteria,
            criteriaDigest = criteriaDigest,
        )
    }

    fun parsePageEnvelope(envelope: JsonObject, expectedOffset: Int, expectedLimit: Int): PortableDesignSnapshotPage {
        val page = readResult(envelope).requireObject()
        page.requireExactKeys("items", "offset", "limit", "total", "hasMore", "governanceBoundary", "privacyBoundary")
        val offset = page.requireInt("offset")
        val limit = page.requireInt("limit")
        val total = page.requireInt("total")
        val hasMore = page.requireBoolean("hasMore")
        val itemsElement = page.get("items")
        if (!itemsElement.isJsonArray) throw invalidResponse()
        val rawItems = itemsElement.asJsonArray
        if (offset != expectedOffset || limit != expectedLimit || offset !in 0..MAX_OFFSET ||
            limit !in 1..MAX_PAGE_SIZE || total < 0 || rawItems.size() > limit || rawItems.size() > MAX_PAGE_SIZE ||
            (rawItems.size() > 0 && offset.toLong() + rawItems.size() > total.toLong()) ||
            hasMore != (offset.toLong() + rawItems.size() < total.toLong()) ||
            page.requireString("governanceBoundary") != PAGE_GOVERNANCE_BOUNDARY ||
            page.requireString("privacyBoundary") != PAGE_PRIVACY_BOUNDARY
        ) {
            throw invalidResponse()
        }
        val items = rawItems.map { parseSnapshot(it.requireObject()) }
        if (items.map { it.bundleId }.distinct().size != items.size) throw invalidResponse()
        return PortableDesignSnapshotPage(
            items = items.toList(),
            offset = offset,
            limit = limit,
            total = total,
            hasMore = hasMore,
            governanceBoundary = PAGE_GOVERNANCE_BOUNDARY,
            privacyBoundary = PAGE_PRIVACY_BOUNDARY,
        )
    }

    fun invalidResponse(): GaepHostException = GaepHostException(
        -32_603,
        "HOST_RESPONSE_INVALID",
        "The GAEP engine returned a local response that could not be verified.",
    )

    fun hostUnavailable(): GaepHostException = GaepHostException(
        -32_603,
        "HOST_UNAVAILABLE",
        "The GAEP engine host could not complete the request.",
    )

    fun productContextChanged(): GaepHostException = GaepHostException(
        -32_031,
        "PORTABLE_DESIGN_PRODUCT_CONTEXT_CHANGED",
        "The portable design request no longer matches the exact Product revision.",
    )

    private fun readResult(envelope: JsonObject): JsonElement {
        if (envelope.requireString("jsonrpc") != "2.0") throw invalidResponse()
        if (envelope.has("error")) {
            envelope.requireExactKeys("jsonrpc", "id", "error")
            throw parseHostError(envelope.get("error").requireObject())
        }
        envelope.requireExactKeys("jsonrpc", "id", "result")
        return envelope.get("result") ?: throw invalidResponse()
    }

    private fun parseHostError(error: JsonObject): GaepHostException {
        error.requireExactKeys("code", "message", "data")
        val code = error.requireInt("code")
        error.requireString("message")
        val data = error.get("data").requireObject()
        if (!data.keySet().all { it == "kind" || it == "detail" } || !data.has("kind")) throw invalidResponse()
        val kind = data.requireString("kind")
        val stable = stableHostErrors[kind]
            ?: return GaepHostException(-32_603, "HOST_ERROR", "The GAEP engine could not complete the request.")
        if (code != stable.code) throw invalidResponse()
        return GaepHostException(stable.code, kind, stable.message)
    }

    private fun parseSnapshot(snapshot: JsonObject): PortableDesignSnapshotSummary {
        snapshot.requireKeys(
            required = setOf(
                "schemaVersion",
                "kind",
                "bundleId",
                "productId",
                "title",
                "classification",
                "governance",
                "sourceReview",
                "source",
                "counts",
                "digests",
                "timestamps",
                "privacyBoundary",
            ),
            optional = setOf("initiativeId"),
        )
        if (snapshot.requireInt("schemaVersion") != 1 || snapshot.requireString("kind") != SUMMARY_KIND) {
            throw invalidResponse()
        }
        val bundleId = parseUuid(snapshot.requireString("bundleId"))
        val productId = parseUuid(snapshot.requireString("productId"))
        val initiativeId = snapshot.get("initiativeId")?.let { parseUuid(it.requireString()) }
        if (bundleId == UUID(0, 0) || productId == UUID(0, 0) || initiativeId == UUID(0, 0)) throw invalidResponse()
        val title = snapshot.requireString("title")
        if (title.length !in 2..240 || title != title.trim() || title.any(Char::isISOControl)) throw invalidResponse()
        val classification = when (snapshot.requireString("classification")) {
            "public" -> PortableDesignClassification.PUBLIC
            "internal" -> PortableDesignClassification.INTERNAL
            "confidential" -> PortableDesignClassification.CONFIDENTIAL
            "restricted" -> PortableDesignClassification.RESTRICTED
            else -> throw invalidResponse()
        }

        val governance = snapshot.get("governance").requireObject()
        governance.requireExactKeys("state", "humanReviewRequired", "claimBoundary", "nonEscalation")
        if (governance.requireString("state") != GOVERNANCE_STATE ||
            !governance.requireBoolean("humanReviewRequired") ||
            governance.requireString("claimBoundary") != CLAIM_BOUNDARY ||
            governance.requireString("nonEscalation") != NON_ESCALATION
        ) {
            throw invalidResponse()
        }

        val sourceReview = snapshot.get("sourceReview").requireObject()
        sourceReview.requireExactKeys("status", "claimLabel", "gaepApproval")
        val rawReviewStatus = sourceReview.requireString("status")
        val reviewStatus = when (rawReviewStatus) {
            "unreviewed" -> PortableDesignSourceReviewStatus.UNREVIEWED
            "reviewed" -> PortableDesignSourceReviewStatus.REVIEWED
            "approved" -> PortableDesignSourceReviewStatus.APPROVED
            else -> throw invalidResponse()
        }
        val claimLabel = "$rawReviewStatus upstream claim; not GAEP approval, a Design Baseline, implementation readiness, or release readiness"
        if (sourceReview.requireString("claimLabel") != claimLabel || sourceReview.requireBoolean("gaepApproval")) {
            throw invalidResponse()
        }

        val source = snapshot.get("source").requireObject()
        source.requireExactKeys("tool", "exportMethod")
        val tool = source.requireString("tool")
        if (tool.length !in 1..80 || !toolPattern.matches(tool)) throw invalidResponse()
        val exportMethod = when (source.requireString("exportMethod")) {
            "manual-export" -> PortableDesignExportMethod.MANUAL_EXPORT
            "design-tool-export" -> PortableDesignExportMethod.DESIGN_TOOL_EXPORT
            "plugin-export" -> PortableDesignExportMethod.PLUGIN_EXPORT
            else -> throw invalidResponse()
        }

        val counts = snapshot.get("counts").requireObject()
        counts.requireExactKeys("artifacts", "normalizedDesignTokens", "validationChecks", "recordedLimitations")
        val artifactCount = counts.requireInt("artifacts")
        val tokenCount = counts.requireInt("normalizedDesignTokens")
        val validationChecks = counts.requireInt("validationChecks")
        val recordedLimitations = counts.requireInt("recordedLimitations")
        if (artifactCount !in 1..512 || tokenCount !in 0..5_000 || validationChecks != 6 || recordedLimitations !in 1..32) {
            throw invalidResponse()
        }

        val digests = snapshot.get("digests").requireObject()
        digests.requireExactKeys("snapshot", "evidence", "manifest", "artifactInventory")
        val snapshotDigest = digests.requireDigest("snapshot")
        val evidenceDigest = digests.requireDigest("evidence")
        val manifestDigest = digests.requireDigest("manifest")
        val artifactInventoryDigest = digests.requireDigest("artifactInventory")

        val timestamps = snapshot.get("timestamps").requireObject()
        timestamps.requireExactKeys("sourceExportedAt", "importedAt")
        val sourceExportedAt = timestamps.requireInstant("sourceExportedAt")
        val importedAt = timestamps.requireInstant("importedAt")
        if (snapshot.requireString("privacyBoundary") != SUMMARY_PRIVACY_BOUNDARY) throw invalidResponse()

        return PortableDesignSnapshotSummary(
            schemaVersion = 1,
            kind = SUMMARY_KIND,
            bundleId = bundleId,
            productId = productId,
            initiativeId = initiativeId,
            title = title,
            classification = classification,
            governance = PortableDesignGovernanceMetadata(GOVERNANCE_STATE, true, CLAIM_BOUNDARY, NON_ESCALATION),
            sourceReview = PortableDesignSourceReviewMetadata(reviewStatus, claimLabel, false),
            source = PortableDesignSourceMetadata(tool, exportMethod),
            counts = PortableDesignCounts(artifactCount, tokenCount, validationChecks, recordedLimitations),
            digests = PortableDesignDigests(snapshotDigest, evidenceDigest, manifestDigest, artifactInventoryDigest),
            timestamps = PortableDesignTimestamps(sourceExportedAt, importedAt),
            privacyBoundary = SUMMARY_PRIVACY_BOUNDARY,
        )
    }

    private fun parseAgentReadinessSnapshot(snapshot: JsonObject): AgentReadinessSnapshot {
        snapshot.requireKeys(
            required = setOf(
                "schemaVersion", "adapterId", "adapterVersion", "agentId", "agentLabel", "detected",
                "executionInterface", "interfaceMaturity", "supportsResume", "supportsCancel",
                "supportsCheckpoints", "supportsModelDiscovery", "supportsToolSelection", "settings", "models",
                "limitations", "observedAt",
            ),
            optional = setOf("runtimeVersion"),
        )
        if (snapshot.requireInt("schemaVersion") != 1) throw invalidResponse()
        val settings = snapshot.get("settings")?.takeIf(JsonElement::isJsonArray)?.asJsonArray ?: throw invalidResponse()
        val models = snapshot.get("models")?.takeIf(JsonElement::isJsonArray)?.asJsonArray ?: throw invalidResponse()
        val limitations = snapshot.get("limitations")?.takeIf(JsonElement::isJsonArray)?.asJsonArray ?: throw invalidResponse()
        if (settings.size() > 256 || models.size() > 512 || limitations.size() > 512) throw invalidResponse()
        val parsedSettings = settings.map { parseAgentSetting(it.requireObject()) }
        if (parsedSettings.map { it.key }.distinct().size != parsedSettings.size) throw invalidResponse()
        val parsedModels = models.map { parseAgentModel(it.requireObject()) }
        if (parsedModels.map { it.id }.distinct().size != parsedModels.size) throw invalidResponse()
        return AgentReadinessSnapshot(
            schemaVersion = 1,
            adapterId = snapshot.requirePortableText("adapterId", minimum = 1),
            adapterVersion = snapshot.requirePortableText("adapterVersion", minimum = 1),
            agentId = snapshot.requirePortableText("agentId", minimum = 1),
            agentLabel = snapshot.requirePortableText("agentLabel", minimum = 1),
            runtimeVersion = snapshot.get("runtimeVersion")?.let { portableText(it.requireString()) },
            detected = snapshot.requireBoolean("detected"),
            executionInterface = snapshot.requireString("executionInterface").takeIf {
                it in setOf("cli-jsonl", "cli-stream-json", "stdio-rpc", "managed-in-process", "unavailable")
            } ?: throw invalidResponse(),
            interfaceMaturity = snapshot.requireString("interfaceMaturity").takeIf {
                it in setOf("stable", "beta", "experimental", "unknown")
            } ?: throw invalidResponse(),
            supportsResume = snapshot.requireBoolean("supportsResume"),
            supportsCancel = snapshot.requireBoolean("supportsCancel"),
            supportsCheckpoints = snapshot.requireBoolean("supportsCheckpoints"),
            supportsModelDiscovery = snapshot.requireBoolean("supportsModelDiscovery"),
            supportsToolSelection = snapshot.requireBoolean("supportsToolSelection"),
            settingsCount = settings.size(),
            settings = parsedSettings,
            models = parsedModels,
            limitations = limitations.map { portableText(it.requireString()) },
            observedAt = snapshot.requireInstant("observedAt"),
            capabilityDigest = canonicalDigest(snapshot),
        )
    }

    private fun parseAgentModel(model: JsonObject): AgentModelReadiness {
        model.requireKeys(
            required = setOf("id", "label", "reasoningOptions", "inputModalities", "truthClass", "alias"),
            optional = setOf("description", "contextWindow"),
        )
        model.get("description")?.let { portableText(it.requireString()) }
        model.get("contextWindow")?.let {
            if (!it.isJsonPrimitive || !it.asJsonPrimitive.isNumber || it.asBigDecimal <= BigDecimal.ZERO ||
                runCatching { it.asBigDecimal.toBigIntegerExact().longValueExact() }.isFailure
            ) {
                throw invalidResponse()
            }
        }
        validatePortableTextArray(model.get("reasoningOptions"), 64)
        validatePortableTextArray(model.get("inputModalities"), 32)
        return AgentModelReadiness(
            id = model.requirePortableText("id", minimum = 1),
            label = model.requirePortableText("label", minimum = 1),
            truthClass = model.requireTruthClass("truthClass"),
            alias = model.requireBoolean("alias"),
        )
    }

    private fun parseAgentSetting(setting: JsonObject): AgentSelectionSetting {
        setting.requireKeys(
            required = setOf("key", "label", "description", "kind", "required", "sensitive", "truthClass"),
            optional = setOf("defaultValue", "options", "minimum", "maximum"),
        )
        val key = setting.requireString("key")
        if (!settingKeyPattern.matches(key)) throw invalidResponse()
        val label = setting.requirePortableText("label", minimum = 1)
        val description = setting.requirePortableText("description", minimum = 1)
        val kind = setting.requireString("kind")
        if (kind !in setOf("select", "boolean", "number", "string", "string-list")) {
            throw invalidResponse()
        }
        val required = setting.requireBoolean("required")
        val sensitive = setting.requireBoolean("sensitive")
        val truthClass = setting.requireTruthClass("truthClass")
        val defaultValue = setting.get("defaultValue")?.let {
            if (sensitive) throw invalidResponse()
            parsePortableSettingValue(it)
        }
        val options = setting.get("options")?.let { rawOptions ->
            if (!rawOptions.isJsonArray || rawOptions.asJsonArray.size() > 256) throw invalidResponse()
            rawOptions.asJsonArray.map { rawOption ->
                val option = rawOption.requireObject()
                option.requireKeys(setOf("value", "label"), setOf("description"))
                AgentSettingOption(
                    value = option.requirePortableText("value"),
                    label = option.requirePortableText("label"),
                    description = option.get("description")?.let { portableText(it.requireString()) },
                )
            }.toList()
        }
        val minimum = setting.get("minimum")?.let { parseFiniteDecimal(it) }
        val maximum = setting.get("maximum")?.let { parseFiniteDecimal(it) }
        if (minimum != null && maximum != null && minimum > maximum) throw invalidResponse()
        return AgentSelectionSetting(
            key = key,
            label = label,
            description = description,
            kind = kind,
            required = required,
            sensitive = sensitive,
            defaultValue = defaultValue,
            options = options,
            minimum = minimum,
            maximum = maximum,
            truthClass = truthClass,
        )
    }

    private fun parseAgentSelection(selection: JsonObject): AgentSelection {
        selection.requireExactKeys(
            "schemaVersion", "adapterId", "agentId", "modelId", "modelTruthClass", "modelAlias", "settings",
            "selectedAt", "capabilityDigest",
        )
        if (selection.requireInt("schemaVersion") != 2) throw invalidResponse()
        val rawAlias = selection.get("modelAlias") ?: throw invalidResponse()
        val modelAlias = when {
            rawAlias.isJsonNull -> null
            rawAlias.isJsonPrimitive && rawAlias.asJsonPrimitive.isBoolean -> rawAlias.asBoolean
            else -> throw invalidResponse()
        }
        return AgentSelection(
            schemaVersion = 2,
            adapterId = selection.requirePortableText("adapterId", minimum = 1),
            agentId = selection.requirePortableText("agentId", minimum = 1),
            modelId = selection.requirePortableText("modelId", minimum = 1),
            modelTruthClass = selection.requireTruthClass("modelTruthClass"),
            modelAlias = modelAlias,
            settings = parsePortableSelectionSettings(selection.get("settings").requireObject()),
            selectedAt = selection.requireInstant("selectedAt"),
            capabilityDigest = selection.requireDigest("capabilityDigest"),
            selectionDigest = canonicalDigest(selection),
        )
    }

    private fun parseAgentRun(run: JsonObject): AgentRun {
        run.requireKeys(
            required = setOf("schemaVersion", "id", "charterId", "productId", "initiativeId", "agent", "state"),
            optional = setOf(
                "revision", "charterDigest", "providerSessionRef", "startedAt", "endedAt", "previousRunId",
            ),
        )
        if (run.requireInt("schemaVersion") != 1) throw invalidResponse()
        val id = parseUuid(run.requireString("id"))
        val charterId = parseUuid(run.requireString("charterId"))
        val productId = parseUuid(run.requireString("productId"))
        val initiativeId = parseUuid(run.requireString("initiativeId"))
        if (listOf(id, charterId, productId, initiativeId).any { it == UUID(0, 0) }) throw invalidResponse()
        val revision = run.get("revision")?.let {
            run.requireLong("revision").also { value -> if (value < 1) throw invalidResponse() }
        }
        val state = when (run.requireString("state")) {
            "prepared" -> AgentRunState.PREPARED
            "running" -> AgentRunState.RUNNING
            "paused" -> AgentRunState.PAUSED
            "completed" -> AgentRunState.COMPLETED
            "failed" -> AgentRunState.FAILED
            "cancelled" -> AgentRunState.CANCELLED
            "unknown" -> AgentRunState.UNKNOWN
            else -> throw invalidResponse()
        }
        val previousRunId = run.get("previousRunId")?.let { parseUuid(it.requireString()) }
        if (previousRunId == UUID(0, 0)) throw invalidResponse()
        return AgentRun(
            schemaVersion = 1,
            id = id,
            revision = revision,
            charterId = charterId,
            charterDigest = run.get("charterDigest")?.let { run.requireDigest("charterDigest") },
            productId = productId,
            initiativeId = initiativeId,
            agent = parseAgentSelection(run.get("agent").requireObject()),
            state = state,
            providerSessionRef = run.get("providerSessionRef")?.let { run.requireDigest("providerSessionRef") },
            startedAt = run.get("startedAt")?.let { parseInstant(it) },
            endedAt = run.get("endedAt")?.let { parseInstant(it) },
            previousRunId = previousRunId,
        )
    }

    private fun parseHandoffWorkspaceBaseline(baseline: JsonObject): HandoffWorkspaceBaseline {
        baseline.requireKeys(
            required = setOf("dirty", "changedFiles"),
            optional = setOf("gitHead", "truthClass", "observationError"),
        )
        val gitHead = baseline.get("gitHead")?.let {
            it.requireString().takeIf { value -> Regex("^[0-9a-fA-F]{7,64}$").matches(value) }
                ?: throw invalidResponse()
        }
        val dirtyElement = baseline.get("dirty") ?: throw invalidResponse()
        val dirty = when {
            dirtyElement.isJsonNull -> null
            dirtyElement.isJsonPrimitive && dirtyElement.asJsonPrimitive.isBoolean -> dirtyElement.asBoolean
            else -> throw invalidResponse()
        }
        val changedFilesElement = baseline.get("changedFiles")
        if (changedFilesElement == null || !changedFilesElement.isJsonArray ||
            changedFilesElement.asJsonArray.size() > 20_000
        ) {
            throw invalidResponse()
        }
        val changedFiles = changedFilesElement.asJsonArray.map { workspaceRelativePath(it.requireString()) }
        if (changedFiles.distinct().size != changedFiles.size) throw invalidResponse()
        return HandoffWorkspaceBaseline(
            gitHead = gitHead,
            dirty = dirty,
            changedFiles = changedFiles.toList(),
            truthClass = baseline.get("truthClass")?.let { baseline.requireTruthClass("truthClass") },
            observationError = baseline.get("observationError")?.let {
                portableHandoffText(it.requireString(), minimum = 1, maximum = 500)
            },
        )
    }

    private fun parseHandoffTextArray(value: JsonElement?): List<String> {
        if (value == null || !value.isJsonArray || value.asJsonArray.size() > 512) throw invalidResponse()
        return value.asJsonArray.map { portableHandoffText(it.requireString(), minimum = 1) }.toList()
    }

    private fun portableHandoffText(value: String, minimum: Int, maximum: Int = 5_000): String {
        if (value.length !in minimum..maximum || value != value.trim() || value.any(Char::isISOControl) ||
            handoffPathPattern.containsMatchIn(value) || secretPattern.containsMatchIn(value)
        ) {
            throw invalidResponse()
        }
        return value
    }

    private fun workspaceRelativePath(value: String): String {
        val segments = value.split('/')
        if (value.length !in 1..4_096 || value == "." || value.startsWith('/') ||
            Regex("^[A-Za-z]:").containsMatchIn(value) || value.startsWith('~') || '\\' in value || '\u0000' in value ||
            Regex("%2e", RegexOption.IGNORE_CASE).containsMatchIn(value) ||
            segments.any { it.isEmpty() || it == "." || it == ".." }
        ) {
            throw invalidResponse()
        }
        return value
    }

    private fun initiativeSourceToJson(source: InitiativeEntrySource): JsonObject = JsonObject().apply {
        addProperty("kind", source.kind)
        addProperty("reference", source.reference)
        source.digest?.let { addProperty("digest", it) }
    }

    private fun initiativeSubjectToJson(subject: InitiativeApplicabilitySubject): JsonObject = JsonObject().apply {
        addProperty("type", subject.type)
        addProperty("key", subject.key)
        addProperty("label", subject.label)
    }

    private fun validateInitiativeClassificationInput(input: JsonObject) {
        input.requireExactKeys(
            "primaryType", "secondaryTypes", "systemState", "changePosture", "motivations", "characteristics",
            "regulated", "policyDomains", "sensitivities", "expectedLifetime", "maintenanceHorizon", "risk",
            "dependencies", "affectedAssets", "owner", "accountableAuthority", "confidence", "evidence",
            "unresolvedQuestions", "rationale",
        )
        val primaryType = input.requireOneOf("primaryType", initiativeTypes)
        val secondaryTypes = initiativeStringArray(input.get("secondaryTypes"), 0, 29, initiativeTypes)
        if (secondaryTypes.distinct().size != secondaryTypes.size || primaryType in secondaryTypes) throw invalidResponse()
        input.requireOneOf("systemState", setOf("greenfield", "brownfield", "mixed", "unknown"))
        input.requireOneOf(
            "changePosture",
            setOf("new", "existing", "replacement", "modernization", "migration", "retirement", "mixed"),
        )
        val motivations = initiativeStringArray(
            input.get("motivations"),
            1,
            6,
            setOf("business-driven", "technical", "regulatory", "operational", "security-driven", "mixed"),
        )
        if (motivations.distinct().size != motivations.size) throw invalidResponse()
        val characteristics = input.get("characteristics").requireObject()
        characteristics.requireExactKeys("userInterface", "data", "integration", "interactionModes", "exposure")
        characteristics.requireOneOf("userInterface", setOf("ui-bearing", "non-ui", "unknown"))
        characteristics.requireOneOf("data", setOf("data-bearing", "stateless", "unknown"))
        characteristics.requireOneOf("integration", setOf("integration-heavy", "isolated", "mixed", "unknown"))
        val interactionModes = initiativeStringArray(
            characteristics.get("interactionModes"),
            1,
            6,
            setOf("synchronous", "asynchronous", "batch", "streaming", "interactive", "mixed"),
        )
        if (interactionModes.distinct().size != interactionModes.size) throw invalidResponse()
        characteristics.requireOneOf("exposure", setOf("internal", "partner", "public", "mixed", "unknown"))
        input.requireBoolean("regulated")
        val policyDomains = initiativeIdentifierArray(input.get("policyDomains"), 64)
        if (policyDomains.distinct().size != policyDomains.size) throw invalidResponse()
        val sensitivities = initiativeStringArray(
            input.get("sensitivities"),
            1,
            8,
            setOf("security", "privacy", "data", "safety", "financial", "operational", "none", "unknown"),
        )
        if (sensitivities.distinct().size != sensitivities.size || ("none" in sensitivities && sensitivities.size > 1)) {
            throw invalidResponse()
        }
        input.requireOneOf("expectedLifetime", setOf("short-lived", "medium-term", "long-lived", "indefinite", "unknown"))
        initiativeText(input.requireString("maintenanceHorizon"))
        val risk = input.get("risk").requireObject()
        risk.requireExactKeys("blastRadius", "reversibility", "urgency", "costOfFailure")
        risk.requireOneOf("blastRadius", setOf("localized", "multi-unit", "organization", "external", "unknown"))
        risk.requireOneOf("reversibility", setOf("reversible", "partially-reversible", "irreversible", "unknown"))
        risk.requireOneOf("urgency", setOf("low", "normal", "high", "critical", "unknown"))
        risk.requireOneOf("costOfFailure", setOf("low", "medium", "high", "critical", "unknown"))
        listOf("dependencies", "affectedAssets").forEach { key ->
            val values = initiativeTextArray(input.get(key), 0, 256)
            if (values.distinct().size != values.size) throw invalidResponse()
        }
        initiativeText(input.requireString("owner"))
        initiativeText(input.requireString("accountableAuthority"))
        val confidence = input.get("confidence").requireObject()
        confidence.requireExactKeys("level", "basis")
        confidence.requireOneOf("level", setOf("low", "medium", "high"))
        initiativeText(confidence.requireString("basis"))
        val evidence = input.get("evidence")
        if (evidence == null || !evidence.isJsonArray || evidence.asJsonArray.size() !in 1..256) throw invalidResponse()
        val evidenceKeys = evidence.asJsonArray.map { validateInitiativeSource(it.requireObject()) }
        if (evidenceKeys.distinct().size != evidenceKeys.size) throw invalidResponse()
        initiativeTextArray(input.get("unresolvedQuestions"), 0, 256)
        portableText(input.requireString("rationale"), minimum = 10, maximum = 10_000)
    }

    private fun validateInitiativeApplicabilityInput(input: JsonObject) {
        input.requireKeys(setOf("decisions", "unresolvedSubjects"), setOf("subjectCatalog"))
        input.get("subjectCatalog")?.let { value ->
            val catalog = value.requireObject()
            catalog.requireExactKeys("catalogVersion", "digest", "subjectCount")
            if (catalog.requireString("catalogVersion") != "gaep-initiative-applicability-subjects-v1") {
                throw invalidResponse()
            }
            catalog.requireDigest("digest")
            if (catalog.requireBoundedNonNegativeInt("subjectCount", 512) !in 1..512) throw invalidResponse()
        }
        val decisions = input.get("decisions")
        if (decisions == null || !decisions.isJsonArray || decisions.asJsonArray.size() !in 1..512) {
            throw invalidResponse()
        }
        val decisionKeys = decisions.asJsonArray.map { validateInitiativeDecisionInput(it.requireObject()) }
        if (decisionKeys.distinct().size != decisionKeys.size) throw invalidResponse()
        val unresolved = input.get("unresolvedSubjects")
        if (unresolved == null || !unresolved.isJsonArray || unresolved.asJsonArray.size() > 512) throw invalidResponse()
        val unresolvedKeys = unresolved.asJsonArray.map { value ->
            val item = value.requireObject()
            item.requireExactKeys("subject", "reason", "owner")
            val key = validateInitiativeSubject(item.get("subject").requireObject())
            initiativeText(item.requireString("reason"))
            initiativeText(item.requireString("owner"))
            key
        }
        if (unresolvedKeys.distinct().size != unresolvedKeys.size || unresolvedKeys.any(decisionKeys::contains)) {
            throw invalidResponse()
        }
    }

    private fun validateInitiativeDecisionInput(decision: JsonObject): String {
        decision.requireKeys(
            required = setOf(
                "subject", "status", "rationale", "sources", "owner", "dependencies", "conditions",
                "reviewTriggers", "approval", "relatedRecords", "relatedImplementationUnits",
            ),
            optional = setOf("accountableApprover"),
        )
        val subjectKey = validateInitiativeSubject(decision.get("subject").requireObject())
        val status = decision.requireOneOf("status", initiativeApplicabilityStatuses)
        portableText(decision.requireString("rationale"), minimum = 10, maximum = 10_000)
        val sources = decision.get("sources")
        if (sources == null || !sources.isJsonArray || sources.asJsonArray.size() !in 1..256) throw invalidResponse()
        val sourceKeys = sources.asJsonArray.map { validateInitiativeSource(it.requireObject()) }
        if (sourceKeys.distinct().size != sourceKeys.size) throw invalidResponse()
        initiativeText(decision.requireString("owner"))
        decision.get("accountableApprover")?.let { initiativeText(it.requireString()) }
        val dependencies = initiativeIdentifierArray(decision.get("dependencies"), 256)
        val conditions = initiativeTextArray(decision.get("conditions"), 0, 256)
        val reviewTriggers = initiativeTextArray(decision.get("reviewTriggers"), 1, 256)
        val implementationUnits = initiativeIdentifierArray(decision.get("relatedImplementationUnits"), 256)
        if (dependencies.distinct().size != dependencies.size || conditions.distinct().size != conditions.size ||
            reviewTriggers.distinct().size != reviewTriggers.size || implementationUnits.distinct().size != implementationUnits.size
        ) {
            throw invalidResponse()
        }
        if (status in setOf("deferred", "conditionally-required", "blocked") && conditions.isEmpty()) {
            throw invalidResponse()
        }
        val approval = decision.get("approval").requireObject()
        approval.requireKeys(setOf("state", "conditions"), setOf("decidedBy", "decidedAt"))
        val approvalState = approval.requireOneOf("state", setOf("not-required", "pending", "approved", "rejected"))
        initiativeTextArray(approval.get("conditions"), 0, 128)
        val hasDecider = approval.has("decidedBy")
        val hasDecisionTime = approval.has("decidedAt")
        val decided = approvalState in setOf("approved", "rejected")
        if (hasDecider != hasDecisionTime || decided != hasDecider) throw invalidResponse()
        if (hasDecider) {
            parseInitiativeHuman(approval.get("decidedBy").requireObject())
            approval.requireInstant("decidedAt")
        }
        if (status == "awaiting-human-decision" && approvalState != "pending") throw invalidResponse()
        val related = decision.get("relatedRecords")
        if (related == null || !related.isJsonArray || related.asJsonArray.size() > 256) throw invalidResponse()
        val relatedKeys = related.asJsonArray.map { value ->
            val record = value.requireObject()
            record.requireExactKeys("recordType", "recordId", "revision", "digest")
            val recordType = initiativeIdentifier(record.requireString("recordType"))
            val recordId = record.requireNonEmptyUuid("recordId")
            val revision = record.requireLong("revision")
            if (revision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
            record.requireDigest("digest")
            "$recordType:$recordId:$revision"
        }
        if (relatedKeys.distinct().size != relatedKeys.size ||
            (status in setOf("already-satisfied", "reused") && relatedKeys.isEmpty())
        ) {
            throw invalidResponse()
        }
        return subjectKey
    }

    private fun parseInitiativeClassification(classification: JsonObject): InitiativeClassificationView {
        classification.requireKeys(
            required = setOf(
                "primaryType", "secondaryTypes", "systemState", "changePosture", "motivations", "characteristics",
                "regulated", "policyDomains", "sensitivities", "expectedLifetime", "maintenanceHorizon", "risk",
                "dependencies", "affectedAssets", "owner", "accountableAuthority", "confidence", "evidence",
                "unresolvedQuestions", "rationale", "productProfile", "productRevision", "productDigest", "classifiedBy",
                "classifiedAt", "authorityBoundary",
            ),
            optional = setOf("completenessPolicyVersion", "completenessPolicyDigest"),
        )
        val input = classification.deepCopy().apply {
            listOf(
                "productProfile", "productRevision", "productDigest", "completenessPolicyVersion",
                "completenessPolicyDigest", "classifiedBy", "classifiedAt", "authorityBoundary",
            ).forEach(::remove)
        }
        validateInitiativeClassificationInput(input)
        if (classification.requireString("authorityBoundary") != INITIATIVE_CLASSIFICATION_BOUNDARY) {
            throw invalidResponse()
        }
        val productRevision = classification.requireLong("productRevision")
        if (productRevision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
        val completenessPolicyVersion = classification.get("completenessPolicyVersion")?.let {
            classification.requireString("completenessPolicyVersion").also { version ->
                if (version != "gaep-initiative-classification-completeness-v1") throw invalidResponse()
            }
        }
        val completenessPolicyDigest = classification.get("completenessPolicyDigest")?.let {
            classification.requireDigest("completenessPolicyDigest")
        }
        if ((completenessPolicyVersion == null) != (completenessPolicyDigest == null)) throw invalidResponse()
        return InitiativeClassificationView(
            primaryType = input.requireString("primaryType"),
            productProfile = classification.requireOneOf(
                "productProfile",
                setOf("software", "saas", "ai-enabled", "integration", "security-sensitive", "data-sensitive", "internal-tool", "mobile"),
            ),
            productRevision = productRevision,
            productDigest = classification.requireDigest("productDigest"),
            completenessPolicyVersion = completenessPolicyVersion,
            completenessPolicyDigest = completenessPolicyDigest,
            classifiedBy = parseInitiativeHuman(classification.get("classifiedBy").requireObject()),
            classifiedAt = classification.requireInstant("classifiedAt"),
            digest = canonicalDigest(classification),
            inputDigest = canonicalDigest(input),
        )
    }

    private fun parseInitiativeApplicability(
        matrix: JsonObject,
        expectedInitiativeId: UUID,
        expectedProductId: UUID,
    ): InitiativeApplicabilityView {
        matrix.requireKeys(
            required = setOf(
                "decisions", "unresolvedSubjects", "schemaVersion", "kind", "revision", "initiativeId", "productId",
                "initiativeRevision", "classificationDigest", "state", "evaluatedBy", "evaluatedAt", "authorityBoundary",
            ),
            optional = setOf("subjectCatalog", "invalidatedAt", "invalidationReason"),
        )
        if (matrix.requireInt("schemaVersion") != 1 ||
            matrix.requireString("kind") != "initiative-applicability-matrix" ||
            matrix.requireString("authorityBoundary") != INITIATIVE_MATRIX_BOUNDARY ||
            matrix.requireNonEmptyUuid("initiativeId") != expectedInitiativeId ||
            matrix.requireNonEmptyUuid("productId") != expectedProductId
        ) {
            throw invalidResponse()
        }
        val revision = matrix.requireLong("revision")
        val initiativeRevision = matrix.requireLong("initiativeRevision")
        if (revision !in 1..MAX_SAFE_PRODUCT_REVISION || initiativeRevision !in 1..MAX_SAFE_PRODUCT_REVISION) {
            throw invalidResponse()
        }
        val evaluatedBy = parseInitiativeHuman(matrix.get("evaluatedBy").requireObject())
        val rawDecisions = matrix.get("decisions")
        if (rawDecisions == null || !rawDecisions.isJsonArray || rawDecisions.asJsonArray.size() !in 1..512) {
            throw invalidResponse()
        }
        val decisionInputs = JsonArray()
        rawDecisions.asJsonArray.forEach { value ->
            val decision = value.requireObject()
            decision.requireKeys(
                required = setOf(
                    "subject", "status", "rationale", "sources", "owner", "dependencies", "conditions",
                    "reviewTriggers", "approval", "relatedRecords", "relatedImplementationUnits", "id", "revision",
                    "initiativeRevision", "decidedBy", "decidedAt", "authorityBoundary",
                ),
                optional = setOf("accountableApprover"),
            )
            val decisionRevision = decision.requireLong("revision")
            if (decision.requireNonEmptyUuid("id") == UUID(0, 0) || decisionRevision !in 1..MAX_SAFE_PRODUCT_REVISION ||
                decision.requireLong("initiativeRevision") != initiativeRevision ||
                parseInitiativeHuman(decision.get("decidedBy").requireObject()) != evaluatedBy ||
                decision.requireString("authorityBoundary") != INITIATIVE_DECISION_BOUNDARY
            ) {
                throw invalidResponse()
            }
            decision.requireInstant("decidedAt")
            decisionInputs.add(decision.deepCopy().apply {
                listOf("id", "revision", "initiativeRevision", "decidedBy", "decidedAt", "authorityBoundary").forEach(::remove)
            })
        }
        val subjectCatalog = matrix.get("subjectCatalog")?.let { value ->
            val catalog = value.requireObject()
            catalog.requireExactKeys("catalogVersion", "digest", "subjectCount")
            val catalogVersion = catalog.requireString("catalogVersion")
            val subjectCount = catalog.requireBoundedNonNegativeInt("subjectCount", 512)
            if (catalogVersion != "gaep-initiative-applicability-subjects-v1" || subjectCount !in 1..512) {
                throw invalidResponse()
            }
            InitiativeApplicabilitySubjectCatalogBinding(
                catalogVersion,
                catalog.requireDigest("digest"),
                subjectCount,
            )
        }
        val input = JsonObject().apply {
            subjectCatalog?.let { catalog ->
                add("subjectCatalog", JsonObject().apply {
                    addProperty("catalogVersion", catalog.catalogVersion)
                    addProperty("digest", catalog.digest)
                    addProperty("subjectCount", catalog.subjectCount)
                })
            }
            add("decisions", decisionInputs)
            add("unresolvedSubjects", matrix.get("unresolvedSubjects").deepCopy())
        }
        validateInitiativeApplicabilityInput(input)
        val state = matrix.requireOneOf("state", setOf("current", "stale"))
        val invalidatedAt = matrix.get("invalidatedAt")?.let { matrix.requireInstant("invalidatedAt") }
        val invalidationReason = matrix.get("invalidationReason")?.let { initiativeText(it.requireString()) }
        if ((state == "stale") != (invalidatedAt != null && invalidationReason != null)) throw invalidResponse()
        return InitiativeApplicabilityView(
            revision = revision,
            initiativeRevision = initiativeRevision,
            state = state,
            decisionCount = decisionInputs.size(),
            unresolvedSubjectCount = input.getAsJsonArray("unresolvedSubjects").size(),
            classificationDigest = matrix.requireDigest("classificationDigest"),
            subjectCatalog = subjectCatalog,
            evaluatedBy = evaluatedBy,
            evaluatedAt = matrix.requireInstant("evaluatedAt"),
            digest = canonicalDigest(matrix),
            inputDigest = canonicalDigest(input),
        )
    }

    private fun parseInitiativeHuman(actor: JsonObject): String {
        actor.requireExactKeys("kind", "id")
        if (actor.requireString("kind") != "human") throw invalidResponse()
        return initiativeText(actor.requireString("id"))
    }

    private fun validateInitiativeSource(source: JsonObject): String {
        source.requireKeys(setOf("kind", "reference"), setOf("digest"))
        val kind = source.requireOneOf("kind", initiativeSourceKinds)
        val reference = initiativeText(source.requireString("reference"))
        val digest = source.get("digest")?.let { source.requireDigest("digest") }.orEmpty()
        return "$kind:$reference:$digest"
    }

    private fun validateInitiativeSubject(subject: JsonObject): String {
        subject.requireExactKeys("type", "key", "label")
        val type = subject.requireOneOf("type", initiativeSubjectTypes)
        val key = initiativeIdentifier(subject.requireString("key"))
        initiativeText(subject.requireString("label"))
        return "$type:$key"
    }

    private fun initiativeIdentifier(value: String): String = value.takeIf(initiativeIdentifierPattern::matches)
        ?: throw invalidResponse()

    private fun initiativeText(value: String): String = portableText(value, minimum = 2, maximum = 2_000)

    private fun initiativeStringArray(
        value: JsonElement?,
        minimum: Int,
        maximum: Int,
        allowed: Set<String>,
    ): List<String> {
        if (value == null || !value.isJsonArray || value.asJsonArray.size() !in minimum..maximum) {
            throw invalidResponse()
        }
        return value.asJsonArray.map { it.requireString().takeIf(allowed::contains) ?: throw invalidResponse() }
    }

    private fun initiativeIdentifierArray(value: JsonElement?, maximum: Int): List<String> {
        if (value == null || !value.isJsonArray || value.asJsonArray.size() > maximum) throw invalidResponse()
        return value.asJsonArray.map { initiativeIdentifier(it.requireString()) }
    }

    private fun initiativeTextArray(
        value: JsonElement?,
        minimum: Int,
        maximum: Int,
    ): List<String> {
        if (value == null || !value.isJsonArray || value.asJsonArray.size() !in minimum..maximum) {
            throw invalidResponse()
        }
        return value.asJsonArray.map { initiativeText(it.requireString()) }
    }

    private fun validateInitiativeTextArray(value: JsonElement?, minimum: Int, maximum: Int) {
        initiativeTextArray(value, minimum, maximum)
    }

    private fun List<String>.toJsonArray(): JsonArray = JsonArray().also { array -> forEach(array::add) }

    private fun workspaceRelativeScope(value: String): String = if (value == ".") value else workspaceRelativePath(value)

    private fun parsePortableSelectionSettings(settings: JsonObject): Map<String, PortableAgentSettingValue> {
        if (settings.size() > 128 || settings.keySet().any { !validSettingKey(it) }) throw invalidResponse()
        return settings.entrySet().associate { (key, value) -> key to parsePortableSettingValue(value) }
    }

    private fun validSettingKey(key: String): Boolean = settingKeyPattern.matches(key) &&
        !secretSettingKeyPattern.containsMatchIn(key) && !key.equals("secret", ignoreCase = true) &&
        !key.equals("token", ignoreCase = true)

    private fun parsePortableSettingValue(value: JsonElement): PortableAgentSettingValue {
        if (value.isJsonPrimitive) {
            val primitive = value.asJsonPrimitive
            return when {
                primitive.isString -> PortableAgentSettingValue.Text(portableSettingText(primitive.asString))
                primitive.isNumber -> PortableAgentSettingValue.Decimal(parseFiniteDecimal(primitive))
                primitive.isBoolean -> PortableAgentSettingValue.Flag(primitive.asBoolean)
                else -> throw invalidResponse()
            }
        }
        if (!value.isJsonArray || value.asJsonArray.size() > 256) throw invalidResponse()
        return PortableAgentSettingValue.TextList(
            value.asJsonArray.map { portableSettingText(it.requireString()) }.toList(),
        )
    }

    private fun portableSettingValueToJson(value: PortableAgentSettingValue): JsonElement = when (value) {
        is PortableAgentSettingValue.Text -> JsonPrimitive(portableSettingTextInput(value.value))
        is PortableAgentSettingValue.Decimal -> {
            require(value.value.toDouble().isFinite()) { "Agent number settings must be finite" }
            JsonPrimitive(value.value)
        }
        is PortableAgentSettingValue.Flag -> JsonPrimitive(value.value)
        is PortableAgentSettingValue.TextList -> JsonArray().apply {
            require(value.value.size <= 256) { "Agent string-list settings may contain at most 256 values" }
            value.value.forEach { add(portableSettingTextInput(it)) }
        }
    }

    private fun portableSettingTextInput(value: String): String = try {
        portableSettingText(value)
    } catch (_: GaepHostException) {
        throw IllegalArgumentException("Agent settings must contain only verified portable, non-secret values")
    }

    private fun parseFiniteDecimal(value: JsonElement): BigDecimal {
        if (!value.isJsonPrimitive || !value.asJsonPrimitive.isNumber) throw invalidResponse()
        return try {
            value.asBigDecimal.also { if (!it.toDouble().isFinite()) throw invalidResponse() }
        } catch (_: Exception) {
            throw invalidResponse()
        }
    }

    private fun validatePortableTextArray(value: JsonElement?, maximumItems: Int, maximumText: Int = 20_000) {
        if (value == null || !value.isJsonArray || value.asJsonArray.size() > maximumItems) throw invalidResponse()
        value.asJsonArray.forEach { portableText(it.requireString(), maximum = maximumText) }
    }

    private fun JsonObject.requirePortableText(name: String, minimum: Int = 0): String =
        portableText(requireString(name), minimum)

    private fun JsonObject.requireTruthClass(name: String): String = requireString(name).takeIf {
        it in setOf("observed", "provider-declared", "configured", "inferred", "unknown")
    } ?: throw invalidResponse()

    private fun portableText(value: String, minimum: Int = 0, maximum: Int = 20_000): String {
        if (value.length !in minimum..maximum || value.any(Char::isISOControl) ||
            absolutePathPattern.matches(value.trim()) || privatePathPattern.containsMatchIn(value) ||
            secretPattern.containsMatchIn(value)
        ) {
            throw invalidResponse()
        }
        return value
    }

    private fun portableSettingText(value: String, minimum: Int = 0): String {
        if (value.length !in minimum..10_000 || value.any(Char::isISOControl) ||
            portableSettingPathPattern.containsMatchIn(value) || secretPattern.containsMatchIn(value) ||
            secretEnvironmentSettingPattern.matches(value)
        ) {
            throw invalidResponse()
        }
        return value
    }

    private fun managedReadOnlyPreviewBody(preview: ManagedReadOnlyPreview): JsonObject {
        require(preview.schemaVersion == 1 && preview.kind == "managed-readonly-preview") {
            "Managed read-only preview identity is invalid"
        }
        require(preview.authorityBoundary == MANAGED_PREVIEW_BOUNDARY) {
            "Managed read-only preview authority boundary is invalid"
        }
        require(preview.productId != UUID(0, 0) && preview.initiativeId != UUID(0, 0) &&
            preview.charterId != UUID(0, 0) && preview.workflowPlanId != UUID(0, 0)
        ) { "Managed read-only preview identities must be non-empty UUIDs" }
        require(digestPattern.matches(preview.charterDigest) && digestPattern.matches(preview.workflowPlanDigest) &&
            digestPattern.matches(preview.selectionDigest) && digestPattern.matches(preview.previewDigest)
        ) { "Managed read-only preview digests are invalid" }
        portableText(preview.adapterId, minimum = 1)
        portableText(preview.agentId, minimum = 1)
        portableText(preview.modelId, minimum = 1)
        require(preview.strategy in setOf("sequential", "parallel-readonly")) {
            "Managed read-only preview strategy is invalid"
        }
        require(preview.stepIds.size in 1..512 && preview.stepIds.none { it == UUID(0, 0) } &&
            preview.stepIds.distinct().size == preview.stepIds.size
        ) { "Managed read-only preview steps are invalid" }
        require(preview.contextPackCount in 0..512 && preview.readScopeCount in 0..100_000) {
            "Managed read-only preview counts are invalid"
        }
        require(preview.gates.size in 2..2_050 && preview.gates.map { it.key }.distinct().size == preview.gates.size) {
            "Managed read-only preview gates are invalid"
        }
        val stepIds = preview.stepIds.toSet()
        val gates = JsonArray().apply {
            preview.gates.forEach { gate ->
                val charterGate = gate.phase == "charter-evidence" || gate.phase == "charter-stop-conditions"
                require(gate.phase in setOf(
                    "preconditions", "outputs", "evidence", "stop-conditions",
                    "charter-evidence", "charter-stop-conditions",
                ) && charterGate != (gate.stepId != null) &&
                    (gate.stepId == null || (gate.stepId != UUID(0, 0) && gate.stepId in stepIds))
                ) { "Managed read-only preview gate binding is invalid" }
                val key = portableHandoffText(gate.key, minimum = 1, maximum = 500)
                require(gate.criteria.size <= 256) { "Managed read-only preview gate criteria are invalid" }
                val criteria = JsonArray().apply {
                    gate.criteria.forEach { criterion ->
                        add(portableHandoffText(criterion, minimum = 1, maximum = 2_000))
                    }
                }
                require(digestPattern.matches(gate.criteriaDigest) &&
                    gate.criteriaDigest == canonicalDigest(criteria)
                ) { "Managed read-only preview gate digest is invalid" }
                add(JsonObject().apply {
                    addProperty("key", key)
                    gate.stepId?.let { addProperty("stepId", it.toString()) }
                    addProperty("phase", gate.phase)
                    add("criteria", criteria)
                    addProperty("criteriaDigest", gate.criteriaDigest)
                })
            }
        }
        return JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "managed-readonly-preview")
            addProperty("productId", preview.productId.toString())
            addProperty("initiativeId", preview.initiativeId.toString())
            addProperty("charterId", preview.charterId.toString())
            addProperty("charterDigest", preview.charterDigest)
            addProperty("workflowPlanId", preview.workflowPlanId.toString())
            addProperty("workflowPlanDigest", preview.workflowPlanDigest)
            addProperty("adapterId", preview.adapterId)
            addProperty("agentId", preview.agentId)
            addProperty("modelId", preview.modelId)
            addProperty("selectionDigest", preview.selectionDigest)
            addProperty("strategy", preview.strategy)
            add("stepIds", JsonArray().apply { preview.stepIds.forEach { add(it.toString()) } })
            addProperty("contextPackCount", preview.contextPackCount)
            addProperty("readScopeCount", preview.readScopeCount)
            add("gates", gates)
            addProperty("authorityBoundary", MANAGED_PREVIEW_BOUNDARY)
        }
    }

    private fun parsePhaseDashboardPanel(panel: JsonObject, expectedId: String): PhaseDashboardPanel {
        panel.requireExactKeys("id", "role", "title", "applicability", "state")
        val definition = phaseDashboardPanelCatalog[expectedId] ?: throw invalidResponse()
        if (panel.requireString("id") != expectedId || panel.requireString("role") != definition.first ||
            panel.requireString("title") != definition.second
        ) {
            throw invalidResponse()
        }
        val applicability = panel.get("applicability").requireObject()
        applicability.requireKeys(setOf("status", "basis"), setOf("decision"))
        val status = applicability.requireString("status")
        val basis = applicability.requireString("basis")
        if (status !in setOf("applicable", "not-applicable", "unknown") ||
            basis !in setOf("phase-contract", "governed-decision", "not-evaluated")
        ) {
            throw invalidResponse()
        }
        val decision = applicability.get("decision")?.let { parsePhaseDashboardDecision(it.requireObject()) }
        if ((basis == "phase-contract" && (status != "applicable" || decision != null)) ||
            (basis == "not-evaluated" && (status != "unknown" || decision != null)) ||
            (basis == "governed-decision" && (status == "unknown" || decision == null))
        ) {
            throw invalidResponse()
        }
        val state = panel.requireString("state")
        val expectedState = when (status) {
            "applicable" -> "active"
            "not-applicable" -> "not-applicable"
            else -> "attention-required"
        }
        if (state != expectedState) throw invalidResponse()
        return PhaseDashboardPanel(
            id = expectedId,
            role = definition.first,
            title = definition.second,
            applicability = PhaseDashboardApplicability(status, basis, decision),
            state = state,
        )
    }

    private fun parsePhaseDashboardDecision(decision: JsonObject): PhaseDashboardDecision {
        decision.requireExactKeys("recordType", "recordId", "revision", "digest")
        if (decision.requireString("recordType") != "decision") throw invalidResponse()
        val recordId = parseUuid(decision.requireString("recordId"))
        val revision = decision.requireLong("revision")
        if (recordId == UUID(0, 0) || revision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
        return PhaseDashboardDecision(recordId, revision, decision.requireDigest("digest"))
    }

    private fun <T> parseChangeImpactArray(
        value: JsonElement?,
        maximum: Int,
        parse: (JsonElement) -> T,
    ): List<T> {
        if (value == null || !value.isJsonArray || value.asJsonArray.size() > maximum) throw invalidResponse()
        return value.asJsonArray.map(parse)
    }

    private fun parseAgentModelReference(value: JsonElement?, expectedType: String): AgentModelReference {
        val reference = value.requireObject()
        reference.requireExactKeys("recordType", "recordId", "revision", "digest")
        if (reference.requireString("recordType") != expectedType) throw invalidResponse()
        val revision = reference.requireLong("revision")
        if (revision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
        return AgentModelReference(
            reference.requireNonEmptyUuid("recordId"),
            revision,
            reference.requireDigest("digest"),
        )
    }

    private fun parseAgentModelCapability(
        row: JsonObject,
        expected: AgentReadinessSnapshot,
    ): AgentModelCapability {
        row.requireExactKeys(
            "adapterId", "adapterVersion", "agentId", "agentLabel", "runtimeVersion", "capabilityDigest",
            "detected", "executionInterface", "interfaceMaturity", "support", "modelCount", "limitations",
            "observedAt", "selected",
        )
        val runtimeValue = row.get("runtimeVersion") ?: throw invalidResponse()
        val runtimeVersion = when {
            runtimeValue.isJsonNull -> null
            else -> portableText(runtimeValue.requireString(), minimum = 1)
        }
        val support = row.get("support").requireObject()
        support.requireExactKeys("resume", "cancel", "checkpoints", "modelDiscovery", "toolSelection")
        val limitationRecord = row.get("limitations").requireObject()
        limitationRecord.requireExactKeys("values", "shown", "total", "omitted")
        val limitationValues = limitationRecord.get("values")
        if (limitationValues == null || !limitationValues.isJsonArray || limitationValues.asJsonArray.size() > 64) {
            throw invalidResponse()
        }
        val limitations = limitationValues.asJsonArray.map {
            portableText(it.requireString(), minimum = 1, maximum = 20_000)
        }
        val limitationShown = limitationRecord.requireBoundedNonNegativeLong("shown", 64)
        val limitationTotal = limitationRecord.requireBoundedNonNegativeLong("total", 512)
        val limitationOmitted = limitationRecord.requireBoundedNonNegativeLong("omitted", 512)
        if (limitationShown != limitations.size.toLong() || limitationShown + limitationOmitted != limitationTotal) {
            throw invalidResponse()
        }
        val parsed = AgentModelCapability(
            adapterId = row.requirePortableText("adapterId", minimum = 1),
            adapterVersion = row.requirePortableText("adapterVersion", minimum = 1),
            agentId = row.requirePortableText("agentId", minimum = 1),
            agentLabel = row.requirePortableText("agentLabel", minimum = 1),
            runtimeVersion = runtimeVersion,
            capabilityDigest = row.requireDigest("capabilityDigest"),
            detected = row.requireBoolean("detected"),
            executionInterface = row.requireOneOf(
                "executionInterface",
                setOf("cli-jsonl", "cli-stream-json", "stdio-rpc", "managed-in-process", "unavailable"),
            ),
            interfaceMaturity = row.requireOneOf(
                "interfaceMaturity",
                setOf("stable", "beta", "experimental", "unknown"),
            ),
            modelCount = row.requireBoundedNonNegativeLong("modelCount", 512),
            limitationShown = limitationShown,
            limitationTotal = limitationTotal,
            observedAt = row.requireInstant("observedAt"),
            selected = row.requireBoolean("selected"),
        )
        if (parsed.adapterId != expected.adapterId || parsed.adapterVersion != expected.adapterVersion ||
            parsed.agentId != expected.agentId || parsed.agentLabel != expected.agentLabel ||
            parsed.runtimeVersion != expected.runtimeVersion || parsed.capabilityDigest != expected.capabilityDigest ||
            parsed.detected != expected.detected || parsed.executionInterface != expected.executionInterface ||
            parsed.interfaceMaturity != expected.interfaceMaturity || parsed.modelCount != expected.models.size.toLong() ||
            parsed.limitationTotal != expected.limitations.size.toLong() ||
            limitations != expected.limitations.take(64) || parsed.observedAt != expected.observedAt ||
            support.requireBoolean("resume") != expected.supportsResume ||
            support.requireBoolean("cancel") != expected.supportsCancel ||
            support.requireBoolean("checkpoints") != expected.supportsCheckpoints ||
            support.requireBoolean("modelDiscovery") != expected.supportsModelDiscovery ||
            support.requireBoolean("toolSelection") != expected.supportsToolSelection
        ) {
            throw invalidResponse()
        }
        return parsed
    }

    private fun parseAgentModelSelection(
        value: JsonElement?,
        expected: AgentSelectionState,
        capabilities: List<AgentModelCapability>,
    ): AgentModelSelectionProjection {
        val selection = value.requireObject()
        val status = selection.requireString("status")
        val expectedStatus = when (expected) {
            AgentSelectionState.Unselected -> "unselected"
            is AgentSelectionState.Selected -> "selected"
            is AgentSelectionState.MigrationRequired -> "migration-required"
            AgentSelectionState.Invalid -> "invalid"
        }
        if (status != expectedStatus) throw invalidResponse()
        if (status == "unselected" || status == "invalid") {
            selection.requireExactKeys("status")
            return AgentModelSelectionProjection(
                status, null, null, null, null, null, null, emptyMap(), null, null, null,
            )
        }
        selection.requireExactKeys(
            "status", "selectionDigest", "adapterId", "agentId", "modelId", "modelTruthClass", "modelAlias",
            "settings", "selectedAt", "capabilityDigest", "capabilityState",
        )
        val current = when (expected) {
            is AgentSelectionState.Selected -> expected.selection
            is AgentSelectionState.MigrationRequired -> expected.portableCandidate
            else -> throw invalidResponse()
        }
        val aliasValue = selection.get("modelAlias") ?: throw invalidResponse()
        val modelAlias = when {
            aliasValue.isJsonNull -> null
            aliasValue.isJsonPrimitive && aliasValue.asJsonPrimitive.isBoolean -> aliasValue.asBoolean
            else -> throw invalidResponse()
        }
        val capabilityState = selection.requireOneOf(
            "capabilityState",
            if (status == "selected") setOf("current", "stale") else setOf("migration-required"),
        )
        val parsed = AgentModelSelectionProjection(
            status = status,
            selectionDigest = selection.requireDigest("selectionDigest"),
            adapterId = selection.requirePortableText("adapterId", minimum = 1),
            agentId = selection.requirePortableText("agentId", minimum = 1),
            modelId = selection.requirePortableText("modelId", minimum = 1),
            modelTruthClass = selection.requireTruthClass("modelTruthClass"),
            modelAlias = modelAlias,
            settings = parsePortableSelectionSettings(selection.get("settings").requireObject()),
            selectedAt = selection.requireInstant("selectedAt"),
            capabilityDigest = selection.requireDigest("capabilityDigest"),
            capabilityState = capabilityState,
        )
        if (parsed.selectionDigest != current.selectionDigest || parsed.adapterId != current.adapterId ||
            parsed.agentId != current.agentId || parsed.modelId != current.modelId ||
            parsed.modelTruthClass != current.modelTruthClass || parsed.modelAlias != current.modelAlias ||
            parsed.selectedAt != current.selectedAt || parsed.capabilityDigest != current.capabilityDigest
        ) {
            throw invalidResponse()
        }
        if (status == "selected") {
            val capability = capabilities.singleOrNull {
                it.adapterId == parsed.adapterId && it.agentId == parsed.agentId
            } ?: throw invalidResponse()
            if ((capability.capabilityDigest == parsed.capabilityDigest) != (capabilityState == "current")) {
                throw invalidResponse()
            }
        }
        return parsed
    }

    private fun parseAgentModelRun(value: JsonElement): AgentModelRunProjection {
        val row = value.requireObject()
        row.requireExactKeys("record", "initiativeId", "state", "agent", "startedAt", "endedAt", "managed")
        val record = parseAgentModelReference(row.get("record"), "run")
        val agent = row.get("agent").requireObject()
        agent.requireExactKeys("adapterId", "agentId", "modelId", "selectionDigest")
        val startedAt = parseNullableInstant(row.get("startedAt"))
        val endedAt = parseNullableInstant(row.get("endedAt"))
        if (startedAt != null && endedAt != null && endedAt.isBefore(startedAt)) throw invalidResponse()
        return AgentModelRunProjection(
            recordId = record.recordId,
            revision = record.revision,
            initiativeId = row.requireNonEmptyUuid("initiativeId"),
            state = row.requireOneOf(
                "state",
                setOf("prepared", "running", "paused", "completed", "failed", "cancelled", "unknown"),
            ),
            adapterId = agent.requirePortableText("adapterId", minimum = 1),
            agentId = agent.requirePortableText("agentId", minimum = 1),
            modelId = agent.requirePortableText("modelId", minimum = 1),
            managed = parseAgentModelManaged(row.get("managed")),
        ).also { agent.requireDigest("selectionDigest") }
    }

    private fun parseAgentModelManaged(value: JsonElement?): AgentModelManagedProjection {
        val managed = value.requireObject()
        val status = managed.requireString("status")
        if (status == "not-observed-in-bounded-window") {
            managed.requireExactKeys("status")
            return AgentModelManagedProjection(
                status, null, null, null, null, null, null, null, null, null,
            )
        }
        if (status != "observed") throw invalidResponse()
        managed.requireExactKeys(
            "status", "record", "mode", "state", "attemptNumber", "bindingsDigest", "provider", "result",
        )
        val record = parseAgentModelReference(managed.get("record"), "managed-run")
        managed.requireOneOf("mode", setOf("codex-staged", "manual-offline", "claude-context-only"))
        val state = managed.requireOneOf(
            "state",
            setOf(
                "prepared", "running", "review-required", "applying", "completed", "failed", "cancelled",
                "timed-out", "unknown", "conflict", "discarded",
            ),
        )
        val attemptNumber = managed.requireLong("attemptNumber")
        if (attemptNumber !in 1..1_000_000) throw invalidResponse()
        managed.requireDigest("bindingsDigest")
        val provider = managed.get("provider").requireObject()
        provider.requireExactKeys("adapterId", "agentId", "modelId", "capabilityDigest")
        provider.requirePortableText("adapterId", minimum = 1)
        provider.requirePortableText("agentId", minimum = 1)
        provider.requirePortableText("modelId", minimum = 1)
        provider.requireDigest("capabilityDigest")
        val result = managed.get("result").requireObject()
        return when (val resultStatus = result.requireString("status")) {
            "not-bound" -> {
                result.requireExactKeys("status")
                AgentModelManagedProjection(
                    status, record.recordId, state, attemptNumber, resultStatus, null, null, null, null, null,
                )
            }
            "bound" -> {
                result.requireExactKeys(
                    "status", "recordId", "digest", "providerDisposition", "outcomeStatus", "evidence",
                )
                val evidence = result.get("evidence").requireObject()
                evidence.requireExactKeys(
                    "recordId", "digest", "eventCount", "eventsDigest", "actualEffectCount", "capturedAt",
                )
                val evidenceId = evidence.requireNonEmptyUuid("recordId")
                result.requireNonEmptyUuid("recordId")
                result.requireDigest("digest")
                val providerDisposition = result.requireOneOf(
                    "providerDisposition",
                    setOf("completed", "failed", "cancelled", "interrupted", "crashed", "protocol-error", "unknown"),
                )
                val outcomeStatus = result.requireOneOf(
                    "outcomeStatus",
                    setOf("satisfied", "failed", "not-assessed", "indeterminate"),
                )
                evidence.requireDigest("digest")
                val eventCount = evidence.requireBoundedNonNegativeLong("eventCount", 4_096)
                evidence.requireDigest("eventsDigest")
                val actualEffectCount = evidence.requireBoundedNonNegativeLong("actualEffectCount", 32)
                evidence.requireInstant("capturedAt")
                AgentModelManagedProjection(
                    status, record.recordId, state, attemptNumber, resultStatus, providerDisposition, outcomeStatus,
                    evidenceId, eventCount, actualEffectCount,
                )
            }
            else -> throw invalidResponse()
        }
    }

    private fun parseAgentModelHandoff(value: JsonElement): AgentModelHandoffProjection {
        val row = value.requireObject()
        row.requireExactKeys("record", "fromRun", "toSelection", "state", "createdAt", "acknowledgedAt")
        val record = parseAgentModelReference(row.get("record"), "handoff")
        if (record.revision != 1L) throw invalidResponse()
        val fromRun = parseAgentModelReference(row.get("fromRun"), "run")
        val toSelection = row.get("toSelection").requireObject()
        toSelection.requireExactKeys("adapterId", "agentId", "modelId", "selectionDigest")
        val createdAt = row.requireInstant("createdAt")
        val acknowledgedAt = parseNullableInstant(row.get("acknowledgedAt"))
        if (acknowledgedAt != null && acknowledgedAt.isBefore(createdAt)) throw invalidResponse()
        return AgentModelHandoffProjection(
            recordId = record.recordId,
            fromRunId = fromRun.recordId,
            toAdapterId = toSelection.requirePortableText("adapterId", minimum = 1),
            toAgentId = toSelection.requirePortableText("agentId", minimum = 1),
            toModelId = toSelection.requirePortableText("modelId", minimum = 1),
            state = row.requireOneOf("state", setOf("pending-acknowledgement", "acknowledged")),
            createdAt = createdAt,
        ).also {
            toSelection.requireDigest("selectionDigest")
            if ((it.state == "acknowledged") != (acknowledgedAt != null)) throw invalidResponse()
        }
    }

    private fun validateAgentModelMetrics(value: JsonElement?) {
        val metrics = value.requireObject()
        metrics.requireExactKeys("usage", "cost")
        listOf("usage", "cost").forEach { key ->
            val metric = metrics.get(key).requireObject()
            metric.requireExactKeys("state", "basis")
            if (metric.requireString("state") != "unavailable" ||
                metric.requireString("basis") != "current-managed-records-have-no-provider-usage-or-cost-contract"
            ) {
                throw invalidResponse()
            }
        }
    }

    private fun parseAgentModelFreshness(value: JsonElement?): AgentModelFreshness {
        val freshness = value.requireObject()
        freshness.requireExactKeys(
            "state", "selectionCapabilityState", "oldestCapabilityObservedAt", "newestCapabilityObservedAt",
            "truncated", "coverageBoundary",
        )
        if (freshness.requireString("coverageBoundary") !=
            "bounded-current-records-do-not-prove-provider-account-or-native-host-readiness"
        ) {
            throw invalidResponse()
        }
        return AgentModelFreshness(
            state = freshness.requireOneOf("state", setOf("current", "attention-required")),
            selectionCapabilityState = freshness.requireOneOf(
                "selectionCapabilityState",
                setOf("current", "unselected", "stale", "migration-required", "invalid"),
            ),
            oldestCapabilityObservedAt = freshness.requireInstant("oldestCapabilityObservedAt"),
            newestCapabilityObservedAt = freshness.requireInstant("newestCapabilityObservedAt"),
            truncated = freshness.requireBoolean("truncated"),
        )
    }

    private fun parseDashboardEvidenceCues(value: JsonElement?, expectedFreshness: String): DashboardEvidenceCues {
        val cues = value.requireObject()
        cues.requireExactKeys("freshness", "confidence")
        val freshness = cues.requireOneOf("freshness", setOf("current", "potentially-stale", "stale", "unknown"))
        val confidence = cues.get("confidence").requireObject()
        confidence.requireExactKeys("state", "basis")
        val state = confidence.requireString("state")
        val basis = confidence.requireString("basis")
        if (freshness != expectedFreshness || state != "not-assessed" ||
            basis != "no-governed-confidence-evaluation-is-bound"
        ) {
            throw invalidResponse()
        }
        return DashboardEvidenceCues(freshness, state, basis)
    }

    private fun parseAgentModelLimit(value: JsonElement?): AgentModelLimit {
        val limit = value.requireObject()
        limit.requireExactKeys("shown", "total", "omitted")
        val shown = limit.requireBoundedNonNegativeLong("shown", 1_000_000)
        val total = limit.requireBoundedNonNegativeLong("total", 1_000_000)
        val omitted = limit.requireBoundedNonNegativeLong("omitted", 1_000_000)
        if (shown + omitted != total) throw invalidResponse()
        return AgentModelLimit(shown, total, omitted)
    }

    private fun parseNullableInstant(value: JsonElement?): Instant? = when {
        value == null -> throw invalidResponse()
        value.isJsonNull -> null
        else -> parseInstant(value)
    }

    private fun parseChangeImpactExactReference(
        value: JsonElement?,
        expectedType: String,
    ): ChangeImpactExactReference {
        val reference = value.requireObject()
        reference.requireExactKeys("recordType", "recordId", "revision", "digest")
        if (reference.requireString("recordType") != expectedType) throw invalidResponse()
        val recordId = reference.requireNonEmptyUuid("recordId")
        val revision = reference.requireLong("revision")
        if (revision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
        return ChangeImpactExactReference(expectedType, recordId, revision, reference.requireDigest("digest"))
    }

    private fun parseChangeImpactChangeReference(value: JsonElement): ChangeImpactChangeReference {
        val change = value.requireObject()
        change.requireExactKeys("recordType", "recordId", "revision", "digest", "state", "effectEnvelope")
        val envelope = change.get("effectEnvelope")
        if (change.requireString("recordType") != "change" || envelope == null || !envelope.isJsonArray ||
            envelope.asJsonArray.size() !in 1..changeImpactEffects.size
        ) {
            throw invalidResponse()
        }
        val effects = envelope.asJsonArray.map { effect ->
            effect.requireString().takeIf(changeImpactEffects::contains) ?: throw invalidResponse()
        }
        val revision = change.requireLong("revision")
        if (effects.distinct().size != effects.size || revision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
        return ChangeImpactChangeReference(
            change.requireNonEmptyUuid("recordId"),
            revision,
            change.requireDigest("digest"),
            change.requireOneOf("state", changeImpactStates),
            effects,
        )
    }

    private fun parseChangeImpactLocator(value: JsonElement?): ChangeImpactLocator {
        val locator = value.requireObject()
        return when (val kind = locator.requireString("kind")) {
            "workspace-relative" -> {
                locator.requireExactKeys("kind", "path")
                ChangeImpactLocator(kind, workspaceRelativeScope(locator.requireString("path")))
            }
            "logical" -> {
                locator.requireExactKeys("kind", "value")
                val logical = locator.requireString("value")
                if (!toolPattern.matches(logical)) throw invalidResponse()
                ChangeImpactLocator(kind, logical)
            }
            "external-uri" -> {
                locator.requireExactKeys("kind", "uri")
                val raw = locator.requireString("uri")
                if (raw.length !in 1..8_192 || raw.any(Char::isISOControl)) throw invalidResponse()
                val parsed = try {
                    URI(raw)
                } catch (_: Exception) {
                    throw invalidResponse()
                }
                val scheme = parsed.scheme?.lowercase()
                val sensitive = Regex(
                    "token|password|passwd|secret|signature|credential|api.?key|access.?key|auth",
                    RegexOption.IGNORE_CASE,
                )
                val queryKeys = parsed.query?.split('&')?.map { it.substringBefore('=') }.orEmpty()
                if (scheme !in setOf("http", "https", "urn") || parsed.userInfo != null ||
                    ((scheme == "http" || scheme == "https") && parsed.host.isNullOrBlank()) ||
                    queryKeys.any(sensitive::containsMatchIn) ||
                    (!parsed.fragment.isNullOrEmpty() && sensitive.containsMatchIn(parsed.fragment))
                ) {
                    throw invalidResponse()
                }
                ChangeImpactLocator(kind, raw)
            }
            else -> throw invalidResponse()
        }
    }

    private fun parseChangeImpactTraceEndpoint(value: JsonElement?): ChangeImpactTraceEndpoint {
        val endpoint = value.requireObject()
        endpoint.requireKeys(setOf("recordType", "recordId"), setOf("revision", "digest"))
        val recordType = endpoint.requireOneOf("recordType", changeImpactRecordTypes)
        if (recordType == "external") {
            if (endpoint.has("revision") || endpoint.has("digest")) throw invalidResponse()
            return ChangeImpactTraceEndpoint(
                recordType,
                portableText(endpoint.requireString("recordId"), minimum = 1, maximum = 500),
                null,
                null,
            )
        }
        if (!endpoint.has("revision") || !endpoint.has("digest")) throw invalidResponse()
        val revision = endpoint.requireLong("revision")
        if (revision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
        return ChangeImpactTraceEndpoint(
            recordType,
            endpoint.requireNonEmptyUuid("recordId").toString(),
            revision,
            endpoint.requireDigest("digest"),
        )
    }

    private fun parseChangeImpactAffectedUnit(value: JsonElement): ChangeImpactAffectedUnit {
        val unit = value.requireObject()
        unit.requireExactKeys("direction", "relationship", "endpoint", "trace")
        val trace = unit.get("trace").requireObject()
        trace.requireExactKeys("recordId", "revision", "assessmentDigest", "assessedState")
        val traceRevision = trace.requireLong("revision")
        if (traceRevision !in 1..MAX_SAFE_PRODUCT_REVISION) throw invalidResponse()
        return ChangeImpactAffectedUnit(
            unit.requireOneOf("direction", setOf("upstream", "downstream")),
            unit.requireOneOf("relationship", changeImpactRelationships),
            parseChangeImpactTraceEndpoint(unit.get("endpoint")),
            ChangeImpactTraceAssessment(
                trace.requireNonEmptyUuid("recordId"),
                traceRevision,
                trace.requireDigest("assessmentDigest"),
                trace.requireOneOf("assessedState", setOf("valid", "unresolved", "stale", "invalid")),
            ),
        )
    }

    private fun parseChangeImpactLimit(value: JsonElement?): ChangeImpactLimit {
        val limit = value.requireObject()
        limit.requireExactKeys("shown", "total", "omitted")
        val shown = limit.requireBoundedNonNegativeLong("shown", 1_000_000)
        val total = limit.requireBoundedNonNegativeLong("total", 1_000_000)
        val omitted = limit.requireBoundedNonNegativeLong("omitted", 1_000_000)
        if (shown + omitted != total) throw invalidResponse()
        return ChangeImpactLimit(shown, total, omitted)
    }

    private fun parseChangeImpactLimitations(value: JsonElement?): List<String> {
        if (value == null || !value.isJsonArray || value.asJsonArray.size() !in 1..8) throw invalidResponse()
        return value.asJsonArray.map { portableText(it.requireString(), minimum = 4, maximum = 1_000) }
    }

    private fun ensureUniqueChangeImpactRows(
        workItems: List<ChangeImpactWorkItem>,
        changedArtifacts: List<ChangeImpactArtifact>,
        effectTargets: List<ChangeImpactArtifact>,
        affectedUnits: List<ChangeImpactAffectedUnit>,
        decisions: List<ChangeImpactDecision>,
        risks: List<ChangeImpactRisk>,
    ) {
        fun <T> unique(values: List<T>): Boolean = values.distinct().size == values.size
        fun artifactKey(value: ChangeImpactArtifact): String =
            "${value.sourceWorkItem.recordId}:${value.locator.kind}:${value.locator.value}"
        if (!unique(workItems.map { it.record.recordId }) ||
            !unique(changedArtifacts.map(::artifactKey)) ||
            !unique(effectTargets.map(::artifactKey)) ||
            !unique(affectedUnits.map {
                "${it.direction}:${it.endpoint.recordType}:${it.endpoint.recordId}:${it.trace.recordId}"
            }) ||
            !unique(decisions.map { it.record.recordId }) || !unique(risks.map { it.record.recordId })
        ) {
            throw invalidResponse()
        }
    }

    private fun canonicalDigest(value: JsonElement): String {
        val bytes = MessageDigest.getInstance("SHA-256").digest(canonicalJson(value).toByteArray(Charsets.UTF_8))
        return "sha256:" + bytes.joinToString("") { byte ->
            (byte.toInt() and 0xff).toString(16).padStart(2, '0')
        }
    }

    private fun canonicalJson(value: JsonElement): String = when {
        value.isJsonObject -> value.asJsonObject.keySet().sorted().joinToString(",", "{", "}") { key ->
            "${JsonPrimitive(key)}:${canonicalJson(value.asJsonObject.get(key))}"
        }
        value.isJsonArray -> value.asJsonArray.joinToString(",", "[", "]") { canonicalJson(it) }
        else -> value.toString()
    }

    private fun readJsonValue(reader: JsonReader, depth: Int): JsonElement {
        if (depth > MAX_JSON_DEPTH) throw invalidResponse()
        return when (reader.peek()) {
            JsonToken.BEGIN_OBJECT -> {
                reader.beginObject()
                val value = JsonObject()
                var entries = 0
                while (reader.hasNext()) {
                    if (++entries > MAX_JSON_COLLECTION_ENTRIES) throw invalidResponse()
                    val name = reader.nextName()
                    if (value.has(name)) throw invalidResponse()
                    value.add(name, readJsonValue(reader, depth + 1))
                }
                reader.endObject()
                value
            }
            JsonToken.BEGIN_ARRAY -> {
                reader.beginArray()
                val value = JsonArray()
                var entries = 0
                while (reader.hasNext()) {
                    if (++entries > MAX_JSON_COLLECTION_ENTRIES) throw invalidResponse()
                    value.add(readJsonValue(reader, depth + 1))
                }
                reader.endArray()
                value
            }
            JsonToken.STRING -> JsonPrimitive(reader.nextString())
            JsonToken.NUMBER -> JsonPrimitive(BigDecimal(reader.nextString()))
            JsonToken.BOOLEAN -> JsonPrimitive(reader.nextBoolean())
            JsonToken.NULL -> {
                reader.nextNull()
                JsonNull.INSTANCE
            }
            else -> throw invalidResponse()
        }
    }

    private fun JsonElement?.requireObject(): JsonObject =
        this?.takeIf(JsonElement::isJsonObject)?.asJsonObject ?: throw invalidResponse()

    private fun JsonElement.requireString(): String =
        takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isString }?.asString ?: throw invalidResponse()

    private fun JsonObject.requireString(name: String): String = get(name)?.requireString() ?: throw invalidResponse()

    private fun JsonObject.requireBoolean(name: String): Boolean {
        val value = get(name)
        if (value == null || !value.isJsonPrimitive || !value.asJsonPrimitive.isBoolean) throw invalidResponse()
        return value.asBoolean
    }

    private fun JsonObject.requireInt(name: String): Int {
        val value = get(name)
        if (value == null || !value.isJsonPrimitive || !value.asJsonPrimitive.isNumber) throw invalidResponse()
        return try {
            value.asBigDecimal.toBigIntegerExact().intValueExact()
        } catch (_: ArithmeticException) {
            throw invalidResponse()
        }
    }

    private fun JsonObject.requireBoundedNonNegativeInt(name: String, maximum: Int): Int =
        requireInt(name).takeIf { it in 0..maximum } ?: throw invalidResponse()

    private fun JsonObject.requireBoundedNonNegativeLong(name: String, maximum: Long): Long =
        requireLong(name).takeIf { it in 0..maximum } ?: throw invalidResponse()

    private fun JsonObject.requireOneOf(name: String, values: Set<String>): String =
        requireString(name).takeIf(values::contains) ?: throw invalidResponse()

    private fun JsonObject.requireNonEmptyUuid(name: String): UUID =
        parseNonEmptyUuid(get(name)?.requireString() ?: throw invalidResponse())

    private fun JsonObject.requireLong(name: String): Long {
        val value = get(name)
        if (value == null || !value.isJsonPrimitive || !value.asJsonPrimitive.isNumber) throw invalidResponse()
        return try {
            value.asBigDecimal.toBigIntegerExact().longValueExact()
        } catch (_: ArithmeticException) {
            throw invalidResponse()
        }
    }

    private fun JsonObject.requireDigest(name: String): String =
        requireString(name).takeIf(digestPattern::matches) ?: throw invalidResponse()

    private fun JsonObject.requireInstant(name: String): Instant = parseInstant(get(name) ?: throw invalidResponse())

    private fun parseInstant(value: JsonElement): Instant = try {
        Instant.parse(value.requireString())
    } catch (_: Exception) {
        throw invalidResponse()
    }

    private fun JsonObject.requireExactKeys(vararg names: String) {
        if (keySet() != names.toSet()) throw invalidResponse()
    }

    private fun JsonObject.requireKeys(required: Set<String>, optional: Set<String>) {
        if (!keySet().containsAll(required) || !keySet().all { it in required || it in optional }) throw invalidResponse()
    }

    private fun parseUuid(value: String): UUID {
        if (!uuidPattern.matches(value)) throw invalidResponse()
        return try {
            UUID.fromString(value)
        } catch (_: IllegalArgumentException) {
            throw invalidResponse()
        }
    }

    private fun parseNonEmptyUuid(value: String): UUID =
        parseUuid(value).takeIf { it != UUID(0, 0) } ?: throw invalidResponse()

    private fun isNetworkPath(path: String): Boolean = path.startsWith("//") || path.startsWith("\\\\")
}
