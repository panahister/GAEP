---
id: GAEP-CORE-001
title: Scope, Work, Identity, and Authority Model
document_type: normative-specification
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Core Specification Steward
scope: GAEP durable subjects, bounded work, accountable identity, role assignment, standing authority, and scope boundaries
normative_level: normative
classification: internal
provenance: GAEP pre-implementation restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CST-003
  - GAEP-REG-001
core_package_interfaces:
  - GAEP-CORE-003
  - GAEP-CORE-004
  - GAEP-CORE-005
  - GAEP-CORE-006
  - GAEP-CORE-009
  - GAEP-CORE-012
informative_references:
  - ../../01_Foundation/006_ADAPTIVE_ENGINEERING_PRINCIPLES.md
  - ../../02_Platform/019_DYNAMIC_ENGINEERING_MODEL.md
  - ../../04_Repository/030_REPOSITORY_STRUCTURE.md
supersedes: []
---

# Scope, Work, Identity, and Authority Model

## Purpose

This document defines the subjects GAEP governs and the units through which engineering work is proposed, bounded, decomposed, and related. It separates long-lived managed subjects from time-bounded work and from the repositories or tools used to represent them.

This separation is foundational. A Product, service, data asset, or platform may exist through many initiatives. One initiative may affect several managed assets. A workspace may represent either without becoming the source of their authority.

## Conceptual boundary

This model owns:

- canonical scope kinds and their relationships;
- the distinction between managed subjects and governed work;
- scope references and scope resolution;
- work decomposition and target cardinalities;
- cross-scope and federated-work declarations.

This model does not own:

- principal identity, role assignment, or authority;
- artifact content or revision storage;
- lifecycle transition execution;
- policy evaluation;
- runtime plans or tool permissions;
- physical repository layout.

Those responsibilities belong to downstream Core specifications and realizations.

### Intra-package interface rule

This first contract owns durable-subject, bounded-work, Principal, Role Assignment, standing-authority eligibility, and scope-resolution semantics. It records later-owned Resource Revision, State/Transition, Policy Binding, approval/decision, Profile Selection, and federation concepts only as opaque, version-pinned references. Those edges are declared in `core_package_interfaces` and must resolve within the same exact Candidate Revision Set before approval. Consequently, GAEP claims an acyclic interpretation/build dependency graph, not an acyclic complete semantic-interface graph, and GAEP-CORE-001 is not independently baseline-complete.

## Core entities

| Entity | Meaning | Identity and lifetime |
|---|---|---|
| Authority Namespace | Globally scoped issuing authority for GAEP identifiers. | Stable for as long as identifiers issued by it must resolve. |
| Organization Scope | Accountable administrative boundary that owns or governs assets, initiatives, roles, policies, and namespaces. | Long-lived and versioned through governed change. |
| Portfolio | Optional grouping of managed assets or initiatives for strategy, investment, or governance. | Long-lived; membership is time- and scope-aware. |
| Managed Asset | Long-lived governed subject created, changed, migrated, secured, operated, or retired through engineering work. The initial hierarchy includes Product, Platform, System, Service, Data Asset, and Reusable Capability types. | Stable lineage independent of any Initiative, Change, Work Item, repository, or workspace. |
| Product | Long-lived Managed Asset type whose identity and history remain distinct from every Initiative that creates, changes, operates, or retires it. | Stable Product lineage may span many Initiatives and Changes. It is never an Initiative identity. |
| Engineering Initiative | Bounded governed endeavor intended to create, change, migrate, secure, operate, or retire one or more Managed Assets. | Begins with declared intent and closes or is cancelled with retained history; closure does not end its target assets. |
| Change | Versioned delta against one or more exact subject baselines, or against an explicit genesis declaration where no prior baseline exists. | Belongs to one governing Initiative; proposal, decision, approval, authorization, and execution remain separate governed records. |
| Work Item | Bounded unit of planned or executable work contributing to exactly one Change. | Derives its governing Initiative from that Change, may be decomposed, and is not itself a source of authority. |
| Implementation Unit | Identifiable technical or operational unit that may be designed, built, deployed, configured, tested, or operated. | Long-lived relative to individual work items; classified by a controlled type. |
| Workspace | Administrative and technical boundary that contains or references governed representations for one or more scopes. | May change location or tooling without changing represented entity identity. |
| Scope Reference | Namespaced reference to an exact scope-bearing entity and, where needed, an effective version or time. | Portable across workspaces and repositories. |
| Scope Binding | Explicit relationship binding a resource, policy, role, profile, run, or record to one or more Scope References. | Versioned when its meaning, precedence, or effective interval changes. |

