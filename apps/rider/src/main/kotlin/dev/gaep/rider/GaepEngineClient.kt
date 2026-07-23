package dev.gaep.rider

import com.intellij.openapi.Disposable
import com.intellij.openapi.diagnostic.Logger
import java.io.BufferedWriter
import java.io.ByteArrayOutputStream
import java.io.Closeable
import java.io.InputStream
import java.io.OutputStream
import java.io.OutputStreamWriter
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.Path
import java.security.MessageDigest
import java.util.Locale
import java.util.concurrent.atomic.AtomicLong
import com.google.gson.JsonObject
import com.google.gson.JsonParser

class GaepEngineClient(
    private val workspace: Path,
    private val requestedEngineExecutable: String = System.getenv("GAEP_ENGINE_EXECUTABLE") ?: "gaep-engine",
    expectedEngineSha256: String? = System.getenv("GAEP_ENGINE_SHA256"),
) : Closeable, Disposable {
    private data class EngineIdentity(val path: Path, val digest: String)

    private val maxResponseFrameBytes = 1024 * 1024
    private val log = Logger.getInstance(GaepEngineClient::class.java)
    private val ids = AtomicLong(0)
    private val configuredEngineDigest = normalizeDigest(expectedEngineSha256)
    private val pendingResponse = ByteArrayOutputStream()
    private val responseBuffer = ByteArray(8192)
    private var process: Process? = null
    private var responseInput: InputStream? = null
    private var writer: BufferedWriter? = null
    private var boundEnginePath: Path? = null
    private var boundEngineDigest: String? = null

    @Synchronized
    fun request(method: String, paramsJson: String = "{}"): String {
        try {
            ensureStarted()
            val id = ids.incrementAndGet()
            val params = JsonParser.parseString(paramsJson)
            require(params.isJsonObject) { "GAEP engine request params must be a JSON object" }
            val request = JsonObject().apply {
                addProperty("jsonrpc", "2.0")
                addProperty("id", id)
                addProperty("method", method)
                add("params", params)
            }.toString()
            writer!!.apply {
                write(request)
                newLine()
                flush()
            }
            val response = readBoundedResponse()
            val envelope = JsonParser.parseString(response)
            require(envelope.isJsonObject) { "GAEP engine response must be a JSON object" }
            val responseId = envelope.asJsonObject.get("id")
            val numericId = responseId
                ?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isNumber }
                ?.let { runCatching { it.asBigDecimal }.getOrNull() }
            if (numericId == null || numericId.compareTo(java.math.BigDecimal.valueOf(id)) != 0) {
                error("GAEP engine returned an unexpected response identity")
            }
            return response
        } catch (error: Exception) {
            stopProcess()
            throw error
        }
    }

    @Synchronized
    private fun ensureStarted() {
        if (process?.isAlive == true) return
        stopProcess()
        val identity = resolveAndVerifyEngine()
        val started = ProcessBuilder(identity.path.toString(), "--workspace", workspace.toAbsolutePath().normalize().toString())
            .redirectError(ProcessBuilder.Redirect.PIPE)
            .start()
        try {
            Thread({
                started.errorStream.use { input -> input.transferTo(OutputStream.nullOutputStream()) }
            }, "gaep-engine-stderr-drain").apply {
                isDaemon = true
                start()
            }
            check(digest(identity.path) == identity.digest) {
                "The GAEP engine executable changed while the host process was starting"
            }
            process = started
            responseInput = started.inputStream
            writer = BufferedWriter(OutputStreamWriter(started.outputStream, Charsets.UTF_8))
            pendingResponse.reset()
            log.info("Verified GAEP engine host started for the selected workspace")
        } catch (error: Exception) {
            runCatching { started.outputStream.close() }
            runCatching { started.inputStream.close() }
            runCatching { started.errorStream.close() }
            runCatching { started.descendants().forEach { it.destroyForcibly() } }
            runCatching { started.destroyForcibly() }
            throw error
        }
    }

    private fun resolveAndVerifyEngine(): EngineIdentity {
        val path = resolveExecutable(requestedEngineExecutable)
        val digest = digest(path)
        check(configuredEngineDigest == null || configuredEngineDigest == digest) {
            "The GAEP engine executable does not match the configured SHA-256 digest"
        }
        check(boundEnginePath == null || samePath(boundEnginePath!!, path)) {
            "The resolved GAEP engine executable changed after this client was bound"
        }
        check(boundEngineDigest == null || boundEngineDigest == digest) {
            "The bound GAEP engine executable changed after this client was created"
        }
        if (boundEnginePath == null) boundEnginePath = path
        if (boundEngineDigest == null) boundEngineDigest = digest
        return EngineIdentity(path, digest)
    }

    private fun resolveExecutable(requested: String): Path {
        val raw = Path.of(requested)
        val candidates = if (raw.isAbsolute || raw.parent != null) {
            listOf(raw.toAbsolutePath().normalize())
        } else {
            val extensions = if (isWindows()) {
                (System.getenv("PATHEXT") ?: ".EXE;.CMD;.BAT").split(';').filter(String::isNotBlank)
            } else {
                listOf("")
            }
            (System.getenv("PATH") ?: "").split(java.io.File.pathSeparatorChar)
                .filter(String::isNotBlank)
                .flatMap { directory ->
                    extensions.map { extension ->
                        val name = if (requested.endsWith(extension, ignoreCase = true)) requested else requested + extension
                        Path.of(directory, name)
                    }
                }
        }
        val selected = candidates.firstOrNull { Files.isRegularFile(it, LinkOption.NOFOLLOW_LINKS) || Files.isSymbolicLink(it) }
            ?: error("The GAEP engine executable could not be resolved to an existing file")
        val canonical = selected.toRealPath()
        check(Files.isRegularFile(canonical, LinkOption.NOFOLLOW_LINKS)) {
            "The resolved GAEP engine executable is not a regular file"
        }
        return canonical
    }

    private fun digest(path: Path): String = Files.newInputStream(path).use { input ->
        val hasher = MessageDigest.getInstance("SHA-256")
        val buffer = ByteArray(8192)
        while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            if (read > 0) hasher.update(buffer, 0, read)
        }
        hasher.digest().joinToString("") { byte -> "%02x".format(byte.toInt() and 0xff) }
    }

    private fun readBoundedResponse(): String {
        while (true) {
            val buffered = pendingResponse.toByteArray()
            val newline = buffered.indexOf('\n'.code.toByte())
            if (newline >= 0) {
                check(newline <= maxResponseFrameBytes) { "GAEP engine response exceeds the configured byte limit" }
                val length = if (newline > 0 && buffered[newline - 1] == '\r'.code.toByte()) newline - 1 else newline
                val frame = buffered.copyOfRange(0, length)
                pendingResponse.reset()
                if (newline + 1 < buffered.size) pendingResponse.write(buffered, newline + 1, buffered.size - newline - 1)
                return Charsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(frame))
                    .toString()
            }
            check(buffered.size <= maxResponseFrameBytes) { "GAEP engine response exceeds the configured byte limit" }
            val read = responseInput!!.read(responseBuffer)
            check(read >= 0) { "GAEP engine closed before responding" }
            if (read > 0) pendingResponse.write(responseBuffer, 0, read)
        }
    }

    private fun stopProcess() {
        val currentWriter = writer
        val currentInput = responseInput
        val currentProcess = process
        writer = null
        responseInput = null
        process = null
        pendingResponse.reset()
        runCatching { currentWriter?.close() }
        runCatching { currentInput?.close() }
        currentProcess?.let { running ->
            runCatching { running.descendants().forEach { it.destroyForcibly() } }
            if (running.isAlive) runCatching { running.destroyForcibly() }
        }
    }

    override fun close() {
        stopProcess()
    }

    override fun dispose() = close()

    private fun normalizeDigest(value: String?): String? {
        if (value.isNullOrBlank()) return null
        val normalized = value.trim().lowercase(Locale.ROOT).removePrefix("sha256:")
        require(normalized.matches(Regex("[0-9a-f]{64}"))) {
            "Expected engine SHA-256 must contain exactly 64 hexadecimal characters"
        }
        return normalized
    }

    private fun samePath(left: Path, right: Path): Boolean = if (isWindows()) {
        left.toString().equals(right.toString(), ignoreCase = true)
    } else {
        left == right
    }

    private fun isWindows(): Boolean = System.getProperty("os.name").lowercase(Locale.ROOT).contains("win")
}
