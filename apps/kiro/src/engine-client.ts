import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { access, realpath, stat } from "node:fs/promises"
import { delimiter, dirname, extname, isAbsolute, resolve } from "node:path"
import { once } from "node:events"

import {
  defaultPageSize,
  frameTooLarge,
  GaepHostError,
  hostUnavailable,
  invalidHostResponse,
  invalidUtf8,
  maximumFrameBytes,
  normalizeActorId,
  normalizeExistingLocalFolder,
  normalizeUuid,
  parseHostResult,
  parsePageResult,
  parseProductBinding,
  parseSnapshotResult,
  protocolVersion,
  responseTooLarge,
  validatePage,
  validateProductRevision,
  type PortableDesignSnapshotPage,
  type PortableDesignSnapshotSummary,
  type ProductBinding,
} from "./protocol.js"

export interface EngineClientOptions {
  readonly workspacePath: string
  readonly engineExecutable?: string
  readonly expectedEngineSha256?: string
  readonly engineArgumentsPrefix?: readonly string[]
  readonly sourceEnvironment?: NodeJS.ProcessEnv
}

interface EngineIdentity {
  readonly path: string
  readonly digest: string
}

const safeEnvironmentNames = [
  "PATH", "LANG", "LC_ALL", "LC_CTYPE", "TMPDIR", "TMP", "TEMP",
  "SYSTEMROOT", "WINDIR", "PATHEXT", "COMSPEC",
] as const

export function safeEngineEnvironment(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = Object.create(null) as NodeJS.ProcessEnv
  for (const name of safeEnvironmentNames) {
    const value = environmentValue(source, name)
    if (value !== undefined) environment[name] = value
  }
  environment.GAEP_HOST_SURFACE = "kiro-portable-design"
  return environment
}

export class GaepEngineClient {
  private readonly configuredDigest: string | undefined
  private readonly requestedExecutable: string
  private readonly engineArgumentsPrefix: readonly string[]
  private readonly childEnvironment: NodeJS.ProcessEnv
  private requestTail: Promise<void> = Promise.resolve()
  private nextId = 0
  private child: ChildProcessWithoutNullStreams | undefined
  private stdoutIterator: AsyncIterator<Buffer> | undefined
  private pendingResponse: Buffer<ArrayBufferLike> = Buffer.alloc(0)
  private boundIdentity: EngineIdentity | undefined
  private disposed = false

  private constructor(
    private readonly workspacePath: string,
    options: EngineClientOptions,
  ) {
    this.requestedExecutable = options.engineExecutable ?? process.env.GAEP_ENGINE_EXECUTABLE ?? "gaep-engine"
    this.configuredDigest = normalizeDigest(options.expectedEngineSha256 ?? process.env.GAEP_ENGINE_SHA256)
    this.engineArgumentsPrefix = Object.freeze([...(options.engineArgumentsPrefix ?? [])])
    this.childEnvironment = safeEngineEnvironment(options.sourceEnvironment ?? process.env)
  }

  static async create(options: EngineClientOptions): Promise<GaepEngineClient> {
    const workspacePath = await normalizeExistingLocalFolder(options.workspacePath)
    return new GaepEngineClient(workspacePath, options)
  }

  readProduct(): Promise<ProductBinding> {
    return this.enqueue(async () => parseProductBinding(await this.request("readProduct", {})))
  }

  importPortableDesignSnapshot(input: {
    readonly bundleRoot: string
    readonly expectedProductId: string
    readonly expectedProductRevision: number
    readonly actorId: string
  }): Promise<PortableDesignSnapshotSummary> {
    return this.enqueue(async () => {
      const bundleRoot = await normalizeExistingLocalFolder(input.bundleRoot)
      const productId = normalizeUuid(input.expectedProductId, "Product ID")
      const productRevision = validateProductRevision(input.expectedProductRevision)
      const actorId = normalizeActorId(input.actorId)
      const result = await this.request("productStudio.portableDesign.import", {
        bundleRoot,
        expectedProductId: productId,
        expectedProductRevision: productRevision,
        actorId,
      })
      return parseSnapshotResult(result, { productId })
    })
  }

