---
id: GAEP-REG-007
title: Candidate State Dimension Registry
document_type: registry
schema_version: 1.0
version: 0.2.0
status: proposed
owner_role: GAEP State Registry Steward
scope: Candidate cross-domain state dimensions and starter values
normative_level: normative
classification: internal
provenance: GAEP pre-implementation restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CORE-004
informative_references: []
supersedes: []
---

# Candidate State Dimension Registry

## Cross-domain dimensions

Values are candidates. Profile-specific statecharts may add namespaced values only where the owning contract permits variation.

| Dimension ID | Purpose | Candidate values | Explicitly not represented here |
|---|---|---|---|
| `gaep.state.authoring-lifecycle` | authoring and review progress | draft, proposed, in-review, finalized | approval outcome, baseline designation, operational eligibility, retention |
| `gaep.state.revision-disposition` | standing of one revision in a lineage | candidate, current, withdrawn, superseded | approval, operational eligibility, deletion, retention, validity |
| `gaep.state.operational-eligibility` | whether new operational use remains eligible | eligible, deprecated, retired | authoring progress, validity, retention |
| `gaep.state.validity` | fitness for declared use under known conditions | valid, invalidated, unknown | freshness or approval |
| `gaep.state.freshness` | alignment with relevant current sources | current, potentially-stale, stale, unknown | correctness or authority |
| `gaep.state.retention` | records/storage disposition | active-retention, archived, retained, disposal-pending, disposed | authoring lifecycle |
| `gaep.state.applicability` | whether a rule, profile, criterion, or obligation applies | applicable, not-applicable, unresolved | obligation strength, fulfillment, validity |
| `gaep.state.obligation-strength` | normative force of an applicable obligation | required, conditional, recommended, optional | applicability, timing, fulfillment, disposition |
| `gaep.state.fulfillment` | evidence-backed fulfillment of an applicable obligation | unsatisfied, in-progress, satisfied, satisfied-through-reuse | applicability, timing, waiver, deferral, expiry |
| `gaep.state.obligation-activity` | whether work on an obligation is active | inactive, active, blocked, closed | strength, timing, fulfillment, disposition |
| `gaep.state.obligation-timing` | time relationship for an obligation | not-due, due, overdue, expired | activity, fulfillment, waiver, cancellation |
| `gaep.state.obligation-disposition` | authoritative disposition of the obligation | active, waived, replaced, cancelled | fulfillment, approval outcome, risk acceptance |
| `gaep.state.approval-case-lifecycle` | progress of approval request | draft, requested, in-review, closed, cancelled | approval outcome |
| `gaep.state.approval-outcome` | accountable approval result | approved, conditionally-approved, changes-requested, rejected, deferred, incomplete, indeterminate | case lifecycle, authorization validity |
| `gaep.state.authorization-validity` | whether grant can currently authorize | current, suspended, expired, revoked, consumed, invalidated | action outcome, policy evaluation |
| `gaep.state.decision-outcome` | accountable disposition of one decision question | option-selected, no-action-selected, deferred, option-set-rejected, unresolved | authoring lifecycle, effectiveness |
| `gaep.state.decision-effectiveness` | whether a decided outcome currently has effect | pending, effective, suspended, expired, revoked | outcome, revision disposition |
| `gaep.state.execution-phase` | logical position in run protocol | resolving, authorizing, contextualizing, planning, executing, validating, committing, recovering | active/waiting or result |
| `gaep.state.execution-activity` | whether execution is progressing | active, waiting, paused, terminal | success/failure outcome |
| `gaep.state.execution-outcome` | terminal or explicitly uncertain result | succeeded, partially-succeeded, failed, denied, cancelled, compensated, uncertain, unverified | execution phase or activity |
| `gaep.state.conformance-assessment` | result against declared requirements | conforming, partially-conforming, nonconforming, indeterminate | marketing claim or approval |
| `gaep.state.claim-assessment` | epistemic support for one bounded claim | not-assessed, supported, partially-supported, not-supported, inconclusive | approval, conformance, freshness |
| `gaep.state.evidence-assessment` | fitness of evidence for declared use | not-assessed, fit-for-declared-use, not-fit-for-declared-use, inconclusive, disputed | authoring lifecycle, freshness, validity |
| `gaep.state.semantic-verification` | assessment of a trace link or semantic mapping | not-assessed, verified, disputed, failed, inconclusive | authoring lifecycle, freshness, validity |
| `gaep.state.mapping-fidelity` | preservation of meaning in one exact source-to-target semantic mapping | not-mapped, lossless, lossy, unknown | compatibility, semantic verification, representation strategy, migration decision, approval, authorization |
| `gaep.state.gate-result` | result against a declared gate contract | not-assessed, incomplete, failed, conditionally-passed, passed, blocked | approval, authorization, conformance |

