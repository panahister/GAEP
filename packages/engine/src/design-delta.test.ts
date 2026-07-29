import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type {
  DesignDeltaInput,
  DesignToRequirementBinding,
  DesignerReadyGate,
  ExactSourceReference,
  FinalizedFigmaSnapshotImport,
  Initiative,
  Product,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { DesignDeltaService, designDeltaComparisonReceiptDigest } from "./design-delta.js"
import { GaepEngine } from "./engine.js"
import type { SourceGovernanceService } from "./source-governance.js"

const actorId = "product-owner"
const digest = (value: string) => `sha256:${value.repeat(64).slice(0, 64)}` as const

describe("Design Delta service", () => {
  let workspace: string
  let engine: GaepEngine
  let service: DesignDeltaService
  let product: Product
  let initiative: Initiative
  let sourceReference: ExactSourceReference
  let designerReadyGate: DesignerReadyGate
  let finalizedSnapshot: FinalizedFigmaSnapshotImport
  let designBinding: DesignToRequirementBinding

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "gaep-design-delta-"))
    engine = new GaepEngine(workspace, [])
    product = await engine.createProduct({
      name: "Atlas",
      summary: "A governed Product with exact returned-design delta boundaries.",
      problem: "Returned design differences can be mistaken for approved changes or synchronization authority.",
      affectedUsers: "Product owners, designers, engineers, reviewers, and assurance teams",
      desiredOutcome: "Design differences remain exact, contestable review candidates.",
      successSignals: ["Every delta binds exact source and target snapshots"],
      firstWorkflow: "Review one bounded Design Delta candidate.",
      exclusions: ["Automatic merge", "Automatic baseline", "Automatic readiness"],
      profile: "software",
    }, actorId)
    initiative = await engine.createInitiative({
      title: "Compare the returned customer portal design",
      outcome: "Reviewers can inspect one exact source-to-return delta candidate.",
      scope: ["Customer portal returned design"],
      exclusions: ["Automatic resolution or synchronization"],
    }, actorId)

    designerReadyGate = {
      id: "50000000-0000-4000-8000-000000000001",
      initiativeId: initiative.id,
      revision: 2,
      membershipDigest: digest("1"),
      assessmentReceiptDigest: digest("2"),
      candidateResult: "incomplete",
      prerequisites: [{ key: "design-requirements", digest: digest("3") }],
    } as unknown as DesignerReadyGate
    finalizedSnapshot = {
      id: "50000000-0000-4000-8000-000000000002",
      initiativeId: initiative.id,
      revision: 2,
      membershipDigest: digest("4"),
      reconciliationDigest: digest("5"),
      reviewState: "held",
      items: [{ key: "primary-component", contentDigest: digest("6") }],
    } as unknown as FinalizedFigmaSnapshotImport
    designBinding = {
      id: "50000000-0000-4000-8000-000000000003",
      initiativeId: initiative.id,
      revision: 2,
      membershipDigest: digest("7"),
      reconciliationDigest: digest("8"),
      reviewState: "held",
      bindings: [{ key: "primary-component-binding", provenanceDigest: digest("9") }],
    } as unknown as DesignToRequirementBinding

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
    service = new DesignDeltaService(
      engine.repository,
      () => engine.readProduct(),
      (id) => engine.readInitiative(id),
      sourceGovernance,
      {
        designerReadyGate: { readCurrent: async () => designerReadyGate },
        finalizedSnapshot: { readCurrent: async () => finalizedSnapshot },
        designBinding: { readCurrent: async () => designBinding },
      },
    )
  })

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true })
  })

  async function input(overrides: Partial<DesignDeltaInput> = {}): Promise<DesignDeltaInput> {
    const base = {
      initiativeId: initiative.id,
      context: {
        productRevision: product.revision!,
        productDigest: canonicalDigest(product),
        initiativeRevision: initiative.revision!,
        initiativeDigest: canonicalDigest(initiative),
      },
      informationClassification: "internal" as const,
      title: "Customer portal returned-design delta candidate",
      objectiveDigest: digest("a"),
      designerReadyGate: {
        recordId: designerReadyGate.id,
        revision: designerReadyGate.revision,
        digest: canonicalDigest(designerReadyGate),
        membershipDigest: designerReadyGate.membershipDigest,
        prerequisiteCatalogDigest: canonicalDigest(designerReadyGate.prerequisites),
        assessmentReceiptDigest: designerReadyGate.assessmentReceiptDigest,
        candidateResult: designerReadyGate.candidateResult,
      },
      finalizedSnapshot: {
        recordId: finalizedSnapshot.id,
        revision: finalizedSnapshot.revision,
        digest: canonicalDigest(finalizedSnapshot),
        membershipDigest: finalizedSnapshot.membershipDigest,
        itemCatalogDigest: canonicalDigest(finalizedSnapshot.items),
        reconciliationDigest: finalizedSnapshot.reconciliationDigest,
        reviewState: finalizedSnapshot.reviewState,
      },
      designBinding: {
        recordId: designBinding.id,
        revision: designBinding.revision,
        digest: canonicalDigest(designBinding),
        membershipDigest: designBinding.membershipDigest,
        bindingCatalogDigest: canonicalDigest(designBinding.bindings),
        reconciliationDigest: designBinding.reconciliationDigest,
        reviewState: designBinding.reviewState,
      },
      sourceSnapshotDigest: canonicalDigest(designerReadyGate.prerequisites),
      targetSnapshotDigest: canonicalDigest(finalizedSnapshot.items),
      comparisonDefinitionDigest: digest("b"),
      comparisonReceiptDigest: digest("0"),
      sourceItemCount: 12,
      targetItemCount: 1,
      deltas: [{
        key: "changed-primary-component",
        subjectKind: "design-item" as const,
        subjectKey: "primary-component",
        changeKind: "changed" as const,
        sourceDigest: digest("c"),
        targetDigest: digest("e"),
        freshness: "current" as const,
        impactState: "not-assessed" as const,
        evidenceState: "source-recorded" as const,
        evidenceDigests: [],
        sources: [sourceReference],
      }],
      comparisonState: "exact" as const,
      provenanceState: "exact" as const,
      candidateResult: "delta-detected-candidate" as const,
      unresolvedMappings: [],
      unresolvedQuestions: [],
      limitations: ["Detected differences remain candidates for accountable review and resolution."],
      reviewState: "ready-for-human-review" as const,
      deltaCompletenessState: "not-established" as const,
      externalCompletenessState: "not-established" as const,
      designValidityState: "not-established" as const,
      designApprovalState: "not-established" as const,
      designBaselineState: "not-established" as const,
      readinessState: "not-established" as const,
      conflictResolutionAuthorityState: "not-granted" as const,
      synchronizationAuthorityState: "not-granted" as const,
      figmaConnectionAuthorityState: "not-granted" as const,
      credentialAuthorityState: "not-granted" as const,
      permissionGrantState: "not-granted" as const,
      importExecutionState: "not-performed" as const,
      writeExecutionState: "not-performed" as const,
      implementationAuthorityState: "not-granted" as const,
      ...overrides,
    }
    return { ...base, comparisonReceiptDigest: designDeltaComparisonReceiptDigest(base) }
  }

  it("creates, revises, assesses, projects, and preserves immutable candidate history", async () => {
    const created = await service.create(await input(), actorId)
    expect(await service.assess(initiative.id)).toMatchObject({
      deltaCount: 1,
      changedCount: 1,
      candidateResult: "delta-detected-candidate",
      state: "complete-for-review",
      reasons: [],
    })
    const projection = await service.project(initiative.id)
    expect(projection.candidate).toMatchObject({ id: created.id, deltaCount: 1, candidateResult: "delta-detected-candidate" })
    expect(projection.authorityBoundary).toContain("does-not-establish-delta-completeness")
    expect(JSON.stringify(projection)).not.toContain("product-owner")

    const revised = await service.revise(created.id, 1, await input({
      candidateResult: "incomplete",
      reviewState: "held",
      unresolvedQuestions: ["Confirm the returned component identity."],
    }), actorId)
    expect(revised.revision).toBe(2)
    expect((await service.listHistory(created.id)).map((entry) => entry.revision)).toEqual([2, 1])
    expect((await service.assess(initiative.id)).state).toBe("attention-required")

  })

  it("fails closed on forged comparison receipts and superseded dependencies", async () => {
    await expect(service.create({ ...await input(), comparisonReceiptDigest: digest("f") }, actorId))
      .rejects.toThrow("comparison receipt")

    const created = await service.create(await input(), actorId)
    designerReadyGate = { ...designerReadyGate, revision: 3 } as DesignerReadyGate
    const status = await service.assess(initiative.id)
    expect(status.staleBindingCount).toBeGreaterThan(0)
    expect(status.state).toBe("attention-required")
    expect((await service.healthIssues()).map((issue) => issue.code)).toContain("design-delta.review-required")
    expect((await service.read(created.id)).revision).toBe(1)
  })

  it("keeps audit payloads minimized and never records resolution, synchronization, readiness, or action authority", async () => {
    const created = await service.create(await input(), actorId)
    const audit = await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8")
    const event = audit.trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>)
      .find((entry) => entry.eventType === "design-delta.created")
    expect(event).toBeDefined()
    const serialized = JSON.stringify(event)
    expect(serialized).toContain(created.comparisonReceiptDigest)
    expect(serialized).toContain('"conflictResolutionAuthorityState":"not-granted"')
    expect(serialized).toContain('"synchronizationAuthorityState":"not-granted"')
    expect(serialized).toContain('"readinessState":"not-established"')
    expect(serialized).toContain('"actionAuthorityState":"not-granted"')
    expect(serialized).not.toContain("Detected differences remain candidates")
  })
})
