import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import { buildIdeConformanceReport } from "./lib/ide_conformance.mjs"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const contractPath = join(repositoryRoot, "conformance/phase-0-ide-contract.json")
const packageReportPath = join(
  repositoryRoot,
  "evidence/local-packages/2026-07-26T235930Z-phase-1-evidence-registry.json",
)
let temporaryRoot

before(async () => {
  temporaryRoot = await mkdtemp(join(tmpdir(), "gaep-ide-conformance-"))
})

after(async () => {
  if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true })
})

describe("Phase 0 IDE conformance matrix", () => {
  it("verifies current source, package, runtime and declared-gap truth without granting acceptance", async () => {
    const report = await buildIdeConformanceReport({ repositoryRoot, contractPath, packageReportPath })
    assert.equal(report.verificationResult, "pass")
    assert.equal(report.phaseGate, "incomplete")
    assert.deepEqual(
      {
        hosts: report.summary.hosts,
        capabilities: report.summary.capabilities,
        assessments: report.summary.assessments,
        implemented: report.summary.implemented,
        partial: report.summary.partial,
        notImplemented: report.summary["not-implemented"],
        producedPackages: report.summary.producedPackages,
        acceptedHosts: report.summary.acceptedHosts,
        providers: report.summary.providers,
        acceptedProviders: report.summary.acceptedProviders,
      },
      {
        hosts: 4,
        capabilities: 45,
        assessments: 180,
        implemented: 180,
        partial: 0,
        notImplemented: 0,
        producedPackages: 3,
        acceptedHosts: 0,
        providers: 2,
        acceptedProviders: 0,
      },
    )
    assert.deepEqual(report.hosts.map((host) => host.id).sort(), ["kiro", "rider", "visual-studio", "vscode"])
    assert.equal(report.hosts.every((host) => host.acceptance === "incomplete" && host.remainingRequirements.length > 0), true)
    assert.equal(report.providerEvidence.providers, 2)
    assert.equal(report.providerEvidence.checksPassed, 2)
    assert.equal(report.providerEvidence.liveAcceptedProviders, 0)
    assert.equal(report.providerEvidence.remainingRequirements.length > 0, true)
    assert.equal(JSON.stringify(report).includes(repositoryRoot), false)
  })

  it("fails closed when a claimed source capability marker drifts", async () => {
    const contract = JSON.parse(await readFile(contractPath, "utf8"))
    contract.hosts[0].capabilityAssessments[0].probes[0].contains[0] = "missing-source-contract-marker"
    const hostileContract = join(temporaryRoot, "hostile-contract.json")
    await writeFile(hostileContract, JSON.stringify(contract))
    await assert.rejects(
      buildIdeConformanceReport({ repositoryRoot, contractPath: hostileContract, packageReportPath }),
      /behavior source snapshot is stale|source marker is missing/u,
    )
  })

  it("fails closed when package evidence no longer matches the artifact bytes", async () => {
    const packageReport = JSON.parse(await readFile(packageReportPath, "utf8"))
    packageReport.artifacts.find((artifact) => artifact.host === "vscode").digest = `sha256:${"0".repeat(64)}`
    const hostileReport = join(temporaryRoot, "hostile-package-report.json")
    await writeFile(hostileReport, JSON.stringify(packageReport))
    await assert.rejects(
      buildIdeConformanceReport({ repositoryRoot, contractPath, packageReportPath: hostileReport }),
      /package digest is stale/u,
    )
  })
})
