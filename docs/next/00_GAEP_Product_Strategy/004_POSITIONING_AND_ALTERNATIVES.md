---
id: GAEP-STR-004
title: Evidence-Governed Market Category, Benchmark, and Positioning
document_type: product-strategy
schema_version: 1.0
version: 0.4.1
status: proposed
owner_role: GAEP Product Owner
scope: P02 market category, competitive benchmark, executive claims, and adoption decision support
normative_level: informative
classification: internal
provenance: Deterministically generated from GAEP-REG-013 version 0.2.1
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

Generated from **GAEP-REG-013 v0.2.1**, research snapshot **2026-08-08**, registry SHA-256 `3dcfe5531a1bb4630dc3afdb2990389728e2d39cac2ac915986badb9fe9e5c17`. Edit the canonical registry and rerun `npm run render:market-benchmark`; do not edit generated market assertions here.

## How to read this document

- **Verified** means a current active assertion for this exact Product/capability has full or substantive official-source review.
- **Partial** means official Evidence establishes only a bounded part of the compound capability.
- **Unsupported by reviewed evidence** requires explicit reviewed negative Evidence; documentation silence is insufficient.
- Unknown means not assessed or not established by reviewed evidence; it never means No.
- **N/A** requires an explicit applicability rationale.
- A shipped state needs a separate official availability assertion. Counts are coverage indicators, not a score or ranking.

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

### Naming drift inventory

The candidate name, descriptor, tagline, and approval boundary above project P01; they are not new P02 market Evidence. Rename, alias, trademark, localization, package/command migration, and public-brand decisions remain separately governed. The open P01 positioning decisions remain owned by their existing crosswalk:

| Decision ID | Decision still requiring human authority |
| --- | --- |
| GAEP-STR-POS-DEC-001 | Which category target users understand without extensive explanation |
| GAEP-STR-POS-DEC-002 | Which alternative is the primary incumbent for the first workflow |
| GAEP-STR-POS-DEC-003 | Which differentiator is valuable and defensible with first-horizon Evidence |
| GAEP-STR-POS-DEC-004 | Which capabilities should be composed rather than owned by GAEP |
| GAEP-STR-POS-DEC-005 | Which provider-substitution test is sufficient for a portability claim |
| GAEP-STR-POS-DEC-006 | Which claims may be used internally, publicly, or commercially at each Evidence stage |

## 2. Landscape and inclusion/exclusion rationale

Inclusion required an official current identity and enough reviewed official Evidence to evaluate at least one defined capability. Classification describes relationship to GAEP's candidate scope, not quality. No reviewed Product was established as a direct full-scope competitor; this is not proof that none exists.

| Product/project | Relationship | Category membership | Bounded rationale | Official Evidence |
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
| Aha! Roadmaps | partial-substitute | Enterprise architecture and transformation platform, Engineering or application lifecycle management platform | Aha! Roadmaps overlaps Product strategy, requirements, roadmap, and release planning but reviewed evidence does not establish GAEP's governed cross-lifecycle evidence model. | [GAEP-EVD-050](https://www.aha.io/roadmaps/overview) |
| Figma | complement-integration-candidate | Product design and developer handoff platform | Design and handoff platform is a likely adapter/complement; it is not treated as a full GAEP substitute. | [GAEP-EVD-016](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode) |

### Methodologies/frameworks kept outside the Product matrix

| Methodology/framework | Identity treatment | Relevant capabilities | Boundary |
| --- | --- | --- | --- |
| AWS AI-Driven Development Life Cycle | external-research-candidate | Human authority and propose/review/accept/commit separation, Architecture-before-slice implementation sequencing | P02 records identity and market relevance only; methodology truth is not added to GAEP-REG-011 by this correction. |
| The TOGAF Standard, 10th Edition | p01-catalog-reference | Business architecture, capabilities and value streams, Architecture views, quality attributes and ADRs | Canonical methodology truth remains in GAEP-REG-011. |
| The C4 model for visualising software architecture | p01-catalog-reference | Architecture views, quality attributes and ADRs | Canonical methodology truth remains in GAEP-REG-011. |
| Domain-Driven Design Reference | p01-catalog-reference | Domain discovery and EventStorming, DDD strategic design, bounded contexts and context mapping | Canonical methodology truth remains in GAEP-REG-011. |
| Introducing EventStorming | p01-catalog-reference | Domain discovery and EventStorming | Canonical methodology truth remains in GAEP-REG-011. |

### Explicit exclusions

