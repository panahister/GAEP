import { canonicalDigest } from "@gaep/agent-sdk"
import {
  changeImpactChangeCatalogContentSchema,
  changeImpactDashboardContentSchema,
  type Change,
  type ChangeImpactDashboardRequest,
  type Decision,
  type Product,
  type Risk,
  type TraceImpact,
  type TraceLink,
  type WorkItem,
} from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import {
  composeChangeImpactChangeCatalog,
  composeChangeImpactDashboard,
  ChangeImpactChangeBindingError,
  ChangeImpactProductBindingError,
} from "./change-impact-dashboard.js"

const observedAt = "2026-07-24T01:00:01.000Z"
const evaluatedAt = "2026-07-24T01:00:00.000Z"
const productId = "00000000-0000-4000-8000-000000000001"
const initiativeId = "00000000-0000-4000-8000-000000000002"
const changeId = "00000000-0000-4000-8000-000000000003"
const workItemId = "00000000-0000-4000-8000-000000000004"
const decisionId = "00000000-0000-4000-8000-000000000005"
const riskId = "00000000-0000-4000-8000-000000000006"
const decisionLinkId = "00000000-0000-4000-8000-000000000007"
const riskLinkId = "00000000-0000-4000-8000-000000000008"
const selectedOptionId = "00000000-0000-4000-8000-000000000009"
const alternativeOptionId = "00000000-0000-4000-8000-00000000000a"

const product: Product = {
  schemaVersion: 1,
  kind: "product",
  id: productId,
  revision: 1,
  name: "Impact fixture",
  summary: "A bounded Change/Impact dashboard fixture.",
  problem: "Change impact must remain exact, fresh, and governed.",
  affectedUsers: "GAEP operators",
  desiredOutcome: "Changed artifacts, affected units, decisions, and risks stay inspectable.",
  successSignals: ["The dashboard binds current governed records"],
  firstWorkflow: "Inspect one exact Change before any effectful work.",
  exclusions: ["Automatic approval"],
  profile: "software",
  lifecycleState: "active",
  createdAt: "2026-07-24T00:00:00.000Z",
  updatedAt: "2026-07-24T00:00:00.000Z",
}

const change: Change = {
  schemaVersion: 1,
  kind: "change",
  id: changeId,
  productId,
  revision: 1,
  initiativeId,
  title: "Add an exact Change/Impact projection",
  summary: "Compose existing governed records into one bounded read-only dashboard.",
  baseline: { kind: "genesis", declaration: "No shared Change/Impact dashboard exists.", rationale: "First portable slice." },
  state: "proposed",
  effectEnvelope: ["reversible-change"],
  createdAt: "2026-07-24T00:10:00.000Z",
  updatedAt: "2026-07-24T00:10:00.000Z",
}

const workItem: WorkItem = {
  schemaVersion: 1,
  kind: "work-item",
  id: workItemId,
  productId,
  revision: 1,
  changeId,
  title: "Implement the shared contract",
  objective: "Bind changed artifacts and effect targets to the exact Work Item.",
  state: "proposed",
  dependsOn: [],
  completionCriteria: ["The dashboard digest verifies"],
  evidenceCriteria: ["Current and hostile tests pass"],
  scope: {
    read: [{ kind: "workspace-relative", path: "." }],
    write: [{ kind: "workspace-relative", path: "packages/engine/src/change-impact-dashboard.ts" }],
    effects: [{ kind: "logical", value: "package.build" }],
  },
  owner: { kind: "agent", id: "codex" },
  createdAt: "2026-07-24T00:20:00.000Z",
  updatedAt: "2026-07-24T00:20:00.000Z",
}

const decision: Decision = {
  schemaVersion: 1,
  kind: "decision",
  id: decisionId,
  productId,
  revision: 1,
  question: "Should the first dashboard slice remain read-only?",
  options: [
    { id: selectedOptionId, label: "Read only", description: "Project current truth without authority.", tradeoffs: [] },
    { id: alternativeOptionId, label: "Mutating", description: "Add approval and execution actions.", tradeoffs: ["Widens authority"] },
  ],
  selectedOutcome: {
    optionId: selectedOptionId,
    rationale: "Keep the first slice observational.",
    selectedBy: { kind: "human", id: "founder" },
    selectedAt: "2026-07-24T00:30:00.000Z",
  },
  dissentAndUncertainty: [],
  affectedRecords: [{ recordType: "change", recordId: change.id, revision: change.revision, digest: canonicalDigest(change) }],
  state: "decided",
  createdAt: "2026-07-24T00:30:00.000Z",
  updatedAt: "2026-07-24T00:30:00.000Z",
}

