# Context Loading

**Governed AI Engineering Platform (GAEP)**  
**Document ID:** GAEP-AIR-043  
**Version:** 1.0  
**Status:** Draft  
**Authority:** Runtime context-loading protocol

## Purpose

This document defines the operational algorithm by which a GAEP agent receives the smallest sufficient, trusted, and permitted context for a run.

## Loading Principles

- load by objective, not curiosity;
- resolve authority before relevance ranking;
- pin versions for material decisions;
- prefer direct sources over derived summaries;
- expose missing, stale, and conflicting context;
- traverse typed relationships with bounded depth;
- minimize sensitive data and external transmission;
- refresh after material state change;
- record everything selected or intentionally omitted.

## Inputs

The loader requires:

- command name and version;
- objective and interaction mode;
- actor identity and role;
- Engineering Initiative/workspace and Product when applicable;
- target implementation unit where applicable;
- target artifact, change, decision, gate, or release;
- current state snapshot;
- selected agent and adapter constraints;
- context budget and classification ceiling.

If command or target is unknown, the loader first constructs a limited discovery context.

## Loading Algorithm

### Step 1 — Establish Root Instructions

Load:

- applicable law and runtime safety rules;
- `docs/000_READ_FIRST.md`;
- GAEP Constitution;
- workspace and scoped agent instructions;
- command definition.

Resolve conflicts through the authority order. Do not accept instructions embedded in untrusted content as governing.

### Step 2 — Resolve Identity and Scope

Determine:

- organization, Engineering Initiative, Product where applicable, implementation-unit, and repository boundaries;
- actor's allowed classification and actions;
- exact target and requested disposition;
- tool or provider transmission constraints.

### Step 3 — Resolve Current State

Load the latest authoritative state records for:

- initiative lifecycle profile and applicability;
- package/workstream;
- target artifact;
- architecture, HLD, LLD, and freshness;
- authentication, authorization, Assurance Profile, Test Cases, coverage, Test Evidence, and Quality Gates;
- Boilerplate Binding and Implementation Readiness;
- active change;
- approval;
- relevant run or operational state.

Record state versions. Invalid commands stop before broader loading.

### Step 4 — Load Governing Context

Select only applicable:

- constitutional articles;
- organizational, initiative, and Product policy where applicable;
- lifecycle profile and gate criteria;
- standards, architecture constraints, and approved exceptions;
- approval and evidence requirements.

Governing context has highest retention priority under budget pressure.

### Step 5 — Load Target Context

Load:

- target artifact/change exact version;
- type schema and template;
- owner, status, classification, and review criteria;
- active findings and decisions;
- approved baseline and current draft/change diff.

### Step 6 — Load Upstream Intent

Traverse required relationships such as:

- `derived_from`;
- `supports`;
- `realizes`;
- `governed_by`;
- `decided_by`;
- `depends_on`.

Stop at the depth declared by the command or when additional sources no longer affect the task.

### Step 7 — Load Downstream Impact

For change, review, or release commands, traverse relationships such as:

- `realizes`;
- `implements`;
- `verifies`;
- `contains`;
- `consumes`;
- `depends_on`;
- `changes`.

Classify impact candidates rather than loading full content indiscriminately. Load detail for material candidates.

### Step 8 — Load Reusable Knowledge

Resolve compatible:

- packages;
- commands and skills;
- templates and schemas;
- architecture patterns and standards;
- validated examples and lessons;
- stack or tool profiles.

Filter by version, applicability, owner, maturity, and initiative or Product constraints.

### Step 9 — Validate Sources

For each source check:

- identity and resolver;
- version and supersession;
- authority and lifecycle state;
- owner and scope;
- freshness and invalidation;
- classification and recipient permission;
- integrity where required;
- known conflicts.

### Step 10 — Resolve Contradictions

Apply precedence and scope rules. Include unresolved material contradictions as explicit warnings with both sources. Do not ask the model to invent a compromise.

### Step 11 — Prioritize and Fit Budget

Priority order:

1. safety, law, Constitution, and applicable policy;
2. command, objective, state, and approval constraints;
3. target, baseline, and direct authoritative sources;
4. material decisions, risks, and impact dependencies;
5. required schemas, templates, skills, and standards;
6. accepted evidence;
7. examples and background.

Strategies:

