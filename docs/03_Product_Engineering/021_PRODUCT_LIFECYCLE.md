# Product Lifecycle

**Governed AI Engineering Platform (GAEP)**  
**Document ID:** GAEP-PEN-021  
**Version:** 1.0  
**Status:** Draft  
**Authority:** End-to-end product-engineering lifecycle

## Purpose

This document defines GAEP's lifecycle profile for Engineering Initiatives classified as Products. It describes a proven sequence from business understanding through architecture, applicable experience and backlog work, implementation, assurance, release, operations, and learning. It is not the universal lifecycle for every Engineering Initiative.

The broader Engineering Initiative lifecycle is dynamically resolved through the [Dynamic Engineering Model](../02_Platform/019_DYNAMIC_ENGINEERING_MODEL.md). Stages in this Product profile may be Required, Recommended, Optional, Not Applicable, Deferred, Already Satisfied, Reused, Blocked, or Awaiting Human Decision. Product classification does not make every stage mandatory.

## Lifecycle Philosophy

The lifecycle is:

- outcome-driven rather than document-driven;
- iterative rather than strictly linear;
- governed by explicit readiness and approval;
- traceable from intent to operational evidence;
- compatible with agile, TDD, DDD, AI-DLC, hybrid, and other execution methods;
- independent of a particular AI tool;
- tailorable according to product risk and maturity.

Downstream discovery may change upstream understanding. Such change is expected but must be analyzed and baselined deliberately.

## Continuous Operating Loop

Every stage applies:

**Understand → Analyze → Design → Review → Approve → Baseline → Trace → Evolve**

AI may assist every step. Human accountability remains at decisions and approvals.

## Stage 0 — Initiation

### Objective

Establish that a product opportunity or need exists and assign accountable ownership.

### Key questions

- What triggered this initiative?
- Who owns the business outcome and product decision?
- What constraints or deadlines already exist?
- What discovery investment is justified?

### Minimum outputs

- initiative statement;
- sponsor and product owner;
- initial outcome hypothesis;
- known constraints and risks;
- discovery authorization.

### Exit criteria

Ownership exists, discovery scope is bounded, and no known prohibition prevents exploration.

## Stage 1 — Product Discovery and Foundation

This stage is conditional. It is Required when product intent, users, outcomes, scope, or market and business evidence must be discovered; it may be reduced, reused, already satisfied, or Not Applicable for a bounded change with approved product context.

### Objective

Build a trusted profile of the business and product before architecture begins.

### Activities

- define problem, opportunity, objectives, and success measures;
- identify stakeholders, users, actors, and affected systems;
- define scope and explicit non-scope;
- establish glossary and ubiquitous language candidates;
- capture assumptions, constraints, dependencies, risks, and open questions;
- study relevant existing products, processes, data, and regulations;
- select lifecycle and governance profile.

### Core artifacts

- product charter or profile;
- scope and non-scope;
- stakeholder map;
- glossary;
- assumption and risk registers;
- outcome and measurement model;
- discovery evidence.

### Exit criteria

The problem, intended value, boundaries, vocabulary, ownership, and major unknowns are sufficiently understood to model the business.

## Stage 2 — Business Architecture

### Objective

Define what the business needs to be able to do and how value is created.

### Activities

- capability mapping;
- value-stream and outcome modeling;
- business-context and ecosystem mapping;
- actor and organizational responsibility analysis;
- policy and business-rule discovery;
- business-event and information concept discovery;
- capability gap and priority assessment.

### Core artifacts

- capability map;
- value streams;
- business context diagram;
- outcome and KPI mapping;
- business actor and responsibility model;
- initial policy/rule catalog;
- capability-to-objective trace.

### Exit criteria

Business outcomes, capabilities, context, and ownership are coherent enough to structure the product.

## Stage 3 — Product Architecture

### Objective

Define the product's logical structure independently from implementation technology.

### Activities

- identify domains and subdomains;
- define product modules and responsibilities;
- identify actors, roles, permissions, and authorization principles;
- establish product boundaries and external dependencies;
- capture cross-cutting quality attributes;
- identify ownership and candidate bounded contexts;
- challenge coupling, duplication, and unclear responsibility.

### Core artifacts

