---
id: GAEP-CORE-011
title: Execution, Effect, and Recovery Model
document_type: normative-specification
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Specification Steward
scope: GAEP execution runs, side effects, verification, cancellation, compensation, and recovery
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
  - GAEP-CORE-004
  - GAEP-CORE-005
  - GAEP-CORE-006
  - GAEP-CORE-007
  - GAEP-CORE-008
  - GAEP-CORE-009
  - GAEP-CORE-010
informative_references:
  - GAEP-REG-010
supersedes: []
---

# Execution, Effect, and Recovery Model

## Purpose

This document defines how an authorized workflow becomes observable execution, how effects are prepared and verified, and how partial, failed, uncertain, cancelled, or compromised execution is contained and recovered.

## Scope and non-goals

This model defines portable semantics, not a workflow engine, transaction protocol, sandbox product, queue, scheduler, credential system, or deployment topology. It does not claim every effect is reversible or that compensation restores the original world state. Runtime retry, provider, sandbox, credential-brokerage, quarantine, and recovery mechanics are subject to the Core extraction and complexity gate in GAEP-REG-010; presence here does not prejudge that boundary decision.

## Core invariants

- Every material effect is bound to exact actor, authority, target, operation, payload, policy, and validity context.
- Preparation and preview never authorize commitment.
- Success requires an authoritative result and verified postconditions.
- Partial, failed, uncertain, cancelled, and compensated outcomes remain distinct and visible.
- Retry, cancellation, compensation, recovery, quarantine, and resume preserve history and residual risk.

## Run and effect identities

Every run has a stable run ID and binds to invocation, actor, accountable principal, workflow-plan version, effective-configuration manifest, context packs, capability versions, state snapshot, Authority Grants, Authorization Grants, environment, and time bounds.

Every material effect has a stable effect ID and an effect envelope containing:

- effect type and risk classification;
- canonical target identity and resolved target version or state;
- requested operation, exact payload or content digest, and expected result;
- initiating actor, accountable principal, exercised role, and delegation chain;
- authority and authorization references;
- data classes, destination, externality, reversibility, and blast radius;
- policy, approval, confirmation, budget, and time constraints;
- idempotency and duplicate-detection semantics;
- validation, authoritative receipt, compensation, and recovery plan;
- expiry and invalidation triggers.

## Effect descriptors

Core distinguishes the following composable semantic descriptors without assigning universal risk or forcing one mutually exclusive class:

- `observe`: reads state without an intended mutation or disclosure beyond the authorized recipient;
- `provisional`: creates isolated working output without changing an authoritative baseline;
- `reversible-change`: mutates bounded state with a validated restoration path;
- `external-effect`: changes or communicates state outside the immediate governed workspace;
- `destructive-or-irreversible`: destroys, publishes, commits, spends, grants, or changes state that is difficult to restore.

Policy permission is a separate result: an effect with any descriptor may be permitted, constrained, denied, or prohibited in a particular context. Profiles refine controls for combinations of effect, data, environment, scale, and risk. A sequence of individually low-risk effects may be classified at the aggregate workflow risk.

## Execution and effect state dimensions

Runs and effects use the orthogonal State Dimensions governed by GAEP-CORE-004 rather than a new combined run status. Applicable records include execution phase, execution activity, execution outcome, authorization validity, resource validity, revision disposition, and obligation fulfillment. Effect-specific statecharts may add preparation, commitment, verification, reconciliation, compensation, or quarantine semantics only through registered profile variation points.

For example, a run can be in a validating phase, have waiting activity, retain no terminal outcome, and depend on a current Authorization Grant. An effect can have an uncertain execution outcome while a reconciliation obligation remains unsatisfied. State changes are attributable Transition Records and Event Envelopes. Run completion does not overwrite effect, authorization, obligation, resource, or evidence state.

## Prepare, commit, and verify

Material effects follow a logical sequence:

1. resolve canonical target and current state;
2. compute exact proposed effect and preview;
3. validate policy, authority, authorization, approval, data, budget, and preconditions;
4. bind the applicable Authorization Grant to the effect envelope and expiry;
5. revalidate mutable state immediately before commitment;
6. execute through the permitted capability and credential boundary;
7. obtain authoritative result or receipt;
8. verify expected postconditions and unexpected side effects;
9. record evidence, disposition, and resulting state;
10. recover, compensate, quarantine, or escalate when the outcome is not verified.

Analysis and preparation do not authorize commit. A previewed target alias must be resolved to the same canonical target at commit.

## Idempotency, concurrency, and budgets

