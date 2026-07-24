import { describe, expect, it } from "vitest"

import {
  evidenceManifestSchema,
  hostConformanceObservationSchema,
  hostMatrixDefaultRowSchema,
  hostMatrixReportRowSchema,
  observationResultSchema,
  platformReadinessReportSchema,
  platformReadinessSnapshotSchema,
  readinessEvidenceEnvelopeSchema,
} from "./index.js"

const observedAt = "2026-07-24T00:00:00.000Z"
const digest = `sha256:${"a".repeat(64)}`

function baseSnapshot(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    generatedAt: observedAt,
    engineVersion: "0.1.0",
    providers: [{
      adapterId: "gaep.codex-cli",
      agentId: "codex-cli",
      agentLabel: "Codex",
      detected: false,
      executionInterface: "unavailable",
      supportsModelDiscovery: false,
      models: [],
      truthClass: "not-observed",
      observedAt,
    }],
    workspace: {
      status: "uninitialized",
      initialized: false,
      auditValid: true,
      lockPresent: false,
      issueCount: 0,
      truthClass: "observed",
      observedAt,
    },
    hostMatrix: [
      { host: "vscode", state: "not-run", source: "base-default" },
      { host: "visual-studio", state: "pending-environment", source: "base-default" },
      { host: "rider", state: "pending-environment", source: "base-default" },
      { host: "kiro", state: "pending-environment", source: "base-default" },
    ],
  }
}

function observation(): Record<string, unknown> {
  return {
    host: "vscode",
    checkId: "vscode.extension-host.e2e",
    state: "passed",
    truthClass: "observed",
    observedAt,
    evidenceSource: "apps/vscode/test/e2e",
    executionResult: "executed",
    evidenceDigest: digest,
  }
}

describe("platform readiness contract", () => {
  it("accepts a valid Base Snapshot with exactly four host rows", () => {
    expect(() => platformReadinessSnapshotSchema.parse(baseSnapshot())).not.toThrow()
  })

  it("rejects a host matrix that is not the Four-IDE matrix length", () => {
    const snapshot = baseSnapshot()
    ;(snapshot.hostMatrix as unknown[]).pop()
    expect(platformReadinessSnapshotSchema.safeParse(snapshot).success).toBe(false)
  })

  it("rejects an unknown IDE host", () => {
    const snapshot = baseSnapshot()
    const rows = snapshot.hostMatrix as Array<{ host: string }>
    rows[0]!.host = "eclipse"
    expect(platformReadinessSnapshotSchema.safeParse(snapshot).success).toBe(false)
  })

  it("requires an executed observation to carry provenance and a sha256 evidence digest", () => {
    expect(() => hostConformanceObservationSchema.parse(observation())).not.toThrow()
    const bad = observation()
    bad.evidenceDigest = "not-a-digest"
    expect(hostConformanceObservationSchema.safeParse(bad).success).toBe(false)
    const missing = observation()
    delete (missing as Record<string, unknown>).checkId
    expect(hostConformanceObservationSchema.safeParse(missing).success).toBe(false)
  })

  it("forbids an executed observation from claiming not-run or pending-environment", () => {
    const bad = observation()
    bad.state = "not-run"
    expect(hostConformanceObservationSchema.safeParse(bad).success).toBe(false)
  })

  it("accepts a Final Report row backed by an observation and rejects an observation row without evidence", () => {
    expect(() => hostMatrixReportRowSchema.parse({
      host: "vscode",
      state: "passed",
      source: "observation",
      observation: observation(),
    })).not.toThrow()
    expect(hostMatrixReportRowSchema.safeParse({
      host: "vscode",
      state: "passed",
      source: "observation",
    }).success).toBe(false)
  })

  it("accepts a Final Report with a separate boundary check that is not an IDE host row", () => {
    const report = {
      ...baseSnapshot(),
      boundaryChecks: [{
        checkId: "engine-host.platformReadiness.v2",
        target: "engine-host-rpc",
        state: "passed",
        truthClass: "observed",
        observedAt,
        evidenceSource: "packages/conformance",
      }],
    }
    expect(() => platformReadinessReportSchema.parse(report)).not.toThrow()
  })

  it("rejects an invalid standalone base-default row (non-canonical state)", () => {
    expect(hostMatrixDefaultRowSchema.safeParse({ host: "vscode", state: "not-run", source: "base-default" }).success).toBe(true)
    expect(hostMatrixDefaultRowSchema.safeParse({ host: "vscode", state: "passed", source: "base-default" }).success).toBe(false)
    expect(hostMatrixDefaultRowSchema.safeParse({ host: "rider", state: "not-run", source: "base-default" }).success).toBe(false)
  })

  it("rejects an invalid standalone observation row (host or state mismatch)", () => {
    expect(hostMatrixReportRowSchema.safeParse({
      host: "vscode", state: "passed", source: "observation", observation: observation(),
    }).success).toBe(true)
    expect(hostMatrixReportRowSchema.safeParse({
      host: "rider", state: "passed", source: "observation", observation: observation(),
    }).success).toBe(false)
    expect(hostMatrixReportRowSchema.safeParse({
      host: "vscode", state: "failed", source: "observation", observation: observation(),
    }).success).toBe(false)
  })

  it("rejects a duplicated IDE host and a base-default row using a non-default state", () => {
    const dup = baseSnapshot()
    ;(dup.hostMatrix as Array<{ host: string }>)[1]!.host = "vscode"
    expect(platformReadinessSnapshotSchema.safeParse(dup).success).toBe(false)

    const badState = baseSnapshot()
    ;(badState.hostMatrix as Array<{ state: string }>)[0]!.state = "passed"
    expect(platformReadinessSnapshotSchema.safeParse(badState).success).toBe(false)
  })

  it("rejects a report observation row whose host does not match the observation host", () => {
    const report: Record<string, unknown> = {
      ...baseSnapshot(),
      boundaryChecks: [],
      hostMatrix: [
        { host: "visual-studio", state: "passed", source: "observation", observation: { ...observation(), host: "vscode" } },
        { host: "vscode", state: "not-run", source: "base-default" },
        { host: "rider", state: "pending-environment", source: "base-default" },
        { host: "kiro", state: "pending-environment", source: "base-default" },
      ],
    }
    expect(platformReadinessReportSchema.safeParse(report).success).toBe(false)
  })
})

