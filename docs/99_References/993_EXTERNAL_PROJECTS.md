# External Projects

**Governed AI Engineering Platform (GAEP)**  
**Document ID:** GAEP-REF-993  
**Version:** 1.0  
**Status:** Draft  
**Authority:** External-project evaluation and integration registry

> **Historical authority notice (P02):** This Draft is preserved as historical research input. It is no longer a current market-category, competitor, benchmark, or executive-claim authority. Current Proposed market evidence and relationship classifications are owned by `GAEP-REG-013` and projected through `GAEP-STR-004`; methodology and standards truth remains in `GAEP-REG-011`. Nothing in that migration approves an external project, claim, integration, purchase, or publication.

## Purpose

This document defines how GAEP evaluates external projects and records the intended relationship to significant candidates mentioned in the founding context.

## Evaluation Rule

External projects are references, dependencies, adapters, or execution methods. They are never accepted as architectural truth without evaluation and a recorded decision.

Capabilities and licenses change. Before adoption, use current primary documentation and repeat the evaluation.

## Evaluation Criteria

### Strategic Fit

- Does the project support GAEP's product-engineering scope?
- Does it strengthen governance, context, traceability, evidence, or reuse?
- Is the capability core, replaceable, or optional?

### Architecture

- Are boundaries and contracts compatible?
- Can integration occur through an adapter?
- Does it introduce duplicated source of truth?
- What state, event, and artifact mappings are needed?

### Governance and Security

- Identity and access model;
- data use and retention;
- external transmission;
- audit and approval behavior;
- supply-chain and package provenance;
- secret and credential handling;
- license and compliance.

### Operations

- maturity and maintenance;
- deployment and upgrade model;
- observability and recovery;
- compatibility and migration;
- cost, performance, and support;
- exit strategy.

### AI Quality

For agent or model projects:

- context transparency;
- tool and side-effect control;
- stop and confirmation behavior;
- evaluation evidence;
- model/provider portability;
- reproducibility and provenance.

## Relationship Types

- **Inspiration:** ideas inform GAEP; no dependency.
- **Reference Implementation:** demonstrates a concept for comparison.
- **Execution Method:** optional workflow operating under GAEP governance.
- **Adapter Target:** external system connected through a replaceable integration.
- **Dependency:** required implementation component; needs architecture approval.
- **Interoperability Standard:** adopted contract or format.
- **Rejected/Deferred:** evaluated but unsuitable or not timely.

## Candidate: Awesome Context Engineering

