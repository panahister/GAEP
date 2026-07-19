---
id: GAEP-PROF-017
title: Incident Response and Continuity Profile
document_type: profile
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: Incident and Continuity Authority
scope: Material incident declaration, response, evidence custody, communication, recovery, continuity, closure, and decision reopening
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
  - GAEP-CORE-002
  - GAEP-CORE-003
  - GAEP-CORE-004
  - GAEP-CORE-005
  - GAEP-CORE-006
  - GAEP-CORE-007
  - GAEP-CORE-008
  - GAEP-CORE-009
  - GAEP-CORE-010
  - GAEP-CORE-011
  - GAEP-CORE-012
informative_references: []
supersedes: []
---

# Incident Response and Continuity Profile

## Purpose and ownership boundary

This candidate profile governs the lifecycle of a material incident: identity, declaration, severity, evidence custody, coordinated response, notification and communication, recovery and continuity, closure, and reopening of affected decisions. It is selected when these controls are material; it is not an automatic requirement for every initiative or low-impact operational anomaly.

The Emergency Operational Change Profile governs a qualifying urgent Change and its break-glass boundary. The Operational Reliability Profile governs service objectives, monitoring, operability, and routine recovery capability. Security, Data, AI, Legal, Workforce Trust, and Audit Integrity govern their respective incident concerns. This profile coordinates the incident record and cross-domain response without replacing those authorities or creating an exception to their prohibitions.

## Selection

Select when observed or suspected events may cause material security, privacy, safety, legal, financial, availability, integrity, AI, supplier, workforce, public-trust, or governance harm and require coordinated declaration, evidence custody, communication, continuity, recovery, or decision reopening. Bind selection to the detecting principal, affected and potentially affected scope, declaration authority, initial evidence, time, and exact profile revision. Uncertainty about impact is recorded rather than converted to a low severity.

## Incident model

An incident record uses Core State Dimensions and attributable events rather than one overloaded status. It identifies stable incident identity, related events and effects, declaration and severity decisions, affected subjects and persons, owners and roles, timeline and time uncertainty, evidence custody, containment, notification, communications, recovery and continuity, obligations, decisions reopened, closure authority, and residual unknowns.

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-INC-REQ-001 | Every selected incident SHALL have a stable Incident identity and SHALL record detector, declaration authority, declaration time and time limits, known and potentially affected scope, current evidence, severity determination, uncertainty, owners, and exact applicable profile and policy versions. | Incident-record validation |
| GAEP-INC-REQ-002 | Severity criteria, declaration thresholds, escalation rules, and eligible authorities SHALL be versioned and attributable; changed severity or scope SHALL create a new determination and SHALL NOT overwrite prior history. | Severity and escalation scenarios |
| GAEP-INC-REQ-003 | Incident phase, activity, outcome, resource validity, authorization validity, obligation fulfillment, and recovery state SHALL use applicable GAEP-CORE-004 State Dimensions and events rather than one combined incident status. | State-model review |
| GAEP-INC-REQ-004 | Incident evidence SHALL preserve source, canonical identity, exact revision, collection actor and method, time evidence and uncertainty, integrity, classification, custody transfers, access, correction, retention, and legal-hold constraints. | Evidence-custody exercise |
| GAEP-INC-REQ-005 | Containment actions SHALL have exact authority and effect controls, SHALL preserve known and uncertain prior effects, and SHALL invoke the Emergency Operational Change Profile only when its qualifying condition and authorization independently exist. | Containment authorization test |
| GAEP-INC-REQ-006 | Notification and communication SHALL identify accountable authority, audience, trigger, deadline, approved facts, uncertainty, confidentiality, privacy, legal constraints, update cadence, correction path, and proof of delivery where required. | Notification tabletop |
| GAEP-INC-REQ-007 | Recovery and continuity SHALL define critical outcomes, dependencies, safe degraded or manual behavior, recovery objectives, restoration and reconciliation evidence, user or affected-person consequences, supplier needs, and authorized return-to-service criteria. | Continuity and recovery exercise |
| GAEP-INC-REQ-008 | Incident impact assessment SHALL evaluate security, data and records, AI, operations, legal and supplier, workforce and accessibility, financial, safety, public-trust, and governance consequences as applicable and SHALL assign every resulting obligation. | Cross-domain impact review |
| GAEP-INC-REQ-009 | An incident SHALL reopen affected risk, policy, profile, exception, approval, authorization, assurance, architecture, supplier, release, baseline, and conformance decisions when their validity assumptions may no longer hold. | Decision-reopening scenario |
| GAEP-INC-REQ-010 | Closure SHALL require accountable determination of containment, known and uncertain effects, evidence custody, notifications, continuity and recovery state, reopened decisions, corrective obligations, owners, due or review conditions, residual risk, and recurrence monitoring. | Closure review |
| GAEP-INC-REQ-011 | Incident closure SHALL NOT erase unresolved remediation, compensation, rights, notification, supplier, recovery, audit, or learning obligations and SHALL NOT itself prove that the subject has returned to an approved state. | Premature-closure negative test |
| GAEP-INC-REQ-012 | Exercises and post-incident reviews SHALL test detection, declaration, authority, custody, communication, containment, continuity, recovery, closure, and decision reopening and SHALL preserve gaps as findings with owners and due or review conditions. | Exercise and review evidence |

