import { describe, expect, it } from "vitest"

import { phase1CanonicalRecordKinds } from "./phase1-canonical-authoring.js"
import {
  phase1CanonicalExactDraftPresentation,
  phase1CanonicalPresentation,
} from "./phase1-canonical-presentation.js"

describe("Phase 1 canonical presentation", () => {
  it("omits raw JSON and unsupported HTML disclosures for all 23 canonical record reviews", () => {
    for (const kind of phase1CanonicalRecordKinds) {
      const markdown = phase1CanonicalPresentation({
        kind,
        label: kind,
        draft: { title: `Readable ${kind} candidate`, purpose: "Review this candidate in plain language." },
      })

      expect(markdown, kind).not.toContain("```json")
      expect(markdown, kind).not.toContain("<details>")
      expect(markdown, kind).not.toContain("Advanced: inspect the exact governed record")
      expect(markdown, kind).toContain("exact contract-valid candidate remains sealed")
    }
  })

  it("exposes exact candidate JSON only through the explicit advanced audit presentation", () => {
    const markdown = phase1CanonicalExactDraftPresentation({
      kind: "business-understanding",
      label: "Business Understanding",
      draft: { title: "Exact candidate", internalKey: "candidate-value" },
    })

    expect(markdown).toContain("Advanced audit view requested explicitly")
    expect(markdown).toContain("```json")
    expect(markdown).toContain('\"internalKey\": \"candidate-value\"')
    expect(markdown).toContain("viewing it does not accept or record anything")
  })

  it("renders Business Understanding as a human review instead of empty structured values", () => {
    const source = {
      sourceId: "61335158-f9ce-4911-a3b1-7c04c62ea35b",
      sourceRevision: 1,
      recordDigest: `sha256:${"a".repeat(64)}`,
      contentDigest: `sha256:${"b".repeat(64)}`,
    }
    const statement = (value: string, state = "confirmed") => ({ text: value, disposition: state, sources: [source] })
    const markdown = phase1CanonicalPresentation({
      kind: "business-understanding",
      label: "Business Understanding",
      draft: {
        informationClassification: "restricted",
        problem: statement("Schedule planning is fragmented across spreadsheets and disconnected tools."),
        opportunity: statement("One governed application can provide an authoritative operational schedule."),
        currentState: statement("Operations lacks reliable plan-versus-actual visibility."),
        targetState: statement("Authorized teams manage service definitions through voyage execution in one controlled source of truth."),
        scope: {
          included: ["Service-to-voyage planning"],
          excluded: ["Finance calculations"],
          boundaries: ["Standalone on-premises application"],
        },
        objectives: [{ id: "rapid_delay_identification", ...statement("Identify delayed voyages and their next affected port within 30 seconds.") }],
        constraints: [{ id: "on_premises_only", ...statement("Production deployment remains on premises.") }],
        assumptions: [{
          id: "role_scope_stable",
          statement: statement("The four documented roles cover the primary MVP actors.", "assumed"),
          status: "unverified",
          reviewTrigger: "Revisit when persona and access review changes role definitions.",
        }],
        unresolvedQuestions: [{
          id: "cvn_definition",
          question: "What is the precise business definition and validation rule for CVN?",
          blocking: false,
          ownerRoleKey: "business-architect",
          sources: [source],
          reviewTrigger: "Reassess when a governed CVN definition is recorded.",
        }],
        glossary: [{ term: "CVN", definition: statement("A manually supplied voyage identifier whose full rules remain unresolved.", "unknown") }],
        limitations: ["No direct end-user interview transcripts are present."],
      },
    })

    expect(markdown).toContain("## Review summary")
    expect(markdown).toContain("Candidate only — awaiting human review")
    expect(markdown).toContain("Schedule planning is fragmented across spreadsheets")
    expect(markdown).toContain("### Included")
    expect(markdown).toContain("Service-to-voyage planning")
    expect(markdown).toContain("## Objectives (1)")
    expect(markdown).toContain("Identify delayed voyages")
    expect(markdown).toContain("## Items requiring human attention")
    expect(markdown).toContain("Role scope stable")
    expect(markdown).toContain("**Non-blocking:** What is the precise business definition")
    expect(markdown).toContain("| CVN | A manually supplied voyage identifier")
    expect(markdown).toContain("No direct end-user interview transcripts")
    expect(markdown).not.toContain("Not specified")
    expect(markdown).not.toContain(source.sourceId)
    expect(markdown).not.toContain("```json")
    expect(markdown).not.toContain("Advanced: inspect the exact governed record")
    expect(markdown).toContain("exact contract-valid candidate remains sealed")
  })

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
    expect(markdown).not.toContain("```json")
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

  it("uses a bounded generic table without exposing internal JSON in the primary review", () => {
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
    expect(markdown).toContain("stale-port-window")
    expect(markdown).toContain("missing-capacity")
    expect(markdown).not.toContain("Not specified")
    expect(markdown).not.toContain("<details>")
    expect(markdown).not.toContain("```json")
    expect(markdown).toContain("exact contract-valid candidate remains sealed")
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

  it("renders a Business Capability Map as a table and a dependency diagram", () => {
    const markdown = phase1CanonicalPresentation({
      kind: "business-capability-map",
      label: "Business Capability Map",
      draft: {
        title: "Shipping capability map",
        capabilities: [
          { key: "scheduling", name: "Voyage scheduling", ownerRoleKey: "ops-lead", dependencyKeys: ["routing"] },
          { key: "routing", name: "Route optimization", ownerRoleKey: "planning-lead", dependencyKeys: [] },
        ],
      },
    })
    expect(markdown).toContain("## Business capabilities")
    expect(markdown).toContain("Voyage scheduling")
    expect(markdown).toContain("## Capability dependency map")
    expect(markdown).toContain("```mermaid")
    expect(markdown).toContain("flowchart TD")
    expect(markdown).toContain("CAP0 --> CAP1")
    expect(markdown).not.toContain("```json")
  })

  it("renders a Value Stream Model as ordered stage tables and left-to-right flows", () => {
    const markdown = phase1CanonicalPresentation({
      kind: "value-stream-model",
      label: "Value Stream Model",
      draft: {
        title: "Booking to sailing",
        valueStreams: [{
          key: "booking-to-sailing",
          name: "Booking to sailing",
          stages: [
            { key: "confirm", sequence: 2, name: "Confirm booking", entryCriteria: ["Request received"], exitCriteria: ["Booking confirmed"], capabilityKeys: ["scheduling"] },
            { key: "intake", sequence: 1, name: "Intake request", entryCriteria: ["Customer intent"], exitCriteria: ["Request captured"], capabilityKeys: ["scheduling"] },
          ],
        }],
      },
    })
    expect(markdown).toContain("## Value streams")
    expect(markdown).toContain("### Booking to sailing")
    expect(markdown).toContain("```mermaid")
    expect(markdown).toContain("flowchart LR")
    // Stages are ordered by sequence: Intake (1) before Confirm (2).
    expect(markdown.indexOf("Intake request")).toBeLessThan(markdown.indexOf("Confirm booking"))
    expect(markdown).toContain("VS0S0 --> VS0S1")
  })

  it("renders an Operating Model with a decision-rights table and a role/value-stream diagram", () => {
    const markdown = phase1CanonicalPresentation({
      kind: "operating-model",
      label: "Operating Model",
      draft: {
        title: "Shipping operating model",
        roles: [{ key: "ops-lead", name: "Ops lead", governanceSystem: "delivery", capabilityKeys: ["scheduling"], valueStreamKeys: ["booking-to-sailing"] }],
        decisionRights: [{ key: "schedule-approval", subject: "Approve the final voyage schedule", accountableRoleKey: "ops-lead", consultedRoleKeys: ["planning-lead"], valueStreamKeys: ["booking-to-sailing"] }],
      },
    })
    expect(markdown).toContain("## Operating roles")
    expect(markdown).toContain("## Decision rights (accountable / consulted)")
    expect(markdown).toContain("Approve the final voyage schedule")
    expect(markdown).toContain("## Role and value-stream accountability map")
    expect(markdown).toContain("```mermaid")
    expect(markdown).toContain("R0 --> S0")
    expect(markdown).not.toContain("```json")
  })

  it("renders a Business Rule Catalog with a rule table and rule-to-capability traceability", () => {
    const markdown = phase1CanonicalPresentation({
      kind: "business-rule-catalog",
      label: "Business Rule Catalog",
      draft: {
        title: "Shipping rules",
        rules: [{ key: "cutoff", name: "Booking cutoff", kind: "policy", statement: "Bookings close 48h before sailing.", ownerRoleKey: "ops-lead", capabilityKeys: ["scheduling"], valueStreamKeys: ["booking-to-sailing"] }],
        enforcementTargets: [{ key: "booking-service" }],
        exceptions: [],
      },
    })
    expect(markdown).toContain("## Business rules")
    expect(markdown).toContain("Booking cutoff")
    expect(markdown).toContain("Enforcement targets: **1**")
    expect(markdown).toContain("## Rule to capability traceability")
    expect(markdown).toContain("```mermaid")
    expect(markdown).toContain("RULE0 --> RCAP0")
    expect(markdown).not.toContain("```json")
  })

  it("renders a Business Architecture Baseline with coverage, composition, and consistency checks", () => {
    const markdown = phase1CanonicalPresentation({
      kind: "business-architecture-baseline",
      label: "Business Architecture Baseline",
      draft: {
        title: "Shipping baseline",
        scope: { included: ["Scheduling capability"], excluded: ["Billing"] },
        coverage: [
          { elementKind: "capability", elementKey: "scheduling", disposition: "covered" },
          { elementKind: "value-stream", elementKey: "booking-to-sailing", disposition: "covered" },
        ],
        integrationClaims: [{ key: "c1", statement: "Scheduling enables the booking-to-sailing stream." }],
        consistencyChecks: [{ topic: "capability-value-stream", state: "consistent", accountableRoleKey: "ops-lead" }],
      },
    })
    expect(markdown).toContain("## Baseline scope")
    expect(markdown).toContain("Scheduling capability")
    expect(markdown).toContain("## Coverage summary")
    expect(markdown).toContain("## Composition")
    expect(markdown).toContain("```mermaid")
    expect(markdown).toContain("## Consistency checks")
    expect(markdown).toContain("capability-value-stream")
    expect(markdown).toContain("## Integration claims (1)")
    expect(markdown).toContain("Scheduling enables the booking-to-sailing stream.")
    expect(markdown).not.toContain("```json")
  })
})