  listPortableDesignSnapshots(offset = 0, limit = defaultPageSize): Promise<PortableDesignSnapshotPage> {
    return this.enqueue(async () => {
      validatePage(offset, limit)
      return parsePageResult(
        await this.request("productStudio.portableDesign.list", { offset, limit }),
        offset,
        limit,
      )
    })
  }

  readPortableDesignSnapshot(bundleId: string): Promise<PortableDesignSnapshotSummary> {
    return this.enqueue(async () => {
      const normalizedBundleId = normalizeUuid(bundleId, "Bundle ID")
      return parseSnapshotResult(
        await this.request("productStudio.portableDesign.read", { bundleId: normalizedBundleId }),
        { bundleId: normalizedBundleId },
      )
    })
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    await this.requestTail.catch(() => undefined)
    this.stopProcess()
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    if (this.disposed) return Promise.reject(hostUnavailable())
    const result = this.requestTail.then(operation, operation)
    this.requestTail = result.then(() => undefined, () => undefined)
    return result
  }

  private async request(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (this.disposed) throw hostUnavailable()
    const id = ++this.nextId
    if (!Number.isSafeInteger(id)) {
      this.stopProcess()
      throw hostUnavailable()
    }
    const serialized = JSON.stringify({ jsonrpc: "2.0", id, method, params, protocolVersion })
    if (Buffer.byteLength(serialized) > maximumFrameBytes) throw frameTooLarge()

    let raw: string
    try {
      await this.ensureStarted()
      const child = this.child
      if (!child || child.exitCode !== null || !child.stdin.writable) throw hostUnavailable()
      if (!child.stdin.write(`${serialized}\n`, "utf8")) await once(child.stdin, "drain")
      raw = await this.readResponseFrame()
    } catch (error) {
      this.stopProcess()
      if (error instanceof GaepHostError) throw error
      throw hostUnavailable()
    }

    try {
      return parseHostResult(raw, id)
    } catch (error) {
      if (error instanceof GaepHostError && error.kind === "HOST_RESPONSE_INVALID") this.stopProcess()
      if (error instanceof GaepHostError) throw error
      this.stopProcess()
      throw invalidHostResponse()
    }
  }

  private async ensureStarted(): Promise<void> {
    if (this.child && this.child.exitCode === null && !this.child.killed) return
    this.stopProcess()
    const identity = await this.resolveAndVerifyEngine()
    const child = spawn(
      identity.path,
      [...this.engineArgumentsPrefix, "--workspace", this.workspacePath],
      {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
        env: this.childEnvironment,
      },
    )
    child.on("error", () => {
      // A permanent listener prevents late spawn/process errors from escaping the extension host.
    })
    child.stdin.on("error", () => {
      // The active request observes closure/write failure and converts it to a stable host error.
    })
    child.stdout.on("error", () => {
      // The async iterator observes stream failure; never surface a raw stream error globally.
    })
    child.stderr.on("error", () => {
      // Stderr is intentionally drained and never copied into user-facing diagnostics.
    })
    child.stderr.resume()
    try {
      await once(child, "spawn")
      if (await digest(identity.path) !== identity.digest) {
        throw new Error("The GAEP engine executable changed while the host process was starting")
      }
      this.child = child
      this.stdoutIterator = child.stdout[Symbol.asyncIterator]() as AsyncIterator<Buffer>
      this.pendingResponse = Buffer.alloc(0)
    } catch (error) {
      child.kill()
      throw error
    }
  }

  private async resolveAndVerifyEngine(): Promise<EngineIdentity> {
    const path = await resolveExecutable(this.requestedExecutable, this.childEnvironment)
    const executableDigest = await digest(path)
    if (this.configuredDigest && this.configuredDigest !== executableDigest) {
      throw new Error("The GAEP engine executable does not match the configured SHA-256 digest")
    }
    if (this.boundIdentity && (samePath(this.boundIdentity.path, path) === false || this.boundIdentity.digest !== executableDigest)) {
      throw new Error("The bound GAEP engine executable changed after this client was created")
    }
    this.boundIdentity ??= Object.freeze({ path, digest: executableDigest })
    return this.boundIdentity
  }

