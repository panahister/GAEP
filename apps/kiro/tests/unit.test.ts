import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile, mkdtemp, mkdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import type { InitiativeApplicabilityMatrixInput, InitiativeClassificationInput } from "@gaep/contracts"

import {
  accessibleTableCsv,
  buildAccessibleTableView,
  createAccessibleMetadataTable,
  renderAccessibleTableText,
} from "../src/accessible-table.js"
import { GaepEngineClient, safeEngineEnvironment } from "../src/engine-client.js"
import { canonicalDigest, GaepHostError } from "../src/protocol.js"

const productId = "11111111-1111-4111-8111-111111111111"
const initiativeId = "29292929-2929-4929-8929-292929292929"
const bundleId = "22222222-2222-4222-8222-222222222222"
const charterId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const workflowPlanId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
const managedRunId = "ffffffff-ffff-4fff-8fff-ffffffffffff"
const stagedManagedRunId = "16161616-1616-4616-8616-161616161616"
const privateRoot = "/Users/private/portable-design"
const privateCredential = "PRIVATE-OAUTH-TOKEN"
const fakeEngine = resolve(dirname(fileURLToPath(import.meta.url)), "../tests/fake-engine.mjs")

const initiativeClassification = {
  primaryType: "service",
  secondaryTypes: ["api", "modernization"],
  systemState: "brownfield",
  changePosture: "modernization",
  motivations: ["business-driven", "technical"],
  characteristics: {
    userInterface: "non-ui",
    data: "data-bearing",
    integration: "integration-heavy",
    interactionModes: ["synchronous", "asynchronous"],
    exposure: "partner",
  },
  regulated: true,
  policyDomains: ["payments", "privacy"],
  sensitivities: ["security", "privacy", "data"],
  expectedLifetime: "long-lived",
  maintenanceHorizon: "Supported for at least five years after initial release",
  risk: {
    blastRadius: "multi-unit",
    reversibility: "partially-reversible",
    urgency: "high",
    costOfFailure: "high",
  },
  dependencies: ["Existing identity service", "Partner API consumers"],
  affectedAssets: ["Payments API", "Settlement worker"],
  owner: "Payments engineering owner",
  accountableAuthority: "Payments Product Owner",
  confidence: { level: "medium", basis: "Repository evidence is current but partner scope awaits confirmation" },
  evidence: [{ kind: "evidence", reference: "GAEP-EVD-001" }],
  unresolvedQuestions: ["Whether the legacy batch endpoint remains in scope"],
  rationale: "The initiative changes a brownfield service and its independently deployed API consumers.",
} as const satisfies InitiativeClassificationInput

const initiativeApplicability = {
  subjectCatalog: {
    catalogVersion: "gaep-initiative-applicability-subjects-v1",
    digest: `sha256:${"f".repeat(64)}`,
    subjectCount: 49,
  },
  decisions: [{
    subject: { type: "test-method", key: "consumer-contract-testing", label: "Consumer contract testing" },
    status: "required",
    rationale: "Independently deployed partner consumers require version-bound compatibility evidence.",
    sources: [{ kind: "policy", reference: "GAEP-POL-CONTRACT-001" }],
    owner: "Payments quality owner",
    accountableApprover: "Payments Product Owner",
    dependencies: ["partner-api-contract"],
    conditions: [],
    reviewTriggers: ["API contract or consumer inventory changes"],
    approval: { state: "pending", conditions: [] },
    relatedRecords: [],
    relatedImplementationUnits: ["payments-api"],
  }],
  unresolvedSubjects: [],
} as const satisfies InitiativeApplicabilityMatrixInput

const accessibleTableFixture = createAccessibleMetadataTable({
  id: "verified-runs",
  title: "Verified Runs",
  columns: [
    { key: "name", label: "Name" },
    { key: "state", label: "State" },
  ],
  rows: [
    { id: "row-b", cells: { name: "Bravo", state: "pending" } },
    { id: "row-a", cells: { name: "Alpha", state: "pending" } },
    { id: "row-c", cells: { name: "=SUM(A1:A2)", state: "complete" } },
  ],
  total: 5,
  omitted: 2,
  snapshotDigest: `sha256:${"a".repeat(64)}`,
  sourceBoundary: "already-verified-bounded-metadata-only",
  authorityBoundary: "table-does-not-authorize-run-or-effects",
})

test("accessible metadata tables filter visible cells and sort deterministically with row-ID ties", () => {
  const sorted = buildAccessibleTableView(accessibleTableFixture, {
    sortKey: "state",
    sortDirection: "ascending",
  })
  assert.deepEqual(sorted.rows.map((row) => row.id), ["row-c", "row-a", "row-b"])

  const filtered = buildAccessibleTableView(accessibleTableFixture, {
    filter: "PENDING",
    sortKey: "name",
    sortDirection: "descending",
  })
  assert.deepEqual(filtered.rows.map((row) => row.id), ["row-b", "row-a"])
  assert.throws(() => buildAccessibleTableView(accessibleTableFixture, { filter: "x".repeat(257) }), RangeError)
  assert.throws(() => buildAccessibleTableView(accessibleTableFixture, { sortKey: "hidden", sortDirection: "ascending" }), TypeError)
})

test("accessible metadata CSV exports only filtered rows and neutralizes spreadsheet formula prefixes", () => {
  const view = buildAccessibleTableView(accessibleTableFixture, { filter: "SUM" })
  assert.equal(
    accessibleTableCsv(view),
    '"Name","State"\r\n"\'=SUM(A1:A2)","complete"',
  )
  assert.equal(accessibleTableCsv(view).includes("Bravo"), false)
  assert.equal(accessibleTableCsv(view).includes("omitted"), false)
  const rendered = renderAccessibleTableText(view)
  assert.match(rendered, /Showing 1 of 3 verified rows; 2 omitted upstream; source total 5\./u)
  assert.match(rendered, /Boundary: table-does-not-authorize-run-or-effects/u)
})

test("accessible metadata tables reject unreconciled totals and non-visible row fields", () => {
  assert.throws(() => createAccessibleMetadataTable({
    ...accessibleTableFixture,
    total: 4,
  }), RangeError)
  assert.throws(() => createAccessibleMetadataTable({
    ...accessibleTableFixture,
    rows: [{ id: "row-a", cells: { name: "Alpha", state: "pending", secret: "withheld" } }],
    total: 3,
    omitted: 2,
  }), TypeError)
})

test("sanitized engine environment handles Windows Path casing without copying provider state", () => {
  const sanitized = safeEngineEnvironment({
    Path: "/safe/bin",
    pathext: ".EXE;.CMD",
    AWS_SECRET_ACCESS_KEY: "private-aws-secret",
    OPENAI_API_KEY: "private-openai-key",
    HOME: "/private/home",
    ELECTRON_RUN_AS_NODE: "host-controlled",
  })
  assert.equal(sanitized.PATH, "/safe/bin")
  assert.equal(sanitized.PATHEXT, ".EXE;.CMD")
  assert.equal(sanitized.AWS_SECRET_ACCESS_KEY, undefined)
  assert.equal(sanitized.OPENAI_API_KEY, undefined)
  assert.equal(sanitized.HOME, undefined)
  assert.equal(sanitized.ELECTRON_RUN_AS_NODE, undefined)
  assert.equal(sanitized.GAEP_HOST_SURFACE, "kiro-portable-design")

  const packaged = safeEngineEnvironment({ ELECTRON_RUN_AS_NODE: "host-controlled" }, true)
  assert.equal(packaged.ELECTRON_RUN_AS_NODE, "1")
  assert.equal(packaged.GAEP_HOST_SURFACE, "kiro-portable-design")
})

test("package-local engine mode binds the exact module digest and launches through the host runtime", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-packaged-engine-"))
  const workspace = join(root, "workspace")
  await mkdir(workspace)
  const expectedSha256 = createHash("sha256").update(await readFile(fakeEngine)).digest("hex")
  const client = await GaepEngineClient.create({
    workspacePath: workspace,
    engineExecutable: process.execPath,
    packagedEngine: { path: fakeEngine, expectedSha256 },
    sourceEnvironment: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "host-controlled",
      OPENAI_API_KEY: "private-openai-key",
    },
  })
  try {
    const product = await client.readProduct()
    assert.deepEqual({ id: product.id, name: product.name, revision: product.revision }, {
      id: productId,
      name: "Example Product",
      revision: 7,
    })
    assert.match(product.digest, /^sha256:[0-9a-f]{64}$/u)
  } finally {
    await client.dispose()
    await rm(root, { recursive: true, force: true })
  }
})

test("package-local engine mode fails closed on a digest mismatch or extra launcher arguments", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-packaged-engine-hostile-"))
  const workspace = join(root, "workspace")
  await mkdir(workspace)
  const mismatched = await GaepEngineClient.create({
    workspacePath: workspace,
    engineExecutable: process.execPath,
    packagedEngine: { path: fakeEngine, expectedSha256: "0".repeat(64) },
  })
  try {
    await assert.rejects(
      () => mismatched.readProduct(),
      (error) => safeHostError(error, "HOST_UNAVAILABLE"),
    )
    await assert.rejects(
      () => GaepEngineClient.create({
        workspacePath: workspace,
        engineExecutable: process.execPath,
        packagedEngine: { path: fakeEngine, expectedSha256: "0".repeat(64) },
        engineArgumentsPrefix: ["caller-controlled"],
      }),
      TypeError,
    )
  } finally {
    await mismatched.dispose()
    await rm(root, { recursive: true, force: true })
  }
})

