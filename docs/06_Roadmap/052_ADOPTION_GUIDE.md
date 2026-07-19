# Adoption Guide

**Governed AI Engineering Platform (GAEP)**  
**Document ID:** GAEP-RDM-052  
**Version:** 1.0  
**Status:** Draft  
**Authority:** Organizational and Engineering Initiative adoption guidance

## Purpose

This document defines how an organization or engineering team can adopt GAEP incrementally without replacing all existing tools or processes at once.

## Adoption Principle

Adopt GAEP around a real Engineering Initiative where persistent context, traceability, approval, assurance, or reuse provides visible value. Do not begin by imposing the entire documentation architecture on every team.

## Adoption Preconditions

- an accountable sponsor and initiative owner, plus a Product Owner when Product semantics apply;
- a pilot Engineering Initiative or workflow;
- access to current initiative knowledge, existing systems, and repositories;
- willingness to identify authoritative sources and owners;
- a small cross-functional adoption team;
- defined security and data constraints;
- baseline metrics or known pain points;
- permission to change working practices within the pilot scope.

## Selecting a Pilot

A strong pilot has:

- active engineering work, not a purely theoretical case;
- enough complexity to benefit from trace and context;
- manageable risk and scope;
- engaged architecture, security, quality, engineering, and Product or design roles when applicable;
- accessible artifacts and decision history;
- a deliverable within one to three months;
- willingness to measure outcomes.

Avoid the most regulated or politically complex initiative as the first pilot unless governance evidence is the explicit use case and leadership supports it.

## Adoption Maturity Levels

### Level 0 — Ad Hoc AI Assistance

AI is used in isolated chats or IDEs. Context is repeated manually. Decisions and outputs are weakly connected.

### Level 1 — Repository-Aware

Product profile, glossary, architecture, and instructions are available in the repository. Agents inspect before acting.

### Level 2 — Governed Artifacts

Artifacts have identity, status, owner, provenance, review, and baseline semantics.

### Level 3 — Traceable Lifecycle

Product intent, architecture, UX, backlog, implementation, tests, and releases have typed trace relationships and change impact.

### Level 4 — Governed Agent Runtime

Commands, context packs, skills, agents, approvals, stop conditions, and evidence are executed consistently.

### Level 5 — Organizational Learning Platform

Products reuse approved assets, cross-product learning is governed, policies are federated, and tool adapters are replaceable.

Teams may remain at a level that delivers sufficient value. Maturity is not a competition.

## First 30 Days — Understand and Baseline

1. Name sponsor, initiative owner, architecture owner, security and quality owners as applicable, repository steward, and pilot team.
2. Define pilot objective, scope, non-scope, and success measures.
3. Inventory repositories, documents, existing architecture, identity and authorization, tests, delivery, operational sources, and Figma or backlog systems only when applicable.
4. Identify authoritative, duplicate, stale, missing, and sensitive knowledge.
5. Create an Initiative Profile, Applicability Matrix, and glossary or glossary references.
6. Map current lifecycle, architecture, assurance, readiness, and approval behavior.
7. Establish a minimal GAEP workspace and metadata conventions.
8. Select one workflow, such as architecture review or backlog readiness.

Deliverable: adoption assessment and minimal authoritative initiative context baseline.

## Days 31–60 — Govern One Workflow

1. Define target command and artifact contracts.
2. create required trace relationships.
3. assemble a reproducible context pack.
4. use Codex or Claude to assess or draft within isolated scope.
5. run deterministic validation.
6. perform human review and record approval.
7. baseline the artifact and capture evidence.
8. compare effort, quality, and re-explanation with previous practice.

Deliverable: one complete governed workflow with measured outcome.

## Days 61–90 — Extend and Learn

1. Add a second connected lifecycle workflow.
2. introduce change-impact analysis.
3. connect one external tool read-only.
4. refine templates, skills, and policies from pilot evidence.
5. train additional participants by role.
6. identify reusable assets and local exceptions.
7. decide whether to expand, repeat, narrow, or stop.

