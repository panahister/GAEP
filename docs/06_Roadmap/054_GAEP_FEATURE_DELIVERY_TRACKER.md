# GAEP Feature Delivery Tracker

**Governed AI Engineering Platform (GAEP)**  
**Document ID:** GAEP-RDM-054  
**Version:** 1.0.3  
**Status:** Active Delivery Control  
**Last Updated:** 2026-07-24  
**Authority:** Feature delivery status and phase acceptance  
**Product Authority:** [GAEP Platform and Product Identity Manifest](../GAEP_PLATFORM_PRODUCT_IDENTITY_MANIFEST.md)  
**Maintainers:** Product Owner, Codex, and Claude Code

## 1. Purpose

This file is the official GAEP reference for the feature list, delivery phases, implementation status, and acceptance state. Codex and Claude Code must read this file and the Product Identity Manifest before starting implementation work, and they must work only on Feature IDs in the active phase.

The status of each feature must be updated after every assessable implementation run. Claude Code must not set a feature to `✅ Done` merely because coding is complete. Final completion may be recorded only when test evidence exists, the realistic example has been executed, and the Product Owner has provided explicit acceptance.

This document does not replace the Product Manifest or architecture documents. If a conflict exists, the Manifest governs product identity and scope, while this file governs delivery status.

## 2. Canonical Status Model

| Status | Meaning | Who may set it | Required evidence |
|---|---|---|---|
| `❌ Backlog` | No reliable implementation exists yet | Codex / Claude Code / Product Owner | Gap description and next action |
| `🟡 In Progress` | Part of the feature exists or implementation has started | Codex / Claude Code | Code or artifact changes and tests still in progress |
| `🧪 Ready for Test` | Implementation and automated tests are complete and awaiting human testing or acceptance | Codex / Claude Code | Build path, test results, installable package, and realistic example |
| `🔎 In Review` | Human testing or review is in progress | Product Owner, or an agent acting on explicit Product Owner instruction | Test report and unresolved items |
| `⛔ Blocked` | A specific impediment prevents further progress | Codex / Claude Code / Product Owner | Blocker description, decision owner, and required action |
| `⏸ Deferred` | Moved to another phase by a recorded decision | Product Owner only | Decision ID, destination, and rationale |
| `✅ Done` | Implementation, automated testing, realistic testing, and human acceptance are complete | Claude Code or Codex only after explicit Product Owner acceptance; or the Product Owner | Evidence link, test result, date, and acceptance note |

### 2.1 Allowed status transitions

```text
❌ Backlog -> 🟡 In Progress -> 🧪 Ready for Test -> 🔎 In Review -> ✅ Done
                         |              |               |
                         +-----------> ⛔ Blocked <-----+

Any active status -> ⏸ Deferred requires an explicit Product Owner decision.
Any regression from ✅ Done requires a documented defect, change request, or invalidated evidence.
```

### 2.2 Update ownership rule

- After every implementation run, Claude Code must update the status, evidence, gap, and next action for every Feature ID it touched.
- After coding is complete, Claude Code may advance a feature only as far as `🧪 Ready for Test`.
- After the Product Owner accepts the test result, Claude Code may change the accepted Feature IDs to `✅ Done` in its next run and must record the acceptance statement in the Change Log.
- Bulk-changing the status of an entire phase without evaluating every Feature ID is prohibited.
- The Status Summary must be updated in the same change as the feature tables. An incorrect count is a documentation defect.

## 3. Roadmap Phase Model

> **Naming clarification:** Roadmap Phase 0/1A is the delivery-foundation phase. Product Lifecycle steps P0 through P4 are executed during Roadmap Phase 1 and represent a separate concept.

| Roadmap phase | Internal milestone | Primary outcome | Initial status | Exit condition |
|---|---|---|---|---|
| Phase 0 | Phase 1A — Four-IDE Platform Foundation | Shared engine, four installable plugins, Codex/Claude Code, and model switching | `🟡 In Progress` | All Foundation Gates are accepted for all four IDEs |
| Phase 1 | Phase 1B — P0–P4 Core | Product flow from source intake through architecture and readiness | `🟡 In Progress` | P0–P4 run successfully with both providers and a realistic example |
| Phase 1 | Phase 1C — Four-IDE Phase 1 Release | Installable and tested Phase 1 package for all four IDEs | `❌ Backlog` | The Phase 1 Release Gate and human acceptance are complete |
| Phase 2 | UX and Figma Loop | Governed GAEP–Figma round trip and Design Baseline | `❌ Backlog` | The Figma loop, dashboards, and design acceptance are complete |
| Phase 3A | Backlog and Implementation Readiness | Backlog, boilerplate binding, HLD/LLD, and readiness | `❌ Backlog` | Implementation Authorization is issued for the realistic example |
| Phase 3B | Controlled Implementation and QA | Governed code generation or modification, QA, and conformance | `❌ Backlog` | Executable code, multidimensional QA, and human acceptance are complete |
| Phase 4 | Release, Publish, and Learning | Release, observation, learning, and rebaselining | `❌ Backlog` | Release evidence, rollback, and the learning loop are accepted |

## 4. Mandatory Deliverable Contract for Every Phase

No phase is complete merely because the Core Engine or VS Code implementation is complete. Every phase deliverable must include:

1. a versioned, installable package for **VS Code, Visual Studio, Rider, and Kiro**;
2. the ability to select and run **Codex** and **Claude Code** in all four IDEs;
3. the ability to discover, select, and switch the supported models of each provider;
4. versioned and traceable provider/model handoff without evidence loss;
5. a phase-appropriate dashboard with Change/Impact and Agent/Model views;
6. a realistic runnable example at a documented repository path;
7. build results, automated tests, install smoke tests, workflow smoke tests, and a conformance report;
8. upgrade and rollback tests appropriate to that phase's package;
9. installation and execution documentation, limitations, and known gaps; and
10. explicit Product Owner acceptance before the phase is set to `✅ Done`.

## 5. Status Summary

This table must be recounted and updated after every status change.

