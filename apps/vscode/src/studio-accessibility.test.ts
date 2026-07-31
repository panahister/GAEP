/// <reference lib="dom" />

import axe from "axe-core"
import { JSDOM } from "jsdom"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { canonicalDigest } from "@gaep/agent-sdk"
import type { Initiative, Product } from "@gaep/contracts"
import {
  composePhase1AgentModelDashboard,
  composePhase2ChangeImpactAgentModelDashboard,
  composePhase2UxFigmaDashboard,
  composePhase3aDashboard,
  composePhaseDashboardFramework,
} from "@gaep/engine"

import { installStudioClient } from "./studio-client.js"
import { createStudioDocument } from "./studio-document.js"
import {
  isStudioSnapshot,
  runStageLabels,
  studioProtocolVersion,
  studioRouteLabels,
  studioRoutes,
  type StudioPageSnapshot,
  type StudioRoute,
  type StudioSnapshot,
  type StudioTableSnapshot,
  type StudioToHostMessage,
} from "./studio-protocol.js"

const channelId = "accessibility_channel_1234567890"
const contextGeneration = "accessibility_context_1234567890"
const nonce = "accessibility_nonce_1234567890"

interface CapturedState {
  route?: StudioRoute
}

interface CapturedWebviewApi {
  messages: unknown[]
  state?: CapturedState
  clipboardText?: string
}

const captured: CapturedWebviewApi = { messages: [] }
let dom: JSDOM
const originalGlobals = new Map<string, PropertyDescriptor | undefined>()

function table(id: string): StudioTableSnapshot {
  return {
    id,
    title: id.replaceAll("-", " "),
    columns: [{ key: "name", label: "Name" }],
    rows: [{
      id: `${id}-1`,
      cells: { name: `${id} record` },
      actions: [{ label: "Open record", enabled: true, action: { kind: "open-record", recordId: `${id}-1` } }],
    }],
    actions: [],
  }
}

function baseFor<R extends StudioRoute>(route: R) {
  return {
    route,
    title: studioRouteLabels[route],
    purpose: `Review ${studioRouteLabels[route]} without leaving Product Studio.`,
    source: { provenance: "Verified local Product snapshot", sourceRevision: 2 },
    actions: [],
  }
}

const sections = () => studioRoutes.map((route) => ({ route, state: "in-progress" as const, gapCount: route === "scope" ? 1 : 0 }))

