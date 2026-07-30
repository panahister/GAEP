import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  humanDesignApprovalPrerequisiteKeys,
  humanDesignApprovalPrerequisiteKinds,
  type ExactSourceReference,
  type FinalizedFigmaSnapshotImport,
  type HumanDesignApprovalInput,
  type Initiative,
  type Product,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { GaepEngine } from "./engine.js"
import {
  HumanDesignApprovalService,
  humanDesignApprovalDecisionReceiptDigest,
  humanDesignApprovalPrerequisiteStatusDigest,
  humanDesignApprovalScopeDigest,
  humanDesignApprovalSubjectReference,
} from "./human-design-approval.js"
import type { SourceGovernanceService } from "./source-governance.js"

const actorId = "design-governance-recorder"
const digest = (value: string) => `sha256:${value.repeat(64).slice(0, 64)}` as const

describe("Human Design Approval service", () => {
  let workspace: string
  let engine: GaepEngine
  let service: HumanDesignApprovalService
  let product: Product
  let initiative: Initiative
  let sourceReference: ExactSourceReference
  let dependencyRecords: Record<string, any>
  let dependencyStatuses: Record<string, any>
  let finalizedSnapshot: FinalizedFigmaSnapshotImport

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "gaep-human-design-approval-"))
    engine = new GaepEngine(workspace, [])
    product = await engine.createProduct({
      name: "Atlas",
      summary: "A governed Product with exact human design-decision candidate boundaries.",
      problem: "Recorded design decisions can be mistaken for verified approval or implementation permission.",
      affectedUsers: "Product owners, designers, engineers, reviewers, and assurance teams",
      desiredOutcome: "Every design decision remains exact, attributable, bounded, and non-authorizing.",
      successSignals: ["Every decision binds one exact finalized design scope"],
      firstWorkflow: "Inspect one bounded Human Design Approval candidate.",
      exclusions: ["Automatic approval", "Automatic baseline promotion", "Automatic phase entry"],
      profile: "software",
    }, actorId)
    initiative = await engine.createInitiative({
      title: "Record the customer portal design decision",
      outcome: "Reviewers can inspect one exact human design-decision candidate.",
      scope: ["Customer portal finalized design snapshot"],
      exclusions: ["Automatic approval, readiness, implementation, or action authority"],
    }, actorId)

    const source = {
      id: "44444444-4444-4444-8444-444444444444",
      revision: 1,
      initiativeId: initiative.id,
      contentDigest: digest("d"),
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

    finalizedSnapshot = {
      kind: "finalized-figma-snapshot-import-candidate",
      id: "50000000-0000-4000-8000-000000000005",
      revision: 1,
      membershipDigest: digest("5"),
      returnReceipt: {
        externalFileIdentityDigest: digest("6"),
        returnedExternalVersionDigest: digest("7"),
      },
      items: [{ key: "customer-portal", kind: "component", externalIdentityDigest: digest("8") }],
    } as unknown as FinalizedFigmaSnapshotImport
    dependencyRecords = {
      "design-conflict-resolution": {
        kind: "design-conflict-resolution-candidate", id: "50000000-0000-4000-8000-000000000001", revision: 1, membershipDigest: digest("1"),
      },
      "design-delta": {
        kind: "design-delta-candidate", id: "50000000-0000-4000-8000-000000000002", revision: 1, membershipDigest: digest("2"),
      },
      "design-to-requirement-binding": {
        kind: "design-to-requirement-binding-candidate", id: "50000000-0000-4000-8000-000000000003", revision: 1, membershipDigest: digest("3"),
      },
      "designer-ready-gate": {
        kind: "designer-ready-gate-candidate", id: "50000000-0000-4000-8000-000000000004", revision: 1, membershipDigest: digest("4"),
      },
      "finalized-figma-snapshot-import": finalizedSnapshot,
    }
    dependencyStatuses = Object.fromEntries(humanDesignApprovalPrerequisiteKeys.map((key) => [key, {
      state: key === "designer-ready-gate" ? "complete-for-human-decision" : "complete-for-review",
      assessedAt: "2026-07-30T00:45:00Z",
    }]))
    const dependencies = Object.fromEntries(humanDesignApprovalPrerequisiteKeys.map((key) => [key, {
      readCurrent: async () => dependencyRecords[key],
      assess: async () => dependencyStatuses[key],
    }])) as any
    service = new HumanDesignApprovalService(
      engine.repository,
      () => engine.readProduct(),
      (id) => engine.readInitiative(id),
      sourceGovernance,
      dependencies,
    )
  })

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true })
  })

  async function input(overrides: Partial<HumanDesignApprovalInput> = {}): Promise<HumanDesignApprovalInput> {
    const prerequisites = humanDesignApprovalPrerequisiteKeys.map((key) => ({
      key,
      kind: humanDesignApprovalPrerequisiteKinds[key],
      recordId: dependencyRecords[key].id,
      revision: dependencyRecords[key].revision,
      digest: canonicalDigest(dependencyRecords[key]),
      membershipDigest: dependencyRecords[key].membershipDigest,
      assessmentDigest: humanDesignApprovalPrerequisiteStatusDigest(dependencyStatuses[key]),
      assessmentState: dependencyStatuses[key].state,
    }))
    const subject = humanDesignApprovalSubjectReference(finalizedSnapshot)
    const itemDigest = canonicalDigest(finalizedSnapshot.items[0])
    const scopeBase = {
      kind: "exact-finalized-design-snapshot" as const,
      subjectDigest: subject.digest,
      includedItemDigests: [itemDigest],
      excludedItemDigests: [],
    }
    const scope = { ...scopeBase, scopeDigest: humanDesignApprovalScopeDigest(scopeBase) }
    const decision = {
      key: "approve-customer-portal",
      kind: "approve-candidate" as const,
      decisionDigest: digest("9"),
      rationaleDigest: digest("a"),
      conditionDigests: [digest("b")],
      evidenceDigests: [digest("c")],
      sources: [sourceReference],
      decidedBy: { kind: "human" as const, id: "design-approver" },
      decidedAt: "2026-07-30T00:50:00Z",
      validUntil: "2030-07-30T00:50:00Z",
      authorityEvidenceState: "declared-not-verified" as const,
      independenceState: "distinct-actor-declared" as const,
      lifecycleState: "active-candidate" as const,
      effectState: "not-applied" as const,
    }
    const base = {
      initiativeId: initiative.id,
      context: {
        productRevision: product.revision!,
        productDigest: canonicalDigest(product),
        initiativeRevision: initiative.revision!,
        initiativeDigest: canonicalDigest(initiative),
      },
      informationClassification: "internal" as const,
      title: "Customer portal Human Design Approval candidate",
      objectiveDigest: digest("e"),
      prerequisites,
      subject,
      scope,
      decision,
      decisionDefinitionDigest: digest("f"),
      decisionReceiptDigest: digest("0"),
      candidateResult: "approved-candidate" as const,
      unresolvedQuestions: [],
      limitations: ["Human attribution does not verify approver authority or enforce separation of duties."],
      reviewState: "recorded-human-decision" as const,
      approverAuthorityState: "not-established" as const,
      separationOfDutiesEnforcementState: "not-established" as const,
      designApprovalState: "not-established" as const,
      designBaselineState: "not-established" as const,
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
    return { ...base, decisionReceiptDigest: humanDesignApprovalDecisionReceiptDigest(base) }
  }

  it("creates, revises, assesses, projects, and preserves immutable candidate history", async () => {
    const created = await service.create(await input(), actorId)
    expect(await service.assess(initiative.id)).toMatchObject({
      prerequisiteCount: 5,
      completePrerequisiteCount: 5,
      decisionCount: 1,
      approveCount: 1,
      candidateResult: "approved-candidate",
      approverAuthorityState: "not-established",
      state: "complete-for-recorded-decision",
      reasons: [],
    })
    const projection = await service.project(initiative.id)
    expect(projection.candidate).toMatchObject({ id: created.id, decisionKind: "approve-candidate" })
    expect(projection.authorityBoundary).toContain("does-not-verify-approver-authority")
    expect(JSON.stringify(projection)).not.toContain("design-approver")
    const bundle = await engine.productStudio.buildPortableExport()
    expect(bundle.manifest.members.map((member) => member.path)).toEqual(expect.arrayContaining([
      `human-design-approvals/${created.id}.json`,
      `human-design-approval-history/human-design-approval-${created.id}-r1.json`,
    ]))

    const revised = await service.revise(created.id, 1, await input({
      decision: undefined,
      candidateResult: "incomplete",
      reviewState: "held",
      unresolvedQuestions: ["Confirm the accountable approver authority evidence."],
    }), actorId)
    expect(revised.revision).toBe(2)
    expect((await service.listHistory(created.id)).map((entry) => entry.revision)).toEqual([2, 1])
    expect((await service.assess(initiative.id)).state).toBe("attention-required")
  })

  it("fails closed on forged receipts, scope gaps, and superseded prerequisite bindings", async () => {
    await expect(service.create({ ...await input(), decisionReceiptDigest: digest("f") }, actorId)).rejects.toThrow("receipt")

    const incompleteScope = await input()
    incompleteScope.scope = {
      ...incompleteScope.scope,
      includedItemDigests: [digest("0")],
    }
    incompleteScope.scope.scopeDigest = humanDesignApprovalScopeDigest(incompleteScope.scope)
    incompleteScope.decisionReceiptDigest = humanDesignApprovalDecisionReceiptDigest(incompleteScope)
    await expect(service.create(incompleteScope, actorId)).rejects.toThrow("classify every exact")

    const created = await service.create(await input(), actorId)
    dependencyRecords["design-conflict-resolution"] = {
      ...dependencyRecords["design-conflict-resolution"], revision: 2,
    }
    const status = await service.assess(initiative.id)
    expect(status.staleBindingCount).toBeGreaterThan(0)
    expect(status.state).toBe("attention-required")
    expect((await service.healthIssues()).map((issue) => issue.code)).toContain("human-design-approval.review-required")
    expect((await service.read(created.id)).revision).toBe(1)
  })

  it("keeps audit payloads minimized and never records human identity or action authority", async () => {
    const created = await service.create(await input(), actorId)
    const audit = await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8")
    const event = audit.trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>)
      .find((entry) => entry.eventType === "human-design-approval.created")
    expect(event).toBeDefined()
    const serialized = JSON.stringify(event)
    expect(serialized).toContain(created.decisionReceiptDigest)
    expect(serialized).toContain('"approverAuthorityState":"not-established"')
    expect(serialized).toContain('"designApprovalState":"not-established"')
    expect(serialized).toContain('"actionAuthorityState":"not-granted"')
    expect(serialized).not.toContain("design-approver")
    expect(serialized).not.toContain("Human attribution does not verify")
  })
})
