import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { lstat, readFile, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve, sep } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { promisify } from "node:util"

import { canonicalDigest } from "@gaep/agent-sdk"

import { buildIdeConformanceReport } from "./lib/ide_conformance.mjs"
import { verifyPhase1RealisticReferenceArtifactDirectory } from "./phase1_realistic_reference_artifacts.mjs"
import { verifyClaudeP0P4ReceiptFile } from "./verify_claude_p0_p4_receipt.mjs"
import { verifyCodexP0P4ReceiptFile } from "./verify_codex_p0_p4_receipt.mjs"
import { verifyPhase0ExampleReceiptFile } from "./verify_phase0_example_receipt.mjs"
import { verifyProviderOutputComparisonFile } from "./verify_provider_output_comparison_receipt.mjs"
import { verifyPhase2RealisticFigmaLoopArtifactDirectory } from "./phase2_realistic_figma_loop_artifacts.mjs"

const execute = promisify(execFile)
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const sourceByteLimit = 2 * 1024 * 1024
const reportByteLimit = 512 * 1024
const defaultPaths = {
  contract: "conformance/phase-0-ide-contract.json",
  packages: "evidence/local-packages/20260730T190100Z-phase-3a-figma-to-boilerplate-mapping-packages.json",
  conformance: "evidence/ide-conformance/20260730T190200Z-phase-3a-figma-to-boilerplate-mapping.json",
  example: "evidence/examples/20260730T051956Z-phase-2-realistic-figma-loop/receipt.json",
}
const gateDefinitions = [
  { id: "typecheck", command: ["npm", "run", "typecheck"], parser: parseTypecheck },
  { id: "repository-tests", command: ["npm", "run", "test"], parser: parseVitest },
  { id: "windows-ci-contract", command: ["npm", "run", "test:ci-contract"], parser: parseNodeTests },
  { id: "canonical-example", command: ["npm", "run", "test:example"], parser: parseNodeTests },
  { id: "documentation", command: ["npm", "run", "validate:docs"], parser: parseDocumentation },
  { id: "ide-conformance", command: ["npm", "run", "test:ide-conformance"], parser: parseNodeTests },
  { id: "phase-report-contract", command: ["npm", "run", "test:phase-report"], parser: parseNodeTests },
]

function fail(message) {
  throw new Error(`Invalid Phase 0 acceptance report: ${message}`)
}

