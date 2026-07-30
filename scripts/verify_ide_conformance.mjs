import { writeFile } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { buildIdeConformanceReport } from "./lib/ide_conformance.mjs"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const options = {
  contractPath: resolve(repositoryRoot, "conformance/phase-0-ide-contract.json"),
  packageReportPath: resolve(repositoryRoot, "evidence/local-packages/20260730T102600Z-phase-3a-definition-of-ready-packages.json"),
  recordedAt: undefined,
  outputPath: undefined,
}

for (let index = 2; index < process.argv.length; index++) {
  const argument = process.argv[index]
  const value = process.argv[++index]
  if (!value) throw new Error(`Missing value for ${argument}`)
  if (argument === "--contract") options.contractPath = resolve(repositoryRoot, value)
  else if (argument === "--package-report") options.packageReportPath = resolve(repositoryRoot, value)
  else if (argument === "--recorded-at") options.recordedAt = value
  else if (argument === "--output") options.outputPath = resolve(repositoryRoot, value)
  else throw new Error(`Unsupported IDE conformance option: ${argument}`)
}

if (options.recordedAt !== undefined && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(options.recordedAt)) {
  throw new Error("IDE conformance recordedAt must be an exact UTC timestamp")
}

const report = await buildIdeConformanceReport({ repositoryRoot, ...options })
const serialized = `${JSON.stringify(report, null, 2)}\n`
if (options.outputPath) {
  const outputRelative = relative(repositoryRoot, options.outputPath)
  if (outputRelative === "" || outputRelative === ".." || outputRelative.startsWith(`..${sep}`) ||
      isAbsolute(outputRelative)) throw new Error("IDE conformance output must stay inside the repository")
  await writeFile(options.outputPath, serialized, { encoding: "utf8", flag: "wx" })
}
process.stdout.write(serialized)
