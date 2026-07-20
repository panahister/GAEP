---
id: GAEP-RM-007
title: Implementation Authorization Process
document_type: roadmap
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Decision and Authorization Steward
scope: Permission boundaries following implementation-readiness evaluation
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
  - GAEP-CORE-011
  - GAEP-RM-003
informative_references: []
supersedes: []
---

# Implementation Authorization Process

## Separate activity boundaries

Authorization is granted separately for:

1. implementation planning and architecture refinement;
2. local, non-integrated prototype coding;
3. repository or shared-environment mutation;
4. external-system integration;
5. use of confidential, personal, regulated or production data;
6. security- or identity-relevant effects;
7. release packaging or external distribution;
8. deployment to non-production environments;
9. production deployment or production effects;
10. destructive, irreversible or external-communication effects.

One grant may cover several boundaries only when each is explicit and supported. A broader conversational request or successful gate cannot expand the grant.

## Proposed proportional effect classes — not activated

The following candidate classification is prepared for a later Decision. It is not an approved registry, policy, gate result, or Authorization Grant and does not authorize E2 or any higher class. It separates evidence and control proportionality from permission: an E2 local reference realization should not inherit every E5 production obligation, but it still requires an exact approved scope and its own Authorization Grant.

| Proposed class | Maximum activity/effect boundary | Proportional evidence and control floor | Explicit exclusions |
|---|---|---|---|
| E0 — Read-only analysis | inspect and reason over already authorized inputs without persistent repository, participant, external-system, or production mutation | exact subject and input scope, actor, source/rights limitations, output classification, no-effect confirmation, and stop on required mutation | no file edit, governed-record transition, participant contact, external write, integration, release, deployment, or production effect |
| E1 — Documentation-only reversible change | edit Proposed documentation, registries, governance text, or documentation-validation tooling within an authorized repository scope | exact diff, reversible storage path, no legacy-authority or baseline effect, validation, rollback through retained history, and explicit non-implementation boundary | no executable reference realization, participant activity, external integration, confidential/production data use, release, deployment, or production effect |
| E2 — Local non-authoritative reference realization | local isolated executable fixture or reference path used only to test a bounded semantic contract | approved exact Baseline Set and slice or an explicitly approved pre-baseline exception, local sandbox, synthetic/non-sensitive data, no network or shared integration unless separately granted, threat and recovery review proportional to the slice, expiry, deletion/retention plan, and exact Authorization Grant | no participant use, external-system mutation, release claim, production-capable credential, production data, deployment, or conformance certification |
| E3 — Participant-facing pilot | bounded manual, concierge, or tool-assisted activity involving recruited or affected participants | Pilot Readiness result, participant protocol, notice/consent where applicable, accessibility, data and metric contracts, support/harm response, separate Approval Determination, and activity-specific Authorization Grant | no authority beyond the approved cohort, duration, data, workflow, environment, and stop rules; no production effect unless separately classified and granted |
| E4 — External-system integration | non-production or bounded live connection that can read from or write to an external authoritative system | exact system/owner agreement, mapping and source authority, credentials, data classes, reconciliation, rate/budget, incident/recovery, rollback, environment, approval, and scoped Authorization Grant | no implied production safety, broad data access, uncontrolled downstream effect, public release, or E5 permission |
| E5 — Production-capable execution | release, deployment, production data or credentials, irreversible/high-consequence effect, or operation relied upon by real users or systems | approved Baseline Set and implementation slice, production threat/data/privacy/legal/supplier/reliability/audit/incident evidence, support and ownership, change/release/recovery controls, Approval Determination, and tightly scoped expiring Authorization Grants | no broader effect, environment, data, user, duration, or operational authority than each exact grant names |

Mixed work is classified at the highest activity or effect boundary actually reachable, while separately naming every material lower boundary. Splitting one activity into smaller steps does not lower its class when the combined path reaches a higher boundary. A class does not propagate authority upward or sideways, and passing an evidence floor does not create permission.

The current candidate-closure task would fit only the proposed E1 description, but its actual permission comes from the user's repository instruction rather than this unapproved classification. E2 through E5 remain prohibited in the current workstream.

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-IMPL-AUTH-REQ-001 | An Implementation Approval Case SHALL reference the exact readiness Gate Evaluation, product Decision Outcome, approved Baseline Set, slice charter, threat model, assurance evidence, risks and obligations. | Approval package review |
| GAEP-IMPL-AUTH-REQ-002 | The Approval Determination SHALL remain distinct from the Authorization Grant and SHALL identify any conditions that must become enforceable obligations. | Record separation review |
| GAEP-IMPL-AUTH-REQ-003 | Each Authorization Grant SHALL identify exact subject, activity/effect boundary, principal, environment, capability or plan version, scope, budget, effective time, expiry, revocation, conditions, evidence and recovery expectations. | Grant validation |
| GAEP-IMPL-AUTH-REQ-004 | A material change to baseline, slice scope, architecture, data, provider, capability, risk, policy, profile or evidence SHALL trigger declared re-evaluation or re-authorization. | Change scenario |
| GAEP-IMPL-AUTH-REQ-005 | Permission for a lower-effect boundary SHALL NOT imply permission for a higher or different boundary. | Privilege-escalation scenario |
| GAEP-IMPL-AUTH-REQ-006 | Completed and attempted effects SHALL remain attributable even when authorization is revoked or work stops. | Revocation scenario |
| GAEP-IMPL-AUTH-REQ-007 | Conditions, expiry and stop criteria SHALL be machine-checkable where practical and otherwise assigned to an accountable monitor. | Obligation review |
| GAEP-IMPL-AUTH-REQ-008 | An activity or effect class SHALL be an input to proportional evidence, approval, and grant resolution and SHALL NOT itself create a Decision Outcome, Approval Determination, Authority Grant, Authorization Grant, or permission. | Class-to-authority negative test |
| GAEP-IMPL-AUTH-REQ-009 | An E2-class local reference realization MAY use a control package proportionate to its exact isolation and consequence boundary, but it SHALL have explicit exclusions, expiry, recovery, and an exact Authorization Grant and SHALL NOT gain participant, external-system, release, production-data, production-credential, deployment, or conformance authority. | E2 proportionality and escalation tests |

## Current state

No Implementation Approval Case, Approval Determination or Authorization Grant exists. All implementation boundaries therefore remain unauthorized.