| Identity | Reason excluded | Evidence |
| --- | --- | --- |
| SpecFlow BDD project | Distinct discontinued identity; it must not be silently conflated with GitHub Spec Kit. | [GAEP-EVD-002](https://github.com/SpecFlowOSS) |
| SAP S/4HANA Cloud Public Edition | ERP is one enterprise-application example, not a full Product-to-Operations governance substitute and not matrix-count padding. | [GAEP-EVD-017](https://www.sap.com/products/erp/s4hana.html) |

ERP appears only as an explicit enterprise-product boundary example. Enterprise Products are not equated with ERP, and SAP S/4HANA does not pad the 15-Product benchmark matrix.

## 3. Evidence-bound comparison

Every evaluated Product has exactly 30 defined cells: **15 × 30 = 450**. The following compact view exposes evidence coverage without inventing a winner.

| Product/project | Verified | Partial | Unsupported by reviewed evidence | Unknown | N/A |
| --- | --- | --- | --- | --- | --- |
| Kiro | 0 | 8 | 0 | 22 | 0 |
| GitHub Spec Kit | 1 | 8 | 0 | 21 | 0 |
| OpenAI Codex | 0 | 4 | 0 | 26 | 0 |
| Claude Code | 0 | 4 | 0 | 26 | 0 |
| GitHub Copilot | 0 | 4 | 0 | 26 | 0 |
| Amazon Q Developer | 0 | 4 | 0 | 26 | 0 |
| GitLab | 0 | 7 | 0 | 23 | 0 |
| Azure DevOps | 3 | 4 | 0 | 23 | 0 |
| Jira Product Discovery | 0 | 4 | 0 | 26 | 0 |
| Productboard | 0 | 4 | 0 | 26 | 0 |
| Ardoq | 0 | 4 | 0 | 26 | 0 |
| IBM Engineering Lifecycle Management | 1 | 3 | 0 | 26 | 0 |
| Polarion ALM | 0 | 5 | 0 | 25 | 0 |
| Figma | 0 | 5 | 0 | 25 | 0 |
| Aha! Roadmaps | 0 | 5 | 0 | 25 | 0 |

This compact table is not a score or ranking. Raw support assertions, cell rationale, limitations, delivery state, and as-of bindings are authoritative in GAEP-REG-013. No aggregate winner score is permitted.

### Capability-by-capability evidence view

#### Product and Initiative governance

| Capability | GAEP maturity | Verified Products | Partially supported Products | Unknown count | Official Evidence |
| --- | --- | --- | --- | --- | --- |
| GAEP-CAP-101 — Product intent and problem discovery | implemented-awaiting-product-owner-acceptance | None established | Jira Product Discovery, Productboard, Aha! Roadmaps | 12 | [GAEP-EVD-037](https://support.atlassian.com/jira-product-discovery/resources/), [GAEP-EVD-039](https://support.productboard.com/hc/en-us/articles/360058147693-What-is-Productboard), [GAEP-EVD-049](https://www.aha.io/roadmaps/requirements) |
| GAEP-CAP-102 — Guided lifecycle navigation and user onboarding | partial | None established | Kiro, GitHub Spec Kit, Jira Product Discovery, Figma | 11 | [GAEP-EVD-003](https://kiro.dev/docs/), [GAEP-EVD-021](https://github.github.com/spec-kit/reference/agentic-sdd.html), [GAEP-EVD-037](https://support.atlassian.com/jira-product-discovery/resources/), [GAEP-EVD-047](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode) |
| GAEP-CAP-103 — Source intake and reference grounding | implemented-and-automated-tested | None established | None established | 15 | No external Evidence binding |
| GAEP-CAP-104 — Source baseline and version control | implemented-and-automated-tested | None established | None established | 15 | No external Evidence binding |
| GAEP-CAP-105 — Source provenance and lineage | implemented-and-automated-tested | None established | None established | 15 | No external Evidence binding |
| GAEP-CAP-106 — Human authority and propose/review/accept/commit separation | implemented-awaiting-product-owner-acceptance | None established | OpenAI Codex, Claude Code | 13 | [GAEP-EVD-024](https://learn.chatgpt.com/docs/security), [GAEP-EVD-026](https://code.claude.com/docs/en/security) |
| GAEP-CAP-107 — Initiative definition and change boundary | implemented-and-automated-tested | None established | GitHub Spec Kit, Productboard, Aha! Roadmaps | 12 | [GAEP-EVD-021](https://github.github.com/spec-kit/reference/agentic-sdd.html), [GAEP-EVD-040](https://support.productboard.com/hc/en-us/articles/29983922254739-Quick-start-guide-Roadmaps), [GAEP-EVD-050](https://www.aha.io/roadmaps/overview) |
| GAEP-CAP-108 — Initiative classification, risk and exposure | implemented-and-automated-tested | None established | None established | 15 | No external Evidence binding |
| GAEP-CAP-109 — Initiative applicability and lifecycle tailoring | implemented-and-automated-tested | None established | None established | 15 | No external Evidence binding |

#### Business, domain, architecture, and planning

| Capability | GAEP maturity | Verified Products | Partially supported Products | Unknown count | Official Evidence |
| --- | --- | --- | --- | --- | --- |
| GAEP-CAP-110 — Business architecture, capabilities and value streams | implemented-awaiting-product-owner-acceptance | None established | Ardoq | 14 | [GAEP-EVD-041](https://help.ardoq.com/en/articles/44073-capability-map) |
| GAEP-CAP-111 — Domain discovery and EventStorming | implemented-awaiting-product-owner-acceptance | None established | None established | 15 | No external Evidence binding |
| GAEP-CAP-112 — DDD strategic design, bounded contexts and context mapping | implemented-awaiting-product-owner-acceptance | None established | None established | 15 | No external Evidence binding |
| GAEP-CAP-113 — Architecture views, quality attributes and ADRs | implemented-awaiting-product-owner-acceptance | None established | Kiro, GitHub Spec Kit, Ardoq | 12 | [GAEP-EVD-018](https://kiro.dev/docs/specs/), [GAEP-EVD-021](https://github.github.com/spec-kit/reference/agentic-sdd.html), [GAEP-EVD-042](https://help.ardoq.com/en/articles/142727-how-to-adopt-the-c4-model-with-ardoq) |
| GAEP-CAP-114 — Architecture-before-slice implementation sequencing | partial | None established | None established | 15 | No external Evidence binding |
| GAEP-CAP-115 — Phase, wave and vertical-slice planning | partial | None established | Kiro, GitHub Spec Kit, Azure DevOps, Jira Product Discovery, Productboard, Ardoq, Aha! Roadmaps | 8 | [GAEP-EVD-018](https://kiro.dev/docs/specs/), [GAEP-EVD-021](https://github.github.com/spec-kit/reference/agentic-sdd.html), [GAEP-EVD-035](https://learn.microsoft.com/en-us/azure/devops/boards/get-started/what-is-azure-boards?view=azure-devops), [GAEP-EVD-038](https://support.atlassian.com/jira-product-discovery/docs/jira-product-discovery-and-jira-plans/), [GAEP-EVD-040](https://support.productboard.com/hc/en-us/articles/29983922254739-Quick-start-guide-Roadmaps), [GAEP-EVD-043](https://help.ardoq.com/en/articles/43997-build-application-roadmaps-using-ardoq-scenarios), [GAEP-EVD-050](https://www.aha.io/roadmaps/overview) |

#### Design, backlog, assurance, and traceability

| Capability | GAEP maturity | Verified Products | Partially supported Products | Unknown count | Official Evidence |
| --- | --- | --- | --- | --- | --- |
| GAEP-CAP-116 — Tool-neutral Product Design preparation and handoff | partial | None established | Figma | 14 | [GAEP-EVD-047](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode) |
| GAEP-CAP-117 — Architecture-bound backlog generation | partial | None established | Kiro, GitHub Spec Kit, Azure DevOps, Jira Product Discovery, Productboard, Aha! Roadmaps | 9 | [GAEP-EVD-018](https://kiro.dev/docs/specs/), [GAEP-EVD-021](https://github.github.com/spec-kit/reference/agentic-sdd.html), [GAEP-EVD-035](https://learn.microsoft.com/en-us/azure/devops/boards/get-started/what-is-azure-boards?view=azure-devops), [GAEP-EVD-038](https://support.atlassian.com/jira-product-discovery/docs/jira-product-discovery-and-jira-plans/), [GAEP-EVD-039](https://support.productboard.com/hc/en-us/articles/360058147693-What-is-Productboard), [GAEP-EVD-049](https://www.aha.io/roadmaps/requirements) |
| GAEP-CAP-118 — Acceptance criteria, Definition of Ready and Definition of Done | partial | None established | Kiro, GitHub Spec Kit, GitLab, IBM Engineering Lifecycle Management, Polarion ALM, Aha! Roadmaps | 9 | [GAEP-EVD-018](https://kiro.dev/docs/specs/), [GAEP-EVD-021](https://github.github.com/spec-kit/reference/agentic-sdd.html), [GAEP-EVD-032](https://docs.gitlab.com/user/project/requirements/), [GAEP-EVD-044](https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/doors-next/7.2.0?topic=requirements-traceability), [GAEP-EVD-045](https://www.siemens.com/en-us/products/polarion/application-lifecycle-management/), [GAEP-EVD-049](https://www.aha.io/roadmaps/requirements) |
| GAEP-CAP-119 — Test design, test cases and quality assurance | implemented-awaiting-product-owner-acceptance | Azure DevOps | Kiro, GitHub Copilot, Amazon Q Developer, GitLab, IBM Engineering Lifecycle Management, Polarion ALM | 8 | [GAEP-EVD-018](https://kiro.dev/docs/specs/), [GAEP-EVD-028](https://docs.github.com/en/copilot/concepts/agents/code-review), [GAEP-EVD-030](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/code-reviews.html), [GAEP-EVD-033](https://docs.gitlab.com/ci/), [GAEP-EVD-034](https://learn.microsoft.com/en-us/azure/devops/user-guide/what-is-azure-devops?view=azure-devops), [GAEP-EVD-044](https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/doors-next/7.2.0?topic=requirements-traceability), [GAEP-EVD-045](https://www.siemens.com/en-us/products/polarion/application-lifecycle-management/) |
| GAEP-CAP-120 — Requirements-to-design-to-code-to-test traceability | implemented-awaiting-product-owner-acceptance | Azure DevOps, IBM Engineering Lifecycle Management | GitHub Spec Kit, GitLab, Polarion ALM, Figma | 9 | [GAEP-EVD-021](https://github.github.com/spec-kit/reference/agentic-sdd.html), [GAEP-EVD-032](https://docs.gitlab.com/user/project/requirements/), [GAEP-EVD-034](https://learn.microsoft.com/en-us/azure/devops/user-guide/what-is-azure-devops?view=azure-devops), [GAEP-EVD-044](https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/doors-next/7.2.0?topic=requirements-traceability), [GAEP-EVD-045](https://www.siemens.com/en-us/products/polarion/application-lifecycle-management/), [GAEP-EVD-048](https://help.figma.com/hc/en-us/articles/15023202277399-Use-code-snippets-in-Dev-Mode) |

#### Security, repositories, delivery, operations, evidence, and administration

| Capability | GAEP maturity | Verified Products | Partially supported Products | Unknown count | Official Evidence |
| --- | --- | --- | --- | --- | --- |
| GAEP-CAP-121 — Security, privacy, policy and compliance governance | partial | None established | Kiro, GitHub Copilot, Amazon Q Developer, GitLab, Polarion ALM | 10 | [GAEP-EVD-009](https://docs.gitlab.com/devsecops/), [GAEP-EVD-020](https://kiro.dev/docs/privacy-and-security/), [GAEP-EVD-029](https://docs.github.com/en/copilot/reference/supported-surfaces-for-policies), [GAEP-EVD-030](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/code-reviews.html), [GAEP-EVD-045](https://www.siemens.com/en-us/products/polarion/application-lifecycle-management/) |
| GAEP-CAP-122 — Data, API, event and integration contract governance | partial | None established | None established | 15 | No external Evidence binding |
| GAEP-CAP-123 — Repository linking and implementation topology | partial | None established | OpenAI Codex, Claude Code, GitHub Copilot, Amazon Q Developer, GitLab, Azure DevOps, Figma | 8 | [GAEP-EVD-009](https://docs.gitlab.com/devsecops/), [GAEP-EVD-023](https://learn.chatgpt.com/docs/app), [GAEP-EVD-025](https://code.claude.com/docs/en/overview), [GAEP-EVD-027](https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-coding-agent), [GAEP-EVD-030](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/code-reviews.html), [GAEP-EVD-034](https://learn.microsoft.com/en-us/azure/devops/user-guide/what-is-azure-devops?view=azure-devops), [GAEP-EVD-048](https://help.figma.com/hc/en-us/articles/15023202277399-Use-code-snippets-in-Dev-Mode) |
| GAEP-CAP-124 — Cross-repository slice distribution, synchronization and drift detection | planned-deferred-coming-soon | None established | None established | 15 | No external Evidence binding |
| GAEP-CAP-125 — Implementation agents and governed code generation | implemented-awaiting-product-owner-acceptance | None established | Kiro, GitHub Spec Kit, OpenAI Codex, Claude Code, GitHub Copilot, Amazon Q Developer | 9 | [GAEP-EVD-018](https://kiro.dev/docs/specs/), [GAEP-EVD-019](https://kiro.dev/docs/hooks/), [GAEP-EVD-021](https://github.github.com/spec-kit/reference/agentic-sdd.html), [GAEP-EVD-023](https://learn.chatgpt.com/docs/app), [GAEP-EVD-025](https://code.claude.com/docs/en/overview), [GAEP-EVD-027](https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-coding-agent), [GAEP-EVD-031](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/explain-update-code.html) |
| GAEP-CAP-126 — CI/CD, release and deployment governance | partial | Azure DevOps | GitLab | 13 | [GAEP-EVD-033](https://docs.gitlab.com/ci/), [GAEP-EVD-036](https://learn.microsoft.com/en-us/azure/devops/pipelines/get-started/what-is-azure-pipelines?view=azure-devops) |
| GAEP-CAP-127 — Runtime operations, observability, recovery and reliability | planned-deferred-coming-soon | None established | None established | 15 | No external Evidence binding |
| GAEP-CAP-128 — Audit trail, evidence records and decision history | implemented-awaiting-product-owner-acceptance | None established | GitLab, Azure DevOps, Ardoq, IBM Engineering Lifecycle Management, Polarion ALM | 10 | [GAEP-EVD-009](https://docs.gitlab.com/devsecops/), [GAEP-EVD-013](https://www.ardoq.com/platform-overview), [GAEP-EVD-034](https://learn.microsoft.com/en-us/azure/devops/user-guide/what-is-azure-devops?view=azure-devops), [GAEP-EVD-044](https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/doors-next/7.2.0?topic=requirements-traceability), [GAEP-EVD-045](https://www.siemens.com/en-us/products/polarion/application-lifecycle-management/) |
| GAEP-CAP-129 — Provider/tool neutrality, adapters and extensibility | implemented-awaiting-product-owner-acceptance | GitHub Spec Kit | OpenAI Codex, Claude Code, Figma | 11 | [GAEP-EVD-022](https://github.github.com/spec-kit/reference/integrations.html), [GAEP-EVD-023](https://learn.chatgpt.com/docs/app), [GAEP-EVD-025](https://code.claude.com/docs/en/overview), [GAEP-EVD-048](https://help.figma.com/hc/en-us/articles/15023202277399-Use-code-snippets-in-Dev-Mode) |
| GAEP-CAP-130 — Enterprise administration, deployment control, data residency and portability | partial | None established | None established | 15 | No external Evidence binding |

### Evidence review state

| Review state / depth | Official sources |
| --- | --- |
| reviewed / substantive-page-review | 22 |
| reviewed-partial / substantive-page-review | 27 |

All 49 entries use official HTTPS sources. Living pages are snapshots as of 2026-08-08; they must be reviewed on recorded triggers. A digest appears only when exact bytes were legally captured—none is implied by a URL or access date.

## 4. GAEP differentiation with current-vs-future separation

These observations derive from exact repository assertions at the recorded commit. They do not create Product Owner acceptance, market validation, readiness, security/compliance authority, or public claim permission.

| Capability | GAEP maturity | Repository observation | Limitation |
| --- | --- | --- | --- |
| GAEP-CAP-101 — Product intent and problem discovery | implemented-awaiting-product-owner-acceptance | GAEP-REP-018: Adoption review and Product definition workflows implement bounded Product intent capture. [implementation:apps/vscode/src/existing-product-adoption-review.ts@7b1d75e7685b, contract:packages/contracts/src/product.ts@67c4d2f096c4] | Repository observation does not establish Product Owner acceptance, market validation, readiness, security, compliance, or production authority. |
| GAEP-CAP-102 — Guided lifecycle navigation and user onboarding | partial | GAEP-REP-019: Product Studio and adoption flows provide guided next actions, but onboarding coverage is incomplete. [implementation:apps/vscode/src/existing-product-adoption-review.ts@7b1d75e7685b, contract:packages/contracts/src/product.ts@67c4d2f096c4] | Repository observation does not establish Product Owner acceptance, market validation, readiness, security, compliance, or production authority. |
| GAEP-CAP-103 — Source intake and reference grounding | implemented-and-automated-tested | GAEP-REP-020: Source governance contracts and engine tests implement exact candidate Source intake. [test:packages/contracts/src/source-governance.test.ts@c3574d21f21d, contract:packages/contracts/src/source-governance.ts@08d32835ffa3, test:packages/engine/src/source-governance.test.ts@63591f5916ea, implementation:packages/engine/src/source-governance.ts@ee7225b3a4e9] | Repository observation does not establish Product Owner acceptance, market validation, readiness, security, compliance, or production authority. |
| GAEP-CAP-104 — Source baseline and version control | implemented-and-automated-tested | GAEP-REP-021: Source governance contracts and engine tests implement exact Baseline membership and revisions. [test:packages/contracts/src/source-governance.test.ts@c3574d21f21d, contract:packages/contracts/src/source-governance.ts@08d32835ffa3, test:packages/engine/src/source-governance.test.ts@63591f5916ea, implementation:packages/engine/src/source-governance.ts@ee7225b3a4e9] | Repository observation does not establish Product Owner acceptance, market validation, readiness, security, compliance, or production authority. |
| GAEP-CAP-105 — Source provenance and lineage | implemented-and-automated-tested | GAEP-REP-022: Source provenance, revisions, and exported evidence implement exact lineage. [implementation:apps/vscode/src/product-journey-markdown-export.ts@4d64eb69785c, test:packages/contracts/src/source-governance.test.ts@c3574d21f21d, contract:packages/contracts/src/source-governance.ts@08d32835ffa3, implementation:packages/engine/src/repository.ts@117ec8dfd386, test:packages/engine/src/source-governance.test.ts@63591f5916ea, implementation:packages/engine/src/source-governance.ts@ee7225b3a4e9] | Repository observation does not establish Product Owner acceptance, market validation, readiness, security, compliance, or production authority. |
| GAEP-CAP-106 — Human authority and propose/review/accept/commit separation | implemented-awaiting-product-owner-acceptance | GAEP-REP-023: Canonical authoring separates proposal, review, acceptance, commit, and authority states. [implementation:apps/vscode/src/phase1-canonical-authoring.ts@a3de4c7cabe4, implementation:apps/vscode/src/product-chat-participant.ts@b83070235a04] | Repository observation does not establish Product Owner acceptance, market validation, readiness, security, compliance, or production authority. |
| GAEP-CAP-107 — Initiative definition and change boundary | implemented-and-automated-tested | GAEP-REP-024: Initiative conversational workflows implement bounded Initiative definition and revision. [implementation:apps/vscode/src/interactive-initiative-applicability-chat.ts@0eef6a2d871d, test:packages/contracts/src/initiative-entry-workflow.test.ts@5990b2aff9be, test:packages/engine/src/initiative-entry.test.ts@591f3b82198c, implementation:packages/engine/src/initiative-entry.ts@5e44aa2f9cae] | Repository observation does not establish Product Owner acceptance, market validation, readiness, security, compliance, or production authority. |
| GAEP-CAP-108 — Initiative classification, risk and exposure | implemented-and-automated-tested | GAEP-REP-025: Initiative classification contracts and tests implement classification, risk, and exposure records. [implementation:apps/vscode/src/interactive-initiative-applicability-chat.ts@0eef6a2d871d, test:packages/contracts/src/initiative-entry-workflow.test.ts@5990b2aff9be, test:packages/engine/src/initiative-entry.test.ts@591f3b82198c, implementation:packages/engine/src/initiative-entry.ts@5e44aa2f9cae] | Repository observation does not establish Product Owner acceptance, market validation, readiness, security, compliance, or production authority. |
| GAEP-CAP-109 — Initiative applicability and lifecycle tailoring | implemented-and-automated-tested | GAEP-REP-026: Applicability matrix workflows and tests implement lifecycle tailoring without absence-as-N/A. [implementation:apps/vscode/src/interactive-initiative-applicability-chat.ts@0eef6a2d871d, test:packages/contracts/src/initiative-entry-workflow.test.ts@5990b2aff9be, test:packages/engine/src/initiative-entry.test.ts@591f3b82198c, implementation:packages/engine/src/initiative-entry.ts@5e44aa2f9cae] | Repository observation does not establish Product Owner acceptance, market validation, readiness, security, compliance, or production authority. |
| GAEP-CAP-110 — Business architecture, capabilities and value streams | implemented-awaiting-product-owner-acceptance | GAEP-REP-027: Canonical Product Journey presentation and contracts represent business architecture records. [implementation:apps/vscode/src/phase1-canonical-presentation.ts@6744ed1a509c, contract:packages/contracts/src/business-understanding.ts@556908de1de2] | Repository observation does not establish Product Owner acceptance, market validation, readiness, security, compliance, or production authority. |
| GAEP-CAP-111 — Domain discovery and EventStorming | implemented-awaiting-product-owner-acceptance | GAEP-REP-028: Canonical authoring and Product Journey contracts represent domain discovery and EventStorming outputs. [implementation:apps/vscode/src/phase1-canonical-authoring.ts@a3de4c7cabe4, contract:packages/contracts/src/business-understanding.ts@556908de1de2] | Repository observation does not establish Product Owner acceptance, market validation, readiness, security, compliance, or production authority. |
| GAEP-CAP-112 — DDD strategic design, bounded contexts and context mapping | implemented-awaiting-product-owner-acceptance | GAEP-REP-029: Bounded-context and Product Journey contracts represent DDD strategic design candidates. [implementation:apps/vscode/src/phase1-canonical-authoring.ts@a3de4c7cabe4, contract:packages/contracts/src/business-understanding.ts@556908de1de2] | Repository observation does not establish Product Owner acceptance, market validation, readiness, security, compliance, or production authority. |
| GAEP-CAP-113 — Architecture views, quality attributes and ADRs | implemented-awaiting-product-owner-acceptance | GAEP-REP-030: Architecture contracts represent bounded contexts, decisions, and views; quality-attribute depth remains bounded. [contract:packages/contracts/src/bounded-context-model.ts@ace26a840313, contract:packages/contracts/src/system-solution-architecture.ts@f612bf1cdf86] | Repository observation does not establish Product Owner acceptance, market validation, readiness, security, compliance, or production authority. |
| GAEP-CAP-114 — Architecture-before-slice implementation sequencing | partial | GAEP-REP-031: Journey ordering enforces architecture before implementation authorization only partially. [implementation:apps/vscode/src/current-engine-studio-data-source.ts@d38d3e8a3979, implementation:packages/engine/src/engine.ts@891d3dee49d1] | Repository observation does not establish Product Owner acceptance, market validation, readiness, security, compliance, or production authority. |
| GAEP-CAP-115 — Phase, wave and vertical-slice planning | partial | GAEP-REP-032: Journey and export artifacts represent phased work, while full wave/slice planning remains partial. [implementation:apps/vscode/src/current-engine-studio-data-source.ts@d38d3e8a3979, implementation:apps/vscode/src/product-journey-markdown-export.ts@4d64eb69785c, contract:packages/contracts/src/user-journey-model.ts@05e1746a5ac0, implementation:packages/engine/src/engine.ts@891d3dee49d1] | Repository observation does not establish Product Owner acceptance, market validation, readiness, security, compliance, or production authority. |
| GAEP-CAP-116 — Tool-neutral Product Design preparation and handoff | partial | GAEP-REP-033: Design-import and handoff contracts support tool-neutral preparation, but adapter breadth is incomplete. [contract:packages/contracts/src/p5-handoff-package.ts@cd4a9b7e44cc, implementation:packages/design-import/src/index.ts@6bdd9fe7cff3] | Repository observation does not establish Product Owner acceptance, market validation, readiness, security, compliance, or production authority. |
| GAEP-CAP-117 — Architecture-bound backlog generation | partial | GAEP-REP-034: Product Journey export derives work structure, while full architecture-bound backlog generation remains partial. [implementation:apps/vscode/src/product-journey-markdown-export.ts@4d64eb69785c, contract:packages/contracts/src/user-journey-model.ts@05e1746a5ac0] | Repository observation does not establish Product Owner acceptance, market validation, readiness, security, compliance, or production authority. |
| GAEP-CAP-118 — Acceptance criteria, Definition of Ready and Definition of Done | partial | GAEP-REP-035: Journey and evidence contracts carry acceptance/readiness concepts, while complete DoR/DoD enforcement is partial. [implementation:apps/vscode/src/product-journey-markdown-export.ts@4d64eb69785c, contract:packages/contracts/src/evidence-registry.ts@7813f8209718, contract:packages/contracts/src/user-journey-model.ts@05e1746a5ac0, implementation:packages/engine/src/repository.ts@117ec8dfd386] | Repository observation does not establish Product Owner acceptance, market validation, readiness, security, compliance, or production authority. |
| GAEP-CAP-119 — Test design, test cases and quality assurance | implemented-awaiting-product-owner-acceptance | GAEP-REP-036: Evidence and report contracts represent tests and assurance records. [contract:packages/contracts/src/evidence-registry.ts@7813f8209718, implementation:packages/engine/src/repository.ts@117ec8dfd386] | Repository observation does not establish Product Owner acceptance, market validation, readiness, security, compliance, or production authority. |
| GAEP-CAP-120 — Requirements-to-design-to-code-to-test traceability | implemented-awaiting-product-owner-acceptance | GAEP-REP-037: Evidence and report contracts implement cross-artifact traceability records. [contract:packages/contracts/src/evidence-registry.ts@7813f8209718, implementation:packages/engine/src/repository.ts@117ec8dfd386] | Repository observation does not establish Product Owner acceptance, market validation, readiness, security, compliance, or production authority. |
| GAEP-CAP-121 — Security, privacy, policy and compliance governance | partial | GAEP-REP-038: Provider selection and extension controls implement bounded policy surfaces; compliance authority is absent. [implementation:apps/vscode/src/extension.ts@a83705110a34, contract:packages/contracts/src/provider-switch-implementation.ts@f28a306187e5] | Repository observation does not establish Product Owner acceptance, market validation, readiness, security, compliance, or production authority. |
| GAEP-CAP-122 — Data, API, event and integration contract governance | partial | GAEP-REP-039: Contracts model bounded contexts and evidence links, while complete data/API/event contract governance is partial. [contract:packages/contracts/src/bounded-context-model.ts@ace26a840313, contract:packages/contracts/src/evidence-registry.ts@7813f8209718, contract:packages/contracts/src/system-solution-architecture.ts@f612bf1cdf86, implementation:packages/engine/src/repository.ts@117ec8dfd386] | Repository observation does not establish Product Owner acceptance, market validation, readiness, security, compliance, or production authority. |
| GAEP-CAP-123 — Repository linking and implementation topology | partial | GAEP-REP-040: Current engine state links workspace and repository context, while complete implementation topology is partial. [documentation:docs/next/99_Registries_and_References/004_DEFERRED_CAPABILITY_REGISTER.md@2ca7e223ffe4, contract:packages/contracts/src/repository.ts@92ef27bf7868] | Repository observation does not establish Product Owner acceptance, market validation, readiness, security, compliance, or production authority. |
| GAEP-CAP-124 — Cross-repository slice distribution, synchronization and drift detection | planned-deferred-coming-soon | GAEP-REP-041: Cross-repository slice distribution and drift detection remains explicitly deferred. [documentation:docs/next/99_Registries_and_References/004_DEFERRED_CAPABILITY_REGISTER.md@2ca7e223ffe4] | Repository observation does not establish Product Owner acceptance, market validation, readiness, security, compliance, or production authority. |
| GAEP-CAP-125 — Implementation agents and governed code generation | implemented-awaiting-product-owner-acceptance | GAEP-REP-042: Provider adapters execute governed agent authoring and implementation interactions. [implementation:packages/adapters/claude/src/index.ts@eb3f43a54a89, implementation:packages/adapters/codex/src/index.ts@fc59a0fd0da4, implementation:packages/agent-sdk/src/index.ts@0997912ed7f1] | Repository observation does not establish Product Owner acceptance, market validation, readiness, security, compliance, or production authority. |
| GAEP-CAP-126 — CI/CD, release and deployment governance | partial | GAEP-REP-043: Managed execution contracts cover run evidence, while complete CI/CD release governance is partial. [contract:packages/contracts/src/managed-execution.ts@02e19daf659a, workflow:scripts/phase0_acceptance_report.mjs@9ae2bc5b9138] | Repository observation does not establish Product Owner acceptance, market validation, readiness, security, compliance, or production authority. |
| GAEP-CAP-127 — Runtime operations, observability, recovery and reliability | planned-deferred-coming-soon | GAEP-REP-044: Runtime operations feedback, observability, recovery, and reliability integration remains deferred. [documentation:docs/next/99_Registries_and_References/004_DEFERRED_CAPABILITY_REGISTER.md@2ca7e223ffe4, contract:packages/contracts/src/managed-execution.ts@02e19daf659a, workflow:scripts/phase0_acceptance_report.mjs@9ae2bc5b9138] | Repository observation does not establish Product Owner acceptance, market validation, readiness, security, compliance, or production authority. |
| GAEP-CAP-128 — Audit trail, evidence records and decision history | implemented-awaiting-product-owner-acceptance | GAEP-REP-045: Evidence records, audit events, revisions, and exports preserve decision history. [implementation:apps/vscode/src/product-journey-markdown-export.ts@4d64eb69785c, contract:packages/contracts/src/evidence-registry.ts@7813f8209718, implementation:packages/engine/src/repository.ts@117ec8dfd386] | Repository observation does not establish Product Owner acceptance, market validation, readiness, security, compliance, or production authority. |
| GAEP-CAP-129 — Provider/tool neutrality, adapters and extensibility | implemented-awaiting-product-owner-acceptance | GAEP-REP-046: Claude, Codex, and provider adapters implement replaceable provider interfaces. [implementation:packages/adapters/claude/src/index.ts@eb3f43a54a89, implementation:packages/adapters/codex/src/index.ts@fc59a0fd0da4, contract:packages/contracts/src/provider-switch-implementation.ts@f28a306187e5] | Repository observation does not establish Product Owner acceptance, market validation, readiness, security, compliance, or production authority. |
| GAEP-CAP-130 — Enterprise administration, deployment control, data residency and portability | partial | GAEP-REP-047: Local provider and export surfaces provide bounded administration and portability; residency controls are incomplete. [implementation:apps/vscode/src/extension.ts@a83705110a34, implementation:apps/vscode/src/product-journey-markdown-export.ts@4d64eb69785c, contract:packages/contracts/src/provider-switch-implementation.ts@f28a306187e5, implementation:packages/engine/src/repository.ts@117ec8dfd386] | Repository observation does not establish Product Owner acceptance, market validation, readiness, security, compliance, or production authority. |

GAEP's candidate distinction is the combination of governed sources, explicit human proposal/review/accept/commit authority, Initiative tailoring, cross-lifecycle traceability, and provider/tool portability. Each element must be stated at its exact maturity. Planned work is not comparable to another Product's shipped feature as equivalent delivery.

## 5. Executive adoption decision guide

Do not choose from brand familiarity, AI novelty, or the count table. Select a scenario, inspect relevant cells and Unknowns, then run a bounded proof of value.

### Product and executive governance

**Decision criteria:** Auditability and portability; Governed source grounding and provenance; Human authority and proposal/accept/commit separation; Initiative classification, applicability, and tailoring; Product intent and discovery; Tests, assurance, traceability, and evidence.

**Fit:** Need durable Product/Initiative evidence and human decision separation.

**Non-fit:** Need is only code completion.

**Risks and trade-offs:** Additional governance can increase author and reviewer burden; Incomplete evidence can preserve uncertainty rather than produce an immediate answer.

**Build/buy/adopt/augment:** Adopt GAEP only after a bounded proof of value; Augment authoritative incumbent systems when their specialization should remain; Build only the missing governed semantics and adapters; Buy a narrower established product when it satisfies the complete job.

**Evaluation questions:** What evidence must survive tool changes?; Which human decisions must remain explicit?.

Applicable capabilities: Product intent and problem discovery, Source intake and reference grounding, Source baseline and version control, Source provenance and lineage, Human authority and propose/review/accept/commit separation, Initiative classification, risk and exposure, Initiative applicability and lifecycle tailoring, Test design, test cases and quality assurance, Requirements-to-design-to-code-to-test traceability, Audit trail, evidence records and decision history, Enterprise administration, deployment control, data residency and portability. Ranking policy: **no-total-score-preserve-unknowns**.

### Product and business architecture

**Decision criteria:** Architecture views and decisions; Business architecture; Domain discovery, EventStorming, and DDD; Governed source grounding and provenance; Human authority and proposal/accept/commit separation; Product intent and discovery; Tests, assurance, traceability, and evidence.

**Fit:** Need trace from discovery into capability/value/operating models.

**Non-fit:** A simple roadmap is sufficient.

**Risks and trade-offs:** Additional governance can increase author and reviewer burden; Incomplete evidence can preserve uncertainty rather than produce an immediate answer.

**Build/buy/adopt/augment:** Adopt GAEP only after a bounded proof of value; Augment authoritative incumbent systems when their specialization should remain; Build only the missing governed semantics and adapters; Buy a narrower established product when it satisfies the complete job.

**Evaluation questions:** Is domain-method depth actually applicable?; Which business models must remain governed?.

Applicable capabilities: Product intent and problem discovery, Source intake and reference grounding, Source baseline and version control, Source provenance and lineage, Human authority and propose/review/accept/commit separation, Business architecture, capabilities and value streams, Domain discovery and EventStorming, DDD strategic design, bounded contexts and context mapping, Architecture views, quality attributes and ADRs, Test design, test cases and quality assurance, Requirements-to-design-to-code-to-test traceability, Data, API, event and integration contract governance, Audit trail, evidence records and decision history. Ranking policy: **no-total-score-preserve-unknowns**.

### Enterprise and software architecture

**Decision criteria:** Architecture views and decisions; Architecture-before-slice implementation; Auditability and portability; Business architecture; Governed source grounding and provenance; Human authority and proposal/accept/commit separation; Multi-repository and repository federation; Tests, assurance, traceability, and evidence.

**Fit:** Need architecture decisions and cross-system impact.

**Non-fit:** Static diagrams alone satisfy the need.

**Risks and trade-offs:** Additional governance can increase author and reviewer burden; Incomplete evidence can preserve uncertainty rather than produce an immediate answer.

**Build/buy/adopt/augment:** Adopt GAEP only after a bounded proof of value; Augment authoritative incumbent systems when their specialization should remain; Build only the missing governed semantics and adapters; Buy a narrower established product when it satisfies the complete job.

**Evaluation questions:** How will multiple repositories remain aligned?; What architecture objects and decisions need authority?.

Applicable capabilities: Source intake and reference grounding, Source baseline and version control, Source provenance and lineage, Human authority and propose/review/accept/commit separation, Business architecture, capabilities and value streams, Architecture views, quality attributes and ADRs, Architecture-before-slice implementation sequencing, Phase, wave and vertical-slice planning, Test design, test cases and quality assurance, Requirements-to-design-to-code-to-test traceability, Data, API, event and integration contract governance, Repository linking and implementation topology, Cross-repository slice distribution, synchronization and drift detection, Audit trail, evidence records and decision history, Enterprise administration, deployment control, data residency and portability. Ranking policy: **no-total-score-preserve-unknowns**.

### Engineering delivery

**Decision criteria:** Architecture views and decisions; Architecture-before-slice implementation; Architecture-bound backlog; Implementation agents and code generation; Multi-repository and repository federation; Provider neutrality and extensibility; Release, deployment, and operations feedback; Tests, assurance, traceability, and evidence.

**Fit:** Need implementation agents tied to upstream context.

**Non-fit:** Team only needs a single coding assistant.

**Risks and trade-offs:** Additional governance can increase author and reviewer burden; Incomplete evidence can preserve uncertainty rather than produce an immediate answer.

**Build/buy/adopt/augment:** Adopt GAEP only after a bounded proof of value; Augment authoritative incumbent systems when their specialization should remain; Build only the missing governed semantics and adapters; Buy a narrower established product when it satisfies the complete job.

**Evaluation questions:** Must backlog and code trace to architecture?; Which agent effects require approval?.

Applicable capabilities: Architecture views, quality attributes and ADRs, Architecture-before-slice implementation sequencing, Phase, wave and vertical-slice planning, Architecture-bound backlog generation, Acceptance criteria, Definition of Ready and Definition of Done, Test design, test cases and quality assurance, Requirements-to-design-to-code-to-test traceability, Data, API, event and integration contract governance, Repository linking and implementation topology, Cross-repository slice distribution, synchronization and drift detection, Implementation agents and governed code generation, CI/CD, release and deployment governance, Runtime operations, observability, recovery and reliability, Audit trail, evidence records and decision history, Provider/tool neutrality, adapters and extensibility. Ranking policy: **no-total-score-preserve-unknowns**.

### Regulated or evidence-sensitive environments

**Decision criteria:** Architecture views and decisions; Auditability and portability; Enterprise privacy, deployment, and administrative controls; Governed source grounding and provenance; Human authority and proposal/accept/commit separation; Initiative classification, applicability, and tailoring; Tests, assurance, traceability, and evidence.

**Fit:** Need exact evidence, audit history, and human authority boundaries.

**Non-fit:** No organization can assign required authorities.

**Risks and trade-offs:** Additional governance can increase author and reviewer burden; Incomplete evidence can preserve uncertainty rather than produce an immediate answer.

**Build/buy/adopt/augment:** Adopt GAEP only after a bounded proof of value; Augment authoritative incumbent systems when their specialization should remain; Build only the missing governed semantics and adapters; Buy a narrower established product when it satisfies the complete job.

**Evaluation questions:** What independent assurance and retention are required?; Which regulation applies?.

Applicable capabilities: Source intake and reference grounding, Source baseline and version control, Source provenance and lineage, Human authority and propose/review/accept/commit separation, Initiative classification, risk and exposure, Initiative applicability and lifecycle tailoring, Architecture views, quality attributes and ADRs, Test design, test cases and quality assurance, Requirements-to-design-to-code-to-test traceability, Security, privacy, policy and compliance governance, Data, API, event and integration contract governance, Audit trail, evidence records and decision history, Enterprise administration, deployment control, data residency and portability. Ranking policy: **no-total-score-preserve-unknowns**.

### Teams seeking only an AI coding assistant

**Decision criteria:** Enterprise privacy, deployment, and administrative controls; Implementation agents and code generation; Provider neutrality and extensibility.

**Fit:** Need code changes, tests, and review in existing repositories.

**Non-fit:** Need a new Product governance operating model.

**Risks and trade-offs:** Additional governance can increase author and reviewer burden; Incomplete evidence can preserve uncertainty rather than produce an immediate answer.

**Build/buy/adopt/augment:** Adopt GAEP only after a bounded proof of value; Augment authoritative incumbent systems when their specialization should remain; Build only the missing governed semantics and adapters; Buy a narrower established product when it satisfies the complete job.

**Evaluation questions:** Which privacy and admin controls are mandatory?; Would a narrower coding agent minimize burden?.

Applicable capabilities: Security, privacy, policy and compliance governance, Implementation agents and governed code generation, Provider/tool neutrality, adapters and extensibility, Enterprise administration, deployment control, data residency and portability. Ranking policy: **no-total-score-preserve-unknowns**.

### Teams seeking a full Product-to-Operations governance system

**Decision criteria:** Architecture views and decisions; Architecture-before-slice implementation; Architecture-bound backlog; Auditability and portability; Business architecture; Domain discovery, EventStorming, and DDD; Enterprise privacy, deployment, and administrative controls; Governed source grounding and provenance; Human authority and proposal/accept/commit separation; Implementation agents and code generation; Initiative classification, applicability, and tailoring; Multi-repository and repository federation; Product Design and tool-neutral adapters; Product intent and discovery; Provider neutrality and extensibility; Release, deployment, and operations feedback; Tests, assurance, traceability, and evidence.

**Fit:** Need cross-functional governed truth and evidence across the lifecycle.

**Non-fit:** No capacity exists for stewardship, review, or explicit authority.

**Risks and trade-offs:** Additional governance can increase author and reviewer burden; Incomplete evidence can preserve uncertainty rather than produce an immediate answer.

**Build/buy/adopt/augment:** Adopt GAEP only after a bounded proof of value; Augment authoritative incumbent systems when their specialization should remain; Build only the missing governed semantics and adapters; Buy a narrower established product when it satisfies the complete job.

**Evaluation questions:** Can the organization sustain the governance burden?; Which current tools should GAEP augment rather than replace?.

Applicable capabilities: Product intent and problem discovery, Source intake and reference grounding, Source baseline and version control, Source provenance and lineage, Human authority and propose/review/accept/commit separation, Initiative classification, risk and exposure, Initiative applicability and lifecycle tailoring, Business architecture, capabilities and value streams, Domain discovery and EventStorming, DDD strategic design, bounded contexts and context mapping, Architecture views, quality attributes and ADRs, Architecture-before-slice implementation sequencing, Phase, wave and vertical-slice planning, Tool-neutral Product Design preparation and handoff, Architecture-bound backlog generation, Acceptance criteria, Definition of Ready and Definition of Done, Test design, test cases and quality assurance, Requirements-to-design-to-code-to-test traceability, Security, privacy, policy and compliance governance, Data, API, event and integration contract governance, Repository linking and implementation topology, Cross-repository slice distribution, synchronization and drift detection, Implementation agents and governed code generation, CI/CD, release and deployment governance, Runtime operations, observability, recovery and reliability, Audit trail, evidence records and decision history, Provider/tool neutrality, adapters and extensibility, Enterprise administration, deployment control, data residency and portability. Ranking policy: **no-total-score-preserve-unknowns**.

### Proof-of-value metrics

No benchmark value is invented. Each threshold remains a human decision until a baseline and observation plan exist.

| Metric | Definition | Baseline | Window | Data owner | Confounders | Decision threshold |
| --- | --- | --- | --- | --- | --- | --- |
| Time to decision-ready trusted context | Elapsed and active human time from bounded intent to a reviewable evidence-linked decision package. | Measure the same workflow without GAEP before pilot; no value is predeclared. | Predeclared pilot window covering comparable work items. | GAEP Metric Integrity Owner | facilitator support; participant experience; provider/model changes; work-item complexity | Must be set by an accountable human before observation; unset in P02. |
| Post-decision rework and escaped gaps | Count and severity of material corrections attributable to missing or inconsistent upstream context after a decision. | Historical comparable cases with the same severity rubric. | Decision through the predeclared downstream milestone. | GAEP Assurance Authority | case mix; delivery-team changes; reporting culture; reviewer depth | Must be predeclared with a countermetric for review burden; unset in P02. |
| Author and reviewer burden | Active author/reviewer minutes, queue delay, and mandatory interactions per governed change. | Observed current workflow segmented by role and risk. | Full author-review-decision cycle for comparable cases. | GAEP Product Owner | novelty; risk classification; tool latency; training | Must balance quality and trust outcomes; unset in P02. |

## 6. Claim registry summary

Only the exact bounded wording may be considered. Even `allowed-internal` entries remain **not approved** and **not published**. Prohibited entries are guardrails, not reusable marketing copy.

| Claim | Class | Disposition | Bounded wording | Exact support | Required qualifiers |
| --- | --- | --- | --- | --- | --- |
| GAEP-CLM-001 | substantiated-bounded-fact | allowed-internal | GAEP currently implements exact candidate Source, Baseline, Provenance, traceability, revision-history, and local audit-chain behaviors; repository tests cover the Source, Baseline, and Provenance records. | No external Evidence binding; repository: GAEP-REP-020, GAEP-REP-021, GAEP-REP-022, GAEP-REP-037, GAEP-REP-045 | Say implemented and automated-tested; do not say approved or enterprise-ready. |
| GAEP-CLM-002 | evidence-bounded-comparison | allowed-internal | The reviewed landscape is composite: coding agents, spec-driven tools, DevSecOps platforms, Product discovery tools, architecture platforms, ALM suites, and design tools cover different parts of GAEP's proposed scope. | [GAEP-EVD-003](https://kiro.dev/docs/), [GAEP-EVD-004](https://github.github.com/spec-kit/index.html), [GAEP-EVD-005](https://openai.com/index/introducing-the-codex-app/), [GAEP-EVD-006](https://code.claude.com/docs/en/overview), [GAEP-EVD-007](https://docs.github.com/en/copilot/get-started/what-is-github-copilot), [GAEP-EVD-008](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/getting-started-q-dev.html), [GAEP-EVD-009](https://docs.gitlab.com/devsecops/), [GAEP-EVD-010](https://learn.microsoft.com/en-us/azure/devops/project/navigation/go-to-service-page?view=azure-devops), [GAEP-EVD-011](https://www.atlassian.com/software/jira/product-discovery), [GAEP-EVD-012](https://support.productboard.com/hc/en-us/articles/360058147693-What-is-Productboard), [GAEP-EVD-013](https://www.ardoq.com/platform-overview), [GAEP-EVD-014](https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/lifecycle-management/7.1.0?topic=overview), [GAEP-EVD-015](https://www.siemens.com/en-gb/products/polarion/application-lifecycle-management-alm/), [GAEP-EVD-016](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode), [GAEP-EVD-050](https://www.aha.io/roadmaps/overview); repository: none | State the 2026-08-08 as-of date and reviewed-source limitations. |
| GAEP-CLM-003 | evidence-bounded-comparison | allowed-internal | A coding agent can be the better-scoped choice when the need is repository implementation assistance rather than governed Product-to-Operations decision management. | [GAEP-EVD-005](https://openai.com/index/introducing-the-codex-app/), [GAEP-EVD-006](https://code.claude.com/docs/en/overview), [GAEP-EVD-007](https://docs.github.com/en/copilot/get-started/what-is-github-copilot), [GAEP-EVD-008](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/getting-started-q-dev.html); repository: none | Describe the team's need and do not rank agent quality. |
| GAEP-CLM-004 | positioning-hypothesis | pending-human-decision | No single reviewed external Product was established as a complete direct substitute for GAEP's proposed combined category. | No external Evidence binding; repository: none | Keep as a hypothesis; never state that competitors lack a capability. |
| GAEP-CLM-005 | customer-outcome-hypothesis | prohibited | GAEP reduces delivery time, improves accuracy, and lowers engineering cost. | No external Evidence binding; repository: none | Do not use until separately measured and approved. |
| GAEP-CLM-006 | prohibited-claim | prohibited | GAEP is enterprise-ready, secure, compliant, and production-ready. | No external Evidence binding; repository: none | Do not use. |
| GAEP-CLM-007 | prohibited-claim | prohibited | GAEP is better than or superior to the evaluated alternatives. | No external Evidence binding; repository: none | Do not use or imply through ranking. |
| GAEP-CLM-008 | substantiated-bounded-fact | allowed-internal | GAEP plans repository federation and a complete operations feedback loop as future capabilities. | No external Evidence binding; repository: GAEP-REP-041, GAEP-REP-044 | Always label planned/deferred and avoid release dates. |

## 7. Limitations, unknowns and research debt

- **GAEP-DEBT-001 — Direct-competitor hypothesis.** The reviewed sample did not establish one complete direct substitute, but absence cannot be inferred. Required Evidence: Broader category interviews,Buyer shortlists,Controlled product trials. Owner: GAEP Product Research Owner. State: open.
- **GAEP-DEBT-002 — Vendor feature depth and plan boundaries.** Official overview pages do not establish every plan, deployment, data, or integration boundary. Required Evidence: Contract and plan review,Controlled trials,Current product documentation by capability. Owner: GAEP Product Research Owner. State: open.
- **GAEP-DEBT-003 — Outcome and commercial proof.** No GAEP customer cohort, baseline, observation window, or measured outcome exists. Required Evidence: Balanced metrics,Independent review,Predeclared pilot. Owner: GAEP Metric Integrity Owner. State: open.
- **GAEP-DEBT-004 — AWS AI-DLC methodology catalog ownership.** P02 resolved the seed as a methodology but cannot add normative methodology truth outside GAEP-REG-011. Required Evidence: Future P01 catalog change proposal,Method fitness and mapping review. Owner: GAEP Methodology Steward. State: open.
- **GAEP-DEBT-005 — Capability-level plan and deployment boundaries.** Official documentation does not normalize plan, region, hosting, administrative, and data-residency boundaries across vendors. Required Evidence: Current plan documentation,Procurement evidence,Security and deployment documentation. Owner: GAEP Product Research Owner. State: open.
- **GAEP-DEBT-006 — Controlled comparative Product trials.** Document review establishes bounded claims, not workflow effectiveness, usability, interoperability, or outcome quality. Required Evidence: Common task protocol,Controlled Product trials,Independent observation records. Owner: GAEP Product Research Owner. State: open.
- **GAEP-DEBT-007 — Buyer and customer landscape saturation.** The corrected sample represents declared categories but does not establish actual enterprise shortlists or market saturation. Required Evidence: Buyer shortlist interviews,Customer interviews,Independent market research. Owner: GAEP Product Research Owner. State: open.

Key limits:

- The research snapshot is current only to 2026-08-08; living vendor pages can change without versioned releases.
- Official documentation establishes publisher claims, not operational effectiveness or customer outcomes.
- No customer interviews, comparative trials, procurement diligence, security assessment, price normalization, or outcome measurement occurred in P02.
- Unknown cells are preserved, not converted to negative claims.
- No comparison proves GAEP is a better choice; the correct outcome may be a narrower tool, an existing-tool composition, or no GAEP adoption.

## 8. P03 projection contract

P03 may project category definitions, Product identities, relationship classes, the exact 30 capability labels, benchmark states, Evidence, limitations, freshness, GAEP maturity, claim disposition, scenarios, and proof-of-value definitions from GAEP-REG-013.

P03 must consume registry version and digest, preserve Unknown and current-vs-future distinctions, expose Evidence and limitations, and fail on projection drift. P03 must not copy canonical truth, approve claims, invent scores, merge Products with methodologies, or add market assertions outside GAEP-REG-013. **P03 has not started.**

## Canonical source and migration

- **Canonical market and benchmark truth:** GAEP-REG-013 v0.2.1.
- **Contract:** GAEP-REG-012 v0.2.1.
- **Methodology and standards truth:** GAEP-REG-011 remains owned by P01.
- **This document:** deterministic human projection only.
- **Legacy 17-capability taxonomy:** preserved only through the registry migration map; legacy IDs are not repurposed and one-to-many conclusions require human review.
- **Legacy external-project register:** historical cross-reference, not current benchmark authority.

P02 is not self-accepted. Independent acceptance review and explicit human authority are required before any benchmark or claim may be treated as approved or published.
