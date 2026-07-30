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
private val sourceId = UUID.fromString("36363636-3636-4636-8636-363636363636")
private val sourceBaselineId = UUID.fromString("37373737-3737-4737-8737-373737373737")
private val sourceProvenanceId = UUID.fromString("38383838-3838-4838-8838-383838383838")
private val businessUnderstandingId = UUID.fromString("39393939-3939-4939-8939-393939393939")
private val stakeholderModelId = UUID.fromString("40404040-4040-4040-8040-404040404040")
private val outcomeModelId = UUID.fromString("41414141-4141-4141-8141-414141414141")
private val businessCapabilityMapId = UUID.fromString("42424242-4242-4242-8242-424242424242")
private val valueStreamModelId = UUID.fromString("43434343-4343-4343-8343-434343434343")
private val operatingModelId = UUID.fromString("44444444-4444-4444-8444-444444444444")
private val businessRuleCatalogId = UUID.fromString("45454545-4545-4545-8545-454545454545")
private val businessArchitectureBaselineId = UUID.fromString("46464646-4646-4646-8646-464646464646")
private val systemSolutionArchitectureId = UUID.fromString("47474747-4747-4747-8747-474747474747")
private val boundedContextModelId = UUID.fromString("48484848-4848-4848-8848-484848484848")
private val securityPrivacyAssessmentId = UUID.fromString("49494949-4949-4949-8949-494949494949")
private val processModelId = UUID.fromString("50505050-5050-4050-8050-505050505050")
private val dataModelId = UUID.fromString("51515151-5151-4151-8151-515151515151")
private val authorizationModelId = UUID.fromString("52525252-5252-4252-8252-525252525252")
private val eventIntegrationModelId = UUID.fromString("53535353-5353-4353-8353-535353535353")
private val failureRecoveryModelId = UUID.fromString("54545454-5454-4454-8454-545454545454")
private val architectureChallengeModelId = UUID.fromString("56565656-5656-4656-8656-565656565656")
private val decisionRegisterId = UUID.fromString("57575757-5757-4757-8757-575757575757")
private val riskRegisterId = UUID.fromString("58585858-5858-4858-8858-585858585858")
private val evidenceRegistryId = UUID.fromString("59595959-5959-4959-8959-595959595959")
private val endToEndTraceabilityId = UUID.fromString("60606060-6060-4060-8060-606060606060")
private val p0P4ReadinessGateId = UUID.fromString("61616161-6161-4161-8161-616161616161")
private val p5HandoffPackageId = UUID.fromString("62626262-6262-4262-8262-626262626262")
private val designApplicabilityId = UUID.fromString("63636363-6363-4363-8363-636363636363")
private val designPersonaRoleId = UUID.fromString("64646464-6464-4464-8464-646464646464")
private val userJourneyId = UUID.fromString("65656565-6565-4565-8565-656565656565")
private val informationArchitectureId = UUID.fromString("66666666-6666-4666-8666-666666666666")
private val screenStateInventoryId = UUID.fromString("67676767-6767-4767-8767-676767676767")
private val designRequirementsId = UUID.fromString("68686868-6868-4868-8868-686868686868")
private val backlogHierarchyId = UUID.fromString("91919191-9191-4191-8191-919191919191")
private val mvpSliceDefinitionId = UUID.fromString("92929292-9292-4292-8292-929292929292")
private val designSystemTokenContractId = UUID.fromString("69696969-6969-4969-8969-696969696969")
private val accessibilityDesignRulesId = UUID.fromString("70707070-7070-4070-8070-707070707070")
private val responsiveMultiPlatformTargetsId = UUID.fromString("71717171-7171-4171-8171-717171717171")
private val manualFigmaExecutionPathId = UUID.fromString("72727272-7272-4272-8272-727272727272")
private val figmaMcpCapabilityDiscoveryId = UUID.fromString("73737373-7373-4373-8373-737373737373")
private val figmaReadSnapshotId = UUID.fromString("74747474-7474-4474-8474-747474747474")
private val figmaContextImportId = UUID.fromString("75757575-7575-4575-8575-757575757575")
private val outboundDesignBriefPackageId = UUID.fromString("76767676-7676-4676-8676-767676767676")
private val governedFigmaWriteId = UUID.fromString("77777777-7777-4777-8777-777777777777")
private val finalizedFigmaSnapshotImportId = UUID.fromString("78787878-7878-4878-8878-787878787878")
private val designToRequirementBindingId = UUID.fromString("79797979-7979-4979-8979-797979797979")
private val designerReadyGateId = UUID.fromString("80808080-8080-4080-8080-808080808080")
private val designDeltaId = UUID.fromString("81818181-8181-4181-8181-818181818181")
private val designConflictResolutionId = UUID.fromString("82828282-8282-4282-8282-828282828282")
private val humanDesignApprovalId = UUID.fromString("83838383-8383-4383-8383-838383838383")
private val designBaselineId = UUID.fromString("84848484-8484-4484-8484-848484848484")
private val designDriftDetectionId = UUID.fromString("87878787-8787-4787-8787-878787878787")
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
            "source.snapshot" -> handleSourceGovernance(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "business.snapshot" -> handleBusinessUnderstanding(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "business.capabilities.snapshot" -> handleBusinessCapabilityMap(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "business.valueStreams.snapshot" -> handleValueStreamModel(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "business.operatingModels.snapshot" -> handleOperatingModel(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "business.businessRules.snapshot" -> handleBusinessRuleCatalog(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "business.architectureBaselines.snapshot" -> handleBusinessArchitectureBaseline(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "architecture.systemSolution.snapshot" -> handleSystemSolutionArchitecture(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "architecture.boundedContexts.snapshot" -> handleBoundedContextModel(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "security.privacyThreat.snapshot" -> handleSecurityPrivacyAssessment(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "process.models.snapshot" -> handleProcessModel(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "data.models.snapshot" -> handleDataModel(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "authorization.models.snapshot" -> handleAuthorizationModel(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "integration.models.snapshot" -> handleEventIntegrationModel(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "recovery.models.snapshot" -> handleFailureRecoveryModel(
                request.get("id").asLong,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "challenge.models.snapshot" -> handleArchitectureChallengeModel(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "decision.registers.snapshot" -> handleDecisionRegister(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "risk.registers.snapshot" -> handleRiskRegister(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "evidence.registries.snapshot" -> handleEvidenceRegistry(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "traceability.graphs.snapshot" -> handleEndToEndTraceability(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "readiness.gates.snapshot" -> handleP0P4ReadinessGate(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "handoff.p5.snapshot" -> handleP5HandoffPackage(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "design.applicability.snapshot" -> handleDesignApplicability(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "design.personas.roles.snapshot" -> handleDesignPersonaRoleModel(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "design.journeys.snapshot" -> handleUserJourneyModel(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "design.informationArchitecture.snapshot" -> handleInformationArchitectureModel(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "design.screenStateInventory.snapshot" -> handleScreenStateInventory(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "design.requirements.snapshot" -> handleDesignRequirements(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "backlog.hierarchy.snapshot" -> handleBacklogHierarchy(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "planning.mvpSlices.snapshot" -> handleMvpSliceDefinition(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "design.systemTokenContract.snapshot" -> handleDesignSystemTokenContract(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "design.accessibilityRules.snapshot" -> handleAccessibilityDesignRules(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "design.responsiveMultiPlatformTargets.snapshot" -> handleResponsiveMultiPlatformTargets(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "design.manualFigmaExecutionPath.snapshot" -> handleManualFigmaExecutionPath(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "design.figmaMcpCapabilityDiscovery.snapshot" -> handleFigmaMcpCapabilityDiscovery(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "design.figmaReadSnapshot.snapshot" -> handleFigmaReadSnapshot(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "design.figmaContextImport.snapshot" -> handleFigmaContextImport(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "design.outboundDesignBriefPackage.snapshot" -> handleOutboundDesignBriefPackage(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "design.governedFigmaWrite.snapshot" -> handleGovernedFigmaWrite(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "design.finalizedFigmaSnapshotImport.snapshot" -> handleFinalizedFigmaSnapshotImport(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "design.designToRequirementBinding.snapshot" -> handleDesignToRequirementBinding(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "design.designerReadyGate.snapshot" -> handleDesignerReadyGate(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "design.designDelta.snapshot" -> handleDesignDelta(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "design.designConflictResolution.snapshot" -> handleDesignConflictResolution(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "design.humanDesignApproval.snapshot" -> handleHumanDesignApproval(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "design.designBaseline.snapshot" -> handleDesignBaseline(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "design.designDriftDetection.snapshot" -> handleDesignDriftDetection(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "dashboard.framework" -> handlePhaseDashboard(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "dashboard.phase2UxFigma" -> handlePhase2UxFigmaDashboard(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "dashboard.phase2ChangeImpactAgentModel" -> handlePhase2ChangeImpactAgentModelDashboard(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "dashboard.phase1Summary" -> handlePhase1Summary(
                id,
                request.getAsJsonObject("params"),
                workspacePath,
            )
            "dashboard.phase1ChangeImpact" -> handlePhase1ChangeImpact(
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
            "dashboard.phase1AgentModel" -> handlePhase1AgentModel(
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

private fun handleSourceGovernance(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE SOURCE GOVERNANCE PARAMS")
        return
    }
    val assessedAt = "2026-07-25T00:03:00.000Z"
    val baselineDigest = "sha256:${"a".repeat(64)}"
    val membershipDigest = "sha256:${"b".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "source-governance-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", 7)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("assessment", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "source-governance-assessment")
            addProperty("productId", productId.toString())
            addProperty("productRevision", 7)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            addProperty("sourceCount", 1)
            addProperty("baselineCount", 1)
            addProperty("provenanceCount", 1)
            addProperty("staleSourceCount", 0)
            addProperty("unknownAuthorityCount", 0)
            addProperty("unbaselinedSourceCount", 0)
            addProperty("unprovenancedSourceCount", 0)
            addProperty("state", "ready")
            add("reasons", JsonArray())
            add("currentBaseline", JsonObject().apply {
                addProperty("id", sourceBaselineId.toString())
                addProperty("revision", 1)
                addProperty("digest", baselineDigest)
                addProperty("membershipDigest", membershipDigest)
                addProperty("status", "current")
                addProperty("memberCount", 1)
            })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "source-governance-assessment-reports-recorded-evidence-and-does-not-designate-a-baseline-approve-readiness-or-authorize-action",
            )
        })
        add("sources", JsonArray().apply {
            add(JsonObject().apply {
                addProperty("id", sourceId.toString())
                addProperty("revision", 1)
                addProperty("title", "Reviewed repository source")
                addProperty("sourceType", "repository")
                add("owner", JsonObject().apply {
                    addProperty("kind", "human")
                    addProperty("id", "founder.source-review")
                })
                add("semanticAuthority", JsonObject().apply {
                    addProperty("standing", "authoritative")
                    addProperty("domain", "product requirements")
                    add("scope", JsonArray().apply { add("Initiative source governance") })
                })
                addProperty("knowledgeDisposition", "confirmed")
                addProperty("informationClassification", "internal")
                addProperty("freshness", "fresh")
                addProperty("availability", "available")
                addProperty("contentDigest", "sha256:${"c".repeat(64)}")
                addProperty("recordDigest", "sha256:${"d".repeat(64)}")
                addProperty("updatedAt", "2026-07-25T00:02:00.000Z")
            })
        })
        add("baselines", JsonArray().apply {
            add(JsonObject().apply {
                addProperty("id", sourceBaselineId.toString())
                addProperty("revision", 1)
                addProperty("title", "Candidate source baseline")
                addProperty("state", "candidate")
                addProperty("membershipDigest", membershipDigest)
                addProperty("memberCount", 1)
                addProperty("assessmentStatus", "current")
                addProperty("updatedAt", "2026-07-25T00:02:30.000Z")
            })
        })
        add("provenance", JsonArray().apply {
            add(JsonObject().apply {
                addProperty("id", sourceProvenanceId.toString())
                addProperty("targetKind", "governed-record")
                addProperty("targetDigest", "sha256:${"e".repeat(64)}")
                addProperty("disposition", "confirmed")
                addProperty("sourceCount", 1)
                addProperty("transformationCount", 1)
                addProperty("recordedAt", "2026-07-25T00:02:45.000Z")
            })
        })
        add("limits", JsonObject().apply {
            listOf("sources", "baselines", "provenance").forEach { name ->
                add(name, JsonObject().apply {
                    addProperty("shown", 1)
                    addProperty("total", 1)
                    addProperty("omitted", 0)
                })
            }
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-portable-governance-metadata-and-digests-only-not-source-bytes-locators-local-paths-or-credentials",
        )
        addProperty(
            "authorityBoundary",
            "source-governance-projection-does-not-designate-a-baseline-approve-readiness-transfer-authority-or-authorize-action",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-source-snapshot-binding") -> {
            value.getAsJsonObject("initiative").addProperty("digest", "sha256:${"0".repeat(64)}")
            refreshCanonicalDigest(value, "snapshotDigest")
        }
        workspacePath.endsWith("bad-source-snapshot-digest") -> {
            value.getAsJsonArray("sources")[0].asJsonObject.addProperty("title", "Forged source title")
        }
        workspacePath.endsWith("bad-source-snapshot-private") -> {
            value.addProperty("privateRoot", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleBusinessUnderstanding(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE BUSINESS UNDERSTANDING PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-business-snapshot-binding")) 8 else 7
    val assessedAt = "2026-07-25T00:04:00.000Z"
    val businessDigest = "sha256:${"3".repeat(64)}"
    val stakeholderDigest = "sha256:${"4".repeat(64)}"
    val outcomeDigest = "sha256:${"5".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "business-understanding-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("assessment", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "business-understanding-assessment")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("businessUnderstanding", JsonObject().apply {
                addProperty("recordId", businessUnderstandingId.toString())
                addProperty("revision", 2)
                addProperty("digest", businessDigest)
            })
            add("stakeholderModel", JsonObject().apply {
                addProperty("recordId", stakeholderModelId.toString())
                addProperty("revision", 1)
                addProperty("digest", stakeholderDigest)
            })
            add("outcomeModel", JsonObject().apply {
                addProperty("recordId", outcomeModelId.toString())
                addProperty("revision", 1)
                addProperty("digest", outcomeDigest)
            })
            addProperty("stakeholderCount", 8)
            addProperty("representedStakeholderCategoryCount", 8)
            addProperty("unresolvedStakeholderCategoryCount", 0)
            addProperty("verifiedAuthorityCount", 0)
            addProperty("unverifiedAuthorityCount", 0)
            addProperty("outcomeCount", 2)
            addProperty("measureCount", 4)
            addProperty("observedBaselineCount", 4)
            addProperty("unresolvedQuestionCount", 0)
            addProperty("blockingQuestionCount", 0)
            addProperty("staleBindingCount", 0)
            addProperty("staleSourceReferenceCount", 0)
            addProperty("state", "complete-for-review")
            add("reasons", JsonArray())
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "business-understanding-assessment-reports-recorded-candidate-evidence-and-does-not-approve-decide-designate-readiness-or-authorize-action",
            )
        })
        add("businessUnderstanding", JsonObject().apply {
            addProperty("id", businessUnderstandingId.toString())
            addProperty("revision", 2)
            addProperty("digest", businessDigest)
            addProperty("state", "candidate")
            addProperty("objectiveCount", 3)
            addProperty("constraintCount", 2)
            addProperty("assumptionCount", 1)
            addProperty("unresolvedQuestionCount", 0)
            addProperty("glossaryTermCount", 5)
            addProperty("updatedAt", "2026-07-25T00:03:30.000Z")
        })
        add("stakeholderModel", JsonObject().apply {
            addProperty("id", stakeholderModelId.toString())
            addProperty("revision", 1)
            addProperty("digest", stakeholderDigest)
            addProperty("state", "candidate")
            addProperty("stakeholderCount", 8)
            addProperty("representedCategoryCount", 8)
            addProperty("unresolvedCategoryCount", 0)
            addProperty("verifiedAuthorityCount", 0)
            addProperty("updatedAt", "2026-07-25T00:03:35.000Z")
        })
        add("outcomeModel", JsonObject().apply {
            addProperty("id", outcomeModelId.toString())
            addProperty("revision", 1)
            addProperty("digest", outcomeDigest)
            addProperty("state", "candidate")
            addProperty("outcomeCount", 2)
            addProperty("measureCount", 4)
            addProperty("countermetricCount", 1)
            addProperty("burdenMeasureCount", 1)
            addProperty("observedBaselineCount", 4)
            addProperty("updatedAt", "2026-07-25T00:03:40.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-identities-counts-statuses-and-digests-only-not-business-narrative-personal-data-source-content-locators-or-credentials",
        )
        addProperty(
            "authorityBoundary",
            "business-understanding-projection-does-not-approve-appoint-decide-designate-readiness-or-authorize-action",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-business-snapshot-digest") -> {
            value.getAsJsonObject("outcomeModel").addProperty("measureCount", 5)
        }
        workspacePath.endsWith("bad-business-snapshot-private") -> {
            value.addProperty("personalAssignment", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleBusinessCapabilityMap(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE BUSINESS CAPABILITY MAP PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-capability-snapshot-binding")) 8 else 7
    val assessedAt = "2026-07-25T00:04:10.000Z"
    val mapDigest = "sha256:${"6".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "business-capability-map-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("assessment", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "business-capability-map-assessment")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("capabilityMap", JsonObject().apply {
                addProperty("recordId", businessCapabilityMapId.toString())
                addProperty("revision", 2)
                addProperty("digest", mapDigest)
            })
            addProperty("capabilityCount", 7)
            addProperty("ownedCapabilityCount", 6)
            addProperty("unownedCapabilityCount", 1)
            addProperty("objectiveCoverageCount", 3)
            addProperty("outcomeCoverageCount", 2)
            addProperty("openGapCount", 2)
            addProperty("criticalGapCount", 1)
            addProperty("unknownCurrentMaturityCount", 1)
            addProperty("unassessedPriorityCount", 1)
            addProperty("staleBindingCount", 0)
            addProperty("staleSourceReferenceCount", 0)
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("One or more capabilities do not have a candidate owner") })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "business-capability-map-assessment-reports-recorded-candidate-coverage-and-gaps-and-does-not-approve-priority-readiness-or-authorize-action",
            )
        })
        add("capabilityMap", JsonObject().apply {
            addProperty("id", businessCapabilityMapId.toString())
            addProperty("revision", 2)
            addProperty("digest", mapDigest)
            addProperty("state", "candidate")
            addProperty("capabilityCount", 7)
            addProperty("ownedCapabilityCount", 6)
            addProperty("openGapCount", 2)
            addProperty("criticalGapCount", 1)
            addProperty("candidatePriorityCount", 6)
            addProperty("updatedAt", "2026-07-25T00:04:09.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-identities-counts-statuses-and-digests-only-not-capability-narrative-personal-data-source-content-locators-or-credentials",
        )
        addProperty(
            "authorityBoundary",
            "business-capability-map-projection-does-not-approve-prioritize-baseline-designate-readiness-or-authorize-action",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-capability-snapshot-digest") -> {
            value.getAsJsonObject("capabilityMap").addProperty("openGapCount", 3)
        }
        workspacePath.endsWith("bad-capability-snapshot-private") -> {
            value.addProperty("capabilityNarrative", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleValueStreamModel(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE VALUE STREAM MODEL PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-value-stream-snapshot-binding")) 8 else 7
    val assessedAt = "2026-07-25T00:05:00.000Z"
    val modelDigest = "sha256:${"7".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "value-stream-model-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("assessment", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "value-stream-model-assessment")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("valueStreamModel", JsonObject().apply {
                addProperty("recordId", valueStreamModelId.toString())
                addProperty("revision", 2)
                addProperty("digest", modelDigest)
            })
            addProperty("valueStreamCount", 3)
            addProperty("ownedValueStreamCount", 2)
            addProperty("unownedValueStreamCount", 1)
            addProperty("stageCount", 9)
            addProperty("dependencyCount", 2)
            addProperty("capabilityCoverageCount", 6)
            addProperty("outcomeCoverageCount", 2)
            addProperty("absentFlowEvidenceCount", 1)
            addProperty("openBottleneckCount", 2)
            addProperty("criticalBottleneckCount", 1)
            addProperty("staleBindingCount", 0)
            addProperty("staleSourceReferenceCount", 0)
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("One or more value streams do not have a candidate owner") })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "value-stream-model-assessment-reports-recorded-candidate-flow-coverage-and-gaps-and-does-not-approve-baseline-readiness-or-authorize-action",
            )
        })
        add("valueStreamModel", JsonObject().apply {
            addProperty("id", valueStreamModelId.toString())
            addProperty("revision", 2)
            addProperty("digest", modelDigest)
            addProperty("state", "candidate")
            addProperty("valueStreamCount", 3)
            addProperty("ownedValueStreamCount", 2)
            addProperty("stageCount", 9)
            addProperty("dependencyCount", 2)
            addProperty("openBottleneckCount", 2)
            addProperty("criticalBottleneckCount", 1)
            addProperty("updatedAt", "2026-07-25T00:04:59.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-identities-counts-statuses-and-digests-only-not-value-stream-narrative-personal-data-source-content-locators-or-credentials",
        )
        addProperty(
            "authorityBoundary",
            "value-stream-model-projection-does-not-approve-baseline-priority-readiness-or-authorize-action",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-value-stream-snapshot-digest") -> {
            value.getAsJsonObject("valueStreamModel").addProperty("openBottleneckCount", 3)
        }
        workspacePath.endsWith("bad-value-stream-snapshot-private") -> {
            value.addProperty("valueStreamNarrative", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleOperatingModel(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE OPERATING MODEL PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-operating-model-snapshot-binding")) 8 else 7
    val assessedAt = "2026-07-26T07:00:00.000Z"
    val modelDigest = "sha256:${"8".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "operating-model-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("assessment", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "operating-model-assessment")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("operatingModel", JsonObject().apply {
                addProperty("recordId", operatingModelId.toString())
                addProperty("revision", 2)
                addProperty("digest", modelDigest)
            })
            addProperty("roleCount", 6)
            addProperty("governanceSystemCount", 2)
            addProperty("unassignedAppointingAuthorityCount", 1)
            addProperty("insufficientCapacityCount", 2)
            addProperty("unfundedCapacityCount", 3)
            addProperty("decisionRightCount", 8)
            addProperty("unassignedDecisionAuthorityCount", 1)
            addProperty("forumCount", 2)
            addProperty("cycleCount", 3)
            addProperty("supportCapacityGapCount", 1)
            addProperty("emergencyAuthorityGapCount", 1)
            addProperty("staleBindingCount", 0)
            addProperty("staleSourceReferenceCount", 0)
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("One or more candidate roles have no candidate appointing authority") })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "operating-model-assessment-reports-candidate-structural-coverage-and-gaps-and-does-not-appoint-fund-approve-baseline-readiness-or-authorize-action",
            )
        })
        add("operatingModel", JsonObject().apply {
            addProperty("id", operatingModelId.toString())
            addProperty("revision", 2)
            addProperty("digest", modelDigest)
            addProperty("state", "candidate")
            addProperty("roleCount", 6)
            addProperty("decisionRightCount", 8)
            addProperty("forumCount", 2)
            addProperty("cycleCount", 3)
            addProperty("updatedAt", "2026-07-26T06:59:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-identities-counts-statuses-and-digests-only-not-operating-narrative-personal-data-source-content-locators-or-credentials",
        )
        addProperty(
            "authorityBoundary",
            "operating-model-projection-does-not-appoint-fund-approve-baseline-readiness-or-authorize-action",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-operating-model-snapshot-digest") -> {
            value.getAsJsonObject("operatingModel").addProperty("roleCount", 7)
        }
        workspacePath.endsWith("bad-operating-model-snapshot-private") -> {
            value.addProperty("operatingNarrative", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleBusinessRuleCatalog(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE BUSINESS RULE PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-business-rule-snapshot-binding")) 8 else 7
    val assessedAt = "2026-07-26T08:30:00.000Z"
    val catalogDigest = "sha256:${"9".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "business-rule-catalog-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("assessment", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "business-rule-catalog-assessment")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("businessRuleCatalog", JsonObject().apply {
                addProperty("recordId", businessRuleCatalogId.toString())
                addProperty("revision", 2)
                addProperty("digest", catalogDigest)
            })
            addProperty("ruleCount", 7)
            addProperty("sourceBackedRuleCount", 7)
            addProperty("nonExceptionableRuleCount", 3)
            addProperty("enforcementTargetCount", 4)
            addProperty("unassignedEnforcementTargetCount", 1)
            addProperty("unverifiedEnforcementTargetCount", 2)
            addProperty("exceptionCount", 2)
            addProperty("unassignedExceptionAuthorityCount", 1)
            addProperty("staleBindingCount", 0)
            addProperty("staleSourceReferenceCount", 0)
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("One or more enforcement targets have no candidate assignment") })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "business-rule-catalog-assessment-reports-candidate-coverage-and-gaps-and-does-not-evaluate-policy-grant-exceptions-deploy-enforcement-approve-baseline-readiness-or-authorize-action",
            )
        })
        add("businessRuleCatalog", JsonObject().apply {
            addProperty("id", businessRuleCatalogId.toString())
            addProperty("revision", 2)
            addProperty("digest", catalogDigest)
            addProperty("state", "candidate")
            addProperty("ruleCount", 7)
            addProperty("enforcementTargetCount", 4)
            addProperty("exceptionCount", 2)
            addProperty("nonExceptionableRuleCount", 3)
            addProperty("updatedAt", "2026-07-26T08:29:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-identities-counts-statuses-and-digests-only-not-rule-narrative-source-content-personal-data-locators-or-credentials",
        )
        addProperty(
            "authorityBoundary",
            "business-rule-catalog-projection-does-not-evaluate-policy-grant-exceptions-deploy-enforcement-approve-baseline-readiness-or-authorize-action",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-business-rule-snapshot-digest") -> {
            value.getAsJsonObject("businessRuleCatalog").addProperty("ruleCount", 8)
        }
        workspacePath.endsWith("bad-business-rule-snapshot-private") -> {
            value.addProperty("ruleNarrative", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleBusinessArchitectureBaseline(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE BUSINESS ARCHITECTURE BASELINE PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-business-architecture-baseline-snapshot-binding")) 8 else 7
    val assessedAt = "2026-07-26T09:30:00.000Z"
    val baselineDigest = "sha256:${"a".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "business-architecture-baseline-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("assessment", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "business-architecture-baseline-assessment")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("baseline", JsonObject().apply {
                addProperty("recordId", businessArchitectureBaselineId.toString())
                addProperty("revision", 2)
                addProperty("digest", baselineDigest)
            })
            addProperty("coveredElementCount", 27)
            addProperty("includedElementCount", 25)
            addProperty("excludedElementCount", 1)
            addProperty("unresolvedElementCount", 1)
            addProperty("integrationClaimCount", 8)
            addProperty("consistencyCheckCount", 6)
            addProperty("consistencyGapCount", 2)
            addProperty("staleBindingCount", 1)
            addProperty("staleSourceReferenceCount", 0)
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("One or more candidate architecture elements remain unresolved") })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "business-architecture-baseline-assessment-reports-candidate-coherence-and-gaps-and-does-not-designate-or-approve-a-baseline-establish-readiness-or-authorize-action",
            )
        })
        add("baseline", JsonObject().apply {
            addProperty("id", businessArchitectureBaselineId.toString())
            addProperty("revision", 2)
            addProperty("digest", baselineDigest)
            addProperty("membershipDigest", "sha256:${"d".repeat(64)}")
            addProperty("state", "candidate")
            addProperty("coveredElementCount", 27)
            addProperty("integrationClaimCount", 8)
            addProperty("consistencyGapCount", 2)
            addProperty("updatedAt", "2026-07-26T09:29:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-identities-counts-statuses-and-digests-only-not-architecture-narrative-source-content-personal-data-locators-or-credentials",
        )
        addProperty(
            "authorityBoundary",
            "business-architecture-baseline-projection-does-not-designate-or-approve-a-baseline-establish-readiness-grant-exceptions-deploy-enforcement-or-authorize-action",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-business-architecture-baseline-snapshot-digest") -> {
            value.getAsJsonObject("baseline").addProperty("coveredElementCount", 28)
        }
        workspacePath.endsWith("bad-business-architecture-baseline-snapshot-private") -> {
            value.addProperty("architectureNarrative", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleSystemSolutionArchitecture(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE SYSTEM SOLUTION ARCHITECTURE PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-system-solution-architecture-snapshot-binding")) 8 else 7
    val assessedAt = "2026-07-26T10:30:00.000Z"
    val architectureDigest = "sha256:${"b".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "system-solution-architecture-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("assessment", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "system-solution-architecture-assessment")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("architecture", JsonObject().apply {
                addProperty("recordId", systemSolutionArchitectureId.toString())
                addProperty("revision", 3)
                addProperty("digest", architectureDigest)
            })
            addProperty("concernCount", 4)
            addProperty("viewCount", 3)
            addProperty("elementCount", 9)
            addProperty("relationCount", 12)
            addProperty("qualityAttributeCount", 5)
            addProperty("unresolvedQualityAttributeCount", 1)
            addProperty("decisionCount", 4)
            addProperty("unresolvedDecisionCount", 2)
            addProperty("conformanceCriterionCount", 6)
            addProperty("unresolvedConformanceCriterionCount", 1)
            addProperty("lifecycleGapCount", 1)
            addProperty("inconsistencyCount", 0)
            addProperty("unresolvedQuestionCount", 2)
            addProperty("staleBindingCount", 1)
            addProperty("staleSourceReferenceCount", 0)
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("One or more architecture decisions remain unresolved") })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "system-solution-architecture-assessment-reports-candidate-coverage-and-gaps-and-does-not-approve-baseline-readiness-conformance-technology-or-action",
            )
        })
        add("architecture", JsonObject().apply {
            addProperty("id", systemSolutionArchitectureId.toString())
            addProperty("revision", 3)
            addProperty("digest", architectureDigest)
            addProperty("membershipDigest", "sha256:${"e".repeat(64)}")
            addProperty("state", "candidate")
            addProperty("concernCount", 4)
            addProperty("viewCount", 3)
            addProperty("elementCount", 9)
            addProperty("qualityAttributeCount", 5)
            addProperty("decisionCount", 4)
            addProperty("updatedAt", "2026-07-26T10:29:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-identities-counts-statuses-and-digests-only-not-architecture-narrative-source-content-personal-data-locators-or-credentials",
        )
        addProperty(
            "authorityBoundary",
            "system-solution-architecture-projection-does-not-approve-or-designate-an-architecture-baseline-establish-readiness-prove-conformance-mandate-technology-or-authorize-action",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-system-solution-architecture-snapshot-digest") -> {
            value.getAsJsonObject("architecture").addProperty("elementCount", 10)
        }
        workspacePath.endsWith("bad-system-solution-architecture-snapshot-private") -> {
            value.addProperty("architectureNarrative", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleBoundedContextModel(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE BOUNDED CONTEXT PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-bounded-context-snapshot-binding")) 8 else 7
    val assessedAt = "2026-07-26T11:00:00.000Z"
    val modelDigest = "sha256:${"3".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "bounded-context-ownership-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("assessment", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "bounded-context-ownership-assessment")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("model", JsonObject().apply {
                addProperty("recordId", boundedContextModelId.toString())
                addProperty("revision", 2)
                addProperty("digest", modelDigest)
            })
            addProperty("boundedContextCount", 3)
            addProperty("coreContextCount", 1)
            addProperty("languageTermCount", 11)
            addProperty("contractCount", 4)
            addProperty("unresolvedContractCount", 1)
            addProperty("relationshipCount", 3)
            addProperty("unresolvedRelationshipCount", 1)
            addProperty("unassignedArchitectureElementCount", 2)
            addProperty("unownedDataAssetCount", 1)
            addProperty("unmappedCrossContextRelationCount", 2)
            addProperty("inconsistencyCount", 0)
            addProperty("unresolvedQuestionCount", 2)
            addProperty("staleBindingCount", 1)
            addProperty("staleSourceReferenceCount", 0)
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("One or more cross-context contracts remain unresolved") })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "bounded-context-model-assessment-reports-candidate-coverage-and-gaps-and-does-not-appoint-owners-approve-boundaries-accept-contracts-establish-readiness-or-authorize-action",
            )
        })
        add("model", JsonObject().apply {
            addProperty("id", boundedContextModelId.toString())
            addProperty("revision", 2)
            addProperty("digest", modelDigest)
            addProperty("membershipDigest", "sha256:${"4".repeat(64)}")
            addProperty("state", "candidate")
            addProperty("boundedContextCount", 3)
            addProperty("contractCount", 4)
            addProperty("relationshipCount", 3)
            addProperty("updatedAt", "2026-07-26T10:59:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-identities-counts-statuses-and-digests-only-not-boundary-language-contract-source-content-personal-data-locators-or-credentials",
        )
        addProperty(
            "authorityBoundary",
            "bounded-context-model-projection-does-not-appoint-owners-approve-boundaries-accept-contracts-establish-readiness-or-authorize-action",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-bounded-context-snapshot-digest") -> {
            value.getAsJsonObject("model").addProperty("boundedContextCount", 4)
        }
        workspacePath.endsWith("bad-bounded-context-snapshot-private") -> {
            value.addProperty("ubiquitousLanguage", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleSecurityPrivacyAssessment(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE SECURITY PRIVACY PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-security-privacy-snapshot-binding")) 8 else 7
    val assessedAt = "2026-07-26T11:15:00.000Z"
    val assessmentDigest = "sha256:${"5".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "security-privacy-threat-assessment-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "security-privacy-threat-assessment-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("assessment", JsonObject().apply {
                addProperty("recordId", securityPrivacyAssessmentId.toString())
                addProperty("revision", 2)
                addProperty("digest", assessmentDigest)
            })
            addProperty("assetCount", 4)
            addProperty("actorCount", 5)
            addProperty("trustBoundaryCount", 3)
            addProperty("dataClassCount", 2)
            addProperty("dataFlowCount", 4)
            addProperty("controlCount", 6)
            addProperty("threatCount", 7)
            addProperty("unresolvedThreatCount", 2)
            addProperty("unverifiedControlCount", 1)
            addProperty("unresolvedProcessingAuthorityCount", 1)
            addProperty("uncoveredArchitectureElementCount", 0)
            addProperty("unmappedArchitectureRelationCount", 1)
            addProperty("unresolvedRequirementCount", 3)
            addProperty("inconsistencyCount", 0)
            addProperty("unresolvedQuestionCount", 2)
            addProperty("staleBindingCount", 1)
            addProperty("staleSourceReferenceCount", 0)
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("One or more Security or Data Profile requirements remain unresolved") })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "security-privacy-threat-status-reports-candidate-coverage-and-gaps-and-does-not-approve-threats-attest-controls-accept-risk-approve-processing-establish-security-readiness-or-authorize-action",
            )
        })
        add("assessment", JsonObject().apply {
            addProperty("id", securityPrivacyAssessmentId.toString())
            addProperty("revision", 2)
            addProperty("digest", assessmentDigest)
            addProperty("membershipDigest", "sha256:${"6".repeat(64)}")
            addProperty("state", "candidate")
            addProperty("assetCount", 4)
            addProperty("trustBoundaryCount", 3)
            addProperty("dataClassCount", 2)
            addProperty("controlCount", 6)
            addProperty("threatCount", 7)
            addProperty("updatedAt", "2026-07-26T11:14:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-identities-counts-statuses-and-digests-only-not-threat-scenarios-control-content-data-content-personal-data-locators-secrets-or-credentials",
        )
        addProperty(
            "authorityBoundary",
            "security-privacy-threat-projection-does-not-approve-a-threat-model-attest-control-effectiveness-accept-risk-approve-processing-establish-security-readiness-or-authorize-action",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-security-privacy-snapshot-digest") -> {
            value.getAsJsonObject("assessment").addProperty("assetCount", 5)
        }
        workspacePath.endsWith("bad-security-privacy-snapshot-private") -> {
            value.addProperty("threatScenario", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleProcessModel(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE PROCESS MODEL PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-process-model-snapshot-binding")) 8 else 7
    val assessedAt = "2026-07-26T11:30:00.000Z"
    val modelDigest = "sha256:${"7".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "process-model-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "process-model-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("model", JsonObject().apply {
                addProperty("recordId", processModelId.toString())
                addProperty("revision", 2)
                addProperty("digest", modelDigest)
            })
            addProperty("processCount", 3)
            addProperty("stepCount", 9)
            addProperty("stateDimensionCount", 5)
            addProperty("stateValueCount", 18)
            addProperty("transitionCount", 11)
            addProperty("eventDefinitionCount", 8)
            addProperty("approvalRequirementCount", 4)
            addProperty("uncoveredValueStreamCount", 1)
            addProperty("uncoveredBoundedContextCount", 2)
            addProperty("uncoveredBusinessRuleCount", 3)
            addProperty("unresolvedRequirementCount", 4)
            addProperty("inconsistencyCount", 1)
            addProperty("unresolvedQuestionCount", 2)
            addProperty("staleBindingCount", 1)
            addProperty("staleSourceReferenceCount", 0)
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("One or more Process Model requirements remain unresolved") })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "process-model-status-reports-candidate-coverage-and-gaps-and-does-not-approve-workflows-grant-transition-or-execution-authority-establish-operational-readiness-or-authorize-action",
            )
        })
        add("model", JsonObject().apply {
            addProperty("id", processModelId.toString())
            addProperty("revision", 2)
            addProperty("digest", modelDigest)
            addProperty("membershipDigest", "sha256:${"8".repeat(64)}")
            addProperty("state", "candidate")
            addProperty("processCount", 3)
            addProperty("transitionCount", 11)
            addProperty("approvalRequirementCount", 4)
            addProperty("updatedAt", "2026-07-26T11:29:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-identities-counts-statuses-and-digests-only-not-process-narrative-transition-guards-approval-content-source-content-personal-data-locators-secrets-or-credentials",
        )
        addProperty(
            "authorityBoundary",
            "process-model-projection-does-not-approve-workflows-grant-transition-or-execution-authority-establish-operational-readiness-or-authorize-action",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-process-model-snapshot-digest") -> {
            value.getAsJsonObject("model").addProperty("processCount", 4)
        }
        workspacePath.endsWith("bad-process-model-snapshot-private") -> {
            value.addProperty("transitionGuard", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleDataModel(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE DATA MODEL PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-data-model-snapshot-binding")) 8 else 7
    val assessedAt = "2026-07-26T12:30:00.000Z"
    val modelDigest = "sha256:${"9".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "data-model-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "data-model-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("model", JsonObject().apply {
                addProperty("recordId", dataModelId.toString())
                addProperty("revision", 2)
                addProperty("digest", modelDigest)
            })
            addProperty("entityCount", 6)
            addProperty("attributeCount", 24)
            addProperty("relationshipCount", 8)
            addProperty("lifecycleCount", 6)
            addProperty("transformationCount", 5)
            addProperty("uncoveredBoundedContextCount", 1)
            addProperty("uncoveredSecurityDataClassCount", 2)
            addProperty("uncoveredProcessCount", 3)
            addProperty("unresolvedSystemOfRecordCount", 1)
            addProperty("unresolvedTransformationCount", 2)
            addProperty("unresolvedRequirementCount", 4)
            addProperty("inconsistencyCount", 1)
            addProperty("unresolvedQuestionCount", 2)
            addProperty("staleBindingCount", 1)
            addProperty("staleSourceReferenceCount", 0)
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("One or more Data Model requirements remain unresolved") })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "data-model-status-reports-candidate-coverage-and-gaps-and-does-not-approve-a-data-model-or-classification-appoint-ownership-grant-migration-authority-establish-operational-readiness-or-authorize-action",
            )
        })
        add("model", JsonObject().apply {
            addProperty("id", dataModelId.toString())
            addProperty("revision", 2)
            addProperty("digest", modelDigest)
            addProperty("membershipDigest", "sha256:${"a".repeat(64)}")
            addProperty("state", "candidate")
            addProperty("entityCount", 6)
            addProperty("relationshipCount", 8)
            addProperty("lifecycleCount", 6)
            addProperty("updatedAt", "2026-07-26T12:29:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-identities-counts-statuses-and-digests-only-not-entity-attributes-relationships-lifecycle-content-source-content-personal-data-locators-secrets-or-credentials",
        )
        addProperty(
            "authorityBoundary",
            "data-model-projection-does-not-approve-a-data-model-or-classification-appoint-ownership-grant-migration-authority-establish-operational-readiness-or-authorize-action",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-data-model-snapshot-digest") -> {
            value.getAsJsonObject("model").addProperty("entityCount", 7)
        }
        workspacePath.endsWith("bad-data-model-snapshot-private") -> {
            value.addProperty("entityAttribute", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleAuthorizationModel(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE AUTHORIZATION MODEL PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-authorization-model-snapshot-binding")) 8 else 7
    val assessedAt = "2026-07-26T13:30:00.000Z"
    val modelDigest = "sha256:${"b".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "authorization-model-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "authorization-model-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("model", JsonObject().apply {
                addProperty("recordId", authorizationModelId.toString())
                addProperty("revision", 2)
                addProperty("digest", modelDigest)
            })
            addProperty("principalCount", 5)
            addProperty("roleAssignmentCount", 6)
            addProperty("resourceCount", 7)
            addProperty("actionCount", 8)
            addProperty("approvalBindingCount", 3)
            addProperty("ruleCount", 9)
            addProperty("uncoveredOperatingRoleCount", 1)
            addProperty("uncoveredProcessCount", 2)
            addProperty("uncoveredDataEntityCount", 3)
            addProperty("unresolvedIdentityCount", 4)
            addProperty("unresolvedRuleCount", 5)
            addProperty("unresolvedRequirementCount", 6)
            addProperty("inconsistencyCount", 1)
            addProperty("unresolvedQuestionCount", 2)
            addProperty("staleBindingCount", 1)
            addProperty("staleSourceReferenceCount", 0)
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("One or more Authorization Rules remain unresolved") })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "authorization-model-status-reports-candidate-coverage-and-gaps-and-does-not-verify-identity-approve-role-assignments-or-standing-authority-create-an-authorization-grant-enforce-policy-establish-operational-readiness-or-authorize-action",
            )
        })
        add("model", JsonObject().apply {
            addProperty("id", authorizationModelId.toString())
            addProperty("revision", 2)
            addProperty("digest", modelDigest)
            addProperty("membershipDigest", "sha256:${"c".repeat(64)}")
            addProperty("state", "candidate")
            addProperty("principalCount", 5)
            addProperty("actionCount", 8)
            addProperty("ruleCount", 9)
            addProperty("updatedAt", "2026-07-26T13:29:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-identities-counts-statuses-and-digests-only-not-principal-identifiers-role-assignments-rules-conditions-approval-content-source-content-personal-data-locators-secrets-or-credentials",
        )
        addProperty(
            "authorityBoundary",
            "authorization-model-projection-does-not-verify-identity-approve-role-assignments-or-standing-authority-create-an-authorization-grant-enforce-policy-establish-operational-readiness-or-authorize-action",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-authorization-model-snapshot-digest") -> {
            value.getAsJsonObject("model").addProperty("principalCount", 6)
        }
        workspacePath.endsWith("bad-authorization-model-snapshot-private") -> {
            value.addProperty("principalIdentifier", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleEventIntegrationModel(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE EVENT INTEGRATION MODEL PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-event-integration-model-snapshot-binding")) 8 else 7
    val assessedAt = "2026-07-26T14:00:00.000Z"
    val modelDigest = "sha256:${"d".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "event-integration-model-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "event-integration-model-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("model", JsonObject().apply {
                addProperty("recordId", eventIntegrationModelId.toString())
                addProperty("revision", 2)
                addProperty("digest", modelDigest)
            })
            addProperty("eventTypeCount", 10)
            addProperty("commandCount", 11)
            addProperty("adapterCount", 4)
            addProperty("externalContractCount", 5)
            addProperty("mappingCount", 6)
            addProperty("routeCount", 7)
            addProperty("uncoveredProcessEventCount", 1)
            addProperty("uncoveredProcessCount", 2)
            addProperty("uncoveredBoundedContextCount", 3)
            addProperty("uncoveredDataEntityCount", 4)
            addProperty("uncoveredAuthorizationActionCount", 5)
            addProperty("unknownMappingTruthCount", 6)
            addProperty("unresolvedRequirementCount", 7)
            addProperty("inconsistencyCount", 1)
            addProperty("unresolvedQuestionCount", 2)
            addProperty("staleBindingCount", 1)
            addProperty("staleSourceReferenceCount", 0)
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("One or more integration mappings remain unresolved") })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "event-integration-model-status-reports-candidate-coverage-and-gaps-and-does-not-prove-event-occurrence-send-or-deliver-a-command-accept-an-external-contract-activate-an-adapter-create-an-authorization-grant-execute-an-effect-establish-operational-readiness-or-authorize-action",
            )
        })
        add("model", JsonObject().apply {
            addProperty("id", eventIntegrationModelId.toString())
            addProperty("revision", 2)
            addProperty("digest", modelDigest)
            addProperty("membershipDigest", "sha256:${"e".repeat(64)}")
            addProperty("state", "candidate")
            addProperty("eventTypeCount", 10)
            addProperty("commandCount", 11)
            addProperty("adapterCount", 4)
            addProperty("externalContractCount", 5)
            addProperty("mappingCount", 6)
            addProperty("routeCount", 7)
            addProperty("updatedAt", "2026-07-26T13:59:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-identities-counts-statuses-and-digests-only-not-event-payloads-command-inputs-mapping-content-external-locators-source-content-personal-data-secrets-or-credentials",
        )
        addProperty(
            "authorityBoundary",
            "event-integration-model-projection-does-not-prove-event-occurrence-send-or-deliver-a-command-accept-an-external-contract-activate-an-adapter-create-an-authorization-grant-execute-an-effect-establish-operational-readiness-or-authorize-action",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-event-integration-model-snapshot-digest") -> {
            value.getAsJsonObject("model").addProperty("routeCount", 8)
        }
        workspacePath.endsWith("bad-event-integration-model-snapshot-private") -> {
            value.addProperty("eventPayload", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleFailureRecoveryModel(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE FAILURE RECOVERY MODEL PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-failure-recovery-model-snapshot-binding")) 8 else 7
    val assessedAt = "2026-07-26T15:00:00.000Z"
    val modelDigest = "sha256:${"c".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "failure-recovery-model-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "failure-recovery-model-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("model", JsonObject().apply {
                addProperty("recordId", failureRecoveryModelId.toString())
                addProperty("revision", 2)
                addProperty("digest", modelDigest)
            })
            addProperty("failureModeCount", 8)
            addProperty("retryPolicyCount", 6)
            addProperty("compensationPlanCount", 5)
            addProperty("recoveryPlanCount", 4)
            addProperty("recoveryEvidenceDefinitionCount", 3)
            addProperty("uncoveredProcessCount", 1)
            addProperty("uncoveredCommandCount", 2)
            addProperty("uncoveredRouteCount", 3)
            addProperty("uncoveredAuthorizationActionCount", 4)
            addProperty("unresolvedRecoveryEvidenceCount", 5)
            addProperty("unresolvedRequirementCount", 6)
            addProperty("inconsistencyCount", 1)
            addProperty("unresolvedQuestionCount", 2)
            addProperty("staleBindingCount", 1)
            addProperty("staleSourceReferenceCount", 0)
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("One or more recovery evidence definitions remain unresolved") })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "failure-recovery-model-status-reports-candidate-coverage-and-gaps-and-does-not-prove-failure-occurrence-retry-safety-compensation-or-restoration-recovery-success-return-to-service-operational-readiness-or-authorize-action",
            )
        })
        add("model", JsonObject().apply {
            addProperty("id", failureRecoveryModelId.toString())
            addProperty("revision", 2)
            addProperty("digest", modelDigest)
            addProperty("membershipDigest", "sha256:${"b".repeat(64)}")
            addProperty("state", "candidate")
            addProperty("failureModeCount", 8)
            addProperty("retryPolicyCount", 6)
            addProperty("compensationPlanCount", 5)
            addProperty("recoveryPlanCount", 4)
            addProperty("recoveryEvidenceDefinitionCount", 3)
            addProperty("updatedAt", "2026-07-26T14:59:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-identities-counts-statuses-and-digests-only-not-failure-evidence-operational-telemetry-retry-keys-compensation-content-recovery-steps-source-content-personal-data-secrets-or-credentials",
        )
        addProperty(
            "authorityBoundary",
            "failure-recovery-model-projection-does-not-prove-failure-occurrence-retry-safety-compensation-or-restoration-recovery-success-return-to-service-operational-readiness-or-authorize-action",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-failure-recovery-model-snapshot-digest") -> {
            value.getAsJsonObject("model").addProperty("recoveryPlanCount", 5)
        }
        workspacePath.endsWith("bad-failure-recovery-model-snapshot-private") -> {
            value.addProperty("recoveryEvidence", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleArchitectureChallengeModel(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE ARCHITECTURE CHALLENGE PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-architecture-challenge-snapshot-binding")) 8 else 7
    val assessedAt = "2026-07-26T16:00:00.000Z"
    val modelDigest = "sha256:${"d".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "architecture-challenge-model-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "architecture-challenge-model-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("model", JsonObject().apply {
                addProperty("recordId", architectureChallengeModelId.toString())
                addProperty("revision", 2)
                addProperty("digest", modelDigest)
            })
            addProperty("challengeSubjectCount", 9)
            addProperty("assumptionCount", 7)
            addProperty("alternativeCount", 4)
            addProperty("findingCount", 6)
            addProperty("responseCount", 5)
            addProperty("unrespondedFindingCount", 1)
            addProperty("unresolvedAssumptionCount", 2)
            addProperty("unresolvedRequirementCount", 3)
            addProperty("inconsistencyCount", 1)
            addProperty("unresolvedQuestionCount", 2)
            addProperty("staleBindingCount", 1)
            addProperty("staleSourceReferenceCount", 0)
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("One or more challenge findings remain unresponded") })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "architecture-challenge-status-reports-candidate-coverage-and-gaps-and-does-not-establish-independence-assurance-risk-acceptance-architecture-approval-operational-readiness-or-authorize-action",
            )
        })
        add("model", JsonObject().apply {
            addProperty("id", architectureChallengeModelId.toString())
            addProperty("revision", 2)
            addProperty("digest", modelDigest)
            addProperty("membershipDigest", "sha256:${"a".repeat(64)}")
            addProperty("state", "candidate")
            addProperty("challengeSubjectCount", 9)
            addProperty("assumptionCount", 7)
            addProperty("alternativeCount", 4)
            addProperty("findingCount", 6)
            addProperty("responseCount", 5)
            addProperty("updatedAt", "2026-07-26T15:59:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-identities-counts-statuses-and-digests-only-not-challenge-content-assumptions-evidence-findings-responses-source-content-personal-data-secrets-or-credentials",
        )
        addProperty(
            "authorityBoundary",
            "architecture-challenge-projection-does-not-establish-independence-assurance-risk-acceptance-architecture-approval-operational-readiness-or-authorize-action",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-architecture-challenge-snapshot-digest") -> {
            value.getAsJsonObject("model").addProperty("responseCount", 6)
        }
        workspacePath.endsWith("bad-architecture-challenge-snapshot-private") -> {
            value.addProperty("challengeContent", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleDecisionRegister(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE DECISION REGISTER PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-decision-register-snapshot-binding")) 8 else 7
    val assessedAt = "2026-07-26T17:00:00.000Z"
    val registerDigest = "sha256:${"d".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "decision-register-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "decision-register-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("register", JsonObject().apply {
                addProperty("recordId", decisionRegisterId.toString())
                addProperty("revision", 2)
                addProperty("digest", registerDigest)
            })
            addProperty("decisionCount", 7)
            addProperty("unresolvedDecisionCount", 2)
            addProperty("selectedPendingDecisionCount", 3)
            addProperty("deferredDecisionCount", 1)
            addProperty("unresolvedRequirementCount", 1)
            addProperty("staleBindingCount", 1)
            addProperty("staleSourceReferenceCount", 0)
            addProperty("inconsistencyCount", 0)
            addProperty("unresolvedQuestionCount", 1)
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("One or more Decision Questions remain unresolved") })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "decision-register-status-reports-candidate-coverage-and-gaps-and-does-not-establish-decision-effectiveness-approval-risk-acceptance-baseline-promotion-readiness-or-action-authority",
            )
        })
        add("register", JsonObject().apply {
            addProperty("id", decisionRegisterId.toString())
            addProperty("revision", 2)
            addProperty("digest", registerDigest)
            addProperty("membershipDigest", "sha256:${"a".repeat(64)}")
            addProperty("state", "candidate")
            addProperty("decisionCount", 7)
            addProperty("updatedAt", "2026-07-26T16:59:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-identities-counts-statuses-and-digests-only-not-decision-questions-options-recommendations-outcomes-rationale-evidence-subject-content-personal-data-secrets-or-credentials",
        )
        addProperty(
            "authorityBoundary",
            "decision-register-projection-does-not-establish-decision-effectiveness-approval-risk-acceptance-baseline-promotion-readiness-or-action-authority",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-decision-register-snapshot-digest") -> {
            value.getAsJsonObject("register").addProperty("decisionCount", 8)
        }
        workspacePath.endsWith("bad-decision-register-snapshot-private") -> {
            value.addProperty("decisionQuestion", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleRiskRegister(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE RISK REGISTER PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-risk-register-snapshot-binding")) 8 else 7
    val assessedAt = "2026-07-26T18:00:00.000Z"
    val registerDigest = "sha256:${"e".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "risk-register-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "risk-register-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("register", JsonObject().apply {
                addProperty("recordId", riskRegisterId.toString())
                addProperty("revision", 3)
                addProperty("digest", registerDigest)
            })
            addProperty("riskCount", 9)
            addProperty("notAssessedRiskCount", 2)
            addProperty("unresolvedResidualRiskCount", 3)
            addProperty("proposedTreatmentCount", 9)
            addProperty("unassignedOwnerCount", 9)
            addProperty("unverifiedControlCount", 4)
            addProperty("unresolvedRequirementCount", 1)
            addProperty("staleBindingCount", 1)
            addProperty("staleSourceReferenceCount", 0)
            addProperty("inconsistencyCount", 0)
            addProperty("unresolvedQuestionCount", 1)
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("One or more Risk Assessments remain explicitly not assessed") })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "risk-register-status-reports-candidate-coverage-and-gaps-and-does-not-establish-assessment-fact-control-effectiveness-risk-acceptance-approval-exception-baseline-promotion-readiness-or-action-authority",
            )
        })
        add("register", JsonObject().apply {
            addProperty("id", riskRegisterId.toString())
            addProperty("revision", 3)
            addProperty("digest", registerDigest)
            addProperty("membershipDigest", "sha256:${"b".repeat(64)}")
            addProperty("state", "candidate")
            addProperty("riskCount", 9)
            addProperty("updatedAt", "2026-07-26T17:59:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-identities-counts-statuses-and-digests-only-not-risk-statements-assessments-controls-treatments-residual-risk-evidence-related-record-content-personal-data-secrets-or-credentials",
        )
        addProperty(
            "authorityBoundary",
            "risk-register-projection-does-not-establish-assessment-fact-control-effectiveness-risk-acceptance-approval-exception-baseline-promotion-readiness-or-action-authority",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-risk-register-snapshot-digest") -> {
            value.getAsJsonObject("register").addProperty("riskCount", 10)
        }
        workspacePath.endsWith("bad-risk-register-snapshot-private") -> {
            value.addProperty("riskStatement", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleEvidenceRegistry(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE EVIDENCE REGISTRY PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-evidence-registry-snapshot-binding")) 8 else 7
    val assessedAt = "2026-07-27T00:00:00.000Z"
    val registryDigest = "sha256:${"f".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "evidence-registry-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "evidence-registry-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("registry", JsonObject().apply {
                addProperty("recordId", evidenceRegistryId.toString())
                addProperty("revision", 4)
                addProperty("digest", registryDigest)
            })
            addProperty("claimCount", 12)
            addProperty("evidenceItemCount", 18)
            addProperty("linkCount", 21)
            addProperty("notAssessedClaimCount", 2)
            addProperty("notAssessedEvidenceCount", 3)
            addProperty("adverseEvidencePendingDispositionCount", 1)
            addProperty("staleOrUnknownEvidenceCount", 4)
            addProperty("invalidatedEvidenceCount", 1)
            addProperty("unresolvedLinkCount", 21)
            addProperty("unresolvedRequirementCount", 2)
            addProperty("staleBindingCount", 1)
            addProperty("staleSourceReferenceCount", 0)
            addProperty("inconsistencyCount", 0)
            addProperty("unresolvedQuestionCount", 1)
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("One or more Claims remain explicitly not assessed") })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "evidence-registry-status-reports-candidate-coverage-freshness-and-gaps-and-does-not-establish-claim-validation-evidence-sufficiency-assurance-approval-readiness-or-action-authority",
            )
        })
        add("registry", JsonObject().apply {
            addProperty("id", evidenceRegistryId.toString())
            addProperty("revision", 4)
            addProperty("digest", registryDigest)
            addProperty("membershipDigest", "sha256:${"d".repeat(64)}")
            addProperty("state", "candidate")
            addProperty("claimCount", 12)
            addProperty("evidenceItemCount", 18)
            addProperty("linkCount", 21)
            addProperty("updatedAt", "2026-07-26T23:59:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-identities-counts-statuses-and-digests-only-not-claim-statements-evidence-observations-methods-warrants-quality-details-source-content-personal-data-secrets-or-credentials",
        )
        addProperty(
            "authorityBoundary",
            "evidence-registry-projection-does-not-establish-claim-validation-evidence-sufficiency-assurance-review-approval-risk-acceptance-readiness-or-action-authority",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-evidence-registry-snapshot-digest") -> {
            value.getAsJsonObject("registry").addProperty("claimCount", 13)
        }
        workspacePath.endsWith("bad-evidence-registry-snapshot-private") -> {
            value.addProperty("claimStatement", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleEndToEndTraceability(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE TRACEABILITY PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-traceability-snapshot-binding")) 8 else 7
    val assessedAt = "2026-07-27T02:30:00.000Z"
    val traceabilityDigest = "sha256:${"a".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "end-to-end-traceability-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "end-to-end-traceability-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("traceability", JsonObject().apply {
                addProperty("recordId", endToEndTraceabilityId.toString())
                addProperty("revision", 3)
                addProperty("digest", traceabilityDigest)
            })
            addProperty("nodeCount", 44)
            addProperty("relationshipCount", 12)
            addProperty("linkCount", 67)
            addProperty("transformationCount", 5)
            addProperty("verifiedLinkCount", 40)
            addProperty("proposedLinkCount", 20)
            addProperty("invalidOrHistoricalLinkCount", 7)
            addProperty("unresolvedEndpointCount", 2)
            addProperty("notAssessedSemanticCount", 6)
            addProperty("missingSpineCount", 1)
            addProperty("unknownRelationshipCount", 3)
            addProperty("unresolvedRequirementCount", 2)
            addProperty("staleBindingCount", 1)
            addProperty("staleSourceReferenceCount", 0)
            addProperty("inconsistencyCount", 1)
            addProperty("unresolvedQuestionCount", 2)
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("One or more Trace Links have unresolved endpoints") })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "coverageBoundary",
                "absence-of-a-trace-link-does-not-prove-absence-of-impact-or-relationship",
            )
            addProperty(
                "authorityBoundary",
                "end-to-end-traceability-status-reports-candidate-coverage-and-gaps-and-does-not-establish-relationship-truth-completeness-approval-readiness-or-action-authority",
            )
        })
        add("traceability", JsonObject().apply {
            addProperty("id", endToEndTraceabilityId.toString())
            addProperty("revision", 3)
            addProperty("digest", traceabilityDigest)
            addProperty("membershipDigest", "sha256:${"b".repeat(64)}")
            addProperty("state", "candidate")
            addProperty("nodeCount", 44)
            addProperty("relationshipCount", 12)
            addProperty("linkCount", 67)
            addProperty("transformationCount", 5)
            addProperty("updatedAt", "2026-07-27T02:29:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-identities-counts-statuses-and-digests-only-not-node-content-link-rationale-transformation-detail-source-content-personal-data-secrets-or-credentials",
        )
        addProperty(
            "authorityBoundary",
            "end-to-end-traceability-projection-does-not-establish-relationship-truth-completeness-approval-baseline-promotion-readiness-or-action-authority",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-traceability-snapshot-digest") -> {
            value.getAsJsonObject("traceability").addProperty("nodeCount", 45)
        }
        workspacePath.endsWith("bad-traceability-snapshot-private") -> {
            value.addProperty("linkRationale", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleP0P4ReadinessGate(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE READINESS GATE PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-readiness-gate-snapshot-binding")) 8 else 7
    val assessedAt = "2026-07-27T03:30:00.000Z"
    val gateDigest = "sha256:${"c".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "p0-p4-readiness-gate-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "p0-p4-readiness-gate-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("gate", JsonObject().apply {
                addProperty("recordId", p0P4ReadinessGateId.toString())
                addProperty("revision", 2)
                addProperty("digest", gateDigest)
            })
            addProperty("outputCount", 25)
            addProperty("applicableOutputCount", 20)
            addProperty("notApplicableOutputCount", 4)
            addProperty("unresolvedApplicabilityCount", 1)
            addProperty("satisfiedOutputCount", 17)
            addProperty("conditionalOutputCount", 1)
            addProperty("incompleteOutputCount", 1)
            addProperty("failedOutputCount", 1)
            addProperty("blockedOutputCount", 0)
            addProperty("staleOrUnknownOutputCount", 1)
            addProperty("pendingOrInvalidWaiverCount", 1)
            addProperty("unresolvedDecisionCount", 2)
            addProperty("unmetConditionCount", 1)
            addProperty("unresolvedRequirementCount", 2)
            addProperty("adverseEvidenceCount", 1)
            addProperty("staleBindingCount", 1)
            addProperty("staleSourceReferenceCount", 0)
            addProperty("inconsistencyCount", 0)
            addProperty("unresolvedQuestionCount", 1)
            addProperty("result", "failed")
            add("reasons", JsonArray().apply { add("The exact Evidence Registry contains adverse evidence") })
            addProperty("assessedAt", assessedAt)
            addProperty("gateBoundary", "a-passing-gate-is-an-evaluation-result-not-permission")
            addProperty(
                "authorityBoundary",
                "p0-p4-readiness-gate-status-is-an-evaluation-result-and-does-not-establish-readiness-approval-waiver-acceptance-phase-entry-implementation-authorization-baseline-promotion-or-action-authority",
            )
        })
        add("gate", JsonObject().apply {
            addProperty("id", p0P4ReadinessGateId.toString())
            addProperty("revision", 2)
            addProperty("digest", gateDigest)
            addProperty("membershipDigest", "sha256:${"d".repeat(64)}")
            addProperty("state", "candidate")
            addProperty("evaluationDefinitionDigest", "sha256:${"e".repeat(64)}")
            addProperty("outputCount", 25)
            addProperty("waiverCount", 1)
            addProperty("unresolvedDecisionCount", 2)
            addProperty("conditionCount", 1)
            addProperty("updatedAt", "2026-07-27T03:29:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-identities-counts-results-and-digests-only-not-output-content-criteria-findings-waiver-rationale-decision-content-evidence-content-source-content-personal-data-secrets-or-credentials",
        )
        addProperty(
            "authorityBoundary",
            "p0-p4-readiness-gate-projection-does-not-establish-readiness-approval-waiver-acceptance-phase-entry-implementation-authorization-baseline-promotion-or-action-authority",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-readiness-gate-snapshot-digest") -> {
            value.getAsJsonObject("gate").addProperty("outputCount", 24)
        }
        workspacePath.endsWith("bad-readiness-gate-snapshot-private") -> {
            value.addProperty("waiverRationale", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleP5HandoffPackage(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE P5 HANDOFF PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-p5-handoff-snapshot-binding")) 8 else 7
    val assessedAt = "2026-07-27T04:00:00.000Z"
    val handoffDigest = "sha256:${"1".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "p5-handoff-package-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "p5-handoff-package-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("handoff", JsonObject().apply {
                addProperty("recordId", p5HandoffPackageId.toString())
                addProperty("revision", 3)
                addProperty("digest", handoffDigest)
            })
            addProperty("itemCount", 25)
            addProperty("includedItemCount", 17)
            addProperty("referenceOnlyItemCount", 3)
            addProperty("omittedNotApplicableItemCount", 4)
            addProperty("unresolvedItemCount", 1)
            addProperty("staleOrUnknownItemCount", 2)
            addProperty("lossyTransformationCount", 1)
            addProperty("unresolvedRequirementCount", 2)
            addProperty("conflictCount", 1)
            addProperty("unresolvedQuestionCount", 2)
            addProperty("staleBindingCount", 1)
            addProperty("staleSourceReferenceCount", 0)
            addProperty("readinessResult", "incomplete")
            addProperty("transferState", "held")
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("The current P0-P4 Readiness Gate evaluation has not passed") })
            addProperty("assessedAt", assessedAt)
            addProperty("handoffBoundary", "handoff-transfers-exact-candidate-context-not-source-ownership-or-authority")
            addProperty("authorityBoundary", "p5-handoff-package-status-does-not-establish-acknowledgement-readiness-approval-design-baseline-p5-entry-transfer-or-action-authority")
        })
        add("handoff", JsonObject().apply {
            addProperty("id", p5HandoffPackageId.toString())
            addProperty("revision", 3)
            addProperty("digest", handoffDigest)
            addProperty("membershipDigest", "sha256:${"2".repeat(64)}")
            addProperty("state", "candidate")
            addProperty("readinessStatusDigest", "sha256:${"3".repeat(64)}")
            addProperty("itemCount", 25)
            addProperty("requirementCount", 66)
            addProperty("deliveryMode", "disconnected")
            addProperty("updatedAt", "2026-07-27T03:59:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty("privacyBoundary", "projection-contains-identities-counts-statuses-and-digests-only-not-item-content-summaries-omissions-uncertainties-source-content-personal-data-secrets-credentials-or-destinations")
        addProperty("authorityBoundary", "p5-handoff-package-projection-does-not-establish-acknowledgement-readiness-approval-design-baseline-p5-entry-transfer-write-or-action-authority")
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-p5-handoff-snapshot-digest") -> {
            value.getAsJsonObject("handoff").addProperty("itemCount", 24)
        }
        workspacePath.endsWith("bad-p5-handoff-snapshot-private") -> {
            value.addProperty("itemContent", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleDesignApplicability(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE DESIGN APPLICABILITY PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-design-applicability-snapshot-binding")) 8 else 7
    val assessedAt = "2026-07-28T04:00:00.000Z"
    val candidateDigest = "sha256:${"4".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "design-applicability-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "design-applicability-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("candidate", JsonObject().apply {
                addProperty("recordId", designApplicabilityId.toString())
                addProperty("revision", 2)
                addProperty("digest", candidateDigest)
            })
            addProperty("scopeCount", 2)
            addProperty("decisionCount", 8)
            addProperty("unresolvedDecisionCount", 1)
            addProperty("blockedDecisionCount", 0)
            addProperty("pendingApprovalCount", 1)
            addProperty("rejectedApprovalCount", 0)
            addProperty("unresolvedDepthCount", 1)
            addProperty("unresolvedSourceCount", 1)
            addProperty("staleBindingCount", 0)
            addProperty("staleSourceReferenceCount", 1)
            addProperty("unresolvedQuestionCount", 2)
            addProperty("reviewState", "held")
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("One or more target scopes remain unresolved") })
            addProperty("assessedAt", assessedAt)
            addProperty("authorityBoundary", "design-applicability-status-is-observational-and-does-not-approve-design-establish-a-baseline-grant-readiness-or-authorize-implementation-or-action")
        })
        add("candidate", JsonObject().apply {
            addProperty("id", designApplicabilityId.toString())
            addProperty("revision", 2)
            addProperty("digest", candidateDigest)
            addProperty("membershipDigest", "sha256:${"5".repeat(64)}")
            addProperty("state", "candidate")
            addProperty("scopeCount", 2)
            addProperty("reviewState", "held")
            addProperty("updatedAt", "2026-07-28T03:59:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty("privacyBoundary", "projection-contains-identities-counts-statuses-and-digests-only-not-rationales-source-content-journeys-design-content-personal-data-secrets-or-credentials")
        addProperty("authorityBoundary", "design-applicability-projection-is-read-only-and-does-not-approve-design-establish-a-baseline-grant-readiness-or-authorize-write-implementation-or-action")
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-design-applicability-snapshot-digest") -> {
            value.getAsJsonObject("candidate").addProperty("scopeCount", 3)
        }
        workspacePath.endsWith("bad-design-applicability-snapshot-private") -> {
            value.addProperty("rationale", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleDesignPersonaRoleModel(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE DESIGN PERSONA ROLE PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-design-persona-role-snapshot-binding")) 8 else 7
    val assessedAt = "2026-07-28T08:30:00.000Z"
    val candidateDigest = "sha256:${"6".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "design-persona-role-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "design-persona-role-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("candidate", JsonObject().apply {
                addProperty("recordId", designPersonaRoleId.toString())
                addProperty("revision", 2)
                addProperty("digest", candidateDigest)
            })
            addProperty("personaCount", 2)
            addProperty("designRoleCount", 1)
            addProperty("representedParticipantCategoryCount", 4)
            addProperty("unresolvedParticipantCategoryCount", 1)
            addProperty("representedRoleKindCount", 1)
            addProperty("unresolvedRoleKindCount", 1)
            addProperty("weakEvidencePersonaCount", 1)
            addProperty("humanReviewedPersonaCount", 1)
            addProperty("staleBindingCount", 0)
            addProperty("staleSourceReferenceCount", 1)
            addProperty("unresolvedQuestionCount", 2)
            addProperty("reviewState", "held")
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("One or more design participant categories remain unresolved") })
            addProperty("assessedAt", assessedAt)
            addProperty("authorityBoundary", "design-persona-role-status-is-observational-and-does-not-validate-personas-appoint-roles-verify-competence-approve-design-grant-readiness-or-authorize-action")
        })
        add("candidate", JsonObject().apply {
            addProperty("id", designPersonaRoleId.toString())
            addProperty("revision", 2)
            addProperty("digest", candidateDigest)
            addProperty("membershipDigest", "sha256:${"7".repeat(64)}")
            addProperty("state", "candidate")
            addProperty("personaCount", 2)
            addProperty("designRoleCount", 1)
            addProperty("reviewState", "held")
            addProperty("updatedAt", "2026-07-28T08:29:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty("privacyBoundary", "projection-contains-record-identities-counts-statuses-and-digests-only-not-persona-content-behaviors-constraints-source-content-personal-data-secrets-or-credentials")
        addProperty("authorityBoundary", "design-persona-role-projection-is-read-only-and-does-not-validate-personas-appoint-roles-verify-competence-approve-design-grant-readiness-or-authorize-write-or-action")
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-design-persona-role-snapshot-digest") -> {
            value.getAsJsonObject("candidate").addProperty("personaCount", 3)
        }
        workspacePath.endsWith("bad-design-persona-role-snapshot-private") -> {
            value.addProperty("personaBehavior", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleUserJourneyModel(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE USER JOURNEY PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-user-journey-snapshot-binding")) 8 else 7
    val assessedAt = "2026-07-28T09:30:00.000Z"
    val candidateDigest = "sha256:${"8".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "user-journey-model-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "user-journey-model-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("candidate", JsonObject().apply {
                addProperty("recordId", userJourneyId.toString())
                addProperty("revision", 2)
                addProperty("digest", candidateDigest)
            })
            addProperty("journeyCount", 2)
            addProperty("touchpointCount", 3)
            addProperty("primaryPathCount", 2)
            addProperty("successPathCount", 2)
            addProperty("failurePathCount", 2)
            addProperty("recoveryPathCount", 2)
            addProperty("representedScopeCount", 1)
            addProperty("unresolvedScopeCount", 1)
            addProperty("weakEvidencePathCount", 2)
            addProperty("staleBindingCount", 0)
            addProperty("staleSourceReferenceCount", 1)
            addProperty("unresolvedQuestionCount", 2)
            addProperty("reviewState", "held")
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("One or more Design Applicability scopes have unresolved User Journey coverage") })
            addProperty("assessedAt", assessedAt)
            addProperty("authorityBoundary", "user-journey-model-status-is-observational-and-does-not-prove-observed-behavior-validate-journeys-approve-design-grant-readiness-or-authorize-action")
        })
        add("candidate", JsonObject().apply {
            addProperty("id", userJourneyId.toString())
            addProperty("revision", 2)
            addProperty("digest", candidateDigest)
            addProperty("membershipDigest", "sha256:${"9".repeat(64)}")
            addProperty("state", "candidate")
            addProperty("journeyCount", 2)
            addProperty("touchpointCount", 3)
            addProperty("reviewState", "held")
            addProperty("updatedAt", "2026-07-28T09:29:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty("privacyBoundary", "projection-contains-record-identities-counts-statuses-and-digests-only-not-journey-step-touchpoint-persona-source-or-personal-content-secrets-or-credentials")
        addProperty("authorityBoundary", "user-journey-model-projection-is-read-only-and-does-not-prove-observed-behavior-validate-journeys-approve-design-grant-readiness-or-authorize-write-or-action")
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-user-journey-snapshot-digest") -> {
            value.getAsJsonObject("candidate").addProperty("journeyCount", 3)
        }
        workspacePath.endsWith("bad-user-journey-snapshot-private") -> {
            value.addProperty("journeyStep", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleInformationArchitectureModel(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE INFORMATION ARCHITECTURE PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-information-architecture-snapshot-binding")) 8 else 7
    val assessedAt = "2026-07-28T10:30:00.000Z"
    val candidateDigest = "sha256:${"a".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "information-architecture-model-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "information-architecture-model-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("candidate", JsonObject().apply {
                addProperty("recordId", informationArchitectureId.toString())
                addProperty("revision", 2)
                addProperty("digest", candidateDigest)
            })
            addProperty("nodeCount", 6)
            addProperty("rootNodeCount", 2)
            addProperty("routeCount", 8)
            addProperty("representedScopeCount", 1)
            addProperty("unresolvedScopeCount", 1)
            addProperty("weakEvidenceNodeCount", 2)
            addProperty("weakEvidenceRouteCount", 1)
            addProperty("staleBindingCount", 0)
            addProperty("staleSourceReferenceCount", 1)
            addProperty("unresolvedQuestionCount", 2)
            addProperty("reviewState", "held")
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply {
                add("One or more Design Applicability scopes have unresolved Information Architecture coverage")
            })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "information-architecture-status-is-observational-and-does-not-prove-findability-comprehension-or-accessibility-validate-content-approve-design-grant-readiness-or-authorize-action",
            )
        })
        add("candidate", JsonObject().apply {
            addProperty("id", informationArchitectureId.toString())
            addProperty("revision", 2)
            addProperty("digest", candidateDigest)
            addProperty("membershipDigest", "sha256:${"b".repeat(64)}")
            addProperty("state", "candidate")
            addProperty("nodeCount", 6)
            addProperty("rootNodeCount", 2)
            addProperty("routeCount", 8)
            addProperty("reviewState", "held")
            addProperty("updatedAt", "2026-07-28T10:29:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-record-identities-counts-statuses-and-digests-only-not-node-route-content-persona-source-or-personal-content-secrets-or-credentials",
        )
        addProperty(
            "authorityBoundary",
            "information-architecture-projection-is-read-only-and-does-not-prove-findability-comprehension-or-accessibility-validate-content-approve-design-grant-readiness-or-authorize-write-or-action",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-information-architecture-snapshot-digest") -> {
            value.getAsJsonObject("candidate").addProperty("nodeCount", 7)
        }
        workspacePath.endsWith("bad-information-architecture-snapshot-private") -> {
            value.addProperty("nodeLabel", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleScreenStateInventory(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE SCREEN STATE INVENTORY PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-screen-state-inventory-snapshot-binding")) 8 else 7
    val assessedAt = "2026-07-28T11:30:00.000Z"
    val candidateDigest = "sha256:${"c".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "screen-state-inventory-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "screen-state-inventory-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("candidate", JsonObject().apply {
                addProperty("recordId", screenStateInventoryId.toString())
                addProperty("revision", 2)
                addProperty("digest", candidateDigest)
            })
            addProperty("platformCount", 3)
            addProperty("targetedPlatformCount", 2)
            addProperty("unresolvedPlatformCount", 1)
            addProperty("screenCount", 9)
            addProperty("stateCount", 18)
            addProperty("variantCount", 5)
            addProperty("representedRouteCount", 7)
            addProperty("unresolvedRouteCount", 1)
            addProperty("representedScopeCount", 1)
            addProperty("unresolvedScopeCount", 1)
            addProperty("weakEvidenceItemCount", 2)
            addProperty("staleBindingCount", 0)
            addProperty("staleSourceReferenceCount", 1)
            addProperty("unresolvedQuestionCount", 2)
            addProperty("reviewState", "held")
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply {
                add("One or more Information Architecture routes have unresolved Screen and State Inventory coverage")
            })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "screen-state-inventory-status-is-observational-and-does-not-prove-ui-completeness-platform-parity-state-reachability-interaction-quality-or-accessibility-approve-design-grant-readiness-or-authorize-action",
            )
        })
        add("candidate", JsonObject().apply {
            addProperty("id", screenStateInventoryId.toString())
            addProperty("revision", 2)
            addProperty("digest", candidateDigest)
            addProperty("membershipDigest", "sha256:${"d".repeat(64)}")
            addProperty("state", "candidate")
            addProperty("platformCount", 3)
            addProperty("screenCount", 9)
            addProperty("stateCount", 18)
            addProperty("variantCount", 5)
            addProperty("reviewState", "held")
            addProperty("updatedAt", "2026-07-28T11:29:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-record-identities-counts-statuses-and-digests-only-not-screen-state-variant-platform-content-persona-source-or-personal-content-secrets-or-credentials",
        )
        addProperty(
            "authorityBoundary",
            "screen-state-inventory-projection-is-read-only-and-does-not-prove-ui-completeness-platform-parity-state-reachability-interaction-quality-or-accessibility-approve-design-grant-readiness-or-authorize-write-or-action",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-screen-state-inventory-snapshot-digest") -> {
            value.getAsJsonObject("candidate").addProperty("screenCount", 10)
        }
        workspacePath.endsWith("bad-screen-state-inventory-snapshot-private") -> {
            value.addProperty("screenLabel", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleDesignRequirements(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE DESIGN REQUIREMENTS PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-design-requirements-snapshot-binding")) 8 else 7
    val assessedAt = "2026-07-28T12:30:00.000Z"
    val candidateDigest = "sha256:${"e".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "design-requirements-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "design-requirements-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("candidate", JsonObject().apply {
                addProperty("recordId", designRequirementsId.toString())
                addProperty("revision", 2)
                addProperty("digest", candidateDigest)
            })
            addProperty("requirementCount", 12)
            addProperty("mustPriorityCount", 5)
            addProperty("representedOutcomeCount", 4)
            addProperty("unresolvedOutcomeCount", 1)
            addProperty("linkedBacklogRequirementCount", 8)
            addProperty("notPlannedRequirementCount", 2)
            addProperty("unresolvedBacklogRequirementCount", 2)
            addProperty("workItemCount", 10)
            addProperty("weakEvidenceRequirementCount", 3)
            addProperty("staleBindingCount", 0)
            addProperty("staleDomainReferenceCount", 1)
            addProperty("staleSourceReferenceCount", 1)
            addProperty("unresolvedQuestionCount", 2)
            addProperty("catalogCompletenessState", "not-assessed")
            addProperty("reviewState", "held")
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply {
                add("One or more Design Requirements retain unresolved outcome or backlog coverage")
            })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "design-requirements-status-is-observational-and-does-not-establish-requirement-validity-completeness-priority-approval-satisfaction-backlog-commitment-design-approval-readiness-implementation-or-action-authority",
            )
        })
        add("candidate", JsonObject().apply {
            addProperty("id", designRequirementsId.toString())
            addProperty("revision", 2)
            addProperty("digest", candidateDigest)
            addProperty("membershipDigest", "sha256:${"f".repeat(64)}")
            addProperty("state", "candidate")
            addProperty("requirementCount", 12)
            addProperty("representedOutcomeCount", 4)
            addProperty("workItemCount", 10)
            addProperty("reviewState", "held")
            addProperty("updatedAt", "2026-07-28T12:29:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-record-identities-counts-statuses-and-digests-only-not-requirement-outcome-work-item-design-target-source-or-personal-content-secrets-or-credentials",
        )
        addProperty(
            "authorityBoundary",
            "design-requirements-projection-is-read-only-and-does-not-establish-requirement-validity-completeness-priority-approval-satisfaction-backlog-commitment-design-approval-readiness-implementation-or-write-or-action-authority",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-design-requirements-snapshot-digest") -> {
            value.getAsJsonObject("candidate").addProperty("requirementCount", 13)
        }
        workspacePath.endsWith("bad-design-requirements-snapshot-private") -> {
            value.addProperty("requirementStatement", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleBacklogHierarchy(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE BACKLOG HIERARCHY PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-backlog-hierarchy-snapshot-binding")) 8 else 7
    val assessedAt = "2026-07-30T09:20:00.000Z"
    val candidateDigest = "sha256:${"8".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "backlog-hierarchy-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "backlog-hierarchy-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("candidate", JsonObject().apply {
                addProperty("recordId", backlogHierarchyId.toString())
                addProperty("revision", 2)
                addProperty("digest", candidateDigest)
            })
            addProperty("nodeCount", 24)
            addProperty("epicCount", 2)
            addProperty("featureCount", 5)
            addProperty("storyCount", 8)
            addProperty("taskCount", 9)
            addProperty("rootCount", 2)
            addProperty("leafCount", 12)
            addProperty("requirementTraceCount", 17)
            addProperty("untracedStoryTaskCount", 1)
            addProperty("staleBindingCount", 0)
            addProperty("staleWorkItemCount", 1)
            addProperty("staleChangeCount", 0)
            addProperty("staleRequirementCount", 2)
            addProperty("unresolvedQuestionCount", 3)
            addProperty("hierarchyCompletenessState", "not-assessed")
            addProperty("reviewState", "held")
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("One or more Backlog Hierarchy bindings require review") })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "backlog-hierarchy-status-is-observational-and-does-not-establish-priority-commitment-ownership-ready-done-implementation-readiness-assignment-execution-or-action-authority",
            )
        })
        add("candidate", JsonObject().apply {
            addProperty("id", backlogHierarchyId.toString())
            addProperty("revision", 2)
            addProperty("digest", candidateDigest)
            addProperty("membershipDigest", "sha256:${"9".repeat(64)}")
            addProperty("state", "candidate")
            addProperty("nodeCount", 24)
            addProperty("epicCount", 2)
            addProperty("featureCount", 5)
            addProperty("storyCount", 8)
            addProperty("taskCount", 9)
            addProperty("requirementTraceCount", 17)
            addProperty("reviewState", "held")
            addProperty("updatedAt", "2026-07-30T09:19:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-record-identities-level-counts-statuses-and-digests-only-not-backlog-objectives-criteria-scope-owner-requirement-content-personal-data-secrets-credentials-or-machine-paths",
        )
        addProperty(
            "authorityBoundary",
            "backlog-hierarchy-projection-is-read-only-and-does-not-prioritize-commit-assign-admit-execute-or-authorize-implementation-or-action",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-backlog-hierarchy-snapshot-digest") -> {
            value.getAsJsonObject("candidate").addProperty("taskCount", 10)
        }
        workspacePath.endsWith("bad-backlog-hierarchy-snapshot-private") -> {
            value.addProperty("workItemObjective", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleMvpSliceDefinition(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE MVP SLICE PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-mvp-slice-snapshot-binding")) 8 else 7
    val assessedAt = "2026-07-30T10:20:00.000Z"
    val candidateDigest = "sha256:${"a".repeat(64)}"
    val hierarchyDigest = if (workspacePath.endsWith("bad-mvp-slice-hierarchy-binding")) {
        "sha256:${"c".repeat(64)}"
    } else {
        "sha256:${"8".repeat(64)}"
    }
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "mvp-slice-definition-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "mvp-slice-definition-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("candidate", JsonObject().apply {
                addProperty("recordId", mvpSliceDefinitionId.toString())
                addProperty("revision", 2)
                addProperty("digest", candidateDigest)
            })
            add("hierarchy", JsonObject().apply {
                addProperty("recordId", backlogHierarchyId.toString())
                addProperty("revision", 2)
                addProperty("digest", hierarchyDigest)
            })
            addProperty("scopeNodeCount", 24)
            addProperty("mvpNodeCount", 16)
            addProperty("laterNodeCount", 5)
            addProperty("excludedNodeCount", 3)
            addProperty("sliceCount", 4)
            addProperty("storyCount", 7)
            addProperty("taskCount", 9)
            addProperty("dependencyCount", 3)
            addProperty("unassignedMvpStoryTaskCount", 1)
            addProperty("staleBindingCount", 0)
            addProperty("staleHierarchyCount", 0)
            addProperty("invalidScopeCount", 0)
            addProperty("invalidSliceCount", 1)
            addProperty("unresolvedQuestionCount", 2)
            addProperty("scopeCompletenessState", "not-assessed")
            addProperty("reviewState", "held")
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("One or more MVP scope or Vertical Slice candidates require review") })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "mvp-slice-definition-status-is-observational-and-does-not-establish-priority-commitment-scope-approval-acceptance-criteria-validity-ready-done-implementation-readiness-assignment-execution-or-action-authority",
            )
        })
        add("candidate", JsonObject().apply {
            addProperty("id", mvpSliceDefinitionId.toString())
            addProperty("revision", 2)
            addProperty("digest", candidateDigest)
            addProperty("membershipDigest", "sha256:${"b".repeat(64)}")
            addProperty("hierarchyDigest", hierarchyDigest)
            addProperty("state", "candidate")
            addProperty("scopeNodeCount", 24)
            addProperty("mvpNodeCount", 16)
            addProperty("laterNodeCount", 5)
            addProperty("excludedNodeCount", 3)
            addProperty("sliceCount", 4)
            addProperty("storyCount", 7)
            addProperty("taskCount", 9)
            addProperty("reviewState", "held")
            addProperty("updatedAt", "2026-07-30T10:19:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-record-identities-scope-and-slice-counts-statuses-and-digests-only-not-slice-titles-rationales-objectives-criteria-scope-content-requirement-content-personal-data-secrets-credentials-or-machine-paths",
        )
        addProperty(
            "authorityBoundary",
            "mvp-slice-definition-projection-is-read-only-and-does-not-prioritize-commit-approve-scope-admit-assign-execute-or-authorize-implementation-or-action",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-mvp-slice-snapshot-digest") -> {
            value.getAsJsonObject("candidate").addProperty("taskCount", 10)
        }
        workspacePath.endsWith("bad-mvp-slice-snapshot-private") -> {
            value.addProperty("sliceRationale", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleDesignSystemTokenContract(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE DESIGN SYSTEM TOKEN CONTRACT PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-design-system-token-contract-snapshot-binding")) 8 else 7
    val assessedAt = "2026-07-28T13:30:00.000Z"
    val candidateDigest = "sha256:${"1".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "design-system-token-contract-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "design-system-token-contract-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("candidate", JsonObject().apply {
                addProperty("recordId", designSystemTokenContractId.toString())
                addProperty("revision", 2)
                addProperty("digest", candidateDigest)
            })
            addProperty("designSystemCount", 2)
            addProperty("tokenCount", 48)
            addProperty("variableCollectionCount", 3)
            addProperty("variableCount", 19)
            addProperty("componentCount", 12)
            addProperty("representedRequirementCount", 10)
            addProperty("unresolvedRequirementCount", 2)
            addProperty("unresolvedOwnershipCount", 1)
            addProperty("unresolvedCatalogItemCount", 3)
            addProperty("accessibilityReviewGapCount", 4)
            addProperty("staleBindingCount", 0)
            addProperty("stalePortableSnapshotCount", 1)
            addProperty("staleSourceReferenceCount", 2)
            addProperty("unresolvedQuestionCount", 2)
            addProperty("catalogCompletenessState", "not-assessed")
            addProperty("reviewState", "held")
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply {
                add("One or more Design Systems, Tokens, Variables, or Components remain unresolved")
            })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "design-system-token-contract-status-is-observational-and-does-not-establish-design-system-token-variable-or-component-validity-ownership-authority-accessibility-design-approval-baseline-readiness-implementation-or-action-authority",
            )
        })
        add("candidate", JsonObject().apply {
            addProperty("id", designSystemTokenContractId.toString())
            addProperty("revision", 2)
            addProperty("digest", candidateDigest)
            addProperty("membershipDigest", "sha256:${"2".repeat(64)}")
            addProperty("state", "candidate")
            addProperty("designSystemCount", 2)
            addProperty("tokenCount", 48)
            addProperty("variableCollectionCount", 3)
            addProperty("variableCount", 19)
            addProperty("componentCount", 12)
            addProperty("representedRequirementCount", 10)
            addProperty("reviewState", "held")
            addProperty("updatedAt", "2026-07-28T13:29:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-record-identities-counts-statuses-and-digests-only-not-token-values-component-content-requirement-source-design-or-personal-content-secrets-or-credentials",
        )
        addProperty(
            "authorityBoundary",
            "design-system-token-contract-projection-is-read-only-and-does-not-establish-design-system-token-variable-or-component-validity-ownership-authority-accessibility-design-approval-baseline-readiness-implementation-write-or-action-authority",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-design-system-token-contract-snapshot-digest") -> {
            value.getAsJsonObject("candidate").addProperty("tokenCount", 49)
        }
        workspacePath.endsWith("bad-design-system-token-contract-snapshot-private") -> {
            value.addProperty("tokenValue", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleAccessibilityDesignRules(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE ACCESSIBILITY DESIGN RULES PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-accessibility-design-rules-snapshot-binding")) 8 else 7
    val assessedAt = "2026-07-28T14:30:00.000Z"
    val candidateDigest = "sha256:${"3".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "accessibility-design-rules-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "accessibility-design-rules-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("candidate", JsonObject().apply {
                addProperty("recordId", accessibilityDesignRulesId.toString())
                addProperty("revision", 2)
                addProperty("digest", candidateDigest)
            })
            addProperty("targetCount", 12)
            addProperty("ruleCount", 18)
            addProperty("checkCount", 24)
            addProperty("applicableRuleCount", 14)
            addProperty("notApplicableRuleCount", 2)
            addProperty("unresolvedRuleCount", 2)
            addProperty("notAssessedCheckCount", 4)
            addProperty("evidenceRecordedCheckCount", 3)
            addProperty("humanReviewedCheckCount", 17)
            addProperty("contradictedCheckCount", 1)
            addProperty("representedRequirementCount", 10)
            addProperty("unresolvedRequirementCount", 2)
            addProperty("unresolvedOwnershipCount", 1)
            addProperty("staleBindingCount", 0)
            addProperty("staleSourceReferenceCount", 2)
            addProperty("unresolvedQuestionCount", 3)
            addProperty("catalogCompletenessState", "not-assessed")
            addProperty("reviewState", "held")
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply {
                add("One or more accessibility rules retain unresolved applicability or impact")
            })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "accessibility-design-rules-status-is-observational-and-does-not-establish-accessibility-conformance-rule-or-check-validity-legal-compliance-ownership-design-approval-baseline-readiness-implementation-or-action-authority",
            )
        })
        add("candidate", JsonObject().apply {
            addProperty("id", accessibilityDesignRulesId.toString())
            addProperty("revision", 2)
            addProperty("digest", candidateDigest)
            addProperty("membershipDigest", "sha256:${"4".repeat(64)}")
            addProperty("state", "candidate")
            addProperty("targetCount", 12)
            addProperty("ruleCount", 18)
            addProperty("checkCount", 24)
            addProperty("representedRequirementCount", 10)
            addProperty("reviewState", "held")
            addProperty("updatedAt", "2026-07-28T14:29:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-record-identities-counts-statuses-and-digests-only-not-rule-procedures-evidence-requirement-source-design-or-personal-content-secrets-or-credentials",
        )
        addProperty(
            "authorityBoundary",
            "accessibility-design-rules-projection-is-read-only-and-does-not-establish-accessibility-conformance-rule-or-check-validity-legal-compliance-ownership-design-approval-baseline-readiness-implementation-write-or-action-authority",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-accessibility-design-rules-snapshot-digest") -> {
            value.getAsJsonObject("candidate").addProperty("ruleCount", 19)
        }
        workspacePath.endsWith("bad-accessibility-design-rules-snapshot-private") -> {
            value.addProperty("ruleProcedure", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleResponsiveMultiPlatformTargets(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE RESPONSIVE MULTI PLATFORM TARGETS PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-responsive-multi-platform-targets-snapshot-binding")) 8 else 7
    val assessedAt = "2026-07-28T15:30:00.000Z"
    val candidateDigest = "sha256:${"5".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "responsive-multi-platform-targets-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "responsive-multi-platform-targets-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("candidate", JsonObject().apply {
                addProperty("recordId", responsiveMultiPlatformTargetsId.toString())
                addProperty("revision", 2)
                addProperty("digest", candidateDigest)
            })
            addProperty("platformTargetCount", 3)
            addProperty("breakpointCount", 5)
            addProperty("behaviorCount", 14)
            addProperty("checkCount", 22)
            addProperty("applicableBehaviorCount", 12)
            addProperty("unresolvedBehaviorCount", 2)
            addProperty("notAssessedCheckCount", 3)
            addProperty("evidenceRecordedCheckCount", 2)
            addProperty("humanReviewedCheckCount", 17)
            addProperty("contradictedCheckCount", 1)
            addProperty("representedRequirementCount", 10)
            addProperty("unresolvedRequirementCount", 2)
            addProperty("unresolvedOwnershipCount", 1)
            addProperty("staleBindingCount", 0)
            addProperty("staleSourceReferenceCount", 2)
            addProperty("unresolvedQuestionCount", 3)
            addProperty("targetCatalogState", "candidate-complete")
            addProperty("breakpointCatalogState", "not-assessed")
            addProperty("behaviorCatalogState", "not-assessed")
            addProperty("reviewState", "held")
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply {
                add("Responsive behavior and breakpoint catalogs retain unresolved review gaps")
            })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "responsive-multi-platform-targets-status-is-observational-and-does-not-establish-responsive-completeness-platform-parity-breakpoint-or-behavior-validity-accessibility-conformance-ownership-design-approval-baseline-readiness-implementation-or-action-authority",
            )
        })
        add("candidate", JsonObject().apply {
            addProperty("id", responsiveMultiPlatformTargetsId.toString())
            addProperty("revision", 2)
            addProperty("digest", candidateDigest)
            addProperty("membershipDigest", "sha256:${"6".repeat(64)}")
            addProperty("state", "candidate")
            addProperty("platformTargetCount", 3)
            addProperty("breakpointCount", 5)
            addProperty("behaviorCount", 14)
            addProperty("checkCount", 22)
            addProperty("representedRequirementCount", 10)
            addProperty("reviewState", "held")
            addProperty("updatedAt", "2026-07-28T15:29:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-record-identities-counts-statuses-and-digests-only-not-breakpoint-rules-behavior-procedures-evidence-requirement-source-design-or-personal-content-secrets-or-credentials",
        )
        addProperty(
            "authorityBoundary",
            "responsive-multi-platform-targets-projection-is-read-only-and-does-not-establish-responsive-completeness-platform-parity-breakpoint-or-behavior-validity-accessibility-conformance-ownership-design-approval-baseline-readiness-implementation-write-or-action-authority",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-responsive-multi-platform-targets-snapshot-digest") -> {
            value.getAsJsonObject("candidate").addProperty("behaviorCount", 15)
        }
        workspacePath.endsWith("bad-responsive-multi-platform-targets-snapshot-private") -> {
            value.addProperty("behaviorProcedure", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleManualFigmaExecutionPath(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE MANUAL FIGMA EXECUTION PATH PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-manual-figma-execution-path-snapshot-binding")) 8 else 7
    val assessedAt = "2026-07-28T18:30:00.000Z"
    val candidateDigest = "sha256:${"7".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "manual-figma-execution-path-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "manual-figma-execution-path-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("candidate", JsonObject().apply {
                addProperty("recordId", manualFigmaExecutionPathId.toString())
                addProperty("revision", 2)
                addProperty("digest", candidateDigest)
            })
            addProperty("scopeCount", 3)
            addProperty("instructionCount", 5)
            addProperty("checkCount", 24)
            addProperty("notAssessedCheckCount", 3)
            addProperty("evidenceRecordedCheckCount", 2)
            addProperty("humanReviewedCheckCount", 19)
            addProperty("contradictedCheckCount", 1)
            addProperty("representedRequirementCount", 10)
            addProperty("unresolvedRequirementCount", 2)
            addProperty("unresolvedOwnershipCount", 1)
            addProperty("staleBindingCount", 0)
            addProperty("staleSourceReferenceCount", 2)
            addProperty("unresolvedQuestionCount", 3)
            addProperty("guideCatalogState", "candidate-complete")
            addProperty("handoffCatalogState", "candidate-complete")
            addProperty("returnContractState", "not-assessed")
            addProperty("reviewState", "held")
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("The manual return contract retains unresolved review gaps") })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "manual-figma-execution-path-status-is-observational-and-does-not-connect-to-figma-prove-execution-or-return-completeness-grant-write-authority-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
            )
        })
        add("candidate", JsonObject().apply {
            addProperty("id", manualFigmaExecutionPathId.toString())
            addProperty("revision", 2)
            addProperty("digest", candidateDigest)
            addProperty("membershipDigest", "sha256:${"8".repeat(64)}")
            addProperty("state", "candidate")
            addProperty("scopeCount", 3)
            addProperty("instructionCount", 5)
            addProperty("checkCount", 24)
            addProperty("representedRequirementCount", 10)
            addProperty("reviewState", "held")
            addProperty("updatedAt", "2026-07-28T18:29:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-record-identities-counts-statuses-and-digests-only-not-handoff-content-instructions-figma-identifiers-returned-design-source-or-personal-content-secrets-or-credentials",
        )
        addProperty(
            "authorityBoundary",
            "manual-figma-execution-path-projection-is-read-only-and-does-not-connect-to-figma-prove-execution-or-return-completeness-grant-write-authority-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-manual-figma-execution-path-snapshot-digest") -> {
            value.getAsJsonObject("candidate").addProperty("scopeCount", 4)
        }
        workspacePath.endsWith("bad-manual-figma-execution-path-snapshot-private") -> {
            value.addProperty("handoffContent", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleFigmaMcpCapabilityDiscovery(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE FIGMA MCP CAPABILITY DISCOVERY PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-figma-mcp-capability-discovery-snapshot-binding")) 8 else 7
    val assessedAt = "2026-07-28T19:30:00.000Z"
    val candidateDigest = "sha256:${"9".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "figma-mcp-capability-discovery-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "figma-mcp-capability-discovery-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("candidate", JsonObject().apply {
                addProperty("recordId", figmaMcpCapabilityDiscoveryId.toString())
                addProperty("revision", 2)
                addProperty("digest", candidateDigest)
            })
            addProperty("toolCount", 7)
            addProperty("advertisedToolCount", 5)
            addProperty("unavailableToolCount", 1)
            addProperty("unknownAvailabilityCount", 1)
            addProperty("readToolCount", 3)
            addProperty("writeToolCount", 2)
            addProperty("unknownEffectCount", 1)
            addProperty("notAssessedToolCount", 1)
            addProperty("sourceRecordedToolCount", 2)
            addProperty("humanReviewedToolCount", 4)
            addProperty("unresolvedPermissionCount", 2)
            addProperty("unresolvedLimitCount", 1)
            addProperty("unresolvedVersionCount", 3)
            addProperty("unresolvedOwnershipCount", 1)
            addProperty("staleBindingCount", 0)
            addProperty("staleSourceReferenceCount", 2)
            addProperty("unresolvedQuestionCount", 3)
            addProperty("catalogState", "candidate-observation-complete")
            addProperty("permissionModelState", "candidate-separated")
            addProperty("limitCatalogState", "not-assessed")
            addProperty("versionCatalogState", "not-assessed")
            addProperty("reviewState", "held")
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("One or more source-recorded candidate observations require human review") })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "figma-mcp-capability-discovery-status-is-observational-and-does-not-connect-to-or-call-figma-request-credentials-grant-permissions-establish-tool-availability-or-compatibility-authorize-write-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
            )
        })
        add("candidate", JsonObject().apply {
            addProperty("id", figmaMcpCapabilityDiscoveryId.toString())
            addProperty("revision", 2)
            addProperty("digest", candidateDigest)
            addProperty("membershipDigest", "sha256:${"a".repeat(64)}")
            addProperty("state", "candidate")
            addProperty("toolCount", 7)
            addProperty("advertisedToolCount", 5)
            addProperty("readToolCount", 3)
            addProperty("writeToolCount", 2)
            addProperty("reviewState", "held")
            addProperty("updatedAt", "2026-07-28T19:29:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-record-identities-counts-statuses-and-digests-only-not-tool-names-schemas-permissions-limits-versions-source-content-personal-content-secrets-credentials-or-figma-content",
        )
        addProperty(
            "authorityBoundary",
            "figma-mcp-capability-discovery-projection-is-read-only-and-does-not-connect-to-or-call-figma-request-credentials-grant-permissions-establish-tool-availability-or-compatibility-authorize-write-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-figma-mcp-capability-discovery-snapshot-digest") -> {
            value.getAsJsonObject("candidate").addProperty("toolCount", 8)
        }
        workspacePath.endsWith("bad-figma-mcp-capability-discovery-snapshot-private") -> {
            value.addProperty("toolNames", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleFigmaReadSnapshot(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE FIGMA READ SNAPSHOT PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-figma-read-snapshot-binding")) 8 else 7
    val assessedAt = "2026-07-28T20:30:00.000Z"
    val candidateDigest = "sha256:${"b".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "figma-read-snapshot-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "figma-read-snapshot-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("candidate", JsonObject().apply {
                addProperty("recordId", figmaReadSnapshotId.toString())
                addProperty("revision", 2)
                addProperty("digest", candidateDigest)
            })
            addProperty("fileCount", 2)
            addProperty("componentCount", 12)
            addProperty("variableCollectionCount", 3)
            addProperty("variableCount", 18)
            addProperty("sourceRecordedItemCount", 5)
            addProperty("humanReviewedItemCount", 25)
            addProperty("notAssessedItemCount", 5)
            addProperty("staleFileCount", 1)
            addProperty("unknownFreshnessFileCount", 1)
            addProperty("unresolvedTypeCount", 2)
            addProperty("unresolvedOwnershipCount", 1)
            addProperty("staleBindingCount", 0)
            addProperty("staleSourceReferenceCount", 2)
            addProperty("unresolvedQuestionCount", 3)
            addProperty("snapshotCompletenessState", "partial")
            addProperty("provenanceState", "partial")
            addProperty("reviewState", "held")
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("One or more source-recorded snapshot observations require human review") })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "figma-read-snapshot-status-is-observational-and-does-not-connect-to-or-call-figma-request-credentials-grant-permissions-prove-external-completeness-authorize-write-validate-or-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
            )
        })
        add("candidate", JsonObject().apply {
            addProperty("id", figmaReadSnapshotId.toString())
            addProperty("revision", 2)
            addProperty("digest", candidateDigest)
            addProperty("membershipDigest", "sha256:${"c".repeat(64)}")
            addProperty("state", "candidate")
            addProperty("fileCount", 2)
            addProperty("componentCount", 12)
            addProperty("variableCollectionCount", 3)
            addProperty("variableCount", 18)
            addProperty("reviewState", "held")
            addProperty("updatedAt", "2026-07-28T20:29:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-record-identities-counts-statuses-and-digests-only-not-figma-file-component-variable-names-external-identities-values-source-content-personal-content-secrets-credentials-or-permissions",
        )
        addProperty(
            "authorityBoundary",
            "figma-read-snapshot-projection-is-read-only-and-does-not-connect-to-or-call-figma-request-credentials-grant-permissions-prove-external-completeness-authorize-write-validate-or-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-figma-read-snapshot-digest") -> {
            value.getAsJsonObject("candidate").addProperty("fileCount", 3)
        }
        workspacePath.endsWith("bad-figma-read-snapshot-private") -> {
            value.addProperty("fileNames", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleFigmaContextImport(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE FIGMA CONTEXT IMPORT PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-figma-context-import-binding")) 8 else 7
    val assessedAt = "2026-07-29T09:30:00.000Z"
    val candidateDigest = "sha256:${"d".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "figma-context-import-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "figma-context-import-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("candidate", JsonObject().apply {
                addProperty("recordId", figmaContextImportId.toString())
                addProperty("revision", 2)
                addProperty("digest", candidateDigest)
            })
            addProperty("contextPackCount", 2)
            addProperty("sectionCount", 8)
            addProperty("contextItemCount", 24)
            addProperty("targetCount", 2)
            addProperty("humanReviewedSectionCount", 5)
            addProperty("sourceRecordedSectionCount", 2)
            addProperty("notAssessedSectionCount", 1)
            addProperty("unresolvedRedactionCount", 1)
            addProperty("representedRequirementCount", 7)
            addProperty("unresolvedRequirementCount", 2)
            addProperty("unresolvedOwnershipCount", 1)
            addProperty("staleBindingCount", 0)
            addProperty("staleSourceReferenceCount", 2)
            addProperty("unresolvedQuestionCount", 3)
            addProperty("contextSelectionState", "partial")
            addProperty("provenanceState", "partial")
            addProperty("previewState", "candidate-generated")
            addProperty("reviewState", "held")
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("One or more selected sections require human review") })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "figma-context-import-status-is-observational-and-does-not-package-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
            )
        })
        add("candidate", JsonObject().apply {
            addProperty("id", figmaContextImportId.toString())
            addProperty("revision", 2)
            addProperty("digest", candidateDigest)
            addProperty("membershipDigest", "sha256:${"e".repeat(64)}")
            addProperty("state", "candidate")
            addProperty("contextPackCount", 2)
            addProperty("sectionCount", 8)
            addProperty("contextItemCount", 24)
            addProperty("targetCount", 2)
            addProperty("representedRequirementCount", 7)
            addProperty("reviewState", "held")
            addProperty("updatedAt", "2026-07-29T09:29:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-record-identities-counts-statuses-and-digests-only-not-brief-requirement-constraint-context-item-figma-target-tool-source-or-personal-content-secrets-credentials-or-permissions",
        )
        addProperty(
            "authorityBoundary",
            "figma-context-import-projection-is-read-only-and-does-not-package-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-figma-context-import-digest") -> {
            value.getAsJsonObject("candidate").addProperty("contextItemCount", 25)
        }
        workspacePath.endsWith("bad-figma-context-import-private") -> {
            value.addProperty("contextItems", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleOutboundDesignBriefPackage(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE OUTBOUND DESIGN BRIEF PACKAGE PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-outbound-design-brief-package-binding")) 8 else 7
    val assessedAt = "2026-07-29T10:30:00.000Z"
    val candidateDigest = "sha256:${"f".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "outbound-design-brief-package-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "outbound-design-brief-package-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("candidate", JsonObject().apply {
                addProperty("recordId", outboundDesignBriefPackageId.toString())
                addProperty("revision", 2)
                addProperty("digest", candidateDigest)
            })
            addProperty("contextPackCount", 2)
            addProperty("entryCount", 8)
            addProperty("contextItemCount", 24)
            addProperty("recipientCount", 2)
            addProperty("humanReviewedEntryCount", 5)
            addProperty("sourceRecordedEntryCount", 2)
            addProperty("notAssessedEntryCount", 1)
            addProperty("unresolvedRedactionCount", 1)
            addProperty("representedRequirementCount", 7)
            addProperty("unresolvedRequirementCount", 2)
            addProperty("unresolvedDisclosureCount", 3)
            addProperty("staleBindingCount", 0)
            addProperty("staleSourceReferenceCount", 2)
            addProperty("unresolvedQuestionCount", 3)
            addProperty("manifestState", "partial")
            addProperty("provenanceState", "partial")
            addProperty("redactionReviewState", "partial")
            addProperty("previewState", "candidate-generated")
            addProperty("reviewState", "held")
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("One or more outbound package entries require human review") })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "outbound-design-brief-package-status-is-observational-and-does-not-materialize-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
            )
        })
        add("candidate", JsonObject().apply {
            addProperty("id", outboundDesignBriefPackageId.toString())
            addProperty("revision", 2)
            addProperty("digest", candidateDigest)
            addProperty("membershipDigest", "sha256:${"a".repeat(64)}")
            addProperty("state", "candidate")
            addProperty("manifestFormat", "gaep-outbound-design-brief-package-v1")
            addProperty("manifestDigest", "sha256:${"b".repeat(64)}")
            addProperty("payloadDigest", "sha256:${"c".repeat(64)}")
            addProperty("contextPackCount", 2)
            addProperty("entryCount", 8)
            addProperty("contextItemCount", 24)
            addProperty("recipientCount", 2)
            addProperty("representedRequirementCount", 7)
            addProperty("unresolvedDisclosureCount", 3)
            addProperty("reviewState", "held")
            addProperty("updatedAt", "2026-07-29T10:29:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-record-identities-counts-statuses-and-digests-only-not-brief-requirement-constraint-context-item-figma-target-tool-source-transformation-disclosure-or-personal-content-secrets-credentials-or-permissions",
        )
        addProperty(
            "authorityBoundary",
            "outbound-design-brief-package-projection-is-read-only-and-does-not-materialize-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-outbound-design-brief-package-digest") -> {
            value.getAsJsonObject("candidate").addProperty("contextItemCount", 25)
        }
        workspacePath.endsWith("bad-outbound-design-brief-package-private") -> {
            value.addProperty("entries", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleGovernedFigmaWrite(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE GOVERNED FIGMA WRITE PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-governed-figma-write-binding")) 8 else 7
    val assessedAt = "2026-07-29T14:00:00.000Z"
    val candidateDigest = "sha256:${"1".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "governed-figma-write-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "governed-figma-write-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("candidate", JsonObject().apply {
                addProperty("recordId", governedFigmaWriteId.toString())
                addProperty("revision", 2)
                addProperty("digest", candidateDigest)
            })
            addProperty("selectedEntryCount", 8)
            addProperty("unresolvedDisclosureCount", 2)
            addProperty("staleBindingCount", 1)
            addProperty("staleSourceReferenceCount", 2)
            addProperty("unresolvedQuestionCount", 3)
            addProperty("previewState", "candidate-generated")
            addProperty("approvalState", "pending")
            addProperty("permissionEvidenceState", "missing")
            addProperty("idempotencyState", "defined")
            addProperty("replayProtectionState", "defined")
            addProperty("recoveryPlanState", "defined")
            addProperty("writePlanState", "held")
            addProperty("reviewState", "held")
            addProperty("writeExecutionState", "not-performed")
            addProperty("writeResultState", "not-recorded")
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("Exact permission evidence is missing") })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "governed-figma-write-status-is-observational-and-does-not-materialize-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
            )
        })
        add("candidate", JsonObject().apply {
            addProperty("id", governedFigmaWriteId.toString())
            addProperty("revision", 2)
            addProperty("digest", candidateDigest)
            addProperty("membershipDigest", "sha256:${"2".repeat(64)}")
            addProperty("state", "candidate")
            addProperty("requestFormat", "gaep-governed-figma-write-request-v1")
            addProperty("requestDigest", "sha256:${"3".repeat(64)}")
            addProperty("effectDigest", "sha256:${"4".repeat(64)}")
            add("outboundPackage", JsonObject().apply {
                addProperty("recordId", outboundDesignBriefPackageId.toString())
                addProperty("revision", 2)
                addProperty("digest", "sha256:${"5".repeat(64)}")
                addProperty("membershipDigest", "sha256:${"6".repeat(64)}")
                addProperty("manifestDigest", "sha256:${"7".repeat(64)}")
                addProperty("payloadDigest", "sha256:${"8".repeat(64)}")
            })
            addProperty("externalFileIdentityDigest", "sha256:${"9".repeat(64)}")
            addProperty("expectedExternalVersionDigest", "sha256:${"a".repeat(64)}")
            addProperty("selectedEntryCount", 8)
            addProperty("previewState", "candidate-generated")
            addProperty("previewDigest", "sha256:${"b".repeat(64)}")
            addProperty("approvalState", "pending")
            addProperty("permissionEvidenceState", "missing")
            addProperty("idempotencyState", "defined")
            addProperty("recoveryPlanState", "defined")
            addProperty("reviewState", "held")
            addProperty("writeExecutionState", "not-performed")
            addProperty("updatedAt", "2026-07-29T13:59:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-record-identities-counts-statuses-and-digests-only-not-brief-requirement-constraint-context-item-figma-target-tool-source-approval-actor-permission-evidence-recovery-or-personal-content-secrets-or-credentials",
        )
        addProperty(
            "authorityBoundary",
            "governed-figma-write-projection-is-read-only-and-does-not-materialize-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-governed-figma-write-digest") -> {
            value.getAsJsonObject("candidate").addProperty("selectedEntryCount", 9)
        }
        workspacePath.endsWith("bad-governed-figma-write-private") -> {
            value.addProperty("approvalActor", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleFinalizedFigmaSnapshotImport(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE FINALIZED FIGMA SNAPSHOT IMPORT PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-finalized-figma-snapshot-import-binding")) 8 else 7
    val assessedAt = "2026-07-29T15:30:00.000Z"
    val candidateDigest = "sha256:${"c".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "finalized-figma-snapshot-import-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "finalized-figma-snapshot-import-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("candidate", JsonObject().apply {
                addProperty("recordId", finalizedFigmaSnapshotImportId.toString())
                addProperty("revision", 2)
                addProperty("digest", candidateDigest)
            })
            addProperty("itemCount", 18)
            addProperty("humanReviewedItemCount", 12)
            addProperty("sourceRecordedItemCount", 4)
            addProperty("notAssessedItemCount", 2)
            addProperty("openConflictCount", 3)
            addProperty("staleBindingCount", 1)
            addProperty("staleSourceReferenceCount", 2)
            addProperty("unresolvedQuestionCount", 5)
            addProperty("returnAuthorizationState", "missing")
            addProperty("reconciliationState", "partial")
            addProperty("provenanceState", "partial")
            addProperty("snapshotCompletenessState", "partial")
            addProperty("reviewState", "held")
            addProperty("importExecutionState", "not-performed")
            addProperty("importResultState", "not-recorded")
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("Exact return authorization is missing") })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "finalized-figma-snapshot-import-status-is-observational-and-does-not-transfer-or-import-content-connect-to-or-call-figma-request-credentials-grant-permissions-prove-external-completeness-validate-or-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
            )
        })
        add("candidate", JsonObject().apply {
            addProperty("id", finalizedFigmaSnapshotImportId.toString())
            addProperty("revision", 2)
            addProperty("digest", candidateDigest)
            addProperty("membershipDigest", "sha256:${"7".repeat(64)}")
            addProperty("state", "candidate")
            add("governedWrite", JsonObject().apply {
                addProperty("recordId", governedFigmaWriteId.toString())
                addProperty("revision", 2)
                addProperty("digest", "sha256:${"1".repeat(64)}")
                addProperty("membershipDigest", "sha256:${"2".repeat(64)}")
                addProperty("requestDigest", "sha256:${"3".repeat(64)}")
                addProperty("effectDigest", "sha256:${"4".repeat(64)}")
                addProperty("externalFileIdentityDigest", "sha256:${"5".repeat(64)}")
                addProperty("expectedExternalVersionDigest", "sha256:${"6".repeat(64)}")
            })
            addProperty("externalFileIdentityDigest", "sha256:${"5".repeat(64)}")
            addProperty("returnedExternalVersionDigest", "sha256:${"8".repeat(64)}")
            addProperty("payloadDigest", "sha256:${"9".repeat(64)}")
            addProperty("receiptDigest", "sha256:${"a".repeat(64)}")
            addProperty("reconciliationDigest", "sha256:${"b".repeat(64)}")
            addProperty("itemCount", 18)
            addProperty("conflictCount", 4)
            addProperty("returnAuthorizationState", "missing")
            addProperty("reconciliationState", "partial")
            addProperty("provenanceState", "partial")
            addProperty("reviewState", "held")
            addProperty("importExecutionState", "not-performed")
            addProperty("updatedAt", "2026-07-29T15:29:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-record-identities-counts-statuses-and-digests-only-not-figma-content-names-external-identities-source-content-authorization-actor-personal-content-secrets-credentials-or-permissions",
        )
        addProperty(
            "authorityBoundary",
            "finalized-figma-snapshot-import-projection-is-read-only-and-does-not-transfer-or-import-content-connect-to-or-call-figma-request-credentials-grant-permissions-prove-external-completeness-validate-or-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-finalized-figma-snapshot-import-digest") -> {
            value.getAsJsonObject("candidate").addProperty("itemCount", 19)
        }
        workspacePath.endsWith("bad-finalized-figma-snapshot-import-private") -> {
            value.addProperty("authorizationActor", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleDesignToRequirementBinding(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE DESIGN TO REQUIREMENT BINDING PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-design-to-requirement-binding-binding")) 8 else 7
    val assessedAt = "2026-07-29T16:30:00.000Z"
    val candidateDigest = "sha256:${"d".repeat(64)}"
    fun dependency(recordId: UUID, revision: Int, catalogKey: String, digestSeed: String): JsonObject = JsonObject().apply {
        addProperty("recordId", recordId.toString())
        addProperty("revision", revision)
        addProperty("digest", "sha256:${digestSeed.repeat(64)}")
        addProperty("membershipDigest", "sha256:${(digestSeed.first().digitToIntOrNull()?.plus(1) ?: 14).toString(16).repeat(64)}")
        addProperty(catalogKey, "sha256:${(digestSeed.first().digitToIntOrNull()?.plus(2) ?: 15).toString(16).repeat(64)}")
    }
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "design-to-requirement-binding-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "design-to-requirement-binding-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("candidate", JsonObject().apply {
                addProperty("recordId", designToRequirementBindingId.toString())
                addProperty("revision", 2)
                addProperty("digest", candidateDigest)
            })
            addProperty("bindingCount", 7)
            addProperty("humanReviewedBindingCount", 5)
            addProperty("designItemCount", 4)
            addProperty("boundDesignItemCount", 3)
            addProperty("unboundDesignItemCount", 1)
            addProperty("requirementCount", 3)
            addProperty("boundRequirementCount", 2)
            addProperty("unboundRequirementCount", 1)
            addProperty("decisionCount", 2)
            addProperty("boundDecisionCount", 1)
            addProperty("unboundDecisionCount", 1)
            addProperty("openConflictCount", 2)
            addProperty("staleBindingCount", 1)
            addProperty("staleSourceReferenceCount", 2)
            addProperty("unresolvedQuestionCount", 3)
            addProperty("reconciliationState", "partial")
            addProperty("candidateCoverageState", "partial")
            addProperty("provenanceState", "exact")
            addProperty("reviewState", "held")
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("One or more governed subjects remain unbound") })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "design-to-requirement-binding-status-is-observational-and-does-not-establish-relationship-truth-coverage-completeness-requirement-satisfaction-decision-effectiveness-external-completeness-design-validity-or-approval-baseline-readiness-implementation-write-import-or-action-authority",
            )
        })
        add("candidate", JsonObject().apply {
            addProperty("id", designToRequirementBindingId.toString())
            addProperty("revision", 2)
            addProperty("digest", candidateDigest)
            addProperty("membershipDigest", "sha256:${"e".repeat(64)}")
            addProperty("state", "candidate")
            add("finalizedSnapshot", dependency(finalizedFigmaSnapshotImportId, 2, "itemCatalogDigest", "1"))
            add("designRequirements", dependency(designRequirementsId, 3, "requirementCatalogDigest", "4"))
            add("decisionRegister", dependency(decisionRegisterId, 4, "decisionCatalogDigest", "7"))
            addProperty("reconciliationDigest", "sha256:${"a".repeat(64)}")
            addProperty("bindingCount", 7)
            addProperty("designItemCoverageCount", 4)
            addProperty("subjectCoverageCount", 5)
            addProperty("conflictCount", 3)
            addProperty("reconciliationState", "partial")
            addProperty("candidateCoverageState", "partial")
            addProperty("provenanceState", "exact")
            addProperty("reviewState", "held")
            addProperty("updatedAt", "2026-07-29T16:29:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-record-identities-counts-statuses-and-digests-only-not-figma-content-external-identities-requirement-text-decision-content-source-content-human-attribution-personal-content-secrets-credentials-or-permissions",
        )
        addProperty(
            "authorityBoundary",
            "design-to-requirement-binding-projection-is-read-only-and-does-not-establish-relationship-truth-coverage-completeness-requirement-satisfaction-decision-effectiveness-external-completeness-design-validity-or-approval-baseline-readiness-implementation-write-import-or-action-authority",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-design-to-requirement-binding-digest") -> {
            value.getAsJsonObject("candidate").addProperty("bindingCount", 8)
        }
        workspacePath.endsWith("bad-design-to-requirement-binding-private") -> {
            value.addProperty("humanAttribution", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleDesignerReadyGate(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE DESIGNER READY GATE PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-designer-ready-gate-binding")) 8 else 7
    val assessedAt = "2026-07-29T22:25:00.000Z"
    val candidateDigest = "sha256:${"1".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "designer-ready-gate-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "designer-ready-gate-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("candidate", JsonObject().apply {
                addProperty("recordId", designerReadyGateId.toString())
                addProperty("revision", 2)
                addProperty("digest", candidateDigest)
            })
            addProperty("prerequisiteCount", 12)
            addProperty("satisfiedCount", 9)
            addProperty("notApplicableCount", 1)
            addProperty("unsatisfiedCount", 1)
            addProperty("notAssessedCount", 1)
            addProperty("staleOrUnknownCount", 2)
            addProperty("humanReviewedCount", 10)
            addProperty("pendingExceptionCount", 1)
            addProperty("grantedExceptionCandidateCount", 1)
            addProperty("invalidExceptionCount", 1)
            addProperty("staleBindingCount", 2)
            addProperty("staleSourceReferenceCount", 3)
            addProperty("unresolvedQuestionCount", 4)
            addProperty("candidateResult", "incomplete")
            addProperty("reviewState", "held")
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("One or more prerequisites remain incomplete") })
            addProperty("assessedAt", assessedAt)
            addProperty("gateBoundary", "a-passing-designer-ready-gate-candidate-is-an-evaluation-result-not-permission-or-readiness")
            addProperty(
                "authorityBoundary",
                "designer-ready-gate-status-is-observational-and-does-not-establish-design-completeness-external-completeness-design-validity-approval-baseline-readiness-exception-waiver-acceptance-phase-entry-implementation-write-import-or-action-authority",
            )
        })
        add("candidate", JsonObject().apply {
            addProperty("id", designerReadyGateId.toString())
            addProperty("revision", 2)
            addProperty("digest", candidateDigest)
            addProperty("membershipDigest", "sha256:${"2".repeat(64)}")
            addProperty("state", "candidate")
            addProperty("prerequisiteCount", 12)
            addProperty("prerequisiteCatalogDigest", "sha256:${"3".repeat(64)}")
            addProperty("evaluationCatalogDigest", "sha256:${"4".repeat(64)}")
            addProperty("exceptionCatalogDigest", "sha256:${"5".repeat(64)}")
            addProperty("assessmentDefinitionDigest", "sha256:${"6".repeat(64)}")
            addProperty("assessmentReceiptDigest", "sha256:${"7".repeat(64)}")
            addProperty("candidateResult", "incomplete")
            addProperty("reviewState", "held")
            addProperty("updatedAt", "2026-07-29T22:24:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-record-identities-counts-results-and-digests-only-not-design-content-criteria-findings-exception-rationale-decision-content-source-content-human-attribution-personal-content-secrets-credentials-or-permissions",
        )
        addProperty(
            "authorityBoundary",
            "designer-ready-gate-projection-is-read-only-and-does-not-establish-design-completeness-external-completeness-design-validity-approval-baseline-readiness-exception-waiver-acceptance-phase-entry-implementation-write-import-or-action-authority",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-designer-ready-gate-digest") -> {
            value.getAsJsonObject("candidate").addProperty("prerequisiteCount", 11)
        }
        workspacePath.endsWith("bad-designer-ready-gate-private") -> {
            value.addProperty("criteria", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleDesignDelta(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE DESIGN DELTA PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-design-delta-binding")) 8 else 7
    val assessedAt = "2026-07-29T23:12:00.000Z"
    val candidateDigest = "sha256:${"8".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "design-delta-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "design-delta-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("candidate", JsonObject().apply {
                addProperty("recordId", designDeltaId.toString())
                addProperty("revision", 2)
                addProperty("digest", candidateDigest)
            })
            addProperty("sourceItemCount", 12)
            addProperty("targetItemCount", 14)
            addProperty("deltaCount", 6)
            addProperty("addedCount", 2)
            addProperty("changedCount", 1)
            addProperty("conflictingCount", 1)
            addProperty("missingCount", 1)
            addProperty("staleCount", 1)
            addProperty("unmappedCount", 0)
            addProperty("humanReviewedCount", 3)
            addProperty("staleBindingCount", 1)
            addProperty("staleSourceReferenceCount", 2)
            addProperty("unresolvedMappingCount", 2)
            addProperty("unresolvedQuestionCount", 3)
            addProperty("comparisonState", "partial")
            addProperty("provenanceState", "partial")
            addProperty("candidateResult", "conflict-candidate")
            addProperty("reviewState", "held")
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("The candidate contains an unresolved conflicting delta") })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "design-delta-status-is-observational-and-does-not-establish-delta-completeness-external-completeness-design-validity-approval-baseline-readiness-conflict-resolution-synchronization-implementation-write-import-or-action-authority",
            )
        })
        add("candidate", JsonObject().apply {
            addProperty("id", designDeltaId.toString())
            addProperty("revision", 2)
            addProperty("digest", candidateDigest)
            addProperty("membershipDigest", "sha256:${"9".repeat(64)}")
            addProperty("state", "candidate")
            add("designerReadyGate", JsonObject().apply {
                addProperty("recordId", designerReadyGateId.toString())
                addProperty("revision", 2)
                addProperty("digest", "sha256:${"1".repeat(64)}")
                addProperty("membershipDigest", "sha256:${"2".repeat(64)}")
                addProperty("prerequisiteCatalogDigest", "sha256:${"3".repeat(64)}")
                addProperty("assessmentReceiptDigest", "sha256:${"4".repeat(64)}")
                addProperty("candidateResult", "incomplete")
            })
            add("finalizedSnapshot", JsonObject().apply {
                addProperty("recordId", finalizedFigmaSnapshotImportId.toString())
                addProperty("revision", 2)
                addProperty("digest", "sha256:${"5".repeat(64)}")
                addProperty("membershipDigest", "sha256:${"6".repeat(64)}")
                addProperty("itemCatalogDigest", "sha256:${"7".repeat(64)}")
                addProperty("reconciliationDigest", "sha256:${"8".repeat(64)}")
                addProperty("reviewState", "held")
            })
            add("designBinding", JsonObject().apply {
                addProperty("recordId", designToRequirementBindingId.toString())
                addProperty("revision", 2)
                addProperty("digest", "sha256:${"9".repeat(64)}")
                addProperty("membershipDigest", "sha256:${"a".repeat(64)}")
                addProperty("bindingCatalogDigest", "sha256:${"b".repeat(64)}")
                addProperty("reconciliationDigest", "sha256:${"c".repeat(64)}")
                addProperty("reviewState", "held")
            })
            addProperty("sourceSnapshotDigest", "sha256:${"d".repeat(64)}")
            addProperty("targetSnapshotDigest", "sha256:${"e".repeat(64)}")
            addProperty("comparisonDefinitionDigest", "sha256:${"f".repeat(64)}")
            addProperty("comparisonReceiptDigest", "sha256:${"0".repeat(64)}")
            addProperty("deltaCatalogDigest", "sha256:${"1".repeat(64)}")
            addProperty("deltaCount", 6)
            addProperty("comparisonState", "partial")
            addProperty("provenanceState", "partial")
            addProperty("candidateResult", "conflict-candidate")
            addProperty("reviewState", "held")
            addProperty("updatedAt", "2026-07-29T23:11:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-record-identities-counts-results-and-digests-only-not-design-content-delta-content-external-identities-evidence-content-source-content-human-attribution-personal-content-secrets-credentials-or-permissions",
        )
        addProperty(
            "authorityBoundary",
            "design-delta-projection-is-read-only-and-does-not-establish-delta-completeness-external-completeness-design-validity-approval-baseline-readiness-conflict-resolution-synchronization-implementation-write-import-or-action-authority",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-design-delta-digest") -> {
            value.getAsJsonObject("status").addProperty("deltaCount", 5)
        }
        workspacePath.endsWith("bad-design-delta-private") -> {
            value.addProperty("deltaContent", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleDesignConflictResolution(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE DESIGN CONFLICT RESOLUTION PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-design-conflict-resolution-binding")) 8 else 7
    val assessedAt = "2026-07-30T00:10:00.000Z"
    val candidateDigest = "sha256:${"2".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "design-conflict-resolution-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "design-conflict-resolution-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("candidate", JsonObject().apply {
                addProperty("recordId", designConflictResolutionId.toString())
                addProperty("revision", 2)
                addProperty("digest", candidateDigest)
            })
            addProperty("conflictCount", 5)
            addProperty("resolutionCount", 4)
            addProperty("acceptSourceCount", 1)
            addProperty("acceptTargetCount", 1)
            addProperty("mergeCount", 1)
            addProperty("rejectChangeCount", 0)
            addProperty("escalateCount", 1)
            addProperty("humanReviewedCount", 3)
            addProperty("distinctActorDeclaredCount", 2)
            addProperty("expiredCandidateCount", 1)
            addProperty("unresolvedConflictCount", 1)
            addProperty("unresolvedQuestionCount", 2)
            addProperty("staleBindingCount", 1)
            addProperty("staleSourceReferenceCount", 2)
            addProperty("coverageState", "partial")
            addProperty("provenanceState", "partial")
            addProperty("candidateResult", "escalation-plan-candidate")
            addProperty("reviewState", "held")
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("The candidate records unresolved design conflicts") })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "design-conflict-resolution-status-is-observational-and-does-not-enforce-separation-of-duties-resolve-conflicts-synchronize-design-establish-validity-approval-baseline-readiness-or-grant-implementation-write-import-or-action-authority",
            )
        })
        add("candidate", JsonObject().apply {
            addProperty("id", designConflictResolutionId.toString())
            addProperty("revision", 2)
            addProperty("digest", candidateDigest)
            addProperty("membershipDigest", "sha256:${"3".repeat(64)}")
            addProperty("state", "candidate")
            add("designDelta", JsonObject().apply {
                addProperty("recordId", designDeltaId.toString())
                addProperty("revision", 2)
                addProperty("digest", "sha256:${"8".repeat(64)}")
                addProperty("membershipDigest", "sha256:${"9".repeat(64)}")
                addProperty("deltaCatalogDigest", "sha256:${"1".repeat(64)}")
                addProperty("comparisonReceiptDigest", "sha256:${"0".repeat(64)}")
                addProperty("conflictingCount", 5)
                addProperty("candidateResult", "conflict-candidate")
                addProperty("reviewState", "ready-for-human-review")
            })
            addProperty("resolutionDefinitionDigest", "sha256:${"4".repeat(64)}")
            addProperty("resolutionReceiptDigest", "sha256:${"5".repeat(64)}")
            addProperty("resolutionCatalogDigest", "sha256:${"6".repeat(64)}")
            addProperty("conflictCount", 5)
            addProperty("resolutionCount", 4)
            addProperty("coverageState", "partial")
            addProperty("provenanceState", "partial")
            addProperty("candidateResult", "escalation-plan-candidate")
            addProperty("reviewState", "held")
            addProperty("updatedAt", "2026-07-30T00:09:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-record-identities-counts-results-and-digests-only-not-design-content-delta-content-resolution-content-evidence-content-source-content-human-attribution-personal-content-secrets-credentials-or-permissions",
        )
        addProperty(
            "authorityBoundary",
            "design-conflict-resolution-projection-is-read-only-and-does-not-enforce-separation-of-duties-resolve-conflicts-synchronize-design-establish-validity-approval-baseline-readiness-or-grant-implementation-write-import-or-action-authority",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-design-conflict-resolution-digest") -> {
            value.getAsJsonObject("status").addProperty("resolutionCount", 3)
        }
        workspacePath.endsWith("bad-design-conflict-resolution-private") -> {
            value.addProperty("resolutionContent", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleHumanDesignApproval(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE HUMAN DESIGN APPROVAL PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-human-design-approval-binding")) 8 else 7
    val assessedAt = "2026-07-30T00:55:00.000Z"
    val candidateDigest = "sha256:${"2".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "human-design-approval-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "human-design-approval-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("candidate", JsonObject().apply {
                addProperty("recordId", humanDesignApprovalId.toString())
                addProperty("revision", 2)
                addProperty("digest", candidateDigest)
            })
            addProperty("prerequisiteCount", 5)
            addProperty("completePrerequisiteCount", 4)
            addProperty("decisionCount", 1)
            addProperty("approveCount", 1)
            addProperty("rejectCount", 0)
            addProperty("requestChangeCount", 0)
            addProperty("abstainCount", 0)
            addProperty("expiredDecisionCount", 1)
            addProperty("revokedDecisionCount", 0)
            addProperty("staleBindingCount", 1)
            addProperty("staleSourceReferenceCount", 2)
            addProperty("unresolvedQuestionCount", 3)
            addProperty("candidateResult", "approved-candidate")
            addProperty("reviewState", "recorded-human-decision")
            addProperty("approverAuthorityState", "not-established")
            addProperty("separationOfDutiesEnforcementState", "not-established")
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("The recorded human design decision candidate is expired") })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "human-design-approval-status-is-observational-and-does-not-verify-approver-authority-enforce-separation-of-duties-establish-design-approval-baseline-readiness-phase-entry-or-grant-implementation-write-import-or-action-authority",
            )
        })
        add("candidate", JsonObject().apply {
            addProperty("id", humanDesignApprovalId.toString())
            addProperty("revision", 2)
            addProperty("digest", candidateDigest)
            addProperty("membershipDigest", "sha256:${"3".repeat(64)}")
            addProperty("state", "candidate")
            addProperty("prerequisiteCatalogDigest", "sha256:${"4".repeat(64)}")
            add("subject", JsonObject().apply {
                addProperty("kind", "finalized-figma-snapshot-import-candidate")
                addProperty("recordId", finalizedFigmaSnapshotImportId.toString())
                addProperty("revision", 2)
                addProperty("digest", "sha256:${"5".repeat(64)}")
                addProperty("membershipDigest", "sha256:${"6".repeat(64)}")
                addProperty("externalFileIdentityDigest", "sha256:${"7".repeat(64)}")
                addProperty("returnedExternalVersionDigest", "sha256:${"8".repeat(64)}")
                addProperty("itemCatalogDigest", "sha256:${"9".repeat(64)}")
                addProperty("itemCount", 18)
            })
            addProperty("scopeDigest", "sha256:${"a".repeat(64)}")
            addProperty("decisionDefinitionDigest", "sha256:${"b".repeat(64)}")
            addProperty("decisionReceiptDigest", "sha256:${"c".repeat(64)}")
            addProperty("decisionKind", "approve-candidate")
            addProperty("decisionDigest", "sha256:${"d".repeat(64)}")
            addProperty("decisionLifecycleState", "active-candidate")
            addProperty("candidateResult", "approved-candidate")
            addProperty("reviewState", "recorded-human-decision")
            addProperty("updatedAt", "2026-07-30T00:54:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-record-identities-counts-results-and-digests-only-not-design-content-decision-rationale-condition-evidence-source-content-human-attribution-personal-content-secrets-credentials-or-permissions",
        )
        addProperty(
            "authorityBoundary",
            "human-design-approval-projection-is-read-only-and-does-not-verify-approver-authority-enforce-separation-of-duties-establish-design-approval-baseline-readiness-phase-entry-or-grant-implementation-write-import-or-action-authority",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-human-design-approval-digest") -> {
            value.getAsJsonObject("status").addProperty("completePrerequisiteCount", 5)
        }
        workspacePath.endsWith("bad-human-design-approval-private") -> {
            value.addProperty("decisionRationale", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleDesignBaseline(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE DESIGN BASELINE PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-design-baseline-binding")) 8 else 7
    val assessedAt = "2026-07-30T01:40:00.000Z"
    val candidateDigest = "sha256:${"e".repeat(64)}"
    val subject = JsonObject().apply {
        addProperty("kind", "finalized-figma-snapshot-import-candidate")
        addProperty("recordId", finalizedFigmaSnapshotImportId.toString())
        addProperty("revision", 2)
        addProperty("digest", "sha256:${"5".repeat(64)}")
        addProperty("membershipDigest", "sha256:${"6".repeat(64)}")
        addProperty("externalFileIdentityDigest", "sha256:${"7".repeat(64)}")
        addProperty("returnedExternalVersionDigest", "sha256:${"8".repeat(64)}")
        addProperty("itemCatalogDigest", "sha256:${"9".repeat(64)}")
        addProperty("itemCount", 18)
    }
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "design-baseline-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "design-baseline-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("candidate", JsonObject().apply {
                addProperty("recordId", designBaselineId.toString())
                addProperty("revision", 3)
                addProperty("digest", candidateDigest)
            })
            addProperty("candidateSetCount", 1)
            addProperty("designationCandidateCount", 1)
            addProperty("supersessionCandidateCount", 1)
            addProperty("withdrawalCandidateCount", 0)
            addProperty("restorationCandidateCount", 0)
            addProperty("expiredDesignationCount", 1)
            addProperty("staleBindingCount", 2)
            addProperty("staleSourceReferenceCount", 3)
            addProperty("unresolvedQuestionCount", 4)
            addProperty("candidateResult", "supersession-candidate")
            addProperty("reviewState", "ready-for-human-review")
            addProperty("approvalDeterminationState", "not-established")
            addProperty("baselineDesignationState", "not-established")
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("The baseline designation candidate is expired") })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "design-baseline-status-is-observational-and-does-not-convert-an-approval-candidate-into-approval-verify-approver-authority-enforce-separation-of-duties-establish-a-baseline-readiness-phase-entry-or-grant-implementation-write-import-or-action-authority",
            )
        })
        add("candidate", JsonObject().apply {
            addProperty("id", designBaselineId.toString())
            addProperty("revision", 3)
            addProperty("digest", candidateDigest)
            addProperty("membershipDigest", "sha256:${"f".repeat(64)}")
            addProperty("state", "candidate")
            add("humanDesignApproval", JsonObject().apply {
                addProperty("kind", "human-design-approval-candidate")
                addProperty("recordId", humanDesignApprovalId.toString())
                addProperty("revision", 2)
                addProperty("digest", "sha256:${"2".repeat(64)}")
                addProperty("membershipDigest", "sha256:${"3".repeat(64)}")
                addProperty("decisionReceiptDigest", "sha256:${"c".repeat(64)}")
                addProperty("subjectDigest", "sha256:${"5".repeat(64)}")
                addProperty("scopeDigest", "sha256:${"a".repeat(64)}")
                addProperty("candidateResult", "approved-candidate")
                addProperty("reviewState", "recorded-human-decision")
                addProperty("assessmentDigest", "sha256:${"1".repeat(64)}")
                addProperty("assessmentState", "complete-for-recorded-decision")
            })
            add("subject", subject)
            addProperty("scopeDigest", "sha256:${"a".repeat(64)}")
            addProperty("baselineLineageId", "85858585-8585-4585-8585-858585858585")
            addProperty("candidateSetId", "86868686-8686-4686-8686-868686868686")
            addProperty("candidateSetRevision", 3)
            addProperty("semanticVersion", "2.0.0")
            addProperty("versionPolicyDigest", "sha256:${"2".repeat(64)}")
            addProperty("designationDefinitionDigest", "sha256:${"3".repeat(64)}")
            addProperty("designationReceiptDigest", "sha256:${"4".repeat(64)}")
            addProperty("designationKind", "supersede-baseline-candidate")
            addProperty("designationDigest", "sha256:${"5".repeat(64)}")
            add("supersedes", JsonObject().apply {
                addProperty("recordId", designBaselineId.toString())
                addProperty("revision", 2)
                addProperty("digest", "sha256:${"6".repeat(64)}")
                addProperty("membershipDigest", "sha256:${"7".repeat(64)}")
                addProperty("baselineLineageId", "85858585-8585-4585-8585-858585858585")
                addProperty("semanticVersion", "1.0.0")
            })
            addProperty("candidateResult", "supersession-candidate")
            addProperty("reviewState", "ready-for-human-review")
            addProperty("updatedAt", "2026-07-30T01:39:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-record-identities-version-axes-counts-results-and-digests-only-not-design-content-rationale-evidence-source-content-human-attribution-personal-content-secrets-credentials-or-permissions",
        )
        addProperty(
            "authorityBoundary",
            "design-baseline-projection-is-read-only-and-does-not-convert-an-approval-candidate-into-approval-verify-approver-authority-enforce-separation-of-duties-establish-a-baseline-readiness-phase-entry-or-grant-implementation-write-import-or-action-authority",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-design-baseline-digest") -> {
            value.getAsJsonObject("status").addProperty("candidateSetCount", 0)
        }
        workspacePath.endsWith("bad-design-baseline-private") -> {
            value.addProperty("designRationale", "$privateRoot/$privateCredential")
        }
    }
    writeResult(id, value)
}

