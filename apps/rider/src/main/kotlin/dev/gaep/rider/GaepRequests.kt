package dev.gaep.rider

import java.util.UUID

/**
 * GAEP-P0-CS02 — pure, dependency-free request construction and validation for the Rider provider/model
 * workflow. No IntelliJ types are referenced, so this is unit-testable in isolation. It builds the
 * exact protocol-v3 params, enforces that at least one governed Context Pack ID is supplied (never an
 * empty list), captures the analysis run ID from a response, and extracts provider/model choices from a
 * providerCatalog payload for the selection UI.
 */
object GaepRequests {
    fun selectProviderModelParams(adapterId: String, modelId: String): String {
        require(adapterId.isNotBlank()) { "A provider (adapterId) must be selected" }
        require(modelId.isNotBlank()) { "A model must be selected" }
        return "{\"adapterId\":${jsonString(adapterId)},\"modelId\":${jsonString(modelId)}}"
    }

    fun startAnalysisParams(
        objective: String,
        contextPackIds: List<String>,
        timeoutMs: Int = 120000,
        idempotencyKey: String = UUID.randomUUID().toString(),
    ): String {
        require(objective.isNotBlank()) { "An analysis objective is required" }
        val ids = contextPackIds.map { it.trim() }.filter { it.isNotEmpty() }
        require(ids.isNotEmpty()) { "At least one governed Context Pack ID is required" }
        val idsJson = ids.joinToString(",", "[", "]") { jsonString(it) }
        return "{\"objective\":${jsonString(objective)},\"contextPackIds\":$idsJson," +
            "\"timeoutMs\":$timeoutMs,\"idempotencyKey\":${jsonString(idempotencyKey)}}"
    }

    fun runScopedParams(analysisRunId: String): String {
        require(analysisRunId.isNotBlank()) { "An analysis run ID is required" }
        return "{\"analysisRunId\":${jsonString(analysisRunId)}}"
    }

    /** Capture the analysisRunId from a start/read response, if present. */
    fun extractRunId(responseJson: String): String? =
        Regex("\"analysisRunId\"\\s*:\\s*\"([^\"]+)\"").find(responseJson)?.groupValues?.getOrNull(1)

    /** Adapter IDs present in a providerCatalog payload (for the provider picker). */
    fun parseProviderIds(catalogJson: String): List<String> =
        Regex("\"adapterId\"\\s*:\\s*\"([^\"]+)\"").findAll(catalogJson).map { it.groupValues[1] }.distinct().toList()

    /** Model IDs for the selected adapter (best-effort scan of its `models` block). */
    fun parseModelIds(catalogJson: String, adapterId: String): List<String> {
        val providerStart = catalogJson.indexOf("\"adapterId\":\"$adapterId\"")
            .let { if (it < 0) catalogJson.indexOf("\"adapterId\": \"$adapterId\"") else it }
        if (providerStart < 0) return emptyList()
        val modelsAt = catalogJson.indexOf("\"models\"", providerStart)
        if (modelsAt < 0) return emptyList()
        // Bound the scan to the next adapterId (next provider) so models don't leak across providers.
        val nextProvider = catalogJson.indexOf("\"adapterId\"", modelsAt).let { if (it < 0) catalogJson.length else it }
        val slice = catalogJson.substring(modelsAt, nextProvider)
        return Regex("\"id\"\\s*:\\s*\"([^\"]+)\"").findAll(slice).map { it.groupValues[1] }.distinct().toList()
    }

    private fun jsonString(value: String): String {
        val escaped = value.replace("\\", "\\\\").replace("\"", "\\\"")
        return "\"$escaped\""
    }
}
