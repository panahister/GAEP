package dev.gaep.rider

import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.google.gson.JsonPrimitive
import java.security.MessageDigest
import java.util.UUID

private val productId = UUID.fromString("11111111-1111-4111-8111-111111111111")
private val initiativeId = UUID.fromString("22222222-2222-4222-8222-222222222222")
private const val completenessPolicyVersion = "gaep-initiative-classification-completeness-v1"
private const val subjectCatalogVersion = "gaep-initiative-applicability-subjects-v1"
private const val subjectCatalogCount = 49
private val completenessPolicyDigest = "sha256:${"e".repeat(64)}"
private val subjectCatalogDigest = "sha256:${"f".repeat(64)}"
internal val runId: UUID = UUID.fromString("12121212-1212-4121-8121-121212121212")
private val charterId: UUID = UUID.fromString("13131313-1313-4131-8131-131313131313")
internal val managedCharterId: UUID = charterId
internal val workflowPlanId: UUID = UUID.fromString("15151515-1515-4151-8151-151515151515")
internal val managedRunId: UUID = UUID.fromString("16161616-1616-4161-8161-161616161616")
internal val governedManagedRunId: UUID = UUID.fromString("17171717-1717-4171-8171-171717171717")
internal val stagedManagedRunId: UUID = UUID.fromString("21212121-2121-4121-8121-212121212121")
private val stagedResultId: UUID = UUID.fromString("23232323-2323-4323-8323-232323232323")
private val stagedEvidenceId: UUID = UUID.fromString("24242424-2424-4424-8424-242424242424")
private val transitionedResultId: UUID = UUID.fromString("25252525-2525-4525-8525-252525252525")
private val transitionedEvidenceId: UUID = UUID.fromString("26262626-2626-4626-8626-262626262626")
private val applyDecisionId: UUID = UUID.fromString("27272727-2727-4727-8727-272727272727")
internal val workflowStepId: UUID = UUID.fromString("18181818-1818-4181-8181-181818181818")
private val managedResultId: UUID = UUID.fromString("19191919-1919-4191-8191-191919191919")
private val managedEvidenceId: UUID = UUID.fromString("20202020-2020-4202-8202-202020202020")
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
internal val changeId: UUID = UUID.fromString("29292929-2929-4929-8929-292929292929")
private val changeWorkItemId: UUID = UUID.fromString("30303030-3030-4030-8030-303030303030")
private val changeTraceId: UUID = UUID.fromString("31313131-3131-4131-8131-313131313131")
private val changeDecisionId: UUID = UUID.fromString("32323232-3232-4232-8232-323232323232")
private val changeRiskId: UUID = UUID.fromString("34343434-3434-4434-8434-343434343434")
internal const val privateRoot = "/Users/private/design-bundle"
internal const val privateCredential = "PRIVATE-OAUTH-TOKEN"
private var selectedAgent: JsonObject? = null
private var initiativeState: JsonObject = initiativeRecord()

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
            "readProduct" -> writeResult(id, productRecord())
            "readInitiative" -> handleReadInitiative(id, request.getAsJsonObject("params"), workspacePath)
            "assessInitiativeEntry" -> handleAssessInitiativeEntry(id, request.getAsJsonObject("params"), workspacePath)
            "classifyInitiative" -> handleClassifyInitiative(id, request.getAsJsonObject("params"), workspacePath)
            "resolveInitiativeApplicability" -> handleResolveInitiativeApplicability(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "dashboard.framework" -> handlePhaseDashboard(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "dashboard.changeImpact.changes" -> handleChangeImpactCatalog(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "dashboard.changeImpact" -> handleChangeImpact(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "dashboard.agentModel" -> handleAgentModel(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
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
            "managed.readonly.preview" -> handleManagedReadOnlyPreview(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "managed.readonly.execute" -> handleManagedReadOnlyExecute(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "managed.evidence.list" -> handleManagedEvidenceList(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "managed.evidence.read" -> handleManagedEvidenceRead(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "managed.review.read" -> handleManagedReviewRead(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "managed.review.apply" -> handleManagedReviewDecision(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
                "apply-exact-managed-review",
            )
            "managed.review.discard" -> handleManagedReviewDecision(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
                "discard-exact-managed-review",
            )
            "productStudio.portableDesign.import" -> handleImport(id, request.getAsJsonObject("params"))
            "productStudio.portableDesign.list" -> handleList(id, request.getAsJsonObject("params"))
            "productStudio.portableDesign.read" -> handleRead(id, request.getAsJsonObject("params"))
            else -> writeError(id, -32_601, "METHOD_NOT_FOUND", "PRIVATE UNKNOWN METHOD")
        }
    }
}

private fun productRecord(): JsonObject = JsonObject().apply {
    addProperty("id", productId.toString())
    addProperty("name", "Founder Product")
    addProperty("revision", 7)
    addProperty("lifecycleState", "active")
}

private fun initiativeRecord(): JsonObject = JsonObject().apply {
    addProperty("schemaVersion", 1)
    addProperty("id", initiativeId.toString())
    addProperty("kind", "initiative")
    addProperty("revision", 1)
    addProperty("productId", productId.toString())
    addProperty("title", "Governed Rider entry")
    addProperty("outcome", "One exact Initiative entry can be reviewed safely.")
    add("scope", JsonArray().apply { add("Rider host") })
    add("exclusions", JsonArray().apply { add("No implicit approval") })
    addProperty("state", "active")
    addProperty("createdAt", "2026-07-25T00:00:00.000Z")
    addProperty("updatedAt", "2026-07-25T00:00:00.000Z")
}

private fun handleReadInitiative(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE INITIATIVE PARAMS")
        return
    }
    val value = initiativeState.deepCopy()
    if (workspacePath.endsWith("bad-initiative-private")) {
        value.addProperty("privateRoot", "$privateRoot/$privateCredential")
    }
    writeResult(id, value)
}

private fun initiativeAssessment(): JsonObject {
    val classification = initiativeState.get("classification")?.takeIf(JsonElement::isJsonObject)?.asJsonObject
    val applicability = initiativeState.get("applicability")?.takeIf(JsonElement::isJsonObject)?.asJsonObject
    val decisions = applicability?.getAsJsonArray("decisions") ?: JsonArray()
    val unresolved = applicability?.getAsJsonArray("unresolvedSubjects") ?: JsonArray()
    val pendingHuman = decisions.count { it.asJsonObject.get("status").asString == "awaiting-human-decision" }
    val blocked = decisions.count { it.asJsonObject.get("status").asString == "blocked" }
    val pendingApproval = decisions.count {
        it.asJsonObject.getAsJsonObject("approval").get("state").asString == "pending"
    }
    val rejectedApproval = decisions.count {
        it.asJsonObject.getAsJsonObject("approval").get("state").asString == "rejected"
    }
    val coveredSubjects = (decisions.size() + unresolved.size()).coerceAtMost(subjectCatalogCount)
    val missingSubjects = subjectCatalogCount - coveredSubjects
    val reasons = buildList {
        if (classification == null) add("Initiative classification is missing")
        if (classification != null) add("Initiative classification does not satisfy the current completeness policy")
        if (applicability == null) add("Initiative applicability has not been resolved")
        if (applicability != null && missingSubjects > 0) {
            add("Initiative applicability does not cover every canonical subject")
        }
        if (unresolved.size() > 0) add("Applicability subjects remain explicitly unresolved")
        if (pendingHuman > 0) add("Applicability decisions await accountable human judgment")
        if (blocked > 0) add("One or more required applicability decisions are blocked")
        if (pendingApproval > 0) add("Applicability approvals remain pending")
        if (rejectedApproval > 0) add("One or more applicability approvals were rejected")
    }
    return JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "initiative-entry-assessment")
        addProperty("initiativeId", initiativeId.toString())
        addProperty("initiativeRevision", initiativeState.get("revision").asLong)
        addProperty("productId", productId.toString())
        addProperty("productRevision", 7)
        addProperty("productDigest", canonicalDigest(productRecord()))
        add("classification", JsonObject().apply {
            if (classification == null) {
                addProperty("status", "missing")
            } else {
                addProperty("status", "current")
                addProperty("digest", canonicalDigest(classification))
            }
            add("completeness", JsonObject().apply {
                addProperty("status", if (classification == null) "missing" else "incomplete")
                addProperty("policyVersion", completenessPolicyVersion)
                addProperty("policyDigest", completenessPolicyDigest)
                addProperty("unknownDimensionCount", 0)
                addProperty(
                    "unresolvedQuestionCount",
                    classification?.getAsJsonArray("unresolvedQuestions")?.size() ?: 0,
                )
                addProperty("missingConditionalDimensionCount", 0)
                addProperty("confidenceSufficient", classification != null)
            })
        })
        add("applicability", JsonObject().apply {
            if (applicability == null) {
                addProperty("status", "missing")
            } else {
                addProperty("status", applicability.get("state").asString)
                addProperty("matrixRevision", applicability.get("revision").asLong)
                addProperty("digest", canonicalDigest(applicability))
            }
            addProperty("decisionCount", decisions.size())
            addProperty("unresolvedSubjectCount", unresolved.size())
            addProperty("pendingHumanDecisionCount", pendingHuman)
            addProperty("blockedDecisionCount", blocked)
            addProperty("pendingApprovalCount", pendingApproval)
            addProperty("rejectedApprovalCount", rejectedApproval)
            add("coverage", JsonObject().apply {
                if (classification == null) {
                    addProperty("status", "unavailable")
                    addProperty("subjectCount", 0)
                    addProperty("coveredSubjectCount", 0)
                    addProperty("missingSubjectCount", 0)
                } else {
                    addProperty(
                        "status",
                        when {
                            applicability == null -> "missing"
                            applicability.get("state").asString == "stale" -> "stale"
                            else -> "incomplete"
                        },
                    )
                    addProperty("catalogVersion", subjectCatalogVersion)
                    addProperty("catalogDigest", subjectCatalogDigest)
                    addProperty("subjectCount", subjectCatalogCount)
                    addProperty("coveredSubjectCount", coveredSubjects)
                    addProperty("missingSubjectCount", missingSubjects)
                }
                addProperty("unexpectedSubjectCount", 0)
                addProperty("mismatchedSubjectCount", 0)
            })
        })
        addProperty("state", if (blocked > 0 || rejectedApproval > 0) "blocked" else if (reasons.isEmpty()) "ready" else "attention-required")
        add("reasons", JsonArray().apply { reasons.forEach(::add) })
        addProperty("assessedAt", "2026-07-25T00:02:30.000Z")
        addProperty(
            "authorityBoundary",
            "entry-assessment-is-read-only-and-does-not-grant-approval-readiness-or-action-authority",
        )
    }
}

private fun handleAssessInitiativeEntry(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE ASSESSMENT PARAMS")
        return
    }
    val value = initiativeAssessment()
    if (workspacePath.endsWith("bad-entry-boundary")) value.addProperty("authorityBoundary", "approved")
    if (workspacePath.endsWith("bad-entry-product")) value.addProperty("productDigest", "sha256:${"0".repeat(64)}")
    if (workspacePath.endsWith("bad-entry-policy")) {
        value.getAsJsonObject("classification").remove("completeness")
    }
    if (workspacePath.endsWith("bad-entry-coverage")) {
        value.getAsJsonObject("applicability").remove("coverage")
    }
    writeResult(id, value)
}

private fun handleClassifyInitiative(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId", "expectedInitiativeRevision", "actorId", "classification") ||
        params.get("initiativeId").asString != initiativeId.toString() ||
        params.get("expectedInitiativeRevision").asLong != initiativeState.get("revision").asLong
    ) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE CLASSIFICATION PARAMS")
        return
    }
    val actorId = params.get("actorId").asString
    val now = "2026-07-25T00:01:00.000Z"
    val updated = initiativeState.deepCopy().apply {
        addProperty("revision", get("revision").asLong + 1)
        add("classification", params.getAsJsonObject("classification").deepCopy().apply {
            addProperty("productProfile", "software")
            addProperty("productRevision", 7)
            addProperty("productDigest", canonicalDigest(productRecord()))
            addProperty("completenessPolicyVersion", completenessPolicyVersion)
            addProperty("completenessPolicyDigest", completenessPolicyDigest)
            add("classifiedBy", JsonObject().apply {
                addProperty("kind", "human")
                addProperty("id", actorId)
            })
            addProperty("classifiedAt", now)
            addProperty(
                "authorityBoundary",
                "classification-guides-profile-selection-and-does-not-grant-approval-or-action-authority",
            )
        })
        get("applicability")?.takeIf(JsonElement::isJsonObject)?.asJsonObject?.let { applicability ->
            applicability.addProperty("state", "stale")
            applicability.addProperty("invalidatedAt", now)
            applicability.addProperty("invalidationReason", "Initiative classification was superseded")
        }
        addProperty("updatedAt", now)
    }
    if (workspacePath.endsWith("bad-classification-binding")) updated.addProperty("revision", updated.get("revision").asLong + 1)
    if (workspacePath.endsWith("bad-classification-content")) {
        updated.getAsJsonObject("classification").addProperty("rationale", "Substituted classification content")
    }
    initiativeState = updated
    writeResult(id, updated)
}

private fun handleResolveInitiativeApplicability(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId", "expectedInitiativeRevision", "actorId", "applicability") ||
        params.get("initiativeId").asString != initiativeId.toString() ||
        params.get("expectedInitiativeRevision").asLong != initiativeState.get("revision").asLong ||
        !initiativeState.has("classification")
    ) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE APPLICABILITY PARAMS")
        return
    }
    val actorId = params.get("actorId").asString
    val now = "2026-07-25T00:02:00.000Z"
    val nextRevision = initiativeState.get("revision").asLong + 1
    val input = params.getAsJsonObject("applicability")
    val decisions = JsonArray().apply {
        input.getAsJsonArray("decisions").forEachIndexed { index, value ->
            add(value.asJsonObject.deepCopy().apply {
                addProperty("id", "30303030-3030-4030-8030-${(index + 1).toString().padStart(12, '0')}")
                addProperty("revision", 1)
                addProperty("initiativeRevision", nextRevision)
                add("decidedBy", JsonObject().apply {
                    addProperty("kind", "human")
                    addProperty("id", actorId)
                })
                addProperty("decidedAt", now)
                addProperty(
                    "authorityBoundary",
                    "applicability-decision-does-not-grant-approval-readiness-or-action-authority",
                )
            })
        }
    }
    val applicability = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "initiative-applicability-matrix")
        add("decisions", decisions)
        add("unresolvedSubjects", input.getAsJsonArray("unresolvedSubjects").deepCopy())
        addProperty("revision", 1)
        addProperty("initiativeId", initiativeId.toString())
        addProperty("productId", productId.toString())
        addProperty("initiativeRevision", nextRevision)
        addProperty("classificationDigest", canonicalDigest(initiativeState.getAsJsonObject("classification")))
        add("subjectCatalog", input.getAsJsonObject("subjectCatalog").deepCopy())
        addProperty("state", "current")
        add("evaluatedBy", JsonObject().apply {
            addProperty("kind", "human")
            addProperty("id", actorId)
        })
        addProperty("evaluatedAt", now)
        addProperty(
            "authorityBoundary",
            "applicability-matrix-does-not-grant-approval-readiness-or-action-authority",
        )
    }
    if (workspacePath.endsWith("bad-applicability-binding")) {
        applicability.getAsJsonObject("evaluatedBy").addProperty("id", "other-actor")
    }
    if (workspacePath.endsWith("bad-applicability-content")) {
        decisions[0].asJsonObject.addProperty("rationale", "Substituted applicability content")
    }
    initiativeState = initiativeState.deepCopy().apply {
        addProperty("revision", nextRevision)
        add("applicability", applicability)
        addProperty("updatedAt", now)
    }
    writeResult(id, initiativeState)
}