test("protocol-v2 Initiative entry client preserves exact request binding and rejects hostile responses", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-initiative-entry-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-initiative-private",
    "bad-entry-boundary",
    "bad-entry-policy",
    "bad-classification-binding",
    "bad-classification-content",
    "bad-applicability-binding",
    "bad-applicability-content",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))

  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const initial = await client.readInitiative(initiativeId)
    assert.equal(initial.revision, 1)
    assert.equal(initial.classification, undefined)
    assert.equal(initial.applicability, undefined)

    const initialAssessment = await client.assessInitiativeEntry(initiativeId)
    assert.equal(initialAssessment.initiativeRevision, 1)
    assert.equal(initialAssessment.classification.status, "missing")
    assert.equal(initialAssessment.classification.completeness?.status, "missing")
    assert.equal(initialAssessment.applicability.status, "missing")
    assert.equal(initialAssessment.applicability.coverage?.status, "unavailable")
    assert.equal(initialAssessment.state, "attention-required")

    const classified = await client.classifyInitiative(initiativeId, 1, initiativeClassification, "founder.kiro-review")
    assert.equal(classified.revision, 2)
    assert.equal(classified.classification?.primaryType, "service")
    assert.equal(classified.classification?.classifiedBy.id, "founder.kiro-review")
    const classifiedAssessment = await client.assessInitiativeEntry(initiativeId)
    assert.equal(classifiedAssessment.classification.status, "current")
    assert.equal(classifiedAssessment.classification.completeness?.status, "incomplete")
    assert.equal(classifiedAssessment.classification.completeness?.unresolvedQuestionCount, 1)
    assert.equal(classifiedAssessment.applicability.status, "missing")
    assert.equal(classifiedAssessment.applicability.coverage?.missingSubjectCount, 49)

    const resolved = await client.resolveInitiativeApplicability(
      initiativeId,
      2,
      initiativeApplicability,
      "founder.kiro-review",
    )
    assert.equal(resolved.revision, 3)
    assert.equal(resolved.applicability?.decisions.length, 1)
    assert.equal(resolved.applicability?.decisions[0]?.status, "required")
    const finalAssessment = await client.assessInitiativeEntry(initiativeId)
    assert.equal(finalAssessment.initiativeRevision, 3)
    assert.equal(finalAssessment.classification.status, "current")
    assert.equal(finalAssessment.applicability.status, "current")
    assert.equal(finalAssessment.applicability.decisionCount, 1)
    assert.equal(finalAssessment.applicability.unresolvedSubjectCount, 48)
    assert.equal(finalAssessment.applicability.pendingApprovalCount, 1)
    assert.equal(finalAssessment.applicability.coverage?.status, "complete")
    assert.equal(finalAssessment.applicability.coverage?.coveredSubjectCount, 49)
    assert.equal(finalAssessment.applicability.coverage?.missingSubjectCount, 0)
    assert.equal(finalAssessment.state, "attention-required")
    assert.equal(
      finalAssessment.authorityBoundary,
      "entry-assessment-is-read-only-and-does-not-grant-approval-readiness-or-action-authority",
    )
  } finally {
    await client.dispose()
  }

  for (const [index, workspacePath] of hostileRoots.entries()) {
    const hostile = await createClient(workspacePath!)
    try {
      if (index === 0) {
        await assert.rejects(() => hostile.readInitiative(initiativeId), (error) => safeHostError(error, "HOST_RESPONSE_INVALID"))
      } else if (index === 1 || index === 2) {
        await assert.rejects(() => hostile.assessInitiativeEntry(initiativeId), (error) => safeHostError(error, "HOST_RESPONSE_INVALID"))
      } else if (index === 3 || index === 4) {
        await assert.rejects(
          () => hostile.classifyInitiative(initiativeId, 1, initiativeClassification, "founder.kiro-review"),
          (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
        )
      } else {
        const classified = await hostile.classifyInitiative(
          initiativeId,
          1,
          initiativeClassification,
          "founder.kiro-review",
        )
        await assert.rejects(
          () => hostile.resolveInitiativeApplicability(
            initiativeId,
            classified.revision!,
            initiativeApplicability,
            "founder.kiro-review",
          ),
          (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
        )
      }
    } finally {
      await hostile.dispose()
    }
  }

  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Source governance projection is exact, bounded, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-source-governance-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-source-snapshot-binding",
    "bad-source-snapshot-digest",
    "bad-source-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readSourceGovernance(initiativeId)
    assert.equal(projection.assessment.state, "ready")
    assert.equal(projection.sources.length, 1)
    assert.equal(projection.sources[0]?.semanticAuthority.standing, "authoritative")
    assert.equal(projection.baselines[0]?.state, "candidate")
    assert.equal(projection.baselines[0]?.assessmentStatus, "current")
    assert.equal(projection.provenance[0]?.targetKind, "claim")
    assert.equal(
      projection.authorityBoundary,
      "source-governance-projection-does-not-designate-a-baseline-approve-readiness-transfer-authority-or-authorize-action",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes("sourceLocator"), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readSourceGovernance(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Business Understanding projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-business-understanding-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-business-snapshot-binding",
    "bad-business-snapshot-digest",
    "bad-business-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readBusinessUnderstanding(initiativeId)
    assert.equal(projection.assessment.state, "complete-for-review")
    assert.equal(projection.businessUnderstanding?.objectiveCount, 3)
    assert.equal(projection.stakeholderModel?.stakeholderCount, 8)
    assert.equal(projection.outcomeModel?.countermetricCount, 1)
    assert.equal(
      projection.authorityBoundary,
      "business-understanding-projection-does-not-approve-appoint-decide-designate-readiness-or-authorize-action",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes("personalAssignment"), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readBusinessUnderstanding(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Business Capability Map projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-business-capability-map-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-capability-snapshot-binding",
    "bad-capability-snapshot-digest",
    "bad-capability-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readBusinessCapabilityMap(initiativeId)
    assert.equal(projection.assessment.state, "attention-required")
    assert.equal(projection.capabilityMap?.capabilityCount, 7)
    assert.equal(projection.capabilityMap?.ownedCapabilityCount, 6)
    assert.equal(projection.capabilityMap?.criticalGapCount, 1)
    assert.equal(
      projection.authorityBoundary,
      "business-capability-map-projection-does-not-approve-prioritize-baseline-designate-readiness-or-authorize-action",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes("capabilityNarrative"), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readBusinessCapabilityMap(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Value Stream Model projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-value-stream-model-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-value-stream-snapshot-binding",
    "bad-value-stream-snapshot-digest",
    "bad-value-stream-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readValueStreamModel(initiativeId)
    assert.equal(projection.assessment.state, "attention-required")
    assert.equal(projection.valueStreamModel?.valueStreamCount, 3)
    assert.equal(projection.valueStreamModel?.ownedValueStreamCount, 2)
    assert.equal(projection.valueStreamModel?.criticalBottleneckCount, 1)
    assert.equal(
      projection.authorityBoundary,
      "value-stream-model-projection-does-not-approve-baseline-priority-readiness-or-authorize-action",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes("valueStreamNarrative"), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readValueStreamModel(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Operating Model projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-operating-model-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-operating-model-snapshot-binding",
    "bad-operating-model-snapshot-digest",
    "bad-operating-model-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readOperatingModel(initiativeId)
    assert.equal(projection.assessment.state, "attention-required")
    assert.equal(projection.operatingModel?.roleCount, 6)
    assert.equal(projection.operatingModel?.decisionRightCount, 8)
    assert.equal(projection.assessment.unfundedCapacityCount, 3)
    assert.equal(
      projection.authorityBoundary,
      "operating-model-projection-does-not-appoint-fund-approve-baseline-readiness-or-authorize-action",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes("operatingNarrative"), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readOperatingModel(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Business Rule Catalog projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-business-rules-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-business-rule-snapshot-binding",
    "bad-business-rule-snapshot-digest",
    "bad-business-rule-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readBusinessRuleCatalog(initiativeId)
    assert.equal(projection.assessment.state, "attention-required")
    assert.equal(projection.businessRuleCatalog?.ruleCount, 7)
    assert.equal(projection.businessRuleCatalog?.exceptionCount, 2)
    assert.equal(projection.assessment.unverifiedEnforcementTargetCount, 2)
    assert.equal(
      projection.authorityBoundary,
      "business-rule-catalog-projection-does-not-evaluate-policy-grant-exceptions-deploy-enforcement-approve-baseline-readiness-or-authorize-action",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes("ruleNarrative"), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readBusinessRuleCatalog(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Business Architecture Baseline projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-business-architecture-baseline-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-business-architecture-baseline-snapshot-binding",
    "bad-business-architecture-baseline-snapshot-digest",
    "bad-business-architecture-baseline-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readBusinessArchitectureBaseline(initiativeId)
    assert.equal(projection.assessment.state, "attention-required")
    assert.equal(projection.baseline?.coveredElementCount, 27)
    assert.equal(projection.baseline?.integrationClaimCount, 8)
    assert.equal(projection.assessment.consistencyGapCount, 2)
    assert.equal(
      projection.authorityBoundary,
      "business-architecture-baseline-projection-does-not-designate-or-approve-a-baseline-establish-readiness-grant-exceptions-deploy-enforcement-or-authorize-action",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes("architectureNarrative"), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readBusinessArchitectureBaseline(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 System/Solution Architecture projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-system-solution-architecture-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-system-solution-architecture-snapshot-binding",
    "bad-system-solution-architecture-snapshot-digest",
    "bad-system-solution-architecture-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readSystemSolutionArchitecture(initiativeId)
    assert.equal(projection.assessment.state, "attention-required")
    assert.equal(projection.architecture?.elementCount, 9)
    assert.equal(projection.architecture?.qualityAttributeCount, 5)
    assert.equal(projection.assessment.unresolvedDecisionCount, 2)
    assert.equal(
      projection.authorityBoundary,
      "system-solution-architecture-projection-does-not-approve-or-designate-an-architecture-baseline-establish-readiness-prove-conformance-mandate-technology-or-authorize-action",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes("architectureNarrative"), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readSystemSolutionArchitecture(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Bounded Context projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-bounded-context-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-bounded-context-snapshot-binding",
    "bad-bounded-context-snapshot-digest",
    "bad-bounded-context-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readBoundedContextModel(initiativeId)
    assert.equal(projection.assessment.state, "attention-required")
    assert.equal(projection.model?.boundedContextCount, 3)
    assert.equal(projection.model?.contractCount, 4)
    assert.equal(projection.assessment.unmappedCrossContextRelationCount, 2)
    assert.equal(
      projection.authorityBoundary,
      "bounded-context-model-projection-does-not-appoint-owners-approve-boundaries-accept-contracts-establish-readiness-or-authorize-action",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes("ubiquitousLanguage"), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readBoundedContextModel(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Security, Privacy, and Threat projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-security-privacy-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-security-privacy-snapshot-binding",
    "bad-security-privacy-snapshot-digest",
    "bad-security-privacy-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readSecurityPrivacyAssessment(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.assessment?.assetCount, 4)
    assert.equal(projection.assessment?.controlCount, 6)
    assert.equal(projection.status.unresolvedRequirementCount, 3)
    assert.equal(
      projection.authorityBoundary,
      "security-privacy-threat-projection-does-not-approve-a-threat-model-attest-control-effectiveness-accept-risk-approve-processing-establish-security-readiness-or-authorize-action",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes("threatScenario"), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readSecurityPrivacyAssessment(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Process Model projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-process-model-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-process-model-snapshot-binding",
    "bad-process-model-snapshot-digest",
    "bad-process-model-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readProcessModel(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.model?.processCount, 3)
    assert.equal(projection.model?.transitionCount, 11)
    assert.equal(projection.status.unresolvedRequirementCount, 4)
    assert.equal(
      projection.authorityBoundary,
      "process-model-projection-does-not-approve-workflows-grant-transition-or-execution-authority-establish-operational-readiness-or-authorize-action",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes("transitionGuard"), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readProcessModel(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Data Model projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-data-model-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-data-model-snapshot-binding",
    "bad-data-model-snapshot-digest",
    "bad-data-model-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readDataModel(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.model?.entityCount, 6)
    assert.equal(projection.model?.relationshipCount, 8)
    assert.equal(projection.status.unresolvedRequirementCount, 4)
    assert.equal(
      projection.authorityBoundary,
      "data-model-projection-does-not-approve-a-data-model-or-classification-appoint-ownership-grant-migration-authority-establish-operational-readiness-or-authorize-action",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes("entityAttribute"), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readDataModel(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Authorization Model projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-authorization-model-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-authorization-model-snapshot-binding",
    "bad-authorization-model-snapshot-digest",
    "bad-authorization-model-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readAuthorizationModel(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.model?.principalCount, 5)
    assert.equal(projection.model?.ruleCount, 9)
    assert.equal(projection.status.unresolvedRequirementCount, 6)
    assert.equal(
      projection.authorityBoundary,
      "authorization-model-projection-does-not-verify-identity-approve-role-assignments-or-standing-authority-create-an-authorization-grant-enforce-policy-establish-operational-readiness-or-authorize-action",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes("principalIdentifier"), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readAuthorizationModel(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Event and Integration Model projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-event-integration-model-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-event-integration-model-snapshot-binding",
    "bad-event-integration-model-snapshot-digest",
    "bad-event-integration-model-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readEventIntegrationModel(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.model?.eventTypeCount, 10)
    assert.equal(projection.model?.routeCount, 7)
    assert.equal(projection.status.unresolvedRequirementCount, 7)
    assert.equal(
      projection.authorityBoundary,
      "event-integration-model-projection-does-not-prove-event-occurrence-send-or-deliver-a-command-accept-an-external-contract-activate-an-adapter-create-an-authorization-grant-execute-an-effect-establish-operational-readiness-or-authorize-action",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes("eventPayload"), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readEventIntegrationModel(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Failure and Recovery Model projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-failure-recovery-model-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-failure-recovery-model-snapshot-binding",
    "bad-failure-recovery-model-snapshot-digest",
    "bad-failure-recovery-model-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readFailureRecoveryModel(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.model?.failureModeCount, 8)
    assert.equal(projection.model?.recoveryPlanCount, 4)
    assert.equal(projection.status.unresolvedRequirementCount, 6)
    assert.equal(
      projection.authorityBoundary,
      "failure-recovery-model-projection-does-not-prove-failure-occurrence-retry-safety-compensation-or-restoration-recovery-success-return-to-service-operational-readiness-or-authorize-action",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"recoveryEvidence":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readFailureRecoveryModel(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Architecture Challenge projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-architecture-challenge-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-architecture-challenge-snapshot-binding",
    "bad-architecture-challenge-snapshot-digest",
    "bad-architecture-challenge-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readArchitectureChallengeModel(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.model?.challengeSubjectCount, 3)
    assert.equal(projection.model?.findingCount, 6)
    assert.equal(projection.status.unrespondedFindingCount, 4)
    assert.equal(
      projection.authorityBoundary,
      "architecture-challenge-projection-does-not-establish-independence-assurance-risk-acceptance-architecture-approval-operational-readiness-or-authorize-action",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"challengeEvidence":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readArchitectureChallengeModel(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Decision Register projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-decision-register-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-decision-register-snapshot-binding",
    "bad-decision-register-snapshot-digest",
    "bad-decision-register-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readDecisionRegister(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.register?.decisionCount, 7)
    assert.equal(projection.status.unresolvedDecisionCount, 2)
    assert.equal(projection.status.selectedPendingDecisionCount, 3)
    assert.equal(
      projection.authorityBoundary,
      "decision-register-projection-does-not-establish-decision-effectiveness-approval-risk-acceptance-baseline-promotion-readiness-or-action-authority",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"decisionQuestion":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readDecisionRegister(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Risk Register projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-risk-register-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-risk-register-snapshot-binding",
    "bad-risk-register-snapshot-digest",
    "bad-risk-register-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readRiskRegister(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.register?.riskCount, 9)
    assert.equal(projection.status.notAssessedRiskCount, 2)
    assert.equal(projection.status.unresolvedResidualRiskCount, 3)
    assert.equal(projection.status.unverifiedControlCount, 4)
    assert.equal(
      projection.authorityBoundary,
      "risk-register-projection-does-not-establish-assessment-fact-control-effectiveness-risk-acceptance-approval-exception-baseline-promotion-readiness-or-action-authority",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"riskStatement":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readRiskRegister(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Evidence Registry projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-evidence-registry-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-evidence-registry-snapshot-binding",
    "bad-evidence-registry-snapshot-digest",
    "bad-evidence-registry-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readEvidenceRegistry(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.registry?.claimCount, 12)
    assert.equal(projection.registry?.evidenceItemCount, 18)
    assert.equal(projection.registry?.linkCount, 21)
    assert.equal(projection.status.staleOrUnknownEvidenceCount, 4)
    assert.equal(
      projection.authorityBoundary,
      "evidence-registry-projection-does-not-establish-claim-validation-evidence-sufficiency-assurance-review-approval-risk-acceptance-readiness-or-action-authority",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"claimStatement":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readEvidenceRegistry(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 End-to-End Traceability projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-traceability-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-traceability-snapshot-binding",
    "bad-traceability-snapshot-digest",
    "bad-traceability-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readEndToEndTraceability(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.traceability?.nodeCount, 44)
    assert.equal(projection.traceability?.relationshipCount, 12)
    assert.equal(projection.traceability?.linkCount, 67)
    assert.equal(projection.traceability?.transformationCount, 5)
    assert.equal(projection.status.missingSpineCount, 1)
    assert.equal(
      projection.status.coverageBoundary,
      "absence-of-a-trace-link-does-not-prove-absence-of-impact-or-relationship",
    )
    assert.equal(
      projection.authorityBoundary,
      "end-to-end-traceability-projection-does-not-establish-relationship-truth-completeness-approval-baseline-promotion-readiness-or-action-authority",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"linkRationale":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readEndToEndTraceability(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 P0-P4 Readiness Gate projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-readiness-gate-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-readiness-gate-snapshot-binding",
    "bad-readiness-gate-snapshot-digest",
    "bad-readiness-gate-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readP0P4ReadinessGate(initiativeId)
    assert.equal(projection.status.result, "failed")
    assert.equal(projection.gate?.outputCount, 25)
    assert.equal(projection.status.satisfiedOutputCount, 17)
    assert.equal(projection.status.unresolvedDecisionCount, 2)
    assert.equal(projection.status.gateBoundary, "a-passing-gate-is-an-evaluation-result-not-permission")
    assert.equal(
      projection.authorityBoundary,
      "p0-p4-readiness-gate-projection-does-not-establish-readiness-approval-waiver-acceptance-phase-entry-implementation-authorization-baseline-promotion-or-action-authority",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"waiverRationale":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readP0P4ReadinessGate(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 P5 Handoff Package projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-p5-handoff-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-p5-handoff-snapshot-binding",
    "bad-p5-handoff-snapshot-digest",
    "bad-p5-handoff-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readP5HandoffPackage(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.readinessResult, "incomplete")
    assert.equal(projection.status.transferState, "held")
    assert.equal(projection.handoff?.itemCount, 25)
    assert.equal(projection.handoff?.requirementCount, 66)
    assert.equal(projection.handoff?.deliveryMode, "disconnected")
    assert.equal(
      projection.authorityBoundary,
      "p5-handoff-package-projection-does-not-establish-acknowledgement-readiness-approval-design-baseline-p5-entry-transfer-write-or-action-authority",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"itemContent":'), false)
    assert.equal(serialized.includes('"acknowledged":'), false)
    assert.equal(serialized.includes('"approved":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readP5HandoffPackage(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Design Applicability projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-design-applicability-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-design-applicability-snapshot-binding",
    "bad-design-applicability-snapshot-digest",
    "bad-design-applicability-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readDesignApplicability(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.scopeCount, 2)
    assert.equal(projection.status.decisionCount, 8)
    assert.equal(projection.candidate?.scopeCount, 2)
    assert.equal(
      projection.authorityBoundary,
      "design-applicability-projection-is-read-only-and-does-not-approve-design-establish-a-baseline-grant-readiness-or-authorize-write-implementation-or-action",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"rationale":'), false)
    assert.equal(serialized.includes('"journeys":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readDesignApplicability(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Design Personas and Roles projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-design-persona-role-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-design-persona-role-snapshot-binding",
    "bad-design-persona-role-snapshot-digest",
    "bad-design-persona-role-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readDesignPersonaRoleModel(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.personaCount, 2)
    assert.equal(projection.status.designRoleCount, 1)
    assert.equal(projection.candidate?.personaCount, 2)
    assert.equal(
      projection.authorityBoundary,
      "design-persona-role-projection-is-read-only-and-does-not-validate-personas-appoint-roles-verify-competence-approve-design-grant-readiness-or-authorize-write-or-action",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"personaBehavior":'), false)
    assert.equal(serialized.includes('"constraints":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readDesignPersonaRoleModel(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 User Journey projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-user-journey-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-user-journey-snapshot-binding",
    "bad-user-journey-snapshot-digest",
    "bad-user-journey-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readUserJourneyModel(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.journeyCount, 2)
    assert.equal(projection.status.touchpointCount, 3)
    assert.equal(projection.status.failurePathCount, 2)
    assert.equal(projection.status.recoveryPathCount, 2)
    assert.equal(projection.candidate?.journeyCount, 2)
    assert.equal(
      projection.authorityBoundary,
      "user-journey-model-projection-is-read-only-and-does-not-prove-observed-behavior-validate-journeys-approve-design-grant-readiness-or-authorize-write-or-action",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"journeyStep":'), false)
    assert.equal(serialized.includes('"touchpoints":'), false)
    assert.equal(serialized.includes('"personas":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readUserJourneyModel(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Information Architecture projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-information-architecture-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-information-architecture-snapshot-binding",
    "bad-information-architecture-snapshot-digest",
    "bad-information-architecture-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readInformationArchitectureModel(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.nodeCount, 6)
    assert.equal(projection.status.rootNodeCount, 2)
    assert.equal(projection.status.routeCount, 8)
    assert.equal(projection.candidate?.nodeCount, 6)
    assert.equal(
      projection.authorityBoundary,
      "information-architecture-projection-is-read-only-and-does-not-prove-findability-comprehension-or-accessibility-validate-content-approve-design-grant-readiness-or-authorize-write-or-action",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"nodeLabel":'), false)
    assert.equal(serialized.includes('"contentNodes":'), false)
    assert.equal(serialized.includes('"navigationRoutes":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readInformationArchitectureModel(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Screen and State Inventory projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-screen-state-inventory-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-screen-state-inventory-snapshot-binding",
    "bad-screen-state-inventory-snapshot-digest",
    "bad-screen-state-inventory-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readScreenStateInventory(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.platformCount, 3)
    assert.equal(projection.status.screenCount, 8)
    assert.equal(projection.status.stateCount, 24)
    assert.equal(projection.status.variantCount, 6)
    assert.equal(projection.candidate?.screenCount, 8)
    assert.equal(
      projection.authorityBoundary,
      "screen-state-inventory-projection-is-read-only-and-does-not-prove-ui-completeness-platform-parity-state-reachability-interaction-quality-or-accessibility-approve-design-grant-readiness-or-authorize-write-or-action",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"screenLabel":'), false)
    assert.equal(serialized.includes('"screens":'), false)
    assert.equal(serialized.includes('"states":'), false)
    assert.equal(serialized.includes('"variants":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readScreenStateInventory(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Design Requirements projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-design-requirements-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-design-requirements-snapshot-binding",
    "bad-design-requirements-snapshot-digest",
    "bad-design-requirements-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readDesignRequirements(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.requirementCount, 12)
    assert.equal(projection.status.mustPriorityCount, 5)
    assert.equal(projection.status.representedOutcomeCount, 4)
    assert.equal(projection.status.workItemCount, 10)
    assert.equal(projection.candidate?.requirementCount, 12)
    assert.equal(
      projection.authorityBoundary,
      "design-requirements-projection-is-read-only-and-does-not-establish-requirement-validity-completeness-priority-approval-satisfaction-backlog-commitment-design-approval-readiness-implementation-or-write-or-action-authority",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"requirementStatement":'), false)
    assert.equal(serialized.includes('"requirements":'), false)
    assert.equal(serialized.includes('"outcomes":'), false)
    assert.equal(serialized.includes('"workItems":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readDesignRequirements(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Backlog Hierarchy projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-backlog-hierarchy-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-backlog-hierarchy-snapshot-binding",
    "bad-backlog-hierarchy-snapshot-digest",
    "bad-backlog-hierarchy-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readBacklogHierarchy(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.nodeCount, 24)
    assert.equal(projection.status.epicCount, 2)
    assert.equal(projection.status.featureCount, 5)
    assert.equal(projection.status.storyCount, 8)
    assert.equal(projection.status.taskCount, 9)
    assert.equal(projection.status.requirementTraceCount, 17)
    assert.equal(projection.candidate?.nodeCount, 24)
    assert.equal(
      projection.authorityBoundary,
      "backlog-hierarchy-projection-is-read-only-and-does-not-prioritize-commit-assign-admit-execute-or-authorize-implementation-or-action",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"workItemObjective":'), false)
    assert.equal(serialized.includes('"nodes":'), false)
    assert.equal(serialized.includes('"requirements":'), false)
    assert.equal(serialized.includes('"owner":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readBacklogHierarchy(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 MVP and Vertical Slice projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-mvp-slice-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-mvp-slice-snapshot-binding",
    "bad-mvp-slice-snapshot-digest",
    "bad-mvp-slice-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readMvpSliceDefinition(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.scopeNodeCount, 24)
    assert.equal(projection.status.mvpNodeCount, 16)
    assert.equal(projection.status.laterNodeCount, 5)
    assert.equal(projection.status.excludedNodeCount, 3)
    assert.equal(projection.status.sliceCount, 4)
    assert.equal(projection.status.storyCount, 7)
    assert.equal(projection.status.taskCount, 9)
    assert.equal(projection.candidate?.hierarchyDigest, projection.status.hierarchy?.digest)
    assert.equal(
      projection.authorityBoundary,
      "mvp-slice-definition-projection-is-read-only-and-does-not-prioritize-commit-approve-scope-admit-assign-execute-or-authorize-implementation-or-action",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"sliceRationale":'), false)
    assert.equal(serialized.includes('"scopeEntries":'), false)
    assert.equal(serialized.includes('"slices":'), false)
    assert.equal(serialized.includes('"requirements":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readMvpSliceDefinition(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Prioritization Model projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-prioritization-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-prioritization-snapshot-binding",
    "bad-prioritization-snapshot-digest",
    "bad-prioritization-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readPrioritizationModel(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.subjectCount, 4)
    assert.equal(projection.status.scoredSubjectCount, 3)
    assert.equal(projection.status.unassessedSubjectCount, 1)
    assert.equal(projection.status.evidenceReferenceCount, 12)
    assert.equal(projection.status.tieCount, 1)
    assert.equal(
      projection.authorityBoundary,
      "prioritization-model-projection-is-read-only-and-does-not-establish-evidence-validity-priority-commitment-scope-decision-approval-ready-done-implementation-readiness-assignment-execution-or-action-authority",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"dimensionEstimate":'), false)
    assert.equal(serialized.includes('"subjects":'), false)
    assert.equal(serialized.includes('"evidence":'), false)
    assert.equal(serialized.includes('"uncertainty":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readPrioritizationModel(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Acceptance Criteria projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-acceptance-criteria-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-acceptance-criteria-snapshot-binding",
    "bad-acceptance-criteria-snapshot-digest",
    "bad-acceptance-criteria-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readAcceptanceCriteria(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.subjectCount, 4)
    assert.equal(projection.status.coveredSubjectCount, 3)
    assert.equal(projection.status.uncoveredSubjectCount, 1)
    assert.equal(projection.status.criterionCount, 6)
    assert.equal(projection.status.testableCriterionCount, 5)
    assert.equal(projection.status.unassessedCriterionCount, 1)
    assert.equal(projection.status.requirementTraceCount, 8)
    assert.equal(projection.status.uncoveredRequirementCount, 2)
    assert.equal(projection.status.verificationMethodCount, 2)
    assert.equal(
      projection.authorityBoundary,
      "acceptance-criteria-projection-is-read-only-and-does-not-establish-criterion-validity-completeness-requirement-satisfaction-priority-commitment-approval-ready-done-implementation-readiness-assignment-execution-acceptance-or-action-authority",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"criterionText":'), false)
    assert.equal(serialized.includes('"requirements":'), false)
    assert.equal(serialized.includes('"verificationMethods":'), false)
    assert.equal(serialized.includes('"evidenceReferences":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readAcceptanceCriteria(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Definition of Ready projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-definition-of-ready-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-definition-of-ready-snapshot-binding",
    "bad-definition-of-ready-snapshot-digest",
    "bad-definition-of-ready-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readDefinitionOfReady(initiativeId)
    assert.equal(projection.status.result, "attention-required")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.subjectCount, 4)
    assert.equal(projection.status.policyEntryCount, 5)
    assert.equal(projection.status.expectedEvaluationCount, 20)
    assert.equal(projection.status.evaluationCount, 18)
    assert.equal(projection.status.candidateSatisfiedCount, 12)
    assert.equal(projection.status.notApplicableCount, 3)
    assert.equal(projection.status.missingEvaluationCount, 2)
    assert.equal(
      projection.gateBoundary,
      "a-passing-definition-of-ready-candidate-is-an-evaluation-result-not-admission-readiness-assignment-execution-or-implementation-permission",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"rationale":'), false)
    assert.equal(serialized.includes('"policyEntries":'), false)
    assert.equal(serialized.includes('"itemEvaluations":'), false)
    assert.equal(serialized.includes('"evidenceReferences":'), false)
    assert.equal(serialized.includes('"assessedBy":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readDefinitionOfReady(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Definition of Done projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-definition-of-done-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-definition-of-done-snapshot-binding",
    "bad-definition-of-done-snapshot-digest",
    "bad-definition-of-done-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readDefinitionOfDone(initiativeId)
    assert.equal(projection.status.result, "attention-required")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.subjectCount, 4)
    assert.equal(projection.status.policyEntryCount, 6)
    assert.equal(projection.status.expectedEvaluationCount, 24)
    assert.equal(projection.status.evaluationCount, 21)
    assert.equal(projection.status.candidateSatisfiedCount, 14)
    assert.equal(projection.status.notApplicableCount, 3)
    assert.equal(projection.status.missingEvaluationCount, 3)
    assert.equal(projection.status.staleDefinitionOfReadyCount, 0)
    assert.equal(
      projection.gateBoundary,
      "a-passing-definition-of-done-candidate-is-an-evaluation-result-not-completion-acceptance-approval-merge-release-deployment-or-action-permission",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"rationale":'), false)
    assert.equal(serialized.includes('"policyEntries":'), false)
    assert.equal(serialized.includes('"itemEvaluations":'), false)
    assert.equal(serialized.includes('"evidenceReferences":'), false)
    assert.equal(serialized.includes('"assessedBy":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readDefinitionOfDone(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Implementation Unit Model projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-implementation-unit-model-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-implementation-unit-model-snapshot-binding",
    "bad-implementation-unit-model-snapshot-digest",
    "bad-implementation-unit-model-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readImplementationUnitModel(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.unitCount, 3)
    assert.equal(projection.status.subjectCount, 4)
    assert.equal(projection.status.requirementReferenceCount, 5)
    assert.equal(projection.status.repositoryCandidateCount, 3)
    assert.equal(projection.status.ownerCandidateCount, 3)
    assert.equal(projection.status.dependencyEdgeCount, 2)
    assert.equal(projection.status.candidateAssessedBlastRadiusCount, 2)
    assert.equal(projection.status.notAssessedBlastRadiusCount, 1)
    assert.equal(projection.status.staleDefinitionOfDoneCount, 0)
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"rationale":'), false)
    assert.equal(serialized.includes('"modulePath":'), false)
    assert.equal(serialized.includes('"ownerCandidate":'), false)
    assert.equal(serialized.includes('"subjectNodeIds":'), false)
    assert.equal(serialized.includes('"requirementReferences":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readImplementationUnitModel(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Dependency Mapping projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-dependency-mapping-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-dependency-mapping-snapshot-binding",
    "bad-dependency-mapping-snapshot-digest",
    "bad-dependency-mapping-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readDependencyMapping(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.nodeCount, 3)
    assert.equal(projection.status.edgeCount, 2)
    assert.equal(projection.status.requiredEdgeCount, 1)
    assert.equal(projection.status.conditionalEdgeCount, 1)
    assert.equal(projection.status.criticalPathUnitCount, 2)
    assert.equal(projection.status.criticalPathCandidateEffortPoints, 13)
    assert.equal(projection.status.staleImplementationUnitModelCount, 0)
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"rationale":'), false)
    assert.equal(serialized.includes('"candidateEffortPoints":'), false)
    assert.equal(serialized.includes('"owner":'), false)
    assert.equal(serialized.includes('"modulePath":'), false)
    assert.equal(serialized.includes('"edges":'), false)
    assert.equal(serialized.includes('"nodes":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readDependencyMapping(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Technology Profile projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-technology-profile-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-technology-profile-snapshot-binding",
    "bad-technology-profile-snapshot-digest",
    "bad-technology-profile-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readTechnologyProfile(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.unitProfileCount, 3)
    assert.equal(projection.status.technologyChoiceCount, 5)
    assert.equal(projection.status.exactVersionCandidateCount, 3)
    assert.equal(projection.status.rangeVersionCandidateCount, 1)
    assert.equal(projection.status.unresolvedVersionCount, 1)
    assert.equal(projection.status.constraintCount, 4)
    assert.equal(projection.status.compatibilityConflictCount, 1)
    assert.equal(projection.status.staleDependencyMappingCount, 0)
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"canonicalName":'), false)
    assert.equal(serialized.includes('"versionConstraint":'), false)
    assert.equal(serialized.includes('"rationale":'), false)
    assert.equal(serialized.includes('"constraints":'), false)
    assert.equal(serialized.includes('"evidenceReferences":'), false)
    assert.equal(serialized.includes('"profiles":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readTechnologyProfile(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Boilerplate Registry projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-boilerplate-registry-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-boilerplate-registry-snapshot-binding",
    "bad-boilerplate-registry-snapshot-digest",
    "bad-boilerplate-registry-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readBoilerplateRegistry(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.entryCount, 4)
    assert.equal(projection.status.exactVersionCandidateCount, 2)
    assert.equal(projection.status.rangeVersionCandidateCount, 1)
    assert.equal(projection.status.unresolvedVersionCount, 1)
    assert.equal(projection.status.mandatoryCandidateCount, 2)
    assert.equal(projection.status.integrityMismatchCount, 1)
    assert.equal(projection.status.technologyConflictCount, 1)
    assert.equal(projection.status.staleTechnologyProfileCount, 0)
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"canonicalName":'), false)
    assert.equal(serialized.includes('"sourceReference":'), false)
    assert.equal(serialized.includes('"versionCandidate":'), false)
    assert.equal(serialized.includes('"rationale":'), false)
    assert.equal(serialized.includes('"capabilities":'), false)
    assert.equal(serialized.includes('"evidenceReferences":'), false)
    assert.equal(serialized.includes('"entries":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readBoilerplateRegistry(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Boilerplate Selection and Binding projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-boilerplate-selection-binding-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-boilerplate-selection-binding-snapshot-binding",
    "bad-boilerplate-selection-binding-snapshot-digest",
    "bad-boilerplate-selection-binding-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readBoilerplateSelectionBinding(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.decisionCount, 4)
    assert.equal(projection.status.selectedCandidateCount, 2)
    assert.equal(projection.status.notApplicableCandidateCount, 1)
    assert.equal(projection.status.deferredCandidateCount, 1)
    assert.equal(projection.status.missingUnitDecisionCount, 1)
    assert.equal(projection.status.invalidSelectionCount, 1)
    assert.equal(projection.status.staleBoilerplateRegistryCount, 0)
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"boilerplateRegistryEntryId":'), false)
    assert.equal(serialized.includes('"boilerplateVersionCandidate":'), false)
    assert.equal(serialized.includes('"implementationUnitId":'), false)
    assert.equal(serialized.includes('"technologyProfileId":'), false)
    assert.equal(serialized.includes('"rationale":'), false)
    assert.equal(serialized.includes('"conditions":'), false)
    assert.equal(serialized.includes('"evidenceReferences":'), false)
    assert.equal(serialized.includes('"decisions":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readBoilerplateSelectionBinding(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Boilerplate Compatibility Validation projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-boilerplate-compatibility-validation-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-boilerplate-compatibility-validation-snapshot-binding",
    "bad-boilerplate-compatibility-validation-snapshot-digest",
    "bad-boilerplate-compatibility-validation-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readBoilerplateCompatibilityValidation(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.selectedBindingCount, 2)
    assert.equal(projection.status.subjectCount, 2)
    assert.equal(projection.status.compatibleCandidateCount, 1)
    assert.equal(projection.status.exceptionCandidateCount, 1)
    assert.equal(projection.status.dimensionAssessmentCount, 28)
    assert.equal(projection.status.invalidSubjectCount, 1)
    assert.equal(projection.status.selectionBindingGapCount, 1)
    assert.equal(projection.status.staleSelectionBindingCount, 0)
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"bindingDecisionId":'), false)
    assert.equal(serialized.includes('"boilerplateRegistryEntryId":'), false)
    assert.equal(serialized.includes('"boilerplateVersionCandidate":'), false)
    assert.equal(serialized.includes('"implementationUnitId":'), false)
    assert.equal(serialized.includes('"technologyProfileId":'), false)
    assert.equal(serialized.includes('"claim":'), false)
    assert.equal(serialized.includes('"evidenceReferences":'), false)
    assert.equal(serialized.includes('"assessedBy":'), false)
    assert.equal(serialized.includes('"subjects":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readBoilerplateCompatibilityValidation(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Figma-to-Boilerplate Mapping projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-figma-to-boilerplate-mapping-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-figma-to-boilerplate-mapping-snapshot-binding",
    "bad-figma-to-boilerplate-mapping-snapshot-digest",
    "bad-figma-to-boilerplate-mapping-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath, engineExecutable: process.execPath, engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readFigmaToBoilerplateMapping(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.designBindingCount, 2)
    assert.equal(projection.status.subjectCount, 2)
    assert.equal(projection.status.mappedCandidateCount, 1)
    assert.equal(projection.status.conflictCandidateCount, 1)
    assert.equal(projection.status.componentMappingCount, 1)
    assert.equal(projection.status.tokenMappingCount, 1)
    assert.equal(projection.status.invalidSubjectCount, 1)
    assert.equal(projection.status.targetGapCount, 1)
    assert.equal(projection.status.traceGapCount, 1)
    assert.equal(projection.status.staleDependencyCount, 0)
    assert.equal(projection.candidate?.mappingSubjectCatalogDigest, `sha256:${"5".repeat(64)}`)
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"designItemKey":'), false)
    assert.equal(serialized.includes('"bindingDecisionId":'), false)
    assert.equal(serialized.includes('"implementationUnitId":'), false)
    assert.equal(serialized.includes('"technologyProfileId":'), false)
    assert.equal(serialized.includes('"boilerplateRegistryEntryId":'), false)
    assert.equal(serialized.includes('"targetCandidate":'), false)
    assert.equal(serialized.includes('"requirementKeys":'), false)
    assert.equal(serialized.includes('"mappedBy":'), false)
    assert.equal(serialized.includes('"subjects":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readFigmaToBoilerplateMapping(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Design-to-Code Binding Registry projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-design-to-code-binding-registry-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-design-to-code-binding-registry-snapshot-binding",
    "bad-design-to-code-binding-registry-snapshot-digest",
    "bad-design-to-code-binding-registry-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath, engineExecutable: process.execPath, engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readDesignToCodeBindingRegistry(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.mappingSubjectCount, 2)
    assert.equal(projection.status.subjectCount, 2)
    assert.equal(projection.status.boundCandidateCount, 1)
    assert.equal(projection.status.conflictCandidateCount, 1)
    assert.equal(projection.status.invalidSubjectCount, 1)
    assert.equal(projection.status.targetGapCount, 1)
    assert.equal(projection.status.traceGapCount, 1)
    assert.equal(projection.status.duplicateTargetCount, 1)
    assert.equal(projection.status.staleDependencyCount, 0)
    assert.equal(projection.candidate?.bindingSubjectCatalogDigest, `sha256:${"d".repeat(64)}`)
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"designItemKey":'), false)
    assert.equal(serialized.includes('"mappingSubjectKey":'), false)
    assert.equal(serialized.includes('"implementationUnitId":'), false)
    assert.equal(serialized.includes('"repositoryCandidate":'), false)
    assert.equal(serialized.includes('"moduleCandidate":'), false)
    assert.equal(serialized.includes('"pathCandidates":'), false)
    assert.equal(serialized.includes('"symbolCandidates":'), false)
    assert.equal(serialized.includes('"requirementKeys":'), false)
    assert.equal(serialized.includes('"evidenceReferences":'), false)
    assert.equal(serialized.includes('"boundBy":'), false)
    assert.equal(serialized.includes('"subjects":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readDesignToCodeBindingRegistry(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Route, Screen, and Component Mapping projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-route-screen-component-mapping-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-route-screen-component-mapping-snapshot-binding",
    "bad-route-screen-component-mapping-snapshot-digest",
    "bad-route-screen-component-mapping-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath, engineExecutable: process.execPath, engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readRouteScreenComponentMapping(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.sourceRouteCount, 2)
    assert.equal(projection.status.sourceScreenCount, 3)
    assert.equal(projection.status.sourceStateCount, 5)
    assert.equal(projection.status.sourceComponentCount, 4)
    assert.equal(projection.status.subjectCount, 14)
    assert.equal(projection.status.mappedCandidateCount, 12)
    assert.equal(projection.status.conflictCandidateCount, 1)
    assert.equal(projection.status.relationshipCount, 18)
    assert.equal(projection.status.definedRelationshipCount, 16)
    assert.equal(projection.status.missingRelationshipCount, 2)
    assert.equal(projection.status.componentPlacementGapCount, 1)
    assert.equal(projection.status.testHookGapCount, 1)
    assert.equal(projection.status.staleDependencyCount, 0)
    assert.equal(projection.candidate?.subjectCatalogDigest, `sha256:${"3".repeat(64)}`)
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"routePattern":'), false)
    assert.equal(serialized.includes('"screenKey":'), false)
    assert.equal(serialized.includes('"stateKey":'), false)
    assert.equal(serialized.includes('"componentKey":'), false)
    assert.equal(serialized.includes('"implementationUnitId":'), false)
    assert.equal(serialized.includes('"pathCandidates":'), false)
    assert.equal(serialized.includes('"testHookCandidates":'), false)
    assert.equal(serialized.includes('"evidenceReferences":'), false)
    assert.equal(serialized.includes('"reviewedBy":'), false)
    assert.equal(serialized.includes('"subjects":'), false)
    assert.equal(serialized.includes('"relationships":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readRouteScreenComponentMapping(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Test Methodology projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-test-methodology-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-test-methodology-snapshot-binding",
    "bad-test-methodology-snapshot-digest",
    "bad-test-methodology-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath, engineExecutable: process.execPath, engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readTestMethodology(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.sourceUnitCount, 4)
    assert.equal(projection.status.sourceRequirementCount, 7)
    assert.equal(projection.status.sourceCriterionCount, 12)
    assert.equal(projection.status.sourceMappingSubjectCount, 14)
    assert.equal(projection.status.scopeCount, 4)
    assert.equal(projection.status.decisionCount, 6)
    assert.equal(projection.status.selectedDecisionCount, 4)
    assert.equal(projection.status.conflictDecisionCount, 1)
    assert.equal(projection.status.environmentGapCount, 1)
    assert.equal(projection.status.dataPolicyGapCount, 1)
    assert.equal(projection.status.criterionGapCount, 1)
    assert.equal(projection.status.staleDependencyCount, 0)
    assert.equal(projection.candidate?.scopeCatalogDigest, `sha256:${"1".repeat(64)}`)
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"methodKind":'), false)
    assert.equal(serialized.includes('"environmentAddress":'), false)
    assert.equal(serialized.includes('"testData":'), false)
    assert.equal(serialized.includes('"ownerCandidateIds":'), false)
    assert.equal(serialized.includes('"evidenceReferences":'), false)
    assert.equal(serialized.includes('"result":'), false)
    assert.equal(serialized.includes('"scopes":'), false)
    assert.equal(serialized.includes('"decisions":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readTestMethodology(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Test Inventory projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-test-inventory-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-test-inventory-snapshot-binding",
    "bad-test-inventory-snapshot-digest",
    "bad-test-inventory-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath, engineExecutable: process.execPath, engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readTestInventory(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.sourceCriterionCount, 12)
    assert.equal(projection.status.sourceRiskCount, 9)
    assert.equal(projection.status.sourceUnitCount, 4)
    assert.equal(projection.status.sourceMappingSubjectCount, 14)
    assert.equal(projection.status.sourceMethodologyScopeCount, 4)
    assert.equal(projection.status.assetCount, 18)
    assert.equal(projection.status.catalogedAssetCount, 14)
    assert.equal(projection.status.uncoveredCriterionCount, 2)
    assert.equal(projection.status.uncoveredRiskCount, 1)
    assert.equal(projection.status.orphanAssetCount, 1)
    assert.equal(projection.status.staleDependencyCount, 0)
    assert.equal(projection.candidate?.catalogReceiptDigest, `sha256:${"1".repeat(64)}`)
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"testPath":'), false)
    assert.equal(serialized.includes('"title":'), false)
    assert.equal(serialized.includes('"ownerCandidateIds":'), false)
    assert.equal(serialized.includes('"evidenceReferences":'), false)
    assert.equal(serialized.includes('"result":'), false)
    assert.equal(serialized.includes('"assets":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readTestInventory(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 Design System and Token Contract projection is exact, private-safe, and non-authorizing", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-design-system-token-contract-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-design-system-token-contract-snapshot-binding",
    "bad-design-system-token-contract-snapshot-digest",
    "bad-design-system-token-contract-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readDesignSystemTokenContract(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.designSystemCount, 2)
    assert.equal(projection.status.tokenCount, 48)
    assert.equal(projection.status.variableCount, 19)
    assert.equal(projection.status.componentCount, 12)
    assert.equal(projection.status.representedRequirementCount, 10)
    assert.equal(projection.candidate?.tokenCount, 48)
    assert.equal(
      projection.authorityBoundary,
      "design-system-token-contract-projection-is-read-only-and-does-not-establish-design-system-token-variable-or-component-validity-ownership-authority-accessibility-design-approval-baseline-readiness-implementation-write-or-action-authority",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"tokenValue":'), false)
    assert.equal(serialized.includes('"tokens":'), false)
    assert.equal(serialized.includes('"components":'), false)
    assert.equal(serialized.includes('"requirements":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readDesignSystemTokenContract(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 client validates privacy-safe Accessibility Design Rules projections and rejects hostile responses", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-unit-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-accessibility-design-rules-snapshot-binding",
    "bad-accessibility-design-rules-snapshot-digest",
    "bad-accessibility-design-rules-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readAccessibilityDesignRules(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.targetCount, 12)
    assert.equal(projection.status.ruleCount, 18)
    assert.equal(projection.status.checkCount, 24)
    assert.equal(projection.status.humanReviewedCheckCount, 17)
    assert.equal(projection.status.representedRequirementCount, 10)
    assert.equal(projection.candidate?.ruleCount, 18)
    assert.equal(
      projection.authorityBoundary,
      "accessibility-design-rules-projection-is-read-only-and-does-not-establish-accessibility-conformance-rule-or-check-validity-legal-compliance-ownership-design-approval-baseline-readiness-implementation-write-or-action-authority",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"ruleProcedure":'), false)
    assert.equal(serialized.includes('"rules":'), false)
    assert.equal(serialized.includes('"checks":'), false)
    assert.equal(serialized.includes('"requirements":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readAccessibilityDesignRules(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 client validates privacy-safe Responsive and Multi-Platform Targets projections and rejects hostile responses", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-responsive-multi-platform-targets-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-responsive-multi-platform-targets-snapshot-binding",
    "bad-responsive-multi-platform-targets-snapshot-digest",
    "bad-responsive-multi-platform-targets-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readResponsiveMultiPlatformTargets(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.platformTargetCount, 3)
    assert.equal(projection.status.breakpointCount, 5)
    assert.equal(projection.status.behaviorCount, 14)
    assert.equal(projection.status.checkCount, 22)
    assert.equal(projection.status.humanReviewedCheckCount, 17)
    assert.equal(projection.status.representedRequirementCount, 10)
    assert.equal(projection.candidate?.behaviorCount, 14)
    assert.equal(
      projection.authorityBoundary,
      "responsive-multi-platform-targets-projection-is-read-only-and-does-not-establish-responsive-completeness-platform-parity-breakpoint-or-behavior-validity-accessibility-conformance-ownership-design-approval-baseline-readiness-implementation-write-or-action-authority",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"behaviorProcedure":'), false)
    assert.equal(serialized.includes('"behaviors":'), false)
    assert.equal(serialized.includes('"checks":'), false)
    assert.equal(serialized.includes('"requirements":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readResponsiveMultiPlatformTargets(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 client validates privacy-safe Manual Figma Execution Path projections and rejects hostile responses", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-manual-figma-execution-path-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-manual-figma-execution-path-snapshot-binding",
    "bad-manual-figma-execution-path-snapshot-digest",
    "bad-manual-figma-execution-path-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readManualFigmaExecutionPath(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.scopeCount, 3)
    assert.equal(projection.status.instructionCount, 5)
    assert.equal(projection.status.checkCount, 24)
    assert.equal(projection.status.humanReviewedCheckCount, 19)
    assert.equal(projection.status.representedRequirementCount, 10)
    assert.equal(projection.candidate?.scopeCount, 3)
    assert.equal(
      projection.authorityBoundary,
      "manual-figma-execution-path-projection-is-read-only-and-does-not-connect-to-figma-prove-execution-or-return-completeness-grant-write-authority-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"handoffContent":'), false)
    assert.equal(serialized.includes('"instructions":'), false)
    assert.equal(serialized.includes('"checks":'), false)
    assert.equal(serialized.includes('"requirements":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readManualFigmaExecutionPath(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 client validates privacy-safe Figma MCP Capability Discovery projections and rejects hostile responses", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-figma-mcp-capability-discovery-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-figma-mcp-capability-discovery-snapshot-binding",
    "bad-figma-mcp-capability-discovery-snapshot-digest",
    "bad-figma-mcp-capability-discovery-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readFigmaMcpCapabilityDiscovery(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.toolCount, 7)
    assert.equal(projection.status.advertisedToolCount, 5)
    assert.equal(projection.status.readToolCount, 3)
    assert.equal(projection.status.writeToolCount, 2)
    assert.equal(projection.status.humanReviewedToolCount, 4)
    assert.equal(projection.candidate?.toolCount, 7)
    assert.equal(
      projection.authorityBoundary,
      "figma-mcp-capability-discovery-projection-is-read-only-and-does-not-connect-to-or-call-figma-request-credentials-grant-permissions-establish-tool-availability-or-compatibility-authorize-write-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"toolNames":'), false)
    assert.equal(serialized.includes('"permissions":'), false)
    assert.equal(serialized.includes('"limits":'), false)
    assert.equal(serialized.includes('"versions":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readFigmaMcpCapabilityDiscovery(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 client validates privacy-safe Figma Read Snapshot projections and rejects hostile responses", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-figma-read-snapshot-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-figma-read-snapshot-binding",
    "bad-figma-read-snapshot-digest",
    "bad-figma-read-snapshot-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readFigmaReadSnapshot(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.fileCount, 2)
    assert.equal(projection.status.componentCount, 12)
    assert.equal(projection.status.variableCollectionCount, 3)
    assert.equal(projection.status.variableCount, 18)
    assert.equal(projection.status.humanReviewedItemCount, 25)
    assert.equal(projection.candidate?.fileCount, 2)
    assert.equal(
      projection.authorityBoundary,
      "figma-read-snapshot-projection-is-read-only-and-does-not-connect-to-or-call-figma-request-credentials-grant-permissions-prove-external-completeness-authorize-write-validate-or-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"fileNames":'), false)
    assert.equal(serialized.includes('"components":'), false)
    assert.equal(serialized.includes('"variables":'), false)
    assert.equal(serialized.includes('"values":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readFigmaReadSnapshot(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 client validates privacy-safe Figma Context Import projections and rejects hostile responses", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-figma-context-import-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-figma-context-import-binding",
    "bad-figma-context-import-digest",
    "bad-figma-context-import-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readFigmaContextImport(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.contextPackCount, 2)
    assert.equal(projection.status.sectionCount, 8)
    assert.equal(projection.status.contextItemCount, 24)
    assert.equal(projection.status.targetCount, 2)
    assert.equal(projection.status.humanReviewedSectionCount, 5)
    assert.equal(projection.status.representedRequirementCount, 7)
    assert.equal(projection.candidate?.contextPackCount, 2)
    assert.equal(
      projection.authorityBoundary,
      "figma-context-import-projection-is-read-only-and-does-not-package-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"contextItems":'), false)
    assert.equal(serialized.includes('"sections":'), false)
    assert.equal(serialized.includes('"targets":'), false)
    assert.equal(serialized.includes('"tools":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readFigmaContextImport(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 client validates privacy-safe Outbound Design Brief Package projections and rejects hostile responses", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-outbound-design-brief-package-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-outbound-design-brief-package-binding",
    "bad-outbound-design-brief-package-digest",
    "bad-outbound-design-brief-package-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readOutboundDesignBriefPackage(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.manifestState, "partial")
    assert.equal(projection.status.contextPackCount, 2)
    assert.equal(projection.status.entryCount, 8)
    assert.equal(projection.status.contextItemCount, 24)
    assert.equal(projection.status.recipientCount, 2)
    assert.equal(projection.status.humanReviewedEntryCount, 5)
    assert.equal(projection.status.representedRequirementCount, 7)
    assert.equal(projection.candidate?.manifestFormat, "gaep-outbound-design-brief-package-v1")
    assert.equal(
      projection.authorityBoundary,
      "outbound-design-brief-package-projection-is-read-only-and-does-not-materialize-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"entries":'), false)
    assert.equal(serialized.includes('"recipients":'), false)
    assert.equal(serialized.includes('"disclosures":'), false)
    assert.equal(serialized.includes('"tools":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readOutboundDesignBriefPackage(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 client validates privacy-safe Governed Figma Write projections and rejects hostile responses", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-governed-figma-write-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-governed-figma-write-binding",
    "bad-governed-figma-write-digest",
    "bad-governed-figma-write-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readGovernedFigmaWrite(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.writePlanState, "held")
    assert.equal(projection.status.previewState, "candidate-generated")
    assert.equal(projection.status.approvalState, "pending")
    assert.equal(projection.status.permissionEvidenceState, "missing")
    assert.equal(projection.status.idempotencyState, "defined")
    assert.equal(projection.status.replayProtectionState, "defined")
    assert.equal(projection.status.recoveryPlanState, "defined")
    assert.equal(projection.status.writeExecutionState, "not-performed")
    assert.equal(projection.status.writeResultState, "not-recorded")
    assert.equal(projection.candidate?.requestFormat, "gaep-governed-figma-write-request-v1")
    assert.equal(projection.candidate?.selectedEntryCount, 8)
    assert.equal(
      projection.authorityBoundary,
      "governed-figma-write-projection-is-read-only-and-does-not-materialize-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"approvalActor":'), false)
    assert.equal(serialized.includes('"permissionKeys":'), false)
    assert.equal(serialized.includes('"recoveryPlan":'), false)
    assert.equal(serialized.includes('"tools":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readGovernedFigmaWrite(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 client validates privacy-safe Finalized Figma Snapshot Import projections and rejects hostile responses", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-finalized-figma-snapshot-import-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-finalized-figma-snapshot-import-binding",
    "bad-finalized-figma-snapshot-import-digest",
    "bad-finalized-figma-snapshot-import-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readFinalizedFigmaSnapshotImport(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.returnAuthorizationState, "missing")
    assert.equal(projection.status.reconciliationState, "partial")
    assert.equal(projection.status.provenanceState, "partial")
    assert.equal(projection.status.snapshotCompletenessState, "partial")
    assert.equal(projection.status.importExecutionState, "not-performed")
    assert.equal(projection.status.importResultState, "not-recorded")
    assert.equal(projection.candidate?.itemCount, 18)
    assert.equal(projection.candidate?.conflictCount, 4)
    assert.equal(
      projection.authorityBoundary,
      "finalized-figma-snapshot-import-projection-is-read-only-and-does-not-transfer-or-import-content-connect-to-or-call-figma-request-credentials-grant-permissions-prove-external-completeness-validate-or-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"authorizationActor":'), false)
    assert.equal(serialized.includes('"items":'), false)
    assert.equal(serialized.includes('"conflicts":'), false)
    assert.equal(serialized.includes('"sources":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readFinalizedFigmaSnapshotImport(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 client validates privacy-safe Design-to-Requirement Binding projections and rejects hostile responses", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-design-to-requirement-binding-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-design-to-requirement-binding-binding",
    "bad-design-to-requirement-binding-digest",
    "bad-design-to-requirement-binding-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readDesignToRequirementBinding(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.reconciliationState, "partial")
    assert.equal(projection.status.candidateCoverageState, "partial")
    assert.equal(projection.status.provenanceState, "exact")
    assert.equal(projection.status.bindingCount, 7)
    assert.equal(projection.status.humanReviewedBindingCount, 5)
    assert.equal(projection.candidate?.designItemCoverageCount, 4)
    assert.equal(projection.candidate?.subjectCoverageCount, 5)
    assert.equal(projection.candidate?.conflictCount, 3)
    assert.equal(
      projection.authorityBoundary,
      "design-to-requirement-binding-projection-is-read-only-and-does-not-establish-relationship-truth-coverage-completeness-requirement-satisfaction-decision-effectiveness-external-completeness-design-validity-or-approval-baseline-readiness-implementation-write-import-or-action-authority",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"humanAttribution":'), false)
    assert.equal(serialized.includes('"bindings":'), false)
    assert.equal(serialized.includes('"requirements":'), false)
    assert.equal(serialized.includes('"decisions":'), false)
    assert.equal(serialized.includes('"sources":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readDesignToRequirementBinding(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 client validates privacy-safe Designer-Ready Gate projections and rejects hostile responses", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-designer-ready-gate-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-designer-ready-gate-binding",
    "bad-designer-ready-gate-digest",
    "bad-designer-ready-gate-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readDesignerReadyGate(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.candidateResult, "incomplete")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.prerequisiteCount, 12)
    assert.equal(projection.status.satisfiedCount, 9)
    assert.equal(projection.status.humanReviewedCount, 10)
    assert.equal(projection.candidate?.prerequisiteCount, 12)
    assert.equal(
      projection.authorityBoundary,
      "designer-ready-gate-projection-is-read-only-and-does-not-establish-design-completeness-external-completeness-design-validity-approval-baseline-readiness-exception-waiver-acceptance-phase-entry-implementation-write-import-or-action-authority",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"criteria":'), false)
    assert.equal(serialized.includes('"evaluations":'), false)
    assert.equal(serialized.includes('"exceptions":'), false)
    assert.equal(serialized.includes('"sources":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readDesignerReadyGate(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 client validates privacy-safe Design Delta projections and rejects hostile responses", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-design-delta-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-design-delta-binding",
    "bad-design-delta-digest",
    "bad-design-delta-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readDesignDelta(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.candidateResult, "conflict-candidate")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.deltaCount, 6)
    assert.equal(projection.status.conflictingCount, 1)
    assert.equal(projection.status.humanReviewedCount, 3)
    assert.equal(projection.candidate?.deltaCount, 6)
    assert.equal(
      projection.authorityBoundary,
      "design-delta-projection-is-read-only-and-does-not-establish-delta-completeness-external-completeness-design-validity-approval-baseline-readiness-conflict-resolution-synchronization-implementation-write-import-or-action-authority",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"deltaContent":'), false)
    assert.equal(serialized.includes('"evidence":'), false)
    assert.equal(serialized.includes('"sources":'), false)
    assert.equal(serialized.includes('"reviewedBy":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readDesignDelta(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 client validates privacy-safe Design Conflict Resolution projections and rejects hostile responses", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-design-conflict-resolution-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-design-conflict-resolution-binding",
    "bad-design-conflict-resolution-digest",
    "bad-design-conflict-resolution-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readDesignConflictResolution(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.candidateResult, "escalation-plan-candidate")
    assert.equal(projection.status.reviewState, "held")
    assert.equal(projection.status.conflictCount, 5)
    assert.equal(projection.status.resolutionCount, 4)
    assert.equal(projection.status.escalateCount, 1)
    assert.equal(projection.status.humanReviewedCount, 3)
    assert.equal(projection.candidate?.resolutionCount, 4)
    assert.equal(
      projection.authorityBoundary,
      "design-conflict-resolution-projection-is-read-only-and-does-not-enforce-separation-of-duties-resolve-conflicts-synchronize-design-establish-validity-approval-baseline-readiness-or-grant-implementation-write-import-or-action-authority",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"resolutionContent":'), false)
    assert.equal(serialized.includes('"evidence":'), false)
    assert.equal(serialized.includes('"sources":'), false)
    assert.equal(serialized.includes('"reviewedBy":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readDesignConflictResolution(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 client validates privacy-safe Human Design Approval projections and rejects hostile responses", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-human-design-approval-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-human-design-approval-binding",
    "bad-human-design-approval-digest",
    "bad-human-design-approval-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readHumanDesignApproval(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.candidateResult, "approved-candidate")
    assert.equal(projection.status.reviewState, "recorded-human-decision")
    assert.equal(projection.status.prerequisiteCount, 5)
    assert.equal(projection.status.completePrerequisiteCount, 4)
    assert.equal(projection.status.approveCount, 1)
    assert.equal(projection.status.approverAuthorityState, "not-established")
    assert.equal(projection.candidate?.decisionKind, "approve-candidate")
    assert.equal(
      projection.authorityBoundary,
      "human-design-approval-projection-is-read-only-and-does-not-verify-approver-authority-enforce-separation-of-duties-establish-design-approval-baseline-readiness-phase-entry-or-grant-implementation-write-import-or-action-authority",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"decisionRationale":'), false)
    assert.equal(serialized.includes('"evidence":'), false)
    assert.equal(serialized.includes('"sources":'), false)
    assert.equal(serialized.includes('"decidedBy":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readHumanDesignApproval(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 client validates privacy-safe Design Baseline projections and rejects hostile responses", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-design-baseline-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-design-baseline-binding",
    "bad-design-baseline-digest",
    "bad-design-baseline-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readDesignBaseline(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.candidateResult, "supersession-candidate")
    assert.equal(projection.status.reviewState, "ready-for-human-review")
    assert.equal(projection.status.candidateSetCount, 1)
    assert.equal(projection.status.designationCandidateCount, 1)
    assert.equal(projection.status.supersessionCandidateCount, 1)
    assert.equal(projection.status.approvalDeterminationState, "not-established")
    assert.equal(projection.status.baselineDesignationState, "not-established")
    assert.equal(projection.candidate?.semanticVersion, "2.0.0")
    assert.equal(projection.candidate?.designationKind, "supersede-baseline-candidate")
    assert.equal(
      projection.authorityBoundary,
      "design-baseline-projection-is-read-only-and-does-not-convert-an-approval-candidate-into-approval-verify-approver-authority-enforce-separation-of-duties-establish-a-baseline-readiness-phase-entry-or-grant-implementation-write-import-or-action-authority",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"designRationale":'), false)
    assert.equal(serialized.includes('"evidence":'), false)
    assert.equal(serialized.includes('"sources":'), false)
    assert.equal(serialized.includes('"proposedBy":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readDesignBaseline(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 client validates privacy-safe Design Drift Detection projections and rejects hostile responses", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-design-drift-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-design-drift-binding",
    "bad-design-drift-digest",
    "bad-design-drift-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const projection = await client.readDesignDriftDetection(initiativeId)
    assert.equal(projection.status.state, "attention-required")
    assert.equal(projection.status.candidateResult, "incomplete")
    assert.equal(projection.status.implementationTargetCount, 5)
    assert.equal(projection.status.observationCount, 9)
    assert.equal(projection.status.requirementToDesignCount, 4)
    assert.equal(projection.status.designToImplementationCount, 5)
    assert.equal(projection.status.driftCount, 5)
    assert.equal(projection.status.blockerCount, 1)
    assert.equal(projection.status.remediationCandidateCount, 4)
    assert.equal(projection.candidate?.designBaseline.baselineDesignationState, "not-established")
    assert.equal(projection.candidate?.implementationTargetCatalogRevision, 2)
    assert.equal(
      projection.authorityBoundary,
      "design-drift-detection-projection-is-read-only-and-does-not-establish-an-actual-baseline-comparison-completeness-external-completeness-design-or-implementation-validity-approval-readiness-remediation-effect-or-figma-import-write-implementation-or-action-authority",
    )
    const serialized = JSON.stringify(projection)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.equal(serialized.includes('"implementationContent":'), false)
    assert.equal(serialized.includes('"reviewedBy":'), false)
    assert.equal(serialized.includes('"sources":'), false)
    assert.equal(serialized.includes('"remediationCandidates":'), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      await assert.rejects(
        () => hostile.readDesignDriftDetection(initiativeId),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 client validates the exact derived Phase 2 UX/Figma dashboard and rejects hostile responses", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-phase2-dashboard-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-phase2-dashboard-catalog",
    "bad-phase2-dashboard-digest",
    "bad-phase2-dashboard-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const [product, initiative] = await Promise.all([
      client.readProduct(),
      client.readInitiative(initiativeId),
    ])
    const dashboard = await client.readPhase2UxFigmaDashboard(product, initiative)
    assert.equal(dashboard.kind, "phase-2-ux-figma-dashboard")
    assert.equal(dashboard.sources.length, 23)
    assert.equal(dashboard.phaseStatus.state, "attention-required")
    assert.equal(dashboard.phaseStatus.unavailableSourceCount, 23)
    assert.equal(dashboard.phaseStatus.productOwnerAcceptance, "not-established")
    assert.equal(dashboard.governance.approvalState, "not-established")
    assert.equal(dashboard.governance.baselineDesignationState, "not-established")
    assert.equal(dashboard.figma.connectionState, "not-established")
    assert.equal(dashboard.figma.writeExecutionState, "not-performed")
    assert.equal(dashboard.governance.remediationEffectState, "not-applied")
    const serialized = JSON.stringify(dashboard)
    assert.equal(serialized.includes("Example Product"), false)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      const [product, initiative] = await Promise.all([
        hostile.readProduct(),
        hostile.readInitiative(initiativeId),
      ])
      await assert.rejects(
        () => hostile.readPhase2UxFigmaDashboard(product, initiative),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 client validates the integrated Phase 2 Change, Impact, Agent and Model dashboard", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-phase2-integrated-"))
  const workspace = join(root, "workspace")
  const hostileRoots = [
    "bad-phase2-integrated-binding",
    "bad-phase2-integrated-digest",
    "bad-phase2-integrated-private",
  ].map((name) => join(root, name))
  await Promise.all([workspace, ...hostileRoots].map((path) => mkdir(path)))
  const createClient = (workspacePath: string) => GaepEngineClient.create({
    workspacePath,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
  })
  const client = await createClient(workspace)
  try {
    const [product, initiative] = await Promise.all([
      client.readProduct(),
      client.readInitiative(initiativeId),
    ])
    const dashboard = await client.readPhase2ChangeImpactAgentModelDashboard(product, initiative)
    assert.equal(dashboard.kind, "phase-2-change-impact-agent-model-dashboard")
    assert.equal(dashboard.synchronizationChange.state, "attention-required")
    assert.equal(dashboard.impact.coverage, "bounded-not-complete")
    assert.equal(dashboard.agentModel.capabilities.shown, 2)
    assert.equal(dashboard.agentModel.providerMetrics.usage, "unavailable")
    assert.equal(dashboard.governance.runLaunchAuthority, "not-granted")
    assert.equal(dashboard.governance.productOwnerAcceptance, "not-established")
    const serialized = JSON.stringify(dashboard)
    assert.equal(serialized.includes("Example Product"), false)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
  } finally {
    await client.dispose()
  }
  for (const workspacePath of hostileRoots) {
    const hostile = await createClient(workspacePath)
    try {
      const [product, initiative] = await Promise.all([
        hostile.readProduct(),
        hostile.readInitiative(initiativeId),
      ])
      await assert.rejects(
        () => hostile.readPhase2ChangeImpactAgentModelDashboard(product, initiative),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await hostile.dispose()
    }
  }
  await rm(root, { recursive: true, force: true })
})

test("protocol-v2 client imports, lists, and exact-reads metadata without authority escalation", async () => {
  const root = await mkdtemp(join(tmpdir(), "gaep-kiro-unit-"))
  const workspace = join(root, "workspace")
  const bundleRoot = join(root, "bundle")
  const sourceErrorRoot = join(root, "source-error")
  const badReadinessRoot = join(root, "bad-readiness")
  const badSelectionRoot = join(root, "bad-selection")
  const badRunsRoot = join(root, "bad-runs")
  const badHandoffRoot = join(root, "bad-handoff")
  const badHandoffBindingRoot = join(root, "bad-handoff-binding")
  const badManagedPreviewRoot = join(root, "bad-managed-preview")
  const badManagedCriterionRoot = join(root, "bad-managed-criterion")
  const badManagedDigestRoot = join(root, "bad-managed-digest")
  const badManagedReceiptRoot = join(root, "bad-managed-receipt")
  const badManagedBindingRoot = join(root, "bad-managed-binding")
  const badManagedEvidencePageRoot = join(root, "bad-managed-evidence-page")
  const badManagedEvidenceCountRoot = join(root, "bad-managed-evidence-count")
  const badManagedEvidenceSnapshotRoot = join(root, "bad-managed-evidence-snapshot")
  const badManagedEvidenceTotalRoot = join(root, "bad-managed-evidence-total")
  const badManagedEvidenceDetailRoot = join(root, "bad-managed-evidence-detail")
  const badManagedEvidenceBindingRoot = join(root, "bad-managed-evidence-binding")
  const discardManagedReviewRoot = join(root, "discard-managed-review")
  const badManagedReviewDigestRoot = join(root, "bad-managed-review-digest")
  const badManagedReviewPrivateRoot = join(root, "bad-managed-review-private")
  const badManagedReviewBindingRoot = join(root, "bad-managed-review-binding")
  const badManagedReviewPathRoot = join(root, "bad-managed-review-path")
  const badManagedTransitionDigestRoot = join(root, "bad-managed-transition-digest")
  const badManagedTransitionPrivateRoot = join(root, "bad-managed-transition-private")
  const staleManagedReviewRoot = join(root, "stale-managed-review")
  const badDashboardBindingRoot = join(root, "bad-dashboard-binding")
  const badDashboardApplicabilityRoot = join(root, "bad-dashboard-applicability")
  const badDashboardEvidenceCuesRoot = join(root, "bad-dashboard-evidence-cues")
  const badDashboardDigestRoot = join(root, "bad-dashboard-digest")
  const badDashboardPrivateRoot = join(root, "bad-dashboard-private")
  const badPhase1SummaryDigestRoot = join(root, "bad-phase1-summary-digest")
  const badPhase1ChangeImpactDigestRoot = join(root, "bad-phase1-change-impact-digest")
  const badChangeCatalogBindingRoot = join(root, "bad-change-catalog-binding")
  const badChangeCatalogDigestRoot = join(root, "bad-change-catalog-digest")
  const badChangeCatalogPrivateRoot = join(root, "bad-change-catalog-private")
  const badChangeImpactBindingRoot = join(root, "bad-change-impact-binding")
  const badChangeImpactCountRoot = join(root, "bad-change-impact-count")
  const badChangeImpactFreshnessRoot = join(root, "bad-change-impact-freshness")
  const badChangeImpactEvidenceCuesRoot = join(root, "bad-change-impact-evidence-cues")
  const badChangeImpactDigestRoot = join(root, "bad-change-impact-digest")
  const badChangeImpactPrivateRoot = join(root, "bad-change-impact-private")
  const badAgentModelBindingRoot = join(root, "bad-agent-model-binding")
  const badAgentModelCountRoot = join(root, "bad-agent-model-count")
  const badAgentModelFreshnessRoot = join(root, "bad-agent-model-freshness")
  const badAgentModelEvidenceCuesRoot = join(root, "bad-agent-model-evidence-cues")
  const badAgentModelMetricsRoot = join(root, "bad-agent-model-metrics")
  const badAgentModelDigestRoot = join(root, "bad-agent-model-digest")
  const badAgentModelPrivateRoot = join(root, "bad-agent-model-private")
  const badPhase1AgentModelCountRoot = join(root, "bad-phase1-agent-model-count")
  const badPhase1AgentModelDigestRoot = join(root, "bad-phase1-agent-model-digest")
  const badPhase1AgentModelPrivateRoot = join(root, "bad-phase1-agent-model-private")
  await Promise.all([
    workspace, bundleRoot, sourceErrorRoot, badReadinessRoot, badSelectionRoot, badRunsRoot, badHandoffRoot,
    badHandoffBindingRoot, badManagedPreviewRoot, badManagedCriterionRoot, badManagedDigestRoot, badManagedReceiptRoot,
    badManagedBindingRoot, badManagedEvidencePageRoot, badManagedEvidenceCountRoot, badManagedEvidenceSnapshotRoot,
    badManagedEvidenceTotalRoot,
    badManagedEvidenceDetailRoot, badManagedEvidenceBindingRoot, discardManagedReviewRoot, badManagedReviewDigestRoot,
    badManagedReviewPrivateRoot, badManagedReviewBindingRoot, badManagedReviewPathRoot, badManagedTransitionDigestRoot,
    badManagedTransitionPrivateRoot, staleManagedReviewRoot, badDashboardBindingRoot, badDashboardApplicabilityRoot,
    badDashboardEvidenceCuesRoot,
    badDashboardDigestRoot, badDashboardPrivateRoot, badChangeCatalogBindingRoot, badChangeCatalogDigestRoot,
    badPhase1SummaryDigestRoot,
    badPhase1ChangeImpactDigestRoot,
    badChangeCatalogPrivateRoot, badChangeImpactBindingRoot, badChangeImpactCountRoot, badChangeImpactFreshnessRoot,
    badChangeImpactEvidenceCuesRoot,
    badChangeImpactDigestRoot, badChangeImpactPrivateRoot, badAgentModelBindingRoot, badAgentModelCountRoot,
    badAgentModelFreshnessRoot, badAgentModelEvidenceCuesRoot, badAgentModelMetricsRoot, badAgentModelDigestRoot,
    badAgentModelPrivateRoot, badPhase1AgentModelCountRoot, badPhase1AgentModelDigestRoot,
    badPhase1AgentModelPrivateRoot,
  ].map((path) => mkdir(path)))
  const client = await GaepEngineClient.create({
    workspacePath: workspace,
    engineExecutable: process.execPath,
    engineArgumentsPrefix: [fakeEngine],
    sourceEnvironment: {
      ...process.env,
      AWS_SECRET_ACCESS_KEY: "private-aws-secret",
      OPENAI_API_KEY: "private-openai-key",
    },
  })
  try {
    const product = await client.readProduct()
    assert.deepEqual({ id: product.id, name: product.name, revision: product.revision }, {
      id: productId,
      name: "Example Product",
      revision: 7,
    })
    assert.match(product.digest, /^sha256:[0-9a-f]{64}$/u)
    assert.equal(JSON.stringify(product).includes(privateCredential), false)

    const dashboard = await client.readPhaseDashboard(product, "phase-0-1a-foundation")
    assert.equal(dashboard.phase.id, "phase-0-1a-foundation")
    assert.deepEqual(dashboard.panels.map((panel) => panel.id), ["foundation-summary", "change-impact", "agent-model"])
    assert.deepEqual(dashboard.panels.map((panel) => panel.state), ["attention-required", "active", "active"])
    assert.equal(dashboard.product.digest, product.digest)
    assert.equal(dashboard.evidenceCues.freshness, "current")
    assert.equal(dashboard.evidenceCues.confidence.state, "not-assessed")
    assert.equal(JSON.stringify(dashboard).includes("Example Product"), false)
    assert.equal(JSON.stringify(dashboard).includes(privateRoot), false)
    assert.equal(JSON.stringify(dashboard).includes(privateCredential), false)
    const initiative = await client.readInitiative("29292929-2929-4929-8929-292929292929")
    const phase1Summary = await client.readPhase1Summary(product, initiative)
    assert.equal(phase1Summary.initiative.recordId, initiative.id)
    assert.equal(phase1Summary.phaseStatus.state, "attention-required")
    assert.equal(phase1Summary.phaseStatus.attentionSignalCount, 2)
    assert.equal(phase1Summary.phaseStatus.declaredGapCount, 0)
    assert.equal(phase1Summary.readiness.result, "not-assessed")
    assert.equal(phase1Summary.owners.state, "unbound")
    assert.equal(JSON.stringify(phase1Summary).includes("Example Product"), false)
    assert.equal(JSON.stringify(phase1Summary).includes(privateRoot), false)
    assert.equal(JSON.stringify(phase1Summary).includes(privateCredential), false)

    for (const workspacePath of [badPhase1SummaryDigestRoot, badDashboardPrivateRoot]) {
      const hostileClient = await GaepEngineClient.create({
        workspacePath,
        engineExecutable: process.execPath,
        engineArgumentsPrefix: [fakeEngine],
      })
      try {
        const hostileProduct = await hostileClient.readProduct()
        const hostileInitiative = await hostileClient.readInitiative("29292929-2929-4929-8929-292929292929")
        await assert.rejects(
          () => hostileClient.readPhase1Summary(hostileProduct, hostileInitiative),
          (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
        )
      } finally {
        await hostileClient.dispose()
      }
    }

    for (const workspacePath of [
      badDashboardBindingRoot, badDashboardApplicabilityRoot, badDashboardEvidenceCuesRoot,
      badDashboardDigestRoot, badDashboardPrivateRoot,
    ]) {
      const hostileClient = await GaepEngineClient.create({
        workspacePath,
        engineExecutable: process.execPath,
        engineArgumentsPrefix: [fakeEngine],
      })
      try {
        const hostileProduct = await hostileClient.readProduct()
        await assert.rejects(
          () => hostileClient.readPhaseDashboard(hostileProduct, "phase-0-1a-foundation"),
          (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
        )
      } finally {
        await hostileClient.dispose()
      }
    }
    await assert.rejects(
      () => client.readPhaseDashboard({ ...product, digest: "sha256:not-a-digest" }, "phase-0-1a-foundation"),
      TypeError,
    )

    const changeCatalog = await client.listChangeImpactChanges(product)
    assert.equal(changeCatalog.items.length, 1)
    assert.equal(changeCatalog.items[0]?.recordId, "23232323-2323-4323-8323-232323232323")
    assert.equal(changeCatalog.items[0]?.state, "active")
    assert.equal(changeCatalog.omitted, 0)
    assert.equal(JSON.stringify(changeCatalog).includes("Private Change title"), false)
    assert.equal(JSON.stringify(changeCatalog).includes(privateRoot), false)
    assert.equal(JSON.stringify(changeCatalog).includes(privateCredential), false)

    const phase1ChangeImpact = await client.readPhase1ChangeImpact(product, initiative, changeCatalog.items[0]!)
    assert.equal(phase1ChangeImpact.outputs.length, 25)
    assert.equal(phase1ChangeImpact.coverage.currentTraceObservedOutputCount, 0)
    assert.equal(phase1ChangeImpact.coverage.attentionRequiredOutputCount, 0)
    assert.equal(phase1ChangeImpact.coverage.impactNotEstablishedOutputCount, 25)
    assert.equal(phase1ChangeImpact.outputs.every((output) => output.impact.revalidationState === "not-established"), true)
    assert.equal(JSON.stringify(phase1ChangeImpact).includes("Private Change title"), false)
    assert.equal(JSON.stringify(phase1ChangeImpact).includes(privateRoot), false)
    assert.equal(JSON.stringify(phase1ChangeImpact).includes(privateCredential), false)

    for (const workspacePath of [badPhase1ChangeImpactDigestRoot, badDashboardPrivateRoot]) {
      const hostileClient = await GaepEngineClient.create({
        workspacePath,
        engineExecutable: process.execPath,
        engineArgumentsPrefix: [fakeEngine],
      })
      try {
        const hostileProduct = await hostileClient.readProduct()
        const hostileInitiative = await hostileClient.readInitiative("29292929-2929-4929-8929-292929292929")
        const hostileCatalog = await hostileClient.listChangeImpactChanges(hostileProduct)
        await assert.rejects(
          () => hostileClient.readPhase1ChangeImpact(hostileProduct, hostileInitiative, hostileCatalog.items[0]!),
          (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
        )
      } finally {
        await hostileClient.dispose()
      }
    }

    for (const workspacePath of [badChangeCatalogBindingRoot, badChangeCatalogDigestRoot, badChangeCatalogPrivateRoot]) {
      const hostileClient = await GaepEngineClient.create({
        workspacePath,
        engineExecutable: process.execPath,
        engineArgumentsPrefix: [fakeEngine],
      })
      try {
        const hostileProduct = await hostileClient.readProduct()
        await assert.rejects(
          () => hostileClient.listChangeImpactChanges(hostileProduct),
          (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
        )
      } finally {
        await hostileClient.dispose()
      }
    }

    const changeImpact = await client.readChangeImpact(product, changeCatalog.items[0]!)
    assert.equal(changeImpact.change.recordId, changeCatalog.items[0]?.recordId)
    assert.equal(changeImpact.changedArtifacts[0]?.locator.kind, "workspace-relative")
    assert.equal(changeImpact.governance.approval.state, "not-established")
    assert.equal(changeImpact.freshness.state, "current")
    assert.equal(changeImpact.evidenceCues.freshness, "current")
    assert.equal(changeImpact.evidenceCues.confidence.state, "not-assessed")
    assert.equal(changeImpact.limits.truncated, false)
    assert.equal(JSON.stringify(changeImpact).includes("Private Change title"), false)
    assert.equal(JSON.stringify(changeImpact).includes(privateRoot), false)
    assert.equal(JSON.stringify(changeImpact).includes(privateCredential), false)

    for (const workspacePath of [
      badChangeImpactBindingRoot, badChangeImpactCountRoot, badChangeImpactFreshnessRoot,
      badChangeImpactEvidenceCuesRoot,
      badChangeImpactDigestRoot, badChangeImpactPrivateRoot,
    ]) {
      const hostileClient = await GaepEngineClient.create({
        workspacePath,
        engineExecutable: process.execPath,
        engineArgumentsPrefix: [fakeEngine],
      })
      try {
        const hostileProduct = await hostileClient.readProduct()
        const hostileCatalog = await hostileClient.listChangeImpactChanges(hostileProduct)
        await assert.rejects(
          () => hostileClient.readChangeImpact(hostileProduct, hostileCatalog.items[0]!),
          (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
        )
      } finally {
        await hostileClient.dispose()
      }
    }
    await assert.rejects(
      () => client.readChangeImpact(product, { ...changeCatalog.items[0]!, digest: "sha256:not-a-digest" }),
      TypeError,
    )

    const agentModel = await client.readAgentModel(product)
    assert.equal(agentModel.product.digest, product.digest)
    assert.equal(agentModel.capabilities.length, 2)
    assert.equal(agentModel.selection.status, "unselected")
    assert.equal(agentModel.providerMetrics.usage.state, "unavailable")
    assert.equal(agentModel.providerMetrics.cost.state, "unavailable")
    assert.equal(agentModel.freshness.state, "current")
    assert.equal(agentModel.evidenceCues.freshness, "current")
    assert.equal(agentModel.evidenceCues.confidence.state, "not-assessed")
    assert.equal(agentModel.limits.truncated, false)
    assert.equal(JSON.stringify(agentModel).includes("Example Product"), false)
    assert.equal(JSON.stringify(agentModel).includes(privateRoot), false)
    assert.equal(JSON.stringify(agentModel).includes(privateCredential), false)

    const phase1AgentModel = await client.readPhase1AgentModel(product, initiative)
    assert.equal(phase1AgentModel.initiative.recordId, initiative.id)
    assert.equal(phase1AgentModel.source.agentModelSnapshotDigest, phase1AgentModel.agentModel.snapshotDigest)
    assert.equal(phase1AgentModel.executionTruth.capabilities.total, 2)
    assert.equal(phase1AgentModel.executionTruth.capabilities.detected, 1)
    assert.equal(phase1AgentModel.executionTruth.runs.total, 0)
    assert.equal(phase1AgentModel.executionTruth.liveProviderQuality, "not-assessed")
    assert.equal(phase1AgentModel.executionTruth.semanticOutputQuality, "not-assessed")
    assert.equal(phase1AgentModel.governance.runLaunchAuthority, "not-granted")
    assert.equal(phase1AgentModel.governance.productOwnerAcceptance, "not-established")
    assert.equal(JSON.stringify(phase1AgentModel).includes("Example Product"), false)
    assert.equal(JSON.stringify(phase1AgentModel).includes(privateRoot), false)
    assert.equal(JSON.stringify(phase1AgentModel).includes(privateCredential), false)

    for (const workspacePath of [
      badPhase1AgentModelCountRoot, badPhase1AgentModelDigestRoot, badPhase1AgentModelPrivateRoot,
    ]) {
      const hostileClient = await GaepEngineClient.create({
        workspacePath,
        engineExecutable: process.execPath,
        engineArgumentsPrefix: [fakeEngine],
      })
      try {
        const hostileProduct = await hostileClient.readProduct()
        const hostileInitiative = await hostileClient.readInitiative(initiative.id)
        await assert.rejects(
          () => hostileClient.readPhase1AgentModel(hostileProduct, hostileInitiative),
          (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
        )
      } finally {
        await hostileClient.dispose()
      }
    }

    for (const workspacePath of [
      badAgentModelBindingRoot, badAgentModelCountRoot, badAgentModelFreshnessRoot,
      badAgentModelEvidenceCuesRoot, badAgentModelMetricsRoot,
      badAgentModelDigestRoot, badAgentModelPrivateRoot,
    ]) {
      const hostileClient = await GaepEngineClient.create({
        workspacePath,
        engineExecutable: process.execPath,
        engineArgumentsPrefix: [fakeEngine],
      })
      try {
        const hostileProduct = await hostileClient.readProduct()
        await assert.rejects(
          () => hostileClient.readAgentModel(hostileProduct),
          (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
        )
      } finally {
        await hostileClient.dispose()
      }
    }
    await assert.rejects(
      () => client.readAgentModel({ ...product, digest: "sha256:not-a-digest" }),
      TypeError,
    )

    const readiness = await client.probeAgentReadiness()
    assert.deepEqual(readiness.map((agent) => agent.agentId), ["claude-code", "codex"])
    assert.equal(readiness[0]?.detected, false)
    assert.equal(readiness[1]?.models[0]?.id, "gpt-5.6-codex")
    assert.equal(readiness[1]?.settingsCount, 1)
    assert.deepEqual(
      Object.keys(readiness[1] ?? {}).sort(),
      [
        "adapterId", "adapterVersion", "agentId", "agentLabel", "capabilityDigest", "detected", "executionInterface",
        "interfaceMaturity", "limitations", "models", "observedAt", "runtimeVersion", "schemaVersion",
        "settings", "settingsCount", "supportsCancel", "supportsCheckpoints", "supportsModelDiscovery", "supportsResume",
        "supportsToolSelection",
      ].sort(),
    )
    assert.deepEqual(readiness[1]?.settings[0], {
      key: "reasoningEffort",
      label: "Reasoning effort",
      description: "Provider-declared reasoning effort for a future governed run.",
      kind: "select",
      required: false,
      sensitive: false,
      options: [{ value: "high", label: "High" }],
      truthClass: "provider-declared",
    })
    assert.equal(JSON.stringify(readiness).includes(privateRoot), false)
    assert.equal(JSON.stringify(readiness).includes(privateCredential), false)

    assert.deepEqual(await client.readAgentSelection(), { status: "unselected" })
    const selected = await client.selectAgent({
      adapterId: "openai-codex",
      modelId: "gpt-5.6-codex",
      settings: { reasoningEffort: "high" },
      actorId: "founder.kiro-review",
    })
    assert.deepEqual({ ...selected, settings: { ...selected.settings } }, {
      schemaVersion: 2,
      adapterId: "openai-codex",
      agentId: "codex",
      modelId: "gpt-5.6-codex",
      modelTruthClass: "observed",
      modelAlias: false,
      settings: { reasoningEffort: "high" },
      selectedAt: "2026-07-24T08:05:00.000Z",
      capabilityDigest: `sha256:${"e".repeat(64)}`,
    })
    assert.deepEqual(await client.readAgentSelection(), { status: "selected", selection: selected })
    assert.equal(JSON.stringify(selected).includes(privateRoot), false)
    assert.equal(JSON.stringify(selected).includes(privateCredential), false)
    const selectedAgentModel = await client.readAgentModel(product)
    assert.deepEqual(selectedAgentModel.selection, {
      status: "selected",
      selectionDigest: canonicalDigest(selected),
      adapterId: selected.adapterId,
      agentId: selected.agentId,
      modelId: selected.modelId,
      modelTruthClass: selected.modelTruthClass,
      modelAlias: selected.modelAlias,
      settings: selected.settings,
      selectedAt: selected.selectedAt,
      capabilityDigest: selected.capabilityDigest,
      capabilityState: "stale",
    })
    assert.equal(selectedAgentModel.capabilities.filter((entry) => entry.selected).length, 1)
    assert.equal(selectedAgentModel.freshness.state, "attention-required")
    assert.equal(selectedAgentModel.evidenceCues.freshness, "stale")

    const runs = await client.listRuns()
    assert.equal(runs.length, 1)
    assert.equal(runs[0]?.id, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
    assert.equal(runs[0]?.state, "completed")
    assert.equal(runs[0]?.agent.modelId, selected.modelId)
    assert.equal(JSON.stringify(runs).includes(privateRoot), false)
    assert.equal(JSON.stringify(runs).includes(privateCredential), false)

    const handoffInput = {
      fromRunId: runs[0]!.id,
      productId: runs[0]!.productId,
      initiativeId: runs[0]!.initiativeId,
      toAdapterId: "openai-codex",
      toAgentId: "codex",
      toModelId: "gpt-5.6-codex-next",
      toSettings: { reasoningEffort: "medium" },
      reason: "Switch to the reviewed model",
      completedWork: ["Selection workflow completed"],
      unresolvedMatters: ["Native Kiro acceptance remains"],
      decisions: ["Keep execution disabled"],
      evidence: ["evidence/kiro-selection.json"],
      actorId: "founder.kiro-review",
    } as const
    const handoff = await client.createHandoff(handoffInput)
    assert.equal(handoff.id, "dddddddd-dddd-4ddd-8ddd-dddddddddddd")
    assert.equal(handoff.fromRunId, runs[0]?.id)
    assert.equal(handoff.toAgent.modelId, "gpt-5.6-codex-next")
    assert.deepEqual(handoff.workspaceBaseline.changedFiles, ["src/index.ts"])
    assert.equal(JSON.stringify(handoff).includes(privateRoot), false)
    assert.equal(JSON.stringify(handoff).includes(privateCredential), false)
    assert.equal((await client.readAgentSelection()).status, "selected")

    const managedPreview = await client.previewManagedReadOnly(charterId, workflowPlanId)
    assert.equal(managedPreview.charterId, charterId)
    assert.equal(managedPreview.workflowPlanId, workflowPlanId)
    assert.equal(managedPreview.gates.length, 6)
    assert.deepEqual(managedPreview.stepIds, ["13131313-1313-4313-8313-131313131313"])
    assert.equal(JSON.stringify(managedPreview).includes(privateRoot), false)
    assert.equal(JSON.stringify(managedPreview).includes(privateCredential), false)
    const managedReceipt = await client.executeManagedReadOnly({
      preview: managedPreview,
      timeoutMs: 30_000,
      actorId: "founder.kiro-review",
    })
    assert.equal(managedReceipt.previewDigest, managedPreview.previewDigest)
    assert.equal(managedReceipt.state, "completed")
    assert.equal(managedReceipt.providerDisposition, "completed")
    assert.equal(managedReceipt.outcomeStatus, "satisfied")
    assert.equal(managedReceipt.completedStepCount, managedReceipt.totalStepCount)
    assert.equal(JSON.stringify(managedReceipt).includes(privateRoot), false)
    assert.equal(JSON.stringify(managedReceipt).includes(privateCredential), false)

    const managedPage = await client.listManagedEvidence(0, 100)
    assert.equal(managedPage.items.length, 1)
    assert.equal(managedPage.items[0]?.managedRunId, managedRunId)
    assert.equal(managedPage.total, 3)
    assert.equal(managedPage.omittedCount, 2)
    assert.equal(managedPage.hasMore, true)
    assert.equal(JSON.stringify(managedPage).includes(privateRoot), false)
    assert.equal(JSON.stringify(managedPage).includes(privateCredential), false)
    assert.equal((await client.listManagedEvidence(0, 100, managedPage.snapshotDigest)).snapshotDigest, managedPage.snapshotDigest)
    const managedNextPage = await client.listManagedEvidence(1, 100, managedPage.snapshotDigest, managedPage.total)
    assert.equal(managedNextPage.offset, 1)
    assert.equal(managedNextPage.items.length, 2)
    assert.equal(managedNextPage.total, managedPage.total)
    assert.equal(managedNextPage.omittedCount, 1)
    assert.equal(managedNextPage.hasMore, false)
    const managedDetail = await client.readManagedEvidence(managedRunId)
    assert.equal(managedDetail.summary.managedRunId, managedRunId)
    assert.equal(managedDetail.artifactStatus, "verified-result-and-evidence")
    assert.equal(managedDetail.result?.providerDisposition, "completed")
    assert.equal(managedDetail.result?.outcomeStatus, "satisfied")
    assert.equal(managedDetail.evidence?.eventCount, 4)
    assert.equal(managedDetail.evidence?.completedStepCount, 1)
    assert.equal(managedDetail.applyDecision, undefined)
    assert.equal(JSON.stringify(managedDetail).includes(privateRoot), false)
    assert.equal(JSON.stringify(managedDetail).includes(privateCredential), false)

    const stagedReview = await client.readManagedReview(stagedManagedRunId)
    assert.equal(stagedReview.managedRunId, stagedManagedRunId)
    assert.equal(stagedReview.managedRunRevision, 3)
    assert.equal(stagedReview.state, "review-required")
    assert.equal(stagedReview.canApply, true)
    assert.equal(stagedReview.canDiscard, true)
    assert.equal(stagedReview.postApplyGatePolicy, "record-not-assessed")
    assert.deepEqual(stagedReview.staging.changedInventory.map((change) => change.path), ["src/new.ts", "src/review.ts"])
    assert.deepEqual(stagedReview.applyConfirmation?.writeEnvelope, ["src"])
    assert.equal(stagedReview.staging.changeCount, stagedReview.staging.changedInventory.length)
    assert.equal(stagedReview.staging.omittedCount, 0)
    assert.equal(JSON.stringify(stagedReview).includes(privateRoot), false)
    assert.equal(JSON.stringify(stagedReview).includes(privateCredential), false)

    const applyTransition = await client.applyManagedReview(stagedReview, "founder.kiro-review")
    assert.equal(applyTransition.decision, "apply-exact-managed-review")
    assert.equal(applyTransition.sourcePreviewDigest, stagedReview.previewDigest)
    assert.equal(applyTransition.managedRunRevision, 4)
    assert.equal(applyTransition.state, "failed")
    assert.equal(applyTransition.detail.result?.outcomeStatus, "failed")
    assert.equal(applyTransition.detail.evidence?.staging?.applyState, "applied")
    assert.equal(applyTransition.detail.applyDecision?.managedRunRevision, 3)
    assert.equal(JSON.stringify(applyTransition).includes(privateRoot), false)
    assert.equal(JSON.stringify(applyTransition).includes(privateCredential), false)

    const discardClient = await GaepEngineClient.create({
      workspacePath: discardManagedReviewRoot,
      engineExecutable: process.execPath,
      engineArgumentsPrefix: [fakeEngine],
    })
    try {
      const discardPreview = await discardClient.readManagedReview(stagedManagedRunId)
      const discardTransition = await discardClient.discardManagedReview(discardPreview, "founder.kiro-review")
      assert.equal(discardTransition.decision, "discard-exact-managed-review")
      assert.equal(discardTransition.state, "discarded")
      assert.equal(discardTransition.canApply, false)
      assert.equal(discardTransition.canDiscard, false)
      assert.equal(discardTransition.detail.evidence?.staging?.applyState, "discarded")
      assert.equal(discardTransition.detail.applyDecision, undefined)
    } finally {
      await discardClient.dispose()
    }

    await assert.rejects(
      () => client.applyManagedReview(Object.assign({}, stagedReview, { sourceRoot: privateRoot }), "founder.kiro-review"),
      (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
    )
    await assert.rejects(
      () => client.discardManagedReview({ ...stagedReview, previewDigest: `sha256:${"0".repeat(64)}` }, "founder.kiro-review"),
      (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
    )

    for (const workspacePath of [
      badManagedReviewDigestRoot, badManagedReviewPrivateRoot, badManagedReviewBindingRoot, badManagedReviewPathRoot,
    ]) {
      const hostileClient = await GaepEngineClient.create({
        workspacePath,
        engineExecutable: process.execPath,
        engineArgumentsPrefix: [fakeEngine],
      })
      try {
        await assert.rejects(
          () => hostileClient.readManagedReview(stagedManagedRunId),
          (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
        )
      } finally {
        await hostileClient.dispose()
      }
    }

    for (const workspacePath of [badManagedTransitionDigestRoot, badManagedTransitionPrivateRoot]) {
      const hostileClient = await GaepEngineClient.create({
        workspacePath,
        engineExecutable: process.execPath,
        engineArgumentsPrefix: [fakeEngine],
      })
      try {
        const hostilePreview = await hostileClient.readManagedReview(stagedManagedRunId)
        await assert.rejects(
          () => hostileClient.applyManagedReview(hostilePreview, "founder.kiro-review"),
          (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
        )
      } finally {
        await hostileClient.dispose()
      }
    }

    const staleClient = await GaepEngineClient.create({
      workspacePath: staleManagedReviewRoot,
      engineExecutable: process.execPath,
      engineArgumentsPrefix: [fakeEngine],
    })
    try {
      const stalePreview = await staleClient.readManagedReview(stagedManagedRunId)
      await assert.rejects(
        () => staleClient.applyManagedReview(stalePreview, "founder.kiro-review"),
        (error) => safeHostError(error, "MANAGED_REVIEW_CHANGED"),
      )
    } finally {
      await staleClient.dispose()
    }

    await assert.rejects(
      () => client.executeManagedReadOnly({
        preview: Object.assign({}, managedPreview, { tools: [] }),
        timeoutMs: 30_000,
        actorId: "founder.kiro-review",
      }),
      (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
    )
    await assert.rejects(
      () => client.executeManagedReadOnly({
        preview: {
          ...managedPreview,
          gates: managedPreview.gates.map((gate, index) => index === 0
            ? { ...gate, criteria: [`Inspect ${privateRoot}/${privateCredential}`] }
            : gate),
        },
        timeoutMs: 30_000,
        actorId: "founder.kiro-review",
      }),
      (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
    )
    await assert.rejects(
      () => client.executeManagedReadOnly({ preview: managedPreview, timeoutMs: 999, actorId: "founder.kiro-review" }),
      RangeError,
    )

    for (const [workspacePath, operation] of [
      [badManagedPreviewRoot, "preview"],
      [badManagedCriterionRoot, "preview"],
      [badManagedDigestRoot, "preview"],
      [badManagedReceiptRoot, "execute"],
      [badManagedBindingRoot, "execute"],
    ] as const) {
      const hostileClient = await GaepEngineClient.create({
        workspacePath,
        engineExecutable: process.execPath,
        engineArgumentsPrefix: [fakeEngine],
      })
      try {
        if (operation === "preview") {
          await assert.rejects(
            () => hostileClient.previewManagedReadOnly(charterId, workflowPlanId),
            (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
          )
        } else {
          await assert.rejects(
            () => hostileClient.executeManagedReadOnly({
              preview: managedPreview,
              timeoutMs: 30_000,
              actorId: "founder.kiro-review",
            }),
            (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
          )
        }
      } finally {
        await hostileClient.dispose()
      }
    }

    for (const [workspacePath, operation] of [
      [badManagedEvidencePageRoot, "list"],
      [badManagedEvidenceCountRoot, "list"],
      [badManagedEvidenceSnapshotRoot, "list-with-snapshot"],
      [badManagedEvidenceTotalRoot, "list-next-total"],
      [badManagedEvidenceDetailRoot, "read"],
      [badManagedEvidenceBindingRoot, "read"],
    ] as const) {
      const hostileClient = await GaepEngineClient.create({
        workspacePath,
        engineExecutable: process.execPath,
        engineArgumentsPrefix: [fakeEngine],
      })
      try {
        await assert.rejects(
          () => operation === "read"
            ? hostileClient.readManagedEvidence(managedRunId)
            : operation === "list-next-total"
              ? hostileClient.listManagedEvidence(1, 100, managedPage.snapshotDigest, managedPage.total)
              : hostileClient.listManagedEvidence(0, 100, operation === "list-with-snapshot" ? managedPage.snapshotDigest : undefined),
          (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
        )
      } finally {
        await hostileClient.dispose()
      }
    }

    await assert.rejects(() => client.listManagedEvidence(-1, 100), RangeError)
    await assert.rejects(() => client.listManagedEvidence(0, 201), RangeError)
    await assert.rejects(() => client.listManagedEvidence(0, 100, "sha256:not-a-digest"), TypeError)
    await assert.rejects(() => client.listManagedEvidence(0, 100, undefined, 2_001), RangeError)
    await assert.rejects(() => client.readManagedEvidence("00000000-0000-0000-0000-000000000000"), TypeError)

    const badRunsClient = await GaepEngineClient.create({
      workspacePath: badRunsRoot,
      engineExecutable: process.execPath,
      engineArgumentsPrefix: [fakeEngine],
    })
    try {
      await assert.rejects(() => badRunsClient.listRuns(), (error) => safeHostError(error, "HOST_RESPONSE_INVALID"))
    } finally {
      await badRunsClient.dispose()
    }

    const badHandoffClient = await GaepEngineClient.create({
      workspacePath: badHandoffRoot,
      engineExecutable: process.execPath,
      engineArgumentsPrefix: [fakeEngine],
    })
    try {
      await assert.rejects(
        () => badHandoffClient.createHandoff(handoffInput),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await badHandoffClient.dispose()
    }

    const badHandoffBindingClient = await GaepEngineClient.create({
      workspacePath: badHandoffBindingRoot,
      engineExecutable: process.execPath,
      engineArgumentsPrefix: [fakeEngine],
    })
    try {
      await assert.rejects(
        () => badHandoffBindingClient.createHandoff(handoffInput),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await badHandoffBindingClient.dispose()
    }

    await assert.rejects(
      () => client.createHandoff({ ...handoffInput, reason: `Inspect ${privateRoot}/${privateCredential}` }),
      TypeError,
    )
    await assert.rejects(
      () => client.createHandoff({ ...handoffInput, evidence: [`token=${privateCredential}`] }),
      TypeError,
    )

    const badReadinessClient = await GaepEngineClient.create({
      workspacePath: badReadinessRoot,
      engineExecutable: process.execPath,
      engineArgumentsPrefix: [fakeEngine],
    })
    try {
      await assert.rejects(
        () => badReadinessClient.probeAgentReadiness(),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await badReadinessClient.dispose()
    }

    const badSelectionClient = await GaepEngineClient.create({
      workspacePath: badSelectionRoot,
      engineExecutable: process.execPath,
      engineArgumentsPrefix: [fakeEngine],
    })
    try {
      await assert.rejects(
        () => badSelectionClient.readAgentSelection(),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    } finally {
      await badSelectionClient.dispose()
    }

    const imported = await client.importPortableDesignSnapshot({
      bundleRoot,
      expectedProductId: product.id,
      expectedProductRevision: product.revision,
      actorId: "founder.kiro-review",
    })
    assert.equal(imported.bundleId, bundleId)
    assert.equal(imported.productId, productId)
    assert.equal(imported.sourceReview.status, "approved")
    assert.equal(imported.sourceReview.gaepApproval, false)
    assert.equal(imported.governance.state, "pending-human-review")
    assert.equal(imported.governance.humanReviewRequired, true)
    assert.match(imported.sourceReview.claimLabel, /not GAEP approval/u)
    assert.deepEqual(imported.counts, {
      artifacts: 2,
      normalizedDesignTokens: 1,
      validationChecks: 6,
      recordedLimitations: 5,
    })
    const serialized = JSON.stringify(imported)
    assert.equal(serialized.includes(bundleRoot), false)
    assert.equal(serialized.includes(privateRoot), false)
    assert.equal(serialized.includes(privateCredential), false)
    assert.deepEqual(
      Object.keys(imported).sort(),
      [
        "bundleId", "classification", "counts", "digests", "governance", "initiativeId", "kind", "privacyBoundary",
        "productId", "schemaVersion", "source", "sourceReview", "timestamps", "title",
      ].sort(),
    )

    const page = await client.listPortableDesignSnapshots(0, 1)
    assert.equal(page.items.length, 1)
    assert.equal(page.items[0]?.bundleId, bundleId)
    assert.equal(page.hasMore, false)
    assert.equal((await client.readPortableDesignSnapshot(bundleId)).bundleId, bundleId)

    await assert.rejects(
      () => client.importPortableDesignSnapshot({
        bundleRoot: sourceErrorRoot,
        expectedProductId: product.id,
        expectedProductRevision: product.revision,
        actorId: "founder.kiro-review",
      }),
      (error) => safeHostError(error, "PORTABLE_DESIGN_SOURCE_INVALID"),
    )
    await assert.rejects(
      () => client.readPortableDesignSnapshot("33333333-3333-4333-8333-333333333333"),
      (error) => safeHostError(error, "PORTABLE_DESIGN_NOT_FOUND"),
    )
    await assert.rejects(
      () => client.listPortableDesignSnapshots(9_999, 200),
      (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
    )

    for (const id of [
      "44444444-4444-4444-8444-444444444444",
      "77777777-7777-4777-8777-777777777777",
      "88888888-8888-4888-8888-888888888888",
      "99999999-9999-4999-8999-999999999999",
    ]) {
      await assert.rejects(
        () => client.readPortableDesignSnapshot(id),
        (error) => safeHostError(error, "HOST_RESPONSE_INVALID"),
      )
    }
    await assert.rejects(
      () => client.readPortableDesignSnapshot("55555555-5555-4555-8555-555555555555"),
      (error) => safeHostError(error, "INVALID_UTF8"),
    )
    await assert.rejects(
      () => client.readPortableDesignSnapshot("66666666-6666-4666-8666-666666666666"),
      (error) => safeHostError(error, "RESPONSE_TOO_LARGE"),
    )
    await assert.rejects(() => client.listPortableDesignSnapshots(10_001, 1), RangeError)
    await assert.rejects(() => client.listPortableDesignSnapshots(0, 201), RangeError)
    await assert.rejects(() => client.readPortableDesignSnapshot("00000000-0000-0000-0000-000000000000"), TypeError)
    await assert.rejects(
      () => client.importPortableDesignSnapshot({
        bundleRoot,
        expectedProductId: product.id,
        expectedProductRevision: product.revision,
        actorId: `${" ".repeat(1_000_000)}founder.kiro-review`,
      }),
      TypeError,
    )
  } finally {
    await client.dispose()
    await rm(root, { recursive: true, force: true })
  }
})

function safeHostError(error: unknown, expectedKind: string): boolean {
  assert.ok(error instanceof GaepHostError)
  assert.equal(error.kind, expectedKind)
  assert.equal(error.message.includes(privateRoot), false)
  assert.equal(error.message.includes(privateCredential), false)
  return true
}