private fun handleDesignDriftDetection(id: Long, params: JsonObject, workspacePath: String) {
    if (params.keySet() != setOf("initiativeId") || params.get("initiativeId").asString != initiativeId.toString()) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE DESIGN DRIFT PARAMS")
        return
    }
    val productRevision = if (workspacePath.endsWith("bad-design-drift-binding")) 8 else 7
    val assessedAt = "2026-07-30T03:30:00.000Z"
    val candidateDigest = "sha256:${"4".repeat(64)}"
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "design-drift-detection-projection")
        add("product", JsonObject().apply {
            addProperty("id", productId.toString())
            addProperty("revision", productRevision)
            addProperty("digest", canonicalDigest(productRecord()))
        })
        add("initiative", JsonObject().apply {
            addProperty("id", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", canonicalDigest(initiativeState))
            addProperty("state", initiativeState.get("state").asString)
        })
        add("status", JsonObject().apply {
            addProperty("schemaVersion", 1)
            addProperty("kind", "design-drift-detection-status")
            addProperty("productId", productId.toString())
            addProperty("productRevision", productRevision)
            addProperty("initiativeId", initiativeId.toString())
            addProperty("initiativeRevision", initiativeState.get("revision").asLong)
            add("candidate", JsonObject().apply {
                addProperty("recordId", designDriftDetectionId.toString())
                addProperty("revision", 2)
                addProperty("digest", candidateDigest)
            })
            addProperty("implementationTargetCount", 5)
            addProperty("humanReviewedImplementationTargetCount", 4)
            addProperty("observationCount", 9)
            addProperty("humanReviewedObservationCount", 8)
            addProperty("requirementToDesignCount", 4)
            addProperty("designToImplementationCount", 5)
            addProperty("conformantCount", 3)
            addProperty("driftCount", 5)
            addProperty("unassessedCount", 1)
            addProperty("blockerCount", 1)
            addProperty("highSeverityCount", 2)
            addProperty("remediationCandidateCount", 4)
            addProperty("expiredRemediationCandidateCount", 1)
            addProperty("staleBindingCount", 2)
            addProperty("staleSourceReferenceCount", 3)
            addProperty("unresolvedQuestionCount", 1)
            addProperty("candidateResult", "incomplete")
            addProperty("reviewState", "held")
            addProperty("state", "attention-required")
            add("reasons", JsonArray().apply { add("One or more exact comparison subjects remain not assessed") })
            addProperty("assessedAt", assessedAt)
            addProperty(
                "authorityBoundary",
                "design-drift-detection-status-is-observational-and-does-not-establish-an-actual-baseline-comparison-completeness-external-completeness-design-or-implementation-validity-approval-readiness-remediation-effect-or-figma-import-write-implementation-or-action-authority",
            )
        })
        add("candidate", JsonObject().apply {
            addProperty("id", designDriftDetectionId.toString())
            addProperty("revision", 2)
            addProperty("digest", candidateDigest)
            addProperty("membershipDigest", "sha256:${"5".repeat(64)}")
            addProperty("state", "candidate")
            add("designBaseline", JsonObject().apply {
                addProperty("recordId", designBaselineId.toString())
                addProperty("revision", 3)
                addProperty("digest", "sha256:${"e".repeat(64)}")
                addProperty("membershipDigest", "sha256:${"f".repeat(64)}")
                addProperty("baselineLineageId", "85858585-8585-4585-8585-858585858585")
                addProperty("candidateSetId", "86868686-8686-4686-8686-868686868686")
                addProperty("candidateSetRevision", 3)
                addProperty("semanticVersion", "2.0.0")
                addProperty("designationReceiptDigest", "sha256:${"4".repeat(64)}")
                addProperty("baselineDesignationState", "not-established")
            })
            add("returnedFigmaSnapshot", JsonObject().apply {
                addProperty("recordId", finalizedFigmaSnapshotImportId.toString())
                addProperty("revision", 2)
                addProperty("digest", "sha256:${"5".repeat(64)}")
                addProperty("membershipDigest", "sha256:${"6".repeat(64)}")
                addProperty("externalFileIdentityDigest", "sha256:${"7".repeat(64)}")
                addProperty("returnedExternalVersionDigest", "sha256:${"8".repeat(64)}")
                addProperty("itemCatalogDigest", "sha256:${"9".repeat(64)}")
            })
            add("designRequirements", JsonObject().apply {
                addProperty("recordId", designRequirementsId.toString())
                addProperty("revision", 3)
                addProperty("digest", "sha256:${"a".repeat(64)}")
                addProperty("membershipDigest", "sha256:${"b".repeat(64)}")
                addProperty("requirementCatalogDigest", "sha256:${"c".repeat(64)}")
            })
            add("designTrace", JsonObject().apply {
                addProperty("recordId", designToRequirementBindingId.toString())
                addProperty("revision", 2)
                addProperty("digest", "sha256:${"d".repeat(64)}")
                addProperty("membershipDigest", "sha256:${"e".repeat(64)}")
                addProperty("reconciliationDigest", "sha256:${"f".repeat(64)}")
            })
            addProperty("implementationTargetCatalogRevision", 2)
            addProperty("implementationTargetCatalogDigest", "sha256:${"0".repeat(64)}")
            addProperty("comparisonPolicyDigest", "sha256:${"1".repeat(64)}")
            addProperty("comparisonDigest", "sha256:${"2".repeat(64)}")
            addProperty("implementationTargetCount", 5)
            addProperty("observationCount", 9)
            addProperty("remediationCandidateCount", 4)
            addProperty("candidateResult", "incomplete")
            addProperty("reviewState", "held")
            addProperty("updatedAt", "2026-07-30T03:29:00.000Z")
        })
        addProperty("observedAt", assessedAt)
        addProperty(
            "privacyBoundary",
            "projection-contains-record-identities-version-axes-counts-classifications-severities-statuses-and-digests-only-not-design-requirement-or-implementation-content-source-content-human-attribution-personal-content-secrets-credentials-or-permissions",
        )
        addProperty(
            "authorityBoundary",
            "design-drift-detection-projection-is-read-only-and-does-not-establish-an-actual-baseline-comparison-completeness-external-completeness-design-or-implementation-validity-approval-readiness-remediation-effect-or-figma-import-write-implementation-or-action-authority",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    when {
        workspacePath.endsWith("bad-design-drift-digest") -> {
            value.getAsJsonObject("status").addProperty("observationCount", 8)
        }
        workspacePath.endsWith("bad-design-drift-private") -> {
            value.addProperty("implementationContent", "$privateRoot/$privateCredential")
        }
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
                            missingSubjects == 0 -> "complete"
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

private fun handlePhase2UxFigmaDashboard(id: Long, params: JsonObject, workspacePath: String) {
    val productDigest = canonicalDigest(productRecord())
    val initiativeRevision = initiativeState.get("revision").asLong
    val initiativeDigest = canonicalDigest(initiativeState)
    if (params.keySet() != setOf(
            "expectedProductId", "expectedProductRevision", "expectedProductDigest", "expectedInitiativeId",
            "expectedInitiativeRevision", "expectedInitiativeDigest",
        ) || params.get("expectedProductId").asString != productId.toString() ||
        params.get("expectedProductRevision").asLong != 7L || params.get("expectedProductDigest").asString != productDigest ||
        params.get("expectedInitiativeId").asString != initiativeId.toString() ||
        params.get("expectedInitiativeRevision").asLong != initiativeRevision ||
        params.get("expectedInitiativeDigest").asString != initiativeDigest
    ) {
        writeError(id, -32_602, "PHASE2_UX_FIGMA_PARAMS_INVALID", "PRIVATE PHASE 2 DASHBOARD PARAMS")
        return
    }
    val definitions = listOf(
        listOf("design-applicability", "Design applicability", "experience", "design-applicability-projection"),
        listOf("design-personas-roles", "Design personas and roles", "experience", "design-persona-role-projection"),
        listOf("user-journeys", "User journeys", "experience", "user-journey-model-projection"),
        listOf("information-architecture", "Information architecture", "experience", "information-architecture-model-projection"),
        listOf("screen-state-inventory", "Screen and state inventory", "experience", "screen-state-inventory-projection"),
        listOf("design-requirements", "Design requirements", "design-system", "design-requirements-projection"),
        listOf("design-system-token-contract", "Design system and token contract", "design-system", "design-system-token-contract-projection"),
        listOf("accessibility-design-rules", "Accessibility design rules", "design-system", "accessibility-design-rules-projection"),
        listOf("responsive-multi-platform-targets", "Responsive and multi-platform targets", "design-system", "responsive-multi-platform-targets-projection"),
        listOf("manual-figma-execution-path", "Manual Figma execution path", "figma-exchange", "manual-figma-execution-path-projection"),
        listOf("figma-mcp-capability-discovery", "Figma MCP capability discovery", "figma-exchange", "figma-mcp-capability-discovery-projection"),
        listOf("figma-read-snapshot", "Figma read snapshot", "figma-exchange", "figma-read-snapshot-projection"),
        listOf("figma-context-import", "Figma context import", "figma-exchange", "figma-context-import-projection"),
        listOf("outbound-design-brief-package", "Outbound design brief package", "figma-exchange", "outbound-design-brief-package-projection"),
        listOf("governed-figma-write", "Governed Figma write", "figma-exchange", "governed-figma-write-projection"),
        listOf("finalized-figma-snapshot-import", "Finalized Figma snapshot import", "figma-exchange", "finalized-figma-snapshot-import-projection"),
        listOf("design-to-requirement-binding", "Design-to-requirement binding", "governance-assurance", "design-to-requirement-binding-projection"),
        listOf("designer-ready-gate", "Designer-ready gate", "governance-assurance", "designer-ready-gate-projection"),
        listOf("design-delta", "Design delta", "governance-assurance", "design-delta-projection"),
        listOf("design-conflict-resolution", "Design conflict resolution", "governance-assurance", "design-conflict-resolution-projection"),
        listOf("human-design-approval", "Human design approval", "governance-assurance", "human-design-approval-projection"),
        listOf("design-baseline", "Design baseline", "governance-assurance", "design-baseline-projection"),
        listOf("design-drift-detection", "Design drift detection", "governance-assurance", "design-drift-detection-projection"),
    )
    val sources = JsonArray().apply {
        definitions.forEach { definition ->
            add(JsonObject().apply {
                addProperty("id", definition[0])
                addProperty("title", definition[1])
                addProperty("group", definition[2])
                addProperty("projectionKind", definition[3])
                addProperty("availability", "unavailable")
            })
        }
    }
    fun zeroCounts(vararg names: String) = JsonObject().apply { names.forEach { addProperty(it, 0) } }
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "phase-2-ux-figma-dashboard")
        addProperty("viewDefinitionVersion", "gaep-phase-2-ux-figma-dashboard-v1")
        add("phase", JsonObject().apply {
            addProperty("id", "phase-2-design")
            addProperty("label", "Phase 2 — UX and Figma Loop")
        })
        add("product", JsonObject().apply {
            addProperty("recordType", "product")
            addProperty("recordId", productId.toString())
            addProperty("revision", 7)
            addProperty("digest", productDigest)
        })
        add("initiative", JsonObject().apply {
            addProperty("recordType", "initiative")
            addProperty("recordId", initiativeId.toString())
            addProperty("revision", initiativeRevision)
            addProperty("digest", initiativeDigest)
            addProperty("state", initiativeState.get("state").asString)
        })
        add("sources", sources)
        add("experience", zeroCounts(
            "personaCount", "designRoleCount", "journeyCount", "touchpointCount",
            "informationArchitectureNodeCount", "routeCount", "screenCount", "stateCount", "variantCount",
        ))
        add("designSystem", zeroCounts(
            "requirementCount", "designSystemCount", "tokenCount", "componentCount", "accessibilityRuleCount",
            "accessibilityCheckCount", "platformTargetCount", "breakpointCount",
        ))
        add("figma", zeroCounts(
            "fileCount", "componentCount", "variableCount", "designBindingCount",
            "humanReviewedBindingCount", "unboundDesignItemCount",
        ).apply {
            addProperty("connectionState", "not-established")
            addProperty("writeExecutionState", "not-performed")
            addProperty("importExecutionState", "not-performed")
        })
        add("governance", JsonObject().apply {
            addProperty("designerReadyCandidateResult", "not-assessed")
            addProperty("humanApprovalCandidateResult", "not-assessed")
            addProperty("baselineCandidateResult", "not-assessed")
            addProperty("baselineDesignationState", "not-established")
            addProperty("driftCandidateResult", "not-assessed")
            addProperty("approvalState", "not-established")
            addProperty("readinessState", "not-established")
            addProperty("remediationEffectState", "not-applied")
        })
        add("drift", zeroCounts(
            "observationCount", "requirementToDesignCount", "designToImplementationCount", "conformantCount",
            "driftCount", "unassessedCount", "blockerCount", "highSeverityCount", "remediationCandidateCount",
        ))
        add("freshness", zeroCounts("staleBindingCount", "staleSourceReferenceCount", "unresolvedQuestionCount").apply {
            addProperty("state", "current")
        })
        add("phaseStatus", JsonObject().apply {
            addProperty("state", "attention-required")
            addProperty("expectedSourceCount", 23)
            addProperty("currentSourceCount", 0)
            addProperty("attentionRequiredSourceCount", 0)
            addProperty("unavailableSourceCount", 23)
            addProperty("sourceCatalogDigest", canonicalDigest(sources))
            addProperty("productOwnerAcceptance", "not-established")
            addProperty("readinessAuthority", "not-established")
            addProperty("phaseEntryAuthority", "not-established")
        })
        add("evidenceCues", dashboardEvidenceCues("unknown"))
        addProperty("observedAt", "2026-07-30T03:10:00.000Z")
        addProperty("sourceBoundary", "current-governed-product-initiative-and-phase-2-projections-only")
        addProperty(
            "privacyBoundary",
            "dashboard-exposes-identities-counts-statuses-times-and-digests-not-design-requirement-figma-source-human-or-personal-content-secrets-credentials-or-permissions",
        )
        add("limitations", JsonArray().apply {
            add("Missing projections remain explicitly unavailable and do not establish completeness.")
            add("No approval, Baseline Set, readiness, Figma, remediation, implementation, release, or action authority is granted.")
        })
        addProperty(
            "authorityBoundary",
            "phase-2-dashboard-is-a-derived-read-only-view-not-a-second-source-of-truth-or-completeness-validity-approval-baseline-readiness-remediation-figma-implementation-or-action-authority",
        )
    }
    if (workspacePath.endsWith("bad-phase2-dashboard-private")) {
        content.addProperty("sourceRoot", "$privateRoot/$privateCredential")
    }
    if (workspacePath.endsWith("bad-phase2-dashboard-catalog")) {
        content.getAsJsonObject("phaseStatus").addProperty("sourceCatalogDigest", "sha256:${"0".repeat(64)}")
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    if (workspacePath.endsWith("bad-phase2-dashboard-digest")) {
        value.getAsJsonObject("phaseStatus").addProperty("unavailableSourceCount", 22)
    }
    writeResult(id, value)
}

private fun handlePhase1Summary(id: Long, params: JsonObject, workspacePath: String) {
    val productDigest = canonicalDigest(productRecord())
    val initiativeRevision = initiativeState.get("revision").asLong
    val initiativeDigest = canonicalDigest(initiativeState)
    if (params.keySet() != setOf(
            "expectedProductId", "expectedProductRevision", "expectedProductDigest", "expectedInitiativeId",
            "expectedInitiativeRevision", "expectedInitiativeDigest",
        ) || params.get("expectedProductId").asString != productId.toString() ||
        params.get("expectedProductRevision").asLong != 7L || params.get("expectedProductDigest").asString != productDigest ||
        params.get("expectedInitiativeId").asString != initiativeId.toString() ||
        params.get("expectedInitiativeRevision").asLong != initiativeRevision ||
        params.get("expectedInitiativeDigest").asString != initiativeDigest
    ) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE PHASE1 SUMMARY PARAMS")
        return
    }
    fun readinessGaps() = JsonObject().apply {
        listOf(
            "applicability", "conditional", "incomplete", "failed", "blocked", "staleOrUnknown", "waivers",
            "decisions", "conditions", "requirements", "adverseEvidence", "bindings", "sourceReferences",
            "inconsistencies", "questions", "total",
        ).forEach { addProperty(it, 0) }
    }
    fun handoffGaps() = JsonObject().apply {
        listOf(
            "unresolvedItems", "staleOrUnknownItems", "requirements", "conflicts", "questions", "bindings",
            "sourceReferences", "total",
        ).forEach { addProperty(it, 0) }
    }
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "phase-1-summary-readiness-dashboard")
        add("phase", JsonObject().apply {
            addProperty("id", "phase-1b-product")
            addProperty("label", "Phase 1B — Product P0–P4")
        })
        add("product", JsonObject().apply {
            addProperty("recordType", "product")
            addProperty("recordId", productId.toString())
            addProperty("revision", 7)
            addProperty("digest", productDigest)
        })
        add("initiative", JsonObject().apply {
            addProperty("recordType", "initiative")
            addProperty("recordId", initiativeId.toString())
            addProperty("revision", initiativeRevision)
            addProperty("digest", initiativeDigest)
            addProperty("state", initiativeState.get("state").asString)
        })
        add("readiness", JsonObject().apply {
            addProperty("snapshotDigest", "sha256:${"1".repeat(64)}")
            addProperty("result", "not-assessed")
            addProperty("assessedAt", "2026-07-27T12:00:00.000Z")
            add("outputs", JsonObject().apply {
                addProperty("total", 0)
                addProperty("applicable", 0)
                addProperty("notApplicable", 0)
                addProperty("unresolvedApplicability", 0)
                addProperty("satisfied", 0)
            })
            add("gaps", readinessGaps())
            addProperty("reasonCount", 1)
            addProperty("attentionRequired", true)
            addProperty("authorityBoundary", "readiness-result-is-evaluation-only-not-permission-or-product-readiness")
        })
        add("handoff", JsonObject().apply {
            addProperty("snapshotDigest", "sha256:${"2".repeat(64)}")
            addProperty("state", "attention-required")
            addProperty("transferState", "draft")
            addProperty("assessedAt", "2026-07-27T12:00:01.000Z")
            add("items", JsonObject().apply {
                addProperty("total", 0)
                addProperty("included", 0)
                addProperty("referenceOnly", 0)
                addProperty("omittedNotApplicable", 0)
                addProperty("unresolved", 0)
            })
            add("gaps", handoffGaps())
            addProperty("reasonCount", 1)
            addProperty("attentionRequired", true)
            addProperty("authorityBoundary", "handoff-status-is-candidate-context-only-not-transfer-or-phase-entry-authority")
        })
        add("phaseStatus", JsonObject().apply {
            addProperty("state", "attention-required")
            addProperty("declaredGapCount", 0)
            addProperty("attentionSignalCount", 2)
            addProperty("productOwnerAcceptance", "not-established")
            addProperty("readinessAuthority", "not-established")
            addProperty("phaseEntryAuthority", "not-established")
        })
        add("owners", JsonObject().apply {
            addProperty("state", "unbound")
            addProperty("boundOwnerCount", 0)
            addProperty("basis", "no-governed-phase-owner-assignment-is-bound")
        })
        add("freshness", JsonObject().apply {
            addProperty("state", "current")
            addProperty("readinessObservedAt", "2026-07-27T12:00:02.000Z")
            addProperty("handoffObservedAt", "2026-07-27T12:00:03.000Z")
            addProperty("staleBindingCount", 0)
            addProperty("staleSourceReferenceCount", 0)
            addProperty("basis", "exact-current-projections-and-declared-binding-freshness")
        })
        add("evidenceCues", dashboardEvidenceCues("current"))
        addProperty("observedAt", "2026-07-27T12:00:04.000Z")
        addProperty("sourceBoundary", "current-governed-product-initiative-readiness-and-handoff-projections-only")
        addProperty("privacyBoundary", "summary-exposes-identities-counts-statuses-times-and-digests-not-narrative-findings-evidence-source-content-personal-data-secrets-or-credentials")
        add("limitations", JsonArray().apply {
            add("Phase ownership remains unbound until a governed phase-owner assignment record is available.")
        })
        addProperty("authorityBoundary", "phase-1-summary-is-read-only-candidate-evidence-not-readiness-approval-acceptance-phase-entry-release-or-action-authority")
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    if (workspacePath.endsWith("bad-dashboard-private")) value.addProperty("sourceRoot", "$privateRoot/$privateCredential")
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

private fun handlePhase1ChangeImpact(id: Long, params: JsonObject, workspacePath: String) {
    val productDigest = canonicalDigest(productRecord())
    val initiativeRevision = initiativeState.get("revision").asLong
    val initiativeDigest = canonicalDigest(initiativeState)
    val change = changeReference()
    if (params.keySet() != setOf(
            "expectedProductId", "expectedProductRevision", "expectedProductDigest", "expectedInitiativeId",
            "expectedInitiativeRevision", "expectedInitiativeDigest", "expectedChangeId", "expectedChangeRevision",
            "expectedChangeDigest",
        ) || params.get("expectedProductId").asString != productId.toString() ||
        params.get("expectedProductRevision").asLong != 7L || params.get("expectedProductDigest").asString != productDigest ||
        params.get("expectedInitiativeId").asString != initiativeId.toString() ||
        params.get("expectedInitiativeRevision").asLong != initiativeRevision ||
        params.get("expectedInitiativeDigest").asString != initiativeDigest ||
        params.get("expectedChangeId").asString != changeId.toString() ||
        params.get("expectedChangeRevision").asLong != 3L ||
        params.get("expectedChangeDigest").asString != change.get("digest").asString
    ) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE PHASE1 CHANGE IMPACT PARAMS")
        return
    }
    val outputKinds = listOf(
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
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "phase-1-change-impact-dashboard")
        add("phase", JsonObject().apply {
            addProperty("id", "phase-1b-product")
            addProperty("label", "Phase 1B — Product P0–P4")
        })
        add("product", exactReference("product", productId, 7, productDigest))
        add("initiative", JsonObject().apply {
            addProperty("recordType", "initiative")
            addProperty("recordId", initiativeId.toString())
            addProperty("revision", initiativeRevision)
            addProperty("digest", initiativeDigest)
            addProperty("state", initiativeState.get("state").asString)
        })
        add("change", change)
        add("sources", JsonObject().apply {
            addProperty("changeImpactSnapshotDigest", "sha256:${"7".repeat(64)}")
            addProperty("readinessSnapshotDigest", "sha256:${"8".repeat(64)}")
            addProperty("handoffSnapshotDigest", "sha256:${"9".repeat(64)}")
        })
        add("changeScope", JsonObject().apply {
            addProperty("workItemCount", 1)
            addProperty("changedArtifactCount", 1)
            addProperty("effectTargetCount", 1)
            addProperty("affectedUnitCount", 1)
            addProperty("decisionCount", 1)
            addProperty("riskCount", 1)
            addProperty("unresolvedTraceLinkCount", 0)
            addProperty("staleTraceLinkCount", 0)
            addProperty("invalidTraceLinkCount", 0)
            addProperty("traceAnalysisTruncated", false)
        })
        add("outputs", JsonArray().apply {
            outputKinds.forEach { (outputKind, recordKind) ->
                add(JsonObject().apply {
                    addProperty("outputKind", outputKind)
                    addProperty("recordKind", recordKind)
                    add("readiness", JsonObject().apply {
                        addProperty("applicability", "not-assessed")
                        addProperty("evaluationState", "not-assessed")
                        addProperty("freshness", "unknown")
                        addProperty("subjectCount", 0)
                    })
                    add("impact", JsonObject().apply {
                        addProperty("state", "not-established")
                        addProperty("exactMatchedSubjectCount", 0)
                        addProperty("staleSubjectBindingCount", 0)
                        addProperty("traceReferenceCount", 0)
                        addProperty("validTraceCount", 0)
                        addProperty("unresolvedTraceCount", 0)
                        addProperty("staleTraceCount", 0)
                        addProperty("invalidTraceCount", 0)
                        addProperty("upstreamTraceCount", 0)
                        addProperty("downstreamTraceCount", 0)
                        addProperty("revalidationState", "not-established")
                        addProperty(
                            "coverageBoundary",
                            "absence-of-an-exact-trace-match-does-not-prove-absence-of-impact",
                        )
                    })
                    add("handoff", JsonObject().apply {
                        addProperty("disposition", "not-established")
                        addProperty("freshness", "unknown")
                        addProperty("subjectCount", 0)
                    })
                })
            }
        })
        add("coverage", JsonObject().apply {
            addProperty("state", "bounded-not-complete")
            addProperty("outputCount", 25)
            addProperty("applicableOutputCount", 0)
            addProperty("currentTraceObservedOutputCount", 0)
            addProperty("attentionRequiredOutputCount", 0)
            addProperty("impactNotEstablishedOutputCount", 25)
            addProperty("revalidationNotEstablishedOutputCount", 25)
            addProperty("basis", "exact-current-readiness-subjects-matched-to-bounded-governed-change-trace-results")
            addProperty(
                "coverageBoundary",
                "trace-presence-proves-only-the-recorded-link-and-trace-absence-does-not-prove-no-impact",
            )
        })
        add("owners", JsonObject().apply {
            addProperty("state", "unbound")
            addProperty("boundOutputOwnerCount", 0)
            addProperty("basis", "no-governed-phase-output-owner-assignment-is-bound")
        })
        add("governance", JsonObject().apply {
            addProperty("changeApproval", "not-established")
            addProperty("riskAcceptanceAuthority", "not-established")
            addProperty("revalidationAuthority", "not-established")
            addProperty("productOwnerAcceptance", "not-established")
            addProperty("effectAuthority", "not-established")
        })
        add("freshness", JsonObject().apply {
            addProperty("state", "current")
            addProperty("changeImpactEvaluatedAt", "2026-07-27T12:04:00.000Z")
            addProperty("readinessObservedAt", "2026-07-27T12:04:01.000Z")
            addProperty("handoffObservedAt", "2026-07-27T12:04:02.000Z")
            addProperty("staleBindingCount", 0)
            addProperty("staleSourceReferenceCount", 0)
            addProperty("traceAttentionLinkCount", 0)
            addProperty("traceAnalysisTruncated", false)
            addProperty("basis", "current-governed-snapshots-and-declared-trace-readiness-handoff-freshness")
        })
        add("evidenceCues", JsonObject().apply {
            addProperty("freshness", "current")
            add("confidence", JsonObject().apply {
                addProperty("state", "not-assessed")
                addProperty("basis", "bounded-trace-coverage-does-not-establish-impact-confidence-or-completeness")
            })
        })
        addProperty("observedAt", "2026-07-27T12:04:03.000Z")
        addProperty(
            "sourceBoundary",
            "current-governed-product-initiative-change-readiness-handoff-and-bounded-trace-projections-only",
        )
        addProperty(
            "privacyBoundary",
            "dashboard-exposes-identities-digests-counts-statuses-effects-and-times-not-change-text-output-content-findings-evidence-source-content-personal-data-secrets-or-credentials",
        )
        add("limitations", JsonArray().apply {
            add("Outputs without exact trace matches remain impact not established rather than unaffected.")
        })
        addProperty(
            "authorityBoundary",
            "phase-1-change-impact-dashboard-is-read-only-observed-candidate-evidence-not-impact-completeness-revalidation-approval-risk-acceptance-readiness-effect-release-or-action-authority",
        )
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    if (workspacePath.endsWith("bad-phase1-change-impact-digest")) {
        value.getAsJsonObject("coverage").addProperty("impactNotEstablishedOutputCount", 24)
    }
    if (workspacePath.endsWith("bad-dashboard-private")) value.addProperty("sourceRoot", "$privateRoot/$privateCredential")
    writeResult(id, value)
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

private fun buildAgentModel(params: JsonObject, workspacePath: String): JsonObject? {
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
        return null
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
    return response
}

private fun handleAgentModel(id: Long, params: JsonObject, workspacePath: String) {
    val response = buildAgentModel(params, workspacePath)
    if (response == null) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE AGENT MODEL PARAMS")
    } else {
        writeResult(id, response)
    }
}

