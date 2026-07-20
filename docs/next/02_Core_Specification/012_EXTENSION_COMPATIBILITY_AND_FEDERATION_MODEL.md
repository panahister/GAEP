---
id: GAEP-CORE-012
title: Extension, Compatibility, and Federation Model
document_type: normative-specification
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Specification Steward
scope: GAEP extensions, compatibility, portability, trust domains, and federation
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
  - GAEP-CORE-004
  - GAEP-CORE-005
  - GAEP-CORE-006
  - GAEP-CORE-007
  - GAEP-CORE-009
informative_references: []
supersedes: []
---

# Extension, Compatibility, and Federation Model

## Purpose

This document defines how GAEP may be extended, versioned, exchanged, and federated across organizations, workspaces, repositories, runtimes, providers, and tools without silently changing Core semantics or amplifying authority.

## Scope and non-goals

This model governs semantic contracts. It does not mandate a plugin system, package format, marketplace, identity federation protocol, schema language, transport, signing technology, deployment topology, or centralized control plane.

## Core invariants

- Extensions add behavior only at declared variation points and never redefine Core meaning silently.
- Compatibility is multidimensional, version-bound, and evidence-backed.
- Installation, integrity, or publisher identity alone does not establish approval or fitness.
- Adapters translate declared semantics but never fabricate unsupported authority, state, evidence, or recovery behavior.
- Federation preserves distinct authority domains and cannot amplify privilege through mapping.

## Extension classes

An extension is a governed resource that adds or specializes behavior at a declared Core variation point. Candidate classes include:

- profile and organizational-binding extensions;
- capability, workflow, validator, and evaluation extensions;
- registry and semantic-vocabulary extensions;
- representation, resolver, import, and export extensions;
- runtime and adapter extensions;
- evidence, observability, and policy-integration extensions.

An extension cannot redefine a Core term, state, prohibition, or invariant merely by using the same label. New semantics use an owned namespace and declare their relationship to Core.

## Extension manifest

An extension manifest contains:

- stable namespaced ID, class, owner, publisher, version, applicable GAEP-CORE-004 State Records, and GAEP-CORE-006 approval references;
- purpose, scope, variation points, supported use cases, exclusions, and limitations;
- required Core, profile, extension, registry, and external dependency versions;
- added semantics, resources, states, events, capabilities, configuration, and representations;
- requested permissions, data classes, recipients, tools, effects, credentials, and resource budgets;
- policy, risk, assurance, evidence, evaluation, and operating obligations;
- provenance, publisher trust, integrity, distribution, and revocation references;
- compatibility, migration, rollback, coexistence, deprecation, and retirement behavior;
- conformance class, known deviations, and negative cases.

Extensions use separate GAEP-CORE-004 State Dimensions. Authoring lifecycle, validity, revision disposition, retention, operational eligibility, approval, Authorization Grant validity, and support state remain independent. For example, a finalized revision may be deprecated but retained; an approved extension may be inactive; an active extension may be quarantined; and a revoked Authorization Grant does not erase the extension resource or its history. `installed`, `present`, or `discoverable` is not an approval or activation state.

## Compatibility dimensions

Compatibility is assessed separately across:

- semantic meaning and Core invariants;
- schema and representation;
- identity, version, trace, and provenance;
- state, event, and transition behavior;
- policy, risk, obligation, approval, and authorization behavior;
- capability, workflow, context, effect, and recovery behavior;
- data classification, privacy, records, and retention behavior;
- assurance, evidence, observability, and operational behavior;
- migration, coexistence, rollback, and exit.

Results are `compatible`, `compatible-with-conditions`, `incompatible`, `unknown`, or `not-applicable` per dimension. One aggregate `compatible` label must not hide a failed material dimension.

## Negotiation and translation

Capability or protocol negotiation compares exact supported contracts, versions, profiles, semantics, permissions, and evidence. An adapter translates representations and operations at an explicit boundary; it does not redefine authority or fabricate unsupported semantics. Lossy translation identifies omissions and consequences.

Unknown required fields, events, states, relationship types, policy outcomes, or effect semantics fail explicitly. Optional unknowns may be preserved opaquely only when the owning contract permits it and no security or semantic invariant is affected.

## Candidate compatibility staging

`GAEP-DEC-007` selects a versioned mapping between the legacy Product-as-Initiative representation and the candidate Product-as-durable-Managed-Asset model. The selected initial treatment is staged dual-read with one authoritative write model per exact subject and no dual-write. It remains a Proposed, pending-effectiveness Decision and does not activate migration or supersession.

During a future separately approved initial compatibility phase:

- legacy-only consumers read preserved legacy records using their original historical semantics;
- explicitly versioned candidate consumers read candidate Product, Initiative, Change, and Work Item identities only after exact mappings resolve them;
- a mapping result records mapping fidelity independently from compatibility by dimension and representation strategy;
- unresolved, ambiguous, or lossy mappings remain explicit and cannot manufacture identity, cardinality, state history, approval, or authority;
- no writer updates both representations, and no reader's compatibility view becomes a second authoritative source;
- rollback restores the prior read routing and preserves every source record, mapping record, and attributable transformation result;
- any future dual-write proposal requires a new Decision Record covering write authority, synchronization, conflict precedence, failure, reconciliation, rollback, and historical interpretation.

This staging contract is a compatibility constraint, not a migration Approval Determination, constitutional supersession, Profile activation, or Authorization Grant.

