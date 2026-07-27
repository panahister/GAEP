package dev.gaep.rider

import com.intellij.openapi.Disposable
import com.intellij.openapi.diagnostic.Logger
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import java.io.BufferedWriter
import java.io.ByteArrayOutputStream
import java.io.Closeable
import java.io.InputStream
import java.io.OutputStream
import java.io.OutputStreamWriter
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.nio.charset.CharacterCodingException
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.Path
import java.security.MessageDigest
import java.util.Locale
import java.util.UUID
import java.util.concurrent.atomic.AtomicLong

data class PackagedEngineModule(
    val path: Path,
    val expectedSha256: String,
)

private val safeEngineEnvironmentNames = listOf(
    "PATH", "LANG", "LC_ALL", "LC_CTYPE", "TMPDIR", "TMP", "TEMP",
    "SYSTEMROOT", "WINDIR", "PATHEXT", "COMSPEC",
)

internal fun safeRiderEngineEnvironment(source: Map<String, String>): Map<String, String> = buildMap {
    safeEngineEnvironmentNames.forEach { requested ->
        source.entries.firstOrNull { it.key.equals(requested, ignoreCase = true) }?.let { put(requested, it.value) }
    }
    put("GAEP_HOST_SURFACE", "rider-product-studio")
}

class GaepEngineClient(
    private val workspace: Path,
    private val requestedEngineExecutable: String,
    expectedEngineSha256: String? = System.getenv("GAEP_ENGINE_SHA256"),
    private val packagedEngineModule: PackagedEngineModule? = null,
    sourceEnvironment: Map<String, String> = System.getenv(),
) : Closeable, Disposable {
    private data class EngineIdentity(val path: Path, val digest: String)

    private val log = Logger.getInstance(GaepEngineClient::class.java)
    private val ids = AtomicLong(0)
    private val configuredEngineDigest = normalizeDigest(expectedEngineSha256)
    private val configuredPackagedEngineDigest = normalizeDigest(packagedEngineModule?.expectedSha256)
    private val childEnvironment = safeRiderEngineEnvironment(sourceEnvironment)
    private val pendingResponse = ByteArrayOutputStream()
    private val responseBuffer = ByteArray(8192)
    private var process: Process? = null
    private var responseInput: InputStream? = null
    private var writer: BufferedWriter? = null
    private var boundEnginePath: Path? = null
    private var boundEngineDigest: String? = null
    private var boundPackagedEnginePath: Path? = null
    private var boundPackagedEngineDigest: String? = null

    init {
        require(packagedEngineModule == null || configuredPackagedEngineDigest != null) {
            "Expected packaged engine SHA-256 must contain exactly 64 hexadecimal characters"
        }
    }

    private data class HostResponse(val raw: String, val envelope: JsonObject)

    @Synchronized
    fun readProductBinding(): ProductBinding = portableRequest(
        "readProduct",
        JsonObject(),
        protocolVersion = null,
    ) { envelope -> PortableDesignProtocol.parseProductBindingEnvelope(envelope) }

    @Synchronized
    fun readInitiative(initiativeId: UUID): InitiativeEntryRecord {
        require(initiativeId != UUID(0, 0)) { "Initiative ID must be a non-empty UUID" }
        val params = JsonObject().apply { addProperty("initiativeId", initiativeId.toString()) }
        return portableRequest("readInitiative", params) { envelope ->
            PortableDesignProtocol.parseInitiativeEnvelope(envelope, initiativeId)
        }
    }

    @Synchronized
    fun assessInitiativeEntry(initiativeId: UUID): InitiativeEntryAssessment {
        require(initiativeId != UUID(0, 0)) { "Initiative ID must be a non-empty UUID" }
        val params = JsonObject().apply { addProperty("initiativeId", initiativeId.toString()) }
        return portableRequest("assessInitiativeEntry", params) { envelope ->
            PortableDesignProtocol.parseInitiativeEntryAssessmentEnvelope(envelope, initiativeId)
        }
    }

    @Synchronized
    fun readSourceGovernance(initiativeId: UUID): SourceGovernanceProjection {
        require(initiativeId != UUID(0, 0)) { "Initiative ID must be a non-empty UUID" }
        val params = JsonObject().apply { addProperty("initiativeId", initiativeId.toString()) }
        return portableRequest("source.snapshot", params) { envelope ->
            PortableDesignProtocol.parseSourceGovernanceEnvelope(envelope, initiativeId)
        }
    }

    @Synchronized
    fun readBusinessUnderstanding(initiativeId: UUID): BusinessUnderstandingProjection {
        require(initiativeId != UUID(0, 0)) { "Initiative ID must be a non-empty UUID" }
        val params = JsonObject().apply { addProperty("initiativeId", initiativeId.toString()) }
        return portableRequest("business.snapshot", params) { envelope ->
            PortableDesignProtocol.parseBusinessUnderstandingEnvelope(envelope, initiativeId)
        }
    }

    @Synchronized
    fun readBusinessCapabilityMap(initiativeId: UUID): BusinessCapabilityMapProjection {
        require(initiativeId != UUID(0, 0)) { "Initiative ID must be a non-empty UUID" }
        val params = JsonObject().apply { addProperty("initiativeId", initiativeId.toString()) }
        return portableRequest("business.capabilities.snapshot", params) { envelope ->
            PortableDesignProtocol.parseBusinessCapabilityMapEnvelope(envelope, initiativeId)
        }
    }

    @Synchronized
    fun readValueStreamModel(initiativeId: UUID): ValueStreamModelProjection {
        require(initiativeId != UUID(0, 0)) { "Initiative ID must be a non-empty UUID" }
        val params = JsonObject().apply { addProperty("initiativeId", initiativeId.toString()) }
        return portableRequest("business.valueStreams.snapshot", params) { envelope ->
            PortableDesignProtocol.parseValueStreamModelEnvelope(envelope, initiativeId)
        }
    }

    @Synchronized
    fun readOperatingModel(initiativeId: UUID): OperatingModelProjection {
        require(initiativeId != UUID(0, 0)) { "Initiative ID must be a non-empty UUID" }
        val params = JsonObject().apply { addProperty("initiativeId", initiativeId.toString()) }
        return portableRequest("business.operatingModels.snapshot", params) { envelope ->
            PortableDesignProtocol.parseOperatingModelEnvelope(envelope, initiativeId)
        }
    }

    @Synchronized
    fun readBusinessRuleCatalog(initiativeId: UUID): BusinessRuleCatalogProjection {
        require(initiativeId != UUID(0, 0)) { "Initiative ID must be a non-empty UUID" }
        val params = JsonObject().apply { addProperty("initiativeId", initiativeId.toString()) }
        return portableRequest("business.businessRules.snapshot", params) { envelope ->
            PortableDesignProtocol.parseBusinessRuleCatalogEnvelope(envelope, initiativeId)
        }
    }

    @Synchronized
    fun readBusinessArchitectureBaseline(initiativeId: UUID): BusinessArchitectureBaselineProjection {
        require(initiativeId != UUID(0, 0)) { "Initiative ID must be a non-empty UUID" }
        val params = JsonObject().apply { addProperty("initiativeId", initiativeId.toString()) }
        return portableRequest("business.architectureBaselines.snapshot", params) { envelope ->
            PortableDesignProtocol.parseBusinessArchitectureBaselineEnvelope(envelope, initiativeId)
        }
    }

    @Synchronized
    fun readSystemSolutionArchitecture(initiativeId: UUID): SystemSolutionArchitectureProjection {
        require(initiativeId != UUID(0, 0)) { "Initiative ID must be a non-empty UUID" }
        val params = JsonObject().apply { addProperty("initiativeId", initiativeId.toString()) }
        return portableRequest("architecture.systemSolution.snapshot", params) { envelope ->
            PortableDesignProtocol.parseSystemSolutionArchitectureEnvelope(envelope, initiativeId)
        }
    }

    @Synchronized
    fun readBoundedContextModel(initiativeId: UUID): BoundedContextModelProjection {
        require(initiativeId != UUID(0, 0)) { "Initiative ID must be a non-empty UUID" }
        val params = JsonObject().apply { addProperty("initiativeId", initiativeId.toString()) }
        return portableRequest("architecture.boundedContexts.snapshot", params) { envelope ->
            PortableDesignProtocol.parseBoundedContextModelEnvelope(envelope, initiativeId)
        }
    }

    @Synchronized
    fun readSecurityPrivacyAssessment(initiativeId: UUID): SecurityPrivacyAssessmentProjection {
        require(initiativeId != UUID(0, 0)) { "Initiative ID must be a non-empty UUID" }
        val params = JsonObject().apply { addProperty("initiativeId", initiativeId.toString()) }
        return portableRequest("security.privacyThreat.snapshot", params) { envelope ->
            PortableDesignProtocol.parseSecurityPrivacyAssessmentEnvelope(envelope, initiativeId)
        }
    }

    @Synchronized
    fun readProcessModel(initiativeId: UUID): ProcessModelProjection {
        require(initiativeId != UUID(0, 0)) { "Initiative ID must be a non-empty UUID" }
        val params = JsonObject().apply { addProperty("initiativeId", initiativeId.toString()) }
        return portableRequest("process.models.snapshot", params) { envelope ->
            PortableDesignProtocol.parseProcessModelEnvelope(envelope, initiativeId)
        }
    }

    @Synchronized
    fun readDataModel(initiativeId: UUID): DataModelProjection {
        require(initiativeId != UUID(0, 0)) { "Initiative ID must be a non-empty UUID" }
        val params = JsonObject().apply { addProperty("initiativeId", initiativeId.toString()) }
        return portableRequest("data.models.snapshot", params) { envelope ->
            PortableDesignProtocol.parseDataModelEnvelope(envelope, initiativeId)
        }
    }

    @Synchronized
    fun readAuthorizationModel(initiativeId: UUID): AuthorizationModelProjection {
        require(initiativeId != UUID(0, 0)) { "Initiative ID must be a non-empty UUID" }
        val params = JsonObject().apply { addProperty("initiativeId", initiativeId.toString()) }
        return portableRequest("authorization.models.snapshot", params) { envelope ->
            PortableDesignProtocol.parseAuthorizationModelEnvelope(envelope, initiativeId)
        }
    }

    @Synchronized
    fun readEventIntegrationModel(initiativeId: UUID): EventIntegrationModelProjection {
        require(initiativeId != UUID(0, 0)) { "Initiative ID must be a non-empty UUID" }
        val params = JsonObject().apply { addProperty("initiativeId", initiativeId.toString()) }
        return portableRequest("integration.models.snapshot", params) { envelope ->
            PortableDesignProtocol.parseEventIntegrationModelEnvelope(envelope, initiativeId)
        }
    }

    @Synchronized
    fun readFailureRecoveryModel(initiativeId: UUID): FailureRecoveryModelProjection {
        require(initiativeId != UUID(0, 0)) { "Initiative ID must be a non-empty UUID" }
        val params = JsonObject().apply { addProperty("initiativeId", initiativeId.toString()) }
        return portableRequest("recovery.models.snapshot", params) { envelope ->
            PortableDesignProtocol.parseFailureRecoveryModelEnvelope(envelope, initiativeId)
        }
    }

    @Synchronized
    fun readArchitectureChallengeModel(initiativeId: UUID): ArchitectureChallengeModelProjection {
        require(initiativeId != UUID(0, 0)) { "Initiative ID must be a non-empty UUID" }
        val params = JsonObject().apply { addProperty("initiativeId", initiativeId.toString()) }
        return portableRequest("challenge.models.snapshot", params) { envelope ->
            PortableDesignProtocol.parseArchitectureChallengeModelEnvelope(envelope, initiativeId)
        }
    }

    @Synchronized
    fun readDecisionRegister(initiativeId: UUID): DecisionRegisterProjection {
        require(initiativeId != UUID(0, 0)) { "Initiative ID must be a non-empty UUID" }
        val params = JsonObject().apply { addProperty("initiativeId", initiativeId.toString()) }
        return portableRequest("decision.registers.snapshot", params) { envelope ->
            PortableDesignProtocol.parseDecisionRegisterEnvelope(envelope, initiativeId)
        }
    }

    @Synchronized
    fun readRiskRegister(initiativeId: UUID): RiskRegisterProjection {
        require(initiativeId != UUID(0, 0)) { "Initiative ID must be a non-empty UUID" }
        val params = JsonObject().apply { addProperty("initiativeId", initiativeId.toString()) }
        return portableRequest("risk.registers.snapshot", params) { envelope ->
            PortableDesignProtocol.parseRiskRegisterEnvelope(envelope, initiativeId)
        }
    }

    @Synchronized
    fun readEvidenceRegistry(initiativeId: UUID): EvidenceRegistryProjection {
        require(initiativeId != UUID(0, 0)) { "Initiative ID must be a non-empty UUID" }
        val params = JsonObject().apply { addProperty("initiativeId", initiativeId.toString()) }
        return portableRequest("evidence.registries.snapshot", params) { envelope ->
            PortableDesignProtocol.parseEvidenceRegistryEnvelope(envelope, initiativeId)
        }
    }

    @Synchronized
    fun readEndToEndTraceability(initiativeId: UUID): EndToEndTraceabilityProjection {
        require(initiativeId != UUID(0, 0)) { "Initiative ID must be a non-empty UUID" }
        val params = JsonObject().apply { addProperty("initiativeId", initiativeId.toString()) }
        return portableRequest("traceability.graphs.snapshot", params) { envelope ->
            PortableDesignProtocol.parseEndToEndTraceabilityEnvelope(envelope, initiativeId)
        }
    }

    @Synchronized
    fun classifyInitiative(
        initiativeId: UUID,
        expectedInitiativeRevision: Long,
        classification: InitiativeClassificationInput,
        actorId: String,
    ): InitiativeEntryRecord {
        require(initiativeId != UUID(0, 0)) { "Initiative ID must be a non-empty UUID" }
        PortableDesignProtocol.validateProductRevision(expectedInitiativeRevision)
        val normalizedActorId = PortableDesignProtocol.normalizeActorId(actorId)
        val classificationJson = PortableDesignProtocol.initiativeClassificationInputToJson(classification)
        val params = JsonObject().apply {
            addProperty("initiativeId", initiativeId.toString())
            addProperty("expectedInitiativeRevision", expectedInitiativeRevision)
            addProperty("actorId", normalizedActorId)
            add("classification", classificationJson)
        }
        return portableRequest("classifyInitiative", params) { envelope ->
            PortableDesignProtocol.parseInitiativeEnvelope(
                envelope,
                expectedInitiativeId = initiativeId,
                expectedRevision = expectedInitiativeRevision,
                expectedActorId = normalizedActorId,
                expectedClassificationInput = classificationJson,
            )
        }
    }

    @Synchronized
    fun resolveInitiativeApplicability(
        initiativeId: UUID,
        expectedInitiativeRevision: Long,
        applicability: InitiativeApplicabilityMatrixInput,
        actorId: String,
    ): InitiativeEntryRecord {
        require(initiativeId != UUID(0, 0)) { "Initiative ID must be a non-empty UUID" }
        PortableDesignProtocol.validateProductRevision(expectedInitiativeRevision)
        val normalizedActorId = PortableDesignProtocol.normalizeActorId(actorId)
        val completedApplicability = PortableDesignProtocol.completeInitiativeApplicabilityCoverage(
            applicability,
            normalizedActorId,
        )
        val applicabilityJson = PortableDesignProtocol.initiativeApplicabilityInputToJson(completedApplicability)
        val params = JsonObject().apply {
            addProperty("initiativeId", initiativeId.toString())
            addProperty("expectedInitiativeRevision", expectedInitiativeRevision)
            addProperty("actorId", normalizedActorId)
            add("applicability", applicabilityJson)
        }
        return portableRequest("resolveInitiativeApplicability", params) { envelope ->
            PortableDesignProtocol.parseInitiativeEnvelope(
                envelope,
                expectedInitiativeId = initiativeId,
                expectedRevision = expectedInitiativeRevision,
                expectedActorId = normalizedActorId,
                expectedApplicabilityInput = applicabilityJson,
            )
        }
    }

    @Synchronized
    fun readPhaseDashboard(
        product: ProductBinding,
        phase: DeliveryPhaseId = DeliveryPhaseId.PHASE_0_1A_FOUNDATION,
    ): PhaseDashboardFramework {
        PortableDesignProtocol.validateProductId(product.id)
        PortableDesignProtocol.validateProductRevision(product.revision)
        require(Regex("^sha256:[0-9a-f]{64}$").matches(product.digest)) { "Product digest must be SHA-256" }
        val params = JsonObject().apply {
            addProperty("phase", phase.wireValue)
            addProperty("expectedProductId", product.id.toString())
            addProperty("expectedProductRevision", product.revision)
            addProperty("expectedProductDigest", product.digest)
        }
        return portableRequest("dashboard.framework", params) { envelope ->
            PortableDesignProtocol.parsePhaseDashboardEnvelope(envelope, phase, product)
        }
    }

    @Synchronized
    fun listChangeImpactChanges(product: ProductBinding): ChangeImpactChangeCatalog {
        PortableDesignProtocol.validateProductId(product.id)
        PortableDesignProtocol.validateProductRevision(product.revision)
        require(Regex("^sha256:[0-9a-f]{64}$").matches(product.digest)) { "Product digest must be SHA-256" }
        val params = JsonObject().apply {
            addProperty("expectedProductId", product.id.toString())
            addProperty("expectedProductRevision", product.revision)
            addProperty("expectedProductDigest", product.digest)
        }
        return portableRequest("dashboard.changeImpact.changes", params) { envelope ->
            PortableDesignProtocol.parseChangeImpactChangeCatalogEnvelope(envelope, product)
        }
    }

    @Synchronized
    fun readChangeImpact(
        product: ProductBinding,
        change: ChangeImpactChangeReference,
    ): ChangeImpactDashboard {
        PortableDesignProtocol.validateProductId(product.id)
        PortableDesignProtocol.validateProductRevision(product.revision)
        PortableDesignProtocol.validateProductId(change.recordId)
        PortableDesignProtocol.validateProductRevision(change.revision)
        require(
            Regex("^sha256:[0-9a-f]{64}$").matches(product.digest) &&
                Regex("^sha256:[0-9a-f]{64}$").matches(change.digest),
        ) { "Product and Change digests must be SHA-256" }
        val params = JsonObject().apply {
            addProperty("expectedProductId", product.id.toString())
            addProperty("expectedProductRevision", product.revision)
            addProperty("expectedProductDigest", product.digest)
            addProperty("expectedChangeId", change.recordId.toString())
            addProperty("expectedChangeRevision", change.revision)
            addProperty("expectedChangeDigest", change.digest)
        }
        return portableRequest("dashboard.changeImpact", params) { envelope ->
            PortableDesignProtocol.parseChangeImpactDashboardEnvelope(envelope, product, change)
        }
    }

    @Synchronized
    fun readAgentModel(product: ProductBinding): AgentModelDashboard {
        PortableDesignProtocol.validateProductId(product.id)
        PortableDesignProtocol.validateProductRevision(product.revision)
        require(Regex("^sha256:[0-9a-f]{64}$").matches(product.digest)) { "Product digest must be SHA-256" }
        val capabilities = probeAgentReadiness()
        val selection = readAgentSelection()
        val expectedSelection = JsonObject().apply {
            when (selection) {
                AgentSelectionState.Unselected -> addProperty("status", "unselected")
                AgentSelectionState.Invalid -> addProperty("status", "invalid")
                is AgentSelectionState.Selected -> {
                    addProperty("status", "selected")
                    addProperty("selectionDigest", selection.selection.selectionDigest)
                }
                is AgentSelectionState.MigrationRequired -> {
                    addProperty("status", "migration-required")
                    addProperty("selectionDigest", selection.portableCandidate.selectionDigest)
                }
            }
        }
        val expectedCapabilities = JsonArray().apply {
            capabilities.sortedBy { "${it.adapterId}:${it.agentId}" }.forEach { capability ->
                add(JsonObject().apply {
                    addProperty("adapterId", capability.adapterId)
                    addProperty("agentId", capability.agentId)
                    addProperty("capabilityDigest", capability.capabilityDigest)
                })
            }
        }
        val params = JsonObject().apply {
            addProperty("expectedProductId", product.id.toString())
            addProperty("expectedProductRevision", product.revision)
            addProperty("expectedProductDigest", product.digest)
            add("expectedSelection", expectedSelection)
            add("expectedCapabilities", expectedCapabilities)
        }
        return portableRequest("dashboard.agentModel", params) { envelope ->
            PortableDesignProtocol.parseAgentModelDashboardEnvelope(
                envelope,
                expectedProduct = product,
                expectedCapabilities = capabilities,
                expectedSelection = selection,
            )
        }
    }

    @Synchronized
    fun probeAgentReadiness(): List<AgentReadinessSnapshot> = portableRequest(
        "probeAgents",
        JsonObject(),
        protocolVersion = null,
    ) { envelope -> PortableDesignProtocol.parseAgentReadinessEnvelope(envelope) }

    @Synchronized
    fun readAgentSelection(): AgentSelectionState = portableRequest(
        "readAgentSelection",
        JsonObject(),
    ) { envelope -> PortableDesignProtocol.parseAgentSelectionStateEnvelope(envelope) }

    @Synchronized
    fun selectAgent(
        adapterId: String,
        modelId: String,
        settings: Map<String, PortableAgentSettingValue>,
        actorId: String,
    ): AgentSelection {
        val normalizedAdapterId = PortableDesignProtocol.normalizeSelectionIdentifier(adapterId, "Adapter ID")
        val normalizedModelId = PortableDesignProtocol.normalizeSelectionIdentifier(modelId, "Model ID")
        val normalizedActorId = PortableDesignProtocol.normalizeActorId(actorId)
        val params = JsonObject().apply {
            addProperty("adapterId", normalizedAdapterId)
            addProperty("modelId", normalizedModelId)
            add("settings", PortableDesignProtocol.portableSelectionSettingsToJson(settings))
            addProperty("actorId", normalizedActorId)
        }
        return portableRequest("selectAgent", params) { envelope ->
            PortableDesignProtocol.parseAgentSelectionEnvelope(envelope)
        }
    }

    @Synchronized
    fun listRuns(): List<AgentRun> = portableRequest(
        "listRuns",
        JsonObject(),
    ) { envelope -> PortableDesignProtocol.parseAgentRunsEnvelope(envelope) }

    @Synchronized
    fun createHandoff(
        fromRunId: UUID,
        productId: UUID,
        initiativeId: UUID,
        toAdapterId: String,
        toAgentId: String,
        toModelId: String,
        toSettings: Map<String, PortableAgentSettingValue>,
        reason: String,
        completedWork: List<String>,
        unresolvedMatters: List<String>,
        decisions: List<String>,
        evidence: List<String>,
        actorId: String,
    ): AgentHandoff {
        require(fromRunId != UUID(0, 0)) { "Source Run ID must be a non-empty UUID" }
        require(productId != UUID(0, 0)) { "Product ID must be a non-empty UUID" }
        require(initiativeId != UUID(0, 0)) { "Initiative ID must be a non-empty UUID" }
        val normalizedAdapterId = PortableDesignProtocol.normalizeSelectionIdentifier(toAdapterId, "Target Adapter ID")
        val normalizedAgentId = PortableDesignProtocol.normalizeSelectionIdentifier(toAgentId, "Target Agent ID")
        val normalizedModelId = PortableDesignProtocol.normalizeSelectionIdentifier(toModelId, "Target Model ID")
        val normalizedReason = PortableDesignProtocol.normalizeHandoffText(reason, "Handoff reason", 2, 5_000)
        val normalizedCompleted = PortableDesignProtocol.normalizeHandoffTextList(completedWork, "Completed work")
        val normalizedUnresolved = PortableDesignProtocol.normalizeHandoffTextList(unresolvedMatters, "Unresolved matters")
        val normalizedDecisions = PortableDesignProtocol.normalizeHandoffTextList(decisions, "Decisions")
        val normalizedEvidence = PortableDesignProtocol.normalizeHandoffTextList(evidence, "Evidence")
        val normalizedActorId = PortableDesignProtocol.normalizeActorId(actorId)
        val handoff = JsonObject().apply {
            addProperty("fromRunId", fromRunId.toString())
            addProperty("toAdapterId", normalizedAdapterId)
            addProperty("toModelId", normalizedModelId)
            add("toSettings", PortableDesignProtocol.portableSelectionSettingsToJson(toSettings))
            addProperty("reason", normalizedReason)
            add("completedWork", normalizedCompleted.toJsonArray())
            add("unresolvedMatters", normalizedUnresolved.toJsonArray())
            add("decisions", normalizedDecisions.toJsonArray())
            add("evidence", normalizedEvidence.toJsonArray())
        }
        val params = JsonObject().apply {
            addProperty("actorId", normalizedActorId)
            add("handoff", handoff)
        }
        return portableRequest("createHandoff", params) { envelope ->
            PortableDesignProtocol.parseAgentHandoffEnvelope(
                envelope,
                expectedFromRunId = fromRunId,
                expectedProductId = productId,
                expectedInitiativeId = initiativeId,
                expectedAdapterId = normalizedAdapterId,
                expectedAgentId = normalizedAgentId,
                expectedModelId = normalizedModelId,
                expectedSettings = toSettings,
                expectedReason = normalizedReason,
                expectedCompletedWork = normalizedCompleted,
                expectedUnresolvedMatters = normalizedUnresolved,
                expectedDecisions = normalizedDecisions,
                expectedEvidence = normalizedEvidence,
            )
        }
    }

    @Synchronized
    fun previewManagedReadOnly(
        charterId: UUID,
        workflowPlanId: UUID,
    ): ManagedReadOnlyPreview {
        require(charterId != UUID(0, 0)) { "Charter ID must be a non-empty UUID" }
        require(workflowPlanId != UUID(0, 0)) { "Workflow Plan ID must be a non-empty UUID" }
        val params = JsonObject().apply {
            addProperty("charterId", charterId.toString())
            addProperty("workflowPlanId", workflowPlanId.toString())
        }
        return portableRequest("managed.readonly.preview", params) { envelope ->
            PortableDesignProtocol.parseManagedReadOnlyPreviewEnvelope(
                envelope,
                expectedCharterId = charterId,
                expectedWorkflowPlanId = workflowPlanId,
            )
        }
    }

    @Synchronized
    fun executeManagedReadOnly(
        preview: ManagedReadOnlyPreview,
        timeoutMs: Int,
        actorId: String,
    ): ManagedReadOnlyReceipt {
        PortableDesignProtocol.validateManagedReadOnlyPreview(preview)
        require(timeoutMs in 1_000..300_000) {
            "Managed read-only timeout must be between 1,000 and 300,000 milliseconds"
        }
        val normalizedActorId = PortableDesignProtocol.normalizeActorId(actorId)
        val params = JsonObject().apply {
            addProperty("actorId", normalizedActorId)
            addProperty("charterId", preview.charterId.toString())
            addProperty("workflowPlanId", preview.workflowPlanId.toString())
            addProperty("expectedPreviewDigest", preview.previewDigest)
            addProperty("timeoutMs", timeoutMs)
            addProperty("confirmation", "attest-exact-managed-readonly-preview")
        }
        return portableRequest("managed.readonly.execute", params) { envelope ->
            PortableDesignProtocol.parseManagedReadOnlyReceiptEnvelope(envelope, preview)
        }
    }

    @Synchronized
    fun listManagedEvidence(
        offset: Int = 0,
        limit: Int = 100,
        snapshotDigest: String? = null,
        expectedTotal: Int? = null,
    ): ManagedRunSummaryPage {
        PortableDesignProtocol.validateManagedEvidencePage(offset, limit, snapshotDigest, expectedTotal)
        val params = JsonObject().apply {
            addProperty("offset", offset)
            addProperty("limit", limit)
            snapshotDigest?.let { addProperty("snapshotDigest", it) }
        }
        return portableRequest("managed.evidence.list", params) { envelope ->
            PortableDesignProtocol.parseManagedRunSummaryPageEnvelope(
                envelope,
                expectedOffset = offset,
                expectedLimit = limit,
                expectedSnapshotDigest = snapshotDigest,
                expectedTotal = expectedTotal,
            )
        }
    }

    @Synchronized
    fun readManagedEvidence(managedRunId: UUID): ManagedEvidenceDetail {
        require(managedRunId != UUID(0, 0)) { "Managed Run ID must be a non-empty UUID" }
        val params = JsonObject().apply { addProperty("managedRunId", managedRunId.toString()) }
        return portableRequest("managed.evidence.read", params) { envelope ->
            PortableDesignProtocol.parseManagedEvidenceDetailEnvelope(envelope, managedRunId)
        }
    }

    @Synchronized
    fun readManagedReview(managedRunId: UUID): ManagedReviewPreview {
        require(managedRunId != UUID(0, 0)) { "Managed Run ID must be a non-empty UUID" }
        val params = JsonObject().apply { addProperty("managedRunId", managedRunId.toString()) }
        return portableRequest("managed.review.read", params) { envelope ->
            PortableDesignProtocol.parseManagedReviewPreviewEnvelope(envelope, managedRunId)
        }
    }

    @Synchronized
    fun applyManagedReview(preview: ManagedReviewPreview, actorId: String): ManagedReviewTransition =
        decideManagedReview(preview, actorId, "apply-exact-managed-review")

    @Synchronized
    fun discardManagedReview(preview: ManagedReviewPreview, actorId: String): ManagedReviewTransition =
        decideManagedReview(preview, actorId, "discard-exact-managed-review")

    private fun decideManagedReview(
        preview: ManagedReviewPreview,
        actorId: String,
        decision: String,
    ): ManagedReviewTransition {
        PortableDesignProtocol.validateManagedReviewPreview(preview)
        require(decision in setOf("apply-exact-managed-review", "discard-exact-managed-review")) {
            "Managed review decision is invalid"
        }
        val normalizedActorId = PortableDesignProtocol.normalizeActorId(actorId)
        val method = if (decision == "apply-exact-managed-review") "managed.review.apply" else "managed.review.discard"
        val params = JsonObject().apply {
            addProperty("actorId", normalizedActorId)
            addProperty("managedRunId", preview.managedRunId.toString())
            addProperty("expectedManagedRunRevision", preview.managedRunRevision)
            addProperty("expectedPreviewDigest", preview.previewDigest)
            addProperty("confirmation", decision)
        }
        return portableRequest(method, params) { envelope ->
            PortableDesignProtocol.parseManagedReviewTransitionEnvelope(envelope, preview, decision)
        }
    }

    @Synchronized
    fun importPortableDesignSnapshot(
        bundleRoot: Path,
        expectedProductId: UUID,
        expectedProductRevision: Long,
        actorId: String,
    ): PortableDesignSnapshotSummary {
        PortableDesignProtocol.validateProductId(expectedProductId)
        val normalizedBundleRoot = PortableDesignProtocol.normalizeBundleRoot(bundleRoot)
        PortableDesignProtocol.validateProductRevision(expectedProductRevision)
        val normalizedActorId = PortableDesignProtocol.normalizeActorId(actorId)
        val params = JsonObject().apply {
            addProperty("bundleRoot", normalizedBundleRoot.toString())
            addProperty("expectedProductId", expectedProductId.toString())
            addProperty("expectedProductRevision", expectedProductRevision)
            addProperty("actorId", normalizedActorId)
        }
        return portableRequest("productStudio.portableDesign.import", params) { envelope ->
            PortableDesignProtocol.parseSnapshotEnvelope(envelope, expectedProductId = expectedProductId)
        }
    }

    @Synchronized
    fun listPortableDesignSnapshots(
        offset: Int = 0,
        limit: Int = PortableDesignProtocol.DEFAULT_PAGE_SIZE,
    ): PortableDesignSnapshotPage {
        PortableDesignProtocol.validatePage(offset, limit)
        val params = JsonObject().apply {
            addProperty("offset", offset)
            addProperty("limit", limit)
        }
        return portableRequest("productStudio.portableDesign.list", params) { envelope ->
            PortableDesignProtocol.parsePageEnvelope(envelope, offset, limit)
        }
    }

    @Synchronized
    fun readPortableDesignSnapshot(bundleId: UUID): PortableDesignSnapshotSummary {
        PortableDesignProtocol.validateBundleId(bundleId)
        val params = JsonObject().apply { addProperty("bundleId", bundleId.toString()) }
        return portableRequest("productStudio.portableDesign.read", params) { envelope ->
            PortableDesignProtocol.parseSnapshotEnvelope(envelope, expectedBundleId = bundleId)
        }
    }

    @Synchronized
    fun request(method: String, paramsJson: String = "{}"): String {
        val params = PortableDesignProtocol.parseStrictObject(paramsJson)
        return requestInternal(method, params, protocolVersion = null).raw
    }

    private fun requestInternal(method: String, params: JsonObject, protocolVersion: Int?): HostResponse {
        try {
            ensureStarted()
            val id = ids.incrementAndGet()
            val request = JsonObject().apply {
                addProperty("jsonrpc", "2.0")
                addProperty("id", id)
                addProperty("method", method)
                add("params", params)
                if (protocolVersion != null) addProperty("protocolVersion", protocolVersion)
            }.toString()
            if (request.toByteArray(Charsets.UTF_8).size > PortableDesignProtocol.MAX_FRAME_BYTES) {
                throw GaepHostException(
                    -32_001,
                    "FRAME_TOO_LARGE",
                    "The GAEP engine request exceeded the configured frame boundary.",
                )
            }
            writer!!.apply {
                write(request)
                newLine()
                flush()
            }
            val response = readBoundedResponse()
            val envelope = PortableDesignProtocol.parseStrictObject(response)
            val responseId = envelope.get("id")
            val numericId = responseId
                ?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isNumber }
                ?.let { runCatching { it.asBigDecimal }.getOrNull() }
            if (numericId == null || numericId.compareTo(java.math.BigDecimal.valueOf(id)) != 0) {
                throw PortableDesignProtocol.invalidResponse()
            }
            return HostResponse(response, envelope)
        } catch (error: Exception) {
            stopProcess()
            throw error
        }
    }

    private fun <T> portableRequest(
        method: String,
        params: JsonObject,
        protocolVersion: Int? = PortableDesignProtocol.PROTOCOL_VERSION,
        parse: (JsonObject) -> T,
    ): T {
        val response = try {
            requestInternal(method, params, protocolVersion)
        } catch (error: GaepHostException) {
            throw error
        } catch (_: Exception) {
            throw PortableDesignProtocol.hostUnavailable()
        }
        return try {
            parse(response.envelope)
        } catch (error: GaepHostException) {
            if (error.kind == "HOST_RESPONSE_INVALID") stopProcess()
            throw error
        } catch (_: Exception) {
            stopProcess()
            throw PortableDesignProtocol.invalidResponse()
        }
    }

    @Synchronized
    private fun ensureStarted() {
        if (process?.isAlive == true) return
        stopProcess()
        val identity = resolveAndVerifyEngine()
        val packagedIdentity = resolveAndVerifyPackagedEngine()
        val command = buildList {
            add(identity.path.toString())
            packagedIdentity?.let { add(it.path.toString()) }
            add("--workspace")
            add(workspace.toAbsolutePath().normalize().toString())
        }
        val builder = ProcessBuilder(command).redirectError(ProcessBuilder.Redirect.PIPE)
        builder.environment().apply {
            clear()
            putAll(childEnvironment)
        }
        val started = builder.start()
        try {
            Thread({
                started.errorStream.use { input -> input.transferTo(OutputStream.nullOutputStream()) }
            }, "gaep-engine-stderr-drain").apply {
                isDaemon = true
                start()
            }
            check(digest(identity.path) == identity.digest) {
                "The GAEP engine executable changed while the host process was starting"
            }
            check(packagedIdentity == null || digest(packagedIdentity.path) == packagedIdentity.digest) {
                "The packaged GAEP engine changed while the host process was starting"
            }
            process = started
            responseInput = started.inputStream
            writer = BufferedWriter(OutputStreamWriter(started.outputStream, Charsets.UTF_8))
            pendingResponse.reset()
            log.info("Verified GAEP engine host started for the selected workspace")
        } catch (error: Exception) {
            runCatching { started.outputStream.close() }
            runCatching { started.inputStream.close() }
            runCatching { started.errorStream.close() }
            runCatching { started.descendants().forEach { it.destroyForcibly() } }
            runCatching { started.destroyForcibly() }
            throw error
        }
    }

    private fun resolveAndVerifyEngine(): EngineIdentity {
        val path = resolveExecutable(requestedEngineExecutable)
        val digest = digest(path)
        check(configuredEngineDigest == null || configuredEngineDigest == digest) {
            "The GAEP engine executable does not match the configured SHA-256 digest"
        }
        check(boundEnginePath == null || samePath(boundEnginePath!!, path)) {
            "The resolved GAEP engine executable changed after this client was bound"
        }
        check(boundEngineDigest == null || boundEngineDigest == digest) {
            "The bound GAEP engine executable changed after this client was created"
        }
        if (boundEnginePath == null) boundEnginePath = path
        if (boundEngineDigest == null) boundEngineDigest = digest
        return EngineIdentity(path, digest)
    }

    private fun resolveAndVerifyPackagedEngine(): EngineIdentity? {
        val requested = packagedEngineModule ?: return null
        val path = resolveAbsoluteRegularFile(requested.path)
        val digest = digest(path)
        check(configuredPackagedEngineDigest == digest) {
            "The packaged GAEP engine does not match its embedded SHA-256 digest"
        }
        check(boundPackagedEnginePath == null || samePath(boundPackagedEnginePath!!, path)) {
            "The resolved packaged GAEP engine changed after this client was bound"
        }
        check(boundPackagedEngineDigest == null || boundPackagedEngineDigest == digest) {
            "The bound packaged GAEP engine changed after this client was created"
        }
        if (boundPackagedEnginePath == null) boundPackagedEnginePath = path
        if (boundPackagedEngineDigest == null) boundPackagedEngineDigest = digest
        return EngineIdentity(path, digest)
    }

    private fun resolveExecutable(requested: String): Path {
        val raw = Path.of(requested)
        val candidates = if (raw.isAbsolute || raw.parent != null) {
            listOf(raw.toAbsolutePath().normalize())
        } else {
            val extensions = if (isWindows()) {
                (environmentValue(childEnvironment, "PATHEXT") ?: ".EXE;.CMD;.BAT")
                    .split(';').filter(String::isNotBlank)
            } else {
                listOf("")
            }
            (environmentValue(childEnvironment, "PATH") ?: "").split(java.io.File.pathSeparatorChar)
                .filter(String::isNotBlank)
                .flatMap { directory ->
                    extensions.map { extension ->
                        val name = if (requested.endsWith(extension, ignoreCase = true)) requested else requested + extension
                        Path.of(directory, name)
                    }
                }
        }
        val selected = candidates.firstOrNull { Files.isRegularFile(it, LinkOption.NOFOLLOW_LINKS) || Files.isSymbolicLink(it) }
            ?: error("The GAEP engine executable could not be resolved to an existing file")
        val canonical = selected.toRealPath()
        check(Files.isRegularFile(canonical, LinkOption.NOFOLLOW_LINKS)) {
            "The resolved GAEP engine executable is not a regular file"
        }
        return canonical
    }

    private fun resolveAbsoluteRegularFile(requested: Path): Path {
        require(requested.isAbsolute) { "The packaged GAEP engine path must be absolute" }
        val normalized = requested.normalize()
        check(Files.isRegularFile(normalized, LinkOption.NOFOLLOW_LINKS) || Files.isSymbolicLink(normalized)) {
            "The packaged GAEP engine could not be resolved to an existing file"
        }
        val canonical = normalized.toRealPath()
        check(Files.isRegularFile(canonical, LinkOption.NOFOLLOW_LINKS)) {
            "The resolved packaged GAEP engine is not a regular file"
        }
        return canonical
    }

    private fun digest(path: Path): String = Files.newInputStream(path).use { input ->
        val hasher = MessageDigest.getInstance("SHA-256")
        val buffer = ByteArray(8192)
        while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            if (read > 0) hasher.update(buffer, 0, read)
        }
        hasher.digest().joinToString("") { byte -> "%02x".format(byte.toInt() and 0xff) }
    }

    private fun readBoundedResponse(): String {
        while (true) {
            val buffered = pendingResponse.toByteArray()
            val newline = buffered.indexOf('\n'.code.toByte())
            if (newline >= 0) {
                if (newline > PortableDesignProtocol.MAX_FRAME_BYTES) {
                    throw GaepHostException(
                        -32_002,
                        "RESPONSE_TOO_LARGE",
                        "The GAEP engine response exceeded the configured frame boundary.",
                    )
                }
                val length = if (newline > 0 && buffered[newline - 1] == '\r'.code.toByte()) newline - 1 else newline
                val frame = buffered.copyOfRange(0, length)
                pendingResponse.reset()
                if (newline + 1 < buffered.size) pendingResponse.write(buffered, newline + 1, buffered.size - newline - 1)
                try {
                    return Charsets.UTF_8.newDecoder()
                        .onMalformedInput(CodingErrorAction.REPORT)
                        .onUnmappableCharacter(CodingErrorAction.REPORT)
                        .decode(ByteBuffer.wrap(frame))
                        .toString()
                } catch (_: CharacterCodingException) {
                    throw GaepHostException(-32_700, "INVALID_UTF8", "The GAEP engine response was not valid UTF-8.")
                }
            }
            if (buffered.size > PortableDesignProtocol.MAX_FRAME_BYTES) {
                throw GaepHostException(
                    -32_002,
                    "RESPONSE_TOO_LARGE",
                    "The GAEP engine response exceeded the configured frame boundary.",
                )
            }
            val read = responseInput!!.read(responseBuffer)
            if (read < 0) throw PortableDesignProtocol.hostUnavailable()
            if (read > 0) pendingResponse.write(responseBuffer, 0, read)
        }
    }

    private fun stopProcess() {
        val currentWriter = writer
        val currentInput = responseInput
        val currentProcess = process
        writer = null
        responseInput = null
        process = null
        pendingResponse.reset()
        runCatching { currentWriter?.close() }
        runCatching { currentInput?.close() }
        currentProcess?.let { running ->
            runCatching { running.descendants().forEach { it.destroyForcibly() } }
            if (running.isAlive) runCatching { running.destroyForcibly() }
        }
    }

    override fun close() {
        stopProcess()
    }

    override fun dispose() = close()

    private fun normalizeDigest(value: String?): String? {
        if (value.isNullOrBlank()) return null
        val normalized = value.trim().lowercase(Locale.ROOT).removePrefix("sha256:")
        require(normalized.matches(Regex("[0-9a-f]{64}"))) {
            "Expected engine SHA-256 must contain exactly 64 hexadecimal characters"
        }
        return normalized
    }

    private fun samePath(left: Path, right: Path): Boolean = if (isWindows()) {
        left.toString().equals(right.toString(), ignoreCase = true)
    } else {
        left == right
    }

    private fun isWindows(): Boolean = System.getProperty("os.name").lowercase(Locale.ROOT).contains("win")

    private fun environmentValue(source: Map<String, String>, requested: String): String? =
        source.entries.firstOrNull { it.key.equals(requested, ignoreCase = true) }?.value

    private fun List<String>.toJsonArray(): JsonArray = JsonArray().also { array -> forEach(array::add) }
}
