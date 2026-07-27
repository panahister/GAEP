import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { lstat, writeFile } from "node:fs/promises"
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
let outputPath
if (process.argv.length > 2) {
  if (process.argv.length !== 4 || process.argv[2] !== "--output") throw new Error("Usage: report_local_packages.mjs [--output <repository-relative-path>]")
  outputPath = resolve(repositoryRoot, process.argv[3])
  const outputRelative = relative(repositoryRoot, outputPath)
  if (outputRelative === "" || outputRelative === ".." || outputRelative.startsWith(`..${sep}`) || isAbsolute(outputRelative)) {
    throw new Error("Local package report output must stay inside the repository")
  }
}

const definitions = [
  {
    host: "vscode",
    packageId: "gaep.gaep-vscode@0.1.0",
    path: "apps/vscode/dist/gaep-vscode.vsix",
    maximumBytes: 32 * 1024 * 1024,
    requiredHere: true,
    verification: "exact-isolated-fixture-upgrade-reinstall-rollback-uninstall-absence-final-install-activation-and-bundled-engine-empty-recovery-evidence-workflow",
  },
  {
    host: "kiro",
    packageId: "gaep.gaep-kiro@0.1.0",
    path: "apps/kiro/dist/gaep-kiro.vsix",
    maximumBytes: 8 * 1024 * 1024,
    requiredHere: true,
    verification: "exact-isolated-compatible-host-fixture-upgrade-reinstall-rollback-uninstall-absence-final-install-activation-digest-bound-package-local-provider-model-dashboard-and-empty-evidence-workflows-with-private-safe-output-and-immutable-store",
  },
  {
    host: "rider",
    packageId: "dev.gaep.productstudio@0.1.0",
    path: "apps/rider/build/distributions/gaep-rider-0.1.0.zip",
    maximumBytes: 64 * 1024 * 1024,
    requiredHere: true,
    verification: "clean-test-instrumentation-build-exact-engine-and-jar-archive-prepared-sandbox-parity-jetbrains-plugininstaller-install-removal-absence-reinstall-native-startup-and-client-packaged-engine-empty-evidence-workflow",
  },
  {
    host: "visual-studio",
    packageId: "Gaep.VisualStudio.90e45161-916c-4c39-b2bf-c2379c168fe9@0.1.0",
    path: "apps/visual-studio/Gaep.VisualStudio/bin/Release/net8.0-windows8.0/Gaep.VisualStudio.vsix",
    maximumBytes: 128 * 1024 * 1024,
    requiredHere: process.platform === "win32",
    verification: "cross-platform-shell-contribution-remote-ui-binding-exact-hostclient-embedded-engine-resource-and-382-protocol-controller-checks-with-packaged-engine-empty-evidence-workflow-windows-container-install-pending",
  },
]

async function digest(path) {
  const hash = createHash("sha256")
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return `sha256:${hash.digest("hex")}`
}

async function inspect(definition) {
  const path = join(repositoryRoot, definition.path)
  let metadata
  try {
    metadata = await lstat(path)
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      if (definition.requiredHere) throw new Error(`Required local package is missing: ${definition.path}`)
      return {
        host: definition.host,
        packageId: definition.packageId,
        artifactPath: definition.path,
        status: "not-produced-on-this-platform",
        verification: definition.verification,
        limitation: "Native Visual Studio VSIX container creation and installation require Windows and VsixUtil.exe.",
      }
    }
    throw error
  }
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size < 1 || metadata.size > definition.maximumBytes) {
    throw new Error(`Local package is unsafe or outside its size bound: ${definition.path}`)
  }
  if (basename(path) !== basename(definition.path) || relative(repositoryRoot, path).startsWith("..")) {
    throw new Error(`Local package path escaped the repository: ${definition.path}`)
  }
  return {
    host: definition.host,
    packageId: definition.packageId,
    artifactPath: definition.path,
    status: "produced",
    bytes: metadata.size,
    digest: await digest(path),
    verification: definition.verification,
  }
}

const artifacts = []
for (const definition of definitions) artifacts.push(await inspect(definition))
const produced = artifacts.filter((artifact) => artifact.status === "produced").length
const report = {
  schemaVersion: 1,
  kind: "gaep-local-ide-package-report-v1",
  packageSet: "phase-0-local",
  artifacts,
  summary: {
    expected: definitions.length,
    produced,
    missingNativePlatformArtifacts: definitions.length - produced,
  },
  claimBoundary: "Local package evidence is not release signing, publication, supported-OS acceptance, Product readiness, or release approval.",
}

const serialized = `${JSON.stringify(report, null, 2)}\n`
if (outputPath) await writeFile(outputPath, serialized, { encoding: "utf8", flag: "wx" })
process.stdout.write(serialized)
