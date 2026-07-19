---
id: GAEP-PROF-002
title: Brownfield Corrective Change Profile
document_type: profile
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Profile Specification Steward
scope: Defect correction and bounded change to an existing managed asset
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
  - GAEP-CORE-001
  - GAEP-CORE-003
  - GAEP-CORE-007
  - GAEP-CORE-009
informative_references: []
supersedes: []
---

# Brownfield Corrective Change Profile

## Selection

Select for a defect, regression, vulnerability correction, localized behavior correction, or bounded maintenance change to an existing asset. The defect is a finding or work subject; the corrective Initiative and Change target an asset baseline.

## Required reasoning

- current behavior and expected behavior;
- reproducibility and evidence quality;
- affected baseline, environment and consumers;
- root cause confidence versus symptom treatment;
- constraints and undocumented legacy assumptions;
- impact radius and compatibility;
- correction, regression, rollout and rollback evidence;
- residual uncertainty and follow-up obligations.

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-CORR-REQ-001 | A corrective Change SHALL identify the affected asset and exact observed baseline or explicitly record why exact identification is unavailable. | Change review |
| GAEP-CORR-REQ-002 | Reproduction evidence SHALL distinguish observed fact, inferred cause, hypothesis and unknown. | Evidence assessment |
| GAEP-CORR-REQ-003 | Existing approved decisions and constraints SHALL be reused only after applicability to the affected revision is checked. | Context review |
| GAEP-CORR-REQ-004 | The correction SHALL declare intended scope, plausible collateral effects, compatibility consequences and deliberately untouched areas. | Impact review |
| GAEP-CORR-REQ-005 | Validation SHALL cover the corrected behavior and proportionate regression risk. | Assurance review |
| GAEP-CORR-REQ-006 | High-impact deployment SHALL have a recovery strategy and observable success/failure criteria. | Operational scenario |
| GAEP-CORR-REQ-007 | A temporary workaround SHALL create a named obligation with owner, risk, expiry/review condition and permanent disposition. | Obligation review |

## Lightweight path

A low-risk, isolated correction may use one compact change record, direct evidence, peer review and an existing test. It does not require a full Product charter or new architecture package when no relevant product or architecture decision changes.

## Profile contract

| Contract field | Candidate declaration |
|---|---|
| Core compatibility | Compatible with GAEP Core `>=0.1.0 <0.2.0`; exact Core, profile, policy, baseline, and evidence revisions are pinned in the effective manifest. |
| Versioned dependencies | Every ID in `normative_dependencies` has the compatible range `>=0.1.0 <0.2.0`; incompatible, missing, or cyclic inputs do not resolve. |
| Applicability and selection | Select for bounded correction of an existing managed asset; record the affected baseline, observed condition, selecting principal, rationale, exact profile revision, and claimed lightweight-path basis. |
| Co-selection rules | Mandatory: none beyond the normative dependencies. Consequence-triggered: select Security-and-Identity Change and Security for vulnerabilities or security-control effects; Data for data or records effects; AI for material AI behavior; Operational Reliability for consequential deployment or service behavior; Legal for supplier, license, regulatory, or disclosure consequences; Workforce Trust for people monitoring, accessibility, or decision impacts; Assurance when consequence or uncertainty requires stronger evidence; Audit Integrity when correction or prior behavior requires accountable reconstruction; and Incident Response when the correction is part of material incident containment, recovery, continuity, or follow-up. |
| Obligations | The correction requirements add to the still-applicable requirements of the affected asset and do not erase earlier approved constraints. |
| Permitted variation points | Record size, evidence depth, review independence, rollout size, and review cadence may vary by impact and uncertainty. The lightweight path is not a variation point for omitting a triggered domain profile, recovery control, or regression evidence. |
| Authority, evidence, and cadence | GAEP Profile Specification Steward maintains this profile's semantics; the effective configuration identifies Engineering Change Authority and other decision and approval authorities, evidence methods, independence, and any workaround review cadence. |
| Conformance | Conformance requires an exact effective manifest, requirement and negative-case evidence, explicit deviations, residual uncertainty, and owned follow-up obligations. |
| Compatibility and conflicts | Conflict with an existing approved constraint or mandatory co-profile remains `conflicted` until an authorized disposition; observed legacy behavior alone is not authority. |
| Invalidation, migration, deprecation, and expiry | A changed reproduction, root-cause hypothesis, baseline, impact radius, rollout target, policy, dependency, or evidence result reopens resolution. Profile evolution preserves applicability mapping, workaround obligations, coexistence, and historical reconstruction. |

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-CORR-REQ-008 | Corrective-profile selection, lightweight-path use, and required co-selection SHALL be explicit, attributable, and bound to exact compatible versions and the affected baseline. | Composition review |
| GAEP-CORR-REQ-009 | Tailoring SHALL remain within the declared variation points and SHALL NOT omit triggered domain obligations, recovery controls, or proportionate regression evidence. | Lightweight-path negative test |
| GAEP-CORR-REQ-010 | A conformance claim SHALL identify the effective manifest, evidence for every applicable requirement and required negative case, deviations, residual uncertainty, and obligations. | Conformance-record review |
| GAEP-CORR-REQ-011 | Material change or profile migration, deprecation, expiry, or replacement SHALL reopen affected manifests and SHALL preserve a reconstructable disposition for workarounds and prior profile revisions. | Lifecycle-change scenario |

## Required negative cases

- A symptom disappears but the asserted root cause has no supporting evidence.
- A lightweight correction changes an identity, data, AI, or operational boundary without its domain profile.
- Validation covers only the happy path and omits a plausible regression or partial-deployment state.
- A temporary workaround passes its review date or becomes normal behavior without disposition.
- A changed baseline continues under an authorization or assurance result bound to the prior revision.
