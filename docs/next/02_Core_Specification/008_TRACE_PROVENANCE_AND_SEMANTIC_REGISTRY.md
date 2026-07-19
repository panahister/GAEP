---
id: GAEP-CORE-008
title: Trace, Provenance, and Semantic Registry
document_type: normative-specification
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Specification Steward
scope: GAEP governed identities, semantic relationships, provenance, and controlled registries
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
  - GAEP-CORE-006
core_package_interfaces:
  - GAEP-CORE-009
informative_references: []
supersedes: []
---

# Trace, Provenance, and Semantic Registry

## Purpose

This document defines portable identity, trace, provenance, and controlled semantic registry contracts. It enables impact analysis and explanation without requiring one storage technology or treating a hyperlink as a verified semantic relationship.

## Scope and non-goals

This model defines graph semantics, not a graph database, file layout, query language, hash algorithm, or repository host. It does not require every possible relationship or provenance event to be materialized.

## Core invariants

- Stable identity is independent of mutable location and display labels.
- A semantic relationship is an attributable governed assertion, not merely a resolvable link.
- Derived content retains a traceable provenance path to exact source revisions.
- Controlled meanings are owned, namespaced, versioned, and never repaired by silent synonym coercion.
- Impact is relationship-specific, bounded, and explicit about missing knowledge.

## Identity and subject references

A governed resource reference uses the Resource Lineage and Resource Revision semantics owned by GAEP-CORE-003. A material trace assertion records the exact endpoint revisions or declared version constraints it evaluated. Location, filename, display title, branch name, vendor object key, and `latest` remain resolver inputs rather than trace semantics.

An external reference additionally records authority domain, resolver, canonical external identity, observed revision, access time, and synchronization or snapshot status.

## Trace-link contract

A trace link contains:

- stable link ID and relationship-type registry ID;
- source and target subject IDs with versions or version constraints;
- scope and direction;
- assertion owner, source, and creation time;
- rationale and supporting evidence where required;
- authoring lifecycle, semantic-verification assessment, freshness, validity, revision-disposition, and retention State Records;
- applicability, validity interval, and invalidation triggers;
- provenance and integrity reference;
- impact-propagation behavior declared by the relationship type.

Trace links use separate State Dimensions under GAEP-CORE-004:

- authoring lifecycle, such as `draft`, `proposed`, `in-review`, or `finalized`;
- semantic-verification assessment, such as `not-assessed`, `verified`, `disputed`, `failed`, or `inconclusive`;
- freshness, such as `current`, `potentially-stale`, `stale`, or `unknown`;
- validity, such as `valid` or `invalidated`;
- revision disposition, such as `candidate`, `current`, `withdrawn`, or `superseded`;
- operational eligibility, such as `eligible`, `deprecated`, or `retired`;
- retention, such as `active-retention`, `archived`, `retained`, or `disposed`.

Link state is not inherited from either endpoint, and one dimension does not imply another. For example, a verified link can later be stale while remaining historically valid for the revision pair it evaluated.

## Provenance contract

GAEP-CORE-003 owns each resource's Provenance Record. This model extends those records into a traversable chain of attributable provenance events rather than a single `generated-by` label. A provenance event identifies:

- event ID, type, actor or system identity, role, and time;
- input subjects and exact versions or digests;
- transformation, import, observation, derivation, or decision performed;
- command, capability, workflow, context, model, tool, and configuration references where applicable;
- output subjects and versions;
- declared omissions, lossy transformations, and uncertainty;
- integrity, classification, and retention metadata.

Derived content retains resolvable lineage to original sources. A summary or merged artifact records which statements are copied, transformed, inferred, or newly generated when that distinction is material.

## Semantic registry contract

A controlled registry entry contains:

- stable namespaced ID, canonical machine value, and human label;
- definition, owner, version, status, and authority;
- applicable source and target types or usage scope;
- permitted cardinality, direction, and inverse relationship where relevant;
- whether transitivity, symmetry, or inheritance is allowed;
- required rationale, evidence, approval, and impact behavior;
- aliases and deprecated values with migration rules;
- compatibility, review, and invalidation triggers.

