import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import type { PlatformReadinessSnapshot } from "@gaep/contracts"

import { FAILURE_SUMMARIES, resolveEvidencePath, resolveFailureSummary, verifyEvidenceBundle } from "./evidence.js"

const now = "2026-07-24T00:00:00.000Z"
const SUBJECT = `sha256:${"b".repeat(64)}`

function snapshot(): PlatformReadinessSnapshot {
  return {
    schemaVersion: 1,
    generatedAt: now,
    engineVersion: "0.1.0",
    providers: [],
    workspace: { status: "uninitialized", initialized: false, auditValid: true, lockPresent: false, issueCount: 0, truthClass: "observed", observedAt: now },
    hostMatrix: [
      { host: "vscode", state: "not-run", source: "base-default" },
      { host: "visual-studio", state: "pending-environment", source: "base-default" },
      { host: "rider", state: "pending-environment", source: "base-default" },
      { host: "kiro", state: "pending-environment", source: "base-default" },
    ],
  }
}

function sha256(text: string): string {
  return `sha256:${createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex")}`
}

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "gaep-evidence-")) })
afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

/** Write a bundle; `manifestArtifacts` overrides let tests inject missing/extra/duplicate/tampered entries. */
function writeBundle(options: {
  envelope: Record<string, unknown>
  observationResult: Record<string, unknown>
  subjectDigest?: string
  manifestArtifacts?: (auto: { path: string; digest: string }[]) => { path: string; digest: string }[]
}): void {
  const envelopeText = JSON.stringify(options.envelope, null, 2)
  const observationText = JSON.stringify(options.observationResult, null, 2)
  writeFileSync(join(dir, "readiness-evidence.json"), envelopeText)
  writeFileSync(join(dir, "observation.json"), observationText)
  const auto = [
    { path: "readiness-evidence.json", digest: sha256(envelopeText) },
    { path: "observation.json", digest: sha256(observationText) },
  ]
  const artifacts = options.manifestArtifacts ? options.manifestArtifacts(auto) : auto
  const manifest = {
    schemaVersion: 1,
    parentChangeSetId: "GAEP-P0-CS01",
    correctionSetId: "GAEP-P0-CS01-C1",
    host: "vscode",
    checkId: "vscode.extension-host.e2e",
    subjectDigest: options.subjectDigest ?? SUBJECT,
    artifacts,
  }
  writeFileSync(join(dir, "evidence-manifest.json"), JSON.stringify(manifest, null, 2))
}

function passedEnvelope(): Record<string, unknown> {
  return {
    schemaVersion: 1, parentChangeSetId: "GAEP-P0-CS01", correctionSetId: "GAEP-P0-CS01-C1",
    checkId: "vscode.extension-host.e2e", observedAt: now, subjectDigest: SUBJECT,
    executionResult: "executed", testOutcome: "passed", snapshot: snapshot(),
  }
}
function failedEnvelopeNoSnapshot(): Record<string, unknown> {
  return {
    schemaVersion: 1, parentChangeSetId: "GAEP-P0-CS01", correctionSetId: "GAEP-P0-CS01-C1",
    checkId: "vscode.extension-host.e2e", observedAt: now, subjectDigest: SUBJECT,
    executionResult: "executed", testOutcome: "failed", failureCategory: "computation", failureSummary: "readiness computation failed",
  }
}
function notExecutedEnvelope(): Record<string, unknown> {
  return {
    schemaVersion: 1, parentChangeSetId: "GAEP-P0-CS01", correctionSetId: "GAEP-P0-CS01-C1",
    checkId: "vscode.extension-host.e2e", observedAt: now, subjectDigest: SUBJECT,
    executionResult: "not-executed", testOutcome: "not-run", unavailabilityReason: "no VS Code baseline available",
  }
}
function observation(state: "passed" | "failed"): Record<string, unknown> {
  return {
    observation: {
      host: "vscode", checkId: "vscode.extension-host.e2e", state, truthClass: "observed",
      observedAt: now, evidenceSource: "readiness-evidence.json", executionResult: "executed",
      evidenceDigest: sha256(JSON.stringify(state === "passed" ? passedEnvelope() : failedEnvelopeNoSnapshot(), null, 2)),
    },
  }
}