private fun handlePhaseDashboard(id: Long, params: JsonObject, workspacePath: String) {
    val productDigest = canonicalDigest(productRecord())
    if (params.keySet() != setOf("phase", "expectedProductId", "expectedProductRevision", "expectedProductDigest") ||
        params.get("phase").asString != "phase-0-1a-foundation" ||
        params.get("expectedProductId").asString != productId.toString() ||
        params.get("expectedProductRevision").asLong != 7L ||
        params.get("expectedProductDigest").asString != productDigest
    ) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE DASHBOARD PARAMS")
        return
    }
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "phase-dashboard-framework")
        addProperty("catalogVersion", "gaep-phase-dashboards-v1")
        add("product", JsonObject().apply {
            addProperty("recordType", "product")
            addProperty("recordId", productId.toString())
            addProperty("revision", 7)
            addProperty("digest", productDigest)
        })
        add("phase", JsonObject().apply {
            addProperty("id", "phase-0-1a-foundation")
            addProperty("label", "Phase 0 / 1A — Four-IDE Platform Foundation")
        })
        add("panels", JsonArray().apply {
            add(phaseDashboardPanel("foundation-summary", "phase", "Foundation summary and readiness", "unknown", "not-evaluated", "attention-required"))
            add(phaseDashboardPanel("change-impact", "change-impact", "Change and impact", "applicable", "phase-contract", "active"))
            add(phaseDashboardPanel("agent-model", "agent-model", "Agent and model", "applicable", "phase-contract", "active"))
        })
        add("evidenceCues", dashboardEvidenceCues("current"))
        addProperty("observedAt", "2026-07-24T12:00:00.000Z")
        addProperty("sourceBoundary", "governed-repository-and-engine-only")
        add("limitations", JsonArray().apply {
            add("The selected phase scopes presentation only; it does not prove phase entry, completion, acceptance, or release readiness.")
            add("The phase dashboard remains attention-required until a governed applicability decision is bound.")
        })
        addProperty("authorityBoundary", "dashboard-is-a-projection-not-phase-approval-readiness-or-applicability-evidence")
    }
    if (workspacePath.endsWith("bad-dashboard-binding")) {
        content.getAsJsonObject("product").addProperty("digest", "sha256:${"0".repeat(64)}")
    }
    if (workspacePath.endsWith("bad-dashboard-applicability")) {
        content.getAsJsonArray("panels")[0].asJsonObject.apply {
            add("applicability", JsonObject().apply {
                addProperty("status", "applicable")
                addProperty("basis", "not-evaluated")
            })
            addProperty("state", "active")
        }
    }
    if (workspacePath.endsWith("bad-dashboard-evidence-cues")) {
        content.getAsJsonObject("evidenceCues").addProperty("freshness", "unknown")
    }
    val value = content.deepCopy().apply { addProperty("compositionDigest", canonicalDigest(content)) }
    if (workspacePath.endsWith("bad-dashboard-digest")) {
        value.getAsJsonArray("panels")[0].asJsonObject.addProperty("title", "Forged dashboard title")
    }
    if (workspacePath.endsWith("bad-dashboard-private")) {
        value.addProperty("sourceRoot", "$privateRoot/$privateCredential")
    }
    writeResult(id, value)
}

