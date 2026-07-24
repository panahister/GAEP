package dev.gaep.rider

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import java.util.UUID

private val productId = UUID.fromString("11111111-1111-4111-8111-111111111111")
private val initiativeId = UUID.fromString("22222222-2222-4222-8222-222222222222")
internal val bundleId: UUID = UUID.fromString("33333333-3333-4333-8333-333333333333")
internal val missingBundleId: UUID = UUID.fromString("44444444-4444-4444-8444-444444444444")
internal val extraFieldBundleId: UUID = UUID.fromString("55555555-5555-4555-8555-555555555555")
internal val mismatchedBundleId: UUID = UUID.fromString("66666666-6666-4666-8666-666666666666")
internal val oversizedBundleId: UUID = UUID.fromString("77777777-7777-4777-8777-777777777777")
internal val extraErrorEnvelopeBundleId: UUID = UUID.fromString("88888888-8888-4888-8888-888888888888")
internal val wrongErrorCodeBundleId: UUID = UUID.fromString("99999999-9999-4999-8999-999999999999")
internal val invalidUtf8BundleId: UUID = UUID.fromString("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
internal val duplicateEnvelopeBundleId: UUID = UUID.fromString("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
internal val invalidGovernanceBundleId: UUID = UUID.fromString("cccccccc-cccc-4ccc-8ccc-cccccccccccc")
internal val invalidDigestBundleId: UUID = UUID.fromString("dddddddd-dddd-4ddd-8ddd-dddddddddddd")
internal val invalidCountBundleId: UUID = UUID.fromString("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee")
internal val invalidTimestampBundleId: UUID = UUID.fromString("ffffffff-ffff-4fff-8fff-ffffffffffff")
internal const val privateRoot = "/Users/private/design-bundle"
internal const val privateCredential = "PRIVATE-OAUTH-TOKEN"

fun main() {
    generateSequence(::readLine).forEach { line ->
        val request = JsonParser.parseString(line).asJsonObject
        val id = request.get("id").asLong
        val method = request.get("method").asString
        val expectedKeys = if (method == "readProduct") {
            setOf("jsonrpc", "id", "method", "params")
        } else {
            setOf("jsonrpc", "id", "method", "params", "protocolVersion")
        }
        if (request.keySet() != expectedKeys || request.get("jsonrpc").asString != "2.0" ||
            (method != "readProduct" && request.get("protocolVersion").asInt != 2)
        ) {
            writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID ENVELOPE")
            return@forEach
        }
        when (method) {
            "readProduct" -> writeResult(
                id,
                JsonObject().apply {
                    addProperty("id", productId.toString())
                    addProperty("name", "Founder Product")
                    addProperty("revision", 7)
                    addProperty("lifecycleState", "active")
                },
            )
            "productStudio.portableDesign.import" -> handleImport(id, request.getAsJsonObject("params"))
            "productStudio.portableDesign.list" -> handleList(id, request.getAsJsonObject("params"))
            "productStudio.portableDesign.read" -> handleRead(id, request.getAsJsonObject("params"))
            else -> writeError(id, -32_601, "METHOD_NOT_FOUND", "PRIVATE UNKNOWN METHOD")
        }
    }
}

private fun handleImport(id: Long, params: JsonObject) {
    if (params.keySet() != setOf("bundleRoot", "expectedProductId", "expectedProductRevision", "actorId") ||
        params.get("expectedProductId").asString != productId.toString() ||
        params.get("expectedProductRevision").asLong != 7L ||
        params.get("actorId").asString !in setOf("founder.portable-design-review", "founder.review")
    ) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID PARAMS")
        return
    }
    if (params.get("bundleRoot").asString.endsWith("source-error")) {
        writeError(
            id,
            -32_030,
            "PORTABLE_DESIGN_SOURCE_INVALID",
            "Malformed bundle at $privateRoot; password=$privateCredential",
        )
        return
    }
    writeResult(id, snapshot())
}

private fun handleList(id: Long, params: JsonObject) {
    if (params.keySet() != setOf("offset", "limit")) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID LIST")
        return
    }
    val offset = params.get("offset").asInt
    val limit = params.get("limit").asInt
    val items = if (offset == 9_999) List(201) { snapshot() } else if (offset == 0) listOf(snapshot()) else emptyList()
    writeResult(
        id,
        JsonObject().apply {
            add("items", com.google.gson.Gson().toJsonTree(items))
            addProperty("offset", offset)
            addProperty("limit", limit)
            addProperty("total", if (offset == 9_999) 10_200 else 1)
            addProperty("hasMore", offset == 9_999)
            addProperty(
                "governanceBoundary",
                "Every item remains pending human review; source review is an upstream claim only.",
            )
            addProperty(
                "privacyBoundary",
                "Items contain validated metadata and digests only; local paths and source content are omitted.",
            )
        },
    )
}