Controlled registry entries use GAEP-CORE-004 authoring, validity, revision-disposition, and retention dimensions. Approval, when required, is a GAEP-CORE-006 Approval Determination rather than a lifecycle value; deprecation and supersession are recorded without erasing the previously governed meaning. Unknown values remain unknown; they are not normalized to the nearest familiar term.

## Core relationship families

The initial Core requires registry support for, but does not approve the final vocabulary of:

- governance: `governed-by`, `constrained-by`, `approved-by`, `excepted-by`;
- derivation: `derived-from`, `summarizes`, `supersedes`, `invalidates`;
- realization: `realizes`, `implements`, `configured-by`, `deployed-as`;
- dependency: `depends-on`, `consumes`, `provides`, `contains`;
- assurance: `claims`, `supports-claim`, `contradicts-claim`, `verified-by`, `evaluated-by`;
- change: `changes`, `affects`, `potentially-affects`, `migrates-from`;
- knowledge: `asserts`, `assumes`, `qualifies`, `disputes`, `learned-from`.

These labels are candidate semantic families. Canonical values become usable only through approved registry entries.

## Impact and invalidation

Impact traversal follows relationship semantics, not arbitrary graph reachability. Each material relationship type declares whether a source or target change creates `no-propagation`, `review-candidate`, `potentially-stale`, `stale`, or `invalidated` impact. An impact result proposes or causes a transition in the applicable assessment, freshness, or validity dimension; it does not create one combined link status. Traversal records path, rule version, visited subject versions, boundary, exclusions, and unresolved links.

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-TPS-REQ-001 | In addition to Resource Lineage identities governed by GAEP-RESVER-REQ-001, every material Trace Link, provenance event, and registry entry SHALL have its own stable identifier. | Identity mutation test |
| GAEP-TPS-REQ-002 | A trace assertion whose meaning depends on content SHALL reference endpoints using the exact Resource Revision, digest, or explicit constraint semantics of GAEP-CORE-003. | Reference validation |
| GAEP-TPS-REQ-003 | When a trace assertion uses a mutable resolver or version constraint, verification SHALL record the exact resolved endpoint revisions, resolver, and resolution time. | Resolver pinning test |
| GAEP-TPS-REQ-004 | Every trace link SHALL use an approved relationship-type registry entry or remain explicitly provisional and non-authoritative. | Registry resolution test |
| GAEP-TPS-REQ-005 | A trace link SHALL identify source, target, versions, assertion provenance, scope, invalidation conditions, and each applicable GAEP-CORE-004 State Record independently. | Link-schema validation |
| GAEP-TPS-REQ-006 | Relationship direction, inverse, transitivity, symmetry, and impact behavior SHALL come from the relationship registry and SHALL NOT be inferred from a label. | Semantic scenario test |
| GAEP-TPS-REQ-007 | Link verification SHALL establish both endpoint resolution and semantic fitness; resolvable endpoints alone SHALL NOT produce `verified`. | False-link negative test |
| GAEP-TPS-REQ-008 | Semantic-verification assessment, freshness, validity, revision disposition, and retention SHALL remain separate so `disputed`, `stale`, `invalidated`, `superseded`, and `retired` cannot be treated as interchangeable link states. | Link-state-dimension test |
| GAEP-TPS-REQ-009 | A multi-step derivation SHALL connect the Provenance Records required by GAEP-RESVER-REQ-015 through attributable transformation events from source revisions to output revisions. | Lineage reconstruction test |
| GAEP-TPS-REQ-010 | A lossy transformation or summary SHALL disclose material omissions, aggregation, and uncertainty. | Transformation review |
| GAEP-TPS-REQ-011 | When AI provenance required by GAEP-RESVER-REQ-016 spans context, capability, model or execution engine, adapter, and transformation steps, the provenance chain SHALL preserve each material contributing reference. | AI-provenance inspection |
| GAEP-TPS-REQ-012 | Unknown model or provider details SHALL be recorded as unknown and SHALL NOT be fabricated or silently replaced by an alias. | Unknown-provenance scenario |
| GAEP-TPS-REQ-013 | A Trace Link to an External Representation governed by GAEP-RESVER-REQ-019 SHALL additionally record the relationship between local and external authority domains and the resolver observation used to verify the link. | External-reference test |
| GAEP-TPS-REQ-014 | A link between an external source and synchronized local copy SHALL identify which side is authoritative for each semantic scope and SHALL expose disagreement or unavailable synchronization. | Split-authority scenario |
| GAEP-TPS-REQ-015 | Controlled values SHALL be namespaced, versioned, owned, and governed through registry lifecycle. | Registry-schema validation |
| GAEP-TPS-REQ-016 | Registry aliases SHALL resolve to one canonical meaning and SHALL identify deprecation and migration behavior. | Alias-resolution test |
| GAEP-TPS-REQ-017 | Unknown or conflicting registry values SHALL produce an explicit unresolved or invalid result; they SHALL NOT be coerced to a familiar value. | Unknown-value negative test |
| GAEP-TPS-REQ-018 | Reuse of a retired registry value for a new meaning SHALL be prohibited. | ID-reuse check |
| GAEP-TPS-REQ-019 | Impact traversal SHALL use versioned relationship semantics and SHALL record traversal paths, boundaries, and exclusions. | Impact-report inspection |
| GAEP-TPS-REQ-020 | Absence of a trace link SHALL NOT be treated as evidence of no impact. | Missing-link scenario |
| GAEP-TPS-REQ-021 | Change propagation SHALL preserve unaffected subjects and SHALL NOT mark all reachable nodes stale without a relationship-specific rule. | Bounded-impact test |
| GAEP-TPS-REQ-022 | Provenance and trace metadata SHALL inherit applicable classification and access constraints and SHALL be minimized when metadata itself is sensitive. | Metadata-disclosure review |
| GAEP-TPS-REQ-023 | Integrity references SHALL protect the bound identity and content semantics; a digest without trusted provenance SHALL NOT establish authority. | Forged-source analysis |
| GAEP-TPS-REQ-024 | Trace, provenance, and registry history SHALL be append-only in meaning; corrections SHALL create attributable amendment or supersession events. | History reconstruction test |
| GAEP-TPS-REQ-025 | A conformance claim SHALL identify unresolved, external, provisional, disputed, and stale relationships that affect the claimed scope. | Conformance-trace review |

