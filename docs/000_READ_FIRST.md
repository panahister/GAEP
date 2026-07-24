# Read First

**Governed AI Engineering Platform (GAEP)**\
**Document ID:** GAEP-DOC-000\
**Version:** 1.0\
**Status:** Draft\
**Authority:** Navigation and document-governance guide

## Purpose

This repository defines the governance, knowledge, lifecycle, architecture, assurance, and runtime foundations of the Governed AI Engineering Platform (GAEP). It is organized as an authoritative knowledge system rather than a collection of unrelated documents.

Read this file before creating, changing, approving, or generating any GAEP artifact.

For a self-contained, source-code-independent overview suitable for stakeholder orientation and external Product evaluation, read the [GAEP Platform and Product Identity Manifest](GAEP_PLATFORM_PRODUCT_IDENTITY_MANIFEST.md). The Manifest is an informative Product-direction synthesis; it does not replace this guide, the Constitution, or an approved specification and explicitly discloses the pending Product/Initiative semantic transition.

For active implementation, phase status, and the feature-by-feature handoff contract used by Codex and Claude Code, read the [GAEP Feature Delivery Tracker](06_Roadmap/054_GAEP_FEATURE_DELIVERY_TRACKER.md). No feature or phase is complete merely because code was generated; the tracker requires test evidence and explicit Product Owner acceptance before `Done` is recorded.

## What GAEP Is

GAEP is a vendor-, technology-, architecture-, tool-, and test-methodology-neutral platform for governing how artificial intelligence participates in engineering. Its generic unit of work is the **Engineering Initiative**, which may be a product, service, library, integration, migration, infrastructure capability, security improvement, defect fix, research activity, or another bounded engineering effort.

GAEP connects:

- initiative intent, classification, scope, and applicability;
- business, product, system, and implementation architecture where applicable;
- requirements, contracts, data, identity, security, and operational decisions;
- test methodology, acceptance conditions, test evidence, and readiness;
- governed organizational assets, including commands, skills, patterns, templates, and boilerplates;
- repository-visible state, decisions, traceability, approvals, and change history;
- AI analysis, challenge, generation, validation, and execution;
- accountable human judgment and Explicit Approval.

GAEP does not replace professional judgment. It gives humans and AI agents a governed workspace in which context is persistent, applicable engineering rigor is explicit, decisions are traceable, and change is controlled.

## What GAEP Is Not

GAEP is not:

- an AI code generator or prompt library;
- a single AI-DLC or fixed lifecycle methodology;
- a wrapper around Codex, Claude Code, Cursor, or another vendor;
- a product-only, web-only, UI-first, or Figma-dependent process;
- a mandate for one programming language, framework, database, cache, broker, architecture style, or test methodology;
- a replacement for product, architecture, security, quality, engineering, or operational accountability;
- an excuse to automate consequential decisions without human authority;
- a repository layout without an operating model.

AI-DLC and similar approaches may be integrated as execution methods. They do not define the platform.

## Authority Order

When documents conflict, use this precedence order:

1. `001_GAEP_CONSTITUTION.md` — constitutional law.
2. Foundation principles, including `006_ADAPTIVE_ENGINEERING_PRINCIPLES.md`.
3. Approved governance, approval, state, architecture, assurance, and change-control documents.
4. Approved repository, artifact, metadata, command, skill, agent, and runtime specifications.
5. Roadmaps and adoption guidance.
6. Draft proposals, examples, and external references.

No lower-authority document may override a higher-authority document implicitly. Conflicts shall be recorded, analyzed, and resolved through controlled change.

## Document Status

| Status | Meaning |
|---|---|
| Draft | Under active design; usable as provisional context but not an approved baseline. |
| In Review | Submitted for accountable review; material changes remain visible. |
| Approved | Accepted by the identified authority for a stated scope and version. |
| Baseline | Approved and designated as the current authoritative reference. |
| Superseded | Replaced by another identified version or document. |
| Retired | No longer valid for active work; retained according to policy. |

