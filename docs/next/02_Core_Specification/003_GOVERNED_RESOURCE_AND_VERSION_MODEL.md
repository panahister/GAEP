---
id: GAEP-CORE-003
title: Governed Resource and Version Model
document_type: normative-specification
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Resource and Version Steward
scope: Governed resource identity, immutable revisions, representations, provenance, versions, and baselines
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
core_package_interfaces:
  - GAEP-CORE-004
  - GAEP-CORE-005
  - GAEP-CORE-006
  - GAEP-CORE-007
  - GAEP-CORE-008
informative_references:
  - ../../02_Platform/011_REPOSITORY_PHILOSOPHY.md
  - ../../03_Product_Engineering/022_ARTIFACT_LIFECYCLE.md
  - ../../04_Repository/033_ARTIFACT_MODEL.md
  - ../../04_Repository/034_METADATA_MODEL.md
supersedes: []
---

# Governed Resource and Version Model

## Purpose

This document defines the common identity, revision, representation, version, provenance, and baseline semantics for durable GAEP resources. It ensures that approval, trace, context, evidence, and change can bind to exact meaning without equating a path, Git commit, external URL, mutable record, or display label with the resource itself.

## Conceptual boundary

This model owns:

- Governed Resource lineage and immutable revision identity;
- native, external, and derived representations;
- version axes and content integrity references;
- provenance and derivation;
- Candidate Revision Sets, Baseline Proposals, Baseline Sets, and their designations;
- supersession, deprecation, retention, and historical resolution semantics.

This model does not own:

- resource-specific content schemas;
- transition authorization;
- state-machine definitions;
- policy evaluation;
- context-selection algorithms;
- storage or database technology.

## Core entities

| Entity | Meaning |
|---|---|
| Governed Resource | Any durable GAEP entity whose identity, meaning, provenance, state, relationships, or authority must be governed. |
| Resource Type | Controlled semantic category defining required content, relationships, state dimensions, and conformance rules. |
| Resource Lineage | Stable identity connecting the revisions of one governed concept or artifact through time. |
| Resource Revision | Immutable statement of resource content and meaning at one revision identity. |
| Representation | Concrete native, external, binary, textual, visual, structured, or virtual form through which a Resource Revision can be accessed. |
| Native Representation | Representation whose authoritative content is maintained inside a declared GAEP workspace or repository boundary. |
| External Representation | Representation whose authoritative content remains in another governed system. |
| Derived View | Reproducible representation calculated from identified source revisions and a versioned view definition. |
| Snapshot | Captured immutable representation of an otherwise mutable or externally controlled source. |
| Content Digest | Integrity reference calculated over declared canonical content or a declared external immutable object. |
| Provenance Record | Attributable record of origin, contributors, source revisions, transformations, context, and generating execution. |
| Semantic Version | Human-meaningful version assigned according to the Resource Type's version policy. |
| Schema Version | Version of the contract used to represent or validate a resource. |
| Storage Revision | Repository commit, external revision, object version, or equivalent storage identity. |
| Candidate Revision Set | Immutable, version-pinned collection of exact Resource Revisions assembled for comparison, review, approval, release preparation, or another declared purpose. Membership carries no approval, authority, or baseline meaning. |
| Candidate Set Membership | Version-pinned association between a Candidate Revision Set revision and a Resource Revision. |
| Baseline Proposal | Governed request to designate one exact Candidate Revision Set revision as authoritative for a declared scope, purpose, release, environment, and proposed validity interval. |
| Baseline Set | Approved designation that references one exact Candidate Revision Set revision and the exact Approval Determination accepting that designation for a declared scope, purpose, release, environment, or time interval. |
| Baseline Membership | Derived designation relationship from a Baseline Set through its exact Candidate Revision Set revision to member Resource Revisions; it is not an intrinsic resource state. |
| Resolution Alias | Mutable convenience name such as current, stable, or active that resolves to an exact revision and records that result at use time. |

## Governed Resource categories

Governed Resource is the common envelope, not a claim that every resource has identical behavior. Initial categories include:

- Artifact: durable content, model, contract, code, design, or evidence package;
- Record: attributable decision, state, policy evaluation, approval, event, change, risk, or run record;
- Capability Definition: command, skill, workflow, validator, profile, adapter contract, or template;
- Principal and Authority Record;
- External Resource Reference;
- Claim, Evidence Item, or Assessment;
- Derived Index or View Definition;
- Candidate Revision Set, Baseline Proposal, Baseline Set, or Release Set.

