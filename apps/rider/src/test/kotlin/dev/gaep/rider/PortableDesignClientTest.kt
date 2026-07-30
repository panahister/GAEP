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
    fun `accessible metadata tables filter visible cells and sort deterministically`() {
        val table = accessibleTableFixture()
        val sorted = AccessibleDashboardTables.view(
            table,
            sortKey = "state",
            sortDirection = AccessibleTableSortDirection.ASCENDING,
        )
        assertEquals(listOf("row-c", "row-a", "row-b"), sorted.rows.map { it.id })

        val filtered = AccessibleDashboardTables.view(
            table,
            filter = "PENDING",
            sortKey = "name",
            sortDirection = AccessibleTableSortDirection.DESCENDING,
        )
        assertEquals(listOf("row-b", "row-a"), filtered.rows.map { it.id })
        assertFailsWith<IllegalArgumentException> {
            AccessibleDashboardTables.view(table, filter = "x".repeat(257))
        }
        assertFailsWith<IllegalArgumentException> {
            AccessibleDashboardTables.view(
                table,
                sortKey = "hidden",
                sortDirection = AccessibleTableSortDirection.ASCENDING,
            )
        }
    }

    @Test
    fun `accessible metadata CSV exports only filtered rows and neutralizes formulas`() {
        val view = AccessibleDashboardTables.view(accessibleTableFixture(), filter = "SUM")
        assertEquals("\"Name\",\"State\"\r\n\"'=SUM(A1:A2)\",\"complete\"", AccessibleDashboardTables.csv(view))
        assertFalse(AccessibleDashboardTables.csv(view).contains("Bravo"))
        assertFalse(AccessibleDashboardTables.csv(view).contains("omitted"))
        val rendered = AccessibleDashboardTables.render(view)
        assertTrue(rendered.contains("Showing 1 of 3 verified rows; 2 omitted upstream; source total 5."))
        assertTrue(rendered.contains("Boundary: table-does-not-authorize-run-or-effects"))
    }

    @Test
    fun `accessible metadata tables reject unreconciled totals and non-visible fields`() {
        val table = accessibleTableFixture()
        assertFailsWith<IllegalArgumentException> {
            AccessibleDashboardTables.exact(table.copy(total = 4))
        }
        assertFailsWith<IllegalArgumentException> {
            AccessibleDashboardTables.exact(
                table.copy(
                    rows = listOf(
                        AccessibleTableRow(
                            "row-a",
                            mapOf("name" to "Alpha", "state" to "pending", "secret" to "withheld"),
                        ),
                    ),
                    total = 3,
                    omitted = 2,
                ),
            )
        }
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
    fun `Initiative entry client preserves exact bindings and rejects hostile responses`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        assertFailsWith<IllegalArgumentException> {
            PortableDesignProtocol.initiativeClassificationInputToJson(
                initiativeClassificationInput().copy(sensitivities = listOf("none", "security")),
            )
        }
        assertFailsWith<IllegalArgumentException> {
            PortableDesignProtocol.initiativeClassificationInputToJson(
                initiativeClassificationInput().copy(owner = "token=PRIVATE-OAUTH-TOKEN"),
            )
        }
        assertFailsWith<IllegalArgumentException> {
            PortableDesignProtocol.initiativeApplicabilityInputToJson(
                initiativeApplicabilityInput().copy(
                    decisions = listOf(
                        initiativeApplicabilityInput().decisions.single().copy(
                            status = "conditionally-required",
                            conditions = emptyList(),
                        ),
                    ),
                ),
            )
        }
        val workspace = Files.createDirectory(temporaryRoot.resolve("initiative-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val controller = RiderProductController(client)
            val initial = controller.readInitiativeEntryContext(entryId)
            assertEquals(1, initial.initiative.revision)
            assertEquals("missing", initial.assessment.classification.status)
            assertEquals("missing", initial.assessment.classification.completeness.status)
            assertEquals("missing", initial.assessment.applicability.status)
            assertEquals("unavailable", initial.assessment.applicability.coverage.status)
            assertEquals("attention-required", initial.assessment.state)
            assertTrue(controller.renderInitiativeEntry(initial).contains("grants no approval, readiness"))

            val classified = client.classifyInitiative(entryId, 1, initiativeClassificationInput(), "founder.rider-entry")
            assertEquals(2, classified.revision)
            assertEquals("service", classified.classification?.primaryType)
            assertEquals("founder.rider-entry", classified.classification?.classifiedBy)
            val classifiedContext = controller.readInitiativeEntryContext(entryId)
            assertEquals("current", classifiedContext.assessment.classification.status)
            assertEquals("incomplete", classifiedContext.assessment.classification.completeness.status)
            assertEquals(1, classifiedContext.assessment.classification.completeness.unresolvedQuestionCount)
            assertEquals("missing", classifiedContext.assessment.applicability.status)
            assertEquals(49, classifiedContext.assessment.applicability.coverage.missingSubjectCount)

            val resolved = client.resolveInitiativeApplicability(
                entryId,
                2,
                initiativeApplicabilityInput(),
                "founder.rider-entry",
            )
            assertEquals(3, resolved.revision)
            assertEquals(1, resolved.applicability?.decisionCount)
            assertEquals(48, resolved.applicability?.unresolvedSubjectCount)
            assertEquals("current", resolved.applicability?.state)
            val finalContext = controller.readInitiativeEntryContext(entryId)
            assertEquals("current", finalContext.assessment.applicability.status)
            assertEquals(1, finalContext.assessment.applicability.pendingApprovalCount)
            assertEquals("complete", finalContext.assessment.applicability.coverage.status)
            assertEquals(49, finalContext.assessment.applicability.coverage.coveredSubjectCount)
            assertEquals(0, finalContext.assessment.applicability.coverage.missingSubjectCount)
            assertEquals("attention-required", finalContext.assessment.state)
            val rendered = controller.renderInitiativeEntry(finalContext)
            assertTrue(rendered.contains("Classification completeness: incomplete"))
            assertTrue(rendered.contains("Canonical subject coverage: 49/49"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            val reclassifiedView = controller.classifyInitiative(
                finalContext,
                initiativeClassificationInput().copy(
                    rationale = "The reviewed service classification changed after the applicability matrix was recorded.",
                ),
                "founder.rider-entry",
            )
            assertTrue(reclassifiedView.contains("Applicability: stale"))
            assertTrue(reclassifiedView.contains("Assessment: attention-required"))
        }
        assertFailsWith<IllegalArgumentException> {
            PortableDesignProtocol.completeInitiativeApplicabilityCoverage(
                initiativeApplicabilityInput().copy(
                    decisions = listOf(
                        initiativeApplicabilityInput().decisions.single().copy(
                            subject = InitiativeApplicabilitySubject(
                                "activity",
                                "non-canonical-review",
                                "Non-canonical review",
                            ),
                        ),
                    ),
                ),
                "founder.rider-entry",
            )
        }

        listOf("bad-initiative-private", "bad-entry-boundary", "bad-entry-policy", "bad-entry-coverage")
            .forEachIndexed { index, name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = if (index == 0) {
                    hostError { client.readInitiative(entryId) }
                } else {
                    hostError { client.assessInitiativeEntry(entryId) }
                }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-entry-product")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readInitiativeEntryContext(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
        listOf("bad-classification-binding", "bad-classification-content").forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError {
                    client.classifyInitiative(entryId, 1, initiativeClassificationInput(), "founder.rider-entry")
                }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        listOf("bad-applicability-binding", "bad-applicability-content").forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val classified = client.classifyInitiative(
                    entryId,
                    1,
                    initiativeClassificationInput(),
                    "founder.rider-entry",
                )
                val error = hostError {
                    client.resolveInitiativeApplicability(
                        entryId,
                        classified.revision,
                        initiativeApplicabilityInput(),
                        "founder.rider-entry",
                    )
                }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
    }

    @Test
    fun `Source governance projection is exact bounded private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("source-governance-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readSourceGovernance(entryId)
            assertEquals("ready", projection.assessmentState)
            assertEquals(1, projection.sourceCount)
            assertEquals(1, projection.baselineCount)
            assertEquals(1, projection.provenanceCount)
            assertEquals("Reviewed repository source", projection.sources.single().title)
            assertEquals("authoritative · product requirements", projection.sources.single().semanticAuthority)
            assertEquals("current", projection.baselines.single().assessmentStatus)
            assertEquals("governed-record", projection.provenance.single().targetKind)

            val rendered = RiderProductController(client).readSourceGovernance(entryId)
            assertTrue(rendered.contains("GAEP Source governance"))
            assertTrue(rendered.contains("1 Sources · 1 candidate Baselines · 1 Provenance records"))
            assertTrue(rendered.contains("grants no Baseline designation, approval, readiness"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
        }

        listOf("bad-source-snapshot-digest", "bad-source-snapshot-private").forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readSourceGovernance(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-source-snapshot-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readSourceGovernance(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Business Understanding projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("business-understanding-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readBusinessUnderstanding(entryId)
            assertEquals("complete-for-review", projection.assessmentState)
            assertEquals(3, projection.businessUnderstanding?.objectiveCount)
            assertEquals(8, projection.stakeholderModel?.stakeholderCount)
            assertEquals(1, projection.outcomeModel?.countermetricCount)

            val rendered = RiderProductController(client).readBusinessUnderstanding(entryId)
            assertTrue(rendered.contains("GAEP governed Business Understanding"))
            assertTrue(rendered.contains("3 objectives · 2 constraints · 1 assumptions"))
            assertTrue(rendered.contains("grants no approval, appointment, decision, readiness, or action authority"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("personalAssignment"))
        }

        listOf("bad-business-snapshot-digest", "bad-business-snapshot-private").forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readBusinessUnderstanding(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-business-snapshot-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readBusinessUnderstanding(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Business Capability Map projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("business-capability-map-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readBusinessCapabilityMap(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals(7, projection.capabilityMap?.capabilityCount)
            assertEquals(6, projection.capabilityMap?.ownedCapabilityCount)
            assertEquals(1, projection.capabilityMap?.criticalGapCount)

            val rendered = RiderProductController(client).readBusinessCapabilityMap(entryId)
            assertTrue(rendered.contains("GAEP governed Business Capability Map"))
            assertTrue(rendered.contains("7 capabilities · 6 owned · 2 open gaps"))
            assertTrue(rendered.contains("grants no priority approval, baseline, readiness, or action authority"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("capabilityNarrative"))
        }

        listOf("bad-capability-snapshot-digest", "bad-capability-snapshot-private").forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readBusinessCapabilityMap(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-capability-snapshot-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readBusinessCapabilityMap(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Value Stream Model projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("value-stream-model-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readValueStreamModel(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals(3, projection.valueStreamModel?.valueStreamCount)
            assertEquals(2, projection.valueStreamModel?.ownedValueStreamCount)
            assertEquals(1, projection.valueStreamModel?.criticalBottleneckCount)

            val rendered = RiderProductController(client).readValueStreamModel(entryId)
            assertTrue(rendered.contains("GAEP governed Value Stream Model"))
            assertTrue(rendered.contains("3 value streams · 2 owned · 9 stages"))
            assertTrue(rendered.contains("grants no baseline, priority, readiness, or action authority"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("valueStreamNarrative"))
        }

        listOf("bad-value-stream-snapshot-digest", "bad-value-stream-snapshot-private").forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readValueStreamModel(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-value-stream-snapshot-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readValueStreamModel(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Operating Model projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("operating-model-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readOperatingModel(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals(6, projection.operatingModel?.roleCount)
            assertEquals(8, projection.operatingModel?.decisionRightCount)
            assertEquals(3, projection.unfundedCapacityCount)

            val rendered = RiderProductController(client).readOperatingModel(entryId)
            assertTrue(rendered.contains("GAEP governed Operating Model"))
            assertTrue(rendered.contains("6 roles · 2 governance systems · 8 decision rights"))
            assertTrue(rendered.contains("grants no appointment, funding, baseline, readiness, or action authority"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("operatingNarrative"))
        }

        listOf("bad-operating-model-snapshot-digest", "bad-operating-model-snapshot-private").forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readOperatingModel(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-operating-model-snapshot-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readOperatingModel(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Business Rule Catalog projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("business-rule-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readBusinessRuleCatalog(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals(7, projection.businessRuleCatalog?.ruleCount)
            assertEquals(2, projection.businessRuleCatalog?.exceptionCount)
            assertEquals(2, projection.unverifiedEnforcementTargetCount)

            val rendered = RiderProductController(client).readBusinessRuleCatalog(entryId)
            assertTrue(rendered.contains("GAEP governed Business Rule Catalog"))
            assertTrue(rendered.contains("7 rules · 7 source-backed · 3 non-exceptionable"))
            assertTrue(rendered.contains("does not evaluate policy, grant exceptions, deploy enforcement"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("ruleNarrative"))
        }

        listOf("bad-business-rule-snapshot-digest", "bad-business-rule-snapshot-private").forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readBusinessRuleCatalog(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-business-rule-snapshot-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readBusinessRuleCatalog(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Business Architecture Baseline projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("business-architecture-baseline-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readBusinessArchitectureBaseline(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals(27, projection.baseline?.coveredElementCount)
            assertEquals(8, projection.baseline?.integrationClaimCount)
            assertEquals(2, projection.consistencyGapCount)

            val rendered = RiderProductController(client).readBusinessArchitectureBaseline(entryId)
            assertTrue(rendered.contains("GAEP governed Business Architecture Baseline candidate"))
            assertTrue(rendered.contains("27 covered · 25 included · 1 excluded · 1 unresolved"))
            assertTrue(rendered.contains("does not designate or approve a baseline, establish readiness"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("architectureNarrative"))
        }

        listOf(
            "bad-business-architecture-baseline-snapshot-digest",
            "bad-business-architecture-baseline-snapshot-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readBusinessArchitectureBaseline(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-business-architecture-baseline-snapshot-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readBusinessArchitectureBaseline(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `System Solution Architecture projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("system-solution-architecture-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readSystemSolutionArchitecture(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals(9, projection.architecture?.elementCount)
            assertEquals(5, projection.architecture?.qualityAttributeCount)
            assertEquals(2, projection.unresolvedDecisionCount)

            val rendered = RiderProductController(client).readSystemSolutionArchitecture(entryId)
            assertTrue(rendered.contains("GAEP governed System/Solution Architecture candidate"))
            assertTrue(rendered.contains("4 concerns · 3 views · 9 elements · 12 relations"))
            assertTrue(rendered.contains("does not designate or approve an architecture baseline, establish readiness"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("architectureNarrative"))
        }

        listOf(
            "bad-system-solution-architecture-snapshot-digest",
            "bad-system-solution-architecture-snapshot-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readSystemSolutionArchitecture(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-system-solution-architecture-snapshot-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readSystemSolutionArchitecture(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Bounded Context projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("bounded-context-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readBoundedContextModel(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals(3, projection.model?.boundedContextCount)
            assertEquals(4, projection.model?.contractCount)
            assertEquals(2, projection.unmappedCrossContextRelationCount)

            val rendered = RiderProductController(client).readBoundedContextModel(entryId)
            assertTrue(rendered.contains("GAEP governed Bounded Context and Ownership candidate"))
            assertTrue(rendered.contains("3 contexts · 1 core contexts · 11 language terms · 4 contracts · 3 relationships"))
            assertTrue(rendered.contains("does not appoint owners, accept ownership, approve boundaries or contracts"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("ubiquitousLanguage"))
        }

        listOf(
            "bad-bounded-context-snapshot-digest",
            "bad-bounded-context-snapshot-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readBoundedContextModel(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-bounded-context-snapshot-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readBoundedContextModel(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Security Privacy and Threat projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("security-privacy-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readSecurityPrivacyAssessment(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals(4, projection.assessment?.assetCount)
            assertEquals(6, projection.assessment?.controlCount)
            assertEquals(3, projection.unresolvedRequirementCount)

            val rendered = RiderProductController(client).readSecurityPrivacyAssessment(entryId)
            assertTrue(rendered.contains("GAEP governed Security, Privacy, and Threat Assessment candidate"))
            assertTrue(rendered.contains("4 assets · 5 actors · 3 trust boundaries · 2 data classes · 4 data flows · 6 controls · 7 threats"))
            assertTrue(rendered.contains("does not approve a threat model, attest control effectiveness, accept risk"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("threatScenario"))
        }

        listOf(
            "bad-security-privacy-snapshot-digest",
            "bad-security-privacy-snapshot-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readSecurityPrivacyAssessment(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-security-privacy-snapshot-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readSecurityPrivacyAssessment(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Process Model projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("process-model-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readProcessModel(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals(3, projection.model?.processCount)
            assertEquals(11, projection.model?.transitionCount)
            assertEquals(4, projection.unresolvedRequirementCount)

            val rendered = RiderProductController(client).readProcessModel(entryId)
            assertTrue(rendered.contains("GAEP governed Process Model candidate"))
            assertTrue(rendered.contains("3 processes · 9 steps · 5 state dimensions · 18 state values · 11 transitions · 8 events · 4 approval requirements"))
            assertTrue(rendered.contains("does not approve workflows, grant transition or execution authority"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("transitionGuard"))
        }

        listOf(
            "bad-process-model-snapshot-digest",
            "bad-process-model-snapshot-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readProcessModel(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-process-model-snapshot-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readProcessModel(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Data Model projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("data-model-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readDataModel(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals(6, projection.model?.entityCount)
            assertEquals(8, projection.model?.relationshipCount)
            assertEquals(4, projection.unresolvedRequirementCount)

            val rendered = RiderProductController(client).readDataModel(entryId)
            assertTrue(rendered.contains("GAEP governed Data Model candidate"))
            assertTrue(rendered.contains("6 entities · 24 attributes · 8 relationships · 6 lifecycles · 5 transformations"))
            assertTrue(rendered.contains("does not approve a data model or classification, appoint ownership"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("entityAttribute"))
        }

        listOf(
            "bad-data-model-snapshot-digest",
            "bad-data-model-snapshot-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readDataModel(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-data-model-snapshot-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readDataModel(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Authorization Model projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("authorization-model-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readAuthorizationModel(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals(5, projection.model?.principalCount)
            assertEquals(9, projection.model?.ruleCount)
            assertEquals(6, projection.unresolvedRequirementCount)

            val rendered = RiderProductController(client).readAuthorizationModel(entryId)
            assertTrue(rendered.contains("GAEP governed Authorization Model candidate"))
            assertTrue(rendered.contains("5 principals · 6 role assignments · 7 resources · 8 actions · 3 approval bindings · 9 rules"))
            assertTrue(rendered.contains("does not verify identity, approve role assignments or standing authority"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("principalIdentifier"))
        }

        listOf(
            "bad-authorization-model-snapshot-digest",
            "bad-authorization-model-snapshot-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readAuthorizationModel(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-authorization-model-snapshot-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readAuthorizationModel(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Event and Integration Model projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("event-integration-model-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readEventIntegrationModel(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals(10, projection.model?.eventTypeCount)
            assertEquals(7, projection.model?.routeCount)
            assertEquals(7, projection.unresolvedRequirementCount)

            val rendered = RiderProductController(client).readEventIntegrationModel(entryId)
            assertTrue(rendered.contains("GAEP governed Event and Integration Model candidate"))
            assertTrue(rendered.contains("10 event types · 11 commands · 4 adapters · 5 external contracts · 6 mappings · 7 routes"))
            assertTrue(rendered.contains("does not prove event occurrence, send or deliver commands"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("eventPayload"))
        }

        listOf(
            "bad-event-integration-model-snapshot-digest",
            "bad-event-integration-model-snapshot-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readEventIntegrationModel(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-event-integration-model-snapshot-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readEventIntegrationModel(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Failure and Recovery Model projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("failure-recovery-model-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readFailureRecoveryModel(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals(8, projection.model?.failureModeCount)
            assertEquals(4, projection.model?.recoveryPlanCount)
            assertEquals(6, projection.unresolvedRequirementCount)

            val rendered = RiderProductController(client).readFailureRecoveryModel(entryId)
            assertTrue(rendered.contains("GAEP governed Failure and Recovery Model candidate"))
            assertTrue(rendered.contains("8 failure modes · 6 retry policies · 5 compensation plans · 4 recovery plans · 3 recovery evidence definitions"))
            assertTrue(rendered.contains("does not prove failure occurrence, establish retry safety"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("recoveryEvidence"))
        }

        listOf(
            "bad-failure-recovery-model-snapshot-digest",
            "bad-failure-recovery-model-snapshot-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readFailureRecoveryModel(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-failure-recovery-model-snapshot-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readFailureRecoveryModel(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Architecture Challenge projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("architecture-challenge-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readArchitectureChallengeModel(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals(9, projection.model?.challengeSubjectCount)
            assertEquals(6, projection.model?.findingCount)
            assertEquals(1, projection.unrespondedFindingCount)

            val rendered = RiderProductController(client).readArchitectureChallengeModel(entryId)
            assertTrue(rendered.contains("GAEP governed Architecture Challenge candidate"))
            assertTrue(rendered.contains("9 challenge subjects · 7 assumptions · 4 alternatives · 6 findings · 5 responses"))
            assertTrue(rendered.contains("does not complete independent review"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("challengeContent"))
        }

        listOf(
            "bad-architecture-challenge-snapshot-digest",
            "bad-architecture-challenge-snapshot-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readArchitectureChallengeModel(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-architecture-challenge-snapshot-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readArchitectureChallengeModel(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Decision Register projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("decision-register-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readDecisionRegister(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals(7, projection.register?.decisionCount)
            assertEquals(2, projection.unresolvedDecisionCount)
            assertEquals(3, projection.selectedPendingDecisionCount)

            val rendered = RiderProductController(client).readDecisionRegister(entryId)
            assertTrue(rendered.contains("GAEP governed Decision Register candidate"))
            assertTrue(rendered.contains("2 unresolved decisions · 3 selected pending decisions · 1 deferred decisions"))
            assertTrue(rendered.contains("does not establish decision effectiveness"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("decisionQuestion"))
        }

        listOf(
            "bad-decision-register-snapshot-digest",
            "bad-decision-register-snapshot-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readDecisionRegister(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-decision-register-snapshot-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readDecisionRegister(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Risk Register projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("risk-register-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readRiskRegister(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals(9, projection.register?.riskCount)
            assertEquals(2, projection.notAssessedRiskCount)
            assertEquals(3, projection.unresolvedResidualRiskCount)
            assertEquals(4, projection.unverifiedControlCount)

            val rendered = RiderProductController(client).readRiskRegister(entryId)
            assertTrue(rendered.contains("GAEP governed Risk Register candidate"))
            assertTrue(rendered.contains("2 not assessed · 3 residual risks · 4 control effectiveness gaps"))
            assertTrue(rendered.contains("does not establish assessment fact"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("riskStatement"))
        }

        listOf(
            "bad-risk-register-snapshot-digest",
            "bad-risk-register-snapshot-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readRiskRegister(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-risk-register-snapshot-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readRiskRegister(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Evidence Registry projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("evidence-registry-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readEvidenceRegistry(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals(12, projection.registry?.claimCount)
            assertEquals(18, projection.registry?.evidenceItemCount)
            assertEquals(21, projection.registry?.linkCount)
            assertEquals(4, projection.staleOrUnknownEvidenceCount)

            val rendered = RiderProductController(client).readEvidenceRegistry(entryId)
            assertTrue(rendered.contains("GAEP governed Evidence Registry candidate"))
            assertTrue(rendered.contains("2 claims not assessed · 3 evidence items not assessed · 1 adverse dispositions pending"))
            assertTrue(rendered.contains("does not establish claim validation"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("claimStatement"))
        }

        listOf(
            "bad-evidence-registry-snapshot-digest",
            "bad-evidence-registry-snapshot-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readEvidenceRegistry(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-evidence-registry-snapshot-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readEvidenceRegistry(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `End to End Traceability projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("traceability-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readEndToEndTraceability(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals(44, projection.traceability?.nodeCount)
            assertEquals(12, projection.traceability?.relationshipCount)
            assertEquals(67, projection.traceability?.linkCount)
            assertEquals(5, projection.traceability?.transformationCount)
            assertEquals(1, projection.missingSpineCount)

            val rendered = RiderProductController(client).readEndToEndTraceability(entryId)
            assertTrue(rendered.contains("GAEP governed End-to-End Traceability candidate"))
            assertTrue(rendered.contains("2 unresolved endpoints · 6 semantic reviews pending · 1 missing spine segments"))
            assertTrue(rendered.contains("absence-of-a-trace-link-does-not-prove-absence-of-impact-or-relationship"))
            assertTrue(rendered.contains("does not establish relationship truth"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("linkRationale"))
        }

        listOf(
            "bad-traceability-snapshot-digest",
            "bad-traceability-snapshot-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readEndToEndTraceability(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-traceability-snapshot-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readEndToEndTraceability(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `P0 P4 Readiness Gate projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("readiness-gate-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readP0P4ReadinessGate(entryId)
            assertEquals("failed", projection.result)
            assertEquals(25, projection.gate?.outputCount)
            assertEquals(17, projection.satisfiedOutputCount)
            assertEquals(2, projection.unresolvedDecisionCount)
            assertEquals("a-passing-gate-is-an-evaluation-result-not-permission", projection.gateBoundary)

            val rendered = RiderProductController(client).readP0P4ReadinessGate(entryId)
            assertTrue(rendered.contains("GAEP governed P0-P4 Readiness Gate candidate"))
            assertTrue(rendered.contains("17/20 applicable satisfied · 4 candidate not applicable"))
            assertTrue(rendered.contains("1 adverse evidence · 1 stale bindings"))
            assertTrue(rendered.contains("evaluation result does not grant approval"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("waiverRationale"))
        }

        listOf(
            "bad-readiness-gate-snapshot-digest",
            "bad-readiness-gate-snapshot-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readP0P4ReadinessGate(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-readiness-gate-snapshot-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readP0P4ReadinessGate(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `P5 Handoff Package projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("p5-handoff-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readP5HandoffPackage(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals("incomplete", projection.readinessResult)
            assertEquals("held", projection.transferState)
            assertEquals(25, projection.handoff?.itemCount)
            assertEquals(66, projection.handoff?.requirementCount)
            assertEquals("disconnected", projection.handoff?.deliveryMode)

            val rendered = RiderProductController(client).readP5HandoffPackage(entryId)
            assertTrue(rendered.contains("GAEP governed P5 Handoff Package candidate"))
            assertTrue(rendered.contains("17 included · 3 exact references · 4 candidate not applicable · 1 unresolved"))
            assertTrue(rendered.contains("source ownership remains retained"))
            assertTrue(rendered.contains("complete for review is not acknowledgement"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("itemContent"))
        }

        listOf(
            "bad-p5-handoff-snapshot-digest",
            "bad-p5-handoff-snapshot-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readP5HandoffPackage(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-p5-handoff-snapshot-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readP5HandoffPackage(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Design Applicability projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("design-applicability-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readDesignApplicability(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals("held", projection.reviewState)
            assertEquals(2, projection.scopeCount)
            assertEquals(8, projection.decisionCount)
            assertEquals(2, projection.candidate?.scopeCount)

            val rendered = RiderProductController(client).readDesignApplicability(entryId)
            assertTrue(rendered.contains("GAEP governed Design Applicability candidate"))
            assertTrue(rendered.contains("2 scopes · 8 explicit UX, UI, design-work, and Figma decisions"))
            assertTrue(rendered.contains("silence is never not applicable"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("rationale"))
        }

        listOf(
            "bad-design-applicability-snapshot-digest",
            "bad-design-applicability-snapshot-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readDesignApplicability(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-design-applicability-snapshot-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readDesignApplicability(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Design Personas and Roles projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("design-persona-role-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readDesignPersonaRoleModel(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals("held", projection.reviewState)
            assertEquals(2, projection.personaCount)
            assertEquals(1, projection.designRoleCount)
            assertEquals(2, projection.candidate?.personaCount)

            val rendered = RiderProductController(client).readDesignPersonaRoleModel(entryId)
            assertTrue(rendered.contains("GAEP governed Design Personas and Roles candidate"))
            assertTrue(rendered.contains("2 personas · 1 design roles · 4/5 participant categories · 1/4 role kinds"))
            assertTrue(rendered.contains("no persona validation"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("personaBehavior"))
        }

        listOf(
            "bad-design-persona-role-snapshot-digest",
            "bad-design-persona-role-snapshot-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readDesignPersonaRoleModel(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-design-persona-role-snapshot-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readDesignPersonaRoleModel(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `User Journey projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("user-journey-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readUserJourneyModel(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals("held", projection.reviewState)
            assertEquals(2, projection.journeyCount)
            assertEquals(3, projection.touchpointCount)
            assertEquals(2, projection.failurePathCount)
            assertEquals(2, projection.recoveryPathCount)
            assertEquals(2, projection.candidate?.journeyCount)

            val rendered = RiderProductController(client).readUserJourneyModel(entryId)
            assertTrue(rendered.contains("GAEP governed User Journeys candidate"))
            assertTrue(rendered.contains("2 journeys · 3 touchpoints"))
            assertTrue(rendered.contains("2 primary · 2 success · 2 failure · 2 recovery"))
            assertTrue(rendered.contains("no observed-behavior proof"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("journeyStep"))
        }

        listOf(
            "bad-user-journey-snapshot-digest",
            "bad-user-journey-snapshot-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readUserJourneyModel(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-user-journey-snapshot-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readUserJourneyModel(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Information Architecture projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("information-architecture-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readInformationArchitectureModel(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals("held", projection.reviewState)
            assertEquals(6, projection.nodeCount)
            assertEquals(2, projection.rootNodeCount)
            assertEquals(8, projection.routeCount)
            assertEquals(6, projection.candidate?.nodeCount)

            val rendered = RiderProductController(client).readInformationArchitectureModel(entryId)
            assertTrue(rendered.contains("GAEP governed Information Architecture candidate"))
            assertTrue(rendered.contains("6 nodes · 2 roots · 8 routes"))
            assertTrue(rendered.contains("2 weak-evidence nodes · 1 weak-evidence routes"))
            assertTrue(rendered.contains("no findability"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("nodeLabel"))
        }

        listOf(
            "bad-information-architecture-snapshot-digest",
            "bad-information-architecture-snapshot-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readInformationArchitectureModel(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-information-architecture-snapshot-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readInformationArchitectureModel(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Screen and State Inventory projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("screen-state-inventory-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readScreenStateInventory(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals("held", projection.reviewState)
            assertEquals(3, projection.platformCount)
            assertEquals(9, projection.screenCount)
            assertEquals(18, projection.stateCount)
            assertEquals(5, projection.candidate?.variantCount)

            val rendered = RiderProductController(client).readScreenStateInventory(entryId)
            assertTrue(rendered.contains("GAEP governed Screen and State Inventory candidate"))
            assertTrue(rendered.contains("9 screens · 18 states · 5 variants"))
            assertTrue(rendered.contains("2 weak-evidence items"))
            assertTrue(rendered.contains("no UI completeness"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("screenLabel"))
        }

        listOf(
            "bad-screen-state-inventory-snapshot-digest",
            "bad-screen-state-inventory-snapshot-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readScreenStateInventory(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-screen-state-inventory-snapshot-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readScreenStateInventory(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Design Requirements projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("design-requirements-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readDesignRequirements(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals("held", projection.reviewState)
            assertEquals("not-assessed", projection.catalogCompletenessState)
            assertEquals(12, projection.requirementCount)
            assertEquals(5, projection.mustPriorityCount)
            assertEquals(4, projection.representedOutcomeCount)
            assertEquals(10, projection.candidate?.workItemCount)

            val rendered = RiderProductController(client).readDesignRequirements(entryId)
            assertTrue(rendered.contains("GAEP governed Design Requirements candidate"))
            assertTrue(rendered.contains("12 requirements · 5 must-priority · 10 Work Items"))
            assertTrue(rendered.contains("3 weak-evidence requirements"))
            assertTrue(rendered.contains("no requirement validity"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("requirementStatement"))
        }

        listOf(
            "bad-design-requirements-snapshot-digest",
            "bad-design-requirements-snapshot-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readDesignRequirements(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-design-requirements-snapshot-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readDesignRequirements(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Backlog Hierarchy projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("backlog-hierarchy-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readBacklogHierarchy(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals("held", projection.reviewState)
            assertEquals("not-assessed", projection.hierarchyCompletenessState)
            assertEquals(24, projection.nodeCount)
            assertEquals(2, projection.epicCount)
            assertEquals(5, projection.featureCount)
            assertEquals(8, projection.storyCount)
            assertEquals(9, projection.taskCount)
            assertEquals(17, projection.candidate?.requirementTraceCount)

            val rendered = RiderProductController(client).readBacklogHierarchy(entryId)
            assertTrue(rendered.contains("GAEP governed Backlog Hierarchy candidate"))
            assertTrue(rendered.contains("2 Epics · 5 Features · 8 Stories · 9 Tasks"))
            assertTrue(rendered.contains("1 untraced delivery nodes"))
            assertTrue(rendered.contains("no backlog objectives"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("workItemObjective"))
        }

        listOf(
            "bad-backlog-hierarchy-snapshot-digest",
            "bad-backlog-hierarchy-snapshot-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readBacklogHierarchy(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-backlog-hierarchy-snapshot-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readBacklogHierarchy(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `MVP and Vertical Slice projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("mvp-slice-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readMvpSliceDefinition(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals("held", projection.reviewState)
            assertEquals("not-assessed", projection.scopeCompletenessState)
            assertEquals(24, projection.scopeNodeCount)
            assertEquals(16, projection.mvpNodeCount)
            assertEquals(5, projection.laterNodeCount)
            assertEquals(3, projection.excludedNodeCount)
            assertEquals(4, projection.sliceCount)
            assertEquals(7, projection.storyCount)
            assertEquals(9, projection.taskCount)
            assertEquals(projection.hierarchyDigest, projection.candidate?.hierarchyDigest)

            val rendered = RiderProductController(client).readMvpSliceDefinition(entryId)
            assertTrue(rendered.contains("GAEP governed MVP and Vertical Slice candidate"))
            assertTrue(rendered.contains("24 nodes · 16 MVP · 5 later · 3 excluded"))
            assertTrue(rendered.contains("4 slices · 7 Stories · 9 Tasks"))
            assertTrue(rendered.contains("no slice titles"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("sliceRationale"))
        }

        listOf(
            "bad-mvp-slice-snapshot-digest",
            "bad-mvp-slice-snapshot-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readMvpSliceDefinition(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        listOf(
            "bad-mvp-slice-snapshot-binding",
            "bad-mvp-slice-hierarchy-binding",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readMvpSliceDefinition(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Prioritization Model projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("prioritization-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readPrioritizationModel(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals("held", projection.reviewState)
            assertEquals(4, projection.subjectCount)
            assertEquals(3, projection.scoredSubjectCount)
            assertEquals(1, projection.unassessedSubjectCount)
            assertEquals(12, projection.evidenceReferenceCount)
            assertEquals(1, projection.tieCount)

            val rendered = RiderProductController(client).readPrioritizationModel(entryId)
            assertTrue(rendered.contains("GAEP governed Prioritization Model candidate"))
            assertTrue(rendered.contains("4 slices · 3 scored · 1 unassessed · 12 evidence references"))
            assertTrue(rendered.contains("no dimension estimates"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("dimensionEstimate"))
        }

        listOf(
            "bad-prioritization-snapshot-digest",
            "bad-prioritization-snapshot-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readPrioritizationModel(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        listOf(
            "bad-prioritization-snapshot-binding",
            "bad-prioritization-mvp-binding",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readPrioritizationModel(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Acceptance Criteria projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("acceptance-criteria-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readAcceptanceCriteria(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals("held", projection.reviewState)
            assertEquals("not-assessed", projection.criterionSetCompletenessState)
            assertEquals("not-assessed", projection.requirementCoverageState)
            assertEquals(16, projection.subjectCount)
            assertEquals(15, projection.coveredSubjectCount)
            assertEquals(28, projection.criterionCount)
            assertEquals(26, projection.testableCriterionCount)
            assertEquals(34, projection.requirementTraceCount)
            assertEquals(5, projection.verificationMethodCount)

            val rendered = RiderProductController(client).readAcceptanceCriteria(entryId)
            assertTrue(rendered.contains("GAEP governed Acceptance Criteria candidate"))
            assertTrue(rendered.contains("16 Story/Task subjects · 15 covered · 1 uncovered · 28 criteria · 26 testable"))
            assertTrue(rendered.contains("no criterion text"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("criterionText"))
        }

        listOf(
            "bad-acceptance-criteria-snapshot-digest",
            "bad-acceptance-criteria-snapshot-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readAcceptanceCriteria(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        listOf(
            "bad-acceptance-criteria-snapshot-binding",
            "bad-acceptance-criteria-hierarchy-binding",
            "bad-acceptance-criteria-mvp-binding",
            "bad-acceptance-criteria-prioritization-binding",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readAcceptanceCriteria(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Definition of Ready projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("definition-of-ready-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readDefinitionOfReady(entryId)
            assertEquals("attention-required", projection.result)
            assertEquals("held", projection.reviewState)
            assertEquals(16, projection.subjectCount)
            assertEquals(9, projection.policyEntryCount)
            assertEquals(144, projection.expectedEvaluationCount)
            assertEquals(140, projection.evaluationCount)
            assertEquals(130, projection.candidateSatisfiedCount)
            assertEquals(12, projection.notApplicableCount)
            assertEquals(4, projection.missingEvaluationCount)

            val rendered = RiderProductController(client).readDefinitionOfReady(entryId)
            assertTrue(rendered.contains("GAEP governed Definition of Ready candidate"))
            assertTrue(rendered.contains("16 Story/Task subjects · 9 prerequisites · 140/144 evaluations · 4 missing"))
            assertTrue(rendered.contains("candidate pass is an evaluation result, not admission"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("itemEvaluations"))
        }

        listOf(
            "bad-definition-of-ready-snapshot-digest",
            "bad-definition-of-ready-snapshot-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readDefinitionOfReady(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        listOf(
            "bad-definition-of-ready-snapshot-binding",
            "bad-definition-of-ready-hierarchy-binding",
            "bad-definition-of-ready-mvp-binding",
            "bad-definition-of-ready-prioritization-binding",
            "bad-definition-of-ready-criteria-binding",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readDefinitionOfReady(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Design System and Token Contract projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("design-system-token-contract-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readDesignSystemTokenContract(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals("held", projection.reviewState)
            assertEquals("not-assessed", projection.catalogCompletenessState)
            assertEquals(2, projection.designSystemCount)
            assertEquals(48, projection.tokenCount)
            assertEquals(19, projection.variableCount)
            assertEquals(12, projection.componentCount)
            assertEquals(10, projection.candidate?.representedRequirementCount)

            val rendered = RiderProductController(client).readDesignSystemTokenContract(entryId)
            assertTrue(rendered.contains("GAEP governed Design System and Token Contract candidate"))
            assertTrue(rendered.contains("2 systems · 48 tokens · 3 collections · 19 variables · 12 components"))
            assertTrue(rendered.contains("4 accessibility review"))
            assertTrue(rendered.contains("no system, token, variable"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("tokenValue"))
        }

        listOf(
            "bad-design-system-token-contract-snapshot-digest",
            "bad-design-system-token-contract-snapshot-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readDesignSystemTokenContract(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-design-system-token-contract-snapshot-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readDesignSystemTokenContract(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Accessibility Design Rules projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("accessibility-design-rules-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readAccessibilityDesignRules(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals("held", projection.reviewState)
            assertEquals("not-assessed", projection.catalogCompletenessState)
            assertEquals(12, projection.targetCount)
            assertEquals(18, projection.ruleCount)
            assertEquals(24, projection.checkCount)
            assertEquals(17, projection.humanReviewedCheckCount)
            assertEquals(10, projection.candidate?.representedRequirementCount)

            val rendered = RiderProductController(client).readAccessibilityDesignRules(entryId)
            assertTrue(rendered.contains("GAEP governed Accessibility Design Rules candidate"))
            assertTrue(rendered.contains("12 targets · 18 rules · 24 checks"))
            assertTrue(rendered.contains("17 human-reviewed"))
            assertTrue(rendered.contains("no accessibility conformance"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("ruleProcedure"))
        }

        listOf(
            "bad-accessibility-design-rules-snapshot-digest",
            "bad-accessibility-design-rules-snapshot-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readAccessibilityDesignRules(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-accessibility-design-rules-snapshot-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readAccessibilityDesignRules(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Responsive and Multi Platform Targets projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("responsive-multi-platform-targets-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readResponsiveMultiPlatformTargets(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals("held", projection.reviewState)
            assertEquals("candidate-complete", projection.targetCatalogState)
            assertEquals("not-assessed", projection.breakpointCatalogState)
            assertEquals("not-assessed", projection.behaviorCatalogState)
            assertEquals(3, projection.platformTargetCount)
            assertEquals(5, projection.breakpointCount)
            assertEquals(14, projection.behaviorCount)
            assertEquals(22, projection.checkCount)
            assertEquals(17, projection.humanReviewedCheckCount)
            assertEquals(10, projection.candidate?.representedRequirementCount)

            val rendered = RiderProductController(client).readResponsiveMultiPlatformTargets(entryId)
            assertTrue(rendered.contains("GAEP governed Responsive and Multi-Platform Targets candidate"))
            assertTrue(rendered.contains("3 platform targets · 5 breakpoints · 14 behaviors · 22 checks"))
            assertTrue(rendered.contains("17 human-reviewed"))
            assertTrue(rendered.contains("no responsive completeness"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("behaviorProcedure"))
        }

        listOf(
            "bad-responsive-multi-platform-targets-snapshot-digest",
            "bad-responsive-multi-platform-targets-snapshot-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readResponsiveMultiPlatformTargets(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-responsive-multi-platform-targets-snapshot-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readResponsiveMultiPlatformTargets(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Manual Figma Execution Path projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("manual-figma-execution-path-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readManualFigmaExecutionPath(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals("held", projection.reviewState)
            assertEquals("candidate-complete", projection.guideCatalogState)
            assertEquals("candidate-complete", projection.handoffCatalogState)
            assertEquals("not-assessed", projection.returnContractState)
            assertEquals(3, projection.scopeCount)
            assertEquals(5, projection.instructionCount)
            assertEquals(24, projection.checkCount)
            assertEquals(19, projection.humanReviewedCheckCount)
            assertEquals(10, projection.candidate?.representedRequirementCount)

            val rendered = RiderProductController(client).readManualFigmaExecutionPath(entryId)
            assertTrue(rendered.contains("GAEP governed Manual Figma Execution Path candidate"))
            assertTrue(rendered.contains("3 scopes · 5 instruction stages · 24 checks"))
            assertTrue(rendered.contains("19 human-reviewed"))
            assertTrue(rendered.contains("no Figma connection"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("handoffContent"))
        }

        listOf(
            "bad-manual-figma-execution-path-snapshot-digest",
            "bad-manual-figma-execution-path-snapshot-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readManualFigmaExecutionPath(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-manual-figma-execution-path-snapshot-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readManualFigmaExecutionPath(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Figma MCP Capability Discovery projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("figma-mcp-capability-discovery-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readFigmaMcpCapabilityDiscovery(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals("held", projection.reviewState)
            assertEquals("candidate-observation-complete", projection.catalogState)
            assertEquals("candidate-separated", projection.permissionModelState)
            assertEquals("not-assessed", projection.limitCatalogState)
            assertEquals("not-assessed", projection.versionCatalogState)
            assertEquals(7, projection.toolCount)
            assertEquals(5, projection.advertisedToolCount)
            assertEquals(3, projection.readToolCount)
            assertEquals(2, projection.writeToolCount)
            assertEquals(4, projection.humanReviewedToolCount)
            assertEquals(7, projection.candidate?.toolCount)

            val rendered = RiderProductController(client).readFigmaMcpCapabilityDiscovery(entryId)
            assertTrue(rendered.contains("GAEP governed Figma MCP Capability Discovery candidate"))
            assertTrue(rendered.contains("7 tool observations · 5 advertised"))
            assertTrue(rendered.contains("4 human-reviewed"))
            assertTrue(rendered.contains("no Figma connection or call"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("toolNames"))
        }

        listOf(
            "bad-figma-mcp-capability-discovery-snapshot-digest",
            "bad-figma-mcp-capability-discovery-snapshot-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readFigmaMcpCapabilityDiscovery(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-figma-mcp-capability-discovery-snapshot-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readFigmaMcpCapabilityDiscovery(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Figma Read Snapshot projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("figma-read-snapshot-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readFigmaReadSnapshot(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals("held", projection.reviewState)
            assertEquals("partial", projection.snapshotCompletenessState)
            assertEquals("partial", projection.provenanceState)
            assertEquals(2, projection.fileCount)
            assertEquals(12, projection.componentCount)
            assertEquals(3, projection.variableCollectionCount)
            assertEquals(18, projection.variableCount)
            assertEquals(25, projection.humanReviewedItemCount)
            assertEquals(2, projection.candidate?.fileCount)

            val rendered = RiderProductController(client).readFigmaReadSnapshot(entryId)
            assertTrue(rendered.contains("GAEP governed Figma Read Snapshot candidate"))
            assertTrue(rendered.contains("2 files · 12 components · 3 variable collections · 18 variables"))
            assertTrue(rendered.contains("25 human-reviewed"))
            assertTrue(rendered.contains("no Figma connection or call"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("fileNames"))
        }

        listOf(
            "bad-figma-read-snapshot-digest",
            "bad-figma-read-snapshot-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readFigmaReadSnapshot(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-figma-read-snapshot-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readFigmaReadSnapshot(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Figma Context Import projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("figma-context-import-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readFigmaContextImport(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals("held", projection.reviewState)
            assertEquals("partial", projection.contextSelectionState)
            assertEquals("partial", projection.provenanceState)
            assertEquals("candidate-generated", projection.previewState)
            assertEquals(2, projection.contextPackCount)
            assertEquals(8, projection.sectionCount)
            assertEquals(24, projection.contextItemCount)
            assertEquals(2, projection.targetCount)
            assertEquals(5, projection.humanReviewedSectionCount)
            assertEquals(7, projection.representedRequirementCount)
            assertEquals(2, projection.candidate?.contextPackCount)

            val rendered = RiderProductController(client).readFigmaContextImport(entryId)
            assertTrue(rendered.contains("GAEP governed Figma Context Import candidate"))
            assertTrue(rendered.contains("2 Context Packs · 8 sections · 24 Context Items · 2 Figma targets"))
            assertTrue(rendered.contains("5 human-reviewed"))
            assertTrue(rendered.contains("no context packaging or transfer"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("contextItems"))
        }

        listOf(
            "bad-figma-context-import-digest",
            "bad-figma-context-import-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readFigmaContextImport(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-figma-context-import-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readFigmaContextImport(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Outbound Design Brief Package projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("outbound-design-brief-package-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readOutboundDesignBriefPackage(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals("held", projection.reviewState)
            assertEquals("partial", projection.manifestState)
            assertEquals("partial", projection.provenanceState)
            assertEquals("partial", projection.redactionReviewState)
            assertEquals("candidate-generated", projection.previewState)
            assertEquals(2, projection.contextPackCount)
            assertEquals(8, projection.entryCount)
            assertEquals(24, projection.contextItemCount)
            assertEquals(2, projection.recipientCount)
            assertEquals(5, projection.humanReviewedEntryCount)
            assertEquals(7, projection.representedRequirementCount)
            assertEquals("gaep-outbound-design-brief-package-v1", projection.candidate?.manifestFormat)

            val rendered = RiderProductController(client).readOutboundDesignBriefPackage(entryId)
            assertTrue(rendered.contains("GAEP governed Outbound Design Brief Package candidate"))
            assertTrue(rendered.contains("2 Context Packs · 8 entries · 24 Context Items · 2 recipients"))
            assertTrue(rendered.contains("5 human-reviewed"))
            assertTrue(rendered.contains("no package materialization or context transfer"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("entries="))
        }

        listOf(
            "bad-outbound-design-brief-package-digest",
            "bad-outbound-design-brief-package-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readOutboundDesignBriefPackage(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-outbound-design-brief-package-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readOutboundDesignBriefPackage(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Governed Figma Write projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("governed-figma-write-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readGovernedFigmaWrite(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals("held", projection.reviewState)
            assertEquals("held", projection.writePlanState)
            assertEquals("candidate-generated", projection.previewState)
            assertEquals("pending", projection.approvalState)
            assertEquals("missing", projection.permissionEvidenceState)
            assertEquals("defined", projection.idempotencyState)
            assertEquals("defined", projection.replayProtectionState)
            assertEquals("defined", projection.recoveryPlanState)
            assertEquals("not-performed", projection.writeExecutionState)
            assertEquals("not-recorded", projection.writeResultState)
            assertEquals(8, projection.selectedEntryCount)
            assertEquals("gaep-governed-figma-write-request-v1", projection.candidate?.requestFormat)
            assertEquals(2, projection.candidate?.outboundPackage?.revision)

            val rendered = RiderProductController(client).readGovernedFigmaWrite(entryId)
            assertTrue(rendered.contains("GAEP governed Figma Write authorization-review candidate"))
            assertTrue(rendered.contains("approval pending · permission evidence missing"))
            assertTrue(rendered.contains("8 selected entries"))
            assertTrue(rendered.contains("no package materialization or context transfer"))
            assertTrue(rendered.contains("permission grant"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("approvalActor="))
        }

        listOf(
            "bad-governed-figma-write-digest",
            "bad-governed-figma-write-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readGovernedFigmaWrite(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-governed-figma-write-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readGovernedFigmaWrite(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Finalized Figma Snapshot Import projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("finalized-figma-snapshot-import-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readFinalizedFigmaSnapshotImport(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals("held", projection.reviewState)
            assertEquals("missing", projection.returnAuthorizationState)
            assertEquals("partial", projection.reconciliationState)
            assertEquals("partial", projection.provenanceState)
            assertEquals("partial", projection.snapshotCompletenessState)
            assertEquals("not-performed", projection.importExecutionState)
            assertEquals("not-recorded", projection.importResultState)
            assertEquals(18, projection.itemCount)
            assertEquals(12, projection.humanReviewedItemCount)
            assertEquals(4, projection.sourceRecordedItemCount)
            assertEquals(2, projection.notAssessedItemCount)
            assertEquals(4, projection.candidate?.conflictCount)

            val rendered = RiderProductController(client).readFinalizedFigmaSnapshotImport(entryId)
            assertTrue(rendered.contains("GAEP finalized Figma Snapshot Import review candidate"))
            assertTrue(rendered.contains("return authorization missing"))
            assertTrue(rendered.contains("18 items · 4 conflicts"))
            assertTrue(rendered.contains("no content transfer or import"))
            assertTrue(rendered.contains("permission grant"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("authorizationActor="))
        }

        listOf(
            "bad-finalized-figma-snapshot-import-digest",
            "bad-finalized-figma-snapshot-import-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readFinalizedFigmaSnapshotImport(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-finalized-figma-snapshot-import-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readFinalizedFigmaSnapshotImport(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Design-to-Requirement Binding projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("design-to-requirement-binding-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readDesignToRequirementBinding(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals("held", projection.reviewState)
            assertEquals("partial", projection.reconciliationState)
            assertEquals("partial", projection.candidateCoverageState)
            assertEquals("exact", projection.provenanceState)
            assertEquals(7, projection.bindingCount)
            assertEquals(5, projection.humanReviewedBindingCount)
            assertEquals(4, projection.candidate?.designItemCoverageCount)
            assertEquals(5, projection.candidate?.subjectCoverageCount)
            assertEquals(3, projection.candidate?.conflictCount)

            val rendered = RiderProductController(client).readDesignToRequirementBinding(entryId)
            assertTrue(rendered.contains("GAEP Design-to-Requirement Binding review candidate"))
            assertTrue(rendered.contains("reconciliation partial"))
            assertTrue(rendered.contains("7 bindings · 4 design items · 5 governed subjects · 3 conflicts"))
            assertTrue(rendered.contains("no relationship-truth or coverage-completeness proof"))
            assertTrue(rendered.contains("permission grant"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("humanAttribution="))
        }

        listOf(
            "bad-design-to-requirement-binding-digest",
            "bad-design-to-requirement-binding-private",
        ).forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readDesignToRequirementBinding(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-design-to-requirement-binding-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readDesignToRequirementBinding(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Designer-Ready Gate projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("designer-ready-gate-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readDesignerReadyGate(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals("incomplete", projection.candidateResult)
            assertEquals("held", projection.reviewState)
            assertEquals(12, projection.prerequisiteCount)
            assertEquals(9, projection.satisfiedCount)
            assertEquals(10, projection.humanReviewedCount)
            assertEquals(12, projection.candidate?.prerequisiteCount)

            val rendered = RiderProductController(client).readDesignerReadyGate(entryId)
            assertTrue(rendered.contains("GAEP Designer-Ready Gate candidate"))
            assertTrue(rendered.contains("9 satisfied · 1 not-applicable candidates · 10/12 human-reviewed"))
            assertTrue(rendered.contains("12 exact"))
            assertTrue(rendered.contains("evaluation result, not permission or readiness"))
            assertTrue(rendered.contains("implementation, or action authority"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("criteria="))
        }

        listOf("bad-designer-ready-gate-digest", "bad-designer-ready-gate-private").forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readDesignerReadyGate(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-designer-ready-gate-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readDesignerReadyGate(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Design Delta projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("design-delta-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readDesignDelta(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals("conflict-candidate", projection.candidateResult)
            assertEquals("held", projection.reviewState)
            assertEquals(6, projection.deltaCount)
            assertEquals(1, projection.conflictingCount)
            assertEquals(3, projection.humanReviewedCount)
            assertEquals(6, projection.candidate?.deltaCount)

            val rendered = RiderProductController(client).readDesignDelta(entryId)
            assertTrue(rendered.contains("GAEP Design Delta candidate"))
            assertTrue(rendered.contains("12 source items · 14 target items · 6 deltas"))
            assertTrue(rendered.contains("2 added · 1 changed · 1 conflicting"))
            assertTrue(rendered.contains("comparison partial · provenance partial"))
            assertTrue(rendered.contains("no delta or external completeness"))
            assertTrue(rendered.contains("implementation, or action authority"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("deltaContent="))
        }

        listOf("bad-design-delta-digest", "bad-design-delta-private").forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readDesignDelta(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-design-delta-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readDesignDelta(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Design Conflict Resolution projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("design-conflict-resolution-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readDesignConflictResolution(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals("escalation-plan-candidate", projection.candidateResult)
            assertEquals("held", projection.reviewState)
            assertEquals(5, projection.conflictCount)
            assertEquals(4, projection.resolutionCount)
            assertEquals(1, projection.escalateCount)
            assertEquals(3, projection.humanReviewedCount)
            assertEquals(4, projection.candidate?.resolutionCount)

            val rendered = RiderProductController(client).readDesignConflictResolution(entryId)
            assertTrue(rendered.contains("GAEP Design Conflict Resolution candidate"))
            assertTrue(rendered.contains("5 conflicts · 4 resolution candidates"))
            assertTrue(rendered.contains("1 accept source · 1 accept target · 1 merge"))
            assertTrue(rendered.contains("separation of duties not enforced"))
            assertTrue(rendered.contains("does not enforce separation of duties"))
            assertTrue(rendered.contains("implementation or action authority"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("resolutionContent="))
        }

        listOf("bad-design-conflict-resolution-digest", "bad-design-conflict-resolution-private").forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readDesignConflictResolution(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-design-conflict-resolution-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readDesignConflictResolution(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Human Design Approval projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("human-design-approval-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readHumanDesignApproval(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals("approved-candidate", projection.candidateResult)
            assertEquals("recorded-human-decision", projection.reviewState)
            assertEquals(5, projection.prerequisiteCount)
            assertEquals(4, projection.completePrerequisiteCount)
            assertEquals(1, projection.approveCount)
            assertEquals("not-established", projection.approverAuthorityState)
            assertEquals(18, projection.candidate?.subject?.itemCount)

            val rendered = RiderProductController(client).readHumanDesignApproval(entryId)
            assertTrue(rendered.contains("GAEP Human Design Approval decision candidate"))
            assertTrue(rendered.contains("4/5 complete"))
            assertTrue(rendered.contains("1 approve · 0 reject"))
            assertTrue(rendered.contains("approver not-established · separation of duties not-established"))
            assertTrue(rendered.contains("does not verify approver authority"))
            assertTrue(rendered.contains("implementation or action authority"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("decisionRationale="))
        }

        listOf("bad-human-design-approval-digest", "bad-human-design-approval-private").forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readHumanDesignApproval(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-human-design-approval-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readHumanDesignApproval(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Design Baseline projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("design-baseline-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readDesignBaseline(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals("supersession-candidate", projection.candidateResult)
            assertEquals("ready-for-human-review", projection.reviewState)
            assertEquals(1, projection.candidateSetCount)
            assertEquals(1, projection.designationCandidateCount)
            assertEquals(1, projection.supersessionCandidateCount)
            assertEquals("not-established", projection.approvalDeterminationState)
            assertEquals("not-established", projection.baselineDesignationState)
            assertEquals("2.0.0", projection.candidate?.semanticVersion)
            assertEquals("supersede-baseline-candidate", projection.candidate?.designationKind)

            val rendered = RiderProductController(client).readDesignBaseline(entryId)
            assertTrue(rendered.contains("GAEP Design Baseline version candidate"))
            assertTrue(rendered.contains("1 set · 1 designation · 1 supersession"))
            assertTrue(rendered.contains("Version: 2.0.0"))
            assertTrue(rendered.contains("approval determination not-established · baseline designation not-established"))
            assertTrue(rendered.contains("does not convert an approval candidate into approval"))
            assertTrue(rendered.contains("implementation or action authority"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("designRationale="))
        }

        listOf("bad-design-baseline-digest", "bad-design-baseline-private").forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readDesignBaseline(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-design-baseline-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readDesignBaseline(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Design Drift Detection projection is exact private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("design-drift-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val projection = client.readDesignDriftDetection(entryId)
            assertEquals("attention-required", projection.assessmentState)
            assertEquals("incomplete", projection.candidateResult)
            assertEquals("held", projection.reviewState)
            assertEquals(5, projection.implementationTargetCount)
            assertEquals(9, projection.observationCount)
            assertEquals(4, projection.requirementToDesignCount)
            assertEquals(5, projection.designToImplementationCount)
            assertEquals(5, projection.driftCount)
            assertEquals(1, projection.blockerCount)
            assertEquals(4, projection.remediationCandidateCount)
            assertEquals("not-established", projection.candidate?.designBaseline?.baselineDesignationState)
            assertEquals(2, projection.candidate?.implementationTargetCatalogRevision)

            val rendered = RiderProductController(client).readDesignDriftDetection(entryId)
            assertTrue(rendered.contains("GAEP Design Drift Detection candidate"))
            assertTrue(rendered.contains("4 requirement-to-design · 5 design-to-implementation"))
            assertTrue(rendered.contains("3 conformant · 5 drift · 1 unassessed"))
            assertTrue(rendered.contains("4 candidates") || rendered.contains("4 recorded"))
            assertTrue(rendered.contains("does not establish an actual Baseline Set"))
            assertTrue(rendered.contains("grant action authority"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))
            assertFalse(rendered.contains("implementationContent="))
        }

        listOf("bad-design-drift-digest", "bad-design-drift-private").forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = hostError { client.readDesignDriftDetection(entryId) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
        Files.createDirectory(temporaryRoot.resolve("bad-design-drift-binding")).let { root ->
            GaepEngineClient(root, executable.toString()).use { client ->
                val error = assertFailsWith<IllegalArgumentException> {
                    RiderProductController(client).readDesignDriftDetection(entryId)
                }
                assertFalse(error.message.orEmpty().contains(privateRoot))
                assertFalse(error.message.orEmpty().contains(privateCredential))
            }
        }
    }

    @Test
    fun `Phase 2 UX Figma dashboard is exact accessible private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("phase2-dashboard-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val product = client.readProductBinding()
            val initiative = client.readInitiative(entryId)
            val dashboard = client.readPhase2UxFigmaDashboard(product, initiative)
            assertEquals(23, dashboard.sources.size)
            assertEquals("attention-required", dashboard.phaseState)
            assertEquals(23, dashboard.unavailableSourceCount)
            assertEquals("not-established", dashboard.figmaConnectionState)
            assertEquals("not-performed", dashboard.figmaWriteExecutionState)

            val controller = RiderProductController(client)
            val rendered = controller.readPhase2UxFigmaDashboard(entryId)
            assertTrue(rendered.contains("GAEP exact Phase 2 UX and Figma dashboard"))
            assertTrue(rendered.contains("23 unavailable · 23 expected"))
            assertTrue(rendered.contains("Product Owner acceptance: not established"))
            assertTrue(rendered.contains("grants no completeness, validity, approval, baseline"))
            assertFalse(rendered.contains("Founder Product"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))

            val tables = controller.readPhase2UxFigmaDashboardTables(entryId)
            assertEquals(listOf("phase2-summary", "phase2-sources"), tables.map { it.id })
            assertEquals(23, tables.last().rows.size)
            assertTrue(tables.all { it.snapshotDigest == dashboard.snapshotDigest })
            assertTrue(tables.all { it.authorityBoundary.contains("not-a-second-source-of-truth") })
        }

        listOf("bad-phase2-dashboard-catalog", "bad-phase2-dashboard-digest", "bad-phase2-dashboard-private").forEach { name ->
            val root = Files.createDirectory(temporaryRoot.resolve(name))
            GaepEngineClient(root, executable.toString()).use { client ->
                val product = client.readProductBinding()
                val initiative = client.readInitiative(entryId)
                val error = hostError { client.readPhase2UxFigmaDashboard(product, initiative) }
                assertEquals("HOST_RESPONSE_INVALID", error.kind)
                assertPrivateTextWithheld(error)
            }
        }
    }

    @Test
    fun `Phase 2 integrated dashboard is exact accessible private safe and non authorizing`() {
        val executable = createFakeEngineLauncher(temporaryRoot)
        val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
        val workspace = Files.createDirectory(temporaryRoot.resolve("phase2-integrated-workspace"))
        GaepEngineClient(workspace, executable.toString()).use { client ->
            val product = client.readProductBinding()
            val initiative = client.readInitiative(entryId)
            val dashboard = client.readPhase2ChangeImpactAgentModelDashboard(product, initiative)
            assertEquals("attention-required", dashboard.synchronization.state)
            assertEquals("current-bounded-observation", dashboard.impact.state)
            assertEquals(2, dashboard.capabilities.shown)
            assertEquals("not-granted", dashboard.runLaunchAuthority)
            assertEquals("not-established", dashboard.productOwnerAcceptance)

            val controller = RiderProductController(client)
            val rendered = controller.readPhase2ChangeImpactAgentModelDashboard(entryId)
            assertTrue(rendered.contains("GAEP exact Phase 2 Change, Impact, Agent and Model dashboard"))
            assertTrue(rendered.contains("Synchronization: attention-required"))
            assertTrue(rendered.contains("Impact boundary: bounded-not-complete"))
            assertTrue(rendered.contains("Capabilities: 2/2 shown"))
            assertTrue(rendered.contains("Runs: 0/0 shown"))
            assertTrue(rendered.contains("not a second source of truth"))
            assertFalse(rendered.contains("Founder Product"))
            assertFalse(rendered.contains(privateRoot))
            assertFalse(rendered.contains(privateCredential))

            val tables = controller.readPhase2ChangeImpactAgentModelDashboardTables(entryId)
            assertEquals(
                listOf("phase2-synchronization-change", "phase2-bounded-impact", "phase2-agent-model-execution"),
                tables.map { it.id },
            )
            assertTrue(tables.all { it.snapshotDigest == dashboard.snapshotDigest })
            assertTrue(tables.all { it.authorityBoundary.contains("not-a-second-source-of-truth") })
        }

        listOf("bad-phase2-integrated-binding", "bad-phase2-integrated-digest", "bad-phase2-integrated-private")
            .forEach { name ->
                val root = Files.createDirectory(temporaryRoot.resolve(name))
                GaepEngineClient(root, executable.toString()).use { client ->
                    val product = client.readProductBinding()
                    val initiative = client.readInitiative(entryId)
                    val error = hostError { client.readPhase2ChangeImpactAgentModelDashboard(product, initiative) }
                    assertEquals("HOST_RESPONSE_INVALID", error.kind)
                    assertPrivateTextWithheld(error)
                }
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
        val badDashboardEvidenceCuesRoot = Files.createDirectory(temporaryRoot.resolve("bad-dashboard-evidence-cues"))
        val badDashboardDigestRoot = Files.createDirectory(temporaryRoot.resolve("bad-dashboard-digest"))
        val badDashboardPrivateRoot = Files.createDirectory(temporaryRoot.resolve("bad-dashboard-private"))
        val badChangeCatalogBindingRoot = Files.createDirectory(temporaryRoot.resolve("bad-change-catalog-binding"))
        val badChangeCatalogDigestRoot = Files.createDirectory(temporaryRoot.resolve("bad-change-catalog-digest"))
        val badChangeCatalogPrivateRoot = Files.createDirectory(temporaryRoot.resolve("bad-change-catalog-private"))
        val badChangeImpactBindingRoot = Files.createDirectory(temporaryRoot.resolve("bad-change-impact-binding"))
        val badChangeImpactCountRoot = Files.createDirectory(temporaryRoot.resolve("bad-change-impact-count"))
        val badChangeImpactFreshnessRoot = Files.createDirectory(temporaryRoot.resolve("bad-change-impact-freshness"))
        val badChangeImpactEvidenceCuesRoot = Files.createDirectory(temporaryRoot.resolve("bad-change-impact-evidence-cues"))
        val badChangeImpactDigestRoot = Files.createDirectory(temporaryRoot.resolve("bad-change-impact-digest"))
        val badChangeImpactPrivateRoot = Files.createDirectory(temporaryRoot.resolve("bad-change-impact-private"))
        val badAgentModelBindingRoot = Files.createDirectory(temporaryRoot.resolve("bad-agent-model-binding"))
        val badAgentModelCountRoot = Files.createDirectory(temporaryRoot.resolve("bad-agent-model-count"))
        val badAgentModelFreshnessRoot = Files.createDirectory(temporaryRoot.resolve("bad-agent-model-freshness"))
        val badAgentModelEvidenceCuesRoot = Files.createDirectory(temporaryRoot.resolve("bad-agent-model-evidence-cues"))
        val badAgentModelMetricsRoot = Files.createDirectory(temporaryRoot.resolve("bad-agent-model-metrics"))
        val badAgentModelDigestRoot = Files.createDirectory(temporaryRoot.resolve("bad-agent-model-digest"))
        val badAgentModelPrivateRoot = Files.createDirectory(temporaryRoot.resolve("bad-agent-model-private"))
        val badPhase1AgentModelCountRoot = Files.createDirectory(temporaryRoot.resolve("bad-phase1-agent-model-count"))
        val badPhase1AgentModelDigestRoot = Files.createDirectory(temporaryRoot.resolve("bad-phase1-agent-model-digest"))
        val badPhase1AgentModelPrivateRoot = Files.createDirectory(temporaryRoot.resolve("bad-phase1-agent-model-private"))
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
            assertEquals("current", dashboard.evidenceCues.freshness)
            val dashboardView = RiderProductController(client).readPhaseDashboard()
            assertTrue(dashboardView.contains("GAEP phase-scoped dashboard framework"))
            assertTrue(dashboardView.contains("applicability=unknown (not-evaluated)"))
            assertTrue(dashboardView.contains("Confidence: not assessed"))
            assertTrue(dashboardView.contains("grants no mutation, applicability, phase-entry"))
            assertFalse(dashboardView.contains("Founder Product"))
            assertFalse(dashboardView.contains(privateRoot))
            assertFalse(dashboardView.contains(privateCredential))
            val phaseTables = RiderProductController(client).readPhaseDashboardTables()
            assertEquals(listOf("phase-panels"), phaseTables.map { it.id })
            assertEquals(3, phaseTables.single().rows.size)
            assertEquals(dashboard.compositionDigest, phaseTables.single().snapshotDigest)

            val entryId = UUID.fromString("22222222-2222-4222-8222-222222222222")
            val initiative = client.readInitiative(entryId)
            val phase1Summary = client.readPhase1Summary(product, initiative)
            assertEquals(entryId, phase1Summary.initiativeId)
            assertEquals("attention-required", phase1Summary.phaseState)
            assertEquals(2, phase1Summary.attentionSignalCount)
            assertEquals(0, phase1Summary.declaredGapCount)
            assertEquals("not-assessed", phase1Summary.readinessResult)
            val phase1View = RiderProductController(client).readPhase1Summary(entryId)
            assertTrue(phase1View.contains("GAEP exact Phase 1 summary and readiness dashboard"))
            assertTrue(phase1View.contains("Owners: unbound"))
            assertTrue(phase1View.contains("grants no readiness, approval, acceptance"))
            assertFalse(phase1View.contains("Founder Product"))
            assertFalse(phase1View.contains(privateRoot))
            assertFalse(phase1View.contains(privateCredential))

            listOf(
                badDashboardBindingRoot,
                badDashboardApplicabilityRoot,
                badDashboardEvidenceCuesRoot,
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
            val phase1ChangeImpact = client.readPhase1ChangeImpact(product, initiative, changeCatalog.items.single())
            assertEquals(25, phase1ChangeImpact.outputs.size)
            assertEquals(0, phase1ChangeImpact.currentTraceObservedOutputCount)
            assertEquals(0, phase1ChangeImpact.attentionRequiredOutputCount)
            assertEquals(25, phase1ChangeImpact.impactNotEstablishedOutputCount)
            assertTrue(phase1ChangeImpact.outputs.all { it.revalidationState == "not-established" })
            val phase1ChangeView = RiderProductController(client).readPhase1ChangeImpact(
                entryId,
                changeCatalog.items.single().recordId,
            )
            assertTrue(phase1ChangeView.contains("GAEP exact Phase 1 Change and impact dashboard"))
            assertTrue(phase1ChangeView.contains("25 impact not established"))
            assertTrue(phase1ChangeView.contains("Owners: unbound"))
            assertTrue(phase1ChangeView.contains("absence does not prove no impact"))
            assertFalse(phase1ChangeView.contains("Founder Product"))
            assertFalse(phase1ChangeView.contains("Private Change title"))
            assertFalse(phase1ChangeView.contains(privateRoot))
            assertFalse(phase1ChangeView.contains(privateCredential))
            val changeDashboard = client.readChangeImpact(product, changeCatalog.items.single())
            assertEquals(changeId, changeDashboard.change.recordId)
            assertEquals("current", changeDashboard.freshness.state)
            assertEquals("current", changeDashboard.evidenceCues.freshness)
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
            assertTrue(changeView.contains("Confidence: not assessed"))
            assertTrue(changeView.contains("absence of a trace link does not prove absence of impact"))
            assertTrue(changeView.contains("grants no Change approval, risk acceptance, mutation"))
            assertFalse(changeView.contains("Founder Product"))
            assertFalse(changeView.contains("Private Change title"))
            assertFalse(changeView.contains(privateRoot))
            assertFalse(changeView.contains(privateCredential))
            val changeTables = RiderProductController(client).readChangeImpactTables(
                changeContext,
                changeContext.catalog.items.single(),
            )
            assertEquals(
                listOf(
                    "change-work-items",
                    "changed-artifacts",
                    "effect-targets",
                    "affected-units",
                    "related-decisions",
                    "related-risks",
                ),
                changeTables.map { it.id },
            )
            assertTrue(changeTables.all { it.snapshotDigest == changeDashboard.snapshotDigest })

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
                badChangeImpactEvidenceCuesRoot,
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

            val agentModel = client.readAgentModel(product)
            assertEquals(product.digest, agentModel.productDigest)
            assertEquals(2, agentModel.capabilities.size)
            assertEquals("unselected", agentModel.selection.status)
            assertEquals("current", agentModel.freshness.state)
            assertEquals("current", agentModel.evidenceCues.freshness)
            assertEquals(2, agentModel.capabilityLimit.total)
            assertFalse(agentModel.truncated)
            assertTrue(agentModel.runs.isEmpty())
            assertTrue(agentModel.handoffs.isEmpty())
            assertFalse(Gson().toJson(agentModel).contains("Founder Product"))
            assertFalse(Gson().toJson(agentModel).contains(privateRoot))
            assertFalse(Gson().toJson(agentModel).contains(privateCredential))
            val agentModelView = RiderProductController(client).readAgentModel()
            assertTrue(agentModelView.contains("GAEP exact Agent and Model dashboard"))
            assertTrue(agentModelView.contains("Provider usage: unavailable"))
            assertTrue(agentModelView.contains("Confidence: not assessed"))
            assertTrue(agentModelView.contains("cannot select or switch an agent"))
            assertFalse(agentModelView.contains("Founder Product"))
            assertFalse(agentModelView.contains(privateRoot))
            assertFalse(agentModelView.contains(privateCredential))
            val agentModelTables = RiderProductController(client).readAgentModelTables()
            assertEquals(
                listOf("agent-capabilities", "agent-selection", "agent-runs", "agent-handoffs", "provider-metrics"),
                agentModelTables.map { it.id },
            )
            assertTrue(agentModelTables.all { it.snapshotDigest == agentModel.snapshotDigest })

            val phase1AgentModel = client.readPhase1AgentModel(product, initiative)
            assertEquals(initiative.id, phase1AgentModel.initiativeId)
            assertEquals(phase1AgentModel.agentModel.snapshotDigest, agentModel.snapshotDigest)
            assertEquals(2, phase1AgentModel.capabilities.total)
            assertEquals(1, phase1AgentModel.capabilities.detected)
            assertEquals(0, phase1AgentModel.runs.total)
            assertEquals("not-assessed", phase1AgentModel.liveProviderQuality)
            assertEquals("not-assessed", phase1AgentModel.semanticOutputQuality)
            assertEquals("not-established", phase1AgentModel.productOwnerAcceptance)
            assertFalse(Gson().toJson(phase1AgentModel).contains("Founder Product"))
            assertFalse(Gson().toJson(phase1AgentModel).contains(privateRoot))
            assertFalse(Gson().toJson(phase1AgentModel).contains(privateCredential))
            val phase1AgentModelView = RiderProductController(client).readPhase1AgentModel(entryId)
            assertTrue(phase1AgentModelView.contains("GAEP exact Phase 1 Agent and Model execution truth"))
            assertTrue(phase1AgentModelView.contains("Capabilities: 2/2 shown; 1 detected; 1 unavailable"))
            assertTrue(phase1AgentModelView.contains("Live provider quality: not-assessed"))
            assertTrue(phase1AgentModelView.contains("Product Owner acceptance: not-established"))
            assertTrue(phase1AgentModelView.contains("does not establish provider readiness or quality"))
            assertFalse(phase1AgentModelView.contains("Founder Product"))
            assertFalse(phase1AgentModelView.contains(privateRoot))
            assertFalse(phase1AgentModelView.contains(privateCredential))

            listOf(
                badPhase1AgentModelCountRoot,
                badPhase1AgentModelDigestRoot,
                badPhase1AgentModelPrivateRoot,
            ).forEach { root ->
                GaepEngineClient(root, executable.toString()).use { hostileClient ->
                    val hostileProduct = hostileClient.readProductBinding()
                    val hostileInitiative = hostileClient.readInitiative(entryId)
                    val invalidDashboard = hostError {
                        hostileClient.readPhase1AgentModel(hostileProduct, hostileInitiative)
                    }
                    assertEquals("HOST_RESPONSE_INVALID", invalidDashboard.kind)
                    assertPrivateTextWithheld(invalidDashboard)
                }
            }

            listOf(
                badAgentModelBindingRoot,
                badAgentModelCountRoot,
                badAgentModelFreshnessRoot,
                badAgentModelEvidenceCuesRoot,
                badAgentModelMetricsRoot,
                badAgentModelDigestRoot,
                badAgentModelPrivateRoot,
            ).forEach { root ->
                GaepEngineClient(root, executable.toString()).use { hostileClient ->
                    val hostileProduct = hostileClient.readProductBinding()
                    val invalidDashboard = hostError { hostileClient.readAgentModel(hostileProduct) }
                    assertEquals("HOST_RESPONSE_INVALID", invalidDashboard.kind)
                    assertPrivateTextWithheld(invalidDashboard)
                }
            }
            assertFailsWith<IllegalArgumentException> {
                client.readAgentModel(product.copy(digest = "sha256:not-a-digest"))
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

            val selectedAgentModel = client.readAgentModel(product)
            assertEquals("selected", selectedAgentModel.selection.status)
            assertEquals("stale", selectedAgentModel.selection.capabilityState)
            assertEquals("attention-required", selectedAgentModel.freshness.state)
            assertEquals(1, selectedAgentModel.capabilities.count { it.selected })
            assertFalse(Gson().toJson(selectedAgentModel).contains(privateRoot))
            assertFalse(Gson().toJson(selectedAgentModel).contains(privateCredential))

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
                productView, readinessView, agentModelView, selectedView, managedPreviewView, managedReceiptView,
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

    private fun initiativeClassificationInput() = InitiativeClassificationInput(
        primaryType = "service",
        secondaryTypes = listOf("api", "modernization"),
        systemState = "brownfield",
        changePosture = "modernization",
        motivations = listOf("business-driven", "technical"),
        characteristics = InitiativeClassificationCharacteristics(
            userInterface = "non-ui",
            data = "data-bearing",
            integration = "integration-heavy",
            interactionModes = listOf("synchronous", "asynchronous"),
            exposure = "partner",
        ),
        regulated = true,
        policyDomains = listOf("payments", "privacy"),
        sensitivities = listOf("security", "privacy", "data"),
        expectedLifetime = "long-lived",
        maintenanceHorizon = "Supported for at least five years after initial release",
        risk = InitiativeClassificationRisk(
            blastRadius = "multi-unit",
            reversibility = "partially-reversible",
            urgency = "high",
            costOfFailure = "high",
        ),
        dependencies = listOf("Existing identity service", "Partner API consumers"),
        affectedAssets = listOf("Payments API", "Settlement worker"),
        owner = "Payments engineering owner",
        accountableAuthority = "Payments Product Owner",
        confidence = InitiativeClassificationConfidence(
            "medium",
            "Repository evidence is current but partner scope awaits confirmation",
        ),
        evidence = listOf(InitiativeEntrySource("evidence", "GAEP-EVD-001")),
        unresolvedQuestions = listOf("Whether the legacy batch endpoint remains in scope"),
        rationale = "The initiative changes a brownfield service and its independently deployed API consumers.",
    )

    private fun initiativeApplicabilityInput() = InitiativeApplicabilityMatrixInput(
        decisions = listOf(
            InitiativeApplicabilityDecisionInput(
                subject = InitiativeApplicabilitySubject(
                    "test-method",
                    "consumer-contract-testing",
                    "Consumer contract testing",
                ),
                status = "required",
                rationale = "Independently deployed partner consumers require version-bound compatibility evidence.",
                sources = listOf(InitiativeEntrySource("policy", "GAEP-POL-CONTRACT-001")),
                owner = "Payments quality owner",
                accountableApprover = "Payments Product Owner",
                dependencies = listOf("partner-api-contract"),
                conditions = emptyList(),
                reviewTriggers = listOf("API contract or consumer inventory changes"),
                approval = InitiativeApplicabilityApproval("pending", emptyList()),
                relatedRecords = emptyList(),
                relatedImplementationUnits = listOf("payments-api"),
            ),
        ),
        unresolvedSubjects = emptyList(),
        subjectCatalog = InitiativeApplicabilitySubjectCatalogBinding(
            catalogVersion = "gaep-initiative-applicability-subjects-v1",
            digest = "sha256:${"f".repeat(64)}",
            subjectCount = 49,
        ),
    )

    private fun assertInvalidResponse(client: GaepEngineClient, id: UUID) {
        val error = hostError { client.readPortableDesignSnapshot(id) }
        assertEquals("HOST_RESPONSE_INVALID", error.kind)
        assertPrivateTextWithheld(error)
    }

    private fun accessibleTableFixture(): AccessibleMetadataTable = AccessibleDashboardTables.exact(
        AccessibleMetadataTable(
            id = "verified-runs",
            title = "Verified Runs",
            columns = listOf(
                AccessibleTableColumn("name", "Name"),
                AccessibleTableColumn("state", "State"),
            ),
            rows = listOf(
                AccessibleTableRow("row-b", mapOf("name" to "Bravo", "state" to "pending")),
                AccessibleTableRow("row-a", mapOf("name" to "Alpha", "state" to "pending")),
                AccessibleTableRow("row-c", mapOf("name" to "=SUM(A1:A2)", "state" to "complete")),
            ),
            total = 5,
            omitted = 2,
            snapshotDigest = "sha256:${"a".repeat(64)}",
            sourceBoundary = "already-verified-bounded-metadata-only",
            authorityBoundary = "table-does-not-authorize-run-or-effects",
        ),
    )

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
