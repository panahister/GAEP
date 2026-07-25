import { randomUUID } from "node:crypto"

import { describe, expect, it } from "vitest"

import {
  sourceBaselineSchema,
  sourceProvenanceSchema,
  sourceRecordSchema,
  type ExactSourceReference,
} from "./source-governance.js"

const digest = (value: string) => `sha256:${value.repeat(64).slice(0, 64)}`
const now = "2026-07-25T00:00:00.000Z"
const productId = randomUUID()
const initiativeId = randomUUID()
const actor = { kind: "human" as const, id: "product-owner" }

function source(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    kind: "source-record",
    id: randomUUID(),
    productId,
    initiativeId,
    revision: 1,
    sourceType: "requirements",
    title: "Versioned requirements input",
    description: "The reviewed requirements source used for the bounded Initiative.",
    locator: { kind: "logical", value: "requirements.reviewed" },
    revisionIdentity: { kind: "resource-revision", value: "GAEP-REQ-001@1" },
    contentDigest: digest("a"),
    digestScope: "Canonical UTF-8 requirements content",
    owner: actor,
    semanticAuthority: {
      standing: "authoritative",
      domain: "Initiative requirements",
      scope: ["P0 source intake"],
      basis: "The accountable Product owner declared this exact revision as the governing requirements input.",
      declaredBy: actor,
    },
    knowledgeDisposition: "confirmed",
    trust: { sourceAuthenticity: "verified", contentIntegrity: "verified" },
    informationClassification: "internal",
    rights: { status: "verified", basis: "Internal Product use is recorded for this source." },
    freshness: {
      status: "fresh",
      assessedAt: now,
      basis: "The accountable owner reviewed this exact revision.",
      validUntil: "2026-08-25T00:00:00.000Z",
    },
    availability: { status: "available", basis: "The logical source resolver is available." },
    limitations: ["Native external-system availability is not established."],
    recordedBy: actor,
    createdAt: now,
    updatedAt: now,
    authorityBoundary:
      "source-semantic-authority-is-an-attributed-input-claim-and-does-not-grant-decision-approval-authorization-or-action-authority",
    ...overrides,
  }
}

function reference(sourceId = randomUUID()): ExactSourceReference {
  return {
    sourceId,
    sourceRevision: 1,
    recordDigest: digest("b"),
    contentDigest: digest("c"),
  }
}

describe("source governance contracts", () => {
  it("accepts exact portable source identity while keeping ownership and semantic authority separate", () => {
    expect(sourceRecordSchema.parse(source())).toMatchObject({
      productId,
      initiativeId,
      revision: 1,
      semanticAuthority: { standing: "authoritative" },
      authorityBoundary:
        "source-semantic-authority-is-an-attributed-input-claim-and-does-not-grant-decision-approval-authorization-or-action-authority",
    })
  })

  it("rejects mutable revision aliases and authoritative claims without verified rights or trust", () => {
    expect(sourceRecordSchema.safeParse(source({
      revisionIdentity: { kind: "external-revision", value: "latest" },
    })).success).toBe(false)
    expect(sourceRecordSchema.safeParse(source({
      rights: { status: "unknown", basis: "Rights review is incomplete." },
    })).success).toBe(false)
    expect(sourceRecordSchema.safeParse(source({
      trust: { sourceAuthenticity: "failed", contentIntegrity: "verified" },
    })).success).toBe(false)
  })

  it("requires deterministic unique exact membership for candidate baseline snapshots", () => {
    const first = reference("00000000-0000-4000-8000-000000000001")
    const second = reference("00000000-0000-4000-8000-000000000002")
    const baseline = {
      schemaVersion: 1,
      kind: "source-baseline-snapshot",
      id: randomUUID(),
      productId,
      initiativeId,
      revision: 1,
      title: "P0 source candidate",
      purpose: "Freeze the exact reviewed source inputs for repeatable P0 analysis without designating authority.",
      scope: ["P0 inputs"],
      members: [first, second],
      limitations: ["Human baseline approval is not represented."],
      membershipDigest: digest("d"),
      state: "candidate",
      createdBy: actor,
      createdAt: now,
      updatedAt: now,
      authorityBoundary:
        "source-baseline-snapshot-is-a-versioned-candidate-and-does-not-approve-designate-authorize-or-supersede",
    }
    expect(sourceBaselineSchema.parse(baseline).members).toHaveLength(2)
    expect(sourceBaselineSchema.safeParse({ ...baseline, members: [second, first] }).success).toBe(false)
    expect(sourceBaselineSchema.safeParse({ ...baseline, members: [first, first] }).success).toBe(false)
    expect(sourceBaselineSchema.safeParse({ ...baseline, revision: 2 }).success).toBe(false)
  })

  it("binds source-to-target provenance and fails closed on run substitution or secret-shaped content", () => {
    const provenance = {
      schemaVersion: 1,
      kind: "source-provenance-record",
      id: randomUUID(),
      productId,
      initiativeId,
      target: {
        kind: "claim",
        lineageId: randomUUID(),
        revision: 1,
        digest: digest("e"),
        label: "Release evidence is locally available",
      },
      disposition: "confirmed",
      sources: [{
        reference: reference(),
        role: "supporting",
        rationale: "The exact reviewed requirements source supports this bounded claim.",
      }],
      transformations: [],
      contributors: [actor],
      generation: { kind: "manual", processId: "source-review-v1" },
      omissions: ["Live provider behavior is outside this claim."],
      uncertainty: [],
      recordedBy: actor,
      recordedAt: now,
      authorityBoundary:
        "provenance-establishes-attributed-lineage-and-does-not-approve-validate-authorize-or-transfer-source-authority",
    }
    expect(sourceProvenanceSchema.parse(provenance).generation.kind).toBe("manual")
    expect(sourceProvenanceSchema.safeParse({
      ...provenance,
      generation: { kind: "run", processId: "source-review-v1" },
    }).success).toBe(false)
    expect(sourceProvenanceSchema.safeParse({
      ...provenance,
      omissions: ["api_key=sk-live-123456789012345678901234"],
    }).success).toBe(false)
  })
})
