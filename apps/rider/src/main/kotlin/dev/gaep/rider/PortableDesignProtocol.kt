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

    fun validateManagedEvidencePage(offset: Int, limit: Int, snapshotDigest: String?) {
        require(offset in 0..2_000) { "Managed Run offset must be between 0 and 2000" }
        require(limit in 1..200) { "Managed Run limit must be between 1 and 200" }
        require(snapshotDigest == null || digestPattern.matches(snapshotDigest)) {
            "Managed Run snapshot digest must be SHA-256"
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
        return ProductBinding(id, name, revision)
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
        if (limit < 1 || offset != expectedOffset || limit != expectedLimit || rawItems.size() > limit ||
            offset.toLong() + rawItems.size() > total.toLong() || omittedCount != total - rawItems.size()
        ) {
            throw invalidResponse()
        }
        val items = rawItems.map { parseManagedRunSummary(it.requireObject()) }.toList()
        if (items.map { it.managedRunId }.distinct().size != items.size) throw invalidResponse()
        val snapshotDigest = page.requireDigest("snapshotDigest")
        if (expectedSnapshotDigest != null && snapshotDigest != expectedSnapshotDigest) throw invalidResponse()
        val hasMore = page.requireBoolean("hasMore")
        if (hasMore != (offset.toLong() + items.size < total.toLong())) throw invalidResponse()
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
