---
id: GAEP-PROF-009
title: Assurance Profile
document_type: profile
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Profile Specification Steward
scope: Evidence-backed confidence in governed claims and release/readiness decisions
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
  - GAEP-CORE-007
  - GAEP-CORE-003
  - GAEP-CORE-009
informative_references:
  - ../../02_Platform/020_ENGINEERING_ASSURANCE_AND_ARCHITECTURE_MODEL.md
supersedes: []
---

# Assurance Profile

## Purpose

Assurance is structured confidence in important claims, not a synonym for testing or a single readiness status. This profile selects claims, evidence strength, assessment independence, coverage and decision rules proportionately to consequence and uncertainty.

## Assurance plan

The plan identifies:

- decision to be informed;
- claims and critical claims;
- hazards, risks, quality attributes and failure modes;
- acceptable evidence methods and independence;
- coverage boundaries and exclusions;
- test or assessment oracles;
- environments, data and subject revisions;
- confidence limits, conflicting evidence and residual uncertainty;
- evidence validity, expiry and invalidation triggers;
- decision rule and authority.

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-ASR-REQ-001 | Assurance evidence SHALL bind to the exact claim, subject revision, environment, method, assessor, time and validity conditions. | Evidence review |
| GAEP-ASR-REQ-002 | Evidence quality SHALL be assessed for relevance, method validity, independence, completeness, integrity, recency, conflicts and reproducibility limits. | Assessment review |
| GAEP-ASR-REQ-003 | Evidence volume or trace density SHALL NOT substitute for evidence quality or coverage. | Assurance-case review |
| GAEP-ASR-REQ-004 | Critical claims and non-compensable failures SHALL be identified before results are used for release or readiness. | Decision-rule review |
| GAEP-ASR-REQ-005 | AI-generated review or evidence SHALL disclose correlation with AI-generated subject matter and SHALL NOT be presumed independent. | Independence scenario |
| GAEP-ASR-REQ-006 | Missing, conflicting, stale or invalid evidence SHALL produce an explicit assessment consequence. | Negative evidence scenarios |
| GAEP-ASR-REQ-007 | Test, validator and assessment tools SHALL have qualification evidence proportionate to the consequence of relying on them. | Tool qualification review |
| GAEP-ASR-REQ-008 | A release or readiness outcome SHALL preserve failed criteria, accepted residual risk, exceptions, conditions and unresolved obligations. | Gate record review |
| GAEP-ASR-REQ-009 | Production or post-release evidence SHALL be able to invalidate prior assurance and reopen decisions. | Drift/incident scenario |

## Coverage

Coverage is declared against claims, requirements, risks, decisions, quality attributes, interfaces, data conditions, environments, effects and failure modes as applicable. One universal linear trace spine is not required; each profile declares graph patterns that demonstrate relevant coverage.

## Profile contract

| Contract field | Candidate declaration |
|---|---|
| Core compatibility | Compatible with GAEP Core `>=0.1.0 <0.2.0`; the effective manifest pins exact claim, subject, method, tool, environment, profile, policy, and evidence versions. |
| Versioned dependencies | Every ID in `normative_dependencies` has the compatible range `>=0.1.0 <0.2.0`; missing, incompatible, or cyclic inputs leave assurance unresolved. |
| Applicability and selection | Select when a governed decision relies on evidence-backed confidence in material claims; record the decision, critical claims, subject, selecting principal, consequence, uncertainty, and exact profile revision. |
| Co-selection rules | Mandatory: every profile already applicable to the subject under assurance remains selected. Consequence-triggered: select Audit Integrity when the claim depends on accountable reconstruction and Incident Response when evaluating response, continuity, recovery, closure, or restored confidence. Assurance never replaces Security, Data, AI, Operational Reliability, Legal, Workforce Trust, Architecture, Migration, Product, or change-profile obligations. |
| Obligations | Claim selection, evidence quality, coverage, independence, tool qualification, negative evidence, decision rules, and invalidation obligations supplement the subject profiles. |
| Permitted variation points | Evidence methods, coverage depth, assessor independence, review cadence, confidence expression, and artifact form may vary by consequence and uncertainty. Critical-claim visibility, failed-criterion preservation, evidence binding, and invalidation are not variation points. |
| Authority, evidence, and cadence | GAEP Profile Specification Steward maintains this profile's semantics; the effective configuration identifies Assurance Authority, claim and decision owners, assessor independence, evidence methods, expiry, and review cadence. |
| Conformance | Conformance requires an exact manifest, assurance plan, claim-to-evidence coverage, requirement and negative-case results, deviations, conflicts, confidence limits, and residual uncertainty. |
| Compatibility and conflicts | Conflicting evidence, insufficient independence, invalid tools, or incompatible subject-profile requirements remain unresolved and cannot be averaged into confidence. |
| Invalidation, migration, deprecation, and expiry | Change to claim, subject, method, tool, assessor, environment, data, profile, policy, evidence validity, or production result reopens assurance. Profile evolution preserves claim, evidence, decision, expiry, migration, and historical replay mappings. |

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-ASR-REQ-010 | Assurance-profile selection and every subject-domain co-selection SHALL be explicit, attributable, and bound to exact compatible claim, subject, profile, method, tool, and evidence versions. | Composition and binding review |
| GAEP-ASR-REQ-011 | Tailoring SHALL use only declared variation points and SHALL NOT weaken critical-claim visibility, evidence binding, independence required by consequence, failed-criterion preservation, or invalidation. | Tailoring negative test |
| GAEP-ASR-REQ-012 | A conformance claim SHALL identify the effective manifest, assurance plan, evidence for every applicable requirement and required negative case, coverage gaps, conflicts, deviations, and confidence limits. | Conformance-record review |
| GAEP-ASR-REQ-013 | Material change or profile migration, deprecation, expiry, or replacement SHALL invalidate affected manifests and SHALL preserve claim, evidence, decision, expiry, migration, and historical replay mappings. | Lifecycle-change scenario |

## Required negative cases

- High evidence volume masks missing coverage of a critical claim or non-compensable failure.
- AI-authored subject matter is reviewed only by a correlated AI system and labeled independent.
- A changed subject, tool, method, environment, or dataset retains an earlier assurance result.
- Failed or conflicting criteria disappear from a release or readiness outcome.
- Production evidence contradicts an approved claim without reopening the decision.
