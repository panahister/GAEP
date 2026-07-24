import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { lstat, readFile, realpath } from "node:fs/promises"
import { isAbsolute, relative, resolve, sep } from "node:path"

import { verifyHostBehaviorEvidence } from "./host_behavior_evidence.mjs"
import { verifyProviderBehaviorEvidence } from "./provider_behavior_evidence.mjs"

const maximumControlBytes = 1024 * 1024
const maximumSourceBytes = 8 * 1024 * 1024
const requiredHosts = ["kiro", "rider", "visual-studio", "vscode"]
const assessmentStates = new Set(["implemented", "partial", "not-implemented"])
const runtimeSources = new Set(["package-report", "json-evidence"])
const runtimeLevels = new Set([
  "installed-package-activation-local",
  "installed-package-bundled-engine-workflow-local",
  "compatible-host-activation-only",
  "compatible-host-packaged-engine-workflow-local",
  "native-startup-plugin-load-only",
  "native-startup-and-packaged-engine-client-workflow-local",
  "native-plugin-code-activation-startup-and-packaged-engine-client-workflow-local",
  "cross-platform-compile-and-controller-only",
  "cross-platform-packaged-engine-client-workflow-local",
])

function requireCondition(condition, message) {
  if (!condition) throw new Error(message)
}

function within(root, candidate) {
  const path = relative(root, candidate)
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path))
}

function repositoryPath(repositoryRoot, path, label) {
  requireCondition(typeof path === "string" && path.length > 0 && path.length <= 4096 && !isAbsolute(path),
    `${label} must be one repository-relative path`)
  const resolved = resolve(repositoryRoot, path)
  requireCondition(within(repositoryRoot, resolved), `${label} escaped the repository`)
  return resolved
}

async function readRegular(path, maximumBytes, label) {
  const metadata = await lstat(path)
  requireCondition(metadata.isFile() && !metadata.isSymbolicLink() && metadata.size > 0 && metadata.size <= maximumBytes,
    `${label} is not a bounded regular file`)
  return { metadata, value: await readFile(path, "utf8") }
}

async function readJson(path, label) {
  const { value } = await readRegular(path, maximumControlBytes, label)
  try {
    return JSON.parse(value)
  } catch {
    throw new Error(`${label} is not valid JSON`)
  }
}

async function verifyRepositoryFile(repositoryRoot, path, maximumBytes, label) {
  const resolved = repositoryPath(repositoryRoot, path, label)
  const canonical = await realpath(resolved)
  requireCondition(within(repositoryRoot, canonical), `${label} resolves outside the repository`)
  const metadata = await lstat(resolved)
  requireCondition(metadata.isFile() && !metadata.isSymbolicLink() && metadata.size > 0 && metadata.size <= maximumBytes,
    `${label} is not a bounded regular file`)
  return { resolved, metadata }
}

async function digest(path) {
  const hash = createHash("sha256")
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return `sha256:${hash.digest("hex")}`
}

function assertStringList(value, label, { allowEmpty = false } = {}) {
  requireCondition(Array.isArray(value) && (allowEmpty || value.length > 0) &&
    value.every((item) => typeof item === "string" && item.length > 0 && item.length <= 1024),
  `${label} must be a bounded string list`)
}

function valueAtPath(value, path) {
  let current = value
  for (const segment of path) {
    requireCondition(current !== null && typeof current === "object" && Object.hasOwn(current, segment),
      `Runtime evidence is missing ${path.join(".")}`)
    current = current[segment]
  }
  return current
}

