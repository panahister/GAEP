# Core Principles

**Governed AI Engineering Platform (GAEP)**\
**Document ID:** GAEP-FND-004\
**Version:** 1.0\
**Status:** Draft\
**Authority:** Foundational engineering principles

## Purpose

These principles are durable evaluation criteria for every GAEP component and Engineering Initiative. They elaborate the Constitution without replacing it. Detailed adaptive interpretation is defined by the [Adaptive Engineering Principles](006_ADAPTIVE_ENGINEERING_PRINCIPLES.md).

## P01 — Risk-Proportionate Governance Before Automation

Automation shall operate within explicit policy, applicability, state, authority, and evidence requirements. Governance depth shall reflect criticality, sensitivity, regulation, blast radius, reversibility, and cost of failure. Technical capability alone does not authorize action.

**Test:** Can reviewers identify the governing rule, allowed state, accountable owner, and required evidence?

## P02 — Human Accountability and Explicit Approval

AI may assist and execute, but humans own consequential decisions and outcomes. Explicit Approval shall be attributable, version-specific, scoped, and distinguishable from recommendation or review.

**Test:** Is the accountable human role named, and would the decision remain unambiguous without chat history or silence-based inference?

## P03 — Repository as Source of Truth

Approved engineering knowledge, Architecture Assets, Technology Profiles, Assurance Strategies, Test Evidence, decisions, approvals, and change history live in durable versioned storage, not only in conversations.

**Test:** Can a future participant reconstruct the authoritative understanding without access to the original chat?

## P04 — Context and Applicability Before Generation

Relevant, trusted, current, and applicable context is more important than sophisticated prompt wording or a universal process.

**Test:** Is the context contract scoped to the Engineering Initiative, Applicability Decisions, state, authority, and risk?

## P05 — Organizational Memory Over Individual Memory

Knowledge must survive individuals, teams, tools, and AI sessions.

**Test:** Is important knowledge captured with ownership, provenance, lifecycle, and discoverability?

## P06 — Initiative Neutrality and Conditional Lifecycle

GAEP classifies the Engineering Initiative before selecting lifecycle, artifacts, architecture depth, technology, design activities, Assurance Strategy, commands, skills, and approvals. Product is one valid initiative type, not the universal abstraction. Activities are activated by scope, risk, dependency, policy, quality requirement, or engineering necessity.

**Test:** Are entry and exit conditions, applicability states, rationale, allowed actions, and transition authority explicit—and are Not Applicable decisions traceable where their absence would be ambiguous?

## P07 — Traceability by Design

Intent, applicability, requirements, architecture, identity, technology, acceptance criteria, tests, implementation, Test Evidence, approval, release, and outcomes should be meaningfully connected.

**Test:** Can impact be navigated upstream and downstream, including the rationale for material Not Applicable decisions?

## P08 — Governed Reuse Before Reinvention

Approved organizational assets shall be considered before new assets are created. Organizational Boilerplates, starter kits, templates, patterns, commands, skills, and test assets carry version, owner, applicability, provenance, and evidence of fitness.

**Test:** Was approved reuse evaluated, and did AI avoid silently inventing or substituting an official asset?

## P09 — Composition Over Duplication

Capabilities should be assembled from focused contracts rather than copied into parallel structures.

**Test:** Does this design introduce another source of truth or repeated logic?

## P10 — Continuous, Role-Bounded Human–AI Challenge

AI contributes analysis, generation, validation, and evidence-based challenge without becoming the accountable decision owner. Humans may challenge, revise, reject, conditionally approve, approve, defer, or supersede recommendations.

**Test:** Did challenge improve the decision without becoming performative or overriding another role's authority?

## P11 — Explicit State Management

The platform and its agents shall know current Engineering Initiative, applicability, lifecycle, artifact, architecture, assurance, change, approval, and execution state.

**Test:** Could the same command behave incorrectly because state was inferred or missing?

## P12 — Controlled Change

Material changes require intent, impact analysis, challenge, review, Explicit Approval, validation, trace updates, and Change-Driven Re-evaluation of affected assets.

**Test:** Can the change be explained from request through outcome?

## P13 — Architecture Before Implementation

Applicable implementation follows intentional Architecture Decisions about boundaries, contracts, topology, data ownership, identity, trust, constraints, and quality goals. GAEP prescribes no universal architecture style.

**Test:** Is code being asked to decide an unresolved architectural question implicitly?

## P14 — Small, Verifiable Progress

Prefer coherent increments that can be reviewed, tested, and reversed.

**Test:** Is the change surface small enough to understand and validate?

## P15 — Vendor and Per-Component Technology Neutrality

