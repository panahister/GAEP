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
    private const val MAX_JSON_COLLECTION_ENTRIES = 512
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
    private val actorIdPattern = Regex("^[A-Za-z0-9][A-Za-z0-9._:@+-]*$")
    private val toolPattern = Regex("^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$")
    private val digestPattern = Regex("^sha256:[0-9a-f]{64}$")
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
        "INVALID_PARAMS" to StableHostError(-32_602, "The GAEP engine rejected the portable design request parameters."),
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

    fun validatePage(offset: Int, limit: Int) {
        require(offset in 0..MAX_OFFSET) { "Portable design offset must be between 0 and 10000" }
        require(limit in 1..MAX_PAGE_SIZE) { "Portable design limit must be between 1 and 200" }
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
        "The GAEP engine returned a portable design response that could not be verified.",
    )

    fun hostUnavailable(): GaepHostException = GaepHostException(
        -32_603,
        "HOST_UNAVAILABLE",
        "The GAEP engine host could not complete the portable design request.",
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
            ?: return GaepHostException(-32_603, "HOST_ERROR", "The GAEP engine could not complete the portable design request.")
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

    private fun JsonObject.requireDigest(name: String): String =
        requireString(name).takeIf(digestPattern::matches) ?: throw invalidResponse()

    private fun JsonObject.requireInstant(name: String): Instant = try {
        Instant.parse(requireString(name))
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

    private fun isNetworkPath(path: String): Boolean = path.startsWith("//") || path.startsWith("\\\\")
}