Resource Type definitions identify which metadata, state dimensions, relationships, and verification apply.

## Identity and revision

Resource Lineage answers “which governed concept is this?” Resource Revision answers “what exactly did that concept mean at this point?” Representation answers “where and how can that exact revision be inspected?”

A revision is immutable in meaning. Correcting a factual, normative, behavioral, structural, approval-relevant, or trace-relevant error creates a new revision. Storage migration, link repair, or non-semantic rendering repair may update representation administration only when the content digest and interpretation remain unchanged and the action is recorded.

### Canonical identity

Canonical resource identity contains:

- issuing Authority Namespace;
- stable Resource Lineage ID;
- Resource Type;
- exact Resource Revision ID when revision precision is required.

Human-readable aliases and paths may accompany the canonical identity. They are never the sole cross-workspace identity.

## Version axes

| Axis | Question answered | Rule |
|---|---|---|
| Resource Lineage ID | Which enduring governed resource is referenced? | Stable and never reused. |
| Resource Revision ID | Which exact immutable meaning is referenced? | Unique within the lineage. |
| Semantic Version | Which human-facing compatibility or release meaning applies? | Governed by Resource Type policy; optional where not useful. |
| Schema Version | Which representation contract interprets the resource? | Independent from content version. |
| Storage Revision | Where was this representation stored or observed? | Supporting identity; does not imply approval. |
| Content Digest | Does content match the expected bytes or canonical form? | Algorithm and canonicalization scope are declared. |
| Candidate Revision Set Version | Which immutable version-pinned collection is being reviewed or proposed? | Membership is immutable per set revision and implies no authority. |
| Baseline Set Version | Which coherent version-pinned collection is authoritative for a named scope? | Immutable membership per set revision. |
| External Revision | Which provider-controlled version or snapshot was evaluated? | Required when external authority is material. |

No version axis silently substitutes for another.

## Metadata layers

A resource envelope separates:

### Identity

- canonical lineage and revision IDs;
- Resource Type and schema version;
- title and summary;
- Scope References.

### Content and representation

- representation kind and location;
- content digest or external revision;
- media, language, and accessibility metadata;
- resolver and availability behavior.

### Governance

- owner role and current assignment reference;
- state records and policy bindings;
- approval and authorization references;
- classification, retention, and handling;
- Candidate Set membership and Baseline Set designation relationships.

### Knowledge and provenance

- authors and contributors;
- source revisions;
- transformations;
- generating run, context, capabilities, and agent where applicable;
- trace and derivation relationships;
- assumptions and known limitations.

Fields that change independently may live in separate governed records. There remains one authoritative source for each field's scope and revision.

## Authority and baselines

Candidate composition, approval, and baseline designation are distinct:

- a Candidate Revision Set assembles exact revisions for review and carries no authority;
- a Baseline Proposal asks an authorized decision process to designate one exact Candidate Revision Set revision for a named scope and purpose;
- an Approval Determination accepts or rejects that exact proposal and set revision;
- a Baseline Set exists only after an approved Baseline Proposal and designates the referenced Candidate Revision Set revision as current authority for its exact scope, release, channel, or interval;
- an approved revision need not become a baseline;
- one revision may appear in several Candidate Revision Sets and may be designated by several Baseline Sets;
- different release lines may designate different revisions simultaneously;
- changing candidate membership creates a new Candidate Revision Set revision; changing an approved designation creates a new Baseline Proposal and Baseline Set revision while preserving prior history.

Authority is resolved from governing source, scope, policy, the exact Approval Determination, effective time, Baseline Set designation, validity, and freshness. Candidate membership, a proposed status, a manually entered authority label, or approval of an individual member alone is insufficient.

## External resources

An External Representation records:

- provider and external object identity;
- resolver and access boundary;
- canonical resource mapping;
- exact external revision, immutable reference, or Snapshot;
- authoritative side for each governed field;
- owner and trust source;
- classification and permitted recipients;
- freshness and synchronization policy;
- unavailable, moved, deleted, and conflict behavior;
- local provenance and trace links.

If the external provider cannot expose immutable revisions, a policy or profile determines whether a Snapshot, digest, export, attestation, or explicit limitation is required.

## Derived views and indexes

A Derived View is authoritative only for its declared calculation, not for the underlying facts. It records:

- view definition and version;
- exact source revisions or resolution record;
- generation time and actor;
- filters, omissions, and security transformations;
- deterministic or evaluative method;
- freshness and invalidation rules.

Indexes and caches are rebuildable unless an approved decision explicitly designates otherwise.

