# Skill Model

**Governed AI Engineering Platform (GAEP)**  
**Document ID:** GAEP-PLT-015  
**Version:** 1.0  
**Status:** Draft  
**Authority:** Reusable capability specification

## Purpose

This document defines skills as governed, reusable methods that transform context and inputs into typed outputs or evaluations.

## Skill Definition

A skill is a versioned capability package containing instructions, constraints, resources, validation behavior, and an execution contract for a focused engineering method.

Examples:

- capability mapping;
- value-stream analysis;
- domain discovery;
- bounded-context design;
- process modeling;
- conceptual data modeling;
- event classification;
- journey evaluation;
- user-story decomposition;
- architecture review;
- test-case design;
- change-impact analysis.

A skill is not an organizational role, an autonomous agent, a command alias, or an ungoverned prompt.

## Relationship to Other Concepts

- A **command** declares user intent and governance.
- A **skill** defines a repeatable method.
- An **agent** applies reasoning and judgment while following a skill.
- A **runtime** selects, executes, observes, and constrains the skill.
- A **template** structures an output.
- A **validator** checks defined properties.

One command may invoke several skills. One skill may support several commands. A skill should not assume one agent vendor.

## Skill Contract

### Identity

- skill ID and canonical name;
- semantic version;
- owner and maintainers;
- status, maturity, and deprecation;
- capability and domain tags.

### Purpose and Applicability

- problem solved;
- supported lifecycle stages and artifact types;
- inclusion and exclusion conditions;
- required professional expertise;
- known limitations.

### Inputs

- required and optional input types;
- context contract additions;
- preconditions and assumptions;
- allowed authority classes and classification;
- input validation.

### Method

- ordered or adaptive procedure;
- decision points;
- required questions;
- heuristics and analytical frameworks;
- deterministic tool steps;
- expected human interactions;
- stop conditions.

### Outputs

- output schemas or templates;
- required findings, rationale, and uncertainty;
- provenance and trace obligations;
- artifact disposition;
- evidence produced.

### Evaluation

- quality criteria;
- positive and negative examples;
- test fixtures;
- reviewer qualifications;
- known failure modes;
- performance and cost expectations where relevant.

## Skill Types

| Type | Purpose |
|---|---|
| Discovery | Elicit and structure unknown initiative knowledge. |
| Analysis | Evaluate context, alternatives, impacts, or risk. |
| Design | Create a coherent proposed model or artifact. |
| Transformation | Convert between defined representations without changing intent. |
| Review | Assess an artifact against principles, standards, and evidence. |
| Validation | Check deterministic or evaluative acceptance criteria. |
| Operational | Prepare or perform governed external actions. |
| Coordination | Orchestrate specialized capabilities without owning domain decisions. |

## Skill Lifecycle

`proposed → authored → tested → reviewed → approved → active → deprecated → retired`

Promotion to `active` requires:

- a complete contract;
- representative tests;
- validation against at least one realistic context;
- security and data review appropriate to capability;
- named owner;
- version and change history.

## Composition

Composite skills should:

- reference component skill versions;
- define input/output mapping;
- avoid copying instructions;
- preserve each skill's validation and evidence;
- expose orchestration-specific failure behavior;
- avoid hiding required human decisions.

Composition is justified when the combined method is reusable beyond a single run.

## Skill Selection

The runtime selects candidate skills using:

- command contract;
- initiative lifecycle, applicability, artifact, and readiness state;
- domain and capability tags;
- required output type;
- information classification;
- available agent and tool capabilities;
- skill maturity and validation evidence;
- organization, initiative, and Product policy where applicable.

The selected skill and version must appear in the run record.

## Specialization and Tailoring

Skills may be:

- universal platform skills;
- organizational domain skills;
- initiative-tailored skills, including Product-specific specializations;
- tool-adapter helper skills.

Tailored skills should extend or configure an approved base when possible. They must declare differences, rationale, compatibility, and owner.

## Adaptive Engineering Skill Families

GAEP shall support capability-centric skill families for:

- initiative classification, applicability resolution, existing-system discovery, and requirements challenge;
- architecture analysis, trade-off evaluation, diagramming, HLD, LLD, and architecture review;
- client, service, module, data, integration, and deployment topology;
- identity architecture, authentication, authorization modeling, security architecture, and threat analysis;
- technology evaluation, database and broker selection, cache-necessity assessment, and interoperability analysis;
- Test Methodology Decision, Gherkin authoring, BDD, TDD, example mapping, contract testing, Test Case design, risk-based testing, security testing, authorization testing, and coverage analysis;
- Organizational Boilerplate discovery and validation, contextual pattern selection, assurance review, readiness validation, and change-impact analysis.

Families define reusable methods, not mandatory lifecycle steps. Selection is controlled by the Applicability Matrix, initiative and implementation-unit context, risk, and command contract. Technology-specific skills may extend an approved capability family, but the core method shall not assume a language, framework, database, broker, architecture style, UI, Gherkin, or Figma.

Skills that generate architecture or tests shall produce Draft artifacts with provenance and trace links. Review, challenge, and approval remain separate responsibilities under the [Dynamic Engineering Model](019_DYNAMIC_ENGINEERING_MODEL.md) and [Engineering Assurance and Architecture Model](020_ENGINEERING_ASSURANCE_AND_ARCHITECTURE_MODEL.md).

## Skill Evaluation

Evaluate skills across:

- correctness of method;
- context precision and sufficiency;
- output completeness and consistency;
- trace and provenance quality;
- robustness to missing or conflicting inputs;
- compliance with policy and stop conditions;
- repeatability across agents or models;
- human review effort;
- cost and latency;
- failure transparency.

Evaluation sets should include normal, edge, adversarial, incomplete-context, conflicting-context, and prohibited-action cases.

## Skill Security

- Skills do not grant authority; runtime policy does.
- Embedded instructions cannot override Constitution or policy.
- External content referenced by a skill is untrusted until governed.
- Tool access must be declared and minimized.
- Skills must not request secrets in ordinary context.
- Model-specific instructions belong in adapters unless essential to skill behavior.

## Example Skill Manifest

```yaml
id: gaep.skill.domain.boundary-analysis
name: boundary-analysis
version: 1.0.0
owner: product-architecture
status: active
type: analysis
applies_to:
  lifecycle: [product_architecture, process_data_event]
inputs:
  required: [business_context, capability_map, domain_candidates]
outputs:
  artifact_type: bounded_context_assessment
tools:
  required: []
governance:
  produces_decision: false
evaluation:
  criteria: [cohesion, coupling, language_consistency, ownership, event_boundaries]
```

## Anti-Patterns

- a skill containing every activity in the lifecycle;
- a model-specific prompt presented as a universal method;
- no version, owner, tests, or applicability conditions;
- skills that silently modify approved artifacts;
- validation based only on author confidence;
- duplicated variants without a shared base or divergence explanation;
- skills that confuse recommendation with approval.

## Design Implications

This model directly affects:

- [Command Model](014_COMMAND_MODEL.md)
- [Agent Model](016_AGENT_MODEL.md)
- [Runtime Model](017_RUNTIME_MODEL.md)
- [Package Strategy](../03_Product_Engineering/020_PACKAGE_STRATEGY.md)
- [Context Loading](../05_AI_Runtime/043_CONTEXT_LOADING.md)
- [External Projects](../99_References/993_EXTERNAL_PROJECTS.md)