const risk: Risk = {
  schemaVersion: 1,
  kind: "risk",
  id: riskId,
  productId,
  revision: 1,
  title: "Incomplete trace coverage",
  cause: "The initial graph may omit a dependency.",
  condition: "A governed trace link has not been recorded.",
  consequence: "The dashboard can understate possible impact.",
  likelihood: "possible",
  impact: "major",
  uncertainty: "Coverage depends on persisted trace links.",
  treatment: "Show the coverage boundary and never infer completeness.",
  owner: { kind: "human", id: "founder" },
  reviewTriggers: ["A Change is prepared for review"],
  residualRisk: "Missing links remain possible.",
  evidence: [],
  state: "open",
  createdAt: "2026-07-24T00:40:00.000Z",
  updatedAt: "2026-07-24T00:40:00.000Z",
}

function link(
  id: string,
  source: TraceLink["source"],
  state: TraceLink["state"] = "valid",
): TraceLink {
  return {
    schemaVersion: 1,
    kind: "trace-link",
    id,
    productId,
    revision: 1,
    source,
    relationship: "affects",
    target: { recordType: "change", recordId: change.id, revision: change.revision, digest: canonicalDigest(change) },
    state,
    provenance: { kind: "human", actorId: "founder", rationale: "This governed record affects the Change." },
    createdAt: "2026-07-24T00:50:00.000Z",
    updatedAt: "2026-07-24T00:50:00.000Z",
  }
}

const decisionLink = link(decisionLinkId, {
  recordType: "decision",
  recordId: decision.id,
  revision: decision.revision,
  digest: canonicalDigest(decision),
})
const riskLink = link(riskLinkId, {
  recordType: "risk",
  recordId: risk.id,
  revision: risk.revision,
  digest: canonicalDigest(risk),
})

function impactFor(changeValue: Change, links: TraceLink[] = [decisionLink, riskLink]): TraceImpact {
  return {
    subject: {
      recordType: "change",
      recordId: changeValue.id,
      revision: changeValue.revision,
      digest: canonicalDigest(changeValue),
    },
    upstream: links,
    downstream: [],
    validatingEvidence: [],
    decisionsAndRisks: links,
    unresolved: links.filter((entry) => entry.state === "unresolved"),
    invalid: links.filter((entry) => entry.state === "invalid"),
    stale: links.filter((entry) => entry.state === "stale"),
    invalidatedByProposedRevision: [],
    coverageBoundary: "absence-of-a-trace-link-does-not-prove-absence-of-impact",
    truncated: false,
    evaluatedAt,
  }
}

function requestFor(changeValue: Change = change): ChangeImpactDashboardRequest {
  return {
    expectedProductId: product.id,
    expectedProductRevision: product.revision ?? 1,
    expectedProductDigest: canonicalDigest(product),
    expectedChangeId: changeValue.id,
    expectedChangeRevision: changeValue.revision,
    expectedChangeDigest: canonicalDigest(changeValue),
  }
}

function sources(changeValue: Change = change, traceImpact: TraceImpact = impactFor(changeValue)) {
  return { product, change: changeValue, workItems: [workItem], traceImpact, decisions: [decision], risks: [risk] }
}

