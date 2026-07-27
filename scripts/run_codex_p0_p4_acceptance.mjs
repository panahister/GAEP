import { execFile } from "node:child_process"
import { lstat, open, readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { promisify } from "node:util"

import {
  canonicalDigest,
  codexP0P4Limitations,
  codexP0P4TestName,
  rawDigest,
  verifyCodexP0P4ReceiptObject,
} from "./verify_codex_p0_p4_receipt.mjs"

const execute = promisify(execFile)
const repository = fileURLToPath(new URL("..", import.meta.url))
const vitest = resolve(repository, "node_modules/vitest/vitest.mjs")
const testFile = "packages/engine/src/business-understanding.test.ts"
const fakeServerFile = "packages/agent-sdk/test/fixtures/fake-codex-app-server.mjs"
const summaryPrefix = "GAEP_P1_30_SEMANTIC_SUMMARY="
const outputByteLimit = 4 * 1024 * 1024

async function runTest() {
  const { stdout, stderr } = await execute(process.execPath, [
    vitest,
    "run",
    testFile,
    "-t",
    codexP0P4TestName,
  ], {
    cwd: repository,
    env: { ...process.env, GAEP_P1_30_EMIT_RECEIPT: "1" },
    maxBuffer: outputByteLimit,
  })
  const summaries = stdout.split(/\r?\n/u)
    .filter((line) => line.startsWith(summaryPrefix))
    .map((line) => JSON.parse(line.slice(summaryPrefix.length)))
  if (summaries.length !== 1) {
    throw new Error(`P1-30 integration emitted ${summaries.length} semantic summaries instead of exactly one`)
  }
  if (!/Test Files\s+1 passed \(1\)/u.test(stdout) || !/Tests\s+1 passed/u.test(stdout)) {
    throw new Error("P1-30 integration did not report exactly one passing focused test file and test")
  }
  if (stderr.trim().length > 0) throw new Error(`P1-30 integration wrote unexpected stderr: ${stderr.trim()}`)
  return summaries[0]
}

export async function runCodexP0P4Acceptance() {
  const summary = await runTest()
  const [testBytes, fakeServerBytes] = await Promise.all([
    readFile(resolve(repository, testFile)),
    readFile(resolve(repository, fakeServerFile)),
  ])
  const receipt = {
    schemaVersion: 1,
    kind: "gaep-codex-p0-p4-acceptance-receipt",
    scenario: {
      id: "P1-30",
      testFile,
      testName: codexP0P4TestName,
      testSourceDigest: rawDigest(testBytes),
      fakeServerFile,
      fakeServerSourceDigest: rawDigest(fakeServerBytes),
    },
    execution: {
      runner: "vitest-isolated-child-process",
      exitCode: 0,
      semanticSummaryCount: 1,
    },
    summary,
    summaryDigest: canonicalDigest(summary),
    authority: {
      liveProviderStatus: "not-tested",
      productOwnerAcceptance: "not-established",
      readinessAuthority: "not-established",
      releaseAuthority: "not-granted",
      securityScan: "skipped-by-product-owner",
      boundary: "acceptance-receipt-is-deterministic-local-evidence-not-live-provider-product-owner-readiness-security-or-release-authority",
    },
    limitations: codexP0P4Limitations,
  }
  return verifyCodexP0P4ReceiptObject(receipt)
}

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
  if (args.length === 0) return {}
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) return { help: true }
  if (args.length === 2 && args[0] === "--output" && args[1]) return { output: args[1] }
  throw new Error("Usage: node scripts/run_codex_p0_p4_acceptance.mjs [--output <new-receipt.json>]")
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  if (options.help) {
    process.stdout.write("Usage: node scripts/run_codex_p0_p4_acceptance.mjs [--output <new-receipt.json>]\n")
    return
  }
  const receipt = await runCodexP0P4Acceptance()
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
