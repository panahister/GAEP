# Glossary

**Governed AI Engineering Platform (GAEP)**  
**Document ID:** GAEP-REF-991  
**Version:** 1.0  
**Status:** Draft  
**Authority:** Shared conceptual definitions

## Purpose

This glossary defines GAEP's shared language. Initiative- and Product-specific glossaries may refine domain terms within declared bounded contexts but must not silently redefine platform concepts.

## Terms

| Term | Definition |
|---|---|
| Accountable Owner | Human role ultimately answerable for a decision, artifact, outcome, or risk. Execution may be delegated; accountability is not. |
| Actor | Human, organization, system, or agent interacting with an Engineering Initiative, system, Product, or process. |
| Adapter | Replaceable integration that translates an external tool or provider into GAEP contracts. |
| Agent | Bounded reasoning and execution participant that operates with scoped context, tools, role, and authority. |
| AI-Assisted | Created or changed through material human and AI contribution. |
| AI-Generated | Initially produced primarily by an AI run; does not imply correctness or approval. |
| Approval | Attributable, scoped authorization by a qualified human role for an exact subject and version. |
| Architecture Decision | Significant choice affecting boundaries, contracts, quality attributes, technology, or long-term structure. |
| Artifact | Governed, identifiable unit of durable engineering knowledge or evidence. |
| Artifact Set | Version-pinned group of artifacts reviewed or baselined as a coherent whole. |
| Assumption | Unverified proposition temporarily accepted for progress, with owner and validation need. |
| Authority | Legitimate right of a role or source to govern a defined scope. |
| Authority Class | Governing, authoritative, provisional, evidence, external reference, or generated-working classification of knowledge. |
| Baseline | Approved artifact version designated as the current authoritative source for downstream work. |
| Blocked | State in which safe progress requires missing context, dependency, authority, evidence, or decision. |
| Bounded Context | Explicit boundary within which a domain model and language are consistent. |
| Business Architecture | Model of business capabilities, value streams, outcomes, context, actors, policies, and ownership. |
| Business Capability | Durable ability an organization needs to achieve an outcome, independent of a specific process or system. |
| Change | Governed proposal and execution record for modifying a baseline or external state. |
| Classification | Handling category such as public, internal, confidential, or restricted. |
| Command | Versioned, governed contract expressing user or system intent. |
| Condition | Obligation attached to an approval or permission that must be tracked and verified. |
| Constitution | Highest-level GAEP laws that lower-level designs and actions may not silently override. |
| Context | Selected knowledge and constraints relevant to an objective. |
| Context Contract | Command or skill declaration of required, optional, and prohibited context. |
| Context Engineering | Practice of selecting, validating, structuring, and delivering trusted context for a task. |
| Context Manifest | Reproducible record of context sources, versions, selection reasons, warnings, and security constraints. |
| Context Pack | Manifest plus bounded referenced or embedded context assembled for a declared objective. |
| Controlled Change | Change that follows intent, impact analysis, review, approval, validation, and trace updates. |
| Decision | Accountable selection among alternatives that constrains or directs future work. |
| Decision Owner | Human role authorized and accountable to make a defined decision. |
| Derived View | Reproducible presentation or query assembled from authoritative sources. |
| Domain | Coherent area of business or product knowledge and responsibility. |
| Domain Event | Meaningful fact that occurred within a domain boundary. |
| Evidence | Observable result, review, test, measurement, or record supporting or contradicting a claim. |
| Exception | Approved, scoped, time-bounded variation from an applicable rule with compensating controls. |
| External Artifact | Artifact whose authoritative content lives in another governed system. |
| Gate | Governed checkpoint evaluating readiness for a lifecycle or state transition. |
| Governed | Subject to explicit policy, state, authority, provenance, and evidence rules. |
| GAEP | Governed AI Engineering Platform. |
| Human-in-the-Loop | Workflow in which human judgment or approval is intentionally required at defined points. |
| Hypothesis | Testable expectation connecting an action or product change to an outcome. |
| Impact Analysis | Identification and evaluation of entities, outcomes, risks, and obligations affected by a proposed change. |
| Integration Event | Published event contract intended for communication across bounded contexts or system boundaries. |
| Knowledge Graph | Governed entities and typed semantic relationships that enable navigation and impact analysis. |
| Lifecycle | Governed progression and evolution of an Engineering Initiative, Product, artifact, change, or run through explicit states. |
| Lifecycle Profile | Tailored set of stages, criteria, evidence, and approvals for an initiative type, scope, and risk context. |
| Model | Structured representation of a subject. Qualify as domain model, data model, AI model, or another specific type. |
| Non-Goal | Explicit outcome or responsibility intentionally outside current scope. |
| Organizational Memory | Durable approved knowledge reusable across people, tools, sessions, and Engineering Initiatives. |
| Package | Versioned reusable bundle of lifecycle outcome, methods, artifacts, controls, and evidence. |
| Pattern | Reusable solution guidance with context, applicability, trade-offs, and evidence. |
| Policy | Rule that permits, denies, constrains, or obligates behavior. |
| Product Architecture | Logical product structure of domains, modules, responsibilities, actors, roles, access, boundaries, and quality attributes. |
| Product Workspace | Governed boundary containing or referencing one product's knowledge, state, changes, evidence, and integrations. |
| Promotion | Movement of provisional information or artifact into a more authoritative lifecycle state through validation and approval. |
| Provenance | Record of origin, contributors, transformations, context, and generation or import path. |
| Recommendation | Proposed option with rationale; not an accountable decision. |
| Repository | Durable engineering and organizational memory, not only a source-code container. |
| Review | Evaluation of a subject against explicit criteria, producing findings and a disposition recommendation. |
| Risk | Uncertain event or condition with potential impact, likelihood, owner, and treatment. |
| Run | Auditable instance of a command executed through runtime steps. |
| Runtime | Vendor-neutral orchestration and control environment for commands, context, agents, tools, approvals, and evidence. |
| Skill | Versioned reusable method that transforms context and inputs into typed outputs or evaluation. |
| Source of Truth | Authoritative current representation of a governed fact or decision within a declared scope. |
| State | Explicit current condition of a governed entity within a state dimension. |
| Stop Condition | Rule requiring denial, pause, block, replan, rollback, or termination. |
| Superseded | No longer current because another identified version or artifact replaced it. |
| Tailoring | Explicit adaptation of a package, lifecycle, policy, or template to initiative context. |
| Tool | Executable capability available to an agent or runtime; tools do not grant authority. |
| Trace Link | Typed semantic relationship between governed entities. |
| Traceability | Ability to navigate origin, realization, verification, change, and outcome relationships. |
| Ubiquitous Language | Shared domain language used consistently within a bounded context. |
| Validator | Deterministic or evaluative capability that checks an explicit contract or criterion. |
| Value Stream | Sequence of value-creating stages that delivers an outcome to a stakeholder. |
| Vendor Neutrality | Independence of core semantics from a replaceable vendor, model, IDE, cloud, or framework. |
| Working Data | Temporary generated or run-scoped information not yet promoted into governed knowledge. |

