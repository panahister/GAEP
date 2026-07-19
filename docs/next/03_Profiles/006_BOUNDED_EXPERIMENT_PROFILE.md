---
id: GAEP-PROF-006
title: Bounded Experiment Profile
document_type: profile
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: Experiment Authority
scope: Spikes, prototypes, evaluations, and research intended to learn rather than establish production authority
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
  - GAEP-CORE-007
  - GAEP-CORE-009
informative_references: []
supersedes: []
---

# Bounded Experiment Profile

## Selection

Select for time-bounded learning activity whose outputs are not approved production decisions, controls, code, data, architecture or evidence without a separate promotion decision.

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-EXP-REQ-001 | An experiment SHALL state question, hypothesis, boundary, timebox, allowed environments, allowed data, effects, measures and stop conditions. | Experiment charter |
| GAEP-EXP-REQ-002 | Experiment outputs SHALL remain visibly non-authoritative until validated and promoted through an applicable governed Change. | Promotion scenario |
| GAEP-EXP-REQ-003 | Production, personal, regulated, confidential or safety-relevant data SHALL require explicit applicability and authorization rather than being assumed permissible for experimentation. | Data review |
| GAEP-EXP-REQ-004 | Disposable shortcuts, temporary access and unverified dependencies SHALL be recorded and SHALL NOT silently transfer into production. | Boundary review |
| GAEP-EXP-REQ-005 | Results SHALL include negative, inconclusive and contradictory evidence and known reproducibility limits. | Evidence review |
| GAEP-EXP-REQ-006 | Closure SHALL address retention, deletion, access revocation, cost, abandoned resources and reusable learning promotion. | Closure review |

## Lightweight intent

The profile minimizes ceremony while protecting the boundary between learning and authority. A one-page experiment record may satisfy the profile when risk is low.

## Profile contract

| Contract field | Candidate declaration |
|---|---|
| Core compatibility | Compatible with GAEP Core `>=0.1.0 <0.2.0`; the effective manifest pins exact profile, environment, data, capability, dependency, and evidence versions. |
| Versioned dependencies | Every ID in `normative_dependencies` has the compatible range `>=0.1.0 <0.2.0`; missing, incompatible, or cyclic inputs remain unresolved. |
| Applicability and selection | Select for time-bounded learning whose outputs lack production authority; record the selecting principal, hypothesis, boundary, environment, data, effects, timebox, and exact profile revision. |
| Co-selection rules | Mandatory: none beyond the normative dependencies. Consequence-triggered: select Data for personal, confidential, regulated, or records-relevant data; AI for material AI use; Security for external tools, untrusted inputs, executable outputs, or privileged capabilities; Legal for third-party content, supplier, licensing, jurisdiction, or regulated use; Workforce Trust for participants, telemetry, accessibility, or affected persons; Assurance before promotion when reliance is consequential; Audit Integrity when experimental activity or effects require accountable reconstruction; and Incident Response when plausible experiment harm requires coordinated notification, recovery, or continuity. |
| Obligations | Experiment controls and all triggered domain obligations apply even when outputs are disposable; promotion remains a separate governed Change. |
| Permitted variation points | Charter size, timebox, sample size, evidence depth, review cadence, and environment isolation may vary by risk. Production authority, prohibited data use, required authorization, explicit promotion, and closure are not variation points. |
| Authority, evidence, and cadence | Experiment Authority owns the profile; the manifest identifies data and effect authorities, evidence methods, stop conditions, timebox, and closure review. |
| Conformance | Conformance requires an exact manifest, bounded-use evidence, requirement and negative-case results, deviations, reproducibility limits, and closure disposition. |
| Compatibility and conflicts | A conflict with production, data, security, legal, or workforce constraints remains `conflicted`; calling work an experiment does not resolve it. |
| Invalidation, migration, deprecation, and expiry | Change to question, boundary, data, environment, tool, model, dependency, effect, participant population, or timebox reopens resolution. Profile evolution preserves promotion, retention, deletion, access-revocation, and abandoned-resource obligations. |

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-EXP-REQ-007 | Experiment-profile selection and every required co-selection SHALL be explicit, attributable, time-bounded, and bound to exact compatible versions and the experiment boundary. | Composition review |
| GAEP-EXP-REQ-008 | Tailoring SHALL use only declared variation points and SHALL NOT weaken isolation, data restrictions, authorization, non-authoritative output, promotion, or closure obligations. | Lightweight-path negative test |
| GAEP-EXP-REQ-009 | A conformance claim SHALL identify the effective manifest, evidence for every applicable requirement and required negative case, deviations, reproducibility limits, and closure disposition. | Conformance-record review |
| GAEP-EXP-REQ-010 | Material change or profile migration, deprecation, expiry, or replacement SHALL invalidate affected manifests and SHALL preserve promotion, retention, deletion, access, cost, and resource-disposition mappings. | Lifecycle-change scenario |

## Required negative cases

- An experiment output is copied into an authoritative baseline without a promotion decision.
- Production or sensitive data is used because the activity is labeled temporary.
- A changed model, tool, dataset, or environment is treated as covered by prior results.
- Temporary credentials, resources, or provider retention survive closure.
- Inconclusive or adverse results are omitted while favorable results are promoted.
