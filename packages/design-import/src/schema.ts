import { workspaceRelativePathSchema } from "@gaep/contracts"
import { z } from "zod"

export const PORTABLE_DESIGN_IMPORT_POLICY = "gaep-portable-design-import/1" as const
export const MAX_PORTABLE_DESIGN_ARTIFACTS = 512
export const MAX_PORTABLE_DESIGN_FILE_BYTES = 64 * 1024 * 1024
export const MAX_PORTABLE_DESIGN_TOTAL_BYTES = 256 * 1024 * 1024
export const MAX_PORTABLE_DESIGN_TOKENS = 5_000

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/u)
const portableIdentifierSchema = z.string().trim().min(1).max(256).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u)
const portablePrincipalSchema = z.string().trim().min(1).max(256).regex(/^[A-Za-z0-9][A-Za-z0-9._:@+-]*$/u)
const shortTextSchema = z.string().trim().min(1).max(2_000)
const windowsReservedName = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu

function isPortableBundlePath(value: string): boolean {
  if (value === "." || value.length > 512 || !/^[\x20-\x7e]+$/u.test(value)) return false
  return value.split("/").every((segment) =>
    segment.length <= 120 &&
    /^[A-Za-z0-9][A-Za-z0-9._@+ ()-]*$/u.test(segment) &&
    !segment.endsWith(".") &&
    !segment.endsWith(" ") &&
    !windowsReservedName.test(segment),
  )
}

export const portableDesignBundlePathSchema = workspaceRelativePathSchema.refine(
  isPortableBundlePath,
  "Design bundle paths must be portable ASCII paths without reserved or ambiguous segments",
)

export const portableDesignFormatSchema = z.enum([
  "png",
  "jpeg",
  "webp",
  "svg",
  "pdf",
  "design-tokens-json",
])

export const portableDesignArtifactKindSchema = z.enum([
  "screen",
  "component",
  "preview",
  "asset",
  "reference",
  "tokens",
])

const mediaTypeByFormat = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  "design-tokens-json": "application/design-tokens+json",
} as const

const extensionsByFormat: Readonly<Record<z.infer<typeof portableDesignFormatSchema>, readonly string[]>> = {
  png: [".png"],
  jpeg: [".jpg", ".jpeg"],
  webp: [".webp"],
  svg: [".svg"],
  pdf: [".pdf"],
  "design-tokens-json": [".json"],
}

const portableDesignTargetSchema = z.object({
  kind: z.enum(["requirement", "screen", "component", "route", "work-item"]),
  id: portableIdentifierSchema,
}).strict()

export const portableDesignArtifactSchema = z.object({
  id: portableIdentifierSchema,
  path: portableDesignBundlePathSchema,
  kind: portableDesignArtifactKindSchema,
  format: portableDesignFormatSchema,
  mediaType: z.string().trim().min(1).max(128),
  sizeBytes: z.number().int().positive().max(MAX_PORTABLE_DESIGN_FILE_BYTES),
  digest: digestSchema,
  title: z.string().trim().min(1).max(240).optional(),
  targets: z.array(portableDesignTargetSchema).max(128),
}).strict().superRefine((artifact, context) => {
  const path = artifact.path.toLowerCase()
  if (!extensionsByFormat[artifact.format].some((extension) => path.endsWith(extension))) {
    context.addIssue({ code: "custom", path: ["path"], message: `Path extension does not match ${artifact.format}` })
  }
  if (artifact.mediaType !== mediaTypeByFormat[artifact.format]) {
    context.addIssue({ code: "custom", path: ["mediaType"], message: `Media type does not match ${artifact.format}` })
  }
  if ((artifact.kind === "tokens") !== (artifact.format === "design-tokens-json")) {
    context.addIssue({
      code: "custom",
      path: ["kind"],
      message: "Token artifacts must use the design-tokens-json format, and that format is reserved for token artifacts",
    })
  }
  const targets = artifact.targets.map((target) => `${target.kind}:${target.id.toLowerCase()}`)
  if (new Set(targets).size !== targets.length) {
    context.addIssue({ code: "custom", path: ["targets"], message: "Artifact targets must be unique" })
  }
})

const sourceReviewSchema = z.object({
  status: z.enum(["unreviewed", "reviewed", "approved"]),
  actor: z.object({ kind: z.literal("human"), id: portablePrincipalSchema }).strict().optional(),
  occurredAt: z.string().datetime().optional(),
  evidenceId: portableIdentifierSchema.optional(),
}).strict().superRefine((review, context) => {
  const hasReviewMetadata = Boolean(review.actor || review.occurredAt || review.evidenceId)
  if (review.status === "unreviewed" && hasReviewMetadata) {
    context.addIssue({ code: "custom", message: "Unreviewed source bundles cannot carry review metadata" })
  }
  if (review.status !== "unreviewed" && (!review.actor || !review.occurredAt)) {
    context.addIssue({ code: "custom", message: "Reviewed source bundles require a human actor and review time" })
  }
  if (review.status === "approved" && !review.evidenceId) {
    context.addIssue({ code: "custom", path: ["evidenceId"], message: "Source approval claims require an evidence identifier" })
  }
})

