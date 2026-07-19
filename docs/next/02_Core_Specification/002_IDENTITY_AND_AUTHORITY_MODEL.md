---
id: GAEP-CORE-002
title: Identity and Authority Model
document_type: normative-specification
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Identity and Authority Steward
scope: Principals, roles, assignments, delegation, accountability, and authority evaluation
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
  - GAEP-CORE-001
core_package_interfaces:
  - GAEP-CORE-003
  - GAEP-CORE-004
  - GAEP-CORE-005
  - GAEP-CORE-006
informative_references:
  - ../../01_Foundation/001_GAEP_CONSTITUTION.md
  - ../../02_Platform/013_GOVERNANCE_MODEL.md
  - ../../02_Platform/016_AGENT_MODEL.md
  - ../../03_Product_Engineering/025_HUMAN_APPROVAL_MODEL.md
supersedes: []
---

# Identity and Authority Model

## Purpose

This document defines who or what participates in GAEP, how identity is represented, how roles and authority are bound to scope, how delegation works, and how accountable human responsibility remains distinguishable from machine execution.

Authentication establishes or supports identity. This contract resolves whether a Principal has a standing authority basis and is eligible to seek executable permission for a particular action on a particular subject under current policy, state, time, and conditions. It does not itself authorize an effect: executable permission is always represented by an Authorization Grant under GAEP-CORE-006. Repository access, tool availability, model confidence, and role labels are not authority by themselves.

## Conceptual boundary

This model owns:

- Principal and Actor semantics;
- role definitions and assignments;
- Authority Grants and Delegations;
- accountability references;
- identity assurance and credential references;
- the authority-resolution inputs and result contract.

This model does not own:

- authentication protocol implementation;
- policy-rule composition;
- human approval outcomes;
- runtime credential storage;
- repository permissions;
- organization-specific role catalogs.

Policies constrain authority under GAEP-CORE-005. Decisions, approvals, and authorization records are governed by GAEP-CORE-006.

## Core entities

| Entity | Meaning |
|---|---|
| Principal | Identifiable human, system, service, workload, organization, or agent identity that may be authenticated, assigned roles, granted authority, or attributed actions. |
| Human Principal | Principal representing one natural person or an approved privacy-preserving identity mapped to one accountable person. |
| System Principal | Non-human Principal representing a deterministic system, service, workload, integration, or automation boundary. |
| Agent Principal | Non-human Principal representing a bounded AI or probabilistic participant for one instance, configuration, or governed identity scope. |
| Group Principal | Governed collection of Principals used for assignment; membership and effective time are explicit. |
| Actor | Principal acting in a particular interaction, run, decision, or transition. Actor is contextual attribution, not a new identity. |
| Accountable Human | Human Principal answerable for a governed outcome, risk, authorization chain, or delegated execution. |
| Role Definition | Named bundle of responsibilities and candidate decision rights without an assignee. |
| Role Assignment | Versioned, scoped, time-bounded association between a Principal and Role Definition. |
| Authority Grant | Standing source record establishing decision rights or an authority basis for identified actions, resources, scope, constraints, validity, and grantor. It is an input to authorization; it is not executable permission. |
| Delegation | Explicit transfer of a bounded subset of delegable authority from one Principal to another. |
| Authority Chain | Attributable path from governing source through grants, assignments, delegation, and policy to the acting Principal. |
| Identity Assertion | Attributable claim that a Principal has been authenticated or mapped by an identified identity source with an assurance level. |
| Credential Reference | Non-secret reference to the mechanism or protected credential used to establish identity. |
| Authority Resolution | Eligibility evaluation for one Principal, action, target, scope, time, context, and current state. It may support an authorization decision but never substitutes for an Authorization Grant. |

## Principal distinctions

Human, system, and agent Principals may all act, but they are not interchangeable:

- a human may hold accountable decision authority;
- a deterministic system may receive policy-defined operational authority;
- an agent may analyze, draft, recommend, review, or execute only within explicit bounded authority;
- neither system nor agent identity converts into human accountability;
- the invoking human and executing agent remain separately attributable;
- an agent subprocess or delegated agent receives a separately bounded authority chain.

