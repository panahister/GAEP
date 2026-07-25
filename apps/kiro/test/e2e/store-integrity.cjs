const { createHash } = require("node:crypto")
const { lstat, open, readdir, realpath } = require("node:fs/promises")
const path = require("node:path")

const maximumFiles = 512
const maximumFileBytes = 2 * 1024 * 1024
const maximumStoreBytes = 16 * 1024 * 1024

function fail(message) {
  throw new Error(`Invalid GAEP Kiro fixture store: ${message}`)
}

function digest(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`
}

async function readBoundFile(filePath, relativePath) {
  const handle = await open(filePath, "r")
  try {
    const before = await handle.stat()
    if (!before.isFile() || before.size < 1 || before.size > maximumFileBytes) {
      fail(`${relativePath} is outside its regular-file byte boundary`)
    }
    const content = await handle.readFile()
    const after = await handle.stat()
    if (!after.isFile() || before.dev !== after.dev || before.ino !== after.ino ||
        before.size !== after.size || before.mtimeMs !== after.mtimeMs || content.length !== after.size) {
      fail(`${relativePath} changed while it was inspected`)
    }
    return { path: relativePath, bytes: content.length, digest: digest(content) }
  } finally {
    await handle.close()
  }
}

async function inspectPortableStore(storePath) {
  const root = path.resolve(storePath)
  const rootStat = await lstat(root)
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail("store root must be a regular directory")
  const canonicalRoot = await realpath(root)
  const files = []
  let byteCount = 0

  async function visit(directory, segments) {
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((left, right) => left.name.localeCompare(right.name))
    for (const entry of entries) {
      if (!entry.name || entry.name === "." || entry.name === ".." || entry.name.includes("/") || entry.name.includes("\\")) {
        fail("store contains an invalid entry name")
      }
      const childSegments = [...segments, entry.name]
      const relativePath = childSegments.join("/")
      const child = path.resolve(directory, entry.name)
      const relative = path.relative(canonicalRoot, child)
      if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) fail(`${relativePath} escaped the store root`)
      const stat = await lstat(child)
      if (stat.isSymbolicLink()) fail(`${relativePath} must not be a symbolic link`)
      if (stat.isDirectory()) {
        await visit(child, childSegments)
        continue
      }
      if (!stat.isFile()) fail(`${relativePath} must be a regular file`)
      if (files.length >= maximumFiles) fail(`store exceeds ${maximumFiles} files`)
      const file = await readBoundFile(child, relativePath)
      byteCount += file.bytes
      if (byteCount > maximumStoreBytes) fail(`store exceeds ${maximumStoreBytes} bytes`)
      files.push(file)
    }
  }

  await visit(canonicalRoot, [])
  if (files.length === 0) fail("store must contain portable records")
  files.sort((left, right) => left.path.localeCompare(right.path))
  const manifest = {
    kind: "gaep-kiro-e2e-store-manifest-v1",
    fileCount: files.length,
    byteCount,
    files,
  }
  return Object.freeze({ ...manifest, digest: digest(JSON.stringify(manifest)) })
}

async function verifyPortableStore(storePath, expected) {
  if (!expected || expected.kind !== "gaep-kiro-e2e-store-manifest-v1" ||
      !Number.isSafeInteger(expected.fileCount) || !Number.isSafeInteger(expected.byteCount) ||
      !/^sha256:[0-9a-f]{64}$/.test(expected.digest ?? "") || !Array.isArray(expected.files)) {
    fail("expected manifest is invalid")
  }
  const actual = await inspectPortableStore(storePath)
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail("store content differs from the exact baseline manifest")
  return actual
}

module.exports = { inspectPortableStore, verifyPortableStore }
