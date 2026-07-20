---
id: GAEP-PROF-011
title: Data, Privacy, and Records Profile
document_type: profile
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Profile Specification Steward
scope: Data processed by GAEP workspaces, contexts, runtimes, adapters, evidence, telemetry, and governed initiatives
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
  - GAEP-CORE-003
  - GAEP-CORE-009
  - GAEP-CORE-011
informative_references: []
supersedes: []
---

# Data, Privacy, and Records Profile

## Data inventory dimensions

For each data class and flow, identify content, subject, purpose, authority or applicable legal basis, controller/owner, processor or supplier, source, recipients, location/residency, classification, minimization, access, retention, deletion, legal hold, integrity, backup, model use and data-subject or affected-person consequences.

Security classification, privacy sensitivity, epistemic reliability, provenance and normative authority are independent dimensions.

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-DATA-REQ-001 | Data collection and use SHALL have a declared purpose, accountable owner and applicable authority before processing. | Data inventory review |
| GAEP-DATA-REQ-002 | Context, evidence and telemetry SHALL be minimized to what is necessary for the declared purpose and risk. | Minimization review |
| GAEP-DATA-REQ-003 | Personal, confidential, regulated, secret and restricted data SHALL have explicit access, provider, residency and disclosure constraints. | Flow review |
| GAEP-DATA-REQ-004 | Retention, archival, deletion, backup, legal hold and secure disposal SHALL be modeled separately and conflict resolution SHALL identify the controlling authority. | Records scenario |
| GAEP-DATA-REQ-005 | Deletion or correction in an authoritative source SHALL produce defined consequences for caches, Context Packs, evidence snapshots, model memory and downstream records. | Deletion propagation scenario |
| GAEP-DATA-REQ-006 | Provider or model use of content for training, improvement, logging or human review SHALL be declared and evaluated before sensitive use. | Supplier data-term review |
| GAEP-DATA-REQ-007 | Auditability SHALL NOT justify indefinite retention or unrestricted access by default. | Retention review |
| GAEP-DATA-REQ-008 | Workforce telemetry SHALL prohibit undisclosed repurposing and individual performance ranking unless separately authorized through applicable organizational and legal processes. | Workforce-trust review |
| GAEP-DATA-REQ-009 | Affected persons SHALL have applicable transparency, access, correction, challenge and deletion channels. | Rights-process review |
| GAEP-DATA-REQ-010 | Synthetic, anonymized or redacted data SHALL retain evidence of the method, residual re-identification risk and validity limits. | Transformation assessment |

## Records integrity and legitimate correction

Records may require correction without erasing history. Controlled correction creates a new revision, reason, actor, time and relationship to the replaced assertion. Legal hold and audit needs do not automatically permit continued operational use of inaccurate personal data.

## Profile contract

| Contract field | Candidate declaration |
|---|---|
| Core compatibility | Compatible with GAEP Core `>=0.1.0 <0.2.0`; exact Core, profile, purpose, authority, dataset, flow, provider, policy, and evidence versions are pinned in the effective manifest. |
| Versioned dependencies | Every ID in `normative_dependencies` has the compatible range `>=0.1.0 <0.2.0`; missing, incompatible, cyclic, or recipient-ineligible dependencies remain non-permissive. |
| Applicability and selection | Select when GAEP or a governed initiative collects, derives, stores, transmits, discloses, corrects, deletes, retains, archives, backs up, or otherwise processes material data or records; bind selection to classes, subjects, purposes, flows, and environments. |
| Co-selection rules | Mandatory: none beyond the normative dependencies. Consequence-triggered: select Security for personal, confidential, regulated, secret, integrity-sensitive, or externally disclosed data; AI for AI processing; Legal for legal basis, rights, jurisdiction, supplier, transfer, retention, or hold; Workforce Trust for workforce or participant data; Operational Reliability for persistent operational flows and recovery; Audit Integrity when authoritative auditability or reconstruction is material; and Incident Response when breach, loss, disclosure, or continuity response is in scope. |
| Obligations | Purpose, authority, minimization, classification, flow, access, provider, retention, deletion, correction, rights, integrity, and transformation obligations remain distinct and cumulative. |
| Permitted variation points | Inventory granularity, evidence method, review cadence, retention period, access-review cadence, and transformation technique may vary only within controlling policy and authority. Purpose, lawful or policy authority, minimization, recipient constraints, rights, legal hold, and secure disposition are not variation points. |
| Authority, evidence, and cadence | GAEP Profile Specification Steward maintains this profile's semantics; the manifest identifies Data and Privacy Authority, purpose and records owners, other applicable authorities, evidence, review cadence, retention and hold decisions, and rights-process ownership. |
| Conformance | Conformance requires an exact manifest, inventory and flow coverage, requirement and negative-case evidence, deviations, unresolved conflicts, rights and records obligations, and provider constraints. |
| Compatibility and conflicts | Conflict among privacy, records, legal hold, correction, deletion, audit, security, or supplier obligations remains explicit and must identify controlling authority; no concern silently erases another. |
| Invalidation, migration, deprecation, and expiry | Change to purpose, authority, data class, subject population, source, recipient, provider, location, model use, retention, hold, flow, policy, or evidence reopens the manifest. Profile evolution preserves dataset, rights, retention, deletion, hold, migration, and historical mappings. |

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-DATA-REQ-011 | Data-profile selection and every required co-selection SHALL be explicit, attributable, and bound to exact compatible purpose, authority, dataset, flow, provider, policy, and profile versions. | Composition and flow review |
| GAEP-DATA-REQ-012 | Tailoring SHALL use only declared variation points and SHALL NOT weaken purpose limitation, applicable authority, minimization, recipient constraints, rights, legal hold, integrity, or secure disposition. | Data-tailoring negative test |
| GAEP-DATA-REQ-013 | A conformance claim SHALL identify the effective manifest, inventory and flow coverage, evidence for every applicable requirement and required negative case, deviations, conflicts, and unresolved rights or records obligations. | Conformance-record review |
| GAEP-DATA-REQ-014 | Material change or profile migration, deprecation, expiry, or replacement SHALL invalidate affected manifests and SHALL preserve dataset, rights, retention, deletion, hold, provider, migration, and historical mappings. | Lifecycle-change scenario |

## Required negative cases

- Auditability is used to justify indefinite retention or unrestricted access.
- A deletion or correction affects the source but leaves caches, Context Packs, model memory, backups, or downstream operational copies undispositioned.
- A provider, model, recipient, purpose, residency, or training-use term changes without reassessment.
- Synthetic, anonymized, or redacted data is treated as risk-free without transformation evidence.
- Workforce telemetry is repurposed for ranking or discipline without the required separate authority and rights.
