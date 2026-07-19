---
id: GAEP-RM-003
title: Implementation Readiness Gate
document_type: roadmap
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Assurance Authority
scope: Evidence evaluation for the readiness of one bounded implementation slice
normative_level: normative
classification: internal
provenance: GAEP pre-implementation restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CST-003
  - GAEP-CORE-006
  - GAEP-CORE-007
  - GAEP-STR-003
  - GAEP-STR-006
  - GAEP-RM-008
informative_references:
  - ../06_GAEP_On_GAEP/005_ASSURANCE_CASE.md
  - 007_IMPLEMENTATION_AUTHORIZATION_PROCESS.md
supersedes: []
---

# Implementation Readiness Gate

## Gate requirements

| Requirement ID | Required condition | Evidence |
|---|---|---|
| GAEP-READY-REQ-001 | One first-horizon product form and distribution mode SHALL be approved. | Product and distribution decisions |
| GAEP-READY-REQ-002 | Target segment, anti-segment, sponsor, buyer, operator, reviewer, steward and beneficiary SHALL be explicit. | Stakeholder model and assignments |
| GAEP-READY-REQ-003 | The first workflow SHALL be selected from problem and alternatives evidence. | Research and workflow decision |
| GAEP-READY-REQ-004 | GAEP SHALL have a governed GAEP-on-GAEP workspace with current decisions, risks, applicability and assurance case. | Workspace review |
| GAEP-READY-REQ-005 | Managed Asset, Initiative, Change, Work Item, Implementation Unit and Workspace SHALL have unambiguous definitions and cardinalities. | Core model review |
| GAEP-READY-REQ-006 | Core, Profile, Realization, Adapter and organizational-binding boundaries SHALL be explicit. | Dependency and ownership review |
| GAEP-READY-REQ-007 | Every Core concept SHALL have one normative owner and canonical registry entry where controlled values apply. | Semantic registry review |
| GAEP-READY-REQ-008 | State, authority, applicability, version, baseline and relationship contradictions SHALL be resolved. | Contradiction closure evidence |
| GAEP-READY-REQ-009 | Policy and profile resolution SHALL be deterministic for representative and conflict scenarios. | Resolution scenario results |
| GAEP-READY-REQ-010 | Identity, delegation, accountable-human chain, approval binding, revocation and audit integrity SHALL be approved. | Trust and authorization review |
| GAEP-READY-REQ-011 | Threat, data/privacy/records, AI System, supplier, assurance, Audit Integrity/Accountability, and Incident Response/Continuity profiles SHALL cover the first slice wherever their applicability triggers are met; non-selection SHALL have explicit rationale. | Profile selection, approvals and evidence |
| GAEP-READY-REQ-012 | External authority, portability and multi-repository behavior SHALL be validated without unowned double entry. | Mapping/federation scenarios |
| GAEP-READY-REQ-013 | A lightweight and a high-risk profile path SHALL pass paper scenarios. | Scenario evidence |
| GAEP-READY-REQ-014 | Manual Product and non-Product pilots SHALL demonstrate repeat value and acceptable burden. | Pilot reports and metrics |
| GAEP-READY-REQ-015 | Value, burden, trust, economic and stop-investment thresholds SHALL have accountable owners and approved results. | Scorecard and decision |
| GAEP-READY-REQ-016 | Normative requirements SHALL have stable IDs, verification mappings, valid metadata and acyclic normative dependencies. | Candidate conformance report |
| GAEP-READY-REQ-017 | Ownership, capacity, funding, support, distribution, licensing and change governance SHALL be assigned. | Operating model approvals |
| GAEP-READY-REQ-018 | Exact candidate versions SHALL receive a version-bound baseline approval. | Candidate Revision Set, Baseline Proposal, Approval Determination, and Baseline Set |
| GAEP-READY-REQ-019 | The proposed implementation slice SHALL have explicit scope, exclusions, build/buy/compose decision, quality attributes, threat model, evidence plan and kill criteria. | Implementation-slice charter |
| GAEP-READY-REQ-020 | The gate package SHALL identify downstream activity boundaries and the separate decision and approval process that would apply after evaluation; the gate SHALL NOT create those records. | Process-boundary review |
| GAEP-READY-REQ-021 | Independent participants SHALL demonstrate comprehension and completion of the proposed workflow, including accessibility, affected-contributor, challenge, and facilitator-dependence evidence. | Usability and role-journey evidence |
| GAEP-READY-REQ-022 | Material net-new structure in the proposed implementation slice SHALL have a current Complexity and Subtraction Gate Evaluation and a separate scope Decision covering simpler, compose, defer, no-action, and exit options. | Complexity evaluations and Decision Records |

## Gate result

The Gate Evaluation records exactly one result from the controlled Core set: `not-assessed`, `incomplete`, `failed`, `conditionally-passed`, `passed`, or `blocked`.

The record contains the criteria evaluated, non-applicable criteria and rationale, evidence references, findings, conditions, accountable evaluator, effective time, expiry and invalidation triggers required by `GAEP-CORE-007`. It does not encode an investment choice, approval determination, baseline designation, or activity permission as a gate result.

Any downstream decision, approval, or authorization follows its own Core record and process. `GAEP-RM-007` describes the proposed downstream activity-boundary process. Missing evidence, silence, authorship, repository write access, conversational agreement, or completion of this checklist cannot change the Gate Evaluation result into another state dimension.