Provider account, model name, process ID, repository user, and chat participant are identity attributes or external mappings. None is sufficient as the canonical Principal identity.

## Role and assignment semantics

A Role Definition expresses responsibilities and candidate rights. It grants nothing until an approved Role Assignment or policy binding makes it effective for a Principal and scope.

Role Assignment contains:

- assignment ID and revision;
- Principal and Role Definition;
- applicable Scope References;
- allowed responsibility domains;
- effective and expiry times;
- assigning authority;
- constraints and segregation rules;
- revocation state;
- provenance and evidence.

One Principal may hold several roles. Every material action records the role or authority basis exercised. Merely holding a role does not make it applicable outside its bound scope.

## Authority model

Standing authority eligibility is the intersection of:

- authenticated or otherwise accepted Principal identity;
- applicable Role Assignments;
- explicit Authority Grants and Delegations;
- requested action and exact target;
- Scope Resolution;
- current policy and exceptions;
- target state and classification;
- time, environment, purpose, and conditions;
- required approval, authorization, or confirmation;
- tool, adapter, and execution constraints.

If any required input is missing, conflicting, invalid, expired, or unverifiable, the result is `ineligible`, `indeterminate`, or `additional-authorization-required`. Missing data is never silent eligibility or permission.

## Authority resolution result

An Authority Resolution Record contains:

- resolution ID and time;
- Principal, Actor, and accountable human references;
- exercised role or grant;
- action and target revision;
- effective scope;
- applicable policy evaluation;
- authority chain;
- eligibility result: `eligible`, `eligible-with-constraints`, `additional-authorization-required`, `ineligible`, or `indeterminate`;
- obligations and constraints;
- reason codes and evidence;
- validity or re-evaluation trigger.

The result describes only the evaluated eligibility. It authorizes no action or effect and grants no standing authority. A permitted executable path must materialize an exact Authorization Grant under GAEP-CORE-006 before commitment.

## Delegation

Delegation is narrower than role assignment and does not transfer ownership automatically. A Delegation records:

- delegator and delegate;
- source authority;
- delegated actions and resources;
- scope;
- conditions and purpose;
- effective and expiry times;
- whether further delegation is permitted;
- revocation and review triggers;
- accountable human;
- evidence and approval where required.

Delegation cannot expand the delegator's authority. Delegation is non-transitive unless every hop explicitly permits further delegation and the effective intersection remains valid.

## Agent authority

An Agent Principal has:

- canonical agent identity or run-scoped instance identity;
- provider or execution-engine attributes where known;
- assigned capability and role profile;
- invoking Principal and accountable human or accountable system owner;
- exact tools, data classifications, actions, and resource scope;
- policy and authorization references;
- validity bounded to a run, task, or standing grant;
- prohibition on self-expansion or self-approval.

Model configuration and tool exposure describe capability. They do not grant authority.

## Ownership and accountability

Owner role and Principal assignment are separate:

- an artifact may name an owner role while a current assignment identifies the human Principal exercising it;
- stewardship may be performed by a team while one accountable role is named;
- operational custody does not imply decision authority;
- authorship does not imply ownership;
- ownership does not imply unrestricted authorization;
- transfer of ownership preserves open obligations, findings, risks, and history.

## Identity assurance

The Core does not mandate an authentication protocol. An Identity Assertion identifies:

- Principal;
- identity source and issuer;
- assertion type;
- assurance level or confidence category;
- authentication or mapping time;
- expiry;
- intended audience and scope;
- credential or session reference without embedded secret;
- validation evidence and limitations.

Profiles define assurance needed for different risk and action classes. An unverified display name is not sufficient for material approval, delegation, or external effect.