## Required negative cases

- A target moves while its stable identity remains the same.
- A mutable alias resolves to different content after approval.
- A valid link points to the wrong subject version.
- A relationship label is used with incompatible source and target types.
- A summary loses a material exception or contradiction.
- An external source changes, disappears, or disagrees with its snapshot.
- A registry receives an unknown synonym or reuses a retired value.
- Graph traversal crosses an authority or classification boundary.
- Missing links falsely produce a `no impact` conclusion.
- A valid digest is attached to content from an untrusted source.

## Trust considerations

Semantic authority, source authenticity, content integrity, and access authorization are separate dimensions. A compromised repository can contain well-formed metadata; a signed record can assert a false semantic relationship; an authorized actor can create an erroneous link. Trace and provenance therefore support review and detection but do not substitute for source trust, policy, or evidence.

## Open decisions

| Open decision ID | Question | Consequence |
|---|---|---|
| GAEP-TPS-OD-001 | Which relationship, resource-type, state, and authority registries are included in the first Core release? | Affects initial interoperability and scope. |
| GAEP-TPS-OD-002 | How are global, organizational, and extension namespaces allocated and collisions resolved? | Affects federation and portability. |
| GAEP-TPS-OD-003 | Which relationships require materialized inverses rather than derived indexes? | Affects storage and consistency obligations. |
| GAEP-TPS-OD-004 | Which integrity and trusted-time requirements apply by risk profile? | Affects audit, evidence, and cross-domain trust. |
| GAEP-TPS-OD-005 | What are the minimum cross-repository and offline reference-resolution semantics? | Affects disconnected operation and historical reconstruction. |
