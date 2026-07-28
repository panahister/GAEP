import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  designParticipantCategoryValues,
  designRoleKindValues,
  manualFigmaHandoffArtifactKinds,
  manualFigmaInstructionKinds,
  manualFigmaReturnArtifactKinds,
  userJourneyPathKindValues,
  initiativeApplicabilitySubjectDefinitions,
  stakeholderCategoryValues,
  type BusinessUnderstanding,
  type BusinessUnderstandingInput,
  type AccessibilityDesignRulesInput,
  type AccessibilityDesignRules,
  type DesignApplicability,
  type DesignApplicabilityInput,
  type DesignRequirementsInput,
  type DesignRequirements,
  type DesignSystemTokenContractInput,
  type DesignSystemTokenContract,
  type DesignPersonaRoleModelInput,
  type DesignPersonaRoleModel,
  type ExactSourceReference,
  type FigmaMcpCapabilityDiscoveryInput,
  type Initiative,
  type InitiativeApplicabilityMatrixInput,
  type InitiativeClassificationInput,
  type InformationArchitectureModelInput,
  type InformationArchitectureModel,
  type ManualFigmaExecutionPathInput,
  type ManualFigmaExecutionPath,
  type OutcomeModel,
  type OutcomeModelInput,
  type Product,
  type SourceRecord,
  type SourceRecordInput,
  type ScreenStateInventoryInput,
  type ScreenStateInventory,
  type ResponsiveMultiPlatformTargetsInput,
  type ResponsiveMultiPlatformTargets,
  type StakeholderModel,
  type StakeholderModelInput,
  type UserJourneyModelInput,
  type UserJourneyModel,
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

  function journeyStep(kind: typeof userJourneyPathKindValues[number]) {
    return {
      key: `${kind}-step`,
      sequence: 1,
      touchpointKey: "portal-review",
      personaKeys: ["release-change-owner"],
      objective: "Reach the bounded next state while preserving visible evidence, uncertainty, and authority boundaries.",
      participantAction: "The participant reviews the exact visible candidate state and chooses a non-authorizing navigation action.",
      expectedExperience: "The interface explains the current state, omissions, and recovery path without claiming approval or readiness.",
      expectedSystemResponse: "The system renders exact candidate metadata and preserves the governed source records without mutation.",
      evidenceCues: ["Exact candidate identity and unresolved gaps remain visible"],
      accessibilityChecks: ["The step is keyboard operable and has a textual status alternative"],
      privacyChecks: ["Only purpose-limited candidate metadata is displayed"],
      sources: [reference()],
    }
  }

  function journeyPath(kind: typeof userJourneyPathKindValues[number]) {
    return {
      key: `${kind}-path`,
      kind,
      title: `${kind} release review path`,
      personaKeys: ["release-change-owner"],
      entryConditions: ["The exact current Product and Initiative context is available"],
      steps: [journeyStep(kind)],
      exitConditions: ["The participant can identify the next bounded state or explicit stop condition"],
      relatedPathKeys: kind === "failure" ? ["recovery-path"] : kind === "recovery" ? ["failure-path"] : [],
      evidenceState: "human-reviewed" as const,
      sources: [reference()],
      reviewedBy: { kind: "human" as const, id: actorId },
      reviewedAt: "2026-07-28T09:00:00.000Z",
      validationState: "not-established" as const,
    }
  }

  async function journeyInput(
    personaRole: DesignPersonaRoleModel,
    overrides: Partial<UserJourneyModelInput> = {},
  ): Promise<UserJourneyModelInput> {
    const exact = await exactContext()
    return {
      initiativeId: initiative.id,
      context: exact,
      informationClassification: "internal",
      title: "Customer portal User Journey candidate",
      designApplicability: {
        recordId: applicability.id,
        revision: applicability.revision,
        digest: canonicalDigest(applicability),
        membershipDigest: applicability.membershipDigest,
      },
      designPersonaRoleModel: {
        recordId: personaRole.id,
        revision: personaRole.revision,
        digest: canonicalDigest(personaRole),
        membershipDigest: personaRole.membershipDigest,
      },
      journeys: [{
        key: "release-readiness-review",
        title: "Release readiness review",
        purpose: "Help a release change owner understand exact candidate readiness evidence and recovery choices without granting approval.",
        designScopeKeys: ["client-application.customer-portal"],
        personaKeys: ["release-change-owner"],
        designRoleKeys: ["portal-product-designer"],
        participantCategories: ["change-owner"],
        jobStatements: ["Understand whether the release candidate can proceed to accountable human review"],
        intendedOutcomeKeys: ["bounded-review-decision"],
        entryConditions: ["A current governed readiness candidate exists for the exact Initiative"],
        touchpoints: [{
          key: "portal-review",
          label: "Portal review surface",
          channel: "ide",
          purpose: "Present exact candidate identity, evidence gaps, and recovery navigation for the bounded review job.",
          personaKeys: ["release-change-owner"],
          participantCategories: ["change-owner"],
          designScopeKeys: ["client-application.customer-portal"],
          accessibilityConsiderations: ["Keyboard operation and a complete textual alternative are required"],
          inclusionConsiderations: ["Do not assume prior knowledge of GAEP terminology"],
          privacyAndDataUse: {
            dataCategories: ["candidate-metadata"],
            purpose: "Support the exact release-readiness review without monitoring individual productivity.",
            minimization: "Show only record identity, status, counts, digests, gaps, and declared next-step guidance.",
            retention: "Use the governed Product retention policy for candidate metadata.",
            prohibitedUses: ["Individual productivity ranking is prohibited"],
          },
          fallback: "Provide the same bounded evidence and recovery instructions as a portable textual representation.",
          sources: [reference()],
          validationState: "not-established",
        }],
        paths: userJourneyPathKindValues.map(journeyPath),
        successCriteria: ["The participant distinguishes candidate completeness from approval and identifies the next accountable review"],
        failureIndicators: ["The participant cannot explain the stop condition or recovery path"],
        accessibilityRequirements: ["All path states have keyboard and textual equivalents"],
        inclusionRequirements: ["Language remains understandable without specialist GAEP vocabulary"],
        burdenAndAttentionLimits: ["Only material deltas and unresolved gaps are foregrounded"],
        contestability: {
          path: "Challenge an incorrect journey, touchpoint, or authority assumption through an attributable review request.",
          ownerPersonaKey: "release-change-owner",
          escalation: "Hold design use and escalate unresolved evidence or authority disputes to the separate accountable Product authority.",
          sources: [reference()],
        },
        sources: [reference()],
        validationState: "not-established",
      }],
      scopeCoverage: [{
        designScopeKey: "client-application.customer-portal",
        status: "represented",
        journeyKeys: ["release-readiness-review"],
        rationale: "The exact customer portal design scope is represented by the evidence-linked release-readiness journey candidate.",
        sources: [reference()],
        approval: { state: "not-required", conditions: [] },
      }],
      unresolvedQuestions: [],
      limitations: ["Journey observation, validation, design approval, readiness, implementation, and action authority are not established"],
      reviewState: "ready-for-human-review",
      journeyValidationState: "not-established",
      designApprovalState: "not-established",
      implementationAuthorityState: "not-established",
      ...overrides,
    }
  }

  function informationArchitectureRoute(kind: typeof userJourneyPathKindValues[number]) {
    return {
      key: `${kind}-route`,
      label: `${kind} release review route`,
      kind,
      journeyKey: "release-readiness-review",
      journeyPathKey: `${kind}-path`,
      personaKeys: ["release-change-owner"],
      entryNodeKey: "portal-review",
      nodeKeys: ["portal-review"],
      destinationNodeKey: "portal-review",
      purpose: "Map the exact governed journey path to a bounded navigation route without claiming that participants can find or understand it.",
      entryConditions: ["The exact current Product, Initiative, journey, and candidate architecture context is available"],
      successCues: ["The exact current state and bounded next navigation choice are visible"],
      failureCues: ["The participant cannot identify the current state or the bounded recovery route"],
      recoveryRouteKeys: kind === "failure" ? ["recovery-route"] : [],
      accessibilityChecks: ["The complete route has a keyboard-operable and textual representation"],
      privacyChecks: ["Only purpose-limited candidate metadata is presented"],
      fallback: "Provide the same bounded route, state, and recovery guidance through a portable textual representation.",
      evidenceState: "human-reviewed" as const,
      sources: [reference()],
      reviewedBy: { kind: "human" as const, id: actorId },
      reviewedAt: "2026-07-28T10:00:00.000Z",
      validationState: "not-established" as const,
    }
  }

  async function informationArchitectureInput(
    personaRole: DesignPersonaRoleModel,
    journeyModel: UserJourneyModel,
    overrides: Partial<InformationArchitectureModelInput> = {},
  ): Promise<InformationArchitectureModelInput> {
    const exact = await exactContext()
    return {
      initiativeId: initiative.id,
      context: exact,
      informationClassification: "internal",
      title: "Customer portal Information Architecture candidate",
      designApplicability: {
        recordId: applicability.id,
        revision: applicability.revision,
        digest: canonicalDigest(applicability),
        membershipDigest: applicability.membershipDigest,
      },
      designPersonaRoleModel: {
        recordId: personaRole.id,
        revision: personaRole.revision,
        digest: canonicalDigest(personaRole),
        membershipDigest: personaRole.membershipDigest,
      },
      userJourneyModel: {
        recordId: journeyModel.id,
        revision: journeyModel.revision,
        digest: canonicalDigest(journeyModel),
        membershipDigest: journeyModel.membershipDigest,
      },
      contentNodes: [{
        key: "portal-review",
        label: "Portal review",
        kind: "workspace",
        position: 1,
        purpose: "Organize the exact candidate evidence, status, limitations, and recovery navigation required for the bounded release-review journey.",
        designScopeKeys: ["client-application.customer-portal"],
        journeyKeys: ["release-readiness-review"],
        touchpoints: [{ journeyKey: "release-readiness-review", touchpointKey: "portal-review" }],
        personaKeys: ["release-change-owner"],
        designRoleKeys: ["portal-product-designer"],
        contentModel: {
          contentType: "governed-review-workspace",
          requiredElementKeys: ["candidate-identity", "current-state", "limitations", "recovery-navigation"],
          optionalElementKeys: ["supporting-evidence-summary"],
          ownerDesignRoleKeys: ["portal-product-designer"],
          lifecycleStates: ["candidate", "held", "ready-for-human-review"],
        },
        findability: {
          entryPointKeys: ["product-studio.users-jobs"],
          labelAlternatives: ["Governed release review", "Release readiness evidence"],
          searchTerms: ["candidate status", "release review"],
          orientationCues: ["Exact Product and Initiative identity remain visible"],
        },
        accessibilityRequirements: ["Landmarks, headings, status, and navigation order have complete textual semantics"],
        inclusionRequirements: ["Labels do not require prior knowledge of GAEP terminology"],
        privacyAndDataUse: {
          dataCategories: ["candidate-metadata"],
          purpose: "Support the bounded release-review navigation job without monitoring individual productivity.",
          minimization: "Display only record identity, status, counts, digests, limitations, and bounded route guidance.",
          retention: "Use the governed Product retention policy for candidate metadata.",
          prohibitedUses: ["Individual productivity ranking is prohibited"],
        },
        fallback: "Expose the same content hierarchy, labels, status, and routes in a portable textual representation.",
        evidence: {
          structure: "human-reviewed",
          findability: "human-reviewed",
          comprehension: "human-reviewed",
          reviewedBy: { kind: "human", id: actorId },
          reviewedAt: "2026-07-28T10:00:00.000Z",
        },
        sources: [reference()],
        validationState: "not-established",
      }],
      navigationRoutes: userJourneyPathKindValues.map(informationArchitectureRoute),
      scopeCoverage: [{
        designScopeKey: "client-application.customer-portal",
        status: "represented",
        nodeKeys: ["portal-review"],
        routeKeys: userJourneyPathKindValues.map((kind) => `${kind}-route`).sort(),
        rationale: "The exact customer portal design scope is represented by a source-linked content node and all governed journey paths.",
        sources: [reference()],
        approval: { state: "not-required", conditions: [] },
      }],
      unresolvedQuestions: [],
      limitations: ["Findability, comprehension, accessibility validation, content validation, design approval, readiness, implementation, and action authority are not established"],
      reviewState: "ready-for-human-review",
      findabilityValidationState: "not-established",
      comprehensionValidationState: "not-established",
      accessibilityValidationState: "not-established",
      designApprovalState: "not-established",
      implementationAuthorityState: "not-established",
      ...overrides,
    }
  }

  async function screenStateInventoryInput(
    architecture: InformationArchitectureModel,
    overrides: Partial<ScreenStateInventoryInput> = {},
  ): Promise<ScreenStateInventoryInput> {
    const exact = await exactContext()
    const routeKeys = architecture.navigationRoutes.map((route) => route.key).sort()
    const stateKeys = ["review-default", "review-error", "review-loading"]
    const evidence = {
      state: "human-reviewed" as const,
      reviewedBy: { kind: "human" as const, id: actorId },
      reviewedAt: "2026-07-28T11:00:00.000Z",
    }
    return {
      initiativeId: initiative.id,
      context: exact,
      informationClassification: "internal",
      title: "Customer portal Screen and State Inventory candidate",
      informationArchitectureModel: {
        recordId: architecture.id,
        revision: architecture.revision,
        digest: canonicalDigest(architecture),
        membershipDigest: architecture.membershipDigest,
      },
      platforms: [{
        key: "responsive-web",
        label: "Responsive web client",
        kind: "web",
        supportState: "targeted",
        interactionModes: ["keyboard", "pointer"],
        viewportOrContainerClasses: ["compact", "wide"],
        responsiveRules: ["Preserve task order and meaning while adapting presentation to the declared container class"],
        accessibilityRequirements: ["Keyboard and assistive-technology operation remains available at every declared container class"],
        privacyRequirements: ["Responsive behavior must not reveal data outside the current authorization and purpose boundary"],
        rationale: "The exact current Information Architecture routes are intended for the bounded responsive web experience surface.",
        sources: [reference()],
        decision: { state: "not-required", conditions: [] },
      }],
      screens: [{
        key: "release-review",
        label: "Release readiness review",
        purpose: "Present the bounded governed release-readiness context, path status, and recovery choices for accountable human review.",
        platformKeys: ["responsive-web"],
        routeKeys,
        contentNodeKeys: ["portal-review"],
        designScopeKeys: ["client-application.customer-portal"],
        journeyKeys: ["release-readiness-review"],
        touchpoints: [{ journeyKey: "release-readiness-review", touchpointKey: "portal-review" }],
        personaKeys: ["release-change-owner"],
        stateKeys,
        entryStateKey: "review-default",
        variantKeys: ["review-wide"],
        responsiveRequirements: ["The review sequence remains ordered in compact and wide container classes"],
        accessibilityRequirements: ["Status and recovery choices expose names, focus order, and non-color cues"],
        privacyAndDataUse: {
          dataCategories: ["candidate-metadata"],
          purpose: "Display only the bounded candidate metadata needed for the exact accountable release-review task.",
          minimization: "Exclude personal productivity rankings, source prose, credentials, and unrelated Product context.",
          prohibitedUses: ["Individual productivity ranking is prohibited"],
        },
        fallback: "If the interactive screen cannot render safely, expose the bounded read-only review summary and recovery path.",
        evidence,
        sources: [reference()],
        validationState: "not-established",
      }],
      states: [
        {
          key: "review-default",
          screenKey: "release-review",
          label: "Review ready",
          kind: "default",
          platformKeys: ["responsive-web"],
          routeKeys,
          visibleContentNodeKeys: ["portal-review"],
          entryConditions: ["The bounded Information Architecture route projection was read without a transport or integrity error"],
          exitConditions: ["The reviewer leaves the route or a declared loading or error condition becomes current"],
          availableActionKeys: ["inspect-evidence"],
          transitionStateKeys: ["review-error", "review-loading"],
          accessibilityRequirements: ["Focus begins at the screen heading and status changes are announced without stealing focus"],
          privacyRequirements: ["Only privacy-safe projection fields may be rendered"],
          fallback: "Retain the last verified privacy-safe projection with an explicit freshness warning.",
          evidence,
          sources: [reference()],
          validationState: "not-established",
        },
        {
          key: "review-error",
          screenKey: "release-review",
          label: "Review unavailable",
          kind: "error",
          platformKeys: ["responsive-web"],
          routeKeys,
          visibleContentNodeKeys: [],
          entryConditions: ["The bounded route projection could not be read or verified"],
          exitConditions: ["A verified retry returns the screen to its default state"],
          availableActionKeys: ["retry-read"],
          transitionStateKeys: ["review-default"],
          fallbackStateKey: "review-default",
          accessibilityRequirements: ["The error and retry choice are announced and keyboard reachable"],
          privacyRequirements: ["Raw transport errors, local paths, credentials, and source content remain hidden"],
          fallback: "Show a privacy-safe unavailable state and preserve the explicit retry path.",
          evidence,
          sources: [reference()],
          validationState: "not-established",
        },
        {
          key: "review-loading",
          screenKey: "release-review",
          label: "Review loading",
          kind: "loading",
          platformKeys: ["responsive-web"],
          routeKeys,
          visibleContentNodeKeys: [],
          entryConditions: ["A bounded route projection read is in progress"],
          exitConditions: ["The read resolves to the default or error state"],
          availableActionKeys: [],
          transitionStateKeys: ["review-default", "review-error"],
          accessibilityRequirements: ["Loading status is announced once without trapping focus"],
          privacyRequirements: ["No stale or unrelated content is exposed while loading"],
          fallback: "If loading exceeds the bounded interval, transition to the declared privacy-safe error state.",
          evidence,
          sources: [reference()],
          validationState: "not-established",
        },
      ],
      variants: [{
        key: "review-wide",
        screenKey: "release-review",
        label: "Wide review layout",
        platformKeys: ["responsive-web"],
        stateKeys,
        routeKeys,
        condition: "The responsive web container satisfies the declared wide class without changing task or authorization semantics.",
        differenceSummary: "Evidence navigation may appear beside status while preserving the same ordered content and actions.",
        responsiveRules: ["Collapse to the canonical ordered single-column flow when the wide class no longer applies"],
        accessibilityRequirements: ["Visual columns preserve one programmatic reading and focus order"],
        privacyRequirements: ["The wider layout does not introduce additional data fields"],
        fallback: "Use the canonical compact presentation when the container class cannot be established.",
        evidence,
        sources: [reference()],
        validationState: "not-established",
      }],
      routeCoverage: routeKeys.map((routeKey) => ({
        routeKey,
        status: "represented" as const,
        screenKeys: ["release-review"],
        stateKeys,
        rationale: "The exact current Information Architecture route is represented by the bounded review screen and explicit states.",
        sources: [reference()],
      })),
      scopeCoverage: [{
        designScopeKey: "client-application.customer-portal",
        status: "represented",
        screenKeys: ["release-review"],
        rationale: "The exact represented Information Architecture scope is covered by the declared release-review screen.",
        sources: [reference()],
        decision: { state: "not-required", conditions: [] },
      }],
      unresolvedQuestions: [],
      limitations: ["UI completeness, platform parity, state reachability, interaction quality, accessibility validation, design approval, readiness, implementation, and action authority remain not established"],
      reviewState: "ready-for-human-review",
      uiCompletenessState: "not-established",
      platformParityState: "not-established",
      stateReachabilityState: "not-established",
      interactionQualityState: "not-established",
      accessibilityValidationState: "not-established",
      designApprovalState: "not-established",
      implementationAuthorityState: "not-established",
      ...overrides,
    }
  }

  async function outcomeModelInput(): Promise<OutcomeModelInput> {
    const [business, currentStakeholder] = await Promise.all([
      engine.businessUnderstanding.readCurrentBusinessUnderstanding(initiative.id),
      engine.businessUnderstanding.readCurrentStakeholderModel(initiative.id),
    ])
    if (!business || !currentStakeholder) throw new Error("Expected current business and stakeholder fixtures")
    return {
      initiativeId: initiative.id,
      context: await exactContext(),
      informationClassification: "internal",
      businessUnderstanding: { recordId: business.id, revision: business.revision, digest: canonicalDigest(business) },
      stakeholderModel: {
        recordId: currentStakeholder.id,
        revision: currentStakeholder.revision,
        digest: canonicalDigest(currentStakeholder),
      },
      primaryHypothesis: attributed("Exact design requirement links help accountable reviewers trace intended outcomes to bounded design and backlog candidates."),
      outcomes: [{
        id: "safe-release-review",
        level: "experience",
        statement: attributed("Release owners can review bounded governance status and recovery choices without receiving approval or action authority."),
        beneficiaryStakeholderKeys: ["change-owner"],
        confounders: ["Review confidence may change independently when source freshness or Initiative scope changes"],
      }],
      measures: [{
        key: "SAFE-REVIEW-COVERAGE",
        name: "Bounded review coverage",
        outcomeIds: ["safe-release-review"],
        category: "quality-risk",
        kind: "metric",
        definition: "Observe whether the governed review experience exposes every declared status and recovery path without adding authority.",
        direction: "increase",
        unit: "represented review paths",
        baseline: { status: "not-observed", sources: [] },
        target: { status: "not-set" },
        collection: {
          ownerStakeholderKey: "change-owner",
          method: "Review the exact candidate evidence and privacy-safe projections against the declared path catalog.",
          cadence: "At each candidate revision",
          qualityConditions: ["Every observation remains bound to the exact candidate revision and evidence source"],
        },
        dataUse: {
          purpose: "Assess candidate design coverage without evaluating individual worker performance.",
          classification: "internal",
          aggregation: "Initiative-level candidate counts only",
          retention: "Retain with the governed candidate history",
          prohibitedUses: ["Individual productivity ranking is prohibited"],
        },
        acceptanceSignal: "Every declared governed review path has an explicit candidate design requirement link for human assessment.",
        sources: [reference()],
      }],
      countermetricDisposition: {
        status: "not-applicable",
        rationale: "This bounded fixture records one candidate coverage metric and does not claim an approved target set.",
        sources: [reference()],
      },
      burdenDisposition: {
        status: "not-applicable",
        rationale: "This bounded fixture does not establish a human burden measure or an approved measurement program.",
        sources: [reference()],
      },
      unresolvedQuestions: [],
      limitations: ["The candidate outcome and measure do not approve targets, design, readiness, release, implementation, or action"],
    }
  }

  async function createDesignRequirementsPrerequisites() {
    const personaRole = await engine.designPersonaRoleModel.create(await input(), actorId)
    const journeyModel = await engine.userJourneyModel.create(await journeyInput(personaRole), actorId)
    const architecture = await engine.informationArchitectureModel.create(
      await informationArchitectureInput(personaRole, journeyModel), actorId,
    )
    const inventory = await engine.screenStateInventory.create(await screenStateInventoryInput(architecture), actorId)
    const outcomeModel = await engine.businessUnderstanding.createOutcomeModel(await outcomeModelInput(), actorId)
    const requirement = await engine.productStudio.createRequirement({
      key: "DESIGN-REVIEW-01",
      statement: "The responsive release-review experience must expose bounded status and recovery paths without granting approval or action authority.",
      rationale: "Preserve the exact candidate outcome, design target, evidence, and authority boundary for accountable human review.",
      priority: "must",
      verificationCriteria: ["The privacy-safe projection contains exact counts and digests but no requirement, outcome, source, or Work Item content"],
      sourceRecords: [],
    }, product.revision!, actorId)
    const change = await engine.productStudio.createChange({
      initiativeId: initiative.id,
      title: "Implement bounded release-review experience",
      summary: "Represent the candidate design requirement through an exact Initiative-scoped backlog record without synthesizing commitment or readiness.",
      baseline: {
        kind: "genesis",
        declaration: "No prior implementation baseline exists for this bounded fixture.",
        rationale: "Create an explicit candidate Work Item for traceability testing.",
      },
      effectEnvelope: ["reversible-change"],
    }, product.revision!, actorId)
    const workItem = await engine.productStudio.createWorkItem({
      changeId: change.id,
      title: "Build bounded release-review projection",
      objective: "Implement the exact privacy-safe review projection and preserve all declared no-authority boundaries.",
      dependsOn: [],
      completionCriteria: ["The bounded release-review projection satisfies its focused contract tests"],
      evidenceCriteria: ["Focused contract and engine tests pass against the exact candidate revision"],
      scope: {
        read: [{ kind: "workspace-relative", path: "packages/contracts" }],
        write: [{ kind: "workspace-relative", path: "packages/engine" }],
        effects: [],
      },
      owner: { kind: "unassigned" },
    }, product.revision!, actorId)
    return { architecture, inventory, outcomeModel, requirement, workItem }
  }

  async function designRequirementsInput(
    outcomeModel: OutcomeModel,
    inventory: ScreenStateInventory,
    requirement: Awaited<ReturnType<typeof engine.productStudio.readRequirement>>,
    workItem: Awaited<ReturnType<typeof engine.productStudio.readWorkItem>>,
    overrides: Partial<DesignRequirementsInput> = {},
  ): Promise<DesignRequirementsInput> {
    const routeKeys = inventory.routeCoverage.filter((entry) => entry.status === "represented").map((entry) => entry.routeKey).sort()
    return {
      initiativeId: initiative.id,
      context: await exactContext(),
      informationClassification: "internal",
      title: "Customer portal Design Requirements candidate",
      outcomeModel: { recordId: outcomeModel.id, revision: outcomeModel.revision, digest: canonicalDigest(outcomeModel) },
      screenStateInventory: {
        recordId: inventory.id,
        revision: inventory.revision,
        digest: canonicalDigest(inventory),
        membershipDigest: inventory.membershipDigest,
      },
      requirements: [{
        key: requirement.key,
        requirement: {
          recordType: "requirement",
          recordId: requirement.id,
          revision: requirement.revision,
          digest: canonicalDigest(requirement),
        },
        outcomeIds: ["safe-release-review"],
        targets: {
          platformKeys: ["responsive-web"],
          screenKeys: ["release-review"],
          stateKeys: ["review-default", "review-error", "review-loading"],
          variantKeys: ["review-wide"],
          routeKeys,
          designScopeKeys: ["client-application.customer-portal"],
        },
        backlog: {
          state: "linked",
          workItems: [{
            recordType: "work-item",
            recordId: workItem.id,
            revision: workItem.revision,
            digest: canonicalDigest(workItem),
          }],
          rationale: "The requirement is represented by one exact current Work Item under this Initiative without establishing backlog commitment.",
        },
        evidence: {
          state: "human-reviewed",
          sources: [reference()],
          reviewedBy: { kind: "human", id: actorId },
          reviewedAt: "2026-07-28T12:00:00.000Z",
        },
        verificationEvidenceState: "supported",
        requirementValidityState: "not-established",
        satisfactionState: "not-established",
      }],
      outcomeCoverage: [{
        outcomeId: "safe-release-review",
        status: "represented",
        requirementKeys: [requirement.key],
        rationale: "The exact current outcome is explicitly represented by the bounded Design Requirement candidate.",
        sources: [reference()],
      }],
      catalogCompletenessState: "candidate-complete",
      unresolvedQuestions: [],
      limitations: ["Requirement validity, catalog completeness, priority approval, satisfaction, backlog commitment, design approval, readiness, implementation, and action authority remain not established"],
      reviewState: "ready-for-human-review",
      priorityApprovalState: "not-established",
      designApprovalState: "not-established",
      backlogCommitmentState: "not-established",
      readinessState: "not-established",
      implementationAuthorityState: "not-established",
      ...overrides,
    }
  }

  async function createDesignSystemTokenContractPrerequisites() {
    const { inventory, outcomeModel, requirement, workItem } = await createDesignRequirementsPrerequisites()
    const requirements = await engine.designRequirements.create(
      await designRequirementsInput(outcomeModel, inventory, requirement, workItem), actorId,
    )
    return { inventory, requirement, requirements }
  }

  async function designSystemTokenContractInput(
    inventory: ScreenStateInventory,
    requirement: Awaited<ReturnType<typeof engine.productStudio.readRequirement>>,
    requirements: DesignRequirements,
    overrides: Partial<DesignSystemTokenContractInput> = {},
  ): Promise<DesignSystemTokenContractInput> {
    const owner = { state: "assigned-candidate" as const, owner: { kind: "role" as const, id: "product-designer" } }
    const reviewed = { reviewedBy: { kind: "human" as const, id: actorId }, reviewedAt: "2026-07-28T12:30:00.000Z" }
    return {
      initiativeId: initiative.id,
      context: await exactContext(),
      informationClassification: "internal",
      title: "Customer portal Design System and Token Contract candidate",
      designApplicability: {
        recordId: applicability.id,
        revision: applicability.revision,
        digest: canonicalDigest(applicability),
        membershipDigest: applicability.membershipDigest,
      },
      screenStateInventory: {
        recordId: inventory.id,
        revision: inventory.revision,
        digest: canonicalDigest(inventory),
        membershipDigest: inventory.membershipDigest,
      },
      designRequirements: {
        recordId: requirements.id,
        revision: requirements.revision,
        digest: canonicalDigest(requirements),
        membershipDigest: requirements.membershipDigest,
      },
      designSystems: [{
        key: "customer-portal",
        name: "GAEP product interface system",
        disposition: "reuse-approved",
        approvedReference: {
          scopeKind: "client-application",
          scopeId: "customer-portal",
          name: "GAEP product interface system",
        },
        ownership: owner,
        sources: [reference()],
        limitations: ["The approved reference and candidate ownership do not establish design-system validity or authority"],
      }],
      tokens: [{
        path: "color.action.primary",
        designSystemKey: "customer-portal",
        origin: "candidate-declared",
        type: "color",
        valueDigest: digest("9"),
        ownership: owner,
        requirementKeys: [requirement.key],
        platformKeys: ["responsive-web"],
        screenKeys: ["release-review"],
        accessibilityImpact: "human-reviewed",
        ...reviewed,
        sources: [reference()],
      }],
      variableCollections: [{
        key: "portal-theme",
        designSystemKey: "customer-portal",
        ownership: owner,
        variableKeys: ["action-primary"],
        platformKeys: ["responsive-web"],
        sources: [reference()],
      }],
      variables: [{
        key: "action-primary",
        collectionKey: "portal-theme",
        designSystemKey: "customer-portal",
        state: "bound-to-token",
        tokenPath: "color.action.primary",
        ownership: owner,
        requirementKeys: [requirement.key],
        sources: [reference()],
      }],
      components: [{
        key: "release-review-card",
        designSystemKey: "customer-portal",
        disposition: "candidate-new",
        ownership: owner,
        tokenPaths: ["color.action.primary"],
        variableKeys: ["action-primary"],
        requirementKeys: [requirement.key],
        platformKeys: ["responsive-web"],
        screenKeys: ["release-review"],
        stateKeys: ["review-default", "review-error", "review-loading"],
        variantKeys: ["review-wide"],
        accessibilityEvidenceState: "human-reviewed",
        ...reviewed,
        sources: [reference()],
      }],
      requirementCoverage: [{
        requirementKey: requirement.key,
        state: "represented",
        tokenPaths: ["color.action.primary"],
        variableKeys: ["action-primary"],
        componentKeys: ["release-review-card"],
        rationale: "The exact candidate token, variable, and component links represent this current Design Requirement.",
        sources: [reference()],
      }],
      catalogCompletenessState: "candidate-complete",
      unresolvedQuestions: [],
      limitations: ["Design-system, token, variable, component, ownership, accessibility, approval, baseline, readiness, implementation, and action authority remain not established"],
      reviewState: "ready-for-human-review",
      designSystemValidityState: "not-established",
      ownershipAuthorityState: "not-established",
      designApprovalState: "not-established",
      designBaselineState: "not-established",
      readinessState: "not-established",
      implementationAuthorityState: "not-established",
      ...overrides,
    }
  }

  async function createAccessibilityDesignRulesPrerequisites() {
    const { inventory, requirement, requirements } = await createDesignSystemTokenContractPrerequisites()
    const designSystem = await engine.designSystemTokenContract.create(
      await designSystemTokenContractInput(inventory, requirement, requirements), actorId,
    )
    return { inventory, requirement, requirements, designSystem }
  }

  async function accessibilityDesignRulesInput(
    inventory: ScreenStateInventory,
    requirement: Awaited<ReturnType<typeof engine.productStudio.readRequirement>>,
    requirements: DesignRequirements,
    designSystem: DesignSystemTokenContract,
    overrides: Partial<AccessibilityDesignRulesInput> = {},
  ): Promise<AccessibilityDesignRulesInput> {
    const owner = { state: "assigned-candidate" as const, owner: { kind: "role" as const, id: "product-designer" } }
    return {
      initiativeId: initiative.id,
      context: await exactContext(),
      informationClassification: "internal",
      title: "Customer portal Accessibility Design Rules candidate",
      screenStateInventory: {
        recordId: inventory.id,
        revision: inventory.revision,
        digest: canonicalDigest(inventory),
        membershipDigest: inventory.membershipDigest,
      },
      designRequirements: {
        recordId: requirements.id,
        revision: requirements.revision,
        digest: canonicalDigest(requirements),
        membershipDigest: requirements.membershipDigest,
      },
      designSystemTokenContract: {
        recordId: designSystem.id,
        revision: designSystem.revision,
        digest: canonicalDigest(designSystem),
        membershipDigest: designSystem.membershipDigest,
      },
      targets: [{
        key: "release-review-component",
        kind: "component",
        referenceKey: "release-review-card",
        platformKeys: ["responsive-web"],
        screenKeys: ["release-review"],
        stateKeys: ["review-default"],
        requirementKeys: [requirement.key],
        ownership: owner,
        sources: [reference()],
        limitations: ["The governed target identity does not prove accessibility or implementation quality"],
      }],
      rules: [{
        key: "keyboard-operation",
        title: "Keyboard operation remains available",
        principle: "operable",
        applicability: "applicable",
        impact: "major",
        targetKeys: ["release-review-component"],
        requirementKeys: [requirement.key],
        checkKeys: ["keyboard-operation-review"],
        standardReferences: [{ family: "wcag", version: "2.2", criterion: "2.1.1", level: "A" }],
        ownership: owner,
        rationale: "The primary release-review interaction requires a defined keyboard design check before accountable human review.",
        sources: [reference()],
      }],
      checks: [{
        key: "keyboard-operation-review",
        ruleKey: "keyboard-operation",
        targetKeys: ["release-review-component"],
        method: "manual",
        evidenceState: "human-reviewed",
        observation: "evidence-supports",
        evidenceDigests: [digest("a")],
        reviewedBy: { kind: "human", id: actorId },
        reviewedAt: "2026-07-28T14:00:00.000Z",
        procedure: "Review the governed component design for keyboard reachability, visible focus, logical order, and non-pointer alternatives.",
        sources: [reference()],
      }],
      requirementCoverage: [{
        requirementKey: requirement.key,
        state: "represented",
        ruleKeys: ["keyboard-operation"],
        rationale: "The exact current Design Requirement is represented by the candidate keyboard-operation accessibility rule.",
        sources: [reference()],
      }],
      catalogCompletenessState: "candidate-complete",
      unresolvedQuestions: [],
      limitations: ["Accessibility conformance, rule and check validity, legal compliance, ownership authority, design approval, baseline, readiness, and implementation remain not established"],
      reviewState: "ready-for-human-review",
      accessibilityConformanceState: "not-established",
      ruleValidityState: "not-established",
      legalComplianceState: "not-established",
      designApprovalState: "not-established",
      designBaselineState: "not-established",
      readinessState: "not-established",
      implementationAuthorityState: "not-established",
      ...overrides,
    }
  }

  async function createResponsiveMultiPlatformTargetsPrerequisites() {
    const { inventory, requirement, requirements, designSystem } = await createAccessibilityDesignRulesPrerequisites()
    const accessibility = await engine.accessibilityDesignRules.create(
      await accessibilityDesignRulesInput(inventory, requirement, requirements, designSystem), actorId,
    )
    return { inventory, requirement, requirements, designSystem, accessibility }
  }

  async function responsiveMultiPlatformTargetsInput(
    inventory: ScreenStateInventory,
    requirement: Awaited<ReturnType<typeof engine.productStudio.readRequirement>>,
    requirements: DesignRequirements,
    designSystem: DesignSystemTokenContract,
    accessibility: AccessibilityDesignRules,
    overrides: Partial<ResponsiveMultiPlatformTargetsInput> = {},
  ): Promise<ResponsiveMultiPlatformTargetsInput> {
    const owner = { state: "assigned-candidate" as const, owner: { kind: "role" as const, id: "product-designer" } }
    return {
      initiativeId: initiative.id,
      context: await exactContext(),
      informationClassification: "internal",
      title: "Customer portal Responsive and Multi-Platform Targets candidate",
      screenStateInventory: {
        recordId: inventory.id, revision: inventory.revision,
        digest: canonicalDigest(inventory), membershipDigest: inventory.membershipDigest,
      },
      designRequirements: {
        recordId: requirements.id, revision: requirements.revision,
        digest: canonicalDigest(requirements), membershipDigest: requirements.membershipDigest,
      },
      designSystemTokenContract: {
        recordId: designSystem.id, revision: designSystem.revision,
        digest: canonicalDigest(designSystem), membershipDigest: designSystem.membershipDigest,
      },
      accessibilityDesignRules: {
        recordId: accessibility.id, revision: accessibility.revision,
        digest: canonicalDigest(accessibility), membershipDigest: accessibility.membershipDigest,
      },
      platformTargets: [{
        key: "responsive-web-target",
        platformKey: "responsive-web",
        formFactors: ["desktop", "phone", "tablet"],
        deliverySurfaces: ["responsive-web"],
        inputModes: ["keyboard", "pointer", "touch"],
        orientations: ["landscape", "portrait"],
        contextClassKeys: ["compact", "wide"],
        screenKeys: ["release-review"],
        requirementKeys: [requirement.key],
        ownership: owner,
        sources: [reference()],
        limitations: ["Candidate form-factor coverage does not prove responsive completeness or platform parity"],
      }],
      breakpoints: [{
        key: "responsive-web-compact",
        platformKey: "responsive-web",
        contextClassKey: "compact",
        basis: "container",
        maximumInlineSizePxExclusive: 768,
        rationale: "The compact candidate class preserves the exact governed review sequence below the declared transition edge.",
        sources: [reference()],
      }, {
        key: "responsive-web-wide",
        platformKey: "responsive-web",
        contextClassKey: "wide",
        basis: "container",
        minimumInlineSizePx: 768,
        rationale: "The wide candidate class permits a split presentation without changing task or authorization semantics.",
        sources: [reference()],
      }],
      behaviors: [{
        key: "release-review-layout",
        title: "Release review adapts without changing task order",
        kind: "layout",
        applicability: "applicable",
        platformKeys: ["responsive-web"],
        breakpointKeys: ["responsive-web-compact", "responsive-web-wide"],
        screenKeys: ["release-review"],
        stateKeys: ["review-default"],
        requirementKeys: [requirement.key],
        accessibilityRuleKeys: ["keyboard-operation"],
        adaptationRules: ["Collapse the wide candidate split view to one canonical ordered column in the compact class"],
        preservationRules: ["Preserve content priority, task order, authorization meaning, focus order, and recovery access"],
        ownership: owner,
        rationale: "The governed screen must retain one semantic task sequence across both exact candidate container classes.",
        sources: [reference()],
      }],
      checks: [{
        key: "release-review-compact-check",
        behaviorKey: "release-review-layout",
        platformKey: "responsive-web",
        breakpointKey: "responsive-web-compact",
        screenKey: "release-review",
        stateKey: "review-default",
        method: "hybrid",
        evidenceState: "human-reviewed",
        observation: "evidence-supports",
        evidenceDigests: [digest("b")],
        reviewedBy: { kind: "human", id: actorId },
        reviewedAt: "2026-07-28T15:00:00.000Z",
        procedure: "Inspect the compact candidate layout and recorded automation evidence for semantic order, focus continuity, overflow, and recovery access.",
        sources: [reference()],
      }],
      requirementCoverage: [{
        requirementKey: requirement.key,
        state: "represented",
        behaviorKeys: ["release-review-layout"],
        rationale: "The exact current Design Requirement is represented by the candidate cross-container release-review behavior.",
        sources: [reference()],
      }],
      targetCatalogState: "candidate-complete",
      breakpointCatalogState: "candidate-complete",
      behaviorCatalogState: "candidate-complete",
      unresolvedQuestions: [],
      limitations: ["Responsive completeness, platform parity, breakpoint and behavior validity, accessibility, approval, baseline, readiness, and implementation remain not established"],
      reviewState: "ready-for-human-review",
      responsiveCompletenessState: "not-established",
      platformParityState: "not-established",
      breakpointValidityState: "not-established",
      behaviorValidityState: "not-established",
      accessibilityConformanceState: "not-established",
      designApprovalState: "not-established",
      designBaselineState: "not-established",
      readinessState: "not-established",
      implementationAuthorityState: "not-established",
      ...overrides,
    }
  }

  async function createManualFigmaExecutionPathPrerequisites() {
    const applicabilityInput = designApplicabilityInput()
    applicabilityInput.scopes[0]!.designSource.modes = ["figma-design", "repository-native"]
    applicability = await engine.designApplicability.revise(
      applicability.id, applicability.revision, applicabilityInput, actorId,
    )
    const { inventory, requirement, requirements, designSystem, accessibility } =
      await createResponsiveMultiPlatformTargetsPrerequisites()
    const responsive = await engine.responsiveMultiPlatformTargets.create(
      await responsiveMultiPlatformTargetsInput(inventory, requirement, requirements, designSystem, accessibility), actorId,
    )
    return { inventory, requirement, requirements, designSystem, accessibility, responsive }
  }

  async function manualFigmaExecutionPathInput(
    inventory: ScreenStateInventory,
    requirement: Awaited<ReturnType<typeof engine.productStudio.readRequirement>>,
    requirements: DesignRequirements,
    designSystem: DesignSystemTokenContract,
    accessibility: AccessibilityDesignRules,
    responsive: ResponsiveMultiPlatformTargets,
    overrides: Partial<ManualFigmaExecutionPathInput> = {},
  ): Promise<ManualFigmaExecutionPathInput> {
    const scopeKey = "customer-portal"
    const checkKinds = [
      "accessibility-reviewed",
      "handoff-manifest-digest-verified",
      "handoff-package-digest-verified",
      "handoff-path-contained",
      "instructions-reviewed",
      "privacy-reviewed",
      "responsive-targets-reviewed",
      "return-contract-reviewed",
    ] as const
    return {
      initiativeId: initiative.id,
      context: await exactContext(),
      informationClassification: "internal",
      title: "Customer portal Manual Figma Execution Path candidate",
      designApplicability: {
        recordId: applicability.id, revision: applicability.revision,
        digest: canonicalDigest(applicability), membershipDigest: applicability.membershipDigest,
      },
      screenStateInventory: {
        recordId: inventory.id, revision: inventory.revision,
        digest: canonicalDigest(inventory), membershipDigest: inventory.membershipDigest,
      },
      designRequirements: {
        recordId: requirements.id, revision: requirements.revision,
        digest: canonicalDigest(requirements), membershipDigest: requirements.membershipDigest,
      },
      designSystemTokenContract: {
        recordId: designSystem.id, revision: designSystem.revision,
        digest: canonicalDigest(designSystem), membershipDigest: designSystem.membershipDigest,
      },
      accessibilityDesignRules: {
        recordId: accessibility.id, revision: accessibility.revision,
        digest: canonicalDigest(accessibility), membershipDigest: accessibility.membershipDigest,
      },
      responsiveMultiPlatformTargets: {
        recordId: responsive.id, revision: responsive.revision,
        digest: canonicalDigest(responsive), membershipDigest: responsive.membershipDigest,
      },
      scopes: [{
        key: scopeKey,
        designScopeKey: scopeKey,
        figmaMode: "figma-design",
        executionMode: "manual-disconnected",
        handoffLocation: "design-handoff/customer-portal",
        handoffManifestDigest: digest("c"),
        handoffPackageDigest: digest("d"),
        includedArtifacts: [...manualFigmaHandoffArtifactKinds],
        requiredReturns: [...manualFigmaReturnArtifactKinds],
        instructionStepKeys: ["export-return", "handoff", "human-review", "manual-figma-execution", "prepare"],
        ownership: { state: "assigned-candidate", owner: { kind: "role", id: "product-designer" } },
        sources: [reference()],
        limitations: ["This candidate location and digest set does not prove that a handoff bundle exists or was executed"],
      }],
      instructions: manualFigmaInstructionKinds.map((kind, index) => ({
        key: kind,
        sequence: index + 1,
        kind,
        scopeKeys: [scopeKey],
        instruction: `Perform the ${kind} stage against the exact digest-bound candidate metadata without treating guidance as execution authority.`,
        requiredInputs: kind === "prepare" ? [] : ["design-brief" as const],
        expectedOutputs: kind === "export-return" ? [...manualFigmaReturnArtifactKinds] : [],
        humanActionRequired: kind === "manual-figma-execution",
        completionState: "not-executed" as const,
        actionAuthorityState: "not-granted" as const,
        sources: [reference()],
      })),
      checks: checkKinds.map((kind) => ({
        key: kind,
        scopeKey,
        kind,
        evidenceState: "human-reviewed" as const,
        observation: "evidence-supports" as const,
        evidenceDigests: [digest("e")],
        reviewedBy: { kind: "human" as const, id: actorId },
        reviewedAt: "2026-07-28T18:00:00.000Z",
        procedure: `Review the ${kind} candidate control against its exact governed inputs and recorded evidence without claiming Figma execution.`,
        sources: [reference()],
      })),
      requirementCoverage: [{
        requirementKey: requirement.key,
        state: "represented",
        scopeKeys: [scopeKey],
        rationale: "The exact current Design Requirement is represented in the digest-bound manual Figma execution guidance scope.",
        sources: [reference()],
      }],
      guideCatalogState: "candidate-complete",
      handoffCatalogState: "candidate-complete",
      returnContractState: "candidate-complete",
      unresolvedQuestions: [],
      limitations: ["Figma connection, execution, returned-design review, approval, baseline, readiness, implementation, and action authority remain not established"],
      reviewState: "ready-for-human-review",
      figmaConnectionState: "disconnected-only",
      figmaExecutionState: "not-executed",
      figmaWriteAuthorityState: "not-granted",
      designApprovalState: "not-established",
      designBaselineState: "not-established",
      readinessState: "not-established",
      implementationAuthorityState: "not-granted",
      ...overrides,
    }
  }

  async function figmaMcpCapabilityDiscoveryInput(
    manualPath: ManualFigmaExecutionPath,
    overrides: Partial<FigmaMcpCapabilityDiscoveryInput> = {},
  ): Promise<FigmaMcpCapabilityDiscoveryInput> {
    const permissions = {
      read: [{
        key: "file-read",
        accessClass: "read" as const,
        requirementState: "required" as const,
        grantState: "not-granted" as const,
        rationale: "The advertised read operation declares a file-scoped read requirement without granting access.",
        sources: [reference()],
      }],
      write: [{
        key: "file-write",
        accessClass: "write" as const,
        requirementState: "required" as const,
        grantState: "not-granted" as const,
        rationale: "The advertised write operation declares a file-scoped write requirement without granting access.",
        sources: [reference()],
      }],
    }
    const limits = [{
      key: "request-timeout",
      kind: "timeout" as const,
      state: "declared" as const,
      value: 30,
      unit: "seconds",
      rationale: "The source-backed candidate adapter description declares a bounded request timeout.",
      sources: [reference()],
    }]
    const tools = [
      {
        key: "read-file-metadata",
        toolName: "read_file_metadata",
        capabilityClass: "read-metadata" as const,
        effectClass: "figma-read" as const,
        availabilityState: "advertised" as const,
        versionState: "known" as const,
        version: "1.0",
        schemaDigest: digest("1"),
        permissions: permissions.read,
        limits,
        evidenceState: "human-reviewed" as const,
        evidenceDigests: [digest("2")],
        reviewedBy: { kind: "human" as const, id: actorId },
        reviewedAt: "2026-07-28T18:45:00.000Z",
        sources: [reference()],
        limitations: ["Advertised read availability is not live Figma compatibility evidence"],
      },
      {
        key: "write-design-node",
        toolName: "write_design_node",
        capabilityClass: "write-design" as const,
        effectClass: "figma-write" as const,
        availabilityState: "advertised" as const,
        versionState: "known" as const,
        version: "1.0",
        schemaDigest: digest("3"),
        permissions: permissions.write,
        limits,
        evidenceState: "human-reviewed" as const,
        evidenceDigests: [digest("4")],
        reviewedBy: { kind: "human" as const, id: actorId },
        reviewedAt: "2026-07-28T18:45:00.000Z",
        sources: [reference()],
        limitations: ["Advertised write capability grants no permission, write authority, or action authority"],
      },
    ]
    const catalogDigest = canonicalDigest(tools.map((tool) => ({
      key: tool.key,
      toolName: tool.toolName,
      capabilityClass: tool.capabilityClass,
      effectClass: tool.effectClass,
      availabilityState: tool.availabilityState,
      versionState: tool.versionState,
      version: tool.version,
      schemaDigest: tool.schemaDigest,
      permissions: tool.permissions,
      limits: tool.limits,
    })))
    return {
      initiativeId: initiative.id,
      context: await exactContext(),
      informationClassification: "internal",
      title: "Customer portal Figma MCP Capability Discovery candidate",
      designApplicability: {
        recordId: applicability.id,
        revision: applicability.revision,
        digest: canonicalDigest(applicability),
        membershipDigest: applicability.membershipDigest,
      },
      manualFigmaExecutionPath: {
        recordId: manualPath.id,
        revision: manualPath.revision,
        digest: canonicalDigest(manualPath),
        membershipDigest: manualPath.membershipDigest,
      },
      adapter: {
        key: "figma-mcp",
        kind: "figma-mcp",
        displayName: "Candidate Figma MCP adapter",
        transportClass: "local-process",
        installationState: "observed",
        discoveryInterfaceState: "advertised",
        adapterVersionState: "known",
        adapterVersion: "1.2.3",
        protocolVersionState: "known",
        protocolVersion: "2026-07",
        sources: [reference()],
        limitations: ["The source-backed observation does not prove a live Figma connection"],
      },
      observation: {
        state: "human-reviewed",
        catalogDigest,
        observedAt: "2026-07-28T18:40:00.000Z",
        reviewedBy: { kind: "human", id: actorId },
        reviewedAt: "2026-07-28T18:45:00.000Z",
      },
      tools,
      catalogState: "candidate-observation-complete",
      permissionModelState: "candidate-separated",
      limitCatalogState: "candidate-complete",
      versionCatalogState: "candidate-complete",
      ownership: { state: "assigned-candidate", owner: { kind: "role", id: "platform-integration-owner" } },
      unresolvedQuestions: [],
      limitations: ["No Figma request, credential access, permission grant, or compatibility test was performed"],
      reviewState: "ready-for-human-review",
      figmaConnectionState: "not-connected",
      figmaRequestState: "not-sent",
      credentialState: "not-requested",
      permissionGrantState: "not-granted",
      figmaWriteAuthorityState: "not-granted",
      designApprovalState: "not-established",
      designBaselineState: "not-established",
      readinessState: "not-established",
      implementationAuthorityState: "not-granted",
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

  it("persists, assesses, projects, and revises exact User Journey guidance without behavioral, validation, or design authority", async () => {
    const personaRole = await engine.designPersonaRoleModel.create(await input(), actorId)
    const firstInput = await journeyInput(personaRole)
    const candidate = await engine.userJourneyModel.create(firstInput, actorId)

    expect(candidate).toMatchObject({
      revision: 1,
      state: "candidate",
      journeys: [{ validationState: "not-established" }],
      journeyValidationState: "not-established",
      designApprovalState: "not-established",
      implementationAuthorityState: "not-established",
      authorityBoundary: expect.stringContaining("does-not-prove-observed-behavior"),
    })
    expect(await engine.userJourneyModel.assess(initiative.id)).toMatchObject({
      candidate: { recordId: candidate.id, revision: 1, digest: canonicalDigest(candidate) },
      journeyCount: 1,
      touchpointCount: 1,
      primaryPathCount: 1,
      successPathCount: 1,
      failurePathCount: 1,
      recoveryPathCount: 1,
      representedScopeCount: 1,
      unresolvedScopeCount: 0,
      weakEvidencePathCount: 0,
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      unresolvedQuestionCount: 0,
      reviewState: "ready-for-human-review",
      state: "complete-for-review",
      reasons: [],
    })
    const projection = await engine.userJourneyModel.project(initiative.id)
    const { snapshotDigest, ...projectionBody } = projection
    expect(snapshotDigest).toBe(canonicalDigest(projectionBody))
    expect(projection).toMatchObject({
      candidate: { id: candidate.id, revision: 1, journeyCount: 1, touchpointCount: 1 },
      privacyBoundary: expect.stringContaining("not-journey-step-touchpoint-persona-source-or-personal-content"),
      authorityBoundary: expect.stringContaining("does-not-prove-observed-behavior-validate-journeys"),
    })
    expect(JSON.stringify(projection)).not.toContain("Individual productivity ranking")
    expect(JSON.stringify(projection)).not.toContain("pilot-change-owner")

    const revisedInput = await journeyInput(personaRole, {
      limitations: [
        "Journey observation, validation, design approval, readiness, implementation, and action authority are not established",
        "The candidate remains subject to independent accountable human review",
      ].sort(),
    })
    const revised = await engine.userJourneyModel.revise(candidate.id, candidate.revision, revisedInput, actorId)
    expect(revised).toMatchObject({ id: candidate.id, revision: 2, predecessorDigest: canonicalDigest(candidate) })
    expect((await engine.userJourneyModel.listHistory(candidate.id)).map((record) => record.revision)).toEqual([2, 1])

    const bundle = await engine.productStudio.buildPortableExport()
    expect(bundle.manifest.members.map((member) => member.path)).toEqual(expect.arrayContaining([
      `user-journey-models/${candidate.id}.json`,
      `user-journey-model-history/user-journey-${candidate.id}-r1.json`,
      `user-journey-model-history/user-journey-${candidate.id}-r2.json`,
    ]))
    await expect(engine.productStudio.previewImportBundle(bundle)).resolves.toMatchObject({
      status: "compatible",
      importMutation: "not-performed",
    })

    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
    expect(events.at(-1)).toMatchObject({
      eventType: "user-journey.revised",
      payload: {
        revision: 2,
        recordDigest: canonicalDigest(revised),
        membershipDigest: revised.membershipDigest,
        predecessorDigest: canonicalDigest(candidate),
        journeyCount: 1,
        touchpointCount: 1,
        pathKindCounts: { failure: 1, primary: 1, recovery: 1, success: 1 },
        scopeCoverageStatusCounts: { represented: 1 },
        reviewState: "ready-for-human-review",
        journeyValidationState: "not-established",
        designApprovalState: "not-established",
        implementationAuthorityState: "not-established",
        readinessAuthorityState: "not-established",
        writeAuthorityState: "not-granted",
        actionAuthorityState: "not-granted",
      },
    })
  })

  it("fails User Journeys closed on stale dependencies, unknown persona or scope links, and superseded Source evidence", async () => {
    const personaRole = await engine.designPersonaRoleModel.create(await input(), actorId)
    const stale = await journeyInput(personaRole, {
      designPersonaRoleModel: {
        recordId: personaRole.id, revision: personaRole.revision,
        digest: digest("f"), membershipDigest: personaRole.membershipDigest,
      },
    })
    await expect(engine.userJourneyModel.create(stale, actorId)).rejects.toThrow("exact current Design Persona and Role")

    const unknownPersona = await journeyInput(personaRole)
    unknownPersona.journeys[0]!.personaKeys = ["unknown-persona"]
    unknownPersona.journeys[0]!.contestability.ownerPersonaKey = "unknown-persona"
    unknownPersona.journeys[0]!.touchpoints[0]!.personaKeys = ["unknown-persona"]
    for (const path of unknownPersona.journeys[0]!.paths) {
      path.personaKeys = ["unknown-persona"]
      path.steps[0]!.personaKeys = ["unknown-persona"]
    }
    await expect(engine.userJourneyModel.create(unknownPersona, actorId)).rejects.toThrow("reference personas")

    const unknownScope = await journeyInput(personaRole)
    unknownScope.journeys[0]!.designScopeKeys = ["client-application.unknown"]
    unknownScope.journeys[0]!.touchpoints[0]!.designScopeKeys = ["client-application.unknown"]
    unknownScope.scopeCoverage[0]!.designScopeKey = "client-application.unknown"
    await expect(engine.userJourneyModel.create(unknownScope, actorId)).rejects.toThrow("scope keys")

    const candidate = await engine.userJourneyModel.create(await journeyInput(personaRole), actorId)
    await engine.sourceGovernance.reviseSource(source.id, source.revision, sourceInput({
      revisionIdentity: { kind: "resource-revision", value: "GAEP-P2-03@2" },
      contentDigest: digest("b"),
    }), actorId)
    expect(await engine.userJourneyModel.assess(initiative.id)).toMatchObject({
      candidate: { recordId: candidate.id },
      staleBindingCount: 0,
      staleSourceReferenceCount: 1,
      state: "attention-required",
    })
    expect((await engine.workspaceHealth()).issues).toContainEqual(expect.objectContaining({
      code: "user-journey.binding-review-required",
      severity: "warning",
    }))
  })

  it("requires exact represented User Journey coverage for every materially applicable design scope", async () => {
    const personaRole = await engine.designPersonaRoleModel.create(await input(), actorId)
    const unresolved = await journeyInput(personaRole, {
      scopeCoverage: [{
        designScopeKey: "client-application.customer-portal",
        status: "unresolved",
        journeyKeys: [],
        rationale: "The hostile candidate leaves exact material journey coverage unresolved pending accountable review.",
        sources: [reference()],
        approval: { state: "pending", conditions: ["Accountable human journey review is required"] },
      }],
      reviewState: "held",
    })
    await expect(engine.userJourneyModel.create(unresolved, actorId)).rejects.toThrow("requires represented User Journey coverage")
  })

  it("persists, assesses, projects, and revises exact Information Architecture without findability, comprehension, accessibility, design, or action authority", async () => {
    const personaRole = await engine.designPersonaRoleModel.create(await input(), actorId)
    const journeyModel = await engine.userJourneyModel.create(await journeyInput(personaRole), actorId)
    const firstInput = await informationArchitectureInput(personaRole, journeyModel)
    const candidate = await engine.informationArchitectureModel.create(firstInput, actorId)

    expect(candidate).toMatchObject({
      revision: 1,
      state: "candidate",
      contentNodes: [{ validationState: "not-established" }],
      findabilityValidationState: "not-established",
      comprehensionValidationState: "not-established",
      accessibilityValidationState: "not-established",
      designApprovalState: "not-established",
      implementationAuthorityState: "not-established",
      authorityBoundary: expect.stringContaining("does-not-prove-findability-comprehension-or-accessibility"),
    })
    expect(candidate.navigationRoutes.every((route) => route.validationState === "not-established")).toBe(true)
    expect(await engine.informationArchitectureModel.assess(initiative.id)).toMatchObject({
      candidate: { recordId: candidate.id, revision: 1, digest: canonicalDigest(candidate) },
      nodeCount: 1,
      rootNodeCount: 1,
      routeCount: 4,
      representedScopeCount: 1,
      unresolvedScopeCount: 0,
      weakEvidenceNodeCount: 0,
      weakEvidenceRouteCount: 0,
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      unresolvedQuestionCount: 0,
      reviewState: "ready-for-human-review",
      state: "complete-for-review",
      reasons: [],
    })
    const projection = await engine.informationArchitectureModel.project(initiative.id)
    const { snapshotDigest, ...projectionBody } = projection
    expect(snapshotDigest).toBe(canonicalDigest(projectionBody))
    expect(projection).toMatchObject({
      candidate: { id: candidate.id, revision: 1, nodeCount: 1, rootNodeCount: 1, routeCount: 4 },
      privacyBoundary: expect.stringContaining("not-node-route-content-persona-source-or-personal-content"),
      authorityBoundary: expect.stringContaining("does-not-prove-findability-comprehension-or-accessibility"),
    })
    expect(JSON.stringify(projection)).not.toContain("Individual productivity ranking")
    expect(JSON.stringify(projection)).not.toContain("Governed release review")

    const revisedInput = await informationArchitectureInput(personaRole, journeyModel, {
      limitations: [
        "Findability, comprehension, accessibility validation, content validation, design approval, readiness, implementation, and action authority are not established",
        "The candidate remains subject to independent accountable human review",
      ].sort(),
    })
    const revised = await engine.informationArchitectureModel.revise(candidate.id, candidate.revision, revisedInput, actorId)
    expect(revised).toMatchObject({ id: candidate.id, revision: 2, predecessorDigest: canonicalDigest(candidate) })
    expect((await engine.informationArchitectureModel.listHistory(candidate.id)).map((record) => record.revision)).toEqual([2, 1])

    const bundle = await engine.productStudio.buildPortableExport()
    expect(bundle.manifest.members.map((member) => member.path)).toEqual(expect.arrayContaining([
      `information-architecture-models/${candidate.id}.json`,
      `information-architecture-model-history/information-architecture-${candidate.id}-r1.json`,
      `information-architecture-model-history/information-architecture-${candidate.id}-r2.json`,
    ]))
    await expect(engine.productStudio.previewImportBundle(bundle)).resolves.toMatchObject({
      status: "compatible",
      importMutation: "not-performed",
    })

    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
    expect(events.at(-1)).toMatchObject({
      eventType: "information-architecture.revised",
      payload: {
        revision: 2,
        recordDigest: canonicalDigest(revised),
        membershipDigest: revised.membershipDigest,
        predecessorDigest: canonicalDigest(candidate),
        designApplicability: revised.designApplicability,
        designPersonaRoleModel: revised.designPersonaRoleModel,
        userJourneyModel: revised.userJourneyModel,
        nodeCount: 1,
        rootNodeCount: 1,
        routeCount: 4,
        nodeKindCounts: { workspace: 1 },
        routeKindCounts: { failure: 1, primary: 1, recovery: 1, success: 1 },
        scopeCoverageStatusCounts: { represented: 1 },
        reviewState: "ready-for-human-review",
        findabilityValidationState: "not-established",
        comprehensionValidationState: "not-established",
        accessibilityValidationState: "not-established",
        designApprovalState: "not-established",
        implementationAuthorityState: "not-established",
        readinessAuthorityState: "not-established",
        writeAuthorityState: "not-granted",
        actionAuthorityState: "not-granted",
      },
    })
  })

  it("fails Information Architecture closed on stale dependencies, unknown journey touchpoints, and superseded Source evidence", async () => {
    const personaRole = await engine.designPersonaRoleModel.create(await input(), actorId)
    const journeyModel = await engine.userJourneyModel.create(await journeyInput(personaRole), actorId)
    const stale = await informationArchitectureInput(personaRole, journeyModel, {
      userJourneyModel: {
        recordId: journeyModel.id,
        revision: journeyModel.revision,
        digest: digest("f"),
        membershipDigest: journeyModel.membershipDigest,
      },
    })
    await expect(engine.informationArchitectureModel.create(stale, actorId)).rejects.toThrow("exact current User Journey")

    const unknownTouchpoint = await informationArchitectureInput(personaRole, journeyModel)
    unknownTouchpoint.contentNodes[0]!.touchpoints[0]!.touchpointKey = "missing-touchpoint"
    await expect(engine.informationArchitectureModel.create(unknownTouchpoint, actorId)).rejects.toThrow("exact current User Journey model")

    const candidate = await engine.informationArchitectureModel.create(
      await informationArchitectureInput(personaRole, journeyModel), actorId,
    )
    await engine.sourceGovernance.reviseSource(source.id, source.revision, sourceInput({
      revisionIdentity: { kind: "resource-revision", value: "GAEP-P2-04@2" },
      contentDigest: digest("b"),
    }), actorId)
    expect(await engine.informationArchitectureModel.assess(initiative.id)).toMatchObject({
      candidate: { recordId: candidate.id },
      staleBindingCount: 0,
      staleSourceReferenceCount: 1,
      state: "attention-required",
    })
    expect((await engine.workspaceHealth()).issues).toContainEqual(expect.objectContaining({
      code: "information-architecture.binding-review-required",
      severity: "warning",
    }))
  })

  it("requires represented Information Architecture coverage for every exact material journey path and touchpoint", async () => {
    const personaRole = await engine.designPersonaRoleModel.create(await input(), actorId)
    const journeyModel = await engine.userJourneyModel.create(await journeyInput(personaRole), actorId)
    const incomplete = await informationArchitectureInput(personaRole, journeyModel)
    incomplete.navigationRoutes = incomplete.navigationRoutes.filter((route) => route.kind !== "success")
    incomplete.scopeCoverage[0]!.routeKeys = incomplete.scopeCoverage[0]!.routeKeys.filter((key) => key !== "success-route")
    await expect(engine.informationArchitectureModel.create(incomplete, actorId)).rejects.toThrow("route every exact current User Journey path")

    const missingTouchpoint = await informationArchitectureInput(personaRole, journeyModel)
    missingTouchpoint.contentNodes[0]!.touchpoints = []
    await expect(engine.informationArchitectureModel.create(missingTouchpoint, actorId)).rejects.toThrow("place every exact current User Journey touchpoint")
  })

  it("persists, assesses, projects, and revises an exact Screen and State Inventory without UI, parity, reachability, quality, design, or action authority", async () => {
    const personaRole = await engine.designPersonaRoleModel.create(await input(), actorId)
    const journeyModel = await engine.userJourneyModel.create(await journeyInput(personaRole), actorId)
    const architecture = await engine.informationArchitectureModel.create(
      await informationArchitectureInput(personaRole, journeyModel), actorId,
    )
    const candidate = await engine.screenStateInventory.create(await screenStateInventoryInput(architecture), actorId)

    expect(candidate).toMatchObject({
      revision: 1,
      state: "candidate",
      platforms: [{ supportState: "targeted" }],
      screens: [{ validationState: "not-established" }],
      uiCompletenessState: "not-established",
      platformParityState: "not-established",
      stateReachabilityState: "not-established",
      interactionQualityState: "not-established",
      accessibilityValidationState: "not-established",
      designApprovalState: "not-established",
      implementationAuthorityState: "not-established",
      authorityBoundary: expect.stringContaining("does-not-prove-ui-completeness-platform-parity-state-reachability"),
    })
    expect(candidate.states.every((state) => state.validationState === "not-established")).toBe(true)
    expect(candidate.variants.every((variant) => variant.validationState === "not-established")).toBe(true)
    expect(await engine.screenStateInventory.assess(initiative.id)).toMatchObject({
      candidate: { recordId: candidate.id, revision: 1, digest: canonicalDigest(candidate) },
      platformCount: 1,
      targetedPlatformCount: 1,
      unresolvedPlatformCount: 0,
      screenCount: 1,
      stateCount: 3,
      variantCount: 1,
      representedRouteCount: 4,
      unresolvedRouteCount: 0,
      representedScopeCount: 1,
      unresolvedScopeCount: 0,
      weakEvidenceItemCount: 0,
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      unresolvedQuestionCount: 0,
      reviewState: "ready-for-human-review",
      state: "complete-for-review",
      reasons: [],
    })
    const projection = await engine.screenStateInventory.project(initiative.id)
    const { snapshotDigest, ...projectionBody } = projection
    expect(snapshotDigest).toBe(canonicalDigest(projectionBody))
    expect(projection).toMatchObject({
      candidate: { id: candidate.id, revision: 1, platformCount: 1, screenCount: 1, stateCount: 3, variantCount: 1 },
      privacyBoundary: expect.stringContaining("not-screen-state-variant-platform-content"),
      authorityBoundary: expect.stringContaining("does-not-prove-ui-completeness-platform-parity-state-reachability"),
    })
    expect(JSON.stringify(projection)).not.toContain("Individual productivity ranking")
    expect(JSON.stringify(projection)).not.toContain("Release readiness review")

    const revisedInput = await screenStateInventoryInput(architecture, {
      limitations: [
        "The candidate remains subject to independent accountable human review",
        "UI completeness, platform parity, state reachability, interaction quality, accessibility validation, design approval, readiness, implementation, and action authority remain not established",
      ].sort(),
    })
    const revised = await engine.screenStateInventory.revise(candidate.id, candidate.revision, revisedInput, actorId)
    expect(revised).toMatchObject({ id: candidate.id, revision: 2, predecessorDigest: canonicalDigest(candidate) })
    expect((await engine.screenStateInventory.listHistory(candidate.id)).map((record) => record.revision)).toEqual([2, 1])

    const bundle = await engine.productStudio.buildPortableExport()
    expect(bundle.manifest.members.map((member) => member.path)).toEqual(expect.arrayContaining([
      `screen-state-inventories/${candidate.id}.json`,
      `screen-state-inventory-history/screen-state-inventory-${candidate.id}-r1.json`,
      `screen-state-inventory-history/screen-state-inventory-${candidate.id}-r2.json`,
    ]))
    await expect(engine.productStudio.previewImportBundle(bundle)).resolves.toMatchObject({
      status: "compatible",
      importMutation: "not-performed",
    })

    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
    expect(events.at(-1)).toMatchObject({
      eventType: "screen-state-inventory.revised",
      payload: {
        revision: 2,
        recordDigest: canonicalDigest(revised),
        membershipDigest: revised.membershipDigest,
        predecessorDigest: canonicalDigest(candidate),
        informationArchitectureModel: revised.informationArchitectureModel,
        platformCount: 1,
        targetedPlatformCount: 1,
        screenCount: 1,
        stateCount: 3,
        variantCount: 1,
        stateKindCounts: { default: 1, error: 1, loading: 1 },
        routeCoverageStatusCounts: { represented: 4 },
        scopeCoverageStatusCounts: { represented: 1 },
        reviewState: "ready-for-human-review",
        uiCompletenessState: "not-established",
        platformParityState: "not-established",
        stateReachabilityState: "not-established",
        interactionQualityState: "not-established",
        accessibilityValidationState: "not-established",
        designApprovalState: "not-established",
        implementationAuthorityState: "not-established",
        readinessAuthorityState: "not-established",
        writeAuthorityState: "not-granted",
        actionAuthorityState: "not-granted",
      },
    })
  })

  it("fails Screen and State Inventory closed on stale architecture, unknown routes, incomplete coverage, and superseded Source evidence", async () => {
    const personaRole = await engine.designPersonaRoleModel.create(await input(), actorId)
    const journeyModel = await engine.userJourneyModel.create(await journeyInput(personaRole), actorId)
    const architecture = await engine.informationArchitectureModel.create(
      await informationArchitectureInput(personaRole, journeyModel), actorId,
    )
    const stale = await screenStateInventoryInput(architecture, {
      informationArchitectureModel: {
        recordId: architecture.id,
        revision: architecture.revision,
        digest: digest("f"),
        membershipDigest: architecture.membershipDigest,
      },
    })
    await expect(engine.screenStateInventory.create(stale, actorId)).rejects.toThrow("exact current Information Architecture")

    const unknownRoute = await screenStateInventoryInput(architecture)
    unknownRoute.screens[0]!.routeKeys = [...unknownRoute.screens[0]!.routeKeys, "unknown-route"].sort()
    await expect(engine.screenStateInventory.create(unknownRoute, actorId)).rejects.toThrow("exact current Information Architecture")

    const incompleteCoverage = await screenStateInventoryInput(architecture)
    incompleteCoverage.routeCoverage = incompleteCoverage.routeCoverage.slice(1)
    await expect(engine.screenStateInventory.create(incompleteCoverage, actorId)).rejects.toThrow("include every exact current Information Architecture route once")

    const candidate = await engine.screenStateInventory.create(await screenStateInventoryInput(architecture), actorId)
    await engine.sourceGovernance.reviseSource(source.id, source.revision, sourceInput({
      revisionIdentity: { kind: "resource-revision", value: "GAEP-P2-05@2" },
      contentDigest: digest("b"),
    }), actorId)
    expect(await engine.screenStateInventory.assess(initiative.id)).toMatchObject({
      candidate: { recordId: candidate.id },
      staleBindingCount: 0,
      staleSourceReferenceCount: 1,
      state: "attention-required",
    })
    expect((await engine.workspaceHealth()).issues).toContainEqual(expect.objectContaining({
      code: "screen-state-inventory.binding-review-required",
      severity: "warning",
    }))
  })

  it("persists, assesses, projects, and revises exact Design Requirements without validity, approval, commitment, readiness, or action authority", async () => {
    const { inventory, outcomeModel, requirement, workItem } = await createDesignRequirementsPrerequisites()
    const candidate = await engine.designRequirements.create(
      await designRequirementsInput(outcomeModel, inventory, requirement, workItem), actorId,
    )

    expect(candidate).toMatchObject({
      revision: 1,
      state: "candidate",
      requirements: [{
        key: requirement.key,
        backlog: { state: "linked", workItems: [{ recordId: workItem.id }] },
        requirementValidityState: "not-established",
        satisfactionState: "not-established",
      }],
      catalogCompletenessState: "candidate-complete",
      priorityApprovalState: "not-established",
      designApprovalState: "not-established",
      backlogCommitmentState: "not-established",
      readinessState: "not-established",
      implementationAuthorityState: "not-established",
      authorityBoundary: expect.stringContaining("do-not-establish-requirement-validity-completeness-priority-approval"),
    })
    expect(await engine.designRequirements.assess(initiative.id)).toMatchObject({
      candidate: { recordId: candidate.id, revision: 1, digest: canonicalDigest(candidate) },
      requirementCount: 1,
      mustPriorityCount: 1,
      representedOutcomeCount: 1,
      unresolvedOutcomeCount: 0,
      linkedBacklogRequirementCount: 1,
      notPlannedRequirementCount: 0,
      unresolvedBacklogRequirementCount: 0,
      workItemCount: 1,
      weakEvidenceRequirementCount: 0,
      staleBindingCount: 0,
      staleDomainReferenceCount: 0,
      staleSourceReferenceCount: 0,
      unresolvedQuestionCount: 0,
      catalogCompletenessState: "candidate-complete",
      reviewState: "ready-for-human-review",
      state: "complete-for-review",
      reasons: [],
    })
    const projection = await engine.designRequirements.project(initiative.id)
    const { snapshotDigest, ...projectionBody } = projection
    expect(snapshotDigest).toBe(canonicalDigest(projectionBody))
    expect(projection).toMatchObject({
      candidate: {
        id: candidate.id,
        revision: 1,
        requirementCount: 1,
        representedOutcomeCount: 1,
        workItemCount: 1,
      },
      privacyBoundary: expect.stringContaining("not-requirement-outcome-work-item-design-target-source-or-personal-content"),
      authorityBoundary: expect.stringContaining("does-not-establish-requirement-validity-completeness-priority-approval"),
    })
    expect(JSON.stringify(projection)).not.toContain(requirement.statement)
    expect(JSON.stringify(projection)).not.toContain(workItem.objective)
    expect(JSON.stringify(projection)).not.toContain(outcomeModel.outcomes[0]!.statement.text)

    const revisedInput = await designRequirementsInput(outcomeModel, inventory, requirement, workItem, {
      limitations: [
        "Requirement validity, catalog completeness, priority approval, satisfaction, backlog commitment, design approval, readiness, implementation, and action authority remain not established",
        "The candidate remains subject to independent accountable human review",
      ].sort(),
    })
    const revised = await engine.designRequirements.revise(candidate.id, candidate.revision, revisedInput, actorId)
    expect(revised).toMatchObject({ id: candidate.id, revision: 2, predecessorDigest: canonicalDigest(candidate) })
    expect((await engine.designRequirements.listHistory(candidate.id)).map((record) => record.revision)).toEqual([2, 1])

    const bundle = await engine.productStudio.buildPortableExport()
    expect(bundle.manifest.members.map((member) => member.path)).toEqual(expect.arrayContaining([
      `design-requirements/${candidate.id}.json`,
      `design-requirements-history/design-requirements-${candidate.id}-r1.json`,
      `design-requirements-history/design-requirements-${candidate.id}-r2.json`,
    ]))
    await expect(engine.productStudio.previewImportBundle(bundle)).resolves.toMatchObject({
      status: "compatible",
      importMutation: "not-performed",
    })

    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
    expect(events.at(-1)).toMatchObject({
      eventType: "design-requirements.revised",
      payload: {
        revision: 2,
        recordDigest: canonicalDigest(revised),
        membershipDigest: revised.membershipDigest,
        predecessorDigest: canonicalDigest(candidate),
        outcomeModel: revised.outcomeModel,
        screenStateInventory: revised.screenStateInventory,
        requirementCount: 1,
        requirementCatalogDigest: canonicalDigest(revised.requirements.map((entry) => ({ key: entry.key, requirement: entry.requirement }))),
        outcomeCoverageDigest: canonicalDigest(revised.outcomeCoverage.map((entry) => ({
          outcomeId: entry.outcomeId, status: entry.status, requirementKeys: entry.requirementKeys,
        }))),
        backlogDispositionCounts: { linked: 1 },
        workItemCount: 1,
        catalogCompletenessState: "candidate-complete",
        reviewState: "ready-for-human-review",
        priorityApprovalState: "not-established",
        designApprovalState: "not-established",
        backlogCommitmentState: "not-established",
        readinessState: "not-established",
        implementationAuthorityState: "not-established",
        requirementValidityState: "not-established",
        requirementSatisfactionState: "not-established",
        writeAuthorityState: "not-granted",
        actionAuthorityState: "not-granted",
      },
    })
  })

  it("fails Design Requirements closed on stale bindings, unknown targets, incomplete outcome coverage, and superseded domain evidence", async () => {
    const { inventory, outcomeModel, requirement, workItem } = await createDesignRequirementsPrerequisites()
    const staleOutcome = await designRequirementsInput(outcomeModel, inventory, requirement, workItem, {
      outcomeModel: { recordId: outcomeModel.id, revision: outcomeModel.revision, digest: digest("f") },
    })
    await expect(engine.designRequirements.create(staleOutcome, actorId)).rejects.toThrow("exact current Outcome Model")

    const unknownScreen = await designRequirementsInput(outcomeModel, inventory, requirement, workItem)
    unknownScreen.requirements[0]!.targets.screenKeys = ["unknown-screen"]
    await expect(engine.designRequirements.create(unknownScreen, actorId)).rejects.toThrow("exact current Screen and State Inventory")

    const incompleteOutcomes = await designRequirementsInput(outcomeModel, inventory, requirement, workItem)
    incompleteOutcomes.outcomeCoverage = []
    await expect(engine.designRequirements.create(incompleteOutcomes, actorId)).rejects.toThrow()

    const candidate = await engine.designRequirements.create(
      await designRequirementsInput(outcomeModel, inventory, requirement, workItem), actorId,
    )
    await engine.productStudio.reviseRequirement(
      requirement.id,
      requirement.revision,
      { state: "accepted" },
      actorId,
      "Record the generic Requirement state without granting design approval or satisfaction authority.",
    )
    expect(await engine.designRequirements.assess(initiative.id)).toMatchObject({
      candidate: { recordId: candidate.id },
      staleBindingCount: 0,
      staleDomainReferenceCount: 1,
      state: "attention-required",
    })
    expect((await engine.workspaceHealth()).issues).toContainEqual(expect.objectContaining({
      code: "design-requirements.binding-review-required",
      severity: "warning",
    }))
  })

  it("persists, assesses, projects, and revises an exact Design System and Token Contract without validity, ownership, accessibility, approval, baseline, readiness, or action authority", async () => {
    const { inventory, requirement, requirements } = await createDesignSystemTokenContractPrerequisites()
    const candidate = await engine.designSystemTokenContract.create(
      await designSystemTokenContractInput(inventory, requirement, requirements), actorId,
    )

    expect(candidate).toMatchObject({
      revision: 1,
      state: "candidate",
      designSystems: [{ disposition: "reuse-approved", ownership: { state: "assigned-candidate" } }],
      tokens: [{ origin: "candidate-declared", accessibilityImpact: "human-reviewed" }],
      variableCollections: [{ variableKeys: ["action-primary"] }],
      variables: [{ state: "bound-to-token", tokenPath: "color.action.primary" }],
      components: [{ disposition: "candidate-new", accessibilityEvidenceState: "human-reviewed" }],
      designSystemValidityState: "not-established",
      ownershipAuthorityState: "not-established",
      designApprovalState: "not-established",
      designBaselineState: "not-established",
      readinessState: "not-established",
      implementationAuthorityState: "not-established",
      authorityBoundary: expect.stringContaining("does-not-establish-design-system-token-variable-or-component-validity"),
    })
    expect(await engine.designSystemTokenContract.assess(initiative.id)).toMatchObject({
      candidate: { recordId: candidate.id, revision: 1, digest: canonicalDigest(candidate) },
      designSystemCount: 1,
      tokenCount: 1,
      variableCollectionCount: 1,
      variableCount: 1,
      componentCount: 1,
      representedRequirementCount: 1,
      unresolvedRequirementCount: 0,
      unresolvedOwnershipCount: 0,
      unresolvedCatalogItemCount: 0,
      accessibilityReviewGapCount: 0,
      staleBindingCount: 0,
      stalePortableSnapshotCount: 0,
      staleSourceReferenceCount: 0,
      unresolvedQuestionCount: 0,
      catalogCompletenessState: "candidate-complete",
      reviewState: "ready-for-human-review",
      state: "complete-for-review",
      reasons: [],
    })
    const projection = await engine.designSystemTokenContract.project(initiative.id)
    const { snapshotDigest, ...projectionBody } = projection
    expect(snapshotDigest).toBe(canonicalDigest(projectionBody))
    expect(projection).toMatchObject({
      candidate: {
        id: candidate.id,
        revision: 1,
        designSystemCount: 1,
        tokenCount: 1,
        variableCollectionCount: 1,
        variableCount: 1,
        componentCount: 1,
        representedRequirementCount: 1,
      },
      privacyBoundary: expect.stringContaining("not-token-values-component-content-requirement-source-design-or-personal-content"),
      authorityBoundary: expect.stringContaining("does-not-establish-design-system-token-variable-or-component-validity"),
    })
    expect(JSON.stringify(projection)).not.toContain("color.action.primary")
    expect(JSON.stringify(projection)).not.toContain("release-review-card")

    const revisedInput = await designSystemTokenContractInput(inventory, requirement, requirements, {
      limitations: [
        "Design-system, token, variable, component, ownership, accessibility, approval, baseline, readiness, implementation, and action authority remain not established",
        "The catalog remains subject to independent accountable human validation",
      ].sort(),
    })
    const revised = await engine.designSystemTokenContract.revise(candidate.id, candidate.revision, revisedInput, actorId)
    expect(revised).toMatchObject({ id: candidate.id, revision: 2, predecessorDigest: canonicalDigest(candidate) })
    expect((await engine.designSystemTokenContract.listHistory(candidate.id)).map((record) => record.revision)).toEqual([2, 1])

    const bundle = await engine.productStudio.buildPortableExport()
    expect(bundle.manifest.members.map((member) => member.path)).toEqual(expect.arrayContaining([
      `design-system-token-contracts/${candidate.id}.json`,
      `design-system-token-contracts-history/design-system-token-contract-${candidate.id}-r1.json`,
      `design-system-token-contracts-history/design-system-token-contract-${candidate.id}-r2.json`,
    ]))
    await expect(engine.productStudio.previewImportBundle(bundle)).resolves.toMatchObject({
      status: "compatible",
      importMutation: "not-performed",
    })

    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
    expect(events.at(-1)).toMatchObject({
      eventType: "design-system-token-contract.revised",
      payload: {
        revision: 2,
        recordDigest: canonicalDigest(revised),
        membershipDigest: revised.membershipDigest,
        predecessorDigest: canonicalDigest(candidate),
        designApplicability: revised.designApplicability,
        screenStateInventory: revised.screenStateInventory,
        designRequirements: revised.designRequirements,
        designSystemCount: 1,
        tokenCount: 1,
        variableCollectionCount: 1,
        variableCount: 1,
        componentCount: 1,
        catalogCompletenessState: "candidate-complete",
        reviewState: "ready-for-human-review",
        designSystemValidityState: "not-established",
        ownershipAuthorityState: "not-established",
        designApprovalState: "not-established",
        designBaselineState: "not-established",
        readinessState: "not-established",
        implementationAuthorityState: "not-established",
        tokenVariableComponentValidityState: "not-established",
        accessibilityValidityState: "not-established",
        writeAuthorityState: "not-granted",
        actionAuthorityState: "not-granted",
      },
    })
  })

  it("fails Design System and Token Contract closed on stale dependencies, unknown approved systems, targets, or requirement coverage", async () => {
    const { inventory, requirement, requirements } = await createDesignSystemTokenContractPrerequisites()
    const staleRequirements = await designSystemTokenContractInput(inventory, requirement, requirements, {
      designRequirements: {
        recordId: requirements.id,
        revision: requirements.revision,
        digest: digest("f"),
        membershipDigest: requirements.membershipDigest,
      },
    })
    await expect(engine.designSystemTokenContract.create(staleRequirements, actorId)).rejects.toThrow("exact current Design Requirements")

    const unknownApprovedSystem = await designSystemTokenContractInput(inventory, requirement, requirements)
    unknownApprovedSystem.designSystems[0]!.approvedReference!.name = "Unknown Design System"
    await expect(engine.designSystemTokenContract.create(unknownApprovedSystem, actorId)).rejects.toThrow("exact current Design Applicability")

    const unknownScreen = await designSystemTokenContractInput(inventory, requirement, requirements)
    unknownScreen.tokens[0]!.screenKeys = ["unknown-screen"]
    await expect(engine.designSystemTokenContract.create(unknownScreen, actorId)).rejects.toThrow("exact current governed catalog")

    const candidate = await engine.designSystemTokenContract.create(
      await designSystemTokenContractInput(inventory, requirement, requirements), actorId,
    )
    const revisedRequirementsInput = await designRequirementsInput(
      await engine.businessUnderstanding.readCurrentOutcomeModel(initiative.id) as OutcomeModel,
      inventory,
      requirement,
      await engine.productStudio.readWorkItem(requirements.requirements[0]!.backlog.workItems[0]!.recordId),
      { limitations: [
        "Requirement validity, catalog completeness, priority approval, satisfaction, backlog commitment, design approval, readiness, implementation, and action authority remain not established",
        "The current Design Requirements revision changed after the token contract candidate was created",
      ].sort() },
    )
    await engine.designRequirements.revise(requirements.id, requirements.revision, revisedRequirementsInput, actorId)
    expect(await engine.designSystemTokenContract.assess(initiative.id)).toMatchObject({
      candidate: { recordId: candidate.id },
      staleBindingCount: 1,
      state: "attention-required",
    })
    expect((await engine.workspaceHealth()).issues).toContainEqual(expect.objectContaining({
      code: "design-system-token-contract.binding-review-required",
      severity: "warning",
    }))
  })

  it("persists, assesses, projects, and revises exact Accessibility Design Rules without conformance, legal, ownership, approval, baseline, readiness, or action authority", async () => {
    const { inventory, requirement, requirements, designSystem } = await createAccessibilityDesignRulesPrerequisites()
    const candidate = await engine.accessibilityDesignRules.create(
      await accessibilityDesignRulesInput(inventory, requirement, requirements, designSystem), actorId,
    )

    expect(candidate).toMatchObject({
      revision: 1,
      state: "candidate",
      targets: [{ kind: "component", referenceKey: "release-review-card", ownership: { state: "assigned-candidate" } }],
      rules: [{ applicability: "applicable", principle: "operable", impact: "major" }],
      checks: [{ method: "manual", evidenceState: "human-reviewed", observation: "evidence-supports" }],
      accessibilityConformanceState: "not-established",
      ruleValidityState: "not-established",
      legalComplianceState: "not-established",
      designApprovalState: "not-established",
      designBaselineState: "not-established",
      readinessState: "not-established",
      implementationAuthorityState: "not-established",
      authorityBoundary: expect.stringContaining("do-not-establish-accessibility-conformance"),
    })
    expect(await engine.accessibilityDesignRules.assess(initiative.id)).toMatchObject({
      candidate: { recordId: candidate.id, revision: 1, digest: canonicalDigest(candidate) },
      targetCount: 1,
      ruleCount: 1,
      checkCount: 1,
      applicableRuleCount: 1,
      notApplicableRuleCount: 0,
      unresolvedRuleCount: 0,
      notAssessedCheckCount: 0,
      evidenceRecordedCheckCount: 0,
      humanReviewedCheckCount: 1,
      contradictedCheckCount: 0,
      representedRequirementCount: 1,
      unresolvedRequirementCount: 0,
      unresolvedOwnershipCount: 0,
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      unresolvedQuestionCount: 0,
      catalogCompletenessState: "candidate-complete",
      reviewState: "ready-for-human-review",
      state: "complete-for-review",
      reasons: [],
    })
    const projection = await engine.accessibilityDesignRules.project(initiative.id)
    const { snapshotDigest, ...projectionBody } = projection
    expect(snapshotDigest).toBe(canonicalDigest(projectionBody))
    expect(projection).toMatchObject({
      candidate: {
        id: candidate.id,
        revision: 1,
        targetCount: 1,
        ruleCount: 1,
        checkCount: 1,
        representedRequirementCount: 1,
      },
      privacyBoundary: expect.stringContaining("not-rule-procedures-evidence-requirement-source-design-or-personal-content"),
      authorityBoundary: expect.stringContaining("does-not-establish-accessibility-conformance"),
    })
    expect(JSON.stringify(projection)).not.toContain("keyboard-operation")
    expect(JSON.stringify(projection)).not.toContain("release-review-card")

    const revisedInput = await accessibilityDesignRulesInput(inventory, requirement, requirements, designSystem, {
      limitations: [
        "Accessibility conformance, rule and check validity, legal compliance, ownership authority, design approval, baseline, readiness, and implementation remain not established",
        "The catalog remains subject to independent accountable human and assistive-technology validation",
      ].sort(),
    })
    const revised = await engine.accessibilityDesignRules.revise(candidate.id, candidate.revision, revisedInput, actorId)
    expect(revised).toMatchObject({ id: candidate.id, revision: 2, predecessorDigest: canonicalDigest(candidate) })
    expect((await engine.accessibilityDesignRules.listHistory(candidate.id)).map((record) => record.revision)).toEqual([2, 1])

    const bundle = await engine.productStudio.buildPortableExport()
    expect(bundle.manifest.members.map((member) => member.path)).toEqual(expect.arrayContaining([
      `accessibility-design-rules/${candidate.id}.json`,
      `accessibility-design-rules-history/accessibility-design-rules-${candidate.id}-r1.json`,
      `accessibility-design-rules-history/accessibility-design-rules-${candidate.id}-r2.json`,
    ]))
    await expect(engine.productStudio.previewImportBundle(bundle)).resolves.toMatchObject({
      status: "compatible",
      importMutation: "not-performed",
    })

    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
    expect(events.at(-1)).toMatchObject({
      eventType: "accessibility-design-rules.revised",
      payload: {
        revision: 2,
        recordDigest: canonicalDigest(revised),
        membershipDigest: revised.membershipDigest,
        predecessorDigest: canonicalDigest(candidate),
        screenStateInventory: revised.screenStateInventory,
        designRequirements: revised.designRequirements,
        designSystemTokenContract: revised.designSystemTokenContract,
        targetCount: 1,
        ruleCount: 1,
        checkCount: 1,
        catalogCompletenessState: "candidate-complete",
        reviewState: "ready-for-human-review",
        accessibilityConformanceState: "not-established",
        ruleValidityState: "not-established",
        legalComplianceState: "not-established",
        designApprovalState: "not-established",
        designBaselineState: "not-established",
        readinessState: "not-established",
        implementationAuthorityState: "not-established",
        checkValidityState: "not-established",
        ownershipAuthorityState: "not-established",
        writeAuthorityState: "not-granted",
        actionAuthorityState: "not-granted",
      },
    })
  })

  it("fails Accessibility Design Rules closed on stale bindings, unknown targets, or mismatched Requirement coverage", async () => {
    const { inventory, requirement, requirements, designSystem } = await createAccessibilityDesignRulesPrerequisites()
    const staleDesignSystem = await accessibilityDesignRulesInput(inventory, requirement, requirements, designSystem, {
      designSystemTokenContract: {
        recordId: designSystem.id,
        revision: designSystem.revision,
        digest: digest("f"),
        membershipDigest: designSystem.membershipDigest,
      },
    })
    await expect(engine.accessibilityDesignRules.create(staleDesignSystem, actorId)).rejects.toThrow("exact current Design System and Token Contract")

    const unknownTarget = await accessibilityDesignRulesInput(inventory, requirement, requirements, designSystem)
    unknownTarget.targets[0]!.referenceKey = "unknown-component"
    await expect(engine.accessibilityDesignRules.create(unknownTarget, actorId)).rejects.toThrow("exact current governed")

    const mismatchedCoverage = await accessibilityDesignRulesInput(inventory, requirement, requirements, designSystem)
    mismatchedCoverage.rules[0]!.requirementKeys = []
    await expect(engine.accessibilityDesignRules.create(mismatchedCoverage, actorId)).rejects.toThrow("reconcile to exact rule Requirement links")

    const candidate = await engine.accessibilityDesignRules.create(
      await accessibilityDesignRulesInput(inventory, requirement, requirements, designSystem), actorId,
    )
    const revisedDesignSystemInput = await designSystemTokenContractInput(inventory, requirement, requirements, {
      limitations: [
        "Design-system, token, variable, component, ownership, accessibility, approval, baseline, readiness, implementation, and action authority remain not established",
        "The Design System and Token Contract changed after Accessibility Design Rules were created",
      ].sort(),
    })
    await engine.designSystemTokenContract.revise(designSystem.id, designSystem.revision, revisedDesignSystemInput, actorId)
    expect(await engine.accessibilityDesignRules.assess(initiative.id)).toMatchObject({
      candidate: { recordId: candidate.id },
      staleBindingCount: 1,
      state: "attention-required",
    })
    expect((await engine.workspaceHealth()).issues).toContainEqual(expect.objectContaining({
      code: "accessibility-design-rules.binding-review-required",
      severity: "warning",
    }))
  })

  it("persists, assesses, projects, and revises exact Responsive and Multi-Platform Targets without completeness, parity, validity, approval, readiness, or action authority", async () => {
    const { inventory, requirement, requirements, designSystem, accessibility } =
      await createResponsiveMultiPlatformTargetsPrerequisites()
    const candidate = await engine.responsiveMultiPlatformTargets.create(
      await responsiveMultiPlatformTargetsInput(inventory, requirement, requirements, designSystem, accessibility), actorId,
    )

    expect(candidate).toMatchObject({
      revision: 1,
      state: "candidate",
      platformTargets: [{ platformKey: "responsive-web", ownership: { state: "assigned-candidate" } }],
      breakpoints: [{ contextClassKey: "compact" }, { contextClassKey: "wide" }],
      behaviors: [{ applicability: "applicable", kind: "layout", accessibilityRuleKeys: ["keyboard-operation"] }],
      checks: [{ method: "hybrid", evidenceState: "human-reviewed", observation: "evidence-supports" }],
      responsiveCompletenessState: "not-established",
      platformParityState: "not-established",
      breakpointValidityState: "not-established",
      behaviorValidityState: "not-established",
      accessibilityConformanceState: "not-established",
      designApprovalState: "not-established",
      designBaselineState: "not-established",
      readinessState: "not-established",
      implementationAuthorityState: "not-established",
      authorityBoundary: expect.stringContaining("do-not-establish-responsive-completeness-platform-parity"),
    })
    expect(await engine.responsiveMultiPlatformTargets.assess(initiative.id)).toMatchObject({
      candidate: { recordId: candidate.id, revision: 1, digest: canonicalDigest(candidate) },
      platformTargetCount: 1,
      breakpointCount: 2,
      behaviorCount: 1,
      checkCount: 1,
      applicableBehaviorCount: 1,
      unresolvedBehaviorCount: 0,
      notAssessedCheckCount: 0,
      evidenceRecordedCheckCount: 0,
      humanReviewedCheckCount: 1,
      contradictedCheckCount: 0,
      representedRequirementCount: 1,
      unresolvedRequirementCount: 0,
      unresolvedOwnershipCount: 0,
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      unresolvedQuestionCount: 0,
      targetCatalogState: "candidate-complete",
      breakpointCatalogState: "candidate-complete",
      behaviorCatalogState: "candidate-complete",
      reviewState: "ready-for-human-review",
      state: "complete-for-review",
      reasons: [],
    })
    const projection = await engine.responsiveMultiPlatformTargets.project(initiative.id)
    const { snapshotDigest, ...projectionBody } = projection
    expect(snapshotDigest).toBe(canonicalDigest(projectionBody))
    expect(projection).toMatchObject({
      candidate: {
        id: candidate.id,
        revision: 1,
        platformTargetCount: 1,
        breakpointCount: 2,
        behaviorCount: 1,
        checkCount: 1,
        representedRequirementCount: 1,
      },
      privacyBoundary: expect.stringContaining("not-breakpoint-rules-behavior-procedures-evidence-requirement-source-design-or-personal-content"),
      authorityBoundary: expect.stringContaining("does-not-establish-responsive-completeness-platform-parity"),
    })
    expect(JSON.stringify(projection)).not.toContain("release-review-layout")
    expect(JSON.stringify(projection)).not.toContain("responsive-web-compact")

    const revisedInput = await responsiveMultiPlatformTargetsInput(
      inventory, requirement, requirements, designSystem, accessibility,
      { limitations: [
        "Responsive completeness, platform parity, breakpoint and behavior validity, accessibility, approval, baseline, readiness, and implementation remain not established",
        "The candidate matrix remains subject to independent attributable human validation on supported platforms",
      ].sort() },
    )
    const revised = await engine.responsiveMultiPlatformTargets.revise(candidate.id, candidate.revision, revisedInput, actorId)
    expect(revised).toMatchObject({ id: candidate.id, revision: 2, predecessorDigest: canonicalDigest(candidate) })
    expect((await engine.responsiveMultiPlatformTargets.listHistory(candidate.id)).map((record) => record.revision)).toEqual([2, 1])

    const bundle = await engine.productStudio.buildPortableExport()
    expect(bundle.manifest.members.map((member) => member.path)).toEqual(expect.arrayContaining([
      `responsive-multi-platform-targets/${candidate.id}.json`,
      `responsive-multi-platform-targets-history/responsive-multi-platform-targets-${candidate.id}-r1.json`,
      `responsive-multi-platform-targets-history/responsive-multi-platform-targets-${candidate.id}-r2.json`,
    ]))
    await expect(engine.productStudio.previewImportBundle(bundle)).resolves.toMatchObject({
      status: "compatible",
      importMutation: "not-performed",
    })

    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
    expect(events.at(-1)).toMatchObject({
      eventType: "responsive-multi-platform-targets.revised",
      payload: {
        revision: 2,
        recordDigest: canonicalDigest(revised),
        membershipDigest: revised.membershipDigest,
        predecessorDigest: canonicalDigest(candidate),
        screenStateInventory: revised.screenStateInventory,
        designRequirements: revised.designRequirements,
        designSystemTokenContract: revised.designSystemTokenContract,
        accessibilityDesignRules: revised.accessibilityDesignRules,
        platformTargetCount: 1,
        breakpointCount: 2,
        behaviorCount: 1,
        checkCount: 1,
        targetCatalogState: "candidate-complete",
        breakpointCatalogState: "candidate-complete",
        behaviorCatalogState: "candidate-complete",
        reviewState: "ready-for-human-review",
        responsiveCompletenessState: "not-established",
        platformParityState: "not-established",
        breakpointValidityState: "not-established",
        behaviorValidityState: "not-established",
        accessibilityConformanceState: "not-established",
        designApprovalState: "not-established",
        designBaselineState: "not-established",
        readinessState: "not-established",
        implementationAuthorityState: "not-established",
        ownershipAuthorityState: "not-established",
        writeAuthorityState: "not-granted",
        actionAuthorityState: "not-granted",
      },
    })
  })

  it("fails Responsive and Multi-Platform Targets closed on stale bindings, unknown context classes, or mismatched Requirement coverage", async () => {
    const { inventory, requirement, requirements, designSystem, accessibility } =
      await createResponsiveMultiPlatformTargetsPrerequisites()
    const staleAccessibility = await responsiveMultiPlatformTargetsInput(
      inventory, requirement, requirements, designSystem, accessibility,
      { accessibilityDesignRules: {
        recordId: accessibility.id,
        revision: accessibility.revision,
        digest: digest("f"),
        membershipDigest: accessibility.membershipDigest,
      } },
    )
    await expect(engine.responsiveMultiPlatformTargets.create(staleAccessibility, actorId))
      .rejects.toThrow("exact current Accessibility Design Rules")

    const unknownContext = await responsiveMultiPlatformTargetsInput(
      inventory, requirement, requirements, designSystem, accessibility,
    )
    unknownContext.breakpoints[0]!.contextClassKey = "unknown-context"
    await expect(engine.responsiveMultiPlatformTargets.create(unknownContext, actorId))
      .rejects.toThrow("exact current platform context classes")

    const mismatchedCoverage = await responsiveMultiPlatformTargetsInput(
      inventory, requirement, requirements, designSystem, accessibility,
    )
    mismatchedCoverage.behaviors[0]!.requirementKeys = []
    await expect(engine.responsiveMultiPlatformTargets.create(mismatchedCoverage, actorId))
      .rejects.toThrow("reconcile to exact behavior Requirement links")

    const candidate = await engine.responsiveMultiPlatformTargets.create(
      await responsiveMultiPlatformTargetsInput(inventory, requirement, requirements, designSystem, accessibility), actorId,
    )
    const revisedAccessibilityInput = await accessibilityDesignRulesInput(inventory, requirement, requirements, designSystem, {
      limitations: [
        "Accessibility conformance, rule and check validity, legal compliance, ownership authority, design approval, baseline, readiness, and implementation remain not established",
        "Accessibility Design Rules changed after the responsive target matrix was created",
      ].sort((left, right) => left.localeCompare(right)),
    })
    await engine.accessibilityDesignRules.revise(accessibility.id, accessibility.revision, revisedAccessibilityInput, actorId)
    expect(await engine.responsiveMultiPlatformTargets.assess(initiative.id)).toMatchObject({
      candidate: { recordId: candidate.id },
      staleBindingCount: 1,
      state: "attention-required",
    })
    expect((await engine.workspaceHealth()).issues).toContainEqual(expect.objectContaining({
      code: "responsive-multi-platform-targets.binding-review-required",
      severity: "warning",
    }))
  })

  it("persists, assesses, projects, and revises an exact disconnected Manual Figma Execution Path without connection, execution, approval, readiness, or action authority", async () => {
    const { inventory, requirement, requirements, designSystem, accessibility, responsive } =
      await createManualFigmaExecutionPathPrerequisites()
    const candidate = await engine.manualFigmaExecutionPath.create(
      await manualFigmaExecutionPathInput(
        inventory, requirement, requirements, designSystem, accessibility, responsive,
      ),
      actorId,
    )

    expect(candidate).toMatchObject({
      revision: 1,
      state: "candidate",
      scopes: [{
        designScopeKey: "customer-portal",
        figmaMode: "figma-design",
        executionMode: "manual-disconnected",
        ownership: { state: "assigned-candidate" },
      }],
      instructions: [
        { kind: "prepare", completionState: "not-executed", actionAuthorityState: "not-granted" },
        { kind: "handoff" },
        { kind: "manual-figma-execution", humanActionRequired: true },
        { kind: "export-return" },
        { kind: "human-review" },
      ],
      figmaConnectionState: "disconnected-only",
      figmaExecutionState: "not-executed",
      figmaWriteAuthorityState: "not-granted",
      designApprovalState: "not-established",
      designBaselineState: "not-established",
      readinessState: "not-established",
      implementationAuthorityState: "not-granted",
      authorityBoundary: expect.stringContaining("does-not-connect-to-figma-execute-design-actions"),
    })
    expect(await engine.manualFigmaExecutionPath.assess(initiative.id)).toMatchObject({
      candidate: { recordId: candidate.id, revision: 1, digest: canonicalDigest(candidate) },
      scopeCount: 1,
      instructionCount: 5,
      checkCount: 8,
      notAssessedCheckCount: 0,
      evidenceRecordedCheckCount: 0,
      humanReviewedCheckCount: 8,
      contradictedCheckCount: 0,
      representedRequirementCount: 1,
      unresolvedRequirementCount: 0,
      unresolvedOwnershipCount: 0,
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      unresolvedQuestionCount: 0,
      guideCatalogState: "candidate-complete",
      handoffCatalogState: "candidate-complete",
      returnContractState: "candidate-complete",
      reviewState: "ready-for-human-review",
      state: "complete-for-review",
      reasons: [],
    })
    const projection = await engine.manualFigmaExecutionPath.project(initiative.id)
    const { snapshotDigest, ...projectionBody } = projection
    expect(snapshotDigest).toBe(canonicalDigest(projectionBody))
    expect(projection).toMatchObject({
      candidate: {
        id: candidate.id,
        revision: 1,
        scopeCount: 1,
        instructionCount: 5,
        checkCount: 8,
        representedRequirementCount: 1,
      },
      privacyBoundary: expect.stringContaining("not-handoff-content-instructions-figma-identifiers-returned-design"),
      authorityBoundary: expect.stringContaining("does-not-connect-to-figma-prove-execution"),
    })
    expect(JSON.stringify(projection)).not.toContain("design-handoff/customer-portal")
    expect(JSON.stringify(projection)).not.toContain("Perform the prepare stage")

    const revisedInput = await manualFigmaExecutionPathInput(
      inventory, requirement, requirements, designSystem, accessibility, responsive,
      { limitations: [
        "Figma connection, execution, returned-design review, approval, baseline, readiness, implementation, and action authority remain not established",
        "The candidate manual guide remains subject to independent attributable human review before any external action",
      ].sort((left, right) => left.localeCompare(right)) },
    )
    const revised = await engine.manualFigmaExecutionPath.revise(candidate.id, candidate.revision, revisedInput, actorId)
    expect(revised).toMatchObject({ id: candidate.id, revision: 2, predecessorDigest: canonicalDigest(candidate) })
    expect((await engine.manualFigmaExecutionPath.listHistory(candidate.id)).map((record) => record.revision)).toEqual([2, 1])

    const bundle = await engine.productStudio.buildPortableExport()
    expect(bundle.manifest.members.map((member) => member.path)).toEqual(expect.arrayContaining([
      `manual-figma-execution-paths/${candidate.id}.json`,
      `manual-figma-execution-path-history/manual-figma-execution-path-${candidate.id}-r1.json`,
      `manual-figma-execution-path-history/manual-figma-execution-path-${candidate.id}-r2.json`,
    ]))
    await expect(engine.productStudio.previewImportBundle(bundle)).resolves.toMatchObject({
      status: "compatible",
      importMutation: "not-performed",
    })

    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
    expect(events.at(-1)).toMatchObject({
      eventType: "manual-figma-execution-path.revised",
      payload: {
        revision: 2,
        recordDigest: canonicalDigest(revised),
        membershipDigest: revised.membershipDigest,
        predecessorDigest: canonicalDigest(candidate),
        designApplicability: revised.designApplicability,
        screenStateInventory: revised.screenStateInventory,
        designRequirements: revised.designRequirements,
        designSystemTokenContract: revised.designSystemTokenContract,
        accessibilityDesignRules: revised.accessibilityDesignRules,
        responsiveMultiPlatformTargets: revised.responsiveMultiPlatformTargets,
        scopeCount: 1,
        instructionCount: 5,
        checkCount: 8,
        guideCatalogState: "candidate-complete",
        handoffCatalogState: "candidate-complete",
        returnContractState: "candidate-complete",
        reviewState: "ready-for-human-review",
        figmaConnectionState: "disconnected-only",
        figmaExecutionState: "not-executed",
        figmaWriteAuthorityState: "not-granted",
        designApprovalState: "not-established",
        designBaselineState: "not-established",
        readinessState: "not-established",
        implementationAuthorityState: "not-granted",
        writeAuthorityState: "not-granted",
        actionAuthorityState: "not-granted",
      },
    })
  })

  it("fails Manual Figma Execution Path closed on stale prerequisites, unknown Figma scopes, incomplete checks, or mismatched Requirement coverage", async () => {
    const { inventory, requirement, requirements, designSystem, accessibility, responsive } =
      await createManualFigmaExecutionPathPrerequisites()
    const staleResponsive = await manualFigmaExecutionPathInput(
      inventory, requirement, requirements, designSystem, accessibility, responsive,
      { responsiveMultiPlatformTargets: {
        recordId: responsive.id,
        revision: responsive.revision,
        digest: digest("f"),
        membershipDigest: responsive.membershipDigest,
      } },
    )
    await expect(engine.manualFigmaExecutionPath.create(staleResponsive, actorId))
      .rejects.toThrow("exact current responsiveMultiPlatformTargets")

    const unknownScope = await manualFigmaExecutionPathInput(
      inventory, requirement, requirements, designSystem, accessibility, responsive,
    )
    unknownScope.scopes[0]!.designScopeKey = "unknown-scope"
    await expect(engine.manualFigmaExecutionPath.create(unknownScope, actorId))
      .rejects.toThrow("material Figma applicability")

    const incompleteChecks = await manualFigmaExecutionPathInput(
      inventory, requirement, requirements, designSystem, accessibility, responsive,
    )
    incompleteChecks.checks.pop()
    await expect(engine.manualFigmaExecutionPath.create(incompleteChecks, actorId))
      .rejects.toThrow("every canonical check")

    const mismatchedCoverage = await manualFigmaExecutionPathInput(
      inventory, requirement, requirements, designSystem, accessibility, responsive,
    )
    mismatchedCoverage.requirementCoverage = []
    await expect(engine.manualFigmaExecutionPath.create(mismatchedCoverage, actorId))
      .rejects.toThrow("every exact current Design Requirement")

    const candidate = await engine.manualFigmaExecutionPath.create(
      await manualFigmaExecutionPathInput(
        inventory, requirement, requirements, designSystem, accessibility, responsive,
      ),
      actorId,
    )
    const applicabilityInput = designApplicabilityInput()
    applicabilityInput.scopes[0]!.designSource.modes = ["figma-design", "figma-make", "repository-native"]
    applicability = await engine.designApplicability.revise(
      applicability.id, applicability.revision, applicabilityInput, actorId,
    )
    expect(await engine.manualFigmaExecutionPath.assess(initiative.id)).toMatchObject({
      candidate: { recordId: candidate.id },
      staleBindingCount: 1,
      state: "attention-required",
    })
    expect((await engine.workspaceHealth()).issues).toContainEqual(expect.objectContaining({
      code: "manual-figma-execution-path.binding-review-required",
      severity: "warning",
    }))
  })

  it("persists, assesses, projects, and revises source-backed Figma MCP capability observations without connection, credentials, grants, or write authority", async () => {
    const { inventory, requirement, requirements, designSystem, accessibility, responsive } =
      await createManualFigmaExecutionPathPrerequisites()
    const manualPath = await engine.manualFigmaExecutionPath.create(
      await manualFigmaExecutionPathInput(
        inventory, requirement, requirements, designSystem, accessibility, responsive,
      ),
      actorId,
    )
    const candidate = await engine.figmaMcpCapabilityDiscovery.create(
      await figmaMcpCapabilityDiscoveryInput(manualPath),
      actorId,
    )

    expect(candidate).toMatchObject({
      revision: 1,
      state: "candidate",
      adapter: {
        kind: "figma-mcp",
        installationState: "observed",
        discoveryInterfaceState: "advertised",
        adapterVersionState: "known",
        protocolVersionState: "known",
      },
      tools: [
        {
          key: "read-file-metadata",
          effectClass: "figma-read",
          availabilityState: "advertised",
          permissions: [{ accessClass: "read", grantState: "not-granted" }],
        },
        {
          key: "write-design-node",
          effectClass: "figma-write",
          availabilityState: "advertised",
          permissions: [{ accessClass: "write", grantState: "not-granted" }],
        },
      ],
      figmaConnectionState: "not-connected",
      figmaRequestState: "not-sent",
      credentialState: "not-requested",
      permissionGrantState: "not-granted",
      figmaWriteAuthorityState: "not-granted",
      designApprovalState: "not-established",
      designBaselineState: "not-established",
      readinessState: "not-established",
      implementationAuthorityState: "not-granted",
      authorityBoundary: expect.stringContaining("does-not-connect-to-or-call-figma"),
    })
    expect(await engine.figmaMcpCapabilityDiscovery.assess(initiative.id)).toMatchObject({
      candidate: { recordId: candidate.id, revision: 1, digest: canonicalDigest(candidate) },
      toolCount: 2,
      advertisedToolCount: 2,
      unavailableToolCount: 0,
      unknownAvailabilityCount: 0,
      readToolCount: 1,
      writeToolCount: 1,
      unknownEffectCount: 0,
      notAssessedToolCount: 0,
      sourceRecordedToolCount: 0,
      humanReviewedToolCount: 2,
      unresolvedPermissionCount: 0,
      unresolvedLimitCount: 0,
      unresolvedVersionCount: 0,
      unresolvedOwnershipCount: 0,
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      unresolvedQuestionCount: 0,
      catalogState: "candidate-observation-complete",
      permissionModelState: "candidate-separated",
      limitCatalogState: "candidate-complete",
      versionCatalogState: "candidate-complete",
      reviewState: "ready-for-human-review",
      state: "complete-for-review",
      reasons: [],
    })
    const projection = await engine.figmaMcpCapabilityDiscovery.project(initiative.id)
    const { snapshotDigest, ...projectionBody } = projection
    expect(snapshotDigest).toBe(canonicalDigest(projectionBody))
    expect(projection).toMatchObject({
      candidate: {
        id: candidate.id,
        revision: 1,
        toolCount: 2,
        advertisedToolCount: 2,
        readToolCount: 1,
        writeToolCount: 1,
      },
      privacyBoundary: expect.stringContaining("not-tool-names-schemas-permissions-limits-versions"),
      authorityBoundary: expect.stringContaining("does-not-connect-to-or-call-figma"),
    })
    expect(JSON.stringify(projection)).not.toContain("read_file_metadata")
    expect(JSON.stringify(projection)).not.toContain("file-write")
    expect(JSON.stringify(projection)).not.toContain("1.2.3")

    const revisedInput = await figmaMcpCapabilityDiscoveryInput(manualPath, {
      limitations: [
        "No Figma request, credential access, permission grant, or compatibility test was performed",
        "The candidate observation remains subject to independent supported-host and live-adapter validation",
      ].sort((left, right) => left.localeCompare(right)),
    })
    const revised = await engine.figmaMcpCapabilityDiscovery.revise(
      candidate.id, candidate.revision, revisedInput, actorId,
    )
    expect(revised).toMatchObject({ id: candidate.id, revision: 2, predecessorDigest: canonicalDigest(candidate) })
    expect((await engine.figmaMcpCapabilityDiscovery.listHistory(candidate.id)).map((record) => record.revision))
      .toEqual([2, 1])

    const bundle = await engine.productStudio.buildPortableExport()
    expect(bundle.manifest.members.map((member) => member.path)).toEqual(expect.arrayContaining([
      `figma-mcp-capability-discoveries/${candidate.id}.json`,
      `figma-mcp-capability-discovery-history/figma-mcp-capability-discovery-${candidate.id}-r1.json`,
      `figma-mcp-capability-discovery-history/figma-mcp-capability-discovery-${candidate.id}-r2.json`,
    ]))
    await expect(engine.productStudio.previewImportBundle(bundle)).resolves.toMatchObject({
      status: "compatible",
      importMutation: "not-performed",
    })

    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
    expect(events.at(-1)).toMatchObject({
      eventType: "figma-mcp-capability-discovery.revised",
      payload: {
        revision: 2,
        recordDigest: canonicalDigest(revised),
        membershipDigest: revised.membershipDigest,
        predecessorDigest: canonicalDigest(candidate),
        designApplicability: revised.designApplicability,
        manualFigmaExecutionPath: revised.manualFigmaExecutionPath,
        adapterKey: "figma-mcp",
        adapterKind: "figma-mcp",
        transportClass: "local-process",
        installationState: "observed",
        discoveryInterfaceState: "advertised",
        adapterVersionState: "known",
        protocolVersionState: "known",
        observationState: "human-reviewed",
        toolCount: 2,
        catalogState: "candidate-observation-complete",
        permissionModelState: "candidate-separated",
        limitCatalogState: "candidate-complete",
        versionCatalogState: "candidate-complete",
        ownershipState: "assigned-candidate",
        reviewState: "ready-for-human-review",
        figmaConnectionState: "not-connected",
        figmaRequestState: "not-sent",
        credentialState: "not-requested",
        permissionGrantState: "not-granted",
        figmaWriteAuthorityState: "not-granted",
        designApprovalState: "not-established",
        designBaselineState: "not-established",
        readinessState: "not-established",
        implementationAuthorityState: "not-granted",
        writeAuthorityState: "not-granted",
        actionAuthorityState: "not-granted",
      },
    })
    expect(JSON.stringify(events.at(-1))).not.toContain("read_file_metadata")
    expect(JSON.stringify(events.at(-1))).not.toContain("file-write")
  })

  it("fails Figma MCP capability discovery closed on stale bindings, forged catalogs, mixed permissions, or changed upstream records", async () => {
    const { inventory, requirement, requirements, designSystem, accessibility, responsive } =
      await createManualFigmaExecutionPathPrerequisites()
    const manualPath = await engine.manualFigmaExecutionPath.create(
      await manualFigmaExecutionPathInput(
        inventory, requirement, requirements, designSystem, accessibility, responsive,
      ),
      actorId,
    )

    const staleManual = await figmaMcpCapabilityDiscoveryInput(manualPath)
    staleManual.manualFigmaExecutionPath.digest = digest("f")
    await expect(engine.figmaMcpCapabilityDiscovery.create(staleManual, actorId))
      .rejects.toThrow("exact current manualFigmaExecutionPath")

    const forgedCatalog = await figmaMcpCapabilityDiscoveryInput(manualPath)
    forgedCatalog.observation.catalogDigest = digest("e")
    await expect(engine.figmaMcpCapabilityDiscovery.create(forgedCatalog, actorId))
      .rejects.toThrow("catalog digest must bind")

    const mixedPermission = await figmaMcpCapabilityDiscoveryInput(manualPath)
    mixedPermission.tools[0]!.permissions = mixedPermission.tools[1]!.permissions
    await expect(engine.figmaMcpCapabilityDiscovery.create(mixedPermission, actorId))
      .rejects.toThrow("read tools cannot declare write permission")

    const candidate = await engine.figmaMcpCapabilityDiscovery.create(
      await figmaMcpCapabilityDiscoveryInput(manualPath), actorId,
    )
    const revisedManualInput = await manualFigmaExecutionPathInput(
      inventory, requirement, requirements, designSystem, accessibility, responsive,
      { limitations: [
        "Figma connection, execution, returned-design review, approval, baseline, readiness, implementation, and action authority remain not established",
        "The manual path changed after the capability observation was recorded",
      ].sort((left, right) => left.localeCompare(right)) },
    )
    await engine.manualFigmaExecutionPath.revise(manualPath.id, manualPath.revision, revisedManualInput, actorId)
    expect(await engine.figmaMcpCapabilityDiscovery.assess(initiative.id)).toMatchObject({
      candidate: { recordId: candidate.id },
      staleBindingCount: 1,
      state: "attention-required",
    })
    expect((await engine.workspaceHealth()).issues).toContainEqual(expect.objectContaining({
      code: "figma-mcp-capability-discovery.binding-review-required",
      severity: "warning",
    }))
  })
})
