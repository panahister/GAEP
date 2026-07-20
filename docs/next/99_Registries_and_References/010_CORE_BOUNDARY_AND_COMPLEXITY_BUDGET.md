---
id: GAEP-REG-010
title: Core Boundary and Complexity Budget
document_type: registry
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Core Specification Steward
scope: Release-blocking Core boundary, active-contract inventory, size budget, extraction closure, and former-requirement disposition
normative_level: normative
classification: internal
provenance: GAEP pre-implementation Core contraction
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CST-003
  - GAEP-REG-008
  - GAEP-REG-009
  - GAEP-CORE-001
  - GAEP-CORE-003
  - GAEP-CORE-004
  - GAEP-CORE-005
  - GAEP-CORE-006
  - GAEP-CORE-007
  - GAEP-CORE-009
  - GAEP-CORE-010
  - GAEP-CORE-011
  - GAEP-CORE-012
  - GAEP-PROF-010
  - GAEP-PROF-011
  - GAEP-PROF-012
  - GAEP-PROF-016
  - GAEP-PROF-018
  - GAEP-PROF-019
informative_references:
  - ../02_Core_Specification/002_IDENTITY_AND_AUTHORITY_MODEL.md
  - ../02_Core_Specification/008_TRACE_PROVENANCE_AND_SEMANTIC_REGISTRY.md
  - ../03_Profiles/018_EXTENSION_AND_SUPPLY_CHAIN_PROFILE.md
  - ../03_Profiles/019_FEDERATION_PROFILE.md
supersedes: []
---

# Core Boundary and Complexity Budget

## Release-blocking purpose

GAEP Core is the smallest portable semantic kernel required by materially different Profiles and non-AI Realizations. It is not the union of useful governance, AI, provider, workflow-engine, runtime-reliability, marketplace, distribution, adapter, or federation mechanics.

The current working contraction meets the three numeric size budgets: eight active Core contracts, 160 active Core requirement definitions, and no active Core contract above 24 requirements. This is a proposed working-tree architecture result, not a Baseline Set, Approval Determination, semantic-closure result, or implementation authorization. Baseline approval remains blocked by unresolved Core Decisions, proposed extraction targets, authority, exact-revision evidence, independent review, and the other Candidate Baseline Gate conditions.

## Candidate complexity budget

| Budget ID | Measure | Candidate maximum | Current working candidate | Gate result |
|---|---|---:|---:|---|
| `GAEP-CORE-BUDGET-001` | Active Core normative contracts | 8 | 8 | numeric budget met; exact-set and semantic review pending |
| `GAEP-CORE-BUDGET-002` | Active Core normative requirement definitions | 160 | 160 | numeric budget met; disposition and semantic review pending |
| `GAEP-CORE-BUDGET-003` | Active requirements in one Core contract | 24 | 24 | numeric budget met |
| `GAEP-CORE-BUDGET-004` | Canonical Core entity/concept types | 48 | 48 provisional types inventoried below | numeric budget met; Decision closure pending |
| `GAEP-CORE-BUDGET-005` | Unresolved Core Decisions affecting baseline meaning | 0 unless validly approved as non-blocking deferrals | 70 unresolved Decisions; tier and blocking classification maintained in GAEP-REG-009 | baseline blocked |

Counts include only documents whose current candidate `document_type` is `normative-specification`, whose authoring status is not `retired`, and whose location and declared layer are Core. Historical IDs GAEP-CORE-002 and GAEP-CORE-008 are informative retired trace shells. GAEP-CORE-010 and GAEP-CORE-011 retain stable historical IDs but declare `document_type: realization`; their normative requirements are Realization requirements and do not count as Core. This rule prevents directory or identifier history from silently deciding layer ownership.

## Active Core contract inventory

| Active contract | Contract boundary | Active requirements | Maximum result |
|---|---|---:|---|
| GAEP-CORE-001 | Scope, durable subjects, bounded work, Principal, Role Assignment, standing authority eligibility, and scope resolution | 22 | within 24 |
| GAEP-CORE-003 | Governed resource identity, revision, candidate and baseline sets, trace, provenance, semantic registry, and retention | 22 | within 24 |
| GAEP-CORE-004 | Orthogonal state, event, transition, time, invalidation, and rollback semantics | 20 | within 24 |
| GAEP-CORE-005 | Policy, risk, obligation, exception, and non-circular composition invariants | 20 | within 24 |
| GAEP-CORE-006 | Decision, review, Approval, standing-versus-executable authority, and Authorization Grant distinctions | 22 | within 24 |
| GAEP-CORE-007 | Claim, evidence, assurance argument, evaluation, gate, adverse evidence, and invalidation invariants | 18 | within 24 |
| GAEP-CORE-009 | Profile selection, applicability, non-weakening, configuration resolution, manifest, and historical reconstruction | 24 | within 24 |
| GAEP-CORE-012 | Extension non-weakening, compatibility, migration, mapping loss, adapter honesty, and federation no-amplification invariants | 12 | within 24 |

## Extracted and retired source inventory