## Adaptive Engineering Terms

| Term | Definition |
|---|---|
| Engineering Initiative | GAEP's generic unit of governed engineering work. A Product is one valid initiative type. |
| Initiative Profile | Versioned record of initiative classification, scope, ownership, criticality, lifecycle posture, dependencies, and unresolved questions. |
| Initiative Classification | Multi-dimensional classification of initiative types and characteristics used to select applicable engineering work. |
| Applicability Engine | Logical capability that evaluates which phases, artifacts, activities, commands, skills, tests, and approvals apply. |
| Applicability Decision | Governed, attributable decision assigning applicability status, rationale, source, owner, dependencies, and review trigger to a subject. |
| Human–AI Challenge | Role-bounded, evidence-based dialogue in which humans and AI question assumptions, compare alternatives, and expose consequences before a consequential decision. |
| Challenge Record | Durable record of a material Human–AI challenge, evidence, alternatives, response, disposition, unresolved items, and review trigger. |
| Architecture Asset | Versioned repository-visible architecture context, decision, model, diagram, contract, HLD, LLD, or constraint. |
| High-Level Design (HLD) | Architecture view of major boundaries, responsibilities, clients, services, data, integrations, deployment, trust, and quality attributes; its approval state is recorded separately. |
| Low-Level Design (LLD) | Implementation-guiding design of components, interfaces, sequences, states, contracts, transactions, failures, security enforcement, and observability; its approval state is recorded separately. |
| Living Architecture | Architecture maintained as current, versioned engineering state and re-evaluated when relevant decisions or implementation change. |
| Architecture Regeneration Trigger | Event or changed source that requires impact assessment and possible revision, regeneration, review, and reapproval of Architecture Assets. |
| Client Technology Profile | Approved per-client record of delivery, rendering, language, framework, runtime, identity, dependencies, deployment, assurance, and ownership decisions. |
| Service Technology Profile | Approved per-service or module record of responsibility, runtime, interfaces, data, identity, deployment, assurance, and ownership decisions. |
| Technology Option Registry | Governed catalog of supported, preferred, experimental, prohibited, or exceptional technology options, versions, owners, fitness, and risks. |
| Organizational Boilerplate | Governed organizational starter, template, foundation, or reference implementation with ownership, version, applicability, and evidence of fitness. |
| Boilerplate Binding | Version-specific association between an implementation unit, its Technology Profile, and an approved Organizational Boilerplate. |
| Assurance Profile | Approved execution contract defining applicable methodology, Test Cases, levels, automation, environments, data, coverage, evidence, gates, and approval for a scope. |
| Test Methodology Decision | Governed selection and rationale for the testing methods and representations appropriate to a defined scope. |
| Gherkin Applicability Decision | Explicit decision establishing whether Gherkin is Required, Recommended, Optional, Not Applicable, or otherwise governed for a scope. |
| Test Case | Versioned specification of preconditions, stimulus, expected behavior, and expected evidence linked to an assurance subject. |
| Test Evidence | Attributable result, report, observation, review, measurement, or approval supporting or refuting an Assurance Claim for exact versions and context. |
| Coverage Target | Approved multidimensional criterion defining which requirements, behaviors, branches, contracts, risks, authorization rules, failures, platforms, or signals require evidence. |
| Quality Gate | Versioned decision contract evaluating applicable criteria and Test Evidence before implementation, merge, release, deployment, or operation. |
| Authentication Profile | Approved identity-establishment and credential-validation model for a defined boundary. |
| Authorization Model | Repository-visible definition of subjects, resources, actions, context, roles, permissions, scopes, claims, ownership, policies, enforcement, and deny behavior. |
| Identity and Access Decision | Accountable choice resolving identity types, trust, authentication, authorization, enforcement, audit, and failure behavior. |
| Implementation Readiness Gate | Applicability-driven evaluation that determines whether exact initiative scope may enter implementation. |
| Change Impact Record | Versioned result identifying changed sources, affected decisions and assets, freshness, required regeneration, assurance, approvals, and readiness effects. |
| Risk-Proportionate Governance | Governance rigor scaled to criticality, sensitivity, regulation, blast radius, operational risk, irreversibility, and cost of failure. |

## Glossary Governance

New or changed platform terms require:

- proposed definition and examples;
- conflicts and aliases;
- scope and owning domain;
- affected schemas, documents, commands, and artifacts;
- terminology review;
- versioned update and migration when machine values change.

Initiative and Product glossaries may add localized labels and domain definitions. When the same word has different meanings, qualify it by bounded context.

## Design Implications

This glossary directly supports:

- [Terminology](992_TERMINOLOGY.md)
- [Knowledge Model](../04_Repository/032_KNOWLEDGE_MODEL.md)
- [Metadata Model](../04_Repository/034_METADATA_MODEL.md)
- [Naming Conventions](../04_Repository/035_NAMING_CONVENTIONS.md)
- [Adaptive Engineering Principles](../01_Foundation/006_ADAPTIVE_ENGINEERING_PRINCIPLES.md)
- [Dynamic Engineering Model](../02_Platform/019_DYNAMIC_ENGINEERING_MODEL.md)
- [Engineering Assurance and Architecture Model](../02_Platform/020_ENGINEERING_ASSURANCE_AND_ARCHITECTURE_MODEL.md)
