---
id: GAEP-ADAPT-004
title: External System Mapping Contract
document_type: adapter-profile
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Integration Steward
scope: Mappings between GAEP and authoritative external systems
normative_level: normative
classification: internal
provenance: GAEP pre-implementation restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CST-003
  - GAEP-CORE-003
  - GAEP-CORE-008
  - GAEP-CORE-012
  - GAEP-REAL-001
informative_references:
  - ../../99_References/993_EXTERNAL_PROJECTS.md
supersedes: []
---

# External System Mapping Contract

## Purpose

This contract covers issue trackers, architecture repositories, source-control platforms, CI/CD, identity systems, evidence stores, document systems, observability, security tooling and similar sources. Each integration declares authority, mapping, synchronization and loss semantics.

An external system can be authoritative for selected facts without becoming authoritative for every GAEP concept. Transport success, local caching, a familiar field name, or source-system permissions do not prove semantic equivalence or grant permission for a downstream effect.

## Mapping package boundary

A mapping package separates:

1. a versioned **mapping definition**;
2. an **external namespace binding** for a specific tenant, project, repository, dataset, environment, or equivalent boundary;
3. protected **credential and principal bindings**;
4. **compatibility and reconciliation evaluations**; and
5. an **activation record** defining allowed directions, fields, effects, schedules, and validity.

The mapping definition contains no reusable credential. Activation is invalid when an authority, schema, compatibility, security, data, retention, credential, or external-system assumption no longer holds.

## Mapping record

A mapping identifies:

- mapping ID and version;
- GAEP source and target types;
- external system, tenant, namespace and type;
- field, state, relation and identity mappings;
- authoritative direction by field or representation;
- synchronization triggers and direction;
- conflict, deletion, tombstone and inaccessible-source behavior;
- version and time semantics;
- classification, access, privacy and residency constraints;
- round-trip losses and unsupported concepts;
- reconciliation owner and operational objective;
- test evidence and compatibility range.

The record also declares whether each material fact is source-observed, configured, externally asserted, inferred, cached, transformed, or unknown. A cached or transformed representation retains the source identity, source revision or observation time, transformation identity, and freshness status needed to interpret it.

## Field authority matrix

Every mapped field, relation, state dimension, or event has an authority row:

| Field | Meaning |
|---|---|
| GAEP subject | exact canonical or namespaced term |
| external subject | system, namespace, type, field and schema version |
| authority | authoritative side, conditional authority, or no authoritative write path |
| direction | import, export, bidirectional, observe-only, or manual |
| fidelity | exact, narrowed, extended, transformed, lossy, or unsupported |
| conflict rule | detection, precedence, escalation and preservation behavior |
| time/version rule | ordering, freshness, concurrency and revision semantics |
| delete/retention rule | deletion, tombstone, hold, retention and inaccessible-source behavior |
| effect/authorization rule | whether a write is material and what Authorization Grant it requires |
| evidence | minimum import, export, reconciliation and failure evidence |

