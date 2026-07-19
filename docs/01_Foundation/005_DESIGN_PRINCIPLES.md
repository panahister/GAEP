# Design Principles

**Governed AI Engineering Platform (GAEP)**\
**Document ID:** GAEP-FND-005\
**Version:** 1.0\
**Status:** Draft\
**Authority:** Architecture and engineering-design guidance

## Purpose

Core Principles define what GAEP values. These Design Principles guide how GAEP mechanisms and implementations should be structured. They are strong defaults interpreted through the [Adaptive Engineering Principles](006_ADAPTIVE_ENGINEERING_PRINCIPLES.md), not context-free requirements.

## D01 — Explicit Over Implicit

Represent Engineering Initiative, applicability, identity, state, authority, dependencies, assumptions, readiness, and transitions explicitly when they affect behavior.

Avoid conventions that require hidden tribal knowledge. Use defaults only when they are discoverable and safe.

## D02 — One Authoritative Source Per Scope

Each governed fact or decision should have one authoritative representation for its scope and effective version. Derived views may exist but must identify their source and refresh model.

Do not maintain the same approval, Architecture Decision, Test Methodology Decision, state, or requirement manually in multiple places.

## D03 — Separation of Concerns

Keep these concepts distinct:

- Engineering Initiative: bounded engineering work;
- command: user intent and invocation contract;
- skill: repeatable method or capability;
- agent: reasoning and execution participant;
- runtime: orchestration, controls, and evidence;
- artifact: durable engineering output;
- context pack: scoped input selection;
- integration: vendor or tool adapter.
- Architecture Asset, Technology Profile, Assurance Strategy, and Organizational Boilerplate: separately governed decisions or assets.

Separation enables replacement, testing, and governance.

## D04 — Composition Over Inheritance and Duplication

Build complex workflows from focused commands, skills, policies, and artifact contracts. Prefer reusable composition to deep specialization hierarchies or copied workflows.

## D05 — Contracts Before Implementations

Stabilize applicable inputs, outputs, invariants, boundaries, failure behavior, evidence, and compatibility expectations before implementation.

Contracts should be technology-neutral where the domain is neutral.

## D06 — Dynamic Applicability Over Universal Convention

Defaults for naming, metadata, structure, lifecycle, evidence, and review may reduce effort. They shall not make an activity universally mandatory.

Designs shall represent Required, Recommended, Optional, Not Applicable, Deferred, Conditionally Required, Already Satisfied, Reused, Blocked, and Awaiting Human Decision states where relevant.

Risk-Proportionate Governance determines the depth of evidence, review, approval, and re-evaluation required for applicable activities.

Figma, personas, journeys, frontend activities, databases, caches, brokers, and UI artifacts are conditional. A backend-only service, library, migration, worker, infrastructure change, or defect fix shall not inherit irrelevant product or visual-design obligations.

## D07 — Least Context, Least Authority

Load only the context needed for the objective and grant only the capabilities required to act. More context can increase confusion and disclosure risk; more authority increases blast radius.

## D08 — Deterministic Controls Around Probabilistic Reasoning

Use deterministic validation for schemas, permissions, states, policy rules, identifiers, and mechanical checks. Use AI reasoning for synthesis, ambiguity, analysis, and proposal generation.

Do not rely on probabilistic output to enforce a rule that can be checked deterministically.

## D09 — Idempotent and Reversible Operations

Commands should be safe to retry where practical. Changes should support preview, diff, rollback, or supersession according to risk.

Irreversible operations require explicit confirmation and stronger evidence.

## D10 — Fail Closed on Authority, Fail Informatively on Knowledge

When permission, approval, architecture readiness, assurance readiness, or mandatory Organizational Boilerplate binding is uncertain, do not implement. When knowledge is incomplete, identify the gap and provide bounded analysis where safe.

## D11 — Multidimensional State for Governed Progression

Use explicit state models for Engineering Initiatives, applicability, lifecycle, artifacts, architecture, assurance, approvals, changes, and agent runs. Do not encode progression only in folders, labels, chats, or UI state.

## D12 — Eventful Transitions and Durable Evidence

Material state changes should emit a durable event or record containing actor, time, previous state, new state, reason, authority, and evidence references.

## D13 — Semantic Trace and Test Traceability

Trace links should use controlled relationship types such as `satisfies`, `implements`, `verifies`, `depends_on`, `uses_boilerplate`, `governed_by`, or `supersedes`. Free-form links are insufficient for reliable impact analysis.

Requirements, acceptance criteria, test cases, automated tests, coverage evidence, Test Evidence, approvals, and implementation units shall remain traceable at the granularity required for impact and readiness.

## D14 — Progressive Disclosure

Present the minimum information needed for the current role and task while preserving navigability to deeper evidence. This applies to documentation, user experience, context loading, and review interfaces.

## D15 — Schema Evolution and Compatibility

Metadata, commands, events, artifacts, and integrations must define versioning and migration behavior. Favor additive evolution and explicit deprecation over silent breaking change.

## D16 — Portable Core, Specialized Components

Keep core semantics vendor-, technology-, architecture-, tool-, and test-methodology-neutral. Isolate specialized capabilities in component Technology Profiles, adapters, and governed decisions.

Do not assume one language, framework, database, cache, broker, deployment model, or test methodology for an entire initiative. Each major implementation unit shall resolve its Technology Profile before implementation.

## D17 — Observable Execution

