import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type {
  DesignConflictResolutionInput,
  DesignDelta,
  ExactSourceReference,
  Initiative,
  Product,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  DesignConflictResolutionService,
  designConflictResolutionReceiptDigest,
  designDeltaResolutionReference,
} from "./design-conflict-resolution.js"
import { GaepEngine } from "./engine.js"
import type { SourceGovernanceService } from "./source-governance.js"

const actorId = "design-owner"
const digest = (value: string) => `sha256:${value.repeat(64).slice(0, 64)}` as const

describe("Design Conflict Resolution service", () => {
  let workspace: string
  let engine: GaepEngine
  let service: DesignConflictResolutionService
  let product: Product
  let initiative: Initiative
  let sourceReference: ExactSourceReference
  let designDelta: DesignDelta

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "gaep-design-conflict-resolution-"))
    engine = new GaepEngine(workspace, [])
    product = await engine.createProduct({
      name: "Atlas",
      summary: "A governed Product with exact design conflict candidate boundaries.",
      problem: "Design conflicts can be mistaken for applied resolution or enforced approval authority.",
      affectedUsers: "Product owners, designers, engineers, reviewers, and assurance teams",
      desiredOutcome: "Every conflict action remains an exact, attributable, unapplied review candidate.",
      successSignals: ["Every resolution binds one exact conflicting delta"],
      firstWorkflow: "Review one bounded Design Conflict Resolution candidate.",
      exclusions: ["Automatic resolution", "Automatic synchronization", "Enforced separation of duties"],
      profile: "software",
    }, actorId)
    initiative = await engine.createInitiative({
      title: "Resolve the customer portal design conflict",
      outcome: "Reviewers can inspect one exact conflict action candidate.",
      scope: ["Customer portal returned-design conflict"],
      exclusions: ["Automatic merge, baseline, approval, or synchronization"],
    }, actorId)

    const source = {
      id: "44444444-4444-4444-8444-444444444444",
      revision: 1,
      initiativeId: initiative.id,
      contentDigest: digest("d"),
    }
    sourceReference = {
      sourceId: source.id,
      sourceRevision: source.revision,
      recordDigest: canonicalDigest(source),
      contentDigest: source.contentDigest,
    }
    const sourceGovernance = {
      listSources: async () => [source],
      readSourceRevision: async () => ({ snapshot: source, recordDigest: canonicalDigest(source) }),
    } as unknown as SourceGovernanceService
    designDelta = {
      id: "50000000-0000-4000-8000-000000000001",
      initiativeId: initiative.id,
      revision: 2,
      membershipDigest: digest("1"),
      comparisonReceiptDigest: digest("2"),
      candidateResult: "conflict-candidate",
      reviewState: "ready-for-human-review",
      deltas: [{
        key: "conflicting-primary-component",
        subjectKind: "design-item",
        subjectKey: "primary-component",
        changeKind: "conflicting",
        sourceDigest: digest("3"),
        targetDigest: digest("4"),
        freshness: "current",
        impactState: "not-assessed",
        evidenceState: "human-reviewed",
        evidenceDigests: [digest("5")],
        sources: [sourceReference],
      }],
    } as unknown as DesignDelta
    service = new DesignConflictResolutionService(
      engine.repository,
      () => engine.readProduct(),
      (id) => engine.readInitiative(id),
      sourceGovernance,
      { readCurrent: async () => designDelta },
    )
  })

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true })
  })

  async function input(overrides: Partial<DesignConflictResolutionInput> = {}): Promise<DesignConflictResolutionInput> {
    const conflict = designDelta.deltas[0]!
    const base = {
      initiativeId: initiative.id,
      context: {
        productRevision: product.revision!,
        productDigest: canonicalDigest(product),
        initiativeRevision: initiative.revision!,
        initiativeDigest: canonicalDigest(initiative),
      },
      informationClassification: "internal" as const,
      title: "Customer portal design conflict resolution candidate",
      objectiveDigest: digest("6"),
      designDelta: designDeltaResolutionReference(designDelta),
      resolutionDefinitionDigest: digest("7"),
      resolutionReceiptDigest: digest("0"),
      conflictCount: 1,
      resolutions: [{
        key: "resolve-primary-component",
        conflictKey: conflict.key,
        conflictDigest: canonicalDigest(conflict),
        subjectKind: conflict.subjectKind,
        resolutionKind: "merge-candidate" as const,
        decisionDigest: digest("8"),
        scope: "single-conflict" as const,
        decisionState: "human-reviewed" as const,
        evidenceDigests: [digest("9")],
        sources: [sourceReference],
        proposedBy: { kind: "human" as const, id: "design-owner" },
        proposedAt: "2026-07-29T23:50:00Z",
        reviewedBy: { kind: "human" as const, id: "product-owner" },
        reviewedAt: "2026-07-29T23:55:00Z",
        validUntil: "2030-08-29T23:50:00Z",
        separationOfDutiesState: "distinct-actor-declared" as const,
        effectState: "not-applied" as const,
      }],
      coverageState: "candidate-complete" as const,
      provenanceState: "exact" as const,
      candidateResult: "conflict-plan-candidate" as const,
      unresolvedConflictKeys: [],
      unresolvedQuestions: [],
      limitations: ["Founder mode records attribution but does not enforce separation of duties."],
      reviewState: "ready-for-human-review" as const,
      separationOfDutiesEnforcementState: "not-established" as const,
      conflictResolutionAuthorityState: "not-granted" as const,
      synchronizationAuthorityState: "not-granted" as const,
      designValidityState: "not-established" as const,
      designApprovalState: "not-established" as const,
      designBaselineState: "not-established" as const,
      readinessState: "not-established" as const,
      figmaConnectionAuthorityState: "not-granted" as const,
      credentialAuthorityState: "not-granted" as const,
      permissionGrantState: "not-granted" as const,
      importExecutionState: "not-performed" as const,
      writeExecutionState: "not-performed" as const,
      implementationAuthorityState: "not-granted" as const,
      ...overrides,
    }
    return { ...base, resolutionReceiptDigest: designConflictResolutionReceiptDigest(base) }
  }

  it("creates, revises, assesses, projects, and preserves immutable candidate history", async () => {
    const created = await service.create(await input(), actorId)
    expect(await service.assess(initiative.id)).toMatchObject({
      conflictCount: 1,
      resolutionCount: 1,
      mergeCount: 1,
      humanReviewedCount: 1,
      distinctActorDeclaredCount: 1,
      candidateResult: "conflict-plan-candidate",
      state: "complete-for-review",
      reasons: [],
    })
    const projection = await service.project(initiative.id)
    expect(projection.candidate).toMatchObject({ id: created.id, resolutionCount: 1 })
    expect(projection.authorityBoundary).toContain("does-not-enforce-separation-of-duties")
    expect(JSON.stringify(projection)).not.toContain("design-owner")
    expect(JSON.stringify(projection)).not.toContain("product-owner")

    const revised = await service.revise(created.id, 1, await input({
      candidateResult: "incomplete",
      coverageState: "partial",
      reviewState: "held",
      resolutions: [],
      unresolvedConflictKeys: ["conflicting-primary-component"],
      unresolvedQuestions: ["Confirm the accountable resolution path."],
    }), actorId)
    expect(revised.revision).toBe(2)
    expect((await service.listHistory(created.id)).map((entry) => entry.revision)).toEqual([2, 1])
    expect((await service.assess(initiative.id)).state).toBe("attention-required")

  })

  it("fails closed on forged receipts, non-conflicting entries, and superseded Design Delta bindings", async () => {
    await expect(service.create({ ...await input(), resolutionReceiptDigest: digest("f") }, actorId))
      .rejects.toThrow("receipt")

    const wrongConflict = await input()
    wrongConflict.resolutions[0] = { ...wrongConflict.resolutions[0]!, conflictDigest: digest("e") }
    wrongConflict.resolutionReceiptDigest = designConflictResolutionReceiptDigest(wrongConflict)
    await expect(service.create(wrongConflict, actorId)).rejects.toThrow("exact conflicting")

    const created = await service.create(await input(), actorId)
    designDelta = { ...designDelta, revision: 3 } as DesignDelta
    const status = await service.assess(initiative.id)
    expect(status.staleBindingCount).toBeGreaterThan(0)
    expect(status.state).toBe("attention-required")
    expect((await service.healthIssues()).map((issue) => issue.code)).toContain("design-conflict-resolution.review-required")
    expect((await service.read(created.id)).revision).toBe(1)
  })

  it("keeps audit payloads minimized and never records content or action authority", async () => {
    const created = await service.create(await input(), actorId)
    const audit = await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8")
    const event = audit.trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>)
      .find((entry) => entry.eventType === "design-conflict-resolution.created")
    expect(event).toBeDefined()
    const serialized = JSON.stringify(event)
    expect(serialized).toContain(created.resolutionReceiptDigest)
    expect(serialized).toContain('"separationOfDutiesEnforcementState":"not-established"')
    expect(serialized).toContain('"synchronizationAuthorityState":"not-granted"')
    expect(serialized).toContain('"actionAuthorityState":"not-granted"')
    expect(serialized).not.toContain("Founder mode records attribution")
    expect(serialized).not.toContain("product-owner")
  })
})
