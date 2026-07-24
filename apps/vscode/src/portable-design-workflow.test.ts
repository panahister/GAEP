import { describe, expect, it, vi } from "vitest"

import {
  PortableDesignWorkflowError,
  runPortableDesignImportWorkflow,
  type PortableDesignFolderSelection,
  type PortableDesignSnapshot,
  type PortableDesignWorkflowContext,
  type PortableDesignWorkflowUi,
} from "./portable-design-workflow.js"

const productId = "11111111-1111-4111-8111-111111111111"
const bundleId = "22222222-2222-4222-8222-222222222222"
const digest = `sha256:${"a".repeat(64)}`
const privateBundlePath = "/Users/example/private/token-ghp_super-secret/local-design"

function importedSnapshot(sourceReviewStatus: "unreviewed" | "reviewed" | "approved" = "unreviewed"): PortableDesignSnapshot {
  return {
    schemaVersion: 1,
    kind: "portable-design-snapshot",
    bundleId,
    productId,
    title: "Checkout design",
    classification: "internal",
    owner: { kind: "human", id: "designer" },
    source: {
      tool: "figma",
      objectId: "source-object",
      revision: "source-r1",
      exportMethod: "manual-export",
      exportedAt: "2026-07-24T00:00:00.000Z",
    },
    sourceReview: sourceReviewStatus === "unreviewed"
      ? { status: "unreviewed" }
      : {
          status: sourceReviewStatus,
          actor: { kind: "human", id: "upstream-reviewer" },
          occurredAt: "2026-07-24T00:01:00.000Z",
          ...(sourceReviewStatus === "approved" ? { evidenceId: "upstream-evidence" } : {}),
        },
    governance: {
      state: "pending-human-review",
      claimBoundary: "import-validation-is-not-design-approval-or-baseline",
    },
    artifacts: [{
      id: "screen-home",
      kind: "screen",
      format: "png",
      path: "private/raw-screen.png",
      mediaType: "image/png",
      sizeBytes: 128,
      digest,
      targets: [],
      validation: "signature-verified",
    }],
    tokens: [],
    snapshotDigest: digest,
    evidence: {
      policy: "gaep-portable-design-import/1",
      importedAt: "2026-07-24T00:02:00.000Z",
      manifestDigest: digest,
      artifactInventoryDigest: digest,
      checks: [
        "manifest-strict-schema",
        "bundle-exact-inventory",
        "paths-contained-and-link-free",
        "sizes-and-digests-exact",
        "text-secret-scan-clear",
        "formats-passively-validated",
      ],
      limitations: ["A successful import remains pending human review and does not establish a Design Baseline."],
      evidenceDigest: digest,
    },
  }
}

interface HarnessOptions {
  trusted?: boolean
  selection?: PortableDesignFolderSelection | undefined
  confirm?: boolean
  productRevisions?: number[]
  importResult?: PortableDesignSnapshot
  importError?: Error
}

function harness(options: HarnessOptions = {}) {
  let productRead = 0
  const readProduct = vi.fn(async () => ({
    id: productId,
    name: "Example Product",
    revision: options.productRevisions?.[productRead++] ?? 3,
  }))
  const importSnapshot = vi.fn(async () => {
    if (options.importError) throw options.importError
    return options.importResult ?? importedSnapshot()
  })
  const context: PortableDesignWorkflowContext = {
    trusted: () => options.trusted ?? true,
    contextGeneration: () => "context_generation_1234567890",
    productRootIdentity: () => "workspace-root-identity",
    actorId: () => "local-actor",
    readProduct,
    importSnapshot,
  }
  const selectLocalBundleFolder = vi.fn(async () => options.selection === undefined
    ? { scheme: "file", path: privateBundlePath, kind: "folder" as const }
    : options.selection)
  const confirmImport = vi.fn(async () => options.confirm ?? true)
  const ui: PortableDesignWorkflowUi = { selectLocalBundleFolder, confirmImport }
  return { context, ui, readProduct, importSnapshot, selectLocalBundleFolder, confirmImport }
}