Every meaningful run should expose objective, selected context, actions, policy decisions, outputs, warnings, evidence, duration, and disposition at a level appropriate to privacy and security.

## D18 — Security, Authentication, and Authorization by Design

Classify information, identify trust boundaries, minimize exposure, separate secrets, enforce least privilege, validate external inputs, and resolve identity and authorization before applicable implementation.

Authentication shall be explicitly Required or Not Applicable with rationale when material. Authorization shall be enforced at the authoritative service, data, resource, or infrastructure boundary—not only in the UI. Assurance shall include applicable negative, privileged, scope, ownership, and tenant-isolation scenarios.

## D19 — Quality Attributes and Living Architecture Are First-Class

Architecture decisions should state their effect on maintainability, security, reliability, performance, usability, accessibility, portability, auditability, and cost where applicable.

Architecture context, high- and low-level views, client/service/data/integration/deployment topology, trust boundaries, ADRs, and implementation constraints are repository-visible Architecture Assets. They are versioned, reviewed, approved, and updated through Change-Driven Re-evaluation.

The notation may be Markdown, Mermaid, C4-style, UML, ADRs, or another approved format. No diagram notation or visual tool is universal.

## D20 — No Abstraction or Pattern Without a Trigger

Introduce a layer, service, broker, cache, database, framework, Saga, Outbox, CQRS, Event Sourcing, retry, lock, or other pattern only when it resolves a named variability, ownership, quality, consistency, scale, delivery, failure, or governance problem.

Record the triggering need, alternatives, consequences, operational burden, assurance obligations, and decision owner. Best practices are contextual engineering responses, not architectural decoration.

## D21 — Architecture Gate Before Implementation

Before implementation, resolve all applicable Architecture Decisions to the depth required by the initiative, including boundaries, topology, data ownership, identity, trust, integration, deployment, and quality constraints.

Implementation may begin only when unresolved architecture cannot establish consequential behavior accidentally. Approved prototypes may precede a decision only when bounded, non-production, and intended to reduce uncertainty.

## D22 — Assurance and Acceptance Gate Before Implementation

Before implementation, resolve the Assurance Strategy, Test Methodology Decision, acceptance conditions, applicable test levels, automation, coverage meaning, security and authorization tests, Test Evidence, and human review requirements.

TDD, BDD, ATDD, Gherkin, example mapping, contract, integration, migration, UI, performance, security, accessibility, resilience, and operational tests are selected dynamically. No single method or coverage percentage proves quality.

## D23 — Governed Organizational Boilerplate Binding

For each applicable implementation unit:

1. resolve architecture and Technology Profile;
2. locate the approved Organizational Boilerplate or foundation;
3. verify owner, version, accessibility, suitability, compatibility, and required capabilities;
4. record repository, path, tag, commit, package, or artifact reference;
5. bind it as the implementation baseline and record deviations.

AI must not invent or silently substitute an official boilerplate. Creating or modifying an official Organizational Boilerplate requires separate Explicit Approval and consumer-impact analysis.

## D24 — Explicit Approval and Challenge Loops

Consequential outputs move through visible states such as Proposed, Challenged, Revised, Awaiting Review, Conditionally Approved, Approved, Rejected, Deferred, Superseded, or Exception Granted.

Human–AI Challenge loops are role-bounded and evidence-based. Agents may raise concerns and alternatives but do not silently override other roles or finalize decisions requiring human authority.

## D25 — Change-Driven Re-evaluation

A changed approved decision triggers trace-based re-evaluation of affected requirements, Architecture Assets, Technology Profiles, interfaces, data, authentication, authorization, Assurance Strategy, tests, deployment, observability, risks, approvals, and documentation.

Implementation and its governing assets evolve together. A code change must not leave architecture or Test Evidence as stale snapshots.

## Applying the Principles

Design reviews should include:

1. Engineering Initiative, scope, Initiative Classification, and risk;
2. applicable constitutional, core, and adaptive principles;
3. Applicability Decisions and selected lifecycle profile;
4. Architecture Assets, alternatives, quality attributes, and Explicit Approval;
5. component Technology Profiles and Organizational Boilerplate bindings;
6. security, authentication, authorization, and trust decisions;
7. Assurance Strategy, acceptance conditions, tests, coverage meaning, and Test Evidence;
8. Human–AI Challenges and dispositions;
9. traceability, reversibility, migration, and Change-Driven Re-evaluation;
10. accountable decision owner and exceptions.

Deviations are allowed when documented, justified, approved at the appropriate level, and time-bounded where possible. An Applicability Decision is not an exception when the activity genuinely does not apply.

## Design Implications

These principles directly shape:

- [Adaptive Engineering Principles](006_ADAPTIVE_ENGINEERING_PRINCIPLES.md)
- [Platform Architecture](../02_Platform/010_PLATFORM_ARCHITECTURE.md)
- [Dynamic Engineering Model](../02_Platform/019_DYNAMIC_ENGINEERING_MODEL.md)
- [Engineering Assurance and Architecture Model](../02_Platform/020_ENGINEERING_ASSURANCE_AND_ARCHITECTURE_MODEL.md)
- [Command Model](../02_Platform/014_COMMAND_MODEL.md)
- [Skill Model](../02_Platform/015_SKILL_MODEL.md)
- [Runtime Model](../02_Platform/017_RUNTIME_MODEL.md)
- [Metadata Model](../04_Repository/034_METADATA_MODEL.md)
- [Implementation Strategy](../06_Roadmap/051_IMPLEMENTATION_STRATEGY.md)
