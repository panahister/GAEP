import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  type ExactSourceReference,
  type ProductExportBundle,
  type SourceBaselineInput,
  type SourceProvenanceInput,
  type SourceRecord,
  type SourceRecordInput,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { GaepEngine } from "./engine.js"

const actorId = "product-owner"
const digest = (value: string) => `sha256:${value.repeat(64).slice(0, 64)}` as const

describe("Source governance", () => {
  let workspace: string
  let engine: GaepEngine
  let initiativeId: string

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "gaep-source-governance-"))
    engine = new GaepEngine(workspace, [])
    await engine.createProduct({
      name: "Atlas",
      summary: "A governed Product with exact source inputs.",
      problem: "Product claims can drift away from their exact originating source revisions.",
      affectedUsers: "Product owners and engineering teams",
      desiredOutcome: "Every material claim can resolve to exact governed source evidence.",
      successSignals: ["Source membership and provenance remain independently verifiable"],
      firstWorkflow: "Record, baseline, and trace one exact Initiative source.",
      exclusions: ["Baseline approval", "Executable authorization"],
      profile: "software",
    }, actorId)
    const initiative = await engine.createInitiative({
      title: "Govern the current Product inputs",
      outcome: "The exact P0 source set remains repeatable and attributable.",
      scope: ["Source intake", "Candidate source baseline", "Provenance"],
      exclusions: ["Approval substitution"],
    }, actorId)
    initiativeId = initiative.id
  })

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true })
  })

  function sourceInput(overrides: Partial<SourceRecordInput> = {}): SourceRecordInput {
    return {
      initiativeId,
      sourceType: "requirements",
      title: "Reviewed requirements source",
      description: "The exact reviewed requirements input for the bounded Initiative source-governance workflow.",
      locator: { kind: "logical", value: "requirements.reviewed" },
      revisionIdentity: { kind: "resource-revision", value: "GAEP-REQ-001@1" },
      contentDigest: digest("a"),
      digestScope: "Canonical UTF-8 requirements content",
      owner: { kind: "human", id: actorId },
      semanticAuthority: {
        standing: "authoritative",
        domain: "Initiative requirements",
        scope: ["P0 source intake"],
        basis: "The accountable Product owner declared this exact revision as the governing requirements input.",
        declaredBy: { kind: "human", id: actorId },
      },
      knowledgeDisposition: "confirmed",
      trust: { sourceAuthenticity: "verified", contentIntegrity: "verified" },
      informationClassification: "internal",
      rights: { status: "verified", basis: "Internal Product use is recorded for this source." },
      freshness: {
        status: "fresh",
        assessedAt: "2026-07-25T00:00:00.000Z",
        basis: "The accountable owner reviewed this exact revision.",
        validUntil: "2026-08-25T00:00:00.000Z",
      },
      availability: { status: "available", basis: "The logical source resolver is available." },
      limitations: ["Live external-system availability is outside this record."],
      ...overrides,
    }
  }

  function reference(source: SourceRecord): ExactSourceReference {
    return {
      sourceId: source.id,
      sourceRevision: source.revision,
      recordDigest: canonicalDigest(source),
      contentDigest: source.contentDigest,
    }
  }

  function baselineInput(member: ExactSourceReference): SourceBaselineInput {
    return {
      initiativeId,
      title: "P0 exact source candidate",
      purpose: "Freeze the exact reviewed Source revisions for repeatable analysis without designating an approved Baseline Set.",
      scope: ["P0 source inputs"],
      members: [member],
      limitations: ["Human baseline approval and designation are not represented."],
    }
  }

  function provenanceInput(member: ExactSourceReference): SourceProvenanceInput {
    return {
      initiativeId,
      target: {
        kind: "claim",
        lineageId: "00000000-0000-4000-8000-000000000100",
        revision: 1,
        digest: member.contentDigest,
        label: "The reviewed requirements source is recorded",
      },
      disposition: "confirmed",
      sources: [{
        reference: member,
        role: "origin",
        rationale: "The exact Source revision is the direct origin of this bounded claim.",
      }],
      transformations: [],
      contributors: [{ kind: "human", id: actorId }],
      generation: { kind: "manual", processId: "source-review-v1" },
      omissions: ["This lineage does not establish Product readiness."],
      uncertainty: [],
    }
  }

  function replacePortableRecord(
    bundle: ProductExportBundle,
    path: string,
    replace: (content: unknown) => unknown,
  ): ProductExportBundle {
    const copy = structuredClone(bundle)
    const record = copy.records.find((candidate) => candidate.path === path)
    const member = copy.manifest.members.find((candidate) => candidate.path === path)
    if (!record || !member) throw new Error(`Missing portable test record: ${path}`)
    record.content = replace(record.content) as never
    member.digest = canonicalDigest(record.content)
    member.byteLength = Buffer.byteLength(`${JSON.stringify(record.content, null, 2)}\n`)
    copy.manifest.membershipDigest = canonicalDigest(
      copy.manifest.members.map(({ path: memberPath, digest: memberDigest }) => ({
        path: memberPath,
        digest: memberDigest,
      })),
    )
    return copy
  }

  it("records immutable Source history, an exact candidate snapshot, provenance, and a ready assessment", async () => {
    const source = await engine.sourceGovernance.createSource(sourceInput(), actorId)
    const baseline = await engine.sourceGovernance.createBaseline(baselineInput(reference(source)), actorId)
    const provenance = await engine.sourceGovernance.recordProvenance(provenanceInput(reference(source)), actorId)

    expect(await engine.sourceGovernance.assess(initiativeId)).toMatchObject({
      sourceCount: 1,
      baselineCount: 1,
      provenanceCount: 1,
      currentBaseline: {
        id: baseline.id,
        status: "current",
        memberCount: 1,
      },
      staleSourceCount: 0,
      unknownAuthorityCount: 0,
      unbaselinedSourceCount: 0,
      unprovenancedSourceCount: 0,
      state: "ready",
      reasons: [],
    })
    expect(provenance.authorityBoundary).toContain("does-not-approve")
    expect(await engine.sourceGovernance.listSourceHistory(source.id)).toHaveLength(1)

    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as {
        eventType: string
        payload: Record<string, unknown>
      })
    expect(events.find((event) => event.eventType === "source.recorded")?.payload).toMatchObject({
      revision: 1,
      recordDigest: canonicalDigest(source),
      contentDigest: source.contentDigest,
      semanticAuthorityStanding: "authoritative",
      authorityBoundary: source.authorityBoundary,
    })
    expect(events.find((event) => event.eventType === "source.baseline.created")?.payload).toMatchObject({
      membershipDigest: baseline.membershipDigest,
      memberCount: 1,
      state: "candidate",
      authorityBoundary: baseline.authorityBoundary,
    })
    expect(await engine.workspaceHealth()).toMatchObject({
      status: "healthy",
      issues: [],
    })
  })

  it("marks exact baseline and provenance bindings stale after Source revision and recovers through new exact records", async () => {
    const first = await engine.sourceGovernance.createSource(sourceInput(), actorId)
    const baseline = await engine.sourceGovernance.createBaseline(baselineInput(reference(first)), actorId)
    await engine.sourceGovernance.recordProvenance(provenanceInput(reference(first)), actorId)
    const second = await engine.sourceGovernance.reviseSource(first.id, 1, sourceInput({
      revisionIdentity: { kind: "resource-revision", value: "GAEP-REQ-001@2" },
      contentDigest: digest("b"),
      freshness: {
        status: "fresh",
        assessedAt: "2026-07-25T01:00:00.000Z",
        basis: "The accountable owner reviewed the superseding exact revision.",
        validUntil: "2026-08-25T01:00:00.000Z",
      },
    }), actorId)

    expect(await engine.sourceGovernance.assess(initiativeId)).toMatchObject({
      currentBaseline: { status: "stale" },
      unprovenancedSourceCount: 1,
      state: "attention-required",
    })
    expect(await engine.workspaceHealth()).toMatchObject({
      status: "degraded",
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "source.baseline-stale" }),
        expect.objectContaining({ code: "source.provenance-stale" }),
      ]),
    })
    expect((await engine.sourceGovernance.listSourceHistory(first.id)).map((entry) => entry.revision)).toEqual([2, 1])

    await engine.sourceGovernance.reviseBaseline(
      baseline.id,
      baseline.revision,
      baselineInput(reference(second)),
      actorId,
    )
    await engine.sourceGovernance.recordProvenance(provenanceInput(reference(second)), actorId)
    expect(await engine.sourceGovernance.assess(initiativeId)).toMatchObject({
      currentBaseline: { revision: 2, status: "current" },
      unprovenancedSourceCount: 0,
      state: "ready",
    })
  })

  it("rejects actor substitution, stale revisions, forged source bindings, and unresolved transformations", async () => {
    await expect(engine.sourceGovernance.createSource(sourceInput({
      semanticAuthority: {
        ...sourceInput().semanticAuthority,
        declaredBy: { kind: "human", id: "another-human" },
      },
    }), actorId)).rejects.toThrow(/must match the local mutation actor/)

    const source = await engine.sourceGovernance.createSource(sourceInput(), actorId)
    await expect(engine.sourceGovernance.reviseSource(
      source.id,
      2,
      sourceInput({ revisionIdentity: { kind: "resource-revision", value: "GAEP-REQ-001@2" } }),
      actorId,
    )).rejects.toThrow(/changed before revision/)
    await expect(engine.sourceGovernance.createBaseline(
      baselineInput({ ...reference(source), recordDigest: digest("f") }),
      actorId,
    )).rejects.toThrow(/does not match/)
    await expect(engine.sourceGovernance.recordProvenance({
      ...provenanceInput(reference(source)),
      target: {
        ...provenanceInput(reference(source)).target,
        digest: digest("e"),
      } as SourceProvenanceInput["target"],
    }, actorId)).rejects.toThrow(/target digest is not produced/)
  })

  it("rejects provenance amendment substitution and mutation after terminal Initiative state", async () => {
    const source = await engine.sourceGovernance.createSource(sourceInput(), actorId)
    const provenance = await engine.sourceGovernance.recordProvenance(provenanceInput(reference(source)), actorId)
    await expect(engine.sourceGovernance.recordProvenance({
      ...provenanceInput(reference(source)),
      amendment: {
        recordId: provenance.id,
        recordDigest: digest("f"),
        rationale: "Correct the exact prior provenance record without overwriting its history.",
      },
    }, actorId)).rejects.toThrow(/does not bind the exact prior record/)

    await engine.updateInitiativeState(initiativeId, "cancelled", "The bounded source review was cancelled.", actorId)
    await expect(engine.sourceGovernance.createSource(sourceInput({
      title: "Late source",
    }), actorId)).rejects.toThrow(/Terminal Initiative cancelled source governance is immutable/)
  })

  it("exports and previews the complete portable Source history, candidate Baseline, and Provenance graph", async () => {
    const first = await engine.sourceGovernance.createSource(sourceInput(), actorId)
    const second = await engine.sourceGovernance.reviseSource(first.id, first.revision, sourceInput({
      revisionIdentity: { kind: "resource-revision", value: "GAEP-REQ-001@2" },
      contentDigest: digest("b"),
    }), actorId)
    const baseline = await engine.sourceGovernance.createBaseline(baselineInput(reference(second)), actorId)
    const provenance = await engine.sourceGovernance.recordProvenance(provenanceInput(reference(second)), actorId)

    const bundle = await engine.productStudio.buildPortableExport()
    expect(bundle.manifest.members.map((member) => member.path)).toEqual(expect.arrayContaining([
      `sources/${second.id}.json`,
      `source-history/source-${second.id}-r1.json`,
      `source-history/source-${second.id}-r2.json`,
      `source-baselines/${baseline.id}.json`,
      `source-baseline-history/baseline-${baseline.id}-r1.json`,
      `source-provenance/${provenance.id}.json`,
    ]))
    await expect(engine.productStudio.previewImportBundle(bundle)).resolves.toMatchObject({
      status: "compatible",
      importMutation: "not-performed",
    })
  })

  it("rejects re-signed portable Source, Baseline, and Provenance graph substitution", async () => {
    const source = await engine.sourceGovernance.createSource(sourceInput(), actorId)
    const baseline = await engine.sourceGovernance.createBaseline(baselineInput(reference(source)), actorId)
    const provenance = await engine.sourceGovernance.recordProvenance(provenanceInput(reference(source)), actorId)
    const bundle = await engine.productStudio.buildPortableExport()

    const forgedHistory = replacePortableRecord(
      bundle,
      `source-history/source-${source.id}-r1.json`,
      (content) => ({ ...(content as object), recordDigest: digest("f") }),
    )
    await expect(engine.productStudio.previewImportBundle(forgedHistory))
      .rejects.toThrow(/Source history snapshot digest mismatch/)

    const forgedBaseline = replacePortableRecord(
      bundle,
      `source-baselines/${baseline.id}.json`,
      (content) => {
        const candidate = content as SourceBaselineInput & { members: ExactSourceReference[] }
        const members = candidate.members.map((member) => ({ ...member, recordDigest: digest("e") }))
        return { ...candidate, members, membershipDigest: canonicalDigest(members) }
      },
    )
    await expect(engine.productStudio.previewImportBundle(forgedBaseline))
      .rejects.toThrow(/current Source Baseline does not match immutable history/)

    const forgedProvenance = replacePortableRecord(
      bundle,
      `source-provenance/${provenance.id}.json`,
      (content) => ({
        ...(content as object),
        target: {
          ...((content as { target: object }).target),
          digest: digest("d"),
        },
      }),
    )
    await expect(engine.productStudio.previewImportBundle(forgedProvenance))
      .rejects.toThrow(/target is not produced by its exact lineage/)
  })

  it("requires explicit human disclosure review for sensitive portable Sources", async () => {
    const source = await engine.sourceGovernance.createSource(sourceInput({
      informationClassification: "confidential",
    }), actorId)
    await expect(engine.productStudio.buildPortableExport()).rejects.toThrow(/explicit disclosure review is required/)
    await expect(engine.productStudio.buildPortableExport({
      reviewedRecordIds: [source.id],
      actorId,
      reviewedAt: "2026-07-25T02:00:00.000Z",
    })).resolves.toMatchObject({
      manifest: {
        disclosureReview: {
          reviewedRecordIds: [source.id],
          reviewedBy: { kind: "human", id: actorId },
        },
      },
    })
  })
})
