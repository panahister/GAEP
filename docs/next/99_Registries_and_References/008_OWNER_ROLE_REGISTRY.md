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

This registry makes every current `owner_role` value resolvable without pretending that a role label is a person, team assignment, approval, or executable authority. The four role classes are independent:

- **semantic owner**: stewards meaning, quality, compatibility, and change proposals for a governed subject;
- **decision authority**: may make a bounded decision only when an exact Role Assignment and standing Authority Grant establish scope and validity;
- **reviewer/assessor**: may produce attributable Review Contributions, Evaluation Results, findings, or recommendations but does not thereby approve;
- **operational performer**: may carry out bounded operational work only through an applicable executable Authorization Grant.

Every current concrete assignment is `unassigned`. This is intentional: repository metadata names accountable role types, while Principal or Organization assignments must be established separately under GAEP-CORE-002.

## Canonical roles

`yes` identifies a role class the definition may exercise when separately assigned and authorized; it never grants that authority by itself.

| Role ID | Exact `owner_role` value | Semantic owner | Decision authority | Reviewer / assessor | Operational performer | Bounded responsibility | Current assignment |
|---|---|---:|---:|---:|---:|---|---|
| `gaep.role.ai-system-authority` | AI System Authority | no | yes | yes | no | AI-system risk, use-boundary, and accountable acceptance decisions | unassigned |
| `gaep.role.architecture-authority` | Architecture Authority | no | yes | yes | no | Architecture decision and exception authority for assigned scope | unassigned |
| `gaep.role.assurance-authority` | Assurance Authority | no | yes | yes | no | Assurance sufficiency and acceptance decisions for assigned claims | unassigned |
| `gaep.role.audit-authority` | Audit Authority | no | yes | yes | no | Audit scope, independence, finding, and assurance acceptance | unassigned |
| `gaep.role.capability-steward` | Capability Steward | yes | no | yes | no | Capability-definition meaning, compatibility, and change stewardship | unassigned |
| `gaep.role.data-privacy-authority` | Data and Privacy Authority | no | yes | yes | no | Data handling, privacy risk, and exception decisions | unassigned |
| `gaep.role.engineering-change-authority` | Engineering Change Authority | no | yes | yes | no | Bounded engineering change acceptance and release decisions | unassigned |
| `gaep.role.experiment-authority` | Experiment Authority | no | yes | yes | no | Experiment scope, safety, evidence, and stop decisions | unassigned |
| `gaep.role.adoption-owner` | GAEP Adoption Owner | yes | yes | no | yes | Adoption outcome, sequencing, and organization-level rollout stewardship | unassigned |
| `gaep.role.assurance-steward` | GAEP Assurance Authority | yes | yes | yes | no | GAEP assurance model stewardship and bounded assurance decisions | unassigned |
| `gaep.role.constitutional-owner` | GAEP Constitutional Owner | yes | yes | yes | no | Constitution meaning, amendment proposal, and bounded constitutional decisions | unassigned |
| `gaep.role.core-specification-steward` | GAEP Core Specification Steward | yes | no | yes | no | Small-Core boundary, coherence, and compatibility stewardship | unassigned |
| `gaep.role.profile-specification-steward` | GAEP Profile Specification Steward | yes | no | yes | no | Scoped Profile semantics, applicability-rule meaning, conformance contract, and evolution stewardship | unassigned |
| `gaep.role.decision-authorization-steward` | GAEP Decision and Authorization Steward | yes | no | yes | no | Decision, review, approval, and authorization contract stewardship | unassigned |
| `gaep.role.distribution-ecosystem-owner` | GAEP Distribution and Ecosystem Owner | yes | yes | no | yes | Distribution, packaging, ecosystem, and channel outcome stewardship | unassigned |
| `gaep.role.identity-authority-steward` | GAEP Identity and Authority Steward | yes | no | yes | no | Principal, role, assignment, delegation, and standing-authority semantics | unassigned |
| `gaep.role.integration-steward` | GAEP Integration Steward | yes | no | yes | yes | Integration contract stewardship and bounded operational coordination | unassigned |
| `gaep.role.policy-risk-steward` | GAEP Policy and Risk Steward | yes | no | yes | no | Policy, risk, exception, and obligation semantics | unassigned |
| `gaep.role.product-owner` | GAEP Product Owner | yes | yes | no | no | Product scope, value, priority, and outcome decisions | unassigned |
| `gaep.role.product-research-owner` | GAEP Product Research Owner | yes | yes | yes | no | Research scope, method fitness, and product-discovery stewardship | unassigned |
| `gaep.role.reference-steward` | GAEP Reference Steward | yes | no | yes | no | External-source identity, currency, rights, and mapping stewardship | unassigned |
| `gaep.role.resource-version-steward` | GAEP Resource and Version Steward | yes | no | yes | no | Resource identity, revision, candidate-set, and baseline semantics | unassigned |
| `gaep.role.risk-owner` | GAEP Risk Owner | yes | yes | yes | no | Assigned risk treatment, escalation, and acceptance proposal ownership | unassigned |
| `gaep.role.runtime-steward` | GAEP Runtime Steward | yes | no | yes | yes | Runtime semantic contract and bounded operational stewardship | unassigned |
| `gaep.role.security-authority` | GAEP Security Authority | yes | yes | yes | no | GAEP-wide security risk, control, and exception decisions | unassigned |
| `gaep.role.semantic-registry-steward` | GAEP Semantic Registry Steward | yes | no | yes | no | Terminology, relationship, state, and owner-role registry stewardship | unassigned |
| `gaep.role.specification-steward` | GAEP Specification Steward | yes | no | yes | no | Cross-document specification coherence and change stewardship | unassigned |
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

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-ROLE-REQ-001 | Every `owner_role` used by a GAEP Next document SHALL resolve to exactly one active registry entry and exact machine role ID. | Metadata-to-registry cross-check |
| GAEP-ROLE-REQ-002 | Semantic ownership SHALL NOT imply decision authority, approval authority, review independence, operational permission, or executable authorization. | Owner-label escalation test |
| GAEP-ROLE-REQ-003 | Decision authority SHALL require a separate current Role Assignment and standing Authority Grant binding Principal, decision class, scope, time, constraints, and authority source. | Decision-authority resolution test |
| GAEP-ROLE-REQ-004 | Reviewer or assessor classification SHALL permit attributable evaluation or review work only within an assignment and SHALL NOT imply Approval Determination, Risk Acceptance, exception, or Authorization Grant. | Reviewer-escalation negative test |
| GAEP-ROLE-REQ-005 | Operational-performer classification SHALL require a current exact Authorization Grant for every executable effect and SHALL NOT inherit semantic ownership or decision authority. | Operational-effect authorization test |
| GAEP-ROLE-REQ-006 | A missing concrete Principal or Organization assignment SHALL be represented as `unassigned`; a role label, group name, repository account, or author SHALL NOT be substituted. | Assignment-presence inspection |
| GAEP-ROLE-REQ-007 | A role MAY carry more than one class only when each class is explicit, and the authority, independence, and segregation rules for the actual interaction remain separately evaluated. | Multi-class role scenario |
| GAEP-ROLE-REQ-008 | Renamed or merged roles SHALL preserve the prior role ID as a deprecated alias with migration disposition and SHALL NOT silently transfer assignments or authority. | Role-migration review |

## Candidate-baseline gate

No document using an unregistered role value, and no required approval or operational path whose concrete role assignment remains unassigned, may claim baseline readiness. This registry defines role types only; all current assignments remain intentionally unresolved.