private fun phaseDashboardPanel(
    id: String,
    role: String,
    title: String,
    status: String,
    basis: String,
    state: String,
): JsonObject = JsonObject().apply {
    addProperty("id", id)
    addProperty("role", role)
    addProperty("title", title)
    add("applicability", JsonObject().apply {
        addProperty("status", status)
        addProperty("basis", basis)
    })
    addProperty("state", state)
}

private fun changeRecord(): JsonObject = JsonObject().apply {
    addProperty("schemaVersion", 1)
    addProperty("kind", "change")
    addProperty("id", changeId.toString())
    addProperty("productId", productId.toString())
    addProperty("revision", 3)
    addProperty("initiativeId", initiativeId.toString())
    addProperty("title", "Private Change title is withheld")
    addProperty("summary", "Private Change summary is withheld.")
    add("baseline", JsonObject().apply {
        addProperty("kind", "genesis")
        addProperty("declaration", "No earlier projection.")
        addProperty("rationale", "First projection.")
    })
    addProperty("state", "active")
    add("effectEnvelope", JsonArray().apply { add("reversible-change") })
    addProperty("createdAt", "2026-07-24T12:01:00.000Z")
    addProperty("updatedAt", "2026-07-24T12:02:00.000Z")
}

private fun changeReference(): JsonObject {
    val change = changeRecord()
    return JsonObject().apply {
        addProperty("recordType", "change")
        addProperty("recordId", changeId.toString())
        addProperty("revision", 3)
        addProperty("digest", canonicalDigest(change))
        addProperty("state", "active")
        add("effectEnvelope", change.getAsJsonArray("effectEnvelope").deepCopy())
    }
}

private fun handleChangeImpactCatalog(id: Long, params: JsonObject, workspacePath: String) {
    val productDigest = canonicalDigest(productRecord())
    if (params.keySet() != setOf("expectedProductId", "expectedProductRevision", "expectedProductDigest") ||
        params.get("expectedProductId").asString != productId.toString() ||
        params.get("expectedProductRevision").asLong != 7L ||
        params.get("expectedProductDigest").asString != productDigest
    ) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE CHANGE CATALOG PARAMS")
        return
    }
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "change-impact-change-catalog")
        add("product", exactReference("product", productId, 7, productDigest))
        add("items", JsonArray().apply { add(changeReference()) })
        addProperty("total", 1)
        addProperty("omitted", 0)
        addProperty("observedAt", "2026-07-24T12:03:00.000Z")
        addProperty("sourceBoundary", "current-governed-change-metadata-only")
        add("limitations", JsonArray().apply {
            add("The catalog contains exact current Change metadata only; Product text, Change text, and source content are withheld.")
        })
        addProperty("authorityBoundary", "change-catalog-selection-does-not-approve-change-or-authorize-effects")
    }
    if (workspacePath.endsWith("bad-change-catalog-binding")) {
        content.getAsJsonObject("product").addProperty("digest", "sha256:${"0".repeat(64)}")
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    if (workspacePath.endsWith("bad-change-catalog-digest")) {
        value.getAsJsonArray("items")[0].asJsonObject.addProperty("state", "blocked")
    }
    if (workspacePath.endsWith("bad-change-catalog-private")) {
        value.addProperty("sourceRoot", "$privateRoot/$privateCredential")
    }
    writeResult(id, value)
}

