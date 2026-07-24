import { randomUUID } from "node:crypto"
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import { canonicalDigest } from "@gaep/agent-sdk"
import {
  canonicalDigest as portableDesignDigest,
  importPortableDesignBundle,
  portableDesignImportResultSchema,
  sha256,
  type PortableDesignManifest,
} from "@gaep/design-import"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { GaepEngine } from "./engine.js"
import { ProductStudioService } from "./product-studio.js"

const bundleId = "11111111-1111-4111-8111-111111111111"
const sourceContent = '<svg xmlns="http://www.w3.org/2000/svg"><title>SOURCE_FILE_CONTENT_MUST_NOT_PERSIST</title></svg>'

interface BundleFixtureInput {
  productId: string
  initiativeId?: string
  id?: string
  content?: string
  mutateManifest?: (manifest: PortableDesignManifest) => unknown
}

describe("Product Studio governed Portable Design Snapshots", () => {
  let workspace: string
  let engine: GaepEngine
  let product: Awaited<ReturnType<GaepEngine["createProduct"]>>
  let initiative: Awaited<ReturnType<GaepEngine["createInitiative"]>>
  const fixtureRoots: string[] = []

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "gaep-design-snapshot-engine-"))
    engine = new GaepEngine(workspace, [])
    product = await engine.createProduct({
      name: "Atlas",
      summary: "A governed Portable Design Snapshot test Product.",
      problem: "Portable design evidence needs a local review boundary.",
      affectedUsers: "Product designers and product engineers",
      desiredOutcome: "Validated design metadata remains reviewable without importing source authority.",
      successSignals: ["A pending snapshot remains digest-bound and non-authoritative"],
      firstWorkflow: "Import one portable design bundle for explicit human review.",
      exclusions: ["Automatic Design Baseline approval"],
      profile: "software",
    }, "founder")
    initiative = await engine.createInitiative({
      title: "Review imported design evidence",
      outcome: "A bounded snapshot is available for human review.",
      scope: ["Portable design metadata"],
      exclusions: ["Implementation approval"],
    }, "founder")
  })

  afterEach(async () => {
    await Promise.all([
      rm(workspace, { recursive: true, force: true }),
      ...fixtureRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
    ])
  })

  async function bundle(input: BundleFixtureInput): Promise<{
    base: string
    root: string
    manifest: PortableDesignManifest
  }> {
    const base = await mkdtemp(join(tmpdir(), "gaep-design-snapshot-bundle-"))
    fixtureRoots.push(base)
    const root = join(base, "bundle")
    const artifactPath = "screens/imported.svg"
    const bytes = Buffer.from(input.content ?? sourceContent)
    await mkdir(dirname(join(root, artifactPath)), { recursive: true })
    await writeFile(join(root, artifactPath), bytes)
    const manifest: PortableDesignManifest = {
      schemaVersion: 1,
      kind: "portable-design-bundle",
      id: input.id ?? bundleId,
      productId: input.productId,
      ...(input.initiativeId ? { initiativeId: input.initiativeId } : {}),
      title: "Imported Product Design",
      classification: "internal",
      owner: { kind: "role", id: "product-design-owner" },
      source: {
        tool: "figma",
        objectId: "portable-source-object",
        revision: "export-revision-7",
        exportMethod: "manual-export",
        exportedAt: "2020-01-01T00:00:00.000Z",
      },
      sourceReview: {
        status: "approved",
        actor: { kind: "human", id: "upstream-design-reviewer" },
        occurredAt: "2020-01-01T00:05:00.000Z",
        evidenceId: "UPSTREAM-REVIEW-7",
      },
      artifacts: [{
        id: "screen-imported",
        path: artifactPath,
        kind: "screen",
        format: "svg",
        mediaType: "image/svg+xml",
        sizeBytes: bytes.length,
        digest: sha256(bytes),
        title: "Imported screen",
        targets: [{ kind: "screen", id: "home" }],
      }],
    }
    await writeFile(
      join(root, "gaep-design-import.json"),
      `${JSON.stringify(input.mutateManifest?.(manifest) ?? manifest, null, 2)}\n`,
    )
    return { base, root, manifest }
  }

  function candidatePath(id = bundleId): string {
    return join(workspace, ".gaep", "candidates", `portable-design-${id.toLowerCase()}.json`)
  }

  it("atomically imports, reads, lists, and audits metadata without creating Design authority", async () => {
    const fixture = await bundle({ productId: product.id, initiativeId: initiative.id })
    const auditBefore = await engine.repository.verifyAudit()
    const imported = await engine.productStudio.importPortableDesignSnapshot({
      bundleRoot: fixture.root,
      expectedProductId: product.id,
      expectedProductRevision: product.revision ?? 1,
    }, "founder")

    expect(imported.sourceReview.status).toBe("approved")
    expect(imported.governance).toEqual({
      state: "pending-human-review",
      claimBoundary: "import-validation-is-not-design-approval-or-baseline",
    })
    expect(await engine.productStudio.readPortableDesignSnapshot(bundleId)).toEqual(imported)
    expect(await engine.productStudio.listPortableDesignSnapshots({ limit: 1 })).toEqual({
      items: [imported],
      offset: 0,
      limit: 1,
      total: 1,
      hasMore: false,
    })

    const persisted = await readFile(candidatePath(), "utf8")
    expect(persisted).not.toContain(fixture.root)
    expect(persisted).not.toContain(fixture.base)
    expect(persisted).not.toContain(sourceContent)
    expect(persisted).not.toContain("bundleRoot")
    expect(persisted).not.toMatch(/oauth|access.?token|account.?state/iu)
    expect(portableDesignImportResultSchema.parse(JSON.parse(persisted))).toEqual(imported)

    const currentProduct = await engine.readProduct()
    expect(currentProduct.revision).toBe(product.revision)
    expect(currentProduct.currentDesign).toBeUndefined()
    expect(await engine.productStudio.listDesignRevisions()).toEqual([])
    const audit = await engine.repository.verifyAudit()
    expect(audit).toMatchObject({ valid: true, events: auditBefore.events + 1 })
    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>)
    expect(events.at(-1)).toMatchObject({
      eventType: "product.design.snapshot.imported",
      subjectId: bundleId,
      payload: {
        productId: product.id,
        productRevision: product.revision,
        initiativeId: initiative.id,
        governanceState: "pending-human-review",
        authorityBoundary: "import-validation-is-not-design-approval-or-baseline",
        snapshotDigest: imported.snapshotDigest,
        evidenceDigest: imported.evidence.evidenceDigest,
        recordDigest: canonicalDigest(imported),
      },
    })
  })

  it("keeps persisted metadata readable and verifiable after the source bundle is removed", async () => {
    const fixture = await bundle({ productId: product.id, initiativeId: initiative.id })
    const imported = await engine.productStudio.importPortableDesignSnapshot({
      bundleRoot: fixture.root,
      expectedProductId: product.id,
      expectedProductRevision: product.revision ?? 1,
    }, "founder")
    await rm(fixture.base, { recursive: true, force: true })

    expect(await engine.productStudio.readPortableDesignSnapshot(imported.bundleId)).toEqual(imported)
    expect((await engine.productStudio.listPortableDesignSnapshots()).items).toEqual([imported])
    expect(await engine.repository.verifyAudit()).toMatchObject({ valid: true })
  })

  it("rejects stale revisions and mismatched expected or imported Product identities without mutation", async () => {
    const valid = await bundle({ productId: product.id })
    const foreign = await bundle({ productId: randomUUID(), id: "22222222-2222-4222-8222-222222222222" })
    const before = await engine.repository.verifyAudit()

    await expect(engine.productStudio.importPortableDesignSnapshot({
      bundleRoot: valid.root,
      expectedProductId: product.id,
      expectedProductRevision: (product.revision ?? 1) + 1,
    }, "founder")).rejects.toThrow(/revision conflict/i)
    await expect(engine.productStudio.importPortableDesignSnapshot({
      bundleRoot: valid.root,
      expectedProductId: randomUUID(),
      expectedProductRevision: product.revision ?? 1,
    }, "founder")).rejects.toThrow(/expected Product identity/i)
    await expect(engine.productStudio.importPortableDesignSnapshot({
      bundleRoot: foreign.root,
      expectedProductId: product.id,
      expectedProductRevision: product.revision ?? 1,
    }, "founder")).rejects.toThrow(/Product identity/i)

    expect(await engine.productStudio.listPortableDesignSnapshots()).toMatchObject({ items: [], total: 0 })
    expect((await engine.repository.verifyAudit()).events).toBe(before.events)
  })

  it("rechecks the exact Product revision after source scanning at the final locked boundary", async () => {
    const fixture = await bundle({ productId: product.id })
    let productReads = 0
    const service = new ProductStudioService(
      engine.repository,
      async () => {
        productReads += 1
        return productReads === 1 ? product : {
          ...product,
          revision: (product.revision ?? 1) + 1,
          updatedAt: "2026-07-24T00:10:00.000Z",
        }
      },
      (id) => engine.readInitiative(id),
    )
    const before = await engine.repository.verifyAudit()

    await expect(service.importPortableDesignSnapshot({
      bundleRoot: fixture.root,
      expectedProductId: product.id,
      expectedProductRevision: product.revision ?? 1,
    }, "founder")).rejects.toThrow(/revision conflict/i)
    expect(productReads).toBe(2)
    expect(await readdir(join(workspace, ".gaep", "candidates"))).toEqual([])
    expect((await engine.repository.verifyAudit()).events).toBe(before.events)
  })

  it("rejects an Initiative that does not belong to the exact current Product", async () => {
    const fixture = await bundle({ productId: product.id, initiativeId: initiative.id })
    const foreignInitiative = { ...initiative, productId: randomUUID() }
    const service = new ProductStudioService(
      engine.repository,
      () => engine.readProduct(),
      async () => foreignInitiative,
    )
    const before = await engine.repository.verifyAudit()

    await expect(service.importPortableDesignSnapshot({
      bundleRoot: fixture.root,
      expectedProductId: product.id,
      expectedProductRevision: product.revision ?? 1,
    }, "founder")).rejects.toThrow(/Initiative does not belong/i)
    expect((await engine.repository.verifyAudit()).events).toBe(before.events)
    expect(await engine.productStudio.listPortableDesignSnapshots()).toMatchObject({ items: [], total: 0 })
  })

  it("rejects duplicate and case-colliding bundle identities and enforces bounded list pages", async () => {
    const first = await bundle({ productId: product.id, id: bundleId })
    const colliding = await bundle({ productId: product.id, id: bundleId.toUpperCase() })
    await engine.productStudio.importPortableDesignSnapshot({
      bundleRoot: first.root,
      expectedProductId: product.id,
      expectedProductRevision: product.revision ?? 1,
    }, "founder")
    const afterFirst = await engine.repository.verifyAudit()

    await expect(engine.productStudio.importPortableDesignSnapshot({
      bundleRoot: colliding.root,
      expectedProductId: product.id,
      expectedProductRevision: product.revision ?? 1,
    }, "founder")).rejects.toThrow(/already exists|collides/i)
    await expect(engine.productStudio.listPortableDesignSnapshots({ limit: 201 })).rejects.toThrow(/page limit/i)
    expect((await engine.productStudio.listPortableDesignSnapshots()).total).toBe(1)
    expect((await engine.repository.verifyAudit()).events).toBe(afterFirst.events)
  })

  it("rejects non-canonical uppercase candidate filenames at inventory and governed-audit boundaries", async () => {
    const caseBundleId = "abcdefab-cdef-4abc-8def-abcdefabcdef"
    const fixture = await bundle({ productId: product.id, id: caseBundleId })
    const imported = await importPortableDesignBundle({ bundleRoot: fixture.root })
    const uppercasePath = join(
      workspace,
      ".gaep",
      "candidates",
      `portable-design-${caseBundleId.toUpperCase()}.json`,
    )
    await writeFile(uppercasePath, `${JSON.stringify(imported, null, 2)}\n`)
    await expect(engine.productStudio.listPortableDesignSnapshots()).rejects.toThrow(/canonical lowercase/i)
    await rm(uppercasePath)

    await engine.repository.withLock(async () => engine.repository.commitMutation({
      writes: [{
        path: uppercasePath,
        value: imported,
        schema: portableDesignImportResultSchema,
        governed: true,
      }],
      audit: {
        eventType: "test.portable-design.uppercase-path",
        actor: { kind: "system", id: "test-fixture" },
        subjectId: imported.bundleId,
      },
    }))
    expect(await engine.repository.verifyAudit()).toMatchObject({
      valid: false,
      error: expect.stringMatching(/inventory differs/i),
    })
    await expect(engine.productStudio.listPortableDesignSnapshots()).rejects.toThrow(/integrity/i)
  })

  it("bounds the total candidate directory before filtering unrelated filenames", async () => {
    const readDirectory = engine.repository.readDirectory.bind(engine.repository)
    const oversized = vi.spyOn(engine.repository, "readDirectory").mockImplementation(async (path) =>
      path.endsWith("candidates")
        ? Array.from({ length: 10_001 }, (_, index) => `unrelated-${index}.txt`)
        : readDirectory(path))

    await expect(engine.productStudio.listPortableDesignSnapshots()).rejects.toThrow(/candidate directory.*10,?000/i)
    oversized.mockRestore()

    const fixture = await bundle({ productId: product.id })
    vi.spyOn(engine.repository, "readDirectory").mockImplementation(async (path) =>
      path.endsWith("candidates")
        ? Array.from({ length: 10_000 }, (_, index) => `unrelated-${index}.txt`)
        : readDirectory(path))
    await expect(engine.productStudio.importPortableDesignSnapshot({
      bundleRoot: fixture.root,
      expectedProductId: product.id,
      expectedProductRevision: product.revision ?? 1,
    }, "founder")).rejects.toThrow(/candidate directory.*10,?000/i)
  })

  it("rejects invalid source content before creating a governed record or audit event", async () => {
    const fixture = await bundle({
      productId: product.id,
      content: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    })
    const before = await engine.repository.verifyAudit()

    await expect(engine.productStudio.importPortableDesignSnapshot({
      bundleRoot: fixture.root,
      expectedProductId: product.id,
      expectedProductRevision: product.revision ?? 1,
    }, "founder")).rejects.toThrow(/active or external content/i)
    expect((await engine.repository.verifyAudit()).events).toBe(before.events)
    expect(await engine.productStudio.listPortableDesignSnapshots()).toMatchObject({ items: [], total: 0 })
  })

  it("rejects an explicitly empty manifest path without falling back or mutating governed state", async () => {
    const fixture = await bundle({ productId: product.id })
    const before = await engine.repository.verifyAudit()

    await expect(engine.productStudio.importPortableDesignSnapshot({
      bundleRoot: fixture.root,
      manifestPath: "",
      expectedProductId: product.id,
      expectedProductRevision: product.revision ?? 1,
    }, "founder")).rejects.toThrow(/manifest path/i)
    expect(await readdir(join(workspace, ".gaep", "candidates"))).toEqual([])
    expect((await engine.repository.verifyAudit()).events).toBe(before.events)
  })

  it("rejects raw schema tampering and schema-valid governed record drift", async () => {
    const fixture = await bundle({ productId: product.id })
    await engine.productStudio.importPortableDesignSnapshot({
      bundleRoot: fixture.root,
      expectedProductId: product.id,
      expectedProductRevision: product.revision ?? 1,
    }, "founder")
    const path = candidatePath()
    const original = await readFile(path, "utf8")
    const parsed = JSON.parse(original) as Record<string, unknown>

    await writeFile(path, `${JSON.stringify({ ...parsed, governance: { state: "approved" } }, null, 2)}\n`)
    await expect(engine.productStudio.readPortableDesignSnapshot(bundleId)).rejects.toThrow(/invalid|integrity|literal/i)
    await writeFile(path, original)
    expect(await engine.repository.verifyAudit()).toMatchObject({ valid: true })

    await writeFile(path, `${JSON.stringify({ ...parsed, title: "Schema-valid drift" }, null, 2)}\n`)
    await expect(engine.productStudio.readPortableDesignSnapshot(bundleId)).rejects.toThrow(/integrity|digest/i)
    expect(await engine.repository.verifyAudit()).toMatchObject({ valid: false })
  })

  it("rejects internally inconsistent metadata even when a low-level governed write has a valid audit", async () => {
    const fixture = await bundle({ productId: product.id })
    const imported = await engine.productStudio.importPortableDesignSnapshot({
      bundleRoot: fixture.root,
      expectedProductId: product.id,
      expectedProductRevision: product.revision ?? 1,
    }, "founder")
    const inconsistent = portableDesignImportResultSchema.parse({
      ...imported,
      snapshotDigest: `sha256:${"0".repeat(64)}`,
    })
    await engine.repository.withLock(async () => engine.repository.commitMutation({
      writes: [{
        path: candidatePath(),
        value: inconsistent,
        schema: portableDesignImportResultSchema,
        governed: true,
      }],
      audit: {
        eventType: "test.portable-design.internal-drift",
        actor: { kind: "system", id: "test-fixture" },
        subjectId: imported.bundleId,
      },
    }))

    expect(await engine.repository.verifyAudit()).toMatchObject({ valid: true })
    await expect(engine.productStudio.readPortableDesignSnapshot(imported.bundleId))
      .rejects.toThrow(/canonical snapshot digest/i)
    await expect(engine.productStudio.listPortableDesignSnapshots())
      .rejects.toThrow(/canonical snapshot digest/i)
  })

  it("rejects re-digested import-time and limitation drift behind a valid low-level audit", async () => {
    const fixture = await bundle({ productId: product.id })
    const imported = await engine.productStudio.importPortableDesignSnapshot({
      bundleRoot: fixture.root,
      expectedProductId: product.id,
      expectedProductRevision: product.revision ?? 1,
    }, "founder")
    const commitEvidence = async (
      evidenceBody: Omit<typeof imported.evidence, "evidenceDigest">,
      eventType: string,
    ): Promise<void> => {
      const drifted = portableDesignImportResultSchema.parse({
        ...imported,
        evidence: {
          ...evidenceBody,
          evidenceDigest: portableDesignDigest({ snapshotDigest: imported.snapshotDigest, ...evidenceBody }),
        },
      })
      await engine.repository.withLock(async () => engine.repository.commitMutation({
        writes: [{
          path: candidatePath(),
          value: drifted,
          schema: portableDesignImportResultSchema,
          governed: true,
        }],
        audit: {
          eventType,
          actor: { kind: "system", id: "test-fixture" },
          subjectId: imported.bundleId,
        },
      }))
      expect(await engine.repository.verifyAudit()).toMatchObject({ valid: true })
    }

    const { evidenceDigest: _timeDigest, ...timeEvidence } = imported.evidence
    await commitEvidence({ ...timeEvidence, importedAt: "2019-12-31T23:59:59.000Z" }, "test.portable-design.time-drift")
    await expect(engine.productStudio.readPortableDesignSnapshot(imported.bundleId)).rejects.toThrow(/predates/i)

    const { evidenceDigest: _limitationDigest, ...limitationEvidence } = imported.evidence
    await commitEvidence({
      ...limitationEvidence,
      limitations: ["Schema-valid but non-canonical limitation inventory."],
    }, "test.portable-design.limitation-drift")
    await expect(engine.productStudio.readPortableDesignSnapshot(imported.bundleId)).rejects.toThrow(/limitation inventory/i)
  })
})
