---
id: GAEP-CORE-004
title: State, Event, and Transition Model
document_type: normative-specification
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP State and Event Steward
scope: State dimensions, statecharts, transition control, events, concurrency, and historical reconstruction
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
  - GAEP-CORE-002
  - GAEP-CORE-003
core_package_interfaces:
  - GAEP-CORE-005
  - GAEP-CORE-006
  - GAEP-CORE-007
informative_references:
  - ../../01_Foundation/005_DESIGN_PRINCIPLES.md
  - ../../02_Platform/017_RUNTIME_MODEL.md
  - ../../02_Platform/018_STATE_MODEL.md
  - ../../05_AI_Runtime/042_AGENT_EXECUTION_FLOW.md
supersedes: []
---

# State, Event, and Transition Model

## Purpose

This document defines how GAEP represents current condition, allowed change, attributable facts, concurrency, and historical reconstruction. It replaces overloaded status fields with explicit orthogonal State Dimensions and separates requested transitions, committed transitions, events, outcomes, and derived projections.

The model is logical. It does not require event sourcing, a workflow engine, a message broker, or a particular storage technology.

## Conceptual boundary

This model owns:

- State Dimensions and Statechart Definitions;
- authoritative State Records and versioning;
- Transition Requests, transition evaluation, and committed Transition Records;
- Event Envelopes and event categories;
- concurrency, idempotency, temporal ordering, and reconstruction semantics;
- state snapshots and derived projections.

This model does not own:

- policy rules or risk calculation;
- approval decisions;
- resource content;
- runtime scheduling;
- domain-specific lifecycle values;
- integration delivery mechanisms.

Profiles define domain-specific statecharts using this contract.

## Core entities

| Entity | Meaning |
|---|---|
| State Dimension | One independent aspect of an entity's current condition, such as authoring lifecycle, validity, freshness, retention, execution phase, or authorization validity. |
| State Value | Controlled value belonging to exactly one State Dimension and versioned registry. |
| Statechart Definition | Versioned contract declaring states, transitions, guards, actions, terminal behavior, and variation points for one entity type and dimension. |
| State Record | Current authoritative value for one entity, State Dimension, and state version, with transition history references. |
| Composite State View | Derived view combining several State Records without collapsing them into one status. |
| Transition Request | Proposed move in one State Dimension with expected current version, requested target, actor, reason, authority, and evidence. |
| Transition Evaluation | Result of evaluating a Transition Request against Statechart Definition, policy, authority, guards, evidence, and concurrency. |
| Transition Record | Immutable record that a valid state change was committed or that a no-op was accepted idempotently. |
| Event | Immutable attributable fact about something that occurred. |
| Event Envelope | Common identity, type, schema, subject, actor, time, causation, correlation, classification, provenance, and integrity metadata for an Event. |
| State Snapshot | Versioned materialization of State Records at a declared time or sequence position. |
| Projection | Rebuildable view derived from Events, Transition Records, State Records, or Resource Revisions. |

## State dimensions

State Dimensions are independent unless a Statechart or policy declares a guard between them. The initial Core separation is:

| Dimension family | Examples of meaning | Concepts that do not belong in it |
|---|---|---|
| Authoring lifecycle | draft, proposed, in-review, finalized | approval outcome, operational use, baseline designation |
| Revision disposition | candidate, current, withdrawn, superseded | approval validity, authoring activity |
| Operational eligibility | eligible, deprecated, retired | authoring activity, storage retention, semantic validity |
| Validity | valid, invalidated | stale, archived, rejected |
| Freshness | current, potentially stale, stale, unknown | superseded, approved, retained |
| Retention | active-retention, archived, retained, disposal-pending, disposed | lifecycle approval or semantic validity |
| Applicability | applicable, not-applicable, unresolved | obligation strength or fulfillment |
| Obligation strength | required, conditional, recommended, optional | applicability, timing, fulfillment, or disposition |
| Fulfillment | unsatisfied, in-progress, satisfied, satisfied-through-reuse | applicability, timing, deferral, or policy obligation strength |
| Obligation activity | inactive, active, blocked, closed | timing, strength, fulfillment, or waiver disposition |
| Obligation timing | not due, due, overdue, expired | activity, fulfillment, or disposition |
| Obligation disposition | active, waived, replaced, cancelled | fulfillment or approval outcome |
| Approval Case lifecycle | draft, requested, in-review, closed, cancelled | approval outcome or validity |
| Approval outcome | approved, conditionally-approved, changes-requested, rejected, deferred, incomplete, indeterminate | request lifecycle, expiry, or authorization validity |
| Authorization validity | current, suspended, expired, revoked, consumed, invalidated | decision recommendation or review result |
| Decision outcome | option-selected, no-action-selected, deferred, option-set-rejected, unresolved | authoring lifecycle or effectiveness |
| Decision effectiveness | pending, effective, expired, suspended, revoked | decision outcome or revision disposition |
| Execution phase | resolving, authorizing, contextualizing, planning, executing, validating, committing | success, failure, waiting reason |
| Execution activity | active, waiting, terminal | execution phase or final outcome |
| Execution outcome | succeeded, partially-succeeded, failed, denied, cancelled, compensated, uncertain, unverified | current execution phase |

