import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  architectureChallengeModelInputSchema,
  architectureChallengeRequirementIds,
  authorizationModelInputSchema,
  authorizationModelRequirementIds,
  eventIntegrationModelInputSchema,
  eventIntegrationRequirementIds,
  failureRecoveryModelInputSchema,
  failureRecoveryRequirementIds,
  boundedContextModelInputSchema,
  securityPrivacyAssessmentInputSchema,
  securityPrivacyRequirementIds,
  processModelInputSchema,
  processRequirementIds,
  dataModelInputSchema,
  dataModelRequirementIds,
  businessArchitectureBaselineInputSchema,
  businessCapabilityMapInputSchema,
  businessRuleCatalogInputSchema,
  stakeholderCategoryValues,
  stakeholderModelInputSchema,
  systemSolutionArchitectureInputSchema,
  valueStreamModelInputSchema,
  type BoundedContextModelInput,
  type ArchitectureChallengeModelInput,
  type BoundedContextModel,
  type AuthorizationModel,
  type AuthorizationModelInput,
  type EventIntegrationModel,
  type EventIntegrationModelInput,
  type FailureRecoveryModel,
  type FailureRecoveryModelInput,
  type SecurityPrivacyAssessment,
  type SecurityPrivacyAssessmentInput,
  type ProcessModelInput,
  type ProcessModel,
  type DataModelInput,
  type DataModel,
  type BusinessArchitectureBaselineInput,
  type BusinessArchitectureBaseline,
  type BusinessCapabilityMap,
  type BusinessCapabilityMapInput,
  type BusinessRuleCatalogInput,
  type BusinessRuleCatalog,
  type BusinessUnderstanding,
  type BusinessUnderstandingInput,
  type ExactSourceReference,
  type Initiative,
  type OperatingModel,
  type OperatingModelInput,
  type OutcomeModelInput,
  type Product,
  type ProductExportBundle,
  type SourceRecord,
  type SourceRecordInput,
  type StakeholderModel,
  type StakeholderModelInput,
  type SystemSolutionArchitecture,
  type SystemSolutionArchitectureInput,
  type ValueStreamModelInput,
  type ValueStreamModel,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { GaepEngine } from "./engine.js"

const actorId = "product-owner"
const digest = (value: string) => `sha256:${value.repeat(64).slice(0, 64)}` as const

