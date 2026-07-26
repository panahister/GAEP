import type { EvidenceProjectionState, HostPackageProjection, ReadinessHost, ReadinessState } from "@gaep/contracts"

import { verifyEvidenceBundleFor, type Cs02BundleSpec, type EvidenceBundleResult } from "./evidence.js"

/**
 * GAEP-P0-CS02 — executed-only host conformance composition (INV-13/14/29).
 *
 * A host row may be `passed` ONLY after that host's package + workflow actually executed and its
 * evidence bundle verifies. A build alone, another host's result, or a missing/invalid/stale bundle
 * never yields `passed`; the row stays `not-run`/`pending-environment`.
 */

export const HOST_CHECK_IDS: Record<ReadinessHost, string> = {
  "vscode": "vscode.extension-host.e2e",
  "visual-studio": "visual-studio.vsix.workflow",
  "rider": "rider.plugin.workflow",
  "kiro": "kiro.extension.workflow",
}

/** Base conformance posture per host before any executed observation is merged. */
const BASE_CONFORMANCE: Record<ReadinessHost, ReadinessState> = {
  "vscode": "not-run",
  "visual-studio": "pending-environment",
  "rider": "pending-environment",
  "kiro": "pending-environment",
}

export interface HostConformanceInput {
  host: ReadinessHost
  packageVersion: string
  /** The verified on-disk bundle directory, if one exists for this host. */
  bundleDir?: string
  spec?: Omit<Cs02BundleSpec, "host" | "checkId" | "packageVersion">
}

/** Verify a single host's evidence and return its projection row (executed-only). */
export function observeHost(input: HostConformanceInput): HostPackageProjection {
  const base: HostPackageProjection = {
    host: input.host,
    packageVersion: input.packageVersion,
    conformanceState: BASE_CONFORMANCE[input.host],
    evidenceState: "evidence-absent",
  }
  if (!input.bundleDir || !input.spec) return base
  let result: EvidenceBundleResult
  try {
    result = verifyEvidenceBundleFor(
      { host: input.host, checkId: HOST_CHECK_IDS[input.host], packageVersion: input.packageVersion, ...input.spec },
      input.bundleDir,
    )
  } catch {
    // Missing/invalid/tampered/stale evidence fails closed to the base posture (INV-14).
    return { ...base, evidenceState: "evidence-invalid" }
  }
  if (result.kind === "not-executed") {
    return { ...base, evidenceState: "evidence-present" }
  }
  const evidenceState: EvidenceProjectionState = "evidence-present"
  return {
    host: input.host,
    packageVersion: input.packageVersion,
    conformanceState: result.observation.state,
    evidenceState,
    evidenceSource: result.observation.evidenceSource,
    evidenceDigest: result.observation.evidenceDigest,
  }
}

/** Compose the Four-IDE host matrix from executed observations only. */
export function composeHostMatrix(inputs: HostConformanceInput[]): HostPackageProjection[] {
  const byHost = new Map<ReadinessHost, HostConformanceInput>()
  for (const input of inputs) byHost.set(input.host, input)
  const order: ReadinessHost[] = ["vscode", "visual-studio", "rider", "kiro"]
  return order.map((host) => observeHost(byHost.get(host) ?? { host, packageVersion: inputs[0]?.packageVersion ?? "0.2.0" }))
}
