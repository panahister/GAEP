import { randomUUID } from "node:crypto"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { canonicalDigest } from "@gaep/agent-sdk"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { GaepEngine } from "./engine.js"

const relativeRoot = { kind: "workspace-relative" as const, path: "." }
const relativeSource = { kind: "workspace-relative" as const, path: "src" }

describe("Product Studio domain engine", () => {
  let workspace: string
  let engine: GaepEngine

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "gaep-product-studio-"))
    engine = new GaepEngine(workspace, [])
  })

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true })
  })

  async function initialize() {
    const product = await engine.createProduct({
      name: "Atlas",
      summary: "A governed Product Studio test workspace.",
      problem: "Product intent and delivery evidence can become disconnected over time.",
      affectedUsers: "Founders and product engineering teams",
      desiredOutcome: "Design, work, and evidence remain reconstructable and reviewable.",
      successSignals: ["A complete Product-to-evidence trace can be inspected"],
      firstWorkflow: "Design the Product, plan one Change, and collect bounded evidence.",
      exclusions: ["Automatic production deployment"],
      profile: "software",
    }, "founder")
    const initiative = await engine.createInitiative({
      title: "Founder workflow",
      outcome: "Complete one governed local Product workflow.",
      scope: ["Product Studio domain"],
      exclusions: ["External effects"],
    }, "founder")
    return { product, initiative }
  }

  function completeDraft<T extends Awaited<ReturnType<typeof engine.productStudio.startOrResumeDesignDraft>>>(draft: T): T {
    const copy = structuredClone(draft)
    for (const section of Object.values(copy.sections)) {
      section.summary = `Completed ${section.sectionId} design section.`
      section.fields = section.fields.map((field) => ({
        ...field,
        value: `Reviewed answer for ${field.key}`,
        state: "complete" as const,
      }))
    }
    return copy
  }

  it("keeps resumable drafts local and creates explicit governed Product revisions", async () => {
    const { product } = await initialize()
    const auditBeforeDraft = await engine.repository.verifyAudit()
    const draft = await engine.productStudio.startOrResumeDesignDraft(product.revision ?? 1)
    expect(Object.keys(draft.sections)).toEqual([
      "overview", "direction", "users-jobs", "outcomes", "scope", "delivery", "architecture",
      "risks-decisions", "trace", "agents-tools", "runs-evidence", "readiness",
    ])
    expect((await engine.repository.verifyAudit()).events).toBe(auditBeforeDraft.events)

    const completed = completeDraft(draft)
    const saved = await engine.productStudio.saveDesignDraft({
      draftId: draft.id,
      sections: completed.sections,
      expectedDraftRevision: 1,
      expectedProductRevision: 1,
    })
    expect(saved.revision).toBe(2)
    expect(engine.productStudio.evaluateDesignReadiness(saved).status).toBe("ready")
    expect((await engine.repository.verifyAudit()).events).toBe(auditBeforeDraft.events)

    const result = await engine.productStudio.createDesignRevision({
      draftId: saved.id,
      expectedDraftRevision: 2,
      expectedProductRevision: 1,
    }, "founder")
    expect(result.revision.revision).toBe(1)
    expect(result.revision.productRevision).toBe(2)
    expect(result.revision.readiness.status).toBe("ready")
    expect(result.product.revision).toBe(2)
    expect(result.product.currentDesign).toEqual({
      id: result.revision.id,
      revision: result.revision.revision,
      digest: canonicalDigest(result.revision),
    })
    expect((await engine.productStudio.readDesignDraft(product.id)).baseDesignRevisionId).toBe(result.revision.id)
    expect((await engine.productStudio.listProductRevisions()).map((record) => record.revision)).toEqual([2, 1])
    expect((await engine.repository.verifyAudit()).valid).toBe(true)
  })

  it("reports missing, conflicting, and explicitly deferred design fields without overstating readiness", async () => {
    const { product } = await initialize()
    const draft = completeDraft(await engine.productStudio.startOrResumeDesignDraft(product.revision ?? 1))
    const firstWorkflow = draft.sections.scope.fields.find((field) => field.key === "first-workflow")!
    draft.sections.scope.fields = draft.sections.scope.fields.filter((field) => field.key !== "first-workflow")
    expect(engine.productStudio.evaluateDesignReadiness(draft).sections.find(
      (section) => section.sectionId === "scope",
    )?.missingFields).toContain("first-workflow")
    draft.sections.scope.fields.push(firstWorkflow)
    draft.sections.direction.fields[0] = {
      ...draft.sections.direction.fields[0]!,
      state: "deferred",
      deferredReason: "Needs participant research",
      revisitTrigger: "Before first external pilot",
    }
    let report = engine.productStudio.evaluateDesignReadiness(draft)
    expect(report.status).toBe("ready-with-deferrals")
    expect(report.deferredFieldCount).toBe(1)

    draft.sections.outcomes.conflicts.push({
      id: randomUUID(),
      fieldKeys: ["desired-outcomes", "success-measures"],
      statement: "The current success measure contradicts the desired outcome.",
      state: "open",
    })
    report = engine.productStudio.evaluateDesignReadiness(draft)
    expect(report.status).toBe("incomplete")
    expect(report.openConflictIds).toHaveLength(1)
    expect(report.claimBoundary).toBe("design-readiness-is-not-implementation-approval")
  })

  it("enforces optimistic draft and governed-record revisions and rejects immutable patch fields", async () => {
    const { product, initiative } = await initialize()
    const draft = await engine.productStudio.startOrResumeDesignDraft(product.revision ?? 1)
    const completed = completeDraft(draft)
    const saved = await engine.productStudio.saveDesignDraft({
      draftId: draft.id,
      sections: completed.sections,
      expectedDraftRevision: 1,
      expectedProductRevision: 1,
    })
    await expect(engine.productStudio.saveDesignDraft({
      draftId: saved.id,
      sections: completed.sections,
      expectedDraftRevision: 1,
      expectedProductRevision: 1,
    })).rejects.toThrow(/revision conflict/i)

    const change = await engine.productStudio.createChange({
      initiativeId: initiative.id,
      title: "Create the bounded domain model",
      summary: "Introduce portable domain records with exact lifecycle and evidence semantics.",
      baseline: { kind: "genesis", declaration: "No prior implementation baseline exists.", rationale: "First domain slice." },
      effectEnvelope: ["reversible-change"],
    }, 1, "founder")
    await expect(engine.productStudio.reviseChange(
      change.id,
      1,
      { productId: randomUUID(), title: "Unsafe move" } as never,
      "founder",
    )).rejects.toThrow(/immutable or unsupported fields/i)
    await engine.productStudio.reviseChange(change.id, 1, { state: "planned" }, "founder", "Plan the bounded Change.")
    await expect(engine.productStudio.reviseChange(change.id, 1, { state: "active" }, "founder"))
      .rejects.toThrow(/revision conflict/i)
  })

  it("requires exact local baselines or an explicit genesis declaration", async () => {
    const { product, initiative } = await initialize()
    const history = await engine.productStudio.readProductRevision(1)
    await expect(engine.productStudio.createChange({
      initiativeId: initiative.id,
      title: "Invalid baseline",
      summary: "This Change must not be created against a fabricated Product digest.",
      baseline: {
        kind: "exact",
        subjectType: "product",
        subjectId: product.id,
        revision: 1,
        digest: `sha256:${"0".repeat(64)}`,
      },
      effectEnvelope: ["observe"],
    }, 1, "founder")).rejects.toThrow(/digest does not match/i)

    await expect(engine.productStudio.createChange({
      initiativeId: initiative.id,
      title: "Exact baseline",
      summary: "This Change binds the exact initial Product representation.",
      baseline: {
        kind: "exact",
        subjectType: "product",
        subjectId: product.id,
        revision: 1,
        digest: history.productDigest,
      },
      effectEnvelope: ["observe"],
    }, 1, "founder")).resolves.toMatchObject({ baseline: { kind: "exact" } })
  })

  it("rejects missing dependencies, self-dependencies, cycles, and premature dependency execution", async () => {
    const { initiative } = await initialize()
    const change = await engine.productStudio.createChange({
      initiativeId: initiative.id,
      title: "DAG validation",
      summary: "Validate that Work Items form one acyclic Change-local dependency graph.",
      baseline: { kind: "genesis", declaration: "No work graph exists yet.", rationale: "Create a fresh plan." },
      effectEnvelope: ["reversible-change"],
    }, 1, "founder")
    const first = await engine.productStudio.createWorkItem({
      changeId: change.id,
      title: "Define contracts",
      objective: "Define and validate the portable contracts.",
      dependsOn: [],
      completionCriteria: ["Schemas parse the positive fixtures"],
      evidenceCriteria: ["Typecheck output is retained"],
      scope: { read: [relativeRoot], write: [relativeSource], effects: [] },
      owner: { kind: "human", id: "founder" },
    }, 1, "founder")
    const second = await engine.productStudio.createWorkItem({
      changeId: change.id,
      title: "Implement service",
      objective: "Implement the engine operations after contracts exist.",
      dependsOn: [first.id],
      completionCriteria: ["Operations preserve revisions and audit receipts"],
      evidenceCriteria: ["Engine tests pass"],
      scope: { read: [relativeRoot], write: [relativeSource], effects: [] },
      owner: { kind: "agent", id: "local-agent" },
    }, 1, "founder")

    await expect(engine.productStudio.reviseWorkItem(first.id, 1, { dependsOn: [second.id] }, "founder"))
      .rejects.toThrow(/cycle/i)
    const plannedSecond = await engine.productStudio.reviseWorkItem(
      second.id, 1, { state: "planned" }, "founder", "Plan dependent implementation work.",
    )
    await expect(engine.productStudio.reviseWorkItem(
      second.id, plannedSecond.revision, { state: "ready" }, "founder", "Request readiness after dependencies.",
    ))
      .rejects.toThrow(/before every dependency is completed/i)
    await expect(engine.productStudio.createWorkItem({
      changeId: change.id,
      title: "Missing dependency",
      objective: "This invalid item references an absent dependency.",
      dependsOn: [randomUUID()],
      completionCriteria: ["Never committed"],
      evidenceCriteria: ["Rejection"],
      scope: { read: [], write: [], effects: [] },
      owner: { kind: "unassigned" },
    }, 1, "founder")).rejects.toThrow(/does not exist/i)
  })

  it("keeps recommendations distinct from human decisions and requires human risk acceptance", async () => {
    const { product } = await initialize()
    const recommended = randomUUID()
    const alternative = randomUUID()
    const decision = await engine.productStudio.createDecision({
      question: "Which persistence model should the local Founder Edition use?",
      options: [
        { id: recommended, label: "Repository JSON", description: "Portable local records.", tradeoffs: ["Needs migration discipline"] },
        { id: alternative, label: "Embedded database", description: "Indexed local state.", tradeoffs: ["Less transparent"] },
      ],
      recommendation: {
        optionId: recommended,
        rationale: "Repository JSON best preserves inspectability.",
        proposedBy: { kind: "agent", id: "analysis-agent" },
        proposedAt: new Date().toISOString(),
      },
      dissentAndUncertainty: ["Large workspaces may need an index"],
      affectedRecords: [],
    }, product.revision ?? 1, "founder")
    expect(decision.state).toBe("open")
    expect(decision.selectedOutcome).toBeUndefined()
    await expect(engine.productStudio.reviseDecision(
      decision.id,
      1,
      { productId: randomUUID() } as never,
      "founder",
    )).rejects.toThrow(/immutable or unsupported fields/i)
    await expect(engine.productStudio.reviseDecision(decision.id, 1, {
      state: "decided",
      selectedOutcome: {
        optionId: alternative,
        rationale: "Invalid non-human decision",
        selectedBy: { kind: "agent", id: "analysis-agent" },
        selectedAt: new Date().toISOString(),
      },
    } as never, "founder")).rejects.toThrow()
    const decided = await engine.productStudio.reviseDecision(decision.id, 1, {
      state: "decided",
      selectedOutcome: {
        optionId: alternative,
        rationale: "The Founder accepts the portability tradeoff after review.",
        selectedBy: { kind: "human", id: "founder" },
        selectedAt: new Date().toISOString(),
      },
    }, "founder", "The Founder records the selected outcome after review.")
    expect(decided.recommendation?.optionId).toBe(recommended)
    expect(decided.selectedOutcome?.optionId).toBe(alternative)

    const risk = await engine.productStudio.createRisk({
      title: "Local evidence rewrite",
      cause: "A privileged local process can rewrite repository files.",
      condition: "No external immutable anchor is configured.",
      consequence: "A coherent local rewrite may evade the local integrity model.",
      likelihood: "unlikely",
      impact: "major",
      uncertainty: "Depends on host compromise and filesystem controls.",
      treatment: "Expose the boundary and support future external anchors.",
      owner: { kind: "human", id: "founder" },
      reviewTriggers: ["External collaboration is enabled"],
      residualRisk: "Privileged local rewrite remains possible.",
      evidence: [],
    }, product.revision ?? 1, "founder")
    await expect(engine.productStudio.reviseRisk(
      risk.id, 1, { state: "accepted" }, "founder", "Evaluate explicit residual-risk acceptance.",
    ))
      .rejects.toThrow(/human acceptance/i)
    await expect(engine.productStudio.reviseRisk(risk.id, 1, {
      state: "accepted",
      acceptance: {
        acceptedBy: { kind: "human", id: "founder" },
        rationale: "Accepted for local-only dogfooding, not multi-party assurance.",
        acceptedAt: new Date().toISOString(),
      },
    }, "founder", "The Founder accepts this bounded residual risk.")).resolves.toMatchObject({ state: "accepted" })
  })

  it("rejects host paths and secret-shaped portable values", async () => {
    const { product, initiative } = await initialize()
    const change = await engine.productStudio.createChange({
      initiativeId: initiative.id,
      title: "Portable paths",
      summary: "Ensure machine-local absolute paths do not enter portable work records.",
      baseline: { kind: "genesis", declaration: "No work exists.", rationale: "Portable test." },
      effectEnvelope: ["observe"],
    }, product.revision ?? 1, "founder")
    await expect(engine.productStudio.createWorkItem({
      changeId: change.id,
      title: "Unsafe scope",
      objective: "Attempt to persist a host path.",
      dependsOn: [],
      completionCriteria: ["Rejected"],
      evidenceCriteria: ["Validation error"],
      scope: {
        read: [{ kind: "workspace-relative", path: "/Users/example/private" }],
        write: [],
        effects: [],
      },
      owner: { kind: "unassigned" },
    } as never, 1, "founder")).rejects.toThrow(/relative paths/i)
    await expect(engine.productStudio.createWorkItem({
      changeId: change.id,
      title: "Unsafe file URI",
      objective: "Attempt to disguise a host path as an external URI.",
      dependsOn: [],
      completionCriteria: ["Rejected"],
      evidenceCriteria: ["Validation error"],
      scope: { read: [{ kind: "external-uri", uri: "file:///Users/example/private" }], write: [], effects: [] },
      owner: { kind: "unassigned" },
    } as never, 1, "founder")).rejects.toThrow(/External URIs/i)

    await expect(engine.productStudio.createRequirement({
      key: "SEC-001",
      statement: "Never persist api_key=sk-abcdefghijklmnopqrstuvwxyz123456 in governed content.",
      rationale: "Secret-shaped values must fail before persistence.",
      priority: "must",
      verificationCriteria: ["Secret scanner rejects the fixture"],
      sourceRecords: [],
    }, 1, "founder")).rejects.toThrow(/secret-shaped/i)
  })

  it("preserves immutable revision history and freezes terminal records", async () => {
    const { product } = await initialize()
    const requirement = await engine.productStudio.createRequirement({
      key: "HISTORY-001",
      statement: "Every governed record revision remains exactly reconstructable.",
      rationale: "Trace references must not silently float to the latest content.",
      priority: "must",
      verificationCriteria: ["Read both immutable snapshots by exact revision"],
      sourceRecords: [],
    }, product.revision ?? 1, "founder")
    const accepted = await engine.productStudio.reviseRequirement(
      requirement.id,
      requirement.revision,
      { state: "accepted" },
      "founder",
      "Accept the immutable-history requirement.",
    )
    const satisfied = await engine.productStudio.reviseRequirement(
      accepted.id,
      accepted.revision,
      { state: "satisfied" },
      "founder",
      "The history implementation and tests satisfy the requirement.",
    )
    const history = await engine.productStudio.listRecordHistory("requirement", requirement.id)
    expect(history.map((entry) => entry.revision)).toEqual([3, 2, 1])
    expect(history[0]?.recordDigest).toBe(canonicalDigest(satisfied))
    expect(history[1]?.predecessorDigest).toBe(history[2]?.recordDigest)
    expect((await engine.productStudio.readRecordHistory("requirement", requirement.id, 1)).snapshot)
      .toMatchObject({ statement: requirement.statement, state: "proposed" })
    await expect(engine.productStudio.reviseRequirement(
      satisfied.id,
      satisfied.revision,
      { statement: "Attempt to rewrite satisfied history." },
      "founder",
    )).rejects.toThrow(/terminal Requirement/i)
  })

  it("requires a current verified attestation for an external exact baseline", async () => {
    const { product, initiative } = await initialize()
    const externalDigest = canonicalDigest({ source: "https://example.test/spec", revision: 7 })
    const verifiedAt = new Date().toISOString()
    const limitations = ["The verifier confirms content identity, not Product suitability."]
    const evidence = await engine.productStudio.createEvidence({
      subjects: [{
        recordType: "product",
        recordId: product.id,
        revision: product.revision ?? 1,
        digest: canonicalDigest(product),
      }],
      origin: {
        kind: "external",
        locator: { kind: "external-uri", uri: "https://example.test/spec" },
        actor: { kind: "human", id: "founder" },
      },
      method: "Verify the external source digest against the reviewed artifact.",
      result: { status: "pass", summary: "The reviewed external artifact matches the recorded digest." },
      artifactDigest: externalDigest,
      limitations,
      verification: {
        status: "verified",
        verifier: { kind: "human", id: "founder" },
        method: "Founder compared the reviewed artifact and recorded digest.",
        verifiedAt,
      },
      freshness: { status: "fresh", assessedAt: verifiedAt, basis: "Verified in the current review." },
      collectedAt: verifiedAt,
      validUntil: new Date(Date.now() + 60_000).toISOString(),
    }, product.revision ?? 1, "founder")
    await expect(engine.productStudio.createChange({
      initiativeId: initiative.id,
      title: "Bind reviewed external baseline",
      summary: "Use only the exact external artifact established by verified Evidence.",
      baseline: {
        kind: "exact",
        subjectType: "external",
        subjectId: "https://example.test/spec",
        revision: 7,
        digest: externalDigest,
        externalAttestation: {
          evidenceRecordId: evidence.id,
          verifiedBy: { kind: "human", id: "founder" },
          verifiedAt,
          limitations,
        },
      },
      effectEnvelope: ["observe"],
    }, product.revision ?? 1, "founder")).resolves.toMatchObject({ baseline: { subjectType: "external" } })

    await expect(engine.productStudio.createChange({
      initiativeId: initiative.id,
      title: "Reject forged external baseline",
      summary: "A changed source identity must not reuse unrelated Evidence.",
      baseline: {
        kind: "exact",
        subjectType: "external",
        subjectId: "https://example.test/other",
        revision: 7,
        digest: externalDigest,
        externalAttestation: {
          evidenceRecordId: evidence.id,
          verifiedBy: { kind: "human", id: "founder" },
          verifiedAt,
          limitations,
        },
      },
      effectEnvelope: ["observe"],
    }, product.revision ?? 1, "founder")).rejects.toThrow(/different source/i)
  })

  it("invalidates Evidence verification after material change and rejects future timestamps", async () => {
    const { product } = await initialize()
    const now = new Date().toISOString()
    const base = {
      subjects: [{
        recordType: "product" as const,
        recordId: product.id,
        revision: product.revision ?? 1,
        digest: canonicalDigest(product),
      }],
      origin: {
        kind: "manual-observation" as const,
        locator: { kind: "logical" as const, value: "evidence-invalidation-fixture" },
        actor: { kind: "human" as const, id: "founder" },
      },
      method: "Record one bounded observation and its exact digest.",
      result: { status: "pass" as const, summary: "Initial observation passed." },
      artifactDigest: canonicalDigest({ result: "initial" }),
      limitations: ["Local author evidence only."],
      verification: {
        status: "verified" as const,
        verifier: { kind: "human" as const, id: "founder" },
        method: "Review the observation and digest.",
        verifiedAt: now,
      },
      freshness: { status: "fresh" as const, assessedAt: now, basis: "Current observation." },
      collectedAt: now,
    }
    const evidence = await engine.productStudio.createEvidence(base, product.revision ?? 1, "founder")
    const revised = await engine.productStudio.reviseEvidence(evidence.id, evidence.revision, {
      result: { status: "fail", summary: "The material result changed after re-evaluation." },
      artifactDigest: canonicalDigest({ result: "changed" }),
    }, "founder")
    expect(revised.verification.status).toBe("unverified")
    expect(revised.freshness.status).toBe("unknown")

    const future = new Date(Date.now() + 10 * 60_000).toISOString()
    await expect(engine.productStudio.createEvidence({
      ...base,
      verification: { status: "unverified" },
      freshness: { status: "unknown", assessedAt: future, basis: "Invalid future fixture." },
      collectedAt: future,
    }, product.revision ?? 1, "founder")).rejects.toThrow(/future/i)
  })

  it("supports a complete Product-to-evidence trace, search, staleness, and governed tamper detection", async () => {
    const { initiative } = await initialize()
    const change = await engine.productStudio.createChange({
      initiativeId: initiative.id,
      title: "Traceable local workflow",
      summary: "Connect requirement, architecture, work, evidence, and impact analysis.",
      baseline: { kind: "genesis", declaration: "First traceable workflow.", rationale: "No prior domain implementation." },
      effectEnvelope: ["reversible-change"],
    }, 1, "founder")
    const requirement = await engine.productStudio.createRequirement({
      key: "TRACE-001",
      statement: "Every completed Work Item must identify proportionate evidence criteria.",
      rationale: "Completion without evidence is not trustworthy.",
      priority: "must",
      verificationCriteria: ["Inspect the Work Item evidence criteria"],
      sourceRecords: [{ recordType: "change", recordId: change.id, revision: change.revision, digest: canonicalDigest(change) }],
    }, 1, "founder")
    const architecture = await engine.productStudio.createArchitectureRecord({
      recordType: "direction",
      title: "Repository-native trace records",
      description: "Store portable relationship records in the governed Product repository.",
      rationale: "Users can inspect and export trace without a provider.",
      assumptions: ["One local Product per workspace"],
      constraints: ["No machine-local absolute paths"],
      affectedRecords: [{
        recordType: "requirement",
        recordId: requirement.id,
        revision: requirement.revision,
        digest: canonicalDigest(requirement),
      }],
    }, 1, "founder")
    const workItem = await engine.productStudio.createWorkItem({
      changeId: change.id,
      title: "Implement trace analysis",
      objective: "Resolve links and report stale dependants.",
      dependsOn: [],
      completionCriteria: ["Impact analysis returns upstream and downstream links"],
      evidenceCriteria: ["A passing engine integration test"],
      scope: { read: [relativeRoot], write: [relativeSource], effects: [] },
      owner: { kind: "agent", id: "local-agent" },
    }, 1, "founder")
    const collectedAt = new Date().toISOString()
    const evidence = await engine.productStudio.createEvidence({
      subjects: [
        { recordType: "work-item", recordId: workItem.id, revision: workItem.revision, digest: canonicalDigest(workItem) },
        { recordType: "requirement", recordId: requirement.id, revision: requirement.revision, digest: canonicalDigest(requirement) },
      ],
      origin: {
        kind: "local-command",
        locator: { kind: "logical", value: "engine-test-suite" },
        actor: { kind: "system", id: "vitest" },
      },
      method: "Run the isolated Product Studio integration suite.",
      result: { status: "pass", summary: "The trace and revision scenario passed." },
      artifactDigest: canonicalDigest({ result: "pass", suite: "product-studio" }),
      limitations: ["This is local author evidence and not independent assurance."],
      verification: { status: "unverified" },
      freshness: { status: "fresh", assessedAt: collectedAt, basis: "Collected in the current test run." },
      collectedAt,
    }, 1, "founder")
    const implementationLink = await engine.productStudio.createTraceLink({
      source: { recordType: "work-item", recordId: workItem.id, revision: 1, digest: canonicalDigest(workItem) },
      relationship: "implements",
      target: { recordType: "requirement", recordId: requirement.id, revision: 1, digest: canonicalDigest(requirement) },
      provenance: { kind: "human", actorId: "founder", rationale: "The Work Item implements the stated trace requirement." },
    }, 1, "founder")
    await engine.productStudio.createTraceLink({
      source: { recordType: "evidence", recordId: evidence.id, revision: 1, digest: canonicalDigest(evidence) },
      relationship: "validates",
      target: { recordType: "work-item", recordId: workItem.id, revision: 1, digest: canonicalDigest(workItem) },
      provenance: { kind: "system", actorId: "vitest", rationale: "The test result exercises the Work Item criteria." },
    }, 1, "founder")
    await engine.productStudio.createTraceLink({
      source: { recordType: "architecture", recordId: architecture.id, revision: 1, digest: canonicalDigest(architecture) },
      relationship: "affects",
      target: { recordType: "requirement", recordId: requirement.id, revision: 1, digest: canonicalDigest(requirement) },
      provenance: { kind: "human", actorId: "founder", rationale: "The architecture direction constrains trace storage." },
    }, 1, "founder")

    const impact = await engine.productStudio.impactAnalysis({
      recordType: "work-item",
      recordId: workItem.id,
      revision: workItem.revision,
      digest: canonicalDigest(workItem),
    })
    expect(impact.upstream).toHaveLength(1)
    expect(impact.downstream).toHaveLength(1)
    expect(impact.validatingEvidence).toHaveLength(1)
    expect(await engine.productStudio.search({ query: "proportionate evidence" })).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "requirement", id: requirement.id }),
    ]))

    await engine.productStudio.reviseRequirement(requirement.id, 1, {
      statement: "Every completed Work Item must identify and satisfy proportionate evidence criteria.",
    }, "founder")
    const staleImpact = await engine.productStudio.impactAnalysis({
      recordType: "work-item",
      recordId: workItem.id,
      revision: workItem.revision,
      digest: canonicalDigest(workItem),
    })
    expect(staleImpact.stale.map((link) => link.id)).toContain(implementationLink.id)

    const evidencePath = join(workspace, ".gaep", "evidence", `${evidence.id}.json`)
    const originalEvidence = await readFile(evidencePath, "utf8")
    const editedEvidence = JSON.parse(originalEvidence) as Record<string, unknown>
    editedEvidence.method = "Direct valid-JSON edit"
    await writeFile(evidencePath, `${JSON.stringify(editedEvidence, null, 2)}\n`)
    expect((await engine.workspaceHealth()).status).toBe("invalid")
    await writeFile(evidencePath, originalEvidence)
    const restoredHealth = await engine.workspaceHealth()
    expect(restoredHealth.status).toBe("degraded")
    expect(restoredHealth.issues.some((issue) => issue.code === "product.trace-stale")).toBe(true)
  })
})
