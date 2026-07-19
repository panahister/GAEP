# Command Model

**Governed AI Engineering Platform (GAEP)**  
**Document ID:** GAEP-PLT-014  
**Version:** 1.0  
**Status:** Draft  
**Authority:** Command contract specification

## Purpose

This document defines commands as GAEP's stable, governed expression of user or system intent.

## Command Definition

A command is a versioned contract that declares:

- the outcome requested;
- valid actors and lifecycle states;
- required and optional inputs;
- context-selection rules;
- skills, agents, and tools that may participate;
- expected outputs and artifact effects;
- risk and approval behavior;
- validation, evidence, and failure semantics.

A command is not merely a saved prompt or shell instruction.

## Command Principles

- Intent is stable; implementation is replaceable.
- Commands are declarative at the boundary.
- Commands do not embed hidden approval.
- Context requirements are explicit.
- Outputs are typed and dispositioned.
- Side effects are visible before execution when material.
- Commands are composable but remain independently governable.
- The runtime, not prompt text, enforces policy and state.

## Naming

Command names use lowercase kebab case and an action-object form:

- `classify-initiative`
- `define-scope`
- `model-capabilities`
- `design-domain`
- `analyze-impact`
- `review-requirements`
- `create-backlog`
- `validate-traceability`
- `prepare-release`

Avoid vague names such as `process`, `generate`, `do-work`, or vendor-specific names.

## Command Contract

Each command definition contains:

### Identity

- command ID;
- canonical name;
- semantic version;
- owner;
- status and deprecation information.

### Intent

- purpose;
- supported outcomes;
- non-goals;
- applicable lifecycle stages and artifact types.

### Invocation

- required parameters;
- optional parameters and defaults;
- actor and role constraints;
- target Engineering Initiative, implementation unit, change, or artifact;
- interaction mode: analyze, draft, modify, review, approve-request, or operate.

### Context Contract

- required artifact types and trace relationships;
- policy and standard domains;
- freshness and authority requirements;
- context size strategy;
- behavior for missing, stale, or conflicting context.

### Execution Contract

- candidate skills;
- agent role requirements;
- allowed tools and adapters;
- step constraints;
- concurrency and idempotency behavior;
- timeout, retry, and cancellation semantics.

### Output Contract

- output types and schemas;
- target location or registry;
- draft, proposed-change, or evidence disposition;
- required provenance and trace links;
- user-facing summary requirements.

### Governance Contract

- risk tier calculation;
- required confirmation or approval;
- prohibited contexts;
- external-side-effect declaration;
- evidence and audit requirements.

### Validation Contract

- preconditions;
- deterministic checks;
- reviewer or evaluator checks;
- acceptance criteria;
- success, partial, blocked, denied, and failed outcomes.

## Command Lifecycle

Command definitions move through:

`proposed → designed → validated → approved → active → deprecated → retired`

Breaking changes require a new major version. Active runs retain their invoked version. Deprecation identifies replacement, migration guidance, and retirement date.

## Invocation Lifecycle

1. **Parse:** normalize name, version, parameters, and target.
2. **Resolve:** identify actor, Engineering Initiative, implementation unit where applicable, state, and command definition.
3. **Authorize:** evaluate policy, risk, and side effects.
4. **Prepare Context:** assemble and validate the context pack.
5. **Preview:** show plan, material assumptions, changes, and approvals when needed.
6. **Execute:** run bounded deterministic and agent steps.
7. **Validate:** check output schemas, policies, quality, and acceptance criteria.
8. **Review/Approve:** obtain required accountable disposition.
9. **Commit:** write accepted artifacts or changes through controlled mechanisms.
10. **Record:** persist run, evidence, trace, and resulting state.

## Command Categories

| Category | Examples | Typical side effect |
|---|---|---|
| Discover | `classify-initiative`, `identify-stakeholders` | Draft knowledge and questions. |
| Analyze | `analyze-impact`, `assess-risk` | Analysis artifact; no baseline change. |
| Design | `design-domain`, `model-process` | Proposed artifacts. |
| Generate | `create-backlog`, `generate-test-cases` | Draft or proposed artifact set. |
| Review | `review-architecture`, `validate-traceability` | Findings and disposition recommendation. |
| Change | `apply-approved-change`, `supersede-artifact` | Controlled baseline modification. |
| Operate | `prepare-release`, `collect-evidence` | External or lifecycle effect. |
| Govern | `request-approval`, `grant-exception` | Decision or policy record. |

## Interaction Modes