Deliverable: pilot report, revised adoption plan, and approved next scope.

## Existing Repository Adoption

Do not reorganize immediately. Instead:

1. inventory artifacts in place;
2. assign stable IDs and metadata;
3. define resolvers and external references;
4. create product and artifact indexes;
5. identify current baselines;
6. add trace links around the pilot workflow;
7. move or rename only where navigation or governance improves materially;
8. retain redirects and migration history.

## Existing Tool Adoption

### Chat and AI tools

Keep using them, but promote material conclusions into governed artifacts. Use repository context rather than private memory.

### Figma

When visual design and Figma are applicable, treat the design as an external governed artifact with version, owner, decision, design-system, and trace references. Do not introduce Figma as an adoption prerequisite for headless or non-visual work.

### Backlog systems

Keep operational backlog where teams work. Map stable IDs, hierarchy, acceptance criteria, and trace into GAEP semantics.

### Source repositories and IDEs

Integrate through instructions, contracts, code trace, tests, and change records. Do not copy all source into the initiative knowledge repository unnecessarily.

### CI/CD and operations

Begin read-only with evidence references. Add controlled write or release actions only after identity, state, approval, and recovery are proven.

## Role-Based Training

### Leaders

Vision, decision rights, metrics, risk, and adoption sponsorship.

### Product and business roles

Product context, artifact ownership, lifecycle, backlog trace, and approvals.

### Architects

Domain boundaries, decisions, state, impact, trace, and implementation readiness.

### Designers

Journey/process alignment, design-system governance, Figma versioning, accessibility, and trace.

### Engineers and QA

context loading, approved change scope, contracts, TDD, code/test trace, and evidence.

### Repository and platform stewards

schemas, metadata, validation, adapters, retention, security, and capability catalogs.

## Adoption Metrics

Measure before and after:

- time spent re-explaining context;
- time to find authoritative knowledge;
- review findings and rework;
- trace and metadata completeness;
- late requirement or architecture changes;
- human approval lead time;
- agent output acceptance and correction rate;
- defect and rollback rate;
- reuse of approved assets;
- user trust and cognitive load.

Do not optimize document count, AI output volume, or approval clicks.

## Change Management for People

- explain the problem GAEP solves, not only the structure;
- include practitioners in tailoring;
- remove obsolete work when adding governance;
- show how explicit context reduces repeated explanation;
- create office hours and examples;
- reward surfaced uncertainty and early risk;
- publish decisions and adoption learning;
- allow teams to challenge platform complexity.

## Adoption Risks

- documentation burden without automation;
- treating GAEP as compliance theater;
- central team controlling product decisions;
- AI excitement preceding product need;
- migration that breaks existing workflows;
- unclear ownership of artifacts;
- too many mandatory gates;
- sensitive data sent to unapproved providers;
- pilot success measured only by speed.

## Exit or Pause Criteria

Pause adoption when:

- no accountable owner exists;
- the pilot cannot access authoritative context;
- governance burden exceeds measured value and cannot be simplified;
- security or privacy controls are insufficient;
- teams are required to duplicate the same truth in several systems;
- platform semantics remain too unstable for the next investment.

## Design Implications

This guide applies:

- [Platform Roadmap](050_PLATFORM_ROADMAP.md)
- [Implementation Strategy](051_IMPLEMENTATION_STRATEGY.md)
- [Package Strategy](../03_Product_Engineering/020_PACKAGE_STRATEGY.md)
- [Repository Structure](../04_Repository/030_REPOSITORY_STRUCTURE.md)
- [Future Evolution](053_FUTURE_EVOLUTION.md)
- [Dynamic Engineering Model](../02_Platform/019_DYNAMIC_ENGINEERING_MODEL.md)
- [Engineering Assurance and Architecture Model](../02_Platform/020_ENGINEERING_ASSURANCE_AND_ARCHITECTURE_MODEL.md)
