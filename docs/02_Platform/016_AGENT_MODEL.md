# Agent Model

**Governed AI Engineering Platform (GAEP)**  
**Document ID:** GAEP-PLT-016  
**Version:** 1.0  
**Status:** Draft  
**Authority:** Vendor-neutral agent specification

## Purpose

This document defines agents as governed reasoning and execution participants in GAEP. It specifies roles, authority boundaries, context, memory, collaboration, and evidence expectations independent of a particular AI vendor.

## Agent Definition

An agent is a runtime participant that can interpret an objective, reason over provided context, select or apply skills, use permitted tools, produce outputs, and report uncertainty within a bounded role.

An agent is not:

- the repository source of truth;
- an approval authority by default;
- a permanent owner of initiative or organizational knowledge;
- an excuse to hide a long prompt;
- inherently autonomous;
- trusted because of model confidence.

## Agent Identity

Every agent run identifies:

- agent role and instance ID;
- provider, model, version, or execution engine where known;
- configuration and adapter version;
- assigned command and skills;
- granted tools and authority;
- context-pack ID;
- run and parent-run IDs;
- accountable human or invoking system.

This enables reproducibility and audit without treating a model name as the architecture.

## Agent Roles

### Discovery Agent

Structures ambiguity, asks questions, identifies stakeholders, scope, vocabulary, assumptions, and missing evidence.

### Business Architecture Agent

Assists with capabilities, value streams, business contexts, outcomes, and organizational relationships.

### Product Architecture Agent

Assists with product boundaries, domains, modules, actors, roles, authorization, and quality concerns.

### Process/Data/Event Agent

Assists with workflows, rules, conceptual data, events, integrations, and DDD distinctions such as domain versus integration events.

### Experience Agent

Assists with personas, journeys, information architecture, UX requirements, design-system consistency, accessibility, and design review.

### Backlog Agent

Assists with epics, features, stories, acceptance criteria, dependencies, and trace mapping.

### Engineering Agent

Assists with solution design, implementation, tests, documentation, and controlled code changes after readiness gates.

### Review Agent

Independently evaluates an artifact or change against explicit criteria. It must not be represented as a human approval.

### Governance Agent

Evaluates policies, required evidence, state, risk, and approval paths. It recommends or enforces deterministic rules but does not invent authority.

### Coordinator Agent

Decomposes objectives, routes work, combines evidence, and manages dependencies. It should not replace specialized domain judgment.

Roles are capability profiles, not necessarily separate deployed agents.

## Adaptive Engineering Responsibility Profiles

GAEP may compose the following responsibilities into one or more governed agents; it shall not require one physical agent per role:

- **Intake Agent** — frames intent, ownership, scope, urgency, and missing intake evidence.
- **Applicability Agent** — proposes phase, artifact, method, test, and approval applicability with rationale.
- **Requirement Challenger** — challenges ambiguity, acceptance conditions, contradictions, and unsupported assumptions.
- **Architecture Agent and Architecture Reviewer** — resolve and independently challenge topology, HLD, LLD, quality attributes, trade-offs, and living-architecture impact.
- **Topology Agent** — models clients, services, modules, data, integrations, and deployment units without selecting fashionable boundaries.
- **Security Agent and Identity and Access Agent** — challenge threats, trust, authentication, authorization, tenancy, secrets, and enforcement boundaries.
- **Technology Advisor** — evaluates per-unit technologies, registry status, compatibility, support, cost, and exceptions.
- **Test Strategy Agent, Test-Case Agent, and Assurance Reviewer** — resolve methodology, generate and challenge Test Cases, assess multidimensional coverage, evidence, and Quality Gates.
- **Boilerplate Resolver** — locates and validates approved Organizational Boilerplates and records bindings without inventing official replacements.
- **Governance Agent and Readiness Agent** — evaluate policy, approvals, exceptions, current state, stop conditions, and implementation readiness.
- **Implementation Agent** — implements only approved scope against current architecture, tests, technology, boilerplate, identity, authorization, and assurance state.
- **Change Impact Agent** — traverses affected decisions and assets, marks stale state, and proposes regeneration and reapproval.

Every role shall challenge from within its responsibility, preserve provenance, disclose uncertainty, and route consequential decisions to the accountable human role. Composing roles does not combine approval authority; an agent may not approve its own or another AI's material output. Detailed responsibilities are governed by [019](019_DYNAMIC_ENGINEERING_MODEL.md) and [020](020_ENGINEERING_ASSURANCE_AND_ARCHITECTURE_MODEL.md).

