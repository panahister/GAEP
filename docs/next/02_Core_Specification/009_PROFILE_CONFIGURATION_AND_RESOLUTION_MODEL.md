---
id: GAEP-CORE-009
title: Profile, Configuration, and Resolution Model
document_type: normative-specification
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Specification Steward
scope: GAEP profiles, configuration sources, organizational bindings, and effective-resolution results
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
informative_references: []
supersedes: []
---

# Profile, Configuration, and Resolution Model

## Purpose

This document defines how Core variation points, selectable profiles, organizational bindings, initiative decisions, and run-scoped configuration produce one explainable effective configuration without silently weakening higher-authority obligations.

## Scope and non-goals

This model defines semantic resolution and conformance. It does not select a policy language, configuration syntax, storage mechanism, rules engine, or universal profile set.

## Core invariants

- Core prohibitions and mandatory invariants survive profile and local configuration.
- Lower-authority configuration never manufactures approval, authority, or exception.
- Every effective value is explainable from exact governed inputs and resolution rules.
- Unknown, conflicting, invalid, or unavailable required configuration remains explicit.
- Exceptions are scoped, authorized, temporary, reviewable, and incapable of varying non-waivable obligations.

## Configuration layers

Resolution is a staged, non-recursive protocol:

1. resolve GAEP Core and Constitution invariants plus the Base Policy Envelope from external, legal, contractual, organizational, scope, and source-authority constraints, without any selected-profile input;
2. assess profile applicability against that envelope and create one explicit Profile Selection Manifest identifying selected, excluded, conflicting, and unresolved exact profile revisions;
3. compose obligations and variation values contributed by the selected profiles without weakening the Base Policy Envelope;
4. supply the Profile Selection Manifest and selected contributions to GAEP-CORE-005 to produce the Effective Policy Snapshot and Policy Evaluation;
5. resolve approved organizational, portfolio, initiative, and implementation-unit configuration not already represented as policy;
6. resolve authorized workflow and run configuration;
7. apply implementation defaults only where an unresolved variation point explicitly permits a default.

Order does not imply unrestricted override. A lower layer may specialize an allowed variation point, add a stronger obligation, or select among permitted options. It may not weaken a non-variable prohibition or manufacture authority.

## Profile contract

A profile contains:

- stable profile ID, type, owner, version, applicable GAEP-CORE-004 State Records, and GAEP-CORE-006 approval references;
- target scope, inclusion conditions, exclusions, and applicability triggers;
- required Core version range and profile dependencies;
- obligations, prohibitions, defaults, parameters, and declared variation points;
- required roles, approvals, evidence, assurance, and review cadence;
- compatibility constraints and known conflicts;
- migration, deprecation, expiry, and invalidation rules;
- conformance criteria and negative scenarios.

Profiles are composable only when every dependency and conflict is resolved. Profile selection is an attributable decision, not a side effect of file location or tool choice.

Profile authoring lifecycle, validity, revision disposition, compatibility assessment, selection applicability, and approval remain separate dimensions or records. Deprecation, supersession, invalidation, and approval therefore never serve as synonyms.

A Profile Selection Manifest has stable identity and revision and records the subject and scope, Base Policy Envelope revision, candidate and selected profile revisions, per-profile applicability, exclusions, unresolved inputs, conflicts, selector Principal or decision source, rationale, time, and invalidation triggers. It is the only input by which selected profile contributions enter effective policy composition; Policy Evaluation does not select profiles.

## Configuration-source contract

Each source has stable identity, authority domain, exact revision, owner, effective scope and time, approval, classification, integrity reference, and precedence basis. A value records whether it is inherited, selected, defaulted, constrained, prohibited, excepted, or unresolved.

Defaults are never authority. A default may resolve only an explicitly defaultable variation point, and the effective manifest exposes its source and rationale.

## Effective configuration

Resolution returns an immutable effective-configuration manifest containing:

- manifest ID, resolution time, resolver identity, and algorithm or rule-set version;
- subject, actor, objective, environment, and requested action;
- all input source IDs and exact versions or digests;
- exact Profile Selection Manifest and per-profile applicability decisions;
- effective obligations, prohibitions, permissions, parameters, and defaults;
- provenance for each effective value;
- conflicts, unknowns, deviations, exceptions, and compensating controls;
- required approvals, evidence, and stop conditions;
- expiry, review, and invalidation triggers;
- resolution completion: `resolved`, `unresolved`, or `conflicted`;
- manifest validity as a separate State Record;
- per-profile and per-value applicability as separate results;
- effective Obligation records and their separate strength, activity, timing, fulfillment, and disposition dimensions.