  private async readResponseFrame(): Promise<string> {
    while (true) {
      const newline = this.pendingResponse.indexOf(0x0a)
      if (newline >= 0) {
        if (newline > maximumFrameBytes) throw responseTooLarge()
        const length = newline > 0 && this.pendingResponse[newline - 1] === 0x0d ? newline - 1 : newline
        const frame = this.pendingResponse.subarray(0, length)
        this.pendingResponse = this.pendingResponse.subarray(newline + 1)
        try {
          return new TextDecoder("utf-8", { fatal: true }).decode(frame)
        } catch {
          throw invalidUtf8()
        }
      }
      if (this.pendingResponse.length > maximumFrameBytes) throw responseTooLarge()
      const iterator = this.stdoutIterator
      if (!iterator) throw hostUnavailable()
      const next = await iterator.next()
      if (next.done) throw hostUnavailable()
      const chunk = Buffer.isBuffer(next.value) ? next.value : Buffer.from(next.value)
      this.pendingResponse = this.pendingResponse.length === 0
        ? chunk
        : Buffer.concat([this.pendingResponse, chunk], this.pendingResponse.length + chunk.length)
    }
  }

  private stopProcess(): void {
    const child = this.child
    this.child = undefined
    this.stdoutIterator = undefined
    this.pendingResponse = Buffer.alloc(0)
    if (!child) return
    child.stdin.destroy()
    child.stdout.destroy()
    child.stderr.destroy()
    if (child.exitCode === null) child.kill()
  }
}

async function resolveExecutable(requested: string, environment: NodeJS.ProcessEnv): Promise<string> {
  if (!requested || requested.length > 32_768 || requested.includes("\0")) {
    throw new Error("The GAEP engine executable is invalid")
  }
  const hasDirectory = requested.includes("/") || requested.includes("\\") || dirname(requested) !== "."
  const candidates = isAbsolute(requested) || hasDirectory
    ? [resolve(requested)]
    : executableCandidates(requested, environment)
  for (const candidate of candidates) {
    try {
      await access(candidate)
      const canonical = await realpath(candidate)
      if ((await stat(canonical)).isFile()) return canonical
    } catch {
      // Continue to the next explicit PATH candidate without surfacing machine paths.
    }
  }
  throw new Error("The GAEP engine executable could not be resolved to an existing file")
}

function executableCandidates(requested: string, environment: NodeJS.ProcessEnv): string[] {
  const path = environmentValue(environment, "PATH") ?? ""
  const extensions = process.platform === "win32"
    ? (environmentValue(environment, "PATHEXT") ?? ".EXE;.CMD;.BAT").split(";").filter(Boolean)
    : [""]
  return path.split(delimiter).filter(Boolean).flatMap((directory) => extensions.map((extension) => {
    const requestedExtension = extname(requested)
    const name = requestedExtension || !extension ? requested : `${requested}${extension}`
    return resolve(directory, name)
  }))
}

function digest(path: string): Promise<string> {
  return new Promise((resolveDigest, reject) => {
    const hash = createHash("sha256")
    const input = createReadStream(path)
    input.on("error", reject)
    input.on("data", (chunk) => hash.update(chunk))
    input.on("end", () => resolveDigest(hash.digest("hex")))
  })
}

function normalizeDigest(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined
  if (value.length > 80) throw new TypeError("Expected engine SHA-256 must contain exactly 64 hexadecimal characters")
  const normalized = value.trim().toLowerCase().replace(/^sha256:/u, "")
  if (!/^[0-9a-f]{64}$/u.test(normalized)) {
    throw new TypeError("Expected engine SHA-256 must contain exactly 64 hexadecimal characters")
  }
  return normalized
}

function samePath(left: string, right: string): boolean {
  return process.platform === "win32" ? left.toLowerCase() === right.toLowerCase() : left === right
}

function environmentValue(source: NodeJS.ProcessEnv, requestedName: string): string | undefined {
  const exact = source[requestedName]
  if (exact !== undefined) return exact
  const actualName = Object.keys(source).find((name) => name.toUpperCase() === requestedName.toUpperCase())
  return actualName ? source[actualName] : undefined
}
