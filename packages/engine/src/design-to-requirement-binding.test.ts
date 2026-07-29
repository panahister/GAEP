import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  type DecisionRegister,
  type DesignRequirements,
  type DesignToRequirementBindingInput,
  type ExactSourceReference,
  type FinalizedFigmaSnapshotImport,
  type Initiative,
  type Product,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import type { DecisionRegisterService } from "./decision-register.js"
import type { DesignRequirementsService } from "./design-requirements.js"
import { DesignToRequirementBindingService } from "./design-to-requirement-binding.js"
import { GaepEngine } from "./engine.js"
import type { FinalizedFigmaSnapshotImportService } from "./finalized-figma-snapshot-import.js"
import type { SourceGovernanceService } from "./source-governance.js"

const actorId = "product-owner"
const digest = (value: string) => `sha256:${value.repeat(64).slice(0, 64)}` as const

describe("Design-to-Requirement Binding service", () => {
  let workspace: string
  let engine: GaepEngine
  let service: DesignToRequirementBindingService
  let product: Product
  let initiative: Initiative
  let finalizedSnapshot: FinalizedFigmaSnapshotImport
  let requirements: DesignRequirements
  let decisions: DecisionRegister
  let sourceReference: ExactSourceReference

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "gaep-design-to-requirement-binding-"))
    engine = new GaepEngine(workspace, [])
    product = await engine.createProduct({
      name: "Atlas",
      summary: "A governed Product with explicit design trace review boundaries.",
      problem: "Design nodes can be mistaken for proved Requirement or Decision relationships.",
      affectedUsers: "Product owners, designers, engineers, reviewers, and assurance teams",
      desiredOutcome: "Design links remain exact, contestable review candidates.",
      successSignals: ["Every candidate link has exact dependency and provenance evidence"],
      firstWorkflow: "Bind finalized design item keys to current Requirement and Decision keys.",
      exclusions: ["Automatic relationship truth", "Automatic design approval", "Automatic implementation authority"],
      profile: "software",
    }, actorId)
    initiative = await engine.createInitiative({
      title: "Bind the customer portal design",
      outcome: "Reviewers can inspect exact candidate design relationships.",
      scope: ["Customer portal design trace"],
      exclusions: ["Automatic approval or action"],
    }, actorId)

    finalizedSnapshot = {
      id: "11111111-1111-4111-8111-111111111111",
      revision: 2,
      membershipDigest: digest("1"),
      initiativeId: initiative.id,
      items: [{ key: "customer-portal-component", kind: "component" }],
    } as unknown as FinalizedFigmaSnapshotImport
    requirements = {
      id: "22222222-2222-4222-8222-222222222222",
      revision: 3,
      membershipDigest: digest("2"),
      initiativeId: initiative.id,
      requirements: [{ key: "PORTAL-REQ-001" }],
    } as unknown as DesignRequirements
    decisions = {
      id: "33333333-3333-4333-8333-333333333333",
      revision: 4,
      membershipDigest: digest("3"),
      initiativeId: initiative.id,
      decisions: [{ key: "approve-portal-layout" }],
    } as unknown as DecisionRegister

    const source = {
      id: "44444444-4444-4444-8444-444444444444",
      revision: 1,
      initiativeId: initiative.id,
      contentDigest: digest("4"),
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
    service = new DesignToRequirementBindingService(
      engine.repository,
      () => engine.readProduct(),
      (id) => engine.readInitiative(id),
      sourceGovernance,
      { readCurrent: async () => finalizedSnapshot } as unknown as FinalizedFigmaSnapshotImportService,
      { readCurrent: async () => requirements } as unknown as DesignRequirementsService,
      { readCurrent: async () => decisions } as unknown as DecisionRegisterService,
    )
  })

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true })
  })

  function input(): DesignToRequirementBindingInput {
    const finalizedSnapshotReference = {
      recordId: finalizedSnapshot.id,
      revision: finalizedSnapshot.revision,
      digest: canonicalDigest(finalizedSnapshot),
      membershipDigest: finalizedSnapshot.membershipDigest,
      itemCatalogDigest: canonicalDigest(finalizedSnapshot.items),
    }
    const designRequirementsReference = {
      recordId: requirements.id,
      revision: requirements.revision,
      digest: canonicalDigest(requirements),
      membershipDigest: requirements.membershipDigest,
      requirementCatalogDigest: canonicalDigest(requirements.requirements),
    }
    const decisionRegisterReference = {
      recordId: decisions.id,
      revision: decisions.revision,
      digest: canonicalDigest(decisions),
      membershipDigest: decisions.membershipDigest,
      decisionCatalogDigest: canonicalDigest(decisions.decisions),
    }
    const bindings = [{
      key: "portal-component-binding",
      designItemKey: "customer-portal-component",
      designItemKind: "component" as const,
      requirementKeys: ["PORTAL-REQ-001"],
      decisionKeys: ["approve-portal-layout"],
      requirementRelationship: "addresses" as const,
      decisionRelationship: "implements-outcome" as const,
      provenanceDigest: digest("5"),
      evidenceState: "human-reviewed" as const,
      evidenceDigests: [digest("6")],
      reviewedBy: { kind: "human" as const, id: actorId },
      reviewedAt: "2026-07-29T21:30:00.000Z",
      sources: [sourceReference],
    }]
    const designItemCoverage = [{
      itemKey: "customer-portal-component",
      state: "bound-candidate" as const,
      bindingKeys: ["portal-component-binding"],
      rationaleDigest: digest("7"),
      sources: [sourceReference],
    }]
    const subjectCoverage = [{
      subjectType: "decision" as const,
      subjectKey: "approve-portal-layout",
      state: "bound-candidate" as const,
      bindingKeys: ["portal-component-binding"],
      rationaleDigest: digest("8"),
      sources: [sourceReference],
    }, {
      subjectType: "requirement" as const,
      subjectKey: "PORTAL-REQ-001",
      state: "bound-candidate" as const,
      bindingKeys: ["portal-component-binding"],
      rationaleDigest: digest("9"),
      sources: [sourceReference],
    }]
    const conflicts: DesignToRequirementBindingInput["conflicts"] = []
    const base = {
      initiativeId: initiative.id,
      context: {
        productRevision: product.revision!,
        productDigest: canonicalDigest(product),
        initiativeRevision: initiative.revision!,
        initiativeDigest: canonicalDigest(initiative),
      },
      informationClassification: "internal" as const,
      title: "Customer portal design binding registry",
      objectiveDigest: digest("a"),
      finalizedSnapshot: finalizedSnapshotReference,
      designRequirements: designRequirementsReference,
      decisionRegister: decisionRegisterReference,
      bindings,
      designItemCoverage,
      subjectCoverage,
      conflicts,
    }
    return {
      ...base,
      reconciliationDigest: canonicalDigest({
        finalizedSnapshot: finalizedSnapshotReference,
        designRequirements: designRequirementsReference,
        decisionRegister: decisionRegisterReference,
        bindingCatalogDigest: canonicalDigest(bindings),
        designItemCoverageDigest: canonicalDigest(designItemCoverage),
        subjectCoverageDigest: canonicalDigest(subjectCoverage),
        conflictCatalogDigest: canonicalDigest(conflicts),
      }),
      reconciliationState: "exact",
      candidateCoverageState: "candidate-complete",
      provenanceState: "exact",
      unresolvedQuestions: [],
      limitations: ["Candidate links do not establish relationship truth, completeness, validity, approval, readiness, or action authority"],
      reviewState: "ready-for-human-review",
      relationshipTruthState: "not-established",
      coverageCompletenessState: "not-established",
      requirementSatisfactionState: "not-established",
      decisionEffectivenessState: "not-established",
      externalCompletenessState: "not-established",
      designValidityState: "not-established",
      designApprovalState: "not-established",
      designBaselineState: "not-established",
      readinessState: "not-established",
      figmaConnectionAuthorityState: "not-granted",
      credentialAuthorityState: "not-granted",
      permissionGrantState: "not-granted",
      importExecutionState: "not-performed",
      writeExecutionState: "not-performed",
      implementationAuthorityState: "not-granted",
    }
  }

  it("persists, assesses, projects, audits, revises, and health-checks immutable candidates", async () => {
    const firstInput = input()
    const candidate = await service.create(firstInput, actorId)
    expect(candidate).toMatchObject({
      revision: 1,
      state: "candidate",
      relationshipTruthState: "not-established",
      coverageCompletenessState: "not-established",
      requirementSatisfactionState: "not-established",
      decisionEffectivenessState: "not-established",
      importExecutionState: "not-performed",
      writeExecutionState: "not-performed",
      authorityBoundary: expect.stringContaining("does-not-establish-relationship-truth"),
    })
    expect(await service.assess(initiative.id)).toMatchObject({
      candidate: { recordId: candidate.id, revision: 1, digest: canonicalDigest(candidate) },
      bindingCount: 1,
      humanReviewedBindingCount: 1,
      designItemCount: 1,
      boundDesignItemCount: 1,
      unboundDesignItemCount: 0,
      requirementCount: 1,
      boundRequirementCount: 1,
      unboundRequirementCount: 0,
      decisionCount: 1,
      boundDecisionCount: 1,
      unboundDecisionCount: 0,
      openConflictCount: 0,
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      unresolvedQuestionCount: 0,
      state: "complete-for-review",
      reasons: [],
    })
    const projection = await service.project(initiative.id)
    const { snapshotDigest, ...projectionBody } = projection
    expect(snapshotDigest).toBe(canonicalDigest(projectionBody))
    expect(projection).toMatchObject({
      candidate: {
        id: candidate.id,
        finalizedSnapshot: firstInput.finalizedSnapshot,
        designRequirements: firstInput.designRequirements,
        decisionRegister: firstInput.decisionRegister,
        bindingCount: 1,
        designItemCoverageCount: 1,
        subjectCoverageCount: 2,
        conflictCount: 0,
      },
      privacyBoundary: expect.stringContaining("not-figma-content-external-identities-requirement-text-decision-content"),
      authorityBoundary: expect.stringContaining("does-not-establish-relationship-truth"),
    })
    expect(JSON.stringify(projection)).not.toContain(actorId)
    expect(JSON.stringify(projection)).not.toContain("PORTAL-REQ-001")
    expect(await service.healthIssues()).toEqual([])

    const revised = await service.revise(candidate.id, candidate.revision, firstInput, actorId)
    expect(revised).toMatchObject({ id: candidate.id, revision: 2, predecessorDigest: canonicalDigest(candidate) })
    expect((await service.listHistory(candidate.id)).map((entry) => entry.revision)).toEqual([2, 1])

    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
    expect(events.at(-1)).toMatchObject({
      eventType: "design-to-requirement-binding.revised",
      payload: {
        revision: 2,
        recordDigest: canonicalDigest(revised),
        membershipDigest: revised.membershipDigest,
        predecessorDigest: canonicalDigest(candidate),
        finalizedSnapshot: revised.finalizedSnapshot,
        designRequirements: revised.designRequirements,
        decisionRegister: revised.decisionRegister,
        bindingCount: 1,
        designItemCoverageCount: 1,
        subjectCoverageCount: 2,
        conflictCount: 0,
        reconciliationDigest: revised.reconciliationDigest,
        reconciliationState: "exact",
        candidateCoverageState: "candidate-complete",
        provenanceState: "exact",
        relationshipTruthState: "not-established",
        coverageCompletenessState: "not-established",
        requirementSatisfactionState: "not-established",
        decisionEffectivenessState: "not-established",
        importExecutionState: "not-performed",
        writeExecutionState: "not-performed",
        implementationAuthorityState: "not-granted",
        actionAuthorityState: "not-granted",
      },
    })
    expect(JSON.stringify(events.at(-1)?.payload)).not.toContain(actorId)
    expect(JSON.stringify(events.at(-1)?.payload)).not.toContain("Candidate links do not establish")
  })

  it("fails closed on stale dependencies, unknown subjects, forged reconciliation, and dependency drift", async () => {
    const stale = input()
    stale.finalizedSnapshot.digest = digest("b")
    await expect(service.create(stale, actorId)).rejects.toThrow("exact current Finalized Figma Snapshot Import")

    const unknown = input()
    unknown.bindings[0]!.requirementKeys = ["PORTAL-REQ-999"]
    unknown.subjectCoverage[1]!.subjectKey = "PORTAL-REQ-999"
    await expect(service.create(unknown, actorId)).rejects.toThrow("reconcile every exact current Design Requirement")

    const forged = input()
    forged.reconciliationDigest = digest("c")
    await expect(service.create(forged, actorId)).rejects.toThrow("reconciliation digest must bind")

    const candidate = await service.create(input(), actorId)
    decisions = { ...decisions, revision: decisions.revision + 1 }
    expect(await service.assess(initiative.id)).toMatchObject({
      candidate: { recordId: candidate.id },
      staleBindingCount: 1,
      state: "attention-required",
    })
    expect(await service.healthIssues()).toContainEqual(expect.objectContaining({
      code: "design-to-requirement-binding.review-required",
      severity: "warning",
    }))
  })
})
