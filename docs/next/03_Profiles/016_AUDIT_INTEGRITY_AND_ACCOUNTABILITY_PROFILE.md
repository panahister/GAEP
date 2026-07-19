---
id: GAEP-PROF-016
title: Audit Integrity and Accountability Profile
document_type: profile
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: Audit Authority
scope: Accountable event capture, integrity, reconstruction, correction, and independent challenge for governed activity
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
  - GAEP-CORE-011
informative_references: []
supersedes: []
---

# Audit Integrity and Accountability Profile

## Purpose and ownership boundary

This candidate profile governs whether material governed activity can be detected, attributed, protected, reconstructed, corrected, and independently challenged. It does not make audit logging universal. Select it when consequence, policy, regulation, external commitment, or an explicit accountability claim requires stronger audit properties than ordinary Core event and trace conformance.

GAEP-CORE-004 owns Event Envelopes and State Dimensions; GAEP-CORE-008 owns trace and provenance semantics; the Data Profile owns purpose, access, privacy, retention, and deletion; the Security Profile owns protective controls; and the Assurance Profile evaluates claims. This profile owns the scoped audit-coverage contract and the evidence that those Core and domain semantics produce adequate accountability. It does not turn a log entry into proof of permission, success, legality, or correctness.

## Selection

Select when material decisions, approvals, authorizations, Confirmations, privileged actions, external or destructive effects, regulated records, incident custody, or accountability claims require completeness criteria, trusted ordering, tamper or loss detection, end-to-end reconstruction, controlled correction, or independent challenge. Record the selecting principal, governed subjects, actors, event classes, environments, purposes, authorities, consequence, exclusions, and exact profile revision.

## Audit model

An audit scope declares required event classes and transitions, capture points, expected volumes and ordering, correlation and canonical identities, authoritative sources, trusted-time properties, integrity controls, loss and tamper detection, custody, access, privacy, retention, correction, reconstruction questions, challenge paths, and review cadence. A completeness claim is always bounded to this declared scope.

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-AUDIT-REQ-001 | An audit scope SHALL identify governed subjects, actors, accountable principals, event types, applicable effect descriptors, transitions, systems, environments, purposes, authorities, capture boundaries, exclusions, and required reconstruction questions. | Audit-scope review |
| GAEP-AUDIT-REQ-002 | Each required audit record SHALL bind to the applicable GAEP-CORE-004 Event Envelope, canonical subject and actor identities, exact revisions, source, time evidence, correlation, action or transition, outcome, and relevant policy, profile, approval, authorization, Confirmation, exception, evidence, and effect references. | Audit-record validation |
| GAEP-AUDIT-REQ-003 | An audit completeness claim SHALL define expected records, sequence or correlation constraints, coverage bounds, duplicate handling, and detection of missing, delayed, dropped, truncated, or unparseable records. | Completeness and loss scenarios |
| GAEP-AUDIT-REQ-004 | Audit time evidence SHALL identify clock source, synchronization or trust basis, resolution, uncertainty, and ordering limits; unavailable trusted time SHALL remain explicit and SHALL NOT be represented as exact chronology. | Clock-skew and ordering test |
| GAEP-AUDIT-REQ-005 | Audit records and integrity evidence SHALL be protected from unauthorized alteration by the actor or capability they constrain and SHALL support proportionate tamper, deletion, truncation, replay, substitution, and loss detection. | Tamper and loss tests |
| GAEP-AUDIT-REQ-006 | A correction SHALL be an attributable new revision linked to the corrected assertion; authorized redaction, restriction, or deletion SHALL follow the Data and Legal profiles and SHALL preserve only the minimum disposition evidence those controlling authorities permit. | Correction and erasure scenario |
| GAEP-AUDIT-REQ-007 | Audit collection, content, access, disclosure, retention, archival, legal hold, correction, and disposal SHALL be purpose-limited and governed through applicable Data, Security, Legal, and Workforce Trust profiles. | Audit-data governance review |
| GAEP-AUDIT-REQ-008 | Reconstruction SHALL be able to relate exact effective configuration, identities, decisions, reviews, approvals, Authorization Grants, Confirmations, capabilities, plans, inputs, effects, outcomes, corrections, exceptions, and unresolved obligations for the declared scope. | End-to-end reconstruction |
| GAEP-AUDIT-REQ-009 | Consequential audit claims SHALL have an independent challenge path with access appropriate to role, protected evidence preservation, attributable findings, response deadlines, escalation, correction, and decision-reopening rules. | Independent-challenge exercise |
| GAEP-AUDIT-REQ-010 | A detected or suspected completeness, custody, time, integrity, access, or reconstruction failure SHALL create an explicit finding and SHALL invalidate affected audit and dependent conformance claims until authorized disposition. | Audit-control failure scenario |
| GAEP-AUDIT-REQ-011 | Presence of an audit record SHALL NOT establish that an action was authorized, lawful, successful, correctly attributed, or compliant without the applicable authoritative records and verification evidence. | False-inference negative test |
| GAEP-AUDIT-REQ-012 | Audit export, migration, archive, and restoration SHALL preserve canonical identity, ordering limits, integrity, correction lineage, classification, access, retention, and reconstructability or SHALL disclose every unsupported property. | Audit portability test |

