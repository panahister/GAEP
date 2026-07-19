---
id: GAEP-SELF-011
title: GAEP Product Decision Crosswalk
document_type: workspace-record
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Decision and Authorization Steward
scope: Complete mapping of GAEP Product Strategy open decisions to GAEP-on-GAEP Decision Records
normative_level: informative
classification: internal
provenance: GAEP pre-implementation restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CORE-006
informative_references:
  - 003_DECISION_REGISTER.md
  - ../00_GAEP_Product_Strategy/001_PRODUCT_CHARTER.md
  - ../00_GAEP_Product_Strategy/002_PROBLEM_EVIDENCE_AND_THEORY_OF_CHANGE.md
  - ../00_GAEP_Product_Strategy/003_USERS_STAKEHOLDERS_AND_JOBS.md
  - ../00_GAEP_Product_Strategy/004_POSITIONING_AND_ALTERNATIVES.md
  - ../00_GAEP_Product_Strategy/005_SCOPE_AND_CAPABILITY_STRATEGY.md
  - ../00_GAEP_Product_Strategy/006_OUTCOMES_ECONOMICS_AND_BURDEN.md
  - ../00_GAEP_Product_Strategy/007_OPERATING_MODEL.md
  - ../00_GAEP_Product_Strategy/008_DISTRIBUTION_LICENSE_AND_ECOSYSTEM.md
supersedes: []
---

# GAEP Product Decision Crosswalk

## Status and interpretation

This crosswalk accounts for every `GAEP-STR-*-DEC-*` record in Product Strategy versions `0.1.0`. It groups related source questions under the GAEP-on-GAEP Decision Records in `GAEP-SELF-003`; grouping does not merge their evidence needs or silently answer them.

Every row has Decision authoring lifecycle `draft` and Decision Outcome `unresolved`. Every candidate accountable role is unassigned because no accountable organization, appointing authority, identity, assignment scope, validity interval, or delegation exists. Recommendations in Product Strategy remain Recommendations.

## Product Charter decisions

| Source decision | Roll-up Decision Record | Candidate accountable role and authority status | Evidence and disposition route |
|---|---|---|---|
| GAEP-STR-CHR-DEC-001 | GAEP-DEC-011 | GAEP Product Owner and GAEP Product Research Owner; unassigned | segment/anti-segment evidence; Product evidence stage and Candidate Baseline Gate |
| GAEP-STR-CHR-DEC-002 | GAEP-DEC-002 | GAEP Product Owner; unassigned | role observation and first-workflow comparison; Pilot Readiness Gate |
| GAEP-STR-CHR-DEC-003 | GAEP-DEC-002, GAEP-DEC-005 | GAEP Product Owner and GAEP Specification Steward; unassigned | profile/workflow scenarios and burden evidence; Complexity and Subtraction Gate |
| GAEP-STR-CHR-DEC-004 | GAEP-DEC-001, GAEP-DEC-010 | GAEP Product Owner and GAEP Distribution and Ecosystem Owner; unassigned | product-form, distribution, legal, and operating evidence; Candidate Baseline Gate |
| GAEP-STR-CHR-DEC-005 | GAEP-DEC-017, GAEP-DEC-019 | GAEP Product Owner, GAEP Metric Integrity Owner, and GAEP Investment Sponsor; unassigned | baseline metrics, thresholds, and separate gate/decision/authorization evidence; Implementation Readiness Gate |
| GAEP-STR-CHR-DEC-006 | GAEP-DEC-005 | GAEP Specification Steward and GAEP Product Owner; unassigned | first-pilot dependency and subtraction analysis; Complexity and Subtraction Gate |

## Problem evidence decisions

| Source decision | Roll-up Decision Record | Candidate accountable role and authority status | Evidence and disposition route |
|---|---|---|---|
| GAEP-STR-EVD-DEC-001 | GAEP-DEC-011, GAEP-DEC-002 | GAEP Product Research Owner and GAEP Product Owner; unassigned | cohort and workflow sampling decision; Pilot Readiness Gate |
| GAEP-STR-EVD-DEC-002 | GAEP-DEC-017 | GAEP Product Research Owner and GAEP Metric Integrity Owner; unassigned | historical sample, comparison method, bias and limitations; Pilot Readiness Gate |
| GAEP-STR-EVD-DEC-003 | GAEP-DEC-018 | GAEP Product Research Owner and GAEP Assurance Authority; unassigned | competence, independence, conflict, and assignment records; Candidate Baseline Gate |
| GAEP-STR-EVD-DEC-004 | GAEP-DEC-013 | GAEP Data, Privacy, and Records Authority; unassigned | data inventory, access, classification, retention, and authority; Pilot Readiness Gate |
| GAEP-STR-EVD-DEC-005 | GAEP-DEC-017 | GAEP Product Owner and GAEP Investment Sponsor; unassigned | predeclared proceed/narrow/pivot/pause/stop criteria; Pilot Readiness Gate |
| GAEP-STR-EVD-DEC-006 | GAEP-DEC-006, GAEP-DEC-009 | GAEP Product Research Owner and GAEP Workspace Steward; unassigned | Product/non-Product transfer and provider-independent evidence; Candidate Baseline Gate |

