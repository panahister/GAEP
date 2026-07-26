import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  boundedContextModelInputSchema,
  businessArchitectureBaselineInputSchema,
  businessCapabilityMapInputSchema,
  businessRuleCatalogInputSchema,
  stakeholderCategoryValues,
  stakeholderModelInputSchema,
  systemSolutionArchitectureInputSchema,
  valueStreamModelInputSchema,
  type BoundedContextModelInput,
  type BoundedContextModel,
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
      `stakeholder-models/${stakeholder.id}.json`,
      `stakeholder-model-history/stakeholder-model-${stakeholder.id}-r1.json`,
      `outcome-models/${outcome.id}.json`,
      `outcome-model-history/outcome-model-${outcome.id}-r1.json`,
    ]))
    await expect(engine.productStudio.previewImportBundle(bundle)).resolves.toMatchObject({
      status: "compatible",
      importMutation: "not-performed",
    })

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