function pageFor(route: StudioRoute): StudioPageSnapshot {
  switch (route) {
    case "overview":
      return {
        ...baseFor(route),
        kind: "overview",
        product: { name: "Accessible Product", lifecycle: "active", revision: 2, readinessStatement: "One scope gap remains." },
        primaryAction: { label: "Resolve scope gap", enabled: true, emphasis: "primary", action: { kind: "navigate", route: "scope" } },
        sections: sections(),
        currentInitiative: [{ term: "Initiative", value: "Founder verification" }],
        latestRun: [{ term: "Run", value: "No run started" }],
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
        recordId: `${route}-record`,
        draftId: `${route}-draft`,
        baseRevision: 2,
        fields: [
          {
            id: `${route}-summary`,
            label: "Summary",
            question: "What must reviewers understand?",
            kind: "single-line",
            value: "A bounded, attributable statement.",
            required: true,
            example: "State one testable claim.",
            provenance: "Founder draft",
            validation: { state: "valid", message: "Validated against the local schema." },
            designState: "complete",
          },
          {
            id: `${route}-items`,
            label: "Related items",
            question: "Which ordered items support this section?",
            kind: "repeatable",
            value: ["Item one"],
            required: false,
            provenance: "Founder draft",
            validation: { state: "not-validated" },
            columns: [{ key: "title", label: "Title" }],
            items: [{ id: "item-1", values: { title: "Item one" } }],
          },
        ],
        gaps: [],
        conflicts: [],
        draft: { state: "saved-locally", materialChange: true, validation: "valid" },
      }
    case "delivery":
      return {
        ...baseFor(route),
        kind: "delivery",
        initiatives: table("initiatives"),
        sources: table("sources"),
        sourceBaselines: table("source-baselines"),
        sourceProvenance: table("source-provenance"),
        changes: {
          ...table("changes"),
          pagination: { offset: 0, limit: 50, total: 75, hasPrevious: false, hasNext: true },
          actions: [
            { label: "Previous Changes page", enabled: false, disabledReason: "This is the first page.", action: { kind: "domain-page", recordKind: "change", offset: 0, limit: 50 } },
            { label: "Next Changes page", enabled: true, action: { kind: "domain-page", recordKind: "change", offset: 50, limit: 50 } },
          ],
        },
        workItems: table("work-items"),
      }
    case "risks-decisions":
      return { ...baseFor(route), kind: "risks-decisions", risks: table("risks"), recommendations: table("recommendations"), decisions: table("decisions"), decisionRegisters: table("decision-registers"), riskRegisters: table("risk-registers"), evidenceRegistries: table("evidence-registries") }
    case "trace":
      return {
        ...baseFor(route),
        kind: "trace",
        p5Handoffs: table("p5-handoff-packages"),
        readinessGates: table("p0-p4-readiness-gates"),
        traceabilityGraphs: table("end-to-end-traceability"),
        relationships: table("relationships"),
        searchResults: table("search-results"),
        impact: [{ label: "Downstream work", entries: [{ term: "Work item", value: "Verification" }] }],
        caveat: "An absent link does not prove absent impact.",
      }
    case "agents-tools":
      return {
        ...baseFor(route),
        kind: "agents-tools",
        adapters: table("adapters"),
        selection: {
          agent: "Manual",
          model: "Founder",
          modelTruthClass: "declared",
          modelAlias: false,
          settings: [],
          limitationsReviewed: true,
          actions: [],
        },
        selectedAgent: [{ term: "Agent", value: "Manual" }],
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
        composer: {
          preparedRunId: "prepared-run-1",
          currentStage: 4,
          stages: runStageLabels.map((label, index) => ({
            stage: (index + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
            state: index < 3 ? "complete" : index === 3 ? "in-progress" : "not-started",
            summary: label,
            issues: [],
          })),
          reviewSections: [{ label: "Policy", value: "Bounded local review", state: "pending" }],
          actions: [],
        },
        selectedRun: [{ term: "Run", value: "Prepared" }],
        events: [{ id: "event-1", time: "2026-07-21T00:00:00.000Z", kind: "prepared", summary: "Awaiting confirmation" }],
        recovery: {
          id: "managed-recovery",
          title: "Restart and recovery state",
          columns: [
            { key: "managedRun", label: "Managed Run", identifier: true },
            { key: "attention", label: "Recovery attention" },
            { key: "boundary", label: "Non-authoritative meaning" },
          ],
          rows: [{
            id: "recovery-managed-run-1",
            cells: {
              managedRun: "managed-run-1",
              attention: "Unknown outcome with local cleanup pending",
              boundary: "No recovery, apply, cleanup, resume, or provider outcome success is claimed.",
            },
            state: "local-cleanup-pending",
            actions: [
              { label: "Select underlying Run", enabled: true, action: { kind: "select-record", recordId: "run-1" } },
              { label: "Show diagnostics", enabled: true, action: { kind: "show-diagnostics" } },
            ],
          }],
          actions: [],
        },
        managedEvidence: table("managed-evidence"),
        evidence: table("evidence"),
        handoffs: table("handoffs"),
        recoveryActions: [],
      }
    case "readiness":
      return {
        ...baseFor(route),
        kind: "readiness",
        statement: "One scope gap remains before the Product is ready.",
        sections: sections(),
        gaps: [{ id: "gap-1", message: "Resolve the bounded scope.", severity: "warning", sourceRecordId: "scope-record" }],
        conflicts: [],
        nextAction: { label: "Open scope", enabled: true, action: { kind: "navigate", route: "scope" } },
        health: [],
        designRevisions: table("design-revisions"),
        productRevisions: table("product-revisions"),
        portableDesignSnapshots: {
          id: "portable-design-snapshots",
          title: "Portable design snapshots",
          columns: [
            { key: "title", label: "Design snapshot", identifier: true },
            { key: "governance", label: "GAEP state" },
            { key: "sourceReview", label: "Upstream source review" },
          ],
          rows: [{
            id: "22222222-2222-4222-8222-222222222222",
            cells: {
              title: "Checkout design",
              governance: "pending-human-review",
              sourceReview: "approved upstream claim; not GAEP approval",
            },
            state: "pending-human-review",
            actions: [{
              label: "Read verified metadata",
              enabled: true,
              action: { kind: "read-portable-design-snapshot", bundleId: "22222222-2222-4222-8222-222222222222" },
            }],
          }],
          actions: [{
            label: "Import local design bundle",
            enabled: true,
            emphasis: "primary",
            action: { kind: "domain-workflow", workflow: "import-portable-design-snapshot" },
          }],
          pagination: { offset: 0, limit: 50, total: 1, hasPrevious: false, hasNext: false },
        },
        designerReadyGates: table("designer-ready-gates"),
        designDeltas: table("design-deltas"),
        designConflictResolutions: table("design-conflict-resolutions"),
        humanDesignApprovals: table("human-design-approvals"),
        designBaselines: table("design-baselines"),
        designDriftDetections: table("design-drift-detections"),
        portability: [{
          term: "Upstream source review",
          value: "The preserved claim is not GAEP approval, a Design Baseline, implementation readiness, or release readiness.",
        }],
      }
  }
}

function snapshot(route: StudioRoute, revision: number): StudioSnapshot {
  return {
    protocolVersion: studioProtocolVersion,
    contextGeneration,
    snapshotRevision: revision,
    route,
    workspace: { label: "Isolated test workspace", trusted: true, connectivity: "online", health: "valid" },
    navigation: sections(),
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
    ...(route === "readiness" ? { phase1Summary: phase1SummaryDashboard() } : {}),
    page: pageFor(route),
    inspector: route === "trace" ? {
      title: "Trace record",
      recordId: "trace-record-1",
      entries: [{ term: "Provenance", value: "Verified local Product snapshot" }],
      relationships: [{ term: "Downstream", value: "Verification work" }],
      actions: [],
    } : undefined,
    footer: { draftState: "saved-locally", sourceRevision: 2, validationSummary: "Schema valid" },
  }
}

function phase1SummaryDashboard(): NonNullable<StudioSnapshot["phase1Summary"]> {
  const readinessGaps = {
    applicability: 0,
    conditional: 0,
    incomplete: 0,
    failed: 0,
    blocked: 0,
    staleOrUnknown: 0,
    waivers: 0,
    decisions: 0,
    conditions: 0,
    requirements: 0,
    adverseEvidence: 0,
    bindings: 0,
    sourceReferences: 0,
    inconsistencies: 0,
    questions: 0,
    total: 0,
  }
  const handoffGaps = {
    unresolvedItems: 0,
    staleOrUnknownItems: 0,
    requirements: 0,
    conflicts: 0,
    questions: 0,
    bindings: 0,
    sourceReferences: 0,
    total: 0,
  }
  const content: Omit<NonNullable<StudioSnapshot["phase1Summary"]>, "snapshotDigest"> = {
    schemaVersion: 1,
    kind: "phase-1-summary-readiness-dashboard",
    phase: { id: "phase-1b-product", label: "Phase 1B — Product P0–P4" },
    product: {
      recordType: "product",
      recordId: "00000000-0000-4000-8000-000000000001",
      revision: 2,
      digest: `sha256:${"a".repeat(64)}`,
    },
    initiative: {
      recordType: "initiative",
      recordId: "00000000-0000-4000-8000-000000000002",
      revision: 3,
      digest: `sha256:${"c".repeat(64)}`,
      state: "active",
    },
    readiness: {
      snapshotDigest: `sha256:${"d".repeat(64)}`,
      result: "not-assessed",
      assessedAt: "2026-07-27T00:00:00.000Z",
      outputs: { total: 0, applicable: 0, notApplicable: 0, unresolvedApplicability: 0, satisfied: 0 },
      gaps: readinessGaps,
      reasonCount: 1,
      attentionRequired: true,
      authorityBoundary: "readiness-result-is-evaluation-only-not-permission-or-product-readiness",
    },
    handoff: {
      snapshotDigest: `sha256:${"e".repeat(64)}`,
      state: "attention-required",
      transferState: "draft",
      assessedAt: "2026-07-27T00:00:01.000Z",
      items: { total: 0, included: 0, referenceOnly: 0, omittedNotApplicable: 0, unresolved: 0 },
      gaps: handoffGaps,
      reasonCount: 1,
      attentionRequired: true,
      authorityBoundary: "handoff-status-is-candidate-context-only-not-transfer-or-phase-entry-authority",
    },
    phaseStatus: {
      state: "attention-required",
      declaredGapCount: 0,
      attentionSignalCount: 2,
      productOwnerAcceptance: "not-established",
      readinessAuthority: "not-established",
      phaseEntryAuthority: "not-established",
    },
    owners: { state: "unbound", boundOwnerCount: 0, basis: "no-governed-phase-owner-assignment-is-bound" },
    freshness: {
      state: "current",
      readinessObservedAt: "2026-07-27T00:00:02.000Z",
      handoffObservedAt: "2026-07-27T00:00:03.000Z",
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      basis: "exact-current-projections-and-declared-binding-freshness",
    },
    evidenceCues: {
      freshness: "current",
      confidence: { state: "not-assessed", basis: "no-governed-confidence-evaluation-is-bound" },
    },
    observedAt: "2026-07-27T00:00:04.000Z",
    sourceBoundary: "current-governed-product-initiative-readiness-and-handoff-projections-only",
    privacyBoundary: "summary-exposes-identities-counts-statuses-times-and-digests-not-narrative-findings-evidence-source-content-personal-data-secrets-or-credentials",
    limitations: ["Phase ownership remains unbound until a governed phase-owner assignment record is available."],
    authorityBoundary: "phase-1-summary-is-read-only-candidate-evidence-not-readiness-approval-acceptance-phase-entry-release-or-action-authority",
  }
  return { ...content, snapshotDigest: canonicalDigest(content) }
}

function phase2UxFigmaDashboard(): NonNullable<StudioSnapshot["phase2UxFigma"]> {
  const product: Product = {
    schemaVersion: 1,
    id: "00000000-0000-4000-8000-000000000001",
    kind: "product",
    revision: 2,
    name: "Accessible Phase 2 Product",
    summary: "An exact, accessible Phase 2 UX and Figma projection fixture",
    problem: "Phase 2 evidence is distributed across governed projections.",
    affectedUsers: "Product owners, designers, reviewers, and engineers",
    desiredOutcome: "Expose bounded Phase 2 state without synthesizing authority.",
    successSignals: ["The derived view remains exact and accessible"],
    firstWorkflow: "Inspect source coverage and governance candidates.",
    exclusions: ["Automatic approval, Figma effects, or implementation effects"],
    profile: "internal-tool",
    lifecycleState: "active",
    createdAt: "2026-07-30T03:00:00.000Z",
    updatedAt: "2026-07-30T03:00:00.000Z",
  }
  const initiative: Initiative = {
    schemaVersion: 1,
    id: "00000000-0000-4000-8000-000000000002",
    kind: "initiative",
    revision: 3,
    productId: product.id,
    title: "Accessible Phase 2 Initiative",
    outcome: "Inspect exact UX and Figma evidence without granting readiness.",
    scope: ["P2-01 through P2-23 derived state"],
    exclusions: ["Approval, baseline, readiness, Figma, remediation, or implementation authority"],
    state: "active",
    createdAt: "2026-07-30T03:00:00.000Z",
    updatedAt: "2026-07-30T03:00:00.000Z",
  }
  return composePhase2UxFigmaDashboard(product, initiative, [], {
    expectedProductId: product.id,
    expectedProductRevision: product.revision ?? 1,
    expectedProductDigest: canonicalDigest(product),
    expectedInitiativeId: initiative.id,
    expectedInitiativeRevision: initiative.revision ?? 1,
    expectedInitiativeDigest: canonicalDigest(initiative),
  }, "2026-07-30T03:10:00.000Z")
}

function phase3aDashboard(): NonNullable<StudioSnapshot["phase3aDashboard"]> {
  const product: Product = {
    schemaVersion: 1,
    id: "00000000-0000-4000-8000-000000000001",
    kind: "product",
    revision: 2,
    name: "Accessible Phase 3A Product",
    summary: "An exact, accessible Phase 3A dashboard fixture",
    problem: "Implementation-readiness evidence is distributed across governed projections.",
    affectedUsers: "Product owners, reviewers, and engineers",
    desiredOutcome: "Expose bounded Phase 3A state without synthesizing authority.",
    successSignals: ["The derived view remains exact and accessible"],
    firstWorkflow: "Inspect source coverage, gaps, and provider workflow evidence.",
    exclusions: ["Automatic prioritization, readiness, approval, implementation, or release effects"],
    profile: "internal-tool",
    lifecycleState: "active",
    createdAt: "2026-07-31T03:00:00.000Z",
    updatedAt: "2026-07-31T03:00:00.000Z",
  }
  const initiative: Initiative = {
    schemaVersion: 1,
    id: "00000000-0000-4000-8000-000000000002",
    kind: "initiative",
    revision: 3,
    productId: product.id,
    title: "Accessible Phase 3A Initiative",
    outcome: "Inspect exact delivery-planning evidence without granting readiness.",
    scope: ["P3A-01 through P3A-23 derived state"],
    exclusions: ["Priority, readiness, waiver, ownership, implementation, acceptance, release, or deployment authority"],
    state: "active",
    createdAt: "2026-07-31T03:00:00.000Z",
    updatedAt: "2026-07-31T03:00:00.000Z",
  }
  return composePhase3aDashboard(product, initiative, [], {
    expectedProductId: product.id,
    expectedProductRevision: product.revision ?? 1,
    expectedProductDigest: canonicalDigest(product),
    expectedInitiativeId: initiative.id,
    expectedInitiativeRevision: initiative.revision ?? 1,
    expectedInitiativeDigest: canonicalDigest(initiative),
  }, [], "2026-07-31T03:10:00.000Z")
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
      approval: { state: "not-established", basis: "current-contract-has-no-change-approval-record" },
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
    product: { recordType: "product" as const, recordId: "00000000-0000-4000-8000-000000000001", revision: 2, digest: `sha256:${"a".repeat(64)}` },
    capabilities: [{
      adapterId: "gaep.manual", adapterVersion: "1.0.0", agentId: "manual", agentLabel: "Manual",
      runtimeVersion: "1.0.0", capabilityDigest: `sha256:${"b".repeat(64)}`, detected: true,
      executionInterface: "managed-in-process" as const, interfaceMaturity: "stable" as const,
      support: { resume: true, cancel: true, checkpoints: true, modelDiscovery: true, toolSelection: false },
      modelCount: 1, limitations: { values: ["Offline fixture only."], shown: 1, total: 1, omitted: 0 },
      observedAt, selected: false,
    }],
    selection: { status: "unselected" as const }, runs: [], handoffs: [],
    providerMetrics: {
      usage: { state: "unavailable" as const, basis: "current-managed-records-have-no-provider-usage-or-cost-contract" as const },
      cost: { state: "unavailable" as const, basis: "current-managed-records-have-no-provider-usage-or-cost-contract" as const },
    },
    freshness: {
      state: "current" as const, selectionCapabilityState: "unselected" as const,
      oldestCapabilityObservedAt: observedAt, newestCapabilityObservedAt: observedAt, truncated: false,
      coverageBoundary: "bounded-current-records-do-not-prove-provider-account-or-native-host-readiness" as const,
    },
    evidenceCues: {
      freshness: "current" as const,
      confidence: { state: "not-assessed" as const, basis: "no-governed-confidence-evaluation-is-bound" as const },
    },
    limits: {
      capabilities: { shown: 1, total: 1, omitted: 0 }, runs: { shown: 0, total: 0, omitted: 0 },
      handoffs: { shown: 0, total: 0, omitted: 0 }, managedRuns: { shown: 0, total: 0, omitted: 0 }, truncated: false,
    },
    observedAt,
    sourceBoundary: "current-governed-agent-selection-run-handoff-and-managed-evidence-metadata" as const,
    limitations: ["This projection grants no selection, handoff, launch, or effect authority."],
    authorityBoundary: "agent-model-dashboard-does-not-select-switch-handoff-launch-or-authorize-effects" as const,
  }
  return { ...content, snapshotDigest: canonicalDigest(content) }
}