describe("resolveEvidencePath", () => {
  it("rejects absolute paths, traversal, and escaping the root", () => {
    expect(() => resolveEvidencePath(dir, "/etc/passwd")).toThrow()
    expect(() => resolveEvidencePath(dir, "../secrets.json")).toThrow()
    expect(() => resolveEvidencePath(dir, "sub/../../escape.json")).toThrow()
    expect(resolveEvidencePath(dir, "readiness-evidence.json")).toContain(dir)
  })
})

describe("verifyEvidenceBundle", () => {
  it("accepts a valid executed-passed bundle and returns a passed observation", () => {
    writeBundle({ envelope: passedEnvelope(), observationResult: observation("passed") })
    const result = verifyEvidenceBundle(dir, SUBJECT)
    expect(result.kind).toBe("observation")
    expect(result.kind === "observation" && result.observation.state).toBe("passed")
  })

  it("publishes a valid failed result even when computation failed before a snapshot existed", () => {
    writeBundle({ envelope: failedEnvelopeNoSnapshot(), observationResult: observation("failed") })
    const result = verifyEvidenceBundle(dir, SUBJECT)
    expect(result.kind === "observation" && result.observation.state).toBe("failed")
  })

  it("treats a not-executed bundle as no observation, and a not-executed bundle overwriting a prior passed yields not-executed", () => {
    writeBundle({ envelope: passedEnvelope(), observationResult: observation("passed") })
    expect(verifyEvidenceBundle(dir, SUBJECT).kind).toBe("observation")
    writeBundle({ envelope: notExecutedEnvelope(), observationResult: { observation: null } })
    expect(verifyEvidenceBundle(dir, SUBJECT).kind).toBe("not-executed")
  })

  it("rejects observation: null for an executed envelope", () => {
    writeBundle({ envelope: passedEnvelope(), observationResult: { observation: null } })
    expect(() => verifyEvidenceBundle(dir, SUBJECT)).toThrow()
  })

  it("rejects a passed envelope missing its snapshot (schema)", () => {
    const bad = passedEnvelope()
    delete (bad as Record<string, unknown>).snapshot
    writeBundle({ envelope: bad, observationResult: observation("passed") })
    expect(() => verifyEvidenceBundle(dir, SUBJECT)).toThrow()
  })

  it("rejects a failed observation whose state does not match the envelope outcome", () => {
    writeBundle({ envelope: failedEnvelopeNoSnapshot(), observationResult: observation("passed") })
    expect(() => verifyEvidenceBundle(dir, SUBJECT)).toThrow()
  })

  it("rejects tampering observation.state without regenerating digests", () => {
    writeBundle({ envelope: passedEnvelope(), observationResult: observation("passed") })
    // Overwrite observation.json with a changed state but keep the old manifest digest.
    const tampered = observation("passed")
    ;(tampered.observation as Record<string, unknown>).state = "failed"
    writeFileSync(join(dir, "observation.json"), JSON.stringify(tampered, null, 2))
    expect(() => verifyEvidenceBundle(dir, SUBJECT)).toThrow()
  })

  it("rejects a manifest with a missing, duplicate, or extra artifact entry", () => {
    writeBundle({ envelope: passedEnvelope(), observationResult: observation("passed"), manifestArtifacts: (a) => [a[0]!] })
    expect(() => verifyEvidenceBundle(dir, SUBJECT)).toThrow()
    writeBundle({ envelope: passedEnvelope(), observationResult: observation("passed"), manifestArtifacts: (a) => [a[0]!, a[1]!, { path: "observation.json", digest: a[1]!.digest }] })
    expect(() => verifyEvidenceBundle(dir, SUBJECT)).toThrow()
    writeBundle({ envelope: passedEnvelope(), observationResult: observation("passed"), manifestArtifacts: (a) => [a[0]!, a[0]!] })
    expect(() => verifyEvidenceBundle(dir, SUBJECT)).toThrow()
  })

  it("rejects a stale bundle whose subjectDigest does not match the current build", () => {
    writeBundle({ envelope: passedEnvelope(), observationResult: observation("passed") })
    expect(() => verifyEvidenceBundle(dir, `sha256:${"c".repeat(64)}`)).toThrow()
  })

  it("rejects a manifest whose host or checkId does not match", () => {
    const badHost = { envelope: passedEnvelope(), observationResult: observation("passed") }
    writeBundle(badHost)
    let manifest = JSON.parse(readFileSync(join(dir, "evidence-manifest.json"), "utf8"))
    manifest.host = "rider"
    writeFileSync(join(dir, "evidence-manifest.json"), JSON.stringify(manifest, null, 2))
    expect(() => verifyEvidenceBundle(dir, SUBJECT)).toThrow()

    writeBundle(badHost)
    manifest = JSON.parse(readFileSync(join(dir, "evidence-manifest.json"), "utf8"))
    manifest.checkId = "some.other.check"
    writeFileSync(join(dir, "evidence-manifest.json"), JSON.stringify(manifest, null, 2))
    expect(() => verifyEvidenceBundle(dir, SUBJECT)).toThrow()
  })

  it("rejects observation metadata that does not match the envelope", () => {
    for (const mutate of [
      (o: Record<string, unknown>) => { o.host = "rider" },
      (o: Record<string, unknown>) => { o.checkId = "other.check" },
      (o: Record<string, unknown>) => { o.observedAt = "2020-01-01T00:00:00.000Z" },
      (o: Record<string, unknown>) => { o.evidenceSource = "elsewhere.json" },
    ]) {
      const result = observation("passed")
      mutate(result.observation as Record<string, unknown>)
      // Rebuild the manifest so digests match; only the metadata is inconsistent.
      writeBundle({ envelope: passedEnvelope(), observationResult: result })
      expect(() => verifyEvidenceBundle(dir, SUBJECT)).toThrow()
    }
  })
})

