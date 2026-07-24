import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { buildIdeConformanceReport } from "./lib/ide_conformance.mjs"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const options = {
  contractPath: resolve(repositoryRoot, "conformance/phase-0-ide-contract.json"),
  packageReportPath: resolve(repositoryRoot, "evidence/local-packages/2026-07-24T085718Z-phase-0-local-conformance.json"),
  recordedAt: undefined,
}

for (let index = 2; index < process.argv.length; index++) {
  const argument = process.argv[index]
  const value = process.argv[++index]
  if (!value) throw new Error(`Missing value for ${argument}`)
  if (argument === "--contract") options.contractPath = resolve(repositoryRoot, value)
  else if (argument === "--package-report") options.packageReportPath = resolve(repositoryRoot, value)
  else if (argument === "--recorded-at") options.recordedAt = value
  else throw new Error(`Unsupported IDE conformance option: ${argument}`)
}

if (options.recordedAt !== undefined && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(options.recordedAt)) {
  throw new Error("IDE conformance recordedAt must be an exact UTC timestamp")
}

const report = await buildIdeConformanceReport({ repositoryRoot, ...options })
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