| Registry | Total | ✅ Done | 🟡 In Progress | 🧪 Ready for Test | 🔎 In Review | ⛔ Blocked | ⏸ Deferred | ❌ Backlog |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Cross-platform capabilities | 35 | 3 | 22 | 0 | 0 | 0 | 0 | 10 |
| Phase 1 — Product P0–P4 | 36 | 1 | 21 | 0 | 0 | 0 | 0 | 14 |
| Phase 2 — UX and Figma | 26 | 0 | 8 | 0 | 0 | 0 | 0 | 18 |
| Phase 3A — Backlog and Readiness | 24 | 0 | 8 | 0 | 0 | 0 | 0 | 16 |
| Phase 3B — Implementation and QA | 30 | 0 | 15 | 0 | 0 | 0 | 0 | 15 |
| Phase 4 — Release and Learning | 17 | 0 | 8 | 0 | 0 | 0 | 0 | 9 |
| **All tracked features** | **168** | **4** | **82** | **0** | **0** | **0** | **0** | **82** |

## 6. Cross-Platform Capability Registry

These capabilities are cross-cutting. The target milestone is the first phase in which the capability must reach an acceptable level; its conformance must then be revalidated in every subsequent phase.

| ID | Feature | Target milestone | Required outcome | Current status | Current evidence or gap |
|---|---|---|---|---|---|
| PLT-01 | Shared GAEP Engine | Phase 0 / 1A | One shared engine with no behavioral forks between hosts | `🟡 In Progress` | Core and shared packages exist; the four-host conformance boundary is incomplete |
| PLT-02 | Portable `.gaep` Workspace | Phase 0 / 1A | Portable, version-controlled state and artifacts | `✅ Done` | A portable workspace exists in the current codebase; regression testing is required in every phase |
| PLT-03 | VS Code Installable VSIX | Phase 0 / 1A | Real VSIX build, installation, upgrade, and smoke testing | `🟡 In Progress` | The package and a substantial host implementation exist; acceptance is incomplete |
| PLT-04 | Visual Studio Native VSIX | Phase 0 / 1A | Native Visual Studio extension installable on Windows | `❌ Backlog` | Only a shared scaffold/client exists; the native VSIX and Windows tests are missing |
| PLT-05 | Four-IDE Behavioral Parity | Phase 0 / 1A | Equivalent behavior in VS Code, Visual Studio, Rider, and Kiro | `❌ Backlog` | A complete conformance contract and matrix do not exist |
| PLT-06 | Codex Detection | Phase 0 / 1A | Discover executable, version, authentication readiness, and capabilities | `✅ Done` | Basic detection exists; four-host regression coverage is still required |
| PLT-07 | Claude Code Detection | Phase 0 / 1A | Discover Claude Code, version, authentication readiness, and capabilities | `🟡 In Progress` | Partial detection exists; host paths and readiness checks are incomplete |
| PLT-08 | Codex Model Discovery and Selection | Phase 0 / 1A | Display and select the Codex models available to the user | `🟡 In Progress` | Discovery and selection are partial and lack four-IDE conformance |
| PLT-09 | Claude Model Discovery and Selection | Phase 0 / 1A | Display and select the Claude Code models available to the user | `🟡 In Progress` | Sonnet and Opus aliases are visible; execution-backed verification is incomplete |
| PLT-10 | Safe Codex Analysis Execution | Phase 0 / 1A | Read-only analysis with a run envelope and evidence | `🟡 In Progress` | The managed Codex path is advanced, but four-host acceptance is incomplete |
| PLT-11 | Safe Claude Analysis Execution | Phase 0 / 1A | Read-only Claude analysis with a run envelope and evidence | `🟡 In Progress` | The context-only executable path now shares durable sequential and bounded parallel-readonly multi-step checkpoint/restart controls with the deterministic adapter, but live Claude invocation, packaged-host and four-IDE acceptance evidence remain incomplete |
| PLT-12 | Staged Codex Effectful Execution | Phase 0 / 1A | Preview, approval, apply, and recovery for Codex changes | `🟡 In Progress` | Partial staging exists; end-to-end acceptance is incomplete |
| PLT-13 | Staged Claude Effectful Execution | Phase 0 / 1A | Preview, approval, apply, and recovery for Claude changes | `❌ Backlog` | Real managed effectful execution does not exist |
| PLT-14 | Provider Switching | Phase 0 / 1A | Switch Codex and Claude Code within one Initiative without losing state | `🟡 In Progress` | The UI and abstraction are partial; a real bidirectional workflow is incomplete |
| PLT-15 | Model Switching | Phase 0 / 1A | Change models within each provider while recording provenance | `🟡 In Progress` | Selection is partial; provenance and four-host support are incomplete |
| PLT-16 | Versioned Provider/Model Handoff | Phase 0 / 1A | Transfer context, Run Envelope, and evidence between agents and models | `🟡 In Progress` | A handoff foundation exists; the contract and acceptance are incomplete |
| PLT-17 | Manual/Fake Provider Adapter | Phase 0 / 1A | Deterministic adapter for offline tests and fixtures | `✅ Done` | A test adapter exists and must remain part of the conformance suite |
| PLT-18 | Context and Run Envelope | Phase 0 / 1A | Record scope, authority, inputs, model, limits, and effects | `🟡 In Progress` | Exact multi-step Workflow checkpoints bind completed dependency batches, gates, events and observation-only effects; parallel concurrency is capped at four and all tool/write/effect authority fails closed, while complete host/provider coverage remains incomplete |
| PLT-19 | Normalized Evidence and Run Records | Phase 0 / 1A | Provider- and host-independent evidence | `🟡 In Progress` | Immutable portable checkpoint evidence survives sequential and parallel restart/export/import validation with exact lineage, deterministic final ordering, partial-completion truth and tamper rejection; every provider and host is not yet conformant |
| PLT-20 | Install, Upgrade, and Rollback | Phase 0 / 1A | Testable lifecycle for all four plugins | `🟡 In Progress` | VS Code is partial; Visual Studio, Rider, and Kiro are incomplete |
| PLT-21 | Dashboard Shell | Phase 0 / 1A | Shared dashboard shell in all four hosts | `🟡 In Progress` | A basic dashboard exists; parity and four-host installation are incomplete |
| PLT-22 | Phase-Scoped Dashboard Framework | Phase 0 / 1A | Compose dashboards according to phase and applicability | `❌ Backlog` | A complete framework and contract do not exist |
| PLT-23 | Change and Impact Dashboard | Phase 0 / 1A | Changed artifacts, affected units, approvals, and risks | `🟡 In Progress` | A partial view exists; completeness and freshness are incomplete |
| PLT-24 | Agent and Model Dashboard | Phase 0 / 1A | Provider, model, run status, cost/usage, and handoff evidence | `🟡 In Progress` | The foundation is partial; execution truth and four-host coverage are incomplete |
| PLT-25 | Accessible Dashboard Tables | Phase 0 / 1A | Keyboard and screen-reader support, sorting, filtering, and export | `🟡 In Progress` | A table foundation exists; accessibility conformance is incomplete |
| PLT-26 | Freshness and Evidence Cues | Phase 0 / 1A | Show freshness, source, confidence, and stale state | `🟡 In Progress` | Cues are partial; policy and validation are incomplete |
| PLT-27 | Four-IDE Conformance Suite | Phase 0 / 1A | Shared contract tests for four IDEs and two providers | `❌ Backlog` | A comprehensive suite and matrix report do not exist |
| PLT-28 | Realistic Example Runner | Phase 0 / 1A | Repeatable realistic example with inspectable outputs | `❌ Backlog` | The runner and canonical example path do not exist |
| PLT-29 | Per-Phase Package and Acceptance Report | Phase 0 / 1A | Package, checksum, test report, and known gaps for every phase | `❌ Backlog` | A phase-oriented delivery pipeline does not exist |
| PLT-30 | Governed Figma MCP Adapter | Phase 2 | Governed Figma read, import, write, and synchronization | `❌ Backlog` | A complete adapter and contract do not exist |
| PLT-31 | Rider Native Plugin | Phase 0 / 1A | Native JetBrains/Rider plugin with sandbox and installation tests | `🟡 In Progress` | A Kotlin scaffold exists; workflow and packaging are incomplete |
| PLT-32 | Kiro Installable Package | Phase 0 / 1A | Independent Kiro installation and compatibility validation | `🟡 In Progress` | `7541940` provides an independent six-file VSIX; root typecheck, hostile stdio tests, packaging and exact isolated VSIX install/list pass. Native Kiro installation remains unverified because no Kiro binary is available |
| PLT-33 | Kiro Compatibility and Smoke Tests | Phase 0 / 1A | Installation, workflow, provider, model, and dashboard smoke tests in Kiro | `🟡 In Progress` | A Code OSS-compatible isolated extension-host smoke activates four bounded commands, machine-only configuration and static Product Studio without workspace mutation. Native Kiro, provider/model switching and complete dashboard parity remain |
| PLT-34 | Visual Studio Windows Installation Tests | Phase 0 / 1A | CI or manual evidence for VSIX installation on Windows | `❌ Backlog` | A Windows test environment and report do not exist |
| PLT-35 | Rider Sandbox and Installation Tests | Phase 0 / 1A | `runIde`, installable artifact, and workflow smoke testing | `❌ Backlog` | Sandbox and installation acceptance do not exist |