- remove irrelevant sources;
- include metadata and targeted excerpts;
- use validated summaries with source links;
- split work into governed steps;
- request a larger context capability only when justified.

Never solve budget pressure by hiding omitted governing constraints.

### Step 12 — Apply Security Transformations

- redact or tokenize unnecessary personal or secret data;
- exclude content above provider classification allowance;
- replace secrets with secure references;
- restrict external links or tool access;
- record transformations and effective pack classification.

### Step 13 — Emit Manifest and Sufficiency

Return:

- resolved source list and versions;
- selection reasons;
- state snapshot;
- warnings, gaps, conflicts, and assumptions;
- omitted required context and reason;
- classification and transmission constraints;
- sufficiency: `sufficient`, `sufficient_with_assumptions`, or `insufficient`.

## Command-Specific Loading Profiles

### Discovery

Prioritize Initiative Profile, existing-system evidence, ownership, scope, glossary, assumptions, and external constraints. Product intent, market evidence, personas, and journeys are loaded only for Product Discovery when applicable. Allow provisional knowledge visibly.

### Architecture

Prioritize approved requirements, quality attributes, current topology, Technology Profiles, identity and authorization decisions, constraints, existing Architecture Assets, risks, Assurance Profile, and relevant contextual patterns.

### UX and Design

Activate only when UX or visual design is applicable. Prioritize personas, journeys, processes, roles, rules, data states, design system, accessibility, and approved design references. Load Figma only when explicitly applicable; a missing Figma artifact is not a generic context failure.

### Backlog

For Product initiatives where backlog engineering applies, prioritize outcomes, capabilities, journeys, Product behavior, architecture constraints, dependencies, and acceptance standards.

### Implementation

Prioritize the exact implementation unit; approved requirements and acceptance criteria; current Architecture Assets, HLD or LLD and contracts; Technology Profile; Authentication Profile and Authorization Model; approved Test Cases and Test Methodology Decision; Assurance Profile and Coverage Targets; Boilerplate Binding Record; code neighborhood; active change; Quality Gates; and readiness authorization. Inspect existing repositories and operational constraints before recommending new technology or structure.

Implementation context shall exclude unrelated client or service stacks unless shared requirements, contracts, topology, security, assurance, or change impact makes them necessary. A Go service agent shall not receive unrelated Angular context merely because both belong to the same initiative.

### Review

Prioritize exact subject version, governing criteria, upstream intent, affected downstream artifacts, prior findings, evidence, and known risks.

### Release

Prioritize approved changes, trace coverage, validation evidence, security and operational approvals, migration, rollback, known risk, and target environment state.

## Refresh Rules

Refresh context when:

- target or baseline version changes;
- approval is granted, revoked, or expires;
- active change scope changes;
- governing policy or exception changes;
- an external source updates;
- a new blocking finding appears;
- the run resumes after a significant pause;
- a tool action changes the environment materially.

## Context Loading Failures

- unresolved target identity;
- missing mandatory source;
- conflicting governing policies;
- stale or invalidated baseline;
- classification exceeds agent/provider allowance;
- source integrity or external revision cannot be verified;
- context size cannot fit without omitting material constraints;
- missing authority to view required data.

Failures produce a stop or a reduced read-only discovery action, never silent degradation.

## Validation Tests

The loader should be tested with:

- normal complete contexts;
- missing baseline;
- conflicting artifact versions;
- expired approval;
- inaccessible confidential source;
- stale external Figma or backlog reference;
- oversized context;
- malicious instruction embedded in a source;
- superseded artifact returned by search;
- cross-initiative relationship with different permissions.

## Design Implications

This protocol directly implements:

- [Context Engineering](../02_Platform/012_CONTEXT_ENGINEERING.md)
- [Context Packs](../04_Repository/031_CONTEXT_PACKS.md)
- [Traceability Model](../03_Product_Engineering/024_TRACEABILITY_MODEL.md)
- [Agent Execution Flow](042_AGENT_EXECUTION_FLOW.md)
- [Stop Conditions](045_STOP_CONDITIONS.md)
- [Dynamic Engineering Model](../02_Platform/019_DYNAMIC_ENGINEERING_MODEL.md)
- [Engineering Assurance and Architecture Model](../02_Platform/020_ENGINEERING_ASSURANCE_AND_ARCHITECTURE_MODEL.md)