An effect contract declares whether duplicate requests are safe, detectable, compensable, or prohibited. Retry requires evidence that the prior attempt did not succeed or a valid idempotency guarantee. Concurrency control covers governed-resource revisions, external target state, approvals, budgets, and overlapping effect scopes.

Runs track cumulative cost, duration, data access, writes, messages, external calls, and other applicable resource budgets. Crossing a threshold triggers an explicit stop or reauthorization; decomposition must not evade aggregate limits.

## Cancellation, compensation, and recovery

Cancellation stops future permitted work; it does not assert that in-flight effects stopped. Compensation is a new attributable effect with its own authority, risk, evidence, and possible failure. Recovery records safe current state, completed and uncertain effects, affected subjects, required containment, restore or reconciliation steps, revalidation, owner, and resume conditions.

A quarantine prevents suspect outputs, capabilities, credentials, evidence, or resources from becoming authoritative or driving further effects until disposition. A kill or emergency stop may revoke future execution authority but cannot erase effects already performed.

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-EER-REQ-001 | Every run SHALL have stable identity and SHALL bind to exact invocation, actor, plan, configuration, context, capability, authority, authorization, environment, and state references. | Run-manifest validation |
| GAEP-EER-REQ-002 | Every material effect SHALL have a stable effect ID and complete effect envelope before commitment. | Effect-envelope inspection |
| GAEP-EER-REQ-003 | Effect commitment SHALL use a current applicable Authorization Grant satisfying GAEP-DRAA-REQ-023 and SHALL bind that grant to the canonical target, operation, payload or digest, scope, data, constraints, policy version, actor, and validity interval in the effect envelope. | Authorization-binding test |
| GAEP-EER-REQ-004 | A plan, analysis, preview, capability, tool permission, or prior successful effect SHALL NOT constitute authorization for a new effect. | Authority negative test |
| GAEP-EER-REQ-005 | The canonical target and mutable preconditions SHALL be revalidated immediately before a material effect commits. | Target-race scenario |
| GAEP-EER-REQ-006 | A changed target, payload, scope, actor, state, policy, approval, or risk SHALL trigger applicable approval and Authorization Grant re-evaluation under GAEP-DRAA-REQ-020, GAEP-DRAA-REQ-021, GAEP-DRAA-REQ-025, and GAEP-DRAA-REQ-026 before execution. | TOCTOU scenario |
| GAEP-EER-REQ-007 | An effect prohibited by effective policy SHALL resolve to denial and SHALL NOT be converted to an exception by a runtime, model, adapter, or tool. | Prohibited-effect test |
| GAEP-EER-REQ-008 | Analysis, preparation, commitment, verification, and recovery responsibilities SHALL be distinguishable in run evidence. | Phase-separation review |
| GAEP-EER-REQ-009 | A material external, destructive, irreversible, permission-changing, or sensitive-data effect SHALL have every Approval Determination and Confirmation required by the effective profile; Confirmation SHALL NOT replace required Approval except as permitted by GAEP-DRAA-REQ-028. | High-effect scenario |
| GAEP-EER-REQ-010 | A Confirmation used for effect commitment SHALL satisfy GAEP-DRAA-REQ-027 and SHALL bind the exact current effect envelope, including canonical target, destination, payload or data, expected effect, consequences, reversibility, and Authorization Grant. | Confirmation-package review |
| GAEP-EER-REQ-011 | A runtime SHALL NOT report effect success without an authoritative result and verified postconditions appropriate to the effect contract. | False-success negative test |
| GAEP-EER-REQ-012 | An uncertain external-effect outcome under GAEP-STATE-REQ-026 SHALL create a reconciliation, containment, or escalation obligation and SHALL block any dependent success claim until disposition. | Ambiguous-result scenarios |
| GAEP-EER-REQ-013 | Run and workflow completion SHALL NOT hide failed, partial, uncertain, compensating, quarantined, or unverified effects. | Completion-state test |
| GAEP-EER-REQ-014 | Retry of a potentially side-effecting operation SHALL require a valid idempotency rule or evidence that duplicate effect cannot occur. | Duplicate-effect test |
| GAEP-EER-REQ-015 | Idempotency scope and key SHALL bind to the intended operation, target, actor scope, and validity period. | Idempotency-collision test |
| GAEP-EER-REQ-016 | Concurrent execution SHALL detect stale resource revisions, overlapping effects, conflicting transitions, and exhausted shared budgets before commit. | Concurrency scenario |
| GAEP-EER-REQ-017 | Aggregate workflow risk and resource use SHALL be evaluated so decomposition cannot evade thresholds or approval. | Split-action negative test |
| GAEP-EER-REQ-018 | Every effect SHALL declare cancellation, compensation, rollback, reconciliation, or explicit non-reversibility behavior. | Recovery-contract validation |
| GAEP-EER-REQ-019 | Compensation governed by GAEP-STATE-REQ-020 SHALL be represented as a new effect and SHALL NOT support a restoration claim until its postconditions and residual effects are verified. | Failed-compensation scenario |
| GAEP-EER-REQ-020 | Cancellation SHALL stop future authorized steps while preserving the uncertain state of in-flight effects until verified. | In-flight cancellation test |
| GAEP-EER-REQ-021 | Recovery SHALL revalidate identity, authority, authorization, policy, state, context, approvals, capabilities, credentials, and outstanding effects before resume. | Resume scenario |
| GAEP-EER-REQ-022 | Repeated identical failure without new evidence or changed conditions SHALL stop rather than retry indefinitely. | Retry-exhaustion test |
| GAEP-EER-REQ-023 | Credentials SHALL be scoped to the minimum effect and SHALL NOT be embedded in plans, context packs, artifacts, logs, or evidence payloads. | Credential-leak test |
| GAEP-EER-REQ-024 | Untrusted outputs SHALL be validated and dispositioned before they can drive privileged tools or material effects. | Tool-chaining attack scenario |
| GAEP-EER-REQ-025 | Approval, policy, state, audit, and evidence records SHALL be outside the direct modification authority of the agent or capability they constrain, except through governed transition interfaces. | Control-record tamper test |
| GAEP-EER-REQ-026 | A compromised or suspect capability, credential, context, output, or evidence path SHALL support quarantine and revocation without erasing prior history. | Compromise-containment scenario |
| GAEP-EER-REQ-027 | Material run and effect events SHALL use the applicable GAEP-CORE-004 Event Envelope, ordering, correction, integrity, and retention semantics. | Event-history reconstruction |
| GAEP-EER-REQ-028 | External-system unavailability or governance-control failure SHALL resolve to explicit fail-closed, bounded degraded, or approved manual behavior; it SHALL NOT trigger an unapproved provider or bypass. | Dependency-outage scenario |
| GAEP-EER-REQ-029 | Recovery evidence SHALL identify the last verified safe state, all known and uncertain effects, reconciliation performed, residual risk, and resume authority. | Recovery-record review |
| GAEP-EER-REQ-030 | A conformance claim SHALL disclose unsupported effect, recovery, cancellation, idempotency, concurrency, or verification semantics. | Runtime-conformance review |