## Subject and state ownership

Every State Record binds one exact subject. A relationship between subjects does not copy, merge, or propagate their State Values unless the owning contract defines an explicit transition or derived-view rule.

For the Product and Initiative semantic boundary:

- Product operational eligibility, including retirement, belongs to the exact Product Managed Asset;
- Initiative condition belongs to the exact Initiative under its applicable registered or Profile-defined State Dimension and Statechart;
- closing or cancelling an Initiative does not retire, supersede, approve, or otherwise transition a target Product;
- retiring a Product does not close, delete, or rewrite the Initiatives, Changes, Work Items, decisions, evidence, or historical relationships associated with it;
- a mapping-fidelity State Record binds one exact mapping assessment identified by its source revision, target revision or target identity set, mapping method, and assessed semantic scope; it is not an intrinsic state of either endpoint;
- a legacy value that combines Product and Initiative meaning maps to separate subject-and-dimension results, or remains explicitly lossy or unresolved when a defensible separation cannot be established.

## Scoped designations rather than intrinsic state

Baseline membership, release-channel membership and current organizational designation are relationships or scoped records against exact revision sets. They are not intrinsic lifecycle values of one resource.

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-STATE-REG-REQ-001 | Each state value SHALL belong to one named dimension and SHALL NOT silently carry meaning from another dimension. | Cross-dimension review |
| GAEP-STATE-REG-REQ-002 | A profile-specific value SHALL identify namespace, owning profile, allowed transitions, compatibility and mapping to Core consequences. | Extension-state review |
| GAEP-STATE-REG-REQ-003 | Unknown, conflicted and blocked conditions SHALL identify typed reason and resolution path; `blocked` SHALL NOT become a substitute universal state value. | Negative scenarios |
| GAEP-STATE-REG-REQ-004 | Derived readiness SHALL preserve individual criterion results and blockers instead of becoming an independently editable universal status. | Readiness projection review |
| GAEP-STATE-REG-REQ-005 | Legacy values SHALL map by exact source subject, target subject or target-subject set, semantic dimension, and mapping assessment; a composite or ambiguous value SHALL produce separate explicit mappings or an unresolved or lossy result, and visually similar labels SHALL NOT be normalized without meaning review. | Migration mapping review |
| GAEP-STATE-REG-REQ-006 | Authoring lifecycle values SHALL be exactly `draft`, `proposed`, `in-review`, or `finalized` for the common document metadata contract; `approved`, `baselined`, `deprecated`, and `retired` SHALL be represented through their separate outcome, designation, or operational-eligibility semantics. | Metadata-registry alignment |
| GAEP-STATE-REG-REQ-007 | Applicability, obligation strength, activity, timing, fulfillment, and disposition SHALL remain separate; no value in one dimension SHALL imply a value in another. | Obligation-state matrix test |
| GAEP-STATE-REG-REQ-008 | Approval outcome SHALL expose `incomplete` and `indeterminate`, and authorization validity SHALL expose `suspended`; none SHALL be normalized to rejection, expiry, or revocation. | Failure-state scenario |
| GAEP-STATE-REG-REQ-009 | Baseline membership, Baseline Set designation, approval, release-channel membership, and current organizational designation SHALL remain scoped relationships or governed records rather than intrinsic State Values. | Designation negative test |
