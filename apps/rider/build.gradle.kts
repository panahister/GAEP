plugins {
    id("org.jetbrains.kotlin.jvm") version "2.3.21"
    id("org.jetbrains.intellij.platform") version "2.18.1"
}

group = "dev.gaep"
version = "0.2.0"

// Local macOS acceptance uses the already-installed Rider instead of downloading a multi-gigabyte
// IDE again. CI leaves this unset and resolves the exact 2025.3 target installer for its own OS.
val localRiderPath = providers.environmentVariable("GAEP_RIDER_LOCAL_PATH").orNull

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
        jetbrainsRuntime()
    }
}

dependencies {
    intellijPlatform {
        if (localRiderPath != null) local(localRiderPath) else rider("2025.3")
    }
    // Unit tests for the pure request/validation logic (GaepRequests); run via `gradlew test`.
    testImplementation(kotlin("test"))
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_21)
    }
}

intellijPlatform {
    pluginConfiguration {
        name = "GAEP"
        version = project.version.toString()
        ideaVersion {
            sinceBuild = "253"
        }
        vendor {
            name = "GAEP"
        }
    }
    pluginVerification {
        ides {
            // Verify against exactly the platform used to compile/package this plugin. This avoids
            // a second recommended-IDE resolution and prevents non-Rider verification drift.
            if (localRiderPath != null) local(file(localRiderPath)) else current()
        }
    }
}

// GAEP-P0-CS02 — embed the digest-verified target-native Engine Host SEA into the plugin under
// `engine-host/` so EngineHostLocator launches only the bundled runtime (INV-21/22). The SEA is
// staged by CI into `build/gaep-engine-host/` (a `build` dir, excluded from source identity); it is
// never committed to `src`.
val gaepEngineHostDir = layout.buildDirectory.dir("gaep-engine-host")
tasks {
    prepareSandbox {
        from(gaepEngineHostDir) {
            into("${intellijPlatform.projectName.get()}/engine-host")
        }
    }
}
