import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  businessCapabilityMapInputSchema,
  stakeholderCategoryValues,
  stakeholderModelInputSchema,
  valueStreamModelInputSchema,
  type BusinessCapabilityMap,
  type BusinessCapabilityMapInput,
  type BusinessUnderstanding,
  type BusinessUnderstandingInput,
  type ExactSourceReference,
  type Initiative,
  type OutcomeModelInput,
  type Product,
  type ProductExportBundle,
  type SourceRecord,
  type SourceRecordInput,
  type StakeholderModel,
  type StakeholderModelInput,
  type ValueStreamModelInput,
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
    const bundle = await engine.productStudio.buildPortableExport()
    expect(bundle.manifest.members.map((member) => member.path)).toEqual(expect.arrayContaining([
      `business-understanding/${business.id}.json`,
      `business-understanding-history/business-understanding-${business.id}-r1.json`,
      `business-capability-maps/${capabilityMap.id}.json`,
      `business-capability-map-history/business-capability-map-${capabilityMap.id}-r1.json`,
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
