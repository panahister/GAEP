import { createHash } from "node:crypto"

import {
  boundaryCheckResultSchema,
  hostConformanceObservationSchema,
  platformReadinessSnapshotSchema,
  type BoundaryCheckResult,
  type HostConformanceObservation,
} from "@gaep/contracts"

export type RpcDispatch = (request: unknown) => Promise<unknown>

const BOUNDARY_EVIDENCE_SOURCE = "packages/conformance/src/rpc-conformance.ts"

/** A v1 request to a v2-only method must be rejected specifically as PROTOCOL_UPGRADE_REQUIRED. */
export function isProtocolUpgradeRequired(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false
  const candidate = error as { kind?: unknown; code?: unknown; data?: { kind?: unknown } }
  return candidate.kind === "PROTOCOL_UPGRADE_REQUIRED"
    || candidate.code === -32_021
    || candidate.data?.kind === "PROTOCOL_UPGRADE_REQUIRED"
}

/** Compact, sanitized descriptor of an unexpected error kind/code for boundary details. */
function describeUnexpected(error: unknown): string {
  if (typeof error !== "object" || error === null) return "unknown error"
  const candidate = error as { kind?: unknown; code?: unknown }
  const kind = typeof candidate.kind === "string" ? candidate.kind : "UNKNOWN"
  const code = typeof candidate.code === "number" ? candidate.code : "n/a"
  return `kind=${kind} code=${code}`
}

/**
 * Contract/boundary check of the engine-host RPC surface for `platformReadiness`.
 * This is a BOUNDARY result — it is never an IDE host row and never enters the Four-IDE matrix.
 * It verifies that a protocol-v2 request returns a schema-valid Base Snapshot and that a
 * protocol-v1 request is rejected (upgrade required).
 */
export async function runEngineHostBoundaryCheck(input: { dispatch: RpcDispatch; now?: string }): Promise<BoundaryCheckResult> {
  const observedAt = input.now ?? new Date().toISOString()
  try {
    const v2 = await input.dispatch({
      jsonrpc: "2.0",
      id: "conformance-v2",
      protocolVersion: 2,
      method: "platformReadiness",
      params: {},
    })
    platformReadinessSnapshotSchema.parse(v2)

    let v1State: "passed" | "failed" = "failed"
    let v1Detail = "v2 returned a schema-valid Base Snapshot but v1 was not rejected."
    try {
      await input.dispatch({ jsonrpc: "2.0", id: "conformance-v1", method: "platformReadiness", params: {} })
    } catch (v1Error) {
      if (isProtocolUpgradeRequired(v1Error)) {
        v1State = "passed"
        v1Detail = "v2 returned a schema-valid Base Snapshot; v1 was correctly rejected as PROTOCOL_UPGRADE_REQUIRED."
      } else {
        v1Detail = `v1 was rejected with an unexpected error (${describeUnexpected(v1Error)}), not PROTOCOL_UPGRADE_REQUIRED.`
      }
    }

    return boundaryCheckResultSchema.parse({
      checkId: "engine-host.platformReadiness.v2",
      target: "engine-host-rpc",
      state: v1State,
      truthClass: "observed",
      observedAt,
      evidenceSource: BOUNDARY_EVIDENCE_SOURCE,
      detail: v1Detail,
    })
  } catch (error) {
    return boundaryCheckResultSchema.parse({
      checkId: "engine-host.platformReadiness.v2",
      target: "engine-host-rpc",
      state: "failed",
      truthClass: "observed",
      observedAt,
      evidenceSource: BOUNDARY_EVIDENCE_SOURCE,
      detail: (error instanceof Error ? error.message : "engine-host boundary check failed").slice(0, 2_000),
    })
  }
}

export interface VsCodeE2eResult {
  /** True only when the VS Code extension-host E2E actually ran. */
  executed: boolean
  passed: boolean
  evidenceSource: string
  /** Raw evidence text (e.g. E2E stdout) hashed into the observation's evidence digest. */
  evidence: string
  now?: string
}

/**
 * Produce a VS Code `HostConformanceObservation` ONLY if the extension-host E2E executed.
 * When the E2E did not run, returns `undefined` so VS Code keeps its Base `not-run` default.
 * Visual Studio, Rider, and Kiro are not executed in this change set and get no such helper —
 * they intentionally produce no observation.
 */
export function observeVsCodeHost(result: VsCodeE2eResult): HostConformanceObservation | undefined {
  if (!result.executed) return undefined
  return hostConformanceObservationSchema.parse({
    host: "vscode",
    checkId: "vscode.extension-host.e2e",
    state: result.passed ? "passed" : "failed",
    truthClass: "observed",
    observedAt: result.now ?? new Date().toISOString(),
    evidenceSource: result.evidenceSource,
    executionResult: "executed",
    evidenceDigest: `sha256:${createHash("sha256").update(result.evidence).digest("hex")}`,
  })
}
