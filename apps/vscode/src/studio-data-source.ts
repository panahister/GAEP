import {
  parseStudioToHostMessage,
  studioProtocolVersion,
  type HostToStudioMessage,
  type StudioAction,
  type StudioActionResult,
  type StudioRoute,
  type StudioSnapshot,
  type StudioToHostMessage,
} from "./studio-protocol.js"

export interface StudioRequestContext {
  requestId: string
  expectedContextGeneration: string
  expectedSnapshotRevision: number
  signal?: AbortSignal
}

export interface StudioDataSource {
  readSnapshot(route: StudioRoute, signal?: AbortSignal): Promise<StudioSnapshot>
  execute(action: StudioAction, context: StudioRequestContext): Promise<StudioActionResult>
}

export interface StudioMessageControllerOptions {
  channelId: string
  initialRoute?: StudioRoute
  createRequestId?: () => string
}

export class StudioMessageController {
  private route: StudioRoute
  private readonly channelId: string
  private readonly createRequestId: () => string

  constructor(
    private readonly dataSource: StudioDataSource,
    options: StudioMessageControllerOptions,
  ) {
    this.route = options.initialRoute ?? "overview"
    this.channelId = options.channelId
    this.createRequestId = options.createRequestId ?? (() => crypto.randomUUID())
  }

  async handle(value: unknown, signal?: AbortSignal): Promise<HostToStudioMessage | undefined> {
    signal?.throwIfAborted()
    const message = parseStudioToHostMessage(value, this.channelId)
    if (!message) return undefined
    switch (message.type) {
      case "studio.ready": {
        this.route = message.restoredRoute ?? this.route
        return this.snapshotMessage(await this.dataSource.readSnapshot(this.route, signal))
      }
      case "studio.navigate": {
        this.route = message.route
        return this.snapshotMessage(await this.dataSource.readSnapshot(this.route, signal))
      }
      case "studio.action":
        return this.perform(message, signal)
    }
  }

  currentRoute(): StudioRoute {
    return this.route
  }

  async refresh(route?: StudioRoute, signal?: AbortSignal): Promise<HostToStudioMessage> {
    if (route) this.route = route
    return this.snapshotMessage(await this.dataSource.readSnapshot(this.route, signal))
  }

  private async perform(
    message: Extract<StudioToHostMessage, { type: "studio.action" }>,
    signal?: AbortSignal,
  ): Promise<HostToStudioMessage> {
    let result: StudioActionResult
    try {
      result = await this.dataSource.execute(message.action, {
        requestId: message.requestId,
        expectedContextGeneration: message.expectedContextGeneration,
        expectedSnapshotRevision: message.expectedSnapshotRevision,
        signal,
      })
    } catch {
      result = {
        status: "rejected",
        announcement: "The operation could not be completed. Review GAEP diagnostics.",
        diagnosticId: this.createRequestId(),
      }
    }
    let snapshot: StudioSnapshot | undefined
    if (result.status === "accepted") {
      if (message.action.kind === "navigate") this.route = message.action.route
      snapshot = await this.dataSource.readSnapshot(this.route, signal)
    }
    return {
      protocolVersion: studioProtocolVersion,
      channelId: this.channelId,
      type: "studio.action-result",
      requestId: message.requestId,
      result,
      snapshot,
    }
  }

  private snapshotMessage(snapshot: StudioSnapshot): HostToStudioMessage {
    if (snapshot.route !== this.route) {
      throw new Error(`Studio data source returned ${snapshot.route} while ${this.route} was requested`)
    }
    return {
      protocolVersion: studioProtocolVersion,
      channelId: this.channelId,
      type: "studio.snapshot",
      snapshot,
    }
  }
}