## 7. Phase 1 Feature Registry — Product P0 to P4

Phase 1 must execute the initial Product lifecycle through architecture and readiness, then package the result for all four IDEs. P0 through P4 in this section are Product Lifecycle steps, not Roadmap phases.

| ID | Feature | Product step | Required outcome | Current status | Current evidence or gap |
|---|---|---|---|---|---|
| P1-01 | Open Existing Product/Initiative | Entry | Open an existing Product and load valid state | `✅ Done` | The basic path exists |
| P1-02 | Initiative Classification | Entry | Determine the Initiative type and Product specialization | `🟡 In Progress` | A classification foundation exists; validation is incomplete |
| P1-03 | Applicability Resolution | Entry | Determine applicable steps and artifacts with rationale | `🟡 In Progress` | Applicability is partial; decision trace is incomplete |
| P1-04 | Source Intake | P0 | Record initial sources, owners, and authority levels | `🟡 In Progress` | Intake is partial; UX and completeness are incomplete |
| P1-05 | Source Baseline | P0 | Create a repeatable snapshot and version of inputs | `🟡 In Progress` | A baseline foundation exists; acceptance is incomplete |
| P1-06 | Source Provenance | P0 | Link every claim and artifact to its source and version | `🟡 In Progress` | Provenance is partial; dashboard and validation are incomplete |
| P1-07 | Business Understanding | P1 | Capture the problem, context, constraints, and business intent | `🟡 In Progress` | Documentation artifacts exist; the workflow is not final |
| P1-08 | Users, Stakeholders, and Roles | P1 | Define roles, jobs, and authority | `🟡 In Progress` | Partial documentation exists; UI and trace are incomplete |
| P1-09 | Outcomes and Success Measures | P1 | Define outcomes, KPI candidates, and acceptance signals | `🟡 In Progress` | Strategy documents exist; executable validation is incomplete |
| P1-10 | Business Capability Map | P2 | Traceable capabilities and ownership | `❌ Backlog` | No executable output exists |
| P1-11 | Value Stream Model | P2 | Value streams and their dependencies | `❌ Backlog` | No executable output exists |
| P1-12 | Operating Model | P2 | Actors, responsibilities, and operating boundaries | `❌ Backlog` | No executable output exists |
| P1-13 | Business Rules | P2 | Rules, sources, exceptions, and enforcement targets | `❌ Backlog` | No executable registry exists |
| P1-14 | Business Architecture Baseline | P2 | Integrated capability, value, and operating-model baseline | `❌ Backlog` | No gate or baseline workflow exists |
| P1-15 | System/Solution Architecture | P3 | Architecture views and quality attributes | `🟡 In Progress` | Architecture documentation is extensive; the workflow and product surface are incomplete |
| P1-16 | Bounded Context and Ownership Model | P3 | Boundary, owner, and contract for each context | `🟡 In Progress` | A conceptual model exists; the executable registry is incomplete |
| P1-17 | Security, Privacy, and Threat Assessment | P3 | Threats, controls, data classification, and residual risk | `🟡 In Progress` | Threat and security documents exist; the executable gate is incomplete |
| P1-18 | Process Model | P4 | Workflows, states, transitions, and human approvals | `❌ Backlog` | No executable end-to-end model exists |
| P1-19 | Data Model | P4 | Entities, ownership, lifecycle, and sensitivity | `🟡 In Progress` | Metadata and Core specifications are partial; the Product workflow is incomplete |
| P1-20 | Authorization Model | P4 | Actor, action, resource, decision, and approval authority | `🟡 In Progress` | Identity and authority documents exist; enforcement is incomplete |
| P1-21 | Event and Integration Model | P4 | Events, commands, adapters, and external contracts | `❌ Backlog` | No delivered model or validation exists |
| P1-22 | Failure and Recovery Model | P4 | Failure modes, compensation, retry, and recovery evidence | `❌ Backlog` | No executable workflow exists |
| P1-23 | Architecture Challenge / Red Team | P3–P4 | Independent challenge of assumptions, risks, and alternatives | `🟡 In Progress` | Assurance and challenge concepts exist; the runner and gate are incomplete |
| P1-24 | Decision Register | Cross-step | Decision, options, owner, rationale, and status | `🟡 In Progress` | Register documents exist; Product integration is incomplete |
| P1-25 | Risk Register | Cross-step | Risk, exposure, mitigation, owner, and evidence | `🟡 In Progress` | A register exists; dashboard and execution synchronization are incomplete |
| P1-26 | Evidence Registry | Cross-step | Claim-to-evidence trace and freshness | `🟡 In Progress` | An evidence model exists; the end-to-end surface is incomplete |
| P1-27 | End-to-End Traceability | Cross-step | Source-to-decision-to-architecture trace | `🟡 In Progress` | A trace foundation exists; completeness checks are incomplete |
| P1-28 | P0–P4 Readiness Gate | Gate | Validate required outputs, waivers, and open decisions | `❌ Backlog` | No executable gate exists |
| P1-29 | P5 Handoff Package | Handoff | Versioned package for the UX and Design phase | `❌ Backlog` | No handoff contract or example exists |
| P1-30 | Codex P0–P4 End-to-End Workflow | Acceptance | Complete Codex execution with evidence | `❌ Backlog` | No realistic integration test exists |
| P1-31 | Claude Code P0–P4 End-to-End Workflow | Acceptance | Complete Claude Code execution with evidence | `❌ Backlog` | No realistic invocation and workflow exist |
| P1-32 | Provider Output Comparison | Acceptance | Compare Codex and Claude using quality and divergence criteria | `❌ Backlog` | No evaluation harness exists |
| P1-33 | Phase 1 Summary and Readiness Dashboard | Dashboard | Progress, gaps, gates, owners, and freshness | `🟡 In Progress` | The shell is partial; phase composition is incomplete |
| P1-34 | Phase 1 Change and Impact Dashboard | Dashboard | P0–P4 changes and downstream impact | `🟡 In Progress` | The foundation is partial; coverage is incomplete |
| P1-35 | Phase 1 Agent and Model Dashboard | Dashboard | Run, provider, model, and handoff status | `🟡 In Progress` | The foundation is partial; execution truth is incomplete |
| P1-36 | Phase 1 Realistic Reference Example | Acceptance | A realistic Product from P0 through P4 with inspectable outputs | `❌ Backlog` | No canonical example or acceptance report exists |