## Profile contract

| Contract field | Candidate declaration |
|---|---|
| Core compatibility | Compatible with GAEP Core `>=0.1.0 <0.2.0`; exact Core, registry, profile, policy, schema, clock, integrity, storage, and evidence versions are pinned in the effective manifest. |
| Versioned dependencies | Every ID in `normative_dependencies` has the compatible range `>=0.1.0 <0.2.0`; missing, incompatible, cyclic, revoked, or reconstruction-ineligible dependencies block the affected audit claim. |
| Applicability and selection | Selection is consequence- and authority-based, not universal; bind it to an exact audit scope, purpose, authority, selecting principal, profile revision, and exclusions. |
| Co-selection rules | Mandatory: none beyond the normative dependencies. Consequence-triggered: select Data for personal, confidential, regulated, retained, corrected, or deleted audit content; Security for integrity, privileged access, or tamper and loss controls; Legal for regulated audit, legal hold, discovery, notification, or retention; Workforce Trust for workforce activity or individual consequences; Assurance when reliance on an audit claim informs a decision; Incident Response only when incident declaration, response, recovery, continuity, closure, or reopening duties are independently applicable; AI for material AI actors or decisions; and Operational Reliability for operational audit services. |
| Obligations | Coverage, identity and revision binding, trusted-time limits, integrity, loss detection, correction, privacy, retention, reconstruction, challenge, and failure disposition remain distinct and cumulative. |
| Permitted variation points | Event detail, capture location, integrity method, time source, retention period, access-review cadence, sampling for non-material events, challenge independence, and reconstruction-test cadence may vary within effective policy. Required material-event coverage, failure visibility, attributable correction, purpose limitation, and independent challenge required by consequence are not variation points. |
| Authority, evidence, and cadence | Audit Authority owns this profile; the manifest identifies event, data, security, records, and challenge authorities, evidence methods, review cadence, retention, reconstruction exercises, and control-test schedule. |
| Conformance | Conformance requires an exact manifest, audit scope and coverage model, requirement and negative-case evidence, integrity and time limits, deviations, detected gaps, challenge status, and unresolved obligations. |
| Compatibility and conflicts | Conflicts among auditability, minimization, privacy, legal hold, correction, deletion, confidentiality, access, and security remain explicit and identify controlling authorities; audit preference alone does not override them. |
| Invalidation, migration, deprecation, and expiry | Change to scope, purpose, actor, event class, schema, source, clock, integrity control, storage, access, retention, policy, reconstruction need, or observed gap reopens conformance. Profile evolution preserves schema, event, correction, integrity, custody, retention, migration, and historical reconstruction mappings. |

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-AUDIT-REQ-013 | Audit-profile selection and every required co-selection SHALL be explicit, attributable, and bound to exact compatible audit-scope, schema, source, time, integrity, policy, and profile versions. | Composition and binding review |
| GAEP-AUDIT-REQ-014 | Tailoring SHALL use only declared variation points and SHALL NOT weaken required material-event coverage, gap visibility, attributable correction, purpose limitation, controlling retention or access obligations, or independent challenge required by consequence. | Audit-tailoring negative test |
| GAEP-AUDIT-REQ-015 | An Audit Profile conformance claim SHALL identify the effective manifest, audit scope, evidence for every applicable requirement and required negative case, time and integrity limits, deviations, detected gaps, challenges, and unresolved obligations. | Conformance-record review |
| GAEP-AUDIT-REQ-016 | Material change or profile migration, deprecation, expiry, revocation, or replacement SHALL invalidate affected manifests and SHALL preserve schema, event, correction, integrity, custody, retention, access, migration, and historical reconstruction mappings. | Lifecycle-change scenario |

## Required negative cases

- Logging is enabled but a required decision, authorization, Confirmation, privileged action, external effect, or failure is absent.
- A clock step, unsynchronized source, or uncertain order is presented as exact chronology.
- The actor or capability being audited can silently alter, truncate, disable, or delete its controlling records.
- A correction overwrites history, or a privacy deletion retains unnecessary content under an auditability claim.
- A record's presence is treated as proof that the action was permitted or successful.
- Audit export or migration loses identity, correlation, correction lineage, access constraints, or integrity evidence.
- An independent challenger cannot obtain appropriate evidence or reopen a decision after a material audit failure.
