package dev.gaep.rider

import com.google.gson.Gson
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.attribute.PosixFilePermission
import java.security.MessageDigest
import java.math.BigDecimal
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertFailsWith
import kotlin.test.assertIs
import kotlin.test.assertTrue

class PortableDesignClientTest {
    @TempDir
    lateinit var temporaryRoot: Path

    @Test
    fun `engine environment strips inherited provider authority`() {
        val environment = safeRiderEngineEnvironment(
            mapOf(
                "Path" to "/safe/bin",
                "pathext" to ".EXE;.CMD",
                "OPENAI_API_KEY" to "private-openai-key",
                "AWS_SECRET_ACCESS_KEY" to "private-aws-secret",
                "HOME" to "/private/home",
            ),
        )
        assertEquals("/safe/bin", environment["PATH"])
        assertEquals(".EXE;.CMD", environment["PATHEXT"])
        assertEquals("rider-product-studio", environment["GAEP_HOST_SURFACE"])
        assertFalse(environment.containsKey("OPENAI_API_KEY"))
        assertFalse(environment.containsKey("AWS_SECRET_ACCESS_KEY"))
        assertFalse(environment.containsKey("HOME"))
    }

    @Test
    fun `package-local engine binds the installed module and executes empty evidence`() {
        val generatedEngine = Path.of(
            System.getProperty("gaep.test.packagedEngine")
                ?: error("The package-local engine test path was not configured"),
        ).toRealPath()
        val pluginRoot = Files.createDirectories(temporaryRoot.resolve("installed-plugin"))
        val pluginJar = Files.createFile(Files.createDirectories(pluginRoot.resolve("lib")).resolve("gaep-rider-0.1.0.jar"))
        val installedEngine = Files.createDirectories(pluginRoot.resolve("engine")).resolve("gaep-engine.mjs")
        Files.copy(generatedEngine, installedEngine)
        val workspace = Files.createDirectory(temporaryRoot.resolve("packaged-workspace"))
        val node = findNodeExecutable()
        val environment = mapOf(
            "PATH" to (System.getenv("PATH") ?: ""),
            "GAEP_ENGINE_RUNTIME_EXECUTABLE" to node.toString(),
            "GAEP_ENGINE_RUNTIME_SHA256" to sha256(node),
            "OPENAI_API_KEY" to "private-openai-key",
        )
        assertFailsWith<IllegalArgumentException> {
            RiderEngineClientFactory.create(
                workspace,
                mapOf("PATH" to (System.getenv("PATH") ?: "")),
                pluginJar,
            )
        }

        RiderEngineClientFactory.create(workspace, environment, pluginJar).use { client ->
            val page = client.listManagedEvidence(offset = 0, limit = 100)
            assertEquals(0, page.offset)
            assertEquals(100, page.limit)
            assertEquals(0, page.total)
            assertTrue(page.items.isEmpty())
            assertFalse(page.hasMore)
        }
        assertFalse(Files.exists(workspace.resolve(".gaep")))

        val mismatched = PackagedEngineModule(installedEngine, "0".repeat(64))
        GaepEngineClient(
            workspace,
            node.toString(),
            expectedEngineSha256 = sha256(node),
            packagedEngineModule = mismatched,
            sourceEnvironment = environment,
        ).use { client ->
            val error = hostError { client.listManagedEvidence(offset = 0, limit = 100) }
            assertEquals("HOST_UNAVAILABLE", error.kind)
            assertPrivateTextWithheld(error)
        }
    }

