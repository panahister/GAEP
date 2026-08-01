import { constants } from "node:fs"
import { lstat, mkdir, open, realpath } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve, sep } from "node:path"

function isMissing(error) {
  return error instanceof Error && "code" in error && error.code === "ENOENT"
}

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino
}

function sameVersion(left, right) {
  return sameIdentity(left, right) && left.size === right.size && left.mtimeNs === right.mtimeNs
}

async function repositoryTarget(repositoryRoot, requestedPath) {
  if (typeof requestedPath !== "string" || requestedPath.length < 1 || requestedPath.includes("\0") ||
      requestedPath.includes("\\") || isAbsolute(requestedPath)) {
    throw new Error("Repository path must be a non-empty relative POSIX path")
  }
  const canonicalRoot = await realpath(resolve(repositoryRoot))
  const rootMetadata = await lstat(canonicalRoot, { bigint: true })
  if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) {
    throw new Error("Repository root must be a regular directory")
  }
  const target = resolve(canonicalRoot, requestedPath)
  const difference = relative(canonicalRoot, target)
  if (difference === "" || difference === ".." || difference.startsWith(`..${sep}`) || isAbsolute(difference)) {
    throw new Error("Repository path escaped the repository")
  }
  return {
    canonicalRoot,
    target,
    relativePath: difference.split(sep).join("/"),
  }
}

async function assertDirectory(path, label) {
  const metadata = await lstat(path, { bigint: true })
  if (!metadata.isDirectory() || metadata.isSymbolicLink() || await realpath(path) !== path) {
    throw new Error(`${label} must be a non-symlink directory inside the repository`)
  }
  return metadata
}

async function ensureSafeParent(canonicalRoot, target) {
  const parent = dirname(target)
  const parentRelative = relative(canonicalRoot, parent)
  const segments = parentRelative === "" ? [] : parentRelative.split(sep)
  let current = canonicalRoot
  for (const segment of segments) {
    current = resolve(current, segment)
    try {
      await assertDirectory(current, "Repository path ancestor")
    } catch (error) {
      if (!isMissing(error)) throw error
      try {
        await mkdir(current, { mode: 0o700 })
      } catch (mkdirError) {
        if (!(mkdirError instanceof Error && "code" in mkdirError && mkdirError.code === "EEXIST")) {
          throw mkdirError
        }
      }
      await assertDirectory(current, "Repository path ancestor")
    }
  }
  await assertDirectory(parent, "Repository output parent")
}

async function assertExistingPath(canonicalRoot, target) {
  const difference = relative(canonicalRoot, target)
  const segments = difference.split(sep)
  let current = canonicalRoot
  for (let index = 0; index < segments.length; index += 1) {
    current = resolve(current, segments[index])
    const metadata = await lstat(current, { bigint: true })
    if (metadata.isSymbolicLink()) throw new Error("Repository path must not contain symbolic links")
    if (index < segments.length - 1 && !metadata.isDirectory()) {
      throw new Error("Repository path ancestor must be a directory")
    }
  }
  if (await realpath(target) !== target) throw new Error("Repository path resolved through an unsafe alias")
}

async function assertOpenFileIdentity(handle, canonicalRoot, target, expected) {
  const opened = await handle.stat({ bigint: true })
  const presented = await lstat(target, { bigint: true })
  if (!opened.isFile() || opened.isSymbolicLink() || !presented.isFile() || presented.isSymbolicLink() ||
      !sameIdentity(opened, presented) || (expected && !sameIdentity(opened, expected))) {
    throw new Error("Repository file identity changed")
  }
  const canonicalTarget = await realpath(target)
  const difference = relative(canonicalRoot, canonicalTarget)
  if (canonicalTarget !== target || difference === "" || difference === ".." ||
      difference.startsWith(`..${sep}`) || isAbsolute(difference)) {
    throw new Error("Repository file resolved outside the repository")
  }
  return opened
}

export async function readRepositoryRegularFile(
  repositoryRoot,
  requestedPath,
  { minimumBytes = 1, maximumBytes = 128 * 1024 * 1024 } = {},
) {
  const { canonicalRoot, target, relativePath } = await repositoryTarget(repositoryRoot, requestedPath)
  await assertExistingPath(canonicalRoot, target)
  const before = await lstat(target, { bigint: true })
  if (!before.isFile() || before.isSymbolicLink() ||
      before.size < BigInt(minimumBytes) || before.size > BigInt(maximumBytes)) {
    throw new Error(`Repository file is unsafe or outside its size bound: ${relativePath}`)
  }
  const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0
  const handle = await open(target, constants.O_RDONLY | noFollow)
  try {
    await assertOpenFileIdentity(handle, canonicalRoot, target, before)
    const bytes = await handle.readFile()
    const after = await handle.stat({ bigint: true })
    const presentedAfter = await lstat(target, { bigint: true })
    if (!sameVersion(before, after) || !sameVersion(after, presentedAfter) ||
        bytes.byteLength !== Number(after.size)) {
      throw new Error(`Repository file changed while it was being read: ${relativePath}`)
    }
    await assertOpenFileIdentity(handle, canonicalRoot, target, before)
    return { bytes, relativePath }
  } finally {
    await handle.close()
  }
}

export async function writeExclusiveRepositoryFile(repositoryRoot, requestedPath, content) {
  const { canonicalRoot, target, relativePath } = await repositoryTarget(repositoryRoot, requestedPath)
  await ensureSafeParent(canonicalRoot, target)
  const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0
  let handle
  try {
    handle = await open(target, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow, 0o600)
  } catch (error) {
    if (error instanceof Error && "code" in error && ["EEXIST", "ELOOP"].includes(String(error.code))) {
      throw new Error(`Repository output already exists or is a symbolic link: ${relativePath}`)
    }
    throw error
  }
  try {
    await assertOpenFileIdentity(handle, canonicalRoot, target)
    await handle.writeFile(content, "utf8")
    await handle.sync()
    const written = await assertOpenFileIdentity(handle, canonicalRoot, target)
    if (written.size !== BigInt(Buffer.byteLength(content))) {
      throw new Error(`Repository output size differs after write: ${relativePath}`)
    }
  } finally {
    await handle.close()
  }
  return relativePath
}
