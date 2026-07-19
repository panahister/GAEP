# Metadata Model

**Governed AI Engineering Platform (GAEP)**  
**Document ID:** GAEP-REP-034  
**Version:** 1.0  
**Status:** Draft  
**Authority:** Common metadata contract

## Purpose

This document defines the common metadata required to govern, discover, validate, trace, and load GAEP artifacts and capabilities.

## Metadata Principles

- metadata expresses governance and semantics, not decoration;
- required fields are minimal but sufficient;
- stable IDs are independent from locations;
- controlled values use registries or schemas;
- human-readable labels accompany machine values;
- metadata changes are versioned and validated;
- derived indexes never replace authoritative metadata;
- sensitive metadata is minimized and protected.

## Common Metadata Envelope

### Identity

| Field | Required | Meaning |
|---|---:|---|
| `id` | Yes | Stable globally unique artifact or capability ID. |
| `type` | Yes | Controlled artifact or capability type. |
| `schema_version` | Yes | Metadata schema version. |
| `title` | Yes | Human-readable title. |
| `summary` | Material artifacts | Concise purpose and content. |
| `initiative` | Initiative artifacts | Engineering Initiative/workspace ID. |
| `implementation_unit` | Unit-scoped artifacts | Client, service, module, workload, data, integration, or deployment-unit ID. |
| `product` | Product-specific artifacts | Product ID when Product is the applicable initiative type. |

### Version and State

| Field | Required | Meaning |
|---|---:|---|
| `version` | Yes | Semantic or controlled artifact version. |
| `status` | Yes | Lifecycle status. |
| `authority` | Yes | Governing, authoritative, provisional, evidence, reference, or working. |
| `effective_from` | When approved | Validity start. |
| `effective_until` | Conditional | Expiration or scheduled replacement. |
| `supersedes` | On replacement | Prior artifact ID/version. |
| `applicability` | Applicability-governed subjects | Required, Recommended, Optional, Not Applicable, Deferred, Conditionally Required, Already Satisfied, Reused, Blocked, or Awaiting Human Decision. |
| `freshness` | Change-sensitive artifacts | Current, Potentially Stale, Stale, Invalidated, or Superseded. |

### Ownership

| Field | Required | Meaning |
|---|---:|---|
| `owner` | Yes | Accountable role or identity. |
| `contributors` | When applicable | Authors or contributors. |
| `reviewers` | In review | Assigned reviewer roles or identities. |
| `approver` | Approved/baseline | Reference to the version-bound approval record; approver identity and exercised role are recorded in that decision. |

### Time

- `created_at`;
- `updated_at`;
- `reviewed_at`;
- `next_review_at`;
- `valid_time` when claims apply to a historical interval.

Use ISO 8601 with timezone. Dates without time are allowed only when precision is intentionally day-level.

### Classification and Access

- `classification`: public, internal, confidential, restricted, or organization-defined;
- `contains_personal_data`;
- `allowed_recipients` or provider constraints;
- `retention_policy`;
- `handling_notes`;
- `license` for reusable or external content.

### Provenance

- `source_type`: human, imported, AI-assisted, AI-generated, system-observed, derived;
- `source_refs`;
- `created_by`;
- `run_id`, `command`, `skills`, `agent`, `adapter`, and `context_pack` when generated;
- `integrity` hash or external revision where useful;
- `transformation` description for derived content.

### Relationships

Each relationship contains:

- `type`;
- `target` ID;
- optional target version;
- status;
- rationale or evidence when needed.

### Governance

- applicable `policies` and `standards`;
- `approval_id`;
- `change_id`;
- `exceptions`;
- `risk_tier`;
- `conditions`;
- `evidence_refs`.

### Discovery

- controlled `domains`;
- `capabilities`;
- `lifecycle_stages`;
- `keywords` only as supplemental free-form tags;
- language and representation format.

## Example Artifact Metadata

```yaml
id: INI-GAEP-DOM-0012
type: domain_model
schema_version: 1.0.0
title: Governance Domain Model
summary: Responsibilities, language, and boundaries of the governance domain.
initiative: INI-GAEP
product: PROD-GAEP
version: 2.0
status: baseline
authority: authoritative
owner: role:product-architecture-owner
created_at: 2026-07-18T10:00:00+03:30
updated_at: 2026-07-18T14:20:00+03:30
classification: internal
provenance:
  source_type: ai-assisted
  run_id: RUN-2026-4811
  context_pack: CTX-GAEP-20260718-0001
relationships:
  - type: realizes
    target: PROD-GAEP-CAP-0004
  - type: governed_by
    target: GAEP-FND-001
approval_id: APR-2026-0104
change_id: CHG-2026-0031
```