Approval must not be inferred from file presence, silence, generation, or merge status.

## Recommended Foundation Reading Order

Read the Foundation in this order:

1. [GAEP Constitution](01_Foundation/001_GAEP_CONSTITUTION.md) — highest-level obligations and human authority.
2. [Project Vision](01_Foundation/002_PROJECT_VISION.md) — the future engineering environment GAEP intends to create.
3. [Platform Philosophy](01_Foundation/003_PLATFORM_PHILOSOPHY.md) — the mindset used to interpret the platform.
4. [Core Principles](01_Foundation/004_CORE_PRINCIPLES.md) — durable evaluation criteria.
5. [Design Principles](01_Foundation/005_DESIGN_PRINCIPLES.md) — structural guidance for GAEP mechanisms and implementations.
6. [Adaptive Engineering Principles](01_Foundation/006_ADAPTIVE_ENGINEERING_PRINCIPLES.md) — GAEP's initiative-neutral lifecycle, Architecture-Before-Implementation rule, test-first assurance, security-by-design, applicability model, and Human–AI Challenge obligations.

The order matters: law and vision establish purpose; philosophy and core principles establish judgment; design and adaptive engineering principles determine how rigor is selected and applied.

## Recommended Platform Execution Reading Order

After the Foundation, read:

1. [Dynamic Engineering Model](02_Platform/019_DYNAMIC_ENGINEERING_MODEL.md) — classifies the initiative and resolves applicability, topology, technology, boilerplate, assurance, architecture, and readiness obligations.
2. [Engineering Assurance and Architecture Model](02_Platform/020_ENGINEERING_ASSURANCE_AND_ARCHITECTURE_MODEL.md) — executes Test Case, evidence, Quality Gate, HLD, LLD, approval, and living-architecture obligations.
3. The responsibility-specific Platform, Product Engineering, Repository, AI Runtime, and lifecycle documents required by the task.

The Dynamic Engineering Model (`GAEP-PLT-019`) and Engineering Assurance and Architecture Model (`GAEP-PLT-020`) operationalize the Foundation; they do not override the Constitution.

## Recommended Role-Based Paths

### Executive, engineering, or product leader

Read the full Foundation, then [Platform Architecture](02_Platform/010_PLATFORM_ARCHITECTURE.md), [Governance Model](02_Platform/013_GOVERNANCE_MODEL.md), the applicable lifecycle profile, and [Platform Roadmap](06_Roadmap/050_PLATFORM_ROADMAP.md).

### Architect, security leader, or quality leader

Read the full Foundation, then the Dynamic Engineering Model (`GAEP-PLT-019`) and Engineering Assurance and Architecture Model (`GAEP-PLT-020`), followed by responsibility-specific Platform, Artifact Lifecycle, Change Management, Traceability, Human Approval, Repository, and AI Runtime documents. Resolve architecture, identity, Assurance Strategy, Test Cases, evidence, and applicability before implementation readiness.

### Product, business-analysis, or UX practitioner

Read the Foundation, then the product-specific lifecycle and artifact models. Product discovery, personas, journeys, UI design, and Figma apply only when the Engineering Initiative requires them.

### Engineer, platform engineer, or operator

Read the Foundation, applicable Architecture Decisions and Technology Profiles, Assurance Strategy and Test Methodology Decisions, identity and authorization decisions, Organizational Boilerplate binding, active change, and implementation-readiness evidence.

### AI agent

An agent shall not load every file indiscriminately. It should:

1. load the Constitution and applicable Foundation principles;
2. identify the Engineering Initiative, Initiative Classification, scope, risk, and current state;
3. load Applicability Decisions and the minimum applicable policy set;
4. resolve Architecture Assets, Technology Profiles, Assurance Strategy and Profile, identity and authorization decisions, approved Test Cases, Quality Gates, and Organizational Boilerplate bindings required for its role;
5. load the context pack declared by the command;
6. resolve relevant upstream and downstream trace links;
7. challenge material ambiguity from within its assigned role;
8. record assumptions and missing context;
9. confirm current Implementation Readiness and stop when a defined condition or missing human authority prevents safe progress.

