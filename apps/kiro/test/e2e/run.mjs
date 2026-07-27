import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import { runTests } from "@vscode/test-electron"
import { GaepEngine } from "@gaep/engine"
import { createVsixLifecycleFixture } from "../../../../scripts/create_vsix_lifecycle_fixture.mjs"
import storeIntegrity from "./store-integrity.cjs"

const { inspectPortableStore } = storeIntegrity

const extensionDevelopmentPath = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const testHarnessPath = join(extensionDevelopmentPath, "test/e2e/harness")
const extensionTestsPath = join(extensionDevelopmentPath, "test/e2e/suite/index.cjs")
const installation = installedCompatibleInstallation()
if (!installation) throw new Error("No installed Kiro or VS Code-compatible extension host is available")
const executable = process.env.GAEP_KIRO_COMPATIBLE_EXECUTABLE ?? installation.executable
const cliEntry = process.env.GAEP_KIRO_COMPATIBLE_CLI_ENTRY ?? installation.cliEntry
const runCli = promisify(execFile)

// macOS has a short Unix-domain socket path limit, so keep the isolated profile beneath /tmp.
const temporaryRoot = await mkdtemp(join(process.platform === "darwin" ? "/tmp" : tmpdir(), "gaep-kiro-e2e-"))
const workspace = join(temporaryRoot, "workspace")
const profile = join(temporaryRoot, "profile")
const extensions = join(temporaryRoot, "extensions")
const packageId = "gaep.gaep-kiro"
const exactPackage = `${packageId}@0.1.0`

