# Agent Execution Flow

**Governed AI Engineering Platform (GAEP)**  
**Document ID:** GAEP-AIR-042  
**Version:** 1.0  
**Status:** Draft  
**Authority:** Vendor-neutral agent execution protocol

## Purpose

This document defines the end-to-end flow for any AI agent run in GAEP, from intent through context, execution, human checkpoints, artifact disposition, and learning.

## Execution Invariants

- every run has a declared objective, actor, command, and target;
- policy and state are evaluated before action;
- context sources and versions are visible;
- plans do not grant authority;
- tool access is least-privileged;
- material side effects are separated from analysis;
- generated output remains provisional until lifecycle promotion;
- human approval is explicit and scoped;
- failures and partial completion are not reported as success;
- evidence and resulting state are recorded.

## Phase 1 — Intent Capture

### Inputs

- user or system request;
- Engineering Initiative/workspace and implementation unit where applicable;
- optional target artifact or change;
- invoking identity and channel.

### Actions

1. Normalize the requested outcome.
2. Resolve or propose the canonical command.
3. Distinguish explain, assess, draft, propose, modify, validate, review, or operate mode.
4. Identify requested side effects and expected deliverable.
5. Reject instruction content that attempts to bypass authority.

### Output

An invocation record with objective, scope, command, target, and actor.

## Phase 2 — Identity, State, and Policy Resolution

1. Verify actor identity and exercised role.
2. Load initiative, applicability, lifecycle, artifact, architecture, assurance, readiness, change, approval, and relevant operational state.
3. Confirm command is valid for current state.
4. Evaluate data classification, risk, and action reversibility.
5. Resolve policies, exceptions, confirmations, and approval requirements.

Possible outcomes:

- allowed;
- allowed with obligations;
- allowed only as read-only or draft;
- awaiting approval or confirmation;
- denied;
- blocked by state or missing ownership.

## Phase 3 — Context Assembly

1. Instantiate the command's context contract.
2. Load governing context.
3. Load target and direct authoritative dependencies.
4. Traverse required trace relationships.
5. retrieve approved reusable knowledge.
6. validate freshness, conflicts, access, and classification.
7. produce context manifest and sufficiency result.

If context is insufficient, the agent performs an allowed discovery step or stops.

For architecture, assurance, or implementation work, context includes the Initiative Profile, Applicability Matrix, existing-system state, exact implementation unit, approved requirements and acceptance criteria, Architecture Assets, Technology Profile, Authentication Profile, Authorization Model, approved Test Cases, Assurance Profile, Boilerplate Binding Record, Quality Gates, approvals, and readiness as applicable. Context remains unit-scoped and excludes unrelated stacks unless trace impact requires them.

## Phase 4 — Capability and Agent Selection

The runtime selects:

- skill versions;
- agent role and adapter;
- deterministic validators;
- required tools and integrations;
- human reviewer or approver roles;
- execution and evidence profile.

Selection considers capability, risk, classification, cost, latency, reliability evidence, and availability.

## Phase 5 — Planning

The agent or deterministic planner produces a bounded step graph.

Each step declares:

- objective and output;
- dependencies;
- executor;
- tools and permissions;
- expected read/write scope;
- validation;
- stop conditions;
- side effects and confirmation point;
- recovery or compensation.

The runtime validates the plan against command and policy. A plan change that expands scope or risk triggers reauthorization.

## Phase 6 — Preview and Human Clarification

Preview is required when useful for material changes. It shows:

- proposed actions and artifacts;
- affected scope;
- assumptions and unknowns;
- external or destructive effects;
- expected evidence;
- required decisions.

Clarification questions are used only for material ambiguity. Answers become run context and, when durable, proposed knowledge or decisions.

## Phase 7 — Execution

For each ready step:

1. recheck relevant state and authorization;
2. provide only the step's context and tools;
3. execute deterministic or agent work;
4. capture observations, output, provenance, cost, and errors;
5. validate output contract;
6. update step and run state;
7. stop or replan on unexpected material impact.

Parallel steps require non-conflicting write scopes and independent decisions.

## Phase 8 — Validation and Review

Validation layers:

1. structural/schema;
2. state and policy;
3. metadata and trace;
4. deterministic tests or checks;
5. applicable coverage, security, authentication, authorization, architecture-conformance, and Quality Gate evaluation;
6. Test Evidence collection with exact subject and environment versions;
7. skill-specific semantic evaluation;
8. independent AI or specialist review;
9. human review where required.

Findings are classified, linked, assigned, and dispositioned. The generating agent does not suppress unfavorable evidence.

## Phase 9 — Approval Checkpoint

If baseline, release, exception, or material change is requested:

1. freeze or identify exact subject versions;
2. assemble the approval request package;
3. verify approver authority;
4. obtain explicit outcome;
5. record conditions and expiration;
6. revalidate state before commit.

Changes after approval reopen the checkpoint when material.

## Phase 10 — Commit and Promotion

The runtime:

- applies only approved changes;
- performs atomic or controlled writes where practical;
- updates artifact state and baselines;
- creates supersession and trace relationships;
- records transition events;
- verifies committed state;
- leaves partial or rejected output outside authoritative baselines.

## Phase 11 — Completion

The agent reports:

- outcome and disposition;
- artifacts, files, and external systems affected;
- validation and evidence;
- approvals and conditions;
- assumptions, warnings, and residual risk;
- next valid actions.

The runtime marks the run completed, partial, blocked, denied, failed, cancelled, or rolled back.

## Phase 12 — Learning

After material work:

- compare outcome with objective;
- capture unexpected impact or failure modes;
- propose updates to context, skills, templates, policies, or patterns;
- validate whether learning is initiative-specific or reusable;
- retain required evidence and expire temporary data.

Learning follows artifact and approval lifecycles.

## Long-Running Runs

Long runs support:

- checkpoints;
- pause and resume;
- bounded leases for locks;
- context and policy revalidation;
- progress and waiting reason;
- human handoff;
- cancellation and compensation;
- expiry of approvals and credentials.

Resumption never assumes that mutable state remains unchanged.

## Failure Handling

Failures are classified as:

- contract or input error;
- authorization denial;
- missing context or dependency;
- tool or adapter failure;
- model or semantic failure;
- validation failure;
- conflict or stale state;
- external side-effect uncertainty;
- policy or security violation.

The runtime chooses retry, replan, human escalation, compensation, rollback, or termination according to class and policy.

## Evidence Produced

- invocation and policy decision;
- context manifest;
- capability and agent selection;
- plan and revisions;
- step results and tool evidence;
- validation and review findings;
- human decisions and approvals;
- applicability, Challenge Records, architecture and assurance versions, Quality Gate results, freshness, and readiness;
- commit and transition records;
- completion summary and learning proposal.

## Design Implications

This flow directly implements:

- [Runtime Model](../02_Platform/017_RUNTIME_MODEL.md)
- [State Model](../02_Platform/018_STATE_MODEL.md)
- [Context Loading](043_CONTEXT_LOADING.md)
- [Decision Model](044_DECISION_MODEL.md)
- [Stop Conditions](045_STOP_CONDITIONS.md)
- [Human Approval Model](../03_Product_Engineering/025_HUMAN_APPROVAL_MODEL.md)
- [Dynamic Engineering Model](../02_Platform/019_DYNAMIC_ENGINEERING_MODEL.md)
- [Engineering Assurance and Architecture Model](../02_Platform/020_ENGINEERING_ASSURANCE_AND_ARCHITECTURE_MODEL.md)
