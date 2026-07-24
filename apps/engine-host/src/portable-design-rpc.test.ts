import { createHash, randomUUID } from "node:crypto"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { EngineHost } from "./host.js"

interface ProductContext {
  productId: string
  productRevision: number
  initiativeId: string
}

interface BundleFixture {
  base: string
  root: string
  bundleId: string
  artifactPaths: readonly string[]
  tokenValue: string
  sourceObjectId: string
  sourceRevision: string
  sourceReviewer: string
  sourceEvidenceId: string
}

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`
}

describe("engine-host Portable Design Snapshot RPC", () => {
  let workspace: string
  let host: EngineHost
  const fixtureRoots: string[] = []

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "gaep-host-portable-design-"))
    host = new EngineHost(workspace)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await Promise.all([
      rm(workspace, { recursive: true, force: true }),
      ...fixtureRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
    ])
  })

  async function createProductContext(): Promise<ProductContext> {
    const product = await host.dispatch({
      jsonrpc: "2.0",
      id: 1,
      method: "createProduct",
      params: {
        product: {
          name: "Portable design host Product",
          summary: "A bounded local Product Studio host test.",
          problem: "Portable design evidence needs a privacy-safe host boundary.",
          affectedUsers: "Product teams using a nontechnical host",
          desiredOutcome: "Validated metadata can be reviewed without importing source authority.",
          successSignals: ["A pending snapshot remains digest-bound and non-authoritative"],
          firstWorkflow: "Import, list, and read a local portable design bundle.",
          exclusions: ["Automatic Design Baseline approval"],
          profile: "software",
        },
      },
    }) as { id: string; revision?: number }
    const initiative = await host.dispatch({
      jsonrpc: "2.0",
      id: 2,
      method: "createInitiative",
      params: {
        initiative: {
          title: "Review portable design evidence",
          outcome: "A bounded snapshot is available for explicit human review.",
          scope: ["Portable design metadata"],
          exclusions: ["Implementation or release approval"],
        },
      },
    }) as { id: string }
    return {
      productId: product.id,
      productRevision: product.revision ?? 1,
      initiativeId: initiative.id,
    }
  }

  async function createBundle(
    context: ProductContext,
    options: { activeSvg?: boolean; productId?: string } = {},
  ): Promise<BundleFixture> {
    const base = await mkdtemp(join(tmpdir(), "gaep-host-portable-bundle-"))
    fixtureRoots.push(base)
    const root = join(base, "bundle")
    const bundleId = randomUUID()
    const artifactPaths = ["screens/private-source.svg", "tokens/private-source-tokens.json"] as const
    const svgBytes = Buffer.from(options.activeSvg
      ? '<svg xmlns="http://www.w3.org/2000/svg"><script>PRIVATE_SOURCE_BYTES</script></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg"><title>PRIVATE_SOURCE_BYTES</title></svg>')
    const tokenValue = "#123456"
    const tokenBytes = Buffer.from(JSON.stringify({
      color: {
        $type: "color",
        brand: { $value: tokenValue, $description: "PRIVATE_TOKEN_DESCRIPTION" },
      },
    }))
    const artifacts = [
      {
        id: "screen-private-source",
        path: artifactPaths[0],
        kind: "screen",
        format: "svg",
        mediaType: "image/svg+xml",
        bytes: svgBytes,
      },
      {
        id: "private-source-tokens",
        path: artifactPaths[1],
        kind: "tokens",
        format: "design-tokens-json",
        mediaType: "application/design-tokens+json",
        bytes: tokenBytes,
      },
    ]
    for (const artifact of artifacts) {
      const target = join(root, ...artifact.path.split("/"))
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, artifact.bytes)
    }
    const sourceObjectId = "PRIVATE-SOURCE-OBJECT-7"
    const sourceRevision = "PRIVATE-SOURCE-REVISION-11"
    const sourceReviewer = "private-upstream-reviewer"
    const sourceEvidenceId = "PRIVATE-UPSTREAM-EVIDENCE-19"
    const manifest = {
      schemaVersion: 1,
      kind: "portable-design-bundle",
      id: bundleId,
      productId: options.productId ?? context.productId,
      initiativeId: context.initiativeId,
      title: "Imported Product Design",
      classification: "confidential",
      owner: { kind: "role", id: "product-design-owner" },
      source: {
        tool: "figma",
        objectId: sourceObjectId,
        revision: sourceRevision,
        exportMethod: "manual-export",
        exportedAt: "2026-07-24T00:00:00.000Z",
      },
      sourceReview: {
        status: "approved",
        actor: { kind: "human", id: sourceReviewer },
        occurredAt: "2026-07-24T00:05:00.000Z",
        evidenceId: sourceEvidenceId,
      },
      artifacts: artifacts.map(({ bytes, ...artifact }) => ({
        ...artifact,
        sizeBytes: bytes.length,
        digest: sha256(bytes),
        targets: [],
      })),
    }
    await writeFile(join(root, "gaep-design-import.json"), `${JSON.stringify(manifest, null, 2)}\n`)
    return {
      base,
      root,
      bundleId,
      artifactPaths,
      tokenValue,
      sourceObjectId,
      sourceRevision,
      sourceReviewer,
      sourceEvidenceId,
    }
  }

  function importRequest(context: ProductContext, bundleRoot: string): Record<string, unknown> {
    return {
      jsonrpc: "2.0",
      id: 10,
      protocolVersion: 2,
      method: "productStudio.portableDesign.import",
      params: {
        bundleRoot,
        expectedProductId: context.productId,
        expectedProductRevision: context.productRevision,
        actorId: "founder.portable-design-review",
      },
    }
  }

  it("imports, lists, and exactly reads a privacy-safe pending summary without escalating an upstream approval", async () => {
    const context = await createProductContext()
    const fixture = await createBundle(context)

    const imported = await host.dispatch(importRequest(context, fixture.root))
    expect(imported).toMatchObject({
      schemaVersion: 1,
      kind: "portable-design-snapshot-summary",
      bundleId: fixture.bundleId,
      productId: context.productId,
      initiativeId: context.initiativeId,
      title: "Imported Product Design",
      classification: "confidential",
      governance: {
        state: "pending-human-review",
        humanReviewRequired: true,
        claimBoundary: "import-validation-is-not-design-approval-or-baseline",
        nonEscalation: "not-gaep-approval-design-baseline-implementation-or-release-readiness",
      },
      sourceReview: {
        status: "approved",
        claimLabel: expect.stringMatching(/upstream claim; not GAEP approval/),
        gaepApproval: false,
      },
      source: { tool: "figma", exportMethod: "manual-export" },
      counts: {
        artifacts: 2,
        normalizedDesignTokens: 1,
        validationChecks: 6,
        recordedLimitations: 5,
      },
      digests: {
        snapshot: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
        evidence: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
        manifest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
        artifactInventory: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      },
      timestamps: {
        sourceExportedAt: "2026-07-24T00:00:00.000Z",
        importedAt: expect.any(String),
      },
    })

    const serialized = JSON.stringify(imported)
    for (const privateValue of [
      fixture.root,
      fixture.base,
      ...fixture.artifactPaths,
      fixture.tokenValue,
      fixture.sourceObjectId,
      fixture.sourceRevision,
      fixture.sourceReviewer,
      fixture.sourceEvidenceId,
      "PRIVATE_SOURCE_BYTES",
      "PRIVATE_TOKEN_DESCRIPTION",
    ]) {
      expect(serialized).not.toContain(privateValue)
    }

    const listed = await host.dispatch({
      jsonrpc: "2.0",
      id: 11,
      protocolVersion: 2,
      method: "productStudio.portableDesign.list",
      params: { offset: 0, limit: 1 },
    })
    expect(listed).toMatchObject({
      items: [imported],
      offset: 0,
      limit: 1,
      total: 1,
      hasMore: false,
      governanceBoundary: expect.stringMatching(/pending human review/),
      privacyBoundary: expect.any(String),
    })

    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 12,
      protocolVersion: 2,
      method: "productStudio.portableDesign.read",
      params: { bundleId: fixture.bundleId },
    })).resolves.toEqual(imported)

    const currentProduct = await host.engine.readProduct()
    expect(currentProduct.currentDesign).toBeUndefined()
    expect(await host.engine.productStudio.listDesignRevisions()).toEqual([])
  })

  it("strictly rejects extra, remote, proprietary, malformed, and out-of-bound request fields", async () => {
    const context = await createProductContext()
    const validImportParams = (importRequest(context, "/tmp/not-read-during-validation").params) as Record<string, unknown>
    const rejectedImportParams = [
      { ...validImportParams, archivePath: "/tmp/design.zip" },
      { ...validImportParams, figFile: "/tmp/design.fig" },
      { ...validImportParams, oauthToken: "PRIVATE-OAUTH-TOKEN" },
      { ...validImportParams, sourceUrl: "https://example.invalid/design" },
      { ...validImportParams, figmaFileKey: "PRIVATE-LIVE-FIGMA-FILE" },
      { ...validImportParams, accountState: "PRIVATE-EXTERNAL-ACCOUNT-STATE" },
      { ...validImportParams, workspacePath: "/tmp/foreign-workspace" },
      { ...validImportParams, manifestPath: "custom.json" },
      { ...validImportParams, bundleRoot: "relative/bundle" },
      { ...validImportParams, bundleRoot: "/tmp/bundle\0suffix" },
      { ...validImportParams, expectedProductId: "not-a-uuid" },
      { ...validImportParams, expectedProductRevision: 0 },
      { ...validImportParams, actorId: "not a portable actor" },
      {
        bundleRoot: validImportParams.bundleRoot,
        expectedProductId: validImportParams.expectedProductId,
        expectedProductRevision: validImportParams.expectedProductRevision,
      },
    ]
    for (const params of rejectedImportParams) {
      await expect(host.dispatch({
        jsonrpc: "2.0",
        id: randomUUID(),
        protocolVersion: 2,
        method: "productStudio.portableDesign.import",
        params,
      })).rejects.toMatchObject({ code: -32_602, kind: "INVALID_PARAMS" })
    }

    const credentialError = await host.dispatch({
      jsonrpc: "2.0",
      id: 19,
      protocolVersion: 2,
      method: "productStudio.portableDesign.import",
      params: { ...validImportParams, oauthToken: "PRIVATE-OAUTH-TOKEN" },
    }).catch((error: unknown) => error)
    expect(credentialError).toMatchObject({ code: -32_602, kind: "INVALID_PARAMS" })
    expect(JSON.stringify(credentialError)).not.toContain("PRIVATE-OAUTH-TOKEN")

    for (const params of [{ offset: 10_001, limit: 1 }, { offset: 0, limit: 0 }, { offset: 0, limit: 201 }]) {
      await expect(host.dispatch({
        jsonrpc: "2.0",
        id: randomUUID(),
        protocolVersion: 2,
        method: "productStudio.portableDesign.list",
        params,
      })).rejects.toMatchObject({ code: -32_602, kind: "INVALID_PARAMS" })
    }
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 18,
      protocolVersion: 2,
      method: "productStudio.portableDesign.list",
      params: { offset: 10_000, limit: 200 },
    })).resolves.toMatchObject({ items: [], offset: 10_000, limit: 200, total: 0, hasMore: false })
    const listExtraError = await host.dispatch({
      jsonrpc: "2.0",
      id: 19,
      protocolVersion: 2,
      method: "productStudio.portableDesign.list",
      params: { offset: 0, limit: 1, oauthToken: "PRIVATE-LIST-OAUTH-TOKEN" },
    }).catch((error: unknown) => error)
    expect(listExtraError).toMatchObject({ code: -32_602, kind: "INVALID_PARAMS" })
    expect(JSON.stringify(listExtraError)).not.toContain("PRIVATE-LIST-OAUTH-TOKEN")
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 20,
      protocolVersion: 2,
      method: "productStudio.portableDesign.list",
      params: {},
      workspacePath: "/tmp/foreign-workspace",
    })).rejects.toMatchObject({ code: -32_600, kind: "INVALID_REQUEST" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 21,
      protocolVersion: 2,
      method: "productStudio.portableDesign.read",
      params: { bundleId: "not-a-uuid" },
    })).rejects.toMatchObject({ code: -32_602, kind: "INVALID_PARAMS" })
    const readExtraError = await host.dispatch({
      jsonrpc: "2.0",
      id: 22,
      protocolVersion: 2,
      method: "productStudio.portableDesign.read",
      params: { bundleId: randomUUID(), sourceUrl: "https://private.invalid/live-figma" },
    }).catch((error: unknown) => error)
    expect(readExtraError).toMatchObject({ code: -32_602, kind: "INVALID_PARAMS" })
    expect(JSON.stringify(readExtraError)).not.toContain("https://private.invalid/live-figma")
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 23,
      protocolVersion: 2,
      method: "productStudio.portableDesign.read",
      params: { bundleId: randomUUID() },
      accountState: "PRIVATE-EXTERNAL-ACCOUNT-STATE",
    })).rejects.toMatchObject({ code: -32_600, kind: "INVALID_REQUEST" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 24,
      protocolVersion: 1,
      method: "productStudio.portableDesign.list",
      params: {},
    })).rejects.toMatchObject({ code: -32_021, kind: "PROTOCOL_UPGRADE_REQUIRED" })
  })

  it("fails closed on stale Product context and does not persist the rejected source", async () => {
    const context = await createProductContext()
    const fixture = await createBundle(context)

    await expect(host.dispatch({
      ...importRequest(context, fixture.root),
      params: {
        ...(importRequest(context, fixture.root).params as Record<string, unknown>),
        expectedProductRevision: context.productRevision + 1,
      },
    })).rejects.toMatchObject({
      code: -32_031,
      kind: "PORTABLE_DESIGN_PRODUCT_CONTEXT_CHANGED",
      message: "The portable design request does not match the exact current Product or Initiative revision",
    })

    await expect(host.dispatch({
      ...importRequest(context, fixture.root),
      params: {
        ...(importRequest(context, fixture.root).params as Record<string, unknown>),
        expectedProductId: randomUUID(),
      },
    })).rejects.toMatchObject({ code: -32_031, kind: "PORTABLE_DESIGN_PRODUCT_CONTEXT_CHANGED" })

    const foreignSource = await createBundle(context, { productId: randomUUID() })
    await expect(host.dispatch(importRequest(context, foreignSource.root))).rejects.toMatchObject({
      code: -32_031,
      kind: "PORTABLE_DESIGN_PRODUCT_CONTEXT_CHANGED",
    })

    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 30,
      protocolVersion: 2,
      method: "productStudio.portableDesign.list",
      params: {},
    })).resolves.toMatchObject({ items: [], total: 0 })
  })

  it("maps malformed source, missing records, audit failure, and governed tampering to stable private errors", async () => {
    const context = await createProductContext()
    const unsafe = await createBundle(context, { activeSvg: true })
    const unsafeError = await host.dispatch(importRequest(context, unsafe.root)).catch((error: unknown) => error)
    expect(unsafeError).toMatchObject({
      code: -32_030,
      kind: "PORTABLE_DESIGN_SOURCE_INVALID",
      message: "The local portable design bundle did not pass bounded validation",
    })
    expect(JSON.stringify(unsafeError)).not.toContain(unsafe.root)
    expect(JSON.stringify(unsafeError)).not.toContain("PRIVATE_SOURCE_BYTES")

    const malformed = await createBundle(context)
    await writeFile(join(malformed.root, "gaep-design-import.json"), '{"PRIVATE-MALFORMED-MANIFEST":')
    const malformedError = await host.dispatch(importRequest(context, malformed.root)).catch((error: unknown) => error)
    expect(malformedError).toMatchObject({ code: -32_030, kind: "PORTABLE_DESIGN_SOURCE_INVALID" })
    expect(JSON.stringify(malformedError)).not.toContain(malformed.root)
    expect(JSON.stringify(malformedError)).not.toContain("PRIVATE-MALFORMED-MANIFEST")

    const unexpectedUpstream = vi.spyOn(host.engine.productStudio, "listPortableDesignSnapshots")
      .mockRejectedValueOnce(new Error(`Unexpected failure at ${malformed.root}; password=PRIVATE-UPSTREAM-CREDENTIAL`))
    const unexpectedError = await host.dispatch({
      jsonrpc: "2.0",
      id: 39,
      protocolVersion: 2,
      method: "productStudio.portableDesign.list",
      params: {},
    }).catch((error: unknown) => error)
    expect(unexpectedError).toMatchObject({
      code: -32_033,
      kind: "PORTABLE_DESIGN_INTEGRITY_INVALID",
      message: "GAEP could not verify the portable design snapshot inventory and metadata",
    })
    expect(JSON.stringify(unexpectedError)).not.toContain(malformed.root)
    expect(JSON.stringify(unexpectedError)).not.toContain("PRIVATE-UPSTREAM-CREDENTIAL")
    unexpectedUpstream.mockRestore()

    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 40,
      protocolVersion: 2,
      method: "productStudio.portableDesign.read",
      params: { bundleId: randomUUID() },
    })).rejects.toMatchObject({ code: -32_035, kind: "PORTABLE_DESIGN_NOT_FOUND" })

    const valid = await createBundle(context)
    await host.dispatch(importRequest(context, valid.root))
    await expect(host.dispatch(importRequest(context, valid.root))).rejects.toMatchObject({
      code: -32_034,
      kind: "PORTABLE_DESIGN_CONFLICT",
    })
    const verifyAudit = vi.spyOn(host.engine.repository, "verifyAudit").mockResolvedValue({
      valid: false,
      events: 0,
      error: `Audit chain mismatch at ${valid.root}/PRIVATE-AUDIT-CREDENTIAL`,
    })
    const auditError = await host.dispatch({
      jsonrpc: "2.0",
      id: 41,
      protocolVersion: 2,
      method: "productStudio.portableDesign.list",
      params: {},
    }).catch((error: unknown) => error)
    expect(auditError).toMatchObject({ code: -32_032, kind: "PORTABLE_DESIGN_AUDIT_INVALID" })
    expect(JSON.stringify(auditError)).not.toContain(valid.root)
    expect(JSON.stringify(auditError)).not.toContain("PRIVATE-AUDIT-CREDENTIAL")
    verifyAudit.mockRestore()

    const candidatePath = host.engine.repository.resolve(
      "candidates",
      `portable-design-${valid.bundleId.toLowerCase()}.json`,
    )
    const persisted = JSON.parse(await readFile(candidatePath, "utf8")) as Record<string, unknown>
    await writeFile(candidatePath, `${JSON.stringify({ ...persisted, title: "TAMPERED-PRIVATE-TITLE" }, null, 2)}\n`)
    const tamperError = await host.dispatch({
      jsonrpc: "2.0",
      id: 42,
      protocolVersion: 2,
      method: "productStudio.portableDesign.read",
      params: { bundleId: valid.bundleId },
    }).catch((error: unknown) => error)
    expect(tamperError).toMatchObject({ code: -32_033, kind: "PORTABLE_DESIGN_INTEGRITY_INVALID" })
    expect(JSON.stringify(tamperError)).not.toContain(candidatePath)
    expect(JSON.stringify(tamperError)).not.toContain("TAMPERED-PRIVATE-TITLE")
  })
})
