import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import { runTests } from "@vscode/test-electron"

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

try {
  await Promise.all([workspace, profile, extensions].map((path) => mkdir(path, { recursive: true })))
  await writeFile(join(workspace, "README.md"), "# Isolated GAEP for Kiro extension-host fixture\n", "utf8")
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
  await runCli(executable, [
    ...commonCliArguments,
    "--install-extension",
    join(extensionDevelopmentPath, "dist/gaep-kiro.vsix"),
    "--force",
  ], { env: cliEnvironment, timeout: 60_000, maxBuffer: 1024 * 1024 })
  const listed = await runCli(executable, [
    ...commonCliArguments,
    "--list-extensions",
    "--show-versions",
  ], { env: cliEnvironment, timeout: 60_000, maxBuffer: 1024 * 1024 })
  if (!listed.stdout.split(/\r?\n/u).includes("gaep.gaep-kiro@0.1.0")) {
    throw new Error("The exact packaged GAEP for Kiro VSIX was not present in the isolated extension inventory")
  }
  process.stdout.write("PASS isolated VSIX install/list: gaep.gaep-kiro@0.1.0\n")
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
