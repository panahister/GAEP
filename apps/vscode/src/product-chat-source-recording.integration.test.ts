import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { GaepEngine } from "@gaep/engine"
import { afterEach, describe, expect, it } from "vitest"

import { recordExactCandidateSources } from "./product-chat-source-recording.js"

describe("Product Chat candidate Source recording integration", () => {
  let workspace: string | undefined

  afterEach(async () => {
    if (workspace) await rm(workspace, { recursive: true, force: true })
    workspace = undefined
  })

  it("records one exact candidate Source and makes retry idempotent without creating Baseline or Provenance", async () => {
    workspace = await mkdtemp(join(tmpdir(), "gaep-product-chat-source-"))
    const engine = new GaepEngine(workspace, [])
    const actorId = "local-product-owner"
    await engine.createProduct({
      name: "Scheduler",
      summary: "A governed scheduling Product used to verify candidate Source Intake.",
      problem: "Existing Product documents are not represented as exact governed candidate Sources.",
      affectedUsers: "Product owners and engineering teams",
      desiredOutcome: "Reviewed attachments are recorded exactly without receiving semantic authority.",
      successSignals: ["The exact attachment digest is independently visible"],
      firstWorkflow: "Record one reviewed Product document as a candidate Source.",
      exclusions: ["Baseline designation", "Implementation authority"],
      profile: "internal-tool",
    }, actorId)
    const initiative = await engine.createInitiative({
      title: "Govern reviewed Product documents",
      outcome: "Exact candidate documents enter Source Intake without authority escalation.",
      scope: ["Candidate Source Intake"],
      exclusions: ["Baseline and Provenance creation"],
    }, actorId)
    const attachment = {
      label: "requirements.docx",
      format: "docx",
      extraction: "docx-ooxml" as const,
      byteLength: 1024,
      contentDigest: `sha256:${"c".repeat(64)}` as const,
    }
    const record = async (existing: Awaited<ReturnType<typeof engine.sourceGovernance.listSources>>) =>
      recordExactCandidateSources({
        initiativeId: initiative.id,
        sources: [attachment, attachment],
        actorId,
        assessedAt: "2026-08-02T19:00:00.000Z",
        existing,
        create: (source) => engine.sourceGovernance.createSource(source, actorId),
      })

    const first = await record([])
    expect(first.recorded).toHaveLength(1)
    expect(first.reused).toHaveLength(0)
    expect(await engine.sourceGovernance.assess(initiative.id)).toMatchObject({
      sourceCount: 1,
      baselineCount: 0,
      provenanceCount: 0,
      unknownAuthorityCount: 0,
      unbaselinedSourceCount: 1,
      unprovenancedSourceCount: 1,
      state: "attention-required",
    })
    const [source] = await engine.sourceGovernance.listSources(initiative.id)
    expect(source).toMatchObject({
      contentDigest: attachment.contentDigest,
      owner: { kind: "unassigned" },
      semanticAuthority: { standing: "non-authoritative" },
      informationClassification: "restricted",
    })

    const second = await record([source!])
    expect(second.recorded).toHaveLength(0)
    expect(second.reused).toHaveLength(1)
    expect(await engine.sourceGovernance.listSources(initiative.id)).toHaveLength(1)
  })
})