The manifest is version-bound execution context. A source or scope change invalidates the manifest according to declared rules.

## Conflict and exception semantics

Policy conflict, non-exceptionable rules, Policy Exception content, and Risk Acceptance are owned by GAEP-CORE-005 and accountable approval by GAEP-CORE-006. Configuration resolution consumes their exact effective records; it does not reinterpret or recreate them.

Other configuration conflict resolution considers authority, scope specificity, effective time, and explicit permitted variation. A higher-authority minimum remains binding. Two values or requirements that cannot be jointly satisfied produce `conflicted` until an accountable decision resolves the conflict.

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-PCR-REQ-001 | Every profile and configuration source SHALL have stable identity, exact version, owner, authority, scope, effective time, and approval state. | Source-schema validation |
| GAEP-PCR-REQ-002 | Profile selection SHALL be explicit, attributable, and bound to the governed subject and exact profile versions. | Selection-record review |
| GAEP-PCR-REQ-003 | A profile SHALL declare its Core compatibility, dependencies, applicability, obligations, variation points, conformance criteria, and invalidation triggers. | Profile-contract validation |
| GAEP-PCR-REQ-004 | Effective configuration SHALL preserve the non-weakening rules in GAEP-CONF-REQ-004 and GAEP-POLICY-REQ-009 and SHALL accept specialization only through an explicit permitted variation point. | Override negative test |
| GAEP-PCR-REQ-005 | A lower layer MAY strengthen an obligation or select within an approved variation point, but the effective manifest SHALL retain the source and effect of that specialization. | Specialization scenario |
| GAEP-PCR-REQ-006 | A default SHALL resolve only a declared defaultable variation point and SHALL NOT grant authority, approval, access, or exception. | Default-escalation negative test |
| GAEP-PCR-REQ-007 | File location, naming convention, tool behavior, inherited environment, or user silence SHALL NOT constitute profile selection or approval. | Implicit-selection test |
| GAEP-PCR-REQ-008 | Resolution SHALL produce exactly one completion result from `resolved`, `unresolved`, or `conflicted`; validity, applicability, obligation, approval, and authorization SHALL be represented separately. | Result-enumeration test |
| GAEP-PCR-REQ-009 | Unknown, unavailable, invalid, expired, or conflicting required configuration SHALL produce the applicable completion, validity, and per-input results and SHALL NOT resolve to silent permission or a weaker default. | Failure-mode scenarios |
| GAEP-PCR-REQ-010 | The effective-configuration manifest SHALL identify every input source and exact version or digest used in resolution. | Manifest inspection |
| GAEP-PCR-REQ-011 | Every effective value SHALL be traceable to its source, resolution rule, and any applicable exception or decision. | Value-lineage test |
| GAEP-PCR-REQ-012 | Resolution SHALL evaluate authority, scope, time, non-waivable status, and permitted variation before precedence. | Conflict-resolution analysis |
| GAEP-PCR-REQ-013 | Incompatible requirements that cannot be jointly satisfied SHALL produce `conflicted`; a resolver SHALL NOT invent a compromise. | Irreconcilable-profile test |
| GAEP-PCR-REQ-014 | Multiple selected profiles SHALL resolve dependency and compatibility constraints before their contributed obligations become effective; a conflict in those contributions SHALL NOT disable independent higher-authority obligations from the Base Policy Envelope. | Profile-composition test |
| GAEP-PCR-REQ-015 | A profile dependency graph SHALL be acyclic and SHALL bind to explicit compatible version ranges. | Graph and compatibility check |
| GAEP-PCR-REQ-016 | A resolver SHALL consume an exception only through an exact Policy Exception revision governed by GAEP-CORE-005 and its applicable approval under GAEP-CORE-006. | Exception-input review |
| GAEP-PCR-REQ-017 | Effective configuration SHALL preserve the non-exceptionable result required by GAEP-POLICY-REQ-010 regardless of profile, organizational binding, runtime parameter, or default. | Non-waivable negative test |
| GAEP-PCR-REQ-018 | A Policy Exception excluded by GAEP-POLICY-REQ-027 SHALL be excluded from effective configuration with an explicit reason and affected obligations. | Exception-validity scenario |
| GAEP-PCR-REQ-019 | A repeated-exception review signal produced under GAEP-CORE-005 SHALL remain visible in effective configuration and SHALL NOT be normalized into a default. | Renewal scenario |
| GAEP-PCR-REQ-020 | A material change to subject, actor, action, environment, profile, policy, exception, or configuration source SHALL invalidate or reopen the effective manifest as declared. | Change-invalidation test |
| GAEP-PCR-REQ-021 | Resolution SHALL preserve conflicts, exclusions, unknowns, obligations, and non-applicable results in the manifest. | Manifest-completeness review |
| GAEP-PCR-REQ-022 | Configuration with a classification or recipient constraint SHALL NOT flow into a subject, provider, tool, or environment lacking permission. | Classification-routing test |
| GAEP-PCR-REQ-023 | A conformance claim SHALL identify its effective-configuration manifest and all deviations from the selected profiles. | Conformance-record inspection |
| GAEP-PCR-REQ-024 | Resolution behavior SHALL be deterministic for equivalent governed inputs or SHALL disclose and govern any permitted nondeterminism. | Repeat-resolution test |
| GAEP-PCR-REQ-025 | Historical effective manifests SHALL remain reconstructable after profile, registry, and configuration evolution. | Historical-replay analysis |
| GAEP-PCR-REQ-026 | Resolution SHALL follow the staged protocol of Base Policy Envelope, Profile Selection Manifest, selected-profile composition, Effective Policy Snapshot, remaining organizational configuration, and workflow/run configuration without a dependency from an earlier stage on a later stage. | Resolution-graph acyclicity test |
| GAEP-PCR-REQ-027 | The policy resolver SHALL NOT select profiles, infer profile selection, or use an Effective Policy Snapshot containing a profile to decide that same profile's applicability. | Policy-profile recursion negative test |
| GAEP-PCR-REQ-028 | An effective-configuration manifest SHALL represent resolution completion, validity, applicability, obligation strength, obligation activity, obligation timing, fulfillment, obligation disposition, approval, and authorization as orthogonal results or records. | Manifest-state inspection |
| GAEP-PCR-REQ-029 | A Profile Selection Manifest SHALL bind exact candidate and selected profile revisions, Base Policy Envelope revision, per-profile applicability and rationale, conflicts, unresolved inputs, selector authority, time, and invalidation triggers. | Selection-manifest validation |

