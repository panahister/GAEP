# Human Approval Model

**Governed AI Engineering Platform (GAEP)**  
**Document ID:** GAEP-PEN-025  
**Version:** 1.0  
**Status:** Draft  
**Authority:** Accountable human decision and approval model

## Purpose

This document defines how humans review, approve, reject, condition, revoke, and evidence material GAEP decisions and actions.

## Foundational Rule

AI may recommend, prepare, evaluate, and execute within authority. Accountability for material product and engineering decisions remains with an identified human role.

Human approval is not a click added for appearance. It is an attributable decision made with sufficient context and evidence.

## Approval Principles

- approval is explicit;
- approval is scoped to an exact subject and version;
- the approver exercises a named role;
- evidence and material uncertainty are visible;
- authority is verified independently from repository write access;
- approval expires or reopens when its assumptions materially change;
- AI does not approve its own or another AI's output;
- risk determines approval strength;
- low-risk reversible work should not be needlessly blocked;
- conditional approval creates enforceable obligations.

## Approval Levels

### A0 — No Human Approval Required

For allowed informational, read-only, or low-risk deterministic actions. Policy still governs access and logging.

### A1 — Human Review Before Promotion

AI may create a draft or local reversible change. A human reviews before the result becomes an accepted artifact or shared change.

### A2 — Explicit Domain Approval

Required for baseline initiative artifacts, architecture decisions, shared changes, or material Product backlog and design scope where applicable.

### A3 — Specialist and Accountable Approval

Required for security, privacy, data, accessibility, legal, regulated, production, or other high-impact changes. Several roles may be required, but one accountable owner must be identifiable.

### A4 — Executive or Constitutional Approval

Required for foundational platform law, organization-wide risk acceptance, major product investment, or exceptional irreversible decisions.

## Approval Subject

An approval must reference:

- artifact, artifact set, decision, change, exception, gate, release, or action;
- exact version or immutable content reference;
- Engineering Initiative, implementation-unit, and organizational scope;
- effective period;
- conditions and excluded scope.

Approval of a concept does not automatically approve its implementation, release, or later changed version.

Consequential approval subjects include requirements and acceptance criteria; architecture style, HLD, and LLD; identity and authentication; authorization; technology exceptions; Organizational Boilerplate creation, replacement, or exception; Test Methodology Decisions; Test Cases; Coverage Targets; security and assurance exceptions; readiness overrides; and accepted risks. Applicability and risk determine the responsible role and approval level.

Architecture, test, coverage, readiness, and exception approval shall reference exact versions and evidence. AI may generate, challenge, review, or route an approval request but cannot supply the accountable decision. Approval must not be inferred from silence, file presence, merge, conversation, or a passing subset of automated checks.

## Approval Request Package

The requester provides:

- decision question in clear language;
- recommendation and alternatives;
- exact proposed scope and versions;
- relevant upstream intent and downstream impact;
- applicable principles and policies;
- risks, assumptions, unknowns, and conflicts;
- review findings and their disposition;
- validation and evidence;
- proposed conditions, rollout, rollback, and follow-up;
- deadline and consequence of delay when relevant.

The runtime should prevent context overload by presenting a concise decision summary with navigable evidence.

## Approval Record

The durable record contains:

- approval ID;
- subject ID and version;
- decision: approved, conditional, changes required, rejected, deferred, revoked;
- approver identity and exercised role;
- authority source;
- timestamp and effective date;
- reviewed evidence and context-pack references;
- accepted risks and conditions;
- expiration, review trigger, or revocation criteria;
- digital signature or integrity reference where policy requires it;
- related change, gate, and run IDs.

## Decision Outcomes

### Approved

The exact subject may proceed within stated scope.

### Conditionally Approved

Progress is allowed if obligations are tracked. Conditions state owner, due date, verification, and consequence of non-compliance.

### Changes Required

The subject returns for revision. Blocking findings and resubmission criteria are explicit.

### Rejected

The subject is not accepted. Rationale remains in the decision history.

### Deferred

The decision awaits information, timing, dependency, or strategic trigger.

### Revoked

Previously granted approval is no longer valid because authority, evidence, assumptions, policy, or conditions changed materially.

## Segregation of Duties

Depending on risk:

- the author should not be the sole reviewer;
- the generator should not be the approver;
- production operator authority may be separate from development;
- security or data decisions require qualified owners;
- exception approvers should differ from those benefiting from the exception when conflict exists.

Small teams may combine people across roles but must preserve role clarity and compensating review.

## Approval Validity

Approval is valid only while:

- the subject version is unchanged;
- material context and policy remain applicable;
- stated conditions are satisfied;
- the approver retains relevant authority;
- the expiration date has not passed;
- no invalidating evidence or event has occurred.

The runtime revalidates approval immediately before a material state transition or external side effect.

## Approval Reopening Triggers

- material scope or version change;
- new high-impact dependency;
- failed or invalidated evidence;
- architecture deviation;
- security, privacy, legal, or compliance finding;
- expired condition or missed obligation;
- changed policy or risk classification;
- operational evidence contradicting assumptions.

## Human-in-the-Loop Experience

Approval interfaces should show:

- what will happen;
- what changes and what remains unchanged;
- why approval is required;
- risk and reversibility;
- evidence and unresolved uncertainty;
- alternatives and recommendation;
- conditions the approver may impose;
- exact buttons or actions and their effects.

Do not use dark patterns, ambiguous defaults, or approval fatigue.

## Approval Delegation

Delegation must be:

- explicit and time-bounded;
- limited by domain, product, risk, and action type;
- attributable to delegator and delegate;
- revocable;
- visible during policy evaluation.

An AI agent cannot receive human accountability through delegation.

## Offline and External Approval

When approval occurs outside GAEP:

- capture an attributable reference or signed record;
- verify subject version and scope;
- identify approver role and authority;
- record time, conditions, and evidence;
- avoid treating an informal message as approval unless policy explicitly permits it.

## Approval Metrics

- approval lead time by level and domain;
- percentage of requests returned for missing decision context;
- conditional obligation completion;
- reopened or revoked approvals;
- post-approval defect and rework;
- rubber-stamp indicators such as unrealistically low review time;
- approver workload and bottlenecks;
- value of reviewer findings;
- low-risk automation rate.

## Anti-Patterns

- `LGTM` without subject version or role;
- approval inferred from a merge, silence, or meeting attendance;
- AI role-playing as approver;
- asking humans to approve an unreadable context dump;
- one approver for every decision regardless of expertise;
- approval captured only in chat;
- expired approval used after material change;
- conditional approval without tracked obligations;
- repeated prompts that pressure the approver.

## Design Implications

This model directly controls:

- [Governance Model](../02_Platform/013_GOVERNANCE_MODEL.md)
- [State Model](../02_Platform/018_STATE_MODEL.md)
- [Artifact Lifecycle](022_ARTIFACT_LIFECYCLE.md)
- [Change Management](023_CHANGE_MANAGEMENT.md)
- [Decision Model](../05_AI_Runtime/044_DECISION_MODEL.md)
- [Agent Execution Flow](../05_AI_Runtime/042_AGENT_EXECUTION_FLOW.md)
- [Dynamic Engineering Model](../02_Platform/019_DYNAMIC_ENGINEERING_MODEL.md)
- [Engineering Assurance and Architecture Model](../02_Platform/020_ENGINEERING_ASSURANCE_AND_ARCHITECTURE_MODEL.md)