describe("resolveFailureSummary", () => {
  it("maps known codes to fixed allowlisted summaries", () => {
    expect(resolveFailureSummary("phase-failed")).toEqual(FAILURE_SUMMARIES["phase-failed"])
    expect(resolveFailureSummary("matrix-assertion-failed")).toEqual(FAILURE_SUMMARIES["matrix-assertion-failed"])
  })

  it("never persists raw error text containing absolute paths or newlines", () => {
    const raw = "/Users/someone/secret/token.txt\nAUTH=abcd1234 failed at /private/tmp/gaep-candidate-xyz"
    const resolved = resolveFailureSummary(raw)
    expect(resolved).toEqual(FAILURE_SUMMARIES["assertion-failed"])
    expect(resolved.failureSummary).not.toContain("/")
    expect(resolved.failureSummary).not.toContain("\n")
    expect(resolved.failureSummary).not.toContain("AUTH")
    expect(Object.values(FAILURE_SUMMARIES).every((entry) => !entry.failureSummary.includes("\n"))).toBe(true)
  })
})

// --- GAEP-P0-CS02 evidence (INV-14/15/30) ---
import { computeSubjectDigest as _unusedCs02, verifyEvidenceBundleFor, writeCs02BuildOnlyBundle, chooseCurrentAttempt, type Cs02BundleSpec } from "./evidence.js"

