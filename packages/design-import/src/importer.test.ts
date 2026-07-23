import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { tmpdir } from "node:os"

import { afterEach, describe, expect, it } from "vitest"

import {
  PortableDesignImportError,
  importPortableDesignBundle,
  parseStrictJson,
  sha256,
  type PortableDesignArtifact,
  type PortableDesignManifest,
} from "./index.js"

interface FixtureArtifact {
  readonly id: string
  readonly path: string
  readonly kind: PortableDesignArtifact["kind"]
  readonly format: PortableDesignArtifact["format"]
  readonly mediaType: string
  readonly bytes: Buffer
}

const roots: string[] = []
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function fixture(
  artifacts: readonly FixtureArtifact[],
  mutateManifest?: (manifest: PortableDesignManifest) => unknown,
): Promise<{ base: string; root: string; manifest: PortableDesignManifest }> {
  const base = await mkdtemp(join(tmpdir(), "gaep-design-import-test-"))
  roots.push(base)
  const root = join(base, "bundle")
  await mkdir(root)
  for (const artifact of artifacts) {
    const target = join(root, ...artifact.path.split("/"))
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, artifact.bytes)
  }
  const manifest: PortableDesignManifest = {
    schemaVersion: 1,
    kind: "portable-design-bundle",
    id: "11111111-1111-4111-8111-111111111111",
    productId: "22222222-2222-4222-8222-222222222222",
    initiativeId: "33333333-3333-4333-8333-333333333333",
    title: "Portable design export",
    classification: "internal",
    owner: { kind: "role", id: "product-design-owner" },
    source: {
      tool: "figma",
      objectId: "figma-file-123",
      revision: "revision-7",
      exportMethod: "manual-export",
      exportedAt: "2020-01-01T00:00:00.000Z",
    },
    sourceReview: { status: "unreviewed" },
    artifacts: artifacts.map((artifact) => ({
      id: artifact.id,
      path: artifact.path,
      kind: artifact.kind,
      format: artifact.format,
      mediaType: artifact.mediaType,
      sizeBytes: artifact.bytes.length,
      digest: sha256(artifact.bytes),
      targets: [],
    })),
  }
  const body = mutateManifest?.(manifest) ?? manifest
  await writeFile(join(root, "gaep-design-import.json"), `${JSON.stringify(body, null, 2)}\n`)
  return { base, root, manifest }
}

function expectCode(error: unknown, code: PortableDesignImportError["code"]): void {
  expect(error).toBeInstanceOf(PortableDesignImportError)
  expect((error as PortableDesignImportError).code).toBe(code)
}