| Historical document ID | Current layer and status | Current owner | Stable-ID treatment |
|---|---|---|---|
| GAEP-CORE-002 | informative retired contraction source | GAEP-CORE-001 plus declared Profile, Realization, registry, and deferred targets | document and former requirement IDs remain historical; no active normative definition remains in the shell |
| GAEP-CORE-008 | informative retired contraction source | GAEP-CORE-003 plus declared Profile, Realization, adapter, registry, and deferred targets | document and former requirement IDs remain historical; no active normative definition remains in the shell |
| GAEP-CORE-010 | normative Realization contract | capability, workflow, and context Realization owners plus applicable Profiles | document and requirement IDs remain stable but are excluded from Core counts |
| GAEP-CORE-011 | normative Realization contract | runtime, effect, recovery, security, reliability, and incident owners | document and requirement IDs remain stable but are excluded from Core counts |

## Complete initial requirement reconciliation

The 353 requirement definitions in the initial twelve-document Core source set are reconciled without omission or overlap. The categories below are exhaustive and mutually exclusive: a source requirement is either retained in an active Core contract, retained under its stable ID in a reclassified Realization, or omitted from the active tables and represented exactly once in the former-ID disposition register.

| Reconciliation class | Canonical source of exact IDs | Count | Current treatment |
|---|---|---:|---|
| Retained active Core | requirement tables in the eight contracts listed in `## Active Core contract inventory` | 160 | active portable semantic kernel |
| Reclassified with GAEP-CORE-010 | current requirement table in the Capability, Workflow, and Context Realization | 28 | active Realization requirements; not Core |
| Reclassified with GAEP-CORE-011 | current requirement table in the Effect Execution and Runtime Realization | 30 | active Realization requirements; not Core |
| Omitted former Core IDs | exact IDs in `## Requirement disposition register` below | 135 | merged, extracted, or deferred with stable history; not active definitions |
| **Initial Core-source total** | mutually exclusive union of the four classes | **353** | complete reconciliation |

Historical source membership does not make the two Realization classes active Core, and a disposition row does not reactivate a former ID. Any later addition, removal, reclassification, duplicate membership, or missing ID invalidates this reconciliation and requires a new exact-set recount.

## Canonical Core entity inventory

The inventory below is the provisional 48-type Core ceiling. Terms not listed are either controlled classifications, relationship or state values, fields within these records, Profile or Realization concepts, or unresolved candidates. Mention in prose does not silently create a forty-ninth Core type.

| Contract family | Canonical entity/concept types | Count |
|---|---|---:|
| Scope and accountable identity | Managed Asset; Product; Engineering Initiative; Change; Work Item; Workspace; Principal; Role Assignment; Authority Grant | 9 |
| Governed resource, version, trace, provenance | Governed Resource; Resource Lineage; Resource Revision; Candidate Revision Set; Baseline Set; Provenance Record | 6 |
| State, event, transition | State Dimension; State Value; State Record; Transition Record; Event | 5 |
| Policy, risk, obligation | Policy Rule; Policy Set; Policy Binding; Policy Evaluation; Risk Record; Obligation | 6 |
| Decision, review, approval, authorization | Decision Record; Decision Outcome; Review; Approval Requirement; Approval Case; Approval Determination; Authorization Grant | 7 |
| Claim, evidence, assurance | Claim; Evidence Item; Assurance Case; Evaluation Definition; Evaluation Result; Gate Evaluation | 6 |
| Profile and configuration | Profile; Profile Selection Manifest; Base Policy Envelope; Effective Policy Snapshot; Effective Configuration Manifest | 5 |
| Extension, compatibility, federation | Extension; Compatibility Assessment; Mapping Record; Federation Agreement | 4 |
| **Total** |  | **48** |

Organization Scope, Portfolio, Implementation Unit, Recommendation, Review Contribution, Review Finding, Approval Response, Confirmation, Event Envelope, State Snapshot, and similar terms remain expressible as controlled scope kinds, resource or record specializations, interactions, projections, or Profile/Realization concepts. Their exact first-release treatment remains governed by GAEP-REG-009 and cannot be inferred from this inventory.

## Core admission test

A concept or normative requirement belongs in active Core only when all conditions hold:

1. removing it would break a constitutional invariant or make the shared semantic model internally uninterpretable;
2. necessity is demonstrated by at least two materially different Profile families and one non-AI Realization scenario;
3. it cannot be expressed as a Profile obligation, Realization rule, adapter contract, registry entry, scenario, or guidance without weakening the invariant;
4. it is independent of a named provider, tool, marketplace, workflow engine, storage mechanism, protocol, or organizational topology;
5. its owner, exact semantics, states, relationships, negative cases, and conformance evidence are defined;
6. adding it remains within every budget or an approved expiring Complexity Exception explicitly pays the cost.

## Extraction register

`closed-in-working-candidate` means the former Core mechanics have an exact current target and stable-ID disposition. It does not approve or activate the target Profile or Realization. Every target remains Proposed until separately selected, reviewed, approved, or authorized as applicable.

