import { createHash } from "node:crypto"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  readRepositoryRegularFile,
  writeExclusiveRepositoryFile,
} from "./lib/repository-files.mjs"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
let outputRelativePath
if (process.argv.length > 2) {
  if (process.argv.length !== 4 || process.argv[2] !== "--output") throw new Error("Usage: report_local_packages.mjs [--output <repository-relative-path>]")
  outputRelativePath = process.argv[3]
}

const definitions = [
  {
    host: "vscode",
    packageId: "gaep.gaep-vscode@0.1.0",
    path: "apps/vscode/dist/gaep-vscode.vsix",
    maximumBytes: 32 * 1024 * 1024,
    requiredHere: true,
    verification: "exact-local-package-build-bundled-engine-and-accessible-phase-3b-controlled-design-to-code-generation-product-studio-projection; actual-figma-access-context-materialization-transfer-provider-execution-generated-output-inspection-stage-effect-source-mutation-approval-authorization-acceptance-generation-readiness-native-install-reinstall-and-interaction-acceptance-remain-pending",
  },
  {
    host: "kiro",
    packageId: "gaep.gaep-kiro@0.1.0",
    path: "apps/kiro/dist/gaep-kiro.vsix",
    maximumBytes: 8 * 1024 * 1024,
    requiredHere: true,
    verification: "package-build-digest-bound-engine-and-private-safe-phase-3b-controlled-design-to-code-generation-command-projection; actual-figma-access-context-materialization-transfer-provider-execution-generated-output-inspection-stage-effect-source-mutation-approval-authorization-acceptance-generation-readiness-native-compatible-host-install-and-interaction-acceptance-remain-pending",
  },
  {
    host: "rider",
    packageId: "dev.gaep.productstudio@0.1.0",
    path: "apps/rider/build/distributions/gaep-rider-0.1.0.zip",
    maximumBytes: 64 * 1024 * 1024,
    requiredHere: true,
    verification: "clean-kotlin-compile-instrumented-plugin-build-structure-check-digest-bound-engine-and-phase-3b-controlled-design-to-code-generation-projection; actual-figma-access-context-materialization-transfer-provider-execution-generated-output-inspection-stage-effect-source-mutation-approval-authorization-acceptance-generation-readiness-native-Rider-install-startup-and-interaction-acceptance-remain-pending",
  },
  {
    host: "visual-studio",
    packageId: "Gaep.VisualStudio.90e45161-916c-4c39-b2bf-c2379c168fe9@0.1.0",
    path: "apps/visual-studio/Gaep.VisualStudio/bin/Release/net8.0-windows8.0/Gaep.VisualStudio.vsix",
    maximumBytes: 128 * 1024 * 1024,
    requiredHere: process.platform === "win32",
    verification: "cross-platform-hostclient-build-and-phase-3b-controlled-design-to-code-generation-protocol-controller-projection; actual-figma-access-context-materialization-transfer-provider-execution-generated-output-inspection-stage-effect-source-mutation-approval-authorization-acceptance-generation-readiness-Windows-VSIX-container-install-startup-and-interaction-acceptance-remain-pending",
  },
]

function digest(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`
}

async function inspect(definition) {
  let artifact
  try {
    artifact = await readRepositoryRegularFile(repositoryRoot, definition.path, {
      minimumBytes: 1,
      maximumBytes: definition.maximumBytes,
    })
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
  return {
    host: definition.host,
    packageId: definition.packageId,
    artifactPath: definition.path,
    status: "produced",
    bytes: artifact.bytes.byteLength,
    digest: digest(artifact.bytes),
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
if (outputRelativePath) {
  await writeExclusiveRepositoryFile(repositoryRoot, outputRelativePath, serialized)
}
process.stdout.write(serialized)
