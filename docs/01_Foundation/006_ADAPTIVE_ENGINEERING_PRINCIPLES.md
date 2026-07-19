# Adaptive Engineering Principles

**Governed AI Engineering Platform (GAEP)**\
**Document ID:** GAEP-FND-006\
**Version:** 1.0\
**Status:** Draft\
**Authority:** Foundational engineering principles\
**Change Class:** Foundational\
**Audience:** Enterprise architects, engineering leaders, product leaders, quality leaders, security leaders, platform teams, delivery teams, and AI agents

## 1. Purpose

This document establishes GAEP's foundational commitment to adaptive engineering. It defines how GAEP shall select lifecycle activities, architecture depth, technology decisions, assurance methods, security controls, organizational assets, AI participation, and human approval according to the actual engineering work being performed.

GAEP governs engineering without assuming that all work is a new product, a user-facing feature, a web application, a frontend/backend pair, or a full end-to-end product lifecycle. It also does not assume that every initiative requires visual design, Figma, personas, a database, a message broker, microservices, an AI-generated boilerplate, or one universal testing method.

The platform shall adapt to the initiative while preserving durable obligations: relevant context, explicit state, architecture before implementation, assurance by design, security by design, repository-visible decisions, traceability, meaningful Human–AI challenge, explicit human authority, and governance proportional to risk.

These principles refine the GAEP foundation. **Product** remains valid where its semantics apply, but it is not GAEP's universal abstraction; the generic unit of governed work is the **Engineering Initiative**.

## 2. Scope

These principles apply whenever GAEP analyzes, designs, changes, verifies, releases, operates, or retires an engineering outcome. They apply regardless of:

- whether the initiative creates a new capability or changes an existing one;
- whether the result is user-facing, headless, internal, infrastructural, operational, or experimental;
- whether implementation uses one technology or several;
- whether work occurs in one repository or across many;
- whether delivery is sequential, iterative, exploratory, incident-driven, or migration-driven;
- whether AI performs analysis, generates a draft, modifies implementation, reviews evidence, or coordinates work;
- whether the initiative is small and reversible or enterprise-critical and difficult to reverse.

This document is foundational rather than procedural. Detailed state, command, schema, runtime, context-loading, and approval mechanics belong in related GAEP specifications. They require applicable decisions, durable material determinations, and implementation stops while readiness obligations remain unresolved.

## 3. The Engineering Initiative

### 3.1 Definition

An **Engineering Initiative** is GAEP's generic unit of governed engineering work. It is a bounded effort undertaken to investigate, create, change, assure, operate, migrate, secure, modernize, or retire an engineering capability or asset.

An Engineering Initiative may represent, but is not limited to:

- a product or product increment;
- a feature, epic, or backlog item;
- a service, microservice, or modular-monolith module;
- a frontend or mobile application;
- an API or integration;
- a batch process, worker, or event consumer;
- an SDK, CLI, shared library, or reusable package;
- an infrastructure or DevOps capability;
- a security or observability improvement;
- a data capability or data migration;
- an AI or machine-learning capability;
- a modernization or refactoring effort;
- technical-debt remediation;
- a defect fix;
- a prototype, spike, experiment, or research activity;
- a deployment, tenancy, identity, or operational change.

**Product** is one valid initiative type. It may have discovery, business architecture, experience design, backlog, and market or user-outcome concerns that do not apply to other types. GAEP must not use Product as a semantic shortcut for a library, security remediation, infrastructure capability, migration, defect fix, or research activity when product semantics would distort the work.

### 3.2 Initiative Profile

Before lifecycle or implementation selection, each material initiative shall have an **Initiative Profile** appropriate to its size and risk. The profile should resolve:

- initiative identity, type, objective, owner, and accountable decision roles;
- scope, non-scope, expected outcome, and success conditions;
- affected products, systems, components, users, operations, or organizational assets;
- whether the initiative is new, corrective, adaptive, experimental, migratory, or retiring;
- expected implementation units and external dependencies;
- business criticality, data sensitivity, regulatory exposure, blast radius, and reversibility;
- current engineering state and relevant baselines;
- lifecycle activities that are required, conditional, already satisfied, reusable, deferred, or not applicable;
- unresolved decisions that block design, implementation, assurance, release, or operation.

The profile may be concise for a small defect and extensive for a platform modernization or identity system. Its depth is proportional to need and risk.

## 4. Why Adaptivity Is Required

Engineering work has different uncertainty, topology, quality, security, regulatory, and operational characteristics. A uniform process produces two predictable failures:

1. **Over-governance:** low-risk work is burdened with irrelevant phases, artifacts, meetings, and approvals.
2. **Under-governance:** high-risk work passes through a nominal workflow that omits the decisions and evidence its actual failure modes require.