## Supersession, deprecation, validity, and retention

These concepts are independent:

- supersession relates a newer resource or revision to the one it replaces for a declared scope;
- deprecation signals limited continued validity and planned replacement;
- invalidation states that a revision must not support defined current uses;
- freshness describes whether a revision reflects current relevant sources;
- retirement ends new active use of a lineage or revision;
- archival is a storage or navigation disposition;
- retention determines how long history is preserved;
- disposal removes representations only through authorized policy.

Superseded or retired resources may remain required for historical decisions, incidents, audits, migrations, and interpretation.

## Normative requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-RESVER-REQ-001 | Every Governed Resource SHALL have one canonical Resource Lineage ID issued within an Authority Namespace. | Namespace and uniqueness validation |
| GAEP-RESVER-REQ-002 | Every material content or semantic change SHALL create a new immutable Resource Revision. | Revision-mutation scenario |
| GAEP-RESVER-REQ-003 | A Resource Revision SHALL identify its Resource Lineage, Resource Type, schema version, scope, owner role, provenance, and representation resolution. | Revision metadata validation |
| GAEP-RESVER-REQ-004 | A path, branch, commit, URL, issue key, file name, display title, or external object ID SHALL NOT be the sole canonical Resource Lineage identity. | Portability inspection |
| GAEP-RESVER-REQ-005 | Resource Revision ID, Semantic Version, Schema Version, Storage Revision, Content Digest, Candidate Revision Set Version, Baseline Set Version, and External Revision SHALL remain distinct version axes. | Version-model review |
| GAEP-RESVER-REQ-006 | Approval, authorization, conformance, and material evidence SHALL bind to exact Resource Revisions or declared immutable content digests. | Binding validation |
| GAEP-RESVER-REQ-007 | Mutable aliases such as current, stable, active, or latest SHALL resolve to and record an exact revision at material use time. | Alias-resolution scenario |
| GAEP-RESVER-REQ-008 | Writing or merging a representation SHALL NOT by itself approve, baseline, validate, or authorize its Resource Revision. | Repository negative test |
| GAEP-RESVER-REQ-009 | A Candidate Revision Set SHALL have canonical identity, declared purpose, set revision, exact member Resource Revisions or immutable digests, owner role, provenance, and supersession behavior. | Candidate-set validation |
| GAEP-RESVER-REQ-010 | Changing Candidate Revision Set membership SHALL create a new Candidate Revision Set revision and SHALL preserve prior membership history. | Candidate-set revision scenario |
| GAEP-RESVER-REQ-011 | Approved and baselined SHALL remain separate designations. | Approved-not-baselined scenario |
| GAEP-RESVER-REQ-012 | One Resource Revision MAY belong to multiple Candidate Revision Sets and MAY be designated through multiple Baseline Sets, but each designation SHALL identify its independent scope and validity. | Multi-baseline scenario |
| GAEP-RESVER-REQ-013 | Supersession SHALL identify predecessor, successor, effective scope, time, and migration or historical interpretation. | Supersession validation |
| GAEP-RESVER-REQ-014 | Supersession, deprecation, invalidation, freshness, retirement, archival, retention, and disposal SHALL NOT be collapsed into one generic status. | State-dimension inspection |
| GAEP-RESVER-REQ-015 | A Provenance Record SHALL identify origin, attributable contributors or sources, transformations, source revisions, and generating run or import process when applicable. | Provenance inspection |
| GAEP-RESVER-REQ-016 | AI-assisted or AI-generated revisions SHALL identify the Agent Principal or execution reference and the governed context and capability references available to the producing run. | AI provenance scenario |
| GAEP-RESVER-REQ-017 | Derived Resources SHALL identify exact source revisions, derivation method, omissions, and invalidation rules. | Derived-view reconstruction |
| GAEP-RESVER-REQ-018 | A Derived View or index SHALL NOT silently replace the authority of its source resources. | Search-index negative test |
| GAEP-RESVER-REQ-019 | External Representations SHALL identify the authoritative side, exact external revision or declared limitation, resolver, owner, classification, and unavailable-source behavior. | External-reference validation |
| GAEP-RESVER-REQ-020 | An external mutable source used for material approval or evidence SHALL be pinned, snapshotted, digested, attested, or explicitly accepted as a bounded limitation under policy. | Mutable-external-source scenario |
| GAEP-RESVER-REQ-021 | Representation migration MAY preserve a Resource Revision only when governed content and interpretation remain unchanged and the migration is attributable. | Representation-migration test |
| GAEP-RESVER-REQ-022 | Classification SHALL NOT default to public when classification is absent or unresolved. | Missing-classification negative test |
| GAEP-RESVER-REQ-023 | Disposal SHALL require policy-authorized scope and SHALL preserve mandatory lineage, decision, approval, and evidence references or an attributable tombstone when retention requires it. | Disposal and audit scenario |
| GAEP-RESVER-REQ-024 | Resource Type values and metadata extensions SHALL use controlled registries or declared namespaces with compatibility rules. | Registry and extension validation |
| GAEP-RESVER-REQ-025 | A consumer that cannot interpret required schema semantics SHALL return an explicit incompatible or unsupported result rather than ignore them. | Forward-version negative test |
| GAEP-RESVER-REQ-026 | Resource resolution SHALL expose unavailable, ambiguous, conflicting, invalidated, or unauthorized results explicitly. | Resolver negative scenarios |
| GAEP-RESVER-REQ-027 | Candidate Revision Set identity or membership SHALL NOT imply review completion, approval, authorization, conformance, release readiness, or baseline authority. | Candidate-authority negative test |
| GAEP-RESVER-REQ-028 | A Baseline Proposal SHALL bind one exact Candidate Revision Set revision, proposed scope, purpose, effective interval, owner role, required decision authority, and applicable approval requirements. | Baseline-proposal validation |
| GAEP-RESVER-REQ-029 | A Baseline Set SHALL be created only from an approved Baseline Proposal and SHALL reference the exact Candidate Revision Set revision, Approval Determination, scope, purpose, effective interval, and supersession behavior. | Baseline-designation validation |
| GAEP-RESVER-REQ-030 | Approval or rejection of a Baseline Proposal SHALL bind the exact Candidate Revision Set revision and its membership digest; a changed member or membership order SHALL require a new proposal and determination. | Approval-binding mutation test |

