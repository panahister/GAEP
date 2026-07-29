import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  designerReadyPrerequisiteKeys,
  designerReadyPrerequisiteKinds,
  type DesignerReadyGateInput,
  type ExactSourceReference,
  type Initiative,
  type Product,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  DesignerReadyGateService,
  designerReadyAssessmentReceiptDigest,
  designerReadyPrerequisiteStatusDigest,
  type DesignerReadyDependencyServices,
} from "./designer-ready-gate.js"
import { GaepEngine } from "./engine.js"
import type { SourceGovernanceService } from "./source-governance.js"

const actorId = "product-owner"
const reviewedAt = "2026-07-29T22:20:00.000Z"
const digest = (value: string) => `sha256:${value.repeat(64).slice(0, 64)}` as const

describe("Designer-Ready Gate service", () => {
  let workspace: string
  let engine: GaepEngine
  let service: DesignerReadyGateService
  let product: Product
  let initiative: Initiative
  let sourceReference: ExactSourceReference
  let dependencies: DesignerReadyDependencyServices
  let dependencyRecords: Map<string, {
    id: string
    initiativeId: string
    kind: string
    membershipDigest: string
    revision: number
  }>

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "gaep-designer-ready-gate-"))
    engine = new GaepEngine(workspace, [])
    product = await engine.createProduct({
      name: "Atlas",
      summary: "A governed Product with explicit Designer-Ready evaluation boundaries.",
      problem: "A checklist can be mistaken for design readiness or permission to begin work.",
      affectedUsers: "Product owners, designers, engineers, reviewers, and assurance teams",
      desiredOutcome: "Designer-Ready results remain exact, contestable evaluation candidates.",
      successSignals: ["Every prerequisite evaluation binds exact current evidence"],
      firstWorkflow: "Review the bounded Designer-Ready gate candidate.",
      exclusions: ["Automatic readiness", "Automatic design approval", "Automatic action authority"],
      profile: "software",
    }, actorId)
    initiative = await engine.createInitiative({
      title: "Review customer portal design prerequisites",
      outcome: "Reviewers can inspect one exact Designer-Ready evaluation candidate.",
      scope: ["Customer portal design preparation"],
      exclusions: ["Automatic readiness or action"],
    }, actorId)

    dependencyRecords = new Map(designerReadyPrerequisiteKeys.map((key, index) => [key, {
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      initiativeId: initiative.id,
      kind: designerReadyPrerequisiteKinds[key],
      membershipDigest: digest(((index + 1) % 10).toString()),
      revision: 1,
    }]))
    dependencies = Object.fromEntries(designerReadyPrerequisiteKeys.map((key) => [key, {
      readCurrent: async () => dependencyRecords.get(key),
      assess: async () => ({ assessedAt: reviewedAt, state: "complete-for-review" as const }),
    }])) as unknown as DesignerReadyDependencyServices

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
    service = new DesignerReadyGateService(
      engine.repository,
      () => engine.readProduct(),
      (id) => engine.readInitiative(id),
      sourceGovernance,
      dependencies,
    )
  })

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true })
  })

  async function input(overrides: Partial<DesignerReadyGateInput> = {}): Promise<DesignerReadyGateInput> {
    const status = { assessedAt: reviewedAt, state: "complete-for-review" as const }
    const prerequisites = designerReadyPrerequisiteKeys.map((key) => {
      const record = dependencyRecords.get(key)!
      return {
        key,
        kind: designerReadyPrerequisiteKinds[key],
        recordId: record.id,
        revision: record.revision,
        digest: canonicalDigest(record),
        membershipDigest: record.membershipDigest,
        assessmentDigest: designerReadyPrerequisiteStatusDigest(status),
        assessmentState: status.state,
      }
    })
    const evaluations = designerReadyPrerequisiteKeys.map((prerequisiteKey, index) => ({
      prerequisiteKey,
      evaluationState: "satisfied-candidate" as const,
      freshness: "current" as const,
      evidenceState: "human-reviewed" as const,
      criteriaDigest: digest(((index + 2) % 10).toString()),
      evidenceDigests: [digest(((index + 3) % 10).toString())],
      sources: [sourceReference],
      reviewedBy: { kind: "human" as const, id: "accountable-design-reviewer" },
      reviewedAt,
    }))
    const base = {
      initiativeId: initiative.id,
      context: {
        productRevision: product.revision!,
        productDigest: canonicalDigest(product),
        initiativeRevision: initiative.revision!,
        initiativeDigest: canonicalDigest(initiative),
      },
      informationClassification: "internal" as const,
      title: "Customer portal Designer-Ready review candidate",
      objectiveDigest: digest("a"),
      prerequisites,
      evaluations,
      exceptions: [],
      assessmentDefinitionDigest: digest("b"),
      assessmentReceiptDigest: digest("0"),
      candidateResult: "pass-candidate" as const,
      unresolvedQuestions: [],
      limitations: ["A passing candidate is not permission, approval, baseline, or readiness."],
      reviewState: "ready-for-human-decision" as const,
      designCompletenessState: "not-established" as const,
      externalCompletenessState: "not-established" as const,
      designValidityState: "not-established" as const,
      designApprovalState: "not-established" as const,
      designBaselineState: "not-established" as const,
      readinessState: "not-established" as const,
      exceptionAuthorityState: "not-granted" as const,
      figmaConnectionAuthorityState: "not-granted" as const,
      credentialAuthorityState: "not-granted" as const,
      permissionGrantState: "not-granted" as const,
      importExecutionState: "not-performed" as const,
      writeExecutionState: "not-performed" as const,
      implementationAuthorityState: "not-granted" as const,
      ...overrides,
    }
    return {
      ...base,
      assessmentReceiptDigest: designerReadyAssessmentReceiptDigest(base),
    }
  }

  it("creates, revises, assesses, projects, and preserves immutable candidate history", async () => {
    const created = await service.create(await input(), actorId)
    const status = await service.assess(initiative.id)
    expect(status).toMatchObject({
      candidateResult: "pass-candidate",
      prerequisiteCount: designerReadyPrerequisiteKeys.length,
      satisfiedCount: designerReadyPrerequisiteKeys.length,
      humanReviewedCount: designerReadyPrerequisiteKeys.length,
      state: "complete-for-human-decision",
      reasons: [],
    })
    const projection = await service.project(initiative.id)
    expect(projection.candidate).toMatchObject({ id: created.id, candidateResult: "pass-candidate" })
    expect(JSON.stringify(projection)).not.toContain("accountable-design-reviewer")
    expect(projection.authorityBoundary).toContain("does-not-establish-design-completeness")

    const revisedInput = await input({
      candidateResult: "incomplete",
      reviewState: "held",
      unresolvedQuestions: ["Confirm the bounded designer handoff window."],
    })
    const revised = await service.revise(created.id, 1, revisedInput, actorId)
    expect(revised.revision).toBe(2)
    expect((await service.listHistory(created.id)).map((entry) => entry.revision)).toEqual([2, 1])
    expect((await service.assess(initiative.id)).state).toBe("attention-required")
  })

  it("fails closed on forged receipts and superseded prerequisite assessments", async () => {
    await expect(service.create({ ...await input(), assessmentReceiptDigest: digest("f") }, actorId))
      .rejects.toThrow("assessment receipt digest")

    const created = await service.create(await input(), actorId)
    const firstKey = designerReadyPrerequisiteKeys[0]
    dependencyRecords.set(firstKey, { ...dependencyRecords.get(firstKey)!, revision: 2 })
    const status = await service.assess(initiative.id)
    expect(status.staleBindingCount).toBeGreaterThan(0)
    expect(status.state).toBe("attention-required")
    expect((await service.healthIssues()).map((issue) => issue.code)).toContain("designer-ready-gate.review-required")
    expect((await service.read(created.id)).revision).toBe(1)
  })

  it("keeps audit payloads minimized and never records readiness or action authority", async () => {
    const created = await service.create(await input(), actorId)
    const audit = await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8")
    const event = audit.trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>)
      .find((entry) => entry.eventType === "designer-ready-gate.created")
    expect(event).toBeDefined()
    const serialized = JSON.stringify(event)
    expect(serialized).toContain(created.assessmentReceiptDigest)
    expect(serialized).toContain('"readinessState":"not-established"')
    expect(serialized).toContain('"actionAuthorityState":"not-granted"')
    expect(serialized).not.toContain("accountable-design-reviewer")
    expect(serialized).not.toContain("A passing candidate is not permission")
  })
})
