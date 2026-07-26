import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * GAEP-P0-CS02 — VS Code Engine Host client (INV-01/02/21/22).
 *
 * Spawns ONLY the Engine Host runtime bundled inside the installed extension, after verifying
 * its SHA-256 against the sibling `engine-host.sha256`. It never resolves `gaep-engine` from
 * `PATH`. A development override is honored only when `GAEP_DEV_ENGINE=1`.
 */

export const CS02_ENGINE_HOST_BUNDLE = "gaep-engine-host-0.2.0.cjs"
export const CS02_ENGINE_HOST_DIGEST = "engine-host.sha256"
export const CS02_PROTOCOL_VERSION = 3

export interface BundledEngineHost {
  runtimePath: string
  digestPath: string
}

/** Resolve the bundled runtime relative to the installed extension root. */
export function bundledEngineHostPaths(extensionRoot: string): BundledEngineHost {
  const dir = join(extensionRoot, "dist", "engine-host")
  return { runtimePath: join(dir, CS02_ENGINE_HOST_BUNDLE), digestPath: join(dir, CS02_ENGINE_HOST_DIGEST) }
}

/** Parse a `<sha256>  <file>` digest sidecar and return the recorded hash. */
export function parseDigestSidecar(contents: string): string {
  const match = contents.trim().match(/^(sha256:[0-9a-f]{64}|[0-9a-f]{64})\b/)
  if (!match) throw new Error("engine-host digest sidecar is malformed")
  return match[1]!.startsWith("sha256:") ? match[1]! : `sha256:${match[1]!}`
}

/** Verify the bundled runtime's exact bytes against its sidecar digest (INV-22). */
export function verifyBundledEngineHost(paths: BundledEngineHost): string {
  if (!existsSync(paths.runtimePath)) throw new Error("bundled Engine Host runtime is missing")
  if (!existsSync(paths.digestPath)) throw new Error("bundled Engine Host digest is missing")
  const expected = parseDigestSidecar(readFileSync(paths.digestPath, "utf8"))
  const actual = `sha256:${createHash("sha256").update(readFileSync(paths.runtimePath)).digest("hex")}`
  if (actual !== expected) throw new Error("bundled Engine Host digest mismatch; refusing to start")
  return actual
}

export interface EngineHostLaunch {
  command: string
  args: string[]
  env: NodeJS.ProcessEnv
}

/**
 * Resolve how to launch the Engine Host. Production always uses the digest-verified bundle
 * through the IDE's own Node runtime; the PATH executable is used only under the dev override.
 */
export function resolveEngineHostLaunch(options: {
  extensionRoot: string
  workspacePath: string
  execPath: string
  env: NodeJS.ProcessEnv
}): EngineHostLaunch {
  const devOverride = options.env.GAEP_DEV_ENGINE === "1" ? options.env.GAEP_ENGINE_EXECUTABLE : undefined
  if (devOverride) {
    return { command: devOverride, args: ["--workspace", options.workspacePath], env: { ...options.env } }
  }
  const paths = bundledEngineHostPaths(options.extensionRoot)
  verifyBundledEngineHost(paths)
  return {
    command: options.execPath,
    args: [paths.runtimePath, "--workspace", options.workspacePath],
    env: { ...options.env, ELECTRON_RUN_AS_NODE: "1" },
  }
}

type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void }

/** Minimal newline-delimited JSON-RPC v3 client over the Engine Host's stdio. */
export class EngineHostClient {
  private child: ChildProcessWithoutNullStreams | undefined
  private readonly pending = new Map<number | string, Pending>()
  private readonly exitListeners = new Set<() => void>()
  private buffer = ""
  private nextId = 0

  constructor(private readonly launch: EngineHostLaunch) {}

  start(): void {
    if (this.child) return
    const child = spawn(this.launch.command, this.launch.args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: this.launch.env,
    }) as ChildProcessWithoutNullStreams
    child.stdout.setEncoding("utf8")
    child.stdout.on("data", (chunk: string) => this.onData(chunk))
    child.on("exit", () => {
      for (const pending of this.pending.values()) pending.reject(new Error("Engine Host exited"))
      this.pending.clear()
      this.child = undefined
      for (const listener of this.exitListeners) listener()
    })
    this.child = child
  }

  /** True while a live Engine Host child process is attached. */
  isAlive(): boolean {
    return this.child !== undefined
  }

  /** Register a listener fired when the Engine Host child exits (crash or shutdown). */
  onExit(listener: () => void): void {
    this.exitListeners.add(listener)
  }

  private onData(chunk: string): void {
    this.buffer += chunk
    let index = this.buffer.indexOf("\n")
    while (index >= 0) {
      const line = this.buffer.slice(0, index).trim()
      this.buffer = this.buffer.slice(index + 1)
      if (line) this.onMessage(line)
      index = this.buffer.indexOf("\n")
    }
  }

  private onMessage(line: string): void {
    let message: { id?: number | string; result?: unknown; error?: { message?: string; data?: { kind?: string } } }
    try {
      message = JSON.parse(line)
    } catch {
      return
    }
    if (message.id === undefined) return
    const pending = this.pending.get(message.id)
    if (!pending) return
    this.pending.delete(message.id)
    if (message.error) {
      const error = new Error(message.error.message ?? "Engine Host error") as Error & { kind?: string }
      error.kind = message.error.data?.kind
      pending.reject(error)
    } else {
      pending.resolve(message.result)
    }
  }

  /** Every CS02 call uses protocol version 3 over the same shared boundary (INV-01). */
  async request<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    if (!this.child) this.start()
    const id = ++this.nextId
    const frame = `${JSON.stringify({ jsonrpc: "2.0", id, protocolVersion: CS02_PROTOCOL_VERSION, method, params })}\n`
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject })
      this.child!.stdin.write(frame)
    })
  }

  dispose(): void {
    this.child?.stdin.end()
    this.child?.kill()
    this.child = undefined
    this.exitListeners.clear()
  }
}