Core semantics remain independent from models, vendors, IDEs, languages, frameworks, databases, caches, brokers, clouds, and test methodologies. Each major implementation unit has an explicit Technology Profile when implementation is applicable.

**Test:** Is the technology choice justified at the correct level, and can the integration be replaced without losing governance or engineering memory?

## P16 — Extensibility by Default, Not Speculation

Use stable contracts and extension points where change is credible; avoid abstractions without a real variation need.

**Test:** Which known or likely variation does the extension mechanism support?

## P17 — Explainability

Material recommendations and actions expose rationale, considered context, assumptions, risks, and alternatives.

**Test:** Can an accountable reviewer make a decision without trusting opaque confidence?

## P18 — Test-First Assurance and Evidence Before Confidence

Before applicable implementation, GAEP resolves acceptance conditions, Test Methodology Decision, required test levels, automation, coverage meaning, Test Evidence, and approval needs. Readiness, security, quality, and completion claims require current evidence proportional to risk; no single methodology or percentage is universally sufficient.

**Test:** What observable evidence supports the claim, which requirement or risk does it cover, and is it current for the exact version?

## P19 — Continuous Learning

Validated experience should improve reusable knowledge, policies, templates, practices, Architecture Assets, and assurance assets.

**Test:** Is learning captured and reviewed before organization-wide promotion, and are living assets updated with relevant change?

## P20 — Long-Term Stewardship

Decisions balance immediate value with maintainability, operability, portability, and future evolution.

**Test:** What future cost or lock-in is being accepted, and who owns it?

## P21 — Security, Authentication, and Authorization by Design

Security, trust, identity, authentication, authorization, tenant isolation, secrets, and audit are explicitly assessed before applicable implementation. Authorization is enforced at the authoritative service, data, resource, or infrastructure boundary.

**Test:** Is authentication explicitly Required or Not Applicable with rationale, and are negative, privileged, ownership, scope, and tenant-isolation scenarios included in assurance?

## P22 — Contextual Engineering Patterns

Patterns and best practices are selected in response to concrete failure modes, consistency needs, delivery semantics, topology, scale, transaction boundaries, or operational risk—not inserted as architectural decoration.

**Test:** What problem triggers the pattern, what simpler alternatives were considered, and what new assurance or operational obligations result?

## Principle Resolution

Principles can create tension. Resolve tension using this order:

1. comply with the Constitution and applicable law or policy;
2. protect human safety, security, privacy, and accountability;
3. preserve truth, provenance, state, and traceability;
4. prefer the simplest design that satisfies current quality and credible evolution needs;
5. record trade-offs and the responsible decision owner.

Examples:

- Reuse does not require using an asset that is unsafe or contextually wrong.
- Initiative neutrality does not permit hiding product or user impact inside a technical label.
- Conditional lifecycle does not permit omission without an Applicability Decision.
- Technology neutrality does not prohibit an enterprise standard or justified component-specific choice.
- Test-first assurance does not make one test methodology mandatory.
- Extensibility does not justify premature platform complexity.
- Small increments do not justify breaking global architecture.
- Vendor neutrality does not prohibit a vendor-specific adapter with an explicit portability boundary.
- Pattern awareness does not justify speculative distributed complexity.

## Review Checklist

Every material proposal should state:

- Engineering Initiative and Initiative Classification;
- applicable principles;
- Applicability Decisions and selected lifecycle profile;
- architecture, Technology Profile, security, and Assurance Strategy readiness;
- relevant Human–AI Challenges and alternatives;
- known principle tensions;
- design choices and trade-offs;
- evidence, Test Evidence, and traceability plan;
- accountable decision owner and Explicit Approval needs;
- Organizational Boilerplate or reusable-asset binding;
- required exceptions, if any.
- Change-Driven Re-evaluation triggers.

## Design Implications

These principles directly govern all downstream models, with particular impact on:

- [Adaptive Engineering Principles](006_ADAPTIVE_ENGINEERING_PRINCIPLES.md)
- [Platform Architecture](../02_Platform/010_PLATFORM_ARCHITECTURE.md)
- [Dynamic Engineering Model](../02_Platform/019_DYNAMIC_ENGINEERING_MODEL.md)
- [Engineering Assurance and Architecture Model](../02_Platform/020_ENGINEERING_ASSURANCE_AND_ARCHITECTURE_MODEL.md)
- [Governance Model](../02_Platform/013_GOVERNANCE_MODEL.md)
- [State Model](../02_Platform/018_STATE_MODEL.md)
- [Artifact Lifecycle](../03_Product_Engineering/022_ARTIFACT_LIFECYCLE.md)
- [Context Packs](../04_Repository/031_CONTEXT_PACKS.md)
- [Decision Model](../05_AI_Runtime/044_DECISION_MODEL.md)
