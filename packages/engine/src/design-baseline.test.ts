import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  type DesignBaseline,
  type DesignBaselineInput,
  type ExactSourceReference,
  type HumanDesignApproval,
  type HumanDesignApprovalStatus,
  type Initiative,
  type Product,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  DesignBaselineService,
  designBaselineApprovalReference,
  designBaselineDesignationReceiptDigest,
} from "./design-baseline.js"
import { GaepEngine } from "./engine.js"
import type { SourceGovernanceService } from "./source-governance.js"

const actorId = "design-baseline-recorder"
const digest = (value: string) => `sha256:${value.repeat(64).slice(0, 64)}` as const

describe("Design Baseline service", () => {
  let workspace: string
  let engine: GaepEngine
  let service: DesignBaselineService
  let product: Product
  let initiative: Initiative
  let approval: HumanDesignApproval
  let approvalStatus: HumanDesignApprovalStatus
  let sourceReference: ExactSourceReference
  let currentSource: Record<string, unknown>

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "gaep-design-baseline-"))
    engine = new GaepEngine(workspace, [])
    product = await engine.createProduct({
      name: "Atlas",
      summary: "A governed Product with explicit Design Baseline candidate boundaries.",
      problem: "Mutable design labels can obscure exact candidate membership and lineage.",
      affectedUsers: "Product owners, designers, engineers, reviewers, and assurance teams",
      desiredOutcome: "Every proposed baseline remains immutable, traceable, and non-authorizing.",
      successSignals: ["Every baseline proposal binds one exact approved-candidate scope"],
      firstWorkflow: "Inspect one bounded Design Baseline candidate.",
      exclusions: ["Automatic approval", "Automatic baseline designation", "Automatic phase entry"],
      profile: "software",
    }, actorId)
    initiative = await engine.createInitiative({
      title: "Version the customer portal design candidate",
      outcome: "Reviewers can inspect exact baseline candidate membership and lineage.",
      scope: ["Customer portal finalized design snapshot"],
      exclusions: ["Automatic approval, designation, readiness, implementation, or action authority"],
    }, actorId)

    currentSource = {
      id: "44444444-4444-4444-8444-444444444444",
      revision: 1,
      initiativeId: initiative.id,
      contentDigest: digest("d"),
    }
    sourceReference = {
      sourceId: currentSource.id as string,
      sourceRevision: currentSource.revision as number,
      recordDigest: canonicalDigest(currentSource),
      contentDigest: currentSource.contentDigest as typeof sourceReference.contentDigest,
    }
    const subject = {
      kind: "finalized-figma-snapshot-import-candidate" as const,
      recordId: "50000000-0000-4000-8000-000000000005",
      revision: 2,
      digest: digest("1"),
      membershipDigest: digest("2"),
      externalFileIdentityDigest: digest("3"),
      returnedExternalVersionDigest: digest("4"),
      itemCatalogDigest: digest("5"),
      itemCount: 1,
    }
    const scope = {
      kind: "exact-finalized-design-snapshot" as const,
      subjectDigest: subject.digest,
      scopeDigest: digest("6"),
      includedItemDigests: [digest("7")],
      excludedItemDigests: [],
    }
    approval = {
      kind: "human-design-approval-candidate",
      id: "60000000-0000-4000-8000-000000000006",
      revision: 1,
      membershipDigest: digest("8"),
      decisionReceiptDigest: digest("9"),
      subject,
      scope,
      candidateResult: "approved-candidate",
      reviewState: "recorded-human-decision",
    } as unknown as HumanDesignApproval
    approvalStatus = {
      state: "complete-for-recorded-decision",
      assessedAt: "2026-07-30T01:10:00Z",
    } as HumanDesignApprovalStatus
    const sourceSnapshot = { ...currentSource }
    const sourceGovernance = {
      listSources: async () => [currentSource],
      readSourceRevision: async () => ({ snapshot: sourceSnapshot, recordDigest: canonicalDigest(sourceSnapshot) }),
    } as unknown as SourceGovernanceService
    service = new DesignBaselineService(
      engine.repository,
      () => engine.readProduct(),
      (id) => engine.readInitiative(id),
      sourceGovernance,
      {
        readCurrent: async () => approval,
        assess: async () => approvalStatus,
      },
    )
  })

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true })
  })

  async function input(overrides: Partial<DesignBaselineInput> = {}): Promise<DesignBaselineInput> {
    const base = {
      initiativeId: initiative.id,
      context: {
        productRevision: product.revision!,
        productDigest: canonicalDigest(product),
        initiativeRevision: initiative.revision!,
        initiativeDigest: canonicalDigest(initiative),
      },
      informationClassification: "internal" as const,
      title: "Customer portal Design Baseline candidate",
      objectiveDigest: digest("a"),
      humanDesignApproval: designBaselineApprovalReference(approval, approvalStatus),
      subject: approval.subject,
      scope: approval.scope,
      baselineLineageId: "70000000-0000-4000-8000-000000000007",
      candidateSetId: "80000000-0000-4000-8000-000000000008",
      candidateSetRevision: 1,
      semanticVersion: "1.0.0",
      versionPolicyDigest: digest("b"),
      designation: {
        key: "propose-customer-portal-baseline",
        kind: "propose-baseline-candidate" as const,
        designationDigest: digest("c"),
        rationaleDigest: digest("e"),
        evidenceDigests: [digest("f")],
        sources: [sourceReference],
        proposedBy: { kind: "human" as const, id: "baseline-proposer" },
        proposedAt: "2026-07-30T01:15:00Z",
        validUntil: "2030-07-30T01:15:00Z",
        authorityEvidenceState: "declared-not-verified" as const,
        independenceState: "distinct-actor-declared" as const,
        effectState: "not-applied" as const,
      },
      designationDefinitionDigest: digest("0"),
      designationReceiptDigest: digest("1"),
      candidateResult: "baseline-proposal-candidate" as const,
      unresolvedQuestions: [],
      limitations: ["A baseline proposal candidate is not an Approval Determination or Baseline Set designation."],
      reviewState: "ready-for-human-review" as const,
      approvalDeterminationState: "not-established" as const,
      baselineDesignationState: "not-established" as const,
      approverAuthorityState: "not-established" as const,
      separationOfDutiesEnforcementState: "not-established" as const,
      readinessState: "not-established" as const,
      phaseEntryAuthorityState: "not-granted" as const,
      figmaConnectionAuthorityState: "not-granted" as const,
      credentialAuthorityState: "not-granted" as const,
      permissionGrantState: "not-granted" as const,
      importExecutionState: "not-performed" as const,
      writeExecutionState: "not-performed" as const,
      implementationAuthorityState: "not-granted" as const,
      ...overrides,
    }
    return { ...base, designationReceiptDigest: designBaselineDesignationReceiptDigest(base) }
  }

  function exactBaselineReference(record: DesignBaseline) {
    return {
      recordId: record.id,
      revision: record.revision,
      digest: canonicalDigest(record),
      membershipDigest: record.membershipDigest,
      baselineLineageId: record.baselineLineageId,
      semanticVersion: record.semanticVersion,
    }
  }

  it("creates, supersedes, assesses, projects, and preserves immutable candidate history", async () => {
    const created = await service.create(await input(), actorId)
    expect(await service.assess(initiative.id)).toMatchObject({
      candidateSetCount: 1,
      designationCandidateCount: 1,
      candidateResult: "baseline-proposal-candidate",
      approvalDeterminationState: "not-established",
      baselineDesignationState: "not-established",
      state: "complete-for-baseline-review",
      reasons: [],
    })
    const projection = await service.project(initiative.id)
    expect(projection.candidate).toMatchObject({ id: created.id, semanticVersion: "1.0.0" })
    expect(projection.authorityBoundary).toContain("does-not-convert-an-approval-candidate-into-approval")
    expect(JSON.stringify(projection)).not.toContain("baseline-proposer")
    const bundle = await engine.productStudio.buildPortableExport()
    expect(bundle.manifest.members.map((member) => member.path)).toEqual(expect.arrayContaining([
      `design-baselines/${created.id}.json`,
      `design-baseline-history/design-baseline-${created.id}-r1.json`,
    ]))

    const supersedes = exactBaselineReference(created)
    const revised = await service.revise(created.id, 1, await input({
      candidateSetRevision: 2,
      semanticVersion: "2.0.0",
      designation: {
        ...(await input()).designation!,
        key: "supersede-customer-portal-baseline",
        kind: "supersede-baseline-candidate",
        designationDigest: digest("2"),
      },
      supersedes,
      candidateResult: "supersession-candidate",
    }), actorId)
    expect(revised.revision).toBe(2)
    expect((await service.listHistory(created.id)).map((entry) => entry.revision)).toEqual([2, 1])
    expect((await service.assess(initiative.id))).toMatchObject({
      supersessionCandidateCount: 1,
      state: "complete-for-baseline-review",
    })
  })

  it("fails closed on forged receipts and predecessor references, then exposes dependency and source drift", async () => {
    await expect(service.create({ ...await input(), designationReceiptDigest: digest("f") }, actorId)).rejects.toThrow("receipt")
    const created = await service.create(await input(), actorId)
    await expect(service.revise(created.id, 1, await input({
      designation: { ...(await input()).designation!, kind: "withdraw-baseline-candidate" },
      supersedes: { ...exactBaselineReference(created), digest: digest("f") },
      candidateResult: "withdrawal-candidate",
    }), actorId)).rejects.toThrow("predecessor")

    approval = { ...approval, revision: 2 }
    currentSource = { ...currentSource, revision: 2 }
    const status = await service.assess(initiative.id)
    expect(status.staleBindingCount).toBeGreaterThan(0)
    expect(status.staleSourceReferenceCount).toBe(1)
    expect(status.state).toBe("attention-required")
    expect((await service.healthIssues()).map((issue) => issue.code)).toContain("design-baseline.review-required")
  })

  it("keeps audit payloads minimized and never records human identity or action authority", async () => {
    const created = await service.create(await input(), actorId)
    const audit = await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8")
    const event = audit.trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>)
      .find((entry) => entry.eventType === "design-baseline.created")
    expect(event).toBeDefined()
    const serialized = JSON.stringify(event)
    expect(serialized).toContain(created.designationReceiptDigest)
    expect(serialized).toContain('"approvalDeterminationState":"not-established"')
    expect(serialized).toContain('"baselineDesignationState":"not-established"')
    expect(serialized).toContain('"actionAuthorityState":"not-granted"')
    expect(serialized).not.toContain("baseline-proposer")
    expect(serialized).not.toContain("A baseline proposal candidate is not")
  })
})
