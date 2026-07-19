# Change Management

**Governed AI Engineering Platform (GAEP)**  
**Document ID:** GAEP-PEN-023  
**Version:** 1.0  
**Status:** Draft  
**Authority:** Controlled-change process

## Purpose

This document defines how GAEP changes approved initiative knowledge, platform specifications, reusable assets, implementation, releases, and operational configuration while preserving accountability and traceability.

## Change Principles

- Change is expected; uncontrolled change is not.
- Analysis precedes approval for material change.
- Approval applies to a defined scope and version.
- Baselines are superseded, not silently rewritten.
- Downstream impact is a first-class output.
- Risk determines control depth.
- Emergency speed does not remove ownership or retrospective evidence.
- AI may prepare and execute authorized work but cannot self-approve.

## Change Types

| Type | Examples |
|---|---|
| Editorial | Clarification with no semantic effect. |
| Corrective | Fixes an error, defect, or inconsistency. |
| Adaptive | Responds to external system, regulation, or platform change. |
| Perfective | Improves quality, usability, performance, or maintainability. |
| Evolutive | Adds or changes product capability or architecture. |
| Emergency | Addresses urgent security, availability, or material business risk. |
| Constitutional | Changes highest-level GAEP law or identity. |
| Reusable-Asset | Changes shared package, skill, command, template, or boilerplate. |

Type does not determine risk alone; scope and impact do.

## Change Record

Every material change includes:

- change ID, title, type, and owner;
- trigger and problem statement;
- desired outcome and success criteria;
- scope and explicit non-scope;
- affected baseline candidates;
- urgency, priority, and risk tier;
- assumptions and constraints;
- impact assessment;
- alternatives and decision;
- plan, validation, rollout, and rollback;
- required reviews and approval;
- implementation runs and evidence;
- final disposition and learning.

## Standard Change Flow

### 1. Request

Capture the trigger, problem, desired outcome, requester, and initial scope. A conversation or defect report becomes durable through this record.

### 2. Triage

Confirm:

- ownership;
- duplicate or related changes;
- urgency and value;
- risk and classification;
- affected lifecycle stage;
- whether analysis is justified now.

Outcomes: accept for analysis, request clarification, defer, reject, or route to emergency flow.

### 3. Impact Analysis

Use typed trace links and expert review to identify:

- affected business objectives and capabilities;
- domains, processes, rules, data, and events;
- actors, roles, authorization, privacy, and security;
- journeys, UX states, design-system assets, and accessibility;
- backlog, contracts, architecture, implementation, and tests;
- releases, operations, support, documentation, and training;
- shared packages, skills, templates, and downstream initiatives;
- migration, compatibility, cost, and schedule risks.

Unknown impact is recorded as risk, not assumed absent.

### 4. Design and Options

Prepare alternatives including:

- do nothing or defer;
- minimal corrective change;
- incremental or feature-flagged change;
- broader redesign;
- reuse or external integration.

Compare value, risk, complexity, reversibility, compatibility, and long-term effect.

### 5. Approval

Approvers receive a decision-ready package:

- recommendation and alternatives;
- exact affected baselines and proposed scope;
- impact, risk, evidence, and unresolved unknowns;
- implementation and validation plan;
- rollout, rollback, and communication;
- conditions and required follow-up.

Scope expansion after approval triggers re-analysis and, when material, re-approval.

### 6. Implementation

Execute in small governed slices. Each run:

- references the change and approved scope;
- uses current context;
- produces a reviewable diff;
- follows architecture and standards;
- adds or updates tests and evidence;
- stops on unexpected material impact.

### 7. Validation

Validate success criteria, architecture conformance, trace completeness, security, quality, migration, compatibility, and rollback readiness as applicable.

### 8. Baseline and Release

Promote approved artifact versions, supersede prior baselines, update trace relationships, publish relevant notes, and execute release controls.

### 9. Closure and Learning

Confirm outcome, residual risks, operational observations, debt, follow-up items, and reusable lessons. Closure does not erase the change record.

## Change Risk Assessment

Assess:

- user and business impact;
- security, privacy, legal, and compliance exposure;
- data migration and integrity;
- architecture and integration breadth;
- reversibility and rollback time;
- operational availability and support;
- number and authority of affected artifacts;
- uncertainty and evidence quality;
- reusable-asset blast radius;
- cost and schedule.

Risk tier determines reviewers, evidence, environment, and approval strength.

## Dynamic Engineering Impact Surface

Impact analysis shall explicitly consider changes to requirements, acceptance criteria, architecture style, service or module boundary, client type, language, framework, database, cache, broker, API, event contract, identity or authentication provider, authorization policy, trust boundary, Test Methodology Decision, Test Cases, deployment, Organizational Boilerplate, and security model.

A relevant change shall traverse and re-evaluate affected Architecture Decisions and Assets, HLD, LLD, diagrams, topology, Technology Profiles, Boilerplate Bindings, Authentication Profile, Authorization Model, Assurance Profiles, Test Cases, Coverage Targets, Test Evidence, Quality Gates, deployment, observability, risks, approvals, and Implementation Readiness. Affected assets are marked Potentially Stale, Stale, Invalidated, or Regeneration Required until dispositioned.

Re-evaluation is proportional and trace-driven. An isolated documentation correction need not reopen implementation. A broker, trust-boundary, contract, authorization, or test-methodology change may require architecture regeneration, new tests, evidence, and reapproval. Prior approval never silently expands to materially changed versions or scope. See [019](../02_Platform/019_DYNAMIC_ENGINEERING_MODEL.md) and [020](../02_Platform/020_ENGINEERING_ASSURANCE_AND_ARCHITECTURE_MODEL.md).

## Emergency Changes

Emergency flow may compress analysis and approval but requires:

- declared emergency and accountable incident/change owner;
- minimum safe impact and rollback analysis;
- explicit high-authority approval;
- restricted scope and least-risk action;
- real-time evidence and communication;
- post-change verification;
- mandatory retrospective and follow-up baseline correction.

AI cannot declare an emergency to bypass controls.

## Parallel and Conflicting Changes

When changes overlap:

- identify shared artifacts and semantic conflicts;
- establish precedence or integration owner;
- rebase impact against current baselines;
- avoid concurrent approvals based on stale versions;
- merge decisions, not only file text;
- revalidate combined behavior.

## Changes to Shared Assets

Commands, skills, templates, packages, policies, and boilerplates have broader impact. Their changes require:

- compatibility analysis;
- affected product discovery;
- migration and deprecation strategy;
- reference test suite;
- staged release where practical;
- rollback or version coexistence.

## Change Evidence

- request and triage decision;
- impact graph or report;
- option analysis and decision record;
- approval;
- implementation diffs and runs;
- reviews, tests, and validation results;
- baseline and deployment records;
- post-change observations;
- closure and learning.

## Metrics

- lead time by change type and risk;
- rework after approval;
- unexpected affected-artifact rate;
- rollback and incident rate;
- percentage with complete impact and validation evidence;
- emergency-change recurrence;
- stale approval or concurrent-conflict failures;
- realized versus expected outcome.

## Anti-Patterns

- approving an idea before understanding impact;
- using a code diff as the entire change record;
- allowing approved scope to expand silently;
- overwriting baselines;
- assuming no trace link means no impact;
- skipping documentation because the code is self-explanatory;
- using emergency flow for schedule pressure;
- closing a change when deployment succeeds but outcome is unknown.

## Design Implications

This process directly governs:

- [Artifact Lifecycle](022_ARTIFACT_LIFECYCLE.md)
- [Traceability Model](024_TRACEABILITY_MODEL.md)
- [Human Approval Model](025_HUMAN_APPROVAL_MODEL.md)
- [State Model](../02_Platform/018_STATE_MODEL.md)
- [Decision Model](../05_AI_Runtime/044_DECISION_MODEL.md)
- [Implementation Strategy](../06_Roadmap/051_IMPLEMENTATION_STRATEGY.md)
- [Dynamic Engineering Model](../02_Platform/019_DYNAMIC_ENGINEERING_MODEL.md)
- [Engineering Assurance and Architecture Model](../02_Platform/020_ENGINEERING_ASSURANCE_AND_ARCHITECTURE_MODEL.md)
