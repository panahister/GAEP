import { isAbsolute } from "node:path"

import type { ProductStudioService } from "@gaep/engine"

export type PortableDesignSnapshot = Awaited<ReturnType<ProductStudioService["importPortableDesignSnapshot"]>>
export type PortableDesignSnapshotImportInput = Parameters<ProductStudioService["importPortableDesignSnapshot"]>[0]

export interface PortableDesignFolderSelection {
  scheme: string
  path: string
  kind: "folder"
}

export interface PortableDesignProductBinding {
  id: string
  name: string
  revision: number
}

export interface PortableDesignWorkflowContext {
  trusted(): boolean
  contextGeneration(): string
  productRootIdentity(): string | undefined
  actorId(): string
  readProduct(): Promise<{ id: string; name: string; revision?: number }>
  importSnapshot(input: PortableDesignSnapshotImportInput, actorId: string): Promise<PortableDesignSnapshot>
}

export interface PortableDesignWorkflowUi {
  selectLocalBundleFolder(): Promise<PortableDesignFolderSelection | undefined>
  confirmImport(binding: PortableDesignProductBinding): Promise<boolean>
}

export type PortableDesignWorkflowOutcome =
  | { status: "cancelled" }
  | { status: "imported"; snapshot: PortableDesignSnapshot; announcement: string }

export type PortableDesignWorkflowErrorCode =
  | "workspace-untrusted"
  | "product-root-unavailable"
  | "context-changed"
  | "product-binding-changed"
  | "local-folder-required"
  | "invalid-source-or-inventory"
  | "invalid-engine-result"

export class PortableDesignWorkflowError extends Error {
  override readonly name = "PortableDesignWorkflowError"

  constructor(
    readonly code: PortableDesignWorkflowErrorCode,
    message: string,
  ) {
    super(message)
  }
}

const expectedGovernanceState = "pending-human-review" as const
const expectedClaimBoundary = "import-validation-is-not-design-approval-or-baseline" as const
const maximumLocalPathLength = 32_768

function currentRevision(product: { revision?: number }): number {
  const revision = product.revision ?? 1
  if (!Number.isInteger(revision) || revision < 1) {
    throw new PortableDesignWorkflowError(
      "product-binding-changed",
      "GAEP could not bind the import to an exact current Product revision. Refresh Product Studio and try again.",
    )
  }
  return revision
}

async function readInitialBinding(context: PortableDesignWorkflowContext): Promise<PortableDesignProductBinding> {
  try {
    const product = await context.readProduct()
    return { id: product.id, name: product.name, revision: currentRevision(product) }
  } catch (error) {
    if (error instanceof PortableDesignWorkflowError) throw error
    throw new PortableDesignWorkflowError(
      "product-binding-changed",
      "GAEP could not verify the exact current Product before import. No portable design snapshot was imported.",
    )
  }
}

async function assertExactContext(
  context: PortableDesignWorkflowContext,
  expectedContextGeneration: string,
  expectedRootIdentity: string,
  expectedProduct: PortableDesignProductBinding,
): Promise<void> {
  if (!context.trusted()) {
    throw new PortableDesignWorkflowError(
      "workspace-untrusted",
      "Trust this workspace before importing a local portable design bundle. No Product state was inspected or changed.",
    )
  }
  if (context.contextGeneration() !== expectedContextGeneration || context.productRootIdentity() !== expectedRootIdentity) {
    throw new PortableDesignWorkflowError(
      "context-changed",
      "The Product root or trust context changed while the local import was open. No portable design snapshot was imported.",
    )
  }
  let current: { id: string; name: string; revision?: number }
  try {
    current = await context.readProduct()
  } catch {
    throw new PortableDesignWorkflowError(
      "product-binding-changed",
      "GAEP could not reverify the exact current Product. No portable design snapshot was imported.",
    )
  }
  if (current.id.toLowerCase() !== expectedProduct.id.toLowerCase() || currentRevision(current) !== expectedProduct.revision) {
    throw new PortableDesignWorkflowError(
      "product-binding-changed",
      "The Product identity or revision changed while the local import was open. Refresh Product Studio before trying again.",
    )
  }
}