private fun handleChangeImpact(id: Long, params: JsonObject, workspacePath: String) {
    val productDigest = canonicalDigest(productRecord())
    val change = changeReference()
    if (params.keySet() != setOf(
            "expectedProductId", "expectedProductRevision", "expectedProductDigest", "expectedChangeId",
            "expectedChangeRevision", "expectedChangeDigest",
        ) || params.get("expectedProductId").asString != productId.toString() ||
        params.get("expectedProductRevision").asLong != 7L ||
        params.get("expectedProductDigest").asString != productDigest ||
        params.get("expectedChangeId").asString != changeId.toString() ||
        params.get("expectedChangeRevision").asLong != 3L ||
        params.get("expectedChangeDigest").asString != change.get("digest").asString
    ) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE CHANGE IMPACT PARAMS")
        return
    }
    val workItem = exactReference("work-item", changeWorkItemId, 2, "sha256:${"3".repeat(64)}")
    val decision = exactReference("decision", changeDecisionId, 1, "sha256:${"4".repeat(64)}")
    val risk = exactReference("risk", changeRiskId, 1, "sha256:${"5".repeat(64)}")
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "change-impact-dashboard")
        add("product", exactReference("product", productId, 7, productDigest))
        add("change", change)
        add("workItems", JsonArray().apply {
            add(JsonObject().apply {
                add("record", workItem.deepCopy())
                addProperty("state", "in-progress")
            })
        })
        add("changedArtifacts", JsonArray().apply {
            add(changeArtifact(workItem, JsonObject().apply {
                addProperty("kind", "workspace-relative")
                addProperty("path", "apps/rider/src/main/kotlin/dev/gaep/rider/PortableDesignProtocol.kt")
            }))
        })
        add("effectTargets", JsonArray().apply {
            add(changeArtifact(workItem, JsonObject().apply {
                addProperty("kind", "logical")
                addProperty("value", "package.build")
            }))
        })
        add("affectedUnits", JsonArray().apply {
            add(JsonObject().apply {
                addProperty("direction", "upstream")
                addProperty("relationship", "affects")
                add("endpoint", risk.deepCopy())
                add("trace", JsonObject().apply {
                    addProperty("recordId", changeTraceId.toString())
                    addProperty("revision", 1)
                    addProperty("assessmentDigest", "sha256:${"6".repeat(64)}")
                    addProperty("assessedState", "valid")
                })
            })
        })
        add("governance", JsonObject().apply {
            add("approval", JsonObject().apply {
                addProperty("state", "not-established")
                addProperty("basis", "current-contract-has-no-change-approval-record")
            })
            add("decisions", JsonArray().apply {
                add(JsonObject().apply {
                    add("record", decision)
                    addProperty("state", "open")
                    addProperty("outcome", "not-selected")
                })
            })
            add("risks", JsonArray().apply {
                add(JsonObject().apply {
                    add("record", risk.deepCopy())
                    addProperty("state", "open")
                    addProperty("likelihood", "possible")
                    addProperty("impact", "major")
                    addProperty("acceptance", "not-accepted")
                })
            })
            addProperty("authorityBoundary", "decisions-and-risk-acceptance-do-not-approve-the-change")
        })
        add("freshness", JsonObject().apply {
            addProperty("state", "current")
            addProperty("evaluatedAt", "2026-07-24T12:04:00.000Z")
            addProperty("unresolvedTraceLinks", 0)
            addProperty("invalidTraceLinks", 0)
            addProperty("staleTraceLinks", 0)
            addProperty("staleGovernanceReferences", 0)
            addProperty("traceAnalysisTruncated", false)
            addProperty("coverageBoundary", "absence-of-a-trace-link-does-not-prove-absence-of-impact")
        })
        add("evidenceCues", dashboardEvidenceCues("current"))
        add("limits", JsonObject().apply {
            listOf("workItems", "changedArtifacts", "effectTargets", "affectedUnits", "decisions", "risks").forEach { key ->
                add(key, JsonObject().apply {
                    addProperty("shown", 1)
                    addProperty("total", 1)
                    addProperty("omitted", 0)
                })
            }
            addProperty("truncated", false)
        })
        addProperty("observedAt", "2026-07-24T12:05:00.000Z")
        addProperty("sourceBoundary", "current-governed-records-and-bounded-trace-analysis")
        add("limitations", JsonArray().apply {
            add("Only persisted Work Item scopes and trace links are shown; missing trace does not prove missing impact.")
            add("The current record model has no general Change approval record, so approval remains not established.")
        })
        addProperty("authorityBoundary", "change-impact-dashboard-does-not-approve-change-accept-risk-or-authorize-effects")
    }
    if (workspacePath.endsWith("bad-change-impact-binding")) {
        content.getAsJsonObject("change").addProperty("digest", "sha256:${"0".repeat(64)}")
    }
    if (workspacePath.endsWith("bad-change-impact-count")) {
        content.getAsJsonObject("limits").getAsJsonObject("workItems").addProperty("total", 2)
    }
    if (workspacePath.endsWith("bad-change-impact-freshness")) {
        content.getAsJsonObject("freshness").addProperty("state", "attention-required")
    }
    if (workspacePath.endsWith("bad-change-impact-evidence-cues")) {
        content.getAsJsonObject("evidenceCues").addProperty("freshness", "stale")
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    if (workspacePath.endsWith("bad-change-impact-digest")) {
        value.getAsJsonObject("change").addProperty("state", "blocked")
    }
    if (workspacePath.endsWith("bad-change-impact-private")) {
        value.addProperty("sourceRoot", "$privateRoot/$privateCredential")
    }
    writeResult(id, value)
}

private fun exactReference(type: String, id: UUID, revision: Long, digest: String): JsonObject = JsonObject().apply {
    addProperty("recordType", type)
    addProperty("recordId", id.toString())
    addProperty("revision", revision)
    addProperty("digest", digest)
}

private fun changeArtifact(workItem: JsonObject, locator: JsonObject): JsonObject = JsonObject().apply {
    add("sourceWorkItem", workItem.deepCopy())
    add("locator", locator)
}

