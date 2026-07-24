import java.security.MessageDigest
import java.util.jar.JarFile
import java.util.zip.ZipFile
import org.gradle.api.DefaultTask
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.InputDirectory
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import org.jetbrains.intellij.platform.gradle.tasks.BuildPluginTask
import org.jetbrains.intellij.platform.gradle.tasks.PrepareSandboxTask

plugins {
    id("org.jetbrains.kotlin.jvm") version "2.1.20"
    id("org.jetbrains.intellij.platform") version "2.18.1"
}

abstract class VerifyInstalledSandboxTask : DefaultTask() {
    @get:InputFile
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val archiveFile: RegularFileProperty

    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val sandboxPluginDirectory: DirectoryProperty

    @get:Input
    abstract val expectedPluginId: Property<String>

    @get:Input
    abstract val expectedPluginVersion: Property<String>

    @get:Input
    abstract val expectedPluginDirectory: Property<String>

    @TaskAction
    fun verify() {
        val pluginVersion = expectedPluginVersion.get()
        val pluginDirectoryName = expectedPluginDirectory.get()
        val pluginJarName = "$pluginDirectoryName-$pluginVersion.jar"
        val archive = archiveFile.get().asFile
        val sandboxPlugin = sandboxPluginDirectory.get().asFile
        val sandboxJar = sandboxPlugin.resolve("lib/$pluginJarName")
        require(archive.isFile && archive.length() in 1..(64L * 1024 * 1024)) {
            "The Rider plugin archive is missing or outside its 64 MiB bound: ${archive.path}"
        }
        require(sandboxPlugin.isDirectory && sandboxJar.isFile && sandboxJar.length() in 1..(64L * 1024 * 1024)) {
            "The exact Rider plugin JAR is missing from the prepared sandbox: ${sandboxJar.path}"
        }

        val packagedJarBytes = ZipFile(archive).use { zip ->
            val entries = zip.entries().asSequence().toList()
            require(entries.size == 3) { "The Rider plugin archive must contain exactly two directories and one JAR" }
            require(entries.all { entry ->
                val segments = entry.name.split('/')
                !entry.name.startsWith('/') && !entry.name.contains('\\') && ".." !in segments
            }) { "The Rider plugin archive contains an unsafe entry path" }
            val expectedPath = "$pluginDirectoryName/lib/$pluginJarName"
            val jarEntry = zip.getEntry(expectedPath)
                ?: error("The Rider plugin archive does not contain $expectedPath")
            require(!jarEntry.isDirectory && jarEntry.size in 1..(64L * 1024 * 1024)) {
                "The packaged Rider plugin JAR is outside its 64 MiB bound"
            }
            zip.getInputStream(jarEntry).use { it.readBytes() }
        }
        val sandboxJarBytes = sandboxJar.readBytes()
        val packagedDigest = MessageDigest.getInstance("SHA-256").digest(packagedJarBytes)
        val sandboxDigest = MessageDigest.getInstance("SHA-256").digest(sandboxJarBytes)
        require(packagedDigest.contentEquals(sandboxDigest)) {
            "The packaged Rider plugin JAR does not match the prepared sandbox installation"
        }

        JarFile(sandboxJar).use { jar ->
            val descriptor = jar.getJarEntry("META-INF/plugin.xml")
                ?: error("The prepared sandbox plugin has no META-INF/plugin.xml")
            require(descriptor.size in 1..(64L * 1024)) { "The Rider plugin descriptor is outside its 64 KiB bound" }
            val xml = jar.getInputStream(descriptor).bufferedReader(Charsets.UTF_8).use { it.readText() }
            require("<id>${expectedPluginId.get()}</id>" in xml) {
                "The prepared sandbox plugin ID is not ${expectedPluginId.get()}"
            }
            require("<version>$pluginVersion</version>" in xml) {
                "The prepared sandbox plugin version is not $pluginVersion"
            }
            require("factoryClass=\"dev.gaep.rider.GaepToolWindowFactory\"" in xml) {
                "The prepared sandbox plugin does not declare the GAEP tool window factory"
            }
        }
        logger.lifecycle("PASS exact Rider package/prepared-sandbox parity: ${expectedPluginId.get()}@$pluginVersion")
    }
}

group = "dev.gaep"
version = "0.1.0"

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
        // The multi-OS Rider archive resolves the Java compiler used by the
        // mandatory instrumentation tasks from this dedicated repository.
        intellijDependencies()
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

val riderPluginVersion = version.toString()
val riderPluginId = "dev.gaep.productstudio"
val riderPluginDirectory = "gaep-rider"

tasks.register<VerifyInstalledSandboxTask>("verifyInstalledSandbox") {
    group = "verification"
    description = "Verifies that the packaged Rider plugin exactly matches the isolated prepared sandbox."
    dependsOn(tasks.named("buildPlugin"))

    val buildPlugin = tasks.named<BuildPluginTask>("buildPlugin")
    val prepareSandbox = tasks.named<PrepareSandboxTask>("prepareSandbox")
    archiveFile.set(buildPlugin.flatMap { it.archiveFile })
    sandboxPluginDirectory.set(prepareSandbox.flatMap { it.pluginDirectory })
    expectedPluginId.set(riderPluginId)
    expectedPluginVersion.set(riderPluginVersion)
    expectedPluginDirectory.set(riderPluginDirectory)
}