- **Explain:** read-only response grounded in context.
- **Assess:** analysis with findings and recommendations.
- **Draft:** create provisional artifacts without baseline effect.
- **Propose Change:** create an impact-analyzed change set.
- **Apply Approved Change:** execute only an already authorized scope.
- **Validate:** evaluate against explicit criteria.
- **Operate:** perform an external or lifecycle action under stronger control.

The same conceptual capability may expose separate commands for different risk and side-effect modes.

## Composition

A workflow may compose commands, but each command retains:

- its own context and policy checks;
- explicit input/output mapping;
- separate evidence;
- state-transition boundaries;
- failure and rollback semantics.

Long workflows must support checkpoints and resumability rather than one opaque prompt.

## Dynamic Engineering Command Capabilities

The command catalog shall support conceptual capabilities to classify an initiative; assess applicability; discover an existing system; resolve and challenge requirements; resolve clients, services, data, and integrations; resolve and challenge architecture; generate HLD, LLD, diagrams, and ADRs; review architecture and request or record authorized architecture approval; resolve identity, authorization, and per-unit technology; bind an Organizational Boilerplate; choose a test methodology; generate, review, and route authorized approval of Test Cases; generate automated tests; assess coverage; validate assurance and readiness; analyze change impact; regenerate affected assets; and request or record an authorized exception.

This list defines capability coverage, not a requirement to create one command for every phrase. Canonical names shall use the existing action-object lowercase kebab-case convention and be finalized through the command lifecycle. Commands that record architecture, Test Case, or exception approval shall capture an accountable human decision; they do not grant approval to the invoking AI.

Every such command shall read current repository state and write typed proposed artifacts, decisions, evidence, or approved transitions through controlled mechanisms. Its context contract shall include initiative and implementation-unit scope, applicability, source versions, authority, freshness, relevant Architecture Assets, Assurance Profile, Technology Profile, Boilerplate Binding, and readiness. A command shall stop when required state is missing or contradictory rather than inferring a default from conversation history.

## Example Contract

```yaml
id: gaep.command.analyze-impact
name: analyze-impact
version: 1.0.0
owner: architecture-governance
mode: assess
allowed_states: [baseline, change_proposed, change_analysis]
inputs:
  required: [change_id]
context:
  required_relationships: [changes, depends_on, implements, verifies]
  authority: [governing, authoritative, provisional]
outputs:
  type: impact_assessment
  disposition: evidence
governance:
  base_risk_tier: 1
  approval_required_for_commit: false
validation:
  required_sections: [scope, affected_items, risks, recommendations, unknowns]
```

This example is illustrative; the normative schema belongs in the metadata and command registry implementation.

## Error and Stop Semantics

Commands distinguish:

- **Invalid:** contract or parameter violation.
- **Denied:** actor or policy disallows action.
- **Blocked:** missing decision, approval, context, or dependency.
- **Failed:** execution did not complete as designed.
- **Partial:** useful outputs exist but acceptance is incomplete.
- **Cancelled:** actor or runtime intentionally stopped the run.
- **Completed:** outputs and evidence satisfy the command contract.

No failure state should be represented as a confident natural-language success.

## Command Quality Criteria

A command is ready when:

- users can predict its outcome;
- preconditions and side effects are explicit;
- context selection is reproducible;
- policies can be enforced outside the prompt;
- outputs have schemas and lifecycle disposition;
- evidence is sufficient for review;
- it works through at least one adapter without embedding that adapter;
- retries and failure behavior are understood;
- tests cover allowed, denied, blocked, and successful paths.

## Anti-Patterns

- one universal `generate` command;
- commands that copy entire repositories into prompts;
- side effects hidden inside analysis commands;
- approval embedded as a model instruction;
- command names coupled to a vendor;
- ambiguous output ownership;
- silent fallback to weaker governance;
- unversioned behavioral changes.

## Design Implications

This model directly influences:

- [Skill Model](015_SKILL_MODEL.md)
- [Agent Model](016_AGENT_MODEL.md)
- [Runtime Model](017_RUNTIME_MODEL.md)
- [Context Packs](../04_Repository/031_CONTEXT_PACKS.md)
- [Agent Execution Flow](../05_AI_Runtime/042_AGENT_EXECUTION_FLOW.md)
- [Stop Conditions](../05_AI_Runtime/045_STOP_CONDITIONS.md)
- [Dynamic Engineering Model](019_DYNAMIC_ENGINEERING_MODEL.md)
- [Engineering Assurance and Architecture Model](020_ENGINEERING_ASSURANCE_AND_ARCHITECTURE_MODEL.md)