## IDs

IDs are opaque enough to remain stable but readable enough to operate. Recommended pattern:

`<SCOPE>-<TYPE>-<SEQUENCE>`

Examples:

- `GAEP-FND-001`;
- `PROD-GAEP-CAP-0004`;
- `CHG-2026-0031`;
- `RUN-2026-4811`;
- `APR-2026-0104`;
- `CTX-GAEP-20260718-0001`.

IDs never encode mutable owner, status, folder, or title.

## Status Registries

Status values are type-specific and controlled. Common artifact values:

`proposed`, `draft`, `challenged`, `revised`, `in_review`, `awaiting_approval`, `approved`, `baseline`, `superseded`, `retired`, `rejected`, `withdrawn`, `invalidated`.

Additional registries remain separate:

- decision: `proposed`, `challenged`, `under_review`, `revised`, `human_selected`, `approved`, `conditionally_approved`, `rejected`, `deferred`, `superseded`, `exception_granted`;
- freshness: `current`, `potentially_stale`, `stale`, `invalidated`, `superseded`;
- test automation: `not_automated`, `partially_automated`, `automated`;
- test execution: `not_executed`, `executed`, `passed`, `failed`, `blocked`;
- Quality Gate: `not_assessed`, `incomplete`, `failed`, `waiver_requested`, `conditionally_passed`, `passed`, `blocked`.

Applicability, approval, freshness, automation, execution, and gate status must not be collapsed into one generic `status` field.

Do not use `done`, `final`, `latest`, or arbitrary synonyms.

## Schema Evolution

- Schemas use semantic versions.
- Additive optional fields are minor changes.
- New required fields or changed meaning are major changes.
- Deprecated fields identify replacement and removal version.
- Migration tooling preserves original provenance.
- Readers declare supported schema versions.
- Unknown required semantics fail validation rather than being ignored.

## Metadata Location

Allowed patterns:

- YAML front matter for human-readable Markdown;
- sidecar metadata for binary or external artifacts;
- manifest for capability packages and compound artifacts;
- structured platform record for runtime events and state.

There must be one authoritative metadata envelope. Duplicated display metadata is derived.

## Validation Levels

### Required for draft

Identity, type, schema, title, version, status, owner, authority, provenance, classification.

### Required for review

Sources, relationships, applicable policies, reviewers, change scope, validation status.

### Required for baseline

Approval, effective date, complete required trace, accepted evidence, supersession correctness, retention, and current integrity.

## Metadata Quality Rules

- IDs are unique and immutable.
- timestamps include timezone.
- controlled fields reject unknown values.
- relationships reference resolvable IDs or declared external resolvers.
- approval references match exact artifact version.
- `baseline` artifacts use authoritative authority class.
- AI provenance includes run and context references when available.
- classification never defaults to public.
- free-form tags cannot replace domain/type fields.

## Derived Indexes

Indexes may include:

- artifact catalog;
- trace graph;
- ownership and review queue;
- stale knowledge report;
- change-impact index;
- command, skill, package, and adapter registries;
- full-text and semantic retrieval indexes.

Derived indexes record source revision and are rebuildable.

## Anti-Patterns

- IDs based on filenames;
- manually synchronized duplicate metadata;
- unvalidated free-form statuses;
- AI-generated provenance omitted for convenience;
- approval field containing a person's name without a decision record;
- `latest` as a version;
- public as an implicit classification default;
- semantic embeddings used without authority metadata.

## Design Implications

This model directly controls:

- [Artifact Model](033_ARTIFACT_MODEL.md)
- [Context Packs](031_CONTEXT_PACKS.md)
- [Naming Conventions](035_NAMING_CONVENTIONS.md)
- [Traceability Model](../03_Product_Engineering/024_TRACEABILITY_MODEL.md)
- [Repository Structure](030_REPOSITORY_STRUCTURE.md)
- [Dynamic Engineering Model](../02_Platform/019_DYNAMIC_ENGINEERING_MODEL.md)
- [Engineering Assurance and Architecture Model](../02_Platform/020_ENGINEERING_ASSURANCE_AND_ARCHITECTURE_MODEL.md)