## Authority Model

Agent authority is the intersection of:

- invoking actor authority;
- command allowance;
- current state;
- applicable policy;
- selected role;
- tool permissions;
- data classification;
- action risk and reversibility.

An agent cannot expand its own authority or delegate more authority than it holds.

## Permitted Action Classes

- **Observe:** read permitted context and tool state.
- **Analyze:** produce findings without changing baselines.
- **Draft:** create provisional outputs.
- **Propose:** prepare a change with impact and evidence.
- **Modify:** apply an explicitly authorized reversible change.
- **Operate:** execute a controlled external action under required confirmation or approval.

Approval remains a human or explicitly designated accountable system decision governed by policy.

## Context and Memory

Agents receive scoped context packs. Agent memory is divided into:

- **run memory:** temporary plan, observations, and intermediate state;
- **task memory:** retained only as allowed for a multi-step objective;
- **initiative memory:** governed repository artifacts, including Product memory where applicable, not private model memory;
- **organizational memory:** approved reusable knowledge;
- **provider memory:** treated as untrusted and prohibited unless explicitly governed.

Important learning must be proposed for repository promotion. Hidden provider-side memory must not be required for correctness.

## Agent Execution Obligations

Before acting, an agent shall:

1. restate the objective and target;
2. identify current state and authority;
3. inspect the context manifest;
4. disclose material gaps, conflicts, and assumptions;
5. confirm expected output and side effects;
6. select an allowed plan and skills;
7. stop if a defined condition prevents safe progress.

During execution, an agent shall:

- remain within scope;
- distinguish observation from inference;
- preserve provenance;
- seek the smallest safe next action;
- report material plan changes;
- avoid claiming review or evidence that did not occur.

After execution, an agent shall:

- summarize outputs and changes;
- report validation performed and not performed;
- identify remaining risks and assumptions;
- propose trace relationships and state disposition;
- request human decisions where required.

## Collaboration Model

Multiple agents may collaborate when work can be decomposed into bounded, independently verifiable specialties. Collaboration requires:

- explicit task ownership;
- non-overlapping or coordinated write scopes;
- shared context and decision definitions;
- output contracts;
- provenance for each contribution;
- a coordinator responsible for integration;
- conflict resolution and final human accountability.

Parallelism is not valuable when it creates duplicate reasoning or inconsistent edits.

## Independent Review

For material work, the generating agent should not be the only evaluator. Independence may be achieved through:

- a separate agent role or run;
- deterministic validators;
- human specialist review;
- comparison against approved reference cases;
- adversarial or counterargument analysis.

Independent AI review remains advisory unless policy designates a deterministic acceptance rule.

## Agent Selection

Selection considers:

- required capability and domain;
- risk and data classification;
- context size and modalities;
- tool requirements;
- model reliability evidence;
- cost and latency constraints;
- locality and privacy requirements;
- provider availability;
- organization policy.

Routing decisions should be recorded for material runs.

## Agent Quality Measures

- objective completion;
- factual and artifact accuracy;
- compliance with constraints;
- trace and evidence completeness;
- calibrated uncertainty;
- number and severity of policy violations;
- human correction effort;
- reproducibility across equivalent context;
- cost and latency;
- appropriate use of stop conditions.

## Anti-Patterns

- one omniscient agent with unrestricted repository and tool access;
- agents loading context independently without a manifest;
- using AI review as approval;
- persistent hidden memory as source of truth;
- multiple agents editing the same artifact without coordination;
- agent-specific repository structures;
- role names without behavioral or authority differences;
- agent autonomy introduced before state, trace, policy, and recovery exist.

## Design Implications

This model directly controls:

- [Runtime Model](017_RUNTIME_MODEL.md)
- [State Model](018_STATE_MODEL.md)
- [Agent Execution Flow](../05_AI_Runtime/042_AGENT_EXECUTION_FLOW.md)
- [Context Loading](../05_AI_Runtime/043_CONTEXT_LOADING.md)
- [Decision Model](../05_AI_Runtime/044_DECISION_MODEL.md)
- [Codex Working Model](../05_AI_Runtime/040_CODEX_WORKING_MODEL.md)
- [Claude Working Model](../05_AI_Runtime/041_CLAUDE_WORKING_MODEL.md)
