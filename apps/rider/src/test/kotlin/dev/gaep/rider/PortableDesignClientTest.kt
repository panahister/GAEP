package dev.gaep.rider

import com.google.gson.Gson
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.attribute.PosixFilePermission
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
    fun `portable design client is bounded private and non-authoritative`() {
        val bundleRoot = Files.createDirectory(temporaryRoot.resolve("portable-bundle"))
        val invalidSourceRoot = Files.createDirectory(temporaryRoot.resolve("source-error"))
        val badReadinessRoot = Files.createDirectory(temporaryRoot.resolve("bad-readiness"))
        val badSelectionRoot = Files.createDirectory(temporaryRoot.resolve("bad-selection"))
        val badRunsRoot = Files.createDirectory(temporaryRoot.resolve("bad-runs"))
        val badHandoffRoot = Files.createDirectory(temporaryRoot.resolve("bad-handoff"))
        val badHandoffBindingRoot = Files.createDirectory(temporaryRoot.resolve("bad-handoff-binding"))
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
            listOf(productView, readinessView, selectedView, handoffView, listView, readView, importView).forEach { rendered ->
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

    private fun shellQuote(value: String): String = "'${value.replace("'", "'\"'\"'")}'"
}
