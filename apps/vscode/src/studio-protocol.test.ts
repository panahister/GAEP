import { describe, expect, it } from "vitest"
import { canonicalDigest } from "@gaep/agent-sdk"
import type { Initiative, Product } from "@gaep/contracts"
import { composePhase2UxFigmaDashboard, composePhase3aDashboard } from "@gaep/engine"

import {
  deliveryTableKeys,
  isStudioAction,
  isStudioSnapshot,
  parseHostToStudioMessage,
  parseStudioToHostMessage,
  runStageLabels,
  studioDraftStates,
  studioProtocolVersion,
  studioRouteLabels,
  studioRoutes,
  studioSurfaceKinds,
  type DeliveryPageSnapshot,
  type DeliveryTableKey,
  type StudioPageSnapshot,
  type StudioRoute,
  type StudioSnapshot,
} from "./studio-protocol.js"

const channelId = "channel_token_1234567890"
const contextGeneration = "context_generation_1234567890"

function pageFor(route: StudioRoute): StudioPageSnapshot {
  const baseFor = <R extends StudioRoute>(candidate: R) => ({
    route: candidate,
    title: studioRouteLabels[candidate],
    purpose: "Host supplied purpose",
    source: { provenance: "Host snapshot" },
    actions: [],
  })
  const sections = studioRoutes.map((candidate) => ({ route: candidate, state: "not-started" as const, gapCount: 0 }))
  const table = (id: string) => ({ id, title: id, columns: [], rows: [], actions: [] })
  switch (route) {
    case "overview":
      return {
        ...baseFor(route),
        kind: "overview",
        product: { name: "Product", lifecycle: "active", readinessStatement: "Host supplied readiness" },
        sections,
        currentInitiative: [],
        latestRun: [],
        blockers: [],
      }
    case "direction":
    case "users-jobs":
    case "outcomes":
    case "scope":
    case "architecture":
      return {
        ...baseFor(route),
        kind: "record-form",
        fields: [],
        gaps: [],
        conflicts: [],
        draft: { state: "clean", materialChange: false, validation: "not-validated" },
      }
    case "delivery":
      const deliveryTables = Object.fromEntries(
        deliveryTableKeys.map((key) => [key, table(key)]),
      ) as unknown as Pick<DeliveryPageSnapshot, DeliveryTableKey>
      return {
        ...baseFor(route),
        kind: "delivery",
        ...deliveryTables,
      }
    case "risks-decisions":
      return { ...baseFor(route), kind: "risks-decisions", risks: table("risks"), recommendations: table("recommendations"), decisions: table("decisions"), decisionRegisters: table("decision-registers"), riskRegisters: table("risk-registers"), evidenceRegistries: table("evidence-registries") }
    case "trace":
      return { ...baseFor(route), kind: "trace", readinessGates: table("p0-p4-readiness-gates"), p5Handoffs: table("p5-handoff-packages"), traceabilityGraphs: table("end-to-end-traceability"), relationships: table("relationships"), searchResults: table("search-results"), impact: [] }
    case "agents-tools":
      return {
        ...baseFor(route),
        kind: "agents-tools",
        adapters: table("adapters"),
        selectedAgent: [],
        limitations: [],
        handoffs: table("handoffs"),
        contextPacks: table("context-packs"),
        instructionPrivilegeGrants: table("instruction-privilege-grants"),
        workflowPlans: table("workflow-plans"),
        toolDefinitions: table("tool-definitions"),
        runToolSelections: table("run-tool-selections"),
      }
    case "runs-evidence":
      return {
        ...baseFor(route),
        kind: "runs-evidence",
        runs: table("runs"),
        selectedRun: [],
        events: [],
        recovery: table("managed-recovery"),
        managedEvidence: table("managed-evidence"),
        evidence: table("evidence"),
        handoffs: table("handoffs"),
        recoveryActions: [],
      }
    case "readiness":
      return {
        ...baseFor(route),
        kind: "readiness",
        statement: "Host supplied readiness",
        sections,
        gaps: [],
        conflicts: [],
        health: [],
        designRevisions: table("design-revisions"),
        productRevisions: table("product-revisions"),
        portableDesignSnapshots: table("portable-design-snapshots"),
        designerReadyGates: table("designer-ready-gates"),
        designDeltas: table("design-deltas"),
        designConflictResolutions: table("design-conflict-resolutions"),
        humanDesignApprovals: table("human-design-approvals"),
        designBaselines: table("design-baselines"),
        designDriftDetections: table("design-drift-detections"),
        portability: [],
      }
  }
}

