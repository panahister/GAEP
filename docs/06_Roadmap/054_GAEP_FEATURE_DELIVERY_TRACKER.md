# GAEP Feature Delivery Tracker

**Governed AI Engineering Platform (GAEP)**  
**Document ID:** GAEP-RDM-054  
**Version:** 1.0.6  
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
| Cross-platform capabilities | 35 | 3 | 31 | 0 | 0 | 0 | 0 | 1 |
| Phase 1 — Product P0–P4 | 36 | 1 | 21 | 0 | 0 | 0 | 0 | 14 |
| Phase 2 — UX and Figma | 26 | 0 | 8 | 0 | 0 | 0 | 0 | 18 |
| Phase 3A — Backlog and Readiness | 24 | 0 | 8 | 0 | 0 | 0 | 0 | 16 |
| Phase 3B — Implementation and QA | 30 | 0 | 15 | 0 | 0 | 0 | 0 | 15 |
| Phase 4 — Release and Learning | 17 | 0 | 8 | 0 | 0 | 0 | 0 | 9 |
| **All tracked features** | **168** | **4** | **91** | **0** | **0** | **0** | **0** | **73** |

## 6. Cross-Platform Capability Registry

These capabilities are cross-cutting. The target milestone is the first phase in which the capability must reach an acceptable level; its conformance must then be revalidated in every subsequent phase.