## Required negative cases

- A target alias changes between preview and commit.
- Approval covers an earlier payload or state revision.
- A timeout occurs after an external service may have committed.
- Retry duplicates a payment, publication, permission grant, or message.
- Two agents hold individually valid but conflicting plans.
- Several low-risk actions combine into a high-impact change.
- Cancellation occurs while an effect is in flight.
- Compensation fails or produces a second adverse effect.
- A tool returns success without authoritative postcondition evidence.
- The policy, identity, audit, or evidence service is unavailable.
- A model output attempts to invoke a privileged tool directly.
- A compromised credential or capability requires quarantine and revocation.

## Trust considerations

The execution control boundary includes target resolution, authorization binding, credential brokerage, effect mediation, result verification, audit, and recovery state. Tool success indicators and model reports are untrusted until mapped to authoritative postconditions. Fail-closed behavior must be balanced with an explicitly governed manual or degraded path so GAEP does not become an unexamined single point of failure.

## Open decisions

| Open decision ID | Question | Consequence |
|---|---|---|
| GAEP-EER-OD-001 | Which effect, execution-risk, and autonomy classifications belong in Core registries? | Affects portable policy and profile resolution. |
| GAEP-EER-OD-002 | What action-time confirmation and multi-party authorization profiles are required? | Affects high-impact effect safety and human burden. |
| GAEP-EER-OD-003 | Which trusted-time, event-ordering, and offline execution guarantees are required? | Affects reconciliation and audit portability. |
| GAEP-EER-OD-004 | Which cumulative resource, duration, data, and cost budget dimensions are mandatory? | Affects decomposition abuse and denial-of-resource controls. |
| GAEP-EER-OD-005 | What quarantine, emergency stop, break-glass, and manual-reconciliation semantics belong in Core versus profiles? | Affects incident containment and operational continuity. |
| GAEP-EER-OD-006 | Which effect-descriptor combinations require logically separated preparation and commitment? | Affects irreversible-action control and runtime complexity. |
