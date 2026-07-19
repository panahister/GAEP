# Context Packs

**Governed AI Engineering Platform (GAEP)**  
**Document ID:** GAEP-REP-031  
**Version:** 1.0  
**Status:** Draft  
**Authority:** Context-pack artifact and manifest specification

## Purpose

This document defines context packs as reproducible, governed inputs to commands, skills, agents, and human reviews.

## Context Pack Definition

A context pack is a versioned manifest plus a bounded collection of referenced or embedded context items assembled for a declared objective.

The manifest is authoritative for what was selected and why. The pack does not make its sources more authoritative than they already are.

## Context Pack Types

### Foundation Pack

Contains the minimum applicable Constitution, principles, glossary, organizational policies, and lifecycle profile.

### Initiative Pack

Contains the Initiative Profile, Product context where applicable, scope, glossary, Applicability Matrix, current lifecycle and readiness state, architecture summary, and active constraints.

### Artifact Pack

Contains target artifact, schema, template, baseline, sources, owner, review criteria, and direct trace neighborhood.

### Change Pack

Contains change request, impacted baselines, decision history, impact graph, approved scope, and validation plan.

### Review Pack

Contains exact subject version, applicable criteria, upstream intent, known risks, prior findings, and required disposition.

### Execution Pack

Contains command, skills, tool constraints, target change scope, tests, implementation rules, and run-specific state.

### Release Pack

Contains approved changes, release manifest, evidence, migration, rollback, known risk, and operational readiness.

Pack types are composable profiles over one common manifest.

## Manifest Fields

### Identity

- context-pack ID;
- schema and pack version;
- pack type and status;
- created time and creator/run;
- Engineering Initiative, implementation-unit, Product where applicable, and organizational scope.

### Objective

- command and version;
- requested outcome;
- target artifact, change, gate, or release;
- intended agent, tool, human role, or review audience.

### State Snapshot

- initiative lifecycle profile and applicability state;
- target artifact state and version;
- active change and approval state;
- architecture and assurance freshness, Quality Gate, and Implementation Readiness state where relevant;
- state snapshot time and version.

### Source Entries

Each entry includes:

- artifact or resource ID;
- exact version or resolution rule;
- location or resolver;
- authority class;
- selection reason;
- relationship to target;
- freshness status;
- classification;
- integrity reference;
- representation and optional summary.

### Warnings and Gaps

- missing required context;
- stale sources;
- conflicts;
- unresolved external resources;
- assumptions;
- intentionally omitted content and reason;
- budget-related compression or truncation.

### Security and Transmission

- effective classification;
- permitted recipients/providers;
- redaction applied;
- retention rule;
- external transmission record or prohibition.

## Example Manifest

```yaml
id: CTX-GAEP-20260718-0001
schema_version: 1.0.0
pack_version: 1
type: artifact
status: assembled
objective:
  command: review-architecture@1.0.0
  target: GAEP-ARCH-0042@2.1
initiative: INI-GAEP
state:
  lifecycle: solution_architecture
  artifact: in_review
  change: CHG-2026-0031
sources:
  - id: GAEP-FND-001
    version: 1.0
    authority: governing
    reason: constitutional constraints
  - id: PROD-GAEP-DOM-0012
    version: 3.0
    authority: authoritative
    relationship: realized_by
    reason: upstream domain boundary
warnings:
  - type: freshness
    source: PROD-GAEP-NFR-0008
    message: performance target review is overdue
classification: internal
```

## Resolution Modes

- **Pinned:** exact version; required for approvals, baselines, and reproducibility.
- **Current Baseline:** resolves authoritative version at assembly time and records it.
- **Active Change:** resolves version in the identified change set.
- **Latest Evidence:** allowed only with freshness and provenance checks.
- **Query:** semantic retrieval with recorded query, filters, and selected results.

Runtime execution always materializes actual resolved versions into the run record.

## Assembly Rules

1. Begin from command context contract.
2. Load mandatory governing sources.
3. Resolve state and exact target version.
4. Load direct upstream sources and applicable standards.
5. Traverse only required relationship types and depth.
6. Add affected downstream items when the objective involves change or review.
7. retrieve reusable knowledge filtered by authority and applicability.

