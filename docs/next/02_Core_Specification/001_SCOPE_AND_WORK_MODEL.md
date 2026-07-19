---
id: GAEP-CORE-001
title: Scope and Work Model
document_type: normative-specification
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Core Specification Steward
scope: GAEP scope-bearing subjects, governed work, and workspace boundaries
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
  - GAEP-CORE-002
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

# Scope and Work Model

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

This early contract records later-owned concepts only as opaque, version-pinned references: Principal/authority references, Resource Revision references, State/Transition references, Policy Binding references, approval/decision references, Profile Selection references, and federation references. It does not define or evaluate their downstream semantics. The edges are declared in `core_package_interfaces` and must resolve within the same exact Candidate Revision Set before approval. Consequently, GAEP claims an acyclic interpretation/build dependency graph, not an acyclic complete semantic-interface graph, and GAEP-CORE-001 is not independently baseline-complete.

## Core entities

| Entity | Meaning | Identity and lifetime |
|---|---|---|
| Authority Namespace | Globally scoped issuing authority for GAEP identifiers. | Stable for as long as identifiers issued by it must resolve. |
| Organization Scope | Accountable administrative boundary that owns or governs assets, initiatives, roles, policies, and namespaces. | Long-lived and versioned through governed change. |
| Portfolio | Optional grouping of managed assets or initiatives for strategy, investment, or governance. | Long-lived; membership is time- and scope-aware. |
| Managed Asset | Long-lived subject created, changed, operated, or retired through engineering work. Examples include a Product, system, service, library, platform, data asset, model, or shared capability. | Stable lineage independent of any one initiative or workspace. |
| Engineering Initiative | Time-bounded governed endeavor intended to create, change, investigate, migrate, secure, or retire one or more Managed Assets. | Begins with declared intent and closes or is cancelled with retained history. |
| Change | Versioned proposal and governed mutation scope against one or more exact subjects. | Belongs to one governing Initiative; may have several analyzed revisions and executions. |
| Work Item | Bounded unit of planned or assigned work contributing to an Initiative or Change. | May be decomposed; it is not itself a source of authority. |
| Implementation Unit | Identifiable technical or operational unit that may be designed, built, deployed, configured, tested, or operated. | Long-lived relative to individual work items; classified by a controlled type. |
| Workspace | Administrative and technical boundary that contains or references governed representations for one or more scopes. | May change location or tooling without changing represented entity identity. |
| Scope Reference | Namespaced reference to an exact scope-bearing entity and, where needed, an effective version or time. | Portable across workspaces and repositories. |
| Scope Binding | Explicit relationship binding a resource, policy, role, profile, run, or record to one or more Scope References. | Versioned when its meaning, precedence, or effective interval changes. |

## Managed subjects versus work

A Managed Asset answers “what enduring subject is governed?” An Engineering Initiative answers “what bounded outcome are we pursuing?” A Change answers “which exact mutation is being proposed or executed?” A Work Item answers “which bounded contribution is assigned or planned?”

The distinction prevents these invalid substitutions:

- treating a Product as if it ends when one delivery initiative closes;
- treating a defect report as the long-lived identity of the service it changes;
- treating a repository as the Product or Initiative identity;
- treating a work item as approval for the underlying change;
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
| Work Item | contributes to | Engineering Initiative | Exactly one. |
| Work Item | implements or analyzes | Change | Zero or one primary Change; additional relationships require explicit rationale. |
| Work Item | parent of | Work Item | Zero or more children; the decomposition graph is acyclic. |
| Implementation Unit | part of | Managed Asset | At least one current Managed Asset scope; shared units declare each consumer or governing asset explicitly. |
| Workspace | represents | Scope Reference | One or more; representation does not create ownership or authority. |
| Scope Binding | applies to | Scope Reference | One or more explicit targets with declared combination semantics. |

## Scope kinds

Managed Asset and Implementation Unit types are controlled, extensible registries. The Core does not require Product to be the universal type and does not require every unit to be deployable.

Initial semantic categories that profiles may register include:

- product or customer-facing capability;
- system, platform, or shared service;
- application, service, workload, function, or job;
- library, package, SDK, or command-line interface;
- module, component, bounded context, or logical subsystem;
- API, event contract, integration, or external-system boundary;
- data product, dataset, schema, model, or storage responsibility;
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

## Time and change

Membership, ownership, target, and binding relationships have valid-time intervals when history matters. A current query and a historical query may return different scope graphs without rewriting history.

Closing an Initiative does not retire its target Managed Assets. Retiring a Managed Asset does not erase Initiatives, Changes, Work Items, decisions, evidence, or historical representations associated with it.