function snapshot(route: StudioRoute): StudioSnapshot {
  return {
    protocolVersion: studioProtocolVersion,
    contextGeneration,
    snapshotRevision: 1,
    route,
    workspace: { label: "Workspace", trusted: true, connectivity: "online", health: "valid" },
    navigation: studioRoutes.map((candidate) => ({ route: candidate, state: "not-started", gapCount: 0 })),
    surface: { kind: "ready", title: "Ready", issues: [], actions: [] },
    dashboard: {
      schemaVersion: 1,
      kind: "phase-dashboard-framework",
      catalogVersion: "gaep-phase-dashboards-v1",
      product: {
        recordType: "product",
        recordId: "00000000-0000-4000-8000-000000000001",
        revision: 2,
        digest: `sha256:${"a".repeat(64)}`,
      },
      phase: { id: "phase-0-1a-foundation", label: "Phase 0 / 1A — Four-IDE Platform Foundation" },
      panels: [
        {
          id: "foundation-summary",
          role: "phase",
          title: "Foundation summary and readiness",
          applicability: { status: "unknown", basis: "not-evaluated" },
          state: "attention-required",
        },
        {
          id: "change-impact",
          role: "change-impact",
          title: "Change and impact",
          applicability: { status: "applicable", basis: "phase-contract" },
          state: "active",
        },
        {
          id: "agent-model",
          role: "agent-model",
          title: "Agent and model",
          applicability: { status: "applicable", basis: "phase-contract" },
          state: "active",
        },
      ],
      evidenceCues: {
        freshness: "current",
        confidence: { state: "not-assessed", basis: "no-governed-confidence-evaluation-is-bound" },
      },
      observedAt: "2026-07-24T00:00:00.000Z",
      sourceBoundary: "governed-repository-and-engine-only",
      limitations: ["This projection grants no phase or readiness authority."],
      authorityBoundary: "dashboard-is-a-projection-not-phase-approval-readiness-or-applicability-evidence",
      compositionDigest: `sha256:${"b".repeat(64)}`,
    },
    page: pageFor(route),
    footer: { draftState: "clean", validationSummary: "Not validated" },
  }
}

function changeImpactDashboard(): NonNullable<StudioSnapshot["changeImpact"]> {
  const emptyLimit = { shown: 0, total: 0, omitted: 0 }
  return {
    schemaVersion: 1,
    kind: "change-impact-dashboard",
    product: {
      recordType: "product",
      recordId: "00000000-0000-4000-8000-000000000001",
      revision: 2,
      digest: `sha256:${"a".repeat(64)}`,
    },
    change: {
      recordType: "change",
      recordId: "00000000-0000-4000-8000-000000000002",
      revision: 3,
      digest: `sha256:${"b".repeat(64)}`,
      state: "active",
      effectEnvelope: ["observe"],
    },
    workItems: [],
    changedArtifacts: [],
    effectTargets: [],
    affectedUnits: [],
    governance: {
      approval: {
        state: "not-established",
        basis: "current-contract-has-no-change-approval-record",
      },
      decisions: [],
      risks: [],
      authorityBoundary: "decisions-and-risk-acceptance-do-not-approve-the-change",
    },
    freshness: {
      state: "current",
      evaluatedAt: "2026-07-24T00:00:00.000Z",
      unresolvedTraceLinks: 0,
      invalidTraceLinks: 0,
      staleTraceLinks: 0,
      staleGovernanceReferences: 0,
      traceAnalysisTruncated: false,
      coverageBoundary: "absence-of-a-trace-link-does-not-prove-absence-of-impact",
    },
    evidenceCues: {
      freshness: "current",
      confidence: { state: "not-assessed", basis: "no-governed-confidence-evaluation-is-bound" },
    },
    limits: {
      workItems: emptyLimit,
      changedArtifacts: emptyLimit,
      effectTargets: emptyLimit,
      affectedUnits: emptyLimit,
      decisions: emptyLimit,
      risks: emptyLimit,
      truncated: false,
    },
    observedAt: "2026-07-24T00:00:01.000Z",
    sourceBoundary: "current-governed-records-and-bounded-trace-analysis",
    limitations: ["This projection grants no approval or execution authority."],
    authorityBoundary: "change-impact-dashboard-does-not-approve-change-accept-risk-or-authorize-effects",
    snapshotDigest: `sha256:${"c".repeat(64)}`,
  }
}