function phase2IntegratedDashboards(): Pick<
  StudioSnapshot,
  "dashboard" | "phase2UxFigma" | "phase1AgentModel" | "phase2ChangeImpactAgentModel"
> {
  const product: Product = {
    schemaVersion: 1,
    id: "00000000-0000-4000-8000-000000000001",
    kind: "product",
    revision: 2,
    name: "Accessible Phase 2 Product",
    summary: "An exact, accessible Phase 2 UX and Figma projection fixture",
    problem: "Phase 2 evidence is distributed across governed projections.",
    affectedUsers: "Product owners, designers, reviewers, and engineers",
    desiredOutcome: "Expose bounded Phase 2 state without synthesizing authority.",
    successSignals: ["The derived view remains exact and accessible"],
    firstWorkflow: "Inspect source coverage and governance candidates.",
    exclusions: ["Automatic approval, Figma effects, or implementation effects"],
    profile: "internal-tool",
    lifecycleState: "active",
    createdAt: "2026-07-30T03:00:00.000Z",
    updatedAt: "2026-07-30T03:00:00.000Z",
  }
  const initiative: Initiative = {
    schemaVersion: 1,
    id: "00000000-0000-4000-8000-000000000002",
    kind: "initiative",
    revision: 3,
    productId: product.id,
    title: "Accessible Phase 2 Initiative",
    outcome: "Inspect exact UX and Figma evidence without granting readiness.",
    scope: ["P2-01 through P2-23 derived state"],
    exclusions: ["Approval, baseline, readiness, Figma, remediation, or implementation authority"],
    state: "active",
    createdAt: "2026-07-30T03:00:00.000Z",
    updatedAt: "2026-07-30T03:00:00.000Z",
  }
  const productDigest = canonicalDigest(product)
  const initiativeDigest = canonicalDigest(initiative)
  const phase2Request = {
    expectedProductId: product.id,
    expectedProductRevision: product.revision ?? 1,
    expectedProductDigest: productDigest,
    expectedInitiativeId: initiative.id,
    expectedInitiativeRevision: initiative.revision ?? 1,
    expectedInitiativeDigest: initiativeDigest,
  }
  const phase2UxFigma = composePhase2UxFigmaDashboard(
    product,
    initiative,
    [],
    phase2Request,
    "2026-07-30T03:10:00.000Z",
  )
  const dashboard = composePhaseDashboardFramework(product, {
    phase: "phase-2-design",
    expectedProductId: product.id,
    expectedProductRevision: product.revision ?? 1,
    expectedProductDigest: productDigest,
  }, "2026-07-30T03:09:00.000Z")
  const { snapshotDigest: _agentDigest, ...agentContent } = agentModelDashboard()
  const exactAgentContent = {
    ...agentContent,
    product: {
      recordType: "product" as const,
      recordId: product.id,
      revision: product.revision ?? 1,
      digest: productDigest,
    },
  }
  const exactAgentModel = { ...exactAgentContent, snapshotDigest: canonicalDigest(exactAgentContent) }
  const agentModelRequest = {
    expectedProductId: product.id,
    expectedProductRevision: product.revision ?? 1,
    expectedProductDigest: productDigest,
    expectedSelection: { status: "unselected" as const },
    expectedCapabilities: exactAgentModel.capabilities.map((capability) => ({
      adapterId: capability.adapterId,
      agentId: capability.agentId,
      capabilityDigest: capability.capabilityDigest,
    })),
  }
  const phase1AgentModel = composePhase1AgentModelDashboard(product, initiative, exactAgentModel, {
    expectedInitiativeId: initiative.id,
    expectedInitiativeRevision: initiative.revision ?? 1,
    expectedInitiativeDigest: initiativeDigest,
    agentModel: agentModelRequest,
  }, "2026-07-30T03:11:00.000Z")
  const phase2ChangeImpactAgentModel = composePhase2ChangeImpactAgentModelDashboard(
    product,
    initiative,
    phase2UxFigma,
    exactAgentModel,
    { ...phase2Request, agentModel: agentModelRequest },
    "2026-07-30T03:12:00.000Z",
  )
  return { dashboard, phase2UxFigma, phase1AgentModel, phase2ChangeImpactAgentModel }
}

