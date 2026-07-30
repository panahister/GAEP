import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  type DesignBaseline,
  type DesignDriftDetectionInput,
  type DesignRequirements,
  type DesignToRequirementBinding,
  type ExactSourceReference,
  type FinalizedFigmaSnapshotImport,
  type Initiative,
  type Product,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  DesignDriftDetectionService,
  designDriftBaselineReference,
  designDriftComparisonDigest,
  designDriftImplementationTargetCatalogDigest,
  designDriftRequirementsReference,
  designDriftSnapshotReference,
  designDriftTraceReference,
} from "./design-drift-detection.js"
import { GaepEngine } from "./engine.js"
import type { SourceGovernanceService } from "./source-governance.js"

const actorId = "drift-recorder"
const digest = (value: string) => `sha256:${value.repeat(64).slice(0, 64)}` as const

describe("Design Drift Detection service", () => {
  let workspace: string
  let engine: GaepEngine
  let service: DesignDriftDetectionService
  let product: Product
  let initiative: Initiative
  let baseline: DesignBaseline
  let snapshot: FinalizedFigmaSnapshotImport
  let requirements: DesignRequirements
  let trace: DesignToRequirementBinding
  let sourceReference: ExactSourceReference
  let currentSource: Record<string, unknown>

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "gaep-design-drift-"))
    engine = new GaepEngine(workspace, [])
    product = await engine.createProduct({
      name: "Atlas",
      summary: "A governed Product with version-bound design drift observations.",
      problem: "Requirements, returned design, and implementation targets can diverge without review.",
      affectedUsers: "Product owners, designers, engineers, reviewers, and assurance teams",
      desiredOutcome: "Reviewers inspect exact drift candidates without inferred authority.",
      successSignals: ["Every observation binds exact current evidence"],
      firstWorkflow: "Inspect one bounded Design Drift Detection candidate.",
      exclusions: ["Automatic re-baselining", "Automatic implementation changes", "Figma calls"],
      profile: "software",
    }, actorId)
    initiative = await engine.createInitiative({
      title: "Detect customer portal design drift",
      outcome: "Exact requirement-to-design and design-to-implementation observations are reviewable.",
      scope: ["Customer portal returned design and declared implementation targets"],
      exclusions: ["Automatic approval, remediation, implementation, or action authority"],
    }, actorId)

    currentSource = {
      id: "11111111-1111-4111-8111-111111111111",
      revision: 1,
      initiativeId: initiative.id,
      contentDigest: digest("1"),
    }
    sourceReference = {
      sourceId: currentSource.id as string,
      sourceRevision: currentSource.revision as number,
      recordDigest: canonicalDigest(currentSource),
      contentDigest: currentSource.contentDigest as typeof sourceReference.contentDigest,
    }
    snapshot = {
      id: "22222222-2222-4222-8222-222222222222",
      revision: 2,
      membershipDigest: digest("2"),
      returnReceipt: {
        externalFileIdentityDigest: digest("3"),
        returnedExternalVersionDigest: digest("4"),
      },
      items: [{ key: "portal-frame" }],
    } as unknown as FinalizedFigmaSnapshotImport
    requirements = {
      id: "33333333-3333-4333-8333-333333333333",
      revision: 3,
      membershipDigest: digest("5"),
      requirements: [{ key: "GAEP-REQ-001" }],
    } as unknown as DesignRequirements
    baseline = {
      id: "44444444-4444-4444-8444-444444444444",
      revision: 1,
      membershipDigest: digest("6"),
      baselineLineageId: "55555555-5555-4555-8555-555555555555",
      candidateSetId: "66666666-6666-4666-8666-666666666666",
      candidateSetRevision: 1,
      semanticVersion: "1.0.0",
      designationReceiptDigest: digest("7"),
      subject: {
        recordId: snapshot.id,
        revision: snapshot.revision,
        digest: canonicalDigest(snapshot),
        itemCatalogDigest: canonicalDigest(snapshot.items),
      },
    } as unknown as DesignBaseline
    trace = {
      id: "77777777-7777-4777-8777-777777777777",
      revision: 1,
      membershipDigest: digest("8"),
      reconciliationDigest: digest("9"),
      finalizedSnapshot: {
        recordId: snapshot.id,
        revision: snapshot.revision,
        digest: canonicalDigest(snapshot),
        membershipDigest: snapshot.membershipDigest,
        itemCatalogDigest: canonicalDigest(snapshot.items),
      },
      designRequirements: {
        recordId: requirements.id,
        revision: requirements.revision,
        digest: canonicalDigest(requirements),
        membershipDigest: requirements.membershipDigest,
        requirementCatalogDigest: canonicalDigest(requirements.requirements),
      },
    } as unknown as DesignToRequirementBinding
    const sourceSnapshot = { ...currentSource }
    const sourceGovernance = {
      listSources: async () => [currentSource],
      readSourceRevision: async () => ({ snapshot: sourceSnapshot, recordDigest: canonicalDigest(sourceSnapshot) }),
    } as unknown as SourceGovernanceService
    service = new DesignDriftDetectionService(
      engine.repository,
      () => engine.readProduct(),
      (id) => engine.readInitiative(id),
      sourceGovernance,
      {
        designBaseline: { readCurrent: async () => baseline },
        returnedFigmaSnapshot: { readCurrent: async () => snapshot },
        designRequirements: { readCurrent: async () => requirements },
        designTrace: { readCurrent: async () => trace },
      },
    )
  })

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true })
  })

  function input(overrides: Partial<DesignDriftDetectionInput> = {}): DesignDriftDetectionInput {
    const base = {
      initiativeId: initiative.id,
      context: {
        productRevision: product.revision!, productDigest: canonicalDigest(product),
        initiativeRevision: initiative.revision!, initiativeDigest: canonicalDigest(initiative),
      },
      informationClassification: "internal" as const,
      title: "Customer portal Design Drift Detection candidate",
      objectiveDigest: digest("a"),
      designBaseline: designDriftBaselineReference(baseline),
      returnedFigmaSnapshot: designDriftSnapshotReference(snapshot),
      designRequirements: designDriftRequirementsReference(requirements),
      designTrace: designDriftTraceReference(trace),
      implementationTargetCatalogRevision: 1,
      implementationTargets: [{
        key: "portal-component",
        kind: "component" as const,
        resourceLineageId: "88888888-8888-4888-8888-888888888888",
        resourceRevision: 2,
        contentDigest: digest("b"),
        representationDigest: digest("c"),
        requirementKeys: ["GAEP-REQ-001"],
        designItemKeys: ["portal-frame"],
        evidenceState: "human-reviewed" as const,
        evidenceDigests: [digest("d")],
        sources: [sourceReference],
        reviewedBy: { kind: "human" as const, id: "implementation-reviewer" },
        reviewedAt: "2026-07-30T03:00:00Z",
      }],
      implementationTargetCatalogDigest: digest("0"),
      comparisonPolicyDigest: digest("e"),
      observations: [{
        key: "design-implementation-portal",
        path: "design-to-implementation" as const,
        requirementKeys: ["GAEP-REQ-001"],
        designItemKey: "portal-frame",
        implementationTargetKey: "portal-component",
        baselineEvidenceDigest: digest("f"),
        currentEvidenceDigest: digest("0"),
        targetEvidenceDigest: digest("1"),
        classification: "changed" as const,
        severity: "medium" as const,
        evidenceState: "human-reviewed" as const,
        evidenceDigests: [digest("2")],
        sources: [sourceReference],
        reviewedBy: { kind: "human" as const, id: "drift-reviewer" },
        reviewedAt: "2026-07-30T03:05:00Z",
      }],
      comparisonDigest: digest("0"),
      remediationCandidates: [{
        key: "amend-portal-component",
        driftKeys: ["design-implementation-portal"],
        kind: "amend-implementation-candidate" as const,
        rationaleDigest: digest("3"),
        evidenceDigests: [digest("4")],
        sources: [sourceReference],
        proposedBy: { kind: "human" as const, id: "drift-reviewer" },
        proposedAt: "2026-07-30T03:10:00Z",
        validUntil: "2030-07-30T03:10:00Z",
        reviewState: "ready-for-human-review" as const,
        effectState: "not-applied" as const,
      }],
      candidateResult: "drift-detected-candidate" as const,
      unresolvedQuestions: [],
      limitations: ["The Design Baseline remains a candidate and comparison completeness is not established."],
      reviewState: "ready-for-human-review" as const,
      comparisonCompletenessState: "not-established" as const,
      externalCompletenessState: "not-established" as const,
      designValidityState: "not-established" as const,
      implementationValidityState: "not-established" as const,
      approvalState: "not-established" as const,
      baselineDesignationState: "not-established" as const,
      readinessState: "not-established" as const,
      remediationAuthorityState: "not-granted" as const,
      figmaConnectionAuthorityState: "not-granted" as const,
      credentialAuthorityState: "not-granted" as const,
      permissionGrantState: "not-granted" as const,
      importExecutionState: "not-performed" as const,
      writeExecutionState: "not-performed" as const,
      implementationAuthorityState: "not-granted" as const,
      ...overrides,
    }
    base.implementationTargetCatalogDigest = designDriftImplementationTargetCatalogDigest(base)
    base.comparisonDigest = designDriftComparisonDigest(base)
    return base
  }

  it("creates, revises, assesses, projects, and preserves immutable candidate history", async () => {
    const created = await service.create(input(), actorId)
    expect(await service.assess(initiative.id)).toMatchObject({
      observationCount: 1,
      designToImplementationCount: 1,
      driftCount: 1,
      remediationCandidateCount: 1,
      candidateResult: "drift-detected-candidate",
      state: "complete-for-human-review",
      reasons: [],
    })
    const projection = await service.project(initiative.id)
    expect(projection.candidate).toMatchObject({ id: created.id, observationCount: 1 })
    expect(projection.authorityBoundary).toContain("does-not-establish-an-actual-baseline")
    expect(JSON.stringify(projection)).not.toContain("drift-reviewer")
    const bundle = await engine.productStudio.buildPortableExport()
    expect(bundle.manifest.members.map((member) => member.path)).toEqual(expect.arrayContaining([
      `design-drift-detections/${created.id}.json`,
      `design-drift-detection-history/design-drift-detection-${created.id}-r1.json`,
    ]))

    const revised = await service.revise(created.id, 1, input({
      implementationTargetCatalogRevision: 2,
      observations: [{ ...input().observations[0]!, classification: "conformant", severity: "none" }],
      remediationCandidates: [],
      candidateResult: "no-drift-observed-candidate",
    }), actorId)
    expect(revised.revision).toBe(2)
    expect((await service.listHistory(created.id)).map((entry) => entry.revision)).toEqual([2, 1])
    expect((await service.assess(initiative.id))).toMatchObject({ conformantCount: 1, driftCount: 0 })
  })

  it("fails closed on forged receipts and catalog references, then exposes dependency and Source drift", async () => {
    await expect(service.create({ ...input(), comparisonDigest: digest("f") }, actorId)).rejects.toThrow("comparison digest")
    await expect(service.create(input({
      observations: [{ ...input().observations[0]!, designItemKey: "unknown-frame" }],
    }), actorId)).rejects.toThrow("design items")
    await service.create(input(), actorId)
    baseline = { ...baseline, revision: 2 }
    currentSource = { ...currentSource, revision: 2 }
    const status = await service.assess(initiative.id)
    expect(status.staleBindingCount).toBeGreaterThan(0)
    expect(status.staleSourceReferenceCount).toBe(1)
    expect(status.state).toBe("attention-required")
    expect((await service.healthIssues()).map((issue) => issue.code)).toContain("design-drift-detection.review-required")
  })

  it("keeps audit payloads minimized and never records human identity or remediation authority", async () => {
    const created = await service.create(input(), actorId)
    const audit = await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8")
    const event = audit.trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>)
      .find((entry) => entry.eventType === "design-drift-detection.created")
    expect(event).toBeDefined()
    const serialized = JSON.stringify(event)
    expect(serialized).toContain(created.comparisonDigest)
    expect(serialized).toContain('"remediationAuthorityState":"not-granted"')
    expect(serialized).toContain('"actionAuthorityState":"not-granted"')
    expect(serialized).not.toContain("drift-reviewer")
    expect(serialized).not.toContain("The Design Baseline remains")
  })
})