Adaptivity selects the right rigor; it does not permit unjustified omission. A CLI, payment API, migration, mobile client, event consumer, and research prototype may use GAEP without identical lifecycle paths.

GAEP shall challenge both unnecessary ceremony and unjustified shortcuts. Inapplicability, not inconvenience, justifies omission.

## 5. Initiative Neutrality

GAEP shall classify the Engineering Initiative before selecting its lifecycle, artifacts, design activities, test methodology, architecture depth, security depth, approvals, commands, skills, tools, or execution path.

Initiative classification should consider:

- the engineering outcome and initiative type;
- affected capability and system boundaries;
- implementation shape and interaction surface;
- novelty and uncertainty;
- data, identity, security, and regulatory characteristics;
- integration and deployment topology;
- operational criticality and failure impact;
- reversibility and migration needs;
- organizational standards and mandatory assets;
- current repository state and existing approved decisions.

GAEP must not force product-discovery practices onto work that does not require product discovery. A security remediation may begin with threat evidence and affected trust boundaries. A data migration may begin with source/target models, reconciliation rules, rollout, and rollback. A defect fix may begin with reproduction, root cause, regression scope, and acceptance evidence. A research activity may begin with a hypothesis, timebox, experimental controls, and a non-production constraint.

Conversely, classifying work as technical must not conceal product or user impact. A cache change, event-contract change, identity-policy change, or dependency upgrade may require broader product, architecture, security, release, and operational review when its impact warrants it.

Commands, skills, templates, metadata, and runtime state shall use Engineering Initiative for generic rules and Product only for intentional product semantics.

## 6. Conditional Lifecycle

GAEP shall activate lifecycle phases and artifacts according to applicability. A lifecycle is a resolved profile for an initiative, not a universal procession through every capability GAEP can support.

> **No GAEP phase, artifact, tool, method, or approval is mandatory solely because it exists in the framework. Its applicability must be established by scope, risk, dependency, policy, quality requirement, or engineering necessity.**

Examples include:

- Figma is applicable when visual interaction, UI behavior, user journeys, design-system assets, or visual evidence require design work.
- A backend-only service may require contracts, data ownership, authorization, service topology, and operational evidence but no Figma artifact.
- A shared library may require API compatibility, consumer analysis, semantic versioning, and unit or integration evidence but no personas.
- A security remediation may require threat, trust-boundary, authorization, regression, and deployment artifacts without product discovery.
- A migration may require architecture, source/target data models, compatibility, reconciliation, rollout, rollback, and operational acceptance rather than visual design.
- A headless consumer may require event contracts, delivery semantics, idempotency analysis, failure handling, observability, and tests but no UI artifact.
- A defect fix must not automatically trigger the same depth as a new enterprise platform, but it shall include the analysis and regression evidence necessary for its risk.

Applicability shall be resolved early enough to guide planning and context, then revised when evidence changes scope, topology, or risk.

Each material determination of whether a phase, artifact, method, decision, or approval applies is an **Applicability Decision**. It shall identify its subject, state, rationale where required, decision owner, evidence, and re-evaluation trigger in proportion to risk.

A lifecycle profile should identify:

- activated, combined, or omitted phases;
- entry and exit conditions;
- required architecture, assurance, security, release, and operational decisions;
- required artifacts and acceptable existing assets;
- human review and approval points;
- re-evaluation triggers;
- dependencies on other initiatives or baselines.

When a phase is not applicable, GAEP should record the rationale when needed to distinguish deliberate omission from an unresolved obligation.

## 7. Technology and Architecture Neutrality

### 7.1 Technology Neutrality

GAEP shall not prescribe one fixed technology stack. Technology decisions may be governed at enterprise, portfolio, product, system, bounded-context, service, client, module, workload, or deployment-unit level.

Enterprise or portfolio standards may constrain options. Component exceptions or alternatives may be justified by capability, performance, ecosystem, operations, security, portability, or team constraints. Higher-level policy and decision ownership remain explicit.

Examples of possible technologies include .NET, Java, Node.js, Python, Go, or Rust for backend workloads; React, Next.js, Angular, or Vue for browser clients; and Flutter, React Native, Swift, or Kotlin for mobile clients. These examples illustrate legitimate variation. They are not GAEP defaults and do not form a preferred catalog.

GAEP also shall not assume a database, cache, broker, cloud, container platform, or deployment model. The need for persistence, caching, messaging, distributed coordination, or specialized infrastructure must be derived from concrete requirements and failure modes.

### 7.2 Per-Component Technology Decisions

GAEP must not assume one stack for an entire initiative. Different implementation units may use different stacks when the decision is justified and the integration and operational cost is understood.

For example, one initiative might use:

- an Angular administrative portal;
- a Next.js customer-facing application;
- a Flutter mobile client;
- a Python AI service;
- a Go high-throughput worker;
- a .NET or Java domain service.