| ID | Feature | Target milestone | Required outcome | Current status | Current evidence or gap |
|---|---|---|---|---|---|
| PLT-01 | Shared GAEP Engine | Phase 0 / 1A | One shared engine with no behavioral forks between hosts | `🟡 In Progress` | `2da531f`, `e663a29` and `0daba2a` bind Visual Studio, Rider and Kiro to the shared audit-gated managed.review read/apply/discard RPCs with exact Run revision, preview, staged inventory, write-envelope and predecessor-chain validation; every host receives only exact decision authority, never a general write API. Packaged-engine workflow evidence remains incomplete |
| PLT-02 | Portable `.gaep` Workspace | Phase 0 / 1A | Portable, version-controlled state and artifacts | `✅ Done` | A portable workspace exists in the current codebase; regression testing is required in every phase |
| PLT-03 | VS Code Installable VSIX | Phase 0 / 1A | Real VSIX build, installation, upgrade, and smoke testing | `🟡 In Progress` | `7e46bad` packages, installs, inventories and activates the exact VSIX through an independent isolated harness; upgrade/rollback and supported-OS acceptance remain |
| PLT-04 | Visual Studio Native VSIX | Phase 0 / 1A | Native Visual Studio extension installable on Windows | `🟡 In Progress` | `b598edf` adds snapshot-and-total-bound later-page Managed Run evidence navigation to the compiled out-of-process Remote UI and raises the private-safe hostile protocol/controller harness to 155 checks; Windows container creation, installation and rendered interaction remain |
| PLT-05 | Four-IDE Behavioral Parity | Phase 0 / 1A | Equivalent behavior in VS Code, Visual Studio, Rider, and Kiro | `🟡 In Progress` | `f93376b` refreshes the 60-cell source/package matrix to 53 implemented, 7 partial and 0 not implemented after exact staged-review parity in Kiro, Rider and Visual Studio; the phase gate remains incomplete with zero accepted hosts because native, packaged-engine and human acceptance remain incomplete |
| PLT-06 | Codex Detection | Phase 0 / 1A | Discover executable, version, authentication readiness, and capabilities | `✅ Done` | `1ea0141` adds typed path-free Codex readiness regression coverage to Kiro, Rider and Visual Studio in addition to VS Code; native/supported-host acceptance is still required in each phase |
| PLT-07 | Claude Code Detection | Phase 0 / 1A | Discover Claude Code, version, authentication readiness, and capabilities | `🟡 In Progress` | `09faf49` adds a private machine-local offline staged-runtime preflight with exact executable fingerprint/recheck, minimum version, bounded flag verification and explicit authentication/managed-policy blockers. Installed Claude Code `2.1.153` is blocked below minimum `2.1.208`, with `--max-turns` unverified; `1ea0141` provides the existing path-free four-host readiness projection. No live provider request, native-host or supported-version acceptance exists |
| PLT-08 | Codex Model Discovery and Selection | Phase 0 / 1A | Display and select the Codex models available to the user | `🟡 In Progress` | `c0dabe9`, `1545ef0` and `f125147` add cancel-default selection of verified Codex adapter/model/non-sensitive portable settings in Visual Studio, Rider and Kiro through the `995e69d` shared guards. Live execution-backed verification and complete acceptance remain incomplete |
| PLT-09 | Claude Model Discovery and Selection | Phase 0 / 1A | Display and select the Claude Code models available to the user | `🟡 In Progress` | The same Visual Studio, Rider and Kiro guarded-selection surfaces expose a detected Claude adapter and fail closed when none is available. Live Claude verification, handoff and acceptance remain incomplete |
| PLT-10 | Safe Codex Analysis Execution | Phase 0 / 1A | Read-only analysis with a run envelope and evidence | `🟡 In Progress` | `bf90ac6`, `454c4a7` and `f683648` expose the exact digest-attested managed read-only flow in Visual Studio, Rider and Kiro through the shared engine contract; real-provider packaged workflows and four-host acceptance remain incomplete |
| PLT-11 | Safe Claude Analysis Execution | Phase 0 / 1A | Read-only Claude analysis with a run envelope and evidence | `🟡 In Progress` | The context-only executable path now shares durable sequential and bounded parallel-readonly multi-step checkpoint/restart controls with the deterministic adapter, but live Claude invocation, packaged-host and four-IDE acceptance evidence remain incomplete |
| PLT-12 | Staged Codex Effectful Execution | Phase 0 / 1A | Preview, approval, apply, and recovery for Codex changes | `🟡 In Progress` | `2da531f`, `e663a29` and `0daba2a` expose audit-verified complete bounded reviews of at most 512 exact changes in Visual Studio, Rider and Kiro with two-step cancel-default apply/discard, stale revision/digest rejection and conservative recovery truth. Post-apply gates are recorded not assessed; real-provider packaged execution, multi-step effectful staging and final acceptance remain incomplete |
| PLT-13 | Staged Claude Effectful Execution | Phase 0 / 1A | Preview, approval, apply, and recovery for Claude changes | `🟡 In Progress` | `b9f96cf` adds an experimental provider-neutral isolated-stage, streamed-event, complete-inspection, exact review/apply/discard and durable recovery SDK foundation. `09faf49` adds the fail-closed offline runtime preflight: installed Claude Code `2.1.153` is below minimum `2.1.208`, `--max-turns` remains unverified, bare-mode authentication is unattested and higher-priority managed policy is unattested. Five preflight tests and the 46-file aggregate with 493 passed plus 1 conditional skip are green. No live provider request was made. The production adapter remains context-only with Tool selection false and the engine remains `claude-context-only` |
| PLT-14 | Provider Switching | Phase 0 / 1A | Switch Codex and Claude Code within one Initiative without losing state | `🟡 In Progress` | `d67d8bb` adds the Visual Studio versioned switch alongside Kiro and Rider, binding current selection and latest terminal Run to a freshly observed target with preserved portable history and exact returned receipt validation. A real bidirectional accepted workflow remains incomplete |
| PLT-15 | Model Switching | Phase 0 / 1A | Change models within each provider while recording provenance | `🟡 In Progress` | `d67d8bb` records Visual Studio model and setting switches through atomic versioned handoff plus target selection, matching Kiro/Rider exact agent/model/settings/history receipt checks. Packaged-engine interaction and four-host acceptance remain incomplete |
| PLT-16 | Versioned Provider/Model Handoff | Phase 0 / 1A | Transfer context, Run Envelope, and evidence between agents and models | `🟡 In Progress` | `d67d8bb` adds strict Visual Studio source-Run/prior-selection binding, bounded portable completed/unresolved/decision/evidence details, stale-state recheck, fresh target observation and cancel-default confirmation; Kiro and Rider validate the same exact receipt. Live bidirectional provider acceptance and packaged-engine evidence remain incomplete |
| PLT-17 | Manual/Fake Provider Adapter | Phase 0 / 1A | Deterministic adapter for offline tests and fixtures | `✅ Done` | A test adapter exists and must remain part of the conformance suite |
| PLT-18 | Context and Run Envelope | Phase 0 / 1A | Record scope, authority, inputs, model, limits, and effects | `🟡 In Progress` | Exact multi-step Workflow checkpoints bind completed dependency batches, gates, events and observation-only effects; parallel concurrency is capped at four and all tool/write/effect authority fails closed, while complete host/provider coverage remains incomplete |
| PLT-19 | Normalized Evidence and Run Records | Phase 0 / 1A | Provider- and host-independent evidence | `🟡 In Progress` | `0daba2a` corrects apply-decision verification to traverse and bind the immutable pre-apply result/evidence predecessor rather than miscompare the post-apply result. Checkpoint/restart and bounded inventory evidence remain portable; every provider and host is not yet conformant |
| PLT-20 | Install, Upgrade, and Rollback | Phase 0 / 1A | Testable lifecycle for all four plugins | `🟡 In Progress` | `9f1af97` proves isolated prior-version fixture install, `0.1.0` upgrade, same-version reinstall, forced rollback, uninstall/absence, final current install and activation for VS Code and Kiro-compatible hosts. Fixtures are not production rollback payloads; native Kiro/Rider plugin-manager behavior and Visual Studio Windows installation remain |
| PLT-21 | Dashboard Shell | Phase 0 / 1A | Shared dashboard shell in all four hosts | `🟡 In Progress` | `b598edf`, `11452de` and `95d210e` add snapshot-and-total-bound next/previous Managed Run evidence navigation to Visual Studio, Rider and Kiro; VS Code shares the bounded inventory/detail truth. Native accessibility/rendering and four-host installation remain incomplete |
| PLT-22 | Phase-Scoped Dashboard Framework | Phase 0 / 1A | Compose dashboards according to phase and applicability | `🟡 In Progress` | `fa9b3cd` adds the strict seven-phase exact-Product/digest-bound framework. `89bccd9` renders its canonical three panels in VS Code Product Studio with strict bridge validation and accessible no-authority/freshness cues. `49d63a2` adds Kiro's protocol-v2 Phase 0/1A command: it retains only a digest beyond the existing Product binding, independently rebinds the response, recomputes its composition digest, rejects private/extra/stale/catalog/applicability drift, and renders metadata/limits without Product text or action authority. Kiro typecheck, four full hostile client scenarios, package verification and the isolated installed-VSIX lifecycle with eleven bounded commands pass. Native Kiro acceptance, Rider and Visual Studio adoption, governed applicability decisions, executable-example evidence and human acceptance remain incomplete |
| PLT-23 | Change and Impact Dashboard | Phase 0 / 1A | Changed artifacts, affected units, approvals, and risks | `🟡 In Progress` | A partial view exists; completeness and freshness are incomplete |
| PLT-24 | Agent and Model Dashboard | Phase 0 / 1A | Provider, model, run status, cost/usage, and handoff evidence | `🟡 In Progress` | Kiro, Rider and Visual Studio expose exact staged inventory, decisions, readiness, selection, handoff and bounded Run/evidence projections, including later-page navigation under one exact snapshot. Usage and native acceptance remain incomplete |
| PLT-25 | Accessible Dashboard Tables | Phase 0 / 1A | Keyboard and screen-reader support, sorting, filtering, and export | `🟡 In Progress` | A table foundation exists; accessibility conformance is incomplete |
| PLT-26 | Freshness and Evidence Cues | Phase 0 / 1A | Show freshness, source, confidence, and stale state | `🟡 In Progress` | Cues are partial; policy and validation are incomplete |
| PLT-27 | Four-IDE Conformance Suite | Phase 0 / 1A | Shared contract tests for four IDEs and two providers | `🟡 In Progress` | `f93376b` verifies 53 implemented, 7 partial and 0 not-implemented cells across 15 capabilities and four hosts against source markers, exact package bytes/digests and bounded runtime evidence. Native matrices, packaged-engine workflows and acceptance remain incomplete |
| PLT-28 | Realistic Example Runner | Phase 0 / 1A | Repeatable realistic example with inspectable outputs | `🟡 In Progress` | `a525a14` adds the canonical governed Product/Initiative/Context/Workflow/Charter scenario, exact digest-attested offline managed execution, stable semantic expectation, bounded receipt verifier, disposable or no-overwrite inspectable `.gaep` artifact modes, and 5 current/hostile tests. `24de329` records targeted 15-second aggregate-test bounds after two pre-existing I/O-heavy cases crossed Vitest's 5-second default under parallel load; both still finish in about 1.8–2.5 seconds alone, and the complete Founder gate passes 484 tests with 1 conditional skip plus all CI-contract, example, documentation and VS Code extension-host gates. `evidence/examples/2026-07-24T163523Z-phase-0-managed-readonly.json` verifies summary digest `sha256:751524df05f691e192b744cff2dd46e6ec81e74c45c667e12b93e6dd05e6a113`; real-provider, native-host and human acceptance remain incomplete |
| PLT-29 | Per-Phase Package and Acceptance Report | Phase 0 / 1A | Package, checksum, test report, and known gaps for every phase | `🟡 In Progress` | `0730770` records exact current VS Code, Kiro and Rider package digests plus the 155-check Windows-package limit in `evidence/local-packages/2026-07-24T150718Z-phase-0-local-evidence-pagination-visual-studio.json`; `evidence/ide-conformance/2026-07-24T150735Z-phase-0-local-evidence-pagination-visual-studio.json` preserves the 53/7/0 matrix and all native/supported-platform, packaged-engine, human-acceptance and non-release gaps. Later phase reports remain |
| PLT-30 | Governed Figma MCP Adapter | Phase 2 | Governed Figma read, import, write, and synchronization | `❌ Backlog` | A complete adapter and contract do not exist |
| PLT-31 | Rider Native Plugin | Phase 0 / 1A | Native JetBrains/Rider plugin with sandbox and installation tests | `🟡 In Progress` | `11452de` adds asynchronous snapshot-bound next/previous Managed Run evidence navigation to the native Product tool window. Clean test/package/structure/prepared-sandbox parity and bounded Rider 2025.3 startup pass; plugin-manager installation, automated interaction and complete acceptance remain |
| PLT-32 | Kiro Installable Package | Phase 0 / 1A | Independent Kiro installation and compatibility validation | `🟡 In Progress` | `7e46bad` packages, installs, inventories and activates the exact independent VSIX through a separate compatible-host harness. Native Kiro installation remains unverified because no Kiro binary is available |
| PLT-33 | Kiro Compatibility and Smoke Tests | Phase 0 / 1A | Installation, workflow, provider, model, and dashboard smoke tests in Kiro | `🟡 In Progress` | `95d210e` proves snapshot-bound later-page evidence navigation in addition to strict staged-review/apply/discard behavior, and the exact installed compatible package still activates ten bounded commands without workspace mutation. Native Kiro, real provider workflows and packaged-engine interaction remain |
| PLT-34 | Visual Studio Windows Installation Tests | Phase 0 / 1A | CI or manual evidence for VSIX installation on Windows | `🟡 In Progress` | `cbe61de` adds a least-authority `windows-2022` workflow that builds/verifies the native VSIX, executes a bounded install/uninstall/reinstall/cleanup probe and independently binds a private-safe receipt to the exact VSIX bytes and CI revision. Four local workflow/receipt contract tests, YAML parsing, root checks and the Visual Studio host gate pass; the workflow has not been published or executed, so no Windows report or installation claim exists yet |
| PLT-35 | Rider Sandbox and Installation Tests | Phase 0 / 1A | `runIde`, installable artifact, and workflow smoke testing | `🟡 In Progress` | `663259f` adds a 90-second bounded `runIde` smoke that proves fresh Rider 2025.3 startup, exact GAEP plugin load, isolated paths and process-tree cleanup; plugin-manager installation and interactive workflow evidence remain |

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
| P3B-23 | Performance and Reliability Testing | QA | Budgets and load, failure, and recovery scenarios | `🟡 In Progress` | Deterministic concurrency, cancellation, partial-failure and restart scenarios plus Managed Run count/file-size/read-concurrency/page bounds now execute in the harness; sustained load, native-platform and power-loss methodology remain incomplete |
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
| Visual Studio | Native `.vsix` | Supported Windows + Visual Studio matrix | Required | Required | Required | Required | Required | Required | `🟡 In Progress` |
| Rider | JetBrains plugin artifact | Supported OS + Rider sandbox matrix | Required | Required | Required | Required | Required | Required | `🟡 In Progress` |
| Kiro | Independently installable compatible package | Supported Kiro desktop matrix | Required | Required | Required | Required | Required | Required | `🟡 In Progress` |

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
| 2026-07-24 | Codex | Wave 4 durable local recovery | None | No feature status changes | Managed Stage storage checkpoint `2ab4f1e`; 60 focused tests with 1 platform-conditional skip, root typecheck/build, 43 aggregate test files with 471 passed plus 1 conditional skip, and structural/candidate documentation validation pass | Product Owner approved continuous local implementation, not feature completion or release/readiness acceptance | Added bounded global stage inventory and explicit registered-orphan scavenging. Live and unknown roots remain protected; no feature advanced to Ready for Test or Done |
| 2026-07-24 | Codex | Phase 0 / 1A local packaging | PLT-03, PLT-04, PLT-20, PLT-31 to PLT-35 | PLT-04 and PLT-35: `❌ Backlog` -> `🟡 In Progress`; no other status changes | Checkpoints `b3101a4`, `7e46bad`, and `27a5149`; exact installed VS Code/Kiro-compatible VSIX activation, clean Rider ZIP/structure verification, compiled Visual Studio out-of-process shell/generated contributions, 35 host-client checks, and the 471-test aggregate gate pass | Product Owner approved continuous local implementation, not native-host, feature completion, or release acceptance | Windows Visual Studio container/install, native Rider/Kiro runtime, complete workflows, upgrade/rollback, signing and supported-OS matrices remain |
| 2026-07-24 | Codex | Phase 0 / 1A package evidence | PLT-29 | `❌ Backlog` -> `🟡 In Progress` | Checkpoint `c3991aa`; `npm run report:local-packages` and `evidence/local-packages/2026-07-24T075135Z-phase-0-local.json` record bounded artifact paths, exact package IDs/versions, byte sizes, SHA-256 digests, verification levels and the native Visual Studio gap | Product Owner approved continuous local implementation, not phase completion, readiness, release or publication | Three local artifacts are produced; native Windows VSIX, signing, publication, supported-OS acceptance and later phase reports remain. No feature advanced to Ready for Test or Done |
| 2026-07-24 | Codex | Phase 0 / 1A package lifecycle | PLT-20, PLT-29, PLT-31, PLT-35 | No feature status changes | Checkpoints `27973bf` and `7a084b3`; isolated VSIX reinstall/uninstall/absence/reinstall activation passes, Rider archive/prepared-sandbox parity passes twice with configuration-cache reuse, 471 aggregate tests pass with 1 conditional skip, builds and both documentation modes pass, and `evidence/local-packages/2026-07-24T080357Z-phase-0-local-rider-sandbox.json` records current hashes and limits | Product Owner approved continuous local implementation, not feature completion, readiness, native-host acceptance or release | Cross-version VSIX transitions, native Kiro, Rider plugin-manager/interactive execution, Windows Visual Studio installation, signing and supported-OS matrices remain. No feature advanced to Ready for Test or Done |
| 2026-07-24 | Codex | Phase 0 / 1A cross-version package lifecycle | PLT-20, PLT-29 | No feature status changes | Checkpoint `9f1af97`; both exact installed-package smokes prove synthetic `0.0.9` install, `0.1.0` upgrade, same-version reinstall, forced fixture rollback, uninstall/absence, final current reinstall and activation; 471 aggregate tests pass with 1 conditional skip, builds and both documentation modes pass, and `evidence/local-packages/2026-07-24T081046Z-phase-0-local-cross-version.json` records current hashes and claim limits | Product Owner approved continuous local implementation, not feature completion, readiness, native-host acceptance or release | Synthetic fixtures test host-level version replacement only and are not historic builds or production rollback payloads. Native Kiro, Rider/Visual Studio lifecycle, data/schema migration compatibility, signing and supported-OS matrices remain |
| 2026-07-24 | Codex | Phase 0 / 1A native Rider startup | PLT-31, PLT-35 | No feature status changes | Checkpoint `663259f`; `npm run test:rider:startup` launches Rider 2025.3 build 253.28294.87 on macOS arm64, verifies exact `dev.gaep.productstudio@0.1.0` load and isolated paths, then terminates the process tree; `evidence/ide-smokes/2026-07-24T081813Z-rider-startup.json` records the result and claim boundary | Product Owner approved continuous local implementation, not feature completion, readiness, interactive acceptance or release | The computer-use bridge detected the generic JetBrains Java process but could not address its UI. Tool-window interaction, packaged engine execution, plugin-manager installation, other operating systems, signing and publication remain |
| 2026-07-24 | Codex | Phase 0 / 1A Rider Product workflow | PLT-21, PLT-29, PLT-31 | No feature status changes | Checkpoint `5801b9f`; the clean Rider test/package/structure/sandbox-parity gate and bounded native startup pass. Controller coverage verifies exact Product parsing, list/read/import metadata, revision rebinding, privacy-safe output and invalid UUID rejection; `evidence/local-packages/2026-07-24T082603Z-phase-0-local-rider-workflow.json` records current package hashes | Product Owner approved continuous local implementation, not feature completion, interactive acceptance, cross-host parity or release | File selection and import confirmation exist in the native UI, but the Java window was not addressable by the automation bridge. Packaged engine execution, plugin-manager installation, full dashboard parity, signing and other operating systems remain |
| 2026-07-24 | Codex | Phase 0 / 1A Visual Studio Product workflow | PLT-04, PLT-21, PLT-29 | No feature status changes | Checkpoint `c65d1ac`; the out-of-process Remote UI and typed HostClient compile with zero warnings, Product binding and governed portable-design list/read/import pass 46 protocol/controller checks, root `npm run check` passes, and `evidence/local-packages/2026-07-24T084224Z-phase-0-local-visual-studio-workflow.json` records package hashes and limits | Product Owner approved continuous local implementation, not Windows installation, rendered interaction, cross-host parity, feature completion or release | Import uses a cancel-default confirmation and two exact Product reads; private host details are suppressed. Native Windows VSIX creation/install/activation, solution-path auto-selection, packaged engine execution, signing and supported-version acceptance remain |
| 2026-07-24 | Codex | Phase 0 / 1A four-host conformance | PLT-01, PLT-05, PLT-27, PLT-29 | PLT-05 and PLT-27: `❌ Backlog` -> `🟡 In Progress`; no other status changes | Checkpoint `f9c3425`; `npm run test:ide-conformance` passes 3 current/hostile tests, `npm run verify:ide-conformance` validates 60 assessments and exact package/runtime evidence, all locally executable host gates pass, and `evidence/ide-conformance/2026-07-24T085804Z-phase-0-local.json` records 32 implemented, 7 partial, 21 not implemented and zero accepted hosts | Product Owner approved continuous local implementation, not parity completion, native-host acceptance, readiness or release | The verifier passes truth consistency while `phaseGate` remains `incomplete`. Native Kiro/Visual Studio, interactive Rider/Visual Studio, provider/model workflows in three hosts, packaged-engine execution, supported-platform matrices and human acceptance remain |
| 2026-07-24 | Codex | Phase 0 / 1A cross-host readiness | PLT-01, PLT-04 to PLT-09, PLT-21, PLT-24, PLT-27, PLT-29, PLT-31, PLT-33 | No feature status changes | Checkpoint `1ea0141`; exact Kiro installed-VSIX activation, clean Rider test/package/sandbox parity, Visual Studio Release shell/binding verification and 53 host-client checks, three conformance tests, and the 471-test aggregate gate pass. `evidence/ide-conformance/2026-07-24T092154Z-phase-0-local-readiness.json` records 38 implemented, 7 partial, 15 not implemented and zero accepted hosts | Product Owner approved continuous local implementation, not selection/execution, native-host acceptance, feature completion, security review or release | All three hosts expose path-free observation-only Codex/Claude readiness and reject injected private capability fields. Provider/model selection, versioned switching/handoff, execution, packaged-engine validation and native/supported-platform acceptance remain |
| 2026-07-24 | Codex | Phase 0 / 1A guarded selection contract | PLT-08, PLT-09, PLT-14, PLT-16 | No feature status changes | Checkpoint `995e69d`; 32 focused engine/host tests and the 43-file serial aggregate with 474 pass plus 1 conditional skip verify path-free selection state, stale-capability rejection, non-terminal Run exclusion, explicit legacy/invalid handling and mandatory versioned handoff after prior work | Product Owner approved continuous local implementation, not provider execution, host UI acceptance, feature completion, security review or release | This checkpoint establishes the shared guard only. Kiro, Rider and Visual Studio selection UI, handoff detail capture, packaged-engine workflow and native/supported-host acceptance remain |
| 2026-07-24 | Codex | Phase 0 / 1A Kiro guarded selection | PLT-08, PLT-09, PLT-14, PLT-24, PLT-33 | No feature status changes | Checkpoint `f125147`; Kiro typecheck, 2 hostile stdio unit tests, six-file VSIX packaging and exact isolated prior-version install/upgrade/reinstall/rollback/uninstall/final-install activation with six registered commands pass | Product Owner approved continuous local implementation, not provider execution, native-Kiro acceptance, feature completion, security review or release | The UI records verified non-sensitive portable configuration only, rejects private/path-bearing state and surfaces shared active-Run, capability-drift, migration/invalid and handoff guards. Native Kiro and packaged real-engine interaction remain unverified |
| 2026-07-24 | Codex | Phase 0 / 1A Kiro versioned handoff | PLT-01, PLT-14, PLT-15, PLT-16, PLT-24, PLT-33 | No feature status changes | Checkpoint `21d2202`; Kiro verify, 2 hostile stdio unit tests, six-file VSIX packaging and exact isolated prior-version install/upgrade/reinstall/rollback/uninstall/final-install activation with seven registered commands pass; focused engine/host validation passes 32 tests and root typecheck/build pass | Product Owner approved continuous local implementation, not provider execution, native-Kiro acceptance, feature completion, security review or release | The flow binds exact current selection and latest terminal Run to a freshly observed changed target, rejects stale/private/path-bearing state, requires bounded portable history and atomically records handoff plus selection without Run/tool/effect authority. Rider/Visual Studio handoff, native Kiro and packaged real-engine interaction remain unverified |
| 2026-07-24 | Codex | Phase 0 / 1A Rider guarded selection | PLT-08, PLT-09, PLT-14, PLT-24, PLT-31 | No feature status changes | Checkpoint `1545ef0`; clean Rider test/package/structure/prepared-sandbox parity and bounded exact Rider 2025.3 startup pass; the hostile stdio fixture verifies exact selection state, private-field rejection and portable-setting input bounds | Product Owner approved continuous local implementation, not provider execution, interactive acceptance, feature completion, security review or release | The native UI records detected adapter/model/non-sensitive portable configuration only through asynchronous cancel-default dialogs and surfaces shared active-Run, capability-drift, migration/invalid and handoff guards. Interactive automation and packaged real-engine interaction remain unverified |
| 2026-07-24 | Codex | Phase 0 / 1A Rider versioned handoff | PLT-01, PLT-14, PLT-15, PLT-16, PLT-24, PLT-31 | No feature status changes | Checkpoint `d6a16c6`; clean Rider test/package/structure/prepared-sandbox parity, bounded exact Rider 2025.3 startup, Kiro exact seven-command installed-VSIX lifecycle and root typecheck/build pass; hostile fixtures reject private Run/handoff fields and mismatched returned target settings | Product Owner approved continuous local implementation, not provider execution, interactive acceptance, feature completion, security review or release | The native asynchronous flow binds current selection/latest terminal Run, changed target and bounded portable history, rechecks stale state and validates the exact returned receipt before rendering. Interactive Rider dialogs, packaged real-engine interaction, Visual Studio handoff and live provider acceptance remain unverified |
| 2026-07-24 | Codex | Phase 0 / 1A Visual Studio guarded selection | PLT-04, PLT-08, PLT-09, PLT-14, PLT-24 | No feature status changes | Checkpoint `c0dabe9`; both projects build with zero warnings, formatting and Remote UI binding verification pass, and 63 private-safe protocol/controller checks verify exact selection state, workspace-bound editors, private-field rejection and portable-setting input bounds | Product Owner approved continuous local implementation, not Windows/native acceptance, provider execution, feature completion, security review or release | The out-of-process UI records detected adapter/model/non-sensitive portable configuration only after a separate load and cancel-default confirmation. Windows VSIX creation/install/rendered interaction and packaged real-engine interaction remain unverified |
| 2026-07-24 | Codex | Phase 0 / 1A Visual Studio versioned handoff | PLT-01, PLT-04, PLT-14, PLT-15, PLT-16, PLT-24 | No feature status changes | Checkpoint `d67d8bb`; native shell/generated-contribution verification, 77 private-safe protocol/controller checks, all .NET formatting checks and root typecheck/build pass; hostile fixtures reject private Run/handoff fields and mismatched returned target settings | Product Owner approved continuous local implementation, not Windows/native acceptance, provider execution, feature completion, security review or release | The out-of-process flow binds exact current selection/latest terminal Run, changed target and bounded portable history, rechecks stale state and validates the exact returned receipt before rendering. Windows VSIX creation/install/rendered interaction, packaged real-engine interaction and live provider acceptance remain unverified |
| 2026-07-24 | Codex | Phase 0 / 1A guarded-selection conformance | PLT-01, PLT-05, PLT-08, PLT-09, PLT-14, PLT-27, PLT-29 | No feature status changes | Checkpoint `4b1a14f`; 3 conformance tests and exact verification pass; `evidence/ide-conformance/2026-07-24T102603Z-phase-0-local-selection.json` records 41 implemented, 7 partial and 12 not implemented with three produced packages and zero accepted hosts; root typecheck/build and serial aggregate pass 43 files with 474 tests plus 1 conditional skip | Product Owner approved continuous local implementation, not parity completion, native-host acceptance, feature completion, security review or release | The phase gate remains explicitly incomplete. Versioned handoff UI, provider execution, packaged-engine workflows, supported-platform matrices and human acceptance remain |
| 2026-07-24 | Codex | Phase 0 / 1A versioned-handoff conformance | PLT-01, PLT-05, PLT-14, PLT-15, PLT-16, PLT-27, PLT-29 | No feature status changes | Checkpoint `94835ba`; 3 current/hostile conformance tests and exact verification pass; `evidence/ide-conformance/2026-07-24T112440Z-phase-0-local-handoff.json` records 44 implemented, 7 partial and 9 not implemented with three current produced-package digests and zero accepted hosts. VS Code/Kiro exact installed-package lifecycle activation, Rider clean package/parity and native startup, Visual Studio shell plus 77 checks, full serial aggregate and root typecheck/build pass | Product Owner approved continuous local implementation, not parity completion, native-host acceptance, feature completion, security review or release | The phase gate remains explicitly incomplete. Managed execution, effectful review, dashboards, packaged-engine workflows, supported-platform matrices and human acceptance remain |
| 2026-07-24 | Codex | Phase 0 / 1A Kiro managed read-only execution | PLT-01, PLT-05, PLT-14, PLT-16, PLT-24, PLT-27, PLT-29, PLT-33 | No feature status changes | Implementation `f683648`; conformance evidence `d10f276`; 45 focused engine/host tests, hostile Kiro protocol tests, exact eight-command installed-VSIX lifecycle, Rider package/startup, Visual Studio 77-check shell gate, root typecheck/build and the serial 476-test aggregate with 1 conditional skip pass. `evidence/ide-conformance/2026-07-24T120035Z-phase-0-local-managed-readonly.json` records 45 implemented, 7 partial and 8 not implemented with three current package digests and zero accepted hosts | Product Owner approved continuous local implementation, not native-host or real-provider acceptance, feature completion, security review, release or deployment | The Kiro command consumes an already-confirmed exact managed Charter/Workflow, independently verifies canonical preview/gate digests, requires cancel-default attestation, denies Tools/writes/non-observation effects and returns a private-safe receipt. Interactive cancellation/resume, Rider/Visual Studio execution parity, packaged-engine workflows, supported-platform matrices and human acceptance remain |
| 2026-07-24 | Codex | Phase 0 / 1A Rider managed read-only execution | PLT-01, PLT-05, PLT-14, PLT-16, PLT-24, PLT-27, PLT-29, PLT-31 | No feature status changes | Implementation `454c4a7`; conformance evidence `e448294`; full Rider tests, clean instrumentation/package/structure/prepared-sandbox parity, bounded Rider 2025.3 plugin startup, root typecheck/build, the serial 476-test aggregate with 1 conditional skip and 3 current/hostile conformance tests pass. `evidence/ide-conformance/2026-07-24T122047Z-phase-0-local-managed-readonly-rider.json` records 46 implemented, 7 partial and 7 not implemented with three current package digests and zero accepted hosts | Product Owner approved continuous local implementation, not interactive/native workflow or real-provider acceptance, feature completion, security review, release or deployment | The Rider command consumes an already-confirmed exact managed Charter/Workflow, independently reconstructs canonical preview/gate digests, requires a cancel-default exact attestation, denies Tools/writes/non-observation effects, rejects hostile private/rebound responses and renders a private-safe receipt with provider completion separated from governed outcome. Interactive dialog automation, interactive cancellation/resume, Visual Studio execution parity, packaged-engine workflows, supported-platform matrices and human acceptance remain |
| 2026-07-24 | Codex | Phase 0 / 1A Visual Studio managed read-only execution | PLT-01, PLT-04, PLT-05, PLT-10, PLT-14, PLT-16, PLT-24, PLT-27, PLT-29 | No feature status changes | Implementation `bf90ac6`; conformance evidence `1a7ddcb`; both Visual Studio projects build with zero warnings, both formatting gates, native shell/generated contribution verification, 98 hostile protocol/controller checks, root typecheck/build, the serial 476-test aggregate with 1 conditional skip and 3 current/hostile conformance tests pass. `evidence/ide-conformance/2026-07-24T123440Z-phase-0-local-managed-readonly-visual-studio.json` records 47 implemented, 7 partial and 6 not implemented with three current package digests and zero accepted hosts | Product Owner approved continuous local implementation, not Windows/native interaction or real-provider acceptance, feature completion, security review, release or deployment | The workspace-bound Remote UI consumes an already-confirmed exact managed Charter/Workflow, independently reconstructs canonical preview/gate digests, requires a separate cancel-default exact attestation, denies Tools/writes/non-observation effects, rejects hostile private/extra/rebound responses and renders a private-safe receipt with provider disposition separated from governed outcome. Windows VSIX creation/install/rendered interaction, interactive cancellation/resume, packaged-engine workflows, supported-version matrices and human acceptance remain |
| 2026-07-24 | Codex | Phase 0 / 1A Kiro bounded Managed Run evidence dashboard | PLT-01, PLT-05, PLT-21, PLT-24, PLT-27, PLT-29, PLT-33 | No feature status changes | Implementation `773c05b`; conformance evidence `70f4d2a`; 13 shared host/projection tests, hostile Kiro client tests, exact nine-command installed-VSIX lifecycle, root typecheck/build, the serial 479-test aggregate with 1 conditional skip and 3 current/hostile conformance tests pass. `evidence/ide-conformance/2026-07-24T125344Z-phase-0-local-evidence-dashboard-kiro.json` records 48 implemented, 7 partial and 5 not implemented with three current package digests and zero accepted hosts | Product Owner approved continuous local implementation, not native-Kiro interaction, real-provider acceptance, feature completion, security review, release or deployment | The shared protocol verifies the audit chain and exact result/evidence/apply-decision bindings before projecting portable counts and digests. Kiro shows a 100-row first page with exact total/omission truth and one private-safe detail, with no start/resume/cancel/apply/discard/approval authority. Native Kiro, interactive later-page navigation, packaged-engine workflows, supported-platform matrices and human acceptance remain |
| 2026-07-24 | Codex | Phase 0 / 1A Rider bounded Managed Run evidence dashboard | PLT-01, PLT-05, PLT-21, PLT-24, PLT-27, PLT-29, PLT-31 | No feature status changes | Implementation `09b5eec`; conformance evidence `dc19ab3`; full Rider tests, clean instrumentation/package/structure/prepared-sandbox byte parity, bounded Rider 2025.3 startup, root typecheck/build, the serial 479-test aggregate with 1 conditional skip and 3 current/hostile conformance tests pass. `evidence/ide-conformance/2026-07-24T130824Z-phase-0-local-evidence-dashboard-rider.json` records 49 implemented, 7 partial and 4 not implemented with three current package digests and zero accepted hosts | Product Owner approved continuous local implementation, not interactive/native workflow or real-provider acceptance, feature completion, security review, release or deployment | Rider strictly verifies snapshot/total/omission truth and exact result/evidence/apply-decision bindings before rendering a 100-row first page and one private-safe detail. It grants no start/resume/cancel/apply/discard/approval authority. Interactive Product tool-window automation, later-page navigation, packaged-engine workflows, supported-platform matrices and human acceptance remain |
| 2026-07-24 | Codex | Phase 0 / 1A Visual Studio bounded Managed Run evidence dashboard | PLT-01, PLT-04, PLT-05, PLT-21, PLT-24, PLT-27, PLT-29 | No feature status changes | Implementation `ebcd36d`; conformance evidence `8721d13`; Release builds with zero warnings, all three .NET formatting gates, native shell/generated contribution and Remote UI binding verification, 124 private-safe protocol/controller checks, root typecheck/build, the serial 479-test aggregate with 1 conditional skip and 3 current/hostile conformance tests pass. `evidence/ide-conformance/2026-07-24T132516Z-phase-0-local-evidence-dashboard-visual-studio.json` records 50 implemented, 7 partial and 3 not implemented with three current package digests and zero accepted hosts | Product Owner approved continuous local implementation, not Windows/native interaction, real-provider acceptance, feature completion, security review, release or deployment | Visual Studio strictly verifies snapshot/total/omission truth, record-only state and exact result/evidence/apply-decision bindings before rendering a 100-row first page and one private-safe detail. It grants no start/resume/cancel/apply/discard/approval authority. Windows VSIX creation/install/rendered interaction, later-page navigation, packaged-engine workflows, supported-version matrices and human acceptance remain |
| 2026-07-24 | Codex | Phase 0 / 1A Kiro bounded exact staged review | PLT-01, PLT-05, PLT-12, PLT-19, PLT-24, PLT-27, PLT-29, PLT-33 | No feature status changes | Implementation `0daba2a`; conformance evidence `ae52108`; shared projection/host and hostile Kiro protocol tests, exact ten-command installed-VSIX lifecycle/activation, root typecheck/build, the serial 484-test aggregate with 1 conditional skip and 3 current/hostile conformance tests pass. `evidence/ide-conformance/2026-07-24T135604Z-phase-0-local-staged-review-kiro.json` records 51 implemented, 7 partial and 2 not implemented with three current package digests and zero accepted hosts | Product Owner approved continuous local implementation, not native-Kiro interaction, real staged-provider/package acceptance, feature completion, security review, release or deployment | The shared engine host verifies audit, current revision, exact preview, complete 512-change inventory, write envelope and immutable pre-apply evidence chain. Kiro renders metadata only and uses two cancel-default confirmations; post-apply gates are recorded not assessed and cleanup is not inferred. Native Kiro, real staged-provider/package workflow, Rider/Visual Studio review parity, supported-platform matrices and human acceptance remain |
| 2026-07-24 | Codex | Phase 0 / 1A Rider bounded exact staged review | PLT-01, PLT-05, PLT-12, PLT-19, PLT-24, PLT-27, PLT-29, PLT-31, PLT-35 | No feature status changes | Implementation `e663a29`; conformance evidence `0de1518`; full Rider hostile protocol tests, clean instrumentation/package/structure/prepared-sandbox byte parity, bounded Rider 2025.3 startup, root typecheck/build, the serial 484-test aggregate with 1 conditional skip and 3 current/hostile conformance tests pass. `evidence/ide-conformance/2026-07-24T141405Z-phase-0-local-staged-review-rider.json` records 52 implemented, 7 partial and 1 not implemented with three current package digests and zero accepted hosts | Product Owner approved continuous local implementation, not interactive/native workflow acceptance, real staged-provider/package acceptance, feature completion, security review, release or deployment | The strict Rider client independently verifies one exact Run revision, canonical preview, complete 512-change inventory, exact before/after metadata, write envelope and transition receipt. The asynchronous Product tool window renders metadata only and requires two cancel-default confirmations; post-apply gates are not assessed and cleanup is not inferred. Interactive UI automation, real staged-provider/package workflow, Visual Studio review parity, supported-platform matrices and human acceptance remain |
| 2026-07-24 | Codex | Phase 0 / 1A Kiro package-local engine workflow | PLT-01, PLT-05, PLT-21, PLT-24, PLT-27, PLT-29, PLT-33 | No feature status changes | Implementation `c5b5724`; conformance evidence `b4ba709`; Kiro verify, deterministic engine/extension rebuild hashes, exact seven-file VSIX packaging, isolated prior-version lifecycle and installed-package empty Managed Run evidence workflow, 3 current/hostile conformance checks, root typecheck/build and the serial 484-test aggregate with 1 conditional skip pass. `evidence/ide-conformance/2026-07-24T152609Z-phase-0-local-packaged-engine-kiro.json` preserves 53 implemented, 7 partial and 0 not implemented with three produced packages and zero accepted hosts | Product Owner approved continuous local implementation, not native-Kiro acceptance, real-provider package execution, feature completion, security review, signing, release or deployment | The extension defaults to a deterministic package-local engine module whose exact SHA-256 is embedded in the separately built extension; runtime and module identities are canonically bound and rechecked, inherited provider state is stripped, and no PATH fallback is used. The exact installed workflow returns a private-safe audit-gated empty evidence page without `.gaep` mutation. Native Kiro, real-provider managed read-only/staged-review workflows, interactive cancellation/resume, supported-platform, publisher provenance/signing and human acceptance remain |
| 2026-07-24 | Codex | Phase 0 / 1A VS Code bundled-engine workflow | PLT-01, PLT-05, PLT-21, PLT-24, PLT-27, PLT-29 | No feature status changes | Implementation `0e7364d`; conformance evidence `2e2c65c`; the complete VS Code verification, 12 rendered Product Studio tests, exact installed prior-version lifecycle and bundled-engine empty recovery/evidence workflow, 3 current/hostile conformance checks, root typecheck/build and the serial 484-test aggregate with 1 conditional skip pass. `evidence/ide-conformance/2026-07-24T153620Z-phase-0-local-bundled-engine-vscode.json` preserves 53 implemented, 7 partial and 0 not implemented with three produced packages and zero accepted hosts | Product Owner approved continuous local implementation, not real-provider package execution, feature completion, security review, signing, release or deployment | The exact installed `0.1.0` VSIX invokes its in-process bundled engine through the existing audit-gated recovery command, returns the exact private-safe bounded empty-inventory presentation and leaves the workspace without `.gaep` mutation. Real-provider managed read-only/staged-review package workflows, supported-OS, publisher provenance/signing and human acceptance remain |
| 2026-07-24 | Codex | Phase 0 / 1A Rider package-local engine workflow | PLT-01, PLT-05, PLT-21, PLT-24, PLT-27, PLT-29, PLT-31, PLT-35 | No feature status changes | Implementation `0ec0404`; conformance evidence `bc450e8`; forced uncached Rider tests, deterministic shared-engine build, exact engine/JAR generated-archive-prepared-sandbox parity, package structure, bounded native Rider 2025.3 startup, real strict-client empty evidence workflow, 3 current/hostile conformance checks, root typecheck/build and the serial 484-test aggregate with 1 conditional skip pass. `evidence/ide-conformance/2026-07-24T155633Z-phase-0-local-packaged-engine-rider.json` preserves 53 implemented, 7 partial and 0 not implemented with three produced packages and zero accepted hosts | Product Owner approved continuous local implementation, not plugin-manager/native UI or real-provider package acceptance, feature completion, security review, signing, release or deployment | Rider packages the exact shared engine beside its JAR, compiles the module digest into plugin code, requires an explicit absolute runtime rather than PATH fallback, revalidates runtime/module identities and strips inherited provider credentials. Kiro/Rider engine bytes match. Plugin-manager installation, interactive tool-window packaged-engine invocation, real-provider managed read-only/staged-review workflows, supported-OS, publisher provenance/signing and human acceptance remain |
| 2026-07-24 | Codex | Phase 0 / 1A Visual Studio embedded-engine HostClient workflow | PLT-01, PLT-04, PLT-05, PLT-21, PLT-24, PLT-27, PLT-29, PLT-34 | No feature status changes | Implementation `22591d5`; conformance evidence `6170f51`; zero-warning Visual Studio/HostClient builds, all .NET formatting gates, shell/contribution verification, exact output-DLL embedded-resource digest verification, 163 host checks with a real empty evidence workflow, Rider shared-bundle regression, root typecheck/build, full founder gate and 3 current/hostile conformance checks pass. `evidence/ide-conformance/2026-07-24T161054Z-phase-0-local-packaged-engine-visual-studio.json` preserves 53 implemented, 7 partial and 0 not implemented with three produced packages and zero accepted hosts | Product Owner approved continuous local implementation, not Windows VSIX/install/UI or real-provider package acceptance, feature completion, security review, signing, release or deployment | The HostClient DLL copied to the Visual Studio output embeds the exact shared engine and generated digest, requires one absolute Node-compatible runtime without PATH fallback, rechecks runtime/module identities and strips inherited provider credentials. Windows container/install/activation, rendered Remote UI, installed Windows-package workflow, real-provider managed read-only/staged-review workflows, supported-version, publisher provenance/signing and human acceptance remain |
| 2026-07-24 | Codex | Phase 0 / 1A Visual Studio Windows package lifecycle CI | PLT-34 | `❌ Backlog` -> `🟡 In Progress` | Checkpoint `cbe61de`; four local CI workflow/receipt tests, strict YAML parsing, root `npm run check`, the zero-warning Visual Studio package/HostClient gate and diff validation pass. The immutable-action workflow targets Visual Studio 2022 on `windows-2022`, builds and verifies the native VSIX, performs install/uninstall/reinstall/final-cleanup checks, validates an exact private-safe JSON receipt and uploads only the VSIX plus receipt | Product Owner approved continuous local implementation, not push, workflow publication/execution, Windows acceptance, feature completion, security review, signing, release or deployment | This is a configured and locally validated CI path, not Windows execution evidence. No report exists until the workflow is published and passes; activation, rendered UI, installed engine/provider workflows, supported-version matrix, provenance/signing and human acceptance remain |
| 2026-07-24 | Codex | Phase 0 / 1A canonical offline managed example | PLT-28 | `❌ Backlog` -> `🟡 In Progress` | Implementation `a525a14`; aggregate timing checkpoint `24de329`. Five current/hostile example tests pass. The checked-in scenario traverses real Product, Initiative, Context Pack, resolved Workflow Plan, confirmed Execution Charter, exact preview, managed Run, result, evidence, audit and bounded inventory contracts. Two independent executions preserve exact semantic digest `sha256:751524df05f691e192b744cff2dd46e6ec81e74c45c667e12b93e6dd05e6a113` while retaining distinct generated Run identities. The separately verified bounded receipt is `evidence/examples/2026-07-24T163523Z-phase-0-managed-readonly.json`. After two aggregate-only 5-second timeouts reproduced, only those two I/O-heavy test cases received 15-second test bounds; isolated runs remain about 1.8–2.5 seconds. The final complete Founder gate passes 45 files, 484 tests and 1 conditional skip, 4 CI-contract tests, 5 example tests, 83 documents/868 requirements with zero warnings, and the complete VS Code extension-host/package/lifecycle/bundled-engine workflow | Product Owner approved continuous local implementation and local checkpoint evidence, not real-provider/native-host acceptance, feature completion, security review, release or deployment | The deterministic in-process runtime needs no credential, executable or network and holds no Tool/write authority. The no-overwrite artifact mode preserves an inspectable fixture-local `.gaep` store; raw output, provider thread/turn IDs, paths and source content are excluded from the receipt. Real providers, native IDE interaction/accessibility and human acceptance remain unverified |
| 2026-07-24 | Codex | Phase 0 / 1A isolated Claude staging foundation | PLT-13 | `❌ Backlog` -> `🟡 In Progress` | Implementation `b9f96cf`; aggregate timing checkpoint `f89ce5b`. Twenty-five focused Claude/Codex staging tests, root typecheck and the 45-file aggregate with 488 passed plus 1 conditional skip pass. The SDK proves isolated stage creation, streamed provider events, source non-mutation before exact review, apply, discard, complete portable staging evidence, bounded inputs/outputs, fail-fast durable metadata and provider-neutral rehydration. No live provider request was made | Product Owner approved continuous local implementation and local checkpoint evidence, not credential use, live-provider/native-host acceptance, feature completion, security review, release or deployment | Local Claude Code `2.1.153` advertises the staged flags, but bare mode skips OAuth/keychain reads; the launcher injects no API key or `apiKeyHelper`, and effective higher-priority managed policy is unattested. Production capability truth and engine dispatch remain context-only until the next fail-closed preflight slice is complete |
| 2026-07-24 | Codex | Phase 0 / 1A offline Claude staged-runtime preflight | PLT-07, PLT-13 | No feature status changes | Implementation `09faf49`; unrelated clock-fixture correction `01bb66a`. Five current/hostile preflight tests, root typecheck and the 46-file aggregate with 493 passed plus 1 conditional skip pass. The live offline projection is path/fingerprint-free and reports installed version `2.1.153`, minimum `2.1.208`, 15 verified options, unverified `--max-turns`, and four exact blocker codes without contacting the provider | Product Owner approved continuous local implementation and local diagnostic evidence, not CLI upgrade, credential use, live-provider/native-host acceptance, feature completion, security review, release or deployment | `--help` absence is treated as unverified rather than unavailable. No schema-v1 caller boolean can satisfy authentication or effective administrator-policy attestation, so production adapter truth and engine dispatch remain context-only |

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