These examples establish separation, not universal state values for every profile. Registries own exact machine values and aliases.

## Statechart definition

A Statechart Definition contains:

- statechart ID and version;
- entity type and State Dimension;
- initial, active, and terminal states;
- allowed source-target transitions;
- guards and required other-dimension conditions;
- required Principal authority and policy result;
- required evidence or authorization;
- transition effects and emitted event types;
- idempotency and concurrency behavior;
- expiry, reopening, and compensation semantics;
- profile variation points;
- migration from earlier statechart versions.

A profile may add states or guards only through declared variation points. It cannot silently reinterpret a Core state value.

## Transition protocol

The logical transition sequence is:

1. resolve exact subject and current State Record;
2. pin the Statechart Definition and expected state version;
3. identify Actor, role, authority chain, action, reason, and requested target;
4. evaluate policy, guards, other dimensions, evidence, and authorization;
5. reject stale or conflicting expected versions;
6. commit the state change atomically within its consistency boundary;
7. create immutable Transition Record and required Events;
8. verify the committed state or expose uncertainty;
9. invalidate affected projections, context snapshots, approvals, or plans as declared.

A Transition Request is not evidence that a transition occurred.

## Event categories

| Category | Purpose |
|---|---|
| Domain Event | Records a meaningful fact inside a governed domain or profile. |
| Governance Event | Records policy, decision, approval, authorization, obligation, exception, or state-governance facts. |
| Execution Event | Records run, step, tool, checkpoint, recovery, or effect facts. |
| Integration Event | Versioned fact intended for exchange across system or organizational boundaries. |
| Audit Event | Integrity-protected record needed to reconstruct who did what, under which authority, with which result. |

One occurrence may be represented by several category-specific events, but their relationship and source fact remain explicit. An Audit Event is not automatically the business fact, and an Integration Event is not automatically the authoritative internal event.

## Event envelope

Every Event Envelope identifies:

- globally scoped event ID;
- event type and schema version;
- subject lineage and exact revision or state version;
- occurrence time and recorded time;
- producer and acting Principal;
- accountable scope;
- causation ID;
- correlation or trace ID;
- sequence, ordering scope, or explicit absence of ordering guarantee;
- payload or payload reference;
- classification and handling;
- provenance and integrity reference;
- superseding correction event when needed.

Events are immutable. Incorrect events are corrected through a linked corrective event or compensating domain action, not overwritten.

## Temporal semantics

GAEP distinguishes:

- occurrence time: when the represented fact occurred;
- recorded time: when GAEP received or persisted it;
- effective time: when a state or rule becomes applicable;
- sequence position: ordering within a declared subject or stream;
- observation time: when an external fact was observed.

Ordering is never assumed globally. Producers declare the ordering scope they can support.

## Concurrency and idempotency

State-changing requests carry:

- expected current state version;
- idempotency key where repeat is possible;
- target consistency boundary;
- known read and write scope;
- conflict behavior.

If the expected version differs, the transition is rejected or re-evaluated. Retrying a request with the same idempotency key returns the prior result or an explicit conflict; it does not duplicate the effect.

## Reopening, invalidation, and compensation

