---
id: GAEP-REG-008
title: Candidate Owner Role Registry
document_type: registry
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Semantic Registry Steward
scope: Canonical owner-role values used by GAEP Next document metadata and governance records
normative_level: normative
classification: internal
provenance: GAEP pre-implementation structural repair
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CST-003
informative_references: []
supersedes: []
---

# Candidate Owner Role Registry

## Purpose and boundary

This registry makes every current `owner_role` value resolvable without pretending that a role label is a person, team assignment, approval, or executable authority. The five role classes are independent:

- **semantic owner**: stewards meaning, quality, compatibility, and change proposals for a governed subject;
- **decision authority**: may make a bounded decision only when an exact Role Assignment and standing Authority Grant establish scope and validity;
- **approval authority**: may issue a bounded Approval Determination only when the role is explicitly classified below and an exact Role Assignment, standing Authority Grant, applicable policy, Approval Case, and subject revision establish scope and validity; it is not implied by decision authority or review competence;
- **reviewer/assessor**: may produce attributable Review Contributions, Evaluation Results, findings, or recommendations but does not thereby approve;
- **operational performer**: may carry out bounded operational work only through an applicable executable Authorization Grant.

No concrete assignment is currently effective. `GAEP-SELF-009` contains a bounded package of proposed Role Assignments for Principal `mehdi-panahi`, but explicit acceptance is pending and every effective time remains unset. Repository metadata names accountable role types, while Principal or Organization assignments, their scope, and their validity remain separate records under GAEP-CORE-001.

## Canonical roles

`yes` identifies a role class the definition may exercise when separately assigned and authorized; it never grants that authority by itself. The main table retains separate semantic-owner, decision-authority, reviewer, and operational columns. Formal approval authority is intentionally not folded into the decision column and is declared in the approval-authority overlay below.

