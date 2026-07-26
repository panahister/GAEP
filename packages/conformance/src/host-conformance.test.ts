import { createHash } from "node:crypto"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import type { ReadinessHost } from "@gaep/contracts"

import { HOST_CHECK_IDS, composeHostMatrix, observeHost } from "./host-conformance.js"

const identity = { sourceTreeDigest: `sha256:${"f".repeat(64)}`, baseCommit: "1".repeat(40), dirty: false }
const subject = `sha256:${"d".repeat(64)}`
const sha = (t: string): string => `sha256:${createHash("sha256").update(Buffer.from(t, "utf8")).digest("hex")}`

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "gaep-hostconf-")) })
afterEach(() => rmSync(dir, { recursive: true, force: true }))

function writePassed(host: ReadinessHost): void {
  const observedAt = "2026-07-24T00:00:00.000Z"
  const checkId = HOST_CHECK_IDS[host]
  const common = { schemaVersion: 1, parentChangeSetId: "GAEP-P0-CS02", host, packageVersion: "0.2.0", checkId, observedAt, subjectDigest: subject, sourceIdentity: identity }
  const envelope = { ...common, executionResult: "executed", testOutcome: "passed" }
  const envelopeText = `${JSON.stringify(envelope, null, 2)}\n`
  writeFileSync(join(dir, "readiness-evidence.json"), envelopeText)
  const observation = { observation: { host, checkId, state: "passed", truthClass: "observed", observedAt, evidenceSource: "readiness-evidence.json", executionResult: "executed", evidenceDigest: sha(envelopeText) } }
  const obsText = `${JSON.stringify(observation, null, 2)}\n`
  writeFileSync(join(dir, "observation.json"), obsText)
  const manifest = { schemaVersion: 1, parentChangeSetId: "GAEP-P0-CS02", host, packageVersion: "0.2.0", checkId, subjectDigest: subject, sourceIdentity: identity, artifacts: [{ path: "readiness-evidence.json", digest: sha(envelopeText) }, { path: "observation.json", digest: sha(obsText) }] }
  writeFileSync(join(dir, "evidence-manifest.json"), JSON.stringify(manifest, null, 2))
}

describe("host conformance composition (INV-13/14)", () => {
  it("a non-executed host has no observation and stays at its base posture", () => {
    const rows = composeHostMatrix([{ host: "vscode", packageVersion: "0.2.0" }])
    expect(rows.map((r) => r.host)).toEqual(["vscode", "visual-studio", "rider", "kiro"])
    expect(rows.find((r) => r.host === "vscode")?.conformanceState).toBe("not-run")
    expect(rows.find((r) => r.host === "visual-studio")?.conformanceState).toBe("pending-environment")
    expect(rows.every((r) => r.evidenceState === "evidence-absent")).toBe(true)
  })

  it("a verified vscode bundle yields passed; a different host's bundle never transfers", () => {
    writePassed("vscode")
    const spec = { currentSubjectDigest: subject, currentSourceIdentity: identity }
    const vscode = observeHost({ host: "vscode", packageVersion: "0.2.0", bundleDir: dir, spec })
    expect(vscode.conformanceState).toBe("passed")
    // The same bundle presented as a rider bundle must be rejected (host mismatch).
    const rider = observeHost({ host: "rider", packageVersion: "0.2.0", bundleDir: dir, spec })
    expect(rider.conformanceState).toBe("pending-environment")
    expect(rider.evidenceState).toBe("evidence-invalid")
  })

  it("a stale bundle (wrong subject) fails closed, never passed", () => {
    writePassed("vscode")
    const row = observeHost({ host: "vscode", packageVersion: "0.2.0", bundleDir: dir, spec: { currentSubjectDigest: `sha256:${"9".repeat(64)}`, currentSourceIdentity: identity } })
    expect(row.conformanceState).toBe("not-run")
    expect(row.evidenceState).toBe("evidence-invalid")
  })
})