`Bidirectional` is not an authority rule. A bidirectional field still needs a deterministic conflict contract or must stop for resolution.

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-MAP-REQ-001 | Every mapping SHALL declare the authoritative side for each writable field or representation. | Mapping review |
| GAEP-MAP-REQ-002 | A bidirectional mapping SHALL define conflict, concurrency, deletion, tombstone, ordering and reconciliation behavior. | Conflict scenarios |
| GAEP-MAP-REQ-003 | Mapping loss SHALL be reported and SHALL NOT be silently represented as semantic equivalence. | Round-trip test |
| GAEP-MAP-REQ-004 | External identity and authority mappings SHALL preserve the accountable principal and SHALL expose ambiguous or unmapped identity. | Identity scenario |
| GAEP-MAP-REQ-005 | External state values SHALL map to orthogonal GAEP dimensions or remain namespaced extensions; adapters SHALL NOT overload a nearby Core value. | State mapping review |
| GAEP-MAP-REQ-006 | Deletion, legal hold, retention, and source unavailability SHALL produce explicit records and downstream consequences. | Records scenario |
| GAEP-MAP-REQ-007 | Compatibility evidence SHALL be scoped to exact mapping and external-system versions. | Upgrade review |
| GAEP-MAP-REQ-008 | Mapping definition, namespace binding, credential/principal binding, evaluation result, and activation record SHALL be separate governed subjects. | Record-schema review |
| GAEP-MAP-REQ-009 | A mapping SHALL declare authority, direction, fidelity, conflict, time/version, deletion/retention, authorization, and evidence semantics for every material field, relation, state, and event. | Completeness review |
| GAEP-MAP-REQ-010 | A cached, transformed, aggregated, or inferred representation SHALL preserve source, observation time or source revision, transformation provenance, freshness, fidelity, and invalidation status. | Provenance scenario |
| GAEP-MAP-REQ-011 | Import SHALL NOT convert missing, inaccessible, stale, ambiguous, or lossy source data into a valid or complete GAEP fact. | Import negative test |
| GAEP-MAP-REQ-012 | Export or synchronization that can create a material external effect SHALL require an applicable Authorization Grant bound to the exact mapping, subject, direction, and effect boundary. | Unauthorized-write test |
| GAEP-MAP-REQ-013 | Source-system access SHALL NOT be treated as GAEP authority to approve, authorize, reclassify, disclose, delete, or override a governed subject. | Authority-confusion scenario |
| GAEP-MAP-REQ-014 | Credentials and service principals SHALL be least-privileged, separately bound, revocable, attributable, rotated, and excluded from mapping content and ordinary evidence. | Credential review |
| GAEP-MAP-REQ-015 | Reconciliation SHALL expose divergence, duplicate delivery, reordering, partial application, retry, replay, and unknown final state without fabricating convergence. | Fault-injection scenario |
| GAEP-MAP-REQ-016 | Activation SHALL define allowed namespaces, data classes, operations, directions, schedules or triggers, rate/resource limits, validity, monitoring, stop conditions, and revocation behavior. | Activation-boundary test |
| GAEP-MAP-REQ-017 | Mapping evaluation SHALL include round-trip, conflict, concurrency, deletion, retention, permission-change, schema-change, outage, partial-effect, replay, and exit scenarios as applicable. | Evaluation review |
| GAEP-MAP-REQ-018 | A mapping SHALL stop or enter an explicit degraded state when an authority, identity, compatibility, data, security, or fidelity precondition is not established; it SHALL NOT silently choose a convenient source. | Degraded-mode scenario |
| GAEP-MAP-REQ-019 | External-system retirement or replacement SHALL preserve interpretable provenance, unresolved obligations, tombstones, audit evidence, export capability, and the authoritative-source transition decision. | Exit exercise |

## No-double-entry principle

Adoption should replace existing work where possible. If the same fact must be manually maintained in multiple systems, the mapping design records why, who reconciles it, how divergence is detected, and when the duplication will be removed.

## Required negative cases

At minimum, an applicable mapping evaluation covers:

- two systems both claim authority for the same writable fact;
- identity matches by display name but not by stable principal binding;
- an external state combines multiple GAEP dimensions;
- the source deletes, redacts, reorders, or rewrites history;
- a write succeeds remotely but local acknowledgement or evidence capture fails;
- a retry duplicates a non-idempotent effect;
- source permissions, schema, retention, classification, tenant, or API behavior changes;
- clocks disagree or source sequence data is incomplete;
- the source is unavailable while cached data is stale; and
- exit/export cannot preserve a required fact or relationship.

## Open design decisions

| Decision ID | Question | Current status |
|---|---|---|
| GAEP-MAP-OD-001 | What portable schemas represent mapping definitions, namespace bindings, evaluations and activations? | unresolved |
| GAEP-MAP-OD-002 | What trusted-time and ordering evidence is mandatory for each integration class? | unresolved |
| GAEP-MAP-OD-003 | What minimum reconciliation objectives, error budgets and escalation rules apply by risk class? | unresolved |
| GAEP-MAP-OD-004 | How are external systems handled when they cannot expose immutable revisions, tombstones, deletion evidence or complete history? | unresolved |
| GAEP-MAP-OD-005 | Which mapping classes require independent assurance before activation? | unresolved |
| GAEP-MAP-OD-006 | Which schema, authority, tenant, credential, provider or policy changes force re-evaluation, re-activation or both? | unresolved |
