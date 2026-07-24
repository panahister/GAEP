package dev.gaep.rider

import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.Path

internal object RiderPackagedEngineLocator {
    fun locate(pluginJar: Path = runningPluginJar()): PackagedEngineModule {
        val canonicalJar = pluginJar.toRealPath()
        check(Files.isRegularFile(canonicalJar, LinkOption.NOFOLLOW_LINKS)) {
            "The installed GAEP Rider plugin JAR could not be verified"
        }
        val pluginRoot = canonicalJar.parent?.parent
            ?: error("The installed GAEP Rider plugin root could not be verified")
        val module = pluginRoot.resolve("engine/gaep-engine.mjs").normalize()
        check(module.startsWith(pluginRoot) && Files.isRegularFile(module, LinkOption.NOFOLLOW_LINKS)) {
            "The package-local GAEP engine is missing from the installed Rider plugin"
        }
        return PackagedEngineModule(module, PackagedEngineBuild.SHA256)
    }

    private fun runningPluginJar(): Path = Path.of(
        RiderPackagedEngineLocator::class.java.protectionDomain.codeSource.location.toURI(),
    )
}

internal object RiderEngineClientFactory {
    fun create(
        workspace: Path,
        environment: Map<String, String> = System.getenv(),
        pluginJar: Path? = null,
    ): GaepEngineClient {
        val external = environmentValue(environment, "GAEP_ENGINE_EXECUTABLE")?.trim().orEmpty()
        if (external.isNotEmpty()) {
            return GaepEngineClient(
                workspace,
                external,
                expectedEngineSha256 = environmentValue(environment, "GAEP_ENGINE_SHA256"),
                sourceEnvironment = environment,
            )
        }

        val runtime = environmentValue(environment, "GAEP_ENGINE_RUNTIME_EXECUTABLE")?.trim().orEmpty()
        require(runtime.isNotEmpty() && Path.of(runtime).isAbsolute) {
            "Set GAEP_ENGINE_RUNTIME_EXECUTABLE to one absolute Node-compatible runtime before using the package-local Rider engine. PATH fallback is disabled."
        }
        return GaepEngineClient(
            workspace,
            runtime,
            expectedEngineSha256 = environmentValue(environment, "GAEP_ENGINE_RUNTIME_SHA256"),
            packagedEngineModule = if (pluginJar == null) {
                RiderPackagedEngineLocator.locate()
            } else {
                RiderPackagedEngineLocator.locate(pluginJar)
            },
            sourceEnvironment = environment,
        )
    }

    private fun environmentValue(source: Map<String, String>, requested: String): String? =
        source.entries.firstOrNull { it.key.equals(requested, ignoreCase = true) }?.value
}