## Dynamic Engineering Context Facets

Context packs may include enterprise constraints and Technology Option Registry entries; existing-system repositories and deployed topology; Initiative Profile and Applicability Matrix; exact client, service, module, data, integration, or deployment-unit context; Architecture Decisions and Assets; HLD and LLD; Authentication Profile and Authorization Model; Test Methodology Decision; approved Test Cases; Assurance Profile; Coverage Targets and current Test Evidence; Boilerplate Binding Record; Quality Gates; approvals; and current readiness.

Assembly shall remain scoped. A Go service execution pack shall not include unrelated Angular implementation details unless a shared contract, requirement, security rule, topology, assurance workflow, or change impact makes them relevant. The pack shall still include cross-unit dependencies needed to prevent local changes from violating consumers, authorization, or architecture.

An implementation pack must identify exact approved source versions and disclose missing, conflicting, Potentially Stale, Stale, or invalidated content. A Go service agent must not receive unrelated Angular implementation context unless a governed dependency makes it relevant. Conversation history may be included only as provisional context; it cannot replace repository-visible decisions. See [019](../02_Platform/019_DYNAMIC_ENGINEERING_MODEL.md) and [020](../02_Platform/020_ENGINEERING_ASSURANCE_AND_ARCHITECTURE_MODEL.md).
8. validate classification, access, freshness, and conflict.
9. prioritize and compress within budget.
10. emit manifest, warnings, and sufficiency status.

## Embedded Versus Referenced Content

Reference content when the executor can resolve it securely and immutably. Embed when:

- the external source may change or disappear;
- a fixed review snapshot is required;
- the adapter needs a self-contained payload;
- policy permits duplication.

Embedded content retains source ID, version, provenance, license or usage constraints, and integrity hash.

## Summaries

Summaries are derived context items. They must include:

- source set and versions;
- generating run or human author;
- purpose and scope;
- omitted-detail warning;
- validation status;
- invalidation rule when sources change.

An unvalidated summary cannot replace a governing source for a high-impact decision.

## Context Pack Lifecycle

`requested → assembling → assembled → validated → consumed → retained → expired`

Alternative states: `blocked`, `invalidated`, `discarded`.

Packs used for material decisions or changes are retained according to evidence policy. Routine read-only packs may be ephemeral while retaining a minimal manifest.

## Caching

Cached context is safe only when cache keys include:

- command and contract version;
- target and state version;
- source versions;
- policy and profile version;
- classification and actor scope;
- relevant adapter constraints.

Invalidation events include baseline change, policy change, approval revocation, source invalidation, classification change, or expired freshness.

## Validation

Validators check:

- schema and required fields;
- resolvable sources and integrity;
- authority and state compatibility;
- no prohibited classification mixing or transmission;
- no expired mandatory source;
- conflicts and gaps are visible;
- budget and compression are disclosed;
- pack can be reconstructed where required.

## Context Pack Quality Metrics

- required-source coverage;
- irrelevant-source rate;
- stale or conflicting-source rate;
- average size by command;
- reconstruction success;
- downstream correction caused by missing context;
- sensitive-content overexposure;
- context assembly latency and cost.

## Anti-Patterns

- static mega-prompts called context packs;
- copied files without version or source;
- unfiltered semantic search results;
- hiding source conflicts in a summary;
- packs shared across actors with different permissions;
- cache reuse after baseline change;
- context packs that include secrets;
- treating pack assembly as proof of sufficient knowledge.

## Design Implications

This specification directly implements:

- [Context Engineering](../02_Platform/012_CONTEXT_ENGINEERING.md)
- [Context Loading](../05_AI_Runtime/043_CONTEXT_LOADING.md)
- [Metadata Model](034_METADATA_MODEL.md)
- [Knowledge Model](032_KNOWLEDGE_MODEL.md)
- [Runtime Model](../02_Platform/017_RUNTIME_MODEL.md)
- [Dynamic Engineering Model](../02_Platform/019_DYNAMIC_ENGINEERING_MODEL.md)
- [Engineering Assurance and Architecture Model](../02_Platform/020_ENGINEERING_ASSURANCE_AND_ARCHITECTURE_MODEL.md)