## Required negative cases

- A local setting attempts to weaken a Core prohibition.
- Two profiles define incompatible mandatory values.
- A required source is missing, expired, or from another scope.
- A default attempts to grant access or bypass approval.
- A broad organizational rule conflicts with a narrower non-waivable obligation.
- An exception is expired, repeatedly renewed, or approved by an unauthorized beneficiary.
- A profile is selected only because a file happens to exist.
- A subject or policy changes after effective configuration is assembled.
- A provider cannot accept the effective classification.
- An old manifest cannot be reconstructed after registry migration.

## Trust considerations

The resolver and its input authority mappings are part of the trusted control surface. Well-formed configuration may still be malicious, stale, or outside authority. Resolution must distinguish source authenticity from permission to define a value. The effective manifest is evidence of what was resolved, not proof that every input policy was correct or lawful.

## Open decisions

| Open decision ID | Question | Consequence |
|---|---|---|
| GAEP-PCR-OD-001 | Which Core variation points and non-waivable requirements belong in the initial registry? | Affects all profile conformance. |
| GAEP-PCR-OD-002 | Which combining rule applies by policy family: deny-overrides, most-specific, or another governed rule? | Affects conflict and authorization results. |
| GAEP-PCR-OD-003 | How are profile namespaces owned and made portable across organizations? | Affects reuse and federation. |
| GAEP-PCR-OD-004 | What maximum renewal and escalation defaults apply to exceptions? | Affects exception normalization and governance gaming. |
| GAEP-PCR-OD-005 | What offline resolution, trusted-time, and historical replay guarantees are required? | Affects disconnected operation and audit reconstruction. |
