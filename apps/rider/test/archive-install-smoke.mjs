import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { access, lstat, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises"
import { homedir, tmpdir } from "node:os"
import { delimiter, dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const execute = promisify(execFile)
const riderRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const archivePath = join(riderRoot, "build/distributions/gaep-rider-0.1.0.zip")
const preparedPluginPath = join(riderRoot, ".intellijPlatform/sandbox/gaep-rider/RD-2025.3/plugins/gaep-rider")
const expectedPluginRoot = "gaep-rider"
const expectedBuild = "253.28294.87"
const maximumPlatformCandidates = 20_000
const maximumFiles = 64
const maximumFileBytes = 64 * 1024 * 1024
const maximumPluginBytes = 72 * 1024 * 1024
const maximumProcessBytes = 1024 * 1024

function fail(message) {
  throw new Error(`Invalid Rider archive installation smoke: ${message}`)
}

function digest(content) {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`
}

function within(root, candidate) {
  const path = relative(root, candidate)
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path))
}

async function boundedRegularFile(path, label, maximumBytes = maximumFileBytes) {
  const before = await lstat(path)
  if (!before.isFile() || before.isSymbolicLink() || before.size < 1 || before.size > maximumBytes) {
    fail(`${label} must be a bounded regular file`)
  }
  const content = await readFile(path)
  const after = await lstat(path)
  if (!after.isFile() || after.isSymbolicLink() || before.dev !== after.dev || before.ino !== after.ino ||
      before.size !== after.size || before.mtimeMs !== after.mtimeMs || content.length !== after.size) {
    fail(`${label} changed while it was inspected`)
  }
  return content
}

async function discoverPlatformRoot() {
  const gradleRoot = resolve(process.env.GRADLE_USER_HOME || join(homedir(), ".gradle"))
  const caches = join(gradleRoot, "caches")
  const versions = (await readdir(caches, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && /^\d+(?:\.\d+)*$/u.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .reverse()
  let examined = 0
  for (const version of versions) {
    const transforms = join(caches, version, "transforms")
    let entries
    try {
      entries = await readdir(transforms, { withFileTypes: true })
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") continue
      throw error
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || ++examined > maximumPlatformCandidates) continue
      const candidate = join(transforms, entry.name, "transformed", "riderRD-2025.3")
      const productInfoPath = join(candidate, "product-info.json")
      try {
        const productInfo = JSON.parse((await boundedRegularFile(productInfoPath, "Rider product-info.json", 1024 * 1024)).toString("utf8"))
        if (productInfo.name !== "JetBrains Rider" || productInfo.version !== "2025.3" ||
            productInfo.buildNumber !== expectedBuild) continue
        const canonical = await realpath(candidate)
        if (!within(gradleRoot, canonical)) fail("Rider platform cache escaped the Gradle user directory")
        return canonical
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") continue
        if (error instanceof SyntaxError) continue
        throw error
      }
    }
  }
  fail(`Rider 2025.3 build ${expectedBuild} was not found in the bounded Gradle cache search`)
}

async function inspectPlugin(root, label) {
  const canonicalRoot = await realpath(root)
  const rootStat = await lstat(canonicalRoot)
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail(`${label} root must be a regular directory`)
  const files = []
  let byteCount = 0
  async function visit(directory, segments) {
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((left, right) => left.name.localeCompare(right.name))
    for (const entry of entries) {
      if (!entry.name || entry.name === "." || entry.name === ".." || entry.name.includes("/") || entry.name.includes("\\")) {
        fail(`${label} contains an invalid entry name`)
      }
      const child = join(directory, entry.name)
      const relativePath = [...segments, entry.name].join("/")
      const stat = await lstat(child)
      if (stat.isSymbolicLink()) fail(`${label}/${relativePath} must not be a symbolic link`)
      if (stat.isDirectory()) {
        await visit(child, [...segments, entry.name])
        continue
      }
      if (!stat.isFile() || files.length >= maximumFiles) fail(`${label} file inventory is invalid or unbounded`)
      const content = await boundedRegularFile(child, `${label}/${relativePath}`)
      byteCount += content.length
      if (byteCount > maximumPluginBytes) fail(`${label} exceeds its aggregate byte boundary`)
      files.push({ path: relativePath, bytes: content.length, digest: digest(content) })
    }
  }
  await visit(canonicalRoot, [])
  if (files.length !== 2 || files.map((entry) => entry.path).join(",") !==
      "engine/gaep-engine.mjs,lib/gaep-rider-0.1.0.jar") {
    fail(`${label} must contain the exact package-local engine and plugin JAR`)
  }
  return { files, byteCount, digest: digest(JSON.stringify({ files, byteCount })) }
}

const helperSource = `
import com.intellij.ide.plugins.PluginInstaller;
import java.nio.file.Files;
import java.nio.file.Path;

public final class GaepRiderArchiveInstaller {
  public static void main(String[] args) throws Exception {
    if (args.length != 2) throw new IllegalArgumentException("archive and plugins directory are required");
    Path archive = Path.of(args[0]).toRealPath();
    Path plugins = Path.of(args[1]).toAbsolutePath().normalize();
    Files.createDirectories(plugins);
    String root = PluginInstaller.rootEntryName(archive);
    Path installed = PluginInstaller.unpackPlugin(archive, plugins).toRealPath();
    System.out.println("GAEP_ROOT=" + root);
    System.out.println("GAEP_INSTALLED=" + installed);
  }
}
`.trimStart()

async function runInstaller({ platformRoot, classes, source, plugins }) {
  const classpath = `${classes}${delimiter}${join(platformRoot, "lib", "*")}`
  await execute("javac", ["--release", "21", "-cp", join(platformRoot, "lib", "*"), "-d", classes, source], {
    timeout: 60_000,
    maxBuffer: maximumProcessBytes,
  })
  const result = await execute("java", ["-cp", classpath, "GaepRiderArchiveInstaller", archivePath, plugins], {
    timeout: 60_000,
    maxBuffer: maximumProcessBytes,
  })
  const root = result.stdout.match(/^GAEP_ROOT=(.+)$/mu)?.[1]
  const installed = result.stdout.match(/^GAEP_INSTALLED=(.+)$/mu)?.[1]
  if (root !== expectedPluginRoot || !installed) fail("JetBrains PluginInstaller returned an unexpected plugin root")
  const canonicalPlugins = await realpath(plugins)
  const canonicalInstalled = await realpath(installed)
  if (!within(canonicalPlugins, canonicalInstalled) || dirname(canonicalInstalled) !== canonicalPlugins ||
      canonicalInstalled !== join(canonicalPlugins, expectedPluginRoot)) {
    fail("JetBrains PluginInstaller installed outside the exact isolated plugin directory")
  }
  return canonicalInstalled
}

const temporaryRoot = await mkdtemp(join(tmpdir(), "gaep-rider-archive-install-"))
try {
  const archive = await boundedRegularFile(archivePath, "Rider plugin archive")
  const platformRoot = await discoverPlatformRoot()
  const classes = join(temporaryRoot, "classes")
  const source = join(temporaryRoot, "GaepRiderArchiveInstaller.java")
  const plugins = join(temporaryRoot, "plugins")
  await writeFile(source, helperSource, { encoding: "utf8", flag: "wx", mode: 0o600 })

  const prepared = await inspectPlugin(preparedPluginPath, "prepared sandbox plugin")
  const firstPath = await runInstaller({ platformRoot, classes, source, plugins })
  const first = await inspectPlugin(firstPath, "first archive installation")
  if (JSON.stringify(first) !== JSON.stringify(prepared)) fail("first archive installation differs from the prepared sandbox bytes")

  await rm(firstPath, { recursive: true, force: false })
  await access(firstPath).then(
    () => fail("isolated plugin remained after explicit test removal"),
    (error) => { if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error },
  )
  const secondPath = await runInstaller({ platformRoot, classes, source, plugins })
  const second = await inspectPlugin(secondPath, "second archive installation")
  if (JSON.stringify(second) !== JSON.stringify(first)) fail("reinstalled archive bytes differ from the first installation")

  process.stdout.write(
    `PASS exact Rider PluginInstaller archive install/removal/absence/reinstall: dev.gaep.productstudio@0.1.0 ${archive.length} bytes ${digest(archive)}\n`,
  )
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}