Heterogeneity is neither a goal nor a defect. It shall be justified against capability, operability, interoperability, security, delivery constraints, lifecycle cost, and exit strategy.

Each major implementation unit shall have an explicitly resolved **Technology Profile** before implementation. A Technology Profile should identify:

- implementation-unit identity and responsibility;
- language, framework, runtime, and material libraries;
- persistence, messaging, caching, and external-service dependencies, if applicable;
- build, packaging, deployment, and support model;
- compatibility and interoperability constraints;
- approved boilerplate or foundation binding;
- security, maintenance, licensing, and lifecycle considerations;
- decision owner, rationale, alternatives, and approval state.

The profile may inherit approved organizational choices, but inheritance shall be visible. A default is a decision source, not an excuse to avoid fitness assessment.

### 7.3 Architecture Neutrality

GAEP shall not prescribe modular monoliths, microservices, event-driven architecture, request-driven architecture, server-side rendering, single-page applications, micro frontends, native mobile, cross-platform mobile, monorepos, polyrepos, or any other architecture style universally.

Architecture style shall follow domain boundaries, ownership, quality attributes, consistency, failure isolation, team topology, operations, regulation, and cost of change.

## 8. Architecture Before Implementation

Before implementation begins, applicable architectural decisions shall be resolved to the depth required by the initiative. **Resolved** means that the decision is explicit, evidence-informed, reviewed at the appropriate authority level, and sufficient to constrain implementation. It does not require premature detail that implementation can safely decide locally.

Applicable decisions may include:

- modular monolith versus microservices;
- synchronous versus asynchronous integration;
- request-driven versus event-driven interaction;
- REST, gRPC, messaging, file exchange, or another interface form;
- single-page application versus server-side rendering;
- monorepo versus polyrepo;
- modular frontend versus micro frontend;
- native versus cross-platform mobile;
- deployment and runtime topology;
- tenancy and isolation model;
- consistency and transaction model;
- data ownership and lifecycle;
- service, module, and client boundaries;
- identity, authentication, authorization, and trust boundaries;
- observability, failure handling, recovery, and operational ownership.

GAEP shall determine which of these decisions are applicable; it shall not require meaningless decisions. A library may have no deployment topology. A static analysis tool may have no user authentication. A schema migration may not introduce a new client boundary. When a category is inapplicable, the decision may be recorded as Not Applicable with rationale.

Implementation readiness shall not be granted while unresolved architectural choices would cause code generation or implementation to establish major boundaries, technology commitments, security behavior, data ownership, or operational responsibilities implicitly.

Architecture before implementation also means architecture is open to challenge. The selected architecture shall be tested against alternatives, quality attributes, failure modes, migration constraints, and organizational capability. Existing architecture may be reused when it remains applicable and current; GAEP must not demand redesign merely because a new initiative exists.

Prototypes and research spikes may intentionally precede an architecture decision when their purpose is to reduce uncertainty. They shall be time-bounded, isolated from production authority, explicit about non-production status, and followed by a governed decision before production implementation.

## 9. Architecture as a Governed Engineering Asset

Architecture must not exist only inside conversation history, model memory, whiteboard sessions, individual knowledge, or generated code. Applicable initiatives shall create, reuse, or update repository-visible architecture assets at the level required for accountable implementation and change.

Architecture assets may include:

- architecture context and scope;
- high-level architecture;
- low-level architecture where complexity or risk requires it;
- client, service, data, integration, and deployment topology;
- trust boundaries and security architecture;
- identity and access model;
- key sequence, state, and interaction flows;
- quality-attribute scenarios;
- Architecture Decision Records (ADRs);
- implementation constraints, fitness functions, and approved exceptions.

Architecture documentation may use Markdown, Mermaid, C4-style representations, UML, ADRs, diagrams from approved tools, or another repository-supported format. Notation is contextual; GAEP support does not make one mandatory.

An external diagram may remain authoritative when GAEP records its identity, owner, version or snapshot, approval, and trace. Repository visibility does not require a Markdown copy.

Architecture assets shall be:

- owned and attributable;
- versioned and assigned lifecycle state;
- linked to initiative scope, requirements, decisions, risks, and implementation units;
- reviewed and challenged by relevant roles;
- explicitly approved where consequential;
- updated or superseded when relevant change occurs;
- validated for internal consistency and implementation conformance.

Architecture assets shall express necessary decisions and constraints. Narrative alone is insufficient when topology, trust, sequence, or ownership remains materially ambiguous.

## 10. Test-First and Assurance-by-Design

### 10.1 Foundational Obligation

Testing shall not be treated as a final verification activity added after implementation. Before implementation, GAEP shall resolve the initiative's **Assurance Strategy** to the depth required by scope and risk.

The Assurance Strategy shall determine:

- applicable test and assurance methodology;
- required test levels and **Test Evidence**;
- acceptance criteria and who owns them;
- whether test cases or executable specifications shall precede coding;
- whether business-readable scenarios use Gherkin or another representation;
- which tests are automated, manual, exploratory, simulated, or externally evidenced;
- coverage expectations and their risk rationale;
- security, authorization, privacy, resilience, performance, compatibility, migration, accessibility, and operational assurance needs;
- human review and approval required for readiness.

The selected methodology and representation shall be recorded as the **Test Methodology Decision** within the Assurance Strategy. It shall state applicability, rationale, scope, ownership, and the evidence the method is expected to produce.

No single methodology is universally mandatory. Example mapping, Gherkin, Behavior-Driven Development (BDD), Test-Driven Development (TDD), Acceptance Test-Driven Development (ATDD), and specification by example may all be valid. Their applicability depends on the kind of understanding and evidence required.

### 10.2 Dynamic Methodology Selection

GAEP shall ask which representation and method create useful shared understanding and reliable evidence.

- Gherkin may be appropriate for business-readable behavior shared across product, QA, and engineering roles.
- Unit-level TDD may be appropriate for domain logic with clear behavioral contracts.
- Consumer-driven contract tests may be required for independently released service integrations.
- Migration tests may be essential for schema evolution, data transformation, rollback, and reconciliation.
- Security and authorization tests may be mandatory for protected resources and privileged operations.
- UI automation may be valuable for critical user journeys and entirely inapplicable for backend-only work.
- Operational acceptance tests may be more important than UI tests for workers, batch processes, infrastructure, or deployment changes.

GAEP shall challenge weak testing decisions, including:

- relying only on unit tests for distributed workflows;
- defining a coverage percentage without risk-based interpretation;
- omitting negative, failure, boundary, authorization, and tenant-isolation scenarios;
- using Gherkin where it adds ceremony but no shared understanding;
- creating brittle end-to-end automation for behavior better verified at a lower level;
- treating manual approval as a replacement for repeatable automated evidence;
- generating tests from implementation alone and thereby reproducing the same misunderstanding.

### 10.3 Applicable Test and Assurance Levels

Depending on the initiative, the Assurance Strategy may require:

- unit tests;
- component tests;
- integration tests;
- consumer or provider contract tests;
- API tests;
- end-to-end tests;
- UI tests;
- security and threat-focused tests;
- authentication and authorization tests;
- performance, capacity, and scalability tests;
- resilience and failure-recovery tests;
- migration, rollback, and reconciliation tests;
- accessibility tests;
- compatibility and upgrade tests;
- operational acceptance, deployment, monitoring, or disaster-recovery tests.

The presence of a test type in GAEP does not make it applicable. Omission shall be based on the Assurance Strategy, not habit.

### 10.4 Traceable Assurance

Requirements, acceptance criteria, test cases, automated tests, coverage evidence, results, risk disposition, and human approval shall be traceable at the granularity required for impact analysis and readiness. These governed results and supporting records constitute **Test Evidence** for the claims and versions they verify.

Coverage shall be multidimensional. A percentage may be one signal, but it shall not be treated as proof of adequate assurance. GAEP should consider:

- critical behavior and business-rule coverage;
- risk and threat coverage;
- positive and negative scenario coverage;
- authorization, ownership, scope, and tenant-boundary coverage;
- contract and consumer coverage;
- failure-mode and recovery coverage;
- change and regression coverage;
- platform, environment, browser, device, or version compatibility where applicable;
- untested assumptions and accepted gaps.

Implementation readiness requires applicable acceptance conditions and test intent to be known before coding. Test details may evolve as implementation reveals information, but methodology and evidence obligations shall not be deferred by default until the end.

## 11. Authentication and Authorization

Security-by-design requires security obligations to be identified while scope, architecture, technology, data, interfaces, and assurance are being resolved—not appended after implementation. The depth shall be proportional to threat, sensitivity, exposure, and impact. Applicable work should address data classification, trust boundaries, threat and abuse cases, secure defaults, secrets, dependency and supply-chain risk, logging, recovery, and operational response.

Authentication and authorization shall always be explicitly assessed before implementation for every applicable implementation unit.

The assessment shall determine:

- whether authentication is required;
- identity source and lifecycle;
- trust boundary;
- human, service, workload, device, or machine identity;
- Single Sign-On (SSO) requirements;
- protocol and trust relationship;
- token, credential, certificate, session, or key type;
- validation, expiration, revocation, rotation, and failure behavior;
- service-to-service authentication;
- authorization model;
- roles, permissions, scopes, claims, and policies;
- tenant isolation and resource ownership;
- privileged operations and segregation of duties;
- audit, monitoring, and evidence requirements;
- secrets handling and external dependencies.

OAuth 2.0, OpenID Connect, SAML, mutual TLS, API keys, workload identity, Role-Based Access Control (RBAC), Attribute-Based Access Control (ABAC), policy-based authorization, and resource-based authorization are illustrative options. They are not universal defaults.