## Normative requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-IDAUTH-REQ-001 | Every attributable action, transition, decision, approval, delegation, or external effect SHALL identify the acting Principal. | Record inspection |
| GAEP-IDAUTH-REQ-002 | A material action performed by an Agent Principal or System Principal SHALL identify the invoking authority chain and accountable human or approved accountable organizational role. | Agent and system scenario |
| GAEP-IDAUTH-REQ-003 | Human Principal, System Principal, Agent Principal, Group Principal, Actor, Role Definition, and Role Assignment SHALL remain distinguishable entity types. | Schema and type review |
| GAEP-IDAUTH-REQ-004 | Repository write access, file ownership, tool availability, group membership, model capability, or possession of a credential SHALL NOT by itself constitute GAEP approval or authority. | Negative authorization scenarios |
| GAEP-IDAUTH-REQ-005 | A Role Definition SHALL NOT establish standing authority eligibility without an applicable Role Assignment, Authority Grant, or policy binding, and none of those records SHALL substitute for executable Authorization Grant. | Unassigned-role test |
| GAEP-IDAUTH-REQ-006 | Every Role Assignment SHALL identify Principal, role, scope, assigning authority, effective time, expiry or review condition, and current validity. | Assignment-record validation |
| GAEP-IDAUTH-REQ-007 | Every material action SHALL record the role, grant, or other authority basis exercised. | Audit-record inspection |
| GAEP-IDAUTH-REQ-008 | Authority resolution SHALL evaluate Principal, action, target, scope, policy, state, time, classification, and required authorization at the precision applicable to the action, and SHALL produce eligibility rather than executable permission. | Authority decision-table test |
| GAEP-IDAUTH-REQ-009 | Missing, conflicting, expired, revoked, or unverifiable authority inputs SHALL NOT resolve to silent eligibility or permission. | Negative resolution test |
| GAEP-IDAUTH-REQ-010 | An Authority Resolution SHALL identify its eligibility result, reason codes, constraints, obligations, source versions, and invalidation conditions. | Resolution-record validation |
| GAEP-IDAUTH-REQ-011 | An Authority Resolution SHALL apply only to the action, target, scope, and validity interval evaluated and SHALL NOT be presented or consumed as an Authorization Grant. | Scope-expansion negative test |
| GAEP-IDAUTH-REQ-012 | Delegation SHALL identify delegator, delegate, source authority, delegated actions, resource scope, constraints, validity, revocation, and accountable human. | Delegation-record validation |
| GAEP-IDAUTH-REQ-013 | A delegation SHALL NOT grant authority broader than the delegator holds at the time of delegated action. | Delegation amplification test |
| GAEP-IDAUTH-REQ-014 | Further delegation SHALL be prohibited unless explicitly permitted by every applicable delegation and policy. | Transitive-delegation negative test |
| GAEP-IDAUTH-REQ-015 | Delegation of execution SHALL NOT transfer accountable human responsibility to an Agent Principal. | Accountability-chain review |
| GAEP-IDAUTH-REQ-016 | An Agent Principal SHALL NOT modify its own role assignment, authority grant, delegation, policy, approval, audit history, or tool boundary unless an independently authorized mechanism explicitly permits the exact administrative action. | Agent self-escalation test |
| GAEP-IDAUTH-REQ-017 | An Agent Principal SHALL NOT provide the accountable human approval required for its own output or another AI output. | Self-approval negative test |
| GAEP-IDAUTH-REQ-018 | Identity Assertions used for material authority SHALL identify source, Principal, assurance, audience, issue time, expiry, and validation result. | Identity-assertion validation |
| GAEP-IDAUTH-REQ-019 | Secrets and raw credentials SHALL NOT be embedded in Principal, Role Assignment, Delegation, Authority Resolution, or ordinary workspace records. | Secret-handling inspection |
| GAEP-IDAUTH-REQ-020 | Group-based authority SHALL preserve effective membership, source, time, and scope needed to reconstruct the decision. | Historical-membership scenario |
| GAEP-IDAUTH-REQ-021 | Ownership transfer SHALL identify outgoing responsibility, incoming acceptance, effective time, and disposition of open obligations, findings, risks, and approvals. | Ownership-transfer scenario |
| GAEP-IDAUTH-REQ-022 | Break-glass or emergency authority SHALL be explicit, least-scoped, time-bounded, attributable, reviewable, and subject to retrospective evidence. | Emergency-authority scenario |
| GAEP-IDAUTH-REQ-023 | Cross-organization authority SHALL identify trust source, accepted identity mapping, scope, and the organization accountable for the action. | Federation authority test |
| GAEP-IDAUTH-REQ-024 | A Role Assignment, Authority Grant, or Delegation change that affects an active decision, run, approval, or transition SHALL trigger re-evaluation before the next material effect. | Revocation-during-run scenario |
| GAEP-IDAUTH-REQ-025 | Provider-specific accounts and identities MAY be mapped to Principals, but SHALL NOT replace the canonical Principal and authority-chain records. | Adapter portability review |
| GAEP-IDAUTH-REQ-026 | An Authority Grant SHALL represent a standing decision right or authority source and SHALL NOT by itself authorize execution, commitment, or an external effect. | Standing-grant misuse test |
| GAEP-IDAUTH-REQ-027 | Every Authority Resolution SHALL use the controlled eligibility results `eligible`, `eligible-with-constraints`, `additional-authorization-required`, `ineligible`, or `indeterminate`; permission vocabulary is reserved for GAEP-CORE-006 Authorization Grants. | Result-vocabulary validation |
| GAEP-IDAUTH-REQ-028 | Any executable path that consumes an Authority Grant or Authority Resolution SHALL also consume a current, exact, applicable Authorization Grant materialized under GAEP-CORE-006 before the effect is committed. | Cross-contract authorization test |