function rawDigest(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`
}

function normalizeRelativePath(root, path, label) {
  const resolved = resolve(root, path)
  const normalized = relative(root, resolved)
  if (!normalized || normalized === ".." || normalized.startsWith(`..${sep}`) || isAbsolute(normalized)) {
    fail(`${label} must stay inside the repository`)
  }
  return { resolved, normalized: normalized.split(sep).join("/") }
}

async function readRegularFile(path, label, byteLimit = sourceByteLimit) {
  const stat = await lstat(path)
  if (!stat.isFile() || stat.isSymbolicLink()) fail(`${label} must be a regular file`)
  if (stat.size < 2 || stat.size > byteLimit) fail(`${label} must be between 2 and ${byteLimit} bytes`)
  return readFile(path)
}

async function readJsonSource(root, path, label) {
  const location = normalizeRelativePath(root, path, label)
  const bytes = await readRegularFile(location.resolved, label)
  let value
  try {
    value = JSON.parse(bytes.toString("utf8"))
  } catch {
    fail(`${label} must contain valid JSON`)
  }
  return { ...location, bytes, value }
}

function exactCommand(definition) {
  return definition.command.join(" ")
}

function parseInteger(output, pattern, label) {
  const match = output.match(pattern)
  if (!match) throw new Error(`Validation output did not include ${label}`)
  return Number(match[1])
}

function parseTypecheck() {
  return { projects: "workspace-build-graph", errors: 0 }
}

function parseVitest(output) {
  return {
    filesPassed: parseInteger(output, /Test Files\s+(\d+) passed/u, "the passed test-file count"),
    testsPassed: parseInteger(output, /Tests\s+(\d+) passed/u, "the passed test count"),
    testsSkipped: Number(output.match(/Tests[^\n]*\|\s+(\d+) skipped/u)?.[1] ?? 0),
    testsFailed: 0,
  }
}

function parseNodeTests(output) {
  const matches = (label) => [...output.matchAll(new RegExp(`(?:^|\\n)(?:ℹ )?${label}\\s+(\\d+)`, "gu"))]
  const last = (label) => {
    const values = matches(label)
    if (values.length === 0) throw new Error(`Validation output did not include ${label}`)
    return Number(values.at(-1)[1])
  }
  return {
    tests: last("tests"),
    passed: last("pass"),
    failed: last("fail"),
    skipped: last("skipped"),
  }
}

function parseDocumentation(output) {
  const result = output.match(/(?:^|\n)result:\s+(\S+)/u)?.[1]
  if (result !== "PASS") throw new Error("Documentation validation did not report PASS")
  return {
    documents: parseInteger(output, /(?:^|\n)documents:\s+(\d+)/u, "the document count"),
    requirements: parseInteger(output, /(?:^|\n)requirement definitions:\s+(\d+)/u, "the requirement count"),
    warnings: parseInteger(output, /(?:^|\n)warnings:\s+(\d+)/u, "the warning count"),
  }
}

function validateTestEvidence(testEvidence) {
  if (!Array.isArray(testEvidence) || testEvidence.length !== gateDefinitions.length) {
    fail(`test evidence must contain ${gateDefinitions.length} exact gates`)
  }
  for (let index = 0; index < gateDefinitions.length; index++) {
    const definition = gateDefinitions[index]
    const evidence = testEvidence[index]
    if (evidence?.id !== definition.id || evidence.command !== exactCommand(definition) || evidence.result !== "pass" ||
        typeof evidence.outputDigest !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(evidence.outputDigest) ||
        evidence.summary === null || typeof evidence.summary !== "object" || Array.isArray(evidence.summary)) {
      fail(`test evidence ${index} differs from the exact passing gate contract`)
    }
    if (Object.values(evidence.summary).some((value) =>
      !(typeof value === "string" || Number.isSafeInteger(value)) || (typeof value === "number" && value < 0))) {
      fail(`test evidence ${definition.id} contains an invalid summary value`)
    }
    if (("failed" in evidence.summary && evidence.summary.failed !== 0) ||
        ("testsFailed" in evidence.summary && evidence.summary.testsFailed !== 0) ||
        ("errors" in evidence.summary && evidence.summary.errors !== 0) ||
        ("warnings" in evidence.summary && evidence.summary.warnings !== 0)) {
      fail(`test evidence ${definition.id} is not clean`)
    }
  }
}

async function sourceEvidence(id, source, expectedKind) {
  if (source.value?.kind !== expectedKind) fail(`${id} kind differs`)
  return {
    id,
    path: source.normalized,
    bytes: source.bytes.length,
    digest: rawDigest(source.bytes),
    kind: expectedKind,
  }
}

async function verifiedSources(root, paths) {
  const contract = await readJsonSource(root, paths.contract, "IDE conformance contract")
  const packages = await readJsonSource(root, paths.packages, "package report")
  const conformance = await readJsonSource(root, paths.conformance, "conformance report")
  const example = await readJsonSource(root, paths.example, "example receipt")
  if (conformance.value.recordedAt === undefined) fail("conformance report must bind recordedAt")
  const rebuiltConformance = await buildIdeConformanceReport({
    repositoryRoot: root,
    contractPath: contract.resolved,
    packageReportPath: packages.resolved,
    recordedAt: conformance.value.recordedAt,
  })
  try {
    assert.deepEqual(conformance.value, JSON.parse(JSON.stringify(rebuiltConformance)))
  } catch {
    fail("conformance report differs from current contract, package, host, provider, or source evidence")
  }
  const receipt = example.value?.kind === "gaep-phase2-realistic-figma-loop-receipt"
    ? (await verifyPhase2RealisticFigmaLoopArtifactDirectory(dirname(example.resolved))).receipt
    : example.value?.kind === "gaep-phase1-realistic-reference-receipt"
    ? (await verifyPhase1RealisticReferenceArtifactDirectory(dirname(example.resolved))).receipt
    : example.value?.kind === "gaep-provider-output-comparison-receipt"
    ? await verifyProviderOutputComparisonFile(example.resolved)
    : example.value?.kind === "gaep-claude-p0-p4-acceptance-receipt"
      ? await verifyClaudeP0P4ReceiptFile(example.resolved)
      : example.value?.kind === "gaep-codex-p0-p4-acceptance-receipt"
        ? await verifyCodexP0P4ReceiptFile(example.resolved)
        : await verifyPhase0ExampleReceiptFile(example.resolved)
  const hostPath = conformance.value.hosts[0]?.runtimeEvidence?.source
  if (typeof hostPath !== "string" || conformance.value.hosts.some((host) => host.runtimeEvidence.source !== hostPath)) {
    fail("conformance hosts do not share one exact behavior receipt")
  }
  const providerPath = conformance.value.providerEvidence?.source
  if (typeof providerPath !== "string") fail("conformance provider evidence path is missing")
  const host = await readJsonSource(root, hostPath, "host behavior receipt")
  const provider = await readJsonSource(root, providerPath, "provider behavior receipt")
  const sources = [
    await sourceEvidence("ide-contract", contract, "gaep-phase-0-ide-conformance-contract-v1"),
    await sourceEvidence("package-report", packages, "gaep-local-ide-package-report-v1"),
    await sourceEvidence("host-behavior", host, "gaep-phase-0-host-behavior-evidence-v1"),
    await sourceEvidence("provider-behavior", provider, "gaep-phase-0-provider-behavior-evidence-v1"),
    await sourceEvidence("ide-conformance", conformance, "gaep-phase-0-ide-conformance-report-v1"),
    await sourceEvidence("canonical-example", example, example.value.kind),
  ]
  return { packages: packages.value, conformance: conformance.value, receipt, sources, exampleKind: example.value.kind }
}

function knownGaps(inputs, { designApplicability, designPersonasRoles, userJourneys, informationArchitecture, screenStateInventory, designRequirements, backlogHierarchy, mvpSliceDefinition, prioritizationModel, acceptanceCriteria, definitionOfReady, definitionOfDone, implementationUnitModel, dependencyMapping, technologyProfile, boilerplateRegistry, boilerplateSelectionBinding, boilerplateCompatibilityValidation, figmaToBoilerplateMapping, designSystemTokenContract, accessibilityDesignRules, responsiveMultiPlatformTargets, manualFigmaExecutionPath, figmaMcpCapabilityDiscovery, figmaReadSnapshot, figmaContextImport, outboundDesignBriefPackage, governedFigmaWrite, finalizedFigmaSnapshotImport, designToRequirementBinding, designerReadyGate, designDelta, designConflictResolution, humanDesignApproval, designBaseline, designDriftDetection, phase2UxFigmaDashboard, phase2ChangeImpactAgentModelDashboard, phase2RealisticFigmaLoop }) {
  return [
    {
      id: "native-package-and-host-acceptance",
      state: "open",
      basis: `${inputs.packages.summary.missingNativePlatformArtifacts} native package missing; ${inputs.conformance.summary.acceptedHosts}/${inputs.conformance.summary.hosts} hosts accepted`,
    },
    {
      id: "live-provider-acceptance",
      state: "open",
      basis: `${inputs.conformance.summary.acceptedProviders}/${inputs.conformance.summary.providers} providers live accepted`,
    },
    {
      id: "product-owner-acceptance",
      state: "not-established",
      basis: "local implementation approval does not grant feature, phase, readiness, release, or deployment acceptance",
    },
    {
      id: "security-review",
      state: "not-completed",
      basis: "the limited Codex Security scan was explicitly skipped and no final security result exists",
    },
    {
      id: "release-controls",
      state: "not-established",
      basis: "signing, publication, supported-platform certification, release approval, deployment, and rollback acceptance are absent",
    },
    figmaToBoilerplateMapping
      ? {
          id: "phase-3a-figma-to-boilerplate-mapping-closure",
          state: "not-established",
          basis: "the exact versioned Figma-to-Boilerplate Mapping candidate lifecycle, one exact mapping subject per current Design-to-Requirement Binding, bounded component, token, layout, responsive-behavior and platform-target mapping kinds, mapped, conflict, unmapped and not-assessed candidate outcomes, exact selected boilerplate target, Implementation Unit and Requirement trace candidates, evidence and attributable review candidates, deterministic subject-catalog, target-catalog, trace, mapping and assessment receipts, exact current design applicability, design-system/token, responsive/platform, finalized-snapshot, design-to-requirement, design-baseline, Implementation Unit Model, Technology Profile, Boilerplate Registry, Boilerplate Selection and Binding and Boilerplate Compatibility Validation bindings, immutable revisions, privacy-safe Product Studio table and four host projections are implemented locally; candidates do not connect to or call Figma, establish returned Figma content, design validity, approval or baseline, mapping truth or completeness, effective selection or binding, compatibility truth, retrieval, import, instantiation, code generation, implementation readiness or completeness, assignment, execution, acceptance, merge, release, deployment, native-host interaction or Product Owner acceptance",
        }
      : boilerplateCompatibilityValidation
      ? {
          id: "phase-3a-boilerplate-compatibility-validation-closure",
          state: "not-established",
          basis: "the exact versioned Boilerplate Compatibility Validation candidate lifecycle, one exact subject per selected Boilerplate Selection and Binding decision, complete canonical fourteen-dimension coverage, evidence and exception candidates, deterministic validation-subject, dimension, evidence, validation and assessment receipts, exact current Implementation Unit Model, Dependency Mapping, Technology Profile, Boilerplate Registry and Boilerplate Selection and Binding bindings, immutable revisions, privacy-safe Product Studio table and four host projections are implemented locally; candidates do not establish compatibility truth or completeness, validation decisions, actual asset behavior, test execution, design validity, security, privacy or licensing approval, exception or waiver authority, effective selection or binding, source retrieval, import or instantiation, architecture baseline, implementation readiness or completeness, assignment, execution, acceptance, merge, release, deployment, native-host interaction or Product Owner acceptance",
        }
      : boilerplateSelectionBinding
      ? {
          id: "phase-3a-boilerplate-selection-binding-closure",
          state: "not-established",
          basis: "the exact versioned Boilerplate Selection and Binding candidate lifecycle, one evidence-backed decision per current Implementation Unit, selected, not-applicable, deferred and not-assessed dispositions, exact Technology Profile and Boilerplate Registry entry and version candidate references, alternatives, conditions and deviations, deterministic unit-decision, selection, binding and assessment receipts, exact current Implementation Unit Model, Dependency Mapping, Technology Profile and Boilerplate Registry bindings, immutable revisions, privacy-safe Product Studio table and four host projections are implemented locally; candidates do not establish organizational designation, endorsement, approval, support commitment, effective selection or binding, compatibility truth, completeness or validation, licensing or security approval, exception or waiver authority, source retrieval, import or instantiation, architecture baseline, implementation readiness or completeness, assignment, execution, acceptance, merge, release, deployment, native-host interaction or Product Owner acceptance",
        }
      : boilerplateRegistry
      ? {
          id: "phase-3a-boilerplate-registry-closure",
          state: "not-established",
          basis: "the exact versioned Boilerplate Registry candidate lifecycle, bounded candidate organizational boilerplate entries, source and version candidates, applicability, availability, integrity, provenance, support, lifecycle, Technology Profile and architecture compatibility, licensing, security-policy and exception evidence states, deterministic entry, source, compatibility and assessment receipts, exact current Implementation Unit Model and Technology Profile bindings, immutable revisions, privacy-safe Product Studio table and four host projections are implemented locally; candidates do not establish organizational designation, endorsement, approval, support commitment, compatibility truth or completeness, licensing or security approval, exception or waiver authority, selection or binding, architecture baseline, implementation readiness or completeness, assignment, execution, acceptance, merge, release, deployment, native-host interaction or Product Owner acceptance",
        }
      : technologyProfile
      ? {
          id: "phase-3a-technology-profile-closure",
          state: "not-established",
          basis: "the exact versioned Technology Profile candidate lifecycle, complete current Implementation Unit profile coverage, bounded technology, runtime, framework, library, toolchain, platform, version and constraint selections, compatibility, provenance, support, licensing, security-policy and lifecycle evidence states, deterministic profile, selection, compatibility and assessment receipts, exact current Implementation Unit Model and Dependency Mapping bindings, immutable revisions, privacy-safe Product Studio table and four host projections are implemented locally; candidates do not establish technology approval, support commitment, compatibility truth or completeness, licensing or security approval, exception or waiver authority, architecture-baseline designation, implementation readiness or completeness, assignment, execution, approval, acceptance, merge, release, deployment, native-host interaction or Product Owner acceptance",
        }
      : dependencyMapping
      ? {
          id: "phase-3a-dependency-mapping-closure",
          state: "not-established",
          basis: "the exact versioned Dependency Mapping candidate lifecycle, complete current Implementation Unit node catalog, typed directed acyclic dependency edges, required, conditional and advisory strengths, evidence states, deterministic longest candidate-effort critical path, canonical tie handling, graph, critical-path and assessment receipts, exact current Backlog Hierarchy, MVP and Vertical Slice, and Implementation Unit Model bindings, immutable revisions, privacy-safe Product Studio table and four host projections are implemented locally; candidates do not establish dependency truth or completeness, critical-path authority, sequencing commitment, ownership appointment, implementation readiness or completeness, assignment, execution, approval, acceptance, merge, release, deployment, native-host interaction or Product Owner acceptance",
        }
      : implementationUnitModel
      ? {
          id: "phase-3a-implementation-unit-model-closure",
          state: "not-established",
          basis: "the exact versioned Implementation Unit Model candidate lifecycle, complete current MVP Story and Task membership, exact Requirement membership, candidate repository and module placement, owner candidates, dependency edges, blast-radius assessments, deterministic membership, placement and assessment receipts, exact current Backlog Hierarchy, MVP and Vertical Slice, Acceptance Criteria, Definition of Ready and Definition of Done bindings, immutable revisions, privacy-safe Product Studio table and four host projections are implemented locally; candidates do not establish repository truth, appoint ownership, prove dependency or impact completeness, grant implementation readiness or completeness, assignment, execution, approval, acceptance, merge, release, deployment, native-host interaction or Product Owner acceptance",
        }
      : definitionOfDone
      ? {
          id: "phase-3a-definition-of-done-closure",
          state: "not-established",
          basis: "the exact versioned Definition of Done item-evaluation candidate lifecycle, complete current MVP Story and Task subject catalog, versioned completion policy, required or not-applicable candidate dispositions, exact evidence and assessor inputs, deterministic evaluation receipt, expiry and invalidation, exact current Backlog Hierarchy, MVP and Vertical Slice, Prioritization Model, Acceptance Criteria, and Definition of Ready bindings, immutable revisions, privacy-safe Product Studio table and four host projections are implemented locally; a candidate pass remains an evaluation result and does not establish evidence truth, test success, quality, Requirement or Acceptance Criteria satisfaction, approval, ready or done state, exception or waiver authority, implementation completeness, merge, release or deployment readiness, assignment, execution, acceptance, native-host interaction or Product Owner acceptance",
        }
      : definitionOfReady
      ? {
          id: "phase-3a-definition-of-ready-closure",
          state: "not-established",
          basis: "the exact versioned Definition of Ready item-evaluation candidate lifecycle, complete current MVP Story and Task subject catalog, versioned prerequisite policy, required or not-applicable candidate dispositions, exact evidence and assessor inputs, deterministic evaluation receipt, expiry and invalidation, exact current Backlog Hierarchy, MVP and Vertical Slice, Prioritization Model, and Acceptance Criteria bindings, immutable revisions, privacy-safe Product Studio table and four host projections are implemented locally; a candidate pass remains an evaluation result and does not establish prerequisite truth, criterion validity or completeness, Requirement satisfaction, priority, commitment, approval, ready or done state, exception or waiver authority, phase entry, implementation readiness, assignment, execution, acceptance, native-host interaction or Product Owner acceptance",
        }
      : acceptanceCriteria
      ? {
          id: "phase-3a-acceptance-criteria-closure",
          state: "not-established",
          basis: "the exact versioned Acceptance Criteria candidate lifecycle, structured precondition, stimulus and expected-result criteria over current MVP Story and Task subjects, exact Requirement traces, declared verification methods, exact current Backlog Hierarchy, MVP and Vertical Slice, and Prioritization Model bindings, immutable revisions, privacy-safe Product Studio table and four host projections are implemented locally; candidate testability and coverage do not establish criterion validity, completeness, Requirement satisfaction, acceptance, approval, readiness, assignment, execution, native-host interaction or Product Owner acceptance",
        }
      : prioritizationModel
      ? {
          id: "phase-3a-prioritization-model-closure",
          state: "not-established",
          basis: "the exact versioned prioritization candidate lifecycle, deterministic weighted-sum-v1 scoring with normalized value, risk-reduction, dependency-enablement and inverse cost-size dimensions, exact current MVP and Vertical Slice binding, evidence identities, uncertainty, immutable revisions, privacy-safe Product Studio table and four host projections are implemented locally; scores remain advisory candidates and do not establish priority, commitment, approval, readiness, assignment, execution, native-host interaction or Product Owner acceptance",
        }
      : mvpSliceDefinition
      ? {
          id: "phase-3a-mvp-slice-definition-closure",
          state: "not-established",
          basis: "the exact versioned MVP and Vertical Slice candidate lifecycle, complete Backlog node scope partition, earlier-only slice dependencies, exact MVP Story and Task membership, exact current Backlog Hierarchy binding, privacy-safe Product Studio table and four host projections are implemented locally; real priority, commitment, scope approval, acceptance-criteria validity, ready or done determinations, implementation readiness, assignment or execution, native-host interaction and Product Owner acceptance remain incomplete",
        }
      : backlogHierarchy
      ? {
          id: "phase-3a-backlog-hierarchy-closure",
          state: "not-established",
          basis: "the exact versioned Backlog Hierarchy candidate lifecycle, strict Epic-to-Feature-to-Story-to-Task topology, exact Work Item, Change and Requirement bindings, privacy-safe Product Studio table and four host projections are implemented locally; real prioritized backlog commitments, accountable ownership, acceptance criteria, ready or done determinations, implementation readiness, assignment or execution, native-host interaction and Product Owner acceptance remain incomplete",
        }
      : phase2RealisticFigmaLoop
      ? {
          id: "phase-2-realistic-figma-loop-example-closure",
          state: "not-established",
          basis: "the exact deterministic 12-stage, 23-source Phase 2 realistic Figma loop artifact, two derived dashboards, four host projection bindings and three fail-closed recovery cases are implemented locally with zero writes, imports, approvals, Baseline Set designations or implementation effects; real Product research, returned current Figma content, live Figma or provider execution, external completeness and design validity, accountable human review and authority, effective approval, an actual Baseline Set, native-host interaction and Product Owner acceptance remain incomplete",
        }
      : phase2ChangeImpactAgentModelDashboard
      ? {
          id: "phase-2-change-impact-agent-model-dashboard-closure",
          state: "not-established",
          basis: "the exact derived Phase 2 synchronization-change, bounded-impact and Initiative-scoped Agent/Model execution-truth views are implemented locally across Product Studio and four host projections; real Product and design evidence, returned current Figma content, live Figma connection or execution, complete impact coverage, external design validity, live-provider and semantic output quality, accountable human review, approval or Baseline Set designation, readiness, selection, Run launch, remediation or implementation effects, native-host interaction and Product Owner acceptance remain incomplete",
        }
      : phase2UxFigmaDashboard
      ? {
          id: "phase-2-ux-figma-dashboard-closure",
          state: "not-established",
          basis: "the exact derived Phase 2 UX/Figma dashboard is implemented locally across Product Studio and four host projections; real Product and design evidence, returned current Figma content, live Figma connection or execution, external completeness and design validity, accountable human review, approval or Baseline Set designation, readiness, remediation or implementation effects, native-host interaction and Product Owner acceptance remain incomplete",
        }
      : designDriftDetection
      ? {
          id: "phase-2-design-drift-detection-closure",
          state: "not-established",
          basis: "the Design Drift Detection candidate is implemented locally across the shared engine and four host projections; real Product research, an actual Baseline Set designation, returned current Figma content, exact current Design Requirements, trace and implementation-target inputs, attributable human review, drift and external completeness, design and implementation validity, applied remediation, stale-state resolution, native-host interaction and Product Owner acceptance remain incomplete",
        }
      : designBaseline
      ? {
          id: "phase-2-design-baseline-versioning-closure",
          state: "not-established",
          basis: "the Design Baseline version candidate is implemented locally across the shared engine and four host projections; real Product research, an effective Human Design Approval determination, accountable baseline-designation authority, verified approver authority, enforced separation of duties, an actual Baseline Set designation, branch and merge governance, effective supersession, withdrawal or restoration, stale-state resolution, returned current Figma content, design validity, readiness, phase entry, native-host interaction and Product Owner acceptance remain incomplete",
        }
      : humanDesignApproval
      ? {
          id: "phase-2-human-design-approval-closure",
          state: "not-established",
          basis: "the Human Design Approval recorded-decision candidate is implemented locally across the shared engine and four host projections; real Product research, an approved Design Baseline, a returned current Figma snapshot, exact current design prerequisites and finalized-snapshot subject, accountable approver identity and verified authority evidence, enforced separation of duties and independence, effective approval or rejection, condition satisfaction, expiry and revocation resolution, stale-state resolution, design validity, approval, baseline, readiness, phase entry, native-host interaction and Product Owner acceptance remain incomplete",
        }
      : designConflictResolution
      ? {
          id: "phase-2-design-conflict-resolution-closure",
          state: "not-established",
          basis: "the Design Conflict Resolution candidate is implemented locally across the shared engine and four host projections; real Product research, an approved Design Baseline, a returned current Figma snapshot, exact current conflicting Design Delta inputs, attributable human proposal and review, accountable decision evidence, enforced separation of duties, applied conflict resolution, synchronization, stale-state resolution, design validity, approval, baseline, readiness, native-host interaction and Product Owner acceptance remain incomplete",
        }
      : designDelta
      ? {
          id: "phase-2-design-delta-closure",
          state: "not-established",
          basis: "the Design Delta comparison candidate is implemented locally across the shared engine and four host projections; real Product research, an approved Design Baseline, a returned current Figma snapshot, exact current comparison inputs, attributable human delta/provenance/conflict/mapping review, conflict resolution, synchronization, stale-state resolution, delta and external completeness, design validity, native-host interaction, design review and approval, readiness and Product Owner acceptance remain incomplete",
        }
      : designerReadyGate
      ? {
          id: "phase-2-designer-ready-gate-closure",
          state: "not-established",
          basis: "the Designer-Ready Gate evaluation candidate is implemented locally across the shared engine and four host projections; real Product research, exact current prerequisite records, attributable human assessment and review, accountable exception decisions and evidence, stale-state resolution, design and external completeness, design validity, native-host interaction, design review and approval, Design Baseline, readiness, phase entry and Product Owner acceptance remain incomplete",
        }
      : designToRequirementBinding
      ? {
          id: "phase-2-design-to-requirement-binding-closure",
          state: "not-established",
          basis: "the Design-to-Requirement Binding review candidate is implemented locally across the shared engine and four host projections; real Product research, attributable human finalized-design, Requirement, Decision, relationship, provenance, coverage, conflict, reconciliation and evidence review, relationship truth, coverage completeness, Requirement satisfaction, Decision effectiveness, actual Figma content transfer or import, a live Figma connection or request, credential and permission workflows, import or write execution, external completeness, design validity, native-host interaction, design review and approval, Design Baseline and Product Owner acceptance remain incomplete",
        }
      : finalizedFigmaSnapshotImport
      ? {
          id: "phase-2-finalized-figma-snapshot-import-closure",
          state: "not-established",
          basis: "the finalized Figma Snapshot Import review candidate is implemented locally across the shared engine and four host projections; real Product research, attributable human governed-write, return-receipt, item, conflict, authorization, reconciliation, provenance, completeness and evidence review, actual content transfer or import, a live Figma connection or request, credential and permission workflows, import authorization, execution or result, external completeness, target and design validation, native-host interaction, design review and approval, Design Baseline and Product Owner acceptance remain incomplete",
        }
      : governedFigmaWrite
      ? {
          id: "phase-2-governed-figma-write-closure",
          state: "not-established",
          basis: "the governed Figma Write authorization-review candidate is implemented locally across the shared engine and four host projections; real Product research, attributable human package, target, request, effect, preview, approval, permission, idempotency, replay, recovery, disclosure, provenance and evidence review, actual package materialization or context transfer, a live Figma connection or request, credential and permission workflows, write authorization or execution, external-version, target and design validation, native-host interaction, design review and approval, Design Baseline and Product Owner acceptance remain incomplete",
        }
      : outboundDesignBriefPackage
      ? {
          id: "phase-2-outbound-design-brief-package-closure",
          state: "not-established",
          basis: "the governed Outbound Design Brief Package manifest-only candidate is implemented locally across the shared engine and four host projections; real Product research, attributable human Context Pack, entry, Context Item, recipient, redaction, requirement-coverage, disclosure, provenance and evidence review, actual package materialization or context transfer, a live Figma connection or request, credential and permission workflows, write authorization or execution, target and design validation, native-host interaction, design review and approval, Design Baseline and Product Owner acceptance remain incomplete",
        }
      : figmaContextImport
      ? {
          id: "phase-2-figma-context-import-closure",
          state: "not-established",
          basis: "the governed Figma Context Import candidate is implemented locally across the shared engine and four host projections; real Product research, attributable human Context Pack, section, Context Item, Figma target, redaction, requirement-coverage, provenance, evidence and ownership review, actual context packaging or transfer, a live Figma connection or request, credential and permission workflows, write authorization or execution, target and design validation, native-host interaction, design review and approval, Design Baseline and Product Owner acceptance remain incomplete",
        }
      : figmaReadSnapshot
      ? {
          id: "phase-2-figma-read-snapshot-closure",
          state: "not-established",
          basis: "the governed Figma Read Snapshot candidate is implemented locally across the shared engine and four host projections; real Product research, attributable human file, component, variable-collection, variable, provenance, freshness, type, evidence and ownership review, a live Figma connection or request, credential and permission workflows, external completeness validation, write authorization, native-host interaction, design review and approval, Design Baseline and Product Owner acceptance remain incomplete",
        }
      : figmaMcpCapabilityDiscovery
      ? {
          id: "phase-2-figma-mcp-capability-discovery-closure",
          state: "not-established",
          basis: "the governed Figma MCP Capability Discovery candidate is implemented locally across the shared engine and four host projections; real Product research, attributable human adapter, tool, permission, limit, version, evidence and ownership review, live connector discovery, actual Figma connection or request, credential and permission workflows, live availability and compatibility validation, write authorization, native-host interaction, design review and approval, Design Baseline and Product Owner acceptance remain incomplete",
        }
      : manualFigmaExecutionPath
      ? {
          id: "phase-2-manual-figma-execution-path-closure",
          state: "not-established",
          basis: "the governed Manual Figma Execution Path candidate is implemented locally across the shared engine and four host projections; real Product research, attributable human scope, instruction, handoff, return-contract, review-check, evidence-state, ownership and requirement-coverage review, actual manual Figma execution, returned-design completeness, native-host interaction, design review and approval, Design Baseline and Product Owner acceptance remain incomplete",
        }
      : responsiveMultiPlatformTargets
      ? {
          id: "phase-2-responsive-multi-platform-targets-closure",
          state: "not-established",
          basis: "the governed Responsive and Multi-Platform Targets candidate is implemented locally across the shared engine and four host projections; real Product research, attributable human platform-target, breakpoint, behavior, check, evidence-state, ownership and requirement-coverage review, native-host interaction, responsive and platform-parity testing, breakpoint and behavior validation, accessibility testing, design approval, Design Baseline and Product Owner acceptance remain incomplete",
        }
      : accessibilityDesignRules
      ? {
          id: "phase-2-accessibility-design-rules-closure",
          state: "not-established",
          basis: "the governed Accessibility Design Rules candidate is implemented locally across the shared engine and four host projections; real Product research, attributable human target, rule, check, evidence-state, ownership and requirement-coverage review, native-host interaction, accessibility testing, rule and check validation, legal review, design approval, Design Baseline and Product Owner acceptance remain incomplete",
        }
      : designSystemTokenContract
      ? {
          id: "phase-2-design-system-token-contract-closure",
          state: "not-established",
          basis: "the governed Design System and Token Contract candidate is implemented locally across the shared engine and four host projections; real Product research, attributable human design-system, token, variable, component, ownership, accessibility and requirement-coverage review, native-host interaction, design-system and catalog validation, design approval, Design Baseline and Product Owner acceptance remain incomplete",
        }
      : designRequirements
      ? {
          id: "phase-2-design-requirements-closure",
          state: "not-established",
          basis: "the governed Design Requirements candidate is implemented locally across the shared engine and four host projections; real Product research, attributable human requirement, outcome-link, design-target and backlog-disposition review, native-host interaction, requirement validation and prioritization, design approval, Design Baseline and Product Owner acceptance remain incomplete",
        }
      : screenStateInventory
      ? {
          id: "phase-2-screen-state-inventory-closure",
          state: "not-established",
          basis: "the governed Screen and State Inventory candidate is implemented locally across the shared engine and four host projections; real Product research, attributable human screen/state/variant review, route and scope coverage validation, native-host interaction, interaction and accessibility validation, design approval, Design Baseline and Product Owner acceptance remain incomplete",
        }
      : informationArchitecture
      ? {
          id: "phase-2-information-architecture-closure",
          state: "not-established",
          basis: "the governed Information Architecture candidate is implemented locally across the shared engine and four host projections; real Product research, attributable human findability, comprehension and accessibility validation, content validation and design-scope review, native-host interaction, design approval, Design Baseline and Product Owner acceptance remain incomplete",
        }
      : userJourneys
      ? {
          id: "phase-2-user-journeys-closure",
          state: "not-established",
          basis: "the governed User Journeys candidate is implemented locally across the shared engine and four host projections; real Product research, observed-behavior evidence, attributable human journey validation and scope-exception review, native-host interaction, design approval, Design Baseline and Product Owner acceptance remain incomplete",
        }
      : designPersonasRoles
      ? {
          id: "phase-2-design-personas-roles-closure",
          state: "not-established",
          basis: "the governed Design Personas and Roles candidate is implemented locally across the shared engine and four host projections; real Product research, persona validation, attributable human role-responsibility review, native-host interaction, design approval, Design Baseline and Product Owner acceptance remain incomplete",
        }
      : designApplicability
      ? {
          id: "phase-2-design-applicability-closure",
          state: "not-established",
          basis: "the governed Design Applicability candidate is implemented locally across the shared engine and four host projections; real Product use, independent human decisions, native-host acceptance, design approval, Design Baseline and Product Owner acceptance remain incomplete",
        }
      : [
      "gaep-codex-p0-p4-acceptance-receipt",
      "gaep-claude-p0-p4-acceptance-receipt",
      "gaep-provider-output-comparison-receipt",
      "gaep-phase1-realistic-reference-receipt",
    ].includes(inputs.exampleKind)
      ? {
          id: "phase-1-closure",
          state: "not-established",
          basis: inputs.exampleKind === "gaep-phase1-realistic-reference-receipt"
            ? "the deterministic realistic reference makes both P0-P4 stores inspectable; real Product validation, live providers, native-host acceptance and independent human/Product Owner acceptance remain incomplete"
            : inputs.exampleKind === "gaep-provider-output-comparison-receipt"
            ? "the deterministic provider comparison proves structural receipt parity only; semantic quality, live providers, dashboards, native-host acceptance and human acceptance remain incomplete"
            : inputs.exampleKind === "gaep-claude-p0-p4-acceptance-receipt"
              ? "the deterministic Claude parity workflow is local candidate evidence; live providers, dashboards, native-host acceptance and human acceptance remain incomplete"
              : "the deterministic Codex workflow is local candidate evidence; live provider, Claude parity, dashboards, native-host acceptance and human acceptance remain incomplete",
        }
      : {
          id: "later-phase-reports",
          state: "not-produced",
          basis: "this report covers Phase 0 / 1A local evidence only; later phases require separate revalidation",
        },
  ]
}

export async function buildPhase0AcceptanceReport({
  root = repositoryRoot,
  paths = defaultPaths,
  recordedAt,
  sourceCommit,
  testEvidence,
}) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(recordedAt ?? "")) fail("recordedAt is invalid")
  if (!/^[0-9a-f]{40}$/u.test(sourceCommit ?? "")) fail("sourceCommit must be an exact Git commit")
  validateTestEvidence(testEvidence)
  const inputs = await verifiedSources(resolve(root), paths)
  const designApplicability = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "design-applicability" && capability.state === "implemented"))
  const designPersonasRoles = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "design-personas-roles" && capability.state === "implemented"))
  const userJourneys = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "user-journeys" && capability.state === "implemented"))
  const informationArchitecture = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "information-architecture" && capability.state === "implemented"))
  const screenStateInventory = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "screen-state-inventory" && capability.state === "implemented"))
  const designRequirements = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "design-requirements" && capability.state === "implemented"))
  const backlogHierarchy = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "backlog-hierarchy" && capability.state === "implemented"))
  const mvpSliceDefinition = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "mvp-slice-definition" && capability.state === "implemented"))
  const prioritizationModel = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "prioritization-model" && capability.state === "implemented"))
  const acceptanceCriteria = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "acceptance-criteria" && capability.state === "implemented"))
  const definitionOfReady = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "definition-of-ready" && capability.state === "implemented"))
  const definitionOfDone = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "definition-of-done" && capability.state === "implemented"))
  const implementationUnitModel = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "implementation-unit-model" && capability.state === "implemented"))
  const dependencyMapping = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "dependency-mapping" && capability.state === "implemented"))
  const technologyProfile = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "technology-profile" && capability.state === "implemented"))
  const boilerplateRegistry = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "boilerplate-registry" && capability.state === "implemented"))
  const boilerplateSelectionBinding = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "boilerplate-selection-binding" && capability.state === "implemented"))
  const boilerplateCompatibilityValidation = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "boilerplate-compatibility-validation" && capability.state === "implemented"))
  const figmaToBoilerplateMapping = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "figma-to-boilerplate-mapping" && capability.state === "implemented"))
  const designSystemTokenContract = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "design-system-token-contract" && capability.state === "implemented"))
  const accessibilityDesignRules = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "accessibility-design-rules" && capability.state === "implemented"))
  const responsiveMultiPlatformTargets = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "responsive-multi-platform-targets" && capability.state === "implemented"))
  const manualFigmaExecutionPath = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "manual-figma-execution-path" && capability.state === "implemented"))
  const figmaMcpCapabilityDiscovery = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "figma-mcp-capability-discovery" && capability.state === "implemented"))
  const figmaReadSnapshot = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "figma-read-snapshot" && capability.state === "implemented"))
  const figmaContextImport = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "figma-context-import" && capability.state === "implemented"))
  const outboundDesignBriefPackage = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "outbound-design-brief-package" && capability.state === "implemented"))
  const governedFigmaWrite = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "governed-figma-write" && capability.state === "implemented"))
  const finalizedFigmaSnapshotImport = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "finalized-figma-snapshot-import" && capability.state === "implemented"))
  const designToRequirementBinding = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "design-to-requirement-binding" && capability.state === "implemented"))
  const designerReadyGate = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "designer-ready-gate" && capability.state === "implemented"))
  const designDelta = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "design-delta" && capability.state === "implemented"))
  const designConflictResolution = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "design-conflict-resolution" && capability.state === "implemented"))
  const humanDesignApproval = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "human-design-approval" && capability.state === "implemented"))
  const designBaseline = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "design-baseline" && capability.state === "implemented"))
  const designDriftDetection = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "design-drift-detection" && capability.state === "implemented"))
  const phase2UxFigmaDashboard = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "phase2-ux-figma-dashboard" && capability.state === "implemented"))
  const phase2ChangeImpactAgentModelDashboard = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "phase2-change-impact-agent-model-dashboard" && capability.state === "implemented"))
  const phase2RealisticFigmaLoop = inputs.exampleKind === "gaep-phase2-realistic-figma-loop-receipt"
  const gaps = knownGaps(inputs, {
    designApplicability,
    designPersonasRoles,
    userJourneys,
    informationArchitecture,
    screenStateInventory,
    designRequirements,
    backlogHierarchy,
    mvpSliceDefinition,
    prioritizationModel,
    acceptanceCriteria,
    definitionOfReady,
    definitionOfDone,
    implementationUnitModel,
    dependencyMapping,
    technologyProfile,
    boilerplateRegistry,
    boilerplateSelectionBinding,
    boilerplateCompatibilityValidation,
    figmaToBoilerplateMapping,
    designSystemTokenContract,
    accessibilityDesignRules,
    responsiveMultiPlatformTargets,
    manualFigmaExecutionPath,
    figmaMcpCapabilityDiscovery,
    figmaReadSnapshot,
    figmaContextImport,
    outboundDesignBriefPackage,
    governedFigmaWrite,
    finalizedFigmaSnapshotImport,
    designToRequirementBinding,
    designerReadyGate,
    designDelta,
    designConflictResolution,
    humanDesignApproval,
    designBaseline,
    designDriftDetection,
    phase2UxFigmaDashboard,
    phase2ChangeImpactAgentModelDashboard,
    phase2RealisticFigmaLoop,
  })
  const p0P4 = [
    "gaep-codex-p0-p4-acceptance-receipt",
    "gaep-claude-p0-p4-acceptance-receipt",
    "gaep-provider-output-comparison-receipt",
    "gaep-phase1-realistic-reference-receipt",
  ]
    .includes(inputs.exampleKind)
  const claudeP0P4 = inputs.exampleKind === "gaep-claude-p0-p4-acceptance-receipt"
  const providerComparison = inputs.exampleKind === "gaep-provider-output-comparison-receipt"
  const realisticReference = inputs.exampleKind === "gaep-phase1-realistic-reference-receipt"
  const phase1AgentModelDashboard = inputs.conformance.hosts.every((host) =>
    host.capabilities.some((capability) =>
      capability.capabilityId === "phase1-agent-model-dashboard" && capability.state === "implemented"))
  const report = {
    schemaVersion: 1,
    kind: "gaep-phase-acceptance-report-v1",
    phase: figmaToBoilerplateMapping || boilerplateCompatibilityValidation || boilerplateSelectionBinding || boilerplateRegistry || technologyProfile || dependencyMapping || implementationUnitModel || definitionOfDone || definitionOfReady || acceptanceCriteria || prioritizationModel || mvpSliceDefinition || backlogHierarchy ? "phase-3a-delivery-planning" : phase2ChangeImpactAgentModelDashboard || phase2UxFigmaDashboard || designDriftDetection || designBaseline || humanDesignApproval || designConflictResolution || designDelta || designerReadyGate || designToRequirementBinding || finalizedFigmaSnapshotImport || governedFigmaWrite || outboundDesignBriefPackage || figmaContextImport || figmaReadSnapshot || figmaMcpCapabilityDiscovery || manualFigmaExecutionPath || responsiveMultiPlatformTargets || accessibilityDesignRules || designSystemTokenContract || designRequirements || screenStateInventory || informationArchitecture || userJourneys || designPersonasRoles || designApplicability ? "phase-2-ux-figma-loop" : p0P4 ? "phase-1-p0-p4-core" : "phase-0-1a-foundation",
    evidenceScope: figmaToBoilerplateMapping
      ? "phase-3a-figma-to-boilerplate-mapping-local"
      : boilerplateCompatibilityValidation
      ? "phase-3a-boilerplate-compatibility-validation-local"
      : boilerplateSelectionBinding
      ? "phase-3a-boilerplate-selection-binding-local"
      : boilerplateRegistry
      ? "phase-3a-boilerplate-registry-local"
      : technologyProfile
      ? "phase-3a-technology-profile-local"
      : dependencyMapping
      ? "phase-3a-dependency-mapping-local"
      : implementationUnitModel
      ? "phase-3a-implementation-unit-model-local"
      : definitionOfDone
      ? "phase-3a-definition-of-done-local"
      : definitionOfReady
      ? "phase-3a-definition-of-ready-local"
      : acceptanceCriteria
      ? "phase-3a-acceptance-criteria-local"
      : prioritizationModel
      ? "phase-3a-prioritization-model-local"
      : mvpSliceDefinition
      ? "phase-3a-mvp-slice-definition-local"
      : backlogHierarchy
      ? "phase-3a-backlog-hierarchy-local"
      : phase2RealisticFigmaLoop
      ? "phase-2-realistic-figma-loop-example-local"
      : phase2ChangeImpactAgentModelDashboard
      ? "phase-2-change-impact-agent-model-dashboard-local"
      : phase2UxFigmaDashboard
      ? "phase-2-ux-figma-dashboard-local"
      : designDriftDetection
      ? "phase-2-design-drift-detection-local"
      : designBaseline
      ? "phase-2-design-baseline-versioning-local"
      : humanDesignApproval
      ? "phase-2-human-design-approval-local"
      : designConflictResolution
      ? "phase-2-design-conflict-resolution-local"
      : designDelta
      ? "phase-2-design-delta-local"
      : designerReadyGate
      ? "phase-2-designer-ready-gate-local"
      : designToRequirementBinding
      ? "phase-2-design-to-requirement-binding-local"
      : finalizedFigmaSnapshotImport
      ? "phase-2-finalized-figma-snapshot-import-local"
      : governedFigmaWrite
      ? "phase-2-governed-figma-write-local"
      : outboundDesignBriefPackage
      ? "phase-2-outbound-design-brief-package-local"
      : figmaContextImport
      ? "phase-2-figma-context-import-local"
      : figmaReadSnapshot
      ? "phase-2-figma-read-snapshot-local"
      : figmaMcpCapabilityDiscovery
      ? "phase-2-figma-mcp-capability-discovery-local"
      : manualFigmaExecutionPath
      ? "phase-2-manual-figma-execution-path-local"
      : responsiveMultiPlatformTargets
      ? "phase-2-responsive-multi-platform-targets-local"
      : accessibilityDesignRules
      ? "phase-2-accessibility-design-rules-local"
      : designSystemTokenContract
      ? "phase-2-design-system-token-contract-local"
      : designRequirements
      ? "phase-2-design-requirements-local"
      : screenStateInventory
      ? "phase-2-screen-state-inventory-local"
      : informationArchitecture
      ? "phase-2-information-architecture-local"
      : userJourneys
      ? "phase-2-user-journeys-local"
      : designPersonasRoles
      ? "phase-2-design-personas-roles-local"
      : designApplicability
      ? "phase-2-design-applicability-local"
      : realisticReference
      ? "phase-1-realistic-reference-local"
      : phase1AgentModelDashboard
      ? "phase-1-agent-model-dashboard-local"
      : providerComparison
      ? "phase-1-provider-output-comparison-local"
      : claudeP0P4
        ? "phase-1-claude-p0-p4-local"
        : p0P4
          ? "phase-1-codex-p0-p4-local"
          : "phase-0-local",
    recordedAt,
    sourceCommit,
    verificationResult: "pass",
    reportingStatus: "current-local-evidence-bound",
    phaseGate: "incomplete",
    acceptance: "not-established",
    readiness: "not-established",
    securityReview: "not-completed-explicitly-skipped",
    releaseAuthorization: "not-authorized",
    summary: {
      packagesExpected: inputs.packages.summary.expected,
      packagesProduced: inputs.packages.summary.produced,
      hosts: inputs.conformance.summary.hosts,
      hostCapabilities: inputs.conformance.summary.capabilities,
      hostAssessments: inputs.conformance.summary.assessments,
      hostAssessmentsImplemented: inputs.conformance.summary.implemented,
      hostAssessmentsPartial: inputs.conformance.summary.partial,
      hostAssessmentsNotImplemented: inputs.conformance.summary["not-implemented"],
      hostsAccepted: inputs.conformance.summary.acceptedHosts,
      providers: inputs.conformance.summary.providers,
      providersAccepted: inputs.conformance.summary.acceptedProviders,
      validationGatesPassed: testEvidence.length,
      validationGatesFailed: 0,
      exampleSummaryDigest: inputs.receipt.summaryDigest ?? inputs.receipt.comparisonDigest ?? inputs.receipt.compositionDigest,
      knownGaps: gaps.length,
    },
    sources: inputs.sources,
    tests: testEvidence,
    testsDigest: canonicalDigest(testEvidence),
    knownGaps: gaps,
    knownGapsDigest: canonicalDigest(gaps),
    claimBoundary: figmaToBoilerplateMapping
      ? "This report binds the exact governed Figma-to-Boilerplate Mapping candidate lifecycle, immutable revision history, one exact mapping subject per current Design-to-Requirement Binding, bounded component, token, layout, responsive-behavior and platform-target mapping kinds, mapped, conflict, unmapped and not-assessed candidate outcomes, exact selected boilerplate target, Implementation Unit and Requirement trace candidates, evidence and attributable review candidates, deterministic subject-catalog, target-catalog, trace, mapping and assessment receipts, exact current Product, Initiative, design applicability, design-system/token, responsive/platform, finalized-snapshot, design-to-requirement, design-baseline, Implementation Unit Model, Technology Profile, Boilerplate Registry, Boilerplate Selection and Binding and Boilerplate Compatibility Validation bindings, portable protocol-v2 transport, privacy-safe Product Studio table and four host projections to current package, test, host and conformance evidence. Figma-to-Boilerplate mappings remain governed candidates only. This report does not connect to or call Figma; establish returned Figma content, design validity, approval or baseline, mapping truth or completeness, effective selection or binding, compatibility truth; retrieve, import, instantiate, generate or execute assets; establish implementation readiness or completeness, assignment, execution, acceptance, merge, release, deployment, implementation, write or action authority; prove native-host or Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : boilerplateCompatibilityValidation
      ? "This report binds the exact governed Boilerplate Compatibility Validation candidate lifecycle, immutable revision history, one exact validation subject per selected Boilerplate Selection and Binding decision, complete canonical architecture, build, dependency, deployment, design-system, licensing-policy, packaging, platform, runtime, security-privacy, stack, test, toolchain and version dimension coverage, exact evidence and exception candidates, deterministic validation-subject, dimension, evidence, validation and assessment receipts, exact current Product, Initiative, Implementation Unit Model, Dependency Mapping, Technology Profile, Boilerplate Registry and Boilerplate Selection and Binding bindings, portable protocol-v2 transport, privacy-safe Product Studio table and four host projections to current package, test, host and conformance evidence. Compatibility validations remain governed candidates only. This report does not establish compatibility truth or completeness, validation decisions, actual asset behavior, test execution, design validity, security, privacy or licensing approval, exception or waiver authority, effective selection or binding, source retrieval, import or instantiation, architecture baseline, implementation readiness or completeness, assignment, execution, acceptance, merge, release, deployment, implementation, write or action authority; prove native-host or Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : boilerplateSelectionBinding
      ? "This report binds the exact governed Boilerplate Selection and Binding candidate lifecycle, immutable revision history, one evidence-backed decision per current Implementation Unit, selected, not-applicable, deferred and not-assessed dispositions, exact Technology Profile and Boilerplate Registry entry and version candidate references, alternatives, conditions and deviations, deterministic unit-decision, selection, binding and assessment receipts, exact current Product, Initiative, Implementation Unit Model, Dependency Mapping, Technology Profile and Boilerplate Registry bindings, portable protocol-v2 transport, privacy-safe Product Studio table and four host projections to current package, test, host and conformance evidence. Boilerplate selection and binding decisions remain governed candidates only. This report does not establish organizational designation, endorsement, approval, support commitment, effective selection or binding, compatibility truth, completeness or validation, licensing or security approval, exception or waiver authority, source retrieval, import or instantiation, architecture baseline, implementation readiness or completeness, assignment, execution, acceptance, merge, release, deployment, implementation, write or action authority; prove native-host or Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : boilerplateRegistry
      ? "This report binds the exact governed Boilerplate Registry candidate lifecycle, immutable revision history, bounded candidate organizational boilerplate entries, source and version candidates, applicability, availability, integrity, provenance, support, lifecycle, Technology Profile and architecture compatibility, licensing, security-policy and exception evidence states, deterministic entry, source, compatibility and assessment receipts, exact current Product, Initiative, Implementation Unit Model and Technology Profile bindings, portable protocol-v2 transport, privacy-safe Product Studio table and four host projections to current package, test, host and conformance evidence. Boilerplate entries remain governed candidates only. This report does not establish organizational designation, endorsement, approval, support commitment, compatibility truth or completeness, licensing or security approval, exception or waiver authority, selection or binding, architecture baseline, implementation readiness or completeness, assignment, execution, acceptance, merge, release, deployment, implementation, write or action authority; prove native-host or Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : technologyProfile
      ? "This report binds the exact governed Technology Profile candidate lifecycle, immutable revision history, complete current Implementation Unit profile coverage, bounded technology, runtime, framework, library, toolchain, platform, version and constraint selections, compatibility, provenance, support, licensing, security-policy and lifecycle evidence states, deterministic profile, selection, compatibility and assessment receipts, exact current Product, Initiative, Implementation Unit Model and Dependency Mapping bindings, portable protocol-v2 transport, privacy-safe Product Studio table and four host projections to current package, test, host and conformance evidence. Technology Profiles remain governed candidates only. This report does not establish technology approval, support commitment, compatibility truth or completeness, licensing or security approval, exception or waiver authority, architecture-baseline designation, implementation readiness or completeness, assignment, execution, approval, acceptance, merge, release, deployment, implementation, write or action authority; prove native-host or Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : dependencyMapping
      ? "This report binds the exact governed Dependency Mapping candidate lifecycle, immutable revision history, complete current Implementation Unit node catalog, typed directed acyclic dependency edges, required, conditional and advisory strengths, evidence states, deterministic longest candidate-effort critical path with canonical tie handling, graph, critical-path and assessment receipts, exact current Product, Initiative, Backlog Hierarchy, MVP and Vertical Slice, and Implementation Unit Model bindings, portable protocol-v2 transport, privacy-safe Product Studio table and four host projections to current package, test, host and conformance evidence. Dependency maps and critical paths remain governed candidates only. This report does not establish dependency truth or completeness, critical-path authority, sequencing commitment, ownership appointment, implementation readiness or completeness, assignment, execution, approval, acceptance, merge, release, deployment, implementation, write or action authority; prove native-host or Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : implementationUnitModel
      ? "This report binds the exact governed Implementation Unit Model candidate lifecycle, immutable revision history, complete current MVP Story and Task membership, exact Requirement membership, candidate repository and module placement, owner candidates, dependency edges, blast-radius assessments, deterministic membership, placement and assessment receipts, exact current Product, Initiative, Backlog Hierarchy, MVP and Vertical Slice, Acceptance Criteria, Definition of Ready and Definition of Done bindings, portable protocol-v2 transport, privacy-safe Product Studio table and four host projections to current package, test, host and conformance evidence. Implementation units remain governed candidates only. This report does not establish repository truth, appoint ownership, prove dependency or impact completeness, grant implementation readiness or completeness, assignment, execution, approval, acceptance, merge, release, deployment, implementation, write or action authority; prove native-host or Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : definitionOfDone
      ? "This report binds the exact governed Definition of Done item-evaluation candidate lifecycle, immutable revision history, complete current MVP Story and Task subject catalog, versioned completion policy, required or not-applicable candidate dispositions, exact evidence and assessor inputs, deterministic evaluation receipt, expiry and invalidation, exact current Product, Initiative, Backlog Hierarchy, MVP and Vertical Slice, Prioritization Model, Acceptance Criteria, and Definition of Ready bindings, portable protocol-v2 transport, privacy-safe Product Studio table and four host projections to current package, test, host and conformance evidence. A candidate pass remains an evaluation result only. This report does not establish evidence truth, test success, quality, Requirement or Acceptance Criteria satisfaction, approval, ready or done state, exception or waiver authority, implementation completeness, merge, release or deployment readiness, assignment, execution, acceptance, implementation, write or action authority; prove native-host or Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : definitionOfReady
      ? "This report binds the exact governed Definition of Ready item-evaluation candidate lifecycle, immutable revision history, complete current MVP Story and Task subject catalog, versioned prerequisite policy, required or not-applicable candidate dispositions, exact evidence and assessor inputs, deterministic evaluation receipt, expiry and invalidation, exact current Product, Initiative, Backlog Hierarchy, MVP and Vertical Slice, Prioritization Model, and Acceptance Criteria bindings, portable protocol-v2 transport, privacy-safe Product Studio table and four host projections to current package, test, host and conformance evidence. A candidate pass remains an evaluation result only. This report does not establish prerequisite truth, criterion validity or completeness, Requirement satisfaction, priority, commitment, approval, ready or done state, exception or waiver authority, admission, phase entry, implementation readiness, assignment, execution, acceptance, implementation, write or action authority; prove native-host or Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : acceptanceCriteria
      ? "This report binds the exact governed Acceptance Criteria candidate lifecycle, immutable revision history, structured precondition, stimulus and expected-result criteria over exact current MVP Story and Task subjects, exact Requirement traces, declared verification methods, candidate-testability and coverage assessment, exact current Product, Initiative, Backlog Hierarchy, MVP and Vertical Slice, and Prioritization Model bindings, portable protocol-v2 transport, privacy-safe Product Studio table and four host projections to current package, test, host and conformance evidence. Criteria and coverage remain advisory candidates only. This report does not establish criterion validity, completeness, Requirement satisfaction, priority, commitment, approval, ready or done state, implementation readiness, assignment, execution, acceptance, implementation, write or action authority; prove native-host or Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : prioritizationModel
      ? "This report binds the exact governed prioritization candidate lifecycle, immutable revision history, deterministic weighted-sum-v1 scoring with normalized value, risk-reduction, dependency-enablement and inverse cost-size dimensions, exact evidence identities and uncertainty, exact current Product, Initiative, MVP and Vertical Slice binding, portable protocol-v2 transport, privacy-safe Product Studio table and four host projections to current package, test, host and conformance evidence. Scores are advisory candidate projections only. This report does not establish priority, ordering authority, commitment, approval, acceptance-criteria validity, ready or done state, implementation readiness, assignment, execution, implementation, write or action authority; prove native-host or Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : mvpSliceDefinition
      ? "This report binds the exact governed MVP and Vertical Slice candidate lifecycle, immutable revision history, complete disposition of every exact current Backlog Hierarchy node as MVP, later or excluded, exact MVP ancestor closure, exact one-time assignment of every MVP Story and Task to ordered Vertical Slices, earlier-only slice dependencies, candidate testability state, exact current Product, Initiative and Backlog Hierarchy binding, bounded scope, slice and gap assessment, portable protocol-v2 transport, privacy-safe Product Studio table and four host projections to current package, test, host and conformance evidence. This report does not establish priority, commitment, scope approval, acceptance-criteria validity, ready or done state, implementation readiness, assignment, execution, implementation, write or action authority; prove native-host or Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : backlogHierarchy
      ? "This report binds the exact governed Backlog Hierarchy candidate lifecycle, immutable revision history, strict Epic-to-Feature-to-Story-to-Task topology, exact current Product and Initiative binding, exact current Work Item and Change membership, exact Story and Task Requirement traces, bounded topology, trace and gap assessment, portable protocol-v2 transport, privacy-safe Product Studio table and four host projections to current package, test, host and conformance evidence. This report does not duplicate Work Item title, scope, owner or execution authority; establish priority, commitment, ownership, ready or done state, acceptance criteria, implementation readiness, assignment, execution, implementation, write or action authority; prove native-host or Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : phase2RealisticFigmaLoop
      ? "This report binds the exact deterministic Phase 2 realistic Figma-loop scenario, 12 ordered candidate stages, 23 governed source candidates, two derived dashboard snapshots, three fail-closed recovery cases, four exact host projection bindings, copied prior local evidence and zero external or implementation effects to current package, test, host and conformance evidence. This report does not establish real Product research, returned current Figma content, a live Figma or provider connection, credentials, permissions, content transfer, write or import execution, provider usage, cost or quality, design or external completeness or validity, accountable human authority, effective approval, an actual Baseline Set, readiness, remediation, implementation or action authority, native-host or Product Owner acceptance, security approval, release authorization or deployment approval."
      : phase2ChangeImpactAgentModelDashboard
      ? "This report binds the exact derived Phase 2 synchronization-change, bounded-impact and Initiative-scoped Agent/Model execution-truth views to the exact Phase 2 UX/Figma and Agent/Model source snapshot digests, exact Product and Initiative identity and revision digests, bounded source availability, trace, drift, freshness, capability, selection, Run, Managed Run and handoff counts, unavailable provider usage and cost, not-assessed live-provider and semantic output quality, explicit no-authority governance states, accessible Product Studio and four-host projections, and current package, test, host and conformance evidence. This report does not create a second source of truth, establish impact completeness, design or external completeness or validity, provider readiness or quality, provider preference, selection, Run launch, handoff acknowledgement, approval, a Baseline Set designation, readiness, phase entry, remediation, Figma, implementation or effect authority, connect to or call Figma, request credentials, grant permissions, authorize or perform imports or writes, prove real Product research or returned current Figma content, establish native-host or Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : phase2UxFigmaDashboard
      ? "This report binds the exact derived Phase 2 UX/Figma dashboard, canonical ordered P2-01 through P2-23 source catalog, exact Product and Initiative identity and revision digests, explicit current, attention-required and unavailable source states, bounded experience, design-system, Figma, trace, drift and freshness aggregates, stable source-catalog and snapshot digests, explicit no-authority governance states, accessible Product Studio and four-host projections, and current package, test, host and conformance evidence. This report does not create a second source of truth, establish design or external completeness or validity, connect to or call Figma, request credentials, grant permissions, authorize or perform imports or writes, establish Human Design Approval or a Baseline Set designation, grant readiness or phase entry, apply remediation, change implementation, grant action authority, prove real Product research or returned current Figma content, establish native-host or Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : designDriftDetection
      ? "This report binds the exact Design Drift Detection candidate lifecycle, exact Product and Initiative identity, exact current Design Baseline candidate, returned Figma snapshot candidate, Design Requirements candidate, Design-to-Requirement trace candidate and declared versioned implementation-target catalog, bounded requirement-to-design and design-to-implementation observations, comparison and membership digests, classifications, severities, attributable human-review state, remediation candidates with no applied effect, expiration, stale-binding, stale-source and unresolved-gap metadata, immutable history, portable transport and four-host privacy-safe projections to current package, test, host and conformance evidence. This report does not establish an actual Baseline Set, comparison or external completeness, drift completeness, design or implementation validity, approval, readiness, remediation effect, connect to or call Figma, request credentials, grant permissions, authorize or perform writes or imports, change implementation, grant implementation or action authority, prove real Product research or returned current Figma content, establish native-host or Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : designBaseline
      ? "This report binds the exact Design Baseline version-candidate lifecycle, exact Product and Initiative identity, exact current Human Design Approval candidate and assessment, exact finalized-snapshot subject and scope, immutable candidate-set membership and revision, baseline lineage, semantic and schema version axes, version-policy, designation-definition and designation-receipt digests, exact predecessor references, bounded proposal, supersession, withdrawal and restoration candidates, attributable human proposal state, authority-evidence and independence declarations, expiration, stale-binding, stale-source and unresolved-gap metadata, immutable history, portable transport and four-host privacy-safe projections to current package, test, host and conformance evidence. This report does not convert an approval candidate into approval, verify approver authority, enforce separation of duties, establish an Approval Determination or Baseline Set designation, apply supersession, withdrawal or restoration, establish branch or merge governance, readiness or phase entry, connect to or call Figma, request credentials, grant permissions, authorize or perform writes or imports, grant implementation or action authority, prove real Product research or returned current Figma content, establish native-host or Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : humanDesignApproval
      ? "This report binds the exact Human Design Approval recorded-decision candidate lifecycle, exact Product and Initiative identity, five exact current design prerequisites, exact finalized-snapshot subject identity, revision, digest, external file and version digests, item catalog and count, exact included and excluded item scope, bounded approve, reject, request-change and abstain decision candidates, decision-definition and decision-receipt digests, attributable human decision state, authority-evidence and independence declarations, expiration, revocation, stale-binding, stale-source and unresolved-gap metadata, immutable history, portable transport and four-host privacy-safe projections to current package, test, host and conformance evidence. Even an approve candidate does not verify approver authority, enforce separation of duties, establish design approval, a Design Baseline, readiness or phase entry, connect to or call Figma, request credentials, grant permissions, authorize or perform writes or imports, grant implementation or action authority, prove real Product research or a returned current Figma snapshot, establish native-host or Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : designConflictResolution
      ? "This report binds the exact Design Conflict Resolution candidate lifecycle, exact Product and Initiative identity, exact current Design Delta and conflicting-delta digest, bounded accept-source, accept-target, merge, reject-change and escalate candidates, resolution-definition, resolution-receipt and resolution-catalog digests, attributable human proposal and review state, recorded distinct-actor declaration, expiration, coverage, provenance, stale-binding, stale-source and unresolved-gap metadata, portable transport and four-host privacy-safe projections to current package, test, host and conformance evidence. This report does not enforce separation of duties, resolve or apply conflicts, synchronize design, establish conflict or design validity, approval, a Design Baseline or readiness, connect to or call Figma, request credentials, grant permissions, authorize or perform writes or imports, prove real Product research or a returned current Figma snapshot, establish native-host or Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : designDelta
      ? "This report binds the exact Design Delta comparison-candidate lifecycle, exact Product and Initiative identity, exact current Designer-Ready Gate, Finalized Figma Snapshot Import and Design-to-Requirement Binding dependencies, source and target snapshot digests, stable comparison definitions and receipts, bounded added, changed, conflicting, missing, stale and unmapped classifications, attributable human-review state, stale-binding, stale-source, unresolved-mapping and unresolved-question metadata, portable transport and four-host privacy-safe projections to current package, test, host and conformance evidence. This report does not establish delta or external completeness, design validity or approval, a Design Baseline, readiness, conflict-resolution or synchronization authority, connect to or call Figma, request credentials, grant permissions, authorize or perform writes or imports, prove real Product research or a returned current Figma snapshot, establish native-host or Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : designerReadyGate
      ? "This report binds the exact Designer-Ready Gate evaluation-candidate lifecycle, exact Product and Initiative identity, twelve exact current governed prerequisite records, stable assessment definitions and receipts, attributable human-review state, bounded exception-candidate decisions, stale-binding, stale-source and unresolved-question metadata, portable transport and four-host privacy-safe projections to current package, test, host and conformance evidence. A passing candidate remains an evaluation result, not permission or readiness. This report does not establish design or external completeness, design validity or approval, a Design Baseline, readiness, exception or waiver authority, acceptance, phase entry, implementation or action authority, connect to or call Figma, request credentials, grant permissions, authorize or perform writes or imports, prove real Product research, establish native-host or Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : designToRequirementBinding
      ? "This report binds the exact Design-to-Requirement Binding review-candidate lifecycle, exact Product, Initiative, Finalized Figma Snapshot Import, Design Requirements and Decision Register dependencies, bounded relationship, coverage, conflict, reconciliation, provenance, evidence-state and gap metadata, portable transport and four-host privacy-safe projections to current package, test, host and conformance evidence. It does not establish relationship truth, coverage completeness, Requirement satisfaction, Decision effectiveness, transfer or import Figma content, connect to or call Figma, request credentials, grant permissions, authorize or perform writes or imports, prove external completeness, validate or approve design, establish a Design Baseline, prove real Product research, grant readiness, implementation or action authority, establish native-host or Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : finalizedFigmaSnapshotImport
      ? "This report binds the exact Finalized Figma Snapshot Import review-candidate lifecycle, exact Product, Initiative and Governed Figma Write dependencies, bounded return-receipt, item, conflict, authorization, reconciliation, provenance, completeness, evidence-state and gap metadata, portable transport and four-host privacy-safe projections to current package, test, host and conformance evidence. It does not transfer or import content, connect to or call Figma, request credentials, grant permissions, authorize or perform writes or imports, prove external completeness, validate external versions, targets or design, approve design, establish a Design Baseline, prove real Product research, grant readiness, implementation or action authority, establish native-host or Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : governedFigmaWrite
      ? "This report binds the exact governed Figma Write authorization-review candidate lifecycle, exact Product, Initiative and Outbound Design Brief Package dependencies, bounded package, target, request, effect, preview, approval-state, permission-evidence-state, idempotency, replay, recovery, disclosure, provenance, evidence-state and gap metadata, portable transport and four-host privacy-safe projections to current package, test, host and conformance evidence. It does not materialize or transfer context, connect to or call Figma, request credentials, grant permissions, authorize or perform writes, validate external versions, targets or design, approve design, establish a Design Baseline, prove real Product research, grant readiness, implementation or action authority, establish native-host or Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : outboundDesignBriefPackage
      ? "This report binds the exact governed Outbound Design Brief Package manifest-only candidate lifecycle, exact Product, Initiative, Figma Context Import and Context Pack dependencies, bounded entry, Context Item, recipient, redaction, requirement-coverage, disclosure, provenance, evidence-state, manifest, payload and preview receipt metadata, portable transport and four-host privacy-safe projections to current package, test, host and conformance evidence. It does not materialize or transfer context, connect to or call Figma, request credentials, grant permissions, authorize or perform writes, validate targets or design, approve design, establish a Design Baseline, prove real Product research, grant readiness, implementation or action authority, establish native-host or Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : figmaContextImport
      ? "This report binds the exact governed Figma Context Import candidate lifecycle, exact Product, Initiative, Design Applicability, Design Requirements, Context Pack, Figma Read Snapshot and Figma MCP Capability Discovery dependencies, bounded section, Context Item, Figma target, redaction, requirement-coverage, provenance, evidence-state, candidate-ownership and gap metadata, portable transport and four-host privacy-safe projections to current package, test, host and conformance evidence. It does not package or transfer context, connect to or call Figma, request credentials, grant permissions, authorize or perform writes, validate targets or design, approve design, establish a Design Baseline, prove real Product research, grant readiness, implementation or action authority, establish native-host or Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : figmaReadSnapshot
      ? "This report binds the exact governed Figma Read Snapshot candidate lifecycle, exact Product, Initiative, Design Applicability, Design System and Token Contract, Figma MCP Capability Discovery and Sources dependencies, bounded file, component, variable-collection, variable, external-version, provenance, freshness, evidence-state, type-gap, candidate-ownership and gap metadata, portable transport and four-host privacy-safe projections to current package, test, host and conformance evidence. It does not connect to or call Figma, request credentials, grant permissions, prove external completeness, authorize writes, validate or approve design, establish a Design Baseline, prove real Product research, grant readiness, implementation or action authority, establish native-host or Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : figmaMcpCapabilityDiscovery
      ? "This report binds the exact governed Figma MCP Capability Discovery candidate lifecycle, exact Product, Initiative, Design Applicability, Manual Figma Execution Path and Sources dependencies, bounded adapter, tool, advertised-availability, read/write effect, schema digest, permission requirement, capability limit, version, evidence-state, candidate-ownership and gap metadata, portable transport and four-host privacy-safe projections to current package, test, host and conformance evidence. It does not connect to or call Figma, request credentials, grant permissions, establish live tool availability or compatibility, authorize writes, approve design, establish a Design Baseline, prove real Product research, grant readiness, implementation or action authority, establish native-host or Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : manualFigmaExecutionPath
      ? "This report binds the exact governed Manual Figma Execution Path candidate lifecycle, exact Product, Initiative, Design Applicability, Screen and State Inventory, Design Requirements, Design System and Token Contract, Accessibility Design Rules, Responsive and Multi-Platform Targets and Sources dependencies, bounded scope, ordered human instruction, handoff and return-contract catalogs, review-check, evidence-state, candidate-ownership and requirement-coverage metadata, portable transport and four-host privacy-safe projections to current package, test, host and conformance evidence. It does not connect to Figma, prove manual execution or returned-design completeness, grant write authority, establish check validity or accessibility conformance, approve design, establish a Design Baseline, prove real Product research, grant readiness, implementation or action authority, establish native-host or Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : responsiveMultiPlatformTargets
      ? "This report binds the exact governed Responsive and Multi-Platform Targets candidate lifecycle, exact Product, Initiative, Screen and State Inventory, Design Requirements, Design System and Token Contract, Accessibility Design Rules and Sources dependencies, bounded platform-target, breakpoint, responsive-behavior, design-check, evidence-state, candidate-ownership and requirement-coverage metadata, portable transport and four-host privacy-safe projections to current package, test, host and conformance evidence. It does not establish responsive completeness, platform parity, Breakpoint or Responsive Behavior validity, accessibility conformance, ownership authority, design approval, a Design Baseline, real Product research, readiness, implementation, write or action authority, native-host acceptance, Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : accessibilityDesignRules
      ? "This report binds the exact governed Accessibility Design Rules candidate lifecycle, exact Product, Initiative, Screen and State Inventory, Design Requirements, Design System and Token Contract, Sources and optional portable-design snapshot dependencies, bounded candidate target, rule, design-check, evidence-state, candidate-ownership and requirement-coverage metadata, portable transport and four-host privacy-safe projections to current package, test, host and conformance evidence. It does not establish accessibility conformance, Rule or Design Check validity, legal compliance, ownership authority, design approval, a Design Baseline, real Product research, readiness, implementation, write or action authority, native-host acceptance, Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : designSystemTokenContract
      ? "This report binds the exact governed Design System and Token Contract candidate lifecycle, exact Product, Initiative, Design Applicability, Screen and State Inventory, Design Requirements and optional portable-design snapshot dependencies, bounded Design System, Token, Variable Collection, Variable, Component, candidate-ownership, requirement-coverage and accessibility-review metadata, portable transport and four-host privacy-safe projections to current package, test, host and conformance evidence. It does not establish Design System, Token, Variable or Component validity, ownership authority, accessibility validity, design approval, a Design Baseline, real Product research, readiness, implementation, write or action authority, native-host acceptance, Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : designRequirements
      ? "This report binds the exact governed Design Requirements candidate lifecycle, exact Product, Initiative, Outcome Model and Screen and State Inventory dependencies, current Requirement records, exact Initiative Work Items, bounded outcome coverage, design targets, backlog dispositions and evidence, portable transport and four-host privacy-safe projections to current package, test, host and conformance evidence. It does not establish requirement validity, completeness, priority approval, satisfaction, backlog commitment, design approval, a Design Baseline, real Product research, implementation or action authority, native-host acceptance, Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : screenStateInventory
      ? "This report binds the exact governed Screen and State Inventory candidate lifecycle, exact Product, Initiative and Information Architecture dependencies, bounded platform targets, screens, entry/default/degraded/failure/recovery states, variants, exact navigation-route and design-scope coverage, evidence, accessibility, privacy, data-use and fallback semantics, portable transport and four-host privacy-safe projections to current package, test, host and conformance evidence. It does not prove UI completeness, platform parity, state reachability, interaction quality or accessibility, validate every route or scope, approve a design or platform target, establish a Design Baseline, prove real Product research, grant implementation authority, or establish native-host acceptance, Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : informationArchitecture
      ? "This report binds the exact governed Information Architecture candidate lifecycle, exact Product, Initiative, Design Applicability, Design Personas and Roles and User Journeys dependencies, canonical cycle-free content hierarchy, routes, exact design-scope and journey-touchpoint coverage, findability, comprehension and accessibility evidence states, privacy and data-use constraints, portable transport and four-host privacy-safe projections to current package, test, host and conformance evidence. It does not prove findability, comprehension or accessibility, validate content, approve a design scope or design, establish a Design Baseline, prove real Product research, grant implementation authority, or establish native-host acceptance, Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : userJourneys
      ? "This report binds the exact governed User Journeys candidate lifecycle, exact Design Applicability and Design Personas and Roles dependencies, explicit primary, success, failure and recovery path structure, portable transport and four-host privacy-safe projections to current package, test, host and conformance evidence. It does not prove observed behavior, validate a journey, approve a scope exception or design, establish a Design Baseline, prove real Product research, grant implementation authority, or establish native-host acceptance, Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : designPersonasRoles
      ? "This report binds the exact governed Design Personas and Roles candidate lifecycle, evidence-backed persona hypotheses, explicit design-role responsibilities, portable transport and four-host privacy-safe projections to current package, test, host and conformance evidence. It does not validate a persona, appoint a role, verify competence or authority, approve design, establish a Design Baseline, prove real Product research, grant implementation authority, or establish native-host acceptance, Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : designApplicability
      ? "This report binds the exact governed Design Applicability candidate lifecycle, portable transport and four-host privacy-safe projections to current package, test, host and conformance evidence. It records explicit UX, UI, design-work and Figma decisions and required depth without inferring not-applicable state. It is not an independent human design decision, design approval, Design Baseline, Figma integration, real Product validation, native-host acceptance, Product Owner acceptance, Product readiness, security approval, implementation authority, release authorization or deployment approval."
      : realisticReference
      ? "This report binds the exact Atlas Release Readiness realistic reference scenario to two independently reopened P0-P4 portable stores, 21 governed record kinds per provider, all 25 output classes, managed Run, readiness, handoff, audit and structural provider-comparison evidence. It is deterministic local evidence, not a real Product baseline, live-provider or native-host acceptance, Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : phase1AgentModelDashboard
      ? "This report binds the current exact Phase 1 Agent and Model execution-truth dashboard to package, test, host, deterministic provider-comparison and conformance evidence. It is not live-provider quality or provider-ranking evidence, automatic-selection authority, native-host acceptance, Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval."
      : p0P4
      ? `This report binds the current deterministic local ${providerComparison ? "Codex/Claude provider-output comparison" : claudeP0P4 ? "Claude P0-P4 candidate workflow" : "Codex P0-P4 candidate workflow"} to package, test, host, provider and conformance evidence. It is not semantic model-quality or provider-ranking evidence, live-provider or native-host acceptance, Product Owner acceptance, Product readiness, security approval, release authorization or deployment approval.`
      : "This report binds current local Phase 0 / 1A package, test, host, provider, conformance and example evidence. It is not native-host or live-provider acceptance, Product readiness, security approval, release authorization, deployment approval, or a later-phase report.",
  }
  return report
}

export async function verifyPhase0AcceptanceReportObject(report, options = {}) {
  if (report === null || typeof report !== "object" || Array.isArray(report)) fail("report must be an object")
  const rebuilt = await buildPhase0AcceptanceReport({
    root: options.root ?? repositoryRoot,
    paths: options.paths ?? defaultPaths,
    recordedAt: report.recordedAt,
    sourceCommit: report.sourceCommit,
    testEvidence: report.tests,
  })
  try {
    assert.deepEqual(report, rebuilt)
  } catch {
    fail("report differs from the exact current evidence and fail-closed acceptance projection")
  }
  return report
}

export async function verifyPhase0AcceptanceReportFile(path, options = {}) {
  const bytes = await readRegularFile(resolve(path), "phase acceptance report", reportByteLimit)
  let report
  try {
    report = JSON.parse(bytes.toString("utf8"))
  } catch {
    fail("phase acceptance report must contain valid JSON")
  }
  return verifyPhase0AcceptanceReportObject(report, options)
}

async function runValidationGates(root) {
  const evidence = []
  for (const definition of gateDefinitions) {
    const [executable, ...args] = definition.command
    const result = await execute(executable, args, {
      cwd: root,
      env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
      timeout: 5 * 60 * 1000,
      maxBuffer: 16 * 1024 * 1024,
    })
    const output = `${result.stdout}${result.stderr}`
    evidence.push({
      id: definition.id,
      command: exactCommand(definition),
      result: "pass",
      summary: definition.parser(output),
      outputDigest: rawDigest(output),
    })
  }
  return evidence
}

async function gitOutput(root, args) {
  return (await execute("git", args, { cwd: root, timeout: 30_000, maxBuffer: 1024 * 1024 })).stdout.trim()
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 2 && args[0] === "--verify") {
    const report = await verifyPhase0AcceptanceReportFile(resolve(repositoryRoot, args[1]))
    process.stdout.write(`${JSON.stringify({
      valid: true,
      kind: report.kind,
      phase: report.phase,
      reportingStatus: report.reportingStatus,
      phaseGate: report.phaseGate,
      validationGatesPassed: report.summary.validationGatesPassed,
      knownGaps: report.summary.knownGaps,
    }, null, 2)}\n`)
    return
  }
  if (args.length !== 2 || args[0] !== "--output") {
    throw new Error("Usage: node scripts/phase0_acceptance_report.mjs <--output|--verify> <repository-relative-report.json>")
  }
  const output = normalizeRelativePath(repositoryRoot, args[1], "phase report output")
  const initialStatus = await gitOutput(repositoryRoot, ["status", "--porcelain", "--untracked-files=no"])
  if (initialStatus) throw new Error("Phase report generation requires a clean tracked worktree")
  const sourceCommit = await gitOutput(repositoryRoot, ["rev-parse", "HEAD"])
  const testEvidence = await runValidationGates(repositoryRoot)
  const finalStatus = await gitOutput(repositoryRoot, ["status", "--porcelain", "--untracked-files=no"])
  if (finalStatus) throw new Error("Validation gates changed tracked files; refusing to publish a stale phase report")
  const report = await buildPhase0AcceptanceReport({
    recordedAt: new Date().toISOString().replace(/\.\d{3}Z$/u, "Z"),
    sourceCommit,
    testEvidence,
  })
  await writeFile(output.resolved, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 })
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
