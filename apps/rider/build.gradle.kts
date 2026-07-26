plugins {
    id("org.jetbrains.kotlin.jvm") version "2.1.20"
    id("org.jetbrains.intellij.platform") version "2.18.1"
}

group = "dev.gaep"
version = "0.2.0"

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
        jetbrainsRuntime()
    }
}

dependencies {
    intellijPlatform {
        rider("2025.3") {
            useInstaller = false
        }
        jetbrainsRuntime()
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
            recommended()
        }
    }
}

// GAEP-P0-CS02 — embed the digest-verified linux-x64 Engine Host SEA into the plugin under
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