describe("Business understanding governance", () => {
  let workspace: string
  let engine: GaepEngine
  let product: Product
  let initiative: Initiative
  let source: SourceRecord

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "gaep-business-understanding-"))
    engine = new GaepEngine(workspace, [])
    product = await engine.createProduct({
      name: "Atlas",
      summary: "A governed Product with attributable business context.",
      problem: "Business intent, stakeholder authority, and outcome evidence can silently drift.",
      affectedUsers: "Product owners, reviewers, stewards, and affected contributors",
      desiredOutcome: "Business understanding stays exact, attributable, and independently reviewable.",
      successSignals: ["Candidate context remains source bound without synthesizing approval"],
      firstWorkflow: "Record business understanding, stakeholder roles, and measurable outcomes.",
      exclusions: ["Authority appointment", "Readiness approval", "Release authorization"],
      profile: "software",
    }, actorId)
    initiative = await engine.createInitiative({
      title: "Govern business understanding",
      outcome: "The P1 candidate context remains attributable and measurable.",
      scope: ["Business understanding", "Stakeholder roles", "Outcome measures"],
      exclusions: ["Approval substitution"],
    }, actorId)
    source = await engine.sourceGovernance.createSource(sourceInput(), actorId)
  })

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true })
  })

  function sourceInput(overrides: Partial<SourceRecordInput> = {}): SourceRecordInput {
    return {
      initiativeId: initiative.id,
      sourceType: "stakeholder-note",
      title: "Reviewed stakeholder discovery",
      description: "The exact reviewed discovery input for the bounded business-understanding workflow.",
      locator: { kind: "logical", value: "discovery.reviewed" },
      revisionIdentity: { kind: "resource-revision", value: "DISCOVERY-001@1" },
      contentDigest: digest("a"),
      digestScope: "Canonical UTF-8 discovery content",
      owner: { kind: "human", id: actorId },
      semanticAuthority: {
        standing: "advisory",
        domain: "Initiative business context",
        scope: ["P1 candidate understanding"],
        basis: "The accountable Product owner reviewed this exact discovery input as advisory evidence.",
        declaredBy: { kind: "human", id: actorId },
      },
      knowledgeDisposition: "confirmed",
      trust: { sourceAuthenticity: "verified", contentIntegrity: "verified" },
      informationClassification: "internal",
      rights: { status: "verified", basis: "Internal Product analysis is recorded for this source." },
      freshness: {
        status: "fresh",
        assessedAt: "2026-07-25T00:00:00.000Z",
        basis: "The accountable owner reviewed this exact revision.",
        validUntil: "2026-08-25T00:00:00.000Z",
      },
      availability: { status: "available", basis: "The logical discovery source is available." },
      limitations: ["The record does not establish stakeholder authority or Product approval."],
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
      productRevision: product.revision ?? 1,
      productDigest: canonicalDigest(product),
      initiativeRevision: initiative.revision ?? 1,
      initiativeDigest: canonicalDigest(initiative),
    }
  }

  function attributed(text: string) {
    return { text, disposition: "confirmed" as const, sources: [reference()] }
  }

  function businessInput(overrides: Partial<BusinessUnderstandingInput> = {}): BusinessUnderstandingInput {
    return {
      initiativeId: initiative.id,
      context: context(),
      informationClassification: "internal",
      problem: attributed("Teams cannot independently reconstruct why this bounded Initiative should exist."),
      opportunity: attributed("Exact governed context can reduce re-explanation while preserving human authority."),
      currentState: attributed("Business understanding is distributed across sources and informal participant knowledge."),
      targetState: attributed("Candidate business context is versioned, attributable, measurable, and reviewable."),
      scope: {
        included: ["Business context", "Outcome measures", "Stakeholder roles"],
        excluded: ["Authority appointment", "Release authorization"],
        boundaries: ["Candidate records only", "No implicit approval"],
      },
      objectives: [{
        id: "reduce-context-loss",
        ...attributed("Reduce material context loss across governed Product handoffs."),
      }],
      constraints: [{
        id: "preserve-human-authority",
        ...attributed("Preserve human decision, approval, and authorization boundaries."),
      }],
      assumptions: [{
        id: "reviewers-can-inspect",
        statement: attributed("Qualified reviewers can inspect portable metadata without receiving source content."),
        status: "supported",
        reviewTrigger: "Reassess when the projection or disclosure policy changes.",
      }],
      unresolvedQuestions: [],
      glossary: [{
        term: "Business Understanding",
        definition: attributed("A versioned candidate context record that remains separate from decisions and approval."),
      }],
      limitations: ["No realistic Product participant study is represented."],
      ...overrides,
    }
  }

  function businessReference(record: BusinessUnderstanding) {
    return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
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

  function stakeholderInput(
    business: BusinessUnderstanding,
    overrides: Partial<StakeholderModelInput> = {},
  ): StakeholderModelInput {
    return {
      initiativeId: initiative.id,
      context: context(),
      informationClassification: "internal",
      businessUnderstanding: businessReference(business),
      stakeholders: [{
        key: "primary-user",
        label: "Primary governed workflow user",
        category: "user",
        job: attributed("Prepare and challenge the bounded context needed for an accountable engineering decision."),
        concerns: ["Incorrect context", "Unnecessary ceremony"],
        successSignals: ["Can explain current state and unresolved matters"],
        assignment: {
          status: "confirmed",
          subject: { kind: "human", id: "pilot-user" },
          basis: "The named pilot participant confirmed this bounded workflow assignment.",
          sources: [reference()],
          confirmedBy: { kind: "human", id: actorId },
          confirmedAt: "2026-07-25T01:00:00.000Z",
        },
        authority: {
          standing: "none",
          domains: [],
          scope: [],
          basis: "Workflow participation does not grant decision, approval, or action authority.",
          sources: [reference()],
        },
        competence: {
          status: "verified",
          basis: "The participant completed the bounded workflow rehearsal.",
          sources: [reference()],
          verifiedBy: { kind: "human", id: actorId },
          verifiedAt: "2026-07-25T01:00:00.000Z",
        },
      }],
      coverage: stakeholderCategoryValues.map((category) => ({
        category,
        status: category === "user" ? "represented" as const : "not-applicable" as const,
        rationale: category === "user"
          ? "The bounded pilot records one primary workflow user."
          : `The bounded local contract test does not require a ${category} participant.`,
        sources: [reference()],
      })),
      responsibilities: [{
        id: "prepare-context",
        subject: "Prepare candidate business context",
        stakeholderKey: "primary-user",
        relationship: "responsible",
        basis: "The participant performs preparation without acquiring approval authority.",
        sources: [reference()],
      }],
      separationOfDuty: [],
      contestability: {
        path: "Challenge incorrect context through an attributable amendment request.",
        ownerStakeholderKey: "primary-user",
        escalation: "Escalate unresolved authority or evidence disputes to the separately assigned decision owner.",
        sources: [reference()],
      },
      limitations: ["The local fixture does not establish organization-wide role applicability."],
      ...overrides,
    }
  }

  function stakeholderReference(record: StakeholderModel) {
    return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
  }

  function outcomeInput(
    business: BusinessUnderstanding,
    stakeholder: StakeholderModel,
    overrides: Partial<OutcomeModelInput> = {},
  ): OutcomeModelInput {
    const measure = (
      key: "MET-BURDEN-001" | "MET-VALUE-001",
      kind: "countermetric" | "metric",
      category: "burden" | "user-value-flow",
      name: string,
    ) => ({
      key,
      name,
      outcomeIds: ["trusted-context"],
      category,
      kind,
      definition: `${name} is measured for the bounded workflow using the declared evidence method.`,
      direction: kind === "countermetric" ? "maintain" as const : "decrease" as const,
      unit: "Participant minutes",
      baseline: {
        status: "observed" as const,
        value: kind === "countermetric" ? "15 minutes" : "90 minutes",
        observedAt: "2026-07-25T02:00:00.000Z",
        sources: [reference()],
      },
      target: {
        status: "candidate" as const,
        statement: kind === "countermetric"
          ? "Do not increase review burden above the observed baseline."
          : "Reduce reconstruction time while preserving decision quality.",
      },
      collection: {
        ownerStakeholderKey: "primary-user",
        method: "Record bounded participant time and independently review the resulting evidence.",
        cadence: "Each selected pilot workflow",
        qualityConditions: ["Exclude paused waiting time", "Record missing observations"],
      },
      dataUse: {
        purpose: "Evaluate the bounded workflow without ranking individual worker productivity.",
        classification: "internal" as const,
        aggregation: "Aggregate by workflow and risk class.",
        retention: "Retain only for the declared pilot review period.",
        prohibitedUses: ["Individual productivity ranking", "Undisclosed workforce surveillance"],
      },
      acceptanceSignal: kind === "countermetric"
        ? "Review burden does not materially increase without an explicit justified tradeoff."
        : "Qualified participants reconstruct decision-ready context with less effort.",
      sources: [reference()],
    })
    return {
      initiativeId: initiative.id,
      context: context(),
      informationClassification: "internal",
      businessUnderstanding: businessReference(business),
      stakeholderModel: stakeholderReference(stakeholder),
      primaryHypothesis: attributed(
        "The governed workflow should reduce context reconstruction effort without increasing burden or downstream harm.",
      ),
      outcomes: [{
        id: "trusted-context",
        level: "decision",
        statement: attributed("Reviewers can reconstruct a bounded decision-ready context from permitted evidence."),
        beneficiaryStakeholderKeys: ["primary-user"],
        confounders: ["Facilitator expertise", "Initiative complexity"],
      }],
      measures: [
        measure("MET-BURDEN-001", "countermetric", "burden", "Review burden"),
        measure("MET-VALUE-001", "metric", "user-value-flow", "Context reconstruction time"),
      ],
      countermetricDisposition: {
        status: "included",
        rationale: "Review burden is a material countermetric for the governed workflow.",
        sources: [reference()],
      },
      burdenDisposition: {
        status: "included",
        rationale: "Governance burden is measured explicitly rather than presented as zero-cost.",
        sources: [reference()],
      },
      unresolvedQuestions: [],
      limitations: ["The candidate measures do not establish causal Product outcomes."],
      ...overrides,
    }
  }

  async function createCompleteModel() {
    const business = await engine.businessUnderstanding.createBusinessUnderstanding(businessInput(), actorId)
    const stakeholder = await engine.businessUnderstanding.createStakeholderModel(
      stakeholderInput(business),
      actorId,
    )
    const outcome = await engine.businessUnderstanding.createOutcomeModel(
      outcomeInput(business, stakeholder),
      actorId,
    )
    return { business, stakeholder, outcome }
  }

  function capabilityMapInput(
    business: BusinessUnderstanding,
    stakeholder: StakeholderModel,
    outcome: Awaited<ReturnType<typeof engine.businessUnderstanding.createOutcomeModel>>,
    overrides: Partial<BusinessCapabilityMapInput> = {},
  ): BusinessCapabilityMapInput {
    return {
      initiativeId: initiative.id,
      context: context(),
      informationClassification: "internal",
      businessUnderstanding: businessReference(business),
      stakeholderModel: stakeholderReference(stakeholder),
      outcomeModel: { recordId: outcome.id, revision: outcome.revision, digest: canonicalDigest(outcome) },
      capabilities: [{
        key: "governed-context",
        name: "Governed context continuity",
        purpose: "Preserve exact attributable Product context across bounded engineering handoffs.",
        category: "differentiating",
        placement: "gaep-native-authority",
        scope: {
          included: ["Candidate context governance", "Exact evidence binding"],
          excluded: ["Approval substitution", "Execution authorization"],
          boundaries: ["Portable metadata only", "Product Initiative scope"],
        },
        ownerStakeholderKey: "primary-user",
        accountableStakeholderKeys: ["primary-user"],
        participatingStakeholderKeys: ["primary-user"],
        objectiveIds: ["reduce-context-loss"],
        outcomeIds: ["trusted-context"],
        dependencyKeys: [],
        currentMaturity: {
          level: "repeatable",
          basis: "The bounded workflow has a repeatable governed-record implementation and test receipt.",
          sources: [reference()],
        },
        targetMaturity: {
          level: "managed",
          basis: "The candidate target is evidence-backed management across supported Product workflows.",
          sources: [reference()],
        },
        performanceEvidence: {
          state: "observed",
          statement: "The bounded contract workflow preserved exact upstream and Source identities.",
          sources: [reference()],
        },
        gaps: [],
        priority: {
          status: "candidate",
          tier: "high",
          rationale: "Context continuity is a candidate high priority because downstream governance depends on it.",
          sources: [reference()],
        },
        dependencies: ["Governed Source inventory", "Versioned Product identity"],
        burden: "Maintaining exact bindings adds explicit review and superseding-revision work.",
        risk: "Overstated maturity or priority could be mistaken for an approval or implementation commitment.",
        exitPath: "Retire the candidate capability record through a superseding revision while preserving history.",
        lifecycle: "candidate",
        sources: [reference()],
      }],
      limitations: ["No realistic Product Owner acceptance or organization-wide capability baseline is represented."],
      ...overrides,
    }
  }

  function valueStreamInput(
    business: BusinessUnderstanding,
    stakeholder: StakeholderModel,
    outcome: Awaited<ReturnType<typeof engine.businessUnderstanding.createOutcomeModel>>,
    capabilityMap: BusinessCapabilityMap,
    overrides: Partial<ValueStreamModelInput> = {},
  ): ValueStreamModelInput {
    return {
      initiativeId: initiative.id,
      context: context(),
      informationClassification: "internal",
      businessUnderstanding: businessReference(business),
      stakeholderModel: stakeholderReference(stakeholder),
      outcomeModel: { recordId: outcome.id, revision: outcome.revision, digest: canonicalDigest(outcome) },
      capabilityMap: {
        recordId: capabilityMap.id,
        revision: capabilityMap.revision,
        digest: canonicalDigest(capabilityMap),
      },
      valueStreams: [{
        key: "governed-delivery",
        name: "Governed context delivery",
        purpose: "Deliver attributable Product context to a stakeholder without losing exact upstream evidence.",
        placement: "gaep-native-authority",
        trigger: "A bounded Product Initiative requires governed context before downstream engineering work begins.",
        valueProposition: "The receiving stakeholder obtains exact portable context with visible limitations and no synthesized authority.",
        ownerStakeholderKey: "primary-user",
        beneficiaryStakeholderKeys: ["primary-user"],
        participatingStakeholderKeys: ["primary-user"],
        objectiveIds: ["reduce-context-loss"],
        outcomeIds: ["trusted-context"],
        capabilityKeys: ["governed-context"],
        dependencyKeys: [],
        stages: [{
          key: "preserve-context",
          sequence: 1,
          name: "Preserve governed context",
          purpose: "Bind the current business evidence and capability identity into portable candidate context.",
          entryCriteria: ["Exact governed upstream records are available"],
          exitCriteria: ["Portable candidate context retains every exact governed binding"],
          capabilityKeys: ["governed-context"],
          participatingStakeholderKeys: ["primary-user"],
          outcomeIds: ["trusted-context"],
          inputs: ["Exact upstream business records"],
          outputs: ["Bounded portable context record"],
          flowEvidence: {
            state: "observed",
            statement: "The contract and engine tests observe exact binding through the bounded value-delivery stage.",
            sources: [reference()],
          },
          sources: [reference()],
        }],
        bottlenecks: [],
        externalDependencies: ["Governed Source inventory"],
        burden: "Exact binding requires explicit superseding revisions whenever upstream business truth changes.",
        risk: "A candidate flow description could be mistaken for an approved operating process or delivery commitment.",
        exitPath: "Retire the candidate stream through a superseding revision while preserving immutable history.",
        lifecycle: "candidate",
        sources: [reference()],
      }],
      limitations: ["No realistic Product Owner acceptance or organization-wide value-stream baseline is represented."],
      ...overrides,
    }
  }

  function operatingModelInput(
    business: BusinessUnderstanding,
    stakeholder: StakeholderModel,
    outcome: Awaited<ReturnType<typeof engine.businessUnderstanding.createOutcomeModel>>,
    capabilityMap: BusinessCapabilityMap,
    valueStreamModel: ValueStreamModel,
    overrides: Partial<OperatingModelInput> = {},
  ): OperatingModelInput {
    const authority = {
      state: "candidate" as const,
      basis: "The bounded model records a candidate authority shape for review and does not make an appointment.",
      sources: [reference()],
    }
    const capacity = {
      state: "candidate-sufficient" as const,
      fundingState: "candidate" as const,
      statement: "The bounded rehearsal records candidate capacity and funding evidence without creating a commitment.",
      sources: [reference()],
    }
    return {
      initiativeId: initiative.id,
      context: context(),
      informationClassification: "internal",
      businessUnderstanding: businessReference(business),
      stakeholderModel: stakeholderReference(stakeholder),
      outcomeModel: { recordId: outcome.id, revision: outcome.revision, digest: canonicalDigest(outcome) },
      capabilityMap: { recordId: capabilityMap.id, revision: capabilityMap.revision, digest: canonicalDigest(capabilityMap) },
      valueStreamModel: { recordId: valueStreamModel.id, revision: valueStreamModel.revision, digest: canonicalDigest(valueStreamModel) },
      roles: [{
        key: "gaep-steward",
        name: "Candidate GAEP specification steward",
        governanceSystem: "gaep-governance",
        accountableScope: "Maintain candidate semantic coherence without absorbing Initiative decision rights.",
        stakeholderKeys: ["primary-user"],
        capabilityKeys: ["governed-context"],
        valueStreamKeys: ["governed-delivery"],
        mustNotAssume: ["Initiative outcome authority"],
        appointingAuthority: authority,
        competenceExpectations: ["Can review governed semantic and compatibility evidence"],
        delegationRule: "Delegation requires a separately governed candidate record with exact scope and validity.",
        conflictRule: "Material conflicts and recusals remain visible and escalate without erasing dissent.",
        successionOrBackup: "A candidate backup must be separately reviewed before operational appointment.",
        validityRule: "Any future authority would require an exact time-valid assignment outside this candidate model.",
        capacity,
        sources: [reference()],
      }, {
        key: "initiative-owner",
        name: "Candidate Initiative owner",
        governanceSystem: "initiative-governance",
        accountableScope: "Own the candidate Initiative outcome without changing GAEP constitutional or Core semantics.",
        stakeholderKeys: ["primary-user"],
        capabilityKeys: ["governed-context"],
        valueStreamKeys: ["governed-delivery"],
        mustNotAssume: ["GAEP constitutional amendment authority"],
        appointingAuthority: authority,
        competenceExpectations: ["Can review bounded Product outcome and applicability evidence"],
        delegationRule: "Delegation requires separately recorded scope, competence, validity, and accountable-human trace.",
        conflictRule: "Conflicts of interest require visible recusal and escalation through the candidate appeal path.",
        successionOrBackup: "A candidate backup and handoff path must preserve exact unresolved matters and evidence.",
        validityRule: "Any future authority would expire or be replaced only through a governed assignment record.",
        capacity,
        sources: [reference()],
      }],
      decisionRights: [{
        key: "govern-gaep-semantics",
        subject: "Review candidate GAEP semantic coherence and compatibility without selecting Initiative outcomes.",
        governanceSystem: "gaep-governance",
        accountableRoleKey: "gaep-steward",
        consultedRoleKeys: ["initiative-owner"],
        valueStreamKeys: ["governed-delivery"],
        evidenceRequirements: ["Exact compatibility and affected-scope evidence"],
        separateApprovalConcern: "A candidate review does not approve a Core change, baseline, release, or implementation.",
        authority,
        sources: [reference()],
      }, {
        key: "govern-initiative-outcome",
        subject: "Review the bounded Initiative outcome and value flow without changing GAEP shared semantics.",
        governanceSystem: "initiative-governance",
        accountableRoleKey: "initiative-owner",
        consultedRoleKeys: ["gaep-steward"],
        valueStreamKeys: ["governed-delivery"],
        evidenceRequirements: ["Exact outcome, stakeholder, capability, and value-stream evidence"],
        separateApprovalConcern: "A candidate recommendation does not grant approval, funding, baseline, or effect authority.",
        authority,
        sources: [reference()],
      }],
      forums: [{
        key: "bounded-review",
        name: "Candidate bounded operating review",
        purpose: "Review the two governance systems and preserve their separate candidate decision boundaries.",
        participatingRoleKeys: ["gaep-steward", "initiative-owner"],
        decisionRightKeys: ["govern-gaep-semantics", "govern-initiative-outcome"],
        boundaries: ["No baseline, appointment, funding, release, or execution authority"],
        sources: [reference()],
      }],
      cycles: [{
        key: "candidate-learning",
        name: "Candidate operating learning cycle",
        ownerRoleKey: "initiative-owner",
        steps: ["Collect exact bounded evidence", "Review outcomes, burden, dissent, and limitations"],
        escalationRoleKey: "gaep-steward",
        sources: [reference()],
      }],
      supportModel: {
        scope: ["Bounded workflow orientation", "Governed-record interpretation"],
        knownLimitations: ["No supported release or operational service commitment exists"],
        compatibilityPolicy: "Candidate compatibility guidance must name exact versions, limitations, and unresolved evidence.",
        deprecationPolicy: "Candidate deprecation guidance preserves fallback, history, notice, and an explicit retirement review.",
        incidentPath: "Candidate incidents retain evidence and route to a separately authorized operational or security authority.",
        appealPath: "Affected participants can report harmful, incorrect, or unauthorized use for attributable review.",
        escalationPath: "Unavailable or conflicted reviewers produce an explicit pause or narrowed result instead of silent delegation.",
        fallback: "When support or realization is unavailable, stop the bounded workflow and preserve portable evidence.",
        responseTarget: "Candidate response targets remain proportional to consequence and require later funded approval.",
        laborMeasurement: "All rehearsal, facilitation, support, and review effort is recorded as candidate operating cost.",
        capacity,
        sources: [reference()],
      },
      emergencyActionModel: {
        ownerRoleKey: "initiative-owner",
        scopeRule: "Any future emergency action must be narrowly scoped to the evidenced urgent condition.",
        reasonRule: "The material safety, security, or operational reason must be recorded before action when feasible.",
        evidenceRule: "Evidence, dissent, time pressure, and the original conflict remain preserved through escalation.",
        recoveryRule: "A bounded recovery and safe-stop path must be identified without inferring successful restoration.",
        expiryRule: "Any future emergency authority must have an exact expiry and cannot silently become permanent.",
        retrospectiveReviewRule: "A separately authorized retrospective review must evaluate the action, recovery, and reopening triggers.",
        authority,
        sources: [reference()],
      },
      limitations: ["No real appointment, funding commitment, service level, baseline, readiness, or execution authority is represented"],
      ...overrides,
    }
  }

  function businessRuleCatalogInput(
    business: BusinessUnderstanding,
    stakeholder: StakeholderModel,
    outcome: Awaited<ReturnType<typeof engine.businessUnderstanding.createOutcomeModel>>,
    capabilityMap: BusinessCapabilityMap,
    valueStreamModel: ValueStreamModel,
    operatingModel: OperatingModel,
    overrides: Partial<BusinessRuleCatalogInput> = {},
  ): BusinessRuleCatalogInput {
    const candidateAuthority = {
      state: "candidate" as const,
      basis: "The catalog identifies a candidate accountable path for review but does not grant exception or enforcement authority.",
      sources: [reference()],
    }
    return {
      initiativeId: initiative.id,
      context: context(),
      informationClassification: "internal",
      businessUnderstanding: businessReference(business),
      stakeholderModel: stakeholderReference(stakeholder),
      outcomeModel: { recordId: outcome.id, revision: outcome.revision, digest: canonicalDigest(outcome) },
      capabilityMap: { recordId: capabilityMap.id, revision: capabilityMap.revision, digest: canonicalDigest(capabilityMap) },
      valueStreamModel: { recordId: valueStreamModel.id, revision: valueStreamModel.revision, digest: canonicalDigest(valueStreamModel) },
      operatingModel: { recordId: operatingModel.id, revision: operatingModel.revision, digest: canonicalDigest(operatingModel) },
      rules: [{
        key: "govern-context-eligibility",
        name: "Governed context eligibility",
        kind: "eligibility",
        statement: "Candidate context is eligible for downstream review only when every exact upstream business binding is current.",
        applicability: "Applies to the bounded Initiative whenever governed context is prepared for a downstream Product or engineering review.",
        condition: "Every recorded Product, Initiative, Source, business, capability, value-stream, and operating-model reference matches its exact current revision and digest.",
        outcome: "Produce an evidence-backed candidate eligibility result; otherwise return indeterminate and preserve every unresolved or stale binding.",
        rationale: "Fail-closed candidate eligibility prevents incomplete or stale context from being mistaken for an approved rule, baseline, or authorization.",
        ownerRoleKey: "initiative-owner",
        capabilityKeys: ["governed-context"],
        valueStreamKeys: ["governed-delivery"],
        decisionRightKeys: ["govern-initiative-outcome"],
        enforcementTargetKeys: ["context-entry"],
        exceptionBehavior: "candidate-exception-path",
        exceptionKeys: ["bounded-context-exception"],
        examples: ["A stale Operating Model reference produces indeterminate and blocks candidate eligibility"],
        unknownInputBehavior: "indeterminate",
        sources: [reference()],
      }],
      enforcementTargets: [{
        key: "context-entry",
        name: "Governed context entry",
        kind: "human-workflow",
        target: "The candidate transition from business architecture context capture into downstream Product review.",
        responsibleRoleKey: "initiative-owner",
        mechanism: "A future implementation may evaluate exact recorded bindings and surface a candidate result for accountable human review.",
        failureBehavior: "Missing, conflicting, stale, unsupported, or unavailable inputs return indeterminate without silently permitting progression.",
        assignment: candidateAuthority,
        verificationState: "candidate-defined",
        verificationCriteria: ["Hostile stale-binding and unknown-input cases fail closed without granting action authority"],
        sources: [reference()],
      }],
      exceptions: [{
        key: "bounded-context-exception",
        name: "Bounded governed-context exception candidate",
        ruleKeys: ["govern-context-eligibility"],
        scope: "One exact Initiative revision and one named downstream review scope only.",
        rationaleRequirements: ["Explain why normal rule satisfaction is unavailable and why the bounded review remains necessary"],
        approvingRoleKey: "initiative-owner",
        decisionRightKey: "govern-initiative-outcome",
        compensatingControls: ["Preserve the unresolved binding and require an explicit downstream hold"],
        validityRule: "Any future approved exception must bind exact scope, evidence, start, expiry, and conditions.",
        revocationRule: "Condition breach, source revision, or scope change invalidates the candidate exception path.",
        closureRule: "Closure requires separately governed disposition and evidence; elapsed time is not closure.",
        authority: candidateAuthority,
        sources: [reference()],
      }],
      conflictModel: {
        defaultOutcome: "indeterminate",
        precedenceRule: "Rule precedence must be explicit, source-backed, and unable to weaken a higher applicable obligation by local ordering.",
        conflictRule: "Conflicting rule outcomes remain visible and route to the candidate accountable role without selecting the more permissive result.",
        unresolvedConflictRule: "An unresolved conflict produces indeterminate and cannot be consumed as approval, exception, enforcement, or authorization.",
        ownerRoleKey: "initiative-owner",
        sources: [reference()],
      },
      limitations: ["No policy evaluation, exception grant, deployed enforcement, approved baseline, readiness, or action authority is represented"],
      ...overrides,
    }
  }

  function businessArchitectureBaselineInput(
    business: BusinessUnderstanding,
    stakeholder: StakeholderModel,
    outcome: Awaited<ReturnType<typeof engine.businessUnderstanding.createOutcomeModel>>,
    capabilityMap: BusinessCapabilityMap,
    valueStreamModel: ValueStreamModel,
    operatingModel: OperatingModel,
    businessRuleCatalog: BusinessRuleCatalog,
    overrides: Partial<BusinessArchitectureBaselineInput> = {},
  ): BusinessArchitectureBaselineInput {
    const coverage = [
      ["business-rule", "govern-context-eligibility"],
      ["capability", "governed-context"],
      ["decision-right", "govern-gaep-semantics"],
      ["decision-right", "govern-initiative-outcome"],
      ["enforcement-target", "context-entry"],
      ["exception", "bounded-context-exception"],
      ["operating-role", "gaep-steward"],
      ["operating-role", "initiative-owner"],
      ["value-stream", "governed-delivery"],
    ] as const
    const candidateCheck = (topic: BusinessArchitectureBaselineInput["consistencyChecks"][number]["topic"]) => ({
      topic,
      state: "candidate-satisfied" as const,
      basis: "The exact bound candidate records provide a coherent attributable trace for accountable review without approval.",
      accountableRoleKey: "initiative-owner",
      sources: [reference()],
    })
    return {
      initiativeId: initiative.id,
      context: context(),
      informationClassification: "internal",
      title: "Candidate governed context Business Architecture Baseline",
      purpose: "Integrate the exact candidate capability, value-stream, operating-model, and Business Rule records for accountable review.",
      businessUnderstanding: businessReference(business),
      stakeholderModel: stakeholderReference(stakeholder),
      outcomeModel: { recordId: outcome.id, revision: outcome.revision, digest: canonicalDigest(outcome) },
      capabilityMap: { recordId: capabilityMap.id, revision: capabilityMap.revision, digest: canonicalDigest(capabilityMap) },
      valueStreamModel: { recordId: valueStreamModel.id, revision: valueStreamModel.revision, digest: canonicalDigest(valueStreamModel) },
      operatingModel: { recordId: operatingModel.id, revision: operatingModel.revision, digest: canonicalDigest(operatingModel) },
      businessRuleCatalog: {
        recordId: businessRuleCatalog.id,
        revision: businessRuleCatalog.revision,
        digest: canonicalDigest(businessRuleCatalog),
      },
      scope: {
        included: ["Candidate Business Architecture compound snapshot"],
        excluded: ["Implementation, release, and operational execution"],
        boundaries: ["No approval, baseline designation, readiness, exception, enforcement, or action authority"],
      },
      coverage: coverage.map(([elementKind, elementKey]) => ({
        elementKind,
        elementKey,
        disposition: "included-candidate" as const,
        rationale: "This exact candidate element is included so the compound architecture review does not silently omit governed scope.",
        sources: [reference()],
      })),
      integrationClaims: [{
        key: "governed-context-flow",
        statement: "The governed-context capability, value stream, accountable roles, decision right, and eligibility rule form one candidate cross-model review path.",
        capabilityKeys: ["governed-context"],
        valueStreamKeys: ["governed-delivery"],
        roleKeys: ["gaep-steward", "initiative-owner"],
        decisionRightKeys: ["govern-initiative-outcome"],
        ruleKeys: ["govern-context-eligibility"],
        sources: [reference()],
      }],
      consistencyChecks: [
        candidateCheck("capability-role-accountability"),
        candidateCheck("capability-value-stream-trace"),
        candidateCheck("exception-decision-authority"),
        candidateCheck("outcome-capability-trace"),
        candidateCheck("rule-capability-value-trace"),
        candidateCheck("source-freshness"),
      ],
      governance: {
        ownerRoleKey: "initiative-owner",
        reviewerRoleKeys: ["gaep-steward", "initiative-owner"],
        decisionRightKey: "govern-initiative-outcome",
        approvalState: "not-granted",
        basis: "The candidate owner and reviewers prepare an attributable review; this record cannot grant baseline approval.",
        sources: [reference()],
      },
      changeControl: {
        accountableRoleKey: "initiative-owner",
        decisionRightKey: "govern-initiative-outcome",
        triggers: ["Bound architecture member revision changes", "Candidate scope or coverage changes"],
        requiredReviews: ["authority-review", "business-review", "impact-review", "source-review"],
        dispositionRule: "Any trigger requires a superseding candidate revision and separate accountable review without silent baseline promotion.",
        sources: [reference()],
      },
      limitations: ["No realistic Product Owner acceptance or approved Business Architecture Baseline is represented"],
      ...overrides,
    }
  }

  function systemSolutionArchitectureInput(
    baseline: Awaited<ReturnType<typeof engine.businessArchitectureBaseline.create>>,
    overrides: Partial<SystemSolutionArchitectureInput> = {},
  ): SystemSolutionArchitectureInput {
    return {
      initiativeId: initiative.id,
      context: context(),
      informationClassification: "internal",
      title: "Candidate governed System/Solution Architecture",
      purpose: "Describe the candidate system boundary, exact interactions, quality attributes, decisions, and conformance expectations for accountable review.",
      businessArchitectureBaseline: {
        recordId: baseline.id,
        revision: baseline.revision,
        digest: canonicalDigest(baseline),
      },
      scope: {
        included: ["Governed engine, Product Studio host, and workspace store boundary"],
        excluded: ["Provider execution, release topology, and production deployment"],
        boundaries: ["Candidate design only with no approval, baseline, readiness, conformance, technology mandate, or action authority"],
      },
      concerns: [{
        key: "governed-system-boundary",
        category: "topology",
        statement: "The native hosts must share one governed engine and workspace-store authority boundary without inventing host-local Product semantics.",
        stakeholderRoleKeys: ["gaep-steward", "initiative-owner"],
        affectedBusinessElementKeys: ["governed-context"],
        priority: "high",
        sources: [reference()],
      }],
      elements: [{
        key: "gaep-engine",
        kind: "logical-component",
        name: "GAEP governed engine",
        responsibility: "Own contract validation, immutable versioning, audit events, assessments, and privacy-safe projections for the bounded Product workflow.",
        ownerRoleKey: "gaep-steward",
        boundaries: ["No host-local semantic authority", "No provider execution authority"],
        technology: {
          disposition: "constrained",
          value: "shared-local-engine",
          rationale: "The current Product contract requires all native hosts to delegate governed Product semantics to one shared local engine boundary.",
        },
        sources: [reference()],
      }, {
        key: "product-studio-host",
        kind: "deployable-unit",
        name: "Native Product Studio host",
        responsibility: "Collect explicit human inputs and render privacy-safe engine projections without synthesizing Product decisions or approval authority.",
        ownerRoleKey: "initiative-owner",
        boundaries: ["No direct governed-store writes", "No implicit approval or readiness transition"],
        technology: {
          disposition: "candidate",
          value: "native-host-adapter",
          rationale: "Each supported IDE requires a candidate native adapter while the shared engine retains the authoritative Product behavior.",
        },
        sources: [reference()],
      }, {
        key: "workspace-store",
        kind: "data-asset",
        name: "Governed workspace store",
        responsibility: "Persist versioned Product-domain records, exact immutable history, transactions, and audit-chain evidence inside the selected workspace.",
        ownerRoleKey: "gaep-steward",
        boundaries: ["Repository-relative governed state", "Secret-shaped values prohibited"],
        technology: {
          disposition: "constrained",
          value: "gaep-json-store",
          rationale: "The existing governed repository format is the exact compatibility constraint for this candidate architecture revision.",
        },
        sources: [reference()],
      }],
      relations: [{
        key: "engine-writes-store",
        kind: "writes",
        fromElementKey: "gaep-engine",
        toElementKey: "workspace-store",
        interactionStyle: "The engine performs lock-protected mutation commits through one repository transaction boundary.",
        contract: "Every mutation validates the exact contract, writes current and immutable-history records, and appends an attributable audit event.",
        failureBehavior: "Validation, binding, history, lock, or audit failure aborts the candidate mutation without a partial authoritative write.",
        sources: [reference()],
      }, {
        key: "host-calls-engine",
        kind: "calls",
        fromElementKey: "product-studio-host",
        toElementKey: "gaep-engine",
        interactionStyle: "The native host uses a strict versioned request and privacy-safe response contract over a bounded local process channel.",
        contract: "Unexpected fields, protocol downgrade, substituted bindings, digest drift, and private response fields fail closed.",
        failureBehavior: "The host reports a bounded non-authorizing error and exposes no private engine response details.",
        sources: [reference()],
      }],
      qualityAttributes: [{
        key: "audit-integrity",
        attribute: "integrity",
        source: "An accountable reviewer or deterministic workspace-health gate",
        stimulus: "A governed System/Solution Architecture mutation or read is requested while the audit chain is missing or invalid.",
        environment: "The selected local workspace contains initialized GAEP state and the current Product Initiative.",
        artifactElementKeys: ["gaep-engine", "workspace-store"],
        response: "The engine refuses semantic mutation or projection and returns a bounded integrity failure without repairing authority-bearing state automatically.",
        measure: "Zero governed mutations or trusted semantic projections are produced after audit-chain verification fails.",
        target: "Every hostile audit-chain fixture fails closed before any System/Solution Architecture commit or authoritative projection.",
        state: "candidate",
        verificationApproach: "Exercise deterministic corrupted-chain fixtures and verify no current, history, transaction, or audit record is partially created.",
        sources: [reference()],
      }, {
        key: "host-response-integrity",
        attribute: "security",
        source: "A native Product Studio user reading one exact Initiative architecture projection",
        stimulus: "A host receives a response with a substituted Product binding, changed snapshot digest, or undeclared private field.",
        environment: "A supported local host invokes the strict protocol-v2 System/Solution Architecture snapshot method.",
        artifactElementKeys: ["gaep-engine", "product-studio-host"],
        response: "The host rejects the response and exposes only a bounded non-authorizing error without private payload details.",
        measure: "All substituted-binding, digest-drift, and private-field fixtures are rejected across each implemented host parser.",
        target: "Three hostile response classes fail closed in every supported native host implementation.",
        state: "candidate",
        verificationApproach: "Run deterministic host-client fixtures and verify exact response-shape, digest, binding, and privacy checks.",
        sources: [reference()],
      }],
      decisions: [{
        key: "shared-engine-boundary",
        title: "Candidate shared governed engine boundary",
        concernKeys: ["governed-system-boundary"],
        disposition: "candidate",
        options: [{
          key: "host-local-semantics",
          statement: "Each native host implements and persists its own Product semantics independently.",
          benefits: ["Host-specific implementation freedom"],
          tradeoffs: ["Four semantic implementations can drift and require separate authority-bearing migration paths"],
          risks: ["Host-specific behavior may silently contradict the shared Product contract"],
          sources: [reference()],
        }, {
          key: "shared-governed-engine",
          statement: "Every native host delegates Product semantics and governed persistence to one shared engine contract.",
          benefits: ["Exact cross-host semantic parity", "One attributable governed-store boundary"],
          tradeoffs: ["Host adapters depend on strict shared protocol compatibility"],
          risks: ["A shared-engine defect can affect every host and therefore requires broad contract evidence"],
          sources: [reference()],
        }],
        candidateOptionKey: "shared-governed-engine",
        rationale: "The shared governed engine is the current evidence-backed candidate because it centralizes validation, audit, history, and authority boundaries.",
        assumptions: ["Each native host can launch or connect to the exact packaged engine build"],
        consequences: ["Host parsers must reject response drift", "Shared protocol evolution requires compatibility evidence"],
        invalidationTriggers: ["A supported host cannot satisfy the shared engine protocol", "The governed repository boundary changes materially"],
        sources: [reference()],
      }],
      views: [{
        key: "governed-system-context",
        kind: "system-context",
        title: "Governed Product Studio system context candidate",
        audienceRoleKeys: ["gaep-steward", "initiative-owner"],
        concernKeys: ["governed-system-boundary"],
        elementKeys: ["gaep-engine", "product-studio-host", "workspace-store"],
        relationKeys: ["engine-writes-store", "host-calls-engine"],
        qualityAttributeKeys: ["audit-integrity", "host-response-integrity"],
        decisionKeys: ["shared-engine-boundary"],
        scope: "The candidate view covers the native host, shared engine, governed workspace store, exact interactions, and bounded failure behavior.",
        notation: "structured-record",
        freshness: "candidate-current",
        regenerationTriggers: ["Governed repository boundary changes", "Host protocol or shared-engine packaging changes"],
        sources: [reference()],
      }],
      conformanceCriteria: [{
        key: "shared-engine-conformance",
        statement: "Every supported host delegates governed Product semantics to the exact shared engine and rejects substituted or private projection responses.",
        subjectElementKeys: ["gaep-engine", "product-studio-host", "workspace-store"],
        qualityAttributeKeys: ["audit-integrity", "host-response-integrity"],
        decisionKeys: ["shared-engine-boundary"],
        method: "Run shared contract, engine lifecycle, controlled portability, host parser, packaged workflow, and conformance-matrix gates.",
        evidenceExpectation: "Exact passing receipts identify source revisions, package digests, host checks, known limitations, and zero synthesized acceptance authority.",
        state: "candidate",
        sources: [reference()],
      }],
      lifecycleConsequences: [{
        topic: "compatibility",
        statement: "Protocol and governed-record changes require explicit backward-compatibility analysis for every supported native host and portable store.",
        ownerRoleKey: "gaep-steward",
        state: "candidate",
        rationale: "Cross-host semantic parity depends on strict compatible request, response, and persisted-record contracts.",
        triggers: ["Contract schema changes", "Protocol version changes"],
        sources: [reference()],
      }, {
        topic: "evolution",
        statement: "Architecture-significant engine, host, or repository changes require a superseding candidate architecture revision and refreshed evidence.",
        ownerRoleKey: "initiative-owner",
        state: "candidate",
        rationale: "The candidate must remain tied to exact current constraints instead of becoming an unversioned timeless diagram.",
        triggers: ["Authority boundary changes", "New native host support"],
        sources: [reference()],
      }, {
        topic: "migration",
        statement: "Persisted schema or host-protocol migration requires explicit compatibility, integrity, rollback, and hostile-fixture evidence before adoption.",
        ownerRoleKey: "gaep-steward",
        state: "candidate",
        rationale: "Automatic inference or partial migration could alter governed meaning or fabricate authority-bearing state.",
        triggers: ["Governed record schema changes", "Repository format changes"],
        sources: [reference()],
      }, {
        topic: "recovery",
        statement: "Interrupted governed mutations must preserve the last complete current and history state and expose attributable recovery diagnostics.",
        ownerRoleKey: "gaep-steward",
        state: "candidate",
        rationale: "The Product Owner requires durable continuation without partial authority-bearing state after interruption.",
        triggers: ["Audit or transaction recovery occurs", "Process interruption during mutation"],
        sources: [reference()],
      }, {
        topic: "retirement",
        statement: "A retired architecture candidate remains in immutable history and is replaced only by a traceable superseding revision or separately governed disposition.",
        ownerRoleKey: "initiative-owner",
        state: "candidate",
        rationale: "Historical design context must remain reconstructable without treating retirement as deletion or approval withdrawal.",
        triggers: ["Architecture scope is replaced", "The Initiative is cancelled or completed"],
        sources: [reference()],
      }],
      inconsistencies: [],
      unresolvedQuestions: [],
      governance: {
        ownerRoleKey: "initiative-owner",
        reviewerRoleKeys: ["gaep-steward", "initiative-owner"],
        approvalState: "not-granted",
        reviewState: "under-challenge",
        basis: "The candidate owner and reviewers may prepare and challenge the design, but only a separate accountable human decision can approve an exact architecture set.",
        sources: [reference()],
      },
      limitations: ["No realistic Product Owner architecture approval, implementation conformance, readiness, or release authority is represented"],
      ...overrides,
    }
  }

  function boundedContextModelInput(
    architecture: Awaited<ReturnType<typeof engine.systemSolutionArchitecture.create>>,
    overrides: Partial<BoundedContextModelInput> = {},
  ): BoundedContextModelInput {
    return {
      initiativeId: initiative.id,
      context: context(),
      informationClassification: "internal",
      title: "Candidate governed Bounded Context and Ownership Model",
      purpose: "Define explicit candidate domain boundaries, ownership traces, ubiquitous language, cross-context contracts, and context-map relationships for accountable review.",
      systemSolutionArchitecture: {
        recordId: architecture.id,
        revision: architecture.revision,
        digest: canonicalDigest(architecture),
      },
      boundedContexts: [{
        key: "governance-core",
        name: "Governed Product Core",
        domainType: "core",
        purpose: "Own governed Product semantics, exact validation, immutable history, assessments, and workspace persistence within one explicit language boundary.",
        responsibilities: [
          "Assess candidate records without granting approval or readiness",
          "Persist validated current records, immutable history, and attributable audit events",
        ],
        excludedResponsibilities: [
          "Appoint organizational owners or approve Product architecture",
          "Render host-native interaction or execute external providers",
        ],
        architectureElementKeys: ["gaep-engine", "workspace-store"],
        dataAssetElementKeys: ["workspace-store"],
        ownerRoleKey: "gaep-steward",
        stewardRoleKeys: ["gaep-steward", "initiative-owner"],
        ownershipState: "candidate-not-accepted",
        ubiquitousLanguage: [{
          key: "candidate-record",
          term: "Candidate record",
          definition: "A versioned, attributable and reviewable Product-domain record that carries no approval, readiness, release, appointment, or action authority.",
          aliases: ["governed candidate"],
          ambiguityNotes: ["Candidate does not mean approved baseline"],
          sources: [reference()],
        }],
        invariants: [
          "Every governed mutation commits current state, immutable history, and audit evidence atomically",
          "Every semantic read binds the exact current Product and Initiative",
        ],
        sources: [reference()],
      }, {
        key: "product-studio",
        name: "Native Product Studio",
        domainType: "supporting",
        purpose: "Own native human interaction and privacy-safe presentation while delegating governed Product semantics to the shared engine boundary.",
        responsibilities: [
          "Collect explicit human inputs through a native host surface",
          "Render strict privacy-safe engine projections and bounded errors",
        ],
        excludedResponsibilities: [
          "Persist governed records directly",
          "Synthesize Product decisions, ownership acceptance, approval, or readiness",
        ],
        architectureElementKeys: ["product-studio-host"],
        dataAssetElementKeys: [],
        ownerRoleKey: "initiative-owner",
        stewardRoleKeys: ["gaep-steward", "initiative-owner"],
        ownershipState: "candidate-not-accepted",
        ubiquitousLanguage: [{
          key: "privacy-safe-projection",
          term: "Privacy-safe projection",
          definition: "A strict read model containing only declared identities, counts, statuses, timestamps, and digests needed for native Product inspection.",
          aliases: ["bounded host projection"],
          ambiguityNotes: ["A projection is not the governed source record"],
          sources: [reference()],
        }],
        invariants: [
          "Host responses reject extra private fields and substituted bindings",
          "Native presentation never grants Product or execution authority",
        ],
        sources: [reference()],
      }],
      contracts: [{
        key: "host-engine-protocol",
        name: "Strict Product Studio engine protocol",
        kind: "api",
        providerContextKey: "product-studio",
        consumerContextKeys: ["governance-core"],
        architectureRelationKeys: ["host-calls-engine"],
        ownerRoleKey: "gaep-steward",
        versioning: "The protocol uses an explicit version and rejects downgrade, unknown method, unexpected request fields, and incompatible response shape.",
        compatibility: "Every supported native host must parse the exact response contract and reject binding, snapshot-digest, privacy-boundary, or authority-boundary drift.",
        consistency: "The response binds one exact Product revision, Initiative revision, governed candidate record, assessment, and snapshot digest from a single read boundary.",
        failureBehavior: "The consumer receives a bounded non-authorizing failure and must not display private payload details or retry a semantic mutation implicitly.",
        state: "candidate",
        sources: [reference()],
      }],
      relationships: [{
        key: "product-studio-to-governance-core",
        upstreamContextKey: "product-studio",
        downstreamContextKey: "governance-core",
        pattern: "customer-supplier",
        contractKeys: ["host-engine-protocol"],
        rationale: "The native surface supplies explicit human intent and consumes strict shared-engine outcomes while the engine owns governed Product semantics.",
        changeCoordination: "Protocol changes require shared contract review, four-host parser evidence, package rebinding, and no synthesized approval or migration authority.",
        sources: [reference()],
      }],
      inconsistencies: [],
      unresolvedQuestions: [],
      governance: {
        ownerRoleKey: "initiative-owner",
        reviewerRoleKeys: ["gaep-steward", "initiative-owner"],
        boundaryApprovalState: "not-granted",
        ownershipAcceptanceState: "not-granted",
        reviewState: "under-challenge",
        basis: "Named roles prepare and challenge the candidate boundary and ownership trace, but a separate accountable human decision is required for approval and acceptance.",
        sources: [reference()],
      },
      limitations: ["No organizational appointment, accepted ownership, approved boundary, readiness, release, deployment, or action authority is represented"],
      ...overrides,
    }
  }

  function securityPrivacyAssessmentInput(
    boundedContextModel: BoundedContextModel,
    overrides: Partial<SecurityPrivacyAssessmentInput> = {},
  ): SecurityPrivacyAssessmentInput {
    const requirementCoverage = [...securityPrivacyRequirementIds]
      .sort((left, right) => left.localeCompare(right))
      .map((requirementId) => ({
        requirementId,
        state: "covered-candidate" as const,
        controlKeys: ["strict-shared-engine"],
        threatKeys: ["authority-and-context-forgery"],
        basis: "The candidate maps this exact profile requirement to the declared threat, control, architecture, and Source evidence without claiming approval, conformance, or control effectiveness.",
        evidence: [reference()],
      }))
    return {
      initiativeId: initiative.id,
      context: context(),
      informationClassification: "internal",
      title: "Candidate governed Security, Privacy, and Threat Assessment",
      scope: "Assess the exact native-host, shared-engine, governed-workspace, authority, integrity, privacy, data-flow, and recovery boundary for accountable human review.",
      boundedContextModel: {
        recordId: boundedContextModel.id,
        revision: boundedContextModel.revision,
        digest: canonicalDigest(boundedContextModel),
      },
      assets: [{
        key: "governed-workspace",
        name: "Governed engine and workspace state",
        securityObjectives: [
          "Preserve exact attributable history and audit integrity",
          "Prevent unauthorized mutation, approval replay, and evidence forgery",
        ],
        architectureElementKeys: ["gaep-engine", "workspace-store"],
        ownerRoleKey: "gaep-steward",
        sources: [reference()],
      }, {
        key: "native-host",
        name: "Native Product Studio interaction boundary",
        securityObjectives: [
          "Expose only strict privacy-safe projections",
          "Preserve explicit human intent without synthesizing authority",
        ],
        architectureElementKeys: ["product-studio-host"],
        ownerRoleKey: "initiative-owner",
        sources: [reference()],
      }],
      actors: [{
        key: "malicious-content-author",
        name: "Malicious or compromised content author",
        kind: "attacker",
        trust: "untrusted",
        capabilities: ["Craft content intended to alter instructions, bindings, or rendered conclusions"],
        constraints: ["Repository content has no instruction, approval, or effect authority by presence alone"],
        sources: [reference()],
      }, {
        key: "product-owner",
        name: "Accountable Product owner",
        kind: "human",
        trust: "mixed",
        capabilities: ["Provide explicit candidate input and separately governed human decisions"],
        constraints: ["Role identity alone does not prove an effective appointment, grant, approval, or risk acceptance"],
        sources: [reference()],
      }, {
        key: "shared-engine",
        name: "Shared governed engine service",
        kind: "service",
        trust: "mixed",
        capabilities: ["Validate, persist, assess, and project exact governed records"],
        constraints: ["Cannot approve its own output, attest control effectiveness, accept risk, or authorize action"],
        sources: [reference()],
      }],
      trustBoundaries: [{
        key: "host-engine-workspace",
        name: "Native host, engine, and governed workspace boundary",
        kind: "workspace",
        architectureRelationKeys: ["engine-writes-store", "host-calls-engine"],
        actorKeys: ["malicious-content-author", "product-owner", "shared-engine"],
        dataClassKeys: ["governed-product-metadata"],
        rationale: "Human and untrusted workspace inputs cross a strict host-to-engine protocol before any validated candidate state reaches the governed workspace store.",
        failureBehavior: "Unexpected fields, stale bindings, invalid digests, secret-shaped content, audit failure, or untrusted authority claims fail before a governed write or trusted projection.",
        sources: [reference()],
      }],
      dataClasses: [{
        key: "governed-product-metadata",
        name: "Governed Product metadata and evidence references",
        classification: "internal",
        subjectCategories: ["Governed Product contributors and accountable reviewers"],
        purposes: ["Maintain attributable Product candidates, exact evidence bindings, audit history, and review status"],
        processingAuthorityState: "candidate-declared",
        ownerRoleKey: "gaep-steward",
        architectureElementKeys: ["gaep-engine", "product-studio-host", "workspace-store"],
        recipientConstraints: ["Only the selected local workspace and explicit privacy-safe host projections"],
        residencyConstraints: ["Repository-relative local governed state unless separately reviewed and authorized"],
        minimization: "Persist only fields required by the declared Product contract and expose hosts only bounded identities, counts, statuses, timestamps, and digests.",
        retention: "Retain immutable candidate history for traceability while leaving exact retention approval and disposal policy unresolved for accountable review.",
        deletionAndCorrection: "Correction creates a superseding immutable revision; deletion, legal hold, archival, backup, and downstream disposition require separate governed decisions.",
        providerAndModelUse: "No provider or model processing is authorized by this candidate; any future provider flow requires exact terms, minimization, residency, retention, and human review.",
        affectedPersonRights: "Applicable transparency, access, correction, challenge, and deletion channels remain subject to identified policy, jurisdiction, and accountable ownership.",
        sources: [reference()],
      }],
      dataFlows: [{
        key: "candidate-record-roundtrip",
        name: "Explicit candidate record input and privacy-safe projection",
        architectureRelationKeys: ["engine-writes-store", "host-calls-engine"],
        dataClassKeys: ["governed-product-metadata"],
        trustBoundaryKeys: ["host-engine-workspace"],
        actorKeys: ["product-owner", "shared-engine"],
        purpose: "Validate explicit human candidate input, persist exact immutable history, and return a bounded privacy-safe status projection.",
        recipients: ["Accountable Product reviewers through a selected native host"],
        locations: ["Selected local workspace and its native Product Studio projection"],
        sources: [reference()],
      }],
      controls: [{
        key: "strict-shared-engine",
        name: "Strict shared-engine validation and immutable evidence boundary",
        kind: "preventive",
        statement: "The engine verifies audit integrity, exact Product and Initiative context, immutable upstream revisions, complete profile coverage, canonical graph references, secret exclusion, and atomic current/history/audit persistence.",
        ownerRoleKey: "gaep-steward",
        architectureElementKeys: ["gaep-engine", "product-studio-host", "workspace-store"],
        implementationState: "observed-implemented",
        verificationState: "evidence-linked",
        effectivenessState: "not-assessed",
        evidence: [reference()],
        failureBehavior: "A failed integrity, schema, source, authority, coverage, binding, or privacy check aborts without partial governed mutation or a weaker fallback path.",
        reviewTriggers: ["Architecture, boundary, provider, profile, policy, capability, data purpose, or evidence changes"],
        sources: [reference()],
      }],
      threats: [{
        key: "authority-and-context-forgery",
        title: "Forged authority or poisoned context crosses the Product boundary",
        category: "governance-abuse",
        actorKeys: ["malicious-content-author"],
        assetKeys: ["governed-workspace", "native-host"],
        trustBoundaryKeys: ["host-engine-workspace"],
        dataFlowKeys: ["candidate-record-roundtrip"],
        scenario: "A malicious or mistaken input attempts to substitute exact Product bindings, inject instructions or secrets, forge approval or risk acceptance, or alter evidence while retaining a plausible native presentation.",
        consequence: "Governed meaning, privacy, accountability, or workspace integrity could be corrupted and downstream users could act on a false readiness or authority claim.",
        controlKeys: ["strict-shared-engine"],
        riskAssessmentState: "not-assessed",
        residualRisk: "The candidate control has deterministic implementation evidence but no approved risk method, independent effectiveness assessment, native acceptance, provider assessment, or residual-risk acceptance.",
        residualRiskState: "candidate-described",
        riskAcceptanceState: "not-granted",
        ownerRoleKey: "initiative-owner",
        reviewTriggers: ["A control fails, the trust boundary changes, or new provider, native-host, data, identity, or supply-chain evidence appears"],
        sources: [reference()],
      }],
      requirementCoverage,
      assumptions: ["The selected local workspace remains the declared system boundary for this candidate assessment"],
      inconsistencies: [],
      unresolvedQuestions: [],
      governance: {
        securityAuthorityRoleKey: "gaep-steward",
        privacyAuthorityRoleKey: "initiative-owner",
        riskOwnerRoleKeys: ["gaep-steward", "initiative-owner"],
        reviewerRoleKeys: ["gaep-steward", "initiative-owner"],
        threatModelApprovalState: "not-granted",
        privacyReviewState: "not-granted",
        residualRiskAcceptanceState: "not-granted",
        controlEffectivenessState: "not-established",
        reviewState: "under-challenge",
        basis: "Named candidate roles may prepare and challenge the assessment, but only separately established eligible human authorities can approve the threat model and processing, attest control effectiveness, or accept exact residual risk.",
        sources: [reference()],
      },
      limitations: ["No Codex Security scan, approved threat model, control-effectiveness attestation, risk acceptance, privacy approval, security readiness, release, deployment, or action authority is represented"],
      ...overrides,
    }
  }

  function processModelInput(
    valueStreamModel: ValueStreamModel,
    operatingModel: OperatingModel,
    businessRuleCatalog: BusinessRuleCatalog,
    boundedContextModel: BoundedContextModel,
    securityPrivacyAssessment: SecurityPrivacyAssessment,
    overrides: Partial<ProcessModelInput> = {},
  ): ProcessModelInput {
    const requirementCoverage = [...processRequirementIds]
      .sort((left, right) => left.localeCompare(right))
      .map((requirementId) => ({
        requirementId,
        state: "covered-candidate" as const,
        processKeys: ["governed-context-review"],
        transitionKeys: ["draft-to-review", "review-to-finalized"],
        basis: "The candidate maps this exact requirement to stable process, state, transition, event, approval, evidence, and Source identities without claiming approval, authorization, readiness, or execution.",
        evidence: [reference()],
      }))
    return {
      initiativeId: initiative.id,
      context: context(),
      informationClassification: "internal",
      title: "Candidate governed Process Model",
      scope: "Model the exact governed context review workflow, orthogonal authoring state, attributable transitions, events, evidence, and human approval boundary for accountable review.",
      valueStreamModel: { recordId: valueStreamModel.id, revision: valueStreamModel.revision, digest: canonicalDigest(valueStreamModel) },
      operatingModel: { recordId: operatingModel.id, revision: operatingModel.revision, digest: canonicalDigest(operatingModel) },
      businessRuleCatalog: { recordId: businessRuleCatalog.id, revision: businessRuleCatalog.revision, digest: canonicalDigest(businessRuleCatalog) },
      boundedContextModel: { recordId: boundedContextModel.id, revision: boundedContextModel.revision, digest: canonicalDigest(boundedContextModel) },
      securityPrivacyAssessment: {
        recordId: securityPrivacyAssessment.id,
        revision: securityPrivacyAssessment.revision,
        digest: canonicalDigest(securityPrivacyAssessment),
      },
      processes: [{
        key: "governed-context-review",
        name: "Governed context review",
        purpose: "Prepare, challenge, and present exact governed Product context for a separate accountable human decision without treating workflow completion as approval or authority.",
        ownerRoleKey: "initiative-owner",
        participantRoleKeys: ["gaep-steward", "initiative-owner"],
        valueStreamKeys: ["governed-delivery"],
        boundedContextKeys: ["governance-core", "product-studio"],
        businessRuleKeys: ["govern-context-eligibility"],
        trigger: "An exact active Product Initiative requires governed candidate context before downstream Product progression can be considered.",
        inputs: ["Exact bound Product records and attributable Source evidence"],
        outputs: ["Candidate Process Model and separate human approval request context"],
        stateDimensions: [{
          key: "authoring-lifecycle",
          name: "Process authoring lifecycle",
          family: "authoring-lifecycle",
          statechartVersion: 1,
          initialStateKey: "draft",
          states: [{
            key: "draft",
            name: "Draft",
            terminal: false,
            meaning: "The candidate process is being prepared and has no approval, readiness, transition, execution, or action authority.",
            sources: [reference()],
          }, {
            key: "finalized",
            name: "Finalized candidate",
            terminal: true,
            meaning: "The exact candidate authoring revision is closed for review history but remains separate from approval, baseline, authorization, readiness, and execution.",
            sources: [reference()],
          }, {
            key: "in-review",
            name: "In review",
            terminal: false,
            meaning: "Named reviewers are challenging the exact candidate under declared evidence and limitations without granting human approval or authority.",
            sources: [reference()],
          }],
          migrationAndCompatibility: "A changed statechart version requires an explicit migration, affected-instance review, compatibility statement, and re-evaluation before any dependent transition.",
          sources: [reference()],
        }],
        approvalRequirements: [{
          key: "process-baseline-approval",
          level: "A2",
          purpose: "Require a separately attributable accountable human decision before any exact Process Model candidate can become an approved Product baseline.",
          exactSubject: "One exact immutable Process Model candidate revision and its five upstream membership bindings.",
          approverRoleKeys: ["initiative-owner"],
          segregationRules: ["The process generator cannot provide the accountable approval response"],
          aggregationRule: "One valid exact-version response from an independently established eligible Initiative owner is required; absence, ambiguity, conflict, expiry, or revocation remains incomplete.",
          allowedOutcomes: ["approved", "changes-requested", "deferred", "rejected"],
          evidenceRequirements: ["Exact candidate digest, upstream membership, assessment gaps, unresolved matters, and reviewer limitations"],
          validity: "Any future determination remains valid only for the unchanged exact subject, authority, policy, evidence, conditions, and effective interval.",
          reopeningTriggers: ["Authority, policy, evidence, scope, Source, upstream record, statechart, process, step, transition, approval, or risk context changes materially"],
          approvalState: "not-granted",
          sources: [reference()],
        }],
        transitions: [{
          key: "draft-to-review",
          dimensionKey: "authoring-lifecycle",
          sourceStateKey: "draft",
          targetStateKey: "in-review",
          trigger: "The candidate author requests accountable challenge of the exact draft revision.",
          actorRoleKeys: ["initiative-owner"],
          authorityBasis: "A future exact role assignment and applicable policy must independently authorize submission; this candidate records no such grant.",
          guardCriteria: ["Exact upstream bindings and Source evidence are current", "Required process, step, event, transition, rule, context, role, and requirement coverage is explicit"],
          evidenceRequirements: ["Candidate integrity, completeness, limitations, and unresolved-matter evidence"],
          approvalRequirementKeys: [],
          confirmationRequired: false,
          idempotencyRequired: true,
          concurrencyRule: "compare-and-swap",
          effects: ["Create an immutable transition record and attributable governance and audit events"],
          failureBehavior: "A stale, conflicting, missing, unsupported, unauthorized, or uncertain request is rejected without changing current state or inferring review entry.",
          reopeningAndCompensation: "A material change creates a superseding candidate and explicit reopening record; history is never overwritten and rollback never erases prior facts.",
          authorityState: "not-granted",
          sources: [reference()],
        }, {
          key: "review-to-finalized",
          dimensionKey: "authoring-lifecycle",
          sourceStateKey: "in-review",
          targetStateKey: "finalized",
          trigger: "Reviewers conclude the exact candidate is sufficiently described for a separate accountable Product approval decision.",
          actorRoleKeys: ["gaep-steward", "initiative-owner"],
          authorityBasis: "Candidate review participation is not approval; any final transition requires separately valid exact human approval and authorization records at action time.",
          guardCriteria: ["Every required contribution, finding, limitation, dissent, and evidence result is exact and attributable", "The approval requirement remains explicit and no response is synthesized"],
          evidenceRequirements: ["Exact review conclusion, findings, limitations, requirement coverage, and approval-case context"],
          approvalRequirementKeys: ["process-baseline-approval"],
          confirmationRequired: true,
          idempotencyRequired: true,
          concurrencyRule: "explicit-re-evaluation",
          effects: ["Create immutable candidate-finalization, transition, governance, and audit records without baseline promotion"],
          failureBehavior: "Missing or invalid approval, authority, evidence, confirmation, or concurrency state fails closed and preserves the candidate in review.",
          reopeningAndCompensation: "New material evidence reopens through a defined superseding revision and preserves the earlier review, approval, transition, and event history.",
          authorityState: "not-granted",
          sources: [reference()],
        }],
        steps: [{
          key: "prepare-candidate",
          sequence: 1,
          objective: "Assemble the exact bounded Product process candidate and validate its source, graph, governance, state, approval, and authority boundaries.",
          responsibility: "mixed",
          dependencyKeys: [],
          roleKeys: ["gaep-steward", "initiative-owner"],
          boundedContextKeys: ["governance-core", "product-studio"],
          transitionKeys: ["draft-to-review"],
          approvalRequirementKeys: [],
          inputs: ["Exact upstream records and Source evidence"],
          outputs: ["Validated candidate ready for accountable challenge"],
          evidenceRequirements: ["Schema, exact-binding, hostile-input, audit, history, health, and privacy-projection evidence"],
          stopConditions: ["Any required identity, binding, role, rule, state, transition, evidence, Source, or authority input is stale, missing, conflicting, unsupported, or uncertain"],
          recoveryExpectations: ["Preserve immutable history and resume only from revalidated exact inputs"],
          proposedEffects: [],
          authorizationState: "not-granted",
          completionState: "not-assessed",
          sources: [reference()],
        }, {
          key: "review-candidate",
          sequence: 2,
          objective: "Challenge the exact candidate, surface findings and limitations, and prepare a separate human approval case without treating review completion as permission.",
          responsibility: "human",
          dependencyKeys: ["prepare-candidate"],
          roleKeys: ["gaep-steward", "initiative-owner"],
          boundedContextKeys: ["governance-core", "product-studio"],
          transitionKeys: ["review-to-finalized"],
          approvalRequirementKeys: ["process-baseline-approval"],
          inputs: ["Exact candidate, evaluation results, review contributions, findings, limitations, and unresolved matters"],
          outputs: ["Attributable review conclusion and separately governed approval request"],
          evidenceRequirements: ["Exact reviewer identities, roles, criteria, contributions, findings, conclusion, exclusions, and limitations"],
          stopConditions: ["Approval, authority, evidence, independence, subject version, policy, state, or confirmation is absent, invalid, stale, conflicted, expired, revoked, or indeterminate"],
          recoveryExpectations: ["Reopen or supersede explicitly after material change and preserve every prior review, approval, transition, and event record"],
          proposedEffects: ["Candidate authoring finalization only after separate exact authorization"],
          authorizationState: "not-granted",
          completionState: "not-assessed",
          sources: [reference()],
        }],
        events: [{
          key: "process-finalized",
          category: "governance",
          schemaVersion: 1,
          subject: "One exact candidate authoring-lifecycle transition from in-review to finalized without baseline promotion or action authority.",
          producerRoleKeys: ["gaep-steward", "initiative-owner"],
          transitionKeys: ["review-to-finalized"],
          payloadContract: "Bind event identity, exact subject and state versions, actor, role, authority, approval, evidence, occurrence and recording time, cause, correlation, classification, provenance, and integrity.",
          classification: "internal",
          provenanceAndIntegrity: "The immutable event is transaction-bound to the exact transition record and audit chain; correction requires a linked corrective event.",
          correctionSemantics: "Never overwrite the original event; record a linked correction or compensating action with residual effects and attributable authority.",
          sources: [reference()],
        }, {
          key: "process-review-requested",
          category: "governance",
          schemaVersion: 1,
          subject: "One exact candidate authoring-lifecycle transition request from draft to in-review and its independently committed result.",
          producerRoleKeys: ["initiative-owner"],
          transitionKeys: ["draft-to-review"],
          payloadContract: "Bind request and committed transition separately with exact expected version, actor, role, authority basis, reason, evidence, idempotency, correlation, classification, provenance, and integrity.",
          classification: "internal",
          provenanceAndIntegrity: "The immutable event distinguishes requested and committed facts and remains transaction-bound to the governed audit chain.",
          correctionSemantics: "An incorrect event remains preserved and is corrected only through an attributable linked event or defined compensating transition.",
          sources: [reference()],
        }],
        assumptions: ["The exact local candidate records remain the declared bounded Process Model scope"],
        inconsistencies: [],
        unresolvedQuestions: [],
        limitations: ["No human approval, transition execution, operational readiness, baseline designation, release, deployment, or action authority is represented"],
        sources: [reference()],
      }],
      requirementCoverage,
      governance: {
        processOwnerRoleKey: "initiative-owner",
        stateStewardRoleKey: "gaep-steward",
        approvalCoordinatorRoleKey: "initiative-owner",
        reviewerRoleKeys: ["gaep-steward", "initiative-owner"],
        authoringLifecycle: "under-challenge",
        transitionAuthorityState: "not-granted",
        approvalState: "not-granted",
        operationalReadinessState: "not-established",
        executionAuthorityState: "not-granted",
        basis: "Named candidate roles can prepare and challenge the process, but only separately established eligible humans and exact authorization records can approve or cause material transitions and effects.",
        sources: [reference()],
      },
      assumptions: ["The selected candidate Process Model remains bounded to the exact current Product and Initiative"],
      inconsistencies: [],
      unresolvedQuestions: [],
      limitations: ["No approved Process baseline, valid human approval, transition execution, operational readiness, release, deployment, or action authority is represented"],
      ...overrides,
    }
  }

  function dataModelInput(
    architecture: SystemSolutionArchitecture,
    boundedContextModel: BoundedContextModel,
    operatingModel: OperatingModel,
    securityPrivacyAssessment: SecurityPrivacyAssessment,
    processModel: ProcessModel,
    overrides: Partial<DataModelInput> = {},
  ): DataModelInput {
    const requirementCoverage = [...dataModelRequirementIds]
      .sort((left, right) => left.localeCompare(right))
      .map((requirementId) => ({
        requirementId,
        state: "covered-candidate" as const,
        entityKeys: ["governed-record", "product-studio-projection"],
        lifecycleKeys: ["candidate-record-lifecycle"],
        transformationKeys: ["candidate-projection"],
        basis: "The candidate maps this exact Data Profile requirement to entity, attribute, ownership, lifecycle, transformation, flow, and Source identities without claiming approval, processing authority, readiness, or execution.",
        evidence: [reference()],
      }))
    return {
      initiativeId: initiative.id,
      context: context(),
      informationClassification: "internal",
      title: "Candidate governed Data Model",
      scope: "Model conceptual governed records and privacy-safe host projections with exact semantics, candidate ownership, lifecycle, relationships, transformations, and profile evidence.",
      systemSolutionArchitecture: { recordId: architecture.id, revision: architecture.revision, digest: canonicalDigest(architecture) },
      boundedContextModel: { recordId: boundedContextModel.id, revision: boundedContextModel.revision, digest: canonicalDigest(boundedContextModel) },
      operatingModel: { recordId: operatingModel.id, revision: operatingModel.revision, digest: canonicalDigest(operatingModel) },
      securityPrivacyAssessment: {
        recordId: securityPrivacyAssessment.id,
        revision: securityPrivacyAssessment.revision,
        digest: canonicalDigest(securityPrivacyAssessment),
      },
      processModel: { recordId: processModel.id, revision: processModel.revision, digest: canonicalDigest(processModel) },
      entities: [{
        key: "governed-record",
        name: "Governed candidate record",
        kind: "aggregate-root",
        meaning: "One exact immutable Product-domain candidate revision with current identity, predecessor history, upstream membership, evidence, and non-authoritative governance state.",
        boundedContextKey: "governance-core",
        architectureElementKeys: ["gaep-engine", "workspace-store"],
        processKeys: ["governed-context-review"],
        dataClassKeys: ["governed-product-metadata"],
        ownerRoleKey: "gaep-steward",
        stewardRoleKeys: ["gaep-steward", "initiative-owner"],
        ownershipState: "candidate-not-accepted",
        systemOfRecordState: "candidate-declared",
        attributes: [{
          key: "record-id",
          name: "Record identity",
          valueKind: "identifier",
          required: true,
          identifierRole: "surrogate",
          meaning: "Stable opaque identity for one governed record lineage independent from title, owner, status, or storage location.",
          classification: "internal",
          containsPersonalData: false,
          dataClassKeys: ["governed-product-metadata"],
          constraints: ["Immutable UUID identity", "Never derived from a local path or mutable label"],
          sources: [reference()],
        }, {
          key: "revision",
          name: "Immutable revision",
          valueKind: "integer",
          required: true,
          identifierRole: "correlation",
          meaning: "Positive contiguous immutable revision number bound to exact predecessor content and audit evidence.",
          classification: "internal",
          containsPersonalData: false,
          dataClassKeys: ["governed-product-metadata"],
          constraints: ["Positive contiguous value", "Predecessor digest required after revision one"],
          sources: [reference()],
        }],
        invariants: ["Current state matches the latest complete immutable history", "Every mutation commits current, history, and audit evidence atomically"],
        sources: [reference()],
      }, {
        key: "product-studio-projection",
        name: "Product Studio privacy-safe projection",
        kind: "projection",
        meaning: "Derived read-only host view containing bounded record identities, counts, statuses, timestamps, and digests without candidate narrative or private content.",
        boundedContextKey: "product-studio",
        architectureElementKeys: ["product-studio-host"],
        processKeys: ["governed-context-review"],
        dataClassKeys: ["governed-product-metadata"],
        ownerRoleKey: "initiative-owner",
        stewardRoleKeys: ["gaep-steward", "initiative-owner"],
        ownershipState: "candidate-not-accepted",
        systemOfRecordState: "not-applicable",
        attributes: [{
          key: "snapshot-digest",
          name: "Snapshot digest",
          valueKind: "identifier",
          required: true,
          identifierRole: "correlation",
          meaning: "Canonical digest binding the complete bounded projection body to the exact observation result returned by the shared engine.",
          classification: "internal",
          containsPersonalData: false,
          dataClassKeys: ["governed-product-metadata"],
          constraints: ["Canonical SHA-256 digest", "Recomputed and verified before native rendering"],
          sources: [reference()],
        }],
        invariants: ["Projection excludes narrative, personal data, locators, paths, secrets, and credentials", "Projection never becomes authoritative source state"],
        sources: [reference()],
      }],
      relationships: [{
        key: "record-projects-to-host",
        fromEntityKey: "governed-record",
        toEntityKey: "product-studio-projection",
        kind: "derivation",
        cardinality: "one-to-many",
        ownership: "from-owns",
        integrity: "Every projection binds one exact current record revision and a canonical snapshot digest; unknown or excess fields fail validation.",
        consistency: "Projection reads recheck the exact Product, Initiative, upstream membership, audit, and current-record context before returning bounded state.",
        deletionBehavior: "Projection data is ephemeral and independently discardable; governed record correction or disposition never erases immutable historical facts silently.",
        sources: [reference()],
      }],
      lifecycles: [{
        key: "candidate-record-lifecycle",
        entityKeys: ["governed-record", "product-studio-projection"],
        initialStateKey: "candidate",
        states: [{
          key: "candidate",
          name: "Candidate",
          meaning: "The record is versioned and reviewable but has no model, classification, ownership, migration, readiness, release, or action approval.",
          terminal: false,
          sources: [reference()],
        }, {
          key: "superseded",
          name: "Superseded",
          meaning: "A later immutable candidate revision replaces current use while preserving exact lineage, prior assertions, evidence, and correction context.",
          terminal: true,
          sources: [reference()],
        }],
        retention: "Candidate history is retained for current traceability while the exact retention period and controlling policy remain subject to accountable decision.",
        archival: "Archival must preserve exact identity, revision, provenance, classification, relationships, integrity, and resolvability under a separately governed policy.",
        deletion: "Deletion and secure disposition require exact scope, authority, legal-hold reconciliation, downstream consequences, evidence, and separately attributable authorization.",
        correction: "Correction creates a new immutable revision with actor, reason, time, predecessor relationship, and consequences; prior assertions are not overwritten.",
        legalHold: "Legal hold remains a distinct unresolved authority-controlled disposition and cannot imply indefinite operational use or unrestricted access.",
        backupAndRecovery: "Backup and recovery must preserve integrity, classification, retention, correction, deletion, hold, and current-versus-history semantics.",
        migrationAndCompatibility: "Schema or storage migration requires explicit mapping, compatibility, provenance, reconciliation, cutover, rollback, and data-quality evidence.",
        dispositionAuthorityState: "not-granted",
        sources: [reference()],
      }],
      transformations: [{
        key: "candidate-projection",
        sourceEntityKeys: ["governed-record"],
        targetEntityKeys: ["product-studio-projection"],
        processKeys: ["governed-context-review"],
        dataFlowKeys: ["candidate-record-roundtrip"],
        purpose: "Provide accountable reviewers bounded current status and exact evidence identity without exposing complete governed record content.",
        minimization: "Return only identities, revisions, counts, statuses, timestamps, digests, reasons, and fixed privacy and authority boundaries required for review navigation.",
        correctionAndDeletionPropagation: "A changed authoritative revision invalidates stale projections; correction or disposition consequences require explicit re-evaluation across caches, exports, evidence, backups, and downstream copies.",
        providerAndModelUse: "No provider or model receives governed content through this candidate projection; any future use requires exact purpose, terms, minimization, retention, residency, and accountable review.",
        integrityAndLineage: "The projection snapshot digest, upstream membership digest, record digest, immutable history, and audit chain provide exact derivation lineage without transferring authority.",
        state: "candidate",
        sources: [reference()],
      }],
      requirementCoverage,
      assumptions: ["The selected local workspace remains the bounded conceptual Data Model scope"],
      inconsistencies: [],
      unresolvedQuestions: [],
      governance: {
        dataOwnerRoleKeys: ["gaep-steward", "initiative-owner"],
        dataStewardRoleKeys: ["gaep-steward", "initiative-owner"],
        privacyReviewerRoleKeys: ["gaep-steward", "initiative-owner"],
        modelApprovalState: "not-granted",
        classificationApprovalState: "not-granted",
        ownershipAcceptanceState: "not-granted",
        migrationAuthorityState: "not-granted",
        operationalReadinessState: "not-established",
        reviewState: "under-challenge",
        basis: "Named candidate roles may prepare and challenge the model, but only separately established eligible human authorities can approve the model or classification, accept ownership, authorize migration, or establish readiness.",
        sources: [reference()],
      },
      limitations: ["No approved Data Model baseline, classification approval, accepted ownership, migration authority, operational readiness, release, deployment, or action authority is represented"],
      ...overrides,
    }
  }

  function authorizationModelInput(
    architecture: SystemSolutionArchitecture,
    boundedContextModel: BoundedContextModel,
    operatingModel: OperatingModel,
    securityPrivacyAssessment: SecurityPrivacyAssessment,
    processModel: ProcessModel,
    dataModel: DataModel,
    overrides: Partial<AuthorizationModelInput> = {},
  ): AuthorizationModelInput {
    const principalKeys = ["gaep-steward-principal", "initiative-owner-principal"]
    const actionKeys = ["assess-candidate", "revise-candidate"]
    const resourceKeys = [
      "architecture-engine",
      "context-product-studio",
      "data-governed-record",
      "data-product-studio-projection",
      "process-governed-context-review",
    ]
    const ruleKeys = ["candidate-review-rule"]
    const approvalBindingKeys = ["candidate-baseline-approval"]
    const requirementCoverage = [...authorizationModelRequirementIds]
      .sort((left, right) => left.localeCompare(right))
      .map((requirementId) => ({
        requirementId,
        state: "covered-candidate" as const,
        principalKeys,
        actionKeys,
        resourceKeys,
        ruleKeys,
        approvalBindingKeys,
        basis: "The candidate maps this exact Identity and Authority or Decision, Review, Approval, and Authorization requirement to attributable principals, roles, actions, resources, approval constraints, rules, and Source identities without verifying identity, granting authority, approving action, or enforcing policy.",
        evidence: [reference()],
      }))
    return {
      initiativeId: initiative.id,
      context: context(),
      informationClassification: "internal",
      title: "Candidate governed Authorization Model",
      scope: "Model candidate principals, role assignments, resources, actions, approval bindings, and authorization rules for exact governed Product records without creating an effective identity, appointment, approval, grant, enforcement decision, readiness state, or action authority.",
      systemSolutionArchitecture: { recordId: architecture.id, revision: architecture.revision, digest: canonicalDigest(architecture) },
      boundedContextModel: { recordId: boundedContextModel.id, revision: boundedContextModel.revision, digest: canonicalDigest(boundedContextModel) },
      operatingModel: { recordId: operatingModel.id, revision: operatingModel.revision, digest: canonicalDigest(operatingModel) },
      securityPrivacyAssessment: {
        recordId: securityPrivacyAssessment.id,
        revision: securityPrivacyAssessment.revision,
        digest: canonicalDigest(securityPrivacyAssessment),
      },
      processModel: { recordId: processModel.id, revision: processModel.revision, digest: canonicalDigest(processModel) },
      dataModel: { recordId: dataModel.id, revision: dataModel.revision, digest: canonicalDigest(dataModel) },
      principals: [{
        key: "gaep-steward-principal",
        name: "Candidate GAEP steward principal",
        kind: "human",
        operatingRoleKeys: ["gaep-steward"],
        identitySourceState: "candidate-declared",
        identityAssuranceState: "not-verified",
        limitations: ["The candidate principal identity is not verified and establishes no appointment, standing authority, delegation, or authorization grant"],
        sources: [reference()],
      }, {
        key: "initiative-owner-principal",
        name: "Candidate Initiative owner principal",
        kind: "human",
        operatingRoleKeys: ["initiative-owner"],
        identitySourceState: "candidate-declared",
        identityAssuranceState: "not-verified",
        limitations: ["The candidate principal identity is not verified and establishes no appointment, standing authority, delegation, or authorization grant"],
        sources: [reference()],
      }],
      roleAssignments: [{
        key: "assign-gaep-steward",
        principalKey: "gaep-steward-principal",
        operatingRoleKey: "gaep-steward",
        scopeKeys: ["governance-core", "product-studio"],
        assigningAuthorityRoleKey: "initiative-owner",
        effectiveFrom: "2026-07-26T00:00:00.000Z",
        expiryOrReviewCondition: "The candidate assignment requires independent identity, competence, conflict, scope, validity, and appointing-authority review before it could become effective.",
        validityState: "candidate-not-effective",
        delegationState: "not-granted",
        limitations: ["No effective role assignment, standing authority, delegation, or action authorization is represented"],
        sources: [reference()],
      }, {
        key: "assign-initiative-owner",
        principalKey: "initiative-owner-principal",
        operatingRoleKey: "initiative-owner",
        scopeKeys: ["governance-core", "product-studio"],
        assigningAuthorityRoleKey: "gaep-steward",
        effectiveFrom: "2026-07-26T00:00:00.000Z",
        expiryOrReviewCondition: "The candidate assignment requires independent identity, competence, conflict, scope, validity, and appointing-authority review before it could become effective.",
        validityState: "candidate-not-effective",
        delegationState: "not-granted",
        limitations: ["No effective role assignment, standing authority, delegation, or action authorization is represented"],
        sources: [reference()],
      }],
      resources: [{
        key: "architecture-engine",
        name: "Shared engine architecture element",
        kind: "architecture-element",
        subjectKey: "gaep-engine",
        scopeKeys: ["governance-core"],
        classification: "internal",
        effectBoundary: "The resource represents candidate review scope only and grants no mutation, execution, deployment, or release capability.",
        sources: [reference()],
      }, {
        key: "context-product-studio",
        name: "Product Studio bounded context",
        kind: "bounded-context",
        subjectKey: "product-studio",
        scopeKeys: ["product-studio"],
        classification: "internal",
        effectBoundary: "The resource represents privacy-safe native presentation scope only and grants no governed-store, approval, or execution capability.",
        sources: [reference()],
      }, {
        key: "data-governed-record",
        name: "Governed candidate record data entity",
        kind: "data-entity",
        subjectKey: "governed-record",
        scopeKeys: ["governance-core"],
        classification: "internal",
        effectBoundary: "The resource identifies one conceptual data entity for candidate policy review and grants no read, write, processing, retention, deletion, or disclosure authority.",
        sources: [reference()],
      }, {
        key: "data-product-studio-projection",
        name: "Product Studio projection data entity",
        kind: "data-entity",
        subjectKey: "product-studio-projection",
        scopeKeys: ["product-studio"],
        classification: "internal",
        effectBoundary: "The resource identifies one privacy-safe projection for candidate policy review and grants no access, disclosure, persistence, or downstream-use authority.",
        sources: [reference()],
      }, {
        key: "process-governed-context-review",
        name: "Governed context review process",
        kind: "process",
        subjectKey: "governed-context-review",
        scopeKeys: ["governance-core", "product-studio"],
        classification: "internal",
        effectBoundary: "The resource represents an exact candidate process and grants no transition, approval, baseline, readiness, execution, or action authority.",
        sources: [reference()],
      }],
      actions: [{
        key: "assess-candidate",
        name: "Assess candidate coverage",
        purpose: "Read exact governed records and derive a bounded candidate coverage status without changing state or making an authorization decision.",
        processKeys: ["governed-context-review"],
        effectKinds: ["read-derived-status"],
        requiredState: "The exact Product, Initiative, upstream records, Source evidence, and audit chain must remain internally consistent and current.",
        approvalRequirementKeys: [],
        confirmationRequired: false,
        sources: [reference()],
      }, {
        key: "revise-candidate",
        name: "Revise candidate record",
        purpose: "Prepare a superseding immutable candidate revision with exact predecessor, context, evidence, and audit identity without approving or executing it.",
        processKeys: ["governed-context-review"],
        effectKinds: ["governed-candidate-mutation"],
        requiredState: "The Initiative must be mutable and the exact expected revision, context, upstream records, Source evidence, and audit chain must validate.",
        approvalRequirementKeys: ["process-baseline-approval"],
        confirmationRequired: true,
        sources: [reference()],
      }],
      approvalBindings: [{
        key: "candidate-baseline-approval",
        processApprovalRequirementKeys: ["process-baseline-approval"],
        actionKeys: ["revise-candidate"],
        resourceKeys,
        approverRoleKeys: ["initiative-owner"],
        segregation: "The generator, reviewer, and candidate principal cannot synthesize the accountable human approval response or its identity, eligibility, independence, scope, or validity.",
        aggregation: "The exact Process requirement remains separately evaluated; missing, ambiguous, conflicted, expired, revoked, or stale responses remain incomplete.",
        validity: "Any future determination would remain valid only for the unchanged exact subject, authority, policy, evidence, conditions, and effective interval.",
        determinationState: "not-established",
        sources: [reference()],
      }],
      rules: [{
        key: "candidate-review-rule",
        principalKeys,
        roleKeys: ["gaep-steward", "initiative-owner"],
        actionKeys,
        resourceKeys,
        approvalBindingKeys,
        decision: "candidate-eligible",
        conditions: ["Eligibility is descriptive candidate policy coverage only and never an effective permission, approval response, authorization grant, enforcement result, or action authority"],
        invalidationTriggers: ["Any identity, appointment, authority, scope, role, policy, evidence, approval, resource, action, Product, Initiative, or upstream record changes materially"],
        delegationState: "not-granted",
        sources: [reference()],
      }],
      requirementCoverage,
      assumptions: ["The selected local Product and Initiative records remain the exact bounded Authorization Model scope"],
      inconsistencies: [],
      unresolvedQuestions: [],
      governance: {
        securityAuthorityRoleKeys: ["gaep-steward"],
        identityAuthorityRoleKeys: ["initiative-owner"],
        modelReviewerRoleKeys: ["gaep-steward", "initiative-owner"],
        modelApprovalState: "not-granted",
        identityVerificationState: "not-established",
        roleAssignmentApprovalState: "not-granted",
        standingAuthorityState: "not-granted",
        authorizationGrantState: "not-granted",
        enforcementState: "not-established",
        reviewState: "under-challenge",
        basis: "Named candidate principals and roles may prepare and challenge the model, but only separately verified and eligible humans with exact effective appointments and authorization records could approve identity, assignments, standing authority, grants, enforcement, readiness, or action.",
        sources: [reference()],
      },
      limitations: ["No verified identity, effective role assignment, standing authority, authorization grant, enforcement decision, approved model, operational readiness, release, deployment, or action authority is represented"],
      ...overrides,
    }
  }

  function eventIntegrationModelInput(
    architecture: SystemSolutionArchitecture,
    boundedContextModel: BoundedContextModel,
    operatingModel: OperatingModel,
    securityPrivacyAssessment: SecurityPrivacyAssessment,
    processModel: ProcessModel,
    dataModel: DataModel,
    authorizationModel: AuthorizationModel,
    overrides: Partial<EventIntegrationModelInput> = {},
  ): EventIntegrationModelInput {
    const eventTypeKeys = ["candidate-finalized-event", "review-requested-event"]
    const commandKeys = ["assess-candidate-command", "revise-candidate-command"]
    const adapterKeys = ["governed-context-adapter"]
    const externalContractKeys = ["governed-context-contract"]
    const mappingKeys = ["governed-context-mapping"]
    const routeKeys = ["governed-context-route"]
    const requirementCoverage = [...eventIntegrationRequirementIds]
      .sort((left, right) => left.localeCompare(right))
      .map((requirementId) => ({
        requirementId,
        state: "covered-candidate" as const,
        eventTypeKeys,
        commandKeys,
        adapterKeys,
        externalContractKeys,
        mappingKeys,
        routeKeys,
        basis: "The candidate maps this exact State/Event, Workflow/Context, Compatibility/Federation, Effect, or External System Mapping requirement to versioned event, command, adapter, contract, authority-row, and route identities without claiming occurrence, delivery, acceptance, activation, execution, readiness, or authority.",
        evidence: [reference()],
      }))
    return {
      initiativeId: initiative.id,
      context: context(),
      informationClassification: "internal",
      title: "Candidate governed Event and Integration Model",
      scope: "Model exact candidate Event Types, Commands, Adapter definitions, External Contracts, authority-aware mappings, and integration routes without representing an event occurrence, sent or delivered command, accepted external contract, active adapter, completed effect, readiness state, or action authority.",
      systemSolutionArchitecture: {
        recordId: architecture.id,
        revision: architecture.revision,
        digest: canonicalDigest(architecture),
      },
      boundedContextModel: {
        recordId: boundedContextModel.id,
        revision: boundedContextModel.revision,
        digest: canonicalDigest(boundedContextModel),
      },
      operatingModel: {
        recordId: operatingModel.id,
        revision: operatingModel.revision,
        digest: canonicalDigest(operatingModel),
      },
      securityPrivacyAssessment: {
        recordId: securityPrivacyAssessment.id,
        revision: securityPrivacyAssessment.revision,
        digest: canonicalDigest(securityPrivacyAssessment),
      },
      processModel: {
        recordId: processModel.id,
        revision: processModel.revision,
        digest: canonicalDigest(processModel),
      },
      dataModel: {
        recordId: dataModel.id,
        revision: dataModel.revision,
        digest: canonicalDigest(dataModel),
      },
      authorizationModel: {
        recordId: authorizationModel.id,
        revision: authorizationModel.revision,
        digest: canonicalDigest(authorizationModel),
      },
      eventTypes: [{
        key: "candidate-finalized-event",
        name: "Candidate finalized event definition",
        category: "integration",
        schemaVersion: 1,
        processEventKeys: ["process-finalized"],
        producerBoundedContextKey: "governance-core",
        producerRoleKeys: ["gaep-steward", "initiative-owner"],
        subjectKind: "process",
        subjectKeys: ["governed-context-review"],
        payloadDataEntityKeys: ["governed-record"],
        envelope: {
          eventIdentity: "required",
          typeAndSchemaVersion: "required",
          subjectAndExactRevision: "required",
          occurrenceTime: "required-when-observed",
          recordedTime: "required-when-observed",
          producerAndActor: "required",
          accountableScope: "required",
          causationAndCorrelation: "required",
          ordering: "subject-sequence",
          classificationAndHandling: "required",
          provenanceAndIntegrity: "required",
          correctionLink: "required-when-applicable",
        },
        payloadContract: "Bind the exact candidate Process, transition, prior and resulting state versions, actor, authority references, evidence, causation, correlation, classification, provenance, integrity, and correction lineage.",
        orderingScope: "Ordering is defined only within the exact governed Process subject sequence; no global ordering or cross-system delivery order is claimed.",
        correctionSemantics: "The original event remains immutable; a correction is a separately attributable linked event or compensating domain action with explicit residual effects.",
        classification: "internal",
        occurrenceState: "definition-only-not-observed",
        sources: [reference()],
      }, {
        key: "review-requested-event",
        name: "Review requested event definition",
        category: "integration",
        schemaVersion: 1,
        processEventKeys: ["process-review-requested"],
        producerBoundedContextKey: "product-studio",
        producerRoleKeys: ["initiative-owner"],
        subjectKind: "process",
        subjectKeys: ["governed-context-review"],
        payloadDataEntityKeys: ["product-studio-projection"],
        envelope: {
          eventIdentity: "required",
          typeAndSchemaVersion: "required",
          subjectAndExactRevision: "required",
          occurrenceTime: "required-when-observed",
          recordedTime: "required-when-observed",
          producerAndActor: "required",
          accountableScope: "required",
          causationAndCorrelation: "required",
          ordering: "subject-sequence",
          classificationAndHandling: "required",
          provenanceAndIntegrity: "required",
          correctionLink: "required-when-applicable",
        },
        payloadContract: "Bind the exact candidate review request separately from any committed transition, delivery result, approval response, execution result, or external acceptance.",
        orderingScope: "Ordering is defined only within the exact governed Process subject sequence; external consumers must preserve any unsupported or absent ordering guarantee explicitly.",
        correctionSemantics: "Correction never overwrites the original definition or occurrence; a separately attributable linked correction preserves causation and correlation.",
        classification: "internal",
        occurrenceState: "definition-only-not-observed",
        sources: [reference()],
      }],
      commands: [{
        key: "assess-candidate-command",
        name: "assess-candidate",
        semanticVersion: "1.0.0",
        purpose: "Request a bounded read-only assessment of exact candidate coverage and gaps without changing governed state or implying successful execution.",
        mode: "analyze",
        processKeys: ["governed-context-review"],
        actorRoleKeys: ["gaep-steward", "initiative-owner"],
        targetBoundedContextKeys: ["governance-core", "product-studio"],
        inputDataEntityKeys: ["governed-record", "product-studio-projection"],
        outputDataEntityKeys: ["product-studio-projection"],
        authorizationActionKeys: ["assess-candidate"],
        authorizationRuleKeys: ["candidate-review-rule"],
        preconditions: ["Exact Product, Initiative, upstream records, Source evidence, audit integrity, candidate policy references, and expected versions are current"],
        contextRequirements: ["Bounded privacy-safe current records and exact digests are sufficient for candidate assessment without external effect"],
        outputContract: "Return a strict candidate status with counts, gaps, exact record identity, digests, fixed privacy boundary, and fixed no-authority boundary.",
        evidenceRequirements: ["Attributable request and deterministic result evidence preserve requested intent separately from actual execution and effect truth"],
        effectDescriptors: ["read-derived-status"],
        idempotencyRule: "The exact command version, actor scope, target records, expected revisions, and input digest define the idempotency identity; replay cannot create a material effect.",
        timeoutRetryCancellation: "Timeout, retry, cancellation, partial result, and unknown result remain distinct; no timeout is interpreted as success or as proof that no external effect occurred.",
        deliveryState: "not-sent",
        executionState: "not-executed",
        authorizationState: "not-granted",
        sources: [reference()],
      }, {
        key: "revise-candidate-command",
        name: "revise-candidate",
        semanticVersion: "1.0.0",
        purpose: "Request preparation of a superseding candidate revision under exact expected-version, approval, confirmation, evidence, and authorization constraints.",
        mode: "modify",
        processKeys: ["governed-context-review"],
        actorRoleKeys: ["gaep-steward", "initiative-owner"],
        targetBoundedContextKeys: ["governance-core", "product-studio"],
        inputDataEntityKeys: ["governed-record", "product-studio-projection"],
        outputDataEntityKeys: ["governed-record", "product-studio-projection"],
        authorizationActionKeys: ["revise-candidate"],
        authorizationRuleKeys: ["candidate-review-rule"],
        preconditions: ["Exact expected revision, actor, authority, approval, confirmation, policy, evidence, upstream bindings, target state, and idempotency identity are revalidated before commitment"],
        contextRequirements: ["Only bounded exact current records and Source evidence required by the candidate revision contract are selected"],
        outputContract: "Return either a validated immutable candidate revision and authoritative governed-store receipt or an explicit denied, blocked, failed, partial, cancelled, uncertain, or unverified result.",
        evidenceRequirements: ["Requested, attempted, committed, verified, failed, compensated, and unknown effect states remain separate and attributable"],
        effectDescriptors: ["governed-candidate-mutation"],
        idempotencyRule: "The command version, actor scope, canonical target, expected revision, exact payload digest, authorization scope, and validity interval define the idempotency identity.",
        timeoutRetryCancellation: "Retry requires a valid idempotency guarantee or proof that the prior attempt did not commit; cancellation does not claim an in-flight effect stopped.",
        deliveryState: "not-sent",
        executionState: "not-executed",
        authorizationState: "not-granted",
        sources: [reference()],
      }],
      adapters: [{
        key: "governed-context-adapter",
        name: "Governed context external boundary adapter",
        semanticVersion: "1.0.0",
        kind: "external-system",
        boundedContextKeys: ["governance-core", "product-studio"],
        supportedEventTypeKeys: eventTypeKeys,
        supportedCommandKeys: commandKeys,
        supportedContractVersions: ["GAEP candidate contracts 0.1.0 and governed-context external contract 1.0.0"],
        capabilityLimits: ["Candidate mapping and deterministic validation only; no external connection, credential use, delivery, execution, reconciliation, or activation is represented"],
        semanticLosses: ["External identity, time, ordering, transaction, retention, correction, authority, delivery, receipt, and recovery guarantees remain unevaluated"],
        dataHandling: "The definition permits only declared internal candidate metadata under exact classification and minimization constraints; no payload disclosure or provider processing is authorized.",
        effectSemantics: "Requested, attempted, observed, committed, failed, compensated, uncertain, and unverified effects remain distinct and require authoritative receipts and postcondition verification.",
        failureSemantics: "Unsupported identity, authority, data, evidence, effect, ordering, correction, or recovery semantics fail closed or remain explicitly unknown.",
        idempotencyAndRetry: "The adapter must expose actual duplicate-detection and retry guarantees; absent evidence remains unknown and blocks side-effecting retry.",
        evidenceContract: "Any future evaluation must bind exact adapter, environment, external schema, capability, scenario, evaluator, time, limitations, expiry, and invalidating changes.",
        compatibilityState: "unknown",
        evaluationState: "not-established",
        activationState: "not-granted",
        credentialBindingState: "external-reference-only",
        sources: [reference()],
      }],
      externalContracts: [{
        key: "governed-context-contract",
        name: "Governed context external exchange contract",
        semanticVersion: "1.0.0",
        externalSystem: "Candidate external review system",
        namespace: "candidate-governed-context",
        authorityDomain: "Independent external authority domain with no automatic GAEP authority mapping",
        producerBoundedContextKeys: ["governance-core", "product-studio"],
        consumerBoundedContextKeys: ["governance-core", "product-studio"],
        eventTypeKeys,
        commandKeys,
        schemaAndRepresentation: "Strict versioned JSON-compatible candidate representations preserve exact identities, revisions, classification, provenance, ordering limits, mapping fidelity, unsupported semantics, and correction lineage.",
        versioningAndMigration: "Breaking semantics require a new major version plus compatibility, coexistence, migration, rollback, exit, consumer, and historical-interpretation evidence.",
        classification: "internal",
        compatibilityState: "unknown",
        consumerAcceptanceState: "not-established",
        sources: [reference()],
      }],
      mappings: [{
        key: "governed-context-mapping",
        adapterKey: "governed-context-adapter",
        externalContractKey: "governed-context-contract",
        namespaceBinding: "Candidate external review namespace without credentials, tenant activation, or authority transfer",
        rows: [{
          key: "assess-command-map",
          gaepSubjectKey: "assess-candidate-command",
          externalSubject: "candidate.assess.request.v1",
          authority: "gaep",
          direction: "export",
          fidelity: "narrowed",
          conflictRule: "GAEP remains authoritative for exact candidate command identity and payload digest; any conflicting external representation is preserved and escalated without overwrite.",
          timeAndVersionRule: "Bind exact command and schema versions, observation time, recorded time, expected subject revisions, and explicit absence of global ordering.",
          deletionAndRetentionRule: "External deletion, retention, hold, source unavailability, or inaccessible history remains explicit and cannot silently delete or validate GAEP history.",
          effectAndAuthorizationRule: "Export is a material external communication only after a separately current Authorization Grant binds the exact subject, direction, payload, destination, classification, and validity.",
          evidenceRule: "Future evidence must prove exact request mapping and authoritative receipt separately from execution or business outcome.",
          truthClass: "observed",
          sources: [reference()],
        }, {
          key: "finalized-event-map",
          gaepSubjectKey: "candidate-finalized-event",
          externalSubject: "candidate.finalized.event.v1",
          authority: "gaep",
          direction: "export",
          fidelity: "narrowed",
          conflictRule: "The exact GAEP occurrence, when one exists, remains authoritative; external acknowledgement cannot modify or replace it.",
          timeAndVersionRule: "Preserve exact event schema, subject revision, occurrence and recorded times, subject sequence, and declared ordering limitations.",
          deletionAndRetentionRule: "Deletion, redaction, hold, retention, archive, correction, and unavailable-source behavior remain independently governed and visible.",
          effectAndAuthorizationRule: "The definition grants no publication, delivery, disclosure, external effect, or action authority.",
          evidenceRule: "Future delivery evidence must bind exact event identity and recipient receipt without converting transport success into business acceptance.",
          truthClass: "observed",
          sources: [reference()],
        }, {
          key: "review-event-map",
          gaepSubjectKey: "review-requested-event",
          externalSubject: "candidate.review-requested.event.v1",
          authority: "gaep",
          direction: "export",
          fidelity: "narrowed",
          conflictRule: "An external response is a separately attributable assertion and never overwrites the source event, state, approval, or authority record.",
          timeAndVersionRule: "Preserve exact event, subject, cause, correlation, recorded-time, sequence, and ordering-limit semantics.",
          deletionAndRetentionRule: "Retention and deletion divergence creates an explicit reconciliation finding and downstream validity consequence.",
          effectAndAuthorizationRule: "No external communication or approval request is sent by this candidate mapping definition.",
          evidenceRule: "Future evidence distinguishes request occurrence, delivery attempt, receipt, consumer processing, response, and authoritative GAEP disposition.",
          truthClass: "observed",
          sources: [reference()],
        }, {
          key: "revise-command-map",
          gaepSubjectKey: "revise-candidate-command",
          externalSubject: "candidate.revise.request.v1",
          authority: "conditional",
          direction: "bidirectional",
          fidelity: "transformed",
          conflictRule: "Concurrent, divergent, ambiguous, reordered, or partially applied revisions stop for exact conflict preservation and accountable resolution; bidirectional does not imply shared authority.",
          timeAndVersionRule: "Compare exact expected GAEP revision and external version token; stale or missing versions fail closed before any write.",
          deletionAndRetentionRule: "Tombstone, deletion, retention, hold, inaccessible-source, and exit semantics remain explicit and preserve interpretable provenance.",
          effectAndAuthorizationRule: "Any import, export, or synchronization write requires a current exact Authorization Grant and action-time revalidation; source access grants no GAEP authority.",
          evidenceRule: "Future evidence must cover request, actual write, authoritative result, verified postconditions, divergence, duplicate delivery, partial application, replay, and unknown final state.",
          truthClass: "observed",
          sources: [reference()],
        }],
        synchronizationTriggers: ["No trigger is active; any future schedule, event, manual request, or reconciliation trigger requires a separately approved activation record"],
        reconciliationOwnerRoleKey: "initiative-owner",
        divergenceBehavior: "Preserve both exact versions, authority claims, times, mappings, losses, and evidence; stop dependent success and escalate without inventing convergence.",
        duplicateDeliveryBehavior: "Detect by exact idempotency and event identities; retain duplicate evidence and never repeat a material effect without valid guarantees.",
        reorderingBehavior: "Use only declared subject ordering; buffer, reject, or reconcile out-of-order input explicitly without assuming global chronology.",
        partialApplicationBehavior: "Record every applied, unapplied, uncertain, and compensated element separately and block aggregate success until authoritative reconciliation.",
        retryAndReplayBehavior: "Retry or replay requires exact duplicate-safety evidence and bounded policy; repeated identical failure stops rather than fabricating progress.",
        unknownFinalStateBehavior: "Create a reconciliation, containment, or escalation obligation and preserve unknown outcome until an authoritative result and verified postconditions resolve it.",
        credentialBindingState: "not-included",
        evaluationState: "not-established",
        activationState: "not-granted",
        sources: [reference()],
      }],
      routes: [{
        key: "governed-context-route",
        eventTypeKeys,
        commandKeys,
        adapterKey: "governed-context-adapter",
        externalContractKey: "governed-context-contract",
        mappingKey: "governed-context-mapping",
        producerBoundedContextKeys: ["governance-core", "product-studio"],
        consumerBoundedContextKeys: ["governance-core", "product-studio"],
        deliveryGuarantee: "none-declared",
        orderingAndConcurrency: "Only exact subject sequence and expected revisions are declared; cross-system ordering, concurrency, and atomicity remain unknown until evaluated.",
        idempotencyAndDuplicateDetection: "Every future operation must bind exact event or command identity, actor scope, canonical target, payload digest, and validity; unsupported duplicate detection blocks material retry.",
        authoritativeReceiptContract: "Transport acknowledgement is not an authoritative business result; any success requires a version-bound external receipt and verified GAEP postconditions appropriate to the exact contract.",
        timeoutAndUncertainResult: "A timeout after a possible external effect remains uncertain and creates an explicit reconciliation obligation; it is never interpreted as failure, success, or absence of effect.",
        failureAndDegradedBehavior: "Missing authority, identity, compatibility, classification, fidelity, evidence, credential, external service, or control preconditions fail closed or enter an explicitly approved bounded degraded path.",
        deliveryState: "not-attempted",
        externalAcceptanceState: "not-established",
        executionState: "not-executed",
        sources: [reference()],
      }],
      requirementCoverage,
      governance: {
        integrationStewardRoleKeys: ["gaep-steward", "initiative-owner"],
        eventStewardRoleKeys: ["gaep-steward", "initiative-owner"],
        contractReviewerRoleKeys: ["gaep-steward", "initiative-owner"],
        reviewState: "under-challenge",
        eventRegistryApprovalState: "not-granted",
        commandRegistryApprovalState: "not-granted",
        adapterEvaluationState: "not-established",
        externalContractAcceptanceState: "not-established",
        activationState: "not-granted",
        operationalReadinessState: "not-established",
        executionAuthorityState: "not-granted",
        basis: "Named candidate roles may prepare and challenge definitions, but only separately verified eligible human authorities and exact current records can approve registries, accept contracts, evaluate or activate adapters, establish readiness, grant authorization, or authorize execution.",
        sources: [reference()],
      },
      assumptions: ["The selected local Product, Initiative, upstream model revisions, and Source records remain the exact bounded Event and Integration Model scope"],
      inconsistencies: [],
      unresolvedQuestions: [],
      limitations: ["No event occurrence, command send or delivery, external contract acceptance, adapter evaluation or activation, credential binding, Authorization Grant, executed effect, operational readiness, release, deployment, or action authority is represented"],
      ...overrides,
    }
  }

  function failureRecoveryModelInput(
    architecture: SystemSolutionArchitecture,
    boundedContextModel: BoundedContextModel,
    operatingModel: OperatingModel,
    securityPrivacyAssessment: SecurityPrivacyAssessment,
    processModel: ProcessModel,
    dataModel: DataModel,
    authorizationModel: AuthorizationModel,
    eventIntegrationModel: EventIntegrationModel,
    overrides: Partial<FailureRecoveryModelInput> = {},
  ): FailureRecoveryModelInput {
    const failureModeKeys = ["uncertain-candidate-revision"]
    const retryPolicyKeys = ["bounded-candidate-retry"]
    const compensationPlanKeys = ["candidate-revision-compensation"]
    const recoveryPlanKeys = ["candidate-context-recovery"]
    const recoveryEvidenceDefinitionKeys = ["candidate-recovery-evidence"]
    const requirementCoverage = [...failureRecoveryRequirementIds]
      .sort((left, right) => left.localeCompare(right))
      .map((requirementId) => ({
        requirementId,
        state: "covered-candidate" as const,
        failureModeKeys,
        retryPolicyKeys,
        compensationPlanKeys,
        recoveryPlanKeys,
        recoveryEvidenceDefinitionKeys,
        basis: "The candidate maps this exact State, Effect, or Runtime requirement to versioned failure, retry, compensation, recovery, and evidence-definition identities without claiming an actual failure, safe retry, executed compensation, restoration, recovery success, return to service, readiness, or authority.",
        evidence: [reference()],
      }))
    return {
      initiativeId: initiative.id,
      context: context(),
      informationClassification: "internal",
      title: "Candidate governed Failure and Recovery Model",
      scope: "Model explicit candidate failure modes, retry classifications, compensation obligations, recovery paths, and required evidence without representing a failure occurrence, attempted retry, executed compensation, restored state, successful recovery, return-to-service decision, readiness state, or action authority.",
      systemSolutionArchitecture: {
        recordId: architecture.id,
        revision: architecture.revision,
        digest: canonicalDigest(architecture),
      },
      boundedContextModel: {
        recordId: boundedContextModel.id,
        revision: boundedContextModel.revision,
        digest: canonicalDigest(boundedContextModel),
      },
      operatingModel: {
        recordId: operatingModel.id,
        revision: operatingModel.revision,
        digest: canonicalDigest(operatingModel),
      },
      securityPrivacyAssessment: {
        recordId: securityPrivacyAssessment.id,
        revision: securityPrivacyAssessment.revision,
        digest: canonicalDigest(securityPrivacyAssessment),
      },
      processModel: {
        recordId: processModel.id,
        revision: processModel.revision,
        digest: canonicalDigest(processModel),
      },
      dataModel: {
        recordId: dataModel.id,
        revision: dataModel.revision,
        digest: canonicalDigest(dataModel),
      },
      authorizationModel: {
        recordId: authorizationModel.id,
        revision: authorizationModel.revision,
        digest: canonicalDigest(authorizationModel),
      },
      eventIntegrationModel: {
        recordId: eventIntegrationModel.id,
        revision: eventIntegrationModel.revision,
        digest: canonicalDigest(eventIntegrationModel),
      },
      failureModes: [{
        key: "uncertain-candidate-revision",
        name: "Uncertain candidate revision effect",
        category: "uncertain-result",
        affectedProcessKeys: ["governed-context-review"],
        affectedEventTypeKeys: ["candidate-finalized-event", "review-requested-event"],
        affectedCommandKeys: ["assess-candidate-command", "revise-candidate-command"],
        affectedAdapterKeys: ["governed-context-adapter"],
        affectedRouteKeys: ["governed-context-route"],
        affectedDataEntityKeys: ["governed-record", "product-studio-projection"],
        effectDescriptors: ["external-effect", "provisional", "reversible-change"],
        detectionSignals: ["Authoritative receipt is absent after a possible material effect", "Expected version or postcondition cannot be reconciled with the exact governed record"],
        containmentRule: "Stop dependent success, preserve the exact attempted command and observed evidence, quarantine conflicting updates, and do not retry or compensate until authority and effect truth are re-established.",
        propagationBoundary: "The unresolved state propagates only to the exact Product, Initiative, candidate record, external route, and dependent decisions; unrelated records remain separately assessed.",
        userAndBusinessImpact: "Reviewers may see an explicit uncertain candidate state and blocked dependent workflow while no success, failure, approval, readiness, or absence of effect is inferred.",
        explicitNonReversibilityBehavior: "If an external disclosure or irreversible effect may have occurred, preserve the residual effect and evidence, prohibit false rollback claims, and require accountable escalation.",
        retryPolicyKeys,
        compensationPlanKeys,
        recoveryPlanKeys,
        classification: "internal",
        occurrenceState: "definition-only-not-observed",
        sources: [reference()],
      }],
      retryPolicies: [{
        key: "bounded-candidate-retry",
        failureModeKeys,
        commandKeys: ["assess-candidate-command", "revise-candidate-command"],
        adapterKeys: ["governed-context-adapter"],
        authorizationActionKeys: ["assess-candidate", "revise-candidate"],
        failureClassification: "unknown-stop",
        maximumAttempts: 1,
        timeoutAndBackoff: "No automatic retry is permitted while effect truth is unknown; a separately authorized retry starts only after exact reconciliation and uses a bounded deterministic delay.",
        retryCondition: "Retry is eligible only when the prior attempt is authoritatively proven not committed or the exact idempotency guarantee makes duplicate material effects impossible.",
        idempotencyScopeAndKey: "Bind exact command version, actor and authority scope, Product, Initiative, candidate identity, expected revision, payload digest, route, adapter, and validity interval.",
        duplicateEffectRule: "A duplicate identity returns the existing authoritative receipt without repeating a material mutation or external communication.",
        changedConditionRule: "Any changed record, policy, authority, classification, destination, evidence, or idempotency input invalidates the retry candidate and requires a new reviewed request.",
        exhaustionBehavior: "Preserve the final known and unknown effects, block aggregate success, create an explicit recovery obligation, and escalate without synthesizing a failure or success result.",
        retryState: "not-attempted",
        safetyState: "not-established",
        authorizationState: "not-granted",
        sources: [reference()],
      }],
      compensationPlans: [{
        key: "candidate-revision-compensation",
        failureModeKeys,
        originalCommandKeys: ["revise-candidate-command"],
        compensationCommandKeys: ["revise-candidate-command"],
        authorizationActionKeys: ["revise-candidate"],
        affectedDataEntityKeys: ["governed-record", "product-studio-projection"],
        preconditions: ["The original effect, exact prior and resulting revisions, current authority, residual effects, and compensation eligibility are independently verified"],
        compensationSteps: ["Prepare a separately attributable superseding candidate revision that restores only reversible governed state while preserving immutable history and residual effects"],
        verificationPostconditions: ["Verify immutable history, current revision, predecessor chain, audit receipt, unresolved external effects, and every dependent projection against exact digests"],
        residualEffectRule: "External communications, observations, audit history, and irreversible disclosures remain visible residual effects and are never represented as erased by compensation.",
        compensationFailureBehavior: "A failed, partial, denied, cancelled, timed-out, or uncertain compensation remains a new explicit governed result and cannot establish restoration or recovery success.",
        originalEffectBindingRule: "Every compensation request binds the exact original command identity, attempt, actor, authority, subject revision, receipts, observed effects, and unresolved effect boundaries.",
        executionState: "not-executed",
        restorationState: "not-established",
        authorizationState: "not-granted",
        sources: [reference()],
      }],
      recoveryPlans: [{
        key: "candidate-context-recovery",
        failureModeKeys,
        processKeys: ["governed-context-review"],
        routeKeys: ["governed-context-route"],
        ownerRoleKeys: ["gaep-steward", "initiative-owner"],
        authorizationActionKeys: ["assess-candidate", "revise-candidate"],
        lastVerifiedSafeStateRule: "Resolve the last exact Product, Initiative, candidate, audit, authorization, and external receipt state whose digests and postconditions are independently verified.",
        knownAndUncertainEffectsRule: "Inventory requested, attempted, observed, committed, failed, compensated, denied, cancelled, timed-out, and unknown effects separately without collapsing transport into business truth.",
        containmentSteps: ["Freeze dependent candidate transitions and external routes while preserving current records, audit history, evidence, and conflicting observations"],
        reconciliationSteps: ["Compare exact local history, external authoritative receipts, idempotency identities, postconditions, and residual effects under accountable human review"],
        restorationSteps: ["Apply only separately authorized version-bound repairs or compensating revisions, preserving immutable history and every non-reversible residual effect"],
        revalidationRequirements: ["Revalidate identity, authority, policy, classification, evidence freshness, upstream bindings, audit integrity, postconditions, and affected projections"],
        resumeConditions: ["Resume only after separately accepted recovery evidence establishes exact postconditions and an eligible human grants return-to-service authority for the unchanged scope"],
        degradedModeBehavior: "Any degraded path is explicit, narrow, time-bounded, observable, reversible where possible, independently authorized, and cannot imply normal readiness.",
        manualModeBehavior: "Manual steps require attributable eligible humans, exact instructions, two-person challenge where policy requires, authoritative receipts, and postcondition verification.",
        quarantineAndRevocationBehavior: "Quarantine affected routes, revoke stale credentials or grants through their authoritative systems, preserve evidence, and record any unverified revocation as unresolved.",
        residualRiskRule: "Document remaining irreversible, external, privacy, integrity, availability, authority, evidence, and interpretation risks; acceptance remains separate and not established.",
        recoveryState: "not-started",
        successState: "not-established",
        returnToServiceState: "not-authorized",
        sources: [reference()],
      }],
      recoveryEvidenceDefinitions: [{
        key: "candidate-recovery-evidence",
        recoveryPlanKey: "candidate-context-recovery",
        requiredEvidenceTypes: ["audit-chain-verification", "authoritative-effect-receipt", "postcondition-verification", "residual-risk-review"],
        authoritativeReceiptRule: "Receipts must bind exact command, attempt, subject, prior and resulting revisions, actor, authority, system, environment, effect, time, integrity, and provider result.",
        postconditionVerificationRule: "An independent read verifies expected governed records, immutable history, audit continuity, external state where applicable, and every declared invariant against exact digests.",
        reconciliationRule: "All local and external observations are retained with authority, time, ordering, version, fidelity, and uncertainty before an accountable reviewer can assess convergence.",
        residualRiskRule: "Accepted evidence must enumerate unresolved irreversible, external, security, privacy, integrity, availability, authority, and evidence risks without treating acceptance as readiness.",
        custodyIntegrityAndRetention: "Evidence requires attributable origin, collection time, content digest, chain of custody, classification, access controls, retention rule, and invalidation or expiry conditions.",
        evidenceState: "definition-only-not-collected",
        acceptanceState: "not-established",
        sources: [reference()],
      }],
      requirementCoverage,
      governance: {
        failureModelStewardRoleKeys: ["gaep-steward", "initiative-owner"],
        recoveryOwnerRoleKeys: ["gaep-steward", "initiative-owner"],
        recoveryVerifierRoleKeys: ["gaep-steward", "initiative-owner"],
        reviewState: "under-challenge",
        failureRegistryApprovalState: "not-granted",
        retrySafetyState: "not-established",
        compensationApprovalState: "not-granted",
        recoveryPlanApprovalState: "not-granted",
        recoveryEvidenceAcceptanceState: "not-established",
        operationalReadinessState: "not-established",
        returnToServiceAuthorityState: "not-granted",
        executionAuthorityState: "not-granted",
        basis: "Named candidate roles may prepare and challenge definitions, but only separately verified eligible human authorities and exact current records can approve registries, establish retry safety, authorize compensation, accept recovery evidence, establish readiness, grant return to service, or authorize execution.",
        sources: [reference()],
      },
      assumptions: ["The selected local Product, Initiative, upstream model revisions, and Source records remain the exact bounded Failure and Recovery Model scope"],
      inconsistencies: [],
      unresolvedQuestions: [],
      limitations: ["No failure occurrence, retry attempt or safety determination, compensation execution or restoration, recovered state, accepted recovery evidence, operational readiness, return-to-service decision, release, deployment, or action authority is represented"],
      ...overrides,
    }
  }

  function architectureChallengeModelInput(
    architecture: SystemSolutionArchitecture,
    boundedContextModel: BoundedContextModel,
    operatingModel: OperatingModel,
    securityPrivacyAssessment: SecurityPrivacyAssessment,
    processModel: ProcessModel,
    dataModel: DataModel,
    authorizationModel: AuthorizationModel,
    eventIntegrationModel: EventIntegrationModel,
    failureRecoveryModel: FailureRecoveryModel,
    overrides: Partial<ArchitectureChallengeModelInput> = {},
  ): ArchitectureChallengeModelInput {
    const challengeSubjectKeys = ["shared-engine-decision"]
    const assumptionKeys = ["host-launch-compatibility"]
    const alternativeKeys = ["host-local-semantics", "shared-governed-engine"]
    const findingKeys = ["shared-failure-domain"]
    const responseKeys = ["shared-failure-domain-response"]
    const requirementCoverage = [...architectureChallengeRequirementIds]
      .sort((left, right) => left.localeCompare(right))
      .map((requirementId) => ({
        requirementId,
        state: "covered-candidate" as const,
        challengeSubjectKeys,
        assumptionKeys,
        alternativeKeys,
        findingKeys,
        responseKeys,
        basis: "The candidate maps this exact Architecture, Assurance, or Review requirement to versioned challenge subjects, assumptions, alternatives, findings, responses, independence limits, and evidence without claiming completed independent review, assurance, risk acceptance, architecture approval, readiness, or authority.",
        evidence: [reference()],
      }))
    return {
      initiativeId: initiative.id,
      context: context(),
      informationClassification: "internal",
      title: "Candidate governed Architecture Challenge",
      scope: "Challenge the exact shared governed-engine boundary, assumptions, alternatives, trade-offs, failure modes, evidence, independence, and downstream consequences without converting a recommendation or response into assurance, risk acceptance, architecture approval, operational readiness, or action authority.",
      systemSolutionArchitecture: { recordId: architecture.id, revision: architecture.revision, digest: canonicalDigest(architecture) },
      boundedContextModel: { recordId: boundedContextModel.id, revision: boundedContextModel.revision, digest: canonicalDigest(boundedContextModel) },
      operatingModel: { recordId: operatingModel.id, revision: operatingModel.revision, digest: canonicalDigest(operatingModel) },
      securityPrivacyAssessment: { recordId: securityPrivacyAssessment.id, revision: securityPrivacyAssessment.revision, digest: canonicalDigest(securityPrivacyAssessment) },
      processModel: { recordId: processModel.id, revision: processModel.revision, digest: canonicalDigest(processModel) },
      dataModel: { recordId: dataModel.id, revision: dataModel.revision, digest: canonicalDigest(dataModel) },
      authorizationModel: { recordId: authorizationModel.id, revision: authorizationModel.revision, digest: canonicalDigest(authorizationModel) },
      eventIntegrationModel: { recordId: eventIntegrationModel.id, revision: eventIntegrationModel.revision, digest: canonicalDigest(eventIntegrationModel) },
      failureRecoveryModel: { recordId: failureRecoveryModel.id, revision: failureRecoveryModel.revision, digest: canonicalDigest(failureRecoveryModel) },
      challengeSubjects: [{
        key: "shared-engine-decision",
        subjectKind: "architecture-decision",
        decisionQuestion: "Should every native Product Studio host delegate governed Product semantics and persistence to one shared local engine, despite the larger correlated failure domain?",
        triggerContext: "The candidate System/Solution Architecture selects one shared governed engine across four native hosts and therefore requires explicit alternatives, failure-mode, independence, and downstream-consequence challenge.",
        consequence: "high",
        architectureConcernKeys: ["governed-system-boundary"],
        architectureDecisionKeys: ["shared-engine-boundary"],
        architectureElementKeys: ["gaep-engine", "product-studio-host", "workspace-store"],
        architectureViewKeys: ["governed-system-context"],
        qualityScenarioKeys: ["audit-integrity", "host-response-integrity"],
        boundedContextKeys: ["governance-core", "product-studio"],
        failureModeKeys: ["uncertain-candidate-revision"],
        affectedImplementationUnits: ["All four native Product Studio host adapters and the shared governed engine"],
        downstreamConsequences: ["A shared-engine contract or persistence failure can affect every host and requires bounded compatibility, recovery, and independent review evidence"],
        classification: "internal",
        sources: [reference()],
      }],
      assumptions: [{
        key: "host-launch-compatibility",
        challengeSubjectKeys,
        statement: "Every supported native host can launch or connect to the exact packaged shared engine while preserving strict protocol and governed-store semantics.",
        status: "supported-candidate",
        falsificationConditions: ["A supported host cannot execute the exact packaged engine or cannot preserve the strict request, response, and repository contracts"],
        supportingEvidence: [reference()],
        counterEvidence: [reference()],
        residualUncertainty: "Native supported-platform interaction, signing, installation, upgrade, accessibility, live-provider behavior, and Product Owner acceptance remain outside current local evidence.",
      }],
      alternatives: [{
        key: "host-local-semantics",
        challengeSubjectKeys,
        name: "Host-local governed semantics",
        description: "Each native host implements and persists Product semantics independently behind a shared conceptual contract.",
        benefits: ["Host-specific implementation and deployment independence"],
        tradeoffs: ["Four authority-bearing implementations require separate migration, audit, portability, and semantic-parity evidence"],
        risks: ["Host-local behavior can silently diverge in governance, privacy, state, or authority semantics"],
        architectureElementKeys: ["product-studio-host", "workspace-store"],
        boundedContextKeys: ["product-studio"],
        failureModeKeys: ["uncertain-candidate-revision"],
        recommendationState: "not-recommended",
        dispositionState: "candidate-unresolved",
        sources: [reference()],
      }, {
        key: "shared-governed-engine",
        challengeSubjectKeys,
        name: "Shared governed engine",
        description: "Every native host delegates Product semantics and governed persistence to one strict versioned engine contract.",
        benefits: ["Exact cross-host semantics and one attributable governed-store boundary"],
        tradeoffs: ["All hosts depend on shared protocol, packaging, compatibility, and recovery behavior"],
        risks: ["A shared engine defect or incompatible package can affect every supported host"],
        architectureElementKeys: ["gaep-engine", "product-studio-host", "workspace-store"],
        boundedContextKeys: ["governance-core", "product-studio"],
        failureModeKeys: ["uncertain-candidate-revision"],
        recommendationState: "candidate-preferred",
        dispositionState: "candidate-unresolved",
        sources: [reference()],
      }],
      findings: [{
        key: "shared-failure-domain",
        challengeSubjectKeys,
        challengerKind: "ai",
        challengerId: "codex-architecture-challenger",
        challengerRoleKeys: ["gaep-steward"],
        concern: "The shared engine reduces semantic drift but concentrates validation, persistence, packaging, compatibility, and recovery risk across every host.",
        evidence: [reference()],
        consequence: "A correlated engine or protocol defect could block governed Product workflows across four hosts while a host-local design would isolate some failures at the cost of semantic divergence.",
        severity: "high",
        alternativeKeys,
        requestedClarifications: ["Define which native-host and package evidence is required before a separately authorized architecture approval may be considered"],
        limitations: ["The AI challenger is not an independent human reviewer and cannot approve architecture or accept risk"],
        findingState: "open-candidate",
        independenceState: "not-established",
      }],
      responses: [{
        key: "shared-failure-domain-response",
        findingKeys,
        responderRoleKeys: ["initiative-owner"],
        responseType: "acknowledge",
        response: "Retain the shared-engine candidate while requiring strict host parsers, exact package evidence, immutable history, bounded failure behavior, and separate native acceptance before any architecture approval request.",
        rationale: "Current local evidence supports semantic centralization, but the correlated failure domain and missing native acceptance remain explicit unresolved decision inputs.",
        resultingTraceOrStateChange: "The challenge remains an open candidate input; no Architecture Decision, Approval Determination, Risk Acceptance, readiness state, or Authorization Grant is created.",
        dispositionState: "candidate-not-decided",
        decisionAuthorityState: "not-granted",
        sources: [reference()],
      }],
      independence: {
        authorRoleKeys: ["initiative-owner"],
        challengerRoleKeys: ["gaep-steward"],
        reviewerRoleKeys: ["gaep-steward", "initiative-owner"],
        disclosedRoleOverlaps: ["The GAEP steward both maintains the engine boundary and authors this AI-assisted challenge evidence"],
        sharedSourceDependencies: ["The architecture candidate and challenge rely on the same local repository and Source revision"],
        sharedMethodToolOrModelDependencies: ["The current challenge and implementation were prepared through the same Codex task context"],
        conflictsOfInterest: ["The implementation author benefits from retaining the implemented shared-engine design"],
        compensatingControls: ["Require a separately assigned qualified human reviewer and exact native-host evidence before an approval case is assembled"],
        requiredSeparation: "Architecture approval and material risk acceptance require independently verified eligible humans who did not generate the candidate recommendation and who can inspect the exact evidence and limitations.",
        assessmentState: "not-established",
        sources: [reference()],
      },
      requirementCoverage,
      governance: {
        challengeOwnerRoleKeys: ["initiative-owner"],
        challengerRoleKeys: ["gaep-steward"],
        responseOwnerRoleKeys: ["initiative-owner"],
        reviewState: "under-challenge",
        challengeCompletionState: "not-established",
        independenceState: "not-established",
        assuranceState: "not-established",
        riskAcceptanceState: "not-granted",
        architectureApprovalState: "not-granted",
        operationalReadinessState: "not-established",
        actionAuthorityState: "not-granted",
        basis: "Named candidate roles may author, challenge, and respond, but only separately verified eligible human authorities and exact current evidence can complete independent review, establish assurance, accept risk, approve architecture, establish readiness, or authorize action.",
        sources: [reference()],
      },
      inconsistencies: [],
      unresolvedQuestions: [],
      limitations: ["No completed independent challenge, assurance conclusion, risk acceptance, architecture approval, native-host acceptance, operational readiness, release, deployment, or action authority is represented"],
      ...overrides,
    }
  }

  async function createArchitectureAndBoundedContext() {
    const { business, stakeholder, outcome } = await createCompleteModel()
    const capabilityMap = await engine.businessCapabilityMap.create(
      capabilityMapInput(business, stakeholder, outcome), actorId,
    )
    const valueStreamModel = await engine.valueStreamModel.create(
      valueStreamInput(business, stakeholder, outcome, capabilityMap), actorId,
    )
    const operatingModel = await engine.operatingModel.create(
      operatingModelInput(business, stakeholder, outcome, capabilityMap, valueStreamModel), actorId,
    )
    const businessRuleCatalog = await engine.businessRuleCatalog.create(
      businessRuleCatalogInput(business, stakeholder, outcome, capabilityMap, valueStreamModel, operatingModel), actorId,
    )
    const baseline = await engine.businessArchitectureBaseline.create(
      businessArchitectureBaselineInput(
        business, stakeholder, outcome, capabilityMap, valueStreamModel, operatingModel, businessRuleCatalog,
      ),
      actorId,
    )
    const architecture = await engine.systemSolutionArchitecture.create(
      systemSolutionArchitectureInput(baseline), actorId,
    )
    const boundedContextModel = await engine.boundedContextModel.create(
      boundedContextModelInput(architecture), actorId,
    )
    return {
      business,
      stakeholder,
      outcome,
      capabilityMap,
      valueStreamModel,
      operatingModel,
      businessRuleCatalog,
      baseline,
      architecture,
      boundedContextModel,
    }
  }

  async function createAuthorizationUpstream() {
    const upstream = await createArchitectureAndBoundedContext()
    const securityPrivacyAssessment = await engine.securityPrivacyAssessment.create(
      securityPrivacyAssessmentInput(upstream.boundedContextModel), actorId,
    )
    const processModel = await engine.processModel.create(
      processModelInput(
        upstream.valueStreamModel,
        upstream.operatingModel,
        upstream.businessRuleCatalog,
        upstream.boundedContextModel,
        securityPrivacyAssessment,
      ),
      actorId,
    )
    const dataModel = await engine.dataModel.create(
      dataModelInput(
        upstream.architecture,
        upstream.boundedContextModel,
        upstream.operatingModel,
        securityPrivacyAssessment,
        processModel,
      ),
      actorId,
    )
    return { ...upstream, securityPrivacyAssessment, processModel, dataModel }
  }

  async function createEventIntegrationUpstream() {
    const upstream = await createAuthorizationUpstream()
    const authorizationModel = await engine.authorizationModel.create(
      authorizationModelInput(
        upstream.architecture,
        upstream.boundedContextModel,
        upstream.operatingModel,
        upstream.securityPrivacyAssessment,
        upstream.processModel,
        upstream.dataModel,
      ),
      actorId,
    )
    return { ...upstream, authorizationModel }
  }

  async function createFailureRecoveryUpstream() {
    const upstream = await createEventIntegrationUpstream()
    const eventIntegrationModel = await engine.eventIntegrationModel.create(
      eventIntegrationModelInput(
        upstream.architecture,
        upstream.boundedContextModel,
        upstream.operatingModel,
        upstream.securityPrivacyAssessment,
        upstream.processModel,
        upstream.dataModel,
        upstream.authorizationModel,
      ),
      actorId,
    )
    return { ...upstream, eventIntegrationModel }
  }

  async function createArchitectureChallengeUpstream() {
    const upstream = await createFailureRecoveryUpstream()
    const failureRecoveryModel = await engine.failureRecoveryModel.create(
      failureRecoveryModelInput(
        upstream.architecture, upstream.boundedContextModel, upstream.operatingModel,
        upstream.securityPrivacyAssessment, upstream.processModel, upstream.dataModel,
        upstream.authorizationModel, upstream.eventIntegrationModel,
      ),
      actorId,
    )
    return { ...upstream, failureRecoveryModel }
  }

  it("persists exact versioned candidate context and reports a complete-for-review assessment", async () => {
    const { business, stakeholder, outcome } = await createCompleteModel()

    expect(await engine.businessUnderstanding.assess(initiative.id)).toMatchObject({
      businessUnderstanding: businessReference(business),
      stakeholderModel: stakeholderReference(stakeholder),
      outcomeModel: { recordId: outcome.id, revision: 1, digest: canonicalDigest(outcome) },
      stakeholderCount: 1,
      representedStakeholderCategoryCount: 1,
      unresolvedStakeholderCategoryCount: 0,
      verifiedAuthorityCount: 0,
      unverifiedAuthorityCount: 0,
      outcomeCount: 1,
      measureCount: 2,
      observedBaselineCount: 2,
      unresolvedQuestionCount: 0,
      blockingQuestionCount: 0,
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      state: "complete-for-review",
      reasons: [],
    })
    expect(await engine.businessUnderstanding.listBusinessUnderstandingHistory(business.id)).toHaveLength(1)
    expect(await engine.businessUnderstanding.listStakeholderModelHistory(stakeholder.id)).toHaveLength(1)
    expect(await engine.businessUnderstanding.listOutcomeModelHistory(outcome.id)).toHaveLength(1)

    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as {
        eventType: string
        payload: Record<string, unknown>
      })
    expect(events.find((event) => event.eventType === "business.understanding.created")?.payload)
      .toMatchObject({ revision: 1, recordDigest: canonicalDigest(business), state: "candidate" })
    expect(events.find((event) => event.eventType === "business.stakeholders.created")?.payload)
      .toMatchObject({ revision: 1, recordDigest: canonicalDigest(stakeholder), state: "candidate" })
    expect(events.find((event) => event.eventType === "business.outcomes.created")?.payload)
      .toMatchObject({ revision: 1, recordDigest: canonicalDigest(outcome), state: "candidate" })
  })

  it("keeps immutable predecessor history and exposes stale upstream bindings after revision", async () => {
    const { business } = await createCompleteModel()
    const revised = await engine.businessUnderstanding.reviseBusinessUnderstanding(
      business.id,
      business.revision,
      businessInput({
        limitations: ["A realistic participant study and external authority review remain outstanding."],
      }),
      actorId,
    )

    expect(revised).toMatchObject({
      id: business.id,
      revision: 2,
      predecessorDigest: canonicalDigest(business),
      state: "candidate",
    })
    expect((await engine.businessUnderstanding.listBusinessUnderstandingHistory(business.id))
      .map((record) => record.revision)).toEqual([2, 1])
    expect(await engine.businessUnderstanding.assess(initiative.id)).toMatchObject({
      staleBindingCount: 2,
      state: "attention-required",
    })
  })

  it("detects superseded Source references without invalidating their exact historical identity", async () => {
    await createCompleteModel()
    source = await engine.sourceGovernance.reviseSource(
      source.id,
      source.revision,
      sourceInput({
        revisionIdentity: { kind: "resource-revision", value: "DISCOVERY-001@2" },
        contentDigest: digest("b"),
      }),
      actorId,
    )

    expect(await engine.businessUnderstanding.assess(initiative.id)).toMatchObject({
      staleSourceReferenceCount: 1,
      state: "attention-required",
    })
    expect((await engine.workspaceHealth()).issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "business.binding-review-required", severity: "warning" }),
    ]))
  })

  it("projects only bounded identity, count, status, and digest metadata", async () => {
    const { business, stakeholder, outcome } = await createCompleteModel()
    const projection = await engine.businessUnderstanding.project(initiative.id)

    expect(projection).toMatchObject({
      assessment: { state: "complete-for-review" },
      businessUnderstanding: { id: business.id, objectiveCount: 1, glossaryTermCount: 1 },
      stakeholderModel: { id: stakeholder.id, stakeholderCount: 1, representedCategoryCount: 1 },
      outcomeModel: { id: outcome.id, outcomeCount: 1, measureCount: 2, countermetricCount: 1 },
      privacyBoundary: expect.stringContaining("not-business-narrative"),
      authorityBoundary: expect.stringContaining("does-not-approve"),
    })
    const serialized = JSON.stringify(projection)
    expect(serialized).not.toContain("Teams cannot independently reconstruct")
    expect(serialized).not.toContain("pilot-user")
    expect(projection.snapshotDigest).toBe(canonicalDigest({
      ...projection,
      snapshotDigest: undefined,
    }))
  })

  it("governs an exact immutable Business Capability Map and projects privacy-safe counts", async () => {
    const { business, stakeholder, outcome } = await createCompleteModel()
    const map = await engine.businessCapabilityMap.create(
      capabilityMapInput(business, stakeholder, outcome),
      actorId,
    )

    expect(await engine.businessCapabilityMap.assess(initiative.id)).toMatchObject({
      capabilityMap: { recordId: map.id, revision: 1, digest: canonicalDigest(map) },
      capabilityCount: 1,
      ownedCapabilityCount: 1,
      unownedCapabilityCount: 0,
      objectiveCoverageCount: 1,
      outcomeCoverageCount: 1,
      openGapCount: 0,
      criticalGapCount: 0,
      unknownCurrentMaturityCount: 0,
      unassessedPriorityCount: 0,
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      state: "complete-for-review",
      reasons: [],
    })
    const projection = await engine.businessCapabilityMap.project(initiative.id)
    expect(projection).toMatchObject({
      capabilityMap: {
        id: map.id,
        revision: 1,
        capabilityCount: 1,
        ownedCapabilityCount: 1,
        openGapCount: 0,
        candidatePriorityCount: 1,
      },
      privacyBoundary: expect.stringContaining("not-capability-narrative"),
      authorityBoundary: expect.stringContaining("does-not-approve"),
    })
    expect(JSON.stringify(projection)).not.toContain("Governed context continuity")
    expect(projection.snapshotDigest).toBe(canonicalDigest({ ...projection, snapshotDigest: undefined }))

    const revised = await engine.businessCapabilityMap.revise(
      map.id,
      map.revision,
      capabilityMapInput(business, stakeholder, outcome, {
        limitations: ["A realistic Product Owner acceptance workflow remains outstanding."],
      }),
      actorId,
    )
    expect(revised).toMatchObject({
      id: map.id,
      revision: 2,
      predecessorDigest: canonicalDigest(map),
      state: "candidate",
    })
    expect((await engine.businessCapabilityMap.listHistory(map.id)).map((record) => record.revision))
      .toEqual([2, 1])
    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as {
        eventType: string
        payload: Record<string, unknown>
      })
    expect(events.at(-1)).toMatchObject({
      eventType: "business.capability-map.revised",
      payload: {
        revision: 2,
        recordDigest: canonicalDigest(revised),
        predecessorDigest: canonicalDigest(map),
        state: "candidate",
        authorityBoundary: expect.stringContaining("does-not-approve"),
      },
    })
  })

  it("governs an exact immutable Value Stream Model and projects privacy-safe flow counts", async () => {
    const { business, stakeholder, outcome } = await createCompleteModel()
    const capabilityMap = await engine.businessCapabilityMap.create(
      capabilityMapInput(business, stakeholder, outcome),
      actorId,
    )
    const model = await engine.valueStreamModel.create(
      valueStreamInput(business, stakeholder, outcome, capabilityMap),
      actorId,
    )

    expect(await engine.valueStreamModel.assess(initiative.id)).toMatchObject({
      valueStreamModel: { recordId: model.id, revision: 1, digest: canonicalDigest(model) },
      valueStreamCount: 1,
      ownedValueStreamCount: 1,
      unownedValueStreamCount: 0,
      stageCount: 1,
      dependencyCount: 0,
      capabilityCoverageCount: 1,
      outcomeCoverageCount: 1,
      absentFlowEvidenceCount: 0,
      openBottleneckCount: 0,
      criticalBottleneckCount: 0,
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      state: "complete-for-review",
      reasons: [],
    })
    const projection = await engine.valueStreamModel.project(initiative.id)
    expect(projection).toMatchObject({
      valueStreamModel: {
        id: model.id,
        revision: 1,
        valueStreamCount: 1,
        ownedValueStreamCount: 1,
        stageCount: 1,
        dependencyCount: 0,
        openBottleneckCount: 0,
      },
      privacyBoundary: expect.stringContaining("not-value-stream-narrative"),
      authorityBoundary: expect.stringContaining("does-not-approve"),
    })
    expect(JSON.stringify(projection)).not.toContain("Governed context delivery")
    expect(projection.snapshotDigest).toBe(canonicalDigest({ ...projection, snapshotDigest: undefined }))

    const revised = await engine.valueStreamModel.revise(
      model.id,
      model.revision,
      valueStreamInput(business, stakeholder, outcome, capabilityMap, {
        limitations: ["A realistic end-to-end stakeholder flow review remains outstanding."],
      }),
      actorId,
    )
    expect(revised).toMatchObject({
      id: model.id,
      revision: 2,
      predecessorDigest: canonicalDigest(model),
      state: "candidate",
    })
    expect((await engine.valueStreamModel.listHistory(model.id)).map((record) => record.revision))
      .toEqual([2, 1])
  })

  it("rejects hostile Value Stream graphs and reports stale capability-map bindings", async () => {
    const { business, stakeholder, outcome } = await createCompleteModel()
    const capabilityMap = await engine.businessCapabilityMap.create(
      capabilityMapInput(business, stakeholder, outcome),
      actorId,
    )
    const base = valueStreamInput(business, stakeholder, outcome, capabilityMap)
    expect(() => valueStreamModelInputSchema.parse({
      ...base,
      valueStreams: [{
        ...base.valueStreams[0]!,
        dependencyKeys: ["missing-stream"],
      }],
    })).toThrow(/dependencies must reference/)
    expect(() => valueStreamModelInputSchema.parse({
      ...base,
      valueStreams: [{
        ...base.valueStreams[0]!,
        purpose: "api_key=sk-live-abcdefghijklmnopqrstuvwxyz123456 is not portable flow context",
      }],
    })).toThrow(/secret-shaped/)

    await expect(engine.valueStreamModel.create({
      ...base,
      valueStreams: [{
        ...base.valueStreams[0]!,
        capabilityKeys: ["invented-capability"],
        stages: [{
          ...base.valueStreams[0]!.stages[0]!,
          capabilityKeys: ["invented-capability"],
        }],
      }],
    }, actorId)).rejects.toThrow(/exact bound Business Capability Map/)

    const model = await engine.valueStreamModel.create(base, actorId)
    await engine.businessCapabilityMap.revise(
      capabilityMap.id,
      capabilityMap.revision,
      capabilityMapInput(business, stakeholder, outcome, {
        limitations: ["The exact capability-map revision changed after value-stream modeling."],
      }),
      actorId,
    )
    expect(await engine.valueStreamModel.assess(initiative.id)).toMatchObject({
      valueStreamModel: { recordId: model.id },
      staleBindingCount: 1,
      state: "attention-required",
    })
  })

  it("governs an exact immutable Operating Model and projects privacy-safe structural counts", async () => {
    const { business, stakeholder, outcome } = await createCompleteModel()
    const capabilityMap = await engine.businessCapabilityMap.create(
      capabilityMapInput(business, stakeholder, outcome),
      actorId,
    )
    const valueStreamModel = await engine.valueStreamModel.create(
      valueStreamInput(business, stakeholder, outcome, capabilityMap),
      actorId,
    )
    const model = await engine.operatingModel.create(
      operatingModelInput(business, stakeholder, outcome, capabilityMap, valueStreamModel),
      actorId,
    )

    expect(await engine.operatingModel.assess(initiative.id)).toMatchObject({
      operatingModel: { recordId: model.id, revision: 1, digest: canonicalDigest(model) },
      roleCount: 2,
      governanceSystemCount: 2,
      unassignedAppointingAuthorityCount: 0,
      insufficientCapacityCount: 0,
      unfundedCapacityCount: 0,
      decisionRightCount: 2,
      unassignedDecisionAuthorityCount: 0,
      forumCount: 1,
      cycleCount: 1,
      supportCapacityGapCount: 0,
      emergencyAuthorityGapCount: 0,
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      state: "complete-for-review",
      reasons: [],
    })
    const projection = await engine.operatingModel.project(initiative.id)
    expect(projection).toMatchObject({
      operatingModel: {
        id: model.id,
        revision: 1,
        roleCount: 2,
        decisionRightCount: 2,
        forumCount: 1,
        cycleCount: 1,
      },
      privacyBoundary: expect.stringContaining("not-operating-narrative"),
      authorityBoundary: expect.stringContaining("does-not-appoint"),
    })
    expect(JSON.stringify(projection)).not.toContain("Candidate GAEP specification steward")
    expect(projection.snapshotDigest).toBe(canonicalDigest({ ...projection, snapshotDigest: undefined }))

    const revised = await engine.operatingModel.revise(
      model.id,
      model.revision,
      operatingModelInput(business, stakeholder, outcome, capabilityMap, valueStreamModel, {
        limitations: ["A realistic organization, funded capacity, and Product Owner acceptance remain outstanding"],
      }),
      actorId,
    )
    expect(revised).toMatchObject({
      id: model.id,
      revision: 2,
      predecessorDigest: canonicalDigest(model),
      state: "candidate",
    })
    expect((await engine.operatingModel.listHistory(model.id)).map((record) => record.revision)).toEqual([2, 1])
  })

  it("rejects hostile Operating Model authority and trace bindings and reports stale Value Stream bindings", async () => {
    const { business, stakeholder, outcome } = await createCompleteModel()
    const capabilityMap = await engine.businessCapabilityMap.create(
      capabilityMapInput(business, stakeholder, outcome),
      actorId,
    )
    const valueStreamModel = await engine.valueStreamModel.create(
      valueStreamInput(business, stakeholder, outcome, capabilityMap),
      actorId,
    )
    const base = operatingModelInput(business, stakeholder, outcome, capabilityMap, valueStreamModel)
    await expect(engine.operatingModel.create({
      ...base,
      roles: base.roles.map((role) => ({ ...role, governanceSystem: "gaep-governance" as const })),
    }, actorId)).rejects.toThrow(/distinguish GAEP governance/)
    await expect(engine.operatingModel.create({
      ...base,
      roles: [{ ...base.roles[0]!, stakeholderKeys: ["invented-stakeholder"] }, base.roles[1]!],
    }, actorId)).rejects.toThrow(/exact bound Stakeholder Model/)
    await expect(engine.operatingModel.create({
      ...base,
      supportModel: {
        ...base.supportModel,
        fallback: "api_key=sk-live-abcdefghijklmnopqrstuvwxyz123456 is not portable operating context",
      },
    }, actorId)).rejects.toThrow(/secret-shaped/)

    const model = await engine.operatingModel.create(base, actorId)
    await engine.valueStreamModel.revise(
      valueStreamModel.id,
      valueStreamModel.revision,
      valueStreamInput(business, stakeholder, outcome, capabilityMap, {
        limitations: ["The exact Value Stream Model changed after operating-model capture"],
      }),
      actorId,
    )
    expect(await engine.operatingModel.assess(initiative.id)).toMatchObject({
      operatingModel: { recordId: model.id },
      staleBindingCount: 1,
      state: "attention-required",
    })
  })

  it("governs an exact immutable Business Rule Catalog and projects privacy-safe coverage counts", async () => {
    const { business, stakeholder, outcome } = await createCompleteModel()
    const capabilityMap = await engine.businessCapabilityMap.create(
      capabilityMapInput(business, stakeholder, outcome),
      actorId,
    )
    const valueStreamModel = await engine.valueStreamModel.create(
      valueStreamInput(business, stakeholder, outcome, capabilityMap),
      actorId,
    )
    const operatingModel = await engine.operatingModel.create(
      operatingModelInput(business, stakeholder, outcome, capabilityMap, valueStreamModel),
      actorId,
    )
    const catalog = await engine.businessRuleCatalog.create(
      businessRuleCatalogInput(business, stakeholder, outcome, capabilityMap, valueStreamModel, operatingModel),
      actorId,
    )

    expect(await engine.businessRuleCatalog.assess(initiative.id)).toMatchObject({
      businessRuleCatalog: { recordId: catalog.id, revision: 1, digest: canonicalDigest(catalog) },
      ruleCount: 1,
      sourceBackedRuleCount: 1,
      nonExceptionableRuleCount: 0,
      enforcementTargetCount: 1,
      unassignedEnforcementTargetCount: 0,
      unverifiedEnforcementTargetCount: 0,
      exceptionCount: 1,
      unassignedExceptionAuthorityCount: 0,
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      state: "complete-for-review",
      reasons: [],
    })
    const projection = await engine.businessRuleCatalog.project(initiative.id)
    expect(projection).toMatchObject({
      businessRuleCatalog: {
        id: catalog.id,
        revision: 1,
        ruleCount: 1,
        enforcementTargetCount: 1,
        exceptionCount: 1,
        nonExceptionableRuleCount: 0,
      },
      privacyBoundary: expect.stringContaining("not-rule-narrative"),
      authorityBoundary: expect.stringContaining("does-not-evaluate-policy"),
    })
    expect(JSON.stringify(projection)).not.toContain("Candidate context is eligible")
    expect(projection.snapshotDigest).toBe(canonicalDigest({ ...projection, snapshotDigest: undefined }))

    const revised = await engine.businessRuleCatalog.revise(
      catalog.id,
      catalog.revision,
      businessRuleCatalogInput(business, stakeholder, outcome, capabilityMap, valueStreamModel, operatingModel, {
        limitations: ["A realistic domain-expert review and Product Owner acceptance remain outstanding"],
      }),
      actorId,
    )
    expect(revised).toMatchObject({
      id: catalog.id,
      revision: 2,
      predecessorDigest: canonicalDigest(catalog),
      state: "candidate",
    })
    expect((await engine.businessRuleCatalog.listHistory(catalog.id)).map((record) => record.revision)).toEqual([2, 1])
    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
    expect(events.at(-1)).toMatchObject({
      eventType: "business.rule-catalog.revised",
      payload: {
        revision: 2,
        recordDigest: canonicalDigest(revised),
        predecessorDigest: canonicalDigest(catalog),
        state: "candidate",
        authorityBoundary: expect.stringContaining("does-not-evaluate-policy"),
      },
    })
  })

  it("rejects hostile Business Rule authority and trace bindings and reports stale Operating Model bindings", async () => {
    const { business, stakeholder, outcome } = await createCompleteModel()
    const capabilityMap = await engine.businessCapabilityMap.create(
      capabilityMapInput(business, stakeholder, outcome),
      actorId,
    )
    const valueStreamModel = await engine.valueStreamModel.create(
      valueStreamInput(business, stakeholder, outcome, capabilityMap),
      actorId,
    )
    const operatingModel = await engine.operatingModel.create(
      operatingModelInput(business, stakeholder, outcome, capabilityMap, valueStreamModel),
      actorId,
    )
    const base = businessRuleCatalogInput(
      business,
      stakeholder,
      outcome,
      capabilityMap,
      valueStreamModel,
      operatingModel,
    )
    expect(() => businessRuleCatalogInputSchema.parse({
      ...base,
      rules: [{ ...base.rules[0]!, enforcementTargetKeys: ["missing-target"] }],
    })).toThrow(/recorded enforcement targets/)
    expect(() => businessRuleCatalogInputSchema.parse({
      ...base,
      rules: [{ ...base.rules[0]!, exceptionBehavior: "not-exceptionable" }],
    })).toThrow(/non-exceptionable/)
    await expect(engine.businessRuleCatalog.create({
      ...base,
      rules: [{ ...base.rules[0]!, ownerRoleKey: "invented-owner" }],
    }, actorId)).rejects.toThrow(/exact bound Operating Model roles/)
    await expect(engine.businessRuleCatalog.create({
      ...base,
      exceptions: [{ ...base.exceptions[0]!, approvingRoleKey: "gaep-steward" }],
    }, actorId)).rejects.toThrow(/accountable role/)
    await expect(engine.businessRuleCatalog.create({
      ...base,
      conflictModel: {
        ...base.conflictModel,
        conflictRule: "api_key=sk-live-abcdefghijklmnopqrstuvwxyz123456 is not portable rule context",
      },
    }, actorId)).rejects.toThrow(/secret-shaped/)

    const catalog = await engine.businessRuleCatalog.create(base, actorId)
    await engine.operatingModel.revise(
      operatingModel.id,
      operatingModel.revision,
      operatingModelInput(business, stakeholder, outcome, capabilityMap, valueStreamModel, {
        limitations: ["The exact Operating Model changed after business-rule capture"],
      }),
      actorId,
    )
    expect(await engine.businessRuleCatalog.assess(initiative.id)).toMatchObject({
      businessRuleCatalog: { recordId: catalog.id },
      staleBindingCount: 1,
      state: "attention-required",
    })
  })

  it("governs an exact immutable Business Architecture Baseline candidate without granting baseline authority", async () => {
    const { business, stakeholder, outcome } = await createCompleteModel()
    const capabilityMap = await engine.businessCapabilityMap.create(
      capabilityMapInput(business, stakeholder, outcome),
      actorId,
    )
    const valueStreamModel = await engine.valueStreamModel.create(
      valueStreamInput(business, stakeholder, outcome, capabilityMap),
      actorId,
    )
    const operatingModel = await engine.operatingModel.create(
      operatingModelInput(business, stakeholder, outcome, capabilityMap, valueStreamModel),
      actorId,
    )
    const businessRuleCatalog = await engine.businessRuleCatalog.create(
      businessRuleCatalogInput(business, stakeholder, outcome, capabilityMap, valueStreamModel, operatingModel),
      actorId,
    )
    const input = businessArchitectureBaselineInput(
      business,
      stakeholder,
      outcome,
      capabilityMap,
      valueStreamModel,
      operatingModel,
      businessRuleCatalog,
    )
    const baseline = await engine.businessArchitectureBaseline.create(input, actorId)
    expect(baseline).toMatchObject({
      revision: 1,
      state: "candidate",
      membershipDigest: canonicalDigest({
        businessUnderstanding: input.businessUnderstanding,
        stakeholderModel: input.stakeholderModel,
        outcomeModel: input.outcomeModel,
        capabilityMap: input.capabilityMap,
        valueStreamModel: input.valueStreamModel,
        operatingModel: input.operatingModel,
        businessRuleCatalog: input.businessRuleCatalog,
      }),
      governance: { approvalState: "not-granted" },
      authorityBoundary: expect.stringContaining("does-not-designate-or-approve-a-baseline"),
    })
    expect(await engine.businessArchitectureBaseline.assess(initiative.id)).toMatchObject({
      baseline: { recordId: baseline.id, revision: 1, digest: canonicalDigest(baseline) },
      coveredElementCount: 9,
      includedElementCount: 9,
      excludedElementCount: 0,
      unresolvedElementCount: 0,
      integrationClaimCount: 1,
      consistencyCheckCount: 6,
      consistencyGapCount: 0,
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      state: "complete-for-review",
      reasons: [],
    })
    const projection = await engine.businessArchitectureBaseline.project(initiative.id)
    expect(projection).toMatchObject({
      baseline: {
        id: baseline.id,
        coveredElementCount: 9,
        integrationClaimCount: 1,
        consistencyGapCount: 0,
      },
      privacyBoundary: expect.stringContaining("not-architecture-narrative"),
      authorityBoundary: expect.stringContaining("does-not-designate-or-approve-a-baseline"),
    })
    expect(JSON.stringify(projection)).not.toContain("The governed-context capability")
    const { snapshotDigest, ...projectionBody } = projection
    expect(snapshotDigest).toBe(canonicalDigest(projectionBody))

    const revised = await engine.businessArchitectureBaseline.revise(
      baseline.id,
      baseline.revision,
      businessArchitectureBaselineInput(
        business,
        stakeholder,
        outcome,
        capabilityMap,
        valueStreamModel,
        operatingModel,
        businessRuleCatalog,
        { limitations: ["A realistic Product Owner baseline decision remains outstanding"] },
      ),
      actorId,
    )
    expect(revised).toMatchObject({
      id: baseline.id,
      revision: 2,
      predecessorDigest: canonicalDigest(baseline),
      governance: { approvalState: "not-granted" },
    })
    expect((await engine.businessArchitectureBaseline.listHistory(baseline.id)).map((record) => record.revision))
      .toEqual([2, 1])
    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
    expect(events.at(-1)).toMatchObject({
      eventType: "business.architecture-baseline.revised",
      payload: {
        revision: 2,
        recordDigest: canonicalDigest(revised),
        predecessorDigest: canonicalDigest(baseline),
        state: "candidate",
        approvalState: "not-granted",
        authorityBoundary: expect.stringContaining("does-not-designate-or-approve-a-baseline"),
      },
    })
  })

  it("rejects hostile Business Architecture coverage, governance, trace, and secret-shaped input", async () => {
    const { business, stakeholder, outcome } = await createCompleteModel()
    const capabilityMap = await engine.businessCapabilityMap.create(
      capabilityMapInput(business, stakeholder, outcome),
      actorId,
    )
    const valueStreamModel = await engine.valueStreamModel.create(
      valueStreamInput(business, stakeholder, outcome, capabilityMap),
      actorId,
    )
    const operatingModel = await engine.operatingModel.create(
      operatingModelInput(business, stakeholder, outcome, capabilityMap, valueStreamModel),
      actorId,
    )
    const businessRuleCatalog = await engine.businessRuleCatalog.create(
      businessRuleCatalogInput(business, stakeholder, outcome, capabilityMap, valueStreamModel, operatingModel),
      actorId,
    )
    const base = businessArchitectureBaselineInput(
      business,
      stakeholder,
      outcome,
      capabilityMap,
      valueStreamModel,
      operatingModel,
      businessRuleCatalog,
    )
    expect(() => businessArchitectureBaselineInputSchema.parse({
      ...base,
      governance: { ...base.governance, approvalState: "approved" },
    })).toThrow()
    await expect(engine.businessArchitectureBaseline.create({
      ...base,
      coverage: base.coverage.slice(1),
    }, actorId)).rejects.toThrow(/enumerate every exact bound architecture element/)
    await expect(engine.businessArchitectureBaseline.create({
      ...base,
      integrationClaims: [{ ...base.integrationClaims[0]!, roleKeys: ["invented-owner"] }],
    }, actorId)).rejects.toThrow(/exact bound element keys/)
    await expect(engine.businessArchitectureBaseline.create({
      ...base,
      governance: { ...base.governance, ownerRoleKey: "gaep-steward" },
    }, actorId)).rejects.toThrow(/accountable decision rights/)
    await expect(engine.businessArchitectureBaseline.create({
      ...base,
      changeControl: {
        ...base.changeControl,
        dispositionRule: "api_key=sk-live-abcdefghijklmnopqrstuvwxyz123456 is not portable baseline context",
      },
    }, actorId)).rejects.toThrow(/secret-shaped/)

    const baseline = await engine.businessArchitectureBaseline.create(base, actorId)
    await engine.businessRuleCatalog.revise(
      businessRuleCatalog.id,
      businessRuleCatalog.revision,
      businessRuleCatalogInput(business, stakeholder, outcome, capabilityMap, valueStreamModel, operatingModel, {
        limitations: ["The exact Business Rule Catalog changed after baseline capture"],
      }),
      actorId,
    )
    expect(await engine.businessArchitectureBaseline.assess(initiative.id)).toMatchObject({
      baseline: { recordId: baseline.id },
      staleBindingCount: 1,
      state: "attention-required",
    })
  })

  it("governs exact System Solution Architecture candidates and projects privacy-safe architecture coverage", async () => {
    const { business, stakeholder, outcome } = await createCompleteModel()
    const capabilityMap = await engine.businessCapabilityMap.create(
      capabilityMapInput(business, stakeholder, outcome),
      actorId,
    )
    const valueStreamModel = await engine.valueStreamModel.create(
      valueStreamInput(business, stakeholder, outcome, capabilityMap),
      actorId,
    )
    const operatingModel = await engine.operatingModel.create(
      operatingModelInput(business, stakeholder, outcome, capabilityMap, valueStreamModel),
      actorId,
    )
    const businessRuleCatalog = await engine.businessRuleCatalog.create(
      businessRuleCatalogInput(business, stakeholder, outcome, capabilityMap, valueStreamModel, operatingModel),
      actorId,
    )
    const baseline = await engine.businessArchitectureBaseline.create(
      businessArchitectureBaselineInput(
        business,
        stakeholder,
        outcome,
        capabilityMap,
        valueStreamModel,
        operatingModel,
        businessRuleCatalog,
      ),
      actorId,
    )
    const input = systemSolutionArchitectureInput(baseline)
    const architecture = await engine.systemSolutionArchitecture.create(input, actorId)
    expect(architecture).toMatchObject({
      revision: 1,
      state: "candidate",
      membershipDigest: canonicalDigest({ businessArchitectureBaseline: input.businessArchitectureBaseline }),
      governance: { approvalState: "not-granted", reviewState: "under-challenge" },
      authorityBoundary: expect.stringContaining("does-not-approve-or-designate-an-architecture-baseline"),
    })
    expect(await engine.systemSolutionArchitecture.assess(initiative.id)).toMatchObject({
      architecture: { recordId: architecture.id, revision: 1, digest: canonicalDigest(architecture) },
      concernCount: 1,
      viewCount: 1,
      elementCount: 3,
      relationCount: 2,
      qualityAttributeCount: 2,
      unresolvedQualityAttributeCount: 0,
      decisionCount: 1,
      unresolvedDecisionCount: 0,
      conformanceCriterionCount: 1,
      unresolvedConformanceCriterionCount: 0,
      lifecycleGapCount: 0,
      inconsistencyCount: 0,
      unresolvedQuestionCount: 0,
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      state: "complete-for-review",
      reasons: [],
    })
    const projection = await engine.systemSolutionArchitecture.project(initiative.id)
    expect(projection).toMatchObject({
      architecture: {
        id: architecture.id,
        concernCount: 1,
        viewCount: 1,
        elementCount: 3,
        qualityAttributeCount: 2,
        decisionCount: 1,
      },
      privacyBoundary: expect.stringContaining("not-architecture-narrative"),
      authorityBoundary: expect.stringContaining("does-not-approve-or-designate-an-architecture-baseline"),
    })
    expect(JSON.stringify(projection)).not.toContain("The native hosts must share")
    const { snapshotDigest, ...projectionBody } = projection
    expect(snapshotDigest).toBe(canonicalDigest(projectionBody))

    const revised = await engine.systemSolutionArchitecture.revise(
      architecture.id,
      architecture.revision,
      systemSolutionArchitectureInput(baseline, {
        limitations: [
          "No realistic Product Owner architecture approval, implementation conformance, readiness, or release authority is represented",
          "The candidate remains subject to independent native-host and operational challenge",
        ],
      }),
      actorId,
    )
    expect(revised).toMatchObject({
      id: architecture.id,
      revision: 2,
      predecessorDigest: canonicalDigest(architecture),
      governance: { approvalState: "not-granted" },
    })
    expect((await engine.systemSolutionArchitecture.listHistory(architecture.id)).map((record) => record.revision))
      .toEqual([2, 1])
    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
    expect(events.at(-1)).toMatchObject({
      eventType: "architecture.system-solution.revised",
      payload: {
        revision: 2,
        recordDigest: canonicalDigest(revised),
        predecessorDigest: canonicalDigest(architecture),
        state: "candidate",
        approvalState: "not-granted",
        reviewState: "under-challenge",
      },
    })
  })

  it("rejects hostile System Solution Architecture authority, trace, coverage, and secret-shaped input", async () => {
    const { business, stakeholder, outcome } = await createCompleteModel()
    const capabilityMap = await engine.businessCapabilityMap.create(
      capabilityMapInput(business, stakeholder, outcome),
      actorId,
    )
    const valueStreamModel = await engine.valueStreamModel.create(
      valueStreamInput(business, stakeholder, outcome, capabilityMap),
      actorId,
    )
    const operatingModel = await engine.operatingModel.create(
      operatingModelInput(business, stakeholder, outcome, capabilityMap, valueStreamModel),
      actorId,
    )
    const businessRuleCatalog = await engine.businessRuleCatalog.create(
      businessRuleCatalogInput(business, stakeholder, outcome, capabilityMap, valueStreamModel, operatingModel),
      actorId,
    )
    const baselineInput = businessArchitectureBaselineInput(
      business,
      stakeholder,
      outcome,
      capabilityMap,
      valueStreamModel,
      operatingModel,
      businessRuleCatalog,
    )
    const baseline = await engine.businessArchitectureBaseline.create(baselineInput, actorId)
    const base = systemSolutionArchitectureInput(baseline)
    expect(() => systemSolutionArchitectureInputSchema.parse({
      ...base,
      governance: { ...base.governance, approvalState: "approved" },
    })).toThrow()
    await expect(engine.systemSolutionArchitecture.create({
      ...base,
      concerns: [{ ...base.concerns[0]!, affectedBusinessElementKeys: ["invented-capability"] }],
    }, actorId)).rejects.toThrow(/exact Business Architecture element keys/)
    await expect(engine.systemSolutionArchitecture.create({
      ...base,
      elements: [{ ...base.elements[0]!, ownerRoleKey: "invented-role" }, ...base.elements.slice(1)],
    }, actorId)).rejects.toThrow(/exact bound Operating Model roles/)
    await expect(engine.systemSolutionArchitecture.create({
      ...base,
      views: [{ ...base.views[0]!, relationKeys: ["engine-writes-store"] }],
    }, actorId)).rejects.toThrow(/relation and decision must appear/)
    await expect(engine.systemSolutionArchitecture.create({
      ...base,
      conformanceCriteria: [{ ...base.conformanceCriteria[0]!, qualityAttributeKeys: ["audit-integrity"] }],
    }, actorId)).rejects.toThrow(/quality attribute and architecture decision requires/)
    await expect(engine.systemSolutionArchitecture.create({
      ...base,
      decisions: [{
        ...base.decisions[0]!,
        rationale: "api_key=sk-live-abcdefghijklmnopqrstuvwxyz123456 is not portable architecture context",
      }],
    }, actorId)).rejects.toThrow(/secret-shaped/)

    const architecture = await engine.systemSolutionArchitecture.create(base, actorId)
    await engine.businessArchitectureBaseline.revise(
      baseline.id,
      baseline.revision,
      businessArchitectureBaselineInput(
        business,
        stakeholder,
        outcome,
        capabilityMap,
        valueStreamModel,
        operatingModel,
        businessRuleCatalog,
        { limitations: ["The exact Business Architecture Baseline changed after system architecture capture"] },
      ),
      actorId,
    )
    expect(await engine.systemSolutionArchitecture.assess(initiative.id)).toMatchObject({
      architecture: { recordId: architecture.id },
      staleBindingCount: 1,
      state: "attention-required",
    })
  })

  it("persists exact versioned Bounded Context ownership candidates and privacy-safe assessment", async () => {
    const { business, stakeholder, outcome } = await createCompleteModel()
    const capabilityMap = await engine.businessCapabilityMap.create(
      capabilityMapInput(business, stakeholder, outcome),
      actorId,
    )
    const valueStreamModel = await engine.valueStreamModel.create(
      valueStreamInput(business, stakeholder, outcome, capabilityMap),
      actorId,
    )
    const operatingModel = await engine.operatingModel.create(
      operatingModelInput(business, stakeholder, outcome, capabilityMap, valueStreamModel),
      actorId,
    )
    const businessRuleCatalog = await engine.businessRuleCatalog.create(
      businessRuleCatalogInput(business, stakeholder, outcome, capabilityMap, valueStreamModel, operatingModel),
      actorId,
    )
    const baseline = await engine.businessArchitectureBaseline.create(
      businessArchitectureBaselineInput(
        business,
        stakeholder,
        outcome,
        capabilityMap,
        valueStreamModel,
        operatingModel,
        businessRuleCatalog,
      ),
      actorId,
    )
    const architecture = await engine.systemSolutionArchitecture.create(
      systemSolutionArchitectureInput(baseline),
      actorId,
    )
    const input = boundedContextModelInput(architecture)
    const model = await engine.boundedContextModel.create(input, actorId)
    expect(model).toMatchObject({
      revision: 1,
      state: "candidate",
      membershipDigest: canonicalDigest({ systemSolutionArchitecture: input.systemSolutionArchitecture }),
      governance: {
        boundaryApprovalState: "not-granted",
        ownershipAcceptanceState: "not-granted",
        reviewState: "under-challenge",
      },
      authorityBoundary: expect.stringContaining("does-not-appoint-an-owner"),
    })
    expect(await engine.boundedContextModel.assess(initiative.id)).toMatchObject({
      model: { recordId: model.id, revision: 1, digest: canonicalDigest(model) },
      boundedContextCount: 2,
      coreContextCount: 1,
      languageTermCount: 2,
      contractCount: 1,
      unresolvedContractCount: 0,
      relationshipCount: 1,
      unresolvedRelationshipCount: 0,
      unassignedArchitectureElementCount: 0,
      unownedDataAssetCount: 0,
      unmappedCrossContextRelationCount: 0,
      inconsistencyCount: 0,
      unresolvedQuestionCount: 0,
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      state: "complete-for-review",
      reasons: [],
    })
    const projection = await engine.boundedContextModel.project(initiative.id)
    expect(projection).toMatchObject({
      model: {
        id: model.id,
        boundedContextCount: 2,
        contractCount: 1,
        relationshipCount: 1,
      },
      privacyBoundary: expect.stringContaining("not-boundary-language-contract"),
      authorityBoundary: expect.stringContaining("does-not-appoint-owners"),
    })
    expect(JSON.stringify(projection)).not.toContain("Candidate record")
    const { snapshotDigest, ...projectionBody } = projection
    expect(snapshotDigest).toBe(canonicalDigest(projectionBody))

    const revised = await engine.boundedContextModel.revise(
      model.id,
      model.revision,
      boundedContextModelInput(architecture, {
        limitations: [
          "No organizational appointment, accepted ownership, approved boundary, readiness, release, deployment, or action authority is represented",
          "The candidate remains subject to independent domain-owner and native-host challenge",
        ],
      }),
      actorId,
    )
    expect(revised).toMatchObject({
      id: model.id,
      revision: 2,
      predecessorDigest: canonicalDigest(model),
      governance: { boundaryApprovalState: "not-granted", ownershipAcceptanceState: "not-granted" },
    })
    expect((await engine.boundedContextModel.listHistory(model.id)).map((record) => record.revision)).toEqual([2, 1])
    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
    expect(events.at(-1)).toMatchObject({
      eventType: "architecture.bounded-context.revised",
      payload: {
        revision: 2,
        recordDigest: canonicalDigest(revised),
        predecessorDigest: canonicalDigest(model),
        state: "candidate",
        boundaryApprovalState: "not-granted",
        ownershipAcceptanceState: "not-granted",
        reviewState: "under-challenge",
      },
    })
  })

  it("rejects forged Bounded Context ownership, element coverage, contracts, sources, and secrets", async () => {
    const { business, stakeholder, outcome } = await createCompleteModel()
    const capabilityMap = await engine.businessCapabilityMap.create(
      capabilityMapInput(business, stakeholder, outcome),
      actorId,
    )
    const valueStreamModel = await engine.valueStreamModel.create(
      valueStreamInput(business, stakeholder, outcome, capabilityMap),
      actorId,
    )
    const operatingModel = await engine.operatingModel.create(
      operatingModelInput(business, stakeholder, outcome, capabilityMap, valueStreamModel),
      actorId,
    )
    const businessRuleCatalog = await engine.businessRuleCatalog.create(
      businessRuleCatalogInput(business, stakeholder, outcome, capabilityMap, valueStreamModel, operatingModel),
      actorId,
    )
    const baseline = await engine.businessArchitectureBaseline.create(
      businessArchitectureBaselineInput(
        business,
        stakeholder,
        outcome,
        capabilityMap,
        valueStreamModel,
        operatingModel,
        businessRuleCatalog,
      ),
      actorId,
    )
    const architecture = await engine.systemSolutionArchitecture.create(
      systemSolutionArchitectureInput(baseline),
      actorId,
    )
    const base = boundedContextModelInput(architecture)
    expect(() => boundedContextModelInputSchema.parse({
      ...base,
      governance: { ...base.governance, boundaryApprovalState: "approved" },
    })).toThrow()
    expect(() => boundedContextModelInputSchema.parse({
      ...base,
      boundedContexts: base.boundedContexts.map((entry) => ({
        ...entry,
        architectureElementKeys: entry.key === "product-studio"
          ? ["gaep-engine", "product-studio-host"]
          : entry.architectureElementKeys,
      })),
    })).toThrow(/at most one bounded context/)
    await expect(engine.boundedContextModel.create({
      ...base,
      boundedContexts: base.boundedContexts.map((entry) => entry.key === "product-studio"
        ? { ...entry, ownerRoleKey: "invented-owner" }
        : entry),
    }, actorId)).rejects.toThrow(/exact bound Operating Model roles/)
    await expect(engine.boundedContextModel.create({
      ...base,
      boundedContexts: base.boundedContexts.map((entry) => entry.key === "governance-core"
        ? { ...entry, architectureElementKeys: ["workspace-store"], dataAssetElementKeys: ["workspace-store"] }
        : entry),
    }, actorId)).rejects.toThrow(/Every internal System\/Solution Architecture element/)
    await expect(engine.boundedContextModel.create({
      ...base,
      contracts: [],
      relationships: [],
    }, actorId)).rejects.toThrow(/cross-context architecture relation/)
    await expect(engine.boundedContextModel.create({
      ...base,
      contracts: [{ ...base.contracts[0]!, architectureRelationKeys: ["engine-writes-store"] }],
    }, actorId)).rejects.toThrow(/direction must match exact architecture element assignments/)
    await expect(engine.boundedContextModel.create({
      ...base,
      purpose: "api_key=sk-live-abcdefghijklmnopqrstuvwxyz123456 is not portable bounded context",
    }, actorId)).rejects.toThrow(/secret-shaped/)

    const model = await engine.boundedContextModel.create(base, actorId)
    await engine.systemSolutionArchitecture.revise(
      architecture.id,
      architecture.revision,
      systemSolutionArchitectureInput(baseline, {
        limitations: ["The exact System/Solution Architecture changed after bounded-context capture"],
      }),
      actorId,
    )
    expect(await engine.boundedContextModel.assess(initiative.id)).toMatchObject({
      model: { recordId: model.id },
      staleBindingCount: 1,
      state: "attention-required",
    })
  })

  it("persists exact versioned Security, Privacy, and Threat Assessment candidates and privacy-safe status", async () => {
    const { boundedContextModel } = await createArchitectureAndBoundedContext()
    const input = securityPrivacyAssessmentInput(boundedContextModel)
    const assessment = await engine.securityPrivacyAssessment.create(input, actorId)

    expect(assessment).toMatchObject({
      revision: 1,
      state: "candidate",
      membershipDigest: canonicalDigest({ boundedContextModel: input.boundedContextModel }),
      governance: {
        threatModelApprovalState: "not-granted",
        privacyReviewState: "not-granted",
        residualRiskAcceptanceState: "not-granted",
        controlEffectivenessState: "not-established",
        reviewState: "under-challenge",
      },
      authorityBoundary: expect.stringContaining("does-not-approve-a-threat-model"),
    })
    expect(await engine.securityPrivacyAssessment.assess(initiative.id)).toMatchObject({
      assessment: { recordId: assessment.id, revision: 1, digest: canonicalDigest(assessment) },
      assetCount: 2,
      actorCount: 3,
      trustBoundaryCount: 1,
      dataClassCount: 1,
      dataFlowCount: 1,
      controlCount: 1,
      threatCount: 1,
      unresolvedThreatCount: 0,
      unverifiedControlCount: 0,
      unresolvedProcessingAuthorityCount: 0,
      uncoveredArchitectureElementCount: 0,
      unmappedArchitectureRelationCount: 0,
      unresolvedRequirementCount: 0,
      inconsistencyCount: 0,
      unresolvedQuestionCount: 0,
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      state: "complete-for-review",
      reasons: [],
      authorityBoundary: expect.stringContaining("does-not-approve-threats"),
    })

    const projection = await engine.securityPrivacyAssessment.project(initiative.id)
    expect(projection).toMatchObject({
      assessment: {
        id: assessment.id,
        assetCount: 2,
        trustBoundaryCount: 1,
        dataClassCount: 1,
        controlCount: 1,
        threatCount: 1,
      },
      privacyBoundary: expect.stringContaining("not-threat-scenarios"),
      authorityBoundary: expect.stringContaining("does-not-approve-a-threat-model"),
    })
    expect(JSON.stringify(projection)).not.toContain("A malicious or mistaken input")
    const { snapshotDigest, ...projectionBody } = projection
    expect(snapshotDigest).toBe(canonicalDigest(projectionBody))

    const revised = await engine.securityPrivacyAssessment.revise(
      assessment.id,
      assessment.revision,
      securityPrivacyAssessmentInput(boundedContextModel, {
        limitations: [
          "No Codex Security scan, approved threat model, control-effectiveness attestation, risk acceptance, privacy approval, security readiness, release, deployment, or action authority is represented",
          "The candidate remains subject to independent security, privacy, risk-owner, and native-host challenge",
        ],
      }),
      actorId,
    )
    expect(revised).toMatchObject({
      id: assessment.id,
      revision: 2,
      predecessorDigest: canonicalDigest(assessment),
      governance: {
        threatModelApprovalState: "not-granted",
        privacyReviewState: "not-granted",
        residualRiskAcceptanceState: "not-granted",
        controlEffectivenessState: "not-established",
      },
    })
    expect((await engine.securityPrivacyAssessment.listHistory(assessment.id)).map((record) => record.revision))
      .toEqual([2, 1])
    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
    expect(events.at(-1)).toMatchObject({
      eventType: "security.privacy-threat.revised",
      payload: {
        revision: 2,
        recordDigest: canonicalDigest(revised),
        predecessorDigest: canonicalDigest(assessment),
        state: "candidate",
        threatModelApprovalState: "not-granted",
        privacyReviewState: "not-granted",
        residualRiskAcceptanceState: "not-granted",
        controlEffectivenessState: "not-established",
        reviewState: "under-challenge",
      },
    })
  })

  it("rejects forged Security, Privacy, and Threat authority, coverage, roles, relations, and secrets", async () => {
    const { boundedContextModel } = await createArchitectureAndBoundedContext()
    const base = securityPrivacyAssessmentInput(boundedContextModel)

    expect(() => securityPrivacyAssessmentInputSchema.parse({
      ...base,
      governance: { ...base.governance, threatModelApprovalState: "approved" },
    })).toThrow()
    await expect(engine.securityPrivacyAssessment.create({
      ...base,
      governance: { ...base.governance, securityAuthorityRoleKey: "invented-security-authority" },
    }, actorId)).rejects.toThrow(/exact bound Operating Model roles/)
    await expect(engine.securityPrivacyAssessment.create({
      ...base,
      assets: base.assets.map((entry) => entry.key === "governed-workspace"
        ? { ...entry, architectureElementKeys: ["workspace-store"] }
        : entry),
    }, actorId)).rejects.toThrow(/Every System\/Solution Architecture element/)
    await expect(engine.securityPrivacyAssessment.create({
      ...base,
      trustBoundaries: base.trustBoundaries.map((entry) => ({
        ...entry,
        architectureRelationKeys: ["engine-writes-store"],
      })),
      dataFlows: base.dataFlows.map((entry) => ({
        ...entry,
        architectureRelationKeys: ["engine-writes-store"],
      })),
    }, actorId)).rejects.toThrow(/Every System\/Solution Architecture relation/)
    await expect(engine.securityPrivacyAssessment.create({
      ...base,
      scope: "api_key=sk-live-abcdefghijklmnopqrstuvwxyz123456 is not portable assessment context",
    }, actorId)).rejects.toThrow(/secret-shaped/)

    const assessment = await engine.securityPrivacyAssessment.create(base, actorId)
    await engine.boundedContextModel.revise(
      boundedContextModel.id,
      boundedContextModel.revision,
      boundedContextModelInput(
        await engine.systemSolutionArchitecture.read(boundedContextModel.systemSolutionArchitecture.recordId),
        { limitations: [
          "No organizational appointment, accepted ownership, approved boundary, readiness, release, deployment, or action authority is represented",
          "The exact Bounded Context candidate changed after Security, Privacy, and Threat Assessment capture",
        ] },
      ),
      actorId,
    )
    expect(await engine.securityPrivacyAssessment.assess(initiative.id)).toMatchObject({
      assessment: { recordId: assessment.id },
      staleBindingCount: 1,
      state: "attention-required",
    })
  })

  it("persists exact versioned Process Model candidates and privacy-safe status", async () => {
    const upstream = await createArchitectureAndBoundedContext()
    const securityPrivacyAssessment = await engine.securityPrivacyAssessment.create(
      securityPrivacyAssessmentInput(upstream.boundedContextModel),
      actorId,
    )
    const input = processModelInput(
      upstream.valueStreamModel,
      upstream.operatingModel,
      upstream.businessRuleCatalog,
      upstream.boundedContextModel,
      securityPrivacyAssessment,
    )
    const model = await engine.processModel.create(input, actorId)

    expect(model).toMatchObject({
      revision: 1,
      state: "candidate",
      membershipDigest: canonicalDigest({
        valueStreamModel: input.valueStreamModel,
        operatingModel: input.operatingModel,
        businessRuleCatalog: input.businessRuleCatalog,
        boundedContextModel: input.boundedContextModel,
        securityPrivacyAssessment: input.securityPrivacyAssessment,
      }),
      governance: {
        transitionAuthorityState: "not-granted",
        approvalState: "not-granted",
        operationalReadinessState: "not-established",
        executionAuthorityState: "not-granted",
        authoringLifecycle: "under-challenge",
      },
      authorityBoundary: expect.stringContaining("does-not-approve-a-workflow"),
    })
    expect(await engine.processModel.assess(initiative.id)).toMatchObject({
      model: { recordId: model.id, revision: 1, digest: canonicalDigest(model) },
      processCount: 1,
      stepCount: 2,
      stateDimensionCount: 1,
      stateValueCount: 3,
      transitionCount: 2,
      eventDefinitionCount: 2,
      approvalRequirementCount: 1,
      uncoveredValueStreamCount: 0,
      uncoveredBoundedContextCount: 0,
      uncoveredBusinessRuleCount: 0,
      unresolvedRequirementCount: 0,
      inconsistencyCount: 0,
      unresolvedQuestionCount: 0,
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      state: "complete-for-review",
      reasons: [],
      authorityBoundary: expect.stringContaining("does-not-approve-workflows"),
    })
    const projection = await engine.processModel.project(initiative.id)
    expect(projection).toMatchObject({
      model: {
        id: model.id,
        processCount: 1,
        transitionCount: 2,
        approvalRequirementCount: 1,
      },
      privacyBoundary: expect.stringContaining("not-process-narrative"),
      authorityBoundary: expect.stringContaining("does-not-approve-workflows"),
    })
    expect(JSON.stringify(projection)).not.toContain("The process generator cannot provide")
    const { snapshotDigest, ...projectionBody } = projection
    expect(snapshotDigest).toBe(canonicalDigest(projectionBody))

    const revised = await engine.processModel.revise(
      model.id,
      model.revision,
      processModelInput(
        upstream.valueStreamModel,
        upstream.operatingModel,
        upstream.businessRuleCatalog,
        upstream.boundedContextModel,
        securityPrivacyAssessment,
        { limitations: [
          "No approved Process baseline, valid human approval, transition execution, operational readiness, release, deployment, or action authority is represented",
          "The candidate remains subject to independent process, state, approval, native-host, and Product Owner challenge",
        ] },
      ),
      actorId,
    )
    expect(revised).toMatchObject({
      id: model.id,
      revision: 2,
      predecessorDigest: canonicalDigest(model),
      governance: {
        transitionAuthorityState: "not-granted",
        approvalState: "not-granted",
        operationalReadinessState: "not-established",
        executionAuthorityState: "not-granted",
      },
    })
    expect((await engine.processModel.listHistory(model.id)).map((record) => record.revision)).toEqual([2, 1])
    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
    expect(events.at(-1)).toMatchObject({
      eventType: "process.model.revised",
      payload: {
        revision: 2,
        recordDigest: canonicalDigest(revised),
        predecessorDigest: canonicalDigest(model),
        state: "candidate",
        transitionAuthorityState: "not-granted",
        approvalState: "not-granted",
        operationalReadinessState: "not-established",
        executionAuthorityState: "not-granted",
        authoringLifecycle: "under-challenge",
      },
    })
  })

  it("rejects forged Process Model authority, graph, roles, bindings, and secrets", async () => {
    const upstream = await createArchitectureAndBoundedContext()
    const securityPrivacyAssessment = await engine.securityPrivacyAssessment.create(
      securityPrivacyAssessmentInput(upstream.boundedContextModel),
      actorId,
    )
    const base = processModelInput(
      upstream.valueStreamModel,
      upstream.operatingModel,
      upstream.businessRuleCatalog,
      upstream.boundedContextModel,
      securityPrivacyAssessment,
    )
    expect(() => processModelInputSchema.parse({
      ...base,
      governance: { ...base.governance, approvalState: "approved" },
    })).toThrow()
    expect(() => processModelInputSchema.parse({
      ...base,
      processes: base.processes.map((process) => ({
        ...process,
        transitions: process.transitions.map((transition) => transition.key === "draft-to-review"
          ? { ...transition, targetStateKey: "invented-state" }
          : transition),
      })),
    })).toThrow(/declared states/)
    await expect(engine.processModel.create({
      ...base,
      governance: { ...base.governance, stateStewardRoleKey: "invented-state-steward" },
    }, actorId)).rejects.toThrow(/exact bound Operating Model roles/)
    await expect(engine.processModel.create({
      ...base,
      processes: base.processes.map((process) => ({ ...process, valueStreamKeys: ["invented-value-stream"] })),
    }, actorId)).rejects.toThrow(/exact bound Value Streams/)
    await expect(engine.processModel.create({
      ...base,
      boundedContextModel: { ...base.boundedContextModel, digest: digest("e") },
    }, actorId)).rejects.toThrow(/exact current Bounded Context/)
    await expect(engine.processModel.create({
      ...base,
      scope: "api_key=sk-live-abcdefghijklmnopqrstuvwxyz123456 is not portable process context",
    }, actorId)).rejects.toThrow(/secret-shaped/)

    const model = await engine.processModel.create(base, actorId)
    await engine.securityPrivacyAssessment.revise(
      securityPrivacyAssessment.id,
      securityPrivacyAssessment.revision,
      securityPrivacyAssessmentInput(upstream.boundedContextModel, {
        limitations: [
          "No Codex Security scan, approved threat model, control-effectiveness attestation, risk acceptance, privacy approval, security readiness, release, deployment, or action authority is represented",
          "The exact Security, Privacy, and Threat Assessment changed after Process Model capture",
        ],
      }),
      actorId,
    )
    expect(await engine.processModel.assess(initiative.id)).toMatchObject({
      model: { recordId: model.id },
      staleBindingCount: 1,
      state: "attention-required",
    })
  })

  it("persists exact versioned Data Model candidates and privacy-safe status", async () => {
    const upstream = await createArchitectureAndBoundedContext()
    const securityPrivacyAssessment = await engine.securityPrivacyAssessment.create(
      securityPrivacyAssessmentInput(upstream.boundedContextModel),
      actorId,
    )
    const processModel = await engine.processModel.create(
      processModelInput(
        upstream.valueStreamModel,
        upstream.operatingModel,
        upstream.businessRuleCatalog,
        upstream.boundedContextModel,
        securityPrivacyAssessment,
      ),
      actorId,
    )
    const input = dataModelInput(
      upstream.architecture,
      upstream.boundedContextModel,
      upstream.operatingModel,
      securityPrivacyAssessment,
      processModel,
    )
    const model = await engine.dataModel.create(input, actorId)

    expect(model).toMatchObject({
      revision: 1,
      state: "candidate",
      membershipDigest: canonicalDigest({
        systemSolutionArchitecture: input.systemSolutionArchitecture,
        boundedContextModel: input.boundedContextModel,
        operatingModel: input.operatingModel,
        securityPrivacyAssessment: input.securityPrivacyAssessment,
        processModel: input.processModel,
      }),
      governance: {
        modelApprovalState: "not-granted",
        classificationApprovalState: "not-granted",
        ownershipAcceptanceState: "not-granted",
        migrationAuthorityState: "not-granted",
        operationalReadinessState: "not-established",
        reviewState: "under-challenge",
      },
      authorityBoundary: expect.stringContaining("does-not-approve-a-data-model"),
    })
    expect(await engine.dataModel.assess(initiative.id)).toMatchObject({
      model: { recordId: model.id, revision: 1, digest: canonicalDigest(model) },
      entityCount: 2,
      attributeCount: 3,
      relationshipCount: 1,
      lifecycleCount: 1,
      transformationCount: 1,
      uncoveredBoundedContextCount: 0,
      uncoveredSecurityDataClassCount: 0,
      uncoveredProcessCount: 0,
      unresolvedSystemOfRecordCount: 0,
      unresolvedTransformationCount: 0,
      unresolvedRequirementCount: 0,
      inconsistencyCount: 0,
      unresolvedQuestionCount: 0,
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      state: "complete-for-review",
      reasons: [],
      authorityBoundary: expect.stringContaining("does-not-approve-a-data-model"),
    })
    const projection = await engine.dataModel.project(initiative.id)
    expect(projection).toMatchObject({
      model: {
        id: model.id,
        entityCount: 2,
        relationshipCount: 1,
        lifecycleCount: 1,
      },
      privacyBoundary: expect.stringContaining("not-entity-attributes"),
      authorityBoundary: expect.stringContaining("does-not-approve-a-data-model"),
    })
    expect(JSON.stringify(projection)).not.toContain("Record identity")
    const { snapshotDigest, ...projectionBody } = projection
    expect(snapshotDigest).toBe(canonicalDigest(projectionBody))

    const revised = await engine.dataModel.revise(
      model.id,
      model.revision,
      dataModelInput(
        upstream.architecture,
        upstream.boundedContextModel,
        upstream.operatingModel,
        securityPrivacyAssessment,
        processModel,
        { limitations: [
          "No approved Data Model baseline, classification approval, accepted ownership, migration authority, operational readiness, release, deployment, or action authority is represented",
          "The candidate remains subject to independent data, privacy, records, native-host, and Product Owner challenge",
        ] },
      ),
      actorId,
    )
    expect(revised).toMatchObject({
      id: model.id,
      revision: 2,
      predecessorDigest: canonicalDigest(model),
      governance: {
        modelApprovalState: "not-granted",
        classificationApprovalState: "not-granted",
        ownershipAcceptanceState: "not-granted",
        migrationAuthorityState: "not-granted",
        operationalReadinessState: "not-established",
      },
    })
    expect((await engine.dataModel.listHistory(model.id)).map((record) => record.revision)).toEqual([2, 1])
    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
    expect(events.at(-1)).toMatchObject({
      eventType: "data.model.revised",
      payload: {
        revision: 2,
        recordDigest: canonicalDigest(revised),
        predecessorDigest: canonicalDigest(model),
        state: "candidate",
        modelApprovalState: "not-granted",
        classificationApprovalState: "not-granted",
        ownershipAcceptanceState: "not-granted",
        migrationAuthorityState: "not-granted",
        operationalReadinessState: "not-established",
        reviewState: "under-challenge",
      },
    })
  })

  it("rejects forged Data Model authority, graph, roles, bindings, and secrets", async () => {
    const upstream = await createArchitectureAndBoundedContext()
    const securityPrivacyAssessment = await engine.securityPrivacyAssessment.create(
      securityPrivacyAssessmentInput(upstream.boundedContextModel),
      actorId,
    )
    const processModel = await engine.processModel.create(
      processModelInput(
        upstream.valueStreamModel,
        upstream.operatingModel,
        upstream.businessRuleCatalog,
        upstream.boundedContextModel,
        securityPrivacyAssessment,
      ),
      actorId,
    )
    const base = dataModelInput(
      upstream.architecture,
      upstream.boundedContextModel,
      upstream.operatingModel,
      securityPrivacyAssessment,
      processModel,
    )
    expect(() => dataModelInputSchema.parse({
      ...base,
      governance: { ...base.governance, modelApprovalState: "approved" },
    })).toThrow()
    expect(() => dataModelInputSchema.parse({
      ...base,
      relationships: base.relationships.map((entry) => ({ ...entry, toEntityKey: "invented-entity" })),
    })).toThrow(/declared entities/)
    await expect(engine.dataModel.create({
      ...base,
      governance: { ...base.governance, dataOwnerRoleKeys: ["invented-data-owner"] },
    }, actorId)).rejects.toThrow(/exact bound Operating Model roles/)
    await expect(engine.dataModel.create({
      ...base,
      entities: base.entities.map((entry) => ({ ...entry, dataClassKeys: ["invented-data-class"] })),
    }, actorId)).rejects.toThrow(/exact bound security\/privacy data classes/)
    await expect(engine.dataModel.create({
      ...base,
      processModel: { ...base.processModel, digest: digest("e") },
    }, actorId)).rejects.toThrow(/exact current Process Model/)
    await expect(engine.dataModel.create({
      ...base,
      scope: "api_key=sk-live-abcdefghijklmnopqrstuvwxyz123456 is not portable data-model context",
    }, actorId)).rejects.toThrow(/secret-shaped/)

    const model = await engine.dataModel.create(base, actorId)
    await engine.processModel.revise(
      processModel.id,
      processModel.revision,
      processModelInput(
        upstream.valueStreamModel,
        upstream.operatingModel,
        upstream.businessRuleCatalog,
        upstream.boundedContextModel,
        securityPrivacyAssessment,
        { limitations: [
          "No approved Process baseline, valid human approval, transition execution, operational readiness, release, deployment, or action authority is represented",
          "The exact Process Model changed after Data Model capture",
        ] },
      ),
      actorId,
    )
    expect(await engine.dataModel.assess(initiative.id)).toMatchObject({
      model: { recordId: model.id },
      staleBindingCount: 1,
      state: "attention-required",
    })
  })

  it("persists exact versioned Authorization Model candidates and privacy-safe status", async () => {
    const upstream = await createAuthorizationUpstream()
    const input = authorizationModelInput(
      upstream.architecture,
      upstream.boundedContextModel,
      upstream.operatingModel,
      upstream.securityPrivacyAssessment,
      upstream.processModel,
      upstream.dataModel,
    )
    const model = await engine.authorizationModel.create(input, actorId)

    expect(model).toMatchObject({
      revision: 1,
      state: "candidate",
      membershipDigest: canonicalDigest({
        systemSolutionArchitecture: input.systemSolutionArchitecture,
        boundedContextModel: input.boundedContextModel,
        operatingModel: input.operatingModel,
        securityPrivacyAssessment: input.securityPrivacyAssessment,
        processModel: input.processModel,
        dataModel: input.dataModel,
      }),
      governance: {
        modelApprovalState: "not-granted",
        identityVerificationState: "not-established",
        roleAssignmentApprovalState: "not-granted",
        standingAuthorityState: "not-granted",
        authorizationGrantState: "not-granted",
        enforcementState: "not-established",
        reviewState: "under-challenge",
      },
      authorityBoundary: expect.stringContaining("does-not-verify-identity"),
    })
    expect(await engine.authorizationModel.assess(initiative.id)).toMatchObject({
      model: { recordId: model.id, revision: 1, digest: canonicalDigest(model) },
      principalCount: 2,
      roleAssignmentCount: 2,
      resourceCount: 5,
      actionCount: 2,
      approvalBindingCount: 1,
      ruleCount: 1,
      uncoveredOperatingRoleCount: 0,
      uncoveredProcessCount: 0,
      uncoveredDataEntityCount: 0,
      unresolvedIdentityCount: 0,
      unresolvedRuleCount: 0,
      unresolvedRequirementCount: 0,
      inconsistencyCount: 0,
      unresolvedQuestionCount: 0,
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      state: "complete-for-review",
      reasons: [],
      authorityBoundary: expect.stringContaining("does-not-verify-identity"),
    })
    const projection = await engine.authorizationModel.project(initiative.id)
    expect(projection).toMatchObject({
      model: {
        id: model.id,
        principalCount: 2,
        actionCount: 2,
        ruleCount: 1,
      },
      privacyBoundary: expect.stringContaining("not-principal-identifiers"),
      authorityBoundary: expect.stringContaining("does-not-verify-identity"),
    })
    expect(JSON.stringify(projection)).not.toContain("Candidate GAEP steward principal")
    const { snapshotDigest, ...projectionBody } = projection
    expect(snapshotDigest).toBe(canonicalDigest(projectionBody))

    const revised = await engine.authorizationModel.revise(
      model.id,
      model.revision,
      authorizationModelInput(
        upstream.architecture,
        upstream.boundedContextModel,
        upstream.operatingModel,
        upstream.securityPrivacyAssessment,
        upstream.processModel,
        upstream.dataModel,
        { limitations: [
          "No verified identity, effective role assignment, standing authority, authorization grant, enforcement decision, approved model, operational readiness, release, deployment, or action authority is represented",
          "The candidate remains subject to independent identity, authority, security, privacy, native-host, and Product Owner challenge",
        ] },
      ),
      actorId,
    )
    expect(revised).toMatchObject({
      id: model.id,
      revision: 2,
      predecessorDigest: canonicalDigest(model),
      governance: {
        modelApprovalState: "not-granted",
        identityVerificationState: "not-established",
        roleAssignmentApprovalState: "not-granted",
        standingAuthorityState: "not-granted",
        authorizationGrantState: "not-granted",
        enforcementState: "not-established",
      },
    })
    expect((await engine.authorizationModel.listHistory(model.id)).map((record) => record.revision)).toEqual([2, 1])
    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
    expect(events.at(-1)).toMatchObject({
      eventType: "authorization.model.revised",
      payload: {
        revision: 2,
        recordDigest: canonicalDigest(revised),
        predecessorDigest: canonicalDigest(model),
        state: "candidate",
        modelApprovalState: "not-granted",
        identityVerificationState: "not-established",
        roleAssignmentApprovalState: "not-granted",
        standingAuthorityState: "not-granted",
        authorizationGrantState: "not-granted",
        enforcementState: "not-established",
        reviewState: "under-challenge",
      },
    })
  })

  it("rejects forged Authorization Model authority, graph, roles, bindings, and secrets", async () => {
    const upstream = await createAuthorizationUpstream()
    const base = authorizationModelInput(
      upstream.architecture,
      upstream.boundedContextModel,
      upstream.operatingModel,
      upstream.securityPrivacyAssessment,
      upstream.processModel,
      upstream.dataModel,
    )
    expect(() => authorizationModelInputSchema.parse({
      ...base,
      governance: { ...base.governance, authorizationGrantState: "granted" },
    })).toThrow()
    expect(() => authorizationModelInputSchema.parse({
      ...base,
      roleAssignments: base.roleAssignments.map((entry) => ({ ...entry, principalKey: "invented-principal" })),
    })).toThrow(/declared Principals/)
    await expect(engine.authorizationModel.create({
      ...base,
      principals: base.principals.map((entry) => ({ ...entry, operatingRoleKeys: ["invented-role"] })),
    }, actorId)).rejects.toThrow(/exact bound Operating Model roles/)
    await expect(engine.authorizationModel.create({
      ...base,
      resources: base.resources.map((entry) => entry.key === "data-governed-record"
        ? { ...entry, subjectKey: "invented-data-entity" }
        : entry),
    }, actorId)).rejects.toThrow(/exact bound upstream subjects/)
    await expect(engine.authorizationModel.create({
      ...base,
      actions: base.actions.map((entry) => entry.key === "revise-candidate"
        ? { ...entry, approvalRequirementKeys: ["invented-approval"] }
        : entry),
    }, actorId)).rejects.toThrow(/exact bound Process approval requirements/)
    await expect(engine.authorizationModel.create({
      ...base,
      dataModel: { ...base.dataModel, digest: digest("e") },
    }, actorId)).rejects.toThrow(/exact current Data Model/)
    await expect(engine.authorizationModel.create({
      ...base,
      scope: "api_key=sk-live-abcdefghijklmnopqrstuvwxyz123456 is not portable authorization context",
    }, actorId)).rejects.toThrow(/secret-shaped/)

    const model = await engine.authorizationModel.create(base, actorId)
    await engine.dataModel.revise(
      upstream.dataModel.id,
      upstream.dataModel.revision,
      dataModelInput(
        upstream.architecture,
        upstream.boundedContextModel,
        upstream.operatingModel,
        upstream.securityPrivacyAssessment,
        upstream.processModel,
        { limitations: [
          "No approved Data Model baseline, classification approval, accepted ownership, migration authority, operational readiness, release, deployment, or action authority is represented",
          "The exact Data Model changed after Authorization Model capture",
        ] },
      ),
      actorId,
    )
    expect(await engine.authorizationModel.assess(initiative.id)).toMatchObject({
      model: { recordId: model.id },
      staleBindingCount: 1,
      state: "attention-required",
    })
  })

  it("persists exact versioned Event and Integration Model candidates and privacy-safe status", async () => {
    const upstream = await createEventIntegrationUpstream()
    const input = eventIntegrationModelInput(
      upstream.architecture,
      upstream.boundedContextModel,
      upstream.operatingModel,
      upstream.securityPrivacyAssessment,
      upstream.processModel,
      upstream.dataModel,
      upstream.authorizationModel,
    )
    const model = await engine.eventIntegrationModel.create(input, actorId)

    expect(model).toMatchObject({
      revision: 1,
      state: "candidate",
      membershipDigest: canonicalDigest({
        systemSolutionArchitecture: input.systemSolutionArchitecture,
        boundedContextModel: input.boundedContextModel,
        operatingModel: input.operatingModel,
        securityPrivacyAssessment: input.securityPrivacyAssessment,
        processModel: input.processModel,
        dataModel: input.dataModel,
        authorizationModel: input.authorizationModel,
      }),
      governance: {
        eventRegistryApprovalState: "not-granted",
        commandRegistryApprovalState: "not-granted",
        adapterEvaluationState: "not-established",
        externalContractAcceptanceState: "not-established",
        activationState: "not-granted",
        operationalReadinessState: "not-established",
        executionAuthorityState: "not-granted",
        reviewState: "under-challenge",
      },
      authorityBoundary: expect.stringContaining("does-not-prove-event-occurrence"),
    })
    expect(await engine.eventIntegrationModel.assess(initiative.id)).toMatchObject({
      model: { recordId: model.id, revision: 1, digest: canonicalDigest(model) },
      eventTypeCount: 2,
      commandCount: 2,
      adapterCount: 1,
      externalContractCount: 1,
      mappingCount: 1,
      routeCount: 1,
      uncoveredProcessEventCount: 0,
      uncoveredProcessCount: 0,
      uncoveredBoundedContextCount: 0,
      uncoveredDataEntityCount: 0,
      uncoveredAuthorizationActionCount: 0,
      unknownMappingTruthCount: 0,
      unresolvedRequirementCount: 0,
      inconsistencyCount: 0,
      unresolvedQuestionCount: 0,
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      state: "complete-for-review",
      reasons: [],
      authorityBoundary: expect.stringContaining("does-not-prove-event-occurrence"),
    })
    const projection = await engine.eventIntegrationModel.project(initiative.id)
    expect(projection).toMatchObject({
      model: {
        id: model.id,
        eventTypeCount: 2,
        commandCount: 2,
        adapterCount: 1,
        externalContractCount: 1,
        mappingCount: 1,
        routeCount: 1,
      },
      privacyBoundary: expect.stringContaining("not-event-payloads"),
      authorityBoundary: expect.stringContaining("does-not-prove-event-occurrence"),
    })
    expect(JSON.stringify(projection)).not.toContain("Candidate external review system")
    const { snapshotDigest, ...projectionBody } = projection
    expect(snapshotDigest).toBe(canonicalDigest(projectionBody))

    const revised = await engine.eventIntegrationModel.revise(
      model.id,
      model.revision,
      eventIntegrationModelInput(
        upstream.architecture,
        upstream.boundedContextModel,
        upstream.operatingModel,
        upstream.securityPrivacyAssessment,
        upstream.processModel,
        upstream.dataModel,
        upstream.authorizationModel,
        { limitations: [
          "No event occurrence, command send or delivery, external contract acceptance, adapter evaluation or activation, credential binding, Authorization Grant, executed effect, operational readiness, release, deployment, or action authority is represented",
          "The candidate remains subject to independent event, integration, authority, privacy, reliability, native-host, and Product Owner challenge",
        ] },
      ),
      actorId,
    )
    expect(revised).toMatchObject({
      id: model.id,
      revision: 2,
      predecessorDigest: canonicalDigest(model),
      governance: {
        eventRegistryApprovalState: "not-granted",
        commandRegistryApprovalState: "not-granted",
        adapterEvaluationState: "not-established",
        externalContractAcceptanceState: "not-established",
        activationState: "not-granted",
        operationalReadinessState: "not-established",
        executionAuthorityState: "not-granted",
      },
    })
    expect((await engine.eventIntegrationModel.listHistory(model.id)).map((record) => record.revision)).toEqual([2, 1])
    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
    expect(events.at(-1)).toMatchObject({
      eventType: "event.integration-model.revised",
      payload: {
        revision: 2,
        recordDigest: canonicalDigest(revised),
        predecessorDigest: canonicalDigest(model),
        state: "candidate",
        eventRegistryApprovalState: "not-granted",
        commandRegistryApprovalState: "not-granted",
        adapterEvaluationState: "not-established",
        externalContractAcceptanceState: "not-established",
        activationState: "not-granted",
        operationalReadinessState: "not-established",
        executionAuthorityState: "not-granted",
        reviewState: "under-challenge",
      },
    })
  })

  it("rejects forged Event and Integration occurrence, authority, graph, roles, bindings, and secrets", async () => {
    const upstream = await createEventIntegrationUpstream()
    const base = eventIntegrationModelInput(
      upstream.architecture,
      upstream.boundedContextModel,
      upstream.operatingModel,
      upstream.securityPrivacyAssessment,
      upstream.processModel,
      upstream.dataModel,
      upstream.authorizationModel,
    )
    expect(() => eventIntegrationModelInputSchema.parse({
      ...base,
      governance: { ...base.governance, activationState: "granted" },
    })).toThrow()
    expect(() => eventIntegrationModelInputSchema.parse({
      ...base,
      eventTypes: base.eventTypes.map((entry) => ({ ...entry, occurrenceState: "occurred" })),
    })).toThrow()
    expect(() => eventIntegrationModelInputSchema.parse({
      ...base,
      routes: base.routes.map((entry) => ({ ...entry, adapterKey: "invented-adapter" })),
    })).toThrow(/declared Events, Commands, Adapters/)
    await expect(engine.eventIntegrationModel.create({
      ...base,
      governance: { ...base.governance, integrationStewardRoleKeys: ["invented-role"] },
    }, actorId)).rejects.toThrow(/exact bound Operating Model roles/)
    await expect(engine.eventIntegrationModel.create({
      ...base,
      eventTypes: base.eventTypes.map((entry) => entry.key === "review-requested-event"
        ? { ...entry, processEventKeys: ["invented-process-event"] }
        : entry),
    }, actorId)).rejects.toThrow(/exact bound Process Events/)
    await expect(engine.eventIntegrationModel.create({
      ...base,
      commands: base.commands.map((entry) => entry.key === "revise-candidate-command"
        ? { ...entry, authorizationActionKeys: ["invented-action"] }
        : entry),
    }, actorId)).rejects.toThrow(/Authorization subjects/)
    await expect(engine.eventIntegrationModel.create({
      ...base,
      authorizationModel: { ...base.authorizationModel, digest: digest("e") },
    }, actorId)).rejects.toThrow(/exact current Authorization Model/)
    await expect(engine.eventIntegrationModel.create({
      ...base,
      scope: "api_key=sk-live-abcdefghijklmnopqrstuvwxyz123456 is not portable integration context",
    }, actorId)).rejects.toThrow(/secret-shaped/)

    const model = await engine.eventIntegrationModel.create(base, actorId)
    await engine.authorizationModel.revise(
      upstream.authorizationModel.id,
      upstream.authorizationModel.revision,
      authorizationModelInput(
        upstream.architecture,
        upstream.boundedContextModel,
        upstream.operatingModel,
        upstream.securityPrivacyAssessment,
        upstream.processModel,
        upstream.dataModel,
        { limitations: [
          "No verified identity, effective role assignment, standing authority, authorization grant, enforcement decision, approved model, operational readiness, release, deployment, or action authority is represented",
          "The exact Authorization Model changed after Event and Integration Model capture",
        ] },
      ),
      actorId,
    )
    expect(await engine.eventIntegrationModel.assess(initiative.id)).toMatchObject({
      model: { recordId: model.id },
      staleBindingCount: 1,
      state: "attention-required",
    })
  })

  it("persists exact versioned Failure and Recovery Model candidates and privacy-safe status", async () => {
    const upstream = await createFailureRecoveryUpstream()
    const input = failureRecoveryModelInput(
      upstream.architecture,
      upstream.boundedContextModel,
      upstream.operatingModel,
      upstream.securityPrivacyAssessment,
      upstream.processModel,
      upstream.dataModel,
      upstream.authorizationModel,
      upstream.eventIntegrationModel,
    )
    const model = await engine.failureRecoveryModel.create(input, actorId)

    expect(model).toMatchObject({
      revision: 1,
      state: "candidate",
      membershipDigest: canonicalDigest({
        systemSolutionArchitecture: input.systemSolutionArchitecture,
        boundedContextModel: input.boundedContextModel,
        operatingModel: input.operatingModel,
        securityPrivacyAssessment: input.securityPrivacyAssessment,
        processModel: input.processModel,
        dataModel: input.dataModel,
        authorizationModel: input.authorizationModel,
        eventIntegrationModel: input.eventIntegrationModel,
      }),
      governance: {
        failureRegistryApprovalState: "not-granted",
        retrySafetyState: "not-established",
        compensationApprovalState: "not-granted",
        recoveryPlanApprovalState: "not-granted",
        recoveryEvidenceAcceptanceState: "not-established",
        operationalReadinessState: "not-established",
        returnToServiceAuthorityState: "not-granted",
        executionAuthorityState: "not-granted",
        reviewState: "under-challenge",
      },
      authorityBoundary: expect.stringContaining("does-not-prove-failure-occurrence"),
    })
    expect(await engine.failureRecoveryModel.assess(initiative.id)).toMatchObject({
      model: { recordId: model.id, revision: 1, digest: canonicalDigest(model) },
      failureModeCount: 1,
      retryPolicyCount: 1,
      compensationPlanCount: 1,
      recoveryPlanCount: 1,
      recoveryEvidenceDefinitionCount: 1,
      uncoveredProcessCount: 0,
      uncoveredCommandCount: 0,
      uncoveredRouteCount: 0,
      uncoveredAuthorizationActionCount: 0,
      unresolvedRecoveryEvidenceCount: 0,
      unresolvedRequirementCount: 0,
      inconsistencyCount: 0,
      unresolvedQuestionCount: 0,
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      state: "complete-for-review",
      reasons: [],
      authorityBoundary: expect.stringContaining("does-not-prove-failure-occurrence"),
    })
    const projection = await engine.failureRecoveryModel.project(initiative.id)
    expect(projection).toMatchObject({
      model: {
        id: model.id,
        failureModeCount: 1,
        retryPolicyCount: 1,
        compensationPlanCount: 1,
        recoveryPlanCount: 1,
        recoveryEvidenceDefinitionCount: 1,
      },
      privacyBoundary: expect.stringContaining("not-failure-evidence"),
      authorityBoundary: expect.stringContaining("does-not-prove-failure-occurrence"),
    })
    expect(JSON.stringify(projection)).not.toContain("Authoritative receipt is absent")
    const { snapshotDigest, ...projectionBody } = projection
    expect(snapshotDigest).toBe(canonicalDigest(projectionBody))

    const revised = await engine.failureRecoveryModel.revise(
      model.id,
      model.revision,
      failureRecoveryModelInput(
        upstream.architecture,
        upstream.boundedContextModel,
        upstream.operatingModel,
        upstream.securityPrivacyAssessment,
        upstream.processModel,
        upstream.dataModel,
        upstream.authorizationModel,
        upstream.eventIntegrationModel,
        { limitations: [
          "No failure occurrence, retry attempt or safety determination, compensation execution or restoration, recovered state, accepted recovery evidence, operational readiness, return-to-service decision, release, deployment, or action authority is represented",
          "The candidate remains subject to independent failure, recovery, authority, evidence, privacy, reliability, native-host, and Product Owner challenge",
        ] },
      ),
      actorId,
    )
    expect(revised).toMatchObject({
      id: model.id,
      revision: 2,
      predecessorDigest: canonicalDigest(model),
      governance: {
        failureRegistryApprovalState: "not-granted",
        retrySafetyState: "not-established",
        compensationApprovalState: "not-granted",
        recoveryPlanApprovalState: "not-granted",
        recoveryEvidenceAcceptanceState: "not-established",
        operationalReadinessState: "not-established",
        returnToServiceAuthorityState: "not-granted",
        executionAuthorityState: "not-granted",
      },
    })
    expect((await engine.failureRecoveryModel.listHistory(model.id)).map((record) => record.revision)).toEqual([2, 1])
    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
    expect(events.at(-1)).toMatchObject({
      eventType: "failure.recovery-model.revised",
      payload: {
        revision: 2,
        recordDigest: canonicalDigest(revised),
        predecessorDigest: canonicalDigest(model),
        state: "candidate",
        failureRegistryApprovalState: "not-granted",
        retrySafetyState: "not-established",
        compensationApprovalState: "not-granted",
        recoveryPlanApprovalState: "not-granted",
        recoveryEvidenceAcceptanceState: "not-established",
        operationalReadinessState: "not-established",
        returnToServiceAuthorityState: "not-granted",
        executionAuthorityState: "not-granted",
        reviewState: "under-challenge",
      },
    })
  })

  it("rejects forged Failure and Recovery state, authority, graph, roles, bindings, and secrets", async () => {
    const upstream = await createFailureRecoveryUpstream()
    const base = failureRecoveryModelInput(
      upstream.architecture,
      upstream.boundedContextModel,
      upstream.operatingModel,
      upstream.securityPrivacyAssessment,
      upstream.processModel,
      upstream.dataModel,
      upstream.authorizationModel,
      upstream.eventIntegrationModel,
    )
    expect(() => failureRecoveryModelInputSchema.parse({
      ...base,
      governance: { ...base.governance, returnToServiceAuthorityState: "granted" },
    })).toThrow()
    expect(() => failureRecoveryModelInputSchema.parse({
      ...base,
      failureModes: base.failureModes.map((entry) => ({ ...entry, occurrenceState: "observed" })),
    })).toThrow()
    expect(() => failureRecoveryModelInputSchema.parse({
      ...base,
      failureModes: base.failureModes.map((entry) => ({ ...entry, retryPolicyKeys: ["invented-retry"] })),
    })).toThrow(/declared retry, compensation, and recovery/)
    await expect(engine.failureRecoveryModel.create({
      ...base,
      governance: { ...base.governance, recoveryOwnerRoleKeys: ["invented-role"] },
    }, actorId)).rejects.toThrow(/exact bound Operating Model roles/)
    await expect(engine.failureRecoveryModel.create({
      ...base,
      failureModes: base.failureModes.map((entry) => ({ ...entry, affectedEventTypeKeys: ["invented-event"] })),
    }, actorId)).rejects.toThrow(/exact bound Process, Event, Command/)
    await expect(engine.failureRecoveryModel.create({
      ...base,
      eventIntegrationModel: { ...base.eventIntegrationModel, digest: digest("e") },
    }, actorId)).rejects.toThrow(/exact current Event and Integration Model/)
    await expect(engine.failureRecoveryModel.create({
      ...base,
      scope: "api_key=sk-live-abcdefghijklmnopqrstuvwxyz123456 is not portable recovery context",
    }, actorId)).rejects.toThrow(/secret-shaped/)

    const model = await engine.failureRecoveryModel.create(base, actorId)
    await engine.eventIntegrationModel.revise(
      upstream.eventIntegrationModel.id,
      upstream.eventIntegrationModel.revision,
      eventIntegrationModelInput(
        upstream.architecture,
        upstream.boundedContextModel,
        upstream.operatingModel,
        upstream.securityPrivacyAssessment,
        upstream.processModel,
        upstream.dataModel,
        upstream.authorizationModel,
        { limitations: [
          "No event occurrence, command send or delivery, external contract acceptance, adapter evaluation or activation, credential binding, Authorization Grant, executed effect, operational readiness, release, deployment, or action authority is represented",
          "The exact Event and Integration Model changed after Failure and Recovery Model capture",
        ] },
      ),
      actorId,
    )
    expect(await engine.failureRecoveryModel.assess(initiative.id)).toMatchObject({
      model: { recordId: model.id },
      staleBindingCount: 1,
      state: "attention-required",
    })
  })

  it("persists exact versioned Architecture Challenge candidates with explicit non-authority boundaries", async () => {
    const upstream = await createArchitectureChallengeUpstream()
    const input = architectureChallengeModelInput(
      upstream.architecture, upstream.boundedContextModel, upstream.operatingModel,
      upstream.securityPrivacyAssessment, upstream.processModel, upstream.dataModel,
      upstream.authorizationModel, upstream.eventIntegrationModel, upstream.failureRecoveryModel,
    )
    const model = await engine.architectureChallengeModel.create(input, actorId)

    expect(model).toMatchObject({
      revision: 1,
      state: "candidate",
      membershipDigest: canonicalDigest({
        systemSolutionArchitecture: input.systemSolutionArchitecture,
        boundedContextModel: input.boundedContextModel,
        operatingModel: input.operatingModel,
        securityPrivacyAssessment: input.securityPrivacyAssessment,
        processModel: input.processModel,
        dataModel: input.dataModel,
        authorizationModel: input.authorizationModel,
        eventIntegrationModel: input.eventIntegrationModel,
        failureRecoveryModel: input.failureRecoveryModel,
      }),
      governance: {
        challengeCompletionState: "not-established",
        independenceState: "not-established",
        assuranceState: "not-established",
        riskAcceptanceState: "not-granted",
        architectureApprovalState: "not-granted",
        operationalReadinessState: "not-established",
        actionAuthorityState: "not-granted",
        reviewState: "under-challenge",
      },
      authorityBoundary: expect.stringContaining("does-not-establish-independence"),
    })
    expect(await engine.architectureChallengeModel.assess(initiative.id)).toMatchObject({
      model: { recordId: model.id, revision: 1, digest: canonicalDigest(model) },
      challengeSubjectCount: 1,
      assumptionCount: 1,
      alternativeCount: 2,
      findingCount: 1,
      responseCount: 1,
      unrespondedFindingCount: 0,
      unresolvedAssumptionCount: 0,
      unresolvedRequirementCount: 0,
      inconsistencyCount: 0,
      unresolvedQuestionCount: 0,
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      state: "complete-for-review",
      reasons: [],
      authorityBoundary: expect.stringContaining("does-not-establish-independence"),
    })
    const projection = await engine.architectureChallengeModel.project(initiative.id)
    expect(projection).toMatchObject({
      model: {
        id: model.id,
        challengeSubjectCount: 1,
        assumptionCount: 1,
        alternativeCount: 2,
        findingCount: 1,
        responseCount: 1,
      },
      privacyBoundary: expect.stringContaining("not-challenge-content"),
      authorityBoundary: expect.stringContaining("does-not-establish-independence"),
    })
    expect(JSON.stringify(projection)).not.toContain("concentrates validation")
    const { snapshotDigest, ...projectionBody } = projection
    expect(snapshotDigest).toBe(canonicalDigest(projectionBody))

    const revised = await engine.architectureChallengeModel.revise(
      model.id,
      model.revision,
      architectureChallengeModelInput(
        upstream.architecture, upstream.boundedContextModel, upstream.operatingModel,
        upstream.securityPrivacyAssessment, upstream.processModel, upstream.dataModel,
        upstream.authorizationModel, upstream.eventIntegrationModel, upstream.failureRecoveryModel,
        { limitations: [
          "No completed independent challenge, assurance conclusion, risk acceptance, architecture approval, native-host acceptance, operational readiness, release, deployment, or action authority is represented",
          "The candidate remains subject to a separately assigned qualified human review of exact evidence, independence, conflicts, alternatives, and downstream consequences",
        ] },
      ),
      actorId,
    )
    expect(revised).toMatchObject({
      id: model.id,
      revision: 2,
      predecessorDigest: canonicalDigest(model),
      governance: {
        challengeCompletionState: "not-established",
        independenceState: "not-established",
        assuranceState: "not-established",
        riskAcceptanceState: "not-granted",
        architectureApprovalState: "not-granted",
        operationalReadinessState: "not-established",
        actionAuthorityState: "not-granted",
      },
    })
    expect((await engine.architectureChallengeModel.listHistory(model.id)).map((record) => record.revision))
      .toEqual([2, 1])
    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
    expect(events.at(-1)).toMatchObject({
      eventType: "architecture.challenge-model.revised",
      payload: {
        revision: 2,
        recordDigest: canonicalDigest(revised),
        predecessorDigest: canonicalDigest(model),
        state: "candidate",
        challengeCompletionState: "not-established",
        independenceState: "not-established",
        assuranceState: "not-established",
        riskAcceptanceState: "not-granted",
        architectureApprovalState: "not-granted",
        operationalReadinessState: "not-established",
        actionAuthorityState: "not-granted",
        reviewState: "under-challenge",
      },
    })
  })

  it("rejects forged Architecture Challenge authority, graph, roles, bindings, and secrets", async () => {
    const upstream = await createArchitectureChallengeUpstream()
    const base = architectureChallengeModelInput(
      upstream.architecture, upstream.boundedContextModel, upstream.operatingModel,
      upstream.securityPrivacyAssessment, upstream.processModel, upstream.dataModel,
      upstream.authorizationModel, upstream.eventIntegrationModel, upstream.failureRecoveryModel,
    )
    expect(() => architectureChallengeModelInputSchema.parse({
      ...base,
      governance: { ...base.governance, architectureApprovalState: "granted" },
    })).toThrow()
    expect(() => architectureChallengeModelInputSchema.parse({
      ...base,
      findings: base.findings.map((entry) => ({ ...entry, independenceState: "established" })),
    })).toThrow()
    expect(() => architectureChallengeModelInputSchema.parse({
      ...base,
      findings: base.findings.map((entry) => ({ ...entry, alternativeKeys: ["invented-alternative"] })),
    })).toThrow(/declared Alternatives/)
    await expect(engine.architectureChallengeModel.create({
      ...base,
      governance: { ...base.governance, challengerRoleKeys: ["invented-role"] },
    }, actorId)).rejects.toThrow(/exact bound Operating Model roles/)
    await expect(engine.architectureChallengeModel.create({
      ...base,
      challengeSubjects: base.challengeSubjects.map((entry) => ({
        ...entry,
        architectureDecisionKeys: ["invented-decision"],
      })),
    }, actorId)).rejects.toThrow(/exact bound Architecture, Context, and Failure subjects/)
    await expect(engine.architectureChallengeModel.create({
      ...base,
      failureRecoveryModel: { ...base.failureRecoveryModel, digest: digest("e") },
    }, actorId)).rejects.toThrow(/exact current Failure and Recovery Model/)
    await expect(engine.architectureChallengeModel.create({
      ...base,
      scope: "api_key=sk-live-abcdefghijklmnopqrstuvwxyz123456 is not portable challenge context",
    }, actorId)).rejects.toThrow(/secret-shaped/)

    const model = await engine.architectureChallengeModel.create(base, actorId)
    await engine.failureRecoveryModel.revise(
      upstream.failureRecoveryModel.id,
      upstream.failureRecoveryModel.revision,
      failureRecoveryModelInput(
        upstream.architecture, upstream.boundedContextModel, upstream.operatingModel,
        upstream.securityPrivacyAssessment, upstream.processModel, upstream.dataModel,
        upstream.authorizationModel, upstream.eventIntegrationModel,
        { limitations: [
          "No failure occurrence, retry attempt or safety determination, compensation execution or restoration, recovered state, accepted recovery evidence, operational readiness, return-to-service decision, release, deployment, or action authority is represented",
          "The exact Failure and Recovery Model changed after Architecture Challenge capture",
        ] },
      ),
      actorId,
    )
    expect(await engine.architectureChallengeModel.assess(initiative.id)).toMatchObject({
      model: { recordId: model.id },
      staleBindingCount: 1,
      state: "attention-required",
    })
  })

  it("rejects invalid capability graphs, forged trace bindings, secrets, and stale upstream context", async () => {
    const { business, stakeholder, outcome } = await createCompleteModel()
    const base = capabilityMapInput(business, stakeholder, outcome)
    expect(() => businessCapabilityMapInputSchema.parse({
      ...base,
      capabilities: [{
        ...base.capabilities[0]!,
        dependencyKeys: ["missing-capability"],
      }],
    })).toThrow(/dependencies must reference/)

    await expect(engine.businessCapabilityMap.create({
      ...base,
      capabilities: [{
        ...base.capabilities[0]!,
        ownerStakeholderKey: "invented-owner",
      }],
    }, actorId)).rejects.toThrow(/exact bound Stakeholder Model/)

    await expect(engine.businessCapabilityMap.create({
      ...base,
      capabilities: [{
        ...base.capabilities[0]!,
        purpose: "api_key=sk-live-abcdefghijklmnopqrstuvwxyz123456 is not portable capability context",
      }],
    }, actorId)).rejects.toThrow(/secret-shaped/)

    const map = await engine.businessCapabilityMap.create(base, actorId)
    await engine.businessUnderstanding.reviseBusinessUnderstanding(
      business.id,
      business.revision,
      businessInput({ limitations: ["The exact upstream context has changed after capability mapping."] }),
      actorId,
    )
    expect(await engine.businessCapabilityMap.assess(initiative.id)).toMatchObject({
      capabilityMap: { recordId: map.id },
      staleBindingCount: 1,
      state: "attention-required",
    })
  })

  it("exports and validates the complete immutable business graph and rejects rebound upstream records", async () => {
    const { business, stakeholder, outcome } = await createCompleteModel()
    const capabilityMap = await engine.businessCapabilityMap.create(
      capabilityMapInput(business, stakeholder, outcome),
      actorId,
    )
    const valueStreamModel = await engine.valueStreamModel.create(
      valueStreamInput(business, stakeholder, outcome, capabilityMap),
      actorId,
    )
    const operatingModel = await engine.operatingModel.create(
      operatingModelInput(business, stakeholder, outcome, capabilityMap, valueStreamModel),
      actorId,
    )
    const businessRuleCatalog = await engine.businessRuleCatalog.create(
      businessRuleCatalogInput(business, stakeholder, outcome, capabilityMap, valueStreamModel, operatingModel),
      actorId,
    )
    const businessArchitectureBaseline = await engine.businessArchitectureBaseline.create(
      businessArchitectureBaselineInput(
        business,
        stakeholder,
        outcome,
        capabilityMap,
        valueStreamModel,
        operatingModel,
        businessRuleCatalog,
      ),
      actorId,
    )
    const systemSolutionArchitecture = await engine.systemSolutionArchitecture.create(
      systemSolutionArchitectureInput(businessArchitectureBaseline),
      actorId,
    )
    const boundedContextModel = await engine.boundedContextModel.create(
      boundedContextModelInput(systemSolutionArchitecture),
      actorId,
    )
    const securityPrivacyAssessment = await engine.securityPrivacyAssessment.create(
      securityPrivacyAssessmentInput(boundedContextModel),
      actorId,
    )
    const processModel = await engine.processModel.create(
      processModelInput(
        valueStreamModel,
        operatingModel,
        businessRuleCatalog,
        boundedContextModel,
        securityPrivacyAssessment,
      ),
      actorId,
    )
    const dataModel = await engine.dataModel.create(
      dataModelInput(
        systemSolutionArchitecture,
        boundedContextModel,
        operatingModel,
        securityPrivacyAssessment,
        processModel,
      ),
      actorId,
    )
    const authorizationModel = await engine.authorizationModel.create(
      authorizationModelInput(
        systemSolutionArchitecture,
        boundedContextModel,
        operatingModel,
        securityPrivacyAssessment,
        processModel,
        dataModel,
      ),
      actorId,
    )
    const eventIntegrationModel = await engine.eventIntegrationModel.create(
      eventIntegrationModelInput(
        systemSolutionArchitecture,
        boundedContextModel,
        operatingModel,
        securityPrivacyAssessment,
        processModel,
        dataModel,
        authorizationModel,
      ),
      actorId,
    )
    const failureRecoveryModel = await engine.failureRecoveryModel.create(
      failureRecoveryModelInput(
        systemSolutionArchitecture,
        boundedContextModel,
        operatingModel,
        securityPrivacyAssessment,
        processModel,
        dataModel,
        authorizationModel,
        eventIntegrationModel,
      ),
      actorId,
    )
    const bundle = await engine.productStudio.buildPortableExport()
    expect(bundle.manifest.members.map((member) => member.path)).toEqual(expect.arrayContaining([
      `business-understanding/${business.id}.json`,
      `business-understanding-history/business-understanding-${business.id}-r1.json`,
      `business-capability-maps/${capabilityMap.id}.json`,
      `business-capability-map-history/business-capability-map-${capabilityMap.id}-r1.json`,
      `value-stream-models/${valueStreamModel.id}.json`,
      `value-stream-model-history/value-stream-model-${valueStreamModel.id}-r1.json`,
      `operating-models/${operatingModel.id}.json`,
      `operating-model-history/operating-model-${operatingModel.id}-r1.json`,
      `business-rule-catalogs/${businessRuleCatalog.id}.json`,
      `business-rule-catalog-history/business-rule-catalog-${businessRuleCatalog.id}-r1.json`,
      `business-architecture-baselines/${businessArchitectureBaseline.id}.json`,
      `business-architecture-baseline-history/business-architecture-baseline-${businessArchitectureBaseline.id}-r1.json`,
      `system-solution-architectures/${systemSolutionArchitecture.id}.json`,
      `system-solution-architecture-history/system-solution-architecture-${systemSolutionArchitecture.id}-r1.json`,
      `bounded-context-models/${boundedContextModel.id}.json`,
      `bounded-context-model-history/bounded-context-model-${boundedContextModel.id}-r1.json`,
      `security-privacy-assessments/${securityPrivacyAssessment.id}.json`,
      `security-privacy-assessment-history/security-privacy-assessment-${securityPrivacyAssessment.id}-r1.json`,
      `process-models/${processModel.id}.json`,
      `process-model-history/process-model-${processModel.id}-r1.json`,
      `data-models/${dataModel.id}.json`,
      `data-model-history/data-model-${dataModel.id}-r1.json`,
      `authorization-models/${authorizationModel.id}.json`,
      `authorization-model-history/authorization-model-${authorizationModel.id}-r1.json`,
      `event-integration-models/${eventIntegrationModel.id}.json`,
      `event-integration-model-history/event-integration-model-${eventIntegrationModel.id}-r1.json`,
      `failure-recovery-models/${failureRecoveryModel.id}.json`,
      `failure-recovery-model-history/failure-recovery-model-${failureRecoveryModel.id}-r1.json`,
      `stakeholder-models/${stakeholder.id}.json`,
      `stakeholder-model-history/stakeholder-model-${stakeholder.id}-r1.json`,
      `outcome-models/${outcome.id}.json`,
      `outcome-model-history/outcome-model-${outcome.id}-r1.json`,
    ]))
    await expect(engine.productStudio.previewImportBundle(bundle)).resolves.toMatchObject({
      status: "compatible",
      importMutation: "not-performed",
    })

    const forgeProcessValueStream = (content: unknown) => {
      const record = content as ProcessModel
      const valueStreamModelReference = { ...record.valueStreamModel, digest: digest("d") }
      return {
        ...record,
        valueStreamModel: valueStreamModelReference,
        membershipDigest: canonicalDigest({
          valueStreamModel: valueStreamModelReference,
          operatingModel: record.operatingModel,
          businessRuleCatalog: record.businessRuleCatalog,
          boundedContextModel: record.boundedContextModel,
          securityPrivacyAssessment: record.securityPrivacyAssessment,
        }),
      }
    }
    let forgedProcessBinding = replacePortableRecord(
      bundle,
      `process-models/${processModel.id}.json`,
      forgeProcessValueStream,
    )
    forgedProcessBinding = replacePortableRecord(
      forgedProcessBinding,
      `process-model-history/process-model-${processModel.id}-r1.json`,
      forgeProcessValueStream,
    )
    await expect(engine.productStudio.previewImportBundle(forgedProcessBinding))
      .rejects.toThrow(/Process Model .* Value Stream Model reference is unresolved/)

    const forgeDataProcess = (content: unknown) => {
      const record = content as DataModel
      const processModelReference = { ...record.processModel, digest: digest("c") }
      return {
        ...record,
        processModel: processModelReference,
        membershipDigest: canonicalDigest({
          systemSolutionArchitecture: record.systemSolutionArchitecture,
          boundedContextModel: record.boundedContextModel,
          operatingModel: record.operatingModel,
          securityPrivacyAssessment: record.securityPrivacyAssessment,
          processModel: processModelReference,
        }),
      }
    }
    let forgedDataBinding = replacePortableRecord(
      bundle,
      `data-models/${dataModel.id}.json`,
      forgeDataProcess,
    )
    forgedDataBinding = replacePortableRecord(
      forgedDataBinding,
      `data-model-history/data-model-${dataModel.id}-r1.json`,
      forgeDataProcess,
    )
    await expect(engine.productStudio.previewImportBundle(forgedDataBinding))
      .rejects.toThrow(/Data Model .* Process Model reference is unresolved/)

    const forgeAuthorizationData = (content: unknown) => {
      const record = content as AuthorizationModel
      const dataModelReference = { ...record.dataModel, digest: digest("b") }
      return {
        ...record,
        dataModel: dataModelReference,
        membershipDigest: canonicalDigest({
          systemSolutionArchitecture: record.systemSolutionArchitecture,
          boundedContextModel: record.boundedContextModel,
          operatingModel: record.operatingModel,
          securityPrivacyAssessment: record.securityPrivacyAssessment,
          processModel: record.processModel,
          dataModel: dataModelReference,
        }),
      }
    }
    let forgedAuthorizationBinding = replacePortableRecord(
      bundle,
      `authorization-models/${authorizationModel.id}.json`,
      forgeAuthorizationData,
    )
    forgedAuthorizationBinding = replacePortableRecord(
      forgedAuthorizationBinding,
      `authorization-model-history/authorization-model-${authorizationModel.id}-r1.json`,
      forgeAuthorizationData,
    )
    await expect(engine.productStudio.previewImportBundle(forgedAuthorizationBinding))
      .rejects.toThrow(/Authorization Model .* Data Model reference is unresolved/)

    const forgeEventAuthorization = (content: unknown) => {
      const record = content as EventIntegrationModel
      const authorizationModelReference = { ...record.authorizationModel, digest: digest("a") }
      return {
        ...record,
        authorizationModel: authorizationModelReference,
        membershipDigest: canonicalDigest({
          systemSolutionArchitecture: record.systemSolutionArchitecture,
          boundedContextModel: record.boundedContextModel,
          operatingModel: record.operatingModel,
          securityPrivacyAssessment: record.securityPrivacyAssessment,
          processModel: record.processModel,
          dataModel: record.dataModel,
          authorizationModel: authorizationModelReference,
        }),
      }
    }
    let forgedEventBinding = replacePortableRecord(
      bundle,
      `event-integration-models/${eventIntegrationModel.id}.json`,
      forgeEventAuthorization,
    )
    forgedEventBinding = replacePortableRecord(
      forgedEventBinding,
      `event-integration-model-history/event-integration-model-${eventIntegrationModel.id}-r1.json`,
      forgeEventAuthorization,
    )
    await expect(engine.productStudio.previewImportBundle(forgedEventBinding))
      .rejects.toThrow(/Event and Integration Model .* Authorization Model reference is unresolved/)

    const forgeFailureEventModel = (content: unknown) => {
      const record = content as FailureRecoveryModel
      const eventIntegrationModelReference = { ...record.eventIntegrationModel, digest: digest("9") }
      return {
        ...record,
        eventIntegrationModel: eventIntegrationModelReference,
        membershipDigest: canonicalDigest({
          systemSolutionArchitecture: record.systemSolutionArchitecture,
          boundedContextModel: record.boundedContextModel,
          operatingModel: record.operatingModel,
          securityPrivacyAssessment: record.securityPrivacyAssessment,
          processModel: record.processModel,
          dataModel: record.dataModel,
          authorizationModel: record.authorizationModel,
          eventIntegrationModel: eventIntegrationModelReference,
        }),
      }
    }
    let forgedFailureBinding = replacePortableRecord(
      bundle,
      `failure-recovery-models/${failureRecoveryModel.id}.json`,
      forgeFailureEventModel,
    )
    forgedFailureBinding = replacePortableRecord(
      forgedFailureBinding,
      `failure-recovery-model-history/failure-recovery-model-${failureRecoveryModel.id}-r1.json`,
      forgeFailureEventModel,
    )
    await expect(engine.productStudio.previewImportBundle(forgedFailureBinding))
      .rejects.toThrow(/Failure and Recovery Model .* Event and Integration Model reference is unresolved/)

    const rebound = replacePortableRecord(
      bundle,
      `stakeholder-models/${stakeholder.id}.json`,
      (content) => ({
        ...(content as StakeholderModel),
        businessUnderstanding: {
          ...(content as StakeholderModel).businessUnderstanding,
          digest: digest("f"),
        },
      }),
    )
    await expect(engine.productStudio.previewImportBundle(rebound))
      .rejects.toThrow(/Stakeholder Model does not match immutable history|Business Understanding reference is unresolved/)

    const forgeUnknownObjective = (content: unknown) => ({
      ...(content as BusinessCapabilityMap),
      capabilities: [{
        ...(content as BusinessCapabilityMap).capabilities[0]!,
        objectiveIds: ["invented-objective"],
      }],
    })
    let forgedCapabilityTrace = replacePortableRecord(
      bundle,
      `business-capability-maps/${capabilityMap.id}.json`,
      forgeUnknownObjective,
    )
    forgedCapabilityTrace = replacePortableRecord(
      forgedCapabilityTrace,
      `business-capability-map-history/business-capability-map-${capabilityMap.id}-r1.json`,
      forgeUnknownObjective,
    )
    await expect(engine.productStudio.previewImportBundle(forgedCapabilityTrace))
      .rejects.toThrow(/unknown bound objective/)

    const forgeUnknownCapability = (content: unknown) => ({
      ...(content as Awaited<ReturnType<typeof engine.valueStreamModel.read>>),
      valueStreams: [{
        ...(content as Awaited<ReturnType<typeof engine.valueStreamModel.read>>).valueStreams[0]!,
        capabilityKeys: ["invented-capability"],
        stages: [{
          ...(content as Awaited<ReturnType<typeof engine.valueStreamModel.read>>).valueStreams[0]!.stages[0]!,
          capabilityKeys: ["invented-capability"],
        }],
      }],
    })
    let forgedValueStreamTrace = replacePortableRecord(
      bundle,
      `value-stream-models/${valueStreamModel.id}.json`,
      forgeUnknownCapability,
    )
    forgedValueStreamTrace = replacePortableRecord(
      forgedValueStreamTrace,
      `value-stream-model-history/value-stream-model-${valueStreamModel.id}-r1.json`,
      forgeUnknownCapability,
    )
    await expect(engine.productStudio.previewImportBundle(forgedValueStreamTrace))
      .rejects.toThrow(/unknown bound capability/)

    const forgeUnknownOperatingStakeholder = (content: unknown) => ({
      ...(content as OperatingModel),
      roles: [{ ...(content as OperatingModel).roles[0]!, stakeholderKeys: ["invented-stakeholder"] },
        ...(content as OperatingModel).roles.slice(1)],
    })
    let forgedOperatingTrace = replacePortableRecord(
      bundle,
      `operating-models/${operatingModel.id}.json`,
      forgeUnknownOperatingStakeholder,
    )
    forgedOperatingTrace = replacePortableRecord(
      forgedOperatingTrace,
      `operating-model-history/operating-model-${operatingModel.id}-r1.json`,
      forgeUnknownOperatingStakeholder,
    )
    await expect(engine.productStudio.previewImportBundle(forgedOperatingTrace))
      .rejects.toThrow(/unknown bound stakeholder/)

    const forgeUnknownRuleOwner = (content: unknown) => ({
      ...(content as BusinessRuleCatalog),
      rules: [{ ...(content as BusinessRuleCatalog).rules[0]!, ownerRoleKey: "invented-role" }],
    })
    let forgedRuleTrace = replacePortableRecord(
      bundle,
      `business-rule-catalogs/${businessRuleCatalog.id}.json`,
      forgeUnknownRuleOwner,
    )
    forgedRuleTrace = replacePortableRecord(
      forgedRuleTrace,
      `business-rule-catalog-history/business-rule-catalog-${businessRuleCatalog.id}-r1.json`,
      forgeUnknownRuleOwner,
    )
    await expect(engine.productStudio.previewImportBundle(forgedRuleTrace))
      .rejects.toThrow(/unknown bound owner role/)

    const forgeBaselineCoverage = (content: unknown) => ({
      ...(content as BusinessArchitectureBaseline),
      coverage: (content as BusinessArchitectureBaseline).coverage.slice(1),
    })
    let forgedBaseline = replacePortableRecord(
      bundle,
      `business-architecture-baselines/${businessArchitectureBaseline.id}.json`,
      forgeBaselineCoverage,
    )
    forgedBaseline = replacePortableRecord(
      forgedBaseline,
      `business-architecture-baseline-history/business-architecture-baseline-${businessArchitectureBaseline.id}-r1.json`,
      forgeBaselineCoverage,
    )
    await expect(engine.productStudio.previewImportBundle(forgedBaseline))
      .rejects.toThrow(/coverage differs from exact bound records/)

    const forgeArchitectureTrace = (content: unknown) => ({
      ...(content as SystemSolutionArchitecture),
      concerns: [{
        ...(content as SystemSolutionArchitecture).concerns[0]!,
        affectedBusinessElementKeys: ["invented-capability"],
      }],
    })
    let forgedArchitecture = replacePortableRecord(
      bundle,
      `system-solution-architectures/${systemSolutionArchitecture.id}.json`,
      forgeArchitectureTrace,
    )
    forgedArchitecture = replacePortableRecord(
      forgedArchitecture,
      `system-solution-architecture-history/system-solution-architecture-${systemSolutionArchitecture.id}-r1.json`,
      forgeArchitectureTrace,
    )
    await expect(engine.productStudio.previewImportBundle(forgedArchitecture))
      .rejects.toThrow(/unknown bound Business Architecture element/)

    const forgeContextOwnership = (content: unknown) => ({
      ...(content as BoundedContextModel),
      boundedContexts: (content as BoundedContextModel).boundedContexts.map((entry) => entry.key === "product-studio"
        ? { ...entry, ownerRoleKey: "invented-owner" }
        : entry),
    })
    let forgedContext = replacePortableRecord(
      bundle,
      `bounded-context-models/${boundedContextModel.id}.json`,
      forgeContextOwnership,
    )
    forgedContext = replacePortableRecord(
      forgedContext,
      `bounded-context-model-history/bounded-context-model-${boundedContextModel.id}-r1.json`,
      forgeContextOwnership,
    )
    await expect(engine.productStudio.previewImportBundle(forgedContext))
      .rejects.toThrow(/unknown bound Operating Model role/)

    const forgeSecurityAuthority = (content: unknown) => ({
      ...(content as SecurityPrivacyAssessment),
      governance: {
        ...(content as SecurityPrivacyAssessment).governance,
        securityAuthorityRoleKey: "invented-security-authority",
      },
    })
    let forgedSecurityTrace = replacePortableRecord(
      bundle,
      `security-privacy-assessments/${securityPrivacyAssessment.id}.json`,
      forgeSecurityAuthority,
    )
    forgedSecurityTrace = replacePortableRecord(
      forgedSecurityTrace,
      `security-privacy-assessment-history/security-privacy-assessment-${securityPrivacyAssessment.id}-r1.json`,
      forgeSecurityAuthority,
    )
    await expect(engine.productStudio.previewImportBundle(forgedSecurityTrace))
      .rejects.toThrow(/unknown bound Operating Model role/)
  })

  it("requires explicit human disclosure review for confidential business records", async () => {
    const business = await engine.businessUnderstanding.createBusinessUnderstanding(
      businessInput({ informationClassification: "confidential" }),
      actorId,
    )
    await expect(engine.productStudio.buildPortableExport()).rejects.toThrow(/explicit disclosure review/)
    await expect(engine.productStudio.buildPortableExport({
      actorId,
      reviewedAt: "2026-07-25T03:00:00.000Z",
      reviewedRecordIds: [business.id],
    })).resolves.toMatchObject({
      manifest: {
        disclosureReview: {
          reviewedRecordIds: [business.id],
          reviewedBy: { kind: "human", id: actorId },
        },
      },
    })
  })

  it("rejects forged authority, unknown stakeholder bindings, stale context, secrets, and terminal mutation", async () => {
    const business = await engine.businessUnderstanding.createBusinessUnderstanding(businessInput(), actorId)
    expect(() => stakeholderModelInputSchema.parse(stakeholderInput(business, {
      stakeholders: [{
        ...stakeholderInput(business).stakeholders[0]!,
        authority: {
          standing: "verified",
          domains: ["Product approval"],
          scope: ["All Initiative effects"],
          basis: "A role label alone is incorrectly presented as verified authority.",
          sources: [reference()],
        },
      }],
    }))).toThrow(/Verified authority requires/)

    const stakeholder = await engine.businessUnderstanding.createStakeholderModel(
      stakeholderInput(business),
      actorId,
    )
    await expect(engine.businessUnderstanding.createOutcomeModel(
      outcomeInput(business, stakeholder, {
        outcomes: [{
          ...outcomeInput(business, stakeholder).outcomes[0]!,
          beneficiaryStakeholderKeys: ["missing-stakeholder"],
        }],
      }),
      actorId,
    )).rejects.toThrow(/beneficiaries/)

    await expect(engine.businessUnderstanding.reviseBusinessUnderstanding(
      business.id,
      business.revision,
      businessInput({
        context: { ...context(), productDigest: digest("f") },
      }),
      actorId,
    )).rejects.toThrow(/exact current Product and Initiative/)

    expect(() => businessInput({
      problem: attributed("api_key=sk-live-abcdefghijklmnopqrstuvwxyz123456 is not portable context"),
    })).not.toThrow()
    await expect(engine.businessUnderstanding.reviseBusinessUnderstanding(
      business.id,
      business.revision,
      businessInput({
        problem: attributed("api_key=sk-live-abcdefghijklmnopqrstuvwxyz123456 is not portable context"),
      }),
      actorId,
    )).rejects.toThrow(/secret-shaped/)

    await engine.updateInitiativeState(initiative.id, "cancelled", "The bounded test Initiative is closed.", actorId)
    initiative = await engine.readInitiative(initiative.id)
    await expect(engine.businessUnderstanding.reviseStakeholderModel(
      stakeholder.id,
      stakeholder.revision,
      stakeholderInput(business),
      actorId,
    )).rejects.toThrow(/Terminal Initiative cancelled/)
  })
})