try {
  await Promise.all([workspace, profile, extensions].map((path) => mkdir(path, { recursive: true })))
  const fixtureProductName = "Installed Kiro package private smoke fixture"
  const fixtureEngine = new GaepEngine(workspace, [])
  await fixtureEngine.createProduct({
    name: fixtureProductName,
    summary: "A disposable Product used only to exercise installed compatible-host metadata commands.",
    problem: "An installed-package smoke must prove provider and model dashboard behavior without reading a real Product.",
    affectedUsers: "Local GAEP package testers",
    desiredOutcome: "Exercise exact private-safe metadata projections while leaving every fixture-store byte unchanged.",
    successSignals: ["The installed commands return bounded metadata and preserve the exact fixture store"],
    firstWorkflow: "Observe provider capability and unselected model metadata through the packaged engine.",
    exclusions: ["Live provider requests", "Credentials", "Normal user profiles", "Source workspace mutation"],
    profile: "internal-tool",
  }, "gaep.kiro-e2e-owner")
  const fixtureInitiative = await fixtureEngine.createInitiative({
    title: "Installed Kiro Phase 1 dashboard smoke",
    outcome: "Exercise the exact Initiative-scoped Agent and Model execution-truth projection without granting authority.",
    scope: ["Packaged engine metadata projection"],
    exclusions: ["Live providers", "Run launch", "Effects", "Approval", "Release"],
  }, "gaep.kiro-e2e-owner")
  await writeFile(join(workspace, "README.md"), "# Isolated GAEP for Kiro extension-host fixture\n", "utf8")
  const fixtureStoreManifest = await inspectPortableStore(join(workspace, ".gaep"))
  const cliEnvironment = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    VSCODE_IPC_HOOK_CLI: "",
    NODE_OPTIONS: "",
    NODE_REPL_EXTERNAL_MODULE: "",
  }
  const commonCliArguments = [
    cliEntry,
    `--user-data-dir=${profile}`,
    `--extensions-dir=${extensions}`,
    "--disable-telemetry",
  ]
  const previousPackage = await createVsixLifecycleFixture({
    temporaryRoot,
    packageName: "gaep-kiro",
    displayName: "GAEP for Kiro",
    engineRange: "^1.95.0",
  })
  const executeCli = (arguments_) => runCli(executable, [
    ...commonCliArguments,
    ...arguments_,
  ], { env: cliEnvironment, timeout: 60_000, maxBuffer: 1024 * 1024 })
  const inventory = async () => {
    const listed = await executeCli(["--list-extensions", "--show-versions"])
    return listed.stdout.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean)
  }
  const assertInventory = async (expected) => {
    const matches = (await inventory()).filter((line) => line.startsWith(`${packageId}@`))
    if (expected && (matches.length !== 1 || matches[0] !== expected)) {
      throw new Error(`Expected exactly ${expected} in the isolated compatible-host inventory; received ${matches.join(", ") || "none"}`)
    }
    if (!expected && matches.length !== 0) {
      throw new Error(`Expected ${packageId} to be absent from the isolated compatible-host inventory; received ${matches.join(", ")}`)
    }
  }

  const packagePath = join(extensionDevelopmentPath, "dist/gaep-kiro.vsix")
  await executeCli(["--install-extension", previousPackage.path, "--force"])
  await assertInventory(previousPackage.exactPackage)
  await executeCli(["--install-extension", packagePath, "--force"])
  await assertInventory(exactPackage)
  await executeCli(["--install-extension", packagePath, "--force"])
  await assertInventory(exactPackage)
  await executeCli(["--install-extension", previousPackage.path, "--force"])
  await assertInventory(previousPackage.exactPackage)
  await executeCli(["--uninstall-extension", packageId])
  await assertInventory(undefined)
  await executeCli(["--install-extension", packagePath, "--force"])
  await assertInventory(exactPackage)
  process.stdout.write(`PASS isolated compatible-host VSIX previous-version install/upgrade/reinstall/rollback/uninstall/absence/final install: ${previousPackage.exactPackage} -> ${exactPackage}\n`)
  await runTests({
    vscodeExecutablePath: executable,
    extensionDevelopmentPath: testHarnessPath,
    extensionTestsPath,
    launchArgs: [
      workspace,
      "--disable-telemetry",
      "--disable-crash-reporter",
      "--disable-workspace-trust",
      "--skip-add-to-recently-opened",
      `--user-data-dir=${profile}`,
      `--extensions-dir=${extensions}`,
    ],
    extensionTestsEnv: {
      GAEP_KIRO_E2E_WORKSPACE: workspace,
      GAEP_KIRO_E2E_PRODUCT_NAME: fixtureProductName,
      GAEP_KIRO_E2E_INITIATIVE_ID: fixtureInitiative.id,
      GAEP_KIRO_E2E_STORE_MANIFEST: JSON.stringify(fixtureStoreManifest),
      GAEP_ENGINE_EXECUTABLE: "",
      GAEP_ENGINE_SHA256: "",
    },
  })
  process.stdout.write("GAEP for Kiro exact installed VSIX activation smoke: PASS\n")
  process.stdout.write("Kiro-native runtime: UNVERIFIED because no local Kiro IDE binary is installed.\n")
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}

function installedCompatibleInstallation() {
  const candidates = process.platform === "darwin"
    ? [
        {
          executable: "/Applications/Kiro.app/Contents/MacOS/Kiro",
          cliEntry: "/Applications/Kiro.app/Contents/Resources/app/out/cli.js",
        },
        {
          executable: "/Applications/Kiro.app/Contents/MacOS/Electron",
          cliEntry: "/Applications/Kiro.app/Contents/Resources/app/out/cli.js",
        },
        {
          executable: "/Applications/Visual Studio Code.app/Contents/MacOS/Code",
          cliEntry: "/Applications/Visual Studio Code.app/Contents/Resources/app/out/cli.js",
        },
      ]
    : process.platform === "win32"
      ? []
      : [
          { executable: "/usr/share/kiro/kiro", cliEntry: "/usr/share/kiro/resources/app/out/cli.js" },
          { executable: "/usr/share/code/code", cliEntry: "/usr/share/code/resources/app/out/cli.js" },
        ]
  return candidates.find((candidate) => existsSync(candidate.executable) && existsSync(candidate.cliEntry))
}