## Managed subjects versus work

A Managed Asset answers “what enduring subject is governed?” A Product is one Managed Asset type, not a kind of Initiative. An Engineering Initiative answers “what bounded outcome are we pursuing against one or more Managed Assets?” A Change answers “which exact baseline delta is being proposed or, through separate authority, executed?” A Work Item answers “which bounded contribution to that Change is planned or executable?”

The distinction prevents these invalid substitutions:

- treating a Product as if it ends when one delivery initiative closes;
- treating a defect report as the long-lived identity of the service it changes;
- treating a repository as the Product or Initiative identity;
- treating a work item as approval for the underlying change;
- treating a Change proposal as its own decision, approval, or execution authorization;
- treating a technical component as the administrative owner of itself.

## Scope hierarchy and federation

Scope is graph-shaped rather than a universal folder tree. An organization may group assets through portfolios, but a Managed Asset may be affected by multiple initiatives and an initiative may span multiple assets. Cross-organization work is represented through explicit federated bindings rather than synthetic ownership.

Containment never implies authority. Authority is resolved through the Identity and Authority Model and applicable policy.

### Relationship and cardinality contract

| Source | Relationship | Target | Cardinality and rule |
|---|---|---|---|
| Authority Namespace | issues identifiers for | Any governed entity | One entity has exactly one canonical issuing namespace; aliases may exist. |
| Organization Scope | governs | Managed Asset | A Managed Asset has exactly one accountable governing organization for a declared interval; additional participating organizations are explicit. |
| Organization Scope | contains | Portfolio | A Portfolio belongs to one accountable organization for a declared interval. |
| Portfolio | groups | Managed Asset or Engineering Initiative | Zero or more members; grouping does not transfer ownership or authority. |
| Engineering Initiative | governed by | Organization Scope | Exactly one accountable organization; federated participants are additional bindings. |
| Engineering Initiative | targets | Managed Asset | One or more targets, except that an initiative creating a new asset may target a proposed Managed Asset identity. |
| Engineering Initiative | parent of | Engineering Initiative | Zero or more children; parent relationships are acyclic and do not imply approval inheritance. |
| Change | governed by | Engineering Initiative | Exactly one. Emergency profiles may create the Initiative and Change together, but they remain distinct records. |
| Change | affects | Managed Asset, Implementation Unit, or Resource Revision | One or more exact targets or explicitly unresolved target candidates during discovery. |
| Work Item | contributes to | Change | Exactly one. Its governing Initiative is derived from the Change; any denormalized Initiative reference must resolve to the same Initiative. |
| Work Item | parent of | Work Item | Zero or more children; the decomposition graph is acyclic. |
| Implementation Unit | part of | Managed Asset | At least one current Managed Asset scope; shared units declare each consumer or governing asset explicitly. |
| Workspace | represents | Scope Reference | One or more; representation does not create ownership or authority. |
| Scope Binding | applies to | Scope Reference | One or more explicit targets with declared combination semantics. |

## Scope kinds

Managed Asset and Implementation Unit types are controlled through separate extensible registries. Product is a canonical Managed Asset type, but it is not the universal Managed Asset type. The initial Managed Asset hierarchy contains:

- Product;
- Platform;
- System;
- Service;
- Data Asset;
- Reusable Capability.

Profiles may add namespaced Managed Asset specializations, but they cannot redefine Product as work or collapse a Managed Asset type into Engineering Initiative. Classification depends on identity and lifetime rather than display name alone.

Implementation Unit types and facets remain separate from that hierarchy and do not require every unit to be deployable. Initial technical categories that profiles may register include:

- application, workload, function, or job;
- library, package, SDK, or command-line interface;
- module, component, bounded context, or logical subsystem;
- API, event contract, integration, or external-system boundary;
- dataset representation, schema, model, or storage responsibility;
- infrastructure, environment, deployment target, or operational capability;
- AI model, AI system, evaluation asset, or automation capability.

A unit may have several facets, but it has one canonical type for each type registry. Profiles define allowed combinations rather than relying on free-form labels.

## Scope resolution

Scope resolution produces an attributable Scope Resolution Record containing:

- requested action or question;
- initiating Principal or system reference;
- candidate scope references;
- selected effective scope;
- inherited and explicitly bound profiles or policies;
- excluded scope;
- unresolved ambiguity;
- source versions and resolution time;
- reason for the result.