function exposeGlobal(name: string, value: unknown): void {
  if (!originalGlobals.has(name)) originalGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
}

function send(message: unknown): void {
  dom.window.dispatchEvent(new dom.window.MessageEvent("message", { data: message }))
}

beforeAll(() => {
  const html = createStudioDocument({
    cspSource: "'self' https://*.vscode-cdn.net",
    clientScriptUri: "vscode-webview://studio/dist/studio-client.js",
    channelId,
    nonce,
    initialRoute: "overview",
  })
  dom = new JSDOM(html, { url: "https://studio.test/" })
  const immediateAnimationFrame = (callback: FrameRequestCallback): number => {
    callback(0)
    return 1
  }
  Object.defineProperty(dom.window, "requestAnimationFrame", { configurable: true, value: immediateAnimationFrame })
  Object.defineProperty(dom.window, "confirm", { configurable: true, value: () => true })
  Object.defineProperty(dom.window.navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (value: string) => { captured.clipboardText = value } },
  })
  for (const [name, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    HTMLButtonElement: dom.window.HTMLButtonElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    Node: dom.window.Node,
    Event: dom.window.Event,
    MessageEvent: dom.window.MessageEvent,
    KeyboardEvent: dom.window.KeyboardEvent,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: immediateAnimationFrame,
    acquireVsCodeApi: () => ({
      postMessage: (message: unknown) => captured.messages.push(message),
      getState: () => captured.state,
      setState: (state: CapturedState) => { captured.state = state },
    }),
  })) exposeGlobal(name, value)
  installStudioClient()
})

