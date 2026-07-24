import assert from "node:assert/strict"
import { mkdtemp, mkdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { GaepEngineClient, safeEngineEnvironment } from "../src/engine-client.js"
import { GaepHostError } from "../src/protocol.js"

const productId = "11111111-1111-4111-8111-111111111111"
const bundleId = "22222222-2222-4222-8222-222222222222"
const privateRoot = "/Users/private/portable-design"
const privateCredential = "PRIVATE-OAUTH-TOKEN"
const fakeEngine = resolve(dirname(fileURLToPath(import.meta.url)), "../tests/fake-engine.mjs")

test("sanitized engine environment handles Windows Path casing without copying provider state", () => {
  const sanitized = safeEngineEnvironment({
    Path: "/safe/bin",
    pathext: ".EXE;.CMD",
    AWS_SECRET_ACCESS_KEY: "private-aws-secret",
    OPENAI_API_KEY: "private-openai-key",
    HOME: "/private/home",
  })
  assert.equal(sanitized.PATH, "/safe/bin")
  assert.equal(sanitized.PATHEXT, ".EXE;.CMD")
  assert.equal(sanitized.AWS_SECRET_ACCESS_KEY, undefined)
  assert.equal(sanitized.OPENAI_API_KEY, undefined)
  assert.equal(sanitized.HOME, undefined)
  assert.equal(sanitized.GAEP_HOST_SURFACE, "kiro-portable-design")
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
  await Promise.all([
    workspace, bundleRoot, sourceErrorRoot, badReadinessRoot, badSelectionRoot, badRunsRoot, badHandoffRoot,
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
    assert.deepEqual(product, { id: productId, name: "Example Product", revision: 7 })
    assert.equal(JSON.stringify(product).includes(privateCredential), false)

    const readiness = await client.probeAgentReadiness()
    assert.deepEqual(readiness.map((agent) => agent.agentId), ["claude-code", "codex"])
    assert.equal(readiness[0]?.detected, false)
    assert.equal(readiness[1]?.models[0]?.id, "gpt-5.6-codex")
    assert.equal(readiness[1]?.settingsCount, 1)
    assert.deepEqual(
      Object.keys(readiness[1] ?? {}).sort(),
      [
        "adapterId", "adapterVersion", "agentId", "agentLabel", "detected", "executionInterface",
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