## 8. Phase 2 Feature Registry — UX and Figma Loop

| ID | Feature | Area | Required outcome | Current status | Current evidence or gap |
|---|---|---|---|---|---|
| P2-01 | Design Applicability | Governance | Determine whether UX, UI, or Figma applies and the required design depth | `🟡 In Progress` | The applicability concept exists; design rules are incomplete |
| P2-02 | Design Personas and Roles | UX | Personas, actors, and Product Designer responsibilities | `🟡 In Progress` | Partial user and stakeholder artifacts exist |
| P2-03 | User Journeys | UX | Journeys, touchpoints, failure paths, and success paths | `❌ Backlog` | No complete executable output exists |
| P2-04 | Information Architecture | UX | Navigation, hierarchy, and content model | `❌ Backlog` | No artifact or validation exists |
| P2-05 | Screen and State Inventory | UX | Screen, state, variant, and platform inventory | `❌ Backlog` | No traceable registry exists |
| P2-06 | Design Requirements | UX | Requirements linked to outcomes and backlog candidates | `🟡 In Progress` | The requirements foundation is partial |
| P2-07 | Design System and Token Contract | Design System | Variables, tokens, components, and ownership | `❌ Backlog` | No contract or Figma binding exists |
| P2-08 | Accessibility Design Rules | Quality | Accessibility targets and design checks | `🟡 In Progress` | Principles exist; the executable design gate is incomplete |
| P2-09 | Responsive and Multi-Platform Targets | UX | Breakpoints, form factors, and platform behavior | `🟡 In Progress` | Requirement references are partial; the matrix is incomplete |
| P2-10 | Manual Figma Execution Path | Figma | Governed path before MCP automation | `❌ Backlog` | No executable example or guide exists |
| P2-11 | Figma MCP Capability Discovery | Figma MCP | Discover tools, permissions, limits, and versions | `❌ Backlog` | No adapter exists |
| P2-12 | Read Figma Files, Components, and Variables | Figma MCP | Read-only snapshot with provenance | `❌ Backlog` | No implementation exists |
| P2-13 | Import GAEP Context into Figma | Figma MCP | Send briefs, requirements, and constraints | `❌ Backlog` | No governed context export exists |
| P2-14 | Outbound Design Brief Package | Handoff | Versioned package from GAEP to Figma | `❌ Backlog` | No schema or example exists |
| P2-15 | Governed Write to Figma | Figma MCP | Preview, approval, and write with evidence | `❌ Backlog` | No implementation exists |
| P2-16 | Import Finalized Figma Snapshot | Figma MCP | Receive the latest approved version into GAEP | `❌ Backlog` | No inbound synchronization exists |
| P2-17 | Design-to-Requirement Binding | Trace | Link nodes and components to requirements and decisions | `❌ Backlog` | No binding registry exists |
| P2-18 | Designer-Ready Gate | Gate | Completeness and readiness before Product Designer work begins | `❌ Backlog` | No executable gate exists |
| P2-19 | Design Delta Detection | Change | Detect differences between the GAEP baseline and Figma | `❌ Backlog` | No delta engine exists |
| P2-20 | Design Conflict Resolution | Change | Merge, accept, reject, or escalate through human decisions | `❌ Backlog` | No conflict workflow exists |
| P2-21 | Human Design Approval | Governance | Record approval and the approved scope and version | `🟡 In Progress` | An approval foundation exists; Figma binding is incomplete |
| P2-22 | Design Baseline and Versioning | Governance | Immutable baseline and supersession | `🟡 In Progress` | The artifact and version model is partial; Figma end-to-end support is incomplete |
| P2-23 | Design Drift Detection | Assurance | Detect drift between requirements, Figma, and implementation targets | `🟡 In Progress` | Drift concepts exist; automation is incomplete |
| P2-24 | Phase 2 UX/Figma Dashboard | Dashboard | Journeys, screens, design state, gates, and freshness | `❌ Backlog` | No phase dashboard exists |
| P2-25 | Phase 2 Change, Impact, Agent and Model Views | Dashboard | Synchronization delta, impact, and agent/model runs | `❌ Backlog` | No integrated views exist |
| P2-26 | Phase 2 Realistic Figma Loop Example | Acceptance | GAEP→Figma→GAEP on a realistic example with approval | `❌ Backlog` | No example or acceptance report exists |