private fun handlePhase2ChangeImpactAgentModelDashboard(id: Long, params: JsonObject, workspacePath: String) {
    val productDigest = canonicalDigest(productRecord())
    val initiativeRevision = initiativeState.get("revision").asLong
    val initiativeDigest = canonicalDigest(initiativeState)
    if (params.keySet() != setOf(
            "expectedProductId", "expectedProductRevision", "expectedProductDigest", "expectedInitiativeId",
            "expectedInitiativeRevision", "expectedInitiativeDigest", "agentModel",
        ) || params.get("expectedProductId").asString != productId.toString() ||
        params.get("expectedProductRevision").asLong != 7L || params.get("expectedProductDigest").asString != productDigest ||
        params.get("expectedInitiativeId").asString != initiativeId.toString() ||
        params.get("expectedInitiativeRevision").asLong != initiativeRevision ||
        params.get("expectedInitiativeDigest").asString != initiativeDigest
    ) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE PHASE 2 INTEGRATED PARAMS")
        return
    }
    val agentModel = buildAgentModel(params.getAsJsonObject("agentModel"), workspacePath)
    if (agentModel == null) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE PHASE 2 INTEGRATED PARAMS")
        return
    }
    val capabilities = agentModel.getAsJsonArray("capabilities")
    val detected = capabilities.count { it.asJsonObject.get("detected").asBoolean }
    val selected = capabilities.count { it.asJsonObject.get("selected").asBoolean }
    val selection = agentModel.getAsJsonObject("selection")
    fun zeroCounts(vararg keys: String) = JsonObject().apply { keys.forEach { addProperty(it, 0) } }
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "phase-2-change-impact-agent-model-dashboard")
        addProperty("viewDefinitionVersion", "gaep-phase-2-change-impact-agent-model-dashboard-v1")
        add("phase", JsonObject().apply {
            addProperty("id", "phase-2-design")
            addProperty("label", "Phase 2 — UX and Figma Loop")
        })
        add("product", exactReference("product", productId, 7, productDigest))
        add("initiative", JsonObject().apply {
            addProperty("recordType", "initiative")
            addProperty("recordId", initiativeId.toString())
            addProperty("revision", initiativeRevision)
            addProperty("digest", initiativeDigest)
            addProperty("state", initiativeState.get("state").asString)
        })
        add("sources", JsonObject().apply {
            addProperty("phase2UxFigmaSnapshotDigest", canonicalDigest(JsonObject().apply { addProperty("fixture", "phase2") }))
            addProperty("phase2SourceCatalogDigest", canonicalDigest(JsonObject().apply { addProperty("expected", 23) }))
            addProperty("agentModelSnapshotDigest", agentModel.get("snapshotDigest").asString)
        })
        add("synchronizationChange", JsonObject().apply {
            addProperty("state", "attention-required")
            listOf("designDelta", "conflictResolution", "humanDesignApproval", "designBaseline", "designDriftDetection")
                .forEach { addProperty(it, "unavailable") }
            addProperty("figmaConnectionState", "not-established")
            addProperty("figmaWriteExecutionState", "not-performed")
            addProperty("figmaImportExecutionState", "not-performed")
            addProperty("synchronizationEffectState", "not-applied")
        })
        add("impact", zeroCounts(
            "requirementCount", "designBindingCount", "unboundDesignItemCount", "driftObservationCount", "driftCount",
            "unassessedCount", "blockerCount", "highSeverityCount", "remediationCandidateCount", "staleBindingCount",
            "staleSourceReferenceCount", "unresolvedQuestionCount",
        ).apply {
            addProperty("state", "current-bounded-observation")
            addProperty("coverage", "bounded-not-complete")
            addProperty("impactCompleteness", "not-established")
            addProperty("designValidity", "not-established")
            addProperty("revalidationState", "not-established")
        })
        add("agentModel", JsonObject().apply {
            addProperty("selectionState", selection.get("status").asString)
            add("capabilities", JsonObject().apply {
                addProperty("shown", capabilities.size())
                addProperty("total", capabilities.size())
                addProperty("omitted", 0)
                addProperty("detected", detected)
                addProperty("unavailable", capabilities.size() - detected)
                addProperty("selected", selected)
            })
            add("runs", zeroCounts(
                "shown", "total", "omitted", "terminal", "nonTerminal", "managedObserved", "resultBound", "actualEffectCount",
            ))
            add("managedRuns", zeroCounts("shown", "total", "omitted"))
            add("handoffs", zeroCounts("shown", "total", "omitted", "pendingAcknowledgement", "acknowledged"))
            add("providerMetrics", JsonObject().apply {
                addProperty("usage", "unavailable")
                addProperty("cost", "unavailable")
            })
            addProperty("liveProviderQuality", "not-assessed")
            addProperty("semanticOutputQuality", "not-assessed")
        })
        add("freshness", JsonObject().apply {
            addProperty("state", "attention-required")
            addProperty("phase2State", "attention-required")
            addProperty("agentModelState", agentModel.getAsJsonObject("freshness").get("state").asString)
            addProperty("selectionCapabilityState", agentModel.getAsJsonObject("freshness").get("selectionCapabilityState").asString)
            addProperty("phase2ObservedAt", "2026-07-30T03:10:00.000Z")
            addProperty("agentModelObservedAt", agentModel.get("observedAt").asString)
            addProperty("oldestCapabilityObservedAt", agentModel.getAsJsonObject("freshness").get("oldestCapabilityObservedAt").asString)
            addProperty("newestCapabilityObservedAt", agentModel.getAsJsonObject("freshness").get("newestCapabilityObservedAt").asString)
            addProperty("truncated", false)
        })
        add("governance", JsonObject().apply {
            listOf(
                "humanDesignApproval", "baselineDesignation", "impactAcceptance", "providerAccountReadiness",
                "providerPreference", "phaseReadinessAuthority", "productOwnerAcceptance",
            ).forEach { addProperty(it, "not-established") }
            listOf("automaticSelectionAuthority", "runLaunchAuthority", "effectAuthority")
                .forEach { addProperty(it, "not-granted") }
        })
        add("evidenceCues", dashboardEvidenceCues("unknown"))
        addProperty("observedAt", "2026-07-30T03:12:00.000Z")
        addProperty("sourceBoundary", "exact-derived-phase-2-dashboard-and-current-initiative-scoped-agent-model-metadata-only")
        addProperty(
            "privacyBoundary",
            "dashboard-exposes-identities-digests-counts-statuses-and-times-not-design-content-prompts-provider-output-run-content-evidence-content-personal-data-secrets-credentials-permissions-or-machine-paths",
        )
        add("limitations", JsonArray().apply {
            add("Synchronization and impact panels remain exact bounded derived evidence.")
            add("Agent and model counts remain bounded to the exact current Initiative.")
            add("No dashboard state grants approval, baseline, readiness, remediation, launch, or effect authority.")
        })
        addProperty(
            "authorityBoundary",
            "phase-2-change-impact-agent-model-dashboard-is-derived-read-only-evidence-not-a-second-source-of-truth-impact-completeness-design-validity-provider-quality-selection-run-launch-approval-baseline-readiness-remediation-effect-release-or-action-authority",
        )
    }
    if (workspacePath.endsWith("bad-phase2-integrated-binding")) {
        content.getAsJsonObject("product").addProperty("digest", "sha256:${"0".repeat(64)}")
    }
    if (workspacePath.endsWith("bad-phase2-integrated-private")) {
        content.addProperty("sourceRoot", "$privateRoot/$privateCredential")
    }
    val value = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    if (workspacePath.endsWith("bad-phase2-integrated-digest")) {
        value.getAsJsonObject("agentModel").getAsJsonObject("capabilities").addProperty("detected", 0)
    }
    writeResult(id, value)
}