See [Context Loading](05_AI_Runtime/043_CONTEXT_LOADING.md) for the intended detailed algorithm.

## Knowledge Domains

| Directory | Responsibility |
|---|---|
| `01_Foundation` | Identity, purpose, philosophy, durable principles, and adaptive engineering obligations. |
| `02_Platform` | Logical architecture and governed operating mechanisms. |
| `03_Product_Engineering` | Product-specific packages plus generic artifact, change, traceability, and approval lifecycles. Product is one Engineering Initiative type. |
| `04_Repository` | Repository, context, knowledge, artifact, metadata, and trace structures. |
| `05_AI_Runtime` | Vendor-neutral execution behavior and tool-specific working models. |
| `06_Roadmap` | Delivery sequence, adoption, implementation, and future evolution. |
| `99_References` | Sources, glossary, controlled terminology, and external projects. |

## Adaptive Operating Loop

Every governed activity uses the applicable parts of this loop:

1. **Classify** — establish Engineering Initiative type, objective, scope, risk, and ownership.
2. **Determine Applicability** — resolve required, conditional, reused, deferred, or Not Applicable activities and assets.
3. **Understand and Analyze** — inspect context, evidence, dependencies, impacts, risks, and alternatives.
4. **Design** — resolve applicable architecture, security, identity, technology, assurance, and execution constraints.
5. **Challenge and Review** — test assumptions and outputs through role-bounded Human–AI Challenge and qualified review.
6. **Approve** — obtain Explicit Approval for consequential decisions at the correct authority level.
7. **Baseline and Execute** — establish exact authoritative versions and perform only readiness-compliant work.
8. **Trace and Evolve** — connect intent, decisions, implementation, Test Evidence, outcomes, and Change-Driven Re-evaluation.

No step, artifact, method, or tool is mandatory merely because GAEP supports it. Applicable obligations may not be omitted merely because adaptive execution is permitted.

Apply **Risk-Proportionate Governance** throughout: rigor follows criticality, sensitivity, regulatory exposure, blast radius, reversibility, and cost of failure.

## Working Rules for Humans and AI Agents

- Treat approved repository knowledge as authoritative within its scope.
- Treat temporary conversation as provisional until captured in a governed artifact.
- Distinguish facts, decisions, proposals, assumptions, Test Evidence, and examples.
- Never invent approval, state, ownership, trace links, applicability, or validation results.
- Do not implement while applicable architecture, assurance, security, identity, or Organizational Boilerplate decisions remain unresolved.
- Prefer governed reuse over uncontrolled generation.
- Prefer small, reviewable, evidence-producing increments.
- Challenge unsupported assumptions and context-free best practices.
- Preserve architecture and assurance assets as living, versioned repository knowledge.
- Escalate when missing authority or information could materially change the outcome.

## Document Maintenance

Every material document should include identity, version, status, authority, purpose, scope, relevant non-goals, normative rules, ownership, dependencies, validation, trace relationships, and design implications.

Changes must follow [Change Management](03_Product_Engineering/023_CHANGE_MANAGEMENT.md). Terminology must follow [Naming Conventions](04_Repository/035_NAMING_CONVENTIONS.md) and [Terminology](99_References/992_TERMINOLOGY.md). Changes to approved architecture, assurance, identity, or technology decisions require impact-based synchronization rather than isolated text edits.

## Current Boundary

This knowledge baseline defines GAEP before detailed platform implementation. It does not prescribe a backend, frontend, infrastructure, deployment topology, or programming stack. Those decisions shall be resolved at the appropriate enterprise, portfolio, initiative, system, and component levels.

## Design Implications

This guide governs:

- documentation navigation and authority resolution;
- agent context-loading order;
- initiative-neutral interpretation of downstream specifications;
- adaptive lifecycle and applicability expectations;
- the boundary between repository knowledge and conversational memory;
- synchronization obligations when Foundation principles change.
