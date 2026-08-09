<!-- GENERATED FILE: edit this narrative template and GAEP-REG-014, then run npm run render:guideline. -->

# GAEP Product-to-Operations Guideline

<!-- BEGIN GENERATED:PROJECTION_HEADER -->
> **Generated surface.** Edit the narrative template or owning canonical sources—not this file. `npm run check:guideline-projection` detects drift.
>
> **Bound truth:** GAEP-REG-011 v0.4.0 (6859769b56eeae9025dfff5407113dbc7b22ec7809e518d69a399effb156b209); GAEP-REG-013 v0.2.1 (3dcfe5531a1bb4630dc3afdb2990389728e2d39cac2ac915986badb9fe9e5c17).
>
> **Authority:** Proposed, not approved, and not published. This Guide does not accept GAEP, authorize rollout, or convert evidence into organizational authority.
<!-- END GENERATED:PROJECTION_HEADER -->

This is the maintained, human-facing GAEP Product surface bundled with the VS Code extension. It uses four progressive layers: stop after the layer that answers your question, or continue for the evidence and methodology details.

<!-- BEGIN HAND-AUTHORED NARRATIVE -->

## 1. Executive orientation

_For executives, Product leaders, and evaluation sponsors · about 5 minutes_

### What GAEP is — and is not

GAEP is a proposed evidence-governed Product-to-Operations decision system. It keeps Product intent, Initiative decisions, sources, architecture, design, delivery, and operating evidence connected while preserving explicit human authority.

GAEP is not a coding-agent leaderboard, an automatic approval system, a replacement for specialist tools, or evidence that an outcome has been achieved. Current repository behavior, Product Owner acceptance, organizational authorization, market evidence, and future plans are separate dimensions.

<!-- BEGIN GENERATED:EXECUTIVE_FACTS -->
**Evidence snapshot:** 15 evaluated Products/projects · 30 vendor-neutral capabilities · 450 evidence-bounded benchmark cells · 16 assessed methodology/reference sources · 7 adoption scenarios.

**Current GAEP repository maturity:**

- 6 implemented and automated-tested
- 11 implemented, awaiting Product Owner acceptance
- 11 partial
- 2 planned/deferred
- 0 approved or published by this projection
<!-- END GENERATED:EXECUTIVE_FACTS -->

### The operating model in one view

<!-- BEGIN GENERATED:EXECUTIVE_OPERATING_MODEL -->
<!-- GAEP-VISUAL:executive-operating-model -->

**Evidence-governed operating model**

```mermaid
%% Evidence-governed operating model
flowchart TD
  intent["Product intent and bounded problem"]
  sources["Exact Sources, Baseline, and Provenance"]
  decision["Human-governed Initiative decisions"]
  architecture["Business, domain, and solution architecture"]
  design["Product Design and architecture-bound backlog"]
  delivery["Governed implementation, QA, and release evidence"]
  operations["Operations, recovery, and feedback"]
  intent --> sources --> decision --> architecture --> design --> delivery --> operations
  operations -. new evidence or changed context .-> intent
```
<!-- END GENERATED:EXECUTIVE_OPERATING_MODEL -->

The thread is intentionally vertical: evidence grounds a candidate; a human reviews and decides; committed truth constrains downstream work; runtime feedback can trigger a new governed change. Skipping a decision does not silently turn it into “not applicable.”

### Authority and evidence boundary

<!-- BEGIN GENERATED:AUTHORITY_LOOP -->
<!-- GAEP-VISUAL:authority-loop -->

**Human authority loop**

```mermaid
%% Human authority loop
flowchart TD
  evidence["Evidence and governed context"] --> candidate["AI or tool prepares a candidate"]
  candidate --> review["Human reviews exact content and limitations"]
  review --> decision{"Accept this exact candidate?"}
  decision -- "No: revise or cancel" --> candidate
  decision -- "Yes: explicit acceptance" --> commit["Explicit commit creates governed state"]
  commit --> separate["Approval, publication, rollout, and operations authority remain separate"]
```
<!-- END GENERATED:AUTHORITY_LOOP -->

AI and tools may propose, challenge, summarize, compare, and prepare evidence. A human remains accountable for acceptance, commit, approval, publication, rollout, and organizational authority. “Implemented and automated-tested” is repository evidence—not Product Owner acceptance, enterprise readiness, security certification, compliance, production authorization, or outcome proof.

## 2. Quick start

_For a first GAEP session · about 10 minutes_

### Your first governed session

Open **GAEP: Open Guide** from the Command Palette at any time. In Chat, address `@gaep`; commands below are verified against the extension package during generation.

<!-- BEGIN GENERATED:QUICK_START_FLOW -->
<!-- GAEP-VISUAL:quick-start-flow -->

**First-session path**

```mermaid
%% First-session path
flowchart TD
  open["Open a trusted Product workspace"] --> status["@gaep /status"]
  status --> adopt{"Existing Product?"}
  adopt -- "Yes" --> existing["@gaep /adopt"]
  adopt -- "No" --> initialize["@gaep /initialize"]
  existing --> next["@gaep /continue"]
  initialize --> next
  next --> author["@gaep /author"] --> review["Inspect and challenge exact candidate"]
  review --> accept["@gaep /accept"] --> commit["@gaep /commit CONFIRM"]
```
<!-- END GENERATED:QUICK_START_FLOW -->

Practical first steps:

1. Run `@gaep /status` to see governed state, current work, and the next valid action.
2. For an existing Product, run `@gaep /adopt`; for a bounded attached document question, use `@gaep /intake`.
3. Use `@gaep /continue` to enter the next valid workflow and `@gaep /author` when a Product Journey record is ready to propose.
4. Inspect the candidate. Use `@gaep /accept` only after review, then `@gaep /commit CONFIRM` only when the exact candidate should become governed state.

Adding a useful link records the link; it does not fetch, read, or approve the linked content. Attach or ingest exact material when its content must become evidence.

### Where you are and what happens next

<!-- BEGIN GENERATED:CURRENT_RUNTIME -->
<!-- GAEP-VISUAL:where-you-are -->

**Current runtime checkpoint path**

```mermaid
%% Current runtime checkpoint path
flowchart TD
  r01["1. Product definition"]
  r02["2. Initiative definition"]
  r03["3. Initiative classification"]
  r04["4. Initiative applicability"]
  r05["5. Source intake"]
  r06["6. Source baseline"]
  r07["7. Source provenance"]
  r08["8. Product discovery"]
  r09["9. Business architecture"]
  r10["10. Solution and security architecture"]
  r11["11. Detailed design and assurance"]
  r12["12. Design and implementation handoff (legacy wording below)"]
  r01 --> r02 --> r03 --> r04 --> r05 --> r06 --> r07 --> r08 --> r09 --> r10 --> r11 --> r12
```

<details>
<summary><strong>Exact current checkpoint IDs</strong></summary>

- `product-definition` — Product definition
- `initiative-definition` — Initiative definition
- `initiative-classification` — Initiative classification
- `initiative-applicability` — Initiative applicability
- `source-intake` — Source intake
- `source-baseline` — Source baseline
- `source-provenance` — Source provenance
- `product-discovery` — Product discovery
- `business-architecture` — Business architecture
- `solution-security-architecture` — Solution and security architecture
- `detailed-design-assurance` — Detailed design and assurance
- `design-implementation-handoff` — Design and implementation handoff (legacy wording; see compatibility note)