Even when authentication is not required, the assessment shall record **Not Applicable** with rationale when the decision is material. An internal process, public endpoint, local library, or infrastructure component may not authenticate end users, but it may still require workload identity, authorization at another boundary, integrity controls, or privileged-operation governance.

Authorization must not be treated as a frontend concern. User-interface controls may improve usability, but access shall be enforced at the authoritative backend, service, data, infrastructure, or resource boundary. GAEP shall challenge designs that rely on hidden buttons, client-side claims, route guards, or presentation logic as the only authorization control.

Authentication and authorization decisions shall be traceable to trust boundaries, architecture, data classification, requirements, threat analysis, test cases, implementation controls, audit evidence, and approval. Changes to identity source, token semantics, claims, roles, policies, tenancy, or resource ownership shall trigger re-evaluation of affected architecture and assurance.

## 12. Organizational Boilerplates

Boilerplates, starter kits, framework repositories, templates, reference implementations, and organizational code foundations are governed organizational assets. They may encode architecture, security, observability, quality, packaging, deployment, and operational decisions. GAEP shall not treat them as disposable scaffolding or silently replace them with AI-generated alternatives.

Before using a boilerplate, GAEP shall:

1. identify the implementation unit;
2. resolve applicable language, framework, and architecture;
3. request or locate the organization-approved boilerplate;
4. verify its suitability, authority, accessibility, support state, and compatibility;
5. record its repository, path, package, version, tag, commit, or artifact reference;
6. validate required capabilities and known limitations;
7. bind it as the implementation baseline.

GAEP shall distinguish:

- using an approved boilerplate unchanged;
- extending an approved boilerplate for an initiative;
- modifying the approved organizational boilerplate itself;
- generating initiative code from an approved boilerplate;
- creating a new official organizational boilerplate.

These actions have different ownership, scope, risk, consumer impact, and approval requirements.

If a mandatory boilerplate is absent, inaccessible, obsolete, incompatible, or unfit, AI shall stop or escalate. It must not invent a substitute and present it as official. AI may analyze gaps or draft an explicitly provisional candidate when authorized, but creating a new official organizational boilerplate requires explicit human authorization, governed review, reusable-asset validation, and an accountable owner.

Boilerplate reuse does not remove architecture or assurance obligations. GAEP shall verify that inherited decisions remain applicable and shall record approved deviations rather than silently modifying foundational behavior.

## 13. Continuous Human–AI Challenge

### 13.1 Challenge as an Engineering Practice

Human–AI challenge shall operate across consequential engineering stages, not only during architecture selection. The purpose is to expose ambiguity, alternatives, assumptions, consequences, and risk before they become expensive or unsafe.

Within its assigned role and context, an AI participant shall be able to:

- ask why a proposed outcome or constraint exists;
- identify ambiguity, contradiction, and missing information;
- challenge unsupported assumptions and context-free defaults;
- propose viable alternatives;
- compare trade-offs and downstream consequences;
- identify risk and failure modes;
- request evidence;
- recommend a better path;
- state when existing decisions remain suitable and no challenge is necessary.

The responsible human shall be able to:

- challenge the AI's sources, reasoning, confidence, or scope;
- reject a recommendation;
- request alternatives or deeper analysis;
- modify constraints;
- provide evidence or organizational context;
- approve, conditionally approve, defer, reject, or supersede a result.

Challenge may apply to initiative classification, requirements, personas, journeys, Figma applicability, architecture, service and client boundaries, technology, data storage, caching, brokers, identity, authorization, test methodology, scenarios, coverage, deployment, observability, security, implementation, release, and change impact.

AI shall not challenge a decision merely to appear intelligent. A challenge shall be relevant, evidence-based, proportionate to consequence, and grounded in the agent's assigned role and context. Repeated speculative objections without new evidence should not obstruct progress.

### 13.2 Role-Bounded Challenge

Each AI participant shall challenge from within its assigned responsibility:

- an **Architecture Agent** challenges topology, boundaries, coupling, quality attributes, and trade-offs;
- a **Security Agent** challenges identity, access, threat, data handling, secrets, and trust assumptions;
- a **Test or Assurance Agent** challenges scenarios, test levels, negative paths, coverage meaning, evidence, and readiness;
- a **Product Agent** challenges value, scope, users, outcomes, and acceptance criteria where product semantics apply;
- a **Runtime or Governance Agent** challenges unresolved state, authority, applicability, evidence, and stop conditions;
- an **Implementation Agent** challenges technical feasibility, existing-code constraints, maintainability, and implementation conformance.

An agent may identify a concern outside its role and route it to the responsible role. It must not silently override another role's accountable decision.

### 13.3 Challenge Records