## User and stakeholder decisions

| Source decision | Roll-up Decision Record | Candidate accountable role and authority status | Evidence and disposition route |
|---|---|---|---|
| GAEP-STR-USR-DEC-001 | GAEP-DEC-002 | GAEP Product Owner; unassigned | daily-work observation and usability evidence; Pilot Readiness Gate |
| GAEP-STR-USR-DEC-002 | GAEP-DEC-011 | GAEP Product Owner and GAEP Product Research Owner; unassigned | organization-segment research and anti-segment test; Product evidence stage |
| GAEP-STR-USR-DEC-003 | GAEP-DEC-018 | GAEP Assurance Authority; unassigned | risk-proportionate independence rule and pilot assignment; Pilot Readiness Gate |
| GAEP-STR-USR-DEC-004 | GAEP-DEC-017 | GAEP Metric Integrity Owner and GAEP Decision and Authorization Steward; unassigned | reviewer-attention baseline and latency budget; Pilot Readiness Gate |
| GAEP-STR-USR-DEC-005 | GAEP-DEC-013, GAEP-DEC-018 | GAEP Data, Privacy, and Records Authority and GAEP Organizational Trust Authority; unassigned | workforce, privacy, labor, consultation, and jurisdiction review; Pilot Readiness Gate |
| GAEP-STR-USR-DEC-006 | GAEP-DEC-012 | GAEP Adoption Owner and GAEP Operational Authority; unassigned | support/training plan and facilitator-dependence evidence; Pilot Readiness Gate |
| GAEP-STR-USR-DEC-007 | GAEP-DEC-013, GAEP-DEC-018 | GAEP Organizational Trust Authority; unassigned | accessibility and localization needs assessment; Pilot Readiness Gate |

## Positioning and alternatives decisions

| Source decision | Roll-up Decision Record | Candidate accountable role and authority status | Evidence and disposition route |
|---|---|---|---|
| GAEP-STR-POS-DEC-001 | GAEP-DEC-001 | GAEP Product Owner; unassigned | comprehension and category research; Product evidence stage |
| GAEP-STR-POS-DEC-002 | GAEP-DEC-001 | GAEP Product Owner and GAEP Product Research Owner; unassigned | incumbent workflow and alternative comparison; Product evidence stage |
| GAEP-STR-POS-DEC-003 | GAEP-DEC-001 | GAEP Product Owner; unassigned | value and defensibility evidence with claim limitations; Candidate Baseline Gate |
| GAEP-STR-POS-DEC-004 | GAEP-DEC-005, GAEP-DEC-016 | GAEP Product Owner and GAEP Specification Steward; unassigned | build/buy/compose and layer-placement analysis; Complexity and Subtraction Gate |
| GAEP-STR-POS-DEC-005 | GAEP-DEC-009 | GAEP Workspace Steward and GAEP Assurance Authority; unassigned | provider-substitution scenario and evidence invalidation; Candidate Baseline Gate |
| GAEP-STR-POS-DEC-006 | GAEP-DEC-010 | GAEP Product Owner and GAEP Legal, IP, and Supplier Authority; unassigned | claim evidence, audience, legal, and distribution review; Candidate Baseline Gate |

## Scope and capability decisions

