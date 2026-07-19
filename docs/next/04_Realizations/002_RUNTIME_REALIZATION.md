---
id: GAEP-REAL-002
title: Runtime Realization
document_type: realization
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Runtime Steward
scope: Optional GAEP-compatible orchestration runtimes
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
  - GAEP-CORE-004
  - GAEP-CORE-005
  - GAEP-CORE-006
  - GAEP-CORE-009
  - GAEP-CORE-010
  - GAEP-CORE-011
informative_references:
  - ../../02_Platform/017_RUNTIME_MODEL.md
  - ../../05_AI_Runtime/042_AGENT_EXECUTION_FLOW.md
supersedes: []
---

# Runtime Realization

## Purpose

A GAEP runtime is an optional coordinator of already-defined Core contracts. It may resolve configuration, assemble context, obtain authorization, invoke capabilities, validate results, record effects, and recover. It is not the source of policy, identity, content authority, or approval meaning.

## Realization contract

This realization is compatible with GAEP Core `>=0.1.0 <0.2.0`. Every ID in `normative_dependencies` uses that compatible range, while a runtime conformance manifest pins exact Core, profile, registry, policy, capability, adapter, and runtime versions or digests. Missing, incompatible, cyclic, revoked, or unsupported dependencies remain explicit and non-permissive.

The runtime consumes, and does not redefine, Core-owned identity and authority, State Dimensions and events, policy and exception results, review and approval records, Authorization Grants and Confirmations, profile resolution, capability contracts, effect descriptors and envelopes, execution outcomes, and recovery records. A realization-specific record is an implementation mapping only and cannot become a competing semantic authority.

## Runtime transaction boundary

A governed run is proposed to follow these logical phases:

1. resolve subject, scope, requested action, principal, profiles, policy, and authority;
2. establish a version-pinned input and context snapshot;
3. determine required decisions, approvals, obligations, evidence, and stop conditions;
4. create a reviewable plan with predicted effects and recovery strategy;
5. acquire exact, valid authorization for effects that require it;
6. execute least-authority capabilities;
7. capture actual effects, outputs, evidence, failures, and uncertainty;
8. validate outcomes against declared postconditions;
9. commit governed records or compensate/recover explicitly;
10. close with a terminal outcome and unresolved obligations.

This is a logical protocol, not a mandated deployment architecture.

## Effect-descriptor mapping

The runtime maps observed work to the composable descriptors owned by GAEP-CORE-011. The mapping does not assign permission or create a mutually exclusive runtime class.

| Runtime observation | Core descriptor mapping | Boundary |
|---|---|---|
| Inspection without intended mutation or disclosure beyond the authorized recipient | `observe` | A new disclosure also carries `external-effect`. |
| Isolated working output that does not change an authoritative baseline | `provisional` | Promotion is a new effect and is classified independently. |
| Bounded mutation with a validated restoration path | `reversible-change` | A claimed rollback is insufficient until restoration semantics and postconditions are evidenced. |
| Mutation, publication, notification, transfer, or communication outside the immediate governed workspace | `external-effect`, plus any other applicable descriptor | Externality does not imply permission or irreversibility. |
| Deletion, publication, commit, spend, privilege grant, or difficult-to-restore change | `destructive-or-irreversible`, plus `external-effect` when applicable | A compensating action does not retroactively make the original effect reversible. |

Executable code, configuration, security, identity, privacy, financial, release, and deployment concerns are profile and risk dimensions, not additional effect descriptors owned by this realization. Policy and the effective profile composition separately determine whether a fully described effect is permitted, constrained, denied, or prohibited.