## Federation model

A federation connects independently governed authority domains while preserving local accountability. A federation agreement identifies:

- participating authority domains, accountable owners, purpose, scope, and term;
- trusted identities, role and attribute mappings, assurance levels, and revocation paths;
- shared and non-shared resources, canonical identities, resolvers, and authoritative sources;
- policy composition, non-waivable obligations, conflicts, and exception authority;
- permitted data classes, purposes, recipients, jurisdictions, transfers, retention, and deletion;
- allowed capabilities, effects, resource budgets, and operational boundaries;
- evidence, audit, incident, notification, dispute, appeal, and oversight responsibilities;
- availability, continuity, synchronization, split-brain, recovery, and exit behavior;
- conformance, review, expiry, amendment, and termination conditions.

Federation does not merge authority domains. A remote assertion is evidence from its domain; local policy determines whether and how it is trusted. Delegated or mapped authority is limited to the intersection of both domains' valid grants and the federation agreement.

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-ECF-REQ-003 | An extension SHALL NOT redefine, weaken, shadow, or bypass a Core prohibition, invariant, state meaning, or authority rule outside an explicit permitted variation point. | Semantic-override negative test |
| GAEP-ECF-REQ-011 | Compatibility SHALL be assessed by declared dimensions and SHALL NOT collapse a material incompatibility into one positive aggregate label. | Compatibility-matrix inspection |
| GAEP-ECF-REQ-012 | Compatibility results SHALL bind to exact Core, profile, extension, registry, representation, and dependency versions. | Version-change scenario |
| GAEP-ECF-REQ-013 | Unknown or untested compatibility SHALL resolve to `unknown` and SHALL NOT be represented as compatible. | Unknown-compatibility test |
| GAEP-ECF-REQ-014 | A material version, configuration, dependency, provider, policy, or semantic change SHALL invalidate affected compatibility and conformance evidence. | Compatibility-invalidation test |
| GAEP-ECF-REQ-015 | Deprecation SHALL identify replacement, compatibility window, migration, coexistence, support, and retirement criteria. | Deprecation-record review |
| GAEP-ECF-REQ-016 | Migration SHALL preserve governed identity, provenance, decisions, approvals, evidence, and historical interpretation or SHALL disclose any loss. | Migration round-trip test |
| GAEP-ECF-REQ-017 | Export and import SHALL preserve canonical semantics or identify every lossy, unsupported, transformed, or locally interpreted element. | Round-trip and loss test |
| GAEP-ECF-REQ-018 | An adapter SHALL declare its capability and semantic limits and SHALL NOT fabricate support for a Core state, evidence, authorization, effect, or recovery behavior. | Adapter negative test |
| GAEP-ECF-REQ-020 | Optional unknown fields MAY be preserved opaquely only when the owning contract permits it and no mandatory interpretation or trust decision depends on them. | Forward-compatibility test |
| GAEP-ECF-REQ-022 | Federation SHALL preserve distinct authority domains; a remote identity, role, decision, approval, policy, or evidence item SHALL NOT acquire local authority automatically. | Cross-domain authority test |
| GAEP-ECF-REQ-023 | Federated authority SHALL be no greater than the intersection of valid local and remote grants, mappings, policy, and agreement constraints. | Privilege-amplification negative test |

## Required negative cases

- An extension shadows a Core term with weaker behavior.
- A package is treated as approved because it is installed or signed.
- A transitive dependency requests undeclared network, data, or credential access.
- A provider or extension changes behavior without a visible version change.
- An adapter maps `unknown` or `partial` to success.
- Import/export drops dissent, invalidation, evidence, or authorization scope.
- Two federated domains use the same role label with different authority.
- Remote approval is accepted without local authority mapping.
- Federation policy conflict resolves to the more permissive rule.
- A network partition creates competing authoritative updates.
- Revocation fails to stop an active run or pending effect.
- Federation exit leaves credentials, retained data, or unresolved effects behind.

## Trust considerations

Integrity and signatures can identify a publisher or artifact but do not establish fitness, safety, or authority. Compatibility is a versioned assurance claim, not a marketing label. Federation expands trust and blast radius: identity, policy, data, evidence, operations, incident response, and exit must all be explicit before shared authority or material effects are enabled.

## Open decisions

| Open decision ID | Question | Consequence |
|---|---|---|
| GAEP-ECF-OD-001 | How are extension namespaces governed, and which publisher-trust levels are portable? | Affects ecosystem and organizational control. |
| GAEP-ECF-OD-002 | What minimum evaluation, permission, integrity, and revocation profiles apply to extensions? | Affects supply-chain assurance and adoption. |
| GAEP-ECF-OD-003 | Who owns Core compatibility and conformance suites, and how are they versioned? | Affects neutrality and certification trust. |
| GAEP-ECF-OD-004 | How are version ranges and behavioral changes handled when providers expose mutable aliases? | Affects compatibility evidence and invalidation. |
| GAEP-ECF-OD-005 | Which identity-assurance, conflict-resolution, and trusted-time profiles govern federation? | Affects cross-domain authority and audit. |
| GAEP-ECF-OD-006 | What portability minimums and lossy translation classes are acceptable? | Affects exit strategy and semantic preservation. |
| GAEP-ECF-OD-007 | What are the boundaries of marketplace governance, certification, transparency, and third-party attestation? | Affects future ecosystem scope and liability. |
