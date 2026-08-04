import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { GaepEngine } from "@gaep/engine"
import { afterEach, describe, expect, it } from "vitest"

import {
  candidateBaselineInput,
  initiativeSourceProvenanceInput,
  matchingCandidateBaseline,
  matchingInitiativeProvenance,
} from "./product-chat-source-baseline.js"
import { candidateSourceRecordInput } from "./product-chat-source-recording.js"

describe("Product Chat Baseline and Provenance integration", () => {
  let workspace: string | undefined

  afterEach(async () => {
    if (workspace) await rm(workspace, { recursive: true, force: true })
    workspace = undefined
  })

  it("records one exact candidate Baseline and conservative Provenance without duplicates or authority", async () => {
    workspace = await mkdtemp(join(tmpdir(), "gaep-source-baseline-"))
    const engine = new GaepEngine(workspace, [])
    const actorId = "product-owner"
    await engine.createProduct({
      name: "Scheduler", summary: "A governed scheduler planning workspace used for Phase 1 integration.",
      problem: "Candidate documents need exact Baseline and Provenance records.", affectedUsers: "Product and engineering teams",
      desiredOutcome: "Continue planning from exact reviewed Source revisions.", successSignals: ["Baseline membership remains exact"],
      firstWorkflow: "Record the reviewed Source foundation.", exclusions: ["Implementation authority"], profile: "internal-tool",
    }, actorId)
    const initiative = await engine.createInitiative({
      title: "Plan scheduler capability", outcome: "Create an exact candidate planning foundation.",
      scope: ["Pre-implementation planning"], exclusions: ["Release"],
    }, actorId)
    await engine.sourceGovernance.createSource(candidateSourceRecordInput({
      initiativeId: initiative.id,
      source: { label: "requirements.docx", format: "docx", byteLength: 200, contentDigest: `sha256:${"a".repeat(64)}` },
      actorId, assessedAt: "2026-08-03T00:00:00.000Z",
    }), actorId)
    const sources = await engine.sourceGovernance.listSources(initiative.id)
    const baselineInput = candidateBaselineInput(initiative.id, sources)
    const baseline = await engine.sourceGovernance.createBaseline(baselineInput, actorId)
    expect(matchingCandidateBaseline(baselineInput, await engine.sourceGovernance.listBaselines(initiative.id))?.id).toBe(baseline.id)

    const currentInitiative = await engine.readInitiative(initiative.id)
    const provenanceInput = initiativeSourceProvenanceInput(currentInitiative, sources, actorId)
    const provenance = await engine.sourceGovernance.recordProvenance(provenanceInput, actorId)
    expect(matchingInitiativeProvenance(provenanceInput, await engine.sourceGovernance.listProvenance(initiative.id))?.id).toBe(provenance.id)
    expect(await engine.sourceGovernance.assess(initiative.id)).toMatchObject({
      sourceCount: 1,
      baselineCount: 1,
      provenanceCount: 1,
      currentBaseline: { id: baseline.id, status: "current", memberCount: 1 },
      unbaselinedSourceCount: 0,
      unprovenancedSourceCount: 0,
    })
    expect(baseline.state).toBe("candidate")
    expect(provenance.disposition).toBe("unknown")
  })
})