function validateContract(contract) {
  requireCondition(contract?.schemaVersion === 1 && contract.kind === "gaep-phase-0-ide-conformance-contract-v1" &&
    contract.phase === "phase-0-local" && typeof contract.claimBoundary === "string" && contract.claimBoundary.length > 0,
  "IDE conformance contract identity is invalid")
  requireCondition(Array.isArray(contract.capabilities) && contract.capabilities.length > 0 && contract.capabilities.length <= 100,
    "IDE conformance capabilities are missing or unbounded")
  const capabilityIds = contract.capabilities.map((capability) => capability?.id)
  requireCondition(capabilityIds.every((id) => typeof id === "string" && /^[a-z][a-z0-9-]{2,63}$/u.test(id)) &&
    new Set(capabilityIds).size === capabilityIds.length,
  "IDE conformance capability IDs are invalid or duplicated")
  requireCondition(contract.capabilities.every((capability) => typeof capability.label === "string" && capability.label.length > 0),
    "IDE conformance capability labels are invalid")
  requireCondition(Array.isArray(contract.hosts) && contract.hosts.length === requiredHosts.length,
    "IDE conformance host set is incomplete")
  const hostIds = contract.hosts.map((host) => host?.id).sort()
  requireCondition(JSON.stringify(hostIds) === JSON.stringify(requiredHosts), "IDE conformance host identities changed")
  for (const host of contract.hosts) {
    requireCondition(typeof host.displayName === "string" && host.displayName.length > 0 &&
      typeof host.packageId === "string" && host.packageId.length > 0,
    `IDE conformance host metadata is invalid: ${host.id}`)
    assertStringList(host.packagePlatforms, `${host.id} package platforms`)
    requireCondition(new Set(host.packagePlatforms).size === host.packagePlatforms.length &&
      host.packagePlatforms.every((platform) => ["darwin", "linux", "win32"].includes(platform)),
      `${host.id} package platforms contain an unsupported value`)
    requireCondition(host.runtimeEvidence && runtimeSources.has(host.runtimeEvidence.source) &&
      runtimeLevels.has(host.runtimeEvidence.level),
    `${host.id} runtime evidence contract is invalid`)
    if (host.runtimeEvidence.source === "json-evidence") {
      requireCondition(typeof host.runtimeEvidence.reportPath === "string" &&
        typeof host.runtimeEvidence.expectedKind === "string", `${host.id} JSON runtime evidence contract is invalid`)
      if (host.runtimeEvidence.format === "gaep-host-behavior-v1") {
        requireCondition(host.runtimeEvidence.expectedKind === "gaep-phase-0-host-behavior-evidence-v1",
          `${host.id} host behavior evidence kind is invalid`)
      } else {
        requireCondition(Array.isArray(host.runtimeEvidence.assertions) && host.runtimeEvidence.assertions.length > 0,
          `${host.id} JSON runtime evidence assertions are invalid`)
      }
    }
    assertStringList(host.runtimeEvidence.remainingRequirements, `${host.id} remaining requirements`)
    requireCondition(Array.isArray(host.capabilityAssessments) && host.capabilityAssessments.length === capabilityIds.length,
      `${host.id} capability assessment set is incomplete`)
    const assessed = host.capabilityAssessments.map((assessment) => assessment?.capabilityId)
    requireCondition(new Set(assessed).size === assessed.length && capabilityIds.every((id) => assessed.includes(id)),
      `${host.id} capability assessment identities are incomplete or duplicated`)
    for (const assessment of host.capabilityAssessments) {
      requireCondition(assessmentStates.has(assessment.state), `${host.id}/${assessment.capabilityId} has an invalid state`)
      if (assessment.state !== "implemented") {
        requireCondition(typeof assessment.reason === "string" && assessment.reason.length > 0,
          `${host.id}/${assessment.capabilityId} requires a limitation reason`)
      }
      if (assessment.state === "implemented") {
        requireCondition(Array.isArray(assessment.probes) && assessment.probes.length > 0,
          `${host.id}/${assessment.capabilityId} requires source probes`)
      }
      for (const probe of assessment.probes ?? []) {
        requireCondition(typeof probe.path === "string", `${host.id}/${assessment.capabilityId} probe path is invalid`)
        assertStringList(probe.contains, `${host.id}/${assessment.capabilityId} probe markers`)
      }
    }
  }
  requireCondition(contract.providerEvidence?.format === "gaep-provider-behavior-v1" &&
    typeof contract.providerEvidence.reportPath === "string" &&
    contract.providerEvidence.expectedKind === "gaep-phase-0-provider-behavior-evidence-v1",
  "IDE provider behavior evidence contract is invalid")
  assertStringList(contract.providerEvidence.remainingRequirements, "IDE provider behavior remaining requirements")
  return capabilityIds
}