    @Test
    fun `portable design client is bounded private and non-authoritative`() {
        val bundleRoot = Files.createDirectory(temporaryRoot.resolve("portable-bundle"))
        val invalidSourceRoot = Files.createDirectory(temporaryRoot.resolve("source-error"))
        val badReadinessRoot = Files.createDirectory(temporaryRoot.resolve("bad-readiness"))
        val badSelectionRoot = Files.createDirectory(temporaryRoot.resolve("bad-selection"))
        val badRunsRoot = Files.createDirectory(temporaryRoot.resolve("bad-runs"))
        val badHandoffRoot = Files.createDirectory(temporaryRoot.resolve("bad-handoff"))
        val badHandoffBindingRoot = Files.createDirectory(temporaryRoot.resolve("bad-handoff-binding"))
        val badManagedPreviewRoot = Files.createDirectory(temporaryRoot.resolve("bad-managed-preview"))
        val badManagedCriterionRoot = Files.createDirectory(temporaryRoot.resolve("bad-managed-criterion"))
        val badManagedDigestRoot = Files.createDirectory(temporaryRoot.resolve("bad-managed-digest"))
        val badManagedReceiptRoot = Files.createDirectory(temporaryRoot.resolve("bad-managed-receipt"))
        val badManagedBindingRoot = Files.createDirectory(temporaryRoot.resolve("bad-managed-binding"))
        val badManagedEvidencePageRoot = Files.createDirectory(temporaryRoot.resolve("bad-managed-evidence-page"))
        val badManagedEvidenceCountRoot = Files.createDirectory(temporaryRoot.resolve("bad-managed-evidence-count"))
        val badManagedEvidenceSnapshotRoot = Files.createDirectory(temporaryRoot.resolve("bad-managed-evidence-snapshot"))
        val badManagedEvidenceTotalRoot = Files.createDirectory(temporaryRoot.resolve("bad-managed-evidence-total"))
        val badManagedEvidenceDetailRoot = Files.createDirectory(temporaryRoot.resolve("bad-managed-evidence-detail"))
        val badManagedEvidenceBindingRoot = Files.createDirectory(temporaryRoot.resolve("bad-managed-evidence-binding"))
        val badManagedReviewDigestRoot = Files.createDirectory(temporaryRoot.resolve("bad-managed-review-digest"))
        val badManagedReviewPrivateRoot = Files.createDirectory(temporaryRoot.resolve("bad-managed-review-private"))
        val badManagedReviewBindingRoot = Files.createDirectory(temporaryRoot.resolve("bad-managed-review-binding"))
        val badManagedReviewPathRoot = Files.createDirectory(temporaryRoot.resolve("bad-managed-review-path"))
        val badManagedReviewMetadataRoot = Files.createDirectory(temporaryRoot.resolve("bad-managed-review-metadata"))
        val badManagedTransitionDigestRoot = Files.createDirectory(temporaryRoot.resolve("bad-managed-transition-digest"))
        val badManagedTransitionPrivateRoot = Files.createDirectory(temporaryRoot.resolve("bad-managed-transition-private"))
        val staleManagedReviewRoot = Files.createDirectory(temporaryRoot.resolve("stale-managed-review"))
        val badDashboardBindingRoot = Files.createDirectory(temporaryRoot.resolve("bad-dashboard-binding"))
        val badDashboardApplicabilityRoot = Files.createDirectory(temporaryRoot.resolve("bad-dashboard-applicability"))
        val badDashboardDigestRoot = Files.createDirectory(temporaryRoot.resolve("bad-dashboard-digest"))
        val badDashboardPrivateRoot = Files.createDirectory(temporaryRoot.resolve("bad-dashboard-private"))
        val badChangeCatalogBindingRoot = Files.createDirectory(temporaryRoot.resolve("bad-change-catalog-binding"))
        val badChangeCatalogDigestRoot = Files.createDirectory(temporaryRoot.resolve("bad-change-catalog-digest"))
        val badChangeCatalogPrivateRoot = Files.createDirectory(temporaryRoot.resolve("bad-change-catalog-private"))
        val badChangeImpactBindingRoot = Files.createDirectory(temporaryRoot.resolve("bad-change-impact-binding"))
        val badChangeImpactCountRoot = Files.createDirectory(temporaryRoot.resolve("bad-change-impact-count"))
        val badChangeImpactFreshnessRoot = Files.createDirectory(temporaryRoot.resolve("bad-change-impact-freshness"))
        val badChangeImpactDigestRoot = Files.createDirectory(temporaryRoot.resolve("bad-change-impact-digest"))
        val badChangeImpactPrivateRoot = Files.createDirectory(temporaryRoot.resolve("bad-change-impact-private"))
        val executable = createFakeEngineLauncher(temporaryRoot)
        GaepEngineClient(temporaryRoot, executable.toString()).use { client ->
            val productId = UUID.fromString("11111111-1111-4111-8111-111111111111")
            val imported = client.importPortableDesignSnapshot(
                bundleRoot,
                productId,
                expectedProductRevision = 7,
                actorId = "founder.portable-design-review",
            )
            assertEquals(bundleId, imported.bundleId)
            assertEquals(productId, imported.productId)
            assertEquals("pending-human-review", imported.governance.state)
            assertTrue(imported.governance.humanReviewRequired)
            assertEquals(PortableDesignSourceReviewStatus.APPROVED, imported.sourceReview.status)
            assertFalse(imported.sourceReview.gaepApproval)
            assertTrue(imported.sourceReview.claimLabel.contains("not GAEP approval"))
            assertEquals(PortableDesignCounts(2, 1, 6, 5), imported.counts)

            val serialized = Gson().toJson(imported)
            assertFalse(serialized.contains(bundleRoot.toString()))
            assertFalse(serialized.contains(privateRoot))
            assertFalse(serialized.contains(privateCredential))
            val summaryFields = PortableDesignSnapshotSummary::class.java.declaredFields.map { it.name }.toSet()
            assertFalse(summaryFields.any { field ->
                listOf("root", "path", "artifact", "token", "bytes", "credential").any {
                    field.contains(it, ignoreCase = true)
                }
            })
            val importParameterTypes = GaepEngineClient::class.java.methods
                .single { it.name == "importPortableDesignSnapshot" }
                .parameterTypes
                .toList()
            assertEquals(listOf(Path::class.java, UUID::class.java, Long::class.javaPrimitiveType, String::class.java), importParameterTypes)

            val page = client.listPortableDesignSnapshots(offset = 0, limit = 1)
            assertEquals(1, page.items.size)
            assertEquals(bundleId, page.items.single().bundleId)
            assertFalse(page.hasMore)
            assertTrue(page.governanceBoundary.contains("pending human review"))
            assertEquals(imported, client.readPortableDesignSnapshot(bundleId))

            val product = client.readProductBinding()
            assertEquals(productId, product.id)
            assertEquals("Founder Product", product.name)
            assertEquals(7, product.revision)
            assertTrue(Regex("^sha256:[0-9a-f]{64}$").matches(product.digest))

            val dashboard = client.readPhaseDashboard(product)
            assertEquals(DeliveryPhaseId.PHASE_0_1A_FOUNDATION, dashboard.phase)
            assertEquals(listOf("foundation-summary", "change-impact", "agent-model"), dashboard.panels.map { it.id })
            assertEquals(listOf("attention-required", "active", "active"), dashboard.panels.map { it.state })
            assertEquals(product.digest, dashboard.productDigest)
            val dashboardView = RiderProductController(client).readPhaseDashboard()
            assertTrue(dashboardView.contains("GAEP phase-scoped dashboard framework"))
            assertTrue(dashboardView.contains("applicability=unknown (not-evaluated)"))
            assertTrue(dashboardView.contains("grants no mutation, applicability, phase-entry"))
            assertFalse(dashboardView.contains("Founder Product"))
            assertFalse(dashboardView.contains(privateRoot))
            assertFalse(dashboardView.contains(privateCredential))

            listOf(
                badDashboardBindingRoot,
                badDashboardApplicabilityRoot,
                badDashboardDigestRoot,
                badDashboardPrivateRoot,
            ).forEach { root ->
                GaepEngineClient(root, executable.toString()).use { hostileClient ->
                    val hostileProduct = hostileClient.readProductBinding()
                    val invalidDashboard = hostError { hostileClient.readPhaseDashboard(hostileProduct) }
                    assertEquals("HOST_RESPONSE_INVALID", invalidDashboard.kind)
                    assertPrivateTextWithheld(invalidDashboard)
                }
            }
            assertFailsWith<IllegalArgumentException> {
                client.readPhaseDashboard(product.copy(digest = "sha256:not-a-digest"))
            }

            val changeCatalog = client.listChangeImpactChanges(product)
            assertEquals(productId, changeCatalog.productId)
            assertEquals(1, changeCatalog.total)
            assertEquals(0, changeCatalog.omitted)
            assertEquals(changeId, changeCatalog.items.single().recordId)
            assertEquals(listOf("reversible-change"), changeCatalog.items.single().effectEnvelope)
            val changeDashboard = client.readChangeImpact(product, changeCatalog.items.single())
            assertEquals(changeId, changeDashboard.change.recordId)
            assertEquals("current", changeDashboard.freshness.state)
            assertEquals(1, changeDashboard.workItems.size)
            assertEquals("workspace-relative", changeDashboard.changedArtifacts.single().locator.kind)
            assertEquals("logical", changeDashboard.effectTargets.single().locator.kind)
            assertEquals("risk", changeDashboard.affectedUnits.single().endpoint.recordType)
            assertEquals("valid", changeDashboard.affectedUnits.single().trace.assessedState)
            assertEquals("not-selected", changeDashboard.decisions.single().outcome)
            assertEquals("not-accepted", changeDashboard.risks.single().acceptance)
            assertFalse(changeDashboard.limits.truncated)
            val changeContext = RiderProductController(client).readChangeImpactContext()
            val changeView = RiderProductController(client).readChangeImpact(changeContext, changeContext.catalog.items.single())
            assertTrue(changeView.contains("GAEP exact Change and impact dashboard"))
            assertTrue(changeView.contains("Approval: not established"))
            assertTrue(changeView.contains("absence of a trace link does not prove absence of impact"))
            assertTrue(changeView.contains("grants no Change approval, risk acceptance, mutation"))
            assertFalse(changeView.contains("Founder Product"))
            assertFalse(changeView.contains("Private Change title"))
            assertFalse(changeView.contains(privateRoot))
            assertFalse(changeView.contains(privateCredential))

            listOf(
                badChangeCatalogBindingRoot,
                badChangeCatalogDigestRoot,
                badChangeCatalogPrivateRoot,
            ).forEach { root ->
                GaepEngineClient(root, executable.toString()).use { hostileClient ->
                    val hostileProduct = hostileClient.readProductBinding()
                    val invalidCatalog = hostError { hostileClient.listChangeImpactChanges(hostileProduct) }
                    assertEquals("HOST_RESPONSE_INVALID", invalidCatalog.kind)
                    assertPrivateTextWithheld(invalidCatalog)
                }
            }
            listOf(
                badChangeImpactBindingRoot,
                badChangeImpactCountRoot,
                badChangeImpactFreshnessRoot,
                badChangeImpactDigestRoot,
                badChangeImpactPrivateRoot,
            ).forEach { root ->
                GaepEngineClient(root, executable.toString()).use { hostileClient ->
                    val hostileProduct = hostileClient.readProductBinding()
                    val hostileChange = hostileClient.listChangeImpactChanges(hostileProduct).items.single()
                    val invalidDashboard = hostError { hostileClient.readChangeImpact(hostileProduct, hostileChange) }
                    assertEquals("HOST_RESPONSE_INVALID", invalidDashboard.kind)
                    assertPrivateTextWithheld(invalidDashboard)
                }
            }
            assertFailsWith<IllegalArgumentException> {
                client.readChangeImpact(
                    product,
                    changeCatalog.items.single().copy(digest = "sha256:not-a-digest"),
                )
            }

            val readiness = client.probeAgentReadiness()
            assertEquals(listOf("claude-code", "codex"), readiness.map { it.agentId })
            assertFalse(readiness.first().detected)
            assertEquals("gpt-5.6-codex", readiness.last().models.single().id)
            assertEquals(1, readiness.last().settingsCount)
            assertEquals("reasoningEffort", readiness.last().settings.single().key)
            assertEquals("select", readiness.last().settings.single().kind)
            assertFalse(readiness.last().settings.single().sensitive)
            val readinessFields = AgentReadinessSnapshot::class.java.declaredFields.map { it.name }.toSet()
            assertFalse(readinessFields.any { field ->
                listOf("executable", "path", "token", "credential", "defaultValue").any {
                    field.contains(it, ignoreCase = true)
                }
            })
            val readinessSerialized = Gson().toJson(readiness)
            assertFalse(readinessSerialized.contains(privateRoot))
            assertFalse(readinessSerialized.contains(privateCredential))

            assertEquals(AgentSelectionState.Unselected, client.readAgentSelection())
            val controller = RiderProductController(client)
            val selectionContext = controller.readAgentSelectionContext()
            assertEquals(listOf("codex"), selectionContext.available.map { it.agentId })
            val selectedView = controller.selectAgent(
                adapterId = "openai-codex",
                modelId = "gpt-5.6-codex",
                settings = mapOf("reasoningEffort" to PortableAgentSettingValue.Text("high")),
                actorId = "founder.review",
            )
            assertTrue(selectedView.contains("GAEP guarded Agent Selection"))
            assertTrue(selectedView.contains("codex"))
            assertTrue(selectedView.contains("gpt-5.6-codex"))
            assertTrue(selectedView.contains("does not start a provider"))
            assertFalse(selectedView.contains(privateRoot))
            assertFalse(selectedView.contains(privateCredential))
            val selectedState = assertIs<AgentSelectionState.Selected>(client.readAgentSelection())
            assertEquals("openai-codex", selectedState.selection.adapterId)
            assertEquals(PortableAgentSettingValue.Text("high"), selectedState.selection.settings["reasoningEffort"])
            assertFalse(Gson().toJson(selectedState).contains(privateRoot))
            assertFalse(Gson().toJson(selectedState).contains(privateCredential))
            val selectionFields = AgentSelection::class.java.declaredFields.map { it.name }.toSet()
            assertFalse(selectionFields.any { field ->
                listOf("executable", "path", "token", "credential").any { field.contains(it, ignoreCase = true) }
            })

            val runs = client.listRuns()
            assertEquals(1, runs.size)
            assertEquals(runId, runs.single().id)
            assertEquals(AgentRunState.COMPLETED, runs.single().state)
            assertEquals(selectedState.selection, runs.single().agent)
            assertFalse(Gson().toJson(runs).contains(privateRoot))
            assertFalse(Gson().toJson(runs).contains(privateCredential))

            val managedPreview = controller.previewManagedReadOnly(
                managedCharterId.toString(),
                workflowPlanId.toString(),
            )
            assertEquals(managedCharterId, managedPreview.charterId)
            assertEquals(workflowPlanId, managedPreview.workflowPlanId)
            assertEquals(listOf(workflowStepId), managedPreview.stepIds)
            assertEquals(6, managedPreview.gates.size)
            assertEquals(2, managedPreview.readScopeCount)
            assertTrue(managedPreview.previewDigest.startsWith("sha256:"))
            val managedPreviewJson = Gson().toJson(managedPreview)
            assertFalse(managedPreviewJson.contains(privateRoot))
            assertFalse(managedPreviewJson.contains(privateCredential))
            val managedPreviewFields = ManagedReadOnlyPreview::class.java.declaredFields.map { it.name }.toSet()
            assertFalse(managedPreviewFields.any { field ->
                listOf("path", "token", "credential", "raw", "session", "tool").any {
                    field.contains(it, ignoreCase = true)
                }
            })
            val managedPreviewView = controller.renderManagedReadOnlyPreview(managedPreview)
            assertTrue(managedPreviewView.contains(managedPreview.previewDigest))
            assertTrue(managedPreviewView.contains("Every Tool permission is denied"))
            assertTrue(managedPreviewView.contains("This preview does not execute work"))
            val managedReceiptView = controller.executeManagedReadOnly(
                preview = managedPreview,
                actorId = "founder.review",
                timeoutMs = 120_000,
            )
            assertTrue(managedReceiptView.contains(governedManagedRunId.toString()))
            assertTrue(managedReceiptView.contains(managedRunId.toString()))
            assertTrue(managedReceiptView.contains("Governed outcome: satisfied"))
            assertTrue(managedReceiptView.contains("Provider completion and governed outcome are separate claims"))
            assertFalse(managedReceiptView.contains(privateRoot))
            assertFalse(managedReceiptView.contains(privateCredential))
            val managedReceiptFields = ManagedReadOnlyReceipt::class.java.declaredFields.map { it.name }.toSet()
            assertFalse(managedReceiptFields.any { field ->
                listOf("path", "token", "credential", "raw", "session", "output").any {
                    field.contains(it, ignoreCase = true)
                }
            })
            val managedPage = client.listManagedEvidence(offset = 0, limit = 100)
            assertEquals(1, managedPage.items.size)
            assertEquals(managedRunId, managedPage.items.single().managedRunId)
            assertEquals(3, managedPage.total)
            assertEquals(2, managedPage.omittedCount)
            assertTrue(managedPage.hasMore)
            assertFalse(Gson().toJson(managedPage).contains(privateRoot))
            assertFalse(Gson().toJson(managedPage).contains(privateCredential))
            assertEquals(
                managedPage.snapshotDigest,
                client.listManagedEvidence(0, 100, managedPage.snapshotDigest).snapshotDigest,
            )
            val managedNextPage = client.listManagedEvidence(
                offset = 1,
                limit = 100,
                snapshotDigest = managedPage.snapshotDigest,
                expectedTotal = managedPage.total,
            )
            assertEquals(1, managedNextPage.offset)
            assertEquals(2, managedNextPage.items.size)
            assertEquals(managedPage.total, managedNextPage.total)
            assertEquals(1, managedNextPage.omittedCount)
            assertFalse(managedNextPage.hasMore)
            val managedDetail = client.readManagedEvidence(managedRunId)
            assertEquals(managedRunId, managedDetail.summary.managedRunId)
            assertEquals("verified-result-and-evidence", managedDetail.artifactStatus)
            assertEquals("completed", managedDetail.result?.providerDisposition)
            assertEquals("satisfied", managedDetail.result?.outcomeStatus)
            assertEquals(5, managedDetail.evidence?.eventCount)
            assertEquals(1, managedDetail.evidence?.completedStepCount)
            assertEquals(null, managedDetail.applyDecision)
            assertFalse(Gson().toJson(managedDetail).contains(privateRoot))
            assertFalse(Gson().toJson(managedDetail).contains(privateCredential))
            val managedListView = controller.listManagedEvidence()
            assertTrue(managedListView.contains("Displayed: 1 of 3"))
            assertTrue(managedListView.contains("Omitted from this page: 2"))
            assertTrue(managedListView.contains("cannot start, resume, cancel, apply, discard, approve"))
            val managedDetailView = controller.readManagedEvidence(managedRunId.toString())
            assertTrue(managedDetailView.contains("Provider disposition: completed"))
            assertTrue(managedDetailView.contains("Governed outcome: satisfied"))
            assertTrue(managedDetailView.contains("Apply-decision evidence records a past exact decision"))
            assertFalse(managedDetailView.contains(privateRoot))
            assertFalse(managedDetailView.contains(privateCredential))

            val stagedReview = controller.readManagedReview(stagedManagedRunId.toString())
            assertEquals(stagedManagedRunId, stagedReview.managedRunId)
            assertEquals(3L, stagedReview.managedRunRevision)
            assertEquals("review-required", stagedReview.state)
            assertTrue(stagedReview.canApply)
            assertTrue(stagedReview.canDiscard)
            assertEquals("record-not-assessed", stagedReview.postApplyGatePolicy)
            assertEquals(listOf("src/new.kt", "src/review.kt"), stagedReview.staging.changedInventory.map { it.path })
            assertEquals(listOf("src"), stagedReview.applyConfirmation?.writeEnvelope)
            assertEquals(stagedReview.staging.changeCount, stagedReview.staging.changedInventory.size)
            assertEquals(0, stagedReview.staging.omittedCount)
            assertFalse(Gson().toJson(stagedReview).contains(privateRoot))
            assertFalse(Gson().toJson(stagedReview).contains(privateCredential))
            val stagedReviewView = controller.renderManagedReviewPreview(stagedReview)
            assertTrue(stagedReviewView.contains("Exact changed-file inventory"))
            assertTrue(stagedReviewView.contains("src/review.kt"))
            assertTrue(stagedReviewView.contains("authorizes no mutation"))
            assertTrue(stagedReviewView.contains("Workflow gates not assessed"))

            val applyTransition = controller.applyManagedReview(stagedReview, "founder.review")
            assertEquals("apply-exact-managed-review", applyTransition.decision)
            assertEquals(stagedReview.previewDigest, applyTransition.sourcePreviewDigest)
            assertEquals(4L, applyTransition.managedRunRevision)
            assertEquals("failed", applyTransition.state)
            assertEquals("failed", applyTransition.detail.result?.outcomeStatus)
            assertEquals("applied", applyTransition.detail.evidence?.staging?.applyState)
            assertEquals(3, applyTransition.detail.applyDecision?.managedRunRevision)
            assertFalse(Gson().toJson(applyTransition).contains(privateRoot))
            assertFalse(Gson().toJson(applyTransition).contains(privateCredential))
            val transitionView = controller.renderManagedReviewTransition(applyTransition)
            assertTrue(transitionView.contains("Persisted state: failed"))
            assertTrue(transitionView.contains("governed outcome satisfaction"))

            val discardTransition = controller.discardManagedReview(stagedReview, "founder.review")
            assertEquals("discard-exact-managed-review", discardTransition.decision)
            assertEquals("discarded", discardTransition.state)
            assertFalse(discardTransition.canApply)
            assertFalse(discardTransition.canDiscard)
            assertEquals("discarded", discardTransition.detail.evidence?.staging?.applyState)
            assertEquals(null, discardTransition.detail.applyDecision)

            assertFailsWith<IllegalArgumentException> {
                client.applyManagedReview(
                    stagedReview.copy(previewDigest = "sha256:${"0".repeat(64)}"),
                    "founder.review",
                )
            }
            val reboundLocalReview = hostError {
                client.discardManagedReview(
                    stagedReview.copy(
                        staging = stagedReview.staging.copy(
                            changedInventory = stagedReview.staging.changedInventory.mapIndexed { index, change ->
                                if (index == 0) change.copy(path = "$privateRoot/secret.kt") else change
                            },
                        ),
                    ),
                    "founder.review",
                )
            }
            assertEquals("HOST_RESPONSE_INVALID", reboundLocalReview.kind)
            assertPrivateTextWithheld(reboundLocalReview)
            assertFailsWith<IllegalArgumentException> {
                client.executeManagedReadOnly(managedPreview, timeoutMs = 999, actorId = "founder.review")
            }
            assertFailsWith<IllegalArgumentException> { client.listManagedEvidence(offset = -1, limit = 100) }
            assertFailsWith<IllegalArgumentException> { client.listManagedEvidence(offset = 0, limit = 201) }
            assertFailsWith<IllegalArgumentException> {
                client.listManagedEvidence(offset = 0, limit = 100, snapshotDigest = "sha256:not-a-digest")
            }
            assertFailsWith<IllegalArgumentException> {
                client.listManagedEvidence(offset = 0, limit = 100, expectedTotal = 2_001)
            }
            assertFailsWith<IllegalArgumentException> { client.readManagedEvidence(UUID(0, 0)) }
            assertFailsWith<IllegalArgumentException> {
                client.executeManagedReadOnly(
                    managedPreview.copy(previewDigest = "sha256:${"0".repeat(64)}"),
                    timeoutMs = 120_000,
                    actorId = "founder.review",
                )
            }
            val privateCriterion = managedPreview.gates.first().copy(
                criteria = listOf("Inspect $privateRoot; token=$privateCredential"),
            )
            val invalidPrivatePreview = managedPreview.copy(
                gates = listOf(privateCriterion) + managedPreview.gates.drop(1),
            )
            val invalidPrivateCriterion = hostError {
                client.executeManagedReadOnly(invalidPrivatePreview, timeoutMs = 120_000, actorId = "founder.review")
            }
            assertEquals("HOST_RESPONSE_INVALID", invalidPrivateCriterion.kind)
            assertPrivateTextWithheld(invalidPrivateCriterion)

            listOf(badManagedPreviewRoot, badManagedCriterionRoot, badManagedDigestRoot).forEach { root ->
                GaepEngineClient(root, executable.toString()).use { hostileClient ->
                    val invalidPreview = hostError {
                        hostileClient.previewManagedReadOnly(managedCharterId, workflowPlanId)
                    }
                    assertEquals("HOST_RESPONSE_INVALID", invalidPreview.kind)
                    assertPrivateTextWithheld(invalidPreview)
                }
            }
            listOf(badManagedReceiptRoot, badManagedBindingRoot).forEach { root ->
                GaepEngineClient(root, executable.toString()).use { hostileClient ->
                    val preview = hostileClient.previewManagedReadOnly(managedCharterId, workflowPlanId)
                    val invalidReceipt = hostError {
                        hostileClient.executeManagedReadOnly(preview, timeoutMs = 120_000, actorId = "founder.review")
                    }
                    assertEquals("HOST_RESPONSE_INVALID", invalidReceipt.kind)
                    assertPrivateTextWithheld(invalidReceipt)
                }
            }
            listOf(badManagedEvidencePageRoot, badManagedEvidenceCountRoot).forEach { root ->
                GaepEngineClient(root, executable.toString()).use { hostileClient ->
                    val invalidPage = hostError { hostileClient.listManagedEvidence(offset = 0, limit = 100) }
                    assertEquals("HOST_RESPONSE_INVALID", invalidPage.kind)
                    assertPrivateTextWithheld(invalidPage)
                }
            }
            GaepEngineClient(badManagedEvidenceSnapshotRoot, executable.toString()).use { hostileClient ->
                val invalidSnapshot = hostError {
                    hostileClient.listManagedEvidence(offset = 0, limit = 100, snapshotDigest = managedPage.snapshotDigest)
                }
                assertEquals("HOST_RESPONSE_INVALID", invalidSnapshot.kind)
                assertPrivateTextWithheld(invalidSnapshot)
            }
            GaepEngineClient(badManagedEvidenceTotalRoot, executable.toString()).use { hostileClient ->
                val invalidTotal = hostError {
                    hostileClient.listManagedEvidence(
                        offset = 1,
                        limit = 100,
                        snapshotDigest = managedPage.snapshotDigest,
                        expectedTotal = managedPage.total,
                    )
                }
                assertEquals("HOST_RESPONSE_INVALID", invalidTotal.kind)
                assertPrivateTextWithheld(invalidTotal)
            }
            listOf(badManagedEvidenceDetailRoot, badManagedEvidenceBindingRoot).forEach { root ->
                GaepEngineClient(root, executable.toString()).use { hostileClient ->
                    val invalidDetail = hostError { hostileClient.readManagedEvidence(managedRunId) }
                    assertEquals("HOST_RESPONSE_INVALID", invalidDetail.kind)
                    assertPrivateTextWithheld(invalidDetail)
                }
            }
            listOf(
                badManagedReviewDigestRoot,
                badManagedReviewPrivateRoot,
                badManagedReviewBindingRoot,
                badManagedReviewPathRoot,
                badManagedReviewMetadataRoot,
            ).forEach { root ->
                GaepEngineClient(root, executable.toString()).use { hostileClient ->
                    val invalidReview = hostError { hostileClient.readManagedReview(stagedManagedRunId) }
                    assertEquals("HOST_RESPONSE_INVALID", invalidReview.kind)
                    assertPrivateTextWithheld(invalidReview)
                }
            }
            listOf(badManagedTransitionDigestRoot, badManagedTransitionPrivateRoot).forEach { root ->
                GaepEngineClient(root, executable.toString()).use { hostileClient ->
                    val hostilePreview = hostileClient.readManagedReview(stagedManagedRunId)
                    val invalidTransition = hostError {
                        hostileClient.applyManagedReview(hostilePreview, "founder.review")
                    }
                    assertEquals("HOST_RESPONSE_INVALID", invalidTransition.kind)
                    assertPrivateTextWithheld(invalidTransition)
                }
            }
            GaepEngineClient(staleManagedReviewRoot, executable.toString()).use { hostileClient ->
                val stalePreview = hostileClient.readManagedReview(stagedManagedRunId)
                val staleError = hostError { hostileClient.applyManagedReview(stalePreview, "founder.review") }
                assertEquals("MANAGED_REVIEW_CHANGED", staleError.kind)
                assertEquals(-32_029, staleError.code)
                assertPrivateTextWithheld(staleError)
            }

            val handoffContext = controller.readAgentHandoffContext()
            assertEquals(runId, handoffContext.sourceRun.id)
            assertEquals(selectedState.selection, handoffContext.current)
            val handoffView = controller.createAgentHandoff(
                context = handoffContext,
                toAdapterId = "openai-codex",
                toModelId = "gpt-5.6-codex-next",
                toSettings = mapOf("reasoningEffort" to PortableAgentSettingValue.Text("medium")),
                reason = "Switch to the reviewed model",
                completedWork = listOf("Selection workflow completed"),
                unresolvedMatters = listOf("Native Rider acceptance remains"),
                decisions = listOf("Keep execution disabled"),
                evidence = listOf("evidence/rider-selection.json"),
                actorId = "founder.review",
            )
            assertTrue(handoffView.contains("GAEP versioned Agent Handoff"))
            assertTrue(handoffView.contains(handoffId.toString()))
            assertTrue(handoffView.contains(runId.toString()))
            assertTrue(handoffView.contains("gpt-5.6-codex-next"))
            assertTrue(handoffView.contains("did not start or resume a provider"))
            assertFalse(handoffView.contains(privateRoot))
            assertFalse(handoffView.contains(privateCredential))
            val switched = assertIs<AgentSelectionState.Selected>(client.readAgentSelection())
            assertEquals("gpt-5.6-codex-next", switched.selection.modelId)
            val handoffFields = AgentHandoff::class.java.declaredFields.map { it.name }.toSet()
            assertFalse(handoffFields.any { field ->
                listOf("executable", "path", "token", "credential", "session").any {
                    field.contains(it, ignoreCase = true)
                }
            })

            GaepEngineClient(badRunsRoot, executable.toString()).use { badRunsClient ->
                val invalidRuns = hostError { badRunsClient.listRuns() }
                assertEquals("HOST_RESPONSE_INVALID", invalidRuns.kind)
                assertPrivateTextWithheld(invalidRuns)
            }
            GaepEngineClient(badHandoffRoot, executable.toString()).use { badHandoffClient ->
                val invalidHandoff = hostError {
                    badHandoffClient.createHandoff(
                        fromRunId = runId,
                        productId = productId,
                        initiativeId = UUID.fromString("22222222-2222-4222-8222-222222222222"),
                        toAdapterId = "openai-codex",
                        toAgentId = "codex",
                        toModelId = "gpt-5.6-codex-next",
                        toSettings = mapOf("reasoningEffort" to PortableAgentSettingValue.Text("medium")),
                        reason = "Switch to the reviewed model",
                        completedWork = listOf("Selection workflow completed"),
                        unresolvedMatters = listOf("Native Rider acceptance remains"),
                        decisions = listOf("Keep execution disabled"),
                        evidence = listOf("evidence/rider-selection.json"),
                        actorId = "founder.review",
                    )
                }
                assertEquals("HOST_RESPONSE_INVALID", invalidHandoff.kind)
                assertPrivateTextWithheld(invalidHandoff)
            }
            GaepEngineClient(badHandoffBindingRoot, executable.toString()).use { badHandoffBindingClient ->
                val invalidHandoff = hostError {
                    badHandoffBindingClient.createHandoff(
                        fromRunId = runId,
                        productId = productId,
                        initiativeId = UUID.fromString("22222222-2222-4222-8222-222222222222"),
                        toAdapterId = "openai-codex",
                        toAgentId = "codex",
                        toModelId = "gpt-5.6-codex-next",
                        toSettings = mapOf("reasoningEffort" to PortableAgentSettingValue.Text("medium")),
                        reason = "Switch to the reviewed model",
                        completedWork = listOf("Selection workflow completed"),
                        unresolvedMatters = listOf("Native Rider acceptance remains"),
                        decisions = listOf("Keep execution disabled"),
                        evidence = listOf("evidence/rider-selection.json"),
                        actorId = "founder.review",
                    )
                }
                assertEquals("HOST_RESPONSE_INVALID", invalidHandoff.kind)
                assertPrivateTextWithheld(invalidHandoff)
            }
            assertFailsWith<IllegalArgumentException> {
                client.createHandoff(
                    fromRunId = runId,
                    productId = productId,
                    initiativeId = UUID.fromString("22222222-2222-4222-8222-222222222222"),
                    toAdapterId = "openai-codex",
                    toAgentId = "codex",
                    toModelId = "gpt-5.6-codex-next",
                    toSettings = mapOf("reasoningEffort" to PortableAgentSettingValue.Text("medium")),
                    reason = "Inspect $privateRoot/$privateCredential",
                    completedWork = emptyList(),
                    unresolvedMatters = emptyList(),
                    decisions = emptyList(),
                    evidence = emptyList(),
                    actorId = "founder.review",
                )
            }
            assertFailsWith<IllegalArgumentException> {
                client.selectAgent(
                    "openai-codex",
                    "gpt-5.6-codex",
                    mapOf("apiKey" to PortableAgentSettingValue.Text("private")),
                    "founder.review",
                )
            }
            assertFailsWith<IllegalArgumentException> {
                client.selectAgent(
                    "openai-codex",
                    "gpt-5.6-codex",
                    mapOf("reasoningEffort" to PortableAgentSettingValue.Text("/Users/private/config")),
                    "founder.review",
                )
            }
            assertFailsWith<IllegalArgumentException> {
                client.selectAgent(
                    "openai-codex",
                    "gpt-5.6-codex",
                    mapOf("budget" to PortableAgentSettingValue.Decimal(BigDecimal("1e100000"))),
                    "founder.review",
                )
            }

            GaepEngineClient(badReadinessRoot, executable.toString()).use { badReadinessClient ->
                val invalidReadiness = hostError { badReadinessClient.probeAgentReadiness() }
                assertEquals("HOST_RESPONSE_INVALID", invalidReadiness.kind)
                assertPrivateTextWithheld(invalidReadiness)
            }

            GaepEngineClient(badSelectionRoot, executable.toString()).use { badSelectionClient ->
                val invalidSelection = hostError { badSelectionClient.readAgentSelection() }
                assertEquals("HOST_RESPONSE_INVALID", invalidSelection.kind)
                assertPrivateTextWithheld(invalidSelection)
            }

            val productView = controller.readProduct()
            assertTrue(productView.contains("Founder Product"))
            assertTrue(productView.contains("Revision: 7"))
            val readinessView = controller.readAgentReadiness()
            assertTrue(readinessView.contains("OpenAI Codex"))
            assertTrue(readinessView.contains("Anthropic Claude Code"))
            assertTrue(readinessView.contains("Observation only"))
            assertTrue(readinessView.contains("cannot select a model"))
            val listView = controller.listPortableDesignSnapshots()
            assertTrue(listView.contains(bundleId.toString()))
            assertTrue(listView.contains("pending human review"))
            val readView = controller.readPortableDesignSnapshot(bundleId.toString())
            assertTrue(readView.contains("pending-human-review"))
            assertTrue(readView.contains("GAEP approval=false"))
            val importView = controller.importPortableDesignSnapshot(bundleRoot, "founder.review")
            assertTrue(importView.contains("exact Product revision 7"))
            assertTrue(importView.contains("not approval or a baseline"))
            listOf(
                productView, readinessView, selectedView, managedPreviewView, managedReceiptView,
                handoffView, listView, readView, importView,
            ).forEach { rendered ->
                assertFalse(rendered.contains(bundleRoot.toString()))
                assertFalse(rendered.contains(privateRoot))
                assertFalse(rendered.contains(privateCredential))
            }
            assertFailsWith<IllegalArgumentException> {
                controller.readPortableDesignSnapshot("not-a-bundle-id")
            }

            assertFailsWith<IllegalArgumentException> {
                client.importPortableDesignSnapshot(Path.of("relative/bundle"), productId, 7, "founder.review")
            }
            assertFailsWith<IllegalArgumentException> {
                client.importPortableDesignSnapshot(bundleRoot, UUID(0, 0), 7, "founder.review")
            }
            assertFailsWith<IllegalArgumentException> {
                client.importPortableDesignSnapshot(bundleRoot, productId, 0, "founder.review")
            }
            assertFailsWith<IllegalArgumentException> {
                client.importPortableDesignSnapshot(bundleRoot, productId, 7, "not a portable actor")
            }
            assertFailsWith<IllegalArgumentException> {
                client.importPortableDesignSnapshot(
                    bundleRoot,
                    productId,
                    7,
                    " ".repeat(1_000_000) + "founder.review",
                )
            }
            assertFailsWith<IllegalArgumentException> { client.listPortableDesignSnapshots(offset = 10_001, limit = 1) }
            assertFailsWith<IllegalArgumentException> { client.listPortableDesignSnapshots(offset = 0, limit = 201) }
            assertFailsWith<IllegalArgumentException> { client.readPortableDesignSnapshot(UUID(0, 0)) }

            val sourceError = hostError {
                client.importPortableDesignSnapshot(invalidSourceRoot, productId, 7, "founder.review")
            }
            assertEquals("PORTABLE_DESIGN_SOURCE_INVALID", sourceError.kind)
            assertEquals("The local portable design bundle did not pass bounded validation.", sourceError.message)
            assertPrivateTextWithheld(sourceError)

            val missing = hostError { client.readPortableDesignSnapshot(missingBundleId) }
            assertEquals("PORTABLE_DESIGN_NOT_FOUND", missing.kind)
            assertPrivateTextWithheld(missing)
            assertInvalidResponse(client, extraFieldBundleId)
            assertInvalidResponse(client, mismatchedBundleId)
            assertInvalidResponse(client, extraErrorEnvelopeBundleId)
            assertInvalidResponse(client, wrongErrorCodeBundleId)
            assertInvalidResponse(client, duplicateEnvelopeBundleId)
            assertInvalidResponse(client, invalidGovernanceBundleId)
            assertInvalidResponse(client, invalidDigestBundleId)
            assertInvalidResponse(client, invalidCountBundleId)
            assertInvalidResponse(client, invalidTimestampBundleId)

            val overfullPage = hostError { client.listPortableDesignSnapshots(offset = 9_999, limit = 200) }
            assertEquals("HOST_RESPONSE_INVALID", overfullPage.kind)
            val oversized = hostError { client.readPortableDesignSnapshot(oversizedBundleId) }
            assertEquals("RESPONSE_TOO_LARGE", oversized.kind)
            val invalidUtf8 = hostError { client.readPortableDesignSnapshot(invalidUtf8BundleId) }
            assertEquals("INVALID_UTF8", invalidUtf8.kind)
            val oversizedRequest = hostError {
                client.request("ping", """{"padding":"${"x".repeat(1024 * 1024 + 1)}"}""")
            }
            assertEquals("FRAME_TOO_LARGE", oversizedRequest.kind)
        }
    }