private fun handleAgentModel(id: Long, params: JsonObject, workspacePath: String) {
    val productDigest = canonicalDigest(productRecord())
    val readiness = readinessSnapshots(false).asJsonArray
    val expectedCapabilities = JsonArray().apply {
        readiness.map { entry ->
            val snapshot = entry.asJsonObject
            JsonObject().apply {
                addProperty("adapterId", snapshot.get("adapterId").asString)
                addProperty("agentId", snapshot.get("agentId").asString)
                addProperty("capabilityDigest", canonicalDigest(snapshot))
            }
        }.sortedBy { entry -> "${entry.get("adapterId").asString}:${entry.get("agentId").asString}" }
            .forEach(::add)
    }
    val expectedSelection = JsonObject().apply {
        val current = selectedAgent
        if (current == null) {
            addProperty("status", "unselected")
        } else {
            addProperty("status", "selected")
            addProperty("selectionDigest", canonicalDigest(current))
        }
    }
    if (params.keySet() != setOf(
            "expectedProductId", "expectedProductRevision", "expectedProductDigest", "expectedSelection",
            "expectedCapabilities",
        ) || params.get("expectedProductId").asString != productId.toString() ||
        params.get("expectedProductRevision").asLong != 7L ||
        params.get("expectedProductDigest").asString != productDigest ||
        canonicalDigest(params.get("expectedSelection")) != canonicalDigest(expectedSelection) ||
        canonicalDigest(params.get("expectedCapabilities")) != canonicalDigest(expectedCapabilities)
    ) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE AGENT MODEL PARAMS")
        return
    }
    val capabilities = JsonArray().apply {
        readiness.map { entry ->
            val snapshot = entry.asJsonObject
            JsonObject().apply {
                addProperty("adapterId", snapshot.get("adapterId").asString)
                addProperty("adapterVersion", snapshot.get("adapterVersion").asString)
                addProperty("agentId", snapshot.get("agentId").asString)
                addProperty("agentLabel", snapshot.get("agentLabel").asString)
                if (snapshot.has("runtimeVersion")) {
                    addProperty("runtimeVersion", snapshot.get("runtimeVersion").asString)
                } else {
                    add("runtimeVersion", com.google.gson.JsonNull.INSTANCE)
                }
                addProperty("capabilityDigest", canonicalDigest(snapshot))
                addProperty("detected", snapshot.get("detected").asBoolean)
                addProperty("executionInterface", snapshot.get("executionInterface").asString)
                addProperty("interfaceMaturity", snapshot.get("interfaceMaturity").asString)
                add("support", JsonObject().apply {
                    addProperty("resume", snapshot.get("supportsResume").asBoolean)
                    addProperty("cancel", snapshot.get("supportsCancel").asBoolean)
                    addProperty("checkpoints", snapshot.get("supportsCheckpoints").asBoolean)
                    addProperty("modelDiscovery", snapshot.get("supportsModelDiscovery").asBoolean)
                    addProperty("toolSelection", snapshot.get("supportsToolSelection").asBoolean)
                })
                addProperty("modelCount", snapshot.getAsJsonArray("models").size())
                val limitationValues = snapshot.getAsJsonArray("limitations").deepCopy()
                add("limitations", JsonObject().apply {
                    add("values", limitationValues)
                    addProperty("shown", limitationValues.size())
                    addProperty("total", limitationValues.size())
                    addProperty("omitted", 0)
                })
                addProperty("observedAt", snapshot.get("observedAt").asString)
                addProperty(
                    "selected",
                    selectedAgent?.get("adapterId")?.asString == snapshot.get("adapterId").asString &&
                        selectedAgent?.get("agentId")?.asString == snapshot.get("agentId").asString,
                )
            }
        }.sortedBy { entry -> "${entry.get("adapterId").asString}:${entry.get("agentId").asString}" }
            .forEach(::add)
    }
    val selection = JsonObject().apply {
        val current = selectedAgent
        if (current == null) {
            addProperty("status", "unselected")
        } else {
            val selectedCapability = capabilities.first { entry ->
                entry.asJsonObject.get("adapterId").asString == current.get("adapterId").asString &&
                    entry.asJsonObject.get("agentId").asString == current.get("agentId").asString
            }.asJsonObject
            addProperty("status", "selected")
            addProperty("selectionDigest", canonicalDigest(current))
            addProperty("adapterId", current.get("adapterId").asString)
            addProperty("agentId", current.get("agentId").asString)
            addProperty("modelId", current.get("modelId").asString)
            addProperty("modelTruthClass", current.get("modelTruthClass").asString)
            add("modelAlias", current.get("modelAlias").deepCopy())
            add("settings", current.getAsJsonObject("settings").deepCopy())
            addProperty("selectedAt", current.get("selectedAt").asString)
            addProperty("capabilityDigest", current.get("capabilityDigest").asString)
            addProperty(
                "capabilityState",
                if (selectedCapability.get("capabilityDigest").asString == current.get("capabilityDigest").asString) {
                    "current"
                } else {
                    "stale"
                },
            )
        }
    }
    val selectionCapabilityState = if (selection.get("status").asString == "selected") {
        selection.get("capabilityState").asString
    } else {
        selection.get("status").asString
    }
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "agent-model-dashboard")
        add("product", exactReference("product", productId, 7, productDigest))
        add("capabilities", capabilities)
        add("selection", selection)
        add("runs", JsonArray())
        add("handoffs", JsonArray())
        add("providerMetrics", JsonObject().apply {
            listOf("usage", "cost").forEach { metric ->
                add(metric, JsonObject().apply {
                    addProperty("state", "unavailable")
                    addProperty("basis", "current-managed-records-have-no-provider-usage-or-cost-contract")
                })
            }
        })
        add("freshness", JsonObject().apply {
            addProperty("state", if (selectionCapabilityState == "stale") "attention-required" else "current")
            addProperty("selectionCapabilityState", selectionCapabilityState)
            addProperty("oldestCapabilityObservedAt", "2026-07-24T08:00:00.000Z")
            addProperty("newestCapabilityObservedAt", "2026-07-24T08:00:00.000Z")
            addProperty("truncated", false)
            addProperty(
                "coverageBoundary",
                "bounded-current-records-do-not-prove-provider-account-or-native-host-readiness",
            )
        })
        add("evidenceCues", dashboardEvidenceCues(if (selectionCapabilityState == "stale") "stale" else "current"))
        add("limits", JsonObject().apply {
            add("capabilities", agentModelLimit(2))
            add("runs", agentModelLimit(0))
            add("handoffs", agentModelLimit(0))
            add("managedRuns", agentModelLimit(0))
            addProperty("truncated", false)
        })
        addProperty("observedAt", "2026-07-24T12:06:00.000Z")
        addProperty(
            "sourceBoundary",
            "current-governed-agent-selection-run-handoff-and-managed-evidence-metadata",
        )
        add("limitations", JsonArray().apply {
            add("Capability truth is bounded to current portable observations and does not prove provider-account readiness.")
            add("Current managed records have no provider usage or cost contract, so both metrics remain unavailable.")
        })
        addProperty(
            "authorityBoundary",
            "agent-model-dashboard-does-not-select-switch-handoff-launch-or-authorize-effects",
        )
    }
    if (workspacePath.endsWith("bad-agent-model-binding")) {
        content.getAsJsonObject("product").addProperty("digest", "sha256:${"0".repeat(64)}")
    }
    if (workspacePath.endsWith("bad-agent-model-count")) {
        content.getAsJsonObject("limits").getAsJsonObject("capabilities").addProperty("total", 3)
    }
    if (workspacePath.endsWith("bad-agent-model-freshness")) {
        content.getAsJsonObject("freshness").addProperty("state", "attention-required")
    }
    if (workspacePath.endsWith("bad-agent-model-evidence-cues")) {
        content.getAsJsonObject("evidenceCues").getAsJsonObject("confidence").addProperty("state", "supported")
    }
    if (workspacePath.endsWith("bad-agent-model-metrics")) {
        content.getAsJsonObject("providerMetrics").add("cost", JsonObject().apply {
            addProperty("state", "available")
            addProperty("amount", 0)
        })
    }
    val response = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    if (workspacePath.endsWith("bad-agent-model-digest")) {
        response.getAsJsonArray("capabilities")[0].asJsonObject.addProperty("agentLabel", "Forged label")
    }
    if (workspacePath.endsWith("bad-agent-model-private")) {
        response.addProperty("sourceRoot", "$privateRoot/$privateCredential")
    }
    writeResult(id, response)
}

private fun agentModelLimit(total: Int): JsonObject = JsonObject().apply {
    addProperty("shown", total)
    addProperty("total", total)
    addProperty("omitted", 0)
}

private fun handleManagedReadOnlyPreview(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("charterId", "workflowPlanId") ||
        params.get("charterId").asString != managedCharterId.toString() ||
        params.get("workflowPlanId").asString != workflowPlanId.toString()
    ) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID MANAGED PREVIEW")
        return
    }
    writeResult(id, managedReadOnlyPreview(workspacePath))
}

private fun handleManagedReadOnlyExecute(id: Long, params: JsonObject, workspacePath: String) {
    val preview = managedReadOnlyPreview("")
    if (params.keySet() != setOf(
            "actorId", "charterId", "workflowPlanId", "expectedPreviewDigest", "timeoutMs", "confirmation",
        ) || params.get("actorId").asString != "founder.review" ||
        params.get("charterId").asString != managedCharterId.toString() ||
        params.get("workflowPlanId").asString != workflowPlanId.toString() ||
        params.get("expectedPreviewDigest").asString != preview.get("previewDigest").asString ||
        params.get("timeoutMs").asInt != 120_000 ||
        params.get("confirmation").asString != "attest-exact-managed-readonly-preview"
    ) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID MANAGED EXECUTION")
        return
    }
    val receipt = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "managed-readonly-receipt")
        addProperty("previewDigest", preview.get("previewDigest").asString)
        addProperty("runId", governedManagedRunId.toString())
        addProperty("managedRunId", managedRunId.toString())
        addProperty("productId", productId.toString())
        addProperty("initiativeId", initiativeId.toString())
        addProperty("adapterId", "openai-codex")
        addProperty("agentId", "codex")
        addProperty("modelId", "gpt-5.6-codex")
        addProperty("mode", "codex-staged")
        addProperty("state", "completed")
        addProperty("providerDisposition", "completed")
        addProperty("outcomeStatus", "satisfied")
        addProperty("outcomeBasis", "postcondition-evaluator")
        addProperty("eventCount", 5)
        addProperty("completedStepCount", 1)
        addProperty("totalStepCount", 1)
        addProperty("resultDigest", "sha256:${"8".repeat(64)}")
        addProperty("evidenceDigest", "sha256:${"9".repeat(64)}")
        add("warnings", JsonArray())
        addProperty("startedAt", "2026-07-24T09:00:00.000Z")
        addProperty("endedAt", "2026-07-24T09:00:05.000Z")
        addProperty(
            "authorityBoundary",
            "managed-readonly-receipt-does-not-grant-tool-write-effect-or-outcome-authority",
        )
    }
    if (workspacePath.endsWith("bad-managed-receipt")) {
        receipt.addProperty("rawProviderOutput", "$privateRoot/$privateCredential")
    }
    if (workspacePath.endsWith("bad-managed-binding")) {
        receipt.addProperty("modelId", "private-unbound-model")
    }
    writeResult(id, receipt)
}