export const portableDesignManifestSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("portable-design-bundle"),
  id: z.string().uuid(),
  productId: z.string().uuid(),
  initiativeId: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(240),
  classification: z.enum(["public", "internal", "confidential", "restricted"]),
  owner: z.object({ kind: z.enum(["human", "role"]), id: portablePrincipalSchema }).strict(),
  source: z.object({
    tool: z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u).max(80),
    objectId: portableIdentifierSchema,
    revision: portableIdentifierSchema,
    exportMethod: z.enum(["manual-export", "design-tool-export", "plugin-export"]),
    exportedAt: z.string().datetime(),
  }).strict(),
  sourceReview: sourceReviewSchema,
  artifacts: z.array(portableDesignArtifactSchema).min(1).max(MAX_PORTABLE_DESIGN_ARTIFACTS),
}).strict().superRefine((manifest, context) => {
  const artifactIds = manifest.artifacts.map((artifact) => artifact.id.toLowerCase())
  if (new Set(artifactIds).size !== artifactIds.length) {
    context.addIssue({ code: "custom", path: ["artifacts"], message: "Artifact IDs must be case-insensitively unique" })
  }
  const artifactPaths = manifest.artifacts.map((artifact) => artifact.path.toLowerCase())
  if (new Set(artifactPaths).size !== artifactPaths.length) {
    context.addIssue({ code: "custom", path: ["artifacts"], message: "Artifact paths must be case-insensitively unique" })
  }
  const totalBytes = manifest.artifacts.reduce((total, artifact) => total + artifact.sizeBytes, 0)
  if (totalBytes > MAX_PORTABLE_DESIGN_TOTAL_BYTES) {
    context.addIssue({ code: "custom", path: ["artifacts"], message: "Declared bundle size exceeds the hard import limit" })
  }
})

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.null(),
  z.boolean(),
  z.number().finite(),
  z.string().max(50_000),
  z.array(jsonValueSchema).max(2_048),
  z.record(z.string().max(256), jsonValueSchema),
]))

export const normalizedDesignTokenSchema = z.object({
  artifactId: portableIdentifierSchema,
  path: z.string().regex(/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/u).max(512),
  type: z.string().regex(/^[a-z][a-z0-9-]*$/u).max(80),
  value: jsonValueSchema,
  valueDigest: digestSchema,
  description: z.string().trim().min(1).max(2_000).optional(),
}).strict()

export const importedPortableDesignArtifactSchema = portableDesignArtifactSchema.extend({
  validation: z.enum(["signature-verified", "passive-svg-screened", "tokens-normalized"]),
}).strict()

export const portableDesignImportResultSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("portable-design-snapshot"),
  bundleId: z.string().uuid(),
  productId: z.string().uuid(),
  initiativeId: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(240),
  classification: z.enum(["public", "internal", "confidential", "restricted"]),
  owner: z.object({ kind: z.enum(["human", "role"]), id: portablePrincipalSchema }).strict(),
  source: portableDesignManifestSchema.shape.source,
  sourceReview: sourceReviewSchema,
  governance: z.object({
    state: z.literal("pending-human-review"),
    claimBoundary: z.literal("import-validation-is-not-design-approval-or-baseline"),
  }).strict(),
  artifacts: z.array(importedPortableDesignArtifactSchema).min(1).max(MAX_PORTABLE_DESIGN_ARTIFACTS),
  tokens: z.array(normalizedDesignTokenSchema).max(MAX_PORTABLE_DESIGN_TOKENS),
  snapshotDigest: digestSchema,
  evidence: z.object({
    policy: z.literal(PORTABLE_DESIGN_IMPORT_POLICY),
    importedAt: z.string().datetime(),
    manifestDigest: digestSchema,
    artifactInventoryDigest: digestSchema,
    checks: z.array(z.enum([
      "manifest-strict-schema",
      "bundle-exact-inventory",
      "paths-contained-and-link-free",
      "sizes-and-digests-exact",
      "text-secret-scan-clear",
      "formats-passively-validated",
    ])).length(6),
    limitations: z.array(shortTextSchema).min(1).max(32),
    evidenceDigest: digestSchema,
  }).strict(),
}).strict()

export type PortableDesignManifest = z.infer<typeof portableDesignManifestSchema>
export type PortableDesignArtifact = z.infer<typeof portableDesignArtifactSchema>
export type NormalizedDesignToken = z.infer<typeof normalizedDesignTokenSchema>
export type PortableDesignImportResult = z.infer<typeof portableDesignImportResultSchema>
