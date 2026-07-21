import { existsSync } from "node:fs"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { runTests } from "@vscode/test-electron"

const extensionDevelopmentPath = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const extensionTestsPath = join(extensionDevelopmentPath, "test/e2e/suite/index.cjs")
// macOS limits Unix-domain socket paths to 103 bytes; /tmp keeps VS Code's profile IPC path below that bound.
const temporaryRoot = await mkdtemp(join(process.platform === "darwin" ? "/tmp" : tmpdir(), "gaep-e2e-"))

function installedExecutable() {
  const configured = process.env.GAEP_VSCODE_EXECUTABLE
  if (configured) return configured
  const candidates = process.platform === "darwin"
    ? ["/Applications/Visual Studio Code.app/Contents/MacOS/Electron"]
    : process.platform === "win32"
      ? []
      : ["/usr/share/code/code", "/usr/bin/code"]
  return candidates.find((candidate) => existsSync(candidate))
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

async function runPhase({ phase, target, profile, extensions, expectedRoots }) {
  const executable = installedExecutable()
  const options = {
    extensionDevelopmentPath,
    extensionTestsPath,
    launchArgs: [
      target,
      "--disable-extensions",
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
  if (executable) options.vscodeExecutablePath = executable
  else options.version = "1.103.0"
  await runTests(options)
}

const workspace = await createWorkspace()
const restoreProfile = join(temporaryRoot, "restore-profile")
const restoreExtensions = join(temporaryRoot, "restore-extensions")
const multiRootProfile = join(temporaryRoot, "multi-root-profile")
const multiRootExtensions = join(temporaryRoot, "multi-root-extensions")

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
  process.stdout.write("GAEP VS Code extension-host verification: PASS\n")
  process.stdout.write("Workspace-trust limitation: @vscode/test-electron forces --disable-workspace-trust; untrusted-host behavior remains outside this harness.\n")
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}