</details>

> **Compatibility note — current runtime only:** the existing final checkpoint label is “Pre-Figma readiness and handoff.” The target lifecycle and all new guidance use the tool-neutral canonical stage “Product Design preparation and evidence.”
<!-- END GENERATED:CURRENT_RUNTIME -->

The target lifecycle in Layer 3 is broader than today’s runtime checkpoint vocabulary. Treat the target as an honest map of current, partial, and planned coverage—not as a claim that every node is already automated.

## 3. Practitioner guide

_For Product, architecture, design, engineering, assurance, and operations practitioners · about 20 minutes_

### Target Product-to-Operations lifecycle

<!-- BEGIN GENERATED:STATE_LEGEND -->
| Visible state | Canonical machine value |
|---|---|
| [UN] Unknown / not assessed | unknown-not-assessed |
| [PD] Planned / deferred | planned-deferred-coming-soon |
| [CP] Candidate / proposed | candidate-proposed |
| [PT] Partial | partial |
| [IA] Implemented; awaiting Product Owner acceptance | implemented-awaiting-product-owner-acceptance |
| [IT] Implemented and automated-tested | implemented-and-automated-tested |

**Unknown rule:** Unknown means not assessed or not established; it never means No.

**Accessibility rule:** Every state uses text and a two-letter marker; color is supplementary only.
<!-- END GENERATED:STATE_LEGEND -->

The lifecycle is split into three linked vertical views so it remains readable in narrow and wide VS Code panes. Every status is derived conservatively from the exact capability maturity records in the bound P02 registry.

<!-- BEGIN GENERATED:TARGET_LIFECYCLE -->
<!-- GAEP-VISUAL:lifecycle-discover-define -->

**Lifecycle 1–6: discover and define**

```mermaid
%% Lifecycle 1–6: discover and define
flowchart TD
  lifecycle_01["1. [PT] Product intent and problem discovery<br/>GAEP-CAP-101, GAEP-CAP-102"]
  lifecycle_02["2. [IT] Initial source and reference grounding<br/>GAEP-CAP-103, GAEP-CAP-104, GAEP-CAP-105"]
  lifecycle_03["3. [IA] Product and Initiative definition<br/>GAEP-CAP-106, GAEP-CAP-107"]
  lifecycle_04["4. [IT] Initiative classification and applicability<br/>GAEP-CAP-108, GAEP-CAP-109"]
  lifecycle_05["5. [IA] Product discovery<br/>GAEP-CAP-101"]
  lifecycle_06["6. [IA] Business architecture and value streams<br/>GAEP-CAP-110"]
  lifecycle_01 --> lifecycle_02 --> lifecycle_03 --> lifecycle_04 --> lifecycle_05 --> lifecycle_06
```

↓ Continue to architecture and planning

<!-- GAEP-VISUAL:lifecycle-architecture-plan -->

**Lifecycle 7–13: architecture and planning**

```mermaid
%% Lifecycle 7–13: architecture and planning
flowchart TD
  lifecycle_07["7. [IA] Domain discovery and EventStorming<br/>GAEP-CAP-111"]
  lifecycle_08["8. [IA] DDD strategic design<br/>GAEP-CAP-112"]
  lifecycle_09["9. [PT] Solution, data, integration, security, privacy, and quality architecture<br/>GAEP-CAP-113, GAEP-CAP-121, GAEP-CAP-122, GAEP-CAP-129, GAEP-CAP-130"]
  lifecycle_10["10. [PT] Architecture decisions and quality scenarios<br/>GAEP-CAP-113, GAEP-CAP-114"]
  lifecycle_11["11. [PT] Phase, wave, and vertical-slice planning<br/>GAEP-CAP-115"]
  lifecycle_12["12. [PT] Product Design preparation and evidence<br/>GAEP-CAP-116"]
  lifecycle_13["13. [PT] Architecture-bound backlog<br/>GAEP-CAP-117, GAEP-CAP-118"]
  lifecycle_07 --> lifecycle_08 --> lifecycle_09 --> lifecycle_10 --> lifecycle_11 --> lifecycle_12 --> lifecycle_13
```

↓ Continue to delivery and operations

<!-- GAEP-VISUAL:lifecycle-deliver-operate -->

**Lifecycle 14–19: delivery and operations**

```mermaid
%% Lifecycle 14–19: delivery and operations
flowchart TD
  lifecycle_14["14. [PT] Repository and implementation topology<br/>GAEP-CAP-123"]
  lifecycle_15["15. [PD] Cross-repository slice distribution and traceability<br/>GAEP-CAP-120, GAEP-CAP-124"]
  lifecycle_16["16. [IA] Governed implementation<br/>GAEP-CAP-125"]
  lifecycle_17["17. [IA] QA and Product acceptance<br/>GAEP-CAP-119"]
  lifecycle_18["18. [PT] CI/CD, release, and deployment governance<br/>GAEP-CAP-126"]
  lifecycle_19["19. [PD] Runtime operations, recovery, and feedback<br/>GAEP-CAP-127, GAEP-CAP-128"]
  lifecycle_14 --> lifecycle_15 --> lifecycle_16 --> lifecycle_17 --> lifecycle_18 --> lifecycle_19
```

<details>
<summary><strong>Exact capability-to-node derivation</strong></summary>

| # | Target node | Conservative node state | Source capability states |
|---:|---|---|---|
| 1 | Product intent and problem discovery | [PT] Partial | GAEP-CAP-101 implemented-awaiting-product-owner-acceptance; GAEP-CAP-102 partial |
| 2 | Initial source and reference grounding | [IT] Implemented and automated-tested | GAEP-CAP-103 implemented-and-automated-tested; GAEP-CAP-104 implemented-and-automated-tested; GAEP-CAP-105 implemented-and-automated-tested |
| 3 | Product and Initiative definition | [IA] Implemented; awaiting Product Owner acceptance | GAEP-CAP-106 implemented-awaiting-product-owner-acceptance; GAEP-CAP-107 implemented-and-automated-tested |
| 4 | Initiative classification and applicability | [IT] Implemented and automated-tested | GAEP-CAP-108 implemented-and-automated-tested; GAEP-CAP-109 implemented-and-automated-tested |
| 5 | Product discovery | [IA] Implemented; awaiting Product Owner acceptance | GAEP-CAP-101 implemented-awaiting-product-owner-acceptance |
| 6 | Business architecture and value streams | [IA] Implemented; awaiting Product Owner acceptance | GAEP-CAP-110 implemented-awaiting-product-owner-acceptance |
| 7 | Domain discovery and EventStorming | [IA] Implemented; awaiting Product Owner acceptance | GAEP-CAP-111 implemented-awaiting-product-owner-acceptance |
| 8 | DDD strategic design | [IA] Implemented; awaiting Product Owner acceptance | GAEP-CAP-112 implemented-awaiting-product-owner-acceptance |
| 9 | Solution, data, integration, security, privacy, and quality architecture | [PT] Partial | GAEP-CAP-113 implemented-awaiting-product-owner-acceptance; GAEP-CAP-121 partial; GAEP-CAP-122 partial; GAEP-CAP-129 implemented-awaiting-product-owner-acceptance; GAEP-CAP-130 partial |
| 10 | Architecture decisions and quality scenarios | [PT] Partial | GAEP-CAP-113 implemented-awaiting-product-owner-acceptance; GAEP-CAP-114 partial |
| 11 | Phase, wave, and vertical-slice planning | [PT] Partial | GAEP-CAP-115 partial |
| 12 | Product Design preparation and evidence | [PT] Partial | GAEP-CAP-116 partial |
| 13 | Architecture-bound backlog | [PT] Partial | GAEP-CAP-117 partial; GAEP-CAP-118 partial |
| 14 | Repository and implementation topology | [PT] Partial | GAEP-CAP-123 partial |
| 15 | Cross-repository slice distribution and traceability | [PD] Planned / deferred | GAEP-CAP-120 implemented-awaiting-product-owner-acceptance; GAEP-CAP-124 planned-deferred-coming-soon |
| 16 | Governed implementation | [IA] Implemented; awaiting Product Owner acceptance | GAEP-CAP-125 implemented-awaiting-product-owner-acceptance |
| 17 | QA and Product acceptance | [IA] Implemented; awaiting Product Owner acceptance | GAEP-CAP-119 implemented-awaiting-product-owner-acceptance |
| 18 | CI/CD, release, and deployment governance | [PT] Partial | GAEP-CAP-126 partial |
| 19 | Runtime operations, recovery, and feedback | [PD] Planned / deferred | GAEP-CAP-127 planned-deferred-coming-soon; GAEP-CAP-128 implemented-awaiting-product-owner-acceptance |

