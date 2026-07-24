import { isAbsolute } from "node:path"

import type { ProductStudioPage, ProductStudioService } from "@gaep/engine"
import { z, ZodError } from "zod"

import { HostRpcError, invalidParamsError } from "./rpc.js"

export const portableDesignHostMethods = [
  "productStudio.portableDesign.import",
  "productStudio.portableDesign.list",
  "productStudio.portableDesign.read",
] as const

export type PortableDesignHostMethod = typeof portableDesignHostMethods[number]

const requestIdSchema = z.union([z.string().min(1).max(128), z.number().int().safe()])
const protocolVersionSchema = z.number().int().positive().max(1_000).optional()
const actorIdSchema = z.string().trim().min(1).max(256)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:@+-]*$/u, "Actor ID must be a portable human principal")
const localBundleRootSchema = z.string().min(1).max(32_768)
  .refine((value) => !value.includes("\0"), "Bundle root cannot contain NUL")
  .refine((value) => isAbsolute(value), "Bundle root must be an absolute local path")
const productRevisionSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)

export const portableDesignImportParamsSchema = z.object({
  bundleRoot: localBundleRootSchema,
  expectedProductId: z.string().uuid(),
  expectedProductRevision: productRevisionSchema,
  actorId: actorIdSchema,
}).strict()

export const portableDesignListParamsSchema = z.object({
  offset: z.number().int().min(0).max(10_000).default(0),
  limit: z.number().int().min(1).max(200).default(100),
}).strict()

export const portableDesignReadParamsSchema = z.object({
  bundleId: z.string().uuid(),
}).strict()

const envelopeFields = {
  jsonrpc: z.literal("2.0"),
  id: requestIdSchema,
  protocolVersion: protocolVersionSchema,
}

export const portableDesignHostRequestSchema = z.discriminatedUnion("method", [
  z.object({
    ...envelopeFields,
    method: z.literal("productStudio.portableDesign.import"),
    params: portableDesignImportParamsSchema,
  }).strict(),
  z.object({
    ...envelopeFields,
    method: z.literal("productStudio.portableDesign.list"),
    params: portableDesignListParamsSchema,
  }).strict(),
  z.object({
    ...envelopeFields,
    method: z.literal("productStudio.portableDesign.read"),
    params: portableDesignReadParamsSchema,
  }).strict(),
])

export type PortableDesignHostRequest = z.infer<typeof portableDesignHostRequestSchema>

export function isPortableDesignHostMethod(value: string): value is PortableDesignHostMethod {
  return (portableDesignHostMethods as readonly string[]).includes(value)
}

export function parsePortableDesignHostRequest(value: unknown): PortableDesignHostRequest {
  try {
    return portableDesignHostRequestSchema.parse(value)
  } catch (error) {
    if (error instanceof ZodError) throw invalidParamsError(error)
    throw error
  }
}

export type PortableDesignSnapshot = Awaited<ReturnType<ProductStudioService["readPortableDesignSnapshot"]>>

export interface PortableDesignSnapshotDto {
  schemaVersion: 1
  kind: "portable-design-snapshot-summary"
  bundleId: string
  productId: string
  initiativeId?: string
  title: string
  classification: PortableDesignSnapshot["classification"]
  governance: {
    state: "pending-human-review"
    humanReviewRequired: true
    claimBoundary: "import-validation-is-not-design-approval-or-baseline"
    nonEscalation: "not-gaep-approval-design-baseline-implementation-or-release-readiness"
  }
  sourceReview: {
    status: PortableDesignSnapshot["sourceReview"]["status"]
    claimLabel: string
    gaepApproval: false
  }
  source: {
    tool: string
    exportMethod: PortableDesignSnapshot["source"]["exportMethod"]
  }
  counts: {
    artifacts: number
    normalizedDesignTokens: number
    validationChecks: number
    recordedLimitations: number
  }
  digests: {
    snapshot: string
    evidence: string
    manifest: string
    artifactInventory: string
  }
  timestamps: {
    sourceExportedAt: string
    importedAt: string
  }
  privacyBoundary: string
}

export interface PortableDesignSnapshotPageDto {
  items: PortableDesignSnapshotDto[]
  offset: number
  limit: number
  total: number
  hasMore: boolean
  governanceBoundary: string
  privacyBoundary: string
}

function sourceReviewClaimLabel(status: PortableDesignSnapshot["sourceReview"]["status"]): string {
  return `${status} upstream claim; not GAEP approval, a Design Baseline, implementation readiness, or release readiness`
}

