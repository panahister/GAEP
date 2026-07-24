package dev.gaep.rider

import java.nio.file.Path
import java.util.Locale
import java.util.UUID

internal data class AgentSelectionContext(
    val current: AgentSelectionState,
    val available: List<AgentReadinessSnapshot>,
)

internal class RiderProductController(private val client: GaepEngineClient) {
    fun readProduct(): String = renderProduct(client.readProductBinding())

    fun readAgentReadiness(): String = buildString {
        appendLine("GAEP Codex and Claude readiness")
        appendLine()
        appendLine("Observation only: this view cannot select a model, change settings, start an agent, resume work, or grant execution authority.")
        appendLine("Only verified, path-free capability metadata is shown. Executable paths, provider credentials, and raw engine output are withheld.")
        client.probeAgentReadiness().forEach { snapshot ->
            appendLine()
            append(renderAgentReadiness(snapshot))
        }
    }

    fun readAgentSelectionContext(): AgentSelectionContext {
        val current = client.readAgentSelection()
        if (current is AgentSelectionState.MigrationRequired) {
            throw IllegalArgumentException(
                "The existing legacy Agent Selection requires explicit migration review. Rider will not overwrite it implicitly.",
            )
        }
        if (current == AgentSelectionState.Invalid) {
            throw IllegalArgumentException(
                "The existing Agent Selection is invalid. Repair or review the governed record before selecting another agent.",
            )
        }
        val available = client.probeAgentReadiness().filter { it.detected && it.executionInterface != "unavailable" }
        require(available.isNotEmpty()) { "No verified local Codex or Claude adapter is currently available for selection." }
        return AgentSelectionContext(current, available)
    }

    fun selectAgent(
        adapterId: String,
        modelId: String,
        settings: Map<String, PortableAgentSettingValue>,
        actorId: String,
    ): String = renderAgentSelection(client.selectAgent(adapterId, modelId, settings, actorId))

    fun listPortableDesignSnapshots(): String {
        val page = client.listPortableDesignSnapshots(offset = 0, limit = PortableDesignProtocol.DEFAULT_PAGE_SIZE)
        return buildString {
            appendLine("Portable design metadata: ${page.items.size} of ${page.total}")
            appendLine("Governance: ${page.governanceBoundary}")
            appendLine("Privacy: ${page.privacyBoundary}")
            if (page.items.isEmpty()) append("No snapshots were found on this page.")
            page.items.forEachIndexed { index, summary ->
                appendLine()
                appendLine()
                appendLine("${index + 1}. ${summary.title}")
                append(renderSummary(summary))
            }
        }
    }

    fun readPortableDesignSnapshot(bundleId: String): String {
        val normalized = parseUuid(bundleId, "Bundle ID")
        return renderSummary(client.readPortableDesignSnapshot(normalized))
    }

    fun importPortableDesignSnapshot(bundleRoot: Path, actorId: String): String {
        val initial = client.readProductBinding()
        val current = client.readProductBinding()
        if (current.id != initial.id || current.revision != initial.revision) {
            throw PortableDesignProtocol.productContextChanged()
        }
        val imported = client.importPortableDesignSnapshot(
            bundleRoot = bundleRoot,
            expectedProductId = initial.id,
            expectedProductRevision = initial.revision,
            actorId = actorId,
        )
        return buildString {
            appendLine("Imported into ${initial.name} at exact Product revision ${initial.revision}.")
            appendLine("The result remains pending human review; import validation is not approval or a baseline.")
            append(renderSummary(imported))
        }
    }

    private fun renderProduct(product: ProductBinding): String = buildString {
        appendLine("Product: ${product.name}")
        appendLine("Product ID: ${product.id}")
        append("Revision: ${product.revision}")
    }

