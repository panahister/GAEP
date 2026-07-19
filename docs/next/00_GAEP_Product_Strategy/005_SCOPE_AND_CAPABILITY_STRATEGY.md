---
id: GAEP-STR-005
title: Scope and Capability Strategy
document_type: product-strategy
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Product Owner
scope: GAEP product boundaries, capability placement, first-horizon cut, and scope governance
normative_level: mixed
classification: internal
provenance: GAEP pre-implementation product restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CST-001
  - GAEP-CST-003
informative_references:
  - ../../02_Platform/010_PLATFORM_ARCHITECTURE.md
  - ../../03_Product_Engineering/020_PACKAGE_STRATEGY.md
  - ../../06_Roadmap/050_PLATFORM_ROADMAP.md
supersedes: []
---

# Scope and Capability Strategy

## Status and purpose

This Proposed strategy defines where a GAEP capability belongs and how the first useful scope is selected. It does not approve an implementation architecture, technology, service boundary, deployment topology, runtime, interface, or release.

The main scope risk is treating the complete engineering lifecycle as the minimum product. GAEP must preserve a broad conceptual model without requiring every possible capability before it has proven one useful workflow.

## Product composition

### GAEP Core

Core contains only semantics and invariants that must remain stable across conforming profiles, workspaces, realizations, and adapters. Candidate Core subjects include:

- subject and resource identity;
- actor, role, authority, delegation, and scope;
- authoritative source and organizational binding;
- claim, assumption, unknown, conflict, and evidence;
- decision, approval, condition, exception, and risk acceptance;
- state, transition, validity, freshness, supersession, and retention;
- change intent, impact, trace, obligation, and outcome;
- applicability, policy resolution, and conformance;
- execution effect, authorization, stop, recovery, and evidence semantics.

Core is not a collection of every lifecycle artifact. A concept belongs in Core only if changing its meaning across profiles would make conformance, portability, or accountability unreliable.

### Profiles

Profiles specialize obligations for a declared context. Candidate profile dimensions include:

- lifecycle or initiative type;
- risk and consequence;
- assurance depth;
- security, privacy, records, and regulated constraints;
- AI-system participation;
- operational and release consequence;
- organizational structure.

A profile may add obligations, select variation points, and mark non-applicable optional capability. It may not silently redefine Core meaning.

### Workspaces

A workspace is a portable governed view of an initiative or other scope. It may contain GAEP-native records and references to external authorities. It is not necessarily one repository, directory, database, product, or runtime instance.

### Realizations

A realization implements or manually performs GAEP semantics. Candidate forms may include documented procedures, repository conventions, local tools, shared services, or other architectures. No form is selected here.

### Adapters

Adapters translate between GAEP and an external system or execution provider. They must declare capability, authority, loss, conflict, synchronization, security, and recovery behavior. Integration availability does not move the external system into Core.

### Guides, examples, and scenarios

These explain use and verification. They are informative unless a normative specification explicitly owns a referenced requirement. A convenient example must not become a universal obligation.

## Candidate first-horizon product

The first horizon should prove one complete human outcome: a material engineering change can move from bounded intent to an accountable decision-ready and, if approved, baselined state with portable evidence.

### Required first-horizon capabilities

The candidate minimum includes:

1. product identity, owner, scope, non-goals, and evidence model;
2. constitutional invariants and conformance language;
3. identity of governed subjects, actors, roles, and authorities;
4. authoritative-source and organizational-binding semantics;
5. claim, evidence, uncertainty, and conflict representation;
6. change intent, impact, decision, approval, and state semantics;
7. applicability and one or more minimal risk/lifecycle profiles;
8. a portable workspace contract or manual representation;
9. a reviewable change and evidence package;
10. a manual or reference workflow for the selected pilot;
11. negative and recovery scenarios;
12. value, burden, trust, portability, and cost measurement;
13. GAEP-on-GAEP use and at least one independent initiative.

The list is a candidate dependency set, not an approval to build all items simultaneously.

## Candidate governed-change capability map

Every disposition in this table is a candidate recommendation, not an approved Decision Outcome or roadmap commitment. The capability set and all deferrals require disposition through `GAEP-DEC-016`; the no-AI/manual-path recommendation also requires `GAEP-DEC-009`, and any AI autonomy selection requires `GAEP-DEC-015`.

| Capability | First-horizon disposition | Rationale |
|---|---|---|
| Declare change, owner, subject, scope, outcome, and risk | Essential | Defines the job boundary |
| Resolve authoritative sources and applicable bindings | Essential | Prevents ungrounded context |
| Record claims, assumptions, conflicts, unknowns, and evidence | Essential | Makes uncertainty reviewable |
| Identify affected resources and obligations | Essential | Supports material impact review |
| Present meaningful delta and alternatives | Essential | Supports human attention and decision |
| Record review, approval, rejection, conditions, or deferral | Essential | Preserves accountability |
| Baseline, supersede, invalidate, and reopen | Essential | Supports controlled evolution |
| Preserve portable trace and evidence manifest | Essential | Tests the portability proposition |
| Deterministic validation | Conditionally essential | Required where a rule can be tested without implementation-specific reasoning |
| AI analysis or drafting | Optional for semantic validation | GAEP must be understandable without trusting one provider |
| Read-only external references | Conditional | Needed only for selected pilot authorities |
| External write or synchronization | Deferred | Higher recovery, conflict, and authorization risk |
| Production action | Excluded | No pre-implementation authorization |
| Multi-agent orchestration | Deferred | Does not prove first-user value |
| Cross-repository graph service | Deferred | Graph semantics can be tested without selecting storage |
| Universal graphical control plane | Deferred | User experience must be discovered first |
| Marketplace and third-party certification | Deferred | Requires distribution and ecosystem decisions |
| Autonomous approval or risk acceptance | Prohibited | Conflicts with human accountability |