describe("Change/Impact dashboard composition", () => {
  it("builds a deterministic metadata-only current Change catalog for strict host selectors", () => {
    const catalog = composeChangeImpactChangeCatalog(product, [change], {
      expectedProductId: product.id,
      expectedProductRevision: product.revision ?? 1,
      expectedProductDigest: canonicalDigest(product),
    }, observedAt)
    expect(catalog).toMatchObject({
      kind: "change-impact-change-catalog",
      product: { recordId: product.id, revision: product.revision },
      items: [{ recordId: change.id, revision: change.revision, state: change.state }],
      total: 1,
      omitted: 0,
      authorityBoundary: "change-catalog-selection-does-not-approve-change-or-authorize-effects",
    })
    const { snapshotDigest, ...content } = catalog
    expect(changeImpactChangeCatalogContentSchema.parse(content)).toEqual(content)
    expect(snapshotDigest).toBe(canonicalDigest(content))
    expect(JSON.stringify(catalog)).not.toContain(change.title)
    expect(JSON.stringify(catalog)).not.toContain(product.name)
  })

  it("rejects stale Product catalog requests and cross-Product Change rows", () => {
    const request = {
      expectedProductId: product.id,
      expectedProductRevision: product.revision ?? 1,
      expectedProductDigest: canonicalDigest(product),
    }
    expect(() => composeChangeImpactChangeCatalog(product, [change], {
      ...request,
      expectedProductDigest: `sha256:${"0".repeat(64)}`,
    }, observedAt)).toThrow(ChangeImpactProductBindingError)
    expect(() => composeChangeImpactChangeCatalog(product, [{
      ...change,
      productId: "00000000-0000-4000-8000-00000000000b",
    }], request, observedAt)).toThrow(ChangeImpactProductBindingError)
  })

  it("projects exact bounded artifacts, affected units, governance, and freshness without approval authority", () => {
    const dashboard = composeChangeImpactDashboard(sources(), requestFor(), observedAt)

    expect(dashboard.workItems).toEqual([expect.objectContaining({
      record: expect.objectContaining({ recordId: workItem.id }),
      state: "proposed",
    })])
    expect(dashboard.changedArtifacts[0]?.locator).toEqual({
      kind: "workspace-relative",
      path: "packages/engine/src/change-impact-dashboard.ts",
    })
    expect(dashboard.effectTargets[0]?.locator).toEqual({ kind: "logical", value: "package.build" })
    expect(dashboard.affectedUnits.map((entry) => entry.endpoint.recordType).sort()).toEqual(["decision", "risk"])
    expect(dashboard.governance).toMatchObject({
      approval: { state: "not-established", basis: "current-contract-has-no-change-approval-record" },
      decisions: [{ state: "decided", outcome: "human-selected" }],
      risks: [{ state: "open", likelihood: "possible", impact: "major", acceptance: "not-accepted" }],
      authorityBoundary: "decisions-and-risk-acceptance-do-not-approve-the-change",
    })
    expect(dashboard.freshness).toMatchObject({ state: "current", staleGovernanceReferences: 0 })
    expect(dashboard.evidenceCues).toEqual({
      freshness: "current",
      confidence: { state: "not-assessed", basis: "no-governed-confidence-evaluation-is-bound" },
    })
    expect(dashboard.limits.truncated).toBe(false)
    const { snapshotDigest, ...content } = dashboard
    expect(snapshotDigest).toBe(canonicalDigest(content))
    expect(JSON.stringify(dashboard)).not.toContain(decision.question)
    expect(JSON.stringify(dashboard)).not.toContain(risk.title)
  })

  it("rejects stale Change bindings and caller-supplied authority", () => {
    expect(() => composeChangeImpactDashboard(sources(), {
      ...requestFor(),
      expectedChangeDigest: `sha256:${"0".repeat(64)}`,
    }, observedAt)).toThrow(ChangeImpactChangeBindingError)
    expect(() => composeChangeImpactDashboard(sources(), {
      ...requestFor(),
      approval: "approved",
      authorizeEffects: true,
    } as ChangeImpactDashboardRequest, observedAt)).toThrow()
  })

  it("rejects forged freshness, duplicate rows, and unreconciled limits", () => {
    const dashboard = composeChangeImpactDashboard(sources(), requestFor(), observedAt)
    const { snapshotDigest: _snapshotDigest, ...content } = dashboard
    expect(() => changeImpactDashboardContentSchema.parse({
      ...content,
      changedArtifacts: [...content.changedArtifacts, content.changedArtifacts[0]],
    })).toThrow()
    expect(() => changeImpactDashboardContentSchema.parse({
      ...content,
      freshness: { ...content.freshness, state: "attention-required" },
    })).toThrow()
    expect(() => changeImpactDashboardContentSchema.parse({
      ...content,
      evidenceCues: { ...content.evidenceCues, freshness: "stale" },
    })).toThrow()
    expect(() => changeImpactDashboardContentSchema.parse({
      ...content,
      limits: {
        ...content.limits,
        workItems: { ...content.limits.workItems, total: content.limits.workItems.total + 1 },
      },
    })).toThrow()
  })

  it("marks stale trace and governance bindings as attention-required after the Change advances", () => {
    const revisedChange: Change = {
      ...change,
      revision: 2,
      state: "planned",
      updatedAt: "2026-07-24T00:55:00.000Z",
    }
    const staleLinks = [decisionLink, riskLink].map((entry) => ({ ...entry, state: "stale" as const }))
    const traceImpact = impactFor(revisedChange, staleLinks)
    const dashboard = composeChangeImpactDashboard(
      sources(revisedChange, traceImpact),
      requestFor(revisedChange),
      observedAt,
    )

    expect(dashboard.freshness).toMatchObject({
      state: "attention-required",
      staleTraceLinks: 2,
      staleGovernanceReferences: 1,
    })
    expect(dashboard.evidenceCues.freshness).toBe("stale")
    expect(dashboard.governance.approval.state).toBe("not-established")
  })
})