function agentModelDashboard(): NonNullable<StudioSnapshot["agentModel"]> {
  const observedAt = "2026-07-24T00:00:01.000Z"
  const content = {
    schemaVersion: 1 as const,
    kind: "agent-model-dashboard" as const,
    product: {
      recordType: "product" as const,
      recordId: "00000000-0000-4000-8000-000000000001",
      revision: 2,
      digest: `sha256:${"a".repeat(64)}`,
    },
    capabilities: [{
      adapterId: "gaep.manual",
      adapterVersion: "1.0.0",
      agentId: "manual",
      agentLabel: "Manual",
      runtimeVersion: "1.0.0",
      capabilityDigest: `sha256:${"b".repeat(64)}`,
      detected: true,
      executionInterface: "managed-in-process" as const,
      interfaceMaturity: "stable" as const,
      support: { resume: true, cancel: true, checkpoints: true, modelDiscovery: true, toolSelection: false },
      modelCount: 1,
      limitations: { values: ["Offline fixture only."], shown: 1, total: 1, omitted: 0 },
      observedAt,
      selected: false,
    }],
    selection: { status: "unselected" as const },
    runs: [],
    handoffs: [],
    providerMetrics: {
      usage: { state: "unavailable" as const, basis: "current-managed-records-have-no-provider-usage-or-cost-contract" as const },
      cost: { state: "unavailable" as const, basis: "current-managed-records-have-no-provider-usage-or-cost-contract" as const },
    },
    freshness: {
      state: "current" as const,
      selectionCapabilityState: "unselected" as const,
      oldestCapabilityObservedAt: observedAt,
      newestCapabilityObservedAt: observedAt,
      truncated: false,
      coverageBoundary: "bounded-current-records-do-not-prove-provider-account-or-native-host-readiness" as const,
    },
    evidenceCues: {
      freshness: "current" as const,
      confidence: { state: "not-assessed" as const, basis: "no-governed-confidence-evaluation-is-bound" as const },
    },
    limits: {
      capabilities: { shown: 1, total: 1, omitted: 0 },
      runs: { shown: 0, total: 0, omitted: 0 },
      handoffs: { shown: 0, total: 0, omitted: 0 },
      managedRuns: { shown: 0, total: 0, omitted: 0 },
      truncated: false,
    },
    observedAt,
    sourceBoundary: "current-governed-agent-selection-run-handoff-and-managed-evidence-metadata" as const,
    limitations: ["This projection grants no selection, handoff, launch, or effect authority."],
    authorityBoundary: "agent-model-dashboard-does-not-select-switch-handoff-launch-or-authorize-effects" as const,
  }
  return { ...content, snapshotDigest: canonicalDigest(content) }
}

