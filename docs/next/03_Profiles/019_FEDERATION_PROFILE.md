---
id: GAEP-PROF-019
title: Federation Profile
document_type: profile
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Profile Specification Steward
scope: Cross-organization and cross-authority-domain identity, policy, data, evidence, synchronization, incident, and exit obligations
normative_level: normative
classification: internal
provenance: GAEP Core contraction and extraction GAEP-EXT-012
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CST-003
  - GAEP-REG-001
  - GAEP-CORE-001
  - GAEP-CORE-003
  - GAEP-CORE-005
  - GAEP-CORE-006
  - GAEP-CORE-007
  - GAEP-CORE-009
  - GAEP-CORE-012
informative_references:
  - ../99_Registries_and_References/010_CORE_BOUNDARY_AND_COMPLEXITY_BUDGET.md
supersedes: []
---

# Federation Profile

## Scope

Select this Profile when one governed interaction crosses independently accountable authority domains. The Core retains only distinct-domain and no-authority-amplification invariants. This Profile owns federation agreement, identity and role mapping, policy and data exchange, synchronization, incident, dispute, revocation, reconciliation, and exit mechanics.

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-FED-REQ-001 | Every federation SHALL have an exact versioned agreement identifying accountable domains, owners, purpose, scope, term, trusted identities, mappings, policy, data, evidence, effects, incident, dispute, continuity, review, amendment, termination, and exit. | Federation-agreement review |
| GAEP-FED-REQ-002 | Identity and role mappings SHALL record source identity, source assurance, local meaning, local scope, effective time, expiry, revocation, unmapped attributes, conflicts, and mapping authority. | Identity-mapping scenario |
| GAEP-FED-REQ-003 | Cross-domain policy composition SHALL preserve each non-waivable obligation and SHALL resolve conflict to denial, explicit conflict, or authorized disposition rather than the more permissive result. | Policy-conflict decision table |
| GAEP-FED-REQ-004 | Federated data exchange SHALL bind purpose, data classes, sender, recipient, destination, jurisdiction, transfer authority, handling, retention, deletion, breach, and return obligations. | Data-exchange record inspection |
| GAEP-FED-REQ-005 | Federation SHALL define synchronization, stale-reference, outage, partition, split-brain, ordering, duplicate, recovery, and reconciliation behavior before material shared effects are enabled. | Partition and recovery rehearsal |
| GAEP-FED-REQ-006 | Revocation, suspension, or termination SHALL propagate according to declared timing to mapped authority, credentials, data access, extensions, active runs, approvals, evidence reliance, and pending effects. | Revocation propagation test |
| GAEP-FED-REQ-007 | Federation exit SHALL define governed data return or deletion, retained-record disposition, authority and credential revocation, unresolved-effect reconciliation, portable export, dispute survival, and historical interpretation. | Exit rehearsal |
| GAEP-FED-REQ-008 | A remote assertion, approval, evidence item, policy result, conformance claim, or successful synchronization SHALL NOT acquire local authority beyond the intersection required by GAEP-ECF-REQ-022 and GAEP-ECF-REQ-023. | Authority-amplification negative test |

## Profile contract

| Contract field | Candidate declaration |
|---|---|
| Core compatibility | Compatible with the contracted eight-contract GAEP Core `>=0.1.0 <0.2.0`; exact domain, agreement, mapping, policy, Profile, schema, and external-authority revisions are pinned. |
| Versioned dependencies | Every normative dependency, federation agreement, mapping, registry, Profile, external authority, and policy source uses explicit compatible ranges and exact resolved revisions; missing, stale, incompatible, or revoked inputs remain unresolved. |
| Applicability and selection | Select whenever an interaction crosses independently governed authority domains, including cross-company, consortium, delegated service, or separately accountable organizational boundaries. |
| Co-selection rules | Mandatory: Security, Data Privacy and Records, Audit Integrity, Incident Response and Continuity, and Legal IP and Supplier. Consequence-triggered: AI, Operational Reliability, Workforce Trust, Architecture, Migration, and Extension/Supply-Chain Profiles. |
| Obligations | Agreement, identity, mapping, non-amplification, policy, data, evidence, synchronization, incident, dispute, revocation, reconciliation, portability, and exit obligations remain explicit per domain. |
| Permitted variation points | Protocol, transport, identity technology, signing, synchronization cadence, data-exchange format, and operational topology may vary. Distinct accountability, no authority amplification, non-waivable obligations, explicit mappings, revocation, and exit are not variation points. |
| Authority, evidence, and cadence | GAEP Profile Specification Steward owns Profile semantics; each domain assigns accountable authorities, mapping owners, data and policy authorities, incident contacts, approvers, evidence owners, and review or renewal triggers. |
| Conformance | Conformance requires an exact manifest and agreement, domain and authority resolution, mandatory co-Profiles, mapping and policy evidence, partition/revocation/exit rehearsals, deviations, and unresolved disputes or obligations. |
| Compatibility and conflicts | Compatibility, mapping fidelity, representation strategy, synchronization status, authority, and migration remain separate results. A successful exchange cannot hide semantic, policy, authority, or data incompatibility. |
| Invalidation, migration, deprecation, and expiry | Change to domain, owner, agreement, identity, mapping, policy, data, jurisdiction, Profile, protocol, incident state, synchronization behavior, supplier, or exit capability invalidates affected manifests and requires governed transition. |

## Required negative cases

- A remote role gains broader local authority through name matching.
- A missing local policy is interpreted as acceptance of remote permission.
- A partition produces two authoritative writes without reconciliation rules.
- Revocation fails to reach an active credential, approval, or pending effect.
- Exit deletes evidence required for historical accountability.
- A successful exchange is reported as semantic or legal compatibility.