## Normative requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-SCOPE-REQ-001 | Every scope-bearing entity SHALL have a canonical identifier issued by exactly one Authority Namespace. | Identity and namespace review |
| GAEP-SCOPE-REQ-002 | A Managed Asset SHALL have identity independent of any Engineering Initiative, Change, Work Item, repository, or workspace. | Lifecycle scenario review |
| GAEP-SCOPE-REQ-003 | An Engineering Initiative SHALL identify one accountable Organization Scope and at least one target Managed Asset or proposed Managed Asset identity. | Initiative-record validation |
| GAEP-SCOPE-REQ-004 | A Product SHALL be modeled as a Managed Asset type unless an approved profile explicitly defines another non-conflicting meaning. | Type-registry inspection |
| GAEP-SCOPE-REQ-005 | A Change SHALL reference exactly one governing Engineering Initiative and SHALL identify its affected scope at the precision available for its current analysis state. | Change-record validation |
| GAEP-SCOPE-REQ-006 | A Work Item SHALL reference exactly one governing Engineering Initiative and SHALL NOT be interpreted as approval or authorization for a Change. | Work-item and authorization scenario |
| GAEP-SCOPE-REQ-007 | A Workspace SHALL reference the scopes it represents and SHALL NOT derive ownership, approval, or authority from file containment or write access. | Workspace negative scenario |
| GAEP-SCOPE-REQ-008 | Parent-child relationships among Initiatives and Work Items SHALL be acyclic. | Graph-cycle validation |
| GAEP-SCOPE-REQ-009 | Parent scope, Portfolio membership, or Initiative decomposition SHALL NOT cause approval, policy exception, or authority to be inherited implicitly. | Inheritance negative scenario |
| GAEP-SCOPE-REQ-010 | An Implementation Unit SHALL declare its canonical type, governing Managed Asset relationship, owner role reference, and effective interval where ownership changes over time. | Unit-record inspection |
| GAEP-SCOPE-REQ-011 | Shared Implementation Units SHALL identify all known governing or consuming Managed Asset scopes required for impact analysis. | Shared-unit scenario |
| GAEP-SCOPE-REQ-012 | Cross-organization work SHALL identify the accountable organization, participating organizations, and authority boundaries explicitly. | Federation scenario review |
| GAEP-SCOPE-REQ-013 | Scope bindings SHALL identify their exact target scopes, effective interval, source, and combination or precedence semantics. | Binding-record validation |
| GAEP-SCOPE-REQ-014 | Scope resolution SHALL return an explicit unresolved or conflicting result when a unique effective scope cannot be established. | Ambiguous-scope negative test |
| GAEP-SCOPE-REQ-015 | Unresolved scope SHALL NOT be interpreted as the broadest available scope. | Over-broad-target negative test |
| GAEP-SCOPE-REQ-016 | A scope change that can alter policy, authority, approval, impact, or evidence obligations SHALL create a new governed revision or transition record. | Scope-change scenario |
| GAEP-SCOPE-REQ-017 | Closing an Initiative SHALL NOT silently retire, delete, or transfer its target Managed Assets. | Closure scenario |
| GAEP-SCOPE-REQ-018 | Retiring a Managed Asset SHALL preserve required historical Initiative, Change, decision, trace, and evidence references according to policy. | Retirement and retention review |
| GAEP-SCOPE-REQ-019 | Repository path, branch, project key, issue key, or external URL SHALL NOT be the sole canonical identity of a scope-bearing entity. | Portability inspection |
| GAEP-SCOPE-REQ-020 | A conformance claim SHALL identify the exact Organization, Managed Asset, Initiative, Change, Implementation Unit, or Workspace scope to which it applies. | Conformance-record review |
| GAEP-SCOPE-REQ-021 | Scope kinds and relationship names SHALL use controlled, versioned registries or declared extension namespaces. | Registry validation |
| GAEP-SCOPE-REQ-022 | Scope history SHALL preserve transaction time and SHALL preserve valid time where retroactive or future-effective scope is supported. | Temporal-history scenario |
| GAEP-SCOPE-REQ-023 | A profile MAY specialize permitted scope kinds, but SHALL NOT collapse Managed Asset, Initiative, Change, Work Item, and Workspace into one indistinguishable entity. | Effective-profile review |
| GAEP-SCOPE-REQ-024 | Scope-sensitive records SHALL reference canonical Scope References rather than relying only on copied display names. | Referential validation |

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

- Principal, role, owner, and authority semantics are defined by GAEP-CORE-002.
- Scope-bound resources and exact revisions are defined by GAEP-CORE-003.
- Scope changes and transition records are defined by GAEP-CORE-004.
- Policy Binding and Policy Evaluation semantics are defined by GAEP-CORE-005.
- Profile selection and Profile Selection Manifest semantics are defined by GAEP-CORE-009.
- Scope-affecting decisions and approvals are governed by GAEP-CORE-006.
- Cross-domain federation semantics are defined by GAEP-CORE-012.
