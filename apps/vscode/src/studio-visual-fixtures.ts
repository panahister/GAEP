import {
  deliveryTableKeys,
  studioProtocolVersion,
  studioRouteLabels,
  studioRoutes,
  type DeliveryPageSnapshot,
  type DeliveryTableKey,
  type StudioPageSnapshot,
  type StudioRoute,
  type StudioSnapshot,
  type StudioSurfaceState,
  type StudioTableSnapshot,
} from "./studio-protocol.js"
import visualScenarioData from "./studio-visual-scenarios.json" with { type: "json" }

export interface StudioVisualFixtureScenario {
  id: string
  route: StudioRoute
  surface: StudioSurfaceState["kind"]
  width: number
  height: number
  theme: "light" | "dark"
  purpose: string
}

export const studioVisualFixtureScenarios = Object.freeze(
  visualScenarioData as readonly StudioVisualFixtureScenario[],
)

export type StudioVisualFixtureId = typeof studioVisualFixtureScenarios[number]["id"]

const scenarioMap = new Map<string, StudioVisualFixtureScenario>(
  studioVisualFixtureScenarios.map((scenario) => [scenario.id, scenario]),
)

function navigation() {
  return studioRoutes.map((route) => ({
    route,
    state: route === "scope" ? "in-progress" as const : "complete" as const,
    gapCount: route === "scope" ? 1 : 0,
  }))
}

function table(id: string, rows = 2): StudioTableSnapshot {
  const title = id
    .replace(/([a-z])([A-Z])/gu, "$1 $2")
    .replaceAll("-", " ")
    .replace(/^./u, (value) => value.toUpperCase())
  return {
    id,
    title,
    columns: [
      { key: "name", label: "Name", identifier: true },
      { key: "state", label: "State" },
      { key: "evidence", label: "Evidence boundary" },
    ],
    rows: Array.from({ length: rows }, (_, index) => ({
      id: `${id}-${index + 1}`,
      cells: {
        name: `${title} ${index + 1}`,
        state: index === 0 ? "candidate-local" : "pending-review",
        evidence: index === 0
          ? "Deterministic fixture metadata only"
          : "No human, provider, Figma, release, or deployment acceptance",
      },
      actions: [{
        label: "Open record",
        enabled: index === 0,
        disabledReason: index === 0 ? undefined : "The fixture record has no governed source binding.",
        action: { kind: "open-record", recordId: `${id}-${index + 1}` },
      }],
    })),
    actions: [{
      label: `Export visible ${title}`,
      enabled: true,
      action: { kind: "domain-workflow", workflow: "export", recordId: id },
    }],
  }
}

function baseFor<R extends StudioRoute>(route: R) {
  return {
    route,
    title: studioRouteLabels[route],
    purpose: `Inspect deterministic ${studioRouteLabels[route]} fixture state without external effects.`,
    source: {
      provenance: "P3B-22 deterministic local visual fixture",
      sourceRevision: 1,
      freshness: "fixture-current",
    },
    actions: [],
  }
}