</details>
<!-- END GENERATED:TARGET_LIFECYCLE -->

Architecture and DDD precede architecture-bound backlog. Product Design is the canonical tool-neutral target stage. Repository distribution, CI/CD governance, and runtime feedback remain visibly partial or planned where the evidence says so.

### Source grounding and provenance

<!-- BEGIN GENERATED:SOURCE_LINEAGE -->
<!-- GAEP-VISUAL:source-lineage -->

**Source-to-decision lineage**

```mermaid
%% Source-to-decision lineage
flowchart TD
  material["Exact attached or ingested material"] --> source["Candidate Source record"]
  source --> baseline["Explicit Baseline membership and revision"]
  baseline --> provenance["Provenance, locator, limitations, and lineage"]
  provenance --> candidate["Bounded downstream candidate"]
  candidate --> human["Human review and explicit decision"]
  human --> governed["Governed record with trace back to exact evidence"]
  unknown["Missing or unreviewed evidence"] -. stays visible as Unknown .-> candidate
```
<!-- END GENERATED:SOURCE_LINEAGE -->

A Source is a governed reference candidate, not automatic truth. A Baseline fixes exact membership and revisions for a bounded context. Provenance records lineage and limitations. A downstream record should point to the exact evidence that informed it and preserve uncertainty that was not resolved.

For source-sensitive work, use `@gaep /intake` to reason over explicitly attached content, `@gaep /record` to preserve reviewed files as candidate Sources, `@gaep /baseline` to propose exact membership, and `@gaep /provenance` to propose conservative lineage. Each proposal still requires review and explicit commit.

### Market and capability decision support

<!-- BEGIN GENERATED:MARKET_GUIDE -->
Bound to **GAEP-REG-013 v0.2.1**, research snapshot **2026-08-08**. The benchmark has **15 Products/projects × 30 capabilities = 450 cells**.

#### Evaluated Products and projects