    private fun assertInvalidResponse(client: GaepEngineClient, id: UUID) {
        val error = hostError { client.readPortableDesignSnapshot(id) }
        assertEquals("HOST_RESPONSE_INVALID", error.kind)
        assertPrivateTextWithheld(error)
    }

    private fun assertPrivateTextWithheld(error: GaepHostException) {
        assertFalse(error.message.orEmpty().contains(privateRoot))
        assertFalse(error.message.orEmpty().contains(privateCredential))
    }

    private fun hostError(action: () -> Unit): GaepHostException = assertFailsWith<GaepHostException>(block = action)

    private fun createFakeEngineLauncher(directory: Path): Path {
        val classpath = System.getProperty("gaep.test.runtimeClasspath")
            ?: error("Test runtime classpath was not configured")
        val java = Path.of(System.getProperty("java.home"), "bin", "java").toString()
        val launcher = directory.resolve("fake-gaep-engine")
        Files.writeString(
            launcher,
            "#!/bin/sh\nexec ${shellQuote(java)} -cp ${shellQuote(classpath)} dev.gaep.rider.FakePortableDesignEngineKt \"\$@\"\n",
        )
        Files.setPosixFilePermissions(
            launcher,
            setOf(
                PosixFilePermission.OWNER_READ,
                PosixFilePermission.OWNER_WRITE,
                PosixFilePermission.OWNER_EXECUTE,
            ),
        )
        return launcher
    }

    private fun findNodeExecutable(): Path {
        val names = if (System.getProperty("os.name").contains("win", ignoreCase = true)) {
            listOf("node.exe", "node.cmd", "node")
        } else {
            listOf("node")
        }
        return (System.getenv("PATH") ?: "")
            .split(java.io.File.pathSeparatorChar)
            .filter(String::isNotBlank)
            .asSequence()
            .flatMap { directory -> names.asSequence().map { name -> Path.of(directory, name) } }
            .firstOrNull { Files.isRegularFile(it) && Files.isExecutable(it) }
            ?.toRealPath()
            ?: error("Node is required to verify the package-local Rider engine")
    }

    private fun sha256(path: Path): String = Files.newInputStream(path).use { input ->
        val hash = MessageDigest.getInstance("SHA-256")
        val buffer = ByteArray(8192)
        while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            if (count > 0) hash.update(buffer, 0, count)
        }
        hash.digest().joinToString("") { byte -> "%02x".format(byte.toInt() and 0xff) }
    }

    private fun shellQuote(value: String): String = "'${value.replace("'", "'\"'\"'")}'"
}