## Negative cases

| Case | Required result |
|---|---|
| A Markdown file changes meaning but retains its file name | A new Resource Revision is required. |
| A Git commit contains an artifact | The commit is a Storage Revision, not the artifact's approval or baseline. |
| An approved revision is included in a candidate release set | It remains only a candidate until an approved Baseline Proposal creates the applicable Baseline Set designation. |
| Two supported release lines use different contract revisions | Separate Baseline Sets identify both exact revisions without declaring one globally latest. |
| A Candidate Revision Set is named `approved` or stored under a release path | Its name or path conveys no approval or baseline authority. |
| One member of a Candidate Revision Set changes after review | A new Candidate Revision Set revision and a new or reopened Baseline Proposal are required. |
| A Figma or backlog object has no immutable version | The applicable profile requires a Snapshot, digest, attestation, or explicit bounded limitation before material reliance. |
| A search index returns a superseded revision first | The resolver exposes status and source; the index result does not become current authority. |
| An artifact is archived | Archival changes storage or navigation disposition only; it does not imply retirement, invalidity, or supersession. |
| A binary is copied to a new storage system with identical verified content | The same Resource Revision may gain a new Representation if the migration record proves unchanged interpretation. |
| A schema adds an unknown required field | An older consumer reports incompatibility rather than silently dropping the meaning. |

## Open decisions

| Open decision ID | Question | Consequence |
|---|---|---|
| GAEP-RESVER-OD-001 | What canonical identifier syntax or URI form will provide global namespace portability? | Affects cross-repository resolution and human-readable aliases. |
| GAEP-RESVER-OD-002 | Which canonicalization and digest profiles are required for text, structured data, diagrams, and external snapshots? | Affects integrity and reproducibility claims. |
| GAEP-RESVER-OD-003 | Which Resource Types require Semantic Version rather than revision identity alone? | Affects author burden and compatibility expectations. |
| GAEP-RESVER-OD-004 | How are parallel candidate branches and merge ancestry represented without coupling Core to source control? | Affects concurrent change and baseline composition. |
| GAEP-RESVER-OD-005 | What minimum tombstone information is required after authorized disposal? | Affects privacy minimization and historical trace integrity. |
| GAEP-RESVER-OD-006 | Which external-source limitations are acceptable for each conformance class? | Affects design, backlog, CI, and operational integrations. |

## Cross-contract dependencies

- Scope and workspace bindings come from GAEP-CORE-001.
- Principal, owner role, and provenance attribution use GAEP-CORE-002.
- Revision state, transition, and event semantics use GAEP-CORE-004.
- Classification, retention, and policy obligations use GAEP-CORE-005.
- Approval and authorization bind to revisions under GAEP-CORE-006.