private fun handlePhase1AgentModel(id: Long, params: JsonObject, workspacePath: String) {
    val initiativeDigest = canonicalDigest(initiativeState)
    if (params.keySet() != setOf(
            "expectedInitiativeId", "expectedInitiativeRevision", "expectedInitiativeDigest", "agentModel",
        ) || params.get("expectedInitiativeId").asString != initiativeId.toString() ||
        params.get("expectedInitiativeRevision").asLong != initiativeState.get("revision").asLong ||
        params.get("expectedInitiativeDigest").asString != initiativeDigest
    ) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE PHASE 1 AGENT MODEL PARAMS")
        return
    }
    val agentModel = buildAgentModel(params.getAsJsonObject("agentModel"), workspacePath)
    if (agentModel == null) {
        writeError(id, -32_602, "INVALID_PARAMS", "PRIVATE PHASE 1 AGENT MODEL PARAMS")
        return
    }
    val capabilities = agentModel.getAsJsonArray("capabilities")
    val detected = capabilities.count { it.asJsonObject.get("detected").asBoolean }
    val selected = capabilities.count { it.asJsonObject.get("selected").asBoolean }
    val productDigest = canonicalDigest(productRecord())
    val content = JsonObject().apply {
        addProperty("schemaVersion", 1)
        addProperty("kind", "phase-1-agent-model-dashboard")
        add("phase", JsonObject().apply {
            addProperty("id", "phase-1b-product")
            addProperty("label", "Phase 1B — Product P0–P4")
        })
        add("product", exactReference("product", productId, 7, productDigest))
        add("initiative", JsonObject().apply {
            addProperty("recordType", "initiative")
            addProperty("recordId", initiativeId.toString())
            addProperty("revision", initiativeState.get("revision").asLong)
            addProperty("digest", initiativeDigest)
            addProperty("state", initiativeState.get("state").asString)
        })
        add("source", JsonObject().apply {
            addProperty("agentModelSnapshotDigest", agentModel.get("snapshotDigest").asString)
            addProperty("scope", "exact-current-initiative")
        })
        add("agentModel", agentModel)
        add("executionTruth", JsonObject().apply {
            add("capabilities", JsonObject().apply {
                addProperty("shown", capabilities.size())
                addProperty("total", capabilities.size())
                addProperty("omitted", 0)
                addProperty("detected", detected)
                addProperty("unavailable", capabilities.size() - detected)
                addProperty("selected", selected)
            })
            add("runs", JsonObject().apply {
                addProperty("shown", 0)
                addProperty("total", 0)
                addProperty("omitted", 0)
                addProperty("terminal", 0)
                addProperty("nonTerminal", 0)
                addProperty("managedObserved", 0)
                addProperty("resultBound", 0)
                addProperty("actualEffectCount", 0)
                add("outcomes", JsonObject().apply {
                    addProperty("satisfied", 0)
                    addProperty("failed", 0)
                    addProperty("notAssessed", 0)
                    addProperty("indeterminate", 0)
                })
            })
            add("managedRuns", agentModel.getAsJsonObject("limits").getAsJsonObject("managedRuns").deepCopy())
            add("handoffs", JsonObject().apply {
                addProperty("shown", 0)
                addProperty("total", 0)
                addProperty("omitted", 0)
                addProperty("pendingAcknowledgement", 0)
                addProperty("acknowledged", 0)
            })
            add("providerMetrics", JsonObject().apply {
                addProperty("usage", "unavailable")
                addProperty("cost", "unavailable")
            })
            addProperty("liveProviderQuality", "not-assessed")
            addProperty("semanticOutputQuality", "not-assessed")
        })
        add("freshness", JsonObject().apply {
            val nested = agentModel.getAsJsonObject("freshness")
            addProperty("state", nested.get("state").asString)
            addProperty("selectionCapabilityState", nested.get("selectionCapabilityState").asString)
            addProperty("oldestCapabilityObservedAt", nested.get("oldestCapabilityObservedAt").asString)
            addProperty("newestCapabilityObservedAt", nested.get("newestCapabilityObservedAt").asString)
            addProperty("agentModelObservedAt", agentModel.get("observedAt").asString)
            addProperty("truncated", nested.get("truncated").asBoolean)
            addProperty("basis", "exact-initiative-scoped-agent-model-snapshot-and-declared-bounded-coverage")
        })
        add("governance", JsonObject().apply {
            addProperty("providerAccountReadiness", "not-established")
            addProperty("providerPreference", "not-established")
            addProperty("automaticSelectionAuthority", "not-granted")
            addProperty("handoffAcknowledgementAuthority", "not-granted")
            addProperty("runLaunchAuthority", "not-granted")
            addProperty("effectAuthority", "not-granted")
            addProperty("phaseReadinessAuthority", "not-established")
            addProperty("productOwnerAcceptance", "not-established")
        })
        addProperty("observedAt", "2026-07-24T12:06:01.000Z")
        addProperty(
            "sourceBoundary",
            "current-governed-product-initiative-capability-selection-run-handoff-and-managed-evidence-metadata-only",
        )
        addProperty(
            "privacyBoundary",
            "dashboard-exposes-identities-digests-counts-statuses-times-and-redacted-selection-metadata-not-prompts-provider-output-run-content-evidence-content-personal-data-secrets-credentials-or-machine-paths",
        )
        add("limitations", JsonArray().apply {
            add("Capability observations prove only bounded adapter/runtime metadata, not provider account readiness.")
            add("Provider usage and cost remain unavailable because no governed provider metric contract is bound.")
        })
        addProperty(
            "authorityBoundary",
            "phase-1-agent-model-dashboard-is-read-only-observed-evidence-not-provider-quality-preference-automatic-selection-handoff-acknowledgement-run-launch-readiness-approval-effect-release-or-action-authority",
        )
    }
    if (workspacePath.endsWith("bad-phase1-agent-model-count")) {
        content.getAsJsonObject("executionTruth").getAsJsonObject("capabilities").addProperty("total", 3)
    }
    val response = content.deepCopy().apply { addProperty("snapshotDigest", canonicalDigest(content)) }
    if (workspacePath.endsWith("bad-phase1-agent-model-digest")) {
        response.getAsJsonObject("executionTruth").getAsJsonObject("capabilities").addProperty("detected", 2)
    }
    if (workspacePath.endsWith("bad-phase1-agent-model-private")) {
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
