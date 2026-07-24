package dev.gaep.rider

import com.google.gson.Gson
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.attribute.PosixFilePermission
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class PortableDesignClientTest {
    @TempDir
    lateinit var temporaryRoot: Path

    @Test
    fun `portable design client is bounded private and non-authoritative`() {
        val bundleRoot = Files.createDirectory(temporaryRoot.resolve("portable-bundle"))
        val invalidSourceRoot = Files.createDirectory(temporaryRoot.resolve("source-error"))
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

            val controller = RiderProductController(client)
            val productView = controller.readProduct()
            assertTrue(productView.contains("Founder Product"))
            assertTrue(productView.contains("Revision: 7"))
            val listView = controller.listPortableDesignSnapshots()
            assertTrue(listView.contains(bundleId.toString()))
            assertTrue(listView.contains("pending human review"))
            val readView = controller.readPortableDesignSnapshot(bundleId.toString())
            assertTrue(readView.contains("pending-human-review"))
            assertTrue(readView.contains("GAEP approval=false"))
            val importView = controller.importPortableDesignSnapshot(bundleRoot, "founder.review")
            assertTrue(importView.contains("exact Product revision 7"))
            assertTrue(importView.contains("not approval or a baseline"))
            listOf(productView, listView, readView, importView).forEach { rendered ->
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