private fun handleRead(id: Long, params: JsonObject) {
    if (params.keySet() != setOf("bundleId")) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID READ")
        return
    }
    val requested = UUID.fromString(params.get("bundleId").asString)
    when (requested) {
        missingBundleId -> writeError(
            id,
            -32_035,
            "PORTABLE_DESIGN_NOT_FOUND",
            "Missing $privateRoot; token=$privateCredential",
        )
        extraFieldBundleId -> writeResult(id, snapshot(requested).apply {
            addProperty("bundleRoot", "$privateRoot/$privateCredential")
        })
        mismatchedBundleId -> writeResult(id, snapshot(bundleId))
        oversizedBundleId -> {
            println("""{"jsonrpc":"2.0","id":$id,"result":{"padding":"${"x".repeat(1024 * 1024 + 1)}"}}""")
            System.out.flush()
        }
        extraErrorEnvelopeBundleId -> {
            println(
                """{"jsonrpc":"2.0","id":$id,"error":{"code":-32035,"message":"$privateRoot $privateCredential","data":{"kind":"PORTABLE_DESIGN_NOT_FOUND"}},"result":{},"bundleRoot":"$privateRoot"}""",
            )
            System.out.flush()
        }
        wrongErrorCodeBundleId -> writeError(
            id,
            -32_030,
            "PORTABLE_DESIGN_NOT_FOUND",
            "Mismatched kind and code at $privateRoot; password=$privateCredential",
        )
        invalidUtf8BundleId -> {
            System.out.write(byteArrayOf(0xc3.toByte(), 0x28, 0x0a))
            System.out.flush()
        }
        duplicateEnvelopeBundleId -> {
            println("""{"jsonrpc":"2.0","id":$id,"id":$id,"result":{}}""")
            System.out.flush()
        }
        invalidGovernanceBundleId -> writeResult(id, snapshot(requested).apply {
            getAsJsonObject("governance").addProperty("state", "approved")
        })
        invalidDigestBundleId -> writeResult(id, snapshot(requested).apply {
            getAsJsonObject("digests").addProperty("snapshot", "sha256:PRIVATE")
        })
        invalidCountBundleId -> writeResult(id, snapshot(requested).apply {
            getAsJsonObject("counts").addProperty("artifacts", 513)
        })
        invalidTimestampBundleId -> writeResult(id, snapshot(requested).apply {
            getAsJsonObject("timestamps").addProperty("importedAt", "PRIVATE-TIMESTAMP")
        })
        else -> writeResult(id, snapshot(requested))
    }
}

private fun snapshot(id: UUID = bundleId): JsonObject = JsonParser.parseString(
    """
    {
      "schemaVersion": 1,
      "kind": "portable-design-snapshot-summary",
      "bundleId": "$id",
      "productId": "$productId",
      "initiativeId": "$initiativeId",
      "title": "Imported Product Design",
      "classification": "confidential",
      "governance": {
        "state": "pending-human-review",
        "humanReviewRequired": true,
        "claimBoundary": "import-validation-is-not-design-approval-or-baseline",
        "nonEscalation": "not-gaep-approval-design-baseline-implementation-or-release-readiness"
      },
      "sourceReview": {
        "status": "approved",
        "claimLabel": "approved upstream claim; not GAEP approval, a Design Baseline, implementation readiness, or release readiness",
        "gaepApproval": false
      },
      "source": { "tool": "figma", "exportMethod": "manual-export" },
      "counts": { "artifacts": 2, "normalizedDesignTokens": 1, "validationChecks": 6, "recordedLimitations": 5 },
      "digests": {
        "snapshot": "sha256:${"a".repeat(64)}",
        "evidence": "sha256:${"b".repeat(64)}",
        "manifest": "sha256:${"c".repeat(64)}",
        "artifactInventory": "sha256:${"d".repeat(64)}"
      },
      "timestamps": { "sourceExportedAt": "2026-07-24T00:00:00.000Z", "importedAt": "2026-07-24T00:01:00.000Z" },
      "privacyBoundary": "Validated metadata only; no bundle root, artifact path, token value, source bytes, credentials, OAuth state, or external-account state."
    }
    """.trimIndent(),
).asJsonObject

private fun writeResult(id: Long, result: JsonObject) {
    println(JsonObject().apply {
        addProperty("jsonrpc", "2.0")
        addProperty("id", id)
        add("result", result)
    })
    System.out.flush()
}

private fun writeError(id: Long, code: Int, kind: String, rawMessage: String) {
    println(JsonObject().apply {
        addProperty("jsonrpc", "2.0")
        addProperty("id", id)
        add("error", JsonObject().apply {
            addProperty("code", code)
            addProperty("message", rawMessage)
            add("data", JsonObject().apply {
                addProperty("kind", kind)
                add("detail", JsonObject().apply {
                    addProperty("bundleRoot", privateRoot)
                    addProperty("credential", privateCredential)
                })
            })
        })
    })
    System.out.flush()
}
