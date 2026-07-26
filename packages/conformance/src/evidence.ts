import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { isAbsolute, join, normalize, resolve, sep } from "node:path"

import {
  cs02EvidenceEnvelopeSchema,
  cs02EvidenceManifestSchema,
  evidenceManifestSchema,
  hostConformanceObservationSchema,
  observationResultSchema,
  readinessEvidenceEnvelopeSchema,
  type HostConformanceObservation,
  type SourceIdentity,
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

// --- GAEP-P0-CS02: multi-host, source-identity-bound evidence verification (INV-14/15/30) ---

export interface Cs02BundleSpec {
  host: "vscode" | "visual-studio" | "rider" | "kiro"
  checkId: string
  packageVersion: string
  currentSubjectDigest: string
  currentSourceIdentity: SourceIdentity
}

/**
 * Verify a CS02 host evidence bundle. Distinct from the C1 verifier: the CS02 envelope/manifest
 * carry `host`, `packageVersion`, and `sourceIdentity`, so a C1 envelope with substituted strings
 * fails schema validation. Equivalence/staleness is decided ONLY by `sourceTreeDigest` (INV-27).
 */
export function verifyEvidenceBundleFor(spec: Cs02BundleSpec, bundleDir: string): EvidenceBundleResult {
  const readJson = (name: string): unknown => JSON.parse(readFileSync(join(bundleDir, name), "utf8"))

  const envelope = cs02EvidenceEnvelopeSchema.parse(readJson("readiness-evidence.json"))
  const observationResult = observationResultSchema.parse(readJson("observation.json"))
  const manifest = cs02EvidenceManifestSchema.parse(readJson("evidence-manifest.json"))

  if (envelope.host !== spec.host || manifest.host !== spec.host) throw new Error("evidence host does not match the expected host")
  if (envelope.checkId !== spec.checkId || manifest.checkId !== spec.checkId) throw new Error("evidence checkId does not match the expected check")
  if (envelope.packageVersion !== spec.packageVersion || manifest.packageVersion !== spec.packageVersion) {
    throw new Error("evidence package version does not match")
  }
  if (envelope.subjectDigest !== spec.currentSubjectDigest || manifest.subjectDigest !== spec.currentSubjectDigest) {
    throw new Error("evidence subject digest does not match the current subject")
  }
  // Provenance metadata (baseCommit/dirty) never rejects; only sourceTreeDigest is the identity.
  if (envelope.sourceIdentity.sourceTreeDigest !== spec.currentSourceIdentity.sourceTreeDigest
      || manifest.sourceIdentity.sourceTreeDigest !== spec.currentSourceIdentity.sourceTreeDigest) {
    throw new Error("evidence source identity does not match the current source tree")
  }

  const paths = manifest.artifacts.map((artifact) => artifact.path)
  if (paths.length !== 2 || new Set(paths).size !== 2) throw new Error("manifest must list exactly the two governed artifacts")
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
  if (observation.host !== spec.host || observation.host !== manifest.host) throw new Error("observation host mismatch")
  if (observation.checkId !== envelope.checkId) throw new Error("observation checkId mismatch")
  if (observation.observedAt !== envelope.observedAt) throw new Error("observation observedAt mismatch")
  if (observation.evidenceSource !== EVIDENCE_FILE_NAME) throw new Error(`observation evidenceSource must be ${EVIDENCE_FILE_NAME}`)
  const evidenceEntry = manifest.artifacts.find((artifact) => artifact.path === EVIDENCE_FILE_NAME)
  if (!evidenceEntry || observation.evidenceDigest !== evidenceEntry.digest) {
    throw new Error("observation evidenceDigest does not match the readiness-evidence.json manifest digest")
  }
  return { kind: "observation", observation }
}

export interface Cs02BuildOnlySpec {
  host: "vscode" | "visual-studio" | "rider" | "kiro"
  checkId: string
  packageVersion: string
  subjectDigest: string
  sourceIdentity: SourceIdentity
  unavailabilityReason: string
  observedAt?: string
}

/**
 * Write a schema-valid CS02 build-only evidence bundle: the artifact built, but the installed-host
 * workflow was NOT executed (executionResult "not-executed", testOutcome "not-run"). The three
 * governed files are written and then self-verified with {@link verifyEvidenceBundleFor}, so a
 * malformed bundle is never published (INV-29/30). This can never read as a Ready-for-Test pass.
 */
export function writeCs02BuildOnlyBundle(spec: Cs02BuildOnlySpec, destDir: string): EvidenceBundleResult {
  const observedAt = spec.observedAt ?? new Date().toISOString()
  const envelope = cs02EvidenceEnvelopeSchema.parse({
    schemaVersion: 1,
    parentChangeSetId: "GAEP-P0-CS02",
    host: spec.host,
    packageVersion: spec.packageVersion,
    checkId: spec.checkId,
    observedAt,
    subjectDigest: spec.subjectDigest,
    sourceIdentity: spec.sourceIdentity,
    executionResult: "not-executed",
    testOutcome: "not-run",
    unavailabilityReason: spec.unavailabilityReason,
  })
  const observation = observationResultSchema.parse({ observation: null })

  mkdirSync(destDir, { recursive: true })
  const writeJson = (name: string, value: unknown): void =>
    writeFileSync(join(destDir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8")
  writeJson("readiness-evidence.json", envelope)
  writeJson("observation.json", observation)
  const manifest = cs02EvidenceManifestSchema.parse({
    schemaVersion: 1,
    parentChangeSetId: "GAEP-P0-CS02",
    host: spec.host,
    packageVersion: spec.packageVersion,
    checkId: spec.checkId,
    subjectDigest: spec.subjectDigest,
    sourceIdentity: spec.sourceIdentity,
    artifacts: [
      { path: "readiness-evidence.json", digest: sha256File(join(destDir, "readiness-evidence.json")) },
      { path: "observation.json", digest: sha256File(join(destDir, "observation.json")) },
    ],
  })
  writeJson("evidence-manifest.json", manifest)

  return verifyEvidenceBundleFor(
    { host: spec.host, checkId: spec.checkId, packageVersion: spec.packageVersion, currentSubjectDigest: spec.subjectDigest, currentSourceIdentity: spec.sourceIdentity },
    destDir,
  )
}

/**
 * Current-attempt authority (INV-30): a locally generated `not-run` result must NOT overwrite a
 * valid external `passed`/`failed` bundle whose source identity matches the current subject.
 * Returns the bundle that should remain effective.
 */
export function chooseCurrentAttempt(
  spec: Cs02BundleSpec,
  onDiskBundleDir: string | undefined,
  localWouldBeNotExecuted: boolean,
): "keep-on-disk" | "replace-with-local" {
  if (!onDiskBundleDir) return "replace-with-local"
  if (!localWouldBeNotExecuted) return "replace-with-local"
  try {
    const existing = verifyEvidenceBundleFor(spec, onDiskBundleDir)
    return existing.kind === "observation" ? "keep-on-disk" : "replace-with-local"
  } catch {
    return "replace-with-local"
  }
}
