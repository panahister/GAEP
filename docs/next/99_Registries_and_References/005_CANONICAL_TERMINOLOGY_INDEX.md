---
id: GAEP-REG-005
title: Canonical Terminology Index
document_type: registry
schema_version: 1.0
version: 0.3.0
status: proposed
owner_role: GAEP Semantic Registry Steward
scope: Human-readable index of GAEP Next canonical concepts
normative_level: informative
classification: internal
provenance: GAEP pre-implementation restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CORE-003
informative_references:
  - ../../99_References/991_GLOSSARY.md
  - ../../99_References/992_TERMINOLOGY.md
  - ../01_Constitution/004_METHODOLOGY_CONSTITUTION.md
  - 011_METHODOLOGY_REFERENCE_CATALOG.json
supersedes: []
---

# Canonical Terminology Index

## Use rule

This is a navigation index, not a second definition owner. The listed owning contract contains the canonical semantics. A short description here cannot override it.

| Term | Short distinction | Normative owner |
|---|---|---|
| Managed Asset | long-lived governed subject with identity and history independent of the work that creates, changes, migrates, secures, operates, or retires it; initial types are Product, Platform, System, Service, Data Asset, and Reusable Capability | GAEP-CORE-001 |
| Product | long-lived Managed Asset type; never an Engineering Initiative identity | GAEP-CORE-001 |
| Engineering Initiative | bounded governed effort intended to create, change, migrate, secure, operate, or retire one or more Managed Assets | GAEP-CORE-001 |
| Initiative | canonical short form for Engineering Initiative; not a separate entity type | GAEP-CORE-001 |
| Change | versioned delta against exact subject baselines or an explicit genesis/no-prior-baseline declaration; proposal and authorization remain separate | GAEP-CORE-001 |
| Work Item | planned or executable unit of exactly one Change; its governing Initiative is derived through that Change | GAEP-CORE-001 |
| Implementation Unit | logical or deployable subject affected by work; not the work itself | GAEP-CORE-001 |
| Workspace | governed representation and bindings for a scope; not automatically the authority for every represented resource | GAEP-CORE-001 |
| Principal | identity-bearing human, organization, service or agent subject | GAEP-CORE-001 |
| Actor | a Principal acting in a particular event or interaction | GAEP-CORE-001 |
| Role Definition | named responsibility and candidate-right category; canonical owner-role values are registered by GAEP-REG-008 | GAEP-CORE-001 and GAEP-REG-008 |
| Assignment | time- and scope-bound association of a Principal with a Role | GAEP-CORE-001 |
| Delegation | attributable transfer of bounded authority or capability without erasing retained accountability | GAEP-CORE-001 |
| Authority Grant | standing source record establishing bounded decision rights or an authority basis; never executable permission | GAEP-CORE-001 |
| Governed Resource | stable lineage whose content, metadata, state or authority is governed | GAEP-CORE-003 |
| Artifact | content-oriented Governed Resource; not the universal base type for every record or identity | GAEP-CORE-003 |
| Record | event-, decision- or transaction-oriented Governed Resource | GAEP-CORE-003 |
| Revision | immutable version of a resource lineage | GAEP-CORE-003 |
| Representation | format or location expressing a revision | GAEP-CORE-003 |
| Candidate Revision Set | immutable version-pinned collection assembled for review or proposal; membership implies no approval or authority | GAEP-CORE-003 |
| Baseline Proposal | request to designate one exact Candidate Revision Set revision for a declared scope and purpose | GAEP-CORE-003 |
| Baseline Set | approved designation of one exact Candidate Revision Set revision for a declared scope and purpose; not an artifact lifecycle state | GAEP-CORE-003 |
| External Resource | resource whose governing content authority is outside the local workspace | GAEP-CORE-003 |
| Derived View | regenerable projection, summary, index or cache that does not silently become authority | GAEP-CORE-003 |
| State Dimension | one orthogonal aspect of current condition | GAEP-CORE-004 |
| State Record | attributable value of one State Dimension for an exact subject revision and scope | GAEP-CORE-004 |
| Statechart | allowed values and transitions for a specific State Dimension and subject type | GAEP-CORE-004 |
| Transition | authorized movement between values in one State Dimension | GAEP-CORE-004 |
| Event | attributable fact that occurred; not automatically a state transition or command | GAEP-CORE-004 |
| Policy | governed rule that evaluates subject, actor, action, resource and environment | GAEP-CORE-005 |
| Base Policy Envelope | constitutional, legal, contractual, organizational, scope, and authority constraints resolved without selected profiles | GAEP-CORE-005 |
| Effective Policy Snapshot | exact policy composition produced after consuming one explicit Profile Selection Manifest | GAEP-CORE-005 |
| Policy Evaluation | immutable evaluative result, reasons, and obligations for exact governed inputs; never executable permission | GAEP-CORE-005 |
| Risk | uncertain event or condition with consequences to objectives or affected parties | GAEP-CORE-005 |
| Policy Exception | scoped, authorized and reviewable variation where variation is permitted | GAEP-CORE-005 |
| Obligation | durable required action, condition or evidence with owner and lifecycle | GAEP-CORE-005 |
| Recommendation | proposed course of action without decision or authorization force | GAEP-CORE-006 |
| Review | governance activity that consumes exact Evaluation Results and Review Contributions and emits one Review Conclusion | GAEP-CORE-006 |
| Review Conclusion | review output stating sufficiency, limitations, unresolved findings, and recommendation | GAEP-CORE-006 |
| Review Finding | attributable issue, observation or challenge requiring disposition | GAEP-CORE-006 |
| Decision | accountable selection, interpretation or disposition for an exact subject and scope | GAEP-CORE-006 |
| Approval Case | request and evidence package evaluated for approval | GAEP-CORE-006 |
| Approval Determination | accountable approval outcome; not the same as permission to execute every effect | GAEP-CORE-006 |
| Authorization Grant | only canonical executable permission for a scoped action or effect; sources may include policy, approval, decision, exception, and standing authority | GAEP-CORE-006 |
| Claim | scoped proposition whose confidence or acceptance may be evaluated | GAEP-CORE-007 |
| Evidence Item | governed information offered in support of or opposition to a Claim | GAEP-CORE-007 |
| Evaluation Definition | governed epistemic procedure declaring criteria, method, outputs, limitations, and invalidation | GAEP-CORE-007 |
| Evaluation Result | immutable epistemic outcome of an exact Evaluation Run; not a Review, approval, or permission | GAEP-CORE-007 |
| Gate | Evaluation contract and result informing readiness or progression; never executable authority | GAEP-CORE-007 |
| Assurance Case | structured set of Claims, Evidence Items, reasoning, assumptions and limits supporting a decision | GAEP-CORE-007 |
| Trace Link | typed, attributable, version-aware relationship between exact governed subjects | GAEP-CORE-003 |
| Provenance Record | resource-level attributable origin, sources, transformations, contributors, and generating execution | GAEP-CORE-003 |
| Provenance Chain | traversable origin, custody, transformation, responsibility, and trace across governed resources | GAEP-CORE-003 |
| Semantic Registry | governed definitions and controlled values with compatibility and lifecycle | GAEP-CORE-003 |
| Profile | versioned specialization of permitted Core variation points and added obligations | GAEP-CORE-009 |
| Profile Selection Manifest | explicit attributable record of selected, excluded, conflicting, and unresolved exact profile revisions | GAEP-CORE-009 |
| Organizational Binding | approved organization- or scope-specific configuration | GAEP-CORE-009 |
| Effective Configuration | immutable result of resolving Core, policy, profiles and approved bindings for a subject and action | GAEP-CORE-009 |
| Capability | versioned ability to inspect, transform, decide, validate or effect within declared constraints | GAEP-CORE-010 |
| Workflow Definition | reusable ordered/conditional procedure composed from capabilities and governance conditions | GAEP-CORE-010 |
| Plan | versioned subject- and objective-specific intended procedure; a Run is a separate execution instance | GAEP-CORE-010 |
| Context Pack | immutable manifest and bounded delivery view of selected context for an objective and recipient | GAEP-CORE-010 |
| Run | attributable execution instance of a Plan | GAEP-CORE-011 |
| Step | addressable unit in a Workflow Definition or Plan; actual execution is recorded separately by GAEP-CORE-011 | GAEP-CORE-010 |
| Effect | observed or intended externally or persistently meaningful change | GAEP-CORE-011 |
| Compensation | governed attempt to counter or reconcile a prior Effect | GAEP-CORE-011 |
| Recovery | process of restoring or establishing acceptable semantic, governance and operational state after disruption | GAEP-CORE-011 |
| Extension | namespaced addition outside Core ownership | GAEP-CORE-012 |
| Federation | resolution and exchange across authority, organization, repository or runtime boundaries | GAEP-CORE-012 |
| Realization | implementation-independent mapping of Core contracts to a workspace or runtime form | GAEP-REAL-001 and GAEP-REAL-002 |
| Adapter | versioned translator between GAEP semantics and a provider, agent, tool or external system | GAEP-ADAPT-001 |
| Conformance | scoped, version-bound and evidence-backed claim against declared GAEP requirements | GAEP-CST-003 |
| Methodology composition | applicability-driven selection and combination of concerns, external references, methods, evidence, and rigor; not one universal GAEP methodology | GAEP-CST-004 |
| External reference | exact version-bound standard, framework, methodology, method, model, principle set, research program, metric framework, regulatory guidance, or visualization model used within declared access and claim limits | GAEP-REG-003 and GAEP-REG-011 |
| Method | selectable way of performing applicable engineering or Product work; support does not make it mandatory | GAEP-CST-004 |
| Tool or adapter | replaceable work surface or translator that does not define lifecycle, method, authority, or canonical truth | GAEP-CST-004 |
| Product Design | applicable Product-to-Operations capability for experience and interaction evidence; Figma may be an adapter but is not the capability or a lifecycle phase | GAEP-CST-004 |
| Architecture sufficiency | consequential architecture resolved deeply enough to authorize the affected slice while remaining iterative, incremental, and revisable under governed change | GAEP-CST-004 |

## Discouraged ambiguous terms

| Ambiguous term | Use instead |
|---|---|
| status | name the State Dimension and value |
| approved artifact | approved exact Revision or Baseline Set, with separate validity/freshness |
| human approval | distinguish Approval Determination from Authorization Grant |
| evidence authority | distinguish epistemic role from semantic authority |
| AI agent owns | identify service/agent Principal, Role, authority source and accountable human chain |
| source of truth | declare authority per resource, field or representation |
| Product Initiative | preserve this legacy phrase with its exact source meaning; in the candidate model use an explicit Product Managed Asset plus the bounded Initiative or Initiatives that target it, without silent identity equivalence or identifier reuse |
| defect initiative | defect Finding or work subject plus corrective Initiative/Change |
| context | identify Context Item, Context Pack, selection rule or interaction context |
| compliant | identify conformance class, versions, profiles, deviations and evidence |
