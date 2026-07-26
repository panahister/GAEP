package dev.gaep.rider

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * GAEP-P0-CS02 — unit tests for the pure Rider request/validation logic. Run in CI via gradle test;
 * they need no IntelliJ runtime.
 */
class GaepRequestsTest {
    @Test
    fun `select params carry the chosen provider and model`() {
        val params = GaepRequests.selectProviderModelParams("gaep.codex-cli", "gpt-5-codex")
        assertTrue(params.contains("\"adapterId\":\"gaep.codex-cli\""))
        assertTrue(params.contains("\"modelId\":\"gpt-5-codex\""))
    }

    @Test
    fun `start params require at least one Context Pack ID`() {
        assertFailsWith<IllegalArgumentException> {
            GaepRequests.startAnalysisParams("Summarize", emptyList())
        }
        assertFailsWith<IllegalArgumentException> {
            GaepRequests.startAnalysisParams("Summarize", listOf("   "))
        }
    }

    @Test
    fun `start params require a non-blank objective`() {
        assertFailsWith<IllegalArgumentException> {
            GaepRequests.startAnalysisParams("  ", listOf("11111111-1111-4111-8111-111111111111"))
        }
    }

    @Test
    fun `start params include the governed Context Pack IDs`() {
        val params = GaepRequests.startAnalysisParams(
            objective = "Summarize the governed context",
            contextPackIds = listOf("pack-a", "pack-b"),
            idempotencyKey = "key-1",
        )
        assertTrue(params.contains("\"contextPackIds\":[\"pack-a\",\"pack-b\"]"))
        assertTrue(params.contains("\"idempotencyKey\":\"key-1\""))
    }

    @Test
    fun `run id is captured from a start response`() {
        val runId = GaepRequests.extractRunId("{\"analysisRunId\":\"run-123\",\"state\":\"running\"}")
        assertEquals("run-123", runId)
        assertNull(GaepRequests.extractRunId("{\"state\":\"running\"}"))
    }

    @Test
    fun `provider and model IDs are parsed from a catalog payload`() {
        val catalog = "{\"providers\":[" +
            "{\"adapterId\":\"gaep.codex-cli\",\"models\":[{\"id\":\"gpt-5-codex\"}]}," +
            "{\"adapterId\":\"gaep.claude-code-cli\",\"models\":[{\"id\":\"sonnet\"},{\"id\":\"opus\"}]}]}"
        assertEquals(listOf("gaep.codex-cli", "gaep.claude-code-cli"), GaepRequests.parseProviderIds(catalog))
        assertEquals(listOf("sonnet", "opus"), GaepRequests.parseModelIds(catalog, "gaep.claude-code-cli"))
        assertEquals(listOf("gpt-5-codex"), GaepRequests.parseModelIds(catalog, "gaep.codex-cli"))
    }
}