Scope resolution may narrow authority. It does not expand authority merely because a parent scope was selected.

## Accountable identity and authority

A `Principal` is an attributable human, organization, system, agent, or governed group identity. A `Role Definition` describes bounded responsibilities; it grants nothing. A `Role Assignment` binds one Principal to one exact role, scope, assigning authority, validity interval, review condition, delegation rule, and disclosed limitation. A standing `Authority Grant` establishes eligibility for a declared decision class within its exact scope; it is not executable permission. An action-specific `Authorization Grant` remains governed by GAEP-CORE-006.

Authority resolution evaluates the acting Principal, exact role and assignment, standing grant where required, action, target, scope, time, state, policy, and constraints. Its result is eligible, ineligible, unresolved, or conflicted. Missing, expired, revoked, unverifiable, self-manufactured, or out-of-scope authority never becomes permission. Repository access, authorship, tool capability, funding, seniority, and file ownership do not substitute for these records.

Role assignment, standing authority, approval authority, reviewer competence, and operational authorization remain separate. Delegated execution does not transfer accountability, and no delegation may exceed or outlive its source.

## Time and change

Membership, ownership, target, and binding relationships have valid-time intervals when history matters. A current query and a historical query may return different scope graphs without rewriting history.

Closing an Initiative does not retire its target Managed Assets. Retiring a Managed Asset does not erase Initiatives, Changes, Work Items, decisions, evidence, or historical representations associated with it.

## Normative requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-SCOPE-REQ-001 | Every scope-bearing entity SHALL have a canonical identifier issued by exactly one Authority Namespace. | Identity and namespace review |
| GAEP-SCOPE-REQ-002 | A Managed Asset SHALL have identity independent of any Engineering Initiative, Change, Work Item, repository, or workspace. | Lifecycle scenario review |
| GAEP-SCOPE-REQ-003 | An Engineering Initiative SHALL identify one accountable Organization Scope and at least one target Managed Asset or proposed Managed Asset identity. | Initiative-record validation |
| GAEP-SCOPE-REQ-004 | A Product SHALL be modeled as a Managed Asset type and SHALL NOT be modeled as, or share canonical identity with, an Engineering Initiative. | Type-registry and identity inspection |
| GAEP-SCOPE-REQ-005 | A Change SHALL reference exactly one governing Engineering Initiative, SHALL identify one or more exact affected baselines or an explicit genesis/no-prior-baseline declaration for a newly created subject, and SHALL identify its affected scope at the precision available for its current analysis state. A Change record alone SHALL NOT imply decision, approval, authorization, or execution. | Change-record and authorization-boundary validation |
| GAEP-SCOPE-REQ-006 | A Work Item SHALL reference exactly one Change, SHALL derive its governing Engineering Initiative from that Change, and SHALL NOT be interpreted as approval or authorization for the Change. Any denormalized Initiative reference SHALL resolve to the same governing Initiative. | Work-item, referential-consistency, and authorization scenario |
| GAEP-SCOPE-REQ-007 | A Workspace SHALL reference the scopes it represents and SHALL NOT derive ownership, approval, or authority from file containment or write access. | Workspace negative scenario |
| GAEP-SCOPE-REQ-009 | Parent scope, Portfolio membership, or Initiative decomposition SHALL NOT cause approval, policy exception, or authority to be inherited implicitly. | Inheritance negative scenario |
| GAEP-SCOPE-REQ-013 | Scope bindings SHALL identify their exact target scopes, effective interval, source, and combination or precedence semantics. | Binding-record validation |
| GAEP-SCOPE-REQ-014 | Scope resolution SHALL return an explicit unresolved or conflicting result when a unique effective scope cannot be established. | Ambiguous-scope negative test |
| GAEP-SCOPE-REQ-015 | Unresolved scope SHALL NOT be interpreted as the broadest available scope. | Over-broad-target negative test |
| GAEP-SCOPE-REQ-016 | A scope change that can alter policy, authority, approval, impact, or evidence obligations SHALL create a new governed revision or transition record. | Scope-change scenario |
| GAEP-SCOPE-REQ-017 | Closing an Initiative SHALL NOT silently retire, delete, or transfer its target Managed Assets. | Closure scenario |
| GAEP-SCOPE-REQ-018 | Retiring a Managed Asset SHALL preserve required historical Initiative, Change, decision, trace, and evidence references according to policy. | Retirement and retention review |
| GAEP-SCOPE-REQ-021 | Scope kinds and relationship names SHALL use controlled, versioned registries or declared extension namespaces. | Registry validation |
| GAEP-SCOPE-REQ-024 | Scope-sensitive records SHALL reference canonical Scope References rather than relying only on copied display names. | Referential validation |
| GAEP-IDAUTH-REQ-001 | Every attributable action, transition, decision, approval, delegation, or external effect SHALL identify the acting Principal. | Record inspection |
| GAEP-IDAUTH-REQ-004 | Repository write access, file ownership, tool availability, group membership, model capability, or possession of a credential SHALL NOT by itself constitute GAEP approval or authority. | Negative authorization scenarios |
| GAEP-IDAUTH-REQ-005 | A Role Definition SHALL NOT establish standing authority eligibility without an applicable Role Assignment, Authority Grant, or policy binding, and none of those records SHALL substitute for executable Authorization Grant. | Unassigned-role test |
| GAEP-IDAUTH-REQ-006 | Every Role Assignment SHALL identify Principal, role, scope, assigning authority, effective time, expiry or review condition, and current validity. | Assignment-record validation |
| GAEP-IDAUTH-REQ-008 | Authority resolution SHALL evaluate Principal, action, target, scope, policy, state, time, classification, and required authorization at the precision applicable to the action, and SHALL produce eligibility rather than executable permission. | Authority decision-table test |
| GAEP-IDAUTH-REQ-009 | Missing, conflicting, expired, revoked, or unverifiable authority inputs SHALL NOT resolve to silent eligibility or permission. | Negative resolution test |