- product/domain map;
- module and responsibility model;
- actor-role-permission matrix;
- authorization model;
- quality-attribute scenarios;
- product context and integration boundaries;
- architecture decisions and unresolved questions.

### Exit criteria

The product has intentional responsibilities, boundaries, actor access, and quality priorities before detailed behavior is modeled.

## Stage 4 — Process, Data, Rule, and Event Architecture

### Objective

Describe product behavior and information semantics consistently across domains.

### Activities

- model current and target processes;
- define decisions, business rules, exceptions, and state transitions;
- build conceptual data and terminology models;
- map data ownership and flow;
- identify domain events, integration events, commands, and policies;
- refine bounded contexts using DDD;
- identify external interfaces and consistency needs;
- validate privacy, security, and retention implications.

### Core artifacts

- process models;
- rule and decision catalog;
- conceptual data model;
- event catalog with domain/integration classification;
- data-flow and ownership model;
- context map;
- state models and integration interactions.

### Exit criteria

Processes, information, rules, events, ownership, and context boundaries are mutually consistent and traceable.

## Stage 5 — Experience Design

### Objective

Translate product intent and behavior into accessible, coherent user and service experiences.

### Activities

- persona and user-segment refinement;
- journey and service-blueprint design;
- task flow and information architecture;
- UX requirements and content design;
- design-system definition or reuse;
- low-fidelity wireframes;
- high-fidelity design and interactive prototypes;
- usability, accessibility, consistency, and feasibility review;
- trace design decisions to processes, rules, and roles.

### Core artifacts

- personas and journey maps;
- UX flows and information architecture;
- design-system tokens and components;
- wireframes and prototypes;
- accessibility requirements;
- UX decision and validation evidence;
- design-to-domain and design-to-process mappings.

### Figma working model

Figma may be used as the design source for visual artifacts only when the Applicability Decision selects it. A visual Product may use another approved design method, and a backend-only or non-visual slice may mark Figma Not Applicable. AI may assist generation, but the repository should retain authoritative links, versions, decisions, tokens, component mappings, and exported evidence needed for traceability. A Figma file alone is not sufficient Product context.

### Exit criteria

Priority journeys and states are validated, consistent with product behavior, accessible, and sufficiently complete for backlog engineering.

## Stage 6 — Backlog Engineering

### Objective

Create implementable, testable, traceable increments from approved product and experience intent.

### Activities

- define outcomes, epics, capabilities/features, and stories;
- map backlog items to journeys, processes, domains, and objectives;
- write acceptance criteria and example scenarios;
- include authorization, data, event, failure, accessibility, and non-functional needs;
- identify dependencies and slicing strategy;
- prepare test cases early enough to support TDD and risk analysis;
- prioritize by value, risk, learning, and dependency.

### Core artifacts

- backlog hierarchy;
- story and acceptance-criteria set;
- backlog trace matrix;
- dependency and release slices;
- initial test scenarios;
- definition-of-ready evidence.

### Exit criteria

The selected slice is valuable, appropriately small, architecturally coherent, testable, and traceable to approved intent and design.

## Stage 7 — Solution Architecture

### Objective

Translate product architecture into implementation-ready architecture without allowing code generation to make foundational choices implicitly.

### Activities

- confirm bounded contexts and ownership;
- define application/service/module responsibilities;
- define APIs, events, and data contracts;
- select architecture patterns and quality tactics;
- map security, authorization, error, observability, and consistency behavior;
- define frontend/backend integration contracts;
- evaluate build versus reuse and boilerplate fit;
- define architecture tests and fitness functions;
- review risks, trade-offs, and deployment constraints.

### Core artifacts

- solution architecture;
- context/container/component views as needed;
- API and event contracts;
- data ownership and persistence decisions;
- architecture decision records;
- quality-attribute and threat analyses;
- implementation guardrails and boilerplate mapping.

### Exit criteria

The architecture authority approves the selected slice and implementation can proceed without unresolved high-impact decisions.

## Stage 8 — Implementation Engineering

### Objective

Build the approved slices with small changes, tests, reviews, and evidence.

### Activities

- initialize from approved boilerplates and standards;
- implement domain behavior and contracts incrementally;
- use TDD where practical and risk-appropriate;
- create tests selected by the approved Assurance Profile and Test Methodology Decision;
- perform code review, impact review, and architecture conformance checks;
- maintain API collections, test data, seeds, and developer documentation;
- update trace links and decisions as implementation reveals new facts;
- prevent generated code from bypassing review.

