---
id: GAEP-CORE-008
title: Trace, Provenance, and Semantic Registry - Retired Contraction Source
document_type: reference
schema_version: 1.0
version: 0.1.0
status: retired
owner_role: GAEP Semantic Registry Steward
scope: Historical trace for trace, provenance, and registry requirements contracted into GAEP-CORE-003 or extracted from Core
normative_level: informative
classification: internal
provenance: GAEP Core contraction from the proposed 12-contract candidate
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies: []
informative_references:
  - 003_GOVERNED_RESOURCE_AND_VERSION_MODEL.md
  - ../99_Registries_and_References/005_CANONICAL_TERMINOLOGY_INDEX.md
  - ../99_Registries_and_References/006_CANDIDATE_RELATIONSHIP_REGISTRY.md
  - ../99_Registries_and_References/010_CORE_BOUNDARY_AND_COMPLEXITY_BUDGET.md
supersedes: []
---

# Trace, Provenance, and Semantic Registry - Retired Contraction Source

## Status

This document ID is retained only for historical resolution. It is not an active Core contract and defines no current normative requirements. The portable version-bound trace, attributable provenance, lossy-transformation, controlled-value, and append-only semantic-history invariants are now owned by GAEP-CORE-003. AI/provider provenance, external synchronization, materialized-index, storage, integrity, and conformance mechanics are extracted to their declared Profiles, Realizations, adapters, registries, or deferred targets.

The exact disposition of every former trace/provenance/registry requirement is recorded in GAEP-REG-010. Historical Git revisions preserve the original text. A historical identifier, link, or file location does not reactivate a retired requirement.

## Open decision lineage

These questions remain unresolved and are retained here so their stable IDs continue to resolve. Their current owner, tier, blocked scope, assumed answer, evidence, closure, deferral, and prohibited-reliance fields are canonical in GAEP-REG-009.

| Open decision ID | Question | Current consequence |
|---|---|---|
| GAEP-TPS-OD-001 | Which relationship, resource-type, state, and authority registries are included in the first Core release? | The initial registry set remains unresolved. |
| GAEP-TPS-OD-002 | How are global, organizational, and extension namespaces allocated and collisions resolved? | Namespace portability remains unresolved. |
| GAEP-TPS-OD-003 | Which relationships require materialized inverses rather than derived indexes? | Storage and consistency mechanics belong to a later Realization decision. |
| GAEP-TPS-OD-004 | Which integrity and trusted-time requirements apply by risk profile? | Profile-specific integrity remains unresolved. |
| GAEP-TPS-OD-005 | What are the minimum cross-repository and offline reference-resolution semantics? | Offline and cross-repository resolution remain unresolved. |

## Non-effect

Retirement of this proposed source document is a candidate architecture disposition only. It is not a Baseline Set designation, constitutional supersession, approval, migration authorization, or permission to implement.