Reopening returns an entity to active consideration through a defined transition. It does not erase prior approval, outcome, or history.

Invalidation is a validity-dimension transition, not deletion. Compensation records a new action that counteracts a prior effect where possible; it does not claim the prior action never occurred. Rollback is used only when the applicable profile defines what was restored and which residual effects remain.

## Normative requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-STATE-REQ-001 | Every governed State Value SHALL belong to exactly one named, versioned State Dimension. | Registry validation |
| GAEP-STATE-REQ-002 | Authoring lifecycle, revision disposition, operational eligibility, validity, freshness, retention, applicability, obligation strength, obligation activity, obligation timing, fulfillment, obligation disposition, approval lifecycle, approval outcome, authorization validity, decision lifecycle, decision outcome, decision effectiveness, execution phase, execution activity, and execution outcome SHALL NOT be collapsed into one generic status. | Composite-state inspection |
| GAEP-STATE-REQ-003 | Every State Record SHALL identify subject, State Dimension, current State Value, state version, Statechart Definition version, effective time, and latest Transition Record. | State-record validation |
| GAEP-STATE-REQ-004 | Every state-changing action SHALL use a Transition Request containing expected state version, Actor, authority basis, reason, requested target, and idempotency identity where applicable. | Transition-request validation |
| GAEP-STATE-REQ-005 | A Transition Request SHALL NOT be interpreted as a committed transition. | Request-versus-commit scenario |
| GAEP-STATE-REQ-006 | Transition evaluation SHALL validate source state, target state, guards, authority, policy, evidence, authorization, and concurrency before commit. | Statechart decision-table test |
| GAEP-STATE-REQ-007 | A transition with a stale expected state version SHALL be rejected or explicitly re-evaluated before commit. | Concurrent-transition test |
| GAEP-STATE-REQ-008 | A committed transition SHALL create an immutable Transition Record identifying prior state, new state, Actor, time, reason, authority, evidence, and correlation. | Transition-record inspection |
| GAEP-STATE-REQ-009 | State transition and required audit recording SHALL be atomic within the declared consistency boundary or SHALL expose an explicit uncertain result requiring reconciliation. | Failure-injection scenario |
| GAEP-STATE-REQ-010 | An Event SHALL represent an occurrence and SHALL NOT be silently mutated after publication or durable recording. | Event correction scenario |
| GAEP-STATE-REQ-011 | Every material Event SHALL use an Event Envelope containing event identity, type, schema version, subject, producer, actor where applicable, occurrence and recorded times, causation, correlation, classification, and provenance. | Event-envelope validation |
| GAEP-STATE-REQ-012 | Event type names and State Values SHALL use controlled registries or declared extension namespaces. | Registry validation |
| GAEP-STATE-REQ-013 | Event consumers SHALL NOT assume global ordering unless an ordering scope and guarantee are explicitly declared. | Out-of-order event scenario |
| GAEP-STATE-REQ-014 | Duplicate transition or event delivery SHALL be handled idempotently or SHALL return an explicit duplicate-risk result before a repeated side effect. | Duplicate-delivery test |
| GAEP-STATE-REQ-015 | An accepted idempotent retry SHALL return or reference the original committed result. | Retry scenario |
| GAEP-STATE-REQ-016 | A Composite State View SHALL identify each source State Record and SHALL NOT become an independent mutable source of truth. | Projection reconstruction |
| GAEP-STATE-REQ-017 | A State Snapshot SHALL identify source versions, included dimensions, sequence or time boundary, and generation provenance. | Snapshot validation |
| GAEP-STATE-REQ-018 | Reopening SHALL preserve prior decisions, transitions, approvals, and evidence rather than overwrite them. | Reopening scenario |
| GAEP-STATE-REQ-019 | Invalidation SHALL be represented separately from deletion, retirement, freshness, and supersession. | Invalidation scenario |
| GAEP-STATE-REQ-020 | Compensation or rollback SHALL identify the original effect, compensating action, restored state, residual effects, actor, authority, and evidence. | Compensation scenario |
| GAEP-STATE-REQ-021 | Changing a Statechart Definition SHALL identify migration, compatibility, affected active instances, and re-evaluation requirements. | Statechart-upgrade review |
| GAEP-STATE-REQ-022 | A profile SHALL NOT rename a Core State Value into an unregistered synonym or change its meaning silently. | Profile conformance review |
| GAEP-STATE-REQ-023 | Unknown or unsupported required State Values or Event semantics SHALL return an explicit incompatible result. | Forward-compatibility negative test |
| GAEP-STATE-REQ-024 | Approval expiry, authority revocation, policy change, or material subject revision SHALL trigger state or guard re-evaluation before the next dependent material transition. | Mid-run invalidation scenario |
| GAEP-STATE-REQ-025 | Sensitive event payloads MAY be referenced or redacted, but the Event Envelope SHALL preserve sufficient identity, attribution, classification, and integrity for its declared use. | Redaction and audit scenario |
| GAEP-STATE-REQ-026 | A producer unable to verify whether a material external effect occurred SHALL record an uncertain outcome and SHALL NOT report success. | Ambiguous-effect scenario |
| GAEP-STATE-REQ-027 | A generic document or resource metadata field named `status` SHALL represent at most one declared State Dimension and SHALL NOT encode approval, baseline designation, validity, freshness, retention, or operational eligibility together. | Metadata-state inspection |
| GAEP-STATE-REQ-028 | Approval and Baseline Set designation SHALL be represented by separate governed records and relationships, not as values in an authoring lifecycle or revision-disposition field. | Approval-and-baseline separation scenario |
| GAEP-STATE-REQ-029 | Obligation applicability, strength, activity, timing, fulfillment, and disposition SHALL be separately recordable so that, for example, an applicable required obligation may be active, overdue, unsatisfied, and unwaived simultaneously. | Obligation composite-state test |
| GAEP-STATE-REQ-030 | Decision authoring lifecycle, revision disposition, operational eligibility, decision outcome, and decision effectiveness SHALL be separate State Dimensions so that a finalized accepted decision can remain pending, expire, be superseded, or retire from new use without rewriting its outcome. | Decision-state reconstruction |