async function verifyProviderEvidence(repositoryRoot, contract) {
  const { resolved } = await verifyRepositoryFile(
    repositoryRoot,
    contract.providerEvidence.reportPath,
    maximumControlBytes,
    "provider behavior evidence",
  )
  const evidence = await readJson(resolved, "provider behavior evidence")
  requireCondition(evidence.kind === contract.providerEvidence.expectedKind,
    "Provider behavior evidence identity is invalid")
  return verifyProviderBehaviorEvidence({ repositoryRoot, receipt: evidence })
}

async function verifyPackage(repositoryRoot, packageReport, host) {
  requireCondition(packageReport?.schemaVersion === 1 && packageReport.kind === "gaep-local-ide-package-report-v1" &&
    Array.isArray(packageReport.artifacts) && typeof packageReport.claimBoundary === "string",
  "Local IDE package report identity is invalid")
  const matches = packageReport.artifacts.filter((artifact) => artifact?.host === host.id)
  requireCondition(matches.length === 1, `Package report must contain exactly one ${host.id} artifact`)
  const artifact = matches[0]
  requireCondition(artifact.packageId === host.packageId, `${host.id} package identity changed`)
  requireCondition(["produced", "not-produced-on-this-platform"].includes(artifact.status),
    `${host.id} package status is invalid`)
  const requiredHere = host.packagePlatforms.includes(process.platform)
  if (requiredHere) requireCondition(artifact.status === "produced", `${host.id} package is required on ${process.platform}`)
  if (artifact.status === "produced") {
    const { resolved, metadata } = await verifyRepositoryFile(
      repositoryRoot,
      artifact.artifactPath,
      128 * 1024 * 1024,
      `${host.id} package artifact`,
    )
    requireCondition(Number.isSafeInteger(artifact.bytes) && artifact.bytes === metadata.size,
      `${host.id} package byte count is stale`)
    requireCondition(typeof artifact.digest === "string" && artifact.digest === await digest(resolved),
      `${host.id} package digest is stale`)
  } else {
    const expectedPath = repositoryPath(repositoryRoot, artifact.artifactPath, `${host.id} missing package artifact`)
    try {
      await lstat(expectedPath)
      throw new Error(`${host.id} package report is stale because the declared-missing artifact exists`)
    } catch (error) {
      if (!(error && typeof error === "object" && error.code === "ENOENT")) throw error
    }
    requireCondition(typeof artifact.limitation === "string" && artifact.limitation.length > 0,
      `${host.id} missing package requires a limitation`)
  }
  requireCondition(typeof artifact.verification === "string" && artifact.verification.length > 0,
    `${host.id} package verification is missing`)
  return {
    status: artifact.status,
    artifactPath: artifact.artifactPath,
    bytes: artifact.bytes,
    digest: artifact.digest,
    verification: artifact.verification,
    limitation: artifact.limitation,
  }
}

async function verifyRuntimeEvidence(repositoryRoot, contract, runtimeEvidence, packageState, hostId) {
  if (runtimeEvidence.source === "package-report") {
    assertStringList(runtimeEvidence.requiredVerificationFragments, `${hostId} runtime verification fragments`)
    for (const fragment of runtimeEvidence.requiredVerificationFragments) {
      requireCondition(packageState.verification.includes(fragment), `${hostId} runtime verification evidence is stale`)
    }
    return { source: "package-report", level: runtimeEvidence.level }
  }
  requireCondition(typeof runtimeEvidence.reportPath === "string" && typeof runtimeEvidence.expectedKind === "string",
  `${hostId} JSON runtime evidence contract is invalid`)
  const { resolved } = await verifyRepositoryFile(
    repositoryRoot,
    runtimeEvidence.reportPath,
    maximumControlBytes,
    `${hostId} runtime evidence`,
  )
  const evidence = await readJson(resolved, `${hostId} runtime evidence`)
  requireCondition(evidence.kind === runtimeEvidence.expectedKind && typeof evidence.claimBoundary === "string" &&
    evidence.claimBoundary.length > 0,
  `${hostId} runtime evidence identity is invalid`)
  if (runtimeEvidence.format === "gaep-host-behavior-v1") {
    return verifyHostBehaviorEvidence({ repositoryRoot, contract, receipt: evidence, hostId, packageState })
  }
  requireCondition(Array.isArray(runtimeEvidence.assertions) && runtimeEvidence.assertions.length > 0,
    `${hostId} JSON runtime evidence assertions are invalid`)
  for (const assertion of runtimeEvidence.assertions) {
    assertStringList(assertion.path, `${hostId} runtime assertion path`)
    requireCondition(Object.hasOwn(assertion, "equals"), `${hostId} runtime assertion requires an exact value`)
    requireCondition(Object.is(valueAtPath(evidence, assertion.path), assertion.equals),
      `${hostId} runtime evidence assertion failed: ${assertion.path.join(".")}`)
  }
  return { source: runtimeEvidence.reportPath, level: runtimeEvidence.level }
}

