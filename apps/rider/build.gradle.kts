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
    testImplementation(kotlin("test-junit5"))
    testRuntimeOnly("com.google.code.gson:gson:2.13.1")
    testRuntimeOnly("org.junit.jupiter:junit-jupiter-engine:5.11.4")
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

tasks.test {
    useJUnitPlatform()
    maxParallelForks = 1
    systemProperty("gaep.test.runtimeClasspath", sourceSets["test"].runtimeClasspath.asPath)
}
