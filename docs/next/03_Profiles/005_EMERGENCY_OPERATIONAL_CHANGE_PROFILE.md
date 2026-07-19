---
id: GAEP-PROF-005
title: Emergency Operational Change Profile
document_type: profile
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Profile Specification Steward
scope: Urgent changes needed to contain or recover from active harm or severe service impact
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
  - GAEP-CORE-005
  - GAEP-CORE-006
  - GAEP-CORE-009
  - GAEP-CORE-011
informative_references: []
supersedes: []
---

# Emergency Operational Change Profile

## Selection

Select only when delay from the standard path plausibly increases active harm, security exposure, safety risk, material loss or severe service impact. Convenience, deadline pressure and poor planning are not emergency evidence.

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-EMERG-REQ-001 | Emergency invocation SHALL identify the active condition, expected harm of delay, invoking authority, scope and time. | Invocation review |
| GAEP-EMERG-REQ-002 | Emergency authorization SHALL be least-scope, time-bounded and revocable. | Authorization inspection |
| GAEP-EMERG-REQ-003 | The operator SHALL preserve the minimum evidence needed to reconstruct intent, effects, decisions and outcomes without delaying immediate safety actions. | Incident scenario |
| GAEP-EMERG-REQ-004 | Only obligations that effective policy explicitly permits to be deferred during the active emergency SHALL be deferred, and each deferral SHALL become an explicit post-event obligation with owner and due or review conditions. | Deferral and obligation review |
| GAEP-EMERG-REQ-005 | The Change SHALL define observable containment or recovery criteria and a rollback, forward-recovery or isolation option where feasible. | Operational tabletop |
| GAEP-EMERG-REQ-006 | Emergency access and temporary controls SHALL expire or be explicitly renewed; they SHALL NOT silently become normal state. | Expiry scenario |
| GAEP-EMERG-REQ-007 | A post-event review SHALL assess cause, decision quality, effects, evidence gaps, temporary debt, recurrence prevention and whether emergency classification was justified. | Retrospective review |

## Stop condition

When the immediate condition is contained and delay no longer increases harm, further work returns to the normal applicable profile unless a new emergency authorization is granted.

## Non-waivable emergency boundary

Emergency classification changes urgency and may activate an approved break-glass path; it does not create authority, convert a prohibition into permission, waive a non-exceptionable obligation, erase evidence, or displace the profile governing the underlying security, data, AI, legal, workforce, or operational effect.

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-EMERG-REQ-008 | Emergency invocation SHALL NOT override a non-exceptionable prohibition, manufacture authority, approval, or Authorization Grant, or treat tool access as permission. | Non-waivable boundary test |
| GAEP-EMERG-REQ-009 | An exceptionable obligation SHALL be varied only through a current, exact Policy Exception governed by GAEP-CORE-005 and applicable approval under GAEP-CORE-006; urgency alone SHALL NOT constitute an exception. | Emergency-exception review |
| GAEP-EMERG-REQ-010 | Security, data, privacy, safety, legal, workforce, evidence, and accountable-human obligations SHALL remain effective unless the controlling authority explicitly permits a scoped deferral; an unknown boundary SHALL stop the affected effect when immediate safety action does not require it. | Boundary and unknown scenario |

## Profile contract

| Contract field | Candidate declaration |
|---|---|
| Core compatibility | Compatible with GAEP Core `>=0.1.0 <0.2.0`; exact Core, policy, exception, authorization, subject, and effect versions are pinned in the effective manifest. |
| Versioned dependencies | Every ID in `normative_dependencies` has the compatible range `>=0.1.0 <0.2.0`; emergency operation does not permit an incompatible, missing, cyclic, or silently defaulted dependency. |
| Applicability and selection | Select only for an evidenced active condition in which delay plausibly increases harm; record condition, invoking principal and authority, affected scope, time, expected harm of delay, and exact profile revision. |
| Co-selection rules | Mandatory: the normal profile for each underlying effect. Consequence-triggered examples are Security and Security-and-Identity Change for security or identity, Data for data or records, AI for AI, Operational Reliability for service operation, Legal for legal or supplier constraints, Workforce Trust for people impacts, Assurance as feasible and proportionate, Audit Integrity when evidence custody or accountable reconstruction is material, and Incident Response when declaration, severity, notification, recovery, continuity, closure, or decision reopening is in scope. Emergency selection never replaces an applicable profile. |
| Obligations | Emergency requirements add containment, least-scope authority, expiry, reconstruction, recovery, and return-to-normal obligations while preserving all non-waivable Core and policy obligations. |
| Permitted variation points | Only response sequencing, evidence capture timing, review timing, and recovery strategy may vary when effective policy explicitly permits it and immediate harm justifies it. Identity, least authority, non-exceptionable prohibitions, exact authorization, effect accounting, and temporary-access expiry are not variation points. |
| Authority, evidence, and cadence | GAEP Profile Specification Steward maintains this profile's semantics; the effective configuration identifies Operational Authority, emergency and domain approvers, least-scope authorization, minimum reconstructive evidence, authorization expiry, and post-event review deadline. |
| Conformance | Conformance requires an exact manifest, emergency evidence, normal domain-profile co-selection, requirement and negative-case evidence, every deferral or exception, actual effects, and post-event obligations. |
| Compatibility and conflicts | A conflict with non-waivable policy resolves to denial. Other unresolved profile, authority, or effect conflicts remain explicit and cannot be normalized by emergency status. |
| Invalidation, migration, deprecation, and expiry | Containment, elapsed authorization, changed scope, target, policy, actor, condition, or effect invalidates or reopens the emergency manifest. Profile evolution preserves event reconstruction, temporary access, deferrals, exceptions, migration, and post-event obligations. |

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-EMERG-REQ-011 | Emergency-profile selection, required domain co-selection, Policy Exceptions, and authorizations SHALL be explicit, attributable, time-bounded, and bound to exact compatible versions. | Composition and expiry review |
| GAEP-EMERG-REQ-012 | Tailoring SHALL use only the declared emergency variation points and SHALL NOT weaken a non-waivable boundary or continue the emergency path after its stop condition. | Tailoring and stop negative test |
| GAEP-EMERG-REQ-013 | A conformance claim SHALL identify the effective manifest, active-condition evidence, every applicable requirement and negative-case result, actual effects, deviations, deferrals, exceptions, and unresolved obligations. | Conformance-record review |
| GAEP-EMERG-REQ-014 | Material change or profile migration, deprecation, expiry, or replacement SHALL invalidate affected manifests and SHALL preserve reconstructable emergency, access, exception, deferral, recovery, and post-event-review mappings. | Lifecycle-change scenario |

## Required negative cases

- Convenience, deadline pressure, or poor planning is presented as emergency evidence.
- A prohibited effect is attempted because an incident is severe.
- Emergency access or authorization expires while work continues.
- A security, privacy, legal, safety, or workforce boundary is unknown and the unrelated effect proceeds anyway.
- Work remains on the emergency path after containment without a new qualifying condition and authorization.
- Deferred obligations or actual partial effects disappear from the post-event record.
