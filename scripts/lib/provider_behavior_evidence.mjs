import { createHash } from "node:crypto"
import { execFile } from "node:child_process"
import { createReadStream } from "node:fs"
import { lstat, realpath } from "node:fs/promises"
import { isAbsolute, relative, resolve, sep } from "node:path"

const maximumSourceBytes = 8 * 1024 * 1024
const maximumProcessOutputBytes = 8 * 1024 * 1024
const expectedProviderIds = ["claude", "codex"]

const definitions = {
  codex: {
    label: "Codex",
    executionBoundary: "deterministic-offline-staged-contract",
    sourcePaths: [
      "packages/adapters/codex/src/index.ts",
      "packages/adapters/codex/src/index.test.ts",
      "packages/agent-sdk/src/codex-app-server.ts",
      "packages/agent-sdk/src/codex-app-server.test.ts",
      "packages/agent-sdk/src/managed-codex-run.ts",
      "packages/agent-sdk/src/managed-codex-run.test.ts",
      "packages/agent-sdk/test/fixtures/fake-codex-app-server.mjs",
    ],
    command: {
      id: "codex-adapter-transport-and-staged-run-contract",
      executable: "npm",
      args: [
        "exec", "--", "vitest", "run",
        "packages/adapters/codex/src/index.test.ts",
        "packages/agent-sdk/src/codex-app-server.test.ts",
        "packages/agent-sdk/src/managed-codex-run.test.ts",
      ],
      timeoutMs: 120_000,
      requiredMarkers: ["Test Files  3 passed (3)", "Tests  44 passed (44)"],
    },
    limitations: [
      "The gate uses deterministic fake transport and local staged workspaces; it does not make a live Codex provider request.",
      "Real-account authentication, service behavior, quotas, supported-version coverage and human acceptance remain unverified.",
    ],
  },
  claude: {
    label: "Claude Code",
    executionBoundary: "deterministic-offline-staged-contract-live-readiness-blocked",
    sourcePaths: [
      "packages/adapters/claude/src/index.ts",
      "packages/adapters/claude/src/index.test.ts",
      "packages/agent-sdk/src/managed-claude.ts",
      "packages/agent-sdk/src/managed-claude.test.ts",
      "packages/agent-sdk/src/managed-claude-run.ts",
      "packages/agent-sdk/src/managed-claude-run.test.ts",
      "packages/agent-sdk/src/managed-claude-preflight.ts",
      "packages/agent-sdk/src/managed-claude-preflight.test.ts",
      "packages/agent-sdk/test/fixtures/fake-claude-stream.mjs",
    ],
    command: {
      id: "claude-adapter-preflight-and-isolated-staged-contract",
      executable: "npm",
      args: [
        "exec", "--", "vitest", "run",
        "packages/adapters/claude/src/index.test.ts",
        "packages/agent-sdk/src/managed-claude.test.ts",
        "packages/agent-sdk/src/managed-claude-run.test.ts",
        "packages/agent-sdk/src/managed-claude-preflight.test.ts",
      ],
      timeoutMs: 120_000,
      requiredMarkers: ["Test Files  4 passed (4)", "Tests  24 passed (24)"],
    },
    limitations: [
      "The gate uses deterministic fake streaming, isolated local staging and offline preflight fixtures; it does not make a live Claude provider request.",
      "Live Claude staging remains blocked until a supported runtime, non-persisted authentication and effective managed-policy readiness are attested.",
    ],
  },
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message)
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`
  }
  return JSON.stringify(value)
}

function digestValue(value) {
  return `sha256:${createHash("sha256").update(canonical(value)).digest("hex")}`
}

function within(root, candidate) {
  const path = relative(root, candidate)
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path))
}

async function fileDigest(path) {
  const hash = createHash("sha256")
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return `sha256:${hash.digest("hex")}`
}

async function sourceFile(repositoryRoot, path, providerId) {
  requireCondition(typeof path === "string" && path.length > 0 && path.length <= 4096 && !isAbsolute(path),
    `${providerId} provider source path is invalid`)
  const resolved = resolve(repositoryRoot, path)
  requireCondition(within(repositoryRoot, resolved), `${providerId} provider source escaped the repository`)
  const canonicalPath = await realpath(resolved)
  requireCondition(within(repositoryRoot, canonicalPath), `${providerId} provider source resolves outside the repository`)
  const metadata = await lstat(resolved)
  requireCondition(metadata.isFile() && !metadata.isSymbolicLink() && metadata.size > 0 && metadata.size <= maximumSourceBytes,
    `${providerId} provider source is not a bounded regular file`)
  return { resolved, metadata }
}

function publicDefinitions() {
  return Object.fromEntries(expectedProviderIds.map((providerId) => [providerId, definitions[providerId]]))
}

export function providerBehaviorDefinitionDigest() {
  return digestValue(publicDefinitions())
}

export async function providerBehaviorSourceSnapshot({ repositoryRoot, providerId }) {
  const definition = definitions[providerId]
  requireCondition(definition !== undefined, `Provider behavior definition is missing for ${providerId}`)
  const paths = [...new Set([
    "scripts/lib/provider_behavior_evidence.mjs",
    "scripts/run_provider_behavior_evidence.mjs",
    ...definition.sourcePaths,
  ])].sort()
  const files = []
  for (const path of paths) {
    const { resolved, metadata } = await sourceFile(repositoryRoot, path, providerId)
    files.push({ path, bytes: metadata.size, digest: await fileDigest(resolved) })
  }
  return digestValue({ providerId, definition, files })
}

function runCommand(repositoryRoot, providerId, command) {
  const executable = process.platform === "win32" && command.executable === "npm" ? "npm.cmd" : command.executable
  return new Promise((resolveCommand, rejectCommand) => {
    execFile(executable, command.args, {
      cwd: repositoryRoot,
      env: process.env,
      encoding: "utf8",
      timeout: command.timeoutMs,
      maxBuffer: maximumProcessOutputBytes,
      windowsHide: true,
    }, (error, stdout, stderr) => {
      if (error) {
        rejectCommand(new Error(`${providerId}/${command.id} behavioral gate failed`))
        return
      }
      const output = `${stdout}${stderr}`
      const missing = command.requiredMarkers.filter((marker) => !output.includes(marker))
      if (missing.length > 0) {
        rejectCommand(new Error(`${providerId}/${command.id} behavioral gate omitted ${missing.length} required marker(s)`))
        return
      }
      resolveCommand({ id: command.id, result: "pass", requiredMarkersVerified: command.requiredMarkers.length })
    })
  })
}

export async function runProviderBehaviorEvidence({ repositoryRoot, recordedAt }) {
  requireCondition(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(recordedAt),
    "Provider behavior recordedAt must be an exact UTC timestamp")
  const normalizedRoot = await realpath(resolve(repositoryRoot))
  const providers = await Promise.all(expectedProviderIds.map(async (providerId) => {
    const definition = definitions[providerId]
    return {
      id: providerId,
      label: definition.label,
      executionBoundary: definition.executionBoundary,
      sourceSnapshotDigest: await providerBehaviorSourceSnapshot({ repositoryRoot: normalizedRoot, providerId }),
      check: await runCommand(normalizedRoot, providerId, definition.command),
      result: "pass",
      liveAcceptance: "not-established",
      limitations: definition.limitations,
    }
  }))
  return {
    schemaVersion: 1,
    kind: "gaep-phase-0-provider-behavior-evidence-v1",
    phase: "phase-0-local",
    recordedAt,
    definitionDigest: providerBehaviorDefinitionDigest(),
    providers,
    claimBoundary: "This receipt proves deterministic local adapter, transport, preflight and staged-run contracts only. It does not prove a live provider request, account readiness, service behavior, supported-version coverage, Product readiness, release approval, or security review.",
  }
}

function exactKeys(value, keys, label) {
  requireCondition(value !== null && typeof value === "object" && !Array.isArray(value), `${label} must be an object`)
  requireCondition(canonical(Object.keys(value).sort()) === canonical([...keys].sort()), `${label} keys differ`)
}

export async function verifyProviderBehaviorEvidence({ repositoryRoot, receipt }) {
  exactKeys(receipt, ["schemaVersion", "kind", "phase", "recordedAt", "definitionDigest", "providers", "claimBoundary"],
    "provider behavior receipt")
  requireCondition(receipt.schemaVersion === 1 && receipt.kind === "gaep-phase-0-provider-behavior-evidence-v1" &&
    receipt.phase === "phase-0-local" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(receipt.recordedAt) &&
    typeof receipt.claimBoundary === "string" && receipt.claimBoundary.length > 0,
  "Provider behavior receipt identity is invalid")
  requireCondition(receipt.definitionDigest === providerBehaviorDefinitionDigest(), "Provider behavior definition digest is stale")
  requireCondition(Array.isArray(receipt.providers) && receipt.providers.length === expectedProviderIds.length &&
    canonical(receipt.providers.map((provider) => provider?.id).sort()) === canonical(expectedProviderIds),
  "Provider behavior receipt provider set is incomplete")
  for (const providerId of expectedProviderIds) {
    const matches = receipt.providers.filter((provider) => provider?.id === providerId)
    requireCondition(matches.length === 1, `Provider behavior receipt must contain exactly one ${providerId} result`)
    const observed = matches[0]
    exactKeys(observed, ["id", "label", "executionBoundary", "sourceSnapshotDigest", "check", "result", "liveAcceptance", "limitations"],
      `${providerId} behavior result`)
    const definition = definitions[providerId]
    requireCondition(observed.label === definition.label && observed.executionBoundary === definition.executionBoundary &&
      observed.result === "pass" && observed.liveAcceptance === "not-established" &&
      canonical(observed.limitations) === canonical(definition.limitations), `${providerId} behavior result differs`)
    requireCondition(observed.sourceSnapshotDigest === await providerBehaviorSourceSnapshot({ repositoryRoot, providerId }),
      `${providerId} behavior source snapshot is stale`)
    exactKeys(observed.check, ["id", "result", "requiredMarkersVerified"], `${providerId} behavior check`)
    requireCondition(observed.check.id === definition.command.id && observed.check.result === "pass" &&
      observed.check.requiredMarkersVerified === definition.command.requiredMarkers.length,
    `${providerId} behavior check differs`)
  }
  return {
    source: "provider-behavior-evidence",
    recordedAt: receipt.recordedAt,
    providers: expectedProviderIds.length,
    checksPassed: expectedProviderIds.length,
    liveAcceptedProviders: 0,
  }
}