describe("portable design import workflow", () => {
  it("imports one local folder through the exact Product and revision binding", async () => {
    const { context, ui, importSnapshot, confirmImport } = harness()
    const outcome = await runPortableDesignImportWorkflow(context, ui)

    expect(outcome.status).toBe("imported")
    expect(confirmImport).toHaveBeenCalledWith({ id: productId, name: "Example Product", revision: 3 })
    expect(importSnapshot).toHaveBeenCalledWith({
      bundleRoot: privateBundlePath,
      expectedProductId: productId,
      expectedProductRevision: 3,
    }, "local-actor")
    if (outcome.status !== "imported") throw new Error("Expected imported outcome")
    expect(outcome.announcement).toMatch(/pending-human-review/i)
    expect(outcome.announcement).toMatch(/not GAEP approval.*Design Baseline.*implementation readiness.*release readiness/i)
  })

  it("cancels before mutation when either bounded UI prompt is dismissed", async () => {
    const pickerCancelled = harness({ selection: undefined })
    pickerCancelled.ui.selectLocalBundleFolder = vi.fn(async () => undefined)
    await expect(runPortableDesignImportWorkflow(pickerCancelled.context, pickerCancelled.ui)).resolves.toEqual({ status: "cancelled" })
    expect(pickerCancelled.importSnapshot).not.toHaveBeenCalled()

    const confirmationCancelled = harness({ confirm: false })
    await expect(runPortableDesignImportWorkflow(confirmationCancelled.context, confirmationCancelled.ui)).resolves.toEqual({ status: "cancelled" })
    expect(confirmationCancelled.importSnapshot).not.toHaveBeenCalled()
  })

  it("rejects an untrusted workspace before reading Product state or opening input", async () => {
    const { context, ui, readProduct, importSnapshot, selectLocalBundleFolder } = harness({ trusted: false })
    const error = await runPortableDesignImportWorkflow(context, ui).catch((candidate) => candidate)
    expect(error).toBeInstanceOf(PortableDesignWorkflowError)
    expect(error).toMatchObject({ code: "workspace-untrusted" })
    expect(readProduct).not.toHaveBeenCalled()
    expect(selectLocalBundleFolder).not.toHaveBeenCalled()
    expect(importSnapshot).not.toHaveBeenCalled()
  })

  it("fails closed when Product revision changes while the picker is open", async () => {
    const { context, ui, importSnapshot, confirmImport } = harness({ productRevisions: [3, 4] })
    const error = await runPortableDesignImportWorkflow(context, ui).catch((candidate) => candidate)
    expect(error).toMatchObject({ code: "product-binding-changed" })
    expect(String(error)).toMatch(/identity or revision changed/i)
    expect(confirmImport).not.toHaveBeenCalled()
    expect(importSnapshot).not.toHaveBeenCalled()
  })

  it("sanitizes invalid-source and inventory errors without leaking paths, content, or tokens", async () => {
    const rawSecret = "ghp_super-secret"
    const { context, ui } = harness({
      importError: new Error(`Invalid source at ${privateBundlePath}: raw content ${rawSecret}`),
    })
    const error = await runPortableDesignImportWorkflow(context, ui).catch((candidate) => candidate)
    expect(error).toMatchObject({ code: "invalid-source-or-inventory" })
    expect(String(error)).toMatch(/did not pass bounded validation/i)
    expect(String(error)).not.toContain(privateBundlePath)
    expect(String(error)).not.toContain(rawSecret)
    expect(String(error)).not.toMatch(/raw content/i)
  })

  it("preserves upstream approval only as a non-escalating claim", async () => {
    const { context, ui } = harness({ importResult: importedSnapshot("approved") })
    const outcome = await runPortableDesignImportWorkflow(context, ui)
    if (outcome.status !== "imported") throw new Error("Expected imported outcome")
    expect(outcome.snapshot.sourceReview.status).toBe("approved")
    expect(outcome.snapshot.governance.state).toBe("pending-human-review")
    expect(outcome.announcement).toMatch(/sourceReview value is approved/i)
    expect(outcome.announcement).toMatch(/not GAEP approval/i)
  })

  it("rejects files and non-local schemes without invoking the engine", async () => {
    for (const selection of [
      { scheme: "https", path: "https://design.example/bundle", kind: "folder" as const },
      { scheme: "file", path: "/tmp/design.fig", kind: "file" as never },
      { scheme: "file", path: "relative/private-bundle", kind: "folder" as const },
      { scheme: "file", path: "/tmp/private\0hidden", kind: "folder" as const },
    ]) {
      const { context, ui, importSnapshot } = harness({ selection })
      const error = await runPortableDesignImportWorkflow(context, ui).catch((candidate) => candidate)
      expect(error).toMatchObject({ code: "local-folder-required" })
      expect(String(error)).toMatch(/Files, archives, remote URLs, external accounts, and live design-tool connections are not supported/i)
      expect(String(error)).not.toContain(selection.path)
      expect(importSnapshot).not.toHaveBeenCalled()
    }
  })

  it("does not place the selected path or source payload in the user-facing success message", async () => {
    const rawTokenValue = "private-token-value"
    const snapshot = {
      ...importedSnapshot(),
      tokens: [{ artifactId: "tokens", path: "auth.token", type: "string", value: rawTokenValue, valueDigest: digest }],
    } as PortableDesignSnapshot
    const { context, ui } = harness({ importResult: snapshot })
    const outcome = await runPortableDesignImportWorkflow(context, ui)
    if (outcome.status !== "imported") throw new Error("Expected imported outcome")
    expect(outcome.announcement).not.toContain(privateBundlePath)
    expect(outcome.announcement).not.toContain("private/raw-screen.png")
    expect(outcome.announcement).not.toContain(rawTokenValue)
  })
})
