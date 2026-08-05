import { describe, expect, it } from "vitest"

import { phase1CanonicalPresentation } from "./phase1-canonical-presentation.js"

describe("Phase 1 canonical presentation", () => {
  it("renders a Process Model as a readable Event Storming table and Mermaid flow", () => {
    const markdown = phase1CanonicalPresentation({
      kind: "process-model",
      label: "Event Storming and Process Model",
      draft: {
        title: "Schedule planning lifecycle",
        scope: "Candidate process model for planning one governed voyage schedule.",
        processes: [{
          key: "plan-schedule",
          name: "Plan schedule",
          ownerRoleKey: "schedule-planner",
          participantRoleKeys: ["schedule-reviewer"],
          boundedContextKeys: ["schedule-planning"],
          transitions: [{
            key: "submit-draft",
            trigger: "Submit the schedule draft for review.",
            actorRoleKeys: ["schedule-planner"],
            guardCriteria: ["The draft has a source-backed voyage scope."],
          }],
          steps: [{
            key: "draft-schedule",
            sequence: 1,
            objective: "Create the first schedule draft.",
            transitionKeys: ["submit-draft"],
          }],
          events: [{
            key: "schedule-draft-submitted",
            subject: "Schedule draft submitted",
            transitionKeys: ["submit-draft"],
          }],
          inconsistencies: [],
          unresolvedQuestions: ["Who confirms the final planning window?"],
        }],
      },
    })

    expect(markdown).toContain("## Event Storming board")
    expect(markdown).toContain("| Process | Commands / triggers | Actors | Domain events | Bounded contexts | Policies / hotspots |")
    expect(markdown).toContain("Schedule draft submitted")
    expect(markdown).toContain("```mermaid")
    expect(markdown).toContain("Event: Schedule draft submitted")
    expect(markdown.indexOf("## Event Storming board")).toBeLessThan(markdown.indexOf("Advanced: inspect the exact governed record"))
  })

  it("renders solution architecture as a component table and relationship diagram", () => {
    const markdown = phase1CanonicalPresentation({
      kind: "system-solution-architecture",
      label: "System and Solution Architecture",
      draft: {
        title: "Candidate schedule architecture",
        purpose: "Separate schedule authoring from governed review and evidence recording.",
        elements: [
          { key: "authoring", name: "Schedule Authoring", kind: "application", ownerRoleKey: "product-team", responsibility: "Creates candidate schedules.", technology: { disposition: "unresolved" } },
          { key: "evidence", name: "Evidence Ledger", kind: "data-store", ownerRoleKey: "governance-team", responsibility: "Records immutable evidence.", technology: { disposition: "candidate", value: "PostgreSQL" } },
        ],
        relations: [{ fromElementKey: "authoring", toElementKey: "evidence", kind: "writes" }],
      },
    })

    expect(markdown).toContain("## Architecture elements")
    expect(markdown).toContain("Schedule Authoring")
    expect(markdown).toContain("PostgreSQL")
    expect(markdown).toContain("A0 -->|\"writes\"| A1")
  })

  it("uses a bounded generic table while preserving exact JSON behind an advanced disclosure", () => {
    const markdown = phase1CanonicalPresentation({
      kind: "risk-register",
      label: "Risk Register",
      draft: {
        title: "Planning risks",
        purpose: "Make the candidate planning risks reviewable.",
        risks: [{ key: "stale-port-window" }, { key: "missing-capacity" }],
        reviewState: "awaiting-human-review",
      },
    })

    expect(markdown).toContain("| Field | Shape | Candidate value |")
    expect(markdown).toContain("Risks")
    expect(markdown).toContain("2 items")
    expect(markdown).toContain("<summary>Advanced: inspect the exact governed record</summary>")
    expect(markdown).toContain('"stale-port-window"')
  })

  it("renders the Pre-Figma readiness assessment as an output table and dependency view", () => {
    const markdown = phase1CanonicalPresentation({
      kind: "p0-p4-readiness-gate",
      label: "Pre-Figma Readiness Assessment",
      draft: {
        title: "Pre-Figma readiness",
        scope: "Evaluate the reviewed Product Journey before design handoff.",
        outputs: [{
          outputKind: "business-understanding",
          applicability: "applicable",
          evaluationState: "satisfied",
          freshness: "current",
          subjects: [{ recordId: "record-1" }],
          evidenceItemKeys: ["evidence-1"],
          blockers: [],
          conditions: [],
        }],
        unresolvedDecisions: [],
        conditions: [],
        waivers: [],
      },
    })

    expect(markdown).toContain("## Readiness output assessment")
    expect(markdown).toContain("| Output | Applicability | Assessment | Freshness | Evidence | Blockers / conditions |")
    expect(markdown).toContain("business-understanding")
    expect(markdown).toContain("Pre-Figma readiness assessment")
    expect(markdown).toContain("human review required")
  })

  it("renders the handoff inventory and leaves the Figma MCP roundtrip outside the package", () => {
    const markdown = phase1CanonicalPresentation({
      kind: "p5-handoff-package",
      label: "Pre-Figma Handoff Package",
      draft: {
        title: "Product Design handoff candidate",
        objective: "Transfer reviewed context without granting design or implementation authority.",
        readinessResult: "passed",
        transferState: "ready-for-human-review",
        target: { deliveryMode: "governed-figma" },
        items: [{
          outputKind: "business-understanding",
          disposition: "included",
          representation: "exact-reference",
          freshness: "current",
          consumerPurpose: "Ground Product Design in reviewed business evidence.",
          materialOmissions: [],
          uncertainties: [],
        }],
        unresolvedQuestions: [],
        conflicts: [],
        nextActions: ["Review the candidate package."],
      },
    })

    expect(markdown).toContain("## Handoff inventory")
    expect(markdown).toContain("| Output | Disposition | Representation | Freshness | Consumer purpose | Omissions / uncertainty |")
    expect(markdown).toContain("Figma MCP roundtrip")
    expect(markdown).toContain("excluded from this package")
    expect(markdown).toContain("ready-for-human-review")
  })
})