private fun managedReadOnlyPreview(workspacePath: String): JsonObject {
    val preview = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "managed-readonly-preview")
        addProperty("productId", productId.toString())
        addProperty("initiativeId", initiativeId.toString())
        addProperty("charterId", managedCharterId.toString())
        addProperty("charterDigest", "sha256:${"3".repeat(64)}")
        addProperty("workflowPlanId", workflowPlanId.toString())
        addProperty("workflowPlanDigest", "sha256:${"4".repeat(64)}")
        addProperty("adapterId", "openai-codex")
        addProperty("agentId", "codex")
        addProperty("modelId", "gpt-5.6-codex")
        addProperty("selectionDigest", "sha256:${"5".repeat(64)}")
        addProperty("strategy", "sequential")
        add("stepIds", JsonArray().apply { add(workflowStepId.toString()) })
        addProperty("contextPackCount", 1)
        addProperty("readScopeCount", 2)
        add("gates", JsonArray().apply {
            add(managedGate("charter:required-evidence", null, "charter-evidence", listOf("Record verified output evidence")))
            add(managedGate("charter:stop-conditions", null, "charter-stop-conditions", listOf("Stop on any attempted write")))
            add(managedGate("step:$workflowStepId:preconditions", workflowStepId, "preconditions", listOf("Read scope remains exact")))
            add(managedGate("step:$workflowStepId:outputs", workflowStepId, "outputs", listOf("Return an observation summary")))
            add(managedGate("step:$workflowStepId:evidence", workflowStepId, "evidence", listOf("Record deterministic evidence")))
            add(managedGate("step:$workflowStepId:stop-conditions", workflowStepId, "stop-conditions", listOf("Stop if a Tool is requested")))
        })
        addProperty(
            "authorityBoundary",
            "managed-readonly-preview-does-not-grant-execution-or-effect-authority",
        )
    }
    if (workspacePath.endsWith("bad-managed-criterion")) {
        val gate = preview.getAsJsonArray("gates")[0].asJsonObject
        val criteria = JsonArray().apply { add("Inspect $privateRoot; token=$privateCredential") }
        gate.add("criteria", criteria)
        gate.addProperty("criteriaDigest", canonicalDigest(criteria))
    }
    preview.addProperty("previewDigest", canonicalDigest(preview))
    if (workspacePath.endsWith("bad-managed-preview")) {
        preview.addProperty("workspacePath", "$privateRoot/$privateCredential")
    }
    if (workspacePath.endsWith("bad-managed-digest")) {
        preview.addProperty("previewDigest", "sha256:${"0".repeat(64)}")
    }
    return preview
}

private fun handleManagedEvidenceList(id: Long, params: JsonObject, workspacePath: String) {
    val expectedKeys = if (params.has("snapshotDigest")) {
        setOf("offset", "limit", "snapshotDigest")
    } else {
        setOf("offset", "limit")
    }
    val offset = params.get("offset").asInt
    if (params.keySet() != expectedKeys || offset !in setOf(0, 1) || params.get("limit").asInt != 100 ||
        (offset > 0 && !params.has("snapshotDigest")) ||
        (params.has("snapshotDigest") && params.get("snapshotDigest").asString != "sha256:${"6".repeat(64)}")
    ) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID MANAGED EVIDENCE LIST")
        return
    }
    val page = managedEvidencePage(offset)
    if (workspacePath.endsWith("bad-managed-evidence-page")) {
        page.getAsJsonArray("items")[0].asJsonObject.addProperty("localStagePath", "$privateRoot/$privateCredential")
    }
    if (workspacePath.endsWith("bad-managed-evidence-count")) page.addProperty("omittedCount", 0)
    if (workspacePath.endsWith("bad-managed-evidence-snapshot")) {
        page.addProperty("snapshotDigest", "sha256:${"7".repeat(64)}")
    }
    if (workspacePath.endsWith("bad-managed-evidence-total") && offset == 1) {
        page.addProperty("total", 4)
        page.addProperty("omittedCount", 2)
        page.addProperty("hasMore", true)
    }
    writeResult(id, page)
}

private fun handleManagedEvidenceRead(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("managedRunId") || params.get("managedRunId").asString != managedRunId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID MANAGED EVIDENCE READ")
        return
    }
    val detail = managedEvidenceDetail()
    if (workspacePath.endsWith("bad-managed-evidence-detail")) {
        detail.addProperty("rawProviderOutput", "$privateRoot/$privateCredential")
    }
    if (workspacePath.endsWith("bad-managed-evidence-binding")) {
        detail.getAsJsonObject("evidence").addProperty("evidenceDigest", "sha256:${"0".repeat(64)}")
    }
    writeResult(id, detail)
}

private fun managedRunSummary(): JsonObject = JsonObject().apply {
    addProperty("schemaVersion", 1)
    addProperty("kind", "managed-run-summary")
    addProperty("managedRunId", managedRunId.toString())
    addProperty("runId", governedManagedRunId.toString())
    addProperty("productId", productId.toString())
    addProperty("initiativeId", initiativeId.toString())
    addProperty("mode", "codex-staged")
    addProperty("state", "completed")
    addProperty("adapterId", "openai-codex")
    addProperty("agentId", "codex")
    addProperty("modelId", "gpt-5.6-codex")
    addProperty("attemptNumber", 1)
    addProperty("recoveryStatus", "not-required")
    addProperty("workflowCheckpointCount", 0)
    addProperty("hasResult", true)
    addProperty("hasApplyDecision", false)
    addProperty("bindingsDigest", "sha256:${"7".repeat(64)}")
    addProperty("resultDigest", "sha256:${"8".repeat(64)}")
    addProperty("createdAt", "2026-07-24T09:00:00.000Z")
    addProperty("startedAt", "2026-07-24T09:00:00.000Z")
    addProperty("updatedAt", "2026-07-24T09:00:05.000Z")
    addProperty("endedAt", "2026-07-24T09:00:05.000Z")
    addProperty(
        "authorityBoundary",
        "managed-run-inventory-is-read-only-and-does-not-grant-run-effect-apply-approval-or-outcome-authority",
    )
}

private fun managedEvidencePage(offset: Int = 0): JsonObject = JsonObject().apply {
    val items = JsonArray().apply {
        if (offset == 0) {
            add(managedRunSummary())
        } else {
            add(managedRunSummary().apply {
                addProperty("managedRunId", "17171717-1717-4717-8717-171717171717")
                addProperty("runId", "18181818-1818-4818-8818-181818181818")
            })
            add(managedRunSummary().apply {
                addProperty("managedRunId", "19191919-1919-4919-8919-191919191919")
                addProperty("runId", "20202020-2020-4020-8020-202020202020")
            })
        }
    }
    addProperty("schemaVersion", 1)
    addProperty("kind", "managed-run-summary-page")
    add("items", items)
    addProperty("offset", offset)
    addProperty("limit", 100)
    addProperty("total", 3)
    addProperty("omittedCount", 3 - items.size())
    addProperty("snapshotDigest", "sha256:${"6".repeat(64)}")
    addProperty("hasMore", offset + items.size() < 3)
    addProperty(
        "authorityBoundary",
        "managed-run-inventory-is-read-only-and-does-not-grant-run-effect-apply-approval-or-outcome-authority",
    )
    addProperty(
        "privacyBoundary",
        "Portable identifiers, states, counts, digests, warning codes and timestamps only; prompts, provider output, source bytes, changed paths, executable paths, process state and credentials are omitted.",
    )
}

private fun managedEvidenceDetail(): JsonObject = JsonObject().apply {
    addProperty("schemaVersion", 1)
    addProperty("kind", "managed-evidence-detail")
    add("summary", managedRunSummary())
    addProperty("artifactStatus", "verified-result-and-evidence")
    add("result", JsonObject().apply {
        addProperty("resultId", managedResultId.toString())
        addProperty("resultDigest", "sha256:${"8".repeat(64)}")
        addProperty("providerDisposition", "completed")
        addProperty("terminationCause", "normal")
        addProperty("outcomeStatus", "satisfied")
        addProperty("outcomeBasis", "postcondition-evaluator")
        addProperty("terminalState", "completed")
        addProperty("evidenceId", managedEvidenceId.toString())
        addProperty("evidenceDigest", "sha256:${"9".repeat(64)}")
        add("warningCodes", JsonArray())
        addProperty("startedAt", "2026-07-24T09:00:00.000Z")
        addProperty("endedAt", "2026-07-24T09:00:05.000Z")
    })
    add("evidence", JsonObject().apply {
        addProperty("evidenceId", managedEvidenceId.toString())
        addProperty("evidenceDigest", "sha256:${"9".repeat(64)}")
        addProperty("eventCount", 5)
        add("eventTypeCounts", JsonObject().apply {
            addProperty("lifecycle", 2)
            addProperty("output", 1)
            addProperty("item", 1)
            addProperty("approval", 1)
            addProperty("warning", 0)
            addProperty("error", 0)
        })
        addProperty("eventsDigest", "sha256:${"a".repeat(64)}")
        addProperty("workflowStrategy", "sequential")
        addProperty("workflowStepCount", 1)
        addProperty("workflowAttemptCount", 1)
        addProperty("completedStepCount", 1)
        addProperty("charterEvidenceStatus", "satisfied")
        addProperty("charterStopStatus", "satisfied")
        addProperty("terminalReasonCode", "workflow-completed")
        add("actualEffectCounts", JsonObject().apply {
            addProperty("not-observed", 1)
            addProperty("observed-provisional", 0)
            addProperty("applied", 0)
            addProperty("blocked", 0)
            addProperty("unknown", 0)
        })
        addProperty("capturedAt", "2026-07-24T09:00:05.000Z")
    })
    addProperty(
        "authorityBoundary",
        "managed-evidence-detail-is-verified-read-only-evidence-and-does-not-grant-apply-approval-or-outcome-authority",
    )
    addProperty(
        "privacyBoundary",
        "Portable identifiers, states, counts, digests, warning codes and timestamps only; prompts, provider output, source bytes, changed paths, executable paths, process state and credentials are omitted.",
    )
}