function pageFor(route: StudioRoute): StudioPageSnapshot {
  switch (route) {
    case "overview":
      return {
        ...baseFor(route),
        kind: "overview",
        product: {
          name: "GAEP Visual Fixture Product",
          lifecycle: "active-local-fixture",
          revision: 1,
          readinessStatement: "Automated visual fixtures pass locally; human design acceptance remains pending.",
        },
        primaryAction: {
          label: "Review scope gap",
          enabled: true,
          emphasis: "primary",
          action: { kind: "navigate", route: "scope" },
        },
        sections: navigation(),
        currentInitiative: [
          { term: "Initiative", value: "Offline VS Code release-candidate verification" },
          { term: "Authority", value: "Local deterministic fixture only" },
        ],
        latestRun: [
          { term: "Run", value: "P3B-22 visual baseline comparison" },
          { term: "Acceptance", value: "Human review pending" },
        ],
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
        recordId: `${route}-fixture-record`,
        draftId: `${route}-fixture-draft`,
        baseRevision: 1,
        fields: [
          {
            id: `${route}-summary`,
            label: "Bounded summary",
            question: "What must a reviewer be able to verify locally?",
            kind: "long-text",
            value: "The Product Studio remains readable, responsive, and explicit about local fixture limits.",
            required: true,
            example: "State only evidence that the offline harness can reproduce.",
            provenance: "P3B-22 local fixture",
            validation: { state: "valid", message: "Validated against the deterministic fixture schema." },
            designState: "complete",
          },
          {
            id: `${route}-items`,
            label: "Included paths",
            question: "Which bounded candidates are included?",
            kind: "repeatable",
            value: ["apps/vscode/src/studio-client.ts"],
            required: false,
            provenance: "P3B-22 local fixture",
            validation: { state: "not-validated" },
            columns: [{ key: "path", label: "Repository-relative path" }],
            items: [{ id: "path-1", values: { path: "apps/vscode/src/studio-client.ts" } }],
          },
        ],
        gaps: [{
          id: "human-visual-review-pending",
          message: "Native display and human design review remain pending.",
          severity: "warning",
        }],
        conflicts: [],
        draft: { state: "saved-locally", materialChange: true, validation: "valid" },
      }
    case "delivery": {
      const tables = Object.fromEntries(
        deliveryTableKeys.map((key) => [key, table(key, key === "changes" || key === "testGenerations" ? 3 : 1)]),
      ) as Pick<DeliveryPageSnapshot, DeliveryTableKey>
      return {
        ...baseFor(route),
        kind: "delivery",
        ...tables,
        changes: {
          ...tables.changes,
          pagination: { offset: 0, limit: 50, total: 75, hasPrevious: false, hasNext: true },
          actions: [
            ...tables.changes.actions,
            {
              label: "Previous Changes page",
              enabled: false,
              disabledReason: "This is the first fixture page.",
              action: { kind: "domain-page", recordKind: "change", offset: 0, limit: 50 },
            },
            {
              label: "Next Changes page",
              enabled: true,
              action: { kind: "domain-page", recordKind: "change", offset: 50, limit: 50 },
            },
          ],
        },
      }
    }
    case "risks-decisions":
      return {
        ...baseFor(route),
        kind: "risks-decisions",
        risks: table("risks"),
        recommendations: table("recommendations"),
        decisions: table("decisions"),
        decisionRegisters: table("decision-registers"),
        riskRegisters: table("risk-registers"),
        evidenceRegistries: table("evidence-registries"),
      }
    case "trace":
      return {
        ...baseFor(route),
        kind: "trace",
        readinessGates: table("p0-p4-readiness-gates"),
        p5Handoffs: table("p5-handoff-packages"),
        traceabilityGraphs: table("end-to-end-traceability"),
        relationships: table("relationships"),
        searchResults: table("search-results"),
        impact: [{
          label: "Affected local scope",
          entries: [
            { term: "Host", value: "VS Code only" },
            { term: "External effects", value: "None" },
          ],
        }],
        caveat: "Metadata trace coverage does not prove semantic correctness or absence of unrecorded impact.",
      }
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
        statement: "Local fixture checks are not Product Owner or release acceptance.",
        sections: navigation(),
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

function surfaceFor(scenario: StudioVisualFixtureScenario): StudioSurfaceState {
  if (scenario.surface === "ready") return { kind: "ready", title: "Ready", issues: [], actions: [] }
  if (scenario.surface === "empty") {
    return {
      kind: "empty",
      title: "No local Product is initialized",
      detail: "Choose a repository folder to initialize a local Product candidate. No external system will be changed.",
      issues: [],
      actions: [{
        label: "Initialize local Product",
        enabled: true,
        emphasis: "primary",
        action: { kind: "initialize-product" },
      }],
    }
  }
  return {
    kind: "invalid",
    title: "Product snapshot is invalid",
    detail: "The local snapshot failed strict validation and no candidate state was projected.",
    issues: [{
      id: "fixture-invalid-binding",
      message: "The fixture demonstrates a fail-closed stale or mismatched binding.",
      severity: "error",
    }],
    actions: [{ label: "Show local diagnostics", enabled: true, action: { kind: "show-diagnostics" } }],
    lastVerifiedState: "Revision 1 remained valid before the rejected fixture input.",
    knownEffects: ["No Product mutation was applied."],
    unknownEffects: ["No claim is made about native display or external systems."],
  }
}

export function getStudioVisualFixtureScenario(id: string): StudioVisualFixtureScenario {
  const scenario = scenarioMap.get(id)
  if (!scenario) throw new Error(`Unknown Product Studio visual fixture: ${id}`)
  return scenario
}

export function createStudioVisualFixture(id: string): StudioSnapshot {
  const scenario = getStudioVisualFixtureScenario(id)
  return {
    protocolVersion: studioProtocolVersion,
    contextGeneration: "visual_fixture_context_1234567890",
    snapshotRevision: 1,
    route: scenario.route,
    workspace: {
      label: "P3B-22 isolated visual fixture workspace",
      trusted: true,
      connectivity: scenario.surface === "invalid" ? "offline" : "provider-absent",
      health: scenario.surface === "invalid" ? "invalid-fixture" : "fixture-only",
    },
    navigation: navigation(),
    surface: surfaceFor(scenario),
    page: pageFor(scenario.route),
    inspector: scenario.route === "trace" ? {
      title: "Fixture trace record",
      recordId: "trace-fixture-record-1",
      entries: [{ term: "Provenance", value: "P3B-22 deterministic local fixture" }],
      relationships: [{ term: "Downstream", value: "Local QA evidence candidate" }],
      actions: [],
    } : undefined,
    footer: {
      draftState: "saved-locally",
      sourceRevision: 1,
      validationSummary: "Fixture-valid; human design acceptance pending",
    },
  }
}