afterAll(() => {
  dom.window.close()
  for (const [name, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else Reflect.deleteProperty(globalThis, name)
  }
})

describe("Product Studio rendered accessibility", () => {
  it("starts through the typed VS Code bridge and exposes both live regions", () => {
    expect(captured.messages[0]).toMatchObject({
      protocolVersion: studioProtocolVersion,
      channelId,
      type: "studio.ready",
      restoredRoute: "overview",
    })
    expect(dom.window.document.querySelector('[role="status"][aria-live="polite"]')).not.toBeNull()
    expect(dom.window.document.querySelector('[role="alert"][aria-live="assertive"]')).not.toBeNull()

    send({ protocolVersion: studioProtocolVersion, channelId, type: "studio.announce", message: "Draft saved locally", priority: "polite" })
    send({ protocolVersion: studioProtocolVersion, channelId, type: "studio.announce", message: "Execution blocked", priority: "assertive" })
    expect(dom.window.document.getElementById("studio-live-polite")?.textContent).toBe("Draft saved locally")
    expect(dom.window.document.getElementById("studio-live-assertive")?.textContent).toBe("Execution blocked")
  })

  it("renders all twelve approved surfaces without detectable axe violations", async () => {
    let revision = 1
    for (const route of studioRoutes) {
      const candidate = snapshot(route, revision++)
      expect(isStudioSnapshot(candidate), route).toBe(true)
      send({ protocolVersion: studioProtocolVersion, channelId, type: "studio.snapshot", snapshot: candidate })
      expect(dom.window.document.getElementById("studio-page-title")?.textContent, route).toBeTruthy()
      expect(dom.window.document.querySelectorAll(".studio-nav button"), route).toHaveLength(studioRoutes.length)
      expect(dom.window.document.querySelectorAll("#studio-route-select option"), route).toHaveLength(studioRoutes.length)
      expect(dom.window.document.querySelector('[aria-label="Phase-scoped dashboard framework"]'), route).not.toBeNull()
      expect(dom.window.document.body.textContent, route).toMatch(/Evidence freshness: current/i)
      expect(dom.window.document.body.textContent, route).toMatch(/Confidence: not assessed/i)
      expect(dom.window.document.body.textContent, route).toMatch(/Unknown — governed decision required/)
      expect(dom.window.document.body.textContent, route).toMatch(/does not prove phase approval, readiness, acceptance, or applicability/)
      if (route === "readiness") {
        expect(dom.window.document.querySelector('[aria-label="Phase 1 summary and readiness dashboard"]')).not.toBeNull()
        expect(dom.window.document.body.textContent).toMatch(/Owners: unbound/)
        expect(dom.window.document.body.textContent).toMatch(/Product Owner acceptance, readiness authority, and phase-entry authority are not established/)
      }
      for (const element of dom.window.document.querySelectorAll<HTMLElement>("[tabindex]")) {
        expect(Number(element.getAttribute("tabindex")), `${route}: ${element.outerHTML}`).toBeLessThanOrEqual(0)
      }

      const result = await axe.run(dom.window.document.documentElement, {
        rules: {
          // jsdom has no layout or theme color resolution; native-theme contrast is verified in the host lane.
          "color-contrast": { enabled: false },
        },
      })
      expect(result.violations.map((violation) => ({ id: violation.id, nodes: violation.nodes.map((node) => node.target) })), route).toEqual([])
    }
  }, 30_000)

  it("gives durable run events semantic time values and a truthful empty state", () => {
    const populated = snapshot("runs-evidence", 90)
    send({ protocolVersion: studioProtocolVersion, channelId, type: "studio.snapshot", snapshot: populated })
    const timeline = dom.window.document.querySelector('ol[aria-label="Durable normalized Managed Run events"]')
    expect(timeline).not.toBeNull()
    expect(timeline?.querySelector("time")?.getAttribute("datetime")).toBe("2026-07-21T00:00:00.000Z")

    if (populated.page.kind !== "runs-evidence") throw new Error("Expected Runs & Evidence page")
    const empty: StudioSnapshot = { ...populated, snapshotRevision: 91, page: { ...populated.page, events: [] } }
    expect(isStudioSnapshot(empty)).toBe(true)
    send({ protocolVersion: studioProtocolVersion, channelId, type: "studio.snapshot", snapshot: empty })
    expect(dom.window.document.querySelector('ol[aria-label="Durable normalized Managed Run events"]')).toBeNull()
    expect(dom.window.document.body.textContent).toMatch(/No durable normalized Managed Run events.*Legacy lifecycle state does not imply evidence/i)
  })

  it("renders recovery attention as a keyboard-operable non-authoritative status", () => {
    const candidate = snapshot("runs-evidence", 92)
    send({ protocolVersion: studioProtocolVersion, channelId, type: "studio.snapshot", snapshot: candidate })
    const document = dom.window.document
    expect(document.body.textContent).toMatch(/Restart and recovery state/i)
    expect(document.body.textContent).toMatch(/Unknown outcome with local cleanup pending/i)
    expect(document.body.textContent).toMatch(/No recovery, apply, cleanup, resume, or provider outcome success is claimed/i)
    const diagnostics = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent === "Show diagnostics")
    expect(diagnostics?.disabled).toBe(false)
    expect(diagnostics?.tabIndex).toBeGreaterThanOrEqual(0)
    diagnostics?.click()
    expect(captured.messages.at(-1)).toMatchObject({
      type: "studio.action",
      action: { kind: "show-diagnostics" },
    })
  })

  it("renders the portable design import stop-line and keyboard-operable metadata action", () => {
    const candidate = snapshot("readiness", 93)
    send({ protocolVersion: studioProtocolVersion, channelId, type: "studio.snapshot", snapshot: candidate })
    expect(dom.window.document.body.textContent).toMatch(/pending-human-review/i)
    expect(dom.window.document.body.textContent).toMatch(/approved upstream claim; not GAEP approval/i)
    expect(dom.window.document.body.textContent).toMatch(/not GAEP approval, a Design Baseline, implementation readiness, or release readiness/i)
    const read = Array.from(dom.window.document.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent === "Read verified metadata")
    expect(read?.disabled).toBe(false)
    expect(read?.tabIndex).toBeGreaterThanOrEqual(0)
  })

  it("renders the Change and impact projection as metadata without approval controls", () => {
    const candidate: StudioSnapshot = {
      ...snapshot("delivery", 94),
      changeImpact: changeImpactDashboard(),
    }
    expect(isStudioSnapshot(candidate)).toBe(true)
    send({ protocolVersion: studioProtocolVersion, channelId, type: "studio.snapshot", snapshot: candidate })
    const document = dom.window.document
    expect(document.querySelector('[aria-label="Exact Change and impact dashboard"]')).not.toBeNull()
    expect(document.body.textContent).toMatch(/Selected Change and impact/i)
    expect(document.body.textContent).toMatch(/Approval is not established/i)
    expect(document.body.textContent).toMatch(/Evidence freshness: current/i)
    expect(document.body.textContent).toMatch(/Confidence: not assessed/i)
    expect(document.body.textContent).toMatch(/Changed artifacts/i)
    expect(document.body.textContent).toMatch(/Affected units from persisted trace/i)
    expect(document.body.textContent).toMatch(/cannot approve the Change, accept risk, or authorize effects/i)
    const labels = Array.from(document.querySelectorAll<HTMLButtonElement>("button"), (button) => button.textContent ?? "")
    expect(labels.some((label) => /approve|accept risk|authorize effect/i.test(label))).toBe(false)
  })

  it("renders exact Agent and Model evidence without selection or launch controls", () => {
    const candidate: StudioSnapshot = {
      ...snapshot("agents-tools", 95),
      agentModel: agentModelDashboard(),
    }
    expect(isStudioSnapshot(candidate)).toBe(true)
    send({ protocolVersion: studioProtocolVersion, channelId, type: "studio.snapshot", snapshot: candidate })
    const document = dom.window.document
    expect(document.querySelector('[aria-label="Exact Agent and Model dashboard"]')).not.toBeNull()
    expect(document.body.textContent).toMatch(/Agent and model evidence/i)
    expect(document.body.textContent).toMatch(/Observed agent capabilities/i)
    expect(document.body.textContent).toMatch(/Evidence freshness: current/i)
    expect(document.body.textContent).toMatch(/Confidence: not assessed/i)
    expect(document.body.textContent).toMatch(/Provider usage.*Unavailable/i)
    expect(document.body.textContent).toMatch(/cannot select or switch an agent, hand off work, launch a Run, or authorize effects/i)
    const labels = Array.from(document.querySelectorAll<HTMLButtonElement>("button"), (button) => button.textContent ?? "")
    expect(labels.some((label) => /select agent|switch agent|launch run|authorize effect/i.test(label))).toBe(false)
  })

  it("renders the Phase 2 UX and Figma projection accessibly without authority controls", async () => {
    const candidate = snapshot("overview", 96)
    if (!candidate.dashboard) throw new Error("Expected dashboard fixture")
    candidate.dashboard.phase = { id: "phase-2-design", label: "Phase 2 — UX and Figma Loop" }
    candidate.dashboard.panels[0] = {
      id: "ux-figma",
      role: "phase",
      title: "UX and Figma",
      applicability: { status: "unknown", basis: "not-evaluated" },
      state: "attention-required",
    }
    candidate.phase2UxFigma = phase2UxFigmaDashboard()
    expect(isStudioSnapshot(candidate)).toBe(true)
    send({ protocolVersion: studioProtocolVersion, channelId, type: "studio.snapshot", snapshot: candidate })

    const document = dom.window.document
    expect(document.querySelector('[aria-label="Phase 2 UX and Figma dashboard"]')).not.toBeNull()
    expect(document.body.textContent).toMatch(/Phase 2 UX and Figma/i)
    expect(document.body.textContent).toMatch(/23 unavailable governed sources/i)
    expect(document.body.textContent).toMatch(/Governed source projections/i)
    expect(document.body.textContent).toMatch(/Governance candidates/i)
    expect(document.body.textContent).toMatch(/Product Owner acceptance.*not established/i)
    const labels = Array.from(document.querySelectorAll<HTMLButtonElement>("button"), (button) => button.textContent ?? "")
    expect(labels.some((label) => /approve|set baseline|write figma|import figma|apply remediation/i.test(label))).toBe(false)

    const result = await axe.run(document.documentElement, {
      rules: { "color-contrast": { enabled: false } },
    })
    expect(result.violations.map((violation) => ({ id: violation.id, nodes: violation.nodes.map((node) => node.target) }))).toEqual([])
  })

  it("renders the bounded Phase 3A dashboard accessibly without readiness or action authority", async () => {
    const candidate = snapshot("overview", 97)
    if (!candidate.dashboard) throw new Error("Expected dashboard fixture")
    candidate.dashboard.phase = { id: "phase-3a-readiness", label: "Phase 3A — Backlog and Implementation Readiness" }
    candidate.dashboard.panels[0] = {
      id: "backlog-readiness",
      role: "phase",
      title: "Backlog and implementation readiness",
      applicability: { status: "unknown", basis: "not-evaluated" },
      state: "attention-required",
    }
    candidate.phase3aDashboard = phase3aDashboard()
    expect(isStudioSnapshot(candidate)).toBe(true)
    send({ protocolVersion: studioProtocolVersion, channelId, type: "studio.snapshot", snapshot: candidate })

    const document = dom.window.document
    expect(document.querySelector('[aria-label="Phase 3A backlog and implementation readiness dashboard"]')).not.toBeNull()
    expect(document.body.textContent).toMatch(/20 unavailable governed sources/i)
    expect(document.body.textContent).toMatch(/Phase 3A dashboard views/i)
    expect(document.body.textContent).toMatch(/Phase 3A governed source projections/i)
    expect(document.body.textContent).toMatch(/Bounded provider workflow evidence/i)
    expect(document.body.textContent).toMatch(/0 of 2 bounded local provider workflow evidence slots are sealed/i)
    expect(document.body.textContent).toMatch(/no completeness, priority, readiness, waiver, ownership, implementation, acceptance, release, deployment, or action authority/i)
    const labels = Array.from(document.querySelectorAll<HTMLButtonElement>("button"), (button) => button.textContent ?? "")
    expect(labels.some((label) => /prioritize|mark ready|grant waiver|assign owner|implement|approve|release|deploy/i.test(label))).toBe(false)

    const result = await axe.run(document.documentElement, {
      rules: { "color-contrast": { enabled: false } },
    })
    expect(result.violations.map((violation) => ({ id: violation.id, nodes: violation.nodes.map((node) => node.target) }))).toEqual([])
  })

  it("renders the integrated Phase 2 change, impact, agent, and model views without action authority", async () => {
    const candidate: StudioSnapshot = {
      ...snapshot("agents-tools", 97),
      ...phase2IntegratedDashboards(),
    }
    expect(isStudioSnapshot(candidate)).toBe(true)
    send({ protocolVersion: studioProtocolVersion, channelId, type: "studio.snapshot", snapshot: candidate })

    const document = dom.window.document
    expect(document.querySelector('[aria-label="Phase 2 Change Impact Agent and Model dashboard"]')).not.toBeNull()
    expect(document.body.textContent).toMatch(/Synchronization change evidence/i)
    expect(document.body.textContent).toMatch(/Bounded impact signals/i)
    expect(document.body.textContent).toMatch(/Initiative-scoped agent and model execution truth/i)
    expect(document.body.textContent).toMatch(/not a second source of truth/i)
    expect(document.body.textContent).toMatch(/No Run launch or effect authority/i)
    const labels = Array.from(document.querySelectorAll<HTMLButtonElement>("button"), (button) => button.textContent ?? "")
    expect(labels.some((label) => /approve|set baseline|select agent|launch run|authorize effect|apply remediation/i.test(label))).toBe(false)

    const result = await axe.run(document.documentElement, {
      rules: { "color-contrast": { enabled: false } },
    })
    expect(result.violations.map((violation) => ({ id: violation.id, nodes: violation.nodes.map((node) => node.target) }))).toEqual([])
  })

  it("keeps names, focus order, and icon semantics explicit", () => {
    const document = dom.window.document
    for (const control of document.querySelectorAll<HTMLElement>("button, input, select, textarea")) {
      const id = control.id
      const labelled = control.getAttribute("aria-label")?.trim() || control.textContent?.trim() ||
        (id ? Array.from(document.querySelectorAll("label")).find((label) => label.htmlFor === id)?.textContent?.trim() : undefined)
      expect(labelled, control.outerHTML).toBeTruthy()
    }
    for (const element of document.querySelectorAll<HTMLElement>("[tabindex]")) {
      expect(Number(element.getAttribute("tabindex")), element.outerHTML).toBeLessThanOrEqual(0)
    }
    for (const icon of document.querySelectorAll(".codicon")) expect(icon.getAttribute("aria-hidden")).toBe("true")
  })

  it("announces exact paged ranges and restores keyboard focus after navigation", async () => {
    const candidate = snapshot("delivery", 99)
    send({ protocolVersion: studioProtocolVersion, channelId, type: "studio.snapshot", snapshot: candidate })
    const status = Array.from(dom.window.document.querySelectorAll<HTMLElement>(".table-pagination-status"))
      .find((element) => element.textContent?.includes("Showing records 1–1 of 75"))
    expect(status).toMatchObject({ role: "status" })
    expect(status?.getAttribute("aria-live")).toBe("polite")
    const next = Array.from(dom.window.document.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent === "Next Changes page")
    expect(next?.disabled).toBe(false)
    expect(next?.tabIndex).toBeGreaterThanOrEqual(0)
    next?.click()
    const request = captured.messages.at(-1) as Extract<StudioToHostMessage, { type: "studio.action" }> | undefined
    if (!request || request.type !== "studio.action") throw new Error("Expected a page action")
    send({
      protocolVersion: studioProtocolVersion,
      channelId,
      type: "studio.action-result",
      requestId: request.requestId,
      result: { status: "accepted", announcement: "Loaded the next Changes page." },
      snapshot: snapshot("delivery", 100),
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(dom.window.document.activeElement?.textContent).toBe("Next Changes page")
  })

  it("keeps table sorting keyboard-focused, filters visible metadata, and exports only the visible CSV rows", async () => {
    const candidate = snapshot("delivery", 101)
    if (candidate.page.kind !== "delivery") throw new Error("Expected Delivery page")
    candidate.page.changes = {
      ...candidate.page.changes,
      title: "Accessible Changes",
      rows: [
        { id: "change-b", cells: { name: "Beta", state: "proposed", note: "=2+2" }, actions: [] },
        { id: "change-a", cells: { name: "Alpha", state: "active", note: "plain metadata" }, actions: [] },
      ],
      columns: [
        { key: "name", label: "Name" },
        { key: "state", label: "State" },
        { key: "note", label: "Note" },
      ],
    }
    expect(isStudioSnapshot(candidate)).toBe(true)
    send({ protocolVersion: studioProtocolVersion, channelId, type: "studio.snapshot", snapshot: candidate })

    const region = dom.window.document.querySelector<HTMLElement>('[aria-label="Accessible Changes"]')
    expect(region).not.toBeNull()
    const nameSort = Array.from(region?.querySelectorAll<HTMLButtonElement>("thead button") ?? [])
      .find((button) => button.textContent === "Name")
    nameSort?.click()
    const sortedRegion = dom.window.document.querySelector<HTMLElement>('[aria-label="Accessible Changes"]')
    expect(sortedRegion?.querySelector("tbody td")?.textContent).toBe("Alpha")
    expect(dom.window.document.activeElement?.getAttribute("data-table-column")).toBe("name")
    expect(sortedRegion?.querySelector("th")?.getAttribute("aria-sort")).toBe("ascending")
    expect(dom.window.document.getElementById("studio-live-polite")?.textContent).toMatch(/sorted by Name, ascending/i)

    const filter = Array.from(dom.window.document.querySelectorAll<HTMLInputElement>('input[type="search"]'))
      .find((input) => input.getAttribute("data-table-id") === "changes")
    if (!filter) throw new Error("Expected Changes filter")
    filter.value = "beta"
    filter.setSelectionRange(4, 4)
    filter.dispatchEvent(new dom.window.Event("input", { bubbles: true }))
    const filteredRegion = dom.window.document.querySelector<HTMLElement>('[aria-label="Accessible Changes"]')
    expect(filteredRegion?.querySelectorAll("tbody tr")).toHaveLength(1)
    expect(filteredRegion?.querySelector("tbody td")?.textContent).toBe("Beta")
    expect(dom.window.document.activeElement?.getAttribute("data-table-control")).toBe("filter")
    expect((dom.window.document.activeElement as HTMLInputElement).selectionStart).toBe(4)
    expect(dom.window.document.body.textContent).toMatch(/Showing 1 of 2 rows/)

    const copy = Array.from(dom.window.document.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.getAttribute("aria-label") === "Copy Accessible Changes visible metadata rows as CSV")
    copy?.click()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(captured.clipboardText).toBe('\"Name\",\"State\",\"Note\"\r\n\"Beta\",\"proposed\",\"\'=2+2\"')
    expect(captured.clipboardText).not.toContain("Alpha")
    expect(dom.window.document.getElementById("studio-live-polite")?.textContent).toMatch(/copied 1 visible metadata row as CSV/i)
  })

  it("enforces the deny-by-default CSP and excludes forbidden decorative UI", () => {
    const document = dom.window.document
    const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute("content") ?? ""
    expect(csp).toContain("default-src 'none'")
    expect(csp).toContain("connect-src 'none'")
    expect(csp).toContain("frame-src 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'none'")
    expect(csp).toContain("form-action 'none'")
    expect(csp).not.toContain("unsafe-inline")
    expect(csp).not.toContain("unsafe-eval")
    for (const executable of document.querySelectorAll("script, style")) expect(executable.getAttribute("nonce")).toBe(nonce)

    const css = document.querySelector("style")?.textContent ?? ""
    expect(css).not.toMatch(/(?:linear|radial|conic)-gradient|@font-face|background-image|filter:\s*(?:drop-shadow|blur)/i)
    expect(document.querySelectorAll("img, svg, canvas")).toHaveLength(0)
    expect(document.querySelectorAll('[class*="hero"], [class*="bento"], [class*="chat-bubble"], [class*="metric-tile"]')).toHaveLength(0)
  })

  it("contains executable 720px and 480px narrow-layout rules", () => {
    const sheet = dom.window.document.querySelector("style")?.sheet
    expect(sheet).not.toBeNull()
    const mediaRules = Array.from(sheet?.cssRules ?? []).filter((rule): rule is CSSMediaRule => "conditionText" in rule)
    const tablet = mediaRules.find((rule) => rule.conditionText === "(max-width: 719px)")
    const narrow = mediaRules.find((rule) => rule.conditionText === "(max-width: 479px)")
    expect(tablet?.cssText).toMatch(/\.studio-rail\s*{[^}]*display:\s*none/i)
    expect(tablet?.cssText).toMatch(/\.studio-mobile-nav\s*{[^}]*display:\s*block/i)
    expect(tablet?.cssText).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/i)
    expect(narrow?.cssText).toMatch(/\.record-field[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/i)
    expect(narrow?.cssText).toMatch(/\.action-row button\s*{[^}]*width:\s*100%/i)
  })
})
