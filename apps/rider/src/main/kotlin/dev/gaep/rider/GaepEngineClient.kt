package dev.gaep.rider

import com.intellij.openapi.Disposable
import com.intellij.openapi.diagnostic.Logger
import java.io.BufferedReader
import java.io.BufferedWriter
import java.io.Closeable
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.nio.file.Path
import java.util.concurrent.atomic.AtomicLong

class GaepEngineClient(
    private val workspace: Path,
    private val engineExecutable: String = System.getenv("GAEP_ENGINE_EXECUTABLE") ?: "gaep-engine",
) : Closeable, Disposable {
    private val log = Logger.getInstance(GaepEngineClient::class.java)
    private val ids = AtomicLong(0)
    private var process: Process? = null
    private var reader: BufferedReader? = null
    private var writer: BufferedWriter? = null

    @Synchronized
    fun request(method: String, paramsJson: String = "{}"): String {
        ensureStarted()
        val id = ids.incrementAndGet()
        val request = """{"jsonrpc":"2.0","id":$id,"method":"${escape(method)}","params":$paramsJson}"""
        writer!!.apply {
            write(request)
            newLine()
            flush()
        }
        val response = reader!!.readLine() ?: error("GAEP engine closed before responding")
        if (!response.contains("\"id\":$id")) error("GAEP engine returned an unexpected response identity")
        return response
    }

    @Synchronized
    private fun ensureStarted() {
        if (process?.isAlive == true) return
        val started = ProcessBuilder(engineExecutable, "--workspace", workspace.toAbsolutePath().toString())
            .redirectError(ProcessBuilder.Redirect.INHERIT)
            .start()
        process = started
        reader = BufferedReader(InputStreamReader(started.inputStream, Charsets.UTF_8))
        writer = BufferedWriter(OutputStreamWriter(started.outputStream, Charsets.UTF_8))
        log.info("GAEP engine host started for $workspace")
    }

    override fun close() {
        writer?.close()
        reader?.close()
        process?.destroy()
        writer = null
        reader = null
        process = null
    }

    override fun dispose() = close()

    private fun escape(value: String): String = value
        .replace("\\", "\\\\")
        .replace("\"", "\\\"")
}