describe("portable design import", () => {
  it("imports exact portable assets and normalizes design tokens without claiming approval", async () => {
    const tokenBytes = Buffer.from(JSON.stringify({
      $schema: "https://design-tokens.org/schema.json",
      color: {
        $type: "color",
        brand: { $value: "#123456", $description: "Primary brand color" },
      },
      spacing: {
        $type: "dimension",
        small: { $value: { value: 4, unit: "px" } },
      },
    }))
    const { root } = await fixture([
      { id: "screen-home", path: "screens/home.png", kind: "screen", format: "png", mediaType: "image/png", bytes: png },
      {
        id: "core-tokens",
        path: "tokens/core.json",
        kind: "tokens",
        format: "design-tokens-json",
        mediaType: "application/design-tokens+json",
        bytes: tokenBytes,
      },
    ])

    const imported = await importPortableDesignBundle({ bundleRoot: root, importedAt: "2026-07-24T09:00:00.000Z" })
    const repeated = await importPortableDesignBundle({ bundleRoot: root, importedAt: "2026-07-24T10:00:00.000Z" })

    expect(imported.governance).toEqual({
      state: "pending-human-review",
      claimBoundary: "import-validation-is-not-design-approval-or-baseline",
    })
    expect(imported.artifacts.map((artifact) => artifact.validation)).toEqual(["signature-verified", "tokens-normalized"])
    expect(imported.tokens.map((token) => [token.path, token.type])).toEqual([
      ["color.brand", "color"],
      ["spacing.small", "dimension"],
    ])
    expect(imported.snapshotDigest).toBe(repeated.snapshotDigest)
    expect(imported.evidence.evidenceDigest).not.toBe(repeated.evidence.evidenceDigest)
    expect(JSON.stringify(imported)).not.toContain(root)
  })

  it("rejects proprietary .fig inputs at the strict manifest boundary", async () => {
    const { root } = await fixture([
      { id: "native-file", path: "design.fig", kind: "reference", format: "png", mediaType: "image/png", bytes: png },
    ])

    const error = await importPortableDesignBundle({ bundleRoot: root }).catch((cause: unknown) => cause)
    expectCode(error, "invalid-manifest")
  })

  it("signature-checks every supported binary snapshot format", async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00, 0xff, 0xd9])
    const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0x01, 0x00, 0x00, 0x00]), Buffer.from("WEBP"), Buffer.from([0x00])])
    const pdf = Buffer.from("%PDF-1.7\n%%EOF")
    const { root } = await fixture([
      { id: "preview-png", path: "preview.png", kind: "preview", format: "png", mediaType: "image/png", bytes: png },
      { id: "preview-jpeg", path: "preview.jpg", kind: "preview", format: "jpeg", mediaType: "image/jpeg", bytes: jpeg },
      { id: "preview-webp", path: "preview.webp", kind: "preview", format: "webp", mediaType: "image/webp", bytes: webp },
      { id: "reference-pdf", path: "reference.pdf", kind: "reference", format: "pdf", mediaType: "application/pdf", bytes: pdf },
    ])

    const imported = await importPortableDesignBundle({ bundleRoot: root })
    expect(imported.artifacts).toHaveLength(4)
    expect(imported.artifacts.every((artifact) => artifact.validation === "signature-verified")).toBe(true)
  })

  it("screens passive SVG and preserves source approval only as an unverified claim", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="16" height="16" /></svg>')
    const { root } = await fixture([{
      id: "icon-check",
      path: "icons/check.svg",
      kind: "asset",
      format: "svg",
      mediaType: "image/svg+xml",
      bytes: svg,
    }], (manifest) => ({
      ...manifest,
      sourceReview: {
        status: "approved",
        actor: { kind: "human", id: "design-approver" },
        occurredAt: "2026-07-24T08:30:00.000Z",
        evidenceId: "APR-DESIGN-7",
      },
    }))

    const imported = await importPortableDesignBundle({ bundleRoot: root, importedAt: "2026-07-24T09:00:00.000Z" })
    expect(imported.sourceReview.status).toBe("approved")
    expect(imported.artifacts[0]?.validation).toBe("passive-svg-screened")
    expect(imported.governance.state).toBe("pending-human-review")
  })

  it("rejects path traversal before touching artifact paths", async () => {
    const { root } = await fixture([
      { id: "screen-home", path: "home.png", kind: "screen", format: "png", mediaType: "image/png", bytes: png },
    ], (manifest) => ({
      ...manifest,
      artifacts: [{ ...manifest.artifacts[0], path: "../outside.png" }],
    }))

    const error = await importPortableDesignBundle({ bundleRoot: root }).catch((cause: unknown) => cause)
    expectCode(error, "invalid-manifest")
  })

  it("rejects secret-shaped values in design token documents", async () => {
    const tokenBytes = Buffer.from(JSON.stringify({
      unsafe: { $value: "api_key=abcdefghijklmnopqrstuvwxyz123456" },
    }))
    const { root } = await fixture([{
      id: "core-tokens",
      path: "tokens.json",
      kind: "tokens",
      format: "design-tokens-json",
      mediaType: "application/design-tokens+json",
      bytes: tokenBytes,
    }])

    const error = await importPortableDesignBundle({ bundleRoot: root }).catch((cause: unknown) => cause)
    expectCode(error, "secret-shaped-content")
  })

  it("rejects active or externally linked SVG rather than rendering it", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
    const { root } = await fixture([{
      id: "unsafe-svg",
      path: "unsafe.svg",
      kind: "asset",
      format: "svg",
      mediaType: "image/svg+xml",
      bytes: svg,
    }])

    const error = await importPortableDesignBundle({ bundleRoot: root }).catch((cause: unknown) => cause)
    expectCode(error, "unsupported-content")
  })

  it("rejects digest drift and undeclared files", async () => {
    const changed = await fixture([
      { id: "screen-home", path: "home.png", kind: "screen", format: "png", mediaType: "image/png", bytes: png },
    ])
    const changedBytes = Buffer.from(png)
    changedBytes[changedBytes.length - 1] = 0x01
    await writeFile(join(changed.root, "home.png"), changedBytes)
    const drift = await importPortableDesignBundle({ bundleRoot: changed.root }).catch((cause: unknown) => cause)
    expectCode(drift, "digest-mismatch")

    const extra = await fixture([
      { id: "screen-home", path: "home.png", kind: "screen", format: "png", mediaType: "image/png", bytes: png },
    ])
    await writeFile(join(extra.root, "undeclared.txt"), "not in the manifest")
    const inventory = await importPortableDesignBundle({ bundleRoot: extra.root }).catch((cause: unknown) => cause)
    expectCode(inventory, "unexpected-inventory")
  })

  it("rejects symbolic links in the exact bundle inventory", async () => {
    const created = await fixture([
      { id: "screen-home", path: "home.png", kind: "screen", format: "png", mediaType: "image/png", bytes: png },
    ])
    const outside = join(created.base, "outside.png")
    await writeFile(outside, png)
    await rm(join(created.root, "home.png"))
    await symlink(outside, join(created.root, "home.png"))

    const error = await importPortableDesignBundle({ bundleRoot: created.root }).catch((cause: unknown) => cause)
    expectCode(error, "unsafe-path")
  })
})

describe("strict design JSON", () => {
  it("rejects duplicate keys and reserved prototype keys", () => {
    expect(() => parseStrictJson('{"color":1,"color":2}')).toThrow(/Duplicate object keys/u)
    expect(() => parseStrictJson('{"__proto__":{"polluted":true}}')).toThrow(/Reserved object keys/u)
    expect(() => parseStrictJson('{"invalid":"\\ud800"}')).toThrow(/unpaired surrogates/u)
  })

  it("parses an emitted manifest without accepting ambiguous JSON semantics", async () => {
    const { root } = await fixture([
      { id: "screen-home", path: "home.png", kind: "screen", format: "png", mediaType: "image/png", bytes: png },
    ])
    const manifest = await readFile(join(root, "gaep-design-import.json"), "utf8")
    expect(parseStrictJson(manifest)).toMatchObject({ kind: "portable-design-bundle" })
  })

  it("allows callers to tighten but never relax parser security ceilings", () => {
    expect(parseStrictJson('["ok"]', { maxNodes: 2, maxStringLength: 2 })).toEqual(["ok"])
    expect(() => parseStrictJson('["too-long"]', { maxStringLength: 2 })).toThrow(/string exceeds/u)
    expect(() => parseStrictJson("[]", { maxNodes: 100_001 })).toThrow(/hard maximum/u)
    expect(() => parseStrictJson("[]", { maxInputLength: 8 * 1024 * 1024 + 1 })).toThrow(/hard maximum/u)
    expect(() => parseStrictJson("[]", { maxDepth: Number.NaN })).toThrow(/hard maximum/u)
  })
})