## 9. Phase 3A Feature Registry — Backlog and Implementation Readiness

| ID | Feature | Area | Required outcome | Current status | Current evidence or gap |
|---|---|---|---|---|---|
| P3A-01 | Backlog Hierarchy | Backlog | Epic, feature, story, and task hierarchy with traceability | `🟡 In Progress` | The hierarchy foundation is partial |
| P3A-02 | MVP and Slice Definition | Planning | Testable vertical slices and scope | `🟡 In Progress` | Scope concepts exist; the executable workflow is incomplete |
| P3A-03 | Prioritization Model | Planning | Value-, risk-, dependency-, and cost-based ordering | `🟡 In Progress` | Principles exist; the decision surface is incomplete |
| P3A-04 | Acceptance Criteria | Backlog | Testable criteria linked to requirements | `🟡 In Progress` | The artifact is partial; quality validation is incomplete |
| P3A-05 | Definition of Ready | Gate | Gate for admitting each item into implementation | `❌ Backlog` | No executable gate exists |
| P3A-06 | Definition of Done | Gate | Quality, evidence, and approval contract | `❌ Backlog` | No phase-specific implementation exists |
| P3A-07 | Implementation Unit Model | Architecture | Unit, owner, repository or module, and blast radius | `🟡 In Progress` | A model foundation exists; the registry is not final |
| P3A-08 | Dependency Mapping | Architecture | Dependency graph and critical path | `🟡 In Progress` | A trace foundation exists; the planning view is incomplete |
| P3A-09 | Technology Profile | Technology | Approved stack, versions, and constraints | `❌ Backlog` | No executable profile exists |
| P3A-10 | Boilerplate Registry | Boilerplate | Candidate boilerplates, versions, and evidence | `❌ Backlog` | No registry exists |
| P3A-11 | Boilerplate Selection and Binding | Boilerplate | Versioned selection decision and binding to the Product | `❌ Backlog` | No workflow exists |
| P3A-12 | Boilerplate Compatibility Validation | Assurance | Compatibility with the stack, architecture, security, and design | `❌ Backlog` | No validator exists |
| P3A-13 | Figma-to-Boilerplate Mapping | Design to Code | Map components, tokens, and layout to the target stack | `❌ Backlog` | No mapping contract exists |
| P3A-14 | Design-to-Code Binding Registry | Trace | Versioned Figma node ↔ code target bindings | `❌ Backlog` | No registry exists |
| P3A-15 | Route, Screen, and Component Mapping | Planning | Delivery map for frontend implementation | `❌ Backlog` | No executable artifact exists |
| P3A-16 | Test Methodology | QA Planning | Test levels, environments, data, and ownership | `❌ Backlog` | No executable methodology exists |
| P3A-17 | Test Inventory | QA Planning | Tests linked to acceptance criteria, risks, and units | `🟡 In Progress` | Test assets are partial; the integrated inventory is incomplete |
| P3A-18 | High-Level Design | Design | Approved and traceable HLD | `❌ Backlog` | No generated and approved HLD workflow exists |
| P3A-19 | Low-Level Design | Design | LLD for implementation units | `❌ Backlog` | No generated and approved LLD workflow exists |
| P3A-20 | Implementation Readiness Gate | Gate | Backlog, design, boilerplate, tests, and risks are ready | `🟡 In Progress` | Readiness concepts exist; the gate is incomplete |
| P3A-21 | Codex Readiness Workflow | Acceptance | End-to-end Phase 3A execution with Codex | `❌ Backlog` | No realistic workflow test exists |
| P3A-22 | Claude Code Readiness Workflow | Acceptance | End-to-end Phase 3A execution with Claude Code | `❌ Backlog` | No realistic workflow test exists |
| P3A-23 | Phase 3A Dashboards | Dashboard | Backlog, readiness, boilerplate, change, and agent views | `❌ Backlog` | No dashboards exist |
| P3A-24 | Phase 3A Realistic Readiness Example | Acceptance | A realistic Product ready for implementation with evidence | `❌ Backlog` | No example or acceptance report exists |