<!-- BEGIN GENERATED:MARKET_PRODUCTS -->
- **GAEP-PRD-001 · [Kiro](https://kiro.dev/docs/)** — GAEP-CAT-002, GAEP-CAT-003 · reviewed 2026-08-08 · active-current
- **GAEP-PRD-002 · [GitHub Spec Kit](https://github.github.com/spec-kit/index.html)** — GAEP-CAT-002 · reviewed 2026-08-08 · active-current
- **GAEP-PRD-003 · [OpenAI Codex](https://openai.com/index/introducing-the-codex-app/)** — GAEP-CAT-003 · reviewed 2026-08-08 · active-current
- **GAEP-PRD-004 · [Claude Code](https://code.claude.com/docs/en/overview)** — GAEP-CAT-003 · reviewed 2026-08-08 · active-current
- **GAEP-PRD-005 · [GitHub Copilot](https://docs.github.com/en/copilot/get-started/what-is-github-copilot)** — GAEP-CAT-003 · reviewed 2026-08-08 · active-current
- **GAEP-PRD-006 · [Amazon Q Developer](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/getting-started-q-dev.html)** — GAEP-CAT-003 · reviewed 2026-08-08 · active-current
- **GAEP-PRD-007 · [GitLab](https://docs.gitlab.com/devsecops/)** — GAEP-CAT-004 · reviewed 2026-08-08 · active-current
- **GAEP-PRD-008 · [Azure DevOps](https://learn.microsoft.com/en-us/azure/devops/project/navigation/go-to-service-page?view=azure-devops)** — GAEP-CAT-004 · reviewed 2026-08-08 · active-current
- **GAEP-PRD-009 · [Jira Product Discovery](https://www.atlassian.com/software/jira/product-discovery)** — GAEP-CAT-005 · reviewed 2026-08-08 · active-current
- **GAEP-PRD-010 · [Productboard](https://support.productboard.com/hc/en-us/articles/360058147693-What-is-Productboard)** — GAEP-CAT-005 · reviewed 2026-08-08 · active-current
- **GAEP-PRD-011 · [Ardoq](https://www.ardoq.com/platform-overview)** — GAEP-CAT-006 · reviewed 2026-08-08 · active-current
- **GAEP-PRD-012 · [IBM Engineering Lifecycle Management](https://www.ibm.com/docs/en/engineering-lifecycle-management-suite/lifecycle-management/7.1.0?topic=overview)** — GAEP-CAT-007 · reviewed 2026-08-08 · active-current
- **GAEP-PRD-013 · [Polarion ALM](https://www.siemens.com/en-gb/products/polarion/application-lifecycle-management-alm/)** — GAEP-CAT-007 · reviewed 2026-08-08 · active-current
- **GAEP-PRD-014 · [Figma](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode)** — GAEP-CAT-008 · reviewed 2026-08-08 · active-current
- **GAEP-PRD-016 · [Aha! Roadmaps](https://www.aha.io/roadmaps/overview)** — GAEP-CAT-006, GAEP-CAT-007 · reviewed 2026-08-08 · active-current
<!-- END GENERATED:MARKET_PRODUCTS -->

#### Methodologies and references kept outside Product scoring

<!-- BEGIN GENERATED:MARKET_METHODOLOGIES -->
- **GAEP-MTH-001 · AWS AI-Driven Development Life Cycle** — external-research-candidate. P02 records identity and market relevance only; methodology truth is not added to GAEP-REG-011 by this correction.
- **GAEP-MTH-002 · The TOGAF Standard, 10th Edition** — p01-catalog-reference · GAEP-XREF-021. Canonical methodology truth remains in GAEP-REG-011.
- **GAEP-MTH-003 · The C4 model for visualising software architecture** — p01-catalog-reference · GAEP-XREF-022. Canonical methodology truth remains in GAEP-REG-011.
- **GAEP-MTH-004 · Domain-Driven Design Reference** — p01-catalog-reference · GAEP-XREF-026. Canonical methodology truth remains in GAEP-REG-011.
- **GAEP-MTH-005 · Introducing EventStorming** — p01-catalog-reference · GAEP-XREF-027. Canonical methodology truth remains in GAEP-REG-011.
<!-- END GENERATED:MARKET_METHODOLOGIES -->

#### Exact 30-capability view

<details>
<summary><strong>Show all capability and support/delivery summaries</strong></summary>

- **GAEP-CAP-101 — Product intent and problem discovery** · GAEP [IA] Implemented; awaiting Product Owner acceptance · market evidence: 0 Verified / 3 Partial / 12 Unknown · delivery: 3 shipped / 12 not established as shipped
- **GAEP-CAP-102 — Guided lifecycle navigation and user onboarding** · GAEP [PT] Partial · market evidence: 0 Verified / 4 Partial / 11 Unknown · delivery: 4 shipped / 11 not established as shipped
- **GAEP-CAP-103 — Source intake and reference grounding** · GAEP [IT] Implemented and automated-tested · market evidence: 0 Verified / 0 Partial / 15 Unknown · delivery: 0 shipped / 15 not established as shipped
- **GAEP-CAP-104 — Source baseline and version control** · GAEP [IT] Implemented and automated-tested · market evidence: 0 Verified / 0 Partial / 15 Unknown · delivery: 0 shipped / 15 not established as shipped
- **GAEP-CAP-105 — Source provenance and lineage** · GAEP [IT] Implemented and automated-tested · market evidence: 0 Verified / 0 Partial / 15 Unknown · delivery: 0 shipped / 15 not established as shipped
- **GAEP-CAP-106 — Human authority and propose/review/accept/commit separation** · GAEP [IA] Implemented; awaiting Product Owner acceptance · market evidence: 0 Verified / 2 Partial / 13 Unknown · delivery: 2 shipped / 13 not established as shipped
- **GAEP-CAP-107 — Initiative definition and change boundary** · GAEP [IT] Implemented and automated-tested · market evidence: 0 Verified / 3 Partial / 12 Unknown · delivery: 3 shipped / 12 not established as shipped
- **GAEP-CAP-108 — Initiative classification, risk and exposure** · GAEP [IT] Implemented and automated-tested · market evidence: 0 Verified / 0 Partial / 15 Unknown · delivery: 0 shipped / 15 not established as shipped
- **GAEP-CAP-109 — Initiative applicability and lifecycle tailoring** · GAEP [IT] Implemented and automated-tested · market evidence: 0 Verified / 0 Partial / 15 Unknown · delivery: 0 shipped / 15 not established as shipped
- **GAEP-CAP-110 — Business architecture, capabilities and value streams** · GAEP [IA] Implemented; awaiting Product Owner acceptance · market evidence: 0 Verified / 1 Partial / 14 Unknown · delivery: 1 shipped / 14 not established as shipped
- **GAEP-CAP-111 — Domain discovery and EventStorming** · GAEP [IA] Implemented; awaiting Product Owner acceptance · market evidence: 0 Verified / 0 Partial / 15 Unknown · delivery: 0 shipped / 15 not established as shipped
- **GAEP-CAP-112 — DDD strategic design, bounded contexts and context mapping** · GAEP [IA] Implemented; awaiting Product Owner acceptance · market evidence: 0 Verified / 0 Partial / 15 Unknown · delivery: 0 shipped / 15 not established as shipped
- **GAEP-CAP-113 — Architecture views, quality attributes and ADRs** · GAEP [IA] Implemented; awaiting Product Owner acceptance · market evidence: 0 Verified / 3 Partial / 12 Unknown · delivery: 3 shipped / 12 not established as shipped
- **GAEP-CAP-114 — Architecture-before-slice implementation sequencing** · GAEP [PT] Partial · market evidence: 0 Verified / 0 Partial / 15 Unknown · delivery: 0 shipped / 15 not established as shipped
- **GAEP-CAP-115 — Phase, wave and vertical-slice planning** · GAEP [PT] Partial · market evidence: 0 Verified / 7 Partial / 8 Unknown · delivery: 7 shipped / 8 not established as shipped
- **GAEP-CAP-116 — Tool-neutral Product Design preparation and handoff** · GAEP [PT] Partial · market evidence: 0 Verified / 1 Partial / 14 Unknown · delivery: 1 shipped / 14 not established as shipped
- **GAEP-CAP-117 — Architecture-bound backlog generation** · GAEP [PT] Partial · market evidence: 0 Verified / 6 Partial / 9 Unknown · delivery: 6 shipped / 9 not established as shipped
- **GAEP-CAP-118 — Acceptance criteria, Definition of Ready and Definition of Done** · GAEP [PT] Partial · market evidence: 0 Verified / 6 Partial / 9 Unknown · delivery: 6 shipped / 9 not established as shipped
- **GAEP-CAP-119 — Test design, test cases and quality assurance** · GAEP [IA] Implemented; awaiting Product Owner acceptance · market evidence: 1 Verified / 6 Partial / 8 Unknown · delivery: 7 shipped / 8 not established as shipped
- **GAEP-CAP-120 — Requirements-to-design-to-code-to-test traceability** · GAEP [IA] Implemented; awaiting Product Owner acceptance · market evidence: 2 Verified / 4 Partial / 9 Unknown · delivery: 6 shipped / 9 not established as shipped
- **GAEP-CAP-121 — Security, privacy, policy and compliance governance** · GAEP [PT] Partial · market evidence: 0 Verified / 5 Partial / 10 Unknown · delivery: 5 shipped / 10 not established as shipped
- **GAEP-CAP-122 — Data, API, event and integration contract governance** · GAEP [PT] Partial · market evidence: 0 Verified / 0 Partial / 15 Unknown · delivery: 0 shipped / 15 not established as shipped
- **GAEP-CAP-123 — Repository linking and implementation topology** · GAEP [PT] Partial · market evidence: 0 Verified / 7 Partial / 8 Unknown · delivery: 7 shipped / 8 not established as shipped
- **GAEP-CAP-124 — Cross-repository slice distribution, synchronization and drift detection** · GAEP [PD] Planned / deferred · market evidence: 0 Verified / 0 Partial / 15 Unknown · delivery: 0 shipped / 15 not established as shipped
- **GAEP-CAP-125 — Implementation agents and governed code generation** · GAEP [IA] Implemented; awaiting Product Owner acceptance · market evidence: 0 Verified / 6 Partial / 9 Unknown · delivery: 6 shipped / 9 not established as shipped
- **GAEP-CAP-126 — CI/CD, release and deployment governance** · GAEP [PT] Partial · market evidence: 1 Verified / 1 Partial / 13 Unknown · delivery: 2 shipped / 13 not established as shipped
- **GAEP-CAP-127 — Runtime operations, observability, recovery and reliability** · GAEP [PD] Planned / deferred · market evidence: 0 Verified / 0 Partial / 15 Unknown · delivery: 0 shipped / 15 not established as shipped
- **GAEP-CAP-128 — Audit trail, evidence records and decision history** · GAEP [IA] Implemented; awaiting Product Owner acceptance · market evidence: 0 Verified / 5 Partial / 10 Unknown · delivery: 5 shipped / 10 not established as shipped
- **GAEP-CAP-129 — Provider/tool neutrality, adapters and extensibility** · GAEP [IA] Implemented; awaiting Product Owner acceptance · market evidence: 1 Verified / 3 Partial / 11 Unknown · delivery: 4 shipped / 11 not established as shipped
- **GAEP-CAP-130 — Enterprise administration, deployment control, data residency and portability** · GAEP [PT] Partial · market evidence: 0 Verified / 0 Partial / 15 Unknown · delivery: 0 shipped / 15 not established as shipped

</details>

**Interpretation:** Verified, Partial, Unknown, and unsupported-by-reviewed-evidence are evidence conclusions. Shipped, preview/beta, announced-roadmap, community-extension, inference, and not-assessed are delivery conclusions. They are never collapsed into a Yes/No score.
<!-- END GENERATED:MARKET_GUIDE -->

Use this landscape to narrow a job-to-be-done, not to manufacture a universal ranking. A Verified support cell is stronger than Partial; Unknown means the reviewed evidence did not establish the conclusion; delivery state is a separate fact. A GAEP maturity state describes repository evidence and never turns into market support or approval.

### Choose by scenario, never by a winner score

<!-- BEGIN GENERATED:SCENARIO_GUIDE -->
<!-- GAEP-VISUAL:scenario-choice -->

**Scenario-led adoption choice**

```mermaid
%% Scenario-led adoption choice
flowchart TD
  need["State the exact job and required evidence"] --> scenario["Select the closest governed scenario"]
  scenario --> fit{"Fit conditions hold and non-fit conditions do not?"}
  fit -- "No" --> narrow["Use or buy the narrower specialist Product"]
  fit -- "Yes" --> augment["Decide what GAEP augments; keep incumbent authorities"]
  augment --> measure["Predeclare baseline, observation window, burden countermetric, and decision threshold"]
  measure --> pilot["Run bounded proof of value"] --> human["Human adoption decision"]
```

| Scenario | Fit condition | Non-fit boundary |
|---|---|---|
| GAEP-SCN-001 · Product and executive governance | Need durable Product/Initiative evidence and human decision separation | Need is only code completion |
| GAEP-SCN-002 · Product and business architecture | Need trace from discovery into capability/value/operating models | A simple roadmap is sufficient |
| GAEP-SCN-003 · Enterprise and software architecture | Need architecture decisions and cross-system impact | Static diagrams alone satisfy the need |
| GAEP-SCN-004 · Engineering delivery | Need implementation agents tied to upstream context | Team only needs a single coding assistant |
| GAEP-SCN-005 · Regulated or evidence-sensitive environments | Need exact evidence, audit history, and human authority boundaries | No organization can assign required authorities |
| GAEP-SCN-006 · Teams seeking only an AI coding assistant | Need code changes, tests, and review in existing repositories | Need a new Product governance operating model |
| GAEP-SCN-007 · Teams seeking a full Product-to-Operations governance system | Need cross-functional governed truth and evidence across the lifecycle | No capacity exists for stewardship, review, or explicit authority |

#### Proof-of-value measures remain proposals

- **GAEP-MET-001 · Time to decision-ready trusted context** — unmeasured-proposal. Elapsed and active human time from bounded intent to a reviewable evidence-linked decision package. Threshold: Must be set by an accountable human before observation; unset in P02.
- **GAEP-MET-002 · Post-decision rework and escaped gaps** — unmeasured-proposal. Count and severity of material corrections attributable to missing or inconsistent upstream context after a decision. Threshold: Must be predeclared with a countermetric for review burden; unset in P02.
- **GAEP-MET-003 · Author and reviewer burden** — unmeasured-proposal. Active author/reviewer minutes, queue delay, and mandatory interactions per governed change. Threshold: Must balance quality and trust outcomes; unset in P02.
<!-- END GENERATED:SCENARIO_GUIDE -->

Before adopting or buying, state the scenario, required evidence, non-fit boundary, stewardship capacity, incumbent systems that should remain authoritative, and a predeclared proof-of-value measure. No aggregate winner score is permitted because it would erase Unknowns, delivery states, and scenario-specific tradeoffs.

## 4. Methodology and maintainer appendix

_For methodology stewards, reviewers, and maintainers · about 25 minutes_

### Methodology and reference cards

<!-- BEGIN GENERATED:METHODOLOGY_GUIDE -->
Bound to **GAEP-REG-011 v0.4.0**, checked **2026-08-07**. It contains 25 GAEP concerns, 16 assessed references, 25 exact concern mappings, and 11 deferred candidates.

> Catalog presence records evidence and candidate mappings only. It does not establish GAEP or external-reference conformance, certification, endorsement, equivalence, safety, security, readiness, approval, or authorization.

#### GAEP-XREF-001 · [Artificial Intelligence Risk Management Framework (AI RMF 1.0)](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-ai-rmf-10)

- **Type / authority:** framework · National Institute of Standards and Technology
- **Exact version:** NIST AI 100-1, Version 1.0 · evidence version-pending · reviewed 2026-08-07
- **GAEP concerns:** GAEP-MTH-CON-010
- **Use boundary:** NIST AI RMF 1.0 is an informative, voluntary AI-risk calibration source; GAEP does not claim NIST compliance, trustworthiness, safety or security.
- **Limitations:** NIST states that AI RMF 1.0 is being revised; exact successor impact is unknown. The official publication page and abstract were reviewed, not a complete function/category mapping.
- **Review trigger:** NIST publishes a revised AI RMF, changes the revision status, or GAEP proposes a function-level mapping.

#### GAEP-XREF-002 · [Artificial Intelligence Risk Management Framework: Generative Artificial Intelligence Profile](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence)

- **Type / authority:** framework · National Institute of Standards and Technology
- **Exact version:** NIST AI 600-1 · evidence primary-source-verified · reviewed 2026-08-07
- **GAEP concerns:** GAEP-MTH-CON-010
- **Use boundary:** NIST AI 600-1 is an informative Generative-AI risk profile when applicable; GAEP does not claim NIST compliance or risk-outcome achievement.
- **Limitations:** The official publication page and abstract were reviewed, not a complete action-level mapping. The profile depends on AI RMF 1.0, which is under revision.
- **Review trigger:** NIST revises AI RMF 1.0, publishes a successor profile, or GAEP proposes an action-level mapping.

#### GAEP-XREF-004 · [NIST SP 800-218 — Secure Software Development Framework (SSDF) Version 1.1: Recommendations for Mitigating the Risk of Software Vulnerabilities](https://csrc.nist.gov/pubs/sp/800/218/final)

- **Type / authority:** framework · National Institute of Standards and Technology
- **Exact version:** SP 800-218, SSDF Version 1.1 · evidence primary-source-verified · reviewed 2026-08-07
- **GAEP concerns:** GAEP-MTH-CON-009, GAEP-MTH-CON-019, GAEP-MTH-CON-023, GAEP-MTH-CON-025
- **Use boundary:** NIST SSDF 1.1 is an informative secure-development calibration source selected by applicability; GAEP does not claim NIST compliance or security outcomes from citation.
- **Limitations:** The official publication page and abstract were reviewed, not a complete requirement-by-requirement assessment. Use of SSDF practices does not prove that GAEP or a governed product is secure.
- **Review trigger:** NIST publishes a successor, material update, or GAEP proposes a practice-level mapping.

#### GAEP-XREF-005 · [ISO/IEC 25010:2023 — Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE) — Product quality model](https://www.iso.org/standard/78176.html)

- **Type / authority:** standard · ISO and IEC
- **Exact version:** 2023, Edition 2 · evidence partially-verified · reviewed 2026-08-07
- **GAEP concerns:** GAEP-MTH-CON-004, GAEP-MTH-CON-017, GAEP-MTH-CON-019
- **Use boundary:** GAEP's multidimensional product-quality concern is informed by the official abstract of ISO/IEC 25010:2023; no conformance is claimed.
- **Limitations:** Only the official ISO page and abstract were reviewed; the paid full standard was not reviewed. Specific characteristics, measures and acceptance mappings require licensed full-text review.
- **Review trigger:** ISO lifecycle status or edition changes; or GAEP selects characteristics for normative reliance.

#### GAEP-XREF-011 · [ISO/IEC/IEEE 42010:2022 — Software, systems and enterprise — Architecture description](https://www.iso.org/standard/74393.html)

- **Type / authority:** standard · ISO, IEC and IEEE
- **Exact version:** 2022, Edition 2 · evidence partially-verified · reviewed 2026-08-07
- **GAEP concerns:** GAEP-MTH-CON-003, GAEP-MTH-CON-020, GAEP-MTH-CON-021
- **Use boundary:** GAEP architecture-description concerns are informed by the official abstract of ISO/IEC/IEEE 42010:2022; no conformance or equivalent architecture-description framework is claimed.
- **Limitations:** Only the official ISO page and abstract were reviewed; the paid full standard was not reviewed. The official abstract explicitly excludes architecting processes, methods, notations, techniques and tools.
- **Review trigger:** ISO lifecycle status or edition changes; or GAEP proposes a detailed conformance mapping.

#### GAEP-XREF-012 · [ISO/IEC/IEEE 29148:2018 — Systems and software engineering — Life cycle processes — Requirements engineering](https://www.iso.org/standard/72089.html)

- **Type / authority:** standard · ISO, IEC and IEEE
- **Exact version:** 2018, Edition 2 · evidence version-pending · reviewed 2026-08-07
- **GAEP concerns:** GAEP-MTH-CON-002, GAEP-MTH-CON-018, GAEP-MTH-CON-023
- **Use boundary:** GAEP requirements concerns are calibrated against the official abstract of ISO/IEC/IEEE 29148:2018 while the edition is under revision; no conformance is claimed.
- **Limitations:** ISO marks the current edition as confirmed in 2024 but to be revised as of 2026-02-16. Only the official ISO page and abstract were reviewed; the paid full standard was not reviewed.
- **Review trigger:** Publication or cancellation of the successor revision; any GAEP normative requirements mapping.

#### GAEP-XREF-013 · [ISO/IEC/IEEE 12207:2026 — Systems and software engineering — Software life cycle processes](https://www.iso.org/standard/90219.html)

- **Type / authority:** standard · ISO, IEC and IEEE
- **Exact version:** 2026, Edition 2 · evidence partially-verified · reviewed 2026-08-07
- **GAEP concerns:** GAEP-MTH-CON-001, GAEP-MTH-CON-005, GAEP-MTH-CON-012, GAEP-MTH-CON-025
- **Use boundary:** GAEP's software lifecycle concerns are informed by the official abstract of ISO/IEC/IEEE 12207:2026; no conformance or equivalence is claimed.
- **Limitations:** Only the official ISO page and abstract were reviewed; the paid full standard was not reviewed. This 2026 edition replaced the previously catalogued 2017 edition after the old registry was written.
- **Review trigger:** ISO lifecycle status, edition, or official abstract changes; or GAEP proposes normative reliance.

#### GAEP-XREF-015 · [Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/)

- **Type / authority:** standard · World Wide Web Consortium
- **Exact version:** W3C Recommendation, 2024-12-12 · evidence primary-source-verified · reviewed 2026-08-07
- **GAEP concerns:** GAEP-MTH-CON-011, GAEP-MTH-CON-017, GAEP-MTH-CON-019
- **Use boundary:** WCAG 2.2 is the current candidate accessibility reference for applicable web scope; conformance requires a separate exact evaluation and claim.
- **Limitations:** The current official Recommendation and conformance sections were reviewed, not a criterion-by-criterion GAEP mapping. W3C says WCAG 2.2 does not supersede 2.0 or 2.1, though it advises use of 2.2 for future applicability.
- **Review trigger:** W3C issues a new Recommendation, substantive errata, or GAEP proposes a WCAG conformance claim.

#### GAEP-XREF-020 · [ISO/IEC/IEEE 15288:2023 — Systems and software engineering — System life cycle processes](https://www.iso.org/standard/81702.html)

- **Type / authority:** standard · ISO, IEC and IEEE
- **Exact version:** 2023, Edition 2 · evidence partially-verified · reviewed 2026-08-07
- **GAEP concerns:** GAEP-MTH-CON-001, GAEP-MTH-CON-005, GAEP-MTH-CON-012
- **Use boundary:** GAEP's lifecycle coverage is informed by the official abstract of ISO/IEC/IEEE 15288:2023; no conformance or equivalence is claimed.
- **Limitations:** Detailed normative mappings are prohibited without licensed full-text review and an approved mapping case. Only the official ISO page and abstract were reviewed; the paid full standard was not reviewed.
- **Review trigger:** ISO lifecycle status, edition, or official abstract changes; or GAEP proposes normative reliance.

#### GAEP-XREF-021 · [The TOGAF Standard, 10th Edition](https://publications.opengroup.org/standards/togaf)

- **Type / authority:** framework · The Open Group Architecture Forum
- **Exact version:** 10th Edition; Technical Corrigendum 1 listed separately · evidence partially-verified · reviewed 2026-08-07
- **GAEP concerns:** GAEP-MTH-CON-003, GAEP-MTH-CON-016, GAEP-MTH-CON-020 · P02 market binding GAEP-MTH-002
- **Use boundary:** TOGAF is an informative enterprise-architecture calibration source for applicable initiatives; GAEP is not represented as TOGAF-compliant.
- **Limitations:** Only current official catalog, overview and licensing pages were reviewed; the licensed full standard was not reviewed. The modular Series Guides and Technical Corrigendum require exact item-level selection before material reliance.
- **Review trigger:** A new edition, corrigendum, selected Series Guide, or proposed material TOGAF reliance.

#### GAEP-XREF-022 · [The C4 model for visualising software architecture](https://c4model.com/)

- **Type / authority:** visualization-model · Simon Brown
- **Exact version:** living official website; no numbered edition · evidence primary-source-verified · reviewed 2026-08-07
- **GAEP concerns:** GAEP-MTH-CON-003, GAEP-MTH-CON-020 · P02 market binding GAEP-MTH-003
- **Use boundary:** GAEP may use C4 as an optional architecture-visualization method when applicable; C4 is not a mandatory lifecycle or architecture method.
- **Limitations:** C4 focuses primarily on software-system static structure and supporting views, not the full business, domain, data, workflow or governance model. The source is living and has no immutable numbered edition.
- **Review trigger:** Material change to official abstractions, diagram guidance, license, or GAEP representation mapping.

#### GAEP-XREF-023 · [Manifesto for Agile Software Development and Principles behind the Agile Manifesto](https://agilemanifesto.org/)

- **Type / authority:** principle-set · The seventeen Manifesto authors
- **Exact version:** original 2001 publication · evidence primary-source-verified · reviewed 2026-08-07
- **GAEP concerns:** GAEP-MTH-CON-005, GAEP-MTH-CON-015, GAEP-MTH-CON-017, GAEP-MTH-CON-018
- **Use boundary:** GAEP is compatible with and informed by selected Agile values and principles; it is not an Agile framework or certification claim.
- **Limitations:** GAEP adapts the feedback orientation while retaining repository-visible trace and authority. Values and principles do not define GAEP governance, approval, evidence or authorization semantics.
- **Review trigger:** Official source or copyright notice changes; or a public Agile-alignment claim is proposed.

#### GAEP-XREF-024 · [DORA's software delivery performance metrics](https://dora.dev/guides/dora-metrics/)

- **Type / authority:** metric-framework · DORA
- **Exact version:** living guidance; last updated 2026-01-05 · evidence primary-source-verified · reviewed 2026-08-07
- **GAEP concerns:** GAEP-MTH-CON-005, GAEP-MTH-CON-012, GAEP-MTH-CON-025
- **Use boundary:** DORA provides an informative operational-feedback calibration source; GAEP makes no performance outcome claim without measured, context-bound evidence.
- **Limitations:** GAEP has not measured or demonstrated DORA outcomes. The official guidance is a living source and now uses a five-metric model rather than the historic four-key presentation.
- **Review trigger:** DORA changes the metric model, guidance date, research basis, or GAEP proposes a delivery-performance claim.

#### GAEP-XREF-025 · [Team Topologies: Organizing Business and Technology Teams for Fast Flow](https://teamtopologies.com/book)

- **Type / authority:** model · Matthew Skelton and Manuel Pais
- **Exact version:** Second Edition · evidence partially-verified · reviewed 2026-08-07
- **GAEP concerns:** GAEP-MTH-CON-006, GAEP-MTH-CON-021
- **Use boundary:** GAEP may use Team Topologies concepts as optional organizational-design inputs; it does not require the method or claim its outcomes.
- **Limitations:** Only official Second Edition summary and key-concept pages were reviewed; the full book was not reviewed. Organizational patterns require contextual evidence and accountable organizational authority.
- **Review trigger:** A new edition, official concept change, or GAEP organization-design claim.

#### GAEP-XREF-026 · [Domain-Driven Design Reference: Definitions and Pattern Summaries](https://www.domainlanguage.com/ddd/reference/)

- **Type / authority:** methodology · Eric Evans / Domain Language, Inc.
- **Exact version:** 2015-03 reference edition · evidence primary-source-verified · reviewed 2026-08-07
- **GAEP concerns:** GAEP-MTH-CON-003, GAEP-MTH-CON-007, GAEP-MTH-CON-015, GAEP-MTH-CON-016, GAEP-MTH-CON-020, GAEP-MTH-CON-021 · P02 market binding GAEP-MTH-004
- **Use boundary:** DDD is GAEP's proposed default strategic domain approach for applicable enterprise software-intensive profiles, not a universal requirement and not a microservices mandate.
- **Limitations:** GAEP's default applies only after Initiative applicability selects the relevant enterprise software-intensive profile. The reference is a summary complement, not a complete teaching or implementation guide.
- **Review trigger:** Official reference or license changes; or GAEP changes DDD applicability/default language.

#### GAEP-XREF-027 · [Introducing EventStorming](https://www.eventstorming.com/book/)

- **Type / authority:** method · Alberto Brandolini
- **Exact version:** living Leanpub book; incomplete · evidence partially-verified · reviewed 2026-08-07
- **GAEP concerns:** GAEP-MTH-CON-008, GAEP-MTH-CON-015, GAEP-MTH-CON-016 · P02 market binding GAEP-MTH-005
- **Use boundary:** EventStorming is a preferred collaborative behavioral-discovery option when applicable; it is not a universal GAEP ceremony or approval source.
- **Limitations:** GAEP adoption is limited to an optional preferred collaborative-discovery method when applicability and facilitation conditions fit. The official source says the book remains incomplete and under active writing.
- **Review trigger:** Book completion state, official source, or GAEP applicability language changes.

#### Deferred—not materially relied on

- **GAEP-XREF-003 · ISO/IEC 42001 artificial intelligence management system** — unresolved-not-assessed. A concrete GAEP AI-management-system concern requires assessment.
- **GAEP-XREF-006 · NIST Privacy Framework** — unresolved-not-assessed. A concrete privacy-profile mapping requires assessment.
- **GAEP-XREF-007 · NIST OSCAL** — unresolved-not-assessed. A machine-readable controls exchange requirement is selected.
- **GAEP-XREF-008 · OWASP Agentic Security Initiative** — unresolved-not-assessed. A concrete agentic-security profile mapping requires assessment.
- **GAEP-XREF-009 · ISO/IEC 27001 and NIST Cybersecurity Framework compound legacy candidate** — unresolved-must-split. A security-management concern selects each source separately.
- **GAEP-XREF-010 · ISO/IEC 27701 privacy information management** — unresolved-not-assessed. A privacy-management concern requires assessment.
- **GAEP-XREF-014 · ISO 31000 risk management** — unresolved-not-assessed. An enterprise-risk vocabulary or mapping requires assessment.
- **GAEP-XREF-016 · ISO 15489 records management family** — unresolved-must-select-family-member. A records-management concern selects an exact family member and edition.
- **GAEP-XREF-017 · SLSA and in-toto compound legacy candidate** — unresolved-must-split. A supply-chain provenance concern selects each source separately.
- **GAEP-XREF-018 · SPDX and CycloneDX compound legacy candidate** — unresolved-must-split. A component-transparency concern selects each source separately.
- **GAEP-XREF-019 · OpenTelemetry specifications** — unresolved-must-select-specification-set. An operational telemetry exchange requirement selects an exact specification set.
<!-- END GENERATED:METHODOLOGY_GUIDE -->

These sources calibrate exact GAEP concerns. Catalog presence does not mean wholesale adoption, conformance, certification, endorsement, equivalence, safety, security, readiness, approval, or authorization. Figma is a Product and optional design adapter in the market registry; it is not the canonical lifecycle name and is not a methodology.

### Claim-control ledger

<!-- BEGIN GENERATED:CLAIM_LEDGER -->
#### GAEP-CLM-001 · substantiated-bounded-fact

> GAEP currently implements exact candidate Source, Baseline, Provenance, traceability, revision-history, and local audit-chain behaviors; repository tests cover the Source, Baseline, and Provenance records.

- **Disposition:** allowed-internal
- **Authority:** not-approved; not-published; owner role GAEP Product Owner
- **Limitations:** Implementation evidence does not establish Product Owner acceptance, security certification, compliance, or production readiness.
- **Required qualifiers:** Say implemented and automated-tested; do not say approved or enterprise-ready.
- **Freshness trigger:** Relevant repository code/test or accepted baseline changes.

#### GAEP-CLM-002 · evidence-bounded-comparison

> The reviewed landscape is composite: coding agents, spec-driven tools, DevSecOps platforms, Product discovery tools, architecture platforms, ALM suites, and design tools cover different parts of GAEP's proposed scope.

- **Disposition:** allowed-internal
- **Authority:** not-approved; not-published; owner role GAEP Product Research Owner
- **Limitations:** This is a coverage observation from reviewed official sources, not a superiority or market-share claim.
- **Required qualifiers:** State the 2026-08-08 as-of date and reviewed-source limitations.
- **Freshness trigger:** Any product identity, category, capability, or reviewed evidence changes.

#### GAEP-CLM-003 · evidence-bounded-comparison

> A coding agent can be the better-scoped choice when the need is repository implementation assistance rather than governed Product-to-Operations decision management.

- **Disposition:** allowed-internal
- **Authority:** not-approved; not-published; owner role GAEP Product Research Owner
- **Limitations:** Better-scoped refers to narrower functional fit, not product quality or superiority.
- **Required qualifiers:** Describe the team's need and do not rank agent quality.
- **Freshness trigger:** Coding-agent or GAEP implementation scope changes.

#### GAEP-CLM-004 · positioning-hypothesis

> No single reviewed external Product was established as a complete direct substitute for GAEP's proposed combined category.

- **Disposition:** pending-human-decision
- **Authority:** not-approved; not-published; owner role GAEP Product Owner
- **Limitations:** Absence from reviewed evidence is not proof of market absence; broader research and Product Owner decision are required.
- **Required qualifiers:** Keep as a hypothesis; never state that competitors lack a capability.
- **Freshness trigger:** Landscape scope, evidence, or inclusion criteria changes.

#### GAEP-CLM-005 · customer-outcome-hypothesis

> GAEP reduces delivery time, improves accuracy, and lowers engineering cost.

- **Disposition:** prohibited
- **Authority:** not-approved; not-published; owner role GAEP Metric Integrity Owner
- **Limitations:** No controlled baseline, observation window, customer evidence, or decision threshold exists.
- **Required qualifiers:** Do not use until separately measured and approved.
- **Freshness trigger:** A valid outcome study and publication approval are created.

#### GAEP-CLM-006 · prohibited-claim

> GAEP is enterprise-ready, secure, compliant, and production-ready.

- **Disposition:** prohibited
- **Authority:** not-approved; not-published; owner role GAEP Assurance Authority
- **Limitations:** No exact organizational, security, compliance, certification, or readiness authority supports this statement.
- **Required qualifiers:** Do not use.
- **Freshness trigger:** Separate exact authorities and evidence are created and approved.

#### GAEP-CLM-007 · prohibited-claim

> GAEP is better than or superior to the evaluated alternatives.

- **Disposition:** prohibited
- **Authority:** not-approved; not-published; owner role GAEP Product Research Owner
- **Limitations:** No valid comparative study, agreed rubric, representative trials, or approved claim authority exists.
- **Required qualifiers:** Do not use or imply through ranking.
- **Freshness trigger:** A separately governed comparative study and approval exist.

#### GAEP-CLM-008 · substantiated-bounded-fact

> GAEP plans repository federation and a complete operations feedback loop as future capabilities.

- **Disposition:** allowed-internal
- **Authority:** not-approved; not-published; owner role GAEP Product Owner
- **Limitations:** Planned/deferred capabilities are not current or committed delivery promises.
- **Required qualifiers:** Always label planned/deferred and avoid release dates.
- **Freshness trigger:** Deferred-capability register or implementation state changes.
<!-- END GENERATED:CLAIM_LEDGER -->

The ledger is not marketing copy. It retains dispositions, qualifiers, limitations, and authority states so internal fact use cannot silently become an approved or public claim.

### Deterministic maintenance contract

<!-- BEGIN GENERATED:MAINTENANCE_CONTRACT -->
**Projection contract:** GAEP-REG-014 v0.1.0 · schema 1.0.0 · not-approved · not-published.

| Source role | Exact identity | Repository path | SHA-256 |
|---|---|---|---|
| methodology-catalog | `GAEP-REG-011` v0.4.0 | `docs/next/99_Registries_and_References/011_METHODOLOGY_REFERENCE_CATALOG.json` | `6859769b56eeae9025dfff5407113dbc7b22ec7809e518d69a399effb156b209` |
| market-registry | `GAEP-REG-013` v0.2.1 | `docs/next/99_Registries_and_References/013_MARKET_EVIDENCE_AND_BENCHMARK_REGISTRY.json` | `3dcfe5531a1bb4630dc3afdb2990389728e2d39cac2ac915986badb9fe9e5c17` |
| terminology-index | `GAEP-REG-005` v0.3.0 | `docs/next/99_Registries_and_References/005_CANONICAL_TERMINOLOGY_INDEX.md` | `9e5765683133d3904742bd9a05be7a3323d83848b7015d06a864f5e37af6aca5` |
| runtime-checkpoints | `runtime-product-journey-checkpoints` | `apps/vscode/src/existing-product-journey-coverage.ts` | `9665f13fe3c5cf2411c8b7d9404938eee06035b818e46d3df815f62916549d3a` |
| extension-package | `gaep-vscode-package` v0.1.0 | `apps/vscode/package.json` | `82d4235bea19ec54a4fd649261c37e8cb3a13f6c7823c169a88d66fc899a1e8b` |

**Required progressive layers:**

- **Executive orientation** — Executives, Product leaders, and evaluation sponsors; 5-minute route
- **Quick start** — First-time GAEP users; 10-minute route
- **Practitioner guide** — Product, architecture, design, engineering, assurance, and operations practitioners; 20-minute route
- **Methodology and maintainer appendix** — Methodology stewards, reviewers, and maintainers; 25-minute route

**Required visual inventory:** executive-operating-model, authority-loop, quick-start-flow, where-you-are, lifecycle-discover-define, lifecycle-architecture-plan, lifecycle-deliver-operate, source-lineage, scenario-choice. All are vertical (TD/TB), use text labels, and rely on host light/dark Mermaid theming.

**Deterministic commands:**

- `npm run validate:guideline` — strict Schema, binding, lifecycle, authority, and command validation
- `npm run render:guideline` — regenerate the bundled Markdown from canonical inputs and this template
- `npm run check:guideline-projection` — fail on manual edits or stale generated facts
- `npm run test:guideline` — run Schema, hostile semantic, projection, packaging, and drift coverage
<!-- END GENERATED:MAINTENANCE_CONTRACT -->

To change generated facts, update their owning canonical source first. To change explanation or reading flow, edit this narrative template. To change projection structure, lifecycle mappings, required visuals, or bindings, update `GAEP-REG-014`. Then run `npm run render:guideline` and `npm run test:guideline`.

Do not edit the generated Guide directly. CI validates the strict manifest, exact source identities/versions/digests, runtime checkpoint and command projections, all required audience layers and visuals, semantic authority boundaries, and byte-for-byte output freshness.

<!-- END HAND-AUTHORED NARRATIVE -->