async function verifyAssessment(repositoryRoot, hostId, assessment) {
  let probeCount = 0
  for (const probe of assessment.probes ?? []) {
    const { resolved } = await verifyRepositoryFile(
      repositoryRoot,
      probe.path,
      maximumSourceBytes,
      `${hostId}/${assessment.capabilityId} source probe`,
    )
    const source = await readFile(resolved, "utf8")
    for (const marker of probe.contains) {
      requireCondition(source.includes(marker), `${hostId}/${assessment.capabilityId} source marker is missing`)
    }
    probeCount++
  }
  return {
    capabilityId: assessment.capabilityId,
    state: assessment.state,
    sourceProbesVerified: probeCount,
    ...(assessment.reason ? { limitation: assessment.reason } : {}),
  }
}

export async function buildIdeConformanceReport({
  repositoryRoot,
  contractPath,
  packageReportPath,
  recordedAt,
}) {
  requireCondition(recordedAt === undefined || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(recordedAt),
    "IDE conformance recordedAt must be an exact UTC timestamp")
  const normalizedRoot = await realpath(resolve(repositoryRoot))
  const contract = await readJson(resolve(contractPath), "IDE conformance contract")
  const packageReport = await readJson(resolve(packageReportPath), "local IDE package report")
  const capabilityIds = validateContract(contract)
  const hosts = []
  for (const host of contract.hosts) {
    const packageState = await verifyPackage(normalizedRoot, packageReport, host)
    const runtimeEvidence = await verifyRuntimeEvidence(normalizedRoot, contract, host.runtimeEvidence, packageState, host.id)
    const capabilities = []
    for (const assessment of host.capabilityAssessments) {
      capabilities.push(await verifyAssessment(normalizedRoot, host.id, assessment))
    }
    const counts = Object.fromEntries([...assessmentStates].map((state) => [state,
      capabilities.filter((capability) => capability.state === state).length]))
    hosts.push({
      id: host.id,
      displayName: host.displayName,
      packageId: host.packageId,
      package: packageState,
      runtimeEvidence,
      capabilityCounts: counts,
      capabilities,
      remainingRequirements: host.runtimeEvidence.remainingRequirements,
      acceptance: "incomplete",
    })
  }
  const totals = Object.fromEntries([...assessmentStates].map((state) => [state,
    hosts.reduce((count, host) => count + host.capabilityCounts[state], 0)]))
  const providerEvidence = await verifyProviderEvidence(normalizedRoot, contract)
  return {
    schemaVersion: 1,
    kind: "gaep-phase-0-ide-conformance-report-v1",
    phase: contract.phase,
    ...(recordedAt ? { recordedAt } : {}),
    contractPath: relative(normalizedRoot, resolve(contractPath)),
    packageReportPath: relative(normalizedRoot, resolve(packageReportPath)),
    verificationResult: "pass",
    phaseGate: "incomplete",
    summary: {
      hosts: hosts.length,
      capabilities: capabilityIds.length,
      assessments: hosts.length * capabilityIds.length,
      ...totals,
      producedPackages: hosts.filter((host) => host.package.status === "produced").length,
      acceptedHosts: 0,
      providers: providerEvidence.providers,
      acceptedProviders: providerEvidence.liveAcceptedProviders,
    },
    hosts,
    providerEvidence: {
      ...providerEvidence,
      source: contract.providerEvidence.reportPath,
      remainingRequirements: contract.providerEvidence.remainingRequirements,
    },
    claimBoundary: contract.claimBoundary,
  }
}
