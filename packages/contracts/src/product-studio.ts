import { z } from "zod"

import { effectDescriptorSchema } from "./execution.js"
import { productSchema } from "./product.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
const shortTextSchema = z.string().trim().min(1).max(2_000)
const longTextSchema = z.string().trim().min(1).max(20_000)
const stringListSchema = z.array(shortTextSchema).max(512)

const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\b(?:password|passwd|api[_-]?key|access[_-]?key|secret[_-]?access[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)\s*[:=]\s*["']?[^\s,;"']{20,}["']?/i,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bAIza[0-9A-Za-z_-]{35}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bglpat-[A-Za-z0-9_-]{20,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
  /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bBearer\s+[A-Za-z0-9._~+\/-]{20,}={0,2}\b/i,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
]

export function containsSecretShapedValue(value: unknown): boolean {
  if (typeof value === "string") return secretPatterns.some((pattern) => pattern.test(value))
  if (Array.isArray(value)) return value.some(containsSecretShapedValue)
  if (value && typeof value === "object") return Object.values(value).some(containsSecretShapedValue)
  return false
}

export function redactSecretShapedText(value: string): { text: string; redactions: number } {
  let text = value
  let redactions = 0
  for (const pattern of secretPatterns) {
    const global = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`)
    text = text.replace(global, () => {
      redactions += 1
      return "[REDACTED_SECRET]"
    })
  }
  return { text, redactions }
}

function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable GAEP records cannot contain secret-shaped values",
  }) as unknown as T
}

function hasUniqueValues(values: readonly string[]): boolean {
  return new Set(values).size === values.length
}

export const productStudioSectionIds = [
  "overview",
  "direction",
  "users-jobs",
  "outcomes",
  "scope",
  "delivery",
  "architecture",
  "risks-decisions",
  "trace",
  "agents-tools",
  "runs-evidence",
  "readiness",
] as const

export const productDesignSectionIdSchema = z.enum(productStudioSectionIds)

export const designFieldSchema = z.object({
  key: identifierSchema,
  question: shortTextSchema,
  value: z.union([z.string().max(50_000), z.array(z.string().max(10_000)).max(512)]),
  state: z.enum(["missing", "weak", "complete", "deferred"]),
  provenance: stringListSchema.default([]),
  deferredReason: shortTextSchema.optional(),
  revisitTrigger: shortTextSchema.optional(),
}).superRefine((field, context) => {
  const populated = typeof field.value === "string"
    ? field.value.trim().length > 0
    : field.value.some((value) => value.trim().length > 0)
  if ((field.state === "weak" || field.state === "complete") && !populated) {
    context.addIssue({ code: "custom", path: ["value"], message: `${field.state} design fields require content` })
  }
  if (field.state === "deferred" && !field.deferredReason) {
    context.addIssue({ code: "custom", path: ["deferredReason"], message: "Deferred fields require a reason" })
  }
})

export const designGapSchema = z.object({
  id: z.string().uuid(),
  fieldKey: identifierSchema.optional(),
  kind: z.enum(["missing", "weak", "invalid", "dependency", "evidence"]),
  severity: z.enum(["info", "warning", "blocker"]),
  message: shortTextSchema,
  resolution: shortTextSchema.optional(),
})

export const designConflictSchema = z.object({
  id: z.string().uuid(),
  fieldKeys: z.array(identifierSchema).min(2).max(32).refine(hasUniqueValues, "Conflict field keys must be unique"),
  statement: shortTextSchema,
  state: z.enum(["open", "resolved", "accepted"]),
  resolution: shortTextSchema.optional(),
}).superRefine((conflict, context) => {
  if (conflict.state === "resolved" && !conflict.resolution) {
    context.addIssue({ code: "custom", path: ["resolution"], message: "Resolved conflicts require a resolution" })
  }
})

const designSectionBaseSchema = z.object({
  summary: z.string().trim().max(10_000).default(""),
  fields: z.array(designFieldSchema).max(256).refine(
    (fields) => hasUniqueValues(fields.map((field) => field.key)),
    "Design field keys must be unique within a section",
  ),
  gaps: z.array(designGapSchema).max(256).default([]),
  conflicts: z.array(designConflictSchema).max(128).default([]),
  updatedAt: z.string().datetime(),
})

function sectionSchema<TId extends typeof productStudioSectionIds[number]>(sectionId: TId) {
  return designSectionBaseSchema.extend({ sectionId: z.literal(sectionId) })
}

export const productDesignSectionsSchema = z.object({
  overview: sectionSchema("overview"),
  direction: sectionSchema("direction"),
  "users-jobs": sectionSchema("users-jobs"),
  outcomes: sectionSchema("outcomes"),
  scope: sectionSchema("scope"),
  delivery: sectionSchema("delivery"),
  architecture: sectionSchema("architecture"),
  "risks-decisions": sectionSchema("risks-decisions"),
  trace: sectionSchema("trace"),
  "agents-tools": sectionSchema("agents-tools"),
  "runs-evidence": sectionSchema("runs-evidence"),
  readiness: sectionSchema("readiness"),
})

export const productDesignDraftSchema = rejectSecrets(z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("product-design-draft"),
  id: z.string().uuid(),
  productId: z.string().uuid(),
  revision: z.number().int().positive(),
  baseProductRevision: z.number().int().positive(),
  baseDesignRevisionId: z.string().uuid().optional(),
  sections: productDesignSectionsSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}))

export const designSectionReadinessSchema = z.object({
  sectionId: productDesignSectionIdSchema,
  state: z.enum(["missing", "weak", "conflicted", "deferred", "complete"]),
  missingFields: z.array(identifierSchema),
  weakFields: z.array(identifierSchema),
  deferredFields: z.array(identifierSchema),
  openConflictIds: z.array(z.string().uuid()),
  blockerGapIds: z.array(z.string().uuid()),
})

export const designReadinessReportSchema = z.object({
  schemaVersion: z.literal(1),
  productId: z.string().uuid(),
  draftId: z.string().uuid(),
  draftRevision: z.number().int().positive(),
  status: z.enum(["incomplete", "ready-with-deferrals", "ready"]),
  sections: z.array(designSectionReadinessSchema).length(productStudioSectionIds.length),
  blockingGapIds: z.array(z.string().uuid()),
  openConflictIds: z.array(z.string().uuid()),
  deferredFieldCount: z.number().int().nonnegative(),
  evaluatedAt: z.string().datetime(),
  claimBoundary: z.literal("design-readiness-is-not-implementation-approval"),
})

export const productDesignRevisionSchema = rejectSecrets(z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("product-design-revision"),
  id: z.string().uuid(),
  productId: z.string().uuid(),
  revision: z.number().int().positive(),
  productRevision: z.number().int().positive(),
  predecessorId: z.string().uuid().optional(),
  sourceDraftId: z.string().uuid(),
  sourceDraftRevision: z.number().int().positive(),
  sections: productDesignSectionsSchema,
  readiness: designReadinessReportSchema,
  snapshotDigest: digestSchema,
  createdBy: z.object({ kind: z.literal("human"), id: shortTextSchema }),
  createdAt: z.string().datetime(),
}))

export const productRevisionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("product-revision"),
  productId: z.string().uuid(),
  revision: z.number().int().positive(),
  product: productSchema,
  source: z.object({
    kind: z.enum(["initialization", "design-revision", "manual-revision"]),
    id: z.string().uuid(),
  }),
  productDigest: digestSchema,
  recordedAt: z.string().datetime(),
}).superRefine((record, context) => {
  if (record.product.id !== record.productId || (record.product.revision ?? 1) !== record.revision) {
    context.addIssue({ code: "custom", path: ["product"], message: "Product history identity and revision must match its snapshot" })
  }
})

export const exactBaselineSchema = z.object({
  kind: z.literal("exact"),
  subjectType: z.enum(["product", "design-revision", "architecture", "requirement", "external"]),
  subjectId: z.string().min(1).max(500),
  revision: z.number().int().positive(),
  digest: digestSchema,
})

export const genesisBaselineSchema = z.object({
  kind: z.literal("genesis"),
  declaration: shortTextSchema,
  rationale: shortTextSchema,
})

export const changeBaselineSchema = z.discriminatedUnion("kind", [exactBaselineSchema, genesisBaselineSchema])

export const workspaceRelativePathSchema = z.string().min(1).max(4_096).refine((value) => {
  if (value === ".") return true
  const segments = value.split("/")
  return !value.startsWith("/") &&
    !/^[A-Za-z]:/.test(value) &&
    !value.includes("\\") &&
    !value.includes("\0") &&
    !/%2e/i.test(value) &&
    !segments.includes("") &&
    !segments.includes(".") &&
    !segments.includes("..")
}, "Workspace paths must be normalized relative paths")

const externalUriSchema = z.string().url().max(8_192).refine((value) => {
  const parsed = new URL(value)
  if (!["http:", "https:", "urn:"].includes(parsed.protocol) || parsed.username || parsed.password) return false
  const sensitiveName = /(token|password|passwd|secret|signature|credential|api.?key|access.?key|auth)/i
  if ([...parsed.searchParams.keys()].some((key) => sensitiveName.test(key))) return false
  if (parsed.hash && sensitiveName.test(parsed.hash)) return false
  return true
}, "External URIs must use http, https, or urn and cannot embed credentials or secret-bearing parameters")

export const portableLocatorSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("workspace-relative"), path: workspaceRelativePathSchema }),
  z.object({ kind: z.literal("logical"), value: identifierSchema }),
  z.object({ kind: z.literal("external-uri"), uri: externalUriSchema }),
])

const recordBaseShape = {
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  productId: z.string().uuid(),
  revision: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}

export const changeSchema = rejectSecrets(z.object({
  ...recordBaseShape,
  kind: z.literal("change"),
  initiativeId: z.string().uuid(),
  title: z.string().trim().min(2).max(240),
  summary: longTextSchema,
  baseline: changeBaselineSchema,
  state: z.enum(["proposed", "planned", "active", "blocked", "completed", "cancelled"]),
  effectEnvelope: z.array(effectDescriptorSchema).min(1).refine(hasUniqueValues, "Effect descriptors must be unique"),
}))

export const workScopeSchema = z.object({
  read: z.array(portableLocatorSchema).max(256).default([]),
  write: z.array(portableLocatorSchema).max(256).default([]),
  effects: z.array(portableLocatorSchema).max(256).default([]),
})

export const workItemSchema = rejectSecrets(z.object({
  ...recordBaseShape,
  kind: z.literal("work-item"),
  changeId: z.string().uuid(),
  title: z.string().trim().min(2).max(240),
  objective: longTextSchema,
  state: z.enum(["proposed", "planned", "ready", "in-progress", "blocked", "completed", "cancelled"]),
  dependsOn: z.array(z.string().uuid()).max(256).refine(hasUniqueValues, "Work Item dependencies must be unique"),
  completionCriteria: z.array(shortTextSchema).min(1).max(256),
  evidenceCriteria: z.array(shortTextSchema).min(1).max(256),
  scope: workScopeSchema,
  owner: z.object({
    kind: z.enum(["human", "agent", "unassigned"]),
    id: shortTextSchema.optional(),
  }).superRefine((owner, context) => {
    if (owner.kind !== "unassigned" && !owner.id) {
      context.addIssue({ code: "custom", path: ["id"], message: "Assigned Work Item owners require an identity" })
    }
    if (owner.kind === "unassigned" && owner.id) {
      context.addIssue({ code: "custom", path: ["id"], message: "Unassigned Work Items cannot name an owner" })
    }
  }),
}))

export const requirementSchema = rejectSecrets(z.object({
  ...recordBaseShape,
  kind: z.literal("requirement"),
  key: z.string().regex(/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/),
  statement: longTextSchema,
  rationale: shortTextSchema,
  priority: z.enum(["must", "should", "could", "wont"]),
  state: z.enum(["proposed", "accepted", "deferred", "satisfied", "rejected"]),
  verificationCriteria: z.array(shortTextSchema).min(1).max(256),
  sourceRecordIds: z.array(z.string().uuid()).max(256).refine(hasUniqueValues, "Requirement sources must be unique"),
}))

export const decisionOptionSchema = z.object({
  id: z.string().uuid(),
  label: shortTextSchema,
  description: shortTextSchema,
  tradeoffs: stringListSchema.default([]),
})

export const decisionSchema = rejectSecrets(z.object({
  ...recordBaseShape,
  kind: z.literal("decision"),
  question: longTextSchema,
  options: z.array(decisionOptionSchema).min(2).max(64).refine(
    (options) => hasUniqueValues(options.map((option) => option.id)),
    "Decision option IDs must be unique",
  ),
  recommendation: z.object({
    optionId: z.string().uuid(),
    rationale: shortTextSchema,
    proposedBy: z.object({ kind: z.enum(["human", "agent", "system"]), id: shortTextSchema }),
    proposedAt: z.string().datetime(),
  }).optional(),
  selectedOutcome: z.object({
    optionId: z.string().uuid(),
    rationale: shortTextSchema,
    selectedBy: z.object({ kind: z.literal("human"), id: shortTextSchema }),
    selectedAt: z.string().datetime(),
  }).optional(),
  dissentAndUncertainty: stringListSchema.default([]),
  affectedRecordIds: z.array(z.string().uuid()).max(256).refine(hasUniqueValues, "Affected records must be unique"),
  state: z.enum(["open", "decided", "deferred", "superseded"]),
}).superRefine((decision, context) => {
  const optionIds = new Set(decision.options.map((option) => option.id))
  if (decision.recommendation && !optionIds.has(decision.recommendation.optionId)) {
    context.addIssue({ code: "custom", path: ["recommendation", "optionId"], message: "Recommendation must reference a declared option" })
  }
  if (decision.selectedOutcome && !optionIds.has(decision.selectedOutcome.optionId)) {
    context.addIssue({ code: "custom", path: ["selectedOutcome", "optionId"], message: "Selected outcome must reference a declared option" })
  }
  if (decision.state === "decided" && !decision.selectedOutcome) {
    context.addIssue({ code: "custom", path: ["selectedOutcome"], message: "A decided record requires an attributable human outcome" })
  }
  if (decision.state !== "decided" && decision.selectedOutcome) {
    context.addIssue({ code: "custom", path: ["state"], message: "A selected outcome requires the decided state" })
  }
}))

export const riskSchema = rejectSecrets(z.object({
  ...recordBaseShape,
  kind: z.literal("risk"),
  title: z.string().trim().min(2).max(240),
  cause: longTextSchema,
  condition: longTextSchema,
  consequence: longTextSchema,
  likelihood: z.enum(["rare", "unlikely", "possible", "likely", "almost-certain", "unknown"]),
  impact: z.enum(["negligible", "minor", "moderate", "major", "critical", "unknown"]),
  uncertainty: shortTextSchema,
  treatment: shortTextSchema,
  owner: z.object({ kind: z.enum(["human", "role", "unassigned"]), id: shortTextSchema.optional() }).superRefine(
    (owner, context) => {
      if (owner.kind !== "unassigned" && !owner.id) {
        context.addIssue({ code: "custom", path: ["id"], message: "Assigned risk owners require an identity" })
      }
      if (owner.kind === "unassigned" && owner.id) {
        context.addIssue({ code: "custom", path: ["id"], message: "Unassigned risks cannot name an owner" })
      }
    },
  ),
  reviewTriggers: z.array(shortTextSchema).min(1).max(128),
  residualRisk: shortTextSchema,
  state: z.enum(["open", "treated", "accepted", "closed"]),
  acceptance: z.object({
    acceptedBy: z.object({ kind: z.literal("human"), id: shortTextSchema }),
    rationale: shortTextSchema,
    acceptedAt: z.string().datetime(),
  }).optional(),
}).superRefine((risk, context) => {
  if (risk.state === "accepted" && !risk.acceptance) {
    context.addIssue({ code: "custom", path: ["acceptance"], message: "Accepted risk requires attributable human acceptance" })
  }
  if (risk.state !== "accepted" && risk.acceptance) {
    context.addIssue({ code: "custom", path: ["state"], message: "Risk acceptance is valid only in the accepted state" })
  }
}))

export const architectureRecordSchema = rejectSecrets(z.object({
  ...recordBaseShape,
  kind: z.literal("architecture-record"),
  recordType: z.enum(["direction", "principle", "constraint", "component", "interface", "data-flow", "deployment", "security"]),
  title: z.string().trim().min(2).max(240),
  description: longTextSchema,
  rationale: longTextSchema,
  assumptions: stringListSchema.default([]),
  constraints: stringListSchema.default([]),
  affectedRecordIds: z.array(z.string().uuid()).max(256).refine(hasUniqueValues, "Affected records must be unique"),
  state: z.enum(["proposed", "accepted", "deprecated", "superseded"]),
}))

export const evidenceRecordSchema = rejectSecrets(z.object({
  ...recordBaseShape,
  kind: z.literal("evidence"),
  subjectRecordIds: z.array(z.string().uuid()).min(1).max(256).refine(hasUniqueValues, "Evidence subjects must be unique"),
  origin: z.object({
    kind: z.enum(["local-command", "manual-observation", "provider-output", "document", "external"]),
    locator: portableLocatorSchema,
    actor: z.object({ kind: z.enum(["human", "agent", "system", "external"]), id: shortTextSchema }),
  }),
  method: longTextSchema,
  result: z.object({
    status: z.enum(["pass", "fail", "inconclusive", "observation"]),
    summary: longTextSchema,
  }),
  artifactDigest: digestSchema,
  limitations: z.array(shortTextSchema).min(1).max(256),
  verification: z.object({
    status: z.enum(["unverified", "verified", "disputed", "failed"]),
    verifier: z.object({ kind: z.enum(["human", "system"]), id: shortTextSchema }).optional(),
    method: shortTextSchema.optional(),
    verifiedAt: z.string().datetime().optional(),
  }).superRefine((verification, context) => {
    if (verification.status === "verified" && (!verification.verifier || !verification.method || !verification.verifiedAt)) {
      context.addIssue({ code: "custom", message: "Verified evidence requires verifier, method, and time" })
    }
  }),
  freshness: z.object({
    status: z.enum(["fresh", "stale", "unknown"]),
    assessedAt: z.string().datetime(),
    basis: shortTextSchema,
  }),
  collectedAt: z.string().datetime(),
  validUntil: z.string().datetime().optional(),
}))

export const traceRecordTypeSchema = z.enum([
  "product",
  "design-revision",
  "initiative",
  "change",
  "work-item",
  "requirement",
  "decision",
  "risk",
  "architecture",
  "evidence",
  "context-pack",
  "workflow-plan",
  "tool-definition",
  "run",
  "external",
])

export const traceEndpointSchema = z.object({
  recordType: traceRecordTypeSchema,
  recordId: z.string().min(1).max(500),
  revision: z.number().int().positive().optional(),
  digest: digestSchema.optional(),
})

export const traceLinkSchema = rejectSecrets(z.object({
  ...recordBaseShape,
  kind: z.literal("trace-link"),
  source: traceEndpointSchema,
  relationship: z.enum([
    "targets",
    "derives-from",
    "contributes-to",
    "depends-on",
    "implements",
    "satisfies",
    "validates",
    "mitigates",
    "decides",
    "affects",
    "supersedes",
    "related-to",
  ]),
  target: traceEndpointSchema,
  state: z.enum(["valid", "unresolved", "stale", "invalid"]),
  provenance: z.object({
    kind: z.enum(["human", "agent", "system", "imported"]),
    actorId: shortTextSchema,
    rationale: shortTextSchema,
  }),
}))

export const traceImpactSchema = z.object({
  subject: traceEndpointSchema,
  upstream: z.array(traceLinkSchema),
  downstream: z.array(traceLinkSchema),
  validatingEvidence: z.array(traceLinkSchema),
  decisionsAndRisks: z.array(traceLinkSchema),
  unresolved: z.array(traceLinkSchema),
  stale: z.array(traceLinkSchema),
  evaluatedAt: z.string().datetime(),
})

export const productDomainRecordKindSchema = z.enum([
  "product-design-revision",
  "product-revision",
  "change",
  "work-item",
  "requirement",
  "decision",
  "risk",
  "architecture-record",
  "evidence",
  "trace-link",
  "context-pack",
  "workflow-plan",
  "tool-definition",
  "run-tool-selection",
])

export const productDomainSearchResultSchema = z.object({
  schemaVersion: z.literal(1),
  kind: productDomainRecordKindSchema,
  id: z.string().min(1),
  productId: z.string().uuid(),
  revision: z.number().int().positive(),
  label: z.string().min(1).max(500),
  excerpt: z.string().max(2_000),
  updatedAt: z.string().datetime(),
})

export const trustAssessmentLevelSchema = z.enum(["verified", "partially-verified", "unknown", "disputed", "failed"])
export const informationClassificationSchema = z.enum(["public", "internal", "confidential", "restricted"])

export const contextTrustDimensionsSchema = z.object({
  semanticAuthority: z.object({
    standing: z.enum(["authoritative", "advisory", "non-authoritative", "unknown"]),
    domain: shortTextSchema,
    owner: shortTextSchema.optional(),
    scope: stringListSchema.default([]),
    precedence: z.number().int().optional(),
  }),
  epistemicRole: z.enum(["governing-constraint", "factual-assertion", "claim", "evidence", "interpretation", "reference", "proposal"]),
  sourceAuthenticity: trustAssessmentLevelSchema,
  contentIntegrity: trustAssessmentLevelSchema,
  confidentiality: z.object({
    classification: informationClassificationSchema,
    purpose: shortTextSchema,
    recipients: z.array(shortTextSchema).min(1).max(128),
    retention: shortTextSchema,
  }),
  instructionPrivilege: z.enum([
    "governing-instruction",
    "capability-instruction",
    "workflow-data",
    "untrusted-external-content",
    "inert-evidence",
  ]),
  freshness: z.object({ status: z.enum(["fresh", "stale", "unknown"]), assessedAt: z.string().datetime(), basis: shortTextSchema }),
  validity: z.object({ status: z.enum(["valid", "invalid", "unknown"]), basis: shortTextSchema }),
  revisionDisposition: z.enum(["current", "superseded", "proposed", "unknown"]),
  applicability: z.object({ status: z.enum(["applicable", "not-applicable", "unknown"]), basis: shortTextSchema }),
})

export const contextTransformationSchema = z.object({
  kind: z.enum(["redaction", "excerpt", "summary", "compression", "normalization"]),
  method: shortTextSchema,
  sourceDigest: digestSchema,
  outputDigest: digestSchema,
  omissions: stringListSchema.default([]),
  lossy: z.boolean(),
})

export const contextItemSchema = z.object({
  id: z.string().uuid(),
  source: portableLocatorSchema,
  sourceRevision: z.number().int().positive().optional(),
  sourceDigest: digestSchema,
  selectionReason: shortTextSchema,
  required: z.boolean(),
  content: z.string().min(1).max(200_000),
  contentDigest: digestSchema,
  trust: contextTrustDimensionsSchema,
  transformations: z.array(contextTransformationSchema).max(64).default([]),
  instructionPrivilegeGrant: z.object({
    recordType: z.enum(["requirement", "decision", "architecture"]),
    recordId: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    rationale: shortTextSchema,
  }).optional(),
}).superRefine((item, context) => {
  const privileged = item.trust.instructionPrivilege === "governing-instruction" ||
    item.trust.instructionPrivilege === "capability-instruction"
  if (privileged && !item.instructionPrivilegeGrant) {
    context.addIssue({
      code: "custom",
      path: ["instructionPrivilegeGrant"],
      message: "Instruction privilege requires an exact governed grant",
    })
  }
})

export const contextPackSchema = rejectSecrets(z.object({
  ...recordBaseShape,
  kind: z.literal("context-pack"),
  objective: longTextSchema,
  recipient: z.object({ kind: z.enum(["human", "agent", "tool"]), id: shortTextSchema }),
  items: z.array(contextItemSchema).min(1).max(1_024).refine(
    (items) => hasUniqueValues(items.map((item) => item.id)),
    "Context Item IDs must be unique",
  ),
  omissions: z.array(z.object({
    source: portableLocatorSchema,
    reason: shortTextSchema,
    required: z.boolean(),
    material: z.boolean(),
  })).max(256).default([]),
  warnings: stringListSchema.default([]),
  conflicts: z.array(z.object({
    itemIds: z.array(z.string().uuid()).min(2).max(32).refine(hasUniqueValues, "Conflict item IDs must be unique"),
    statement: shortTextSchema,
    state: z.enum(["open", "resolved", "accepted"]),
    resolution: shortTextSchema.optional(),
  })).max(128).default([]),
  classification: z.object({
    level: informationClassificationSchema,
    combinationRisk: shortTextSchema,
  }),
  sufficiency: z.object({
    status: z.enum(["sufficient", "sufficient-with-assumptions", "insufficient"]),
    criteria: z.array(shortTextSchema).min(1).max(128),
    evaluator: z.object({ kind: z.enum(["human", "system"]), id: shortTextSchema }),
    assumptions: stringListSchema.default([]),
    reasons: stringListSchema.default([]),
  }),
  packDigest: digestSchema,
  authorityBoundary: z.literal("context-sufficiency-does-not-grant-authority"),
}))

export const exactRecordReferenceSchema = z.object({
  recordType: z.enum([
    "context-pack", "tool-definition", "product", "design-revision", "change", "work-item", "requirement", "decision", "architecture",
  ]),
  recordId: z.string().min(1).max(500),
  revision: z.number().int().positive(),
  digest: digestSchema,
})

export const workflowStepSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(2).max(240),
  objective: longTextSchema,
  responsibility: z.object({ kind: z.enum(["human", "agent", "system", "tool"]), id: shortTextSchema }),
  dependsOn: z.array(z.string().uuid()).max(256).refine(hasUniqueValues, "Workflow dependencies must be unique"),
  preconditions: z.array(shortTextSchema).min(1).max(256),
  outputs: z.array(shortTextSchema).min(1).max(256),
  evidenceCriteria: z.array(shortTextSchema).min(1).max(256),
  retry: z.object({
    maxAttempts: z.number().int().min(1).max(10),
    backoffMs: z.number().int().nonnegative().max(86_400_000),
    retryOn: stringListSchema.default([]),
  }),
  stopConditions: z.array(shortTextSchema).min(1).max(256),
  scope: workScopeSchema,
  effectEnvelope: z.array(effectDescriptorSchema).refine(hasUniqueValues, "Workflow effects must be unique"),
  timeoutMs: z.number().int().positive().max(604_800_000).optional(),
})

export const workflowPlanSchema = rejectSecrets(z.object({
  ...recordBaseShape,
  kind: z.literal("workflow-plan"),
  title: z.string().trim().min(2).max(240),
  objective: longTextSchema,
  subject: exactRecordReferenceSchema,
  actor: z.object({ kind: z.enum(["human", "agent", "system"]), id: shortTextSchema }),
  strategy: z.enum(["sequential", "parallel-readonly"]).default("sequential"),
  contextPacks: z.array(exactRecordReferenceSchema).max(128),
  toolDefinitions: z.array(exactRecordReferenceSchema).max(128),
  steps: z.array(workflowStepSchema).min(1).max(512).refine(
    (steps) => hasUniqueValues(steps.map((step) => step.id)),
    "Workflow Step IDs must be unique",
  ),
  state: z.enum(["draft", "resolved", "blocked", "retired"]),
  planDigest: digestSchema,
  authorityBoundary: z.literal("workflow-plan-does-not-grant-authority"),
}))

export const toolDefinitionSchema = rejectSecrets(z.object({
  ...recordBaseShape,
  kind: z.literal("tool-definition"),
  definitionType: z.enum(["tool", "capability"]),
  key: identifierSchema,
  name: z.string().trim().min(2).max(240),
  binding: z.object({
    adapterId: identifierSchema.optional(),
    providerId: identifierSchema.optional(),
    toolName: identifierSchema,
  }),
  purpose: longTextSchema,
  inputContract: z.array(shortTextSchema).min(1).max(256),
  outputContract: z.array(shortTextSchema).min(1).max(256),
  allowedScopes: z.array(portableLocatorSchema).max(256),
  requiredPermissions: z.array(z.object({ capability: identifierSchema, mode: z.enum(["allow", "ask", "deny"]) })).max(256),
  effectEnvelope: z.array(effectDescriptorSchema).refine(hasUniqueValues, "Tool effects must be unique"),
  trust: z.object({
    source: z.enum(["provider-declared", "configured", "observed", "inferred", "unknown"]),
    maturity: z.enum(["experimental", "beta", "stable", "deprecated", "unknown"]),
    assessedAt: z.string().datetime(),
    basis: shortTextSchema,
  }),
  limitations: z.array(shortTextSchema).min(1).max(256),
  enabled: z.boolean(),
  policy: z.object({
    requiresHumanConfirmation: z.boolean(),
    forbiddenInUntrustedWorkspace: z.boolean(),
    allowedProfiles: z.array(z.string().min(1).max(100)).max(64),
  }),
  authorityBoundary: z.literal("tool-presence-does-not-grant-authority"),
}).superRefine((tool, context) => {
  if (!hasUniqueValues(tool.requiredPermissions.map((permission) => permission.capability))) {
    context.addIssue({ code: "custom", path: ["requiredPermissions"], message: "Tool permission capabilities must be unique" })
  }
  if (tool.requiredPermissions.some((permission) => permission.mode === "deny")) {
    context.addIssue({ code: "custom", path: ["requiredPermissions"], message: "A required Tool permission cannot be denied" })
  }
  if (
    tool.effectEnvelope.some((effect) => effect === "external-effect" || effect === "destructive-or-irreversible") &&
    !tool.policy.requiresHumanConfirmation
  ) {
    context.addIssue({ code: "custom", path: ["policy", "requiresHumanConfirmation"], message: "High-impact Tools require human confirmation" })
  }
}))

export const runToolSelectionSchema = rejectSecrets(z.object({
  ...recordBaseShape,
  kind: z.literal("run-tool-selection"),
  runId: z.string().uuid(),
  tools: z.array(exactRecordReferenceSchema).min(1).max(128).refine(
    (tools) => hasUniqueValues(tools.map((tool) => tool.recordId)),
    "Selected Tool IDs must be unique",
  ),
  requestedEffects: z.array(effectDescriptorSchema).refine(hasUniqueValues, "Requested effects must be unique"),
  confirmedToolIds: z.array(z.string().uuid()).max(128).refine(hasUniqueValues, "Confirmed Tool IDs must be unique"),
  workspaceTrusted: z.boolean(),
  readiness: z.object({
    status: z.enum(["ready", "blocked"]),
    issues: stringListSchema.default([]),
    evaluatedAt: z.string().datetime(),
  }),
  selectedBy: z.object({ kind: z.literal("human"), id: shortTextSchema }),
  authorityBoundary: z.literal("tool-selection-does-not-grant-authority"),
}))

export const productExportMemberSchema = z.object({
  path: workspaceRelativePathSchema.refine((path) => path !== ".", "Export members must name a file"),
  recordType: z.string().regex(/^[a-z][a-z0-9-]*$/),
  byteLength: z.number().int().nonnegative(),
  digest: digestSchema,
})

export const productExportManifestSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("product-export-manifest"),
  productId: z.string().uuid(),
  productRevision: z.number().int().positive(),
  members: z.array(productExportMemberSchema).min(1).refine(
    (members) => hasUniqueValues(members.map((member) => member.path)),
    "Export member paths must be unique",
  ),
  membershipDigest: digestSchema,
  excluded: z.array(z.object({ recordClass: identifierSchema, reason: shortTextSchema })),
  authorityBoundary: z.literal("export-does-not-assert-readiness-or-approval"),
})

export const productExportBundleSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("product-export-bundle"),
  manifest: productExportManifestSchema,
  records: z.array(z.object({ path: workspaceRelativePathSchema, content: z.json() })).min(1).refine(
    (records) => hasUniqueValues(records.map((record) => record.path)),
    "Export record paths must be unique",
  ),
})

export const productImportPreviewSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("product-import-preview"),
  productId: z.string().uuid(),
  productRevision: z.number().int().positive(),
  status: z.enum(["compatible", "blocked"]),
  memberCount: z.number().int().positive(),
  conflicts: z.array(z.object({ path: workspaceRelativePathSchema, code: identifierSchema, message: shortTextSchema })),
  warnings: stringListSchema.default([]),
  importMutation: z.literal("not-performed"),
})

export type ProductDesignSectionId = z.infer<typeof productDesignSectionIdSchema>
export type DesignField = z.infer<typeof designFieldSchema>
export type ProductDesignSections = z.infer<typeof productDesignSectionsSchema>
export type ProductDesignDraft = z.infer<typeof productDesignDraftSchema>
export type DesignReadinessReport = z.infer<typeof designReadinessReportSchema>
export type ProductDesignRevision = z.infer<typeof productDesignRevisionSchema>
export type ProductRevision = z.infer<typeof productRevisionSchema>
export type Change = z.infer<typeof changeSchema>
export type WorkItem = z.infer<typeof workItemSchema>
export type Requirement = z.infer<typeof requirementSchema>
export type Decision = z.infer<typeof decisionSchema>
export type Risk = z.infer<typeof riskSchema>
export type ArchitectureRecord = z.infer<typeof architectureRecordSchema>
export type EvidenceRecord = z.infer<typeof evidenceRecordSchema>
export type TraceEndpoint = z.infer<typeof traceEndpointSchema>
export type TraceLink = z.infer<typeof traceLinkSchema>
export type TraceImpact = z.infer<typeof traceImpactSchema>
export type ProductDomainRecordKind = z.infer<typeof productDomainRecordKindSchema>
export type ProductDomainSearchResult = z.infer<typeof productDomainSearchResultSchema>
export type ContextTrustDimensions = z.infer<typeof contextTrustDimensionsSchema>
export type ContextItem = z.infer<typeof contextItemSchema>
export type ContextPack = z.infer<typeof contextPackSchema>
export type ExactRecordReference = z.infer<typeof exactRecordReferenceSchema>
export type WorkflowStep = z.infer<typeof workflowStepSchema>
export type WorkflowPlan = z.infer<typeof workflowPlanSchema>
export type ToolDefinition = z.infer<typeof toolDefinitionSchema>
export type RunToolSelection = z.infer<typeof runToolSelectionSchema>
export type ProductExportManifest = z.infer<typeof productExportManifestSchema>
export type ProductExportBundle = z.infer<typeof productExportBundleSchema>
export type ProductImportPreview = z.infer<typeof productImportPreviewSchema>