Material challenges should be repository-visible or captured in a governed decision or review record. The record should include:

- subject and triggering context;
- challenging role;
- concern, evidence, and consequence;
- alternatives or requested clarification;
- responsible human or role;
- disposition: accepted, revised, rejected, deferred, or escalated;
- rationale and resulting trace or state change.

Routine questions need no durable record; consequential challenges affecting governed decisions, assets, risk, or readiness shall not disappear with chat history.

## 14. Contextual Engineering Patterns

Patterns are engineering responses to specific forces and failure modes. GAEP must not insert them mechanically or treat them as signs of architectural maturity.

> **Best practices are contextual engineering responses, not universal architectural decorations.**

Patterns such as Saga, Outbox, Inbox, idempotency, CQRS, Event Sourcing, Circuit Breaker, Retry, Timeout, Bulkhead, Dead Letter Queue, deduplication, Cache-Aside, distributed locking, transactional messaging, rate limiting, backpressure, health checks, and distributed tracing shall be selected only when concrete conditions justify them.

Pattern decisions should identify:

- the requirement, failure mode, consistency need, delivery semantic, scale characteristic, transaction boundary, topology, or operational risk that triggers consideration;
- alternatives, including a simpler design;
- assumptions and prerequisites;
- consequences, failure behavior, and operational burden;
- observability, testing, and recovery requirements;
- affected architecture and implementation units;
- decision owner and approval state.

Examples:

- Retry without timeout, idempotency, and failure classification may amplify incidents.
- An Outbox may be justified by a local transaction plus reliable event publication need; it is not mandatory for every service.
- CQRS may clarify materially different read and write models; it must not be introduced only because an application has queries and commands.
- Distributed locking may be an unsafe substitute for clarifying ownership or transaction boundaries.
- A message broker shall not be selected because event-driven systems are fashionable.

GAEP shall challenge both pattern omission and pattern overuse. The absence of a pattern is acceptable when its triggering problem does not exist or is addressed more simply.

## 15. Applicability and Proportional Governance

### 15.1 Applicability States

For every major phase, artifact, test method, architecture asset, design activity, security control, organizational asset, and approval, GAEP should be able to record one of the following states:

- **Required** — necessary before the relevant transition.
- **Recommended** — strong expected value; omission should be justified when material.
- **Optional** — permitted but not required for readiness.
- **Not Applicable** — does not apply to the initiative or implementation unit.
- **Deferred** — applicable but intentionally postponed under an approved condition.
- **Conditionally Required** — becomes required when a declared trigger occurs.
- **Already Satisfied** — fulfilled by a current approved asset or decision.
- **Reused** — fulfilled through an approved organizational or prior initiative asset with verified applicability.
- **Blocked** — required but cannot currently be completed.
- **Awaiting Human Decision** — applicability or disposition requires accountable judgment.

A Not Applicable decision shall include rationale when required for governance, future impact analysis, auditability, or avoidance of ambiguous absence. Deferred and Conditionally Required states shall identify owner, trigger, due condition, and consequence.

### 15.2 Risk-Proportionate Governance

Governance rigor shall be proportional to:

- business criticality;
- security and privacy sensitivity;
- regulatory or contractual exposure;
- data sensitivity and integrity needs;
- financial and reputational impact;
- architectural scope and blast radius;
- integration and dependency complexity;
- operational risk and recovery capability;
- irreversibility and migration cost;
- cost of failure and strength of existing evidence.

A minor internal change and a mission-critical identity, payment, safety, or data platform must not use identical governance depth.

Proportional governance may vary:

- number and specialization of reviewers;
- required architecture and assurance assets;
- independence and segregation of duties;
- test depth and evidence retention;
- security and threat analysis;
- rollout, rollback, monitoring, and operational acceptance;
- approval level and exception authority;
- frequency of re-evaluation.

Risk proportion does not remove human accountability, explicit state, or truthful evidence. Lightweight governance remains inspectable.

## 16. Repository-Native Traceability

Resolved engineering state shall be repository-visible and machine-consumable where appropriate. It shall not depend on access to a particular conversation, AI provider memory, meeting, or individual's recollection.

Applicable repository-visible state includes:

- initiative classification and Initiative Profile;
- lifecycle and applicability decisions;
- requirements and acceptance criteria;
- architecture context, decisions, diagrams, and constraints;
- per-component Technology Profiles;
- topology, data ownership, identity, authentication, and authorization decisions;
- Assurance Strategy, test cases, automation obligations, coverage expectations, and evidence;
- approved boilerplate bindings and deviations;
- contextual pattern decisions;
- accepted risks and rejected alternatives;
- challenges and dispositions;
- approvals, exceptions, unresolved questions, and implementation readiness.

External authoritative assets may remain in approved systems when GAEP records stable identity, version or snapshot, owner, status, classification, approval, and trace relationships.

GAEP should support trace relationships such as:

Initiative → applicability and requirements → architecture and Technology Profiles → security and Assurance Strategy → boilerplate and pattern decisions → implementation units and interfaces → test cases and automated evidence → approval, release, and operational outcomes.

An **Implementation Readiness** record should identify which obligations are satisfied, reused, not applicable, conditional, deferred, blocked, or awaiting decision. Readiness shall reference exact artifact and decision versions. It must not be inferred from the presence of a code repository or a successful AI generation run.

## 17. Change-Driven Re-evaluation

When an approved decision changes, GAEP shall evaluate more than the immediate implementation diff. The platform shall identify and re-evaluate affected:

- initiative scope and requirements;
- architecture context, topology, diagrams, and ADRs;
- service, module, client, and trust boundaries;
- interfaces, events, data ownership, consistency, and migrations;
- Technology Profiles and boilerplate bindings;
- authentication, authorization, tenancy, secrets, and audit behavior;
- acceptance criteria, test cases, automated tests, and coverage expectations;
- deployment, rollout, rollback, resilience, observability, and operational ownership;
- risk, exceptions, approvals, and documentation.

Re-evaluation depth shall be based on the changed decision and its trace graph. A text-only change need not reopen architecture. A token-claim change may reopen client, backend, authorization, tests, and operational monitoring. A database or broker change may affect topology, contracts, data migration, failure behavior, deployment, and assurance.

Architecture and assurance assets shall evolve with implementation. They must not become ceremonial snapshots produced once and ignored. When implementation reveals that an approved decision is infeasible or incorrect, the decision shall be challenged and changed through governance rather than contradicted silently in code.

Change impact shall include shared organizational assets. A modified boilerplate, template, policy, skill, or pattern may affect multiple initiatives and requires consumer discovery, compatibility analysis, migration, and versioned release.

## 18. Human Authority and Approval

AI may discover, classify, analyze, recommend, challenge, simulate, validate, and generate draft artifacts. AI must not silently finalize consequential architecture, security, technology, test adequacy, risk acceptance, readiness override, exception, or official boilerplate decisions when human approval is required.

Consequential outputs shall receive human review and an explicit decision. An **Explicit Approval** is an attributable human decision to approve or conditionally approve an exact subject and version within a stated scope; it is not a general expression of confidence. Possible decision states include:

- **Proposed**;
- **Challenged**;
- **Revised**;
- **Awaiting Review**;
- **Conditionally Approved**;
- **Approved**;
- **Rejected**;
- **Deferred**;
- **Superseded**;
- **Exception Granted**.

Approval shall identify the human decision owner, exercised role, exact subject and version, scope, evidence reviewed, conditions, accepted risk, effective time, and re-evaluation trigger. Approval must not be inferred from silence, file presence, a merge, a meeting, or an AI statement.

GAEP should automate preparation, validation, evidence collection, and low-risk execution while reserving accountable judgment for the appropriate human role. Governance shall avoid autonomous finalization and approval theater.

If a human rejects an AI recommendation, GAEP shall preserve the accountable decision and rationale where material. AI may request clarification or surface consequences, but it shall not repeatedly relitigate an approved decision without new evidence, changed context, or an explicit review trigger.

## 19. Anti-Patterns

The following behaviors conflict with adaptive engineering:

- forcing Figma or visual-design activities into backend-only, headless, infrastructure, migration, or library work;
- assuming every Engineering Initiative is a Product;
- assuming every initiative has personas, user journeys, frontend, backend, database, cache, or broker;
- assuming one language, framework, storage technology, or deployment model for the entire initiative;
- using enterprise defaults without checking component fitness and applicability;
- generating implementation before applicable architecture is resolved;
- allowing code generation to decide service, client, data, identity, trust, or deployment boundaries implicitly;
- generating an unofficial boilerplate when an organization-approved boilerplate is required;
- silently substituting, modifying, or forking an official boilerplate;
- implementing before applicable test methodology, acceptance conditions, test levels, and evidence expectations are known;
- defining test adequacy only as a code-coverage percentage;
- omitting negative, failure, boundary, authorization, tenant-isolation, and privileged-operation test cases;
- assuming authentication is automatically handled by infrastructure without an explicit trust and validation decision;
- enforcing authorization only in the UI or client;
- treating authentication and authorization as Not Applicable without assessment and rationale;
- producing architecture diagrams once and never updating or superseding them;
- keeping architecture only in chats, presentations, or individual memory;
- silently accepting AI architecture output without role-appropriate human review;
- selecting Kafka, RabbitMQ, Redis, MongoDB, microservices, or any technology because it is fashionable rather than required;
- applying Saga, Outbox, CQRS, Event Sourcing, retries, distributed locks, or other distributed-system patterns everywhere;
- treating best practice as context-free;
- treating a pattern list as architecture;
- treating AI as final authority for architecture, security, assurance, risk, readiness, or official organizational assets;
- approving by silence, merge, file creation, or absence of objection;
- using the same governance depth for a reversible internal fix and a high-impact identity or payment capability;
- leaving Not Applicable, Deferred, Reused, or Already Satisfied decisions undocumented when the absence would be ambiguous;
- updating code after a decision change without re-evaluating affected architecture, assurance, security, operations, and approvals;
- challenging decisions performatively without evidence, relevance, or role authority.