## 10. Phase 3B Feature Registry — Controlled Implementation and QA

| ID | Feature | Area | Required outcome | Current status | Current evidence or gap |
|---|---|---|---|---|---|
| P3B-01 | Changed Unit Inventory | Change | Files and units to be changed, with blast radius | `🟡 In Progress` | The inventory foundation is partial |
| P3B-02 | Proposed Change Preview | Execution | Diff and plan before changes are applied | `🟡 In Progress` | A preview foundation exists; provider parity is incomplete |
| P3B-03 | Isolated Staging Workspace | Execution | Staging that supports discard and recovery | `🟡 In Progress` | Staging is partial; four-host support is incomplete |
| P3B-04 | Controlled Codex Implementation | Execution | Plan→preview→approval→apply with Codex | `🟡 In Progress` | The Codex path is partial; end-to-end acceptance is incomplete |
| P3B-05 | Controlled Claude Implementation | Execution | Plan→preview→approval→apply with Claude Code | `❌ Backlog` | Real managed execution does not exist |
| P3B-06 | Provider Switching During Implementation | Execution | Codex/Claude handoff while preserving state and evidence | `❌ Backlog` | No end-to-end workflow exists |
| P3B-07 | Model Switching During Implementation | Execution | Change models with provenance and bounded scope | `❌ Backlog` | No end-to-end workflow exists |
| P3B-08 | Retrieve Approved Figma Context | Design to Code | Approved snapshot and version for generation | `❌ Backlog` | The required Figma adapter does not exist |
| P3B-09 | Controlled Design-to-Code Generation | Design to Code | Generate a substantial frontend portion within the boilerplate | `❌ Backlog` | No generator or governance implementation exists |
| P3B-10 | Design-to-Code Traceability | Trace | Figma node↔requirement↔backlog↔code↔test | `❌ Backlog` | The complete trace chain does not exist |
| P3B-11 | Boilerplate Constraint Enforcement | Assurance | Prevent agents from violating the stack or architecture | `❌ Backlog` | No policy or validator exists |
| P3B-12 | Backlog-to-Code Traceability | Trace | Link changes, commits, and tests to backlog items | `🟡 In Progress` | A trace foundation exists; completeness is inadequate |
| P3B-13 | Apply/Discard Foundation | Execution | Safely apply or discard staged changes | `🟡 In Progress` | A foundation exists; acceptance is incomplete |
| P3B-14 | Scoped Apply | Execution | Apply only approved targets | `🟡 In Progress` | Scope controls are partial; parity is incomplete |
| P3B-15 | Rollback and Recovery | Recovery | Versioned rollback and recovery evidence | `🟡 In Progress` | Sequential and bounded parallel-readonly process loss now preserves completed-step or batch receipts, resumes unfinished work, safely restarts before checkpoint zero, and rejects tampering; effectful multi-step, native-platform and power-loss scenarios remain |
| P3B-16 | Change Conflict Detection | Change | Detect conflicts with user edits, baselines, and provider handoffs | `❌ Backlog` | No conflict engine exists |
| P3B-17 | Test Generation | QA | Generate tests from acceptance, risk, and design contracts | `🟡 In Progress` | Some test mechanisms exist; governed generation is incomplete |
| P3B-18 | Unit and Integration Testing | QA | Repeatable suite for changed units | `🟡 In Progress` | Tests exist; the phase gate and coverage contract are incomplete |
| P3B-19 | End-to-End Testing | QA | Real workflows across four hosts and two providers | `🟡 In Progress` | End-to-end assets are partial; the matrix is incomplete |
| P3B-20 | Security Testing | QA | SAST, dependency, and threat-control validation | `🟡 In Progress` | A security foundation exists; the release gate is incomplete |
| P3B-21 | Accessibility Testing | QA | Automated and manual accessibility evidence | `🟡 In Progress` | Checks are partial; four-host dashboard conformance is incomplete |
| P3B-22 | Visual Regression Testing | QA | Figma-to-implementation visual comparison | `❌ Backlog` | No harness exists |
| P3B-23 | Performance and Reliability Testing | QA | Budgets and load, failure, and recovery scenarios | `🟡 In Progress` | Deterministic concurrency-ceiling, sibling-cancellation, partial-failure and restart scenarios now execute in the managed-engine harness; formal budgets, sustained load, native-platform and power-loss methodology remain incomplete |
| P3B-24 | Multi-Dimensional QA Scorecard | QA | Functional, security, accessibility, visual, and performance quality | `❌ Backlog` | No executable scorecard exists |
| P3B-25 | UAT and Human Validation | Acceptance | User scenarios and signed acceptance | `❌ Backlog` | No workflow or evidence template exists |
| P3B-26 | Requirement/Design/Code Drift Detection | Assurance | Detect drift across baselines | `🟡 In Progress` | Concepts are partial; end-to-end automation is incomplete |
| P3B-27 | Conform / Amend / Waive Decisions | Governance | Governed decision for every deviation | `❌ Backlog` | No executable workflow exists |
| P3B-28 | Phase 3B Implementation and QA Dashboard | Dashboard | Change, test, quality, and readiness state | `❌ Backlog` | No phase dashboard exists |
| P3B-29 | Phase 3B Change, Impact, Agent and Model Views | Dashboard | Live runs, affected scope, and provider/model evidence | `❌ Backlog` | No integrated views exist |
| P3B-30 | Phase 3B Realistic Implementation Example | Acceptance | Figma-backed frontend slice with QA and approval | `❌ Backlog` | No canonical example or acceptance report exists |

## 11. Phase 4 Feature Registry — Release, Publish, and Learning

