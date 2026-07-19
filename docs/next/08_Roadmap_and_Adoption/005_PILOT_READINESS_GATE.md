---
id: GAEP-RM-005
title: Pilot Readiness Gate
document_type: roadmap
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Product Research Owner
scope: Readiness evaluation for a manual or concierge GAEP pilot
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
  - GAEP-STR-002
  - GAEP-STR-003
  - GAEP-STR-006
  - GAEP-PROF-011
  - GAEP-PROF-015
informative_references:
  - ../06_GAEP_On_GAEP/006_MANUAL_PILOT_AND_EVIDENCE_PLAN.md
supersedes: []
---

# Pilot Readiness Gate

## Purpose

This gate evaluates whether a proposed manual pilot is sufficiently bounded, ethical, measurable, supported, and privacy-aware to request approval and authorization. Passing the gate does not itself authorize participant recruitment, data collection, external communication, production access, or organizational mandate.

## Requirements

| Requirement ID | Required condition | Evidence |
|---|---|---|
| GAEP-PILOT-READY-REQ-001 | The pilot SHALL identify hypothesis, cohort, selection method, workflow, scope, prohibited activity, duration, owner and stop conditions. | Pilot charter |
| GAEP-PILOT-READY-REQ-002 | Participant roles, incentives, power relationships, accessibility needs, recruitment, informed notice or consent where applicable, challenge and withdrawal paths SHALL be defined. | Participant protocol |
| GAEP-PILOT-READY-REQ-003 | A baseline and comparison method SHALL identify case-selection, novelty, facilitator, learning and concurrent-change limitations. | Evaluation design |
| GAEP-PILOT-READY-REQ-004 | Every collected metric SHALL have an approved metric contract covering purpose, formula, owner, source, access, retention, privacy, target or decision threshold, countermetric and prohibited reuse. | Metric registry review |
| GAEP-PILOT-READY-REQ-005 | Author, reviewer, approver, steward, facilitator, support and affected-participant burden SHALL have candidate budgets or a time-bounded method to establish them. | Burden plan |
| GAEP-PILOT-READY-REQ-006 | Pilot telemetry SHALL NOT be used for individual performance ranking, discipline or undisclosed model improvement. | Data-use policy |
| GAEP-PILOT-READY-REQ-007 | Data classes, authoritative sources, AI/provider use, classification, minimization, access, residency, retention, deletion and incident handling SHALL be resolved for the pilot scope. | Data and provider assessment |
| GAEP-PILOT-READY-REQ-008 | The pilot SHALL identify facilitator competence, support, escalation, exception and harm-response paths. | Operating plan |
| GAEP-PILOT-READY-REQ-009 | Product and non-Product cases SHALL be selected or an explicit decision SHALL explain the narrower claim being tested. | Case selection decision |
| GAEP-PILOT-READY-REQ-010 | Independent comprehension, task completion, reviewer attention, affected-person and accessibility evidence SHALL be collected proportionately. | Usability plan |
| GAEP-PILOT-READY-REQ-011 | Proceed, narrow, pivot, pause and stop thresholds SHALL be set before results are observed. | Decision rule |
| GAEP-PILOT-READY-REQ-012 | The Approval Case SHALL identify exact pilot materials, versions, conditions, responsible authorities and any permitted external or production effects. | Approval package |

## Result and subsequent authority

The Gate Evaluation result is `not-assessed`, `incomplete`, `failed`, `conditionally-passed`, `passed`, or `blocked`. A separate Approval Determination and Authorization Grant are required for the exact pilot activities where policy requires permission.