describe("CS02 evidence verification", () => {
  const identity = { sourceTreeDigest: `sha256:${"f".repeat(64)}`, baseCommit: "1".repeat(40), dirty: false }
  const subject = `sha256:${"d".repeat(64)}`
  const spec: Cs02BundleSpec = { host: "vscode", checkId: "vscode.extension-host.e2e", packageVersion: "0.2.0", currentSubjectDigest: subject, currentSourceIdentity: identity }

  function writeCs02(dir: string, outcome: "passed" | "not-run", overrides: { host?: string; sourceTreeDigest?: string; packageVersion?: string } = {}): void {
    const observedAt = "2026-07-24T00:00:00.000Z"
    const host = overrides.host ?? "vscode"
    const srcId = { ...identity, sourceTreeDigest: overrides.sourceTreeDigest ?? identity.sourceTreeDigest }
    const packageVersion = overrides.packageVersion ?? "0.2.0"
    const common = { schemaVersion: 1, parentChangeSetId: "GAEP-P0-CS02", host, packageVersion, checkId: "vscode.extension-host.e2e", observedAt, subjectDigest: subject, sourceIdentity: srcId }
    const envelope = outcome === "passed"
      ? { ...common, executionResult: "executed", testOutcome: "passed" }
      : { ...common, executionResult: "not-executed", testOutcome: "not-run", unavailabilityReason: "host not installed" }
    const envelopeText = `${JSON.stringify(envelope, null, 2)}\n`
    writeFileSync(join(dir, "readiness-evidence.json"), envelopeText)
    const envDigest = sha256(envelopeText)
    const observationResult = outcome === "passed"
      ? { observation: { host, checkId: "vscode.extension-host.e2e", state: "passed", truthClass: "observed", observedAt, evidenceSource: "readiness-evidence.json", executionResult: "executed", evidenceDigest: envDigest } }
      : { observation: null }
    const obsText = `${JSON.stringify(observationResult, null, 2)}\n`
    writeFileSync(join(dir, "observation.json"), obsText)
    const manifest = { schemaVersion: 1, parentChangeSetId: "GAEP-P0-CS02", host, packageVersion, checkId: "vscode.extension-host.e2e", subjectDigest: subject, sourceIdentity: srcId, artifacts: [{ path: "readiness-evidence.json", digest: envDigest }, { path: "observation.json", digest: sha256(obsText) }] }
    writeFileSync(join(dir, "evidence-manifest.json"), JSON.stringify(manifest, null, 2))
  }

  it("accepts a valid CS02 passed bundle", () => {
    writeCs02(dir, "passed")
    const result = verifyEvidenceBundleFor(spec, dir)
    expect(result.kind === "observation" && result.observation.state).toBe("passed")
  })

  it("rejects a wrong host, wrong package version, and a mismatched source tree", () => {
    writeCs02(dir, "passed", { host: "rider" })
    expect(() => verifyEvidenceBundleFor(spec, dir)).toThrow()
    writeCs02(dir, "passed", { packageVersion: "0.1.0" })
    expect(() => verifyEvidenceBundleFor(spec, dir)).toThrow()
    writeCs02(dir, "passed", { sourceTreeDigest: `sha256:${"9".repeat(64)}` })
    expect(() => verifyEvidenceBundleFor(spec, dir)).toThrow()
  })

  it("rejects a C1 envelope substituted with CS02 strings (anti-forgery)", () => {
    // A C1 envelope lacks host/packageVersion/sourceIdentity, so the CS02 schema rejects it.
    const c1Envelope = { schemaVersion: 1, parentChangeSetId: "GAEP-P0-CS02", correctionSetId: "GAEP-P0-CS01-C1", checkId: "vscode.extension-host.e2e", observedAt: "2026-07-24T00:00:00.000Z", subjectDigest: subject, executionResult: "executed", testOutcome: "passed", snapshot: {} }
    writeFileSync(join(dir, "readiness-evidence.json"), JSON.stringify(c1Envelope, null, 2))
    writeFileSync(join(dir, "observation.json"), JSON.stringify({ observation: null }))
    writeFileSync(join(dir, "evidence-manifest.json"), JSON.stringify({ schemaVersion: 1, parentChangeSetId: "GAEP-P0-CS02", host: "vscode", packageVersion: "0.2.0", checkId: "vscode.extension-host.e2e", subjectDigest: subject, sourceIdentity: identity, artifacts: [{ path: "readiness-evidence.json", digest: subject }, { path: "observation.json", digest: subject }] }))
    expect(() => verifyEvidenceBundleFor(spec, dir)).toThrow()
  })

  it("import authority: a local not-run does not overwrite a valid current-subject passed (INV-30)", () => {
    writeCs02(dir, "passed")
    expect(chooseCurrentAttempt(spec, dir, true)).toBe("keep-on-disk")
    writeCs02(dir, "not-run")
    expect(chooseCurrentAttempt(spec, dir, true)).toBe("replace-with-local")
    expect(chooseCurrentAttempt(spec, undefined, true)).toBe("replace-with-local")
  })

  it("writeCs02BuildOnlyBundle produces a self-verifying not-executed/not-run bundle (build lane)", () => {
    const result = writeCs02BuildOnlyBundle(
      { host: "rider", checkId: "rider.plugin.workflow", packageVersion: "0.2.0", subjectDigest: subject, sourceIdentity: identity, unavailabilityReason: "Build lane produced the artifact; interactive workflow not run." },
      dir,
    )
    expect(result.kind).toBe("not-executed")
    // The written bundle re-verifies against the same subject/source, and the outcome is never a pass.
    const reverify = verifyEvidenceBundleFor(
      { host: "rider", checkId: "rider.plugin.workflow", packageVersion: "0.2.0", currentSubjectDigest: subject, currentSourceIdentity: identity },
      dir,
    )
    expect(reverify.kind).toBe("not-executed")
    const envelope = JSON.parse(readFileSync(join(dir, "readiness-evidence.json"), "utf8"))
    expect(envelope.testOutcome).toBe("not-run")
    expect(envelope.executionResult).toBe("not-executed")
  })
})
