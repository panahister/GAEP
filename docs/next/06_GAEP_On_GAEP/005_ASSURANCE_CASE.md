---
id: GAEP-SELF-005
title: GAEP-on-GAEP Candidate Assurance Case
document_type: workspace-record
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Assurance Authority
scope: Evidence and assurance for readiness evaluation of a first bounded implementation slice
normative_level: informative
classification: internal
provenance: GAEP pre-implementation restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CORE-007
informative_references: []
supersedes: []
---

# GAEP-on-GAEP Candidate Assurance Case

## Top claim

**GAEP-CLAIM-000:** The GAEP Next candidate is sufficiently valuable, coherent, trustworthy, usable, portable, and operable for one bounded implementation slice to receive an Implementation Readiness Gate Evaluation.

Current Core claim assessment: **`not-assessed`**. No accountable evaluator has applied the declared evidence method to an exact candidate revision. This is the claim to be evaluated, not a conclusion.

## Claim decomposition

| Claim ID | Claim | Required evidence | Evidence readiness | Current Core claim assessment |
|---|---|---|---|---|
| GAEP-CLAIM-001 | A defined target user has a recurring problem worth solving | interviews, historical cases, baseline workflow measures, alternatives assessment | missing | `not-assessed` |
| GAEP-CLAIM-002 | The proposed first workflow produces material value | manual Product and non-Product pilots, comparison, repeat willingness | missing | `not-assessed` |
| GAEP-CLAIM-003 | Governance burden is proportionate | author/reviewer/steward effort, latency, duplicate-work analysis | missing | `not-assessed` |
| GAEP-CLAIM-004 | Core semantics are coherent and profile-independent | ontology review, registry checks, dependency DAG, scenario results | candidate structural evidence exists; independent evaluation missing | `not-assessed` |
| GAEP-CLAIM-005 | Decisions and approvals are attributable and version-bound | identity/delegation/authorization scenarios and threat review | candidate contracts exist; accountable evaluation missing | `not-assessed` |
| GAEP-CLAIM-006 | Security; data, privacy, and records; AI; operational reliability; audit integrity and accountability; incident response and continuity; legal, IP, and supplier; and workforce trust, accessibility, and ethics risks are controlled for the first slice where applicable | exact profile-selection manifest with approved selections or justified non-selections; threat and data inventories; supplier, legal, participant, and accessibility assessments; reliability and continuity objectives; negative scenarios; exact residual-risk decisions | missing | `not-assessed` |
| GAEP-CLAIM-007 | Evidence supports decisions without overstating certainty | claim/evidence assessments, conflict and invalidation scenarios | candidate model exists; scenario and independence evidence missing | `not-assessed` |
| GAEP-CLAIM-008 | The model remains usable without one AI provider or centralized runtime | manual path and provider-replacement scenario | missing | `not-assessed` |
| GAEP-CLAIM-009 | External authority and multi-repository trace remain reliable | inaccessible-source, mapping-loss and federation scenarios | missing | `not-assessed` |
| GAEP-CLAIM-010 | GAEP can be sustained and governed | named owners, capacity, support, funding and change control | missing | `not-assessed` |
| GAEP-CLAIM-011 | The candidate corpus conforms to its own rules | metadata, requirement, registry, link, dependency and review evidence | deterministic checks are partial evidence; independent semantic review missing | `not-assessed` |

## Evidence quality

Evidence is assessed for relevance, subject/revision binding, method validity, independence, completeness, recency, integrity, classification, reproducibility limits, known conflicts, and expiry conditions. Self-authored documents demonstrate intent, not product value or operational effectiveness.

The only permitted Claim Assessment results are `not-assessed`, `supported`, `partially-supported`, `not-supported`, and `inconclusive`. Evidence readiness labels such as `missing` or `candidate evidence exists` are inventory descriptions, not Claim Assessment results.

## Decision rule

The top claim cannot be supported by averaging away a failed critical claim. Claims 001 through 011 are candidate critical claims, including evidence integrity/decision honesty in Claim 007 and external-authority/federation reliability in Claim 009. A profile may establish that a claim is conditionally non-applicable only through explicit scope, rationale, authority, evidence, consequence, and review trigger.

The GAEP Assurance Authority, once legitimately assigned, may refine the critical-claim rule before evaluation. Changing it after observing results requires a new Decision Record that preserves the prior rule, rationale, dissent, bias risk, and consequence; it cannot silently convert a failed critical claim into an acceptable aggregate score.