| ID | Feature | Area | Required outcome | Current status | Current evidence or gap |
|---|---|---|---|---|---|
| P4-01 | Release Manifest | Release | Contents, versions, checksums, evidence, and known gaps | `🟡 In Progress` | Manifest concepts exist; the executable release package is incomplete |
| P4-02 | Release Approval | Governance | Authority, scope, conditions, and signed decision | `🟡 In Progress` | An approval model exists; the release workflow is incomplete |
| P4-03 | Deployment Automation | Delivery | Repeatable deployment with environment controls | `❌ Backlog` | No automation exists |
| P4-04 | Deployment Evidence | Delivery | Execution trace, actor, target, result, and artifacts | `❌ Backlog` | No evidence pipeline exists |
| P4-05 | Rollback Plan | Recovery | Trigger, steps, owner, and recovery target | `🟡 In Progress` | Concepts are partial; a complete validated plan does not exist |
| P4-06 | Rollback Validation | Recovery | Rehearsal or test with evidence | `🟡 In Progress` | A recovery foundation exists; release rehearsal is incomplete |
| P4-07 | Observability and Telemetry | Operations | Logs, metrics, and traces with privacy controls | `❌ Backlog` | No operational implementation exists |
| P4-08 | KPI and Outcome Measurement | Product | Link delivery to Product outcomes | `❌ Backlog` | No dashboard or measurement pipeline exists |
| P4-09 | Package Signing and Integrity | Supply Chain | Signing, checksums, and verification | `❌ Backlog` | Release signing does not exist |
| P4-10 | Publish and Distribution | Distribution | Channels, versioning, release notes, and rollback | `❌ Backlog` | No publishing pipeline exists |
| P4-11 | Operational Handoff | Operations | Runbook, ownership, escalation, and support | `🟡 In Progress` | Handoff concepts exist; the executable package is incomplete |
| P4-12 | Lessons and Retrospective | Learning | Outcomes, failures, decisions, and actions | `🟡 In Progress` | Learning concepts exist; the workflow is incomplete |
| P4-13 | Rebaseline | Governance | Incorporate accepted lessons and changes into the next baseline | `🟡 In Progress` | A baseline model exists; the release loop is incomplete |
| P4-14 | Next-Change Impact | Change | Apply lessons and telemetry to the roadmap and backlog | `🟡 In Progress` | The impact foundation is partial; portfolio integration is incomplete |
| P4-15 | Portfolio Dashboard | Dashboard | Product and Initiative health with a cross-release view | `❌ Backlog` | No dashboard exists |
| P4-16 | Release and Learning Dashboards | Dashboard | Release readiness, rollout, outcomes, and learning | `❌ Backlog` | No dashboards exist |
| P4-17 | Phase 4 Realistic Release Example | Acceptance | Package→deploy→observe→rollback/learn | `❌ Backlog` | No canonical example or acceptance report exists |

## 12. Four-IDE Acceptance Matrix

This matrix must be completed at the end of **every phase** for that phase's package. `N/A` is permitted only through a recorded Product Owner decision.

| IDE | Required artifact | Required environment | Install smoke | Codex workflow | Claude workflow | Model switch | Dashboard | Upgrade/Rollback | Current acceptance |
|---|---|---|---|---|---|---|---|---|---|
| VS Code | `.vsix` | Supported desktop OS matrix | Required | Required | Required | Required | Required | Required | `🟡 In Progress` |
| Visual Studio | Native `.vsix` | Supported Windows + Visual Studio matrix | Required | Required | Required | Required | Required | Required | `❌ Backlog` |
| Rider | JetBrains plugin artifact | Supported OS + Rider sandbox matrix | Required | Required | Required | Required | Required | Required | `🟡 In Progress` |
| Kiro | Independently installable compatible package | Supported Kiro desktop matrix | Required | Required | Required | Required | Required | Required | `❌ Backlog` |

## 13. Phase Dashboard Contract

Every dashboard must be more than a visual shell and must be connected to valid artifacts, runs, and evidence.

| Phase | Required primary dashboard | Mandatory supporting views |
|---|---|---|
| Phase 0 | Platform/Host Readiness | Plugin matrix, provider/model readiness, installation health, and conformance |
| Phase 1 | Product P0–P4 Readiness | Source/provenance, decisions, risks, architecture, change/impact, and agent/model |
| Phase 2 | UX/Figma Readiness | Journeys/screens, design state, Figma synchronization delta, approvals, drift, and agent/model |
| Phase 3A | Backlog/Implementation Readiness | Priority/dependencies, boilerplate binding, HLD/LLD, tests, and gaps |
| Phase 3B | Implementation/QA Control | Staged changes, affected units, test matrix, deviations, and provider/model runs |
| Phase 4 | Release/Learning Control | Release readiness, deployment, rollback, outcomes, and portfolio impact |

## 14. Definition of Feature Done

A Feature ID may be set to `✅ Done` only when all applicable conditions below are satisfied:

- the required implementation or artifact exists at its canonical path;
- the acceptance criteria are observable and repeatable;
- all applicable automated tests pass;
- for a host or plugin feature, the package is installed and installation/workflow smoke tests pass;
- for a cross-provider feature, both Codex and Claude Code have been tested;
- for a model-related feature, discovery, selection, switching, and provenance have been tested;
- the relevant dashboard displays real data and freshness/evidence cues;
- the realistic example has been executed and its output path is recorded;
- known gaps, limitations, and risks are recorded;
- the Product Owner has explicitly accepted the result; and
- this file's Change Log contains the Feature IDs, date, evidence, and acceptance statement.

## 15. Definition of Phase Done

Claude Code must not report a phase as Done unless:

1. every in-scope Feature ID is `✅ Done` or has been set to `⏸ Deferred` through a recorded decision;
2. every cross-platform Feature ID required by that phase is `✅ Done`;
3. all four rows of the IDE Acceptance Matrix have successful evidence for that phase's version;
4. Codex, Claude Code, and model switching have been tested in all four IDEs;
5. the phase dashboards display real data;
6. the Product Owner has reviewed the phase's realistic example;
7. the Product Owner has explicitly accepted phase completion; and
8. the Feature Registry, Status Summary, and Change Log are updated in a single change.

