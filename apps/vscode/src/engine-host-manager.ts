/**
 * GAEP-P0-CS02 Item 3 — one persistent Engine Host per selected Product root (INV-01/05).
 *
 * Every v3 command (dashboardProjection, providerCatalog, readProviderSelection, selectProviderModel,
 * startReadOnlyAnalysis, readAnalysisRun, listAnalysisRuns, cancelAnalysisRun) reuses the SAME live
 * Engine Host child for the current root. A second host is never started merely to read the Dashboard
 * or to cancel, so it can never reconcile the first host's running analysis as process-loss. The host
 * is shut down and a new one connected only when the Product root changes, the extension is disposed,
 * or the prior host is confirmed dead (crash, protocol incompatibility, packaged-runtime upgrade).
 */

/** The minimal client surface the manager owns; EngineHostClient satisfies it. */
export interface ManagedEngineClient {
  request<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>
  dispose(): void
  onExit(listener: () => void): void
}

export type EngineClientFactory = (rootPath: string) => ManagedEngineClient

interface ClientEntry {
  rootPath: string
  client: ManagedEngineClient
  dead: boolean
}

export class EngineHostClientManager {
  private current: ClientEntry | undefined

  constructor(private readonly factory: EngineClientFactory) {}

  /** The client bound to the current root; started/reused/replaced per the lifecycle rules. */
  client(rootPath: string): ManagedEngineClient {
    if (this.current && this.current.rootPath !== rootPath) {
      // Root change: dispose the old host before connecting the new one.
      this.current.client.dispose()
      this.current = undefined
    }
    if (this.current && this.current.dead) {
      // Prior host is confirmed dead/closed: only now do we reconnect.
      this.current.client.dispose()
      this.current = undefined
    }
    if (!this.current) {
      const entry: ClientEntry = { rootPath, client: this.factory(rootPath), dead: false }
      entry.client.onExit(() => { entry.dead = true })
      this.current = entry
    }
    return this.current.client
  }

  /** Run one v3 call on the reused client for this root. */
  async with<T>(rootPath: string, use: (client: ManagedEngineClient) => Promise<T>): Promise<T> {
    return use(this.client(rootPath))
  }

  /** The root the live host is currently bound to, if any. */
  get currentRoot(): string | undefined {
    return this.current?.rootPath
  }

  dispose(): void {
    this.current?.client.dispose()
    this.current = undefined
  }
}