| Extraction ID | Former Core surface | Target and retained Core invariant | Disposition | Accountable role / assignment |
|---|---|---|---|---|
| `GAEP-EXT-001` | `GAEP-IDAUTH-REQ-016`, `GAEP-IDAUTH-REQ-017` | GAEP-AI-REQ-025; AI cannot manufacture authority or accountable approval | closed-in-working-candidate | AI System Authority / unassigned |
| `GAEP-EXT-002` | `GAEP-RESVER-REQ-016` | GAEP-AI-REQ-026 plus GAEP-RESVER-REQ-015; material revision provenance remains attributable | closed-in-working-candidate | GAEP Assurance Authority / unassigned |
| `GAEP-EXT-003` | `GAEP-CWC-REQ-006`, `GAEP-CWC-REQ-007`, `GAEP-CWC-REQ-008`, `GAEP-CWC-REQ-009`, `GAEP-CWC-REQ-010` | GAEP-CORE-010 Realization; executable work remains bound to exact subject, state, scope, authority, and invalidation | closed-in-working-candidate | GAEP Runtime Steward / unassigned |
| `GAEP-EXT-004` | `GAEP-CWC-REQ-013`, `GAEP-CWC-REQ-014`, `GAEP-CWC-REQ-015`, `GAEP-CWC-REQ-016`, `GAEP-CWC-REQ-017`, `GAEP-CWC-REQ-018`, `GAEP-CWC-REQ-019` | GAEP-CORE-010 plus Security and AI Profiles; untrusted input gains no authority and omissions remain visible | closed-in-working-candidate | GAEP Security Authority / unassigned |
| `GAEP-EXT-005` | `GAEP-CWC-REQ-020`, `GAEP-CWC-REQ-021`, `GAEP-CWC-REQ-026` | GAEP-CORE-010, Data Profile, and adapter contracts; external recipients and data effects require exact scope and policy | closed-in-working-candidate | Data and Privacy Authority / unassigned |
| `GAEP-EXT-006` | `GAEP-CWC-REQ-022`, `GAEP-CWC-REQ-023`, `GAEP-CWC-REQ-024`, `GAEP-CWC-REQ-025` | GAEP-CORE-010; missing governed inputs remain explicit and material decisions reconstructable | closed-in-working-candidate | GAEP Runtime Steward / unassigned |
| `GAEP-EXT-007` | `GAEP-EER-REQ-014`, `GAEP-EER-REQ-015`, `GAEP-EER-REQ-016`, `GAEP-EER-REQ-017`, `GAEP-EER-REQ-022` | GAEP-CORE-011 and Operational Reliability Profile; duplicate or uncertain effects cannot be reported or repeated as safe | closed-in-working-candidate | Operational Authority / unassigned |
| `GAEP-EXT-008` | `GAEP-EER-REQ-018`, `GAEP-EER-REQ-019`, `GAEP-EER-REQ-020`, `GAEP-EER-REQ-021`, `GAEP-EER-REQ-026`, `GAEP-EER-REQ-027`, `GAEP-EER-REQ-028`, `GAEP-EER-REQ-029` | GAEP-CORE-011 and Incident Profile; partial and uncertain effects remain visible, contained, and reauthorized before resume | closed-in-working-candidate | Incident and Continuity Authority / unassigned |
| `GAEP-EXT-009` | `GAEP-EER-REQ-023`, `GAEP-EER-REQ-024`, `GAEP-EER-REQ-025` | GAEP-CORE-011, Runtime Realization, and Security Profile; constrained actors cannot change their own controls or credentials | closed-in-working-candidate | GAEP Security Authority / unassigned |
| `GAEP-EXT-010` | former `GAEP-ECF-REQ-001`, `GAEP-ECF-REQ-002`, `GAEP-ECF-REQ-004`, `GAEP-ECF-REQ-005`, `GAEP-ECF-REQ-006`, `GAEP-ECF-REQ-007`, `GAEP-ECF-REQ-008`, `GAEP-ECF-REQ-009`, `GAEP-ECF-REQ-010` | GAEP-PROF-018; presence, integrity, installation, certification, or listing never implies trust, approval, activation, or authorization | closed-in-working-candidate | GAEP Distribution and Ecosystem Owner / unassigned |
| `GAEP-EXT-011` | former/current `GAEP-ECF-REQ-011` through `GAEP-ECF-REQ-020` as individually disposed below | portable compatibility and loss invariants retained in GAEP-CORE-012; negotiation mechanics move to adapters | split-and-closed-in-working-candidate | GAEP Integration Steward / unassigned |
| `GAEP-EXT-012` | former/current `GAEP-ECF-REQ-021` through `GAEP-ECF-REQ-029` as individually disposed below | no authority amplification retained in GAEP-CORE-012; federation mechanics move to GAEP-PROF-019 | split-and-closed-in-working-candidate | Organizational Trust Authority / unassigned |
| `GAEP-EXT-013` | `GAEP-ECF-OD-007` and marketplace language | Deferred Capability Register and GAEP-EXTSUP-REQ-010; marketplace presence cannot imply GAEP approval or authority | deferred-out-of-core; Decision remains open | GAEP Distribution and Ecosystem Owner / unassigned |