private fun handleManagedReviewRead(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("managedRunId") ||
        params.get("managedRunId").asString != stagedManagedRunId.toString()
    ) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID MANAGED REVIEW READ")
        return
    }
    val preview = managedReviewPreview()
    when {
        workspacePath.endsWith("bad-managed-review-digest") -> {
            preview.addProperty("previewDigest", "sha256:${"0".repeat(64)}")
        }
        workspacePath.endsWith("bad-managed-review-private") -> {
            preview.addProperty("sourceRoot", "$privateRoot/$privateCredential")
        }
        workspacePath.endsWith("bad-managed-review-binding") -> {
            preview.getAsJsonObject("applyConfirmation")
                .addProperty("reviewEvidenceId", managedEvidenceId.toString())
            refreshCanonicalDigest(preview, "previewDigest")
        }
        workspacePath.endsWith("bad-managed-review-path") -> {
            val staging = preview.getAsJsonObject("staging")
            val changedInventory = staging.getAsJsonArray("changedInventory")
            changedInventory[0].asJsonObject.addProperty("path", "$privateRoot/secret.kt")
            val inventoryDigest = canonicalDigest(changedInventory)
            staging.addProperty("changedInventoryDigest", inventoryDigest)
            preview.getAsJsonObject("applyConfirmation").addProperty("changedInventoryDigest", inventoryDigest)
            refreshCanonicalDigest(preview, "previewDigest")
        }
        workspacePath.endsWith("bad-managed-review-metadata") -> {
            val staging = preview.getAsJsonObject("staging")
            val changedInventory = staging.getAsJsonArray("changedInventory")
            changedInventory[0].asJsonObject.remove("afterMode")
            val inventoryDigest = canonicalDigest(changedInventory)
            staging.addProperty("changedInventoryDigest", inventoryDigest)
            preview.getAsJsonObject("applyConfirmation").addProperty("changedInventoryDigest", inventoryDigest)
            refreshCanonicalDigest(preview, "previewDigest")
        }
    }
    writeResult(id, preview)
}

private fun handleManagedReviewDecision(
    id: Long,
    params: JsonObject,
    workspacePath: String,
    decision: String,
) {
    val preview = managedReviewPreview()
    if (params.keySet() != setOf(
            "actorId", "managedRunId", "expectedManagedRunRevision", "expectedPreviewDigest", "confirmation",
        ) || params.get("actorId").asString != "founder.review" ||
        params.get("managedRunId").asString != stagedManagedRunId.toString() ||
        params.get("expectedManagedRunRevision").asLong != preview.get("managedRunRevision").asLong ||
        params.get("expectedPreviewDigest").asString != preview.get("previewDigest").asString ||
        params.get("confirmation").asString != decision
    ) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE INVALID MANAGED REVIEW DECISION")
        return
    }
    if (workspacePath.endsWith("stale-managed-review")) {
        writeError(id, -32_029, "MANAGED_REVIEW_CHANGED", "$privateRoot; token=$privateCredential")
        return
    }
    val transition = managedReviewTransition(decision)
    if (workspacePath.endsWith("bad-managed-transition-digest")) {
        transition.addProperty("transitionDigest", "sha256:${"0".repeat(64)}")
    }
    if (workspacePath.endsWith("bad-managed-transition-private")) {
        transition.addProperty("localJournalPath", "$privateRoot/$privateCredential")
    }
    writeResult(id, transition)
}

private fun managedReviewPreview(): JsonObject {
    val changedInventory = JsonArray().apply {
        add(JsonObject().apply {
            addProperty("path", "src/new.kt")
            addProperty("kind", "added")
            addProperty("afterDigest", "sha256:${"1".repeat(64)}")
            addProperty("afterSize", 24)
            addProperty("afterMode", 0x1a4)
        })
        add(JsonObject().apply {
            addProperty("path", "src/review.kt")
            addProperty("kind", "modified")
            addProperty("beforeDigest", "sha256:${"2".repeat(64)}")
            addProperty("afterDigest", "sha256:${"3".repeat(64)}")
            addProperty("beforeSize", 80)
            addProperty("afterSize", 96)
            addProperty("beforeMode", 0x1a4)
            addProperty("afterMode", 0x1a4)
        })
    }
    val changedInventoryDigest = canonicalDigest(changedInventory)
    val writeEnvelope = JsonArray().apply { add("src") }
    val preview = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "managed-review-preview")
        addProperty("managedRunId", stagedManagedRunId.toString())
        addProperty("managedRunRevision", 3)
        addProperty("runId", governedManagedRunId.toString())
        addProperty("productId", productId.toString())
        addProperty("initiativeId", initiativeId.toString())
        addProperty("mode", "codex-staged")
        addProperty("state", "review-required")
        addProperty("canApply", true)
        addProperty("canDiscard", true)
        addProperty("hasLocalJournal", false)
        addProperty("bindingsDigest", "sha256:${"4".repeat(64)}")
        add("result", JsonObject().apply {
            addProperty("resultId", stagedResultId.toString())
            addProperty("resultDigest", "sha256:${"5".repeat(64)}")
            addProperty("terminalState", "review-required")
            addProperty("providerDisposition", "completed")
            addProperty("outcomeStatus", "not-assessed")
            addProperty("outcomeBasis", "not-evaluated")
            add("warningCodes", JsonArray().apply {
                add("provider-output-redacted")
                add("staging-read-confinement-unattested")
            })
            addProperty("evidenceId", stagedEvidenceId.toString())
            addProperty("evidenceDigest", "sha256:${"6".repeat(64)}")
        })
        add("staging", JsonObject().apply {
            addProperty("evidenceId", stagedEvidenceId.toString())
            addProperty("evidenceDigest", "sha256:${"6".repeat(64)}")
            addProperty("baselineDigest", "sha256:${"7".repeat(64)}")
            addProperty("finalDigest", "sha256:${"8".repeat(64)}")
            addProperty("applyState", "pending")
            addProperty("changeCount", changedInventory.size())
            addProperty("changedInventoryLimit", 512)
            addProperty("omittedCount", 0)
            add("changedInventory", changedInventory)
            addProperty("changedInventoryDigest", changedInventoryDigest)
            addProperty("excludedPathCount", 0)
            addProperty("excludedPathSetDigest", canonicalDigest(JsonArray()))
        })
        add("applyConfirmation", JsonObject().apply {
            addProperty("decision", "apply-exact-reviewed-inventory")
            addProperty("reviewEvidenceId", stagedEvidenceId.toString())
            addProperty("reviewEvidenceDigest", "sha256:${"6".repeat(64)}")
            addProperty("changedInventoryDigest", changedInventoryDigest)
            add("writeEnvelope", writeEnvelope)
            addProperty("writeEnvelopeDigest", canonicalDigest(writeEnvelope))
        })
        addProperty("postApplyGatePolicy", "record-not-assessed")
        addProperty(
            "authorityBoundary",
            "managed-review-preview-authorizes-no-mutation-without-an-exact-digest-bound-human-decision",
        )
        addProperty(
            "privacyBoundary",
            "Exact portable identifiers, digests, warning codes, workspace-relative changed paths, file digests, sizes, modes and write scopes only; prompts, provider output, source bytes, absolute paths, executable paths, process state and credentials are omitted.",
        )
        addProperty(
            "cleanupBoundary",
            "Persisted discard or apply state does not independently prove machine-local stage or recovery-journal cleanup.",
        )
    }
    preview.addProperty("previewDigest", canonicalDigest(preview))
    return preview
}

