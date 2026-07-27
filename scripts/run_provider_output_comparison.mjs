import { lstat, open } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { pathToFileURL } from "node:url"

import {
  buildProviderOutputComparison,
  defaultProviderComparisonInputs,
  verifyProviderOutputComparisonObject,
} from "./verify_provider_output_comparison_receipt.mjs"

async function writeExclusive(path, content) {
  const target = resolve(path)
  const parent = await lstat(dirname(target))
  if (!parent.isDirectory() || parent.isSymbolicLink()) throw new Error("Receipt parent must be a regular directory")
  let handle
  try {
    handle = await open(target, "wx", 0o600)
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      throw new Error("Receipt output already exists; refusing to overwrite it")
    }
    throw error
  }
  try {
    await handle.writeFile(content, "utf8")
    await handle.sync()
  } finally {
    await handle.close()
  }
  const written = await lstat(target)
  if (!written.isFile() || written.isSymbolicLink() || written.size !== Buffer.byteLength(content)) {
    throw new Error("Receipt output is not the exact regular file that was written")
  }
}

function parseArguments(args) {
  const options = {
    codexReceiptPath: defaultProviderComparisonInputs.codex,
    claudeReceiptPath: defaultProviderComparisonInputs.claude,
  }
  if (args.length === 0) return options
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) return { help: true }
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index]
    const value = args[index + 1]
    if (!value) throw new Error("Every provider comparison option requires a value")
    if (flag === "--codex") options.codexReceiptPath = value
    else if (flag === "--claude") options.claudeReceiptPath = value
    else if (flag === "--output") options.output = value
    else throw new Error(`Unknown provider comparison option: ${flag}`)
  }
  return options
}

export async function runProviderOutputComparison(options = {}) {
  const receipt = await buildProviderOutputComparison(options)
  return verifyProviderOutputComparisonObject(receipt, { root: options.root })
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  if (options.help) {
    process.stdout.write("Usage: node scripts/run_provider_output_comparison.mjs [--codex <receipt.json>] [--claude <receipt.json>] [--output <new-receipt.json>]\n")
    return
  }
  const receipt = await runProviderOutputComparison(options)
  const output = `${JSON.stringify(receipt, null, 2)}\n`
  if (options.output) await writeExclusive(options.output, output)
  process.stdout.write(output)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