export function portableDesignSnapshotDto(snapshot: PortableDesignSnapshot): PortableDesignSnapshotDto {
  return {
    schemaVersion: 1,
    kind: "portable-design-snapshot-summary",
    bundleId: snapshot.bundleId,
    productId: snapshot.productId,
    ...(snapshot.initiativeId ? { initiativeId: snapshot.initiativeId } : {}),
    title: snapshot.title,
    classification: snapshot.classification,
    governance: {
      state: "pending-human-review",
      humanReviewRequired: true,
      claimBoundary: "import-validation-is-not-design-approval-or-baseline",
      nonEscalation: "not-gaep-approval-design-baseline-implementation-or-release-readiness",
    },
    sourceReview: {
      status: snapshot.sourceReview.status,
      claimLabel: sourceReviewClaimLabel(snapshot.sourceReview.status),
      gaepApproval: false,
    },
    source: {
      tool: snapshot.source.tool,
      exportMethod: snapshot.source.exportMethod,
    },
    counts: {
      artifacts: snapshot.artifacts.length,
      normalizedDesignTokens: snapshot.tokens.length,
      validationChecks: snapshot.evidence.checks.length,
      recordedLimitations: snapshot.evidence.limitations.length,
    },
    digests: {
      snapshot: snapshot.snapshotDigest,
      evidence: snapshot.evidence.evidenceDigest,
      manifest: snapshot.evidence.manifestDigest,
      artifactInventory: snapshot.evidence.artifactInventoryDigest,
    },
    timestamps: {
      sourceExportedAt: snapshot.source.exportedAt,
      importedAt: snapshot.evidence.importedAt,
    },
    privacyBoundary: "Validated metadata only; no bundle root, artifact path, token value, source bytes, credentials, OAuth state, or external-account state.",
  }
}

export function portableDesignSnapshotPageDto(
  page: ProductStudioPage<PortableDesignSnapshot>,
): PortableDesignSnapshotPageDto {
  return {
    items: page.items.map(portableDesignSnapshotDto),
    offset: page.offset,
    limit: page.limit,
    total: page.total,
    hasMore: page.hasMore,
    governanceBoundary: "Every item remains pending human review; source review is an upstream claim only.",
    privacyBoundary: "Items contain validated metadata and digests only; local paths and source content are omitted.",
  }
}

export type PortableDesignRpcOperation = "import" | "list" | "read"

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.toLowerCase() : ""
}

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined
  return typeof error.code === "string" ? error.code : undefined
}

export function portableDesignRpcError(operation: PortableDesignRpcOperation, error: unknown): HostRpcError {
  if (error instanceof HostRpcError) return error
  const message = errorMessage(error)
  const code = errorCode(error)
  if (/product.*(?:identity|revision|different|match)|revision.*product|initiative.*product|no product/u.test(message)) {
    return new HostRpcError(
      -32_031,
      "PORTABLE_DESIGN_PRODUCT_CONTEXT_CHANGED",
      "The portable design request does not match the exact current Product or Initiative revision",
    )
  }
  if (/audit/u.test(message)) {
    return new HostRpcError(
      -32_032,
      "PORTABLE_DESIGN_AUDIT_INVALID",
      "GAEP could not verify the governed audit boundary for this portable design request",
    )
  }
  if (operation === "read" && (code === "ENOENT" || /not found|no such file|missing/u.test(message))) {
    return new HostRpcError(
      -32_035,
      "PORTABLE_DESIGN_NOT_FOUND",
      "The requested portable design snapshot does not exist in the current Product",
    )
  }
  if (/already exists|duplicate|collid/u.test(message)) {
    return new HostRpcError(
      -32_034,
      "PORTABLE_DESIGN_CONFLICT",
      "The portable design snapshot identity already exists or conflicts with governed inventory",
    )
  }
  if (operation === "import") {
    return new HostRpcError(
      -32_030,
      "PORTABLE_DESIGN_SOURCE_INVALID",
      "The local portable design bundle did not pass bounded validation",
    )
  }
  return new HostRpcError(
    -32_033,
    "PORTABLE_DESIGN_INTEGRITY_INVALID",
    "GAEP could not verify the portable design snapshot inventory and metadata",
  )
}

export function portableDesignProductContextError(): HostRpcError {
  return new HostRpcError(
    -32_031,
    "PORTABLE_DESIGN_PRODUCT_CONTEXT_CHANGED",
    "The portable design request does not match the exact current Product or Initiative revision",
  )
}