describe("C1 evidence contracts", () => {
  function envelopeCommon(): Record<string, unknown> {
    return {
      schemaVersion: 1, parentChangeSetId: "GAEP-P0-CS01", correctionSetId: "GAEP-P0-CS01-C1",
      checkId: "vscode.extension-host.e2e", observedAt, subjectDigest: digest,
    }
  }

  it("requires a snapshot for passed and rejects passed without one", () => {
    expect(readinessEvidenceEnvelopeSchema.safeParse({ ...envelopeCommon(), executionResult: "executed", testOutcome: "passed", snapshot: baseSnapshot() }).success).toBe(true)
    expect(readinessEvidenceEnvelopeSchema.safeParse({ ...envelopeCommon(), executionResult: "executed", testOutcome: "passed" }).success).toBe(false)
  })

  it("requires failureCategory/failureSummary for failed and allows an optional snapshot", () => {
    expect(readinessEvidenceEnvelopeSchema.safeParse({ ...envelopeCommon(), executionResult: "executed", testOutcome: "failed", failureCategory: "computation", failureSummary: "failed early" }).success).toBe(true)
    expect(readinessEvidenceEnvelopeSchema.safeParse({ ...envelopeCommon(), executionResult: "executed", testOutcome: "failed" }).success).toBe(false)
  })

  it("requires not-executed + unavailabilityReason for not-run", () => {
    expect(readinessEvidenceEnvelopeSchema.safeParse({ ...envelopeCommon(), executionResult: "not-executed", testOutcome: "not-run", unavailabilityReason: "no host" }).success).toBe(true)
    expect(readinessEvidenceEnvelopeSchema.safeParse({ ...envelopeCommon(), executionResult: "executed", testOutcome: "not-run", unavailabilityReason: "no host" }).success).toBe(false)
  })

  it("accepts both observation-result shapes", () => {
    expect(observationResultSchema.safeParse({ observation: null }).success).toBe(true)
    expect(observationResultSchema.safeParse({ observation: { host: "vscode", checkId: "c", state: "passed", truthClass: "observed", observedAt, evidenceSource: "readiness-evidence.json", executionResult: "executed", evidenceDigest: digest } }).success).toBe(true)
  })

  it("requires the manifest to hold exactly the two governed artifact paths", () => {
    const ok = { schemaVersion: 1, parentChangeSetId: "GAEP-P0-CS01", correctionSetId: "GAEP-P0-CS01-C1", host: "vscode", checkId: "c", subjectDigest: digest, artifacts: [{ path: "readiness-evidence.json", digest }, { path: "observation.json", digest }] }
    expect(evidenceManifestSchema.safeParse(ok).success).toBe(true)
    expect(evidenceManifestSchema.safeParse({ ...ok, artifacts: [{ path: "readiness-evidence.json", digest }] }).success).toBe(false)
    expect(evidenceManifestSchema.safeParse({ ...ok, artifacts: [{ path: "readiness-evidence.json", digest }, { path: "readiness-evidence.json", digest }] }).success).toBe(false)
  })
})
