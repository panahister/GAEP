import { canonicalDigest } from "@gaep/agent-sdk"
import { initiativeSchema, sourceBaselineSchema, sourceProvenanceSchema, sourceRecordSchema } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import {
  candidateBaselineInput,
  initiativeSourceProvenanceInput,
  matchingCandidateBaseline,
  matchingInitiativeProvenance,
} from "./product-chat-source-baseline.js"
import { candidateSourceRecordInput } from "./product-chat-source-recording.js"

const digest = (value: string) => `sha256:${value.repeat(64)}` as const

function source(id: string, content: string) {
  const input = candidateSourceRecordInput({
    initiativeId: "00000000-0000-4000-8000-000000000002",
    source: { label: `Source ${id.slice(-1)}.docx`, format: "docx", extraction: "docx-ooxml", byteLength: 100, contentDigest: digest(content) },
    actorId: "owner",
    assessedAt: "2026-08-03T00:00:00.000Z",
  })
  return sourceRecordSchema.parse({
    schemaVersion: 1, kind: "source-record", id, productId: "00000000-0000-4000-8000-000000000001",
    ...input, revision: 1, recordedBy: { kind: "human", id: "owner" }, createdAt: "2026-08-03T00:00:00.000Z", updatedAt: "2026-08-03T00:00:00.000Z",
    authorityBoundary: "source-semantic-authority-is-an-attributed-input-claim-and-does-not-grant-decision-approval-authorization-or-action-authority",
  })
}

const initiative = initiativeSchema.parse({
  schemaVersion: 1, kind: "initiative", id: "00000000-0000-4000-8000-000000000002", productId: "00000000-0000-4000-8000-000000000001",
  revision: 3, title: "Plan a governed capability", outcome: "Produce a reviewable planning baseline.",
  scope: ["Planning"], exclusions: ["Implementation"], state: "proposed",
  createdAt: "2026-08-03T00:00:00.000Z", updatedAt: "2026-08-03T00:00:00.000Z",
})

describe("Product Chat candidate Source Baseline and Provenance", () => {
  it("uses canonical exact Source membership and reuses the same Baseline", () => {
    const sources = [source("00000000-0000-4000-8000-000000000004", "b"), source("00000000-0000-4000-8000-000000000003", "a")]
    const input = candidateBaselineInput(initiative.id, sources)
    expect(input.members.map((member) => member.sourceId)).toEqual([...input.members.map((member) => member.sourceId)].sort())
    const baseline = sourceBaselineSchema.parse({
      schemaVersion: 1, kind: "source-baseline-snapshot", id: "00000000-0000-4000-8000-000000000005",
      productId: initiative.productId, revision: 1, ...input, membershipDigest: canonicalDigest(input.members), state: "candidate",
      createdBy: { kind: "human", id: "owner" }, createdAt: "2026-08-03T00:00:00.000Z", updatedAt: "2026-08-03T00:00:00.000Z",
      authorityBoundary: "source-baseline-snapshot-is-a-versioned-candidate-and-does-not-approve-designate-authorize-or-supersede",
    })
    expect(matchingCandidateBaseline(input, [baseline])?.id).toBe(baseline.id)
  })

  it("creates conservative exact Initiative provenance and detects an idempotent retry", () => {
    const sources = [source("00000000-0000-4000-8000-000000000003", "a")]
    const input = initiativeSourceProvenanceInput(initiative, sources, "owner")
    expect(input.disposition).toBe("unknown")
    expect(input.target).toMatchObject({ kind: "governed-record", reference: { recordType: "initiative", revision: 3 } })
    const record = sourceProvenanceSchema.parse({
      schemaVersion: 1, kind: "source-provenance-record", id: "00000000-0000-4000-8000-000000000006",
      productId: initiative.productId, ...input, recordedBy: { kind: "human", id: "owner" }, recordedAt: "2026-08-03T00:00:00.000Z",
      authorityBoundary: "provenance-establishes-attributed-lineage-and-does-not-approve-validate-authorize-or-transfer-source-authority",
    })
    expect(matchingInitiativeProvenance(input, [record])?.id).toBe(record.id)
  })
})