function sanitizedImportError(error: unknown): PortableDesignWorkflowError {
  if (error instanceof PortableDesignWorkflowError) return error
  const message = error instanceof Error ? error.message.toLowerCase() : ""
  if (/workspace.*trust|trust context|product root.*changed/u.test(message)) {
    return new PortableDesignWorkflowError(
      "context-changed",
      "The Product root or trust context changed before the import could complete. Review the current Product before continuing.",
    )
  }
  if (/product.*(?:identity|revision|different|match)|revision.*product|initiative.*product/u.test(message)) {
    return new PortableDesignWorkflowError(
      "product-binding-changed",
      "The selected bundle does not match the exact current Product or Initiative, or the Product revision changed. No new snapshot was saved.",
    )
  }
  return new PortableDesignWorkflowError(
    "invalid-source-or-inventory",
    "The selected local portable design bundle or governed snapshot inventory did not pass bounded validation. No new snapshot was saved.",
  )
}

export function portableDesignImportAnnouncement(snapshot: PortableDesignSnapshot): string {
  return [
    `Imported one local portable design snapshot as ${snapshot.governance.state} with ${snapshot.artifacts.length} validated artifact${snapshot.artifacts.length === 1 ? "" : "s"}.`,
    `The upstream sourceReview value is ${snapshot.sourceReview.status}; it is not GAEP approval, a Design Baseline, implementation readiness, or release readiness.`,
    "Only validated privacy-safe metadata and digests were saved; local bundle paths, source bytes, external-account state, and access tokens were not persisted.",
  ].join(" ")
}

export async function runPortableDesignImportWorkflow(
  context: PortableDesignWorkflowContext,
  ui: PortableDesignWorkflowUi,
): Promise<PortableDesignWorkflowOutcome> {
  if (!context.trusted()) {
    throw new PortableDesignWorkflowError(
      "workspace-untrusted",
      "Trust this workspace before importing a local portable design bundle. No Product state was inspected or changed.",
    )
  }
  const rootIdentity = context.productRootIdentity()
  if (!rootIdentity) {
    throw new PortableDesignWorkflowError(
      "product-root-unavailable",
      "Select the workspace folder that owns this GAEP Product before importing a local design bundle.",
    )
  }
  const contextGeneration = context.contextGeneration()
  const product = await readInitialBinding(context)
  const selected = await ui.selectLocalBundleFolder()
  if (!selected) return { status: "cancelled" }
  if (selected.kind !== "folder" || selected.scheme !== "file" || !selected.path.trim() ||
    selected.path.length > maximumLocalPathLength || selected.path.includes("\0") || !isAbsolute(selected.path)) {
    throw new PortableDesignWorkflowError(
      "local-folder-required",
      "Select one local portable design bundle folder. Files, archives, remote URLs, external accounts, and live design-tool connections are not supported.",
    )
  }
  await assertExactContext(context, contextGeneration, rootIdentity, product)
  if (!await ui.confirmImport(product)) return { status: "cancelled" }
  await assertExactContext(context, contextGeneration, rootIdentity, product)

  let snapshot: PortableDesignSnapshot
  try {
    snapshot = await context.importSnapshot({
      bundleRoot: selected.path,
      expectedProductId: product.id,
      expectedProductRevision: product.revision,
    }, context.actorId())
  } catch (error) {
    throw sanitizedImportError(error)
  }
  if (snapshot.productId.toLowerCase() !== product.id.toLowerCase() ||
    snapshot.governance.state !== expectedGovernanceState ||
    snapshot.governance.claimBoundary !== expectedClaimBoundary) {
    throw new PortableDesignWorkflowError(
      "invalid-engine-result",
      "GAEP withheld the imported snapshot result because its Product binding or governance boundary was invalid. Review diagnostics before continuing.",
    )
  }
  return { status: "imported", snapshot, announcement: portableDesignImportAnnouncement(snapshot) }
}
