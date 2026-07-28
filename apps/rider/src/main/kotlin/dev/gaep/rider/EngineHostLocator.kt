package dev.gaep.rider

import java.nio.file.Files
import java.nio.file.Path
import java.security.MessageDigest

/**
 * GAEP-P0-CS02 — resolve and digest-verify the bundled Engine Host SEA (INV-21/22).
 *
 * The plugin ships the per-OS/arch SEA (`linux-x64`, `darwin-arm64`, `win32-x64`). A production
 * plugin launches ONLY the bundled runtime after verifying its SHA-256 against the sibling
 * `engine-host.sha256`; it never resolves `gaep-engine` from PATH. A development override is honored
 * only when GAEP_DEV_ENGINE=1.
 */
object EngineHostLocator {
    fun resolveVerified(pluginPath: Path): String {
        val dev = if (System.getenv("GAEP_DEV_ENGINE") == "1") System.getenv("GAEP_ENGINE_EXECUTABLE") else null
        if (dev != null) return dev

        val osArch = detectTarget()
        val runtimeName = "gaep-engine-host-0.2.0-$osArch" + if (osArch == "win32-x64") ".exe" else ""
        val runtime = pluginPath.resolve("engine-host").resolve(runtimeName)
        val sidecar = pluginPath.resolve("engine-host").resolve("$runtimeName.sha256")
        if (!Files.exists(runtime)) error("engine-host-platform-unsupported: no bundled runtime for $osArch")
        if (!Files.exists(sidecar)) error("engine-host-integrity-failed: missing digest sidecar")

        val expected = sidecar.toFile().readText().trim().substringBefore(' ').let {
            if (it.startsWith("sha256:")) it else "sha256:$it"
        }
        val actual = "sha256:" + MessageDigest.getInstance("SHA-256")
            .digest(Files.readAllBytes(runtime))
            .joinToString("") { "%02x".format(it) }
        if (actual != expected) error("engine-host-integrity-failed: digest mismatch; refusing to start")
        return runtime.toAbsolutePath().toString()
    }

    fun detectTarget(): String {
        val os = System.getProperty("os.name").lowercase()
        val arch = System.getProperty("os.arch").lowercase()
        val x64 = arch == "amd64" || arch == "x86_64"
        val arm64 = arch == "aarch64" || arch == "arm64"
        if (os.contains("linux") && x64) return "linux-x64"
        if (os.contains("mac") && arm64) return "darwin-arm64"
        if (os.contains("win") && x64) return "win32-x64"
        error("engine-host-platform-unsupported: $os/$arch is not supported in CS02")
    }
}
