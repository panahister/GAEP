---
id: GAEP-REAL-001
title: Repository Realization
document_type: realization
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Workspace Steward
scope: Repository-visible GAEP workspaces
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
  - GAEP-CORE-009
  - GAEP-CORE-012
informative_references:
  - ../../04_Repository/030_REPOSITORY_STRUCTURE.md
supersedes: []
---

# Repository Realization

## Purpose

This document defines how a repository may represent GAEP-governed resources without claiming that every authoritative artifact must live in Git. It is a realization of the Core, not a replacement for it.

## Authority topology

For each governed resource, the workspace records one of these authority arrangements:

- **repository-authoritative:** the exact governed content and revision are maintained locally;
- **external-authoritative:** an external system owns the content and the repository stores a resolvable, versioned reference plus required governance metadata;
- **split-authoritative:** explicitly named fields or representations have different authorities;
- **derived-cache:** local content is a disposable or regenerable projection of an authoritative source;
- **evidence-snapshot:** an immutable capture is retained to support a decision or audit, without changing the source authority.

Authority is declared per resource and representation. A general statement such as `the repository is the source of truth` is insufficient.

## Proposed workspace shape

```text
gaep/
  workspace.yaml
  bindings/
    organization.yaml
    profiles.yaml
    authorities.yaml
  assets/
    <managed-asset-id>/
  initiatives/
    <initiative-id>/
  changes/
    <change-id>/
  resources/
    index.yaml
  decisions/
  approvals/
  evidence/
  context-packs/
  runs/
  exceptions/
  registries/
```

This shape is informative until the Core identifiers, resource model, and profile-resolution rules are approved. A realization may use another layout if it preserves the same contracts and exports a portable representation.

## External reference record

An external-authoritative reference contains:

- GAEP resource and representation IDs;
- authority system and namespace;
- stable external identifier;
- exact revision, digest, or snapshot time when available;
- canonical locator and resolver method;
- access and classification requirements;
- owning organization or role;
- retrieval and verification time;
- declared behavior when unavailable;
- synchronization direction and conflict policy;
- retained evidence snapshot when required by risk or policy.

## Synchronization outcomes

Synchronization does not return a boolean alone. The outcome is one of:

- synchronized;
- no-change;
- source-unavailable;
- authorization-failed;
- revision-unknown;
- conflict-detected;
- mapping-loss;
- invalid-source-data;
- partially-synchronized.

The outcome records source and target revisions, mappings used, losses, unresolved conflicts, actor, time, and evidence.

## Requirements

| Requirement ID | Requirement | Verification |
|---|---|---|
| GAEP-REPO-REQ-001 | Every governed representation SHALL declare its authority arrangement and authoritative side. | Workspace inspection |
| GAEP-REPO-REQ-002 | An external reference SHALL identify a stable subject and exact revision or SHALL explicitly record that revision precision is unavailable. | Reference scenario review |
| GAEP-REPO-REQ-003 | A repository realization SHALL NOT silently duplicate externally authoritative content as a second writable truth. | Authority-topology review |
| GAEP-REPO-REQ-004 | Synchronization SHALL preserve source and target revisions, mapping version, outcome, losses, conflicts, actor, and time. | Sync-record review |
| GAEP-REPO-REQ-005 | Inaccessible, deleted, or changed external content SHALL produce an explicit freshness or validity consequence. | External-loss scenario |
| GAEP-REPO-REQ-006 | A workspace SHALL be exportable without requiring one AI vendor or proprietary agent transcript to interpret its authoritative governance state. | Portability demonstration |
| GAEP-REPO-REQ-007 | Secrets, unnecessary personal data, and unrestricted model context SHALL NOT be committed merely to make a workspace self-contained. | Security/privacy review |
| GAEP-REPO-REQ-008 | Concurrent changes and multiple release lines SHALL use named, revision-pinned baselines rather than a single mutable `current` artifact state. | Concurrent-change scenario |
| GAEP-REPO-REQ-009 | Repository permissions MAY contribute enforcement but SHALL NOT substitute for GAEP authority, policy, approval, and accountable-human records. | Authorization review |
| GAEP-REPO-REQ-010 | Broken links, unresolved identifiers, invalid metadata, and dependency cycles in the normative baseline SHALL block a conformance claim. | Candidate-baseline validation |

## Offline and degraded operation

The workspace may retain bounded snapshots for offline review when classification and source terms permit. The snapshot records its source revision and capture time. Offline work cannot silently convert stale or unverified content into current authority. Reconciliation after reconnection produces an explicit result and may invalidate dependent decisions.

## Open decisions

- Canonical serialization formats remain unselected.
- Digest algorithms and signing profiles remain unselected.
- The minimum portable export package remains to be specified after paper scenarios.
- Organization-wide versus repository-local namespace allocation requires validation against multi-repository pilots.