| Role ID | Exact `owner_role` value | Semantic owner | Decision authority | Reviewer / assessor | Operational performer | Bounded responsibility | Current assignment |
|---|---|---:|---:|---:|---:|---|---|
| `gaep.role.ai-system-authority` | AI System Authority | no | yes | yes | no | AI-system risk, use-boundary, and accountable acceptance decisions | unassigned |
| `gaep.role.architecture-authority` | Architecture Authority | no | yes | yes | no | Architecture decision and exception authority for assigned scope | unassigned |
| `gaep.role.assurance-authority` | Assurance Authority | no | yes | yes | no | Assurance sufficiency and acceptance decisions for assigned claims | unassigned |
| `gaep.role.audit-authority` | Audit Authority | no | yes | yes | no | Audit scope, independence, finding, and assurance acceptance | unassigned |
| `gaep.role.candidate-baseline-approver` | Candidate Baseline Approver | no | no | yes | no | Version-bound evaluation and Approval Determination for an exact Candidate Baseline Proposal; never a Decision Outcome, baseline designation, or implementation permission by itself | unassigned |
| `gaep.role.candidate-baseline-proposer` | Candidate Baseline Proposer | no | no | no | no | Assembly and submission of an exact Candidate Revision Set through a Baseline Proposal without approval or designation authority | `GAEP-RA-008` proposed for `mehdi-panahi`; not effective |
| `gaep.role.capability-steward` | Capability Steward | yes | no | yes | no | Capability-definition meaning, compatibility, and change stewardship | unassigned |
| `gaep.role.data-privacy-authority` | Data and Privacy Authority | no | yes | yes | no | Data handling, privacy risk, and exception decisions | unassigned |
| `gaep.role.engineering-change-authority` | Engineering Change Authority | no | yes | yes | no | Bounded engineering change acceptance and release decisions | unassigned |
| `gaep.role.experiment-authority` | Experiment Authority | no | yes | yes | no | Experiment scope, safety, evidence, and stop decisions | unassigned |
| `gaep.role.adoption-owner` | GAEP Adoption Owner | yes | yes | no | yes | Adoption outcome, sequencing, and organization-level rollout stewardship | unassigned |
| `gaep.role.assurance-steward` | GAEP Assurance Authority | yes | yes | yes | no | GAEP assurance model stewardship and bounded assurance decisions | unassigned |
| `gaep.role.constitutional-owner` | GAEP Constitutional Owner | yes | yes | yes | no | Constitution meaning, amendment proposal, and bounded constitutional decisions | `GAEP-RA-006` proposed for `mehdi-panahi`; not effective |
| `gaep.role.core-specification-steward` | GAEP Core Specification Steward | yes | no | yes | no | Small-Core boundary, coherence, and compatibility stewardship | `GAEP-RA-004` proposed for `mehdi-panahi`; not effective |
| `gaep.role.profile-specification-steward` | GAEP Profile Specification Steward | yes | no | yes | no | Scoped Profile semantics, applicability-rule meaning, conformance contract, and evolution stewardship | unassigned |
| `gaep.role.decision-authorization-steward` | GAEP Decision and Authorization Steward | yes | no | yes | no | Decision, review, approval, and authorization contract stewardship | unassigned |
| `gaep.role.distribution-ecosystem-owner` | GAEP Distribution and Ecosystem Owner | yes | yes | no | yes | Distribution, packaging, ecosystem, and channel outcome stewardship | unassigned |
| `gaep.role.identity-authority-steward` | GAEP Identity and Authority Steward | yes | no | yes | no | Principal, role, assignment, delegation, and standing-authority semantics | `GAEP-RA-007` proposed for `mehdi-panahi`; not effective |
| `gaep.role.independent-reviewer` | GAEP Independent Reviewer | no | no | yes | no | Qualified, conflict-disclosed challenge of an exact subject within declared competence; no approval authority by default | unassigned |
| `gaep.role.initiative-sponsor` | GAEP Initiative Sponsor | no | yes | no | no | Scope, priority, resourcing, narrowing, pause, and stop decisions for one assigned GAEP Initiative | `GAEP-RA-001` proposed for `mehdi-panahi`; not effective |
| `gaep.role.integration-steward` | GAEP Integration Steward | yes | no | yes | yes | Integration contract stewardship and bounded operational coordination | unassigned |
| `gaep.role.policy-risk-steward` | GAEP Policy and Risk Steward | yes | no | yes | no | Policy, risk, exception, and obligation semantics | unassigned |
| `gaep.role.product-owner` | GAEP Product Owner | yes | yes | no | no | Product scope, value, priority, and outcome decisions | `GAEP-RA-002` proposed for `mehdi-panahi`; not effective |
| `gaep.role.product-research-owner` | GAEP Product Research Owner | yes | yes | yes | no | Research scope, method fitness, and product-discovery stewardship | unassigned |
| `gaep.role.reference-steward` | GAEP Reference Steward | yes | no | yes | no | External-source identity, currency, rights, and mapping stewardship | unassigned |
| `gaep.role.resource-version-steward` | GAEP Resource and Version Steward | yes | no | yes | no | Resource identity, revision, candidate-set, and baseline semantics | unassigned |
| `gaep.role.risk-owner` | GAEP Risk Owner | yes | yes | yes | no | Assigned risk treatment, escalation, and acceptance proposal ownership | unassigned |
| `gaep.role.runtime-steward` | GAEP Runtime Steward | yes | no | yes | yes | Runtime semantic contract and bounded operational stewardship | unassigned |
| `gaep.role.security-authority` | GAEP Security Authority | yes | yes | yes | no | GAEP-wide security risk, control, and exception decisions | unassigned |
| `gaep.role.semantic-decision-authority` | Semantic Decision Authority | no | yes | no | no | Accountable selection or interpretation of an exact semantic question within a declared specification scope; stewardship alone does not confer this authority | `GAEP-RA-005` proposed for `mehdi-panahi`; not effective |
| `gaep.role.semantic-registry-steward` | GAEP Semantic Registry Steward | yes | no | yes | no | Terminology, relationship, state, and owner-role registry stewardship | unassigned |
| `gaep.role.specification-steward` | GAEP Specification Steward | yes | no | yes | no | Cross-document specification coherence and change stewardship | `GAEP-RA-003` proposed for `mehdi-panahi`; not effective |
| `gaep.role.state-registry-steward` | GAEP State Registry Steward | yes | no | yes | no | State-dimension and controlled-value registry stewardship | unassigned |
| `gaep.role.state-event-steward` | GAEP State and Event Steward | yes | no | yes | no | Statechart, transition, and event semantic stewardship | unassigned |
| `gaep.role.workspace-steward` | GAEP Workspace Steward | yes | no | yes | yes | Workspace contract stewardship and bounded workspace operations | unassigned |
| `gaep.role.incident-continuity-authority` | Incident and Continuity Authority | no | yes | yes | yes | Incident command, containment, continuity, and recovery decisions | unassigned |
| `gaep.role.legal-supplier-authority` | Legal and Supplier Authority | no | yes | yes | no | Legal, contract, sourcing, and supplier-risk decisions | unassigned |
| `gaep.role.migration-authority` | Migration Authority | no | yes | yes | yes | Migration acceptance, sequencing, cutover, and rollback decisions | unassigned |
| `gaep.role.operational-authority` | Operational Authority | no | yes | yes | yes | Operational change, execution, containment, and recovery decisions | unassigned |
| `gaep.role.organizational-trust-authority` | Organizational Trust Authority | no | yes | yes | no | Workforce trust, accessibility, ethics, affected-person protections, and cross-organization trust, identity-mapping, and delegation decisions | unassigned |
| `gaep.role.product-governance-authority` | Product Governance Authority | no | yes | yes | no | Product-governance, portfolio, release, and exception decisions | unassigned |
| `gaep.role.security-authority-generic` | Security Authority | no | yes | yes | no | Security acceptance and exception decisions outside the GAEP-specific alias | unassigned |

