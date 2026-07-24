import { readFile, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

import { runHostBehaviorEvidence } from "./lib/host_behavior_evidence.mjs"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const options = {
  contractPath: resolve(repositoryRoot, "conformance/phase-0-ide-contract.json"),
  recordedAt: undefined,
  outputPath: undefined,
}

for (let index = 2; index < process.argv.length; index++) {
  const argument = process.argv[index]
  const value = process.argv[++index]
  if (!value) throw new Error(`Missing value for ${argument}`)
  if (argument === "--contract") options.contractPath = resolve(repositoryRoot, value)
  else if (argument === "--recorded-at") options.recordedAt = value
  else if (argument === "--output") options.outputPath = resolve(repositoryRoot, value)
  else throw new Error(`Unsupported host behavior option: ${argument}`)
}

if (!options.recordedAt || !options.outputPath) {
  throw new Error("Usage: run_host_behavior_evidence.mjs --recorded-at <UTC> --output <repository-relative-path> [--contract <path>]")
}
const outputRelative = relative(repositoryRoot, options.outputPath)
if (outputRelative === "" || outputRelative === ".." || outputRelative.startsWith(`..${sep}`) || isAbsolute(outputRelative)) {
  throw new Error("Host behavior evidence output must stay inside the repository")
}
const contract = JSON.parse(await readFile(options.contractPath, "utf8"))
const receipt = await runHostBehaviorEvidence({ repositoryRoot, contract, recordedAt: options.recordedAt })
const serialized = `${JSON.stringify(receipt, null, 2)}\n`
await writeFile(options.outputPath, serialized, { encoding: "utf8", flag: "wx" })
process.stdout.write(`${JSON.stringify({
  kind: receipt.kind,
  recordedAt: receipt.recordedAt,
  hosts: receipt.hosts.map((host) => ({ id: host.id, result: host.result, checks: host.checks.length })),
}, null, 2)}\n`)