### Backend considerations

GAEP may support .NET or other stacks through technology profiles. DDD boundaries, contracts, behaviors, tests, and architecture evidence remain platform concerns; framework-specific boilerplates remain replaceable assets.

### Frontend considerations

GAEP may support Next.js or other stacks through profiles. Design-system tokens, components, states, accessibility, API contracts, and UX traceability remain authoritative regardless of framework.

### Exit criteria

The slice is implemented, reviewed, traceable, and ready for integrated verification with no concealed architecture deviation.

## Stage 9 — Verification and Acceptance

### Objective

Build evidence-based confidence that the product satisfies intent, architecture, quality, security, and experience criteria.

### Activities

- execute unit, integration, contract, system, and acceptance tests;
- validate security, privacy, performance, accessibility, and resilience as applicable;
- review architecture conformance and technical debt;
- verify data migration, seed, and operational scenarios;
- confirm requirement and trace coverage;
- resolve findings and residual risks;
- obtain business and product acceptance.

### Exit criteria

Required evidence is valid and accepted; residual risks have accountable disposition; release readiness can be evaluated.

## Stage 10 — Release and Transition

### Objective

Move an approved product version into its target environment safely and transparently.

### Activities

- prepare release manifest and notes;
- verify configuration, migrations, API collections, seed data, and runbooks;
- validate deployment and rollback plans;
- obtain release, security, and operational approvals;
- execute release under change control;
- perform post-deployment verification;
- communicate status and known limitations.

### Exit criteria

The release is verified, operational ownership is accepted, and evidence and trace records are complete.

## Stage 11 — Operations and Learning

### Objective

Operate the product, learn from real outcomes, and feed validated knowledge back into the lifecycle.

### Activities

- monitor service levels, product outcomes, errors, and user feedback;
- manage incidents, vulnerabilities, and operational changes;
- compare observed outcomes with hypotheses and KPIs;
- update risks, debt, knowledge, patterns, and reusable assets;
- initiate governed evolution or retirement.

### Exit criteria

Operations is continuous. A product version may be superseded or retired when obligations and learning are captured.

## Lifecycle Tailoring

Profiles may be:

- **Lightweight:** low-risk internal experiment with fewer formal artifacts.
- **Standard:** typical product with normal governance and evidence.
- **Enterprise:** cross-team or business-critical product with stronger architecture and integration governance.
- **Regulated:** additional data, compliance, validation, segregation, and retention controls.

Tailoring changes depth, not foundational accountability and trace semantics.

## Relationship to Other Initiative Lifecycles

Defects, refactorings, libraries, services, infrastructure, security remediation, migrations, and other non-Product initiatives may use reduced or specialized paths. They shall not be forced through Product Discovery, personas, backlog decomposition, experience design, Figma, or release stages that are not applicable. Architecture, authentication, authorization, security, Test Cases, evidence, and approval depth remain driven by scope, risk, policy, and engineering necessity.

Implementation may begin only after applicable architecture, Technology Profiles, Organizational Boilerplate bindings, acceptance criteria, Assurance Profiles, Test Cases, and explicit approvals are current. Detailed HLD, LLD, Quality Gate, and living-architecture behavior is governed by [020](../02_Platform/020_ENGINEERING_ASSURANCE_AND_ARCHITECTURE_MODEL.md).

## Lifecycle Metrics

- time to trusted product context;
- readiness-gate lead time;
- upstream/downstream trace coverage;
- requirement and acceptance volatility after implementation begins;
- architecture deviation rate;
- review and approval rework;
- defect escape and rollback rate;
- reuse rate and local divergence;
- outcome achievement and learning cycle time.

## Design Implications

This lifecycle directly governs:

- [Package Strategy](020_PACKAGE_STRATEGY.md)
- [Artifact Lifecycle](022_ARTIFACT_LIFECYCLE.md)
- [Change Management](023_CHANGE_MANAGEMENT.md)
- [Traceability Model](024_TRACEABILITY_MODEL.md)
- [Human Approval Model](025_HUMAN_APPROVAL_MODEL.md)
- [State Model](../02_Platform/018_STATE_MODEL.md)
