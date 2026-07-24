import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { isAbsolute, join, normalize, resolve, sep } from "node:path"

import {
  evidenceManifestSchema,
  hostConformanceObservationSchema,
  observationResultSchema,
  readinessEvidenceEnvelopeSchema,
  type HostConformanceObservation,
} from "@gaep/contracts"

const PARENT_CHANGE_SET_ID = "GAEP-P0-CS01"
const CORRECTION_SET_ID = "GAEP-P0-CS01-C1"
const EVIDENCE_FILE_NAME = "readiness-evidence.json"
const VSCODE_HOST = "vscode"

/**
 * Fixed, allowlisted failure summaries. Raw error text (which can carry absolute paths,
 * candidate directories, newlines, logs, or secrets) is never persisted into tracked evidence:
 * producers send a code, and only these constant one-line strings are written.
 */
export const FAILURE_SUMMARIES = {
  "readiness-command-failed": { failureCategory: "computation", failureSummary: "The readiness command did not return a computed snapshot." },
  "matrix-assertion-failed": { failureCategory: "assertion", failureSummary: "The returned snapshot did not carry the expected Four-IDE host matrix." },
  "workspace-mutation-detected": { failureCategory: "assertion", failureSummary: "Executing the read-only readiness command mutated Product state." },
  "assertion-failed": { failureCategory: "assertion", failureSummary: "An extension-host assertion failed." },
  "phase-failed": { failureCategory: "phase", failureSummary: "A later extension-host phase failed after readiness passed." },
} as const

export type FailureCode = keyof typeof FAILURE_SUMMARIES

/** Fixed unavailability reason for a not-executed attempt (no interpolation). */
export const UNAVAILABILITY_REASON = "The VS Code extension host did not execute the readiness check."

/** Map an arbitrary producer-supplied code to an allowlisted category/summary pair. */
export function resolveFailureSummary(code: unknown): { failureCategory: string; failureSummary: string } {
  const key = (typeof code === "string" && code in FAILURE_SUMMARIES ? code : "assertion-failed") as FailureCode
  return FAILURE_SUMMARIES[key]
}

/** Resolve a manifest `evidenceSource` to an absolute path strictly inside `root`. */
export function resolveEvidencePath(root: string, source: string): string {
  if (isAbsolute(source)) throw new Error(`evidence source must be a relative path: ${source}`)
  const normalized = normalize(source)
  if (normalized.split(/[\\/]/).includes("..")) throw new Error(`evidence source must not traverse: ${source}`)
  const rootResolved = resolve(root)
  const abs = resolve(rootResolved, normalized)
  if (abs !== rootResolved && !abs.startsWith(rootResolved + sep)) {
    throw new Error(`evidence source escapes the evidence root: ${source}`)
  }
  return abs
}

/** SHA-256 over exact file bytes (Buffer), not an ambiguously decoded string. */
export function sha256File(path: string): string {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`
}

/** Digest of the tested extension subject (the built VS Code bundle). */
export function computeSubjectDigest(extensionBundlePath: string): string {
  return sha256File(extensionBundlePath)
}

export interface EvidenceBundleObservation {
  kind: "observation"
  observation: HostConformanceObservation
}
export interface EvidenceBundleNotExecuted {
  kind: "not-executed"
}
export type EvidenceBundleResult = EvidenceBundleObservation | EvidenceBundleNotExecuted

/**
 * Verify a durable VS Code evidence bundle in `bundleDir` against the current subject digest.
 * Returns the executed observation, or a not-executed result. Throws on any invalid/stale/incomplete
 * bundle (the caller then leaves VS Code at its Base `not-run`).
 */
export function verifyEvidenceBundle(bundleDir: string, currentSubjectDigest: string): EvidenceBundleResult {
  const readJson = (name: string): unknown => JSON.parse(readFileSync(join(bundleDir, name), "utf8"))

  const envelope = readinessEvidenceEnvelopeSchema.parse(readJson("readiness-evidence.json"))
  const observationResult = observationResultSchema.parse(readJson("observation.json"))
  const manifest = evidenceManifestSchema.parse(readJson("evidence-manifest.json"))

  if (manifest.parentChangeSetId !== PARENT_CHANGE_SET_ID || manifest.correctionSetId !== CORRECTION_SET_ID) {
    throw new Error("evidence manifest change-set identifiers do not match")
  }
  if (manifest.host !== VSCODE_HOST) throw new Error("evidence manifest host must be vscode")
  if (manifest.checkId !== envelope.checkId) throw new Error("evidence manifest checkId does not match the envelope checkId")
  if (envelope.subjectDigest !== currentSubjectDigest || manifest.subjectDigest !== currentSubjectDigest) {
    throw new Error("evidence subject digest does not match the current built extension")
  }

  // Every manifest artifact must byte-verify (covers readiness-evidence.json and observation.json).
  for (const artifact of manifest.artifacts) {
    const abs = resolveEvidencePath(bundleDir, artifact.path)
    if (sha256File(abs) !== artifact.digest) throw new Error(`evidence artifact digest mismatch: ${artifact.path}`)
  }

  if (envelope.executionResult === "not-executed") {
    if (observationResult.observation !== null) throw new Error("not-executed bundle must have observation: null")
    return { kind: "not-executed" }
  }

  if (observationResult.observation === null) throw new Error("executed bundle must contain an observation")
  const observation = hostConformanceObservationSchema.parse(observationResult.observation)
  const expectedState = envelope.testOutcome === "passed" ? "passed" : "failed"
  if (observation.state !== expectedState) throw new Error("observation state does not match the envelope testOutcome")
  if (observation.host !== VSCODE_HOST || observation.host !== manifest.host) {
    throw new Error("observation host must be vscode and match the manifest host")
  }
  if (observation.checkId !== envelope.checkId) throw new Error("observation checkId does not match the envelope checkId")
  if (observation.observedAt !== envelope.observedAt) throw new Error("observation observedAt does not match the envelope observedAt")
  if (observation.evidenceSource !== EVIDENCE_FILE_NAME) {
    throw new Error(`observation evidenceSource must be ${EVIDENCE_FILE_NAME}`)
  }

  const evidenceEntry = manifest.artifacts.find((artifact) => artifact.path === EVIDENCE_FILE_NAME)
  if (!evidenceEntry || observation.evidenceDigest !== evidenceEntry.digest) {
    throw new Error("observation evidenceDigest does not match the readiness-evidence.json manifest digest")
  }
  return { kind: "observation", observation }
}