Source: [Meirtz/Awesome-Context-Engineering](https://github.com/Meirtz/Awesome-Context-Engineering)

Proposed relationship: **Inspiration and research index**.

Use:

- study context-engineering concepts;
- discover primary sources and evaluation approaches;
- compare context organization, retrieval, and memory ideas.

Do not:

- copy structure blindly;
- treat curated links as governing authority;
- import content without license and provenance review;
- replace GAEP's authority, state, and approval semantics.

## Candidate: AI-DLC Implementations

No exact AI-DLC implementation or version was identifiable from the available founding conversation. Any future candidate must be registered and evaluated as a specific project and version before adoption.

Proposed relationship: **Execution Method**.

Evaluation focus:

- lifecycle coverage and assumptions;
- artifact and state model;
- human approval and stop conditions;
- repository and context integration;
- code-generation bias;
- portability across agents;
- compatibility with GAEP packages.

GAEP decision direction: AI-DLC should be pluggable and should not become the platform kernel.

## Candidate: Codex

Proposed relationship: **Agent Adapter Target**.

GAEP mapping:

- canonical behavior: [Codex Working Model](../05_AI_Runtime/040_CODEX_WORKING_MODEL.md);
- local workspace analysis and changes through scoped runtime permissions;
- potential browser, tool, artifact, or parallel-work capabilities exposed dynamically;
- run, context, evidence, and approval remain GAEP-owned.

Adoption requires current capability, security, privacy, cost, and reliability evaluation.

## Candidate: Claude Code

Proposed relationship: **Agent Adapter Target**.

GAEP mapping:

- canonical behavior: [Claude Working Model](../05_AI_Runtime/041_CLAUDE_WORKING_MODEL.md);
- tool and context capabilities discovered dynamically;
- repository instruction formats remain adapter-specific;
- product memory and approval remain portable.

## Candidate: Cursor and Other IDE Agents

Proposed relationship: **Agent/IDE Adapter Targets**.

Evaluation focus:

- repository context selection;
- rules or instruction portability;
- model routing and data use;
- edit preview and approval;
- evidence and run export;
- workspace and tool security.

## Candidate: OpenHands and Open Agent Runtimes

Proposed relationship: **Reference Runtime or Agent Adapter Target**.

Evaluation focus:

- sandbox and tool controls;
- event and run model;
- planning, pause, resume, and recovery;
- human checkpoints;
- artifact and context integration;
- deployment and security burden.

No dependency decision is made by this document.

## Candidate: Figma

Proposed relationship: **Design Adapter Target**.

Desired integration levels:

1. stable file/node links and metadata;
2. version or snapshot evidence;
3. design-system tokens and component mapping;
4. read-only context for UX/backlog/engineering;
5. controlled design generation or update;
6. trace from journey/process to design and implementation.

GAEP must preserve design ownership, review, accessibility, and approval outside any AI generation feature.

## Candidate: Backlog Platforms

Examples may include Jira, Azure DevOps, GitHub Issues, or other systems selected by organizations.

Proposed relationship: **Backlog Adapter Targets**.

Required mappings:

- stable backlog IDs and hierarchy;
- state and workflow;
- acceptance criteria;
- relationships and dependencies;
- product trace links;
- approval or readiness evidence;
- conflict and synchronization rules.

## Candidate: Source Control and CI/CD Platforms

Proposed relationship: **Engineering and Evidence Adapter Targets**.

Integration should progress from read-only metadata to governed write and release actions. A merge or pipeline success must not be treated automatically as product approval.

## Candidate: Postman and API Tooling

Proposed relationship: **Contract and Verification Adapter Target**.

Desired mapping:

- API contracts and collections;
- environments without embedded secrets;
- test and execution evidence;
- version and source architecture trace;
- export to portable specifications where practical.

## Inspiration: Kubernetes and CNCF Projects

Proposed relationship: **Architectural and Governance Inspiration**.

Relevant themes:

- declarative desired state;
- reconciliation;
- versioned extensible APIs;
- conformance;
- ecosystem and project governance.

GAEP must not copy cloud-native operational complexity into a product-engineering platform without a demonstrated need.

## Inspiration: OpenTelemetry

Proposed relationship: **Interoperability and Observability Inspiration**.

Relevant themes:

- vendor-neutral semantic conventions;
- context propagation;
- traces, metrics, and logs;
- replaceable backends.

Potential future decision: map GAEP run and evidence events to compatible observability standards while preserving product-governance semantics.

## Evaluation Record Template

```yaml
id: EXT-<sequence>
project: <canonical name>
version_evaluated: <version or commit>
evaluated_at: <ISO-8601 timestamp>
owner: <accountable evaluator>
relationship: inspiration|reference|method|adapter|dependency|standard|deferred|rejected
use_case: <GAEP problem>
capabilities: []
limitations: []
security_privacy: []
license: <identifier>
architecture_fit: <assessment>
portability_exit: <assessment>
decision_id: <DEC-ID>
review_trigger: <date or event>
```

## Design Implications

This registry informs:

- [References](990_REFERENCES.md)
- [Platform Architecture](../02_Platform/010_PLATFORM_ARCHITECTURE.md)
- [Codex Working Model](../05_AI_Runtime/040_CODEX_WORKING_MODEL.md)
- [Claude Working Model](../05_AI_Runtime/041_CLAUDE_WORKING_MODEL.md)
- [Future Evolution](../06_Roadmap/053_FUTURE_EVOLUTION.md)
