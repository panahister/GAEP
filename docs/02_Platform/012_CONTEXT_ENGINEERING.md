# Context Engineering

**Governed AI Engineering Platform (GAEP)**  
**Document ID:** GAEP-PLT-012  
**Version:** 1.0  
**Status:** Draft  
**Authority:** Context-selection and assembly model

## Purpose

This document defines how GAEP transforms repository knowledge into bounded, trustworthy, task-specific context for humans and AI agents.

## Context Is a Governed Engineering Asset

Context is not a large text dump. A context pack is a reproducible selection of knowledge assembled for a declared objective under explicit authority, freshness, security, and size constraints.

High-quality context must be:

- relevant to the objective;
- authoritative for the question being answered;
- current enough for the decision;
- complete enough to expose material constraints;
- small enough to reason over effectively;
- attributable to its sources;
- safe for the selected agent and tool;
- explicit about conflicts and gaps.

## Context Inputs

Context may include:

- constitutional and policy rules;
- command and skill definitions;
- initiative scope, classification, glossary, ownership, and stakeholder knowledge;
- approved upstream artifacts;
- current artifact and change set;
- downstream dependencies and impact candidates;
- decisions, assumptions, risks, and exceptions;
- templates, standards, and architecture patterns;
- test, review, and operational evidence;
- tool capabilities and execution constraints;
- relevant conversation excerpts promoted as provisional evidence.

## Authority Classes

Each context item must be classified:

| Class | Meaning |
|---|---|
| Governing | Applicable Constitution, policy, standard, or approved constraint. |
| Authoritative | Approved current product fact, decision, or baseline. |
| Provisional | Draft or proposed knowledge requiring validation. |
| Evidence | Observation or result supporting a claim or decision. |
| External Reference | Informative source that does not govern GAEP automatically. |
| Generated Working Data | Temporary output not yet reviewed or promoted. |

An agent must not flatten these classes into equally trusted prose.

## Context Assembly Pipeline

### 1. Resolve Objective

Identify:

- command and version;
- requested outcome;
- Engineering Initiative, workspace, and target implementation unit where applicable;
- actor and role;
- target artifact or change;
- required output and evidence.

### 2. Resolve Current State

Load initiative lifecycle, applicability, artifact, architecture, assurance, approval, readiness, change, and run state. Reject or redirect commands invalid for the current state.

### 3. Load Governing Context

Load the Constitution and only the policies, standards, and principles applicable to the objective and risk.

### 4. Load Direct Context

Load the target artifact, its current baseline, active change, declared dependencies, owner, and applicable template or schema.

### 5. Traverse Trace Graph

Select upstream sources that justify the work and downstream artifacts that may be affected. Traversal depth and relationship types are command-specific.

### 6. Retrieve Reusable Knowledge

Find approved templates, patterns, skills, prior decisions, examples, and organizational lessons matching the initiative and implementation-unit context.

### 7. Validate Context

Check:

- source existence and identity;
- status and authority;
- effective version and supersession;
- freshness or review date;
- contradictory facts or decisions;
- required relationships;
- information classification and tool permission.

### 8. Prioritize and Compress

Preserve governing constraints and material details. Summarize only when the summary remains attributable and fit for the decision. Exclude irrelevant material rather than hiding it inside a larger prompt.

### 9. Produce Context Manifest

The manifest records:

- unique context-pack ID and version;
- command, objective, actor, and timestamp;
- source artifact IDs and versions;
- selection reason and authority class;
- omitted required sources and reasons;
- conflict and freshness warnings;
- classification and transmission constraints;
- size or token budget;
- hash or equivalent integrity reference where supported.

### 10. Confirm Sufficiency

The agent declares whether context is sufficient, sufficient with assumptions, or insufficient. Material insufficiency triggers a stop condition or discovery action.

## Context Contract

Every command should declare:

- required context types;
- optional context types;
- trace relationships and depth;
- policy domains;
- freshness thresholds;
- allowed authority classes;
- classification ceiling;
- context size strategy;
- behavior for missing or conflicting sources.

## Context Layers

GAEP recognizes five useful layers:

1. **Platform context** — Constitution, models, schemas, and platform policies.
2. **Organizational context** — standards, reusable assets, regulatory and domain knowledge.
3. **Initiative context** — Initiative Profile, scope, applicability, lifecycle, requirements, architecture, and decisions; Product context is a specialization.
4. **Existing-system context** — repositories, deployed topology, constraints, debt, current contracts, tests, delivery, and operations.
5. **Implementation-unit context** — exact client, service, module, workload, data, integration, or deployment unit and its Technology Profile.
6. **Architecture and security context** — current Architecture Decisions and assets, trust boundaries, Authentication Profile, Authorization Model, threats, and constraints.
7. **Assurance context** — Test Methodology Decision, approved Test Cases, Assurance Profile, Coverage Targets, Test Evidence, and Quality Gates.
8. **Organizational-asset context** — Technology Option Registry entries and exact Boilerplate Binding Record.
9. **Task context** — command, target, change, dependencies, acceptance criteria, and current Implementation Readiness.
10. **Run context** — plan, tool outputs, observations, pending questions, and evidence.

Higher layers should be referenced selectively; they are not copied into every task.

## Implementation-Unit Scoping

Context loading shall select the smallest sufficient authoritative context for the exact initiative, implementation unit, command, role, applicability, and risk. An agent changing a Go service shall not receive unrelated Angular client details unless an interface, shared requirement, architecture decision, security rule, change impact, or cross-unit test makes them relevant. Conversely, scoping must not omit consumer contracts, authorization rules, or shared topology merely because they live outside the target unit.

Before implementation, context shall include current approved requirements, acceptance criteria, architecture, Technology Profile, identity and authorization decisions, approved Test Cases, Assurance Profile, Boilerplate Binding Record, Quality Gates, and readiness authorization. Missing or stale required context triggers the [Stop Conditions](../05_AI_Runtime/045_STOP_CONDITIONS.md), not an AI-generated default.

## Conflict Resolution

When context conflicts:

1. compare authority, scope, effective version, and date;
2. follow the document precedence rules;
3. detect whether one source supersedes another;
4. preserve both claims in the context manifest;
5. avoid resolving a material ambiguity without authority;
6. create a decision or clarification request when necessary.

The agent must never silently choose the most convenient source.

## Freshness

Freshness is contextual. The Constitution may remain stable for years; operational constraints may expire rapidly.

Artifacts may declare:

- reviewed date;
- review interval;
- effective date;
- expiration date;
- freshness owner;
- invalidation events.

Stale context may still be included as history but must not be presented as current authority.

## Context Budgeting

Context selection should use this priority:

1. mandatory governance and safety constraints;
2. current objective, state, and acceptance contract;
3. target artifact and direct authoritative dependencies;
4. material upstream and downstream trace items;
5. relevant decisions, risks, and evidence;
6. reusable guidance and examples;
7. background reference.

When budget is exceeded, reduce examples and background first. Never truncate a governing constraint without making the omission visible.

## Privacy and Security

- Context packs inherit the highest classification of included items.
- Sensitive data requires purpose and recipient checks.
- Secrets are referenced through secure mechanisms, never embedded.
- External models receive only content permitted for that provider and task.
- Personal, regulated, or confidential content is minimized or redacted where possible.
- Context manifests record external transmission without storing prohibited content.

## Context Quality Measures

Measure:

- precision: included items were relevant;
- coverage: material required context was present;
- authority: sources had appropriate status;
- freshness: sources met time requirements;
- conflict visibility: contradictions were exposed;
- reproducibility: the pack can be reconstructed;
- efficiency: context size was proportionate;
- outcome quality: context improved artifact or decision quality.

## Anti-Patterns

- loading the entire repository by default;
- copying previous chat as unquestioned truth;
- mixing drafts and baselines without labels;
- embedding static context inside prompts that becomes stale;
- using similarity search without authority filtering;
- summarizing away exceptions or constraints;
- exposing sensitive content to an unapproved model;
- treating context-window size as a quality metric.

## Design Implications

This model directly controls:

- [Context Packs](../04_Repository/031_CONTEXT_PACKS.md)
- [Knowledge Model](../04_Repository/032_KNOWLEDGE_MODEL.md)
- [Command Model](014_COMMAND_MODEL.md)
- [Agent Model](016_AGENT_MODEL.md)
- [Runtime Model](017_RUNTIME_MODEL.md)
- [Context Loading](../05_AI_Runtime/043_CONTEXT_LOADING.md)
- [Dynamic Engineering Model](019_DYNAMIC_ENGINEERING_MODEL.md)
- [Engineering Assurance and Architecture Model](020_ENGINEERING_ASSURANCE_AND_ARCHITECTURE_MODEL.md)
