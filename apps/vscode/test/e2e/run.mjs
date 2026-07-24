import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import { runTests } from "@vscode/test-electron"

const extensionDevelopmentPath = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const extensionTestsPath = join(extensionDevelopmentPath, "test/e2e/suite/index.cjs")
const testHarnessPath = join(extensionDevelopmentPath, "test/e2e/harness")
// macOS limits Unix-domain socket paths to 103 bytes; /tmp keeps VS Code's profile IPC path below that bound.
const temporaryRoot = await mkdtemp(join(process.platform === "darwin" ? "/tmp" : tmpdir(), "gaep-e2e-"))
const runCli = promisify(execFile)
const installation = installedInstallation()

function installedInstallation() {
  const configuredExecutable = process.env.GAEP_VSCODE_EXECUTABLE
  const configuredCliEntry = process.env.GAEP_VSCODE_CLI_ENTRY
  if (configuredExecutable || configuredCliEntry) {
    if (!configuredExecutable || !configuredCliEntry) {
      throw new Error("GAEP_VSCODE_EXECUTABLE and GAEP_VSCODE_CLI_ENTRY must be configured together")
    }
    return { executable: configuredExecutable, cliEntry: configuredCliEntry }
  }
  const candidates = process.platform === "darwin"
    ? [{
        executable: "/Applications/Visual Studio Code.app/Contents/MacOS/Code",
        cliEntry: "/Applications/Visual Studio Code.app/Contents/Resources/app/out/cli.js",
      }]
    : process.platform === "win32"
      ? []
      : [{ executable: "/usr/share/code/code", cliEntry: "/usr/share/code/resources/app/out/cli.js" }]
  return candidates.find((candidate) => existsSync(candidate.executable) && existsSync(candidate.cliEntry))
}

async function createWorkspace() {
  const singleRoot = join(temporaryRoot, "single-root")
  const multiRootA = join(temporaryRoot, "multi-root-a")
  const multiRootB = join(temporaryRoot, "multi-root-b")
  await Promise.all([singleRoot, multiRootA, multiRootB].map((path) => mkdir(path, { recursive: true })))
  await writeFile(join(singleRoot, "README.md"), "# GAEP extension-host fixture\n", "utf8")
  await writeFile(join(multiRootA, "README.md"), "# Product A\n", "utf8")
  await writeFile(join(multiRootB, "README.md"), "# Product B\n", "utf8")
  const multiRootWorkspace = join(temporaryRoot, "gaep-multi-root.code-workspace")
  await writeFile(multiRootWorkspace, `${JSON.stringify({
    folders: [{ path: multiRootA }, { path: multiRootB }],
    settings: {},
  }, null, 2)}\n`, "utf8")
  return { singleRoot, multiRootA, multiRootB, multiRootWorkspace }
}

async function runPhase({
  phase,
  target,
  profile,
  extensions,
  expectedRoots,
  developmentPath = extensionDevelopmentPath,
  disableExtensions = true,
}) {
  const options = {
    extensionDevelopmentPath: developmentPath,
    extensionTestsPath,
    launchArgs: [
      target,
      ...(disableExtensions ? ["--disable-extensions"] : []),
      "--disable-telemetry",
      "--disable-crash-reporter",
      "--skip-add-to-recently-opened",
      `--user-data-dir=${profile}`,
      `--extensions-dir=${extensions}`,
    ],
    extensionTestsEnv: {
      GAEP_E2E_PHASE: phase,
      GAEP_E2E_EXPECTED_ROOTS: expectedRoots.join("\n"),
    },
  }
  if (installation) options.vscodeExecutablePath = installation.executable
  else options.version = "1.103.0"
  await runTests(options)
}

async function installPackagedVsix(profile, extensions) {
  if (!installation) return false
  const cliEnvironment = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    VSCODE_IPC_HOOK_CLI: "",
    NODE_OPTIONS: "",
    NODE_REPL_EXTERNAL_MODULE: "",
  }
  const commonArguments = [
    installation.cliEntry,
    `--user-data-dir=${profile}`,
    `--extensions-dir=${extensions}`,
    "--disable-telemetry",
  ]
  await runCli(installation.executable, [
    ...commonArguments,
    "--install-extension",
    join(extensionDevelopmentPath, "dist/gaep-vscode.vsix"),
    "--force",
  ], { env: cliEnvironment, timeout: 60_000, maxBuffer: 1024 * 1024 })
  const listed = await runCli(installation.executable, [
    ...commonArguments,
    "--list-extensions",
    "--show-versions",
  ], { env: cliEnvironment, timeout: 60_000, maxBuffer: 1024 * 1024 })
  if (!listed.stdout.split(/\r?\n/u).includes("gaep.gaep-vscode@0.1.0")) {
    throw new Error("The exact packaged GAEP VSIX was not present in the isolated extension inventory")
  }
  process.stdout.write("PASS isolated VSIX install/list: gaep.gaep-vscode@0.1.0\n")
  return true
}

const workspace = await createWorkspace()
const restoreProfile = join(temporaryRoot, "restore-profile")
const restoreExtensions = join(temporaryRoot, "restore-extensions")
const multiRootProfile = join(temporaryRoot, "multi-root-profile")
const multiRootExtensions = join(temporaryRoot, "multi-root-extensions")
const installedProfile = join(temporaryRoot, "installed-profile")
const installedExtensions = join(temporaryRoot, "installed-extensions")

try {
  await runPhase({
    phase: "open",
    target: workspace.singleRoot,
    profile: restoreProfile,
    extensions: restoreExtensions,
    expectedRoots: [workspace.singleRoot],
  })
  await runPhase({
    phase: "multi-root",
    target: workspace.multiRootWorkspace,
    profile: multiRootProfile,
    extensions: multiRootExtensions,
    expectedRoots: [workspace.multiRootA, workspace.multiRootB],
  })
  await Promise.all([installedProfile, installedExtensions].map((path) => mkdir(path, { recursive: true })))
  if (await installPackagedVsix(installedProfile, installedExtensions)) {
    await runPhase({
      phase: "installed",
      target: workspace.singleRoot,
      profile: installedProfile,
      extensions: installedExtensions,
      expectedRoots: [workspace.singleRoot],
      developmentPath: testHarnessPath,
      disableExtensions: false,
    })
  } else {
    process.stdout.write("Exact installed VSIX activation: UNVERIFIED because no local VS Code installation is available.\n")
  }
  process.stdout.write("GAEP VS Code extension-host verification: PASS\n")
  process.stdout.write("Workspace-trust limitation: @vscode/test-electron forces --disable-workspace-trust; untrusted-host behavior remains outside this harness.\n")
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}
