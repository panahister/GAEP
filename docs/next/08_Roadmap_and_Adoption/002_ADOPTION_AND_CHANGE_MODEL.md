---
id: GAEP-RM-002
title: Adoption and Change Model
document_type: roadmap
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Adoption Owner
scope: Organizational evaluation and adoption of GAEP
normative_level: mixed
classification: internal
provenance: GAEP pre-implementation restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CST-003
  - GAEP-STR-003
  - GAEP-STR-006
  - GAEP-PROF-015
informative_references:
  - ../../06_Roadmap/052_ADOPTION_GUIDE.md
supersedes: []
---

# Adoption and Change Model

## Adoption principle

GAEP should replace fragmented work, not add a parallel compliance layer. Every mandatory activity identifies which existing task, handoff, re-explanation, review or record it replaces. Unavoidable net-new burden has an explicit value hypothesis and budget.

## Readiness segments

- **Not ready:** no sponsor, no accountable owners, no stable source authority, or no willingness to measure burden.
- **Exploration ready:** bounded manual pilot with explicit non-production scope.
- **Workflow ready:** selected job, participating roles, baseline measures and support capacity exist.
- **Scale ready:** repeat value, stable semantics, support, integration ownership and trust controls exist.
- **Regulated ready:** independent assurance, records, identity, audit and jurisdiction mappings are approved.

These are organizational adoption states, not product-conformance claims.

## Change system

Adoption planning addresses:

- sponsor behavior and decision rights;
- workflow owners and local champions;
- reviewer and approver capacity;
- role learning outcomes rather than document-reading completion;
- migration and no-double-entry design;
- resistance diagnosis and safe challenge;
- psychological safety and workforce-monitoring limits;
- support, office hours, escalation and incident ownership;
- feedback, simplification, profile retirement and expansion gates;
- exit, export and manual fallback.

## Governance burden budget

Before a profile is selected for a pilot, it must declare candidate maximums or targets for required fields, author time, reviewer time, approval latency, handoffs, maintenance and exception resolution, or a time-bounded plan to establish them. Pilot evidence sets actual thresholds. A profile that cannot justify its burden is narrowed, redesigned, or removed.

## Role-composition profiles

- **small:** combined roles are expected; critical separation of duties is risk-triggered;
- **standard:** product/technical author, reviewer, approver and steward are usually distinct;
- **enterprise:** federated authorities, support, identity integration and service ownership are explicit;
- **regulated/high-consequence:** independent review, stronger evidence, records, audit and challenge paths apply.

## Harm prevention

Adoption metrics are not automatically employee-performance metrics. Participation data has declared purpose, minimization, transparency, access, retention and appeal. Teams are not rewarded merely for artifact counts or trace density; outcomes and useful simplification matter.

## Expansion rule

Expand to another workflow, profile, team or repository only when the current scope demonstrates repeat value, acceptable burden, stable ownership, controlled risk and portable exit. Expansion is not a substitute for solving failures in the first workflow.

## Adoption requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-ADOPT-REQ-001 | A GAEP adoption SHALL identify the existing work it replaces and any net-new burden, value hypothesis, owner and budget. | Workflow substitution review |
| GAEP-ADOPT-REQ-002 | Pilot and expansion decisions SHALL include independent comprehension, task completion, accessibility, facilitator-dependence, reviewer-attention and affected-person evidence. | Adoption evidence review |
| GAEP-ADOPT-REQ-003 | A selected profile SHALL satisfy GAEP-STR-MET-REQ-008 before pilot authorization. | Profile and Pilot Readiness Gate review |
| GAEP-ADOPT-REQ-004 | Adoption telemetry SHALL have declared purpose, minimization, access, retention, prohibited reuse, transparency and challenge under the applicable data and workforce-trust profiles. | Telemetry governance review |
| GAEP-ADOPT-REQ-005 | Expansion SHALL require repeat value, acceptable burden, stable ownership, controlled risk, support capacity and a tested portable exit. | Expansion gate |
| GAEP-ADOPT-REQ-006 | Role combination SHALL be visible and SHALL preserve any risk-required independence or compensating control. | Role-assignment review |
| GAEP-ADOPT-REQ-007 | Adoption SHALL retain a manual/pause path and SHALL NOT make authoritative governance state dependent on one AI provider or unexportable system. | Exit and continuity scenario |
| GAEP-ADOPT-REQ-008 | Repeated burden, workarounds, low comprehension, trust harm or missing support SHALL trigger narrow, redesign, pause or stop consideration. | Outcome review |