## Derived views

The following are derived views, not independent sources of truth:

- organization portfolio map;
- asset-to-initiative roadmap;
- initiative work breakdown;
- implementation-unit topology;
- active-change view;
- workspace navigation tree;
- cross-organization participation view.

Every derived view identifies its source revisions and resolution time.

## Negative cases

| Case | Required result |
|---|---|
| A repository is named after a Product and contains Product files | The repository may represent the Product, but it does not become the Product identity or owner. |
| A defect ticket changes an existing service | The service remains a Managed Asset or Implementation Unit; the defect is represented through an Initiative, Change, or Work Item according to the selected profile. |
| One migration changes three Products and a shared data platform | One Initiative may target all four Managed Assets; each affected scope and accountable authority remains explicit. |
| A child Initiative is approved | Parent or sibling Initiatives receive no approval by implication. |
| A workspace contains an organizational policy copy | Presence does not establish that the policy applies or is authoritative; the policy binding and exact revision must resolve. |
| A target cannot be distinguished between similarly named services | Scope resolution returns unresolved and blocks material action rather than selecting the nearest repository path. |
| A Product continues after a release initiative closes | The Product identity and operational state continue independently; the Initiative retains historical relationships. |
| A Work Item is recorded directly against an Initiative without a Change | The record is unresolved or invalid until it references exactly one Change governed by that Initiative; Initiative membership alone is insufficient. |

## Open decisions

These items remain proposed design questions and do not create requirements:

| Open decision ID | Question | Consequence |
|---|---|---|
| GAEP-SCOPE-OD-001 | Should Portfolio be a Core entity or a profile-defined grouping type? | Affects the minimum scope registry and organizational portability. |
| GAEP-SCOPE-OD-002 | May a Managed Asset have joint accountable organizations, or must federation always name one lead organization? | Affects cross-enterprise and consortium governance. |
| GAEP-SCOPE-OD-003 | Which canonical Implementation Unit type facets belong in Core registries? | Affects topology interoperability without selecting an implementation architecture. |
| GAEP-SCOPE-OD-004 | Should emergency operational work always create an Initiative, or may a profile use a pre-authorized standing Initiative? | Affects audit clarity and emergency burden. |
| GAEP-SCOPE-OD-005 | What historical valid-time precision is required for the first conformance class? | Affects temporal queries and migration expectations. |

## Cross-contract dependencies

- Principal, role, assignment, standing-authority eligibility, and scope semantics are defined in this contract.
- Scope-bound resources and exact revisions are defined by GAEP-CORE-003.
- Scope changes and transition records are defined by GAEP-CORE-004.
- Policy Binding and Policy Evaluation semantics are defined by GAEP-CORE-005.
- Profile selection and Profile Selection Manifest semantics are defined by GAEP-CORE-009.
- Scope-affecting decisions and approvals are governed by GAEP-CORE-006.
- Cross-domain federation semantics are defined by GAEP-CORE-012.