`Deferred` means “recommended for deferral pending decision,” not “approved for a later release.” No date, funding, implementation commitment, or entitlement follows from this table.

## Source-of-truth placement

Every selected workflow must classify each relevant resource as one of:

| Placement | Meaning |
|---|---|
| GAEP-native authority | GAEP owns the governed record for the declared scope |
| External authority | Another approved system owns the resource; GAEP retains a stable reference and necessary governance metadata |
| Derived view | GAEP materializes a reproducible view with source, derivation, and freshness |
| Temporary migration copy | Duplication is time-bounded, owned, reconciled, and has an exit condition |
| Working material | Provisional content has no authoritative standing |
| Not represented | The resource is out of scope or not applicable |

No product promise should depend on silent bidirectional synchronization.

## Scope-selection tests

A capability candidate should be included only when reviewers can answer:

1. Which validated user job or constitutional requirement does it serve?
2. Why is existing practice or an external capability insufficient?
3. Does it belong in Core, a profile, a workspace, a realization, an adapter, or guidance?
4. What is the smallest coherent form that produces evidence?
5. What new authority, privacy, security, operational, and maintenance burden does it create?
6. How will its value and burden be measured?
7. Can it be deferred or removed without invalidating the first workflow?
8. What migration or compatibility obligation would its contract create?

An answer of “the complete platform will eventually need it” is insufficient.

## First-horizon profiles to evaluate

The exact profiles remain open. A minimum evidence set should cover:

- one low- or moderate-risk profile that demonstrates proportionate burden;
- one material-change profile requiring meaningful review and approval;
- one Product case;
- one non-Product case;
- one provider-independent or no-AI execution path;
- one provider-substitution or adapter-loss scenario.

This does not require six separate implementations. A small number of manual scenarios may cover several dimensions.

## Capabilities explicitly outside Core

Unless a later approved decision demonstrates otherwise, the following are not Core semantics:

- programming languages and framework choices;
- database, graph, search, or messaging technology;
- model and agent provider behavior;
- repository host, backlog, design, assurance, delivery, and operational vendor models;
- user-interface layout;
- organizational job titles;
- one architecture style or test methodology;
- one document or folder structure;
- pricing, licensing, certification, and support packaging;
- domain-specific artifact templates.

Core may define contracts needed to govern these choices without selecting them.

## Scope governance requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-STR-SCP-REQ-001 | Every capability proposal SHALL identify its user job or constitutional requirement, owner, scope, placement, evidence state, dependencies, burden, risk, and exit path. | Capability-decision review |
| GAEP-STR-SCP-REQ-002 | Core SHALL contain only semantics whose stable cross-profile meaning is necessary for governance, conformance, portability, or accountability. | Core-boundary review |
| GAEP-STR-SCP-REQ-003 | A lifecycle-, vendor-, organization-, or technology-specific concept SHALL NOT enter Core solely because it appears in an early example or pilot. | Dependency and terminology review |
| GAEP-STR-SCP-REQ-004 | A first-horizon capability SHALL produce evidence for the selected workflow or SHALL be deferred. | Scope-to-experiment trace |
| GAEP-STR-SCP-REQ-005 | A scope increase SHALL identify the existing capability, activity, or uncertainty it displaces and its incremental operating burden. | Change-impact review |
| GAEP-STR-SCP-REQ-006 | External authoritative resources SHALL remain external when reference and conformance satisfy the user job; GAEP SHALL NOT duplicate them by default. | Authority-placement review |
| GAEP-STR-SCP-REQ-007 | Deferred capability SHALL NOT be represented as committed roadmap scope. | Roadmap and messaging audit |
| GAEP-STR-SCP-REQ-008 | Profile selection SHALL be explicit, version-bound, and justified by applicability; profile availability SHALL NOT make it mandatory. | Effective-profile review |
| GAEP-STR-SCP-REQ-009 | First-horizon scope SHALL include negative, pause, recovery, substitution, and exit scenarios in addition to the successful path. | Scenario-catalog review |
| GAEP-STR-SCP-REQ-010 | An implementation-readiness decision SHALL identify the exact approved capability cut and unresolved deferred decisions. | Readiness-gate review |

## Open decisions

| Decision ID | Open decision |
|---|---|
| GAEP-STR-SCP-DEC-001 | What is the minimum approved Core requirement set? |
| GAEP-STR-SCP-DEC-002 | Which governed-change profile and risk profile are first? |
| GAEP-STR-SCP-DEC-003 | What workspace representation is sufficient for manual validation? |
| GAEP-STR-SCP-DEC-004 | Which authoritative external sources are required by the first pilot? |
| GAEP-STR-SCP-DEC-005 | Which deterministic validators are necessary before any AI-assisted trial? |
| GAEP-STR-SCP-DEC-006 | What scope is explicitly removed from the legacy corpus rather than merely deferred? |
| GAEP-STR-SCP-DEC-007 | Which portability scenario must pass before adapter implementation is authorized? |

The first-horizon cut becomes authoritative only through a version-bound approval record and the GAEP-on-GAEP readiness gate.