## Runtime invariants

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-RUN-REQ-001 | A runtime SHALL resolve effective policy, profiles, identity, scope, and capability versions before an effectful step. | Resolution trace inspection |
| GAEP-RUN-REQ-002 | A runtime SHALL consume the authorization result governed by GAEP-CORE-006 and SHALL NOT infer authorization from a request, plan, preview, capability, tool permission, gate result, prior effect, or conversational response. | Unauthorized-effect scenario |
| GAEP-RUN-REQ-003 | A runtime SHALL consume a current applicable Authorization Grant satisfying GAEP-DRAA-REQ-023 and SHALL bind it through the GAEP-CORE-011 effect envelope as required by GAEP-EER-REQ-003; it SHALL NOT define a substitute authorization record or weaker binding rule. | Authorization-binding scenario |
| GAEP-RUN-REQ-004 | A runtime SHALL delegate material-change invalidation and re-evaluation to the effective profile manifest and the rules in GAEP-PCR-REQ-020, GAEP-DRAA-REQ-020, GAEP-DRAA-REQ-021, GAEP-DRAA-REQ-025, GAEP-DRAA-REQ-026, and GAEP-EER-REQ-006 rather than maintaining a competing validity rule. | Mid-run change scenario |
| GAEP-RUN-REQ-005 | Every material effect SHALL use the GAEP-CORE-011 effect identity and envelope and the applicable GAEP-CORE-004 Event Envelope; realization telemetry SHALL reference those records rather than redefine their fields. | Effect and event mapping review |
| GAEP-RUN-REQ-006 | A runtime SHALL map authoritative results and verified postconditions to the Core execution outcome dimensions and SHALL NOT report success merely because a capability returned or produced output. | Partial-failure scenario |
| GAEP-RUN-REQ-007 | Run completion SHALL preserve the Core distinction among failed, partial, uncertain, compensated, quarantined, unverified, unattempted, and unresolved effects in accordance with GAEP-EER-REQ-013. | Partial-outcome review |
| GAEP-RUN-REQ-008 | Stop conditions SHALL be consumed from effective policy, profile, obligation, authorization, budget, and execution contracts and SHALL produce registered reasons without inventing permission. | Stop-condition scenarios |
| GAEP-RUN-REQ-009 | A runtime SHALL implement recovery through the cancellation, compensation, reconciliation, quarantine, and recovery contracts in GAEP-EER-REQ-018 through GAEP-EER-REQ-021 and GAEP-EER-REQ-029; it SHALL NOT infer restored state from compensation alone. | Recovery tabletop |
| GAEP-RUN-REQ-010 | A runtime SHALL preserve the accountable-human chain for agent-originated actions. | Delegated-agent trace review |
| GAEP-RUN-REQ-011 | A runtime SHALL expose unsupported, degraded, uncertain, or non-reproducible Core semantics in its conformance manifest and SHALL NOT silently approximate conformance. | Degraded-mode scenario |
| GAEP-RUN-REQ-012 | Runtime telemetry SHALL obey classification, minimization, purpose, access, retention, and worker-trust policies. | Data and workplace-trust review |
| GAEP-RUN-REQ-013 | A runtime SHALL map effects only to registered composable GAEP-CORE-011 descriptors, SHALL preserve every applicable descriptor, and SHALL keep effect description separate from the policy permission result. | Descriptor-composition scenarios |
| GAEP-RUN-REQ-014 | A runtime conformance claim SHALL identify exact compatible Core, profile, registry, policy, runtime, capability, and adapter versions and SHALL disclose every unsupported effect, authorization, confirmation, state, event, recovery, idempotency, concurrency, or verification semantic. | Conformance-manifest review |

## Idempotency and concurrency

Retries use stable run and step identities. A runtime determines whether an effect is safely repeatable, requires reconciliation, or must stop for human action. Concurrent runs against the same baseline expose conflicts before committing authoritative state. Last-write-wins is not a general GAEP conflict policy.

## Human interaction

The runtime presents the review package required by GAEP-CORE-006 and exposes the registered review, approval, authorization, Confirmation, revocation, and challenge semantics resolved by Core and profiles. It does not create a second response taxonomy or treat interface interaction as Approval Determination or Authorization Grant.

## No-AI and fallback paths

The protocol can be executed manually or by deterministic tooling. AI assistance is a capability choice, not a prerequisite for interpreting authoritative GAEP state. If an AI provider is unavailable or prohibited, the workspace and approval records remain usable.

## Open decisions

- Checkpoint granularity and transaction grouping require pilot evidence.
- Event transport and storage are implementation decisions.
- Cryptographic evidence profiles depend on the approved threat model.
- Human notification and attention-budget rules belong to organizational profiles.

## Required negative cases

- A runtime-specific `write`, `deploy`, or `high risk` class replaces one or more applicable Core effect descriptors.
- A conversational approval, passing gate, tool permission, or successful preview is converted into an Authorization Grant.
- An external effect is described only as reversible because a compensating action exists.
- A changed target, payload, actor, policy, profile, capability, or subject continues under stale authorization.
- Capability output or return status is reported as success without authoritative result and verified postconditions.
- Unsupported Core semantics are silently approximated or omitted from the runtime conformance manifest.