    private fun renderAgentReadiness(snapshot: AgentReadinessSnapshot): String = buildString {
        appendLine(snapshot.agentLabel)
        appendLine("  Adapter: ${snapshot.adapterId} ${snapshot.adapterVersion}")
        appendLine("  Detected: ${yesNo(snapshot.detected)}")
        appendLine("  Runtime version: ${snapshot.runtimeVersion ?: "not observed"}")
        appendLine("  Interface: ${snapshot.executionInterface} (${snapshot.interfaceMaturity})")
        appendLine(
            "  Capabilities: resume=${yesNo(snapshot.supportsResume)}, cancel=${yesNo(snapshot.supportsCancel)}, " +
                "checkpoints=${yesNo(snapshot.supportsCheckpoints)}, model discovery=${yesNo(snapshot.supportsModelDiscovery)}, " +
                "tool selection=${yesNo(snapshot.supportsToolSelection)}",
        )
        appendLine("  Declared settings: ${snapshot.settingsCount}")
        appendLine("  Models observed: ${snapshot.models.size}")
        val models = snapshot.models.take(20)
        if (models.isEmpty()) appendLine("  - none observed")
        models.forEach { model ->
            appendLine("  - ${model.label} (${model.id}; ${model.truthClass}${if (model.alias) "; alias" else ""})")
        }
        if (snapshot.models.size > models.size) appendLine("  - ${snapshot.models.size - models.size} more withheld from this compact view")
        appendLine("  Limitations: ${snapshot.limitations.size}")
        val limitations = snapshot.limitations.take(20)
        if (limitations.isEmpty()) appendLine("  - none declared")
        limitations.forEach { appendLine("  - $it") }
        if (snapshot.limitations.size > limitations.size) {
            appendLine("  - ${snapshot.limitations.size - limitations.size} more withheld from this compact view")
        }
        append("  Observed at: ${snapshot.observedAt}")
    }

    private fun renderAgentSelection(selection: AgentSelection): String = buildString {
        appendLine("GAEP guarded Agent Selection")
        appendLine()
        appendLine("Agent: ${selection.agentId}")
        appendLine("Adapter: ${selection.adapterId}")
        appendLine("Model: ${selection.modelId}")
        appendLine(
            "Model evidence: ${selection.modelTruthClass}${if (selection.modelAlias == true) " (alias)" else ""}",
        )
        appendLine("Selected at: ${selection.selectedAt}")
        appendLine("Portable settings: ${selection.settings.size}")
        selection.settings.forEach { (key, value) -> appendLine("  - $key: ${renderSettingValue(value)}") }
        appendLine()
        appendLine(
            "Boundary: this record does not start a provider, create or resume a Run, approve tools or effects, or grant execution authority.",
        )
        append("Machine-local executable paths, credentials, and raw provider output are not included.")
    }

    private fun renderSettingValue(value: PortableAgentSettingValue): String = when (value) {
        is PortableAgentSettingValue.Text -> value.value
        is PortableAgentSettingValue.Decimal -> value.value.toPlainString()
        is PortableAgentSettingValue.Flag -> value.value.toString()
        is PortableAgentSettingValue.TextList -> value.value.joinToString(", ")
    }

    private fun yesNo(value: Boolean): String = if (value) "yes" else "no"

    private fun renderSummary(summary: PortableDesignSnapshotSummary): String = buildString {
        appendLine("Bundle ID: ${summary.bundleId}")
        appendLine("Product ID: ${summary.productId}")
        appendLine("Initiative ID: ${summary.initiativeId ?: "not-bound"}")
        appendLine("Classification: ${portableName(summary.classification.name)}")
        appendLine("Governance: ${summary.governance.state}; human review required=${summary.governance.humanReviewRequired}")
        appendLine("Source review: ${portableName(summary.sourceReview.status.name)} upstream claim; GAEP approval=${summary.sourceReview.gaepApproval}")
        appendLine("Source: ${summary.source.tool}; ${portableName(summary.source.exportMethod.name)}")
        appendLine(
            "Counts: artifacts=${summary.counts.artifacts}, normalized tokens=${summary.counts.normalizedDesignTokens}, " +
                "validation checks=${summary.counts.validationChecks}, limitations=${summary.counts.recordedLimitations}",
        )
        appendLine("Snapshot digest: ${summary.digests.snapshot}")
        appendLine("Evidence digest: ${summary.digests.evidence}")
        appendLine("Manifest digest: ${summary.digests.manifest}")
        appendLine("Inventory digest: ${summary.digests.artifactInventory}")
        appendLine("Source exported: ${summary.timestamps.sourceExportedAt}")
        appendLine("Imported: ${summary.timestamps.importedAt}")
        append("Privacy: ${summary.privacyBoundary}")
    }

    private fun parseUuid(value: String, label: String): UUID {
        val normalized = value.trim()
        require(normalized.matches(Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"))) {
            "$label must be a UUID"
        }
        return try {
            UUID.fromString(normalized).also { require(it != UUID(0, 0)) { "$label must be a non-empty UUID" } }
        } catch (_: IllegalArgumentException) {
            throw IllegalArgumentException("$label must be a UUID")
        }
    }

    private fun portableName(value: String): String = value.lowercase(Locale.ROOT).replace('_', '-')
}