private fun managedReviewTransition(decision: String): JsonObject {
    val preview = managedReviewPreview()
    val applied = decision == "apply-exact-managed-review"
    val state = if (applied) "failed" else "discarded"
    val transition = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "managed-review-transition")
        addProperty("decision", decision)
        addProperty("sourcePreviewDigest", preview.get("previewDigest").asString)
        addProperty("sourceManagedRunRevision", preview.get("managedRunRevision").asLong)
        addProperty("managedRunId", stagedManagedRunId.toString())
        addProperty("managedRunRevision", 4)
        addProperty("state", state)
        addProperty("canApply", false)
        addProperty("canDiscard", false)
        addProperty("hasLocalJournal", applied)
        add("detail", transitionedManagedEvidenceDetail(state, applied))
        addProperty(
            "authorityBoundary",
            "managed-review-transition-proves-persisted-state-not-provider-outcome-or-machine-local-cleanup",
        )
        addProperty(
            "cleanupBoundary",
            "Persisted discard or apply state does not independently prove machine-local stage or recovery-journal cleanup.",
        )
    }
    transition.addProperty("transitionDigest", canonicalDigest(transition))
    return transition
}

private fun transitionedManagedEvidenceDetail(state: String, applied: Boolean): JsonObject {
    val resultDigest = "sha256:${"9".repeat(64)}"
    val evidenceDigest = "sha256:${"a".repeat(64)}"
    val applyDecisionDigest = "sha256:${"b".repeat(64)}"
    return JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "managed-evidence-detail")
        add("summary", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "managed-run-summary")
            addProperty("managedRunId", stagedManagedRunId.toString())
            addProperty("runId", governedManagedRunId.toString())
            addProperty("productId", productId.toString())
            addProperty("initiativeId", initiativeId.toString())
            addProperty("mode", "codex-staged")
            addProperty("state", state)
            addProperty("adapterId", "openai-codex")
            addProperty("agentId", "codex")
            addProperty("modelId", "gpt-5.6-codex")
            addProperty("attemptNumber", 1)
            addProperty("recoveryStatus", "recovered")
            addProperty("workflowCheckpointCount", 0)
            addProperty("hasResult", true)
            addProperty("hasApplyDecision", applied)
            addProperty("bindingsDigest", "sha256:${"4".repeat(64)}")
            addProperty("resultDigest", resultDigest)
            if (applied) addProperty("applyDecisionDigest", applyDecisionDigest)
            addProperty("createdAt", "2026-07-24T08:29:59.000Z")
            addProperty("startedAt", "2026-07-24T08:30:00.000Z")
            addProperty("updatedAt", "2026-07-24T08:30:02.000Z")
            addProperty("endedAt", "2026-07-24T08:30:02.000Z")
            addProperty(
                "authorityBoundary",
                "managed-run-inventory-is-read-only-and-does-not-grant-run-effect-apply-approval-or-outcome-authority",
            )
        })
        addProperty("artifactStatus", "verified-result-and-evidence")
        add("result", JsonObject().apply {
            addProperty("resultId", transitionedResultId.toString())
            addProperty("resultDigest", resultDigest)
            addProperty("providerDisposition", "completed")
            addProperty("terminationCause", "normal")
            addProperty("outcomeStatus", "failed")
            addProperty("outcomeBasis", "not-evaluated")
            addProperty("terminalState", state)
            addProperty("evidenceId", transitionedEvidenceId.toString())
            addProperty("evidenceDigest", evidenceDigest)
            add("warningCodes", JsonArray().apply {
                add("provider-output-redacted")
                if (!applied) add("local-cleanup-pending")
            })
            addProperty("startedAt", "2026-07-24T08:30:00.000Z")
            addProperty("endedAt", "2026-07-24T08:30:02.000Z")
        })
        add("evidence", JsonObject().apply {
            addProperty("evidenceId", transitionedEvidenceId.toString())
            addProperty("evidenceDigest", evidenceDigest)
            addProperty("eventCount", 2)
            add("eventTypeCounts", JsonObject().apply {
                addProperty("lifecycle", 1)
                addProperty("output", 1)
                addProperty("item", 0)
                addProperty("approval", 0)
                addProperty("warning", 0)
                addProperty("error", 0)
            })
            addProperty("eventsDigest", "sha256:${"c".repeat(64)}")
            addProperty("workflowStrategy", "sequential")
            addProperty("workflowStepCount", 1)
            addProperty("workflowAttemptCount", 1)
            addProperty("completedStepCount", 0)
            addProperty("charterEvidenceStatus", "not-assessed")
            addProperty("charterStopStatus", "not-assessed")
            addProperty("terminalReasonCode", if (applied) "workflow-output-gate-failed" else "staged-review-discarded")
            add("staging", JsonObject().apply {
                addProperty("changeCount", 2)
                addProperty("excludedPathCount", 0)
                addProperty("applyState", if (applied) "applied" else "discarded")
                addProperty("baselineDigest", "sha256:${"7".repeat(64)}")
                addProperty("finalDigest", "sha256:${"8".repeat(64)}")
                addProperty(
                    "changedInventoryDigest",
                    managedReviewPreview().getAsJsonObject("staging").get("changedInventoryDigest").asString,
                )
                addProperty("excludedPathSetDigest", canonicalDigest(JsonArray()))
            })
            add("actualEffectCounts", JsonObject().apply {
                addProperty("not-observed", 0)
                addProperty("observed-provisional", 0)
                addProperty("applied", if (applied) 1 else 0)
                addProperty("blocked", if (applied) 0 else 1)
                addProperty("unknown", 0)
            })
            addProperty("capturedAt", "2026-07-24T08:30:02.000Z")
        })
        if (applied) {
            add("applyDecision", JsonObject().apply {
                addProperty("receiptId", applyDecisionId.toString())
                addProperty("receiptDigest", applyDecisionDigest)
                addProperty("managedRunRevision", 3)
                addProperty("changedInventoryCount", 2)
                addProperty("writeEnvelopeCount", 1)
                addProperty(
                    "changedInventoryDigest",
                    managedReviewPreview().getAsJsonObject("staging").get("changedInventoryDigest").asString,
                )
                addProperty(
                    "writeEnvelopeDigest",
                    managedReviewPreview().getAsJsonObject("applyConfirmation").get("writeEnvelopeDigest").asString,
                )
                addProperty("decidedAt", "2026-07-24T08:30:01.000Z")
            })
        }
        addProperty(
            "authorityBoundary",
            "managed-evidence-detail-is-verified-read-only-evidence-and-does-not-grant-apply-approval-or-outcome-authority",
        )
        addProperty(
            "privacyBoundary",
            "Portable identifiers, states, counts, digests, warning codes and timestamps only; prompts, provider output, source bytes, changed paths, executable paths, process state and credentials are omitted.",
        )
    }
}

private fun refreshCanonicalDigest(value: JsonObject, digestKey: String) {
    value.remove(digestKey)
    value.addProperty(digestKey, canonicalDigest(value))
}

private fun managedGate(
    key: String,
    stepId: UUID?,
    phase: String,
    criteriaValues: List<String>,
): JsonObject {
    val criteria = JsonArray().apply { criteriaValues.forEach(::add) }
    return JsonObject().apply {
        addProperty("key", key)
        stepId?.let { addProperty("stepId", it.toString()) }
        addProperty("phase", phase)
        add("criteria", criteria)
        addProperty("criteriaDigest", canonicalDigest(criteria))
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

private fun dashboardEvidenceCues(freshness: String) = JsonObject().apply {
    addProperty("freshness", freshness)
    add("confidence", JsonObject().apply {
        addProperty("state", "not-assessed")
        addProperty("basis", "no-governed-confidence-evaluation-is-bound")
    })
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