describe("Product Studio protocol", () => {
  it("defines the approved twelve-route order and eight run stages", () => {
    expect(studioRoutes).toEqual([
      "overview",
      "direction",
      "users-jobs",
      "outcomes",
      "scope",
      "delivery",
      "architecture",
      "risks-decisions",
      "trace",
      "agents-tools",
      "runs-evidence",
      "readiness",
    ])
    expect(Object.values(studioRouteLabels)).toHaveLength(12)
    expect(runStageLabels).toHaveLength(8)
    expect(runStageLabels.at(-1)).toBe("Launch confirmation")
    expect(studioSurfaceKinds).toEqual([
      "uninitialized", "loading", "empty", "ready", "invalid", "blocked", "interrupted", "offline",
    ])
    expect(studioDraftStates).toEqual(["clean", "unsaved", "saved-locally", "revision-ready", "revision-created"])
  })

  it("defines one exhaustive accessible Delivery-table order and validates every optional table", () => {
    expect(deliveryTableKeys).toHaveLength(43)
    expect(deliveryTableKeys.slice(0, 6)).toEqual([
      "initiatives", "sources", "sourceBaselines", "sourceProvenance", "changes", "workItems",
    ])
    expect(deliveryTableKeys.slice(23)).toEqual([
      "highLevelDesigns",
      "lowLevelDesigns",
      "implementationReadinessGates",
      "changedUnitInventories",
      "proposedChangePreviews",
      "stagingWorkspaces",
      "controlledCodexImplementations",
      "controlledClaudeImplementations",
      "providerSwitchImplementations",
      "modelSwitchImplementations",
      "approvedFigmaContextRetrievals",
      "controlledDesignToCodeGenerations",
      "designToCodeTraceability",
      "boilerplateConstraintEnforcements",
      "backlogToCodeTraceability",
      "applyDiscardFoundations",
      "scopedApplies",
      "rollbackRecoveries",
      "changeConflictDetections",
      "testGenerations",
    ])

    const complete = snapshot("delivery")
    expect(isStudioSnapshot(complete)).toBe(true)
    if (complete.page.kind !== "delivery") throw new Error("Expected Delivery page")
    for (const key of deliveryTableKeys) expect(complete.page[key], key).toBeDefined()

    const minimal = structuredClone(complete)
    if (minimal.page.kind !== "delivery") throw new Error("Expected Delivery page")
    const mutableMinimal = minimal.page as Partial<Record<DeliveryTableKey, unknown>>
    for (const key of deliveryTableKeys.slice(6)) delete mutableMinimal[key]
    expect(isStudioSnapshot(minimal)).toBe(true)

    const malformed = structuredClone(complete)
    if (malformed.page.kind !== "delivery") throw new Error("Expected Delivery page")
    const mutableMalformed = malformed.page as unknown as Record<DeliveryTableKey, unknown>
    mutableMalformed.highLevelDesigns = { id: "omitted-table-shape" }
    expect(isStudioSnapshot(malformed)).toBe(false)
  })

  it("accepts route-matched snapshots for all twelve surfaces", () => {
    for (const route of studioRoutes) expect(isStudioSnapshot(snapshot(route)), route).toBe(true)
    expect(isStudioSnapshot({ ...snapshot("overview"), route: "trace" })).toBe(false)
    expect(isStudioSnapshot({ ...snapshot("overview"), unexpected: true })).toBe(false)
    expect(isStudioSnapshot({
      ...snapshot("overview"),
      dashboard: { ...snapshot("overview").dashboard, ready: true },
    })).toBe(false)
    const forgedDashboard = structuredClone(snapshot("overview"))
    if (!forgedDashboard.dashboard) throw new Error("Expected dashboard fixture")
    forgedDashboard.dashboard.panels[0]!.applicability = { status: "applicable", basis: "not-evaluated" }
    forgedDashboard.dashboard.panels[0]!.state = "active"
    expect(isStudioSnapshot(forgedDashboard)).toBe(false)
    const forgedEvidenceCue = structuredClone(snapshot("overview"))
    if (!forgedEvidenceCue.dashboard) throw new Error("Expected dashboard fixture")
    const mutableEvidenceCue = forgedEvidenceCue.dashboard.evidenceCues as unknown as { freshness: string }
    mutableEvidenceCue.freshness = "unknown"
    expect(isStudioSnapshot(forgedEvidenceCue)).toBe(false)
  })

  it("accepts only a digest-bound Phase 2 UX/Figma view beside the Phase 2 dashboard shell", () => {
    const product: Product = {
      schemaVersion: 1, id: "00000000-0000-4000-8000-000000000001", kind: "product", revision: 2,
      name: "Phase 2 dashboard Product", summary: "Exact Product Studio Phase 2 projection fixture",
      problem: "Phase 2 source state must remain derived and bounded.", affectedUsers: "GAEP operators",
      desiredOutcome: "Expose exact source state without synthesizing authority.", successSignals: ["Exact digest validation"],
      firstWorkflow: "Inspect Phase 2 source coverage.", exclusions: ["Approval or action authority"], profile: "internal-tool",
      lifecycleState: "active", createdAt: "2026-07-30T03:00:00.000Z", updatedAt: "2026-07-30T03:00:00.000Z",
    }
    const initiative: Initiative = {
      schemaVersion: 1, id: "00000000-0000-4000-8000-000000000002", kind: "initiative", revision: 1,
      productId: product.id, title: "Phase 2 dashboard Initiative", outcome: "Inspect current design state.",
      scope: ["P2-01 through P2-23"], exclusions: ["Automatic Figma effects"], state: "active",
      createdAt: "2026-07-30T03:00:00.000Z", updatedAt: "2026-07-30T03:00:00.000Z",
    }
    const phase2 = composePhase2UxFigmaDashboard(product, initiative, [], {
      expectedProductId: product.id, expectedProductRevision: product.revision ?? 1, expectedProductDigest: canonicalDigest(product),
      expectedInitiativeId: initiative.id, expectedInitiativeRevision: initiative.revision ?? 1,
      expectedInitiativeDigest: canonicalDigest(initiative),
    }, "2026-07-30T03:10:00.000Z")
    const candidate = snapshot("overview")
    if (!candidate.dashboard) throw new Error("Expected dashboard fixture")
    candidate.dashboard.phase = { id: "phase-2-design", label: "Phase 2 — UX and Figma Loop" }
    candidate.dashboard.panels[0] = {
      id: "ux-figma", role: "phase", title: "UX and Figma",
      applicability: { status: "unknown", basis: "not-evaluated" }, state: "attention-required",
    }
    candidate.phase2UxFigma = phase2
    expect(isStudioSnapshot(candidate)).toBe(true)
    const forged = structuredClone(candidate)
    if (!forged.phase2UxFigma) throw new Error("Expected Phase 2 dashboard fixture")
    forged.phase2UxFigma.phaseStatus.unavailableSourceCount = 22
    expect(isStudioSnapshot(forged)).toBe(false)
    const forgedCatalog = structuredClone(candidate)
    if (!forgedCatalog.phase2UxFigma) throw new Error("Expected Phase 2 dashboard fixture")
    forgedCatalog.phase2UxFigma.phaseStatus.sourceCatalogDigest = `sha256:${"0".repeat(64)}`
    const { snapshotDigest: _snapshotDigest, ...forgedCatalogContent } = forgedCatalog.phase2UxFigma
    forgedCatalog.phase2UxFigma.snapshotDigest = canonicalDigest(forgedCatalogContent)
    expect(isStudioSnapshot(forgedCatalog)).toBe(false)
    const wrongPhase = structuredClone(candidate)
    if (!wrongPhase.dashboard) throw new Error("Expected dashboard fixture")
    wrongPhase.dashboard.phase = { id: "phase-0-1a-foundation", label: "Phase 0 / 1A — Four-IDE Platform Foundation" }
    wrongPhase.dashboard.panels[0] = {
      id: "foundation-summary", role: "phase", title: "Foundation summary and readiness",
      applicability: { status: "unknown", basis: "not-evaluated" }, state: "attention-required",
    }
    expect(isStudioSnapshot(wrongPhase)).toBe(false)
  })

  it("accepts only a digest-bound Phase 3A view beside the Phase 3A dashboard shell", () => {
    const product: Product = {
      schemaVersion: 1, id: "00000000-0000-4000-8000-000000000001", kind: "product", revision: 2,
      name: "Phase 3A dashboard Product", summary: "Exact Product Studio Phase 3A projection fixture",
      problem: "Phase 3A source state must remain derived and bounded.", affectedUsers: "GAEP operators",
      desiredOutcome: "Expose exact source state without synthesizing authority.", successSignals: ["Exact digest validation"],
      firstWorkflow: "Inspect Phase 3A source coverage.", exclusions: ["Readiness, approval, or action authority"], profile: "internal-tool",
      lifecycleState: "active", createdAt: "2026-07-31T03:00:00.000Z", updatedAt: "2026-07-31T03:00:00.000Z",
    }
    const initiative: Initiative = {
      schemaVersion: 1, id: "00000000-0000-4000-8000-000000000002", kind: "initiative", revision: 1,
      productId: product.id, title: "Phase 3A dashboard Initiative", outcome: "Inspect current delivery-planning state.",
      scope: ["P3A-01 through P3A-23"], exclusions: ["Automatic priority or implementation effects"], state: "active",
      createdAt: "2026-07-31T03:00:00.000Z", updatedAt: "2026-07-31T03:00:00.000Z",
    }
    const phase3a = composePhase3aDashboard(product, initiative, [], {
      expectedProductId: product.id, expectedProductRevision: product.revision ?? 1, expectedProductDigest: canonicalDigest(product),
      expectedInitiativeId: initiative.id, expectedInitiativeRevision: initiative.revision ?? 1,
      expectedInitiativeDigest: canonicalDigest(initiative),
    }, [], "2026-07-31T03:10:00.000Z")
    const candidate = snapshot("overview")
    if (!candidate.dashboard) throw new Error("Expected dashboard fixture")
    candidate.dashboard.phase = { id: "phase-3a-readiness", label: "Phase 3A — Backlog and Implementation Readiness" }
    candidate.dashboard.panels[0] = {
      id: "backlog-readiness", role: "phase", title: "Backlog and implementation readiness",
      applicability: { status: "unknown", basis: "not-evaluated" }, state: "attention-required",
    }
    candidate.phase3aDashboard = phase3a
    expect(isStudioSnapshot(candidate)).toBe(true)
    const forged = structuredClone(candidate)
    if (!forged.phase3aDashboard) throw new Error("Expected Phase 3A dashboard fixture")
    forged.phase3aDashboard.phaseStatus.unavailableSourceCount = 19
    expect(isStudioSnapshot(forged)).toBe(false)
    const forgedCatalog = structuredClone(candidate)
    if (!forgedCatalog.phase3aDashboard) throw new Error("Expected Phase 3A dashboard fixture")
    forgedCatalog.phase3aDashboard.phaseStatus.sourceCatalogDigest = `sha256:${"0".repeat(64)}`
    const { snapshotDigest: _snapshotDigest, ...forgedCatalogContent } = forgedCatalog.phase3aDashboard
    forgedCatalog.phase3aDashboard.snapshotDigest = canonicalDigest(forgedCatalogContent)
    expect(isStudioSnapshot(forgedCatalog)).toBe(false)
    const wrongPhase = structuredClone(candidate)
    if (!wrongPhase.dashboard) throw new Error("Expected dashboard fixture")
    wrongPhase.dashboard.phase = { id: "phase-2-design", label: "Phase 2 — UX and Figma Loop" }
    wrongPhase.dashboard.panels[0] = {
      id: "ux-figma", role: "phase", title: "UX and Figma",
      applicability: { status: "unknown", basis: "not-evaluated" }, state: "attention-required",
    }
    expect(isStudioSnapshot(wrongPhase)).toBe(false)
  })

  it("accepts only an internally consistent Change and impact projection on Delivery", () => {
    const delivery = { ...snapshot("delivery"), changeImpact: changeImpactDashboard() }
    expect(isStudioSnapshot(delivery)).toBe(true)
    expect(isStudioSnapshot({
      ...delivery,
      changeImpact: { ...delivery.changeImpact, approved: true },
    })).toBe(false)
    expect(isStudioSnapshot({
      ...delivery,
      changeImpact: {
        ...delivery.changeImpact,
        freshness: { ...delivery.changeImpact.freshness, state: "attention-required" },
      },
    })).toBe(false)
    expect(isStudioSnapshot({
      ...delivery,
      changeImpact: {
        ...delivery.changeImpact,
        evidenceCues: { ...delivery.changeImpact.evidenceCues, freshness: "stale" },
      },
    })).toBe(false)
    expect(isStudioSnapshot({
      ...delivery,
      changeImpact: {
        ...delivery.changeImpact,
        limits: {
          ...delivery.changeImpact.limits,
          workItems: { shown: 0, total: 1, omitted: 0 },
        },
      },
    })).toBe(false)
    expect(isStudioSnapshot({ ...snapshot("trace"), changeImpact: changeImpactDashboard() })).toBe(false)
  })

  it("accepts only an exact, digest-bound Agent and Model projection on Agents and Tools", () => {
    const agents = { ...snapshot("agents-tools"), agentModel: agentModelDashboard() }
    expect(isStudioSnapshot(agents)).toBe(true)
    expect(isStudioSnapshot({
      ...agents,
      agentModel: { ...agents.agentModel, providerToken: "private" },
    })).toBe(false)
    expect(isStudioSnapshot({
      ...agents,
      agentModel: {
        ...agents.agentModel,
        providerMetrics: { ...agents.agentModel.providerMetrics, cost: { state: "available", amount: 0 } },
      },
    })).toBe(false)
    expect(isStudioSnapshot({
      ...agents,
      agentModel: {
        ...agents.agentModel,
        freshness: { ...agents.agentModel.freshness, state: "attention-required" },
      },
    })).toBe(false)
    expect(isStudioSnapshot({
      ...agents,
      agentModel: {
        ...agents.agentModel,
        evidenceCues: {
          ...agents.agentModel.evidenceCues,
          confidence: { ...agents.agentModel.evidenceCues.confidence, state: "supported" },
        },
      },
    })).toBe(false)
    expect(isStudioSnapshot({
      ...agents,
      agentModel: { ...agents.agentModel, snapshotDigest: `sha256:${"f".repeat(64)}` },
    })).toBe(false)
    expect(isStudioSnapshot({ ...snapshot("runs-evidence"), agentModel: agentModelDashboard() })).toBe(false)
  })

  it("requires bounded Managed Run evidence, handoff history, and normalized event fields", () => {
    const valid = snapshot("runs-evidence")
    if (valid.page.kind !== "runs-evidence") throw new Error("Expected Runs & Evidence page")
    const withEvent = {
      ...valid,
      page: {
        ...valid.page,
        events: [{ id: "event-1", time: "2026-07-21T00:00:00.000Z", kind: "output", summary: "Digest-only evidence." }],
      },
    }
    expect(isStudioSnapshot(withEvent)).toBe(true)
    expect(isStudioSnapshot({
      ...withEvent,
      page: { ...withEvent.page, events: [{ ...withEvent.page.events[0], rawOutput: "private provider output" }] },
    })).toBe(false)
    expect(isStudioSnapshot({
      ...withEvent,
      page: { ...withEvent.page, events: Array.from({ length: 10_001 }, (_, index) => ({
        id: `event-${index}`,
        time: "2026-07-21T00:00:00.000Z",
        kind: "output",
        summary: "Digest-only evidence.",
      })) },
    })).toBe(false)
    const withoutManagedEvidence = { ...withEvent.page } as Record<string, unknown>
    delete withoutManagedEvidence.managedEvidence
    expect(isStudioSnapshot({ ...withEvent, page: withoutManagedEvidence })).toBe(false)
    const withoutHandoffs = { ...withEvent.page } as Record<string, unknown>
    delete withoutHandoffs.handoffs
    expect(isStudioSnapshot({ ...withEvent, page: withoutHandoffs })).toBe(false)
  })

  it("deeply validates and bounds machine-local inspector entries", () => {
    const valid = {
      ...snapshot("agents-tools"),
      inspector: {
        title: "Machine-local inspector",
        recordId: "adapter-1",
        entries: [{ term: "Executable", value: "/opt/codex" }],
        relationships: [{ term: "Binding", value: "observed" }],
        actions: [],
      },
    }
    expect(isStudioSnapshot(valid)).toBe(true)
    expect(isStudioSnapshot({
      ...valid,
      inspector: { ...valid.inspector, entries: [{ term: "Executable" }] },
    })).toBe(false)
    expect(isStudioSnapshot({
      ...valid,
      inspector: { ...valid.inspector, relationships: Array.from({ length: 1_001 }, () => ({ term: "Link", value: "bounded" })) },
    })).toBe(false)
  })

  it("allows only typed semantic actions and never arbitrary commands or paths", () => {
    expect(isStudioAction({ kind: "select-product-root" })).toBe(true)
    expect(isStudioAction({ kind: "create-initiative" })).toBe(true)
    expect(isStudioAction({
      kind: "classify-initiative",
      initiativeId: "22222222-2222-4222-8222-222222222222",
      expectedRevision: 3,
    })).toBe(true)
    expect(isStudioAction({
      kind: "resolve-initiative-applicability",
      initiativeId: "22222222-2222-4222-8222-222222222222",
      expectedRevision: 3,
    })).toBe(true)
    expect(isStudioAction({
      kind: "classify-initiative",
      initiativeId: "/tmp/private",
      expectedRevision: 3,
    })).toBe(false)
    expect(isStudioAction({
      kind: "resolve-initiative-applicability",
      initiativeId: "22222222-2222-4222-8222-222222222222",
      expectedRevision: 0,
    })).toBe(false)
    expect(isStudioAction({ kind: "prepare-run", command: "workbench.action.terminal.new" })).toBe(false)
    expect(isStudioAction({ kind: "select-product-root", path: "/tmp/untrusted" })).toBe(false)
    expect(isStudioAction({ kind: "open-record", recordId: "record-1" })).toBe(true)
    expect(isStudioAction({ kind: "execute-command", command: "workbench.action.terminal.sendSequence" })).toBe(false)
    expect(isStudioAction({ kind: "set-run-stage", preparedRunId: "run-1", stage: 9 })).toBe(false)
    expect(isStudioAction({
      kind: "save-draft",
      route: "direction",
      values: { problem: "Bounded content" },
      states: { problem: "complete" },
    })).toBe(true)
    expect(isStudioAction({ kind: "save-draft", route: "direction", values: {}, states: { problem: "approved" } })).toBe(false)
    expect(isStudioAction({ kind: "domain-workflow", workflow: "create-context-pack" })).toBe(true)
    expect(isStudioAction({ kind: "domain-workflow", workflow: "create-instruction-privilege-grant" })).toBe(true)
    expect(isStudioAction({ kind: "domain-workflow", workflow: "import-portable-design-snapshot" })).toBe(true)
    expect(isStudioAction({ kind: "domain-workflow", workflow: "revoke-instruction-privilege-grant", recordId: "grant-1", expectedRevision: 2 })).toBe(true)
    expect(isStudioAction({ kind: "domain-workflow", workflow: "run-arbitrary-command" })).toBe(false)
    expect(isStudioAction({ kind: "domain-page", recordKind: "requirement", offset: 50, limit: 50 })).toBe(true)
    expect(isStudioAction({ kind: "domain-page", recordKind: "unknown", offset: 0, limit: 50 })).toBe(false)
    expect(isStudioAction({ kind: "domain-page", recordKind: "requirement", offset: -1, limit: 50 })).toBe(false)
    expect(isStudioAction({ kind: "domain-page", recordKind: "requirement", offset: 0, limit: 201 })).toBe(false)
    expect(isStudioAction({ kind: "domain-page", recordKind: "portable-design-snapshot", offset: 50, limit: 50 })).toBe(true)
    expect(isStudioAction({ kind: "read-portable-design-snapshot", bundleId: "22222222-2222-4222-8222-222222222222" })).toBe(true)
    expect(isStudioAction({ kind: "read-portable-design-snapshot", bundleId: "/tmp/private" })).toBe(false)
    expect(isStudioAction({
      kind: "open-managed-discard",
      managedRunId: "66666666-6666-4666-8666-666666666666",
      expectedRevision: 2,
    })).toBe(true)
    expect(isStudioAction({
      kind: "open-managed-discard",
      managedRunId: "/tmp/private",
      expectedRevision: 2,
    })).toBe(false)
    expect(isStudioAction({
      kind: "open-managed-discard",
      managedRunId: "66666666-6666-4666-8666-666666666666",
      expectedRevision: 0,
    })).toBe(false)
    expect(isStudioAction({ kind: "save-draft", route: "direction", values: { problem: "x".repeat(50_001) } })).toBe(false)
    expect(isStudioAction({
      kind: "analyze-impact",
      recordType: "requirement",
      recordId: "11111111-1111-4111-8111-111111111111",
      revision: 2,
      digest: `sha256:${"a".repeat(64)}`,
    })).toBe(true)
    expect(isStudioAction({
      kind: "show-change-impact",
      expectedProductId: "00000000-0000-4000-8000-000000000001",
      expectedProductRevision: 2,
      expectedProductDigest: `sha256:${"a".repeat(64)}`,
      expectedChangeId: "00000000-0000-4000-8000-000000000002",
      expectedChangeRevision: 3,
      expectedChangeDigest: `sha256:${"b".repeat(64)}`,
    })).toBe(true)
    expect(isStudioAction({
      kind: "show-change-impact",
      expectedProductId: "00000000-0000-4000-8000-000000000001",
      expectedProductRevision: 2,
      expectedProductDigest: `sha256:${"a".repeat(64)}`,
      expectedChangeId: "00000000-0000-4000-8000-000000000002",
      expectedChangeRevision: 3,
      expectedChangeDigest: `sha256:${"b".repeat(64)}`,
      command: "workbench.action.terminal.new",
    })).toBe(false)
  })

  it("accepts explicit table truncation metadata and rejects silent or inconsistent totals", () => {
    const trace = snapshot("trace")
    if (trace.page.kind !== "trace") throw new Error("Expected Trace page")
    const valid = {
      ...trace,
      page: {
        ...trace.page,
        searchResults: {
          ...trace.page.searchResults,
          truncation: { shown: 0, total: 300, message: "Refine the bounded search." },
        },
      },
    }
    expect(isStudioSnapshot(valid)).toBe(true)
    expect(isStudioSnapshot({
      ...valid,
      page: {
        ...valid.page,
        searchResults: { ...valid.page.searchResults, truncation: { shown: 301, total: 300, message: "Invalid" } },
      },
    })).toBe(false)
  })

  it("validates bounded table pagination metadata", () => {
    const trace = snapshot("trace")
    if (trace.page.kind !== "trace") throw new Error("Expected Trace page")
    const valid = {
      ...trace,
      page: {
        ...trace.page,
        relationships: {
          ...trace.page.relationships,
          pagination: { offset: 0, limit: 50, total: 0, hasPrevious: false, hasNext: false },
        },
      },
    }
    expect(isStudioSnapshot(valid)).toBe(true)
    expect(isStudioSnapshot({
      ...valid,
      page: {
        ...valid.page,
        relationships: { ...valid.page.relationships, pagination: { ...valid.page.relationships.pagination, hasPrevious: true } },
      },
    })).toBe(false)
  })

  it("binds messages to the expected channel and rejects extra envelope fields", () => {
    const ready = {
      protocolVersion: studioProtocolVersion,
      channelId,
      type: "studio.ready",
      restoredRoute: "overview",
    }
    expect(parseStudioToHostMessage(ready, channelId)?.type).toBe("studio.ready")
    expect(parseStudioToHostMessage(ready, "another_channel_123456")).toBeUndefined()
    expect(parseStudioToHostMessage({ ...ready, command: "arbitrary" }, channelId)).toBeUndefined()

    const action = {
      protocolVersion: studioProtocolVersion,
      channelId,
      type: "studio.action",
      requestId: "request-1",
      expectedContextGeneration: contextGeneration,
      expectedSnapshotRevision: 1,
      action: { kind: "show-diagnostics" },
    }
    expect(parseStudioToHostMessage(action, channelId)?.type).toBe("studio.action")
    const withoutGeneration: Record<string, unknown> = { ...action }
    delete withoutGeneration.expectedContextGeneration
    expect(parseStudioToHostMessage(withoutGeneration, channelId)).toBeUndefined()
    expect(parseStudioToHostMessage({ ...action, expectedContextGeneration: "short" }, channelId)).toBeUndefined()

    const hostSnapshot = {
      protocolVersion: studioProtocolVersion,
      channelId,
      type: "studio.snapshot",
      snapshot: snapshot("readiness"),
    }
    expect(parseHostToStudioMessage(hostSnapshot, channelId)?.type).toBe("studio.snapshot")
    expect(parseHostToStudioMessage({ ...hostSnapshot, path: "/private" }, channelId)).toBeUndefined()
  })
})
