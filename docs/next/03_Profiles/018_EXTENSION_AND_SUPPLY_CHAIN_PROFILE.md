---
id: GAEP-PROF-018
title: Extension and Supply-Chain Profile
document_type: profile
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Profile Specification Steward
scope: Optional extensions, packages, plugins, publishers, dependencies, permissions, distribution, and supply-chain trust
normative_level: normative
classification: internal
provenance: GAEP Core contraction and extraction GAEP-EXT-010
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CST-003
  - GAEP-REG-001
  - GAEP-CORE-003
  - GAEP-CORE-005
  - GAEP-CORE-006
  - GAEP-CORE-007
  - GAEP-CORE-009
  - GAEP-CORE-012
informative_references:
  - ../99_Registries_and_References/004_DEFERRED_CAPABILITY_REGISTER.md
  - ../99_Registries_and_References/010_CORE_BOUNDARY_AND_COMPLEXITY_BUDGET.md
supersedes: []
---

# Extension and Supply-Chain Profile

## Scope

Select this Profile only when an exact governed subject introduces, distributes, installs, loads, activates, updates, revokes, or retires an extension or dependency. It governs extension and supply-chain mechanics outside the portable Core. It does not authorize a marketplace, distribution channel, installation, activation, data access, credential use, or executable effect.

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-EXTSUP-REQ-001 | Every extension SHALL have a stable namespaced identity, exact revision, class, owner, publisher, lifecycle state, approval state, support state, and declared Core variation points. | Extension-manifest validation |
| GAEP-EXTSUP-REQ-002 | An extension SHALL declare dependencies, permissions, data classes, recipients, tools, effects, credentials, budgets, failure modes, evidence, recovery, compatibility, migration, and exit obligations. | Manifest-completeness review |
| GAEP-EXTSUP-REQ-003 | Extension semantics SHALL use owned namespaces and SHALL NOT redefine, weaken, shadow, or bypass a Core invariant outside an explicit permitted variation point. | Semantic-override negative test |
| GAEP-EXTSUP-REQ-004 | Presence, discovery, download, installation, successful loading, publisher identity, integrity verification, certification, or marketplace listing SHALL NOT imply approval, activation, trust, fitness, or authorization. | Installation-and-trust negative test |
| GAEP-EXTSUP-REQ-005 | Transitive dependencies, effective permissions, provenance, integrity, source, publisher assurance, review, evaluation, license, supplier, and distribution channel SHALL be resolved before activation. | Dependency and supply-chain review |
| GAEP-EXTSUP-REQ-006 | An extension SHALL receive no ambient authority, credential, data access, tool, or effect merely because its host possesses it. | Ambient-authority test |
| GAEP-EXTSUP-REQ-007 | Activation SHALL bind an exact extension revision and dependency closure to effective policy, Profile configuration, Approval Determination where required, and an applicable Authorization Grant for every effect. | Activation authorization scenario |
| GAEP-EXTSUP-REQ-008 | Vulnerable, compromised, malicious, expired, revoked, unsupported, or incompatible extensions SHALL support quarantine, affected-scope discovery, credential and grant revocation, rollback or containment, evidence preservation, and governed recovery. | Revocation and containment tabletop |
| GAEP-EXTSUP-REQ-009 | Extension update, replacement, or removal SHALL preserve required records, obligations, compatibility results, migration mappings, configuration history, unresolved effects, and rollback conditions. | Lifecycle migration review |
| GAEP-EXTSUP-REQ-010 | A marketplace or commercial certification capability SHALL remain deferred until a separate Decision and Profile define publisher governance, liability, transparency, attestation, dispute, revocation, support, and authority boundaries. | Deferred-capability inspection |

## Profile contract

| Contract field | Candidate declaration |
|---|---|
| Core compatibility | Compatible with the contracted eight-contract GAEP Core `>=0.1.0 <0.2.0`; exact extension, dependency, registry, Profile, policy, supplier, and target revisions are pinned in the effective manifest. |
| Versioned dependencies | Every normative dependency and extension dependency uses explicit compatible ranges and exact resolved revisions; missing, cyclic, mutable-unresolved, expired, revoked, compromised, or unsupported inputs are non-permissive. |
| Applicability and selection | Select for extension or dependency introduction, distribution, installation, loading, activation, update, revocation, quarantine, replacement, or retirement. Mere availability does not select this Profile or activate an extension. |
| Co-selection rules | Mandatory: Security for executable or privileged extensions; Legal, IP, and Supplier for third-party publishers, packages, licenses, suppliers, or distribution; Data for data access or transmission; Operational Reliability and Incident Response for supported operational use; AI for model, agent, prompt, skill, or AI-provider extensions; Audit Integrity for integrity or certification claims. |
| Obligations | Identity, provenance, dependency closure, least permission, supply-chain review, exact activation, monitoring, revocation, containment, migration, rollback, support, and exit obligations remain explicit. |
| Permitted variation points | Package format, signing technology, distribution mechanism, evaluation method, support tier, review cadence, and sandbox technique may vary. Core non-weakening, exact identity, least authority, no ambient permission, explicit activation, revocation, and truthful compatibility are not variation points. |
| Authority, evidence, and cadence | GAEP Profile Specification Steward owns Profile semantics; the manifest identifies Distribution and Ecosystem Owner, Security Authority, Legal and Supplier Authority, applicable domain authorities, publisher, approver, evidence, support owner, and review triggers. |
| Conformance | Conformance requires an exact manifest, applicable co-Profiles, dependency and permission closure, provenance and integrity evidence, activation and revocation scenarios, deviations, incidents, and unresolved obligations. |
| Compatibility and conflicts | Extension compatibility is assessed by exact dimension under GAEP-CORE-012. A material unknown or incompatibility remains visible and cannot be normalized by successful loading or publisher reputation. |
| Invalidation, migration, deprecation, and expiry | Change to extension, dependency, publisher, permission, data, effect, supplier, license, integrity, support, Profile, policy, target, incident, or compatibility evidence invalidates affected manifests and triggers governed migration or containment. |

## Required negative cases

- An installed or signed extension is treated as approved or authorized.
- A transitive dependency gains ambient credentials or data.
- A mutable publisher alias changes after review.
- An incompatible extension loads successfully and is reported as conforming.
- Revocation leaves active grants, credentials, data access, or pending effects.
- Marketplace presence is represented as GAEP approval.