| Source decision | Roll-up Decision Record | Candidate accountable role and authority status | Evidence and disposition route |
|---|---|---|---|
| GAEP-STR-SCP-DEC-001 | GAEP-DEC-005 | GAEP Specification Steward and GAEP Core Subject Owners; unassigned | minimum Core trace, scenarios, and non-duplication review; Complexity and Subtraction Gate |
| GAEP-STR-SCP-DEC-002 | GAEP-DEC-002, GAEP-DEC-005 | GAEP Product Owner, applicable domain authorities, and GAEP Profile Specification Steward; unassigned | first-workflow applicability and burden evidence; Pilot Readiness Gate |
| GAEP-STR-SCP-DEC-003 | GAEP-DEC-006 | GAEP Workspace Steward; unassigned | manual representation, portability, and no-double-entry evidence; Pilot Readiness Gate |
| GAEP-STR-SCP-DEC-004 | GAEP-DEC-006, GAEP-DEC-013 | GAEP Workspace Steward and GAEP Data, Privacy, and Records Authority; unassigned | source authority, access, classification, freshness, and retention; Pilot Readiness Gate |
| GAEP-STR-SCP-DEC-005 | GAEP-DEC-009, GAEP-DEC-015 | GAEP Assurance Authority and GAEP AI System Authority; unassigned | deterministic-control boundary and AI trial prerequisites; Pilot Readiness Gate |
| GAEP-STR-SCP-DEC-006 | GAEP-DEC-003, GAEP-DEC-016 | GAEP Specification Steward and GAEP Product Owner; unassigned | exact supersession/removal and recovery analysis; Candidate Baseline Gate |
| GAEP-STR-SCP-DEC-007 | GAEP-DEC-009, GAEP-DEC-019 | GAEP Workspace Steward and GAEP Decision and Authorization Steward; unassigned | portability scenario followed by separate implementation permission process; Implementation Readiness Gate |

## Outcome, economics, and burden decisions

| Source decision | Roll-up Decision Record | Candidate accountable role and authority status | Evidence and disposition route |
|---|---|---|---|
| GAEP-STR-MET-DEC-001 | GAEP-DEC-017 | GAEP Product Owner and GAEP Metric Integrity Owner; unassigned | primary outcome and balanced countermetric decision; Pilot Readiness Gate |
| GAEP-STR-MET-DEC-002 | GAEP-DEC-017 | GAEP Product Research Owner and GAEP Metric Integrity Owner; unassigned | baseline window, case selection, confounders, and comparison method; Pilot Readiness Gate |
| GAEP-STR-MET-DEC-003 | GAEP-DEC-017 | GAEP Product Owner, applicable domain authorities, and GAEP Profile Specification Steward; unassigned | role/risk-segmented burden budgets; Pilot Readiness and Complexity Gates |
| GAEP-STR-MET-DEC-004 | GAEP-DEC-017, GAEP-DEC-019 | GAEP Investment Sponsor and GAEP Metric Integrity Owner; unassigned | predeclared thresholds inform a Decision but do not authorize activity; Implementation Readiness Gate |
| GAEP-STR-MET-DEC-005 | GAEP-DEC-017, GAEP-DEC-018 | GAEP Metric Integrity Owner and GAEP Assurance Authority; unassigned | metric authority, independence, quality, and reporting controls; Pilot Readiness Gate |
| GAEP-STR-MET-DEC-006 | GAEP-DEC-013, GAEP-DEC-017 | GAEP Data, Privacy, and Records Authority; unassigned | purpose, granularity, access, retention, deletion, and prohibited reuse; Pilot Readiness Gate |
| GAEP-STR-MET-DEC-007 | GAEP-DEC-012, GAEP-DEC-017 | GAEP Investment Sponsor; unassigned | funding, shared/local cost allocation, and capacity evidence; Candidate Baseline Gate |
| GAEP-STR-MET-DEC-008 | GAEP-DEC-017 | GAEP Investment Sponsor and GAEP Metric Integrity Owner; unassigned | realized/avoided benefit rules and uncertainty; Implementation Readiness Gate |

## Operating-model decisions

