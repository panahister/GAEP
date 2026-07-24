import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile, mkdtemp, mkdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import {
  accessibleTableCsv,
  buildAccessibleTableView,
  createAccessibleMetadataTable,
  renderAccessibleTableText,
} from "../src/accessible-table.js"
import { GaepEngineClient, safeEngineEnvironment } from "../src/engine-client.js"
import { canonicalDigest, GaepHostError } from "../src/protocol.js"

const productId = "11111111-1111-4111-8111-111111111111"
const bundleId = "22222222-2222-4222-8222-222222222222"
const charterId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const workflowPlanId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
const managedRunId = "ffffffff-ffff-4fff-8fff-ffffffffffff"
const stagedManagedRunId = "16161616-1616-4616-8616-161616161616"
const privateRoot = "/Users/private/portable-design"
const privateCredential = "PRIVATE-OAUTH-TOKEN"
const fakeEngine = resolve(dirname(fileURLToPath(import.meta.url)), "../tests/fake-engine.mjs")

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
  const badDashboardDigestRoot = join(root, "bad-dashboard-digest")
  const badDashboardPrivateRoot = join(root, "bad-dashboard-private")
  const badChangeCatalogBindingRoot = join(root, "bad-change-catalog-binding")
  const badChangeCatalogDigestRoot = join(root, "bad-change-catalog-digest")
  const badChangeCatalogPrivateRoot = join(root, "bad-change-catalog-private")
  const badChangeImpactBindingRoot = join(root, "bad-change-impact-binding")
  const badChangeImpactCountRoot = join(root, "bad-change-impact-count")
  const badChangeImpactFreshnessRoot = join(root, "bad-change-impact-freshness")
  const badChangeImpactDigestRoot = join(root, "bad-change-impact-digest")
  const badChangeImpactPrivateRoot = join(root, "bad-change-impact-private")
  const badAgentModelBindingRoot = join(root, "bad-agent-model-binding")
  const badAgentModelCountRoot = join(root, "bad-agent-model-count")
  const badAgentModelFreshnessRoot = join(root, "bad-agent-model-freshness")
  const badAgentModelMetricsRoot = join(root, "bad-agent-model-metrics")
  const badAgentModelDigestRoot = join(root, "bad-agent-model-digest")
  const badAgentModelPrivateRoot = join(root, "bad-agent-model-private")
  await Promise.all([
    workspace, bundleRoot, sourceErrorRoot, badReadinessRoot, badSelectionRoot, badRunsRoot, badHandoffRoot,
    badHandoffBindingRoot, badManagedPreviewRoot, badManagedCriterionRoot, badManagedDigestRoot, badManagedReceiptRoot,
    badManagedBindingRoot, badManagedEvidencePageRoot, badManagedEvidenceCountRoot, badManagedEvidenceSnapshotRoot,
    badManagedEvidenceTotalRoot,
    badManagedEvidenceDetailRoot, badManagedEvidenceBindingRoot, discardManagedReviewRoot, badManagedReviewDigestRoot,
    badManagedReviewPrivateRoot, badManagedReviewBindingRoot, badManagedReviewPathRoot, badManagedTransitionDigestRoot,
    badManagedTransitionPrivateRoot, staleManagedReviewRoot, badDashboardBindingRoot, badDashboardApplicabilityRoot,
    badDashboardDigestRoot, badDashboardPrivateRoot, badChangeCatalogBindingRoot, badChangeCatalogDigestRoot,
    badChangeCatalogPrivateRoot, badChangeImpactBindingRoot, badChangeImpactCountRoot, badChangeImpactFreshnessRoot,
    badChangeImpactDigestRoot, badChangeImpactPrivateRoot, badAgentModelBindingRoot, badAgentModelCountRoot,
    badAgentModelFreshnessRoot, badAgentModelMetricsRoot, badAgentModelDigestRoot, badAgentModelPrivateRoot,
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
    assert.equal(JSON.stringify(dashboard).includes("Example Product"), false)
    assert.equal(JSON.stringify(dashboard).includes(privateRoot), false)
    assert.equal(JSON.stringify(dashboard).includes(privateCredential), false)

    for (const workspacePath of [
      badDashboardBindingRoot, badDashboardApplicabilityRoot, badDashboardDigestRoot, badDashboardPrivateRoot,
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
    assert.equal(changeImpact.limits.truncated, false)
    assert.equal(JSON.stringify(changeImpact).includes("Private Change title"), false)
    assert.equal(JSON.stringify(changeImpact).includes(privateRoot), false)
    assert.equal(JSON.stringify(changeImpact).includes(privateCredential), false)

    for (const workspacePath of [
      badChangeImpactBindingRoot, badChangeImpactCountRoot, badChangeImpactFreshnessRoot,
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
    assert.equal(agentModel.limits.truncated, false)
    assert.equal(JSON.stringify(agentModel).includes("Example Product"), false)
    assert.equal(JSON.stringify(agentModel).includes(privateRoot), false)
    assert.equal(JSON.stringify(agentModel).includes(privateCredential), false)

    for (const workspacePath of [
      badAgentModelBindingRoot, badAgentModelCountRoot, badAgentModelFreshnessRoot, badAgentModelMetricsRoot,
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
