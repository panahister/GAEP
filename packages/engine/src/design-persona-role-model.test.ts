import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  designParticipantCategoryValues,
  designRoleKindValues,
  initiativeApplicabilitySubjectDefinitions,
  stakeholderCategoryValues,
  type BusinessUnderstanding,
  type BusinessUnderstandingInput,
  type DesignApplicability,
  type DesignApplicabilityInput,
  type DesignPersonaRoleModelInput,
  type ExactSourceReference,
  type Initiative,
  type InitiativeApplicabilityMatrixInput,
  type InitiativeClassificationInput,
  type Product,
  type SourceRecord,
  type SourceRecordInput,
  type StakeholderModel,
  type StakeholderModelInput,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { GaepEngine } from "./engine.js"

const actorId = "product-owner"
const digest = (value: string) => `sha256:${value.repeat(64).slice(0, 64)}` as const

describe("Design Persona and Role service", () => {
  let workspace: string
  let engine: GaepEngine
  let product: Product
  let initiative: Initiative
  let source: SourceRecord
  let stakeholder: StakeholderModel
  let applicability: DesignApplicability

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "gaep-design-persona-role-"))
    engine = new GaepEngine(workspace, [])
    product = await engine.createProduct({
      name: "Atlas",
      summary: "A governed Product with explicit design personas and responsibility boundaries.",
      problem: "Persona prose and Product Designer titles can be mistaken for validated evidence or authority.",
      affectedUsers: "Change owners, reviewers, stewards, affected contributors, and Product teams",
      desiredOutcome: "Design personas and roles are evidence-bound, reviewable, and never synthesize appointment or authority.",
      successSignals: ["Persona hypotheses and Product Designer responsibilities are exact and contestable"],
      firstWorkflow: "Bind design personas and roles to current stakeholder and applicability evidence.",
      exclusions: ["Automatic persona validation", "Automatic role appointment", "Automatic design approval"],
      profile: "software",
    }, actorId)
    initiative = await engine.createInitiative({
      title: "Build the customer release portal",
      outcome: "Release owners can review governed readiness in one interface.",
      scope: ["Customer portal", "Release readiness review"],
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
      applicabilityMatrixInput(),
      initiative.revision!,
      actorId,
    )
    source = await engine.sourceGovernance.createSource(sourceInput(), actorId)
    const business = await engine.businessUnderstanding.createBusinessUnderstanding(businessInput(), actorId)
    stakeholder = await engine.businessUnderstanding.createStakeholderModel(stakeholderInput(business), actorId)
    applicability = await engine.designApplicability.create(designApplicabilityInput(), actorId)
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
      evidence: [{ kind: "requirement", reference: "GAEP-P2-02" }],
      unresolvedQuestions: [],
      rationale: "The Initiative is a UI-bearing client application with interactive release-review journeys.",
    }
  }

  function applicabilityMatrixInput(): InitiativeApplicabilityMatrixInput {
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
      title: "Reviewed persona, stakeholder, applicability, and design responsibility source",
      description: "The exact reviewed source for the bounded stakeholder, persona, participant, applicability, and Product Designer responsibility assertions.",
      locator: { kind: "logical", value: "design.personas.roles.reviewed" },
      revisionIdentity: { kind: "resource-revision", value: "GAEP-P2-02@1" },
      contentDigest: digest("a"),
      digestScope: "Canonical UTF-8 Design Persona and Role source",
      owner: { kind: "human", id: actorId },
      semanticAuthority: {
        standing: "authoritative",
        domain: "Initiative design personas and candidate responsibility guidance",
        scope: ["P2-02 Design Personas and Roles"],
        basis: "The accountable Product owner declared this exact revision as the governing candidate input.",
        declaredBy: { kind: "human", id: actorId },
      },
      knowledgeDisposition: "confirmed",
      trust: { sourceAuthenticity: "verified", contentIntegrity: "verified" },
      informationClassification: "internal",
      rights: { status: "verified", basis: "Internal Product use is recorded for this source." },
      freshness: {
        status: "fresh",
        assessedAt: "2026-07-28T08:00:00.000Z",
        basis: "The accountable owner reviewed this exact revision.",
        validUntil: "2026-08-28T08:00:00.000Z",
      },
      availability: { status: "available", basis: "The governed logical source is available." },
      limitations: ["This source does not validate a persona, appoint a role, verify competence, or establish design approval."],
      ...overrides,
    }
  }

  function reference(record: SourceRecord = source): ExactSourceReference {
    return {
      sourceId: record.id,
      sourceRevision: record.revision,
      recordDigest: canonicalDigest(record),
      contentDigest: record.contentDigest,
    }
  }

  function context() {
    return {
      productRevision: product.revision!,
      productDigest: canonicalDigest(product),
      initiativeRevision: initiative.revision!,
      initiativeDigest: canonicalDigest(initiative),
    }
  }

  async function exactContext() {
    product = await engine.readProduct()
    return context()
  }

  function attributed(text: string) {
    return { text, disposition: "confirmed" as const, sources: [reference()] }
  }

  function businessInput(): BusinessUnderstandingInput {
    return {
      initiativeId: initiative.id,
      context: context(),
      informationClassification: "internal",
      problem: attributed("Persona prose and design job titles can be mistaken for validated evidence, appointment, or authority."),
      opportunity: attributed("Exact governed records can preserve persona hypotheses and responsibility boundaries for human review."),
      currentState: attributed("Stakeholder and design responsibility context is distributed across informal Product artifacts."),
      targetState: attributed("Candidate persona and responsibility guidance is versioned, evidence-bound, private, and contestable."),
      scope: {
        included: ["Design participant coverage", "Persona hypotheses", "Product Designer responsibilities"],
        excluded: ["Design approval", "Persona validation", "Role appointment"],
        boundaries: ["Candidate guidance only", "No implicit authority"],
      },
      objectives: [{ id: "preserve-design-context", ...attributed("Preserve exact persona and role context across governed Product handoffs.") }],
      constraints: [{ id: "preserve-human-authority", ...attributed("Preserve human validation, appointment, approval, and authorization boundaries.") }],
      assumptions: [{
        id: "reviewers-can-contest",
        statement: attributed("Qualified participants can contest persona assumptions through the declared review path."),
        status: "supported",
        reviewTrigger: "Reassess when participant scope or evidence changes.",
      }],
      unresolvedQuestions: [],
      glossary: [{
        term: "Design Persona",
        definition: attributed("A purpose-limited evidence-bound hypothesis, not a validated identity or worker-ranking profile."),
      }],
      limitations: ["The local fixture does not represent realistic Product research or Product Owner acceptance."],
    }
  }

  function stakeholderInput(business: BusinessUnderstanding): StakeholderModelInput {
    return {
      initiativeId: initiative.id,
      context: context(),
      informationClassification: "internal",
      businessUnderstanding: { recordId: business.id, revision: business.revision, digest: canonicalDigest(business) },
      stakeholders: [{
        key: "change-owner",
        label: "Release change owner",
        category: "change-owner",
        job: attributed("Prepare and challenge evidence for the bounded release-readiness review."),
        concerns: ["Incorrect persona assumptions", "Unclear design responsibility"],
        successSignals: ["Can contest candidate guidance without receiving approval authority"],
        assignment: {
          status: "confirmed",
          subject: { kind: "human", id: "pilot-change-owner" },
          basis: "The participant confirmed this bounded candidate workflow assignment.",
          sources: [reference()],
          confirmedBy: { kind: "human", id: actorId },
          confirmedAt: "2026-07-28T08:00:00.000Z",
        },
        authority: {
          standing: "none",
          domains: [],
          scope: [],
          basis: "Workflow participation does not grant design approval or action authority.",
          sources: [reference()],
        },
        competence: {
          status: "not-assessed",
          basis: "This candidate does not infer competence from a role label or workflow assignment.",
          sources: [reference()],
        },
      }],
      coverage: stakeholderCategoryValues.map((category) => ({
        category,
        status: category === "change-owner" ? "represented" as const : "not-applicable" as const,
        rationale: category === "change-owner"
          ? "The bounded candidate records one release change owner."
          : `The bounded contract fixture does not claim a ${category} assignment.`,
        sources: [reference()],
      })),
      responsibilities: [{
        id: "prepare-design-context",
        subject: "Prepare candidate design context",
        stakeholderKey: "change-owner",
        relationship: "responsible",
        basis: "The participant prepares evidence without acquiring validation, appointment, approval, or action authority.",
        sources: [reference()],
      }],
      separationOfDuty: [],
      contestability: {
        path: "Challenge incorrect stakeholder or responsibility context through an attributable amendment request.",
        ownerStakeholderKey: "change-owner",
        escalation: "Escalate unresolved evidence or authority disputes to the separately assigned accountable authority.",
        sources: [reference()],
      },
      limitations: ["The local fixture does not establish organization-wide assignment, competence, or authority."],
    }
  }

  function designApplicabilityInput(): DesignApplicabilityInput {
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
      sources: [reference()],
      owner: "Product design owner",
      accountableApprover: actorId,
      conditions: [],
      reviewTriggers: ["Initiative scope, interaction posture, policy, or evidence changes"],
      approval: { state: "not-required" as const, conditions: [] },
      relatedDesignArtifacts: [],
      authorityBoundary: "design-applicability-decision-is-candidate-guidance-and-does-not-approve-design-establish-a-baseline-or-authorize-action" as const,
    })
    return {
      initiativeId: initiative.id,
      context: context(),
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
          sources: [reference()],
        },
        decisions: [decision("design-work"), decision("figma"), decision("user-experience"), decision("user-interface")],
        limitations: ["No approved design baseline is represented"],
      }],
      unresolvedQuestions: [],
      limitations: ["No design approval, baseline, readiness, implementation, or action authority is established"],
      reviewState: "ready-for-human-review",
      designApprovalState: "not-established",
      designBaselineState: "not-established",
      implementationAuthorityState: "not-established",
    }
  }

  function approval(status: "represented" | "not-applicable") {
    return status === "represented"
      ? { state: "not-required" as const, conditions: [] }
      : {
          state: "approved" as const,
          decidedBy: { kind: "human" as const, id: actorId },
          decidedAt: "2026-07-28T08:00:00.000Z",
          conditions: [],
        }
  }

  async function input(overrides: Partial<DesignPersonaRoleModelInput> = {}): Promise<DesignPersonaRoleModelInput> {
    const exact = await exactContext()
    return {
      initiativeId: initiative.id,
      context: exact,
      informationClassification: "internal",
      title: "Customer portal Design Persona and Role candidate",
      stakeholderModel: { recordId: stakeholder.id, revision: stakeholder.revision, digest: canonicalDigest(stakeholder) },
      designApplicability: {
        recordId: applicability.id,
        revision: applicability.revision,
        digest: canonicalDigest(applicability),
        membershipDigest: applicability.membershipDigest,
      },
      personas: [{
        key: "release-change-owner",
        label: "Release change owner",
        evidenceState: "human-reviewed",
        participantCategories: [...designParticipantCategoryValues],
        stakeholderKeys: ["change-owner"],
        designScopeKeys: ["client-application.customer-portal"],
        jobs: ["Understand whether a release is ready for accountable review"],
        goals: ["Reach a traceable review decision with minimal governance burden"],
        constraints: ["Must preserve separation between evidence and approval authority"],
        behaviors: ["Reviews gaps before requesting a separate accountable human decision"],
        contexts: ["Uses the customer portal during a bounded release-readiness review"],
        accessibilityNeeds: ["Keyboard-operable review flow"],
        inclusionConsiderations: ["Do not assume familiarity with GAEP terminology"],
        sources: [reference()],
        reviewedBy: { kind: "human", id: actorId },
        reviewedAt: "2026-07-28T08:00:00.000Z",
        validationState: "not-established",
        privacyBoundary: "persona-is-a-purpose-limited-design-hypothesis-and-must-not-contain-direct-personal-identifiers-or-be-used-for-productivity-ranking",
      }],
      participantCoverage: designParticipantCategoryValues.map((category) => ({
        category,
        status: "represented" as const,
        rationale: `${category} is explicitly represented by the evidence-linked release-change-owner persona hypothesis.`,
        sources: [reference()],
        approval: approval("represented"),
      })),
      designRoles: [{
        key: "portal-product-designer",
        label: "Portal Product Designer",
        kind: "product-designer",
        stakeholderKeys: ["change-owner"],
        personaKeys: ["release-change-owner"],
        designScopeKeys: ["client-application.customer-portal"],
        responsibilities: ["Translate reviewed persona evidence into candidate interaction and interface design decisions"],
        accountableDecisions: ["Recommend whether candidate experience evidence is sufficient for human review"],
        collaborationExpectations: ["Work with change owners, reviewers, stewards, and affected contributors"],
        absenceAndEscalation: "If Product Designer responsibility is unavailable, hold design review and escalate through the recorded contestability path.",
        sources: [reference()],
        assignmentState: "not-established",
        competenceState: "not-established",
        authorityState: "not-established",
        authorityBoundary: "design-role-is-candidate-responsibility-guidance-and-does-not-appoint-a-person-verify-competence-grant-authority-or-approve-design",
      }],
      roleCoverage: designRoleKindValues.map((kind) => {
        const status = kind === "product-designer" ? "represented" as const : "not-applicable" as const
        return {
          kind,
          status,
          rationale: kind === "product-designer"
            ? "Product Designer responsibility is explicitly represented for this applicable design scope."
            : `${kind} is explicitly not applicable to this bounded candidate scope after accountable human review.`,
          sources: [reference()],
          approval: approval(status),
        }
      }),
      contestability: {
        path: "Challenge persona assumptions or role boundaries through the recorded Product review channel.",
        ownerStakeholderKey: "change-owner",
        escalation: "Hold design use and escalate unresolved disputes to the accountable Product authority.",
        sources: [reference()],
      },
      unresolvedQuestions: [],
      limitations: ["Persona validation, role appointment, competence, authority, design approval, readiness, and action are not established"],
      reviewState: "ready-for-human-review",
      personaValidationState: "not-established",
      roleAppointmentState: "not-established",
      designApprovalState: "not-established",
      implementationAuthorityState: "not-established",
      ...overrides,
    }
  }

  it("persists, assesses, projects, and revises immutable candidate guidance without persona, appointment, or design authority", async () => {
    const firstInput = await input()
    const candidate = await engine.designPersonaRoleModel.create(firstInput, actorId)

    expect(candidate).toMatchObject({
      revision: 1,
      state: "candidate",
      personas: [{ validationState: "not-established" }],
      designRoles: [{
        kind: "product-designer",
        assignmentState: "not-established",
        competenceState: "not-established",
        authorityState: "not-established",
      }],
      personaValidationState: "not-established",
      roleAppointmentState: "not-established",
      designApprovalState: "not-established",
      implementationAuthorityState: "not-established",
      authorityBoundary: expect.stringContaining("does-not-validate-a-persona"),
    })
    expect(await engine.designPersonaRoleModel.assess(initiative.id)).toMatchObject({
      candidate: { recordId: candidate.id, revision: 1, digest: canonicalDigest(candidate) },
      personaCount: 1,
      designRoleCount: 1,
      representedParticipantCategoryCount: 5,
      unresolvedParticipantCategoryCount: 0,
      representedRoleKindCount: 1,
      unresolvedRoleKindCount: 0,
      weakEvidencePersonaCount: 0,
      humanReviewedPersonaCount: 1,
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      unresolvedQuestionCount: 0,
      reviewState: "ready-for-human-review",
      state: "complete-for-review",
      reasons: [],
    })
    const projection = await engine.designPersonaRoleModel.project(initiative.id)
    const { snapshotDigest, ...projectionBody } = projection
    expect(snapshotDigest).toBe(canonicalDigest(projectionBody))
    expect(projection).toMatchObject({
      candidate: { id: candidate.id, revision: 1, personaCount: 1, designRoleCount: 1 },
      privacyBoundary: expect.stringContaining("not-persona-content-behaviors-constraints"),
      authorityBoundary: expect.stringContaining("does-not-validate-personas-appoint-roles"),
    })
    expect(JSON.stringify(projection)).not.toContain("Keyboard-operable review flow")
    expect(JSON.stringify(projection)).not.toContain("pilot-change-owner")

    const revisedInput = await input({
      limitations: [
        "Persona validation, role appointment, competence, authority, design approval, readiness, and action are not established",
        "The candidate remains subject to independent accountable human review",
      ].sort(),
    })
    const revised = await engine.designPersonaRoleModel.revise(candidate.id, candidate.revision, revisedInput, actorId)
    expect(revised).toMatchObject({ id: candidate.id, revision: 2, predecessorDigest: canonicalDigest(candidate) })
    expect((await engine.designPersonaRoleModel.listHistory(candidate.id)).map((record) => record.revision)).toEqual([2, 1])

    const bundle = await engine.productStudio.buildPortableExport()
    expect(bundle.manifest.members.map((member) => member.path)).toEqual(expect.arrayContaining([
      `design-persona-role-models/${candidate.id}.json`,
      `design-persona-role-model-history/design-persona-role-${candidate.id}-r1.json`,
      `design-persona-role-model-history/design-persona-role-${candidate.id}-r2.json`,
    ]))
    await expect(engine.productStudio.previewImportBundle(bundle)).resolves.toMatchObject({
      status: "compatible",
      importMutation: "not-performed",
    })

    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
    expect(events.at(-1)).toMatchObject({
      eventType: "design-persona-role.revised",
      payload: {
        revision: 2,
        recordDigest: canonicalDigest(revised),
        membershipDigest: revised.membershipDigest,
        predecessorDigest: canonicalDigest(candidate),
        personaCount: 1,
        designRoleCount: 1,
        reviewState: "ready-for-human-review",
        personaValidationState: "not-established",
        roleAppointmentState: "not-established",
        designApprovalState: "not-established",
        implementationAuthorityState: "not-established",
        readinessAuthorityState: "not-established",
        writeAuthorityState: "not-granted",
        actionAuthorityState: "not-granted",
      },
    })
  })

  it("fails closed on stale upstream identities, unknown stakeholder or scope links, and superseded source evidence", async () => {
    const stale = await input({
      stakeholderModel: { recordId: stakeholder.id, revision: stakeholder.revision, digest: digest("f") },
    })
    await expect(engine.designPersonaRoleModel.create(stale, actorId)).rejects.toThrow("exact current Stakeholder Model")

    const unknownStakeholder = await input()
    unknownStakeholder.personas[0]!.stakeholderKeys = ["unknown-stakeholder"]
    await expect(engine.designPersonaRoleModel.create(unknownStakeholder, actorId)).rejects.toThrow("reference stakeholders")

    const unknownScope = await input()
    unknownScope.designRoles[0]!.designScopeKeys = ["client-application.unknown"]
    await expect(engine.designPersonaRoleModel.create(unknownScope, actorId)).rejects.toThrow("scope keys")

    const candidate = await engine.designPersonaRoleModel.create(await input(), actorId)
    await engine.sourceGovernance.reviseSource(source.id, source.revision, sourceInput({
      revisionIdentity: { kind: "resource-revision", value: "GAEP-P2-02@2" },
      contentDigest: digest("b"),
    }), actorId)
    expect(await engine.designPersonaRoleModel.assess(initiative.id)).toMatchObject({
      candidate: { recordId: candidate.id },
      staleBindingCount: 0,
      staleSourceReferenceCount: 1,
      state: "attention-required",
    })
    expect((await engine.workspaceHealth()).issues).toContainEqual(expect.objectContaining({
      code: "design-persona-role.binding-review-required",
      severity: "warning",
    }))
  })

  it("requires participant and Product Designer coverage that matches the exact Design Applicability disposition", async () => {
    const missingParticipant = await input()
    missingParticipant.personas[0]!.participantCategories = missingParticipant.personas[0]!.participantCategories
      .filter((category) => category !== "reviewer")
    missingParticipant.participantCoverage[2] = {
      category: "reviewer",
      status: "not-applicable",
      rationale: "Reviewer participation is declared not applicable only for this hostile contract candidate.",
      sources: [reference()],
      approval: approval("not-applicable"),
    }
    await expect(engine.designPersonaRoleModel.create(missingParticipant, actorId)).rejects.toThrow("requires represented")

    const missingDesigner = await input()
    missingDesigner.designRoles = [] as never
    await expect(engine.designPersonaRoleModel.create(missingDesigner, actorId)).rejects.toThrow()
  })
})
