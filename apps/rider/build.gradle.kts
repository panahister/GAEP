plugins {
    id("org.jetbrains.kotlin.jvm") version "2.1.20"
    id("org.jetbrains.intellij.platform") version "2.18.1"
}

group = "dev.gaep"
version = "0.1.0"

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
