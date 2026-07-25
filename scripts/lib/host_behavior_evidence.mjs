import { createHash } from "node:crypto"
import { execFile } from "node:child_process"
import { createReadStream } from "node:fs"
import { lstat, readFile, realpath } from "node:fs/promises"
import { isAbsolute, relative, resolve, sep } from "node:path"

const maximumSourceBytes = 8 * 1024 * 1024
const maximumPackageBytes = 128 * 1024 * 1024
const maximumProcessOutputBytes = 8 * 1024 * 1024
const expectedHostIds = ["kiro", "rider", "visual-studio", "vscode"]

const definitions = {
  vscode: {
    packageId: "gaep.gaep-vscode@0.1.0",
    artifactPath: "apps/vscode/dist/gaep-vscode.vsix",
    packagePlatforms: ["darwin", "linux", "win32"],
    runtimeLevel: "installed-package-bundled-engine-workflow-local",
    gatePaths: [
      "apps/vscode/test/e2e/run.mjs",
      "apps/vscode/test/e2e/suite/index.cjs",
      "apps/vscode/test/e2e/harness/extension.cjs",
      "apps/vscode/test/e2e/harness/package.json",
    ],
    commands: [{
      id: "installed-vsix-lifecycle-and-engine-workflow",
      executable: "npm",
      args: ["run", "test:vscode:extension-host"],
      timeoutMs: 240_000,
      requiredMarkers: [
        "PASS isolated VSIX previous-version install/upgrade/reinstall/rollback/uninstall/absence/final install",
        "PASS installed: exact VSIX activation, commands, views, Product Studio, bundled-engine empty recovery/evidence workflow, and no workspace mutation",
        "GAEP VS Code extension-host verification: PASS",
      ],
    }],
  },
  kiro: {
    packageId: "gaep.gaep-kiro@0.1.0",
    artifactPath: "apps/kiro/dist/gaep-kiro.vsix",
    packagePlatforms: ["darwin", "linux", "win32"],
    runtimeLevel: "compatible-host-packaged-engine-workflow-local",
    gatePaths: [
      "apps/kiro/package.json",
      "apps/kiro/test/e2e/run.mjs",
      "apps/kiro/test/e2e/suite/index.cjs",
      "apps/kiro/test/e2e/store-integrity.cjs",
      "apps/kiro/test/store-integrity.test.mjs",
      "apps/kiro/test/e2e/harness/extension.cjs",
      "apps/kiro/test/e2e/harness/package.json",
      "apps/kiro/test/verify-package.mjs",
      "apps/kiro/test/package-contract.test.mjs",
    ],
    commands: [{
      id: "compatible-host-vsix-lifecycle-and-engine-workflow",
      executable: "npm",
      args: ["run", "test:kiro:extension-host"],
      timeoutMs: 240_000,
      requiredMarkers: [
        "PASS exact bounded Kiro VSIX payload and built-byte parity",
        "PASS isolated compatible-host VSIX previous-version install/upgrade/reinstall/rollback/uninstall/absence/final install",
        "PASS installed compatible-host provider/model/dashboard smoke: two bounded capability rows, unselected model state, unavailable usage/cost, private-safe output, and immutable fixture store",
        "GAEP for Kiro exact installed VSIX activation smoke: PASS",
      ],
    }],
  },
  rider: {
    packageId: "dev.gaep.productstudio@0.1.0",
    artifactPath: "apps/rider/build/distributions/gaep-rider-0.1.0.zip",
    packagePlatforms: ["darwin", "linux", "win32"],
    runtimeLevel: "native-plugin-code-activation-startup-archive-install-and-packaged-engine-client-workflow-local",
    gatePaths: [
      "apps/rider/build.gradle.kts",
      "apps/rider/test/archive-install-smoke.mjs",
      "apps/rider/test/startup-smoke.mjs",
      "apps/rider/src/main/resources/META-INF/plugin.xml",
      "apps/rider/src/main/kotlin/dev/gaep/rider/GaepApplicationInitializedListener.kt",
      "apps/rider/src/test/kotlin/dev/gaep/rider/PortableDesignClientTest.kt",
      "apps/rider/src/test/kotlin/dev/gaep/rider/FakePortableDesignEngine.kt",
    ],
    commands: [
      {
        id: "clean-instrumented-package-and-client-workflow",
        executable: "npm",
        args: ["run", "test:rider:package"],
        timeoutMs: 300_000,
        requiredMarkers: [
          "BUILD SUCCESSFUL",
          "PASS exact Rider PluginInstaller archive install/removal/absence/reinstall: dev.gaep.productstudio@0.1.0",
        ],
      },
      {
        id: "bounded-native-rider-startup",
        executable: "npm",
        args: ["run", "test:rider:startup"],
        timeoutMs: 150_000,
        requiredMarkers: ["PASS bounded Rider 2025.3 sandbox startup and native plugin-code activation: dev.gaep.productstudio@0.1.0 loaded from exact isolated paths"],
      },
    ],
  },
  "visual-studio": {
    packageId: "Gaep.VisualStudio.90e45161-916c-4c39-b2bf-c2379c168fe9@0.1.0",
    artifactPath: "apps/visual-studio/Gaep.VisualStudio/bin/Release/net8.0-windows8.0/Gaep.VisualStudio.vsix",
    packagePlatforms: ["win32"],
    runtimeLevel: "cross-platform-packaged-engine-client-workflow-local",
    gatePaths: [
      "apps/visual-studio/verify-shell.mjs",
      "apps/visual-studio/Gaep.HostClient.Tests/Gaep.HostClient.Tests.csproj",
      "apps/visual-studio/Gaep.HostClient.Tests/Program.cs",
      "apps/visual-studio/Gaep.VisualStudio/Gaep.VisualStudio.csproj",
    ],
    commands: [{
      id: "cross-platform-hostclient-remote-ui-and-embedded-engine",
      executable: "npm",
      args: ["run", "test:visual-studio:host"],
      timeoutMs: 240_000,
      requiredMarkers: [
        "GAEP Visual Studio shell compile and generated-contribution verification: PASS",
        "GAEP Visual Studio packaged HostClient engine resource: PASS",
        "GAEP Visual Studio host-client tests: PASS (263)",
      ],
    }],
  },
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message)
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`
  }
  return JSON.stringify(value)
}

function digestValue(value) {
  return `sha256:${createHash("sha256").update(canonical(value)).digest("hex")}`
}

function within(root, candidate) {
  const path = relative(root, candidate)
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path))
}

async function repositoryFile(repositoryRoot, repositoryRelativePath, maximumBytes, label) {
  requireCondition(typeof repositoryRelativePath === "string" && repositoryRelativePath.length > 0 &&
    repositoryRelativePath.length <= 4096 && !isAbsolute(repositoryRelativePath), `${label} path is invalid`)
  const resolved = resolve(repositoryRoot, repositoryRelativePath)
  requireCondition(within(repositoryRoot, resolved), `${label} escaped the repository`)
  const canonicalPath = await realpath(resolved)
  requireCondition(within(repositoryRoot, canonicalPath), `${label} resolves outside the repository`)
  const metadata = await lstat(resolved)
  requireCondition(metadata.isFile() && !metadata.isSymbolicLink() && metadata.size > 0 && metadata.size <= maximumBytes,
    `${label} is not a bounded regular file`)
  return { resolved, metadata }
}

async function fileDigest(path) {
  const hash = createHash("sha256")
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return `sha256:${hash.digest("hex")}`
}

function publicDefinitions() {
  return Object.fromEntries(expectedHostIds.map((hostId) => {
    const definition = definitions[hostId]
    return [hostId, {
      packageId: definition.packageId,
      artifactPath: definition.artifactPath,
      packagePlatforms: definition.packagePlatforms,
      runtimeLevel: definition.runtimeLevel,
      gatePaths: definition.gatePaths,
      commands: definition.commands,
    }]
  }))
}

export function hostBehaviorDefinitionDigest() {
  return digestValue(publicDefinitions())
}

function contractHost(contract, hostId) {
  requireCondition(contract?.schemaVersion === 1 && contract.kind === "gaep-phase-0-ide-conformance-contract-v1" &&
    contract.phase === "phase-0-local" && Array.isArray(contract.hosts), "Host behavior contract identity is invalid")
  const matches = contract.hosts.filter((host) => host?.id === hostId)
  requireCondition(matches.length === 1, `Host behavior contract must contain exactly one ${hostId} host`)
  return matches[0]
}

export async function hostBehaviorSourceSnapshot({ repositoryRoot, contract, hostId }) {
  const definition = definitions[hostId]
  requireCondition(definition !== undefined, `Host behavior definition is missing for ${hostId}`)
  const host = contractHost(contract, hostId)
  const assessmentManifest = host.capabilityAssessments.map((assessment) => ({
    capabilityId: assessment.capabilityId,
    state: assessment.state,
    reason: assessment.reason,
    probes: assessment.probes ?? [],
  }))
  const paths = [...new Set([
    "scripts/lib/host_behavior_evidence.mjs",
    "scripts/run_host_behavior_evidence.mjs",
    ...definition.gatePaths,
    ...assessmentManifest.flatMap((assessment) => assessment.probes.map((probe) => probe.path)),
  ])].sort()
  requireCondition(paths.length > 0 && paths.length <= 256, `${hostId} behavior source inventory is missing or unbounded`)
  const files = []
  for (const path of paths) {
    const { resolved, metadata } = await repositoryFile(repositoryRoot, path, maximumSourceBytes, `${hostId} behavior source`)
    files.push({ path, bytes: metadata.size, digest: await fileDigest(resolved) })
  }
  return digestValue({ hostId, assessmentManifest, definition: publicDefinitions()[hostId], files })
}

function runCommand(repositoryRoot, hostId, command) {
  const executable = process.platform === "win32" && command.executable === "npm" ? "npm.cmd" : command.executable
  return new Promise((resolveCommand, rejectCommand) => {
    execFile(executable, command.args, {
      cwd: repositoryRoot,
      env: process.env,
      encoding: "utf8",
      timeout: command.timeoutMs,
      maxBuffer: maximumProcessOutputBytes,
      windowsHide: true,
    }, (error, stdout, stderr) => {
      if (error) {
        rejectCommand(new Error(`${hostId}/${command.id} behavioral gate failed`))
        return
      }
      const output = `${stdout}${stderr}`
      const missing = command.requiredMarkers.filter((marker) => !output.includes(marker))
      if (missing.length > 0) {
        rejectCommand(new Error(`${hostId}/${command.id} behavioral gate omitted ${missing.length} required marker(s)`))
        return
      }
      resolveCommand({
        id: command.id,
        result: "pass",
        requiredMarkersVerified: command.requiredMarkers.length,
      })
    })
  })
}

async function inspectPackage(repositoryRoot, hostId) {
  const definition = definitions[hostId]
  const requiredHere = definition.packagePlatforms.includes(process.platform)
  const resolved = resolve(repositoryRoot, definition.artifactPath)
  let metadata
  try {
    metadata = await lstat(resolved)
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT" && !requiredHere) {
      return { status: "not-produced-on-this-platform", artifactPath: definition.artifactPath }
    }
    throw error
  }
  requireCondition(metadata.isFile() && !metadata.isSymbolicLink() && metadata.size > 0 && metadata.size <= maximumPackageBytes,
    `${hostId} behavioral package is not a bounded regular file`)
  return {
    status: "produced",
    artifactPath: definition.artifactPath,
    bytes: metadata.size,
    digest: await fileDigest(resolved),
  }
}

export async function runHostBehaviorEvidence({ repositoryRoot, contract, recordedAt }) {
  requireCondition(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(recordedAt),
    "Host behavior recordedAt must be an exact UTC timestamp")
  const normalizedRoot = await realpath(resolve(repositoryRoot))
  const hosts = await Promise.all(expectedHostIds.map(async (hostId) => {
    const definition = definitions[hostId]
    const checks = []
    for (const command of definition.commands) checks.push(await runCommand(normalizedRoot, hostId, command))
    return {
      id: hostId,
      packageId: definition.packageId,
      runtimeLevel: definition.runtimeLevel,
      sourceSnapshotDigest: await hostBehaviorSourceSnapshot({ repositoryRoot: normalizedRoot, contract, hostId }),
      package: await inspectPackage(normalizedRoot, hostId),
      checks,
      result: "pass",
    }
  }))
  return {
    schemaVersion: 1,
    kind: "gaep-phase-0-host-behavior-evidence-v1",
    phase: "phase-0-local",
    recordedAt,
    definitionDigest: hostBehaviorDefinitionDigest(),
    hosts,
    claimBoundary: "This receipt proves only the exact local automated host gates, source snapshots, and package bytes recorded here. It is not native-host acceptance for unexecuted hosts, real-provider acceptance, supported-platform certification, Product readiness, release approval, or security review.",
  }
}

function exactKeys(value, keys, label) {
  requireCondition(value !== null && typeof value === "object" && !Array.isArray(value), `${label} must be an object`)
  requireCondition(canonical(Object.keys(value).sort()) === canonical([...keys].sort()), `${label} keys differ`)
}

export async function verifyHostBehaviorEvidence({ repositoryRoot, contract, receipt, hostId, packageState }) {
  exactKeys(receipt, ["schemaVersion", "kind", "phase", "recordedAt", "definitionDigest", "hosts", "claimBoundary"],
    "host behavior receipt")
  requireCondition(receipt.schemaVersion === 1 && receipt.kind === "gaep-phase-0-host-behavior-evidence-v1" &&
    receipt.phase === "phase-0-local" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(receipt.recordedAt) &&
    typeof receipt.claimBoundary === "string" && receipt.claimBoundary.length > 0,
  "Host behavior receipt identity is invalid")
  requireCondition(receipt.definitionDigest === hostBehaviorDefinitionDigest(), "Host behavior definition digest is stale")
  requireCondition(Array.isArray(receipt.hosts) && receipt.hosts.length === expectedHostIds.length &&
    canonical(receipt.hosts.map((host) => host?.id).sort()) === canonical(expectedHostIds),
  "Host behavior receipt host set is incomplete")
  const matches = receipt.hosts.filter((host) => host?.id === hostId)
  requireCondition(matches.length === 1, `Host behavior receipt must contain exactly one ${hostId} result`)
  const observed = matches[0]
  exactKeys(observed, ["id", "packageId", "runtimeLevel", "sourceSnapshotDigest", "package", "checks", "result"],
    `${hostId} behavior result`)
  const definition = definitions[hostId]
  const contractEntry = contractHost(contract, hostId)
  requireCondition(observed.packageId === definition.packageId && observed.packageId === contractEntry.packageId,
    `${hostId} behavior package identity differs`)
  requireCondition(observed.runtimeLevel === definition.runtimeLevel && observed.runtimeLevel === contractEntry.runtimeEvidence.level,
    `${hostId} behavior runtime level differs`)
  requireCondition(observed.sourceSnapshotDigest === await hostBehaviorSourceSnapshot({ repositoryRoot, contract, hostId }),
    `${hostId} behavior source snapshot is stale`)
  requireCondition(observed.result === "pass" && Array.isArray(observed.checks) &&
    observed.checks.length === definition.commands.length, `${hostId} behavior result is incomplete`)
  for (const [index, command] of definition.commands.entries()) {
    const check = observed.checks[index]
    exactKeys(check, ["id", "result", "requiredMarkersVerified"], `${hostId} behavior check ${index}`)
    requireCondition(check.id === command.id && check.result === "pass" &&
      check.requiredMarkersVerified === command.requiredMarkers.length, `${hostId}/${command.id} behavior check differs`)
  }
  const expectedPackageKeys = packageState.status === "produced"
    ? ["status", "artifactPath", "bytes", "digest"]
    : ["status", "artifactPath"]
  exactKeys(observed.package, expectedPackageKeys, `${hostId} behavior package`)
  requireCondition(observed.package.status === packageState.status &&
    observed.package.artifactPath === packageState.artifactPath, `${hostId} behavior package state differs`)
  if (packageState.status === "produced") {
    requireCondition(observed.package.bytes === packageState.bytes && observed.package.digest === packageState.digest,
      `${hostId} behavior package bytes are stale`)
  }
  return {
    source: contractEntry.runtimeEvidence.reportPath,
    level: observed.runtimeLevel,
    recordedAt: receipt.recordedAt,
    sourceSnapshotDigest: observed.sourceSnapshotDigest,
    checksPassed: observed.checks.length,
  }
}