| Source decision | Roll-up Decision Record | Candidate accountable role and authority status | Evidence and disposition route |
|---|---|---|---|
| GAEP-STR-OPS-DEC-001 | GAEP-DEC-018 | appointing authority unresolved; GAEP Constitutional Owner unassigned | accountable identity, mandate, scope, validity, succession, and approval; Candidate Baseline Gate |
| GAEP-STR-OPS-DEC-002 | GAEP-DEC-012 | appointing authority unresolved; GAEP Product Owner and GAEP Investment Sponsor unassigned | organization, funding, outcome, and stop authority; Candidate Baseline Gate |
| GAEP-STR-OPS-DEC-003 | GAEP-DEC-018 | GAEP Identity and Authority Steward; unassigned | role-composition, conflicts, competence, and independence decision; Candidate Baseline Gate |
| GAEP-STR-OPS-DEC-004 | GAEP-DEC-018 | GAEP Assurance Authority; unassigned | risk-based independence and conformance-review method; Candidate Baseline Gate |
| GAEP-STR-OPS-DEC-005 | GAEP-DEC-018 | GAEP Product Owner; unassigned | minimum forum/process and simpler-mechanism comparison; Complexity and Subtraction Gate |
| GAEP-STR-OPS-DEC-006 | GAEP-DEC-012 | GAEP Adoption Owner and GAEP Operational Authority; unassigned | support scope, response target, capacity, escalation, and fallback; Pilot Readiness Gate |
| GAEP-STR-OPS-DEC-007 | GAEP-DEC-012, GAEP-DEC-017 | GAEP Investment Sponsor; unassigned | shared/local cost, funding, and sustainability evidence; Candidate Baseline Gate |
| GAEP-STR-OPS-DEC-008 | GAEP-DEC-018, GAEP-DEC-019 | GAEP Identity and Authority Steward and GAEP Decision and Authorization Steward; unassigned | appeal, deadlock, emergency, expiry, and recovery rules; Candidate Baseline Gate |
| GAEP-STR-OPS-DEC-009 | GAEP-DEC-018, GAEP-DEC-019 | baseline approving and implementation authorizing authorities unresolved | exact Approval and Authorization assignments; Candidate Baseline and Implementation Readiness Gates |

## Distribution, license, and ecosystem decisions

| Source decision | Roll-up Decision Record | Candidate accountable role and authority status | Evidence and disposition route |
|---|---|---|---|
| GAEP-STR-DST-DEC-001 | GAEP-DEC-001, GAEP-DEC-010 | GAEP Product Owner and GAEP Distribution and Ecosystem Owner; unassigned | audience, product form, channel, support, and rights evidence; Candidate Baseline Gate |
| GAEP-STR-DST-DEC-002 | GAEP-DEC-010 | GAEP Legal, IP, and Supplier Authority; unassigned | ownership and mark inventory with authority evidence; Candidate Baseline Gate |
| GAEP-STR-DST-DEC-003 | GAEP-DEC-010 | GAEP Legal, IP, and Supplier Authority and GAEP Distribution and Ecosystem Owner; unassigned | asset-class license/permission decision; Candidate Baseline Gate |
| GAEP-STR-DST-DEC-004 | GAEP-DEC-010 | GAEP Distribution and Ecosystem Owner; unassigned | contribution scope, moderation, provenance, rights, and security process; Candidate Baseline Gate |
| GAEP-STR-DST-DEC-005 | GAEP-DEC-010 | GAEP Distribution and Ecosystem Owner and GAEP Conformance Authority; unassigned | status-label semantics, mark authority, and misuse controls; Candidate Baseline Gate |
| GAEP-STR-DST-DEC-006 | GAEP-DEC-010, GAEP-DEC-018 | GAEP Conformance Authority; unassigned | self-attestation/assessment/certification feasibility and independence; Candidate Baseline Gate |
| GAEP-STR-DST-DEC-007 | GAEP-DEC-010, GAEP-DEC-012 | GAEP Operational Authority and GAEP Distribution and Ecosystem Owner; unassigned | support, vulnerability, compatibility, and end-of-life capacity; Candidate Baseline Gate |
| GAEP-STR-DST-DEC-008 | GAEP-DEC-013 | GAEP Data, Privacy, and Records Authority; unassigned | purpose, consent/notice, minimization, access, retention, and prohibited reuse; Pilot Readiness Gate |
| GAEP-STR-DST-DEC-009 | GAEP-DEC-010, GAEP-DEC-012 | GAEP Investment Sponsor and GAEP Legal, IP, and Supplier Authority; unassigned | commercial participation, conflict, transparency, and funding model; Candidate Baseline Gate |
| GAEP-STR-DST-DEC-010 | GAEP-DEC-010, GAEP-DEC-013 | GAEP Legal, IP, and Supplier Authority; unassigned | legal, procurement, tax, export, sanctions, labor, and jurisdiction review; Candidate Baseline Gate |

## Completeness and change rule

The crosswalk contains 59 source decisions: 6 Charter, 6 Problem Evidence, 7 User/Stakeholder, 6 Positioning, 7 Scope, 8 Metric/Economic, 9 Operating Model, and 10 Distribution decisions. A Product Strategy revision that adds, retires, or changes an open-decision ID must update this crosswalk and the affected roll-up Decision Record in the same governed change.

No row is evidence of a decision, approval, authorization, baseline, product validity, or implementation readiness.
