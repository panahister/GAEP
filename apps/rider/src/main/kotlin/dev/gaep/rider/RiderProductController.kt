package dev.gaep.rider

import java.nio.file.Path
import java.util.Locale
import java.util.UUID

internal class RiderProductController(private val client: GaepEngineClient) {
    fun readProduct(): String = renderProduct(client.readProductBinding())

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
