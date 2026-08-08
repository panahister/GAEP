---
id: GAEP-STR-004
title: Evidence-Governed Market Category, Benchmark, and Positioning
document_type: product-strategy
schema_version: 1.0
version: 0.3.0
status: proposed
owner_role: GAEP Product Owner
scope: P02 market category, competitive benchmark, executive claims, and adoption decision support
normative_level: informative
classification: internal
provenance: Deterministically generated from GAEP-REG-013 version 0.1.0
approval:
  state: not-approved
  approved_by: []
  approved_at: null
normative_dependencies:
  - GAEP-CST-001
  - GAEP-CST-003
  - GAEP-REG-003
  - GAEP-REG-011
  - GAEP-REG-012
informative_references:
  - ../99_Registries_and_References/013_MARKET_EVIDENCE_AND_BENCHMARK_REGISTRY.json
  - ../../99_References/993_EXTERNAL_PROJECTS.md
supersedes: []
---

# Evidence-Governed Market Category, Benchmark, and Positioning

> **Authority boundary:** Proposed, internal decision support. No category, benchmark, claim, purchase, publication, Product Owner acceptance, or release is approved. This projection does not make GAEP enterprise-ready, production-ready, secure, compliant, superior, complete, end-to-end, or proven.

Generated from **GAEP-REG-013 v0.1.0**, research snapshot **2026-08-08**, registry SHA-256 `c18f698e613f9947c5157fd0f108c069e1276658765732975f39bbee90ba3449`. Edit the registry and rerun `npm run render:market-benchmark`; do not edit generated market assertions here.

## 1. Market/category definition

GAEP is being evaluated as a **composite governed Product-to-Operations decision and evidence system**, not as one undifferentiated substitute for every specialized lifecycle tool. The category remains a hypothesis pending comprehension and outcome research.

| Category | Definition | Includes | Excludes |
| --- | --- | --- | --- |
| Governed Product-to-Operations decision and evidence system | Maintains governed Product and Initiative truth, human authority, traceability, and lifecycle evidence across Product-to-Operations decisions. | Cross-lifecycle traceability; Governed Product and Initiative records; Human decision separation | A business transaction system; Coding assistance alone |
| Specification-driven development toolkit or IDE | Structures requirements, design, tasks, and implementation around versioned specifications. | Coding-agent integration; Specification artifacts drive implementation | BDD testing framework alone; General requirements database without implementation workflow |
| AI coding and engineering agent | Reads or changes code and executes bounded engineering tasks through an agentic interface. | Agentic code or repository work; Documented user review surface | General-purpose chat without engineering tools |
| Repository-native DevSecOps platform | Combines repository, planning, CI/CD, security, and delivery controls around software repositories. | Administrative controls; Delivery automation; Source repository | Enterprise architecture repository; Standalone coding assistant |
| Product discovery and requirements platform | Captures product intent, evidence, priorities, requirements, and roadmaps before or alongside delivery. | Prioritization or roadmap; Product intent or requirements | Code-only tool |
| Enterprise architecture and transformation platform | Maintains connected business, application, technology, and transformation architecture information. | Architecture repository; Business-to-technology relationships | Diagram editor without governed repository |
| Engineering or application lifecycle management platform | Connects requirements, changes, tests, configurations, and evidence across complex engineering lifecycles. | Lifecycle configuration or workflow; Requirements and test traceability | Product discovery only |
| Product design and developer handoff platform | Supports collaborative product design, design systems, prototypes, and implementation handoff. | Developer handoff; Product design artifacts | Full engineering governance without design capability |
| Enterprise business application | Runs operational business processes rather than governing how software products are conceived and engineered. | Operational business processes | Software engineering governance classification |

### Ambiguous Product Owner search seeds