## Negative cases

| Case | Required result |
|---|---|
| A run is waiting for approval while its last phase was validating | Execution activity is waiting, phase remains explicit, and waiting reason references approval; no synthetic combined status is invented. |
| An approved architecture resource becomes stale | Approval history remains, freshness changes, and policy determines whether use is blocked. |
| A resource is superseded and archived | Supersession and retention dimensions change independently. |
| Two actors transition the same state version | At most one conflicting transition commits; the other is rejected or re-evaluated. |
| An event is discovered to contain a wrong result | A corrective event links to it; the original remains in history. |
| A tool times out after sending an external request | Outcome is uncertain until authoritative reconciliation; it is not assumed failed or succeeded. |
| A retry repeats the same idempotency key | The prior result is returned or referenced without another side effect. |
| A profile uses pending-review instead of the registered in-review value | Validation rejects the unknown synonym or requires an explicit registered mapping. |

## Open decisions

| Open decision ID | Question | Consequence |
|---|---|---|
| GAEP-STATE-OD-001 | Which State Dimension and Event Type registries belong in the first Core conformance release? | Affects interoperability versus profile autonomy. |
| GAEP-STATE-OD-002 | Which Transition Records require integrity protection beyond ordinary resource provenance? | Affects approval, audit, and distributed trust. |
| GAEP-STATE-OD-003 | What minimum ordering guarantee is required for a conforming runtime or workspace? | Affects reconstruction and concurrent change behavior. |
| GAEP-STATE-OD-004 | How are retroactively effective transitions represented when valid time differs from recorded time? | Affects audit and temporal queries. |
| GAEP-STATE-OD-005 | Which uncertain external-effect states are universal versus adapter-specific? | Affects recovery portability. |
| GAEP-STATE-OD-006 | Should Core define a common corrective-event relationship or leave correction entirely to type registries? | Affects cross-domain audit interpretation. |

## Cross-contract dependencies

- Transition subjects and scope come from GAEP-CORE-001.
- Actors and authority chains come from GAEP-CORE-002.
- Revision identity, immutable records, and baselines come from GAEP-CORE-003.
- Policy decisions, risks, and obligations guard transitions under GAEP-CORE-005.
- Decision, review, approval, and Authorization Grant events use GAEP-CORE-006.