### Approval-authority overlay

Approval authority defaults to `no` for every registered role unless listed here as `yes`. This overlay classifies capability only; it creates no assignment, standing authority, Approval Determination, baseline designation, or executable permission.

| Role ID | Approval authority | Exact approval boundary |
|---|---:|---|
| `gaep.role.candidate-baseline-approver` | yes | May issue a version-bound Approval Determination for one exact Candidate Baseline Proposal when separately assigned and granted standing authority; cannot propose on behalf of an unassigned proposer, designate the Baseline Set, or authorize implementation. |
| `gaep.role.constitutional-owner` | yes | May issue the constitutionally required version-bound Approval Determination for one exact amendment or supersession package within assigned scope; cannot silently supersede legacy content, approve a baseline, or authorize implementation. |

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-ROLE-REQ-001 | Every `owner_role` used by a GAEP Next document SHALL resolve to exactly one active registry entry and exact machine role ID. | Metadata-to-registry cross-check |
| GAEP-ROLE-REQ-002 | Semantic ownership SHALL NOT imply decision authority, approval authority, review independence, operational permission, or executable authorization. | Owner-label escalation test |
| GAEP-ROLE-REQ-003 | Decision authority SHALL require a separate current Role Assignment and standing Authority Grant binding Principal, decision class, scope, time, constraints, and authority source. | Decision-authority resolution test |
| GAEP-ROLE-REQ-004 | Reviewer or assessor classification SHALL permit attributable evaluation or review work only within an assignment and SHALL NOT imply Approval Determination, Risk Acceptance, exception, or Authorization Grant. An Approval Determination SHALL additionally require explicit approval-authority classification, an exact current Role Assignment and standing Authority Grant, applicable policy, Approval Case, and exact subject revision. | Reviewer and approval-authority escalation negative tests |
| GAEP-ROLE-REQ-005 | Operational-performer classification SHALL require a current exact Authorization Grant for every executable effect and SHALL NOT inherit semantic ownership or decision authority. | Operational-effect authorization test |
| GAEP-ROLE-REQ-006 | A missing concrete Principal or Organization assignment SHALL be represented as `unassigned`; a proposed assignment awaiting creation, acceptance, or its effective time SHALL be represented as not effective; a role label, group name, repository account, or author SHALL NOT be substituted. | Assignment-presence and pending-state inspection |
| GAEP-ROLE-REQ-007 | A role MAY carry more than one class only when each class is explicit, and the authority, independence, and segregation rules for the actual interaction remain separately evaluated. | Multi-class role scenario |
| GAEP-ROLE-REQ-008 | Renamed or merged roles SHALL preserve the prior role ID as a deprecated alias with migration disposition and SHALL NOT silently transfer assignments or authority. | Role-migration review |

## Candidate-baseline gate

No document using an unregistered role value, and no required decision, approval, or operational path whose concrete Role Assignment or required standing Authority Grant is absent, unassigned, pending, expired, conflicted, out of scope, or otherwise ineffective, may claim baseline readiness. This registry defines role types only and establishes no standing Authority Grant. The proposed assignments referenced above do not become effective through this table or through authorship; `GAEP-SELF-009` must bind an exact assignment revision and record explicit acceptance and effective time. Candidate Baseline Approver, GAEP Independent Reviewer, and GAEP Assurance Authority remain explicitly unassigned.
