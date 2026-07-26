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