## 20. Relationship to Other GAEP Documents

This document is subordinate to and shall be interpreted with the [GAEP Constitution](001_GAEP_CONSTITUTION.md). It extends the [Project Vision](002_PROJECT_VISION.md), [Platform Philosophy](003_PLATFORM_PHILOSOPHY.md), [Core Principles](004_CORE_PRINCIPLES.md), and [Design Principles](005_DESIGN_PRINCIPLES.md) by making initiative neutrality and conditional applicability explicit.

It should guide revision and interpretation of:

- [Read First](../000_READ_FIRST.md) — navigation shall describe Engineering Initiatives, not only products.
- [Platform Architecture](../02_Platform/010_PLATFORM_ARCHITECTURE.md) — platform boundaries shall remain initiative-, technology-, and architecture-neutral.
- [Context Engineering](../02_Platform/012_CONTEXT_ENGINEERING.md) — context selection shall include initiative type, applicability, profiles, and risk.
- [Governance Model](../02_Platform/013_GOVERNANCE_MODEL.md) — governance shall be applicability-aware and risk-proportionate.
- [Command Model](../02_Platform/014_COMMAND_MODEL.md) and [Skill Model](../02_Platform/015_SKILL_MODEL.md) — commands and skills shall declare initiative and lifecycle applicability.
- [Agent Model](../02_Platform/016_AGENT_MODEL.md) — challenge shall be continuous and role-bounded.
- [Runtime Model](../02_Platform/017_RUNTIME_MODEL.md) and [State Model](../02_Platform/018_STATE_MODEL.md) — runtime state shall represent applicability, profiles, readiness, and decision conditions.
- [Package Strategy](../03_Product_Engineering/020_PACKAGE_STRATEGY.md) and [Product Lifecycle](../03_Product_Engineering/021_PRODUCT_LIFECYCLE.md) — product packages remain valid profiles but must not become universal initiative requirements.
- [Artifact Lifecycle](../03_Product_Engineering/022_ARTIFACT_LIFECYCLE.md), [Change Management](../03_Product_Engineering/023_CHANGE_MANAGEMENT.md), [Traceability Model](../03_Product_Engineering/024_TRACEABILITY_MODEL.md), and [Human Approval Model](../03_Product_Engineering/025_HUMAN_APPROVAL_MODEL.md) — initiative decisions, architecture, assurance, and approvals shall remain governed and change-aware.
- [Repository Structure](../04_Repository/030_REPOSITORY_STRUCTURE.md), [Knowledge Model](../04_Repository/032_KNOWLEDGE_MODEL.md), [Artifact Model](../04_Repository/033_ARTIFACT_MODEL.md), and [Metadata Model](../04_Repository/034_METADATA_MODEL.md) — repository semantics shall support Engineering Initiatives and applicability states.
- [Agent Execution Flow](../05_AI_Runtime/042_AGENT_EXECUTION_FLOW.md), [Context Loading](../05_AI_Runtime/043_CONTEXT_LOADING.md), [Decision Model](../05_AI_Runtime/044_DECISION_MODEL.md), and [Stop Conditions](../05_AI_Runtime/045_STOP_CONDITIONS.md) — execution shall stop when applicable architecture, security, assurance, boilerplate, or approval obligations are unresolved.

Where an existing document assumes every initiative is a Product, every lifecycle phase is mandatory, Figma is universal, one technology stack applies globally, or one assurance method is required, this foundational document requires that assumption to be corrected through controlled change.

## 21. Foundational Rule

GAEP shall govern the engineering work that actually exists, not force the work to resemble a predefined product, architecture, technology stack, design process, or test methodology.

For every Engineering Initiative, GAEP shall:

1. classify the initiative and its risk;
2. establish applicability explicitly;
3. resolve the architecture, Technology Profiles, security model, Assurance Strategy, and organizational asset bindings required before implementation;
4. preserve consequential decisions and state in repository-visible, traceable form;
5. enable relevant, role-bounded Human–AI challenge;
6. require explicit human authority for consequential outcomes;
7. re-evaluate affected assets when approved decisions change.

No phase, artifact, tool, method, pattern, technology, or approval is universal merely because GAEP supports it. No applicable obligation may be omitted merely because adaptive execution is permitted.

Adaptive engineering is the governed selection of necessary engineering rigor: no more than the initiative needs, and no less than its consequences require.