## Requirement disposition register

Every former active Core requirement omitted by the contracted tables appears exactly once below. `merged` means its portable invariant is covered by the named retained requirements; `extracted` means its mechanics are owned by a named Profile, Realization, adapter, or registry; `deferred` means no current normative obligation is activated. Former IDs remain historical references and must not be treated as active requirements.

| Disposition ID | Exact former requirement IDs | Classification and target | Retained invariant / current reference | Stable-ID status |
|---|---|---|---|---|
| GAEP-RD-001 | `GAEP-SCOPE-REQ-008` | merged into Core | parent/child structure grants no implicit authority | GAEP-SCOPE-REQ-009 | retired-former-id |
| GAEP-RD-002 | `GAEP-SCOPE-REQ-010`, `GAEP-SCOPE-REQ-011` | extracted to Architecture Profile and type/relationship registries; exact facets await GAEP-SCOPE-OD-003 | implementation topology is not portable scope identity | no active replacement pending Decision |
| GAEP-RD-003 | `GAEP-SCOPE-REQ-012` | extracted to Federation Profile | distinct domains and no authority amplification | GAEP-ECF-REQ-022, GAEP-ECF-REQ-023, GAEP-FED-REQ-001 |
| GAEP-RD-004 | `GAEP-SCOPE-REQ-019`, `GAEP-SCOPE-REQ-020` | merged into Core and conformance boundary | storage or location is not identity; exact governed scope remains explicit | GAEP-SCOPE-REQ-001, GAEP-SCOPE-REQ-024 |
| GAEP-RD-005 | `GAEP-SCOPE-REQ-022` | merged into resource, state, and trace history | historical interpretation remains reconstructable | GAEP-RESVER-REQ-015, GAEP-STATE-REQ-017, GAEP-TPS-REQ-024 |
| GAEP-RD-006 | `GAEP-SCOPE-REQ-023` | merged into Profile contract | a Profile cannot collapse or redefine a Core subject | GAEP-PCR-REQ-003, GAEP-PCR-REQ-004 |
| GAEP-RD-007 | `GAEP-IDAUTH-REQ-002`, `GAEP-IDAUTH-REQ-003`, `GAEP-IDAUTH-REQ-007` | merged into accountable-identity and action-time rules | every material action remains attributable to an exact Principal and effective authority | GAEP-IDAUTH-REQ-001, GAEP-IDAUTH-REQ-004, GAEP-IDAUTH-REQ-006, GAEP-DRAA-REQ-025 |
| GAEP-RD-008 | `GAEP-IDAUTH-REQ-010`, `GAEP-IDAUTH-REQ-011` | merged into authority resolution | eligibility is exact, scoped, time-valid, and not executable permission | GAEP-IDAUTH-REQ-008, GAEP-IDAUTH-REQ-009 |
| GAEP-RD-009 | `GAEP-IDAUTH-REQ-012`, `GAEP-IDAUTH-REQ-013`, `GAEP-IDAUTH-REQ-014`, `GAEP-IDAUTH-REQ-015` | merged into Role Assignment, source-grant non-amplification, and Core prose | delegation cannot exceed source or transfer accountability | GAEP-IDAUTH-REQ-006, GAEP-DRAA-REQ-024 |
| GAEP-RD-010 | `GAEP-IDAUTH-REQ-016`, `GAEP-IDAUTH-REQ-017` | extracted to AI System Profile | AI cannot self-escalate or self-approve | GAEP-AI-REQ-025 |
| GAEP-RD-011 | `GAEP-IDAUTH-REQ-018` | extracted to Security/Assurance Profiles and open identity-assurance Decision | material authority requires declared assurance and explicit unresolved results | GAEP-IDAUTH-REQ-008, GAEP-IDAUTH-OD-001 |
| GAEP-RD-012 | `GAEP-IDAUTH-REQ-019` | extracted to Security Profile | raw credentials do not become governed authority content | GAEP-SEC-REQ-007 |
| GAEP-RD-013 | `GAEP-IDAUTH-REQ-020`, `GAEP-IDAUTH-REQ-021` | extracted to role registry and operating guidance | effective membership and ownership changes remain attributable | GAEP-ROLE-REQ-006 and future assignment lifecycle guidance |
| GAEP-RD-014 | `GAEP-IDAUTH-REQ-022` | extracted to Emergency Operational Change Profile | emergency authority remains explicit, bounded, reviewed, and expiring | GAEP-PROF-005 |
| GAEP-RD-015 | `GAEP-IDAUTH-REQ-023` | extracted to Federation Profile | cross-domain authority is mapped and cannot amplify | GAEP-FED-REQ-001, GAEP-FED-REQ-002, GAEP-ECF-REQ-022, GAEP-ECF-REQ-023 |
| GAEP-RD-016 | `GAEP-IDAUTH-REQ-024`, `GAEP-IDAUTH-REQ-025`, `GAEP-IDAUTH-REQ-026`, `GAEP-IDAUTH-REQ-027`, `GAEP-IDAUTH-REQ-028` | merged or extracted to resource, adapter, evidence, state, and role registry contracts | exact validity, provider mapping limits, evidence, invalidation, and controlled values remain explicit | GAEP-RESVER-REQ-006, GAEP-CAE-REQ-005, GAEP-STATE-REQ-024, GAEP-TPS-REQ-015, GAEP-REG-008 |
| GAEP-RD-017 | `GAEP-RESVER-REQ-012` | merged into Candidate Revision Set semantics | membership is versioned independently from resource revision identity | GAEP-RESVER-REQ-009, GAEP-RESVER-REQ-010 |
| GAEP-RD-018 | `GAEP-RESVER-REQ-014` | merged into orthogonal state semantics | supersession, validity, freshness, retention, and approval remain separate | GAEP-STATE-REQ-002, GAEP-STATE-REQ-019 |
| GAEP-RD-019 | `GAEP-RESVER-REQ-016` | extracted to AI System Profile | material AI provenance remains attributable and version-bound | GAEP-AI-REQ-026, GAEP-RESVER-REQ-015 |
| GAEP-RD-020 | `GAEP-RESVER-REQ-017`, `GAEP-RESVER-REQ-018` | merged into trace/provenance history | derivation, loss, and view/source separation remain explicit | GAEP-TPS-REQ-009, GAEP-TPS-REQ-010, GAEP-TPS-REQ-024 |
| GAEP-RD-021 | `GAEP-RESVER-REQ-019`, `GAEP-RESVER-REQ-020`, `GAEP-RESVER-REQ-021` | extracted to External Mapping Adapter and compatibility Core | external authority, mutable-source limits, and representation migration remain explicit | GAEP-ADAPT-004, GAEP-ECF-REQ-016, GAEP-ECF-REQ-017 |
| GAEP-RD-022 | `GAEP-RESVER-REQ-022`, `GAEP-RESVER-REQ-023` | extracted to Data/Records and Audit Profiles | classification and authorized disposal retain required history without defaulting public | GAEP-DATA-REQ-003, GAEP-DATA-REQ-004, GAEP-AUDIT-REQ-006 |
| GAEP-RD-023 | `GAEP-RESVER-REQ-024`, `GAEP-RESVER-REQ-025`, `GAEP-RESVER-REQ-026` | merged into registry and fail-explicit compatibility invariants | controlled namespaces and unsupported semantics remain explicit | GAEP-TPS-REQ-015, GAEP-ECF-REQ-013, GAEP-ECF-REQ-017 |
| GAEP-RD-024 | `GAEP-RESVER-REQ-027`, `GAEP-RESVER-REQ-028`, `GAEP-RESVER-REQ-029`, `GAEP-RESVER-REQ-030` | merged into candidate-set, approval, and baseline-gate contracts | candidate identity is not authority; proposal and determination bind one exact set revision | GAEP-RESVER-REQ-008, GAEP-RESVER-REQ-009, GAEP-RESVER-REQ-010, GAEP-RESVER-REQ-011, GAEP-DRAA-REQ-014, GAEP-DRAA-REQ-018, GAEP-DRAA-REQ-020 |
| GAEP-RD-025 | `GAEP-STATE-REQ-013`, `GAEP-STATE-REQ-014`, `GAEP-STATE-REQ-015` | extracted to workflow/execution Realizations | ordering, duplicate delivery, and retry are Realization mechanics constrained by explicit state | GAEP-CORE-010, GAEP-CORE-011 |
| GAEP-RD-026 | `GAEP-STATE-REQ-022` | merged into Profile non-weakening and unsupported-state rules | Profiles cannot silently rename or weaken Core state meaning | GAEP-PCR-REQ-003, GAEP-PCR-REQ-004, GAEP-STATE-REQ-023 |
| GAEP-RD-027 | `GAEP-STATE-REQ-025` | extracted to Data and Audit Profiles | sensitive payload handling preserves required identity, attribution, and integrity | GAEP-DATA-REQ-002, GAEP-DATA-REQ-003, GAEP-AUDIT-REQ-002 |
| GAEP-RD-028 | `GAEP-STATE-REQ-026` | extracted to execution Realization | uncertain external outcomes cannot be success | GAEP-EER-REQ-012, GAEP-EER-REQ-013 |
| GAEP-RD-029 | `GAEP-STATE-REQ-027`, `GAEP-STATE-REQ-028`, `GAEP-STATE-REQ-029`, `GAEP-STATE-REQ-030` | merged into orthogonal state invariant and state registry | authoring, baseline, obligation, decision, approval, and authorization dimensions remain separate | GAEP-STATE-REQ-002, GAEP-REG-007 |
| GAEP-RD-030 | `GAEP-POLICY-REQ-002`, `GAEP-POLICY-REQ-003`, `GAEP-POLICY-REQ-004` | moved to policy/action/effect registries and Profile-defined algorithms | exact policy identity, inputs, outcomes, and fail-explicit behavior remain Core | GAEP-POLICY-REQ-001, GAEP-POLICY-REQ-005, GAEP-POLICY-REQ-006 |
| GAEP-RD-031 | `GAEP-POLICY-REQ-011`, `GAEP-POLICY-REQ-012` | merged into exact policy evaluation and composition trace | exact sources, results, and profile contributions remain reconstructable | GAEP-POLICY-REQ-005, GAEP-POLICY-REQ-030, GAEP-TPS-REQ-009 |
| GAEP-RD-032 | `GAEP-POLICY-REQ-015`, `GAEP-POLICY-REQ-018` | extracted to risk and AI Profiles | methods remain explicit and AI confidence is not Risk Acceptance | GAEP-POLICY-REQ-016, GAEP-POLICY-REQ-017, GAEP-PROF-012 |
| GAEP-RD-033 | `GAEP-POLICY-REQ-021`, `GAEP-POLICY-REQ-023`, `GAEP-POLICY-REQ-024`, `GAEP-POLICY-REQ-026` | merged into obligation evidence and exception lifecycle | closure, waiver, overdue consequence, and no-precedent behavior remain governed | GAEP-POLICY-REQ-019, GAEP-POLICY-REQ-022, GAEP-POLICY-REQ-025, GAEP-POLICY-REQ-027 |
| GAEP-RD-034 | `GAEP-POLICY-REQ-028` | extracted to Data and Audit Profiles | protected payloads retain sufficient governed identity and outcome evidence | GAEP-DATA-REQ-003, GAEP-AUDIT-REQ-002 |
| GAEP-RD-035 | `GAEP-DRAA-REQ-002` | moved to Decision guidance and merged into material Decision record | a Recommendation cannot silently become a Decision or authority | GAEP-DRAA-REQ-003, GAEP-DRAA-REQ-004 |
| GAEP-RD-036 | `GAEP-DRAA-REQ-007`, `GAEP-DRAA-REQ-021` | merged into exact revision and invalidation rules | material subject or basis change reopens dependent approval and authorization | GAEP-DRAA-REQ-020, GAEP-STATE-REQ-024 |
| GAEP-RD-037 | `GAEP-DRAA-REQ-010`, `GAEP-DRAA-REQ-011`, `GAEP-DRAA-REQ-012` | extracted to Assurance and Audit Profiles | findings remain attributable, independently stated, and authority-bound for disposition | GAEP-CAE-REQ-024, GAEP-AUDIT-REQ-009 |
| GAEP-RD-038 | `GAEP-DRAA-REQ-016` | extracted to AI System Profile | AI cannot provide accountable human approval | GAEP-AI-REQ-025 |
| GAEP-RD-039 | `GAEP-DRAA-REQ-019` | merged into obligation contract | conditional approval creates explicit enforceable obligations | GAEP-POLICY-REQ-020 |
| GAEP-RD-040 | `GAEP-DRAA-REQ-027`, `GAEP-DRAA-REQ-028` | extracted to execution Realization | Confirmation binds the exact effect but creates no missing Approval or authority | GAEP-EER-REQ-009, GAEP-EER-REQ-010 |
| GAEP-RD-041 | `GAEP-DRAA-REQ-030`, `GAEP-DRAA-REQ-031` | extracted to owner-role registry and approval Profiles | role concentration and conflicts are disclosed and separately evaluated | GAEP-ROLE-REQ-004, GAEP-SELF-009 |
| GAEP-RD-042 | `GAEP-DRAA-REQ-032` | extracted to Federation and Audit Profiles | offline or cross-domain approval preserves exact identity, subject, time, authority, and integrity | GAEP-FED-REQ-001, GAEP-AUDIT-REQ-002 |
| GAEP-RD-043 | `GAEP-DRAA-REQ-034` | merged into executable-grant non-substitution | only an exact current Authorization Grant permits commitment | GAEP-DRAA-REQ-029, GAEP-DRAA-REQ-035 |
| GAEP-RD-044 | `GAEP-DRAA-REQ-037` | merged into orthogonal state invariant | Decision lifecycle, outcome, and effectiveness remain separate | GAEP-STATE-REQ-002 |
| GAEP-RD-045 | `GAEP-DRAA-REQ-038` | merged into Review/Evaluation and assurance-result trace | Review conclusion exposes exact accepted, omitted, stale, conflicting, and insufficient inputs | GAEP-DRAA-REQ-036, GAEP-CAE-REQ-024 |
| GAEP-RD-046 | `GAEP-CAE-REQ-011`, `GAEP-CAE-REQ-012`, `GAEP-CAE-REQ-015` | extracted to Assurance and AI Profiles | independence and probabilistic limitations are Profile obligations | GAEP-PROF-009, GAEP-AI-REQ-007 |
| GAEP-RD-047 | `GAEP-CAE-REQ-021` | extracted to Data Profile | sensitive evidence remains minimized and governed | GAEP-DATA-REQ-002, GAEP-DATA-REQ-003, GAEP-DATA-REQ-004 |
| GAEP-RD-048 | `GAEP-CAE-REQ-022` | merged into trace/provenance | summaries preserve source paths and disclose loss | GAEP-TPS-REQ-009, GAEP-TPS-REQ-010 |
| GAEP-RD-049 | `GAEP-CAE-REQ-023` | extracted to Audit and Security Profiles | evidence integrity is protected from the evaluated subject as required by consequence | GAEP-AUDIT-REQ-005, GAEP-SEC-REQ-004 |
| GAEP-RD-050 | `GAEP-CAE-REQ-025` | merged into constitutional conformance contract | conformance remains exact, evidence-bound, and deviation-honest | GAEP-CST-003 and applicable Profile conformance requirements |
| GAEP-RD-051 | `GAEP-CAE-REQ-026`, `GAEP-CAE-REQ-027`, `GAEP-CAE-REQ-028`, `GAEP-CAE-REQ-029` | merged into Review/Evaluation boundary and Assurance Profile | evaluation, review, findings, approval, and authorization remain distinct and traceable | GAEP-DRAA-REQ-036, GAEP-CAE-REQ-024, GAEP-PROF-009 |
| GAEP-RD-052 | `GAEP-TPS-REQ-001`, `GAEP-TPS-REQ-003`, `GAEP-TPS-REQ-008` | merged into resource identity and trace fitness | exact identity, mutable resolution, and semantic verification remain explicit | GAEP-RESVER-REQ-001, GAEP-RESVER-REQ-007, GAEP-TPS-REQ-007 |
| GAEP-RD-053 | `GAEP-TPS-REQ-011`, `GAEP-TPS-REQ-012` | extracted to AI provenance | provider/model uncertainty remains visible and attributable | GAEP-AI-REQ-026 |
| GAEP-RD-054 | `GAEP-TPS-REQ-013`, `GAEP-TPS-REQ-014` | extracted to External Mapping Adapter | external authority, snapshots, synchronization, and local representation remain distinct | GAEP-ADAPT-004, GAEP-TPS-REQ-005, GAEP-TPS-REQ-009 |
| GAEP-RD-055 | `GAEP-TPS-REQ-016`, `GAEP-TPS-REQ-017`, `GAEP-TPS-REQ-018` | moved to terminology/state registries and merged into registry history | aliases, conflicts, retirement, and reuse remain versioned and fail explicit | GAEP-TPS-REQ-015, GAEP-TPS-REQ-024, GAEP-STATE-REQ-023 |
| GAEP-RD-056 | `GAEP-TPS-REQ-019`, `GAEP-TPS-REQ-020`, `GAEP-TPS-REQ-021` | extracted to relationship registry and conformance scenarios | impact traversal uses typed semantics and absence is not proof | GAEP-REG-006 and scenario evidence |
| GAEP-RD-057 | `GAEP-TPS-REQ-022`, `GAEP-TPS-REQ-023` | extracted to Data, Security, and Audit Profiles | classification and integrity remain governed by consequence | GAEP-DATA-REQ-003, GAEP-SEC-REQ-004, GAEP-AUDIT-REQ-005 |
| GAEP-RD-058 | `GAEP-TPS-REQ-025` | merged into constitutional and Profile conformance contracts | unresolved or external semantics remain disclosed | GAEP-CST-003 and applicable Profile conformance requirements |
| GAEP-RD-059 | `GAEP-PCR-REQ-018`, `GAEP-PCR-REQ-019` | merged into policy exception validity and Profile non-weakening | invalid or repeated exceptions remain visible and non-permissive | GAEP-POLICY-REQ-027, GAEP-PCR-REQ-017 |
| GAEP-RD-060 | `GAEP-PCR-REQ-022` | extracted to Data Profile | classification and recipient constraints prevent incompatible flow | GAEP-DATA-REQ-003 |
| GAEP-RD-061 | `GAEP-PCR-REQ-023` | merged into constitutional and Profile conformance contracts | conformance binds exact effective configuration and deviations | GAEP-CST-003 and applicable Profile conformance requirements |
| GAEP-RD-062 | `GAEP-PCR-REQ-024` | extracted to resolver Realization | equivalent inputs are deterministic or disclose governed nondeterminism | future resolver conformance contract; no implementation authorized |
| GAEP-RD-063 | `GAEP-ECF-REQ-001`, `GAEP-ECF-REQ-002`, `GAEP-ECF-REQ-004`, `GAEP-ECF-REQ-005`, `GAEP-ECF-REQ-006`, `GAEP-ECF-REQ-007`, `GAEP-ECF-REQ-008`, `GAEP-ECF-REQ-009`, `GAEP-ECF-REQ-010` | extracted to Extension and Supply-Chain Profile | exact identity, non-weakening, no ambient authority, explicit activation, and revocation remain normative outside Core | GAEP-EXTSUP-REQ-001 through GAEP-EXTSUP-REQ-009 as individually defined |
| GAEP-RD-064 | `GAEP-ECF-REQ-019` | extracted to adapter negotiation contracts | unsupported required semantics fail explicitly | GAEP-ECF-REQ-013, GAEP-ADAPT-001, GAEP-ADAPT-004 |
| GAEP-RD-065 | `GAEP-ECF-REQ-021`, `GAEP-ECF-REQ-024`, `GAEP-ECF-REQ-025`, `GAEP-ECF-REQ-026`, `GAEP-ECF-REQ-027`, `GAEP-ECF-REQ-028`, `GAEP-ECF-REQ-029` | extracted to Federation Profile | exact agreement, mapping, policy, data, partition, revocation, reconciliation, and exit mechanics remain normative outside Core | GAEP-FED-REQ-001 through GAEP-FED-REQ-007 as individually defined |
| GAEP-RD-066 | `GAEP-ECF-REQ-030` | extracted to Extension and Federation Profile conformance | conformance discloses versions, unsupported semantics, deviations, assumptions, and evidence | GAEP-PROF-018 and GAEP-PROF-019 conformance contracts |