| Seed | Resolution | Selected identity | Reason | Evidence |
| --- | --- | --- | --- | --- |
| AWS AI-DLC | methodology-framework | AWS AI-Driven Development Life Cycle | AWS explicitly calls AI-DLC a methodology. It is not placed in the Product registry; any canonical methodology adoption requires a future GAEP-REG-011 revision. | [GAEP-EVD-001](https://aws.amazon.com/blogs/devops/ai-driven-development-life-cycle/) |
| Spec Flow | resolved-project | GitHub Spec Kit | The seed is lexically ambiguous. The current spec-driven project selected for product/project comparison is GitHub Spec Kit; the separate .NET BDD project SpecFlow is discontinued and excluded from the current-product matrix. | [GAEP-EVD-002](https://github.com/SpecFlowOSS), [GAEP-EVD-004](https://github.github.com/spec-kit/index.html) |

AWS AI-DLC is treated as a methodology rather than a vendor product. “Spec Flow” was not silently normalized: the discontinued SpecFlow BDD project and the current GitHub Spec Kit are distinct identities; the benchmark evaluates Spec Kit and records SpecFlow only as identity-resolution evidence.

### P01 Product identity boundary

P02 preserves the P01 naming recommendation; it does not reopen, approve, or replace it.

| Element | P01 recommended candidate |
| --- | --- |
| Canonical name | **Governed AI Engineering Platform** |
| Descriptor | **An evidence-driven, adaptive product-to-operations engineering system.** |
| Optional tagline | **From product intent to operational evidence.** |
| Decision state | **Proposed — awaiting explicit Product Owner acceptance** |

## Naming drift inventory

The name, descriptor, tagline, and approval boundary above are a projection of the accepted-for-roadmap-progression P01 artifact state, not new P02 market evidence. Any rename, alias, trademark conclusion, localization, package/command migration, or public-brand decision remains separately governed.

The P01 Product Strategy decisions remain open and retain their existing crosswalk ownership:

| Decision ID | Decision still requiring human authority |
| --- | --- |
| GAEP-STR-POS-DEC-001 | Which category target users understand without extensive explanation |
| GAEP-STR-POS-DEC-002 | Which alternative is the primary incumbent for the first workflow |
| GAEP-STR-POS-DEC-003 | Which differentiator is valuable and defensible with first-horizon evidence |
| GAEP-STR-POS-DEC-004 | Which capabilities should be composed rather than owned by GAEP |
| GAEP-STR-POS-DEC-005 | Which provider-substitution test is sufficient for a portability claim |
| GAEP-STR-POS-DEC-006 | Which claims may be used internally, publicly, or commercially at each evidence stage |

## 2. Landscape and inclusion/exclusion rationale

Inclusion required an official, current identity and enough official evidence to evaluate at least one defined capability. Classification describes relationship to GAEP's candidate scope, not quality. No reviewed product was established as a direct full-scope competitor; this is not proof that no such competitor exists.

| Product/project | Relationship | Category membership | Bounded rationale | Official evidence |
| --- | --- | --- | --- | --- |
| GitLab | adjacent-alternative | Repository-native DevSecOps platform | Repository-native DevSecOps platform covers planning through operations and controls, but not the same governed Product/Initiative evidence model. | [GAEP-EVD-009](https://docs.gitlab.com/devsecops/) |
| Azure DevOps | adjacent-alternative | Repository-native DevSecOps platform | Integrated development services cover planning through release but do not evidence the same cross-functional Product truth model. | [GAEP-EVD-010](https://learn.microsoft.com/en-us/azure/devops/project/navigation/go-to-service-page?view=azure-devops) |
| Ardoq | adjacent-alternative | Enterprise architecture and transformation platform | Enterprise architecture platform overlaps business/technology mapping and governance but not implementation-agent orchestration. | [GAEP-EVD-013](https://www.ardoq.com/platform-overview) |
| IBM Engineering Lifecycle Management | adjacent-alternative | Engineering or application lifecycle management platform | Engineering lifecycle suite overlaps requirements, design, tests, configuration, and traceability with a different operating model. | [GAEP-EVD-014](https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/lifecycle-management/7.1.0?topic=overview) |
| Polarion ALM | adjacent-alternative | Engineering or application lifecycle management platform | ALM platform overlaps requirements, tests, release, traceability, and audit workflows with a different Product scope. | [GAEP-EVD-015](https://www.siemens.com/en-gb/products/polarion/application-lifecycle-management-alm/) |
| Kiro | partial-substitute | Specification-driven development toolkit or IDE, AI coding and engineering agent | Spec-driven agentic IDE overlaps specification and implementation but reviewed evidence does not establish GAEP-style governed Product-to-Operations authority. | [GAEP-EVD-003](https://kiro.dev/docs/) |
| GitHub Spec Kit | partial-substitute | Specification-driven development toolkit or IDE | Spec-driven toolkit structures specification-to-implementation work but does not establish an enterprise Product governance system. | [GAEP-EVD-004](https://github.github.com/spec-kit/index.html) |
| OpenAI Codex | partial-substitute | AI coding and engineering agent | Coding agent can execute engineering work; it is a narrower choice when teams need implementation assistance rather than a governance system. | [GAEP-EVD-005](https://openai.com/index/introducing-the-codex-app/) |
| Claude Code | partial-substitute | AI coding and engineering agent | Coding agent can execute repository work; it is not evidenced as a Product-to-Operations governance authority. | [GAEP-EVD-006](https://code.claude.com/docs/en/overview) |
| GitHub Copilot | partial-substitute | AI coding and engineering agent | Coding assistant and cloud agent support engineering work and review, with a narrower lifecycle scope than GAEP's proposed category. | [GAEP-EVD-007](https://docs.github.com/en/copilot/get-started/what-is-github-copilot) |
| Amazon Q Developer | partial-substitute | AI coding and engineering agent | Developer assistant overlaps implementation support but reviewed evidence does not establish the complete GAEP governance model. | [GAEP-EVD-008](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/getting-started-q-dev.html) |
| Jira Product Discovery | partial-substitute | Product discovery and requirements platform | Product discovery and roadmapping can satisfy teams whose need stops at discovery-to-delivery linkage. | [GAEP-EVD-011](https://www.atlassian.com/software/jira/product-discovery) |
| Productboard | partial-substitute | Product discovery and requirements platform | Product management platform can satisfy discovery, prioritization, and roadmap needs without full engineering governance. | [GAEP-EVD-012](https://support.productboard.com/hc/en-us/articles/360058147693-What-is-Productboard) |
| Figma | complement-integration-candidate | Product design and developer handoff platform | Design and handoff platform is a likely adapter/complement; it is not treated as a full GAEP substitute. | [GAEP-EVD-016](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode) |
| SAP S/4HANA Cloud Public Edition | excluded-with-reason | Enterprise business application | ERP is retained as one enterprise-product example but runs business operations and is not a software Product-governance substitute. | [GAEP-EVD-017](https://www.sap.com/products/erp/s4hana.html) |

Products and methodologies are deliberately separated. SAP S/4HANA is retained only as an ERP boundary example; Enterprise Products are not equated with ERP.

## 3. Evidence-bound comparison

Every Product has exactly 17 defined cells. **Unknown means not assessed or not established by reviewed evidence; it never means No.** “Unsupported by reviewed evidence” requires affirmative reviewed evidence and is not inferred from documentation silence. Preview, roadmap, extension, and inference states remain distinct from shipped capability.

| Product/project | Verified | Partial | Unsupported by reviewed evidence | Unknown | N/A |
| --- | --- | --- | --- | --- | --- |
| Kiro | 7 | 6 | 0 | 4 | 0 |
| GitHub Spec Kit | 5 | 4 | 0 | 8 | 0 |
| OpenAI Codex | 1 | 7 | 0 | 9 | 0 |
| Claude Code | 1 | 6 | 0 | 10 | 0 |
| GitHub Copilot | 1 | 9 | 0 | 7 | 0 |
| Amazon Q Developer | 2 | 5 | 0 | 10 | 0 |
| GitLab | 6 | 5 | 0 | 6 | 0 |
| Azure DevOps | 5 | 5 | 0 | 7 | 0 |
| Jira Product Discovery | 1 | 5 | 0 | 11 | 0 |
| Productboard | 1 | 5 | 0 | 11 | 0 |
| Ardoq | 2 | 7 | 0 | 8 | 0 |
| IBM Engineering Lifecycle Management | 5 | 8 | 0 | 4 | 0 |
| Polarion ALM | 6 | 6 | 0 | 5 | 0 |
| Figma | 1 | 6 | 0 | 10 | 0 |
| SAP S/4HANA Cloud Public Edition | 0 | 7 | 0 | 10 | 0 |

This compact table is a coverage view, not a score or ranking. Raw evidence, cell rationale, limitations, delivery state, and as-of bindings are authoritative in GAEP-REG-013. No aggregate winner score is permitted.

### Evidence review state

| Review state | Official sources |
| --- | --- |
| reviewed-partial | 17 |

All 17 entries use official HTTPS sources. Living pages are snapshots as of 2026-08-08; they must be reviewed on their recorded triggers. A source digest appears only when exact bytes were legally captured—none is implied by a URL or access date.

## 4. GAEP differentiation with current-vs-future separation

The following is derived from exact repository paths. Implementation status does not create Product Owner acceptance, market validation, enterprise readiness, security/compliance authority, or public claim permission.

| Capability | GAEP maturity | Repository basis | Limitation |
| --- | --- | --- | --- |
| Product intent and discovery | implemented-awaiting-product-owner-acceptance | apps/vscode/src/existing-product-adoption-review.ts; packages/contracts/src/product.ts | No clean enterprise Product Owner acceptance or outcome evidence is implied. |
| Governed source grounding and provenance | implemented-and-automated-tested | packages/contracts/src/source-governance.ts; packages/engine/src/source-governance.ts | Candidate Sources and Baselines do not create authority or semantic correctness. |
| Human authority and proposal/accept/commit separation | implemented-awaiting-product-owner-acceptance | apps/vscode/src/phase1-canonical-authoring.ts; apps/vscode/src/product-chat-participant.ts | Approval and authorization remain separate and no complete clean-workspace acceptance is recorded. |
| Initiative classification, applicability, and tailoring | implemented-and-automated-tested | apps/vscode/src/interactive-initiative-applicability-chat.ts; packages/engine/src/initiative-entry-workflow.ts | Role recommendations appoint nobody and do not approve lifecycle work. |
| Business architecture | implemented-awaiting-product-owner-acceptance | apps/vscode/src/phase1-canonical-presentation.ts; packages/contracts/src/business-understanding.ts | Only a subset has complete real V5 visual acceptance evidence. |
| Domain discovery, EventStorming, and DDD | implemented-awaiting-product-owner-acceptance | apps/vscode/src/phase1-canonical-authoring.ts; packages/contracts/src/business-understanding.ts | Method fitness and complete installed acceptance remain human decisions. |
| Architecture views and decisions | implemented-awaiting-product-owner-acceptance | packages/contracts/src/bounded-context-model.ts; packages/contracts/src/system-solution-architecture.ts | No complete fresh Product Owner acceptance exists for the full group. |
| Architecture-before-slice implementation | partial | apps/vscode/src/current-engine-studio-data-source.ts; packages/engine/src/engine.ts | A complete authorization gate that prevents every premature implementation slice is not established. |
| Product Design and tool-neutral adapters | partial | packages/contracts/src/p5-handoff-package.ts; packages/design-import/src/index.ts | Tool-neutral Product Design governance and installed acceptance are incomplete. |
| Architecture-bound backlog | partial | apps/vscode/src/product-journey-markdown-export.ts; packages/contracts/src/product-journey.ts | A complete architecture-bound backlog and selective downstream realignment UX remain incomplete. |
| Implementation agents and code generation | implemented-awaiting-product-owner-acceptance | packages/adapters/claude/src/index.ts; packages/adapters/codex/src/index.ts; packages/agent-sdk/src/index.ts | Live-provider semantic quality and effectful enterprise acceptance remain separate. |
| Multi-repository and repository federation | planned-deferred-coming-soon | docs/next/99_Registries_and_References/004_DEFERRED_CAPABILITY_REGISTER.md | It is not a shipped GAEP capability. |
| Tests, assurance, traceability, and evidence | implemented-awaiting-product-owner-acceptance | packages/contracts/src/evidence.ts; packages/engine/src/repository.ts | Local integrity is not external signing, compliance, or organizational approval. |
| Release, deployment, and operations feedback | partial | packages/contracts/src/managed-execution.ts; scripts/phase0_acceptance_report.mjs | A complete production operations feedback loop and release authority are not implemented. |
| Enterprise privacy, deployment, and administrative controls | partial | apps/vscode/src/extension.ts; packages/agent-sdk/src/provider-selection.ts | Enterprise privacy, identity, deployment, retention, and administrative control claims are not established. |
| Auditability and portability | implemented-awaiting-product-owner-acceptance | apps/vscode/src/product-journey-markdown-export.ts; packages/engine/src/repository.ts | No external signature, organizational audit acceptance, or universal portability claim is supported. |
| Provider neutrality and extensibility | implemented-awaiting-product-owner-acceptance | packages/adapters/claude/src/index.ts; packages/adapters/codex/src/index.ts; packages/agent-sdk/src/provider-selection.ts | Current provider availability, entitlement, equivalence, and native Kiro parity remain unverified. |

GAEP's candidate distinction is the combination of governed sources, explicit human proposal/accept/commit authority, Initiative tailoring, cross-lifecycle traceability, and provider/tool portability. Each element must be stated at its recorded maturity; planned work must never be compared with another product's shipped feature as equivalent delivery.

## 5. Executive adoption decision guide

Do not choose from brand familiarity, AI novelty, or this document's count table. Select a scenario, inspect its relevant cells and unknowns, and validate fit through a bounded proof of value.

### Product and executive governance

**Decision criteria:** Auditability and portability; Governed source grounding and provenance; Human authority and proposal/accept/commit separation; Initiative classification, applicability, and tailoring; Product intent and discovery; Tests, assurance, traceability, and evidence.

**Fit:** Need durable Product/Initiative evidence and human decision separation.

**Non-fit:** Need is only code completion.

**Trade-offs:** Additional governance can increase author and reviewer burden; Incomplete evidence can preserve uncertainty rather than produce an immediate answer.

**Build/buy/adopt/augment:** Adopt GAEP only after a bounded proof of value; Augment authoritative incumbent systems when their specialization should remain; Build only the missing governed semantics and adapters; Buy a narrower established product when it satisfies the complete job.

**Evaluation questions:** What evidence must survive tool changes?; Which human decisions must remain explicit?.

Applicable capabilities: Product intent and discovery, Governed source grounding and provenance, Human authority and proposal/accept/commit separation, Initiative classification, applicability, and tailoring, Tests, assurance, traceability, and evidence, Auditability and portability. Ranking policy: **no-total-score-preserve-unknowns**.

### Product and business architecture

**Decision criteria:** Architecture views and decisions; Business architecture; Domain discovery, EventStorming, and DDD; Governed source grounding and provenance; Human authority and proposal/accept/commit separation; Product intent and discovery; Tests, assurance, traceability, and evidence.

**Fit:** Need trace from discovery into capability/value/operating models.

**Non-fit:** A simple roadmap is sufficient.

**Trade-offs:** Additional governance can increase author and reviewer burden; Incomplete evidence can preserve uncertainty rather than produce an immediate answer.

**Build/buy/adopt/augment:** Adopt GAEP only after a bounded proof of value; Augment authoritative incumbent systems when their specialization should remain; Build only the missing governed semantics and adapters; Buy a narrower established product when it satisfies the complete job.

**Evaluation questions:** Is domain-method depth actually applicable?; Which business models must remain governed?.

Applicable capabilities: Product intent and discovery, Governed source grounding and provenance, Human authority and proposal/accept/commit separation, Business architecture, Domain discovery, EventStorming, and DDD, Architecture views and decisions, Tests, assurance, traceability, and evidence. Ranking policy: **no-total-score-preserve-unknowns**.

### Enterprise and software architecture

**Decision criteria:** Architecture views and decisions; Architecture-before-slice implementation; Auditability and portability; Business architecture; Governed source grounding and provenance; Human authority and proposal/accept/commit separation; Multi-repository and repository federation; Tests, assurance, traceability, and evidence.

**Fit:** Need architecture decisions and cross-system impact.

**Non-fit:** Static diagrams alone satisfy the need.

**Trade-offs:** Additional governance can increase author and reviewer burden; Incomplete evidence can preserve uncertainty rather than produce an immediate answer.

**Build/buy/adopt/augment:** Adopt GAEP only after a bounded proof of value; Augment authoritative incumbent systems when their specialization should remain; Build only the missing governed semantics and adapters; Buy a narrower established product when it satisfies the complete job.

**Evaluation questions:** How will multiple repositories remain aligned?; What architecture objects and decisions need authority?.

Applicable capabilities: Governed source grounding and provenance, Human authority and proposal/accept/commit separation, Business architecture, Architecture views and decisions, Architecture-before-slice implementation, Multi-repository and repository federation, Tests, assurance, traceability, and evidence, Auditability and portability. Ranking policy: **no-total-score-preserve-unknowns**.

### Engineering delivery

**Decision criteria:** Architecture views and decisions; Architecture-before-slice implementation; Architecture-bound backlog; Implementation agents and code generation; Multi-repository and repository federation; Provider neutrality and extensibility; Release, deployment, and operations feedback; Tests, assurance, traceability, and evidence.

**Fit:** Need implementation agents tied to upstream context.

**Non-fit:** Team only needs a single coding assistant.

**Trade-offs:** Additional governance can increase author and reviewer burden; Incomplete evidence can preserve uncertainty rather than produce an immediate answer.

**Build/buy/adopt/augment:** Adopt GAEP only after a bounded proof of value; Augment authoritative incumbent systems when their specialization should remain; Build only the missing governed semantics and adapters; Buy a narrower established product when it satisfies the complete job.

**Evaluation questions:** Must backlog and code trace to architecture?; Which agent effects require approval?.

Applicable capabilities: Architecture views and decisions, Architecture-before-slice implementation, Architecture-bound backlog, Implementation agents and code generation, Multi-repository and repository federation, Tests, assurance, traceability, and evidence, Release, deployment, and operations feedback, Provider neutrality and extensibility. Ranking policy: **no-total-score-preserve-unknowns**.

### Regulated or evidence-sensitive environments

**Decision criteria:** Architecture views and decisions; Auditability and portability; Enterprise privacy, deployment, and administrative controls; Governed source grounding and provenance; Human authority and proposal/accept/commit separation; Initiative classification, applicability, and tailoring; Tests, assurance, traceability, and evidence.

**Fit:** Need exact evidence, audit history, and human authority boundaries.

**Non-fit:** No organization can assign required authorities.

**Trade-offs:** Additional governance can increase author and reviewer burden; Incomplete evidence can preserve uncertainty rather than produce an immediate answer.

**Build/buy/adopt/augment:** Adopt GAEP only after a bounded proof of value; Augment authoritative incumbent systems when their specialization should remain; Build only the missing governed semantics and adapters; Buy a narrower established product when it satisfies the complete job.

**Evaluation questions:** What independent assurance and retention are required?; Which regulation applies?.

Applicable capabilities: Governed source grounding and provenance, Human authority and proposal/accept/commit separation, Initiative classification, applicability, and tailoring, Architecture views and decisions, Tests, assurance, traceability, and evidence, Enterprise privacy, deployment, and administrative controls, Auditability and portability. Ranking policy: **no-total-score-preserve-unknowns**.

### Teams seeking only an AI coding assistant

**Decision criteria:** Enterprise privacy, deployment, and administrative controls; Implementation agents and code generation; Provider neutrality and extensibility.

**Fit:** Need code changes, tests, and review in existing repositories.

**Non-fit:** Need a new Product governance operating model.

**Trade-offs:** Additional governance can increase author and reviewer burden; Incomplete evidence can preserve uncertainty rather than produce an immediate answer.

**Build/buy/adopt/augment:** Adopt GAEP only after a bounded proof of value; Augment authoritative incumbent systems when their specialization should remain; Build only the missing governed semantics and adapters; Buy a narrower established product when it satisfies the complete job.

**Evaluation questions:** Which privacy and admin controls are mandatory?; Would a narrower coding agent minimize burden?.

Applicable capabilities: Implementation agents and code generation, Enterprise privacy, deployment, and administrative controls, Provider neutrality and extensibility. Ranking policy: **no-total-score-preserve-unknowns**.

### Teams seeking a full Product-to-Operations governance system

**Decision criteria:** Architecture views and decisions; Architecture-before-slice implementation; Architecture-bound backlog; Auditability and portability; Business architecture; Domain discovery, EventStorming, and DDD; Enterprise privacy, deployment, and administrative controls; Governed source grounding and provenance; Human authority and proposal/accept/commit separation; Implementation agents and code generation; Initiative classification, applicability, and tailoring; Multi-repository and repository federation; Product Design and tool-neutral adapters; Product intent and discovery; Provider neutrality and extensibility; Release, deployment, and operations feedback; Tests, assurance, traceability, and evidence.

**Fit:** Need cross-functional governed truth and evidence across the lifecycle.

**Non-fit:** No capacity exists for stewardship, review, or explicit authority.

**Trade-offs:** Additional governance can increase author and reviewer burden; Incomplete evidence can preserve uncertainty rather than produce an immediate answer.

**Build/buy/adopt/augment:** Adopt GAEP only after a bounded proof of value; Augment authoritative incumbent systems when their specialization should remain; Build only the missing governed semantics and adapters; Buy a narrower established product when it satisfies the complete job.

**Evaluation questions:** Can the organization sustain the governance burden?; Which current tools should GAEP augment rather than replace?.

Applicable capabilities: Product intent and discovery, Governed source grounding and provenance, Human authority and proposal/accept/commit separation, Initiative classification, applicability, and tailoring, Business architecture, Domain discovery, EventStorming, and DDD, Architecture views and decisions, Architecture-before-slice implementation, Product Design and tool-neutral adapters, Architecture-bound backlog, Implementation agents and code generation, Multi-repository and repository federation, Tests, assurance, traceability, and evidence, Release, deployment, and operations feedback, Enterprise privacy, deployment, and administrative controls, Auditability and portability, Provider neutrality and extensibility. Ranking policy: **no-total-score-preserve-unknowns**.

### Proof-of-value metrics

No benchmark value is invented. Each threshold remains a human decision until a baseline and observation plan exist.

| Metric | Definition | Baseline | Window | Data owner | Confounders | Decision threshold |
| --- | --- | --- | --- | --- | --- | --- |
| Time to decision-ready trusted context | Elapsed and active human time from bounded intent to a reviewable evidence-linked decision package. | Measure the same workflow without GAEP before pilot; no value is predeclared. | Predeclared pilot window covering comparable work items. | GAEP Metric Integrity Owner | facilitator support; participant experience; provider/model changes; work-item complexity | Must be set by an accountable human before observation; unset in P02. |
| Post-decision rework and escaped gaps | Count and severity of material corrections attributable to missing or inconsistent upstream context after a decision. | Historical comparable cases with the same severity rubric. | Decision through the predeclared downstream milestone. | GAEP Assurance Authority | case mix; delivery-team changes; reporting culture; reviewer depth | Must be predeclared with a countermetric for review burden; unset in P02. |
| Author and reviewer burden | Active author/reviewer minutes, queue delay, and mandatory interactions per governed change. | Observed current workflow segmented by role and risk. | Full author-review-decision cycle for comparable cases. | GAEP Product Owner | novelty; risk classification; tool latency; training | Must balance quality and trust outcomes; unset in P02. |

## 6. Claim registry summary

Only exact bounded wording may be considered, and even allowed-internal entries remain **not approved** and **not published**. Prohibited entries are guardrails, not reusable marketing copy.

| Claim | Class | Disposition | Bounded wording | Evidence/maturity | Required qualifiers |
| --- | --- | --- | --- | --- | --- |
| GAEP-CLM-001 | substantiated-bounded-fact | allowed-internal | GAEP currently implements and automatically tests exact candidate Source, Baseline, Provenance, revision-history, and local audit-chain behaviors. | Repository evidence only; Governed source grounding and provenance, Tests, assurance, traceability, and evidence, Auditability and portability | Say implemented and automated-tested; do not say approved or enterprise-ready. |
| GAEP-CLM-002 | evidence-bounded-comparison | allowed-internal | The reviewed landscape is composite: coding agents, spec-driven tools, DevSecOps platforms, Product discovery tools, architecture platforms, ALM suites, and design tools cover different parts of GAEP's proposed scope. | [GAEP-EVD-003](https://kiro.dev/docs/), [GAEP-EVD-004](https://github.github.com/spec-kit/index.html), [GAEP-EVD-005](https://openai.com/index/introducing-the-codex-app/), [GAEP-EVD-006](https://code.claude.com/docs/en/overview), [GAEP-EVD-007](https://docs.github.com/en/copilot/get-started/what-is-github-copilot), [GAEP-EVD-008](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/getting-started-q-dev.html), [GAEP-EVD-009](https://docs.gitlab.com/devsecops/), [GAEP-EVD-010](https://learn.microsoft.com/en-us/azure/devops/project/navigation/go-to-service-page?view=azure-devops), [GAEP-EVD-011](https://www.atlassian.com/software/jira/product-discovery), [GAEP-EVD-012](https://support.productboard.com/hc/en-us/articles/360058147693-What-is-Productboard), [GAEP-EVD-013](https://www.ardoq.com/platform-overview), [GAEP-EVD-014](https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/lifecycle-management/7.1.0?topic=overview), [GAEP-EVD-015](https://www.siemens.com/en-gb/products/polarion/application-lifecycle-management-alm/), [GAEP-EVD-016](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode), [GAEP-EVD-017](https://www.sap.com/products/erp/s4hana.html); Product intent and discovery, Governed source grounding and provenance, Human authority and proposal/accept/commit separation, Initiative classification, applicability, and tailoring, Business architecture, Domain discovery, EventStorming, and DDD, Architecture views and decisions, Architecture-before-slice implementation, Product Design and tool-neutral adapters, Architecture-bound backlog, Implementation agents and code generation, Multi-repository and repository federation, Tests, assurance, traceability, and evidence, Release, deployment, and operations feedback, Enterprise privacy, deployment, and administrative controls, Auditability and portability, Provider neutrality and extensibility | State the 2026-08-08 as-of date and reviewed-source limitations. |
| GAEP-CLM-003 | evidence-bounded-comparison | allowed-internal | A coding agent can be the better-scoped choice when the need is repository implementation assistance rather than governed Product-to-Operations decision management. | [GAEP-EVD-005](https://openai.com/index/introducing-the-codex-app/), [GAEP-EVD-006](https://code.claude.com/docs/en/overview), [GAEP-EVD-007](https://docs.github.com/en/copilot/get-started/what-is-github-copilot), [GAEP-EVD-008](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/getting-started-q-dev.html); Implementation agents and code generation | Describe the team's need and do not rank agent quality. |
| GAEP-CLM-004 | positioning-hypothesis | pending-human-decision | No single reviewed external Product was established as a complete direct substitute for GAEP's proposed combined category. | [GAEP-EVD-003](https://kiro.dev/docs/), [GAEP-EVD-004](https://github.github.com/spec-kit/index.html), [GAEP-EVD-005](https://openai.com/index/introducing-the-codex-app/), [GAEP-EVD-006](https://code.claude.com/docs/en/overview), [GAEP-EVD-007](https://docs.github.com/en/copilot/get-started/what-is-github-copilot), [GAEP-EVD-008](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/getting-started-q-dev.html), [GAEP-EVD-009](https://docs.gitlab.com/devsecops/), [GAEP-EVD-010](https://learn.microsoft.com/en-us/azure/devops/project/navigation/go-to-service-page?view=azure-devops), [GAEP-EVD-011](https://www.atlassian.com/software/jira/product-discovery), [GAEP-EVD-012](https://support.productboard.com/hc/en-us/articles/360058147693-What-is-Productboard), [GAEP-EVD-013](https://www.ardoq.com/platform-overview), [GAEP-EVD-014](https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/lifecycle-management/7.1.0?topic=overview), [GAEP-EVD-015](https://www.siemens.com/en-gb/products/polarion/application-lifecycle-management-alm/), [GAEP-EVD-016](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode), [GAEP-EVD-017](https://www.sap.com/products/erp/s4hana.html); Product intent and discovery, Governed source grounding and provenance, Human authority and proposal/accept/commit separation, Initiative classification, applicability, and tailoring, Business architecture, Domain discovery, EventStorming, and DDD, Architecture views and decisions, Architecture-before-slice implementation, Product Design and tool-neutral adapters, Architecture-bound backlog, Implementation agents and code generation, Multi-repository and repository federation, Tests, assurance, traceability, and evidence, Release, deployment, and operations feedback, Enterprise privacy, deployment, and administrative controls, Auditability and portability, Provider neutrality and extensibility | Keep as a hypothesis; never state that competitors lack a capability. |
| GAEP-CLM-005 | customer-outcome-hypothesis | prohibited | GAEP reduces delivery time, improves accuracy, and lowers engineering cost. | Repository evidence only; No GAEP capability binding | Do not use until separately measured and approved. |
| GAEP-CLM-006 | prohibited-claim | prohibited | GAEP is enterprise-ready, secure, compliant, and production-ready. | Repository evidence only; No GAEP capability binding | Do not use. |
| GAEP-CLM-007 | prohibited-claim | prohibited | GAEP is better than or superior to the evaluated alternatives. | Repository evidence only; No GAEP capability binding | Do not use or imply through ranking. |
| GAEP-CLM-008 | substantiated-bounded-fact | allowed-internal | GAEP plans repository federation and a complete operations feedback loop as future capabilities. | Repository evidence only; Multi-repository and repository federation, Release, deployment, and operations feedback | Always label planned/deferred and avoid release dates. |

## 7. Limitations, unknowns and research debt

- **GAEP-DEBT-001 — undefined** Owner: GAEP Product Research Owner. Trigger: undefined. State: open.
- **GAEP-DEBT-002 — undefined** Owner: GAEP Product Research Owner. Trigger: undefined. State: open.
- **GAEP-DEBT-003 — undefined** Owner: GAEP Metric Integrity Owner. Trigger: undefined. State: open.
- **GAEP-DEBT-004 — undefined** Owner: GAEP Methodology Steward. Trigger: undefined. State: open.

Key limits:

- The research snapshot is current only to 2026-08-08; living vendor pages can change without versioned releases.
- One official page per Product is enough for inclusion, not exhaustive feature or licensing due diligence.
- No customer interviews, comparative trials, procurement diligence, security assessment, price normalization, or outcome measurement occurred in P02.
- Unknown cells are preserved, not converted to negative claims.
- No comparison proves GAEP is a better choice; the correct outcome may be a narrower tool, an existing-tool composition, or no GAEP adoption.

## 8. P03 projection contract

P03 may project the following from GAEP-REG-013 without creating duplicate truth:

- category names and definitions;
- Product identities and relationship classifications;
- benchmark support, evidence, delivery, limitation, and as-of states;
- GAEP maturity states and repository bindings;
- exact claim wording, disposition, qualifiers, approval, and publication state;
- scenario decision criteria, fit/non-fit conditions, questions, and proof-of-value definitions.

P03 must consume the registry version and digest, preserve Unknown and current-vs-future distinctions, expose evidence and limitations, and fail on projection drift. P03 must not approve claims, invent scores, merge Products with methodologies, or add market truth outside GAEP-REG-013.

## Canonical source and migration

- **Canonical market evidence and benchmark truth:** GAEP-REG-013.
- **Contract:** GAEP-REG-012.
- **Methodology and standards truth:** GAEP-REG-011 remains owned by P01.
- **This document:** deterministic human projection only.
- **Legacy external-project register:** preserved as historical and cross-referenced; it is not a current benchmark authority.

P02 is not self-accepted. Independent acceptance review and explicit human authority are required before any benchmark or claim may be treated as approved or published.
