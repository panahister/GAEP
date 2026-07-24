import { execFile } from "node:child_process"
import { lstat, mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { createRequire } from "node:module"
import { promisify } from "node:util"

const run = promisify(execFile)
const require = createRequire(import.meta.url)
const vsceEntry = require.resolve("@vscode/vsce/vsce")
const previousVersion = "0.0.9"

export async function createVsixLifecycleFixture({ temporaryRoot, packageName, displayName, engineRange }) {
  if (!/^gaep-(?:vscode|kiro)$/u.test(packageName)) throw new Error(`Unsupported lifecycle fixture package: ${packageName}`)
  if (typeof displayName !== "string" || displayName.length < 1 || displayName.length > 80) {
    throw new Error("The lifecycle fixture display name is invalid")
  }
  if (!/^\^[0-9]+\.[0-9]+\.[0-9]+$/u.test(engineRange)) throw new Error("The lifecycle fixture engine range is invalid")

  const fixtureRoot = join(temporaryRoot, `${packageName}-previous-fixture`)
  const outputPath = join(temporaryRoot, `${packageName}-${previousVersion}-fixture.vsix`)
  await mkdir(fixtureRoot, { recursive: true })
  await Promise.all([
    writeFile(join(fixtureRoot, "package.json"), `${JSON.stringify({
      name: packageName,
      displayName: `${displayName} lifecycle fixture`,
      description: "Synthetic previous-version package used only for isolated GAEP lifecycle testing.",
      version: previousVersion,
      publisher: "gaep",
      engines: { vscode: engineRange },
      categories: ["Other"],
      main: "./extension.cjs",
      activationEvents: ["onStartupFinished"],
      files: ["extension.cjs", "README.md"],
    }, null, 2)}\n`, "utf8"),
    writeFile(join(fixtureRoot, "extension.cjs"), "exports.activate = () => undefined\nexports.deactivate = () => undefined\n", "utf8"),
    writeFile(join(fixtureRoot, "README.md"), [
      `# ${displayName} lifecycle fixture`,
      "",
      "Synthetic version 0.0.9 used only inside a temporary isolated extension profile.",
      "It is not a historic GAEP build, supported package, release artifact, or rollback payload.",
      "",
    ].join("\n"), "utf8"),
  ])
  await run(process.execPath, [
    vsceEntry,
    "package",
    "--no-dependencies",
    "--allow-missing-repository",
    "--skip-license",
    "--no-rewrite-relative-links",
    "--out",
    outputPath,
  ], {
    cwd: fixtureRoot,
    env: { ...process.env, NODE_OPTIONS: "", NODE_REPL_EXTERNAL_MODULE: "" },
    timeout: 60_000,
    maxBuffer: 1024 * 1024,
  })
  const metadata = await lstat(outputPath)
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size < 1 || metadata.size > 2 * 1024 * 1024) {
    throw new Error(`The lifecycle fixture VSIX is unsafe or outside its 2 MiB bound: ${outputPath}`)
  }
  return {
    path: outputPath,
    exactPackage: `gaep.${packageName}@${previousVersion}`,
  }
}