## Profile contract

| Contract field | Candidate declaration |
|---|---|
| Core compatibility | Compatible with GAEP Core `>=0.1.0 <0.2.0`; exact Core, profile, incident, subject, policy, severity, evidence, communication, recovery, supplier, and decision versions are pinned in the effective manifest. |
| Versioned dependencies | Every ID in `normative_dependencies` has the compatible range `>=0.1.0 <0.2.0`; missing, incompatible, cyclic, revoked, or unavailable required dependencies remain explicit and non-permissive. |
| Applicability and selection | Selection is consequence- and coordination-based, not universal; bind it to an observed or suspected condition, affected scope, selecting principal, declaration authority, initial evidence, and exact profile revision. |
| Co-selection rules | Mandatory: none beyond the normative dependencies. Consequence-triggered: select Security for security incidents; Data for privacy, records, loss, or disclosure; AI for AI behavior, model, provider, or autonomy incidents; Operational Reliability for service, dependency, recovery, or continuity; Legal for notification, regulator, supplier, litigation, contract, or jurisdiction; Workforce Trust for people, accessibility, communication, monitoring, or labor effects; Audit Integrity only when policy or consequence independently requires stronger custody, completeness, tamper or loss detection, reconstruction, or challenge; Assurance when incident evidence informs restored confidence; and Emergency Operational Change only for a separately qualifying urgent Change. |
| Obligations | Identity, severity and declaration, evidence custody, containment, notification and communication, cross-domain impact, recovery and continuity, closure, exercises, and decision reopening remain distinct and cumulative. |
| Permitted variation points | Severity labels, response organization, communication channel, evidence method, exercise cadence, recovery strategy, and review independence may vary within effective policy and authority. Stable identity, accountable declaration, exact authority, evidence custody, truthful communication, protected affected persons, explicit uncertainty, decision reopening, and closure criteria are not variation points. |
| Authority, evidence, and cadence | Incident and Continuity Authority owns this profile; the manifest identifies declaration, severity, response, domain, communication, evidence, recovery, continuity, and closure authorities, on-call or escalation rules, review cadence, and exercise schedule. |
| Conformance | Conformance requires an exact manifest, incident record and timeline, requirement and negative-case evidence, custody and notification status, deviations, reopened decisions, closure determination, residual uncertainty, and unresolved obligations. |
| Compatibility and conflicts | Conflicting safety, security, privacy, legal, evidentiary, communication, continuity, supplier, or workforce obligations remain explicit and identify controlling authorities; urgency or reputational preference cannot silently resolve them. |
| Invalidation, migration, deprecation, and expiry | Change to incident scope, severity basis, subject, actor, evidence, custody, policy, authority, notification duty, supplier, recovery state, continuity need, reopened decision, or observed effect reopens the manifest. Profile evolution preserves incident identity, timeline, custody, notification, recovery, closure, obligation, migration, and historical mappings. |

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-INC-REQ-013 | Incident-profile selection and every required co-selection SHALL be explicit, attributable, and bound to exact compatible incident, subject, severity, evidence, policy, supplier, recovery, decision, and profile versions. | Composition and binding review |
| GAEP-INC-REQ-014 | Tailoring SHALL use only declared variation points and SHALL NOT weaken stable identity, accountable declaration, exact authority, evidence custody, truthful communication, affected-person protection, explicit uncertainty, decision reopening, or closure criteria. | Incident-tailoring negative test |
| GAEP-INC-REQ-015 | An Incident Profile conformance claim SHALL identify the effective manifest, incident record and timeline, evidence for every applicable requirement and required negative case, custody and notification status, deviations, reopened decisions, residual uncertainty, and unresolved obligations. | Conformance-record review |
| GAEP-INC-REQ-016 | Material change or profile migration, deprecation, expiry, revocation, or replacement SHALL invalidate affected manifests and SHALL preserve incident identity, timeline, evidence custody, notification, recovery, closure, obligation, migration, and historical mappings. | Lifecycle-change scenario |

## Required negative cases

- A suspected high-impact event is assigned a low severity because impact evidence is incomplete.
- An urgent containment action uses emergency status to bypass a non-exceptionable prohibition or exact authorization.
- Evidence is copied or transformed without source, time uncertainty, integrity, classification, or custody history.
- Public, regulator, supplier, workforce, or affected-person communication presents speculation as fact or hides material uncertainty.
- Service returns but data, security, AI, legal, workforce, audit, or user recovery remains incomplete and the incident is closed.
- Closure erases outstanding remediation, notification, rights, reconciliation, or decision-reopening obligations.
- A post-incident review produces findings without owners and due or review conditions.
