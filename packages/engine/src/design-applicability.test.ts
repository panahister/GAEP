import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  initiativeApplicabilitySubjectDefinitions,
  type DesignApplicabilityInput,
  type ExactSourceReference,
  type Initiative,
  type InitiativeApplicabilityMatrixInput,
  type InitiativeClassificationInput,
  type SourceRecord,
  type SourceRecordInput,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { GaepEngine } from "./engine.js"

const actorId = "product-owner"
const digest = (value: string) => `sha256:${value.repeat(64).slice(0, 64)}` as const

describe("Design Applicability service", () => {
  let workspace: string
  let engine: GaepEngine
  let initiative: Initiative

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "gaep-design-applicability-"))
    engine = new GaepEngine(workspace, [])
    await engine.createProduct({
      name: "Atlas",
      summary: "A governed Product with explicit design applicability.",
      problem: "Design work and Figma can be inferred without accountable scope-specific evidence.",
      affectedUsers: "Product owners, designers, and engineering teams",
      desiredOutcome: "Every target has explicit UX, UI, design-work, Figma, depth, and source dispositions.",
      successSignals: ["Design applicability is exact, attributable, and reviewable"],
      firstWorkflow: "Determine design applicability before creating or importing design artifacts.",
      exclusions: ["Automatic design approval", "Automatic Figma access"],
      profile: "software",
    }, actorId)
    initiative = await engine.createInitiative({
      title: "Build the customer release portal",
      outcome: "Release owners can review governed readiness in one interface.",
      scope: ["Customer portal", "Release readiness journey"],
      exclusions: ["Automatic release authorization"],
    }, actorId)
    initiative = await engine.classifyInitiative(
      initiative.id,
      classificationInput(),
      initiative.revision!,
      actorId,
    )
    initiative = await engine.resolveInitiativeApplicability(
      initiative.id,
      applicabilityInput(),
      initiative.revision!,
      actorId,
    )
  })

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true })
  })

  function classificationInput(): InitiativeClassificationInput {
    return {
      primaryType: "client-application",
      secondaryTypes: ["product"],
      systemState: "greenfield",
      changePosture: "new",
      motivations: ["business-driven"],
      characteristics: {
        userInterface: "ui-bearing",
        data: "data-bearing",
        integration: "integration-heavy",
        interactionModes: ["interactive", "synchronous"],
        exposure: "internal",
      },
      regulated: false,
      policyDomains: [],
      sensitivities: ["data"],
      expectedLifetime: "long-lived",
      maintenanceHorizon: "The portal is maintained for the supported Product lifecycle.",
      risk: {
        blastRadius: "multi-unit",
        reversibility: "reversible",
        urgency: "normal",
        costOfFailure: "medium",
      },
      dependencies: ["Readiness projections"],
      affectedAssets: ["Customer portal"],
      owner: "Product design owner",
      accountableAuthority: actorId,
      confidence: { level: "high", basis: "The exact Product scope and interface posture are confirmed." },
      evidence: [{ kind: "requirement", reference: "GAEP-P2-01" }],
      unresolvedQuestions: [],
      rationale: "The Initiative is a UI-bearing client application with interactive release-review journeys.",
    }
  }

  function applicabilityInput(): InitiativeApplicabilityMatrixInput {
    return {
      decisions: initiativeApplicabilitySubjectDefinitions.map((subject) => ({
        subject: { ...subject },
        status: "optional" as const,
        rationale: "The accountable owner evaluated this canonical subject for the exact Initiative scope.",
        sources: [{ kind: "policy" as const, reference: "GAEP-DYNAMIC-ENGINEERING-MODEL" }],
        owner: "Initiative owner",
        dependencies: [],
        conditions: [],
        reviewTriggers: ["Initiative scope, classification, policy, or evidence changes"],
        approval: { state: "not-required" as const, conditions: [] },
        relatedRecords: [],
        relatedImplementationUnits: [],
      })),
      unresolvedSubjects: [],
    }
  }

  function sourceInput(overrides: Partial<SourceRecordInput> = {}): SourceRecordInput {
    return {
      initiativeId: initiative.id,
      sourceType: "design",
      title: "Reviewed design applicability source",
      description: "The exact reviewed source for scope-specific UX, UI, design-work, Figma, depth, and design-source decisions.",
      locator: { kind: "logical", value: "design.applicability.reviewed" },
      revisionIdentity: { kind: "resource-revision", value: "GAEP-P2-01@1" },
      contentDigest: digest("a"),
      digestScope: "Canonical UTF-8 design applicability source",
      owner: { kind: "human", id: actorId },
      semanticAuthority: {
        standing: "authoritative",
        domain: "Initiative design applicability",
        scope: ["P2-01 Design Applicability"],
        basis: "The accountable Product owner declared this exact revision as the governing applicability input.",
        declaredBy: { kind: "human", id: actorId },
      },
      knowledgeDisposition: "confirmed",
      trust: { sourceAuthenticity: "verified", contentIntegrity: "verified" },
      informationClassification: "internal",
      rights: { status: "verified", basis: "Internal Product use is recorded for this source." },
      freshness: {
        status: "fresh",
        assessedAt: "2026-07-28T03:00:00.000Z",
        basis: "The accountable owner reviewed this exact revision.",
        validUntil: "2026-08-28T03:00:00.000Z",
      },
      availability: { status: "available", basis: "The governed logical source is available." },
      limitations: ["This source does not establish design approval or an approved design baseline."],
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

  function input(source: ExactSourceReference, overrides: Partial<DesignApplicabilityInput> = {}): DesignApplicabilityInput {
    const classification = initiative.classification!
    const matrix = initiative.applicability!
    const experienceDesign = matrix.decisions.find((decision) =>
      decision.subject.type === "activity" && decision.subject.key === "experience-design")!
    const designReferenceIntegration = matrix.decisions.find((decision) =>
      decision.subject.type === "capability" && decision.subject.key === "design-reference-integration")!
    const decision = (aspect: "design-work" | "figma" | "user-experience" | "user-interface") => ({
      aspect,
      status: aspect === "figma" ? "optional" as const : "required" as const,
      rationale: `${aspect} has an exact evidence-backed candidate disposition for this target scope.`,
      sources: [source],
      owner: "Product design owner",
      accountableApprover: actorId,
      conditions: [],
      reviewTriggers: ["Initiative scope, interaction posture, policy, or source evidence changes"],
      approval: { state: "not-required" as const, conditions: [] },
      relatedDesignArtifacts: [],
      authorityBoundary: "design-applicability-decision-is-candidate-guidance-and-does-not-approve-design-establish-a-baseline-or-authorize-action" as const,
    })
    return {
      initiativeId: initiative.id,
      context: {
        productRevision: 1,
        productDigest: digest("0"),
        initiativeRevision: initiative.revision!,
        initiativeDigest: canonicalDigest(initiative),
      },
      informationClassification: "internal",
      title: "Customer portal Design Applicability candidate",
      classificationBinding: {
        digest: canonicalDigest(classification),
        completenessPolicyVersion: classification.completenessPolicyVersion!,
        completenessPolicyDigest: classification.completenessPolicyDigest!,
      },
      applicabilityBinding: {
        matrixRevision: matrix.revision,
        matrixDigest: canonicalDigest(matrix),
        catalogVersion: matrix.subjectCatalog!.catalogVersion,
        catalogDigest: matrix.subjectCatalog!.digest,
        experienceDesign: {
          subject: { type: "activity", key: "experience-design" },
          decisionId: experienceDesign.id,
          revision: experienceDesign.revision,
          digest: canonicalDigest(experienceDesign),
          status: experienceDesign.status,
        },
        designReferenceIntegration: {
          subject: { type: "capability", key: "design-reference-integration" },
          decisionId: designReferenceIntegration.id,
          revision: designReferenceIntegration.revision,
          digest: canonicalDigest(designReferenceIntegration),
          status: designReferenceIntegration.status,
        },
      },
      scopes: [{
        scope: { kind: "client-application", id: "customer-portal", label: "Customer portal" },
        affectedJourneys: ["Release readiness review"],
        approvedDesignSystems: ["GAEP product interface system"],
        requiredDepth: "standard",
        designSource: {
          state: "selected",
          modes: ["repository-native"],
          rationale: "Repository-native records are the selected candidate design source for this target.",
          sources: [source],
        },
        decisions: [
          decision("design-work"), decision("figma"), decision("user-experience"), decision("user-interface"),
        ],
        limitations: ["No approved design baseline is represented"],
      }],
      unresolvedQuestions: [],
      limitations: ["No design approval, baseline, readiness, implementation, or action authority is established"],
      reviewState: "ready-for-human-review",
      designApprovalState: "not-established",
      designBaselineState: "not-established",
      implementationAuthorityState: "not-established",
      ...overrides,
    }
  }

  async function exactInput(source: ExactSourceReference, overrides: Partial<DesignApplicabilityInput> = {}) {
    const product = await engine.readProduct()
    return input(source, {
      context: {
        productRevision: product.revision!,
        productDigest: canonicalDigest(product),
        initiativeRevision: initiative.revision!,
        initiativeDigest: canonicalDigest(initiative),
      },
      ...overrides,
    })
  }

  it("persists, assesses, projects, and revises exact immutable candidate guidance without authority", async () => {
    const source = await engine.sourceGovernance.createSource(sourceInput(), actorId)
    const firstInput = await exactInput(reference(source))
    const candidate = await engine.designApplicability.create(firstInput, actorId)

    expect(candidate).toMatchObject({
      revision: 1,
      state: "candidate",
      scopes: [{ requiredDepth: "standard", designSource: { modes: ["repository-native"] } }],
      designApprovalState: "not-established",
      designBaselineState: "not-established",
      implementationAuthorityState: "not-established",
      authorityBoundary: expect.stringContaining("does-not-approve-design"),
    })
    expect(await engine.designApplicability.assess(initiative.id)).toMatchObject({
      candidate: { recordId: candidate.id, revision: 1, digest: canonicalDigest(candidate) },
      scopeCount: 1,
      decisionCount: 4,
      unresolvedDecisionCount: 0,
      blockedDecisionCount: 0,
      pendingApprovalCount: 0,
      rejectedApprovalCount: 0,
      unresolvedDepthCount: 0,
      unresolvedSourceCount: 0,
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      unresolvedQuestionCount: 0,
      reviewState: "ready-for-human-review",
      state: "complete-for-review",
      reasons: [],
    })
    const projection = await engine.designApplicability.project(initiative.id)
    const { snapshotDigest, ...projectionBody } = projection
    expect(snapshotDigest).toBe(canonicalDigest(projectionBody))
    expect(projection).toMatchObject({
      candidate: { id: candidate.id, revision: 1, scopeCount: 1 },
      privacyBoundary: expect.stringContaining("not-rationales-source-content-journeys-design-content"),
      authorityBoundary: expect.stringContaining("does-not-approve-design"),
    })
    expect(JSON.stringify(projection)).not.toContain("Release readiness review")

    const revisedInput = await exactInput(reference(source), {
      limitations: [
        "No design approval, baseline, readiness, implementation, or action authority is established",
        "The candidate remains subject to accountable human review",
      ].sort(),
    })
    const revised = await engine.designApplicability.revise(candidate.id, candidate.revision, revisedInput, actorId)
    expect(revised).toMatchObject({ id: candidate.id, revision: 2, predecessorDigest: canonicalDigest(candidate) })
    expect((await engine.designApplicability.listHistory(candidate.id)).map((record) => record.revision)).toEqual([2, 1])

    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
    expect(events.at(-1)).toMatchObject({
      eventType: "design-applicability.revised",
      payload: {
        revision: 2,
        recordDigest: canonicalDigest(revised),
        membershipDigest: revised.membershipDigest,
        predecessorDigest: canonicalDigest(candidate),
        scopeCount: 1,
        decisionCount: 4,
        reviewState: "ready-for-human-review",
        designApprovalState: "not-established",
        designBaselineState: "not-established",
        implementationAuthorityState: "not-established",
        readinessAuthorityState: "not-established",
        writeAuthorityState: "not-granted",
        actionAuthorityState: "not-granted",
      },
    })
  })

  it("fails closed on stale exact bindings and reports Source supersession without inventing applicability", async () => {
    const source = await engine.sourceGovernance.createSource(sourceInput(), actorId)
    const exact = await exactInput(reference(source))
    const stale: DesignApplicabilityInput = {
      ...exact,
      classificationBinding: { ...exact.classificationBinding, digest: digest("f") },
    }
    await expect(engine.designApplicability.create(stale, actorId)).rejects.toThrow("exact current classification")

    const candidate = await engine.designApplicability.create(exact, actorId)
    await engine.sourceGovernance.reviseSource(source.id, source.revision, sourceInput({
      revisionIdentity: { kind: "resource-revision", value: "GAEP-P2-01@2" },
      contentDigest: digest("b"),
    }), actorId)
    expect(await engine.designApplicability.assess(initiative.id)).toMatchObject({
      candidate: { recordId: candidate.id },
      staleBindingCount: 0,
      staleSourceReferenceCount: 1,
      state: "attention-required",
    })
    expect((await engine.workspaceHealth()).issues).toContainEqual(expect.objectContaining({
      code: "design-applicability.binding-review-required",
      severity: "warning",
    }))
  })
})
