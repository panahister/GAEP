import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { lstat, readFile } from "node:fs/promises"
import { isAbsolute, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const extensionId = "Gaep.VisualStudio.90e45161-916c-4c39-b2bf-c2379c168fe9"
const lifecycle = {
  install: "verified",
  uninstall: "verified-absent",
  reinstall: "verified",
  cleanup: "verified-absent",
}
const remainingRequirements = [
  "Visual Studio activation and rendered Remote UI automation",
  "installed-package engine workflow",
  "real-provider managed read-only and staged-review workflows",
  "supported Windows and Visual Studio matrix",
  "publisher provenance, signing, and Product Owner acceptance",
]
const claimBoundary = "This receipt proves one ephemeral Windows runner package lifecycle only. It is not activation, UI, provider, signing, supported-matrix, release, or human acceptance evidence."

function requireCondition(condition, message) {
  if (!condition) throw new Error(message)
}

function exactKeys(value, keys, label) {
  requireCondition(value !== null && typeof value === "object" && !Array.isArray(value), `${label} must be an object`)
  requireCondition(
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()),
    `${label} fields are incomplete or unexpected`,
  )
}

async function regularFile(path, maximumBytes, label) {
  const metadata = await lstat(path)
  requireCondition(metadata.isFile() && !metadata.isSymbolicLink() && metadata.size > 0 && metadata.size <= maximumBytes,
    `${label} is not a bounded regular file`)
  return metadata
}

async function digest(path) {
  const hash = createHash("sha256")
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return `sha256:${hash.digest("hex")}`
}

export async function verifyVisualStudioWindowsReceipt({ receiptPath, vsixPath, expectedRevision }) {
  const receiptMetadata = await regularFile(receiptPath, 1024 * 1024, "Visual Studio lifecycle receipt")
  const vsixMetadata = await regularFile(vsixPath, 128 * 1024 * 1024, "Visual Studio VSIX")
  let receipt
  try {
    receipt = JSON.parse(await readFile(receiptPath, "utf8"))
  } catch {
    throw new Error("Visual Studio lifecycle receipt is not valid JSON")
  }

  exactKeys(receipt, [
    "schemaVersion", "kind", "recordedAt", "revision", "runnerImage", "visualStudioVersion",
    "package", "lifecycle", "remainingRequirements", "claimBoundary",
  ], "Visual Studio lifecycle receipt")
  requireCondition(receipt.schemaVersion === 1 && receipt.kind === "gaep-visual-studio-windows-package-lifecycle-v1",
    "Visual Studio lifecycle receipt identity is invalid")
  requireCondition(typeof receipt.recordedAt === "string" && receipt.recordedAt.length <= 64 &&
    Number.isFinite(Date.parse(receipt.recordedAt)), "Visual Studio lifecycle timestamp is invalid")
  requireCondition(typeof receipt.revision === "string" && /^[0-9a-f]{40}$/u.test(receipt.revision),
    "Visual Studio lifecycle revision is invalid")
  if (expectedRevision !== undefined) {
    requireCondition(/^[0-9a-fA-F]{40}$/u.test(expectedRevision) &&
      receipt.revision === expectedRevision.toLowerCase(), "Visual Studio lifecycle revision does not match CI")
  }
  requireCondition(typeof receipt.runnerImage === "string" && /^[A-Za-z0-9._-]{1,64}$/u.test(receipt.runnerImage),
    "Visual Studio lifecycle runner image is invalid")
  requireCondition(typeof receipt.visualStudioVersion === "string" && /^17\.14\.\d+\.\d+$/u.test(receipt.visualStudioVersion),
    "Visual Studio lifecycle host version is outside the declared 17.14 line")

  exactKeys(receipt.package, ["id", "version", "bytes", "digest"], "Visual Studio lifecycle package")
  requireCondition(receipt.package.id === extensionId && receipt.package.version === "0.1.0.0",
    "Visual Studio lifecycle package identity changed")
  requireCondition(Number.isSafeInteger(receipt.package.bytes) && receipt.package.bytes === vsixMetadata.size,
    "Visual Studio lifecycle package byte count is stale")
  requireCondition(receipt.package.digest === await digest(vsixPath),
    "Visual Studio lifecycle package digest is stale")
  exactKeys(receipt.lifecycle, Object.keys(lifecycle), "Visual Studio lifecycle states")
  requireCondition(JSON.stringify(receipt.lifecycle) === JSON.stringify(lifecycle),
    "Visual Studio lifecycle states are incomplete")
  requireCondition(JSON.stringify(receipt.remainingRequirements) === JSON.stringify(remainingRequirements),
    "Visual Studio lifecycle remaining requirements changed")
  requireCondition(receipt.claimBoundary === claimBoundary, "Visual Studio lifecycle claim boundary changed")
  const serialized = JSON.stringify(receipt)
  requireCondition(!/[A-Za-z]:[\\/]|file:\/\/|credential|token|secret/iu.test(serialized),
    "Visual Studio lifecycle receipt contains machine-local or secret-shaped data")
  return { receiptBytes: receiptMetadata.size, vsixBytes: vsixMetadata.size, digest: receipt.package.digest }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = new Map()
  for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index]
    const value = process.argv[index + 1]
    if (!key || !value || !["--receipt", "--vsix"].includes(key)) {
      throw new Error("Usage: verify_visual_studio_windows_receipt.mjs --receipt <path> --vsix <path>")
    }
    options.set(key, value)
  }
  const receipt = options.get("--receipt")
  const vsix = options.get("--vsix")
  requireCondition(typeof receipt === "string" && typeof vsix === "string", "Both receipt and VSIX paths are required")
  requireCondition(isAbsolute(resolve(receipt)) && isAbsolute(resolve(vsix)), "Receipt and VSIX paths must resolve absolutely")
  const result = await verifyVisualStudioWindowsReceipt({
    receiptPath: resolve(receipt),
    vsixPath: resolve(vsix),
    expectedRevision: process.env.GITHUB_SHA,
  })
  process.stdout.write(`PASS Visual Studio Windows lifecycle receipt ${result.digest}\n`)
}
