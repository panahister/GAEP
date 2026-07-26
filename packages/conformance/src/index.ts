import { createHash } from "node:crypto"

import {
  hostConformanceObservationSchema,
  platformReadinessReportSchema,
  platformReadinessSnapshotSchema,
  type BoundaryCheckResult,
  type HostConformanceObservation,
  type HostMatrixReportRow,
  type PlatformReadinessReport,
  type PlatformReadinessSnapshot,
} from "@gaep/contracts"

export * from "./rpc-conformance.js"
export * from "./evidence.js"

export interface ComposePlatformReadinessInput {
  base: PlatformReadinessSnapshot
  /** Only schema-valid, executed host observations are accepted; anything else is rejected. */
  observations?: ReadonlyArray<HostConformanceObservation>
  /** Engine-host RPC/contract boundary results — never treated as IDE host rows. */
  boundaryChecks?: ReadonlyArray<BoundaryCheckResult>
  changeSetId?: string
  now?: string
}

/**
 * The single, explicit merge of executed host observations into the engine's Base Snapshot.
 * A Base host row is overwritten ONLY where a matching, schema-valid observation exists;
 * every other host keeps its `not-run`/`pending-environment` default (unknown stays unknown).
 * Direct host-state overrides are rejected — only `HostConformanceObservation` records count.
 */
export function composePlatformReadinessReport(input: ComposePlatformReadinessInput): PlatformReadinessReport {
  // Runtime-validate the Base Snapshot before composition (never trust the caller's shape).
  platformReadinessSnapshotSchema.parse(input.base)
  const byHost = new Map<string, HostConformanceObservation>()
  for (const candidate of input.observations ?? []) {
    // Reject anything that is not a schema-valid, executed observation.
    const observation = hostConformanceObservationSchema.parse(candidate)
    if (byHost.has(observation.host)) {
      throw new Error(`Duplicate host-conformance observation for host "${observation.host}"`)
    }
    byHost.set(observation.host, observation)
  }

  const hostMatrix: HostMatrixReportRow[] = input.base.hostMatrix.map((row) => {
    const observation = byHost.get(row.host)
    if (!observation) return { host: row.host, state: row.state, source: "base-default" }
    return { host: observation.host, state: observation.state, source: "observation", observation }
  })

  return platformReadinessReportSchema.parse({
    schemaVersion: 1,
    ...(input.changeSetId ? { changeSetId: input.changeSetId } : {}),
    generatedAt: input.now ?? new Date().toISOString(),
    engineVersion: input.base.engineVersion,
    providers: input.base.providers,
    workspace: input.base.workspace,
    hostMatrix,
    boundaryChecks: [...(input.boundaryChecks ?? [])],
  })
}

/** Compact, host-neutral JSON matrix for the conformance report artifact. */
export function conformanceMatrixJson(report: PlatformReadinessReport): string {
  return `${JSON.stringify({
    generatedAt: report.generatedAt,
    boundaryChecks: report.boundaryChecks,
    fourIdeHostMatrix: report.hostMatrix.map((row) => ({
      host: row.host,
      state: row.state,
      observed: row.source === "observation",
    })),
  }, null, 2)}\n`
}

export function sha256Hex(text: string): string {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`
}
export * from "./host-conformance.js"
