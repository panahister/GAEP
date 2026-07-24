package dev.gaep.rider

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.google.gson.JsonElement
import java.util.UUID

private val productId = UUID.fromString("11111111-1111-4111-8111-111111111111")
private val initiativeId = UUID.fromString("22222222-2222-4222-8222-222222222222")
internal val runId: UUID = UUID.fromString("12121212-1212-4121-8121-121212121212")
private val charterId: UUID = UUID.fromString("13131313-1313-4131-8131-131313131313")
internal val handoffId: UUID = UUID.fromString("14141414-1414-4141-8141-141414141414")
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
private var selectedAgent: JsonObject? = null

fun main(arguments: Array<String>) {
    val workspacePath = arguments.getOrNull(arguments.indexOf("--workspace") + 1).orEmpty()
    generateSequence(::readLine).forEach { line ->
        val request = JsonParser.parseString(line).asJsonObject
        val id = request.get("id").asLong
        val method = request.get("method").asString
        val pathFreeMethod = method == "readProduct" || method == "probeAgents"
        val expectedKeys = if (pathFreeMethod) {
            setOf("jsonrpc", "id", "method", "params")
        } else {
            setOf("jsonrpc", "id", "method", "params", "protocolVersion")
        }
        if (request.keySet() != expectedKeys || request.get("jsonrpc").asString != "2.0" ||
            (!pathFreeMethod && request.get("protocolVersion").asInt != 2)
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
            "probeAgents" -> writeResult(id, readinessSnapshots(workspacePath.endsWith("bad-readiness")))
            "readAgentSelection" -> {
                if (workspacePath.endsWith("bad-selection")) {
                    writeResult(id, JsonObject().apply {
                        addProperty("status", "selected")
                        add("selection", agentSelection().apply {
                            addProperty("runtimeExecutable", "$privateRoot/$privateCredential")
                        })
                    })
                } else {
                    writeResult(id, JsonObject().apply {
                        val current = selectedAgent
                        if (current == null) {
                            addProperty("status", "unselected")
                        } else {
                            addProperty("status", "selected")
                            add("selection", current)
                        }
                    })
                }
            }
            "selectAgent" -> handleSelectAgent(id, request.getAsJsonObject("params"))
            "listRuns" -> writeResult(id, com.google.gson.JsonArray().apply {
                add(agentRun(workspacePath.endsWith("bad-runs")))
            })
            "createHandoff" -> handleCreateHandoff(
                id,
                request.getAsJsonObject("params"),
                workspacePath.endsWith("bad-handoff"),
                workspacePath.endsWith("bad-handoff-binding"),
            )
            "productStudio.portableDesign.import" -> handleImport(id, request.getAsJsonObject("params"))
            "productStudio.portableDesign.list" -> handleList(id, request.getAsJsonObject("params"))
            "productStudio.portableDesign.read" -> handleRead(id, request.getAsJsonObject("params"))
            else -> writeError(id, -32_601, "METHOD_NOT_FOUND", "PRIVATE UNKNOWN METHOD")
        }
    }
}

private fun handleSelectAgent(id: Long, params: JsonObject) {
    val settings = params.getAsJsonObject("settings")
    if (params.keySet() != setOf("adapterId", "modelId", "settings", "actorId") ||
        params.get("adapterId").asString != "openai-codex" ||
        params.get("modelId").asString != "gpt-5.6-codex" ||
        settings.keySet() != setOf("reasoningEffort") || settings.get("reasoningEffort").asString != "high" ||
        params.get("actorId").asString !in setOf("founder.portable-design-review", "founder.review")
    ) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID SELECTION")
        return
    }
    selectedAgent = agentSelection(settings)
    writeResult(id, selectedAgent!!)
}

private fun agentSelection(settings: JsonObject = JsonObject().apply { addProperty("reasoningEffort", "high") }): JsonObject =
    JsonObject().apply {
        addProperty("schemaVersion", 2)
        addProperty("adapterId", "openai-codex")
        addProperty("agentId", "codex")
        addProperty("modelId", "gpt-5.6-codex")
        addProperty("modelTruthClass", "observed")
        addProperty("modelAlias", false)
        add("settings", settings)
        addProperty("selectedAt", "2026-07-24T08:05:00.000Z")
        addProperty("capabilityDigest", "sha256:${"e".repeat(64)}")
    }

private fun targetAgentSelection(): JsonObject = agentSelection(
    JsonObject().apply { addProperty("reasoningEffort", "medium") },
).apply {
    addProperty("modelId", "gpt-5.6-codex-next")
    addProperty("selectedAt", "2026-07-24T08:10:00.000Z")
    addProperty("capabilityDigest", "sha256:${"f".repeat(64)}")
}

private fun agentRun(includePrivatePath: Boolean): JsonObject = JsonObject().apply {
    addProperty("schemaVersion", 1)
    addProperty("id", runId.toString())
    addProperty("revision", 3)
    addProperty("charterId", charterId.toString())
    addProperty("charterDigest", "sha256:${"1".repeat(64)}")
    addProperty("productId", productId.toString())
    addProperty("initiativeId", initiativeId.toString())
    add("agent", agentSelection())
    addProperty("state", "completed")
    addProperty("providerSessionRef", "sha256:${"2".repeat(64)}")
    addProperty("startedAt", "2026-07-24T08:00:00.000Z")
    addProperty("endedAt", "2026-07-24T08:04:00.000Z")
    if (includePrivatePath) addProperty("runtimeExecutable", "$privateRoot/$privateCredential")
}