## Complexity Exception

A Complexity Exception is an approved architecture Decision Record binding one exact exceeded budget and Candidate Revision Set revision. It identifies the retained concept, admission evidence, added cost, consolidation offset, owner, expiry, review trigger, dissent, alternatives, and exact Approval Determination. It cannot be standing, silent, inherited, or renewed automatically.

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-BOUNDARY-REQ-001 | The candidate-baseline gate SHALL calculate every budget from the exact Candidate Revision Set revision and SHALL block approval while any budget is exceeded, unresolved, or calculated from mutable inputs. | Exact-set budget calculation |
| GAEP-BOUNDARY-REQ-002 | A Core concept or requirement SHALL satisfy every Core admission-test condition or SHALL be extracted before baseline approval. | Admission-evidence review |
| GAEP-BOUNDARY-REQ-003 | A provider-, AI-, workflow-engine-, retry-, marketplace-, distribution-, adapter-, or federation-specific mechanic SHALL NOT remain normative Core merely because several current documents use it. | Mechanic-specificity review |
| GAEP-BOUNDARY-REQ-004 | Extraction SHALL preserve the minimal constitutional invariant, exact trace from former requirement IDs to target contracts, migration disposition, and conformance impact. | Extraction trace audit |
| GAEP-BOUNDARY-REQ-005 | Every extraction row SHALL close through exact target contract revisions and revised Core requirements before the candidate-baseline gate can pass. | Extraction-closure validation |
| GAEP-BOUNDARY-REQ-006 | A Complexity Exception SHALL bind one exact exceeded budget and Candidate Revision Set revision, SHALL satisfy the declared evidence fields, SHALL expire, and SHALL NOT authorize unrelated budget excess. | Exception-scope review |
| GAEP-BOUNDARY-REQ-007 | Open Decisions affecting the Core boundary SHALL be reconciled with GAEP-REG-009 and SHALL either close or receive an approved non-blocking deferral before baseline approval. | Open-decision boundary crosswalk |
| GAEP-BOUNDARY-REQ-008 | Core reduction SHALL NOT collapse Authority Grant with Authorization Grant, Review with Evaluation, Candidate Revision Set with Baseline Set, durable subject with bounded work, or orthogonal state dimensions. | Semantic-preservation negative tests |
| GAEP-BOUNDARY-REQ-009 | Current counts, active-layer classification, entity inventory, and extraction dispositions SHALL be regenerated after every material Core revision; stale counts SHALL block the gate. | Change-triggered recount |
| GAEP-BOUNDARY-REQ-010 | Passing the complexity budget SHALL NOT by itself establish semantic completeness, approval, conformance, implementation readiness, security, or fitness for use. | Budget-inference negative test |
| GAEP-BOUNDARY-REQ-011 | Every former Core requirement omitted from the active contract tables SHALL have exactly one disposition entry with exact source ID, target or retained invariant, stable-ID treatment, conformance effect, owner, and Decision status. | Requirement-disposition completeness check |
| GAEP-BOUNDARY-REQ-012 | A document with a historical `GAEP-CORE-*` ID SHALL count as active Core only when its declared document type, status, normative level, and layer make it an active Core normative contract; path or identifier history alone SHALL NOT determine layer. | Active-layer classification check |
| GAEP-BOUNDARY-REQ-013 | The candidate validator SHALL reconcile all 353 initial Core-source requirement IDs into exactly one of retained active Core, current GAEP-CORE-010 or GAEP-CORE-011 Realization, or former-ID disposition, and SHALL fail on any overlap, omission, or stale category count. | Exhaustive source-requirement partition check |

## Current gate result

`numeric-budget-pass; baseline-blocked` — the working candidate meets the four numeric ceilings, but this mutable working tree is not an exact Candidate Revision Set and unresolved Core Decisions, decision effectiveness, authority, independent review, Profile applicability, target acceptance, scenario evidence, migration approval, and other Candidate Baseline Gate conditions remain open.
