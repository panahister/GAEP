export interface ManagedAgentRun {
  readonly runId: string
  readonly rootPath: string
  stopAndWait(timeoutMs?: number): Promise<void>
}

export interface StopRunsResult {
  stoppedRunIds: string[]
  failures: Array<{ runId: string; error: string }>
  remainingRunIds: string[]
}

export class ActiveRunRegistry {
  private readonly runs = new Map<string, ManagedAgentRun>()

  register(run: ManagedAgentRun): () => void {
    if (this.runs.has(run.runId)) throw new Error(`Run ${run.runId} is already registered`)
    const existing = this.list().find((candidate) => candidate.rootPath === run.rootPath)
    if (existing) {
      throw new Error(`Run ${existing.runId} is already active for Product root ${run.rootPath}`)
    }
    this.runs.set(run.runId, run)
    return () => {
      if (this.runs.get(run.runId) === run) this.runs.delete(run.runId)
    }
  }

  get size(): number {
    return this.runs.size
  }

  list(): ManagedAgentRun[] {
    return [...this.runs.values()]
  }

  hasRoot(rootPath: string): boolean {
    return this.list().some((run) => run.rootPath === rootPath)
  }

  async stopAll(timeoutMs = 8_000): Promise<StopRunsResult> {
    const stoppedRunIds: string[] = []
    const failures: StopRunsResult["failures"] = []
    const snapshot = this.list()
    await Promise.all(snapshot.map(async (run) => {
      try {
        await run.stopAndWait(timeoutMs)
        stoppedRunIds.push(run.runId)
        if (this.runs.get(run.runId) === run) this.runs.delete(run.runId)
      } catch (error) {
        failures.push({
          runId: run.runId,
          error: error instanceof Error ? error.message : "Unknown process-stop failure",
        })
      }
    }))
    return { stoppedRunIds, failures, remainingRunIds: this.list().map((run) => run.runId) }
  }
}