## 16. Claude Code Update Protocol

Claude Code must follow this contract at the beginning and end of every development run.

### 16.1 Before implementation

1. Read the current Manifest version and this file.
2. State the active phase and exact Feature IDs.
3. Review current status, dependencies, gaps, and acceptance criteria.
4. Do not change a Feature ID, phase assignment, or requirement without a Product Owner decision.
5. Define an implementation plan, test plan, and evidence path for every feature.

### 16.2 During implementation

1. Trace changes to Feature IDs.
2. Keep effectful output in staging or preview until the required approval is granted.
3. Do not remove existing evidence or status without a documented reason.
4. Record every new gap, required decision, or blocker in the feature row or Change Log.
5. Do not claim parity based on testing only one IDE or one provider.

### 16.3 At handoff for human test

1. Change completed Feature IDs to `🧪 Ready for Test`.
2. Report the exact build, test, package, and installation commands.
3. Record the package path for all four IDEs.
4. Record the realistic example path and dashboard results.
5. Explicitly report known gaps and any tests that were not run.
6. Ask the Product Owner to test and accept the result; do not set the status to `✅ Done`.

### 16.4 After Product Owner approval

1. Change only explicitly accepted Feature IDs to `✅ Done`.
2. Record the date, acceptance statement, test/evidence path, and updater in the Change Log.
3. Recalculate the Status Summary.
4. If every gate is satisfied, update the phase status as well.
5. In the final response, report status changes as `Feature ID: old -> new`.

### 16.5 Required final response from Claude Code

```text
Active phase:
Feature IDs changed:
Implementation outcome:
Automated tests:
Installable packages (VS Code / Visual Studio / Rider / Kiro):
Codex workflow result:
Claude Code workflow result:
Model switching result:
Dashboard URL/path or screenshots:
Realistic example path:
Known gaps / blocked decisions:
Tracker status changes:
Human acceptance required:
```

## 17. Active Execution Queue

Until the Product Owner activates a different phase, use the following recommended execution order:

| Order | Milestone | Primary Feature IDs | Required demonstration | Status |
|---:|---|---|---|---|
| 1 | Phase 0 / Phase 1A foundation audit | PLT-01 to PLT-35 | Exact inventory, build truth, and gap/evidence report | `🟡 In Progress` |
| 2 | Four-IDE installable shell | PLT-01, PLT-03 to PLT-05, PLT-20 to PLT-22, PLT-27 to PLT-29, PLT-31 to PLT-35 | Install four plugins and display the dashboard shell | `❌ Backlog` |
| 3 | Two-provider execution parity | PLT-06 to PLT-19 | Codex/Claude analysis, switching, and evidence | `❌ Backlog` |
| 4 | Phase 1B P0–P4 core | P1-01 to P1-29 | One Product through readiness and handoff | `❌ Backlog` |
| 5 | Phase 1C acceptance release | P1-30 to P1-36 + applicable PLT items | Four IDEs, two providers, dashboards, and a realistic example | `❌ Backlog` |
| 6 | Phase 2 | P2-01 to P2-26 + PLT-30 | GAEP↔Figma loop | `❌ Backlog` |
| 7 | Phase 3A | P3A-01 to P3A-24 | implementation-ready Product | `❌ Backlog` |
| 8 | Phase 3B | P3B-01 to P3B-30 | controlled frontend slice + QA | `❌ Backlog` |
| 9 | Phase 4 | P4-01 to P4-17 | release→observe→learn | `❌ Backlog` |

## 18. Evidence and Change Log

Every status change must add a new row. Previous rows must not be deleted or rewritten.

| Date | Actor | Phase | Feature IDs | Status changes | Evidence / test path | Product Owner acceptance | Notes |
|---|---|---|---|---|---|---|---|
| 2026-07-24 | Codex | All | PLT-01..35, P1-01..36, P2-01..26, P3A-01..24, P3B-01..30, P4-01..17 | Initial baseline recorded | Codebase and Manifest assessment | Baseline structure requested by Product Owner; feature completion not newly accepted | Initial 168-feature delivery tracker created |
| 2026-07-24 | Codex | All | None | No feature status changes | Full-language scan and repository documentation validation | Product Owner requested an English-only tracker | Translated all narrative text and table content to English; IDs, phase assignments, and statuses were preserved |
| 2026-07-24 | Codex | Phase 0 / 1A foundation audit | None | No feature status changes | `ruby scripts/validate_next_docs.rb --mode structural` and `--mode candidate`: PASS; baseline and implementation-readiness modes: BLOCKED only by their declared human/governance prerequisites | Product Owner approved continuous local implementation, not feature completion or baseline/release acceptance | Added Roadmap 054/055 migration dispositions, rebound deterministic documentation digests, and corrected stale documentation-only descriptions; no Feature ID implementation was changed |
| 2026-07-24 | Codex | Phase 0 / 1A foundation | PLT-32, PLT-33 | `❌ Backlog` -> `🟡 In Progress` | Kiro-compatible source and package checkpoint `7541940`; root `npm run verify`, exact isolated VSIX install/list, compatible extension-host smoke and zero-vulnerability dependency audit pass | Product Owner approved continuous local implementation, not native-Kiro or feature completion acceptance | Native Kiro, native Windows, provider/model switching and complete dashboard parity remain unverified; no feature advanced to Ready for Test or Done |

## 19. Integrity Checks for This File

After every edit, the agent must perform these checks:

- all Feature IDs are unique;
- exactly 35 `PLT-*`, 36 `P1-*`, 26 `P2-*`, 24 `P3A-*`, 30 `P3B-*`, and 17 `P4-*` identifiers exist;
- the total number of features is 168;
- every status is selected only from the Canonical Status Model;
- the Status Summary matches the Feature Registry rows;
- no phase is Done unless the Definition of Phase Done is satisfied;
- every change to `✅ Done` has Product Owner acceptance and evidence;
- the Manifest link remains valid; and
- changes to this file are delivered with the code and test report for the same features.
