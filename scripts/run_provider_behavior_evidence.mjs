import { writeFile } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

import { runProviderBehaviorEvidence } from "./lib/provider_behavior_evidence.mjs"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
let recordedAt
let outputPath
for (let index = 2; index < process.argv.length; index++) {
  const argument = process.argv[index]
  const value = process.argv[++index]
  if (!value) throw new Error(`Missing value for ${argument}`)
  if (argument === "--recorded-at") recordedAt = value
  else if (argument === "--output") outputPath = resolve(repositoryRoot, value)
  else throw new Error(`Unsupported provider behavior option: ${argument}`)
}
if (!recordedAt || !outputPath) {
  throw new Error("Usage: run_provider_behavior_evidence.mjs --recorded-at <UTC> --output <repository-relative-path>")
}
const outputRelative = relative(repositoryRoot, outputPath)
if (outputRelative === "" || outputRelative === ".." || outputRelative.startsWith(`..${sep}`) || isAbsolute(outputRelative)) {
  throw new Error("Provider behavior evidence output must stay inside the repository")
}
const receipt = await runProviderBehaviorEvidence({ repositoryRoot, recordedAt })
await writeFile(outputPath, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
process.stdout.write(`${JSON.stringify({
  kind: receipt.kind,
  recordedAt: receipt.recordedAt,
  providers: receipt.providers.map((provider) => ({ id: provider.id, result: provider.result, liveAcceptance: provider.liveAcceptance })),
}, null, 2)}\n`)
