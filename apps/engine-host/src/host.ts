import { CodexAdapter } from "@gaep/adapter-codex"
import { ClaudeAdapter } from "@gaep/adapter-claude"
import { hostRequestSchema, type AdapterCapabilities, type HostRequest } from "@gaep/contracts"
import { GaepEngine } from "@gaep/engine"

function text(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`)
  return value
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

export class EngineHost {
  readonly engine: GaepEngine
  private readonly recovery: Promise<unknown>

  constructor(workspacePath: string) {
    this.engine = new GaepEngine(workspacePath, [new CodexAdapter(), new ClaudeAdapter()])
    this.recovery = this.engine.recoverInterruptedRuns("gaep.engine-host").catch(() => [])
  }

  async dispatch(rawRequest: unknown): Promise<unknown> {
    await this.recovery
    const request = hostRequestSchema.parse(rawRequest)
    const params = request.params
    const actorId = typeof params.actorId === "string" ? params.actorId : "gaep.local-founder"

    switch (request.method) {
      case "ping":
        return { engineVersion: "0.1.0", protocolVersion: 1 }
      case "probeAgents":
        return this.engine.probeAgents()
      case "readProduct":
        return this.engine.readProduct()
      case "createProduct":
        return this.engine.createProduct(record(params.product) as never, actorId)
      case "createInitiative":
        return this.engine.createInitiative(record(params.initiative) as never, actorId)
      case "selectAgent": {
        const capabilities = record(params.capabilities) as AdapterCapabilities
        return this.engine.selectAgent(capabilities, text(params.modelId, "modelId"), record(params.settings), actorId)
      }
      case "createCharter":
        return this.engine.createCharter(record(params.charter) as never, actorId)
      case "confirmCharter":
        return this.engine.confirmCharter(text(params.charterId, "charterId"), actorId)
      case "prepareRun":
        return this.engine.prepareRun(text(params.charterId, "charterId"), actorId)
      case "listRuns":
        return this.engine.listRuns()
      case "createHandoff":
        return this.engine.createHandoff(record(params.handoff) as never, actorId)
      case "verifyAudit":
        return this.engine.repository.verifyAudit()
    }
  }

  static parse(line: string): HostRequest {
    return hostRequestSchema.parse(JSON.parse(line))
  }
}