## Segregation and independence

Segregation requirements are policy- and risk-driven, but the identity model supports at least:

- author distinct from sole reviewer;
- requester distinct from exception approver;
- implementation authority distinct from production operation;
- evidence producer distinct from evidence acceptor;
- agent generator distinct from accountable approver;
- identity administrator distinct from high-impact transaction approver.

Where one person exercises multiple roles, each exercised role and compensating control remains explicit.

## Negative cases

| Case | Required result |
|---|---|
| A user can push to the repository | Push access does not authorize baselining, approving, or changing policy. |
| An agent was invoked by an administrator | The agent receives only the action, scope, tools, and duration explicitly granted; it does not inherit all administrator authority. |
| A group member approved an artifact yesterday but left the group today | Historical approval attribution remains; new authorization evaluates current membership and approval validity. |
| A delegate asks a sub-agent to perform a destructive action | The sub-agent acts only if further delegation and the destructive action are explicitly within the effective chain. |
| A display name matches an approver role | The identity remains unverified until an accepted Identity Assertion maps the Principal and role. |
| A credential is available in the environment | Availability is not permission to use it; policy, action, target, and purpose still resolve. |
| An emergency grant has expired | The action is denied or requires new authorization; prior emergency status does not continue silently. |
| A service account writes an approval file | The file is not human approval unless policy explicitly defines a different non-human authorization class for that action. |

## Open decisions

| Open decision ID | Question | Consequence |
|---|---|---|
| GAEP-IDAUTH-OD-001 | Which identity-assurance vocabulary belongs in Core rather than profiles? | Affects portable conformance across organizations. |
| GAEP-IDAUTH-OD-002 | May a privacy-preserving or pseudonymous human identity provide accountable approval in defined contexts? | Affects privacy, audit, and legal accountability. |
| GAEP-IDAUTH-OD-003 | How are team or committee decisions represented when accountability is intentionally collective? | Affects multi-party approval and quorum models. |
| GAEP-IDAUTH-OD-004 | Which authority-chain integrity mechanisms are required by each conformance class? | Affects signatures, attestations, and offline workflows without selecting technology. |
| GAEP-IDAUTH-OD-005 | Should standing automation authority have a maximum Core validity interval? | Affects operational automation and mandatory re-authorization. |

## Cross-contract dependencies

- Organization, Managed Asset, Initiative, Change, and Workspace scopes come from GAEP-CORE-001.
- Principal-owned and authority-bearing records use the revision model in GAEP-CORE-003.
- Authority-changing events and concurrency rules use GAEP-CORE-004.
- Policy effects, risk, and obligations are defined in GAEP-CORE-005.
- Human approval and executable Authorization Grants are separated in GAEP-CORE-006.
