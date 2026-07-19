---
id: GAEP-SELF-001
title: GAEP-on-GAEP Initiative Profile
document_type: workspace-record
schema_version: 1.0
version: 0.1.0
status: proposed
owner_role: GAEP Product Owner
scope: GAEP Next pre-implementation restructuring initiative
normative_level: mixed
classification: internal
provenance: GAEP pre-implementation restructuring
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CST-003
  - GAEP-CORE-001
informative_references:
  - ../000_READ_FIRST.md
supersedes: []
---

# GAEP-on-GAEP Initiative Profile

## Candidate authority namespace and scope

The candidate namespace is `urn:gaep:candidate`. It is locally unique for paper validation but is not an approved organization namespace.

| Entity | Candidate canonical ID | Current condition |
|---|---|---|
| Authority Namespace | `urn:gaep:candidate` | provisional local namespace; issuing authority is unassigned |
| Organization Scope | `urn:gaep:candidate:organization:governing-owner` | unresolved; no accountable governing organization or authority has been assigned |
| Portfolio | `urn:gaep:candidate:portfolio:gaep` | proposed; authority remains dependent on the unresolved Organization Scope |
| Engineering Initiative | `urn:gaep:candidate:initiative:vnext-preimplementation` | active documentation work; not an approved Initiative baseline |
| Change | `urn:gaep:candidate:change:vnext-candidate-baseline` | working Change; no Approval Determination or Authorization Grant for baseline designation |
| Workspace | `urn:gaep:candidate:workspace:repository-vnext` | working repository representation |

The unresolved Organization Scope is an explicit blocker under GAEP-SCOPE-REQ-003 and GAEP-SCOPE-REQ-014. The placeholder ID does not manufacture an accountable organization.

## Target Managed Assets

| Managed Asset ID | Asset type | Included in current Change |
|---|---|---|
| `urn:gaep:candidate:asset:product-strategy-and-constitution` | governed specification asset | yes |
| `urn:gaep:candidate:asset:core-and-profile-specification` | governed specification asset | yes |
| `urn:gaep:candidate:asset:workspace-realization-and-adapter-contracts` | governed specification asset | yes |
| `urn:gaep:candidate:asset:runtime-product` | possible future software Product asset | no; implementation remains out of scope |

The Engineering Initiative targets the first three Managed Assets through one proposed Change. The future Runtime Product is represented separately so paper specification work cannot be mistaken for implementation work.

## Scope and relationship bindings

| Core relationship | Candidate binding | Current result |
|---|---|---|
| Authority Namespace issues identifiers for governed entities | `urn:gaep:candidate` issues the candidate IDs in this record | unresolved because issuing authority is unassigned |
| Organization Scope contains Portfolio | governing-owner Organization Scope contains the GAEP Portfolio | unresolved because the Organization Scope is a placeholder |
| Organization Scope governs Managed Asset | governing-owner Organization Scope is the candidate governor of each listed Managed Asset | unresolved; no ownership or authority is established by this record |
| Engineering Initiative governed by Organization Scope | vNext pre-implementation Initiative binds to governing-owner Organization Scope | unresolved and therefore blocking |
| Engineering Initiative targets Managed Asset | vNext pre-implementation Initiative targets the first three listed Managed Assets | candidate working binding |
| Change governed by Engineering Initiative | vNext candidate-baseline Change binds to the vNext pre-implementation Initiative | candidate working binding |
| Change affects Managed Asset | the Change affects the first three listed Managed Assets; the Runtime Product is explicitly excluded | candidate working binding |
| Workspace represents Scope Reference | repository-vNext Workspace represents the Organization Scope, Portfolio, Initiative, Change, and included Managed Assets by the IDs above | candidate working representation; file containment grants no authority |

No Work Item or Implementation Unit is declared in this pre-implementation documentation scope. Absence is explicit; the Initiative, Change, Managed Assets, and Workspace are not substituted for those Core entities.

## Initiative binding

| Field | Candidate value |
|---|---|
| Change intent | Replace the overlapping Draft corpus with a smaller, coherent, reviewable candidate baseline before authorizing implementation |
| Initiative type | Product-definition and specification redesign |
| Current phase | Pre-implementation discovery and paper specification |
| Legacy observed baseline | Git commit `29312cf841c9c462431cfc64ea38a49eb3e9a0e5`; legacy documents remain Draft |
| Candidate revision | Uncommitted working tree; no immutable Candidate Revision Set, Baseline Proposal, or Baseline Set exists |
| Current permission boundary | Documentation creation, documentation correction, local validation, and read-only research requested by the repository owner |
| Explicitly unauthorized | Product/runtime code, external integration, procurement, release, deployment, production data, organizational mandate, baseline designation, or conformance claims |
| GAEP Investment Sponsor | Unassigned; requires accountable identity and Authority Assignment |
| GAEP Product Owner | Unassigned; requires accountable identity and Authority Assignment |
| GAEP Specification Steward | Unassigned; acting authorship and repository access are not an Authority Assignment |
| Decision horizon | Pilot Readiness Gate (`GAEP-RM-005`), Candidate Baseline Approval Gate (`GAEP-RM-006`), and later Implementation Readiness Gate (`GAEP-RM-003`) |

## Problem statement

The current GAEP corpus expresses a strong governed-engineering vision but combines product strategy, universal semantics, lifecycle profiles, repository realization, AI runtime behavior, and vendor working models. All documents are Draft, several controlled concepts conflict, and the trust and product-validation foundations are incomplete. Building against that state would hard-code unapproved assumptions.

## Intended outcome

Produce a non-destructive candidate baseline that:

- states a falsifiable product hypothesis;
- separates Core, Profiles, Realizations, Adapters, and initiative workspaces;
- gives every Core concept one semantic owner;
- defines version-bound identity, evidence, decisions, approvals, and effects;
- establishes security, privacy, AI, assurance, and operational foundations;
- can be tested manually across low- and high-risk scenarios;
- defines measurable value and governance-burden gates;
- can receive explicit version-bound approval before implementation.

## Non-goals

- selecting implementation technologies;
- automating the complete lifecycle;
- proving commercial demand without external evidence;
- replacing existing authoritative enterprise systems;
- declaring the candidate specification approved;
- building a knowledge graph, agent marketplace, or enterprise control plane.

## Success conditions

1. Product identity, first segment, first workflow, ownership, distribution, and non-goals are decided.
2. The Core ontology is coherent and profile-independent.
3. Normative dependencies are acyclic and requirements are addressable.
4. Trust and assurance models cover the GAEP platform itself.
5. Manual Product and non-Product pilots meet value and burden thresholds.
6. The candidate corpus passes metadata, link, registry, scenario, and review checks.
7. Exact candidate versions receive accountable approval.

## Stop or pivot conditions

- teams cannot understand or use the first workflow without continuous expert facilitation;
- the workflow duplicates existing work rather than replacing it;
- reviewer cost or decision latency exceeds the approved burden budget;
- external authority cannot be represented without unmaintainable duplication;
- a smaller combination of existing tools and conventions achieves the outcome more safely;
- the Core cannot support both a genuinely lightweight path and a rigorous high-risk path;
- trust controls require centralization or data collection inconsistent with portability and workforce trust.

## Assumptions requiring evidence

- fragmented context and weak decision lineage are frequent enough to justify intervention;
- repository-visible governance can improve continuity without forcing all content into Git;
- users will repeat a governed-change workflow voluntarily when it replaces re-explanation and review friction;
- profiles can preserve semantic coherence while reducing ceremony;
- human approval can remain meaningful rather than becoming a bottleneck or rubber stamp.