private fun handleCreateHandoff(
    id: Long,
    params: JsonObject,
    includePrivatePath: Boolean,
    includeWrongBinding: Boolean,
) {
    val handoff = params.getAsJsonObject("handoff")
    val settings = handoff?.getAsJsonObject("toSettings")
    if (params.keySet() != setOf("actorId", "handoff") || params.get("actorId").asString != "founder.review" ||
        handoff == null || handoff.keySet() != setOf(
            "fromRunId", "toAdapterId", "toModelId", "toSettings", "reason", "completedWork",
            "unresolvedMatters", "decisions", "evidence",
        ) || handoff.get("fromRunId").asString != runId.toString() ||
        handoff.get("toAdapterId").asString != "openai-codex" ||
        handoff.get("toModelId").asString != "gpt-5.6-codex-next" ||
        settings?.keySet() != setOf("reasoningEffort") || settings.get("reasoningEffort").asString != "medium" ||
        handoff.get("reason").asString != "Switch to the reviewed model" ||
        handoff.getAsJsonArray("completedWork").map(JsonElement::getAsString) != listOf("Selection workflow completed") ||
        handoff.getAsJsonArray("unresolvedMatters").map(JsonElement::getAsString) != listOf("Native Rider acceptance remains") ||
        handoff.getAsJsonArray("decisions").map(JsonElement::getAsString) != listOf("Keep execution disabled") ||
        handoff.getAsJsonArray("evidence").map(JsonElement::getAsString) != listOf("evidence/rider-selection.json")
    ) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID HANDOFF")
        return
    }
    selectedAgent = targetAgentSelection()
    writeResult(id, agentHandoff().apply {
        if (includePrivatePath) addProperty("runtimeExecutable", "$privateRoot/$privateCredential")
        if (includeWrongBinding) {
            getAsJsonObject("toAgent").getAsJsonObject("settings").addProperty("reasoningEffort", "high")
        }
    })
}

private fun agentHandoff(): JsonObject = JsonObject().apply {
    addProperty("schemaVersion", 1)
    addProperty("id", handoffId.toString())
    addProperty("productId", productId.toString())
    addProperty("initiativeId", initiativeId.toString())
    addProperty("fromRunId", runId.toString())
    add("toAgent", targetAgentSelection())
    addProperty("reason", "Switch to the reviewed model")
    add("workspaceBaseline", JsonObject().apply {
        addProperty("gitHead", "abcdef1")
        addProperty("dirty", true)
        add("changedFiles", com.google.gson.JsonArray().apply { add("src/index.kt") })
        addProperty("truthClass", "observed")
    })
    add("completedWork", com.google.gson.JsonArray().apply { add("Selection workflow completed") })
    add("unresolvedMatters", com.google.gson.JsonArray().apply { add("Native Rider acceptance remains") })
    add("decisions", com.google.gson.JsonArray().apply { add("Keep execution disabled") })
    add("evidence", com.google.gson.JsonArray().apply { add("evidence/rider-selection.json") })
    add("capabilityDifferences", com.google.gson.JsonArray().apply {
        add("Model changes from gpt-5.6-codex to gpt-5.6-codex-next.")
    })
    addProperty("createdAt", "2026-07-24T08:10:00.000Z")
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

private fun readinessSnapshots(includePrivatePath: Boolean): JsonElement {
    val snapshots = JsonParser.parseString(
        """
        [
          {
            "schemaVersion": 1,
            "adapterId": "openai-codex",
            "adapterVersion": "0.1.0",
            "agentId": "codex",
            "agentLabel": "OpenAI Codex",
            "runtimeVersion": "0.42.0",
            "detected": true,
            "executionInterface": "cli-jsonl",
            "interfaceMaturity": "beta",
            "supportsResume": true,
            "supportsCancel": true,
            "supportsCheckpoints": true,
            "supportsModelDiscovery": true,
            "supportsToolSelection": true,
            "settings": [
              {
                "key": "reasoningEffort",
                "label": "Reasoning effort",
                "description": "Provider-declared reasoning effort for a future governed run.",
                "kind": "select",
                "required": false,
                "sensitive": false,
                "options": [{ "value": "high", "label": "High" }],
                "truthClass": "provider-declared"
              }
            ],
            "models": [
              {
                "id": "gpt-5.6-codex",
                "label": "GPT-5.6 Codex",
                "description": "Observed local Codex model metadata.",
                "reasoningOptions": ["high"],
                "contextWindow": 200000,
                "inputModalities": ["text", "image"],
                "truthClass": "observed",
                "alias": false
              }
            ],
            "limitations": ["Capability observation does not authorize execution."],
            "observedAt": "2026-07-24T08:00:00.000Z"
          },
          {
            "schemaVersion": 1,
            "adapterId": "anthropic-claude-code",
            "adapterVersion": "0.1.0",
            "agentId": "claude-code",
            "agentLabel": "Anthropic Claude Code",
            "detected": false,
            "executionInterface": "unavailable",
            "interfaceMaturity": "unknown",
            "supportsResume": false,
            "supportsCancel": false,
            "supportsCheckpoints": false,
            "supportsModelDiscovery": false,
            "supportsToolSelection": false,
            "settings": [],
            "models": [],
            "limitations": ["The local Claude Code runtime was not observed."],
            "observedAt": "2026-07-24T08:00:00.000Z"
          }
        ]
        """.trimIndent(),
    ).asJsonArray
    if (includePrivatePath) snapshots[0].asJsonObject.addProperty("runtimeExecutable", "$privateRoot/$privateCredential")
    return snapshots
}

private fun writeResult(id: Long, result: JsonElement) {
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
